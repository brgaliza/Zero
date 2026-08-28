# Zero — Plano de implementação da Sprint 2

**Status:** concluída em 27 de agosto de 2026  
**Base de produto:** [design refinado da Fase 1](../specs/2026-08-26-zero-fase-1-design.md)  
**Dependência concluída:** [Sprint 1](2026-08-26-zero-sprint-1-plan.md), aprovada no gauntlet

## 1. Objetivo do incremento

Entregar o ciclo local seguro do perfil `essential`: um projeto criado pelo
Zero passa de fundação estática a ambiente local verificável, com PostgreSQL em
Docker, Prisma, aplicação Next.js e comandos operacionais explícitos.

Ao fim da sprint, `zero new` (quando `initialization.start: true`) e `zero up`
devem deixar um projeto `essential` acessível, sem gravar secrets no Git e sem
colidir com outro projeto local.

## 2. Escopo fechado

### Incluído

- Pacote `core` para subprocessos com `argv` estruturado, Docker local, portas,
  estado local e diagnóstico de projeto.
- Evolução compatível dos contratos de criação para permitir `start: true`;
  o perfil permanece somente `essential` e não habilita serviços opcionais.
- Template `essential` executável: `compose.yaml`, Dockerfile, Prisma Client,
  migration inicial, seed repetível, `.env.example`, página de prontidão e
  `GET /api/health` dependente do PostgreSQL.
- Geração exclusiva de `.env.local` com credenciais locais; o arquivo é privado,
  ignorado pelo Git e nunca aparece em resultados, logs ou journal.
- Namespace Docker, rede e volume exclusivos por slug; PostgreSQL 17 com
  `pg_isready`; resolução de porta da aplicação e banco sem conflito evitável.
- Estado local ignorado pelo Git, com schema, caminho canônico, hash do
  manifesto, portas efetivas e PID verificável quando a aplicação for gerida.
- Journal seguro e `zero new --resume <diretório>` para retomar somente etapas
  pendentes, recusando contrato, caminho ou operação divergentes.
- `zero up`, `zero down`, `zero status`, `zero logs [app|db]` e `zero doctor`
  para o perfil essential, com mensagens PT-BR e logs sem secrets.
- Testes unitários e de integração controlada; testes end-to-end reais quando
  Node 24 ou superior, npm 11 e Docker local estiverem disponíveis.

### Fora da Sprint 2

- Perfil `complete`, Redis, MinIO, Mailpit, adaptadores e seus painéis.
- Git, GitHub, CI gerada, `zero build`, `zero test`, `zero clean` e `zero context`.
- `zero db migration`, `migrate`, `seed` e `reset` como comandos públicos.
- CRUD de exemplo, autenticação, deploy e alterações automáticas em projetos
  criados em versões anteriores.

## 3. Contratos e decisões de segurança

- Docker é exclusivamente local: a CLI limpa `DOCKER_HOST`, não seleciona
  contextos remotos e aceita apenas o daemon local validado.
- Todo processo externo usa binário e argumentos fixos/validados; não há shell,
  interpolação de texto do usuário, `npm install` fora do projeto validado ou
  uso de `npx`.
- A criação do secret usa aleatoriedade criptográfica e criação exclusiva. Se
  `.env.local` já existir, a operação para e orienta inspeção; jamais o mescla
  ou sobrescreve.
- Antes de executar comandos no projeto, a CLI lê e valida `zero.yaml`, prova o
  diretório canônico e confere o lock do template. Estado e journal pertencem ao
  mesmo caminho canônico e ao hash do manifesto.
- Os nomes Docker derivam do slug já validado. Volumes e redes são do projeto;
  `zero down` preserva volumes. Nenhum comando da sprint remove volumes ou
  banco automaticamente.
- Portas preferenciais são experimentadas localmente; se indisponíveis, uma
  porta livre é reservada e registrada somente no estado local. Uma porta já
  atribuída só é reutilizada após comprovar que pertence ao mesmo projeto.
- `zero up` aplica apenas migrations versionadas e executa seed repetível. Não
  cria migration de modo implícito. `Ctrl+C` interrompe somente a aplicação e
  preserva a infraestrutura.
- `zero down` encerra a aplicação apenas se o PID, diretório e linha de comando
  comprovarem que ela pertence ao projeto; depois para apenas o namespace
  Docker do projeto.

## 4. Plano em ordem de commit

1. **Contratos de runtime e pacote core** — criar limites entre CLI, core,
   manifesto e scaffold; definir modelos de estado/journal e validação.
2. **Template essential executável** — acrescentar Compose, Dockerfile, Prisma
   Client, migration/seed, health check e página de prontidão, sem valores
   sensíveis.
3. **Segredos e estado local** — materializar `.env.local` de forma exclusiva,
   sanitizar saídas e persistir estado/journal atômicos, privados e ignorados.
4. **Docker, portas e banco** — implementar daemon local, namespace, health
   checks, portas e infraestrutura PostgreSQL sem comandos destrutivos.
5. **Ciclo de aplicação** — instalar dependências no destino validado, gerar
   Prisma, executar migration/seed e gerir o processo Next.js.
6. **Comandos de operação** — implementar `new` com início/resume, `up`,
   `down`, `status`, `logs` e `doctor`, incluindo ajuda e erros de recuperação.
7. **Gauntlet** — validar interrupções, collisions, daemon remoto, segredos,
   PID reaproveitado, journal adulterado, tarball e dois projetos simultâneos.

## 5. Critérios de aceite

- Um projeto `essential` novo inicia PostgreSQL 17, aplica a migration, executa
  seed e responde `200` em `/api/health` quando aplicação e banco estiverem
  saudáveis.
- Sem Docker, daemon não acessível, Node/npm incompatíveis ou manifesto inválido
  falham antes de mutações inseguras e informam a próxima ação.
- `.env.local`, credenciais, portas transitórias, PID e journal não entram no
  Git, nos envelopes JSON ou nos logs; nenhum secret é exposto por `status`,
  `doctor` ou `logs`.
- Dois slugs válidos funcionam em paralelo, com nomes Docker, volumes e portas
  distintos; `down` de um não afeta o outro.
- Interrupção e falha em cada etapa preservam o que é recuperável, registram a
  etapa concluída e permitem somente retomada explícita e coerente.
- `zero up` preserva volumes após `Ctrl+C`; `zero down` não encerra PID alheio
  nem remove dados.
- O pacote produzido por `npm pack` contém os novos contratos/template e passa
  os testes de instalação. E2E real fica condicionado ao runtime oficial.

## 6. Riscos e mitigação

| Risco                                           | Impacto                        | Mitigação                                                                            |
| ----------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| Docker aponta para daemon remoto                | Mutação fora da máquina local  | Sanitizar ambiente, validar endpoint local e recusar contexto remoto.                |
| PID reaproveitado                               | `down` encerra processo alheio | Validar PID, diretório canônico e linha de comando antes de sinalizar.               |
| Falha após secret ou banco criado               | Criação incompleta             | Journal atômico, etapas idempotentes e `--resume` explícito.                         |
| Colisão de porta/namespace                      | Projetos interferem entre si   | Slug validado, reserva local, estado por projeto e revalidações.                     |
| Ambiente de desenvolvimento anterior ao Node 24 | E2E não representa o contrato  | Testes com runtime controlado; executar gauntlet real em Node 24 ou superior/npm 11. |

## 7. Definição de pronto

- [x] Código revisado e integrado
- [x] Testes unitários, integração e pacote passando
- [x] Gauntlet de segurança e recuperação sem achados críticos/altos
- [x] Documentação gerada atualizada para ambiente em execução
- [x] Fluxo real validado em macOS Apple Silicon com Node 24 ou superior, npm 11 e Docker local
