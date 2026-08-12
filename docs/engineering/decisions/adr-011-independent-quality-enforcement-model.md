---
status: accepted
date: 2026-08-11
supersedes: []
---

# ADR-011 — Independent Quality Enforcement Model

Status: Accepted

## Contexto

`docs/engineering/quality-strategy.md` já define o que "qualidade" significa neste projeto, mas descreve principalmente *requisitos* (gates, testes, métricas). Não distingue explicitamente entre um requisito **verificado por mecanismo determinístico** e um requisito que depende de instrução para IA, revisão manual ou documentação para ser seguido. Essa distinção importa especificamente porque este projeto é implementado com participação intensa de IA: uma regra que só existe como texto (`CLAUDE.md`, um spec, uma instrução de sessão) é seguida enquanto a IA lembrar dela e escolher aplicá-la — não é uma propriedade do sistema, é um hábito.

Documento de origem: elaborado pelo usuário e incorporado a `docs/engineering/quality-enforcement-system.md`.

## Decisão

Adotar como regra constitucional de qualidade (incorporada em `quality-strategy.md` §14):

> Nenhum requisito crítico de qualidade pode depender exclusivamente de instrução para IA, revisão de código ou documentação. Todo requisito crítico deve possuir um mecanismo independente de enforcement ou verificação.

Modelo de quatro camadas, cada uma respondendo a uma pergunta diferente:

```text
Static Policy Gates        — "O código viola alguma regra proibida?"
Architecture Fitness Functions — "A estrutura respeita os boundaries?"
Behavior Tests              — "O sistema se comporta corretamente?"
Reality Audits               — "O que está rodando bate com código/infra/docs?"
```

Para todo requisito crítico novo, a pergunta operacional passa a ser "quem garante isso?" — se a resposta for "a IA deveria lembrar", o requisito não tem enforcement suficiente (`docs/engineering/quality-rules.md` formaliza isso como registry).

## Alternativas consideradas

- **Manter apenas `quality-strategy.md` como está** (requisitos em prosa, enforcement implícito): rejeitado — é exatamente o padrão que já falhou no histórico auditado (`auditoria-padrao-qualidade-marcelo-goncalves-blog.md`), onde CI "de fachada" e controles documentados-mas-não-verificados apareceram repetidamente.
- **Implementar o sistema completo agora** (OPA/Rego, Semgrep custom rules EDP001-007, architecture fitness functions, control integrity tests, reality audits agendadas): rejeitado nesta sessão por violar "sofisticação segue complexidade observada" (`CLAUDE.md` Princípios) — não existe código de produto ainda (`services/`, `connectors/`, `packages/` estão vazios). Regras como "matcher não importa PII" ou "Ticketmaster isolado em connector" não têm o que verificar até que esses módulos existam. Implementar os testes/policies antes do código que eles protegem produziria scaffolding sem sinal real de que funciona (viola §6/§17 do próprio documento: "não basta existir uma regra, é necessário provar que ela detecta a violação").

## Consequências

- O princípio constitucional entra em vigor imediatamente (qualquer requisito crítico novo, a partir de agora, precisa responder "quem garante isso?" antes de ser considerado coberto).
- A implementação concreta (Semgrep custom rules, OPA policies, architecture fitness tests, `quality:check`/`quality:self-test`/`audit:reality` reais) é incremental, registrada em `docs/backlog.md` com o trigger "quando o primeiro código do módulo correspondente existir" — não uma promessa vaga, mas condicionada a um evento observável.
- `quality/` nasce como esqueleto de diretórios (sem regras ainda) para que a estrutura já esteja no lugar quando as primeiras policies forem escritas, evitando um refactor de layout depois.
- `docs/engineering/quality-rules.md` só lista regras que já têm enforcement real hoje (branch protection, Actions pinadas por SHA, `npm ci`, Terraform obrigatório) — nunca uma regra aspiracional listada como se já tivesse mecanismo.

## Trigger de revisão

- Quando o primeiro serviço (`services/matching`, `services/notification`, etc.) ganhar código real: revisitar quais Architecture Fitness Functions da seção 8 do documento de origem passam a ser implementáveis e adicioná-las como PR obrigatório, não como ADR novo (é crescimento incremental já previsto por este ADR).
- Se um incidente real expuser uma classe de violação que nenhuma camada detectou: aplicar o pipeline Incident → Invariant (seção 19 do documento de origem) e registrar a regra nova em `quality-rules.md`, com fixture negativa comprovando detecção antes de fechar o incidente.
