import { ImportController } from "../features/import/ImportController.js";
import { registerServiceWorker } from "../sw/registerSw.js";

/** COMPOSITION ROOT: the only place concrete adapters are wired to core use cases. */
registerServiceWorker();
const root = document.querySelector<HTMLElement>("#app");
if (root) new ImportController(root).mount();
