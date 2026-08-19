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
| [010](adr-010-cicd-foundations-oidc-and-ci-tier-a.md) | CI/CD Foundations: GitHub OIDC Role and Tier A Pipeline (Terraform vs CloudFormation, trust policy real do GitHub, repo público, branch protection solo) | Accepted |
| [011](adr-011-independent-quality-enforcement-model.md) | Independent Quality Enforcement Model (regra constitucional: nenhum requisito crítico depende só de IA/review/docs; quatro camadas de enforcement) | Accepted |
| [012](adr-012-identity-cognito-and-userstable-schema.md) | Identity: Cognito Auth Model and UsersTable Schema (Cognito API direta sem Hosted UI, PII nunca duplicada em UsersTable, schema PROFILE/CONSENT, MFA admin adiado com dono/prazo) | Accepted |
| [013](adr-013-catalog-schema-and-ingestion-boundary.md) | Catalog Schema and Ingestion Boundary (CatalogTable WORK/EVENT keys, título como companion item em vez de GSI, review queue de UNRESOLVED, ingestion SQS único, packages/provider-contracts) | Accepted |
| [014](adr-014-cd-pipeline-dev-apply.md) | CD Pipeline: GitHub Actions Applies Dev Infrastructure, Never a Local Machine (nova role IAM de deploy separada da role de CI, trust policy restrita a `cd.yml`+`main`, bootstrap único documentado) | Superseded by 015 |
| [015](adr-015-reuse-ci-role-for-cd-apply.md) | CD Pipeline Reuses the Existing CI Role, Instead of a Second Deploy Role (reverte item 1-2 da ADR-014 por decisão explícita do Marcelo — uma única role IAM cobre plan e apply, mesma trust policy ampla de ADR-010) | Accepted |

Novo ADR: copiar `_template.md`, numerar sequencialmente (próximo: 016), criar **antes da implementação do componente afetado** — mas só quando a escolha for cara de reverter, cross-cutting, arquiteturalmente significativa, ou mudar um invariante já registrado. Não criar ADR para rename, endpoint novo isolado, refactor pequeno ou detalhe de implementação — isso é ruído que dilui os ADRs que realmente importam.

Não criar ADR separado para detalhe interno que muda junto com uma decisão já registrada — expandir esse ADR **enquanto ele ainda está `Proposed`**. Depois de `Accepted`, qualquer mudança de decisão é um ADR novo que supersede, nunca uma edição do aceito.
