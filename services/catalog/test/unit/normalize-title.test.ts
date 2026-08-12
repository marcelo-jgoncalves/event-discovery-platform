import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeTitle } from '../../src/domain/normalize-title.ts';

test('lowercases and strips diacritics', () => {
  assert.equal(normalizeTitle('Interestelar'), 'interestelar');
  assert.equal(normalizeTitle('Coração Valente'), 'coracao valente');
});

test('strips punctuation and collapses whitespace', () => {
  assert.equal(normalizeTitle('Spider-Man: Homecoming'), 'spiderman homecoming');
  assert.equal(normalizeTitle('  Interstellar   (IMAX)  '), 'interstellar imax');
});

test('two titles that differ only by accent/case normalize equal', () => {
  assert.equal(normalizeTitle('INTERSTELLAR'), normalizeTitle('interstellar'));
});
