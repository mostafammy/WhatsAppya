# Fixtures — the cross-platform source of truth

```
exports/<case>/_chat.txt (+ media)   → input, SYNTHETIC ONLY
golden/<case>.json                   → expected ChatSession (validates against contracts/)
```

Both test suites run every case:

* TypeScript: `packages/core/test/golden.test.ts`
* Swift: `WhatsAppyaCoreTests/GoldenTests.swift` (fixtures copied by `tools/scripts/sync-fixtures.sh`)

If TS and Swift disagree on a golden file, **CI fails** — this keeps two codebases behaving as one product.

> ⚠️ Never commit real conversations. Add a case per bug report, using anonymised text.
