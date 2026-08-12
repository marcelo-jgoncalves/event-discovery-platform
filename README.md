# Event Discovery Platform

Plataforma de descoberta e notificação de filmes e eventos (MVP: Belo Horizonte, canal Telegram).

Estrutura baseada na arquitetura vigente (monorepo modular, sem microservices prematuros). Comece por [`CLAUDE.md`](CLAUDE.md) e por [`docs/architecture/system-overview.md`](docs/architecture/system-overview.md) — ele funciona como **context router**: diz qual conjunto mínimo de documentos ler para cada tipo de tarefa. Não leia os documentos abaixo soltos, sem esse roteamento.

## Sistema de contexto

```
CLAUDE.md                          regras duráveis para qualquer agente (humano ou IA)

docs/
  product/
    vision.md                      objetivo de produto, north star, métricas

  domain/
    glossary.md                    vocabulário canônico do domínio — specs usam
                                    os termos, não os redefinem

  architecture/
    system-overview.md             context router — ordem de leitura, read sets
                                    por tarefa, authority matrix
    architecture.md                ÚNICA arquitetura vigente (normativa)
    spec-dynamodb-access-patterns.md              InterestIndexTable
    spec-notification-delivery.md                 pipeline de entrega Telegram
    history/
      architecture-v1.md           desenho original — histórico, não normativo

  engineering/
    quality-strategy.md            estratégia de qualidade completa (fonte: auditoria
                                    do padrão já validado em produção real)
    standards/
      principles.md                por que as regras existem
      code-conventions.md
      testing-strategy.md
      git-and-review-workflow.md
      resource-naming.md           nomes/tags de todo recurso AWS (DynamoDB,
                                    SQS, Lambda, S3, IAM, CloudWatch)
    decisions/
      README.md                    índice dos ADRs + lifecycle (accepted é imutável;
                                    mudança gera novo ADR que supersede o anterior)
      adr-NNN-*.md
    audits/                        evidência do que foi verificado (vazio até a
                                    primeira auditoria)
    quality-enforcement-system.md  sistema de enforcement independente de IA
                                    (policy-as-code, fitness functions, reality
                                    audits) — ver ADR-011
    quality-rules.md               registry de regras com enforcement real
                                    (nada aspiracional listado aqui)

  backlog.md                       itens adiados por decisão consciente — trigger
                                    referencia o spec/ADR, nunca duplica o valor
  context-strategy.md              o desenho do próprio sistema de contexto (meta)
  api/                             contratos de API (vazio)
  operations/
    phase-0-kickoff-prompt.md      prompt da sessão que criou a fundação
                                    operacional (repo, OIDC/CI Tier A) —
                                    executado em 2026-08-11, registro histórico
  runbooks/                        (vazio)
```

## Sistema de qualidade executável

```
quality/
  policies/       regras executáveis por domínio (vazio — nasce junto com o
                   primeiro código que cada policy protege, ver ADR-011)
  tests/fixtures/  valid/ e invalid/: prova de que cada policy detecta a
                   violação que diz detectar
  audits/          achados de auditoria contra estado real
  scripts/         quality-check.mjs, quality-self-test.mjs, audit-reality.mjs
                   (já verifica branch protection + IAM role via API),
                   audit-project.mjs
```

Comandos: `npm run quality:check`, `npm run quality:self-test`, `npm run audit:reality`, `npm run audit:project`.

## Estrutura de código

```
apps/
  web/                    Next.js
  telegram-webhook/       Handler do bot

services/
  catalog/
  ingestion/
  matching/
  notifications/
  tracking/

connectors/
  ticketmaster/
  tmdb/

packages/
  domain/
  contracts/
  observability/
  config/
  testing/

infrastructure/
  terraform/
```

## Estado atual

Nenhum código de produto implementado ainda (`apps/`, `services/`, `connectors/`, `packages/` seguem vazios) — o que existe é a fundação operacional (Phase 0, concluída em 2026-08-11) e o sistema de contexto (arquitetura, especificações, glossário, ADRs, padrões, estratégia de qualidade), alinhados ao padrão de engenharia auditado no blog (`../auditoria-padrao-qualidade-marcelo-goncalves-blog.md`) e refinados por uma revisão de engenharia de contexto (canonicalidade, context routing, authority matrix — ver `docs/context-strategy.md`).

```text
[x] Repositório: github.com/marcelo-jgoncalves/event-discovery-platform
      (público — branch protection completa exige Pro para repo privado
      em conta pessoal, ver ADR-010)
[x] CI Tier A rodando de verdade em PR/push (typecheck, lint, unit,
      integration-fast, dependency review, npm audit, Semgrep, Gitleaks,
      terraform validate/plan, TFLint, Trivy IaC)
[x] IAM role de CI via OIDC (Terraform), least-privilege, escopada a edp-*
[x] Sistema de enforcement de qualidade independente de IA (esqueleto +
      2 scripts com verificação real: ADR-011)
[x] Phase 1 — Identity: spec-identity.md, ADR-012, Terraform (Cognito +
      UsersTable), services/identity (signup/login), primeira Architecture
      Fitness Function e primeira Semgrep custom rule (EDP004) com fixture
      comprovada — ver docs/backlog.md "Phase 1 — Identity"
[ ] Phase 2 (Catalog) — próximo passo em aberto
```

Checklist de bootstrap completo (o que falta e por quê): `docs/engineering/quality-strategy.md` §15 e `docs/backlog.md`.
