# Projeto Zero Essential

Esta é a fundação estática do arquétipo `next-fullstack` no perfil `essential`.

## Estado desta geração

O Zero inicia o ambiente local com `zero up`: cria `.env.local` somente se ele
não existir, inicia PostgreSQL, aplica migrations e seed, e mantém a aplicação
em primeiro plano. `zero down` encerra apenas a infraestrutura do projeto e
preserva os volumes.

`zero.yaml` registra o contrato portátil do projeto. `.zero/template.lock.json`
registra a proveniência do template. `.env.example` contém somente nomes e um
formato de conexão sem credenciais reais.

O Zero não modifica arquivos automaticamente depois da criação: o código
pertence ao projeto. Capacidades futuras dependem de um comando explícito e de
revisão antes de qualquer alteração.
