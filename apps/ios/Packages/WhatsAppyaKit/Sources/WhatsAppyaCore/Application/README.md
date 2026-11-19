# Application

## Overview
Use-case orchestration layer for `WhatsAppyaCore` (mirrors `packages/core/src/application/ConvertChat.ts`). Defines conversion error cases and the `ConvertChat` use-case container holding a parser registry and pipeline stages.

## Interface
- `[ConvertChat.swift:ConversionError]` — `public enum ConversionError: Error, Equatable, Sendable` with cases `chatFileNotFound`, `unsupportedFormat`, `emptyChat`.
- `[ConvertChat.swift:ConvertChat]` — `public struct ConvertChat: Sendable` storing internal `parsers: ParserRegistry` and `stages: [any PipelineStage]`.
- `[ConvertChat.swift:ConvertChat.init]` — `public init(parsers: ParserRegistry, stages: [any PipelineStage])`.

## Invariants
- None

## Side Effects
- None

## Verification
- Run: `swift test --package-path apps/ios/Packages/WhatsAppyaKit`
