# Zero — Design refinado da Fase 1

**Status:** validado para planejamento de implementação
**Data:** 26 de agosto de 2026
**Relação com a v1.2:** este documento prevalece sobre decisões conflitantes da especificação original.

## 1. Decisão de produto

O Zero será um **fundador guiado de projetos web**: uma CLI privada que conduz uma pessoa, inclusive não técnica que desenvolve com IA, de uma máquina preparada a uma aplicação web local, executável e versionada.

O produto não é somente um gerador de arquivos. O sucesso de `zero new` significa que o ambiente está em execução e pronto para receber desenvolvimento.

Na Fase 1, o Zero suporta um único arquétipo: aplicações web full-stack em Next.js. Aplicativos iOS/Android nativos não são suportados nesta fase. **Zero Mobile** é uma evolução possível, com arquitetura e especificação próprias; não há ordem de entrega definida para ele ou para outras evoluções após a Fase 1.

## 2. Público e limites

### Público

- Profissional de produto tecnicamente avançado que desenvolve com agentes de IA.
- Pessoa não técnica que quer começar um produto por vibe coding, com defaults seguros e mensagens compreensíveis.

### Limites explícitos

A Fase 1 não inclui:

- deploy ou provisionamento em nuvem;
- autenticação, pagamentos ou regras de negócio de um produto;
- aplicativos móveis nativos;
- chamadas a APIs de IA ou dependência de um fornecedor de IA;
- atualização automática de projetos já criados;
- sobrescrita de código do usuário;
- telemetria remota;
- instalação silenciosa de software ou alteração não confirmada do sistema.

Autenticação será considerada uma capacidade futura. O contrato do projeto reserva essa extensão, mas o template criado na Fase 1 não tem login, usuário fictício ou autorização implícita.

## 3. Distribuição, máquina e idioma

O Zero é um pacote privado Node/TypeScript, distribuído inicialmente por canal privado e instalado globalmente via npm:

```bash
npm install -g @brunogaliza/zero
zero --help
```

`npm link` é permitido somente como fluxo interno de desenvolvimento da CLI. Um binário autocontido fica fora da Fase 1.

O pacote precisa ser instalável também a partir de seu artefato (`npm pack`) nos testes de release; o registro privado é somente o canal de distribuição, não uma dependência do funcionamento da CLI. O runtime oficial é Node.js LTS 24 e npm compatível.

O suporte oficial inicial é macOS em Apple Silicon, com terminal `zsh` ou `bash`. Linux poderá ser testado posteriormente; Windows está fora do escopo.

Prompts, ajuda, diagnósticos e documentação gerada são em português do Brasil. Comandos, código, variáveis de ambiente e identificadores técnicos permanecem em inglês. O template assume `pt-BR` como locale inicial, sem prometer internacionalização completa.

## 4. Fluxo de sucesso

```text
zero setup → zero new → ambiente saudável → desenvolvimento humano ou com IA
```

### zero setup

É um assistente guiado de preparação da máquina. Verifica Node/npm compatíveis, Docker Desktop, Git, GitHub CLI e condições básicas de execução. Quando algo faltar, explica o motivo, aponta para a instalação oficial e revalida ao final.

Ele não instala ferramentas silenciosamente nem recebe privilégios de sistema. Node/npm e Docker são pré-requisitos para criar e executar qualquer projeto; Git só é obrigatório quando a inicialização Git estiver habilitada; GitHub CLI só é obrigatório para login ou criação de remoto. `zero doctor` oferece diagnóstico equivalente dentro de um projeto e recomenda ações concretas.

### zero new

O comando tem dois modos equivalentes:

```bash
zero new
zero new --config projeto.yaml --yes
```

O primeiro abre um assistente; o segundo cria de modo reproduzível, sem prompts. O arquivo de criação possui schema próprio, não aceita secrets e rejeita campos desconhecidos. Isso previne criação parcialmente diferente por typo ou por agentes de IA.

O contrato mínimo desse arquivo é:

```yaml
project:
  name: Minha Agenda
  slug: minha-agenda
  directory: ~/Projetos/minha-agenda
profile: essential
initialization:
  start: true
  git: true
  github:
    createPrivateRepository: false
```

Os defaults são `essential`, `start: true`, Git local habilitado quando disponível e criação de repositório GitHub desabilitada. No modo não interativo, `--yes` só autoriza as mutações declaradas explicitamente nesse arquivo. Para criar um remoto, `createPrivateRepository: true` e uma sessão válida do GitHub CLI são ambos obrigatórios; o nome remoto é o slug, salvo configuração explícita de proprietário e nome.

No assistente, a pessoa escolhe separadamente:

```text
Nome humano:          Minha Agenda
Slug técnico:         minha-agenda
Pasta de destino:     ~/Projetos/minha-agenda
```

O Zero sugere `~/Projetos/<slug>`, gera um slug editável e valida ambos antes da criação. A pasta pode ser outro caminho válido. Diretórios não vazios são recusados; não há retomada implícita.

No fluxo padrão, o comando somente informa que o projeto está pronto após:

1. validar máquina, entradas e destino;
2. gerar os arquivos e o manifesto;
3. instalar dependências;
4. gerar `.env.local` e secrets exclusivamente locais;
5. iniciar PostgreSQL e os serviços escolhidos;
6. aguardar health checks;
7. aplicar a migration inicial e rodar o seed;
8. iniciar a aplicação e verificar a página inicial e `GET /api/health`;
9. inicializar Git e criar o commit inicial, quando solicitado;
10. criar e enviar o repositório GitHub, quando solicitado e autorizado.

Para poder concluir as etapas e ainda deixar o ambiente acessível, `zero new` inicia a aplicação como processo gerenciado em segundo plano, registra um PID verificável no estado local e retorna ao terminal com as URLs e os próximos passos. `zero logs app` acompanha sua saída e `zero down` a encerra com segurança. Já `zero up` continua sendo interativo e mantém a aplicação em primeiro plano por padrão.

Uma opção explícita permite criar sem iniciar o ambiente. Nesse caso, a CLI informa que o projeto foi criado, mas ainda não foi validado em execução.

### Recuperação de criação

Uma criação interrompida preserva um journal local das etapas concluídas e mostra o erro, o que foi feito e a ação recomendada. A retomada é explícita:

```bash
zero new --resume /caminho/do/projeto
```

Ela executa apenas as etapas pendentes, não sobrescreve código e confirma que o estado pertence ao projeto solicitado.

O journal contém versão de schema, caminho canônico do destino, hash do manifesto e identificador da operação. A retomada falha em vez de tentar adivinhar se algum desses dados divergir.

## 5. Perfis de projeto

O arquétipo oficial é `next-fullstack`, com Next.js App Router, TypeScript, npm, PostgreSQL e Prisma.

| Perfil | Conteúdo |
|---|---|
| `essential` | Next.js, PostgreSQL, Prisma, painel de prontidão, Docker, testes, CI e documentação. |
| `complete` | Tudo de `essential` mais Redis, MinIO e Mailpit, com adaptadores, variáveis, links, documentação e testes. |

O padrão é `essential`; serviços opcionais nunca são habilitados por acidente. O perfil `complete` é um atalho intencional para uma fundação de vibe coding com todos os serviços locais disponíveis.

O projeto recém-criado exibe uma página inicial informativa e profissional, não um domínio artificial. Ela mostra nome e descrição do projeto, estado seguro da aplicação e banco, capacidades habilitadas e links locais úteis, como Mailpit e console MinIO quando configurados. Não revela secrets, detalhes internos ou erros sensíveis.

O exemplo funcional é opcional:

```bash
zero add example basic-crud
zero add example basic-crud --dry-run
```

Ele acrescenta um CRUD genérico com modelo Prisma, migration, seed, rotas/telas e testes. Antes de alterar, apresenta o impacto; conflitos interrompem a operação. Não há sobrescrita, e uma nova execução identifica instalação já existente.

## 6. Contrato de projeto e propriedade

Depois da criação, todos os arquivos são propriedade do usuário. O Zero lê contratos e opera o ambiente, mas não atualiza templates nem modifica fontes sem comando explícito solicitado pelo usuário.

Cada projeto contém:

- `zero.yaml`: contrato declarativo, portátil e versionado;
- `.env.example`: nomes, exemplos não sensíveis e comentários;
- `.env.local`: valores e secrets locais, ignorados pelo Git;
- `.zero/template.lock.json`: proveniência do template, rastreada;
- `.zero/*.local.*`: estado da máquina, ignorado pelo Git;
- `README.md`, `AGENTS.md` e `CLAUDE.md`: instruções para pessoas e agentes, sem duplicação excessiva.

`zero.yaml` é a fonte de verdade de configuração declarativa. Registra template, versão, runtime, serviços, portas preferenciais, health check e a capacidade `auth: none`. Não contém credentials. Campos inválidos bloqueiam comandos dependentes. Campos desconhecidos em manifesto existente emitem aviso para preservar evolução futura; alterações incompatíveis exigem uma nova versão de schema.

O contrato canônico inicial é:

```yaml
schemaVersion: 1
project:
  name: Minha Agenda
  slug: minha-agenda
  description: Uma agenda pessoal
template:
  id: next-fullstack
  version: 1.0.0
runtime:
  nodeMajor: 24
  packageManager: npm
database:
  engine: postgres
  majorVersion: 17
  orm: prisma
profile: essential
services:
  redis: false
  storage: false
  email: false
capabilities:
  auth: none
health:
  path: /api/health
```

O lock do template registra também a versão do schema e a versão da CLI que o criou. `zero doctor` avisa quando a CLI em uso não suporta o contrato encontrado, sem alterar o projeto.

Cada release de template contém `package-lock.json` e imagens Docker com tags imutáveis. A versão do template identifica essa combinação de dependências; uma versão nova não altera projetos já gerados.

Portas efetivas, PID validado da aplicação e dados transitórios ficam fora do Git. O manifesto mantém apenas preferências portáveis.

## 7. Arquitetura interna da CLI

O Zero será organizado por responsabilidades:

```text
packages/
  cli/              comandos, prompts, ajuda e apresentação
  core/             processos, Docker, portas, estado e diagnóstico
  manifest/         schema, leitura, validação e migração de zero.yaml
  template-engine/  composição e geração segura de templates
templates/
  next-fullstack/
schemas/
tests/
```

Processos externos recebem argumentos estruturados. Entradas como nomes, slugs, caminhos, serviços e migrations passam por validação antes de chamar npm, Docker, Git, Prisma ou GitHub CLI. Texto de usuário não é interpolado em shell.

Cada projeto obtém namespace Docker derivado do slug, com containers, rede e volumes próprios. Serviços ficam em `localhost` por padrão. O Zero primeiro tenta a porta preferencial, a reutiliza se pertencer ao mesmo projeto e, em caso de conflito, seleciona uma porta livre controlada e grava-a apenas no estado local.

## 8. Operação local

| Comando | Responsabilidade |
|---|---|
| `zero setup` | preparar e revalidar a máquina de forma guiada |
| `zero doctor` | diagnosticar ambiente, manifesto, serviços, banco, migrations e build |
| `zero new` | criar projeto guiado ou declarativo |
| `zero up` / `zero down` | iniciar e encerrar ambiente do projeto |
| `zero status` / `zero logs [service]` | inspecionar estado e logs mascarados |
| `zero db migration <name>` | criar migration local com nome validado |
| `zero db migrate` / `seed` / `reset` | operar o banco local com contratos claros |
| `zero test [--e2e]` / `zero build` | validar qualidade, ambiente e imagem de produção |
| `zero clean` | remover apenas artefatos reconstruíveis |
| `zero git init` | inicializar ou retomar o commit inicial de um projeto existente |
| `zero github login` | usar autenticação já gerenciada pelo GitHub CLI |
| `zero github create` | criar e conectar, mediante confirmação, um remoto privado existente |
| `zero add example basic-crud` | adicionar acelerador explicitamente solicitado |
| `zero context` | imprimir contexto seguro em Markdown para pessoas ou agentes |

Ajuda é parte do produto:

```bash
zero --help
zero <comando> --help
zero help <comando>
```

Ela inclui sintaxe, exemplos, pré-requisitos e impacto. Erros de uso apontam para a ajuda relevante.

`zero up` inicia infraestrutura, aplica apenas migrations já versionadas e mantém a aplicação em primeiro plano. `Ctrl+C` para somente a aplicação e preserva volumes. `zero down` para containers e, quando o PID registrado é comprovadamente do projeto, encerra a aplicação correspondente com segurança.

`zero db migration <name>` simplifica a criação explícita de alterações de schema. O Zero nunca cria migrations silenciosamente. `zero db reset` é estritamente local, informa o alvo e exige confirmação; `--yes` é reservado para automação declarada.

`zero context` é estritamente de leitura e nunca inclui `.env.local`, valores de variáveis, tokens, secrets, PID, caminhos pessoais ou logs. Ele pode incluir o manifesto já sanitizado, o estado de saúde, os serviços habilitados e os comandos de validação.

## 9. Saúde, dados e serviços

PostgreSQL 17 é obrigatório, tem volume exclusivo, health check `pg_isready`, conexão por `DATABASE_URL`, migration inicial e seed repetível com dados fictícios. A aplicação usa Prisma Client com singleton de desenvolvimento.

`GET /api/health` é o contrato central de disponibilidade:

- retorna `200` se aplicação e banco estão saudáveis;
- retorna `503` quando qualquer dependência essencial falha;
- informa serviços opcionais como `ok`, `disabled` ou `degraded`;
- a falha de Redis, MinIO ou Mailpit não altera o status HTTP essencial;
- não expõe versões internas, credentials ou erros sensíveis.

`zero status` e `zero doctor` tratam serviço opcional habilitado e indisponível como problema acionável. Redis, MinIO e Mailpit têm health checks próprios. Acesso a armazenamento e e-mail fica atrás de interfaces da aplicação, evitando dependência espalhada de MinIO e preparando uma substituição futura por serviços de nuvem.

## 10. Segurança e Git

Secrets são criados com aleatoriedade criptográfica quando necessário, ficam apenas em `.env.local`, não entram em documentação e são mascarados nos logs. Variáveis públicas e exclusivas de servidor são separadas e validadas na inicialização.

Quando Git for solicitado, o Zero valida o `.gitignore`, inicializa o repositório e cria automaticamente um commit inicial:

```text
chore: initialize with Zero
```

Integração com GitHub é opcional. `zero github login` verifica a sessão do GitHub CLI e pode abrir o fluxo oficial de autenticação no navegador. O Zero não pede, lê ou armazena tokens. Ao criar um projeto, a pessoa pode confirmar a criação de repositório privado, configuração de remoto e push do commit inicial. Sem GitHub CLI ou login, a criação local continua funcional e o diagnóstico explica o próximo passo.

`zero github create` oferece a mesma operação para um projeto já existente. Ele recusa diretório que já tenha remoto configurado ou alterações não commitadas, mostra proprietário, nome e visibilidade do remoto e pede confirmação antes da criação e do push. Em automação, criação e push exigem flags explícitas além de uma sessão GitHub CLI já autenticada.

O repositório remoto criado pelo Zero recebe CI ativa em push e pull request, sem deploy e sem secrets permanentes. O usuário é informado de que execuções usam a cota do plano GitHub da sua conta.

## 11. Qualidade e validação

O template inclui lint, verificação de tipos, Vitest, React Testing Library e Playwright. `zero test` executa a suíte rápida; `zero test --e2e` valida o ambiente Docker real e a CI executa ambos. O perfil `complete` acrescenta cenários para as capacidades que habilita.

`zero build` constrói a imagem Docker de produção e executa smoke test do health check. A imagem não é publicada externamente na Fase 1.

Como o health check depende de PostgreSQL, o smoke test sobe uma pilha temporária e isolada: imagem recém-construída, PostgreSQL vazio, migration aplicada e rede Docker exclusiva. Essa pilha é removida mesmo após falha, preservando o ambiente de desenvolvimento do projeto.

Os testes end-to-end do próprio Zero criam e operam projetos temporários reais. Os principais critérios de aceite são:

- `zero setup` e `zero doctor` diagnosticam e orientam pré-requisitos ausentes;
- `zero new` deixa um projeto `essential` realmente acessível, com banco, migration, seed e health check saudáveis;
- o perfil `complete` deixa os três serviços adicionais saudáveis;
- criação interativa e declarativa resultam em contratos equivalentes;
- `zero new --resume` recupera falhas sem apagar código;
- dois projetos funcionam simultaneamente sem colisão;
- Git e GitHub opcionais não incluem secrets e a CI passa;
- o pacote produzido por `npm pack` instala e expõe `zero --version` e `zero --help` em uma pasta temporária;
- o modo não interativo não cria Git, remoto ou processos sem a opção declarativa correspondente;
- `zero add example basic-crud --dry-run` prevê alterações, e a execução cria um exemplo validado;
- `zero test`, `zero test --e2e` e `zero build` passam em um projeto recém-criado;
- um usuário inicia desenvolvimento apenas com `zero setup`, `zero new`, a página de prontidão e `zero context`.

Meta operacional: em máquina já preparada, criar e executar um projeto saudável em até dez minutos, sem editar manualmente arquivos de infraestrutura.

## 12. Entrega da Fase 1

1. **Fundação:** CLI, manifesto, schemas, `setup`, template essencial e criação guiada/declarativa.
2. **Ciclo local:** Docker, PostgreSQL, Prisma, portas, estado, `up`, `down`, `status`, logs e retomada.
3. **Capacidades e contexto:** perfil completo, painel de prontidão, `context` e exemplo CRUD opcional.
4. **Confiabilidade:** segurança, Git/GitHub/CI, build, diagnóstico e testes end-to-end.
5. **Validação real:** experiência de erro, documentação, instalação e piloto do ERP imobiliário.

O piloto valida a infraestrutura e a experiência do Zero; o domínio do ERP permanece fora do escopo da CLI.

A CI da CLI inclui pelo menos fixtures dos perfis `essential` e `complete`, além de testes isolados dos adaptadores GitHub para não exigir uma conta real em cada execução.

## 13. Evolução posterior sem ordem fixada

Após a Fase 1, a priorização será decidida com base no piloto. Possíveis linhas de evolução incluem melhorias no Zero Web, autenticação opcional, implantação em nuvem do mesmo contrato web e Zero Mobile. O esboço existente de Google Cloud é referência de compatibilidade, não compromisso de execução imediata.
