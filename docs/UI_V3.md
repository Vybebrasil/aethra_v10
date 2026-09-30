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
| Apresentação de item | `js/ui3/Ui3Items.js` | Nome, raridade, ícone, atributos, comparação e durabilidade, para todas as janelas |
| Moldura de janela | `js/ui3/Ui3Window.js` | Diálogo modal, foco, apresentador no WindowManager |
| Mochila e Equipamento | `js/ui3/Ui3BagWindow.js` | Assume `inventory-view`: equipar, desequipar, usar, filtros, comparação |
| Loja | `js/ui3/Ui3ShopWindow.js` | Assume `npc-shop-view`: comprar em quantidade, vender pela cotação, vender todos os drops |
| Preferência | `SettingsManager.interfaceVersion` | `"classic"` (padrão) ou `"v3"` |

### APIs de composição usadas pela UI 3.0

Criadas nos módulos donos (regra 9 do `AGENTS.md`), sem sobrescrever métodos:

| API | Dono | Para quê |
| --- | --- | --- |
| `WindowManager.registerPresenter(id, presenter)` | `js/ui/WindowManager.js` | Uma janela nova assume um id clássico; `openWindow`, `closeWindow`, `isOpen`, Esc e exclusividade continuam no WindowManager |
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
- `?ui=3` ativa a UI 3.0; `?ui=classic` volta (fica salvo nas preferências).
- Uma tela da UI 3.0 é um elemento com `data-ui3-screen` dentro de
  `#ui3-root`; a raiz só aparece quando há uma tela ou a galeria.

## Migração por fases (branch `ui-v3`)

| Fase | Escopo | Estado |
| --- | --- | --- |
| 1. Fundação | tokens, componentes, raiz, preferência, regras no gate | concluída |
| 2. Hunt | mapa 2D como palco; barra superior; HUD flutuante: herói, alvo, expedição, registro, barra de ações | concluída |
| 3. Janelas | Mochila/Equipamento e Loja (feitas), Habilidades/Automação | em andamento |
| 4. Demais telas | Cidade, Mapa-Mundi/Atlas, Missões, Lobby, Criação | pendente |
| 5. Limpeza | remover `style.css` + v2/v5/v6 e o CSS/JS morto; desfazer os monkey-patches | pendente |

Cada fase termina com a suíte verde, o gate verde e validação em 1280×720 e
1920×1080. Ao substituir uma tela, migre também os testes dela para os
seletores novos; não deixe teste apontando para markup morto.
