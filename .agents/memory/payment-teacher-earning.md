---
name: Payment teacherEarning snapshot
description: How teacher salaries are computed from per-payment stored earnings and the pitfall when editing payments
---
Teacher monthly salary = SUM(payments.teacher_earning) for completed payments in the month (fallback to totalPayments * salaryPercent only when the sum is 0). `teacher_earning` is a snapshot computed at payment creation.

**Why:** Editing a payment's amount (or completing a pending one) without recalculating `teacher_earning` silently corrupts salary reports — this caused a real prod discrepancy (55% teacher showing less). Fixed in PUT /api/payments/:id to recalc on amount change or transition to completed.

**How to apply:** Any new code path that creates/updates/completes payments must set `teacher_earning = round(amount * teacher.salaryPercent / 100)` (0 if no teacher). Note: prod DB is on Railway, not Replit Neon — query it via the URL the user provides. Also pre-existing gap: payment status transitions (pending↔completed↔cancelled) don't fully adjust student balance except completed+amount-change.
