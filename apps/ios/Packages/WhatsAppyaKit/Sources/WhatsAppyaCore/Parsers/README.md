# Parsers

## Overview
Parser abstraction and registry for `WhatsAppyaCore`. Defines the `ChatParser` protocol for format detection and parsing into `RawMessage` values, plus `ParserRegistry` for ordered parser registration and resolution.

## Interface
- `[ChatParser.swift:ChatParser]` — `public protocol ChatParser: Sendable` with `var id: String { get }`, `func canHandle(_ sampleLines: [Substring]) -> Bool`, and `func parse(_ text: String) -> [RawMessage]`.
- `[ChatParser.swift:ParserRegistry]` — `public struct ParserRegistry: Sendable` managing registered `ChatParser` instances.
- `[ChatParser.swift:ParserRegistry.init]` — `public init()` creating an empty parser registry.
- `[ChatParser.swift:ParserRegistry.register]` — `public mutating func register(_ parser: some ChatParser)` registering a parser instance.
- `[ChatParser.swift:ParserRegistry.resolve]` — `public func resolve(for text: String) -> (any ChatParser)?` resolving the matching parser for input text.

## Invariants
- `[ChatParser.swift:ChatParser]` — Requires `Sendable` conformance for all parser implementations.
- `[ChatParser.swift:ParserRegistry]` — Stores registered parsers in a private ordered array and conforms to `Sendable`.
- `[ChatParser.swift:ParserRegistry.resolve]` — Splits input text on newlines (omitting empty subsequences), inspects up to `prefix(50)` sample lines, and returns the first registered parser whose `canHandle(_:)` returns `true`.

## Side Effects
- `[ChatParser.swift:ParserRegistry.register]` — Mutates the `ParserRegistry` instance by appending the supplied parser to its internal parsers array.

## Verification
- Run: `swift test --package-path apps/ios/Packages/WhatsAppyaKit`
