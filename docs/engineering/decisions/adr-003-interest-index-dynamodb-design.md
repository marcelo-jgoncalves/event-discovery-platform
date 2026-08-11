---
status: accepted
date: 2026-08-11
supersedes: []
---

# ADR-003 — Interest Index DynamoDB Design

Status: Accepted

Consolida: design de chave, location-aware matching, duplicate projections vs GSI, capacity mode, consistency e trigger de hot-partition sharding — decisões que mudam juntas porque alteram o mesmo schema.

## Contexto

O matcher precisa responder "quem se importa com este evento?" sem scan, com suporte a interesse sem preferência de cidade, e sem risco de hot partition não controlado. Detalhe completo: `../../architecture/spec-dynamodb-access-patterns.md`.

## Decisão

- **Tabela dedicada** `InterestIndexTable`, capacity **on-demand** (padrão de carga ainda desconhecido; onboarding pode ocorrer em bursts; migração para provisioned é operacional, não schema).
- **Duas projeções explícitas** gravadas atomicamente via `TransactWriteItems`: Match Projection (`TARGET#...#LOCATION#... → USER#...`) e User Projection (`USER#... → INTEREST#...`). **Nenhum GSI obrigatório na V1** — rejeitado GSI para consulta inversa porque é sempre eventually consistent e introduz atraso de propagação incompatível com "match imediato após seguir".
- **`locationScope` explícito e obrigatório**: `CITY#<id>` ou `ANY`, nunca `null`/ausente/string vazia. O matcher sempre consulta as duas partições (cidade exata + `ANY`) e une os resultados. Criar `ANY` substitui scopes específicos do mesmo target; criar scope específico quando `ANY` já existe exige escolha explícita do usuário.
- **Consistency diferenciada por access pattern**: strong para WORK, PERSON, delete, existence/idempotência e ANY explícito; eventual por padrão para CATEGORY e contagem/admin.
- **Sem sharding na V1.** Guardrails de alarme configurados desde o início (`ReadThrottleEvents`, `WriteThrottleEvents`, `match_partition_page_count p95 > 25`, `match_candidate_count p95 > 25.000`). Trigger numérico de sharding: partição target-location > 250k assinantes ativos, OU > 500 writes/s sustentados na mesma chave, OU throttling apesar de adaptive capacity, OU p95 de recuperação de candidato violando SLO por 7 dias.

## Alternativas consideradas

GSI para consulta inversa — rejeitado (atraso de propagação). Entity resolution/sharding/consistency uniforme — rejeitados por não corresponderem ao padrão de acesso real de cada tipo de target. Sharding preventivo desde a V1 — rejeitado por adicionar N queries por target sem volume que justifique.

## Consequências

Write amplification deliberado (2 writes/2 deletes por interesse). Em troca: sem scans, sem joins, sem espera de propagação de índice secundário no hot path, sem ambiguidade de "seguir em qualquer lugar".

## Trigger de revisão

Condições numéricas de sharding acima (spec §16.5). Tráfego se tornar previsível e custo on-demand exceder materialmente provisioned+autoscaling (spec §32). Categoria passar a alimentar caminho de notificação de alta prioridade (reavaliar sua consistency).
