# Bestiário SRD e Catálogo de Hunts

## Resumo

O projeto passou a usar um catálogo normalizado derivado do arquivo PocketDM enviado para o protótipo.

- 684 registros na fonte original.
- 327 criaturas marcadas como `is_srd: true` importadas para o runtime.
- Conteúdo homebrew não foi incluído no pacote de execução.
- 12 Hunts montadas com 57 entradas ponderadas de encontros.
- Compatibilidade mantida para `forest_wolf`, `giant_rat`, `orc_scout` e `skeleton_guard`.

## Pipeline

```text
pocketdm_monstros_srd.json
        ↓
MonsterCatalogData.js
        ↓
MonsterCatalog + MonsterCatalogAdapter
        ↓
GameData.creatures
        ↓
HuntCatalog
        ↓
HuntSystem → BattleSystem → LootSystem
```

## Arquivos

- `data/source/pocketdm_monstros_srd.json`: fonte filtrada para SRD.
- `data/generated/monster_catalog_srd.json`: dados normalizados para auditoria.
- `js/data/MonsterCatalogData.js`: versão executável sem dependência de `fetch`, inclusive ao abrir localmente.
- `js/data/CreatureBalanceConfig.js`: CR, nível, HP, dano, defesa e economia.
- `js/data/MonsterAbilityParser.js`: ataques, dano, CD, Recharge, condições e testes de resistência.
- `js/data/LootProfileRegistry.js`: materiais coerentes por família de criatura.
- `js/data/MonsterCatalogAdapter.js`: adaptador do schema PocketDM.
- `js/data/MonsterCatalog.js`: pesquisa, aliases, registro e integração com GameData.
- `js/data/HuntCatalog.js`: regiões, níveis e pools ponderados.

## Balanceamento

Os valores de D&D não entram diretamente no combate. O CR orienta o nível recomendado e o adaptador converte os dados para a escala de Aethra.

As estatísticas originais permanecem disponíveis em `sourceStats` para auditoria e ajustes futuros.

## Ações dos monstros

O combate escolhe entre ações ofensivas do monstro. Ações com `Recharge` ficam indisponíveis após o uso e fazem a rolagem de recarga nos turnos seguintes. O nome da ação aparece no feedback de combate e as quatro principais ações aparecem no Inspect do inimigo.

Mecânicas complexas como Grapple, Poisoned, Prone e efeitos de covil estão estruturadas no catálogo, mas algumas ainda exigem implementação própria no motor de status.

## Loot

Cada família possui um perfil coerente:

- Beast e Monstrosity: couro, carne, ossos e presas.
- Undead: ossos, pó funerário e ectoplasma.
- Construct: minério e núcleos arcanos.
- Dragon: escamas e essência dracônica.
- Fiend: cinza infernal e icor.
- Plant e Fey: ervas, resina e pó feérico.

O Economy RNG continua responsável por encontros raros e jackpots individualizados.
