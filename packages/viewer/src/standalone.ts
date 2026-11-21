import { type ChatSession, type HybridSearchHit, HybridSearchIndex } from "@whatsappya/core";
import {
  type LightboxItem,
  type WaLightbox,
  collectMediaGallery,
} from "./components/lightbox/WaLightbox.js";
import type { WaMessageList } from "./components/message-list/WaMessageList.js";
import type { WaBreadcrumbs } from "./components/navigation/WaBreadcrumbs.js";
import type { WaSearch } from "./components/search/WaSearch.js";
import { type MediaSourceResolver, defaultMediaLeases } from "./media/MediaLeaseManager.js";
import "./components/lightbox/WaLightbox.js";
import "./components/message-list/WaMessageList.js";
import "./components/navigation/WaBreadcrumbs.js";
import "./components/search/WaSearch.js";
import "./components/sticker/WaSticker.js";
import "./components/voice-note/WaVoiceNote.js";

interface RawEmbeddedMedia {
  readonly mimeType?: string;
  readonly base64?: string;
}

function createEmbeddedMediaResolver(rawJson: string): MediaSourceResolver | null {
  let parsed: Record<string, RawEmbeddedMedia> | null;
  try {
    parsed = JSON.parse(rawJson) as Record<string, RawEmbeddedMedia> | null;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const index = new Map<string, RawEmbeddedMedia>();
  for (const [key, entry] of Object.entries(parsed)) {
    if (!entry || typeof entry.base64 !== "string") continue;
    const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
    const baseName = normalized.split("/").pop() ?? normalized;
    index.set(key, entry);
    index.set(normalized.toLowerCase(), entry);
    if (!index.has(baseName.toLowerCase())) {
      index.set(baseName.toLowerCase(), entry);
    }
  }

  return {
    async resolveMedia(fileName: string, mimeType: string): Promise<Blob | string> {
      const normalized = fileName.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
      const baseName = normalized.split("/").pop() ?? normalized;
      const entry = index.get(fileName) ?? index.get(normalized) ?? index.get(baseName);
      if (!entry?.base64) {
        return encodeURI(fileName);
      }

      const binary = atob(entry.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes as unknown as BlobPart], {
        type: entry.mimeType || mimeType || "application/octet-stream",
      });
    },
  };
}

function bootStandaloneViewer(): void {
  const dataEl = document.getElementById("chat-data");
  if (!dataEl?.textContent) return;

  let session: ChatSession;
  try {
    session = JSON.parse(dataEl.textContent) as ChatSession;
  } catch {
    return;
  }

  const mediaEl = document.getElementById("chat-media");
  if (mediaEl?.textContent) {
    const resolver = createEmbeddedMediaResolver(mediaEl.textContent);
    if (resolver) {
      defaultMediaLeases.setResolver(resolver);
    }
  }

  const list = document.querySelector<WaMessageList>("wa-message-list");
  const crumbs = document.querySelector<WaBreadcrumbs>("wa-breadcrumbs");
  const search = document.querySelector<WaSearch>("wa-search");
  const lightbox = document.querySelector<WaLightbox>("wa-lightbox");

  if (crumbs) {
    crumbs.segments = [{ id: "root", label: session.contactName || session.title }];
    crumbs.addEventListener("wa-search-open", () => search?.open());
  }

  if (list) {
    list.leases = defaultMediaLeases;
    list.session = session;
  }

  if (lightbox) {
    lightbox.leases = defaultMediaLeases;
  }

  const gallery = collectMediaGallery(session);
  list?.addEventListener("wa-media-open", (e) => {
    const item = (e as CustomEvent<{ item: LightboxItem }>).detail.item;
    if (item.kind === "pdf") {
      void lightbox?.open(item);
    } else {
      void lightbox?.open(item, gallery);
    }
  });

  search?.addEventListener("wa-search-select", (e) => {
    const hit = (e as CustomEvent<{ hit: HybridSearchHit }>).detail.hit;
    list?.scrollToMessage(hit.messageId);
  });

  // Post-FMP indexing so first paint of 50k+ messages is instantaneous
  const scheduleIndex = () => {
    const index = new HybridSearchIndex();
    index.indexSession(session, "default");
    index.commit();
    if (search) {
      search.searchIndex = index;
    }
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(scheduleIndex);
  } else {
    setTimeout(scheduleIndex, 0);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootStandaloneViewer, { once: true });
} else {
  bootStandaloneViewer();
}
