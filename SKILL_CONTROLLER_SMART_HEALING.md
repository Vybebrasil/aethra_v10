# SkillController — Smart Healing e Prioridades

## Ordem por tick

```text
1. Cura automática quando HP < hpThreshold.
2. Primeira skill de dano marcada como Auto.
3. Fila manual ou espera.
```

O `BattleSystem.tick()` calcula o tempo desde o último ciclo e chama:

```javascript
player.skillController.update(deltaTime, context);
```

A instância em execução é anexada ao player como uma propriedade não
serializável. O estado que precisa ser salvo permanece separado em
`player.skillControllerState`.

A verificação de suporte está em:

```javascript
Aethra.SkillController.checkSupportPriorities(context);
```

## Configuração independente

```javascript
Aethra.SkillController.setHpThreshold(
    "heal",
    50
);
```

Cada skill de cura mantém seu próprio limite em:

```javascript
Aethra.GameState.hero
    .skillControllerState
    .settings[skillId]
    .hpThreshold;
```

## Validação de mana

`SkillController.executeSkill()` verifica a mana antes de encaminhar a
execução ao `SkillSystem`:

```javascript
player.mana >= skill.manaCost;
```

Na estrutura atual, `player.stats.mana` e `skill.cost.amount` são usados como
fallbacks compatíveis. Quando a mana é insuficiente, a skill não consome
recurso, não inicia cooldown e emite `SkillUseFailed`.

## Smart Healing

Nenhuma cura automática é executada quando o herói está em 95% de HP
ou mais, mesmo quando a skill está marcada como Auto.

## Auto

```javascript
Aethra.SkillController.setAuto(
    "heal",
    true
);

Aethra.SkillController.setAuto(
    "basic_attack",
    true
);
```

## Comando manual

```javascript
Aethra.SkillController.queueManualSkill(
    "heavy_strike"
);
```
