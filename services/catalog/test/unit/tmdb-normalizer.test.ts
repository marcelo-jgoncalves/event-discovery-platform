import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RawSourceEvent } from '@edp/provider-contracts';
import { normalizeTmdbMovie } from '../../src/domain/tmdb-normalizer.ts';

const now = '2026-08-12T00:00:00.000Z';

function tmdbEvent(payload: Record<string, unknown>): RawSourceEvent {
  return { source: 'tmdb', externalId: String(payload.id), fetchedAt: now, payload };
}

test('normalizes a TMDB movie payload into a CanonicalWork with no leaked provider field names', () => {
  const work = normalizeTmdbMovie(
    tmdbEvent({
      id: 157336,
      title: 'Interestelar',
      original_title: 'Interstellar',
      release_date: '2014-11-06',
      overview: 'A team of explorers...',
    }),
    now,
  );

  assert.equal(work.canonicalId, 'WORK#tmdb:157336');
  assert.equal(work.type, 'MOVIE');
  assert.equal(work.title, 'Interestelar');
  assert.equal(work.normalizedTitle, 'interestelar');
  assert.equal(work.source, 'tmdb');
  assert.equal(work.sourceId, '157336');
});

test('rejects a RawSourceEvent from another source', () => {
  assert.throws(() =>
    normalizeTmdbMovie(
      { source: 'ticketmaster', externalId: 'x', fetchedAt: now, payload: {} },
      now,
    ),
  );
});
