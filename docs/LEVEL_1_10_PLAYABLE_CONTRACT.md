# Contrato jogável — níveis 1 a 10

Este documento define o primeiro capítulo completo de Aethra. O objetivo é que
um personagem novo sempre saiba onde ir, tenha conteúdo suficiente para evoluir
e encerre a faixa derrotando um chefe real no nível 10.

## Jornada oficial

| Etapa | Requisito | Objetivo | Destino | Recompensa principal |
| --- | ---: | --- | --- | --- |
| Primeiros Passos | 1 | iniciar o Bosque e derrotar 3 criaturas | Bosque dos Sussurros | 50 XP, 50 G, 3 Poções de Vida |
| Conheça sua Rota | 1 | derrotar mais 5 criaturas | Bosque dos Sussurros | 100 XP, 100 G, Anel Recruta |
| Mestra dos Ofícios | 1 | conversar com Ilyra | Hub da Cidade | 25 XP, 25 G |
| Ofício inicial | 1 | descobrir a atividade escolhida na criação | Hunt ou oficina indicada | 75 XP, 40 G e benefício permanente |
| Chamado da Fronteira | 1–5 | derrotar 12 criaturas e alcançar o nível 5 | Bosque dos Sussurros | 75 XP, 100 G e supplies |
| A Linha Goblin | 5–10 | iniciar a Hunt, derrotar 20 inimigos e alcançar o nível 10 | Fronteira Goblin | 100 XP, 150 G e supplies |
| O Alfa dos Sussurros | 10 | derrotar o Lobo Alfa | Mural de Chefes | 250 XP, 250 G e Colar de Prata do Alfa |

As missões de capítulo são `chapter_one_forest_guard`,
`chapter_one_goblin_frontier` e `chapter_one_alpha_wolf`. Toda missão de ofício
inicial aponta para a primeira delas. Saves antigos que já concluíram uma rota
de ofício, mas ainda não possuem o capítulo, são reconciliados por
`QuestSystem.reconcileChapterOne()` sem repetir recompensa.

## Ritmo esperado

- O nível 10 exige 921 XP acumulados.
- Uma criatura do Bosque rende em média 5,74 XP; uma volta completa com 39
  criaturas rende aproximadamente 224 XP.
- Uma criatura da Fronteira Goblin rende em média 10,85 XP; uma volta completa
  rende aproximadamente 423 XP.
- As recompensas guiadas antes do chefe somam 425 XP. Com os abates obrigatórios,
  o jogador chega ao nível 5 ao concluir a etapa do Bosque e precisa de cerca de
  30 abates na Fronteira Goblin para chegar ao nível 10. A variação vem da
  composição aleatória dos encontros e das ações da rota de ofício.

O objetivo `ReachLevel` usa progresso absoluto. Ele é sincronizado ao aceitar a
missão, ao subir de nível e ao carregar um save; níveis já conquistados nunca são
perdidos. `DefeatBoss` escuta o evento oficial `boss:defeated` e também reconhece
histórico persistido.

## Mural de Chefes

O Hub da Cidade expõe `bosses-view` pelo cartão **Mural de Chefes**. O tracker da
missão final abre a mesma janela por `RenderEngine.openBossesHall()`; não existe
uma segunda implementação de chefe.

O Lobo Alfa exige nível 10. `BattleSystem` inclui `bossId` e `isBoss` no evento
`EnemyDefeated`, permitindo que `BossSystem` registre vitória, cooldown e
progresso semanal antes de emitir `boss:defeated`. A missão garante o
`silver_necklace`; o item é um amuleto raro de nível 10 e não é empilhável.

## Autoridade e extensão

- Definições e recompensas: `js/data/GameData.js`.
- Estado, objetivos, encadeamento e reconciliação: `js/progression/QuestSystem.js`.
- Rota criada pelo ofício: `js/progression/ProfessionSystem.js`.
- Catálogo e combate de chefe: `js/combat/BossSystem.js` e
  `js/combat/BattleSystem.js`.
- Janela e orientação: `js/ui/RenderEngine.js` e `js/ui/WindowManager.js`.
- Item final: `js/data/items/EarlyGameItemCatalog.js`.

Novas etapas após o nível 10 devem começar em outra cadeia. Não prolongue estas
três missões, não duplique estado de progresso na UI e não entregue recompensas
fora de `QuestSystem.grantRewards()`.

## Regressão obrigatória

`js/tests/IntegrationTest.js` prova que:

- um save pós-ofício retoma o capítulo;
- Bosque → Fronteira Goblin → Lobo Alfa conclui em ordem;
- o Mural possui apenas um `#boss-list`, abre pelo tracker e habilita o Alfa no
  nível 10;
- o desafio entra no combate oficial, a vitória chega ao `BossSystem` e o Colar
  de Prata é concedido exatamente uma vez;
- itens equipáveis não são consolidados como pilhas.

Execute a matriz descrita em `README.md` antes de publicar mudanças nesta faixa.
