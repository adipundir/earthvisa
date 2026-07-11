// The Earth Visa "Orbit" mark: a planet, one tilted orbit, and an accent node
// (the point of entry). Ink on paper by default; the node carries the rust.
export default function BrandMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="Earth Visa"
    >
      <circle cx="24" cy="24" r="8.5" fill="var(--ink)" />
      <g transform="rotate(-26 24 24)">
        <ellipse cx="24" cy="24" rx="16" ry="6.1" fill="none" stroke="var(--ink)" strokeWidth="2.4" />
        <circle cx="40" cy="24" r="3.1" fill="var(--stamp)" />
      </g>
    </svg>
  );
}
