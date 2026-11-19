# Pipeline

## Overview
Pipeline stage protocol definition for `WhatsAppyaCore`, defining asynchronous message transformation steps executed during chat conversion.

## Interface
- `[PipelineStage.swift:PipelineStage]` — `public protocol PipelineStage: Sendable` defining a stage in the chat processing pipeline.
- `[PipelineStage.swift:name]` — `var name: String { get }` identifying the stage.
- `[PipelineStage.swift:process]` — `func process(_ messages: [ChatMessage], files: any FileSource) async throws -> [ChatMessage]` transforming messages with read access to a `FileSource`.

## Invariants
- None

## Side Effects
- None

## Verification
- Run: `swift test --package-path apps/ios/Packages/WhatsAppyaKit`
