# Refinamento de UI/UX — ActionBar e Cartas de Combate

## Implementado

- ActionBar com altura reservada de 122 px e 116 px em telas de até 780 px de altura.
- Slots fixos com ícone, nome, custo, prioridade, estado Auto e controles sem corte.
- TooltipManager global com tooltips de habilidades e atributos.
- Cooldown em tempo real por `requestAnimationFrame`, máscara vertical e contador decimal.
- Bloqueio do botão da skill até o cooldown zerar.
- Feedback animado da última ação executada pelo herói.
- Barra de XP em linha própria, abaixo de Vida e Mana, com valor e percentual exatos.
- Cards com gradientes, divisores e brilho metálico durante combate ativo.
- Compatibilidade preservada com SkillController, prioridades e UIManager.

## Arquivos alterados

- `style.css`
- `index.html`
- `js/core/GameLoader.js`
- `js/combat/BattleSystem.js`
- `js/ui/RenderEngine.js`
- `js/ui/TooltipManager.js` (novo)
