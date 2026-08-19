# AGENTS.md — Event Discovery Platform

> Fonte canônica de regras duráveis para qualquer agente de IA (Claude Code, Codex CLI) trabalhando neste repositório. `CLAUDE.md` continua a fonte primária de regras operacionais do projeto (papel, princípios, protocolo de investigação, convenções, git/PR) — este arquivo cobre apenas o que é específico de trabalhar com mais de um agente de IA. Não duplicar conteúdo entre os dois.

## 1. Quando este arquivo se aplica

Criado quando um segundo agente de IA (Codex CLI) passou a trabalhar neste projeto — o trigger que `docs/backlog.md` §"Engenharia de contexto" já previa para a criação deste arquivo. Antes disso, só Claude Code operava aqui.

## 2. Protocolo de debate Claude ↔ Codex

Obrigatório para decisões **Nível 6** (ADR novo ou reversão de decisão existente — ver `CLAUDE.md` §"Validação proporcional ao risco") e para mudanças **Nível 4-5** (autenticação, PII, rate limiting, dinheiro/tracking, migração de dados em produção, mudança de infra crítica). Não obrigatório para Nível 1-3 (correção mecânica, lógica isolada, documentação factual, refactor local reversível) — aplicar bom senso de engenharia nesses casos, igual ao critério já usado no projeto irmão (`expiration-tracker`).

Quando aplicável:

- Mínimo 3 rodadas (proposta → crítica → tréplica).
- Nota mínima 9.0/10 de ambos os agentes antes de considerar concluído, sem arredondar (8.99 não vira 9).
- **Protocolo de nota cega**: o agente que responde depois não vê a nota/parecer do primeiro até ambos existirem registrados — evita ancoragem. Pedir a avaliação do Codex antes de revelar a conclusão do Claude, nunca depois.
- Desacordo abaixo de 9 reabre rodada em vez de arredondar ou fazer média.
- Registrar o resultado do debate na seção `Consequências` (ou `Alternativas consideradas`, se mais aplicável) do ADR correspondente: rodadas, notas finais de cada agente, e pontos de divergência não resolvidos, se houver. Não criar um documento separado para isso (ver `CLAUDE.md` §"Contexto efêmero").

### 2.1. Revisão conjunta de qualidade (por eixo) — procedimento reutilizável

Além do debate sobre uma decisão pontual (§2), este protocolo também roda como **revisão periódica de qualidade por eixo** (ex.: Arquitetura, Qualidade de Engenharia — ver eixos já convergidos em `docs/engineering/standards/joint-review-criteria.md`). Ao abrir um eixo novo (ou repetir um existente), seguir sempre este procedimento em vez de reescrevê-lo do zero em um prompt de sessão:

1. **Definir critérios (só na primeira vez que o eixo roda).** Claude pesquisa fontes reconhecidas (ex. ISO/IEC 25010, AWS Well-Architected, ATAM, DORA/Core-4 — escolher conforme o eixo) e propõe critérios com peso, sem mostrar ao Codex. Codex faz o mesmo, independentemente. Convergir em uma rodada de negociação até pesos somarem 100%. **Persistir o resultado em `docs/engineering/standards/joint-review-criteria.md`** (uma seção nova, formato igual aos eixos existentes) — nunca dentro do doc de auditoria da rodada. Eixo já convergido não reabre esta etapa.
2. **Rodada cega.** Cada agente lê o repositório real (não critérios "de memória" de rodada anterior) e pontua 0-10 por critério com evidência de arquivo/linha. Codex via `codex exec --skip-git-repo-check` (§3), pontuando antes de ver a nota de Claude.
3. **Comparar, investigar gaps ≥1 ponto**, corrigir de verdade (código/teste/config real, não só re-pontuar), validar (`npm run verify` + `npm run quality:check`, e `terraform validate`/`fmt` se tocar infra) antes de cada commit.
4. **Repetir rodadas cegas** (mínimo 3) até nota conjunta ≥9.0 sem arredondar, ou até Claude e Codex concordarem, de forma independente, que o gap restante exige algo fora do escopo razoável da sessão (infraestrutura inexistente, decisão só do Marcelo) — nesse caso, registrar em `docs/backlog.md` com trigger explícito, nunca inflar a nota nem construir controle de fachada.
5. **Documentar o resultado** em `docs/engineering/audits/<data>-joint-<eixo>-review.md`: metodologia (linkando a seção de critérios, não duplicando), notas por rodada, achados e correções, itens conscientemente adiados com trigger. Este doc é Evidence (`docs/context-strategy.md` §2) — muda a cada execução; os critérios em si não vivem aqui.
6. Um prompt de sessão usado para retomar/disparar uma rodada (tipo `NEXT_SESSION_PROMPT.md`) é contexto efêmero — não commitar no repo além da sessão em que foi usado; o que precisa sobreviver já foi promovido para os destinos acima (critérios → passo 1, resultado → passo 5).

## 3. Invocação do Codex

- `codex exec --skip-git-repo-check "<prompt>"`, rodado a partir do diretório deste repositório (define o `workdir`). `--skip-git-repo-check` é necessário porque o diretório pai (`projects/`) não é ele mesmo um repositório git.
- Roda com `sandbox: read-only`, `approval: never` — pode ler arquivos e rodar comandos de shell somente leitura, mas não edita o repositório nem executa código arbitrário.
- **Nunca usar crases (`` ` ``) dentro de um prompt passado por Bash/PowerShell com aspas duplas** — o shell interpreta como substituição de comando e corrompe a entrada silenciosamente; o processo trava esperando stdin (CPU ~0), não é "processamento lento". Para prompts com crases ou markdown, escrever em arquivo e usar `codex exec --skip-git-repo-check - < arquivo.txt > saida.txt 2>&1`, **em primeiro plano** (não combinar `- < arquivo.txt` com backgrounding — já produziu falha silenciosa nesse padrão, verificado no `expiration-tracker`).
- Diagnóstico de travamento: checar CPU do processo `codex` (near-zero após vários minutos = travado esperando stdin, não "pensando"). Uma chamada real termina em ~15s a poucos minutos com uso de CPU visível. Se travado, matar o processo e relançar — nunca esperar indefinidamente.
- Saída longa do Codex pode passar do limite de leitura de uma vez — usar `tail -c` ou buscar a seção final (a saída termina com uma linha literal `codex` seguida da resposta final, depois `tokens used`).

## 4. Verificação

Tratar achados do Codex como alegações a verificar, não como veredito automático — mas também não descartar sem checar. Todo achado relevante deve ser confirmado contra o código/spec real antes de virar ação; o resultado (corrigido nesta sessão / adiado com dono e trigger registrado) entra no ADR ou no `docs/backlog.md`, conforme o protocolo de contexto efêmero de `CLAUDE.md`.
