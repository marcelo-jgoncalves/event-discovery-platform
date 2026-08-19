import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signup } from '../../src/application/signup.ts';
import type { CognitoAuthClient } from '../../src/pii/cognito-client.ts';
import type { UsersTableRepository } from '../../src/infra/users-table-repository.ts';
import type { ConsentRecord, UserProfile } from '../../src/domain/types.ts';

function fakeCognito(overrides: Partial<CognitoAuthClient> = {}): CognitoAuthClient & {
  deletedUsers: string[];
} {
  const deletedUsers: string[] = [];
  return {
    deletedUsers,
    signUp: () => Promise.resolve({ userId: 'usr_1' }),
    confirmSignUp: () => Promise.resolve(),
    login: () => Promise.resolve({ accessToken: 'a', idToken: 'i', refreshToken: 'r' }),
    deleteUser: (email: string) => {
      deletedUsers.push(email);
      return Promise.resolve();
    },
    ...overrides,
  };
}

function fakeUsersTable(
  putProfileAndConsent: (profile: UserProfile, consent: ConsentRecord) => Promise<void>,
): UsersTableRepository {
  return { putProfileAndConsent } as unknown as UsersTableRepository;
}

test('signup() creates the Cognito account and a versioned account_terms consent atomically', async () => {
  let saved: { profile: UserProfile; consent: ConsentRecord } | undefined;
  const usersTable = fakeUsersTable((profile, consent) => {
    saved = { profile, consent };
    return Promise.resolve();
  });

  const result = await signup(
    { email: 'user@example.com', password: 'a-very-long-password' },
    { cognito: fakeCognito(), usersTable, now: () => '2026-08-19T00:00:00.000Z' },
  );

  assert.equal(result.userId, 'usr_1');
  assert.equal(saved?.profile.status, 'ACTIVE');
  assert.equal(saved?.consent.purpose, 'account_terms');
  assert.equal(saved?.consent.version, 1);
});

test('signup() deletes the orphaned Cognito user when the UsersTable write fails, and rethrows the original error', async () => {
  const cognito = fakeCognito();
  const usersTable = fakeUsersTable(() =>
    Promise.reject(new Error('DynamoDB TransactWriteItems failed')),
  );

  await assert.rejects(
    signup(
      { email: 'user@example.com', password: 'a-very-long-password' },
      { cognito, usersTable, now: () => '2026-08-19T00:00:00.000Z' },
    ),
    /DynamoDB TransactWriteItems failed/,
  );

  assert.deepEqual(cognito.deletedUsers, ['user@example.com']);
});

test('signup() still rethrows the original DynamoDB error even if the Cognito compensation delete also fails', async () => {
  const cognito = fakeCognito({
    deleteUser: () => Promise.reject(new Error('Cognito AdminDeleteUser failed too')),
  });
  const usersTable = fakeUsersTable(() =>
    Promise.reject(new Error('DynamoDB TransactWriteItems failed')),
  );

  await assert.rejects(
    signup(
      { email: 'user@example.com', password: 'a-very-long-password' },
      { cognito, usersTable, now: () => '2026-08-19T00:00:00.000Z' },
    ),
    /DynamoDB TransactWriteItems failed/,
  );
});

test('signup() logs an observable, PII-free signal when the compensation delete also fails (orphaned account)', async () => {
  const cognito = fakeCognito({
    deleteUser: () => Promise.reject(new Error('Cognito AdminDeleteUser failed too')),
  });
  const usersTable = fakeUsersTable(() =>
    Promise.reject(new Error('DynamoDB TransactWriteItems failed')),
  );

  const originalConsoleError = console.error;
  let logged = '';
  console.error = (message: string) => {
    logged = message;
  };
  try {
    await assert.rejects(
      signup(
        { email: 'user@example.com', password: 'a-very-long-password' },
        { cognito, usersTable, now: () => '2026-08-19T00:00:00.000Z' },
      ),
    );
  } finally {
    console.error = originalConsoleError;
  }

  const parsed = JSON.parse(logged) as { event: string; userId: string; reason: string };
  assert.equal(parsed.event, 'signup.compensation_failed');
  assert.equal(parsed.userId, 'usr_1');
  assert.doesNotMatch(logged, /user@example\.com/);
});

test('signup() rejects a password shorter than 12 characters before ever calling Cognito', async () => {
  let cognitoCalled = false;
  const cognito = fakeCognito({
    signUp: () => {
      cognitoCalled = true;
      return Promise.resolve({ userId: 'usr_1' });
    },
  });
  const usersTable = fakeUsersTable(() => Promise.resolve());

  await assert.rejects(
    signup(
      { email: 'user@example.com', password: 'short' },
      { cognito, usersTable, now: () => '2026-08-19T00:00:00.000Z' },
    ),
  );
  assert.equal(cognitoCalled, false);
});
