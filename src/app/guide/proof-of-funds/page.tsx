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
// visa stays in that visa's own row note.
const COMMON_DOCUMENTS =
  "3-6 months of personal bank statements, income tax returns for the last 1-3 years, recent salary slips plus an employment or leave letter (business registration and accounts if self-employed), savings or fixed-deposit proof, and - if a third party is paying - a sponsorship letter with the sponsor's own statements, payslips and returns. Confirmed return travel and prepaid accommodation support every application.";

const COMMON_RED_FLAGS =
  "A large lump sum deposited shortly before applying with no documented source; borrowed or gifted money with no paper trail; a dormant, newly opened or erratic account with no regular salary credits; a balance that does not match your declared income or occupation; a balance that does not plausibly cover the trip and the flight home; and financial details that contradict the application form.";

// The dataset's official prose and the per-visa exceptions used to be printed
// twice - once as the row's guidance paragraph, once again as a "where the rules
// differ" bullet below. Merged here into one note per visa: the official
// requirement plus only what genuinely differs for that country. Every figure and
// rule from both sources is preserved; a record without an entry falls back to the
// dataset text.
const NOTES: Record<string, string> = {
  ARE: "Applies only to the self-sponsored 5-year multi-entry visa, documented across the 6 months before submission. Standard 30/60/90-day tourist visas sponsored by an airline, hotel or UAE resident publish no balance requirement at all.",
  AUS: "Judged under the Genuine Temporary Entrant test: cover accommodation, daily expenses, in-country travel and return transport, proportional to your itinerary. A sponsor files Form 1149 alongside their own financial evidence.",
  CAN: "IRCC asks for 'proof of sufficient funds to cover your travel and expenses in Canada', assessed case-by-case against trip length, accommodation and number of travellers. If someone else is funding the trip, their financial proof is required instead of yours.",
  CHN: "No single figure. The embassy in Pakistan sets USD 100 a day, Mumbai a flat INR 100,000 per applicant, Cebu a 6-month bank certificate with no amount - use the instructions of the post covering your address.",
  GBR: "UKVI requires only that you can pay for the return journey and 'support yourself without working or getting help from public funds'. Caseworkers weigh declared trip costs against your income credibility, and the Home Office may go back to your bank to verify statements.",
  IRL: "The visa officer decides whether you have 'adequate financial means' to support and accommodate yourself - or an Irish sponsor who can - without working or claiming public funds. Statements must be stamped originals on bank paper, with a written explanation for any unusual deposit or withdrawal.",
  JPN: "Consulates weigh bank statements, tax returns and employer or business proof; requirements are set per consulate or VFS jurisdiction and examiners can ask for more. Statements must be stamped originals - online printouts are generally refused.",
  KOR: "The embassy in India asks for 6 months of statements with no balance figure; the New York consulate advises a 3-month average above USD 3,000. Multiple-entry applications ask for two accounts and recent pay stubs.",
  MYS: "'Proof of sufficient funds for staying in Malaysia', presentable on arrival as cash, traveller's cheques, a debit or credit card, or a recognised e-wallet.",
  NZL: "NZD 1,000 a month if you pay your own accommodation, NZD 400 a month if it is already prepaid. Funds may be your own or an approved sponsor's, and money for the onward ticket must be shown separately.",
  SGP: "ICA requires 'sufficient funds for the length of intended stay' plus a confirmed onward or return ticket. Unemployed applicants file a Certificate of Bank Deposit, which has no minimum amount and only has to reflect real means.",
  THA: "THB 20,000 per person or THB 40,000 per family (about USD 550 / INR 47,000), as cash or foreign-currency equivalent checked at the border at the officer's discretion - not only on a statement. Applies to visa exemption, visa on arrival and embassy applications alike. Some official pages still cite an older THB 10,000 / 20,000; MFA pages use 20,000 / 40,000 for 2025-2026.",
  USA: "Under INA 214(b) you must show 'evidence of funds to cover your expenses' and pay all costs of the trip, weighed together with ties abroad such as job, family and property. An invitation letter or Affidavit of Support is explicitly not required and not a deciding factor.",
  schengen: "No EU-wide figure: each state fixes its own daily reference amount under Annex 25 of the EU Practical Handbook for Border Guards, and prepaid accommodation lowers it in several states - France's cited baseline is EUR 65 a day with accommodation paid, EUR 120 without. Travel insurance with EUR 30,000 of cover is a separate requirement.",
};

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
              <p className="mt-3 text-[12px] font-medium text-ink-mute sm:hidden">
                Both tables scroll sideways for the notes column →
              </p>
              <div className="card-doc mt-4 overflow-x-auto">
                <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
                  <colgroup>
                    <col className="w-[9rem]" />
                    <col className="w-[9rem]" />
                    <col className="w-[28rem]" />
                  </colgroup>
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
              financial profile. Reported ranges come from applicants, not from any threshold.
            </p>
            <div className="card-doc mt-4 overflow-x-auto">
              <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
                <colgroup>
                  <col className="w-[28rem]" />
                  <col className="w-[10rem]" />
                  <col className="w-[14rem]" />
                </colgroup>
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
                          <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">
                            {NOTES[p.key] ?? (hasFigure ? headline!.note : off.guidance)}
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
