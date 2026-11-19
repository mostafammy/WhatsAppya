/**
 * Shared Apple Human Interface Design System tokens & Shadow DOM base styles.
 * Matches canonical WhatsAppya `style.css` Light & Dark modes (SF Pro + SF Arabic).
 */
export const VIEWER_BASE_CSS = `
:host {
  --wa-bubble-sent: #D9FDD3;
  --wa-bubble-received: #FFFFFF;
  --wa-accent: #007AFF;
  --wa-sender-color: #027EB5;
  --wa-canvas: #EFEAE2;
  --wa-surface: rgba(255, 255, 255, 0.88);
  --wa-text-primary: #111B21;
  --wa-text-secondary: #667781;
  --wa-border: rgba(0, 0, 0, 0.08);
  --wa-system-bg: rgba(255, 252, 229, 0.94);
  --wa-system-text: #54656F;
  --wa-date-bg: rgba(255, 255, 255, 0.92);
  --wa-shadow-sm: 0 1px 1.5px rgba(11, 20, 26, 0.13);
  --wa-shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.22);
  --wa-spring: cubic-bezier(0.22, 1, 0.36, 1);
  --wa-duration-fast: 150ms;
  --wa-duration-base: 250ms;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Arabic", "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: var(--wa-text-primary);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

@media (prefers-color-scheme: dark) {
  :host {
    --wa-bubble-sent: #005C4B;
    --wa-bubble-received: #202C33;
    --wa-accent: #0A84FF;
    --wa-sender-color: #53BDEB;
    --wa-canvas: #0B141A;
    --wa-surface: rgba(17, 27, 33, 0.90);
    --wa-text-primary: #E9EDEF;
    --wa-text-secondary: #8696A0;
    --wa-border: rgba(255, 255, 255, 0.08);
    --wa-system-bg: rgba(24, 34, 41, 0.94);
    --wa-system-text: #FFD279;
    --wa-date-bg: rgba(24, 34, 41, 0.92);
    --wa-shadow-sm: 0 1px 1.5px rgba(0, 0, 0, 0.35);
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
