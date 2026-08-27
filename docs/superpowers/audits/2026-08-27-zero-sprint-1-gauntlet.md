# Gauntlet — Zero Sprint 1

**Data:** 27 de agosto de 2026  
**Escopo:** commits 1–6 do plano da Sprint 1  
**Resultado:** aprovado, sem bloqueadores abertos.

## Evidências executadas

- npm run check passou: formatação, lint, TypeScript, 45 testes e validação
  de pacote.
- A validação de pacote cria um tarball, instala-o com scripts desabilitados,
  confirma o inventário permitido, executa o binário e materializa uma fixture
  a partir do template contido no próprio tarball.
- O modo declarativo cobre criação, argumentos incompletos e configuração
  inválida. O modo guiado cobre cancelamento antes de qualquer escrita.

## Matriz de aceite

| Área                  | Resultado | Evidência                                                                                                       |
| --------------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| Parser e contratos    | Aprovado  | Testes de YAML malformado, aliases, chaves duplicadas, campos desconhecidos e controles.                        |
| Caminhos e filesystem | Aprovado  | Testes para traversal, symlink, conflito, staging, concorrência, falha de escrita e interrupção.                |
| Template              | Aprovado  | Manifesto estrito, lock, ausência de secrets e fixture materializada do tarball.                                |
| CLI                   | Aprovado  | Ajuda, diagnóstico, largura humana, preflight, JSON declarativo e cancelamento.                                 |
| Distribuição          | Aprovado  | npm pack, instalação limpa sem lifecycle scripts e execução do binário instalado.                               |
| Mensagem de produto   | Aprovado  | Template e CLI deixam explícito que o scaffold está em pré-execução; Docker, banco e aplicação são da Sprint 2. |

## Achado corrigido durante o gauntlet

**Interrupção durante staging:** a materialização já era atômica para falhas de
I/O, mas não recebia um pedido explícito de cancelamento. Ela agora consulta um
sinal de aborto antes de cada arquivo e antes do rename final. O CLI converte
SIGINT e SIGTERM em esse sinal enquanto cria o projeto; o staging e a reserva
são removidos e o destino final não é publicado. Há teste de regressão para esse
caminho.

## Limites conhecidos, por desenho

- O ambiente desta auditoria usa Node 26; portanto a execução real de zero new
  é corretamente bloqueada pelo contrato de Node 24. Os fluxos de criação foram
  testados por runtime controlado e o tarball foi testado por instalação limpa.
- Docker, PostgreSQL, migrations e aplicação em execução continuam fora da
  Sprint 1. Eles não foram simulados como entrega desta sprint.

## Próxima sprint

Antes de implementar runtime, especificar e revisar o contexto Docker local,
secrets exclusivos, journal, migrations, portas, volumes e ciclo de vida de
processos, conforme a seção 9 do plano da Sprint 1.
