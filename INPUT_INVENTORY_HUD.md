# Movimento, HUD e Inventário

## Movimento

O `InputManager.js` escuta:

- W: cima
- A: esquerda
- S: baixo
- D: direita

A posição é atualizada por:

```javascript
Aethra.EntityManager.moveEntity("player", x, y);
```

O movimento para automaticamente quando uma janela modal está aberta
ou quando o usuário está digitando em um campo.

## Inventário

O inventário foi dividido em:

- esquerda: mochila com scroll;
- direita: paperdoll e slots de equipamento.

Dê dois cliques em um item equipável para equipá-lo. Clique em um slot
preenchido para remover o equipamento.

## Lojas

- O NPC Shop abre ao clicar no Mercador do mapa.
- A Loja de Diamantes abre pelo botão Cash.
- O Mercado de Players é uma janela separada.

## Sprites

Todos os personagens do mapa usam:

```css
.sprite-entity {
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
}
```
