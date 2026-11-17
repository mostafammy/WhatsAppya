// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "WhatsAppyaKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "WhatsAppyaCore", targets: ["WhatsAppyaCore"]),
        .library(name: "WhatsAppyaUI", targets: ["WhatsAppyaUI"]),
    ],
    targets: [
        // Pure Swift, Foundation-only. Mirrors packages/core (TS) 1:1 and is verified against fixtures/golden.
        .target(name: "WhatsAppyaCore"),
        .target(name: "WhatsAppyaUI", dependencies: ["WhatsAppyaCore"]),
        .testTarget(
            name: "WhatsAppyaCoreTests",
            dependencies: ["WhatsAppyaCore"],
            resources: [.copy("Fixtures")]
        ),
    ]
)
