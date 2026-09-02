// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MySimpleHealthHealthKit",
    platforms: [
        .iOS(.v17),
        .macOS(.v13)
    ],
    products: [
        .library(name: "MSHHealthCore", targets: ["MSHHealthCore"]),
        .library(name: "MSHAppleHealthKit", targets: ["MSHAppleHealthKit"])
    ],
    targets: [
        .target(
            name: "MSHHealthProcessing",
            publicHeadersPath: "include",
            cxxSettings: [.headerSearchPath("include")]
        ),
        .target(
            name: "MSHHealthCore",
            dependencies: ["MSHHealthProcessing"]
        ),
        .target(
            name: "MSHAppleHealthKit",
            dependencies: ["MSHHealthCore"],
            linkerSettings: [.linkedFramework("HealthKit", .when(platforms: [.iOS]))]
        ),
        .testTarget(name: "MSHHealthCoreTests", dependencies: ["MSHHealthCore"])
    ],
    cxxLanguageStandard: .cxx17
)
