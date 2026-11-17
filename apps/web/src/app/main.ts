import { ImportController } from "../features/import/ImportController.js";

/** COMPOSITION ROOT: the only place concrete adapters are wired to core use cases. */
const root = document.querySelector<HTMLElement>("#app");
if (root) new ImportController(root).mount();
