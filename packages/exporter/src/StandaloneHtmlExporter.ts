import {
  type ChatMessage,
  type ChatSession,
  type FileSource,
  parseOggOpusDuration,
} from "@whatsappya/core";

export interface ExportAssets {
  readonly viewerJs: string;
  readonly viewerCss: string;
}

export interface EmbeddedMediaEntry {
  readonly mimeType: string;
  readonly base64: string;
}

export interface StandaloneExportOptions {
  readonly legacyVoiceCacheScripts?: readonly string[] | undefined;
  readonly embeddedMedia?: Readonly<Record<string, EmbeddedMediaEntry>> | undefined;
}

export interface BuildWithMediaOptions extends StandaloneExportOptions {
  readonly maxTotalMediaBytes?: number | undefined;
  readonly maxFileBytes?: number | undefined;
}

export interface StandaloneBuildResult {
  readonly html: string;
  readonly embeddedCount: number;
  readonly skippedCount: number;
  readonly embeddedBytes: number;
}

const DEFAULT_MAX_TOTAL_MEDIA_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_FILE_BYTES = 15 * 1024 * 1024;

/**
 * BUILDER: assembles one offline HTML file. Messages are embedded as JSON (not pre-rendered DOM)
 * so `<wa-message-list>` can virtualize 50k+ messages and `<wa-search>` can index them on load.
 * Uses an inline classic `<script>` (IIFE) rather than `type="module"` so `file://` opens cleanly
 * across Safari, Chrome, and Firefox without CORS restrictions.
 */
export class StandaloneHtmlExporter {
  constructor(private readonly assets: ExportAssets) {}

  build(session: ChatSession, options: StandaloneExportOptions = {}): string {
    const data = JSON.stringify(session).replace(/</g, "\\u003c");
    const safeJs = this.assets.viewerJs.replace(/<\/script/gi, "<\\/script");
    const voiceScripts = (options.legacyVoiceCacheScripts ?? [])
      .map((src) => `<script src="${escapeHtml(src)}"></script>`)
      .join("\n");

    const embeddedKeys = options.embeddedMedia ? Object.keys(options.embeddedMedia) : [];
    const mediaTag =
      embeddedKeys.length > 0
        ? `<script type="application/json" id="chat-media">${JSON.stringify(options.embeddedMedia).replace(/</g, "\\u003c")}</script>`
        : "";

    return [
      "<!doctype html>",
      '<html lang="en"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      `<title>${escapeHtml(session.title)}</title>`,
      `<style>${this.assets.viewerCss}</style></head>`,
      "<body>",
      "<wa-breadcrumbs></wa-breadcrumbs>",
      "<wa-message-list></wa-message-list>",
      "<wa-search></wa-search>",
      "<wa-lightbox></wa-lightbox>",
      voiceScripts,
      `<script type="application/json" id="chat-data">${data}</script>`,
      mediaTag,
      `<script>${safeJs}</script>`,
      "</body></html>",
    ]
      .filter(Boolean)
      .join("\n");
  }

  /**
   * Builds a self-contained HTML export with non-omitted attachments encoded inline in `#chat-media`,
   * enforcing per-file (15 MB default) and total media budget (50 MB default) caps.
   */
  async buildWithMedia(
    session: ChatSession,
    files: FileSource,
    options: BuildWithMediaOptions = {},
  ): Promise<StandaloneBuildResult> {
    const maxTotalMediaBytes = options.maxTotalMediaBytes ?? DEFAULT_MAX_TOTAL_MEDIA_BYTES;
    const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;

    const entries = await files.list();
    const index = new Map<string, { readonly path: string; readonly sizeBytes: number }>();
    for (const entry of entries) {
      const normalized = entry.path.replace(/\\/g, "/").replace(/^\/+/, "");
      const baseName = normalized.split("/").pop() ?? normalized;
      index.set(normalized.toLowerCase(), { path: entry.path, sizeBytes: entry.sizeBytes });
      if (!index.has(baseName.toLowerCase())) {
        index.set(baseName.toLowerCase(), { path: entry.path, sizeBytes: entry.sizeBytes });
      }
    }

    const enrichedMessages: ChatMessage[] = [...session.messages];
    const embeddedMedia: Record<string, EmbeddedMediaEntry> = {};
    const seen = new Set<string>();
    let embeddedCount = 0;
    let skippedCount = 0;
    let embeddedBytes = 0;

    for (let i = 0; i < enrichedMessages.length; i++) {
      const msg = enrichedMessages[i];
      const att = msg?.attachment;
      if (!msg || !att || att.isOmitted || att.kind === "omitted") continue;
      if (seen.has(att.fileName)) continue;
      seen.add(att.fileName);

      const normalizedName = att.fileName.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
      const baseName = normalizedName.split("/").pop() ?? normalizedName;
      const entry = index.get(normalizedName) ?? index.get(baseName);
      if (!entry) {
        skippedCount++;
        continue;
      }

      if (entry.sizeBytes > maxFileBytes || embeddedBytes + entry.sizeBytes > maxTotalMediaBytes) {
        skippedCount++;
        continue;
      }

      try {
        const bytes = await files.readBytes(entry.path);
        if (att.kind === "audio" && att.durationSeconds === undefined) {
          const parsedDuration = parseOggOpusDuration(bytes);
          if (parsedDuration !== undefined) {
            enrichedMessages[i] = {
              ...msg,
              attachment: { ...att, durationSeconds: parsedDuration },
            };
          }
        }

        if (
          bytes.byteLength > maxFileBytes ||
          embeddedBytes + bytes.byteLength > maxTotalMediaBytes
        ) {
          skippedCount++;
          continue;
        }

        embeddedMedia[att.fileName] = {
          mimeType: att.mimeType,
          base64: uint8ToBase64(bytes),
        };
        embeddedBytes += bytes.byteLength;
        embeddedCount++;
      } catch {
        skippedCount++;
      }
    }

    const enrichedSession: ChatSession = { ...session, messages: enrichedMessages };
    const html = this.build(enrichedSession, {
      ...options,
      embeddedMedia,
    });

    return {
      html,
      embeddedCount,
      skippedCount,
      embeddedBytes,
    };
  }
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function uint8ToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out +=
      (B64_ALPHABET[(n >>> 18) & 63] ?? "") +
      (B64_ALPHABET[(n >>> 12) & 63] ?? "") +
      (has1 ? (B64_ALPHABET[(n >>> 6) & 63] ?? "") : "=") +
      (has2 ? (B64_ALPHABET[n & 63] ?? "") : "=");
  }
  return out;
}
