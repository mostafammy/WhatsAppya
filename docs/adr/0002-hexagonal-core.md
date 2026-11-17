# ADR-0002: Hexagonal core with zero runtime dependencies

* Status: Accepted · Date: 2026-11-17

## Decision
`packages/core` and `WhatsAppyaCore` depend only on the language standard library. All I/O goes through
ports (`FileSource`, `Logger`) implemented by platform adapters.

## Consequences
* The same core runs in a browser, a service worker, Node, and tests with in-memory fakes.
* Swapping zip libraries or storage never touches domain code.
