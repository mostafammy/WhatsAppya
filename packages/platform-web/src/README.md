# Platform Web Source

## Overview
Root source entrypoint for `@whatsappya/platform-web`, exporting browser adapters for `@whatsappya/core` ports alongside planned Web Share Target and OPFS storage modules.

## Interface
- `[index.ts:ZipFileSource]`: Re-exports `ZipFileSource` from `./zip/ZipFileSource.js`.
- `./zip`: [Web Zip FileSource](./zip/README.md) — `ZipFileSource` implementation of `FileSource` decoding `.zip` `Blob` archives via `fflate`.
- `./share-target`: [Web Share Target](./share-target/README.md) — Planned Android service-worker receiver (`ShareTargetReceiver.ts`) handing shared `multipart/form-data` zip `Blob`s to `ZipFileSource.fromBlob`.
- `./storage`: [Storage Adapters](./storage/README.md) — Planned Origin Private File System adapter (`OpfsArchiveStore.ts`) for persisting imported chats locally.

## Invariants
- None.

## Side Effects
- None.

## Verification
- Run: `pnpm test`
