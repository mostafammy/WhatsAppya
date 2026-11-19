import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { convertCommand } from "../src/commands/convert.js";

describe("CLI convertCommand", () => {
  let rootDir: string;
  let chatDir: string;
  let distDir: string;

  beforeEach(async () => {
    rootDir = join(tmpdir(), `wa-cli-test-${Date.now()}`);
    chatDir = join(rootDir, "WhatsApp Chat - Alice");
    distDir = join(rootDir, "dist");
    await mkdir(chatDir, { recursive: true });
    await writeFile(
      join(chatDir, "_chat.txt"),
      "[12/03/2025, 10:15:00 AM] Alice: <attached: note.opus>\n[12/03/2025, 10:16:00 AM] Bob: Got it!\n",
      "utf8",
    );
    await writeFile(join(chatDir, "note.opus"), new Uint8Array([79, 103, 103, 83]));
    await writeFile(join(chatDir, "photo.jpg"), new Uint8Array([255, 216, 255, 224]));
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it("exports self-contained standalone HTML embedding the full viewer runtime", async () => {
    const code = await convertCommand({
      input: chatDir,
      output: "single.html",
      you: "Bob",
      dist: distDir,
      standalone: true,
    });
    expect(code).toBe(0);
    const outHtml = join(distDir, "single.html");
    expect(existsSync(outHtml)).toBe(true);
    const content = await readFile(outHtml, "utf8");
    expect(content).toContain("Alice");
    expect(content).toContain("<wa-breadcrumbs></wa-breadcrumbs>");
    expect(content).toContain("<wa-message-list></wa-message-list>");
    // Full viewer custom element registration must be bundled inline (file:// safe, no type="module")
    expect(content).toContain("wa-message-list");
    expect(content).toContain("wa-voice-note");
    expect(content).not.toContain('<script type="module">');
  });

  it("exports folder bundle, copies media assets, and emits _voice_cache only with legacyVoiceCache", async () => {
    const code = await convertCommand({
      input: chatDir,
      output: "chat.html",
      you: "Bob",
      dist: distDir,
      legacyVoiceCache: true,
    });
    expect(code).toBe(0);
    expect(existsSync(join(distDir, "WhatsApp Chat - Alice/chat.html"))).toBe(true);
    expect(existsSync(join(distDir, "WhatsApp Chat - Alice/note.opus"))).toBe(true);
    expect(existsSync(join(distDir, "WhatsApp Chat - Alice/photo.jpg"))).toBe(true);
    expect(existsSync(join(distDir, "WhatsApp Chat - Alice/_voice_cache/note.opus.js"))).toBe(true);
    expect(existsSync(join(distDir, "index.html"))).toBe(true);
  });
});
