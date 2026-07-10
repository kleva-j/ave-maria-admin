import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { Suspense, useState } from "react";

import { api } from "@avm-daily/backend/convex/_generated/api";
import { Skeleton } from "@avm-daily/ui/components/skeleton";
import { Icon } from "@avm-daily/ui/components/icon";

import { BankAccountAddForm } from "@/components/bank-account-add-form";
import { BankAccountCard } from "@/components/bank-account-card";

/**
 * /user/banks — matches the design's `BanksScreen`: cards + inline add
 * form + security note. Add form collapses into the dashed CTA when
 * dismissed.
 */
export const Route = createFileRoute("/_protected/user/banks/")({
  component: BanksPage,
});

function BanksPage() {
  return (
    <div className="screen-anim pb-8">
      <header className="flex items-center gap-3 px-5 pb-2 pt-5">
        <Link
          to="/user"
          className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-border bg-secondary text-muted-foreground hover:text-foreground"
          aria-label="Back to dashboard"
        >
          <Icon name="chevron-left" size={18} />
        </Link>
        <div>
          <h2 className="font-display text-[22px] font-bold text-foreground">
            Bank Accounts
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage accounts linked for deposits and withdrawals
          </p>
        </div>
      </header>

      <Suspense fallback={<ListSkeleton />}>
        <BanksList />
      </Suspense>

      <SecurityNote />
    </div>
  );
}

function BanksList() {
  const banksQ = useSuspenseQuery(
    convexQuery(api.bankAccounts.listMineMasked, {}),
  );
  const banks = banksQ.data;
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="mx-5 mt-4 flex flex-col gap-3">
      {banks.map((bank) => (
        <BankAccountCard key={bank._id} bank={bank} />
      ))}

      {addOpen ? (
        <BankAccountAddForm
          onDone={() => setAddOpen(false)}
          onCancel={() => setAddOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex w-full items-center justify-center gap-2.5 rounded-[18px] border-[2px] border-dashed border-border p-4 transition-colors hover:border-[color-mix(in_oklab,var(--primary)_50%,transparent)]"
        >
          <Icon name="plus" size={20} color="var(--primary)" />
          <span className="text-sm font-semibold text-primary">
            Link a new bank account
          </span>
        </button>
      )}

      {banks.length === 0 && !addOpen && (
        <div className="rounded-[18px] border border-border bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-dim">
            <Icon name="building" size={22} color="var(--primary)" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            No banks linked yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Link a bank to fund savings and receive withdrawals.
          </p>
        </div>
      )}
    </div>
  );
}

function SecurityNote() {
  return (
    <div className="mx-5 mt-6 flex items-start gap-2.5 rounded-[14px] bg-secondary p-3.5">
      <Icon
        name="shield"
        size={16}
        color="var(--success)"
        style={{ flexShrink: 0, marginTop: 2 }}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        AVM Daily never asks for your online-banking password. Every account
        you link is reviewed by our compliance team before it can be used for
        withdrawals.
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mx-5 mt-4 flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-32 w-full rounded-[18px]" />
      ))}
    </div>
  );
}
