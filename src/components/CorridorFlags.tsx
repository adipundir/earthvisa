"use client";

import { useState } from "react";

// A flag badge for corridor pages. Default (column) layout stacks the
// destination flag above the source flag as two rounded panels with real
// space between them, each labelled with its country name so the badge is
// legible even if you don't recognise the flag. `row` lays source →
// destination side by side for compact placements (e.g. the mobile header,
// no label - too small to fit one legibly). The caller sizes the column
// layout by WIDTH only (panel height follows from the 3:2 aspect ratio); the
// row layout is still sized by height via className.
//
// 3:2 is the most common flag ratio (used by the large majority of
// countries, incl. every flag in this dataset's top corridors), so panels
// use object-cover at a 3:2 frame: those flags render pixel-perfect edge to
// edge with zero cropping, and only non-3:2 outliers (e.g. UK 2:1,
// Switzerland 1:1, Nepal) get a small, deliberate crop rather than the
// letterboxed empty margins object-contain produced. Falls back to the emoji
// flag if flagcdn is unreachable.

const emojiFlag = (iso2: string) =>
  iso2.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

function FlagPanel({ iso2, name, row }: { iso2: string; name: string; row?: boolean }) {
  const [failed, setFailed] = useState(false);
  const frame = row
    ? "aspect-[3/2] h-full w-auto rounded-md border border-line-strong bg-paper-2 shadow-sm"
    : "aspect-[3/2] w-full rounded-2xl border border-line-strong bg-paper-2 shadow-sm";

  const flag = failed ? (
    <div aria-hidden="true" className={`flex items-center justify-center ${row ? "text-base" : "text-5xl"} ${frame}`}>
      {emojiFlag(iso2)}
    </div>
  ) : (
    <img
      src={`https://flagcdn.com/w320/${iso2.toLowerCase()}.png`}
      alt=""
      onError={() => setFailed(true)}
      className={`${row ? "object-contain" : "object-cover"} ${frame}`}
    />
  );

  if (row) return flag;

  return (
    <div className="relative">
      {flag}
      <div className="mono absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-ink/70 to-transparent px-3 pb-2 pt-5 text-[11px] font-medium uppercase tracking-[0.1em] text-white">
        {name}
      </div>
    </div>
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
          <FlagPanel iso2={sourceIso2} name={sourceName} row />
          <FlagPanel iso2={destIso2} name={destName} row />
        </>
      ) : (
        <>
          {/* Destination on top, source below */}
          <FlagPanel iso2={destIso2} name={destName} />
          <FlagPanel iso2={sourceIso2} name={sourceName} />
        </>
      )}
    </div>
  );
}
