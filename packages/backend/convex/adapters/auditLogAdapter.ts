/**
 * Convex adapter factory for AuditLogService port interface.
 * Implements AuditLogService using the convex-audit-log component.
 */
import type {
  AuditLogChangeParams,
  AuditLogChangeSnapshot,
  AuditLogService,
} from "@avm-daily/application/ports";

import type { MutationCtx } from "../_generated/server";

import { auditLog } from "../auditLog";

type AuditLogSeverity = Parameters<typeof auditLog.log>[1]["severity"];

export function createConvexAuditLogService(ctx: MutationCtx): AuditLogService {
  return {
    async log(params: {
      action: string;
      actorId?: string;
      resourceType: string;
      resourceId: string;
      severity: string;
      metadata?: Record<string, unknown>;
    }): Promise<void> {
      await auditLog.log(ctx, {
        action: params.action,
        actorId: params.actorId,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        severity: params.severity as AuditLogSeverity,
        metadata: params.metadata,
      });
    },

    async logChange<
      T extends AuditLogChangeSnapshot = AuditLogChangeSnapshot,
    >(params: AuditLogChangeParams<T>): Promise<void> {
      await auditLog.logChange(ctx, {
        action: params.action,
        actorId: params.actorId,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        before: params.before,
        after: params.after,
        severity: params.severity as AuditLogSeverity,
      });
    },
  };
}
