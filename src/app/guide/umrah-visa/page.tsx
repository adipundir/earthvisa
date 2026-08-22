import type { Metadata } from "next";
import Link from "next/link";
import { dataset, flagFor, nameFor, nameToSlug } from "@/lib/dataset";
import { isUsefulCorridor, DEMONYM } from "@/lib/corridors";
import CorridorLinks from "@/components/CorridorLinks";

// ---------------------------------------------------------------------------
// /guide/umrah-visa - "umrah visa", "umrah visa for indian", "nusuk"
//
// Explainer for the three routes into Saudi Arabia for Umrah: the tourist
// visa (Umrah allowed, Hajj not), the dedicated Umrah visa processed through
// the official Nusuk platform, and the credential-based visa on arrival for
// travellers holding a used US/UK/Schengen visa (recorded in our dataset).
//
// Accuracy rules honoured here:
// - Eligibility claims (who gets the tourist e-visa / VoA) come from the
//   dataset only. IND/PAK/BGD/IDN/EGY/NGA have no tourist grant in our data,
//   so they are shown as "visa required in advance" - the Nusuk Umrah visa
//   route - never as e-visa eligible.
// - The only fees shown are the ones recorded in the dataset (tourist visa
//   types + the SAR fee in Saudi Tourist Visa Regulations credential notes).
//   No invented Umrah visa fees.
// - Health/document requirements are framed as "per official Saudi guidance,
//   verify before travel".
// ---------------------------------------------------------------------------

const NUSUK_URL = "https://www.nusuk.sa/";

// The nationalities people search "umrah visa for X" about most.
const UMRAH_NATIONALITIES = ["IND", "PAK", "BGD", "IDN", "EGY", "NGA"];

function accessTo(nat: string, dest: string) {
  return (dataset.passportAccess[nat] ?? []).find((e) => e.dest === dest) ?? null;
}

const LEVEL_LABEL: Record<string, string> = {
  visa_free: "Visa-free",
  visa_on_arrival: "On arrival",
  eta: "eTA",
  e_visa: "e-Visa",
};

const title = "Umrah Visa 2026: Nusuk, Tourist Visa Rules & Requirements by Nationality";
const description =
  "Umrah visa guide 2026: perform Umrah on a Saudi tourist visa or a dedicated Umrah visa via the official Nusuk platform. Rules for Indian, Pakistani, Bangladeshi, Indonesian, Egyptian and Nigerian travellers, plus visa-on-arrival routes for US/UK/Schengen visa holders.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://earthvisa.in/guide/umrah-visa" },
  openGraph: {
    title,
    description,
    url: "https://earthvisa.in/guide/umrah-visa",
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

export default function UmrahVisaGuidePage() {
  // General tourist products only (fees included in the dataset). The dataset's
  // Umrah and Hajj entries are pilgrimage visas - covered by Route 2 and the
  // Hajj callout, not the tourist-visa card grid.
  const sauTourist = (dataset.destinationVisaTypes.SAU ?? []).filter(
    (vt) => vt.category === "tourist" && vt.name !== "Umrah Visa" && vt.name !== "Hajj Visa",
  );
  const eVisaType = sauTourist.find((vt) => vt.online);

  // How many nationalities our dataset records with each access level to SAU.
  let sauEvisaCount = 0;
  let sauVfCount = 0;
  for (const edges of Object.values(dataset.passportAccess)) {
    const e = edges.find((x) => x.dest === "SAU");
    if (e?.level === "e_visa") sauEvisaCount++;
    if (e?.level === "visa_free") sauVfCount++;
  }

  // Credential-based visa on arrival (any nationality) recorded in the dataset.
  const credentialVoA = ["US_VISA", "UK_VISA", "SCHENGEN_VISA", "GCC_RESIDENCE"]
    .map((id) => ({ id, edge: (dataset.credentialAccess[id] ?? []).find((e) => e.dest === "SAU" && !e.transit) }))
    .filter((x) => x.edge);
  const credLabel: Record<string, string> = {
    US_VISA: "Valid US tourist or business visa",
    UK_VISA: "Valid UK tourist or business visa",
    SCHENGEN_VISA: "Valid Schengen tourist or business visa",
    GCC_RESIDENCE: "GCC residence permit (eligible professions, valid 3+ months)",
  };

  // Per-nationality status, straight from the dataset. No grant = visa
  // required in advance = the dedicated Umrah visa route via Nusuk.
  const perNationality = UMRAH_NATIONALITIES.map((iso3) => ({
    iso3,
    name: nameFor(iso3),
    demonym: DEMONYM[iso3] ?? nameFor(iso3),
    edge: accessTo(iso3, "SAU"),
  }));
  // Names rendered in prose come from the same data check - never asserted.
  const notEligibleNames = perNationality.filter((p) => !p.edge).map((p) => p.name);
  const indEdge = accessTo("IND", "SAU");

  // Corridor pages to Saudi Arabia - only linked when isUsefulCorridor says
  // the page exists (thin corridors are pruned from the build).
  const corridorLinks = UMRAH_NATIONALITIES.filter((nat) => isUsefulCorridor(nat, "SAU")).map((nat) => ({
    href: `/passport/${nameToSlug(nameFor(nat))}/${nameToSlug(nameFor("SAU"))}`,
    label: `Saudi Arabia for ${DEMONYM[nat] ?? nameFor(nat)} citizens`,
    iso3: nat,
  }));

  const faqs = [
    {
      q: "Can I perform Umrah on a Saudi tourist visa?",
      a: `Yes - tourist visa holders may perform Umrah, though not Hajj. ${sauEvisaCount} nationalities are eligible for the Saudi tourist e-Visa${eVisaType?.fee_usd ? `, about USD ${eVisaType.fee_usd}` : ""}${eVisaType?.max_stay_days ? `, stays up to ${eVisaType.max_stay_days} days` : ""}. Otherwise the dedicated Umrah visa via Nusuk is the standard route.`,
    },
    {
      q: "What is Nusuk?",
      a: "Nusuk (nusuk.sa) is Saudi Arabia's official platform for Umrah and Hajj: dedicated Umrah visas are processed through it and its authorised providers, and Rawdah and other rite permits are booked there. Treat non-official 'Umrah visa' sites with caution.",
    },
    {
      q: "Do Indian citizens need a visa for Umrah?",
      a: indEdge
        ? `Indian passport holders qualify for ${LEVEL_LABEL[indEdge.level].toLowerCase()} access to Saudi Arabia, and dedicated Umrah visas remain available through Nusuk. Verify current conditions on official Saudi sources before booking.`
        : "Yes. Our dataset records no visa-free, visa-on-arrival or tourist e-visa eligibility for Indian passport holders, so Indian pilgrims apply in advance - typically a dedicated Umrah visa through Nusuk or its authorised agents. Separately, any nationality holding a valid, previously used US, UK or Schengen visa can obtain a visa on arrival.",
    },
    {
      q: "Can women perform Umrah without a mahram?",
      a: "Saudi authorities have relaxed the former mahram (male guardian) requirement, and official guidance has allowed women to perform Umrah without one. Conditions can change - verify on Nusuk or with a Saudi consulate before booking.",
    },
    {
      q: "What vaccinations are required for Umrah?",
      a: "Meningococcal ACWY vaccination is commonly required for Umrah and Hajj travellers, and seasonal requirements can be added. Rules are set by the Saudi Ministry of Health and vary by season and origin country - verify before travel.",
    },
    {
      q: "Can I perform Hajj on a tourist visa or Umrah visa?",
      a: "No. Hajj requires a dedicated Hajj visa issued under national quotas through authorised operators, and Saudi authorities enforce this strictly during the Hajj season.",
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
          { "@type": "ListItem", position: 2, name: "Umrah Visa Guide", item: "https://earthvisa.in/guide/umrah-visa" },
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
              <span className="inline-flex min-h-[44px] items-center text-ink">Umrah Visa</span>
            </nav>


            <div className="mt-6">
              <h1 className="text-display text-ink">
                <span className="mr-2.5 align-baseline text-[0.9em] leading-none sm:mr-3" aria-hidden="true">{flagFor("SAU")}</span>
                Umrah Visa 2026
                <span className="block text-xl font-normal italic text-ink-soft sm:text-3xl">
                  Nusuk, Tourist Visa Rules &amp; Routes by Nationality
                </span>
              </h1>
              <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
                Umrah allowed on a tourist visa · Hajj is not
              </p>
            </div>

            {/* Stats */}
            <div className="card-doc card-doc-rule mt-6 overflow-hidden"><dl className="mono grid grid-cols-2 gap-px bg-line text-ink sm:grid-cols-4">
              {[
                { k: "Tourist e-Visa nationalities", v: String(sauEvisaCount) },
                { k: "Visa-free nationalities", v: String(sauVfCount) },
                { k: "Tourist e-Visa max stay", v: eVisaType?.max_stay_days ? `${eVisaType.max_stay_days} days` : "varies" },
                { k: "Tourist e-Visa fee", v: eVisaType?.fee_usd ? `~USD ${eVisaType.fee_usd}` : "see official" },
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

          {/* Intro */}
          <section className="mt-10 max-w-3xl">
            <p className="text-body text-ink-soft">
              Three routes into{" "}
              <Link href={`/destination/${nameToSlug(nameFor("SAU"))}`} className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Saudi Arabia</Link>{" "}
              for <strong className="text-ink">Umrah</strong>, and your passport decides which: the tourist visa, the
              dedicated Umrah visa via the official{" "}
              <a href={NUSUK_URL} rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Nusuk</a>{" "}
              platform, and - holding a valid, previously used US, UK or Schengen visa - a visa on arrival.
            </p>
            {notEligibleNames.length > 0 && (
              <p className="text-body mt-4 text-ink-soft">
                {notEligibleNames.join(", ")} have <strong className="text-ink">no</strong> tourist e-Visa
                eligibility in our data, so the Nusuk Umrah visa
                {credentialVoA.length > 0 ? " - or the US/UK/Schengen visa-holder route -" : ""} is their practical
                path.
              </p>
            )}
          </section>

          {/* Route 1: tourist visa */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Route 1: Umrah on a Saudi Tourist Visa</h2>
            <p className="text-body mt-3 text-ink-soft">
              Tourist visa holders may perform Umrah at any time of year outside the Hajj season.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {sauTourist.map((vt) => (
                <div key={vt.name} className="card-doc p-4">
                  <div className="font-display font-semibold text-ink">{vt.name}</div>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-mute">
                    {vt.fee_usd != null && <>~USD {vt.fee_usd} · </>}
                    {vt.max_stay_days != null && <>up to {vt.max_stay_days} days per visit · </>}
                    {vt.entries && <>{vt.entries} entry · </>}
                    {vt.online ? "apply online" : "issued at the border"}
                  </p>
                  {vt.notes && <p className="text-body mt-2 max-w-3xl text-ink-soft">{vt.notes}</p>}
                </div>
              ))}
            </div>
            <p className="card-doc mt-4 max-w-2xl px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              Eligibility is limited - confirm on visitsaudi.com, or{" "}
              <Link href="/visit?dest=SAU" className="text-stamp underline underline-offset-2">check your passport</Link>.
              A tourist visa never permits Hajj, issued only via{" "}
              <a href="https://hajj.nusuk.sa/" rel="noopener noreferrer" className="text-stamp underline underline-offset-2">Nusuk Hajj</a>.
            </p>
          </section>

          {/* Route 2: Nusuk Umrah visa */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Route 2: The Dedicated Umrah Visa via Nusuk</h2>
            <p className="text-body mt-3 text-ink-soft">
              The standard route for nationalities without tourist visa access, which includes the largest pilgrimage
              origins. It is processed through{" "}
              <a href={NUSUK_URL} rel="noopener noreferrer" className="text-stamp underline decoration-line-strong underline-offset-2 transition hover:decoration-stamp">Nusuk</a>{" "}
              and its authorised travel providers.
            </p>
            <ol className="mt-4 space-y-4">
              {[
                {
                  t: "Register on Nusuk or book through an authorised provider",
                  d: "Most pilgrims book a package - visa, accommodation and transport - through a Nusuk-authorised agent at home.",
                },
                {
                  t: "Submit documents",
                  d: "Passport usually valid 6+ months, photos, and proof of meningococcal ACWY vaccination. Lists vary by origin country - verify on official Saudi sources.",
                },
                {
                  t: "Receive the e-visa and book rites",
                  d: "Issued electronically; Rawdah and other rite permits are booked inside the Nusuk app.",
                },
              ].map(({ t, d }, i) => (
                <li key={t} className="flex gap-4">
                  <span className="mono mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-[11px] font-semibold text-stamp">{i + 1}</span>
                  <div>
                    <h3 className="font-display text-base font-semibold text-ink">{t}</h3>
                    <p className="text-body mt-1 text-ink-soft">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <dl className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {[
                { k: "Entry window", v: "Enter within 30 days of issuance (2026 rules)" },
                { k: "Max stay", v: "Up to 90 days" },
                { k: "Bookings", v: "Must be linked to confirmed Nusuk accommodation and transport" },
                { k: "Hajj season", v: "Not issued during the Hajj blackout" },
              ].map(({ k, v }) => (
                <div key={k} className="card-doc px-3.5 py-2.5">
                  <dt className="mono-chrome">{k}</dt>
                  <dd className="mt-1 text-sm leading-snug text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="card-doc mt-5 max-w-2xl px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
              Umrah visa fees are set by Saudi authorities and not in our dataset - confirm them on Nusuk itself, not
              in agents&apos; ads. Mahram (male guardian) rules have been relaxed; verify before travel.
            </p>
          </section>

          {/* Route 3: credential VoA */}
          {credentialVoA.length > 0 && (
            <section className="mt-12 max-w-3xl">
              <h2 className="text-section text-ink">
                Route 3: Visa on Arrival with a US, UK or Schengen Visa
              </h2>
              <p className="text-body mt-3 text-ink-soft">
                Saudi tourist visa regulations grant a visa on arrival, valid for Umrah, to travellers of{" "}
                <strong className="text-ink">any nationality</strong> holding one of these credentials - the fastest
                legal route for many Indian, Pakistani and Bangladeshi pilgrims.
              </p>
              <ul className="mt-4 space-y-2.5">
                {credentialVoA.map(({ id, edge }) => (
                  <li key={id} className="card-doc flex min-h-[44px] items-center gap-3 px-3.5 py-2.5">
                    <span className="font-display text-sm font-medium text-ink">{credLabel[id]}</span>
                    <span className="mono ml-auto shrink-0 rounded-[3px] bg-voa/10 px-2 py-0.5 text-[11px] text-voa ring-1 ring-voa/30">
                      On arrival{edge?.maxStayDays ? ` · ${edge.maxStayDays}d` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {[
                  { k: "Prior visa", v: "Must have been used at least once" },
                  { k: "Fee", v: "SAR 300 + mandatory insurance (~USD 134 all-in)" },
                  { k: "Passport", v: "Valid 6+ months" },
                  { k: "Family", v: "First-degree relatives travelling together included" },
                ].map(({ k, v }) => (
                  <div key={k} className="card-doc px-3.5 py-2.5">
                    <dt className="mono-chrome">{k}</dt>
                    <dd className="mt-1 text-sm leading-snug text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Per-nationality pointers */}
          <section className="mt-12">
            <h2 className="text-section text-ink">Umrah Visa by Nationality</h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              &quot;Visa required&quot; means the Nusuk Umrah visa, or the credential route above, is your path.
            </p>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {perNationality.map(({ iso3, name, edge }) => (
                <Link
                  key={iso3}
                  href={`/passport/${nameToSlug(name)}`}
                  className="card-doc group flex min-h-[44px] items-center gap-3 px-3.5 py-2.5"
                >
                  <span className="text-xl">{flagFor(iso3)}</span>
                  <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">{name}</span>
                  <span
                    className={`mono ml-auto shrink-0 rounded-[3px] px-2 py-0.5 text-[11px] ring-1 ${
                      edge ? "bg-evisa/10 text-evisa ring-evisa/30" : "bg-stamp/10 text-stamp ring-stamp/30"
                    }`}
                  >
                    {edge ? LEVEL_LABEL[edge.level] : "Visa required"}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="mt-14">
            <h2 className="text-section text-ink">Umrah Visa FAQ</h2>
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

          {/* Corridor mesh (renders only corridors that exist) */}
          <CorridorLinks
            title="Saudi Arabia Visa Guides by Nationality"
            description="Step-by-step Saudi Arabia entry rules and document notes for these passports."
            links={corridorLinks}
          />

          {/* Related */}
          <section className="mt-12 max-w-3xl">
            <h2 className="text-section text-ink">Related Guides</h2>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              <li>
                <Link href={`/destination/${nameToSlug(nameFor("SAU"))}`} className="card-doc group flex min-h-[44px] items-center gap-3 px-3.5 py-2.5">
                  <span className="text-xl">{flagFor("SAU")}</span>
                  <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">Saudi Arabia visa requirements</span>
                  <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">→</span>
                </Link>
              </li>
              <li>
                <Link href="/guide/gcc-visa" className="card-doc group flex min-h-[44px] items-center gap-3 px-3.5 py-2.5">
                  <span className="text-xl">🌍</span>
                  <span className="font-display text-sm font-medium text-ink transition group-hover:text-stamp">GCC unified tourist visa guide</span>
                  <span aria-hidden className="mono ml-auto text-ink-mute transition group-hover:text-stamp">→</span>
                </Link>
              </li>
            </ul>
          </section>

          {/* CTA */}
          <section className="card-doc card-doc-ticks mt-12 px-6 py-8 text-center">
            <h2 className="text-section text-ink">
              Check your exact Saudi Arabia entry options
            </h2>
            <p className="text-body mt-2 max-w-3xl text-ink-soft">
              Add any US, UK or Schengen visa you hold to see the credential-based visa on arrival too.
            </p>
            <Link
              href="/visit?dest=SAU"
              className="btn-stamp mt-5"
            >
              Check for your passport →
            </Link>
          </section>

        </div>
      </main>
    </>
  );
}
