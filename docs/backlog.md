# Backlog

Itens conhecidos e deliberadamente adiados, com dono/critério de reavaliação — não escondidos. Ver `docs/engineering/quality-strategy.md` §12 (política de honestidade sobre dívida técnica).

## Phase 0 — Foundations (2026-08-11): concluído

Ver `docs/operations/phase-0-kickoff-prompt.md` e ADR-010 para o registro completo das decisões tomadas.

```text
[x] Repositório Git inicializado, repositório GitHub criado
      (marcelo-jgoncalves/event-discovery-platform, público — ver ADR-010 §3)
[x] Branch protection em main confirmada via API (enforce_admins,
      required_pull_request_reviews com required_approving_review_count=0
      — projeto solo, ver ADR-010 §4 —, no force-push, no deletion,
      conversation resolution obrigatória)
[x] OIDC Provider do GitHub reaproveitado (conta 975707451904, já existia
      do projeto marcelo-goncalves-blog)
[x] IAM role edp-dev-role-cicd-github-actions criada via Terraform
      (infrastructure/terraform/modules/iam-github-oidc/), trust policy
      corrigida para a claim real do GitHub (ADR-010 §2)
[x] Policy de CI escopada a edp-* + state bucket, sem Resource: "*",
      sem permissão de apply de produto ainda
[x] Pipeline Tier A rodando de verdade em PR/push (.github/workflows/
      ci.yml, security.yml): typecheck, lint, format:check, unit,
      integration-fast (DynamoDB Local), dependency review, npm audit,
      Semgrep, Gitleaks, terraform validate+plan, TFLint, Trivy IaC —
      todos os 9 checks verdes, confirmado ao vivo via gh run view
[x] Actions pinadas por SHA, npm ci (nunca npm install), Node 24 pinado
      (.nvmrc + engine-strict)
```

## Bootstrap pendente (ver `docs/engineering/quality-strategy.md` §13)

Explicitamente fora do escopo da Phase 0 (`docs/operations/phase-0-kickoff-prompt.md` §5) — depende de ambiente dev implantado, que ainda não existe.

```text
[ ] Tier B (integration-aws-real, E2E, smoke, validação IAM real,
      DAST baseline) — depende de ambiente dev implantado
[ ] Tier C (scale, failure, DAST completo, restore drill) — depende de Tier B
[ ] CD real (terraform apply automático de recursos de produto) — decisão
      arquiteturalmente significativa, merece ADR próprio quando chegar
      (ver ADR-010, trigger de revisão)
[ ] CloudTrail + GuardDuty no primeiro ambiente AWS
[ ] Formalizar os ADRs consolidados just-in-time, antes da implementação
      do componente afetado (docs/engineering/decisions/) — ADR-001 a
      ADR-009 continuam pendentes de criação; ADR-010 já existe
[ ] Testes de regra de negócio crítica (quality-strategy.md §3) como
      primeiro E2E
[ ] Dashboards de SLO (Match/Delivery Latency, queue age) antes do
      primeiro usuário real
[ ] Política de retenção de dados/consentimento documentada antes de
      armazenar o primeiro dado de usuário real
[ ] Implementar Data Quality invariants + métricas (quality-strategy.md §5.4)
      antes do primeiro evento real poder ficar READY
[ ] Habilitar Dependabot security updates (Dependency Review já está
      ativo no Tier A; falta o bot de atualização automática)
[ ] Adicionar DAST Tier B e threat model inicial antes do primeiro beta
[ ] Adicionar axe/Playwright para fluxos críticos do frontend
[ ] Executar primeiro restore drill antes de considerar backup "validado"
[ ] Definir política de exceções de qualidade com owner + expiry (ADR-009)
```

## Engenharia de contexto — P1/P2 adiados conscientemente

Ver `docs/engineering/audits/2026-08-11-revisao-estrategia-contexto.md` (P0 já aplicado) e `docs/context-strategy.md` §12.

```text
[ ] Metadata YAML (status/owner/authority) em todos os documentos de
      docs/, não só nos normativos centrais já cobertos
[ ] npm run context:check — links quebrados, índice de ADR ↔ arquivos,
      doc ativo referenciando arquivo superseded, backlog trigger resolve
[ ] Lifecycle explícito de docs/engineering/audits/ (quando um achado de
      auditoria é considerado resolvido/arquivado)
[ ] Definir trigger numérico de migração de docs/backlog.md para issue
      tracker (equipe/itens simultâneos acima de N)
[ ] AGENTS.md como contrato agnóstico de IA, com CLAUDE.md como adapter —
      só se/quando múltiplos agentes de IA passarem a trabalhar no projeto
```

## Fora do MVP por decisão consciente (não implementar sem trigger)

Regra: o valor do trigger (número, condição) vive uma vez, no spec ou ADR. Esta lista referencia onde o trigger está definido — nunca repete o valor aqui. Se o valor mudar no spec/ADR, esta lista não precisa mudar.

```text
EventBridge como domain bus central          → trigger: ADR-001
Entity resolution fuzzy/IA                    → trigger: ADR-002
Sharding de partição DynamoDB                 → trigger: ADR-003
Contador de assinantes síncrono               → trigger: spec-dynamodb §32
Telegram Paid Broadcasts / multi-bot          → trigger: ADR-004
Scheduler de fairness estrita entre filas     → trigger: ADR-004
FIFO por usuário                              → trigger: ADR-004
Multi-região, cell architecture, OpenSearch,
  DAX, Global Tables                          → trigger: nenhum definido ainda,
                                                  requer evidência de escala real
Auto-tuning de rate limit                     → trigger: ADR-004
WhatsApp, Push, Email                         → trigger: ADR-006 (segundo canal
                                                  com demanda real)
```

## Dívida técnica conhecida

_(vazio — projeto ainda não iniciou implementação. Preencher conforme surgir, seguindo o padrão: item + causa + decisão de adiar + condição de retomada.)_
