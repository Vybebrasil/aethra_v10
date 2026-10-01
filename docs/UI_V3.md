# UI 3.0 — "Ferro e Ouro"

Contrato da nova interface. Leia antes de mexer em qualquer tela.

Protótipo aprovado (29/09/2026): canvas "Aethra UI 3.0" —
https://claude.ai/artifact/Tt5X2Z9x67Nb678jSrKYhP (pranchas Hunt, Mochila,
Antes e Sistema visual).

## Por que uma raiz nova

A UI clássica acumulou 13 folhas de CSS, ~3.800 `!important` e 35
sobrescritas de métodos do `RenderEngine`. Cada rodada de ajustes (HUD 3.0 →
5.2 → v6) adicionou mais uma camada por cima da anterior. Uma folha nova sem
`!important` perderia qualquer disputa com esse CSS no mesmo elemento.

Por isso a UI 3.0 vive em `#ui3-root`, fora das camadas clássicas, com classes
próprias. Medido em 29/09: só 9 regras clássicas alcançam essa raiz, todas
inofensivas (`box-sizing`, `font: inherit`, `color: inherit` e o bloco de
movimento reduzido). A galeria de componentes, renderizada dentro do jogo com
todo o CSS clássico carregado, sai idêntica ao protótipo.

## Regras (o quality gate reprova quem violar)

1. Todo seletor de `css/aethra-ui3.css` começa em `#ui3-root` ou `.ui3`.
2. Nenhum `!important` na folha.
3. Nenhuma fonte abaixo de 11px: use os tokens `--ui3-fs-*` (clamp com
   mínimo ≥ 11px) ou px ≥ 11. `em`, `rem` e `%` em `font-size` são recusados.
4. Os módulos de `js/ui3/` não escrevem no `GameState`. Eles leem dados prontos
   e disparam comandos pelos sistemas donos (regra 1 do `AGENTS.md`).
5. Não crie `aethra-ui4.css`, `hud-v7.css` nem folhas "de ajuste". Evolua
   `aethra-ui3.css` e o `Ui3Kit`.

## Peças

| Peça | Arquivo | Papel |
| --- | --- | --- |
| Tokens e componentes | `css/aethra-ui3.css` | Cores, tipografia, espaço e todos os componentes |
| Componentes | `js/ui3/Ui3Kit.js` | Funções puras que devolvem HTML; escapam todo texto |
| Raiz e versão | `js/ui3/Ui3Shell.js` | Cria `#ui3-root`, aplica a versão, cobre camadas clássicas, galeria de dev |
| Barra superior | `js/ui3/Ui3TopBar.js` | Navegação, carteira, menu "Mais", atalhos B/K/M |
| Tela de Hunt | `js/ui3/Ui3HuntScreen.js` | Palco do mapa, herói, alvo, expedição, registro, barra de ações |
| Tela de título | `js/ui3/Ui3TitleScreen.js` | Substitui o lobby: Continuar, Novo herói (com confirmação, via `SaveManager.reset`), interface clássica |
| Criação de personagem | `js/ui3/Ui3CreationScreen.js` | Assume `CharacterCreationUI.show()`: origem, atributos, primeiro ofício, validação e criação |
| Cidade | `js/ui3/Ui3CityScreen.js` | Hub: resumo do herói, 8 serviços, próximo passo da missão e foco |
| Apresentação de item | `js/ui3/Ui3Items.js` | Nome, raridade, ícone, atributos, comparação e durabilidade, para todas as janelas |
| Moldura de janela | `js/ui3/Ui3Window.js` | Diálogo modal, foco, apresentador no WindowManager |
| Mochila e Equipamento | `js/ui3/Ui3BagWindow.js` | Assume `inventory-view`: equipar, desequipar, usar, filtros, comparação |
| Loja | `js/ui3/Ui3ShopWindow.js` | Assume `npc-shop-view`: comprar em quantidade, vender pela cotação, vender todos os drops |
| Mapa-Mundi | `js/ui3/Ui3AtlasWindow.js` | Assume `hunt-world-map-view`: mapa de expedições, caçadas focadas com loot esperado, focos de ofício |
| Missões | `js/ui3/Ui3QuestsWindow.js` | Assume `quests-view`: ativas e concluídas, objetivos, recompensas, acompanhar, ir para o objetivo |
| Oficinas | `js/ui3/Ui3WorkshopWindow.js` | Assume `profession-workshop-view`: receitas por tier, materiais e resultado com ícones, qualidade estimada, manutenção e reparo automático |
| Opções | `js/ui3/Ui3OptionsWindow.js` | Assume `options-view`: interface, velocidade, reduzir animações, salvar, tela inicial, apagar save com confirmação |
| Mural de Chefes | `js/ui3/Ui3BossesWindow.js` | Assume `bosses-view`: recompensa semanal, chefes com requisitos, recarga, técnicas e histórico; desafiar leva à Hunt |
| Especialização | `js/ui3/Ui3SpecializationWindow.js` | Assume `profession-specialization-view`: abas por ofício, efeitos ativos, os dois caminhos com marcos e maestria; a escolha permanente pede confirmação e vai a `ProfessionSystem.chooseSpecialization` |
| Mentora | `js/ui3/Ui3MentorWindow.js` | Assume `profession-mentor-view`: rota inicial, primeira lição, benefício permanente e especialização; encaminha a árvore do ofício e a orientação da missão acompanhada |
| Coliseu | `js/ui3/Ui3ColiseumWindow.js` | Assume `coliseum-view`: perfil da temporada, matchmaking, aposta (bloqueada sem servidor autoritativo), guardiões, ranking global com o herói sempre visível e ranking de relíquias; estado de tela fora do `GameState` |
| Mercado | `js/ui3/Ui3MarketWindow.js` | Assume `player-market-view` no layout da Loja: comprar (busca por item ou vendedor), anunciar com a cotação de `MarketplaceSystem.getListingQuote`, meus anúncios com cancelamento e resgate de saldo |
| Loja de Diamantes | `js/ui3/Ui3PremiumShopWindow.js` | Assume `premium-shop-view` no layout da Loja: vitrine de `MarketplaceSystem.getPremiumCatalog`; diamantes são moeda paga, então comprar pede um segundo clique |
| Social | `js/ui3/Ui3SocialWindow.js` | Assume `social-view`: sessão local, mercador (abre a Loja) e grupo/guilda indicados como indisponíveis offline |
| Automação | `js/ui3/Ui3AutomationWindow.js` | Janela `automation-view`: continuidade, auto-venda e uso automático de poções em combate; cada ajuste vai ao `IdleLoopSystem` na hora. Sem reposição nem compra à distância (decisão de 2026-10-01): suprimento se compra no mercador ou se fabrica |
| Habilidades | `js/ui3/Ui3SkillsWindow.js` | Assume `skills-view`: Progressão (maestrias, foco, treino) e Barra e automação |
| Preferência | `SettingsManager.interfaceVersion` | `"classic"` (padrão) ou `"v3"` |

### APIs de composição usadas pela UI 3.0

Criadas nos módulos donos (regra 9 do `AGENTS.md`), sem sobrescrever métodos:

| API | Dono | Para quê |
| --- | --- | --- |
| `WindowManager.registerPresenter(id, presenter)` | `js/ui/WindowManager.js` | Uma janela nova assume um id clássico; `openWindow`, `closeWindow`, `isOpen`, Esc e exclusividade continuam no WindowManager |
| `HuntAtlas.*` (`startRoute`, `startCreatureHunt`, catálogos) | `js/world/HuntAtlas.js` | Catálogo do mapa e troca de rota, usados pelas duas interfaces |
| `Ui3Shell.holdGame(chave, sim)` + evento `ui3:screens-changed` | `js/ui3/Ui3Shell.js` | Uma tela cheia (título) segura as telas de jogo e as janelas |
| `CharacterCreationUI.registerPresenter(p)` | `js/ui/CharacterCreationUI.js` | Outra interface assume a criação; ao trocar a versão, a camada certa assume |
| `CraftingSystem.estimateQuality(receita, técnica)` | `js/items/CraftingSystem.js` | Faixa de qualidade que o sorteio pode dar (mesma fórmula do `rollQuality`) |
| `BossSystem.getWeeklySnapshot()` | `js/combat/BossSystem.js` | Progresso semanal, se dá para coletar, tempo até o reinício e a recompensa |
| `SkillSystem.placeSkill(tecla, habilidade)` | `js/combat/SkillSystem.js` | Coloca na tecla; se já estiver na barra, troca de lugar (nunca duplica) |
| `MarketplaceSystem.getNpcCatalog` / `getSaleQuote` / `sellToNpc` | `js/market/MarketplaceSystem.js` | Catálogo e preço de venda com as mesmas regras da venda |
| `TileMapCanvas.setStageHost(el)` / `isHosted()` | `js/world/TileMapCanvas.js` | Empresta o único `#tilemap-canvas` a outro palco; `null` devolve ao clássico |
| `TileMapCanvas.setStageInsets({top,right,bottom,left})` | idem | Faixas cobertas por painéis; atores e marcadores ficam na área livre |
| `SkillController.requestManualSkill(id)` | `js/combat/SkillController.js` | Comando do jogador com validação de combate e recarga no dono |
| `SpriteLoader.getCreatureSource(criatura)` | `js/world/SpriteLoader.js` | Mesmo sprite no retrato do alvo e no mapa |

### Fora de `#ui3-root`

A interface clássica saiu na fase 5.3. Fora da raiz da 3.0 ficam só
`js/ui/WindowManager.js` (abre e fecha janelas, Esc, exclusividade; as
janelas são os apresentadores do `Ui3Window`), `js/ui/UIManager.js` (vista
principal Hunt/Cidade), `js/ui/DeathModalUI.js` (tela de derrota, com
`css/death-modal.css`) e `js/ui/SaveStatusBanner.js` (falha de gravação, com
estilo próprio). A página carrega só `css/aethra-base.css`,
`css/aethra-ui3.css` e `css/death-modal.css`; o gate trava essa lista.

Tipografia: Cinzel (títulos) + Barlow (interface), números tabulares. Os tokens
de fonte valem exatamente 11/12/13/14/16/20/28px em 1280px e crescem até
12/13/15/16/19/24/34px em 1920px.

## Desenvolvimento

- `?ui3=galeria` abre a galeria de componentes sobre o jogo.
- A UI 3.0 é a única interface (a escolha da clássica saiu na fase 5.3; preferências antigas de interface são descartadas ao carregar).
- A suíte de testes roda na UI 3.0, como o jogo.
- Uma tela da UI 3.0 é um elemento com `data-ui3-screen` dentro de
  `#ui3-root`; a raiz só aparece quando há uma tela ou a galeria.

### Remoção da clássica (fase 5.3)

Já fora das telas clássicas (5.3a–c e correções):

| O quê | Para onde |
| --- | --- |
| Marcos das disciplinas e projeção do diário | `js/data/progression/DisciplineMilestones.js`, `js/progression/ProgressionJournal.js` |
| Rotas da 3.0 e orientação de missão/foco | `js/ui3/Ui3Navigation.js` (janelas recebem o pedido em `openWindow(id, opções)`) |
| Ofícios, estações e receita pedida pelo contrato | `js/items/CraftingGuidance.js`; receitas iniciais em `CraftingSystem.ensureStarterRecipes` |
| Sessão, pico de DPS e recordes da Hunt | `js/world/HuntAnalyzer.js` |
| Bloqueio por nível, fim da luta, `targetCreatureId` | `HuntSystem.startHunt/stopHunt` (antes injetados pelo `HudWorldMapAndDrops`) |
| Velocidade do combate (1×/2×/4×) | `BattleSystem.applyCombatSpeed` (antes aplicada pelo `EncounterCombatHUD`) |
| Escada entre andares | `HuntSystem.getStairsState` + cartão "Descer escadas" na Hunt 3.0 (antes só a HUD clássica chamava `nextRoom`: a 3.0 parava no primeiro andar) |
| Vista principal Hunt/Cidade | `UIManager` reescrito só com `primaryView`/`setPrimaryView` |
| Registro do loot da expedição (pilhas, ouro, especiais) | `js/world/HuntLootLedger.js` (antes ouvido só pelo `HudWorldMapAndDrops`; a aba de loot da 3.0 dependia dele) |
| Escolha de eventos de exploração | `ExplorationSystem.getEventPreview` + cartão na Hunt 3.0 (antes só na HUD clássica: a 3.0 travava na Mineração do tutorial) |

Antes de apagar arquivos (todos feitos):

1. ~~Automação~~ — feita: `IdleLoopSystem` só regra (`getSupplyOverview`,
   `configureAutoUse`, aviso `idle-loop:updated`); a tela clássica foi para
   `js/ui/IdleLoopControls.js` e a 3.0 tem `Ui3AutomationWindow`
   (`automation-view`, menu Mais e atalho na Hunt).
2. ~~Avisos de save~~ — feitos: `SaveStatusBanner` (falha de gravação)
   injeta o próprio estilo e fica; o save compartilhado na 3.0 é o
   `Ui3SaveStatus` (indicador na carteira + aviso flutuante acima da barra de
   ações), e o `SharedSaveStatus` clássico fica mudo com a 3.0 ligada.
3. **Tela de derrota** — `DeathModalUI` tem CSS próprio (`death-modal.css`) e
   já aparece por cima da 3.0; fica.
4. **TooltipManager** — a 3.0 não usa; sair também do `GameLoader`.
5. ~~Opção "clássica"~~ — removida (Opções, menu Mais, tela inicial,
   `?ui=classic`, `SettingsManager`, `window.AETHRA_INTERFACE_DEFAULT`).
6. ~~Descarregar os módulos clássicos~~ — feito: `index.html` carrega de
   `js/ui/` só `WindowManager`, `UIManager`, `DeathModalUI` e
   `SaveStatusBanner`; testes que mediam a clássica saíram, os de regra
   foram convertidos para a 3.0.
7. ~~CSS e marcação clássicos~~ — fora do `index.html`: a página carrega só
   `aethra-base.css`, `aethra-ui3.css` e `death-modal.css` (o gate trava a
   lista) e o `<body>` só tem `#ui3-root`.
8. ~~Arquivos~~ — apagados 22 módulos de `js/ui/` e 11 folhas de `css/`;
   as regras do gate que liam esses arquivos passaram a ler as peças da 3.0.
   A lista do que o mercador aceita virou `MarketplaceSystem.getSellableItems`.

Decisões de produto em aberto: pontos de habilidade (`XPSystem` dá 1 por
nível, mas nenhuma tela abre a distribuição) e a "Lâmina do Fundador"
(premium com dano 10–14).

### Testar a criação sem mexer no save real

`.claude/launch.json` (fora do repositório) tem a configuração
`aethra-sandbox`: servidor estático na porta 8093, outra origem, então outro
`localStorage` e nenhuma API de save. Um jogador novo cai direto na criação.
Para zerar, limpe o armazenamento a partir de um arquivo estático da mesma
origem (o autosave do jogo regrava o save ao descarregar a página).

### Lobby → tela de título (decisão de 2026-09-30)

O lobby clássico guardava 3 slots direto no `localStorage`, por fora do
`SaveManager`, e ao "Jogar" sobrescrevia o save principal (conflito com o
save compartilhado do servidor). Ele nunca aparecia (fica dentro de
`#game-container`, oculto). A UI 3.0 não o recria: um herói por save,
persistido só pelo `SaveManager`. A tela de título aparece na abertura do
jogo quando a UI 3.0 está ligada e há herói; sem herói, a criação assume.
O `LobbyUI` sai na fase 5.

## Migração por fases (branch `ui-v3`)

| Fase | Escopo | Estado |
| --- | --- | --- |
| 1. Fundação | tokens, componentes, raiz, preferência, regras no gate | concluída |
| 2. Hunt | mapa 2D como palco; barra superior; HUD flutuante: herói, alvo, expedição, registro, barra de ações | concluída |
| 3. Janelas | Mochila/Equipamento, Loja, Habilidades/Automação | concluída |
| 4. Demais telas | Cidade, Missões, Mapa-Mundi, Criação e Tela de título (no lugar do lobby) | concluída |
| 5.1 Padrão e código morto | UI 3.0 como padrão (clássica só por escolha); 19 arquivos que nada carregava e o lobby removidos | concluída |
| 5.2 Janelas restantes | Oficinas, Opções, Mural de Chefes, Especialização, Mentora, Coliseu, Mercado, Loja de Diamantes e Social. Masmorra, Log de combate e Inspeção não têm abertura na UI 3.0 (mortas ou só clássicas) e saem na 5.3 | concluída |
| 5.3 Remoção da clássica | Regras escondidas em telas clássicas foram para os donos, Automação e save compartilhado ganharam versão 3.0, a escolha de interface saiu, e os 22 módulos e 11 folhas clássicos foram apagados (ver "Remoção da clássica") | concluída |

Cada fase termina com a suíte verde, o gate verde e validação em 1280×720 e
1920×1080. Ao substituir uma tela, migre também os testes dela para os
seletores novos; não deixe teste apontando para markup morto.
