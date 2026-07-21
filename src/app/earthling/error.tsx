"use client";
// Segment boundary for /earthling/* - these routes hit Neon at request time
// (leaderboard, profiles), so a DB outage throws in a Server Component. This
// keeps the failure inside the Earthling section with a scoped retry.
import { useEffect } from "react";

export default function EarthlingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[earthling error]", error);
  }, [error]);

  return (
    <main className="grid min-h-[60vh] place-items-center px-5">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Earthling is briefly unavailable
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-2">
          We couldn&apos;t load this right now, likely a momentary hiccup reaching our records. Give it another try.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-accent px-5 py-2.5 text-[15px] font-semibold text-white transition hover:opacity-90"
          >
            Try again
          </button>
          <a href="/passport" className="text-[15px] font-medium text-ink-2 transition hover:text-ink">
            Check a passport
          </a>
        </div>
      </div>
    </main>
  );
}
