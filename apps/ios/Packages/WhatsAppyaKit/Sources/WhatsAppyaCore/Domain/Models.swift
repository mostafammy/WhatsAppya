import Foundation

// Mirrors contracts/chat-session.schema.json. Codable so golden JSON can be compared byte-for-byte with TS.

public enum MessageKind: String, Codable, Sendable {
    case message, system, call
}

public enum MediaKind: String, Codable, Sendable {
    case none, image, video, audio, pdf, document, file, sticker, omitted
}

public enum Direction: String, Codable, Sendable {
    case sent, received
}

public enum DateOrder: String, Codable, Sendable {
    case dayFirst = "day_first"
    case monthFirst = "month_first"
}

public struct Attachment: Codable, Hashable, Sendable {
    public let fileName: String
    public let kind: MediaKind
    public let mimeType: String
    public let sizeBytes: Int
    public let isOmitted: Bool
    public let isAnimated: Bool?
    public let durationSeconds: Double?
    public let waveformPeaks: [Double]?

    public init(
        fileName: String,
        kind: MediaKind,
        mimeType: String,
        sizeBytes: Int,
        isOmitted: Bool,
        isAnimated: Bool? = nil,
        durationSeconds: Double? = nil,
        waveformPeaks: [Double]? = nil
    ) {
        self.fileName = fileName
        self.kind = kind
        self.mimeType = mimeType
        self.sizeBytes = sizeBytes
        self.isOmitted = isOmitted
        self.isAnimated = isAnimated
        self.durationSeconds = durationSeconds
        self.waveformPeaks = waveformPeaks
    }
}

public struct RawMessage: Codable, Hashable, Sendable {
    public let rawDate: String
    public let rawTime: String
    public let sender: String?
    public let text: String
    public let kind: MessageKind
    public let isDeleted: Bool
    public let isEdited: Bool

    public init(
        rawDate: String,
        rawTime: String,
        sender: String?,
        text: String,
        kind: MessageKind,
        isDeleted: Bool = false,
        isEdited: Bool = false
    ) {
        self.rawDate = rawDate
        self.rawTime = rawTime
        self.sender = sender
        self.text = text
        self.kind = kind
        self.isDeleted = isDeleted
        self.isEdited = isEdited
    }
}

public struct ChatMessage: Codable, Hashable, Identifiable, Sendable {
    public let id: String
    public let rawDate: String
    public let rawTime: String
    public let timestamp: String?
    public let sender: String?
    public let text: String
    public let kind: MessageKind
    public let direction: Direction
    public let isDeleted: Bool
    public let isEdited: Bool
    public let attachment: Attachment?

    public init(
        id: String,
        rawDate: String,
        rawTime: String,
        timestamp: String? = nil,
        sender: String?,
        text: String,
        kind: MessageKind,
        direction: Direction,
        isDeleted: Bool = false,
        isEdited: Bool = false,
        attachment: Attachment? = nil
    ) {
        self.id = id
        self.rawDate = rawDate
        self.rawTime = rawTime
        self.timestamp = timestamp
        self.sender = sender
        self.text = text
        self.kind = kind
        self.direction = direction
        self.isDeleted = isDeleted
        self.isEdited = isEdited
        self.attachment = attachment
    }
}

public struct ChatSession: Codable, Sendable {
    public let schemaVersion: Int
    public let title: String
    public let contactName: String
    public let ownerName: String?
    public let dateOrder: DateOrder
    public let messages: [ChatMessage]
    public let senderCounts: [String: Int]

    public init(
        schemaVersion: Int = 1,
        title: String,
        contactName: String,
        ownerName: String?,
        dateOrder: DateOrder = .dayFirst,
        messages: [ChatMessage],
        senderCounts: [String: Int] = [:]
    ) {
        self.schemaVersion = schemaVersion
        self.title = title
        self.contactName = contactName
        self.ownerName = ownerName
        self.dateOrder = dateOrder
        self.messages = messages
        self.senderCounts = senderCounts
    }
}
