import { type ChatSession, type HybridSearchHit, HybridSearchIndex } from "@whatsappya/core";
import {
  type LightboxItem,
  type WaLightbox,
  collectMediaGallery,
} from "./components/lightbox/WaLightbox.js";
import type { WaMessageList } from "./components/message-list/WaMessageList.js";
import type { WaBreadcrumbs } from "./components/navigation/WaBreadcrumbs.js";
import type { WaSearch } from "./components/search/WaSearch.js";
import "./components/lightbox/WaLightbox.js";
import "./components/message-list/WaMessageList.js";
import "./components/navigation/WaBreadcrumbs.js";
import "./components/search/WaSearch.js";
import "./components/sticker/WaSticker.js";
import "./components/voice-note/WaVoiceNote.js";

function bootStandaloneViewer(): void {
  const dataEl = document.getElementById("chat-data");
  if (!dataEl?.textContent) return;

  let session: ChatSession;
  try {
    session = JSON.parse(dataEl.textContent) as ChatSession;
  } catch {
    return;
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
    list.session = session;
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
