import type { ChatSession } from "@whatsappya/core";
import { type MediaLeaseManager, defaultMediaLeases } from "../../media/MediaLeaseManager.js";
import { VIEWER_BASE_CSS } from "../../styles/theme.js";

export interface LightboxItem {
  readonly fileName: string;
  readonly mimeType: string;
  readonly kind: "image" | "video" | "pdf";
  readonly caption?: string;
}

/**
 * Collects all non-omitted image and video attachments in a session
 * for prev/next gallery browsing in `<wa-lightbox>`.
 */
export function collectMediaGallery(session: ChatSession): LightboxItem[] {
  const gallery: LightboxItem[] = [];
  for (const msg of session.messages) {
    const att = msg.attachment;
    if (!att || att.isOmitted) continue;
    if (att.kind === "image" || att.kind === "video") {
      gallery.push({
        fileName: att.fileName,
        mimeType: att.mimeType,
        kind: att.kind,
        ...(msg.text ? { caption: msg.text } : {}),
      });
    }
  }
  return gallery;
}

/**
 * `<wa-lightbox>`
 * Apple QuickLook-inspired full-screen media & PDF viewer with keyboard navigation
 * (Escape, ArrowLeft, ArrowRight), download action, gallery counter, and MediaLease lifecycle.
 */
export class WaLightbox extends HTMLElement {
  #leases: MediaLeaseManager = defaultMediaLeases;
  #items: LightboxItem[] = [];
  #index = 0;
  #leasedFile: string | null = null;
  #renderSeq = 0;
  #backdrop: HTMLDivElement;
  #stage: HTMLDivElement;
  #caption: HTMLDivElement;
  #counter: HTMLSpanElement;
  #downloadLink: HTMLAnchorElement;
  #closeBtn: HTMLButtonElement;
  #prevBtn: HTMLButtonElement;
  #nextBtn: HTMLButtonElement;
  #onKeyDownBound: (e: KeyboardEvent) => void;

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
          z-index: 9999;
        }
        :host([open]) { display: block; }
        .backdrop {
          position: fixed;
          inset: 0;
          background: rgba(11, 20, 26, 0.86);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .toolbar {
          position: fixed;
          top: 16px;
          right: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 2;
        }
        .counter {
          color: #e9edef;
          font-size: 13px;
          font-weight: 600;
          margin-right: 4px;
        }
        .icon-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(32, 44, 51, 0.78);
          color: #fff;
          font-size: 18px;
          text-decoration: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .nav-btn {
          position: fixed;
          top: 50%;
          transform: translateY(-50%);
          z-index: 2;
        }
        .prev-btn { left: 16px; }
        .next-btn { right: 16px; }
        .stage {
          max-width: 92vw;
          max-height: 82vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stage img, .stage video {
          max-width: 92vw;
          max-height: 82vh;
          border-radius: 12px;
          box-shadow: var(--wa-shadow-lg);
          object-fit: contain;
        }
        .stage iframe {
          width: min(92vw, 960px);
          height: 82vh;
          border: none;
          border-radius: 12px;
          background: #fff;
          box-shadow: var(--wa-shadow-lg);
        }
        .caption {
          margin-top: 14px;
          color: #e9edef;
          font-size: 14px;
          max-width: 680px;
          text-align: center;
        }
      </style>
      <div class="backdrop" role="dialog" aria-modal="true" aria-label="Media preview">
        <div class="toolbar">
          <span class="counter" aria-live="polite"></span>
          <a class="icon-btn download-btn" download aria-label="Download file" title="Download">⬇</a>
          <button class="icon-btn close-btn" type="button" aria-label="Close preview">✕</button>
        </div>
        <button class="icon-btn nav-btn prev-btn" type="button" aria-label="Previous media">‹</button>
        <div class="stage"></div>
        <button class="icon-btn nav-btn next-btn" type="button" aria-label="Next media">›</button>
        <div class="caption"></div>
      </div>
    `;

    const backdrop = shadow.querySelector<HTMLDivElement>(".backdrop");
    const stage = shadow.querySelector<HTMLDivElement>(".stage");
    const caption = shadow.querySelector<HTMLDivElement>(".caption");
    const counter = shadow.querySelector<HTMLSpanElement>(".counter");
    const downloadLink = shadow.querySelector<HTMLAnchorElement>(".download-btn");
    const closeBtn = shadow.querySelector<HTMLButtonElement>(".close-btn");
    const prevBtn = shadow.querySelector<HTMLButtonElement>(".prev-btn");
    const nextBtn = shadow.querySelector<HTMLButtonElement>(".next-btn");

    if (
      !backdrop ||
      !stage ||
      !caption ||
      !counter ||
      !downloadLink ||
      !closeBtn ||
      !prevBtn ||
      !nextBtn
    ) {
      throw new Error("WaLightbox shadow DOM failed");
    }

    this.#backdrop = backdrop;
    this.#stage = stage;
    this.#caption = caption;
    this.#counter = counter;
    this.#downloadLink = downloadLink;
    this.#closeBtn = closeBtn;
    this.#prevBtn = prevBtn;
    this.#nextBtn = nextBtn;

    this.#onKeyDownBound = (e: KeyboardEvent) => this.#onKeyDown(e);

    this.#closeBtn.addEventListener("click", () => this.close());
    this.#prevBtn.addEventListener("click", () => this.step(-1));
    this.#nextBtn.addEventListener("click", () => this.step(1));
    this.#backdrop.addEventListener("click", (e) => {
      if (e.target === this.#backdrop) this.close();
    });
  }

  set leases(manager: MediaLeaseManager) {
    this.#leases = manager;
  }

  async open(item: LightboxItem, gallery?: readonly LightboxItem[]): Promise<void> {
    this.#items = gallery && gallery.length > 0 ? [...gallery] : [item];
    const found = this.#items.findIndex((x) => x.fileName === item.fileName);
    this.#index = found >= 0 ? found : 0;

    this.setAttribute("open", "");
    document.addEventListener("keydown", this.#onKeyDownBound);
    this.#closeBtn.focus();
    await this.#renderCurrent();
  }

  close(): void {
    this.#renderSeq++;
    this.removeAttribute("open");
    document.removeEventListener("keydown", this.#onKeyDownBound);
    this.#stage.innerHTML = "";
    this.#downloadLink.removeAttribute("href");
    this.#releaseCurrent();
    this.dispatchEvent(new CustomEvent("wa-lightbox-close"));
  }

  step(delta: number): void {
    if (this.#items.length <= 1) return;
    this.#index = (this.#index + delta + this.#items.length) % this.#items.length;
    void this.#renderCurrent();
  }

  #onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.step(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      this.step(1);
    }
  }

  async #renderCurrent(): Promise<void> {
    const current = this.#items[this.#index];
    if (!current) return;

    const seq = ++this.#renderSeq;
    const hasGallery = this.#items.length > 1;
    this.#prevBtn.style.display = hasGallery ? "inline-flex" : "none";
    this.#nextBtn.style.display = hasGallery ? "inline-flex" : "none";
    this.#counter.textContent = hasGallery ? `${this.#index + 1} / ${this.#items.length}` : "";
    this.#caption.textContent = current.caption ?? current.fileName;

    this.#releaseCurrent();
    const url = await this.#leases.acquire(current.fileName, current.mimeType);
    if (seq !== this.#renderSeq || !this.hasAttribute("open")) {
      this.#leases.release(current.fileName);
      return;
    }

    this.#leasedFile = current.fileName;
    this.#downloadLink.href = url;
    this.#downloadLink.download = current.fileName;

    this.#stage.innerHTML = "";
    if (current.kind === "video") {
      const video = document.createElement("video");
      video.src = url;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      this.#stage.appendChild(video);
    } else if (current.kind === "pdf") {
      const frame = document.createElement("iframe");
      frame.src = url;
      frame.title = current.caption ?? current.fileName;
      this.#stage.appendChild(frame);
    } else {
      const img = document.createElement("img");
      img.src = url;
      img.alt = current.caption ?? current.fileName;
      this.#stage.appendChild(img);
    }
  }

  #releaseCurrent(): void {
    if (this.#leasedFile) {
      this.#leases.release(this.#leasedFile);
      this.#leasedFile = null;
    }
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wa-lightbox")) {
  customElements.define("wa-lightbox", WaLightbox);
}
