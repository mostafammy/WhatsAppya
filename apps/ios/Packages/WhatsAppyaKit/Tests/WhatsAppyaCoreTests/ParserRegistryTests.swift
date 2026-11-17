import XCTest
@testable import WhatsAppyaCore

private struct FakeParser: ChatParser {
    let id = "fake"
    func canHandle(_ sampleLines: [Substring]) -> Bool { sampleLines.contains { $0.hasPrefix("FAKE") } }
    func parse(_ text: String) -> [RawMessage] { [] }
}

final class ParserRegistryTests: XCTestCase {
    func testResolvesRegisteredStrategy() {
        var registry = ParserRegistry()
        registry.register(FakeParser())
        XCTAssertEqual(registry.resolve(for: "FAKE line")?.id, "fake")
        XCTAssertNil(registry.resolve(for: "unknown"))
    }
}
