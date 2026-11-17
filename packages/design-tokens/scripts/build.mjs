// Minimal generator: tokens/*.json → dist/tokens.css + dist/Tokens.swift
// (Swap for Style Dictionary when the token set grows.)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const color = JSON.parse(readFileSync(new URL("../tokens/color.json", import.meta.url)));
const flat = (obj, prefix = []) =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !("light" in v)
      ? flat(v, [...prefix, k])
      : [[[...prefix, k].join("-"), v]],
  );
const entries = flat(color);

mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
const css = (mode) => entries.map(([k, v]) => `  --wa-${k}: ${v[mode]};`).join("\n");
writeFileSync(
  new URL("../dist/tokens.css", import.meta.url),
  `:root {\n${css("light")}\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n${css("dark")}\n  }\n}\n`,
);
const camel = (s) => s.replace(/-(\w)/g, (_, c) => c.toUpperCase());
writeFileSync(
  new URL("../dist/Tokens.swift", import.meta.url),
  `// GENERATED — do not edit.\nimport SwiftUI\n\npublic enum WATokens {\n${entries
    .map(([k, v]) => `    public static let ${camel(k)} = (light: "${v.light}", dark: "${v.dark}")`)
    .join("\n")}\n}\n`,
);
console.log(`design-tokens: wrote ${entries.length} colour tokens`);
