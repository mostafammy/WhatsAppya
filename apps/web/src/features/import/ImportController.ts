import type { FileSource } from "@whatsappya/core";
import { ZipFileSource } from "@whatsappya/platform-web";
import { defaultMediaLeases } from "@whatsappya/viewer";
import { ZipMediaResolver, createConvertArchive } from "../../app/container.js";
import { consumeSharedExport } from "../../sw/registerSw.js";
import { ViewerController } from "../viewer/ViewerController.js";

/** Feature slice: drag-and-drop / file-picker import, 100% on-device. */
export class ImportController {
  constructor(private readonly root: HTMLElement) {
    this.root.addEventListener("wa-viewer-reset", () => this.mount());
  }

  mount(): void {
    this.root.innerHTML = `
      <style>
        .import-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#efeae2;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}
        @media(prefers-color-scheme:dark){.import-wrap{background:#0b141a;color:#e9edef}}
        .drop-zone{width:min(480px,92vw);padding:48px 32px;border-radius:24px;border:2px dashed rgba(0,122,255,.35);background:rgba(255,255,255,.9);text-align:center;cursor:pointer;box-shadow:0 12px 40px rgba(0,0,0,.08);transition:transform 150ms cubic-bezier(.22,1,.36,1),border-color 150ms}
        @media(prefers-color-scheme:dark){.drop-zone{background:#111b21}}
        .drop-zone.dragover{border-color:#007AFF;transform:scale(1.01)}
        .drop-zone h1{margin:0 0 8px;font-size:22px;font-weight:700}
        .drop-zone p{margin:0 0 20px;font-size:14px;color:#667781;line-height:1.5}
        .pill{display:inline-block;padding:10px 20px;border-radius:999px;background:#007AFF;color:#fff;font-weight:600;font-size:14px}
        .status{margin-top:16px;font-size:13px;color:#667781}
      </style>
      <div class="import-wrap">
        <label class="drop-zone">
          <h1>WhatsAppya</h1>
          <p>Drop your WhatsApp export (<code>.zip</code> or <code>_chat.txt</code>).<br>Everything stays 100% on your device.</p>
          <span class="pill">Choose Export File</span>
          <input type="file" accept=".zip,.txt" hidden />
          <div class="status" aria-live="polite"></div>
        </label>
      </div>
    `;

    const zone = this.root.querySelector<HTMLLabelElement>(".drop-zone");
    const input = this.root.querySelector<HTMLInputElement>("input");
    const status = this.root.querySelector<HTMLDivElement>(".status");

    input?.addEventListener("change", (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void this.#importFile(file, status);
    });

    zone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });
    zone?.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone?.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
      const file = e.dataTransfer?.files[0];
      if (file) void this.#importFile(file, status);
    });

    // Automatically open export handed off from Android Web Share Target (`/?shared=1`)
    void consumeSharedExport().then((sharedFile) => {
      if (sharedFile) void this.#importFile(sharedFile, status);
    });
  }

  async #importFile(file: File, statusEl: HTMLDivElement | null): Promise<void> {
    if (statusEl) statusEl.textContent = "Indexing archive…";
    try {
      let source: FileSource;
      if (file.name.toLowerCase().endsWith(".zip")) {
        const zipSource = await ZipFileSource.fromBlob(file);
        defaultMediaLeases.setResolver(new ZipMediaResolver(zipSource));
        source = zipSource;
      } else {
        const text = await file.text();
        defaultMediaLeases.setResolver(null);
        source = {
          list: async () => [{ path: file.name, sizeBytes: file.size }],
          readText: async () => text,
          readBytes: async () => new TextEncoder().encode(text),
        };
      }

      const result = await createConvertArchive().execute({
        files: source,
        rootName: file.name.replace(/\.(zip|txt)$/i, ""),
      });

      if (!result.ok) {
        this.root.dataset.state = "error";
        if (statusEl) statusEl.textContent = `Import failed: ${result.error.message}`;
        return;
      }

      this.root.dataset.state = "ready";
      const viewer = new ViewerController(this.root, source, result.value);
      await viewer.mount();
    } catch (err) {
      this.root.dataset.state = "error";
      if (statusEl) {
        statusEl.textContent = `Could not read export: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }
}
