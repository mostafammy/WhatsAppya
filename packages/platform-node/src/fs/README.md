# Node Filesystem FileSource

## Overview
Node.js filesystem adapter (`DirectoryFileSource`) implementing the `@whatsappya/core` `FileSource` port over a local directory tree.

## Interface
- `[DirectoryFileSource.ts:DirectoryFileSource]`: Exported class implementing `FileSource`.
- `[DirectoryFileSource.ts:DirectoryFileSource.constructor]`: `constructor(root: string)`.
- `[DirectoryFileSource.ts:DirectoryFileSource.list]`: `list(): Promise<readonly FileEntry[]>`.
- `[DirectoryFileSource.ts:DirectoryFileSource.readText]`: `readText(path: string): Promise<string>`.
- `[DirectoryFileSource.ts:DirectoryFileSource.readBytes]`: `readBytes(path: string): Promise<Uint8Array>`.

## Invariants
- `[DirectoryFileSource.ts:DirectoryFileSource.constructor]`: Stores `root` as `private readonly`.
- `[DirectoryFileSource.ts:DirectoryFileSource.list]`: Filters recursive `readdir` entries with `stat(...).isFile()` and returns `readonly FileEntry[]` with `relative(this.root, join(this.root, name))` paths and `sizeBytes: s.size`.
- `[DirectoryFileSource.ts:DirectoryFileSource.readText]`: Resolves target via `join(this.root, path)` and reads with `"utf8"` encoding (no explicit path-traversal validation).
- `[DirectoryFileSource.ts:DirectoryFileSource.readBytes]`: Resolves target via `join(this.root, path)` and returns a `Uint8Array` wrapping the read `Buffer` (no explicit path-traversal validation).

## Side Effects
- `[DirectoryFileSource.ts:DirectoryFileSource.list]`: Performs read-only filesystem I/O via `node:fs/promises` `readdir(this.root, { recursive: true })` and `stat(join(this.root, name))`.
- `[DirectoryFileSource.ts:DirectoryFileSource.readText]`: Performs read-only filesystem I/O via `node:fs/promises` `readFile(join(this.root, path), "utf8")`.
- `[DirectoryFileSource.ts:DirectoryFileSource.readBytes]`: Performs read-only filesystem I/O via `node:fs/promises` `readFile(join(this.root, path))`.

## Verification
- Run: `pnpm test`
