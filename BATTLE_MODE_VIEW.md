# Modo de Batalha em Cartas

## Arquitetura

O projeto agora separa explicitamente duas responsabilidades:

- **Core Engine:** combate, inventário, equipamentos, geração de atributos, multiplicadores de item, ActionBar, SkillController, HuntSystem e saves.
- **View Engine:** dashboard visual gerado por `RenderEngine.js`, sem dependência de mapa 2D.

## Layout principal

O `RenderEngine` substitui o conteúdo visual de `#city-view` por:

1. painel de atributos do herói;
2. inventário rápido e resumo dos equipamentos;
3. cartas estáticas de Herói e Inimigo;
4. ActionBar de prioridades;
5. log de combate;
6. resumo da caçada.

Sprites disponíveis em `assets/entities/` são resolvidas como imagens estáticas. Quando uma criatura não possui sprite cadastrada, a carta usa um fallback visual com a inicial do nome.

## ActionBar

A ActionBar principal permite:

- executar uma skill manualmente durante o combate;
- ativar ou desativar `auto`;
- mover a skill para cima ou para baixo na ordem da barra;
- visualizar custo, cooldown, prioridade e threshold de cura.

A decisão do `SkillController` continua seguindo:

1. suporte e cura inteligente;
2. dano automático;
3. comando manual.

## Inventário

O inventário rápido permite selecionar itens, abrir detalhes e equipar itens com duplo clique. A janela completa de inventário permanece disponível e usa os mesmos dados do Core Engine.

## Mapa 2D

`InputManager.js` e `CityScene.js` foram removidos do carregamento do `index.html` e do bootstrap do `GameLoader`. Os arquivos permanecem no projeto para uma futura reativação, mas não participam do Modo de Batalha atual.
