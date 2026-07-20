# Dashboard Pro UI

A interface principal foi consolidada em um dashboard de três colunas, travado em `100vh` e sem scroll da página.

## Estrutura

- Navbar única: marca, nove ações de navegação e carteira na mesma linha.
- Coluna esquerda: status do herói, HP/Mana/XP, inventário rápido e equipamentos em grid 2x3.
- Coluna central: cartas de Herói e Inimigo, seletor de hunt e status do combate.
- Coluna direita: Log de Combate e Hunt Analyzer.
- ActionBar: fixa na base, com espaço reservado no viewport e dez slots uniformes.

## Hunt Analyzer

As métricas usam o estado real de `Aethra.GameState.hunt`:

- XP total e XP/h
- Gold coletado e Profit/h
- Kills e tempo médio por kill
- Valor de loot
- Custo de suprimentos
- Lucro líquido

O botão **Resetar Estatísticas** zera apenas as métricas da sessão. Gold já recebido pelo herói e o combate atual não são removidos.

## Arquivos alterados

- `style.css`
- `index.html`
- `js/ui/RenderEngine.js`
- `js/ui/UIManager.js`
- `js/ui/WindowManager.js`
- `js/world/HuntSystem.js`
