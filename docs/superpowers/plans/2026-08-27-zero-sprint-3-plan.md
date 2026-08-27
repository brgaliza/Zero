# Zero — Plano de implementação da Sprint 3

**Status:** pronto para implementação  
**Design aprovado:** [perfil complete](../specs/2026-08-27-zero-sprint-3-design.md)  
**Dependência:** Sprint 2 aprovada

## Objetivo do incremento

Disponibilizar `complete` como perfil opt-in, operacional e isolado. Um projeto
`complete` criado por `zero new` e iniciado por `zero up` deve prover PostgreSQL,
Redis, MinIO e Mailpit; o template deve provar as integrações por exemplos
mínimos de cache, storage e e-mail. Projetos `essential` permanecem inalterados
em comportamento e contrato.

## Arquitetura de implementação

| Camada | Responsabilidade |
| --- | --- |
| `manifest` | Aceitar os dois perfis e impor a correspondência exata entre profile e services. |
| `core` | Gerar ambiente privado, portas e serviços habilitados de forma validada. |
| `cli` | Orquestrar somente os serviços permitidos; estender status, logs, doctor e ajuda. |
| `scaffold` | Renderizar metadados, dependências e documentação condicionais ao profile. |
| template | Definir os serviços Docker e exemplos de integração sem vazar infraestrutura ao domínio. |

## Invariantes obrigatórias

- No primeiro `zero new`, a CLI cria uma identidade local aleatória, ignorada
  pelo Git, com namespace Compose imutável. Ela é vinculada ao slug e ao
  diretório canônico inicial. Dois diretórios, ainda que usem o mesmo slug,
  nunca compartilham containers, redes ou volumes.
- Todo comando operacional (`up`, `down`, `status`, `logs` e `doctor`) exige
  coincidência entre o diretório canônico atual e a identidade local. Uma cópia
  não pode observar, diagnosticar nem encerrar o namespace de origem; somente
  `zero relocate` é permitido quando a origem comprovadamente não existe.
- Antes de qualquer comando Docker, inclusive diagnóstico, a CLI valida o
  transporte efetivo e aceita somente socket Unix local em caminho permitido,
  canônico e não-symlink. `DOCKER_HOST`, `DOCKER_CONTEXT`, contextos SSH/TCP e
  endpoints remotos são recusados com código próprio; cada subprocesso é fixado
  no mesmo endpoint que foi validado. Esta garantia é de transporte Unix local
  confiável; o socket é privilégio administrativo e um proxy local malicioso
  fica fora do modelo de ameaça.
- Uma porta só é considerada atribuída após seu consumidor (Docker ou aplicação)
  confirmar bind. Falhas de bind invalidam apenas a atribuição em disputa e
  reexecutam a alocação em transação segura; journal não marca a etapa como
  concluída antes disso.
- `.env.local` é a única fonte persistida pelo Zero para segredos. O socket
  Docker equivale a privilégio administrativo e fica fora dessa garantia. É
  proibido divulgar segredos em Git, tarball, state, journal, envelopes JSON,
  stdout, stderr ou arquivos de log; a CLI nunca imprime `compose config`.
- Aplicação, SMTP e todas as portas de serviço publicadas escutam exclusivamente
  em loopback. O adaptador de e-mail aceita somente host loopback e porta local
  validada, e envia o exemplo somente para `demo@local.test`.

## Ordem de implementação

### 1. Contrato de profiles e testes de manifesto

Atualizar `NewProjectConfig` e `ProjectManifest` para o union `essential | complete`.
Substituir os literais fixos por parser explícito de profile e por uma função
canônica de services esperados. `parseNewProjectConfig`,
`parseProjectManifest` e `parseGeneratedProjectManifest` devem rejeitar qualquer
combinação incompatível, por exemplo `profile: complete` com `redis: false`.

Atualizar `schemas/new-project-config.v1.schema.json`, os fixtures e os testes em
`packages/manifest/test/index.test.ts` para cobrir:

- aceitação de `essential` e `complete`;
- rejeição de profile desconhecido;
- rejeição de services inconsistentes em ambos os sentidos;
- preservação de validações atuais de YAML, slug e campos desconhecidos;
- geração correta do manifesto a partir de cada configuração.

**Checkpoint:** `npm test --workspace @brunogaliza/zero-manifest` passa antes de tocar no
ciclo Docker.

### 2. Ambiente local, namespace, portas e nomes de serviço

Generalizar `renderLocalEnvironment` e `createLocalEnvironment` em
`packages/core/src/index.ts` para receber o profile ou os services já derivados
do manifesto. Manter as variáveis PostgreSQL existentes e gerar, exclusivamente
em `.env.local`, as variáveis necessárias ao `complete`:

- porta e URL local de Redis;
- portas de API e console do MinIO, credenciais locais e bucket fixo do exemplo;
- portas SMTP e web do Mailpit.

Adicionar ao `core` uma identidade local criada exclusivamente durante `zero
new`, em `.zero/identity.local.json` com diretório `0700` e arquivo `0600`. Ela
contém ID aleatório, namespace derivado e caminho canônico de origem. Todos os
comandos usam a identidade, não `zero-<slug>` diretamente, e primeiro exigem a
coincidência do diretório atual. Uma movimentação ou cópia é detectada e todos
os comandos operacionais recusam agir; `zero relocate` é a única exceção. Ele
só altera o caminho da identidade após provar que o caminho de origem não
existe, que a identidade é privada, que não há outro projeto ativo com o mesmo
ID e que possui lock exclusivo. Cópias são recusadas e não podem observar nem
encerrar recursos da origem.

Substituir a alocação otimista por um fluxo de atribuição confirmada: portas
candidatas são reservadas por coordenador local com ownership, liberadas apenas
no instante de bind, e uma falha de bind de Docker/Next é identificada como
colisão, reatribuída e persistida por escrita atômica de `.env.local`. O journal
só recebe `environment-created` depois que o conjunto de portas foi confirmado;
a retomada de um journal parcial revalida cada bind e pode reatribuir apenas a
porta inválida. A quantidade de tentativas e o timeout são constantes testadas;
esgotá-los produz erro recuperável, sem indicar sucesso falso.

As credenciais serão criptograficamente aleatórias, criadas com exclusividade e
nunca adicionadas a journal, retorno JSON ou logs. Redis usa autenticação por
senha; MinIO recebe credenciais próprias; SMTP não recebe credencial. Não será
criado state schema novo salvo se necessário para metadados não sensíveis; o
manifest continua sendo a fonte do profile.

Adicionar testes unitários para formato de `.env.local`, unicidade e recuperação
de portas, namespace de mesmos slugs em diretórios distintos, relocação e cópia
recusada por todos os comandos operacionais, ausência de credenciais em
serialização de estado e regressão do perfil `essential`.

**Checkpoint:** os testes do `core` provam que a configuração complete não muda
o ambiente essential, que segredo não atravessa fronteiras públicas e que
namespace/portas não colidem sob concorrência simulada.

### 3. Matriz final do template, criação e renderização profile-aware

Alterar `packages/cli/src/new.ts` para pedir profile no modo guiado, com
`essential` como padrão explícito, e para refletir o profile no resumo. O modo
declarativo continua exigir `--config <arquivo> --yes`; seu schema determina o
profile sem inferência adicional.

Definir primeiro uma matriz explícita de arquivos e dependências por profile,
que será fonte única para `staticPaths`, renderização, template lock e inventário
do tarball. Em `packages/scaffold/src/index.ts`, fazer
`renderEssentialProjectFiles` renderizar metadata, `README.md`, página inicial e
`package.json` a partir do manifesto:

- essential mantém somente dependências atuais;
- complete adiciona clientes Redis, S3/MinIO e SMTP em versões travadas;
- package-lock é atualizado de forma reproduzível a partir da matriz final, e
  os dois perfis são instalados e auditados separadamente;
- README e AGENTS descrevem apenas as URLs e comandos aplicáveis ao profile,
  sem valores secretos.

Revisar o conjunto de `staticPaths` e arquivos do template para garantir que os
módulos e rotas `complete` sejam materializados somente quando habilitados.
Acrescentar testes de criação declarativa e de template para os dois profiles,
inclusive inspeção de arquivos gerados e do lock.

**Checkpoint:** `zero new --config` gera projetos diferentes apenas onde o
contrato determina, sem produzir dependências ou rotas opcionais no essential.

### 4. Barreira Docker, Compose e orquestração do complete

Implementar primeiro no `core` a barreira `assertTrustedLocalDockerTransport`:
ela resolve o endpoint de cada contexto sem mutá-lo, permite apenas socket Unix
em allowlist, resolve seu caminho canônico e recusa symlink, SSH, TCP e endpoint
remoto. Todos os módulos CLI usam essa barreira antes de `version`, `compose`,
`ps`, `logs` ou `down`; nenhum subprocesso herda ambiente Docker não validado,
e cada um recebe explicitamente o endpoint que a barreira validou.

Evoluir `templates/next-fullstack/essential/compose.yaml` com serviços `redis`,
`storage` (MinIO) e `email` (Mailpit), cada qual com health check, portas
loopback, nomes derivados do projeto Compose e volumes próprios quando houver
dados persistentes. Usar profiles Docker e argumentos explícitos; não depender
de uma seleção de profile recebida do ambiente do usuário.

Incluir `storage-init` como etapa interna explícita para bootstrap idempotente e
autenticado do bucket fixo. Ele depende de `storage` saudável, recebe timeout
finito, executa `mc mb --ignore-existing`, encerra com código zero e nunca fica
em execução contínua. `up` deve iniciar e aguardar sua conclusão antes de
migrations, seed ou app; falha do init mantém infraestrutura e journal
recuperáveis, e a nova tentativa não recria nem apaga objetos existentes. Fixar
imagens por digest além da tag legível e especificar health checks, timeout,
interval e retries compatíveis com cada imagem. Redis inicia com senha e health
check autenticado; MinIO e Mailpit recebem probes sem imprimir argumentos
sensíveis.

Em `packages/cli/src/up.ts`:

- derivar a lista fechada de serviços do manifesto validado;
- iniciar explicitamente `db` e, para `complete`, `redis`, `storage`, `email` e
  a etapa interna `storage-init`;
- esperar saúde de cada dependência habilitada antes de migrations, seed e app;
- confirmar que cada porta publicada está vinculada à atribuição atual, refazer
  somente a atribuição que colidiu e retomar de forma segura;
- conservar o journal e a retomada idempotente existentes;
- nunca executar Compose contra daemon remoto nem aceitar nome de serviço externo.

Adaptar `down.ts` para encerrar somente o mesmo conjunto de serviços no namespace
validado, mantendo todos os volumes. Atualizar testes com stubs de subprocesso
para verificar argv fixo e rejeição de configurações incompatíveis.

**Checkpoint:** dois slugs `complete` podem receber portas e namespaces distintos;
interromper ou encerrar um não interrompe o outro.

### 5. Operação, diagnóstico, readiness e saída segura

Atualizar `status.ts` para filtrar/ordenar a saída pelo conjunto esperado no
manifesto, incluindo `app`, e expor somente `name`, `state` e `health`.

Atualizar `logs.ts` para aceitar a lista fechada `app|db|redis|storage|email` e
recusar um serviço não habilitado pelo profile. Criar um executor único que
captura stdout, stderr e erros de todos os subprocessos, limita tamanho, aplica
redaction baseada nos valores secretos efetivamente gerados e em padrões de
URL/atribuição codificados, e só então decide o que pode ser exibido. `up`,
`down`, `status`, `doctor` e `logs` deixam de usar `stdio: inherit`; casos de
falha fornecem diagnóstico sanitizado e ação de recuperação.

`startApplication` usa `next dev --hostname 127.0.0.1` e, no modo background,
espera bind e `GET /api/health` com timeout/backoff. Só depois registra PID e
`application-started`; crash, timeout ou health `503` retornam erro recuperável,
preservando infraestrutura sem estado de êxito falso.

Atualizar `doctor.ts` com checks por serviço habilitado: ambiente privado
presente sem lê-lo na saída, daemon Docker local e condição dos containers. Os
checks e as ações recomendadas devem mencionar somente os componentes do
profile. Atualizar `main.ts` para ajuda, erros e mensagens de `new`, `up`,
`status`, `logs` e `relocate` compatíveis com os dois perfis.

Adicionar testes de comando e snapshots/asserções de resultados para serviços
permitidos, serviços recusados, saída JSON sem secret e degradação individual.

**Checkpoint:** `status`, `doctor` e `logs` oferecem diagnóstico suficiente para
recuperação sem divulgar configuração privada.

### 6. Integrações mínimas do template complete

Adicionar ao template somente quando `complete`:

- `app/lib/cache.ts`: interface de cache e adaptador Redis;
- `app/lib/storage.ts`: interface `put`/`list` e adaptador S3 compatível com
  MinIO;
- `app/lib/email.ts`: adaptador SMTP limitado ao ambiente local;
- rotas de exemplo com contratos fechados: cache TTL de 300 s; upload de até
  5 MiB para `image/png` ou `image/jpeg`; chave UUID gerada no servidor; listagem
  limitada a 50 itens; e-mail de teste ao único destinatário
  `demo@local.test`;
- validação centralizada de ambiente, com parsing estrito de portas, URLs e
  limites de upload.

As rotas não aceitam bucket arbitrário, caminho arbitrário, destinatários
livres nem payloads ilimitados. O upload conta bytes em streaming e aborta antes
de materializar conteúdo acima do limite; também trata nome malicioso, MIME
incompatível e falha parcial de storage. Elas retornam erros genéricos e não
enviam e-mail a serviços externos. A rota de saúde retorna a forma pública
fechada `{ status, checks }`, em que `checks` contém somente serviços habilitados
e valores `ok` ou `unavailable`, sem mensagens internas; usa `503` se qualquer
dependência obrigatória falhar.

Criar testes de unidade dos adaptadores com mocks e testes de rota para entradas
válidas, tipos/tamanho recusados, falhas de dependência e não exposição de
detalhes internos. Confirmar que arquivos, dependências e rotas não existem no
template materializado em `essential`.

**Checkpoint:** complete demonstra integração real sem transformar o template em
uma aplicação de negócio.

### 7. Documentação, pacote, CI e gauntlet

Atualizar `.env.example`, `README.md`, `AGENTS.md`, `CLAUDE.md`, template lock,
`package-lock.json` e scripts de empacotamento para que o tarball contenha todos
os artefatos necessários. Verificar que nenhum arquivo local ou secret entre no
pacote.

Adicionar job CI Linux em executor com Docker obrigatório que materializa e
exercita os dois perfis. Release não pode ser promovido se esse job falhar ou
não executar; uma exceção temporária exige waiver humano escrito, data de
expiração e bloqueio explícito do Human Gate.

Executar:

```sh
npm run check
npm pack --workspace @brunogaliza/zero
```

Quando Docker local estiver disponível, executar o gauntlet:

1. criar dois projetos `complete` com o **mesmo slug** em diretórios distintos,
   testar `zero relocate` e uma cópia recusada;
2. executar `zero up` nos dois e confirmar portas/health isolados;
3. validar cache TTL, upload/listagem no MinIO e mensagem na inbox Mailpit;
4. conferir `status`, `doctor` e `logs` e procurar secrets nas saídas;
5. derrubar somente um namespace e confirmar que o segundo continua saudável;
6. testar corrida de `up`, falha de bind, falha de serviço, contexto Docker
   remoto, journal adulterado e retomada;
7. registrar resultados em `docs/superpowers/audits/2026-08-27-zero-sprint-3-gauntlet.md`.

## Critérios de aceite

- `zero new` aceita e registra `essential` ou `complete`; qualquer contrato
  contraditório é recusado antes de mutação.
- `zero up` de `complete` inicia PostgreSQL, Redis, MinIO e Mailpit isolados e
  saudáveis; `essential` não sofre regressão.
- O template `complete` prova cache, storage e e-mail local com limites e sem
  dependência de serviços externos.
- `status`, `logs`, `doctor`, `down` e retomada respeitam o profile e não agem
  sobre projetos vizinhos.
- Credenciais e URLs autenticadas ficam apenas em `.env.local` e não aparecem em
  Git, package, estado, journal, logs, texto ou JSON da CLI.
- Testes, lint, typecheck, empacotamento e gauntlet aplicável passam.

## Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Dependências opcionais contaminam essential | Renderização e testes específicos por profile; manifests incompatíveis falham. |
| Mesmo slug, cópia ou diretório movido | Identidade local privada, match canônico obrigatório, relocate bloqueado e e2e de ownership. |
| Portas extras entram em conflito | Atribuição confirmada, recuperação atômica e teste concorrente de bind. |
| Docker remoto por contexto ativo | Barreira de socket Unix local antes de qualquer subprocesso Docker. |
| Logs de novos serviços expõem credentials | Executor capturado e sanitizador por valores reais, corpus adversarial e allowlist. |
| Health check de SMTP é inconsistente | Verificar conectividade SMTP curta e degradar para 503 sem detalhe. |
| Exemplo de upload cria superfície excessiva | Interface estreita, bucket fixo, allowlist de tipo/tamanho e sem caminhos do usuário. |
