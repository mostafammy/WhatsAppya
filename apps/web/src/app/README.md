# app

## Overview
Composition root and browser entrypoint for `@whatsappya/web`. Configures `ConvertChat` with `IosParser` and `AndroidParser` and mounts `ImportController` into the `#app` DOM container.

## Interface
- `[container.ts:createConvertChat]` — Exported factory function returning a `ConvertChat` instance configured with a `ParserRegistry` (registering `IosParser` then `AndroidParser` from `@whatsappya/core`) and `stages: []`.

## Invariants
- `[main.ts:root]` — `ImportController` is only instantiated and mounted when `document.querySelector<HTMLElement>("#app")` returns a non-null element.

## Side Effects
- `[main.ts:root]` — Queries the global DOM for selector `"#app"` via `document.querySelector<HTMLElement>("#app")` at module evaluation time.
- `[main.ts:ImportController]` — Instantiates `new ImportController(root)` and calls `.mount()` at module evaluation time when `#app` exists.

## Verification
- Run: `pnpm test`
