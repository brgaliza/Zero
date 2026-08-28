# Zero — Plano de implementação da Sprint 4

**Status:** pronto para implementação  
**Design aprovado:** [confiabilidade e validação](../specs/2026-08-27-zero-sprint-4-design.md)  
**Dependência:** Sprint 3 aprovada

## Objetivo do incremento

Entregar os comandos `zero test`, `zero test --e2e` e `zero build`, com uma
matriz CI que os reproduza para `essential` e `complete`. As validações reais
devem ser temporárias, limpas ao fim e totalmente isoladas de um projeto que o
usuário já tenha iniciado com `zero up`.

## Invariantes obrigatórias

- `zero test` não inicia Docker nem instala dependências; scripts npm e código
  do projeto são confiados ao proprietário, portanto a CLI não promete que
  sejam somente leitura, apenas não introduz escrita fora de seus artefatos.
- `zero test --e2e` e `zero build` não usam identidade, namespace, portas,
  containers, redes, volumes, journal ou PID persistentes do projeto.
- Recursos temporários são nomeados e rotulados por `run-id` aleatório; a
  intenção é registrada antes da criação e o cleanup idempotente seleciona
  somente recursos com os dois labels esperados. Ele roda em sucesso, erro,
  timeout, `SIGINT` e `SIGTERM`; crash, `SIGKILL` e queda do daemon só permitem
  recuperação limitada ao mesmo `run-id`.
- A barreira de Docker local confiável é implementada antes e aplicada a todo
  subprocesso, inclusive aos comandos existentes `up`, `down`, `status`,
  `logs` e `doctor`. O subprocesso recebe explicitamente o endpoint validado e
  não herda seleção de host/contexto do ambiente do usuário.
- `compose.yaml`, imagens, mounts, rede, portas e contexto Docker do projeto
  não são confiados: e2e/build usam definição efêmera interna com `-f` explícito
  e allowlists. Código e scripts npm do projeto são a fronteira confiada.
- Portas efêmeras só são publicadas como `127.0.0.1:0` e descobertas por
  ID/label depois do bind; `0.0.0.0` e alocação otimista são proibidos no host.
  O app pode escutar a interface interna necessária à rede privada do container.
- Contexto de build é materializado por allowlist; `.env.local`, `.zero`,
  `.git`, `node_modules` e artefatos locais não chegam ao daemon.
- Redaction é incremental, anterior a logs/renderização/limite e cobre segredos
  divididos entre chunks de stdout e stderr.
- Migrations, seed e aplicação usados por e2e/build recebem apenas ambiente
  efêmero injetado; nenhum script pode carregar `.env.local` implicitamente.
- `zero recover <run-id>` só remove recursos com intenção privada válida e ambos
  os labels do mesmo run-id, após confirmação; ele é a recuperação de crash,
  `SIGKILL` ou queda do daemon.
- O gate de CI depende de autoridade verificável: `release-gate` exige todos os
  jobs; waiver requer expiração, `CODEOWNERS`/branch protection ou Environment
  GitHub com aprovadores. Arquivo versionado sem esta proteção é insuficiente.
- Serviços, imagens, portas e argumentos são derivados de manifesto validado e
  de allowlists; nenhuma entrada do usuário escolhe recurso Docker arbitrário.
- Nenhuma saída, envelope JSON, log ou artefato contém valores de `.env.local`,
  URL autenticada, token, senha, argumento secreto ou `compose config`.
- Falha de cleanup não encobre a falha original e não autoriza limpeza ampla:
  a recomendação de recuperação referencia apenas IDs temporários conhecidos.

## Ordem de implementação

### 1. Barreira Docker e fronteira de confiança

Implementar em `packages/core` `assertTrustedLocalDockerTransport` antes de
qualquer comando novo. Ela resolve o endpoint efetivo sem executar Docker,
limpa `DOCKER_HOST`, `DOCKER_CONTEXT`, `DOCKER_CONFIG` e variáveis correlatas,
aceita apenas socket Unix local em allowlist explícita, canônico e não-symlink,
e constrói o ambiente mínimo para cada subprocesso. SSH, TCP, contexto remoto,
socket inexistente ou symlink falham com código próprio.

Migrar `up`, `down`, `status`, `logs` e `doctor` para o executor central e
acrescentar testes de regressão para cada comando. Formalizar a fronteira:
scripts/código do projeto são confiados; Compose, infraestrutura e contexto de
build não são. E2e/build nunca interpretam `compose.yaml` do projeto.

**Checkpoint:** nenhuma entrega da Sprint 4 depende da barreira declarada na
Sprint 3 sem que ela exista, seja testada e proteja os comandos legados.

### 2. Contrato de comandos, ajuda e testes de parsing

Adicionar `test` e `build` em `packages/cli/src/main.ts`, com módulos próprios
e contratos estritos:

- `zero test` aceita nenhuma opção;
- `zero test --e2e` aceita exatamente a opção `--e2e`;
- `zero build` aceita nenhuma opção;
- `zero recover <run-id>` aceita exatamente um run-id hexadecimal conhecido e
  requer confirmação; `--yes` só é permitido com o run-id explícito;
- `--json` é aceito somente onde a saída estruturada já for suportada pelo
  contrato definitivo; durante execução que acompanha logs, deve falhar antes
  de iniciar subprocessos;
- `zero help test` e `zero help build` explicam limites, pré-requisitos e ação
  de recuperação em português do Brasil.

Estender `packages/cli/test/main.test.ts` para validar ajuda, argv inválido,
códigos estáveis, ausência de importação operacional para comandos inválidos e
roteamento aos módulos novos.

**Checkpoint:** a superfície pública é fechada e documentada antes de executar
qualquer recurso externo.

### 3. Executor seguro e ciclo de recursos efêmeros

Extrair para `packages/core` um executor de subprocesso que:

- recebe binário e argv tipados/validados, diretório canônico e ambiente mínimo;
- drena stdout/stderr sem streaming direto, sanitiza incrementalmente antes de
  retornar/persistir e só então limita bytes em memória;
- recebe segredos somente de fonte privada e nunca os serializa;
- conserva status, timeout e causa em estrutura segura para diagnóstico.

Criar execução efêmera com `run-id` criptográfico, nomes dentro de regex,
labels obrigatórias em imagem, container/serviço, rede e volume, e diretório
privado. Persistir intenção não sensível antes de criar cada recurso e descobrir
recursos por `run-id`+labels no cleanup; não usar `compose down --volumes` em
arquivo do projeto. Implementar máquina de
estados com `AbortController`, promessa de cleanup compartilhada, grace period e
encerramento de grupo de processos; códigos distintos para cancelamento,
timeout, falha original e falha de cleanup.

Definir a intenção em diretório global privado do usuário do Zero (`0700`) e
arquivo `<run-id>.json` (`0600`). O schema estrito contém run-id, hash/diretório
canônico do projeto, finalidade, recursos esperados e etapa, sem segredo. Usar
criação/rename atômicos antes de cada recurso; reter somente intenção incompleta
até recuperação manual e remover após cleanup completo. Recusar symlink,
arquivo truncado, permissões inseguras, run-id desconhecido ou intenção que não
pertença ao usuário/projeto. Testar crash entre intenção e criação.

Proibir `spawn`/`spawnSync` direto nos módulos operacionais. Testar stream com
segredos atravessando chunks, saída grande, sinais durante cada etapa, repetição
de cleanup, crash simulado após intenção, falha parcial e daemon/contexto remoto.

**Checkpoint:** qualquer caminho de falha deixa somente recursos efêmeros
identificáveis, sem vazar configuração privada.

### 4. Scripts, locks e testes rápidos do template

Completar o template com scripts explícitos e reproduzíveis para `lint`,
`typecheck`, `test` e um agregador de validação rápida. Adicionar Vitest e React
Testing Library apenas se faltarem ao lock final e criar testes mínimos para:

- resposta e forma pública de `/api/health` no perfil `essential`;
- presença somente dos checks esperados pelo profile;
- adaptadores e rotas de exemplo do `complete`, incluindo limites de entrada e
  ausência de detalhes internos em erro.

Gerar e validar locks separados a partir de manifests profile-aware controlados.
O aceite inspeciona `package.json`, lock e árvore de `npm ci`: `essential` não
inclui dependência, rota ou teste exclusivo de `complete`. Atualizar scaffold,
`staticPaths`, tarball e inventário.

Separar os scripts Prisma: `db:migrate` e `db:seed` não usam `--env-file` nem
leem `.env.local`; recebem ambiente injetado. `zero up` é o único orquestrador
que lê o arquivo privado e injeta seus valores. Testar com `.env.local` sentinela
que aponta ao banco persistente, provando que e2e/build só migram o banco efêmero.

`zero test` lê e valida o manifesto e executa script rápido permitido via npm,
com ambiente seguro. Não cria `.env.local`, chama Docker ou altera lock, mas
documenta que o script do proprietário pode escrever em seus próprios arquivos.

**Checkpoint:** projetos materializados dos dois perfis passam validação rápida
em instalação limpa, e a CLI comprova que a execução não tem efeito de
infraestrutura.

### 5. `zero test --e2e` no projeto atual, isolado da infraestrutura local

O comando valida o projeto atual. Gerar compose efêmero interno com `-f`
explícito, imagens externas por digest, services/mounts/capacidades/rede em
allowlist e labels de `run-id`; nunca interpretar o Compose do projeto. Usar
publicação `127.0.0.1:0` e descobrir portas por ID/label após bind.

Para cada profile:

1. usar dependências já instaladas, sem instalação oculta;
2. iniciar somente serviços internos permitidos em namespace temporário;
3. esperar health checks, aplicar migrations e seed;
4. iniciar aplicação presa a loopback e confirmar página/`/api/health`;
5. no `complete`, exercitar cache TTL, upload/listagem limitada e e-mail para
   `demo@local.test`;
6. capturar diagnóstico sanitizado apenas em falha e limpar os recursos.

Inspecionar a publicação Docker para afirmar `127.0.0.1` no host e nenhuma porta
extra; permitir bind interno da aplicação necessário à rede privada e consultar
o health pelo endpoint loopback descoberto.

Adicionar testes de regressão que mantenham dois projetos locais `up` enquanto
o e2e ocorre e comparem seus nomes Compose, portas e volumes antes/depois.
Adicionar cenários de cancelamento, timeout de health, falha de migration e
serviço degradado; todos devem executar cleanup e retornar código recuperável.

**Checkpoint:** os dois perfis têm prova e2e real, e um ambiente do usuário
permanece inalterado mesmo quando a fixture falha.

Em paralelo, criar uma fixture exclusiva de CI que materializa o tarball e
executa esse mesmo contrato em cada perfil. Ela verifica a distribuição; não é
o comportamento de `zero test --e2e` no projeto atual.

### 6. `zero build` e smoke test de produção

Definir Dockerfile de produção reproduzível e multiestágio, com dependências de
produção separadas. O Dockerfile é código confiado do projeto, e isso é
documentado/testado por alteração controlada; o Zero controla o contexto e o
contrato observável, não suas instruções. Criar contexto efêmero por allowlist, além de `.dockerignore`
obrigatório; inserir sentinela secreta nos testes e provar que ela não chega ao
contexto, camadas (`docker image save`) ou artefatos. Build recebe tag efêmera,
mas usa digest retornado pelo daemon; não há tag persistente ou publicação.

Depois do build, criar pilha temporária com imagem recém-construída e PostgreSQL
isolado. Executar migrations em container/estágio efêmero com Prisma, separado
da imagem runtime, como etapa finita; iniciar aplicação, aguardar bind
em loopback e consultar `/api/health` dentro de timeout. Para `complete`, subir
Redis, storage e e-mail necessários para a forma saudável do health, sem
duplicar os testes funcionais de exemplos do e2e.

Validar que a imagem não contém `.env.local` nem arquivos de estado da CLI;
provar que o processo escuta somente a interface permitida. Cobrir falha de
build, migration, readiness e smoke test, sempre com remoção de imagem e pilha
temporárias.

**Checkpoint:** `zero build` valida a imagem de produção sem modificar recursos
locais persistentes e sem publicar artefatos.

### 7. CI, gate Docker e release

Adicionar workflows distintos ao repositório Zero e ao template, ambos
materializados/testados pelo scaffold quando pertinentes. O workflow do template
roda apenas checks nativos em runner limpo (instalação, qualidade, testes e build
Docker): ele não invoca `zero`, que não é dependência nem pacote publicado. O
workflow do repositório Zero instala a CLI a partir do tarball do próprio
checkout e separa jobs de qualidade/pacote e Docker:

- qualidade: instalação limpa, formatação, lint, typecheck e testes unitários;
- pacote: `npm pack`, instalação sem scripts e materialização do template do
  tarball;
- Docker: matriz `essential`/`complete`, `zero test --e2e` e `zero build`.

Configurar gatilhos, permissões mínimas e SHA completo de cada action. Logs de
falha são sanitizados e limitados. Criar `release-gate` final dependente de
todos os jobs, que falha em Docker skipped/cancelled/failure. Waiver contém job,
justificativa, aprovador e expiração, mas é aceito somente com proteção externa
documentada: `CODEOWNERS`+branch protection ou Environment com aprovadores.
Documentar e verificar a configuração externa; o waiver não é criado pela CI.
Implementar `release-gate` com `if: always()`: qualidade e pacote devem sempre
estar em `success`; somente Docker pode ser liberado por waiver autorizado,
válido e não expirado. Cobrir na fixture `success`, `failure`, `cancelled`,
`skipped`, waiver expirado e waiver válido.

Testar o workflow por análise estática e por fixture local que verifica matriz,
permissões, ações pinadas, comandos previstos e regra de expiração.

**Checkpoint:** a promoção só pode ocorrer com matriz Docker aprovada ou uma
exceção humana verificável e ainda válida.

### 8. Recuperação limitada, gauntlet e documentação final

Implementar `zero recover <run-id>` sobre a intenção privada registrada antes da
criação. Ele lista primeiro imagem, container, rede e volume que tenham
`zero.managed=true` **e** aquele run-id; confere tipo, finalidade e ownership,
recusa itens extras e só remove depois da confirmação. Adicionar testes de crash
após intenção e após cada criação, bem como recurso parecido sem todos os labels
que não pode ser removido.

Documentar que recuperação não é automática após `SIGKILL`/queda de daemon e que
o run-id exibido é necessário para a ação limitada.

Atualizar README, AGENTS.md, CLAUDE.md e ajuda gerada para explicar `zero test`,
`zero test --e2e` e `zero build`, seus pré-requisitos, tempo esperado, escopo
de limpeza e ações de recuperação. Não documentar segredos nem comandos de
remoção ampla.

Executar:

```sh
npm run check
npm pack --workspace @brunogaliza/zero
```

Em Docker local confiável, executar o gauntlet:

1. criar e manter dois projetos locais, um de cada profile, em execução;
2. executar os três comandos em projetos recém-criados de ambos os perfis e na
   fixture de release materializada do tarball;
3. interromper e induzir falhas de health/migration para verificar cleanup;
4. buscar valores conhecidos de `.env.local` em stdout, stderr, JSON, logs e
   artefatos;
5. comparar containers, redes, volumes e portas dos projetos antes/depois;
6. registrar comandos, resultados e ressalvas no relatório de gauntlet.

**Checkpoint final:** os critérios de aceite do design passam e o relatório
explica qualquer limitação reproduzível do ambiente de auditoria.

## Critérios de aceite

- `zero test`, `zero test --e2e` e `zero build` têm sintaxe fechada, ajuda clara
  e erros sanitizados.
- Um projeto novo `essential` e um `complete` passam os três comandos em Docker
  local confiável.
- E2e e build removem todos os próprios recursos em falha, timeout ou sinais
  capturáveis; após crash/SIGKILL, a recuperação limitada por labels/run-id não
  atinge projetos, volumes ou processos locais existentes.
- Imagens, comandos, logs, JSON e artefatos não revelam segredos nem incluem
  `.env.local`.
- A CI reproduz qualidade, pacote e matriz Docker e impede promoção sem job
  Docker aprovado ou waiver humano válido.
- `npm run check`, validação do pacote e gauntlet aplicável passam.

## Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| E2e lento ou instável | Timeouts explícitos, health checks determinísticos, diagnóstico limitado e reprodução local pelo mesmo comando. |
| Cleanup remove recurso local | Labels+run-id, intenção persistida antes da criação, descoberta limitada e testes com projetos ativos. |
| CI ignora Docker por indisponibilidade | `release-gate` obrigatório e waiver com autoridade externa verificável e expiração. |
| Logs de falha expõem secret | Executor incremental antes da renderização, corpus por chunks e tamanho máximo posterior à sanitização. |
| Build diverge do runtime | Smoke test contra imagem recém-construída, migrations e health no mesmo ambiente temporário. |
