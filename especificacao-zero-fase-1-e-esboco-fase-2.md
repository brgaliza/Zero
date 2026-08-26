# Zero — Especificação da Fase 1 e esboço da Fase 2

> **Atualização de 26 de agosto de 2026:** para decisões vigentes, critérios de aceite e desenho da Fase 1, use [o design refinado](docs/superpowers/specs/2026-08-26-zero-fase-1-design.md). Este documento permanece como contexto histórico e esboço da compatibilidade futura com nuvem; em qualquer conflito sobre a Fase 1, o design refinado prevalece.

**Status:** contexto histórico; Fase 1 refinada em documento complementar
**Versão:** 1.2
**Data:** 26 de agosto de 2026
**Nome definitivo do produto:** Zero
**Responsável pelo produto:** Bruno Galiza

---

## 1. Resumo executivo

O Zero será uma ferramenta local de linha de comando que padroniza a Sprint Zero de novos projetos. Por meio de um assistente interativo no terminal, o usuário informa as características básicas da aplicação e recebe um projeto funcional, documentado, testável e preparado para execução local.

Na Fase 1, o Zero não criará infraestrutura em nuvem e não gerará custos recorrentes. Ele criará aplicações Next.js full-stack com PostgreSQL e Prisma, oferecendo Redis, armazenamento de arquivos e captura local de e-mails como componentes opcionais. A aplicação executará diretamente no computador para favorecer o desenvolvimento rápido; a infraestrutura auxiliar será executada em containers Docker.

Todo projeto será gerado com o contrato necessário para posterior implantação: Dockerfile de produção, variáveis de ambiente validadas, migrations, seed, health check, testes e manifesto declarativo. Na Fase 2, esse contrato será usado para implantar a aplicação no Google Cloud, inicialmente com Cloud Run, Cloud SQL, Artifact Registry, Cloud Storage e Secret Manager, provisionados por OpenTofu.

---

## 2. Problema

Cada novo projeto exige uma Sprint Zero repetitiva e sujeita a inconsistências:

- criação e configuração do framework;
- escolha e instalação de dependências;
- configuração do banco de dados;
- criação de containers;
- definição de variáveis de ambiente;
- criação de migrations e dados iniciais;
- configuração de testes, health checks e documentação;
- resolução de portas e serviços locais;
- preparação para uma futura implantação em nuvem.

Esse trabalho consome tempo, depende de memória e de prompts diferentes e faz com que projetos semelhantes nasçam com estruturas incompatíveis. Também existe o risco de otimizar prematuramente cada beta para AWS ou Google Cloud e começar a pagar por recursos antes de existir necessidade real.

---

## 3. Visão do produto

Permitir que um novo projeto passe de uma ideia inicial para um ambiente local funcional e padronizado por meio de uma única experiência guiada.

Comando de entrada:

```bash
zero new
```

Resultado esperado:

```text
✓ Projeto criado
✓ Dependências instaladas
✓ PostgreSQL iniciado
✓ Migrations aplicadas
✓ Dados de desenvolvimento carregados
✓ Aplicação disponível

Aplicação: http://localhost:3000
Banco:     localhost:5432
E-mail:    http://localhost:8025
```

---

## 4. Objetivos

### 4.1. Objetivos da Fase 1

1. Reduzir a Sprint Zero a uma seleção guiada e comandos padronizados.
2. Criar projetos locais reproduzíveis e independentes entre si.
3. Permitir que vários projetos sejam executados simultaneamente sem conflitos evitáveis.
4. Padronizar banco, migrations, seed, variáveis, logs, testes e health checks.
5. Gerar documentação adequada tanto para pessoas quanto para assistentes de IA.
6. Preparar a aplicação para ser empacotada em uma imagem Docker de produção.
7. Manter o desenvolvimento diário sem custo de nuvem.
8. Criar uma base técnica compatível com a futura implantação no Google Cloud.

### 4.2. Objetivos da Fase 2

1. Publicar a mesma aplicação em um ambiente Google Cloud.
2. Provisionar infraestrutura de forma reproduzível com OpenTofu.
3. Oferecer ambientes `dev` e `prod` com isolamento e controles proporcionais ao estágio.
4. Automatizar build, migrations e deploy por GitHub Actions.
5. Controlar custos por limites de escala, labels e alertas de orçamento.

### 4.3. Não objetivos

O Zero não será, nas duas primeiras fases:

- uma plataforma comercial para terceiros;
- uma interface web de administração;
- um substituto do Docker, GitHub ou Google Cloud;
- uma abstração que torne todos os provedores de nuvem idênticos;
- um orquestrador Kubernetes;
- um gerador irrestrito de qualquer linguagem ou framework;
- uma ferramenta de desenvolvimento de funcionalidades do produto;
- um gerenciador completo do ciclo de vida de secrets;
- um sistema de atualização automática de projetos já modificados;
- uma plataforma AWS.

---

## 5. Princípios de produto e arquitetura

### 5.1. Um caminho oficial antes de muitas opções

A Fase 1 terá um único arquétipo oficialmente suportado:

- aplicação web full-stack;
- Next.js com App Router;
- TypeScript;
- PostgreSQL;
- Prisma;
- npm como gerenciador de pacotes.

Redis, armazenamento de arquivos e e-mail local serão capacidades opcionais. Novos frameworks só serão considerados após o caminho principal estar estável.

### 5.2. Local e nuvem compartilham contratos, não topologia

O ambiente local e o Google Cloud não tentarão usar exatamente a mesma infraestrutura. Eles compartilharão:

- imagem Docker da aplicação;
- arquitetura compatível com Linux `amd64` e `arm64`, quando aplicável;
- versão principal do PostgreSQL;
- migrations e seed;
- nomes e validação das variáveis de ambiente;
- endpoint de health check;
- comportamento de inicialização e encerramento;
- testes de contrato;
- interfaces de acesso a banco, arquivos, e-mail e cache.

### 5.3. Desenvolvimento rápido por padrão

No modo padrão:

- Next.js executa diretamente no computador, com hot reload;
- PostgreSQL e serviços auxiliares executam via Docker Compose;
- a imagem de produção é validada separadamente pelo comando `zero build`.

Essa abordagem preserva a velocidade no Mac e ainda testa a portabilidade antes do deploy.

### 5.4. Cada aplicação é independente

O Zero será um repositório próprio. Cada aplicação criada será outro diretório e outro repositório Git. Não será criado um monorepo contendo todos os projetos pessoais.

O repositório local do Zero será criado em:

```text
~/Projetos/Zero
```

O diretório-base será acessado com `cd ~/Projetos`. O código do Zero e o código das aplicações geradas permanecerão em pastas e repositórios independentes.

### 5.5. Convenção antes de configuração

As escolhas seguras e recorrentes terão defaults. O assistente perguntará apenas o que altera materialmente o projeto.

### 5.6. Segurança e custo desde o início

Nenhum secret será gravado no Git. Operações destrutivas exigirão confirmação. Recursos de nuvem não serão criados na Fase 1.

---

## 6. Usuário principal

O usuário principal é um profissional de produto com conhecimento técnico avançado, que desenvolve aplicações com apoio de IA, mas não deseja montar manualmente a infraestrutura de cada novo projeto.

Ele precisa:

- entender o que foi gerado;
- executar comandos curtos;
- diagnosticar erros sem conhecer profundamente Docker;
- trabalhar com Claude Code, Codex ou outros assistentes;
- manter projetos separados;
- validar ideias e betas com baixo custo;
- evoluir um projeto selecionado para o Google Cloud posteriormente.

---

## 7. Escopo funcional da Fase 1

### 7.1. Assistente de criação

O comando `zero new` abrirá um assistente interativo no terminal.

Campos obrigatórios:

| Campo | Comportamento |
|---|---|
| Nome do projeto | Nome humano, por exemplo `Reveal` |
| Slug | Gerado automaticamente, editável, por exemplo `reveal` |
| Descrição | Uma frase sobre o objetivo do projeto |
| Diretório | Pasta onde o projeto será criado |
| Porta preferencial | Default `3000`; pode ser ajustada automaticamente |

Escolhas de stack:

| Item | Fase 1 |
|---|---|
| Arquétipo | `next-fullstack`, único disponível |
| Framework | Next.js App Router |
| Linguagem | TypeScript |
| Banco | PostgreSQL, obrigatório |
| ORM | Prisma, obrigatório |
| Cache | Redis opcional |
| Arquivos | MinIO opcional |
| E-mail local | Mailpit opcional |
| Autenticação | Fora do núcleo da Fase 1 |

Confirmações finais:

- inicializar repositório Git;
- instalar dependências;
- iniciar o ambiente ao terminar;
- aplicar migrations e executar seed.

O assistente exibirá um resumo antes de criar arquivos.

### 7.2. Geração do projeto

Estrutura mínima gerada:

```text
meu-projeto/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .zero/
│   └── template.lock.json
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   └── api/
│   │       └── health/
│   │           └── route.ts
│   └── lib/
│       ├── db.ts
│       └── env.ts
├── tests/
│   └── smoke/
├── .dockerignore
├── .env.example
├── .gitignore
├── AGENTS.md
├── CLAUDE.md
├── Dockerfile
├── README.md
├── compose.yaml
├── package.json
├── tsconfig.json
└── zero.yaml
```

Quando selecionados, Redis, MinIO e Mailpit serão adicionados ao `compose.yaml` por profiles e terão variáveis e documentação correspondentes.

### 7.3. Manifesto do projeto

O arquivo `zero.yaml` será a fonte de verdade declarativa do projeto.

```yaml
schemaVersion: 1

project:
  name: Reveal
  slug: reveal
  description: Aplicação de análise financeira pessoal

template:
  id: next-fullstack
  version: 1.0.0

runtime:
  node: 24
  packageManager: npm
  applicationPort: 3000

database:
  engine: postgres
  majorVersion: 17
  orm: prisma

services:
  redis: false
  storage: true
  email: true

health:
  path: /api/health

environments:
  local:
    provider: docker-compose
  dev:
    provider: none
  production:
    provider: none
```

Regras:

- o arquivo não contém credenciais;
- o schema é versionado;
- campos desconhecidos geram aviso;
- campos inválidos impedem comandos que dependem deles;
- mudanças incompatíveis exigem nova versão de schema.

### 7.4. Comandos

#### `zero new`

Cria um novo projeto a partir do assistente ou de parâmetros informados no comando.

#### `zero up`

1. Localiza `zero.yaml` no diretório atual ou em um diretório pai.
2. Executa verificações mínimas.
3. Resolve portas locais disponíveis.
4. Inicia PostgreSQL e serviços opcionais.
5. Aguarda os health checks.
6. Gera secrets exclusivamente locais quando estiverem ausentes.
7. Aplica migrations pendentes quando configurado.
8. Inicia a aplicação em modo de desenvolvimento.
9. Exibe URLs e serviços ativos.

O processo da aplicação permanece em primeiro plano. `Ctrl+C` encerra a aplicação, mas não remove dados persistidos. A infraestrutura pode ser encerrada com `zero down`.

#### `zero down`

Encerra aplicação e containers do projeto sem excluir volumes.

#### `zero status`

Exibe:

- serviços configurados;
- estado de cada serviço;
- porta e URL;
- health check;
- migrations pendentes;
- localização do projeto.

#### `zero logs [serviço]`

Exibe logs da aplicação ou de um serviço. Secrets conhecidos devem ser mascarados.

#### `zero doctor`

Verifica:

- sistema operacional e arquitetura;
- Docker instalado e em execução;
- Node compatível;
- npm compatível;
- Git disponível;
- portas;
- validade de `zero.yaml`;
- existência e validade das variáveis obrigatórias;
- estado dos containers;
- conexão com PostgreSQL;
- migrations pendentes ou divergentes;
- espaço básico disponível em disco;
- resposta do health check;
- capacidade de construir a imagem de produção.

Cada problema terá status, explicação curta e ação recomendada.

#### `zero db migrate`

Aplica migrations existentes. Em desenvolvimento, a criação de nova migration continuará usando o comando explícito do Prisma documentado no projeto.

#### `zero db seed`

Executa o seed de desenvolvimento de forma repetível.

#### `zero db reset`

Apaga e recria exclusivamente o banco local do projeto. Deve:

- recusar execução fora do ambiente local;
- informar claramente que os dados serão apagados;
- exigir confirmação interativa;
- oferecer `--yes` somente para automação explícita;
- nunca apagar volumes de outros projetos.

#### `zero test`

Executa lint, verificação de tipos e testes automatizados do projeto.

#### `zero build`

Cria a imagem Docker de produção e executa um smoke test do health check. Nenhuma imagem será publicada externamente na Fase 1.

#### `zero clean`

Remove apenas artefatos reconstruíveis do projeto, como containers parados e cache próprio. Volumes e bancos não serão removidos sem opção destrutiva e confirmação específica.

### 7.5. Resolução de portas e isolamento

Cada projeto terá um nome de projeto Docker derivado do slug. O Zero nunca usará um nome global fixo para containers ou volumes.

Comportamento:

1. Tentar a porta preferencial registrada no manifesto.
2. Se ocupada pelo mesmo projeto, reutilizá-la.
3. Se ocupada por outro processo, localizar uma porta livre dentro de uma faixa controlada.
4. Registrar a escolha em estado local ignorado pelo Git.
5. Propagar as portas resolvidas para a aplicação e exibi-las no terminal.

O manifesto continuará expressando preferências portáveis; as portas específicas da máquina não serão commitadas.

### 7.6. Variáveis e secrets

Arquivos:

- `.env.example`: nomes, exemplos não sensíveis e comentários;
- `.env.local`: valores da máquina, sempre ignorado pelo Git;
- `src/lib/env.ts`: validação tipada das variáveis na inicialização.

Regras:

- falhar cedo quando variável obrigatória estiver ausente;
- gerar secrets locais criptograficamente seguros quando possível;
- nunca copiar valores locais para documentação;
- nunca imprimir secrets integralmente em logs;
- manter nomes compatíveis com o futuro Secret Manager;
- separar variáveis públicas das exclusivas de servidor.

### 7.7. Banco de dados

O PostgreSQL será obrigatório no template principal.

Requisitos:

- versão principal fixada no manifesto e na imagem Docker;
- volume nomeado exclusivo por projeto;
- health check com `pg_isready`;
- conexão via `DATABASE_URL`;
- Prisma Client singleton para desenvolvimento;
- schema inicial válido;
- primeira migration versionada;
- seed idempotente ou seguro para repetição;
- dados iniciais exclusivamente fictícios;
- suporte a backup local manual fora do escopo inicial.

### 7.8. Serviços opcionais

#### Redis

Usado para cache e casos futuros de fila. Deve ter health check e volume somente se a persistência for necessária.

#### MinIO

Simula armazenamento de objetos localmente. O template deve acessar arquivos por uma interface própria da aplicação, evitando espalhar chamadas específicas do MinIO. Na Fase 2, uma implementação dessa interface usará Google Cloud Storage.

#### Mailpit

Captura e-mails localmente e oferece interface web. Nenhum e-mail real será enviado no ambiente local por padrão.

### 7.9. Health checks

O endpoint padrão será `GET /api/health`.

Resposta saudável:

```json
{
  "status": "ok",
  "checks": {
    "application": "ok",
    "database": "ok"
  }
}
```

Regras:

- retornar `200` somente quando os componentes essenciais estiverem disponíveis;
- retornar `503` quando o banco obrigatório estiver indisponível;
- não expor versões internas, credenciais ou detalhes de erro sensíveis;
- concluir dentro de um timeout curto;
- ser reutilizado pelo Docker, testes e futuro Cloud Run.

### 7.10. Documentação para pessoas e IAs

O projeto gerado conterá:

- `README.md`: instalação, comandos, URLs e solução de problemas;
- `AGENTS.md`: arquitetura, limites, convenções e comandos de validação para agentes;
- `CLAUDE.md`: contexto operacional compatível com Claude Code;
- comentários em `.env.example`;
- explicação do `zero.yaml`;
- definição clara do que pode ser alterado e do que é infraestrutura gerada.

Os arquivos não devem duplicar grandes blocos de conteúdo. `AGENTS.md` será a referência mais completa e `CLAUDE.md` poderá apontar para ela quando apropriado.

### 7.11. Integração contínua

A Fase 1 incluirá um workflow de CI sem deploy:

1. checkout;
2. instalação da versão suportada do Node;
3. instalação reproduzível com `npm ci`;
4. PostgreSQL como service container;
5. migrations;
6. lint;
7. verificação de tipos;
8. testes;
9. build da aplicação;
10. build da imagem Docker.

Nenhuma credencial permanente de nuvem será necessária.

---

## 8. Arquitetura do Zero

### 8.1. Componentes

```text
zero-platform/
├── packages/
│   ├── cli/
│   ├── core/
│   ├── manifest/
│   └── template-engine/
├── templates/
│   └── next-fullstack/
├── schemas/
│   └── zero.schema.json
├── tests/
│   ├── fixtures/
│   ├── integration/
│   └── end-to-end/
├── docs/
└── package.json
```

Responsabilidades:

| Componente | Responsabilidade |
|---|---|
| CLI | comandos, prompts e apresentação de resultados |
| Core | orquestração, processos, portas, Docker e diagnóstico |
| Manifest | leitura, validação e evolução do `zero.yaml` |
| Template engine | cópia, interpolação e composição de serviços opcionais |
| Templates | código-base dos projetos gerados |
| Schemas | contratos versionados |
| Testes E2E | geração e execução de projetos reais temporários |

### 8.2. Stack de implementação da CLI

- Node.js LTS;
- TypeScript;
- npm workspaces;
- biblioteca de comandos como Commander;
- prompts interativos como Clack;
- Zod para validação;
- executor de processos com argumentos estruturados;
- Vitest para testes;
- formatação e lint padronizados.

A seleção final de bibliotecas será confirmada na implementação, mantendo dependências pequenas e ativamente mantidas.

### 8.3. Regra de execução de comandos externos

A CLI deve executar binários usando argumentos estruturados, sem concatenar entradas do usuário em comandos de shell. Slugs, caminhos, nomes de serviços e parâmetros serão validados antes da execução.

### 8.4. Tratamento de falhas

Toda falha deve informar:

- qual etapa falhou;
- mensagem compreensível;
- comando ou ação recomendada;
- caminho do log detalhado, quando existente;
- o que já foi criado;
- se é seguro tentar novamente.

`zero new` deverá trabalhar por etapas idempotentes. Uma falha na instalação de dependências não deve exigir a exclusão manual do projeto para nova tentativa.

### 8.5. Telemetria

A Fase 1 não coletará telemetria remota. Logs operacionais serão locais e não conterão secrets.

---

## 9. Requisitos não funcionais

### 9.1. Sistemas suportados

Suporte oficial inicial:

- macOS em Apple Silicon;
- runtime Docker compatível com Docker Compose;
- terminal `zsh` ou `bash`;
- Git instalado.

Linux poderá funcionar, mas só será declarado suportado após testes. Windows fica fora da Fase 1.

### 9.2. Reprodutibilidade

- versões principais registradas;
- arquivo de lock de dependências obrigatório;
- imagens Docker sem tag `latest`;
- CI deve reproduzir o build;
- seed e migrations versionados;
- manifesto e schema versionados.

### 9.3. Desempenho

Com dependências e imagens já disponíveis:

- `zero doctor`: até 15 segundos em condições normais;
- infraestrutura local saudável: até 90 segundos;
- status: até 5 segundos;
- encerramento gracioso: até 30 segundos antes de forçar parada.

Downloads e instalação inicial não entram nesses limites.

### 9.4. Idempotência

- executar `zero up` duas vezes não cria recursos duplicados;
- executar `zero down` com o ambiente parado não é erro fatal;
- executar seed repetidamente não cria duplicidade indevida;
- uma geração interrompida pode ser retomada ou explicada claramente.

### 9.5. Segurança

- nenhum secret no Git;
- nenhuma entrada do usuário interpolada diretamente no shell;
- imagens oficiais ou aprovadas e versões fixadas;
- serviços locais acessíveis apenas por `localhost`, salvo configuração explícita;
- banco local sem exposição à rede externa;
- mascaramento de secrets em logs;
- confirmação para destruição de dados;
- CI sem credenciais de nuvem na Fase 1.

---

## 10. Critérios de aceite da Fase 1

A Fase 1 estará concluída quando todos os critérios abaixo forem atendidos.

### 10.1. Criação

- [ ] `zero new` cria um projeto em diretório escolhido pelo usuário.
- [ ] O assistente valida nome, slug, diretório e portas.
- [ ] O projeto gerado instala dependências e compila.
- [ ] Git pode ser inicializado sem incluir secrets.
- [ ] O manifesto corresponde às escolhas realizadas.

### 10.2. Execução

- [ ] `zero up` inicia PostgreSQL e a aplicação.
- [ ] O navegador acessa a página inicial.
- [ ] `/api/health` retorna `200` com banco saudável.
- [ ] `zero down` encerra serviços sem apagar dados.
- [ ] Reiniciar o ambiente preserva o banco.

### 10.3. Serviços opcionais

- [ ] Redis é iniciado somente quando selecionado.
- [ ] MinIO é iniciado somente quando selecionado e aceita upload de teste.
- [ ] Mailpit é iniciado somente quando selecionado e captura um e-mail de teste.
- [ ] Serviços não selecionados não geram containers ou variáveis obrigatórias.

### 10.4. Diagnóstico

- [ ] `zero doctor` identifica Docker parado.
- [ ] Identifica porta ocupada.
- [ ] Identifica variável obrigatória ausente.
- [ ] Identifica banco indisponível.
- [ ] Identifica migration pendente.
- [ ] Recomenda uma ação concreta para cada problema conhecido.

### 10.5. Isolamento

- [ ] Dois projetos podem executar simultaneamente.
- [ ] Containers, redes e volumes não colidem.
- [ ] `zero db reset` afeta somente o projeto atual.
- [ ] O projeto não depende de caminhos absolutos da máquina que o gerou.

### 10.6. Qualidade e portabilidade

- [ ] `zero test` conclui com sucesso em projeto recém-criado.
- [ ] `zero build` produz imagem de produção.
- [ ] A imagem responde ao health check.
- [ ] O workflow de CI passa em um repositório recém-criado.
- [ ] README, `AGENTS.md` e `CLAUDE.md` refletem a configuração escolhida.

### 10.7. Segurança

- [ ] Busca automatizada não encontra secrets conhecidos nos arquivos rastreados.
- [ ] Serviços locais não escutam em interfaces externas por padrão.
- [ ] Operações destrutivas exigem confirmação.
- [ ] Entradas malformadas de nome, slug e caminho são rejeitadas.

---

## 11. Plano de entrega da Fase 1

### Sprint 1 — Fundação da CLI

- repositório e workspaces;
- comando `zero`;
- manifesto e schema;
- assistente `zero new`;
- template mínimo Next.js;
- testes unitários do manifesto e prompts.

### Sprint 2 — Ambiente local principal

- Docker Compose;
- PostgreSQL;
- Prisma, migration e seed;
- `zero up`, `down`, `status` e `logs`;
- health check;
- resolução de portas.

### Sprint 3 — Capacidades opcionais

- profiles;
- Redis;
- MinIO;
- Mailpit;
- adaptação das variáveis e documentação.

### Sprint 4 — Qualidade e segurança

- `zero doctor`;
- `zero test`;
- `zero build` com smoke test;
- CI;
- proteção de operações destrutivas;
- mascaramento de secrets;
- testes end-to-end com projetos temporários.

### Sprint 5 — Experiência e validação real

- mensagens e recuperação de erros;
- instalação local simplificada da CLI;
- documentação final;
- criação do projeto piloto: ERP para pequenas e médias imobiliárias;
- execução de uma Sprint Zero real somente pelo Zero;
- correções encontradas no piloto.

O piloto validará a capacidade do Zero de criar e operar o ambiente técnico. O escopo funcional do ERP será especificado separadamente e não fará parte do escopo de desenvolvimento da CLI.

---

## 12. Esboço da Fase 2 — Google Cloud

### 12.1. Objetivo

Permitir que um projeto criado pelo Zero seja implantado no Google Cloud sem redesenhar a aplicação e sem administrar servidores.

### 12.2. Arquitetura preliminar

| Capacidade | Serviço proposto |
|---|---|
| Aplicação | Cloud Run |
| Imagens | Artifact Registry |
| PostgreSQL | Cloud SQL for PostgreSQL |
| Arquivos | Cloud Storage |
| Secrets | Secret Manager |
| Logs e métricas | Cloud Logging e Cloud Monitoring |
| Infraestrutura como código | OpenTofu |
| CI/CD | GitHub Actions com identidade federada |
| DNS e HTTPS | Cloud Run domain mapping ou Load Balancer, conforme necessidade |

Redis não será criado automaticamente na primeira entrega da Fase 2. Caso um projeto realmente dependa dele, será avaliado Memorystore ou adaptação arquitetural conforme custo e necessidade.

### 12.3. Estratégia de custo e isolamento

Estratégia preliminar recomendada:

- um projeto Google Cloud compartilhado para laboratório e betas de baixo risco;
- um serviço Cloud Run e uma service account por aplicação;
- Artifact Registry compartilhado no laboratório;
- uma instância Cloud SQL de desenvolvimento compartilhada entre aplicações, com banco e usuário separados por projeto, quando isso for aceitável;
- buckets separados ou prefixes e permissões isoladas por aplicação;
- labels obrigatórias: `app`, `environment`, `owner` e `managed-by`;
- Cloud Run com mínimo de zero instâncias no ambiente de desenvolvimento;
- número máximo de instâncias limitado;
- alertas de orçamento no projeto de laboratório;
- produção relevante em projeto Google Cloud dedicado;
- banco de produção nunca compartilhado entre aplicações.

Essa política reduz custo no estágio de beta, mas aceita maior raio de impacto no laboratório. Projetos com dados sensíveis, requisitos regulatórios ou usuários externos relevantes deverão usar projeto e banco dedicados desde o início.

### 12.4. Comandos previstos

```bash
zero cloud configure
zero infra plan dev
zero infra apply dev
zero deploy dev
zero status dev
zero logs dev
zero deploy prod
zero infra destroy dev
```

Regras:

- `plan` sempre precede criação ou alteração manualmente iniciada;
- `prod` exige confirmação e proteções adicionais;
- `destroy prod` não estará disponível como comando comum;
- migrations destrutivas não serão executadas automaticamente;
- o usuário sempre verá projeto, região e ambiente de destino.

### 12.5. Mudanças previstas no manifesto

```yaml
environments:
  local:
    provider: docker-compose

  dev:
    provider: gcp
    projectId: zero-lab-dev
    region: southamerica-east1
    scaling:
      minInstances: 0
      maxInstances: 2

  production:
    provider: gcp
    projectId: reveal-prod
    region: southamerica-east1
    scaling:
      minInstances: 0
      maxInstances: 5
```

Valores sensíveis e identificadores gerados pela infraestrutura não serão armazenados diretamente no manifesto quando isso representar risco. Outputs técnicos serão mantidos no estado da infraestrutura ou em arquivos locais ignorados pelo Git.

### 12.6. Estrutura de infraestrutura prevista

```text
infrastructure/
├── modules/
│   └── gcp/
│       ├── cloud-run-service/
│       ├── cloud-sql-postgres/
│       ├── cloud-storage/
│       ├── service-account/
│       ├── secret-manager/
│       └── observability/
└── environments/
    ├── dev/
    └── prod/
```

Os módulos serão versionados. Cada projeto terá uma composição pequena que referencia versões conhecidas, evitando cópia integral de infraestrutura sem controle de origem.

### 12.7. Pipeline preliminar de deploy

1. Pull request executa lint, tipos, testes, migrations de validação e build.
2. Merge em `main` cria imagem imutável identificada pelo commit.
3. Imagem é publicada no Artifact Registry.
4. Identidade federada autentica o GitHub sem chave estática de service account.
5. Pipeline aplica mudanças autorizadas de infraestrutura.
6. Migration compatível é aplicada por job controlado.
7. Nova revisão é publicada no Cloud Run.
8. Health check e smoke tests são executados.
9. Falha impede promoção e mantém a revisão anterior disponível.
10. Produção exige gate humano inicialmente.

### 12.8. Critérios de aceite preliminares da Fase 2

- [ ] Projeto da Fase 1 é implantado sem alterações manuais em seu código-base.
- [ ] Infraestrutura é criada a partir de OpenTofu versionado.
- [ ] Nenhuma chave permanente do Google Cloud fica no GitHub.
- [ ] Aplicação conecta ao Cloud SQL com identidade e rede aprovadas.
- [ ] Secrets são lidos do Secret Manager.
- [ ] Upload e leitura de arquivo funcionam no Cloud Storage.
- [ ] Cloud Run responde ao health check e reduz para zero quando configurado.
- [ ] Limite máximo de instâncias é aplicado.
- [ ] Logs permitem correlacionar requisição, revisão e versão do deploy.
- [ ] Alertas de orçamento e labels obrigatórias estão ativos.
- [ ] Deploy de `dev` é automatizado.
- [ ] Deploy de `prod` possui aprovação humana.
- [ ] Rollback para uma imagem anterior é documentado e testado.
- [ ] Recursos de um projeto não recebem permissões sobre outro sem necessidade explícita.

### 12.9. Decisões que serão fechadas no início da Fase 2

1. Política definitiva de projeto GCP compartilhado versus dedicado.
2. Modelo de compartilhamento e isolamento do Cloud SQL de desenvolvimento.
3. Forma de aplicar migrations durante o deploy.
4. Backend remoto e política de acesso ao estado OpenTofu.
5. Estratégia de domínio e certificados.
6. Retenção de logs e backups.
7. Política de recuperação de banco.
8. Provedor de e-mail real.
9. Necessidade de Redis gerenciado.
10. Regras de promoção de `dev` para `prod`.

---

## 13. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Excesso de combinações | Suportar um único arquétipo na Fase 1 |
| Templates ficam desatualizados | Versionar template e registrar versão em cada projeto |
| Mudanças manuais dificultam atualização | Não prometer atualização automática inicialmente; documentar propriedade dos arquivos |
| Conflitos entre projetos locais | Namespaces Docker e resolução dinâmica de portas |
| Diferenças entre MinIO e Cloud Storage | Usar uma interface de armazenamento e testes de contrato |
| Funciona localmente, falha no container | `zero build` obrigatório com smoke test |
| Vazamento de secrets | `.env.local` ignorado, validação e scanner na CI |
| Exclusão acidental de dados | Escopo por projeto, confirmação e bloqueio fora de local |
| Custo inesperado na nuvem | Fase 1 sem nuvem; Fase 2 com limites, labels e alertas |
| Cloud SQL domina o custo de beta | Compartilhamento controlado em laboratório e banco dedicado apenas quando necessário |
| Multi-cloud aumenta complexidade | Google Cloud será o único provedor da Fase 2; AWS fica posterior |

---

## 14. Métricas de sucesso

Após o projeto piloto, medir:

- tempo entre `zero new` e aplicação saudável;
- número de intervenções manuais necessárias;
- número de erros encontrados por `zero doctor`;
- percentual dos critérios de Sprint Zero atendidos automaticamente;
- capacidade de uma segunda máquina reproduzir o ambiente;
- quantidade de alterações necessárias para implantar na Fase 2;
- custo mensal por aplicação de laboratório na nuvem;
- taxa de sucesso dos pipelines.

Meta inicial principal: criar e executar um projeto novo, em máquina previamente preparada, em até dez minutos e sem editar manualmente arquivos de infraestrutura.

---

## 15. Definition of Done da iniciativa

A iniciativa estará validada quando:

1. um projeto real for criado pelo assistente;
2. outra sessão de desenvolvimento conseguir iniciá-lo apenas com o README e os comandos do Zero;
3. dois projetos funcionarem simultaneamente;
4. o diagnóstico cobrir os erros locais mais comuns;
5. a imagem de produção for construída e testada;
6. a CI passar sem configuração manual além da criação do repositório;
7. na Fase 2, o mesmo projeto for implantado no Google Cloud com infraestrutura versionada e custo limitado.

---

## 16. Decisões registradas e próximo passo

Decisões confirmadas:

1. o nome definitivo do produto é **Zero** e o comando será `zero`;
2. o repositório local será `~/Projetos/Zero`, dentro do diretório-base `~/Projetos`;
3. npm será o gerenciador de pacotes padrão da CLI e dos projetos gerados;
4. autenticação permanece fora do núcleo da Fase 1;
5. o primeiro projeto piloto será um ERP para pequenas e médias imobiliárias.

Todas as decisões necessárias para iniciar o planejamento estão confirmadas. O próximo artefato será o plano de implementação detalhado da Sprint 1, com arquitetura interna, tarefas, testes e ordem de commits.

---

## 17. Referências técnicas

- Docker Compose: <https://docs.docker.com/compose/>
- Docker Compose Profiles: <https://docs.docker.com/compose/how-tos/profiles/>
- Development Containers: <https://devcontainers.github.io/>
- OpenTofu Modules: <https://opentofu.org/docs/language/modules/>
- Google Cloud Run: <https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run>
- Cloud SQL for PostgreSQL: <https://docs.cloud.google.com/sql/docs/postgres>
- GitHub Actions — Docker images: <https://docs.github.com/actions/guides/publishing-docker-images>
