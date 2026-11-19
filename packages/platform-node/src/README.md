# Platform Node Source

## Overview
Root source entrypoint for `@whatsappya/platform-node`, exporting Node.js adapters for `@whatsappya/core` ports used by CLI and test tooling.

## Interface
- `[index.ts:DirectoryFileSource]`: Re-exports `DirectoryFileSource` from `./fs/DirectoryFileSource.js`.
- `./fs`: [Node Filesystem FileSource](./fs/README.md) — `DirectoryFileSource` implementation of `FileSource` over `node:fs/promises`.

## Invariants
- None.

## Side Effects
- None.

## Verification
- Run: `pnpm test`
