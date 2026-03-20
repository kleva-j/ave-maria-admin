export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class WithdrawalPolicyError extends DomainError {
  constructor(message: string) {
    super(message, "withdrawal_policy_error");
    this.name = "WithdrawalPolicyError";
  }
}

export class WithdrawalForbiddenError extends DomainError {
  constructor(
    message: string,
    public readonly code: string,
    public readonly action: string,
    public readonly method: string,
    public readonly allowedRoles: readonly string[],
  ) {
    super(message, "withdrawal_action_forbidden");
    this.name = "WithdrawalForbiddenError";
  }
}

export class RiskAssessmentError extends DomainError {
  constructor(message: string) {
    super(message, "risk_assessment_error");
    this.name = "RiskAssessmentError";
  }
}

export class WithdrawalBlockedError extends DomainError {
  constructor(
    message: string,
    public readonly scope: string,
    public readonly rule: string,
  ) {
    super(message, "withdrawal_risk_blocked");
    this.name = "WithdrawalBlockedError";
  }
}

export class TransactionValidationError extends DomainError {
  constructor(message: string) {
    super(message, "transaction_validation_error");
    this.name = "TransactionValidationError";
  }
}

export class InsufficientBalanceError extends DomainError {
  constructor(message: string) {
    super(message, "insufficient_balance");
    this.name = "InsufficientBalanceError";
  }
}
