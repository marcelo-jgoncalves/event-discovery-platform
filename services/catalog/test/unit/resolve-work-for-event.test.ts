import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveWorkForEvent } from '../../src/domain/resolve-work-for-event.ts';
import type { CanonicalEvent, CanonicalWork } from '../../src/domain/types.ts';

const now = '2026-08-12T00:00:00.000Z';

function screeningEvent(): CanonicalEvent {
  return {
    canonicalId: 'EVENT#ticketmaster:vvG1zZa4e',
    type: 'SCREENING',
    title: 'Interstellar (IMAX)',
    startAt: now,
    status: 'onsale',
    resolutionStatus: 'UNRESOLVED',
    source: 'ticketmaster',
    sourceId: 'vvG1zZa4e',
    createdAt: now,
    updatedAt: now,
  };
}

function work(canonicalId: string): CanonicalWork {
  return {
    canonicalId,
    type: 'MOVIE',
    title: 'Interstellar',
    normalizedTitle: 'interstellar',
    originalTitle: 'Interstellar',
    source: 'tmdb',
    sourceId: '157336',
    createdAt: now,
    updatedAt: now,
  };
}

test('resolves to the single matching Work by exact normalized title', () => {
  const result = resolveWorkForEvent(screeningEvent(), [work('WORK#tmdb:157336')]);
  assert.equal(result.resolutionStatus, 'RESOLVED');
  assert.equal(result.workId, 'WORK#tmdb:157336');
});

test('stays UNRESOLVED when no candidate Work exists yet', () => {
  const result = resolveWorkForEvent(screeningEvent(), []);
  assert.equal(result.resolutionStatus, 'UNRESOLVED');
  assert.equal(result.workId, undefined);
});

test('stays UNRESOLVED when the title is ambiguous (multiple candidates, e.g. a remake)', () => {
  const result = resolveWorkForEvent(screeningEvent(), [work('WORK#tmdb:1'), work('WORK#tmdb:2')]);
  assert.equal(result.resolutionStatus, 'UNRESOLVED');
  assert.equal(result.workId, undefined);
});

test('non-screening events are NOT_APPLICABLE regardless of candidates (no work linking attempted)', () => {
  const concert: CanonicalEvent = { ...screeningEvent(), type: 'CONCERT' };
  const result = resolveWorkForEvent(concert, [work('WORK#tmdb:157336')]);
  assert.equal(result.resolutionStatus, 'NOT_APPLICABLE');
});
