import Foundation
import WhatsAppyaCore

private struct MemoryFileSource: FileSource {
    let files: [String: Data]
    func list() async throws -> [String] { Array(files.keys).sorted() }
    func readData(at path: String) async throws -> Data {
        guard let data = files[path] else { throw NSError(domain: "MemoryFileSource", code: 404) }
        return data
    }
    func sizeBytes(at path: String) async throws -> Int { files[path]?.count ?? 0 }
}

private func assertEqual<T: Equatable>(_ actual: T, _ expected: T, _ label: String) throws {
    if actual != expected {
        throw NSError(
            domain: "WhatsAppyaGoldenVerifier",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Mismatch in \(label):\n  actual:   \(actual)\n  expected: \(expected)"]
        )
    }
}

@main
struct WhatsAppyaGoldenVerifier {
    static func main() async throws {
        // .../apps/ios/Packages/WhatsAppyaKit/Sources/WhatsAppyaGoldenVerifier/main.swift
        let repoRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // WhatsAppyaGoldenVerifier
            .deletingLastPathComponent() // Sources
            .deletingLastPathComponent() // WhatsAppyaKit
            .deletingLastPathComponent() // Packages
            .deletingLastPathComponent() // ios
            .deletingLastPathComponent() // apps
            .deletingLastPathComponent() // repo root

        // 1. iOS en-12h golden fixture
        let iosExport = try Data(contentsOf: repoRoot.appendingPathComponent("fixtures/exports/ios-en-12h/_chat.txt"))
        let iosGolden = try JSONDecoder().decode(
            ChatSession.self,
            from: Data(contentsOf: repoRoot.appendingPathComponent("fixtures/golden/ios-en-12h.json"))
        )
        let iosActual = try await ConvertChat().execute(
            files: MemoryFileSource(files: [
                "_chat.txt": iosExport,
                "00000001-PHOTO-2026-11-17-09-16-05.jpg": Data("MOCK IMAGE BYTES".utf8),
            ]),
            chatPath: "WhatsApp Chat - Alex/_chat.txt"
        )
        try assertEqual(iosActual.schemaVersion, iosGolden.schemaVersion, "ios.schemaVersion")
        try assertEqual(iosActual.title, iosGolden.title, "ios.title")
        try assertEqual(iosActual.contactName, iosGolden.contactName, "ios.contactName")
        try assertEqual(iosActual.ownerName, iosGolden.ownerName, "ios.ownerName")
        try assertEqual(iosActual.dateOrder, iosGolden.dateOrder, "ios.dateOrder")
        try assertEqual(iosActual.senderCounts, iosGolden.senderCounts, "ios.senderCounts")
        try assertEqual(iosActual.messages, iosGolden.messages, "ios.messages")
        print("✓ Swift parity passed: ios-en-12h (\(iosActual.messages.count) messages)")

        // 2. Android ar-24h golden fixture
        let androidExport = try Data(contentsOf: repoRoot.appendingPathComponent("fixtures/exports/android-ar-24h/_chat.txt"))
        let androidGolden = try JSONDecoder().decode(
            ChatSession.self,
            from: Data(contentsOf: repoRoot.appendingPathComponent("fixtures/golden/android-ar-24h.json"))
        )
        let androidActual = try await ConvertChat().execute(
            files: MemoryFileSource(files: ["_chat.txt": androidExport]),
            chatPath: "WhatsApp Chat - سارة/_chat.txt"
        )
        try assertEqual(androidActual.schemaVersion, androidGolden.schemaVersion, "android.schemaVersion")
        try assertEqual(androidActual.title, androidGolden.title, "android.title")
        try assertEqual(androidActual.contactName, androidGolden.contactName, "android.contactName")
        try assertEqual(androidActual.ownerName, androidGolden.ownerName, "android.ownerName")
        try assertEqual(androidActual.dateOrder, androidGolden.dateOrder, "android.dateOrder")
        try assertEqual(androidActual.senderCounts, androidGolden.senderCounts, "android.senderCounts")
        try assertEqual(androidActual.messages, androidGolden.messages, "android.messages")
        print("✓ Swift parity passed: android-ar-24h (\(androidActual.messages.count) messages)")

        // 3. ZipFileSource end-to-end test (DEFLATE + STORE via macOS /usr/bin/zip)
        let tmpDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("wa-swift-zip-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: tmpDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tmpDir) }

        let chatDir = tmpDir.appendingPathComponent("WhatsApp Chat - Alex", isDirectory: true)
        try FileManager.default.createDirectory(at: chatDir, withIntermediateDirectories: true)
        try iosExport.write(to: chatDir.appendingPathComponent("_chat.txt"))
        try Data("MOCK IMAGE BYTES".utf8).write(
            to: chatDir.appendingPathComponent("00000001-PHOTO-2026-11-17-09-16-05.jpg")
        )

        let zipURL = tmpDir.appendingPathComponent("export.zip")
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/usr/bin/zip")
        proc.currentDirectoryURL = tmpDir
        proc.arguments = ["-r", "-q", zipURL.path, "WhatsApp Chat - Alex"]
        try proc.run()
        proc.waitUntilExit()
        try assertEqual(proc.terminationStatus, 0, "zip exit status")

        let zipSource = try ZipFileSource(fileURL: zipURL)
        let zipSession = try await ConvertChat().execute(files: zipSource)
        try assertEqual(zipSession.contactName, iosGolden.contactName, "zip.contactName")
        try assertEqual(zipSession.messages, iosGolden.messages, "zip.messages")
        print("✓ Swift ZipFileSource passed: \(zipSession.messages.count) messages read directly from ZIP")
    }
}
