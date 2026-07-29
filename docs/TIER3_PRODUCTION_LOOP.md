# Loop de produção Tier 3

Atualizado em: 2026-07-29  
Checkpoint-base: `863641e`

Este documento descreve o primeiro conteúdo de Mestre para Forjaria e Couraria.
O objetivo é impedir receitas sem fonte, materiais que não existem no catálogo e
dois ofícios produzindo o mesmo equipamento.

## Fluxo do jogador

O Tier 3 é descoberto no nível 10 do respectivo ofício. A escolha de
especialização também abre no nível 10, mas não é requisito para fabricar: ela
modifica qualidade ou XP e não bloqueia o catálogo base.

### Forjaria

1. Obter `steel_ingot`, `aether_fragment` e `monster_core`.
2. Criar `aether_alloy` com `temper_aether_alloy`.
3. Usar a liga nas receitas `forge_aether_sword`, `forge_aether_chest` e
   `forge_aether_helm`.
4. Os equipamentos finais reutilizam os templates oficiais Aetherianos de nível
   10 e continuam sendo instâncias individuais com qualidade própria.

### Couraria

1. Obter `reinforced_leather`, `shadow_thread` e `aether_fragment`.
2. O Fio Sombrio é um drop de assinatura dos Espectros na Cripta Esquecida.
3. Criar `shadow_leather` com `tan_shadow_leather`.
4. Usar o couro nas receitas `craft_shadow_chest`, `craft_shadow_boots` e
   `craft_shadow_hood`.
5. As saídas usam templates próprios com `armorType: "leather"`; Couraria não
   deve voltar a apontar para peças `eg_*` de placa.

## Contratos técnicos

- Dados de receita pertencem somente a `js/data/recipes/RecipeCatalog.js`.
- Templates e fontes de drops de nível 1–10 pertencem a
  `js/data/items/EarlyGameItemCatalog.js`.
- Validação, consumo, geração, qualidade, descoberta e XP pertencem somente a
  `js/items/CraftingSystem.js`.
- `ProfessionWorkshopUI` apenas apresenta dados e envia o comando de craft.
- Todo ingrediente precisa existir em `GameData.items`/`ItemSystem.templates` e
  possuir uma fonte real antes de entrar em uma receita.
- Receitas com material menos óbvio devem declarar `sourceHint`; a Oficina o
  exibe como “Onde conseguir”.
- `CraftingSystem.reconcileDiscoveries()` reaplica o catálogo sobre saves
  existentes. Receita nova com `unlockLevel <= nível atual` deve aparecer sem
  exigir outro rank-up ou um personagem novo.
- O schema permanece 76: foram adicionados dados de catálogo, sem uma nova
  estrutura persistida.

## Cobertura obrigatória

A suíte de integração prova:

- 28 receitas declarativas, incluindo oito receitas Tier 3;
- toda entrada e saída aponta para um template existente;
- toda peça de Couraria possui `armorType: "leather"`;
- `shadow_thread` cai de Espectro e `chipped_claw` possui fonte em feras;
- Tier 3 não é descoberto no nível 9 e é reconciliado no nível 10;
- a Oficina renderiza orientação de fonte;
- o ciclo material bruto → Liga Aetheriana → Espada Aetheriana é transacional.

Ao ampliar para Tier 4+, preserve o mesmo ciclo: fonte alcançável, material
intermediário, resultado distinto, orientação visual e teste de ponta a ponta.
