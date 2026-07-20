# Inteligência final do Inventário

## Estado persistente

```javascript
Aethra.GameState.playerEquipment
```

## Validação booleana

```javascript
Aethra.EquipSystem.canEquip(item, "weapon");
```

A regra é estrita:

```text
WEAPON → weapon
SHIELD/OFFHAND → offhand
HELMET/HEAD → head
ARMOR/CHEST → chest
LEGS/PANTS → legs
BOOTS/FEET → feet
```

## Recalcular o herói

```javascript
Aethra.EquipSystem.updatePlayerStats();
```

## Tooltip

Exemplo:

```text
Dano mínimo: 8 (Base 5 × 1.60x)
Defesa: 13 (Base 8 × 1.65x × 0.98 var.)
```
