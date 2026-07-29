# Handoff de desenvolvimento — HUD, automação, skills e crafting

Atualizado em: 2026-07-29
Branch de continuidade: `main`  
Baseline recebida antes deste ciclo: `f356719`
Checkpoint imediatamente anterior: `863641e`

Este documento é o ponto de entrada para continuar a versão atual. Leia-o antes
de alterar HUD, automação de hunt, progressão, profissões, coleta, crafting ou
save. O objetivo é preservar um único proprietário por regra e impedir sistemas
paralelos que leem e escrevem o mesmo estado.

## 1. Estado entregue neste checkpoint

- HUD principal modernizada e responsiva, validada em 1280x720 e 1920x1080.
- A Central do Herói alterna painéis de verdade: elementos com `hidden` não
  ocupam layout, toda troca volta a área rolável ao topo e, em monitores baixos,
  os 11 equipamentos formam uma faixa compacta sem cortar o último slot.
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
- A introdução tem uma sequência única e alcançável: primeiros combates no
  Bosque -> domínio básico da Hunt -> conversa com Mestra Ilyra na Cidade ->
  ramificação pelo ofício escolhido.
- Mestra Ilyra é um NPC oficial do `EntityManager`, aparece no Hub, abre um
  painel funcional com rota, lição, benefício permanente e comando do próximo
  passo. O seed idempotente inclui o NPC também em saves existentes.
- Mapa Mundi marca o destino rastreado com `MISSÃO`; encontros introdutórios
  garantidos exibem `OBJETIVO DE OFÍCIO`; a oficina traz a receita rastreada ao
  topo e a destaca antes de produzir.
- Mineração, Esfolamento e Herbalismo recebem uma primeira oportunidade
  determinística no Bosque; Forjaria recebe 2 minérios de treino e ensina a
  receita `smelt_iron`. A garantia é consumida uma única vez.
- Concluir a rota libera um perk permanente e idempotente: `Olhar de Veio`
  (+5% minério), `Corte Limpo` (+5% couro), `Instinto Botânico` (+8% chance de
  erva extra) ou `Martelo Firme` (+3 qualidade na Forjaria).
- Mineração, Esfolamento, Herbalismo, Forjaria e Couraria agora possuem duas
  especializações de longo prazo. A escolha permanente abre no nível 10, ativa
  novos nós nos níveis 30/60 e continua gerando pulsos de maestria a cada 25
  níveis depois do 60, com retorno marginal decrescente e sem nível máximo.
- Os ramos alteram gameplay real: rendimento/qualidade da coleta, chance de
  erva extra, qualidade de fabricação ou XP de craft. Skills, oficina e Mestra
  Ilyra abrem a mesma árvore funcional; a UI apenas envia o comando ao sistema.
- Missões usam contrato único (`title`, `objectives[].id/type/target/label/required`
  e `reward`). A criação de personagem não pode redefinir missões do `GameData`.
- A jornada rastreada aparece na cidade e na Hunt, mostra objetivo, progresso e
  um comando funcional para o próximo passo (mapa, cidade, oficina ou detalhes).
- Saves com missões antigas ou malformadas são reparados preservando progresso;
  recompensas de missão são entregues uma única vez.
- `QuestSystem.auditReachability()` valida hunts, inimigos, skills, itens,
  fontes de recurso, receitas e encadeamentos para impedir objetivos impossíveis.
- Mineração, esfola e herbalismo possuem política explícita de participação.
- Primeiro ciclo completo de produção implementado:
  - minério de ferro -> lingote refinado -> espada/peitoral de ferro;
  - couro bruto -> couro tratado -> peitoral/botas de couro.
- Primeiro Tier 3 funcional no nível 10:
  - aço + Éter + núcleo -> Liga Aetheriana -> arma/placa Aetheriana;
  - couro reforçado + Fio Sombrio -> Couro Sombrio -> set leve do Véu;
  - Cripta Esquecida fornece o Fio Sombrio e componentes raros, e a Oficina
    explica “Onde conseguir” materiais menos óbvios.
- Couraria agora produz somente templates leves próprios (`armorType: leather`);
  receitas antigas deixaram de gerar peças de placa da Forjaria.
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
| Ações, ferramentas, políticas, perks e especializações de profissão | `js/progression/ProfessionSystem.js` | `hero.disciplines` + `hero.professionPerks` | Hunt, exploração, oficina e árvore visual | Tratar `GameState.professions` como segunda autoridade ou aplicar perk na UI |
| **Dados declarativos de receitas** | **`js/data/recipes/RecipeCatalog.js`** | **catálogo imutável em memória** | **CraftingSystem** | **Adicionar lógica de gameplay ou estado de gameplay aqui** |
| Fabricação, descoberta e estado de receitas | `js/items/CraftingSystem.js` | receitas ativas + `GameState.crafting.discovered` | `ProfessionWorkshopUI` | Consumir material ou gerar item diretamente na UI |
| Itens e inventário | `ItemSystem` e `BagSystem` | `GameState.hero.bag` | loot, crafting, HUD | Usar `bag.push`, objetos crus ou IDs inventados fora do catálogo |
| Loot, venda e reposição de supplies | `js/economy/IdleLoopSystem.js` | configuração do idle loop | modal de supplies, hunt | Reimplementar compra automática em componentes visuais |
| Missões, progresso, rastreamento e recompensa | `js/progression/QuestSystem.js` | `GameState.quests` + definições de `GameData.quests` | `RenderEngine`, profissão, hunt | Registrar a mesma missão na UI, comparar ID de monstro sem normalização ou conceder recompensa no render |
| Eventos e garantia introdutória de recursos | `js/world/ExplorationSystem.js` | `GameState.exploration.tutorialGuarantee` | profissão, Hunt e tracker | Sortear ou conceder recursos introdutórios diretamente na HUD |
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
- `CraftingSystem.reconcileDiscoveries()` deve continuar sendo chamado após o
  catálogo ser carregado para que saves acima do nível de desbloqueio recebam
  receitas novas sem depender de outro rank-up.
- O contrato completo do Tier 3, materiais, fontes e cobertura está em
  `docs/TIER3_PRODUCTION_LOOP.md`.

## 5. Eventos relevantes

- Skills: `skill:discovered`, `skill:training-mode-changed`,
  `skill:xp-changed`, `skill:xp-rejected`, `discipline:xp-changed` e
  `discipline:level-up`.
- Profissões: `profession:policy-changed`, `profession:xpChanged`,
  `profession:xpRejected`, `profession:rankUp`, `profession:updated`,
  `profession:intro-prepared`, `profession:intro-started` e
  `profession:perk-unlocked`, `profession:specialization-chosen` e
  `profession:specialization-rejected`.
- Crafting: `crafting:ready`, `crafting:completed`, `crafting:rejected`,
  `crafting:recipe-discovered` (ao descobrir nova receita por nível),
  `crafting:catalog-loaded` (ao carregar o RecipeCatalog).
- Hunt: `hunt:profession-delay`.
- Exploração introdutória: `exploration:tutorial-guarantee-queued` e
  `exploration:tutorial-guarantee-used`.
- Missões: `QuestAccepted`, `QuestUpdated`, `QuestObjectiveUpdated`,
  `QuestFinished`, `quest:tracking-changed`, `quest:state-repaired` e
  `quest:reward-granted`. `hunt:started` avança objetivos `StartHunt`;
  `EnemyDefeated` também avança `DefeatInHunt`; `crafting:completed` avança
  `CraftRecipe`; recursos da exploração avançam `ItemAcquired`. IDs de criatura
  passam por `MonsterCatalog.resolveId(...)`.

Eventos servem para projeção e atualização visual. Um consumidor não deve usar
o mesmo evento para aplicar novamente a mutação econômica que o originou.

## 6. Load order e integração

O carregamento precisa respeitar as dependências: catálogo/itens e `BagSystem`
antes dos consumidores; `XPSystem` antes de profissões; `DisciplineSystem`,
`HuntSystem` e `ProfessionSystem` antes de `CraftingSystem`; depois build,
exploração e quests. `js/core/GameLoader.js` já inclui `CraftingSystem` na ordem
correta. Mudar a ordem exige rodar a suíte completa.

O save ativo usa `aethra_save_v71_disciplines` e metadata
`schemaVersion: 76`. A migração v72 → v73 garante `crafting.discovered`
como array; personagens com crafts anteriores recebem as 12 receitas base como
descobertas. A migração v73 → v74 cria o contrato persistido de missões,
`rewardClaims` e marca missões já concluídas como recompensadas; em seguida o
`QuestSystem` repara definições legadas. A migração v74 → v75 atualiza para
`contractVersion: 3`, converte a missão genérica de ofício para a rota escolhida
e reconstrói os objetivos canônicos sem carregar progresso incompatível. A
migração v75 → v76 normaliza `hero.professionPerks`, `introPrepared` e
`introProvisioned`; perks de rotas já concluídas são reconciliados sem duplicar
efeitos. A migração de profissões usa `hero.professionMigrationVersion: 2`.
Personagens existentes recebem Ilyra e retomam a ponte de tutorial quando
necessário, sem repetir uma rota já concluída; personagens novos ou resetados
seguem o fluxo completo.

As escolhas de especialização usam IDs `specialization_*` dentro de
`hero.professionPerks`; por isso permanecem no schema 76 e não criam uma segunda
estrutura persistida. O contrato detalhado está em
`docs/PROFESSION_SPECIALIZATIONS.md`.

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

- quality gate: 631/631 verificações;
- integração headless: 155/155 verificações em 1280x720 e 1920x1080;
- as quatro rotas introdutórias foram simuladas até a conclusão; a suíte também
  prova o provisionamento de Forjaria e a fila determinística dos três ofícios
  de coleta;
- navegador real: Hub sem botões cortados, Ilyra e seu painel renderizados,
  botão `Escolher expedição` abre o Mapa Mundi no destino destacado e console
  permanece sem erros;
- clique real validado: `Entrar na expedição` inicia a Hunt, fecha o mapa e não
  abre Skills; console sem erros e nenhuma imagem 404 no fluxo;
- layout verificado no navegador em 1280x720 e 1920x1080, sem overflow
  horizontal e sem erros de console.
- Central verificada no navegador em 1280x720: painel ativo começa dentro da
  área visível, dois painéis inativos têm `display: none`, matriz com 11 slots
  mede 260 px e permanece dentro da coluna; nenhuma imagem quebrada.

Ao continuar, confirme também console sem erros, rede sem 404, personagem novo e
save migrado. Atualize estes números se a suíte crescer.

## 8. Próximos passos recomendados

1. ~~Migrar receitas para catálogo declarativo e implementar descoberta/desbloqueio.~~ ✅ **Concluído**
2. Criar durabilidade e reparo transacional usando os mesmos donos de item/bag.
3. ~~Adicionar o primeiro perk permanente de cada rota de profissão.~~ ✅ **Concluído**
4. ~~Tornar a mentora e as estações introdutórias presença interativa e guiada
   na Cidade.~~ ✅ **Concluído**
5. ~~Criar o primeiro Tier 3 de Forjaria/Couraria com fontes, materiais
   intermediários, equipamentos distintos e reconciliação de saves.~~ ✅ **Concluído**
6. Levar inventário, moeda, crafting e RNG valioso para backend autoritativo,
   conforme `docs/BACKEND_AUTHORITY_CONTRACT.md`.
7. Ampliar o catálogo para Tier 4+ e novos materiais de dungeon preservando o
   contrato de fonte → processamento → equipamento.
8. ~~Criar árvores de especialização de longo prazo para cada profissão usando
   `hero.professionPerks`, sem introduzir limite máximo de nível.~~ ✅ **Concluído
   para Mineração, Esfolamento, Herbalismo, Forjaria e Couraria**

Limitações deliberadas: o conteúdo de fabricação cobre Forjaria e Couraria até
o primeiro Tier 3; reparo não foi implementado; profissões de mundo e utilidade
ainda não possuem árvores próprias; troca de especialização não foi liberada;
o cliente local ainda não é autoridade segura para economia competitiva.

## 9. Checklist para não duplicar ou quebrar sistemas

Antes de criar um arquivo ou estado novo:

1. procure o proprietário na tabela acima e no código com `rg`;
2. amplie o proprietário existente em vez de criar uma autoridade paralela;
3. mantenha UI como projeção/comando, sem mutação econômica em `render()`;
4. escreva teste de regressão em `js/tests/IntegrationTest.js`;
5. considere migração de save e idempotência;
6. execute o quality gate e a integração;
7. atualize este handoff quando a autoridade, o contrato ou a dívida mudar.
