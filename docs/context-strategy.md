---
status: active
owner: architecture
authority: normative
---

# Estratégia de Contexto — Event Discovery Platform

Descreve o sistema de contexto completo do projeto — o que existe, por que existe, como as peças se relacionam, e que regra evita que ele degrade com o tempo. Não é um índice de arquivos (isso é o `README.md`); é a explicação do desenho por trás da estrutura.

Revisado uma vez (auditoria registrada em `docs/engineering/audits/`) — as mudanças dessa revisão já estão incorporadas neste documento, não vivem em um documento paralelo.

---

## 1. Problema que este sistema resolve

Um projeto que usa IA como parte relevante do time de engenharia tem um risco específico: contexto se acumula rápido, mas sem estrutura ele vira ruído — decisões se repetem, documentos divergem do código, e ninguém (humano ou agente) sabe qual fonte é a verdade quando dois documentos discordam.

A estratégia de contexto deste projeto resolve isso com um princípio único:

> Cada fato **normativo** tem exatamente uma fonte canônica. Representações derivadas podem existir — um resumo, um índice, um mapa de leitura — desde que sejam explicitamente não autoritativas e apontem para a fonte.

O refinamento importa: o problema nunca foi a existência de informação derivada (`system-overview.md` é derivado por design). O problema é duas fontes simultaneamente poderem afirmar "eu sou a verdade" sobre o mesmo fato.

Esse princípio foi extraído de uma auditoria profunda do padrão de engenharia já validado em produção real em outro projeto (`../auditoria-padrao-qualidade-marcelo-goncalves-blog.md`) — inclui não só o que funcionou, mas também os pontos onde esse padrão degradou (documentação duplicada e divergente, contrato desatualizado contradizendo o código real, meta de cobertura declarada sem enforcement) e como isso foi corrigido lá.

---

## 2. Os papéis de documento

Todo documento deste projeto se encaixa em exatamente um papel. Um agente (humano ou IA) que precisa de uma informação sabe, pelo tipo de informação, em qual papel procurar — não precisa vasculhar tudo.

| Papel | Responde a | Onde vive | Muda com que frequência |
|---|---|---|---|
| **Agent rules** | "Como eu devo me comportar neste projeto, sempre?" | `CLAUDE.md` | Raramente — só quando o próprio modo de trabalhar muda |
| **Product intent** | "O que estamos construindo e por quê?" | `docs/product/` | Raramente — muda com pivô de produto, não com feature |
| **Domain language** | "O que significam nossos conceitos?" | `docs/domain/glossary.md` | Pouco — cresce quando um termo novo entra no domínio |
| **Architecture/specs** | "Como este subsistema deve funcionar, em detalhe suficiente para implementar?" | `docs/architecture/` | Pouco — só quando o desenho técnico muda de verdade |
| **Decisions** | "Por que escolhemos X e não Y?" | `docs/engineering/decisions/` (ADR) | Só quando uma decisão nova e cara de reverter é tomada; **decisão aceita é imutável** — mudança gera ADR novo que supersede |
| **Quality/standards** | "Que qualidade é exigida, e como fazer isso no dia a dia?" | `docs/engineering/quality-strategy.md`, `docs/engineering/standards/` | Pouco |
| **Work state** | "O que falta, o que foi conscientemente adiado, o que é dívida?" | `docs/backlog.md` | Constantemente — é o documento que devia mudar com mais frequência |
| **Operations** | "Como operar/recuperar o sistema?" | `docs/operations/`, `docs/runbooks/` | Conforme o operacional real muda |
| **Evidence** | "O que foi efetivamente verificado, e quando?" | `docs/engineering/audits/` | A cada auditoria/verificação executada |

`docs/architecture/system-overview.md` não é um papel próprio — é o **context router**: mapa de leitura e roteamento, deliberadamente não normativo (ver §4).

---

## 3. Mapa de arquivos e o papel de cada um

```text
CLAUDE.md                                   Agent rules

docs/product/
  vision.md                                 Product intent

docs/domain/
  glossary.md                               Domain language — specs usam os
                                             termos, nunca os redefinem

docs/architecture/
  system-overview.md                        Context router — mapa de leitura,
                                             read sets por tarefa, authority
                                             matrix. Não normativo.
  architecture.md                           ÚNICA arquitetura vigente (normativa)
  spec-dynamodb-access-patterns.md          Hot path de matching
  spec-notification-delivery.md             Hot path de delivery
  history/
    architecture-v1.md                      Desenho original — histórico,
                                             nunca normativo

docs/engineering/
  quality-strategy.md                       Quality/standards (política)
  standards/
    principles.md                           Por que as regras existem
    code-conventions.md                     Convenções de código
    testing-strategy.md                     Estratégia de testes
    git-and-review-workflow.md              Fluxo de git/PR
    joint-review-criteria.md                Critérios por eixo das revisões
                                             conjuntas Claude↔Codex
                                             (`AGENTS.md` §2.1) — fonte única,
                                             docs de audits só referenciam
  decisions/
    README.md                               Índice de ADRs + regra de
                                             imutabilidade/supersede
    adr-NNN-*.md                            Decisions (ADRs consolidados
                                             por componente, ver README.md
                                             do índice para a contagem atual)
  audits/                                   Evidence — vazio até a primeira
                                             auditoria rodar

docs/backlog.md                             Work state
docs/api/                                   Vazio — nasce quando a primeira
                                             API for definida
docs/operations/                            Operations — vazio
docs/runbooks/                              Operations — vazio
```

---

## 4. Uma única arquitetura vigente — sem versões ativas em paralelo

Duas arquiteturas ativas simultaneamente (`v1`, `v2`, "com v2 prevalecendo") funciona enquanto há só duas versões, mas degrada com o tempo (`v3`, `v4-final`, `v4-final-revised` — a progressão natural se nada impedir). Regra deste projeto:

```text
docs/architecture/architecture.md      única arquitetura vigente, normativa
docs/architecture/history/             desenho anterior, explicitamente
                                        marcado status:superseded — só serve
                                        para entender como o desenho chegou
                                        ao estado atual, nunca como fonte
```

Git já é o histórico de mudanças linha a linha; `history/` existe além do Git só porque o desenho anterior (V1) tinha escopo mais amplo que vale preservar como narrativa, não porque cada revisão futura ganha um arquivo novo. Da próxima vez que a arquitetura mudar de forma significativa, `architecture.md` é **editado no lugar** (é um documento vivo, ao contrário de ADR) — não vira `architecture-v3.md`.

---

## 5. Regra de não-duplicação — como ela é aplicada na prática

O risco concreto (visto no histórico auditado) é um ADR recriar o conteúdo de um spec, ou um valor de trigger existir tanto no spec quanto no backlog, e só um dos dois ser atualizado quando a decisão muda.

Aplicação neste projeto:

- **ADRs são curtos e citam o spec.** Nenhum ADR reexplica o desenho técnico completo — registra contexto/decisão/alternativas/trigger e aponta para a seção do spec com o detalhe.
- **Triggers vivem uma vez.** O backlog nunca repete o valor numérico de um trigger de evolução (`> 250k assinantes`, `28 msg/s`) — referencia o ADR/spec onde o valor está definido (ver `docs/backlog.md`). Se o valor mudar no spec, o backlog não precisa mudar.
- **`system-overview.md` não é fonte de verdade de nada** — é só um mapa. Se ele e um spec discordarem, o spec vence e o mapa está desatualizado (corrigir).
- **ADRs se consolidam por componente, não por detalhe.** Decisões que mudam juntas vivem no mesmo ADR — os specs originalmente geraram 19 ADRs propostos, consolidados para 9, exatamente para reduzir divergência entre ADRs irmãos.
- **`quality-strategy.md` e `standards/*.md` não se sobrepõem.** A estratégia define *o que* e *por quê*; os standards definem *como* no dia a dia.

---

## 6. ADR aceito é histórico imutável

Um ADR com status `accepted` registra a decisão tomada **naquele momento** — não é editado quando a implementação evolui (correção editorial de typo/link é aceitável; mudança de decisão não).

```text
Lifecycle: proposed → accepted → { superseded | deprecated | rejected }
```

Quando uma decisão aceita precisa mudar: cria-se um ADR novo com `supersedes: [ADR-NNN]`; o ADR antigo recebe `status: superseded` e `Superseded-by: ADR-NNN`. Nunca se reescreve a decisão original no lugar. Isso preserva não só o estado atual, mas por que o sistema evoluiu daquela forma — informação que se perde se o histórico for sobrescrito. Detalhe completo: `docs/engineering/decisions/README.md`.

---

## 7. Context Routing — qual verdade carregar para cada tarefa

Canonicalidade (§1-6) resolve "onde a verdade vive". Isso não basta sozinho — falta responder "qual conjunto mínimo de contexto uma tarefa específica precisa". Sem isso, o modo padrão vira "ler tudo em `docs/`", que não escala.

`docs/architecture/system-overview.md` define **read sets** por tipo de tarefa (implementar feature, alterar arquitetura, corrigir bug, trabalhar no matcher, trabalhar no dispatcher) — cada um lista a ordem mínima de documentos a carregar, terminando sempre no código real. Isso é progressive disclosure de contexto: carregar mais só quando a tarefa realmente exigir, não por hábito.

---

## 8. Authority Matrix e protocolo de drift

Existem várias "verdades" simultâneas num sistema real — o que o spec pretende, o que o Terraform declara, o que está de fato rodando na AWS. Quando elas divergem, isso é **drift**, não uma escolha livre de qual acreditar.

A Authority Matrix completa (qual fonte responde a qual pergunta) e o protocolo de resposta a drift vivem em `docs/architecture/system-overview.md` — resumo do protocolo: nunca resolver silenciosamente escolhendo um lado; registrar o drift; decidir explicitamente se a documentação estava desatualizada (corrigir o doc) ou a implementação estava errada (corrigir o código); auditoria de consistência periódica é o mecanismo que pega drift que ninguém reportou.

---

## 9. Contexto efêmero — o que nunca vira documento canônico

Regra completa em `CLAUDE.md` §"Contexto efêmero". Resumo: raciocínio intermediário, notas de investigação pontual, plano de implementação temporário e resumo já representado em outro lugar não viram arquivo em `docs/`. Só o resultado durável é promovido, e cada tipo de resultado tem exatamente um destino (decisão → ADR, desenho → spec, trabalho adiado → backlog, regra → standard, termo → glossary). "Não documentar" também pode ser a decisão correta — é o principal mecanismo contra entropia documental (arquivos tipo `final-v2-revised.md` se acumulando sem necessidade).

---

## 10. Domain Glossary

`docs/domain/glossary.md` existe para impedir que agentes (IA especialmente) introduzam variações de vocabulário sem perceber (`event`/`occasion`/`show`/`screening`/`session` usados de forma intercambiável para coisas diferentes). Regra: se um termo tem significado específico no domínio, a definição vive no glossary; specs e código usam o termo, nunca o redefinem.

---

## 11. Auditabilidade — o traço herdado mais importante

O ponto mais valioso identificado na auditoria do padrão anterior não foi nenhum controle técnico específico — foi a disciplina de **auditar contra a realidade, não contra a documentação** (`docs/engineering/quality-strategy.md` §9). Aplicado à própria estratégia de contexto:

- `docs/engineering/audits/` recebe tanto auditorias de consistência de produto/código quanto revisões da própria estratégia de contexto (evidence, não architecture nem backlog).
- `docs/backlog.md` tem uma seção "Dívida técnica conhecida" deliberadamente vazia hoje — o teste de que o sistema funciona é essa seção deixar de estar vazia assim que a primeira simplificação consciente for feita, em vez de ficar esquecida.
- Todo trigger de evolução é numérico ou verificável, nunca "quando parecer necessário", e vive uma única vez (§5).

---

## 12. O que este sistema deliberadamente não tem ainda

Consistente com "sofisticação segue complexidade observada" (`docs/engineering/standards/principles.md` §1):

```text
docs/api/                 vazio — nasce quando a primeira API pública for definida
docs/operations/          vazio — nasce com o primeiro ambiente real implantado
docs/runbooks/            vazio — nasce com o primeiro procedimento operacional real
docs/engineering/audits/  vazio até a primeira auditoria executada
metadata YAML completa    aplicada hoje aos documentos normativos centrais
                           (architecture.md, history/, system-overview.md,
                           glossary.md, ADRs); rollout para o restante de
                           docs/ é trabalho futuro, não urgente
context:check automatizado (link quebrado, índice de ADR ↔ arquivos,
                           doc ativo referenciando arquivo superseded) —
                           vale a pena quando o volume de documentos
                           justificar automação, não antes
AGENTS.md como contrato agnóstico de fornecedor de IA — CLAUDE.md
                           permanece o contrato único enquanto só um
                           agente for usado neste projeto
```

Não são lacunas esquecidas — são adiamentos conscientes, com o mesmo raciocínio de trigger aplicado ao resto da arquitetura: cada um entra em escopo quando o volume/necessidade real justificar, registrado aqui para não se perder.

---

## 13. Estratégia de saída do `docs/backlog.md`

Um arquivo Markdown funciona como work state canônico enquanto o projeto tem poucos desenvolvedores e poucos itens de trabalho simultâneos, sem necessidade de automação de workflow (prioridade, assignee, dependência, milestone). Quando isso deixar de ser verdade, a fonte canônica de work state migra para um issue tracker — e `docs/backlog.md` vira um ponteiro para lá ou é removido, nunca os dois coexistindo como sistemas paralelos de trabalho. Nenhum trigger numérico fixado ainda; revisitar quando o ritmo de trabalho justificar.
