import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPII } from '../../src/pii/hash.ts';

test('hashPII is deterministic for the same value', () => {
  assert.equal(hashPII('user@example.com'), hashPII('user@example.com'));
});

test('hashPII is case- and whitespace-insensitive (same email, different casing/spacing)', () => {
  assert.equal(hashPII('User@Example.com'), hashPII(' user@example.com '));
});

test('hashPII never returns the raw input', () => {
  const raw = 'user@example.com';
  assert.notEqual(hashPII(raw), raw);
  assert.equal(hashPII(raw).length, 64); // sha256 hex digest
});
