// A stacked flag badge for corridor pages: destination flag fills the top
// half, source flag the bottom half. Real flag images (flagcdn) are used so
// each half fills with colour.
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
      className={`relative h-64 w-44 shrink-0 overflow-hidden rounded-2xl border border-line-strong shadow-sm ${className}`}
      role="img"
      aria-label={`${sourceName} to ${destName}`}
    >
      {/* Destination - top half */}
      <img
        src={flag(destIso2)}
        alt=""
        className="absolute inset-x-0 top-0 h-1/2 w-full object-cover"
      />
      {/* Source - bottom half */}
      <img
        src={flag(sourceIso2)}
        alt=""
        className="absolute inset-x-0 bottom-0 h-1/2 w-full object-cover"
      />
      {/* Horizontal divider */}
      <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-[var(--paper)]" />
    </div>
  );
}
