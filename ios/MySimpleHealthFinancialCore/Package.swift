// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MySimpleHealthFinancialCore",
    platforms: [.iOS(.v17), .macOS(.v13)],
    products: [
        .library(name: "MSHFinancialCore", targets: ["MSHFinancialCore"])
    ],
    targets: [
        .target(name: "MSHFinancialCore"),
        .testTarget(name: "MSHFinancialCoreTests", dependencies: ["MSHFinancialCore"])
    ]
)
