"use client";
// Root error boundary. Any uncaught throw in a Server or Client Component below
// the root layout renders THIS (branded) instead of Next's raw default screen.
// Keeps the "official records" trust framing intact even when something breaks.
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaces in Vercel logs; swap for a real reporter (Sentry/Axiom) when wired.
    console.error("[route error]", error);
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center px-5">
      <div className="max-w-md text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Something broke on our end
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-2">
          This one is on us, not you. The page hit an unexpected error. Try again, and if it keeps happening the data may be briefly unavailable.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-accent px-5 py-2.5 text-[15px] font-semibold text-white transition hover:opacity-90"
          >
            Try again
          </button>
          <a href="/" className="text-[15px] font-medium text-ink-2 transition hover:text-ink">
            Back to home
          </a>
        </div>
        {error.digest && (
          <p className="mt-6 text-[13px] text-ink-3">Reference: {error.digest}</p>
        )}
      </div>
    </main>
  );
}
