# Contrato vertical de foco — Mineração

Atualizado em: 2026-08-05

Este contrato conecta a escolha de foco à primeira cadeia completa de produção:
Mineração manual → minério → lingote → equipamento escolhido pelo jogador.
Ele não concede nível gratuito, não cria limite máximo de skill e não substitui
os sistemas canônicos de profissão, exploração, quests ou crafting.

## Fluxo do jogador

1. O jogador marca `Mineração` como foco no Diário ou na Central do Herói.
2. O `DisciplineSystem` persiste o foco e pede ao `ProfessionSystem` para ativar
   `focus_training_mining`.
3. O próximo passo aponta para `Galerias do Aprendiz`, Hunt de nível 1.
4. Nos três primeiros veios guiados, o jogador escolhe `Minerar` ou `Ignorar`.
   Ignorar encerra somente aquele encontro e preserva a garantia restante.
5. Cada veio minerado entrega no mínimo 2 Minérios de Ferro e XP real de
   Mineração. Com 6 minérios, o próximo passo muda para a Forja da Cidade.
6. O jogador funde 3 Lingotes de Ferro com `smelt_iron`.
7. A oficina destaca Espada, Machado e Maça de Ferro. Qualquer uma das três
   escolhas conclui o contrato; a UI não escolhe nem fabrica pelo jogador.

## Proprietários e eventos

- `DisciplineSystem`: único dono da seleção de foco e da recomendação seguinte.
- `ProfessionSystem`: define o contrato, prepara ferramenta/política e solicita
  a garantia de treino.
- `QuestSystem`: persiste os quatro objetivos, respeita `dependsOn` e reage a
  `PracticeSkill`, `ItemAcquired`, `CraftRecipe` e `CraftEquipment`.
- `ExplorationSystem`: cria o evento garantido, executa `Minerar`/`Ignorar`,
  concede XP/recurso pelos donos oficiais e controla `remaining`.
- `CraftingSystem`: valida estação/nível/materiais, consome insumos e cria os
  resultados. A oficina apenas renderiza e envia o comando.

Eventos relevantes:

- `discipline:focus-changed`
- `profession:focus-training-activated`
- `exploration:tutorial-guarantee-queued|used|cancelled`
- `exploration:event-found|skipped|resolved`
- `quest:objective-updated|finished`
- `crafting:completed`

## Persistência e idempotência

O save usa `schemaVersion: 78` e `quests.contractVersion: 4`. A migração
normaliza garantias antigas com `remaining`, `manual`, `guaranteedSuccess` e
`minimumQuantity`. Reabrir ou retomar um contrato ativo recalcula apenas o que
falta; não duplica ferramenta, missão, recompensa ou minério.

Ao trocar o foco, a garantia anterior é pausada. Voltar para Mineração retoma o
objetivo persistido. Concluir a coleta cancela qualquer garantia excedente.

## Regressões obrigatórias

- foco ativa a rota e os quatro objetivos na ordem;
- `Ignorar` não reduz `remaining`;
- três veios manuais concedem exatamente o mínimo de 6 minérios no cenário
  determinístico de teste;
- 3 lotes de `smelt_iron` liberam a escolha de equipamento;
- as três receitas válidas aparecem destacadas e uma escolha conclui o contrato;
- UI não chama `BagSystem.addItem/consumeItem` nem altera XP diretamente;
- save v77 migra para v78 preservando política e garantia existente.
