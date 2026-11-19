import { VIEWER_BASE_CSS } from "../../styles/theme.js";

export interface BreadcrumbSegment {
  readonly id: string;
  readonly label: string;
}

/**
 * `<wa-breadcrumbs>`
 * Cupertino header bar showing the active curriculum path (`Block › Subject › Chapter`)
 * and a quick `⌘K` Spotlight search trigger button.
 */
export class WaBreadcrumbs extends HTMLElement {
  #segments: readonly BreadcrumbSegment[] = [];
  #nav: HTMLElement;
  #searchBtn: HTMLButtonElement;
  #toggleBtn: HTMLButtonElement;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        ${VIEWER_BASE_CSS}
        :host {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          height: 48px;
          padding: 0 16px;
          background: var(--wa-surface);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--wa-border);
          box-sizing: border-box;
        }
        .left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex: 1;
        }
        .sidebar-toggle {
          display: none;
          border: 1px solid var(--wa-border);
          background: transparent;
          color: var(--wa-text-primary);
          border-radius: 8px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 14px;
        }
        :host([has-sidebar]) .sidebar-toggle {
          display: inline-flex;
        }
        nav {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow: hidden;
          white-space: nowrap;
          font-size: 13.5px;
        }
        .crumb {
          border: none;
          background: transparent;
          color: var(--wa-text-secondary);
          font-family: inherit;
          font-size: inherit;
          cursor: pointer;
          padding: 3px 6px;
          border-radius: 6px;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .crumb:hover { background: var(--wa-border); color: var(--wa-text-primary); }
        .crumb[aria-current="page"] {
          color: var(--wa-text-primary);
          font-weight: 600;
          cursor: default;
        }
        .sep {
          color: var(--wa-text-secondary);
          opacity: 0.6;
          user-select: none;
        }
        .search-trigger {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--wa-border);
          background: rgba(120, 120, 128, 0.1);
          color: var(--wa-text-secondary);
          border-radius: 8px;
          padding: 5px 10px;
          font-size: 12.5px;
          font-family: inherit;
          cursor: pointer;
          flex-shrink: 0;
        }
        .search-trigger:hover { color: var(--wa-text-primary); }
        kbd {
          font-family: inherit;
          font-size: 11px;
          padding: 1px 5px;
          border-radius: 4px;
          background: var(--wa-border);
        }
      </style>
      <div class="left">
        <button class="sidebar-toggle" type="button" aria-label="Toggle navigation sidebar">☰</button>
        <nav aria-label="Breadcrumb"></nav>
      </div>
      <button class="search-trigger" type="button" aria-label="Search messages">
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>
    `;

    const nav = shadow.querySelector("nav");
    const searchBtn = shadow.querySelector<HTMLButtonElement>(".search-trigger");
    const toggleBtn = shadow.querySelector<HTMLButtonElement>(".sidebar-toggle");
    if (!nav || !searchBtn || !toggleBtn) throw new Error("WaBreadcrumbs shadow DOM failed");

    this.#nav = nav;
    this.#searchBtn = searchBtn;
    this.#toggleBtn = toggleBtn;

    this.#searchBtn.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("wa-search-open", { bubbles: true, composed: true }));
    });
    this.#toggleBtn.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("wa-sidebar-toggle", { bubbles: true, composed: true }));
    });
  }

  get segments(): readonly BreadcrumbSegment[] {
    return this.#segments;
  }

  set segments(value: readonly BreadcrumbSegment[]) {
    this.#segments = value;
    this.#render();
  }

  #render(): void {
    this.#nav.innerHTML = "";
    for (let i = 0; i < this.#segments.length; i++) {
      const seg = this.#segments[i];
      if (!seg) continue;
      if (i > 0) {
        const sep = document.createElement("span");
        sep.className = "sep";
        sep.setAttribute("aria-hidden", "true");
        sep.textContent = "›";
        this.#nav.appendChild(sep);
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "crumb";
      btn.dir = "auto";
      btn.textContent = seg.label;
      const isLast = i === this.#segments.length - 1;
      if (isLast) {
        btn.setAttribute("aria-current", "page");
      } else {
        btn.addEventListener("click", () => {
          this.dispatchEvent(
            new CustomEvent("wa-breadcrumb-select", {
              bubbles: true,
              composed: true,
              detail: { segment: seg, index: i },
            }),
          );
        });
      }
      this.#nav.appendChild(btn);
    }
  }
}

if (typeof customElements !== "undefined" && !customElements.get("wa-breadcrumbs")) {
  customElements.define("wa-breadcrumbs", WaBreadcrumbs);
}
