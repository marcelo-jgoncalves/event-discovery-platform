import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';

// Only this file talks to raw user PII (email, password) against Cognito -
// spec-identity.md §8 / ADR-012: Cognito is the sole system of record for
// PII, UsersTable never duplicates it. The architecture fitness function
// (quality/policies/architecture) forbids any module outside
// services/identity from importing this file.

export interface SignUpResult {
  userId: string;
}

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

export interface CognitoAuthClient {
  signUp(email: string, password: string): Promise<SignUpResult>;
  confirmSignUp(email: string, confirmationCode: string): Promise<void>;
  login(email: string, password: string): Promise<AuthTokens>;
}

export interface CognitoAuthClientConfig {
  userPoolId: string;
  clientId: string;
  clientSecret: string;
  region: string;
}

// SECRET_HASH is required by Cognito whenever the app client has a secret
// (spec-identity.md §3.3: confidential client, never a public one) - every
// SignUp/InitiateAuth/ConfirmSignUp call must include it or Cognito rejects
// the request with NotAuthorizedException.
async function computeSecretHash(
  username: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', clientSecret)
    .update(username + clientId)
    .digest('base64');
}

export class AwsCognitoAuthClient implements CognitoAuthClient {
  private readonly client: CognitoIdentityProviderClient;
  private readonly config: CognitoAuthClientConfig;

  constructor(config: CognitoAuthClientConfig) {
    this.config = config;
    this.client = new CognitoIdentityProviderClient({ region: config.region });
  }

  async signUp(email: string, password: string): Promise<SignUpResult> {
    const secretHash = await computeSecretHash(
      email,
      this.config.clientId,
      this.config.clientSecret,
    );
    const response = await this.client.send(
      new SignUpCommand({
        ClientId: this.config.clientId,
        SecretHash: secretHash,
        Username: email,
        Password: password,
      }),
    );

    if (!response.UserSub) {
      throw new Error('Cognito SignUp did not return a user sub');
    }

    return { userId: response.UserSub };
  }

  async confirmSignUp(email: string, confirmationCode: string): Promise<void> {
    const secretHash = await computeSecretHash(
      email,
      this.config.clientId,
      this.config.clientSecret,
    );
    await this.client.send(
      new ConfirmSignUpCommand({
        ClientId: this.config.clientId,
        SecretHash: secretHash,
        Username: email,
        ConfirmationCode: confirmationCode,
      }),
    );
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const secretHash = await computeSecretHash(
      email,
      this.config.clientId,
      this.config.clientSecret,
    );
    const response = await this.client.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.config.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
          SECRET_HASH: secretHash,
        },
      }),
    );

    const result = response.AuthenticationResult;
    if (!result?.AccessToken || !result.IdToken || !result.RefreshToken) {
      throw new Error('Cognito InitiateAuth did not return a complete token set');
    }

    return {
      accessToken: result.AccessToken,
      idToken: result.IdToken,
      refreshToken: result.RefreshToken,
    };
  }
}
