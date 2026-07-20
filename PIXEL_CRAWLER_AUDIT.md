# Auditoria do Pixel Crawler — Free Pack 2.11

## Resultado

O arquivo foi aberto e conferido diretamente.

### Estrutura real

```text
Pixel Crawler - Free Pack/
├── Entities/
│   ├── Characters/
│   ├── Mobs/
│   │   ├── Orc Crew/
│   │   └── Skeleton Crew/
│   └── Npc's/
├── Environment/
├── Icons/
├── MockUps/
└── Weapons/
    ├── Bone/
    ├── Hands/
    └── Wood/
```

## Descobertas importantes

- O pacote contém **Orcs e Esqueletos**, mas não contém Rato Gigante nem
  Lobo da Floresta.
- `Icons/Resources.aseprite` não pode ser exibido diretamente pelo
  navegador. Navegadores leem PNG, WebP, SVG etc., mas não `.aseprite`.
- `Weapons/Bone/Bone.png` e `Weapons/Wood/Wood.png` são folhas/atlases
  com vários elementos, e não um arquivo individual por arma.
- As criaturas são spritesheets. Exemplo:
  `Idle-Sheet.png` do Orc possui 128×32 px, ou seja, quatro frames de
  32×32 px.
- Para manter o padrão simples do GameData.js, este projeto gerou PNGs
  individuais em `assets/icons/` e `assets/entities/`.

## Arquivos gerados

```text
assets/icons/sword_iron.png
assets/icons/potion_health.png
assets/icons/wolf_hide.png
assets/entities/orc_scout.png
assets/entities/skeleton_guard.png
```

## Padrão para novos itens

Coloque um PNG individual em `assets/icons/`:

```text
assets/icons/steel_axe.png
```

No GameData.js:

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

## Padrão para novas criaturas

Coloque a imagem individual em `assets/entities/`:

```text
assets/entities/cave_spider.png
```

No GameData.js:

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

## Rato e Lobo

Para ativar as imagens dos monstros já existentes, adicione:

```text
assets/entities/giant_rat.png
assets/entities/forest_wolf.png
```

e altere no GameData.js:

```javascript
sprite: "giant_rat.png"
```

ou:

```javascript
sprite: "forest_wolf.png"
```
