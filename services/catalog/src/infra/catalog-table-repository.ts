import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import type { CanonicalEvent, CanonicalWork } from '../domain/types.ts';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

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

  // Work + WORKTITLE# companion item commit atomically (ADR-013 — no GSI,
  // so the title index is a second item on the same table that must never
  // be observable out of sync with the metadata item it indexes). If the
  // normalized title changed since the last write, the previous WORKTITLE#
  // entry is deleted in the same transaction — otherwise findWorksByNormalizedTitle
  // would keep returning this work under a title it no longer has.
  async putWork(work: CanonicalWork): Promise<void> {
    const existing = await this.getWork(work.canonicalId);
    const createdAt = existing?.createdAt ?? work.createdAt;
    const item = { ...work, createdAt };

    const transactItems: TransactItem[] = [
      {
        Put: {
          TableName: this.tableName,
          Item: { ...workKey(work.canonicalId), ...item },
        },
      },
      {
        Put: {
          TableName: this.tableName,
          Item: { ...titleIndexKey(work.normalizedTitle, work.canonicalId), ...item },
        },
      },
    ];

    if (existing && existing.normalizedTitle !== work.normalizedTitle) {
      transactItems.push({
        Delete: {
          TableName: this.tableName,
          Key: titleIndexKey(existing.normalizedTitle, work.canonicalId),
        },
      });
    }

    await this.doc.send(new TransactWriteCommand({ TransactItems: transactItems }));
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

  // Event + REVIEW#UNRESOLVED companion item (when applicable) commit
  // atomically for the same reason as putWork. If re-ingestion resolves an
  // event that was previously UNRESOLVED, the stale review-queue entry is
  // deleted in the same transaction — otherwise listUnresolvedEvents would
  // keep surfacing an event that no longer needs manual review.
  async putEvent(event: CanonicalEvent): Promise<void> {
    const existing = await this.getEvent(event.canonicalId);
    const createdAt = existing?.createdAt ?? event.createdAt;
    const item = { ...event, createdAt };

    const transactItems: TransactItem[] = [
      {
        Put: {
          TableName: this.tableName,
          Item: { ...eventKey(event.canonicalId), ...item },
        },
      },
    ];

    const wasUnresolved = existing?.resolutionStatus === 'UNRESOLVED';
    const isUnresolved = event.resolutionStatus === 'UNRESOLVED';

    if (isUnresolved) {
      transactItems.push({
        Put: {
          TableName: this.tableName,
          Item: { ...reviewQueueKey(event.canonicalId), eventCanonicalId: event.canonicalId },
        },
      });
    } else if (wasUnresolved) {
      transactItems.push({
        Delete: {
          TableName: this.tableName,
          Key: reviewQueueKey(event.canonicalId),
        },
      });
    }

    await this.doc.send(new TransactWriteCommand({ TransactItems: transactItems }));
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
