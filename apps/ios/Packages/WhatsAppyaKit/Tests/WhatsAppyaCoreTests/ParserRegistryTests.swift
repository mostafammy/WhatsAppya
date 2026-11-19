import Testing
@testable import WhatsAppyaCore

private struct FakeParser: ChatParser {
    let id = "fake"
    func canHandle(_ sampleLines: [Substring]) -> Bool { sampleLines.contains { $0.hasPrefix("FAKE") } }
    func parse(_ text: String) -> [RawMessage] { [] }
}

@Test func resolvesRegisteredStrategy() {
    var registry = ParserRegistry()
    registry.register(FakeParser())
    #expect(registry.resolve(for: "FAKE line")?.id == "fake")
    #expect(registry.resolve(for: "unknown") == nil)
}
