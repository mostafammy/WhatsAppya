import type { ArchiveFolder, ArchiveTree } from "@whatsappya/core";
import { VIEWER_BASE_CSS } from "../../styles/theme.js";
import { countArchiveChats } from "./archiveHelpers.js";

export { countArchiveChats, unwrapSingleChat } from "./archiveHelpers.js";

/**
 * `<wa-split-view>`
 * Adaptive 2-column / 3-column layout shell.
 * - When `sessionCount <= 1`: sidebar is hidden cleanly, giving 100% width to `<slot>`.
 * - When `sessionCount > 1`: renders a collapsible Cupertino navigation sidebar
 *   for Blocks / Subjects / Chapters and dispatches `wa-chat-select` on click.
 */
export class WaSplitView extends HTMLElement {
  #tree: ArchiveTree | null = null;
  #activeChatId: string | null = null;
  #sidebar: HTMLElement;
  #treeContainer: HTMLDivElement;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        ${VIEWER_BASE_CSS}
        :host {
          display: flex;
          height: 100%;
          width: 100%;
          overflow: hidden;
          background: var(--wa-canvas);
        }
        aside.sidebar {
          width: 280px;
          flex-shrink: 0;
          background: var(--wa-surface);
          border-right: 1px solid var(--wa-border);
          overflow-y: auto;
          padding: 12px 8px;
          box-sizing: border-box;
          display: none;
        }
        :host([has-sidebar]) aside.sidebar {
          display: block;
        }
        :host([sidebar-collapsed]) aside.sidebar {
          display: none;
        }
        .main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        .folder-label {
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--wa-text-secondary);
          padding: 10px 10px 4px;
        }
        .chat-item {
          width: 100%;
          text-align: start;
          border: none;
          background: transparent;
          color: var(--wa-text-primary);
          padding: 8px 10px;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-family: inherit;
        }
        .chat-item:hover { background: var(--wa-border); }
        .chat-item[aria-current="true"] {
          background: rgba(0, 122, 255, 0.14);
          color: var(--wa-accent);
        }
        .chat-title {
          font-size: 13.5px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chat-meta {
          font-size: 11.5px;
          color: var(--wa-text-secondary);
        }
        .nested {
          padding-left: 10px;
        }
      </style>
      <aside class="sidebar" aria-label="Archive navigation">
        <div class="tree"></div>
      </aside>
      <div class="main">
        <slot></slot>
      </div>
    `;

    const sidebar = shadow.querySelector<HTMLElement>("aside.sidebar");
    const treeContainer = shadow.querySelector<HTMLDivElement>(".tree");
    if (!sidebar || !treeContainer) throw new Error("WaSplitView shadow DOM failed");
    this.#sidebar = sidebar;
    this.#treeContainer = treeContainer;
  }

  get tree(): ArchiveTree | null {
    return this.#tree;
  }

  set tree(value: ArchiveTree | null) {
    this.#tree = value;
    this.#render();
  }

  get activeChatId(): string | null {
    return this.#activeChatId;
  }

  set activeChatId(id: string | null) {
    this.#activeChatId = id;
    this.#render();
  }

  get hasSidebar(): boolean {
    return this.hasAttribute("has-sidebar");
  }

  toggleSidebar(): void {
    this.toggleAttribute("sidebar-collapsed");
  }

  #render(): void {
    this.#treeContainer.innerHTML = "";
    if (!this.#tree) {
      this.removeAttribute("has-sidebar");
      return;
    }

    const totalChats = countArchiveChats(this.#tree.root);
    if (totalChats <= 1) {
      this.removeAttribute("has-sidebar");
      return;
    }

    this.setAttribute("has-sidebar", "");
    this.#renderFolder(this.#tree.root, [], this.#treeContainer, 0);
  }

  #renderFolder(
    folder: ArchiveFolder,
    ancestors: readonly ArchiveFolder[],
    parentEl: HTMLElement,
    depth: number,
  ): void {
    const trail = [...ancestors, folder];
    if (depth > 0 && folder.name) {
      const label = document.createElement("div");
      label.className = "folder-label";
      label.dir = "auto";
      label.textContent = folder.name;
      parentEl.appendChild(label);
    }

    for (const chat of folder.chats) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-item";
      btn.setAttribute("aria-current", chat.id === this.#activeChatId ? "true" : "false");

      const title = document.createElement("div");
      title.className = "chat-title";
      title.dir = "auto";
      title.textContent = chat.contactName || chat.title;

      const meta = document.createElement("div");
      meta.className = "chat-meta";
      meta.textContent = `${chat.messageCount.toLocaleString()} messages`;

      btn.appendChild(title);
      btn.appendChild(meta);
      btn.addEventListener("click", () => {
        this.#activeChatId = chat.id;
        this.#render();
        this.dispatchEvent(
          new CustomEvent("wa-chat-select", {
            bubbles: true,
            composed: true,
            detail: { chat, breadcrumbs: trail },
          }),
        );
      });
      parentEl.appendChild(btn);
    }

    for (const child of folder.children) {
      const group = document.createElement("div");
      if (depth > 0) group.className = "nested";
      this.#renderFolder(child, trail, group, depth + 1);
      parentEl.appendChild(group);
    }
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wa-split-view")) {
  customElements.define("wa-split-view", WaSplitView);
}
