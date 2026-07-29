# Handoff de desenvolvimento — HUD, automação, skills e crafting

Atualizado em: 2026-07-29
Branch de continuidade: `main`  
Baseline recebida antes deste ciclo: `f356719`

Este documento é o ponto de entrada para continuar a versão atual. Leia-o antes
de alterar HUD, automação de hunt, progressão, profissões, coleta, crafting ou
save. O objetivo é preservar um único proprietário por regra e impedir sistemas
paralelos que leem e escrevem o mesmo estado.

## 1. Estado entregue neste checkpoint

- HUD principal modernizada e responsiva, validada em 1280x720 e 1920x1080.
- Resumo do herói, recursos e equipamento permanecem visíveis; mochila, skills e
  build são áreas funcionais, não abas decorativas.
- Action bar e grade de serviços da cidade respondem à largura disponível.
- Gerenciador de supplies permite seleção, quantidade, estoque-alvo, compra
  manual e reposição automática.
- Toda skill começa no nível 1 e não possui nível máximo.
- O jogador pode travar ou liberar ganho de XP por skill sem perder o direito de
  usar a atividade, descobrir a skill ou produzir itens.
- Ofício inicial direciona introdução, missão e ferramenta. Não concede nível ou
  XP gratuito.
- Missões usam contrato único (`title`, `objectives[].id/type/target/label/required`
  e `reward`). A criação de personagem não pode redefinir missões do `GameData`.
- A jornada rastreada aparece na cidade e na Hunt, mostra objetivo, progresso e
  um comando funcional para o próximo passo (mapa, cidade, oficina ou detalhes).
- Saves com missões antigas ou malformadas são reparados preservando progresso;
  recompensas de missão são entregues uma única vez.
- Mineração, esfola e herbalismo possuem política explícita de participação.
- Primeiro ciclo completo de produção implementado:
  - minério de ferro -> lingote refinado -> espada/peitoral de ferro;
  - couro bruto -> couro tratado -> peitoral/botas de couro.
- Oficina de profissão permite escolher receita, técnica e de 1 a 20 lotes.
- `WindowManager` distingue cena, janela flutuante e overlay bloqueante. O Mapa
  Mundi ocupa o viewport, fica acima de toda a HUD e captura o ponteiro; janelas
  comuns respeitam topbar e ActionBar sem ficarem cortadas.
- Requisitos de arma das técnicas consultam `EquipSystem.getEquipped(slot)` e os
  campos oficiais `weaponFamily`/`weaponType`. A Espada de Recruta libera
  `precise_strike` desde a criação.
- Retratos HTML usam sprites individuais de `assets/entities`; spritesheets de
  animação 384x128 não podem ser renderizadas diretamente em `<img>`.
- O runner headless tem timeout por comando, watchdog global, diagnóstico de
  console e viewport configurável. Ele deve sempre encerrar com exit code 0/1.

## 2. Autoridade de cada domínio

| Área | Proprietário | Estado autoritativo | Consumidores principais | Não fazer |
|---|---|---|---|---|
| XP e nível de skills | `js/progression/XPSystem.js` | `GameState.hero.disciplines` | HUD, profissões, crafting | Somar XP diretamente na HUD ou em sistemas de coleta |
| Definições de disciplinas | `js/progression/DisciplineSystem.js` | catálogo + projeção em `hero.disciplines` | XP, HUD, combate | Criar outro catálogo de skills com níveis próprios |
| Ações, ferramentas e políticas de profissão | `js/progression/ProfessionSystem.js` | `hero.disciplines` | Hunt, exploração, oficina | Tratar `GameState.professions` como segunda autoridade |
| **Dados declarativos de receitas** | **`js/data/recipes/RecipeCatalog.js`** | **catálogo imutável em memória** | **CraftingSystem** | **Adicionar lógica de gameplay ou estado de gameplay aqui** |
| Fabricação, descoberta e estado de receitas | `js/items/CraftingSystem.js` | receitas ativas + `GameState.crafting.discovered` | `ProfessionWorkshopUI` | Consumir material ou gerar item diretamente na UI |
| Itens e inventário | `ItemSystem` e `BagSystem` | `GameState.hero.bag` | loot, crafting, HUD | Usar `bag.push`, objetos crus ou IDs inventados fora do catálogo |
| Loot, venda e reposição de supplies | `js/economy/IdleLoopSystem.js` | configuração do idle loop | modal de supplies, hunt | Reimplementar compra automática em componentes visuais |
| Missões, progresso, rastreamento e recompensa | `js/progression/QuestSystem.js` | `GameState.quests` + definições de `GameData.quests` | `RenderEngine`, profissão, hunt | Registrar a mesma missão na UI, comparar ID de monstro sem normalização ou conceder recompensa no render |
| Janelas | `js/ui/WindowManager.js` | registro, papel (`world`/`floating`/`overlay`) e estado | `UIStabilityPass` e todas as HUDs | Criar overlay solto ou calcular outra área segura fora do manager |
| Geometria final de janelas | `js/ui/UIStabilityPass.js` + `css/aethra-windows.css` | offsets seguros do `WindowManager` e apresentação CSS | janelas registradas | Gravar tamanho/posição de overlay em outro pass |
| Sprites de personagem | `js/world/SpriteLoader.js` | manifesto e normalização de fonte | `RenderEngine`, criação e HUD do herói | Usar spritesheet de animação bruto em `<img>` |
| Requisitos de técnicas | `js/combat/SkillSystem.js` | catálogo e validação da técnica | ActionBar e combate | Consultar equipamento por API inventada ou duplicar família da arma na UI |
| Oficina visual | `js/ui/ProfessionWorkshopUI.js` | somente estado efêmero de seleção | `CraftingSystem` | Alterar XP, materiais ou inventário durante `render()` |
| Modernização visual | `js/ui/HudModernization.js` + CSS | somente apresentação | HUD existente | Introduzir regra de gameplay ou novo estado de domínio |
| Persistência e migração | `js/infrastructure/SaveManager.js` | save atual | todos os sistemas | Trocar chave/schema sem migração explícita |

`GameState.hero.disciplines` é a fonte de verdade. `GameState.professions` existe
apenas como projeção de compatibilidade para código legado. Toda concessão de XP
de skill deve passar por `XPSystem.grantSkillXP(...)`.

## 3. Regras de progressão que devem ser preservadas

- Skills começam em nível 1 e crescem indefinidamente.
- `XPSystem.getSkillXPRequired(level)` usa curva polinomial crescente.
- `XPSystem.getDiminishingSkillBonus(level, options)` oferece retorno marginal
  decrescente, sem teto artificial de benefício.
- Conteúdo muito abaixo do nível do jogador continua possível, mas concede XP
  progressivamente menor pelo multiplicador de desafio.
- `trainingMode: "locked"` bloqueia somente o XP. A ação ainda pode acontecer e
  seus recursos/itens continuam válidos.
- A primeira ação válida descobre a skill; a escolha de ofício na criação do
  personagem não pula esse processo.
- Alquimia está deliberadamente bloqueada neste checkpoint.

Políticas de coleta são opt-in/opt-out. Hunt e exploração consultam o
`ProfessionSystem`; não devem decidir por conta própria se mineração, esfola ou
herbalismo está ativa. A hunt aplica um atraso próprio de atividade e emite
`hunt:profession-delay` quando uma ação profissional ocupa tempo.

## 4. Contrato de crafting

`CraftingSystem` é o único proprietário de receitas, validação, consumo de
materiais, criação de resultados, qualidade e XP de fabricação.

- Técnicas atuais: `balanced`, `economical` e `masterwork`.
- Quantidade aceita: 1 a 20 lotes por comando.
- Estações atuais: forja e curtume na cidade; não estão disponíveis durante hunt.
- Comandos usam `commandId` para rejeitar repetição acidental.
- `ItemSystem.generateItem(...)` cria a instância e `BagSystem.addItem(...)` a
  insere. Materiais são removidos somente por `BagSystem.consumeItem(...)`.
- Não adicione receitas dentro da UI ou do `CraftingSystem`. Amplie somente
  `js/data/recipes/RecipeCatalog.js`; o `CraftingSystem` consome esse catálogo.

## 5. Eventos relevantes

- Skills: `skill:discovered`, `skill:training-mode-changed`,
  `skill:xp-changed`, `skill:xp-rejected`, `discipline:xp-changed` e
  `discipline:level-up`.
- Profissões: `profession:policy-changed`, `profession:xpChanged`,
  `profession:xpRejected`, `profession:rankUp` e `profession:updated`.
- Crafting: `crafting:ready`, `crafting:completed`, `crafting:rejected`,
  `crafting:recipe-discovered` (ao descobrir nova receita por nível),
  `crafting:catalog-loaded` (ao carregar o RecipeCatalog).
- Hunt: `hunt:profession-delay`.
- Missões: `QuestAccepted`, `QuestUpdated`, `QuestObjectiveUpdated`,
  `QuestFinished`, `quest:tracking-changed`, `quest:state-repaired` e
  `quest:reward-granted`. `hunt:started` avança objetivos `StartHunt`; IDs de
  criatura passam por `MonsterCatalog.resolveId(...)`.

Eventos servem para projeção e atualização visual. Um consumidor não deve usar
o mesmo evento para aplicar novamente a mutação econômica que o originou.

## 6. Load order e integração

O carregamento precisa respeitar as dependências: catálogo/itens e `BagSystem`
antes dos consumidores; `XPSystem` antes de profissões; `DisciplineSystem`,
`HuntSystem` e `ProfessionSystem` antes de `CraftingSystem`; depois build,
exploração e quests. `js/core/GameLoader.js` já inclui `CraftingSystem` na ordem
correta. Mudar a ordem exige rodar a suíte completa.

O save ativo usa `aethra_save_v71_disciplines` e metadata
`schemaVersion: 74`. A migração v72 → v73 garante `crafting.discovered`
como array; personagens com crafts anteriores recebem as 12 receitas base como
descobertas. A migração v73 → v74 cria o contrato persistido de missões,
`rewardClaims` e marca missões já concluídas como recompensadas; em seguida o
`QuestSystem` repara definições legadas com `contractVersion: 2`. A migração de
profissões usa `hero.professionMigrationVersion: 2`.
Personagens existentes são migrados sem refazer a introdução; personagens novos
ou resetados seguem o novo fluxo.

## 7. Como rodar e verificar

Na raiz do projeto:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Abra:

- jogo: `http://127.0.0.1:8000/index.html`
- integração: `http://127.0.0.1:8000/tests/integration.html`

Quality gate obrigatório:

```powershell
node scripts/verify-project.mjs
node scripts/run-integration.mjs --timeout 90 --viewport 1280x720
node scripts/run-integration.mjs --timeout 90 --viewport 1920x1080
```

Resultado do checkpoint atual antes do commit:

- quality gate: 619/619 verificações;
- integração headless: 137/137 verificações em 1280x720 e 1920x1080;
- navegador real: save existente reparado, títulos/objetivos/recompensas
  renderizados, botão `Escolher expedição` abre o Mapa Mundi e `Detalhes` abre a
  janela oficial de missões;
- clique real validado: `Entrar na expedição` inicia a Hunt, fecha o mapa e não
  abre Skills; console sem erros e nenhuma imagem 404 no fluxo;
- layout verificado em 1280x720 e via runner headless em 1920x1080.

Ao continuar, confirme também console sem erros, rede sem 404, personagem novo e
save migrado. Atualize estes números se a suíte crescer.

## 8. Próximos passos recomendados

1. ~~Migrar receitas para catálogo declarativo e implementar descoberta/desbloqueio.~~ ✅ **Concluído**
2. Criar durabilidade e reparo transacional usando os mesmos donos de item/bag.
3. Adicionar especializações e perks de profissão com retornos decrescentes.
4. Tornar NPCs e estações das missões introdutórias presença interativa no
   mundo/cidade (o rastreador e os comandos de direção já estão concluídos).
5. Levar inventário, moeda, crafting e RNG valioso para backend autoritativo,
   conforme `docs/BACKEND_AUTHORITY_CONTRACT.md`.
6. Ampliar catálogo de receitas com Tier 3 (Mestre) e materiais de dungeon.

Limitações deliberadas: o conteúdo de fabricação ainda cobre somente o primeiro
ciclo de ferro/couro; reparo não foi implementado; não há árvore completa de
especialização; o cliente local ainda não é autoridade segura para economia
competitiva.

## 9. Checklist para não duplicar ou quebrar sistemas

Antes de criar um arquivo ou estado novo:

1. procure o proprietário na tabela acima e no código com `rg`;
2. amplie o proprietário existente em vez de criar uma autoridade paralela;
3. mantenha UI como projeção/comando, sem mutação econômica em `render()`;
4. escreva teste de regressão em `js/tests/IntegrationTest.js`;
5. considere migração de save e idempotência;
6. execute o quality gate e a integração;
7. atualize este handoff quando a autoridade, o contrato ou a dívida mudar.
