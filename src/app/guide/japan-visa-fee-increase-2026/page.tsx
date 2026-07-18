import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameFor, nameToSlug } from "@/lib/dataset";
import { isUsefulCorridor, DEMONYM } from "@/lib/corridors";
import CorridorLinks from "@/components/CorridorLinks";

// ---------------------------------------------------------------------------
// /guide/japan-visa-fee-increase-2026 - "japan visa fee increase", "japan visa
// fee 2026", "japan visa cost july 2026"
//
// Breaking-news explainer for Japan's first visa-fee revision since 1978
// (Cabinet decision 19 June 2026, effective for applications from 1 July
// 2026). The headline coverage ("fees up ~400%") never breaks the increase
// down by category or clarifies who actually pays it - Japan's visa-EXEMPT
// list (75 countries/regions in our dataset) is unchanged, so most Western
// passports are unaffected. Every "who pays / who's exempt" claim on this
// page is computed from dataset.passportAccess at build time; only the fee
// figures themselves (JPY 3,000/6,000 -> 15,000/30,000, effective date,
// Cabinet decision date) are researched constants, cross-referenced against
// the already-updated notes in data/countries/JPN.json's visa_types entries.
// ---------------------------------------------------------------------------

const MOFA_FEE_URL = "https://www.mofa.go.jp/j_info/visit/visa/procedure/pagewe_000001_00391.html";
const MOFA_EXEMPTION_URL = "https://www.mofa.go.jp/j_info/visit/visa/short/novisa.html";
const CONSULATE_DETROIT_URL = "https://www.detroit.us.emb-japan.go.jp/itpr_ja/11_000001_00249.html";

// Sample of nationalities readers actually search "japan visa fee for X" about
// who are visa-exempt and therefore NOT affected by this fee change.
const SAMPLE_VISA_FREE = ["USA", "GBR", "CAN", "AUS", "FRA", "DEU", "KOR", "SGP", "BRA", "MEX", "ARE", "ISR"];

// Large visa-required source markets - these travellers DO pay the new fee.
// Each is cross-checked against the dataset (no visa-free/e-visa access edge)
// before being shown as "affected", and only linked as a corridor if that
// corridor page actually exists (isUsefulCorridor).
const VISA_REQUIRED_CANDIDATES = ["IND", "CHN", "VNM", "PHL", "NGA", "BGD", "PAK"];

const JPN = "JPN";

function accessTo(nat: string, dest: string) {
  return (dataset.passportAccess[nat] ?? []).find((e) => e.dest === dest) ?? null;
}

const title = "Japan Visa Fee Increase 2026: Old vs New Fees, Effective Date & Who's Exempt";
const description =
  "Japan raised its visa fees for the first time since 1978, effective 1 July 2026: the single-entry fee rose from JPY 3,000 to JPY 15,000 and multiple-entry from JPY 6,000 to JPY 30,000 (~5x). Exact fees by visa category, official sources, and who is unaffected - Japan's visa-exempt nationalities.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "japan visa fee increase",
    "japan visa fee 2026",
    "japan visa cost july 2026",
    "japan visa fee hike",
    "japan visa price increase",
    "japan single entry visa fee",
    "japan multiple entry visa fee",
    "new japan visa fees",
    "japan visa fee for indian citizens",
    "japan visa fee for chinese citizens",
    "do us citizens need a japan visa",
    "japan visa exempt countries",
  ],
  alternates: { canonical: "https://earthvisa.in/guide/japan-visa-fee-increase-2026" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/guide/japan-visa-fee-increase-2026",
    type: "article",
  },
  twitter: { card: "summary_large_image", title, description },
};

// aria-hidden chevron that rotates when its parent <details> is open.
function Chevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-3.5 shrink-0 text-ink-mute transition-transform duration-200 group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function JapanVisaFeeIncreaseGuidePage() {
  const jpnTypes = dataset.destinationVisaTypes[JPN] ?? [];
  const singleEntryGroup = jpnTypes.filter((t) => /15,000/.test(t.notes ?? ""));
  const multipleEntryGroup = jpnTypes.filter((t) => /30,000/.test(t.notes ?? ""));
  const otherGroup = jpnTypes.filter((t) => !/15,000/.test(t.notes ?? "") && !/30,000/.test(t.notes ?? ""));

  const jpnSummary = dataset.countries.find((c) => c.iso3 === JPN);
  const visaFreeCount = jpnSummary?.visaPolicyCounts.visa_free ?? null;

  // Nationalities the dataset confirms are visa-free to Japan today - the
  // fee increase does not apply to them at all.
  const visaFreeSamples = SAMPLE_VISA_FREE
    .map((iso3) => ({ iso3, edge: accessTo(iso3, JPN) }))
    .filter((x) => x.edge?.level === "visa_free");

  // Nationalities the dataset confirms have NO access edge to Japan (visa
  // required) - these travellers pay the new fee. Only linked as a corridor
  // when a real corridor page exists.
  const visaRequiredSamples = VISA_REQUIRED_CANDIDATES.filter((nat) => !accessTo(nat, JPN));
  const corridorLinks = visaRequiredSamples
    .filter((nat) => isUsefulCorridor(nat, JPN))
    .map((nat) => ({
      href: `/passport/${nameToSlug(nameFor(nat))}/${nameToSlug(nameFor(JPN))}`,
      label: `Japan visa for ${DEMONYM[nat] ?? nameFor(nat)} citizens`,
      iso3: nat,
    }));

  // The two nationalities whose exemption is conditional on ePassport type -
  // the most common "wait, do I pay or not?" edge case.
  const idnEdge = accessTo("IDN", JPN);
  const thaEdge = accessTo("THA", JPN);

  const faqs = [
    {
      q: "Did Japan really increase its visa fees in 2026?",
      a: `Yes. Japan's Cabinet approved the change on 19 June 2026, and it took effect for visa applications submitted on or after 1 July 2026 - the first revision to Japan's visa fee schedule since 1978. The consular single-entry visa issuance fee rose from JPY 3,000 to JPY 15,000, and the multiple-entry fee rose from JPY 6,000 to JPY 30,000 - both roughly a 5x increase (about 400%).`,
    },
    {
      q: "How much does a Japan visa cost now?",
      a: `As of 1 July 2026, the standard consular visa issuance fee is JPY 15,000 (roughly $90-100) for single-entry categories - this covers the Temporary Visitor (tourist) visa and most work, study and family long-term visa categories in our dataset${singleEntryGroup.length ? `, ${singleEntryGroup.length} categories in total` : ""}. The multiple-entry Short-Term Business visa costs JPY 30,000 (roughly $180-200). These are the government's own issuance fees, charged at the embassy or consulate when the visa is issued - separate from any agency or VFS service charge.`,
    },
    {
      q: "Do US, UK, Canadian, Australian or European citizens have to pay this fee?",
      a: `No - not if you are visa-exempt. Japan's visa-exemption list (${visaFreeCount ?? "75"} countries/regions in our dataset, unchanged by this fee revision) already lets nationals of the United States, United Kingdom, Canada, Australia, most of the EU and dozens of others enter Japan for short stays without any visa at all, so there is no fee to pay. The increase only applies to travellers who must apply for a Japanese visa in the first place.`,
    },
    {
      q: "Which nationalities actually pay the new, higher fee?",
      a: "Nationalities that need a visa for Japan today - for example China, India, Vietnam, the Philippines, Nigeria, Bangladesh and Pakistan, among more than 100 others - pay the new fee when they apply. Being on this list hasn't changed; only the price of the visa these travellers already had to buy has gone up.",
    },
    {
      q: "Why did Japan raise visa fees now?",
      a: "Japan's government cited the fee schedule being unchanged since 1978 despite decades of inflation and yen depreciation. Foreign Minister Toshimitsu Motegi's ministry framed the change as a long-overdue update rather than a new policy aimed at any specific market. Japan has also separately flagged further increases to other immigration fees (residence-status changes/renewals and permanent-residence applications) as under consideration, though the confirmed figures for those are still being finalised - this page covers only the visa issuance fee, which is confirmed and already in effect.",
    },
    {
      q: "Does this affect the Japan eVISA or a VFS-processed application?",
      a: "The revised figure is the government's own consular visa issuance fee, which still applies whether you submit on paper at an embassy/consulate, through the direct-apply JAPAN eVISA site (for eligible jurisdictions), or through an accredited travel agency such as VFS Global. Any separate agency service charge or courier fee is additional and unrelated to this government fee change.",
    },
    {
      q: "Are Indonesian or Thai citizens affected?",
      a: `It's conditional. Indonesian and Thai nationals holding an ICAO-compliant ePassport registered under Japan's exemption scheme can still enter visa-free${idnEdge?.maxStayDays ? ` (up to ${idnEdge.maxStayDays} days for Indonesia` : ""}${thaEdge?.maxStayDays ? `, ${thaEdge.maxStayDays} days for Thailand)` : idnEdge?.maxStayDays ? ")" : ""} and pay nothing. Those without a qualifying ePassport must still apply for a visa (or the JAPAN eVISA, where eligible) and now pay the higher fee. Always check your own passport type rather than assuming your nationality's general status.`,
    },
    {
      q: "Is this the same as Japan's upcoming JESTA travel authorisation?",
      a: "No. JESTA is a separate, future electronic travel authorisation for currently visa-exempt travellers, legislated in May 2026 but not targeted for introduction until Japanese fiscal year 2028 (by March 2029) - it does not exist yet and has no announced fee. This guide covers the visa issuance fee increase that is already in effect for travellers who need a visa today; it does not add a new requirement for visa-exempt nationalities.",
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
          {
            "@type": "ListItem",
            position: 2,
            name: "Japan Visa Fee Increase 2026",
            item: "https://earthvisa.in/guide/japan-visa-fee-increase-2026",
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="min-h-screen">
        {/* Header */}
        <header className="border-b border-line-strong bg-paper-2/60">
          <div className="mx-auto w-full max-w-6xl px-5 pt-6 pb-8 sm:px-8">
            <nav aria-label="Breadcrumb" className="mono-chrome mb-4 flex flex-wrap items-center gap-x-2">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
              <span aria-hidden>/</span>
              <Link href="/guide" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Guides</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Japan Visa Fee Increase</span>
            </nav>


            <div className="mt-6">
              <h1 className="text-display text-ink">
                Japan Visa Fee Increase 2026
                <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                  Old vs New Fees, Effective Date &amp; Who&apos;s Actually Exempt
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                Effective 1 July 2026 &middot; first fee revision since 1978 &middot; only visa applicants pay it
              </p>
            </div>

            {/* Stats */}
            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Old single-entry fee", v: "¥3,000" },
                { k: "New single-entry fee", v: "¥15,000" },
                { k: "Increase", v: "~5× (400%)" },
                { k: "Visa-exempt nationalities (unaffected)", v: visaFreeCount != null ? String(visaFreeCount) : "75" },
              ].map(({ k, v }) => (
                <div key={k} className="bg-card px-4 py-2.5">
                  <dt className="mono-chrome">{k}</dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl></div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">

          {/* What changed */}
          <section className="mt-10 max-w-3xl">
            <h2 className="text-section text-ink">What Actually Changed</h2>
            <p className="text-body mt-3 text-ink-soft">
              On <strong className="text-ink">19 June 2026</strong>, Japan&apos;s Cabinet approved the first revision
              to its visa issuance fee schedule since <strong className="text-ink">1978</strong>. The new fees apply
              to visa applications submitted at Japanese embassies and consulates on or after{" "}
              <strong className="text-ink">1 July 2026</strong>.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line-strong">
                    <th scope="col" className="mono-chrome py-3 pr-4">Category</th>
                    <th scope="col" className="mono-chrome py-3 pr-4">Old fee</th>
                    <th scope="col" className="mono-chrome py-3 pr-4">New fee (from 1 Jul 2026)</th>
                    <th scope="col" className="mono-chrome py-3">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <tr>
                    <td className="py-3 pr-4 text-sm text-ink">Single-entry (tourist &amp; most long-term categories)</td>
                    <td className="py-3 pr-4 text-sm text-ink-soft">JPY 3,000 (~$18-20)</td>
                    <td className="py-3 pr-4 text-sm font-semibold text-ink">JPY 15,000 (~$90-100)</td>
                    <td className="py-3 text-sm text-stamp">~5&times;</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-sm text-ink">Multiple-entry (business)</td>
                    <td className="py-3 pr-4 text-sm text-ink-soft">JPY 6,000 (~$36-40)</td>
                    <td className="py-3 pr-4 text-sm font-semibold text-ink">JPY 30,000 (~$180-200)</td>
                    <td className="py-3 text-sm text-stamp">~5&times;</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="card-doc mt-5 max-w-2xl px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              <strong className="font-semibold text-ink">Note on USD figures:</strong> approximate, since JPY/USD
              moves - press coverage of this story has cited figures from roughly $18 to $93 depending on the
              exchange rate used on the day. The JPY amounts above are the fixed, official figures.
            </p>
          </section>

          {/* Which categories */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Which Visa Categories This Affects</h2>
            <p className="text-body mt-3 text-ink-soft">
              The fee rise is not limited to tourist visas. Of the {jpnTypes.length} Japan visa categories in our
              dataset, <strong className="text-ink">{singleEntryGroup.length} now cost JPY 15,000</strong> (the
              Temporary Visitor/tourist visa plus almost every work, student and family long-term category) and{" "}
              <strong className="text-ink">
                {multipleEntryGroup.length === 1 ? multipleEntryGroup[0].name : `${multipleEntryGroup.length} categories`} now cost{multipleEntryGroup.length === 1 ? "" : " (each)"} JPY 30,000
              </strong>.
            </p>
            {otherGroup.length > 0 && (
              <ul className="text-body mt-4 space-y-2 text-ink-soft">
                {otherGroup.map((t) => (
                  <li key={t.name} className="flex gap-3">
                    <span aria-hidden className="mono text-stamp">&rarr;</span>
                    <span>
                      <strong className="text-ink">{t.name}:</strong>{" "}
                      {t.fee_usd === 0
                        ? "issued free of charge - unaffected by this fee revision."
                        : t.name === "Transit Visa"
                          ? "historically a lower JPY 700 fee; official sources reviewed for this page do not publish a specific revised transit figure, so do not assume it matches the JPY 15,000 standard rate."
                          : "fee not separately confirmed by the official sources reviewed for this page."}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Not a new visa requirement */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">
              This Is a Fee Change, Not a New Visa Requirement
            </h2>
            <p className="text-body mt-3 text-ink-soft">
              Nothing about <em>who</em> needs a Japan visa has changed. Japan&apos;s visa-exemption list -{" "}
              <strong className="text-ink">{visaFreeCount ?? 75} countries and regions</strong> in our dataset -
              is set independently of this fee schedule and has not been altered by it. If your passport was
              visa-free to Japan before 1 July 2026, it still is, and you pay nothing. See the full, current picture
              for your passport on the{" "}
              <Link href={`/destination/${nameToSlug(nameFor(JPN))}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Japan destination page
              </Link>.
            </p>
          </section>

          {/* Who is NOT affected */}
          {visaFreeSamples.length > 0 && (
            <section className="mt-12">
              <h2 className="text-section text-ink">
                Who Is NOT Affected: Visa-Exempt Nationalities
              </h2>
              <p className="text-body mt-2 max-w-3xl text-ink-soft">
                Confirmed visa-free to Japan in our dataset - none of these pay the new fee for a short stay.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {visaFreeSamples.map(({ iso3, edge }) => (
                  <Link
                    key={iso3}
                    href={`/passport/${nameToSlug(nameFor(iso3))}`}
                    className="card-doc group flex min-h-[44px] items-center gap-3 px-3.5 py-2.5"
                  >
                    <span className="text-xl">{flagFor(iso3)}</span>
                    <div className="min-w-0">
                      <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">{nameFor(iso3)}</span>
                      {edge?.maxStayDays != null && (
                        <div className="mono text-[11px] text-ink-mute">≤ {edge.maxStayDays} days visa-free</div>
                      )}
                    </div>
                    <span className="mono ml-auto rounded-[3px] bg-vfree/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-vfree ring-1 ring-vfree/30">
                      Visa-free
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Indonesia / Thailand nuance */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">The ePassport Exception: Indonesia &amp; Thailand</h2>
            <p className="text-body mt-3 text-ink-soft">
              A few nationalities sit in between - visa-free only under specific conditions. Indonesian and Thai
              citizens holding an <strong className="text-ink">ICAO-compliant ePassport</strong> registered under
              Japan&apos;s exemption scheme enter visa-free
              {idnEdge?.maxStayDays != null ? ` (up to ${idnEdge.maxStayDays} days for Indonesian ePassport holders` : ""}
              {thaEdge?.maxStayDays != null ? `, ${thaEdge.maxStayDays} days for Thai ePassport holders)` : idnEdge?.maxStayDays != null ? ")" : ""}
              {" "}and pay nothing - but travellers from either country without a qualifying ePassport still need a
              visa (or the JAPAN eVISA, where eligible) and now pay the increased fee. This is exactly the kind of
              nuance a plain nationality list misses, so always check your specific passport type before assuming
              your country&apos;s general status applies to you.
            </p>
          </section>

          {/* Who IS affected */}
          <section className="mt-12">
            <h2 className="text-section text-ink">
              Who IS Affected: Nationalities That Need a Japan Visa
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              These nationalities require a visa for Japan today (confirmed by our dataset - no visa-free, on-arrival
              or e-visa access), so they are the travellers actually paying the new, higher fee. This is not the
              full list - see the{" "}
              <Link href={`/destination/${nameToSlug(nameFor(JPN))}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Japan destination page
              </Link>{" "}
              for every nationality.
            </p>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {visaRequiredSamples.map((nat) => (
                <Link
                  key={nat}
                  href={`/passport/${nameToSlug(nameFor(nat))}/${nameToSlug(nameFor(JPN))}`}
                  className="card-doc group flex min-h-[44px] items-center gap-3 px-3.5 py-2.5"
                >
                  <span className="text-xl">{flagFor(nat)}</span>
                  <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">{nameFor(nat)}</span>
                  <span className="mono ml-auto shrink-0 rounded-[3px] bg-stamp/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] text-stamp ring-1 ring-stamp/30">
                    Visa required
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* Official sources */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Official Sources</h2>
            <ul className="text-body mt-4 space-y-2 text-ink-soft">
              <li className="flex gap-3">
                <span aria-hidden className="mono text-stamp">&rarr;</span>
                <span>
                  Ministry of Foreign Affairs of Japan - Visa Fees:{" "}
                  <a href={MOFA_FEE_URL} rel="noopener noreferrer" target="_blank" className="text-stamp underline underline-offset-2">mofa.go.jp/j_info/visit/visa/procedure</a>
                </span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mono text-stamp">&rarr;</span>
                <span>
                  Consulate-General of Japan in Detroit - fee schedule effective 1 July 2026:{" "}
                  <a href={CONSULATE_DETROIT_URL} rel="noopener noreferrer" target="_blank" className="text-stamp underline underline-offset-2">detroit.us.emb-japan.go.jp</a>
                </span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mono text-stamp">&rarr;</span>
                <span>
                  Ministry of Foreign Affairs of Japan - list of visa-exempt countries/regions:{" "}
                  <a href={MOFA_EXEMPTION_URL} rel="noopener noreferrer" target="_blank" className="text-stamp underline underline-offset-2">mofa.go.jp/j_info/visit/visa/short/novisa.html</a>
                </span>
              </li>
            </ul>
            <p className="card-doc mt-4 max-w-2xl px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              MOFA and consulate pages sometimes block automated fetches; the fee figures on this page were
              corroborated across multiple official consulate fee schedules and immigration-law advisory sources
              (Fragomen, Newland Chase) before publishing.
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">Japan Visa Fee Increase FAQ</h2>
            <div className="card-doc mt-5 divide-y divide-line px-5">
              {faqs.map(({ q, a }) => (
                <details key={q} className="group">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-[15px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                    {q}
                    <Chevron />
                  </summary>
                  <p className="text-body mt-1 max-w-3xl pb-4 text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Corridor mesh */}
          <CorridorLinks
            title="Japan Visa Guides by Nationality"
            description="Full application requirements, documents and fees for nationalities that need a visa for Japan."
            links={corridorLinks}
          />

          {/* Related */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Related Guides</h2>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <li>
                <Link href="/guide/visa-types" className="card-doc group flex min-h-[44px] items-center gap-3 px-3.5 py-2.5">
                  <span className="text-xl">📄</span>
                  <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">Visa types explained</span>
                  <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">→</span>
                </Link>
              </li>
              <li>
                <Link href="/guide/transit-visa" className="card-doc group flex min-h-[44px] items-center gap-3 px-3.5 py-2.5">
                  <span className="text-xl">✈️</span>
                  <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">Transit visa guide</span>
                  <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">→</span>
                </Link>
              </li>
            </ul>
          </section>

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              Does your passport need a Japan visa at all?
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Check your passport&apos;s Japan access first - if you&apos;re visa-exempt, this fee increase doesn&apos;t
              touch you. See full entry rules and stay limits on the{" "}
              <Link href={`/destination/${nameToSlug(nameFor(JPN))}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">
                Japan destination page
              </Link>.
            </p>
            <Link
              href="/visit"
              className="btn-stamp mt-5"
            >
              Check your visa requirements →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
