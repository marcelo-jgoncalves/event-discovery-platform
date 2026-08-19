---
status: active
owner: architecture
authority: normative
---

# Revisão conjunta de engenharia de contexto — Claude ↔ Codex (2026-08-19)

Terceira aplicação do protocolo de debate Claude↔Codex (`AGENTS.md` §2), sobre um eixo distinto dos já fechados: Arquitetura (`docs/engineering/audits/2026-08-19-joint-architecture-review.md`, ~8.2/10) e Qualidade de Engenharia (`docs/engineering/audits/2026-08-19-joint-engineering-quality-review.md`, ~8.5/10). Esta revisão avalia a qualidade do **próprio sistema de documentação/contexto** do projeto — `docs/context-strategy.md`, `CLAUDE.md`, `AGENTS.md`, `docs/architecture/system-overview.md`, ADRs, backlog — não código, não arquitetura de sistema.

## Metodologia

9 critérios, peso somando 100%, definidos nesta mesma sessão (não pré-existiam) — ver `docs/engineering/standards/joint-review-criteria.md` §"Eixo: Engenharia de contexto" para a tabela e o racional de convergência (Claude pesquisou context engineering na web — context rot, ADR lifecycle, progressive disclosure, single-source-of-truth — e propôs 9 critérios; Codex propôs os mesmos 9 conceitos de forma independente, pesos a ≤1.5pp de distância; convergência sem rodada formal de desacordo, mesmo padrão observado no eixo de Arquitetura).

Processo por rodada: Claude lê o repositório real e pontua com evidência de arquivo/linha; Codex é invocado via `codex exec --skip-git-repo-check` (protocolo `AGENTS.md` §3), pontuando de forma cega, lendo o repositório real por conta própria a cada rodada. Achados concretos viram correções reais no mesmo commit/leva — `npm run quality:check` e `npm run context:check` verdes antes de cada commit.

## Notas por rodada

| Critério | R1 Claude | R1 Codex | R2 Codex | R3 Claude | R3 Codex | R4 Codex |
|---|---:|---:|---:|---:|---:|---:|
| 1 Canonicalidade & Não-Duplicação | 8.5 | 7.0 | 8.4 | 9.0 | 8.8 | 9.0 |
| 2 Clareza de Papéis & Proporcionalidade | 8.0 | 7.5 | 8.1 | 8.5 | 8.7 | 8.6 |
| 3 Context Routing & Progressive Disclosure | 8.5 | 8.5 | 8.6 | 9.0 | 9.3 | 9.1 |
| 4 Correspondência com a Realidade & Drift | 6.5 | 7.5 | 7.7 | 8.0 | 8.5 | 8.5 |
| 5 Lifecycle, Proveniência & Evolução | 7.5 | 8.0 | 7.7 | 8.0 | 8.4 | 8.4 |
| 6 Rastreabilidade (Decisões/Trabalho/Triggers) | 7.5 | 8.5 | 7.6 | 8.5 | 8.2 | 8.7 |
| 7 Higiene de Contexto & Sinal-Ruído | 7.0 | 7.0 | 8.3 | 7.5 | 9.2 | 9.1 |
| 8 Portabilidade Agnóstica entre Agentes | 8.5 | 6.5 | 6.8 | 7.0 | 7.6 | 7.4 |
| 9 Auditabilidade & Enforcement | 6.0 | 7.0 | 6.7 | 8.5 | 8.0 | 8.8 |
| **Total ponderado** | **~7.56** | **7.56** | **7.85** | **~8.34** | **8.53** | **8.66** |

(R2 Claude e R4 Claude não têm nota cega formal separada nessas linhas: as correções de cada rodada foram feitas em resposta direta aos achados do Codex daquela rodada, e a nota de "estado corrigido" de Claude é a mesma revelada na rodada seguinte, R3/R4. Mesmo padrão de omissão já usado em Qualidade de Engenharia R4.)

## Achados por rodada e correções aplicadas

**Rodada 1** (nota conjunta 7.56 — coincidência exata no total, critérios individuais divergentes): Codex leu o repositório real e achou drift factual dentro do próprio `context-strategy.md` que Claude não tinha visto — o documento afirmava `docs/operations/` e `docs/engineering/audits/` como "vazios" muito depois de deixarem de ser verdade, e a seção "Dívida técnica conhecida" do backlog como "deliberadamente vazia" depois de já ter sido populada em 2026-08-19 (revisão de Arquitetura, mesmo dia). Corrigidos os três, mais `resource-naming.md` (existia em disco, ausente do mapa de arquivos — gap que Claude já sabia mas não tinha corrigido). Commit `c8fb788`.

**Rodada 2** (Codex: 7.85): achou que o trigger de `context:check`, documentado como disparado na correção da Rodada 1, não tinha sido nem implementado nem redeferido com justificativa nova — inconsistência com a própria regra do projeto sobre triggers disparados. Também achou: Evidence com `authority: normative` sem racional declarado; mapa de arquivos ainda faltando `AGENTS.md`, `spec-identity.md`, `spec-catalog.md`, `quality-rules.md`, `quality-enforcement-system.md`; wording contraditório no backlog ("portabilidade não plena" ao lado de "contrato agnóstico"). Corrigidos todos: implementado `quality/scripts/context-check.mjs` (QR-021 — links relativos quebrados + índice ADR↔arquivos), gate de CI (`.github/workflows/ci.yml`) e `npm run audit:project`; nota de racional para Evidence normativa adicionada; mapa completado; wording do backlog corrigido; novo read set em `system-overview.md` roteando tarefas de revisão conjunta para `AGENTS.md`. Commit `d355281`.

**Rodada 3** (Codex: 8.53): confirmou as quatro correções da Rodada 2, mas achou quatro coisas novas: `context-strategy.md` §12 ainda descrevia `context:check` e o status multiagente do `AGENTS.md` como não-feitos (texto não atualizado após a própria Rodada 2 implementá-los); `context-check.mjs` excluía diretórios `history/` do scan, contradizendo a alegação de cobrir "todo `docs/**/*.md`"; nenhuma fixture positiva/negativa provava que o script realmente falha em input ruim (só uma execução narrada); item de lifecycle de audits sem trigger verificável. Corrigidos todos: §12 reescrita; exclusão de `history/` removida (verificado sem link quebrado novo); `context-check.mjs` refatorado em funções exportadas parametrizadas por diretório (`collectMarkdownFiles`, `checkBrokenLinks`, `checkAdrIndex`) com fixtures em `quality/tests/fixtures/{valid,invalid}/context/{links,adr-index}/`, conectadas a `quality-self-test.mjs` (16/16 controles, era 12/12) — detecção de ADR duplicado adicionada de brinde; trigger numérico dado ao item de lifecycle de audits (>8 arquivos normativos em `docs/engineering/audits/`). Commit `0e9eca3`.

**Rodada 4** (Codex: 8.66): confirmou as quatro correções da Rodada 3. Achado único, trivial: QR-021 (`docs/engineering/quality-rules.md`) ainda citava "44 arquivos" como evidência, desatualizado pela própria correção da Rodada 3 que passou a incluir `history/` (contagem real: 45) — exatamente a classe de drift que este eixo avalia, agora achada na descrição da regra que devia preveni-la. Corrigido: em vez de atualizar o número (que ficaria desatualizado de novo no próximo doc adicionado), o texto passou a apontar para a saída do comando como fonte, sem fixar uma contagem. Commit `737a239`.

## Por que a revisão fecha em ~8.6-8.7, não em 9

Na Rodada 4, pedido explicitamente a se posicionar sobre encerramento, o Codex classificou os critérios abaixo de 9 como estruturais/dependentes de trigger ainda não observado — não como trabalho corrigível adiado sem motivo:

- **Portabilidade Agnóstica (7.4, Rodada 4)** — `AGENTS.md` §3 é estruturalmente específico de Claude Code + Codex CLI (formato de invocação, gotchas de sandbox). Generalizar para um formato verdadeiramente agnóstico antes de um terceiro agente de IA entrar no projeto seria abstração antecipada sem caso de uso real — mesma lição de YAGNI já aplicada ao resto do projeto. Trigger: entrada de um terceiro agente.
- **Clareza de Papéis (8.6)** — `docs/operations/` guarda dois prompts de kickoff de fase encerrada, não runbooks; desvio de papel já apontado (sem resolução) na auditoria de 2026-08-11, agora documentado com honestidade em vez de oculto. Mover os arquivos tocaria 5+ referências (`README.md`, `docs/backlog.md`, ADR-010, `spec-identity.md`) sem melhorar a operação atual. Trigger: primeiro runbook real.
- **Lifecycle (8.4)** — o lifecycle de arquivamento de `docs/engineering/audits/` ainda não existe como mecanismo, só como trigger numérico registrado (>8 arquivos normativos). Construir o mecanismo antes do volume justificar seria a mesma sofisticação prematura que o projeto evita em outros eixos.
- **Rastreabilidade (8.7)** — falta um trigger numérico para a migração de `docs/backlog.md` para issue tracker; a própria estratégia já admite que esse valor não foi fixado ainda, por falta de evidência de que o ritmo de trabalho o justifique.

Todos os quatro já estavam (ou passaram a estar, nesta revisão) registrados em `docs/backlog.md` §"Engenharia de contexto" com trigger explícito — decisão consciente de escopo, seguindo o mesmo protocolo de honestidade sobre dívida técnica das outras duas revisões.

**Nota final**: Codex Rodada 4, 8.66/10, após a leva de correções finais (fechamento do gap trivial de QR-021). Sem uma 5ª rodada cega formal para reconfirmar esse último ajuste editorial (Codex explicitamente recomendou não abrir uma rodada nova só para isso), a nota conjunta final desta sessão fica em **~8.6-8.7/10** — no mesmo patamar honesto dos outros dois eixos (Arquitetura ~8.2, Qualidade de Engenharia ~8.5), ligeiramente mais alto por ter passado por 4 rodadas com correção real a cada uma, incluindo a implementação de um controle automatizado novo (QR-021) que não existia antes desta revisão.

## Verificação

Toda correção desta revisão passou por `npm run quality:check` e `npm run context:check` (novo, QR-021) verdes antes de cada commit. `npm run quality:self-test` passou a cobrir 16/16 controles (era 12/12) com a adição das fixtures de `context-check.mjs`. `npm run context:check` roda agora como parte do gate `verify` no CI (`.github/workflows/ci.yml`) e de `npm run audit:project`.

Commits desta revisão: `979619d` (definição de critérios), `c8fb788`, `d355281`, `0e9eca3`, `737a239` (branch `audit/first-consistency-and-threat-model`).
