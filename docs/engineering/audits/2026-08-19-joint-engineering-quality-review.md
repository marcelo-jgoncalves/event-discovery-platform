---
status: active
owner: engineering
authority: normative
---

# Revisão conjunta de qualidade de engenharia — Claude ↔ Codex (2026-08-19)

Segunda aplicação do protocolo de debate Claude↔Codex (`AGENTS.md` §2), sobre um eixo distinto do já fechado em `docs/engineering/audits/2026-08-19-joint-architecture-review.md` (arquitetura, ~8.2/10): esta revisão avalia **qualidade de engenharia** — craft de código, disciplina de testes, rigor de CI, tooling, disciplina de documentação/processo e gestão de dívida técnica. Não redecide nada de design de sistema; não repete achados da revisão de arquitetura.

## Metodologia

Critérios (12, pesos somando 100%) já convergidos antes desta sessão — ver `NEXT_SESSION_PROMPT.md` para o processo de definição — e usados aqui verbatim, sem reabertura:

| # | Critério | Peso |
|---:|---|---:|
| 1 | Code Correctness & Defensive Design | 11% |
| 2 | Test Effectiveness & Coverage Discipline | 14% |
| 3 | CI Quality Gates & Merge Safety | 11% |
| 4 | Type Safety, Static Analysis & Automated Enforcement | 9% |
| 5 | Readability, Consistency & Implementation Maintainability | 9% |
| 6 | Delivery, Release & Recovery Discipline | 8% |
| 7 | Dependency & Supply-Chain Hygiene | 7% |
| 8 | Debuggability & Operational Feedback | 6% |
| 9 | Developer Experience & Reproducibility | 6% |
| 10 | Documentation Quality & Process Discipline | 6% |
| 11 | Documentation–Implementation Drift Control | 7% |
| 12 | Technical-Debt & Continuous-Improvement Practice | 6% |

Processo por rodada: Claude lê o repositório real (código de `services/identity`, `services/catalog`, `connectors/tmdb`, `connectors/ticketmaster`, `quality/`, CI, Terraform) e pontua com evidência de arquivo/linha; Codex é invocado via `codex exec --skip-git-repo-check` (protocolo `AGENTS.md` §3) e pontua de forma cega, sem ver a nota de Claude, lendo o repositório real por conta própria a cada rodada (nunca "de memória"). Achados concretos viram correções reais no mesmo commit/leva, não apenas re-pontuação — `npm run quality:check` (typecheck+lint+test+fitness functions) e `terraform validate`/`fmt -check` verdes antes de cada commit.

Apenas Identity (Phase 1) e Catalog (Phase 2) têm código de produto; `apps/`, `packages/{config,contracts,domain,observability,testing}` e `services/{ingestion,matching,notifications,tracking}` seguem placeholders vazios — nenhuma rodada penaliza ausência de testes/CI para código que ainda não existe.

## Notas por rodada

| Critério | R1 Claude | R1 Codex | R2 Claude | R2 Codex | R3 Claude | R3 Codex | R4 Codex |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 Correctness | 8.0 | 7.2 | 9.0 | 8.0 | 9.3 | 8.8 | 9.0 |
| 2 Testing | 6.5 | 6.2 | 7.8 | 8.6 | 8.0 | 8.6 | 8.8 |
| 3 CI Gates | 7.0 | 7.6 | 8.3 | 9.3 | 8.6 | 8.9 | 8.7 |
| 4 Type Safety | 9.0 | 8.3 | 9.0 | 8.8 | 9.0 | 8.9 | 9.3 |
| 5 Readability | 8.0 | 8.0 | 8.7 | 8.4 | 8.8 | 8.5 | 9.1 |
| 6 Delivery | 5.0 | 4.0 | 5.0 | 5.8 | 5.0 | 6.5 | 6.8 |
| 7 Dependency | 6.0 | 7.0 | 7.8 | 9.0 | 8.0 | 9.0 | 9.0 |
| 8 Debuggability | 5.0 | 4.5 | 5.0 | 5.8 | 5.2 | 6.8 | 7.5 |
| 9 DX | 7.5 | 7.5 | 7.5 | 8.8 | 7.5 | 8.8 | 9.2 |
| 10 Documentation | 8.5 | 8.2 | 8.7 | 8.7 | 8.0 | 8.1 | 8.8 |
| 11 Drift Control | 6.5 | 6.5 | 7.5 | 7.8 | 8.0 | 7.7 | 7.8 |
| 12 Tech-Debt | 9.0 | 7.0 | 9.0 | 9.1 | 9.0 | 9.3 | 9.3 |
| **Total ponderado** | **~7.17** | **6.86** | **~7.87** | **8.24** | **~7.99** | **8.33** | **8.64** |

(R4 Claude está omitida da tabela cega formal: as correções da leva final — self-test noturno, verificação exata de required checks, log observável de falha de compensação — foram feitas em resposta direta aos achados de R4 do Codex e não passaram por uma 5ª rodada cega independente antes do encerramento desta sessão; ver "Por que a revisão parou" abaixo.)

## Achados por rodada e correções aplicadas

**Rodada 1** (nota conjunta ~7.0): Codex leu o código real e achou dois defeitos de alta severidade que a leitura inicial de Claude, mais focada em specs/testes existentes, não havia isolado com a mesma precisão:

1. `signup()` (`services/identity/src/application/signup.ts`) criava a conta Cognito antes do write transacional no UsersTable, sem compensação — falha no segundo passo deixava uma conta Cognito órfã, sem perfil/consentimento, que um novo signup nunca conseguiria recriar (`UsernameExistsException`). Corrigido: `CognitoAuthClient.deleteUser()` + compensação em `signup.ts`, com testes cobrindo sucesso, falha da escrita, e falha da própria compensação.
2. `scripts/run-workspaces.mjs` usa `npm ... --if-present`, que silencia um workspace sem o script `test`/`lint`/`typecheck` em vez de falhar o gate. Corrigido: nova fitness function `quality/policies/github/workspace-scripts-declared.mjs` (QR-016), com prova por fixture.
3. Achados médios corrigidos na mesma leva: `quality:self-test` nunca rodava no CI, só manualmente (QR-017); conectores TMDB/Ticketmaster chamavam `fetch()` sem timeout, podendo travar a Lambda de ingestão indefinidamente (corrigido com `AbortSignal.timeout(10_000)` + teste); `docs/engineering/quality-strategy.md` afirmava Dependabot habilitado sem `.github/dependabot.yml` existir (corrigido, e os dois itens de backlog que rastreavam isso como pendente foram reconciliados).

**Rodada 2** (nota conjunta ~8.05): Codex verificou as correções da Rodada 1 contra o repositório real e achou que a compensação do signup tinha um defeito operacional: a policy IAM de Identity nunca concedeu `cognito-idp:AdminDeleteUser`, então a chamada de limpeza falharia com `AccessDenied` em AWS real — o `.catch(() => undefined)` best-effort mascarava exatamente a falha que a correção pretendia prevenir. Corrigido em `infrastructure/terraform/modules/identity/main.tf` (`terraform validate`/`fmt -check` limpos). `audit-reality.mjs` também passou a verificar `required_status_checks` (antes só `enforce_admins`).

**Rodada 3** (nota conjunta ~8.16): Codex identificou que o achado da Rodada 2 era uma instância de uma classe de bug (ação IAM usada em código sem estar na policy Terraform correspondente), não um caso isolado — e apontou comentários de código referenciando a própria revisão ("Codex finding", data da sessão), o que viola a regra de `CLAUDE.md` contra referenciar a tarefa/revisão atual em comentário de código. Corrigidos: `README.md` tinha quatro afirmações desatualizadas da Phase 0 (diretórios vazios, "nenhum código de produto implementado", "Phase 2 em aberto") apesar de Phase 1/2 já implementadas; três triggers de `docs/backlog.md` já haviam disparado sem estarem marcados como tal.

**Rodada 4** (Codex: 8.64): nova fitness function `quality/policies/architecture/iam-action-coverage.mjs` (QR-018) generaliza o achado da Rodada 2 — varre `services/<nome>/src` por comandos do AWS SDK (`*Command`) e confere que a action IAM correspondente existe em `infrastructure/terraform/modules/<nome>/`, com prova por fixture (inválida/válida) e gate em `quality:check`/`quality:self-test`. Codex ainda achou, nesta rodada: (a) `audit-reality.mjs` validava `required_status_checks` só por contagem (`>=7`), o que 7 contexts errados também satisfariam; (b) `quality:self-test` só rodava em PR, nunca de forma agendada; (c) `README.md` já linkava para este documento antes dele existir (achado válido — a versão do README anterior a este commit afirmava a revisão como concluída prematuramente). Todos corrigidos na leva final: verificação exata dos 7 contexts (não só contagem, rodado ao vivo contra o repositório real: 7/7 batem), `.github/workflows/nightly-quality-self-test.yml` (diário, mais forte que o "semanal" que o backlog já previa), e este documento sendo escrito agora resolve (c). Também corrigido nesta leva, achado de menor severidade repetido duas vezes por Codex: a falha da compensação do signup era descartada sem nenhum sinal observável — `signup.ts` agora emite um evento estruturado (`signup.compensation_failed`, `userId` apenas, nunca o email — EDP004) antes de relançar o erro original, com teste cobrindo o caso e confirmando ausência de PII no log.

## Por que a revisão parou em ~8.5, não em 9

Quatro rodadas cegas rodadas (mínimo de `AGENTS.md` §2 é 3). Na Rodada 4, pedido explicitamente a se posicionar sobre convergência, o Codex classificou os critérios abaixo de 9 em dois grupos — capados por infraestrutura ausente vs. corrigíveis no repositório agora — e todos os itens do segundo grupo (verificação exata de required checks, self-test agendado, reconciliação de backlog, comentários de revisão em código) foram corrigidos na leva final desta sessão. Os itens que restam abaixo de 9 são, pela própria avaliação independente do Codex, do primeiro grupo:

- **Delivery, Release & Recovery Discipline (6.8, Rodada 4)** — sem ambiente dev implantado, não há pipeline de CD real, promoção de artefato, smoke test pós-deploy, ensaio de rollback ou restore drill para demonstrar. `terraform validate`/`plan` são reais; o resto depende de um ambiente que não existe ainda.
- **Debuggability & Operational Feedback (7.5, Rodada 4)** — sem worker/Lambda rodando, não há alarme CloudWatch, dashboard, trace ou canal de notificação operacional real para validar; criar isso agora seria infraestrutura de fachada, mesma lição já registrada na revisão de arquitetura para este mesmo item (Observability).
- **Test Effectiveness (parcial)** — testes de unidade/integração local (DynamoDB Local) são fortes e cobrem os casos de negócio nomeados; testes contra AWS real, E2E, scale e failure dependem de um ambiente dev implantado e do vertical slice da Phase 3 (Matching/Delivery), que ainda não existem.
- **Documentation–Implementation Drift Control (parcial)** — `context:check` (checagem automatizada de referências quebradas/consistência do sistema de contexto) e o canário agendado de contrato de provider (TMDB/Ticketmaster) continuam sem implementação; ambos já estavam registrados como triggers disparados-mas-não-implementados em `docs/backlog.md` antes desta revisão e permanecem lá.

Esses quatro itens já estavam registrados em `docs/backlog.md` com trigger explícito antes desta sessão (a maioria compartilha o mesmo trigger da revisão de arquitetura: primeiro ambiente dev implantado / Phase 3) — esta revisão não adiciona itens novos de dívida técnica, apenas confirma, de forma independente por Claude e Codex, que eles continuam sendo a causa honesta do teto abaixo de 9, e não uma omissão de trabalho corrigível hoje.

**Nota final estimada**: nota conjunta da Rodada 4 (Codex 8.64) mais a leva de correções que resolveu todos os itens que o próprio Codex classificou como corrigíveis no repositório — sem uma 5ª rodada cega para reconfirmar formalmente, a nota conjunta final desta sessão fica estimada em **~8.5/10**, no mesmo patamar honesto da revisão de arquitetura (~8.2/10), pela mesma razão: os gaps residuais pesam sobre critérios genuinamente capados por infraestrutura ainda não implantada, não por disciplina de engenharia.

## Verificação

Toda correção de código desta revisão passou por `npm run quality:check` (typecheck + lint + test + as 4 fitness functions registradas) e, para as mudanças de Terraform, `terraform validate` + `terraform fmt -check -recursive` — ambos limpos antes de cada commit. `npm run quality:self-test` (prova de fixture positiva/negativa para as 6 controls registradas: `no-external-pii-import`, `no-external-provider-call`, `iam-action-coverage`, `workspace-scripts-declared`, EDP004, EDP005) rodou 12/12 verde. `quality/scripts/audit-reality.mjs` foi executado ao vivo contra o repositório e conta GitHub reais nesta sessão (branch protection, required status checks exatos, IAM role de CI) — todos passando.

Commits desta revisão: `9432d38`, `03a008e`, `b0bf3a1`, `5cc3ec3` (branch `audit/first-consistency-and-threat-model`).
