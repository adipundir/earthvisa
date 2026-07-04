"use client";

import { useState } from "react";

// A flag badge for corridor pages. Default (column) layout stacks the
// destination flag above the source flag as two rounded panels with real
// space between them. `row` lays source → destination side by side for
// compact placements (e.g. the mobile header). The caller sizes the badge
// via className — the component carries no size utilities of its own, so
// there are never two competing height classes on the element.
//
// Flags render un-cropped (object-contain) on a warm paper letterbox, and
// fall back to the emoji flag if flagcdn is unreachable.

const emojiFlag = (iso2: string) =>
  iso2.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

function FlagPanel({ iso2, row }: { iso2: string; row?: boolean }) {
  const [failed, setFailed] = useState(false);
  const frame = row
    ? "aspect-[3/2] h-full w-auto rounded-md border border-line-strong bg-paper-2 shadow-sm"
    : "h-1/2 w-full rounded-2xl border border-line-strong bg-paper-2 shadow-sm";
  if (failed) {
    return (
      <div aria-hidden="true" className={`flex items-center justify-center ${row ? "text-base" : "text-5xl"} ${frame}`}>
        {emojiFlag(iso2)}
      </div>
    );
  }
  return (
    <img
      src={`https://flagcdn.com/w320/${iso2.toLowerCase()}.png`}
      alt=""
      onError={() => setFailed(true)}
      className={`object-contain ${frame}`}
    />
  );
}

export default function CorridorFlags({
  sourceIso2,
  destIso2,
  sourceName,
  destName,
  row = false,
  className = "",
}: {
  sourceIso2: string;
  destIso2: string;
  sourceName: string;
  destName: string;
  row?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex shrink-0 ${row ? "flex-row gap-2" : "flex-col gap-3"} ${className}`}
      role="img"
      aria-label={`${sourceName} to ${destName}`}
    >
      {row ? (
        <>
          <FlagPanel iso2={sourceIso2} row />
          <FlagPanel iso2={destIso2} row />
        </>
      ) : (
        <>
          {/* Destination on top, source below */}
          <FlagPanel iso2={destIso2} />
          <FlagPanel iso2={sourceIso2} />
        </>
      )}
    </div>
  );
}
