import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
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
  private readonly tableName: string;

  constructor(tableName: string, client: DynamoDBClient = new DynamoDBClient({})) {
    this.tableName = tableName;
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

  // A profile without its founding consent (or vice versa, after a crash
  // between two separate PutCommands) is an invalid account state — signup
  // must not be able to produce it, so both items commit in one transaction.
  async putProfileAndConsent(profile: UserProfile, consent: ConsentRecord): Promise<void> {
    await this.doc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: { ...profileKey(profile.userId), ...profile },
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: { ...consentKey(consent.userId, consent.purpose), ...consent },
            },
          },
        ],
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
