# ADRs — Índice

Baseline consolidado: ADRs agrupam decisões que mudam junto com o mesmo componente, em vez de um ADR por detalhe interno de spec (ver `../quality-strategy.md` §8.1). O conteúdo de cada ADR é deliberadamente curto e referencia o spec correspondente em vez de duplicá-lo.

## Regra de imutabilidade

Um ADR com status `Accepted` é um **registro histórico** da decisão tomada naquele momento — não um documento vivo que se edita conforme a implementação evolui. Correção editorial (typo, link quebrado) é aceitável; mudança de decisão não é.

```text
Lifecycle: PROPOSED → ACCEPTED → { SUPERSEDED | DEPRECATED | REJECTED }
```

Quando uma decisão aceita precisa mudar:

```text
1. Criar um ADR NOVO com número seguinte.
2. No ADR novo: `Supersedes: ADR-NNN` (o antigo).
3. No ADR antigo: mudar `Status: Superseded`, adicionar
   `Superseded-by: ADR-NNN` (o novo).
4. Nunca reescrever a decisão original in place.
```

Isso preserva não só o estado atual, mas por que o sistema evoluiu daquela forma — informação que se perde se o ADR antigo for editado por cima.

## Índice

| ADR | Título | Status |
|---|---|---|
| [001](adr-001-messaging-topology-sqs-first.md) | Messaging Topology V1 — SQS-first | Accepted |
| [002](adr-002-canonical-entity-identification.md) | Canonical Entity Identification | Accepted |
| [003](adr-003-interest-index-dynamodb-design.md) | Interest Index DynamoDB Design (chave, location-aware matching, projections vs GSI, capacity, consistency, hot-partition trigger) | Accepted |
| [004](adr-004-notification-delivery-semantics-and-provider-throughput.md) | Notification Delivery Semantics and Provider Throughput (prioridade, safe throughput, concorrência, 429, delivery ambíguo, quiet hours) | Accepted |
| [005](adr-005-ai-enrichment-lifecycle.md) | AI Enrichment Lifecycle | Accepted |
| [006](adr-006-provider-abstraction-and-multichannel-boundary.md) | Provider Abstraction and Multi-channel Boundary | Accepted |
| [007](adr-007-idempotency-strategy.md) | Idempotency Strategy | Accepted |
| [008](adr-008-tracking-affiliate-redirect.md) | Tracking and Affiliate Redirect Model | Accepted |
| [009](adr-009-quality-gate-and-exception-policy.md) | Quality Gate and Exception Policy | Accepted |

Novo ADR: copiar `_template.md`, numerar sequencialmente (próximo: 010), criar **antes da implementação do componente afetado** — mas só quando a escolha for cara de reverter, cross-cutting, arquiteturalmente significativa, ou mudar um invariante já registrado. Não criar ADR para rename, endpoint novo isolado, refactor pequeno ou detalhe de implementação — isso é ruído que dilui os ADRs que realmente importam.

Não criar ADR separado para detalhe interno que muda junto com uma decisão já registrada — expandir esse ADR **enquanto ele ainda está `Proposed`**. Depois de `Accepted`, qualquer mudança de decisão é um ADR novo que supersede, nunca uma edição do aceito.
