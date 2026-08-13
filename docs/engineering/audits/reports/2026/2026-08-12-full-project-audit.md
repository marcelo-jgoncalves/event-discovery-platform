# Auditoria de consistência do projeto

## Metadados

| Campo | Valor |
|---|---|
| ID da auditoria | `PCA-20260812-FULL` |
| Data | 2026-08-12 |
| Modo | `full` |
| Branch | `worktree-agent-a86c9cb615d6675c0` (checkout local do worktree; commit idêntico ao `main` remoto no momento da auditoria) |
| Commit | `1c85fce03801ff99f4874f3659ca90801c808524` (HEAD, = PR #5 merged, = `origin/main`) |
| Working tree | `clean` no início da auditoria. `npm ci` foi executado durante a auditoria para obter sinal real de `typecheck`/`lint`/`test` (o worktree não tinha `node_modules`); isso gera `node_modules/` e `package-lock.json` inalterado, ambos ignorados/já commitados — não altera nenhum arquivo rastreado. |
| Versão da metodologia | 1 (`marcelo-goncalves-blog/docs/engineering/audits/project-consistency-audit.md`, lida integralmente antes de agir) |
| Versão dos pesos | 1 |

## Escopo

Primeiro ciclo de auditoria deste projeto (não há snapshot/baseline anterior aqui). Cobertura efetiva, modo `full`:

- Contexto e governança: `CLAUDE.md`, `docs/README` (inexistente — ver Limitações), `docs/architecture/system-overview.md`.
- Produto e domínio: `docs/product/vision.md`, `docs/domain/glossary.md`.
- Arquitetura: `docs/architecture/architecture.md`, `docs/architecture/spec-identity.md`, `docs/architecture/spec-catalog.md`, `docs/architecture/history/architecture-v1.md` (lido parcialmente/estruturalmente, não linha a linha — 1408+ linhas em `architecture.md`).
- Decisões: os 13 ADRs em `docs/engineering/decisions/` (status/índice verificados; conteúdo lido integralmente para ADR-012/013, os demais verificados por status + presença + referência cruzada com specs).
- Qualidade: `docs/engineering/quality-strategy.md`, `docs/engineering/quality-rules.md`, `docs/engineering/quality-enforcement-system.md`.
- Padrões: `docs/engineering/standards/resource-naming.md` (integral); `code-conventions.md`, `testing-strategy.md`, `git-and-review-workflow.md`, `principles.md` (verificados por existência, não lidos linha a linha).
- Backlog: `docs/backlog.md` (integral).
- Auditoria anterior: `docs/engineering/audits/2026-08-11-revisao-estrategia-contexto.md` (lida, é do projeto irmão de origem da metodologia mas versionada aqui como evidência de aplicação P0).
- Código: `services/identity/*`, `services/catalog/*` (lidos integralmente os módulos de aplicação/domínio/pii/infra citados nos specs; testes lidos por contagem/nome, não célula a célula), `connectors/tmdb`, `connectors/ticketmaster`, `packages/provider-contracts` (amostrados).
- Infraestrutura: `infrastructure/terraform/main.tf`, `providers.tf`, `modules/identity/*`, `modules/catalog/*` (integral); `modules/iam-github-oidc/*` verificado por existência (não relido linha a linha, já auditado no histórico do Phase 0).
- CI/CD: `.github/workflows/ci.yml`, `.github/workflows/security.yml` (integral).
- Sistema de qualidade executável: `quality/scripts/*.mjs`, `quality/policies/architecture/*.mjs`, executados ao vivo (ver Verificações ao vivo).
- Estado do Git: `git log`, `git status`, `git branch -a`, PRs #1-#5 via `gh pr list`.
- Estado real no GitHub: branch protection de `main` via `gh api`.

## Verificações ao vivo executadas nesta auditoria

```text
git log/status/diff --stat                              — executado
gh api repos/.../branches/main/protection                — executado (branch protection confirmada)
gh api .../branches/main/protection/required_status_checks — executado (404 — não configurado, ver PCA-20260812-001)
gh pr list / gh pr checks 5                               — executado (9 checks reais listados no PR #5)
gh run list --branch main                                 — executado
npm ci                                                     — executado (node_modules ausente no worktree)
npm run verify (typecheck + lint + test)                   — executado, 100% verde após npm ci
npm run quality:check                                      — executado, 2/2 policies OK
npm run quality:self-test                                  — executado, 8/8 controls operational
node quality/scripts/audit-reality.mjs                     — executado, 2/2 checks PASS (branch protection, IAM role CI)
node quality/scripts/audit-project.mjs                     — executado, agrega os três anteriores + lista o que ainda não existe
```

Não presumido, não reaproveitado de memória — cada número abaixo veio de uma dessas execuções nesta sessão.

## Limitações

- **Sem AWS real além do que `gh`/Terraform local permitem**: não há credenciais AWS neste ambiente de execução da auditoria. `terraform plan`/`apply` contra a conta real, GuardDuty, CloudTrail, PITR *observado* (vs. declarado no `.tf`), Cognito real, estado real das tabelas DynamoDB — tudo isso é **não verificado**, não "ok". O que foi verificado é a *intenção* em Terraform (`point_in_time_recovery { enabled = true }`, IAM least-privilege no `.tf`), não o estado *implantado*.
- **Testes de integração não executados localmente**: `services/identity` e `services/catalog` têm testes `integration/*.test.ts` contra DynamoDB Local; este ambiente não tem Docker disponível. Só foi possível confirmar que o job `integration-fast` do CI real (`.github/workflows/ci.yml`) passou nos últimos 5 runs de `main` (`gh run list`), não reexecutar localmente.
- **`docs/README.md`** (mapa de documentação citado implicitamente pelo padrão do projeto irmão) **não existe neste repositório** — não é um achado de quebra, é uma differença estrutural real: aqui `CLAUDE.md` cumpre esse papel de forma mais enxuta. Registrado como observação, não como `broken-reference`, porque nenhuma fonte canônica deste projeto afirma que `docs/README.md` deveria existir.
- Conteúdo integral de `docs/architecture/architecture.md` (1408 linhas) e `history/architecture-v1.md` não foi lido linha a linha — inspeção estrutural (seções, referências cruzadas citadas por outros documentos) e amostragem, proporcional ao tempo desta execução. Drift dentro dessas seções não citadas por outro documento pode não ter sido detectado.
- `docs/engineering/standards/code-conventions.md`, `testing-strategy.md`, `git-and-review-workflow.md`, `principles.md` foram confirmados existentes e referenciados corretamente, mas não lidos integralmente nesta execução — risco de achado não detectado dentro desses arquivos especificamente.
- GitHub Actions "pinadas por SHA" (QR-001) foi conferido por leitura visual dos `uses:` em `ci.yml`/`security.yml` (todos parecem SHA de 40 chars), não por um verificador automatizado — mesma limitação que o próprio `quality-rules.md` já declara para QR-001 ("revisão manual do workflow, sem check automático ainda").
- Sem comparação com auditoria anterior deste tipo *deste projeto* — é o primeiro ciclo. `docs/engineering/audits/2026-08-11-revisao-estrategia-contexto.md` existe mas é uma revisão de estratégia de contexto, não uma execução prévia desta metodologia de consistência — não serve como baseline comparável (rubrica diferente, escopo diferente).

## Veredito

Nota global ponderada (áreas auditadas nesta execução, pesos da metodologia): **≈ 6,5 / 10** — "funcional, mas com lacunas importantes". Esta é uma média; **não deve ser lida isoladamente**: `ci_cd` (peso 11) recebeu nota 5 por uma lacuna estrutural concreta (PCA-20260812-001 — nenhum required status check configurado no GitHub, apesar de `quality-enforcement-system.md` §24 exigir isso explicitamente), o que limita o veredito mais do que a média sozinha sugere — o mecanismo que deveria impedir mecanicamente um merge com CI vermelho hoje depende inteiramente de disciplina humana, não de configuração do GitHub.

Pelo lado positivo, e isso é o achado mais forte desta auditoria: as duas fases de produto implementadas (Identity, Catalog) mostram **alinhamento real e verificado ao vivo** entre o que o backlog afirma e o que o código/CI real fazem — contagens de teste (10/10 identity, 11/11+3/3+2/2 catalog), 8/8 controles de qualidade operacionais, e branch protection confirmada via API batem exatamente com as afirmações em `docs/backlog.md`. Isso é o oposto do padrão de drift que a série de auditorias do projeto irmão documentou (contagens erradas, "resolvido" que não era). Aqui, "documentado como feito" e "estado real" convergem nas duas fases auditadas.

Não é possível declarar "pronto para produção" — o próprio backlog já não afirma isso; Tier B/C, ambiente `dev` implantado, GuardDuty/CloudTrail e o primeiro threat model formal (parte desta auditoria, ver documento separado) ainda não existiam antes desta sessão.

## Achados prioritários

### PCA-20260812-001 — Nenhum required status check configurado no GitHub para `main`

- Categoria: `missing-enforcement`
- Área: `ci_cd` / `security`
- Severidade: **high**
- Confiança: `high`
- Estado: `open`
- Fontes: `docs/engineering/quality-enforcement-system.md` §24 ("Gates críticos devem estar configurados como required status checks no GitHub... Nunca depender apenas de comentários"), `docs/engineering/quality-strategy.md` §1 ("Nenhum PR mergeia com `verify` vermelho — sem bypass"), estado real via `gh api repos/marcelo-jgoncalves/event-discovery-platform/branches/main/protection/required_status_checks`.
- Evidência observada: a chamada retorna `404 Required status checks not enabled`. `branch protection` (endpoint pai) confirma `enforce_admins=true`, `required_pull_request_reviews.required_approving_review_count=0`, `allow_force_pushes=false`, `required_conversation_resolution=true` — mas **nenhum check específico (verify, integration-fast, semgrep etc.) é exigido pelo GitHub para permitir o merge**.
- Interpretação: os 9 checks reais rodam e hoje passam (confirmado via `gh pr checks 5`), mas isso é resultado de disciplina do autor, não de um controle mecânico do GitHub. Combinado com `required_approving_review_count=0` (decisão já aceita em ADR-010 §4 para projeto solo), um PR pode tecnicamente ser mergeado com CI vermelho ou ainda em execução sem que o GitHub bloqueie nada.
- Impacto: a afirmação central de `quality-strategy.md` §1 ("Nenhum PR mergeia com `verify` vermelho — sem bypass, sem `--no-verify`") não tem, hoje, um mecanismo independente de enforcement no ponto onde mais importa (o botão de merge) — é exatamente o tipo de gap que `quality-enforcement-system.md` §1 chama de "a IA/o processo deveria lembrar", que o próprio documento diz não ser enforcement suficiente.
- Limitação: não foi possível testar experimentalmente (abrir um PR com CI vermelho e tentar mergear) — a conclusão vem da configuração declarada via API, que é evidência direta e forte o suficiente para confiança `high` sem esse teste.
- Próxima ação sugerida: configurar `required_status_checks` no branch protection de `main`, elencando ao menos os checks que `quality-strategy.md` §1.1 chama de Tier A (verify, integration-fast, dependency-review, npm-audit, semgrep, gitleaks, infra) como `contexts` obrigatórios.
- Controle determinístico possível: sim — `gh api` check equivalente ao já usado em `quality/scripts/audit-reality.mjs`, adicionando uma verificação de `required_status_checks.contexts` não vazio e contendo os nomes esperados.
- Caso do livro aplicável: candidato plausível (ver seção "Potenciais casos para o livro") — é uma divergência entre o texto normativo do próprio sistema de qualidade (`quality-enforcement-system.md` §24) e a configuração real, detectada só por verificação ao vivo, exatamente o tipo de lição que a metodologia deste projeto foi desenhada para capturar.

### PCA-20260812-002 — `security.yml` executa em duplicidade por PR (trigger próprio + `workflow_call` de `ci.yml`)

- Categoria: `workflow-policy-conflict`
- Área: `ci_cd`
- Severidade: medium
- Confiança: `high`
- Estado: `open`
- Fontes: `.github/workflows/security.yml` linhas 1-11 (`on: pull_request` **e** `workflow_call`), `.github/workflows/ci.yml` job `security-scans` (chama `security.yml` via `uses: ./.github/workflows/security.yml`), `gh pr checks 5` (evidência ao vivo).
- Evidência observada: `gh pr checks 5` lista **9 checks**, dos quais 4 são Semgrep/Gitleaks: `SAST (Semgrep)` e `Secret Detection (Gitleaks)` (execução independente via `pull_request`) **e** `Security Scans (Semgrep + Gitleaks) / SAST (Semgrep)` / `.../Secret Detection (Gitleaks)` (execução via `workflow_call` dentro de `CI (Tier A)`). O comentário em `security.yml` linha 7-10 justifica o `workflow_call` exatamente para "a failing scan actually blocks this workflow's conclusion" — mas o trigger `pull_request` independente permanece, gerando um segundo par de execuções que não faz parte de `CI (Tier A)` e cujo resultado isolado não é (e, por PCA-001, nenhum check é) exigido pelo GitHub para merge.
- Interpretação: duplicação não é um bug funcional (ambas as execuções escaneiam o mesmo código e devem convergir no mesmo resultado), mas é exatamente o padrão que `quality-strategy.md` §1 cita como lição do histórico do projeto irmão — "CI de fachada", neste caso não por ausência de gate, mas por gate redundante cuja metade não gateia nada de forma clara. Também dobra o consumo de minutos de CI sem ganho de cobertura.
- Impacto: baixo risco técnico direto; risco de confusão operacional (qual das duas execuções de Semgrep "conta"?) e desperdício de CI.
- Limitação: não foi verificado se isso já causou algum caso real de um dos dois pares passar e o outro falhar (não há histórico de falha nos 5 runs inspecionados).
- Próxima ação sugerida: remover o trigger `pull_request` de `security.yml`, mantendo só `workflow_call` (chamado por `ci.yml`) e `workflow_dispatch` — ou decidir explicitamente manter ambos e documentar por quê.
- Controle determinístico possível: sim — lint de workflow que barra `on: pull_request` simultâneo a `workflow_call` num arquivo referenciado por outro workflow via `uses:`.
- Caso do livro aplicável: não — mecânico, não generalizável o suficiente sozinho (mas relacionado a PCA-001).

### PCA-20260812-003 — `system-overview.md` (context router) não referencia `spec-identity.md` nem `spec-catalog.md`

- Categoria: `architecture-documentation-gap` / `documentation-drift`
- Área: `architecture` / `documentation` / `context_and_ai_governance`
- Severidade: medium-high
- Confiança: `high`
- Estado: `open`
- Fontes: `docs/architecture/system-overview.md` (lido integral — seções "Leitura completa", "Context routing", "Subsistemas e onde cada um está especificado"), `docs/architecture/spec-identity.md`, `docs/architecture/spec-catalog.md` (ambos `status: active`, `authority: normative`).
- Evidência observada: a lista "Leitura completa" (linhas 13-21) cita `architecture.md`, `spec-dynamodb-access-patterns.md`, `spec-notification-delivery.md` — não cita `spec-identity.md` nem `spec-catalog.md`. Os read-sets de "Context routing" (`Implementar feature`, `Alterar arquitetura`, `Trabalhar no matcher`, `Trabalhar no dispatcher`) também não mencionam nenhum dos dois specs de Phase 1/2. A tabela "Subsistemas e onde cada um está especificado" (linhas 120-138) lista "Ingestion / Connectors → architecture.md, history/architecture-v1.md §7-9" — não aponta para `spec-catalog.md`, que é hoje o desenho concreto e vigente desse subsistema (o próprio `spec-catalog.md` linha 9 diz "architecture.md §5 só listava CatalogTable de passagem... este spec é o desenho concreto"). Não há entrada nenhuma de "Identity" na tabela.
- Interpretação: `system-overview.md` é explicitamente definido como "o mapa que diz onde a verdade vive e qual subconjunto mínimo de contexto carregar" (linha 9) — e não foi atualizado quando `spec-identity.md` (Phase 1, 2026-08-11) e `spec-catalog.md` (Phase 2, 2026-08-12) foram criados. Um agente seguindo rigorosamente o context routing documentado para "Implementar feature" em identity/catalog não seria direcionado a esses specs pelo próprio router.
- Impacto: o próprio mecanismo desenhado para evitar "carregar tudo" ou "carregar o spec errado" ficou desatualizado nas duas únicas fases de produto implementadas até agora — risco cresce a cada fase nova se o padrão se repetir.
- Limitação: nenhuma — evidência direta de leitura de ambos os arquivos.
- Próxima ação sugerida: adicionar `spec-identity.md`/`spec-catalog.md` à tabela de subsistemas e aos read-sets relevantes de `system-overview.md`. Esta auditoria não corrige (comportamento não corretivo).
- Controle determinístico possível: sim — é exatamente o `context:check` já planejado em `docs/backlog.md` ("Engenharia de contexto — P1/P2 adiados conscientemente": "doc ativo referenciando arquivo superseded" / poderia expandir para "spec ativo não referenciado pelo router").
- Caso do livro aplicável: ambíguo — é um exemplo concreto e recorrente (2 de 2 specs novos) de context router desatualizado, potencialmente generalizável para o livro ("o router de contexto também precisa de manutenção, não só os documentos que ele aponta"), mas não abro caso automaticamente — fica como candidato.

### PCA-20260812-004 — Texto de estrutura alternativa não implementada em `quality-strategy.md` §8

- Categoria: `stale-reference`
- Área: `documentation`
- Severidade: low
- Confiança: `high`
- Estado: `open`
- Fontes: `docs/engineering/quality-strategy.md` linha 420 (`docs/adr/ — (se preferir manter separado de engineering/decisions)`).
- Evidência observada: `docs/adr/` não existe no repositório (verificado por Glob); todos os ADRs vivem em `docs/engineering/decisions/`, que é o caminho real usado em todo o resto da documentação (`CLAUDE.md`, `system-overview.md`, backlog).
- Interpretação: texto remanescente de uma versão anterior/genérica do documento (aparenta ser herdado do template do projeto irmão) nunca resolvido para a decisão real deste projeto.
- Impacto: mínimo — não é ambíguo na prática porque nenhuma outra fonte usa `docs/adr/`, mas é ruído para quem lê `quality-strategy.md` §8 isoladamente.
- Limitação: nenhuma.
- Próxima ação sugerida: remover a linha alternativa ou marcá-la explicitamente como "não usada neste projeto".
- Controle determinístico possível: parcial — um `context:check` que verifica se todo caminho citado em docs/ existe capturaria isso.
- Caso do livro aplicável: não.

## Avaliação por área

### Architecture

- Nota: 7
- Confiança: medium-high
- Evidência: `architecture.md`, `spec-identity.md`, `spec-catalog.md`, ADR-002/006/012/013, código de `services/identity`/`services/catalog` alinhado aos specs.
- Limitações: `architecture.md`/`history-v1.md` não lidos linha a linha; PCA-20260812-003 pesa contra a nota.
- Achados relacionados: PCA-20260812-003.

### Infrastructure as Code

- Nota: 8
- Confiança: medium
- Evidência: `infrastructure/terraform/modules/identity`, `modules/catalog`, `providers.tf` (default_tags cobre as 4 tags globais + `Component` por módulo = 5 tags obrigatórias de `resource-naming.md` §12, confirmado por leitura direta — não é drift, apesar de a primeira leitura ter levantado suspeita), PITR habilitado em ambas as tabelas, least-privilege IAM por role funcional, naming convention seguida (`Edp{Env}{Table}`, `edp-{env}-role-{component}-{purpose}`).
- Limitações: sem `terraform plan`/`apply` contra AWS real nesta sessão (sem credenciais); OPA/Rego para Terraform ainda não existe, mas isso é backlog declarado com trigger não atingido, não drift.
- Achados relacionados: nenhum novo.

### CI/CD

- Nota: 5
- Confiança: high
- Evidência: 9 checks reais, todos verdes nos últimos 5 runs de `main` (`gh run list`); Tier A cobre typecheck/lint/format/unit/integration-fast/dependency-review/npm-audit/SAST/secret-scan/IaC-scan como documentado.
- Limitações: nenhuma técnica — a nota reflete um gap real e verificado, não falta de inspeção.
- Achados relacionados: PCA-20260812-001 (peso decisivo na nota), PCA-20260812-002.

### Security

- Nota: 6
- Confiança: medium
- Evidência: Semgrep (OWASP/secrets/JWT + regras custom EDP004/EDP005) e Gitleaks rodando e passando; secret do Cognito App Client em Secrets Manager, nunca Terraform var plaintext; IAM least-privilege confirmado no `.tf`; PII boundary (`services/identity/src/pii/*`) protegido por Architecture Fitness Function com controle de integridade comprovado (8/8).
- Limitações: threat model formal só passou a existir com esta sessão (documento separado); MFA administrativo deferido com dono/prazo (aceito, ADR-012); GuardDuty/CloudTrail não verificáveis (sem AWS real); PCA-20260812-001 também é, na prática, um gap de segurança (merge não bloqueado mecanicamente por CI vermelho).
- Achados relacionados: PCA-20260812-001.

### Tests

- Nota: 6
- Confiança: medium
- Evidência: 26 testes unit executados ao vivo nesta sessão (11 catalog + 10 identity + 3 ticketmaster + 2 tmdb), 100% pass, contagens idênticas às afirmadas em `docs/backlog.md`. `integration-fast` real e verde no CI (últimos 5 runs).
- Limitações: testes de integração não executados localmente (sem Docker neste ambiente) — confiança baseada em evidência de CI, não em execução direta nesta sessão. Nenhum teste de regra de negócio crítica nomeada ainda (`quality-strategy.md` §3) — consistente com backlog, que declara isso pendente até Phase 3+.
- Achados relacionados: nenhum novo (limitação registrada, não achado).

### Application Code

- Nota: 8
- Confiança: medium-high
- Evidência: `services/identity` e `services/catalog` seguem exatamente a separação domain/pii/infra/application descrita nos specs; `ingest-ticketmaster-event.ts` e `cognito-client.ts` lidos integralmente, comentários "why not what", sem PII vazando para fora do módulo `pii/`, `index.ts` de identity deliberadamente não reexporta `pii/*`.
- Limitações: amostragem, não leitura de 100% dos arquivos de código.
- Achados relacionados: nenhum.

### Contracts and Monorepo

- Nota: 7
- Confiança: medium
- Evidência: `packages/provider-contracts` mínimo, sem dependências, consumido por ambos connectors e por `services/catalog`; workspaces npm funcionam corretamente após `npm ci` (o worktree não tinha `node_modules` populado — ambiente, não drift de projeto); `package-lock.json` versionado, CI usa `npm ci`.
- Limitações: nenhuma relevante.
- Achados relacionados: nenhum.

### Documentation

- Nota: 6
- Confiança: high
- Evidência: specs, ADRs e standards presentes, com metadata `status/owner/authority` nos documentos centrais (aplicado do P0 da revisão de contexto).
- Limitações: PCA-20260812-003 (router desatualizado) e PCA-20260812-004 (referência obsoleta menor) pesam contra a nota.
- Achados relacionados: PCA-20260812-003, PCA-20260812-004.

### Production Readiness

- Nota: 3
- Confiança: high
- Evidência: nenhum ambiente `dev`/`prod` implantado ainda (confirmado — Tier B/C explicitamente adiados em `docs/backlog.md` "Bootstrap pendente"); sem dashboards de SLO, sem GuardDuty/CloudTrail, sem restore drill.
- Limitações: nota baixa é esperada e honestamente documentada pelo próprio projeto nesta fase — não é uma surpresa desta auditoria, é confirmação de um estado já declarado. Não confundir com "produção não está pronta e ninguém sabia" — aqui todos sabem.
- Achados relacionados: nenhum novo.

### Context and AI Governance

- Nota: 8
- Confiança: high
- Evidência: `CLAUDE.md` enxuto, regras duráveis apenas, seção explícita "o que NÃO vai aqui"; regra de contexto efêmero aplicada; `docs/domain/glossary.md` existe; backlog deduplicou triggers (aponta para spec/ADR em vez de repetir valor) conforme recomendado na revisão de 2026-08-11.
- Limitações: PCA-20260812-003 também é, estritamente, um gap de governança de contexto (o próprio router).
- Achados relacionados: PCA-20260812-003 (compartilhado com architecture/documentation).

## Contradições entre fontes

| Tema | Fonte A | Fonte B | Contradição | Autoridade provável | Evidência | Ação necessária |
|---|---|---|---|---|---|---|
| Required status checks | `quality-enforcement-system.md` §24 ("Gates críticos devem estar configurados como required status checks") | Configuração real do GitHub (`required_status_checks` 404) | Documento normativo exige um controle que não existe na configuração real | Decisão humana — configurar o controle ou revisar a exigência documentada | `gh api .../required_status_checks` | decisão humana necessária (Marcelo) |
| Subsistema "Ingestion/Connectors" | `system-overview.md` tabela "Subsistemas" (aponta para `architecture.md`/`history-v1.md`) | `spec-catalog.md` (se autodeclara "o desenho concreto" do mesmo subsistema) | Router aponta para o documento genérico/histórico em vez do spec concreto vigente | `spec-catalog.md` (mais específico, `authority: normative`, mais recente) | leitura direta de ambos | atualizar `system-overview.md` (correção de doc, não decisão nova) |

## Políticas e enforcement

| Política | Fonte | Maturidade | Detecção | Consequência | Evidência | Risco |
|---|---|---|---|---|---|---|
| Nenhum PR mergeia com `verify` vermelho | `quality-strategy.md` §1 | `review-dependent` (não `automatically-blocking` como o texto sugere) | Checks rodam e reportam, mas GitHub não exige nenhum deles para permitir merge | Depende de o autor/revisor não mergear manualmente sobre vermelho | PCA-20260812-001 | alto — falsa sensação de proteção mecânica |
| PII nunca fora de `services/identity/src/pii/*` | `quality-rules.md` QR-012 | `automatically-blocking` | Architecture Fitness Function, fixture inválida/válida comprovadas | Bloqueia `quality:check`/CI job `verify` | `npm run quality:self-test` (8/8) executado nesta sessão | baixo |
| Branch protection ativa em `main` | ADR-010 §4, `docs/backlog.md` | `automatically-detected` (verificado via `audit-reality.mjs`) | `gh api` | Confirma existência, não substitui required status checks | `node quality/scripts/audit-reality.mjs` executado nesta sessão, PASS | baixo (para o que audita) / relacionado a PCA-001 (para o que não audita) |
| GitHub Actions pinadas por SHA | `quality-rules.md` QR-001 | `documented-only` (o próprio registry já declara isso) | revisão manual visual | nenhuma automática | leitura de `ci.yml`/`security.yml` — todas parecem SHA-pinned | baixo, mas sem verificação automática |

## Contexto e governança da IA

`CLAUDE.md` é enxuto e cumpre a própria regra de manutenção (§13: só regras duráveis). Não há `.project-context.md` neste projeto (diferente do projeto irmão) — `docs/backlog.md` cumpre parte desse papel de estado operacional, de forma consistente com a decisão já registrada na revisão de 2026-08-11. `.claude/skills/` não foi inspecionado neste projeto (fora do escopo desta execução — não há indicação de skills locais custom aqui, diferente do projeto irmão de onde a metodologia foi importada). Nenhum conteúdo privado/pessoal encontrado nos arquivos lidos.

## Estudos de caso

Fora de escopo — `docs/book/cases/` não existe neste projeto (o mecanismo de captura de aprendizado do livro pertence ao projeto irmão; este projeto não replicou essa estrutura). Nenhum caso para auditar aqui.

## Reprodutibilidade

- `npm ci` reproduz exatamente o ambiente de teste desta auditoria (confirmado: 0 vulnerabilidades, 157 pacotes, todos os workspaces resolvidos corretamente após a instalação).
- `npm run quality:self-test`/`audit:reality`/`audit:project` são reproduzíveis por qualquer clone com `gh` autenticado e Semgrep instalável via `pip` — não dependem de artefato local não versionado.
- Testes de integração (`test/integration/*.test.ts`) exigem Docker (DynamoDB Local) — não reproduzidos nesta auditoria por ausência de Docker no ambiente de execução; um clone com Docker disponível deve reproduzir o mesmo padrão já verde no CI.
- Nenhuma dependência de arquivo local não versionado foi encontrada nesta auditoria (sem `.env` lido, sem `memory/` neste projeto).

## Controles determinísticos sugeridos

- Verificação automatizada de que `required_status_checks.contexts` não está vazio e contém os nomes esperados (extensão natural de `audit-reality.mjs`).
- Lint de workflow que impede `on: pull_request` simultâneo a `workflow_call` num workflow referenciado via `uses:` por outro (PCA-20260812-002).
- `context:check` (já no backlog) expandido para verificar se todo spec `status: active` é referenciado por `system-overview.md` em pelo menos um read-set (capturaria PCA-20260812-003 automaticamente em auditorias futuras).

## Prioridades

1. PCA-20260812-001 (required status checks) — maior lacuna estrutural, afeta CI/CD e segurança ao mesmo tempo.
2. PCA-20260812-003 (system-overview desatualizado) — baixo custo de corrigir, risco cresce a cada fase nova não refletida.
3. PCA-20260812-002 (duplicação de security.yml) — custo baixo, ganho de clareza operacional.
4. PCA-20260812-004 (referência obsoleta menor) — cosmético.

## Itens resolvidos desde a avaliação anterior

Não aplicável — primeiro ciclo desta metodologia neste projeto, sem baseline comparável. `docs/engineering/audits/2026-08-11-revisao-estrategia-contexto.md` já registra que suas próprias recomendações P0 foram aplicadas (arquitetura única, ADR lifecycle, glossary, context routing inicial, protocolo de drift) — confirmado por leitura direta de `system-overview.md`/`CLAUDE.md`/`docs/domain/glossary.md` nesta auditoria, consistente com o que aquele documento afirma.

## Novos riscos

Nenhum risco novo além dos já listados em "Achados prioritários" foi identificado dentro do escopo desta execução.

## Questões que exigem decisão humana

- PCA-20260812-001: configurar `required_status_checks` agora (projeto ainda solo, risco menor) ou aceitar formalmente o risco com prazo de revisão (ex: antes do primeiro colaborador externo ou do primeiro ambiente `dev` implantado) — decisão de Marcelo, não escolha silenciosa desta auditoria.

## Potenciais casos para o livro

- PCA-20260812-001 é candidato: um documento normativo do próprio sistema de qualidade (`quality-enforcement-system.md` §24) exigindo explicitamente um controle que, na prática, não foi configurado — divergência entre intenção documentada e configuração real, descoberta só por verificação ao vivo via API, não por leitura de código/Terraform. Relevância ambígua o suficiente (não é um incidente com histórico real de exploração, é um gap preventivo) para não abrir caso automaticamente — fica registrado aqui como candidato, seguindo `docs/book/capture-protocol.md` do projeto irmão (este projeto não tem mecanismo de captura de livro próprio).

## Arquivos gerados

- Este relatório: `docs/engineering/audits/reports/2026/2026-08-12-full-project-audit.md`
- Snapshot correspondente: `docs/engineering/audits/snapshots/2026/2026-08-12-full-scores.yaml`
