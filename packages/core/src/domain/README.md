# Core Domain

## Overview
Platform-agnostic domain models, enums, hierarchical curriculum tree types, and typed conversion error unions for `@whatsappya/core`. This layer has zero external dependencies and mirrors the shared session contract (`contracts/chat-session.schema.json`) and Swift `WhatsAppyaCore`.

## Interface
- `[enums.ts:MessageKind]`: `as const` value map and union type (`"message" | "system" | "call"`).
- `[enums.ts:MediaKind]`: `as const` value map and union type (`"none" | "image" | "video" | "audio" | "pdf" | "document" | "file" | "sticker" | "omitted"`).
- `[enums.ts:Direction]`: `as const` value map and union type (`"sent" | "received"`).
- `[enums.ts:DateOrder]`: `as const` value map and union type (`"day_first" | "month_first" | "year_first"`).
- `[errors.ts:ConversionError]`: Exhaustive discriminated union keyed by `readonly code`: `"CHAT_FILE_NOT_FOUND"`, `"UNSUPPORTED_FORMAT"` (`sample: string`), `"EMPTY_CHAT"`, or `"IO_FAILURE"` (`cause: unknown`).
- `[hierarchy.ts:NodeTier]`: `as const` tier map and union type (`"root" | "block" | "subject" | "chapter"`).
- `[hierarchy.ts:HierarchyNodeBase]`: Base interface with `readonly id: string`, `readonly title: string`, and `readonly tier: NodeTier`.
- `[hierarchy.ts:ChapterNode]`: Leaf interface extending `HierarchyNodeBase` with `tier: typeof NodeTier.Chapter` and `readonly session: ChatSession`.
- `[hierarchy.ts:SubjectNode]`: Branch interface extending `HierarchyNodeBase` with `tier: typeof NodeTier.Subject` and `readonly chapters: readonly ChapterNode[]`.
- `[hierarchy.ts:BlockNode]`: Branch interface extending `HierarchyNodeBase` with `tier: typeof NodeTier.Block` and `readonly subjects: readonly SubjectNode[]`.
- `[hierarchy.ts:CurriculumRoot]`: Root interface extending `HierarchyNodeBase` with `tier: typeof NodeTier.Root` and `readonly blocks: readonly BlockNode[]`.
- `[hierarchy.ts:HierarchyNode]`: Discriminated union `CurriculumRoot | BlockNode | SubjectNode | ChapterNode`.
- `[models.ts:Attachment]`: Immutable attachment metadata interface (`fileName`, `kind: MediaKind`, `mimeType`, `sizeBytes`, `isOmitted`, optional `isAnimated`).
- `[models.ts:RawMessage]`: Immutable pre-enrichment message interface (`rawDate`, `rawTime`, `sender: string | null`, `text`, `kind: MessageKind`).
- `[models.ts:ChatMessage]`: Immutable enriched message interface extending `RawMessage` (`id`, `timestamp: string | null`, `direction: Direction`, `attachment: Attachment | null`, `isDeleted`, `isEdited`).
- `[models.ts:ChatSession]`: Top-level session aggregate interface (`schemaVersion: 1`, `title`, `contactName`, `ownerName: string | null`, `dateOrder: DateOrder`, `messages: readonly ChatMessage[]`, `senderCounts: Readonly<Record<string, number>>`).

## Invariants
- `[enums.ts:MessageKind]`: Constant `as const` enum maps (`MessageKind`, `MediaKind`, `Direction`, `DateOrder`) must stay synchronized with `contracts/chat-session.schema.json` and Swift `WhatsAppyaCore`.
- `[errors.ts:ConversionError]`: Errors are represented strictly as compile-time `readonly` discriminated unions keyed by `code`; no runtime error classes or throwing helpers exist in this module.
- `[hierarchy.ts:HierarchyNode]`: Compile-time four-tier tree structure is enforced via `readonly tier` discriminants: `CurriculumRoot` (`NodeTier.Root`) -> `BlockNode` (`NodeTier.Block`) -> `SubjectNode` (`NodeTier.Subject`) -> `ChapterNode` (`NodeTier.Chapter`) -> `ChatSession` leaf, with all fields and arrays marked `readonly`.
- `[models.ts:Attachment]`: Metadata-only immutable value object; raw binary bytes are never stored on `Attachment` (bytes are resolved on demand via `FileSource`).
- `[models.ts:RawMessage]`: All properties are `readonly`, and `sender` is nullable (`string | null`) for system or unattributed entries.
- `[models.ts:ChatMessage]`: Extends `RawMessage` with `readonly` properties; `timestamp` is an ISO-8601 `string | null` (`null` when the raw date is ambiguous or unparseable).
- `[models.ts:ChatSession]`: `readonly schemaVersion` is fixed to literal `1`, and all collections (`messages`, `senderCounts`) are `readonly`.

## Side Effects
- None.

## Verification
- Run: `pnpm test`
