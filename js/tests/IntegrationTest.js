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
        "SpriteLoader",
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
        "RecipeCatalog",
        "EquipmentMaintenanceSystem",
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
        "ProfessionSpecializationUI",
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

            const questDefinitions = Object.entries(Aethra.GameData?.quests || {});
            const validQuestDefinitions = questDefinitions.filter(([questId, definition]) => {
                return Aethra.QuestSystem?.validateDefinition?.(definition, questId);
            });
            checks.push(
                createCheck(
                    "Missões oficiais seguem um contrato único",
                    questDefinitions.length > 0 && validQuestDefinitions.length === questDefinitions.length,
                    `${validQuestDefinitions.length}/${questDefinitions.length} definições válidas`
                )
            );

            const introQuestDefinitions = Object.keys(Aethra.ProfessionSystem?.introPaths || {})
                .map((professionId) => Aethra.ProfessionSystem?.getIntroQuestDefinition?.(professionId));
            checks.push(
                createCheck(
                    "Ofícios iniciais geram missões completas",
                    introQuestDefinitions.length > 0 && introQuestDefinitions.every((definition) => {
                        return Aethra.QuestSystem?.validateDefinition?.(definition, definition?.id);
                    }),
                    `${introQuestDefinitions.length} caminhos de ofício validados`
                )
            );

            const questReachability = Aethra.QuestSystem?.auditReachability?.();
            checks.push(
                createCheck(
                    "Missões só apontam para conteúdo alcançável",
                    questReachability?.valid === true,
                    questReachability?.valid
                        ? `${questReachability.checked} missões auditadas`
                        : JSON.stringify(questReachability?.issues || [])
                )
            );

            const legacyProfessionSave = Aethra.SaveManager?.migrateForTest?.({
                meta: { schemaVersion: 75 },
                hero: {
                    characterCreated: true,
                    introProfessionId: "mining",
                    introPrepared: null,
                    introProvisioned: null
                },
                playerEquipment: {
                    weapon: {
                        instanceId: "legacy_weapon",
                        templateId: "iron_sword",
                        slot: "weapon",
                        stackable: false
                    }
                },
                quests: { active: [], completed: [], available: [], rewardClaims: [], contractVersion: 3 }
            });
            const currentProfessionSave = Aethra.SaveManager?.migrateForTest?.({
                meta: { schemaVersion: 77 },
                hero: {
                    professionPerks: { mining: ["keen_vein", "specialization_extractor"] },
                    introPrepared: { mining: true },
                    introProvisioned: {}
                },
                maintenance: {
                    policy: { enabled: true, thresholdPercent: 30, reserveGold: 50, maxGoldPerCycle: 80 }
                }
            });
            checks.push(
                createCheck(
                    "Save v77 migra durabilidade e preserva políticas atuais",
                    legacyProfessionSave?.toVersion === 77
                        && legacyProfessionSave?.state?.meta?.schemaVersion === 77
                        && typeof legacyProfessionSave?.state?.hero?.professionPerks === "object"
                        && typeof legacyProfessionSave?.state?.hero?.introPrepared === "object"
                        && legacyProfessionSave?.state?.playerEquipment?.weapon?.durability?.current === 100
                        && legacyProfessionSave?.state?.maintenance?.policy?.enabled === false
                        && currentProfessionSave?.state?.hero?.professionPerks?.mining?.[0] === "keen_vein"
                        && currentProfessionSave?.state?.hero?.professionPerks?.mining?.[1] === "specialization_extractor"
                        && currentProfessionSave?.state?.maintenance?.policy?.enabled === true
                        && currentProfessionSave?.state?.maintenance?.policy?.thresholdPercent === 30,
                    `legado v${legacyProfessionSave?.fromVersion || "?"}→v${legacyProfessionSave?.toVersion || "?"} · ${currentProfessionSave?.state?.hero?.professionPerks?.mining?.length || 0} perks preservados`
                )
            );

            const maintenanceProbe = Aethra.ItemSystem?.generateItem?.("training_sword", {
                quality: 35,
                potential: 35,
                source: "integration-maintenance"
            });
            const maintenanceWear = Aethra.EquipmentMaintenanceSystem?.applyWear?.(
                maintenanceProbe,
                10,
                { emit: false, source: "integration-maintenance" }
            );
            maintenanceProbe.durability.current = 20;
            const lowDurabilityEffectiveness = Aethra.EquipmentMaintenanceSystem?.getEffectiveness?.(maintenanceProbe);
            maintenanceProbe.durability.current = 0;
            const brokenEffectiveness = Aethra.EquipmentMaintenanceSystem?.getEffectiveness?.(maintenanceProbe);
            checks.push(
                createCheck(
                    "Equipamentos nascem com durabilidade e perdem condição pelo domínio oficial",
                    maintenanceProbe?.durability?.max === 100
                        && maintenanceWear?.before === 100
                        && maintenanceWear?.after === 90,
                    `${maintenanceWear?.before ?? "?"}→${maintenanceWear?.after ?? "?"} de ${maintenanceProbe?.durability?.max || "?"}`
                )
            );
            checks.push(
                createCheck(
                    "Baixa durabilidade reduz atributos e item quebrado fica inativo",
                    Number(lowDurabilityEffectiveness) > 0.75
                        && Number(lowDurabilityEffectiveness) < 1
                        && brokenEffectiveness === 0,
                    `20% = ${Math.round(Number(lowDurabilityEffectiveness || 0) * 100)}% ativo · quebrado = ${brokenEffectiveness}`
                )
            );

            const maintenanceTransactionBackup = {
                bag: JSON.parse(JSON.stringify(Aethra.GameState.hero?.bag || [])),
                gold: Number(Aethra.GameState.hero?.gold || 0),
                maintenance: JSON.parse(JSON.stringify(Aethra.GameState.maintenance || {})),
                skillProgression: JSON.parse(JSON.stringify(Aethra.GameState.hero?.skillProgression || {})),
                professions: JSON.parse(JSON.stringify(Aethra.GameState.professions || {}))
            };
            maintenanceProbe.durability.current = 50;
            const repairMaterial = Aethra.ItemSystem?.generateItem?.("iron_ore", {
                quantity: 3,
                quality: 20,
                potential: 20,
                source: "integration-maintenance"
            });
            Aethra.BagSystem?.addItem?.(repairMaterial, "integration-maintenance");
            Aethra.GameState.hero.gold = 1000;
            const materialBeforeRepair = Aethra.BagSystem?.countItem?.("iron_ore") || 0;
            const repairResult = Aethra.EquipmentMaintenanceSystem?.repairItem?.(maintenanceProbe, {
                bypassStation: true,
                commandId: "integration-maintenance-repair",
                save: false,
                source: "integration-maintenance"
            });
            const duplicateRepair = Aethra.EquipmentMaintenanceSystem?.repairItem?.(maintenanceProbe, {
                bypassStation: true,
                commandId: "integration-maintenance-repair",
                save: false,
                source: "integration-maintenance"
            });
            const materialAfterRepair = Aethra.BagSystem?.countItem?.("iron_ore") || 0;
            checks.push(
                createCheck(
                    "Reparo consome material e Gold uma única vez e concede XP de ofício",
                    repairResult?.accepted === true
                        && maintenanceProbe.durability.current === maintenanceProbe.durability.max
                        && Number(repairResult.gold) > 0
                        && materialAfterRepair < materialBeforeRepair
                        && Number(repairResult.xp) > 0
                        && duplicateRepair?.reason === "duplicate-command",
                    repairResult?.accepted
                        ? `${repairResult.gold} G · ${repairResult.materialQuantity} material · +${repairResult.xp} XP`
                        : `falha: ${repairResult?.reason || "desconhecida"}`
                )
            );
            Aethra.GameState.hero.bag = maintenanceTransactionBackup.bag;
            Aethra.GameState.hero.gold = maintenanceTransactionBackup.gold;
            Aethra.GameState.maintenance = maintenanceTransactionBackup.maintenance;
            Aethra.GameState.hero.skillProgression = maintenanceTransactionBackup.skillProgression;
            Aethra.GameState.professions = maintenanceTransactionBackup.professions;

            const repairedLegacyQuest = Aethra.QuestSystem?.repairRuntimeQuest?.({
                id: "tutorial_first_steps",
                title: "Legacy",
                objectives: [
                    { id: "start_hunt", text: "Iniciar caçada", current: 1, required: 1 },
                    { id: "defeat_monsters", text: "Derrotar criaturas", current: 2, required: 3 }
                ],
                rewards: { xp: 50, gold: 100 }
            }, "active");
            checks.push(
                createCheck(
                    "Migração repara missões antigas sem perder progresso",
                    repairedLegacyQuest?.title === "Primeiros Passos em Aethra"
                        && repairedLegacyQuest.objectives?.[0]?.type === "StartHunt"
                        && repairedLegacyQuest.objectives?.[0]?.completed === true
                        && repairedLegacyQuest.objectives?.[1]?.type === "DefeatInHunt"
                        && repairedLegacyQuest.objectives?.[1]?.progress === 2,
                    repairedLegacyQuest
                        ? `${repairedLegacyQuest.objectives[0].progress}/${repairedLegacyQuest.objectives[0].required} e ${repairedLegacyQuest.objectives[1].progress}/${repairedLegacyQuest.objectives[1].required}`
                        : "missão não reparada"
                )
            );

            const routeBackup = {
                hero: JSON.parse(JSON.stringify(Aethra.GameState.hero || {})),
                quests: JSON.parse(JSON.stringify(Aethra.GameState.quests || {})),
                ui: JSON.parse(JSON.stringify(Aethra.GameState.ui || {})),
                policies: JSON.parse(JSON.stringify(Aethra.GameState.professionPolicies || {})),
                exploration: JSON.parse(JSON.stringify(Aethra.GameState.exploration || {})),
                questIds: new Set(Object.keys(Aethra.GameData.quests || {}))
            };
            const introRouteResults = Object.keys(Aethra.ProfessionSystem?.introPaths || {}).map((professionId) => {
                Aethra.GameState.hero.introProfessionId = professionId;
                Aethra.GameState.hero.introProvisioned = {};
                Aethra.GameState.quests = {
                    contractVersion: Aethra.QuestSystem.CONTRACT_VERSION,
                    active: [], completed: [], available: [], rewardClaims: []
                };
                Aethra.GameState.ui.trackedQuestId = null;
                const bridge = Aethra.QuestSystem.acceptQuest("tutorial_first_hunt");
                const bridgeGuidance = Aethra.QuestSystem.getGuidance(bridge);
                Aethra.QuestSystem.updateProgress("DefeatInHunt", "whispering_forest", 5, { source: "integration-route" });
                const mentor = Aethra.QuestSystem.getQuest("tutorial_profession_mentor");
                Aethra.EntityManager.interactWithEntity("profession_mentor", { source: "integration-route" });
                const introId = `intro_profession_${professionId}`;
                const intro = Aethra.QuestSystem.getQuest(introId);
                const queuedGuarantee = Aethra.GameState.exploration?.tutorialGuarantee || null;
                const provisionedAtStart = professionId !== "blacksmithing"
                    || intro?.objectives?.find((objective) => objective.id === "receive_training_ore")?.completed === true;
                let guidedWorkshopVisible = true;
                if (professionId === "blacksmithing") {
                    Aethra.ProfessionWorkshopUI?.open?.("blacksmithing", "forge", {
                        recipeId: "smelt_iron",
                        source: "integration-route"
                    });
                    guidedWorkshopVisible = Boolean(
                        document.querySelector('.workshop-recipe.is-guided [data-craft-recipe="smelt_iron"]')
                        && document.querySelector(".profession-workshop__guidance")
                    );
                    Aethra.WindowManager?.closeWindow?.("profession-workshop-view", { source: "integration-route" });
                }
                let guidedEncounterIdentified = true;
                if (["mining", "herbalism"].includes(professionId)) {
                    const previousHuntId = Aethra.GameState.hunt?.huntId || null;
                    Aethra.GameState.hunt = Aethra.GameState.hunt || {};
                    Aethra.GameState.hunt.huntId = queuedGuarantee?.huntId || "whispering_forest";
                    const previewEvent = Aethra.ExplorationSystem?.pickEvent?.() || {};
                    Aethra.GameState.hunt.huntId = previousHuntId;
                    guidedEncounterIdentified = previewEvent.tutorialGuaranteed === true
                        && previewEvent.tutorialLabel === "OBJETIVO DE OFÍCIO"
                        && String(previewEvent.title || "").includes("Treinamento de");
                }
                (intro?.objectives || []).forEach((objective) => {
                    Aethra.QuestSystem.updateProgress(
                        objective.type,
                        objective.target,
                        objective.required,
                        { source: "integration-route" }
                    );
                });
                return {
                    professionId,
                    bridgeCompleted: Aethra.QuestSystem.getQuest("tutorial_first_hunt")?.status === "completed",
                    mentorCompleted: Aethra.QuestSystem.getQuest("tutorial_profession_mentor")?.status === "completed",
                    introCompleted: Aethra.QuestSystem.getQuest(introId)?.status === "completed",
                    perkUnlocked: Aethra.ProfessionSystem.hasPerk(professionId, Aethra.ProfessionSystem.getIntroPerk(professionId)?.id),
                    perkModifiers: Aethra.ProfessionSystem.getPerkModifiers(professionId),
                    objectiveTypes: intro?.objectives?.map((objective) => objective.type) || [],
                    guaranteeEventId: queuedGuarantee?.professionId === professionId ? queuedGuarantee.eventId : null,
                    provisionedAtStart,
                    guidedWorkshopVisible,
                    guidedEncounterIdentified,
                    bridgeAction: bridgeGuidance?.action || null,
                    accepted: Boolean(bridge && mentor && intro)
                };
            });
            Aethra.GameState.hero = routeBackup.hero;
            Aethra.GameState.quests = routeBackup.quests;
            Aethra.GameState.ui = routeBackup.ui;
            Aethra.GameState.professionPolicies = routeBackup.policies;
            Aethra.GameState.exploration = routeBackup.exploration;
            Object.keys(Aethra.GameData.quests || {}).forEach((questId) => {
                if (!routeBackup.questIds.has(questId) && questId.startsWith("intro_profession_")) {
                    delete Aethra.GameData.quests[questId];
                }
            });
            checks.push(
                createCheck(
                    "As quatro rotas iniciais podem ser concluídas",
                    introRouteResults.length === 4 && introRouteResults.every((route) => {
                        const expectedGuarantee = {
                            mining: "mining",
                            skinning: "creature-harvest",
                            herbalism: "herb"
                        }[route.professionId];
                        return route.accepted
                            && route.bridgeCompleted
                            && route.mentorCompleted
                            && route.introCompleted
                            && route.perkUnlocked
                            && route.provisionedAtStart
                            && route.guidedWorkshopVisible
                            && route.guidedEncounterIdentified
                            && route.bridgeAction === "focus-hunt"
                            && (expectedGuarantee ? route.guaranteeEventId === expectedGuarantee : true);
                    }),
                    introRouteResults.map((route) => `${route.professionId}:${route.introCompleted ? "ok" : "falhou"}/oficina:${route.guidedWorkshopVisible ? "ok" : "falhou"}/encontro:${route.guidedEncounterIdentified ? "ok" : "falhou"}`).join(" · ")
                )
            );
            const expectedIntroModifiers = {
                mining: { yieldPercent: 5 },
                skinning: { yieldPercent: 5 },
                herbalism: { extraResourceChance: 0.08 },
                blacksmithing: { craftQuality: 3 }
            };
            checks.push(
                createCheck(
                    "Cada rota concede um benefício permanente funcional",
                    introRouteResults.every((route) => Object.entries(expectedIntroModifiers[route.professionId] || {})
                        .every(([key, value]) => route.perkModifiers?.[key] === value)),
                    introRouteResults.map((route) => `${route.professionId}:${JSON.stringify(route.perkModifiers)}`).join(" · ")
                )
            );
            const liveMentor = Aethra.EntityManager?.getEntity?.("profession_mentor");
            const entityStateBackup = JSON.parse(JSON.stringify(Aethra.GameState.entities || { list: [] }));
            Aethra.GameState.entities.list = Aethra.GameState.entities.list
                .filter((entity) => entity.id !== "profession_mentor");
            const restoredDefaultCount = Aethra.EntityManager?.seedDefaultEntities?.();
            const restoredMentor = Aethra.EntityManager?.getEntity?.("profession_mentor");
            Aethra.GameState.entities = entityStateBackup;
            checks.push(
                createCheck(
                    "Mestra Ilyra existe e é restaurada em saves antigos",
                    liveMentor?.metadata?.role === "profession_mentor"
                        && restoredDefaultCount === 1
                        && restoredMentor?.metadata?.role === "profession_mentor",
                    restoredMentor?.name || "NPC ausente"
                )
            );
            const mentorPanelOpened = Aethra.RenderEngine?.openProfessionMentor?.();
            const mentorPanel = document.getElementById("profession-mentor-view");
            const mentorCurrentGuidance = Aethra.QuestSystem?.getGuidance?.();
            const mentorPanelFunctional = Boolean(
                mentorPanelOpened
                && mentorPanel?.textContent?.includes("SUA ROTA INICIAL")
                && mentorPanel?.textContent?.includes("BENEFÍCIO PERMANENTE")
                && (!mentorCurrentGuidance || mentorPanel?.querySelector?.("[data-mentor-follow-guidance]"))
            );
            Aethra.WindowManager?.closeWindow?.("profession-mentor-view", { source: "integration-route" });
            checks.push(
                createCheck(
                    "Ilyra apresenta rota, lição, benefício e próximo passo",
                    mentorPanelFunctional,
                    mentorPanelFunctional ? "painel orientador completo" : "painel incompleto ou inerte"
                )
            );

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

            /*
             * O seed de relíquias do mundo é determinístico e reconstruído no
             * boot: ele não pode ser gravado no save (chegou a ocupar 68% do
             * arquivo). O estado vivo, porém, precisa continuar completo.
             */
            const rankingState = Aethra.GameState.world?.itemRanking || {};
            const liveRankingEntries = Object.values(rankingState.registry || {});
            const liveSeedEntries = liveRankingEntries.filter((entry) => entry?.source === "world-seed");
            const rankingSnapshotForSave = Aethra.SaveManager?.serializeStateForTest?.("world.itemRanking");
            const persistedRankingEntries = Object.values(rankingSnapshotForSave?.registry || {});
            const persistedSeedEntries = persistedRankingEntries.filter((entry) => entry?.source === "world-seed");
            checks.push(
                createCheck(
                    "Save não persiste o seed regenerável do ranking",
                    Boolean(rankingSnapshotForSave)
                        && liveSeedEntries.length > 0
                        && persistedSeedEntries.length === 0
                        && rankingSnapshotForSave.worldSeeded === false
                        && persistedRankingEntries.length === liveRankingEntries.length - liveSeedEntries.length,
                    rankingSnapshotForSave
                        ? `${liveSeedEntries.length} seeds vivos · ${persistedRankingEntries.length} entrada(s) gravada(s)`
                        : "serializador do ranking não registrado"
                )
            );

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

            const specializationBackup = {
                perks: JSON.parse(JSON.stringify(Aethra.GameState.hero.professionPerks || {})),
                mining: JSON.parse(JSON.stringify(Aethra.GameState.hero.disciplines.mining || {}))
            };
            Aethra.GameState.hero.professionPerks.mining = [];
            Aethra.GameState.hero.disciplines.mining.level = 9;
            Aethra.GameState.hero.disciplines.mining.xpNext = Aethra.XPSystem.getSkillXPRequired(9);
            const specializationLocked = Aethra.ProfessionSystem.canChooseSpecialization("mining", "extractor");
            Aethra.GameState.hero.disciplines.mining.level = 10;
            Aethra.GameState.hero.disciplines.mining.xpNext = Aethra.XPSystem.getSkillXPRequired(10);
            const specializationChosen = Aethra.ProfessionSystem.chooseSpecialization("mining", "extractor", { source: "integration", save: false });
            const specializationRejected = Aethra.ProfessionSystem.chooseSpecialization("mining", "prospector", { source: "integration", save: false });
            Aethra.GameState.hero.disciplines.mining.level = 60;
            const level60Yield = Number(Aethra.ProfessionSystem.getSpecializationModifiers("mining").yieldPercent || 0);
            Aethra.GameState.hero.disciplines.mining.level = 85;
            const level85Yield = Number(Aethra.ProfessionSystem.getSpecializationModifiers("mining").yieldPercent || 0);
            Aethra.GameState.hero.disciplines.mining.level = 110;
            const level110Yield = Number(Aethra.ProfessionSystem.getSpecializationModifiers("mining").yieldPercent || 0);
            Aethra.GameState.hero.disciplines.mining.level = 135;
            const level135Yield = Number(Aethra.ProfessionSystem.getSpecializationModifiers("mining").yieldPercent || 0);
            checks.push(
                createCheck(
                    "Especialização exige nível 10, é exclusiva e segue sem teto",
                    specializationLocked?.reason === "insufficient-level"
                        && specializationChosen?.accepted === true
                        && specializationRejected?.reason === "specialization-already-chosen"
                        && level60Yield === 12
                        && level85Yield > level60Yield
                        && level110Yield > level85Yield
                        && level135Yield > level110Yield
                        && (level135Yield - level110Yield) < (level110Yield - level85Yield),
                    `NV60 +${level60Yield.toFixed(2)}% · NV85 +${level85Yield.toFixed(2)}% · NV110 +${level110Yield.toFixed(2)}% · NV135 +${level135Yield.toFixed(2)}%`
                )
            );
            Aethra.ProfessionSpecializationUI?.open?.("mining");
            const specializationWindow = document.getElementById("profession-specialization-view");
            const specializationUIWorks = Boolean(specializationWindow)
                && specializationWindow.querySelectorAll(".profession-specialization__branch").length === 2
                && specializationWindow.querySelectorAll(".profession-specialization__branch li").length === 6
                && specializationWindow.textContent.includes("MAESTRIA INFINITA")
                && specializationWindow.querySelector(".profession-specialization__branch.is-chosen");
            checks.push(
                createCheck(
                    "Árvore de ofício mostra escolha, marcos e maestria infinita",
                    specializationUIWorks,
                    specializationUIWorks ? "2 caminhos · 6 marcos · escolha ativa" : "árvore incompleta"
                )
            );
            Aethra.WindowManager?.closeWindow?.("profession-specialization-view", { source: "integration", silent: true });

            Aethra.GameState.hero.professionPerks.mining = [];
            Aethra.GameState.hero.disciplines.mining.level = 10;
            Aethra.ProfessionSystem.chooseSpecialization("mining", "prospector", { source: "integration", save: false });
            Aethra.GameState.hero.disciplines.mining.level = 60;
            Aethra.ExplorationSystem.setRandomSource(() => 0.99);
            const specializedOre = Aethra.ExplorationSystem.generateRewards({ id: "mining", professionId: "mining" }, {});
            Aethra.ExplorationSystem.setRandomSource(Math.random);
            checks.push(
                createCheck(
                    "Especialização de coleta altera o recurso oficial gerado",
                    Number(specializedOre?.items?.[0]?.quality) === 30,
                    `qualidade do minério ${specializedOre?.items?.[0]?.quality || 0}`
                )
            );
            Aethra.GameState.hero.professionPerks = specializationBackup.perks;
            Aethra.GameState.hero.disciplines.mining = specializationBackup.mining;

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
                perks: JSON.parse(JSON.stringify(Aethra.GameState.hero.professionPerks || {})),
                crafting: JSON.parse(JSON.stringify(Aethra.GameState.crafting || null)),
                hunt: JSON.parse(JSON.stringify(Aethra.GameState.hunt || {}))
            };
            Aethra.GameState.hunt.isActive = false;
            Aethra.GameState.hero.disciplines.blacksmithing.level = 4;
            Aethra.GameState.hero.disciplines.blacksmithing.xpNext = Aethra.XPSystem.getSkillXPRequired(4);
            Aethra.GameState.hero.disciplines.blacksmithing.trainingMode = "training";

            // --- Testes do catálogo declarativo de receitas ---
            const catalogAll = Aethra.RecipeCatalog?.all?.() || [];
            const catalogBySmith = Aethra.RecipeCatalog?.byProfession?.("blacksmithing") || [];
            const catalogTier3 = catalogAll.filter((recipe) => recipe.tier === 3);
            const catalogReferencesExist = catalogAll.every((recipe) =>
                [...recipe.inputs, ...recipe.outputs].every((entry) =>
                    Boolean(Aethra.GameData?.items?.[entry.itemId] || Aethra.ItemSystem?.templates?.[entry.itemId])
                )
            );
            checks.push(
                createCheck(
                    "RecipeCatalog contém receitas declarativas",
                    catalogAll.length >= 28
                        && catalogBySmith.length >= 14
                        && catalogTier3.length === 8
                        && catalogReferencesExist
                        && catalogAll.every((r) => r.id && r.professionId && r.unlockLevel >= 1 && r.tier >= 1),
                    `${catalogAll.length} total · ${catalogBySmith.length} Forjaria · tiers OK`
                )
            );

            const leatherRecipeOutputs = catalogAll
                .filter((recipe) => recipe.professionId === "leatherworking" && recipe.action === "craft-leather")
                .flatMap((recipe) => recipe.outputs)
                .map((output) => Aethra.GameData?.items?.[output.itemId] || Aethra.ItemSystem?.templates?.[output.itemId]);
            checks.push(
                createCheck(
                    "Couraria fabrica armaduras leves próprias",
                    leatherRecipeOutputs.length >= 10
                        && leatherRecipeOutputs.every((template) => template?.armorType === "leather"),
                    `${leatherRecipeOutputs.length} peças leves próprias`
                )
            );

            const specterDrops = Aethra.EarlyGameItemCatalog?.getCreatureDrops?.("specter-xmm-2024") || [];
            const clawHasSource = Object.values(Aethra.EarlyGameItemCatalog?.creatureTables || {})
                .some((table) => table.some((drop) => drop.id === "chipped_claw"));
            checks.push(
                createCheck(
                    "Materiais especiais possuem fonte de loot",
                    Boolean(Aethra.GameData?.items?.shadow_thread)
                        && Boolean(Aethra.GameData?.items?.chipped_claw)
                        && specterDrops.some((drop) => drop.id === "shadow_thread")
                        && clawHasSource,
                    `Fio Sombrio ${specterDrops.some((drop) => drop.id === "shadow_thread") ? "na Cripta" : "sem fonte"} · Garra ${clawHasSource ? "em feras" : "sem fonte"}`
                )
            );

            // Garantir estado de crafting com array discovered
            Aethra.CraftingSystem.ensureState();
            const discoveredBefore = (Aethra.GameState.crafting.discovered || []).slice();

            // Descobre starters de Forjaria para o teste de craft a seguir
            const starterIds = Aethra.RecipeCatalog?.starterIds?.("blacksmithing") || [];
            starterIds.forEach((id) => Aethra.CraftingSystem.discoverRecipe(id, { save: false }));
            const discoveredAfterSeed = (Aethra.GameState.crafting.discovered || []).length;
            checks.push(
                createCheck(
                    "Receitas iniciais são descobertas automaticamente",
                    starterIds.length >= 5 && discoveredAfterSeed >= starterIds.length
                        && Aethra.CraftingSystem.isDiscovered("smelt_iron")
                        && Aethra.CraftingSystem.isDiscovered("forge_iron_sword"),
                    `${starterIds.length} starters · descobertas: ${discoveredAfterSeed}`
                )
            );

            // Receitas T2 não devem estar descobertas antes de atingir nv 5
            const t2BeforeLevel = Aethra.CraftingSystem.isDiscovered("smelt_steel");
            // Simular rankUp para nv 5
            const discoveredByRankUp = Aethra.CraftingSystem.discoverByProfessionLevel("blacksmithing", 5);
            const t2AfterLevel = Aethra.CraftingSystem.isDiscovered("smelt_steel");
            checks.push(
                createCheck(
                    "Receitas T2 só aparecem após atingir nível de ofício",
                    t2BeforeLevel === false && t2AfterLevel === true && discoveredByRankUp.includes("smelt_steel"),
                    `antes nv5: ${t2BeforeLevel} · após nv5: ${t2AfterLevel} · descobertas: ${discoveredByRankUp.length}`
                )
            );

            const tier3Ids = catalogTier3.map((recipe) => recipe.id);
            Aethra.GameState.crafting.discovered = Aethra.GameState.crafting.discovered
                .filter((recipeId) => !tier3Ids.includes(recipeId));
            const tier3AtNine = Aethra.CraftingSystem.discoverByProfessionLevel("blacksmithing", 9);
            const tier3Reconciled = Aethra.CraftingSystem.reconcileDiscoveries({
                levels: { blacksmithing: 10, leatherworking: 10 },
                save: false
            });
            checks.push(
                createCheck(
                    "Save existente recebe Tier 3 exatamente no nível 10",
                    tier3AtNine.every((recipeId) => !tier3Ids.includes(recipeId))
                        && tier3Ids.every((recipeId) => Aethra.CraftingSystem.isDiscovered(recipeId))
                        && tier3Reconciled.filter((recipeId) => tier3Ids.includes(recipeId)).length === tier3Ids.length,
                    `nv9 ${tier3AtNine.length} novas · reconciliação T3 ${tier3Reconciled.filter((recipeId) => tier3Ids.includes(recipeId)).length}/${tier3Ids.length}`
                )
            );

            Aethra.ProfessionWorkshopUI?.render?.();
            const sourceGuidance = document.querySelector("#profession-workshop-view .workshop-recipe__source");
            checks.push(
                createCheck(
                    "Oficina orienta onde conseguir materiais raros",
                    Boolean(sourceGuidance?.textContent?.includes("ONDE CONSEGUIR")),
                    sourceGuidance ? sourceGuidance.textContent.trim() : "orientação ausente"
                )
            );

            // Receitas não descobertas retornam pela API correta
            const undiscoveredLeather = Aethra.CraftingSystem.getUndiscovered("leatherworking");
            Aethra.CraftingSystem.discoverStarters("leatherworking");
            const leatherKnown = Aethra.CraftingSystem.getRecipes("leatherworking");
            checks.push(
                createCheck(
                    "getRecipes retorna só receitas descobertas e getUndiscovered o restante",
                    leatherKnown.length >= 5
                        && leatherKnown.every((r) => Aethra.CraftingSystem.isDiscovered(r.id)),
                    `Couraria: ${leatherKnown.length} conhecidas`
                )
            );
            // ---

            const testIngots = Aethra.ItemSystem.generateItem("refined_ingot", { quantity: 6, quality: 20, potential: 20, source: "integration" });
            Aethra.BagSystem.addItem(testIngots, "integration");
            const ingotsBeforeCraft = Aethra.BagSystem.countItem("refined_ingot");
            Aethra.GameState.hero.disciplines.blacksmithing.level = 10;
            Aethra.GameState.hero.disciplines.blacksmithing.xpNext = Aethra.XPSystem.getSkillXPRequired(10);
            Aethra.GameState.hero.professionPerks.blacksmithing = [];
            Aethra.ProfessionSystem.chooseSpecialization("blacksmithing", "forge_rhythm", { source: "integration", save: false });
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
                        && craftedSword.xp?.accepted === true
                        && craftedSword.professionXp > craftedSword.baseXp,
                    craftedSword?.accepted ? `${craftedSword.outputs[0].name} · qualidade ${craftedSword.outputs[0].quality} · XP ${craftedSword.baseXp}→${craftedSword.professionXp}` : craftedSword?.reason
                )
            );

            [
                ["steel_ingot", 6],
                ["aether_fragment", 6],
                ["monster_core", 3]
            ].forEach(([templateId, quantity]) => {
                const material = Aethra.ItemSystem.generateItem(templateId, {
                    quantity, quality: 40, potential: 40, source: "integration-tier3"
                });
                Aethra.BagSystem.addItem(material, "integration-tier3");
            });
            Aethra.CraftingSystem.setRandomSource(() => 0.5);
            const temperedAlloy = Aethra.CraftingSystem.craft("temper_aether_alloy", {
                stationId: "forge", techniqueId: "balanced", quantity: 3, commandId: "integration-temper-tier3"
            });
            const craftedAetherSword = Aethra.CraftingSystem.craft("forge_aether_sword", {
                stationId: "forge", techniqueId: "balanced", quantity: 1, commandId: "integration-forge-tier3"
            });
            Aethra.CraftingSystem.resetRandomSource();
            checks.push(
                createCheck(
                    "Tier 3 completa loot, refino e equipamento raro",
                    temperedAlloy?.accepted === true
                        && craftedAetherSword?.accepted === true
                        && craftedAetherSword.outputs?.[0]?.templateId === "eg_sword_l10"
                        && craftedAetherSword.outputs?.[0]?.crafting?.recipeId === "forge_aether_sword",
                    temperedAlloy?.accepted && craftedAetherSword?.accepted
                        ? `${temperedAlloy.outputs.length} ligas → ${craftedAetherSword.outputs[0].name}`
                        : `${temperedAlloy?.reason || "liga falhou"} · ${craftedAetherSword?.reason || "arma falhou"}`
                )
            );
            Aethra.GameState.hero.bag = craftingBackup.bag;
            Aethra.GameState.hero.disciplines.blacksmithing = craftingBackup.discipline;
            Aethra.GameState.hero.professionPerks = craftingBackup.perks;
            Aethra.GameState.crafting = craftingBackup.crafting || { completed: 0, recipeCounts: {}, processedCommands: [], discovered: discoveredBefore };
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
            const creationArchetypes = document.querySelectorAll(".creation-archetype");
            const creationSubmit = document.querySelector("[data-create-character]");
            const creationAttributes = document.querySelectorAll("[data-creation-adjust]");
            const creationProfessions = document.querySelectorAll(".creation-profession-btn");
            checks.push(
                createCheck(
                    "Criação em página única com arquétipos, atributos e ofício",
                    creationArchetypes.length >= 5
                        && Boolean(creationSubmit)
                        && creationAttributes.length >= 6
                        && creationProfessions.length >= 1,
                    `${creationArchetypes.length} arquétipos · ${creationAttributes.length} controles de atributo · ${creationProfessions.length} ofícios`
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

            const questTransactionBefore = {
                hero: JSON.parse(JSON.stringify(Aethra.GameState.hero || {})),
                hunt: JSON.parse(JSON.stringify(Aethra.GameState.hunt || {})),
                quests: JSON.parse(JSON.stringify(Aethra.GameState.quests || {})),
                ui: JSON.parse(JSON.stringify(Aethra.GameState.ui || {}))
            };
            const rewardQuestId = "integration_quest_reward_once";
            const rewardGoldBefore = Number(Aethra.GameState.hero?.gold || 0);
            const rewardXpBefore = Number(Aethra.GameState.hero?.xpTotal || 0);
            const rewardItemsBefore = Aethra.BagSystem?.countItem?.("potion_health") || 0;
            Aethra.QuestSystem?.registerQuest?.(rewardQuestId, {
                title: "Contrato de Recompensa",
                description: "Missão isolada do teste de integração.",
                objectives: [{
                    id: "defeat_alias_target",
                    type: "DefeatEnemy",
                    target: "forest_wolf",
                    label: "Derrote um lobo",
                    required: 1
                }],
                reward: {
                    xp: 3,
                    gold: 7,
                    items: [{ templateId: "potion_health", quantity: 1 }]
                }
            });
            Aethra.QuestSystem?.acceptQuest?.(rewardQuestId);
            Aethra.QuestSystem?.updateProgress?.("DefeatEnemy", "wolf-xmm-2024", 1, {
                source: "integration-quest-alias"
            });
            const rewardedQuest = Aethra.QuestSystem?.getQuest?.(rewardQuestId);
            const rewardDeltas = {
                gold: Number(Aethra.GameState.hero?.gold || 0) - rewardGoldBefore,
                xp: Number(Aethra.GameState.hero?.xpTotal || 0) - rewardXpBefore,
                items: (Aethra.BagSystem?.countItem?.("potion_health") || 0) - rewardItemsBefore
            };
            Aethra.QuestSystem?.finishQuest?.(rewardQuestId);
            const rewardDeltasAfterRetry = {
                gold: Number(Aethra.GameState.hero?.gold || 0) - rewardGoldBefore,
                xp: Number(Aethra.GameState.hero?.xpTotal || 0) - rewardXpBefore,
                items: (Aethra.BagSystem?.countItem?.("potion_health") || 0) - rewardItemsBefore
            };
            checks.push(
                createCheck(
                    "Aliases de criatura avançam a missão oficial",
                    rewardedQuest?.status === "completed"
                        && rewardedQuest.objectives?.[0]?.completed === true,
                    rewardedQuest?.status || "missão não concluída"
                )
            );
            checks.push(
                createCheck(
                    "Recompensas de missão são entregues exatamente uma vez",
                    rewardDeltas.gold === 7
                        && rewardDeltas.xp === 3
                        && rewardDeltas.items === 1
                        && JSON.stringify(rewardDeltasAfterRetry) === JSON.stringify(rewardDeltas),
                    `${rewardDeltas.xp} XP · ${rewardDeltas.gold} G · ${rewardDeltas.items} item`
                )
            );
            delete Aethra.GameData.quests[rewardQuestId];
            restoreEnumerableState(Aethra.GameState.hero, questTransactionBefore.hero);
            restoreEnumerableState(Aethra.GameState.hunt, questTransactionBefore.hunt);
            Aethra.GameState.quests = Aethra.GameState.quests || {};
            restoreEnumerableState(Aethra.GameState.quests, questTransactionBefore.quests);
            Aethra.GameState.ui = Aethra.GameState.ui || {};
            restoreEnumerableState(Aethra.GameState.ui, questTransactionBefore.ui);

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

            queueMicrotask(() => {
                try {
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
                    ".hero-hub--cockpit .player-equipment-matrix"
                );
                const playerHudSections = playerHud?.querySelectorAll(".player-hud-section") || [];
                const equipmentSlots = playerFixedEquipment?.querySelectorAll(".player-equipment-slot") || [];
                const skillCategories = playerHud?.querySelectorAll("[data-skill-category-select] option") || [];
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
                const heroHubBounds = document.querySelector("[data-hero-hub]")?.getBoundingClientRect?.();
                const compactEquipmentFits = window.innerHeight > 820 || [...equipmentSlots].every((slot) => {
                    const bounds = slot.getBoundingClientRect();
                    return bounds.left >= heroHubBounds.left - 1 && bounds.right <= heroHubBounds.right + 1;
                });
                checks.push(
                    createCheck(
                        "Faixa compacta mantém os onze equipamentos dentro da Central",
                        Boolean(heroHubBounds) && compactEquipmentFits,
                        compactEquipmentFits ? "11/11 slots dentro da coluna" : "há slot cortado na lateral"
                    )
                );
                checks.push(
                    createCheck(
                        "Skills organizadas por categoria",
                        skillCategories.length >= 4 && Boolean(playerHud?.querySelector("[data-player-skill-search]")),
                        `${skillCategories.length} categorias com busca`
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
                // As abas de inteligência são montadas por UIFluidityPass de forma
                // orientada a eventos; força a montagem síncrona para o teste.
                Aethra.UIFluidityPass?.enhance?.();
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
                const primaryAttackCards = document.querySelectorAll("#primary-attack-bar .primary-attack-card");
                const survivalResources = document.querySelectorAll(".modern-combat-summary__resources [data-modern-resource]");
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

                Aethra.RenderEngine?.renderQuestTracker?.();
                const trackedIntroQuest = Aethra.QuestSystem?.getTrackedQuest?.();
                const trackedGuidance = Aethra.QuestSystem?.getGuidance?.(trackedIntroQuest);
                const questTrackerSlots = [...document.querySelectorAll("[data-quest-tracker-slot]")];
                checks.push(
                    createCheck(
                        "HUD da jornada mostra objetivo e próximo passo",
                        trackedIntroQuest?.id === "tutorial_first_steps"
                            && trackedGuidance?.action === "open-hunt-map"
                            && questTrackerSlots.length === 2
                            && questTrackerSlots.every((slot) => {
                                return slot.hidden === false
                                    && Boolean(slot.querySelector("[data-quest-next-action]"))
                                    && /Primeiros Passos/.test(slot.textContent || "");
                            }),
                        `${questTrackerSlots.length}/2 pontos da HUD · ação ${trackedGuidance?.actionLabel || "ausente"}`
                    )
                );

                const starterSkillRequirement = Aethra.SkillSystem
                    ?.getSkillRequirement?.("precise_strike");
                checks.push(
                    createCheck(
                        "Espada inicial libera a técnica de Espadas",
                        starterSkillRequirement?.usable === true,
                        starterSkillRequirement?.reason || "Golpe Preciso utilizável"
                    )
                );

                const heroSpriteSources = archetypes.map((entry) =>
                    Aethra.SpriteLoader?.getHeroSource?.(entry.id)
                );
                checks.push(
                    createCheck(
                        "Retratos do herói usam frames individuais por arquétipo",
                        heroSpriteSources.every((source) =>
                            /^assets\/entities\/.+\.png$/i.test(String(source || ""))
                            && !/Fighter2_(?:Idle|Walk)_without_shadow/i.test(String(source))
                        ),
                        `${new Set(heroSpriteSources).size} sprites individuais`
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
                // Isola o cenário: sem pilha pré-existente, a compra cria uma
                // pilha nova e a devolução localiza a mesma instância comprada.
                Aethra.GameState.hero.bag = (Aethra.GameState.hero.bag || []).filter(
                    (item) => (item.templateId || item.id) !== "potion_health"
                );
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

                /*
                 * Regressão: comprar um empilhável que já existe na mochila
                 * funde as pilhas. A devolução precisa achar a pilha real e
                 * reembolsar somente as unidades compradas, deixando o loot.
                 */
                Aethra.GameState.hero.bag = (Aethra.GameState.hero.bag || []).filter(
                    (item) => (item.templateId || item.id) !== "potion_health"
                );
                const lootedPotions = Aethra.ItemSystem?.generateItem?.("potion_health", {
                    quantity: 4,
                    source: "integration-loot"
                });
                if (lootedPotions) Aethra.BagSystem?.addItems?.([lootedPotions], "integration-loot");
                const mergedGoldBefore = Number(Aethra.GameState.hero?.gold || 0);
                const mergedPurchase = Aethra.MarketplaceSystem?.buyItem?.("potion_health", 2);
                const mergedStack = mergedPurchase?.items?.[0];
                const mergedStackIsInBag = Boolean(
                    mergedStack?.instanceId
                    && Aethra.BagSystem?.hasItem?.(mergedStack.instanceId)
                );
                const mergedSellback = mergedStack
                    ? Aethra.MarketplaceSystem?.sellBack?.(mergedStack.instanceId)
                    : null;
                const potionsLeftAfterSellback = Aethra.BagSystem?.countItem?.("potion_health") || 0;
                checks.push(
                    createCheck(
                        "Devolução localiza a pilha fundida e reembolsa só o que foi comprado",
                        mergedStackIsInBag
                            && mergedPurchase?.totalPrice === 20
                            && mergedSellback?.quantity === 2
                            && mergedSellback?.salePrice === 10
                            && potionsLeftAfterSellback === 4
                            && Number(Aethra.GameState.hero?.gold || 0) === mergedGoldBefore - 20 + 10,
                        mergedStackIsInBag
                            ? `devolveu ${mergedSellback?.quantity || 0}/2 por ${mergedSellback?.salePrice || 0} G · ${potionsLeftAfterSellback} de loot preservada(s)`
                            : "pilha comprada não foi localizada na mochila"
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
                            && manualSupplies?.cost === 32
                            && Aethra.IdleLoopSystem?.inventoryQuantity?.("potion_health") === 2
                            && Aethra.IdleLoopSystem?.inventoryQuantity?.("potion_mana") === 1
                            && Number(Aethra.GameState.hero.gold) === 68,
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
                const fixedEquipmentPanel = document.querySelector(".player-equipment-matrix");
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
                    ["skills", ".player-skill-card-slim", 4],
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
                const activeSkillPanel = document.querySelector("[data-hero-panel-view='skills']");
                const inactiveHeroPanels = heroPanels.filter((panel) => panel !== activeSkillPanel);
                const heroWorkspaceRect = document.querySelector(".hero-hub--cockpit .player-hud-workspace")
                    ?.getBoundingClientRect?.();
                const activeSkillRect = activeSkillPanel?.getBoundingClientRect?.();
                const activePanelStartsInView = !heroWorkspaceRect?.height
                    || (activeSkillRect.top >= heroWorkspaceRect.top - 1
                        && activeSkillRect.top < heroWorkspaceRect.bottom);
                checks.push(
                    createCheck(
                        "Aba ativa da Central aparece imediatamente e as demais não ocupam espaço",
                        getComputedStyle(activeSkillPanel).display !== "none"
                            && inactiveHeroPanels.every((panel) => getComputedStyle(panel).display === "none")
                            && activePanelStartsInView,
                        `${inactiveHeroPanels.filter((panel) => getComputedStyle(panel).display === "none").length}/${inactiveHeroPanels.length} ocultas · início ${activePanelStartsInView ? "visível" : "fora da rolagem"}`
                    )
                );
                // Modelo atual: cartas compactas (.player-skill-card-slim) que
                // já nascem expandidas e alternam entre fixada/minimizada pelo pino.
                const firstSkillCard = document.querySelector(".player-skill-card-slim");
                const skillCardExpandedContent = firstSkillCard
                    ? firstSkillCard.querySelector(".player-skill-card-slim__bar, .player-skill-card-slim__meta")
                    : null;
                const skillCardNotClipped = Boolean(firstSkillCard)
                    && (firstSkillCard.clientHeight === 0
                        || firstSkillCard.clientHeight >= firstSkillCard.scrollHeight - 1);
                // O pino re-renderiza toda a lista, então a carta precisa ser
                // reconsultada pelo data-skill-id após cada alternância.
                const firstSkillId = firstSkillCard?.dataset.skillId;
                const startedExpanded = Boolean(firstSkillCard?.classList.contains("is-expanded"));
                firstSkillCard?.querySelector("[data-toggle-skill-pin]")?.click();
                const cardAfterCollapse = document.querySelector(`.player-skill-card-slim[data-skill-id='${firstSkillId}']`);
                const collapsedAfterToggle = Boolean(cardAfterCollapse?.classList.contains("is-minimized"));
                cardAfterCollapse?.querySelector("[data-toggle-skill-pin]")?.click();
                const skillCardToggles = Boolean(firstSkillId) && startedExpanded && collapsedAfterToggle;
                checks.push(
                    createCheck(
                        "Categorias e fichas de Skills expandem sem conteúdo cortado",
                        Boolean(firstSkillCard)
                            && Boolean(skillCardExpandedContent)
                            && skillCardNotClipped
                            && skillCardToggles,
                        firstSkillCard
                            ? `carta ${startedExpanded ? "expandida" : "fechada"} · pino ${skillCardToggles ? "alterna" : "estático"}`
                            : "nenhuma carta de skill renderizada"
                    )
                );

                Aethra.UIFluidityPass?.enhance?.();
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
                const actionBarTop = document.getElementById("battle-actionbar-layer")
                    ?.getBoundingClientRect?.().top || window.innerHeight;
                checks.push(
                    createCheck(
                        "Janelas do HUD são exclusivas e nunca ficam atrás da topbar",
                        Aethra.WindowManager?.config?.exclusive === true
                            && Aethra.WindowManager?.isOpen?.("skills-view") === true
                            && Aethra.WindowManager?.isOpen?.("inventory-view") === false
                            && Number(skillsRect?.top || 0) >= Number(topbarBottom) + 6
                            && Number(skillsRect?.bottom || 0) <= Number(actionBarTop) + 1,
                        `inventário ${Aethra.WindowManager?.isOpen?.("inventory-view") ? "aberto" : "fechado"} · skills y=${Math.round(skillsRect?.top || 0)} · topbar=${Math.round(topbarBottom)}`
                    )
                );
                Aethra.WindowManager?.closeAll?.({ modalOnly: true, silent: true });

                Aethra.openHuntWorldMap?.({ source: "integration-overlay" });
                const worldMapWindow = document.getElementById("hunt-world-map-view");
                const worldMapRect = worldMapWindow?.getBoundingClientRect?.();
                const worldMapContent = worldMapWindow?.querySelector(".hunt-world-map-content");
                const worldMapLayout = worldMapWindow?.querySelector(".hunt-world-map-layout");
                const worldMapDetail = worldMapWindow?.querySelector(".hunt-world-map-detail");
                const worldMapStart = worldMapWindow?.querySelector("[data-world-hunt-start]");
                if (worldMapDetail) worldMapDetail.scrollTop = worldMapDetail.scrollHeight;
                const reportElement = document.getElementById("integration-test-report");
                const reportWasHidden = reportElement?.hidden === true;
                if (reportElement) reportElement.hidden = true;
                const startRect = worldMapStart?.getBoundingClientRect?.();
                const startHitTarget = startRect
                    ? document.elementFromPoint(
                        startRect.left + startRect.width / 2,
                        startRect.top + startRect.height / 2
                    )
                    : null;
                if (reportElement) reportElement.hidden = reportWasHidden;
                const mapIsBlockingOverlay = Boolean(worldMapWindow)
                    && Aethra.WindowManager?.isOverlayWindow?.("hunt-world-map-view") === true
                    && getComputedStyle(document.getElementById("modal-layer")).pointerEvents === "auto"
                    && Number(getComputedStyle(document.getElementById("modal-layer")).zIndex || 0)
                        > Number(getComputedStyle(document.getElementById("hud-layer")).zIndex || 0)
                    && Number(worldMapRect?.left || 0) <= 1
                    && Number(worldMapRect?.top || 0) <= 1
                    && Math.abs(Number(worldMapRect?.width || 0) - window.innerWidth) <= 1
                    && Math.abs(Number(worldMapRect?.height || 0) - window.innerHeight) <= 1;
                const startIsReachable = Boolean(worldMapStart)
                    && Number(startRect?.top || -1) >= 0
                    && Number(startRect?.bottom || Infinity) <= window.innerHeight
                    && (startHitTarget === worldMapStart || worldMapStart.contains(startHitTarget));
                checks.push(
                    createCheck(
                        "Mapa Mundi bloqueia o fundo e mantém Entrar na expedição clicável",
                        mapIsBlockingOverlay && startIsReachable,
                        `viewport ${window.innerWidth}×${window.innerHeight} · overlay ${Math.round(worldMapRect?.left || 0)},${Math.round(worldMapRect?.top || 0)} ${Math.round(worldMapRect?.width || 0)}×${Math.round(worldMapRect?.height || 0)} pad ${getComputedStyle(worldMapWindow).padding} · conteúdo ${Math.round(worldMapContent?.getBoundingClientRect?.().height || 0)} · layout ${Math.round(worldMapLayout?.getBoundingClientRect?.().height || 0)} · detalhe ${worldMapDetail?.clientHeight || 0}/${worldMapDetail?.scrollHeight || 0}@${Math.round(worldMapDetail?.scrollTop || 0)} · botão ${Math.round(startRect?.top || 0)}–${Math.round(startRect?.bottom || 0)} ${startIsReachable ? "alcançável" : `obstruído por ${startHitTarget?.className || startHitTarget?.tagName || "fora da tela"}`}`
                    )
                );
                Aethra.WindowManager?.closeWindow?.("hunt-world-map-view", {
                    source: "integration-overlay-cleanup",
                    silent: true
                });

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
                    [640, 720, "narrow"],
                    [1024, 768, "narrow"],
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
                        "HUD classifica automaticamente monitores estreitos, compactos, padrão, amplos e ultrawide",
                        responsiveProfileMatches
                            && document.body.dataset.hudViewport === currentResponsiveProfile?.profile,
                        responsiveProfileMatches
                            ? `perfil atual ${currentResponsiveProfile?.profile || "ausente"}`
                            : "matriz de perfis responsivos inconsistente"
                    )
                );

                const responsiveBattleLayout = document.querySelector(".battle-hunt-layout");
                const responsiveMainColumn = responsiveBattleLayout?.querySelector(".battle-main-column");
                const responsiveHeroColumn = responsiveBattleLayout?.querySelector(".battle-sidebar--hero");
                const responsiveCombatColumn = responsiveBattleLayout?.querySelector(".battle-sidebar--combat");
                const responsiveLayoutStyle = responsiveBattleLayout
                    ? getComputedStyle(responsiveBattleLayout)
                    : null;
                const measuredViewport = window.innerWidth > 0;
                const narrowViewport = measuredViewport && window.innerWidth <= 1119;
                const responsiveColumnCount = responsiveLayoutStyle?.gridTemplateColumns
                    ?.trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .length || 0;
                const responsiveLayoutRect = responsiveBattleLayout?.getBoundingClientRect?.();
                const responsivePanelRects = [
                    responsiveMainColumn,
                    responsiveHeroColumn,
                    responsiveCombatColumn
                ].map((panel) => panel?.getBoundingClientRect?.());
                const responsiveLayoutVisible = Number(responsiveLayoutRect?.width || 0) > 0
                    && Number(responsiveLayoutRect?.height || 0) > 0;
                const shellFitsViewport = !measuredViewport || (
                    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
                    && document.body.scrollWidth <= document.body.clientWidth + 1
                );
                const narrowPanelsShareColumn = !responsiveLayoutVisible || responsivePanelRects.every((rect) => {
                    return Number(rect?.width || 0) >= Number(responsiveLayoutRect?.width || 0) - 24;
                }) && Math.max(...responsivePanelRects.map((rect) => Number(rect?.left || 0)))
                    - Math.min(...responsivePanelRects.map((rect) => Number(rect?.left || 0))) <= 1;
                const narrowStackScrollable = !responsiveLayoutVisible
                    || responsiveBattleLayout.scrollHeight > responsiveBattleLayout.clientHeight;
                const narrowStackIsOrdered = !narrowViewport || (
                    narrowPanelsShareColumn
                    && getComputedStyle(responsiveMainColumn).order === "1"
                    && getComputedStyle(responsiveHeroColumn).order === "2"
                    && getComputedStyle(responsiveCombatColumn).order === "3"
                    && narrowStackScrollable
                );
                const compactActionBar = document.getElementById("battle-actionbar-layer");
                const compactActionBarRect = compactActionBar?.getBoundingClientRect?.();
                const compactActionContentBottom = Math.max(
                    0,
                    document.querySelector("#battle-actionbar-layer .primary-attack-bar")
                        ?.getBoundingClientRect?.().bottom || 0,
                    document.querySelector("#battle-actionbar-layer #skill-action-bar")
                        ?.getBoundingClientRect?.().bottom || 0
                );
                const compactActionBarFits = !narrowViewport
                    || compactActionContentBottom <= Number(compactActionBarRect?.bottom || 0) + 1;
                checks.push(
                    createCheck(
                        "HUD compacta elimina overflow e empilha palco, herói e análise",
                        Boolean(responsiveBattleLayout)
                            && shellFitsViewport
                            && narrowStackIsOrdered
                            && compactActionBarFits,
                        narrowViewport
                            ? `${window.innerWidth}px · pilha ${narrowPanelsShareColumn ? "alinhada" : "desalinhada"} · ordem ${getComputedStyle(responsiveMainColumn).order}/${getComputedStyle(responsiveHeroColumn).order}/${getComputedStyle(responsiveCombatColumn).order} · shell ${document.documentElement.scrollWidth}/${document.documentElement.clientWidth} · ActionBar ${Math.round(compactActionContentBottom)}/${Math.round(Number(compactActionBarRect?.bottom || 0))}`
                            : `${window.innerWidth || "?"}px · cockpit de ${responsiveColumnCount} colunas sem overflow`
                    )
                );

                const compactHuntNav = document.querySelector("[data-compact-hunt-nav]");
                const compactHuntButtons = compactHuntNav
                    ? [...compactHuntNav.querySelectorAll("[data-compact-hunt-target]")]
                    : [];
                const compactHuntTargets = compactHuntButtons.map((button) => (
                    button.dataset.compactHuntTarget
                ));
                const compactHuntControlsExist = compactHuntButtons.every((button) => (
                    Boolean(document.getElementById(button.getAttribute("aria-controls")))
                ));
                const compactHeroButton = compactHuntButtons.find((button) => (
                    button.dataset.compactHuntTarget === "hero"
                ));
                const compactCombatButton = compactHuntButtons.find((button) => (
                    button.dataset.compactHuntTarget === "combat"
                ));
                compactHeroButton?.click();
                const compactHeroSelectionWorks = compactHeroButton?.getAttribute("aria-pressed") === "true"
                    && compactHuntNav?.dataset.activePanel === "hero";
                compactCombatButton?.click();
                const compactNavDisplay = compactHuntNav
                    ? getComputedStyle(compactHuntNav).display
                    : "none";
                checks.push(
                    createCheck(
                        "Navegação compacta salta entre combate, herói e análise com estado acessível",
                        Boolean(compactHuntNav)
                            && compactHuntNav.dataset.compactHuntBound === "true"
                            && compactHuntTargets.join(",") === "combat,hero,analysis"
                            && compactHuntControlsExist
                            && compactHeroSelectionWorks
                            && compactCombatButton?.getAttribute("aria-pressed") === "true"
                            && (narrowViewport
                                ? compactNavDisplay === "grid"
                                : compactNavDisplay === "none"),
                        `${compactHuntButtons.length}/3 atalhos · painel ${compactHuntNav?.dataset.activePanel || "ausente"} · display ${compactNavDisplay}`
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
                // O ponto central é: o mundo nunca recebe dimensões inline de
                // janela flutuante ao redimensionar. A conferência de largura
                // total só é significativa quando o viewport é mensurável e o
                // city-view está de fato exibido (largura > 0); em execução
                // headless (innerWidth === 0) ou fora do modo Cidade ela é
                // ignorada para não gerar falso negativo.
                const viewportMeasurable = window.innerWidth > 0 && Number(cityViewRect?.width || 0) > 0;
                const cityViewFullBleed = !viewportMeasurable
                    || Math.abs(Number(cityViewRect?.width || 0) - window.innerWidth) <= 1;
                checks.push(
                    createCheck(
                        "Redimensionar a tela não transforma o mundo em janela flutuante fixa",
                        Boolean(cityViewRect)
                            && !cityViewHasFloatingConstraint
                            && cityViewFullBleed,
                        cityViewHasFloatingConstraint
                            ? "city-view recebeu dimensões inline indevidas"
                            : `mundo fluido em ${Math.round(cityViewRect?.width || 0)}×${Math.round(cityViewRect?.height || 0)} px`
                    )
                );

                const previousPrimaryView = Aethra.GameState.ui?.primaryView || "hunt";
                Aethra.UIManager?.setPrimaryView?.("city", { emit: false, source: "integration-layout" });
                Aethra.RenderEngine?.renderCityGuidance?.();
                const cityServiceCards = [...document.querySelectorAll(".city-service-card")];
                const cityActionsVisible = cityServiceCards.length >= 6 && cityServiceCards.every((card) => {
                    const action = card.querySelector("button");
                    if (!action) return false;
                    const cardRect = card.getBoundingClientRect();
                    const actionRect = action.getBoundingClientRect();
                    return actionRect.height >= 30
                        && actionRect.top >= cardRect.top
                        && actionRect.bottom <= cardRect.bottom + 1;
                });
                const bodyFillsViewport = document.body.getBoundingClientRect().height >= window.innerHeight - 2;
                const cityViewportAuthority = getComputedStyle(cityView).bottom === "0px"
                    && cityView?.classList?.contains("is-primary-city");
                Aethra.UIManager?.setPrimaryView?.(previousPrimaryView, { emit: false, source: "integration-layout-restore" });
                checks.push(
                    createCheck(
                        "Hub da Cidade mantém todas as ações visíveis no viewport",
                        cityViewportAuthority && (!bodyFillsViewport || cityActionsVisible),
                        `${cityServiceCards.length} serviços · autoridade inferior ${cityViewportAuthority ? "liberada" : "reservada"} · ${bodyFillsViewport ? `botões ${cityActionsVisible ? "inteiros" : "cortados"}` : "harness com altura reduzida"}`
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
                } catch (error) {
                    const completedAt = Date.now();
                    checks.push(
                        createCheck(
                            "Execução da suíte",
                            false,
                            error?.stack || error?.message || String(error)
                        )
                    );
                    this.lastReport = {
                        success: false,
                        startedAt,
                        completedAt,
                        durationMs: completedAt - startedAt,
                        checks
                    };
                    this.running = false;
                    this.completed = true;
                    renderReport(this.lastReport);
                    console.error("Falha não tratada na suíte de integração:", error);
                }
            });
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
