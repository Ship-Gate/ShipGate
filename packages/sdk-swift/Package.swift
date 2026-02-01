// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "ISLClient",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
        .watchOS(.v8),
        .tvOS(.v15)
    ],
    products: [
        .library(name: "ISLClient", targets: ["ISLClient"]),
    ],
    dependencies: [],
    targets: [
        .target(
            name: "ISLClient",
            dependencies: [],
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency")
            ]
        ),
        .testTarget(
            name: "ISLClientTests",
            dependencies: ["ISLClient"]
        ),
    ]
)
