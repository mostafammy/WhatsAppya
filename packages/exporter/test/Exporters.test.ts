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

  it("StandaloneHtmlExporter.buildWithMedia embeds media in #chat-media and respects size limits", async () => {
    const exporter = new StandaloneHtmlExporter(assets);
    const oggBytes = new Uint8Array([79, 103, 103, 83, 1, 2, 3, 4]);
    const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const bigBytes = new Uint8Array(200);

    const richSession: ChatSession = {
      ...mockSession,
      messages: [
        ...mockSession.messages,
        {
          id: "m1",
          rawDate: "12/03/2025",
          rawTime: "10:16:00 AM",
          timestamp: "2025-03-12T10:16:00.000Z",
          sender: "Doctor Smith",
          text: "ECG chart",
          kind: "message",
          direction: "received",
          isDeleted: false,
          isEdited: false,
          attachment: {
            fileName: "ecg.png",
            kind: "image",
            mimeType: "image/png",
            sizeBytes: imageBytes.byteLength,
            isOmitted: false,
          },
        },
        {
          id: "m2",
          rawDate: "12/03/2025",
          rawTime: "10:17:00 AM",
          timestamp: "2025-03-12T10:17:00.000Z",
          sender: "Doctor Smith",
          text: "Too large",
          kind: "message",
          direction: "received",
          isDeleted: false,
          isEdited: false,
          attachment: {
            fileName: "large.pdf",
            kind: "pdf",
            mimeType: "application/pdf",
            sizeBytes: bigBytes.byteLength,
            isOmitted: false,
          },
        },
      ],
    };

    const nestedFiles: FileSource = {
      list: async () => [
        { path: "Export/Audio/lecture1.opus", sizeBytes: oggBytes.byteLength },
        { path: "Export/Media/ecg.png", sizeBytes: imageBytes.byteLength },
        { path: "Export/Docs/large.pdf", sizeBytes: bigBytes.byteLength },
      ],
      readText: async () => "",
      readBytes: async (path) => {
        if (path.endsWith("lecture1.opus")) return oggBytes;
        if (path.endsWith("ecg.png")) return imageBytes;
        return bigBytes;
      },
    };

    const res = await exporter.buildWithMedia(richSession, nestedFiles, {
      maxFileBytes: 50,
      maxTotalMediaBytes: 100,
    });

    expect(res.embeddedCount).toBe(2);
    expect(res.skippedCount).toBe(1);
    expect(res.embeddedBytes).toBe(oggBytes.byteLength + imageBytes.byteLength);
    expect(res.html).toContain('id="chat-media"');

    const match = res.html.match(
      /<script type="application\/json" id="chat-media">([^<]+)<\/script>/,
    );
    expect(match).not.toBeNull();
    const embedded = JSON.parse(match?.[1] ?? "{}") as Record<
      string,
      { mimeType: string; base64: string }
    >;
    expect(embedded["lecture1.opus"]?.mimeType).toBe("audio/ogg; codecs=opus");
    expect(embedded["ecg.png"]?.mimeType).toBe("image/png");
    expect(embedded["large.pdf"]).toBeUndefined();
  });
});
