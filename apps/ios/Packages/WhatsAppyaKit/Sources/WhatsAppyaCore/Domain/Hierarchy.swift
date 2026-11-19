import Foundation

// Mirrors contracts/archive-tree.schema.json and packages/core/src/domain/hierarchy.ts.

public enum NodeTier: String, Codable, Sendable {
    case root, block, subject, chapter
}

public protocol HierarchyNode: Identifiable, Sendable {
    var id: String { get }
    var title: String { get }
    var tier: NodeTier { get }
}

public struct ChapterNode: HierarchyNode, Codable, Sendable {
    public let id: String
    public let title: String
    public let tier: NodeTier
    public let session: ChatSession

    public init(id: String, title: String, session: ChatSession) {
        self.id = id
        self.title = title
        self.tier = .chapter
        self.session = session
    }
}

public struct SubjectNode: HierarchyNode, Codable, Sendable {
    public let id: String
    public let title: String
    public let tier: NodeTier
    public let chapters: [ChapterNode]

    public init(id: String, title: String, chapters: [ChapterNode]) {
        self.id = id
        self.title = title
        self.tier = .subject
        self.chapters = chapters
    }
}

public struct BlockNode: HierarchyNode, Codable, Sendable {
    public let id: String
    public let title: String
    public let tier: NodeTier
    public let subjects: [SubjectNode]

    public init(id: String, title: String, subjects: [SubjectNode]) {
        self.id = id
        self.title = title
        self.tier = .block
        self.subjects = subjects
    }
}

public struct CurriculumRoot: HierarchyNode, Codable, Sendable {
    public let id: String
    public let title: String
    public let tier: NodeTier
    public let blocks: [BlockNode]

    public init(id: String, title: String, blocks: [BlockNode]) {
        self.id = id
        self.title = title
        self.tier = .root
        self.blocks = blocks
    }
}

public enum ExportFormat: String, Codable, Sendable {
    case ios, android, unknown
}

public struct DateRange: Codable, Hashable, Sendable {
    public let start: String?
    public let end: String?

    public init(start: String?, end: String?) {
        self.start = start
        self.end = end
    }
}

public struct ChatSummaryNode: Codable, Identifiable, Sendable {
    public let id: String
    public let title: String
    public let contactName: String
    public let messageCount: Int
    public let path: String
    public let exportFormat: ExportFormat
    public let dateRange: DateRange?

    public init(
        id: String,
        title: String,
        contactName: String,
        messageCount: Int,
        path: String,
        exportFormat: ExportFormat,
        dateRange: DateRange? = nil
    ) {
        self.id = id
        self.title = title
        self.contactName = contactName
        self.messageCount = messageCount
        self.path = path
        self.exportFormat = exportFormat
        self.dateRange = dateRange
    }
}

public struct ArchiveFolder: Codable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let path: String
    public let children: [ArchiveFolder]
    public let chats: [ChatSummaryNode]

    public init(
        id: String,
        name: String,
        path: String,
        children: [ArchiveFolder] = [],
        chats: [ChatSummaryNode] = []
    ) {
        self.id = id
        self.name = name
        self.path = path
        self.children = children
        self.chats = chats
    }
}

public struct ArchiveTree: Codable, Sendable {
    public let schemaVersion: Int
    public let root: ArchiveFolder

    public init(schemaVersion: Int = 1, root: ArchiveFolder) {
        self.schemaVersion = schemaVersion
        self.root = root
    }
}
