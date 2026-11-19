const SHARE_CACHE = "whatsappya-share-v1";
const SHARED_EXPORT_KEY = "/shared-export";

/** Registers the offline app-shell & Web Share Target Service Worker. */
export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal in environments where SW registration is blocked (e.g. private contexts)
    });
  });
}

/**
 * Checks whether the Service Worker cached an incoming Android Share Target file
 * (`/?shared=1`), consumes it once, and clears the query parameter.
 */
export async function consumeSharedExport(): Promise<File | null> {
  if (typeof window === "undefined" || typeof caches === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  if (params.get("shared") !== "1") return null;

  try {
    const cache = await caches.open(SHARE_CACHE);
    const response = await cache.match(SHARED_EXPORT_KEY);
    if (!response) return null;

    await cache.delete(SHARED_EXPORT_KEY);
    const blob = await response.blob();
    const rawName = response.headers.get("X-Filename");
    const fileName = rawName ? decodeURIComponent(rawName) : "shared-export.zip";

    // Clean ?shared=1 from URL bar without reload
    if (window.history?.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return new File([blob], fileName, { type: blob.type || "application/zip" });
  } catch {
    return null;
  }
}
