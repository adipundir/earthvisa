import ReportIssue from "./ReportIssue";

/**
 * The standard "spotted something wrong?" line that sits at the end of any page
 * showing data. One component so the wording and placement can't drift between
 * pages - the corridor page had this markup inline and every other data page
 * had nothing but the footer link.
 */
export default function ReportLine({ className }: { className?: string }) {
  // A <div>, not a <p>: ReportIssue renders a <dialog> (with its own headings
  // and blocks), which is invalid - and a hydration error - inside a <p>.
  return (
    <div className={className ?? "mt-10 text-[13px] text-ink-2"}>
      <ReportIssue />
    </div>
  );
}
