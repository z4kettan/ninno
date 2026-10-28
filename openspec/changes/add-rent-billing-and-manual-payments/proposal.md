# Proposal

## Why

Collecting rent and tracking who has paid is the hostel owner's main recurring pain. For v1 the owner decided (2026-10-28) that residents pay the hostel directly, by UPI to the hostel's own ID, cash or bank transfer, and **staff mark each invoice as paid in Ninno**. That keeps the books accurate without a payment gateway, merchant KYC or webhook infrastructure. This is build-guide **Phase 3** (§7, §10), with §6 (Razorpay/UPI Intent) deferred.

## What Changes

- Billing engine: CHECKIN_ANNIVERSARY or FIXED_DAY periods (with first-month pro-rating), the month-end clamp, and grace days, all computed in IST. RentPlan versioning by `effective_from`. Move-out cancels future invoices.
- BullMQ jobs: daily invoice generation at 00:15 IST (idempotent on `(resident_id, period_start)`), a daily status job (UPCOMING → DUE → OVERDUE), and optional late fees.
- **Staff "Mark as paid"**: from a resident's rent tab or the due/overdue list, staff record the amount (defaulting to the invoice balance), the method (UPI direct / cash / bank transfer / other), the paid-on date, an optional reference (such as the UPI transaction id), and a note. The invoice settles in one transaction and the action is audit-logged.
- **Undo / void**: a staff member with OWNER or MANAGER role can void a wrongly recorded payment, with a reason. The invoice reopens and the void is audit-logged. Payments are never hard-deleted.
- Partial payments only when the hostel enables them. Otherwise the recorded amount must equal the open balance.
- Resident screens: a home rent card ("₹6,500 due in 4 days"), with a "How to pay" panel showing the hostel's UPI ID / QR and contact for reference only, plus payment history and a PDF receipt for recorded payments.
- Staff screens: dashboard KPIs, due and overdue lists, a payments list, and CSV export.
- SMS rent reminders: 3 days before, on the due date, and when overdue.
- The first invoice is generated on approval (completes Phase 2).

## Capabilities

### New Capabilities

- `rent-billing`: periods, due dates, invoice generation and status, rent changes, and move-out.
- `manual-payments`: staff-recorded payments, partial-payment rules, voids, receipts, and their audit trail.
- `rent-reminders`: scheduled resident reminders.
- `staff-dashboard`: KPIs, needs-attention lists and exports.

### Modified Capabilities

- `resident-approval`: approval generates the first invoice.

## Out of scope

- **Online payment gateway (Razorpay UPI Intent, webhooks, reconciliation, `PaymentProvider`)**, deferred by the owner. The data model keeps a `method`/`reference` shape, so a gateway can be added later as another payment source without migrating history.
- Residents marking their own payment as done ("I've paid" claims). Possible later as a staff-confirmed request.
- Refunds, WhatsApp reminders, and Web Push.

## Impact

- New `billing`, `payments` (manual) and `notifications` modules, and Redis-backed queues.
- apitxt SMS (their transactional SMS API, with DLT-approved reminder templates) for reminders, reusing the apitxt account from auth. No Razorpay account is needed for v1.
- Heavy unit-test suite for the date logic, and e2e coverage of approve → invoice → mark paid → next due date.
