import { describe, it, expect, vi } from "vitest";
import {
  createBuildWithdrawalCapabilitiesUseCase,
  createEvaluateWithdrawalRiskUseCase,
  createReleaseRiskHoldUseCase,
  createPlaceRiskHoldUseCase,
} from "../use-cases";

import type {
  WithdrawalRepository,
  RiskEventRepository,
  RiskHoldRepository,
} from "../ports";

const createMockRiskHoldRepository = (
  overrides: Partial<RiskHoldRepository> = {},
): RiskHoldRepository => ({
  findActiveWithdrawalHold: vi.fn(),
  create: vi.fn(),
  release: vi.fn(),
  ...overrides,
});

const createMockWithdrawalRepository = (
  overrides: Partial<WithdrawalRepository> = {},
): WithdrawalRepository => ({
  findById: vi.fn(),
  findByUserId: vi.fn(),
  ...overrides,
});

const createMockRiskEventRepository = (
  overrides: Partial<RiskEventRepository> = {},
): RiskEventRepository => ({
  findLatestByUserId: vi.fn(),
  getLastBankAccountChangeAt: vi.fn(),
  create: vi.fn(),
  ...overrides,
});

describe("use-cases", () => {
  describe("createEvaluateWithdrawalRiskUseCase", () => {
    it("should return blocked decision for user with active hold", async () => {
      const mockRiskHoldRepository = createMockRiskHoldRepository({
        findActiveWithdrawalHold: vi.fn().mockResolvedValue({
          _id: "hold-1",
          reason: "Suspicious activity",
          placed_at: Date.now(),
        }),
      });
      const mockWithdrawalRepository = createMockWithdrawalRepository({
        findByUserId: vi.fn().mockResolvedValue([]),
      });
      const mockRiskEventRepository = createMockRiskEventRepository({
        getLastBankAccountChangeAt: vi.fn().mockResolvedValue(undefined),
      });

      const evaluateRisk = createEvaluateWithdrawalRiskUseCase({
        riskHoldRepository: mockRiskHoldRepository,
        withdrawalRepository: mockWithdrawalRepository,
        riskEventRepository: mockRiskEventRepository,
      });

      const result = await evaluateRisk({
        userId: "user-1",
        amountKobo: 1000n,
        method: "bank_transfer",
      });

      expect(result.blocked).toBe(true);
      expect(result.rule).toBe("manual_hold");
    });

    it("should return allowed decision for clean user", async () => {
      const mockRiskHoldRepository = createMockRiskHoldRepository({
        findActiveWithdrawalHold: vi.fn().mockResolvedValue(null),
      });
      const mockWithdrawalRepository = createMockWithdrawalRepository({
        findByUserId: vi.fn().mockResolvedValue([]),
      });
      const mockRiskEventRepository = createMockRiskEventRepository({
        getLastBankAccountChangeAt: vi.fn().mockResolvedValue(undefined),
      });

      const evaluateRisk = createEvaluateWithdrawalRiskUseCase({
        riskHoldRepository: mockRiskHoldRepository,
        withdrawalRepository: mockWithdrawalRepository,
        riskEventRepository: mockRiskEventRepository,
      });

      const result = await evaluateRisk({
        userId: "user-1",
        amountKobo: 1000n,
        method: "bank_transfer",
      });

      expect(result.blocked).toBe(false);
    });
  });

  describe("createPlaceRiskHoldUseCase", () => {
    const createMockAuditLogService = () => ({
      log: vi.fn().mockResolvedValue(undefined),
    });

    it("should place a risk hold successfully", async () => {
      const mockRiskHoldRepository = createMockRiskHoldRepository({
        findActiveWithdrawalHold: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ _id: "hold-new" }),
      });
      const mockRiskEventRepository = createMockRiskEventRepository({
        create: vi.fn().mockResolvedValue({ _id: "event-1" }),
      });
      const mockAuditLogService = createMockAuditLogService();

      const placeHold = createPlaceRiskHoldUseCase({
        riskHoldRepository: mockRiskHoldRepository,
        riskEventRepository: mockRiskEventRepository,
        auditLogService: mockAuditLogService,
      });

      const result = await placeHold({
        userId: "user-1",
        reason: "Suspicious activity",
        adminId: "admin-1",
      });

      expect(result.id).toBe("hold-new");
      expect(mockRiskHoldRepository.create).toHaveBeenCalled();
      expect(mockRiskEventRepository.create).toHaveBeenCalled();
      expect(mockAuditLogService.log).toHaveBeenCalled();
    });

    it("should throw if user already has active hold", async () => {
      const mockRiskHoldRepository = createMockRiskHoldRepository({
        findActiveWithdrawalHold: vi.fn().mockResolvedValue({
          _id: "existing-hold",
          reason: "Already blocked",
          placed_at: Date.now(),
        }),
      });
      const mockRiskEventRepository = createMockRiskEventRepository();
      const mockAuditLogService = createMockAuditLogService();

      const placeHold = createPlaceRiskHoldUseCase({
        riskHoldRepository: mockRiskHoldRepository,
        riskEventRepository: mockRiskEventRepository,
        auditLogService: mockAuditLogService,
      });

      await expect(
        placeHold({
          userId: "user-1",
          reason: "New hold",
          adminId: "admin-1",
        }),
      ).rejects.toThrow("User already has an active withdrawal hold");
    });
  });

  describe("createReleaseRiskHoldUseCase", () => {
    const createMockAuditLogService = () => ({
      log: vi.fn().mockResolvedValue(undefined),
    });

    it("should release a risk hold successfully", async () => {
      const mockRiskHoldRepository = createMockRiskHoldRepository({
        findActiveWithdrawalHold: vi.fn().mockResolvedValue({
          _id: "hold-1",
          reason: "Previous hold",
          placed_at: Date.now(),
        }),
        release: vi.fn().mockResolvedValue(undefined),
      });
      const mockRiskEventRepository = createMockRiskEventRepository({
        create: vi.fn().mockResolvedValue({ _id: "event-1" }),
      });
      const mockAuditLogService = createMockAuditLogService();

      const releaseHold = createReleaseRiskHoldUseCase({
        riskHoldRepository: mockRiskHoldRepository,
        riskEventRepository: mockRiskEventRepository,
        auditLogService: mockAuditLogService,
      });

      await releaseHold({
        userId: "user-1",
        adminId: "admin-1",
      });

      expect(mockRiskHoldRepository.release).toHaveBeenCalledWith(
        "hold-1",
        "admin-1",
        expect.any(Number),
      );
      expect(mockRiskEventRepository.create).toHaveBeenCalled();
      expect(mockAuditLogService.log).toHaveBeenCalled();
    });

    it("should throw if no active hold exists", async () => {
      const mockRiskHoldRepository = createMockRiskHoldRepository({
        findActiveWithdrawalHold: vi.fn().mockResolvedValue(null),
      });
      const mockRiskEventRepository = createMockRiskEventRepository();
      const mockAuditLogService = createMockAuditLogService();

      const releaseHold = createReleaseRiskHoldUseCase({
        riskHoldRepository: mockRiskHoldRepository,
        riskEventRepository: mockRiskEventRepository,
        auditLogService: mockAuditLogService,
      });

      await expect(
        releaseHold({
          userId: "user-1",
          adminId: "admin-1",
        }),
      ).rejects.toThrow("User does not have an active withdrawal hold");
    });
  });

  describe("createBuildWithdrawalCapabilitiesUseCase", () => {
    it("should build capabilities with active hold blocking", async () => {
      const mockRiskHoldRepository = createMockRiskHoldRepository({
        findActiveWithdrawalHold: vi.fn().mockResolvedValue({
          _id: "hold-1",
          reason: "Blocked for review",
          placed_at: Date.now(),
        }),
      });

      const buildCapabilities = createBuildWithdrawalCapabilitiesUseCase({
        riskHoldRepository: mockRiskHoldRepository,
      });

      const result = await buildCapabilities({
        withdrawal: { status: "pending", method: "bank_transfer" },
        userId: "user-1",
        adminRole: "support",
      });

      expect(result.approve.allowed).toBe(false);
      expect(result.reject.allowed).toBe(true);
      expect(result.process.allowed).toBe(false);
    });

    it("should build capabilities without hold", async () => {
      const mockRiskHoldRepository = createMockRiskHoldRepository({
        findActiveWithdrawalHold: vi.fn().mockResolvedValue(null),
      });

      const buildCapabilities = createBuildWithdrawalCapabilitiesUseCase({
        riskHoldRepository: mockRiskHoldRepository,
      });

      const result = await buildCapabilities({
        withdrawal: { status: "pending", method: "bank_transfer" },
        userId: "user-1",
        adminRole: "support",
      });

      expect(result.approve.allowed).toBe(true);
      expect(result.reject.allowed).toBe(true);
      expect(result.process.allowed).toBe(false);
    });
  });
});
