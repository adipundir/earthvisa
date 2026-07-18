import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/components/ProgramsNav";

// Index for every /programs/* route, so the bare /programs prefix resolves
// (it used to 404 while six child routes lived beneath it). Renders the same
// exported GUIDES registry as ProgramsNav - one list, no drift.
const PROGRAMS = GUIDES.filter((g) => g.href.startsWith("/programs/"));
const RANKINGS = GUIDES.find((g) => g.href === "/rankings");

const TITLE = "Immigration Programs: Golden Visas, CBI, Nomad, Work & Student Visas | Earth Visa";
const DESCRIPTION =
  "Every Earth Visa immigration-program guide in one place: citizenship by investment, golden visas, digital nomad visas, easiest citizenship routes, work visas and student visas - from official sources.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "https://earthvisa.in/programs" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "https://earthvisa.in/programs" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Earth Visa", item: "https://earthvisa.in" },
        { "@type": "ListItem", position: 2, name: "Programs", item: "https://earthvisa.in/programs" },
      ],
    },
  ],
};

export default function ProgramsIndexPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="min-h-screen">
        <header className="border-b border-line-strong bg-paper-2/60">
          <div className="mx-auto w-full max-w-6xl px-5 pt-6 pb-8 sm:px-8">
            <nav aria-label="Breadcrumb" className="mono mb-4 flex flex-wrap items-center gap-x-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-mute">
              <Link href="/" className="inline-flex min-h-[44px] items-center transition hover:text-ink">Earth Visa</Link>
              <span aria-hidden>/</span>
              <span className="inline-flex min-h-[44px] items-center text-ink">Programs</span>
            </nav>

            <div className="rule-double" />

            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
              Immigration Programs
              <span className="block text-2xl font-normal italic text-ink-soft sm:text-3xl">
                Golden Visas, Citizenship by Investment, Nomad, Work &amp; Student Routes
              </span>
            </h1>
            <p className="mono mt-2 text-[11px] font-medium uppercase tracking-[0.15em] text-stamp">
              {PROGRAMS.length} program guides · official sources only
            </p>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold text-ink">All Program Guides</h2>
            <p className="mt-2 max-w-3xl text-sm text-ink-soft">
              Longer-term routes beyond tourist entry: residence and citizenship by investment, remote-work visas,
              and employment and study permits - compared from official government publications.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {PROGRAMS.map((g) => (
                <li key={g.href}>
                  <Link
                    href={g.href}
                    className="group flex min-h-[44px] flex-col justify-center rounded-sm border border-line bg-paper-2/70 px-4 py-3.5 transition hover:border-line-strong"
                  >
                    <span className="font-display text-sm font-semibold text-ink transition group-hover:text-stamp">
                      {g.title} →
                    </span>
                    <span className="mt-1 text-[13px] leading-relaxed text-ink-soft">{g.desc}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {RANKINGS && (
            <section className="mt-12 max-w-3xl">
              <p className="text-sm leading-relaxed text-ink-soft">
                Weighing a second passport? Start from where yours stands:{" "}
                <Link href={RANKINGS.href} className="font-medium text-stamp underline-offset-2 hover:underline">
                  {RANKINGS.title}
                </Link>{" "}
                - {RANKINGS.desc}
              </p>
            </section>
          )}

          <section className="mt-12 rounded-lg border border-line-strong bg-paper-2/40 px-6 py-8 text-center">
            <h2 className="font-display text-xl font-semibold text-ink">
              See what your passport already unlocks
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Before investing in a program, check every destination your current passport - plus any visas you hold -
              can reach today.
            </p>
            <Link
              href="/"
              className="mono mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-sm border border-stamp bg-stamp/[0.07] px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-stamp transition hover:bg-stamp hover:text-white"
            >
              Check your passport on Earth Visa →
            </Link>
          </section>
        </div>
      </main>
    </>
  );
}
