# Sistema de Entidades

## Entidades iniciais

```javascript
{
    id: "player",
    name: "Aventureiro",
    sprite_url: "assets/entities/player_idle.png",
    x: 100,
    y: 100
}

{
    id: "merchant",
    name: "Mercador",
    sprite_url: "assets/entities/npc_idle.png",
    x: 200,
    y: 150
}
```

## Adicionar

```javascript
Aethra.EntityManager.addEntity({
    id: "guard_01",
    name: "Guarda",
    sprite_url: "assets/entities/skeleton_guard.png",
    x: 340,
    y: 220,
    type: "npc"
});
```

## Mover

```javascript
Aethra.EntityManager.moveEntity("player", 180, 240);
```

## Remover

```javascript
Aethra.EntityManager.removeEntity("guard_01");
```

As coordenadas são pixels medidos a partir do canto superior esquerdo do
`#world-layer`.

O arquivo `player_idle.png` foi extraído do primeiro frame do Rogue Idle.
O arquivo `npc_idle.png` foi extraído do primeiro frame de Peasant_A Idle.
O corpo base disponível em `Characters/Body_A` não possui roupas, por isso
o Rogue foi usado como personagem visual inicial.
