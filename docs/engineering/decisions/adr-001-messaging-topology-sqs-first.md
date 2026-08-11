---
status: accepted
date: 2026-08-11
supersedes: []
---

# ADR-001 — Messaging Topology V1: SQS-first

Status: Accepted

## Contexto

A arquitetura V1 usava EventBridge como bus central de domínio, mas na V1 real existe apenas um consumidor por etapa (ex: Matcher é o único consumidor de `catalog.event.normalized`). Fan-out de EventBridge sem múltiplos consumidores adiciona recursos, IAM e superfície de troubleshooting sem benefício proporcional. Detalhe completo: `../../architecture/architecture.md` §2.

## Decisão

Comunicação assíncrona entre subsistemas via SQS direto (Collectors → Ingestion SQS → Normalizer → Matching SQS → Matcher → Notification Queues → Dispatcher). Mensagens continuam semanticamente modeladas como eventos de domínio versionados (`catalog.event.normalized.v1`, etc.), mesmo sem EventBridge — a migração futura é mecânica.

## Alternativas consideradas

EventBridge como bus central desde a V1 — rejeitado por não ter fan-out real ainda.

## Consequências

Menor complexidade operacional e IAM surface na V1. Acoplamento direto entre etapas até o primeiro fan-out real aparecer.

## Trigger de revisão

Aparecimento de um segundo consumidor real para o mesmo evento de domínio (ex: Analytics, Search Indexer).
