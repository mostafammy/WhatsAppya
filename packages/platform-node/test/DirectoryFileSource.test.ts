import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DirectoryFileSource } from "../src/fs/DirectoryFileSource.js";

describe("DirectoryFileSource", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `whatsappya-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, "_chat.txt"), "hello chat", "utf8");
    await mkdir(join(testDir, "media"), { recursive: true });
    await writeFile(join(testDir, "media", "doc.pdf"), "mock pdf", "utf8");
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("lists and reads files from disk", async () => {
    const source = new DirectoryFileSource(testDir);
    const list = await source.list();

    expect(list.length).toBeGreaterThanOrEqual(2);
    const paths = list.map((e) => e.path.replace(/\\/g, "/"));
    expect(paths).toContain("_chat.txt");
    expect(paths).toContain("media/doc.pdf");

    const text = await source.readText("_chat.txt");
    expect(text).toBe("hello chat");

    const bytes = await source.readBytes("media/doc.pdf");
    expect(new TextDecoder().decode(bytes)).toBe("mock pdf");
  });
});
