import type { ChatSession, FileSource } from "@whatsappya/core";
import { type ExportAssets, StandaloneHtmlExporter, escapeHtml } from "./StandaloneHtmlExporter.js";

export interface BundleOutputFile {
  readonly relativePath: string;
  readonly content: string | Uint8Array;
}

export interface FolderBundleOptions {
  readonly folderName: string;
  readonly htmlFilename?: string | undefined;
  readonly createLauncher?: boolean | undefined;
  readonly createIndex?: boolean | undefined;
  readonly legacyVoiceCache?: boolean | undefined;
}

/**
 * Produces a distributable folder bundle (chat HTML, optional outer launcher,
 * and opt-in `_voice_cache/*.js` modules for `file://` audio playback).
 * Remains platform-agnostic by emitting `BundleOutputFile[]` rather than writing to disk directly.
 */
export class FolderBundleExporter {
  readonly #htmlExporter: StandaloneHtmlExporter;

  constructor(assets: ExportAssets) {
    this.#htmlExporter = new StandaloneHtmlExporter(assets);
  }

  async build(
    session: ChatSession,
    files: FileSource,
    options: FolderBundleOptions,
  ): Promise<readonly BundleOutputFile[]> {
    const htmlFilename = options.htmlFilename ?? "chat.html";
    const outputs: BundleOutputFile[] = [];
    const voiceCacheScripts: string[] = [];

    if (options.legacyVoiceCache) {
      const seenAudio = new Set<string>();
      for (const msg of session.messages) {
        const att = msg.attachment;
        if (!att || att.isOmitted || att.kind !== "audio" || seenAudio.has(att.fileName)) {
          continue;
        }
        seenAudio.add(att.fileName);
        try {
          const bytes = await files.readBytes(att.fileName);
          const b64 = uint8ToBase64(bytes);
          const encodedKey = encodeURIComponent(att.fileName);
          const jsPayload = `window.__WA_VOICE_CACHE__=window.__WA_VOICE_CACHE__||{};window.__WA_VOICE_CACHE__[${JSON.stringify(encodedKey)}]=${JSON.stringify(b64)};\n`;
          const scriptRelPath = `_voice_cache/${att.fileName}.js`;
          voiceCacheScripts.push(scriptRelPath);
          outputs.push({
            relativePath: `${options.folderName}/${scriptRelPath}`,
            content: jsPayload,
          });
        } catch {
          // Skip missing audio files cleanly
        }
      }
    }

    const html = this.#htmlExporter.build(session, {
      legacyVoiceCacheScripts: voiceCacheScripts,
    });
    outputs.push({
      relativePath: `${options.folderName}/${htmlFilename}`,
      content: html,
    });

    if (options.createLauncher ?? true) {
      const launcherHtml = buildLauncherHtml(
        `${options.folderName}/${htmlFilename}`,
        session.contactName,
      );
      outputs.push({
        relativePath: "افتح المحادثة هنا - Open Chat Here.html",
        content: launcherHtml,
      });
      if (options.createIndex) {
        outputs.push({
          relativePath: "index.html",
          content: launcherHtml,
        });
      }
    }

    return outputs;
  }
}

function buildLauncherHtml(relativeTarget: string, contactName: string): string {
  const encodedTarget = encodeURI(relativeTarget);
  const title = contactName ? `محادثة ${contactName}` : "محادثة واتساب";
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=${escapeHtml(encodedTarget)}">
  <title>فتح ${escapeHtml(title)}</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;background:#efeae2;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
    @media(prefers-color-scheme:dark){body{background:#0b141a;color:#e9edef}}
    .card{background:#fff;padding:32px;border-radius:20px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:420px}
    @media(prefers-color-scheme:dark){.card{background:#111b21}}
    .btn{display:inline-block;margin-top:16px;background:#25d366;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600}
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>جاري فتح المحادثة تلقائياً...<br>Opening chat automatically...</p>
    <a class="btn" href="${escapeHtml(encodedTarget)}">اضغط هنا لفتح المحادثة ↗</a>
  </div>
  <script>window.location.replace(${JSON.stringify(relativeTarget)});</script>
</body>
</html>`;
}

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function uint8ToBase64(bytes: Uint8Array): string {
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
