import type { ChatSession } from "@whatsappya/core";

export interface ExportAssets {
  readonly viewerJs: string;
  readonly viewerCss: string;
}

/**
 * BUILDER: assembles one offline HTML file. Messages are embedded as JSON (not pre-rendered DOM)
 * so the viewer can virtualize; media is embedded or referenced depending on the platform.
 */
export class StandaloneHtmlExporter {
  constructor(private readonly assets: ExportAssets) {}

  build(session: ChatSession): string {
    const data = JSON.stringify(session).replace(/</g, "\\u003c");
    return [
      "<!doctype html>",
      '<html lang="en"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      `<title>${escapeHtml(session.title)}</title>`,
      `<style>${this.assets.viewerCss}</style></head>`,
      "<body><wa-message-list></wa-message-list>",
      `<script type="application/json" id="chat-data">${data}</script>`,
      `<script type="module">${this.assets.viewerJs}</script>`,
      "</body></html>",
    ].join("\n");
  }
}

const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
