"use client";

import { usePathname } from "next/navigation";
import ReportIssue from "./ReportIssue";

// Routes that already render their own contextual "Report an inaccuracy" line
// (ReportLine, or - on the corridor page - the same markup inlined by hand)
// right after their content. Showing the identical action again a moment
// later in the footer is pure duplication, not a second useful path, so the
// footer skips it on these routes and leaves the page-local one as the only
// (more contextual) copy.
const HAS_OWN_REPORT_LINE = [
  /^\/guide\/proof-of-funds/,
  /^\/guide\/argentina-citizenship/,
  /^\/guide\/mexico-citizenship/,
  // /destination/[slug] renders its own ReportLine - but /destination/europe is
  // a separate static page that does not, so it must not be suppressed here or
  // that route ships with no way to report anything at all.
  /^\/destination\/(?!europe$)[^/]+$/,
  /^\/programs\/(golden-visa|work-visa|citizenship-by-investment|student-visa|digital-nomad-visa|easiest-citizenship)/,
  /^\/rankings$/,
  /^\/list\/[^/]+$/,
  /^\/compare/,
  /^\/passport\/[^/]+\/[^/]+$/, // corridor pages
];

// Renders its own leading separator dot too, so a suppressed link doesn't
// leave two adjacent dividers with nothing between them in the footer bar.
export default function FooterReportLink({ className }: { className?: string }) {
  const pathname = usePathname();
  if (HAS_OWN_REPORT_LINE.some((re) => re.test(pathname))) return null;
  return (
    <>
      <span className="h-3 w-px bg-hair-strong" aria-hidden="true" />
      <ReportIssue className={className} />
    </>
  );
}
