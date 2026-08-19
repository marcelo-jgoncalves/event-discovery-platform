import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TicketmasterClient } from '../../src/ticketmaster-client.ts';
import { TicketmasterConnector } from '../../src/index.ts';

function fakeFetch(body: unknown): typeof fetch {
  return (..._args: Parameters<typeof fetch>) =>
    Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

test('collect() maps Ticketmaster events to RawSourceEvent without touching payload shape', async () => {
  const client = new TicketmasterClient(
    'fake-key',
    fakeFetch({ _embedded: { events: [{ id: 'vvG1zZa4e', name: 'Interstellar (IMAX)' }] } }),
  );
  const connector = new TicketmasterConnector(client);

  const result = await connector.collect();

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0]?.source, 'ticketmaster');
  assert.equal(result.events[0]?.externalId, 'vvG1zZa4e');
  assert.deepEqual(result.events[0]?.payload, { id: 'vvG1zZa4e', name: 'Interstellar (IMAX)' });
});

test('collect() returns no events when _embedded is missing (empty result page)', async () => {
  const client = new TicketmasterClient('fake-key', fakeFetch({}));
  const connector = new TicketmasterConnector(client);

  const result = await connector.collect();
  assert.deepEqual(result.events, []);
});

test('source() reports ticketmaster', () => {
  const connector = new TicketmasterConnector(new TicketmasterClient('fake-key'));
  assert.equal(connector.source(), 'ticketmaster');
});

test('fetchEvents() aborts the request instead of hanging forever on a stalled connection', async () => {
  const neverResolvingFetch: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      const signal = init?.signal;
      signal?.addEventListener('abort', () => reject(new Error('The operation was aborted')));
    });

  // 1ms timeout: the request never settles on its own, so any completion
  // (rejection) proves the abort deadline fired, not the fake network.
  const client = new TicketmasterClient('fake-key', neverResolvingFetch, undefined, 1);

  await assert.rejects(() => client.fetchEvents('Belo Horizonte'));
});
