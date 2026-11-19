import { type MediaLeaseManager, defaultMediaLeases } from "../../media/MediaLeaseManager.js";
import { VIEWER_BASE_CSS } from "../../styles/theme.js";

export interface LightboxItem {
  readonly fileName: string;
  readonly mimeType: string;
  readonly kind: "image" | "video";
  readonly caption?: string;
}

/**
 * `<wa-lightbox>`
 * Apple QuickLook-inspired full-screen media viewer with keyboard navigation
 * (Escape, ArrowLeft, ArrowRight), focus management, and MediaLease lifecycle.
 */
export class WaLightbox extends HTMLElement {
  #leases: MediaLeaseManager = defaultMediaLeases;
  #items: LightboxItem[] = [];
  #index = 0;
  #leasedFile: string | null = null;
  #backdrop: HTMLDivElement;
  #stage: HTMLDivElement;
  #caption: HTMLDivElement;
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
          gap: 8px;
          z-index: 2;
        }
        .icon-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(32, 44, 51, 0.78);
          color: #fff;
          font-size: 18px;
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
    const closeBtn = shadow.querySelector<HTMLButtonElement>(".close-btn");
    const prevBtn = shadow.querySelector<HTMLButtonElement>(".prev-btn");
    const nextBtn = shadow.querySelector<HTMLButtonElement>(".next-btn");

    if (!backdrop || !stage || !caption || !closeBtn || !prevBtn || !nextBtn) {
      throw new Error("WaLightbox shadow DOM failed");
    }

    this.#backdrop = backdrop;
    this.#stage = stage;
    this.#caption = caption;
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
    this.removeAttribute("open");
    document.removeEventListener("keydown", this.#onKeyDownBound);
    this.#stage.innerHTML = "";
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

    this.#prevBtn.style.display = this.#items.length > 1 ? "inline-flex" : "none";
    this.#nextBtn.style.display = this.#items.length > 1 ? "inline-flex" : "none";
    this.#caption.textContent = current.caption ?? current.fileName;

    this.#releaseCurrent();
    const url = await this.#leases.acquire(current.fileName, current.mimeType);
    this.#leasedFile = current.fileName;

    this.#stage.innerHTML = "";
    if (current.kind === "video") {
      const video = document.createElement("video");
      video.src = url;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      this.#stage.appendChild(video);
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
