# Domain

## Overview
Core domain models and multi-tier curriculum hierarchy types for `WhatsAppyaCore`. `Models.swift` defines `Codable`, `Sendable` chat data models mirroring `contracts/chat-session.schema.json` for byte-for-byte JSON parity with TypeScript; `Hierarchy.swift` defines the `CurriculumRoot` > `BlockNode` > `SubjectNode` > `ChapterNode` > `ChatSession` tree structure.

## Interface
- `[Hierarchy.swift:NodeTier]` — `public enum NodeTier: String, Codable, Sendable` (`root`, `block`, `subject`, `chapter`).
- `[Hierarchy.swift:HierarchyNode]` — `public protocol HierarchyNode: Identifiable, Sendable` requiring `id: String`, `title: String`, and `tier: NodeTier`.
- `[Hierarchy.swift:ChapterNode]` — `public struct ChapterNode: HierarchyNode, Codable, Sendable` (`id`, `title`, `tier`, `session: ChatSession`; `public init(id:title:session:)`).
- `[Hierarchy.swift:SubjectNode]` — `public struct SubjectNode: HierarchyNode, Codable, Sendable` (`id`, `title`, `tier`, `chapters: [ChapterNode]`; `public init(id:title:chapters:)`).
- `[Hierarchy.swift:BlockNode]` — `public struct BlockNode: HierarchyNode, Codable, Sendable` (`id`, `title`, `tier`, `subjects: [SubjectNode]`; `public init(id:title:subjects:)`).
- `[Hierarchy.swift:CurriculumRoot]` — `public struct CurriculumRoot: HierarchyNode, Codable, Sendable` (`id`, `title`, `tier`, `blocks: [BlockNode]`; `public init(id:title:blocks:)`).
- `[Models.swift:MessageKind]` — `public enum MessageKind: String, Codable, Sendable` (`message`, `system`, `call`).
- `[Models.swift:MediaKind]` — `public enum MediaKind: String, Codable, Sendable` (`none`, `image`, `video`, `audio`, `pdf`, `document`, `file`, `sticker`, `omitted`).
- `[Models.swift:Direction]` — `public enum Direction: String, Codable, Sendable` (`sent`, `received`).
- `[Models.swift:Attachment]` — `public struct Attachment: Codable, Hashable, Sendable` (`fileName: String`, `kind: MediaKind`, `mimeType: String`, `sizeBytes: Int`, `isOmitted: Bool`).
- `[Models.swift:RawMessage]` — `public struct RawMessage: Codable, Hashable, Sendable` (`rawDate: String`, `rawTime: String`, `sender: String?`, `text: String`, `kind: MessageKind`).
- `[Models.swift:ChatMessage]` — `public struct ChatMessage: Codable, Hashable, Identifiable, Sendable` (`let id: String`, `let raw: RawMessage`, `var timestamp: Date?`, `var direction: Direction`, `var attachment: Attachment?`, `var isDeleted: Bool`, `var isEdited: Bool`).
- `[Models.swift:ChatSession]` — `public struct ChatSession: Codable, Sendable` (`schemaVersion: Int`, `title: String`, `contactName: String`, `ownerName: String?`, `messages: [ChatMessage]`).

## Invariants
- `[Hierarchy.swift:ChapterNode.init]`, `[Hierarchy.swift:SubjectNode.init]`, `[Hierarchy.swift:BlockNode.init]`, `[Hierarchy.swift:CurriculumRoot.init]`: Programmatic construction sets immutable `tier` to `.chapter`, `.subject`, `.block`, and `.root` respectively (synthesized `Codable` `init(from:)` does not validate or override `tier` on decode).
- `[Hierarchy.swift:CurriculumRoot]`: Static type definitions constrain hierarchy nesting to `CurriculumRoot` -> `BlockNode` -> `SubjectNode` -> `ChapterNode` -> `ChatSession`, with all stored properties declared `let`.
- `[Models.swift:ChatMessage]`: `id` and `raw` are immutable (`let`), while `timestamp`, `direction`, `attachment`, `isDeleted`, and `isEdited` are mutable (`var`); `Attachment`, `RawMessage`, and `ChatSession` declare all stored properties as `let`.

## Side Effects
- None

## Verification
- Run: `swift test --package-path apps/ios/Packages/WhatsAppyaKit`
