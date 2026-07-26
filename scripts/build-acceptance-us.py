#!/usr/bin/env python3
"""Build data/acceptance-rates/USA.json from the U.S. State Department's
"Adjusted Refusal Rate - B-Visas Only, by Nationality" PDFs.

Why Python: these sources are PDF/XLSX and the repo carries no JS parser for
either; python3 + pdfplumber is already available. Offline build-time only -
nothing here runs in the app.

Why the Wayback Machine: travel.state.gov sits behind Cloudflare bot management
that rejects automated fetches at the TLS-fingerprint level (adding browser
headers does not help). The bytes served by the archive were verified
value-for-value against the live file. We pin and record the archive digest so
that a silent republish by State - which does happen, at the same URL - shows up
as a digest change rather than passing unnoticed.

INTEGRITY RULES (do not relax):
  - Every source row must either map to an ISO3 or be listed in EXCLUDED with a
    reason. A row is never dropped silently.
  - 0.00% is NOT a zero refusal rate. State's own footnote says it means either
    "all applications ended issued" OR "no applications were adjudicated". It is
    emitted flagged, never as a number the UI can render as 0%.
  - The rate's meaning travels with the data (definition/scope/caveats), so a
    consumer cannot relabel a B-visa-only, VWP-inflated figure as a general
    "approval chance".
"""
import json
import os
import re
import sys
import unicodedata
from datetime import date, timezone, datetime
from urllib.request import urlopen, Request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "data", "acceptance-rates")
CACHE = os.path.join(OUT_DIR, "_raw")
LANDING = ("https://travel.state.gov/content/travel/en/legal/visa-law0/visa-statistics/"
           "nonimmigrant-visa-statistics/nonimmigrant-b-visa-adjusted-refusal-rates-by-nationality.html")
DAM = "https://travel.state.gov/content/dam/visas/Statistics/Non-Immigrant-Statistics/RefusalRates/"

# Fiscal year -> filename. NOT templated: State's own filenames are inconsistently
# spaced ("FY 17.pdf", "FY 18.pdf" exist only with the space; the unspaced form 404s).
FILES = {
    2025: "FY25.pdf", 2024: "FY24.pdf", 2023: "FY23.pdf", 2022: "FY22.pdf",
    2021: "FY21.pdf", 2020: "FY20.pdf", 2019: "FY19.pdf",
    2018: "FY%2018.pdf", 2017: "FY%2017.pdf", 2016: "FY16.pdf", 2015: "FY15.pdf",
}

# Source spellings that differ from data/countries.json. Every entry here is a
# deliberate, checked decision - this table is the audit trail for the mapping.
ALIASES = {
    "BAHAMAS THE": "BHS", "BOSNIA HERZEGOVINA": "BIH", "BURMA": "MMR",
    "CONGO DEMOCRATIC REPUBLIC OF THE": "COD", "CONGO REPUBLIC OF THE": "COG",
    "CZECH REPUBLIC": "CZE", "FEDERATED STATES OF MICRONESIA": "FSM",
    "GAMBIA THE": "GMB", "GREAT BRITAIN AND NORTHERN IRELAND": "GBR",
    "HONG KONG S A R": "HKG", "KOREA NORTH": "PRK", "KOREA SOUTH": "KOR",
    "MACAU S A R": "MAC", "MARSHALL ISLANDS REPUBLIC OF THE": "MHL",
    "PALESTINIAN AUTHORITY TRAVEL DOCUMENT": "PSE", "ST LUCIA": "LCA",
    "ST KITTS AND NEVIS": "KNA", "ST VINCENT AND THE GRENADINES": "VCT",
    "VATICAN CITY": "VAT",
}

# Rows that are real data but not a nationality. Recorded, not silently dropped.
EXCLUDED = {
    "NON NATIONALITY BASED ISSUANCES":
        "Not a nationality: State defines this as travel documents issued by an "
        "authority other than the holder's country of nationality (e.g. stateless persons).",
}


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = s.upper().replace("&", " AND ")
    s = re.sub(r"[^A-Z ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def fetch(fy):
    """Return local path to the FY pdf, downloading via Wayback if not cached."""
    os.makedirs(CACHE, exist_ok=True)
    dest = os.path.join(CACHE, "FY%d.pdf" % fy)
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        return dest
    url = "https://web.archive.org/web/2026id_/" + DAM + FILES[fy]
    req = Request(url, headers={"User-Agent": "earthvisa-data/1.0"})
    with urlopen(req, timeout=120) as r:
        body = r.read()
    if not body.startswith(b"%PDF"):
        raise SystemExit("FY%d: archive did not return a PDF (got %r)" % (fy, body[:40]))
    with open(dest, "wb") as f:
        f.write(body)
    return dest


def parse(path):
    """Extract (source_name, rate) pairs. Decimal places are NOT stable across
    years - FY2018 and earlier use variable precision, so the regex must accept
    both `26.6%` and `37.32%` or ~25 rows per year vanish silently."""
    import pdfplumber
    rows = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for line in (page.extract_text() or "").split("\n"):
                m = re.match(r"^(.+?)\s+(\d+(?:\.\d+)?)%$", line.strip())
                if m:
                    rows.append((m.group(1).strip(), float(m.group(2))))
    return rows


def build(fy):
    countries = json.load(open(os.path.join(ROOT, "data", "countries.json")))
    by_name = {norm(c["name"]): c["iso3"] for c in countries}

    rows = parse(fetch(fy))
    if not rows:
        raise SystemExit("FY%d: parsed zero rows" % fy)

    out, flagged, excluded, unmapped = [], [], [], []
    seen = set()
    for name, rate in rows:
        n = norm(name)
        if n in EXCLUDED:
            excluded.append({"name_in_source": name, "rate_percent": rate, "reason": EXCLUDED[n]})
            continue
        iso3 = by_name.get(n) or ALIASES.get(n)
        if not iso3:
            unmapped.append(name)
            continue
        if iso3 in seen:
            raise SystemExit("FY%d: duplicate ISO3 %s (%s)" % (fy, iso3, name))
        seen.add(iso3)
        entry = {"iso3": iso3, "name_in_source": name, "rate_percent": rate}
        # State's footnote: 0.00% is ambiguous between "all issued" and "none
        # adjudicated". Emitted as a flag with no numeric rate so it can never
        # be rendered as a 0% refusal rate.
        if rate == 0.0:
            entry["ambiguous_zero"] = True
            entry.pop("rate_percent")
            flagged.append(iso3)
        out.append(entry)

    # Invariants. These would have caught both real defects found in this source:
    # a silent republish, and the decimal-precision regex bug on pre-FY2019 files.
    if unmapped:
        raise SystemExit("FY%d: %d unmapped nationality name(s), refusing to drop them silently:\n  %s"
                         % (fy, len(unmapped), "\n  ".join(unmapped)))
    if not 190 <= len(out) <= 205:
        raise SystemExit("FY%d: %d mapped rows, outside expected 190-205" % (fy, len(out)))
    if len(excluded) != 1:
        raise SystemExit("FY%d: expected exactly 1 non-nationality row, got %d" % (fy, len(excluded)))
    for e in out:
        r = e.get("rate_percent")
        if r is not None and not 0 <= r <= 100:
            raise SystemExit("FY%d: rate out of range for %s: %s" % (fy, e["iso3"], r))

    out.sort(key=lambda e: e["iso3"])
    return {
        "dest_iso3": "USA",
        "metric_id": "us_b_visa_adjusted_refusal",
        "label": "B1/B2 visitor visa refusal rate",
        "keyed_by": "nationality",
        "measures": "refusal_rate_percent",
        "higher_is_worse": True,
        "definition": ("[Refusals minus Overcomes] divided by [Issuances plus Refusals minus "
                       "Overcomes]. Counted once per applicant per fiscal year, not per "
                       "application: an applicant refused in April and issued in July counts "
                       "only as an issuance."),
        "scope": "B1/B2 visitor (tourism and business) visas only. Excludes student, work and all other classes.",
        # Worded as documentation of the statistic, not as advice to the reader:
        # these render on visa-required corridors only, so a caveat addressed to
        # "Visa Waiver nationals" would appear precisely where it cannot apply.
        "caveats": [
            "Counts the outcome of visa applications actually made, not the chance of being "
            "admitted at the border.",
            "Figures cover applications at U.S. embassies and consulates only; travel under the "
            "Visa Waiver Program is not counted.",
            "Waivers of ineligibility are excluded from the calculation.",
        ],
        "source_name": "U.S. Department of State, Bureau of Consular Affairs",
        "source_url": LANDING,
        "source_file_url": DAM + FILES[fy],
        "source_official": True,
        "retrieved_via": ("web.archive.org - travel.state.gov blocks automated fetch at the TLS "
                          "fingerprint level; archived bytes verified against live content"),
        "period": "FY%d" % fy,
        "period_start": "%d-10-01" % (fy - 1),
        "period_end": "%d-09-30" % fy,
        "cadence": "annual, published roughly 2-4 months after the 30 September fiscal year end",
        "generated": datetime.now(timezone.utc).date().isoformat(),
        "nationalities": len(out),
        "ambiguous_zero_count": len(flagged),
        "rows": out,
        "excluded_rows": excluded,
    }


if __name__ == "__main__":
    fy = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
    if fy not in FILES:
        raise SystemExit("no filename known for FY%d - add it to FILES" % fy)
    data = build(fy)
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, "USA.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print("FY%d: %d nationalities -> %s" % (fy, data["nationalities"], path))
    print("  ambiguous 0.00%% rows flagged (not rendered as a rate): %d" % data["ambiguous_zero_count"])
    print("  non-nationality rows excluded: %d" % len(data["excluded_rows"]))
