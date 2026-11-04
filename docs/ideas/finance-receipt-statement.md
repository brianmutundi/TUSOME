# Finance Receipt & Fee Statement — Next Iteration

## Problem Statement
How might we let bursars issue a printable, shareable receipt and a per-student fee statement immediately after recording a payment, so parents can verify what they paid and what they still owe — while keeping tenant isolation, immutability and audit trails intact?

## Recommended Direction
Parent portal-lite on top of the signed-link infrastructure just shipped. The signed `/receipt/<token>` and `/statement/<token>` routes already give guardians no-login access to a single receipt or statement. The next step is a thin parent-facing view: a guardian logs in (or uses a long-lived signed link) and sees all their linked children, each child's receipts and current statement, plus a "pay/owe" summary. Reuse `parent_student_links`, `get_student_guardian_contacts`, and the statement/receipt RPCs; do not build a second student registry or a new auth system. Keep signed links as the bridge for one-off shares; the portal becomes the primary channel.

## Key Assumptions to Validate
- [ ] Parents have smartphones and data to open signed links — validate by SMS click-through rate in staging.
- [ ] Guardian phone numbers in `parent_student_links`/`students` are accurate — validate with a data-quality audit before go-live.
- [ ] Thermal printers respect `@page { size: 80mm auto }` via the browser print driver — validate with a real 80mm printer; if not, add ESC/POS generation.
- [ ] The Android companion app actually polls `get_pending_sms` and calls `update_sms_status` — without this, "Queued" never becomes "Sent".
- [ ] A staging Supabase project becomes available — otherwise no end-to-end verification is possible.

## MVP Scope
**In:**
- Parent portal-lite page: list linked children, per-child receipts and statement, outstanding balance.
- Reuse existing signed-link infrastructure for one-off shares (keep bridge).
- SMS delivery status polling already shipped; extend to portal notifications.

**Out:**
- Partial payments / instalments UI (existing allocation logic stays as-is).
- Email delivery (SMS + print only).
- Multi-currency (KES only).
- Offline receipt printing (requires device sync; deferred).
- ESC/POS thermal generation (deferred until printer test fails).

## Not Doing (and Why)
- **Replacing signed links with the portal** — links remain the bridge for one-off shares and for guardians without accounts.
- **New auth system** — reuse existing Supabase auth and `parent_student_links`.
- **Second student registry** — explicitly forbidden by product constraints.
- **Converting money to integer minor units** — keep `numeric` KES; all arithmetic in SQL; display 2 decimals.
- **Server-rendered thermal PDFs** — browser print with `?format=thermal` is sufficient; revisit if printer tests fail.

## Open Questions
- What is the parent portal's auth model: full Supabase login per guardian, or long-lived signed links per family?
- Should the portal show historical (prior-year) statements or only current term?
- Who approves a guardian's link to a student (admin only, or self-service with verification)?
- Retention: how long do signed receipt/statement links and access logs persist?
