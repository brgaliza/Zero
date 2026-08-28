# Zero — Plano da Sprint 5: beta técnico por Terminal

**Status:** proposto  
**Design:** [beta técnico por Terminal](../specs/2026-08-28-zero-sprint-5-terminal-beta-design.md)  
**Objetivo:** entregar uma release privada instalável por comandos copiados, sem
DMG, conta Apple ou instalação global do npm.

## P0 — fluxo de instalação privado

1. Criar `zero-bootstrap-vX.Y.Z.cjs` como asset separado, produzido do mesmo
   commit e executável por `node` sem a CLI instalada. Ele recebe tarball local,
   versão esperada e os SHA-256 esperados de tarball/bootstrap, rejeita argumentos
   desconhecidos, repetidos ou incompletos e valida todos antes de tocar na instalação
   existente. Após validar o próprio hash e o do tarball, usa `npm install`
   estritamente local com `--offline --ignore-scripts --no-package-lock --no-audit
--no-fund --prefix`, cache vazio e `userconfig`/`globalconfig` controlados em
   diretório `0700` apenas para materializar o pacote. Não usa registry, rede,
   `npm install -g`, `sudo` nem scripts de lifecycle.
2. Validar o `package.json` extraído: nome `@brunogaliza/zero`, versão igual à
   tag, binário `zero`, engines Node 24/26 e npm 11, sem dependencies,
   optionalDependencies, peerDependencies, bundledDependencies ou scripts. Validar o inventário de arquivos com a mesma
   allowlist já exercitada por `verify-package`.
3. Copiar o pacote validado para `~/.zero/cli/staging` com permissões `0700`,
   criar `bin/zero` que chama o Node aprovado e `dist/main.js`, executar
   `--version` e `--help`, e só então promover/ativar usando a troca atômica
   existente. A instalação anterior deve sobreviver a qualquer falha. O shim
   recebe o prefixo real da instalação, nunca assume `$HOME`, e é executado no
   teste isolado. Cada ancestral do prefixo é recusado se for symlink; a promoção
   usa diretório owner-only. A implementação abre arquivos regulares com
   no-follow, recusa ancestrais symlink e documenta que um processo com o mesmo
   UID que pode substituir o diretório privado está fora da fronteira defendida.
4. Definir ativação transacional: validar wrapper e criar/validar shim estável
   antes de tocar em `current`; gravar e sincronizar journal privado com estado
   anterior, alvo e fase `prepared` antes da primeira mutação; preparar `previous`
   temporário apontando ao ativo; trocar `previous` e depois `current` por renames
   atômicos, atualizando o journal entre cada fronteira. Ao iniciar, recuperar
   qualquer journal incompleto para ambos os ponteiros anteriores; se isso falhar,
   bloquear rollback com código estável. Testar interrupção após cada rename.
5. Expor `node zero-bootstrap-vX.Y.Z.cjs --tarball <arquivo> --version vX.Y.Z --sha256 <hex> --bootstrap-sha256 <hex>` para o guia
   e manter respostas seguras por código, sem ecoar paths pessoais, URL ou saída
   bruta do npm.

## P0 — comandos e PATH

6. Implementar escrita idempotente, consentida e reversível da única linha
   marcada em `~/.zprofile` para incluir `~/.zero/bin`. Se o usuário recusar,
   não for zsh ou a escrita falhar, a instalação retorna a forma absoluta
   `~/.zero/bin/zero` e o guia não mistura as duas formas.
7. Atualizar `zero rollback --previous` e seus testes para a instalação feita
   pelo bootstrap, incluindo falha de cópia, wrapper inválido, versão divergente,
   pacote adulterado e concorrência. O lock contém PID e início; em lock existente
   o bootstrap só o remove após provar que o PID não existe e sua idade supera a
   janela documentada. Caso contrário falha sem remover o lock.

## P0 — guia e assets privados

8. Substituir o gerador de guia baseado em DMG por argumentos estritos
   `--version`, `--release-url`, `--sha256` e `--bootstrap-sha256`. O arquivo explica como abrir o
   Terminal, instalar Node 26/npm 11 e Docker Desktop pelos links oficiais,
   baixar o asset no navegador, comparar o checksum com a mensagem independente,
   `SHA256SUMS` e `shasum`, executar o bootstrap com os dois hashes literais,
   escolher PATH e concluir `setup`, `new`, `up`, `down`, `report` e rollback.
   Cada etapa contém bloco copiável, resultado esperado e orientação de falha.
9. Gerar `SHA256SUMS` para tarball e bootstrap e validar versão declarada no `package.json`,
   guia, nome de asset e
   digest no script de release. Remover do workflow qualquer variável, download,
   verificação ou texto relacionado a DMG, Team ID ou Apple.
10. Separar o workflow `beta-candidate`, acionado manualmente por SHA e versão
    sem criar tag, do `beta-release`, acionado apenas por tag protegida. O candidate
    produz assets e atestado imutável `{commitSha, version, tarballSha256,
   bootstrapSha256, runId}` para os Gates A/B em Environment de dois revisores.
    Após os Gates A/B, `promote-candidate` recebe o `runId`, entra em Environment
    de dois revisores, valida evidências e usa GitHub App com permissão exclusiva
    de criar tag para gerar a tag anotada. Ruleset proíbe push de tag por pessoas.
    A tag anotada declara `Zero-Candidate-Run: <runId>`; `beta-release` consulta
    esse run e exige atestado, aprovação e SHA exatamente iguais à tag antes de
    recriar assets, baixá-los por API e criar a GitHub Release privada com
    `contents: write`. Não há bypass pelo actor.
11. Remover `publishConfig` e toda expectativa de registry npm do pacote e do
    verificador; adicionar teste que prova que o bootstrap não consulta rede nem
    lê configuração npm do usuário.

## P0 — validação

12. Cobrir unitariamente: checksum inválido de tarball/bootstrap, tag/nome/inventário divergentes,
    scripts/dependencies proibidos, falha de npm, staging externo/symlink,
    wrapper inválido, recusa de PATH, lock órfão/ativo, ancestral symlink,
    troca TOCTOU de staging, recovery após cada checkpoint de journal e rollback
    após bootstrap. Cobrir o contrato estrito do guia, inclusive ambos os hashes.
13. Criar teste de instalação limpa em diretório temporário: gerar tarball e bootstrap,
    calcular hash, executar literalmente o bootstrap com Node 24 e Node 26,
    verificar `zero --version`, `zero setup` e rollback. Nenhuma instalação em
    `~/.zero` real é permitida no teste.
14. Executar Gate A em Mac Apple Silicon limpo com Node/npm/Docker prontos e
    Gate B em Mac Apple Silicon sem Node/npm/Docker, seguindo o guia sem edição.
    Ambos registram versão, checksum conferido, trilha de PATH, `setup`, primeiro
    projeto, `down`, `report` e rollback. Falha bloqueia a release.
15. Testar o encadeamento candidate→promotion→tag→release com fixtures: `runId`
    ausente, inexistente, não aprovado, com SHA/versão/hash divergente, tag sem
    anotação, tag criada por actor não permitido e a única trilha aprovada.

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
- O guia e assets de release não mencionam DMG, Team ID, Gatekeeper ou Apple e
  exigem confirmação de checksum por mensagem independente.
- `npm run check`, teste de instalação limpa e os dois Human Gates passam antes
  da primeira tag beta.
