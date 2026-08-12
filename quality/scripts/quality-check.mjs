#!/usr/bin/env node
// Runs every registered policy check under quality/policies/. Currently
// empty (ADR-011: policies are added when the code they protect exists,
// never ahead of it) — this prints that honestly instead of pretending to
// have checked something. Once the first policy lands, wire its runner in
// here rather than leaving this a permanent no-op.
console.log('[quality-check] no policies registered yet under quality/policies/ — 0 to run.');
console.log(
  '[quality-check] see docs/engineering/quality-rules.md for rules with real enforcement today (CI-level, not here).',
);
process.exit(0);
