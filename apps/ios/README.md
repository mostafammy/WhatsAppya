# ios

## Overview
Native iOS 17+ SwiftUI application and Share Extension workspace generated from `project.yml` via `xcodegen generate`. Shares exported `.zip` chat archives between `ShareExtension` and `WhatsAppya` via the `group.app.whatsappya` App Group and depends on the local `WhatsAppyaKit` Swift package.

## Subdirectories & Boundaries
- `Packages`: [./Packages/README.md](./Packages/README.md) - Local Swift package dependencies (`WhatsAppyaKit` exposing `WhatsAppyaCore` and `WhatsAppyaUI`).
- `ShareExtension`: [./ShareExtension/README.md](./ShareExtension/README.md) - App extension target receiving shared WhatsApp `.zip` exports and enqueueing them into the `group.app.whatsappya` App Group inbox.
- `WhatsAppya`: [./WhatsAppya/README.md](./WhatsAppya/README.md) - Main SwiftUI application target (`App` entrypoint/root and `Features` views).
