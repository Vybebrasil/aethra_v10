# ActionBar Clarity Pass

## Estados visuais

- Card neutro: habilidade pronta.
- Switch verde: execução automática ligada.
- Card escurecido e contador âmbar: habilidade em cooldown.
- Borda dourada: hover/foco do jogador.

## Ataque Básico

O Ataque Básico agora possui cooldown explícito de 1,0 segundo, alinhado ao tick padrão do BattleSystem. Antes, o cadastro informava cooldown zero, embora a ação só pudesse acontecer uma vez por tick, o que tornava a HUD contraditória.

## Organização dos slots

Cada slot apresenta:

- tecla do atalho;
- prioridade da ActionBar;
- ícone;
- nome da habilidade;
- custo;
- cooldown base;
- condição especial, quando aplicável;
- controles de prioridade e Auto separados do card.
