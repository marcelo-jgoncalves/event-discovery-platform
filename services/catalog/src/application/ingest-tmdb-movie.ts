import type { RawSourceEvent } from '@edp/provider-contracts';
import { buildCatalogEventNormalizedV1 } from '../domain/catalog-event.ts';
import { normalizeTmdbMovie } from '../domain/tmdb-normalizer.ts';
import type { CatalogTableRepository } from '../infra/catalog-table-repository.ts';

export async function ingestTmdbMovie(
  raw: RawSourceEvent,
  deps: { catalogTable: CatalogTableRepository; now: () => string; correlationId: string },
): Promise<void> {
  const now = deps.now();
  const work = normalizeTmdbMovie(raw, now);
  await deps.catalogTable.putWork(work);

  const event = buildCatalogEventNormalizedV1(
    work.canonicalId,
    'tmdb',
    'NOT_APPLICABLE',
    deps.correlationId,
    now,
  );
  // structured log stand-in for the publish step (spec-catalog.md §6).
  console.log(JSON.stringify(event));
}
