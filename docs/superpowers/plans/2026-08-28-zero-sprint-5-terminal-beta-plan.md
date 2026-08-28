# Zero — Plano da Sprint 5: beta técnico por Terminal

**Status:** proposto  
**Design:** [beta técnico por Terminal](../specs/2026-08-28-zero-sprint-5-terminal-beta-design.md)  
**Objetivo:** entregar uma release privada instalável por comandos copiados, sem
DMG, conta Apple ou instalação global do npm.

## P0 — fluxo de instalação privado

1. Criar um entrypoint `bootstrap` no pacote publicado. Ele recebe um único
   tarball local e uma versão esperada, valida ambos antes de tocar na instalação
   existente e usa `npm install --ignore-scripts --no-package-lock --prefix` em
   diretório bootstrap `0700` apenas para materializar o pacote. Não usa registry,
   `npm install -g`, `sudo` nem scripts de lifecycle.
2. Validar o `package.json` extraído: nome `@brunogaliza/zero`, versão igual à
   tag, binário `zero`, engines Node 24/26 e npm 11, sem dependencies,
   optionalDependencies ou scripts. Validar o inventário de arquivos com a mesma
   allowlist já exercitada por `verify-package`.
3. Copiar o pacote validado para `~/.zero/cli/staging` com permissões `0700`,
   criar `bin/zero` que chama o Node aprovado e `dist/main.js`, executar
   `--version` e `--help`, e só então promover/ativar usando a troca atômica
   existente. A instalação anterior deve sobreviver a qualquer falha.
4. Expor `node <bootstrap.cjs> --tarball <arquivo> --version vX.Y.Z` para o guia
   e manter respostas seguras por código, sem ecoar paths pessoais, URL ou saída
   bruta do npm.

## P0 — comandos e PATH

5. Implementar escrita idempotente, consentida e reversível da única linha
   marcada em `~/.zprofile` para incluir `~/.zero/bin`. Se o usuário recusar,
   não for zsh ou a escrita falhar, a instalação retorna a forma absoluta
   `~/.zero/bin/zero` e o guia não mistura as duas formas.
6. Atualizar `zero rollback --previous` e seus testes para a instalação feita
   pelo bootstrap, incluindo falha de cópia, wrapper inválido, versão divergente,
   pacote adulterado e concorrência.

## P0 — guia e assets privados

7. Substituir o gerador de guia baseado em DMG por argumentos estritos
   `--version`, `--release-url` e `--sha256`. O arquivo explica como abrir o
   Terminal, instalar Node 26/npm 11 e Docker Desktop pelos links oficiais,
   baixar o asset no navegador, conferir o checksum, executar o bootstrap,
   escolher PATH e concluir `setup`, `new`, `up`, `down`, `report` e rollback.
   Cada etapa contém bloco copiável, resultado esperado e orientação de falha.
8. Gerar `SHA256SUMS` para o tarball e validar guia, versão, nome de asset e
   digest no script de release. Remover do workflow qualquer variável, download,
   verificação ou texto relacionado a DMG, Team ID ou Apple.
9. Manter `beta-release` no Environment GitHub e fazer o job publicar somente
   artefatos de validação enquanto os dois revisores humanos não estiverem
   configurados. O GitHub privado é o canal de entrega; nenhuma URL pública é
   criada.

## P0 — validação

10. Cobrir unitariamente: checksum inválido, tag/nome/inventário divergentes,
    scripts/dependencies proibidos, falha de npm, staging externo/symlink,
    wrapper inválido, recusa de PATH e rollback após bootstrap.
11. Criar teste de instalação limpa em diretório temporário: gerar tarball,
    calcular hash, executar literalmente o bootstrap com Node 24 e Node 26,
    verificar `zero --version`, `zero setup` e rollback. Nenhuma instalação em
    `~/.zero` real é permitida no teste.
12. Executar Gate A em Mac Apple Silicon limpo com Node/npm/Docker prontos e
    Gate B em Mac Apple Silicon sem Node/npm/Docker, seguindo o guia sem edição.
    Ambos registram versão, checksum conferido, trilha de PATH, `setup`, primeiro
    projeto, `down`, `report` e rollback. Falha bloqueia a release.

## Ordem e corte

A ordem é bootstrap seguro, testes, guia, workflow e gates. Se qualquer item P0
falhar, não haverá tag nem beta tester. Assinatura Apple, DMG, registry npm,
auto-update, Linux, Windows, telemetria, cloud e novos perfis permanecem fora de
escopo.

## Aceite

- Um tester de Mac Apple Silicon sem checkout instala Node/Docker, confere o
  tarball e instala Zero sem `sudo` nem npm global.
- O pacote adulterado, checksum divergente e toda falha antes da promoção deixam
  a versão ativa intacta.
- O guia e assets de release não mencionam DMG, Team ID, Gatekeeper ou Apple.
- `npm run check`, teste de instalação limpa e os dois Human Gates passam antes
  da primeira tag beta.
