# Web Zip FileSource

## Overview
Browser `.zip` archive adapter (`ZipFileSource`) implementing the `@whatsappya/core` `FileSource` port using `fflate` decompression over an in-memory `Blob`.

## Interface
- `[ZipFileSource.ts:ZipFileSource]`: Exported class implementing `FileSource` from `@whatsappya/core`.
- `[ZipFileSource.ts:ZipFileSource.fromBlob]`: `static async fromBlob(blob: Blob): Promise<ZipFileSource>`.
- `[ZipFileSource.ts:ZipFileSource.list]`: `async list(): Promise<readonly FileEntry[]>`.
- `[ZipFileSource.ts:ZipFileSource.readText]`: `async readText(path: string): Promise<string>`.
- `[ZipFileSource.ts:ZipFileSource.readBytes]`: `async readBytes(path: string): Promise<Uint8Array>`.

## Invariants
- `[ZipFileSource.ts:ZipFileSource]`: Constructor is `private`, restricting instantiation to `ZipFileSource.fromBlob`.
- `[ZipFileSource.ts:ZipFileSource.#entries]`: `#entries` is a `readonly` private `Record<string, Uint8Array>` populated once during `fromBlob`.
- `[ZipFileSource.ts:ZipFileSource.readBytes]`: Throws `Error("Missing entry: <path>")` when `#entries[path]` is missing.
- `[ZipFileSource.ts:ZipFileSource.readText]`: Decodes entry bytes using `TextDecoder("utf-8")`.

## Side Effects
- None.

## Verification
- Run: `pnpm test`
