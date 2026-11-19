import type { HybridSearchHit, HybridSearchIndex, SearchQuery } from "@whatsappya/core";
import { VIEWER_BASE_CSS } from "../../styles/theme.js";

export interface AsyncSearchProvider {
  search(query: SearchQuery): Promise<readonly HybridSearchHit[]> | readonly HybridSearchHit[];
}

/**
 * `<wa-search>`
 * Apple Spotlight-inspired ⌘K / Ctrl+K search modal backed by HybridSearchIndex or a Web Worker proxy.
 * Supports keyboard navigation (ArrowUp, ArrowDown, Enter, Escape) and scoped filtering.
 */
export class WaSearch extends HTMLElement {
  #index: HybridSearchIndex | AsyncSearchProvider | null = null;
  #chapterId: string | undefined;
  #hits: readonly HybridSearchHit[] = [];
  #activeIndex = 0;
  #requestSeq = 0;

  #backdrop: HTMLDivElement;
  #input: HTMLInputElement;
  #resultsList: HTMLUListElement;
  #countLabel: HTMLSpanElement;
  #onGlobalKeyBound: (e: KeyboardEvent) => void;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        ${VIEWER_BASE_CSS}
        :host {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 9990;
        }
        :host([open]) { display: block; }
        .backdrop {
          position: fixed;
          inset: 0;
          background: rgba(11, 20, 26, 0.45);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 12vh;
        }
        .panel {
          width: min(640px, 92vw);
          background: var(--wa-surface);
          border: 1px solid var(--wa-border);
          border-radius: 16px;
          box-shadow: var(--wa-shadow-lg);
          overflow: hidden;
        }
        .search-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--wa-border);
        }
        input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          color: var(--wa-text-primary);
          font-size: 16px;
          font-family: inherit;
        }
        .count {
          font-size: 12px;
          color: var(--wa-text-secondary);
        }
        ul.results {
          list-style: none;
          margin: 0;
          padding: 6px;
          max-height: 380px;
          overflow-y: auto;
        }
        li.result {
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        li.result[aria-selected="true"], li.result:hover {
          background: rgba(0, 122, 255, 0.14);
        }
        .hit-sender {
          font-size: 12px;
          font-weight: 600;
          color: var(--wa-accent);
        }
        .hit-snippet {
          font-size: 13.5px;
          color: var(--wa-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .empty {
          padding: 20px;
          text-align: center;
          font-size: 13px;
          color: var(--wa-text-secondary);
        }
      </style>
      <div class="backdrop">
        <div class="panel" role="dialog" aria-modal="true" aria-label="Search messages">
          <div class="search-bar">
            <span aria-hidden="true">⌘</span>
            <input type="search" placeholder="Search messages, Arabic or English…" aria-label="Search query" />
            <span class="count"></span>
          </div>
          <ul class="results" role="listbox" aria-label="Search results"></ul>
        </div>
      </div>
    `;

    const backdrop = shadow.querySelector<HTMLDivElement>(".backdrop");
    const input = shadow.querySelector<HTMLInputElement>("input");
    const resultsList = shadow.querySelector<HTMLUListElement>(".results");
    const countLabel = shadow.querySelector<HTMLSpanElement>(".count");

    if (!backdrop || !input || !resultsList || !countLabel) {
      throw new Error("WaSearch shadow DOM failed");
    }

    this.#backdrop = backdrop;
    this.#input = input;
    this.#resultsList = resultsList;
    this.#countLabel = countLabel;

    this.#onGlobalKeyBound = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (this.hasAttribute("open")) this.close();
        else this.open();
      }
    };

    this.#backdrop.addEventListener("click", (e) => {
      if (e.target === this.#backdrop) this.close();
    });

    this.#input.addEventListener("input", () => this.#runSearch());
    this.#input.addEventListener("keydown", (e) => this.#onInputKey(e));
  }

  set searchIndex(index: HybridSearchIndex | AsyncSearchProvider | null) {
    this.#index = index;
    if (this.hasAttribute("open")) void this.#runSearch();
  }

  set chapterId(id: string | undefined) {
    this.#chapterId = id;
  }

  connectedCallback(): void {
    document.addEventListener("keydown", this.#onGlobalKeyBound);
  }

  disconnectedCallback(): void {
    document.removeEventListener("keydown", this.#onGlobalKeyBound);
  }

  open(): void {
    this.setAttribute("open", "");
    this.#input.focus();
    this.#input.select();
    this.#runSearch();
  }

  close(): void {
    this.removeAttribute("open");
    this.dispatchEvent(new CustomEvent("wa-search-close"));
  }

  async #runSearch(): Promise<void> {
    const queryText = this.#input.value.trim();
    const seq = ++this.#requestSeq;
    if (!this.#index || !queryText) {
      this.#hits = [];
      this.#countLabel.textContent = "";
      this.#resultsList.innerHTML = "";
      return;
    }

    const result = await this.#index.search({
      text: queryText,
      ...(this.#chapterId ? { chapterId: this.#chapterId } : {}),
      limit: 50,
    });
    if (seq !== this.#requestSeq) return; // Discard stale out-of-order worker responses

    this.#hits = result;
    this.#activeIndex = 0;
    this.#countLabel.textContent = `${this.#hits.length} results`;
    this.#renderResults();
  }

  #renderResults(): void {
    this.#resultsList.innerHTML = "";
    if (this.#hits.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "No matching messages";
      this.#resultsList.appendChild(empty);
      return;
    }

    for (let i = 0; i < this.#hits.length; i++) {
      const hit = this.#hits[i];
      if (!hit) continue;

      const li = document.createElement("li");
      li.className = "result";
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === this.#activeIndex ? "true" : "false");

      if (hit.sender) {
        const sender = document.createElement("div");
        sender.className = "hit-sender";
        sender.textContent = hit.sender;
        li.appendChild(sender);
      }

      const snippet = document.createElement("div");
      snippet.className = "hit-snippet";
      snippet.dir = "auto";
      snippet.textContent = hit.snippet;
      li.appendChild(snippet);

      li.addEventListener("click", () => this.#selectHit(hit));
      this.#resultsList.appendChild(li);
    }
  }

  #onInputKey(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (this.#hits.length > 0) {
        this.#activeIndex = (this.#activeIndex + 1) % this.#hits.length;
        this.#renderResults();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (this.#hits.length > 0) {
        this.#activeIndex = (this.#activeIndex - 1 + this.#hits.length) % this.#hits.length;
        this.#renderResults();
      }
    } else if (e.key === "Enter") {
      const hit = this.#hits[this.#activeIndex];
      if (hit) {
        e.preventDefault();
        this.#selectHit(hit);
      }
    }
  }

  #selectHit(hit: HybridSearchHit): void {
    this.dispatchEvent(
      new CustomEvent("wa-search-select", {
        bubbles: true,
        composed: true,
        detail: { hit },
      }),
    );
    this.close();
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wa-search")) {
  customElements.define("wa-search", WaSearch);
}
