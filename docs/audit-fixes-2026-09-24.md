# CRM audit fixes — 2026-09-24

Baseline: 0c76286163953f4b68423dc5d579a2ae3b93b90f.

The interrupted local changes were not available. This change reconstructs the fixes against the deployed baseline and the September 23 audit. It does not rewrite historical balances or guess missing historical group assignments.

## Changes

- A01–A05: strict write schemas, tenant and teacher ownership checks across common and teacher APIs, protected student balances and Telegram bindings, valid grade/attendance/expense values, database guards on membership and class records.
- A06–A07: transactional idempotent cash submission and locked pending-only decisions; transactional student transfer; atomic student creation with membership; archive students, groups and users to retain financial records. Membership inserts enforce tenant, duplication and capacity rules.
- A08: cancellation and rejected collection notifications include the affected student and teacher as well as administrators.
- A09/A25: zero balances are not debts; reports use stored historical teacher earnings; manually entered informational amounts no longer change official salary. Salary roster includes students without payments. Explicit, audited monthly tuition charges debit balances and can be reversed once. No automatic historical tariff calculation.
- A10–A12/A14/A17/A18: validated positive expenses and owned staff; no shared import/default teacher password; bounded login rate limits, session rotation, password revision checks, active subscription checks and center selection; all SMS routes reserve tenant credits atomically, refund known rejection, and stop automatic retry after uncertain delivery. Legacy teacher login uses session auth.
- A13/A24: unused Replit object upload integration removed and endpoints disabled; server/import/PDF/build dependencies updated. SheetJS uses its official patched distribution. Dependency audit returns zero known advisories for the resolved lockfile.
- A15–A16/A22: teacher attendance date and ownership filters, locked daily class upserts, durable debounced attendance notifications built from actual latest records, correct late label, corrected Tashkent scheduler and durable daily/reminder outbox keys. Reminder catch-up runs until class start; daily notifications catch up within their scheduled hour.
- A19–A21/A28: PATCH preserves omitted subject; query/mutation errors are surfaced; true active group count; real offline fallback and accurate internet requirement; targeted revision polling refreshes financial caches; group counts and payment status reads batched; seven-day schedule preserves actual start minutes and early classes; group writes validate capacity and teacher/room overlaps.
- A26: notification errors identify recipient category; verified contact linking requeues only that recipient's failed Telegram jobs. Center SMS credit remains separate from Eskiz provider balance.
- A27: admin reconciliation UI requires an explicit historical group, period and reason, writes an audit record, and preserves money and teacher earnings.
- A29: center and notification settings persist through authenticated tenant API, and the local theme is restored on reload.

## Validation

`npm run build` includes TypeScript, the full regression suite, and client/server production compilation. There are 40 passing tests, including actual PostgreSQL semantics via PGlite for migration repeatability, cash race decisions, rollback, membership guards, daily upserts, tuition creation/reversal, historical reconciliation, cancellation recipients and session revision triggers. HTTP tests cover actual route registration and role/tenant checks. SMS tests use a fake provider and never send a real message.

`npm audit --json`: zero known vulnerabilities. No real financial transaction, SMS or Telegram test message was sent to production users.

## Operational follow-up and limits

- A23: GitHub Actions previously failed before runner steps. This is not established as a code error; check the new workflow run and Railway deployment separately.
- A26: contacts must verify their own phone in the bot. Eskiz funding/provider approval cannot be repaired by a code change. Historical failed jobs should be reviewed by their owner; no blanket retry was performed.
- A27: old missing group/period values remain unchanged until an administrator supplies supporting evidence. Tuition fees, discounts and freezes require actual business amounts entered by administrators.
- Existing legacy duplicate/invalid rows are retained; database write guards protect new mutations. No destructive data cleanup or retroactive balance recalculation was performed.
- Full pagination of all legacy list APIs, production-scale load testing, device-by-device checks, historical accounting reconciliation, and a backup restore drill remain outside this code verification.
- Outbox delivery remains at-least-once: a process failure after a provider accepts a message can duplicate delivery, but cannot duplicate the monetary transaction.
