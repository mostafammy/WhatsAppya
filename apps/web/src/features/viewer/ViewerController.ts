import type {
  ArchiveTree,
  ChatSession,
  ChatSummaryNode,
  FileSource,
  HybridSearchHit,
} from "@whatsappya/core";
import { StandaloneHtmlExporter } from "@whatsappya/exporter";
import {
  type BreadcrumbSegment,
  type LightboxItem,
  type WaBreadcrumbs,
  type WaLightbox,
  type WaMessageList,
  type WaSearch,
  type WaSplitView,
  countArchiveChats,
  defaultMediaLeases,
  unwrapSingleChat,
} from "@whatsappya/viewer";
import { STANDALONE_VIEWER_CSS, STANDALONE_VIEWER_JS } from "@whatsappya/viewer/standalone";
import { createConvertChat } from "../../app/container.js";
import { SearchWorkerClient } from "./SearchWorkerClient.js";

/**
 * Feature slice: orchestrates `<wa-split-view>`, `<wa-breadcrumbs>`, `<wa-message-list>`,
 * `<wa-search>` (backed by Web Worker search), `<wa-lightbox>`, and offline HTML export.
 */
export class ViewerController {
  readonly #searchClient = new SearchWorkerClient();
  readonly #sessionsCache = new Map<string, ChatSession>();
  #activeSession: ChatSession | null = null;
  #splitView!: WaSplitView;
  #breadcrumbs!: WaBreadcrumbs;
  #messageList!: WaMessageList;
  #search!: WaSearch;
  #lightbox!: WaLightbox;

  constructor(
    private readonly root: HTMLElement,
    private readonly files: FileSource,
    private readonly tree: ArchiveTree,
  ) {}

  async mount(): Promise<void> {
    this.root.innerHTML = `
      <style>
        .shell{display:flex;flex-direction:column;height:100vh;width:100vw;overflow:hidden}
        .topbar-actions{display:flex;align-items:center;gap:8px;padding:6px 16px;border-bottom:1px solid rgba(0,0,0,.08);background:var(--wa-surface,#fff);font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px}
        .export-btn{margin-left:auto;border:none;background:#007AFF;color:#fff;border-radius:8px;padding:6px 12px;font-weight:600;cursor:pointer}
        .reset-btn{border:1px solid rgba(0,0,0,.15);background:transparent;border-radius:8px;padding:5px 10px;cursor:pointer}
        wa-split-view{flex:1;min-height:0}
        .chat-pane{display:flex;flex-direction:column;height:100%;min-height:0}
        wa-message-list{flex:1;min-height:0}
      </style>
      <div class="shell">
        <div class="topbar-actions">
          <button class="reset-btn" type="button">← New Export</button>
          <span class="archive-title"></span>
          <button class="export-btn" type="button">Export Offline HTML</button>
        </div>
        <wa-split-view>
          <div class="chat-pane">
            <wa-breadcrumbs></wa-breadcrumbs>
            <wa-message-list></wa-message-list>
          </div>
        </wa-split-view>
        <wa-search></wa-search>
        <wa-lightbox></wa-lightbox>
      </div>
    `;

    const split = this.root.querySelector<WaSplitView>("wa-split-view");
    const crumbs = this.root.querySelector<WaBreadcrumbs>("wa-breadcrumbs");
    const list = this.root.querySelector<WaMessageList>("wa-message-list");
    const search = this.root.querySelector<WaSearch>("wa-search");
    const lightbox = this.root.querySelector<WaLightbox>("wa-lightbox");
    const titleEl = this.root.querySelector<HTMLSpanElement>(".archive-title");

    if (!split || !crumbs || !list || !search || !lightbox) {
      throw new Error("Viewer shell elements failed to mount");
    }

    this.#splitView = split;
    this.#breadcrumbs = crumbs;
    this.#messageList = list;
    this.#search = search;
    this.#lightbox = lightbox;

    this.#messageList.leases = defaultMediaLeases;
    this.#lightbox.leases = defaultMediaLeases;
    this.#splitView.tree = this.tree;

    if (this.#splitView.hasSidebar) {
      this.#breadcrumbs.setAttribute("has-sidebar", "");
    }
    if (titleEl) {
      titleEl.textContent = this.tree.root.name;
    }

    this.#bindEvents();

    const firstChat = unwrapSingleChat(this.tree.root) ?? this.#findFirstChat(this.tree);
    if (firstChat) {
      await this.#loadChat(firstChat, [{ id: "root", label: this.tree.root.name }]);
    }
  }

  #bindEvents(): void {
    this.#breadcrumbs.addEventListener("wa-search-open", () => this.#search.open());
    this.#breadcrumbs.addEventListener("wa-sidebar-toggle", () => this.#splitView.toggleSidebar());

    this.#splitView.addEventListener("wa-chat-select", (e) => {
      const detail = (e as CustomEvent<{ chat: ChatSummaryNode }>).detail;
      void this.#loadChat(detail.chat, [
        { id: "root", label: this.tree.root.name },
        { id: detail.chat.id, label: detail.chat.contactName || detail.chat.title },
      ]);
    });

    this.#search.addEventListener("wa-search-select", (e) => {
      const hit = (e as CustomEvent<{ hit: HybridSearchHit }>).detail.hit;
      this.#messageList.scrollToMessage(hit.messageId);
    });

    this.#messageList.addEventListener("wa-media-open", (e) => {
      const item = (e as CustomEvent<{ item: LightboxItem }>).detail.item;
      void this.#lightbox.open(item);
    });

    this.root.querySelector(".export-btn")?.addEventListener("click", () => this.#exportHtml());
    this.root.querySelector(".reset-btn")?.addEventListener("click", () => {
      this.#searchClient.dispose();
      defaultMediaLeases.disposeAll();
      this.root.dispatchEvent(new CustomEvent("wa-viewer-reset", { bubbles: true }));
    });
  }

  async #loadChat(chat: ChatSummaryNode, segments: readonly BreadcrumbSegment[]): Promise<void> {
    let session = this.#sessionsCache.get(chat.id);
    if (!session) {
      const res = await createConvertChat().execute({
        files: this.files,
        chatPath: chat.path,
      });
      if (!res.ok) return;
      session = res.value;
      this.#sessionsCache.set(chat.id, session);
      void this.#searchClient.indexSession(session, chat.id);
    }

    this.#activeSession = session;
    this.#splitView.activeChatId = chat.id;
    this.#messageList.session = session;
    this.#search.searchIndex = this.#searchClient;
    this.#search.chapterId = countArchiveChats(this.tree.root) > 1 ? chat.id : undefined;
    this.#breadcrumbs.segments =
      segments.length > 0 ? segments : [{ id: chat.id, label: session.contactName }];
  }

  #findFirstChat(tree: ArchiveTree): ChatSummaryNode | null {
    const queue = [tree.root];
    while (queue.length > 0) {
      const folder = queue.shift();
      if (!folder) continue;
      if (folder.chats[0]) return folder.chats[0];
      queue.push(...folder.children);
    }
    return null;
  }

  #exportHtml(): void {
    if (!this.#activeSession) return;
    const exporter = new StandaloneHtmlExporter({
      viewerJs: STANDALONE_VIEWER_JS,
      viewerCss: STANDALONE_VIEWER_CSS,
    });
    const html = exporter.build(this.#activeSession);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.#activeSession.contactName || "chat"}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
