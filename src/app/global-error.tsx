"use client";
// Global error boundary - catches throws in the ROOT layout itself (where the
// normal error.tsx can't reach). Must render its own <html>/<body>. Deliberately
// self-contained (no imported styles) so it works even if the layout failed.
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#F6F7F9",
          color: "#0B0E14",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 460 }}>
          <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
            Something broke on our end
          </h1>
          <p style={{ marginTop: 12, fontSize: 16, lineHeight: 1.6, color: "#525E6E" }}>
            The page hit an unexpected error. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "12px 22px",
              fontSize: 15,
              fontWeight: 600,
              color: "#fff",
              background: "#B23528",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
