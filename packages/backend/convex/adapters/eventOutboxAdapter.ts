import type {
  EventOutboxService,
  DomainEvent,
} from "@avm-daily/application/ports";

import { createAppendDomainEventsUseCase } from "@avm-daily/application/use-cases";

import type { MutationCtx } from "../_generated/server";

import {
  createConvexNotificationEventRepository,
  createConvexNotificationEventScheduler,
} from "./adminAlertAdapters";

export function createConvexEventOutboxService(
  ctx: MutationCtx,
): EventOutboxService {
  const appendDomainEvents = createAppendDomainEventsUseCase({
    notificationEventRepository: createConvexNotificationEventRepository(ctx),
    notificationEventScheduler: createConvexNotificationEventScheduler(ctx),
  });

  return {
    async append(events: DomainEvent[]): Promise<void> {
      await appendDomainEvents(events);
    },
  };
}
