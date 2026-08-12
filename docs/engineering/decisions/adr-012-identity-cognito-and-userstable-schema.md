---
status: accepted
date: 2026-08-11
supersedes: []
---

# ADR-012 — Identity: Cognito Auth Model and UsersTable Schema

Status: Accepted

## Contexto

Phase 1 (Identity) é a primeira sessão de código de produto real e a primeira a tocar PII de usuário. `architecture.md` §5 só listava `UsersTable` de passagem, entre cinco tabelas candidatas; §13 citava "LGPD by design" como princípio geral. Nenhuma decisão concreta existia sobre: (a) usar Cognito ou outra solução de auth, e como usá-lo; (b) o schema de `UsersTable`. `CLAUDE.md` Nível 6 exige ADR formal antes de implementar decisão arquitetural nova — este ADR precede qualquer Terraform de Cognito/`UsersTable` (nenhum commit de infra foi feito antes deste ADR ser aceito). Detalhe completo do desenho: `docs/architecture/spec-identity.md`.

O histórico do projeto anterior (`history/architecture-v1.md`) usava Cognito para autenticar um único admin de um blog editorial — volume e requisitos completamente diferentes de um produto com cadastro de usuário final em volume desde o dia 1.

## Decisão

### Cognito vs. alternativa

Adotar **AWS Cognito User Pool**, com API direta (sem Hosted UI) chamada exclusivamente por `services/identity` no lado servidor — nunca por um client não confiável.

Razões:

- já nativo à conta AWS já usada por este projeto (mesmo IAM/OIDC, sem outro fornecedor de terceiros para governar PII);
- gerencia hash de senha, verificação de email, MFA opcional e rotação de token sem código próprio a manter/auditar — reduz superfície de segurança que este projeto teria que implementar e testar sozinho (ASVS V1, `quality-strategy.md` §4.1);
- tier gratuito cobre o volume esperado do MVP (Belo Horizonte);
- Hosted UI é explicitamente adiado (branding customizado fora do MVP) sem custo de migração: a API direta de hoje pode adotar Hosted UI depois sem trocar de provedor de identidade.

### UsersTable schema

`UsersTable` **nunca armazena PII bruta** (email, telefone, nome). Cognito é o único sistema de registro dessas informações. `userId` usado em todo o resto do domínio é o `sub` do Cognito — opaco, não-PII.

```text
Edp{Env}UsersTable

PK = USER#<userId>     SK = PROFILE        (status, createdAt, updatedAt, preferences)
PK = USER#<userId>     SK = CONSENT#<purpose>  (purpose, version, grantedAt, source)
```

Sem GSI nesta fase — todo access pattern conhecido é servido pela chave primária.

`status` no item `PROFILE` é `ACTIVE | DELETING` — o modelo de estado de exclusão nasce agora (campo caro de adicionar depois num schema em produção), mesmo com a execução completa da exclusão adiada para Phase 3+.

Consentimento é sempre um registro versionado (`purpose`, `version`, `grantedAt`, `source`) — nunca um boolean solto, por decisão já registrada em `quality-strategy.md` §6, aqui formalizada como schema concreto.

Retenção: logs técnicos e execução de `DELETING` com SLA de 30 dias (número específico deste projeto, não herdado do "15 dias" do blog — justificativa completa em `spec-identity.md` §7).

MFA administrativo obrigatório é adiado por decisão explícita: dono = arquitetura (Marcelo), prazo de revisão = antes do primeiro deploy em produção com usuários reais (Phase 7 — Production Readiness). Registrado aqui e em `docs/backlog.md` para não virar esquecimento (`quality-strategy.md` §4.2).

## Alternativas consideradas

- **Custom auth (bcrypt/argon2 + tabela própria de credenciais)**: rejeitado — reimplementa hashing de senha, fluxo de verificação de email, reset de senha e (eventualmente) MFA, cada um uma superfície de segurança própria a testar/auditar, sem benefício de produto (`quality-strategy.md` §4.1 já define ASVS como metodologia obrigatória; usar Cognito já entrega boa parte disso corretamente por padrão).
- **Auth0 / Clerk (IdP terceirizado dedicado)**: rejeitado nesta fase — adiciona um segundo processador de PII de usuário fora da conta AWS já auditada (mais um alvo de auditoria de segurança/LGPD, mais um contrato de fornecedor, mais um ponto de falha de disponibilidade externo), sem ganho claro sobre Cognito para os requisitos atuais (email+senha, MFA opcional, volume BH). Reabrir se um requisito real (ex: SSO social multi-provider antes de Cognito suportar bem, ou custo de Cognito em escala) aparecer.
- **Duplicar email/telefone em `UsersTable` para evitar uma chamada extra ao Cognito em leituras**: rejeitado — cria uma segunda fonte de verdade de PII, dobra a superfície de exclusão/auditoria LGPD, e nenhum access pattern conhecido hoje precisa disso (nenhuma query do domínio filtra por email; login já é resolvido pelo próprio Cognito).
- **Cognito Hosted UI desde já**: rejeitado nesta fase — sem frontend web ainda (`apps/web` vazio), adicionaria complexidade de redirect OAuth e branding sem consumidor real. Caminho de migração para Hosted UI permanece aberto (mesmo User Pool).
- **GSI em `UsersTable` para lookup por email/purpose**: rejeitado — nenhum access pattern conhecido precisa disso (email nem existe na tabela); adicionar GSI depois é barato (`architecture.md` §18), ao contrário de mudar a chave primária.

## Consequências

- Toda leitura de PII (ex: futura tela admin) passa obrigatoriamente por uma chamada ao Cognito (`AdminGetUser`), nunca por um campo local em `UsersTable` — mais uma chamada de rede nesses casos raros, em troca de uma única fonte de verdade de PII e um raio de exclusão LGPD menor.
- `services/identity/src/pii/*` é o único módulo do sistema autorizado a falar com o Cognito/manipular PII bruta — protegido por Architecture Fitness Function (ver `quality-rules.md`).
- `InterestIndexTable` (Phase 3) herda `userId` opaco diretamente, sem trabalho adicional de "remover PII" quando for desenhada — a decisão já nasce compatível.
- Exclusão de conta ponta-a-ponta (Phase 3+) precisa apagar: item Cognito (`AdminDeleteUser`), itens `PROFILE`+`CONSENT#*` em `UsersTable`, e (quando existir) entradas em `InterestIndexTable` — três sistemas, não um; documentado para não ser subestimado quando implementado.
- MFA administrativo obrigatório fica pendente de revisão explícita antes de produção (não incluído no Nível 6 desta sessão, mas rastreado como decisão, não lacuna).

## Trigger de revisão

- Se o volume de usuários ultrapassar a faixa gratuita do Cognito por uma margem que justifique avaliação de custo, ou se surgir requisito de SSO social multi-provider antes de Cognito suportar adequadamente: reabrir "Cognito vs. IdP terceirizado".
- Antes do primeiro deploy em produção com usuários reais (Phase 7): revisar a decisão de adiar MFA administrativo obrigatório.
- Quando `services/notifications`/`services/matching` (Phase 3/5) forem implementados: confirmar que nenhum deles lê `status = DELETING` via scan/import direto de `services/identity` — devem consumir um evento/consulta explícita, não acoplamento direto ao módulo interno.
