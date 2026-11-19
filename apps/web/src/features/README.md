# features

## Overview
Feature modules for `@whatsappya/web`, isolating `.zip` import handling, message list viewing, and shareable "Chat Wrapped" statistics.

## Subdirectories & Boundaries
- `import`: [./import/README.md](./import/README.md) - `ImportController` drop-zone UI and conversion execution via `ZipFileSource` and `createConvertChat`.
- `stats`: [./stats/README.md](./stats/README.md) - "Chat Wrapped" shareable stats card (top senders, emojis, streaks, busiest hour).
- `viewer`: [./viewer/README.md](./viewer/README.md) - Mounts `<wa-message-list>` from `@whatsappya/viewer`.
