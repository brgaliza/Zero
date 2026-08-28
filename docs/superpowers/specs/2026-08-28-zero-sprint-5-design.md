# Zero — Design da Sprint 5: entrega para beta tester

**Status:** revisado em 28 de agosto de 2026  
**Dependência:** Sprint 4 aprovada

## Objetivo

Permitir que um beta tester em macOS Apple Silicon instale uma versão validada do
Zero e crie seu primeiro projeto sem conhecer Node, npm, Docker ou o repositório.

## Escopo

Inclui release GitHub versionada, guia não técnico em pt-BR, diagnóstico de
pré-requisitos, `zero report` sanitizado, roteiro `essential`, rollback e teste
de instalação limpa. Não inclui instalação automática de ferramentas do sistema,
registry npm, auto-update, telemetria, Linux/Windows, novos perfis ou cloud.

## Release autenticável e reproduzível

Cada release `vX.Y.Z` nasce de tag Git anotada, assinada e protegida, apontando
para o commit validado. O workflow, acionado somente por essa tag, executa em
runner limpo: `npm run check`, gauntlet Docker dos dois perfis e teste de
instalação limpa. Então gera uma única saída de `npm pack --ignore-scripts`,
renomeia para `zero-vX.Y.Z.tgz`, cria `SHA256SUMS` e `SHA256SUMS.asc`, baixa o
asset final e o valida antes de publicar.

As notas registram SHA do commit, SHA-256, versão, ID do workflow, limitações,
canal de suporte e rollback. O workflow recusa versão divergente, asset existente
ou falha em qualquer gate. Só o job de upload recebe `contents: write`.

A chave pública e seu fingerprint ficam no repositório e chegam ao tester por
canal independente do asset. A assinatura/hash são obrigatórios no gate; no guia
para leigos, são recomendados com alternativa clara de confirmar o fingerprint
com o suporte. Hash publicado junto ao asset não é tratado como autenticação.

## Guia de beta

O guia contém uma trilha única, com comandos concretos da release, em blocos de
copiar e colar e resultado esperado após cada ação:

1. confirmar macOS 14+, Apple Silicon, 10 GB livres e rede estável;
2. abrir o Terminal e executar o preflight independente copiado do guia
   (`node --version`, `npm --version` e `docker version`); se algum comando
   falhar, seguir o link oficial e a instrução concreta correspondente antes de
   instalar o Zero;
3. instalar, abrir e aguardar Docker Desktop ficar pronto;
4. baixar e abrir `Zero Beta Installer.app`; ele verifica automaticamente
   assinatura, fingerprint, provenance e checksum antes de instalar o tarball
   com lifecycle scripts desabilitados, e para sem instalar se algo falhar;
5. confirmar `zero --version`, executar `zero setup` e resolver somente o item
   indicado;
6. criar projeto `essential` com respostas transcritas no guia (nome, descrição,
   slug, pasta sugerida, perfil `essential`, início `não` e confirmação `sim`),
   entrar na pasta impressa e executar `zero up`;
7. abrir a URL e executar a validação que o Zero imprimir;
8. encerrar com `zero down` quando desejar.

O Zero deve imprimir a pasta, URL e próximo comando de validação de modo que o
guia não exija inferência de portas, `cd` ou rota de health. Capturas entram
somente para abrir Terminal e reconhecer Docker Desktop pronto.

## Diagnóstico, suporte e rollback

`zero setup` continua somente leitura, mas distingue Docker ausente, instalado
com Desktop parado, daemon inacessível, transporte remoto recusado e pronto.
Explica o que falta, por que importa, link oficial e próxima ação. As únicas
faixas aceitas são Node `>=24 <25` e npm `>=11 <12`; qualquer outra versão
bloqueia criação/operação, mostra a versão encontrada e a ação de correção.

`zero report` gera arquivo JSON `0600` em diretório previsível e privado do Zero
e aceita somente allowlist de campos: versão Zero, versão macOS, arquitetura,
versões Node/npm/Docker, estados enumerados de `zero setup`, código estável do
último comando e timestamp. Ele nunca inclui stdout/stderr, caminhos pessoais,
mensagens brutas de subprocesso, `.env.local`, URLs, tokens, senhas ou logs. O
schema é estrito, o tamanho é limitado e testes adversariais injetam segredos e
mensagens de erro em todas as fronteiras de serialização. O guia de
suporte cobre comando ausente, PATH, Docker, permissão global e falha de projeto;
instrui anexar somente esse arquivo e informar a etapa. Notas da release definem
canal, responsável e prazo de resposta.

Rollback é transacional: primeiro instala a versão anterior em prefixo temporário,
executa `zero --version` e `zero setup`, e verifica a matriz CLI↔schema/template
contra manifestos existentes. Só após todos os checks troca a instalação global;
falha preserva a CLI atual e remove staging. Se algum projeto não for suportado,
recusa e mostra a versão mínima compatível. Rollback não toca containers, volumes
ou arquivos de projetos.

## Controles verificáveis de publicação

O workflow cria primeiro release em rascunho, gera/upload os assets, baixa-os da
API de release, verifica assinatura da tag contra fingerprint allowlisted e
verifica assinatura/checksum do tarball. Só então publica. Branch protection e
Environment GitHub `beta-release` exigem aprovação do responsável nomeado; o
workflow falha quando o autor/assinante/tag não pertence à allowlist.

Além de `SHA256SUMS.asc`, o job emite atestação de proveniência DSSE vinculada ao
digest do tarball, ao SHA do commit, à tag e ao ID do workflow, e a anexa como
quarto asset `provenance.intoto.jsonl`. O gate verifica emissor, repositório,
workflow e digest antes de publicar. A instalação deve parar se a verificação de
fingerprint, assinatura ou checksum falhar; o instalador apresenta a causa e
orienta contatar suporte, sem instalar o arquivo.

`Zero Beta Installer.app` é asset operacional da release. É aplicação macOS
universal, assinada e notarizada pela identidade de distribuição do Zero;
Gatekeeper verifica sua assinatura antes de abrir. Ela contém o verificador de
release e orquestrador de instalação, usa fingerprint embutido e allowlist de
repositório/workflow, mostra progresso e nunca executa shell remoto. Exige
Node/npm já aprovados pelo preflight, instala somente tarball verificado com
lifecycle scripts desabilitados e grava relatório sanitizado em falha. O gate
produz, assina, verifica e anexa o app junto aos assets.

Antes de publicar, um Human Gate executa a trilha literal em Mac Apple Silicon
limpo com Docker Desktop, registra versão macOS, tempos, screenshots dos passos
visuais e saída sanitizada. Falha de qualquer passo bloqueia a release; CI Linux
continua complementar, não substituta.

## Aceite

- A release publicada contém instalador macOS, tarball, checksum, assinatura e
  provenance, com tag
  verificáveis, sem secrets ou estado local.
- Um Mac sem checkout instala o asset final, executa setup e cria/valida um
  projeto `essential` seguindo literalmente o guia. A auditoria registra tempos
  observados; não há SLA que dependa de rede ou primeiro pull.
- O fluxo principal precisa concluir para aceitar a sprint. Relato seguro é
  métrica de suporte, não substituto do sucesso.
- Teste de instalação limpa, pacote, gauntlet Docker e validação do asset final
  passam antes da release.
