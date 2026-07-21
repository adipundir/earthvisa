"use client";

// Compact visa-type card that opens a modal dialog with the full record.
// Owner directives: no inline expansion ("it can be a dialog that opens with
// more information"), compact-first cards, clean focus styling (the old
// details/summary focus ring clipped into a red bracket hugging the text).
import { useRef } from "react";

export type VisaTypeMeta = { text: string; tone?: "verdict" | "online" };

export type VisaTypeDialogProps = {
  name: string;
  category?: string;
  purpose?: string;
  meta: VisaTypeMeta[];
  /** Note sentences, pre-split server-side. 3+ render as bullets, fewer as prose. */
  sentences: string[];
  officialUrl?: string;
  officialLabel?: string;
};

function MetaRow({ meta, size = 13 }: { meta: VisaTypeMeta[]; size?: number }) {
  if (meta.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 font-medium tabular-nums text-ink-2" style={{ fontSize: size }}>
      {meta.map((m, i) => (
        <span key={i} className={m.tone === "verdict" ? "text-verdict" : m.tone === "online" ? "text-online" : undefined}>{m.text}</span>
      ))}
    </div>
  );
}

export default function VisaTypeDialog({ name, category, purpose, meta, sentences, officialUrl, officialLabel }: VisaTypeDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const hasDetail = sentences.length > 0 || !!officialUrl || !!purpose;

  const head = (
    <>
      <p className="text-[15px] font-semibold text-ink">{name}</p>
      {purpose && <p className="mt-1 text-[14px] leading-snug text-ink-2 line-clamp-2">{purpose}</p>}
      <div className="mt-2"><MetaRow meta={meta} /></div>
    </>
  );

  if (!hasDetail) {
    return <div className="rounded-xl border border-hair bg-surface px-4 py-3.5 text-left">{head}</div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="group block w-full rounded-xl border border-hair bg-surface px-4 py-3.5 text-left transition hover:border-hair-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {head}
        <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
          Details
          <svg viewBox="0 0 10 10" className="h-2 w-2 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 5h6M5.5 2.5L8 5 5.5 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </button>

      <dialog
        ref={ref}
        aria-label={name}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
        className="dialog-modal m-auto w-[min(92vw,34rem)] rounded-2xl border border-hair bg-surface p-0 text-ink shadow-xl backdrop:bg-black/45"
      >
        <div className="max-h-[80vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              {category && <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">{category}</p>}
              <h3 className="mt-0.5 text-[19px] font-bold tracking-tight text-ink">{name}</h3>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="-m-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-[19px] leading-none text-ink-3 transition hover:bg-ground hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >×</button>
          </div>

          {purpose && <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{purpose}</p>}
          <div className="mt-3"><MetaRow meta={meta} size={13.5} /></div>

          {sentences.length >= 3 ? (
            <ul className="mt-4 space-y-2 border-t border-hair pt-4">
              {sentences.map((t, i) => (
                <li key={i} className="flex gap-2 text-[14.5px] leading-relaxed text-ink-2">
                  <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink-3/70" />
                  <span className="min-w-0 break-words">{t}</span>
                </li>
              ))}
            </ul>
          ) : sentences.length > 0 ? (
            <p className="mt-4 border-t border-hair pt-4 text-[14.5px] leading-relaxed text-ink-2">{sentences.join(" ")}</p>
          ) : null}

          {officialUrl && (
            <a href={officialUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-accent underline-offset-2 hover:underline">
              {officialLabel ?? "Apply here"} ↗
            </a>
          )}
        </div>
      </dialog>
    </>
  );
}
