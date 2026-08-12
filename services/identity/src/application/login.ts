import { z } from 'zod';
import type { AuthTokens, CognitoAuthClient } from '../pii/cognito-client.ts';

const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export async function login(
  input: LoginInput,
  deps: { cognito: CognitoAuthClient },
): Promise<AuthTokens> {
  const parsed = loginInputSchema.parse(input);
  return deps.cognito.login(parsed.email, parsed.password);
}
