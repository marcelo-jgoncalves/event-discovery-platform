import { z } from 'zod';
import type { RawSourceEvent } from '@edp/provider-contracts';
import { buildCanonicalId } from './canonical-id.ts';
import type { CanonicalEvent, EventType } from './types.ts';

// Ticketmaster Discovery API event shape (subset used by this normalizer) —
// kept local, never exported (ADR-002 anti-corruption layer). Validated at
// runtime, not just typed (code-conventions.md — external-provider boundary).
// `dates.start.dateTime` is intentionally required: it used to be optional
// with a silent `?? now` fallback in this normalizer, which corrupted the
// event's actual start time into "whenever ingestion happened to run"
// instead of surfacing the missing field as an ingestion failure.
const ticketmasterEventPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  classifications: z
    .array(z.object({ segment: z.object({ name: z.string().optional() }).optional() }))
    .optional(),
  dates: z.object({
    start: z.object({ dateTime: z.string() }),
    status: z.object({ code: z.string().optional() }).optional(),
  }),
  _embedded: z
    .object({
      venues: z
        .array(
          z.object({
            id: z.string().optional(),
            city: z.object({ name: z.string().optional() }).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

type TicketmasterEventPayload = z.infer<typeof ticketmasterEventPayloadSchema>;

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
  const event = ticketmasterEventPayloadSchema.parse(raw.payload);
  const type = classifyEventType(event);

  return {
    canonicalId: buildCanonicalId('EVENT', 'ticketmaster', event.id),
    type,
    title: event.name,
    venueId: event._embedded?.venues?.[0]?.id,
    cityName: event._embedded?.venues?.[0]?.city?.name,
    startAt: event.dates.start.dateTime,
    status: event.dates.status?.code ?? 'unknown',
    // workId/resolutionStatus are filled in by resolveWorkForEvent — this
    // normalizer stays pure and provider-shape-only.
    resolutionStatus: isFilmScreening(type) ? 'UNRESOLVED' : 'NOT_APPLICABLE',
    source: 'ticketmaster',
    sourceId: event.id,
    createdAt: now,
    updatedAt: now,
  };
}
