import Link from "next/link";

// Cross-link mesh between the /programs/* guides and the rankings page.
const GUIDES = [
  {
    href: "/programs/citizenship-by-investment",
    title: "Citizenship by Investment",
    desc: "Every CBI program compared by minimum investment, processing time and passport power.",
  },
  {
    href: "/programs/golden-visa",
    title: "Golden Visa Countries",
    desc: "Residency by investment programs worldwide, grouped by region, with paths to citizenship.",
  },
  {
    href: "/programs/digital-nomad-visa",
    title: "Digital Nomad Visas",
    desc: "Remote-work residence routes tracked from official government publications.",
  },
  {
    href: "/programs/easiest-citizenship",
    title: "Easiest Citizenship",
    desc: "The fastest legal routes to a second passport, ranked from the data.",
  },
  {
    href: "/rankings",
    title: "Passport Rankings 2026",
    desc: "All 199 passports ranked by visa-free access, from official sources.",
  },
];

export default function ProgramsNav({ current }: { current: string }) {
  const links = GUIDES.filter((g) => g.href !== current);
  return (
    <section className="mt-14">
      <h2 className="font-display text-2xl font-semibold text-ink">More Immigration Program Guides</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {links.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className="group flex min-h-[44px] flex-col justify-center rounded-sm border border-line bg-paper-2/70 px-4 py-3.5 transition hover:border-line-strong"
          >
            <span className="font-display text-sm font-semibold text-ink transition group-hover:text-stamp">
              {g.title} →
            </span>
            <span className="mt-1 text-[13px] leading-relaxed text-ink-soft">{g.desc}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
