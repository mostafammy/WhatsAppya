import { ZipFileSource } from "@whatsappya/platform-web";
import { createConvertChat } from "../../app/container.js";

/** Feature slice: drag-and-drop / file-picker import. */
export class ImportController {
  constructor(private readonly root: HTMLElement) {}

  mount(): void {
    this.root.innerHTML = `<label class="drop-zone">Drop your WhatsApp export (.zip)<input type="file" accept=".zip" hidden></label>`;
    this.root.querySelector("input")?.addEventListener("change", (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) void this.import(file);
    });
  }

  private async import(file: File): Promise<void> {
    const result = await createConvertChat().execute({ files: await ZipFileSource.fromBlob(file) });
    this.root.dataset.state = result.ok ? "ready" : result.error.code;
  }
}
