import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { dataset, flagFor, nameFor } from "@/lib/dataset";
import { compute, LEVEL_LABEL } from "@/lib/compute";
import type { AccessLevel } from "@/lib/types";
import { TOP_NATIONALITIES, TOP_DESTINATIONS, corridorPairs, isUsefulCorridor, nameToSlug, DEMONYM } from "@/lib/corridors";

const byIso3 = new Map(dataset.allCountries.map((c) => [c.iso3, c]));
const bySlug = new Map(dataset.allCountries.map((c) => [nameToSlug(c.name), c]));
const slugToCountry = (slug: string) => bySlug.get(slug) ?? null;

// Only the curated, genuinely-useful corridors exist; anything else 404s rather
// than rendering a thin "visa required" page.
export const dynamicParams = false;

export function generateStaticParams() {
  return corridorPairs().map((c) => ({ slug: c.natSlug, dest: c.destSlug }));
}

// ── Access resolution ─────────────────────────────────────────────────────────
type Status =
  | { kind: "fom"; groups: string[] }
  | { kind: AccessLevel; maxStayDays: number | null; notes: string; sourceUrl: string; sourceOfficial: boolean; via?: string | null }
  | { kind: "own" }
  | { kind: "visa_required" };

function resolve(natIso3: string, destIso3: string): Status {
  if (natIso3 === destIso3) return { kind: "own" };
  const r = compute([natIso3], [], {});
  const fom = r.freedomOfMovement.find((e) => e.dest === destIso3);
  if (fom) return { kind: "fom", groups: fom.groups };
  const edge = r.reach.find((e) => e.dest === destIso3);
  if (edge) {
    return {
      kind: edge.level,
      maxStayDays: edge.maxStayDays,
      notes: edge.notes ?? "",
      sourceUrl: edge.sourceUrl ?? "",
      sourceOfficial: !!edge.sourceOfficial,
      via: edge.viaIso3 ? nameFor(edge.viaIso3) : null,
    };
  }
  return { kind: "visa_required" };
}

const VERB: Record<string, string> = {
  visa_free: "can travel visa-free to",
  visa_on_arrival: "can get a visa on arrival for",
  eta: "need an eTA for",
  e_visa: "can apply for an e-Visa for",
};

function answerSentence(nat: string, dest: string, s: Status): string {
  switch (s.kind) {
    case "own": return `${nat} citizens do not need a visa for ${dest} — it is their own country.`;
    case "fom": return `${nat} citizens have freedom of movement in ${dest} — they can live, work and travel there with no visa.`;
    case "visa_free": return `Yes — ${nat} passport holders can enter ${dest} visa-free${s.maxStayDays ? ` for up to ${s.maxStayDays} days` : ""} as of 2026.`;
    case "visa_on_arrival": return `${nat} passport holders can get a visa on arrival for ${dest}${s.maxStayDays ? ` (up to ${s.maxStayDays} days)` : ""}, so no visa is needed before travelling.`;
    case "eta": return `${nat} passport holders need an approved eTA (electronic travel authorisation) before travelling to ${dest}, but not a full visa.`;
    case "e_visa": return `${nat} passport holders need an e-Visa for ${dest} — applied for online before travel.`;
    default: return `${nat} passport holders need a visa to enter ${dest}. Apply at a ${dest} embassy or consulate, or the official visa portal, before travelling.`;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; dest: string }> }): Promise<Metadata> {
  const { slug, dest } = await params;
  const n = slugToCountry(slug);
  const d = slugToCountry(dest);
  if (!n || !d) return { title: "Not Found" };
  const s = resolve(n.iso3, d.iso3);
  const nd = DEMONYM[n.iso3] ?? n.name;
  const need = s.kind === "visa_required" || s.kind === "e_visa" || s.kind === "eta";
  const title = `${d.name} Visa for ${nd} Citizens (2026): ${need ? "Requirements" : "Visa-Free Entry"}`;
  const description = `${answerSentence(nd, d.name, s)} See stay length, conditions, required documents and the official government source.`;
  const canonical = `https://earthvisa.in/passport/${slug}/${dest}`;
  return {
    title: { absolute: `${title} | Earth Visa` },
    description,
    keywords: [
      `${d.name.toLowerCase()} visa for ${nd.toLowerCase()}`,
      `${d.name.toLowerCase()} visa for ${nd.toLowerCase()} citizens`,
      `do ${nd.toLowerCase()} citizens need visa for ${d.name.toLowerCase()}`,
      `${n.name.toLowerCase()} passport ${d.name.toLowerCase()} visa`,
      `${d.name.toLowerCase()} visa requirements for ${nd.toLowerCase()}`,
      `${n.name.toLowerCase()} to ${d.name.toLowerCase()} visa`,
    ],
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

const LEVEL_COLORS: Record<AccessLevel, string> = {
  visa_free: "text-vfree bg-vfree/10 ring-vfree/30",
  visa_on_arrival: "text-voa bg-voa/10 ring-voa/30",
  eta: "text-eta bg-eta/10 ring-eta/30",
  e_visa: "text-evisa bg-evisa/10 ring-evisa/30",
};

function StatusBadge({ s }: { s: Status }) {
  if (s.kind === "own") return <Badge cls="text-bloc bg-bloc/10 ring-bloc/30">Home country</Badge>;
  if (s.kind === "fom") return <Badge cls="text-bloc bg-bloc/10 ring-bloc/30">Freedom of movement</Badge>;
  if (s.kind === "visa_required") return <Badge cls="text-ink-soft bg-paper-3 ring-line-strong">Visa required</Badge>;
  return <Badge cls={LEVEL_COLORS[s.kind]}>{LEVEL_LABEL[s.kind]}</Badge>;
}
function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`mono inline-flex items-center rounded px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] ring-1 ${cls}`}>{children}</span>;
}

export default async function CorridorPage({ params }: { params: Promise<{ slug: string; dest: string }> }) {
  const { slug, dest } = await params;
  const n = slugToCountry(slug);
  const d = slugToCountry(dest);
  if (!n || !d) notFound();

  const s = resolve(n.iso3, d.iso3);
  const nd = DEMONYM[n.iso3] ?? n.name;
  const need = s.kind === "visa_required" || s.kind === "e_visa" || s.kind === "eta";
  const visaTypes = dataset.destinationVisaTypes?.[d.iso3] ?? [];
  const hasVfs = (dataset.vfsCorridors?.[d.iso3] ?? []).some((c) => c.sourceIso3 === n.iso3);

  // Related corridors for internal linking (crawl mesh).
  const sameNat = TOP_DESTINATIONS.filter((x) => x !== d.iso3 && x !== n.iso3 && isUsefulCorridor(n.iso3, x)).slice(0, 8).map((x) => byIso3.get(x)).filter(Boolean);
  const sameDest = TOP_NATIONALITIES.filter((x) => x !== n.iso3 && x !== d.iso3 && isUsefulCorridor(x, d.iso3)).slice(0, 8).map((x) => byIso3.get(x)).filter(Boolean);

  const faq = [
    { q: `Do ${nd} citizens need a visa for ${d.name}?`, a: answerSentence(nd, d.name, s) },
    (s.kind === "visa_free" || s.kind === "visa_on_arrival") && "maxStayDays" in s && s.maxStayDays
      ? { q: `How long can ${nd} citizens stay in ${d.name}?`, a: `${nd} passport holders can stay in ${d.name} for up to ${s.maxStayDays} days per entry under the current ${LEVEL_LABEL[s.kind].toLowerCase()} arrangement.` }
      : null,
    { q: `What documents do ${nd} citizens need for ${d.name}?`, a: hasVfs ? `A valid passport plus the ${d.name} document checklist for your visa type — Earth Visa lists the full required documents per visa category from the official visa application centre.` : `A passport valid for at least six months, proof of onward travel and funds, and any documents required for the specific ${d.name} visa category. Always confirm with the official source.` },
  ].filter(Boolean) as { q: string; a: string }[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
        { "@type": "ListItem", position: 2, name: "Passports", item: "https://earthvisa.in/passport" },
        { "@type": "ListItem", position: 3, name: `${n.name} passport`, item: `https://earthvisa.in/passport/${slug}` },
        { "@type": "ListItem", position: 4, name: `${d.name} visa`, item: `https://earthvisa.in/passport/${slug}/${dest}` },
      ] },
      { "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="min-h-screen">
        <header className="border-b border-line bg-paper-2/50">
          <div className="mx-auto w-full max-w-4xl px-5 pt-6 pb-8 sm:px-8">
            <nav className="mono mb-4 flex flex-wrap items-center gap-x-2 text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              <Link href="/passport" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Passports</Link>
              <span>/</span>
              <Link href={`/passport/${slug}`} className="inline-flex min-h-[44px] items-center transition hover:text-ink">{n.name}</Link>
              <span>/</span>
              <span className="text-ink-soft">{d.name}</span>
            </nav>
            <div className="flex items-center gap-3">
              <span className="text-4xl leading-none">{flagFor(d.iso3)}</span>
              <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
                {d.name} Visa for {nd} Citizens
              </h1>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatusBadge s={s} />
              {"maxStayDays" in s && s.maxStayDays ? (
                <span className="text-sm text-ink-soft"><span className="font-semibold text-ink">{s.maxStayDays}</span> days max stay</span>
              ) : null}
            </div>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft">{answerSentence(nd, d.name, s)}</p>
            {"notes" in s && s.notes ? (
              <p className="mt-3 max-w-2xl rounded-lg border border-line bg-paper-2 px-4 py-3 text-sm leading-relaxed text-ink-soft">{s.notes}</p>
            ) : null}
            {"sourceUrl" in s && s.sourceUrl ? (
              <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="mono mt-3 inline-flex items-center gap-1.5 text-[11px] text-ink-mute transition hover:text-ink">
                <span className={`inline-block h-2 w-2 rounded-full ${s.sourceOfficial ? "bg-vfree" : "bg-eta"}`} />
                {(() => { try { return new URL(s.sourceUrl).hostname.replace(/^www\./, ""); } catch { return "official source"; } })()} ↗
              </a>
            ) : null}
          </div>
        </header>

        <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8">
          {/* What you need to do */}
          <section className="mb-10">
            <h2 className="font-display text-xl font-semibold text-ink">
              {need ? `How ${nd} citizens apply for a ${d.name} visa` : `Entering ${d.name} on ${/^[aeiou]/i.test(nd) ? "an" : "a"} ${nd} passport`}
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-ink-soft">
              {s.kind === "visa_free" && <li>→ Travel with just your valid {nd} passport. No visa or prior application needed.</li>}
              {s.kind === "visa_on_arrival" && <li>→ Obtain your visa at the {d.name} border/airport on arrival; carry the required fee and documents.</li>}
              {s.kind === "eta" && <li>→ Apply online for the eTA before you travel; approval is usually quick.</li>}
              {s.kind === "e_visa" && <li>→ Apply for the e-Visa online before travel and carry the approval.</li>}
              {s.kind === "visa_required" && <li>→ Apply for a visa at the {d.name} embassy/consulate or official visa application centre before travelling.</li>}
              {hasVfs && (
                <li>→ <Link href={`/visit?dest=${d.iso3}&passport=${n.iso3}`} className="font-medium text-stamp underline-offset-2 hover:underline">See the exact document checklist</Link> for {nd} applicants, by visa type.</li>
              )}
              <li>→ Confirm the latest rules on the destination&apos;s official government page before you book.</li>
            </ul>
          </section>

          {/* Visa types for the destination */}
          {visaTypes.length > 0 && (
            <section className="mb-10 border-t border-line pt-8">
              <h2 className="font-display text-xl font-semibold text-ink">{d.name} visa types</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {visaTypes.slice(0, 6).map((v, i) => (
                  <div key={i} className="rounded-lg border border-line-strong bg-paper-2 px-4 py-3">
                    <p className="font-display text-[14px] font-semibold text-ink">{v.name}</p>
                    {v.purpose && <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{v.purpose}</p>}
                    <div className="mono mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-mute">
                      {v.max_stay_days != null && <span>{v.max_stay_days} days</span>}
                      {v.fee_usd != null && <span>~${v.fee_usd}</span>}
                      {v.online && <span className="text-vfree">online</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* FAQ */}
          <section className="mb-10 border-t border-line pt-8">
            <h2 className="font-display text-xl font-semibold text-ink">
              {d.name} visa for {n.name} citizens — FAQ
            </h2>
            <div className="mt-4 divide-y divide-line">
              {faq.map(({ q, a }) => (
                <details key={q} className="group py-1">
                  <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4 py-3 font-display text-[15px] font-medium text-ink">
                    {q}
                    <svg viewBox="0 0 12 8" aria-hidden="true" className="h-2.5 w-2.5 shrink-0 text-ink-mute transition-transform duration-150 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </summary>
                  <p className="mt-1 mb-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Related corridors — internal link mesh */}
          <section className="border-t border-line pt-8">
            <h2 className="font-display text-xl font-semibold text-ink">Related visa requirements</h2>
            <div className="mt-4 grid gap-8 sm:grid-cols-2">
              <div>
                <p className="mono mb-2 text-[10px] uppercase tracking-[0.2em] text-stamp">For {nd} citizens</p>
                <ul className="space-y-1">
                  {sameNat.map((c) => (
                    <li key={c!.iso3}>
                      <Link href={`/passport/${slug}/${nameToSlug(c!.name)}`} className="flex min-h-[40px] items-center gap-2 text-[14px] text-ink-soft transition hover:text-ink">
                        <span>{flagFor(c!.iso3)}</span> {c!.name} visa
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mono mb-2 text-[10px] uppercase tracking-[0.2em] text-stamp">Visa for {d.name}</p>
                <ul className="space-y-1">
                  {sameDest.map((c) => (
                    <li key={c!.iso3}>
                      <Link href={`/passport/${nameToSlug(c!.name)}/${dest}`} className="flex min-h-[40px] items-center gap-2 text-[14px] text-ink-soft transition hover:text-ink">
                        <span>{flagFor(c!.iso3)}</span> {d.name} visa for {c!.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
