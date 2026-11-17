# Components (Custom Elements, no framework)

Each folder = one custom element, its styles, and its tests. Ported from root `script.js` / `style.css`.

| Element | Responsibility | Ported from |
|---|---|---|
| `<wa-message-list>` | Virtualized scrolling (renders only visible rows) | new — fixes 50k-message freeze |
| `<wa-voice-note>` | Waveform canvas, scrub, 1×/1.5×/2× | `script.js` voice player |
| `<wa-sticker>` | Lottie / animated WebP, viewport-gated playback | `script.js` sticker observer |
| `<wa-lightbox>` | Fullscreen media | `script.js` modal |
| `<wa-search>` | ⌘K / ⌘F full-text search + jump-to-date | new (promised in README) |
