---
status: accepted
date: 2026-08-11
supersedes: []
---

# ADR-005 — AI Enrichment Lifecycle

Status: Accepted

## Contexto

IA nunca pode estar no caminho crítico de disponibilidade do catálogo ou da notificação. Detalhe: `../../architecture/architecture.md` §9.

## Decisão

`EnrichmentStatus` explícito (`NOT_REQUIRED`, `PENDING`, `COMPLETED`, `FAILED`, `EXPIRED`). Normalização determinística marca o evento como `READY` independente do enrichment. Enrichment roda em paralelo, assíncrono, com deadline/TTL — se exceder, vira `EXPIRED` e o sistema segue com dados determinísticos. Trigger de enrichment é seletivo (categoria ausente, relação ambígua, classificação de baixa confiança), não automático para todo evento.

## Alternativas consideradas

Fluxo síncrono `evento → LLM → notificação` — rejeitado: se o modelo falhar, o produto para.

## Consequências

Relevância pode ser ligeiramente menor sem enrichment, mas disponibilidade do produto nunca depende de IA.

## Trigger de revisão

Nenhum — princípio estrutural, não placeholder temporário.
