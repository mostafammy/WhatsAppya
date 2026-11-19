#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");

const rules = JSON.parse(await readFile(join(root, "contracts/parser-rules.json"), "utf8"));
const tsSource = await readFile(join(root, "packages/core/src/shared/parserRules.ts"), "utf8");
const swiftSource = await readFile(
  join(root, "apps/ios/Packages/WhatsAppyaKit/Sources/WhatsAppyaCore/Parsers/ParserRules.swift"),
  "utf8",
);

// Decode \uXXXX escapes in TS source so Unicode comparison is exact
const decodeUnicodeEscapes = (src) =>
  src.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));

const tsDecoded = decodeUnicodeEscapes(tsSource);

const failures = [];

function checkList(label, items) {
  for (const item of items) {
    if (!tsDecoded.includes(item)) {
      failures.push(`[TS drift] Missing ${label} entry: ${JSON.stringify(item)}`);
    }
    if (!swiftSource.includes(item)) {
      failures.push(`[Swift drift] Missing ${label} entry: ${JSON.stringify(item)}`);
    }
  }
}

checkList("encryptionKeywords", rules.encryptionKeywords);
checkList("deletedKeywords", rules.deletedKeywords);
checkList("callKeywords", rules.callKeywords);
checkList("omittedPhrases", rules.omittedPhrases);
checkList("selfPhrases", rules.selfPhrases);

for (const [category, exts] of Object.entries(rules.mediaExtensions)) {
  checkList(`mediaExtensions.${category}`, exts);
}

for (const [ext, mime] of Object.entries(rules.mimeTypes)) {
  if (!tsDecoded.includes(mime)) failures.push(`[TS drift] Missing mimeType ${ext} -> ${mime}`);
  if (!swiftSource.includes(mime))
    failures.push(`[Swift drift] Missing mimeType ${ext} -> ${mime}`);
}

if (failures.length > 0) {
  console.error(`Parser rules contract drift detected:\n${failures.join("\n")}`);
  process.exit(1);
}

console.log("✓ parser-rules.json verified in sync across TypeScript and Swift");
