import type { RawSourceEvent } from '@edp/provider-contracts';
import { buildCanonicalId } from './canonical-id.ts';
import type { CanonicalEvent, EventType } from './types.ts';

// Ticketmaster Discovery API event shape (subset used by this normalizer) —
// kept local, never exported (ADR-002 anti-corruption layer).
interface TicketmasterEventPayload {
  id: string;
  name: string;
  classifications?: { segment?: { name?: string } }[];
  dates?: { start?: { dateTime?: string }; status?: { code?: string } };
  _embedded?: { venues?: { id?: string; city?: { name?: string } }[] };
}

// spec-catalog.md §7: only the Film segment is a candidate for Work linking.
function classifyEventType(payload: TicketmasterEventPayload): EventType {
  const segment = payload.classifications?.[0]?.segment?.name;
  if (segment === 'Film') return 'SCREENING';
  if (segment === 'Music') return 'CONCERT';
  return 'OTHER';
}

export function isFilmScreening(type: EventType): boolean {
  return type === 'SCREENING';
}

export function normalizeTicketmasterEvent(raw: RawSourceEvent, now: string): CanonicalEvent {
  if (raw.source !== 'ticketmaster') {
    throw new Error(
      `normalizeTicketmasterEvent received a non-ticketmaster RawSourceEvent: ${raw.source}`,
    );
  }
  const event = raw.payload as TicketmasterEventPayload;
  const type = classifyEventType(event);

  return {
    canonicalId: buildCanonicalId('EVENT', 'ticketmaster', event.id),
    type,
    title: event.name,
    venueId: event._embedded?.venues?.[0]?.id,
    cityName: event._embedded?.venues?.[0]?.city?.name,
    startAt: event.dates?.start?.dateTime ?? now,
    status: event.dates?.status?.code ?? 'unknown',
    // workId/resolutionStatus are filled in by resolveWorkForEvent — this
    // normalizer stays pure and provider-shape-only.
    resolutionStatus: isFilmScreening(type) ? 'UNRESOLVED' : 'NOT_APPLICABLE',
    source: 'ticketmaster',
    sourceId: event.id,
    createdAt: now,
    updatedAt: now,
  };
}
