import assert from 'node:assert/strict';
import { test } from 'node:test';
import { grantConsent, NonMonotonicConsentVersionError } from '../../src/domain/consent.ts';

test('grantConsent creates a versioned record, never a bare boolean', () => {
  const consent = grantConsent(undefined, {
    userId: 'usr_1',
    purpose: 'account_terms',
    version: 1,
    source: 'SIGNUP_FORM',
    now: '2026-08-11T12:00:00.000Z',
  });

  assert.equal(consent.purpose, 'account_terms');
  assert.equal(consent.version, 1);
  assert.equal(consent.grantedAt, '2026-08-11T12:00:00.000Z');
  assert.equal(consent.source, 'SIGNUP_FORM');
});

test('grantConsent rejects a re-grant with a version that does not increase', () => {
  const existing = grantConsent(undefined, {
    userId: 'usr_1',
    purpose: 'account_terms',
    version: 2,
    source: 'SIGNUP_FORM',
    now: '2026-08-11T12:00:00.000Z',
  });

  assert.throws(
    () =>
      grantConsent(existing, {
        userId: 'usr_1',
        purpose: 'account_terms',
        version: 2,
        source: 'API',
        now: '2026-08-12T12:00:00.000Z',
      }),
    NonMonotonicConsentVersionError,
  );
});

test('grantConsent accepts a re-grant with a strictly increasing version', () => {
  const existing = grantConsent(undefined, {
    userId: 'usr_1',
    purpose: 'account_terms',
    version: 1,
    source: 'SIGNUP_FORM',
    now: '2026-08-11T12:00:00.000Z',
  });

  const updated = grantConsent(existing, {
    userId: 'usr_1',
    purpose: 'account_terms',
    version: 2,
    source: 'API',
    now: '2026-08-12T12:00:00.000Z',
  });

  assert.equal(updated.version, 2);
});
