# Combate em Duas Camadas

## Objetivo

Separar ataques básicos e habilidades para impedir que o Ataque Básico monopolize a fila automática.

## Camada 1: Ataques primários

- **LMB / Mão Principal**: ataque contínuo, gratuito, intervalo base de 1,0 segundo.
- **RMB / Mão Secundária**: ataque alternado com 70% do dano, intervalo base de 1,8 segundo.
- O ataque secundário exige uma arma válida no slot `offhand`.
- Os ataques primários possuem cooldowns independentes e não ocupam slots da ActionBar.
- Clique no card do inimigo para solicitar LMB; clique direito solicita RMB.
- Cada ataque pode ser ligado ou desligado no modo automático.

## Camada 2: Habilidades

A ActionBar agora contém somente habilidades de Mana ou Vigor.

Ordem de decisão:

1. Suporte emergencial, como Cura abaixo do threshold.
2. Comandos manuais colocados na fila.
3. Habilidades automáticas, respeitando a ordem visual e os cooldowns individuais.

O ataque primário continua acontecendo mesmo quando uma habilidade é executada no mesmo tick.

## Migração de saves

- `basic_attack` e `offhand_attack` são removidos automaticamente das ActionBars antigas.
- As habilidades restantes são compactadas sem serem perdidas.
- `heavy_strike` e `fire_bolt` são habilitadas no Auto na migração para demonstrar a nova rotação.
- O estado dos ataques primários é salvo em `hero.primaryAttacks`.

## Arquivos alterados

- `js/combat/SkillSystem.js`
- `js/combat/SkillController.js`
- `js/combat/BattleSystem.js`
- `js/ui/RenderEngine.js`
- `js/ui/TooltipManager.js`
- `style.css`
