import { type ChatSession, computeChatStats } from "@whatsappya/core";

/**
 * On-device Cupertino Chat Insights modal for the Web PWA.
 */
export function openStatsModal(session: ChatSession): void {
  const stats = computeChatStats(session);
  const existing = document.getElementById("wa-stats-overlay");
  existing?.remove();

  const overlay = document.createElement("div");
  overlay.id = "wa-stats-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:9995;background:rgba(11,20,26,.45);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif";

  const maxHour = Math.max(1, ...stats.hourlyActivity);
  const barsHtml = stats.hourlyActivity
    .map((count, hr) => {
      const pct = Math.max(6, Math.round((count / maxHour) * 100));
      return `<div title="${hr}:00 — ${count} messages" style="flex:1;height:${pct}%;background:#007AFF;border-radius:3px 3px 0 0;opacity:${count > 0 ? 0.9 : 0.2}"></div>`;
    })
    .join("");

  const participantsHtml = stats.participants
    .slice(0, 6)
    .map(
      (p) => `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
          <strong dir="auto">${escapeHtml(p.name)}</strong>
          <span style="color:#667781">${p.count.toLocaleString()} (${p.percentage}%)</span>
        </div>
        <div style="height:6px;background:rgba(120,120,128,.16);border-radius:999px;overflow:hidden">
          <div style="width:${p.percentage}%;height:100%;background:#007AFF;border-radius:999px"></div>
        </div>
      </div>`,
    )
    .join("");

  const mediaHtml =
    Object.entries(stats.mediaCounts)
      .map(
        ([kind, count]) =>
          `<span style="padding:4px 10px;border-radius:999px;background:rgba(0,122,255,.12);color:#007AFF;font-size:12px;font-weight:600">${escapeHtml(kind)}: ${count}</span>`,
      )
      .join("") || '<span style="font-size:12px;color:#667781">No media attachments</span>';

  const wordsHtml =
    stats.topWords
      .map(
        (w) =>
          `<span dir="auto" style="padding:3px 9px;border-radius:999px;background:rgba(120,120,128,.14);font-size:12px">${escapeHtml(w.word)} · ${w.count}</span>`,
      )
      .join("") || '<span style="font-size:12px;color:#667781">—</span>';

  overlay.innerHTML = `
    <div role="dialog" aria-modal="true" aria-label="Chat Insights" style="width:min(520px,94vw);max-height:86vh;overflow-y:auto;background:var(--wa-surface,#fff);color:var(--wa-text-primary,#111b21);border-radius:20px;padding:24px;box-shadow:0 20px 56px rgba(0,0,0,.28)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h2 style="margin:0;font-size:18px">Chat Insights · ${escapeHtml(session.contactName)}</h2>
        <button id="wa-stats-close" type="button" aria-label="Close insights" style="border:none;background:rgba(120,120,128,.15);color:inherit;width:30px;height:30px;border-radius:50%;cursor:pointer">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;text-align:center">
        <div style="padding:10px;border-radius:12px;background:rgba(120,120,128,.1)">
          <div style="font-size:20px;font-weight:700">${stats.totalMessages.toLocaleString()}</div>
          <div style="font-size:11.5px;color:#667781">Messages</div>
        </div>
        <div style="padding:10px;border-radius:12px;background:rgba(120,120,128,.1)">
          <div style="font-size:20px;font-weight:700">${stats.callCount.toLocaleString()}</div>
          <div style="font-size:11.5px;color:#667781">Calls</div>
        </div>
        <div style="padding:10px;border-radius:12px;background:rgba(120,120,128,.1)">
          <div style="font-size:20px;font-weight:700">${stats.editedCount.toLocaleString()}</div>
          <div style="font-size:11.5px;color:#667781">Edited</div>
        </div>
      </div>
      <h3 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;color:#667781">Participants</h3>
      <div style="margin-bottom:16px">${participantsHtml}</div>
      <h3 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;color:#667781">Hourly Activity (UTC)</h3>
      <div style="display:flex;align-items:flex-end;gap:3px;height:56px;margin-bottom:16px">${barsHtml}</div>
      <h3 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;color:#667781">Media</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">${mediaHtml}</div>
      <h3 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;color:#667781">Frequent Words</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${wordsHtml}</div>
    </div>
  `;

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#wa-stats-close")?.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
