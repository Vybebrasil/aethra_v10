# Hunts Especializadas por Foco

O sistema separa o conteúdo em três formatos:

- **Hunts por foco:** o jogador escolhe a skill/economia que deseja desenvolver.
- **Hunts por criatura:** farm direcionado de um monstro e sua drop table.
- **Expedições:** rotas amplas com várias criaturas, eventos e futura Dungeon solo/grupo.

## Hunts iniciais

| Hunt | Foco | XP de combate | Gold | Eventos | Skills favorecidas |
|---|---|---:|---:|---:|---|
| Ruínas dos Mercadores | Gold | 0,60x | 2,50x | 1,35x | Ladinagem 1,25x |
| Minas Profundas | Mineração/Forjaria | 0,15x | 0,40x | 2,40x | Mineração 2,75x; Forjaria 1,85x |
| Floresta dos Sussurros | Esfolamento/Couro | 0,55x | 0,70x | 0,85x | Couraria 2,50x |
| Catacumbas dos Sem-Nome | Ladinagem/Baús | 0,30x | 1,30x | 2,60x | Ladinagem 2,80x |
| Arena de Aethra | XP de combate | 2,50x | 0,18x | 0,04x | Maestria de combate 1,75x |

## Isolamento de XP

O `ProfessionSystem` valida o tipo da ação antes de conceder experiência:

- minerar concede somente Mineração;
- refinar metal concede somente Forjaria;
- esfolar concede somente Couraria;
- coletar ervas concede somente Herbalismo;
- arrombar, desarmar e destravar passagens concedem somente Ladinagem;
- explorar trilhas e investigar segredos concede somente Exploração;
- ataques e habilidades concedem XP de combate, nunca XP de coleta.

Ações incompatíveis emitem `profession:xpRejected` e não alteram a progressão.

## Ladinagem

Eventos exclusivos das Catacumbas:

- Baú trancado;
- Porta secreta;
- Armadilha mecânica.

Cada evento possui nível mínimo, chance de sucesso e recompensa própria. Abaixo do nível exigido, a tentativa falha automaticamente. Eventos ignorados não concedem XP nem loot.

## Integração econômica

O `LootSystem` recebe os modificadores ativos pelo contexto do abate:

- `goldMultiplier`;
- `materialChanceMultiplier`;
- `quantityMultiplier`;
- `rareDropMultiplier` limitado para proteger a economia rara.

Os multiplicadores de materiais não afetam jackpots dracônicos, drops lendários ou itens protegidos pela economia global.
