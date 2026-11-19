import type { ChatSession, FileSource } from "@whatsappya/core";
import { describe, expect, it } from "vitest";
import { FolderBundleExporter } from "../src/FolderBundleExporter.js";
import { StandaloneHtmlExporter } from "../src/StandaloneHtmlExporter.js";

const mockSession: ChatSession = {
  schemaVersion: 1,
  title: "Chat with Doctor Smith",
  contactName: "Doctor Smith",
  ownerName: "Student",
  dateOrder: "day_first",
  senderCounts: { "Doctor Smith": 1 },
  messages: [
    {
      id: "m0",
      rawDate: "12/03/2025",
      rawTime: "10:15:00 AM",
      timestamp: "2025-03-12T10:15:00.000Z",
      sender: "Doctor Smith",
      text: "Listen to </script><script>alert(1)</script>",
      kind: "message",
      direction: "received",
      isDeleted: false,
      isEdited: false,
      attachment: {
        fileName: "lecture1.opus",
        kind: "audio",
        mimeType: "audio/ogg; codecs=opus",
        sizeBytes: 4,
        isOmitted: false,
      },
    },
  ],
};

const mockFiles: FileSource = {
  list: async () => [{ path: "lecture1.opus", sizeBytes: 4 }],
  readText: async () => "",
  readBytes: async () => new Uint8Array([79, 103, 103, 83]),
};

describe("Exporters", () => {
  const assets = { viewerJs: "console.log('viewer');", viewerCss: "body{}" };

  it("StandaloneHtmlExporter escapes closing script tags in JSON payload", () => {
    const exporter = new StandaloneHtmlExporter(assets);
    const html = exporter.build(mockSession);

    expect(html).toContain("<wa-message-list></wa-message-list>");
    expect(html).toContain("<wa-search></wa-search>");
    expect(html).toContain("<wa-lightbox></wa-lightbox>");
    expect(html).not.toContain("</script><script>alert(1)</script>");
    expect(html).toContain("\\u003c/script>");
  });

  it("FolderBundleExporter omits _voice_cache by default and emits it when legacyVoiceCache is true", async () => {
    const exporter = new FolderBundleExporter(assets);

    const defaultFiles = await exporter.build(mockSession, mockFiles, {
      folderName: "Doctor Smith",
    });
    expect(defaultFiles.some((f) => f.relativePath.includes("_voice_cache"))).toBe(false);
    expect(defaultFiles.some((f) => f.relativePath === "Doctor Smith/chat.html")).toBe(true);
    expect(
      defaultFiles.some((f) => f.relativePath === "افتح المحادثة هنا - Open Chat Here.html"),
    ).toBe(true);

    const legacyFiles = await exporter.build(mockSession, mockFiles, {
      folderName: "Doctor Smith",
      legacyVoiceCache: true,
      createIndex: true,
    });
    const cacheFile = legacyFiles.find(
      (f) => f.relativePath === "Doctor Smith/_voice_cache/lecture1.opus.js",
    );
    expect(cacheFile).toBeDefined();
    expect(String(cacheFile?.content)).toContain("window.__WA_VOICE_CACHE__");
    expect(legacyFiles.some((f) => f.relativePath === "index.html")).toBe(true);
  });
});
