// A diagonally-split flag badge for corridor pages: destination flag fills the
// upper-right triangle, source flag the lower-left, with an arrow pointing from
// source to destination (e.g. India -> Japan). Real flag images (flagcdn) are
// used so the triangles fill with colour, unlike emoji glyphs.
export default function CorridorFlags({
  sourceIso2,
  destIso2,
  sourceName,
  destName,
  className = "",
}: {
  sourceIso2: string;
  destIso2: string;
  sourceName: string;
  destName: string;
  className?: string;
}) {
  const flag = (iso2: string) => `https://flagcdn.com/w320/${iso2.toLowerCase()}.png`;
  return (
    <div
      className={`relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-line-strong shadow-sm ${className}`}
      role="img"
      aria-label={`${sourceName} to ${destName}`}
    >
      {/* Destination - upper-right triangle */}
      <img
        src={flag(destIso2)}
        alt=""
        width={128}
        height={128}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
      />
      {/* Source - lower-left triangle */}
      <img
        src={flag(sourceIso2)}
        alt=""
        width={128}
        height={128}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: "polygon(0 0, 100% 100%, 0 100%)" }}
      />
      {/* Diagonal divider */}
      <svg viewBox="0 0 128 128" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <line x1="0" y1="0" x2="128" y2="128" stroke="var(--paper)" strokeWidth="3" />
      </svg>
      {/* Direction arrow: source (lower-left) -> destination (upper-right) */}
      <div className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-ink text-paper shadow-md ring-2 ring-[var(--paper)]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </svg>
      </div>
    </div>
  );
}
