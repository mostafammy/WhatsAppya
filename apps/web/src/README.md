# src

## Overview
Browser application source code for `@whatsappya/web`, organized into the composition root (`app`), feature controllers (`features`), and offline/Share-Target service worker (`sw`).

## Subdirectories & Boundaries
- `app`: [./app/README.md](./app/README.md) - Composition root (`createConvertChat`) and DOM entrypoint (`main.ts`) mounting `ImportController` on `#app`.
- `features`: [./features/README.md](./features/README.md) - Feature modules (`import`, `stats`, `viewer`).
- `sw`: [./sw/README.md](./sw/README.md) - Offline app-shell caching and `POST /share-target` handler (`service-worker.ts`).
