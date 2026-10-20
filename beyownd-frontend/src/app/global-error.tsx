"use client";

/* Last-resort boundary (root layout failed). Plain HTML, no app styles guaranteed. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, color: "#23262f" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontWeight: 300, fontSize: 40, letterSpacing: "-0.03em" }}>Something went wrong</h1>
          <p style={{ color: "#5d6475" }}>Please try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 16, height: 48, padding: "0 24px", borderRadius: 999, border: 0, background: "#3157e8", color: "#fff", fontSize: 16 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
