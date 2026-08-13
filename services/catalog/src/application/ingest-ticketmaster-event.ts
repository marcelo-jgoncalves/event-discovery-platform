import type { RawSourceEvent } from '@edp/provider-contracts';
import { buildCatalogEventNormalizedV1 } from '../domain/catalog-event.ts';
import { normalizeTitle } from '../domain/normalize-title.ts';
import { resolveWorkForEvent } from '../domain/resolve-work-for-event.ts';
import { normalizeTicketmasterEvent } from '../domain/ticketmaster-normalizer.ts';
import type { CatalogTableRepository } from '../infra/catalog-table-repository.ts';

export async function ingestTicketmasterEvent(
  raw: RawSourceEvent,
  deps: { catalogTable: CatalogTableRepository; now: () => string; correlationId: string },
): Promise<void> {
  const now = deps.now();
  const normalized = normalizeTicketmasterEvent(raw, now);

  // Level-2 composite entity resolution (ADR-002 / spec-catalog.md §7): the
  // candidate lookup is the only I/O here, resolveWorkForEvent itself stays
  // pure and unit-testable.
  const candidates =
    normalized.resolutionStatus === 'UNRESOLVED'
      ? await deps.catalogTable.findWorksByNormalizedTitle(normalizeTitle(normalized.title))
      : [];

  const resolution = resolveWorkForEvent(normalized, candidates);
  const event = { ...normalized, ...resolution };

  await deps.catalogTable.putEvent(event);

  const domainEvent = buildCatalogEventNormalizedV1(
    event.canonicalId,
    'ticketmaster',
    event.resolutionStatus,
    deps.correlationId,
    now,
  );
  console.log(JSON.stringify(domainEvent));
}
