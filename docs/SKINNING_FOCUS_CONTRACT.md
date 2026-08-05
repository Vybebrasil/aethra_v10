# Contrato vertical de foco — Esfolamento

Atualizado em: 2026-08-05

Este contrato conecta a escolha de foco à cadeia criatura → pele → couro tratado
→ equipamento leve. Ele reutiliza a Hunt, o Curtume, as receitas, a mochila e o
XP oficiais; não cria coleta ou crafting paralelos.

## Fluxo do jogador

1. O jogador marca `Esfolamento` como foco no Diário ou na Central do Herói.
2. O `DisciplineSystem` recomenda `Floresta dos Sussurros` e o
   `ProfessionSystem` ativa `focus_training_skinning`.
3. Após derrotar uma criatura esfolável, a Hunt pausa e apresenta `Esfolar` e
   `Ignorar`.
4. `Ignorar` descarta somente aquela oportunidade, retoma a Hunt e preserva a
   quantidade de esfolas garantidas do contrato.
5. `Esfolar` concede XP real de Esfolamento e pelo menos 2 Peles de Fera. Três
   ações manuais fornecem os 6 materiais exigidos no cenário inicial.
6. Na Cidade, o jogador produz 3 Couros Tratados com `tan_beast_hide`.
7. O Curtume destaca Botas, Chapéu e Calças de Couro. Qualquer uma dessas três
   escolhas conclui o contrato.

## Proprietários

- `DisciplineSystem`: seleção do foco e recomendação de atividade.
- `ProfessionSystem`: definição dos quatro objetivos, ferramenta, política e
  garantia de treino.
- `ExplorationSystem`: identifica criaturas esfoláveis, pausa/retoma a Hunt,
  apresenta a decisão e concede XP/recurso pelos donos oficiais.
- `HuntSystem`: único dono da pausa e retomada do loop.
- `QuestSystem`: persistência, dependências e progresso dos objetivos.
- `CraftingSystem`: validação, consumo e criação no Curtume.
- `ProfessionWorkshopUI`: projeção da receita atual e das três escolhas; nunca
  altera a economia diretamente.

## Estado e idempotência

O contrato usa o mesmo `schemaVersion: 78` e `quests.contractVersion: 4` do
ciclo de Mineração. Nenhum campo persistente novo foi necessário: garantias já
possuem `remaining`, `manual`, `guaranteedSuccess` e `minimumQuantity`. Por isso
não há migração de schema neste checkpoint.

Saves que já tinham Esfolamento como foco recebem o contrato pelo fluxo
`quest:ready`. Contratos ativos são retomados sem duplicar faca, missão ou
materiais. Trocar o foco cancela somente a garantia ativa; o progresso da quest
permanece salvo.

## Regressões obrigatórias

- a rota recomendada é `whispering_woods_focus`, liberada no nível 1;
- uma criatura elegível cria um evento manual `creature-harvest`;
- `Ignorar` não reduz `remaining` e retoma a Hunt;
- três esfolas determinísticas concedem 6 peles e XP;
- a primeira ação conserva o XP mesmo quando ela também descobre a skill;
- três lotes de `tan_beast_hide` liberam a escolha final;
- somente Botas, Chapéu e Calças são destacadas pelo contrato inicial;
- uma escolha válida conclui `focus_training_skinning`;
- a UI não adiciona/remove itens nem concede XP diretamente.
