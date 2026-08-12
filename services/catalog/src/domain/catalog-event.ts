import { randomUUID } from 'node:crypto';
import type { ResolutionStatus } from './types.ts';

// architecture.md "Eventos de domínio continuam existindo como contratos" —
// catalog.event.normalized.v1 (spec-catalog.md §6). No queue/topic consumer
// exists yet (Matcher is Phase 3): published via structured console.log
// until a second real consumer justifies a dedicated channel.
export interface CatalogEventNormalizedV1 {
  eventType: 'catalog.event.normalized.v1';
  eventId: string;
  occurredAt: string;
  correlationId: string;
  source: 'tmdb' | 'ticketmaster';
  data: {
    canonicalEventId: string;
    resolutionStatus: ResolutionStatus;
  };
}

export function buildCatalogEventNormalizedV1(
  canonicalEventId: string,
  source: 'tmdb' | 'ticketmaster',
  resolutionStatus: ResolutionStatus,
  correlationId: string,
  now: string,
): CatalogEventNormalizedV1 {
  return {
    eventType: 'catalog.event.normalized.v1',
    eventId: randomUUID(),
    occurredAt: now,
    correlationId,
    source,
    data: { canonicalEventId, resolutionStatus },
  };
}
