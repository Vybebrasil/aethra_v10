# Crônicas de Aethra — Projeto organizado

Projeto front-end puro. Não usa Node.js nem servidor.

## Executar

Abra `index.html` diretamente no navegador.

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

## World Loop e progressão

A versão atual inclui paperdoll, backpack em slots, skills de combate/coleta/mundo, eventos de exploração e Hunt Analyzer em tempo real. Consulte `WORLD_LOOP_PROGRESSION.md` para detalhes.

## Economy RNG V1

O projeto agora inclui `js/economy/EconomyRNGManager.js`, com encontros raros em camadas, modificadores de evento/booster, recompensa de consolação, jackpot separado, raridade ponderada, IV matematicamente consistente e telemetria interna.

Consulte `ECONOMY_RNG_V1.md` e `ECONOMY_RNG_TEST_REPORT.json`.

## Bestiário SRD integrado

Esta versão inclui `MonsterCatalog`, 327 criaturas SRD normalizadas e 12 Hunts progressivas. Consulte `MONSTER_CATALOG_INTEGRATION.md` e `THIRD_PARTY_NOTICES.md`.
