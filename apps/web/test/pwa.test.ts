import {
  type ChatMessage,
  type ChatSession,
  DateOrder,
  Direction,
  MessageKind,
} from "@whatsappya/core";
import { StandaloneHtmlExporter } from "@whatsappya/exporter";
import { STANDALONE_VIEWER_CSS, STANDALONE_VIEWER_JS } from "@whatsappya/viewer/standalone";
import { describe, expect, it } from "vitest";
import { SearchWorkerClient } from "../src/features/viewer/SearchWorkerClient.js";

function buildSyntheticSession(count: number): ChatSession {
  const messages: ChatMessage[] = new Array(count);
  for (let i = 0; i < count; i++) {
    messages[i] = {
      id: `m${i}`,
      rawDate: "18/11/2026",
      rawTime: "10:00:00 AM",
      timestamp: "2026-11-18T10:00:00.000Z",
      sender: i % 2 === 0 ? "Doctor" : "Student",
      text:
        i === count - 77
          ? "Acute myocardial infarction STEMI diagnostic criteria"
          : `Lecture transcript paragraph ${i} discussing clinical anatomy`,
      kind: MessageKind.Message,
      direction: i % 2 === 0 ? Direction.Received : Direction.Sent,
      isDeleted: false,
      isEdited: false,
      attachment: null,
    };
  }
  return {
    schemaVersion: 1,
    title: "Chat with Doctor",
    contactName: "Doctor",
    ownerName: "Student",
    dateOrder: DateOrder.DayFirst,
    messages,
    senderCounts: { Doctor: count / 2, Student: count / 2 },
  };
}

describe("Web PWA SearchWorkerClient & Offline Export", () => {
  it("indexes and queries 50,000 messages under 20 ms via SearchWorkerClient", async () => {
    const session = buildSyntheticSession(50_000);
    const client = new SearchWorkerClient(false);

    await client.indexSession(session, "ch1");

    const t0 = performance.now();
    const hits = await client.search({ text: "myocardial stemi", chapterId: "ch1" });
    const elapsedMs = performance.now() - t0;

    expect(hits).toHaveLength(1);
    expect(hits[0]?.messageId).toBe("m49923");
    expect(elapsedMs).toBeLessThan(20);
    client.dispose();
  });

  it("embeds self-contained IIFE viewer bundle in offline HTML exports", () => {
    const session = buildSyntheticSession(10);
    const html = new StandaloneHtmlExporter({
      viewerJs: STANDALONE_VIEWER_JS,
      viewerCss: STANDALONE_VIEWER_CSS,
    }).build(session);

    expect(html).toContain("<wa-breadcrumbs></wa-breadcrumbs>");
    expect(html).toContain("<wa-message-list></wa-message-list>");
    expect(html).toContain("<wa-search></wa-search>");
    expect(html).toContain("<wa-lightbox></wa-lightbox>");
    expect(html).toContain('id="chat-data"');
    expect(html.length).toBeGreaterThan(30_000);
  });

  it("configures CSP for PDF blob preview, zero-egress connect-src, iOS/Android PNG icons, and v2 network-first SW", () => {
    interface NodeFsBuiltin {
      readFileSync(path: URL, encoding: "utf8"): string;
      statSync(path: URL): { size: number };
    }
    const getBuiltin = (
      globalThis as unknown as {
        process?: { getBuiltinModule?: (id: string) => unknown };
      }
    ).process?.getBuiltinModule;
    const fs = getBuiltin?.("node:fs") as NodeFsBuiltin | undefined;
    expect(fs).toBeDefined();
    if (!fs) return;

    const indexHtml = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
    expect(indexHtml).toContain("frame-src 'self' blob:");
    expect(indexHtml).toContain("connect-src 'none'");
    expect(indexHtml).toContain("/icons/apple-touch-icon.png");

    const manifestRaw = fs.readFileSync(
      new URL("../public/manifest.webmanifest", import.meta.url),
      "utf8",
    );
    const manifest = JSON.parse(manifestRaw) as {
      icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
    };
    const requiredPngs = [
      { src: "/icons/icon-192.png", sizes: "192x192", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", purpose: "maskable" },
    ];
    for (const req of requiredPngs) {
      const found = manifest.icons.find(
        (i) => i.src === req.src && i.sizes === req.sizes && i.purpose === req.purpose,
      );
      expect(found).toBeDefined();
      const diskStat = fs.statSync(new URL(`../public${req.src}`, import.meta.url));
      expect(diskStat.size).toBeGreaterThan(0);
    }
    expect(
      fs.statSync(new URL("../public/icons/apple-touch-icon.png", import.meta.url)).size,
    ).toBeGreaterThan(0);

    const swSource = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
    expect(swSource).toContain('SHELL_CACHE = "whatsappya-shell-v2"');
    expect(swSource).toContain('event.request.mode === "navigate"');
  });
});
