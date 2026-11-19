# Core Source

## Overview
Public barrel entrypoint (`index.ts`) and subsystem boundaries for `@whatsappya/core` — a pure, platform-agnostic domain and WhatsApp chat parsing engine with zero runtime dependencies and no DOM or Node.js APIs.

## Interface
- `[index.ts:MessageKind]`, `[index.ts:MediaKind]`, `[index.ts:Direction]`, `[index.ts:DateOrder]`: Re-exported domain enum maps and union types from `./domain/enums.js`.
- `[index.ts:NodeTier]`, `[index.ts:HierarchyNodeBase]`, `[index.ts:ChapterNode]`, `[index.ts:SubjectNode]`, `[index.ts:BlockNode]`, `[index.ts:CurriculumRoot]`, `[index.ts:HierarchyNode]`: Re-exported 4-tier hierarchy enum and composite tree types from `./domain/hierarchy.js`.
- `[index.ts:Attachment]`, `[index.ts:RawMessage]`, `[index.ts:ChatMessage]`, `[index.ts:ChatSession]`: Re-exported immutable domain model interfaces from `./domain/models.js`.
- `[index.ts:ConversionError]`: Re-exported discriminated conversion error union type from `./domain/errors.js`.
- `[index.ts:SearchQuery]`, `[index.ts:SearchHit]`, `[index.ts:SearchIndex]`: Re-exported search contract interfaces from `./search/SearchIndex.js`.
- `[index.ts:Result]`, `[index.ts:ok]`, `[index.ts:err]`: Re-exported `Result` union type and `ok` / `err` constructors from `./shared/result.js`.
- `[index.ts:FileEntry]`, `[index.ts:FileSource]`: Re-exported file-access port interfaces from `./ports/FileSource.js`.
- `[index.ts:Logger]`, `[index.ts:silentLogger]`: Re-exported logger port interface and no-op `silentLogger` from `./ports/Logger.js`.
- `[index.ts:ChatParser]`, `[index.ts:ParserRegistry]`, `[index.ts:IosParser]`, `[index.ts:AndroidParser]`: Re-exported parser strategy interface, ordered registry, and iOS/Android parser classes from `./parsers/`.
- `[index.ts:PipelineContext]`, `[index.ts:PipelineStage]`, `[index.ts:runPipeline]`: Re-exported enrichment pipeline interfaces and sequential runner from `./pipeline/PipelineStage.js`.
- `[index.ts:ConvertChatDeps]`, `[index.ts:ConvertChatInput]`, `[index.ts:ConvertChat]`: Re-exported chat conversion use-case class and dependency/input interfaces from `./application/ConvertChat.js`.
- `./application`: [Application Use Cases](./application/README.md) — `ConvertChat` orchestration over injected ports, parsers, and pipeline stages.
- `./domain`: [Core Domain](./domain/README.md) — Domain enums, models, `HierarchyNode` tree types, and `ConversionError` union.
- `./parsers`: [Chat Parsers](./parsers/README.md) — `ChatParser` strategy interface, `ParserRegistry`, and platform parsers (`./parsers/android/README.md`, `./parsers/ios/README.md`).
- `./pipeline`: [Pipeline](./pipeline/README.md) — `PipelineStage`, `PipelineContext`, `runPipeline`, and planned stage specs (`./pipeline/stages/README.md`).
- `./ports`: [Core Ports](./ports/README.md) — `FileSource`, `Logger`, and `silentLogger`.
- `./search`: [Core Search](./search/README.md) — `SearchIndex`, `SearchQuery`, and `SearchHit` search contracts.
- `./shared`: [Shared Result Utilities](./shared/README.md) — `Result`, `ok`, and `err` helpers.

## Invariants
- None.

## Side Effects
- None.

## Verification
- Run: `pnpm test`
