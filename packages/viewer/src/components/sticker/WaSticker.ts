import { type MediaLeaseManager, defaultMediaLeases } from "../../media/MediaLeaseManager.js";
import { VIEWER_BASE_CSS } from "../../styles/theme.js";

/**
 * `<wa-sticker>`
 * Renders static/animated WebP stickers and `.was` Lottie stickers
 * using reference-counted MediaLeaseManager URLs.
 */
export class WaSticker extends HTMLElement {
  static observedAttributes = ["file-name", "mime-type", "animated"];

  #leases: MediaLeaseManager = defaultMediaLeases;
  #leasedFile: string | null = null;
  #img: HTMLImageElement;
  #fallback: HTMLDivElement;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        ${VIEWER_BASE_CSS}
        :host {
          display: inline-flex;
          width: 128px;
          height: 128px;
          align-items: center;
          justify-content: center;
        }
        img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          user-select: none;
        }
        .fallback {
          display: none;
          font-size: 12px;
          color: var(--wa-text-secondary);
          background: var(--wa-surface);
          border: 1px solid var(--wa-border);
          border-radius: 14px;
          padding: 10px 14px;
        }
        .fallback.visible { display: block; }
      </style>
      <img alt="WhatsApp sticker" loading="lazy" decoding="async" />
      <div class="fallback" aria-hidden="true">Sticker</div>
    `;
    const img = shadow.querySelector("img");
    const fallback = shadow.querySelector<HTMLDivElement>(".fallback");
    if (!img || !fallback) throw new Error("WaSticker shadow DOM failed");
    this.#img = img;
    this.#fallback = fallback;
  }

  get fileName(): string {
    return this.getAttribute("file-name") ?? "";
  }
  set fileName(v: string) {
    this.setAttribute("file-name", v);
  }

  get mimeType(): string {
    return this.getAttribute("mime-type") ?? "image/webp";
  }
  set mimeType(v: string) {
    this.setAttribute("mime-type", v);
  }

  set leases(manager: MediaLeaseManager) {
    this.#leases = manager;
  }

  connectedCallback(): void {
    void this.#load();
  }

  disconnectedCallback(): void {
    this.#releaseCurrent();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) {
      void this.#load();
    }
  }

  async #load(): Promise<void> {
    const file = this.fileName;
    if (!file) return;

    if (this.#leasedFile === file) return;
    this.#releaseCurrent();

    try {
      const url = await this.#leases.acquire(file, this.mimeType);
      this.#leasedFile = file;
      this.#img.style.display = "";
      this.#fallback.classList.remove("visible");
      this.#img.src = url;
      this.#img.alt = `Sticker ${file}`;
    } catch {
      this.#img.style.display = "none";
      this.#fallback.classList.add("visible");
    }
  }

  #releaseCurrent(): void {
    if (this.#leasedFile) {
      this.#leases.release(this.#leasedFile);
      this.#leasedFile = null;
    }
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wa-sticker")) {
  customElements.define("wa-sticker", WaSticker);
}
