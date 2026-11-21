import type {
  ArchiveFolder,
  ArchiveTree,
  ChatSession,
  ChatSummaryNode,
  FileSource,
  HybridSearchHit,
} from "@whatsappya/core";
import { StandaloneHtmlExporter } from "@whatsappya/exporter";
import {
  type LightboxItem,
  type WaLightbox,
  type WaMessageList,
  type WaSearch,
  type WaSplitView,
  collectMediaGallery,
  countArchiveChats,
  defaultMediaLeases,
  unwrapSingleChat,
} from "@whatsappya/viewer";
import { STANDALONE_VIEWER_CSS, STANDALONE_VIEWER_JS } from "@whatsappya/viewer/standalone";
import { createConvertChat } from "../../app/container.js";
import { openStatsModal } from "../stats/StatsModal.js";
import { SearchWorkerClient } from "./SearchWorkerClient.js";

export const ACTIVE_CHAT_STORAGE_KEY = "whatsappya:active-chat-id";

/**
 * Feature slice: single Cupertino frosted-glass header + `<wa-split-view>` + `<wa-message-list>`
 * + `<wa-search>` (Web Worker) + `<wa-lightbox>` + Insights + Offline HTML export.
 */
export class ViewerController {
  readonly #searchClient = new SearchWorkerClient();
  readonly #sessionsCache = new Map<string, ChatSession>();
  #activeSession: ChatSession | null = null;
  #activeGallery: LightboxItem[] = [];
  #exportResetTimer: ReturnType<typeof setTimeout> | null = null;
  #splitView!: WaSplitView;
  #messageList!: WaMessageList;
  #search!: WaSearch;
  #lightbox!: WaLightbox;
  #avatarEl!: HTMLDivElement;
  #titleEl!: HTMLHeadingElement;
  #subtitleEl!: HTMLDivElement;
  #sidebarBtn!: HTMLButtonElement;

  constructor(
    private readonly root: HTMLElement,
    private readonly files: FileSource,
    private readonly tree: ArchiveTree,
  ) {}

  async mount(): Promise<void> {
    this.root.innerHTML = `
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%}
        .shell{
          display:flex;
          flex-direction:column;
          height:100vh;
          width:100vw;
          overflow:hidden;
          background:#efeae2;
          font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","SF Arabic",sans-serif;
          color:#111b21;
        }
        @media(prefers-color-scheme:dark){
          .shell{background:#0b141a;color:#e9edef}
        }
        .chat-header{
          height:64px;
          padding:0 18px;
          display:flex;
          align-items:center;
          gap:12px;
          background:rgba(255,255,255,.88);
          backdrop-filter:blur(20px);
          -webkit-backdrop-filter:blur(20px);
          border-bottom:1px solid rgba(0,0,0,.08);
          flex-shrink:0;
          z-index:20;
        }
        @media(prefers-color-scheme:dark){
          .chat-header{background:rgba(17,27,33,.9);border-bottom-color:rgba(255,255,255,.08)}
        }
        .icon-btn{
          border:none;
          background:rgba(120,120,128,.12);
          color:inherit;
          height:34px;
          padding:0 11px;
          border-radius:10px;
          font-family:inherit;
          font-size:13px;
          font-weight:600;
          cursor:pointer;
          display:inline-flex;
          align-items:center;
          gap:6px;
          transition:background 120ms,transform 120ms;
        }
        .icon-btn:hover{background:rgba(120,120,128,.2)}
        .icon-btn:active{transform:scale(.96)}
        .icon-btn.primary{background:#007AFF;color:#fff}
        .icon-btn.primary:hover{filter:brightness(1.08);background:#007AFF}
        .sidebar-btn{display:none}
        .sidebar-btn.visible{display:inline-flex}
        .header-avatar{
          width:40px;
          height:40px;
          border-radius:50%;
          background:linear-gradient(135deg,#007aff,#00c6ff);
          color:#fff;
          font-size:17px;
          font-weight:700;
          display:flex;
          align-items:center;
          justify-content:center;
          flex-shrink:0;
          box-shadow:0 2px 8px rgba(0,122,255,.28);
        }
        .header-info{flex:1;min-width:0}
        .header-info h1{
          font-size:16px;
          font-weight:600;
          letter-spacing:-.35px;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .header-info .subtitle{
          font-size:12.5px;
          color:#667781;
          margin-top:1px;
        }
        @media(prefers-color-scheme:dark){
          .header-info .subtitle{color:#8696a0}
        }
        .header-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
        kbd{
          font-family:inherit;
          font-size:11px;
          padding:1px 5px;
          border-radius:5px;
          background:rgba(0,0,0,.08);
        }
        @media(prefers-color-scheme:dark){
          kbd{background:rgba(255,255,255,.12)}
        }
        wa-split-view{flex:1;min-height:0}
        wa-message-list{height:100%;width:100%}
      </style>
      <div class="shell">
        <header class="chat-header">
          <button class="icon-btn sidebar-btn" type="button" aria-label="Toggle chats sidebar">☰</button>
          <button class="icon-btn reset-btn" type="button" title="Open another export">← Open</button>
          <div class="header-avatar" aria-hidden="true">💬</div>
          <div class="header-info">
            <h1 dir="auto">WhatsApp Chat</h1>
            <div class="subtitle">Loading…</div>
          </div>
          <div class="header-actions">
            <button class="icon-btn search-btn" type="button" aria-label="Search messages">
              <span>Search</span><kbd>⌘K</kbd>
            </button>
            <button class="icon-btn stats-btn" type="button">Insights</button>
            <button class="icon-btn primary export-btn" type="button">Export HTML</button>
          </div>
        </header>
        <wa-split-view>
          <wa-message-list></wa-message-list>
        </wa-split-view>
        <wa-search></wa-search>
        <wa-lightbox></wa-lightbox>
      </div>
    `;

    const split = this.root.querySelector<WaSplitView>("wa-split-view");
    const list = this.root.querySelector<WaMessageList>("wa-message-list");
    const search = this.root.querySelector<WaSearch>("wa-search");
    const lightbox = this.root.querySelector<WaLightbox>("wa-lightbox");
    const avatar = this.root.querySelector<HTMLDivElement>(".header-avatar");
    const title = this.root.querySelector<HTMLHeadingElement>(".header-info h1");
    const subtitle = this.root.querySelector<HTMLDivElement>(".header-info .subtitle");
    const sidebarBtn = this.root.querySelector<HTMLButtonElement>(".sidebar-btn");

    if (!split || !list || !search || !lightbox || !avatar || !title || !subtitle || !sidebarBtn) {
      throw new Error("Viewer shell elements failed to mount");
    }

    this.#splitView = split;
    this.#messageList = list;
    this.#search = search;
    this.#lightbox = lightbox;
    this.#avatarEl = avatar;
    this.#titleEl = title;
    this.#subtitleEl = subtitle;
    this.#sidebarBtn = sidebarBtn;

    this.#messageList.leases = defaultMediaLeases;
    this.#lightbox.leases = defaultMediaLeases;
    this.#splitView.tree = this.tree;

    if (this.#splitView.hasSidebar) {
      this.#sidebarBtn.classList.add("visible");
    }

    this.#bindEvents();

    const savedChatId = this.#readActiveChatId();
    const initialChat =
      (savedChatId ? this.#findChatById(this.tree.root, savedChatId) : null) ??
      unwrapSingleChat(this.tree.root) ??
      this.#findFirstChat(this.tree);
    if (initialChat) {
      await this.#loadChat(initialChat);
    }
  }

  #bindEvents(): void {
    this.#sidebarBtn.addEventListener("click", () => this.#splitView.toggleSidebar());
    this.root.querySelector(".search-btn")?.addEventListener("click", () => this.#search.open());

    this.#splitView.addEventListener("wa-chat-select", (e) => {
      const detail = (e as CustomEvent<{ chat: ChatSummaryNode }>).detail;
      void this.#loadChat(detail.chat);
    });

    this.#search.addEventListener("wa-search-select", (e) => {
      const hit = (e as CustomEvent<{ hit: HybridSearchHit }>).detail.hit;
      this.#messageList.scrollToMessage(hit.messageId);
    });

    this.#messageList.addEventListener("wa-media-open", (e) => {
      const item = (e as CustomEvent<{ item: LightboxItem }>).detail.item;
      if (item.kind === "pdf") {
        void this.#lightbox.open(item);
      } else {
        void this.#lightbox.open(item, this.#activeGallery);
      }
    });

    this.root.querySelector(".stats-btn")?.addEventListener("click", () => {
      if (this.#activeSession) openStatsModal(this.#activeSession);
    });
    this.root
      .querySelector(".export-btn")
      ?.addEventListener("click", () => void this.#exportHtml());
    this.root.querySelector(".reset-btn")?.addEventListener("click", () => {
      if (this.#exportResetTimer) clearTimeout(this.#exportResetTimer);
      this.#searchClient.dispose();
      defaultMediaLeases.disposeAll();
      this.root.dispatchEvent(new CustomEvent("wa-viewer-reset", { bubbles: true }));
    });
  }

  async #loadChat(chat: ChatSummaryNode): Promise<void> {
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

    this.#saveActiveChatId(chat.id);
    this.#activeSession = session;
    this.#activeGallery = collectMediaGallery(session);
    this.#splitView.activeChatId = chat.id;
    this.#messageList.session = session;
    this.#search.searchIndex = this.#searchClient;
    this.#search.chapterId = countArchiveChats(this.tree.root) > 1 ? chat.id : undefined;

    const displayName = session.contactName || session.title;
    this.#titleEl.textContent = displayName;
    this.#subtitleEl.textContent = `${session.messages.length.toLocaleString()} messages`;
    const initial = Array.from(displayName.trim())[0];
    this.#avatarEl.textContent = initial ? initial.toUpperCase() : "💬";
  }

  #findChatById(root: ArchiveFolder, id: string): ChatSummaryNode | null {
    const queue = [root];
    while (queue.length > 0) {
      const folder = queue.shift();
      if (!folder) continue;
      for (const chat of folder.chats) {
        if (chat.id === id) return chat;
      }
      queue.push(...folder.children);
    }
    return null;
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

  #readActiveChatId(): string | null {
    try {
      return sessionStorage.getItem(ACTIVE_CHAT_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  #saveActiveChatId(chatId: string): void {
    try {
      sessionStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, chatId);
    } catch {
      // Ignore environments without sessionStorage
    }
  }

  async #exportHtml(): Promise<void> {
    if (!this.#activeSession) return;
    const exportBtn = this.root.querySelector<HTMLButtonElement>(".export-btn");
    if (exportBtn?.disabled) return;

    if (this.#exportResetTimer) {
      clearTimeout(this.#exportResetTimer);
      this.#exportResetTimer = null;
    }
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.textContent = "Exporting…";
    }

    let feedbackLabel = "Export HTML";
    try {
      const exporter = new StandaloneHtmlExporter({
        viewerJs: STANDALONE_VIEWER_JS,
        viewerCss: STANDALONE_VIEWER_CSS,
      });
      const result = await exporter.buildWithMedia(this.#activeSession, this.files);
      const blob = new Blob([result.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${this.#activeSession.contactName || "chat"}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      feedbackLabel = result.skippedCount > 0 ? "Exported (large files skipped)" : "Exported ✓";
    } catch {
      feedbackLabel = "Export failed";
    } finally {
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.textContent = feedbackLabel;
        if (feedbackLabel !== "Export HTML") {
          this.#exportResetTimer = setTimeout(() => {
            exportBtn.textContent = "Export HTML";
            this.#exportResetTimer = null;
          }, 2000);
        }
      }
    }
  }
}
