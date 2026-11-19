import type { MediaKind } from "../domain/enums.js";

export const BIDI_REGEX = /[\u200e\u200f\u202a\u202b\u202c\u202d\u202e\ufeff\u00a0]/g;

export const IOS_LINE_PATTERN =
  /^\[([0-9]{1,4}[/.-][0-9]{1,2}[/.-][0-9]{1,4})[,\s\u060c]+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?(?:\s*(?:[apAP]\.?[mM]\.?|[\u0635\u0645]))?)\]\s*(.*)$/;

export const ANDROID_LINE_PATTERN =
  /^([0-9]{1,4}[/.-][0-9]{1,2}[/.-][0-9]{1,4})[,\s\u060c]+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?(?:\s*(?:[apAP]\.?[mM]\.?|[\u0635\u0645]))?)\s*-\s*(.*)$/;

export const EDITED_PATTERN =
  /\s*<(?:\s*(?:This message was edited|\u062a\u0645 \u062a\u0639\u062f\u064a\u0644 \u0647\u0630\u0647 \u0627\u0644\u0631\u0633\u0627\u0644\u0629|Ce message a \u00e9t\u00e9 modifi\u00e9|Diese Nachricht wurde bearbeitet|Questo messaggio \u00e8 stato modificato|Este mensaje fue editado|Esta mensagem foi editada)\s*)>\s*$/im;

export const ENCRYPTION_KEYWORDS = [
  "\u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0648\u0627\u0644\u0645\u0643\u0627\u0644\u0645\u0627\u062a \u0645\u0634\u0641\u0631\u0629",
  "end-to-end encrypted",
  "chifr\u00e9s de bout en bout",
  "verschl\u00fcsselt",
  "crittografati end-to-end",
] as const;

export const DELETED_KEYWORDS = [
  "This message was deleted",
  "You deleted this message",
  "\u062a\u0645 \u062d\u0630\u0641 \u0647\u0630\u0647 \u0627\u0644\u0631\u0633\u0627\u0644\u0629",
  "\u062d\u0630\u0641 \u0647\u0630\u0647 \u0627\u0644\u0631\u0633\u0627\u0644\u0629",
  "\u0644\u0642\u062f \u062d\u0630\u0641\u062a \u0647\u0630\u0647 \u0627\u0644\u0631\u0633\u0627\u0644\u0629",
] as const;

export const CALL_KEYWORDS = [
  "\u0645\u0643\u0627\u0644\u0645\u0629 \u0635\u0648\u062a\u064a\u0629",
  "\u0645\u0643\u0627\u0644\u0645\u0629 \u0641\u064a\u062f\u064a\u0648",
  "Missed voice call",
  "Missed video call",
  "Voice call",
  "Video call",
] as const;

export const OMITTED_PHRASES = [
  "<Media omitted>",
  "<\u0645\u0644\u0641 \u0648\u0633\u0627\u0626\u0637 \u062a\u0645 \u062d\u0630\u0641\u0647>",
  "\u0644\u0645 \u064a\u062a\u0645 \u0625\u062f\u0631\u0627\u062c \u0627\u0644\u0635\u0648\u0631\u0629",
  "\u0644\u0645 \u064a\u062a\u0645 \u0625\u062f\u0631\u0627\u062c \u0627\u0644\u0641\u064a\u062f\u064a\u0648\u0647\u0627\u062a",
  "\u0644\u0645 \u064a\u062a\u0645 \u0625\u062f\u0631\u0627\u062c \u0645\u0644\u0641 \u0635\u0648\u062a\u064a",
  "\u0644\u0645 \u064a\u062a\u0645 \u0625\u062f\u0631\u0627\u062c \u0627\u0644\u0645\u0633\u062a\u0646\u062f",
  "\u0644\u0645 \u064a\u062a\u0645 \u0625\u062f\u0631\u0627\u062c \u0627\u0644\u0645\u0644\u0635\u0642",
  "<\u0645\u0644\u0635\u0642 \u062a\u0645 \u0627\u0633\u062a\u0628\u0639\u0627\u062f\u0647>",
  "sticker omitted",
  "<sticker omitted>",
  "Sticker omitted",
  "<\u062a\u0645 \u0627\u0633\u062a\u0628\u0639\u0627\u062f \u0627\u0644\u0648\u0633\u0627\u0626\u0637>",
] as const;

export const IOS_ATTACH_PATTERN = /<[^:>]+:\s*([^>]+)>/;
export const ANDROID_ATTACH_PATTERN =
  /(.+?)\s*\((?:file attached|\u0645\u0644\u0641 \u0645\u0631\u0641\u0642)\)/i;

export const SELF_PHRASES = [
  "You turned ",
  "You deleted ",
  "You changed ",
  "\u0623\u0646\u062a \u062d\u0630\u0641\u062a",
  "\u0642\u0645\u062a \u0628",
] as const;

export const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".heic"]);
export const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv", ".3gp", ".webm"]);
export const AUDIO_EXTENSIONS = new Set([".opus", ".mp3", ".ogg", ".m4a", ".wav", ".aac", ".caf"]);
export const PDF_EXTENSIONS = new Set([".pdf"]);
export const DOC_EXTENSIONS = new Set([
  ".docx",
  ".doc",
  ".xlsx",
  ".xls",
  ".pptx",
  ".ppt",
  ".txt",
  ".csv",
  ".zip",
]);
export const STICKER_EXTENSIONS = new Set([".was", ".webp"]);

export const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".opus": "audio/ogg; codecs=opus",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".pdf": "application/pdf",
  ".was": "application/json",
};

export function classifyExtension(ext: string): MediaKind {
  const lower = ext.toLowerCase();
  if (IMAGE_EXTENSIONS.has(lower)) return "image";
  if (VIDEO_EXTENSIONS.has(lower)) return "video";
  if (AUDIO_EXTENSIONS.has(lower)) return "audio";
  if (PDF_EXTENSIONS.has(lower)) return "pdf";
  if (DOC_EXTENSIONS.has(lower)) return "document";
  return "file";
}

export function resolveMimeType(ext: string): string {
  return MIME_MAP[ext.toLowerCase()] ?? "application/octet-stream";
}

export function stripBidi(text: string): string {
  return text.replace(BIDI_REGEX, "");
}
