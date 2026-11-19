# ShareExtension

## Overview
iOS Share Extension target receiving exported WhatsApp `.zip` archives from the system share sheet and enqueueing them into the shared App Group inbox for the main `WhatsAppya` app.

## Interface
- `[ShareViewController.swift:ShareViewController]` — `internal final class ShareViewController: UIViewController` overriding `viewDidLoad()` to extract `UTType.zip` attachments and hand them off via `InboxStore`.
- `[ShareViewController.swift:InboxStore]` — `internal struct InboxStore` exposing `static let shared` and `func enqueue(_ source: URL) throws`.

## Invariants
- `[ShareViewController.swift:ShareViewController]` — Inspects only `extensionContext?.inputItems.first as? NSExtensionItem` and its first attachment conforming to `UTType.zip.identifier`; calls `complete()` immediately otherwise.
- `[ShareViewController.swift:ShareViewController.viewDidLoad]` — Ignores `loadFileRepresentation` errors and swallows `InboxStore.shared.enqueue(url)` errors with `try?`, always calling `self?.complete()` afterward.
- `[ShareViewController.swift:InboxStore.groupID]` — Hardcodes App Group identifier `"group.app.whatsappya"` and `"Inbox"` subdirectory; returns early without throwing or copying if `FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:)` returns `nil`.
- `[ShareViewController.swift:InboxStore.enqueue]` — Stores each copied archive under a new `UUID().uuidString + ".zip"` filename rather than preserving the original filename.

## Side Effects
- `[ShareViewController.swift:ShareViewController.viewDidLoad]` — Requests a temporary file representation for `UTType.zip.identifier` via `NSItemProvider.loadFileRepresentation(forTypeIdentifier:completionHandler:)`.
- `[ShareViewController.swift:InboxStore.enqueue]` — Creates the `"Inbox"` directory (`withIntermediateDirectories: true`) in the `"group.app.whatsappya"` App Group container via `FileManager.default.createDirectory` and copies the archive to `<UUID>.zip` via `FileManager.default.copyItem`.
- `[ShareViewController.swift:ShareViewController.complete]` — Terminates the share extension session via `extensionContext?.completeRequest(returningItems: nil)`.

## Verification
- Run: `swift test --package-path apps/ios/Packages/WhatsAppyaKit`
