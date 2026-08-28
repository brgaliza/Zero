# Zero — Design da Sprint 4: confiabilidade e validação de release

**Status:** proposto em 27 de agosto de 2026  
**Dependência:** Sprint 3 aprovada

## Objetivo

Fechar a validação local e automatizada de projetos gerados pelo Zero. Um
projeto recém-criado, nos perfis `essential` e `complete`, deve poder executar
testes rápidos, validar a pilha Docker real e construir uma imagem de produção
com smoke test isolado, sem alterar o ambiente de desenvolvimento nem expor
segredos. A mesma matriz deve proteger push e pull request na CI.

## Escopo

### Incluído

- `zero test` para a validação rápida do projeto atual.
- `zero test --e2e` para validação Docker real, isolada e profile-aware.
- `zero build` para build da imagem de produção e smoke test de health em
  pilha temporária e privada.
- `zero recover <run-id>` para limpeza limitada e confirmada de recursos órfãos
  de execução efêmera interrompida de forma não capturável.
- Testes e proteções de cleanup, isolamento e sanitização de saída.
- Workflow GitHub Actions nativo do template e workflow do repositório Zero,
  cuja matriz de perfis requer Docker e exercita a CLI empacotada.
- Validação de pacote da CLI e varredura de segredos em artefatos e saídas
  controladas.

### Fora do escopo

- Publicação de imagem, deploy, infraestrutura de nuvem ou credenciais remotas.
- Git, GitHub CLI, criação de repositório ou push automatizado.
- `zero context`, `zero db`, exemplos CRUD ou mudanças de perfil.
- Novos serviços, dependências de produto ou alteração do contrato dos perfis.
- Exclusão de volumes ou dados do ambiente de desenvolvimento.

## Contrato de comandos

### `zero test`

Executa a suíte rápida declarada pelo template: lint, typecheck e testes
unitários. A CLI valida propriedade local e manifesto antes de iniciar
subprocessos, usa argumentos fixos e retorna diagnóstico sanitizado. Não inicia
Docker nem instala dependências. Código, scripts npm e dependências do projeto
atual pertencem ao usuário; portanto a CLI não promete que scripts arbitrários
sejam somente leitura, apenas que não introduz escrita fora de seus artefatos.

`zero test --e2e` inclui a suíte rápida e valida **o projeto atual**, não uma
fixture de release diferente. Ele usa compose efêmero gerado internamente com
`-f` explícito, serviços, imagens por digest, mounts, redes e portas em
allowlist; jamais interpreta o `compose.yaml` do projeto. Namespace, rede,
portas e diretório temporários derivam de um identificador aleatório e de labels
obrigatórias, nunca da identidade, namespace, journal ou PID de `zero up`. Para
`essential`, valida banco, migration, seed, aplicação e health. Para `complete`,
valida também Redis, MinIO e Mailpit e os exemplos de cache, storage e e-mail.
Recursos temporários são removidos em sucesso, falha, sinal e timeout. Após
crash, `SIGKILL` ou queda do daemon, a recuperação é limitada ao `run-id` e às
labels conhecidos; volumes locais existentes não são selecionados nem removidos.

Migrations, seed e aplicação recebem exclusivamente ambiente efêmero injetado
pelo executor. Scripts Prisma não podem carregar `.env.local` por conta própria;
a precedência explícita é testada com arquivo local sentinela que aponta à
infraestrutura persistente.

### `zero recover <run-id>`

Aceita somente `run-id` hexadecimal emitido pelo Zero e localiza a intenção
privada correspondente. A intenção fica em diretório global privado do usuário
definido pelo Zero (permissão `0700`), em arquivo `<run-id>.json` `0600`, com
schema estrito de run-id, diretório canônico/hash do projeto, recursos esperados,
finalidade e etapa. Ela é escrita atomicamente antes de cada criação, não contém
segredos e é apagada só após cleanup completo. Arquivo truncado, symlink,
permissões inseguras, run-id desconhecido ou intenção de outro projeto/usuário
é recusado; intenções incompletas são retidas para recuperação manual.

`zero recover` lista recursos apenas quando possuem ambos os labels
`zero.managed=true` e `zero.run-id` igual; valida tipo e ownership, mostra o
conjunto seguro e exige confirmação explícita antes de removê-lo. Sem intenção
válida, label faltante ou recurso fora da allowlist, recusa agir. Não aceita
filtros, nomes ou IDs arbitrários e não roda automaticamente.

### `zero build`

Constrói a imagem de produção a partir de contexto efêmero criado por allowlist
de arquivos. `.env.local`, `.zero`, `.git`, `node_modules`, resultados de teste e
artefatos locais não entram no contexto, mesmo que o `.dockerignore` do projeto
seja alterado. A tag efêmera é somente referência; o digest retornado pelo daemon
é a identidade usada na execução. Depois inicia pilha isolada gerada
internamente, aplica migrations contra PostgreSQL temporário e consulta
`GET /api/health` até o limite de tempo. No perfil `complete`, a pilha inclui os
serviços habilitados e valida a forma pública do health check; exemplos
funcionais continuam cobertos por `--e2e`. O Dockerfile é código confiado ao
proprietário, como a aplicação; o Zero valida contexto filtrado, imagem produzida
e contrato de runtime, sem prometer tornar instruções maliciosas seguras.

Toda imagem, container, rede, volume e arquivo temporário criado pelo comando
recebe identificador exclusivo e é removido na finalização. O comando não usa
`zero down`, não toca no namespace persistente e não publica a imagem. Em falha,
mostra apenas etapa, causa sanitizada e ação de recuperação.

## Fronteiras de confiança e arquitetura de validação

O manifesto validado define profile e serviços esperados. Arquivos executáveis
do projeto atual são confiados como código do proprietário. Em contraste,
`compose.yaml`, nomes Docker, imagens de infraestrutura, mounts, rede, portas e
contexto de build não são fonte de controle: a Sprint 4 os gera ou valida no
Zero. A verificação de release do tarball é tarefa separada da CI.

Uma camada compartilhada no núcleo da CLI:

- primeiro implementa barreira Docker: limpa seleção herdada, resolve endpoint
  efetivo e aceita somente socket Unix local em allowlist, canônico e não-
  symlink; cada subprocesso recebe o endpoint validado;
- gera `run-id`, nomes e labels (`zero.managed=true`, `zero.run-id`, finalidade)
  fora do namespace persistente e registra intenção privada antes de criar
  recursos; aplica os labels a imagem, containers/serviços, rede e volumes;
- usa publicação `127.0.0.1:0`, descobre portas atribuídas por ID/label e nunca
  expõe `0.0.0.0` ou reserva/libera porta de forma otimista;
- mantém máquina de estados com `AbortController`, timeout, grace period, grupo
  de processos e promessa de cleanup compartilhada;
- drena stdout/stderr e aplica redaction incremental antes de persistir ou
  renderizar, inclusive quando o segredo cruza chunks; só então limita tamanho.

Os adaptadores de `test` e `build` declaram somente serviços permitidos pelo
manifesto. Não recebem nome de container, porta, imagem ou serviço do usuário.

A imagem final não contém Prisma nem devDependencies. O smoke test executa
migrations em container/estágio efêmero específico, com Prisma e ambiente da
pilha isolada, antes de iniciar a imagem final.

O host publica somente `127.0.0.1:0`. Dentro da rede privada do Compose, a
aplicação pode escutar a interface necessária ao tráfego entre containers; isso
não é exposição externa. O teste confirma por inspeção Docker que nenhuma porta
host usa `0.0.0.0` e faz a consulta pelo bind loopback descoberto.

## Template e CI

O template inclui scripts separados e estáveis para qualidade rápida, testes
unitários e e2e. Seu workflow materializado executa somente validações nativas
reproduzíveis em runner limpo (instalação, qualidade, testes e build Docker do
projeto), sem depender do binário `zero` não publicado. O workflow do repositório
Zero executa:

1. qualidade, typecheck e testes unitários;
2. build e verificação do pacote Zero;
3. matriz Docker que materializa `essential` e `complete`, executa `zero test
   --e2e` e `zero build` e preserva logs sanitizados apenas quando o job falhar.

A CI separa workflow do repositório Zero e workflow materializado no projeto;
ambos usam actions fixadas por SHA completo. Só o primeiro materializa perfis,
instala a CLI a partir do tarball do próprio checkout e executa `zero test --e2e`
e `zero build`. Ele tem job final
`release-gate`, dependente de qualidade, pacote e matriz Docker, e falha se
Docker for pulado, cancelado ou falhar. Uma exceção requer waiver versionado,
não expirado e protegido por `CODEOWNERS`/branch protection ou Environment
GitHub com aprovadores. A configuração externa é pré-requisito verificável; o
workflow não exige login, token cloud ou segredo permanente.

O `release-gate` usa `if: always()`: exige sucesso de qualidade e pacote em todo
cenário e aceita somente sucesso da matriz Docker ou waiver autorizado, válido e
restrito a Docker. Falha, cancelamento ou skip de qualidade/pacote nunca podem
ser dispensados por waiver.

## Segurança e falhas

- Nenhum comando imprime `.env.local`, `compose config`, argumentos contendo
  credenciais, URLs autenticadas ou logs sem redaction.
- Tags, labels, recursos temporários e arquivos de log não contêm segredo; a
  imagem é identificada pelo digest retornado e logs são limitados após
  redaction incremental.
- A falha de cleanup é reportada separadamente, com identificadores seguros e
  comando de recuperação limitado aos recursos temporários, sem mascarar a
  falha original.
- Operações destrutivas futuras permanecem indisponíveis nesta sprint. A base de
  confirmação explícita só será introduzida quando um comando destrutivo for
  especificado, evitando uma opção sem comportamento real.
- Timeouts, ausência de Docker, daemon remoto, health `503`, migration falha e
  interrupção retornam códigos distintos, recuperáveis e não indicam êxito
  parcial. `SIGKILL` e queda do daemon não são capturáveis e só deixam
  recuperação por labels/run-id.

## Testes e aceite

- Testes unitários cobrem parser, barreira Docker, seleção profile-aware, argv,
  redaction por chunks, timeout, máquina de estados, labels e cleanup idempotente.
- Testes de integração provam que a CLI não escreve além de artefatos próprios e
  que `--e2e`/`build` não usam namespace, portas ou volumes locais.
- Em Docker real, projeto recém-criado de cada perfil passa os três comandos;
  CI também materializa o tarball e valida a mesma matriz de release. Dois
  projetos ativos permanecem inalterados durante ambos os tipos de validação.
- O gate final só aceita ausência de Docker com waiver válido e autoridade
  externa configurada.
- Busca por valores conhecidos de `.env.local` nos envelopes JSON, stdout,
  stderr, logs e artefatos produzidos não encontra ocorrências.

Uma Sprint 4 é aceita quando todos os comandos acima passam em um projeto novo
dos dois perfis, com recursos efêmeros removidos e sem qualquer alteração no
ambiente local do usuário.
