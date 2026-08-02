"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { isoToFlag } from "@/lib/format";
import { buildCredentialGroups, CRED_CHIP_LABEL, GROUP_ISO3 } from "@/components/DestinationExplorer";
import type { Credential } from "@/lib/types";

// The Earthling claim flow: declare holdings -> watch your reach -> claim the
// handle. Receives only the light country/credential lists as props - reach is
// computed server-side via /api/earthling/reach so this component never needs
// the 18MB dataset and the number can't be gamed client-side.

interface CountryOpt { iso3: string; iso2: string; name: string }

const MAX_PASSPORTS = 3;
const MAX_CREDENTIALS = 6;

// Shown as instant suggestions when the search field is focused empty.
const POPULAR_PASSPORTS = ["IND", "USA", "GBR", "DEU", "PHL", "PAK", "NGA", "BRA"];

// iso2 for GROUP_ISO3's country codes, so credential group headers can show a
// flag without an explorer-slice fetch - this component stays deliberately
// fetch-free (see the file comment above), so it uses the light isoToFlag
// helper instead of the dataset-backed flagFor used elsewhere on the site.
const ISO3_TO_ISO2: Record<string, string> = {
  USA: "US", CAN: "CA", GBR: "GB", ARE: "AE", IND: "IN", AUS: "AU", DEU: "DE",
  JPN: "JP", NZL: "NZ", KOR: "KR", SGP: "SG", MEX: "MX", CHL: "CL", COL: "CO",
  PER: "PE", BRA: "BR",
};
const GROUP_ISO2: Record<string, string> = Object.fromEntries(
  Object.entries(GROUP_ISO3).map(([group, iso3]) => [group, ISO3_TO_ISO2[iso3] ?? iso3]),
);

export default function EarthlingClaim({ countries, credentials }: {
  countries: CountryOpt[];
  credentials: Credential[];
}) {
  const [passports, setPassports] = useState<CountryOpt[]>([]);
  const [creds, setCreds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [credQuery, setCredQuery] = useState("");
  const [reach, setReach] = useState<{ total: number; percentile: number; visaFree: number; visaOnArrival: number; etaOrEvisa: number } | null>(null);
  const [loadingReach, setLoadingReach] = useState(false);
  const [reachError, setReachError] = useState(false);

  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState<null | { available: boolean; reason?: string }>(null);
  const [email, setEmail] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<
    | { pending: true; username: string; email: string; reach: number; percentile: number }
    | { pending?: false; username: string; reach: number; percentile: number; seq: number }
    | null
  >(null);
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const available = countries.filter((c) => !passports.some((p) => p.iso3 === c.iso3));
    if (!q) {
      // Empty query: clicking the field should immediately offer something -
      // the highest-traffic passports, in demand order.
      const byIso3 = new Map(available.map((c) => [c.iso3, c]));
      return POPULAR_PASSPORTS.map((iso3) => byIso3.get(iso3)).filter((c): c is CountryOpt => !!c).slice(0, 8);
    }
    return available.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, countries, passports]);

  // Credentials grouped by issuing country/bloc (same grouping DestinationExplorer
  // uses) so Step 2 reads as ~16 labelled clusters instead of a flat 22-pill wall.
  const credentialGroups = useMemo(() => buildCredentialGroups(credentials), [credentials]);
  const credGroupMatches = useMemo(() => {
    const q = credQuery.trim().toLowerCase();
    if (!q) return credentialGroups;
    return credentialGroups
      .map((g) => ({ ...g, items: g.items.filter((c) => c.short.toLowerCase().includes(q) || c.label.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [credQuery, credentialGroups]);

  // Live reach preview - debounced, server-computed. All state updates happen
  // inside the timeout callback, and a stale flag stops out-of-order responses
  // (fetch for [IND] resolving after fetch for [IND,US_VISA]) from clobbering
  // the newer number.
  useEffect(() => {
    let stale = false;
    const t = setTimeout(async () => {
      if (passports.length === 0) { setReach(null); setReachError(false); setLoadingReach(false); return; }
      setLoadingReach(true);
      setReachError(false);
      try {
        const p = passports.map((x) => x.iso3).join(",");
        const c = [...creds].join(",");
        const res = await fetch(`/api/earthling/reach?passports=${p}&credentials=${c}`);
        if (stale) return;
        if (res.ok) setReach(await res.json());
        else setReachError(true);
      } catch {
        if (!stale) setReachError(true);
      } finally {
        if (!stale) setLoadingReach(false);
      }
    }, passports.length === 0 ? 0 : 350);
    return () => { stale = true; clearTimeout(t); };
  }, [passports, creds]);

  // Username availability - debounced; state only ever set inside the timeout,
  // stale responses discarded.
  useEffect(() => {
    let stale = false;
    const u = username.trim().toLowerCase();
    const t = setTimeout(async () => {
      if (u.length < 3) { setAvailability(null); return; }
      try {
        const res = await fetch(`/api/earthling/claim?u=${encodeURIComponent(u)}`);
        if (!stale && res.ok) setAvailability(await res.json());
      } catch { /* transient - next keystroke retries */ }
    }, u.length < 3 ? 0 : 350);
    return () => { stale = true; clearTimeout(t); };
  }, [username]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function claim() {
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await fetch("/api/earthling/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          email: email.trim(),
          passports: passports.map((p) => p.iso3),
          credentials: [...creds],
        }),
      });
      // Non-JSON bodies (plain-text 500s, proxies) must not masquerade as
      // network errors - parse defensively.
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setClaimError(data.error ?? `Something went wrong (${res.status}). Try again in a minute.`); return; }
      setClaimed(data.pendingVerification ? { ...data, pending: true } : data);
      track("claim_submitted", { pending: !!data.pendingVerification });
    } catch {
      setClaimError("Network error - try again.");
    } finally {
      setClaiming(false);
    }
  }

  async function copyProfile() {
    if (!claimed) return;
    try {
      await navigator.clipboard.writeText(`https://earthvisa.in/@${claimed.username}`);
      setCopied(true);
      track("share_link_copied", { surface: "earthling_profile" });
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }

  if (claimed?.pending) {
    return (
      <div className="rounded-xl border border-hair bg-surface px-6 py-10 text-center">
        <p className="text-[13px] font-semibold text-ink-2">One step left</p>
        <h2 className="mt-2 text-[24px] font-bold tracking-tight text-ink">Check your inbox</h2>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink-2">
          We sent a confirmation link to <strong className="font-semibold text-ink">{claimed.email}</strong>. Click it within
          24 hours to activate <strong className="font-semibold text-ink">@{claimed.username}</strong> and take your seat on
          the leaderboard. Until then the name is only reserved - nothing is published.
        </p>
        <p className="mt-6 text-[13px] font-medium tabular-nums text-ink-3">
          Your reach: {claimed.reach} destinations · beats {claimed.percentile}% of passports
        </p>
      </div>
    );
  }

  if (claimed) {
    return (
      <div className="rounded-xl border border-hair bg-surface px-6 py-10 text-center">
        <p className="text-[13px] font-semibold text-ink-2">Your Earthling ID - citizen of Earth #{claimed.seq}</p>
        <h2 className="mt-2 text-[26px] font-bold tracking-tight text-ink">@{claimed.username}</h2>
        <p className="stat-num mt-6 text-[clamp(56px,9vw,84px)] text-ink">{claimed.reach}</p>
        <p className="mt-2 text-[15px] text-ink-2">destinations reachable - more reach than {claimed.percentile}% of the world&apos;s passports</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`/earthling/${claimed.username}`}
            className="inline-flex min-h-[46px] items-center justify-center rounded-lg bg-accent px-5 text-[14.5px] font-semibold text-white transition hover:bg-accent-deep dark:bg-accent-deep dark:hover:bg-accent"
          >
            View your profile
          </a>
          <button
            onClick={copyProfile}
            className="inline-flex min-h-[46px] items-center justify-center rounded-lg border border-hair-strong bg-surface px-5 text-[14.5px] font-semibold text-ink transition hover:border-ink-3"
          >
            {copied ? "Copied" : "Copy share link"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Step 1: passports */}
      <div>
        <p className="text-[13px] font-semibold text-ink-2"><span className="tabular-nums">1 ·</span> Your passport{passports.length > 1 ? "s" : ""}</p>
        <div ref={boxRef} className="relative mt-3">
          <div className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-lg border border-hair-strong bg-surface px-3 py-2 transition focus-within:border-accent">
            {passports.map((p, i) => (
              <span key={p.iso3} className="inline-flex items-center gap-1.5 rounded-full border border-hair-strong bg-surface py-1 pl-2.5 pr-1 text-[13.5px] font-medium text-ink">
                <span aria-hidden="true">{isoToFlag(p.iso2)}</span> {p.name}
                {i === 0 && <span className="text-[11px] font-medium text-ink-3">primary</span>}
                <button
                  onClick={() => setPassports(passports.filter((x) => x.iso3 !== p.iso3))}
                  aria-label={`Remove ${p.name}`}
                  className="grid h-6 w-6 place-items-center rounded-full text-[15px] text-ink-3 transition hover:bg-ground hover:text-change"
                >×</button>
              </span>
            ))}
            {passports.length < MAX_PASSPORTS && (
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder={passports.length ? "Add another passport…" : "Search your country…"}
                className="min-w-[180px] flex-1 bg-transparent py-1 text-[15px] text-ink outline-none placeholder:text-ink-3"
              />
            )}
          </div>
          {open && (query.trim() || matches.length > 0) && (
            <ul role="listbox" className="float-panel absolute z-20 mt-2 w-full overflow-hidden py-1.5">
              {!query.trim() && matches.length > 0 && (
                <li aria-hidden="true" className="px-4 pb-1 pt-1.5 text-[12px] font-semibold text-ink-3">Popular passports - or type to search</li>
              )}
              {matches.length === 0 && (
                <li className="px-4 py-2.5 text-[14px] text-ink-3">No country matches - check the spelling.</li>
              )}
              {matches.map((c) => (
                <li key={c.iso3}>
                  <button
                    onClick={() => { setPassports([...passports, c]); setQuery(""); setOpen(false); }}
                    className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-ground"
                  >
                    <span aria-hidden="true" className="text-xl">{isoToFlag(c.iso2)}</span>
                    <span className="text-[15px] font-medium text-ink">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Step 2: credentials - grouped by issuing country/bloc, with a search
          box on top, instead of one flat wall of 22 pills. */}
      <div>
        <p className="text-[13px] font-semibold text-ink-2">
          <span className="tabular-nums">2 ·</span> Visas &amp; permits you hold{" "}
          <span className="font-normal text-ink-3">
            (optional - this is how you beat your passport&apos;s baseline
            {creds.size > 0 && `, ${creds.size}/${MAX_CREDENTIALS} selected`})
          </span>
        </p>
        {credentials.length > MAX_CREDENTIALS && (
          <input
            value={credQuery}
            onChange={(e) => setCredQuery(e.target.value)}
            placeholder="Search - Green Card, Schengen visa…"
            aria-label="Search visas and permits"
            className="mt-3 w-full max-w-sm rounded-lg border border-hair-strong bg-surface px-3.5 py-2 text-[14px] text-ink outline-none transition placeholder:text-ink-3 focus:border-accent"
          />
        )}
        <div className="mt-3 space-y-3.5">
          {credGroupMatches.length === 0 && (
            <p className="text-[13.5px] text-ink-3">No visas or permits match &ldquo;{credQuery}&rdquo;.</p>
          )}
          {credGroupMatches.map(({ name, items }) => (
            <div key={name}>
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-3">
                <span aria-hidden="true">{GROUP_ISO2[name] ? isoToFlag(GROUP_ISO2[name]) : "🌐"}</span> {name}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {items.map((c) => {
                  const on = creds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        const next = new Set(creds);
                        if (on) next.delete(c.id); else if (next.size < MAX_CREDENTIALS) next.add(c.id);
                        setCreds(next);
                      }}
                      aria-pressed={on}
                      className={`inline-flex min-h-[36px] items-center rounded-full border px-3.5 py-1 text-[13.5px] font-medium transition ${
                        on ? "border-accent/45 bg-surface text-accent" : "border-hair-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink"
                      }`}
                    >
                      {CRED_CHIP_LABEL[c.id] ?? c.short}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The number */}
      {passports.length > 0 && (
        <div className="rounded-xl border border-hair bg-surface px-6 py-8 text-center">
          {reach ? (
            <>
              <p className={`stat-num text-[clamp(56px,9vw,84px)] text-ink transition-opacity ${loadingReach ? "opacity-40" : ""}`}>{reach.total}</p>
              <p className="mt-3 text-[15px] text-ink-2">
                destinations without an embassy visa - <strong className="font-semibold text-ink">more reach than {reach.percentile}% of the world&apos;s passports</strong>
              </p>
              <p className="mt-2 text-[13px] font-medium tabular-nums text-ink-3">
                {reach.visaFree} visa-free · {reach.visaOnArrival} on arrival · {reach.etaOrEvisa} eTA / e-visa
              </p>
            </>
          ) : (
            reachError ? (
              <p className="text-[14px] text-change">Couldn&apos;t compute your reach - check your connection, then tap a passport chip to retry.</p>
            ) : (
              <p className="text-[14px] text-ink-3">Computing your reach…</p>
            )
          )}
        </div>
      )}

      {/* Step 3: claim */}
      {reach && (
        <div>
          <p className="text-[13px] font-semibold text-ink-2"><span className="tabular-nums">3 ·</span> Claim your Earthling ID - citizen of Earth</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="flex items-center rounded-lg border border-hair-strong bg-surface px-3 transition focus-within:border-accent">
                <span className="text-[15px] tabular-nums text-ink-3">earthvisa.in/@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="yourname"
                  maxLength={19}
                  className="min-h-[48px] flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
                />
              </div>
              {availability && (
                <p className={`mt-1.5 text-[13px] font-medium ${availability.available ? "text-ink-2" : "text-change"}`}>
                  {availability.available ? "Available" : availability.reason ?? "Taken"}
                </p>
              )}
            </div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              type="email"
              className="min-h-[48px] self-start rounded-lg border border-hair-strong bg-surface px-3 py-[11px] text-[15px] text-ink outline-none transition placeholder:text-ink-3 focus:border-accent"
            />
          </div>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-3">
            Your email is only used for reach-change alerts (e.g. a destination opens up for your passport). Holdings stay private - your profile shows the number, never the list.
          </p>
          {claimError && <p className="mt-2 text-[14px] text-change">{claimError}</p>}
          <button
            onClick={claim}
            disabled={claiming || !availability?.available || !email.includes("@")}
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-lg bg-accent px-6 text-[15px] font-semibold text-white transition hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40 dark:bg-accent-deep dark:hover:bg-accent"
          >
            {claiming ? "Claiming…" : `Claim @${username.trim().toLowerCase() || "…"}`}
          </button>
        </div>
      )}
    </div>
  );
}
