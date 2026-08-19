import assert from 'node:assert/strict';
import { test } from 'node:test';
import { login } from '../../src/application/login.ts';
import type { CognitoAuthClient } from '../../src/pii/cognito-client.ts';

function fakeCognito(overrides: Partial<CognitoAuthClient> = {}): CognitoAuthClient {
  return {
    signUp: () => Promise.resolve({ userId: 'usr_1' }),
    confirmSignUp: () => Promise.resolve(),
    login: () => Promise.resolve({ accessToken: 'a', idToken: 'i', refreshToken: 'r' }),
    deleteUser: () => Promise.resolve(),
    ...overrides,
  };
}

test('login() delegates to Cognito and returns the token set unchanged', async () => {
  const tokens = await login(
    { email: 'user@example.com', password: 'a-very-long-password' },
    { cognito: fakeCognito() },
  );

  assert.deepEqual(tokens, { accessToken: 'a', idToken: 'i', refreshToken: 'r' });
});

test('login() rejects an invalid email before calling Cognito', async () => {
  let called = false;
  const cognito = fakeCognito({
    login: () => {
      called = true;
      return Promise.resolve({ accessToken: 'a', idToken: 'i', refreshToken: 'r' });
    },
  });

  await assert.rejects(login({ email: 'not-an-email', password: 'x' }, { cognito }));
  assert.equal(called, false);
});

test('login() propagates a Cognito auth failure (e.g. wrong password) instead of swallowing it', async () => {
  const cognito = fakeCognito({
    login: () => Promise.reject(new Error('NotAuthorizedException')),
  });

  await assert.rejects(
    login({ email: 'user@example.com', password: 'wrong' }, { cognito }),
    /NotAuthorizedException/,
  );
});
