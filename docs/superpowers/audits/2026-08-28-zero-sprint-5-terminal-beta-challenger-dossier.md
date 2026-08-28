# Dossiê para Challenger independente — Sprint 5 beta técnico

## Artefatos a revisar

- [Design revisado](../specs/2026-08-28-zero-sprint-5-terminal-beta-design.md)
- [Plano de implementação](../plans/2026-08-28-zero-sprint-5-terminal-beta-plan.md)

## Contexto e decisões já tomadas

O Zero será distribuído para poucos beta testers por uma release privada do
GitHub. O tester usa Mac Apple Silicon com macOS 14 ou superior e pode não ter
Node, npm ou Docker. O caminho anterior por DMG foi explicitamente descartado:
não há conta Apple, assinatura, notarização, registry npm, instalação global do
npm, `sudo`, auto-update, Linux ou Windows nesta sprint.

A release deve conter `zero-vX.Y.Z.tgz`, `SHA256SUMS` e guia pt-BR. O guia leva
o tester a abrir Terminal, instalar Node 26/npm 11 e Docker Desktop pelos links
oficiais quando necessário, conferir o SHA-256 e executar um bootstrap local.
O bootstrap usa npm somente com `--ignore-scripts` e prefixo privado para
materializar o pacote já conferido, valida metadados/inventário e promove a CLI
para `~/.zero` por staging e troca atômica. O rollback é local e mantém a versão
anterior. O hash protege integridade; a autenticidade do link depende do convite
privado por canal combinado.

## Mandato ao Challenger

> Sua tarefa é encontrar falhas neste artefato, não confirmar que ele está bom.
> Você está revisando trabalho de outro agente de IA (o Builder) que pode ter
> viés a favor da própria solução. Aponte requisito ambíguo ou não testável;
> caso de borda não coberto; premissa não declarada; alternativa de arquitetura
> descartada sem justificativa suficiente; sequenciamento arriscado no plano de
> implementação; dependência não mapeada; cobertura de teste insuficiente;
> teste que confirma o comportamento errado em vez de pegá-lo; divergência entre
> Specification e implementação; risco de segurança ou concorrência não tratado.
> Classifique cada achado por severidade e dê um veredito final.

Foque especialmente em: instalação de tarball sem execução antecipada,
integridade versus autenticidade, path traversal/symlink/TOCTOU, package manager
e lifecycle scripts, falhas durante staging/swap/PATH, rollback, experiência de
um usuário sem Node/Docker e provas dos Gates A e B.

## Formato obrigatório da resposta

```markdown
## Parecer do Challenger
**Artefato revisado**: Sprint 5 — beta técnico por Terminal
**Momento**: Revisão do plano
**Modelo desafiante**: [modelo usado]
**Data**: [data]

| # | Achado | Severidade (Bloqueante/Alto/Médio/Baixo) | Resposta do Builder | Status |
|---|---|---|---|---|
| 1 | | | | |

**Veredito**: Aprovar / Aprovar com ressalvas / Não aprovar
```

Não aprove por cortesia: um bloqueante aberto impede a implementação até ser
corrigido ou receber override humano explícito.
