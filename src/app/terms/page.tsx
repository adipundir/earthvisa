import type { Metadata } from "next";
import Link from "next/link";

// Terms of use.
//
// The load-bearing clause is the one about accuracy. Earth Visa tells people
// what documents a visa needs and whether they need one at all. If that is
// wrong, someone misses a flight. So the limits are stated plainly rather than
// buried in capitals: we publish what governments publish, a consular officer
// decides each case, and a border officer decides admission.
//
// Required alongside the privacy policy before the iOS app can be submitted.

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms you agree to when you use Earth Visa, and the limits of what it can tell you.",
  alternates: { canonical: "https://earthvisa.in/terms" },
};

const UPDATED = "6 August 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
      <h1 className="text-[34px] font-extrabold tracking-tight text-ink">Terms of use</h1>
      <p className="mt-2 text-[14px] text-ink-3">Last updated {UPDATED}</p>

      <div className="mt-10 space-y-10 text-[16px] leading-relaxed text-ink-2">
        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">What Earth Visa is</h2>
          <p>
            Earth Visa is an information tool. It collects visa rules that governments publish and
            presents them for a given passport and destination, with a link to the official source
            for every fact.
          </p>
          <p className="font-semibold text-ink">
            Earth Visa is not an immigration adviser, a law firm or a travel agent, and nothing here
            is legal advice.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Accuracy, and its limits</h2>
          <p>
            We take accuracy seriously. Visa policy is drawn from official government sources, every
            entry links to the page it came from, and where a government does not publish something we
            leave it out rather than estimating it. That is why our reach counts are conservative.
          </p>
          <p>Even so, three things are true and you should rely on them:</p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Rules change without notice, sometimes overnight, and our copy may be out of date.</li>
            <li>
              A consular officer decides each application on its own merits. No document checklist,
              bank balance or published statistic guarantees an outcome.
            </li>
            <li>
              A visa is not permission to enter. A border officer decides admission when you arrive,
              and can refuse it.
            </li>
          </ul>
          <p>
            Always check the official source we link before you pay a fee, book travel, or travel. If
            you find something wrong, use the report link on the page and we will check it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Statistics we publish</h2>
          <p>
            Where a government publishes refusal statistics, we show them using that government&apos;s own
            definition, scope and caveats. Those figures describe a population over a past period.
            They are not a prediction about your application and we never present them as one.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Community figures</h2>
          <p>
            Some pages show amounts that applicants report informally, clearly marked as such and kept
            separate from official guidance. Those are anecdotes, not requirements, and they are
            sometimes wrong. Treat them accordingly.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Accounts</h2>
          <p>
            You do not need an account to look anything up. If you create one, keep your phone and
            sign-in method secure, and tell us if you think someone else has access. You can delete
            your account at any time from the app, which permanently removes your data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Acceptable use</h2>
          <p>
            Do not scrape the site at a rate that degrades it for others, do not misrepresent Earth
            Visa as an official government service, and do not use it to give immigration advice you
            are not qualified to give.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">No affiliation</h2>
          <p>
            Earth Visa is independent. It is not affiliated with, endorsed by or connected to any
            government, embassy or consulate, nor to VFS Global, TLScontact, BLS International or any
            other visa application centre operator. Names and links appear only to identify the source
            of information.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Liability</h2>
          <p>
            Earth Visa is provided as is, without warranty. To the extent the law allows, we are not
            liable for loss arising from reliance on it, including missed travel, refused
            applications, or fees you cannot recover. Nothing here limits liability that cannot be
            limited by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Changes</h2>
          <p>
            We may update these terms. The date at the top shows when they last changed, and continuing
            to use Earth Visa after a change means you accept it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Contact</h2>
          <p>
            <a className="text-accent underline underline-offset-2" href="mailto:hello@earthvisa.in">
              hello@earthvisa.in
            </a>
          </p>
        </section>
      </div>

      <div className="mt-14 border-t border-hair pt-6 text-[14.5px]">
        <Link className="text-accent" href="/privacy">
          Privacy policy
        </Link>
      </div>
    </main>
  );
}
