# Contrato de foco — Herbalismo, Alquimia e Supplies

Atualizado em: 2026-08-05  
Schema de save: 78, sem migração adicional

## Experiência do jogador

Ao focar Herbalismo, o jogador recebe o `Ciclo do Alquimista` e a rota de nível
1 `Clareira Verdejante`. Os três primeiros canteiros do contrato são garantidos,
mas continuam exigindo uma decisão explícita:

1. `Colher` resolve o evento, concede XP oficial de Herbalismo e pelo menos duas
   Ervas Silvestres;
2. `Ignorar` continua a Hunt sem consumir uma das três oportunidades garantidas;
3. seis ervas liberam o passo de destilação no Laboratório de Alquimia;
4. três lotes de `Destilar Ervas` produzem três Extratos Botânicos;
5. o jogador escolhe uma receita entre Poção de Vida, Poção de Mana e Tônico de
   Vigor. A escolha produz três unidades e conclui o contrato.

Não existe fabricação automática nesse fluxo. O jogador decide se coleta e qual
supply produz. O gerenciador automático de supplies apenas consulta a quantidade
já existente na mochila e compra a falta conforme a configuração do jogador.

## Autoridade por etapa

| Regra | Proprietário | Estado/evento oficial |
|---|---|---|
| Foco, rota e contrato | `ProfessionSystem` + `DisciplineSystem` | `focus_training_herbalism`, `discipline:focus-changed` |
| Hunt recomendada | `HuntCatalog` | `verdant_grove_focus` |
| Colher/Ignorar, rendimento e XP da coleta | `ExplorationSystem` | `exploration:event-resolved` |
| Progresso dos quatro objetivos | `QuestSystem` | `QuestObjectiveUpdated`, `QuestFinished` |
| Receitas | `RecipeCatalog` | catálogo declarativo |
| Consumo de materiais, criação e XP de Alquimia | `CraftingSystem` | `crafting:completed` |
| Itens e mochila | `ItemSystem` + `BagSystem` | templates e instâncias oficiais |
| Compra e estoque-alvo | `IdleLoopSystem` | `GameState.idleLoop.supplyPlan` |
| Apresentação e comandos | `ProfessionWorkshopUI`, `PlayerHudWorkspace`, `RenderEngine` | sem mutação econômica |

## Objetivos canônicos

- `practice_focus_herbalism`: praticar Herbalismo manualmente na Clareira;
- `collect_focus_herbs`: obter 6 `wild_herb`;
- `distill_focus_extracts`: concluir 3 lotes de `distill_wild_herb`;
- `brew_focus_supply`: concluir uma das receitas permitidas
  (`brew_health_potion`, `brew_mana_potion` ou `brew_vigor_tonic`).

`CraftSupply` valida a receita escolhida pelo `allowedRecipeIds`. Uma receita de
Alquimia fora dessa lista não conclui o objetivo.

## Persistência e compatibilidade

O contrato reutiliza as estruturas genéricas de quest, profissão, crafting e
garantia de treino já existentes no schema 78. Não há campo persistido novo.
Saves existentes recebem as receitas de nível 1 por
`CraftingSystem.reconcileDiscoveries()`; nenhum inventário é recriado ou limpo.

## Regressão obrigatória

`js/tests/IntegrationTest.js` prova:

- ativação do foco, rota e três oportunidades manuais;
- `Ignorar` sem consumo da garantia;
- seis ervas e XP sem duplicação;
- destilação e três opções destacadas no laboratório;
- conclusão por escolha e entrada de três unidades no estoque do `IdleLoopSystem`.

