import type { ChatMessage } from "../../domain/models.js";
import type { PipelineContext, PipelineStage } from "../PipelineStage.js";

export interface LinkMetadata {
  readonly rawUrl: string;
  readonly domain: string;
  readonly title: string;
  readonly category: "video" | "code" | "social" | "news" | "portal";
  readonly icon: string;
  readonly isSecure: boolean;
}

const URL_PATTERN = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g;

const CATEGORY_ICONS: Record<string, string> = {
  video: "🎬",
  code: "💻",
  social: "💬",
  news: "📰",
  portal: "🌐",
};

/**
 * Extracts URL metadata from messages for rich link card presentation.
 */
export class LinkStage implements PipelineStage {
  readonly name = "LinkStage";

  async process(
    messages: readonly ChatMessage[],
    _ctx: PipelineContext,
  ): Promise<readonly ChatMessage[]> {
    return messages;
  }

  static extractUrls(text: string): readonly LinkMetadata[] {
    const matches = text.match(URL_PATTERN);
    if (!matches) return [];

    const cards: LinkMetadata[] = [];
    for (const rawUrl of matches) {
      try {
        const urlMatch = rawUrl.match(/^(https?:\/\/)([^/?#]+)([^?#]*)?/i);
        if (!urlMatch || urlMatch[1] === undefined || urlMatch[2] === undefined) continue;

        const isSecure = urlMatch[1].toLowerCase() === "https://";
        let domain = urlMatch[2].toLowerCase();
        if (domain.startsWith("www.")) domain = domain.slice(4);

        const category = LinkStage.#categorizeDomain(domain);
        const icon = CATEGORY_ICONS[category] ?? "🌐";

        const rawPath = urlMatch[3] ?? "";
        const pathSnippet = rawPath.replace(/^\/+|\/+$/g, "");
        let title = domain;
        if (pathSnippet) {
          const parts = pathSnippet.split("/");
          if (parts[0] !== undefined && parts[0].length > 0) {
            title = `${domain} › ${parts[0].slice(0, 24)}`;
          }
        }

        cards.push({
          rawUrl,
          domain,
          title,
          category,
          icon,
          isSecure,
        });
      } catch {
        // Skip unparseable URL
      }
    }
    return cards;
  }

  static #categorizeDomain(domain: string): "video" | "code" | "social" | "news" | "portal" {
    if (["youtube.com", "youtu.be", "vimeo.com", "tiktok.com"].some((v) => domain.includes(v))) {
      return "video";
    }
    if (["github.com", "gitlab.com", "stackoverflow.com"].some((c) => domain.includes(c))) {
      return "code";
    }
    if (
      ["twitter.com", "x.com", "instagram.com", "facebook.com", "linkedin.com", "reddit.com"].some(
        (s) => domain.includes(s),
      )
    ) {
      return "social";
    }
    if (
      ["wikipedia.org", "medium.com", "nytimes.com", "bbc.com", "reuters.com"].some((n) =>
        domain.includes(n),
      )
    ) {
      return "news";
    }
    return "portal";
  }
}
