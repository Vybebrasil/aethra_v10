# Integração entre equipamento e combate

## Dano final

```javascript
const damage = Aethra.BattleSystem.calculateDamage(enemy);
```

Retorna somente o número final.

Para consultar toda a memória do cálculo:

```javascript
const calculation = Aethra.BattleSystem.calculateDamage(
    enemy,
    { details: true }
);
```

Exemplo:

```javascript
{
    amount: 24,
    baseDamage: 15,
    multiplier: 1.65,
    individualMultiplier: 1,
    affixBonus: 0,
    scaledWeaponDamage: 25,
    enemyDefense: 1,
    weaponName: "Espada de Ferro"
}
```

Fórmula:

```text
dano-base da arma
× multiplicador aleatório salvo
× variação individual salva
+ afixo
− defesa do inimigo
```

## Feedback visual

O BattleSystem emite:

```text
BattleFloatingText
```

O UI_Renderer cria o texto dentro de `#world-layer`.

## Log

Exemplo:

```text
Sua Espada de Ferro causou 24 de dano no Lobo da Floresta!
```
