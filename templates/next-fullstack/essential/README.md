# Projeto Zero Essential

Esta é a fundação estática do arquétipo `next-fullstack` no perfil `essential`.

## Estado desta geração

Este projeto ainda está em **pré-execução**. A Sprint 1 cria contratos, código
estático e dependências fixadas, mas não instala dependências, não cria
`.env.local`, não gera secrets, não inicia Docker/PostgreSQL e não executa
migrations. Um ambiente local funcional é uma entrega da Sprint 2.

`zero.yaml` registra o contrato portátil do projeto. `.zero/template.lock.json`
registra a proveniência do template. `.env.example` contém somente nomes e um
formato de conexão sem credenciais reais.

O Zero não modifica arquivos automaticamente depois da criação: o código
pertence ao projeto. Capacidades futuras dependem de um comando explícito e de
revisão antes de qualquer alteração.
