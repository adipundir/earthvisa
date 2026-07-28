# Visa application product — architecture

Status: design, revision 2. Revised after an adversarial review returned
verdicts of *flawed* on four lenses and **fatally flawed** on the data model.
Two structural errors from revision 1 are corrected below and are called out
explicitly, because both were things this codebase already knew.

Supersedes the `visa_kits` capture experiment (a deadline calculator with an
email field). `applications` replaces it.

## Correction 1 — jurisdiction, not nationality

Revision 1 keyed applications on the site's `corridor` = (nationality,
destination). **That is the wrong key for an application.**

- Nationality decides *whether* a visa is needed.
- **Residence decides where and how you apply**, which consulate has
  jurisdiction, which centre takes the biometrics, and which document list
  applies.

Measured: `data/vfs/` is keyed `source_iso3 × destination_iso3` across **114
sources**, and `source` is the *application-centre jurisdiction*. An Indian
national living in Dubai applies under UAE rules at a Dubai centre.

The site already publishes a guide on precisely this
(`/guide/applying-from-your-country-of-residence`). The architecture ignored it.

**Consequence:** `traveller.residence_iso3` is required, not optional, and is
asked at signup. Application routing keys on **(residence, destination)**;
eligibility keys on **(nationality, destination)**. They are different questions
and must be different columns.

## Correction 2 — visa_type has no stable identity

Revision 1 said all specs "resolve per (destination, visa_type)". Measured
overlap between the catalogue's `(destination, name)` pairs and VFS's:
**25 of 3,275 — 0.8%.** That join does not exist. `src/lib/merge-visa-types.ts`
was written earlier *because* these names disagree, and 48% of its matches are
category-only with no name resemblance.

**Consequence:** config specs key on **our own stable `visa_product_id`**, minted
by us and mapped to catalogue and VFS records. Never on a name from either source.

## Domain model

```
account                phone (OTP) + email. Both, not either — see Delivery.
  └── traveller        a person we can apply for. NO passport fields on this row.
        ├── passport   (traveller, nationality_iso3, number, expiry) — 1..n
        │              a dual national is two rows, not an unrepresentable case
        └── application
              ├── application_step      instantiated from step_spec
              ├── application_document  links a document to a requirement
              ├── payment               government fee + service fee, split
              └── event                 append-only audit log

document               owned by TRAVELLER, not application. typed, encrypted,
                       with expiry. reusable across applications.
```

**Keys.** `application` is identified by
`(traveller_id, passport_id, residence_iso3, destination_iso3, visa_product_id, attempt_no)`.

`attempt_no` exists because **a refusal is followed by re-application on an
otherwise identical tuple**. Revision 1's uniqueness constraint would have
rejected or overwritten it, destroying the first attempt's record — in a
category where the refusal history is the single most decision-relevant fact.

## Config layer

Four specs resolve per `(visa_product_id, residence_iso3)`:

| spec | answers | reality today |
|---|---|---|
| `requirement_spec` | which documents, what constraints | VFS covers 114 of 199 residences; 4.5% of visa-required corridors |
| `step_spec` | what happens in what order | hand-authored |
| `form_spec` | profile field → government field | hand-authored, highest cost |
| `fee_spec` | government + service fee | `data/visa-fees/`, one frozen 2026-07-02 snapshot |

Specs are **versioned and pinned to the application at submission**. Policy
changes mid-application otherwise silently rewrite what we told someone.

Document constraints are evaluated at `coalesce(appearance_at,
intended_entry_at)` — never at upload time. A bank statement valid today can be
stale on the appointment date.

## State machine

```
draft → collecting → ready → submitted → in_progress → decided → closed
                                    ↓                       ↓
                                 blocked            outcome_unknown
```

`outcome_unknown` exists because **we have no read access to government status**.
We are deliberately not a VFS third party, so the tracking reference belongs to
the applicant. Approved customers go quiet; refused customers reply. Without a
separate terminal state, `decided` silently mixes "we learned" with "we assumed",
and every statistic built on it inherits the bias.

Transitions are events. The `event` table is append-only: after a refusal we must
be able to answer *what did we know, and when*.

## Fulfilment

| Channel | Submission | Automatable |
|---|---|---|
| eTA | online, near-instant | yes |
| e-visa | online form | partially, with human review |
| VFS / embassy | appointment + biometrics + appearance | **no** |

- VFS states publicly it works with no third-party entities; appointments are
  bookable only on its own site.
- VFS has escalated to physical exclusion — agents barred from UK Visa
  Application Centres in Pakistan, and barred from collecting passports.
- Personal appearance is legally irreducible (22 CFR 41.102; Visa Code Art 10(1)).

**Preparation-first, human fulfilment behind it.** One caveat the review was
right to raise: "preparation is sanctioned" derives from a **US consular rule**
and does not generalise. Australia (MARA) and the UK (OISC) regulate immigration
assistance differently. **Build order must follow legal permissibility per
destination, not data coverage.**

`appearance_at` + `appearance_tz` are nullable columns on `application` — the
applicant books, we record. Booking automation is out of scope permanently.

## Money and delivery

Two amounts, never merged: **government fee** (pass-through, non-refundable once
submitted) and **service fee** (ours). Refund policy must exist before the first
payment — it is the category's loudest complaint and its clearest opening.

`blocked` requires an outbound channel. Phone-only identity leaves SMS or
WhatsApp; WhatsApp Business templates need approval lead time. **Email is
required at signup**, not optional, or the state has no delivery mechanism.

## Security

Passport scans and **government-portal credentials** are the two highest-risk
classes. Credentials are higher: their compromise is account takeover on a
foreign government system under our named preparer identity.

- **Authorization is an explicit ownership check on every read**, including
  `document_id` supplied on attach. Revision 1 had no authorization model, which
  is a direct IDOR read of another customer's passport.
- **Envelope encryption** with our own key. Platform "encryption at rest"
  decrypts transparently for any caller holding a leaked token.
- Bytes in private Blob, never in Postgres. Short-lived signed URLs. Document IDs
  never logged.
- **Phone OTP alone is insufficient** where one factor is also the recovery
  factor — SIM swap is industrialised in the primary market. Step-up required
  before any vault read.
- The fulfilment console reads the entire vault by design. It is the most
  privileged surface in the system, needs named operator accounts and an access
  log, and must not ship as a shared admin token.
- **Retention deletes on a deadline set at submission** (corridor processing time
  + grace), not on learning an outcome. Learning one only releases data earlier.

## Legal

Not optional, and sequenced before the first stored passport scan:

- A legal entity. India's DPDP Act 2023 sets penalties up to ₹250 crore for
  failure to take reasonable security safeguards.
- GDPR Art. 3(2) applies to an India-established controller serving EU data
  subjects; Art. 27 then requires a designated EU representative.
- Destination-specific regimes (OISC, MARA, US UPL) gate *which corridors* may be
  served at all.

## Build order — revised

Revision 1 ordered by data coverage. The economics lens refuted it: realistic
year-one volume is **20–75 applications**. An engine saving 45 minutes each pays
back at ~160. Building it first is negative work.

Corrected order, cheapest learning first:

1. **Sell it manually before building it.** One corridor, legally cleared. Take
   payment, prepare by hand, deliver. Software: a payment link and a form.
2. **Charge from application one.** Payments were phase 4; the first dollar
   arrived after ~600 hours of work that taught nothing about willingness to pay.
3. **Build only where the manual process hurts**, in that order. Expect the
   document vault to be last, not first — it justifies itself on reuse, and reuse
   at 20–75 applications a year is approximately zero.
4. Identity, vault, engine, console — when volume forces them, not before.

## Deliberately not doing

- Appointment booking automation — enforcement risk
- Any promise to remove the applicant's trip to the visa centre — impossible
- Any approval guarantee — sovereign decision
- Any published self-reported approval rate — self-reported outcomes are
  refusal-biased; `data/acceptance-rates/` stays official-source-only
- Any commerce field in `data/` — the dataset stays independent of what we
  monetise, or the sourcing claim the site rests on collapses
