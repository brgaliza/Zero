# Zero — Plano de implementação da Sprint 5

**Status:** pronto para gauntlet do plano  
**Design aprovado:** [entrega para beta tester](../specs/2026-08-28-zero-sprint-5-design.md)  
**Dependência:** Sprint 4 aprovada

## Objetivo

Entregar um beta macOS Apple Silicon instalável por leigos, com release
verificável, diagnóstico seguro, primeiro projeto guiado, suporte sanitizado e
rollback atômico.

## Ordem obrigatória

1. **Contrato de runtime e CLI.** Alinhar ambos os `package.json`, preflight e
   `zero setup` para Node 24/26 e npm 11; criar `zero report` com schema fechado,
   permissões privadas e mensagens por `code`/`next_action_id`. Fazer `new` imprimir
   blocos copiáveis para entrar no projeto e subir os serviços.

2. **Núcleo de instalação local.** Implementar diretório `~/.zero` seguro,
   descoberta determinística de Node/npm, install prefix versionado, wrapper,
   shim e PATH idempotente para zsh com fallback absoluto. Cobrir permissões,
   múltiplos runtimes, PATH ausente e diagnósticos sem path pessoal.

3. **Troca e rollback.** Criar staging, lock `fcntl`, `current` atômico,
   recuperação de staging órfão e `zero rollback --previous`; validar que a versão
   ativa só muda após wrapper, compatibilidade e swap passarem.

4. **Empacotamento e extração segura.** Gerar somente o workspace
   `@brunogaliza/zero`. Baixar o tarball em staging `0700` via `O_NOFOLLOW`,
   verificar no mesmo descritor e extrair sem npm: somente regular/diretório,
   inventário/digests/metadata allowlisted, sem symlink/hardlink/device/FIFO/PAX,
   traversal, duplicidade ou Unicode ambíguo, com limites de entradas/tamanho.
   Testar TOCTOU, cada tipo proibido e archive bomb.

5. **Política e cerimônia de confiança.** Antes de qualquer release ou instalador,
   criar
   `release-policy.v1.json` JCS concreto e compilado no app, trust bundle Fulcio/
   Rekor, chave pública/rotação e inventário. Provisionar HSM remoto por OIDC,
   Developer ID/notarização, broker JWS de dois aprovadores, GitHub App read-only
   e Environment; testar política sem curingas/valores-modelo, todos os claims
   OIDC, dois humanos externos ao actor/tag, JWS anti-replay/TTL/reconsulta e
   auditoria imutável, além de negação para PR/fork/claim/review inválidos.

6. **Instalador macOS.** Construir app/DMG universal; validar runtime, política,
   chave, assinatura, checksum e bundle Sigstore antes da extração. Implementar
   manifesto JCS embutido/assinado que vincula versão, tag e digest do tarball ao
   DMG, com falha fechada em divergência. Implementar
   UI fechada por `code`/`stage`/`next_action_id`, sem interpolação, e testes de
   injeção de segredo e mistura de assets. Só depois desse item existe asset instalável.

7. **Guia e suporte.** Gerar `GUIA-BETA-pt-BR.md` sem placeholders, com os dois
   ramos de PATH, instalação manual de Node/Docker, verificação do app, criação,
   validação, shutdown, report e rollback. A verificação fornece bloco literal
   `codesign` + `spctl`, TeamIdentifier e comparação com canal independente,
   interrompendo o fluxo em divergência.

8. **Pipeline de release.** Só agora criar caller por tag → signer reutilizável
   SHA-pinado, draft de release, tarball/DMG/guia/checksum/assinatura/Sigstore e
   validação do asset baixado antes de publicar. Cobrir DSSE/Fulcio/Rekor offline,
   claims/OIDs, checkpoint e adulteração de todos os campos. Exigir tag anotada,
   assinada e protegida, versão/commit corretos e recusar tag, versão ou asset
   divergente antes de publicar.

9. **Gates.** Automatizar checks e fixtures; executar Human Gate em Mac limpo com
   Node 24 e 26/npm11, PATH aceito/recusado/fallback e rollback; e snapshot sem
   Node/npm/Docker/gerenciadores, comprovando ausência e seguindo links/telas.
   Ambos validam asset do draft, executam literalmente o bloco `codesign`/`spctl`
   e comparam Team ID pelo canal independente; fixtures e gate cobrem manifesto e
   Team ID divergentes. Qualquer falha bloqueia publicação.

## Aceite da Sprint

- Beta tester sem checkout conclui a trilha literal e valida um projeto
  `essential`.
- Todo asset instalado possui cadeia de confiança verificada e falha fechada.
- Instalação, atualização e rollback preservam o comando anterior em falhas e não
  tocam projetos, containers ou volumes; lock, metadata/ref anterior e staging
  órfão resistem a download/staging/swap/shim/crash/concorrência.
- Rollback baixa a release anterior somente pelos mesmos controles de assinatura,
  provenance e política; valida matriz CLI↔schema/template antes do swap.
- Saídas persistidas e de interface não expõem segredo, path pessoal ou erro bruto.
- Apenas Node 24/26 e npm 11 avançam; Node 23/27+, npm 10/12+ falham antes de
  instalar/criar/operar. Report é `0600`, diretórios `0700` e schema allowlisted.
- `new` imprime blocos literais de criação e `cd && up`; validação offline GPG,
  DSSE/Fulcio/Rekor/checkpoint e UI fechada passam nas fixtures adversariais.
- `zero setup` distingue Docker ausente, Desktop parado, daemon inacessível e
  transporte remoto recusado, cada um com link oficial e próxima ação testável.
- Gates automatizados e os dois Human Gates passam antes da release.

## Corte de escopo

Se a Sprint ficar pressionada, não publicar release beta parcial: registry npm,
auto-update, Linux/Windows, telemetria, cloud e perfis novos permanecem fora do
escopo. Os controles de confiança, guia literal e Human Gates são P0 indivisíveis.
