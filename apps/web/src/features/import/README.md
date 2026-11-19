# import

## Overview
Browser import controller feature for `@whatsappya/web`. Renders a `.zip` file drop-zone input, constructs a `ZipFileSource` from `@whatsappya/platform-web`, and invokes `createConvertChat().execute` while reflecting conversion state on the root element dataset.

## Interface
- `[ImportController.ts:ImportController]` — Exported class with `constructor(private readonly root: HTMLElement)`.
- `[ImportController.ts:ImportController.mount]` — Public method `mount(): void` rendering the drop-zone UI and wiring file selection.

## Invariants
- None

## Side Effects
- `[ImportController.ts:ImportController.mount]` — Replaces `this.root.innerHTML` with `<label class="drop-zone">` containing `<input type="file" accept=".zip">`, and registers a `"change"` event listener invoking `this.import(file)` when `files?.[0]` is present.
- `[ImportController.ts:ImportController.import]` — Reads the selected archive via `ZipFileSource.fromBlob(file)` (`@whatsappya/platform-web`) and executes `createConvertChat().execute({ files })` (`../../app/container.js`).
- `[ImportController.ts:ImportController.import]` — Mutates `this.root.dataset.state` to `"ready"` when `result.ok` is truthy or `result.error.code` otherwise.

## Verification
- Run: `pnpm test`
