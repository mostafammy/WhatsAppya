# Import

## Overview
iOS feature view for chat import, serving as the placeholder UI for chats imported via Files, drag-and-drop, or zips handed off from the Share Extension through the App Group.

## Interface
- `[ImportView.swift:ImportView]` — `internal struct ImportView: SwiftUI.View` (no explicit `public` access modifier).
- `[ImportView.swift:ImportView.body]` — `internal var body: some View` rendering a `SwiftUI.ContentUnavailableView` instructing the user to export a chat from WhatsApp (`"Chat → Export Chat → WhatsAppya"`).

## Invariants
- None

## Side Effects
- None

## Verification
- Run: `swift test --package-path apps/ios/Packages/WhatsAppyaKit`
