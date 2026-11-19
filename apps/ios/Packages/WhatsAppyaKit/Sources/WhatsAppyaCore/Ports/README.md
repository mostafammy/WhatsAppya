# Ports

## Overview
Storage port abstractions for `WhatsAppyaCore`, decoupling core parsing and pipeline logic from concrete file/archive providers.

## Interface
- `[FileSource.swift:FileSource]` — `public protocol FileSource: Sendable` abstracting asynchronous file enumeration and reading.
- `[FileSource.swift:FileSource.list()]` — `func list() async throws -> [String]` returning available file paths.
- `[FileSource.swift:FileSource.readData(at:)]` — `func readData(at path: String) async throws -> Data` loading raw `Data` for a given file path.

## Invariants
- None

## Side Effects
- None

## Verification
- Run: `swift test --package-path apps/ios/Packages/WhatsAppyaKit`
