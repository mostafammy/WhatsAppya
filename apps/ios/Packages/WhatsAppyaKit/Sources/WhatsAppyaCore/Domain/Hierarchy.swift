import Foundation

// Mirrors packages/core/src/domain/hierarchy.ts for Multi-Tier Curricular Mode (Blocks › Subjects › Chapters).

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
