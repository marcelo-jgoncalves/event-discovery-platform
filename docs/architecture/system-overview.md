---
status: active
owner: architecture
authority: normative
---

# System Overview — Context Router

Não é fonte de verdade de nada — é o mapa que diz onde a verdade vive e qual subconjunto mínimo de contexto carregar para cada tipo de tarefa. Se este documento e um spec divergirem, o spec vence e este documento está desatualizado (corrija-o).

## Leitura completa (uma vez, ao entrar no projeto)

```text
1. docs/product/vision.md              — o que estamos construindo e por quê
2. docs/domain/glossary.md             — vocabulário canônico do domínio
3. architecture.md                     — arquitetura vigente (única, normativa)
4. spec-identity.md                    — desenho concreto de Identity (Phase 1)
5. spec-catalog.md                     — desenho concreto de Catalog (Phase 2)
6. spec-dynamodb-access-patterns.md    — hot path de matching
7. spec-notification-delivery.md       — hot path de delivery
8. docs/engineering/decisions/         — ADRs (histórico de decisões aceitas)
9. docs/engineering/quality-strategy.md — o que "qualidade" significa aqui
```

`history/architecture-v1.md` é opcional — só vale a pena ler para entender *como* o desenho chegou ao estado atual, nunca como fonte do estado atual.

## Context routing — read sets por tipo de tarefa

Não carregar tudo em `docs/` para toda tarefa. Carregar o mínimo abaixo, na ordem listada; se a tarefa exigir mais, subir de nível deliberadamente, não por hábito.

```text
Implementar feature
  1. CLAUDE.md
  2. item relevante do backlog
  3. spec relevante
  4. ADR aceito relevante
  5. testing-strategy.md
  6. código sendo modificado

Alterar arquitetura
  1. CLAUDE.md
  2. docs/product/vision.md
  3. architecture.md
  4. specs relevantes
  5. ADRs relevantes
  6. quality-strategy.md

Corrigir bug
  1. CLAUDE.md
  2. spec relevante
  3. código real + testes
  4. última auditoria relevante (docs/engineering/audits/)
  5. runbook, se for operacional

Trabalhar no matcher (DynamoDB)
  1. CLAUDE.md
  2. docs/domain/glossary.md
  3. architecture.md
  4. spec-dynamodb-access-patterns.md
  5. ADR-003
  6. testing-strategy.md
  7. código real

Trabalhar no dispatcher de notificação
  1. CLAUDE.md
  2. docs/domain/glossary.md
  3. architecture.md
  4. spec-notification-delivery.md
  5. ADR-004
  6. testing-strategy.md
  7. código real

Registrar/revisar decisão de qualidade (CI, gates, exceção)
  1. CLAUDE.md
  2. quality-strategy.md
  3. ADR-009
  4. docs/engineering/quality-rules.md (regras com enforcement real)
  5. docs/engineering/quality-enforcement-system.md + ADR-011, se a
     mudança envolver um novo mecanismo de enforcement (não só um gate
     dentro de um mecanismo já existente)

Rodar/participar de uma revisão conjunta Claude↔Codex (eixo novo ou rodada)
  1. CLAUDE.md
  2. AGENTS.md §2 e §2.1 (protocolo de debate, nota cega, procedimento
     por eixo) e §3 (invocação do Codex CLI)
  3. docs/engineering/standards/joint-review-criteria.md (critérios do
     eixo — não redefinir se já convergido)
  4. último audit doc fechado do mesmo eixo, se houver rodada anterior

Criar/alterar infraestrutura (Terraform, novo recurso AWS)
  1. CLAUDE.md
  2. spec relevante (nome lógico do recurso)
  3. docs/engineering/standards/resource-naming.md
  4. quality-strategy.md §7 (IaC)
  5. ADR relevante, se a mudança for arquiteturalmente significativa
```

## Authority Matrix

Cada pergunta tem uma fonte única. Quando duas fontes parecerem responder a mesma pergunta de forma diferente, é sinal de **drift** — não escolher um vencedor silenciosamente, registrar o drift (ver seção abaixo).

| Pergunta | Fonte |
|---|---|
| O que queremos construir? | `docs/product/vision.md` |
| O que os termos significam? | `docs/domain/glossary.md` |
| Como deveria funcionar? | `architecture.md` + specs ativos |
| Por que escolhemos assim? | ADR aceito relevante |
| Que qualidade é exigida? | `docs/engineering/quality-strategy.md` |
| Como está implementado (intenção)? | código-fonte / Terraform |
| O que está realmente rodando? | AWS/API/CLI — verificado ao vivo |
| O que falta fazer? | `docs/backlog.md` |
| O que já foi validado, e quando? | `docs/engineering/audits/` |

## Protocolo de drift

Drift = a intenção documentada (spec/ADR) e a realidade (código, Terraform, o que está de fato implantado na AWS) divergem. Isso é esperado ao longo do tempo — o erro não é o drift acontecer, é ele passar despercebido.

```text
1. Não corrigir silenciosamente escolhendo uma das duas como "a verdade".
2. Registrar o drift explicitamente: onde diverge, desde quando (se souber),
   impacto.
3. Decidir e registrar uma de duas saídas:
   a. a realidade estava certa → atualizar o spec/ADR (ADR novo se for
      decisão significativa, edição direta se for spec desatualizado)
   b. a intenção estava certa → corrigir a implementação
4. Auditoria de consistência (docs/engineering/quality-strategy.md §9) é
   o mecanismo periódico para encontrar drift que ninguém reportou.
```

## Subsistemas e onde cada um está especificado

```text
Identity (Cognito, UsersTable) → spec-identity.md, ADR-012
Ingestion / Connectors        → spec-catalog.md, architecture.md, history/architecture-v1.md §7-9
Catalog (CatalogTable)        → spec-catalog.md, ADR-013
Canonical model / Entity
  Resolution                  → docs/domain/glossary.md, ADR-002, spec-catalog.md
Matching (InterestIndexTable) → spec-dynamodb-access-patterns.md, ADR-003
Notification delivery         → spec-notification-delivery.md, ADR-004
Messaging topology            → architecture.md §2, ADR-001
AI enrichment                 → architecture.md §9, ADR-005
Provider abstraction          → ADR-006
Idempotency                   → ADR-007
Tracking/afiliados            → ADR-008
Quality gates / exceções      → quality-strategy.md §1.1-1.2, §10.3, ADR-009
Enforcement independente de
  IA (policy-as-code, fitness
  functions, reality audits)  → quality-enforcement-system.md, quality-rules.md, ADR-011
Resource naming / tagging     → docs/engineering/standards/resource-naming.md
```

## Contexto efêmero — o que nunca vira documento canônico

Ver `../../CLAUDE.md` §"Contexto efêmero" para a regra completa. Resumo: raciocínio intermediário, notas de investigação pontual, planos de implementação temporários e resumos que já são representados em outro lugar não se tornam arquivo em `docs/`. Só o resultado durável é promovido: decisão → ADR, desenho → spec, trabalho adiado → backlog, regra → standard, fato de domínio → glossary. Não documentar também pode ser a decisão correta.
