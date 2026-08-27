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

**Checkpoint:** `npm test --workspace @zero/manifest` passa antes de tocar no
ciclo Docker.

### 2. Ambiente local, portas e nomes de serviço

Generalizar `renderLocalEnvironment` e `createLocalEnvironment` em
`packages/core/src/index.ts` para receber o profile ou os services já derivados
do manifesto. Manter as variáveis PostgreSQL existentes e gerar, exclusivamente
em `.env.local`, as variáveis necessárias ao `complete`:

- porta e URL local de Redis;
- portas de API e console do MinIO, credenciais locais e bucket fixo do exemplo;
- portas SMTP e web do Mailpit.

Toda porta será obtida com `findAvailablePort`, validada e persistida. As
credenciais serão criptograficamente aleatórias, criadas com exclusividade e
nunca adicionadas a journal, retorno JSON ou logs. Não será criado state schema
novo salvo se necessário para dados não sensíveis; o manifest continua sendo a
fonte do profile.

Adicionar testes unitários para formato de `.env.local`, unicidade de portas,
ausência de credenciais em serialização de estado e regressão do perfil
`essential`.

**Checkpoint:** os testes do `core` provam que a configuração complete não muda
o ambiente essential e que secrets não atravessam fronteiras públicas.

### 3. Criação e renderização profile-aware

Alterar `packages/cli/src/new.ts` para pedir profile no modo guiado, com
`essential` como padrão explícito, e para refletir o profile no resumo. O modo
declarativo continua exigir `--config <arquivo> --yes`; seu schema determina o
profile sem inferência adicional.

Em `packages/scaffold/src/index.ts`, fazer `renderEssentialProjectFiles` renderizar
metadata, `README.md`, página inicial e `package.json` a partir do manifesto:

- essential mantém somente dependências atuais;
- complete adiciona clientes Redis, S3/MinIO e SMTP em versões travadas;
- package-lock é atualizado de forma reproduzível a partir do template;
- README e AGENTS descrevem apenas as URLs e comandos aplicáveis ao profile,
  sem valores secretos.

Revisar o conjunto de `staticPaths` e arquivos do template para garantir que os
módulos e rotas `complete` sejam materializados somente quando habilitados.
Acrescentar testes de criação declarativa e de template para os dois profiles,
inclusive inspeção de arquivos gerados e do lock.

**Checkpoint:** `zero new --config` gera projetos diferentes apenas onde o
contrato determina, sem produzir dependências ou rotas opcionais no essential.

### 4. Compose e orquestração do complete

Evoluir `templates/next-fullstack/essential/compose.yaml` com serviços `redis`,
`storage` (MinIO) e `email` (Mailpit), cada qual com health check, portas
loopback, nomes derivados do projeto Compose e volumes próprios quando houver
dados persistentes. Usar profiles Docker e argumentos explícitos; não depender
de uma seleção de profile recebida do ambiente do usuário.

Em `packages/cli/src/up.ts`:

- derivar a lista fechada de serviços do manifesto validado;
- iniciar explicitamente `db` e, para `complete`, `redis`, `storage` e `email`;
- esperar saúde de cada dependência habilitada antes de migrations, seed e app;
- conservar o journal e a retomada idempotente existentes;
- nunca executar Compose contra daemon remoto nem aceitar nome de serviço externo.

Adaptar `down.ts` para encerrar somente o mesmo conjunto de serviços no namespace
validado, mantendo todos os volumes. Atualizar testes com stubs de subprocesso
para verificar argv fixo e rejeição de configurações incompatíveis.

**Checkpoint:** dois slugs `complete` podem receber portas e namespaces distintos;
interromper ou encerrar um não interrompe o outro.

### 5. Operação, diagnóstico e saída segura

Atualizar `status.ts` para filtrar/ordenar a saída pelo conjunto esperado no
manifesto, incluindo `app`, e expor somente `name`, `state` e `health`.

Atualizar `logs.ts` para aceitar a lista fechada `app|db|redis|storage|email` e
recusar um serviço não habilitado pelo profile. Reutilizar e ampliar a sanitização
para URLs Redis/S3/SMTP, `MINIO_ROOT_PASSWORD`, tokens, senhas e demais
atribuições sensíveis antes de escrever stdout.

Atualizar `doctor.ts` com checks por serviço habilitado: ambiente privado
presente sem lê-lo na saída, daemon Docker local e condição dos containers. Os
checks e as ações recomendadas devem mencionar somente os componentes do
profile. Atualizar `main.ts` para ajuda, erros e mensagens de `new`, `up`,
`status` e `logs` compatíveis com os dois perfis.

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
- rotas de exemplo para cache com TTL, upload/listagem de arquivo e e-mail de
  teste;
- validação centralizada de ambiente, com parsing estrito de portas, URLs e
  limites de upload.

As rotas não aceitam bucket arbitrário, caminho arbitrário, destinatários
livres nem payloads ilimitados. Elas retornam erros genéricos e não enviam
e-mail a serviços externos. A rota de saúde consulta os serviços habilitados,
retorna a forma pública estável `{ status, checks }` e usa `503` quando qualquer
dependência obrigatória do profile está indisponível.

Criar testes de unidade dos adaptadores com mocks e testes de rota para entradas
válidas, tipos/tamanho recusados, falhas de dependência e não exposição de
detalhes internos. Confirmar que arquivos, dependências e rotas não existem no
template materializado em `essential`.

**Checkpoint:** complete demonstra integração real sem transformar o template em
uma aplicação de negócio.

### 7. Documentação, pacote e gauntlet

Atualizar `.env.example`, `README.md`, `AGENTS.md`, `CLAUDE.md`, template lock,
`package-lock.json` e scripts de empacotamento para que o tarball contenha todos
os artefatos necessários. Verificar que nenhum arquivo local ou secret entre no
pacote.

Executar:

```sh
npm run check
npm pack --workspace @zero/cli
```

Quando Docker local estiver disponível, executar o gauntlet:

1. criar dois projetos `complete` por configurações declarativas distintas;
2. executar `zero up` nos dois e confirmar portas/health isolados;
3. validar cache TTL, upload/listagem no MinIO e mensagem na inbox Mailpit;
4. conferir `status`, `doctor` e `logs` e procurar secrets nas saídas;
5. derrubar somente um namespace e confirmar que o segundo continua saudável;
6. testar falha de serviço, colisão de porta, journal adulterado e retomada;
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
| Portas extras entram em conflito | Resolução local por serviço, state privado e teste com dois slugs. |
| Logs de novos serviços expõem credentials | Sanitizador comum, allowlist de serviços e testes de redaction. |
| Health check de SMTP é inconsistente | Verificar conectividade SMTP curta e degradar para 503 sem detalhe. |
| Exemplo de upload cria superfície excessiva | Interface estreita, bucket fixo, allowlist de tipo/tamanho e sem caminhos do usuário. |
