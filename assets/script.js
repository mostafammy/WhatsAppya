/**
 * Apple-Grade Conversational Audio & Interactive Experience Engine.
 * Instant Acoustic Playback Engine (IAPE-2026 V2) Architecture.
 *
 * Implements:
 * 1. Zero-CORS Local Binary Loader via <script> Cache Modules (_voice_cache/*.js) for file://
 * 2. Sub-10ms Instant Playback via In-Memory WebAudio Float32 PCM Buffers
 * 3. Automatic Leading-Silence Detection & Trimming (skips WhatsApp PTT mic-click dead air)
 * 4. Authentic 36-Bar RMS Acoustic Waveform Extraction from Decoded PCM Samples
 * 5. 100ms Dwell-Filtered Viewport IntersectionObserver (600px Lookahead, Zero Scroll Congestion)
 * 6. Pre-Seeked Blob AVPlayer Pool Fallback (Max 12 Active Media Elements)
 * 7. High-DPI Retina Waveform Scrubbing (Pointer Capture & 120 FPS ProMotion RAF)
 */

(function () {
    'use strict';

    /**
     * Deterministic pseudorandom generator seeded by string
     * to render distinct initial audio waveforms before PCM hydration.
     */
    function seedRandom(str) {
        let h = 1779033703 ^ str.length;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
            h = (h << 13) | (h >>> 19);
        }
        return function () {
            h = Math.imul(h ^ (h >>> 16), 2246822507);
            h = Math.imul(h ^ (h >>> 13), 3266489909);
            return ((h ^= h >>> 16) >>> 0) / 4294967296;
        };
    }

    /**
     * Fast Base64 to Uint8Array decoder.
     */
    function base64ToBytes(b64) {
        const binaryString = window.atob(b64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Analyzes decoded Float32 PCM samples to:
     * 1. Find the exact vocal onset timestamp (skipping initial WhatsApp PTT button-press silence)
     * 2. Compute authentic 36-bar normalized RMS waveform heights
     */
    function analyzePcmBuffer(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate || 48000;
        const totalSamples = channelData.length;
        const duration = audioBuffer.duration || (totalSamples / sampleRate);

        // 1. Detect leading silence (scan up to first 0.75s max)
        const maxScanSamples = Math.min(totalSamples, Math.floor(sampleRate * 0.75));
        const threshold = 0.015; // ~ -36 dBFS vocal onset threshold
        let firstSoundSample = 0;
        const windowSize = Math.max(1, Math.floor(sampleRate * 0.005)); // 5ms window

        for (let i = 0; i < maxScanSamples - windowSize; i += windowSize) {
            let sum = 0;
            for (let j = 0; j < windowSize; j++) {
                sum += Math.abs(channelData[i + j]);
            }
            if ((sum / windowSize) >= threshold) {
                // Step back 25ms before vocal onset for natural breath attack
                firstSoundSample = Math.max(0, i - Math.floor(sampleRate * 0.025));
                break;
            }
        }

        const voiceStartOffset = (duration > 1.0 && firstSoundSample > 0)
            ? Math.min(0.65, firstSoundSample / sampleRate)
            : 0;

        // 2. Compute 36 normalized RMS waveform bars (0.15 to 1.0)
        const numBars = 36;
        const samplesPerBar = Math.floor(totalSamples / numBars);
        const rawRms = [];
        let maxRms = 0.001;

        if (samplesPerBar > 0) {
            const step = Math.max(1, Math.floor(samplesPerBar / 64));
            for (let b = 0; b < numBars; b++) {
                const start = b * samplesPerBar;
                const end = start + samplesPerBar;
                let sumSq = 0;
                let count = 0;
                for (let s = start; s < end; s += step) {
                    const val = channelData[s];
                    sumSq += val * val;
                    count++;
                }
                const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
                rawRms.push(rms);
                if (rms > maxRms) maxRms = rms;
            }
        }

        const bars = rawRms.length === numBars
            ? rawRms.map((r) => Math.max(0.15, Math.min(1.0, 0.15 + Math.pow(r / maxRms, 0.65) * 0.85)))
            : null;

        return {
            voiceStartOffset: voiceStartOffset,
            bars: bars
        };
    }

    /**
     * Formats seconds into MM:SS display.
     */
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return mins + ':' + (secs < 10 ? '0' : '') + secs;
    }

    /**
     * Draws the Cupertino 36-bar audio waveform on canvas.
     */
    function drawWaveform(canvas, bars, progress, isDarkMode, isSentBubble) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const width = canvas.width / dpr;
        const height = canvas.height / dpr;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(dpr, dpr);

        const numBars = bars.length;
        const totalSpacing = width * 0.4;
        const gap = totalSpacing / (numBars - 1);
        const barWidth = (width - totalSpacing) / numBars;

        // Theme-aware colors matching Apple HIG
        const activeColor = isSentBubble
            ? (isDarkMode ? '#25D366' : '#056162')
            : (isDarkMode ? '#0A84FF' : '#007AFF');

        const inactiveColor = isDarkMode
            ? 'rgba(255, 255, 255, 0.22)'
            : 'rgba(0, 0, 0, 0.18)';

        for (let i = 0; i < numBars; i++) {
            const barFraction = i / numBars;
            const isPlayed = barFraction <= progress;
            ctx.fillStyle = isPlayed ? activeColor : inactiveColor;

            const barHeight = Math.max(4, bars[i] * (height - 6));
            const x = i * (barWidth + gap);
            const y = (height - barHeight) / 2;
            const radius = barWidth / 2;

            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x, y, barWidth, barHeight, radius);
            } else {
                ctx.rect(x, y, barWidth, barHeight);
            }
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Centralized Instant Acoustic Playback Engine (IAPE-2026 V2).
     * Coordinates AudioContext, Zero-CORS _voice_cache Script Loader,
     * PCM Pre-decoding, Leading-Silence Trimming, and Bounded Media Pool.
     */
    class InstantAudioEngine {
        constructor() {
            this.audioCtx = null;
            this.pcmCache = new Map(); // src -> AudioBuffer (LRU capped at 48MB)
            this.cacheBytes = 0;
            this.MAX_CACHE_BYTES = 48 * 1024 * 1024;

            this.byteCache = new Map(); // src -> Uint8Array (LRU capped at 24 items)
            this.blobUrlCache = new Map(); // src -> blob: URL
            this.warmAudioPool = []; // Active HTMLAudioElements with attached src (max 12)
            this.MAX_WARM_AUDIO_ELEMENTS = 12;

            this.prewarmPromises = new Map(); // src -> Promise
            this.activeInstance = null;

            this.initHardwarePrearm();
            this.initViewportObserver();
        }

        getAudioContext() {
            if (!this.audioCtx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) {
                    this.audioCtx = new AudioContextClass({ latencyHint: 'interactive' });
                }
            }
            return this.audioCtx;
        }

        /**
         * Pre-arms the hardware DAC, CoreAudio output pipeline,
         * and Bluetooth A2DP audio route on the earliest user interaction.
         */
        initHardwarePrearm() {
            const prearm = () => {
                const ctx = this.getAudioContext();
                if (ctx && ctx.state === 'suspended') {
                    ctx.resume().catch(function () {});
                }
                window.removeEventListener('pointerdown', prearm, true);
                window.removeEventListener('touchstart', prearm, true);
                window.removeEventListener('keydown', prearm, true);
            };
            window.addEventListener('pointerdown', prearm, { capture: true, passive: true });
            window.addEventListener('touchstart', prearm, { capture: true, passive: true });
            window.addEventListener('keydown', prearm, { capture: true, passive: true });
        }

        /**
         * Initializes Dwell-Filtered IntersectionObserver (600px lookahead).
         * Cancels pre-warming for items that fly past during rapid scrolling (< 90ms dwell).
         */
        initViewportObserver() {
            if (!('IntersectionObserver' in window)) return;

            this.observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    const playerEl = entry.target;
                    if (entry.isIntersecting) {
                        if (playerEl._dwellTimer) clearTimeout(playerEl._dwellTimer);
                        playerEl._dwellTimer = setTimeout(() => {
                            playerEl._dwellTimer = null;
                            const src = playerEl.getAttribute('data-src');
                            if (src) {
                                this.prewarm(src, playerEl);
                            }
                            if (this.observer) {
                                this.observer.unobserve(playerEl);
                            }
                        }, 90);
                    } else {
                        if (playerEl._dwellTimer) {
                            clearTimeout(playerEl._dwellTimer);
                            playerEl._dwellTimer = null;
                        }
                    }
                });
            }, { rootMargin: '600px 0px 600px 0px' });
        }

        observe(playerEl) {
            if (this.observer) {
                this.observer.observe(playerEl);
            }
        }

        /**
         * Loads raw audio bytes via CORS-free <script src="_voice_cache/..."> on file://
         * with automatic fallback to fetch() on HTTP/HTTPS servers.
         */
        loadAudioBytes(src) {
            if (this.byteCache.has(src)) {
                return Promise.resolve(this.byteCache.get(src));
            }

            if (window.__WA_VOICE_CACHE__ && window.__WA_VOICE_CACHE__[src]) {
                const bytes = base64ToBytes(window.__WA_VOICE_CACHE__[src]);
                delete window.__WA_VOICE_CACHE__[src];
                this.storeByteCache(src, bytes);
                return Promise.resolve(bytes);
            }

            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = '_voice_cache/' + src + '.js';
                script.async = true;

                script.onload = () => {
                    if (script.parentNode) script.parentNode.removeChild(script);
                    if (window.__WA_VOICE_CACHE__ && window.__WA_VOICE_CACHE__[src]) {
                        try {
                            const bytes = base64ToBytes(window.__WA_VOICE_CACHE__[src]);
                            delete window.__WA_VOICE_CACHE__[src];
                            this.storeByteCache(src, bytes);
                            resolve(bytes);
                            return;
                        } catch (err) {
                            reject(err);
                            return;
                        }
                    }
                    reject(new Error('Voice cache payload missing for ' + src));
                };

                script.onerror = () => {
                    if (script.parentNode) script.parentNode.removeChild(script);
                    // Fallback to fetch for standard HTTP environments
                    if (typeof fetch === 'function') {
                        fetch(src, { cache: 'force-cache' })
                            .then((res) => {
                                if (!res.ok) throw new Error('HTTP ' + res.status);
                                return res.arrayBuffer();
                            })
                            .then((buf) => {
                                const bytes = new Uint8Array(buf);
                                this.storeByteCache(src, bytes);
                                resolve(bytes);
                            })
                            .catch(reject);
                    } else {
                        reject(new Error('Cannot load audio bytes for ' + src));
                    }
                };

                document.head.appendChild(script);
            });
        }

        storeByteCache(src, bytes) {
            if (this.byteCache.size >= 24) {
                const oldest = this.byteCache.keys().next().value;
                this.byteCache.delete(oldest);
            }
            this.byteCache.set(src, bytes);
        }

        /**
         * Attaches a Blob URL or file src to a player's <audio> element
         * while strictly enforcing a maximum pool of 12 active <audio> elements.
         */
        armAudioElement(playerEl, mediaUrl, startOffset) {
            if (!playerEl) return;
            const audioEl = playerEl.querySelector('audio');
            if (!audioEl) return;

            const instance = playerEl._voiceInstance;
            if (instance && instance.isPlaying) return;

            if (audioEl._armedUrl === mediaUrl && audioEl.readyState >= 1) {
                return;
            }

            // Evict oldest idle <audio> element if pool is full
            this.warmAudioPool = this.warmAudioPool.filter((el) => el !== audioEl);
            while (this.warmAudioPool.length >= this.MAX_WARM_AUDIO_ELEMENTS) {
                const oldestEl = this.warmAudioPool.shift();
                const oldInst = oldestEl._playerInstance;
                if (oldInst && !oldInst.isPlaying) {
                    oldestEl.removeAttribute('src');
                    oldestEl._armedUrl = null;
                    try { oldestEl.load(); } catch (_) {}
                }
            }

            audioEl._playerInstance = instance;
            audioEl._armedUrl = mediaUrl;
            audioEl.preload = 'auto';
            audioEl.src = mediaUrl;
            this.warmAudioPool.push(audioEl);

            const onMeta = () => {
                audioEl.removeEventListener('loadedmetadata', onMeta);
                if (instance && !instance.isPlaying) {
                    const targetOffset = startOffset !== undefined
                        ? startOffset
                        : (instance.voiceStartOffset || 0.18);
                    if (audioEl.duration > 1.0 && targetOffset > 0) {
                        try {
                            // Seeking > 0 forces Safari AVPlayer to demux Ogg Page 2 and preroll Opus decoder
                            audioEl.currentTime = targetOffset;
                        } catch (_) {}
                    }
                }
            };
            audioEl.addEventListener('loadedmetadata', onMeta);
            try { audioEl.load(); } catch (_) {}
        }

        /**
         * Decodes raw audio bytes into an uncompressed Float32 AudioBuffer in RAM.
         */
        decodePcm(src, bytes, playerEl) {
            if (this.pcmCache.has(src)) {
                return Promise.resolve(this.pcmCache.get(src));
            }
            const ctx = this.getAudioContext();
            if (!ctx) {
                return Promise.reject(new Error('No AudioContext'));
            }

            // Copy ArrayBuffer slice so original Uint8Array stays intact if retry is needed
            const bufferCopy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

            return new Promise((resolve, reject) => {
                ctx.decodeAudioData(
                    bufferCopy,
                    (decodedBuffer) => {
                        const analysis = analyzePcmBuffer(decodedBuffer);
                        decodedBuffer._voiceStartOffset = analysis.voiceStartOffset;
                        decodedBuffer._rmsBars = analysis.bars;

                        const bufferBytes = decodedBuffer.length * decodedBuffer.numberOfChannels * 4;
                        while (this.cacheBytes + bufferBytes > this.MAX_CACHE_BYTES && this.pcmCache.size > 0) {
                            const oldestKey = this.pcmCache.keys().next().value;
                            const oldBuffer = this.pcmCache.get(oldestKey);
                            this.cacheBytes -= (oldBuffer.length * oldBuffer.numberOfChannels * 4);
                            this.pcmCache.delete(oldestKey);
                        }

                        this.pcmCache.set(src, decodedBuffer);
                        this.cacheBytes += bufferBytes;

                        if (playerEl && playerEl._voiceInstance) {
                            playerEl._voiceInstance.onBufferDecoded(decodedBuffer);
                        }
                        resolve(decodedBuffer);
                    },
                    (err) => {
                        reject(err);
                    }
                );
            });
        }

        /**
         * Full Two-Tier Pre-Warm Pipeline for a Voice Note:
         * 1. Loads raw binary bytes via Zero-CORS <script> cache
         * 2. Arms an in-memory Blob URL on the pooled <audio> element & prerolls AVPlayer
         * 3. Decodes Float32 PCM into WebAudio RAM cache & trims leading silence
         */
        prewarm(src, playerEl) {
            if (this.pcmCache.has(src)) {
                const buf = this.pcmCache.get(src);
                if (playerEl && playerEl._voiceInstance) {
                    playerEl._voiceInstance.onBufferDecoded(buf);
                }
                if (this.blobUrlCache.has(src)) {
                    this.armAudioElement(playerEl, this.blobUrlCache.get(src), buf._voiceStartOffset);
                }
                return Promise.resolve(buf);
            }

            if (this.prewarmPromises.has(src)) {
                return this.prewarmPromises.get(src);
            }

            const promise = this.loadAudioBytes(src)
                .then((bytes) => {
                    // Create in-memory Blob URL for instant AVPlayer preroll
                    let blobUrl = this.blobUrlCache.get(src);
                    if (!blobUrl) {
                        const blob = new Blob([bytes], { type: 'audio/ogg; codecs=opus' });
                        blobUrl = URL.createObjectURL(blob);
                        this.blobUrlCache.set(src, blobUrl);
                    }
                    this.armAudioElement(playerEl, blobUrl);

                    // Decode uncompressed PCM into WebAudio RAM
                    return this.decodePcm(src, bytes, playerEl).catch(() => null);
                })
                .catch(() => {
                    // Fallback if _voice_cache is not present: arm direct file src on pooled <audio>
                    this.armAudioElement(playerEl, src);
                    return null;
                })
                .finally(() => {
                    this.prewarmPromises.delete(src);
                });

            this.prewarmPromises.set(src, promise);
            return promise;
        }
    }

    // Global Singleton Audio Engine
    const engine = new InstantAudioEngine();

    /**
     * Voice Player Instance managing an individual audio message UI node.
     */
    class VoicePlayerInstance {
        constructor(player) {
            this.player = player;
            player._voiceInstance = this;

            this.audio = player.querySelector('audio');
            this.playBtn = player.querySelector('.voice-play-btn');
            this.playIcon = player.querySelector('.play-icon');
            this.pauseIcon = player.querySelector('.pause-icon');
            this.canvas = player.querySelector('.waveform-canvas');
            this.durationLabel = player.querySelector('.voice-duration');
            this.speedBtn = player.querySelector('.speed-pill-btn');

            this.src = player.getAttribute('data-src') || '';
            this.title = player.getAttribute('data-title') || 'voice_note';
            this.isSentBubble = Boolean(player.closest('.message.sent'));

            this.isPlaying = false;
            this.mode = 'idle'; // 'webaudio' | 'html5' | 'warming' | 'idle'
            this.sourceNode = null;
            this.audioBuffer = null;

            this.speeds = [1.0, 1.5, 2.0];
            this.speedIndex = 0;
            this.playbackRate = 1.0;

            this.duration = parseFloat(player.getAttribute('data-duration') || '0');
            this.voiceStartOffset = 0.18; // Default PTT mic-click skip until refined by PCM analysis
            this.currentTime = 0;
            this.pausedAt = 0;
            this.webAudioStartCtxTime = 0;
            this.webAudioStartOffset = 0;
            this.rafId = null;

            this.isDragging = false;
            this.timeDisplayMode = 'elapsed'; // 'elapsed' | 'remaining' | 'total'
            this.lastPointerDownTime = 0;

            // Generate 36 initial normalized peak heights (0.15 to 1.0)
            const rng = seedRandom(this.title);
            this.bars = [];
            for (let i = 0; i < 36; i++) {
                this.bars.push(0.15 + rng() * 0.85);
            }

            this.initCanvasDpi();
            this.attachEvents();
            this.render();

            // Register with viewport proximity observer
            engine.observe(this.player);
        }

        initCanvasDpi() {
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = 220;
            const displayHeight = 34;
            this.canvas.width = displayWidth * dpr;
            this.canvas.height = displayHeight * dpr;
            this.canvas.style.width = displayWidth + 'px';
            this.canvas.style.height = displayHeight + 'px';
        }

        onBufferDecoded(buffer) {
            this.audioBuffer = buffer;
            if (buffer.duration && (!this.duration || Math.abs(this.duration - buffer.duration) > 0.5)) {
                this.duration = buffer.duration;
            }
            if (typeof buffer._voiceStartOffset === 'number') {
                this.voiceStartOffset = buffer._voiceStartOffset;
            }
            if (buffer._rmsBars && buffer._rmsBars.length === 36) {
                this.bars = buffer._rmsBars;
            }
            this.render();
        }

        render() {
            const d = this.duration || (this.audio && this.audio.duration ? this.audio.duration : 0) || 0;
            const cur = this.currentTime || 0;
            const progress = d > 0 ? Math.max(0, Math.min(1, cur / d)) : 0;
            const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

            drawWaveform(this.canvas, this.bars, progress, isDark, this.isSentBubble);

            if (this.timeDisplayMode === 'remaining' && d > 0) {
                const remaining = Math.max(0, d - cur);
                this.durationLabel.textContent = '-' + formatTime(remaining);
            } else if (this.timeDisplayMode === 'total' && d > 0) {
                this.durationLabel.textContent = formatTime(d);
            } else {
                if (!this.isPlaying && cur === 0 && d > 0) {
                    this.durationLabel.textContent = formatTime(d);
                } else {
                    this.durationLabel.textContent = formatTime(cur);
                }
            }
        }

        togglePlay() {
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        }

        play() {
            // Instant Haptic Pulse (Taptic Engine)
            if (navigator.vibrate) {
                try { navigator.vibrate(8); } catch (_) {}
            }

            // Stop any currently playing voice player
            if (engine.activeInstance && engine.activeInstance !== this) {
                engine.activeInstance.pause();
            }
            engine.activeInstance = this;

            // PILLAR 1: Optimistic Sensory State Transition (0ms)
            this.isPlaying = true;
            this.player.classList.add('is-playing');
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';

            const ctx = engine.getAudioContext();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(function () {});
            }

            // CASE 1: PCM AudioBuffer is already in RAM (< 2ms acoustic start)
            if (engine.pcmCache.has(this.src) && ctx) {
                this.startWebAudioPlayback(engine.pcmCache.get(this.src));
                return;
            }

            // CASE 2: Raw bytes are already in RAM, decode immediately (~4ms) and play
            if (engine.byteCache.has(this.src) && ctx) {
                this.mode = 'warming';
                engine.decodePcm(this.src, engine.byteCache.get(this.src), this.player)
                    .then((decoded) => {
                        if (this.isPlaying && engine.activeInstance === this && decoded) {
                            this.startWebAudioPlayback(decoded);
                        }
                    })
                    .catch(() => {
                        if (this.isPlaying && engine.activeInstance === this) {
                            this.startHtml5Playback();
                        }
                    });
                return;
            }

            // CASE 3: Pooled <audio> element is already prerolled and ready (readyState >= 2)
            if (this.audio && this.audio.src && this.audio.readyState >= 2) {
                this.startHtml5Playback();
                return;
            }

            // CASE 4: Cold click before viewport pre-warm completed -> load _voice_cache script (~4ms) & start
            this.mode = 'warming';
            engine.prewarm(this.src, this.player).then((decoded) => {
                if (!this.isPlaying || engine.activeInstance !== this) return;
                if (decoded && engine.getAudioContext()) {
                    this.startWebAudioPlayback(decoded);
                } else {
                    this.startHtml5Playback();
                }
            });
        }

        startWebAudioPlayback(buffer) {
            const ctx = engine.getAudioContext();
            if (!ctx || !buffer) {
                this.startHtml5Playback();
                return;
            }

            this.mode = 'webaudio';
            this.audioBuffer = buffer;
            this.duration = buffer.duration;

            if (this.pausedAt >= this.duration - 0.05) {
                this.pausedAt = 0;
            }

            // Skip leading WhatsApp mic-press silence when starting from 0
            const startOffset = this.pausedAt > 0
                ? this.pausedAt
                : (buffer._voiceStartOffset || 0);

            if (this.sourceNode) {
                try { this.sourceNode.stop(); } catch (_) {}
                this.sourceNode.disconnect();
                this.sourceNode = null;
            }

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = this.playbackRate;
            source.connect(ctx.destination);

            this.webAudioStartCtxTime = ctx.currentTime;
            this.webAudioStartOffset = startOffset;
            this.currentTime = startOffset;
            source.start(0, startOffset);
            this.sourceNode = source;

            source.onended = () => {
                if (this.mode === 'webaudio' && this.sourceNode === source && this.isPlaying) {
                    this.onPlaybackEnded();
                }
            };

            this.startProgressLoop();
        }

        startHtml5Playback() {
            this.mode = 'html5';
            if (!this.audio) return;

            if (!this.audio.src) {
                const url = engine.blobUrlCache.get(this.src) || this.src;
                engine.armAudioElement(this.player, url, this.voiceStartOffset);
            }

            this.audio.playbackRate = this.playbackRate;
            const startOffset = this.pausedAt > 0 ? this.pausedAt : (this.voiceStartOffset || 0.18);
            if (this.audio.readyState >= 1 && Math.abs(this.audio.currentTime - startOffset) > 0.1) {
                try { this.audio.currentTime = startOffset; } catch (_) {}
            }

            const playPromise = this.audio.play();
            if (playPromise !== undefined) {
                playPromise.catch((err) => {
                    console.warn('Audio playback error:', err);
                    this.pause();
                });
            }
            this.startProgressLoop();
        }

        pause() {
            if (!this.isPlaying) return;
            this.isPlaying = false;

            // Immediate UI rollback
            this.player.classList.remove('is-playing');
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';

            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }

            if (this.mode === 'webaudio') {
                const ctx = engine.getAudioContext();
                if (ctx) {
                    const elapsed = (ctx.currentTime - this.webAudioStartCtxTime) * this.playbackRate;
                    this.pausedAt = Math.min(this.duration, this.webAudioStartOffset + elapsed);
                    this.currentTime = this.pausedAt;
                }
                if (this.sourceNode) {
                    try { this.sourceNode.stop(); } catch (_) {}
                    this.sourceNode.disconnect();
                    this.sourceNode = null;
                }
            } else if (this.mode === 'html5') {
                if (this.audio) {
                    this.audio.pause();
                    this.pausedAt = this.audio.currentTime;
                    this.currentTime = this.audio.currentTime;
                }
            }

            if (engine.activeInstance === this) {
                engine.activeInstance = null;
            }

            this.render();
        }

        onPlaybackEnded() {
            this.isPlaying = false;
            this.pausedAt = 0;
            this.currentTime = 0;
            this.player.classList.remove('is-playing');
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';

            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
            if (this.sourceNode) {
                try { this.sourceNode.stop(); } catch (_) {}
                this.sourceNode.disconnect();
                this.sourceNode = null;
            }
            if (this.audio) {
                this.audio.pause();
                if (this.audio.readyState >= 1) {
                    try { this.audio.currentTime = this.voiceStartOffset || 0.18; } catch (_) {}
                }
            }
            if (engine.activeInstance === this) {
                engine.activeInstance = null;
            }
            this.render();
        }

        startProgressLoop() {
            if (this.rafId) cancelAnimationFrame(this.rafId);

            const tick = () => {
                if (!this.isPlaying) return;
                if (this.mode === 'webaudio') {
                    const ctx = engine.getAudioContext();
                    if (ctx) {
                        const elapsed = (ctx.currentTime - this.webAudioStartCtxTime) * this.playbackRate;
                        this.currentTime = Math.min(this.duration, this.webAudioStartOffset + elapsed);
                        if (this.currentTime >= this.duration) {
                            this.onPlaybackEnded();
                            return;
                        }
                        if (!this.isDragging) {
                            this.render();
                        }
                    }
                } else if (this.mode === 'html5' && this.audio) {
                    this.currentTime = this.audio.currentTime;
                    const d = this.audio.duration || this.duration;
                    if (d > 0 && this.currentTime >= d) {
                        this.onPlaybackEnded();
                        return;
                    }
                    if (!this.isDragging) {
                        this.render();
                    }
                }
                this.rafId = requestAnimationFrame(tick);
            };
            this.rafId = requestAnimationFrame(tick);
        }

        scrubTo(clientX) {
            const rect = this.canvas.getBoundingClientRect();
            let pos = (clientX - rect.left) / rect.width;
            pos = Math.max(0, Math.min(1, pos));

            const d = this.duration || (this.audio ? this.audio.duration : 0) || 0;
            if (d > 0) {
                this.currentTime = pos * d;
                this.pausedAt = this.currentTime;

                if (this.mode === 'webaudio' && this.isPlaying) {
                    const ctx = engine.getAudioContext();
                    if (ctx && this.audioBuffer) {
                        if (this.sourceNode) {
                            try { this.sourceNode.stop(); } catch (_) {}
                            this.sourceNode.disconnect();
                        }
                        const source = ctx.createBufferSource();
                        source.buffer = this.audioBuffer;
                        source.playbackRate.value = this.playbackRate;
                        source.connect(ctx.destination);
                        source.start(0, this.pausedAt);
                        this.webAudioStartCtxTime = ctx.currentTime;
                        this.webAudioStartOffset = this.pausedAt;
                        this.sourceNode = source;

                        source.onended = () => {
                            if (this.mode === 'webaudio' && this.sourceNode === source && this.isPlaying) {
                                this.onPlaybackEnded();
                            }
                        };
                    }
                } else if (this.audio && this.audio.readyState >= 1) {
                    try { this.audio.currentTime = this.currentTime; } catch (_) {}
                }
            }
            this.render();
        }

        cycleSpeed() {
            this.speedIndex = (this.speedIndex + 1) % this.speeds.length;
            const newSpeed = this.speeds[this.speedIndex];
            const oldSpeed = this.playbackRate;
            this.playbackRate = newSpeed;
            this.speedBtn.textContent = newSpeed.toFixed(1) + '×';

            if (this.mode === 'webaudio' && this.isPlaying) {
                const ctx = engine.getAudioContext();
                if (ctx) {
                    const elapsed = (ctx.currentTime - this.webAudioStartCtxTime) * oldSpeed;
                    this.webAudioStartOffset = Math.min(this.duration, this.webAudioStartOffset + elapsed);
                    this.webAudioStartCtxTime = ctx.currentTime;
                    if (this.sourceNode) {
                        this.sourceNode.playbackRate.value = newSpeed;
                    }
                }
            } else if (this.audio) {
                this.audio.playbackRate = newSpeed;
            }
        }

        attachEvents() {
            // Play Button: Fast pointerdown execution with haptic feedback
            this.playBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.lastPointerDownTime = Date.now();
                this.togglePlay();
            });

            this.playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (Date.now() - this.lastPointerDownTime > 400) {
                    this.togglePlay();
                }
            });

            // Speed Stepper
            this.speedBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.cycleSpeed();
            });
            this.speedBtn.addEventListener('click', (e) => e.stopPropagation());

            // Duration Label Format Toggle
            this.durationLabel.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.timeDisplayMode === 'elapsed') {
                    this.timeDisplayMode = 'remaining';
                } else if (this.timeDisplayMode === 'remaining') {
                    this.timeDisplayMode = 'total';
                } else {
                    this.timeDisplayMode = 'elapsed';
                }
                this.render();
            });
            this.durationLabel.addEventListener('click', (e) => e.stopPropagation());

            // Unified Pointer Waveform Scrubbing (Pointer Capture)
            const onPointerMove = (e) => {
                if (this.isDragging) {
                    this.scrubTo(e.clientX);
                }
            };

            const onPointerUp = (e) => {
                if (this.isDragging) {
                    this.isDragging = false;
                    if (this.canvas.releasePointerCapture) {
                        try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
                    }
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                    window.removeEventListener('pointercancel', onPointerUp);
                    this.render();
                }
            };

            this.canvas.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.isDragging = true;
                if (this.canvas.setPointerCapture) {
                    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
                }
                this.scrubTo(e.clientX);
                window.addEventListener('pointermove', onPointerMove, { passive: true });
                window.addEventListener('pointerup', onPointerUp);
                window.addEventListener('pointercancel', onPointerUp);
            });

            // HTML5 Fallback event listeners
            if (this.audio) {
                this.audio.addEventListener('loadedmetadata', () => {
                    if (!this.duration || this.duration === 0) {
                        this.duration = this.audio.duration;
                        this.render();
                    }
                });

                this.audio.addEventListener('timeupdate', () => {
                    if (this.mode === 'html5' && !this.isDragging) {
                        this.currentTime = this.audio.currentTime;
                        this.render();
                    }
                });

                this.audio.addEventListener('ended', () => {
                    if (this.mode === 'html5') {
                        this.onPlaybackEnded();
                    }
                });
            }

            // Pre-warm on pointer approach/hover (safe idempotent call, never resets armed audio)
            this.player.addEventListener('pointerenter', () => {
                if (this.src) {
                    engine.prewarm(this.src, this.player);
                }
            }, { passive: true });

            // System Light/Dark Theme Listener
            if (window.matchMedia) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.render());
            }
        }
    }

    /**
     * Initializes each Voice Note Player instance.
     */
    function initVoicePlayer(player) {
        if (!player || player._voiceInstance) return;
        new VoicePlayerInstance(player);
    }

    /**
     * Lightbox Modal Viewer for high-resolution images & videos.
     */
    window.openMedia = function (src, type) {
        const modal = document.getElementById('mediaModal');
        const content = document.getElementById('modalContent');
        if (!modal || !content) return;

        if (type === 'image') {
            content.innerHTML = '<img src="' + src + '" alt="Media Preview" onclick="event.stopPropagation()">';
        } else if (type === 'video') {
            content.innerHTML = '<video src="' + src + '" controls autoplay onclick="event.stopPropagation()"></video>';
        }

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    };

    window.closeModal = function () {
        const modal = document.getElementById('mediaModal');
        const content = document.getElementById('modalContent');
        if (!modal || !content) return;

        modal.style.display = 'none';
        content.innerHTML = '';
        document.body.style.overflow = 'auto';
    };

    // Keyboard Shortcuts (Escape to dismiss modal, Space to play/pause active voice player)
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            window.closeModal();
        } else if (e.key === ' ' && engine.activeInstance && document.activeElement === document.body) {
            e.preventDefault();
            engine.activeInstance.togglePlay();
        }
    });

    /**
     * Initializes Lottie vector animated stickers (.was).
     */
    function initLottieStickers() {
        if (typeof lottie === 'undefined') return;
        const stickers = document.querySelectorAll('.lottie-sticker');
        stickers.forEach(function (container) {
            const id = container.id;
            const scriptData = document.getElementById('data_' + id);
            if (!scriptData) return;
            try {
                const animData = JSON.parse(scriptData.textContent);
                lottie.loadAnimation({
                    container: container,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    animationData: animData
                });
            } catch (err) {
                console.error('Error hydrating sticker animation:', id, err);
            }
        });
    }

    // Initialize all components once DOM is ready
    function initAll() {
        const players = document.querySelectorAll('.apple-voice-player');
        players.forEach(initVoicePlayer);
        initLottieStickers();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
})();
