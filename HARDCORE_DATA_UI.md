# High Play / Hardcore Data UI

## Combat Inspect

As cartas do Herói e do Inimigo agora possuem o comando `INSPECT` e também respondem a hover/foco. O painel detalhado é renderizado sobre a própria carta, sem alterar as dimensões do dashboard.

Métricas exibidas:

- chance de crítico e multiplicador crítico;
- multiplicador de dano da arma/entidade;
- esquiva;
- defesa e estimativa percentual de mitigação;
- chance e redução de bloqueio;
- bônus de atributos em relação aos atributos-base;
- multiplicador e IV dos equipamentos do herói.

## Item IV / Roll

`ItemSystem.getItemInspection(item)` é a fonte única dos dados avançados do item. O método retorna:

- multiplicador global e intervalo possível da raridade;
- IV do multiplicador;
- roll e IV de cada atributo;
- roll dos afixos;
- IV médio da peça;
- atributo individual mais relevante.

Itens gerados também persistem `item.iv` e `item.rollScore`, mantendo cálculo dinâmico para itens de saves antigos.

## Combat Analytics

O `BattleSystem` produz logs matemáticos quando ocorre:

- crítico;
- multiplicador de skill acima de 1x;
- aplicação relevante dos rolls da arma em um ataque bonificado;
- bloqueio.

O cálculo automático de crítico também é usado por skills que chamam `calculateDamage()` sem informar explicitamente `isCrit`.
