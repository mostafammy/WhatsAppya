import { extractWasLottieJson } from "@whatsappya/core";
import { type MediaLeaseManager, defaultMediaLeases } from "../../media/MediaLeaseManager.js";
import { VIEWER_BASE_CSS } from "../../styles/theme.js";

interface LottieAnimationInstance {
  destroy(): void;
  goToAndPlay(value: number, isFrame?: boolean): void;
}

interface LottieRuntime {
  loadAnimation(params: {
    container: HTMLElement;
    renderer: "svg" | "canvas" | "html";
    loop: boolean;
    autoplay: boolean;
    animationData: unknown;
  }): LottieAnimationInstance;
}

let lottieLoadPromise: Promise<LottieRuntime | null> | null = null;

function ensureLottieRuntime(): Promise<LottieRuntime | null> {
  const existing = (globalThis as unknown as { lottie?: LottieRuntime }).lottie;
  if (existing) return Promise.resolve(existing);
  if (typeof document === "undefined") return Promise.resolve(null);

  if (!lottieLoadPromise) {
    lottieLoadPromise = new Promise<LottieRuntime | null>((resolve) => {
      const script = document.createElement("script");
      script.src = "/vendor/lottie.min.js";
      script.async = true;
      script.onload = () => {
        resolve((globalThis as unknown as { lottie?: LottieRuntime }).lottie ?? null);
      };
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
  }

  return lottieLoadPromise;
}

/**
 * `<wa-sticker>`
 * Renders static/animated WebP stickers and `.was` Lottie stickers
 * using reference-counted MediaLeaseManager URLs or unzipped Lottie JSON.
 */
export class WaSticker extends HTMLElement {
  static observedAttributes = ["file-name", "mime-type", "animated"];

  #leases: MediaLeaseManager = defaultMediaLeases;
  #leasedFile: string | null = null;
  #lottieAnim: LottieAnimationInstance | null = null;
  #loadSeq = 0;
  #img: HTMLImageElement;
  #lottieStage: HTMLDivElement;
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
        .lottie-stage {
          display: none;
          width: 128px;
          height: 128px;
          cursor: pointer;
        }
        .lottie-stage.visible { display: block; }
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
      <div class="lottie-stage" role="img" aria-label="Animated WhatsApp sticker (click to replay)"></div>
      <div class="fallback" aria-hidden="true">Sticker</div>
    `;
    const img = shadow.querySelector("img");
    const lottieStage = shadow.querySelector<HTMLDivElement>(".lottie-stage");
    const fallback = shadow.querySelector<HTMLDivElement>(".fallback");
    if (!img || !lottieStage || !fallback) throw new Error("WaSticker shadow DOM failed");
    this.#img = img;
    this.#lottieStage = lottieStage;
    this.#fallback = fallback;

    this.#lottieStage.addEventListener("click", () => {
      this.#lottieAnim?.goToAndPlay(0, true);
    });
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
    this.#loadSeq++;
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
    const seq = ++this.#loadSeq;

    if (file.toLowerCase().endsWith(".was")) {
      await this.#loadLottieSticker(file, seq);
      return;
    }

    try {
      const url = await this.#leases.acquire(file, this.mimeType);
      if (seq !== this.#loadSeq || !this.isConnected) {
        this.#leases.release(file);
        return;
      }
      this.#leasedFile = file;
      this.#lottieStage.classList.remove("visible");
      this.#fallback.classList.remove("visible");
      this.#img.style.display = "";
      this.#img.src = url;
      this.#img.alt = `Sticker ${file}`;
    } catch {
      this.#showFallback("Sticker");
    }
  }

  async #loadLottieSticker(file: string, seq: number): Promise<void> {
    try {
      const blob = await this.#leases.resolveRawBlob(file, this.mimeType);
      if (!blob || seq !== this.#loadSeq || !this.isConnected) {
        this.#showFallback("Animated Sticker");
        return;
      }

      const jsonText = await extractWasLottieJson(new Uint8Array(await blob.arrayBuffer()));
      if (!jsonText || seq !== this.#loadSeq || !this.isConnected) {
        this.#showFallback("Animated Sticker");
        return;
      }

      const lottie = await ensureLottieRuntime();
      if (!lottie || seq !== this.#loadSeq || !this.isConnected) {
        this.#showFallback("Animated Sticker");
        return;
      }

      const animationData = JSON.parse(jsonText) as unknown;
      const reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      this.#img.style.display = "none";
      this.#fallback.classList.remove("visible");
      this.#lottieStage.innerHTML = "";
      this.#lottieStage.classList.add("visible");
      this.#lottieAnim = lottie.loadAnimation({
        container: this.#lottieStage,
        renderer: "svg",
        loop: !reducedMotion,
        autoplay: !reducedMotion,
        animationData,
      });
    } catch {
      this.#showFallback("Animated Sticker");
    }
  }

  #showFallback(label: string): void {
    this.#img.style.display = "none";
    this.#lottieStage.classList.remove("visible");
    this.#fallback.textContent = label;
    this.#fallback.classList.add("visible");
  }

  #releaseCurrent(): void {
    if (this.#lottieAnim) {
      this.#lottieAnim.destroy();
      this.#lottieAnim = null;
    }
    this.#lottieStage.innerHTML = "";
    this.#lottieStage.classList.remove("visible");
    if (this.#leasedFile) {
      this.#leases.release(this.#leasedFile);
      this.#leasedFile = null;
    }
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wa-sticker")) {
  customElements.define("wa-sticker", WaSticker);
}
