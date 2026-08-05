# Crônicas de Aethra — Projeto organizado

Projeto front-end puro. Não exige Node.js nem backend para jogar; o servidor
local abaixo existe apenas para desenvolvimento e testes consistentes.

## Executar

No Windows, dê dois cliques em `INICIAR_JOGO.cmd`. O iniciador sobe o servidor
na porta 8000 somente se necessário e abre o jogo no navegador. Para controlar
o processo pelo terminal:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev-server.ps1 start
powershell -ExecutionPolicy Bypass -File scripts/dev-server.ps1 status
powershell -ExecutionPolicy Bypass -File scripts/dev-server.ps1 restart
powershell -ExecutionPolicy Bypass -File scripts/dev-server.ps1 stop
```

Abra `http://127.0.0.1:8000/`. O iniciador registra o PID, evita processos
duplicados e só considera o servidor pronto após validar a página de Aethra.
Como fallback manual, use `python -m http.server 8000 --bind 127.0.0.1`.

## Estrutura

- `js/core`: namespace, estado, EventBus e carregador.
- `js/data`: repositório central de dados e balanceamento.
- `js/infrastructure`: save e persistência.
- `js/ui`: janelas e renderizadores.
- `js/items`: itens, loot, mochila e equipamento.
- `js/progression`: XP, quests e profissões.
- `js/combat`: combate, skills e bosses.
- `js/world`: cidade, caça e dungeons.
- `js/market`: NPC Shop, Premium Shop e Player Market.
- `js/tests`: smoke test de integração.
- `js/setup`: setup automático opcional do marketplace.

O `index.html` é a versão principal. Os arquivos de teste não são carregados automaticamente.

## Padrão de engenharia

Toda alteração deve seguir as regras de `AGENTS.md` e o contrato descrito em
`docs/ENGINEERING_STANDARD.md`. Antes de entregar uma mudança, execute:

```bash
node scripts/verify-project.mjs
```

Depois abra `tests/integration.html` e confirme 100% das verificações, sem erros
de console ou assets ausentes.

A mesma suíte pode ser executada sem interface na matriz responsiva suportada:

```bash
node scripts/run-integration.mjs --timeout 90 --viewport 640x720
node scripts/run-integration.mjs --timeout 90 --viewport 768x720
node scripts/run-integration.mjs --timeout 90 --viewport 1024x768
node scripts/run-integration.mjs --timeout 90 --viewport 1280x720
node scripts/run-integration.mjs --timeout 90 --viewport 1920x1080
```

Antes de modificar HUD, automação, skills, profissões, coleta, crafting ou save,
leia `docs/DEVELOPER_HANDOFF.md`. Ele registra o estado atual, o proprietário de
cada domínio, contratos que não podem ser duplicados, testes e próximos passos.

O primeiro capítulo jogável, do personagem novo ao Lobo Alfa no nível 10, está
documentado em `docs/LEVEL_1_10_PLAYABLE_CONTRACT.md`.

## World Loop e progressão

A versão atual inclui paperdoll, backpack em slots, skills de combate/coleta/mundo, eventos de exploração e Hunt Analyzer em tempo real. Consulte `WORLD_LOOP_PROGRESSION.md` para detalhes.

## Economy RNG V1

O projeto agora inclui `js/economy/EconomyRNGManager.js`, com encontros raros em camadas, modificadores de evento/booster, recompensa de consolação, jackpot separado, raridade ponderada, IV matematicamente consistente e telemetria interna.

Consulte `ECONOMY_RNG_V1.md` e `ECONOMY_RNG_TEST_REPORT.json`.

## Bestiário SRD integrado

Esta versão inclui `MonsterCatalog`, 327 criaturas SRD normalizadas e 12 Hunts progressivas. Consulte `MONSTER_CATALOG_INTEGRATION.md` e `THIRD_PARTY_NOTICES.md`.
