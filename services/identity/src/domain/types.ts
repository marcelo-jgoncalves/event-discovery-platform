// spec-identity.md §4 - UsersTable never carries raw PII. Every type here is
// safe to import from anywhere in the monorepo; PII-bearing values only
// exist behind src/pii (see ADR-012 Consequences).

export type AccountStatus = 'ACTIVE' | 'DELETING';

export type ConsentSource = 'SIGNUP_FORM' | 'API' | 'TELEGRAM_BOT';

export interface UserProfile {
  userId: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  preferences: Record<string, never>;
}

export interface ConsentRecord {
  userId: string;
  purpose: string;
  version: number;
  grantedAt: string;
  source: ConsentSource;
}
