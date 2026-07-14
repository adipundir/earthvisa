import { flagFor } from "@/lib/dataset";
import { fmtMoney, type ProofOfFunds } from "@/lib/pof";

function host(url: string | null | undefined): string {
  if (!url) return "source";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "source"; }
}

// Data convention (data/proof-of-funds/*.json): the first line of
// community.typical_approved is the reported currency range, rendered as a
// labelled stat headline mirroring the official block; the text after the
// first newline is its single supporting sentence. Records without a newline
// render as a plain paragraph.
function splitCommunity(s: string): { range: string | null; support: string } {
  const i = s.indexOf("\n");
  if (i === -1) return { range: null, support: s };
  return { range: s.slice(0, i).trim(), support: s.slice(i + 1).trim() };
}

// One visa's proof-of-funds record. Official (government) figures are shown in a
// bordered block; community (anecdotal) reports are visually separated and
// always labelled, so the two are never confused.
export default function PofCard({ p, iso3 }: { p: ProofOfFunds; iso3?: string }) {
  const off = p.official;
  const headline = off.daily_minimum ?? off.total_example;
  const hasFigure = off.published && headline?.amount != null;
  const community = p.community.typical_approved ? splitCommunity(p.community.typical_approved) : null;

  return (
    <section id={p.key.toLowerCase()} className="scroll-mt-24 rounded-lg border border-line-strong bg-paper-2/40 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        {iso3 && <span className="text-2xl leading-none">{flagFor(iso3)}</span>}
        <h3 className="font-display text-lg font-semibold text-ink">{p.visa}</h3>
      </div>

      {/* Official */}
      <div className="mt-4 rounded-md border border-line bg-card/60 p-4">
        <p className="mono text-[10px] font-medium uppercase tracking-[0.15em] text-vfree">Official requirement</p>
        {hasFigure ? (
          <>
            <p className="mono mt-1 text-2xl font-semibold tabular-nums text-ink">
              {fmtMoney(headline!)}
              {headline!.basis ? <span className="text-sm font-normal text-ink-soft"> {headline!.basis}</span> : null}
            </p>
            {headline!.note && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{headline!.note}</p>}
          </>
        ) : (
          <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
            <span className="font-semibold text-ink">No fixed minimum published.</span> {off.guidance}
          </p>
        )}
        {(headline?.source_url || p.sources[0]) && (
          <a href={headline?.source_url ?? p.sources[0]} target="_blank" rel="noreferrer" className="mono mt-2 inline-block text-[10px] text-ink-mute underline-offset-2 transition hover:text-ink hover:underline">
            {host(headline?.source_url ?? p.sources[0])} ↗
          </a>
        )}
      </div>

      {/* Community */}
      {community && (
        <div className="mt-3 rounded-md border border-dashed border-line-strong bg-paper-3/40 p-4">
          <p className="mono text-[10px] font-medium uppercase tracking-[0.15em] text-eta">What applicants report · anecdotal</p>
          {community.range && (
            <p className="mono mt-1 text-2xl font-semibold tabular-nums text-ink">{community.range}</p>
          )}
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{community.support}</p>
        </div>
      )}

      {/* Documents + red flags */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {p.documents.length > 0 && (
          <div>
            <p className="mono text-[10px] font-medium uppercase tracking-[0.15em] text-ink-mute">Financial documents</p>
            <ul className="mt-2 space-y-1 text-[13px] leading-relaxed text-ink-soft">
              {p.documents.slice(0, 5).map((d, i) => <li key={i}>· {d}</li>)}
            </ul>
          </div>
        )}
        {p.red_flags.length > 0 && (
          <div>
            <p className="mono text-[10px] font-medium uppercase tracking-[0.15em] text-ink-mute">Rejection red flags</p>
            <ul className="mt-2 space-y-1 text-[13px] leading-relaxed text-ink-soft">
              {p.red_flags.slice(0, 4).map((d, i) => <li key={i}>· {d}</li>)}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
