import type {
  TransactionSource,
  WithdrawalAction,
  WithdrawalMethod,
  WithdrawalStatus,
  RiskEventType,
  RiskHoldScope,
  RiskSeverity,
  Transaction,
  TxnType,
} from "@avm-daily/domain";

export type TransactionDTO = {
  id: string;
  userId: string;
  userPlanId?: string;
  type: TxnType;
  amountKobo: bigint;
  reference: string;
  reversalOfTransactionId?: string;
  reversalOfReference?: string;
  reversalOfType?: TxnType;
  metadata: Record<string, unknown>;
  createdAt: number;
};

export type PostTransactionDTO = {
  userId: string;
  userPlanId?: string;
  type: TxnType;
  amountKobo: bigint;
  reference: string;
  metadata?: Record<string, unknown>;
  source: TransactionSource;
  actorId?: string;
  createdAt?: number;
  reversalOfTransactionId?: string;
  reversalOfReference?: string;
  reversalOfType?: TxnType;
};

export type ReverseTransactionDTO = {
  originalTransactionId: string;
  reference: string;
  reason: string;
  metadata?: Record<string, unknown>;
  source: TransactionSource;
  actorId?: string;
  createdAt?: number;
};

export type WithdrawalDTO = {
  id: string;
  requestedBy: string;
  requestedAmountKobo: bigint;
  method: WithdrawalMethod;
  status: WithdrawalStatus;
  requestedAt: number;
  processedAt?: number;
};

export type WithdrawalRequestDTO = {
  userId: string;
  amountKobo: bigint;
  method: WithdrawalMethod;
};

export type WithdrawalActionDTO = {
  withdrawalId: string;
  adminId: string;
  action: WithdrawalAction;
  reason?: string;
};

export type WithdrawalCapabilityDTO = {
  allowed: boolean;
  reason?: string;
};

export type WithdrawalCapabilitiesDTO = {
  approve: WithdrawalCapabilityDTO;
  reject: WithdrawalCapabilityDTO;
  process: WithdrawalCapabilityDTO;
};

export type RiskHoldDTO = {
  id: string;
  userId: string;
  scope: RiskHoldScope;
  status: string;
  reason: string;
  placedByAdminId: string;
  placedAt: number;
  releasedByAdminId?: string;
  releasedAt?: number;
};

export type PlaceRiskHoldDTO = {
  userId: string;
  reason: string;
};

export type RiskDecisionDTO = {
  blocked: boolean;
  rule?: string;
  message?: string;
  severity?: RiskSeverity;
  eventType?: RiskEventType;
  details?: Record<string, unknown>;
};

export type RiskSummaryDTO = {
  hasActiveHold: boolean;
  blocked: boolean;
  blockReason?: string;
};

export type PostTransactionOutput = {
  transaction: Transaction;
  idempotent: boolean;
};

export type ReverseTransactionOutput = {
  transaction: Transaction;
};

export type CreateSavingsPlanTemplateDTO = {
  name: string;
  description?: string;
  defaultTargetKobo: bigint;
  durationDays: number;
  interestRate: number;
  automationType?: string;
};

export type UpdateSavingsPlanTemplateDTO = {
  templateId: string;
  name?: string;
  description?: string;
  defaultTargetKobo?: bigint;
  durationDays?: number;
  interestRate?: number;
  automationType?: string;
};

export type SetSavingsPlanTemplateActiveStateDTO = {
  templateId: string;
  isActive: boolean;
  actorId: string;
};

export type CreateSavingsPlanDTO = {
  userId: string;
  templateId: string;
  customTargetKobo?: bigint;
  startDate?: string;
  endDate?: string;
  today?: string;
};

export type UpdateSavingsPlanSettingsDTO = {
  planId: string;
  userId: string;
  customTargetKobo?: bigint;
  endDate?: string;
};

export type ChangeSavingsPlanStatusDTO = {
  planId: string;
  userId: string;
};

export type RecordSavingsPlanContributionDTO = {
  planId: string;
  userId: string;
  amountKobo: bigint;
  reference: string;
  metadata?: Record<string, unknown>;
  source: TransactionSource;
  actorId?: string;
};

