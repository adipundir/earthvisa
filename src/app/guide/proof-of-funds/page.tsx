import type { Metadata } from "next";
import Link from "next/link";
import { allPof, pofFor, fmtMoney } from "@/lib/pof";
import { flagFor } from "@/lib/dataset";
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
      ? `There is no Schengen-wide figure. Each country sets its own daily subsistence rate - roughly EUR ${schengenLow} to EUR ${schengenHigh} a day - which you must prove for the length of your trip, so a 7-10 day visit needs a few hundred to about a thousand euros on paper. Consulates judge the whole picture, so show a stable balance above that, backed by 3-6 months of statements.`
      : `Each Schengen country publishes its own daily subsistence rate, which you must prove for the length of your stay; there is no Schengen-wide minimum. Show a stable balance above that rate for your trip length, backed by 3-6 months of statements.`,
  },
  {
    q: "Is 2 lakhs enough for a Schengen visa?",
    a: `Usually yes for a short trip - about EUR 2,200, well above the few hundred to one thousand euros a week-long visit officially requires. But there is no "2 lakh" rule: consulates weigh stable statements, income and ties, so the same balance is approved for one applicant and questioned for another.`,
  },
  {
    q: "Do embassies publish a fixed minimum bank balance?",
    a: `Mostly no. Thailand (THB 20,000 per person), New Zealand (NZD 1,000 per month) and each Schengen state's daily rate publish hard figures. The UK, US, Canada, Australia, Ireland and most others only require "sufficient funds" for the trip without working or claiming public funds - the numbers quoted online for those are applicant experience, not thresholds.`,
  },
  {
    q: "What financial documents do I need to show?",
    a: `3-6 months of bank statements, income tax returns for the last 1-3 years, salary slips or other proof of income, and - if someone else is paying - a sponsorship letter with the sponsor's own documents. Prepaid flights and hotels reduce the funds you have to prove.`,
  },
  {
    q: "What money mistakes cause visa rejections?",
    a: `A large lump sum deposited just before applying, with no prior history, is the classic one - it reads as borrowed "show money". Others: a balance that dipped earlier in the statement period, funds that do not match your stated income, and gifted money with no explanation.`,
  },
];

const records = allPof();
const noFigureCount = records.filter((r) => !r.official.published).length;

// Community range is the first line of typical_approved (see data convention in
// data/proof-of-funds/*.json); the supporting sentence after it is anecdotal
// colour and is not repeated 14 times in the table.
const communityRange = (s: string) => (s.split("\n")[0] ?? "").trim();

// The per-visa document lists and red flags in the dataset are ~80% identical
// across all 14 records (3-6 months of statements, ITR, salary slips, a
// sponsor's own papers; lump-sum deposits, borrowed funds, thin history).
// Stated once here instead of once per visa. Only what genuinely differs by
// visa is listed in DIFFERENCES below.
const COMMON_DOCUMENTS =
  "3-6 months of personal bank statements, income tax returns for the last 1-3 years, recent salary slips plus an employment or leave letter (business registration and accounts if self-employed), savings or fixed-deposit proof, and - if a third party is paying - a sponsorship letter with the sponsor's own statements, payslips and returns. Confirmed return travel and prepaid accommodation support every application.";

const COMMON_RED_FLAGS =
  "A large lump sum deposited shortly before applying with no documented source; borrowed or gifted money with no paper trail; a dormant, newly opened or erratic account with no regular salary credits; a balance that does not match your declared income or occupation; a balance that does not plausibly cover the trip and the flight home; and financial details that contradict the application form.";

const DIFFERENCES: string[] = [
  "UAE: the USD 4,000 six-month balance applies only to the self-sponsored 5-year multi-entry visa. Standard 30/60/90-day tourist visas sponsored by an airline, hotel or resident publish no balance requirement at all.",
  "Thailand: THB 20,000 per person or THB 40,000 per family must be available as cash or equivalent at the border, checked at the officer's discretion - not only on a statement.",
  "New Zealand: NZD 400 a month instead of NZD 1,000 if accommodation is already paid for, and the money for your onward ticket must be shown separately.",
  "Schengen: travel insurance with EUR 30,000 of cover is a separate requirement, and prepaid accommodation lowers the daily rate in several states (France, Croatia).",
  "China: no single figure. Mumbai publishes INR 100,000 per applicant, Pakistan USD 100 a day, Cebu no figure at all - use the instructions of the post covering your address.",
  "South Korea: the New York consulate advises a 3-month average balance above USD 3,000; multiple-entry applications ask for two accounts and recent pay stubs.",
  "Ireland and Japan: statements must be originals on bank paper, stamped and signed - online printouts are generally refused. Ireland also wants a written explanation for any unusual deposit or withdrawal.",
  "Singapore: unemployed applicants file a Certificate of Bank Deposit, which has no minimum amount and only has to reflect real means.",
  "Australia: a sponsor files Form 1149 alongside their own financial evidence.",
  "United States: an invitation letter or Affidavit of Support is explicitly not required and is not a deciding factor; ties abroad are weighed with the money.",
  "Canada: if someone else is funding the trip, their financial proof is required instead of yours.",
  "United Kingdom: the Home Office may go back to your bank to verify submitted statements.",
  "Malaysia: funds must be presentable on arrival as cash, traveller's cheques, a debit or credit card, or a recognised e-wallet.",
];

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
          <div className="mx-auto w-full max-w-5xl px-5 pt-8 pb-8 sm:px-8">
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
              The official minimum where one exists, and what applicants report getting approved with.
            </p>

            {/* Jump nav - one anchor per visa row below, kept as a single dense
                line rather than 14 tap-target chips. */}
            <nav aria-label="Jump to a visa" className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-ink-soft">
              {records.map((p) => (
                <a
                  key={p.key}
                  href={`#${p.key.toLowerCase()}`}
                  className="py-1 underline-offset-2 transition hover:text-ink hover:underline"
                >
                  <span aria-hidden className="mr-1">{p.key === "schengen" ? "🇪🇺" : flagFor(p.key)}</span>
                  {p.name}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
          {/* Schengen per-country subsistence table - the centrepiece */}
          {schengen && schengen.official.per_member.length > 0 && (
            <section id="schengen" className="scroll-mt-24 mb-12">
              <h2 className="text-section text-ink">
                Schengen visa: daily funds required, by country
              </h2>
              <p className="text-body mt-2 max-w-2xl text-ink-soft">
                Multiply the daily rate by your number of days. Cyprus is not in Schengen but applies the same rule to
                its national visa.
              </p>
              <div className="card-doc mt-4 overflow-x-auto">
                <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line-strong bg-paper-2 text-[12px] font-semibold text-ink-mute">
                      <th scope="col" className="px-4 py-2.5">Country</th>
                      <th scope="col" className="px-4 py-2.5">Daily amount</th>
                      <th scope="col" className="px-4 py-2.5">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schengen.official.per_member.map((m, i) => (
                      <tr key={i} className="border-t border-line align-top">
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

          {/* Per-visa figures - one row each, replacing 14 stacked cards */}
          <section>
            <h2 className="text-section text-ink">Proof of funds by visa</h2>
            <p className="text-body mt-2 max-w-2xl text-ink-soft">
              {noFigureCount} of these {records.length} visas publish no fixed figure - officers judge your whole
              financial profile. Reported ranges are compiled from applicant reports, not official thresholds.
            </p>
            <div className="card-doc mt-4 overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line-strong bg-paper-2 text-[12px] font-semibold text-ink-mute">
                    <th scope="col" className="px-4 py-2.5">Visa</th>
                    <th scope="col" className="px-4 py-2.5">Official minimum</th>
                    <th scope="col" className="px-4 py-2.5">Applicants report</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((p) => {
                    const off = p.official;
                    const headline = off.daily_minimum ?? off.total_example;
                    const hasFigure = off.published && headline?.amount != null;
                    const iso3 = flagIso(p.key);
                    const source = headline?.source_url ?? p.sources[0];
                    return (
                      <tr
                        key={p.key}
                        // #schengen already anchors the daily-rate table above.
                        id={p.key === "schengen" ? undefined : p.key.toLowerCase()}
                        className="scroll-mt-24 border-t border-line align-top"
                      >
                        <td className="px-4 py-3">
                          <p className="font-display font-medium text-ink">
                            <span aria-hidden className="mr-1.5">{iso3 ? flagFor(iso3) : "🇪🇺"}</span>
                            {p.visa}
                          </p>
                          <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-ink-soft">
                            {hasFigure ? headline!.note : off.guidance}
                          </p>
                          {source && (
                            <a
                              href={source}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-[12px] text-ink-mute underline-offset-2 transition hover:text-ink hover:underline"
                            >
                              official source ↗
                            </a>
                          )}
                        </td>
                        <td className="mono whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-ink">
                          {hasFigure ? (
                            <>
                              {fmtMoney(headline!)}
                              {headline!.basis ? <span className="block text-[12px] font-normal text-ink-mute">{headline!.basis}</span> : null}
                            </>
                          ) : (
                            <span className="font-normal text-ink-mute">None published</span>
                          )}
                        </td>
                        <td className="mono px-4 py-3 text-[13px] tabular-nums text-ink-soft">
                          {p.community.typical_approved ? communityRange(p.community.typical_approved) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* The document set and the rejection triggers are near-identical for
              every visa above, so they are stated once here. */}
          <section className="mt-12 grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-sub text-ink">What to prepare, for any of them</h2>
              <p className="text-body mt-2 text-ink-soft">{COMMON_DOCUMENTS}</p>
            </div>
            <div>
              <h2 className="text-sub text-ink">What gets applications refused</h2>
              <p className="text-body mt-2 text-ink-soft">{COMMON_RED_FLAGS}</p>
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-section text-ink">Where the rules actually differ</h2>
            <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-ink-soft">
              {DIFFERENCES.map((d) => (
                <li key={d} className="border-l-2 border-line pl-3">{d}</li>
              ))}
            </ul>
          </section>

          {/* FAQ */}
          <section className="mt-12">
            <h2 className="text-section text-ink">Proof of funds FAQ</h2>
            <div className="card-doc mt-4 divide-y divide-line px-5">
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

          <p className="text-body mt-8 max-w-3xl text-ink-soft">
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
