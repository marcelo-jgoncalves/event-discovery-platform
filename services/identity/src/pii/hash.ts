import { createHash } from 'node:crypto';

// EDP004 (quality-rules.md): raw PII never enters a log. Any code path that
// needs to correlate a PII value in logs/metrics without exposing it hashes
// it first through here - same pattern already decided for chatId in
// spec-notification-delivery.md.
export function hashPII(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}
