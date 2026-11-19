# App

## Overview
iOS application entrypoint and root navigation container for `WhatsAppya`. Wires the top-level SwiftUI `App` scene to `RootView` and embeds the chat import flow (`ImportView`).

## Interface
- `[WhatsAppyaApp.swift:WhatsAppyaApp]` — `@main` internal SwiftUI `App` struct importing `SwiftUI` and `WhatsAppyaUI`; exposes `var body: some Scene` returning `WindowGroup { RootView() }`.
- `[RootView.swift:RootView]` — Internal SwiftUI `View` struct importing `SwiftUI`; exposes `var body: some View` returning `NavigationStack { ImportView() }`.

## Invariants
- None

## Side Effects
- None

## Verification
- Run: `swift test --package-path apps/ios/Packages/WhatsAppyaKit`
