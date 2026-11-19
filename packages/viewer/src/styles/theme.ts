/**
 * Shared Cupertino-inspired design tokens & Shadow DOM base styles.
 * Mirrors packages/design-tokens/tokens/color.json and motion.json.
 */
export const VIEWER_BASE_CSS = `
:host {
  --wa-bubble-sent: #DCF8C6;
  --wa-bubble-received: #FFFFFF;
  --wa-accent: #007AFF;
  --wa-canvas: #EFEAE2;
  --wa-surface: rgba(255, 255, 255, 0.88);
  --wa-text-primary: #111B21;
  --wa-text-secondary: #667781;
  --wa-border: rgba(0, 0, 0, 0.08);
  --wa-system-bg: rgba(255, 255, 255, 0.9);
  --wa-shadow-sm: 0 1px 2px rgba(11, 20, 26, 0.12);
  --wa-shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.22);
  --wa-spring: cubic-bezier(0.22, 1, 0.36, 1);
  --wa-duration-fast: 150ms;
  --wa-duration-base: 250ms;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: var(--wa-text-primary);
}

@media (prefers-color-scheme: dark) {
  :host {
    --wa-bubble-sent: #005C4B;
    --wa-bubble-received: #202C33;
    --wa-accent: #0A84FF;
    --wa-canvas: #0B141A;
    --wa-surface: rgba(32, 44, 51, 0.92);
    --wa-text-primary: #E9EDEF;
    --wa-text-secondary: #8696A0;
    --wa-border: rgba(255, 255, 255, 0.1);
    --wa-system-bg: rgba(32, 44, 51, 0.92);
    --wa-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35);
    --wa-shadow-lg: 0 20px 56px rgba(0, 0, 0, 0.55);
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
`;
