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
  await deps.usersTable.putProfile(profile);

  const consent = grantConsent(undefined, {
    userId,
    purpose: 'account_terms',
    version: ACCOUNT_TERMS_CONSENT_VERSION,
    source: 'SIGNUP_FORM',
    now,
  });
  await deps.usersTable.putConsent(consent);

  return { userId };
}
