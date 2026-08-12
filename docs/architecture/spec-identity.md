---
status: active
owner: architecture
authority: normative
---

# Spec — Identity (Phase 1)

Desenho de identidade de usuário: cadastro/login, `UsersTable`, consentimento e exclusão de conta. Primeiro spec de um subsistema com PII real — `architecture.md` §5 só listava `UsersTable` de passagem (uma das cinco tabelas candidatas) e §13 citava "LGPD by design" como princípio geral; este documento é o desenho concreto que faltava. Ver ADR-012 para as decisões caras de reverter (Cognito vs. alternativa, schema de `UsersTable`).

## 1. Escopo desta fase

Baseado em `history/architecture-v1.md` §62 (Phase 1 — Identity: `users`, `Cognito`, `preferences`, `LGPD`). "Preferences" aqui é só o registro de que um usuário existe e pode ter preferências no futuro — não é Phase 3 (Interests: follow, matching). Nenhum modelo de `Interest`/`InterestIndexTable` é tocado por este spec.

Dentro do escopo:

- schema de `UsersTable`;
- fluxo de autenticação (Cognito);
- modelo de consentimento versionado;
- modelo de estado de exclusão de conta (`DELETING`), sem a execução completa;
- decisão de retenção de dados deste projeto.

Fora do escopo (ver `docs/backlog.md`): vínculo com Telegram (Phase 5), matching/Interest (Phase 3), hosted UI customizada, MFA administrativo (decisão explícita registrada em ADR-012, não esquecimento), exclusão de conta ponta-a-ponta.

## 2. Onde o serviço vive

`services/identity/` (não `apps/`) — é um domínio de backend sem UI própria nesta fase; `apps/web` e `apps/telegram-webhook` (ainda não implementados) consumirão este serviço via API interna quando existirem, sem duplicar a lógica de auth. Segue o layout já documentado em `README.md` ("Estrutura de código").

## 3. Autenticação — Cognito

### 3.1 Decisão: API direta, sem hosted UI

O uso de Cognito em `history/architecture-v1.md`/`resource-naming.md` (`edp-prod-identity-webhook-telegram`) era para um único admin do blog anterior — volume de um usuário, sem fluxo de auto-cadastro. Este projeto tem volume de usuário final desde o dia 1 (produto B2C), o que muda os requisitos:

- **Sem Cognito Hosted UI**: branding customizado é explicitamente fora do MVP (`phase-1-kickoff-prompt.md`). Hosted UI adiciona redirect OAuth e domínio Cognito gerenciado sem necessidade de produto ainda (não há frontend web hoje: `apps/web` está vazio).
- **API direta**: `services/identity` chama a API do Cognito (`InitiateAuth`/`SignUp`/`ConfirmSignUp`) via AWS SDK, sempre no lado servidor — nunca exposto a um client não confiável. Isso mantém o app client como client confidencial (com secret em Secrets Manager), evita expor fluxo de auth diretamente ao browser antes de existir um browser, e mantém o caminho de migração para hosted UI/SPA aberto (Cognito não muda de fornecedor, só a camada de apresentação).
- **Auth flow**: `ALLOW_USER_PASSWORD_AUTH` no app client, chamado por `services/identity` (nunca pelo usuário final diretamente) — suficiente para email+senha na Phase 1; `ALLOW_USER_SRP_AUTH` fica para quando um client JS/mobile confiável existir (SRP evita enviar senha em texto claro, relevante quando o auth deixar de ser 100% server-to-server).

Ver ADR-012 §"Cognito vs. alternativa" para a comparação completa (custom auth vs. Cognito vs. Auth0/Clerk).

### 3.2 User Pool

```text
edp-{env}-identity-user-pool
```

(`resource-naming.md` não cobria Cognito antes deste spec — adicionado em `resource-naming.md` §Cognito, seguindo o padrão geral §3 `edp-{env}-{component}-{purpose}`, componente `identity`.)

Configuração:

- username: email (`email` como alias, `username_attributes = ["email"]`);
- verificação de email obrigatória antes de `CONFIRMED` (Cognito gerencia o código de verificação — nenhum e-mail transacional próprio nesta fase);
- password policy: mínimo 12 caracteres, maiúscula+minúscula+número+símbolo (`ASVS V1 Level 1`, `quality-strategy.md` §4.1);
- MFA: `OPTIONAL` no pool (usuário final pode ativar TOTP se quiser), **MFA administrativo obrigatório para contas com privilégio elevado é adiado** — decisão explícita, não esquecimento: dono = arquitetura (Marcelo), prazo de revisão = antes do primeiro deploy em produção com usuários reais (Phase 7 — Production Readiness), registrado em ADR-012 e `docs/backlog.md`;
- `deletion_protection = "ACTIVE"` em prod.

### 3.3 App Client

```text
edp-{env}-identity-app-client
```

- `generate_secret = true` (client confidencial — todo caller é `services/identity`, nunca um browser);
- secret armazenado em Secrets Manager, nunca em variável de ambiente Terraform em texto plano (`quality-strategy.md` §4.2);
- `explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]`;
- token validity: access/id token 1h, refresh token 30 dias (revisar quando existir um client de longa duração real, ex: app mobile).

### 3.4 Fluxo mínimo implementado nesta fase

```text
POST /signup  → Cognito SignUp + grava PROFILE em UsersTable (status ACTIVE)
                + grava consentimento inicial (purpose=account_terms)
POST /login   → Cognito InitiateAuth (USER_PASSWORD_AUTH) → tokens
```

Confirmação de email (`ConfirmSignUp`) e reset de senha ficam com o fluxo padrão do Cognito (`AdminConfirmSignUp` não é usado — confirmação é sempre pelo próprio usuário) mas não têm endpoint HTTP dedicado nesta fase (sem `apps/web` para consumir); a lógica de domínio já existe em `services/identity/src/application` para não represar trabalho quando o endpoint for necessário.

## 4. UsersTable

### 4.1 Decisão central: Cognito é o sistema de registro de PII de credencial; `UsersTable` nunca duplica PII bruta

`UsersTable` não armazena email, telefone ou nome em texto claro. Esses campos já têm um sistema de registro dedicado, criptografado em repouso e com controle de acesso próprio: o User Pool do Cognito. Duplicar em `UsersTable` criaria uma segunda fonte de verdade para PII (risco de divergência, e uma superfície adicional a proteger/auditar/apagar por LGPD) sem necessidade — nenhum access pattern deste spec precisa de email/telefone fora do próprio Cognito. Isso resolve de forma estrutural o requisito "PII nunca entra em `InterestIndexTable`" (`quality-strategy.md` §6) de forma ainda mais restrita: PII bruta nem chega a `UsersTable`.

`userId` = Cognito `sub` (UUID gerado pelo Cognito) — identificador opaco, não-PII, usado em todo o resto do domínio (inclusive `InterestIndexTable` na Phase 3).

### 4.2 Chaves e itens

```text
Edp{Env}UsersTable

PK = USER#<userId>
SK = PROFILE
```

Item `PROFILE` (não-PII, exceto onde marcado):

```text
userId          string   — Cognito sub, opaco
status          string   — ACTIVE | DELETING (§6)
createdAt       string   — ISO 8601
updatedAt       string   — ISO 8601
preferences     map      — vazio nesta fase; existe como campo reservado
                            para Phase 3 não exigir migração de schema
```

Nenhum campo `email`/`phone`/`name` neste item — ver §4.1. Se um caso de uso futuro precisar exibir o email (ex: painel admin), a leitura vai direto ao Cognito (`AdminGetUser`), nunca via cópia em `UsersTable`.

```text
PK = USER#<userId>
SK = CONSENT#<purpose>
```

Item `CONSENT` — um item por `purpose` (a versão mais recente; ver §5 sobre por que não é histórico completo nesta fase):

```text
userId      string
purpose     string   — ex: "account_terms", "telegram_notifications"
version     number   — versão do texto de consentimento aceito
grantedAt   string   — ISO 8601
source      string   — SIGNUP_FORM | API | TELEGRAM_BOT
```

Nenhum GSI nesta fase — todo access pattern conhecido (`get profile by userId`, `get consent by userId+purpose`, `get all consents for userId` via `Query PK=USER#<userId>`) é servido pela chave primária. Adicionar GSI é barato de fazer depois (`architecture.md` §18 princípio); schema de chave primária não é (`architecture.md` §17) — por isso a chave primária recebe o detalhe agora, o GSI não.

### 4.3 Por que não single-table com `InterestIndexTable`/`CatalogTable`

`architecture.md` §5 já resolveu isso: "não há prêmio por single-table design... o critério é qual modelo atende os access patterns sem scans e com menor complexidade operacional". Identity tem um bounded context e um dono (LGPD, exclusão de conta) claramente separado do matching — nenhum access pattern cruza as duas tabelas hoje. `UsersTable` isolada mantém o raio de exclusão de conta (§6) restrito a uma tabela.

## 5. Consentimento — registro versionado

Nunca um boolean solto (`quality-strategy.md` §6). Todo consentimento é um item `CONSENT#<purpose>` com `purpose`, `version`, `grantedAt`, `source` (ver §4.2).

- Um novo `SignUp` grava `CONSENT#account_terms` (aceite dos termos de uso, obrigatório para criar a conta — `source = SIGNUP_FORM`).
- `CONSENT#telegram_notifications` nasce na Phase 5, quando existir de fato um vínculo com Telegram — este spec só reserva o `purpose` no vocabulário (`glossary.md` seria atualizado se necessário na Phase 5; nenhum termo novo introduzido agora).
- Revogação de consentimento (ex: usuário retira aceite de um `purpose` opcional) é modelada como um novo item com `version` incrementada e um campo adicional `revokedAt`, não implementada nesta fase (nenhum `purpose` opcional existe ainda) — a chave (`PK`+`SK` fixos por `purpose`) já suporta o caso sem migração quando chegar.
- Histórico completo de versões de consentimento (auditoria "o que o usuário aceitou quando") não é mantido nesta fase — cada `CONSENT#<purpose>` guarda apenas a versão vigente. Manter histórico completo exigiria `SK = CONSENT#<purpose>#v<NNN>` mais uma query de "mais recente"; adiado até haver um requisito real de auditoria retroativa (custo de adicionar depois é baixo: é um novo padrão de SK, não uma migração de tipo).

## 6. Exclusão de conta — modelo de estado

Campo `status` no item `PROFILE`: `ACTIVE | DELETING`.

```text
ACTIVE    → estado normal
DELETING  → exclusão solicitada, execução ainda não completa
```

Nasce aqui porque, conforme `phase-1-kickoff-prompt.md`, adicionar esse campo depois — com dados reais de usuário em produção — seria uma migração cara (todo consumidor do `PROFILE` teria que passar a checar um campo que não existia). O contrato nasce agora:

- Ao marcar `status = DELETING`: nenhuma nova notificação deve ser planejada para o `userId` (invariante que `services/notifications`/`services/matching` devem respeitar quando existirem — Phase 3/5; registrado aqui para não ser esquecido quando esses serviços forem escritos).
- Execução completa (apagar `PROFILE`, apagar `CONSENT#*`, desabilitar/apagar usuário Cognito, remover de `InterestIndexTable`) é Phase 3+ (depende de `InterestIndexTable` existir para ter o que apagar lá) — não implementada nesta sessão, registrada em `docs/backlog.md`.
- SLA de execução após `DELETING`: **30 dias corridos** (ver §7 — mesmo número da política de retenção pós-exclusão).

## 7. Retenção de dados — decisão deste projeto

`quality-strategy.md` §6 alerta explicitamente para não herdar o "15 dias" do projeto anterior (blog, editorial, sem cadastro de usuário final) sem revisão. Números decididos para este projeto:

```text
Logs técnicos de aplicação (CloudWatch Logs)     30 dias
Execução de exclusão de conta após DELETING       30 dias
Dados de conta ACTIVE (sem solicitação de
  exclusão)                                       sem limite — usuário
                                                    ativo, dado necessário
                                                    para o produto funcionar
```

Justificativa dos 30 dias (vs. os 15 do blog):

- **Logs técnicos**: este produto tem volume de usuário final e um pipeline assíncrono multi-hop (ingestion → matcher → notification) — investigação de incidente de entrega (ex: "por que este usuário não recebeu a notificação de pré-venda") plausivelmente cruza mais de 15 dias entre o evento reportado pelo usuário e a investigação. 30 dias é o padrão CloudWatch Logs mais próximo que cobre esse cenário sem custo de armazenamento desproporcional (log de aplicação, não raw payload — `S3 Raw Archive` já tem retenção própria fora do escopo deste spec).
- **Exclusão de conta**: LGPD Art. 18 exige atendimento "sem demora injustificada", sem prazo numérico fixo na lei — 30 dias é o número operacional escolhido (SLA interno), alinhado ao mesmo período de log técnico para simplificar operação (uma única janela a monitorar), e curto o suficiente para não parecer negligente numa eventual auditoria.

Este número é uma decisão de produto/compliance, não uma migração cara de schema — se precisar mudar, é ajuste de configuração (TTL/lifecycle policy), não ADR. Registrado aqui para existir uma referência única (`quality-strategy.md` §6 aponta para cá).

## 8. PII vs. não-PII — resumo explícito

```text
PII (nunca em UsersTable; vive só no Cognito)
  email, senha (hash gerenciado pelo Cognito), telefone (se coletado
  no futuro), nome (se coletado no futuro)

Não-PII (UsersTable)
  userId (Cognito sub — opaco, não reversível para email sem consultar
    o Cognito com permissão própria)
  status, createdAt, updatedAt, preferences (vazio nesta fase)
  purpose, version, grantedAt, source (registro de consentimento —
    não identifica a pessoa sozinho, mas é lido sempre junto do userId
    opaco, nunca de email/nome)
```

Esse boundary é o que a Architecture Fitness Function (`quality-rules.md`, ADR-011) passa a proteger: nenhum módulo fora de `services/identity` pode importar o módulo que fala com o Cognito (`services/identity/src/pii/*`) — é o único lugar do sistema com acesso a PII bruta de usuário.

## 9. Testes

- **Unit** (`services/identity/test/unit/`): regras determinísticas — versionamento de consentimento, transição de `status` (`ACTIVE → DELETING`, e que a transição inversa não é permitida nesta fase), hashing de PII para log (§8/EDP004).
- **Integration-local** (`services/identity/test/integration/`): contra DynamoDB Local, mesmo padrão do Tier A de CI — grava/lê `PROFILE` e `CONSENT#*` reais, sem mock de persistência (`testing-strategy.md`).
- Cognito não tem um "local" equivalente confiável para integration test nesta fase — chamadas ao Cognito são isoladas atrás de uma interface (`CognitoIdentityClient` injetado), testadas com fake determinístico em unit; um teste de integração real contra um User Pool de `dev` fica para Tier B (`docs/backlog.md`), quando existir ambiente `dev` implantado.

## 10. Fora de escopo desta fase (ver `docs/backlog.md`)

```text
Endpoint HTTP de confirmação de email / reset de senha dedicado
Vínculo de conta com Telegram (chatId) — Phase 5
Painel administrativo / AdminGetUser exposto
Exclusão de conta ponta-a-ponta (execução real do DELETING)
MFA administrativo obrigatório
Cognito Hosted UI / branding customizado
Histórico completo de versões de consentimento
```
