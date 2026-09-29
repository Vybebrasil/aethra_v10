# Fundação visual Aethra UI 2.0

Atualizado em: 2026-08-11

Este contrato define como evoluir a interface sem recriar regras de gameplay,
reintroduzir folhas conflitantes ou distorcer assets pixel art.

## 1. Autoridade

- `RenderEngine` monta o shell e projeta estado; não concede XP, gold, itens ou
  progresso.
- `CombatProjection` é a única fonte visual do combate no mapa 2D.
- `TileMapCanvas` desenha terreno, atores, placas e feedback visual. Ele nunca
  simula combate, loot, ondas, economia ou progressão.
- `WindowManager` mantém uma janela modal exclusiva por vez. A UI 2.0 usa
  `modeless: false` e `draggable: false`; posições antigas não podem voltar a
  ser aplicadas inline.
- Mochila e equipamentos continuam pertencendo a `BagSystem` e `EquipSystem`.

## 2. Folhas de estilo em runtime

`css/aethra-ui-v2.css` é carregado por último e é a autoridade visual do shell,
Cidade, Hunt, ActionBar, janelas e Inventário.

Não reintroduza estas folhas no `index.html` ou em `tests/integration.html`:

- `style-stability.css`
- `ui-fluidity.css`
- `actionbar-workspace.css`
- `hunt-analyzer-workspace.css`
- `combat-hud-modern.css`
- `encounter-combat-hud.css`
- `player-hud-workspace.css`
- `tilemap-canvas.css`
- `hud-modernization.css`
- `aethra-windows.css`

Elas permanecem no repositório apenas como histórico enquanto seus últimos
consumidores são migrados. `style.css` ainda contém regras antigas e deve ser
reduzido por área, com regressão, sem uma remoção global às cegas.

## 3. Layout responsivo

- Acima de 1120 px, a Hunt usa três colunas: Herói, palco e Análise.
- Até 1120 px, as colunas são empilhadas na ordem palco, Herói e Análise, com
  navegação compacta persistente. A pilha deve usar flex vertical; declarar
  `order` em um container `block` não altera a ordem física dos painéis.
- Até 820 px, Cidade e Inventário passam a uma coluna e a navegação superior
  prioriza ícones.
- Até 560 px, janelas usam praticamente toda a largura útil e a ActionBar reduz
  detalhes sem retirar os dez slots.
- A ActionBar reserva espaço no shell da Hunt; nenhuma janela pode ficar atrás
  dela ou da topbar.

Qualquer mudança deve passar em 640x720, 768x720, 1024x768, 1280x720 e
1920x1080.

## 4. Contrato de assets

- Sprites raster nunca recebem largura e altura deformantes ao mesmo tempo.
  Use `object-fit: contain`, preserve a proporção e prefira escala inteira.
- Pixel art usa `image-rendering: pixelated`.
- Ícones de item devem vir do template oficial; fallback por letra/símbolo é
  permitido apenas quando o asset realmente não existe.
- O terreno da Hunt é procedural e determinístico. Não use os antigos
  `FieldsTile_*.png` como grama: esses arquivos são variações de piso laranja.
- Antes de incluir um asset novo, confirme caminho, dimensões naturais, função
  semântica e comportamento em 1x/2x.

## 5. Telas migradas

- Shell superior com identidade e HP/MP persistentes.
- Cidade em grade limitada a quatro colunas, com tracker compacto.
- Central do Herói com identidade, HP/Mana/Vigor e os 11 equipamentos sempre
  visíveis. No desktop, o personagem ocupa uma coluna própria e o equipamento
  usa duas linhas separadas; slot e avatar não podem se sobrepor.
  Atributos é a aba inicial; Itens e Skills continuam interativos. Acima de
  1120 px, cada slot precisa ter pelo menos 24x24 px e permanecer totalmente
  dentro da área do paperdoll.
- Palco de cartas e mapa 2D mutuamente exclusivos.
- Painel de Análise com apenas uma aba visível por vez.
- O conteúdo atual do Analyzer usa `analyzer-ledger-*`; a mochila compacta usa
  `player-backpack-*`. Esses seletores precisam ser estilizados aqui, pois as
  folhas de workspace aposentadas não participam mais do runtime.
- ActionBar fixa com dois ataques primários e dez slots. Acima de 820 px, skills
  equipadas recebem mais largura e slots vazios ficam secundários; até 820 px,
  os dez slots voltam à mesma fração para caber na tela. Slots e botões internos
  precisam manter `scrollWidth <= clientWidth + 1` e
  `scrollHeight <= clientHeight + 1`.
- Fora de uma Hunt, a lateral direita mostra preparação contextual: objetivo
  acompanhado, prontidão, última medição e comandos oficiais. Durante a Hunt,
  ela troca para os seis indicadores rápidos e mantém economia, combate,
  recordes e supplies sob demanda.
- Inventário modal centralizado, mochila legível e paperdoll 3x4 sem
  sobreposição ou scrollbar aninhada.
- Mapa Mundi como overlay bloqueante de viewport inteiro.

## 6. Checklist para novas telas

1. Reutilize tokens `--ui-*` e os componentes existentes.
2. Verifique os seletores reais produzidos pelos renderizadores; não crie CSS
   para markup hipotético.
3. Não use `position: fixed` dentro do conteúdo de uma janela.
4. Não grave dimensões ou coordenadas inline para corrigir responsividade.
5. Garanta estados `hidden`, foco, `aria-pressed` e ações por teclado.
6. Adicione regressão em `js/tests/IntegrationTest.js`.
7. Execute:

   ```text
   node scripts/verify-project.mjs
   node scripts/run-integration.mjs --timeout 90 --viewport 640x720
   node scripts/run-integration.mjs --timeout 90 --viewport 768x720
   node scripts/run-integration.mjs --timeout 90 --viewport 1024x768
   node scripts/run-integration.mjs --timeout 90 --viewport 1280x720
   node scripts/run-integration.mjs --timeout 90 --viewport 1920x1080
   ```

   Rode os viewports em sequência. Execuções paralelas podem disputar o save
   compartilhado de desenvolvimento e produzir falso negativo em economia.

## 7. HUD 3.0 sobre a fundação existente

- `data-hud-generation="3"` identifica as duas projeções recompostas sem criar
  uma segunda autoridade visual.
- `PlayerHudWorkspace` continua projetando o estado oficial, mas o equipamento
  passou a ser um paperdoll verdadeiro com o personagem no centro. Clique,
  duplo clique, tooltip e abertura do Inventário continuam usando os comandos
  oficiais existentes.
- `HuntAnalyzerWorkspace` decide entre preparação e telemetria usando somente
  `hunt.isActive`. O botão principal encaminha `QuestSystem.getGuidance()` para
  `RenderEngine.handleQuestGuidance()`; o render nunca inicia Hunt nem concede
  progresso diretamente.
- `TileMapCanvas` desenha atores em 48 px e adiciona árvores internas, arbustos,
  pedras e variações de vegetação determinísticas. Esses elementos são somente
  decoração e não alteram colisão, encontros ou recompensas.
- A reserva física do mundo usa exatamente `--ui-topbar-h` e
  `--ui-actionbar-h`, inclusive no container legado `#city-view.world-scene`.
  Não volte a usar `--dashboard-actionbar-height` para posicionar a cena.

## 8. Composição HUD 3.1

- Entre 1121 e 1440 px, a topbar remove o resumo duplicado do herói e mantém
  marca, navegação e carteira em três áreas sem colisão. A Hunt reserva no
  mínimo 276 px para a Central, 284 px para o Analyzer e entrega o restante ao
  palco.
- Sprites de personagem podem conter transparência lateral. O paperdoll usa
  `.player-paperdoll-sprite` como viewport de recorte; não volte a reduzir a
  imagem natural inteira, pois isso torna o personagem ilegível.
- Skills equipadas usam cartão horizontal no desktop, com ícone, nome, custo e
  automação dentro do mesmo retângulo. A faixa de controles faz parte da grade
  do slot e não pode criar `row-gap` implícito nem ultrapassar sua borda.
- Até 820 px, os dez slots voltam a frações iguais e mostram somente a leitura
  compacta. Entre desktop e compacto, não misture larguras flexíveis com a
  grade de dez colunas.
- Em desktop com até 760 px de altura, a mochila rápida oculta busca e metadados
  redundantes para priorizar ao menos uma linha de itens. A busca completa
  continua disponível no Inventário.
- As ações da preparação do Analyzer ficam `sticky` dentro da própria rolagem.
  O aviso de save é centralizado sobre o palco e nunca deve cobrir nenhuma das
  laterais.

## 9. Composição HUD 4.0

- O palco é a prioridade espacial. Em 1920 px, Central e Analyzer usam cerca de
  290/303 px e o palco recebe aproximadamente 68% da largura útil. Não volte a
  aumentar as laterais para preencher espaço vazio.
- O resumo permanente da Central contém somente identidade, localização,
  HP/Mana/Vigor, paperdoll e três indicadores de jornada. Dano, defesa,
  precisão e crítico pertencem à aba Atributos e não devem ser duplicados.
- A ordem oficial das abas é `Atributos -> Itens -> Skills`. A migração
  `playerHudCompositionVersion` escolhe Atributos uma única vez, preservando a
  escolha do jogador depois disso.
- Fora de uma Hunt, `#hunt-panel-analysis.is-preparing` recolhe o Log de Combate
  e os quatro contadores de sessão vazios. O painel exibe rota recomendada,
  objetivo, prontidão, última expedição e ações oficiais.
- A ActionBar desktop tem no máximo 1540 px e fica centralizada. Cinco skills
  equipadas dominam a leitura; slots vazios permanecem clicáveis, mas visuais
  secundários. Em telas compactas, continua valendo a grade uniforme de dez
  slots.
- O aviso de save passou para o topo do palco e o registro da expedição foi
  reduzido. Ambos são transitórios e não podem cobrir personagem, objetivo ou
  Analyzer.
- As regressões medem proporção do palco, remoção de telemetria ociosa,
  centralização da ActionBar, ordem das abas e ausência de atributos duplicados.
- Em desktop com até 760 px de altura CSS, o resumo permanente cai para 270 px
  e a aba de Atributos passa a usar a rolagem da workspace. O painel ativo não
  pode voltar a `overflow: hidden`, pois isso desenha os últimos atributos atrás
  da ActionBar. Nessa altura, a última expedição fica oculta no Analyzer.

## 10. HUD 5 — legibilidade antes de densidade

- `css/aethra-hud-v5.css` é uma camada final e isolada para a tela de Hunt em
  desktop. Não acrescente novos overrides de composição no fim de
  `aethra-ui-v2.css`; a fundação continua ali, mas o cockpit final pertence à
  HUD 5.
- Entre 1121 e 1440 px, o contrato de largura é 292 px para o Herói, 306 px
  para Expedição e o restante para o palco. Abaixo de 1240 px, as laterais
  reduzem para 276/286 px. Acima de 1440 px, usam 336/360 px.
- Atributos são uma lista de uma coluna. Nome, valor e efeito precisam caber sem
  abreviação; o painel usa sua própria rolagem e nunca pinta conteúdo atrás da
  Action Bar.
- O paperdoll permanece fixo, mas não orbita mais o avatar. O personagem ocupa
  a primeira coluna e os onze slots usam seis colunas por duas linhas. A
  regressão compara todos os retângulos e rejeita qualquer colisão entre slots
  ou com o personagem.
- A área de Habilidades usa filtro, organização de foco e busca na mesma linha.
  Cada ficha mostra nível, XP, foco, pausa de XP, política de coleta e atalhos
  de profissão com altura real; nenhum comando pode ser desenhado fora da ficha.
- Fora de Hunt, Expedição mostra rota, objetivo e quatro sinais de prontidão na
  mesma tela. A última sessão continua oculta em desktop baixo.
- A Action Bar mostra o nome da barra acima dos slots, limita cada habilidade
  preenchida a 210 px e reduz vazios a alvos tracejados de até 36 px. Com poucas
  habilidades, o conjunto fica centralizado em vez de esticar três cartões por
  toda a largura.
- `TileMapCanvas` desenha atores com 64 px. O aumento é apenas visual e não muda
  coordenadas, colisão ou autoridade de combate. O marcador ocioso escala com
  o palco e informa onde escolher a rota.
- `playerHudCompositionVersion = 5` aplica a nova composição uma única vez. Em
  monitores a partir de 1600 px, o resumo do herói volta ao topo para aproveitar
  o espaço sem competir com a navegação.
- A HUD 5 só atua a partir de 1121 px. Os contratos compactos anteriores
  continuam responsáveis por 1024, 768 e 640 px.
