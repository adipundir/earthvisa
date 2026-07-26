#!/usr/bin/env python3
"""Build data/acceptance-rates/GBR.json from the Home Office "Entry clearance
visa applications and outcomes" detailed dataset.

This is the strongest acceptance-rate source available anywhere: genuine
per-nationality outcomes, visitor-visa-specific, quarterly, back to 2005.

Discovery: gov.uk regenerates the /media/<hash>/ path on every quarterly
release, so there is no stable file URL. The Content API listing IS stable and
is the correct anchor.

INTEGRITY RULES (do not relax):
  - Filter to Applicant type == "All". That value already includes dependants;
    summing all three applicant types double-counts every figure roughly 2x.
  - Rate is computed within this table only. Home Office Note 2: "An outcome in
    a given quarter may relate to an application raised in a previous quarter",
    so dividing outcomes by the separate applications table is invalid.
  - Raw counts are emitted alongside the rate so the figure is auditable and can
    be recomputed under a different denominator choice.
  - Every nationality either maps to an ISO3 or appears in EXCLUDED with a
    reason. Nothing is dropped silently.
"""
import json
import os
import re
import unicodedata
from datetime import datetime, timezone
from urllib.request import urlopen, Request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "data", "acceptance-rates")
CACHE = os.path.join(OUT_DIR, "_raw", "uk-entry-clearance.xlsx")
API = ("https://www.gov.uk/api/content/government/statistical-data-sets/"
       "immigration-system-statistics-data-tables")
ATT_PREFIX = "Entry clearance visa applications and outcomes detailed datasets"
QUARTERS = 4  # rolling year, smoother and less disclosure-suppressed than one quarter

# Home Office spellings that differ from data/countries.json. Each is a checked
# decision; this table is the audit trail.
ALIASES = {
    "BAHAMAS THE": "BHS", "CAPE VERDE": "CPV", "CONGO": "COG",
    "CONGO DEMOCRATIC REPUBLIC": "COD", "EAST TIMOR": "TLS",
    "FEDERATED STATES OF MICRONESIA": "FSM", "GAMBIA THE": "GMB",
    "IVORY COAST": "CIV", "MYANMAR BURMA": "MMR", "ST KITTS AND NEVIS": "KNA",
    "ST LUCIA": "LCA", "ST VINCENT AND THE GRENADINES": "VCT",
    "VATICAN CITY": "VAT",
}

# Rows that are real data but cannot be attributed to one of the 199 passports
# this site covers. Recorded with a reason rather than quietly discarded.
EXCLUDED = {
    "OTHER AND UNKNOWN": "Aggregate bucket, not a nationality.",
    "REFUGEE": "Travel-document category, not a nationality.",
    "STATELESS": "No nationality by definition.",
    "BRITISH OVERSEAS CITIZENS": "British nationality class, not a separate passport in our dataset.",
    "FORMER YUGOSLAVIA": "Defunct state; successor states are listed separately.",
    "SERBIA AND MONTENEGRO": "Defunct union; Serbia and Montenegro are listed separately.",
    "CYPRUS NORTHERN PART OF": "Not a state recognised in our country list.",
    "NIUE": "Not covered in our 199-passport dataset.",
    "WESTERN SAHARA": "Not covered in our 199-passport dataset.",
    "FRENCH SOUTHERN AND ANTARCTIC TERRITORIES": "Uninhabited territory, no passport issued.",
    "PUERTO RICO UNITED STATES": "US territory; holders travel on US passports.",
    "NORTHERN MARIANA ISLANDS UNITED STATES": "US territory; holders travel on US passports.",
}
# British Overseas Territories issue BOTC passports but are not among our 199.
BOT_SUFFIX = " (British)"


def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    s = s.upper().replace("&", " AND ")
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z ]", " ", s)).strip()


def discover():
    req = Request(API, headers={"User-Agent": "earthvisa-data/1.0"})
    with urlopen(req, timeout=120) as r:
        doc = json.load(r)
    for a in doc.get("details", {}).get("attachments", []):
        if str(a.get("title", "")).startswith(ATT_PREFIX):
            return a["url"], a["title"]
    raise SystemExit("could not find the entry-clearance attachment in the gov.uk Content API")


def fetch():
    url, title = discover()
    if not (os.path.exists(CACHE) and os.path.getsize(CACHE) > 1_000_000):
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        req = Request(url, headers={"User-Agent": "earthvisa-data/1.0"})
        with urlopen(req, timeout=900) as r, open(CACHE, "wb") as f:
            f.write(r.read())
    return url, title


def build():
    url, title = fetch()
    countries = json.load(open(os.path.join(ROOT, "data", "countries.json")))
    by_name = {norm(c["name"]): c["iso3"] for c in countries}

    import openpyxl
    wb = openpyxl.load_workbook(CACHE, read_only=True, data_only=True)
    ws = wb["Data_Vis_D02"]
    it = ws.iter_rows(values_only=True)
    for _ in range(3):
        next(it)
    hdr = [str(h).strip() if h else "" for h in next(it)]
    ix = {h: n for n, h in enumerate(hdr)}
    for need in ("Nationality", "Quarter", "Visa type group", "Applicant type", "Case outcome", "Decisions"):
        if need not in ix:
            raise SystemExit("column %r missing - Home Office changed the schema" % need)

    # Pass 1 is unavoidable: the newest quarters are not known until the file is read.
    raw = []
    quarters = set()
    for r in it:
        if r is None or r[ix["Nationality"]] is None:
            continue
        if r[ix["Applicant type"]] != "All":
            continue          # 'All' already includes dependants
        if r[ix["Visa type group"]] != "Visitor":
            continue
        q = str(r[ix["Quarter"]])
        quarters.add(q)
        raw.append((q, r[ix["Nationality"]], r[ix["Case outcome"]], r[ix["Decisions"]] or 0))

    window = sorted(quarters)[-QUARTERS:]
    if len(window) < QUARTERS:
        raise SystemExit("only %d quarters present, expected >= %d" % (len(window), QUARTERS))
    win = set(window)

    tallies = {}
    for q, nat, outcome, n in raw:
        if q not in win:
            continue
        t = tallies.setdefault(nat, {"Issued": 0, "Refused": 0, "Withdrawn": 0, "Lapsed": 0})
        if outcome in t:
            t[outcome] += int(n)

    rows, excluded, unmapped, low = [], [], [], 0
    for nat, t in tallies.items():
        n = norm(nat)
        if n in EXCLUDED or nat.endswith(BOT_SUFFIX):
            excluded.append({
                "name_in_source": nat,
                "reason": EXCLUDED.get(n, "British Overseas Territory; not among the 199 passports covered."),
            })
            continue
        iso3 = by_name.get(n) or ALIASES.get(n)
        if not iso3:
            unmapped.append(nat)
            continue
        decided = t["Issued"] + t["Refused"]
        if decided < 100:
            # Below this the quarter-to-quarter swing is larger than the signal,
            # and Home Office disclosure control distorts small cells.
            low += 1
            continue
        rows.append({
            "iso3": iso3,
            "name_in_source": nat,
            "rate_percent": round(100.0 * t["Refused"] / decided, 2),
            "issued": t["Issued"],
            "refused": t["Refused"],
            "withdrawn": t["Withdrawn"],
            "lapsed": t["Lapsed"],
        })

    if unmapped:
        raise SystemExit("%d unmapped nationality name(s), refusing to drop them silently:\n  %s"
                         % (len(unmapped), "\n  ".join(sorted(unmapped))))
    # Sized against the real distribution: 191 nationalities appear in a 4-quarter
    # window, 142 clear the 100-decision floor, and 4 of those are excluded
    # territories -> 138. The bound exists to catch a schema break or a filter
    # silently matching nothing, not to encode the exact current count.
    if not 120 <= len(rows) <= 210:
        raise SystemExit("%d mapped rows, outside expected 120-210" % len(rows))
    for e in rows:
        if not 0 <= e["rate_percent"] <= 100:
            raise SystemExit("rate out of range for %s: %s" % (e["iso3"], e["rate_percent"]))

    rows.sort(key=lambda e: e["iso3"])
    return {
        "dest_iso3": "GBR",
        "metric_id": "uk_visitor_visa_refusal",
        "label": "Standard Visitor visa refusal rate",
        "keyed_by": "nationality",
        "measures": "refusal_rate_percent",
        "higher_is_worse": True,
        "definition": ("Refused / (Issued + Refused) for Visitor entry-clearance decisions over the "
                       "four most recent quarters. Withdrawn and lapsed cases are excluded from both "
                       "sides because they are not decisions on the merits; their counts are included "
                       "here so the figure can be recomputed on a different basis."),
        "scope": "Visitor visas only (entry clearance). Excludes study, work, family and transit routes.",
        "caveats": [
            "Counts decisions made in the period, which may relate to applications submitted earlier.",
            "Home Office marks data from 2025 Q1 onward as provisional.",
            "Nationalities with fewer than 100 decisions in the window are omitted: small cells are "
            "distorted by disclosure control and swing heavily quarter to quarter.",
        ],
        "source_name": "UK Home Office",
        "source_url": "https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables",
        "source_file_url": url,
        "source_release": title,
        "source_official": True,
        "period": "%s to %s" % (window[0], window[-1]),
        "quarters": window,
        "cadence": "quarterly",
        "generated": datetime.now(timezone.utc).date().isoformat(),
        "nationalities": len(rows),
        "omitted_low_volume": low,
        "rows": rows,
        "excluded_rows": sorted(excluded, key=lambda e: e["name_in_source"]),
    }


if __name__ == "__main__":
    data = build()
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, "GBR.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print("%s: %d nationalities -> %s" % (data["period"], data["nationalities"], path))
    print("  omitted (under 100 decisions): %d" % data["omitted_low_volume"])
    print("  excluded non-nationality rows: %d" % len(data["excluded_rows"]))
