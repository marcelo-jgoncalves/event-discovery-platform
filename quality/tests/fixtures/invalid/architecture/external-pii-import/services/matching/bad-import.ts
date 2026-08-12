// INVALID fixture (quality-enforcement-system.md §6-7): services/matching
// must never import services/identity/src/pii — this is the exact
// violation no-external-pii-import.mjs must detect.
import { hashPII } from '../../identity/src/pii/hash.ts';

export function debugLog(email: string) {
  console.log(hashPII(email));
}
