import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[70vh] place-items-center px-5">
      <div className="text-center">
        <p className="mono text-[11px] uppercase tracking-[0.25em] text-stamp">Error 404</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Page not found
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-ink-soft">
          We couldn&apos;t find that page. It may have moved, or the address may be mistyped.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="mono rounded border border-stamp/30 bg-white px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-stamp transition hover:bg-stamp/[0.05]"
          >
            Passport Power →
          </Link>
          <Link href="/passport" className="mono text-[12px] uppercase tracking-[0.12em] text-ink-mute transition hover:text-ink">
            All passports
          </Link>
          <Link href="/destination" className="mono text-[12px] uppercase tracking-[0.12em] text-ink-mute transition hover:text-ink">
            All destinations
          </Link>
        </div>
      </div>
    </main>
  );
}
