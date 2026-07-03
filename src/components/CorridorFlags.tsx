// A diagonally-split flag badge for corridor pages: destination flag fills the
// upper-left triangle, source flag the lower-right, with a curved flight-path
// arrow arcing from source to destination (e.g. India -> Japan). Real flag
// images (flagcdn) are used so the triangles fill with colour.
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
  // Curved journey path: source corner (lower-right) -> destination corner (upper-left).
  const ARC = "M93 93 C 89 60, 74 44, 46 41";
  const HEAD = "M54 35 L46 41 L53 50";
  return (
    <div
      className={`relative h-44 w-44 shrink-0 overflow-hidden rounded-2xl border border-line-strong shadow-sm ${className}`}
      role="img"
      aria-label={`${sourceName} to ${destName}`}
    >
      {/* Destination - upper-left triangle */}
      <img
        src={flag(destIso2)}
        alt=""
        width={176}
        height={176}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
      />
      {/* Source - lower-right triangle */}
      <img
        src={flag(sourceIso2)}
        alt=""
        width={176}
        height={176}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
      />
      {/* Diagonal divider (top-right to bottom-left) */}
      <svg viewBox="0 0 128 128" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <line x1="128" y1="0" x2="0" y2="128" stroke="var(--paper)" strokeWidth="3" />
      </svg>
      {/* Curved journey arrow, source (lower-right) -> destination (upper-left).
          Drawn twice: a paper "casing" underneath for contrast over the flags,
          then the ink line on top. */}
      <svg viewBox="0 0 128 128" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={ARC} stroke="var(--paper)" strokeWidth="4.5" />
          <path d={HEAD} stroke="var(--paper)" strokeWidth="4.5" />
          <path d={ARC} stroke="#11203a" strokeWidth="2" />
          <path d={HEAD} stroke="#11203a" strokeWidth="2" />
        </g>
        <circle cx="93" cy="93" r="4.2" fill="var(--paper)" />
        <circle cx="93" cy="93" r="2.3" fill="#11203a" />
      </svg>
    </div>
  );
}
