# Loot da Sessão e Itens com IV

## Objetivo

Separar o loot da Hunt em dois fluxos visuais e de dados:

1. **Acumuláveis**: Gold, materiais, recursos e consumíveis stackáveis são agrupados por tipo.
2. **Itens com IV**: armas, armaduras e qualquer item com rolagens individuais são registrados separadamente.

## Acumuláveis

Cada tipo possui uma única linha com:

- nome e ícone;
- quantidade total da sessão;
- número de coletas;
- valor total acumulado;
- horário do último drop.

A lista pode ser ordenada por valor, quantidade ou recência.

## Itens com IV

Cada instância é preservada individualmente com:

- raridade e cor correspondente;
- IV global;
- classificação do roll;
- multiplicador do item;
- atributo individual de maior impacto;
- valor estimado;
- horário do drop.

Filtros disponíveis:

- Todos;
- Equipamentos;
- Raro+.

O botão **Limpar** remove apenas o histórico visual. Os itens permanecem na mochila.

## Regras de classificação

Um item é tratado como acumulável quando é stackável ou não possui identidade de roll. Um item é tratado como especial quando possui slot de equipamento, IV, multiplicador individual, atributos rolados ou afixos.

## Persistência

O estado é mantido em `GameState.ui.lootSession` e reiniciado ao começar uma nova Hunt.
