#!/usr/bin/env node
import { parseArgs } from "node:util";
import { convertCommand } from "./commands/convert.js";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    output: { type: "string", short: "o" },
    you: { type: "string", short: "y" },
    dist: { type: "string", short: "d" },
    standalone: { type: "boolean", default: false },
    "legacy-voice-cache": { type: "boolean", default: false },
  },
});

const [input] = positionals;
if (!input) {
  console.error(
    'Usage: whatsappya <export-folder> [-o chat.html] [-y "Your Name"] [--dist out/] [--standalone] [--legacy-voice-cache]',
  );
  process.exit(64);
}

process.exit(
  await convertCommand({
    input,
    output: values.output ?? "chat.html",
    you: values.you,
    dist: values.dist,
    standalone: values.standalone,
    legacyVoiceCache: values["legacy-voice-cache"],
  }),
);
