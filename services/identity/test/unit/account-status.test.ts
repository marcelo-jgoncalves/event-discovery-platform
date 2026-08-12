import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  InvalidAccountStatusTransitionError,
  reactivateAccount,
  requestAccountDeletion,
} from '../../src/domain/account-status.ts';
import type { UserProfile } from '../../src/domain/types.ts';

function activeProfile(): UserProfile {
  return {
    userId: 'usr_1',
    status: 'ACTIVE',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    preferences: {},
  };
}

test('requestAccountDeletion transitions ACTIVE to DELETING', () => {
  const result = requestAccountDeletion(activeProfile(), '2026-08-11T00:00:00.000Z');
  assert.equal(result.status, 'DELETING');
  assert.equal(result.updatedAt, '2026-08-11T00:00:00.000Z');
});

test('requestAccountDeletion is idempotent for an already-DELETING account', () => {
  const deleting = requestAccountDeletion(activeProfile(), '2026-08-11T00:00:00.000Z');
  const result = requestAccountDeletion(deleting, '2026-08-12T00:00:00.000Z');
  assert.equal(result.updatedAt, '2026-08-11T00:00:00.000Z');
});

test('reactivateAccount rejects DELETING -> ACTIVE (not supported this phase)', () => {
  const deleting = requestAccountDeletion(activeProfile(), '2026-08-11T00:00:00.000Z');
  assert.throws(() => reactivateAccount(deleting), InvalidAccountStatusTransitionError);
});

test('reactivateAccount is a no-op for an already-ACTIVE account', () => {
  const profile = activeProfile();
  assert.deepEqual(reactivateAccount(profile), profile);
});
