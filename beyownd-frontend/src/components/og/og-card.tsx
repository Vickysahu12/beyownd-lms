/*
 * Shared 1200x630 Open Graph card (rendered by next/og, so inline styles only).
 * White canvas, the Beyownd mark, a big light headline, pastel tiles: the
 * same language as the site.
 */
export const ogSize = { width: 1200, height: 630 };

export function OgCard({ eyebrow, title, footer }: { eyebrow: string; title: string; footer: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", padding: 72, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <svg width="56" height="56" viewBox="0 0 64 64">
          <g transform="translate(2 -3.6) scale(1 1.13)">
            <path d="M14 13.5a3.5 3.5 0 0 1 3.5-3.5H24v15.2l13.6 7.3a1.4 1.4 0 0 1 0 2.5L19.5 50.6A3.6 3.6 0 0 1 14 47.6z" fill="#1c3260" />
            <path d="M24 31.6v9.4l8.4-4.7z" fill="#ffffff" />
            <path d="M26.5 10.5l23.6 19.7a2.3 2.3 0 0 1 0 3.5L33.6 47.6a2.6 2.6 0 0 1-3.9-3.3l11.1-11.1a1.5 1.5 0 0 0 0-2.1z" fill="#ec2a2f" />
          </g>
        </svg>
        <div style={{ fontSize: 40, fontWeight: 700, color: "#23262f", letterSpacing: -1.5 }}>Beyownd</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 30, color: "#3157e8" }}>{eyebrow}</div>
        <div style={{ fontSize: title.length > 44 ? 64 : 80, color: "#23262f", letterSpacing: -3, lineHeight: 1.05, marginTop: 14, maxWidth: 1000 }}>{title}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 28, color: "#5d6475" }}>{footer}</div>
        <div style={{ display: "flex", gap: 14 }}>
          {["#ece6ff", "#ddf3fd", "#ddf7e7", "#fff3c4"].map((c, i) => (
            <div key={c} style={{ width: 64, height: 64, borderRadius: i === 1 ? 32 : 18, background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}
