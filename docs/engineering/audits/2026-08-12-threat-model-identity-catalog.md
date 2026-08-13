---
status: applied
date: 2026-08-12
scope: services/identity, services/catalog, connectors/tmdb, connectors/ticketmaster, infrastructure/terraform/modules/identity, infrastructure/terraform/modules/catalog, .github/workflows
---

# Threat Model Leve (STRIDE) — Identity + Catalog

> Gatilho: `docs/engineering/quality-strategy.md` §4.2.1 exige threat modeling leve "antes do primeiro beta e após mudança estrutural de auth, tracking, webhook ou provider". Phase 1 (Cognito/auth, ADR-012) e Phase 2 (TMDB/Ticketmaster ingestion, ADR-013) já dispararam esse gatilho e ainda não tinham um threat model formal registrado — este documento é o primeiro. Metodologia: DFD simples, trust boundaries, assets sensíveis, abuse cases, STRIDE como checklist, mitigações + risco residual, por área — igual ao mínimo exigido em §4.2.1.

## Como este documento foi produzido

Baseado em leitura direta do código real (`services/identity/src/pii/*`, `services/identity/src/application/*`, `connectors/tmdb/src/tmdb-client.ts`, `connectors/ticketmaster/src/ticketmaster-client.ts`, `services/catalog/src/*`), do Terraform real (`infrastructure/terraform/modules/identity/main.tf`, `modules/catalog/main.tf`), e dos workflows de CI reais (`.github/workflows/ci.yml`, `security.yml`). Nenhum componente é inventado: onde o escopo exigido por `quality-strategy.md` §4.2.1 ainda não existe no repositório (Telegram webhook, affiliate redirect, rate limiter), a área é marcada explicitamente **N/A — não implementado** em vez de modelada especulativamente. Verificação ao vivo: branch protection e IAM role de CI confirmados via `gh api`/`node quality/scripts/audit-reality.mjs` na mesma sessão desta auditoria (ver `docs/engineering/audits/reports/2026/2026-08-12-full-project-audit.md`); GuardDuty/CloudTrail/estado real do Cognito não verificáveis (sem credenciais AWS neste ambiente) — tratados como não verificados, não como "ok".

## Escopo mínimo exigido por §4.2.1 — status de cobertura

```text
Telegram webhook          → N/A, não implementado (nenhum arquivo em apps/telegram-webhook; Phase 5)
Cognito/auth               → coberto abaixo
Affiliate redirect         → N/A, não implementado (ADR-008 existe como decisão futura; nenhum código; Phase de tracking não iniciada)
Connector ingestion        → coberto abaixo (TMDB + Ticketmaster)
PII                        → coberto abaixo (integrado à área de auth, é o mesmo boundary)
Rate limiter               → N/A, não implementado (spec-notification-delivery.md desenha o rate limiter, mas nenhum código de services/notification existe ainda; Phase 5+)
Pipeline CI/CD              → coberto abaixo
```

Três das seis áreas obrigatórias são N/A por não existir código para modelar — registrado explicitamente aqui em vez de omitido, e deve ser revisitado quando cada uma ganhar o primeiro código real (mesmo gatilho já usado para Architecture Fitness Functions em `docs/backlog.md`).

---

## 1. Cognito / Auth (`services/identity`)

### 1.1 DFD simples

```text
Caller (interno, apps/web ou apps/telegram-webhook futuros —
hoje só chamado programaticamente/em teste, sem HTTP endpoint real)
        │
        ▼
services/identity/src/application/{signup,login}.ts
        │
        ├──▶ services/identity/src/pii/cognito-client.ts ──▶ AWS Cognito User Pool
        │        (único módulo com acesso a PII bruta:
        │         email, senha)
        │
        └──▶ services/identity/src/infra/users-table-repository.ts ──▶ UsersTable (DynamoDB)
                 (PROFILE não-PII + CONSENT#<purpose>)
```

### 1.2 Trust boundaries

```text
Boundary 1: caller externo/interno ↔ services/identity
  (hoje sem HTTP endpoint real — spec-identity.md §3.4/§10 confirma:
   "sem apps/web para consumir"; boundary existe no desenho, ainda
   não está exposto a uma rede não confiável)

Boundary 2: services/identity ↔ Cognito (AWS)
  (autenticado via App Client confidencial + secret em Secrets Manager;
   nunca client público)

Boundary 3: services/identity/src/pii/* ↔ resto do monorepo
  (boundary interno, arquitetural — Architecture Fitness Function
   QR-012 impede import de fora de services/identity; comprovado
   via npm run quality:self-test nesta sessão, 8/8 controls PASS)

Boundary 4: services/identity ↔ UsersTable (DynamoDB)
  (IAM least-privilege — infrastructure/terraform/modules/identity/main.tf:
   GetItem/PutItem/UpdateItem/Query apenas na tabela UsersTable, nunca
   Scan, nunca wildcard resource)
```

### 1.3 Assets sensíveis

```text
Credenciais de usuário (email, senha)     — vivem só no Cognito, nunca em UsersTable
App Client secret (Cognito)                — Secrets Manager
userId (Cognito sub)                       — não-PII, mas chave de correlação
Tokens de sessão (access/id/refresh)       — retornados por login(), não persistidos
                                              em UsersTable (verificado: login.ts
                                              não grava tokens em nenhum repositório)
Registro de consentimento (CONSENT#*)      — não-PII isoladamente, mas correlacionável
                                              a userId
```

### 1.4 Abuse cases

```text
AC-1: atacante tenta enumerar contas via SignUp (username já existe)
      → mitigado: prevent_user_existence_errors = "ENABLED" no App Client
        (infrastructure/terraform/modules/identity/main.tf linha 80)

AC-2: atacante tenta brute-force de senha via InitiateAuth
      → parcialmente mitigado: Cognito tem proteção nativa contra
        brute-force (não configurável via este Terraform, comportamento
        gerenciado pela AWS) — NÃO VERIFICADO nesta sessão (sem AWS real
        para confirmar throttling efetivo); password policy mínima de
        12 caracteres + maiúscula/minúscula/número/símbolo reduz espaço
        de ataque de dicionário simples

AC-3: atacante com acesso de leitura ao código/logs tenta recuperar
      PII de UsersTable diretamente
      → mitigado estruturalmente: UsersTable nunca contém email/telefone/
        nome (spec-identity.md §4.1, confirmado por leitura do schema
        real em users-table-repository.ts e do módulo pii/) — mesmo um
        vazamento completo da tabela não expõe credenciais

AC-4: log acidental de PII bruta (email) em algum ponto do código
      → mitigado por controle automático: Semgrep custom rule EDP004
        (quality/policies/code/edp004-no-raw-pii-log.yaml), comprovado
        via npm run quality:self-test nesta sessão (fixture inválida
        rejeitada, exit 1; fixture válida aceita, exit 0) — hashPII()
        (services/identity/src/pii/hash.ts) é o caminho seguro de log

AC-5: código fora de services/identity tenta importar o cliente Cognito
      diretamente para contornar a camada de aplicação
      → mitigado por Architecture Fitness Function QR-012, comprovado
        nesta sessão (8/8 controls operational)

AC-6: atacante compromete o App Client secret
      → parcialmente mitigado: secret vive em Secrets Manager, nunca
        em Terraform var/tfvars plaintext (confirmado no .tf); rotação
        do secret NÃO está automatizada nem documentada como processo —
        risco residual real
```

### 1.5 STRIDE checklist

| Categoria | Aplica? | Mitigação observada | Risco residual |
|---|---|---|---|
| **S**poofing | Sim | App Client confidencial (secret), `SECRET_HASH` obrigatório em todo comando Cognito (`computeSecretHash` em `cognito-client.ts`) | MFA é `OPTIONAL` para usuário final (decisão de produto, não falha) e explicitamente adiado para admin (ADR-012, dono+prazo registrados) — spoofing de conta sem MFA continua possível via credencial vazada |
| **T**ampering | Sim | `UpdateItem`/`PutItem` restritos por IAM à role de identity; sem endpoint HTTP público ainda (boundary 1 não exposto) | Quando o endpoint HTTP existir (Phase futura), validação de input na fronteira não foi auditada aqui porque não existe ainda — reavaliar neste threat model quando `apps/web`/`apps/telegram-webhook` chamarem `services/identity` via rede |
| **R**epudiation | Parcial | `createdAt`/`updatedAt` em `PROFILE`, `grantedAt`/`source` em `CONSENT#*` — dão trilha básica | Sem log estruturado de auditoria de auth (quem logou, quando, de onde) verificado nesta sessão — CloudWatch Logs existe mas conteúdo/retenção real não verificado (sem AWS real) |
| **I**nformation disclosure | Sim | UsersTable nunca tem PII bruta (AC-3); hash de PII em log (AC-4); secret em Secrets Manager | Tokens de sessão retornados por `login()` — o consumidor downstream (ainda inexistente) precisa tratá-los como segredo; esse contrato não é validado por este threat model porque o consumidor não existe ainda |
| **D**enial of service | Não avaliado a fundo | Cognito tem quota/throttling gerenciado pela AWS | Rate limiting de aplicação (camada própria) não existe — fora do escopo de Phase 1; nenhuma proteção adicional de `services/identity` contra abuso de `SignUp`/`InitiateAuth` além do nativo do Cognito |
| **E**levation of privilege | Sim | IAM da role `identity_service` restrita a ações específicas (`SignUp`, `InitiateAuth`, `ConfirmSignUp`, `ForgotPassword`, `ConfirmForgotPassword`) — nunca `cognito-idp:*` | Nenhum modelo de admin/privilégio elevado existe ainda no domínio (`AdminGetUser` citado no spec como fora de escopo) — sem superfície de elevação de privilégio a testar hoje |

### 1.6 Mitigações existentes vs. risco residual

**Mitigações confirmadas por evidência direta nesta sessão:** boundary de PII estrutural (código + Terraform + fitness function comprovada), secret management correto, password policy adequada, prevenção de user enumeration, hashing de PII para log comprovado por controle automático.

**Risco residual real (não hipotético):** (1) ausência de MFA administrativo até Phase 7 — decisão aceita, não esquecimento, mas é risco real enquanto não existir; (2) sem rotação de secret documentada; (3) boundary 1 (caller ↔ identity) ainda não foi expresso como superfície de rede real — este threat model cobre o desenho atual, não substitui reavaliação quando o primeiro endpoint HTTP existir (gatilho explícito de `quality-strategy.md` §4.2.1 "após mudança estrutural... webhook").

---

## 2. Connector Ingestion (TMDB + Ticketmaster) — `connectors/tmdb`, `connectors/ticketmaster`, `services/catalog`

### 2.1 DFD simples

```text
TMDB API (api.themoviedb.org)           Ticketmaster API (app.ticketmaster.com)
        │                                        │
        ▼                                        ▼
connectors/tmdb/src/tmdb-client.ts      connectors/ticketmaster/src/ticketmaster-client.ts
        │                                        │
        ▼ (ProviderConnector.collect())          ▼
        └──────────────┬─────────────────────────┘
                        ▼
              RawSourceEvent (payload: unknown)
                        │
                        ▼
           services/catalog normalizer
           (tmdb-normalizer.ts / ticketmaster-normalizer.ts)
                        │
                        ▼
                  CatalogTable (DynamoDB)
                        │
                        ▼
        catalog.event.normalized.v1 (structured log,
        sem fila/tópico dedicado ainda — spec-catalog.md §6)
```

### 2.2 Trust boundaries

```text
Boundary 1: TMDB/Ticketmaster (provider externo, não confiável por padrão)
            ↔ connectors/tmdb, connectors/ticketmaster

Boundary 2: connector ↔ normalizer (services/catalog)
            payload é `unknown` até o normalizer decidir sua forma —
            anti-corruption layer de ADR-002, confirmado por leitura de
            RawSourceEvent (packages/provider-contracts/src/index.ts)
            e dos normalizers reais

Boundary 3: normalizer ↔ CatalogTable
            IAM least-privilege (infrastructure/terraform/modules/catalog/main.tf):
            GetItem/PutItem/UpdateItem/Query, nunca Scan, nunca wildcard

Boundary 4: connector ↔ host do provider (isolamento arquitetural)
            Architecture Fitness Function QR-014 (no-external-provider-call.mjs)
            impede qualquer outro módulo do monorepo de referenciar o host de
            api.themoviedb.org / app.ticketmaster.com — comprovado nesta
            sessão (8/8 controls, incluindo este par de fixtures)
```

### 2.3 Assets sensíveis

```text
API keys de provider (TMDB api_key, Ticketmaster apikey) — passadas via
  query string na URL (tmdb-client.ts linha 29, ticketmaster-client.ts
  linha 30) — ver AC-3 abaixo
Conteúdo do catálogo (título, datas, venue) — não é PII de usuário final,
  mas é o asset de produto (integridade importa: `stale_event_notification_count`
  citado em quality-strategy.md §5.4 como SLO de integridade)
```

### 2.4 Abuse cases

```text
AC-1: provider retorna payload malformado/inesperado (campo ausente,
      tipo trocado, injeção de HTML/script em campo de texto)
      → parcialmente mitigado: normalizers leem campos específicos
        (title, releaseDate etc.) do payload unknown, não fazem eval/
        interpretação dinâmica; NÃO há validação de schema formal (ex:
        zod/ajv) confirmada nesta sessão — o "anti-corruption layer" é
        estrutural (payload não vaza cru ao domínio) mas não há
        verificação explícita de invariantes de Data Quality
        (quality-strategy.md §5.4: "startAt parseável", "outbound URL
        pertence a allowlist") implementada em código ainda — a spec
        declara essas invariantes como requisito, o código desta fase
        não as impõe todas explicitamente (ex.: sem validação de
        allowlist de host para nenhum campo de URL de saída, porque
        nenhum campo de URL de saída é persistido nesta fase — Event
        não tem campo de link direto ao usuário ainda, apenas venueId/
        cityName)

AC-2: provider (ou man-in-the-middle) retorta resposta HTTP não-2xx
      → mitigado: ambos os clients (tmdb-client.ts, ticketmaster-client.ts)
        checam `response.ok` e lançam erro explícito com status —
        confirmado por leitura direta

AC-3: API key de provider vazando via logs de acesso HTTP/proxy
      (a key vai na query string, não em header) — padrão exigido
      pelas próprias APIs TMDB v3/Ticketmaster Discovery, não escolha
      deste projeto
      → risco residual real: qualquer log de infraestrutura que capture
        a URL completa da requisição (ex: log de um proxy HTTP futuro,
        ou um erro que serialize a URL) exporia a key. Não há Semgrep
        rule dedicada a isso hoje (EDP004/EDP005 cobrem PII de usuário e
        chamada direta ao provider, não vazamento de key de provider em
        log) — gap não coberto por controle automático existente

AC-4: entity resolution nível 2 (título normalizado) gera falso-positivo
      (vincula um Event ao Work errado por colisão de título)
      → mitigado parcialmente: resolveWorkForEvent só resolve quando
        exatamente 1 candidato existe; ambíguo (0 ou >1) vira UNRESOLVED
        + review queue (spec-catalog.md §7.2, confirmado no código real
        de resolve-work-for-event.ts e nos 11 testes unit de catalog) —
        mitigação é o desenho, não um controle de segurança per se, mas
        reduz a superfície de dado incorreto propagado

AC-5: fila de ingestion SQS recebe volume anômalo/spam de mensagens
      (ex: se um scheduler futuro mal configurado reprocessar em loop)
      → mitigado estruturalmente: maxReceiveCount=5 antes de DLQ
        (infrastructure/terraform/modules/catalog/main.tf), PutItem
        idempotente por natureza (mesma chave, reprocessar é seguro) —
        mas sem scheduler real ainda (Phase futura), então este é um
        risco desenhado para ser seguro quando o scheduler existir,
        não testado sob carga real hoje
```

### 2.5 STRIDE checklist

| Categoria | Aplica? | Mitigação observada | Risco residual |
|---|---|---|---|
| **S**poofing | Baixo | Conector confia na resposta de host fixo (`TMDB_API_BASE_URL`/`TICKETMASTER_API_BASE_URL` hardcoded, não configurável por env em runtime) — reduz risco de apontar acidentalmente para host malicioso | Sem TLS pinning/validação de certificado além do padrão do runtime Node — aceitável para APIs públicas conhecidas, não avaliado mais a fundo |
| **T**ampering | Sim | Anti-corruption layer (payload `unknown`, normalizer explícito) | AC-1: sem validação de schema formal — payload malformado pode propagar um `Event`/`Work` com campo `undefined`/incorreto até o passo de persistência sem ser rejeitado explicitamente antes |
| **R**epudiation | Parcial | `catalog.event.normalized.v1` logado estruturado (console.log) por evento normalizado, com `correlationId` | Sem armazenamento durável do raw payload (S3 Raw Archive é backlog explícito, não implementado) — investigação retroativa de "o que o provider realmente enviou" não é possível hoje além do log estruturado do evento normalizado |
| **I**nformation disclosure | Sim (AC-3) | Nenhuma PII de usuário neste fluxo (dado é sobre filmes/eventos, não sobre pessoas) | API key de provider em query string, sem controle automático dedicado contra vazamento em log (gap identificado, AC-3) |
| **D**enial of service | Parcial | DLQ + maxReceiveCount limitam reprocessamento infinito de uma mensagem específica | Sem rate limiting de chamada aos providers (nenhum token bucket para `collect()`) — se um scheduler futuro chamar em loop apertado, nada no código atual impede esgotar a quota do provider; mitigação prevista é operacional (scheduler bem configurado), não código |
| **E**levation of privilege | Sim | IAM da role `catalog_service` restrita a `CatalogTableReadWrite` + `IngestionQueueConsume`, nunca `Resource: "*"` | Nenhuma superfície de elevação adicional identificada |

### 2.6 Mitigações existentes vs. risco residual

**Mitigações confirmadas:** isolamento de provider por Architecture Fitness Function (comprovado, 8/8), anti-corruption layer estrutural, tratamento de erro HTTP explícito, entity resolution conservadora (ambíguo vira review queue em vez de adivinhar), IAM least-privilege, DLQ com `maxReceiveCount`.

**Risco residual real:** (1) ausência de validação de schema formal do payload do provider antes da normalização (AC-1) — a spec de Data Quality (`quality-strategy.md` §5.4) declara invariantes que o código desta fase ainda não impõe todas explicitamente; (2) API key de provider em query string sem controle dedicado contra vazamento em log (AC-3) — gap real, não coberto por EDP004/EDP005 hoje; (3) sem rate limiting de chamada aos providers no código dos connectors.

---

## 3. Pipeline CI/CD

### 3.1 DFD simples

```text
PR/push em main
        │
        ▼
GitHub Actions (OIDC — sem credenciais estáticas)
        │
        ├──▶ verify (typecheck/lint/format/unit) + quality-check.mjs
        ├──▶ integration-fast (DynamoDB Local, container efêmero)
        ├──▶ dependency-review, npm-audit
        ├──▶ security-scans (Semgrep + Gitleaks, via workflow_call —
        │      e também via trigger próprio, ver achado PCA-20260812-002
        │      no relatório de auditoria de consistência)
        └──▶ infra (terraform validate/plan contra AWS real via OIDC,
               role edp-dev-role-cicd-github-actions)
```

### 3.2 Trust boundaries

```text
Boundary 1: código de PR (potencialmente de um fork/contribuidor externo,
            hoje projeto solo mas repositório público) ↔ runners do GitHub Actions

Boundary 2: workflow ↔ AWS (via OIDC, infrastructure/terraform/modules/iam-github-oidc)
            sem credenciais estáticas armazenadas — trust policy escopada
            ao repo real (corrigida no Phase 0, ADR-010 §2)

Boundary 3: workflow ↔ merge de main
            branch protection real (enforce_admins=true, PR obrigatório,
            sem force-push, sem delete, conversation resolution obrigatória)
            confirmada via gh api nesta sessão — MAS sem required_status_checks
            configurado (ver achado PCA-20260812-001 do relatório de
            auditoria de consistência desta mesma sessão)
```

### 3.3 Assets sensíveis

```text
IAM role de CI (edp-dev-role-cicd-github-actions) — escopo confirmado
  como edp-* + state bucket, sem Resource: "*", sem apply de produto
  ainda (docs/backlog.md Phase 0)
Secrets do GitHub Actions (AWS_ROLE_ARN_DEV) — usado só via OIDC,
  não credenciais estáticas
```

### 3.4 Abuse cases

```text
AC-1: PR malicioso (de um fork, já que o repo é público — ADR-010 §3)
      tenta exfiltrar secrets do workflow via um step modificado
      → parcialmente mitigado: workflows não usam pull_request_target
        (que exporia secrets a PRs de fork); triggers são pull_request
        padrão (sandboxed, sem secrets de repo/ambiente para forks por
        padrão do GitHub) — comportamento não testado ao vivo nesta
        sessão (não há PR de fork real para observar), mas a configuração
        declarada é a correta

AC-2: Actions de terceiros comprometidas (supply chain de CI)
      → mitigado: todas as `uses:` pinadas por SHA completo (QR-001),
        verificado por leitura visual em ci.yml/security.yml — sem
        check automático que force isso (QR-001 é "review-dependent"
        no próprio quality-rules.md)

AC-3: merge de PR com CI vermelho ou ainda em execução
      → NÃO mitigado por configuração do GitHub — achado principal desta
        sessão (PCA-20260812-001 no relatório de auditoria de
        consistência): required_status_checks retorna 404 (não
        configurado). enforce_admins=true e required_approving_review_count=0
        não substituem isso — nada no lado do GitHub impede
        mecanicamente um merge sobre um check falho ou pendente

AC-4: escalada de privilégio via `permissions:` mal escopado no workflow
      → mitigado: `permissions: contents: read` no nível do workflow em
        ci.yml/security.yml, com `id-token: write` restrito apenas ao
        job `infra` (que precisa de OIDC) — confirmado por leitura direta,
        não um `permissions: write-all` genérico
```

### 3.5 STRIDE checklist

| Categoria | Aplica? | Mitigação observada | Risco residual |
|---|---|---|---|
| **S**poofing | Baixo | OIDC (sem credenciais estáticas) elimina risco de key AWS vazada do CI | — |
| **T**ampering | Sim | Actions pinadas por SHA (AC-2) | Sem verificação automática de pin — depende de revisão manual |
| **R**epudiation | Parcial | Histórico de runs no GitHub Actions (`gh run list` usado nesta auditoria) | Sem exportação/retenção própria fora do GitHub verificada |
| **I**nformation disclosure | Baixo | Sem `pull_request_target`, sem secret exposto a fork por padrão | Não testado ao vivo com PR de fork real nesta sessão |
| **D**enial of service | Não avaliado | — | Fora do escopo prático de um projeto solo hoje |
| **E**levation of privilege | Sim | `permissions: contents: read` por padrão, `id-token: write` só onde necessário; IAM role de CI escopada a `edp-*` (confirmado Phase 0) | AC-3 é, na prática, uma forma de elevation-of-privilege operacional: sem required status checks, qualquer PR aprovado (mesmo com 0 revisores exigidos) pode mergear código não verificado em `main` |

### 3.6 Mitigações existentes vs. risco residual

**Mitigações confirmadas:** OIDC sem credenciais estáticas, IAM de CI escopada, Actions pinadas por SHA, `permissions` restritivo por padrão, branch protection básica (PR obrigatório, sem force-push/delete) confirmada via API ao vivo nesta sessão.

**Risco residual real, já reportado no relatório de auditoria de consistência desta sessão (PCA-20260812-001):** ausência de `required_status_checks` é o gap mais concreto de todo este threat model — é o único item, entre os três componentes modelados, onde a mitigação documentada (`quality-enforcement-system.md` §24) diverge da configuração real verificada ao vivo, não apenas um risco teórico aceito.

---

## Resumo executivo

```text
Áreas cobertas:      Cognito/auth, connector ingestion (TMDB+Ticketmaster), CI/CD pipeline
Áreas N/A (sem código ainda): Telegram webhook, affiliate redirect, rate limiter
Abuse cases modelados: 15 (6 auth, 5 ingestion, 4 CI/CD)
Mitigações confirmadas por evidência direta: maioria dos abuse cases tem
  mitigação estrutural (boundary de PII, IAM least-privilege, anti-corruption
  layer, isolamento de provider) comprovada por controle automático
  (npm run quality:self-test, 8/8) ou por leitura direta de código/Terraform
Risco residual real (não hipotético), por ordem de severidade percebida:
  1. Ausência de required status checks no GitHub (compartilhado com o
     relatório de auditoria de consistência desta sessão, PCA-20260812-001)
  2. API key de provider em query string sem controle dedicado contra
     vazamento em log (novo, identificado só neste threat model)
  3. Sem validação de schema formal do payload do provider antes da
     normalização (novo, identificado só neste threat model)
  4. MFA administrativo adiado (aceito, com dono e prazo já registrados
     em ADR-012 — não é um achado novo, é um risco já governado)
Achados críticos: nenhum classificado como `critical` (nenhum caminho de
  exploração imediata de dado sensível ou deploy incorreto identificado
  com evidência direta) — o mais severo (ausência de required status
  checks) é `high`, consistente com a classificação já dada no relatório
  de auditoria de consistência.
```

## Limitações desta análise

- Sem AWS real: GuardDuty, CloudTrail, throttling efetivo do Cognito contra brute-force, e o comportamento real de PRs de fork contra secrets não foram testados ao vivo — tratados como não verificados.
- Threat model cobre o desenho atual (sem endpoints HTTP reais em `services/identity`, sem scheduler real chamando os connectors) — deve ser revisto quando esses componentes ganharem o primeiro código real, por ser exatamente o tipo de mudança estrutural que `quality-strategy.md` §4.2.1 já define como gatilho.
- Não é uma auditoria de segurança dedicada completa (OWASP ASVS/API Security Top 10/AWS Well-Architected Security Pillar, `quality-strategy.md` §4.1) — é o threat model leve mínimo exigido antes do primeiro beta; a auditoria de segurança dedicada completa continua pendente e deve ser agendada separadamente.
