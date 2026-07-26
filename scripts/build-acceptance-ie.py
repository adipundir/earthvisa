#!/usr/bin/env python3
"""Build data/acceptance-rates/IRL.json from Ireland's published visa
applications-and-decisions dataset.

This is the cleanest source of the five: a genuine Received/Granted/Refused
triple per nationality in a single CSV, refreshed monthly.

Notes on the file:
  - Encoding is cp1252, not UTF-8 ("Aland Islands" arrives mojibaked otherwise).
  - Columns are YEARS, one per column, 2017..current.
  - Cells of "*" are disclosure-suppressed counts of 1-5, not zero.
  - assets.gov.ie serves 403 to a bare curl; a browser User-Agent is required.

INTEGRITY RULES (do not relax):
  - Rate uses decisions (Granted + Refused). "Received" includes applications
    still pending and would understate refusal.
  - A nationality whose Granted or Refused cell is suppressed ("*") is dropped,
    because the rate cannot be computed - not guessed at.
  - Every nationality either maps to an ISO3 or appears in EXCLUDED. Nothing is
    dropped silently.
"""
import csv
import json
import os
import re
import unicodedata
from datetime import datetime, timezone
from urllib.request import urlopen, Request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "data", "acceptance-rates")
CACHE = os.path.join(OUT_DIR, "_raw", "ie-visa-decisions.csv")
URL = ("https://assets.gov.ie/static/documents/bd11bc22/"
       "visa_applications_and_decisions_-_year_and_nationality.csv")
DATASET_PAGE = "https://data.gov.ie/dataset/visa-applications-and-decisions-year-and-nationality"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")
TYPE = "short term visa applications"   # the visitor-equivalent route
MIN_DECISIONS = 100

# Formal ISO-style names the normalisation cascade can't reach.
ALIASES = {
    "CONGO THE DEMOCRATIC REPUBLIC OF THE": "COD", "CONGO THE": "COG",
    "KOREA THE DEMOCRATIC PEOPLE S REPUBLIC OF NORTH KOREA": "PRK",
    "LAO PEOPLE S DEMOCRATIC REPUBLIC THE": "LAO", "MACAO": "MAC",
    "RUSSIAN FEDERATION THE": "RUS", "SYRIAN ARAB REPUBLIC THE": "SYR",
    "TURKIYE": "TUR", "VIET NAM": "VNM",
    "UNITED KINGDOM OF GREAT BRITAIN AND NORTHERN IRELAND THE": "GBR",
}

# Territories, dependencies and aggregates that are not among the 199 passports
# this site covers. Listed explicitly so the exclusion is auditable.
EXCLUDED_NAMES = {
    "*Other", "American Samoa", "Anguilla", "Antarctica", "Aruba", "Bermuda",
    "Bonaire, Sint Eustatius and Saba", "Bouvet Island", "Cayman Islands (the)",
    "Ceuta", "Christmas Island", "Cocos (Keeling) Islands (the)",
    "Cook Islands (the)", "Curaçao", "Falkland Islands (the) [Malvinas]",
    "Faroe Islands (the)", "French Guiana", "French Polynesia", "Gibraltar",
    "Greenland", "Guadeloupe", "Guam", "Guernsey",
    "Heard Island and McDonald Islands", "Isle of Man", "Jersey", "Martinique",
    "Mayotte", "Melilla", "Montserrat", "New Caledonia", "Niue",
    "Norfolk Island", "Northern Mariana Islands (the)", "Pitcairn",
    "Puerto Rico", "Réunion", "Saint Barthélemy",
    "Saint Martin (French part)", "Saint Pierre and Miquelon",
    "Sint Maarten (Dutch part)", "South Georgia and the South Sandwich Islands",
    "Svalbard and Jan Mayen", "Tokelau", "Turks and Caicos Islands (the)",
    "United States Minor Outlying Islands (the)", "Virgin Islands (British)",
    "Virgin Islands (U.S.)", "Wallis and Futuna", "Western Sahara",
    "Åland Islands",
}


def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    s = s.upper().replace("&", " AND ")
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z ]", " ", s)).strip()


def variants(n):
    """Ireland uses ISO 3166 formal names; peel them back toward common usage."""
    base = re.sub(r"\(the\)", "", n, flags=re.I)
    yield norm(n)
    yield norm(base)
    yield norm(re.sub(r"\(.*?\)", "", base))
    yield norm(base.split("(")[0])
    yield norm(base.split(",")[0])
    yield re.sub(r"\bTHE\b", "", norm(base)).strip()
    yield re.sub(r"\s+", " ", re.sub(r"\bTHE\b", "", norm(re.sub(r"\(.*?\)", "", base)))).strip()


def fetch():
    if os.path.exists(CACHE) and os.path.getsize(CACHE) > 10_000:
        return
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    req = Request(URL, headers={"User-Agent": UA})
    with urlopen(req, timeout=300) as r, open(CACHE, "wb") as f:
        f.write(r.read())


def build():
    fetch()
    countries = json.load(open(os.path.join(ROOT, "data", "countries.json")))
    by_name = {norm(c["name"]): c["iso3"] for c in countries}

    with open(CACHE, encoding="cp1252") as fh:
        rows = list(csv.DictReader(fh))
    years = [k for k in rows[0].keys() if re.fullmatch(r"\d{4}", k)]
    # The newest column is a part-year to the "Last Updated" date; use the most
    # recent COMPLETE calendar year so the rate isn't skewed by a partial period.
    year = sorted(years)[-2]
    updated = rows[0]["Last Updated"].strip()

    tallies = {}
    for r in rows:
        if r["Type"] != TYPE:
            continue
        tallies.setdefault(r["Nationality"], {})[r["Status"].strip()] = r[year].strip()

    out, excluded, unmapped, low, suppressed = [], [], [], 0, 0
    for nat, st in tallies.items():
        if nat in EXCLUDED_NAMES:
            excluded.append({"name_in_source": nat,
                             "reason": "Territory, dependency or aggregate; not among the 199 passports covered."})
            continue
        iso3 = next((by_name[v] for v in variants(nat) if v in by_name), None) or ALIASES.get(norm(nat))
        if not iso3:
            unmapped.append(nat)
            continue
        g, rf = st.get("Granted", ""), st.get("Refused", "")
        if not g.isdigit() or not rf.isdigit():
            # "*" means a suppressed count of 1-5. The rate is unknowable, so the
            # nationality is omitted rather than estimated.
            suppressed += 1
            continue
        g, rf = int(g), int(rf)
        if g + rf < MIN_DECISIONS:
            low += 1
            continue
        out.append({
            "iso3": iso3, "name_in_source": nat,
            "rate_percent": round(100.0 * rf / (g + rf), 2),
            "granted": g, "refused": rf,
        })

    if unmapped:
        raise SystemExit("%d unmapped nationality name(s), refusing to drop them silently:\n  %s"
                         % (len(unmapped), "\n  ".join(sorted(unmapped))))
    if not 60 <= len(out) <= 180:
        raise SystemExit("%d mapped rows, outside expected 60-180" % len(out))
    for e in out:
        if not 0 <= e["rate_percent"] <= 100:
            raise SystemExit("rate out of range for %s" % e["iso3"])

    out.sort(key=lambda e: e["iso3"])
    return {
        "dest_iso3": "IRL",
        "metric_id": "ie_short_stay_visa_refusal",
        "label": "Short-stay visa refusal rate",
        "keyed_by": "nationality",
        "measures": "refusal_rate_percent",
        "higher_is_worse": True,
        "definition": "Refused / (Granted + Refused) for short-stay visa applications decided in the year.",
        "scope": "Short-stay ('C') visa applications only. Long-stay ('D') applications are published separately and excluded here.",
        "caveats": [
            "Counts of 1 to 5 are suppressed in the source; nationalities whose granted or "
            "refused figure is suppressed are omitted rather than estimated.",
            "Nationalities with fewer than %d decisions in the year are omitted as too small to be stable." % MIN_DECISIONS,
        ],
        "source_name": "Department of Justice (Ireland) / Immigration Service Delivery",
        "source_url": DATASET_PAGE,
        "source_file_url": URL,
        "source_official": True,
        "period": year,
        "source_last_updated": updated,
        "cadence": "monthly",
        "generated": datetime.now(timezone.utc).date().isoformat(),
        "nationalities": len(out),
        "omitted_low_volume": low,
        "omitted_suppressed": suppressed,
        "rows": out,
        "excluded_rows": sorted(excluded, key=lambda e: e["name_in_source"]),
    }


if __name__ == "__main__":
    data = build()
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, "IRL.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print("%s: %d nationalities -> %s" % (data["period"], data["nationalities"], path))
    print("  omitted (under %d decisions): %d | suppressed cells: %d"
          % (MIN_DECISIONS, data["omitted_low_volume"], data["omitted_suppressed"]))
    print("  excluded territories/aggregates: %d" % len(data["excluded_rows"]))
