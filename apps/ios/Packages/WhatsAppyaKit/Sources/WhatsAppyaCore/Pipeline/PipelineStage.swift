/// PIPELINE stage — single responsibility per stage (media, edits, direction, timestamps).
public protocol PipelineStage: Sendable {
    var name: String { get }
    func process(_ messages: [ChatMessage], files: any FileSource) async throws -> [ChatMessage]
}
