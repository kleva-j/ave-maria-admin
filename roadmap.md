# Product Requirements Document: AVM Daily — Savings & Withdrawal Platform

**Version:** 1.0  
**Date:** April 6, 2026
**Status:** Draft

---

## Executive Summary

**AVM Daily** is a fintech savings and withdrawal management platform targeting retail users who want structured, goal-driven savings with compliance-grade controls. The backend infrastructure, admin tooling, and compliance layer are substantially complete. The critical gap is the **user-facing product** — both on web and mobile — which is largely unbuilt. This PRD captures the full product vision, maps existing capabilities, and defines a phased roadmap to ship a complete, customer-ready product.

---

## 1. Problem Statement

Retail savers in emerging markets lack access to structured, trustworthy digital savings tools with transparent controls, flexible withdrawal options, and reliable compliance. Existing solutions are either too opaque (no audit trail for users), too rigid (fixed plan structures), or untrustworthy (poor KYC, no fund safety signals).

AVM Daily has built the compliance and operational infrastructure to run a safe, auditable savings platform — but users currently have no meaningful interface to manage their savings, track progress, initiate withdrawals, or receive feedback on their KYC and banking status. Without a compelling user-facing product, the platform cannot acquire or retain customers.

---

## 2. Current State Inventory

### Fully Built (Production-Ready)

| Area                                                       | Status      |
| ---------------------------------------------------------- | ----------- |
| WorkOS authentication (email, MFA, OAuth)                  | ✅ Complete |
| KYC document upload & admin review workflow                | ✅ Complete |
| Savings plan schema, templates, CRUD                       | ✅ Complete |
| Transaction engine with reversals                          | ✅ Complete |
| Withdrawal request, approval, rejection workflow           | ✅ Complete |
| Bank account management & verification                     | ✅ Complete |
| Risk scoring, holds, and withdrawal blocking               | ✅ Complete |
| Admin dashboard (withdrawals, KYC, reconciliation, alerts) | ✅ Complete |
| Transaction reconciliation with automated issue detection  | ✅ Complete |
| Audit logging across all entities                          | ✅ Complete |
| Real-time aggregated KPIs for admin                        | ✅ Complete |
| Notification event framework (schema + types)              | ✅ Complete |
| Clean architecture (domain → application → infrastructure) | ✅ Complete |
| Test coverage (unit, integration, property-based)          | ✅ Complete |

### Framework Built — Delivery Not Implemented

| Area                                             | Gap                                                            |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Notification delivery (email, push, SMS, in-app) | Types defined; no dispatcher or provider integration           |
| Withdrawal payout processing                     | `payout_provider` field exists; no provider SDK integration    |
| External KYC verification                        | `kyc.verifyIdentity` action scaffolded; external API not wired |
| Rate limiting                                    | Upstash Redis optional; not enforced on any route              |
| Auto-debit for savings plans                     | `automation` field on plans; no scheduler or payment rail      |

### Not Built

| Area                                                           | Notes                                                    |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| User-facing web dashboard (savings, transactions, withdrawals) | Only KYC document upload exists                          |
| Mobile app features                                            | Only drawer nav + todos stub                             |
| Interest accrual automation engine                             | `interest_accrual` txn type exists; no calculation logic |
| Referral system                                                | `referral_bonus` txn type exists; no referral flow       |
| Investment yield engine                                        | `investment_yield` txn type exists; no investment logic  |
| User onboarding flow                                           | No guided post-signup experience                         |
| User-facing notifications inbox                                | No UI for notification events                            |
| Admin user management UI                                       | Schema and roles built; no CRUD interface                |
| Reporting and data export                                      | No CSV/PDF exports for users or admins                   |
| Customer support integration                                   | No help desk, chat, or ticket system                     |

---

## 3. Goals

### User Goals

1. A new user can complete signup, KYC, bank verification, and fund their first savings plan within **15 minutes**.
2. Users can view their full savings and transaction history with real-time balance updates.
3. Users can request withdrawals and receive status updates at every step via push/email notifications.
4. Users can track savings plan progress against targets with clear milestone feedback.

### Business Goals

5. Admin team can process all pending KYC, withdrawal, and bank verification requests without leaving the admin console.
6. Withdrawal payout failure rate stays below **2%** through payout provider integration with automated retries.
7. Reconciliation issues are detected and resolved within **24 hours** of occurrence.
8. Platform is audit-ready with exportable compliance reports for any user, date range, or event type.

---

## 4. Non-Goals (v1 Scope)

| Non-Goal                          | Rationale                                                          |
| --------------------------------- | ------------------------------------------------------------------ |
| Investment yield products         | Requires financial product licensing; scope is savings only for v1 |
| Multi-currency support            | Platform is kobo/naira-denominated; FX adds regulatory complexity  |
| Peer-to-peer transfers            | Different risk and compliance profile; separate initiative         |
| White-label / multi-tenant SaaS   | Single-brand deployment for v1; architecture supports it later     |
| Native iOS/Android store releases | Web-first launch; native app is Phase 2                            |
| Machine learning risk scoring     | Rule-based risk engine is sufficient for v1 volume                 |

---

## 5. User Personas

### Persona A — Retail Saver (Primary)

A working adult who wants to save toward a goal (e.g., emergency fund, school fees, travel). Moderately tech-literate, mobile-first, values trust signals (KYC badge, bank verification status), and needs simple progress visualization.

### Persona B — Admin Operator

An internal operations or compliance staff member who reviews KYC documents, approves withdrawals, manages risk holds, and monitors platform health. Uses desktop browser exclusively. Already partially served by the existing admin console.

### Persona C — Finance/Compliance Admin

A senior admin (finance or compliance role) who needs exportable reports, audit trails, reconciliation summaries, and alert management for regulatory purposes.

---

## 6. User Stories

### Onboarding & KYC

- As a **new user**, I want a guided post-signup checklist so that I know exactly what steps remain before I can save and withdraw.
- As a **new user**, I want to upload my KYC documents from my phone camera so that I don't need to scan documents separately.
- As a **new user**, I want to receive a notification when my KYC is approved or rejected so that I can act immediately without checking the app repeatedly.
- As a **user with a rejected KYC document**, I want to see the rejection reason and re-upload so that I can resolve it without contacting support.

### Savings Plans

- As a **saver**, I want to browse available savings plan templates and see their terms (duration, interest rate, minimum deposit) so that I can choose the right plan.
- As a **saver**, I want to create a savings plan with a custom target amount and end date so that I can save toward a specific goal.
- As a **saver**, I want to see my plan's current balance, target, and projected completion date so that I know if I'm on track.
- As a **saver**, I want to top up my savings plan at any time so that I can accelerate progress toward my goal.
- As a **saver with multiple plans**, I want a unified dashboard showing all my plans and their statuses so that I can manage them in one place.
- As a **saver**, I want to set up auto-debit on a schedule (weekly/monthly) so that I save consistently without manual effort.

### Transactions

- As a **saver**, I want to view my full transaction history with filters (date, type, plan) so that I can reconcile my records.
- As a **saver**, I want to see a breakdown of my total balance vs. savings balance so that I understand what's accessible.
- As a **saver**, I want to download a statement of my transactions as PDF or CSV so that I can share it with a bank or employer.

### Withdrawals

- As a **saver**, I want to request a withdrawal to my verified bank account so that I can access my funds.
- As a **saver who submitted a withdrawal**, I want real-time status updates (pending → approved → processed) via push notification so that I'm not anxious about my funds.
- As a **saver**, I want to understand why a withdrawal was rejected (with specific reason) so that I can take corrective action.
- As a **saver on a risk hold**, I want to see a clear explanation of my hold status and an estimated resolution timeline so that I'm not left confused.

### Bank Accounts

- As a **saver**, I want to add and verify my bank account before requesting a withdrawal so that payouts are directed correctly.
- As a **saver**, I want to be notified when my bank account verification is approved or rejected so that I can act promptly.
- As a **saver**, I want to set a primary bank account for withdrawals so that I don't have to select it each time.

### Notifications

- As a **saver**, I want an in-app notification inbox so that I can review all platform activity in one place.
- As a **saver**, I want to configure which notifications I receive via email vs. push so that I'm not overwhelmed.

### Admin — Existing Gaps

- As an **admin**, I want to create, update, and deactivate admin user accounts with role assignments so that I can manage team access without a developer.
- As a **compliance admin**, I want to export audit logs for a specific user or date range as CSV so that I can respond to regulatory requests.
- As a **finance admin**, I want to trigger a manual reconciliation run and see a detailed diff report so that I can resolve issues on demand.
- As an **operations admin**, I want to configure withdrawal approval thresholds (e.g., auto-approve below ₦X) so that low-risk withdrawals don't queue.

---

## 7. Feature Requirements

### Phase 1 — User-Facing Web Product (P0)

#### 7.1 User Dashboard

**Must-Have (P0)**

| Requirement                                                                                         | Acceptance Criteria                                                                                                 |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Balance overview widget showing total balance, savings balance, and available-for-withdrawal amount | Given a logged-in user, when they open the dashboard, they see three distinct balance figures updating in real time |
| Savings plans list with name, status, current amount, target, and % progress                        | Plans sorted by status (active first); percentage shown as progress bar                                             |
| Quick-action buttons: "New Plan", "Top Up", "Withdraw"                                              | Buttons are disabled with tooltip if KYC is not approved or bank account is not verified                            |
| Onboarding checklist (KYC status, bank account status, first deposit)                               | Checklist dismisses automatically when all steps are complete                                                       |
| Empty state for users with no plans (with CTA to create one)                                        | Zero-state graphic and "Start Saving" CTA shown when plans array is empty                                           |

**Nice-to-Have (P1)**

- Net worth trend chart (30-day sparkline of total balance)
- Upcoming auto-debit reminder banner
- "Savings streak" gamification badge

#### 7.2 Savings Plan Management

**Must-Have (P0)**

| Requirement                                                                         | Acceptance Criteria                                                                          |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Plan creation flow: select template → set target → set name → confirm               | Multi-step form with validation; on success, user is redirected to new plan detail page      |
| Plan detail page: balance, target, transactions within the plan, projected end date | Transactions scoped to plan; projected date calculated from current pace                     |
| Top-up to existing plan (add contribution transaction)                              | Amount validated against plan minimums; balance updates in real time via Convex subscription |
| Plan pause/resume (if policy allows)                                                | Paused plans show banner; auto-debit is suspended                                            |
| Plan list page with filtering (active, paused, completed, expired)                  | Filter chips; count badge per status                                                         |

**Nice-to-Have (P1)**

- Savings goal visualization (milestone markers on progress bar)
- Plan comparison view (side-by-side templates)
- Plan name editing

#### 7.3 Transaction History

**Must-Have (P0)**

| Requirement                                                                  | Acceptance Criteria                                                                                         |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Paginated transaction history across all plans                               | 20 per page; infinite scroll or pagination controls                                                         |
| Filter by: date range, transaction type, plan                                | Filters are combinable; URL-persisted for shareability                                                      |
| Transaction detail drawer/modal: amount, type, reference ID, plan, timestamp | Opens on row click; shows reversal linkage if applicable                                                    |
| CSV statement download                                                       | Triggers file download with all transactions in date range; includes plan name, type, amount, balance-after |

**Nice-to-Have (P1)**

- PDF statement with AVM Daily branding
- Monthly summary view (grouped by month)

#### 7.4 Withdrawal Flow

**Must-Have (P0)**

| Requirement                                                                          | Acceptance Criteria                                                                                       |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Withdrawal request form: select plan, enter amount, select bank account              | Pre-validates withdrawal eligibility (KYC, bank verification, risk holds, daily limits) before submission |
| Pre-submission eligibility check with clear blocking reason if not eligible          | If blocked by risk hold, show hold reason; if KYC not approved, show KYC CTA                              |
| Withdrawal status tracker on dashboard (pending → approved → processing → processed) | Status shown as step indicator; timestamps for each stage                                                 |
| Withdrawal history list with status badges and rejection reasons                     | Rejected items show admin-provided reason                                                                 |

**Nice-to-Have (P1)**

- ETA estimate for withdrawal processing
- Cancel pending withdrawal (before approval)

#### 7.5 Bank Account Management (User-Facing)

**Must-Have (P0)**

| Requirement                                                     | Acceptance Criteria                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| Add bank account form (account number, bank name, account name) | Validates required fields; shows verification pending state on submit |
| Bank account list with verification status badges               | Verified ✅, Pending ⏳, Rejected ❌                                  |
| Set primary account                                             | Only one primary at a time; reflected in withdrawal form default      |
| View rejection reason for a rejected bank account               | Rejection reason shown on account card                                |
| Upload verification documents for bank account                  | File upload; accepted types: PDF, JPG, PNG; max 5MB                   |

#### 7.6 Notification Center

**Must-Have (P0)**

| Requirement                                                                     | Acceptance Criteria                                  |
| ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| In-app notification inbox (bell icon in nav)                                    | Unread count badge; clicking opens notification list |
| Notification types: KYC decision, withdrawal status, bank verification decision | Each type has distinct icon and summary text         |
| Mark as read (individual and bulk)                                              | Unread count decrements immediately                  |
| Link from notification to relevant entity (e.g., withdrawal detail)             | Clicking notification navigates to the related page  |

**Notification Delivery (P0 — infrastructure)**

| Requirement                                                                                | Acceptance Criteria                                                                            |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Email delivery for: KYC decision, withdrawal processed, bank account verification decision | Emails sent via provider (e.g., Resend/SendGrid) within 60 seconds of event                    |
| Push notification delivery (web push)                                                      | User prompted for permission on first login; notification delivered within 60 seconds of event |
| Notification preference settings (email on/off per type)                                   | Preference saved to user profile; respected by dispatcher                                      |

---

### Phase 2 — Payout & Automation (P0 for business viability)

#### 7.7 Withdrawal Payout Provider Integration

**Must-Have (P0)**

| Requirement                                                                                   | Acceptance Criteria                                                                      |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Integration with at least one Nigerian payout provider (e.g., Paystack, Flutterwave, or Mono) | `payout_provider` field populated; payout initiated automatically on withdrawal approval |
| Webhook handler for payout status updates (success, failed, reversed)                         | Transaction updated in real time; user notified of outcome                               |
| Automatic retry for failed payouts (up to 3 attempts, 30-min backoff)                         | Retry count tracked in `last_processing_error`; admin alerted after max retries          |
| Failed payout escalation to admin queue                                                       | Withdrawal re-enters admin queue with `payout_failed` status and error detail            |

#### 7.8 Auto-Debit / Recurring Contribution

**Must-Have (P0)**

| Requirement                                                                            | Acceptance Criteria                                                            |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| User can configure auto-debit schedule (weekly/monthly, day, amount) on a savings plan | Schedule stored on plan; next debit date displayed on plan card                |
| Cron job triggers scheduled contributions and posts transactions                       | Transaction posted with `source: system`; user notified via push/email         |
| Auto-debit failure handling (insufficient funds, bank decline)                         | Plan paused after N consecutive failures; user notified with re-activation CTA |
| User can pause, resume, or cancel auto-debit                                           | Immediate effect; confirmation prompt before cancel                            |

#### 7.9 Interest Accrual Automation

**Nice-to-Have (P1)**

| Requirement                                          | Acceptance Criteria                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| Interest calculation engine using plan template rate | Daily/monthly accrual based on template `interest_rate` field                   |
| Scheduled `interest_accrual` transaction posting     | Posted by system cron; visible in transaction history with plan attribution     |
| Interest preview on plan detail page                 | "Estimated interest earned at maturity" shown based on current balance and rate |

---

### Phase 3 — Admin Completions & Compliance (P0 for operations)

#### 7.10 Admin User Management UI

**Must-Have (P0)**

| Requirement                                         | Acceptance Criteria                                                     |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| List all admin users with name, email, role, status | Sortable table; search by name/email                                    |
| Create admin user (email invite, role assignment)   | Invite sent via WorkOS; role required field                             |
| Deactivate / reactivate admin user                  | Deactivated user loses access immediately; action logged in audit trail |
| Edit admin role                                     | Role change takes effect on next session; audit logged                  |

#### 7.11 Compliance Reporting & Export

**Must-Have (P0)**

| Requirement                                               | Acceptance Criteria                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Audit log export for a user (CSV)                         | Date range picker; exports all audit events for that user                    |
| Transaction report export (CSV) for any user or all users | Includes: user ID, transaction type, amount, plan, timestamp, reference      |
| Reconciliation report export (CSV)                        | Lists all issues in a date range with resolution status                      |
| KYC status report (CSV)                                   | All users with KYC document status, submission date, decision date, reviewer |

#### 7.12 Withdrawal Policy Configuration

**Nice-to-Have (P1)**

| Requirement                                                                 | Acceptance Criteria                                                   |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Admin-configurable daily withdrawal limit per user tier                     | Configurable in admin settings; validated at withdrawal request time  |
| Admin-configurable auto-approve threshold (withdraw below ₦X auto-approved) | Withdrawals below threshold bypass approval queue; audit logged       |
| Configurable bank account cooldown period                                   | New bank accounts cannot receive withdrawal for N days (configurable) |

---

### Phase 4 — Growth & Engagement (P1)

#### 7.13 Referral System

**Must-Have (P1)**

| Requirement                                                                    | Acceptance Criteria                                      |
| ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Unique referral link per user                                                  | Generated on first request; shareable URL                |
| Referral tracking (referrer → referred user link)                              | Stored on user record; visible in user profile           |
| `referral_bonus` transaction posted when referred user completes first deposit | Amount configurable by admin; transaction source: system |
| Referral dashboard for user                                                    | Shows count of successful referrals and bonus earned     |

#### 7.14 KYC Automation (External Provider)

**Must-Have (P1)**

| Requirement                                                                                   | Acceptance Criteria                                                         |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Wire `kyc.verifyIdentity` action to real provider (e.g., Smile Identity, Youverify, or Dojah) | API call made with document data; response updates KYC status automatically |
| Auto-approve on provider match; flag for manual review on failure                             | `verified` status set automatically; `requires_review` flagged for admin    |
| Provider response metadata stored for audit                                                   | Raw provider response stored in document record                             |

---

## 8. Success Metrics

### Leading Indicators (Measure within 30 days of launch)

| Metric                                    | Target                               | Tool                                 |
| ----------------------------------------- | ------------------------------------ | ------------------------------------ |
| Signup → KYC submission rate              | ≥ 70% within 7 days of signup        | Convex analytics                     |
| KYC → first deposit rate                  | ≥ 50% within 14 days of KYC approval | Convex analytics                     |
| Withdrawal request → processed time (P90) | < 24 hours                           | Admin dashboard KPIs                 |
| Notification delivery success rate        | ≥ 99%                                | Notification event processing status |
| Payout success rate (first attempt)       | ≥ 95%                                | Withdrawal payout_provider status    |

### Lagging Indicators (Measure at 60–90 days)

| Metric                                                                     | Target     | Tool                       |
| -------------------------------------------------------------------------- | ---------- | -------------------------- |
| 30-day retention (users who saved in first 30 days still saving at day 60) | ≥ 40%      | Convex aggregates          |
| Average active plans per user                                              | ≥ 1.5      | KPI dashboard              |
| Auto-debit adoption rate among active savers                               | ≥ 30%      | Plan automation field      |
| Admin alert resolution time (P90)                                          | < 2 hours  | Alert receipt timestamps   |
| Reconciliation issue open duration (P90)                                   | < 24 hours | Reconciliation issue table |

---

## 9. Open Questions

| Question                                                                             | Owner                    | Blocking?                                   |
| ------------------------------------------------------------------------------------ | ------------------------ | ------------------------------------------- |
| Which payout provider will be the primary integration (Paystack, Flutterwave, Mono)? | Engineering + Finance    | **Yes** — blocks Phase 2                    |
| Which KYC verification provider will be used (Smile Identity, Youverify, Dojah)?     | Compliance + Engineering | **Yes** — blocks KYC automation             |
| What is the interest rate structure for each savings plan template?                  | Finance                  | **Yes** — blocks interest accrual engine    |
| Which email provider will handle transactional emails (Resend, SendGrid, Mailgun)?   | Engineering              | **Yes** — blocks Phase 1 notifications      |
| Should the referral bonus be tiered (varies by plan type)?                           | Product/Finance          | No — can launch flat bonus                  |
| Is there a regulatory requirement for a cooling-off period before first withdrawal?  | Compliance/Legal         | No — default 48hr cooldown exists in schema |
| What are the daily/monthly withdrawal limits per user tier?                          | Finance                  | No — can use conservative defaults          |
| Should auto-approve thresholds be per-role or global?                                | Operations               | No — global default acceptable for v1       |

---

## 10. Architecture Considerations

The existing clean architecture (domain → application → infrastructure) is well-positioned to support all new features without significant refactoring. Key implementation notes:

- **Notification dispatcher**: Implement as a new Convex action triggered by `notification_events` table mutations. Provider SDKs (email, push) injected as action dependencies.
- **Payout integration**: Implement as a Convex action called from `withdrawals.process` mutation. Webhook handler added to `http.ts`.
- **Auto-debit cron**: Register new cron in `init.ts` following existing cron patterns. Use `savingsPlanRules.ts` domain service for eligibility checks.
- **Interest accrual cron**: Daily cron; reads all active plans with non-zero rate templates; posts batch `interest_accrual` transactions.
- **Admin UI (admin user management)**: Extend existing admin shell; add new routes under `_protected/admin/`.
- **Rate limiting**: Enforce Upstash Redis rate limiting on auth routes and withdrawal endpoints as first step.

---

## 11. Phased Roadmap

```
Phase 1: User-Facing Web Product         [Weeks 1–6]
├── User dashboard (balance, plans, quick actions)
├── Savings plan creation + detail pages
├── Transaction history + CSV export
├── Withdrawal request + status tracker
├── Bank account management (user-facing)
└── In-app notification center

Phase 2: Payout & Automation             [Weeks 5–10]
├── Payout provider integration (Paystack/Flutterwave)
├── Webhook handler for payout status
├── Payout retry logic
├── Auto-debit / recurring contributions
└── Email + push notification delivery

Phase 3: Admin Completions & Compliance  [Weeks 8–12]
├── Admin user management UI
├── Compliance export (audit log, transactions, KYC)
├── Manual reconciliation trigger + detailed diff
├── Rate limiting enforcement
└── Withdrawal policy configuration UI

Phase 4: Growth & Engagement             [Weeks 12–18]
├── External KYC provider wiring
├── Referral system + bonus automation
├── Interest accrual automation engine
├── Mobile app feature parity (native)
└── Advanced analytics for admin
```

> Phases 1 and 2 overlap intentionally — payout provider setup should begin in Week 5 while Phase 1 UI work is being tested, so the first real withdrawal can be end-to-end tested before Phase 1 ships.

---

## 12. Risks & Mitigations

| Risk                                                   | Likelihood | Impact | Mitigation                                                                                  |
| ------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------- |
| Payout provider integration takes longer than expected | High       | High   | Start provider evaluation in Week 1; use sandbox immediately                                |
| KYC provider API changes or rate limits                | Medium     | Medium | Abstract behind port interface (already patterns in codebase)                               |
| Notification delivery reliability issues               | Medium     | Medium | Use a dedicated transactional email provider; implement dead-letter queue for failed events |
| Auto-debit failures at scale causing user trust issues | Medium     | High   | Implement exponential backoff + user notification on first failure, not after all retries   |
| Admin workload spikes if auto-approve not in place     | High       | Medium | Launch with conservative auto-approve threshold; tune post-launch                           |

---

This PRD reflects the actual codebase state as of April 2026. The backend is production-grade — the remaining work is primarily **UI, integrations, and automation**. Phase 1 alone is sufficient to acquire and serve real users. Phases 2–4 convert it from a functional product into a competitive one.
