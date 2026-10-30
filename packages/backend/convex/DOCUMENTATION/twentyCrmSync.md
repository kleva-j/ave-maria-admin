# Twenty CRM outbound sync

The Convex backend mirrors an allow-listed subset of customer and operational
records to the configured Twenty workspace. Mutations write a durable outbox
row in the same transaction as the source change; internal actions deliver the
latest source record to Twenty and persist the returned record ID. Delivery is
near real time, with exponential retries, a one-minute lease recovery job, and
admin-only queue inspection and replay.

## Configure credentials

Set secrets on each Convex deployment. Use the staging Twenty instance and its
current HTTPS tunnel URL for the staging deployment:

```sh
pnpm --filter @avm-daily/backend exec convex env set TWENTY_BASE_URL https://<current-random-tunnel-host>
pnpm --filter @avm-daily/backend exec convex env set TWENTY_API_KEY <workspace-api-key>
```

Create the API key in the Twenty workspace. Do not put either value in source
control, `.env.example`, app config, or client-side code. If the ngrok or
Cloudflare Quick Tunnel URL changes, update `TWENTY_BASE_URL` and redeploy the
Convex environment. Keep staging and production credentials in their matching
Convex deployments; production sync must wait for staging validation.

## Fields sent

- People: WorkOS ID, name, email, phone, account status, ledger/available
  balances in kobo, referral code, and anonymized flag.
- Withdrawals: source ID, customer ID, reference, amount in kobo, status, and
  requested/updated timestamps.
- KYC: document type, status, upload/review timestamps, and a generic rejection
  category when it can be safely identified. File URLs, storage IDs, file names,
  and document contents are omitted.
- Risk holds: status, a generic reason category, and placement and release
  timestamps.
- Savings plans: plan type, status, balance/target in kobo, and start/maturity
  dates.
- Bank accounts: bank and account names, last four digits, verification status.
  The full account number is never sent.
- Transactions: reference, type, amount in kobo, date, plan ID, and reversal
  reference. Arbitrary transaction metadata is omitted.

BVN/NIN values, bank account numbers, document URLs/files, withdrawal bank
details, raw processing errors, and arbitrary transaction metadata are not sent.
Records whose owning user is soft-deleted are skipped. When WorkOS emits a hard
`user.deleted` event, the backend queues an anonymization pass: the Person is
renamed to “Deleted Customer,” contact details and AVM identity are cleared,
balances and referral code are reset, and synced operational records retain
their financial/status history while their customer ID and Person relation are
cleared. Bank account summaries also have bank/account names and last-four
digits redacted. This runs through the existing retryable outbox, with large
histories processed in pages. Anonymization can recover a missing/stale CRM
record link using the external ID saved on its pending outbox job; the lookup
key is cleared when delivery succeeds. CRM tasks and notes are not currently
synced.

This flow does not purge retained operational records or set a timed retention
period. Agree a retention/erasure policy before production rollout; do not treat
the CRM anonymization as a source-database erasure.

## Initial staging backfill

Apply the Twenty schema app to staging before starting the backfill. Then call
`twentySync.startBackfill` from an authenticated Convex session as an admin.
The job is paginated and queues all eligible people and current bank accounts,
transactions from the previous 12 months, and recent or still-active/open
withdrawals, KYC documents, risk holds, and savings plans. It can take time for
the queue to drain; it does not copy application data synchronously in one
mutation.

## Monitor and recover

`twentySync.queueHealth` returns the bounded failed count (up to 1,000) and the
creation time of the oldest pending item. Both `queueHealth` and
`twentySync.replayFailed` require an authenticated admin. Replay failed items
with `twentySync.replayFailed({ limit: 100 })`; the limit is capped at 500.
Transient network, rate-limit, and server failures retry automatically, up to
12 attempts. Invalid credentials and other non-retryable HTTP errors appear in
the failed queue and raise a critical shared admin alert. Correct the
configuration, replay failed records, and resolve the alert after the queue
recovers.

Validate with staging records and the Twenty API playground before configuring
production. This phase does not create Twenty tasks or import production
historical data.
