"use client";

// "Report an inaccuracy" - a quiet text link opening a small dialog form.
// Reports go to /api/report (Neon-backed) for review against official
// sources. The page path is attached automatically.
//
// The form is built around one tap. It used to open on an empty required
// textarea, which asks the reader to compose prose before they can tell us
// anything - most people who spot a wrong fee will not do that. Now a reason
// chip is the whole required input; details, a source link and an email are
// optional and stay folded away until asked for.
//
// The API contract is unchanged: the chosen reason is sent as `message` (its
// label is deliberately a full sentence, comfortably over the API's 10-character
// minimum) with any typed detail appended.
import { useRef, useState } from "react";
import { track } from "@vercel/analytics";

const REASONS = [
  "The fee is wrong or out of date",
  "The visa policy has changed",
  "The stay length or validity is wrong",
  "The document list is wrong",
  "A link or source is broken",
  "Something else on this page",
] as const;

export default function ReportIssue({ page, className, label }: { page?: string; className?: string; label?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<string>("");
  const [message, setMessage] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending" || !reason) return;
    setState("sending");
    setError("");
    const detail = message.trim();
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: page ?? window.location.pathname,
          message: detail ? `${reason}\n\n${detail}` : reason,
          sourceUrl: sourceUrl || undefined,
          email: email || undefined,
          website: (new FormData(e.currentTarget).get("website") as string) || "",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Something went wrong - please try again.");
        setState("error");
        return;
      }
      setState("done");
      track("report_submitted", { page: page ?? window.location.pathname, reason });
    } catch {
      setError("Something went wrong - please try again.");
      setState("error");
    }
  }

  function close() {
    ref.current?.close();
    if (state === "done") {
      setReason(""); setMessage(""); setSourceUrl(""); setEmail(""); setState("idle"); setError("");
    }
  }

  const inputCls = "w-full rounded-lg border border-hair-strong bg-surface px-3 py-2 text-[15px] text-ink outline-none transition placeholder:text-ink-3 focus:border-accent";

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={className ?? "relative text-[13px] font-medium text-ink-2 underline-offset-2 transition after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] hover:text-ink hover:underline"}
      >
        {label ?? "Report an inaccuracy"}
      </button>

      <dialog
        ref={ref}
        aria-label="Report an inaccuracy"
        onClick={(e) => { if (e.target === ref.current) close(); }}
        className="dialog-modal m-auto w-[min(92vw,28rem)] rounded-2xl border border-hair bg-surface p-0 text-ink shadow-xl backdrop:bg-black/45"
      >
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-[19px] font-bold tracking-tight text-ink">Report an inaccuracy</h3>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="-m-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-[19px] leading-none text-ink-3 transition hover:bg-ground hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >×</button>
          </div>

          {state === "done" ? (
            <div className="mt-3">
              <p className="text-[15px] leading-relaxed text-ink">Thank you - your report is in.</p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
                Every report is reviewed against official government sources before anything changes on the site.
              </p>
              <button type="button" onClick={close} className="chip mt-4">Close</button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-3">
              <p className="text-[14px] leading-relaxed text-ink-2">
                Pick what looks wrong. That alone is enough - we check every report against official sources.
              </p>

              <fieldset className="mt-3">
                <legend className="sr-only">What&apos;s wrong?</legend>
                <div className="flex flex-wrap gap-2">
                  {REASONS.map((r) => {
                    const on = reason === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setReason(on ? "" : r)}
                        className={`min-h-[38px] rounded-lg border px-3 text-[13.5px] font-medium transition ${
                          on
                            ? "border-accent bg-accent text-white dark:bg-accent-deep"
                            : "border-hair-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink"
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Everything below is optional and folded away, so the default
                  path is: tap a reason, send. */}
              <details className="group mt-4">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[13.5px] font-medium text-ink-2 transition hover:text-ink [&::-webkit-details-marker]:hidden">
                  Add details or a source
                  <svg viewBox="0 0 12 8" aria-hidden="true" className="h-2.5 w-2.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </summary>
                <div className="mt-3 space-y-3.5">
                  <label className="block">
                    <span className="mb-1 block text-[13.5px] font-semibold text-ink">What should it say? <span className="font-normal text-ink-3">(optional)</span></span>
                    <textarea
                      maxLength={1800}
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="e.g. the fee went up to $60 in June"
                      className={inputCls}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[13.5px] font-semibold text-ink">Source link <span className="font-normal text-ink-3">(helps a lot)</span></span>
                    <input
                      type="url"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="https://official-government-page..."
                      className={inputCls}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[13.5px] font-semibold text-ink">Your email <span className="font-normal text-ink-3">(for follow-up)</span></span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputCls}
                    />
                  </label>
                </div>
              </details>

              {/* honeypot - humans never see it */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
              {error && <p className="mt-3 text-[13.5px] font-medium text-change">{error}</p>}
              <button
                type="submit"
                disabled={state === "sending" || !reason}
                className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent px-5 text-[14.5px] font-semibold text-white transition hover:bg-accent-deep disabled:opacity-45 dark:bg-accent-deep dark:hover:bg-accent"
              >
                {state === "sending" ? "Sending..." : "Send report"}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
