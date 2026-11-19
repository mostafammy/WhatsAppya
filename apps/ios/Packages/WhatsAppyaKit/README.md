# WhatsAppyaKit

## Overview
Swift Package Manager manifest and source root for `WhatsAppyaKit`, exposing the Foundation-only core library (`WhatsAppyaCore`) and SwiftUI component/token library (`WhatsAppyaUI`) for `.iOS(.v17)` and `.macOS(.v14)`.

## Interface
- `[Package.swift:package]` — Swift package `"WhatsAppyaKit"` (`swift-tools-version: 5.10`).
- `[Package.swift:products]` — Library products `"WhatsAppyaCore"` (target `"WhatsAppyaCore"`) and `"WhatsAppyaUI"` (target `"WhatsAppyaUI"`).
- `[Package.swift:targets]` — Targets `"WhatsAppyaCore"`, `"WhatsAppyaUI"` (depending on `["WhatsAppyaCore"]`), and test target `"WhatsAppyaCoreTests"` (depending on `["WhatsAppyaCore"]` with copied resource `"Fixtures"`).
- [./Sources/README.md](./Sources/README.md) — Package source targets (`WhatsAppyaCore` and `WhatsAppyaUI`).

## Invariants
- `[Package.swift:platforms]` — Requires minimum `.iOS(.v17)` and `.macOS(.v14)` with `swift-tools-version: 5.10`.
- `[Package.swift:WhatsAppyaUI]` — Target `"WhatsAppyaUI"` explicitly depends on `"WhatsAppyaCore"`.
- `[Package.swift:WhatsAppyaCore]` — Pure Swift, Foundation-only target mirroring `packages/core` (TypeScript) 1:1 and verified against `fixtures/golden`.
- `[Package.swift:WhatsAppyaCoreTests]` — Copies `"Fixtures"` resources via `.copy("Fixtures")`.

## Side Effects
- None

## Verification
- Run: `swift test --package-path apps/ios/Packages/WhatsAppyaKit`
