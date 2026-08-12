import type { ConsentRecord, ConsentSource } from './types.ts';

// spec-identity.md §5: consent is always a versioned record (purpose,
// version, grantedAt, source) - never a bare boolean. Version must be
// monotonically increasing per purpose so a re-grant can never silently
// downgrade what a user is considered to have accepted.
export class NonMonotonicConsentVersionError extends Error {
  constructor(purpose: string, attempted: number, current: number) {
    super(
      `consent version for purpose "${purpose}" must increase (attempted ${attempted}, current ${current})`,
    );
    this.name = 'NonMonotonicConsentVersionError';
  }
}

export function grantConsent(
  existing: ConsentRecord | undefined,
  input: { userId: string; purpose: string; version: number; source: ConsentSource; now: string },
): ConsentRecord {
  if (existing && input.version <= existing.version) {
    throw new NonMonotonicConsentVersionError(input.purpose, input.version, existing.version);
  }

  return {
    userId: input.userId,
    purpose: input.purpose,
    version: input.version,
    grantedAt: input.now,
    source: input.source,
  };
}
