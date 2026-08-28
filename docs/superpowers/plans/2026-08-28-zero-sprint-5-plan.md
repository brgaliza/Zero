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

4. **Empacotamento e extração.** Gerar somente o workspace `@brunogaliza/zero`.
   Implementar instalação a partir de descritor validado e extrator restrito,
   inventário/digests de pacote e proteção contra archive-bomb/TOCTOU.

5. **Release confiável.** Criar caller de tag e signer reutilizável pinado;
   emitir DMG, tarball, checksum/assinatura, guia gerado e bundle Sigstore.
   Implementar manifesto de política, trust bundle offline, validação Fulcio/Rekor
   e autorização HSM/OIDC/broker de aprovações.

6. **Aplicativo instalador macOS.** Construir DMG universal assinado/notarizado;
   validar política, release, tarball e runtime antes de extração. Exibir apenas
   mensagens sanitizadas e oferecer instalação, PATH e rollback.

7. **Guia e suporte.** Gerar `GUIA-BETA-pt-BR.md` sem placeholders, com os dois
   ramos de PATH, instalação manual de Node/Docker, verificação do app, criação,
   validação, shutdown, report e rollback.

8. **Gates.** Automatizar checks, package/release fixtures e adulterações de
   supply-chain; executar Human Gate em Mac limpo com pré-requisitos e em snapshot
   sem Node/npm/Docker. Qualquer falha bloqueia a publicação.

## Aceite da Sprint

- Beta tester sem checkout conclui a trilha literal e valida um projeto
  `essential`.
- Todo asset instalado possui cadeia de confiança verificada e falha fechada.
- Instalação, atualização e rollback preservam o comando anterior em falhas e não
  tocam projetos, containers ou volumes.
- Saídas persistidas e de interface não expõem segredo, path pessoal ou erro bruto.
- Gates automatizados e os dois Human Gates passam antes da release.

## Corte de escopo

Se a Sprint ficar pressionada, não publicar release beta parcial: registry npm,
auto-update, Linux/Windows, telemetria, cloud e perfis novos permanecem fora do
escopo. Os controles de confiança, guia literal e Human Gates são P0 indivisíveis.
