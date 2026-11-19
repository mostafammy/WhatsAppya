export { VIEWER_BASE_CSS } from "./styles/theme.js";
export {
  MediaLeaseManager,
  defaultMediaLeases,
  type MediaSourceResolver,
} from "./media/MediaLeaseManager.js";
export { FenwickTree } from "./components/message-list/FenwickTree.js";
export { WaMessageList } from "./components/message-list/WaMessageList.js";
export {
  AudioPlaybackController,
  defaultAudioController,
  type AudioPlaybackState,
  type PlaybackSpeed,
} from "./components/voice-note/AudioPlaybackController.js";
export { WaVoiceNote } from "./components/voice-note/WaVoiceNote.js";
export { WaSticker } from "./components/sticker/WaSticker.js";
export { WaLightbox, type LightboxItem } from "./components/lightbox/WaLightbox.js";
export { WaSearch, type AsyncSearchProvider } from "./components/search/WaSearch.js";
export {
  WaBreadcrumbs,
  type BreadcrumbSegment,
} from "./components/navigation/WaBreadcrumbs.js";
export {
  WaSplitView,
  countArchiveChats,
  unwrapSingleChat,
} from "./components/navigation/WaSplitView.js";

/** Registers all viewer custom elements. */
export const VIEWER_ELEMENTS = [
  "wa-message-list",
  "wa-voice-note",
  "wa-sticker",
  "wa-lightbox",
  "wa-search",
  "wa-split-view",
  "wa-breadcrumbs",
] as const;
