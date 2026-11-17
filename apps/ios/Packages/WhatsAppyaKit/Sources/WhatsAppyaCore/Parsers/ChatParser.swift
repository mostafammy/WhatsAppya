/// STRATEGY — one conformance per export dialect.
public protocol ChatParser: Sendable {
    var id: String { get }
    func canHandle(_ sampleLines: [Substring]) -> Bool
    func parse(_ text: String) -> [RawMessage]
}

/// REGISTRY — Open/Closed: add dialects by registering, not by editing.
public struct ParserRegistry: Sendable {
    private var parsers: [any ChatParser] = []
    public init() {}

    public mutating func register(_ parser: some ChatParser) { parsers.append(parser) }

    public func resolve(for text: String) -> (any ChatParser)? {
        let sample = text.split(whereSeparator: \.isNewline).prefix(50).map { $0 }
        return parsers.first { $0.canHandle(sample) }
    }
}
