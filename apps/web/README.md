# web

## Overview
Browser PWA application (`@whatsappya/web`) built with Vite and TypeScript. Hosts the zero-network client-side WhatsApp export viewer, offline service worker, and Web Share Target entrypoint, and serves as the origin wrapped by `apps/android-twa`.

## Interface
- `[package.json:name]` — Private ES module package `@whatsappya/web` (`scripts`: `dev`, `build`, `preview`, `typecheck`, `test`; workspace deps: `@whatsappya/core`, `@whatsappya/exporter`, `@whatsappya/platform-web`, `@whatsappya/viewer`).
- `[vite.config.ts:default]` — Default Vite configuration via `defineConfig` setting `build.target: "es2022"` and `build.sourcemap: true`.
- `[index.html:main#app]` — Root mount container `<main id="app"></main>`.
- `[index.html:script]` — Module script entrypoint loading `/src/app/main.ts`.
- `[index.html:link[rel="manifest"]]` — Web app manifest link pointing to `/manifest.webmanifest`.
- `[tsconfig.json:compilerOptions]` — TypeScript config extending `../../tsconfig.base.json` with `noEmit: true`, `lib: ["ES2022", "DOM", "DOM.Iterable", "WebWorker"]`, `types: ["vite/client"]`, and `include: ["src"]`.
- [./src/README.md](./src/README.md) — Application source tree (`app`, `features`, and `sw`).

## Invariants
- `[index.html:meta[http-equiv="Content-Security-Policy"]]` — Enforces strict CSP `default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob: data:; connect-src 'none'` (disallowing outbound network connections).
- `[index.html:meta[name="viewport"]]` — Configures viewport `width=device-width, initial-scale=1.0, viewport-fit=cover`.
- `[vite.config.ts:build.target]` — Compiles bundle targeting `es2022` with sourcemaps enabled (`[vite.config.ts:build.sourcemap]`).
- `[tsconfig.json:compilerOptions.noEmit]` — Type-checks only `src` (`[tsconfig.json:include]`) without emitting JS output.
- `[package.json:private]` — Package is private (`private: true`) and uses ES modules (`[package.json:type]`: `"module"`).

## Side Effects
- `[index.html:script]` — Fetches and executes `/src/app/main.ts` as an ES module on page load.
- `[index.html:link[rel="manifest"]]` — Triggers browser fetch for `/manifest.webmanifest` on document load.

## Verification
- Run: `pnpm test`
