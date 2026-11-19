import { describe, expect, it } from "vitest";
import { ConvertArchive } from "../src/application/ConvertArchive.js";
import { ParserRegistry } from "../src/parsers/ParserRegistry.js";
import { AndroidParser } from "../src/parsers/android/AndroidParser.js";
import { IosParser } from "../src/parsers/ios/IosParser.js";
import type { FileSource } from "../src/ports/FileSource.js";

const memoryArchive = (files: Record<string, string>): FileSource => ({
  list: async () => Object.entries(files).map(([path, c]) => ({ path, sizeBytes: c.length })),
  readText: async (p) => files[p] ?? "",
  readBytes: async (p) => new TextEncoder().encode(files[p] ?? ""),
});

describe("ConvertArchive", () => {
  const parsers = new ParserRegistry().register(new IosParser()).register(new AndroidParser());
  const useCase = new ConvertArchive({ parsers });

  it("handles a single chat archive without artificial nesting", async () => {
    const files = memoryArchive({
      "WhatsApp Chat - Alice/_chat.txt":
        "[12/03/2025, 10:15:00 AM] Alice: Hello!\n[12/03/2025, 10:16:00 AM] Bob: Hey Alice!",
    });

    const res = await useCase.execute({ files, rootName: "Export" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.schemaVersion).toBe(1);
    expect(res.value.root.chats).toHaveLength(1);
    expect(res.value.root.chats[0]?.contactName).toBe("Alice");
    expect(res.value.root.chats[0]?.messageCount).toBe(2);
    expect(res.value.root.chats[0]?.exportFormat).toBe("ios");
  });

  it("builds recursive multi-chapter curriculum tree for nested folders", async () => {
    const files = memoryArchive({
      "Block1/Cardiology/Chapter1/_chat.txt":
        "[12/03/2025, 10:15:00 AM] Doctor Smith: Welcome to ECG basics\n[12/03/2025, 10:16:00 AM] Student: Thanks!",
      "Block1/Cardiology/Chapter2/_chat.txt":
        "12/03/2025, 11:00 - Doctor Smith: Arrhythmias\n12/03/2025, 11:05 - Student: Questions",
    });

    const res = await useCase.execute({ files, rootName: "Curriculum" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.value.root.children).toHaveLength(1);
    const block1 = res.value.root.children[0];
    expect(block1?.name).toBe("Block1");

    expect(block1?.children).toHaveLength(1);
    const cardio = block1?.children[0];
    expect(cardio?.name).toBe("Cardiology");

    expect(cardio?.children).toHaveLength(2);
  });
});
