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

- `zero test` não inicia Docker, não instala dependências e não escreve no
  projeto; executa apenas os scripts rápidos, por argumentos fixos.
- `zero test --e2e` e `zero build` não usam identidade, namespace, portas,
  containers, redes, volumes, journal ou PID persistentes do projeto.
- Recursos temporários são nomeados por identificador aleatório, pertencem a
  uma execução e são removidos de forma idempotente em sucesso, erro, timeout,
  `SIGINT` e `SIGTERM`.
- A barreira de Docker local confiável é aplicada antes de todo subprocesso
  Docker. O subprocesso recebe explicitamente o endpoint validado e não herda
  seleção de host/contexto do ambiente do usuário.
- Serviços, imagens, portas e argumentos são derivados de manifesto validado e
  de allowlists; nenhuma entrada do usuário escolhe recurso Docker arbitrário.
- Nenhuma saída, envelope JSON, log ou artefato contém valores de `.env.local`,
  URL autenticada, token, senha, argumento secreto ou `compose config`.
- Falha de cleanup não encobre a falha original e não autoriza limpeza ampla:
  a recomendação de recuperação referencia apenas IDs temporários conhecidos.

## Ordem de implementação

### 1. Contrato de comandos, ajuda e testes de parsing

Adicionar `test` e `build` em `packages/cli/src/main.ts`, com módulos próprios
e contratos estritos:

- `zero test` aceita nenhuma opção;
- `zero test --e2e` aceita exatamente a opção `--e2e`;
- `zero build` aceita nenhuma opção;
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

### 2. Executor seguro e ciclo de recursos efêmeros

Extrair para `packages/core` um executor de subprocesso que:

- recebe binário e argv tipados/validados, diretório canônico e ambiente mínimo;
- captura stdout/stderr com limite de bytes e sanitiza antes de retornar;
- recebe segredos somente de fonte privada e nunca os serializa;
- conserva status, timeout e causa em estrutura segura para diagnóstico.

Criar uma abstração de execução efêmera que gera identificador criptográfico,
nomes de tag/rede/volume/container dentro de regex restrita e um diretório
temporário privado. Ela registra recursos criados apenas em memória e oferece
`cleanup()` idempotente em ordem reversa. Sinais e timeout chamam a mesma
rotina; exceções de cleanup são agregadas sem perder a causa principal.

Incorporar a barreira existente de transporte Docker local nessa camada e
proibir que módulos de `test` e `build` usem `spawn` ou `spawnSync` diretamente.

Testar limites de saída, corpus de secrets/URLs, timeout, repetição de cleanup,
falha parcial de criação e rejeição de host/contexto Docker remoto.

**Checkpoint:** qualquer caminho de falha deixa somente recursos efêmeros
identificáveis, sem vazar configuração privada.

### 3. Scripts e testes rápidos do template

Completar o template com scripts explícitos e reproduzíveis para `lint`,
`typecheck`, `test` e um agregador de validação rápida. Adicionar Vitest e React
Testing Library apenas se faltarem ao lock final e criar testes mínimos para:

- resposta e forma pública de `/api/health` no perfil `essential`;
- presença somente dos checks esperados pelo profile;
- adaptadores e rotas de exemplo do `complete`, incluindo limites de entrada e
  ausência de detalhes internos em erro.

Fazer o scaffold renderizar arquivos, dependências, scripts e lock de modo
profile-aware. O `essential` não inclui testes, rotas ou dependências exclusivos
de `complete`. Atualizar as verificações de template, tarball e inventário.

`zero test` lê e valida o manifesto e executa exclusivamente o script rápido
permitido via npm, com diretório e ambiente seguros. Não cria `.env.local`, não
chama Docker e não altera `package-lock.json`.

**Checkpoint:** projetos materializados dos dois perfis passam validação rápida
em instalação limpa, e a CLI comprova que a execução não tem efeito de
infraestrutura.

### 4. `zero test --e2e` em ambiente isolado

Construir a fixture e2e a partir do template materializado no tarball, em
diretório temporário que não seja o diretório do usuário. Gerar um manifesto
declarativo de cada profile e executar a CLI instalada do artefato, não fontes
do checkout. A fixture deve criar identidade própria e nunca registrar estado
no projeto sob teste.

Para cada profile:

1. instalar dependências de forma reprodutível;
2. iniciar somente serviços permitidos em namespace temporário;
3. esperar health checks, aplicar migrations e seed;
4. iniciar aplicação presa a loopback e confirmar página/`/api/health`;
5. no `complete`, exercitar cache TTL, upload/listagem limitada e e-mail para
   `demo@local.test`;
6. capturar diagnóstico sanitizado apenas em falha e limpar os recursos.

Adicionar testes de regressão que mantenham dois projetos locais `up` enquanto
o e2e ocorre e comparem seus nomes Compose, portas e volumes antes/depois.
Adicionar cenários de cancelamento, timeout de health, falha de migration e
serviço degradado; todos devem executar cleanup e retornar código recuperável.

**Checkpoint:** os dois perfis têm prova e2e real, e um ambiente do usuário
permanece inalterado mesmo quando a fixture falha.

### 5. `zero build` e smoke test de produção

Definir um Dockerfile de produção reproduzível, de múltiplos estágios e sem
`.env.local` no contexto. O build recebe tag efêmera gerada pela camada comum;
nenhuma tag persistente ou publicação é permitida.

Depois do build, criar pilha temporária com imagem recém-construída e PostgreSQL
isolado. Executar migrations como etapa finita, iniciar aplicação, aguardar bind
em loopback e consultar `/api/health` dentro de timeout. Para `complete`, subir
Redis, storage e e-mail necessários para a forma saudável do health, sem
duplicar os testes funcionais de exemplos do e2e.

Validar que a imagem não contém `.env.local` nem arquivos de estado da CLI;
provar que o processo escuta somente a interface permitida. Cobrir falha de
build, migration, readiness e smoke test, sempre com remoção de imagem e pilha
temporárias.

**Checkpoint:** `zero build` valida a imagem de produção sem modificar recursos
locais persistentes e sem publicar artefatos.

### 6. CI, gate Docker e release

Adicionar `.github/workflows/ci.yml` ao template e, quando aplicável, ao
repositório do Zero. Separar jobs de qualidade/pacote e Docker:

- qualidade: instalação limpa, formatação, lint, typecheck e testes unitários;
- pacote: `npm pack`, instalação sem scripts e materialização do template do
  tarball;
- Docker: matriz `essential`/`complete`, `zero test --e2e` e `zero build`.

Configurar gatilhos de push e pull request, versões fixas das actions e
permissões mínimas. Logs de Docker em falha passam primeiro pelo sanitizador e
obedecem a limite de tamanho. Modelar waiver humano como arquivo versionado com
identificador do job, justificativa, aprovador e data ISO de expiração; um job
de gate falha quando o Docker não executa e não existe waiver válido. O waiver
não é criado automaticamente pela CI.

Testar o workflow por análise estática e por fixture local que verifica matriz,
permissões, ações pinadas, comandos previstos e regra de expiração.

**Checkpoint:** a promoção só pode ocorrer com matriz Docker aprovada ou uma
exceção humana verificável e ainda válida.

### 7. Gauntlet e documentação final

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
2. executar os três comandos de qualidade nas fixtures de ambos os perfis;
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
- E2e e build removem todos os próprios recursos mesmo em falha ou interrupção;
  projetos, volumes e processos locais já existentes não sofrem alteração.
- Imagens, comandos, logs, JSON e artefatos não revelam segredos nem incluem
  `.env.local`.
- A CI reproduz qualidade, pacote e matriz Docker e impede promoção sem job
  Docker aprovado ou waiver humano válido.
- `npm run check`, validação do pacote e gauntlet aplicável passam.

## Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| E2e lento ou instável | Timeouts explícitos, health checks determinísticos, diagnóstico limitado e reprodução local pelo mesmo comando. |
| Cleanup remove recurso local | Identificador criptográfico por execução, registro em memória, allowlist estrita e testes com projetos ativos. |
| CI ignora Docker por indisponibilidade | Job obrigatório e gate que só aceita waiver humano versionado e não expirado. |
| Logs de falha expõem secret | Executor único com redaction antes da renderização, corpus adversarial e tamanho máximo. |
| Build diverge do runtime | Smoke test contra imagem recém-construída, migrations e health no mesmo ambiente temporário. |
