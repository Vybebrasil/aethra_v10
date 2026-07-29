# Especializações de profissão

Atualizado em: 2026-07-29

Este documento registra o contrato do primeiro sistema de especializações de
longo prazo. Ele complementa `DEVELOPER_HANDOFF.md`; não cria uma segunda fonte
de verdade.

## Objetivo de gameplay

- Toda skill continua começando no nível 1 e não possui nível máximo.
- Escolher o ofício inicial continua servindo apenas para a missão introdutória.
- No nível 10 de uma profissão de produção, o jogador pode escolher um de dois
  caminhos permanentes para aquele personagem.
- Os nós dos níveis 10, 30 e 60 são ativados automaticamente quando o caminho
  já foi escolhido e o nível exigido foi alcançado.
- Depois do nível 60, a especialização recebe um novo pulso a cada 25 níveis.
  O bônus cresce de forma logarítmica: continua aumentando, mas cada pulso tem
  retorno marginal menor que o anterior.
- Travar o XP da skill continua impedindo apenas XP; não apaga nem desativa a
  especialização já escolhida.

## Autoridade e persistência

`js/progression/ProfessionSystem.js` é o único proprietário de:

- catálogo das árvores;
- requisito de nível;
- exclusividade da escolha;
- cálculo dos nós ativos e da maestria infinita;
- composição dos modificadores finais;
- persistência da escolha.

A escolha é gravada como um perk de raiz em
`GameState.hero.professionPerks[professionId]`. Isso reaproveita o contrato do
save v76 e não exige uma nova versão de schema. Os IDs têm o prefixo
`specialization_`. O `ProfessionSystem.ensureState()` preserva perks
desconhecidos para permitir expansão futura e remove somente uma segunda raiz
de especialização conflitante da mesma profissão.

A interface chama `ProfessionSystem.chooseSpecialization(...)`; ela nunca grava
o array de perks nem aplica bônus diretamente.

## Árvores entregues

| Profissão | Caminho A | Caminho B |
|---|---|---|
| Mineração | Extrator: mais rendimento | Prospector: recursos de maior qualidade |
| Esfolamento | Extrator de Campo: mais rendimento | Curador de Peles: recursos de maior qualidade |
| Herbalismo | Colhedor: mais rendimento | Botânico: chance de erva extra |
| Forjaria | Mestre da Bigorna: qualidade do craft | Ritmo da Forja: mais XP de craft |
| Couraria | Artesão do Couro: qualidade do craft | Ritmo do Curtume: mais XP de craft |

## Consumidores oficiais

- `ExplorationSystem` consulta `getProfessionModifiers()` para quantidade,
  qualidade do minério/couro e chance de erva extra.
- `CraftingSystem` consulta a mesma API para qualidade e XP final do craft.
- `ProfessionWorkshopUI`, `PlayerHudWorkspace`, o painel de Mestra Ilyra e
  `ProfessionSpecializationUI` apenas apresentam o estado e enviam comandos.

Os eventos oficiais são:

- `profession:specialization-chosen`: escolha aceita e persistida;
- `profession:specialization-rejected`: escolha inválida, precoce ou repetida;
- `profession:updated`: projeções devem atualizar depois de uma escolha aceita.

## Como ampliar sem duplicar

1. Adicione os dados no `SPECIALIZATION_TREES` do `ProfessionSystem`.
2. Reuse modificadores já consumidos ou implemente o efeito no proprietário do
   domínio afetado; nunca no componente visual.
3. Se um novo estado persistente além de `professionPerks` for necessário,
   aumente o schema e crie migração explícita no `SaveManager`.
4. Adicione regressão em `IntegrationTest.js` para requisito, exclusividade,
   curva em níveis altos, efeito real e projeção visual.
5. Rode o quality gate e as duas resoluções obrigatórias.

Não implemente respec silencioso. Uma futura troca de caminho precisa ser uma
transação explícita, com custo e regras pertencentes ao `ProfessionSystem`.
