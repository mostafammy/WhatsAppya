# WhatsAppyaCore

## Overview
Platform-independent Swift core library module for WhatsAppya, structured into clean architectural layers mirroring the TypeScript core package: domain models/hierarchy, storage ports, parsers, pipeline stages, and conversion use cases.

## Subdirectories & Boundaries
- `Application`: [./Application/README.md](./Application/README.md) - Orchestration use case (`ConvertChat`) and `ConversionError` cases.
- `Domain`: [./Domain/README.md](./Domain/README.md) - Core `Codable`/`Sendable` chat models (`ChatSession`, `ChatMessage`, `RawMessage`, `Attachment`) and multi-tier curriculum hierarchy (`CurriculumRoot`, `BlockNode`, `SubjectNode`, `ChapterNode`).
- `Parsers`: [./Parsers/README.md](./Parsers/README.md) - `ChatParser` protocol and `ParserRegistry` for format detection and raw message extraction.
- `Pipeline`: [./Pipeline/README.md](./Pipeline/README.md) - `PipelineStage` async message transformation protocol.
- `Ports`: [./Ports/README.md](./Ports/README.md) - `FileSource` async storage abstraction for listing and reading export files.
