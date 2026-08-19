# NEXT_SESSION_PROMPT.md — event-discovery-platform

> Projeto: **event-discovery-platform** (não confundir com outros projetos do mesmo usuário que também usam o nome `NEXT_SESSION_PROMPT.md` — ex. `capital-agent-v0.2`, `expiration-tracker`). Use sempre o caminho absoluto deste arquivo, nunca assuma que "NEXT_SESSION_PROMPT.md" sozinho identifica o projeto certo.

## Objetivo desta sessão

Concluir a **revisão conjunta Claude↔Codex de qualidade de engenharia** deste repositório, seguindo exatamente o mesmo processo já usado (e já concluído) para a revisão de **arquitetura**. Não repita o trabalho de arquitetura — está fechado, documentado em `docs/engineering/audits/2026-08-19-joint-architecture-review.md` (~8,2/10 final, com dois itens conscientemente adiados e registrados em `docs/backlog.md`).

Esta sessão é sobre um eixo diferente: **qualidade de engenharia** (craft de código, disciplina de testes, rigor de CI, tooling, disciplina de documentação/processo, gestão de dívida técnica) — não decisões de design de sistema.

## Contexto obrigatório antes de começar

Leia, nesta ordem:

1. `AGENTS.md` — protocolo de debate Claude↔Codex (§2: nota mínima 9.0 sem arredondar, protocolo de nota cega, mínimo 3 rodadas quando aplicável) e regras de invocação do Codex CLI (§3: gotchas de sandbox/travamento — leia antes de rodar qualquer `codex exec`).
2. `docs/engineering/audits/2026-08-19-joint-architecture-review.md` — metodologia completa já validada (é o template a seguir), incluindo por que a revisão de arquitetura parou em ~8,2 em vez de forçar 9 artificialmente. Aplique o mesmo padrão de honestidade aqui: se um critério tiver um teto real (ex. depende de ambiente implantado que não existe), registre isso com trigger explícito em vez de inflar a nota.
3. `docs/architecture/system-overview.md` — context router do projeto.
4. `CLAUDE.md` — regras operacionais gerais.

## Critérios já convergidos (NÃO redefinir — já fechado com o Codex)

Claude pesquisou (ISO/IEC 25010 maintainability, DORA/Core-4) e definiu critérios de forma independente; Codex fez o mesmo sem ver o rascunho de Claude; uma rodada de convergência produziu esta lista final, pesos somando 100%. Use exatamente esta tabela — não reabra a etapa de definição de critérios.

| # | Critério | Peso | Definição |
|---:|---|---:|---|
| 1 | Code Correctness & Defensive Design | 11% | Preservação de invariantes via validação explícita, tratamento de falha, transições de estado seguras, ausência de corrupção silenciosa. |
| 2 | Test Effectiveness & Coverage Discipline | 14% | Evidência crível de unit/integration/contract/negative/failure/regression focada em risco real, não apenas contagem/cobertura de linha. |
| 3 | CI Quality Gates & Merge Safety | 11% | Enforcement determinístico de checks obrigatórios em toda mudança, sem bypass informal, exceções formalmente governadas. |
| 4 | Type Safety, Static Analysis & Automated Enforcement | 9% | Uso efetivo de tipagem estrita, lint, SAST, policy checks e fitness functions customizadas para prevenir classes de defeito automaticamente. |
| 5 | Readability, Consistency & Implementation Maintainability | 9% | Código coeso, nomeado claramente, estilo consistente, DRY/KISS/YAGNI aplicado com julgamento, barato de modificar. |
| 6 | Delivery, Release & Recovery Discipline | 8% | Artefatos/ambientes reproduzíveis, promoção segura, evidência de deploy, rollback, validação de recuperação proporcional à maturidade do projeto. |
| 7 | Dependency & Supply-Chain Hygiene | 7% | Dependências controladas, lockfiles, actions/tools pinados, triagem de vulnerabilidade, secret scanning, SBOM/provenance quando cabível. |
| 8 | Debuggability & Operational Feedback | 6% | Diagnósticos estruturados e privacy-safe, correlation context, erros acionáveis, suficientes para investigar falhas assíncronas. |
| 9 | Developer Experience & Reproducibility | 6% | Instalar/validar/testar/rodar o monorepo npm a partir de checkout limpo, com comandos pinados, documentados, de baixo atrito. |
| 10 | Documentation Quality & Process Discipline | 6% | Specs, standards, decisões e registros de mudança claros e autoritativos, com rigor de processo proporcional a projeto solo. |
| 11 | Documentation–Implementation Drift Control | 7% | Checks determinísticos ou executados regularmente que detectam divergência entre documentação, código, infra, config de CI e realidade implantada. |
| 12 | Technical-Debt & Continuous-Improvement Practice | 6% | Registro honesto de atalhos e controles falhos, com dono, trigger, expiry quando aplicável, e follow-through baseado em evidência. |

## Processo a seguir (idêntico ao da revisão de arquitetura)

1. **Rodada 1 — pontuação cega e independente.** Você (Claude) lê o repositório real (código, testes, CI, `quality/`, `docs/engineering/standards/`, `docs/engineering/quality-strategy.md`, `docs/engineering/quality-rules.md`, `docs/backlog.md` §"Dívida técnica conhecida", `git log`) e pontua os 12 critérios com evidência concreta (arquivo/linha). Em paralelo, peça ao Codex (`codex exec --skip-git-repo-check "<prompt>"`, ver `AGENTS.md` §3) para fazer o mesmo, **sem revelar sua nota antes** (protocolo de nota cega — peça a ele primeiro ou simultaneamente, nunca depois de mostrar a sua). Deixe explícito no prompt do Codex que a revisão de arquitetura já foi feita e está fechada — esta é sobre qualidade de engenharia.
2. **Comparar as notas.** Tabela lado a lado por critério, como no documento de arquitetura. Diferenças grandes (≥1 ponto) indicam que um dos dois enxergou evidência que o outro não viu — investigue antes de descartar.
3. **Corrigir de verdade, não só re-pontuar.** Cada achado concreto vira um commit real: código corrigido, teste adicionado, `npm run verify` + `npm run quality:check` rodando verde antes de cada commit (e `terraform validate`/`fmt` se a mudança tocar infra). Commits pequenos e objetivos, seguindo Conventional Commits (`CLAUDE.md` §"Git e PR").
4. **Repetir rodadas cegas** após cada leva de correções até estabilizar. Pare quando: (a) a nota conjunta atingir ≥9,0 sem arredondar, OU (b) você e o Codex concordarem, de forma independente, que o gap restante exige algo fora do escopo razoável desta sessão (ex. infraestrutura que não existe, decisão que só o Marcelo pode tomar) — nesse caso, registre o gap com trigger explícito em `docs/backlog.md`, exatamente como foi feito para Observability/OCC na revisão de arquitetura. Não infle a nota artificialmente nem implemente controle de fachada só para bater 9.
5. **Documentar o resultado** em `docs/engineering/audits/<data-desta-sessão>-joint-engineering-quality-review.md`, seguindo a mesma estrutura de `2026-08-19-joint-architecture-review.md` (metodologia, critérios, notas por rodada, achados e correções, itens conscientemente adiados com trigger).
6. **Commitar e dar push** ao final de cada leva de mudanças (branch atual: verifique com `git branch --show-current`; não há necessidade de pausar para confirmar commit/push — só pausar para decisões que afetem configuração compartilhada visível, ex. mudar branch protection do GitHub, do jeito que foi feito na revisão de arquitetura).

## O que NÃO fazer

- Não redefinir os critérios acima — já convergidos e fechados.
- Não misturar achados de arquitetura com esta revisão — são eixos distintos e já documentados separadamente.
- Não pontuar Codex "de memória" — sempre releia o repositório real a cada rodada, o código muda entre rodadas.
- Não implementar telemetria/infra especulativa só para subir número, mesma lição da revisão de arquitetura.
