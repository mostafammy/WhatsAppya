#!/usr/bin/env node
import { parseArgs } from "node:util";
import { convertCommand } from "./commands/convert.js";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { output: { type: "string", short: "o" }, you: { type: "string", short: "y" } },
});

const [input] = positionals;
if (!input) {
  console.error('Usage: whatsappya <export-folder> [-o chat.html] [-y "Your Name"]');
  process.exit(64);
}
process.exit(
  await convertCommand({ input, output: values.output ?? "chat.html", you: values.you }),
);
