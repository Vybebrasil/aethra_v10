# Loot e Economia de Caça por Catálogo SRD

## Fluxo

1. `MonsterCatalog` registra as criaturas do catálogo SRD em `GameData`.
2. `LootSystem` compila e armazena em cache um perfil econômico para cada criatura.
3. O perfil usa `challengeRatingValue`/`challengeRating`; quando CR não está disponível, usa o XP original em `sourceStats.xp`.
4. Ao derrotar a criatura, `processMonsterDefeat()` resolve em uma chamada:
   - Gold;
   - materiais da família;
   - poções;
   - materiais raros;
   - drops de boss;
   - overrides específicos de dragões.
5. O `HuntSystem` injeta Gold, quantidade e valor do loot no estado da sessão antes de emitir `hunt:updated`.

## Tiers econômicos

| Tier | CR | Gold | Poção de Vida | Poção de Mana | Material raro |
|---|---|---:|---:|---:|---:|
| T0 | 0–1/4 | 0–2, 55% | 1,2% | 0,6% | 0,2% |
| T1 | 1/2–1 | 1–4, 68% | 2,0% | 1,0% | 0,4% |
| T2 | 2–4 | 2–8, 76% | 3,0% | 1,8% | 0,8% |
| T3 | 5–8 | 5–16, 84% | 4,0% | 2,6% | 1,5% |
| T4 | 9–12 | 10–30, 90% | 5,2% | 3,6% | 2,6% |
| T5 | 13–16 | 18–52, 95% | 6,5% | 4,8% | 4,2% |
| T6 | 17–20 | 32–90, 98% | 8,0% | 6,2% | 7,0% |
| T7 | 21+ | 55–160, 100% | 10,0% | 8,0% | 11,0% |

Rank `elite`, `boss` e `legendary` aplica multiplicadores adicionais ao Gold. Chefes também podem gerar Núcleo de Criatura e Selo de Chefe.

## Dragões

Existem overrides explícitos para os 10 Dragões Adultos e 10 Dragões Anciões do catálogo SRD 2024.

### Adultos

- Escamas dracônicas garantidas;
- Essência dracônica;
- Coração de Dragão Adulto: 0,8%;
- Núcleo elemental correspondente: 0,2%;
- Catalisador da Forja Dracônica: 0,025%.

### Anciões

- Escamas dracônicas garantidas;
- Essência dracônica em maior quantidade;
- Escama Dracônica Primordial: 3%;
- Coração de Dragão Ancião: 1,5%;
- Núcleo elemental correspondente: 0,5%;
- Catalisador da Forja Dracônica: 0,08%.

## Eventos emitidos

- `loot:economy-processed`
- `hunt:loot-generated`
- `hunt:economy-updated`
- `hunt:rewards-updated`
- `hunt:updated`

`hunt:economy-updated` já inclui o lucro líquido atual da sessão, permitindo renderização imediata do Analyzer.
