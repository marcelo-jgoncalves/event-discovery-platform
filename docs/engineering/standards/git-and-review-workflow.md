# Git e Fluxo de Revisão

## Commits

Conventional Commits obrigatório (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, etc.). Mensagem descreve o "porquê", não repete o diff.

## Branches

```text
main        — sempre deployável, protegida (branch protection
              confirmada via API, não assumida)
feature/*    — trabalho em andamento
```

## Pull Request

Estrutura obrigatória na descrição:

```text
Contexto   — por que esta mudança existe
Problema   — o que estava errado/faltando
Hipótese   — o que a mudança deveria resolver
Escopo     — o que está incluído e o que foi deliberadamente deixado de fora
Riscos     — o que pode quebrar, e o nível de validação aplicado
              (ver docs/engineering/quality-strategy.md — validação
              proporcional ao risco)
Evidências — testes rodados, output relevante, screenshot se UI
Rollback   — como reverter se necessário
```

## Gates obrigatórios antes de merge

```text
typecheck + lint + test (npm run verify)
integration tests do workspace afetado
SAST + secret scan + dependency audit
IaC scan, se a PR toca infraestrutura
```

Nenhum merge com gate vermelho. Nenhum `--no-verify`. Se um gate falhar por motivo espúrio, corrigir o gate, não contornar.

## Revisão

Mudanças de nível 4+ (ver `../quality-strategy.md` / `CLAUDE.md` — validação proporcional ao risco) exigem revisão humana explícita antes de merge, mesmo que os gates automáticos passem.

## Após merge

Deploy para `dev` automático. Deploy para produção com smoke test pós-deploy real como último gate (não apenas testes pré-deploy).
