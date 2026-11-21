import type { FileSource } from "@whatsappya/core";
import {
  FileListSource,
  type NamedFile,
  OpfsArchiveStore,
  type StoredArchiveMeta,
  ZipFileSource,
  readDroppedFiles,
} from "@whatsappya/platform-web";
import { defaultMediaLeases } from "@whatsappya/viewer";
import {
  FileListMediaResolver,
  ZipMediaResolver,
  createConvertArchive,
} from "../../app/container.js";
import { consumeSharedExport } from "../../sw/registerSw.js";
import { ACTIVE_CHAT_STORAGE_KEY, ViewerController } from "../viewer/ViewerController.js";

/** Feature slice: instant zero-upload import of `.zip` archives, unzipped folders, or `_chat.txt`. */
export class ImportController {
  readonly #store = OpfsArchiveStore.isSupported() ? new OpfsArchiveStore() : null;
  #mountSeq = 0;

  constructor(private readonly root: HTMLElement) {
    this.root.addEventListener("wa-viewer-reset", () => this.mount({ autoRestore: false }));
  }

  mount(options: { autoRestore?: boolean } = { autoRestore: true }): void {
    const seq = ++this.#mountSeq;
    this.root.innerHTML = `
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%}
        .import-wrap{
          min-height:100vh;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:24px;
          background-color:#efeae2;
          background-image:radial-gradient(rgba(0,0,0,.035) 1px,transparent 1px);
          background-size:20px 20px;
          font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","SF Arabic",sans-serif;
          color:#111b21;
          -webkit-font-smoothing:antialiased;
        }
        @media(prefers-color-scheme:dark){
          .import-wrap{
            background-color:#0b141a;
            background-image:radial-gradient(rgba(255,255,255,.03) 1px,transparent 1px);
            color:#e9edef;
          }
        }
        .drop-card{
          width:min(460px,92vw);
          padding:40px 32px 34px;
          border-radius:24px;
          border:1.5px dashed rgba(0,122,255,.32);
          background:rgba(255,255,255,.92);
          backdrop-filter:blur(20px);
          -webkit-backdrop-filter:blur(20px);
          text-align:center;
          box-shadow:0 16px 48px rgba(0,0,0,.09);
          transition:transform 160ms cubic-bezier(.22,1,.36,1),border-color 160ms,box-shadow 160ms;
        }
        @media(prefers-color-scheme:dark){
          .drop-card{
            background:rgba(17,27,33,.92);
            border-color:rgba(10,132,255,.38);
            box-shadow:0 20px 56px rgba(0,0,0,.45);
          }
        }
        .drop-card.dragover{
          border-color:#007AFF;
          border-style:solid;
          transform:scale(1.015);
          box-shadow:0 0 0 4px rgba(0,122,255,.16),0 20px 56px rgba(0,0,0,.14);
        }
        .brand-icon{
          width:64px;
          height:64px;
          margin:0 auto 18px;
          border-radius:18px;
          background:linear-gradient(135deg,#25d366,#007aff);
          color:#fff;
          font-size:30px;
          display:flex;
          align-items:center;
          justify-content:center;
          box-shadow:0 8px 20px rgba(0,122,255,.28);
        }
        h1{font-size:24px;font-weight:700;letter-spacing:-.5px;margin-bottom:8px}
        .lead{font-size:14.5px;color:#667781;line-height:1.5;margin-bottom:26px}
        @media(prefers-color-scheme:dark){.lead{color:#8696a0}}
        .actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
        .btn{
          border:none;
          border-radius:12px;
          padding:11px 18px;
          font-family:inherit;
          font-size:14px;
          font-weight:600;
          cursor:pointer;
          transition:transform 120ms,filter 120ms;
        }
        .btn:active{transform:scale(.97)}
        .btn-primary{background:#007AFF;color:#fff;box-shadow:0 2px 8px rgba(0,122,255,.3)}
        .btn-primary:hover{filter:brightness(1.08)}
        .btn-secondary{background:rgba(120,120,128,.14);color:inherit}
        .btn-secondary:hover{background:rgba(120,120,128,.22)}
        .hint{margin-top:20px;font-size:12px;color:#667781}
        @media(prefers-color-scheme:dark){.hint{color:#8696a0}}
        .status{margin-top:12px;font-size:13px;font-weight:500;color:#007AFF;min-height:18px}
        .status.error{color:#ff3b30}
        .saved-bar{
          display:none;
          margin-top:16px;
          padding:10px 12px;
          border-radius:12px;
          background:rgba(0,122,255,.08);
          border:1px solid rgba(0,122,255,.22);
          align-items:center;
          justify-content:center;
          gap:8px;
          flex-wrap:wrap;
        }
        .saved-bar.visible{display:flex}
        .btn-compact{padding:7px 12px;font-size:12.5px;border-radius:9px}
      </style>
      <div class="import-wrap">
        <div class="drop-card">
          <div class="brand-icon" aria-hidden="true">💬</div>
          <h1>WhatsAppya</h1>
          <p class="lead">Drop your WhatsApp <strong>.zip</strong> export or <strong>unzipped folder</strong> here to open your chat instantly.</p>
          <div class="actions">
            <button class="btn btn-primary pick-zip" type="button">Choose .zip / .txt</button>
            <button class="btn btn-secondary pick-folder" type="button">Choose Unzipped Folder</button>
          </div>
          <input class="input-zip" type="file" accept=".zip,.txt" hidden />
          <input class="input-folder" type="file" webkitdirectory directory multiple hidden />
          <div class="saved-bar" aria-live="polite">
            <button class="btn btn-primary btn-compact resume-btn" type="button">Resume</button>
            <button class="btn btn-secondary btn-compact clear-saved-btn" type="button">Clear saved</button>
          </div>
          <div class="hint">100% private · Runs locally in your browser · Never uploaded</div>
          <div class="status" aria-live="polite"></div>
        </div>
      </div>
    `;

    const wrap = this.root.querySelector<HTMLDivElement>(".import-wrap");
    const card = this.root.querySelector<HTMLDivElement>(".drop-card");
    const zipBtn = this.root.querySelector<HTMLButtonElement>(".pick-zip");
    const folderBtn = this.root.querySelector<HTMLButtonElement>(".pick-folder");
    const zipInput = this.root.querySelector<HTMLInputElement>(".input-zip");
    const folderInput = this.root.querySelector<HTMLInputElement>(".input-folder");
    const savedBar = this.root.querySelector<HTMLDivElement>(".saved-bar");
    const resumeBtn = this.root.querySelector<HTMLButtonElement>(".resume-btn");
    const clearSavedBtn = this.root.querySelector<HTMLButtonElement>(".clear-saved-btn");
    const status = this.root.querySelector<HTMLDivElement>(".status");

    zipBtn?.addEventListener("click", () => zipInput?.click());
    folderBtn?.addEventListener("click", () => folderInput?.click());

    zipInput?.addEventListener("change", () => {
      const files = zipInput.files;
      if (files && files.length > 0) {
        const items: NamedFile[] = Array.from(files).map((f) => ({ path: f.name, file: f }));
        void this.#importItems(items, status);
      }
    });

    folderInput?.addEventListener("change", () => {
      const files = folderInput.files;
      if (files && files.length > 0) {
        const items: NamedFile[] = Array.from(files).map((f) => {
          const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
          return { path: rel && rel.length > 0 ? rel : f.name, file: f };
        });
        void this.#importItems(items, status);
      }
    });

    wrap?.addEventListener("dragover", (e) => {
      e.preventDefault();
      card?.classList.add("dragover");
    });
    wrap?.addEventListener("dragleave", (e) => {
      if (e.target === wrap) card?.classList.remove("dragover");
    });
    wrap?.addEventListener("drop", (e) => {
      e.preventDefault();
      card?.classList.remove("dragover");
      if (!e.dataTransfer) return;
      void readDroppedFiles(e.dataTransfer).then((items) => {
        if (items.length > 0) void this.#importItems(items, status);
      });
    });

    resumeBtn?.addEventListener("click", () => {
      void this.#restoreFromOpfs(status);
    });
    clearSavedBtn?.addEventListener("click", () => {
      savedBar?.classList.remove("visible");
      this.#clearActiveChatId();
      void this.#store?.clear();
    });

    void this.#bootstrapStartup(seq, options.autoRestore !== false, savedBar, resumeBtn, status);
  }

  async #bootstrapStartup(
    seq: number,
    autoRestore: boolean,
    savedBar: HTMLDivElement | null,
    resumeBtn: HTMLButtonElement | null,
    statusEl: HTMLDivElement | null,
  ): Promise<void> {
    // 1. Android Web Share Target takes top priority (`/?shared=1`)
    const sharedFile = await consumeSharedExport();
    if (seq !== this.#mountSeq) return;
    if (sharedFile) {
      await this.#importItems([{ path: sharedFile.name, file: sharedFile }], statusEl, true);
      return;
    }

    if (!this.#store) return;

    let meta: StoredArchiveMeta | null = null;
    try {
      meta = await this.#store.getMetadata();
    } catch {
      meta = null;
    }
    if (seq !== this.#mountSeq || !meta) return;

    // 2. Auto-restore saved chat across page reload unless user clicked "← Open"
    if (autoRestore) {
      const ok = await this.#restoreFromOpfs(statusEl);
      if (ok || seq !== this.#mountSeq) return;
    }

    // 3. Otherwise offer one-click Resume + Clear saved on the drop screen
    if (resumeBtn && savedBar) {
      resumeBtn.textContent = `Resume "${meta.rootName}"`;
      savedBar.classList.add("visible");
    }
  }

  async #restoreFromOpfs(statusEl: HTMLDivElement | null): Promise<boolean> {
    if (!this.#store) return false;
    if (statusEl) {
      statusEl.classList.remove("error");
      statusEl.textContent = "Restoring saved chat…";
    }

    try {
      const restored = await this.#store.load();
      if (!restored) {
        if (statusEl) statusEl.textContent = "";
        return false;
      }

      if (restored.kind === "zip") {
        await this.#importItems(
          [{ path: restored.file.name, file: restored.file }],
          statusEl,
          false,
          restored.rootName,
        );
      } else {
        await this.#importItems(restored.items, statusEl, false, restored.rootName);
      }
      return this.root.dataset.state === "ready";
    } catch {
      if (statusEl) statusEl.textContent = "";
      return false;
    }
  }

  async #importItems(
    items: readonly NamedFile[],
    statusEl: HTMLDivElement | null,
    persist = true,
    overrideRootName?: string,
  ): Promise<void> {
    ++this.#mountSeq;
    if (statusEl) {
      statusEl.classList.remove("error");
      statusEl.textContent = "Opening chat…";
    }

    try {
      let source: FileSource;
      let rootName = overrideRootName ?? "WhatsApp Chat";

      // Case 1: Single `.zip` archive dropped/selected
      const first = items[0];
      const isZip = Boolean(
        items.length === 1 && first && first.file.name.toLowerCase().endsWith(".zip"),
      );
      if (isZip && first) {
        const zipSource = await ZipFileSource.fromBlob(first.file);
        defaultMediaLeases.setResolver(new ZipMediaResolver(zipSource));
        source = zipSource;
        if (!overrideRootName) {
          rootName = first.file.name.replace(/\.zip$/i, "");
        }
      } else {
        // Case 2: Unzipped folder (containing `_chat.txt` + photos/audio/stickers) or single `.txt`
        const folderSource = new FileListSource(items);
        defaultMediaLeases.setResolver(new FileListMediaResolver(folderSource));
        source = folderSource;
        const firstSegment = first?.path.split("/")[0];
        if (!overrideRootName && firstSegment) {
          rootName = firstSegment.replace(/\.txt$/i, "");
        }
      }

      const result = await createConvertArchive().execute({
        files: source,
        rootName,
      });

      if (!result.ok) {
        this.root.dataset.state = "error";
        if (statusEl) {
          statusEl.classList.add("error");
          statusEl.textContent = `Could not open chat: ${result.error.message}`;
        }
        return;
      }

      if (persist) {
        this.#clearActiveChatId();
        void this.#persistInBackground(items, rootName, isZip);
      }

      this.root.dataset.state = "ready";
      const viewer = new ViewerController(this.root, source, result.value);
      await viewer.mount();
    } catch (err) {
      this.root.dataset.state = "error";
      if (statusEl) {
        statusEl.classList.add("error");
        statusEl.textContent = `Could not read export: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }

  async #persistInBackground(
    items: readonly NamedFile[],
    rootName: string,
    isZip: boolean,
  ): Promise<void> {
    if (!this.#store) return;
    try {
      const first = items[0];
      if (isZip && first) {
        await this.#store.saveZip(first.file, rootName);
      } else {
        await this.#store.saveFolder(items, rootName);
      }
    } catch {
      // Gracefully ignore Incognito / storage quota limits
    }
  }

  #clearActiveChatId(): void {
    try {
      sessionStorage.removeItem(ACTIVE_CHAT_STORAGE_KEY);
    } catch {
      // Ignore environments without sessionStorage
    }
  }
}
