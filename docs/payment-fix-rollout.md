# Payment accounting repair — September 2026

`npm run build` runs TypeScript, payment/security regression tests, then production bundling. Railway only reports healthy after the additive startup migration and database connectivity check pass at `/api/health`.

## Behavior

- The admin payment list and pending teacher collection count refresh every five seconds while visible. Successful mutations invalidate all related financial caches; returning to a tab refreshes queries. API responses are not cached.
- Financial writes, balance effects, earning snapshots, idempotency records, audit records and notification jobs share a database transaction. A teacher collection remains pending until an admin confirms it. Repeated confirmation returns the existing payment.
- Payment period is explicit. Group filters use explicit group IDs; ambiguous legacy rows are not silently attributed to a group.
- Telegram recipients are the tenant admins, the student, and the payment's teacher. Notification failures appear under Payments and can be retried. SMS provider funds are external to the CRM: insufficient Eskiz balance still requires a top-up.
- Telegram phone binding now requires the sender's own contact in a private chat. Old unverified links are cleared on migration: users must send `/start` and share their own contact. Super-admin users must log in again because legacy tokens are no longer accepted.
- Plaintext password storage is cleared; all API serialization strips password fields, and response bodies are no longer logged. Previously exposed passwords should be changed. Prior provider logs cannot be retroactively sanitized by application code.

## Historical accounting

The migration does not rewrite existing balances, teachers, earning snapshots or payment amounts. Old confirmed collections without a linked payment, zero earnings from the previous confirmation bug, and ambiguous group-less payments require comparison with source receipts before correcting them. Never automatically re-confirm old collections: that would double-credit a student.

Read-only checks for a tenant (`$1`):

```sql
SELECT id, student_id, teacher_id, amount, teacher_earning, created_at
FROM payments
WHERE tenant_id=$1 AND deleted_at IS NULL AND status='completed'
  AND (teacher_id IS NULL OR teacher_earning IS NULL OR amount<=0);

SELECT id, student_id, teacher_id, amount, confirmed_at
FROM teacher_collected_payments
WHERE tenant_id=$1 AND status='confirmed' AND payment_id IS NULL;

SELECT id, student_id, teacher_id, amount, created_at
FROM payments WHERE tenant_id=$1 AND deleted_at IS NULL AND group_id IS NULL;
```

## Verification and recovery

Tests use PGlite's PostgreSQL engine and actual transaction rollback/constraints. Its single connection serializes transaction leases, so the concurrent-request tests verify results but do not replace a multi-connection production load test. HTTP tests verify the super-admin bearer guard. Tests never send actual Telegram/SMS messages or mutate production payments.

The migration is additive and repeatable. If deployment fails its health check, inspect build/runtime logs and retain the last healthy deployment. Do not drop the new tables or columns to roll back application code; they contain accounting audit and idempotency information.
