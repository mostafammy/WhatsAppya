import { type MediaLeaseManager, defaultMediaLeases } from "../../media/MediaLeaseManager.js";

export type PlaybackSpeed = 1 | 1.5 | 2;

export interface AudioPlaybackState {
  readonly activeId: string | null;
  readonly isPlaying: boolean;
  readonly currentTime: number;
  readonly duration: number;
  readonly speed: PlaybackSpeed;
}

type StateListener = (state: AudioPlaybackState) => void;

/**
 * External singleton audio controller driving all `<wa-voice-note>` elements.
 * Guarantees single-active playback, speed cycling (1x -> 1.5x -> 2x),
 * MediaSession integration, and reference-counted MediaLease acquisition.
 */
export class AudioPlaybackController {
  #audio: HTMLAudioElement | null = null;
  #activeId: string | null = null;
  #activeFileName: string | null = null;
  #speed: PlaybackSpeed = 1;
  #duration = 0;
  #currentTime = 0;
  #isPlaying = false;
  readonly #listeners = new Set<StateListener>();
  readonly #leases: MediaLeaseManager;

  constructor(leases: MediaLeaseManager = defaultMediaLeases) {
    this.#leases = leases;
  }

  get state(): AudioPlaybackState {
    return {
      activeId: this.#activeId,
      isPlaying: this.#isPlaying,
      currentTime: this.#currentTime,
      duration: this.#duration,
      speed: this.#speed,
    };
  }

  subscribe(listener: StateListener): () => void {
    this.#listeners.add(listener);
    listener(this.state);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  cycleSpeed(): PlaybackSpeed {
    const next: PlaybackSpeed = this.#speed === 1 ? 1.5 : this.#speed === 1.5 ? 2 : 1;
    this.#speed = next;
    if (this.#audio) {
      this.#audio.playbackRate = next;
    }
    this.#notify();
    return next;
  }

  async toggle(id: string, fileName: string, mimeType: string, title?: string): Promise<void> {
    if (this.#activeId === id && this.#audio) {
      if (this.#isPlaying) {
        this.#audio.pause();
      } else {
        await this.#audio.play();
      }
      return;
    }

    await this.play(id, fileName, mimeType, title);
  }

  async play(id: string, fileName: string, mimeType: string, title?: string): Promise<void> {
    this.stop();

    const src = await this.#resolveAudioSrc(fileName, mimeType);
    const audio = new Audio(src);
    audio.playbackRate = this.#speed;

    this.#audio = audio;
    this.#activeId = id;
    this.#activeFileName = fileName;
    this.#currentTime = 0;

    audio.addEventListener("loadedmetadata", () => {
      this.#duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      this.#notify();
    });
    audio.addEventListener("timeupdate", () => {
      this.#currentTime = audio.currentTime;
      this.#notify();
    });
    audio.addEventListener("play", () => {
      this.#isPlaying = true;
      this.#notify();
    });
    audio.addEventListener("pause", () => {
      this.#isPlaying = false;
      this.#notify();
    });
    audio.addEventListener("ended", () => {
      this.#isPlaying = false;
      this.#currentTime = 0;
      this.#notify();
    });

    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: title ?? fileName,
          artist: "WhatsAppya Voice Note",
        });
      } catch {
        // Ignore environments without MediaMetadata
      }
    }

    await audio.play();
  }

  seek(id: string, fraction: number): void {
    if (this.#activeId !== id || !this.#audio || !Number.isFinite(this.#audio.duration)) return;
    const clamped = Math.max(0, Math.min(1, fraction));
    this.#audio.currentTime = clamped * this.#audio.duration;
    this.#currentTime = this.#audio.currentTime;
    this.#notify();
  }

  stop(): void {
    if (this.#audio) {
      this.#audio.pause();
      this.#audio.src = "";
      this.#audio = null;
    }
    if (this.#activeFileName) {
      this.#leases.release(this.#activeFileName);
      this.#activeFileName = null;
    }
    this.#activeId = null;
    this.#isPlaying = false;
    this.#currentTime = 0;
    this.#duration = 0;
    this.#notify();
  }

  async #resolveAudioSrc(fileName: string, mimeType: string): Promise<string> {
    // Support legacy opt-in _voice_cache fallback when opened over file://
    const globalCache = (globalThis as unknown as { __WA_VOICE_CACHE__?: Record<string, string> })
      .__WA_VOICE_CACHE__;
    if (globalCache) {
      const encodedKey = encodeURIComponent(fileName);
      const b64 = globalCache[encodedKey] ?? globalCache[fileName];
      if (b64) {
        return `data:${mimeType};base64,${b64}`;
      }
    }
    return this.#leases.acquire(fileName, mimeType);
  }

  #notify(): void {
    const snapshot = this.state;
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }
}

export const defaultAudioController = new AudioPlaybackController();
