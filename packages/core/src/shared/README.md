# Shared Result Utilities

## Overview
Zero-dependency typed `Result<T, E>` discriminated union and constructors (`ok`, `err`) shared across `@whatsappya/core` to model recoverable outcomes without throwing exceptions.

## Interface
- `[result.ts:Result]`: `export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }`.
- `[result.ts:ok]`: `export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })`.
- `[result.ts:err]`: `export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })`.

## Invariants
- None.

## Side Effects
- None.

## Verification
- Run: `pnpm test`
