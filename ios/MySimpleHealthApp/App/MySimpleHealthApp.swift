import SwiftUI
import OSLog
import Darwin

enum MSHDebugLifecycle {
#if DEBUG
    static let processSessionID = UUID().uuidString
    private static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "org.mysimplehealth.app",
        category: "Lifecycle"
    )

    static func log(_ event: String, _ details: String = "") {
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let pid = ProcessInfo.processInfo.processIdentifier
        let memory = residentMemoryBytes().map(String.init) ?? "unavailable"
        let suffix = details.isEmpty ? "" : " \(details)"
        let line = "[MSHLifecycle] timestamp=\(timestamp) pid=\(pid) session=\(processSessionID) event=\(event) residentBytes=\(memory)\(suffix)"
        print(line)
        logger.notice("\(line, privacy: .public)")
    }

    private static func residentMemoryBytes() -> UInt64? {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(
            MemoryLayout<mach_task_basic_info_data_t>.size / MemoryLayout<natural_t>.size
        )
        let result = withUnsafeMutablePointer(to: &info) { infoPointer in
            infoPointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) { reboundPointer in
                task_info(
                    mach_task_self_,
                    task_flavor_t(MACH_TASK_BASIC_INFO),
                    reboundPointer,
                    &count
                )
            }
        }
        guard result == KERN_SUCCESS else { return nil }
        return UInt64(info.resident_size)
    }
#else
    static func log(_ event: String, _ details: String = "") {}
#endif
}

@main
struct MySimpleHealthApp: App {
    @UIApplicationDelegateAdaptor(MSHApplicationDelegate.self) private var applicationDelegate

    init() {
        MSHDebugLifecycle.log("process_launch")
        MSHWebRuntime.logStartupConfiguration()
    }

    var body: some Scene {
        WindowGroup { MSHSceneRoot() }
    }
}

private struct MSHSceneRoot: View {
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var lifecycle = MSHSceneLifecycleProbe()

    var body: some View {
        MSHAuthenticatedRootExperience()
            .onAppear {
                MSHDebugLifecycle.log(
                    scenePhase.mshLifecycleEvent,
                    "scene=\(lifecycle.sceneID) initial=true"
                )
            }
            .onChange(of: scenePhase) { _, newPhase in
                MSHDebugLifecycle.log(
                    newPhase.mshLifecycleEvent,
                    "scene=\(lifecycle.sceneID)"
                )
            }
    }
}

@MainActor
private final class MSHSceneLifecycleProbe: ObservableObject {
    let sceneID = UUID().uuidString

    init() {
        MSHDebugLifecycle.log("scene_created", "scene=\(sceneID)")
    }

    deinit {
        MSHDebugLifecycle.log("scene_destroyed", "scene=\(sceneID)")
    }
}

private extension ScenePhase {
    var mshLifecycleEvent: String {
        switch self {
        case .active: "scene_activated"
        case .inactive: "scene_inactive"
        case .background: "scene_backgrounded"
        @unknown default: "scene_phase_unknown"
        }
    }
}
