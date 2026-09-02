import Foundation
import ImageIO
import UIKit
import Vision
import WebKit

@MainActor
final class MSHNotificationBridge: NSObject, WKScriptMessageHandler, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    static let handlerName = "mshNotifications"

    weak var webView: WKWebView?
    private let service: MSHNotificationService
    private var barcodeContinuation: CheckedContinuation<String, Error>?
    private weak var barcodePicker: UIImagePickerController?

    init(service: MSHNotificationService = .shared) {
        self.service = service
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.handlerName,
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        let requestID = body["requestId"] as? String
        MSHDebugLifecycle.log("notification_bridge_action_received", "action=\(action)")

        Task {
            do {
                switch action {
                case "requestNotificationAuthorization":
                    let status = try await service.requestAuthorization()
                    await respond(requestID: requestID, action: action, status: status)
                case "notificationStatus":
                    let status = await service.authorizationStatus()
                    await respond(requestID: requestID, action: action, status: status)
                case "scheduleNotification":
                    let notification = try Self.notification(from: body)
                    let outcome = try await service.schedule(notification)
                    await respond(
                        requestID: requestID,
                        action: action,
                        identifier: notification.identifier,
                        outcome: outcome
                    )
                case "cancelNotification":
                    guard let identifier = body["id"] as? String, !identifier.isEmpty else {
                        throw BridgeError.missingField("id")
                    }
                    let canceled = await service.cancel(identifier: identifier)
                    await respond(
                        requestID: requestID,
                        action: action,
                        identifier: identifier,
                        canceledCount: canceled ? 1 : 0
                    )
                case "cancelNotificationsForEvent":
                    guard let eventID = body["eventId"] as? String, !eventID.isEmpty else {
                        throw BridgeError.missingField("eventId")
                    }
                    let canceled = await service.cancelNotifications(eventID: eventID)
                    await respond(
                        requestID: requestID,
                        action: action,
                        canceledCount: canceled.count
                    )
                case "scanBarcode":
                    let barcode = try await scanBarcode()
                    await respond(requestID: requestID, action: action, barcode: barcode)
                default:
                    throw BridgeError.unsupportedAction(action)
                }
            } catch {
                MSHDebugLifecycle.log(
                    "notification_bridge_action_failed",
                    "action=\(action) swiftType=\(String(reflecting: type(of: error))) description=\(error.localizedDescription)"
                )
                await respond(
                    requestID: requestID,
                    action: action,
                    error: error.localizedDescription
                )
            }
        }
    }

    static func notification(from body: [String: Any]) throws -> MSHLocalNotification {
        let identifier = try requiredString("id", in: body)
        let title = try requiredString("title", in: body)
        let message = try requiredString("body", in: body)
        let dateValue = try requiredString("date", in: body)
        let routeValue = try requiredString("route", in: body)
        guard let date = dateFormatter.date(from: dateValue) ?? fractionalDateFormatter.date(from: dateValue) else {
            throw BridgeError.invalidDate(dateValue)
        }
        guard let route = MSHWebRoute(rawValue: routeValue) else {
            throw BridgeError.invalidRoute(routeValue)
        }
        let type = (body["type"] as? String).flatMap(MSHNotificationType.init(rawValue:))
            ?? MSHNotificationType.inferred(identifier: identifier, route: routeValue)
        let eventID = (body["eventId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return MSHLocalNotification(
            identifier: identifier,
            title: title,
            body: message,
            date: date,
            route: route,
            eventID: eventID?.isEmpty == false ? eventID! : identifier,
            type: type
        )
    }

    private func scanBarcode() async throws -> String {
        guard barcodeContinuation == nil else { throw BridgeError.scannerBusy }
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else { throw BridgeError.cameraUnavailable }
        guard let presenter = Self.presentingViewController() else { throw BridgeError.missingPresentingViewController }

        return try await withCheckedThrowingContinuation { continuation in
            barcodeContinuation = continuation
            let picker = UIImagePickerController()
            picker.sourceType = .camera
            picker.cameraCaptureMode = .photo
            picker.delegate = self
            picker.modalPresentationStyle = .fullScreen
            barcodePicker = picker
            presenter.present(picker, animated: true)
        }
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        finishBarcodeScan(.failure(BridgeError.scannerCanceled))
    }

    func imagePickerController(
        _ picker: UIImagePickerController,
        didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
    ) {
        guard let image = info[.originalImage] as? UIImage else {
            picker.dismiss(animated: true)
            finishBarcodeScan(.failure(BridgeError.invalidBarcodeImage))
            return
        }

        do {
            let value = try Self.detectBarcode(in: image)
            picker.dismiss(animated: true)
            finishBarcodeScan(.success(value))
        } catch {
            picker.dismiss(animated: true)
            finishBarcodeScan(.failure(error))
        }
    }

    private func finishBarcodeScan(_ result: Result<String, Error>) {
        let continuation = barcodeContinuation
        barcodeContinuation = nil
        barcodePicker = nil
        switch result {
        case .success(let value): continuation?.resume(returning: value)
        case .failure(let error): continuation?.resume(throwing: error)
        }
    }

    private static func detectBarcode(in image: UIImage) throws -> String {
        guard let cgImage = image.cgImage else { throw BridgeError.invalidBarcodeImage }
        let request = VNDetectBarcodesRequest()
        request.symbologies = [.ean8, .ean13, .upce, .code128, .code39, .code93, .itf14, .qr]
        let handler = VNImageRequestHandler(
            cgImage: cgImage,
            orientation: image.imageOrientation.cgImagePropertyOrientation,
            options: [:]
        )
        try handler.perform([request])
        guard let payload = request.results?
            .compactMap({ $0.payloadStringValue?.trimmingCharacters(in: .whitespacesAndNewlines) })
            .first(where: { !$0.isEmpty }) else {
            throw BridgeError.barcodeNotFound
        }
        return payload
    }

    private func respond(
        requestID: String?,
        action: String,
        status: MSHNotificationPermissionStatus? = nil,
        identifier: String? = nil,
        outcome: MSHNotificationScheduleOutcome? = nil,
        canceledCount: Int? = nil,
        barcode: String? = nil,
        error: String? = nil
    ) async {
        let response = BridgeResponse(
            requestId: requestID,
            action: action,
            status: status?.rawValue,
            identifier: identifier,
            outcome: outcome?.rawValue,
            canceledCount: canceledCount,
            barcode: barcode,
            error: error
        )
        guard let data = try? JSONEncoder().encode(response) else { return }
        let script = "window.MSHNotificationsReceive(JSON.parse(atob('\(data.base64EncodedString())')))"
        do {
            _ = try await webView?.evaluateJavaScript(script)
        } catch {
            MSHDebugLifecycle.log(
                "notification_bridge_callback_failed",
                "action=\(action) description=\(error.localizedDescription)"
            )
        }
    }

    private static func requiredString(_ key: String, in body: [String: Any]) throws -> String {
        guard let value = body[key] as? String,
              !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw BridgeError.missingField(key)
        }
        return value
    }

    private static func presentingViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let keyWindow = scenes.flatMap(\.windows).first(where: \.isKeyWindow)
        var controller = keyWindow?.rootViewController
        while let presented = controller?.presentedViewController { controller = presented }
        if let navigation = controller as? UINavigationController { return navigation.visibleViewController ?? navigation }
        if let tab = controller as? UITabBarController { return tab.selectedViewController ?? tab }
        return controller
    }

    private static let dateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let fractionalDateFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private enum BridgeError: LocalizedError {
        case missingField(String)
        case invalidDate(String)
        case invalidRoute(String)
        case unsupportedAction(String)
        case scannerBusy
        case scannerCanceled
        case cameraUnavailable
        case missingPresentingViewController
        case invalidBarcodeImage
        case barcodeNotFound

        var errorDescription: String? {
            switch self {
            case .missingField(let field): "Missing required notification field: \(field)."
            case .invalidDate(let date): "Invalid ISO-8601 notification date: \(date)."
            case .invalidRoute(let route): "Invalid local MSH notification route: \(route)."
            case .unsupportedAction(let action): "Unsupported notification action: \(action)."
            case .scannerBusy: "The barcode camera is already open."
            case .scannerCanceled: "Barcode scan canceled."
            case .cameraUnavailable: "The camera is unavailable on this device."
            case .missingPresentingViewController: "My Simple Health could not open the camera."
            case .invalidBarcodeImage: "The captured image could not be read."
            case .barcodeNotFound: "No barcode was detected. Try again with the barcode centered and well lit."
            }
        }
    }
}

private extension UIImage.Orientation {
    var cgImagePropertyOrientation: CGImagePropertyOrientation {
        switch self {
        case .up: .up
        case .down: .down
        case .left: .left
        case .right: .right
        case .upMirrored: .upMirrored
        case .downMirrored: .downMirrored
        case .leftMirrored: .leftMirrored
        case .rightMirrored: .rightMirrored
        @unknown default: .up
        }
    }
}

private struct BridgeResponse: Encodable {
    let requestId: String?
    let action: String
    let status: String?
    let identifier: String?
    let outcome: String?
    let canceledCount: Int?
    let barcode: String?
    let error: String?
}
