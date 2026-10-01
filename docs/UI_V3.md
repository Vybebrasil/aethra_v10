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
| evento `lobby:exited` | `js/ui/LobbyUI.js` | Avisa quando o lobby sai da tela |

### Convivência com a UI clássica (até a fase 5)

- `#ui3-root` fica em z-index 90: acima do jogo clássico e abaixo de
  `#modal-layer` (100). Mochila, Loja, Habilidades e demais janelas clássicas
  abrem por cima da UI nova até migrarem na fase 3.
- Uma tela declara `data-ui3-covers="world"` ou `"topbar"`; o `Ui3Shell` marca
  as camadas clássicas cobertas como `inert` (sem foco nem clique escondido)
  e desfaz ao sair.
- A barra nova mede a barra clássica (`--ui3-topbar-h`) para a cidade e as
  janelas continuarem alinhadas embaixo dela.
- Os atalhos 1–0 são tratados pela tela de Hunt em captura e bloqueados para
  o atalho clássico (`defaultPrevented`), evitando disparo duplo.
- O lobby é considerado pelo que está na tela, não só por `LobbyUI.active`
  (hoje ele fica ativo dentro de um contêiner oculto).

Tipografia: Cinzel (títulos) + Barlow (interface), números tabulares. Os tokens
de fonte valem exatamente 11/12/13/14/16/20/28px em 1280px e crescem até
12/13/15/16/19/24/34px em 1920px.

## Desenvolvimento

- `?ui3=galeria` abre a galeria de componentes sobre o jogo.
- A UI 3.0 é o padrão. `?ui=classic` (ou "Mais > Interface clássica") escolhe a clássica, e a escolha fica salva; `?ui=3` volta.
- A suíte de testes roda na UI 3.0, como o jogo (`window.AETHRA_INTERFACE_DEFAULT` em `tests/integration.html`); só as verificações de volta à clássica trocam de interface.
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
| Escolha de eventos de exploração | `ExplorationSystem.getEventPreview` + cartão na Hunt 3.0 (antes só na HUD clássica: a 3.0 travava na Mineração do tutorial) |

Ainda falta, antes de apagar arquivos:

1. **Automação** — `IdleLoopSystem` desenha os próprios controles na HUD
   clássica (auto-venda, plano de suprimentos e compra, uso automático de
   poções, continuidade). Separar regra e tela e criar a janela 3.0.
2. **Avisos de save** — `SaveStatusBanner` (falha de gravação) e
   `SharedSaveStatus` (save compartilhado) usam estilos do `aethra-ui-v2.css`.
3. **Tela de derrota** — `DeathModalUI` tem CSS próprio (`death-modal.css`) e
   já aparece por cima da 3.0; fica.
4. **TooltipManager** — a 3.0 não usa; sair também do `GameLoader`.
5. Remover a opção "clássica" (Opções, menu Mais, `?ui=classic`,
   `SettingsManager`), os módulos e o CSS clássicos, e as verificações que
   medem a clássica (`window.AETHRA_INTERFACE_DEFAULT` deixa de existir).

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

### Por que o `style.css` ainda não saiu

Ainda há recursos vivos que só a HUD clássica mostra (Automação e avisos de
save, acima). O CSS sai junto com os módulos, depois deles.

## Migração por fases (branch `ui-v3`)

| Fase | Escopo | Estado |
| --- | --- | --- |
| 1. Fundação | tokens, componentes, raiz, preferência, regras no gate | concluída |
| 2. Hunt | mapa 2D como palco; barra superior; HUD flutuante: herói, alvo, expedição, registro, barra de ações | concluída |
| 3. Janelas | Mochila/Equipamento, Loja, Habilidades/Automação | concluída |
| 4. Demais telas | Cidade, Missões, Mapa-Mundi, Criação e Tela de título (no lugar do lobby) | concluída |
| 5.1 Padrão e código morto | UI 3.0 como padrão (clássica só por escolha); 19 arquivos que nada carregava e o lobby removidos | concluída |
| 5.2 Janelas restantes | Oficinas, Opções, Mural de Chefes, Especialização, Mentora, Coliseu, Mercado, Loja de Diamantes e Social. Masmorra, Log de combate e Inspeção não têm abertura na UI 3.0 (mortas ou só clássicas) e saem na 5.3 | concluída |
| 5.3 Remoção da clássica | Extrações (diário, navegação, oficina, medição da Hunt, regras do HuntSystem), testes na 3.0 e eventos de exploração feitos; faltam Automação, avisos de save e a remoção em si (ver "Remoção da clássica") | em andamento |

Cada fase termina com a suíte verde, o gate verde e validação em 1280×720 e
1920×1080. Ao substituir uma tela, migre também os testes dela para os
seletores novos; não deixe teste apontando para markup morto.
