import { VIEWER_BASE_CSS } from "../../styles/theme.js";
import {
  type AudioPlaybackController,
  type AudioPlaybackState,
  defaultAudioController,
} from "./AudioPlaybackController.js";

const BAR_COUNT = 36;

/**
 * `<wa-voice-note>`
 * Apple-style voice note player with pre-computed 36-bar SVG waveform,
 * interactive scrubbing, speed cycling (1x / 1.5x / 2x), and shared playback state.
 */
export class WaVoiceNote extends HTMLElement {
  static observedAttributes = ["message-id", "file-name", "mime-type", "duration"];

  #controller: AudioPlaybackController = defaultAudioController;
  #unsubscribe: (() => void) | null = null;
  #peaks: number[] = [];
  #playBtn: HTMLButtonElement | null = null;
  #speedBtn: HTMLButtonElement | null = null;
  #timeLabel: HTMLSpanElement | null = null;
  #bars: SVGRectElement[] = [];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        ${VIEWER_BASE_CSS}
        :host {
          display: block;
          min-width: 240px;
          max-width: 320px;
        }
        .player {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 2px;
        }
        .play-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: var(--wa-accent);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: transform var(--wa-duration-fast) var(--wa-spring);
        }
        .play-btn:active { transform: scale(0.92); }
        .play-btn svg { width: 16px; height: 16px; fill: currentColor; }
        .track-col {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .waveform {
          width: 100%;
          height: 28px;
          cursor: pointer;
          touch-action: none;
        }
        .bar {
          fill: var(--wa-text-secondary);
          opacity: 0.4;
          transition: fill 100ms linear, opacity 100ms linear;
        }
        .bar.active {
          fill: var(--wa-accent);
          opacity: 1;
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: var(--wa-text-secondary);
        }
        .speed-pill {
          border: none;
          background: var(--wa-border);
          color: var(--wa-text-primary);
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
      </style>
      <div class="player" role="region" aria-label="Voice note">
        <button class="play-btn" type="button" aria-label="Play voice note">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <div class="track-col">
          <svg class="waveform" viewBox="0 0 180 28" preserveAspectRatio="none" role="slider" aria-label="Audio progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></svg>
          <div class="meta-row">
            <span class="time">0:00</span>
            <button class="speed-pill" type="button" aria-label="Playback speed">1x</button>
          </div>
        </div>
      </div>
    `;

    this.#playBtn = shadow.querySelector(".play-btn");
    this.#speedBtn = shadow.querySelector(".speed-pill");
    this.#timeLabel = shadow.querySelector(".time");
    const svg = shadow.querySelector<SVGSVGElement>(".waveform");

    if (svg) {
      for (let i = 0; i < BAR_COUNT; i++) {
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", String(i * 5));
        rect.setAttribute("width", "3");
        rect.setAttribute("rx", "1.5");
        rect.classList.add("bar");
        svg.appendChild(rect);
        this.#bars.push(rect);
      }

      svg.addEventListener("click", (e) => {
        const bounds = svg.getBoundingClientRect();
        if (bounds.width <= 0) return;
        const fraction = (e.clientX - bounds.left) / bounds.width;
        this.#controller.seek(this.messageId, fraction);
      });
    }

    this.#playBtn?.addEventListener("click", () => {
      void this.#controller.toggle(this.messageId, this.fileName, this.mimeType, this.fileName);
    });

    this.#speedBtn?.addEventListener("click", () => {
      this.#controller.cycleSpeed();
    });
  }

  get messageId(): string {
    return this.getAttribute("message-id") ?? "";
  }
  set messageId(v: string) {
    this.setAttribute("message-id", v);
  }

  get fileName(): string {
    return this.getAttribute("file-name") ?? "";
  }
  set fileName(v: string) {
    this.setAttribute("file-name", v);
  }

  get mimeType(): string {
    return this.getAttribute("mime-type") ?? "audio/ogg; codecs=opus";
  }
  set mimeType(v: string) {
    this.setAttribute("mime-type", v);
  }

  set waveformPeaks(peaks: readonly number[] | undefined) {
    this.#peaks = peaks && peaks.length > 0 ? [...peaks] : [];
    this.#renderBars(0);
  }

  set controller(ctrl: AudioPlaybackController) {
    this.#unsubscribe?.();
    this.#controller = ctrl;
    if (this.isConnected) {
      this.#unsubscribe = this.#controller.subscribe((s) => this.#onStateChange(s));
    }
  }

  connectedCallback(): void {
    this.#renderBars(0);
    this.#unsubscribe = this.#controller.subscribe((s) => this.#onStateChange(s));
  }

  disconnectedCallback(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  attributeChangedCallback(): void {
    this.#renderBars(0);
  }

  #onStateChange(state: AudioPlaybackState): void {
    const isActive = state.activeId === this.messageId && this.messageId !== "";
    const playing = isActive && state.isPlaying;

    if (this.#playBtn) {
      this.#playBtn.setAttribute("aria-label", playing ? "Pause voice note" : "Play voice note");
      this.#playBtn.innerHTML = playing
        ? '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    }

    if (this.#speedBtn) {
      this.#speedBtn.textContent = `${state.speed}x`;
    }

    const fallbackDuration = Number.parseFloat(this.getAttribute("duration") ?? "0") || 0;
    const total = isActive && state.duration > 0 ? state.duration : fallbackDuration;
    const progress = isActive && total > 0 ? state.currentTime / total : 0;

    if (this.#timeLabel) {
      this.#timeLabel.textContent = formatDuration(isActive ? state.currentTime : total);
    }

    this.#renderBars(progress);
  }

  #renderBars(progress: number): void {
    const peaks =
      this.#peaks.length === BAR_COUNT ? this.#peaks : deterministicPeaks(this.fileName);
    const activeCutoff = Math.floor(progress * BAR_COUNT);

    for (let i = 0; i < BAR_COUNT; i++) {
      const rect = this.#bars[i];
      if (!rect) continue;
      const amp = Math.max(0.18, Math.min(1, peaks[i] ?? 0.3));
      const height = Math.round(amp * 24);
      const y = Math.round((28 - height) / 2);
      rect.setAttribute("height", String(height));
      rect.setAttribute("y", String(y));
      rect.classList.toggle("active", i < activeCutoff);
    }
  }
}

function deterministicPeaks(seed: string): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    out.push(0.2 + ((hash >>> 0) % 80) / 100);
  }
  return out;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

if (typeof customElements !== "undefined" && !customElements.get("wa-voice-note")) {
  customElements.define("wa-voice-note", WaVoiceNote);
}
