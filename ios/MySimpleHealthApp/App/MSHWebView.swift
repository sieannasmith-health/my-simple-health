import SwiftUI
import UIKit
import WebKit

enum MSHFeatureDestination: String, CaseIterable, Identifiable {
    case myHealth
    case calendar
    case movementPlan
    case movementLibrary
    case landscape
    case selfInsight
    case horizon
    case path
    case practice
    case discovery
    case journey
    case food
    case financialHealth

    var id: Self { self }

    var title: String {
        switch self {
        case .myHealth: "My Health"
        case .calendar: "Calendar"
        case .movementPlan: "Plan Movement"
        case .movementLibrary: "Movement Library"
        case .landscape: "Landscape"
        case .selfInsight: "Self-Insight"
        case .horizon: "Horizon"
        case .path: "Path"
        case .practice: "Practice"
        case .discovery: "Discovery"
        case .journey: "Journey"
        case .food: "Food"
        case .financialHealth: "Financial Health"
        }
    }

    var path: String {
        switch self {
        case .myHealth: "my-health.html"
        case .calendar, .movementPlan: "calendar.html"
        case .movementLibrary: "movement-library.html"
        case .landscape: "health-landscape.html"
        case .selfInsight: "assessments.html"
        case .horizon: "my-vision.html"
        case .path: "my-project.html"
        case .practice: "my-practice.html"
        case .discovery: "my-learning.html"
        case .journey: "my-progress.html"
        case .food: "my-food.html"
        case .financialHealth: "financial-health.html"
        }
    }

    var query: String? {
        self == .movementPlan ? "view=movement" : nil
    }
}

enum MSHWebRuntime {
    static let productionURL = URL(string: "https://mysimplehealth.org/my-health.html")!

    static func initialURL(environment: [String: String] = ProcessInfo.processInfo.environment) -> URL {
#if DEBUG
        if let value = environment["MSH_WEB_APP_URL"]?.trimmingCharacters(in: .whitespacesAndNewlines),
           !value.isEmpty,
           let url = URL(string: value),
           url.scheme == "https" || url.scheme == "http",
           url.host != nil {
            return url
        }
#endif
        return productionURL
    }

    static func url(
        for destination: MSHFeatureDestination,
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> URL {
        url(for: MSHWebRoute(destination: destination), environment: environment)
    }

    static func url(
        for route: MSHWebRoute,
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> URL {
        let entryURL = initialURL(environment: environment)
        var components = URLComponents(url: entryURL, resolvingAgainstBaseURL: false)!
        let parentPath = (components.path as NSString).deletingLastPathComponent
        let routeComponents = URLComponents(string: route.rawValue)!
        components.path = (parentPath as NSString).appendingPathComponent(routeComponents.path)
        components.queryItems = routeComponents.queryItems
        components.fragment = nil
        return components.url!
    }
}

struct MSHWebView: UIViewRepresentable {
    let route: MSHWebRoute

    init(destination: MSHFeatureDestination = .myHealth) {
        route = MSHWebRoute(destination: destination)
    }

    init(route: MSHWebRoute) {
        self.route = route
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
#if DEBUG
        configuration.userContentController.addUserScript(WKUserScript(
            source: "window.MSH_DEBUG = true;",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
#endif
        configuration.userContentController.addUserScript(WKUserScript(
            source: Self.nativeShellScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        configuration.userContentController.addUserScript(WKUserScript(
            source: Self.notificationBridgeScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        configuration.userContentController.add(context.coordinator.bridge, name: "mshHealth")
        configuration.userContentController.add(
            context.coordinator.notificationBridge,
            name: MSHNotificationBridge.handlerName
        )
        let webView = WKWebView(frame: .zero, configuration: configuration)
        MSHDebugLifecycle.log("webview_created", "webview=\(ObjectIdentifier(webView))")
        context.coordinator.bridge.webView = webView
        context.coordinator.notificationBridge.webView = webView
        webView.navigationDelegate = context.coordinator
        let initialURL = MSHWebRuntime.url(for: route)
        context.coordinator.configure(initialURL: initialURL)
        context.coordinator.markRequested(route: route)
        let request = URLRequest(url: initialURL)
#if DEBUG
        print("[MSHWebView] LOAD REQUEST:", request.url?.absoluteString ?? "nil")
#endif
        MSHDebugLifecycle.log(
            "webview_load_request",
            "webview=\(ObjectIdentifier(webView)) url=\(request.url?.absoluteString ?? "nil")"
        )
        webView.load(request)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.shouldRequest(route: route) else { return }
        let url = MSHWebRuntime.url(for: route)
        MSHDebugLifecycle.log(
            "webview_route_update",
            "webview=\(ObjectIdentifier(webView)) route=\(route.rawValue) url=\(url.absoluteString)"
        )
        webView.load(URLRequest(url: url))
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        MSHDebugLifecycle.log("webview_dismantled", "webview=\(ObjectIdentifier(webView))")
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "mshHealth")
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: MSHNotificationBridge.handlerName
        )
    }

    private static let nativeShellScript = """
        window.MSH_NATIVE_SHELL = true;
        document.documentElement.classList.add('msh-native-embedded');
        const style = document.createElement('style');
        style.id = 'msh-native-shell-style';
        style.textContent = `
          [data-msh-header], [data-msh-mobile-nav], .msh-app-utility-footer,
          .site-header, .site-footer { display: none !important; }
          html, body { min-height: 100%; }
          body { padding-top: 0 !important; }
          .msh-app-shell, .msh-app-main { min-height: 100%; }
          .movement-library-inner { padding-top: 32px !important; }
        `;
        (document.head || document.documentElement).appendChild(style);
        """

    static let notificationBridgeScript = """
        (() => {
          if (window.MSHNotifications) return;
          const pending = new Map();
          let sequence = 0;
          const send = (action, payload = {}) => new Promise((resolve, reject) => {
            const requestId = `notification-${Date.now()}-${++sequence}`;
            pending.set(requestId, { resolve, reject });
            const handler = window.webkit?.messageHandlers?.mshNotifications;
            if (!handler) {
              pending.delete(requestId);
              reject(new Error('Native notifications are unavailable.'));
              return;
            }
            handler.postMessage({ action, requestId, ...payload });
          });
          window.MSHNotificationsReceive = response => {
            const callback = response?.requestId ? pending.get(response.requestId) : null;
            if (!callback) return;
            pending.delete(response.requestId);
            response.error ? callback.reject(new Error(response.error)) : callback.resolve(response);
          };
          window.MSHNotifications = Object.freeze({
            requestAuthorization: () => send('requestNotificationAuthorization'),
            status: () => send('notificationStatus'),
            schedule: notification => send('scheduleNotification', notification),
            cancel: id => send('cancelNotification', { id }),
            cancelEvent: eventId => send('cancelNotificationsForEvent', { eventId })
          });
        })();
        """

    final class Coordinator: NSObject, WKNavigationDelegate {
        let bridge = AppleHealthBridge()
        let notificationBridge = MSHNotificationBridge()
        private var testOrigin: (scheme: String, host: String, port: Int?)?
        private var requestedRoute: MSHWebRoute?

        func markRequested(route: MSHWebRoute) {
            requestedRoute = route
        }

        func shouldRequest(route: MSHWebRoute) -> Bool {
            guard requestedRoute != route else { return false }
            requestedRoute = route
            return true
        }

        func configure(initialURL: URL) {
            guard initialURL != MSHWebRuntime.productionURL,
                  let scheme = initialURL.scheme?.lowercased(),
                  let host = initialURL.host?.lowercased() else { return }
            testOrigin = (scheme, host, initialURL.port)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
        ) {
#if DEBUG
            print("[MSHWebView] NAVIGATION REQUEST:", navigationAction.request.url?.absoluteString ?? "nil")
#endif
            MSHDebugLifecycle.log(
                "navigation_request",
                "webview=\(ObjectIdentifier(webView)) url=\(navigationAction.request.url?.absoluteString ?? "nil")"
            )
            guard let url = navigationAction.request.url,
                  let scheme = url.scheme?.lowercased(),
                  let host = url.host?.lowercased() else { decisionHandler(.cancel); return }
            let isProduction = scheme == "https" && (host == "mysimplehealth.org" || host.hasSuffix(".mysimplehealth.org"))
            let isConfiguredTest = testOrigin.map { $0.scheme == scheme && $0.host == host && $0.port == url.port } ?? false
            decisionHandler(isProduction || isConfiguredTest ? .allow : .cancel)
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
#if DEBUG
            webView.viewWithTag(debugFailureViewTag)?.removeFromSuperview()
            print("[MSHWebView] navigation start:", webView.url?.absoluteString ?? "nil")
#endif
            MSHDebugLifecycle.log(
                "navigation_started",
                "webview=\(ObjectIdentifier(webView)) url=\(webView.url?.absoluteString ?? "nil")"
            )
        }

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
#if DEBUG
            print("[MSHWebView] navigation commit:", webView.url?.absoluteString ?? "nil")
#endif
            MSHDebugLifecycle.log(
                "navigation_committed",
                "webview=\(ObjectIdentifier(webView)) url=\(webView.url?.absoluteString ?? "nil")"
            )
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
#if DEBUG
            print("[MSHWebView] navigation finish:", webView.url?.absoluteString ?? "nil")
#endif
            MSHDebugLifecycle.log(
                "navigation_finished",
                "webview=\(ObjectIdentifier(webView)) url=\(webView.url?.absoluteString ?? "nil")"
            )
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
#if DEBUG
            logNavigationFailure("provisional navigation", webView: webView, error: error)
            showNavigationFailure(webView: webView, error: error)
#endif
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
#if DEBUG
            logNavigationFailure("committed navigation", webView: webView, error: error)
            showNavigationFailure(webView: webView, error: error)
#endif
        }

#if DEBUG
        private let debugFailureViewTag = 0x4D5348

        private func logNavigationFailure(_ phase: String, webView: WKWebView, error: Error) {
            let nsError = error as NSError

            MSHDebugLifecycle.log(
                "navigation_failed",
                "phase=\(phase.replacingOccurrences(of: " ", with: "_")) webview=\(ObjectIdentifier(webView)) currentURL=\(webView.url?.absoluteString ?? "nil") domain=\(nsError.domain) code=\(nsError.code) failingURL=\((nsError.userInfo[NSURLErrorFailingURLStringErrorKey] as? String) ?? (nsError.userInfo[NSURLErrorFailingURLErrorKey] as? URL)?.absoluteString ?? "nil") description=\(nsError.localizedDescription) underlying=\(String(describing: nsError.userInfo[NSUnderlyingErrorKey] ?? "nil"))"
            )

            print("[MSHWebView] navigation failed")
            print("[MSHWebView] phase:", phase)
            print("[MSHWebView] currentURL:", webView.url?.absoluteString ?? "nil")
            print("[MSHWebView] domain:", nsError.domain)
            print("[MSHWebView] code:", nsError.code)
            print("[MSHWebView] description:", nsError.localizedDescription)
            print(
                "[MSHWebView] failingURLString:",
                nsError.userInfo[NSURLErrorFailingURLStringErrorKey] ?? "nil"
            )
            print(
                "[MSHWebView] failingURL:",
                nsError.userInfo[NSURLErrorFailingURLErrorKey] ?? "nil"
            )
            print(
                "[MSHWebView] underlyingError:",
                nsError.userInfo[NSUnderlyingErrorKey] ?? "nil"
            )
        }

        private func showNavigationFailure(webView: WKWebView, error: Error) {
            let nsError = error as NSError
            guard nsError.code != NSURLErrorCancelled else { return }

            webView.viewWithTag(debugFailureViewTag)?.removeFromSuperview()
            let message = UILabel()
            message.tag = debugFailureViewTag
            message.translatesAutoresizingMaskIntoConstraints = false
            message.numberOfLines = 0
            message.textAlignment = .left
            message.font = .monospacedSystemFont(ofSize: 14, weight: .regular)
            message.textColor = .label
            message.backgroundColor = .systemBackground
            message.layer.cornerRadius = 16
            message.layer.masksToBounds = true
            message.text = """
            My Simple Health development page could not be reached.

            URL: \(nsError.userInfo[NSURLErrorFailingURLStringErrorKey] ?? webView.url?.absoluteString ?? "nil")
            Error: \(nsError.domain) \(nsError.code)
            \(nsError.localizedDescription)

            Confirm the Mac and iPhone are on the same network and run `npm run dev:device` on the Mac.
            """
            message.accessibilityLabel = message.text
            webView.addSubview(message)
            NSLayoutConstraint.activate([
                message.leadingAnchor.constraint(equalTo: webView.safeAreaLayoutGuide.leadingAnchor, constant: 20),
                message.trailingAnchor.constraint(equalTo: webView.safeAreaLayoutGuide.trailingAnchor, constant: -20),
                message.centerYAnchor.constraint(equalTo: webView.safeAreaLayoutGuide.centerYAnchor)
            ])
        }
#endif
    }
}
