# Atlas de Hunts e Expedições

## Hunts focadas
- Busca por nome, tipo, bioma ou região.
- Filtros de tipo, bioma e acesso por nível.
- Ordenação por nível, nome ou tipo.
- Preferências salvas no `localStorage` em `aethra.worldMap.huntFilters.v1`.
- Cada criatura mostra HP, dano, XP, rank e as regiões onde aparece.
- Drop table base é lida da própria criatura. Quando vazia, usa `LootProfileRegistry` conforme a família.
- Equipamentos com IV permanecem sinalizados como RNG econômico separado.

## Expedições
- Mantêm múltiplas criaturas e eventos de mundo.
- Tags calculadas por perigo e rank: SOLO, GRUPO, ELITE e BOSS.
- O detalhe da rota mostra o formato recomendado.
- A estrutura continua preparada para a futura Dungeon solo/time.
