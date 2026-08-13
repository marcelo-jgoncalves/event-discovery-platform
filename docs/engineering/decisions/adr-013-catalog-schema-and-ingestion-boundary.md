---
status: accepted
date: 2026-08-12
supersedes: []
---

# ADR-013 — Catalog Schema and Ingestion Boundary

Status: Accepted

## Contexto

Phase 2 (Catalog) is the first phase to write real `CatalogTable` schema and the first real connector code (TMDB, Ticketmaster). `architecture.md` §5 only listed `CatalogTable` as one of five candidate tables in passing; ADR-002 and ADR-006 already settled the canonical-model and provider-abstraction *shape* but not the concrete DynamoDB key schema, the composite entity-resolution rule, or where the review queue for `UNRESOLVED` items lives. Those are expensive to change once real catalog data exists (CLAUDE.md Nível 6 — architecture.md §17 "canonical IDs" is explicitly listed as a decision to resolve early). Detail: `../../architecture/spec-catalog.md`.

## Decisão

1. **Two item types in one `CatalogTable`**, no GSI yet: `PK=WORK#<namespace>:<id>, SK=METADATA` (movies, from TMDB) and `PK=EVENT#<namespace>:<id>, SK=METADATA` (sessions/shows, from Ticketmaster) — same table (architecture.md §5: no GSI/table premium without an access pattern that needs it), canonical ID format exactly as ADR-002 (`<TYPE>#<namespace>:<id>`).
2. **Title-lookup index as a companion item, not a GSI**: every `Work` also writes `PK=WORKTITLE#<normalizedTitle>, SK=WORK#<namespace>:<id>`. This is the level-2 composite rule from ADR-002 (link a Ticketmaster "Film" category event to its TMDB `Work` by exact normalized-title match) — implemented as a `Query` on the existing primary key, not a new index, because GSIs are cheap to add later (architecture.md §18) and no access pattern yet needs fuzzy/ranged title search.
3. **Review queue as a companion item, not a GSI**: unresolved events additionally write `PK=REVIEW#UNRESOLVED, SK=EVENT#<namespace>:<id>`. Consuming/clearing this queue is Phase 3+ (out of this session's scope) but the write-side contract is decided now so it never needs a migration later.
4. **Ingestion queue**: one SQS queue (`edp-{env}-ingestion`) shared by both providers, carrying `RawSourceEvent` envelopes tagged with `source`; normalization dispatches on `source` rather than using per-provider queues — no evidence yet of a reason to isolate providers at the queue level (architecture.md §18 principle: sharding is cheap to add later, not resolved now).
5. **Connector boundary**: `connectors/tmdb` and `connectors/ticketmaster` are the only modules allowed to call the provider's HTTP API directly (ADR-006). Shared connector types (`ProviderConnector`, `RawSourceEvent`) live in a new `packages/provider-contracts` package — zero runtime dependencies, imported by both connectors and `services/catalog`, so `services/catalog` never imports a connector's internals, only the shared contract types.

## Alternativas consideradas

Full GSI-based `StatusIndex`/`TitleIndex` from day one — rejected, same reasoning as `spec-identity.md` §4.2 (no GSI without a known access pattern that scan/primary-key can't serve; a companion item is enough for the one query each pattern needs today). Separate `IngestionTable`/DLQ-per-provider SQS queues — rejected, no volume/isolation evidence yet (architecture.md §5 "not a table/queue per entity by default").

## Consequências

Cross-provider matching (TMDB Work ↔ Ticketmaster Film event) works for the one case that exists today (exact normalized-title match) without committing to fuzzy/AI resolution. Adding a real GSI later (e.g., ranged title search) is additive, not a migration, because the primary key shape does not change. The review queue has no consumer yet — `UNRESOLVED` items accumulate in `REVIEW#UNRESOLVED` until Phase 3+ builds the consumer (tracked in `docs/backlog.md`).

## Trigger de revisão

Volume real of `REVIEW#UNRESOLVED` items, or a second data source needing entity resolution beyond exact normalized-title match — same trigger already defined in ADR-002 §"Trigger de revisão", now applied concretely to this schema.
