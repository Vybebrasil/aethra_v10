# Limpeza da tela principal

Esta revisão mantém visíveis somente:

- `#world-layer`: mapa/background em tela cheia;
- `#hud-layer`: HUD e menu superior;
- `#modal-layer`: a janela modal ativa.

O dashboard antigo, relatório de setup, estado ao vivo, cards de teste e
controles auxiliares foram ocultados por CSS.

Não é necessário alterar o `WindowManager.js`.
