// A stacked flag badge for corridor pages: destination flag on top, source
// flag below, as two separate rounded panels with real space between them
// (not a single split rectangle).
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
      className={`flex h-56 w-64 shrink-0 flex-col gap-3 ${className}`}
      role="img"
      aria-label={`${sourceName} to ${destName}`}
    >
      {/* Destination */}
      <img
        src={flag(destIso2)}
        alt=""
        className="h-1/2 w-full rounded-2xl border border-line-strong object-cover shadow-sm"
      />
      {/* Source */}
      <img
        src={flag(sourceIso2)}
        alt=""
        className="h-1/2 w-full rounded-2xl border border-line-strong object-cover shadow-sm"
      />
    </div>
  );
}
