"use client";

// The reach map: a dot-matrix world where every dot is colored by the
// selected passport's access level for the country it falls in - the same
// hue system as the tile grid (green visa-free, amber on arrival, blue
// online; visa-required recedes as faint neutral). Pure data, no text -
// fills the right side of the landing count row on desktop.
import { useMemo } from "react";
import dots from "@/data/world-dots.json";

type DotKind = "free" | "fom" | "voa" | "online" | "req";

const FILL: Partial<Record<DotKind, string>> = {
  free: "var(--vfree)",
  fom: "var(--vfree)",
  voa: "var(--voa)",
  online: "var(--online)",
};

// Territories the geometry names separately but whose visa policy belongs to
// a dataset country.
const ALIAS: Record<string, string> = { GRL: "DNK", ESH: "MAR" };

export default function WorldDotMap({ kinds, selected }: { kinds: Record<string, DotKind>; selected: string[] }) {
  const circles = useMemo(() => {
    const sel = new Set(selected);
    return (dots as [number, number, string][]).map(([x, y, c], i) => {
      const iso3 = ALIAS[c] ?? c;
      const isSel = sel.has(iso3);
      const k = kinds[iso3];
      const fill = isSel ? "var(--ink)" : (k && FILL[k]) || "var(--ink-3)";
      const opacity = isSel ? 1 : k && FILL[k] ? 0.88 : 0.22;
      return <circle key={i} cx={x} cy={y} r={2.7} fill={fill} opacity={opacity} />;
    });
  }, [kinds, selected]);

  return (
    <svg viewBox="0 0 1000 520" className="h-auto w-full" role="img" aria-label="World map of the destinations this passport can reach">
      {circles}
    </svg>
  );
}
