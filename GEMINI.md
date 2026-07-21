# Instruções do workspace

Antes de analisar ou modificar este projeto, leia integralmente:

1. `AGENTS.md`
2. `docs/ENGINEERING_STANDARD.md`

Esses arquivos são regras obrigatórias, não sugestões. Em especial:

- não crie uma segunda fonte de verdade para combate, XP, ouro, loot ou itens;
- UI e canvas apenas enviam comandos e renderizam eventos oficiais;
- não faça mutações diretas de inventário, economia ou persistência;
- toda correção deve incluir teste de regressão;
- execute `node scripts/verify-project.mjs` e exija 100% de aprovação em
  `tests/integration.html` antes de declarar a tarefa concluída;
- verifique console e rede: nenhum erro ou 404 é aceitável.

Se uma solicitação conflitar com a arquitetura atual, explique o conflito e
altere primeiro o módulo proprietário descrito em `AGENTS.md`.
