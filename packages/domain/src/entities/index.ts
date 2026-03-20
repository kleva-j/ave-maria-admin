export interface User {
  _id: string;
  email: string;
  phone: string;
  total_balance_kobo: bigint;
  savings_balance_kobo: bigint;
  updated_at: number;
}

export interface AdminUser {
  _id: string;
  email: string;
  role: string;
  created_at: number;
}

export interface UserSavingsPlan {
  _id: string;
  user_id: string;
  current_amount_kobo: bigint;
  updated_at: number;
}

export interface Transaction {
  _id: string;
  user_id: string;
  user_plan_id?: string;
  type: string;
  amount_kobo: bigint;
  reference: string;
  reversal_of_transaction_id?: string;
  reversal_of_reference?: string;
  reversal_of_type?: string;
  metadata: Record<string, unknown>;
  created_at: number;
}

export interface Withdrawal {
  _id: string;
  requested_by: string;
  requested_amount_kobo: bigint;
  method: string;
  status: string;
  requested_at: number;
  processed_at?: number;
  approved_by?: string;
  rejected_by?: string;
  rejection_reason?: string;
}

export interface UserRiskHold {
  _id: string;
  user_id: string;
  scope: string;
  status: string;
  reason: string;
  placed_by_admin_id: string;
  placed_at: number;
  released_by_admin_id?: string;
  released_at?: number;
}

export interface RiskEvent {
  _id: string;
  user_id: string;
  scope: string;
  event_type: string;
  severity: string;
  message: string;
  details?: Record<string, unknown>;
  actor_admin_id?: string;
  created_at: number;
}

export interface TransactionReconciliationIssue {
  _id: string;
  run_id: string;
  issue_type: string;
  issue_status: string;
  user_id?: string;
  user_plan_id?: string;
  transaction_id?: string;
  reference?: string;
  expected_amount_kobo?: bigint;
  actual_amount_kobo?: bigint;
  details?: Record<string, unknown>;
  created_at: number;
  resolved_at?: number;
}
