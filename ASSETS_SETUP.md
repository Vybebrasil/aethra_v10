# Integração dos assets Pixel Crawler

## Estrutura esperada

```text
index.html
assets/
├── icons/
│   ├── sword_iron.png
│   ├── potion_health.png
│   └── wolf_hide.png
└── entities/
    ├── giant_rat.png
    └── forest_wolf.png
```

## Novo item

Adicione o arquivo em `assets/icons/` e informe somente o nome:

```javascript
steel_axe: {
    id: "steel_axe",
    name: "Machado de Aço",
    image: "steel_axe.png",
    type: "weapon",
    damage: 18,
    price: 120
}
```

## Nova criatura

Adicione o arquivo em `assets/entities/`:

```javascript
cave_spider: {
    id: "cave_spider",
    name: "Aranha da Caverna",
    sprite: "cave_spider.png",
    hp: 45,
    damage: 8,
    xp: 7
}
```

## Renderizar uma criatura

```javascript
Aethra.UI_Renderer.renderCreaturePortrait(
    "enemy-portrait",
    "giant_rat"
);
```

HTML correspondente:

```html
<div id="enemy-portrait"></div>
```

## Observação

Os caminhos são relativos ao `index.html`. Portanto, mantenha `assets/`
na mesma pasta do arquivo `index.html`.
