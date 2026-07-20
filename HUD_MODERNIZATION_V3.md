# HUD Modernization V3

## Objetivo

Modernizar toda a HUD do modo de batalha sem aumentar a densidade visual nem quebrar o layout de tela única.

## Alterações principais

- Atributos exibem valor bruto e impacto atual no personagem.
- Tooltips explicam função, efeito atual e fórmula usada.
- Vida, Mana e Experiência receberam cards compactos com progresso e contexto.
- Equipamentos rápidos mostram orientação de uso e detalhes ao passar o mouse.
- Cards de Herói e Inimigo receberam métricas contextuais de combate.
- Hunt Analyzer agora explica cada métrica e respectivo cálculo.
- ActionBar, navegação, moedas e log receberam ajuda contextual.
- TooltipManager foi movido para uma camada de UI visível, evitando tooltips ocultos pelo sistema de layers.

## Atributos explicados

- Força: aumenta a base de dano físico.
- Magia: aumenta cura e efeitos mágicos escaláveis.
- Precisão: aumenta a chance de acertar ataques.
- Defesa: reduz o dano físico recebido.
- Crítico: define chance e multiplicador de acertos críticos.
- Esquiva: define a chance de evitar completamente um golpe.

## Validação

- Testado em viewport 1366 × 768.
- Sem scroll vertical ou horizontal.
- ActionBar ancorada na base.
- Seis atributos e três recursos exibidos sem sobreposição.
- Tooltips renderizados sobre a camada modal.
- Todos os arquivos JavaScript passaram em `node --check`.
- Estrutura CSS com chaves balanceadas.
