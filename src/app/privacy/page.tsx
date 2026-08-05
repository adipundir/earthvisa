import type { Metadata } from "next";
import Link from "next/link";

// Privacy policy.
//
// Written against what the code actually does, not from a template. Every claim
// here is checkable against a file: /api/subscribe, /api/report, /api/auth/*,
// src/lib/subscribers.ts, src/lib/reports.ts, src/lib/auth/store.ts, and the
// analytics scripts in layout.tsx. If any of those change, this page changes in
// the same commit.
//
// Required by App Store Guideline 5.1.1(i) before the iOS app can be submitted,
// and required independently of the app because the site already collects
// personal data.

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What Earth Visa collects, why, who processes it, and how to have it deleted.",
  alternates: { canonical: "https://earthvisa.in/privacy" },
};

const UPDATED = "6 August 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
      <h1 className="text-[34px] font-extrabold tracking-tight text-ink">Privacy policy</h1>
      <p className="mt-2 text-[14px] text-ink-3">Last updated {UPDATED}</p>

      <div className="mt-10 space-y-10 text-[16px] leading-relaxed text-ink-2">
        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">The short version</h2>
          <p>
            You can use Earth Visa without giving us anything. Looking up whether you need a visa
            requires no account, no email address and no sign-in, on the website and in the iOS app.
            In the app, the whole dataset is stored on your device, so those lookups do not reach us
            at all.
          </p>
          <p>
            We only hold personal data when you deliberately give it to us: by creating an account,
            reporting an inaccuracy, asking to be notified, or claiming an Earthling profile.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">What we collect, and when</h2>

          <h3 className="pt-2 text-[16.5px] font-semibold text-ink">If you create an account in the iOS app</h3>
          <p>
            We store your phone number, or the identifier and email address Apple gives us if you use
            Sign in with Apple. If you use Sign in with Apple and choose to hide your address, Apple
            gives us a relay address and never your real one. We also store a session token so you
            stay signed in.
          </p>
          <p>
            Verification codes are stored only as a one-way hash, never as the code itself, and are
            deleted as soon as they are used or expire.
          </p>

          <h3 className="pt-2 text-[16.5px] font-semibold text-ink">If you report an inaccuracy</h3>
          <p>
            We store the page you were on, your message, any source link you provide, your email
            address if you choose to give one, and your IP address. The IP is used to stop one person
            flooding the form and for nothing else.
          </p>

          <h3 className="pt-2 text-[16.5px] font-semibold text-ink">If you ask to be notified</h3>
          <p>
            We store your email address, the passports you asked us to watch, and your IP address for
            the same rate-limiting reason.
          </p>

          <h3 className="pt-2 text-[16.5px] font-semibold text-ink">If you claim an Earthling profile</h3>
          <p>
            We store the username you choose, your email address, the passports and credentials you
            selected, and the resulting reach figure. A claimed profile is public by design: that is
            the point of the feature.
          </p>

          <h3 className="pt-2 text-[16.5px] font-semibold text-ink">When you simply browse the website</h3>
          <p>
            Our host, Vercel, tells us the two-letter country your request came from so we can guess
            your passport. We do not store it. We use Vercel Analytics, which counts page views
            without cookies and without profiling individuals. On some pages we also use Microsoft
            Clarity, which records how people scroll and click and can capture a replay of a browsing
            session, so we can see where the site confuses people. You can opt out of Clarity at{" "}
            <a
              className="text-accent underline underline-offset-2"
              href="https://clarity.microsoft.com/terms"
              rel="noopener noreferrer"
              target="_blank"
            >
              clarity.microsoft.com/terms
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">What the iOS app does not do</h2>
          <p>
            The app contains no advertising identifier, no tracking SDK, no third-party analytics and
            no crash-reporting service. It does not ask for your location. It works fully offline, and
            the only times it contacts us are to check for updated visa data, and to sign you in if
            you choose to.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Documents</h2>
          <p>
            If a future version of the app lets you store documents such as a passport scan or a bank
            statement, those stay encrypted on your device. We will only ever receive a document if
            you explicitly ask Earth Visa to submit an application on your behalf, and then only the
            documents that application needs. We will describe that clearly at the point you are asked,
            before anything leaves your phone. This paragraph will be updated with specifics before any
            such feature ships.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Who else processes your data</h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Vercel, for hosting and privacy-friendly analytics.</li>
            <li>Neon, for the database that stores accounts, reports and sign-ups.</li>
            <li>Resend, for sending email such as profile confirmations.</li>
            <li>Microsoft Clarity, for website behaviour analytics and session replay.</li>
            <li>Apple, if you use Sign in with Apple.</li>
            <li>An SMS provider, to deliver verification codes to your phone.</li>
          </ul>
          <p>We do not sell your data, and we do not share it for advertising.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">How long we keep it</h2>
          <p>
            Account data is kept until you delete your account. Verification codes are deleted within
            minutes. Rate-limiting records are deleted within hours. Inaccuracy reports are kept while
            we check them against official sources and then deleted. Earthling profiles are kept until
            you ask us to remove them.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Deleting your data</h2>
          <p>
            In the iOS app, go to Account and choose Delete account. That permanently removes your
            account, your saved applications and any documents, and it cannot be undone. Visa
            information keeps working without an account.
          </p>
          <p>
            For anything else, including an Earthling profile, a newsletter sign-up or a report you
            filed, email{" "}
            <a className="text-accent underline underline-offset-2" href="mailto:privacy@earthvisa.in">
              privacy@earthvisa.in
            </a>{" "}
            and we will delete it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Your rights</h2>
          <p>
            Depending on where you live, you may have the right to access, correct, export or delete
            the personal data we hold about you, and to object to how we use it. This includes rights
            under the EU and UK GDPR and, in India, under the Digital Personal Data Protection Act.
            Write to{" "}
            <a className="text-accent underline underline-offset-2" href="mailto:privacy@earthvisa.in">
              privacy@earthvisa.in
            </a>{" "}
            and we will respond.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Children</h2>
          <p>
            Earth Visa is not directed at children and we do not knowingly collect data from anyone
            under 13, or under 18 in India without a parent or guardian consenting. If you believe a
            child has given us data, write to us and we will delete it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Changes</h2>
          <p>
            If this policy changes we will update the date at the top. If a change materially affects
            what we collect, we will say so in the app and on the site rather than changing it quietly.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[20px] font-bold text-ink">Contact</h2>
          <p>
            <a className="text-accent underline underline-offset-2" href="mailto:privacy@earthvisa.in">
              privacy@earthvisa.in
            </a>
          </p>
        </section>
      </div>

      <div className="mt-14 border-t border-hair pt-6 text-[14.5px]">
        <Link className="text-accent" href="/terms">
          Terms of use
        </Link>
      </div>
    </main>
  );
}
