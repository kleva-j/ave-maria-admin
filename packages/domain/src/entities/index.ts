import type {
  TransactionReconciliationIssueStatus,
  TransactionReconciliationIssueType,
  WithdrawalStatus,
  WithdrawalMethod,
  RiskHoldStatus,
  RiskHoldScope,
  RiskEventType,
  RiskSeverity,
  PlanStatus,
  UserStatus,
  AdminRole,
  TxnType,
} from "../enums";

export interface User {
  _id: string;
  email: string;
  phone: string;
  total_balance_kobo: bigint;
  savings_balance_kobo: bigint;
  status: UserStatus;
  updated_at: number;
}

export interface AdminUser {
  _id: string;
  email: string;
  role: AdminRole;
  created_at: number;
}

export interface SavingsPlanTemplate {
  _id: string;
  name: string;
  description?: string;
  default_target_kobo: bigint;
  duration_days: number;
  interest_rate: number;
  automation_type?: string;
  is_active: boolean;
  created_at: number;
}

export interface UserSavingsPlan {
  _id: string;
  user_id: string;
  template_id: string;
  custom_target_kobo: bigint;
  current_amount_kobo: bigint;
  start_date: string;
  end_date: string;
  status: PlanStatus;
  automation_enabled: boolean;
  metadata?: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface Transaction {
  _id: string;
  user_id: string;
  user_plan_id?: string;
  type: TxnType;
  amount_kobo: bigint;
  reference: string;
  reversal_of_transaction_id?: string;
  reversal_of_reference?: string;
  reversal_of_type?: TxnType;
  metadata: Record<string, unknown>;
  created_at: number;
}

export interface Withdrawal {
  _id: string;
  requested_by: string;
  requested_amount_kobo: bigint;
  method: WithdrawalMethod;
  status: WithdrawalStatus;
  requested_at: number;
  processed_at?: number;
  approved_by?: string;
  rejected_by?: string;
  rejection_reason?: string;
}

export interface UserRiskHold {
  _id: string;
  user_id: string;
  scope: RiskHoldScope;
  status: RiskHoldStatus;
  reason: string;
  placed_by_admin_id: string;
  placed_at: number;
  released_by_admin_id?: string;
  released_at?: number;
}

export interface RiskEvent {
  _id: string;
  user_id: string;
  scope: RiskHoldScope;
  event_type: RiskEventType;
  severity: RiskSeverity;
  message: string;
  details?: Record<string, unknown>;
  actor_admin_id?: string;
  created_at: number;
}

export interface TransactionReconciliationIssue {
  _id: string;
  run_id: string;
  issue_type: TransactionReconciliationIssueType;
  issue_status: TransactionReconciliationIssueStatus;
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
