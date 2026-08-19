---
status: active
owner: architecture
authority: normative
---

# Revisão conjunta de arquitetura — Claude ↔ Codex (2026-08-19)

Primeira aplicação do protocolo de debate Claude↔Codex (`AGENTS.md` §2), disparada pelo próprio trigger que o backlog já previa para a criação do `AGENTS.md`: Codex CLI passou a atuar como segundo revisor de arquitetura, independente.

## Metodologia

1. Claude pesquisou na web (ISO/IEC 25010, AWS Well-Architected, ATAM) e definiu um rascunho de critérios de avaliação, sem mostrar ao Codex.
2. Codex, independentemente e sem ver o rascunho de Claude, definiu seu próprio rascunho de critérios a partir do mesmo tipo de fontes.
3. Os dois rascunhos convergiram fortemente (mesma base ISO 25010/AWS/ATAM, pesos parecidos); uma rodada de negociação produziu os 11 critérios finais abaixo, com peso somando 100%.
4. Cada agente leu o repositório real (specs, ADRs, backlog, Terraform, código) e pontuou (0-10) cada critério independentemente, **antes de ver a nota do outro** (protocolo de nota cega, mesma regra do `AGENTS.md` §2).
5. Após comparar as notas da Rodada 1, correções concretas foram implementadas (não apenas "consenso de nota") e o processo repetiu por mais duas rodadas.

## Critérios finais (peso, 0-10 por critério)

| # | Critério | Peso |
|---|---|---:|
| 1 | Domain Fit & Simplicity | 11% |
| 2 | Reliability & Fault Recovery | 13% |
| 3 | Event & Integration Correctness | 10% |
| 4 | Data Model & Consistency | 10% |
| 5 | Security & Privacy | 11% |
| 6 | Modifiability & Evolvability | 9% |
| 7 | Observability & Operability | 9% |
| 8 | Testability & Delivery Safety | 8% |
| 9 | Cost & Resource Governance | 6% |
| 10 | Performance & Scalability Fitness | 5% |
| 11 | Architecture Governance & Traceability | 8% |

## Rodada 1 — nota cega

| Critério | Claude | Codex |
|---|---:|---:|
| Domain Fit & Simplicity | 9.0 | 9.0 |
| Reliability & Fault Recovery | 6.5 | 7.1 |
| Event & Integration Correctness | 7.0 | 7.4 |
| Data Model & Consistency | 8.5 | 7.3 |
| Security & Privacy | 6.5 | 7.6 |
| Modifiability & Evolvability | 8.0 | 8.8 |
| Observability & Operability | 5.5 | 6.7 |
| Testability & Delivery Safety | 7.0 | 7.3 |
| Cost & Resource Governance | 5.0 | 7.8 |
| Performance & Scalability Fitness | 8.0 | 8.1 |
| Architecture Governance & Traceability | 9.5 | 8.1 |
| **Total ponderado** | **7.3** | **7.7** |

Convergência forte (nenhum gap por critério exigiu rodada formal de desacordo do protocolo de nota 9). Diferença mais relevante: Codex leu o **código real** (não só specs) e achou bugs concretos que a leitura de Claude, baseada mais em specs/ADRs, não capturou — escritas não-atômicas, validação por type-cast, bug de `startAt`, publicação de evento via `console.log` sem outbox.

## Achados da Rodada 1 e correções aplicadas

1. **Escritas não-atômicas** — signup (Cognito+profile+consent) e catalog (Work+WORKTITLE#, Event+REVIEW#UNRESOLVED) usavam `PutCommand`s separados. Corrigido: `TransactWriteItems` em `users-table-repository.ts` e `catalog-table-repository.ts`, com limpeza de item companion obsoleto (mudança de título/resolução) e preservação de `createdAt` original em re-ingestão.
2. **Validação por type-cast** — `tmdb-normalizer.ts`/`ticketmaster-normalizer.ts` faziam `raw.payload as X` sem validar em runtime. Corrigido: schemas Zod nos dois, incluindo rejeição de `dates.start.dateTime` ausente ou não-parseável (bug real: um valor ausente virava silenciosamente `now()`, corrompendo o horário real do evento).
3. **Scan de segurança duplicado** — `security.yml` tinha trigger `pull_request` próprio além de ser chamado via `workflow_call` por `ci.yml`, rodando Semgrep/Gitleaks duas vezes por PR. Corrigido: removido o trigger `pull_request` standalone.
4. **`required_status_checks` ausente** (PCA-20260812-001, já era o achado mais severo do threat model de 2026-08-12) — corrigido, confirmado ao vivo via `gh api`: 7 checks Tier A agora obrigatórios em `main`, `strict: true`. Decisão de Marcelo (item já registrado como exigindo decisão humana).
5. **Dois drifts de documentação** já flagrados pela auditoria de 2026-08-12 e não corrigidos até então: `backlog.md` afirmando "nenhum código de produto implementado" (desatualizado desde a Phase 1) e `system-overview.md` não referenciando `spec-identity.md`/`spec-catalog.md` na tabela de subsistemas (PCA-20260812-003). Ambos corrigidos.

## Rodada 2 — nota cega (após os 5 itens acima)

Codex: **8.1/10**. Achado novo, não visto por Claude: nenhuma das duas policies IAM (`identity`/`catalog`) concedia `dynamodb:TransactWriteItems` — os writes transacionais recém-implementados falhariam com `AccessDenied` em um ambiente real. Corrigido no mesmo dia (`terraform validate` limpo).

## Rodada 3 — nota cega (após o fix de IAM + validação de timezone do `dateTime`)

Codex: **8.3/10**. Claude, reavaliando de forma independente com a mesma régua: **~8.0/10**. Nota conjunta final: **~8.2/10**.

## Por que a revisão parou em ~8.2, não em 9

Os dois maiores gaps ponderados restantes — Observability & Operability (6.7/10) e a race condition read-then-transact em `putWork`/`putEvent` — foram avaliados **independentemente por Claude e por Codex**, que chegaram à mesma conclusão: implementar agora seria contraproducente.

- **Observability**: não há ambiente AWS implantado, não há worker de ingestão rodando, e não existe canal de notificação operacional decidido (SNS/e-mail/Telegram-para-Marcelo). Um alarme CloudWatch sem destinatário e sem workload real gerando falhas é infraestrutura de fachada — o próprio Codex recomendou explicitamente não criá-la só para subir a nota.
- **OCC (concorrência otimista)**: risco real (SQS é ao menos-uma-vez), mas sem worker de ingestão implantado não há concorrência real observada hoje. Adicionar um contador de versão agora, sem antes decidir semântica de "qual observação vence" (revisão do provider vs. `fetchedAt`), resolveria menos do que parece.

Ambos os itens foram registrados em `docs/backlog.md` §"Dívida técnica conhecida" com trigger explícito de quando resolver (primeiro ambiente dev implantado; início dos testes de carga/falha da Phase 3) — decisão consciente de escopo, não pendência esquecida, seguindo o mesmo protocolo de honestidade sobre dívida técnica que o resto do projeto já usa.

## Verificação

Todas as correções de código desta revisão passaram por `npm run verify` (typecheck+lint+test) e `npm run quality:check` (fitness functions) localmente, e `terraform validate`/`terraform fmt -check` para as mudanças de Terraform. Os novos testes de integração (`catalog-table-repository.integration.test.ts`, `users-table-repository.integration.test.ts`) não puderam ser executados neste ambiente por falta de Docker — mesma limitação já registrada desde a Phase 1 — e rodam no mesmo padrão que já existe no CI (`integration-fast`).
