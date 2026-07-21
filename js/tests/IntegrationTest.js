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
            const recommendedMasteryTotal = Object.values(
                Aethra.CharacterBuildSystem?.recommendedMasteries || {}
            ).reduce((sum, value) => sum + Number(value || 0), 0);
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
                    "Pontos iniciais para todos os tipos de skill",
                    Object.keys(Aethra.CharacterBuildSystem?.masteries || {}).length >= 10
                        && recommendedMasteryTotal === Aethra.CharacterBuildSystem.initialSkillPoints,
                    `${Object.keys(Aethra.CharacterBuildSystem?.masteries || {}).length} maestrias · ${recommendedMasteryTotal} pontos no preset`
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
                && entry.masteryTotal === Aethra.CharacterBuildSystem.initialSkillPoints
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
                        && Number(Aethra.GameState.hero?.disciplines?.sword?.uses) === Number(swordBefore.uses || 0) + 1,
                    `+${useProgress?.amount || 0} XP de Espadas em um uso`
                )
            );
            if (Aethra.GameState.hero?.disciplines) Aethra.GameState.hero.disciplines.sword = swordBefore;

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
                const playerHudSections = playerHud?.querySelectorAll(".player-hud-section") || [];
                const equipmentSlots = playerHud?.querySelectorAll(".player-equipment-slot") || [];
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
                            && playerHudSections.length === 4
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
                Aethra.EncounterCombatHUD?.resetHistory?.("integration_combat_hud");
                Aethra.EncounterCombatHUD?.pushEntry?.({
                    battleId: "integration_combat_hud",
                    round: 3,
                    actor: "hero",
                    actorName: "Aethra",
                    targetName: "Alvo de Teste",
                    ability: "Golpe Pesado",
                    outcome: "Crítico",
                    amount: 16,
                    tone: "critical"
                }, { render: false });
                Aethra.EncounterCombatHUD?.pushEntry?.({
                    battleId: "integration_combat_hud",
                    round: 3,
                    actor: "enemy",
                    actorName: "Alvo de Teste",
                    targetName: "Aethra",
                    ability: "Mordida",
                    outcome: "Errou",
                    amount: 0,
                    tone: "miss"
                }, { render: false });
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
                Aethra.EncounterCombatHUD?.resetHistory?.(null);
                Aethra.RenderEngine?.renderBattleCards?.();

                const vanguardPreset = Aethra.CharacterBuildSystem?.archetypes?.vanguard;
                const createdHero = vanguardPreset
                    ? Aethra.CharacterBuildSystem.createCharacter({
                        name: "Herói de Teste",
                        archetypeId: "vanguard",
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
                            && Number(Aethra.GameState.hero?.disciplines?.sword?.level) >= 4,
                        `${equippedStarter?.name || "sem arma"} · ${starterBar?.slots?.filter(Boolean).join(", ") || "sem técnicas"}`
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
