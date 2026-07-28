# Product decisions

Decisions taken so the build is not blocked. Each states its reasoning and what
would overturn it. Companion to `visa-product-architecture.md` (revision 2).

Owner action is flagged where a decision cannot be executed in code.

---

## 1. Which corridors to serve first

**Decision: e-visa corridors only, and no destination that regulates paid
immigration assistance.**

Excluded for phase 1: **UK (OISC), Australia (MARA), USA (unauthorised practice
of immigration law), Canada (ICCRC/CICC), New Zealand (IAA).** These five license
who may be paid to assist, and the licence is personal to an adviser, not
purchasable by a company. Serving them first would put the whole business behind
a registration we do not hold.

That exclusion is cheaper than it looks: the traffic those five attract is
overwhelmingly *inbound-strong-passport* — people checking whether they need a
visa, and mostly they don't.

Order of attack:

1. **e-visa** — online form, no appointment, no biometrics, no VFS, near-certain
   approval. Legally the quietest layer and operationally the cheapest.
2. **visa-required, unregulated destinations** — only once (1) has produced real
   applications and real support load.
3. **Regulated destinations** — only with a registered adviser, or never.

**Overturned by:** taking regulated-market legal advice that contradicts the
above, or partnering with a licensed adviser.

---

## 2. Refund policy

**Decision: refund the service fee in full on refusal. Never refund the
government fee, because we never hold it.**

Stated before payment, in the checkout, not in a linked terms page.

Reasoning: the sharpest complaint in the category is the gap between what the
incumbent guarantees and what customers believe it guarantees. Atlys guarantees
**on-time delivery** — *"We are 99.7% on time… we give you a full refund"* — which
covers speed, not approval. Review mining found 207 applicants describing a
refusal; of the 77 who discussed money, **43 reported getting nothing back**,
14 got 75%, 4 got app credits, 3 got a clean refund.

That gap is the opening. Refunding our own fee on refusal is affordable
precisely because we will decline low-odds applications (§3), and it converts the
category's worst moment into the reason someone recommends us.

Rules:

- **Service fee:** refunded in full if the application is refused.
- **Service fee:** refunded in full if we fail to submit by the agreed date.
- **Government fee:** never refunded, and never touched — the applicant pays the
  government directly wherever the portal allows it. Money we never hold cannot
  become money we are accused of keeping.
- **No refund** where the applicant supplied false information or missed their
  own appearance. Both are recorded in the event log, not argued over later.
- Refunds are automatic on recording a refusal, not on request. A refund that
  must be chased is the complaint, not the remedy.

**Deliberately NOT offered:** any approval guarantee. Approval is a sovereign
decision. Guaranteeing it is how the incumbent generates its worst reviews.

**Owner action:** the payment processor must support partial capture or separate
line items so the government fee is never commingled with ours.

---

## 3. Declining low-odds applications

**Decision: we refuse to take money for applications we expect to fail, and we
show the refusal rate before checkout wherever a government publishes one.**

We hold official per-nationality refusal rates for 403 corridors. Where the rate
is above a threshold (start at 50%), the checkout shows it and offers the free
official route instead of a paid one.

This is unusual, deliberately. It is also what makes §2 affordable — a full
refund on refusal is only sustainable if we are not selling into corridors that
refuse half of applicants. The two decisions hold each other up.

It is the one thing a service whose revenue depends on filed applications
structurally cannot copy.

---

## 4. Document storage is the gate, not payment

An engineering constraint, not business advice.

Phase 1 (e-visa preparation) can ship **without storing a single document**: the
applicant uploads straight to the government portal, we prepare and check.

That matters because storing passport scans is what pulls in data-protection
obligations — DPDP in India, GDPR where EU residents are served. So the build
order is: **ship the parts that store nothing, and treat "we now hold documents"
as a deliberate, separate step** rather than something that arrives by accident
with the first upload field.

Practical rule for the code: no document persistence before the security
controls in `visa-product-architecture.md` (envelope encryption, ownership
checks, deletion job) are all in place.

---

## 5. Money we hold

**Decision: the applicant pays the government directly wherever the portal
allows. We charge only our own service fee.**

Removes the largest category of dispute, keeps us out of holding
government funds, and makes §2 trivially honest — we can refund everything we
ever took.

Where a portal will not accept the applicant's own card, that corridor is not in
phase 1.
