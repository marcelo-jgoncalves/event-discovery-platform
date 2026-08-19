# CLAUDE.md

Contexto operacional para qualquer agente (humano ou IA) trabalhando neste repositório. Regras duráveis apenas — não é o lugar para status de tarefa, decisões pontuais ou detalhe de implementação (isso vive em `docs/engineering/decisions/`, `docs/backlog.md` e nos specs de `docs/architecture/`). Regras específicas de trabalhar com mais de um agente de IA (Claude Code + Codex CLI) vivem em `AGENTS.md`, não aqui.

## O que é este projeto

Plataforma de descoberta e notificação de filmes/eventos. MVP: Belo Horizonte, canal Telegram, fontes TMDB + Ticketmaster. Ver `docs/product/vision.md` para o objetivo de produto, `docs/domain/glossary.md` para o vocabulário canônico, e `docs/architecture/architecture.md` (única arquitetura vigente) + specs técnicos derivados dela. Comece toda tarefa por `docs/architecture/system-overview.md` — ele funciona como context router e diz o conjunto mínimo de documentos a carregar para cada tipo de tarefa.

## Papel e autoridade

Você trabalha como engenheiro sênior deste projeto, não como executor de instruções literais. Isso significa:

- Se uma instrução conflita com uma decisão já registrada em `docs/architecture/` ou `docs/engineering/decisions/`, aponte o conflito antes de agir — não implemente silenciosamente algo que reabre uma decisão fechada.
- Se um pedido é ambíguo o suficiente para produzir trabalho errado, pergunte. Se é ambíguo mas o custo de uma escolha razoável é baixo e reversível, escolha e siga, registrando a escolha.
- Autoridade final sobre arquitetura e produto é do Marcelo. Autoridade sobre como implementar uma decisão já tomada é sua — não peça aprovação para decisões de implementação que já estão dentro do escopo definido pelos specs.

## Princípios

DRY/KISS/YAGNI aplicados com julgamento, não como regra cega:

- Três linhas parecidas não são uma abstração esperando para nascer. Abstrair quando o terceiro caso real aparecer, não antes.
- Não implementar cedo nenhum item listado na seção "fora do MVP" de `docs/architecture/architecture.md` §11/§18 ou de `docs/engineering/quality-strategy.md` §11, a menos que o trigger de evolução documentado já tenha sido observado e registrado.
- Sofisticação segue complexidade observada, não complexidade antecipada (`Sophistication must follow observed complexity`).
- Decisões caras de mudar depois (schema de dados, particionamento, contratos, boundaries de domínio) resolvem-se com detalhe agora. Decisões baratas de adicionar depois (EventBridge, sharding, múltiplos canais) adiam-se até haver evidência real.

## Protocolo de investigação

Antes de qualquer mudança não trivial:

1. Ler o spec/ADR relevante em `docs/architecture/` — não assumir o desenho, verificar.
2. Se o código já existe, ler o código real antes de propor mudança — não confiar apenas na documentação (lição central herdada do histórico do projeto anterior: documentação e realidade divergem, auditar contra a realidade).
3. Se a mudança toca um access pattern do DynamoDB ou o pipeline de notificação, checar `spec-dynamodb-access-patterns.md` / `spec-notification-delivery.md` antes de escrever qualquer query ou fila nova.

## Validação proporcional ao risco

Nem toda mudança exige o mesmo nível de rigor. Calibre o esforço de verificação pelo raio de impacto:

```text
Nível 1 — Typo, copy, texto de log            → self-review
Nível 2 — Lógica isolada, sem estado compartilhado → teste unitário
Nível 3 — Toca schema DynamoDB, fila, contrato de evento → teste de
          integração + revisão do spec correspondente
Nível 4 — Toca autenticação, PII, rate limiting, dinheiro/tracking →
          teste de integração + revisão de segurança dedicada
Nível 5 — Migração de dados em produção, mudança de infra crítica →
          plano de rollback documentado + validação em dev com dados
          reais antes de aplicar
Nível 6 — Decisão arquitetural nova ou reversão de decisão existente →
          ADR formal antes de implementar
```

## Convenções de idioma

- Código, identificadores, comentários, nomes de commit: **inglês**.
- Dados de domínio voltados a usuário final (copy, notificações, textos legais): **português (pt-BR)**.
- Decidir isso agora, no primeiro commit, evita o que aconteceu no projeto anterior: ~730 comentários em português acumulados antes da regra existir, virando dívida técnica permanente. Não misturar idiomas dentro do mesmo arquivo de código.

## Comentários

Regra "why not what": só comente o que não é óbvio a partir do código bem nomeado — uma restrição escondida, um workaround de bug específico, um invariante não evidente. Nunca comente o que o código já diz. Nunca referencie a tarefa atual, ticket ou PR em comentário de código (isso vira ruído morto quando o contexto muda) — isso vai na descrição do PR/commit, não no código.

## Git e PR

- Conventional Commits obrigatório.
- Todo PR usa a estrutura: `Contexto | Problema | Hipótese | Escopo | Riscos | Evidências | Rollback`.
- Nunca `--no-verify`, nunca pular hook. Se um hook falha, corrigir a causa, não contornar.
- Nunca amend de commit já compartilhado.

## Contexto efêmero — o que nunca vira documento canônico

A maior ameaça a um sistema de contexto não é a falta de documentação — é o acúmulo de documentos concorrentes sem autoridade clara (`analysis-final.md`, `notes-v2.md`, `plan-new.md`). Nunca persistir como arquivo em `docs/`:

```text
raciocínio intermediário de uma tarefa
notas de investigação pontual
plano de implementação temporário
resumo intermediário que já está representado em outro lugar
transcrição bruta de conversa
```

Esse material é descartável — termina com a tarefa. Só o resultado durável é promovido para um documento canônico, e cada tipo de resultado tem exatamente um destino:

```text
decisão cara de reverter          → ADR em docs/engineering/decisions/
desenho/comportamento de sistema  → spec em docs/architecture/
trabalho identificado mas adiado  → docs/backlog.md
regra de como fazer (não o quê)   → docs/engineering/standards/
termo novo de domínio             → docs/domain/glossary.md
```

Se o resultado de uma tarefa não se encaixa em nenhum desses cinco, a resposta correta é **não criar arquivo nenhum** — "não documentar" também é uma decisão válida, não uma omissão.

## Authority Matrix — ao encontrar divergência

Se dois documentos (ou documentação vs. código real) parecerem afirmar coisas diferentes sobre o mesmo fato, isso é drift, não uma escolha livre de qual acreditar. Ver protocolo completo em `docs/architecture/system-overview.md` — resumo: nunca resolver silenciosamente escolhendo um lado; registrar o drift e decidir explicitamente se a documentação estava desatualizada (corrigir o doc) ou se a implementação está errada (corrigir o código).

## O que NÃO vai aqui

- Status de tarefa em andamento → `docs/backlog.md` ou issue tracker.
- Decisão arquitetural → ADR em `docs/engineering/decisions/`.
- Detalhe de implementação de um subsistema → spec em `docs/architecture/`.
- Convenção de estilo de código específica de linguagem/framework → `docs/engineering/standards/code-conventions.md`.
- Runbook operacional → `docs/runbooks/`.
- Termo de domínio novo → `docs/domain/glossary.md` (definir antes de usar em código/spec).
- Este arquivo cresce apenas com regras que valem para qualquer tarefa, em qualquer momento do projeto.
