# SettingsManager e Modo de Batalha

## Preferência persistente

O arquivo `js/infrastructure/SettingsManager.js` gerencia as preferências do jogador.
A configuração `battleMode` aceita apenas:

- `cards`: layout atual de painéis e cartas.
- `map2d`: placeholder do futuro modo de mapa.

As preferências são salvas em `localStorage` na chave `aethra.settings`. A chave
`aethra.battleMode` também é mantida para compatibilidade.

## Interface

O botão **Opções** abre a janela `options-view`. Os controles de rádio usam o
atributo `data-battle-mode-option` e são sincronizados pelo SettingsManager.

## Renderização

O `RenderEngine` escuta o evento `settings:battle-mode-changed`:

- `cards`: monta o dashboard, as cartas e a ActionBar fixa.
- `map2d`: remove o layout de cartas e mostra “Modo Mapa 2D em desenvolvimento”.

A lógica de combate continua ativa e independente da escolha visual.
