import Foundation

// Mirrors contracts/chat-session.schema.json. Codable so golden JSON can be compared byte-for-byte with TS.

public enum MessageKind: String, Codable, Sendable { case message, system, call }
public enum MediaKind: String, Codable, Sendable { case none, image, video, audio, pdf, document, file, sticker, omitted }
public enum Direction: String, Codable, Sendable { case sent, received }

public struct Attachment: Codable, Hashable, Sendable {
    public let fileName: String
    public let kind: MediaKind
    public let mimeType: String
    public let sizeBytes: Int
    public let isOmitted: Bool
}

public struct RawMessage: Codable, Hashable, Sendable {
    public let rawDate: String
    public let rawTime: String
    public let sender: String?
    public let text: String
    public let kind: MessageKind
}

public struct ChatMessage: Codable, Hashable, Identifiable, Sendable {
    public let id: String
    public let raw: RawMessage
    public var timestamp: Date?
    public var direction: Direction
    public var attachment: Attachment?
    public var isDeleted: Bool
    public var isEdited: Bool
}

public struct ChatSession: Codable, Sendable {
    public let schemaVersion: Int
    public let title: String
    public let contactName: String
    public let ownerName: String?
    public let messages: [ChatMessage]
}
