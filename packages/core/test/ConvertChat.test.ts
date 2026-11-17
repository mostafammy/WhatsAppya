import { describe, expect, it } from "vitest";
import { ConvertChat } from "../src/application/ConvertChat.js";
import type { ChatParser } from "../src/parsers/ChatParser.js";
import { ParserRegistry } from "../src/parsers/ParserRegistry.js";
import type { FileSource } from "../src/ports/FileSource.js";

const memoryFiles = (files: Record<string, string>): FileSource => ({
  list: async () => Object.entries(files).map(([path, c]) => ({ path, sizeBytes: c.length })),
  readText: async (p) => files[p] ?? "",
  readBytes: async (p) => new TextEncoder().encode(files[p] ?? ""),
});

const fakeParser: ChatParser = {
  id: "fake",
  canHandle: (lines) => lines.some((l) => l.startsWith("FAKE")),
  parse: () => [
    { rawDate: "1/1/26", rawTime: "10:00", sender: "Ana", text: "hi", kind: "message" },
  ],
};

describe("ConvertChat", () => {
  it("returns CHAT_FILE_NOT_FOUND when no export text exists", async () => {
    const uc = new ConvertChat({ parsers: new ParserRegistry(), stages: [] });
    const res = await uc.execute({ files: memoryFiles({ "photo.jpg": "x" }) });
    expect(res).toEqual({ ok: false, error: { code: "CHAT_FILE_NOT_FOUND" } });
  });

  it("returns UNSUPPORTED_FORMAT when no strategy matches", async () => {
    const uc = new ConvertChat({ parsers: new ParserRegistry(), stages: [] });
    const res = await uc.execute({ files: memoryFiles({ "_chat.txt": "???" }) });
    expect(res.ok).toBe(false);
  });

  it("builds a session through the registered strategy", async () => {
    const uc = new ConvertChat({ parsers: new ParserRegistry().register(fakeParser), stages: [] });
    const res = await uc.execute({ files: memoryFiles({ "_chat.txt": "FAKE" }), ownerName: "Me" });
    expect(res.ok && res.value.contactName).toBe("Ana");
  });
});
