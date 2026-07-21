// IntegrationTest.js - Smoke Test da Aethra Engine
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.EventBus) {
        throw new Error(
            "IntegrationTest.js requer game-core.js carregado antes deste arquivo."
        );
    }

    const REQUIRED_MODULES = [
        "GameState",
        "EventBus",
        "SaveManager",
        "SettingsManager",
        "AuthorityGateway",
        "EconomyRNGManager",
        "MonsterCatalog",
        "HuntCatalog",
        "EarlyGameItemCatalog",
        "WindowManager",
        "TooltipManager",
        "EntityManager",
        "CombatSystem",
        "SkillSystem",
        "DisciplineSystem",
        "SkillController",
        "BattleSystem",
        "CombatProjection",
        "ConsumableSystem",
        "ColiseumSystem",
        "HuntSystem",
        "ItemSystem",
        "LootSystem",
        "ItemRankingSystem",
        "BagSystem",
        "EquipSystem",
        "XPSystem",
        "ProfessionSystem",
        "CharacterBuildSystem",
        "BossSystem",
        "QuestSystem",
        "DungeonSystem",
        "MarketplaceSystem",
        "NpcShopUI",
        "TileMapCanvas",
        "IdleLoopSystem",
        "RenderEngine",
        "UI_Renderer",
        "UIManager",
        "ActionBarWorkspace",
        "HuntAnalyzerWorkspace",
        "CombatHudModernizer",
        "EncounterCombatHUD",
        "PlayerHudWorkspace",
        "CharacterCreationUI",
        "GameLoader"
    ];

    function getReportElements() {
        return {
            root: document.getElementById("integration-test-report"),
            state: document.getElementById("integration-test-state"),
            summary: document.getElementById("integration-test-summary"),
            checks: document.getElementById("integration-test-checks")
        };
    }

    function renderRunningState() {
        const elements = getReportElements();
        if (!elements.root) return;

        elements.root.dataset.testStatus = "running";
        if (elements.state) elements.state.textContent = "Executando";
        if (elements.summary) {
            elements.summary.textContent =
                "Validando módulos, progressão, loot e persistência isolada.";
        }
        if (elements.checks) elements.checks.replaceChildren();
    }

    function renderReport(report) {
        const elements = getReportElements();
        if (!elements.root) return;

        elements.root.dataset.testStatus = report.success ? "passed" : "failed";
        if (elements.state) {
            elements.state.textContent = report.success ? "PASSOU" : "FALHOU";
        }
        if (elements.summary) {
            const passed = report.checks.filter((check) => check.passed).length;
            elements.summary.textContent =
                `${passed}/${report.checks.length} verificações aprovadas em ` +
                `${report.durationMs} ms.`;
        }

        if (!elements.checks) return;
        elements.checks.replaceChildren();

        report.checks.forEach((check) => {
            const item = document.createElement("li");
            item.dataset.passed = String(check.passed);

            const title = document.createElement("strong");
            title.textContent = `${check.passed ? "✓" : "×"} ${check.check}`;
            item.appendChild(title);

            if (check.details) {
                const details = document.createElement("span");
                details.textContent = String(check.details);
                item.appendChild(details);
            }

            elements.checks.appendChild(item);
        });
    }

    function renderEngineFailure(failure = {}) {
        const message = failure.message ||
            failure.error?.message ||
            "A engine não concluiu a inicialização.";
        const report = {
            success: false,
            durationMs: Number(failure.durationMs || 0),
            checks: [createCheck("Inicialização da engine", false, message)]
        };

        renderReport(report);
    }

    function readXP() {
        const hero = Aethra.GameState && Aethra.GameState.hero
            ? Aethra.GameState.hero
            : {};

        return {
            current: Number(hero.xpCurrent || hero.xp || hero.stats?.xp || 0),
            total: Number(hero.xpTotal || hero.stats?.xp || 0),
            level: Number(hero.level || 1)
        };
    }

    function createCheck(name, passed, details = null) {
        return {
            check: name,
            status: passed ? "PASSOU" : "FALHOU",
            passed: Boolean(passed),
            details
        };
    }

    Aethra.IntegrationTest = {
        running: false,
        completed: false,
        lastReport: null,

        run() {
            if (this.running) {
                console.warn("O teste de integração já está em execução.");
                return;
            }

            this.running = true;
            renderRunningState();

            console.log(
                "%c--- INICIANDO TESTE DE INTEGRAÇÃO AETHRA ---",
                "color: #00ff00; font-weight: bold;"
            );

            const checks = [];
            const startedAt = Date.now();
            const xpBefore = readXP();
            const bagBefore = Array.isArray(Aethra.GameState?.hero?.bag)
                ? Aethra.GameState.hero.bag.length
                : 0;

            // 1. Validar Core e módulos.
            checks.push(
                createCheck(
                    "Core/GameState",
                    Boolean(Aethra.GameState),
                    Aethra.GameState ? "GameState disponível" : "GameState ausente"
                )
            );

            REQUIRED_MODULES.forEach((moduleName) => {
                checks.push(
                    createCheck(
                        `Módulo ${moduleName}`,
                        Boolean(Aethra[moduleName]),
                        Aethra[moduleName] ? "Carregado" : "Ausente"
                    )
                );
            });

            const initialCombatProjection = Aethra.CombatProjection?.getSnapshot?.();
            const legacyCombatView = Aethra.CombatSystem?.getSnapshot?.();
            checks.push(
                createCheck(
                    "Combate expõe uma única projeção autoritativa",
                    initialCombatProjection?.source === "BattleSystem"
                        && legacyCombatView?.compatibilityFacade === true,
                    `${initialCombatProjection?.source || "sem autoridade"} · legado ${legacyCombatView?.compatibilityFacade ? "somente leitura" : "independente"}`
                )
            );

            const earlyGameCoverage = Aethra.EarlyGameItemCatalog?.auditCoverage?.();
            const earlyGameSummary = Aethra.EarlyGameItemCatalog?.summary || {};
            checks.push(
                createCheck(
                    "Banco de itens cobre todas as criaturas dos níveis 1–10",
                    earlyGameCoverage?.valid === true
                        && earlyGameCoverage.covered === earlyGameCoverage.creatures
                        && Number(earlyGameSummary.templates || 0) >= 100,
                    `${earlyGameCoverage?.covered || 0}/${earlyGameCoverage?.creatures || 0} criaturas · ${earlyGameSummary.templates || 0} templates`
                )
            );

            const rankedTestItem = Aethra.ItemSystem?.generateItem?.("eg_sword_l10", {
                rarity: "legendary",
                quality: 100,
                potential: 100,
                statMultiplier: 2,
                ownerId: "integration-player",
                ownerName: "Herói de Teste",
                source: "integration-ranking"
            });
            const rankedTestSnapshot = rankedTestItem
                ? Aethra.ItemRankingSystem?.getItemRanking?.(rankedTestItem)
                : null;
            checks.push(
                createCheck(
                    "Ranking vivo classifica cada equipamento individual",
                    Boolean(rankedTestSnapshot?.rank)
                        && rankedTestSnapshot.category === "sword"
                        && Number(rankedTestSnapshot.score) > 0,
                    rankedTestSnapshot
                        ? `${rankedTestSnapshot.rankLabel} em ${rankedTestSnapshot.categoryLabel} · ${rankedTestSnapshot.score} poder`
                        : "item sem classificação"
                )
            );
            if (rankedTestItem?.instanceId) {
                Aethra.ItemRankingSystem?.removeItem?.(rankedTestItem.instanceId, "integration-cleanup");
            }

            const coliseumSnapshot = Aethra.ColiseumSystem?.getSnapshot?.();
            const strongerExpectedScore = Aethra.ColiseumSystem?.expectedScore?.(
                { rating: 1000, combatPower: 400 },
                { rating: 1000, combatPower: 800 }
            );
            checks.push(
                createCheck(
                    "Coliseu mantém ladder global e poder completo separados",
                    Boolean(coliseumSnapshot?.player?.globalRank)
                        && Number(coliseumSnapshot?.profile?.rating) === 1000
                        && Number(coliseumSnapshot?.profile?.combatPower) > 0
                        && Number(strongerExpectedScore) < 0.5,
                    `#${coliseumSnapshot?.player?.globalRank || 0} · ${coliseumSnapshot?.profile?.rating || 0} RP · ${coliseumSnapshot?.profile?.combatPower || 0} poder`
                )
            );
            const localWagerGate = Aethra.ColiseumSystem?.createWager?.("integration-nonexistent-item");
            checks.push(
                createCheck(
                    "Cliente local não possui autoridade sobre apostas",
                    coliseumSnapshot?.authority?.serverAuthoritative === false
                        && coliseumSnapshot?.authority?.competitive === false
                        && localWagerGate?.reason === "SERVER_AUTHORITY_REQUIRED",
                    `${coliseumSnapshot?.authority?.mode || "sem gateway"} · ${localWagerGate?.reason || "sem bloqueio"}`
                )
            );

            const previousQueue = JSON.parse(JSON.stringify(Aethra.GameState.coliseum?.queue || null));
            const matchSearch = Aethra.ColiseumSystem?.findMatch?.({ mode: "ranked" });
            const matchRatio = matchSearch?.opponent
                ? Number(matchSearch.opponent.combatPower) / Math.max(1, Number(coliseumSnapshot?.profile?.combatPower || 1))
                : 0;
            checks.push(
                createCheck(
                    "Matchmaking cruza rating e Poder de Combate",
                    Boolean(matchSearch?.opponent)
                        && matchRatio >= Aethra.ColiseumSystem.config.maxPowerRatioMin
                        && matchRatio <= Aethra.ColiseumSystem.config.maxPowerRatioMax,
                    matchSearch?.opponent
                        ? `${matchSearch.opponent.name} · razão de poder ${matchRatio.toFixed(2)}x · busca ${matchSearch.searchStep}`
                        : "nenhum oponente"
                )
            );
            if (Aethra.GameState.coliseum) Aethra.GameState.coliseum.queue = previousQueue;

            console.log("✅ Core/GameState OK");

            const characterPreview = Aethra.CharacterBuildSystem?.previewAttributes?.(
                Aethra.CharacterBuildSystem?.recommendedAttributes
            );
            checks.push(
                createCheck(
                    "Criação do herói com escolhas explicáveis",
                    Boolean(characterPreview)
                        && characterPreview.spent === Aethra.CharacterBuildSystem.attributePoints
                        && characterPreview.stats.maxHp > 0
                        && characterPreview.stats.damageMax >= characterPreview.stats.damageMin,
                    characterPreview
                        ? `${characterPreview.spent} atributos · HP ${characterPreview.stats.maxHp} · dano ${characterPreview.stats.damageMin}–${characterPreview.stats.damageMax}`
                        : "prévia indisponível"
                )
            );
            checks.push(
                createCheck(
                    "Ofício inicial orienta sem conceder níveis",
                    Object.keys(Aethra.CharacterBuildSystem?.masteries || {}).length >= 10
                        && Aethra.CharacterBuildSystem.initialSkillPoints === 0
                        && Object.keys(Aethra.CharacterBuildSystem?.introProfessions || {}).length >= 4,
                    `${Object.keys(Aethra.CharacterBuildSystem?.masteries || {}).length} skills · ${Object.keys(Aethra.CharacterBuildSystem?.introProfessions || {}).length} caminhos · 0 níveis grátis`
                )
            );

            const archetypes = Object.values(Aethra.CharacterBuildSystem?.archetypes || {});
            const archetypeAudits = archetypes.map((entry) => {
                const attributeTotal = Object.values(entry.attributes || {}).reduce((total, value) => total + Number(value || 0), 0);
                const masteryTotal = Object.values(entry.masteries || {}).reduce((total, value) => total + Number(value || 0), 0);
                return {
                    id: entry.id,
                    attributeTotal,
                    masteryTotal,
                    hasStarterItem: Boolean(Aethra.GameData?.items?.[entry.starterItemId])
                };
            });
            const validArchetypePresets = archetypeAudits.every((entry) =>
                entry.attributeTotal === Aethra.CharacterBuildSystem.attributePoints
                && entry.masteryTotal > 0
                && entry.hasStarterItem
            );
            checks.push(
                createCheck(
                    "Arquétipos oferecem cinco fantasias completas",
                    archetypes.length >= 5 && validArchetypePresets,
                    archetypeAudits.map((entry) => `${entry.id}:${entry.attributeTotal}a/${entry.masteryTotal}s/${entry.hasStarterItem ? "item" : "sem item"}`).join(" · ")
                )
            );

            const disciplineIds = ["sword", "axe", "mace", "dagger", "bow", "fire", "ice", "shadow", "restoration"];
            const disciplines = Aethra.DisciplineSystem?.definitions || {};
            checks.push(
                createCheck(
                    "Armas e escolas mágicas possuem progressão própria",
                    disciplineIds.every((id) => Boolean(disciplines[id]))
                        && Object.keys(disciplines).length >= 19,
                    `${Object.keys(disciplines).length} disciplinas · ${disciplineIds.length} assinaturas de combate essenciais`
                )
            );

            const starterSkillIds = ["precise_strike", "brutal_cleave", "armor_breaker", "twin_fang", "aimed_shot", "fire_bolt", "ice_shard", "shadow_bolt"];
            checks.push(
                createCheck(
                    "Cada estilo inicial possui uma técnica real",
                    starterSkillIds.every((id) => Boolean(Aethra.SkillSystem?.skills?.[id])),
                    `${starterSkillIds.filter((id) => Boolean(Aethra.SkillSystem?.skills?.[id])).length}/${starterSkillIds.length} técnicas disponíveis`
                )
            );

            Aethra.DisciplineSystem?.ensureState?.();
            const swordBefore = JSON.parse(JSON.stringify(Aethra.GameState.hero?.disciplines?.sword || {}));
            const useProgress = Aethra.DisciplineSystem?.addUseXP?.("sword", 3, { source: "integration-use" });
            checks.push(
                createCheck(
                    "Disciplinas evoluem ao serem usadas",
                    Number(useProgress?.amount) === 3
                        && useProgress?.accepted === true
                        && Number(useProgress?.state?.uses) === Number(swordBefore.uses || 0) + 1,
                    `+${useProgress?.amount || 0} XP de Espadas em um uso`
                )
            );
            if (Aethra.GameState.hero?.disciplines) Aethra.GameState.hero.disciplines.sword = swordBefore;

            const curveLevels = [1, 10, 100, 500, 1000, 2000];
            const curveCosts = curveLevels.map((level) => Aethra.XPSystem?.getSkillXPRequired?.(level));
            const curveBonuses = curveLevels.map((level) => Aethra.XPSystem?.getDiminishingSkillBonus?.(level));
            checks.push(
                createCheck(
                    "Skills têm curva infinita, crescente e finita",
                    curveCosts.every((cost, index) => Number.isFinite(cost) && cost > 0 && (index === 0 || cost > curveCosts[index - 1]))
                        && curveBonuses.at(-1) > curveBonuses.at(-2),
                    curveLevels.map((level, index) => `NV${level}:${Math.round(curveCosts[index])}XP/+${Number(curveBonuses[index]).toFixed(1)}%`).join(" · ")
                )
            );
            const bonusDelta100 = Aethra.XPSystem.getDiminishingSkillBonus(101) - Aethra.XPSystem.getDiminishingSkillBonus(100);
            const bonusDelta1000 = Aethra.XPSystem.getDiminishingSkillBonus(1001) - Aethra.XPSystem.getDiminishingSkillBonus(1000);
            checks.push(
                createCheck(
                    "Retorno diminui sem criar teto rígido",
                    bonusDelta1000 > 0 && bonusDelta1000 < bonusDelta100,
                    `ganho NV100→101 ${bonusDelta100.toFixed(4)} · NV1000→1001 ${bonusDelta1000.toFixed(4)}`
                )
            );

            const infiniteSwordBackup = JSON.parse(JSON.stringify(Aethra.GameState.hero.disciplines.sword));
            const infiniteSword = Aethra.GameState.hero.disciplines.sword;
            infiniteSword.level = 100;
            infiniteSword.xpNext = Aethra.XPSystem.getSkillXPRequired(100);
            infiniteSword.xpCurrent = infiniteSword.xpNext - 1;
            infiniteSword.trainingMode = "training";
            const beyondOneHundred = Aethra.XPSystem.grantSkillXP("sword", 2, { source: "integration-infinite", difficulty: 100 });
            const xpBeforeLock = Aethra.GameState.hero.disciplines.sword.xpTotal;
            Aethra.XPSystem.setSkillTrainingMode("sword", "locked", "integration");
            const lockedGain = Aethra.XPSystem.grantSkillXP("sword", 20, { source: "integration-locked", difficulty: 101 });
            checks.push(
                createCheck(
                    "Nível 100 não é máximo e o jogador pode travar XP",
                    beyondOneHundred?.accepted === true
                        && Aethra.GameState.hero.disciplines.sword.level === 101
                        && lockedGain?.reason === "training-locked"
                        && Aethra.GameState.hero.disciplines.sword.xpTotal === xpBeforeLock,
                    `nível ${Aethra.GameState.hero.disciplines.sword.level} · bloqueio ${lockedGain?.reason || "falhou"}`
                )
            );
            Aethra.GameState.hero.disciplines.sword = infiniteSwordBackup;

            const fieldBackup = {
                bag: JSON.parse(JSON.stringify(Aethra.GameState.hero.bag || [])),
                policies: JSON.parse(JSON.stringify(Aethra.GameState.professionPolicies || {}))
            };
            Aethra.ProfessionSystem.setCollectionPolicy("mining", true, "integration");
            const withoutTool = Aethra.ProfessionSystem.canPerformFieldAction("mining");
            const testPickaxe = Aethra.ItemSystem.generateItem("apprentice_pickaxe", { quality: 20, potential: 20, source: "integration" });
            Aethra.BagSystem.addItem(testPickaxe, "integration");
            const withTool = Aethra.ProfessionSystem.canPerformFieldAction("mining");
            Aethra.ProfessionSystem.setCollectionPolicy("mining", false, "integration");
            const disabledPolicy = Aethra.ProfessionSystem.canPerformFieldAction("mining");
            checks.push(
                createCheck(
                    "Coleta respeita escolha explícita e ferramenta",
                    withoutTool?.reason === "missing-tool" && withTool?.allowed === true && disabledPolicy?.reason === "policy-disabled",
                    `sem ferramenta: ${withoutTool?.reason} · equipada: ${withTool?.allowed} · desligada: ${disabledPolicy?.reason}`
                )
            );
            Aethra.GameState.hero.bag = fieldBackup.bag;
            Aethra.GameState.professionPolicies = fieldBackup.policies;

            const craftingBackup = {
                bag: JSON.parse(JSON.stringify(Aethra.GameState.hero.bag || [])),
                discipline: JSON.parse(JSON.stringify(Aethra.GameState.hero.disciplines.blacksmithing)),
                crafting: JSON.parse(JSON.stringify(Aethra.GameState.crafting || null)),
                hunt: JSON.parse(JSON.stringify(Aethra.GameState.hunt || {}))
            };
            Aethra.GameState.hunt.isActive = false;
            Aethra.GameState.hero.disciplines.blacksmithing.level = 4;
            Aethra.GameState.hero.disciplines.blacksmithing.xpNext = Aethra.XPSystem.getSkillXPRequired(4);
            Aethra.GameState.hero.disciplines.blacksmithing.trainingMode = "training";
            const testIngots = Aethra.ItemSystem.generateItem("refined_ingot", { quantity: 6, quality: 20, potential: 20, source: "integration" });
            Aethra.BagSystem.addItem(testIngots, "integration");
            const ingotsBeforeCraft = Aethra.BagSystem.countItem("refined_ingot");
            Aethra.CraftingSystem.setRandomSource(() => 0.5);
            const craftedSword = Aethra.CraftingSystem.craft("forge_iron_sword", {
                stationId: "forge", techniqueId: "balanced", quantity: 1, commandId: "integration-craft-sword"
            });
            Aethra.CraftingSystem.resetRandomSource();
            checks.push(
                createCheck(
                    "Forjaria consome materiais e cria item individual",
                    craftedSword?.accepted === true
                        && Aethra.BagSystem.countItem("refined_ingot") === ingotsBeforeCraft - 3
                        && craftedSword.outputs?.[0]?.templateId === "eg_sword_l1"
                        && craftedSword.outputs?.[0]?.crafting?.recipeId === "forge_iron_sword"
                        && craftedSword.xp?.accepted === true,
                    craftedSword?.accepted ? `${craftedSword.outputs[0].name} · qualidade ${craftedSword.outputs[0].quality}` : craftedSword?.reason
                )
            );
            Aethra.GameState.hero.bag = craftingBackup.bag;
            Aethra.GameState.hero.disciplines.blacksmithing = craftingBackup.discipline;
            Aethra.GameState.crafting = craftingBackup.crafting;
            Aethra.GameState.hunt = craftingBackup.hunt;

            const forcedDisciplineProc = Aethra.DisciplineSystem?.rollCombatProc?.("axe", () => 0);
            checks.push(
                createCheck(
                    "RNG de disciplina produz efeitos identificáveis",
                    forcedDisciplineProc?.triggered === true
                        && forcedDisciplineProc?.name === "Golpe Selvagem"
                        && Number(forcedDisciplineProc?.damageMultiplier) > 1,
                    forcedDisciplineProc?.name || "proc indisponível"
                )
            );

            const previousGuard = JSON.parse(JSON.stringify(Aethra.GameState.battle?.heroGuard || null));
            const guardResult = Aethra.SkillController?.applyBuffSkill?.(
                Aethra.SkillSystem?.getSkill?.("guard"),
                { source: "integration-guard" },
                { source: "integration-guard" }
            );
            const guardedCombatant = Aethra.BattleSystem?.getHeroCombatant?.();
            checks.push(
                createCheck(
                    "Escudos e armaduras alteram a sobrevivência real",
                    Number(guardResult?.defenseBonus) >= 8
                        && Number(guardResult?.blockChance) >= 0.15
                        && Number(guardedCombatant?.stats?.defense) > Number(Aethra.GameState.hero?.stats?.defense || 0),
                    `+${guardResult?.defenseBonus || 0} Defesa · ${Math.round(Number(guardResult?.blockChance || 0) * 100)}% bloqueio`
                )
            );
            if (Aethra.GameState.battle) Aethra.GameState.battle.heroGuard = previousGuard;

            Aethra.CharacterCreationUI?.show?.();
            const creationSteps = document.querySelectorAll(".creation-progress__step");
            const creationArchetypes = document.querySelectorAll(".creation-archetype");
            checks.push(
                createCheck(
                    "Criação de personagem guiada em quatro etapas",
                    creationSteps.length === 4 && creationArchetypes.length >= 5,
                    `${creationSteps.length} etapas · ${creationArchetypes.length} arquétipos visíveis`
                )
            );
            Aethra.CharacterCreationUI?.close?.();
            checks.push(
                createCheck(
                    "Combate configurado por rodadas legíveis",
                    Number(Aethra.BattleSystem?.config?.roundMs) === 1800
                        && Number(Aethra.BattleSystem?.config?.introMs) === 1200
                        && Number(Aethra.BattleSystem?.config?.minimumCombatMs) === 4000
                        && Aethra.SkillSystem?.getCooldownRounds?.("heavy_strike") === 3,
                    `${Aethra.BattleSystem?.config?.roundMs || 0} ms/rodada · mínimo ${Aethra.BattleSystem?.config?.minimumCombatMs || 0} ms · Golpe Pesado CD ${Aethra.SkillSystem?.getCooldownRounds?.("heavy_strike") || 0}`
                )
            );
            checks.push(
                createCheck(
                    "Progressão e morte possuem consequências",
                    typeof Aethra.XPSystem?.loseXP === "function"
                        && Number(Aethra.BattleSystem?.config?.hardcoreXPPenalty) > 0
                        && Number(Aethra.BattleSystem?.config?.hardcoreGoldPenalty) > 0,
                    `${Number(Aethra.BattleSystem?.config?.hardcoreXPPenalty || 0) * 100}% XP · ${Number(Aethra.BattleSystem?.config?.hardcoreGoldPenalty || 0) * 100}% Ouro`
                )
            );

            const previousCombatSpeed = Aethra.SettingsManager?.getCombatSpeed?.() || 1;
            const acceleratedSpeed = Aethra.SettingsManager?.setCombatSpeed?.(4, { source: "integration-test" });
            checks.push(
                createCheck(
                    "Velocidade altera só a apresentação da rodada",
                    acceleratedSpeed === 4
                        && Number(Aethra.BattleSystem?.config?.roundMs) === 450
                        && Aethra.SkillSystem?.getCooldownRounds?.("heavy_strike") === 3,
                    `${Aethra.BattleSystem?.config?.roundMs || 0} ms em 4× · CD continua ${Aethra.SkillSystem?.getCooldownRounds?.("heavy_strike") || 0} rodadas`
                )
            );
            Aethra.SettingsManager?.setCombatSpeed?.(previousCombatSpeed, { source: "integration-restore" });

            const originalBattleRandom = Aethra.BattleSystem?.randomSource;
            Aethra.BattleSystem?.setRandomSource?.(() => 0.9999);
            const forcedMiss = Aethra.BattleSystem?.resolveAttack?.(
                { id: "hero", name: "Herói", stats: { precision: 0, critical: 0 } },
                { id: "bandit", name: "Bandido", stats: { evasion: 0, defense: 0 } },
                "hero",
                { attackLabel: "Teste de ataque" }
            );
            if (typeof originalBattleRandom === "function") {
                Aethra.BattleSystem?.setRandomSource?.(originalBattleRandom);
            }
            checks.push(
                createCheck(
                    "Ataques e habilidades ofensivas podem errar",
                    forcedMiss?.hit === false && Number(forcedMiss?.amount) === 0,
                    forcedMiss?.message || "resultado indisponível"
                )
            );

            const failedExploration = Aethra.ProfessionSystem?.check?.(
                "exploration",
                1,
                { randomSource: () => 0.9999 }
            );
            checks.push(
                createCheck(
                    "Ações de mundo possuem chance real de falha",
                    failedExploration?.success === false
                        && Number(failedExploration?.chance) > 0
                        && Number(failedExploration?.chance) < 1,
                    `${Math.round(Number(failedExploration?.chance || 0) * 100)}% de sucesso · teste forçou falha`
                )
            );

            const levelPointHero = Aethra.GameState.hero;
            const levelPointBefore = {
                level: levelPointHero.level,
                xpNext: levelPointHero.xpNext,
                skillPoints: levelPointHero.skillPoints,
                skillPointsEarned: levelPointHero.skillPointsEarned,
                stats: JSON.parse(JSON.stringify(levelPointHero.stats || {})),
                hp: levelPointHero.hp,
                focus: levelPointHero.focus
            };
            const levelPointResult = Aethra.XPSystem.levelUp({ save: false, source: "integration-skill-point" });
            checks.push(
                createCheck(
                    "Cada nível concede ponto de habilidade",
                    Number(levelPointResult?.skillPointsAwarded) === 1
                        && Number(levelPointHero.skillPoints) === Number(levelPointBefore.skillPoints || 0) + 1,
                    `+${levelPointResult?.skillPointsAwarded || 0} ponto · saldo ${levelPointHero.skillPoints}`
                )
            );
            levelPointHero.level = levelPointBefore.level;
            levelPointHero.xpNext = levelPointBefore.xpNext;
            levelPointHero.skillPoints = levelPointBefore.skillPoints;
            levelPointHero.skillPointsEarned = levelPointBefore.skillPointsEarned;
            levelPointHero.stats = levelPointBefore.stats;
            levelPointHero.hp = levelPointBefore.hp;
            levelPointHero.focus = levelPointBefore.focus;

            const deathXpBefore = {
                xpCurrent: levelPointHero.xpCurrent,
                xpTotal: levelPointHero.xpTotal
            };
            levelPointHero.xpCurrent = 50;
            levelPointHero.xpTotal = Math.max(50, Number(levelPointHero.xpTotal || 0));
            const deathXpResult = Aethra.XPSystem.loseXP(0.10, { source: "integration-death" });
            checks.push(
                createCheck(
                    "Penalidade de morte remove XP real",
                    Number(deathXpResult?.lost) === 5 && Number(levelPointHero.xpCurrent) === 45,
                    `${deathXpResult?.lost || 0} XP perdidos · ${levelPointHero.xpCurrent} restantes`
                )
            );
            levelPointHero.xpCurrent = deathXpBefore.xpCurrent;
            levelPointHero.xpTotal = deathXpBefore.xpTotal;

            const deathRouteBefore = {
                hero: JSON.parse(JSON.stringify(levelPointHero)),
                battle: JSON.parse(JSON.stringify(Aethra.GameState.battle || {})),
                combat: JSON.parse(JSON.stringify(Aethra.GameState.combat || {})),
                ui: JSON.parse(JSON.stringify(Aethra.GameState.ui || {}))
            };
            levelPointHero.gold = 100;
            levelPointHero.xpCurrent = 50;
            levelPointHero.xpTotal = Math.max(50, Number(levelPointHero.xpTotal || 0));
            levelPointHero.stats.hp = 0;
            levelPointHero.hp = 0;
            Aethra.GameState.battle = Aethra.GameState.battle || {};
            Object.assign(Aethra.GameState.battle, {
                isFighting: true,
                battleId: "integration-death-route",
                source: "integration-test",
                startedAt: new Date().toISOString(),
                creature: { id: "bandit-xmm-2024", name: "Bandido", hp: 1, maxHp: 19 }
            });
            Aethra.BattleSystem.isFighting = true;
            const deathRouteResult = Aethra.BattleSystem.defeat();
            checks.push(
                createCheck(
                    "Morte perde XP e Ouro e retorna à cidade",
                    Number(deathRouteResult?.xpLost) === 5
                        && Number(deathRouteResult?.goldLost) === 10
                        && deathRouteResult?.returnTo === "city"
                        && Number(levelPointHero.hp) === Number(levelPointHero.maxHp),
                    `${deathRouteResult?.xpLost || 0} XP · ${deathRouteResult?.goldLost || 0} Gold · destino ${deathRouteResult?.returnTo || "indefinido"}`
                )
            );
            const restoreEnumerableState = (target, snapshot) => {
                Object.keys(target).forEach((key) => delete target[key]);
                Object.assign(target, JSON.parse(JSON.stringify(snapshot)));
            };
            restoreEnumerableState(levelPointHero, deathRouteBefore.hero);
            restoreEnumerableState(Aethra.GameState.battle, deathRouteBefore.battle);
            restoreEnumerableState(Aethra.GameState.combat, deathRouteBefore.combat);
            Aethra.GameState.ui = Aethra.GameState.ui || {};
            restoreEnumerableState(Aethra.GameState.ui, deathRouteBefore.ui);
            Aethra.BattleSystem.isFighting = Boolean(Aethra.GameState.battle.isFighting);
            Aethra.SkillController?.bindPlayer?.(levelPointHero);
            Aethra.UIManager?.setPrimaryView?.(deathRouteBefore.ui.primaryView || "hunt", {
                source: "integration-restore"
            });

            const actionBars = Aethra.SkillSystem?.getActionBars?.() || [];
            checks.push(
                createCheck(
                    "Modelo de múltiplas ActionBars",
                    actionBars.length >= 2 && actionBars.every((bar) => Array.isArray(bar.slots) && bar.slots.length >= 10),
                    `${actionBars.length} barra(s); ${actionBars.map((bar) => bar.slots.length).join("/")} slots`
                )
            );

            // 2. Simular encontro: EventBus -> XPSystem -> QuestSystem.
            console.log("Simulando encontro...");
            Aethra.EventBus.emit("EnemyDefeated", {
                id: "forest_wolf",
                enemyId: "forest_wolf",
                name: "Lobo da Floresta",
                xp: 50,
                gold: 10,
                source: "integration-test"
            });

            // 3. Simular geração de loot para validar Item/Loot/Bag.
            let generatedLoot = [];
            let originalLootRandom = null;

            try {
                if (
                    Aethra.LootSystem &&
                    typeof Aethra.LootSystem.generateLoot === "function"
                ) {
                    originalLootRandom = Aethra.LootSystem.randomSource;

                    if (typeof Aethra.LootSystem.setRandomSource === "function") {
                        // Garante que o smoke test gere pelo menos os drops com chance > 0.
                        Aethra.LootSystem.setRandomSource(() => 0);
                    }

                    generatedLoot = Aethra.LootSystem.generateLoot(
                        "forest_wolf",
                        {
                            source: "integration-test"
                        }
                    );
                }
            } catch (error) {
                checks.push(
                    createCheck("Geração de loot", false, error.message)
                );
            } finally {
                if (
                    originalLootRandom &&
                    Aethra.LootSystem &&
                    typeof Aethra.LootSystem.setRandomSource === "function"
                ) {
                    Aethra.LootSystem.setRandomSource(originalLootRandom);
                }
            }

            window.setTimeout(() => {
                const xpAfter = readXP();
                const bagAfter = Array.isArray(Aethra.GameState?.hero?.bag)
                    ? Aethra.GameState.hero.bag.length
                    : 0;

                checks.push(
                    createCheck(
                        "Reatividade de XP",
                        xpAfter.total >= xpBefore.total + 50,
                        `${xpBefore.total} -> ${xpAfter.total}`
                    )
                );

                checks.push(
                    createCheck(
                        "Fluxo Loot -> Inventário",
                        generatedLoot.length === 0 || bagAfter > bagBefore,
                        `${generatedLoot.length} item(ns) gerado(s); mochila ${bagBefore} -> ${bagAfter}`
                    )
                );

                Aethra.PlayerHudWorkspace?.refresh?.();
                const playerHud = document.querySelector(".hero-hub--cockpit .player-hud-workspace");
                const playerFixedEquipment = document.querySelector(
                    ".hero-hub--cockpit [data-player-hud-fixed-equipment]"
                );
                const playerHudSections = playerHud?.querySelectorAll(".player-hud-section") || [];
                const equipmentSlots = playerFixedEquipment?.querySelectorAll(".player-equipment-slot") || [];
                const skillGroups = playerHud?.querySelectorAll(".player-skill-group") || [];
                const backpackSlots = playerHud?.querySelectorAll(".player-backpack-slot.is-filled") || [];
                const inspectedBackpackSlots = [...backpackSlots].filter((slot) => slot.dataset.itemTooltipBound === "true");
                const combatSpeedControls = document.querySelectorAll("[data-battle-speed]");
                checks.push(
                    createCheck(
                        "HUD oferece velocidades 1×, 2× e 4×",
                        combatSpeedControls.length === 3
                            && [...combatSpeedControls].map((button) => Number(button.dataset.battleSpeed)).join(",") === "1,2,4",
                        `${combatSpeedControls.length}/3 controles renderizados`
                    )
                );
                checks.push(
                    createCheck(
                        "Painel do herói sem acordeões conflitantes",
                        Boolean(playerHud)
                            && playerHudSections.length === 3
                            && !playerHud.querySelector(".hero-hub__accordion-section, .is-collapsed"),
                        playerHud ? `${playerHudSections.length} seções no scroll único` : "cockpit ausente"
                    )
                );
                checks.push(
                    createCheck(
                        "Paperdoll completo do herói",
                        equipmentSlots.length === 11,
                        `${equipmentSlots.length}/11 slots renderizados`
                    )
                );
                checks.push(
                    createCheck(
                        "Skills organizadas por categoria",
                        skillGroups.length >= 4 && Boolean(playerHud?.querySelector("[data-player-skill-search]")),
                        `${skillGroups.length} categorias com busca`
                    )
                );
                checks.push(
                    createCheck(
                        "Backpack com busca, ordenação e hover rico",
                        Boolean(playerHud?.querySelector("[data-backpack-search]"))
                            && Boolean(playerHud?.querySelector("[data-backpack-sort]"))
                            && (backpackSlots.length === 0 || inspectedBackpackSlots.length === backpackSlots.length),
                        `${inspectedBackpackSlots.length}/${backpackSlots.length} itens com inspeção`
                    )
                );

                Aethra.RenderEngine?.renderExplorationFeed?.();
                const journeyStatCards = [...document.querySelectorAll(".expedition-live-stats > span")];
                const journeyStatsVisible = journeyStatCards.length === 4 && journeyStatCards.every((card) => {
                    const value = card.querySelector("strong");
                    if (!value) return false;
                    const cardRect = card.getBoundingClientRect();
                    const valueRect = value.getBoundingClientRect();
                    return valueRect.top >= cardRect.top - 0.5
                        && valueRect.bottom <= cardRect.bottom + 0.5
                        && valueRect.height > 0;
                });
                checks.push(
                    createCheck(
                        "Totais da jornada sem números cortados",
                        journeyStatsVisible,
                        `${journeyStatCards.length}/4 cards íntegros`
                    )
                );

                const workspaceSlots = document.querySelectorAll("#skill-action-bar .battle-action-slot");
                const workspaceToolbar = document.querySelector(".actionbar-workspace__toolbar");
                checks.push(
                    createCheck(
                        "HUD escalável da ActionBar",
                        workspaceSlots.length >= 10 && Boolean(workspaceToolbar),
                        `${workspaceSlots.length} slots visíveis; seletor ${workspaceToolbar ? "presente" : "ausente"}`
                    )
                );

                const analyzer = Aethra.HuntAnalyzerWorkspace;
                const analyzerMetrics = analyzer?.getMetrics?.() || {};
                const analyzerCards = document.querySelectorAll(".analyzer-ledger-card");
                const analyzerTabs = [...document.querySelectorAll("[data-intelligence-tab]")]
                    .map((tab) => tab.dataset.intelligenceTab);
                checks.push(
                    createCheck(
                        "Hunt Analyzer detalhado",
                        Boolean(analyzer)
                            && analyzerCards.length >= 6
                            && ["xp", "gained", "spent", "profit"].every((key) => Number.isFinite(Number(analyzerMetrics[key]))),
                        `${analyzerCards.length} KPIs; economia ${analyzer ? "disponível" : "ausente"}`
                    )
                );
                checks.push(
                    createCheck(
                        "Ordem Análise, Loot e Progresso",
                        analyzerTabs.slice(0, 3).join(",") === "analyzer,loot,progression",
                        analyzerTabs.slice(0, 3).join(" → ") || "abas ausentes"
                    )
                );

                const supplyCostBefore = Number(Aethra.GameState.hunt?.supplyCost || 0);
                const supplyBreakdownBefore = JSON.parse(JSON.stringify(Aethra.GameState.hunt?.supplyBreakdown || {}));
                const supplyResult = Aethra.HuntSystem?.recordSupplyUse?.(
                    "potion_health",
                    2,
                    { allowInactive: true, source: "integration-test" }
                );
                const potionSupply = Aethra.GameState.hunt?.supplyBreakdown?.potion_health;
                checks.push(
                    createCheck(
                        "Rastreamento de supplies por item",
                        Boolean(supplyResult)
                            && Number(potionSupply?.quantity) >= 2
                            && Number(Aethra.GameState.hunt?.supplyCost) >= supplyCostBefore + 20,
                        supplyResult
                            ? `${potionSupply?.quantity || 0} Poções de Vida · ${potionSupply?.totalCost || 0} G`
                            : "registro indisponível"
                    )
                );
                Aethra.GameState.hunt.supplyCost = supplyCostBefore;
                Aethra.GameState.hunt.supplyBreakdown = supplyBreakdownBefore;
                Aethra.RenderEngine?.renderHunt?.();

                Aethra.CombatHudModernizer?.renderSkillSettings?.();
                const primaryAttackCards = document.querySelectorAll("#primary-attack-bar .primary-attack-card--modern");
                const survivalResources = document.querySelectorAll(".combat-survival-strip [data-modern-resource]");
                const loadoutSlots = document.querySelectorAll("#skills-view .modern-loadout-slot");
                const skillRules = document.querySelectorAll("#skills-view .modern-skill-rule");
                checks.push(
                    createCheck(
                        "HUD moderno de combate e sobrevivência",
                        primaryAttackCards.length === 2 && survivalResources.length === 3,
                        `${primaryAttackCards.length} ataques primários; ${survivalResources.length} recursos vitais`
                    )
                );
                checks.push(
                    createCheck(
                        "Configurador compacto de ActionBar",
                        loadoutSlots.length >= 10 && skillRules.length >= 4,
                        `${loadoutSlots.length} slots; ${skillRules.length} regras editáveis`
                    )
                );

                const previousBattleState = JSON.parse(JSON.stringify(Aethra.GameState.battle || {}));
                const previousCombatState = JSON.parse(JSON.stringify(Aethra.GameState.combat || {}));
                const heroForResourceTest = Aethra.GameState.hero || {};
                const previousHeroResources = {
                    hp: heroForResourceTest.hp,
                    maxHp: heroForResourceTest.maxHp,
                    mana: heroForResourceTest.mana,
                    maxMana: heroForResourceTest.maxMana,
                    energy: heroForResourceTest.energy,
                    maxEnergy: heroForResourceTest.maxEnergy,
                    stats: JSON.parse(JSON.stringify(heroForResourceTest.stats || {}))
                };
                heroForResourceTest.stats = heroForResourceTest.stats || {};
                heroForResourceTest.hp = 44;
                heroForResourceTest.maxHp = 100;
                heroForResourceTest.mana = 7;
                heroForResourceTest.maxMana = 50;
                heroForResourceTest.energy = 33;
                heroForResourceTest.maxEnergy = 100;
                heroForResourceTest.stats.hp = 100;
                heroForResourceTest.stats.mana = 50;
                heroForResourceTest.stats.energy = 100;
                Aethra.GameState.battle = {
                    ...previousBattleState,
                    isFighting: true,
                    battleId: "integration_combat_hud",
                    round: 3,
                    creature: {
                        id: "integration_target",
                        name: "Alvo de Teste",
                        level: 2,
                        hp: 34,
                        maxHp: 50,
                        stats: { damageMax: 6, defense: 2 }
                    }
                };
                Aethra.GameState.combat = { ...previousCombatState, isActive: false, enemy: null };
                Aethra.CombatProjection?.reset?.("integration-combat-hud");
                Aethra.EventBus.emit("battle:started", {
                    battleId: "integration_combat_hud",
                    creature: Aethra.GameState.battle.creature
                });
                Aethra.EventBus.emit("battle:damage-dealt", {
                    battleId: "integration_combat_hud",
                    round: 3,
                    side: "hero",
                    attacker: "hero",
                    attackerName: "Aethra",
                    target: "integration_target",
                    targetName: "Alvo de Teste",
                    skillName: "Golpe Pesado",
                    hit: true,
                    isCrit: true,
                    amount: 16
                });
                Aethra.EventBus.emit("battle:attack-missed", {
                    battleId: "integration_combat_hud",
                    round: 3,
                    side: "creature",
                    attacker: "integration_target",
                    actorName: "Alvo de Teste",
                    attackerName: "Alvo de Teste",
                    target: "hero",
                    targetName: "Aethra",
                    skillName: "Mordida",
                    hit: false,
                    amount: 0
                });
                Aethra.RenderEngine?.renderBattleCards?.();

                const combatTimeline = document.querySelector(".encounter-exchange__timeline");
                const heroCombatEntry = combatTimeline?.querySelector(".encounter-exchange__event.is-hero");
                const enemyCombatEntry = combatTimeline?.querySelector(".encounter-exchange__event.is-enemy");
                const encounterResources = document.querySelectorAll("#battle-hero-card [data-encounter-resource]");
                const centralResourceValues = Object.fromEntries(
                    [...encounterResources].map((resource) => [
                        resource.dataset.encounterResource,
                        Number(resource.querySelector("[role='progressbar']")?.getAttribute("aria-valuenow"))
                    ])
                );
                checks.push(
                    createCheck(
                        "Linha do tempo identifica ator e alvo",
                        Boolean(heroCombatEntry && enemyCombatEntry)
                            && /VOCÊ/.test(heroCombatEntry.textContent)
                            && /INIMIGO/.test(enemyCombatEntry.textContent),
                        heroCombatEntry && enemyCombatEntry ? "herói e inimigo diferenciados" : "ações sem identificação"
                    )
                );
                checks.push(
                    createCheck(
                        "Resultados de ataque legíveis",
                        /Golpe Pesado/.test(combatTimeline?.textContent || "")
                            && /Crítico/.test(combatTimeline?.textContent || "")
                            && /Mordida/.test(combatTimeline?.textContent || "")
                            && /ERROU/.test(combatTimeline?.textContent || ""),
                        combatTimeline ? "habilidade, crítico e erro visíveis" : "timeline ausente"
                    )
                );
                checks.push(
                    createCheck(
                        "Recursos padronizados na arena",
                        encounterResources.length === 3,
                        `${encounterResources.length} recursos renderizados`
                    )
                );
                checks.push(
                    createCheck(
                        "Recursos centrais usam o estado vivo do herói",
                        centralResourceValues.hp === 44
                            && centralResourceValues.mp === 7
                            && centralResourceValues.vigor === 33,
                        `HP ${centralResourceValues.hp} · MP ${centralResourceValues.mp} · Vigor ${centralResourceValues.vigor}`
                    )
                );

                Aethra.GameState.battle = previousBattleState;
                Aethra.GameState.combat = previousCombatState;
                heroForResourceTest.hp = previousHeroResources.hp;
                heroForResourceTest.maxHp = previousHeroResources.maxHp;
                heroForResourceTest.mana = previousHeroResources.mana;
                heroForResourceTest.maxMana = previousHeroResources.maxMana;
                heroForResourceTest.energy = previousHeroResources.energy;
                heroForResourceTest.maxEnergy = previousHeroResources.maxEnergy;
                heroForResourceTest.stats = previousHeroResources.stats;
                Aethra.CombatProjection?.reset?.("integration-combat-hud-restored");
                Aethra.RenderEngine?.renderBattleCards?.();

                const vanguardPreset = Aethra.CharacterBuildSystem?.archetypes?.vanguard;
                const createdHero = vanguardPreset
                    ? Aethra.CharacterBuildSystem.createCharacter({
                        name: "Herói de Teste",
                        archetypeId: "vanguard",
                        introProfessionId: "mining",
                        attributes: vanguardPreset.attributes,
                        masteries: vanguardPreset.masteries
                    })
                    : null;
                const equippedStarter = Aethra.GameState.playerEquipment?.weapon;
                const starterBar = Aethra.SkillSystem?.getActionBars?.()[0];
                checks.push(
                    createCheck(
                        "Criação equipa arma e ActionBar coerentes com a origem",
                        createdHero?.valid === true
                            && equippedStarter?.weaponFamily === "sword"
                            && starterBar?.slots?.includes("precise_strike")
                            && Number(Aethra.GameState.hero?.disciplines?.sword?.level) === 1
                            && Number(Aethra.GameState.hero?.disciplines?.mining?.level) === 1
                            && Aethra.BagSystem?.countItem?.("apprentice_pickaxe") === 1,
                        `${equippedStarter?.name || "sem arma"} · ${starterBar?.slots?.filter(Boolean).join(", ") || "sem técnicas"}`
                    )
                );

                const starterChest = Aethra.GameState.playerEquipment?.chest;
                const starterOffhand = Aethra.GameState.playerEquipment?.offhand;
                const starterSupplies = Aethra.GameState.hero?.bag || [];
                const healthStarter = starterSupplies.find((item) => item.templateId === "potion_health");
                const manaStarter = starterSupplies.find((item) => item.templateId === "potion_mana");
                checks.push(
                    createCheck(
                        "Kit inicial usa instâncias oficiais e vinculadas",
                        Boolean(equippedStarter?.instanceId)
                            && Boolean(starterChest?.instanceId)
                            && Boolean(starterOffhand?.instanceId)
                            && healthStarter?.quantity === 5
                            && manaStarter?.quantity === 5
                            && healthStarter?.ownership?.bound === true
                            && manaStarter?.ownership?.bound === true,
                        `${equippedStarter?.name || "sem arma"} · ${starterChest?.name || "sem armadura"} · ${starterOffhand?.name || "sem escudo"} · ${starterSupplies.length} pilhas`
                    )
                );

                const consumableCycleBefore = {
                    hero: JSON.parse(JSON.stringify(Aethra.GameState.hero || {})),
                    hunt: JSON.parse(JSON.stringify(Aethra.GameState.hunt || {})),
                    battle: JSON.parse(JSON.stringify(Aethra.GameState.battle || {})),
                    combat: JSON.parse(JSON.stringify(Aethra.GameState.combat || {}))
                };
                const healthQuantityBefore = Aethra.BagSystem?.countItem?.(healthStarter) || 0;
                Aethra.GameState.hero.maxHp = 50;
                Aethra.GameState.hero.hp = 10;
                Aethra.GameState.hero.stats = Aethra.GameState.hero.stats || {};
                Aethra.GameState.hero.stats.maxHp = 50;
                Aethra.GameState.hero.stats.hp = 10;
                Aethra.GameState.hunt = Aethra.GameState.hunt || {};
                Object.assign(Aethra.GameState.hunt, {
                    isActive: true,
                    huntId: "integration-supply-hunt",
                    supplyCost: 0,
                    supplyBreakdown: {}
                });
                Object.assign(Aethra.GameState.battle, {
                    isFighting: true,
                    battleId: "integration-auto-supply-battle",
                    round: 1,
                    phase: "hero-action",
                    creature: {
                        id: "integration-supply-target",
                        name: "Alvo de Supply",
                        hp: 20,
                        maxHp: 20,
                        damage: 1,
                        stats: {}
                    }
                });
                Aethra.BattleSystem.isFighting = true;
                Aethra.CombatProjection?.reset?.("integration-auto-supply");
                const usedSupply = Aethra.ConsumableSystem?.tryAutoUse?.({
                    source: "integration-real-supply"
                });
                const healthQuantityAfter = Aethra.BagSystem?.countItem?.({
                    instanceId: healthStarter?.instanceId,
                    templateId: healthStarter?.templateId
                }) || 0;
                const projectedAfterSupply = Aethra.CombatProjection?.getSnapshot?.();
                const recordedSupply = Aethra.GameState.hunt?.supplyBreakdown?.potion_health;
                checks.push(
                    createCheck(
                        "Potion automática fecha estoque, ação, projeção e custo da Hunt",
                        usedSupply?.used === true
                            && usedSupply?.automatic === true
                            && usedSupply?.consumesAction === true
                            && healthQuantityAfter === healthQuantityBefore - 1
                            && Number(Aethra.GameState.hero.hp) === 30
                            && Number(projectedAfterSupply?.hero?.resources?.hp?.current) === 30
                            && Number(recordedSupply?.quantity) === 1
                            && Number(recordedSupply?.totalCost) === 10
                            && projectedAfterSupply?.timeline?.[0]?.kind === "consumable",
                        `HP ${Aethra.GameState.hero.hp}/50 · potion ${healthQuantityBefore}→${healthQuantityAfter} · ${recordedSupply?.totalCost || 0} G`
                    )
                );
                const remainingHealthStack = Aethra.GameState.hero.bag.find((item) => item.instanceId === healthStarter?.instanceId);
                const failedConsumptionCount = Aethra.BagSystem?.countItem?.(remainingHealthStack) || 0;
                const failedConsumption = Aethra.BagSystem?.consumeItem?.(
                    remainingHealthStack,
                    failedConsumptionCount + 1,
                    "integration-atomic-consume"
                );
                checks.push(
                    createCheck(
                        "Consumo de stack é transacional quando o estoque é insuficiente",
                        failedConsumption === false
                            && Aethra.BagSystem?.countItem?.(remainingHealthStack) === failedConsumptionCount,
                        `${failedConsumptionCount} unidade(s) preservada(s)`
                    )
                );
                restoreEnumerableState(Aethra.GameState.hero, consumableCycleBefore.hero);
                restoreEnumerableState(Aethra.GameState.hunt, consumableCycleBefore.hunt);
                restoreEnumerableState(Aethra.GameState.battle, consumableCycleBefore.battle);
                restoreEnumerableState(Aethra.GameState.combat, consumableCycleBefore.combat);
                Aethra.BattleSystem.isFighting = Boolean(Aethra.GameState.battle.isFighting);
                Aethra.CombatProjection?.reset?.("integration-supply-restored");
                Aethra.SkillController?.bindPlayer?.(Aethra.GameState.hero);

                const protectedSellables = Aethra.NpcShopUI?.getSellableItems?.() || [];
                const shopGoldBefore = Number(Aethra.GameState.hero?.gold || 0);
                const potionPurchase = Aethra.MarketplaceSystem?.buyItem?.("potion_health", 3);
                const purchasedPotion = potionPurchase?.items?.[0];
                const potionSellback = purchasedPotion
                    ? Aethra.MarketplaceSystem?.sellBack?.(purchasedPotion.instanceId)
                    : null;
                checks.push(
                    createCheck(
                        "Loja preserva kit inicial e negocia stacks pelo valor total",
                        protectedSellables.length === 0
                            && potionPurchase?.items?.length === 1
                            && purchasedPotion?.quantity === 3
                            && potionPurchase?.totalPrice === 30
                            && potionSellback?.salePrice === 15
                            && Number(Aethra.GameState.hero?.gold || 0) === shopGoldBefore - 15,
                        `${protectedSellables.length} item(ns) iniciais vendáveis · compra ${potionPurchase?.totalPrice || 0} G · devolução ${potionSellback?.salePrice || 0} G`
                    )
                );

                const idleGoldBefore = Number(Aethra.GameState.hero?.gold || 0);
                const idleLoot = Aethra.ItemSystem?.generateItem?.("wolf_hide", {
                    source: "hunt-system",
                    quantity: 2,
                    rarity: "common",
                    affixes: []
                });
                if (idleLoot) Aethra.BagSystem?.addItems?.([idleLoot], "integration-idle-loot");
                const idleLootStillStored = idleLoot?.instanceId
                    ? Aethra.BagSystem?.hasItem?.(idleLoot.instanceId)
                    : true;
                checks.push(
                    createCheck(
                        "Loop idle vende somente loot oficial sem gerar ouro aleatório",
                        Boolean(idleLoot)
                            && idleLootStillStored === false
                            && Number(Aethra.GameState.hero?.gold || 0) === idleGoldBefore + Number(idleLoot.price || 0) * 2,
                        idleLoot
                            ? `pilha ×${idleLoot.quantity} removida · +${Number(Aethra.GameState.hero?.gold || 0) - idleGoldBefore} G`
                            : "loot de teste não gerado"
                    )
                );

                const supplyManagerBefore = {
                    hero: JSON.parse(JSON.stringify(Aethra.GameState.hero || {})),
                    idleLoop: JSON.parse(JSON.stringify(Aethra.GameState.idleLoop || {}))
                };
                const managedSupplyIds = new Set([
                    "potion_health",
                    "potion_mana",
                    "minor_vigor_tonic",
                    "field_antidote"
                ]);
                Aethra.GameState.hero.characterCreated = true;
                Aethra.GameState.hero.gold = 100;
                Aethra.GameState.hero.bag = (Aethra.GameState.hero.bag || []).filter((item) => {
                    return !managedSupplyIds.has(item.templateId || item.id);
                });
                const manualSupplies = Aethra.IdleLoopSystem?.purchaseSupplies?.({
                    potion_health: 2,
                    potion_mana: 1
                }, { source: "integration-manual-supplies" });
                checks.push(
                    createCheck(
                        "Gerenciador compra as quantidades de supplies escolhidas pelo jogador",
                        manualSupplies?.purchased === 3
                            && manualSupplies?.cost === 38
                            && Aethra.IdleLoopSystem?.inventoryQuantity?.("potion_health") === 2
                            && Aethra.IdleLoopSystem?.inventoryQuantity?.("potion_mana") === 1
                            && Number(Aethra.GameState.hero.gold) === 62,
                        `${manualSupplies?.purchased || 0} unidade(s) · ${manualSupplies?.cost || 0} G · saldo ${Aethra.GameState.hero.gold} G`
                    )
                );

                Aethra.GameState.hero.gold = 60;
                Aethra.GameState.hero.bag = (Aethra.GameState.hero.bag || []).filter((item) => {
                    return !managedSupplyIds.has(item.templateId || item.id);
                });
                Aethra.IdleLoopSystem?.updateSetting?.("enabled", true);
                Aethra.IdleLoopSystem?.configureRestock?.({
                    autoRestock: true,
                    goldReserve: 20,
                    maxRestockSpend: 50,
                    allowPartialRestock: true,
                    supplyPlan: {
                        potion_health: { enabled: true, reorderAt: 4, target: 4, priority: 1 },
                        potion_mana: { enabled: true, reorderAt: 5, target: 5, priority: 2 },
                        minor_vigor_tonic: { enabled: false, reorderAt: 2, target: 3, priority: 3 },
                        field_antidote: { enabled: false, reorderAt: 1, target: 2, priority: 4 }
                    }
                });
                const automaticSupplies = Aethra.IdleLoopSystem?.restockSupplies?.();
                const configuredSupplyCount = Object.keys(Aethra.IdleLoopSystem?.getSnapshot?.().supplyPlan || {}).length;
                checks.push(
                    createCheck(
                        "Auto-reposição respeita seleção, prioridade, limite e reserva de ouro",
                        automaticSupplies?.purchased === 4
                            && automaticSupplies?.cost === 40
                            && Aethra.IdleLoopSystem?.inventoryQuantity?.("potion_health") === 4
                            && Aethra.IdleLoopSystem?.inventoryQuantity?.("potion_mana") === 0
                            && Number(Aethra.GameState.hero.gold) === 20
                            && configuredSupplyCount === 4,
                        `${automaticSupplies?.purchased || 0} Vida · ${automaticSupplies?.cost || 0} G gastos · ${Aethra.GameState.hero.gold} G reservados`
                    )
                );
                restoreEnumerableState(Aethra.GameState.hero, supplyManagerBefore.hero);
                Aethra.GameState.idleLoop = JSON.parse(JSON.stringify(supplyManagerBefore.idleLoop));
                Aethra.ConsumableSystem?.ensurePolicy?.();
                Aethra.IdleLoopSystem?.renderControls?.();

                Aethra.RenderEngine?.renderEquipment?.();
                const fullEquipmentSlots = document.querySelectorAll(
                    "#equipment-grid [data-equipment-slot]"
                );
                checks.push(
                    createCheck(
                        "Inventário completo usa os mesmos onze slots da Central do Herói",
                        Aethra.EquipSystem?.validSlots?.length === 11
                            && Aethra.PlayerHudWorkspace?.slots?.length === 11
                            && fullEquipmentSlots.length === 11,
                        `${fullEquipmentSlots.length} slots renderizados · ${Aethra.EquipSystem?.validSlots?.length || 0} slots de domínio`
                    )
                );

                Aethra.RenderEngine?.activateBattleMode?.();
                Aethra.PlayerHudWorkspace?.refresh?.();
                const heroPanels = [...document.querySelectorAll("[data-hero-panel-view]")];
                const visibleHeroPanels = heroPanels.filter((panel) => !panel.hidden);
                const fixedEquipmentPanel = document.querySelector("[data-player-hud-fixed-equipment]");
                const fixedEquipmentSlots = fixedEquipmentPanel?.querySelectorAll(
                    "[data-battle-equipment-slot]"
                ) || [];
                checks.push(
                    createCheck(
                        "Central mantém recursos e set fixos com três áreas exclusivas",
                        heroPanels.length === 3
                            && visibleHeroPanels.length === 1
                            && fixedEquipmentPanel?.hidden === false
                            && fixedEquipmentSlots.length === 11,
                        `${visibleHeroPanels.length}/${heroPanels.length} área(s) visível(is) · ${fixedEquipmentSlots.length}/11 slots fixos`
                    )
                );

                const selectedHeroTabBeforeAudit = document.querySelector(
                    "[data-player-hud-target][aria-selected='true']"
                )?.dataset.playerHudTarget || "backpack";
                const heroTabContracts = [
                    ["backpack", ".player-backpack-slot, .player-backpack-empty", 1],
                    ["skills", ".player-skill-entry", 4],
                    ["overview", ".hero-attribute", 6]
                ];
                const heroTabsHaveRealContent = heroTabContracts.every(([tab, selector, minimum]) => {
                    document.querySelector(`[data-player-hud-target='${tab}']`)?.click();
                    const panel = document.querySelector(`[data-hero-panel-view='${tab}']`);
                    return panel?.hidden === false
                        && panel.getAttribute("aria-hidden") === "false"
                        && panel.querySelectorAll(selector).length >= minimum;
                });
                checks.push(
                    createCheck(
                        "Todas as abas da Central exibem conteúdo funcional",
                        heroTabsHaveRealContent,
                        heroTabsHaveRealContent
                            ? "Itens, skills e build possuem conteúdo real"
                            : "uma ou mais abas estão vazias ou não ativaram"
                    )
                );

                document.querySelector("[data-player-hud-target='skills']")?.click();
                const firstSkillGroup = document.querySelector(".player-skill-group");
                if (firstSkillGroup) firstSkillGroup.open = true;
                const firstSkillButton = firstSkillGroup?.querySelector("[data-player-skill-id]");
                firstSkillButton?.click();
                const firstSkillDetails = firstSkillButton
                    ? document.getElementById(firstSkillButton.getAttribute("aria-controls"))
                    : null;
                const skillTrackSizing = firstSkillGroup
                    ? getComputedStyle(firstSkillGroup.parentElement).gridAutoRows
                    : "";
                const skillGroupIsNotClipped = Boolean(firstSkillGroup)
                    && skillTrackSizing === "max-content"
                    && (firstSkillGroup.clientHeight === 0
                        || firstSkillGroup.clientHeight >= firstSkillGroup.scrollHeight - 1);
                const skillDetailsOpened = Boolean(firstSkillButton)
                    && firstSkillButton.getAttribute("aria-expanded") === "true"
                    && firstSkillDetails?.hidden === false
                    && Boolean(firstSkillDetails?.textContent?.trim());
                checks.push(
                    createCheck(
                        "Categorias e fichas de Skills expandem sem conteúdo cortado",
                        skillGroupIsNotClipped && skillDetailsOpened,
                        `trilha ${skillTrackSizing || "ausente"} · ficha ${skillDetailsOpened ? "aberta" : "fechada"}`
                    )
                );

                const intelligenceTabBeforeAudit = document.querySelector(
                    "[data-intelligence-tab][aria-selected='true']"
                )?.dataset.intelligenceTab || "analyzer";
                const intelligenceTabsWork = ["analyzer", "loot", "progression"].every((tab) => {
                    document.querySelector(`[data-intelligence-tab='${tab}']`)?.click();
                    const visiblePanels = [...document.querySelectorAll("[data-intelligence-panel]")]
                        .filter((panel) => !panel.hidden);
                    return document.querySelector(`[data-intelligence-tab='${tab}']`)
                        ?.getAttribute("aria-selected") === "true"
                        && visiblePanels.length === 1
                        && visiblePanels[0].dataset.intelligencePanel === tab;
                });
                document.querySelector(`[data-intelligence-tab='${intelligenceTabBeforeAudit}']`)?.click();
                checks.push(
                    createCheck(
                        "Hunt Analyzer alterna todas as abas internas",
                        intelligenceTabsWork,
                        intelligenceTabsWork
                            ? "Análise, Loot e Progresso alternam painéis exclusivos"
                            : "aba selecionada e painel visível divergiram"
                    )
                );
                document.querySelector(`[data-player-hud-target='${selectedHeroTabBeforeAudit}']`)?.click();

                const previousBattleMode = Aethra.RenderEngine?.battleMode || "cards";
                Aethra.RenderEngine?.syncStageMode?.("map2d");
                const sharedBattleLayout = document.querySelector("[data-battle-mode-layout]");
                const mapStage = document.getElementById("tilemap-canvas-root");
                const cardsStage = document.getElementById("battle-card-arena-container");
                const mapModeSynchronized = Boolean(sharedBattleLayout)
                    && mapStage?.hidden === false
                    && cardsStage?.hidden === true;
                document.getElementById("primary-attack-bar")?.replaceChildren();
                document.getElementById("skill-action-bar")?.replaceChildren();
                Aethra.UIManager?.mountActionBarOverlay?.();
                const actionBarPanel = document.querySelector(
                    "#battle-actionbar-layer > .battle-panel--actionbar"
                );
                const actionBarPanelRect = actionBarPanel?.getBoundingClientRect?.();
                const actionBarContentBottom = Math.max(
                    0,
                    ...[
                        document.querySelector("#battle-actionbar-layer .primary-attack-bar"),
                        document.querySelector("#battle-actionbar-layer #skill-action-bar")
                    ].map((element) => element?.getBoundingClientRect?.().bottom || 0)
                );
                const mapActionBarMounted = Boolean(
                    actionBarPanel
                )
                    && document.querySelectorAll(
                        "#battle-actionbar-layer .primary-attack-card"
                    ).length === 2
                    && document.querySelectorAll(
                        "#battle-actionbar-layer #skill-action-bar .battle-action-slot"
                    ).length >= 10
                    && actionBarContentBottom <= Number(actionBarPanelRect?.bottom || 0) + 1;
                Aethra.RenderEngine?.syncStageMode?.("cards");
                const cardsModeSynchronized = mapStage?.hidden === true
                    && cardsStage?.hidden === false;
                checks.push(
                    createCheck(
                        "Mapa 2D e Cartas compartilham um único estado visual persistível",
                        mapModeSynchronized && cardsModeSynchronized,
                        `Mapa ${mapModeSynchronized ? "sincronizado" : "inconsistente"} · Cartas ${cardsModeSynchronized ? "sincronizadas" : "inconsistentes"}`
                    )
                );
                checks.push(
                    createCheck(
                        "ActionBar permanece completa no Mapa 2D",
                        mapActionBarMounted,
                        mapActionBarMounted
                            ? "2 ataques primários · 10 slots de habilidade · sem corte"
                            : "ActionBar ausente, incompleta ou cortada"
                    )
                );
                const actionBarSlots = [...document.querySelectorAll(
                    "#battle-actionbar-layer #skill-action-bar > .battle-action-slot"
                )];
                const actionBarSlotStyles = actionBarSlots.map((slot) => getComputedStyle(slot));
                const actionBarSlotWidths = actionBarSlotStyles.map((style) => Number.parseFloat(style.width || "0"));
                const actionBarSlotHeights = actionBarSlotStyles.map((style) => Number.parseFloat(style.height || "0"));
                const hasNeutralScale = (element) => {
                    const transform = getComputedStyle(element).transform;
                    if (!transform || transform === "none") return true;
                    const matrix = new DOMMatrixReadOnly(transform);
                    const scaleX = Math.hypot(matrix.a, matrix.b);
                    const scaleY = Math.hypot(matrix.c, matrix.d);
                    return Math.abs(scaleX - 1) <= 0.01 && Math.abs(scaleY - 1) <= 0.01;
                };
                const actionBarSlotsAligned = actionBarSlots.length >= 10
                    && Math.max(...actionBarSlotHeights) - Math.min(...actionBarSlotHeights) <= 1
                    && Math.max(...actionBarSlotWidths) - Math.min(...actionBarSlotWidths) <= 1
                    && actionBarSlots.every((slot) => {
                        const button = slot.querySelector(".battle-action-slot__skill");
                        return hasNeutralScale(slot) && Boolean(button) && hasNeutralScale(button);
                    });
                checks.push(
                    createCheck(
                        "ActionBar mantém todos os slots na mesma escala e linha",
                        actionBarSlotsAligned,
                        actionBarSlotsAligned
                            ? `${actionBarSlots.length} slots alinhados sem escala externa`
                            : "slots com escala, altura ou alinhamento divergente"
                    )
                );
                Aethra.RenderEngine?.syncStageMode?.(previousBattleMode);

                Aethra.HuntAnalyzerWorkspace?.render?.();
                const analyzerDetails = document.querySelector("[data-analyzer-extended]");
                checks.push(
                    createCheck(
                        "Hunt Analyzer separa métricas rápidas da análise completa",
                        Boolean(analyzerDetails)
                            && document.querySelectorAll(".analyzer-ledger-card").length === 6,
                        `${document.querySelectorAll(".analyzer-ledger-card").length} métricas rápidas · detalhe ${analyzerDetails ? "disponível" : "ausente"}`
                    )
                );

                Aethra.WindowManager?.openWindow?.("inventory-view", {
                    source: "integration-hud-exclusive"
                });
                Aethra.WindowManager?.openWindow?.("skills-view", {
                    source: "integration-hud-exclusive"
                });
                const skillsRect = document.getElementById("skills-view")?.getBoundingClientRect?.();
                const topbarBottom = document.querySelector("#hud-layer .topbar, .topbar")
                    ?.getBoundingClientRect?.().bottom || 0;
                checks.push(
                    createCheck(
                        "Janelas do HUD são exclusivas e nunca ficam atrás da topbar",
                        Aethra.WindowManager?.config?.exclusive === true
                            && Aethra.WindowManager?.isOpen?.("skills-view") === true
                            && Aethra.WindowManager?.isOpen?.("inventory-view") === false
                            && Number(skillsRect?.top || 0) >= Number(topbarBottom) + 6,
                        `inventário ${Aethra.WindowManager?.isOpen?.("inventory-view") ? "aberto" : "fechado"} · skills y=${Math.round(skillsRect?.top || 0)} · topbar=${Math.round(topbarBottom)}`
                    )
                );
                Aethra.WindowManager?.closeAll?.({ modalOnly: true, silent: true });

                Aethra.WindowManager?.openWindow?.("npc-shop-view", {
                    source: "integration-responsive-shop"
                });
                const npcShopWindow = document.getElementById("npc-shop-view");
                const npcShopResponsive = Boolean(npcShopWindow)
                    && npcShopWindow.scrollWidth <= npcShopWindow.clientWidth + 4;
                const npcShopTabsWork = ["buy", "sell"].every((tab) => {
                    npcShopWindow?.querySelector(`[data-npc-tab='${tab}']`)?.click();
                    return npcShopWindow?.querySelector(`[data-npc-tab='${tab}']`)
                        ?.classList.contains("is-active") === true;
                });
                checks.push(
                    createCheck(
                        "Loja NPC respeita a largura da janela responsiva",
                        npcShopResponsive && npcShopTabsWork,
                        `conteúdo ${npcShopResponsive ? "ajustado" : "com overflow"} · abas ${npcShopTabsWork ? "ativas" : "inertes"}`
                    )
                );
                Aethra.WindowManager?.closeAll?.({ modalOnly: true, silent: true });

                checks.push(
                    createCheck(
                        "Camada moderna do HUD inicializa com preferências persistentes",
                        Aethra.HudModernization?.initialized === true
                            && typeof Aethra.HudModernization?.getPreferences === "function",
                        Aethra.HudModernization?.initialized ? "inicializada" : "não inicializada"
                    )
                );

                const responsiveProfiles = [
                    [1280, 720, "compact"],
                    [1366, 768, "compact"],
                    [1600, 900, "standard"],
                    [1920, 1080, "standard"],
                    [2560, 1440, "wide"],
                    [3440, 1440, "ultrawide"],
                    [3840, 2160, "wide"]
                ];
                const responsiveProfileMatches = responsiveProfiles.every(([width, height, expected]) => {
                    return Aethra.HudModernization?.getResponsiveProfile?.(width, height) === expected;
                });
                const currentResponsiveProfile = Aethra.HudModernization?.syncResponsiveProfile?.();
                checks.push(
                    createCheck(
                        "HUD classifica automaticamente monitores compactos, padrão, amplos e ultrawide",
                        responsiveProfileMatches
                            && document.body.dataset.hudViewport === currentResponsiveProfile?.profile,
                        responsiveProfileMatches
                            ? `perfil atual ${currentResponsiveProfile?.profile || "ausente"}`
                            : "matriz de perfis responsivos inconsistente"
                    )
                );

                const cityView = document.getElementById("city-view");
                const activeWindowsBeforeResize = [...(Aethra.WindowManager?.activeWindows || [])];
                if (cityView && Aethra.WindowManager) {
                    Aethra.WindowManager.activeWindows = [
                        ...new Set([...activeWindowsBeforeResize, "city-view"])
                    ];
                    window.dispatchEvent(new Event("resize"));
                }
                const cityViewRect = cityView?.getBoundingClientRect?.();
                const cityViewHasFloatingConstraint = [
                    "width",
                    "height",
                    "max-height",
                    "left",
                    "top",
                    "right",
                    "bottom",
                    "inset",
                    "transform"
                ].some((property) => Boolean(cityView?.style?.getPropertyValue?.(property)));
                if (Aethra.WindowManager) {
                    Aethra.WindowManager.activeWindows = activeWindowsBeforeResize;
                }
                checks.push(
                    createCheck(
                        "Redimensionar a tela não transforma o mundo em janela flutuante fixa",
                        Boolean(cityViewRect)
                            && !cityViewHasFloatingConstraint
                            && Math.abs(Number(cityViewRect?.width || 0) - window.innerWidth) <= 1,
                        cityViewHasFloatingConstraint
                            ? "city-view recebeu dimensões inline indevidas"
                            : `mundo fluido em ${Math.round(cityViewRect?.width || 0)}×${Math.round(cityViewRect?.height || 0)} px`
                    )
                );

                const visualGoldBefore = Number(Aethra.GameState.hero?.gold || 0);
                const visualXpBefore = Number(Aethra.GameState.hero?.xpTotal || 0);
                Aethra.TileMapCanvas?.start?.();
                Aethra.TileMapCanvas?.resize?.();
                const tileMapViewport = Aethra.TileMapCanvas?.getSnapshot?.().viewport;
                const tileMapCanvas = document.getElementById("tilemap-canvas");
                const tileMapParent = tileMapCanvas?.parentElement;
                const visibleMapArena = Number(tileMapParent?.clientWidth) > 0
                    && Number(tileMapParent?.clientHeight) > 0;
                checks.push(
                    createCheck(
                        "Mapa 2D cobre toda a arena sem distorcer os tiles",
                        Boolean(tileMapCanvas && tileMapParent)
                            && (!visibleMapArena || Math.abs(Number(tileMapCanvas.width) - Number(tileMapParent.clientWidth)) <= 1)
                            && (!visibleMapArena || Math.abs(Number(tileMapCanvas.height) - Number(tileMapParent.clientHeight)) <= 1)
                            && Number(tileMapViewport?.coveredWidth) >= Number(tileMapCanvas.width)
                            && Number(tileMapViewport?.coveredHeight) >= Number(tileMapCanvas.height),
                        `${tileMapCanvas?.width || 0}×${tileMapCanvas?.height || 0} px · arena ${tileMapParent?.clientWidth || 0}×${tileMapParent?.clientHeight || 0} · cobertura ${tileMapViewport?.coveredWidth || 0}×${tileMapViewport?.coveredHeight || 0}`
                    )
                );
                Aethra.TileMapCanvas?.triggerAttack?.({ side: "hero", hit: true, amount: 5, skillName: "Teste visual" });
                checks.push(
                    createCheck(
                        "Mapa 2D não possui economia ou combate paralelo",
                        Number(Aethra.GameState.hero?.gold || 0) === visualGoldBefore
                            && Number(Aethra.GameState.hero?.xpTotal || 0) === visualXpBefore,
                        `Gold ${visualGoldBefore} · XP ${visualXpBefore}, sem mutação visual`
                    )
                );

                const arenaQueueAfterCreation = Aethra.ColiseumSystem?.findMatch?.({ mode: "ranked" });
                const arenaStartAfterCreation = arenaQueueAfterCreation?.opponent
                    ? Aethra.ColiseumSystem?.startMatch?.()
                    : null;
                checks.push(
                    createCheck(
                        "Novo herói entra no Coliseu sem combate residual",
                        arenaStartAfterCreation?.success === true
                            && Aethra.GameState.battle?.source === "coliseum"
                            && Aethra.GameState.battle?.nonLethal === true
                            && Aethra.GameState.battle?.noRewards === true,
                        arenaStartAfterCreation?.success
                            ? `${arenaQueueAfterCreation.opponent.name} · duelo não letal iniciado`
                            : `falha: ${arenaStartAfterCreation?.reason || "sem adversário"}`
                    )
                );
                if (arenaStartAfterCreation?.success) {
                    Aethra.BattleSystem?.stopCombat?.("integration-cleanup");
                    if (Aethra.GameState.coliseum) Aethra.GameState.coliseum.activeMatch = null;
                }

                console.log(
                    "✅ Reatividade validada. XP atual:",
                    xpAfter.current
                );

                // 4. Testar persistência.
                let saveSucceeded = false;

                try {
                    saveSucceeded = Boolean(Aethra.SaveManager.save("integration-test"));

                    if (
                        typeof Aethra.SaveManager.exists === "function"
                    ) {
                        saveSucceeded = saveSucceeded && Aethra.SaveManager.exists();
                    }
                } catch (error) {
                    saveSucceeded = false;
                    checks.push(
                        createCheck("Persistência", false, error.message)
                    );
                }

                if (!checks.some((check) => check.check === "Persistência")) {
                    checks.push(
                        createCheck(
                            "Persistência",
                            saveSucceeded,
                            saveSucceeded
                                ? "Save armazenado no localStorage"
                                : "Save não confirmado"
                        )
                    );
                }

                console.log("✅ SaveManager validado.");

                const failedChecks = checks.filter((check) => !check.passed);
                const completedAt = Date.now();

                this.lastReport = {
                    success: failedChecks.length === 0,
                    startedAt,
                    completedAt,
                    durationMs: completedAt - startedAt,
                    xpBefore,
                    xpAfter,
                    bagBefore,
                    bagAfter,
                    generatedLoot: generatedLoot.length,
                    checks
                };

                this.running = false;
                this.completed = true;
                renderReport(this.lastReport);

                // 5. Relatório final.
                console.log("--- RELATÓRIO DE TESTES ---");
                console.table(checks);
                console.log("--- RELATÓRIO DE ESTADO ---");
                console.table(Aethra.GameState.hero);

                console.log(
                    this.lastReport.success
                        ? "%c✅ TESTE DE INTEGRAÇÃO CONCLUÍDO COM SUCESSO"
                        : "%c❌ TESTE DE INTEGRAÇÃO CONCLUÍDO COM FALHAS",
                    this.lastReport.success
                        ? "color: #00ff88; font-weight: bold;"
                        : "color: #ff5555; font-weight: bold;"
                );

                Aethra.EventBus.emit(
                    "IntegrationTestFinished",
                    this.lastReport
                );

                Aethra.EventBus.emit(
                    "integration:test-finished",
                    this.lastReport
                );
            }, 500);
        }
    };

    // Executa o teste após a engine carregar.
    Aethra.EventBus.on("EngineReady", () => {
        Aethra.IntegrationTest.run();
    });

    Aethra.EventBus.on("EngineError", (failure) => {
        Aethra.IntegrationTest.running = false;
        Aethra.IntegrationTest.completed = true;
        renderEngineFailure(failure);
    });
})(window.Aethra);
