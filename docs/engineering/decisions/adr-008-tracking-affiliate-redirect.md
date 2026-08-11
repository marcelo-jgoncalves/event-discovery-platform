---
status: accepted
date: 2026-08-11
supersedes: []
---

# ADR-008 — Tracking and Affiliate Redirect Model

Status: Accepted

## Contexto

Monetização inicial é via afiliados; a plataforma precisa medir a cadeia completa desde o início. Detalhe: `../../architecture/history/architecture-v1.md` §23-24/§65 (histórico — modelo já incorporado à arquitetura vigente).

## Decisão

Nenhum link final de parceiro é enviado diretamente. Toda saída passa por `/go/<tracking-token>`, que registra o clique, resolve o `AffiliateOffer` correspondente e faz 302 para o provider. `Offer` é modelo abstrato (`provider`, `originalUrl`, `affiliateUrl`, `price`, `currency`, `availability`, `commissionModel`) — nenhuma regra de negócio acoplada a provider específico. Cadeia medida: interest → notification → click → outbound provider → conversion.

## Alternativas consideradas

Enviar link direto do parceiro sem tracking — rejeitado, elimina toda visibilidade de funil e monetização desde o dia 1.

## Consequências

Todo destino de redirect deve ser validado antes do 302 (superfície de open redirect — ver `../quality-strategy.md` §4.3). Instrumentação de monetização existe desde a primeira notificação enviada, não como retrofit.

## Trigger de revisão

Nenhum — contrato estrutural.
