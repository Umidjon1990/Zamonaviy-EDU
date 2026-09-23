---
name: Transactional payment accounting
description: Balance, earning snapshots, approvals, idempotency and notification rules
---
All payment writes must use `server/payment-service.ts`; do not call storage CRUD directly.
Payment, student balance delta, audit log, request key and notification outbox commit together.
The completed status contributes amount to balance; other statuses contribute zero. Edits apply new contribution minus old contribution. Deletion reverses once and retains a soft-deleted audit record.

Teacher salary is SUM(teacher_earning) for completed, non-deleted payments in the reporting month. No fallback based on a current percentage. New payments snapshot teacher_percent and teacher_earning; edits preserve the original percentage. Teacher collections become official payments only after admin confirmation, with source_collected_id unique within the tenant.

POST create and collect require an Idempotency-Key. Transaction-scoped per-tenant advisory locks protect concurrent requests; database failures roll back all accounting writes. Admins alone can mutate official payments. Collection permission does not grant official payment mutation rights.

Use explicit group_id and payment_period. Legacy group-less payments are only attributed in filters if current membership is unambiguous; never guess historical amounts, teachers or group assignments. Existing balances are not recalculated by the startup migration.

Telegram/SMS use a durable outbox after commit. Notifications may be delivered at least once after a worker crash; retry must never create another payment. Verify own Telegram contacts before linking. Production DB is on Railway.
