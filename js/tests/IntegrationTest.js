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
        "ProgressionJournalUI",
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

            const progressionJournalModel = Aethra.ProgressionJournalUI?.getViewModel?.();
            const progressionJournalSelected = progressionJournalModel?.selected;
            checks.push(
                createCheck(
                    "Diário reúne todas as skills e orienta o próximo treino",
                    progressionJournalModel?.entries?.length === Object.keys(Aethra.DisciplineSystem?.definitions || {}).length
                        && progressionJournalSelected?.guide?.chain?.length === 3
                        && Boolean(progressionJournalSelected?.nextUnlock?.title),
                    progressionJournalModel
                        ? `${progressionJournalModel.entries.length} skills · foco em ${progressionJournalSelected?.name || "nenhuma"}`
                        : "ViewModel indisponível"
                )
            );
            checks.push(
                createCheck(
                    "Diário e ActionBar compartilham a janela oficial de Skills",
                    Boolean(document.querySelector("#progression-journal-root .progression-workspace"))
                        && Boolean(document.querySelector('[data-skills-workspace-panel="actionbar"] #skills-config-list'))
                        && typeof Aethra.RenderEngine?.getDisciplineMilestones === "function",
                    "Progressão, marcos e automação acessíveis sem duplicar janela"
                )
            );

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
                },
                exploration: {
                    tutorialGuarantee: { professionId: "mining", eventId: "mining", huntId: "apprentice_mines_focus" }
                }
            });
            checks.push(
                createCheck(
                    "Save v78 migra contratos e preserva políticas atuais",
                    legacyProfessionSave?.toVersion === 78
                        && legacyProfessionSave?.state?.meta?.schemaVersion === 78
                        && legacyProfessionSave?.state?.quests?.contractVersion === 4
                        && typeof legacyProfessionSave?.state?.hero?.professionPerks === "object"
                        && typeof legacyProfessionSave?.state?.hero?.introPrepared === "object"
                        && legacyProfessionSave?.state?.playerEquipment?.weapon?.durability?.current === 100
                        && legacyProfessionSave?.state?.maintenance?.policy?.enabled === false
                        && currentProfessionSave?.state?.hero?.professionPerks?.mining?.[0] === "keen_vein"
                        && currentProfessionSave?.state?.hero?.professionPerks?.mining?.[1] === "specialization_extractor"
                        && currentProfessionSave?.state?.maintenance?.policy?.enabled === true
                        && currentProfessionSave?.state?.maintenance?.policy?.thresholdPercent === 30
                        && currentProfessionSave?.state?.quests?.contractVersion === 4
                        && currentProfessionSave?.state?.exploration?.tutorialGuarantee?.remaining === 1
                        && currentProfessionSave?.state?.exploration?.tutorialGuarantee?.minimumQuantity === 1,
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
            const chapterOneBackup = {
                hero: JSON.parse(JSON.stringify(Aethra.GameState.hero || {})),
                hunt: JSON.parse(JSON.stringify(Aethra.GameState.hunt || {})),
                quests: JSON.parse(JSON.stringify(Aethra.GameState.quests || {})),
                ui: JSON.parse(JSON.stringify(Aethra.GameState.ui || {})),
                bosses: JSON.parse(JSON.stringify(Aethra.GameState.bosses || {})),
                battle: JSON.parse(JSON.stringify(Aethra.GameState.battle || {})),
                combat: JSON.parse(JSON.stringify(Aethra.GameState.combat || {})),
                battleIsFighting: Boolean(Aethra.BattleSystem?.isFighting)
            };
            Aethra.GameState.hero.characterCreated = true;
            Aethra.GameState.hero.level = 1;
            Aethra.GameState.hero.xpCurrent = 0;
            Aethra.GameState.hero.xpTotal = 0;
            Aethra.GameState.hero.xpNext = Aethra.XPSystem.getXPRequired(1);
            Aethra.GameState.hero.gold = 0;
            Aethra.GameState.hero.bag = [];
            Aethra.GameState.quests = {
                contractVersion: Aethra.QuestSystem.CONTRACT_VERSION,
                active: [],
                completed: [{ id: "intro_profession_mining", status: "completed" }],
                available: [],
                rewardClaims: ["intro_profession_mining"]
            };
            Aethra.GameState.ui.trackedQuestId = null;
            Aethra.GameState.bosses = {
                activeBossId: null,
                cooldowns: {},
                history: {},
                weekly: { weekKey: "integration", defeatedBosses: [], progress: 0, required: 1, claimed: false }
            };

            const reconciledChapter = Aethra.QuestSystem.reconcileChapterOne();
            const forestChapter = Aethra.QuestSystem.getQuest("chapter_one_forest_guard");
            const forestGuidance = Aethra.QuestSystem.getGuidance(forestChapter);
            Aethra.QuestSystem.updateProgress("DefeatInHunt", "whispering_forest", 12, {
                source: "integration-chapter-one"
            });
            Aethra.GameState.hero.level = 5;
            Aethra.GameState.hero.xpCurrent = 0;
            Aethra.GameState.hero.xpNext = Aethra.XPSystem.getXPRequired(5);
            Aethra.EventBus.emit("levelUp", { level: 5, source: "integration-chapter-one" });

            const goblinChapter = Aethra.QuestSystem.getQuest("chapter_one_goblin_frontier");
            Aethra.EventBus.emit("hunt:started", {
                huntId: "goblin_frontier",
                source: "integration-chapter-one"
            });
            Aethra.QuestSystem.updateProgress("DefeatInHunt", "goblin_frontier", 20, {
                source: "integration-chapter-one"
            });
            Aethra.GameState.hero.level = 10;
            Aethra.GameState.hero.xpCurrent = 0;
            Aethra.GameState.hero.xpNext = Aethra.XPSystem.getXPRequired(10);
            Aethra.EventBus.emit("levelUp", { level: 10, source: "integration-chapter-one" });

            const alphaChapter = Aethra.QuestSystem.getQuest("chapter_one_alpha_wolf");
            const alphaGuidance = Aethra.QuestSystem.getGuidance(alphaChapter);
            const bossGuidanceOpened = Aethra.RenderEngine?.handleQuestGuidance?.(alphaGuidance);
            Aethra.RenderEngine?.renderBosses?.();
            const bossWindowProbe = {
                action: alphaGuidance?.action || null,
                opened: Boolean(bossGuidanceOpened),
                isOpen: Boolean(Aethra.WindowManager?.isOpen?.("bosses-view")),
                hasElement: Boolean(document.getElementById("bosses-view")),
                registered: Boolean(Aethra.WindowManager?.registeredWindows?.has?.("bosses-view")),
                listCount: document.querySelectorAll("#boss-list").length,
                alphaEnabled: Boolean(document.querySelector('#bosses-view [data-render-challenge-boss="alpha_wolf"]:not(:disabled)'))
            };
            const bossWindowFunctional = Boolean(
                bossWindowProbe.opened
                && bossWindowProbe.isOpen
                && bossWindowProbe.listCount === 1
                && bossWindowProbe.alphaEnabled
            );
            const necklaceBeforeChapter = Aethra.BagSystem?.countItem?.("silver_necklace") || 0;
            const bossChallengeStarted = Aethra.BossSystem?.challenge?.("alpha_wolf") === true;
            const bossVictory = bossChallengeStarted
                ? Aethra.BattleSystem?.victory?.(Aethra.GameState.battle?.creature)
                : null;
            const completedAlphaChapter = Aethra.QuestSystem.getQuest("chapter_one_alpha_wolf");
            const necklaceAfterChapter = Aethra.BagSystem?.countItem?.("silver_necklace") || 0;
            Aethra.WindowManager?.closeWindow?.("bosses-view", { source: "integration-chapter-one" });

            checks.push(
                createCheck(
                    "Save pós-ofício retoma automaticamente o primeiro capítulo",
                    reconciledChapter?.id === "chapter_one_forest_guard"
                        && forestGuidance?.huntId === "whispering_forest",
                    `${reconciledChapter?.title || "capítulo ausente"} · destino ${forestGuidance?.huntId || "indefinido"}`
                )
            );
            checks.push(
                createCheck(
                    "Jornada oficial conecta Bosque, Fronteira Goblin e Lobo Alfa",
                    forestChapter?.status === "completed"
                        && goblinChapter?.status === "completed"
                        && alphaChapter?.status === "completed"
                        && completedAlphaChapter?.status === "completed"
                        && alphaGuidance?.action === "open-bosses",
                    `Bosque ${forestChapter?.status || "ausente"} · Fronteira ${goblinChapter?.status || "ausente"} · Alfa ${completedAlphaChapter?.status || "ausente"}`
                )
            );
            checks.push(
                createCheck(
                    "Mural de Chefes é acessível e conclui o nível 10 com recompensa",
                    bossWindowFunctional
                        && bossChallengeStarted
                        && Boolean(bossVictory)
                        && necklaceAfterChapter - necklaceBeforeChapter === 1,
                    `${JSON.stringify(bossWindowProbe)} · combate ${bossChallengeStarted ? "iniciado" : "negado"} · ${necklaceAfterChapter - necklaceBeforeChapter} Colar de Prata`
                )
            );
            checks.push(
                createCheck(
                    "Equipamentos do primeiro capítulo nunca são consolidados em pilhas",
                    Aethra.BagSystem?.isStackable?.({ templateId: "silver_necklace" }) === false
                        && Aethra.BagSystem?.isStackable?.({ templateId: "eg_head_l10" }) === false
                        && Aethra.BagSystem?.isStackable?.({ templateId: "eg_ring_l10" }) === false,
                    "amuleto, elmo e anel preservam instâncias individuais"
                )
            );

            Aethra.BattleSystem?.cancelTimer?.();
            Aethra.GameState.hero = chapterOneBackup.hero;
            Aethra.GameState.hunt = chapterOneBackup.hunt;
            Aethra.GameState.quests = chapterOneBackup.quests;
            Aethra.GameState.ui = chapterOneBackup.ui;
            Aethra.GameState.bosses = chapterOneBackup.bosses;
            Aethra.GameState.battle = chapterOneBackup.battle;
            Aethra.GameState.combat = chapterOneBackup.combat;
            Aethra.BattleSystem.isFighting = chapterOneBackup.battleIsFighting;

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
            Aethra.GameState.hero.bag = (Aethra.GameState.hero.bag || []).filter((item) =>
                String(item?.id || item?.itemId || item?.templateId || "") !== "apprentice_pickaxe"
            );
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
            Aethra.BattleSystem.stopCombat("integration-death-setup");
            Aethra.BattleSystem.startCombat({
                id: "bandit-xmm-2024",
                name: "Bandido",
                hp: 19,
                maxHp: 19,
                damage: 1,
                xp: 0
            }, {
                source: "integration-test",
                noRewards: true
            });
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
                    actionBars.length >= 1
                        && actionBars.length <= 4
                        && typeof Aethra.SkillSystem?.addBar === "function"
                        && actionBars.every((bar) => Array.isArray(bar.slots) && bar.slots.length >= 10),
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
                const retiredUiStyles = [
                    "style-stability.css", "ui-fluidity.css", "actionbar-workspace.css",
                    "hunt-analyzer-workspace.css", "combat-hud-modern.css",
                    "encounter-combat-hud.css", "player-hud-workspace.css",
                    "tilemap-canvas.css", "hud-modernization.css", "aethra-windows.css"
                ];
                const runtimeStyles = [...document.querySelectorAll('link[rel="stylesheet"]')]
                    .map((link) => link.getAttribute("href") || "");
                checks.push(
                    createCheck(
                        "Fundação visual UI 2.0 substitui folhas legadas conflitantes",
                        document.body.classList.contains("aethra-ui-v2")
                            && document.body.dataset.uiVersion === "2"
                            && runtimeStyles.some((href) => href.includes("aethra-ui-v2.css"))
                            && retiredUiStyles.every((file) => !runtimeStyles.some((href) => href.includes(file))),
                        `${runtimeStyles.length} folhas ativas · contrato UI ${document.body.dataset.uiVersion || "ausente"}`
                    )
                );
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
                const tooltipBagItem = Aethra.BagSystem?.getItems?.()
                    ?.find((item) => item?.instanceId);
                const tooltipBagHTML = tooltipBagItem
                    ? Aethra.TooltipManager?.buildItemHTML?.(tooltipBagItem.instanceId) || ""
                    : "";
                checks.push(
                    createCheck(
                        "Tooltip resolve instâncias antigas da mochila",
                        !tooltipBagItem || (
                            !tooltipBagHTML.includes("Item Desconhecido")
                            && tooltipBagHTML.includes(tooltipBagItem.name || Aethra.GameData?.items?.[tooltipBagItem.templateId]?.name || "")
                        ),
                        tooltipBagItem
                            ? `${tooltipBagItem.instanceId} resolvido pelo template ${tooltipBagItem.templateId || tooltipBagItem.id}`
                            : "mochila vazia; compatibilidade preservada"
                    )
                );

                const compactHuntTargetBeforeStats = document.querySelector(
                    "[data-compact-hunt-target][aria-pressed='true']"
                )?.dataset.compactHuntTarget;
                const intelligenceTabBeforeStats = document.querySelector(
                    "[data-intelligence-tab][aria-selected='true']"
                )?.dataset.intelligenceTab;
                if (window.innerWidth <= 1120) {
                    document.querySelector("[data-compact-hunt-target='analysis']")?.click();
                }
                document.querySelector("[data-intelligence-tab='analyzer']")?.click();
                Aethra.RenderEngine?.renderExplorationFeed?.();
                const journeyStatCards = [...document.querySelectorAll(".expedition-live-stats > span")];
                const analyzerIsPreparingForJourney = document.getElementById("hunt-panel-analysis")
                    ?.classList.contains("is-preparing");
                const journeyStatsVisible = journeyStatCards.length === 4 && (
                    analyzerIsPreparingForJourney
                        ? journeyStatCards.every((card) => getComputedStyle(card).display === "none"
                            || getComputedStyle(card.closest(".hunt-session-summary")).display === "none")
                        : journeyStatCards.every((card) => {
                    const value = card.querySelector("strong");
                    if (!value) return false;
                    const cardRect = card.getBoundingClientRect();
                    const valueRect = value.getBoundingClientRect();
                    return valueRect.top >= cardRect.top - 0.5
                        && valueRect.bottom <= cardRect.bottom + 0.5
                        && valueRect.height > 0;
                        })
                );
                checks.push(
                    createCheck(
                        "Totais da jornada sem números cortados",
                        journeyStatsVisible,
                        analyzerIsPreparingForJourney
                            ? `${journeyStatCards.length}/4 cards recolhidos durante a preparação`
                            : `${journeyStatCards.length}/4 cards íntegros`
                    )
                );
                if (compactHuntTargetBeforeStats && window.innerWidth <= 1120) {
                    document.querySelector(
                        `[data-compact-hunt-target='${compactHuntTargetBeforeStats}']`
                    )?.click();
                }
                if (intelligenceTabBeforeStats) {
                    document.querySelector(
                        `[data-intelligence-tab='${intelligenceTabBeforeStats}']`
                    )?.click();
                }

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
                const analyzerPreparation = document.querySelector(".analyzer-preparation");
                // As abas de inteligência são montadas por UIFluidityPass de forma
                // orientada a eventos; força a montagem síncrona para o teste.
                Aethra.UIFluidityPass?.enhance?.();
                const progressionLogBackup = JSON.parse(JSON.stringify(
                    Aethra.GameState.ui?.progressionLog || []
                ));
                Aethra.EventBus.emit("xpChanged", {
                    amount: 1,
                    source: { enemyName: "Lobo de teste" }
                });
                const progressionSourceDetail = String(
                    Aethra.GameState.ui?.progressionLog?.[0]?.detail || ""
                );
                const progressionSourceReadable = progressionSourceDetail.includes("Combate")
                    && !progressionSourceDetail.includes("[object Object]");
                checks.push(
                    createCheck(
                        "Progresso traduz fontes estruturadas sem [object Object]",
                        progressionSourceReadable,
                        progressionSourceDetail || "fonte ausente"
                    )
                );
                Aethra.GameState.ui.progressionLog = progressionLogBackup;
                Aethra.EventBus.emit("render:ready", { source: "integration-progression-cleanup" });
                const analyzerTabs = [...document.querySelectorAll("[data-intelligence-tab]")]
                    .map((tab) => tab.dataset.intelligenceTab);
                checks.push(
                    createCheck(
                        "Hunt Analyzer alterna preparação contextual e telemetria",
                        Boolean(analyzer)
                            && (
                                analyzerCards.length >= 6
                                || Boolean(
                                    analyzerPreparation?.querySelector(".analyzer-objective-card")
                                    && analyzerPreparation?.querySelectorAll(".analyzer-readiness__grid > span").length === 4
                                )
                            )
                            && ["xp", "gained", "spent", "profit"].every((key) => Number.isFinite(Number(analyzerMetrics[key]))),
                        analyzerPreparation
                            ? "preparação contextual ativa; telemetria disponível"
                            : `${analyzerCards.length} KPIs; telemetria ${analyzer ? "disponível" : "ausente"}`
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
                        loadoutSlots.length >= 10 && skillRules.length >= 3,
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

                const miningFocus = Aethra.DisciplineSystem?.setFocus?.("mining", "integration-test");
                const miningGuidance = Aethra.DisciplineSystem?.getFocusedGuidance?.();
                const miningRecommendations = Aethra.DisciplineSystem?.getActivityRecommendations?.("mining") || [];
                checks.push(
                    createCheck(
                        "Foco de skill possui rota oficial e acessível",
                        miningFocus?.disciplineId === "mining"
                            && miningGuidance?.huntId === "apprentice_mines_focus"
                            && miningGuidance?.mapMode === "hunts"
                            && miningGuidance?.recommendation?.unlocked === true
                            && miningRecommendations[0]?.id === "apprentice_mines_focus",
                        `${miningGuidance?.name || "sem skill"} → ${miningGuidance?.recommendation?.name || "sem rota"}`
                    )
                );

                const miningContractStart = Aethra.ProfessionSystem?.getFocusTrainingState?.("mining");
                const miningGuaranteeStart = Aethra.ExplorationSystem?.getSnapshot?.().tutorialGuarantee;
                checks.push(
                    createCheck(
                        "Foco de Mineração ativa contrato vertical persistente",
                        miningContractStart?.active === true
                            && miningContractStart?.quest?.objectives?.length === 4
                            && miningContractStart?.guidance?.objective?.id === "practice_focus_mining"
                            && miningGuaranteeStart?.huntId === "apprentice_mines_focus"
                            && miningGuaranteeStart?.source === "focus-training"
                            && miningGuaranteeStart?.remaining === 3
                            && miningGuaranteeStart?.manual === true
                            && miningGuaranteeStart?.minimumQuantity === 2,
                        `${miningContractStart?.progress?.percent || 0}% · ${miningGuaranteeStart?.remaining || 0} veios garantidos`
                    )
                );

                Aethra.GameState.hunt = {
                    ...(Aethra.GameState.hunt || {}),
                    isActive: true,
                    huntId: "apprentice_mines_focus",
                    currentRoom: 1
                };
                Aethra.ExplorationSystem?.setRandomSource?.(() => 0.99);
                Aethra.ExplorationSystem?.tryTriggerStairsEvent?.({ room: 1 });
                const skippedMiningEvent = Aethra.ExplorationSystem?.getSnapshot?.().pendingEvent;
                const skippedResult = skippedMiningEvent
                    ? Aethra.ExplorationSystem?.resolveEvent?.(skippedMiningEvent.eventId, { manual: true, skip: true })
                    : null;
                const guaranteeAfterSkip = Aethra.ExplorationSystem?.getSnapshot?.().tutorialGuarantee;
                checks.push(
                    createCheck(
                        "Veio guiado oferece escolha e Ignorar não consome o contrato",
                        skippedMiningEvent?.requiresManual === true
                            && skippedMiningEvent?.tutorialLabel === "CONTRATO DE FOCO"
                            && skippedResult?.status === "skipped"
                            && guaranteeAfterSkip?.remaining === 3
                            && Aethra.ExplorationSystem?.getSnapshot?.().pendingEvent === null,
                        skippedResult ? `ignorado · ${guaranteeAfterSkip?.remaining || 0} veios restantes` : "evento manual ausente"
                    )
                );

                const oreBeforeFocusLoop = Aethra.BagSystem?.countItem?.("iron_ore") || 0;
                const minedFocusEvents = [];
                for (let index = 0; index < 3; index += 1) {
                    Aethra.ExplorationSystem?.tryTriggerStairsEvent?.({ room: index + 2 });
                    const event = Aethra.ExplorationSystem?.getSnapshot?.().pendingEvent;
                    if (!event) break;
                    minedFocusEvents.push(Aethra.ExplorationSystem.resolveEvent(event.eventId, { manual: true }));
                }
                Aethra.ExplorationSystem?.setRandomSource?.(Math.random);
                const miningContractAfterOre = Aethra.ProfessionSystem?.getFocusTrainingState?.("mining");
                const oreAfterFocusLoop = Aethra.BagSystem?.countItem?.("iron_ore") || 0;
                checks.push(
                    createCheck(
                        "Mineração manual entrega XP, seis minérios e avança até a fundição",
                        minedFocusEvents.length === 3
                            && minedFocusEvents.every((event) => event?.status === "resolved" && event?.manual === true)
                            && oreAfterFocusLoop - oreBeforeFocusLoop === 6
                            && miningContractAfterOre?.guidance?.objective?.id === "smelt_focus_ingots"
                            && miningContractAfterOre?.guidance?.action === "open-workshop"
                            && Aethra.ExplorationSystem?.getSnapshot?.().tutorialGuarantee === null,
                        `${minedFocusEvents.length}/3 veios · +${oreAfterFocusLoop - oreBeforeFocusLoop} minérios · ${miningContractAfterOre?.guidance?.actionLabel || "sem próximo passo"}`
                    )
                );

                Aethra.GameState.hunt.isActive = false;
                Aethra.UIManager?.setPrimaryView?.("city", { emit: false, source: "integration-mining-contract" });
                Aethra.ProfessionWorkshopUI?.open?.("blacksmithing", "forge", { source: "integration-mining-contract" });
                const guidedSmeltingVisible = Boolean(
                    document.querySelector('.workshop-recipe.is-guided [data-craft-recipe="smelt_iron"]')
                    && /Produza Fundir Ferro/.test(document.querySelector(".profession-workshop__guidance")?.textContent || "")
                );
                const smeltingResult = Aethra.CraftingSystem?.craft?.("smelt_iron", {
                    stationId: "forge",
                    techniqueId: "balanced",
                    quantity: 3,
                    commandId: "integration-focus-smelt"
                });
                const miningContractAfterSmelt = Aethra.ProfessionSystem?.getFocusTrainingState?.("mining");
                Aethra.ProfessionWorkshopUI?.open?.("blacksmithing", "forge", { source: "integration-mining-contract-equipment" });
                const guidedEquipmentCards = [...document.querySelectorAll(".workshop-recipe.is-guided [data-craft-recipe]")];
                const equipmentChoiceVisible = guidedEquipmentCards.length === 3
                    && /Escolha seu primeiro equipamento/.test(document.querySelector(".profession-workshop__guidance")?.textContent || "");
                checks.push(
                    createCheck(
                        "Oficina conduz da fundição para três escolhas de equipamento",
                        guidedSmeltingVisible
                            && smeltingResult?.accepted === true
                            && miningContractAfterSmelt?.guidance?.objective?.id === "forge_focus_equipment"
                            && equipmentChoiceVisible,
                        `fundição ${guidedSmeltingVisible ? "guiada" : "ausente"} · ${guidedEquipmentCards.length}/3 equipamentos destacados`
                    )
                );

                const forgedEquipment = Aethra.CraftingSystem?.craft?.("forge_iron_sword", {
                    stationId: "forge",
                    techniqueId: "balanced",
                    quantity: 1,
                    commandId: "integration-focus-equipment"
                });
                const completedMiningContract = Aethra.ProfessionSystem?.getFocusTrainingState?.("mining");
                checks.push(
                    createCheck(
                        "Equipamento escolhido conclui o Ciclo do Prospector",
                        forgedEquipment?.accepted === true
                            && completedMiningContract?.completed === true
                            && Aethra.QuestSystem?.getQuest?.("focus_training_mining")?.status === "completed"
                            && Boolean(forgedEquipment?.outputs?.some((item) => item?.slot === "weapon")),
                        `${forgedEquipment?.recipe?.name || "sem equipamento"} · contrato ${completedMiningContract?.status || "ausente"}`
                    )
                );
                Aethra.WindowManager?.closeWindow?.("profession-workshop-view", { source: "integration-mining-contract" });

                Aethra.PlayerHudWorkspace?.renderSkills?.();
                const focusedMiningCard = document.querySelector('[data-skill-id="mining"].is-focused');
                checks.push(
                    createCheck(
                        "Central do Herói reflete a skill focada",
                        Boolean(focusedMiningCard)
                            && Boolean(focusedMiningCard?.querySelector('[data-focus-discipline="mining"][disabled]')),
                        focusedMiningCard ? "Mineração destacada na Central" : "Card focado ausente"
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
                                    && Boolean(slot.querySelector("[data-focus-skill-next-action]"))
                                    && /Primeiros Passos/.test(slot.textContent || "");
                            }),
                        `${questTrackerSlots.length}/2 pontos da HUD · missão ${trackedGuidance?.actionLabel || "ausente"} · foco ${miningGuidance?.actionLabel || "ausente"}`
                    )
                );

                const skinningFocus = Aethra.DisciplineSystem?.setFocus?.("skinning", "integration-test");
                const skinningGuidance = Aethra.DisciplineSystem?.getFocusedGuidance?.();
                const skinningContractStart = Aethra.ProfessionSystem?.getFocusTrainingState?.("skinning");
                const skinningGuaranteeStart = Aethra.ExplorationSystem?.getSnapshot?.().tutorialGuarantee;
                checks.push(
                    createCheck(
                        "Foco de Esfolamento ativa rota e contrato vertical",
                        skinningFocus?.disciplineId === "skinning"
                            && skinningGuidance?.huntId === "whispering_woods_focus"
                            && skinningGuidance?.mapMode === "hunts"
                            && skinningContractStart?.active === true
                            && skinningContractStart?.quest?.objectives?.length === 4
                            && skinningContractStart?.guidance?.objective?.id === "practice_focus_skinning"
                            && skinningGuaranteeStart?.professionId === "skinning"
                            && skinningGuaranteeStart?.remaining === 3
                            && skinningGuaranteeStart?.manual === true
                            && skinningGuaranteeStart?.minimumQuantity === 2,
                        `${skinningGuidance?.name || "sem skill"} → ${skinningGuidance?.recommendation?.name || "sem rota"} · ${skinningGuaranteeStart?.remaining || 0} esfolas`
                    )
                );

                Aethra.GameState.hunt = {
                    ...(Aethra.GameState.hunt || {}),
                    isActive: true,
                    huntId: "whispering_woods_focus",
                    currentRoom: 1
                };
                Aethra.ExplorationSystem?.setRandomSource?.(() => 0.99);
                const skinnableCreature = Aethra.HuntSystem?.getCreature?.("wolf-xmm-2024")
                    || Aethra.GameData?.creatures?.["wolf-xmm-2024"];
                Aethra.ExplorationSystem?.handleCreatureHarvest?.({
                    enemyId: "wolf-xmm-2024",
                    enemy: skinnableCreature,
                    name: skinnableCreature?.name || "Lobo",
                    level: 1
                });
                const skippedSkinningEvent = Aethra.ExplorationSystem?.getSnapshot?.().pendingEvent;
                const skippedSkinningResult = skippedSkinningEvent
                    ? Aethra.ExplorationSystem?.resolveEvent?.(skippedSkinningEvent.eventId, { manual: true, skip: true })
                    : null;
                const skinningGuaranteeAfterSkip = Aethra.ExplorationSystem?.getSnapshot?.().tutorialGuarantee;
                checks.push(
                    createCheck(
                        "Esfola guiada oferece Esfolar/Ignorar sem consumir ao ignorar",
                        skippedSkinningEvent?.id === "creature-harvest"
                            && skippedSkinningEvent?.actionLabel === "Esfolar"
                            && skippedSkinningEvent?.requiresManual === true
                            && skippedSkinningEvent?.tutorialLabel === "CONTRATO DE FOCO"
                            && skippedSkinningResult?.status === "skipped"
                            && skinningGuaranteeAfterSkip?.remaining === 3
                            && Aethra.ExplorationSystem?.getSnapshot?.().pendingEvent === null,
                        skippedSkinningResult ? `ignorada · ${skinningGuaranteeAfterSkip?.remaining || 0} esfolas restantes` : "decisão manual ausente"
                    )
                );

                const hidesBeforeFocusLoop = Aethra.BagSystem?.countItem?.("beast_hide") || 0;
                const skinningXPBeforeFocusLoop = Aethra.ProfessionSystem?.getState?.("skinning")?.xpTotal || 0;
                const skinnedFocusEvents = [];
                for (let index = 0; index < 3; index += 1) {
                    Aethra.ExplorationSystem?.handleCreatureHarvest?.({
                        enemyId: "wolf-xmm-2024",
                        enemy: skinnableCreature,
                        name: skinnableCreature?.name || "Lobo",
                        level: 1
                    });
                    const event = Aethra.ExplorationSystem?.getSnapshot?.().pendingEvent;
                    if (!event) break;
                    skinnedFocusEvents.push(Aethra.ExplorationSystem.resolveEvent(event.eventId, { manual: true }));
                }
                Aethra.ExplorationSystem?.setRandomSource?.(Math.random);
                const skinningContractAfterHides = Aethra.ProfessionSystem?.getFocusTrainingState?.("skinning");
                const hidesAfterFocusLoop = Aethra.BagSystem?.countItem?.("beast_hide") || 0;
                const skinningXPAfterFocusLoop = Aethra.ProfessionSystem?.getState?.("skinning")?.xpTotal || 0;
                const skinningXPFromEvents = skinnedFocusEvents.reduce((sum, event) => sum + Number(event?.xpGain || 0), 0);
                checks.push(
                    createCheck(
                        "Esfolamento manual entrega XP, seis peles e avança ao Curtume",
                        skinnedFocusEvents.length === 3
                            && skinnedFocusEvents.every((event) => event?.status === "resolved" && event?.manual === true)
                            && hidesAfterFocusLoop - hidesBeforeFocusLoop === 6
                            && skinningXPAfterFocusLoop - skinningXPBeforeFocusLoop === skinningXPFromEvents
                            && skinningContractAfterHides?.guidance?.objective?.id === "tan_focus_leather"
                            && skinningContractAfterHides?.guidance?.professionId === "leatherworking"
                            && Aethra.ExplorationSystem?.getSnapshot?.().tutorialGuarantee === null,
                        `${skinnedFocusEvents.length}/3 criaturas · +${hidesAfterFocusLoop - hidesBeforeFocusLoop} peles · +${skinningXPAfterFocusLoop - skinningXPBeforeFocusLoop} XP · ${skinningContractAfterHides?.guidance?.actionLabel || "sem próximo passo"}`
                    )
                );

                Aethra.GameState.hunt.isActive = false;
                Aethra.UIManager?.setPrimaryView?.("city", { emit: false, source: "integration-skinning-contract" });
                Aethra.ProfessionWorkshopUI?.open?.("leatherworking", "tannery", { source: "integration-skinning-contract" });
                const guidedTanningVisible = Boolean(
                    document.querySelector('.workshop-recipe.is-guided [data-craft-recipe="tan_beast_hide"]')
                    && /Produza Curtir Pele/.test(document.querySelector(".profession-workshop__guidance")?.textContent || "")
                );
                const tanningResult = Aethra.CraftingSystem?.craft?.("tan_beast_hide", {
                    stationId: "tannery",
                    techniqueId: "balanced",
                    quantity: 3,
                    commandId: "integration-focus-tanning"
                });
                const skinningContractAfterTan = Aethra.ProfessionSystem?.getFocusTrainingState?.("skinning");
                Aethra.ProfessionWorkshopUI?.open?.("leatherworking", "tannery", { source: "integration-skinning-contract-equipment" });
                const guidedLeatherCards = [...document.querySelectorAll(".workshop-recipe.is-guided [data-craft-recipe]")];
                const leatherChoiceVisible = guidedLeatherCards.length === 3
                    && /Botas, Chapéu e Calças de Couro/.test(document.querySelector(".profession-workshop__guidance")?.textContent || "");
                checks.push(
                    createCheck(
                        "Curtume conduz do tratamento para três escolhas de equipamento",
                        guidedTanningVisible
                            && tanningResult?.accepted === true
                            && skinningContractAfterTan?.guidance?.objective?.id === "craft_focus_leather_equipment"
                            && leatherChoiceVisible,
                        `curtimento ${guidedTanningVisible ? "guiado" : "ausente"} · ${guidedLeatherCards.length}/3 equipamentos destacados`
                    )
                );

                const craftedLeatherEquipment = Aethra.CraftingSystem?.craft?.("craft_leather_legs", {
                    stationId: "tannery",
                    techniqueId: "balanced",
                    quantity: 1,
                    commandId: "integration-focus-leather-equipment"
                });
                const completedSkinningContract = Aethra.ProfessionSystem?.getFocusTrainingState?.("skinning");
                checks.push(
                    createCheck(
                        "Equipamento escolhido conclui o Ciclo do Curtidor",
                        craftedLeatherEquipment?.accepted === true
                            && completedSkinningContract?.completed === true
                            && Aethra.QuestSystem?.getQuest?.("focus_training_skinning")?.status === "completed"
                            && Boolean(craftedLeatherEquipment?.outputs?.some((item) => item?.slot === "legs")),
                        `${craftedLeatherEquipment?.recipe?.name || "sem equipamento"} · contrato ${completedSkinningContract?.status || "ausente"}`
                    )
                );
                Aethra.WindowManager?.closeWindow?.("profession-workshop-view", { source: "integration-skinning-contract" });

                const herbalismFocus = Aethra.DisciplineSystem?.setFocus?.("herbalism", "integration-test");
                const herbalismGuidance = Aethra.DisciplineSystem?.getFocusedGuidance?.();
                const herbalismContractStart = Aethra.ProfessionSystem?.getFocusTrainingState?.("herbalism");
                const herbalismGuaranteeStart = Aethra.ExplorationSystem?.getSnapshot?.().tutorialGuarantee;
                checks.push(
                    createCheck(
                        "Foco de Herbalismo ativa rota e contrato atÃ© Alquimia",
                        herbalismFocus?.disciplineId === "herbalism"
                            && herbalismGuidance?.huntId === "verdant_grove_focus"
                            && herbalismGuidance?.mapMode === "hunts"
                            && herbalismContractStart?.active === true
                            && herbalismContractStart?.quest?.objectives?.length === 4
                            && herbalismContractStart?.guidance?.objective?.id === "practice_focus_herbalism"
                            && herbalismGuaranteeStart?.professionId === "herbalism"
                            && herbalismGuaranteeStart?.remaining === 3
                            && herbalismGuaranteeStart?.manual === true
                            && herbalismGuaranteeStart?.minimumQuantity === 2,
                        `${herbalismGuidance?.name || "sem skill"} â†’ ${herbalismGuidance?.recommendation?.name || "sem rota"} Â· ${herbalismGuaranteeStart?.remaining || 0} colheitas`
                    )
                );

                Aethra.GameState.hunt = {
                    ...(Aethra.GameState.hunt || {}),
                    isActive: true,
                    huntId: "verdant_grove_focus",
                    currentRoom: 1
                };
                Aethra.ExplorationSystem?.setRandomSource?.(() => 0.99);
                Aethra.ExplorationSystem?.tryTriggerStairsEvent?.({ room: 1 });
                const skippedHerbalismEvent = Aethra.ExplorationSystem?.getSnapshot?.().pendingEvent;
                const skippedHerbalismResult = skippedHerbalismEvent
                    ? Aethra.ExplorationSystem?.resolveEvent?.(skippedHerbalismEvent.eventId, { manual: true, skip: true })
                    : null;
                const herbalismGuaranteeAfterSkip = Aethra.ExplorationSystem?.getSnapshot?.().tutorialGuarantee;
                checks.push(
                    createCheck(
                        "Erva guiada oferece Colher/Ignorar sem consumir ao ignorar",
                        skippedHerbalismEvent?.id === "herb"
                            && skippedHerbalismEvent?.actionLabel === "Colher"
                            && skippedHerbalismEvent?.requiresManual === true
                            && skippedHerbalismEvent?.tutorialLabel === "CONTRATO DE FOCO"
                            && /colher agora ou ignorar/.test(skippedHerbalismEvent?.description || "")
                            && skippedHerbalismResult?.status === "skipped"
                            && herbalismGuaranteeAfterSkip?.remaining === 3,
                        skippedHerbalismResult ? `ignorada Â· ${herbalismGuaranteeAfterSkip?.remaining || 0} colheitas restantes` : "decisÃ£o manual ausente"
                    )
                );

                const herbsBeforeFocusLoop = Aethra.BagSystem?.countItem?.("wild_herb") || 0;
                const herbalismXPBeforeFocusLoop = Aethra.ProfessionSystem?.getState?.("herbalism")?.xpTotal || 0;
                const gatheredFocusEvents = [];
                for (let index = 0; index < 3; index += 1) {
                    Aethra.ExplorationSystem?.tryTriggerStairsEvent?.({ room: index + 2 });
                    const event = Aethra.ExplorationSystem?.getSnapshot?.().pendingEvent;
                    if (!event) break;
                    gatheredFocusEvents.push(Aethra.ExplorationSystem.resolveEvent(event.eventId, { manual: true }));
                }
                Aethra.ExplorationSystem?.setRandomSource?.(Math.random);
                const herbalismContractAfterHerbs = Aethra.ProfessionSystem?.getFocusTrainingState?.("herbalism");
                const herbsAfterFocusLoop = Aethra.BagSystem?.countItem?.("wild_herb") || 0;
                const herbalismXPAfterFocusLoop = Aethra.ProfessionSystem?.getState?.("herbalism")?.xpTotal || 0;
                const herbalismXPFromEvents = gatheredFocusEvents.reduce((sum, event) => sum + Number(event?.xpGain || 0), 0);
                checks.push(
                    createCheck(
                        "Herbalismo manual entrega XP, seis ervas e avanÃ§a ao LaboratÃ³rio",
                        gatheredFocusEvents.length === 3
                            && gatheredFocusEvents.every((event) => event?.status === "resolved" && event?.manual === true)
                            && herbsAfterFocusLoop - herbsBeforeFocusLoop === 6
                            && herbalismXPAfterFocusLoop - herbalismXPBeforeFocusLoop === herbalismXPFromEvents
                            && herbalismContractAfterHerbs?.guidance?.objective?.id === "distill_focus_extracts"
                            && herbalismContractAfterHerbs?.guidance?.professionId === "alchemy"
                            && Aethra.ExplorationSystem?.getSnapshot?.().tutorialGuarantee === null,
                        `${gatheredFocusEvents.length}/3 canteiros Â· +${herbsAfterFocusLoop - herbsBeforeFocusLoop} ervas Â· +${herbalismXPAfterFocusLoop - herbalismXPBeforeFocusLoop} XP`
                    )
                );

                Aethra.GameState.hunt.isActive = false;
                Aethra.UIManager?.setPrimaryView?.("city", { emit: false, source: "integration-herbalism-contract" });
                Aethra.ProfessionWorkshopUI?.open?.("alchemy", "laboratory", { source: "integration-herbalism-contract" });
                const guidedDistillationVisible = Boolean(
                    document.querySelector('.workshop-recipe.is-guided [data-craft-recipe="distill_wild_herb"]')
                    && /Produza Destilar Ervas/.test(document.querySelector(".profession-workshop__guidance")?.textContent || "")
                );
                const distillationResult = Aethra.CraftingSystem?.craft?.("distill_wild_herb", {
                    stationId: "laboratory",
                    techniqueId: "balanced",
                    quantity: 3,
                    commandId: "integration-focus-distillation"
                });
                const herbalismContractAfterDistill = Aethra.ProfessionSystem?.getFocusTrainingState?.("herbalism");
                Aethra.ProfessionWorkshopUI?.open?.("alchemy", "laboratory", { source: "integration-herbalism-contract-supply" });
                const guidedSupplyCards = [...document.querySelectorAll(".workshop-recipe.is-guided [data-craft-recipe]")];
                const guidedSupplyIds = guidedSupplyCards.map((card) => card.dataset.craftRecipe).sort();
                const supplyChoiceVisible = guidedSupplyCards.length === 3
                    && ["brew_health_potion", "brew_mana_potion", "brew_vigor_tonic"].every((recipeId) => guidedSupplyIds.includes(recipeId))
                    && /Escolha seu primeiro supply/.test(document.querySelector(".profession-workshop__guidance")?.textContent || "")
                    && !document.querySelector('[data-workshop-tab="maintenance"]');
                checks.push(
                    createCheck(
                        "LaboratÃ³rio conduz da destilaÃ§Ã£o para trÃªs escolhas de supply",
                        guidedDistillationVisible
                            && distillationResult?.accepted === true
                            && herbalismContractAfterDistill?.guidance?.objective?.id === "brew_focus_supply"
                            && supplyChoiceVisible,
                        `destilaÃ§Ã£o ${guidedDistillationVisible ? "guiada" : "ausente"} Â· ${guidedSupplyCards.length}/3 supplies destacados`
                    )
                );

                const vigorBeforeAlchemy = Aethra.IdleLoopSystem?.inventoryQuantity?.("minor_vigor_tonic") || 0;
                const craftedSupply = Aethra.CraftingSystem?.craft?.("brew_vigor_tonic", {
                    stationId: "laboratory",
                    techniqueId: "balanced",
                    quantity: 1,
                    commandId: "integration-focus-supply"
                });
                const vigorAfterAlchemy = Aethra.IdleLoopSystem?.inventoryQuantity?.("minor_vigor_tonic") || 0;
                const completedHerbalismContract = Aethra.ProfessionSystem?.getFocusTrainingState?.("herbalism");
                const vigorTemplate = Aethra.GameData?.items?.minor_vigor_tonic || Aethra.ItemSystem?.templates?.minor_vigor_tonic;
                checks.push(
                    createCheck(
                        "Supply escolhido conclui o ciclo e entra no estoque oficial",
                        craftedSupply?.accepted === true
                            && completedHerbalismContract?.completed === true
                            && Aethra.QuestSystem?.getQuest?.("focus_training_herbalism")?.status === "completed"
                            && vigorAfterAlchemy - vigorBeforeAlchemy === 3
                            && Number(vigorTemplate?.energyAmount) === 18,
                        `${craftedSupply?.recipe?.name || "sem supply"} Â· +${vigorAfterAlchemy - vigorBeforeAlchemy} no estoque Â· contrato ${completedHerbalismContract?.status || "ausente"}`
                    )
                );
                Aethra.WindowManager?.closeWindow?.("profession-workshop-view", { source: "integration-herbalism-contract" });

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

                /*
                 * O contrato é proteger o kit inicial, não exigir mochila sem
                 * vendáveis: loot legítimo deixado por etapas anteriores (alguns
                 * drops dependem de RNG) tornava a checagem intermitente.
                 * Uma peça do kit só viola o contrato se puder virar ouro por
                 * inteiro — como loot, ou como devolução sem o teto de
                 * sellBackQuantity, que limita o reembolso às unidades compradas
                 * quando uma compra é fundida numa pilha inicial.
                 */
                const isStarterKitItem = (item = {}) => item.source === "character-created"
                    || item.origin?.source === "character-created";
                const protectedSellables = (Aethra.NpcShopUI?.getSellableItems?.() || []).filter((entry) => {
                    if (!isStarterKitItem(entry.item)) return false;
                    if (entry.mode !== "sellback") return true;
                    const refundable = Number(entry.item?.market?.sellBackQuantity);
                    return !Number.isFinite(refundable)
                        || refundable >= Math.max(1, Number(entry.item?.quantity) || 1);
                });
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
                        `${protectedSellables.length} item(ns) iniciais vendáveis${protectedSellables.length
                            ? ` [${protectedSellables.map((entry) => `${entry.item?.templateId || entry.item?.id}:${entry.mode}:${entry.item?.market?.purchaseOrigin || entry.item?.origin?.source || entry.item?.source || "?"}×${entry.item?.quantity || 1}`).join(", ")}]`
                            : ""} · compra ${potionPurchase?.totalPrice || 0} G · devolução ${potionSellback?.salePrice || 0} G`
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

                // A cotação segue as mesmas regras da venda: a pilha que sobrou
                // (crédito de compra zerado) não pode aparecer com preço de devolução.
                const leftoverStack = (Aethra.GameState.hero.bag || []).find((item) => (item.templateId || item.id) === "potion_health");
                const leftoverQuote = leftoverStack ? Aethra.MarketplaceSystem?.getSaleQuote?.(leftoverStack) : null;
                const leftoverListed = (Aethra.NpcShopUI?.getSellableItems?.() || []).some((entry) => entry.item === leftoverStack);
                const leftoverSellback = leftoverStack ? Aethra.MarketplaceSystem?.sellBack?.(leftoverStack.instanceId) : null;
                checks.push(
                    createCheck(
                        "Loja só cota o que a venda aceita (pilha sem crédito de compra)",
                        Boolean(leftoverStack)
                            && leftoverQuote?.sellable === false
                            && leftoverListed === false
                            && !leftoverSellback,
                        `cotação ${leftoverQuote?.sellable ? `${leftoverQuote.mode} ${leftoverQuote.salePrice} G` : "recusada"} · listada ${leftoverListed ? "sim" : "não"} · venda ${leftoverSellback ? "aceita" : "recusada"}`
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
                const heroNavigationOrder = [...document.querySelectorAll(
                    "[data-player-hud-target]"
                )].map((button) => button.dataset.playerHudTarget);
                checks.push(
                    createCheck(
                        "Central 4.0 prioriza atributos sem duplicar números de combate",
                        document.querySelector(".player-hud-summary")?.dataset.hudGeneration === "4"
                            && heroNavigationOrder.join(",") === "overview,backpack,skills"
                            && !document.querySelector(".player-combat-readout"),
                        `${heroNavigationOrder.join(" → ")} · leitura duplicada ${document.querySelector(".player-combat-readout") ? "presente" : "removida"}`
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
                document.querySelector("[data-player-hud-target='backpack']")?.click();
                const styledBackpackPanel = document.querySelector(
                    "[data-hero-panel-view='backpack'].is-active"
                );
                const styledBackpackGrid = styledBackpackPanel?.querySelector(
                    ".player-backpack-grid"
                );
                const styledBackpackFilter = styledBackpackPanel?.querySelector(
                    ".hero-backpack-filters button"
                );
                const styledBackpackPanelStyle = styledBackpackPanel
                    ? getComputedStyle(styledBackpackPanel)
                    : null;
                const backpackContentIsReachable = !styledBackpackPanel
                    ? false
                    : styledBackpackPanel.scrollHeight <= styledBackpackPanel.clientHeight + 2
                        || ["auto", "scroll"].includes(styledBackpackPanelStyle?.overflowY);
                checks.push(
                    createCheck(
                        "Backpack atual usa grade compacta e nunca corta conteúdo",
                        styledBackpackPanelStyle?.display === "grid"
                            && Boolean(styledBackpackGrid)
                            && getComputedStyle(styledBackpackGrid).display === "grid"
                            && styledBackpackPanel?.querySelectorAll(".player-backpack-slot").length >= 18
                            && Boolean(styledBackpackFilter)
                            && parseFloat(getComputedStyle(styledBackpackFilter).fontSize) <= 8
                            && backpackContentIsReachable,
                        styledBackpackPanel
                            ? `${styledBackpackPanel.clientHeight}/${styledBackpackPanel.scrollHeight}px · overflow ${styledBackpackPanelStyle?.overflowY}`
                            : "painel da mochila ausente"
                    )
                );

                document.querySelector("[data-intelligence-tab='analyzer']")?.click();
                const styledAnalyzer = document.querySelector(".hunt-analyzer--ledger");
                const styledAnalyzerParent = styledAnalyzer?.parentElement;
                const styledAnalyzerRect = styledAnalyzer?.getBoundingClientRect?.();
                const styledAnalyzerParentRect = styledAnalyzerParent?.getBoundingClientRect?.();
                const styledAnalyzerStyle = styledAnalyzer
                    ? getComputedStyle(styledAnalyzer)
                    : null;
                const analyzerStaysInsidePanel = !styledAnalyzerRect?.height
                    || styledAnalyzerRect.bottom <= styledAnalyzerParentRect.bottom + 2;
                checks.push(
                    createCheck(
                        "Hunt Analyzer atual mantém cards, tipografia e rolagem interna",
                        styledAnalyzerStyle?.display === "flex"
                            && styledAnalyzerStyle?.overflowY === "auto"
                            && parseFloat(styledAnalyzerStyle?.fontSize || "99") <= 10
                            && styledAnalyzer?.querySelectorAll(".analyzer-ledger-card").length === 6
                            && analyzerStaysInsidePanel,
                        styledAnalyzer
                            ? `${styledAnalyzer.clientHeight}/${styledAnalyzer.scrollHeight}px · 6 cards · ${styledAnalyzerStyle?.fontSize}`
                            : "ledger do analisador ausente"
                    )
                );

                const hudTooltipTrigger = document.querySelector(
                    "#hunt-panel-hero [data-tooltip-kind='hud']"
                );
                let hudTooltipIsCompact = false;
                let hudTooltipDetail = "tooltip indisponível";
                if (hudTooltipTrigger && Aethra.TooltipManager?.show?.(hudTooltipTrigger)) {
                    const tooltipElement = document.getElementById("aethra-ui-tooltip");
                    const tooltipRect = tooltipElement?.getBoundingClientRect?.();
                    const heroSidebarRect = document.getElementById("hunt-panel-hero")
                        ?.getBoundingClientRect?.();
                    const opensBesideSidebar = window.innerWidth <= 1120
                        || tooltipRect.left >= heroSidebarRect.right + 5;
                    hudTooltipIsCompact = tooltipElement?.hidden === false
                        && tooltipRect.width <= 300
                        && opensBesideSidebar;
                    hudTooltipDetail = `${Math.round(tooltipRect.width)}px · x ${Math.round(tooltipRect.left)} · Central ${Math.round(heroSidebarRect.right)}`;
                    Aethra.TooltipManager.hide();
                }
                checks.push(
                    createCheck(
                        "Tooltip da Central abre compacto e fora do painel",
                        hudTooltipIsCompact,
                        hudTooltipDetail
                    )
                );

                const skillTooltipTrigger = document.querySelector(
                    "[data-tooltip-kind='skill'][data-skill-id]"
                );
                let skillTooltipRenders = false;
                let skillTooltipDetail = "habilidade da ActionBar ausente";
                if (skillTooltipTrigger) {
                    try {
                        const skillTooltipHTML = Aethra.TooltipManager?.buildHTML?.(
                            skillTooltipTrigger
                        ) || "";
                        skillTooltipRenders = skillTooltipHTML.includes(
                            "aethra-ui-tooltip__skill"
                        );
                        skillTooltipDetail = skillTooltipRenders
                            ? "habilidade renderizada com ordem e automação"
                            : "HTML da habilidade vazio";
                    } catch (error) {
                        skillTooltipDetail = error?.message || String(error);
                    }
                }
                checks.push(
                    createCheck(
                        "Tooltip de habilidade renderiza sem erro de prioridade",
                        skillTooltipRenders,
                        skillTooltipDetail
                    )
                );

                document.querySelector(`[data-intelligence-tab='${intelligenceTabBeforeAudit}']`)?.click();
                document.querySelector(`[data-player-hud-target='${selectedHeroTabBeforeAudit}']`)?.click();

                const actionBarPreviousPrimaryView = Aethra.UIManager?.primaryView
                    || Aethra.GameState.ui?.primaryView
                    || "hunt";
                Aethra.UIManager?.setPrimaryView?.("hunt", {
                    emit: false,
                    source: "integration-actionbar-audit"
                });
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
                const actionBarDeckRect = document.querySelector(".combat-action-deck")
                    ?.getBoundingClientRect?.();
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
                const actionBarDeckIsFocused = window.innerWidth <= 1120 || (
                    Number(actionBarDeckRect?.width || 0) <= 1542
                    && Math.abs(
                        Number(actionBarDeckRect?.left || 0)
                            + Number(actionBarDeckRect?.width || 0) / 2
                            - window.innerWidth / 2
                    ) <= 2
                );
                checks.push(
                    createCheck(
                        "ActionBar desktop concentra as decisões no centro da tela",
                        Boolean(actionBarDeckRect) && actionBarDeckIsFocused,
                        `${Math.round(Number(actionBarDeckRect?.width || 0))}px · centro ${Math.round(Number(actionBarDeckRect?.left || 0) + Number(actionBarDeckRect?.width || 0) / 2)}px`
                    )
                );
                const actionBarSlots = [...document.querySelectorAll(
                    "#battle-actionbar-layer #skill-action-bar > .battle-action-slot"
                )];
                const actionBarSlotRects = actionBarSlots.map((slot) => slot.getBoundingClientRect());
                const actionBarSlotWidths = actionBarSlotRects.map((rect) => Number(rect.width || 0));
                const actionBarSlotHeights = actionBarSlotRects.map((rect) => Number(rect.height || 0));
                const actionBarGrid = document.getElementById("skill-action-bar");
                const actionBarGridRect = actionBarGrid?.getBoundingClientRect?.();
                const actionBarGridGap = parseFloat(
                    actionBarGrid ? getComputedStyle(actionBarGrid).columnGap : "0"
                ) || 0;
                const expectedActionSlotWidth = (
                    Number(actionBarGridRect?.width || 0) - actionBarGridGap * 9
                ) / 10;
                const hasNeutralScale = (element) => {
                    const transform = getComputedStyle(element).transform;
                    if (!transform || transform === "none") return true;
                    const matrix = new DOMMatrixReadOnly(transform);
                    const scaleX = Math.hypot(matrix.a, matrix.b);
                    const scaleY = Math.hypot(matrix.c, matrix.d);
                    return Math.abs(scaleX - 1) <= 0.01 && Math.abs(scaleY - 1) <= 0.01;
                };
                const filledActionBarWidths = actionBarSlots
                    .filter((slot) => !slot.classList.contains("is-empty"))
                    .map((slot) => slot.getBoundingClientRect().width);
                const emptyActionBarWidths = actionBarSlots
                    .filter((slot) => slot.classList.contains("is-empty"))
                    .map((slot) => slot.getBoundingClientRect().width);
                const usesCompactActionGrid = window.innerWidth <= 820;
                const hotbarLayout = actionBarGrid?.dataset.hotbarLayout || "";
                const usesClassicIconHotbar = window.innerWidth > 1120
                    && ["classic-icons", "command-deck"].includes(hotbarLayout);
                const actionBarHierarchyIsIntentional = usesCompactActionGrid || usesClassicIconHotbar
                    ? Math.max(...actionBarSlotWidths) - Math.min(...actionBarSlotWidths) <= 2
                    : filledActionBarWidths.length === 0
                        || emptyActionBarWidths.length === 0
                        || Math.min(...filledActionBarWidths) >= Math.max(...emptyActionBarWidths) + 8;
                const actionBarGridFits = actionBarGrid.scrollWidth <= actionBarGrid.clientWidth + 1;
                const actionBarSlotContentsFit = actionBarSlots.every((slot) => {
                        const button = slot.querySelector(".battle-action-slot__skill");
                        const slotRect = slot.getBoundingClientRect();
                        const buttonRect = button?.getBoundingClientRect?.();
                        if (usesClassicIconHotbar) {
                            return hasNeutralScale(slot)
                                && Boolean(button)
                                && hasNeutralScale(button)
                                && Number(buttonRect?.left || 0) >= slotRect.left - 1
                                && Number(buttonRect?.right || 0) <= slotRect.right + 1
                                && Number(buttonRect?.top || 0) >= slotRect.top - 1
                                && Number(buttonRect?.bottom || 0) <= slotRect.bottom + 1
                                && getComputedStyle(button).overflow === "hidden";
                        }
                        return hasNeutralScale(slot)
                            && Boolean(button)
                            && hasNeutralScale(button)
                            && slot.scrollWidth <= slot.clientWidth + 1
                            && slot.scrollHeight <= slot.clientHeight + 1
                            && button.scrollWidth <= button.clientWidth + 1
                            && button.scrollHeight <= button.clientHeight + 1;
                    });
                const actionBarSlotsAligned = actionBarSlots.length >= 10
                    && Math.max(...actionBarSlotHeights) - Math.min(...actionBarSlotHeights) <= 1
                    && actionBarHierarchyIsIntentional
                    && actionBarGridFits
                    && actionBarSlotContentsFit;
                checks.push(
                    createCheck(
                        "ActionBar usa uma grade consistente sem cortar slots equipados ou vazios",
                        actionBarSlotsAligned,
                        actionBarSlotsAligned
                            ? `${filledActionBarWidths.length} equipados · ${emptyActionBarWidths.length} vazios · ${usesClassicIconHotbar ? "hotbar clássica" : "grade adaptativa"}`
                            : `hierarquia ${actionBarHierarchyIsIntentional} · grade ${actionBarGridFits} · conteúdo ${actionBarSlotContentsFit} · larguras ${actionBarSlotWidths.map((value) => value.toFixed(1)).join("/")} · alturas ${actionBarSlotHeights.map((value) => value.toFixed(1)).join("/")}`
                    )
                );
                const actionBarOccupiedLeft = actionBarSlotRects.length > 0
                    ? Math.min(...actionBarSlotRects.map((rect) => rect.left))
                    : 0;
                const actionBarOccupiedRight = actionBarSlotRects.length > 0
                    ? Math.max(...actionBarSlotRects.map((rect) => rect.right))
                    : 0;
                const actionBarOccupiedCenter = (actionBarOccupiedLeft + actionBarOccupiedRight) / 2;
                const actionBarGridCenter = (
                    Number(actionBarGridRect?.left || 0) + Number(actionBarGridRect?.right || 0)
                ) / 2;
                const actionBarGroupIsCentered = window.innerWidth <= 1120 || (
                    actionBarSlotRects.length >= 10
                    && Math.abs(actionBarOccupiedCenter - actionBarGridCenter) <= 2
                );
                checks.push(
                    createCheck(
                        "ActionBar centraliza o conjunto de slots quando há espaço livre",
                        actionBarGroupIsCentered,
                        `${Math.round(actionBarOccupiedLeft)}–${Math.round(actionBarOccupiedRight)} · centro da grade ${Math.round(actionBarGridCenter)}`
                    )
                );
                const filledActionSlots = actionBarSlots.filter((slot) => !slot.classList.contains("is-empty"));
                const actionBarInteractiveContentFits = window.innerWidth <= 1120 || filledActionSlots.every((slot) => {
                    const slotRect = slot.getBoundingClientRect();
                    const button = slot.querySelector(".battle-action-slot__skill");
                    const controls = slot.querySelector(".battle-action-slot__controls");
                    const name = slot.querySelector(".battle-action-slot__name");
                    const icon = slot.querySelector(".battle-action-slot__icon");
                    const buttonRect = button?.getBoundingClientRect?.();
                    const controlsRect = controls?.getBoundingClientRect?.();
                    const nameRect = name?.getBoundingClientRect?.();
                    const iconRect = icon?.getBoundingClientRect?.();
                    const nameReadable = Number(nameRect?.width || 0) >= 48;
                    return Boolean(button && controls && name)
                        && Number(buttonRect?.top || 0) >= slotRect.top - 1
                        && Number(controlsRect?.bottom || 0) <= slotRect.bottom + 1
                        && (usesClassicIconHotbar
                            ? getComputedStyle(controls).overflow === "hidden"
                            : controls.scrollWidth <= controls.clientWidth + 1
                                && controls.scrollHeight <= controls.clientHeight + 1)
                        && (usesClassicIconHotbar
                            ? Number(iconRect?.width || 0) >= 30
                                && Number(iconRect?.height || 0) >= 30
                                && Boolean(button.getAttribute("aria-label"))
                            : nameReadable);
                });
                checks.push(
                    createCheck(
                        usesClassicIconHotbar
                            ? "Hotbar clássica mantém ícones, atalhos e automação íntegros"
                            : "ActionBar desktop mantém nomes, controles e automação totalmente visíveis",
                        filledActionSlots.length > 0 && actionBarInteractiveContentFits,
                        `${filledActionSlots.length} habilidades equipadas · conteúdo ${actionBarInteractiveContentFits ? "íntegro" : "cortado"}`
                    )
                );
                const actionBarHeader = document.querySelector(
                    "#battle-actionbar-layer .battle-panel__header"
                );
                const actionBarHeaderRect = actionBarHeader?.getBoundingClientRect?.();
                const speedButtons = [...document.querySelectorAll(
                    "#battle-actionbar-layer .battle-speed-controls button"
                )];
                const speedButtonRects = speedButtons.map((button) => button.getBoundingClientRect());
                const speedControlsStayInline = window.innerWidth <= 1120 || (
                    speedButtonRects.length === 3
                    && Math.max(...speedButtonRects.map((rect) => rect.top))
                        - Math.min(...speedButtonRects.map((rect) => rect.top)) <= 1
                    && speedButtonRects.every((rect) => (
                        rect.top >= Number(actionBarHeaderRect?.top || 0) - 1
                        && rect.bottom <= Number(actionBarHeaderRect?.bottom || 0) + 1
                    ))
                    && Number(actionBarHeader?.scrollWidth || 0)
                        <= Number(actionBarHeader?.clientWidth || 0) + 1
                );
                checks.push(
                    createCheck(
                        "Controles de velocidade permanecem em uma única linha",
                        Boolean(actionBarHeader) && speedControlsStayInline,
                        `${speedButtons.length} controles · ${speedControlsStayInline ? "alinhados" : "quebrados"}`
                    )
                );
                const usesCommandDeck = window.innerWidth >= 1280
                    && hotbarLayout === "command-deck";
                const commandDeckToolbar = document.querySelector(
                    "#battle-actionbar-layer .actionbar-workspace__toolbar"
                );
                const commandDeckToolbarRect = commandDeckToolbar?.getBoundingClientRect?.();
                const commandDeckTitle = document.querySelector(
                    "#battle-actionbar-layer .battle-panel__header > div:first-child"
                );
                const commandDeckVitals = document.querySelector(
                    "#battle-actionbar-layer .actionbar-vital-strip-root"
                );
                const commandDeckGlyphs = document.querySelectorAll(
                    "#battle-actionbar-layer .battle-action-slot.is-filled .skill-glyph svg"
                );
                const commandDeckIsReadable = !usesCommandDeck || (
                    actionBarSlotRects.every((rect) => rect.width >= 63 && rect.height >= 75)
                    && Number(commandDeckToolbarRect?.width || 0) >= 96
                    && Number(commandDeckToolbarRect?.height || 0) >= 74
                    && getComputedStyle(commandDeckTitle).display === "none"
                    && getComputedStyle(commandDeckVitals).display === "none"
                    && commandDeckGlyphs.length === filledActionSlots.length
                );
                checks.push(
                    createCheck(
                        "Command Deck mantém escala de jogo e remove informações duplicadas",
                        Boolean(commandDeckToolbar) && commandDeckIsReadable,
                        usesCommandDeck
                            ? `${Math.round(actionBarSlotWidths[0] || 0)}×${Math.round(actionBarSlotHeights[0] || 0)}px · ${commandDeckGlyphs.length} glifos vetoriais`
                            : `layout ${hotbarLayout || "adaptativo"}`
                    )
                );
                Aethra.UIManager?.setPrimaryView?.(actionBarPreviousPrimaryView, {
                    emit: false,
                    source: "integration-actionbar-audit-restore"
                });
                const visualAuditPreviousPrimaryView = Aethra.UIManager?.primaryView
                    || Aethra.GameState.ui?.primaryView
                    || "hunt";
                Aethra.UIManager?.setPrimaryView?.("hunt", {
                    emit: false,
                    source: "integration-visual-audit"
                });

                const summaryEquipmentMatrix = document.getElementById("battle-equipment-summary");
                const summaryEquipmentSlots = [...document.querySelectorAll(
                    "#battle-equipment-summary > [data-battle-equipment-slot]"
                )];
                const summaryEquipmentRect = summaryEquipmentMatrix?.getBoundingClientRect?.();
                const summaryEquipmentSlotRects = summaryEquipmentSlots.map((slot) => slot.getBoundingClientRect());
                const summaryEquipmentSlotsVisible = window.innerWidth <= 1120
                    || summaryEquipmentSlots.every((slot, index) => {
                        const rect = summaryEquipmentSlotRects[index];
                        return rect.width >= 24
                            && rect.height >= 24
                            && rect.top >= Number(summaryEquipmentRect?.top || 0) - 1
                            && rect.bottom <= Number(summaryEquipmentRect?.bottom || 0) + 1
                            && slot.scrollWidth <= slot.clientWidth + 1
                            && slot.scrollHeight <= slot.clientHeight + 1;
                    });
                const summaryEquipmentMatrixReadable = Boolean(summaryEquipmentMatrix)
                    && summaryEquipmentSlots.length === 11
                    && (window.innerWidth <= 1120 || Number(summaryEquipmentRect?.height || 0) >= 64)
                    && summaryEquipmentSlotsVisible;
                checks.push(
                    createCheck(
                        "Central do Herói mantém o paperdoll completo e sem corte",
                        summaryEquipmentMatrixReadable,
                        `${summaryEquipmentSlots.length} slots · matriz ${Math.round(Number(summaryEquipmentRect?.width || 0))}×${Math.round(Number(summaryEquipmentRect?.height || 0))}px`
                    )
                );
                const paperdollColumns = new Set(summaryEquipmentSlots.map((slot) => Math.round(slot.getBoundingClientRect().left)));
                const paperdollRows = new Set(summaryEquipmentSlots.map((slot) => Math.round(slot.getBoundingClientRect().top)));
                const paperdollAvatarRect = summaryEquipmentMatrix?.querySelector(".player-paperdoll-avatar")
                    ?.getBoundingClientRect?.();
                const rectsOverlap = (left, right) => Boolean(left && right)
                    && Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1
                    && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1;
                const paperdollSlotsDoNotCollide = summaryEquipmentSlotRects.every((rect, index) => (
                    !rectsOverlap(rect, paperdollAvatarRect)
                    && summaryEquipmentSlotRects.slice(index + 1).every((other) => !rectsOverlap(rect, other))
                ));
                const paperdollAvatarCenter = (
                    Number(paperdollAvatarRect?.left || 0) + Number(paperdollAvatarRect?.right || 0)
                ) / 2;
                const paperdollSlotsLeftOfHero = summaryEquipmentSlotRects.filter(
                    (rect) => rect.right <= paperdollAvatarCenter
                ).length;
                const paperdollSlotsRightOfHero = summaryEquipmentSlotRects.filter(
                    (rect) => rect.left >= paperdollAvatarCenter
                ).length;
                const paperdollHasRpgComposition = window.innerWidth <= 1120 || (
                    Boolean(summaryEquipmentMatrix?.querySelector(".player-paperdoll-avatar img"))
                    && summaryEquipmentMatrix?.dataset.paperdollLayout === "body"
                    && paperdollColumns.size >= 4
                    && paperdollRows.size >= 4
                    && paperdollSlotsLeftOfHero >= 5
                    && paperdollSlotsRightOfHero >= 5
                    && paperdollSlotsDoNotCollide
                );
                checks.push(
                    createCheck(
                        "Central do Herói posiciona equipamentos ao redor do corpo",
                        paperdollHasRpgComposition,
                        `${paperdollSlotsLeftOfHero} esquerda · ${paperdollSlotsRightOfHero} direita · ${paperdollRows.size} níveis · colisões ${paperdollSlotsDoNotCollide ? "0" : "detectadas"}`
                    )
                );

                const paperdollSpriteViewport = summaryEquipmentMatrix?.querySelector(".player-paperdoll-sprite");
                const paperdollSpriteImage = paperdollSpriteViewport?.querySelector("img");
                const paperdollSpriteViewportRect = paperdollSpriteViewport?.getBoundingClientRect?.();
                const paperdollSpriteImageRect = paperdollSpriteImage?.getBoundingClientRect?.();
                const paperdollSpriteIsReadable = window.innerWidth <= 1120 || (
                    Number(paperdollSpriteViewportRect?.height || 0) >= 52
                    && Number(paperdollSpriteImageRect?.height || 0) >= 48
                    && Number(paperdollSpriteImageRect?.top || 0) >= Number(summaryEquipmentRect?.top || 0) - 1
                    && Number(paperdollSpriteImageRect?.bottom || 0) <= Number(summaryEquipmentRect?.bottom || 0) + 1
                );
                checks.push(
                    createCheck(
                        "Paperdoll mantém o herói legível dentro da área reservada",
                        Boolean(paperdollSpriteViewport && paperdollSpriteImage) && paperdollSpriteIsReadable,
                        `recorte ${Math.round(Number(paperdollSpriteViewportRect?.width || 0))}×${Math.round(Number(paperdollSpriteViewportRect?.height || 0))} · imagem ${Math.round(Number(paperdollSpriteImageRect?.width || 0))}×${Math.round(Number(paperdollSpriteImageRect?.height || 0))}`
                    )
                );

                const topbar = document.querySelector(".topbar");
                const topbarVisibleChildren = topbar
                    ? [...topbar.children]
                        .filter((element) => getComputedStyle(element).display !== "none")
                        .map((element) => element.getBoundingClientRect())
                        .filter((rect) => rect.width > 0)
                        .sort((left, right) => left.left - right.left)
                    : [];
                const topbarHasNoCollisions = topbarVisibleChildren.length >= 2
                    && topbarVisibleChildren.every((rect, index) => (
                        rect.left >= -1
                        && rect.right <= window.innerWidth + 1
                        && (index === 0 || topbarVisibleChildren[index - 1].right <= rect.left + 1)
                    ));
                checks.push(
                    createCheck(
                        "Topbar adapta seus grupos sem colisão horizontal",
                        topbarHasNoCollisions,
                        topbarVisibleChildren.map((rect) => `${Math.round(rect.left)}–${Math.round(rect.right)}`).join(" · ")
                    )
                );
                const topbarBrand = topbar?.querySelector(".aethra-brand");
                const topbarHero = document.getElementById("topbar-hero");
                const topbarTabs = topbar?.querySelector(".window-tabs");
                const topbarBrandRect = topbarBrand?.getBoundingClientRect?.();
                const topbarHeroRect = topbarHero?.getBoundingClientRect?.();
                const topbarTabsRect = topbarTabs?.getBoundingClientRect?.();
                const topbarWideGroupsBounded = window.innerWidth < 1600 || (
                    getComputedStyle(topbarHero).display === "none"
                    && Number(topbarBrandRect?.width || 0) >= 225
                    && Number(topbarTabsRect?.width || 0) >= 390
                    && Number(topbarBrand?.scrollWidth || 0) <= Number(topbarBrand?.clientWidth || 0) + 1
                    && Number(topbarTabs?.scrollWidth || 0) <= Number(topbarTabs?.clientWidth || 0) + 1
                );
                checks.push(
                    createCheck(
                        "Topbar clássica remove o herói duplicado e preserva marca e navegação",
                        topbarWideGroupsBounded,
                        `${Math.round(Number(topbarBrandRect?.width || 0))}px marca · herói ${getComputedStyle(topbarHero).display} · ${Math.round(Number(topbarTabsRect?.width || 0))}px navegação`
                    )
                );

                const heroPanelRect = document.getElementById("hunt-panel-hero")
                    ?.getBoundingClientRect?.();
                const analyzerPanelRect = document.getElementById("hunt-panel-analysis")
                    ?.getBoundingClientRect?.();
                const stagePanelRect = document.getElementById("hunt-panel-combat")
                    ?.getBoundingClientRect?.();
                const layoutPanelRect = document.querySelector(".battle-hunt-layout")
                    ?.getBoundingClientRect?.();
                const stageShare = Number(stagePanelRect?.width || 0)
                    / Math.max(1, Number(layoutPanelRect?.width || 0));
                const wideColumnsReadable = window.innerWidth < 1441 || (
                    Number(heroPanelRect?.width || 0) >= 280
                    && Number(analyzerPanelRect?.width || 0) >= 295
                    && stageShare >= 0.61
                );
                checks.push(
                    createCheck(
                        "Cockpit amplo mantém laterais legíveis e devolve foco ao palco",
                        wideColumnsReadable,
                        `${Math.round(Number(heroPanelRect?.width || 0))}px herói · ${Math.round(Number(stagePanelRect?.width || 0))}px palco (${Math.round(stageShare * 100)}%) · ${Math.round(Number(analyzerPanelRect?.width || 0))}px Analyzer`
                    )
                );
                const classicTopbarRect = document.querySelector(".topbar")?.getBoundingClientRect?.();
                const classicActionBarRect = document.getElementById("battle-actionbar-layer")
                    ?.getBoundingClientRect?.();
                const classicRpgCompositionIsCompact = window.innerWidth <= 1120 || (
                    Number(classicTopbarRect?.height || 0) <= 54
                    && Number(classicActionBarRect?.height || 0) <= 126
                    && (window.innerWidth < 1800 || stageShare >= 0.67)
                );
                checks.push(
                    createCheck(
                        "HUD de cliente RPG prioriza o mundo e mantém docks compactos",
                        classicRpgCompositionIsCompact,
                        `${Math.round(Number(classicTopbarRect?.height || 0))}px topo · ${Math.round(stageShare * 100)}% mundo · ${Math.round(Number(classicActionBarRect?.height || 0))}px hotbar`
                    )
                );

                const densityTabBeforeAudit = document.querySelector(
                    "[data-player-hud-target][aria-selected='true']"
                )?.dataset.playerHudTarget || "overview";
                document.querySelector("[data-player-hud-target='overview']")?.click();
                const densityWorkspace = document.querySelector(".player-hud-workspace");
                const densityOverview = document.querySelector("[data-hero-panel-view='overview']");
                const densityLastAttribute = densityOverview?.querySelector(".hero-attribute:last-child");
                const densityWorkspaceRect = densityWorkspace?.getBoundingClientRect?.();
                const densityLastAttributeRect = densityLastAttribute?.getBoundingClientRect?.();
                const lowDesktop = window.innerWidth > 1120 && window.innerHeight <= 760;
                const lowDesktopSummaryRect = document.getElementById("stats-display")
                    ?.getBoundingClientRect?.();
                const lowDesktopContentReachable = !lowDesktop || (
                    Number(lowDesktopSummaryRect?.height || 0) <= 272
                    && Number(densityOverview?.clientHeight || 0) >= Number(densityOverview?.scrollHeight || 0) - 1
                    && Number(densityLastAttributeRect?.bottom || 0)
                        - Number(densityWorkspaceRect?.top || 0)
                        <= Number(densityWorkspace?.scrollHeight || 0) + 1
                    && Number(densityWorkspace?.scrollHeight || 0) > Number(densityWorkspace?.clientHeight || 0)
                );
                checks.push(
                    createCheck(
                        "Central baixa mantém todos os atributos alcançáveis por rolagem",
                        Boolean(densityWorkspace && densityOverview && densityLastAttribute)
                            && lowDesktopContentReachable,
                        lowDesktop
                            ? `resumo ${Math.round(Number(lowDesktopSummaryRect?.height || 0))}px · área ${densityWorkspace?.clientHeight}/${densityWorkspace?.scrollHeight}px`
                            : `${window.innerHeight}px de altura · composição padrão`
                    )
                );
                document.querySelector(`[data-player-hud-target='${densityTabBeforeAudit}']`)?.click();

                const filledActionName = document.querySelector(
                    "#battle-actionbar-layer .battle-action-slot.is-filled .battle-action-slot__name"
                );
                const analyzerMetricLabel = document.querySelector(
                    "#hunt-panel-analysis .analyzer-ledger-card small, #hunt-panel-analysis .analyzer-objective-card > div strong"
                );
                const filledActionIcon = document.querySelector(
                    "#battle-actionbar-layer .battle-action-slot.is-filled .battle-action-slot__icon"
                );
                const filledActionButton = document.querySelector(
                    "#battle-actionbar-layer .battle-action-slot.is-filled .battle-action-slot__skill"
                );
                const filledActionIconRect = filledActionIcon?.getBoundingClientRect?.();
                const readableHudType = window.innerWidth <= 1120 || (
                    (usesClassicIconHotbar
                        ? Number(filledActionIconRect?.width || 0) >= 30
                            && Boolean(filledActionButton?.getAttribute("aria-label"))
                        : parseFloat(filledActionName ? getComputedStyle(filledActionName).fontSize : "0") >= 10)
                    && parseFloat(analyzerMetricLabel ? getComputedStyle(analyzerMetricLabel).fontSize : "0") >= 8
                );
                checks.push(
                    createCheck(
                        usesClassicIconHotbar
                            ? "Hotbar e Analyzer preservam leitura e acessibilidade no desktop"
                            : "ActionBar e Analyzer usam tipografia legível no desktop",
                        Boolean(filledActionName) && Boolean(analyzerMetricLabel) && readableHudType,
                        `${usesClassicIconHotbar ? `${Math.round(Number(filledActionIconRect?.width || 0))}px ícone` : `${filledActionName ? getComputedStyle(filledActionName).fontSize : "?"} ActionBar`} · ${analyzerMetricLabel ? getComputedStyle(analyzerMetricLabel).fontSize : "?"} Analyzer`
                    )
                );
                Aethra.UIManager?.setPrimaryView?.(visualAuditPreviousPrimaryView, {
                    emit: false,
                    source: "integration-visual-audit-restore"
                });
                Aethra.RenderEngine?.syncStageMode?.(previousBattleMode);

                Aethra.HuntAnalyzerWorkspace?.render?.();
                const analyzerDetails = document.querySelector("[data-analyzer-extended]");
                const analyzerPreparationMode = document.querySelector(".analyzer-preparation");
                const analyzerModeIsComplete = analyzerPreparationMode
                    ? Boolean(
                        analyzerPreparationMode.querySelector(".analyzer-objective-card")
                        && analyzerPreparationMode.querySelectorAll(".analyzer-readiness__grid > span").length === 4
                        && analyzerPreparationMode.querySelector("[data-analyzer-open-map]")
                    )
                    : Boolean(analyzerDetails)
                        && document.querySelectorAll(".analyzer-ledger-card").length === 6;
                checks.push(
                    createCheck(
                        "Hunt Analyzer mostra preparação parado e telemetria durante a Hunt",
                        analyzerModeIsComplete,
                        analyzerPreparationMode
                            ? "objetivo, prontidão e acesso ao mapa disponíveis"
                            : `${document.querySelectorAll(".analyzer-ledger-card").length} métricas rápidas · detalhe ${analyzerDetails ? "disponível" : "ausente"}`
                    )
                );

                const analyzerPreparationActions = analyzerPreparationMode?.querySelector(".analyzer-preparation__actions");
                const analyzerPreparationRect = analyzerPreparationMode?.getBoundingClientRect?.();
                const analyzerPreparationActionsRect = analyzerPreparationActions?.getBoundingClientRect?.();
                const analyzerPrimaryActionsReachable = !analyzerPreparationMode || (
                    Boolean(analyzerPreparationActions)
                    && Number(analyzerPreparationActionsRect?.top || 0) >= Number(analyzerPreparationRect?.top || 0) - 1
                    && Number(analyzerPreparationActionsRect?.bottom || 0) <= Number(analyzerPreparationRect?.bottom || 0) + 1
                );
                const analyzerPreparationBlocks = analyzerPreparationMode
                    ? [
                        ".analyzer-preparation__hero",
                        ".analyzer-objective-card",
                        ".analyzer-readiness",
                        ".analyzer-last-session",
                        ".analyzer-preparation__actions"
                    ]
                        .map((selector) => analyzerPreparationMode.querySelector(selector))
                        .filter((element) => element && getComputedStyle(element).display !== "none")
                        .map((element) => element.getBoundingClientRect())
                        .sort((left, right) => left.top - right.top)
                    : [];
                const analyzerPreparationBlocksDoNotOverlap = !analyzerPreparationMode
                    || analyzerPreparationBlocks.every((rect, index) => (
                        index === 0 || analyzerPreparationBlocks[index - 1].bottom <= rect.top + 1
                    ));
                const sharedSaveBanner = document.getElementById("aethra-shared-save-banner");
                const sharedSaveBannerWasHidden = sharedSaveBanner?.hidden === true;
                if (sharedSaveBanner && window.innerWidth > 1120) sharedSaveBanner.hidden = false;
                const sharedSaveBannerRect = sharedSaveBanner?.getBoundingClientRect?.();
                const analyzerDesktopRect = document.getElementById("hunt-panel-analysis")?.getBoundingClientRect?.();
                const sharedSaveAvoidsAnalyzer = window.innerWidth <= 1120
                    || !sharedSaveBanner
                    || Number(sharedSaveBannerRect?.right || 0) <= Number(analyzerDesktopRect?.left || 0) + 1
                    || Number(sharedSaveBannerRect?.left || 0) >= Number(analyzerDesktopRect?.right || 0) - 1;
                if (sharedSaveBanner) sharedSaveBanner.hidden = sharedSaveBannerWasHidden;
                checks.push(
                    createCheck(
                        "Analyzer mantém ações alcançáveis e notificações fora do painel",
                        analyzerPrimaryActionsReachable
                            && analyzerPreparationBlocksDoNotOverlap
                            && sharedSaveAvoidsAnalyzer,
                        `ações ${analyzerPrimaryActionsReachable ? "visíveis" : "fora da área"} · blocos ${analyzerPreparationBlocksDoNotOverlap ? "separados" : "sobrepostos"} · aviso ${sharedSaveAvoidsAnalyzer ? "seguro" : "sobreposto"}`
                    )
                );
                const analyzerSidebar = document.getElementById("hunt-panel-analysis");
                const analyzerIdleContextIsClean = !analyzerPreparationMode || (
                    analyzerSidebar?.classList.contains("is-preparing")
                    && getComputedStyle(analyzerSidebar.querySelector(".battle-panel--log")).display === "none"
                    && getComputedStyle(analyzerSidebar.querySelector(".hunt-session-summary")).display === "none"
                    && (!lowDesktop
                        || getComputedStyle(analyzerSidebar.querySelector(".analyzer-last-session")).display === "none")
                );
                checks.push(
                    createCheck(
                        "Analyzer parado mostra direção sem telemetria vazia",
                        analyzerIdleContextIsClean,
                        analyzerPreparationMode
                            ? `modo preparação · log ${getComputedStyle(analyzerSidebar.querySelector(".battle-panel--log")).display}`
                            : "Hunt ativa · telemetria contextual preservada"
                    )
                );

                const analyzerUIState = Aethra.GameState.ui = Aethra.GameState.ui || {};
                const analyzerHadPreference = Object.prototype.hasOwnProperty.call(
                    analyzerUIState,
                    "huntAnalyzerExpanded"
                );
                const analyzerPreviousPreference = analyzerUIState.huntAnalyzerExpanded;
                delete analyzerUIState.huntAnalyzerExpanded;
                Aethra.HuntAnalyzerWorkspace?.render?.();
                const analyzerDefaultDetails = document.querySelector("[data-analyzer-extended]");
                const analyzerSupplyDetails = document.querySelector(".analyzer-disclosure");
                const analyzerDefaultPreparation = document.querySelector(".analyzer-preparation");
                const analyzerDefaultsCompact = analyzerDefaultPreparation
                    ? !analyzerDefaultPreparation.querySelector(".analyzer-ledger-grid")
                    : analyzerDefaultDetails?.open === false
                        && analyzerSupplyDetails?.open === false;
                if (analyzerHadPreference) {
                    analyzerUIState.huntAnalyzerExpanded = analyzerPreviousPreference;
                } else {
                    delete analyzerUIState.huntAnalyzerExpanded;
                }
                Aethra.HuntAnalyzerWorkspace?.render?.();
                checks.push(
                    createCheck(
                        "Hunt Analyzer inicia compacto e deixa relatórios sob demanda",
                        analyzerDefaultsCompact,
                        analyzerDefaultsCompact
                            ? "resumo visível · análise e supplies recolhidos"
                            : "algum relatório abriu sozinho"
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
                        `inventário ${Aethra.WindowManager?.isOpen?.("inventory-view") ? "aberto" : "fechado"} · skills y=${Math.round(skillsRect?.top || 0)}–${Math.round(skillsRect?.bottom || 0)} · topbar=${Math.round(topbarBottom)} · actionbar=${Math.round(actionBarTop)}`
                    )
                );
                Aethra.WindowManager?.closeAll?.({ modalOnly: true, silent: true });

                Aethra.openHuntWorldMap?.({ source: "integration-overlay" });
                const worldMapWindow = document.getElementById("hunt-world-map-view");
                const worldMapRect = worldMapWindow?.getBoundingClientRect?.();
                const worldMapContent = worldMapWindow?.querySelector(".hunt-world-map-content");
                const worldMapHeader = worldMapWindow?.querySelector(".hunt-world-map-window__header");
                const worldMapHeaderRect = worldMapHeader?.getBoundingClientRect?.();
                const worldMapLayout = worldMapWindow?.querySelector(".hunt-world-map-layout");
                const worldMapDetail = worldMapWindow?.querySelector(".hunt-world-map-detail");
                const worldMapStart = worldMapWindow?.querySelector(
                    "[data-world-hunt-start], [data-world-hunt-creature-start]"
                );
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
                const startHitStack = startRect
                    ? document.elementsFromPoint(
                        startRect.left + startRect.width / 2,
                        startRect.top + startRect.height / 2
                    ).slice(0, 6).map((element) => element.id || element.className || element.tagName).join(" > ")
                    : "fora da tela";
                if (reportElement) reportElement.hidden = reportWasHidden;
                const mapIsBlockingOverlay = Boolean(worldMapWindow)
                    && Aethra.WindowManager?.isOverlayWindow?.("hunt-world-map-view") === true
                    && getComputedStyle(document.getElementById("modal-layer")).pointerEvents === "auto"
                    && Number(getComputedStyle(document.getElementById("modal-layer")).zIndex || 0)
                        > Number(getComputedStyle(document.getElementById("hud-layer")).zIndex || 0)
                    && Number(worldMapRect?.left || 0) <= 1
                    && Number(worldMapRect?.top || 0) <= 1
                    && Math.abs(Number(worldMapRect?.width || 0) - window.innerWidth) <= 1
                    && Math.abs(Number(worldMapRect?.height || 0) - window.innerHeight) <= 1
                    && Number(worldMapHeaderRect?.left ?? -1) >= 0
                    && Number(worldMapHeaderRect?.top ?? -1) >= 0
                    && Number(worldMapHeaderRect?.right ?? Infinity) <= window.innerWidth + 1;
                const startIsReachable = Boolean(worldMapStart)
                    && Number(startRect?.top || -1) >= 0
                    && Number(startRect?.bottom || Infinity) <= window.innerHeight
                    && (startHitTarget === worldMapStart || worldMapStart.contains(startHitTarget));
                checks.push(
                    createCheck(
                        "Mapa Mundi bloqueia o fundo e mantém Entrar na expedição clicável",
                        mapIsBlockingOverlay && startIsReachable,
                        `viewport ${window.innerWidth}×${window.innerHeight} · overlay ${Math.round(worldMapRect?.left || 0)},${Math.round(worldMapRect?.top || 0)} ${Math.round(worldMapRect?.width || 0)}×${Math.round(worldMapRect?.height || 0)} pad ${worldMapWindow ? getComputedStyle(worldMapWindow).padding : "ausente"} eventos ${worldMapWindow ? getComputedStyle(worldMapWindow).pointerEvents : "ausente"}/${worldMapDetail ? getComputedStyle(worldMapDetail).pointerEvents : "ausente"}/${worldMapStart ? getComputedStyle(worldMapStart).pointerEvents : "ausente"} z ${worldMapWindow ? getComputedStyle(worldMapWindow).zIndex : "ausente"} · conteúdo ${Math.round(worldMapContent?.getBoundingClientRect?.().height || 0)} · layout ${Math.round(worldMapLayout?.getBoundingClientRect?.().height || 0)} · detalhe ${worldMapDetail?.clientHeight || 0}/${worldMapDetail?.scrollHeight || 0}@${Math.round(worldMapDetail?.scrollTop || 0)} · botão ${Math.round(startRect?.top || 0)}–${Math.round(startRect?.bottom || 0)} ${startIsReachable ? "alcançável" : `obstruído por ${startHitTarget?.className || startHitTarget?.tagName || "fora da tela"}`} · pilha ${startHitStack}`
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

                const responsiveAuditPreviousPrimaryView = Aethra.UIManager?.primaryView
                    || Aethra.GameState.ui?.primaryView
                    || "hunt";
                Aethra.UIManager?.setPrimaryView?.("hunt", {
                    emit: false,
                    source: "integration-responsive-audit"
                });
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
                    && Number(responsivePanelRects[0]?.top || 0)
                        < Number(responsivePanelRects[1]?.top || 0)
                    && Number(responsivePanelRects[1]?.top || 0)
                        < Number(responsivePanelRects[2]?.top || 0)
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
                const compactHeroRect = responsiveHeroColumn?.getBoundingClientRect?.();
                const compactHeroAlignsBelowNav = !narrowViewport
                    || Math.abs(
                        Number(compactHeroRect?.top || 0)
                            - Number(responsiveLayoutRect?.top || 0)
                    ) <= 4;
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
                            && compactHeroAlignsBelowNav
                            && compactCombatButton?.getAttribute("aria-pressed") === "true"
                            && (narrowViewport
                                ? compactNavDisplay === "grid"
                                : compactNavDisplay === "none"),
                        `${compactHuntButtons.length}/3 atalhos · painel ${compactHuntNav?.dataset.activePanel || "ausente"} · display ${compactNavDisplay}`
                    )
                );

                Aethra.UIManager?.setPrimaryView?.(responsiveAuditPreviousPrimaryView, {
                    emit: false,
                    source: "integration-responsive-audit-restore"
                });

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
                const tileMapSnapshot = Aethra.TileMapCanvas?.getSnapshot?.() || {};
                checks.push(
                    createCheck(
                        "Mapa 2D não possui economia ou combate paralelo",
                        Number(Aethra.GameState.hero?.gold || 0) === visualGoldBefore
                            && Number(Aethra.GameState.hero?.xpTotal || 0) === visualXpBefore,
                        `Gold ${visualGoldBefore} · XP ${visualXpBefore}, sem mutação visual`
                    )
                );
                checks.push(
                    createCheck(
                        "Mapa 2D usa projeção oficial e terreno procedural",
                        tileMapSnapshot.source === "CombatProjection"
                            && document.querySelectorAll('#tilemap-canvas-root img[src*="FieldsTile"]').length === 0,
                        `${tileMapSnapshot.source || "fonte ausente"} · sem tiles laranja legados`
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

                const sharedSaveSnapshot = Aethra.SaveManager?.getSharedStatus?.();
                checks.push(
                    createCheck(
                        "Save compartilhado mantém o SaveManager como autoridade única",
                        Boolean(sharedSaveSnapshot)
                            && sharedSaveSnapshot.profile === "principal"
                            && typeof Aethra.SaveManager?.publishShared === "function"
                            && typeof Aethra.SaveManager?.pullShared === "function",
                        sharedSaveSnapshot
                            ? `${sharedSaveSnapshot.supported ? "servidor compartilhado" : "fallback local"} · perfil ${sharedSaveSnapshot.profile}`
                            : "contrato compartilhado ausente"
                    )
                );

                const sharedSaveIndicator = document.querySelector(
                    "[data-shared-save-indicator]"
                );
                checks.push(
                    createCheck(
                        "HUD informa se o progresso é local ou compartilhado",
                        Boolean(Aethra.SharedSaveStatus)
                            && Boolean(sharedSaveIndicator)
                            && Boolean(sharedSaveIndicator.querySelector("[data-shared-save-label]")),
                        sharedSaveIndicator?.textContent?.trim().replace(/\s+/g, " ") || "indicador ausente"
                    )
                );

                console.log("✅ SaveManager validado.");

                /*
                 * Regressão: o SaveManager carrega antes de BattleSystem e
                 * HuntSystem registrarem o listener de save:loaded. Um save
                 * gravado no meio de uma luta voltava com isFighting=true e sem
                 * timer — combate congelado para sempre, e o Analyzer dizendo
                 * "Nenhuma hunt ativa" com a caça marcada como ativa. Ambos os
                 * sistemas agora encerram sessões interrompidas no init.
                 * Fica no fim da suíte porque encerra qualquer luta em curso.
                 */
                Aethra.GameState.battle.isFighting = true;
                Aethra.GameState.battle.creature = { id: "giant_rat", name: "Rato Gigante", hp: 3 };
                Aethra.BattleSystem.isFighting = true;
                Aethra.GameState.hunt.isActive = true;
                Aethra.GameState.hunt.currentEnemy = { id: "giant_rat" };
                const battleAfterReset = Aethra.BattleSystem.resetInterruptedBattle?.();
                const huntAfterReset = Aethra.HuntSystem.resetInterruptedHunt?.();
                checks.push(
                    createCheck(
                        "Luta e caça salvas no meio da sessão não voltam congeladas",
                        Boolean(battleAfterReset && huntAfterReset)
                            && Aethra.BattleSystem.isFighting === false
                            && Aethra.GameState.battle.isFighting === false
                            && Aethra.GameState.battle.creature === null
                            && Aethra.BattleSystem.timerId === null
                            && Aethra.GameState.hunt.isActive === false
                            && Aethra.GameState.hunt.currentEnemy === null
                            && Aethra.HuntSystem.config.isRunning === false,
                        `luta ${Aethra.BattleSystem.isFighting ? "ativa" : "encerrada"} · caça ${Aethra.GameState.hunt.isActive ? "ativa" : "encerrada"}`
                    )
                );

                /*
                 * UI 3.0 — fundação. A galeria é renderizada dentro desta página,
                 * com todo o CSS clássico carregado: se os tokens vencem aqui sem
                 * !important, o isolamento em #ui3-root está funcionando.
                 */
                const ui3Kit = Aethra.Ui3Kit;
                const escapedSlot = ui3Kit?.slot?.({ label: "<img src=x onerror=alert(1)>", glyph: "<b>" }) || "";
                checks.push(
                    createCheck(
                        "UI 3.0 escapa todo texto recebido pelos componentes",
                        Boolean(ui3Kit)
                            && !escapedSlot.includes("<img src=x")
                            && escapedSlot.includes("&lt;img src=x")
                            && !escapedSlot.includes("<b>"),
                        ui3Kit ? "rótulos e glifos escapados" : "Ui3Kit ausente"
                    )
                );

                const settings = Aethra.SettingsManager;
                const interfaceBefore = settings?.getInterfaceVersion?.();
                const interfaceEvents = [];
                const stopInterfaceListener = Aethra.EventBus.on("settings:interface-changed", (payload) => interfaceEvents.push(payload?.interfaceVersion));
                const invalidInterface = settings?.setInterfaceVersion?.("v99", { source: "integration" });
                const toV3 = settings?.setInterfaceVersion?.("v3", { source: "integration" });
                const bodyMarkedV3 = document.body.classList.contains("ui3-active");
                settings?.setInterfaceVersion?.(interfaceBefore || "classic", { source: "integration-restore" });
                if (typeof stopInterfaceListener === "function") stopInterfaceListener();
                checks.push(
                    createCheck(
                        "Preferência de interface valida versões e avisa a UI 3.0",
                        interfaceBefore === "classic"
                            && invalidInterface === false
                            && toV3 === "v3"
                            && bodyMarkedV3
                            && interfaceEvents.includes("v3")
                            && settings.getInterfaceVersion() === "classic"
                            && !document.body.classList.contains("ui3-active"),
                        `padrão ${interfaceBefore} · inválida ${invalidInterface === false ? "recusada" : "aceita"} · v3 ${bodyMarkedV3 ? "aplicada" : "ignorada"}`
                    )
                );

                /*
                 * UI 3.0 é o padrão do produto. Um "classic" gravado sem escolha
                 * (as preferências eram salvas no carregamento) migra; quem
                 * escolheu a clássica continua nela.
                 */
                const resolveInterface = settings?.resolveInterfaceVersion;
                const migratesUnchosen = resolveInterface?.({ interfaceVersion: "classic" }, "v3") === "v3";
                const keepsChosen = resolveInterface?.({ interfaceVersion: "classic", interfaceVersionChosen: true }, "v3") === "classic";
                const emptyGetsDefault = resolveInterface?.({}, "v3") === "v3";
                checks.push(
                    createCheck(
                        "UI 3.0 é o padrão e a clássica só fica para quem a escolheu",
                        settings?.getDefaultInterfaceVersion?.() === "v3"
                            && migratesUnchosen
                            && keepsChosen
                            && emptyGetsDefault
                            && settings.get("interfaceVersionChosen") === true,
                        `padrão ${settings?.getDefaultInterfaceVersion?.()} · sem escolha ${migratesUnchosen ? "migra" : "fica"} · escolhida ${keepsChosen ? "respeitada" : "ignorada"}`
                    )
                );

                const galleryShown = Aethra.Ui3Shell?.showGallery?.();
                const ui3Root = document.getElementById("ui3-root");
                const gallery = ui3Root?.querySelector("[data-ui3-gallery]");
                const galleryTexts = gallery
                    ? [...gallery.querySelectorAll("*")].filter((element) => [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim()))
                    : [];
                const smallestGalleryFont = galleryTexts.length
                    ? Math.min(...galleryTexts.map((element) => parseFloat(getComputedStyle(element).fontSize)))
                    : 0;
                const primaryButton = gallery?.querySelector(".ui3-btn--primary");
                const primaryBackground = primaryButton ? getComputedStyle(primaryButton).backgroundColor : "";
                const rootDisplay = ui3Root ? getComputedStyle(ui3Root).display : "none";
                Aethra.Ui3Shell?.hideGallery?.();
                checks.push(
                    createCheck(
                        "UI 3.0 renderiza isolada do CSS clássico, sem texto abaixo de 11px",
                        galleryShown === true
                            && rootDisplay !== "none"
                            && galleryTexts.length >= 20
                            && smallestGalleryFont >= 11
                            && primaryBackground === "rgb(216, 178, 92)"
                            && ui3Root.hidden === true
                            && !ui3Root.querySelector("[data-ui3-gallery]"),
                        `${galleryTexts.length} textos · menor ${smallestGalleryFont}px · botão ${primaryBackground || "ausente"}`
                    )
                );

                /*
                 * UI 3.0 — fase 2 (Hunt). O mapa é emprestado pelo TileMapCanvas:
                 * continua existindo um único canvas, que vai para o palco novo e
                 * volta ao clássico. O HUD novo lê o mesmo estado do clássico.
                 */
                const huntViewBefore = Aethra.UIManager?.primaryView || Aethra.GameState.ui?.primaryView || "hunt";
                const createdBefore = Aethra.GameState.hero.characterCreated;
                const speedBefore = settings?.getCombatSpeed?.() || 1;
                Aethra.GameState.hero.characterCreated = true;
                settings?.setInterfaceVersion?.("v3", { source: "integration-ui3-hunt" });
                Aethra.UIManager?.setPrimaryView?.("hunt", { source: "integration-ui3-hunt" });
                Aethra.Ui3TopBar?.sync?.();
                Aethra.Ui3HuntScreen?.sync?.();

                const huntScreen = document.querySelector("#ui3-root [data-ui3-screen='hunt']");
                const stageCanvas = document.querySelectorAll("#tilemap-canvas");
                const hostedCanvas = stageCanvas.length === 1 && Boolean(stageCanvas[0].closest(".ui3-hunt__stage"));
                const heroHpBar = huntScreen?.querySelector(".ui3-hunt__hero .ui3-bar--hp");
                const hudHp = Number(heroHpBar?.getAttribute("aria-valuenow"));
                const hudHpMax = Number(heroHpBar?.getAttribute("aria-valuemax"));
                const stateHp = Number(Aethra.GameState.hero.hp);
                const stateHpMax = Number(Aethra.GameState.hero.maxHp);
                const actionSlots = huntScreen?.querySelectorAll(".ui3-hunt__actions .ui3-slot").length || 0;
                const worldLayer = document.getElementById("world-layer");
                const worldCovered = !worldLayer || worldLayer.inert === true;
                huntScreen?.querySelector("[data-ui3-speed='2']")?.click();
                const speedFromHud = settings?.getCombatSpeed?.();
                settings?.setCombatSpeed?.(speedBefore, { source: "integration-restore" });
                const skillWithoutBattle = Aethra.GameState.battle?.isFighting
                    ? { reason: "no-battle" }
                    : Aethra.SkillController?.requestManualSkill?.("heal");

                checks.push(
                    createCheck(
                        "UI 3.0 Hunt usa o mapa como palco, sem duplicar o canvas",
                        Aethra.Ui3HuntScreen?.isVisible?.() === true
                            && Aethra.Ui3TopBar?.isVisible?.() === true
                            && hostedCanvas
                            && Aethra.TileMapCanvas?.isHosted?.() === true
                            && worldCovered,
                        `${stageCanvas.length} canvas · ${hostedCanvas ? "no palco novo" : "fora do palco"} · camada clássica ${worldCovered ? "inerte" : "ativa"}`
                    )
                );
                checks.push(
                    createCheck(
                        "UI 3.0 Hunt mostra o mesmo HP do estado oficial e a barra completa",
                        hudHp === stateHp && hudHpMax === stateHpMax && actionSlots === 12,
                        `HUD ${hudHp}/${hudHpMax} · estado ${stateHp}/${stateHpMax} · ${actionSlots} slots`
                    )
                );
                checks.push(
                    createCheck(
                        "UI 3.0 Hunt comanda pelos donos: velocidade e habilidade validada",
                        speedFromHud === 2
                            && settings.getCombatSpeed() === speedBefore
                            && skillWithoutBattle?.ok === false
                            && skillWithoutBattle?.reason === "no-battle",
                        `velocidade ${speedFromHud}× · habilidade fora de combate: ${skillWithoutBattle?.reason || "aceita"}`
                    )
                );

                Aethra.UIManager?.setPrimaryView?.("city", { source: "integration-ui3-hunt" });
                const cityReleasesCanvas = Aethra.Ui3HuntScreen?.isVisible?.() === false
                    && Aethra.TileMapCanvas?.isHosted?.() === false
                    && document.querySelectorAll("#tilemap-canvas").length <= 1
                    // A Cidade nova (fase 4) cobre a clássica: a camada continua inerte.
                    && Aethra.Ui3CityScreen?.isVisible?.() === true
                    && (!worldLayer || worldLayer.inert === true);
                settings?.setInterfaceVersion?.(interfaceBefore || "classic", { source: "integration-restore" });
                Aethra.UIManager?.setPrimaryView?.(huntViewBefore, { source: "integration-restore" });
                Aethra.GameState.hero.characterCreated = createdBefore;
                const classicRestored = document.getElementById("ui3-root")?.hidden === true
                    && ![...document.querySelectorAll("#world-layer, #hud-layer, #hud-layer > .topbar")].some((element) => element.inert)
                    && Aethra.TileMapCanvas?.isHosted?.() === false;
                /*
                 * UI 3.0 — fase 3 (Mochila). A janela nova assume "inventory-view"
                 * pelo WindowManager: os mesmos chamadores abrem a versão certa,
                 * e equipar passa pelo EquipSystem.
                 */
                Aethra.GameState.hero.characterCreated = true;
                settings?.setInterfaceVersion?.("v3", { source: "integration-ui3-bag" });
                const windowManager = Aethra.WindowManager;
                windowManager?.openWindow?.("inventory-view", { source: "integration-ui3-bag" });
                const bagLayer = document.querySelector("#ui3-root [data-ui3-window='inventory-view']");
                const legacyBag = document.getElementById("inventory-view");
                const bagOpenedNew = Aethra.Ui3BagWindow?.isOpen?.() === true
                    && windowManager.isOpen("inventory-view") === true
                    && Boolean(bagLayer && !bagLayer.hidden)
                    && (!legacyBag || legacyBag.classList.contains("hidden"));
                const bagCells = bagLayer?.querySelectorAll("[data-ui3-bag-item]").length || 0;
                const bagSize = (Aethra.GameState.hero.bag || []).filter(Boolean).length;
                const equippedNow = Aethra.EquipSystem.getEquipment();
                const equippedCount = Object.values(equippedNow).filter(Boolean).length;
                const equipHeading = bagLayer?.querySelector(".ui3-bag__equip .ui3-eyebrow")?.textContent || "";
                checks.push(
                    createCheck(
                        "UI 3.0 Mochila abre pelo WindowManager e mostra o estado oficial",
                        bagOpenedNew && bagCells === bagSize && equipHeading.includes(`${equippedCount} de 11`),
                        `${bagOpenedNew ? "janela nova" : "janela errada"} · ${bagCells}/${bagSize} itens · "${equipHeading}"`
                    )
                );

                const equipCandidate = (Aethra.GameState.hero.bag || []).find((item) => item?.instanceId
                    && Aethra.EquipSystem.validateEquip(item)?.allowed === true);
                let bagEquipWorks = false;
                let bagEquipDetail = "nenhum item equipável na mochila de teste";
                if (equipCandidate) {
                    const targetSlot = Aethra.EquipSystem.validateEquip(equipCandidate).slot;
                    const previousInSlot = equippedNow[targetSlot]?.instanceId || null;
                    bagLayer?.querySelector(`[data-ui3-bag-item="${equipCandidate.instanceId}"]`)?.click();
                    bagLayer?.querySelector("[data-ui3-equip]")?.click();
                    const equippedAfter = Aethra.EquipSystem.getEquipment()[targetSlot]?.instanceId;
                    bagEquipWorks = equippedAfter === equipCandidate.instanceId
                        && Boolean(bagLayer?.querySelector(`[data-ui3-equip-slot="${targetSlot}"][aria-pressed="true"]`));
                    if (previousInSlot) Aethra.EquipSystem.equip(previousInSlot, targetSlot);
                    else Aethra.EquipSystem.unequip(targetSlot);
                    bagEquipDetail = `${equipCandidate.name} → ${targetSlot} · restaurado ${Aethra.EquipSystem.getEquipment()[targetSlot]?.instanceId === previousInSlot || (!previousInSlot && !Aethra.EquipSystem.getEquipment()[targetSlot]) ? "sim" : "não"}`;
                }
                checks.push(
                    createCheck(
                        "UI 3.0 Mochila equipa pelo EquipSystem",
                        bagEquipWorks,
                        bagEquipDetail
                    )
                );

                document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
                const escClosed = Aethra.Ui3BagWindow?.isOpen?.() === false
                    && !windowManager.activeWindows.includes("inventory-view");
                settings?.setInterfaceVersion?.("classic", { source: "integration-ui3-bag" });
                windowManager.openWindow("inventory-view", { source: "integration-ui3-bag" });
                const classicBagOpens = Boolean(legacyBag && !legacyBag.classList.contains("hidden"))
                    && Aethra.Ui3BagWindow?.isOpen?.() === false;
                windowManager.closeWindow("inventory-view", { source: "integration-restore" });
                checks.push(
                    createCheck(
                        "UI 3.0 Mochila fecha com Esc e a clássica volta na interface clássica",
                        escClosed && classicBagOpens,
                        `Esc ${escClosed ? "fechou" : "não fechou"} · clássica ${classicBagOpens ? "abriu" : "não abriu"}`
                    )
                );
                /*
                 * UI 3.0 — fase 3 (Loja). Compra e venda passam pelo
                 * MarketplaceSystem; o preço mostrado é o da cotação do dono.
                 */
                settings?.setInterfaceVersion?.("v3", { source: "integration-ui3-shop" });
                const shopGoldOriginal = Aethra.GameState.hero.gold;
                const shopBagOriginal = [...(Aethra.GameState.hero.bag || [])];
                Aethra.GameState.hero.bag = shopBagOriginal.filter((item) => (item.templateId || item.id) !== "potion_health");
                Aethra.GameState.hero.gold = Math.max(500, Number(shopGoldOriginal) || 0);
                windowManager.openWindow("npc-shop-view", { source: "integration-ui3-shop" });
                const shopLayer = document.querySelector("#ui3-root [data-ui3-window='npc-shop-view']");
                const shopRows = shopLayer?.querySelectorAll("[data-ui3-shop-buy]").length || 0;
                const catalogSize = Aethra.MarketplaceSystem.getNpcCatalog(Aethra.GameState.hero.level).length;
                const shopGoldBeforeBuy = Number(Aethra.GameState.hero.gold);
                shopLayer?.querySelector("[data-ui3-shop-buy='potion_health']")?.click();
                shopLayer?.querySelector("[data-ui3-shop-quantity='5']")?.click();
                const buyLabel = shopLayer?.querySelector("[data-ui3-shop-confirm-buy]")?.textContent || "";
                shopLayer?.querySelector("[data-ui3-shop-confirm-buy]")?.click();
                const potionPrice = Number(Aethra.GameData.items.potion_health?.price || 0);
                const boughtPotions = Aethra.BagSystem.countItem("potion_health");
                const goldAfterBuy = Number(Aethra.GameState.hero.gold);
                checks.push(
                    createCheck(
                        "UI 3.0 Loja lista o catálogo do dono e compra em quantidade",
                        Aethra.Ui3ShopWindow?.isOpen?.() === true
                            && shopRows === catalogSize
                            && buyLabel.includes(`${potionPrice * 5}`)
                            && boughtPotions === 5
                            && goldAfterBuy === shopGoldBeforeBuy - potionPrice * 5,
                        `${shopRows}/${catalogSize} itens · botão "${buyLabel}" · ${boughtPotions} poções · ouro ${shopGoldBeforeBuy}→${goldAfterBuy}`
                    )
                );

                shopLayer?.querySelector("[data-ui3-tab='sell']")?.click();
                const boughtStack = (Aethra.GameState.hero.bag || []).find((item) => (item.templateId || item.id) === "potion_health");
                const stackQuote = boughtStack ? Aethra.MarketplaceSystem.getSaleQuote(boughtStack) : null;
                const sellRowShown = boughtStack
                    ? shopLayer?.querySelector(`[data-ui3-shop-sell="${boughtStack.instanceId}"]`)
                    : null;
                const rowPrice = sellRowShown?.querySelector(".ui3-price")?.textContent || "";
                sellRowShown?.click();
                shopLayer?.querySelector("[data-ui3-shop-confirm-sell]")?.click();
                const goldAfterSell = Number(Aethra.GameState.hero.gold);
                checks.push(
                    createCheck(
                        "UI 3.0 Loja vende pelo preço da cotação",
                        Boolean(sellRowShown)
                            && stackQuote?.mode === "sellback"
                            && rowPrice.includes(`${stackQuote.salePrice}`)
                            && goldAfterSell === goldAfterBuy + stackQuote.salePrice
                            && Aethra.BagSystem.countItem("potion_health") === 0,
                        `linha ${sellRowShown ? rowPrice.trim() : "ausente"} · cotação ${stackQuote?.mode || "?"} ${stackQuote?.salePrice ?? "?"} · ouro ${goldAfterBuy}→${goldAfterSell}`
                    )
                );
                windowManager.closeWindow("npc-shop-view", { source: "integration-restore" });
                Aethra.GameState.hero.bag = shopBagOriginal;
                Aethra.GameState.hero.gold = shopGoldOriginal;

                /*
                 * UI 3.0 — fase 3 (Habilidades). A barra é montada pelo
                 * SkillSystem.placeSkill (uma habilidade nunca fica duplicada
                 * na barra) e a automação pelo SkillController.
                 */
                windowManager.openWindow("skills-view", { source: "integration-ui3-skills" });
                const skillsLayer = document.querySelector("#ui3-root [data-ui3-window='skills-view']");
                const journalRows = skillsLayer?.querySelectorAll("[data-ui3-skill-entry]").length || 0;
                const journalSize = Aethra.ProgressionJournalUI?.getViewModel?.().entries.length || 0;
                skillsLayer?.querySelector("[data-ui3-tab='actionbar']")?.click();
                const originalSlots = [...(Aethra.SkillSystem.getActiveBar()?.slots || [])];
                const placedSkillId = originalSlots.find(Boolean)
                    || Object.values(Aethra.SkillSystem.getSkills()).find((skill) => skill && !skill.primarySlot && skill.category !== "primary")?.id;
                const emptyIndex = originalSlots.findIndex((skillId) => !skillId);
                const targetIndex = emptyIndex >= 0 ? emptyIndex : originalSlots.length - 1;
                skillsLayer?.querySelector(`[data-ui3-loadout-slot="${targetIndex}"]`)?.click();
                skillsLayer?.querySelector(`[data-ui3-library-skill="${placedSkillId}"]`)?.click();
                const slotsAfterPlace = Aethra.SkillSystem.getActiveBar()?.slots || [];
                const placedOnce = slotsAfterPlace[targetIndex] === placedSkillId
                    && slotsAfterPlace.filter((skillId) => skillId === placedSkillId).length === 1;
                originalSlots.forEach((skillId, index) => Aethra.SkillSystem.assignSkill(index, skillId || null));
                const barRestored = JSON.stringify(Aethra.SkillSystem.getActiveBar()?.slots || []) === JSON.stringify(originalSlots);

                const ruleEntry = (Aethra.SkillController.getSnapshot().orderedSkills || [])[0] || null;
                let autoToggles = false;
                if (ruleEntry) {
                    const autoBefore = Aethra.SkillController.getSettings()[ruleEntry.skillId]?.auto === true;
                    skillsLayer?.querySelector(`[data-ui3-rule-auto="${ruleEntry.skillId}"]`)?.click();
                    const autoAfter = Aethra.SkillController.getSettings()[ruleEntry.skillId]?.auto === true;
                    Aethra.SkillController.setAuto(ruleEntry.skillId, autoBefore);
                    autoToggles = autoAfter !== autoBefore;
                }
                checks.push(
                    createCheck(
                        "UI 3.0 Habilidades mostra as maestrias e monta a barra sem duplicar",
                        Aethra.Ui3SkillsWindow?.isOpen?.() === true
                            && journalRows === journalSize
                            && journalSize > 0
                            && placedOnce
                            && barRestored,
                        `${journalRows}/${journalSize} maestrias · ${placedSkillId} → tecla ${targetIndex + 1} ${placedOnce ? "sem duplicar" : "duplicada ou ausente"} · barra ${barRestored ? "restaurada" : "alterada"}`
                    )
                );
                checks.push(
                    createCheck(
                        "UI 3.0 Habilidades liga e desliga a automação pelo SkillController",
                        Boolean(ruleEntry) && autoToggles,
                        ruleEntry ? `${ruleEntry.skillId}: ${autoToggles ? "alternou" : "não alternou"}` : "barra de teste sem regras"
                    )
                );
                windowManager.closeWindow("skills-view", { source: "integration-restore" });

                /*
                 * UI 3.0 — fase 5.2 (Oficinas). ProfessionWorkshopUI.open continua
                 * a porta de entrada; a janela nova produz pelo CraftingSystem.
                 */
                const workshopViewBefore = Aethra.UIManager?.primaryView || "hunt";
                const workshopBagBefore = [...(Aethra.GameState.hero.bag || [])];
                if (Aethra.GameState.hunt?.isActive) Aethra.HuntSystem.stopHunt("integration-ui3-workshop");
                Aethra.UIManager?.setPrimaryView?.("city", { source: "integration-ui3-workshop" });
                Aethra.ProfessionWorkshopUI?.open?.("blacksmithing");
                const workshopLayer = document.querySelector("#ui3-root [data-ui3-window='profession-workshop-view']");
                const firstRecipe = (Aethra.CraftingSystem.getRecipes("blacksmithing") || [])[0] || null;
                let workshopCrafts = false;
                let workshopDetail = "nenhuma receita conhecida";
                if (firstRecipe) {
                    Aethra.CraftingSystem.resolveRequirements(firstRecipe, "balanced", 1).inputs.forEach((input) => {
                        const material = Aethra.ItemSystem?.generateItem?.(input.itemId, { quantity: input.quantity, source: "integration-workshop" });
                        if (material) Aethra.BagSystem.addItems([material], "integration-workshop");
                    });
                    Aethra.Ui3WorkshopWindow?.refresh?.();
                    const outputId = firstRecipe.outputs?.[0]?.itemId;
                    const outputBefore = Aethra.BagSystem.countItem(outputId);
                    workshopLayer?.querySelector(`[data-ui3-craft="${firstRecipe.id}"]`)?.click();
                    const outputAfter = Aethra.BagSystem.countItem(outputId);
                    workshopCrafts = outputAfter > outputBefore;
                    workshopDetail = `${firstRecipe.name}: ${outputBefore}→${outputAfter} ${outputId}`;
                }
                const workshopShown = Aethra.Ui3WorkshopWindow?.isOpen?.() === true
                    && document.getElementById("profession-workshop-view")?.classList.contains("hidden") !== false
                    && (workshopLayer?.querySelector(".ui3-dialog__subtitle")?.textContent || "").includes("Forja");
                windowManager.closeWindow("profession-workshop-view", { source: "integration-restore" });
                Aethra.GameState.hero.bag = workshopBagBefore;
                Aethra.UIManager?.setPrimaryView?.(workshopViewBefore, { source: "integration-restore" });
                checks.push(
                    createCheck(
                        "UI 3.0 Oficina abre na estação da Cidade e produz pelo CraftingSystem",
                        workshopShown && workshopCrafts,
                        `${workshopShown ? "janela nova na Forja" : "janela errada"} · ${workshopDetail}`
                    )
                );

                /*
                 * UI 3.0 — fase 5.2 (Opções): velocidade, animações e interface
                 * pelo SettingsManager; apagar o save só depois de confirmar.
                 */
                const optionsSpeedBefore = settings.getCombatSpeed();
                const optionsHudBefore = { ...(settings.get("hud", {}) || {}) };
                const optionsResetOriginal = Aethra.SaveManager.reset;
                let optionsResetCalls = 0;
                Aethra.SaveManager.reset = () => {
                    optionsResetCalls += 1;
                    return false;
                };
                let optionsWorks = false;
                let optionsDetail = "";
                try {
                    windowManager.openWindow("options-view", { source: "integration-ui3-options" });
                    const optionsLayer = document.querySelector("#ui3-root [data-ui3-window='options-view']");
                    const optionsOpen = Aethra.Ui3OptionsWindow?.isOpen?.() === true;
                    optionsLayer?.querySelector("[data-ui3-option-speed='4']")?.click();
                    const speedSet = settings.getCombatSpeed() === 4;
                    const motionBefore = settings.get("hud", {})?.reduceMotion === true;
                    optionsLayer?.querySelector("[data-ui3-option-motion]")?.click();
                    const motionToggled = (settings.get("hud", {})?.reduceMotion === true) !== motionBefore
                        && document.getElementById("ui3-root").classList.contains("ui3-reduce-motion") === !motionBefore;
                    optionsLayer?.querySelector("[data-ui3-option-reset]")?.click();
                    const resetAsked = optionsResetCalls === 0 && Boolean(optionsLayer?.querySelector("[data-ui3-option-reset-confirm]"));
                    optionsLayer?.querySelector("[data-ui3-option-reset-cancel]")?.click();
                    const resetCancelled = optionsResetCalls === 0 && Boolean(optionsLayer?.querySelector("[data-ui3-option-reset]"));
                    optionsLayer?.querySelector("[data-ui3-option-interface='classic']")?.click();
                    const switchedToClassic = settings.getInterfaceVersion() === "classic"
                        && Aethra.Ui3OptionsWindow?.isOpen?.() === false;
                    optionsWorks = optionsOpen && speedSet && motionToggled && resetAsked && resetCancelled && switchedToClassic;
                    optionsDetail = `${optionsOpen ? "abriu" : "não abriu"} · velocidade ${speedSet ? "4×" : "inalterada"} · animações ${motionToggled ? "alternadas" : "iguais"} · apagar ${resetAsked && resetCancelled ? "pediu confirmação" : "sem confirmação"} · interface ${switchedToClassic ? "trocou" : "não trocou"}`;
                } finally {
                    Aethra.SaveManager.reset = optionsResetOriginal;
                    settings.setCombatSpeed(optionsSpeedBefore, { source: "integration-restore" });
                    settings.set("hud", optionsHudBefore, { source: "integration-restore" });
                    settings.setInterfaceVersion("v3", { source: "integration-restore" });
                }
                checks.push(createCheck("UI 3.0 Opções mudam preferências pelo dono e só apagam com confirmação", optionsWorks, optionsDetail));

                // UI 3.0 — fase 5.2 (Mural de Chefes): requisitos e recompensa vêm do BossSystem.
                Aethra.RenderEngine?.openBossesHall?.({ source: "integration-ui3-bosses" });
                const bossesLayer = document.querySelector("#ui3-root [data-ui3-window='bosses-view']");
                const bossIds = Object.keys(Aethra.BossSystem?.bosses || {});
                const bossButtons = [...(bossesLayer?.querySelectorAll("[data-ui3-boss-challenge]") || [])];
                const buttonsMatchRules = bossButtons.length === bossIds.length
                    && bossButtons.every((button) => {
                        const status = Aethra.BossSystem.getRequirementStatus(button.dataset.ui3BossChallenge);
                        return button.disabled === !status.allowed;
                    });
                const weeklySnapshot = Aethra.BossSystem?.getWeeklySnapshot?.();
                const claimButton = bossesLayer?.querySelector("[data-ui3-boss-claim]");
                const claimMatchesRule = Boolean(claimButton) && claimButton.disabled === !weeklySnapshot?.canClaim;
                const bossesOpen = Aethra.Ui3BossesWindow?.isOpen?.() === true;
                windowManager.closeWindow("bosses-view", { source: "integration-restore" });
                checks.push(
                    createCheck(
                        "UI 3.0 Mural de Chefes segue os requisitos e a recompensa semanal do BossSystem",
                        bossesOpen && bossIds.length > 0 && buttonsMatchRules && claimMatchesRule,
                        `${bossesOpen ? "janela nova" : "janela errada"} · ${bossButtons.length}/${bossIds.length} chefes · botões ${buttonsMatchRules ? "coerentes" : "incoerentes"} · semanal ${claimMatchesRule ? "coerente" : "incoerente"}`
                    )
                );

                /*
                 * UI 3.0 — fase 5.2 (Especialização). A escolha é permanente:
                 * o primeiro clique só pede confirmação; o segundo vai ao
                 * ProfessionSystem. Estado e comando ficam espionados e restaurados.
                 */
                const professionSystem = Aethra.ProfessionSystem;
                const specStateOriginal = professionSystem.getSpecializationState;
                const specChooseOriginal = professionSystem.chooseSpecialization;
                const specProfessionId = Object.keys(professionSystem.specializationTrees || {})[1] || "mining";
                const specTree = professionSystem.getSpecializationTree(specProfessionId);
                const specChoices = [];
                professionSystem.getSpecializationState = (id) => {
                    const real = specStateOriginal.call(professionSystem, id);
                    return { ...real, level: Math.max(real.level, real.unlockLevel), branchId: null, branch: null };
                };
                professionSystem.chooseSpecialization = (...args) => {
                    specChoices.push(args);
                    return { accepted: false, reason: "insufficient-level", requiredLevel: 99 };
                };
                let specWorks = false;
                let specDetail = "";
                try {
                    Aethra.ProfessionSpecializationUI.open(specProfessionId);
                    const specLayer = document.querySelector("#ui3-root [data-ui3-window='profession-specialization-view']");
                    const specOpen = Aethra.Ui3SpecializationWindow?.isOpen?.() === true;
                    const specSelected = specLayer?.querySelector(`[data-ui3-tab='${specProfessionId}']`)?.getAttribute("aria-selected") === "true";
                    const firstBranchId = specTree?.branches?.[0]?.id;
                    specLayer?.querySelector(`[data-ui3-branch='${firstBranchId}']`)?.click();
                    const specAsked = specChoices.length === 0 && Boolean(specLayer?.querySelector(`[data-ui3-branch-confirm='${firstBranchId}']`));
                    specLayer?.querySelector("[data-ui3-branch-cancel]")?.click();
                    const specCancelled = specChoices.length === 0 && !specLayer?.querySelector("[data-ui3-branch-confirm]");
                    specLayer?.querySelector(`[data-ui3-branch='${firstBranchId}']`)?.click();
                    specLayer?.querySelector("[data-ui3-branch-confirm]")?.click();
                    const specDelegated = specChoices.length === 1
                        && specChoices[0][0] === specProfessionId
                        && specChoices[0][1] === firstBranchId
                        && /nível 99/i.test(specLayer?.querySelector(".ui3-notice")?.textContent || "");
                    specWorks = specOpen && specSelected && specAsked && specCancelled && specDelegated;
                    specDetail = `${specOpen ? "janela nova" : "janela errada"} · ofício ${specSelected ? "pedido" : "outro"} · escolha ${specAsked && specCancelled ? "pediu confirmação" : "sem confirmação"} · ${specDelegated ? "delegou ao ProfessionSystem" : "não delegou"}`;
                } finally {
                    professionSystem.getSpecializationState = specStateOriginal;
                    professionSystem.chooseSpecialization = specChooseOriginal;
                    windowManager.closeWindow("profession-specialization-view", { source: "integration-restore" });
                }
                checks.push(createCheck("UI 3.0 Especialização confirma a escolha permanente e delega ao ProfessionSystem", specWorks, specDetail));

                // UI 3.0 — fase 5.2 (Mentora): lê a rota do herói e só encaminha comandos.
                const mentorGuidanceOriginal = Aethra.RenderEngine.handleQuestGuidance;
                const mentorTreeOriginal = Aethra.ProfessionSpecializationUI.open;
                const mentorCalls = { guidance: [], tree: [] };
                Aethra.RenderEngine.handleQuestGuidance = (guidance) => {
                    mentorCalls.guidance.push(guidance);
                    return true;
                };
                Aethra.ProfessionSpecializationUI.open = (professionId) => {
                    mentorCalls.tree.push(professionId);
                    return true;
                };
                let mentorWorks = false;
                let mentorDetail = "";
                try {
                    Aethra.RenderEngine.openProfessionMentor();
                    const mentorLayer = document.querySelector("#ui3-root [data-ui3-window='profession-mentor-view']");
                    const mentorOpen = Aethra.Ui3MentorWindow?.isOpen?.() === true;
                    const mentorProfession = Aethra.GameState.hero?.introProfessionId;
                    const mentorPath = Aethra.ProfessionSystem.introPaths?.[mentorProfession];
                    const mentorShowsRoute = Boolean(mentorPath) && (mentorLayer?.textContent || "").includes(mentorPath.title);
                    mentorLayer?.querySelector("[data-ui3-mentor-tree]")?.click();
                    const mentorTree = mentorCalls.tree.length === 1 && mentorCalls.tree[0] === mentorProfession;
                    const trackedForMentor = Aethra.QuestSystem.getTrackedQuest?.();
                    const expectedGuidance = trackedForMentor ? Aethra.QuestSystem.getGuidance(trackedForMentor) : null;
                    const guidanceButton = mentorLayer?.querySelector("[data-ui3-mentor-guidance]");
                    guidanceButton?.click();
                    const mentorGuidance = expectedGuidance
                        ? mentorCalls.guidance.length === 1
                            && mentorCalls.guidance[0]?.questId === expectedGuidance.questId
                            && Aethra.Ui3MentorWindow?.isOpen?.() === false
                        : !guidanceButton && mentorCalls.guidance.length === 0;
                    mentorWorks = mentorOpen && mentorShowsRoute && mentorTree && mentorGuidance;
                    mentorDetail = `${mentorOpen ? "janela nova" : "janela errada"} · rota ${mentorShowsRoute ? "exibida" : "ausente"} · árvore ${mentorTree ? "encaminhada" : "não encaminhada"} · orientação ${mentorGuidance ? (expectedGuidance ? "encaminhada" : "ausente, sem botão") : "incoerente"}`;
                } finally {
                    Aethra.RenderEngine.handleQuestGuidance = mentorGuidanceOriginal;
                    Aethra.ProfessionSpecializationUI.open = mentorTreeOriginal;
                    windowManager.closeWindow("profession-mentor-view", { source: "integration-restore" });
                }
                checks.push(createCheck("UI 3.0 Mentora mostra a rota do herói e encaminha árvore e orientação", mentorWorks, mentorDetail));

                // UI 3.0 — fase 5.2 (Coliseu): lê o ColiseumSystem e só encaminha comandos.
                const coliseumSystem = Aethra.ColiseumSystem;
                const coliseumFindOriginal = coliseumSystem.findMatch;
                const coliseumStartOriginal = coliseumSystem.startMatch;
                const coliseumCalls = { find: [], start: [] };
                coliseumSystem.findMatch = (options) => {
                    coliseumCalls.find.push(options);
                    return null;
                };
                coliseumSystem.startMatch = (...args) => {
                    coliseumCalls.start.push(args);
                    return { success: false, reason: "match-active" };
                };
                let coliseumWorks = false;
                let coliseumDetail = "";
                try {
                    windowManager.openWindow("coliseum-view", { source: "integration-ui3-coliseum" });
                    const coliseumLayer = document.querySelector("#ui3-root [data-ui3-window='coliseum-view']");
                    const coliseumOpen = Aethra.Ui3ColiseumWindow?.isOpen?.() === true;
                    const coliseumSnapshot = coliseumSystem.getSnapshot();
                    const ratingShown = [...(coliseumLayer?.querySelectorAll(".ui3-kpi") || [])]
                        .some((kpi) => /rating/i.test(kpi.textContent) && kpi.querySelector(".ui3-kpi__value")?.textContent === Aethra.Ui3Kit.formatNumber(coliseumSnapshot.profile.rating));
                    coliseumLayer?.querySelector("[data-ui3-coliseum-search='ranked']")?.click();
                    const searchRouted = coliseumCalls.find.length === 1 && coliseumCalls.find[0]?.mode === "ranked"
                        && Boolean(coliseumLayer?.querySelector(".ui3-notice--error"));
                    const firstGate = coliseumSnapshot.gatekeepers[0];
                    coliseumLayer?.querySelector(`[data-ui3-coliseum-gatekeeper='${firstGate?.id}']`)?.click();
                    const gateRouted = coliseumCalls.start.length === 1
                        && coliseumCalls.start[0][0]?.id === firstGate?.id
                        && coliseumCalls.start[0][1]?.mode === "ranked"
                        && /em andamento/i.test(coliseumLayer?.querySelector(".ui3-notice")?.textContent || "");
                    coliseumLayer?.querySelector("[data-ui3-tab='ranking']")?.click();
                    const rankRows = coliseumLayer?.querySelectorAll(".ui3-rank-table__row:not(.ui3-rank-table__head)").length || 0;
                    const rankingShown = rankRows === Math.min(32, coliseumSystem.getLeaderboard(100).length) + (coliseumSnapshot.player.globalRank > 32 ? 1 : 0)
                        && Boolean(coliseumLayer?.querySelector(".ui3-rank-table__row.is-player"));
                    const candidates = coliseumSystem.getWagerCandidates({ bag: [
                        { instanceId: "a", slot: "weapon" },
                        { instanceId: "b", slot: "weapon", ownership: { bound: true } },
                        { instanceId: "c", stackable: true },
                        null
                    ] });
                    const wagerRule = candidates.length === 1 && candidates[0].instanceId === "a";
                    coliseumWorks = coliseumOpen && ratingShown && searchRouted && gateRouted && rankingShown && wagerRule;
                    coliseumDetail = `${coliseumOpen ? "janela nova" : "janela errada"} · rating ${ratingShown ? "exibido" : "ausente"} · busca ${searchRouted ? "encaminhada" : "falhou"} · guardião ${gateRouted ? "encaminhado" : "falhou"} · ranking ${rankRows} linhas · aposta ${wagerRule ? "filtrada pelo dono" : "regra errada"}`;
                } finally {
                    coliseumSystem.findMatch = coliseumFindOriginal;
                    coliseumSystem.startMatch = coliseumStartOriginal;
                    windowManager.closeWindow("coliseum-view", { source: "integration-restore" });
                }
                checks.push(createCheck("UI 3.0 Coliseu mostra perfil e ranking do ColiseumSystem e encaminha duelos", coliseumWorks, coliseumDetail));

                /*
                 * Mercado de Players: o dono decide o que pode ser anunciado
                 * (o kit inicial marca o vínculo em ownership) e quanto o
                 * vendedor recebe (taxa mínima de 1 ouro, a mesma da compra).
                 */
                const marketplace = Aethra.MarketplaceSystem;
                const marketRuleOk = marketplace.canListOnPlayerMarket({ name: "Livre" }) === true
                    && marketplace.canListOnPlayerMarket({ ownership: { bound: true } }) === false
                    && marketplace.canListOnPlayerMarket({ ownership: { tradeable: false } }) === false
                    && marketplace.canListOnPlayerMarket({ market: { premium: true } }) === false;
                const smallQuote = marketplace.getListingQuote(10);
                const largeQuote = marketplace.getListingQuote(100);
                const marketQuoteOk = smallQuote.tax === 1 && smallQuote.sellerNet === 9
                    && largeQuote.tax === 5 && largeQuote.sellerNet === 95;
                checks.push(
                    createCheck(
                        "Mercado de Players bloqueia peças vinculadas e projeta a taxa real",
                        marketRuleOk && marketQuoteOk,
                        `${marketRuleOk ? "vínculo respeitado" : "vínculo ignorado"} · 10 o → ${smallQuote.sellerNet} o · 100 o → ${largeQuote.sellerNet} o`
                    )
                );

                // UI 3.0 — fase 5.2 (Mercado): anuncia com a cotação do dono e encaminha o comando.
                const marketListableOriginal = marketplace.getListableItems;
                const marketListOriginal = marketplace.listForSale;
                const marketCalls = [];
                marketplace.getListableItems = () => [{ instanceId: "ui3_market_probe", name: "Pedra de Teste", type: "material", price: 10, quantity: 1 }];
                marketplace.listForSale = (...args) => {
                    marketCalls.push(args);
                    return false;
                };
                let marketWorks = false;
                let marketDetail = "";
                try {
                    windowManager.openWindow("player-market-view", { source: "integration-ui3-market", tab: "sell" });
                    const marketLayer = document.querySelector("#ui3-root [data-ui3-window='player-market-view']");
                    const marketOpen = Aethra.Ui3MarketWindow?.isOpen?.() === true;
                    marketLayer?.querySelector("[data-ui3-tab='sell']")?.click();
                    marketLayer?.querySelector("[data-ui3-market-item='ui3_market_probe']")?.click();
                    const priceInput = marketLayer?.querySelector("[data-ui3-market-price]");
                    if (priceInput) {
                        priceInput.value = "12";
                        priceInput.dispatchEvent(new Event("input", { bubbles: true }));
                    }
                    const quoteShown = /recebe 11 o/.test(marketLayer?.querySelector("[data-ui3-market-quote]")?.textContent || "");
                    marketLayer?.querySelector("[data-ui3-market-publish='ui3_market_probe']")?.click();
                    const publishRouted = marketCalls.length === 1 && marketCalls[0][0] === "ui3_market_probe" && marketCalls[0][1] === 12
                        && Boolean(marketLayer?.querySelector(".ui3-notice--error"));
                    marketWorks = marketOpen && quoteShown && publishRouted;
                    marketDetail = `${marketOpen ? "janela nova" : "janela errada"} · cotação ${quoteShown ? "do dono" : "divergente"} · anúncio ${publishRouted ? "encaminhado" : "não encaminhado"}`;
                } finally {
                    marketplace.getListableItems = marketListableOriginal;
                    marketplace.listForSale = marketListOriginal;
                    windowManager.closeWindow("player-market-view", { source: "integration-restore" });
                }
                checks.push(createCheck("UI 3.0 Mercado anuncia com a cotação do MarketplaceSystem", marketWorks, marketDetail));

                /*
                 * UI 3.0 — fase 4 (Cidade). A cidade nova cobre a clássica, lê o
                 * mesmo ouro do herói e libera o mapa da Hunt.
                 */
                const cityViewBefore = Aethra.UIManager?.primaryView || "hunt";
                Aethra.UIManager?.setPrimaryView?.("city", { source: "integration-ui3-city" });
                const cityScreen = document.querySelector("#ui3-root [data-ui3-screen='city']");
                const cityGold = [...(cityScreen?.querySelectorAll(".ui3-kpi") || [])]
                    .find((kpi) => /ouro/i.test(kpi.textContent))
                    ?.querySelector(".ui3-kpi__value")?.textContent || "";
                const cityServices = cityScreen?.querySelectorAll("[data-ui3-city-service]").length || 0;
                const cityShown = Aethra.Ui3CityScreen?.isVisible?.() === true
                    && Aethra.Ui3HuntScreen?.isVisible?.() === false
                    && Aethra.TileMapCanvas?.isHosted?.() === false
                    && (!document.getElementById("world-layer") || document.getElementById("world-layer").inert === true);
                cityScreen?.querySelector("[data-ui3-city-service='bag']")?.click();
                const cityOpensBag = Aethra.Ui3BagWindow?.isOpen?.() === true;
                windowManager.closeWindow("inventory-view", { source: "integration-restore" });
                checks.push(
                    createCheck(
                        "UI 3.0 Cidade cobre a clássica, mostra o ouro oficial e abre os serviços",
                        cityShown
                            && cityServices === 8
                            && cityGold.replace(/\D/g, "") === String(Math.floor(Number(Aethra.GameState.hero.gold) || 0))
                            && cityOpensBag,
                        `${cityShown ? "cidade nova" : "tela errada"} · ${cityServices} serviços · ouro "${cityGold}" · mochila ${cityOpensBag ? "abriu" : "não abriu"}`
                    )
                );
                Aethra.UIManager?.setPrimaryView?.(cityViewBefore, { source: "integration-restore" });

                /*
                 * HuntAtlas: a caçada focada registra a rota da criatura, inicia
                 * com o alvo certo e pedir a mesma rota de novo só retoma.
                 */
                const atlasTarget = Aethra.HuntAtlas?.getCreatureCatalog?.()
                    .find((entry) => Aethra.HuntAtlas.isUnlocked(entry.level)) || null;
                let atlasWorks = false;
                let atlasDetail = "nenhuma criatura liberada no catálogo";
                if (atlasTarget) {
                    const firstStart = Aethra.HuntAtlas.startCreatureHunt(atlasTarget.id, { stopReason: "integration-atlas" });
                    const huntDuring = { ...Aethra.GameState.hunt };
                    const secondStart = Aethra.HuntAtlas.startRoute(firstStart.huntId, { stopReason: "integration-atlas" });
                    Aethra.HuntSystem.stopHunt("integration-atlas");
                    atlasWorks = firstStart.started === true
                        && firstStart.resumed === false
                        && secondStart.resumed === true
                        && huntDuring.isActive === true
                        && huntDuring.huntId === `targeted__${atlasTarget.id}`
                        && huntDuring.targetCreatureId === atlasTarget.id
                        && Aethra.GameState.hunt.isActive === false;
                    atlasDetail = `${atlasTarget.name}: ${firstStart.started ? "iniciou" : "não iniciou"} · repetir ${secondStart.resumed ? "retomou" : "reiniciou"} · alvo ${huntDuring.targetCreatureId || "?"}`;
                }
                checks.push(createCheck("Atlas inicia caçada focada e retoma a mesma rota sem reiniciar", atlasWorks, atlasDetail));

                /*
                 * UI 3.0 — fase 4 (Mapa-Mundi). Aethra.openHuntWorldMap abre a
                 * janela nova; a caçada focada começa pelo HuntAtlas.
                 */
                const atlasViewBefore = Aethra.UIManager?.primaryView || "hunt";
                Aethra.GameState.ui.worldMapMode = "expeditions";
                Aethra.openHuntWorldMap?.({ source: "integration-ui3-atlas" });
                const atlasLayer = document.querySelector("#ui3-root [data-ui3-window='hunt-world-map-view']");
                const atlasNodes = atlasLayer?.querySelectorAll("[data-ui3-expedition]").length || 0;
                atlasLayer?.querySelector("[data-ui3-tab='creatures']")?.click();
                const atlasCreatureRows = atlasLayer?.querySelectorAll("[data-ui3-creature]").length || 0;
                let atlasStartWorks = false;
                if (atlasTarget) {
                    atlasLayer?.querySelector(`[data-ui3-creature="${atlasTarget.id}"]`)?.click();
                    atlasLayer?.querySelector("[data-ui3-creature-start]")?.click();
                    atlasStartWorks = Aethra.GameState.hunt.isActive === true
                        && Aethra.GameState.hunt.targetCreatureId === atlasTarget.id
                        && Aethra.Ui3AtlasWindow?.isOpen?.() === false
                        && Aethra.UIManager?.primaryView === "hunt";
                    Aethra.HuntSystem.stopHunt("integration-ui3-atlas");
                }
                windowManager.closeWindow("hunt-world-map-view", { source: "integration-restore" });
                Aethra.UIManager?.setPrimaryView?.(atlasViewBefore, { source: "integration-restore" });
                checks.push(
                    createCheck(
                        "UI 3.0 Mapa-Mundi mostra o HuntAtlas e inicia a caçada focada",
                        atlasNodes === Aethra.HuntAtlas.getExpeditions().length
                            && atlasNodes > 0
                            && atlasCreatureRows === Aethra.HuntAtlas.getCreatureCatalog().length
                            && atlasStartWorks,
                        `${atlasNodes} expedições · ${atlasCreatureRows} criaturas · caçada ${atlasStartWorks ? "iniciada e janela fechada" : "não iniciada"}`
                    )
                );

                // UI 3.0 — fase 4 (Missões): lista do QuestSystem e acompanhamento pelo dono.
                windowManager.openWindow("quests-view", { source: "integration-ui3-quests" });
                const questsLayer = document.querySelector("#ui3-root [data-ui3-window='quests-view']");
                const questSnapshot = Aethra.QuestSystem.getState();
                const questRows = questsLayer?.querySelectorAll("[data-ui3-quest]").length || 0;
                const questTotal = (questSnapshot.active || []).length + (questSnapshot.completed || []).length;
                const trackedBefore = Aethra.GameState.ui?.trackedQuestId || null;
                const firstActive = (questSnapshot.active || [])[0] || null;
                let trackingWorks = false;
                if (firstActive) {
                    questsLayer?.querySelector(`[data-ui3-quest="${firstActive.id}"]`)?.click();
                    questsLayer?.querySelector("[data-ui3-quest-track]")?.click();
                    const trackedAfter = Aethra.GameState.ui?.trackedQuestId || null;
                    trackingWorks = trackedAfter !== trackedBefore
                        && (trackedAfter === firstActive.id || trackedAfter === null);
                    Aethra.QuestSystem.trackQuest(trackedBefore, { save: false });
                }
                windowManager.closeWindow("quests-view", { source: "integration-restore" });
                checks.push(
                    createCheck(
                        "UI 3.0 Missões lista o QuestSystem e acompanha pelo dono",
                        Aethra.Ui3QuestsWindow?.isOpen?.() === false
                            && questRows === questTotal
                            && questTotal > 0
                            && Boolean(firstActive)
                            && trackingWorks
                            && (Aethra.GameState.ui?.trackedQuestId || null) === trackedBefore,
                        `${questRows}/${questTotal} missões · acompanhamento ${firstActive ? (trackingWorks ? "alternou" : "não alternou") : "sem missão ativa"}`
                    )
                );

                settings?.setInterfaceVersion?.(interfaceBefore || "classic", { source: "integration-restore" });
                Aethra.GameState.hero.characterCreated = createdBefore;

                checks.push(
                    createCheck(
                        "UI 3.0 devolve mapa e camadas clássicas ao sair da Hunt",
                        cityReleasesCanvas && classicRestored,
                        `cidade ${cityReleasesCanvas ? "liberou o mapa" : "prendeu o mapa"} · clássica ${classicRestored ? "restaurada" : "com resíduos"}`
                    )
                );

                /*
                 * UI 3.0 — fase 4 (Tela de título). Segura as telas de jogo,
                 * "Novo herói" só apaga depois da confirmação e "Continuar"
                 * devolve o jogo.
                 */
                settings?.setInterfaceVersion?.("v3", { source: "integration-ui3-title" });
                Aethra.GameState.hero.characterCreated = true;
                const originalReset = Aethra.SaveManager.reset;
                let resetCalls = 0;
                Aethra.SaveManager.reset = () => {
                    resetCalls += 1;
                    return false;
                };
                let titleWorks = false;
                let titleDetail = "";
                try {
                    const opened = Aethra.Ui3TitleScreen?.show?.() === true;
                    const titleScreen = document.querySelector("#ui3-root [data-ui3-screen='title']");
                    const gameHeld = Aethra.Ui3TopBar?.isVisible?.() === false
                        && Aethra.Ui3Shell?.canShowGame?.() === false;
                    titleScreen?.querySelector("[data-ui3-title-new]")?.click();
                    const askedFirst = resetCalls === 0 && Boolean(titleScreen?.querySelector("[data-ui3-title-reset]"));
                    titleScreen?.querySelector("[data-ui3-title-reset]")?.click();
                    const resetAfterConfirm = resetCalls === 1;
                    titleScreen?.querySelector("[data-ui3-title-continue]")?.click();
                    const released = Aethra.Ui3TitleScreen?.isVisible?.() === false
                        && Aethra.Ui3Shell?.canShowGame?.() === true
                        && Aethra.Ui3TopBar?.isVisible?.() === true;
                    titleWorks = opened && gameHeld && askedFirst && resetAfterConfirm && released;
                    titleDetail = `${opened ? "abriu" : "não abriu"} · jogo ${gameHeld ? "seguro" : "livre"} · reset ${askedFirst ? "pediu confirmação" : "sem confirmação"} e ${resetAfterConfirm ? "rodou após confirmar" : "não rodou"} · continuar ${released ? "liberou" : "prendeu"}`;
                } finally {
                    Aethra.SaveManager.reset = originalReset;
                }
                checks.push(createCheck("UI 3.0 Tela de título segura o jogo e só apaga o herói com confirmação", titleWorks, titleDetail));
                settings?.setInterfaceVersion?.(interfaceBefore || "classic", { source: "integration-restore" });

                /*
                 * UI 3.0 — fase 4 (Criação). Última verificação da suíte: criar
                 * um herói reinicia a progressão. A tela nova assume
                 * CharacterCreationUI.show(), recusa nome curto e cria pelo
                 * CharacterBuildSystem.
                 */
                settings?.setInterfaceVersion?.("v3", { source: "integration-ui3-creation" });
                Aethra.GameState.hero.characterCreated = false;
                Aethra.CharacterCreationUI?.show?.();
                const creationScreen = document.querySelector("#ui3-root [data-ui3-screen='creation']");
                const classicCreationLayer = document.getElementById("character-creation-layer");
                const creationShown = Aethra.Ui3CreationScreen?.isVisible?.() === true
                    && (!classicCreationLayer || classicCreationLayer.children.length === 0);
                const nameInput = creationScreen?.querySelector("[data-ui3-hero-name]");
                const typeName = (value) => {
                    if (!nameInput) return;
                    nameInput.value = value;
                    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
                };
                typeName("Al");
                const blockedShortName = creationScreen?.querySelector("[data-ui3-create]")?.disabled === true;
                const firstProfession = Object.keys(Aethra.CharacterBuildSystem.introProfessions || {})[0];
                creationScreen?.querySelector("[data-ui3-archetype='ranger']")?.click();
                creationScreen?.querySelector(`[data-ui3-profession="${firstProfession}"]`)?.click();
                typeName("Heroína de Teste");
                creationScreen?.querySelector("[data-ui3-create]")?.click();
                const ui3CreatedHero = Aethra.GameState.hero || {};
                const creationWorks = ui3CreatedHero.characterCreated === true
                    && ui3CreatedHero.name === "Heroína de Teste"
                    && ui3CreatedHero.archetypeId === "ranger"
                    && ui3CreatedHero.introProfessionId === firstProfession
                    && Aethra.Ui3CreationScreen?.isVisible?.() === false
                    && Aethra.Ui3CityScreen?.isVisible?.() === true;
                settings?.setInterfaceVersion?.(interfaceBefore || "classic", { source: "integration-restore" });
                checks.push(
                    createCheck(
                        "UI 3.0 Criação assume a tela, recusa nome curto e cria pelo CharacterBuildSystem",
                        creationShown && blockedShortName && creationWorks,
                        `${creationShown ? "tela nova" : "tela errada"} · nome curto ${blockedShortName ? "bloqueado" : "aceito"} · ${creationWorks ? `${ui3CreatedHero.name} (${ui3CreatedHero.archetypeId}) na cidade` : "criação falhou"}`
                    )
                );

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
