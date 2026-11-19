import type { ChatSession } from "@whatsappya/core";

export interface ExportAssets {
  readonly viewerJs: string;
  readonly viewerCss: string;
}

export interface StandaloneExportOptions {
  readonly legacyVoiceCacheScripts?: readonly string[] | undefined;
}

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
      `<script>${safeJs}</script>`,
      "</body></html>",
    ]
      .filter(Boolean)
      .join("\n");
  }
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
