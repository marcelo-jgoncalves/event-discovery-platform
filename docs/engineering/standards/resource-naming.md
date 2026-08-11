---
status: active
owner: architecture
authority: normative
---

# Resource Naming and Tagging

Convenção de nomes para todo recurso de infraestrutura (DynamoDB, SQS, Lambda, S3, IAM, CloudWatch) e o schema de tags obrigatório. É o documento referenciado como "padrões globais do projeto" em `../../architecture/spec-dynamodb-access-patterns.md` §35 e `../quality-strategy.md` §7 — antes deste arquivo existir, essa referência estava pendente.

Nomes de recurso são caros de mudar depois (renomear uma tabela DynamoDB em produção é uma migração, não um rename) — por isso a convenção nasce agora, antes do primeiro `terraform apply`, seguindo o mesmo princípio de "decisão cara de reverter se resolve cedo" (`principles.md` §2).

## Por que isso importa (lição do histórico auditado)

Dois incidentes reais do padrão de engenharia auditado (`../../../../auditoria-padrao-qualidade-marcelo-goncalves-blog.md`) vieram diretamente de nomenclatura inconsistente:

```text
Lambda órfã "adminCategories" (EN) coexistindo com a viva "adminCategorias"
(PT) — mesma função, dois nomes, confusão sobre qual está em uso.

Tag "Project" divergente entre ambientes (valor errado em prd.tfvars) —
não detectado até auditoria, porque não havia validação do valor esperado.
```

A convenção abaixo existe para que essas duas classes de erro sejam estruturalmente impossíveis, não apenas desencorajadas.

---

## 1. Identificador do projeto

```text
Nome completo:        event-discovery-platform
Abreviação (prefixo): edp
```

`edp` é usado em todo nome de recurso físico para evitar colisão com outros projetos na mesma conta AWS, e para tornar buscável/filtrável qualquer recurso deste projeto.

## 2. Ambientes

```text
dev
prod
```

Nenhum recurso é criado sem o identificador de ambiente no nome (exceção: recursos genuinamente globais e únicos por conta, ex: um bucket de CloudTrail organizacional — raro neste projeto).

## 3. Padrão geral

```text
edp-{env}-{component}-{purpose}[-{qualifier}]
```

```text
component   subsistema dono do recurso (catalog, matching, notification,
            ingestion, tracking, identity — alinhado a docs/architecture/
            e à pasta services/ correspondente)
purpose     o que o recurso faz, curto e específico
qualifier   opcional — usado quando há mais de um recurso do mesmo tipo/
            propósito (ex: prioridade de fila, tipo de índice)
```

Tudo em `kebab-case` minúsculo, exceto onde o serviço AWS exige outro formato (ex: nome de tabela DynamoDB aceita PascalCase e é o padrão mais legível para esse serviço especificamente — ver §4).

Nunca abreviar um `component`/`purpose` de forma ambígua (`ntf` para notification é ambíguo com "network"; escrever por extenso quando o nome ficar longo é preferível a uma abreviação que precisa de glossário próprio).

---

## 4. DynamoDB

Nome de tabela em `PascalCase`, prefixado com `Edp` + ambiente, sem environment lowercase misturado (padrão mais legível no console AWS e consistente com os nomes lógicos já usados nos specs):

```text
Edp{Env}{TableName}
```

```text
EdpDevInterestIndexTable
EdpProdInterestIndexTable
EdpDevCatalogTable
EdpProdCatalogTable
EdpDevNotificationTable
EdpProdOperationalStateTable
```

`{TableName}` é exatamente o nome lógico já usado nos specs (`InterestIndexTable`, `CatalogTable`, `NotificationTable`, `OperationalStateTable`, `UsersTable`) — nunca inventar um nome físico diferente do nome lógico do spec. Se o spec usa `InterestIndexTable`, o Terraform cria `Edp{Env}InterestIndexTable`, não uma variação.

GSI (quando existir, conforme trigger definido em ADR-003): `GSI1`, `GSI2`, ... — nome genérico e numerado, nunca descritivo do access pattern (o access pattern está documentado no spec, não precisa estar no nome do índice).

## 5. SQS

```text
edp-{env}-{queue-purpose}[-priority]
edp-{env}-{queue-purpose}-dlq
```

```text
edp-dev-ingestion
edp-dev-matching
edp-dev-notification-high
edp-dev-notification-normal
edp-dev-notification-low
edp-dev-notification-high-dlq
edp-dev-notification-normal-dlq
edp-dev-notification-low-dlq
```

Toda fila principal tem sua DLQ com o mesmo nome + sufixo `-dlq` — nunca um nome de DLQ que não deriva mecanicamente do nome da fila principal.

## 6. Lambda

```text
edp-{env}-{component}-{purpose}
```

```text
edp-dev-ingestion-collector-tmdb
edp-dev-ingestion-collector-ticketmaster
edp-dev-ingestion-normalizer
edp-dev-matching-matcher
edp-dev-notification-dispatcher-telegram
edp-dev-notification-planner
edp-dev-tracking-redirect
edp-prod-identity-webhook-telegram
```

Regra explícita contra o incidente do histórico (`adminCategories` vs `adminCategorias`): **um subsistema tem exatamente um nome canônico em inglês**, definido em `docs/domain/glossary.md` quando aplicável. Nunca duas Lambdas com o mesmo propósito e nomes diferentes coexistindo — se uma Lambda é substituída, a antiga é removida no mesmo PR que introduz a nova, nunca deixada "por via das dúvidas".

## 7. S3

```text
edp-{env}-{purpose}
```

```text
edp-dev-raw-events
edp-prod-raw-events
edp-dev-media-uploads
edp-prod-terraform-state       (se não for compartilhado entre projetos)
```

Buckets são globalmente únicos na AWS — se `edp-prod-raw-events` colidir com outra conta, adicionar sufixo de conta/região apenas como último recurso, documentando o desvio.

## 8. IAM

Roles nomeadas pela função exata que executam, nunca compartilhadas entre Lambdas com propósitos distintos (least privilege — ver `quality-strategy.md` §4.2):

```text
edp-{env}-role-{component}-{purpose}
```

```text
edp-dev-role-matching-matcher
edp-dev-role-notification-dispatcher-telegram
edp-dev-role-ingestion-normalizer
edp-prod-role-tracking-redirect
```

Nunca uma role genérica tipo `edp-prod-role-lambda` reutilizada por múltiplas funções — isso é exatamente o padrão de "role única over-privilegiada" que o histórico auditado identificou e corrigiu retroativamente (dividida em 3 roles). Aqui nasce já dividida.

## 9. CloudWatch

Alarmes:

```text
edp-{env}-alarm-{component}-{signal}
```

```text
edp-prod-alarm-notification-high-queue-age
edp-prod-alarm-matching-throttle
edp-prod-alarm-api-5xx-rate
```

Dashboards:

```text
edp-{env}-dashboard-{scope}
```

```text
edp-prod-dashboard-delivery-health
edp-prod-dashboard-matching
```

## 10. API Gateway / endpoints

Nome do API Gateway:

```text
edp-{env}-api-{scope}
```

```text
edp-dev-api-public
edp-dev-api-admin
```

## 11. Terraform

Nome do **resource block** no Terraform (`resource "aws_dynamodb_table" "this" {...}`) é sempre `this` quando o módulo representa um único recurso desse tipo, ou o nome lógico em `snake_case` quando o módulo cria múltiplos (`interest_index`, `catalog`). O **atributo `name`** dentro do resource segue as convenções acima (§4-10). Não confundir os dois — o nome do resource block é identificador Terraform interno, não aparece na AWS.

```hcl
resource "aws_dynamodb_table" "interest_index" {
  name = "Edp${title(var.environment)}InterestIndexTable"
  ...
}
```

Módulos reutilizáveis (`infrastructure/terraform/modules/`) recebem `environment` e `component` como variáveis obrigatórias, nunca hardcodam `dev`/`prod` no nome dentro do módulo.

---

## 12. Tagging — obrigatório em todo recurso taggable

```text
Project      = "event-discovery-platform"
Environment  = "dev" | "prod"
Component    = "<component>"          (mesmo valor usado no nome do recurso)
ManagedBy    = "terraform"
Owner        = "architecture"          (time/pessoa responsável — revisar
                                         quando houver mais de um owner)
```

O valor de `Project` é uma constante Terraform (`local.project_name = "event-discovery-platform"`), nunca uma string literal repetida em cada módulo — isso é exatamente a causa do incidente de tag divergente do histórico auditado (erro de digitação em um `.tfvars` específico). Todo módulo herda as tags via `default_tags` do provider AWS ou via `merge(local.common_tags, ...)`, nunca declara tags soltas por recurso.

## 13. Validação

```text
[ ] terraform plan não deve mostrar nenhum recurso taggable sem as 5 tags
      obrigatórias
[ ] nome físico de tabela/fila/lambda deve ser derivável mecanicamente do
      nome lógico usado no spec correspondente — divergência é bug
[ ] nenhuma role IAM compartilhada por mais de uma função com propósito
      distinto
[ ] nenhum recurso duplicado por rename incompleto (verificar antes de
      cada auditoria de consistência — docs/engineering/quality-strategy.md §9)
```

Esta validação deve compor o Tier A de CI (`quality-strategy.md` §1.1) assim que houver Terraform real para verificar — `terraform validate` sozinho não checa convenção de nome/tag, é preciso um check adicional (ex: `tflint` com regra customizada, ou script simples) quando o volume de recursos justificar automatizar.

## 14. O que fica fora por enquanto

```text
Convenção de nome para múltiplas regiões          → trigger: ADR de
                                                      multi-região (fora do
                                                      MVP, ver backlog)
Convenção de nome para múltiplos bots/contas
  Telegram                                          → trigger: ADR-004
                                                      (multi-bot)
Namespace de tag para billing/cost allocation
  detalhado além de Project/Environment/Component   → trigger: necessidade
                                                      real de FinOps
                                                      granular
```
