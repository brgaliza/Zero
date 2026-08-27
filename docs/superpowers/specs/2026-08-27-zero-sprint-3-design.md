# Zero — Design da Sprint 3: perfil complete

**Status:** proposto em 27 de agosto de 2026  
**Dependência:** Sprint 2 aprovada; ciclo local do perfil `essential` funcional

## Objetivo

Entregar o perfil `complete` como extensão opt-in do perfil `essential`.
Projetos `complete` devem criar, iniciar, diagnosticar e encerrar um ambiente
local isolado com PostgreSQL, Redis, MinIO e Mailpit. O template incluirá
exemplos mínimos e reais de cache, armazenamento de objetos e e-mail local.

## Escopo

### Incluído

- Perfis `essential` e `complete` no contrato declarativo e no fluxo guiado de
  `zero new`.
- `complete` habilita Redis, MinIO e Mailpit; `essential` mantém o comportamento
  atual, somente com PostgreSQL.
- `zero up`, `zero down`, `zero status`, `zero logs` e `zero doctor` reconhecem
  exclusivamente os serviços habilitados pelo perfil do projeto.
- Compose, variáveis, portas, nomes Docker, rede, volumes, estado local e journal
  por projeto e por slug.
- Adaptadores isolados no template para cache Redis, storage compatível com S3
  via MinIO e SMTP via Mailpit.
- Rotas de exemplo para validar cache com TTL, upload/listagem limitada e envio
  de e-mail de teste.
- Documentação gerada para URLs locais, operação e limites dos exemplos.
- Testes unitários, de integração controlada e e2e real condicionado a Docker.

### Fora do escopo

- Seleção independente ou combinação parcial de serviços opcionais.
- Redis, MinIO ou Mailpit no perfil `essential`.
- E-mail transacional, filas, autenticação, UI de negócio, CRUD ou upload em lote.
- Mudança implícita de perfil em um projeto já criado.
- Serviços de nuvem, deploy ou publicação externa.

## Contrato de profiles

O arquivo de configuração de `zero new` e `zero.yaml` aceitam somente
`essential` e `complete`.

- Para `essential`, `services.redis`, `services.storage` e `services.email`
  permanecem `false`.
- Para `complete`, os três valores são `true`.
- A CLI deriva os serviços do profile; ela não aceita uma combinação manual que
  contrarie o manifesto.
- `zero up` lê, valida e respeita o manifesto existente. Não promove um projeto
  `essential` para `complete` nem altera seu contrato.

## Arquitetura operacional

O template terá uma única definição Compose. Serviços opcionais serão associados
ao profile Docker apropriado e a CLI selecionará somente o conjunto compatível
com o manifesto validado. PostgreSQL continua obrigatório para ambos os perfis.

Todos os recursos são derivados do slug previamente validado:

- containers, rede e volumes possuem namespace do projeto;
- portas preferenciais são resolvidas localmente e registradas apenas no estado
  privado do projeto;
- `zero down` para apenas processos e containers comprovadamente pertencentes ao
  namespace, sem remover volumes;
- `zero logs` aceita somente `app`, `db`, `redis`, `storage` e `email`, e rejeita
  serviços incompatíveis com o profile.

`zero status` e `zero doctor` mostram a condição de cada serviço habilitado,
sem incluir URLs autenticadas, senhas, tokens ou conteúdo de `.env.local`.

## Template complete

O template separa as integrações em três módulos de infraestrutura:

- **Cache:** adaptador Redis usado por uma rota de demonstração que registra e
  recupera um valor com TTL.
- **Storage:** interface da aplicação com operações `put` e `list`, implementada
  por adaptador S3/MinIO. A rota de exemplo limita tamanho e aceita somente tipos
  explícitos; não recebe caminho ou nome de bucket fornecido livremente pelo
  cliente.
- **E-mail:** adaptador SMTP com rota de envio de teste. No ambiente local a
  mensagem é enviada ao Mailpit e pode ser inspecionada em sua interface web.

Essas rotas são exemplos operacionais, não funcionalidades de negócio. O
template `essential` não expõe essas rotas nem instala dependências opcionais.

## Saúde e falhas

`GET /api/health` confirma aplicação e PostgreSQL em todos os perfis. Em
`complete`, também confirma Redis, MinIO e a conectividade SMTP de Mailpit.
Retorna `200` apenas quando todas as dependências habilitadas estão saudáveis e
`503` caso contrário. Respostas não expõem detalhes internos ou credenciais.

Se Docker, um serviço, porta ou configuração obrigatória falhar, a CLI preserva
o estado recuperável, registra apenas metadados seguros e informa uma ação de
recuperação. Segredos de Redis, MinIO e SMTP são criados exclusivamente em
`.env.local`, com criação exclusiva e sanitização nas saídas.

## Testes e aceitação

- Validar parsing, geração e incompatibilidades dos dois profiles.
- Testar seleção de serviços, argumentos Docker, portas e isolamento por slug.
- Verificar que estado, journal, logs e envelopes JSON nunca divulgam secrets.
- Cobrir adaptadores e validação de entrada das rotas de exemplo.
- Em ambiente com Docker, criar dois projetos `complete` em paralelo, verificar
  saúde e exemplos de cache, storage e e-mail, e confirmar que `down` de um não
  afeta o outro.

Uma Sprint 3 é aceita quando `zero new` e `zero up` deixam um projeto `complete`
operável com os quatro serviços, o perfil `essential` continua compatível, e os
comandos operacionais oferecem diagnóstico seguro e isolado.
