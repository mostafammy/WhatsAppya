# Core Ports

## Overview
Hexagonal architecture port interfaces (`FileSource`, `Logger`) and the default `silentLogger` implementation, keeping `@whatsappya/core` decoupled from Node.js, browser, or filesystem APIs.

## Interface
- `[FileSource.ts:FileEntry]`: Exported interface with `readonly path: string` and `readonly sizeBytes: number`.
- `[FileSource.ts:FileSource]`: Exported interface with `list(): Promise<readonly FileEntry[]>`, `readText(path: string): Promise<string>`, and `readBytes(path: string): Promise<Uint8Array>`.
- `[Logger.ts:Logger]`: Exported interface with `debug(message: string, meta?: Record<string, unknown>): void` and `warn(message: string, meta?: Record<string, unknown>): void`.
- `[Logger.ts:silentLogger]`: Exported `const` implementing `Logger` with no-op `debug` and `warn` functions.

## Invariants
- `[FileSource.ts:FileEntry]`: `path` and `sizeBytes` are declared `readonly`.
- `[FileSource.ts:FileSource]`: `list()` returns `Promise<readonly FileEntry[]>`.

## Side Effects
- None.

## Verification
- Run: `pnpm test`
