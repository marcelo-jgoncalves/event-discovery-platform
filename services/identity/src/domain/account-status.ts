import type { UserProfile } from './types.ts';

// spec-identity.md §6: DELETING -> ACTIVE is not a supported transition in
// this phase (no reactivation flow exists yet - reopening a deletion
// request is a product decision that hasn't been made, not an oversight).
export class InvalidAccountStatusTransitionError extends Error {
  constructor(from: UserProfile['status'], to: UserProfile['status']) {
    super(`cannot transition account status from ${from} to ${to}`);
    this.name = 'InvalidAccountStatusTransitionError';
  }
}

export function requestAccountDeletion(profile: UserProfile, now: string): UserProfile {
  if (profile.status === 'DELETING') {
    return profile;
  }

  return {
    ...profile,
    status: 'DELETING',
    updatedAt: now,
  };
}

export function reactivateAccount(profile: UserProfile): UserProfile {
  if (profile.status === 'DELETING') {
    throw new InvalidAccountStatusTransitionError('DELETING', 'ACTIVE');
  }

  return profile;
}
