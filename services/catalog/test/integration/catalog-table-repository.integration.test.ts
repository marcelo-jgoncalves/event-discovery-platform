import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { CatalogTableRepository } from '../../src/infra/catalog-table-repository.ts';
import type { CanonicalEvent, CanonicalWork } from '../../src/domain/types.ts';

// Integration-local against real DynamoDB Local, same emulator/pattern as
// services/identity/test/integration (testing-strategy.md).
const endpoint = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:8000';
const tableName = `EdpTestCatalogTable-${randomUUID()}`;

const client = new DynamoDBClient({
  endpoint,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

const repository = new CatalogTableRepository(tableName, client);
const now = '2026-08-12T00:00:00.000Z';

before(async () => {
  await client.send(
    new CreateTableCommand({
      TableName: tableName,
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
      ],
    }),
  );
});

after(async () => {
  await client.send(new DeleteTableCommand({ TableName: tableName }));
});

function work(id: string, normalizedTitle: string): CanonicalWork {
  return {
    canonicalId: `WORK#tmdb:${id}`,
    type: 'MOVIE',
    title: normalizedTitle,
    normalizedTitle,
    originalTitle: normalizedTitle,
    source: 'tmdb',
    sourceId: id,
    createdAt: now,
    updatedAt: now,
  };
}

test('putWork/getWork round-trip and write the WORKTITLE companion item', async () => {
  const w = work(randomUUID(), 'interstellar');
  await repository.putWork(w);

  const fetched = await repository.getWork(w.canonicalId);
  assert.equal(fetched?.canonicalId, w.canonicalId);

  const candidates = await repository.findWorksByNormalizedTitle('interstellar');
  assert.ok(candidates.some((c) => c.canonicalId === w.canonicalId));
});

test('putEvent writes REVIEW#UNRESOLVED companion item only when unresolved', async () => {
  const resolved: CanonicalEvent = {
    canonicalId: `EVENT#ticketmaster:${randomUUID()}`,
    type: 'CONCERT',
    title: 'Some Band',
    startAt: now,
    status: 'onsale',
    resolutionStatus: 'NOT_APPLICABLE',
    source: 'ticketmaster',
    sourceId: 'x',
    createdAt: now,
    updatedAt: now,
  };
  await repository.putEvent(resolved);

  const unresolved: CanonicalEvent = {
    ...resolved,
    canonicalId: `EVENT#ticketmaster:${randomUUID()}`,
    resolutionStatus: 'UNRESOLVED',
  };
  await repository.putEvent(unresolved);

  const reviewQueue = await repository.listUnresolvedEvents();
  assert.ok(reviewQueue.includes(unresolved.canonicalId));
  assert.ok(!reviewQueue.includes(resolved.canonicalId));
});

test('getEvent returns undefined for an unknown event', async () => {
  const event = await repository.getEvent('EVENT#ticketmaster:unknown');
  assert.equal(event, undefined);
});
