import type {
  EventOutboxService,
  DomainEvent,
} from "@avm-daily/application/ports";

import type { MutationCtx } from "../_generated/server";

import { appendNotificationEvents } from "../adminAlerts";

export function createConvexEventOutboxService(
  ctx: MutationCtx,
): EventOutboxService {
  return {
    async append(events: DomainEvent[]): Promise<void> {
      await appendNotificationEvents(ctx, events);
    },
  };
}
