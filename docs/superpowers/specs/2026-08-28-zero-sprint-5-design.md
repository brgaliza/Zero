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
2. abrir o Terminal e instalar Node 24/npm 11 pelos links oficiais se `zero
   setup` indicar ausência ou incompatibilidade; reiniciar Terminal se instruído;
3. instalar, abrir e aguardar Docker Desktop ficar pronto;
4. baixar `zero-vX.Y.Z.tgz` e instalar com `npm install -g --ignore-scripts
   ./zero-vX.Y.Z.tgz`, sem `sudo`;
5. confirmar `zero --version`, executar `zero setup` e resolver somente o item
   indicado;
6. criar projeto `essential`, entrar na pasta impressa e executar `zero up`;
7. abrir a URL e executar a validação que o Zero imprimir;
8. encerrar com `zero down` quando desejar.

O Zero deve imprimir a pasta, URL e próximo comando de validação de modo que o
guia não exija inferência de portas, `cd` ou rota de health. Capturas entram
somente para abrir Terminal e reconhecer Docker Desktop pronto.

## Diagnóstico, suporte e rollback

`zero setup` continua somente leitura, mas distingue Docker ausente, instalado
com Desktop parado, daemon inacessível, transporte remoto recusado e pronto.
Explica o que falta, por que importa, link oficial e próxima ação. Node 24/npm
11 é o par suportado; versões diferentes mostram a versão encontrada.

`zero report` gera arquivo limitado e sanitizado com versão Zero, macOS,
resultado estruturado de setup, versões Node/npm/Docker e códigos de erro. Ele
exclui `.env.local`, URLs autenticadas, tokens, senhas e logs brutos. O guia de
suporte cobre comando ausente, PATH, Docker, permissão global e falha de projeto;
instrui anexar somente esse arquivo e informar a etapa. Notas da release definem
canal, responsável e prazo de resposta.

Rollback preserva projetos: remove apenas a CLI global atual e instala o tarball
da versão anterior aprovada. A nota informa a última versão compatível e deixa
explícito que rollback não toca containers, volumes ou arquivos de projetos.

## Aceite

- A release publicada contém somente os três assets previstos, provenance e tag
  verificáveis, sem secrets ou estado local.
- Um Mac sem checkout instala o asset final, executa setup e cria/valida um
  projeto `essential` seguindo literalmente o guia. A auditoria registra tempos
  observados; não há SLA que dependa de rede ou primeiro pull.
- O fluxo principal precisa concluir para aceitar a sprint. Relato seguro é
  métrica de suporte, não substituto do sucesso.
- Teste de instalação limpa, pacote, gauntlet Docker e validação do asset final
  passam antes da release.
