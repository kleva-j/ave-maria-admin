import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminOverviewCards } from "@/components/admin-overview-cards";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe("AdminOverviewCards", () => {
  it("renders queue summaries and quick links", () => {
    render(
      <AdminOverviewCards
        summary={{
          withdrawals: {
            pending: 4,
            approved: 2,
            rejected: 1,
            processed: 8,
          },
          kyc: {
            pending_users: 3,
          },
          bankVerification: {
            pending_accounts: 5,
            oldest_submission_at: Date.now(),
          },
          reconciliation: {
            latest_run: {
              _id: "run_1",
              status: "completed",
              issue_count: 2,
              started_at: Date.now(),
              completed_at: Date.now(),
            },
            open_issue_count: 2,
          },
        }}
      />,
    );

    expect(screen.getByText("Withdrawal Queue")).toBeTruthy();
    expect(screen.getByText("Pending KYC")).toBeTruthy();
    expect(screen.getByText("Bank Verification")).toBeTruthy();
    expect(screen.getByText("Reconciliation")).toBeTruthy();
    expect(screen.getByText("Open withdrawals").getAttribute("href")).toBe(
      "/admin/withdrawals",
    );
  });
});
