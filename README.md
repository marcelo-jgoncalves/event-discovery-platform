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
      README.md                    índice dos 9 ADRs + lifecycle (accepted é imutável;
                                    mudança gera novo ADR que supersede o anterior)
      adr-NNN-*.md
    audits/                        evidência do que foi verificado (vazio até a
                                    primeira auditoria)

  backlog.md                       itens adiados por decisão consciente — trigger
                                    referencia o spec/ADR, nunca duplica o valor
  context-strategy.md              o desenho do próprio sistema de contexto (meta)
  api/                             contratos de API (vazio)
  operations/
    phase-0-kickoff-prompt.md      prompt para a sessão que inicia a
                                    implementação (repo, OIDC/CI, Tier A)
  runbooks/                        (vazio)
```

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

Nada implementado ainda — apenas a estrutura de pastas e o sistema de contexto (arquitetura, especificações, glossário, ADRs, padrões, estratégia de qualidade) alinhados ao padrão de engenharia auditado no blog (`../auditoria-padrao-qualidade-marcelo-goncalves-blog.md`) e refinados por uma revisão de engenharia de contexto (canonicalidade, context routing, authority matrix — ver `docs/context-strategy.md`). Próxima sessão: `docs/operations/phase-0-kickoff-prompt.md` (repositório, OIDC/CI Tier A) — depois, checklist de bootstrap completo em `docs/engineering/quality-strategy.md` §13.
