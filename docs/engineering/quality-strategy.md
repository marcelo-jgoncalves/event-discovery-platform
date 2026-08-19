# Estratégia de Qualidade — Event Discovery Platform

> Revisão V2: baseline de qualidade world-class pragmática. Mantém rigor nos hot paths e remove burocracia que não produz evidência.

Fonte: síntese de `../../../auditoria-padrao-qualidade-marcelo-goncalves-blog.md` (padrão de engenharia já validado em produção real, incluindo o histórico de incidentes/auditorias) aplicada às decisões desta arquitetura (`docs/architecture/`).

Princípio central, herdado do padrão auditado:

> Rigor técnico combinado com honestidade sobre gaps, não perfeição forçada. Dívida técnica não se esconde — se documenta como item de backlog rastreável.

Este documento é a fonte única de verdade sobre "o que significa qualidade" neste projeto. Padrões de código específicos (nomenclatura, estilo) vivem em `docs/engineering/standards/`; decisões formais vivem em `docs/engineering/decisions/` (ADRs); achados de auditoria vivem em `docs/engineering/audits/`.

---

## 1. Gates automáticos — não negociáveis

Todo PR deve passar, sem exceção, por:

```text
typecheck
lint (type-aware)
format:check
unit tests
integration-fast (DynamoDB Local/serviços locais; sem mock da semântica de persistência)
contract tests (connectors + schemas públicos)
dependency review (bloqueia nova dependência high/critical conhecida)
npm audit --audit-level=high
  (zero high/critical NÃO TRIADO; exceção somente com risk acceptance formal,
   owner, prazo de expiração e compensating control)
SAST (Semgrep: rulesets revisados e pinados para TypeScript/Node/OWASP/secrets/JWT)
secret scan (Gitleaks)
IaC scan (Trivy severity CRITICAL,HIGH + TFLint + terraform validate)
```

Script único por workspace: `npm run verify` = `typecheck && lint && test`. Nenhum PR mergeia com `verify` vermelho — sem bypass, sem `--no-verify`.

**Lição do histórico aplicada:** a série de auditorias do blog mostrou repetidamente CI "de fachada" — Trivy só rodando em `pull_request` mas não no fluxo real de push, build só validado depois do merge, lint configurado mas não plugado no pipeline. Aqui, todo gate deve ser verificado contra o **fluxo real de deploy**, não contra a intenção documentada. Isso é auditável: `docs/engineering/audits/` deve conter, a cada auditoria, uma confirmação de que o gate realmente bloqueia (não apenas existe no YAML).

Actions/workflows de CI pinados por SHA, nunca por tag mutável (achado do histórico: `trivy-action@master` era pior que tag).


### 1.1 Pirâmide de gates — feedback rápido sem sacrificar evidência real

Nem todo teste pesado deve rodar em todo PR. O gate continua não negociável, mas é dividido por risco e custo:

```text
Tier A — todo PR, obrigatório e rápido
  typecheck
  lint + format:check
  unit
  contract
  integration-fast (DynamoDB Local / emuladores controlados)
  dependency review
  npm audit
  SAST / secret scan / IaC scan
  terraform validate / plan quando houver mudança de infra

Tier B — merge para main / ambiente dev efêmero ou dedicado
  integration-aws-real
  E2E vertical slice
  smoke tests
  validação de IAM/configuração real via AWS CLI/API
  DAST baseline contra ambiente implantado

Tier C — nightly e antes de release
  scale tests
  failure tests
  full DAST
  restore drill quando aplicável
  dependency drift / connector canaries
  auditoria de consistência automatizada
```

Regra: um Tier A vermelho bloqueia o merge. Tier B vermelho bloqueia promoção para produção. Tier C abre incidente/item de release e bloqueia release quando afetar segurança, integridade de dados ou hot path.

**Razão:** DynamoDB Local é um emulador útil, não prova equivalência total com o serviço AWS. A estratégia exige pelo menos uma camada de integração contra AWS real antes de promoção.

### 1.2 Software supply chain — baseline obrigatório

```text
- `package-lock.json` versionado; CI usa `npm ci`, nunca `npm install`
- versão de Node e package manager pinadas no repositório
- GitHub Actions pinadas por full commit SHA
- Dependency Review obrigatório em PR que altera dependências
- Dependabot security updates habilitado; version updates agrupados e revisados
- política de licenças explícita antes de aceitar dependências novas
- artefatos de release com SBOM e provenance/attestation quando o pipeline de
  release passar a produzir artefatos distribuíveis
- nenhum artefato é promovido para prod se tiver sido rebuildado fora do
  pipeline que passou nos gates; promover o mesmo artefato imutável
```

A política de vulnerabilidades é **zero high/critical não-triado**, e não "zero vulnerabilidade a qualquer custo". Exceções exigem registro com CVE/advisory, impacto, reachability quando conhecida, compensating control, owner e data de expiração.

---

## 2. Testes — proporcional ao domínio, não genérico

Este projeto tem três hot paths que decidem se o produto funciona: **data quality/ingestion**, **matching** (DynamoDB) e **delivery** (Telegram rate limit). Um sistema tecnicamente saudável que notifica o evento, horário, cidade ou link errados é um produto quebrado. A estratégia de testes reflete isso, não uma cobertura uniforme por %.

### 2.1 Obrigatório por camada

```text
Unit        — regras determinísticas: canonical key generation, location
              normalization, interestId generation, scoring do matcher,
              token bucket, priority resolution
Integration-local — contra DynamoDB Local (emulador, sem mock): criar
              interesse escreve as duas projeções; falha de condição não
              escreve nenhuma; remoção apaga ambas; ANY e cidade exata
              retornam candidatos corretos; leitura forte observa write
              imediatamente
Integration-AWS — contra DynamoDB gerenciado em ambiente isolado: validar
              semântica crítica que o emulador não prova (consistência,
              paginação, condições/transações, IAM e configuração real)
Contract    — cada connector (TMDB, Ticketmaster) tem fixtures de payload
              real → representação canônica esperada
DataQuality  — invariantes do catálogo: timezone/cidade válidos, startAt
              coerente, URL de saída em allowlist de provider, evento
              expirado não gera notificação, payload bruto nunca vaza ao
              domínio, campos obrigatórios ausentes geram estado observável
E2E         — vertical slice completo: fixture → collector → normalizer →
              catalog → matcher → fake Telegram provider → assert de
              exatamente uma notificação
Scale       — fixtures de 1k/10k/100k subscribers numa partição, validando
              paginação, latência, throttling, deduplicação de candidatos
              (exigido explicitamente em spec-dynamodb-access-patterns.md §34)
Failure     — cenários obrigatórios do spec-notification-delivery.md §57:
              429 com retry_after, 500, timeout, bot bloqueado, burst de
              10k na fila HIGH, todas as filas com backlog simultâneo,
              rate limiter store indisponível, crash pós-accept do provider,
              thundering herd às 08:00 (fim de quiet hours), candidato
              duplicado
```

**Lição do histórico aplicada:** o `admin-test-plan.md` do blog descobriu que fetch bloqueado por CORS no browser ainda executa no Lambda — CORS não protege contra mutação real. Todo teste de integração contra endpoints reais deve rodar num ambiente isolado (`dev` dedicado, nunca `local` apontando sem querer para recurso real) e validar isso explicitamente antes de confiar no isolamento.

### 2.2 Meta de cobertura

Não adotar meta de cobertura percentual sem enforcement real (`coverageThreshold` no config, checado em CI). O histórico do blog documenta uma meta de 80% que nunca teve enforcement — declarada mas não verificada. Aqui: se uma meta for definida, ela nasce com `coverageThreshold` configurado no mesmo commit, ou não é declarada.


### 2.3 Política de flaky tests

```text
- retry automático pode existir somente para diagnosticar flakiness, nunca
  para transformar teste instável em verde silencioso
- qualquer teste que passe apenas após retry gera métrica/annotation
- flaky test do hot path bloqueia release até correção ou quarantine formal
- quarantine exige owner, issue e prazo de expiração
- meta operacional: flaky rate < 1% das execuções; hot-path flaky rate = 0
```

### 2.4 Contract drift dos providers

Fixtures são necessárias, mas podem envelhecer. Criar canary read-only agendado contra TMDB/Ticketmaster que:

```text
consulta endpoint real conhecido
→ valida schema mínimo
→ executa normalização
→ verifica invariantes
→ registra provider_contract_drift
```

O canary não deve criar dependência do provider nos testes de PR; ele existe para detectar mudança externa antes que afete usuários.

---

## 3. Regra de negócio crítica como teste nomeado

Herdado diretamente do padrão do blog (`docs/engineering/standards/testing-strategy.md` de lá): toda regra de negócio essencial vira um teste com nome legível, não apenas um caso genérico. Mínimo obrigatório antes do primeiro release:

```text
"User follows Christopher Nolan → new Interstellar screening in Belo Horizonte
 → exactly one notification, priority P1, sent within Match Latency SLO"

"User follows Interstellar with locationScope=ANY → screening in any city
 → matched; screening in unfollowed city with locationScope=CITY#X → not matched"

"Duplicate NotificationCandidate for same idempotencyKey → suppressed,
 not double-sent"

"Telegram 429 with retry_after → message durably requeued, not immediately
 retried, does not count against DLQ maxReceiveCount"

"Global token bucket exhausted → messages accumulate in SQS, provider
 receives zero additional calls"
```

---

## 4. Segurança — metodologia, não só controles

O histórico revela que os controles isolados (sanitizer, IAM, CSP) surgiram principalmente de **auditorias dedicadas** com metodologia formal, não de revisão ad-hoc. Adotar a mesma prática desde o início:

### 4.1 Auditoria de segurança dedicada (cadência: antes de cada release maior + trimestral)

Metodologia (herdada de `auditoria-appsec/00-metodologia.md` do blog):

```text
OWASP ASVS v5 — Level 1 obrigatório + itens selecionados de Level 2
API Security Top 10 2023
AWS Well-Architected Security Pillar
```

Validação real via AWS CLI/GitHub API — não apenas leitura de código. Exemplo do padrão: confirmar `describe-user-pool-client` (MFA real ligado?), `cloudtrail get-trail-status`, `guardduty get-detector`, checar branch protection via API (não assumir que existe).

### 4.2 Controles não-negociáveis desde o dia 1 (aprendidos de incidentes reais do histórico)

```text
- Sanitização de HTML com allowlist explícita aplicada a TODO campo
  renderizado via dangerouslySetInnerHTML/v-html — não só o campo óbvio
  (o blog teve XSS real porque sanitizava conteudo_html mas esqueceu bio)
- JSON-LD nunca serializado sem escapar </script>, <, > (9 ocorrências
  vulneráveis encontradas no histórico do blog)
- Least privilege IAM por função (matcher não escreve em UsersTable PII;
  dispatcher só lê o secret do provider que usa; nenhuma role "*"/"*")
- Bot token e credenciais de provider em Secrets Manager, nunca em
  .env commitado ou Terraform variable plaintext
- CloudTrail multi-região + GuardDuty ativos desde o primeiro ambiente
  (o blog não tinha nenhum dos dois até a auditoria AppSec identificar)
- Branch protection em main/develop confirmada via API, não assumida
- MFA no Cognito/IdP administrativo — se for adiado por decisão de
  produto, registrar como decisão explícita com dono e prazo de revisão,
  nunca como esquecimento
- Rate limiting em toda API pública (o blog só adicionou usage_plan/
  throttling no API Gateway depois da auditoria AppSec)
- Nenhuma Lambda Function URL pública sem OAC + IAM assinado — o
  incidente do blog (`reports/lambda-exposta.md`) documenta o risco de
  "Denial of Wallet" quando isso vaza de dev para produção
```

### 4.2.1 Threat modeling leve e obrigatório

Antes do primeiro beta e após mudança estrutural de auth, tracking, webhook ou provider:

```text
DFD simples
trust boundaries
assets sensíveis
abuse cases
STRIDE como checklist, não como burocracia
mitigações + risco residual
```

Threat model mínimo deve cobrir: Telegram webhook, Cognito/auth, affiliate redirect, connector ingestion, PII, rate limiter e pipeline de CI/CD.

### 4.2.2 DAST em ambiente implantado

SAST não substitui teste dinâmico. Adotar DAST contra ambiente dev/pre-prod:

```text
baseline scan no Tier B
full scan antes de release maior e em cadência agendada
zero high/critical não-triado para promoção
```

O scanner nunca roda contra produção com ações destrutivas.

### 4.3 Superfícies específicas deste projeto a auditar desde já

```text
Telegram bot token / webhook signature validation
Payload de connectors externos (TMDB/Ticketmaster) tratado como
  input não confiável antes da normalização (anti-corruption layer
  já é decisão arquitetural — a AppSec deve confirmar que o
  normalizer de fato nunca deixa campo bruto vazar ao domínio)
Rate limiter distribuído em DynamoDB — não deve expor chatId cru em
  logs/métricas (usar chatIdHash, conforme já decidido em
  spec-notification-delivery.md §19 e §56)
Tracking/affiliate redirect (§23-24 da arquitetura V1) — todo link de
  saída deve passar por validação de destino antes do 302, para não
  virar open redirect
```

---

## 5. Observabilidade e SLO — formalizados desde a V1

O histórico do blog mostra que observabilidade (alarmes, X-Ray) foi implementada no código mas ficou **desligada em dev** por muito tempo, e o SLO de disponibilidade só foi formalizado tarde. Aqui, adotar desde o primeiro ambiente:

### 5.1 Four Golden Signals (Google SRE), com números concretos desde o dia 1

```text
Latência    — por endpoint/hot path; baseline inicial medido antes de
              congelar threshold. Não usar um único p99 de 5s para mascarar
              endpoints lentos.
Erros       — taxa, não só contagem absoluta:
              API 5XX / requests e Lambda Errors / Invocations, com alarme
              absoluto complementar para baixo tráfego
Saturação   — SQS ApproximateAgeOfOldestMessage por fila de prioridade
              (thresholds definidos em spec-notification-delivery.md §39)
Tráfego     — matcher_query_count, telegram_send_rate
DataQuality — source_freshness, normalization_invalid_rate,
              stale_event_notification_count, outbound_link_invalid_count
```

### 5.2 SLOs formais deste projeto (já definidos nos specs — tornar executável em CloudWatch desde o início)

```text
Match Latency      P95 < 60s / P99 < 180s (MVP)
Delivery Latency    P95 < 60s / P99 < 180s (MVP steady-state)
Disponibilidade API — definir explicitamente (ex: 99.5% mensal, decisão
  consciente e documentada, não "99.9% de mercado" copiado sem análise
  de custo/benefício para o estágio do produto)
```

Multiwindow multi-burn-rate alarms (Google SRE Workbook) desde o primeiro deploy em produção, não como retrofit — fast burn (5min/1h) para página, slow burn (1h/6h) para ticket. `treat_missing_data=notBreaching` para não gerar falso positivo em ausência de tráfego.

### 5.3 Métricas obrigatórias específicas dos hot paths

Todas já especificadas nos documentos de arquitetura — a estratégia de qualidade exige que estejam **implementadas e visíveis em dashboard antes do primeiro usuário real**, não adicionadas reativamente após incidente:

```text
spec-dynamodb-access-patterns.md §33  — interest_create_*, matcher_query_*,
                                          matcher_candidates_*
spec-notification-delivery.md §42-44  — notification_*, telegram_*, filas
```


### 5.4 Data Quality — terceiro hot path

Qualidade do catálogo é requisito funcional, não analytics secundário.

Invariantes mínimas antes de um evento ficar `READY`:

```text
canonicalId presente e estável
source + sourceId presentes
startAt parseável e timezone explícito
location normalizada
status conhecido
outbound URL pertence a provider/host permitido
evento expirado/cancelado não entra em matching acionável
raw fields não atravessam o anti-corruption layer sem normalização
```

Métricas mínimas:

```text
source_freshness_seconds{provider}
normalization_invalid_rate{provider}
unresolved_entity_rate{provider}
duplicate_canonical_rate
stale_event_notification_count
invalid_outbound_link_count
provider_contract_drift
```

SLO inicial de integridade:

```text
stale_event_notification_count = 0
invalid_outbound_link_count = 0
```

Qualquer ocorrência é incidente de produto mesmo que disponibilidade técnica esteja 100%.


---

## 6. Governança de dados sensíveis (LGPD) — desde o modelo, não como retrofit

O histórico do blog mostra textos legais com retenções numéricas concretas definidas tarde. Aqui, como o produto tem cadastro de usuário real (diferente do blog, que é editorial sem PII de usuário final), isso é P0 desde o desenho:

```text
- PII nunca entra em InterestIndexTable (decisão já tomada em
  spec-dynamodb-access-patterns.md §24-25) — matcher trabalha só com
  userId opaco
- Fluxo de exclusão de conta (§26 do spec) formalizado e testado antes
  do primeiro usuário real: marca DELETING, para novo planejamento de
  notificação, apaga projeções, expira referências PII conforme
  retenção definida
- Consentimento (Telegram opt-in, futuro GA4/analytics) modelado como
  registro versionado (purpose, version, grantedAt, source) — não como
  boolean solto
- Retenção de logs técnicos curta e explícita (referência do histórico:
  15 dias) — decidir e documentar o número deste projeto, não herdar
  sem revisão
- Nunca logar chatId cru, telefone, e-mail — sempre hash (já decidido
  nos specs)
```

---

## 7. Infraestrutura como código

```text
Tudo em Terraform — nenhum recurso manual em nenhum ambiente
Remote state com lock desde o primeiro commit de infra
PITR habilitado em prod (explicitamente desabilitado em dev por
  decisão, não por padrão default silencioso — lição direta do
  histórico: prd.tfvars caiu no default false por omissão)
Nome físico de recurso e tags obrigatórias seguindo
  docs/engineering/standards/resource-naming.md, sem exceção (o histórico
  documenta erro de tag Project entre ambientes — checar em auditoria de
  consistência)
Least privilege IAM por role funcional, nunca role única compartilhada
  entre múltiplas Lambdas com propósitos distintos
- Backup não é considerado validado sem restore: PITR/backup de produção deve
  ter restore drill periódico em ambiente isolado
- Deploy promove o mesmo artefato já testado; não rebuildar entre dev e prod
- Mudanças incompatíveis de schema/contrato exigem estratégia expand/contract
  ou versionamento compatível antes do deploy
```

---

## 8. Documentação e processo

Estrutura já em uso neste projeto (`docs/`), com papéis distintos e sem duplicação:

```text
docs/architecture/        — arquitetura vigente e specs técnicos
docs/engineering/standards/  — convenções de código, testes, git/PR
docs/engineering/decisions/  — ADRs formais e numerados
docs/engineering/audits/     — achados de auditoria (segurança,
                                consistência, performance) com IDs
                                estáveis e datados
docs/adr/                 — (se preferir manter separado de engineering/decisions)
docs/api/                 — contratos de API
docs/runbooks/            — procedimentos operacionais
```

### 8.1 ADRs — formalizar decisões, não duplicar specs

Os ADRs devem registrar decisões independentes e caras de mudar. Não criar um ADR separado para cada detalhe interno de um spec quando eles mudam juntos.

Baseline recomendado:

```text
ADR-001 Messaging Topology V1 — SQS-first
ADR-002 Canonical Entity Identification
ADR-003 Interest Index DynamoDB Design
        (inclui location-aware matching, duplicate projections vs GSI,
         capacity mode, consistency e trigger de hot-partition sharding)
ADR-004 Notification Delivery Semantics and Provider Throughput
        (inclui priority scheduling, safe throughput, SQS/Lambda concurrency,
         429, ambiguous delivery e quiet hours)
ADR-005 AI Enrichment Lifecycle
ADR-006 Provider Abstraction and Multi-channel Boundary
ADR-007 Idempotency Strategy
ADR-008 Tracking and Affiliate Redirect Model
ADR-009 Quality Gate and Exception Policy
```

Criar cada ADR **antes da implementação do componente afetado**, não todos antes da primeira feature. Cada ADR: contexto, decisão, alternativas consideradas, consequências e referência ao spec; nunca recriar o spec inteiro.

### 8.2 `CLAUDE.md` na raiz do projeto (ainda não criado — próximo passo recomendado)

Enxuto, com papel/autoridade, princípios (DRY/KISS/YAGNI com julgamento), protocolo de investigação, validação proporcional a risco, convenções de idioma (código em inglês — decidir isso antes de escrever a primeira linha, ao contrário do blog que acumulou ~730 comentários em português para migrar depois), regra "why not what" para comentários, política de Git/PR. Seção explícita "o que NÃO vai aqui".

### 8.3 PR obrigatório com estrutura padrão

```text
Contexto | Problema | Hipótese | Escopo | Riscos | Evidências | Rollback
```

Conventional Commits obrigatório desde o primeiro commit.

---

## 9. Auditoria de consistência periódica

Adotar o mesmo instrumento do blog (`project-consistency-audit.md`), com rubrica 0-10 por área, IDs estáveis (`PCA-YYYYMMDD-NNN`), severidade/confiança explícitas. Cadência: após qualquer mudança estrutural em arquitetura/contrato/governança, antes de cada release, e mensalmente enquanto o produto for pequeno o suficiente para isso ser barato.

**Lição central do histórico a aplicar aqui:** a série de auditorias do blog (jun-ago 2026) descobriu repetidamente que "documentado como resolvido" e "estado real do código" divergiam — contagem errada de Lambdas, dependências desatualizadas apesar de relatório dizer o contrário, premissas erradas sobre versionamento de ferramentas. A regra operacional:

> Auditar contra a realidade (rodar o comando, consultar a API, ler o config real), nunca contra a documentação.

Toda auditoria deste projeto deve incluir pelo menos uma verificação executada ao vivo (CLI/API), não só leitura de arquivo.

---

## 10. Performance — medir antes de otimizar, mas medir cedo

```text
Lighthouse CI no frontend desde o primeiro deploy, com threshold do
  Google como meta (LCP <=2.5s) — se não for atingido, isso vira item
  de backlog rastreado com causa raiz, não escondido (lição central do
  padrão do blog: relatar o número real mesmo fora da meta)
k6 ou equivalente para carga do matcher/dispatcher antes de assumir
  que os cálculos teóricos dos specs (28 msg/s, throughput de
  matching) se sustentam sob concorrência real
CloudFront PriceClass cobrindo a região de usuários reais desde o
  primeiro deploy (o histórico do blog documenta uma causa raiz de
  performance mobile inteiramente por excluir o Brasil do PriceClass)
Nenhuma variante de imagem única servida para todos os dispositivos —
  gerar variantes por breakpoint desde o pipeline de mídia inicial
Nenhum Scan sem Limit em código novo — todo acesso a DynamoDB nasce
  como Query sobre uma PK desenhada para o access pattern (os specs já
  garantem isso para o matcher; aplicar a mesma disciplina em qualquer
  tabela nova)
```

### 10.1 Acessibilidade é gate de produto

O frontend deve mirar **WCAG 2.2 AA**.

Automação mínima:

```text
Playwright + axe nos fluxos críticos
keyboard-only smoke test
focus visible / focus order
labels e nomes acessíveis
contraste e estados de erro
```

Antes de release maior, executar também revisão manual curta com teclado e pelo menos um fluxo com tecnologia assistiva. Lighthouse não substitui teste de acessibilidade.



### 10.2 Release, rollback e recuperação

Todo release para produção deve produzir evidência:

```text
commit SHA
artifact digest
resultado dos gates
terraform plan aplicado
smoke test pós-deploy
rollback path
```

Rollback deve ser testável e o runbook não pode depender de memória humana.

Para dados:

```text
PITR habilitado
restore drill periódico
RPO/RTO definidos quando houver primeiro dado real de usuário
resultado do restore registrado em docs/engineering/audits/
```

### 10.3 Política de exceções de qualidade

"Sem bypass" significa sem bypass informal. Em incidente ou vulnerabilidade sem correção imediata, a única exceção válida é formal:

```text
exceptionId
control/gate afetado
justificativa
risco
compensating control
owner
createdAt
expiresAt
revalidation trigger
```

Exceção expirada bloqueia release automaticamente quando tecnicamente possível.


---

## 11. O que fica deliberadamente fora do MVP (evitar sofisticação prematura)

Herdado das decisões já tomadas na arquitetura V2 — reafirmado aqui como política de qualidade, não só de arquitetura, porque "gold-plating" também é risco de qualidade (tempo gasto em robustez não testada por uso real):

```text
EventBridge como domain bus central (SQS-first até 2º consumidor real)
Entity resolution fuzzy/IA (2 níveis determinísticos + review queue até
  haver evidência real de conflito)
Sharding de partição DynamoDB (até trigger numérico documentado)
Contador de assinantes síncrono (até virar user-facing)
Multi-região, cell architecture, OpenSearch, DAX, Global Tables
Auto-tuning de rate limit (ajuste manual documentado até haver
  evidência de necessidade de automação)
```

Regra: cada item acima só entra em escopo quando o trigger de evolução já definido nos specs (`docs/architecture/spec-*.md`) for observado — nunca antecipadamente "para o caso de precisar".

---

## 12. Honestidade sobre dívida técnica — política explícita

Adotada diretamente do traço mais valioso identificado na auditoria do blog:

```text
Toda simplificação deliberada da V1 é documentada com sua condição de
  evolução explícita (já é o padrão dos specs desta arquitetura — manter).
Todo item de backlog aberto por decisão consciente (não por esquecimento)
  é marcado como tal, com dono e critério de reavaliação.
Nenhuma métrica fora da meta é escondida de dashboard — é reportada com
  causa raiz, mesmo que a correção seja adiada.
Auditorias registram o que NÃO foi verificado, não só o que foi.
```

---

## 14. Enforcement independente de IA — regra constitucional

> Nenhum requisito crítico de qualidade pode depender exclusivamente de instrução para IA, revisão de código ou documentação. Todo requisito crítico deve possuir um mecanismo independente de enforcement ou verificação.

Adotada em ADR-011. Para todo requisito crítico novo, a pergunta operacional é "quem garante isso?" — se a resposta for "a IA deveria lembrar", o requisito não tem enforcement suficiente. Quatro camadas, cada uma respondendo a uma pergunta diferente (elaboração completa em `docs/engineering/quality-enforcement-system.md`):

```text
Static Policy Gates            — o código viola alguma regra proibida?
Architecture Fitness Functions — a estrutura respeita os boundaries?
Behavior Tests                 — o sistema se comporta corretamente?
Reality Audits                 — o que está rodando bate com código/infra/docs?
```

Registry de regras com enforcement real (não aspiracional): `docs/engineering/quality-rules.md`. Implementação incremental — condicionada ao primeiro código do módulo correspondente existir, não construída antecipadamente sem código para proteger (ADR-011, mesmo princípio de `principles.md` §2 já aplicado no resto deste documento).

## 15. Checklist de bootstrap (próximos passos concretos)

```text
[ ] Criar CLAUDE.md na raiz (seção 8.2)
[ ] Criar docs/engineering/standards/{code-conventions,testing-strategy,
      git-and-review-workflow}.md
[ ] Formalizar os ADRs consolidados da seção 8.1 just-in-time, antes da
      implementação do componente afetado
[ ] Configurar CI Tier A/B/C (seção 1.1), incluindo verify, Dependency
      Review, Semgrep, Gitleaks, npm audit, Trivy/TFLint e integration-aws-real
[ ] Configurar CloudTrail + GuardDuty no primeiro ambiente AWS criado
      (não esperar auditoria posterior)
[ ] Confirmar branch protection via API antes do primeiro merge em main
[ ] Escrever os testes de regra de negócio crítica (seção 3) como
      primeiro E2E, antes de qualquer feature adicional
[ ] Configurar dashboards de SLO (seção 5) antes do primeiro usuário real
[ ] Definir e documentar retenção de dados/consentimento (seção 6) antes
      de armazenar o primeiro dado de usuário real
[ ] Implementar Data Quality invariants + métricas (seção 5.4) antes do
      primeiro evento real poder ficar READY
[x] Habilitar Dependabot + Dependency Review e pin de Node/package manager
      — CORRIGIDO 2026-08-19 (revisão de qualidade de engenharia):
      `.github/dependabot.yml` criado; Dependency Review e pin de
      Node/npm já existiam (`.github/workflows/ci.yml`, `.nvmrc`, `.npmrc`)
[ ] Adicionar DAST Tier B e threat model inicial antes do primeiro beta
[ ] Adicionar axe/Playwright para fluxos críticos do frontend
[ ] Executar primeiro restore drill antes de considerar backup "validado"
[ ] Definir política de exceções de qualidade com owner + expiry
```
