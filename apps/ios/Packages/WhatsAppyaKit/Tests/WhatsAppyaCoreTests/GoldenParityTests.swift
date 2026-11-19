import Foundation
import Testing
@testable import WhatsAppyaCore

private struct MemoryFileSource: FileSource {
    let files: [String: Data]

    func list() async throws -> [String] {
        Array(files.keys).sorted()
    }

    func readData(at path: String) async throws -> Data {
        guard let data = files[path] else {
            throw NSError(domain: "MemoryFileSource", code: 404)
        }
        return data
    }

    func sizeBytes(at path: String) async throws -> Int {
        files[path]?.count ?? 0
    }
}

private var repoRoot: URL {
    // .../apps/ios/Packages/WhatsAppyaKit/Tests/WhatsAppyaCoreTests/GoldenParityTests.swift
    URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent() // WhatsAppyaCoreTests
        .deletingLastPathComponent() // Tests
        .deletingLastPathComponent() // WhatsAppyaKit
        .deletingLastPathComponent() // Packages
        .deletingLastPathComponent() // ios
        .deletingLastPathComponent() // apps
        .deletingLastPathComponent() // repo root
}

@Test func iosEn12hMatchesGoldenFixture() async throws {
    let exportURL = repoRoot.appendingPathComponent("fixtures/exports/ios-en-12h/_chat.txt")
    let goldenURL = repoRoot.appendingPathComponent("fixtures/golden/ios-en-12h.json")

    let chatData = try Data(contentsOf: exportURL)
    let source = MemoryFileSource(files: [
        "_chat.txt": chatData,
        "00000001-PHOTO-2026-11-17-09-16-05.jpg": Data("MOCK IMAGE BYTES".utf8),
    ])

    let session = try await ConvertChat().execute(
        files: source,
        chatPath: "WhatsApp Chat - Alex/_chat.txt"
    )

    let expected = try JSONDecoder().decode(ChatSession.self, from: Data(contentsOf: goldenURL))

    #expect(session.schemaVersion == expected.schemaVersion)
    #expect(session.title == expected.title)
    #expect(session.contactName == expected.contactName)
    #expect(session.ownerName == expected.ownerName)
    #expect(session.dateOrder == expected.dateOrder)
    #expect(session.senderCounts == expected.senderCounts)
    #expect(session.messages == expected.messages)
}

@Test func androidAr24hMatchesGoldenFixture() async throws {
    let exportURL = repoRoot.appendingPathComponent("fixtures/exports/android-ar-24h/_chat.txt")
    let goldenURL = repoRoot.appendingPathComponent("fixtures/golden/android-ar-24h.json")

    let chatData = try Data(contentsOf: exportURL)
    let source = MemoryFileSource(files: ["_chat.txt": chatData])

    let session = try await ConvertChat().execute(
        files: source,
        chatPath: "WhatsApp Chat - سارة/_chat.txt"
    )

    let expected = try JSONDecoder().decode(ChatSession.self, from: Data(contentsOf: goldenURL))

    #expect(session.schemaVersion == expected.schemaVersion)
    #expect(session.title == expected.title)
    #expect(session.contactName == expected.contactName)
    #expect(session.ownerName == expected.ownerName)
    #expect(session.dateOrder == expected.dateOrder)
    #expect(session.senderCounts == expected.senderCounts)
    #expect(session.messages == expected.messages)
}
