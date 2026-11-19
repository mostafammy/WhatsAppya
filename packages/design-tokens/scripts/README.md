# Design Tokens Build Script

## Overview
Build script for `@whatsappya/design-tokens` that flattens colour token JSON definitions into CSS custom properties (`tokens.css`) and Swift constants (`Tokens.swift`).

## Interface
- `[build.mjs:module]`: Executable ESM build script with no JavaScript exports; runs top-level generation on evaluation.
- `[build.mjs:writeFileSync]`: Emits `../dist/tokens.css` defining CSS custom properties `--wa-<k>` (`--wa-bubble-sent`, `--wa-bubble-received`, `--wa-accent`) on `:root` for light mode and `@media (prefers-color-scheme: dark)` for dark mode.
- `[build.mjs:writeFileSync]`: Emits `../dist/Tokens.swift` defining `public enum WATokens` with `public static let <camel(k)> = (light: "...", dark: "...")` (`bubbleSent`, `bubbleReceived`, `accent`).

## Invariants
- `[build.mjs:color]`: Reads only `../tokens/color.json` relative to `import.meta.url`; `../tokens/motion.json` is not read or emitted.
- `[build.mjs:flat]`: Leaf color tokens are identified when an object contains a `"light"` key (`!(v && typeof v === "object" && !("light" in v))`), with nested keys joined by `"-"`.
- `[build.mjs:css]`: Assumes every leaf token object returned by `flat(color)` defines both `light` and `dark` string properties (`v[mode]` and `v.light` / `v.dark`), with no explicit validation or fallback.
- `[build.mjs:camel]`: Transforms hyphen-delimited token keys to camelCase via `s.replace(/-(\w)/g, (_, c) => c.toUpperCase())` for Swift `WATokens` property identifiers.

## Side Effects
- `[build.mjs:color]`: Synchronously reads `../tokens/color.json` via `readFileSync` at module evaluation.
- `[build.mjs:mkdirSync]`: Synchronously creates `../dist/` with `{ recursive: true }`.
- `[build.mjs:writeFileSync]`: Synchronously writes/overwrites `../dist/tokens.css` and `../dist/Tokens.swift`.
- `[build.mjs:console.log]`: Writes `design-tokens: wrote ${entries.length} colour tokens` to stdout.

## Verification
- Run: `pnpm --filter @whatsappya/design-tokens build`
