# WhatsAppya 3-Phase Engine Parity, Virtualized Viewer, and Adaptive Multi-Chat Architecture

* **Author:** Mostafa Yaser
* **Date:** 2026-11-17

## Overview

WhatsAppya converts WhatsApp chat exports (`.zip` archives and local folders) into private, on-device, interactive chat views with zero server uploads. This proposal defines the three-phase plan to finish the TypeScript monorepo and mirror the core engine into native Swift for iOS:

1. **Phase 1 — Core Engine Parity:** Port the iOS and Android chat parsers and the timestamp, participant-direction, link, media, and sticker resolution rules from the legacy Python tool into `@whatsappya/core`, validated by shared golden-file JSON fixtures against `contracts/chat-session.schema.json`. Keep `WhatsAppyaCore` in native Swift, driven by a shared declarative `contracts/parser-rules.json` file consumed by both TypeScript and Swift so regexes and multilingual keywords never drift. Replace the fixed academic `Block › Subject › Chapter` model with a recursive folder-and-chat tree (`ArchiveFolder` / `ChatSession`), and replace whole-archive decompression in `ZipFileSource` with a Web Worker that indexes Zip headers via `Blob.slice` and extracts media on demand into a reference-counted Blob URL cache.
2. **Phase 2 — Virtualized Viewer and Spotlight Search (`⌘K`):** Build `<wa-message-list>` (using archetype-typed row pools, a Fenwick prefix-sum height tree, and coalesced single-`requestAnimationFrame` `ResizeObserver` updates), `<wa-voice-note>`, `<wa-sticker>`, `<wa-lightbox>`, and `<wa-search>` inside `@whatsappya/viewer`. Back Spotlight (`⌘K` / `Ctrl+K`) with a two-tier hybrid search engine: a compact `Uint32Array` posting-list index built in a background worker after first paint, with automatic normalized substring-scan fallback for punctuation, digits, URLs, and infixed matches. Extend `@whatsappya/exporter` to emit `file://`-compatible HTML folder bundles using classic inline IIFE scripts, relative `<audio>` elements with pre-computed waveform peaks, and opt-in `_voice_cache/` fallback via `--legacy-voice-cache`.
3. **Phase 3 — Adaptive Folder Sidebar and App Shell:** Build `<wa-split-view>` and `<wa-breadcrumbs>` that stay hidden when one chat is open and appear automatically when an archive holds multiple chats or nested folders, wired into `apps/web`, `apps/cli`, and `apps/ios`.

---

## Analysis

All seven Goldfish review lenses audited the existing repository files and stressed the proposed architecture against production, memory, compatibility, and maintainability limits.

### Reviewer Status

| Reviewer | Lens | Status |
| :--- | :--- | :--- |
| `egm-design` | System architecture, resource limits, performance | completed |
| `egm-codebase-details` | Telemetry, SRE debuggability, operational visibility | completed |
| `egm-zoom-out` | Complexity minimization, YAGNI, reuse | completed |
| `egm-comprehension` | UX clarity, developer ergonomics, edge cases | completed |
| `egm-implementation-readiness` | Migration, backward compatibility, rollout safety | completed |
| `egm-structural` | Long-term maintainability, SOLID boundaries, tech debt | completed |
| `egm-inventive-catalyst` | Contradiction analysis, inventive pattern resolutions | completed |

---

### Deduplicated Findings by Severity and Subsystem

#### 1. Blockers: Contract Drift Across Python, TypeScript, and Swift
* **Wire layout mismatch (`Models.swift` vs. `models.ts` and `chat-session.schema.json`):** `contracts/chat-session.schema.json` and `packages/core/src/domain/models.ts` flatten `rawDate`, `rawTime`, `sender`, `text`, and `kind` at the top level of `ChatMessage`. `apps/ios/Packages/WhatsAppyaKit/Sources/WhatsAppyaCore/Domain/Models.swift` nests those fields under `public let raw: RawMessage` and stores `timestamp` as `Date?` (which Swift's default `JSONEncoder` serializes as Apple-epoch numeric seconds rather than ISO-8601 strings). Swift `Codable` cannot decode or emit matching golden JSON until aligned.
* **Missing schema fields and untyped legacy bags:** `models.ts` defines `Attachment.isAnimated`, `ChatSession.dateOrder`, and `ChatSession.senderCounts`, which are absent from `contracts/chat-session.schema.json` and `Models.swift`. Meanwhile, `converter/pipeline/media.py` packs Ogg/Opus duration, `'animated_webp'`, and `.was` Lottie JSON strings into an untyped `extra_data` field, and `chat-session.schema.json` lacks `"additionalProperties": false`. No schema exists yet in `contracts/` for `ArchiveFolder`, shared parser rule tables, or link preview metadata.
* **Resolution:** Freeze a strict `contracts/chat-session.schema.json`, add `contracts/archive-tree.schema.json`, and extract all locale regex patterns, BiDi character sets, and multilingual keyword lists (`ENCRYPTION_KEYWORDS`, `DELETED_KEYWORDS`, `CALL_KEYWORDS`, `OMITTED_PHRASES`, `EDITED_PATTERN`) into `contracts/parser-rules.json` shared by both TypeScript (`@whatsappya/core`) and native Swift (`WhatsAppyaCore`). Enforce `"additionalProperties": false`, typed optional attachment metadata (`durationSeconds`, `isAnimated`, optional pre-computed 36-bar waveform peaks), canonical RFC 3339 millisecond UTC timestamps, and custom flat `CodingKeys` in `Models.swift`. Keep heavy Lottie JSON blobs out of `ChatSession` JSON so initial load stays small.

#### 2. Blockers: Zip Central Directory Limits, Single-Entry Discovery, and Memory Ceiling
* **Last 64 KB truncation and Zip64:** Reading only the trailing 64 KB fails whenever a 500 MB WhatsApp zip contains more than ~700 media entries, because the Central Directory (CD) can span 300 KB–1.2 MB; only the End of Central Directory (EOCD) record is guaranteed in the final ~65.5 KB. Seeking directly to `CD.localHeaderOffset` without inspecting the 30-byte Local File Header (LFH) also breaks decompression when LFH `extraFieldLength` differs from CD `extraFieldLength` (common in iOS/macOS archives).
* **`_chat.txt`-only extraction misses Android and multi-chat exports:** Android exports use `WhatsApp Chat with <Name>.txt` (and localized equivalents like `محادثة واتساب مع ...txt`), and nested archives hold multiple `.txt` files across subdirectories.
* **50,000-message allocation and Worker cloning breach `<= 60 MB` heap:** Holding raw text, `RawMessage[]`, `seed[]`, and multiple `PipelineStage` array copies (6 × 50,000 objects) alongside Worker `postMessage` structured cloning pushes peak JS heap past 60 MB before search indexing begins. Furthermore, inflating a single 50 MB `.mp4` attachment into a `Uint8Array` via `fflate.inflateSync` spikes heap past the entire 60 MB budget and wipes the 64 MB LRU cache.
* **Uncoordinated LRU `URL.revokeObjectURL` breaks active media:** An unpinned 64 MB LRU cache driven by scroll viewport visibility will revoke a `blob:` URL while `<wa-lightbox>` is open or `<wa-voice-note>` / `<video>` is playing off-screen.
* **Resolutions (Inventive Pattern — Two-Step Slice + Zero-Copy `STORE` + Reference-Counted Leases):**
  1. Perform a two-step tail read in the Zip Worker: read the last `65,557` bytes to locate EOCD (and Zip64 EOCD if sentinel values appear), then `Blob.slice(cdOffset, cdOffset + cdSize)` to index the entire CD (`path`, `method`, `compSize`, `uncompSize`, `lfhOffset`). Normalize Unicode NFC/NFD paths relative to each chat's folder prefix.
  2. Resolve `Attachment` metadata during parsing strictly from CD entries (`stat`/`has`) with zero attachment decompression.
  3. On lazy media read, inspect the 30-byte LFH for the exact payload offset. If the entry uses Zip `STORE` (`method === 0`, standard for `.jpg`, `.mp4`, `.opus`), return a zero-copy `zipBlob.slice(start, end, mimeType)` directly off the user's `File` handle with near-zero JS heap. Stream `DEFLATE` entries over 1 MB through `DecompressionStream` / chunked `fflate.Inflate` into `Blob` parts or OPFS.
  4. Replace raw Blob URL eviction with a reference-counted `MediaLease` (`acquire` / `release`) so active players and lightboxes stay pinned until closed or stopped.
  5. Mutate a single pre-sized message array in place inside the Worker (avoiding multi-stage `.map()` cloning), and transfer parsed data as a `Transferable` `ArrayBuffer` (or compact chunks with the first ~25 visible messages yielded first).

#### 3. Blockers: Eager Legacy Pipeline vs. Lazy Architecture & Parser Parity Bugs
* **Legacy `MediaResolver` breaks lazy loading and mutates disk files:** `converter/pipeline/media.py` eagerly opens `.was` archives, scans `.opus` headers to write `_voice_cache/*.js` files, and overwrites `.webp` files in place (`_ensure_webp_infinite_loop`). That behavior is impossible on read-only browser `Blob` slices and violates the 250 ms import budget.
* **Parser stubs diverge from Python:** `IosParser.ts` and `AndroidParser.ts` currently lack Arabic comma (`،`), Arabic AM/PM markers (`ص`/`م`), `\xa0` handling, and the `>= 25%` sample-line match threshold (`ios.py`), while `ConvertChat.ts` hardcodes `DateOrder.DayFirst`, skips Python's 3-tier `_resolve_participants` inference (`converter/service.py`), and silently drops sibling chats via `.find()`.
* **Resolutions:** Split parse-time classification (`Attachment` metadata from filename + CD size only) from lazy hydration (`.opus` duration/waveform, `.was` extraction, in-memory `.webp` loop patching) and export-time bundling. Port all Python regexes, BiDi stripping, deduplicated `EDITED_PATTERN` rules (sourced from `contracts/parser-rules.json`), 3-tier participant inference, and two-pass in-memory `DateOrder` disambiguation (scanning numeric date parts once `ChatMessage[]` is built, without re-reading the file).

#### 4. Blockers & Majors: Offline `file://` Bundle, CSP, and Opt-In `_voice_cache` Fallback
* **HTML spec and asset gaps:** An inline `<script defer>` tag ignores `defer` in HTML; inline `<script>` blocks break if bundled JS contains a raw `</script>` closing tag; `apps/web/index.html` sets `connect-src 'none'` and omits `worker-src`, blocking Vite `blob:` workers and `fetch(blobUrl)`.
* **Audio disk bloat, key encoding, and format mismatch:** `media.py` supports 7 `AUDIO_EXTS` (`.opus`, `.mp3`, `.ogg`, `.m4a`, `.wav`, `.aac`, `.caf`) under `_voice_cache/<filename>.js` using Python `urllib.parse.quote(filename)`. Generating `_voice_cache/` unconditionally adds ~133% Base64 storage overhead on top of raw audio files; calling files `*.opus.js` drops `.m4a`/`.mp3`; using JS `encodeURIComponent` diverges from Python `quote` on `(`, `)`, `!`, `'`, `*`; and identical filenames across chats in a multi-chat folder bundle collide in `window.__WA_VOICE_CACHE__`.
* **iOS Safari / `file://` playback blocks and `?replay=` breakage:** Async `<script>` injection on tap triggers `NotAllowedError` in iOS Safari unless `AudioContext.resume()` and media element priming run synchronously inside `pointerdown`. Appending `?replay=<timestamp>` to `blob:` URLs (`script.js`) breaks `blob:` lookups.
* **Single-file JSON bloat:** Embedding 50,000 messages inline in `<script id="chat-data">` delays initial FMP and forces synchronous main-thread parsing.
* **Resolutions:**
  * Separate `StandaloneHtmlExporter` (single-file inline archive) from `FolderBundleExporter` (HTML shell + relative media + sharded `_chat_data/<sessionId>.js`).
  * **Default audio path (`FolderBundleExporter`):** Use direct relative `<audio src="...">` elements (supported on `file://` in Chrome, Firefox, and Safari 17.4+) paired with pre-computed 36-bar waveform peaks + `durationSeconds` stored in message metadata so `<wa-voice-note>` draws accurate waveforms without fetching or decoding raw audio on page load.
  * **Opt-in `_voice_cache` fallback (`--legacy-voice-cache`):** Emit `_voice_cache/<sessionId>/<encodedFileName>.js` (supporting all 7 `AUDIO_EXTS` with canonical RFC 3986 key encoding, `AssetTransport` isolation, immediate deletion of `window.__WA_VOICE_CACHE__[key]` and removal of the `<script>` tag after decoding, and an in-memory diagnostic ring buffer on error) only when `--legacy-voice-cache` is requested for older offline browsers.
  * Place the classic IIFE `<script>` at document end (no `defer`), escape `</script>`, update `apps/web` CSP to `worker-src 'self' blob:; connect-src 'self' blob:;`, and re-trigger animated WebP replay via `URL.createObjectURL(cachedBlob)` or offscreen canvas reset instead of query strings.

#### 5. Majors: Virtualization, Two-Tier Hybrid Spotlight (`⌘K`), Adaptive Sidebar, and Cross-Runtime Cost
* **Dynamic virtualizer scroll jumps and recycled component state:** Updating a Fenwick tree via `ResizeObserver` when rows above the viewport resize (e.g., images loading) shifts scroll position unless compensated in the same `requestAnimationFrame` write pass. Recycling generic DOM rows across `<wa-voice-note>` and `<wa-sticker>` leaks playing audio or mismatched animations; CSS `position: sticky` date headers fail inside `transform: translateY()` rows; and >150k messages exceed ~17M px browser scroll-height limits.
  * *Resolution:* Use archetype-typed DOM row pools (`text`, `media`, `audio`, `system`, `date`) with `contain: layout style`, read `ResizeObserverEntry.borderBoxSize` only (never `offsetHeight`), coalesce Fenwick updates + `scrollTop += deltaAboveViewport` into one `rAF` pass, hoist audio playback state into an external `AudioPlaybackController` keyed by `messageId`, render sticky date headers as an external overlay, and scale virtual scroll coordinates above `10_000_000 px`.
* **Spotlight (`⌘K`) index footprint, substring limits, and shortcut collision:** `SearchIndex.ts` still references deleted `blockId/subjectId/chapterId` fields and synchronous `search()`. A naive `Map<string, Set<number>>` inverted index over 50,000 bilingual messages consumes 30–60 MB heap, fails on partial substrings/phone numbers/URLs, and competes with initial FMP if built before first paint. Binding `⌘F` hijacks native browser find-in-page.
  * *Resolution (Two-Tier Hybrid Search Engine):* Update `SearchQuery`/`SearchHit` to scope by `folderId`/`sessionId` and bind Spotlight exclusively to `⌘K` / `Ctrl+K` (preserving native `⌘F`).
    * *Tier 1:* Build a compact `Uint32Array` packed posting-list index + sorted token lexicon (`< 8 MB` heap for 50,000 messages) in a background worker post-FMP for `< 2 ms` word and prefix queries with Arabic diacritic (`tashkeel`) and letter normalization.
    * *Tier 2:* Automatically route queries containing punctuation, digits, URLs, or infixed substrings to a normalized linear substring scan (`< 10 ms` over cached text). Return only `[sessionId, docIndex, matchOffset]` from the worker so raw message strings are never duplicated across threads.
* **Multi-chat heap multiplication and false sidebar triggers:** Storing full `ChatSession.messages[]` inside every tree node (`hierarchy.ts`) explodes heap on multi-chat archives; meanwhile, macOS/WhatsApp exports often wrap a single `_chat.txt` inside one parent folder, causing naive `folderDepth > 0` checks to show a one-item sidebar.
  * *Resolution:* Separate lightweight `ChatSummaryNode` tree metadata from the active hydrated `ChatSession` (hydrating inactive chats on demand), and hide `<wa-split-view>` whenever total `sessionCount <= 1` (unwrapping single-child wrapper folders automatically), showing `<wa-breadcrumbs>` only when multi-chat navigation is active.
* **Three-runtime duplication and noisy CI gates:** Keeping Python, TypeScript, and Swift aligned across multilingual keyword lists risks drift, and fixed millisecond / 120 Hz `rAF` CI checks flake on virtualized 60 Hz GitHub runners where `performance.memory` ignores Web Worker heaps.
  * *Resolution:* Govern both `@whatsappya/core` and native `WhatsAppyaCore` from `contracts/parser-rules.json`, archive static golden JSON fixtures from Python before moving Python to `legacy/python/`, and pair pinned CDP Worker+Main heap (`measureUserAgentSpecificMemory`) and CPU trace (`0` forced reflows) checks with deterministic structural invariants (`bytesRead << zipSize`, `mountedNodes <= 60`).

---

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * Achieve golden-file parity between `@whatsappya/core`, native Swift `WhatsAppyaCore`, and static Python reference exports across iOS, Android, Arabic/English BiDi, calls, edits, deletions, links, stickers, and media attachments, governed by `contracts/chat-session.schema.json`, `contracts/archive-tree.schema.json`, and `contracts/parser-rules.json`.
  * Keep 500 MB zip import heap delta bounded (`<= 60 MB` across Main Thread + Workers) using two-step Zip Central Directory `Blob.slice` reads, zero-copy `STORE` slicing, lazy viewport decoding, and reference-counted 64 MB Blob URL LRU eviction.
  * Deliver `<wa-message-list>`, `<wa-voice-note>`, `<wa-sticker>`, `<wa-lightbox>`, and `⌘K` `<wa-search>` in `@whatsappya/viewer` with zero forced synchronous layouts during scroll and two-tier hybrid search under 10 ms at p99.
  * Support single-chat distraction-free viewing by default while revealing `<wa-split-view>` and `<wa-breadcrumbs>` automatically for multi-chat / multi-folder archives across Web, CLI bundle export, and iOS.
  * Preserve `file://` offline folder-bundle playback via classic inline IIFE bundles, relative `<audio>` elements with pre-computed waveform peaks, and opt-in `--legacy-voice-cache` script loading.
* **Out-of-Scope Non-Goals:**
  * Cloud servers, remote storage, telemetry egress, or server-side transcoding.
  * Live real-time WhatsApp message syncing or encrypted `.crypt14`/`.crypt15` SQLite database decryption.
  * Ongoing feature parity in the legacy Python scripts (`converter/`, `main.py`) once TypeScript passes golden-file parity and Python moves to `legacy/python/`.
  * Native Kotlin / Jetpack Compose Android UI (Android is served by the TypeScript PWA + Bubblewrap TWA).

---

## Alternatives Weighed

1. **Full In-Memory `fflate.unzipSync` at Import Time (`ZipFileSource.ts`)**
   * *Status:* Rejected by author: reading a 500 MB archive into RAM and decompressing all videos/audio up front freezes the main thread, blows the 60 MB heap ceiling, and crashes mobile Safari/Android browsers.
2. **Rigid `Block › Subject › Chapter` Academic Hierarchy (`hierarchy.ts`)**
   * *Status:* Rejected by author: hardcoding medical/university folder terms confuses general WhatsApp users; a recursive `ArchiveFolder` / `ChatSession` tree supports arbitrary depth (including academic layouts) while keeping single-chat mode completely unburdened.
3. **Migrating the Web Viewer to React or a Heavy Virtual-DOM Framework**
   * *Status:* Rejected by author: framework runtime overhead increases bundle size for single-file offline exports and slows startup on low-end Android phones compared to modular TypeScript Web Components.
4. **Eager OPFS Extraction of All Archive Media on Drop**
   * *Status:* Rejected by author: copying hundreds of megabytes of media into OPFS during import blocks initial render and triggers storage quota failures on large exports; OPFS will be optional archive-level caching only.
5. **Embedding `@whatsappya/core` inside `JavaScriptCore` on iOS**
   * *Status:* Rejected during design resolution: running the TypeScript parser inside `JavaScriptCore` forces a ~40–60 MB UTF-16 string and JSON bridge copy across the JS/Swift boundary and adds JS VM warmup latency inside iOS Share/app lifecycles. Keeping `WhatsAppyaCore` in native Swift and sharing `contracts/parser-rules.json` eliminates multi-language rule drift without bridge overhead.
6. **Naive `Map<string, Set<number>>` Inverted Index for Spotlight Search**
   * *Status:* Rejected during design resolution: object-per-posting maps consume 30–60 MB heap on 50,000 bilingual messages and miss partial substrings, phone numbers, and URLs. Replaced with the two-tier hybrid engine (`Uint32Array` packed postings + normalized linear substring scan fallback).
7. **Always Emitting `_voice_cache/*.js` on Every Export**
   * *Status:* Rejected by author: unconditional Base64 audio sidecar files add +133% audio disk bloat when Chrome, Firefox, and Safari 17.4+ already play relative `<audio src="...">` paths over `file://`. `_voice_cache/` is retained strictly as an opt-in `--legacy-voice-cache` fallback.

---

## Key Decisions & Staging for Next Steps

* **Key Decisions Resolved for `/egm-draft`:**
  1. Freeze `contracts/chat-session.schema.json`, add `contracts/archive-tree.schema.json`, and extract shared regex/keyword tables into `contracts/parser-rules.json` consumed by both `@whatsappya/core` (TS) and native `WhatsAppyaCore` (Swift), with flat `CodingKeys` and `"additionalProperties": false`.
  2. Enforce two-step Zip EOCD/CD slicing + LFH inspection + zero-copy `STORE` `Blob.slice` + reference-counted `MediaLease` cache in `@whatsappya/platform-web`.
  3. Decouple parse-time metadata in `@whatsappya/core` (zero attachment reads) from lazy viewport hydration and export packaging (`StandaloneHtmlExporter` vs. `FolderBundleExporter`), keeping `_voice_cache/` opt-in via `--legacy-voice-cache` and storing pre-computed 36-bar waveform peaks + `durationSeconds` for instant rendering.
  4. Build `<wa-message-list>` with archetype-typed DOM row pools, Fenwick height indexing, coalesced single-`rAF` `ResizeObserver` updates, and external `AudioPlaybackController`; pair `<wa-search>` (`⌘K`) with the two-tier `Uint32Array` posting index + normalized substring scan fallback.
  5. Replace `CurriculumRoot`/`BlockNode`/`SubjectNode`/`ChapterNode` with recursive `ArchiveFolder` / `ChatSummaryNode` (hydrating only active `ChatSession.messages[]`) and hide `<wa-split-view>` when `sessionCount <= 1`.
  6. Attach `correlationId`, `PerformanceMark` spans, PII-redacted `ConversionDiagnostics`, and CDP Worker+Main heap probes to CI gates alongside deterministic structural invariants.
* **Phased Staging:**
  * **Phase 1 (Contracts, Core Parity & Lazy Zip):** Freeze `contracts/` (`chat-session.schema.json`, `archive-tree.schema.json`, `parser-rules.json`), align `Models.swift`, commit synthetic `fixtures/golden/` outputs, port iOS/Android parsers + single-pass pipeline + `ArchiveFolder` to `@whatsappya/core`, and build the two-step `ZipFileSource` worker.
  * **Phase 2 (Virtualized Viewer, Hybrid Search & `file://` Exporter):** Build `<wa-message-list>`, `<wa-voice-note>`, `<wa-sticker>`, `<wa-lightbox>`, `⌘K` `<wa-search>`, and split `FolderBundleExporter` (with opt-in `--legacy-voice-cache`) / `StandaloneHtmlExporter`, wired to CDP performance and memory gates.
  * **Phase 3 (Adaptive Multi-Chat Shell & Platform Apps):** Build `<wa-split-view>` / `<wa-breadcrumbs>`, complete `apps/web` PWA + `apps/cli` parity (allowing legacy Python archival to `legacy/python/`), and implement native `apps/ios` SwiftUI + `ShareExtension`.
