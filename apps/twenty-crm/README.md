# AVM Daily CRM Schema

Twenty app that defines the staging CRM data model for AVM Daily support,
operations, and compliance. Phase 1 includes metadata only; it does not connect
to the AVM Daily backend or synchronize customer data.

## Included schema

- Extend Twenty Persons with AVM user ID, account status, balances in kobo,
  referral code, and anonymization status.
- Link custom Person records to withdrawals, KYC document metadata, risk holds,
  savings plans, transactions, and masked bank-account summaries.
- Operational records carry the AVM user ID as a matching key. Full identity
  numbers, document files, full bank account numbers, and arbitrary transaction
  metadata are intentionally absent.

See [SETUP.md](SETUP.md) for staging setup, local development, and apply steps.
