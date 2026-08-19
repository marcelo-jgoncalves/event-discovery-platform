import { z } from 'zod';
import { grantConsent } from '../domain/consent.ts';
import type { UserProfile } from '../domain/types.ts';
import type { UsersTableRepository } from '../infra/users-table-repository.ts';
import type { CognitoAuthClient } from '../pii/cognito-client.ts';

// code-conventions.md: every external boundary (HTTP body here) validates
// with a schema before it's trusted as domain input.
const signupInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
});

export type SignupInput = z.infer<typeof signupInputSchema>;

export interface SignupResult {
  userId: string;
}

const ACCOUNT_TERMS_CONSENT_VERSION = 1;

export async function signup(
  input: SignupInput,
  deps: { cognito: CognitoAuthClient; usersTable: UsersTableRepository; now: () => string },
): Promise<SignupResult> {
  const parsed = signupInputSchema.parse(input);

  const { userId } = await deps.cognito.signUp(parsed.email, parsed.password);
  const now = deps.now();

  const profile: UserProfile = {
    userId,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    preferences: {},
  };

  const consent = grantConsent(undefined, {
    userId,
    purpose: 'account_terms',
    version: ACCOUNT_TERMS_CONSENT_VERSION,
    source: 'SIGNUP_FORM',
    now,
  });

  // Cognito is the system of record for the account itself, UsersTable for
  // profile+consent (ADR-012) — the two can't commit in one transaction
  // across services. If the DynamoDB write fails after Cognito already
  // created the account, compensate by deleting the orphaned Cognito user
  // instead of leaving an account with no profile/consent that a retried
  // signup can never recreate (UsernameExistsException).
  try {
    await deps.usersTable.putProfileAndConsent(profile, consent);
  } catch (err) {
    // Best-effort: the original DynamoDB failure is the one the caller
    // needs to see and retry on, not a secondary Cognito cleanup failure —
    // but a failed cleanup leaves an orphaned Cognito account that nothing
    // else will ever detect, so it must be observable somewhere. Logs
    // userId (opaque Cognito sub), never the email (EDP004 — no raw PII in
    // logs, code-conventions.md).
    await deps.cognito.deleteUser(parsed.email).catch((cleanupErr: unknown) => {
      console.error(
        JSON.stringify({
          event: 'signup.compensation_failed',
          userId,
          reason: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        }),
      );
    });
    throw err;
  }

  return { userId };
}
