import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type { CanonicalEvent, CanonicalWork } from '../domain/types.ts';

// CatalogTable - spec-catalog.md §5 / ADR-013. Work/Event items keyed by
// canonicalId; WORKTITLE#* and REVIEW#UNRESOLVED are companion items on the
// same table (no GSI — architecture.md §18, same reasoning as UsersTable).

const METADATA_SK = 'METADATA';

function workKey(canonicalId: string) {
  return { PK: canonicalId, SK: METADATA_SK };
}

function eventKey(canonicalId: string) {
  return { PK: canonicalId, SK: METADATA_SK };
}

function titleIndexKey(normalizedTitle: string, workCanonicalId: string) {
  return { PK: `WORKTITLE#${normalizedTitle}`, SK: workCanonicalId };
}

function reviewQueueKey(eventCanonicalId: string) {
  return { PK: 'REVIEW#UNRESOLVED', SK: eventCanonicalId };
}

export class CatalogTableRepository {
  private readonly doc: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(tableName: string, client: DynamoDBClient = new DynamoDBClient({})) {
    this.tableName = tableName;
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async putWork(work: CanonicalWork): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...workKey(work.canonicalId), ...work },
      }),
    );
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...titleIndexKey(work.normalizedTitle, work.canonicalId), ...work },
      }),
    );
  }

  async getWork(canonicalId: string): Promise<CanonicalWork | undefined> {
    const result = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: workKey(canonicalId) }),
    );
    return result.Item as CanonicalWork | undefined;
  }

  async findWorksByNormalizedTitle(normalizedTitle: string): Promise<CanonicalWork[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `WORKTITLE#${normalizedTitle}` },
      }),
    );
    return (result.Items ?? []) as CanonicalWork[];
  }

  async putEvent(event: CanonicalEvent): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...eventKey(event.canonicalId), ...event },
      }),
    );

    if (event.resolutionStatus === 'UNRESOLVED') {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { ...reviewQueueKey(event.canonicalId), eventCanonicalId: event.canonicalId },
        }),
      );
    }
  }

  async getEvent(canonicalId: string): Promise<CanonicalEvent | undefined> {
    const result = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: eventKey(canonicalId) }),
    );
    return result.Item as CanonicalEvent | undefined;
  }

  async listUnresolvedEvents(): Promise<string[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': 'REVIEW#UNRESOLVED' },
      }),
    );
    return (result.Items ?? []).map((item) => item.eventCanonicalId as string);
  }
}
