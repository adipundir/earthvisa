"use client";

// "Report an inaccuracy" - a quiet text link opening a small dialog form.
// Reports go to /api/report (Neon-backed) for review against official
// sources. The page path is attached automatically.
import { useRef, useState } from "react";

export default function ReportIssue({ page, className }: { page?: string; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: page ?? window.location.pathname,
          message,
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
    } catch {
      setError("Something went wrong - please try again.");
      setState("error");
    }
  }

  function close() {
    ref.current?.close();
    if (state === "done") {
      setMessage(""); setSourceUrl(""); setEmail(""); setState("idle"); setError("");
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
        Report an inaccuracy
      </button>

      <dialog
        ref={ref}
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
            <form onSubmit={submit} className="mt-3 space-y-3.5">
              <p className="text-[14px] leading-relaxed text-ink-2">
                Spotted wrong or outdated visa information on this page? Tell us - we check every report against official sources.
              </p>
              <label className="block">
                <span className="mb-1 block text-[13.5px] font-semibold text-ink">What&apos;s wrong?</span>
                <textarea
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. The fee changed to $60 in June, or visa on arrival was suspended"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13.5px] font-semibold text-ink">Source link <span className="font-normal text-ink-3">(optional, helps a lot)</span></span>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://official-government-page..."
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[13.5px] font-semibold text-ink">Your email <span className="font-normal text-ink-3">(optional, for follow-up)</span></span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </label>
              {/* honeypot - humans never see it */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
              {error && <p className="text-[13.5px] font-medium text-change">{error}</p>}
              <button
                type="submit"
                disabled={state === "sending"}
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent px-5 text-[14.5px] font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60 dark:bg-accent-deep dark:hover:bg-accent"
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
