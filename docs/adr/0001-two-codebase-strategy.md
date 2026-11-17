# ADR-0001: TypeScript for web/Android, Swift for Apple platforms

* Status: Accepted · Date: 2026-11-17

## Context
A Python CLI blocks non-technical users. iOS web apps can't receive files from the system share sheet;
Android PWAs/TWAs can (Web Share Target).

## Decision
* One TypeScript codebase → desktop web, Android (PWA + TWA), CLI.
* One Swift codebase → iOS/iPadOS/macOS, with a Share Extension.
* No backend. All processing stays on the device.

## Consequences
* Two parser implementations → mitigated by `contracts/` + shared `fixtures/golden` parity tests in CI.
* The Python prototype is frozen and later archived.
