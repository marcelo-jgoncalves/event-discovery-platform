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

## 3. Invocação do Codex

- `codex exec --skip-git-repo-check "<prompt>"`, rodado a partir do diretório deste repositório (define o `workdir`). `--skip-git-repo-check` é necessário porque o diretório pai (`projects/`) não é ele mesmo um repositório git.
- Roda com `sandbox: read-only`, `approval: never` — pode ler arquivos e rodar comandos de shell somente leitura, mas não edita o repositório nem executa código arbitrário.
- **Nunca usar crases (`` ` ``) dentro de um prompt passado por Bash/PowerShell com aspas duplas** — o shell interpreta como substituição de comando e corrompe a entrada silenciosamente; o processo trava esperando stdin (CPU ~0), não é "processamento lento". Para prompts com crases ou markdown, escrever em arquivo e usar `codex exec --skip-git-repo-check - < arquivo.txt > saida.txt 2>&1`, **em primeiro plano** (não combinar `- < arquivo.txt` com backgrounding — já produziu falha silenciosa nesse padrão, verificado no `expiration-tracker`).
- Diagnóstico de travamento: checar CPU do processo `codex` (near-zero após vários minutos = travado esperando stdin, não "pensando"). Uma chamada real termina em ~15s a poucos minutos com uso de CPU visível. Se travado, matar o processo e relançar — nunca esperar indefinidamente.
- Saída longa do Codex pode passar do limite de leitura de uma vez — usar `tail -c` ou buscar a seção final (a saída termina com uma linha literal `codex` seguida da resposta final, depois `tokens used`).

## 4. Verificação

Tratar achados do Codex como alegações a verificar, não como veredito automático — mas também não descartar sem checar. Todo achado relevante deve ser confirmado contra o código/spec real antes de virar ação; o resultado (corrigido nesta sessão / adiado com dono e trigger registrado) entra no ADR ou no `docs/backlog.md`, conforme o protocolo de contexto efêmero de `CLAUDE.md`.
