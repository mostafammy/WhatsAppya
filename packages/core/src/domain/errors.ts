/** Typed, exhaustive domain errors — UI layers map `code` to localized copy. */
export type ConversionError =
  | { readonly code: "CHAT_FILE_NOT_FOUND" }
  | { readonly code: "UNSUPPORTED_FORMAT"; readonly sample: string }
  | { readonly code: "EMPTY_CHAT" }
  | { readonly code: "IO_FAILURE"; readonly cause: unknown };
