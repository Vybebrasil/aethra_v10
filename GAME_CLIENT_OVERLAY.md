# Aethra — Game Client Overlay

O WindowManager cria automaticamente:

```html
<div id="world-layer"></div>
<div id="hud-layer"></div>
<div id="modal-layer"></div>
```

Ele move:

- `city-view` para `#world-layer`;
- `.topbar`, `.window-tabs` e `.controls` para `#hud-layer`;
- as demais janelas para `#modal-layer`.

Toda janela modal recebe automaticamente um botão `×`.

## Abrir

```javascript
Aethra.WindowManager.openWindow("inventory-view");
Aethra.WindowManager.openWindow("marketplace-view");
```

## Fechar

```javascript
Aethra.WindowManager.closeWindow("inventory-view");
```

Também fecha pelo botão `×`, tecla Escape ou clique no fundo escurecido.

O `index.html` atual não precisa ganhar as três camadas manualmente,
porque o WindowManager cria e organiza a estrutura durante o `init()`.
