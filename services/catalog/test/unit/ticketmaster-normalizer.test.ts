import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RawSourceEvent } from '@edp/provider-contracts';
import { normalizeTicketmasterEvent } from '../../src/domain/ticketmaster-normalizer.ts';

const now = '2026-08-12T00:00:00.000Z';

function tmEvent(payload: Record<string, unknown>): RawSourceEvent {
  return {
    source: 'ticketmaster',
    externalId: String(payload.id),
    fetchedAt: now,
    payload,
  };
}

test('classifies a Film segment event as SCREENING, starts UNRESOLVED', () => {
  const event = normalizeTicketmasterEvent(
    tmEvent({
      id: 'vvG1zZa4e',
      name: 'Interstellar (IMAX)',
      classifications: [{ segment: { name: 'Film' } }],
      dates: { start: { dateTime: '2026-08-22T22:30:00Z' }, status: { code: 'onsale' } },
      _embedded: { venues: [{ id: 'venue1', city: { name: 'Belo Horizonte' } }] },
    }),
    now,
  );

  assert.equal(event.canonicalId, 'EVENT#ticketmaster:vvG1zZa4e');
  assert.equal(event.type, 'SCREENING');
  assert.equal(event.resolutionStatus, 'UNRESOLVED');
  assert.equal(event.workId, undefined);
  assert.equal(event.cityName, 'Belo Horizonte');
});

test('classifies a Music segment event as CONCERT, NOT_APPLICABLE for work linking', () => {
  const event = normalizeTicketmasterEvent(
    tmEvent({
      id: 'concert1',
      name: 'Some Band Live',
      classifications: [{ segment: { name: 'Music' } }],
      dates: { start: { dateTime: '2026-09-10T23:00:00Z' } },
    }),
    now,
  );

  assert.equal(event.type, 'CONCERT');
  assert.equal(event.resolutionStatus, 'NOT_APPLICABLE');
});

test('rejects a payload missing dates.start.dateTime instead of silently using ingestion time', () => {
  assert.throws(() =>
    normalizeTicketmasterEvent(
      tmEvent({
        id: 'concert2',
        name: 'Some Band Live',
        classifications: [{ segment: { name: 'Music' } }],
      }),
      now,
    ),
  );
});
