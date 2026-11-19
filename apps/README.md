# apps

## Overview
User-facing client applications and wrappers in the WhatsAppya monorepo, spanning Android Trusted Web Activity, Node.js CLI, native iOS, and browser PWA targets.

## Subdirectories & Boundaries
- `android-twa`: [./android-twa/README.md](./android-twa/README.md) - Thin Android Play Store Trusted Web Activity wrapper around `apps/web` (`twa-manifest.json`; no UI code).
- `cli`: [./cli/README.md](./cli/README.md) - Power-user Node.js CLI (`@whatsappya/cli`) built on `@whatsappya/core` and `@whatsappya/platform-node`.
- `ios`: [./ios/README.md](./ios/README.md) - Native iOS 17+ SwiftUI app, Share Extension, and `WhatsAppyaKit` Swift package.
- `web`: [./web/README.md](./web/README.md) - Zero-network Vite/TypeScript browser PWA (`@whatsappya/web`) with offline service worker and Web Share Target support.
