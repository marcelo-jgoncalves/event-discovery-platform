---
status: accepted
date: 2026-08-11
supersedes: []
---

# ADR-009 — Quality Gate and Exception Policy

Status: Accepted

## Contexto

"Sem bypass" só funciona como regra se houver uma única válvula de escape formal — caso contrário, exceções informais se acumulam silenciosamente (padrão observado no histórico auditado: dívida técnica não documentada). Detalhe completo: `../quality-strategy.md` §1.1-1.2, §10.3.

## Decisão

Gates divididos em três tiers por risco/custo:

```text
Tier A — todo PR (typecheck, lint, unit, contract, integration-fast,
         dependency review, npm audit, SAST/secret/IaC scan)
Tier B — merge para main / dev (integration-aws-real, E2E, smoke,
         validação de IAM real, DAST baseline)
Tier C — nightly/pré-release (scale, failure, full DAST, restore drill,
         dependency drift, auditoria de consistência)
```

Tier A vermelho bloqueia merge; Tier B vermelho bloqueia promoção para produção; Tier C vermelho bloqueia release quando afeta segurança, integridade de dados ou hot path.

Política de vulnerabilidade: **zero high/critical não-triado**, não "zero a qualquer custo". Única exceção válida é formal, com `exceptionId`, controle afetado, justificativa, risco, compensating control, owner, `createdAt`, `expiresAt` e trigger de revalidação. Exceção expirada bloqueia release automaticamente quando tecnicamente possível.

## Alternativas consideradas

Gate único e uniforme para todo PR — rejeitado: testes pesados (scale, failure, DAST completo) em todo PR tornam o ciclo de feedback lento sem ganho proporcional; a pirâmide preserva rigor nos hot paths com feedback rápido no resto. Bypass informal caso a caso — rejeitado, é exatamente o padrão que gerou dívida técnica não rastreada no histórico auditado.

## Consequências

Exige infraestrutura de CI com três estágios distintos e um registro formal de exceções (não apenas comentário em código ou combinado verbal). Em troca, "sem bypass" continua sendo uma regra real, não aspiracional.

## Trigger de revisão

Evidência de que algum Tier está mal calibrado (ex: Tier A ficando lento demais para o ciclo de PR, ou Tier B deixando passar classe de bug que deveria ser Tier A).
