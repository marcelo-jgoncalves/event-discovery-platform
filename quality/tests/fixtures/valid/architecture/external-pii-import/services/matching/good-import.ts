// VALID fixture: services/matching only ever sees the opaque userId, never
// the PII module — this must NOT trigger no-external-pii-import.mjs.
import type { UserProfile } from '../../identity/src/domain/types.ts';

export function describeUser(profile: UserProfile) {
  return `${profile.userId}: ${profile.status}`;
}
