---
status: active
owner: architecture
authority: normative
---

# Prompt de Kickoff — Phase 0 (Foundations)

Prompt para colar no início da próxima sessão, onde a implementação começa de fato. Cobre a fundação operacional (repositório, CI/CD, IAM) antes da primeira feature.

---

## Prompt

Você está iniciando a implementação da **Event Discovery Platform**. Este não é um projeto novo sem contexto — existe um sistema de contexto completo já construído e validado. Trabalhe com autonomia máxima: não pare para pedir confirmação em decisões que já estão registradas nos documentos abaixo, só pare se encontrar ambiguidade genuína que nenhum documento resolve, ou antes de ações de alto impacto/irreversíveis fora do escopo já autorizado (ex: pedir aprovação humana antes de criar recursos de billing real ou fazer qualquer coisa fora do repositório deste projeto).

### Antes de qualquer coisa

Leia, nesta ordem, `docs/architecture/system-overview.md` (é o context router deste projeto — ele te diz o que ler para cada tipo de tarefa) e `CLAUDE.md`. Depois siga o read set "Criar/alterar infraestrutura" definido lá. Não leia tudo em `docs/` de uma vez — carregue o mínimo necessário por etapa, conforme o próprio sistema de contexto instrui.

### Objetivo desta sessão: Phase 0 — Foundations

Baseado em `docs/architecture/history/architecture-v1.md` §62 (fases de implementação) e no checklist de bootstrap em `docs/engineering/quality-strategy.md` §13 e `docs/backlog.md`, esta sessão deve produzir a fundação operacional do projeto — não features de produto ainda.

Escopo desta sessão:

```text
1. Inicializar o repositório Git deste projeto (event-discovery-platform)
   e criar o repositório correspondente no GitHub.
2. Configurar autenticação AWS via OIDC para GitHub Actions, reaproveitando
   o padrão já usado no projeto marcelo-goncalves-blog (não reinventar).
3. Criar a role IAM deste projeto a partir desse mesmo padrão, com
   permissões ajustadas ao escopo real deste projeto (não copiar o
   policy arn do projeto anterior sem revisar).
4. Montar o pipeline de CI (Tier A do quality-strategy.md §1.1) rodando
   de verdade em push/PR.
5. Deixar registrado o que ainda falta (Tier B/C, CD completo) como
   próximo passo explícito, não implementado às pressas nesta sessão.
```

---

### 1. Repositório

- Nome sugerido: `event-discovery-platform` (mesmo nome do diretório local — não inventar variação).
- Inicializar Git localmente nesta pasta se ainda não houver `.git`.
- Criar o repositório no GitHub (`gh repo create`) — privado por padrão, a menos que haja instrução em contrário. Confirmar com o usuário antes de tornar público.
- Primeiro commit: a estrutura de contexto já existente (`CLAUDE.md`, `docs/`, `README.md`) — não esperar até ter código para commitar o contexto.
- Branch protection em `main` configurada e **confirmada via API** antes de considerar esta etapa concluída — não assumir que a configuração pegou só porque o comando não retornou erro (`docs/architecture/system-overview.md` — Authority Matrix: "o que está realmente rodando?" verifica-se ao vivo, não pela intenção).

### 2. OIDC — reaproveitar o padrão do projeto editorial

O projeto `marcelo-goncalves-blog` já resolveu autenticação AWS via GitHub Actions sem access keys persistentes, usando OIDC. Os templates de referência estão em:

```text
marcelo-goncalves-blog-arquivo/docs-historico/oidc.yaml.txt      (provider OIDC — uma vez por conta)
marcelo-goncalves-blog-arquivo/docs-historico/github-role.yaml.txt (role por repositório)
```

Passos:

```text
1. Verificar se o OIDC Provider do GitHub (token.actions.githubusercontent.com)
   já existe na conta AWS que este projeto vai usar — é recurso único por
   conta, não por projeto. Checar via CLI antes de tentar criar de novo
   (`aws iam list-open-id-connect-providers`), nunca assumir.
   - Se já existir (reaproveitado do projeto anterior): usar o ARN existente.
   - Se não existir: aplicar oidc.yaml.txt uma única vez.
2. Aplicar github-role.yaml.txt para este repositório específico, com:
   GitHubOrg / GitHubRepo apontando para event-discovery-platform
   GitHubBranch = main
   RoleName = seguindo docs/engineering/standards/resource-naming.md
              (ex: edp-{env}-role-cicd-github-actions — ajustar ao padrão
              real do documento, não inventar formato novo)
```

### 3. Permissões da role — ajustar, não copiar

O template original usa `ManagedPolicyArn` com um único policy amplo (ex: `AmazonS3ReadOnlyAccess` como placeholder no template genérico). **Não usar esse placeholder nem copiar a policy exata usada no projeto editorial sem revisar** — os dois projetos têm superfícies de recurso diferentes.

Seguir least privilege (`docs/engineering/quality-strategy.md` §4.2, ADR-009): a role de CI deste projeto precisa de permissão para gerenciar exatamente os tipos de recurso previstos em `docs/engineering/standards/resource-naming.md` (DynamoDB, SQS, Lambda, S3, IAM roles específicas do projeto, CloudWatch, API Gateway) — escopadas por prefixo de nome/ARN (`edp-*`), nunca `Resource: "*"`. Se o pipeline nesta sessão só faz `terraform plan`/lint/testes (sem `apply` ainda), a role pode nascer com escopo ainda mais restrito e crescer depois, PR por PR, conforme cada permissão for de fato necessária — não conceder permissão antecipada "para não precisar voltar depois".

Registrar a policy final como parte do Terraform do projeto (`infrastructure/terraform/`), não como configuração manual no console — consistente com `quality-strategy.md` §7 ("tudo em Terraform, nenhum recurso manual").

### 4. Pipeline de CI — Tier A

Implementar o Tier A completo de `docs/engineering/quality-strategy.md` §1.1 como GitHub Actions, rodando em todo PR:

```text
typecheck, lint, format:check, unit, contract, integration-fast,
dependency review, npm audit, SAST (Semgrep), secret scan (Gitleaks),
IaC scan (Trivy + TFLint + terraform validate) quando houver Terraform
```

Regras não negociáveis desde o primeiro workflow (`quality-strategy.md` §1, §1.2):

```text
- Actions pinadas por full commit SHA, nunca tag mutável
- npm ci, nunca npm install, no workflow
- Node/package manager com versão pinada no repositório
```

Se ainda não há código o suficiente para todos os gates terem o que checar (ex: sem testes ainda no dia 1), o workflow nasce com os steps já presentes e correndo — mesmo que "unit tests: 0 tests" — para que o gate exista estruturalmente desde o commit zero, não seja adicionado depois que já há código sem gate.

### 5. O que fica explicitamente para depois

Não implementar nesta sessão (registrar em `docs/backlog.md` se ainda não estiver lá):

```text
Tier B (integration-aws-real, E2E, smoke, DAST baseline) — depende de
  ambiente dev implantado, que ainda não existe
Tier C (scale, failure, DAST completo, restore drill) — depende de Tier B
CloudTrail + GuardDuty — ver quality-strategy.md §4.2, é bootstrap
  pendente mas depende de decisão de conta/ambiente AWS já estar definida
Terraform apply real de qualquer recurso de produto (DynamoDB, SQS, etc.)
  — esta sessão é fundação de CI/CD, não a primeira feature
```

---

### Ao final desta sessão

Atualizar `docs/backlog.md`: marcar como concluído o que foi de fato implementado (não o que foi só planejado), e não deixar um item "meio feito" sem nota do que falta especificamente. Se alguma decisão nova e cara de reverter foi tomada durante esta sessão (ex: nome final da role, escopo exato de permissão), registrar como ADR novo antes de considerar a sessão encerrada — não depois, de memória.
