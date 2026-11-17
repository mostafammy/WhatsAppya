/// USE CASE — orchestration only; mirrors packages/core/src/application/ConvertChat.ts.
public enum ConversionError: Error, Equatable, Sendable {
    case chatFileNotFound, unsupportedFormat, emptyChat
}

public struct ConvertChat: Sendable {
    let parsers: ParserRegistry
    let stages: [any PipelineStage]

    public init(parsers: ParserRegistry, stages: [any PipelineStage]) {
        self.parsers = parsers
        self.stages = stages
    }
}
