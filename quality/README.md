# quality/

Sistema de enforcement independente de IA (ADR-011, `docs/engineering/quality-enforcement-system.md`). Nasceu vazio, deliberadamente — regras/policies são adicionadas quando o código que elas protegem existe, nunca antecipadamente (ver ADR-011, alternativas consideradas). Primeiras regras reais: Phase 1 (Identity) — ver QR-012/QR-013 em `docs/engineering/quality-rules.md`.

```text
policies/          — regras executáveis por domínio (code, architecture, terraform, github, documentation)
tests/fixtures/     — valid/ e invalid/: prova de que cada policy detecta a violação que diz detectar
tests/policy-tests/ — testes das próprias policies (Control Integrity Tests)
audits/             — achados de auditoria contra estado real (github, aws, application, context)
scripts/            — quality-check.mjs, quality-self-test.mjs, audit-reality.mjs, audit-project.mjs
```

Antes de adicionar uma regra aqui, ela precisa de uma fixture `invalid/` que prove que a regra a rejeita — uma regra sem essa prova é uma hipótese, não um controle (`quality-enforcement-system.md` §6-7). Toda regra com enforcement real e comprovado entra no registry em `docs/engineering/quality-rules.md`; nada aspiracional é listado lá.
