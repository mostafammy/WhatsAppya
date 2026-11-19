import { type ChatMessage, type ChatSession, LinkStage } from "@whatsappya/core";
import { type MediaLeaseManager, defaultMediaLeases } from "../../media/MediaLeaseManager.js";
import { VIEWER_BASE_CSS } from "../../styles/theme.js";
import type { LightboxItem } from "../lightbox/WaLightbox.js";
import type { WaSticker } from "../sticker/WaSticker.js";
import type { WaVoiceNote } from "../voice-note/WaVoiceNote.js";
import { FenwickTree } from "./FenwickTree.js";

const OVERSCAN = 8;
const DEFAULT_ROW_HEIGHT = 76;
const MAX_CSS_HEIGHT = 10_000_000;

export type RowArchetype = "text" | "audio" | "media" | "sticker" | "system";

function classifyArchetype(msg: ChatMessage): RowArchetype {
  if (msg.kind === "system" || msg.kind === "call") return "system";
  const att = msg.attachment;
  if (!att || att.isOmitted || att.kind === "omitted") return "text";
  if (att.kind === "audio") return "audio";
  if (att.kind === "sticker") return "sticker";
  if (att.kind === "image" || att.kind === "video") return "media";
  return "text";
}

interface ActiveRowEntry {
  readonly el: HTMLDivElement;
  readonly archetype: RowArchetype;
}

/**
 * `<wa-message-list>`
 * High-performance virtualized chat list for 50,000+ (and >150,000) messages.
 * - FenwickTree for O(log N) variable-height scroll offsets & binary search.
 * - Archetype-typed DOM pools (`text`, `audio`, `media`, `sticker`, `system`) with CSS containment.
 * - Single-rAF batched ResizeObserver with above-viewport scroll-jump compensation.
 * - External sticky date-header overlay pill (works cleanly inside translate3d virtualization).
 * - Automatic virtual coordinate scaling above 10,000,000 px.
 */
export class WaMessageList extends HTMLElement {
  #session: ChatSession | null = null;
  #messages: readonly ChatMessage[] = [];
  #tree: FenwickTree = new FenwickTree(0, DEFAULT_ROW_HEIGHT);
  #leases: MediaLeaseManager = defaultMediaLeases;

  #scroller: HTMLDivElement;
  #canvas: HTMLDivElement;
  #stickyDate: HTMLDivElement;
  #activeRows = new Map<number, ActiveRowEntry>();
  #pools = new Map<RowArchetype, HTMLDivElement[]>([
    ["text", []],
    ["audio", []],
    ["media", []],
    ["sticker", []],
    ["system", []],
  ]);
  #rowIndexLookup = new WeakMap<Element, number>();
  #pendingHeights = new Map<number, number>();
  #resizeObserver: ResizeObserver | null = null;
  #rafId = 0;
  #measureRafId = 0;
  #highlightedId: string | null = null;
  #scale = 1;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        ${VIEWER_BASE_CSS}
        :host {
          display: block;
          position: relative;
          height: 100%;
          width: 100%;
          background: var(--wa-canvas);
          overflow: hidden;
        }
        .sticky-date {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 5;
          pointer-events: none;
          background: var(--wa-date-bg);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: var(--wa-text-secondary);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.05px;
          padding: 5px 14px;
          border-radius: 12px;
          box-shadow: var(--wa-shadow-sm);
          border: 1px solid var(--wa-border);
          opacity: 0;
          transition: opacity var(--wa-duration-fast) var(--wa-spring);
        }
        .sticky-date.visible { opacity: 1; }
        .scroller {
          height: 100%;
          width: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
          background-color: var(--wa-canvas);
          background-image: radial-gradient(rgba(0, 0, 0, 0.035) 1px, transparent 1px);
          background-size: 20px 20px;
          -webkit-overflow-scrolling: touch;
        }
        @media (prefers-color-scheme: dark) {
          .scroller {
            background-image: radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          }
        }
        .canvas {
          position: relative;
          width: 100%;
          max-width: 980px;
          margin: 0 auto;
        }
        .row {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: 4px 5%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          contain: layout style;
          will-change: transform;
        }
        .row.sent { align-items: flex-end; }
        .row.received { align-items: flex-start; }
        .row.system, .row.call { align-items: center; }
        .bubble {
          position: relative;
          max-width: min(72%, 580px);
          min-width: 96px;
          padding: 7px 11px 8px;
          border-radius: 14px;
          box-shadow: var(--wa-shadow-sm);
          background: var(--wa-bubble-received);
          word-wrap: break-word;
          overflow-wrap: anywhere;
          transition: box-shadow var(--wa-duration-base) var(--wa-spring);
        }
        .row.sent .bubble {
          background: var(--wa-bubble-sent);
          border-bottom-right-radius: 3px;
        }
        .row.sent .bubble::after {
          content: "";
          position: absolute;
          right: -6px;
          bottom: 0;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 0 10px 8px;
          border-color: transparent transparent var(--wa-bubble-sent) transparent;
        }
        .row.received .bubble {
          border-bottom-left-radius: 3px;
        }
        .row.received .bubble::after {
          content: "";
          position: absolute;
          left: -6px;
          bottom: 0;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 8px 10px 0;
          border-color: transparent var(--wa-bubble-received) transparent transparent;
        }
        .row.highlighted .bubble {
          box-shadow: 0 0 0 2.5px var(--wa-accent), var(--wa-shadow-lg);
        }
        .sender {
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: -0.1px;
          color: var(--wa-sender-color);
          margin-bottom: 3px;
        }
        .text {
          font-size: 14.5px;
          line-height: 1.42;
          letter-spacing: -0.15px;
          white-space: pre-wrap;
          unicode-bidi: isolate;
        }
        .text.deleted {
          font-style: italic;
          color: var(--wa-text-secondary);
        }
        .meta {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
          margin-top: 4px;
          font-size: 11px;
          color: var(--wa-text-secondary);
        }
        .system-pill {
          background: var(--wa-system-bg);
          color: var(--wa-system-text);
          border: 1px solid var(--wa-border);
          font-size: 12.5px;
          font-weight: 500;
          padding: 6px 14px;
          border-radius: 10px;
          box-shadow: var(--wa-shadow-sm);
          text-align: center;
          max-width: 82%;
        }
        .media-thumb {
          margin-top: 4px;
          margin-bottom: 4px;
          border-radius: 10px;
          overflow: hidden;
          cursor: pointer;
          max-width: 280px;
          border: 1px solid var(--wa-border);
          background: rgba(0, 0, 0, 0.04);
        }
        .media-thumb img {
          display: block;
          width: 100%;
          max-height: 260px;
          object-fit: cover;
        }
        .file-chip, .link-card {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          margin-top: 6px;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.05);
          border: 1px solid var(--wa-border);
          font-size: 12.5px;
          text-decoration: none;
          color: inherit;
        }
        .omitted-note {
          font-size: 12.5px;
          font-style: italic;
          color: var(--wa-text-secondary);
        }
      </style>
      <div class="sticky-date" aria-hidden="true"></div>
      <div class="scroller" role="log" aria-label="Chat messages">
        <div class="canvas"></div>
      </div>
    `;

    const scroller = shadow.querySelector<HTMLDivElement>(".scroller");
    const canvas = shadow.querySelector<HTMLDivElement>(".canvas");
    const stickyDate = shadow.querySelector<HTMLDivElement>(".sticky-date");
    if (!scroller || !canvas || !stickyDate) throw new Error("WaMessageList shadow DOM failed");
    this.#scroller = scroller;
    this.#canvas = canvas;
    this.#stickyDate = stickyDate;

    this.#scroller.addEventListener("scroll", () => this.#scheduleRender(), { passive: true });

    if (typeof ResizeObserver !== "undefined") {
      this.#resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const idx = this.#rowIndexLookup.get(entry.target);
          if (idx === undefined) continue;
          const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
          if (height > 0) {
            this.#pendingHeights.set(idx, Math.ceil(height));
          }
        }
        if (this.#pendingHeights.size > 0 && !this.#measureRafId) {
          this.#measureRafId = requestAnimationFrame(() => this.#flushMeasuredHeights());
        }
      });
    }
  }

  get session(): ChatSession | null {
    return this.#session;
  }

  set session(value: ChatSession | null) {
    this.#session = value;
    this.#messages = value?.messages ?? [];
    this.#resetVirtualState();
  }

  set leases(manager: MediaLeaseManager) {
    this.#leases = manager;
  }

  get visibleRange(): { start: number; end: number } {
    return this.#computeRange();
  }

  get mountedRowCount(): number {
    return this.#activeRows.size;
  }

  disconnectedCallback(): void {
    if (this.#rafId) cancelAnimationFrame(this.#rafId);
    if (this.#measureRafId) cancelAnimationFrame(this.#measureRafId);
    this.#resizeObserver?.disconnect();
    this.#clearActiveRows();
  }

  scrollToMessage(target: string | number): void {
    const idx =
      typeof target === "number" ? target : this.#messages.findIndex((m) => m.id === target);
    if (idx < 0 || idx >= this.#messages.length) return;

    const msg = this.#messages[idx];
    this.#highlightedId = msg?.id ?? null;
    const virtualTop = this.#tree.prefixSum(idx);
    this.#scroller.scrollTop = Math.max(0, Math.round(virtualTop * this.#scale) - 64);
    this.#render();
  }

  #updateCanvasHeight(): void {
    const total = this.#tree.totalHeight();
    this.#scale = total > MAX_CSS_HEIGHT ? MAX_CSS_HEIGHT / total : 1;
    const cssHeight = Math.min(total, MAX_CSS_HEIGHT);
    this.#canvas.style.height = `${cssHeight}px`;
  }

  #resetVirtualState(): void {
    this.#clearActiveRows();
    this.#pendingHeights.clear();
    this.#tree = new FenwickTree(this.#messages.length, DEFAULT_ROW_HEIGHT);
    this.#updateCanvasHeight();
    this.#scroller.scrollTop = 0;
    this.#render();
  }

  #clearActiveRows(): void {
    for (const entry of this.#activeRows.values()) {
      this.#resizeObserver?.unobserve(entry.el);
      entry.el.remove();
      this.#pools.get(entry.archetype)?.push(entry.el);
    }
    this.#activeRows.clear();
  }

  #scheduleRender(): void {
    if (this.#rafId) return;
    this.#rafId = requestAnimationFrame(() => {
      this.#rafId = 0;
      this.#render();
    });
  }

  #computeRange(): { start: number; end: number; firstVisible: number } {
    const total = this.#messages.length;
    if (total === 0) return { start: 0, end: -1, firstVisible: -1 };

    const virtualTop = this.#scroller.scrollTop / this.#scale;
    const viewport = (this.#scroller.clientHeight || 800) / this.#scale;

    const firstVisible = this.#tree.findIndexByOffset(virtualTop);
    const lastVisible = this.#tree.findIndexByOffset(virtualTop + viewport);

    return {
      start: Math.max(0, firstVisible - OVERSCAN),
      end: Math.min(total - 1, lastVisible + OVERSCAN),
      firstVisible,
    };
  }

  #render(): void {
    const { start, end, firstVisible } = this.#computeRange();

    // Update external sticky date overlay pill
    const topMsg = firstVisible >= 0 ? this.#messages[firstVisible] : undefined;
    if (topMsg?.rawDate) {
      this.#stickyDate.textContent = topMsg.rawDate;
      this.#stickyDate.classList.add("visible");
    } else {
      this.#stickyDate.classList.remove("visible");
    }

    // Recycle rows outside visible window back into their exact archetype pool
    for (const [idx, entry] of this.#activeRows) {
      if (idx < start || idx > end) {
        this.#resizeObserver?.unobserve(entry.el);
        entry.el.remove();
        this.#pools.get(entry.archetype)?.push(entry.el);
        this.#activeRows.delete(idx);
      }
    }

    if (end < start) return;

    const fragment = document.createDocumentFragment();
    for (let i = start; i <= end; i++) {
      let active = this.#activeRows.get(i);
      const msg = this.#messages[i];
      if (!msg) continue;

      if (!active) {
        const archetype = classifyArchetype(msg);
        const row = this.#pools.get(archetype)?.pop() ?? document.createElement("div");
        this.#populateRow(row, msg, i);
        active = { el: row, archetype };
        this.#activeRows.set(i, active);
        this.#rowIndexLookup.set(row, i);
        this.#resizeObserver?.observe(row);
        fragment.appendChild(row);
      }

      const y = Math.round(this.#tree.prefixSum(i) * this.#scale);
      active.el.style.transform = `translate3d(0, ${y}px, 0)`;
      active.el.classList.toggle("highlighted", msg.id === this.#highlightedId);
    }

    if (fragment.childNodes.length > 0) {
      this.#canvas.appendChild(fragment);
    }
  }

  #flushMeasuredHeights(): void {
    this.#measureRafId = 0;
    const prevScrollTop = this.#scroller.scrollTop;
    const firstVisible = this.#tree.findIndexByOffset(prevScrollTop / this.#scale);

    let changed = false;
    let deltaAboveViewport = 0;

    for (const [idx, h] of this.#pendingHeights) {
      const prevH = this.#tree.getHeight(idx);
      const delta = h - prevH;
      if (Math.abs(delta) >= 1) {
        this.#tree.update(idx, h);
        changed = true;
        if (idx < firstVisible) {
          deltaAboveViewport += delta;
        }
      }
    }
    this.#pendingHeights.clear();

    if (changed) {
      this.#updateCanvasHeight();
      if (deltaAboveViewport !== 0 && prevScrollTop > 0) {
        this.#scroller.scrollTop = Math.max(0, prevScrollTop + deltaAboveViewport * this.#scale);
      }
      for (const [idx, entry] of this.#activeRows) {
        const y = Math.round(this.#tree.prefixSum(idx) * this.#scale);
        entry.el.style.transform = `translate3d(0, ${y}px, 0)`;
      }
    }
  }

  #populateRow(row: HTMLDivElement, msg: ChatMessage, index: number): void {
    row.innerHTML = "";
    row.className = "row";
    row.dataset.index = String(index);
    row.dataset.id = msg.id;

    if (msg.kind === "system" || msg.kind === "call") {
      row.classList.add(msg.kind);
      const pill = document.createElement("div");
      pill.className = "system-pill";
      pill.dir = "auto";
      pill.textContent = msg.kind === "call" ? `📞 ${msg.text}` : msg.text;
      row.appendChild(pill);
      return;
    }

    row.classList.add(msg.direction);
    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (msg.direction === "received" && msg.sender) {
      const senderEl = document.createElement("div");
      senderEl.className = "sender";
      senderEl.dir = "auto";
      senderEl.textContent = msg.sender;
      bubble.appendChild(senderEl);
    }

    if (msg.attachment) {
      bubble.appendChild(this.#renderAttachment(msg));
    }

    if (msg.text) {
      const textEl = document.createElement("div");
      textEl.className = msg.isDeleted ? "text deleted" : "text";
      textEl.dir = "auto";
      textEl.textContent = msg.text;
      bubble.appendChild(textEl);

      const links = LinkStage.extractUrls(msg.text);
      for (const link of links) {
        const card = document.createElement("a");
        card.className = "link-card";
        card.href = link.rawUrl;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
        card.textContent = `${link.icon} ${link.title}`;
        bubble.appendChild(card);
      }
    }

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = msg.isEdited ? `Edited · ${msg.rawTime}` : msg.rawTime;
    bubble.appendChild(meta);

    row.appendChild(bubble);
  }

  #renderAttachment(msg: ChatMessage): HTMLElement {
    const att = msg.attachment;
    if (!att) return document.createElement("span");

    if (att.isOmitted || att.kind === "omitted") {
      const note = document.createElement("div");
      note.className = "omitted-note";
      note.textContent = att.fileName;
      return note;
    }

    if (att.kind === "audio") {
      const voice = document.createElement("wa-voice-note") as WaVoiceNote;
      voice.messageId = msg.id;
      voice.fileName = att.fileName;
      voice.mimeType = att.mimeType;
      if (att.durationSeconds !== undefined) {
        voice.setAttribute("duration", String(att.durationSeconds));
      }
      if (att.waveformPeaks) {
        voice.waveformPeaks = att.waveformPeaks;
      }
      return voice;
    }

    if (att.kind === "sticker") {
      const sticker = document.createElement("wa-sticker") as WaSticker;
      sticker.leases = this.#leases;
      sticker.fileName = att.fileName;
      sticker.mimeType = att.mimeType;
      return sticker;
    }

    if (att.kind === "image" || att.kind === "video") {
      const thumb = document.createElement("div");
      thumb.className = "media-thumb";
      thumb.setAttribute("role", "button");
      thumb.tabIndex = 0;
      thumb.setAttribute("aria-label", `Open ${att.kind} ${att.fileName}`);

      const label = document.createElement("div");
      label.className = "file-chip";
      label.style.marginTop = "0";
      label.textContent = att.kind === "video" ? `🎬 ${att.fileName}` : `🖼️ ${att.fileName}`;
      thumb.appendChild(label);

      if (att.kind === "image") {
        void this.#leases.acquire(att.fileName, att.mimeType).then((url) => {
          if (!thumb.isConnected) {
            this.#leases.release(att.fileName);
            return;
          }
          const img = document.createElement("img");
          img.src = url;
          img.alt = msg.text || att.fileName;
          img.loading = "lazy";
          thumb.innerHTML = "";
          thumb.appendChild(img);
        });
      }

      const openHandler = () => {
        const item: LightboxItem = {
          fileName: att.fileName,
          mimeType: att.mimeType,
          kind: att.kind === "video" ? "video" : "image",
          ...(msg.text ? { caption: msg.text } : {}),
        };
        this.dispatchEvent(
          new CustomEvent("wa-media-open", {
            bubbles: true,
            composed: true,
            detail: { item },
          }),
        );
      };

      thumb.addEventListener("click", openHandler);
      thumb.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openHandler();
        }
      });
      return thumb;
    }

    const chip = document.createElement("div");
    chip.className = "file-chip";
    chip.textContent = `📎 ${att.fileName}`;
    return chip;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wa-message-list")) {
  customElements.define("wa-message-list", WaMessageList);
}
