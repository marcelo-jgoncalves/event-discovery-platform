import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type { ConsentRecord, UserProfile } from '../domain/types.ts';

// UsersTable - spec-identity.md §4. PK/SK only, no GSI (no known access
// pattern needs one yet). Never reads/writes anything PII-shaped: this file
// only ever sees userId (opaque Cognito sub) and non-PII attributes.

function profileKey(userId: string) {
  return { PK: `USER#${userId}`, SK: 'PROFILE' };
}

function consentKey(userId: string, purpose: string) {
  return { PK: `USER#${userId}`, SK: `CONSENT#${purpose}` };
}

export class UsersTableRepository {
  private readonly doc: DynamoDBDocumentClient;

  constructor(
    private readonly tableName: string,
    client: DynamoDBClient = new DynamoDBClient({}),
  ) {
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async putProfile(profile: UserProfile): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...profileKey(profile.userId), ...profile },
      }),
    );
  }

  async getProfile(userId: string): Promise<UserProfile | undefined> {
    const result = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: profileKey(userId) }),
    );
    return result.Item as UserProfile | undefined;
  }

  async putConsent(consent: ConsentRecord): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...consentKey(consent.userId, consent.purpose), ...consent },
      }),
    );
  }

  async getConsent(userId: string, purpose: string): Promise<ConsentRecord | undefined> {
    const result = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: consentKey(userId, purpose) }),
    );
    return result.Item as ConsentRecord | undefined;
  }

  async listConsents(userId: string): Promise<ConsentRecord[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':prefix': 'CONSENT#',
        },
      }),
    );
    return (result.Items ?? []) as ConsentRecord[];
  }
}
