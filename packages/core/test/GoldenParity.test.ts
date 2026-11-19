import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ConvertChat } from "../src/application/ConvertChat.js";
import type { ChatSession } from "../src/domain/models.js";
import { ParserRegistry } from "../src/parsers/ParserRegistry.js";
import { AndroidParser } from "../src/parsers/android/AndroidParser.js";
import { IosParser } from "../src/parsers/ios/IosParser.js";
import type { FileSource } from "../src/ports/FileSource.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "../../..");
const fixturesDir = join(rootDir, "fixtures");

const createFsSource = (files: Record<string, string>): FileSource => ({
  list: async () =>
    Object.entries(files).map(([path, content]) => ({
      path,
      sizeBytes: new TextEncoder().encode(content).length,
    })),
  readText: async (path: string) => files[path] ?? "",
  readBytes: async (path: string) => new TextEncoder().encode(files[path] ?? ""),
});

function assertConformsToSchema(session: ChatSession): void {
  expect(session.schemaVersion).toBe(1);
  expect(typeof session.title).toBe("string");
  expect(typeof session.contactName).toBe("string");
  expect(session.ownerName === null || typeof session.ownerName === "string").toBe(true);
  expect(["day_first", "month_first"]).toContain(session.dateOrder);
  expect(typeof session.senderCounts).toBe("object");

  for (const msg of session.messages) {
    expect(typeof msg.id).toBe("string");
    expect(typeof msg.rawDate).toBe("string");
    expect(typeof msg.rawTime).toBe("string");
    expect(msg.timestamp === null || typeof msg.timestamp === "string").toBe(true);
    expect(msg.sender === null || typeof msg.sender === "string").toBe(true);
    expect(typeof msg.text).toBe("string");
    expect(["message", "system", "call"]).toContain(msg.kind);
    expect(["sent", "received"]).toContain(msg.direction);
    expect(typeof msg.isDeleted).toBe("boolean");
    expect(typeof msg.isEdited).toBe("boolean");

    if (msg.attachment !== null) {
      expect(typeof msg.attachment.fileName).toBe("string");
      expect([
        "none",
        "image",
        "video",
        "audio",
        "pdf",
        "document",
        "file",
        "sticker",
        "omitted",
      ]).toContain(msg.attachment.kind);
      expect(typeof msg.attachment.mimeType).toBe("string");
      expect(typeof msg.attachment.sizeBytes).toBe("number");
      expect(msg.attachment.sizeBytes).toBeGreaterThanOrEqual(0);
      expect(typeof msg.attachment.isOmitted).toBe("boolean");
    }
  }
}

describe("Golden Parity", () => {
  const parsers = new ParserRegistry().register(new IosParser()).register(new AndroidParser());
  const useCase = new ConvertChat({ parsers });

  it("parses ios-en-12h and matches golden fixture exactly", async () => {
    const chatText = await readFile(join(fixturesDir, "exports/ios-en-12h/_chat.txt"), "utf8");
    const files = createFsSource({
      "_chat.txt": chatText,
      "00000001-PHOTO-2026-11-17-09-16-05.jpg": "MOCK IMAGE BYTES",
    });

    const res = await useCase.execute({
      files,
      chatPath: "WhatsApp Chat - Alex/_chat.txt",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const session = res.value;
    assertConformsToSchema(session);

    const expectedGoldenRaw = await readFile(join(fixturesDir, "golden/ios-en-12h.json"), "utf8");
    const expectedGolden = JSON.parse(expectedGoldenRaw);
    expect(session).toEqual(expectedGolden);
  });

  it("parses android-ar-24h and matches golden fixture exactly", async () => {
    const chatText = await readFile(join(fixturesDir, "exports/android-ar-24h/_chat.txt"), "utf8");
    const files = createFsSource({
      "_chat.txt": chatText,
    });

    const res = await useCase.execute({
      files,
      chatPath: "WhatsApp Chat - سارة/_chat.txt",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const session = res.value;
    assertConformsToSchema(session);

    const expectedGoldenRaw = await readFile(
      join(fixturesDir, "golden/android-ar-24h.json"),
      "utf8",
    );
    const expectedGolden = JSON.parse(expectedGoldenRaw);
    expect(session).toEqual(expectedGolden);
  });
});
