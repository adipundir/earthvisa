import type { Metadata } from "next";
import Link from "next/link";
import { dataset } from "@/lib/dataset";
import { isoToFlag } from "@/lib/format";
import EarthlingClaim from "@/components/EarthlingClaim";
import { leaderboard, earthlingCount } from "@/lib/earthling/store";

// Reads the Earthling store at request time - never prerendered.
export const dynamic = "force-dynamic";

const title = "How Far Can You Go? Claim Your Earthling ID";
const description =
  "See your personal reach - every destination your passport and visas unlock, computed from official sources - then claim your Earthling ID and take your place on the leaderboard.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://earthvisa.in/earthling" },
  openGraph: { title, description, url: "https://earthvisa.in/earthling", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default async function EarthlingPage({ searchParams }: { searchParams: Promise<{ verify?: string }> }) {
  const { verify } = await searchParams;
  const countries = dataset.allCountries.map((c) => ({ iso3: c.iso3, iso2: c.iso2, name: c.name }));
  const credentials = dataset.credentials.map((c) => ({ id: c.id, label: c.label }));
  const top = await leaderboard({ limit: 10 });
  const total = await earthlingCount();

  return (
    <main className="min-h-screen">
      <header className="border-b border-line-strong bg-paper-2/60">
        <div className="mx-auto w-full max-w-6xl px-5 pt-6 pb-8 sm:px-8">
          <nav className="mono mb-4 flex flex-wrap items-center gap-x-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
            <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
            <span aria-hidden>/</span>
            <span className="inline-flex min-h-[44px] items-center text-ink">Earthling</span>
          </nav>
          <div className="rule-double" />
          <h1 className="mt-6 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            How far can you go?
            <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
              Your passport sets the baseline. Your visas raise it.
            </span>
          </h1>
          <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
            {total > 0 ? `${total} Earthling${total === 1 ? "" : "s"} counted so far` : "Be Earthling #1"} · self-declared · official-source reach engine
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        {verify === "invalid" && (
          <p className="mono mt-8 rounded-sm border border-stamp/40 bg-stamp/[0.06] px-4 py-3 text-[12px] leading-relaxed text-stamp">
            That confirmation link is invalid or has expired. Links last 24 hours - claim your name again below
            and we&apos;ll send a fresh one.
          </p>
        )}
        <section className="mt-10 grid gap-12 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <EarthlingClaim countries={countries} credentials={credentials} />
          </div>

          <aside>
            <h2 className="font-display text-xl font-semibold text-ink">Leaderboard</h2>
            <p className="mt-1 text-sm text-ink-soft">Reach is personal: two holders of the same passport differ by the visas they carry.</p>
            {top.length === 0 ? (
              <p className="mono mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-center text-[12px] text-ink-mute">
                Nobody has claimed a spot yet. The #1 seat is open.
              </p>
            ) : (
              <ol className="mt-4 divide-y divide-line">
                {top.map((e, i) => (
                  <li key={e.username}>
                    <Link href={`/earthling/${e.username}`} className="flex min-h-[48px] items-center gap-3 py-2 transition hover:text-stamp">
                      <span className="mono w-6 text-right text-[13px] tabular-nums text-ink-mute">{i + 1}</span>
                      <span className="text-lg">{isoToFlag(dataset.allCountries.find((c) => c.iso3 === e.passports[0])?.iso2 ?? "")}</span>
                      <span className="font-display text-[15px] font-medium text-ink">@{e.username}</span>
                      <span className="mono ml-auto text-[14px] font-semibold tabular-nums text-stamp">{e.reach}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
            <Link href="/earthling/leaderboard" className="mono mt-4 inline-flex min-h-[44px] items-center text-[11px] font-medium uppercase tracking-[0.15em] text-stamp transition hover:text-ink">
              Full leaderboard →
            </Link>
          </aside>
        </section>

        <section className="mt-14 max-w-3xl border-t border-line pt-8">
          <h2 className="font-display text-xl font-semibold text-ink">How reach works</h2>
          <ul className="mt-3 max-w-3xl space-y-2 text-sm leading-relaxed text-ink-soft">
            <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>Reach counts every destination you can enter without arranging an embassy visa - visa-free, visa on arrival, or with an eTA/e-visa.</span></li>
            <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>Holding a strong third-country visa genuinely changes it: a US or Schengen visa unlocks dozens of extra destinations for many passports.</span></li>
            <li className="flex gap-3"><span aria-hidden className="mono text-stamp">→</span><span>The leaderboard is a game - your <Link href="/passport" className="text-stamp underline-offset-2 hover:underline">passport&apos;s official rules</Link> are not.</span></li>
          </ul>
        </section>
      </div>
    </main>
  );
}
