---
status: accepted
date: 2026-08-11
supersedes: []
---

# ADR-007 — Idempotency Strategy

Status: Accepted

## Contexto

Duplicação de notificação/interesse é um dos piores modos de falha percebidos pelo usuário. SQS é at-least-once; múltiplos workers podem processar a mesma mensagem. Detalhe: `../../architecture/spec-notification-delivery.md` §28-31, `../../architecture/spec-dynamodb-access-patterns.md` §19.

## Decisão

Chave de idempotência determinística por domínio: para interesse, `sha256(userId | targetType | targetId | normalizedLocationScope)`; para notificação, `channel + userId + canonicalEventId + notificationType + triggerVersion`. Conditional write/transactional put é a defesa primária (preferível a read-before-write, evita race condition). Registro de idempotência dedicado só quando a operação atravessa múltiplos recursos/serviços.

## Alternativas consideradas

Read-before-write como padrão — rejeitado por abrir race condition entre leitura e escrita.

## Consequências

Toda criação de interesse/notificação é segura sob reprocessamento e concorrência. Custo: toda mutação relevante precisa calcular a chave determinística antes de escrever.

## Trigger de revisão

Nenhum — contrato estrutural.
