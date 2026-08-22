import type { Metadata } from "next";
import Link from "next/link";
import { allPof, pofFor, fmtMoney } from "@/lib/pof";
import { flagFor } from "@/lib/dataset";
import PofCard from "@/components/PofCard";
import ReportLine from "@/components/ReportLine";

const TITLE = "Proof of Funds for Visa 2026: How Much Bank Balance to Show";
const DESCRIPTION =
  "How much money to show in your bank statement for a Schengen, UK, US, Canada, Australia or other visa in 2026. Official minimums where they exist, plus what applicants actually report getting approved - from official sources and community reports.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | Earth Visa` },
  description: DESCRIPTION,
  alternates: { canonical: "https://earthvisa.in/guide/proof-of-funds" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "https://earthvisa.in/guide/proof-of-funds", type: "article" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// iso3 for the flag (country keys already ARE iso3; the bloc key has none).
const flagIso = (key: string) => (key === "schengen" ? undefined : key);

const schengen = pofFor("schengen");
// EUR-only: a few members (Czechia CZK, Poland PLN, Switzerland/Liechtenstein
// CHF) publish their daily rate in their own currency, not euros. Mixing those
// raw numbers into a euro min/max would overstate the range by 20x+ (Czechia's
// CZK 1,565 is roughly EUR 60-65, not "EUR 1565") - the per-member table below
// already shows each country's real currency, so this FAQ range stays EUR-only.
const schengenDaily = (schengen?.official.per_member ?? [])
  .filter((m) => m.currency === "EUR")
  .map((m) => m.amount)
  .filter((a): a is number => a != null);
const schengenLow = schengenDaily.length ? Math.min(...schengenDaily) : null;
const schengenHigh = schengenDaily.length ? Math.max(...schengenDaily) : null;

const FAQS = [
  {
    q: "How much bank balance do I need for a Schengen visa?",
    a: schengenLow != null
      ? `There is no single Schengen-wide figure - each Schengen country sets its own official daily subsistence amount, roughly EUR ${schengenLow} to EUR ${schengenHigh} per day, which you must be able to prove for the length of your trip. For a typical 7-10 day visit that puts the official minimum in the low hundreds to low thousands of euros. In practice, applicants are advised to show a stable balance comfortably above that (backed by 3-6 months of statements), because consulates assess your overall financial profile, not just a single number.`
      : `Each Schengen country publishes its own daily subsistence amount that you must prove for the length of your stay; there is no single Schengen-wide minimum. Show a stable balance comfortably above the daily rate for your trip length, backed by 3-6 months of bank statements.`,
  },
  {
    q: "Is 2 lakhs enough for a Schengen visa?",
    a: `For a short Schengen trip, roughly INR 2 lakh (about EUR 2,200) is generally considered a comfortable balance by many applicants, because the official daily subsistence requirement for a week-long visit typically totals only a few hundred to about a thousand euros. However, there is no official "2 lakh" rule - Schengen consulates assess your whole financial picture (stable statements, income, ties to your home country), so the same balance can be approved for one applicant and questioned for another. Treat it as a reasonable floor for a short trip, not a guarantee.`,
  },
  {
    q: "Do embassies publish a fixed minimum bank balance?",
    a: `Mostly no. Some do publish a hard figure - Thailand (THB 20,000 per person), New Zealand (NZD 1,000 per month), and each Schengen state's daily subsistence rate. But the UK, US, Canada, Australia, Ireland and most others publish no fixed number; their rule is simply that you must show "sufficient funds" to cover your trip without working or relying on public funds. For those, the amounts you see quoted online are applicant experience, not official thresholds.`,
  },
  {
    q: "What financial documents do I need to show?",
    a: `The common set is: 3-6 months of bank statements, income tax returns (ITR) for the last 1-3 years, recent salary slips or proof of income, and - if someone else is funding the trip - a sponsorship letter with the sponsor's own financial documents. Prepaid flight and accommodation bookings also reduce the funds you need to prove.`,
  },
  {
    q: "What money mistakes cause visa rejections?",
    a: `The most common is a large lump-sum deposit made just before applying with little prior transaction history - it looks like borrowed "show money." Others include a balance that dips below the required amount earlier in the statement period, funds that don't match your stated income, and borrowed or gifted money with no explanation. Consulates want to see a genuine, stable financial history, not a balance topped up for the application.`,
  },
];

const records = allPof();
const noFigureCount = records.filter((r) => !r.official.published).length;

export default function ProofOfFundsHub() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
          { "@type": "ListItem", position: 2, name: "Proof of Funds", item: "https://earthvisa.in/guide/proof-of-funds" },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="min-h-screen">
        <header className="border-b border-line-strong bg-paper-2/60">
          <div className="mx-auto w-full max-w-5xl px-5 pt-8 pb-10 sm:px-8">
            <nav aria-label="Breadcrumb" className="mono-chrome mb-4">
              <Link href="/" className="transition hover:text-ink">Earth Visa</Link>
              <span aria-hidden> / </span>
              <Link href="/guide" className="transition hover:text-ink">Guides</Link>
              <span aria-hidden> / </span>
              Proof of Funds
            </nav>
            <h1 className="text-display text-ink">
              Proof of Funds for a Visa
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                How much bank balance to show in 2026
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft">
              How much money you should have in your bank statement to get a visa approved - the{" "}
              <strong className="text-ink">official minimum where one exists</strong>, and{" "}
              <strong className="text-ink">what applicants actually report</strong> getting approved with.
            </p>

            {/* Jump nav - one chip per visa card below */}
            <nav aria-label="Jump to a visa" className="mt-6 flex flex-wrap gap-2">
              {records.map((p) => (
                <a
                  key={p.key}
                  href={`#${p.key.toLowerCase()}`}
                  className="mono inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-line bg-paper-2/70 px-3.5 py-2 text-[11px] uppercase tracking-[0.12em] text-ink-soft transition hover:border-line-strong hover:text-ink"
                >
                  <span aria-hidden className="text-sm leading-none">{p.key === "schengen" ? "🇪🇺" : flagFor(p.key)}</span>
                  {p.name}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8">
          {/* Schengen per-country subsistence table - the centrepiece */}
          {schengen && schengen.official.per_member.length > 0 && (
            <section className="mb-14">
              <h2 className="text-section text-ink">
                Schengen visa: daily funds required, by country
              </h2>
              <p className="text-body mt-2 max-w-2xl text-ink-soft">
                Each Schengen country sets its own official daily amount you must prove for the length of your stay.
                Multiply the daily rate by your number of days for the official minimum. Cyprus is included too -
                it is an EU member but not yet part of Schengen, and applies the same funds rule to its own
                national visa.
              </p>
              <p className="mono-chrome mt-4 sm:hidden">
                Swipe sideways for the notes column <span aria-hidden>→</span>
              </p>
              <div className="card-doc mt-2 overflow-x-auto sm:mt-5">
                <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line-strong bg-paper-2">
                      <th scope="col" className="mono-chrome px-4 py-2.5">Country</th>
                      <th scope="col" className="mono-chrome px-4 py-2.5">Daily amount</th>
                      <th scope="col" className="mono-chrome px-4 py-2.5">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schengen.official.per_member.map((m, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="px-4 py-2.5 font-display font-medium text-ink">{m.state}</td>
                        <td className="mono whitespace-nowrap px-4 py-2.5 tabular-nums text-ink">
                          {m.amount != null ? `${m.currency ?? ""} ${m.amount.toLocaleString()}` : "-"}
                          <span className="text-ink-mute"> / {m.basis}</span>
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-ink-soft">{m.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mono-chrome mt-2">
                {schengen.updated ? `Checked ${schengen.updated} · ` : ""}sourced directly from consulate publications
              </p>
            </section>
          )}

          {/* Per-visa cards */}
          <h2 className="text-section text-ink">Proof of funds by visa</h2>
          <p className="text-body mt-2 max-w-2xl text-ink-soft">
            {records.length} major visas, each with the official rule and what applicants report.{" "}
            {noFigureCount} of the {records.length} publish no fixed figure at all - for those, officers assess your
            whole financial profile against the trip, and the community-reported range is the only number available.
          </p>
          <p className="mt-3 max-w-2xl text-[12px] italic leading-relaxed text-ink-mute">
            Official figures are published government requirements. Community figures are compiled from Reddit and
            visa-forum reports - anecdotal experience, not an official threshold or a guarantee of approval.
          </p>
          <div className="mt-6 grid gap-5">
            {records.map((p) => <PofCard key={p.key} p={p} iso3={flagIso(p.key)} />)}
          </div>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">Proof of funds FAQ</h2>
            <div className="card-doc mt-5 divide-y divide-line px-5">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="group py-1">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-[15px] font-medium text-ink">
                    {q}
                    <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m4 6 4 4 4-4" /></svg>
                  </summary>
                  <p className="text-body mt-1 mb-3 max-w-3xl text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </section>

          <p className="text-body mt-10 max-w-3xl text-ink-soft">
            Related:{" "}
            <Link href="/guide/schengen" className="text-stamp underline-offset-2 hover:underline">Schengen visa guide</Link>,{" "}
            <Link href="/rankings" className="text-stamp underline-offset-2 hover:underline">passport ranking 2026</Link>.
          </p>
        </div>
        <ReportLine />
      </main>
    </>
  );
}
