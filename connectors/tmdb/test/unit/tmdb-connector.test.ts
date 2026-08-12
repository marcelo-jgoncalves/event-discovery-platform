import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TmdbClient } from '../../src/tmdb-client.ts';
import { TmdbConnector } from '../../src/index.ts';

function fakeFetch(body: unknown): typeof fetch {
  return (..._args: Parameters<typeof fetch>) =>
    Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

test('collect() maps TMDB now_playing results to RawSourceEvent without touching payload shape', async () => {
  const client = new TmdbClient(
    'fake-key',
    fakeFetch({ results: [{ id: 157336, title: 'Interstellar' }] }),
  );
  const connector = new TmdbConnector(client);

  const result = await connector.collect();

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0]?.source, 'tmdb');
  assert.equal(result.events[0]?.externalId, '157336');
  assert.deepEqual(result.events[0]?.payload, { id: 157336, title: 'Interstellar' });
});

test('source() reports tmdb', () => {
  const connector = new TmdbConnector(new TmdbClient('fake-key'));
  assert.equal(connector.source(), 'tmdb');
});
