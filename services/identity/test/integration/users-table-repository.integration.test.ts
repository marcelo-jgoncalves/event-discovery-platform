import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { UsersTableRepository } from '../../src/infra/users-table-repository.ts';

// Integration-local: real DynamoDB Local (testing-strategy.md - "mock never
// substitutes a real integration test"), same emulator CI's integration-fast
// job already runs (.github/workflows/ci.yml, AWS_ENDPOINT_URL). Table is
// created/dropped per run so this test never depends on Terraform having
// applied anything.
const endpoint = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:8000';
const tableName = `EdpTestUsersTable-${randomUUID()}`;

const client = new DynamoDBClient({
  endpoint,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

const repository = new UsersTableRepository(tableName, client);

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

test('putProfile/getProfile round-trip a non-PII profile item', async () => {
  const userId = randomUUID();
  await repository.putProfile({
    userId,
    status: 'ACTIVE',
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
    preferences: {},
  });

  const profile = await repository.getProfile(userId);
  assert.equal(profile?.userId, userId);
  assert.equal(profile?.status, 'ACTIVE');
});

test('getProfile returns undefined for an unknown user', async () => {
  const profile = await repository.getProfile(randomUUID());
  assert.equal(profile, undefined);
});

test('putConsent/listConsents supports the "all consents for user" access pattern via PK Query', async () => {
  const userId = randomUUID();
  await repository.putConsent({
    userId,
    purpose: 'account_terms',
    version: 1,
    grantedAt: '2026-08-11T00:00:00.000Z',
    source: 'SIGNUP_FORM',
  });
  await repository.putConsent({
    userId,
    purpose: 'telegram_notifications',
    version: 1,
    grantedAt: '2026-08-11T00:00:00.000Z',
    source: 'TELEGRAM_BOT',
  });

  const consents = await repository.listConsents(userId);
  const purposes = consents.map((c) => c.purpose).sort();
  assert.deepEqual(purposes, ['account_terms', 'telegram_notifications']);
});

test('putConsent overwrites the previous item for the same purpose (latest-version-only, spec-identity.md §5)', async () => {
  const userId = randomUUID();
  await repository.putConsent({
    userId,
    purpose: 'account_terms',
    version: 1,
    grantedAt: '2026-08-11T00:00:00.000Z',
    source: 'SIGNUP_FORM',
  });
  await repository.putConsent({
    userId,
    purpose: 'account_terms',
    version: 2,
    grantedAt: '2026-08-12T00:00:00.000Z',
    source: 'API',
  });

  const consent = await repository.getConsent(userId, 'account_terms');
  assert.equal(consent?.version, 2);

  const all = await repository.listConsents(userId);
  assert.equal(all.length, 1);
});
