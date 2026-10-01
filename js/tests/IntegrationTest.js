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
        "TileMapCanvas",
        "IdleLoopSystem",
        "UIManager",
        "HuntAnalyzer",
        "HuntLootLedger",
        "DisciplineMilestones",
        "ProgressionJournal",
        "CraftingGuidance",
        "Ui3Shell",
        "Ui3Navigation",
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

    const UI3_WORKSHOP = "#ui3-root [data-ui3-window='profession-workshop-view']";

    // A UI 3.0 só mostra o jogo com herói criado; libera isso durante run().
    function withUi3Game(run) {
        const hero = Aethra.GameState.hero || {};
        const createdBefore = hero.characterCreated;
        hero.characterCreated = true;
        Aethra.EventBus.emit("ui3:screens-changed", { source: "integration" });
        try {
            return run();
        } finally {
            hero.characterCreated = createdBefore;
            Aethra.EventBus.emit("ui3:screens-changed", { source: "integration-restore" });
        }
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

            const progressionJournalModel = Aethra.ProgressionJournal?.getViewModel?.();
            const progressionJournalSelected = progressionJournalModel?.focused
                || progressionJournalModel?.entries?.find((entry) => entry.discovered)
                || progressionJournalModel?.entries?.[0];
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

            // A projeção do diário vive fora da tela; os marcos vêm dos dados.
            const swordMilestone = (Aethra.DisciplineMilestones?.get?.("sword") || []).find((entry) => entry.level > 1);
            const swordNext = Aethra.ProgressionJournal?.nextMilestone?.({ id: "sword", level: 1 });
            const neutralJournal = Aethra.ProgressionJournal?.getViewModel?.();
            checks.push(
                createCheck(
                    "Diário de Progressão tem projeção sem tela, com marcos vindos dos dados",
                    Boolean(swordMilestone)
                        && swordNext?.level === swordMilestone.level
                        && swordNext?.title === swordMilestone.title
                        && neutralJournal?.entries?.length === Object.keys(Aethra.DisciplineSystem?.definitions || {}).length
                        && Array.isArray(neutralJournal?.recent),
                    `espada Nv 1 → ${swordNext?.title || "sem marco"} (Nv ${swordNext?.level ?? "?"}) · ${neutralJournal?.entries?.length ?? 0} skills`
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
                    guidedWorkshopVisible = withUi3Game(() => {
                        Aethra.Ui3Navigation.openWorkshop("blacksmithing", { stationId: "forge", source: "integration-route" });
                        return Boolean(
                            document.querySelector(`${UI3_WORKSHOP} .ui3-recipe.is-guided [data-ui3-craft="smelt_iron"]`)
                            && document.querySelector(`${UI3_WORKSHOP} .ui3-workshop__guidance`)
                        );
                    });
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
            /*
             * A garantia do primeiro recurso vale na caçada para onde a missão
             * manda (o Bosque); saves com a garantia numa caçada de foco são
             * corrigidos ao carregar. Antes, quem seguia a missão nunca recebia o veio.
             */
            const explorationForIntro = Aethra.ExplorationSystem;
            const introGuaranteeBefore = JSON.parse(JSON.stringify(explorationForIntro.ensureState().tutorialGuarantee || null));
            const introHuntsAligned = ["mining", "skinning", "herbalism"].every((professionId) => {
                const definition = Aethra.ProfessionSystem.getIntroQuestDefinition(professionId);
                return Aethra.ProfessionSystem.getIntroHuntId(professionId) === definition.objectives[0].huntId;
            });
            explorationForIntro.ensureState().tutorialGuarantee = {
                professionId: "mining", eventId: "mining", huntId: "apprentice_mines_focus",
                remaining: 1, source: "intro-profession", manual: false, guaranteedSuccess: false, minimumQuantity: 1
            };
            const migratedIntroHunt = explorationForIntro.ensureState().tutorialGuarantee.huntId;
            explorationForIntro.ensureState().tutorialGuarantee = introGuaranteeBefore;
            checks.push(
                createCheck(
                    "Primeiro recurso de ofício aparece na caçada indicada pela missão",
                    introHuntsAligned && migratedIntroHunt === "whispering_forest",
                    `missões e garantias ${introHuntsAligned ? "na mesma caçada" : "desalinhadas"} · save antigo → ${migratedIntroHunt}`
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
            const bossGuidanceOpened = Aethra.Ui3Navigation?.followQuestGuidance?.(alphaGuidance, { source: "integration-chapter-one" });
            Aethra.Ui3BossesWindow?.refresh?.();
            const bossWindowProbe = {
                action: alphaGuidance?.action || null,
                opened: Boolean(bossGuidanceOpened),
                isOpen: Aethra.Ui3BossesWindow?.isOpen?.() === true,
                alphaEnabled: Boolean(document.querySelector("#ui3-root [data-ui3-window='bosses-view'] [data-ui3-boss-challenge='alpha_wolf']:not(:disabled)"))
            };
            const bossWindowFunctional = Boolean(bossWindowProbe.opened && bossWindowProbe.isOpen && bossWindowProbe.alphaEnabled);
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
            const mentorCurrentGuidance = Aethra.QuestSystem?.getGuidance?.();
            const mentorPanelFunctional = withUi3Game(() => {
                const opened = Aethra.Ui3Navigation?.openMentor?.({ source: "integration-route" });
                const mentorPanel = document.querySelector("#ui3-root [data-ui3-window='profession-mentor-view']");
                const functional = Boolean(
                    opened
                    && /Sua rota inicial/i.test(mentorPanel?.textContent || "")
                    && /Benefício permanente/i.test(mentorPanel?.textContent || "")
                    && (!mentorCurrentGuidance || mentorPanel?.querySelector?.("[data-ui3-mentor-guidance]"))
                );
                Aethra.WindowManager?.closeWindow?.("profession-mentor-view", { source: "integration-route" });
                return functional;
            });
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
            const specializationUIWorks = withUi3Game(() => {
                Aethra.Ui3Navigation?.openSpecialization?.("mining", { source: "integration" });
                const specializationWindow = document.querySelector("#ui3-root [data-ui3-window='profession-specialization-view']");
                return Boolean(specializationWindow)
                    && specializationWindow.querySelectorAll(".ui3-specialization__paths > .ui3-recipe").length === 2
                    && specializationWindow.querySelectorAll(".ui3-specialization__nodes li").length === 6
                    && /Maestria infinita/i.test(specializationWindow.textContent)
                    && Boolean(specializationWindow.querySelector(".ui3-specialization__paths > .ui3-recipe.is-guided"));
            });
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

            const rareRecipe = ["blacksmithing", "leatherworking", "alchemy"]
                .flatMap((professionId) => Aethra.CraftingSystem.getRecipes(professionId) || [])
                .find((recipe) => recipe.sourceHint);
            const sourceGuidance = rareRecipe ? withUi3Game(() => {
                Aethra.Ui3Navigation.openWorkshop(rareRecipe.professionId, { source: "integration-rare-source" });
                const card = [...document.querySelectorAll(`${UI3_WORKSHOP} .ui3-recipe`)]
                    .find((entry) => entry.textContent.includes("Onde conseguir"));
                Aethra.WindowManager?.closeWindow?.("profession-workshop-view", { source: "integration-rare-source" });
                return card || null;
            }) : null;
            checks.push(
                createCheck(
                    "Oficina orienta onde conseguir materiais raros",
                    Boolean(rareRecipe && sourceGuidance),
                    sourceGuidance ? `${rareRecipe.name}: dica exibida` : rareRecipe ? "orientação ausente" : "nenhuma receita descoberta com dica"
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

            // A criação 3.0 aparece enquanto o herói não foi criado.
            const creationCreatedBefore = Aethra.GameState.hero.characterCreated;
            Aethra.GameState.hero.characterCreated = false;
            Aethra.Ui3CreationScreen?.sync?.();
            const creationRoot = document.querySelector("#ui3-root [data-ui3-screen='creation']");
            const creationArchetypes = creationRoot?.querySelectorAll("[data-ui3-archetype]") || [];
            const creationSubmit = creationRoot?.querySelector("[data-ui3-create]");
            const creationAttributes = creationRoot?.querySelectorAll("[data-ui3-attribute]") || [];
            const creationProfessions = creationRoot?.querySelectorAll("[data-ui3-profession]") || [];
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
            Aethra.GameState.hero.characterCreated = creationCreatedBefore;
            Aethra.Ui3CreationScreen?.sync?.();
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

                const combatSpeedControls = withUi3Game(() => {
                    Aethra.Ui3HuntScreen?.sync?.();
                    return [...document.querySelectorAll("#ui3-root [data-ui3-speed]")];
                });
                checks.push(
                    createCheck(
                        "HUD oferece velocidades 1×, 2× e 4×",
                        combatSpeedControls.length === 3
                            && combatSpeedControls.map((button) => Number(button.dataset.ui3Speed)).join(",") === "1,2,4",
                        `${combatSpeedControls.length}/3 controles renderizados`
                    )
                );
                const analyzerMetrics = Aethra.HuntAnalyzer?.getMetrics?.() || {};
                checks.push(
                    createCheck(
                        "Medição da Hunt expõe XP, ganhos, gastos e saldo",
                        ["xp", "gained", "spent", "profit", "xpPerHour", "profitPerHour"].every((key) => Number.isFinite(Number(analyzerMetrics[key]))),
                        `XP ${analyzerMetrics.xp ?? "?"} · saldo ${analyzerMetrics.profit ?? "?"}`
                    )
                );
                /*
                 * HuntAnalyzer (sem tela) guarda recordes por Hunt: taxas só depois
                 * de 10 s e cada sessão concluída conta uma única vez.
                 */
                const huntStateBackup = JSON.parse(JSON.stringify(Aethra.GameState.hunt || {}));
                const recordsBackup = JSON.parse(JSON.stringify(Aethra.GameState.hero.huntAnalyzerRecords || {}));
                let recordsWork = false;
                let recordsDetail = "";
                try {
                    Object.assign(Aethra.GameState.hunt, {
                        huntId: "integration_records_hunt",
                        startedAt: "integration-records",
                        elapsedMs: 20_000,
                        xp: 100,
                        gold: 30,
                        lootValue: 20,
                        supplyCost: 10,
                        kills: 2
                    });
                    Aethra.HuntAnalyzer.getMetrics().session.peakDps = 12;
                    Aethra.HuntAnalyzer.updateRecords({ completed: true });
                    const recordAfterFirst = { ...Aethra.HuntAnalyzer.getRecords().byHunt.integration_records_hunt };
                    Aethra.HuntAnalyzer.updateRecords({ completed: true });
                    const recordAfterSecond = Aethra.HuntAnalyzer.getRecords().byHunt.integration_records_hunt;
                    recordsWork = recordAfterFirst.sessions === 1
                        && recordAfterSecond.sessions === 1
                        && recordAfterFirst.bestXpPerHour === 18_000
                        && recordAfterFirst.bestProfitPerHour === 7_200
                        && recordAfterFirst.maxDps === 12
                        && Aethra.HuntAnalyzer.getRecords().overall.maxDps >= 12;
                    recordsDetail = `${recordAfterSecond.sessions} sessão · ${recordAfterFirst.bestXpPerHour} XP/h · ${recordAfterFirst.bestProfitPerHour} o/h · DPS ${recordAfterFirst.maxDps}`;
                } finally {
                    Aethra.GameState.hunt = Object.assign(Aethra.GameState.hunt, huntStateBackup);
                    Object.keys(Aethra.GameState.hunt).forEach((key) => {
                        if (!(key in huntStateBackup)) delete Aethra.GameState.hunt[key];
                    });
                    Aethra.GameState.hero.huntAnalyzerRecords = recordsBackup;
                }
                checks.push(createCheck("HuntAnalyzer registra recordes por Hunt uma vez por sessão", recordsWork, recordsDetail));


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
                Aethra.Ui3Navigation.openWorkshop("blacksmithing", { stationId: "forge", source: "integration-mining-contract" });
                const guidedSmeltingVisible = Boolean(
                    document.querySelector(`${UI3_WORKSHOP} .ui3-recipe.is-guided [data-ui3-craft="smelt_iron"]`)
                    && /Produza Fundir Ferro/.test(document.querySelector(`${UI3_WORKSHOP} .ui3-workshop__guidance`)?.textContent || "")
                );
                const smeltingResult = Aethra.CraftingSystem?.craft?.("smelt_iron", {
                    stationId: "forge",
                    techniqueId: "balanced",
                    quantity: 3,
                    commandId: "integration-focus-smelt"
                });
                const miningContractAfterSmelt = Aethra.ProfessionSystem?.getFocusTrainingState?.("mining");
                Aethra.Ui3WorkshopWindow?.refresh?.();
                const guidedEquipmentCards = [...document.querySelectorAll(`${UI3_WORKSHOP} .ui3-recipe.is-guided [data-ui3-craft]`)];
                const equipmentChoiceVisible = guidedEquipmentCards.length === 3
                    && /Escolha seu primeiro equipamento/.test(document.querySelector(`${UI3_WORKSHOP} .ui3-workshop__guidance`)?.textContent || "");
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

                const focusedJournal = Aethra.ProgressionJournal?.getViewModel?.();
                checks.push(
                    createCheck(
                        "Diário reflete a skill focada",
                        focusedJournal?.focused?.id === "mining"
                            && focusedJournal.entries.filter((entry) => entry.focused).length === 1,
                        focusedJournal?.focused ? `${focusedJournal.focused.name} em foco` : "nenhuma skill em foco"
                    )
                );

                const trackedIntroQuest = Aethra.QuestSystem?.getTrackedQuest?.();
                const trackedGuidance = Aethra.QuestSystem?.getGuidance?.(trackedIntroQuest);
                const journeyViewBefore = Aethra.UIManager?.primaryView || "hunt";
                Aethra.UIManager?.setPrimaryView?.("city", { source: "integration-journey" });
                Aethra.Ui3CityScreen?.sync?.();
                const cityGuidance = document.querySelector("#ui3-root [data-ui3-screen='city'] [data-ui3-part='guidance']");
                const journeyShown = Boolean(cityGuidance?.querySelector("[data-ui3-city-quest-action]"))
                    && Boolean(cityGuidance?.querySelector("[data-ui3-city-focus-action]"))
                    && /Primeiros Passos/.test(cityGuidance?.textContent || "");
                Aethra.UIManager?.setPrimaryView?.(journeyViewBefore, { source: "integration-restore" });
                checks.push(
                    createCheck(
                        "HUD da jornada mostra objetivo e próximo passo",
                        trackedIntroQuest?.id === "tutorial_first_steps"
                            && trackedGuidance?.action === "open-hunt-map"
                            && journeyShown,
                        `Cidade ${journeyShown ? "mostra missão e foco" : "sem próximo passo"} · missão ${trackedGuidance?.actionLabel || "ausente"} · foco ${miningGuidance?.actionLabel || "ausente"}`
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
                Aethra.Ui3Navigation.openWorkshop("leatherworking", { stationId: "tannery", source: "integration-skinning-contract" });
                const guidedTanningVisible = Boolean(
                    document.querySelector(`${UI3_WORKSHOP} .ui3-recipe.is-guided [data-ui3-craft="tan_beast_hide"]`)
                    && /Produza Curtir Pele/.test(document.querySelector(`${UI3_WORKSHOP} .ui3-workshop__guidance`)?.textContent || "")
                );
                const tanningResult = Aethra.CraftingSystem?.craft?.("tan_beast_hide", {
                    stationId: "tannery",
                    techniqueId: "balanced",
                    quantity: 3,
                    commandId: "integration-focus-tanning"
                });
                const skinningContractAfterTan = Aethra.ProfessionSystem?.getFocusTrainingState?.("skinning");
                Aethra.Ui3WorkshopWindow?.refresh?.();
                const guidedLeatherCards = [...document.querySelectorAll(`${UI3_WORKSHOP} .ui3-recipe.is-guided [data-ui3-craft]`)];
                const leatherChoiceVisible = guidedLeatherCards.length === 3
                    && /Botas, Chapéu e Calças de Couro/.test(document.querySelector(`${UI3_WORKSHOP} .ui3-workshop__guidance`)?.textContent || "");
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
                        "Foco de Herbalismo ativa rota e contrato até Alquimia",
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
                        `${herbalismGuidance?.name || "sem skill"} â†’ ${herbalismGuidance?.recommendation?.name || "sem rota"} · ${herbalismGuaranteeStart?.remaining || 0} colheitas`
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
                        skippedHerbalismResult ? `ignorada · ${herbalismGuaranteeAfterSkip?.remaining || 0} colheitas restantes` : "decisão manual ausente"
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
                        "Herbalismo manual entrega XP, seis ervas e avança ao Laboratório",
                        gatheredFocusEvents.length === 3
                            && gatheredFocusEvents.every((event) => event?.status === "resolved" && event?.manual === true)
                            && herbsAfterFocusLoop - herbsBeforeFocusLoop === 6
                            && herbalismXPAfterFocusLoop - herbalismXPBeforeFocusLoop === herbalismXPFromEvents
                            && herbalismContractAfterHerbs?.guidance?.objective?.id === "distill_focus_extracts"
                            && herbalismContractAfterHerbs?.guidance?.professionId === "alchemy"
                            && Aethra.ExplorationSystem?.getSnapshot?.().tutorialGuarantee === null,
                        `${gatheredFocusEvents.length}/3 canteiros · +${herbsAfterFocusLoop - herbsBeforeFocusLoop} ervas · +${herbalismXPAfterFocusLoop - herbalismXPBeforeFocusLoop} XP`
                    )
                );

                Aethra.GameState.hunt.isActive = false;
                Aethra.UIManager?.setPrimaryView?.("city", { emit: false, source: "integration-herbalism-contract" });
                Aethra.Ui3Navigation.openWorkshop("alchemy", { stationId: "laboratory", source: "integration-herbalism-contract" });
                const guidedDistillationVisible = Boolean(
                    document.querySelector(`${UI3_WORKSHOP} .ui3-recipe.is-guided [data-ui3-craft="distill_wild_herb"]`)
                    && /Produza Destilar Ervas/.test(document.querySelector(`${UI3_WORKSHOP} .ui3-workshop__guidance`)?.textContent || "")
                );
                const distillationResult = Aethra.CraftingSystem?.craft?.("distill_wild_herb", {
                    stationId: "laboratory",
                    techniqueId: "balanced",
                    quantity: 3,
                    commandId: "integration-focus-distillation"
                });
                const herbalismContractAfterDistill = Aethra.ProfessionSystem?.getFocusTrainingState?.("herbalism");
                Aethra.Ui3WorkshopWindow?.refresh?.();
                const guidedSupplyCards = [...document.querySelectorAll(`${UI3_WORKSHOP} .ui3-recipe.is-guided [data-ui3-craft]`)];
                const guidedSupplyIds = guidedSupplyCards.map((card) => card.dataset.ui3Craft).sort();
                const supplyChoiceVisible = guidedSupplyCards.length === 3
                    && ["brew_health_potion", "brew_mana_potion", "brew_vigor_tonic"].every((recipeId) => guidedSupplyIds.includes(recipeId))
                    && /Escolha seu primeiro suprimento/.test(document.querySelector(`${UI3_WORKSHOP} .ui3-workshop__guidance`)?.textContent || "")
                    && !document.querySelector(`${UI3_WORKSHOP} [data-ui3-tab="maintenance"]`);
                checks.push(
                    createCheck(
                        "Laboratório conduz da destilação para três escolhas de supply",
                        guidedDistillationVisible
                            && distillationResult?.accepted === true
                            && herbalismContractAfterDistill?.guidance?.objective?.id === "brew_focus_supply"
                            && supplyChoiceVisible,
                        `destilação ${guidedDistillationVisible ? "guiada" : "ausente"} · ${guidedSupplyCards.length}/3 supplies destacados`
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
                        `${craftedSupply?.recipe?.name || "sem supply"} · +${vigorAfterAlchemy - vigorBeforeAlchemy} no estoque · contrato ${completedHerbalismContract?.status || "ausente"}`
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
                const protectedSellables = (Aethra.MarketplaceSystem.getSellableItems()).filter((entry) => {
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
                const leftoverListed = (Aethra.MarketplaceSystem.getSellableItems()).some((entry) => entry.item === leftoverStack);
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

                Aethra.WindowManager?.openWindow?.("inventory-view", {
                    source: "integration-hud-exclusive"
                });
                Aethra.WindowManager?.openWindow?.("skills-view", {
                    source: "integration-hud-exclusive"
                });
                const skillsRect = document.querySelector("#ui3-root [data-ui3-window='skills-view'] .ui3-dialog")?.getBoundingClientRect?.();
                const topbarBottom = document.querySelector("#ui3-root .ui3-topbar")
                    ?.getBoundingClientRect?.().bottom || 0;
                const actionBarTop = window.innerHeight;
                // Na 3.0 o diálogo fica por cima de tudo: o topo dele não pode estar sob a barra.
                const skillsDialog = document.querySelector("#ui3-root [data-ui3-window='skills-view'] .ui3-dialog");
                const skillsTopHit = skillsRect
                    ? document.elementFromPoint(skillsRect.left + skillsRect.width / 2, skillsRect.top + 8)
                    : null;
                const skillsOnTop = Boolean(skillsDialog && skillsTopHit && skillsDialog.contains(skillsTopHit));
                checks.push(
                    createCheck(
                        "Janelas do HUD são exclusivas e nunca ficam atrás da topbar",
                        Aethra.WindowManager?.config?.exclusive === true
                            && Aethra.WindowManager?.isOpen?.("skills-view") === true
                            && Aethra.WindowManager?.isOpen?.("inventory-view") === false
                            && skillsOnTop
                            && Number(skillsRect?.top ?? -1) >= 0
                            && Number(skillsRect?.bottom || 0) <= Number(actionBarTop) + 1,
                        `inventário ${Aethra.WindowManager?.isOpen?.("inventory-view") ? "aberto" : "fechado"} · skills y=${Math.round(skillsRect?.top || 0)}–${Math.round(skillsRect?.bottom || 0)} · topbar=${Math.round(topbarBottom)} · actionbar=${Math.round(actionBarTop)}`
                    )
                );
                Aethra.WindowManager?.closeAll?.({ modalOnly: true, silent: true });

                /*
                 * O Mapa-Mundi 3.0 cobre o jogo com o fundo do diálogo e mantém
                 * "Iniciar expedição" dentro da tela e clicável.
                 */
                Aethra.Ui3Navigation?.openHuntMap?.({ source: "integration-overlay", mode: "expeditions" });
                const worldMapLayer = document.querySelector("#ui3-root [data-ui3-window='hunt-world-map-view']");
                const worldMapDialog = worldMapLayer?.querySelector(".ui3-dialog");
                const worldMapBackdrop = worldMapLayer?.querySelector(".ui3-dialog-backdrop");
                worldMapLayer?.querySelector("[data-ui3-expedition]")?.click();
                const worldMapStart = worldMapLayer?.querySelector("[data-ui3-expedition-start]");
                const reportElement = document.getElementById("integration-test-report");
                const reportWasHidden = reportElement?.hidden === true;
                if (reportElement) reportElement.hidden = true;
                worldMapStart?.scrollIntoView?.({ block: "nearest" });
                const startRect = worldMapStart?.getBoundingClientRect?.();
                const startHitTarget = startRect
                    ? document.elementFromPoint(startRect.left + startRect.width / 2, startRect.top + startRect.height / 2)
                    : null;
                const backdropRect = worldMapBackdrop?.getBoundingClientRect?.();
                const dialogRect = worldMapDialog?.getBoundingClientRect?.();
                const backdropHit = document.elementFromPoint(4, window.innerHeight - 4);
                if (reportElement) reportElement.hidden = reportWasHidden;
                const mapIsBlockingOverlay = Boolean(worldMapBackdrop)
                    && Math.abs(Number(backdropRect?.width || 0) - window.innerWidth) <= 1
                    && Math.abs(Number(backdropRect?.height || 0) - window.innerHeight) <= 1
                    && backdropHit === worldMapBackdrop
                    && Number(dialogRect?.left ?? -1) >= 0
                    && Number(dialogRect?.top ?? -1) >= 0
                    && Number(dialogRect?.right ?? Infinity) <= window.innerWidth + 1
                    && Number(dialogRect?.bottom ?? Infinity) <= window.innerHeight + 1;
                const startIsReachable = Boolean(worldMapStart)
                    && Number(startRect?.top ?? -1) >= 0
                    && Number(startRect?.bottom ?? Infinity) <= window.innerHeight
                    && (startHitTarget === worldMapStart || worldMapStart.contains(startHitTarget));
                const describeHit = (element) => element?.className || element?.tagName || "fora da tela";
                checks.push(
                    createCheck(
                        "Mapa Mundi bloqueia o fundo e mantém Entrar na expedição clicável",
                        mapIsBlockingOverlay && startIsReachable,
                        `viewport ${window.innerWidth}×${window.innerHeight} · fundo ${Math.round(backdropRect?.width || 0)}×${Math.round(backdropRect?.height || 0)} ${backdropHit === worldMapBackdrop ? "bloqueia" : `vaza (${describeHit(backdropHit)})`} · diálogo ${Math.round(dialogRect?.left || 0)},${Math.round(dialogRect?.top || 0)}–${Math.round(dialogRect?.right || 0)},${Math.round(dialogRect?.bottom || 0)} · botão ${startIsReachable ? "alcançável" : `obstruído por ${describeHit(startHitTarget)}`}`
                    )
                );
                Aethra.WindowManager?.closeWindow?.("hunt-world-map-view", {
                    source: "integration-overlay-cleanup",
                    silent: true
                });

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

                Aethra.Ui3TopBar?.render?.();
                const sharedSaveIndicator = document.querySelector("#ui3-root [data-ui3-save-chip]");
                checks.push(
                    createCheck(
                        "HUD informa se o progresso é local ou compartilhado",
                        Boolean(Aethra.Ui3SaveStatus)
                            && Boolean(sharedSaveIndicator)
                            && /Local|Compartilhado|Escolher|Sincronizando/.test(sharedSaveIndicator.textContent || ""),
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
                /*
                 * A UI 3.0 é a única interface: as preferências antigas de escolha
                 * de interface são descartadas e não podem ser regravadas.
                 */
                const retiredBefore = settings.get("interfaceVersion");
                const retiredRefused = settings.set("interfaceVersion", "classic", { source: "integration" }) === false
                    && settings.get("interfaceVersion") === undefined
                    && settings.get("interfaceVersionChosen") === undefined;
                checks.push(
                    createCheck(
                        "UI 3.0 é a única interface e a escolha antiga foi aposentada",
                        retiredBefore === undefined
                            && retiredRefused
                            && Aethra.Ui3Shell?.isActive?.() === true
                            && document.body.classList.contains("ui3-active")
                            && typeof settings.setInterfaceVersion !== "function",
                        `preferência antiga ${retiredBefore === undefined ? "ausente" : "presente"} · regravar ${retiredRefused ? "recusado" : "aceito"}`
                    )
                );

                const ui3Root = document.getElementById("ui3-root");
                const rootHiddenBefore = ui3Root?.hidden === true;
                const galleryShown = Aethra.Ui3Shell?.showGallery?.();
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
                            && ui3Root.hidden === rootHiddenBefore
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

                /*
                 * O loot da expedição é registrado pelo HuntLootLedger (sem tela) e
                 * conta uma vez só, mesmo com outras telas ouvindo os mesmos eventos.
                 */
                const ledger = Aethra.HuntLootLedger;
                const ledgerBefore = JSON.parse(JSON.stringify(ledger.ensureState()));
                let ledgerWorks = false;
                let ledgerDetail = "";
                try {
                    ledger.reset();
                    Aethra.EventBus.emit("hunt:loot-generated", {
                        enemyId: "forest_wolf",
                        items: [{ id: "wolf_pelt", templateId: "wolf_pelt", name: "Pele de Lobo", type: "material", stackable: true, quantity: 2, price: 4 }]
                    });
                    Aethra.EventBus.emit("hunt:enemy-defeated", { name: "Lobo", gold: 7 });
                    const session = ledger.ensureState();
                    const pelt = session.stackables["item:wolf_pelt"];
                    const goldEntry = session.stackables["currency:gold"];
                    // A aba de loot só existe com a expedição em andamento.
                    const huntActiveBefore = Aethra.GameState.hunt.isActive;
                    Aethra.GameState.hunt.isActive = true;
                    Aethra.Ui3HuntScreen?.render?.();
                    huntScreen?.querySelector("[data-ui3-tab='loot']")?.click();
                    const lootShown = (huntScreen?.querySelector(".ui3-expedition__body")?.textContent || "").includes("Pele de Lobo");
                    huntScreen?.querySelector("[data-ui3-tab='resumo']")?.click();
                    Aethra.GameState.hunt.isActive = huntActiveBefore;
                    Aethra.Ui3HuntScreen?.render?.();
                    ledgerWorks = pelt?.quantity === 2 && pelt?.totalValue === 8 && goldEntry?.quantity === 7 && lootShown;
                    ledgerDetail = `pele ×${pelt?.quantity ?? 0} (${pelt?.totalValue ?? 0} o) · ouro ${goldEntry?.quantity ?? 0} · aba de loot ${lootShown ? "mostra" : "vazia"}`;
                } finally {
                    Aethra.GameState.ui.lootSession = ledgerBefore;
                }
                checks.push(createCheck("Loot da expedição conta uma vez e aparece na Hunt 3.0", ledgerWorks, ledgerDetail));

                /*
                 * Evento manual de exploração (Minerar, Esfolar): pausa a caçada
                 * e precisa de escolha. A Hunt 3.0 mostra a prévia do
                 * ExplorationSystem e resolve por ele.
                 */
                const exploration = Aethra.ExplorationSystem;
                const explorationState = exploration.ensureState();
                const pendingBefore = explorationState.pendingEvent;
                explorationState.pendingEvent = {
                    id: "mining-vein",
                    eventId: "ui3_probe_event",
                    status: "pending",
                    title: "Veio de teste",
                    description: "Um veio exposto na parede da caverna.",
                    icon: "⛏",
                    category: "gathering",
                    actionLabel: "Minerar",
                    professionId: "mining",
                    requiredLevel: 1,
                    xp: [4, 8],
                    requiresManual: true,
                    guaranteedSuccess: true,
                    resumeHunt: false
                };
                Aethra.Ui3HuntScreen?.render?.();
                const eventPanel = huntScreen?.querySelector(".ui3-hunt__target");
                const eventPreview = exploration.getEventPreview();
                const eventShown = eventPanel?.hidden === false
                    && Boolean(eventPanel.querySelector("[data-ui3-event-resolve='ui3_probe_event']"))
                    && /100% de sucesso/.test(eventPanel.textContent)
                    && eventPreview?.xpMin === Math.round(4 * 1.25 * (Aethra.HuntSystem.getProfessionXPMultiplier?.("mining") ?? 1));
                eventPanel?.querySelector("[data-ui3-event-skip='ui3_probe_event']")?.click();
                const eventResolved = exploration.ensureState().pendingEvent === null
                    && exploration.getEventPreview() === null
                    && huntScreen?.querySelector(".ui3-hunt__target")?.hidden === true;
                explorationState.pendingEvent = pendingBefore || null;
                checks.push(
                    createCheck(
                        "UI 3.0 Hunt mostra o evento de exploração e resolve pelo ExplorationSystem",
                        eventShown && eventResolved,
                        `${eventShown ? `cartão com ${eventPreview?.actionLabel} · ${eventPreview?.xpMin}–${eventPreview?.xpMax} XP` : "cartão ausente"} · ${eventResolved ? "ignorado pelo dono" : "continuou pendente"}`
                    )
                );

                /*
                 * Escada entre andares: a expedição pausa ao limpar o andar e só
                 * segue quando o jogador desce. A Hunt 3.0 mostra o cartão e desce
                 * pelo HuntSystem (sem ele a 3.0 parava no primeiro andar).
                 */
                const stairsHuntBefore = JSON.parse(JSON.stringify(Aethra.GameState.hunt || {}));
                const nextRoomOriginal = Aethra.HuntSystem.nextRoom;
                let nextRoomCalls = 0;
                Aethra.HuntSystem.nextRoom = () => {
                    nextRoomCalls += 1;
                    return true;
                };
                let stairsWorks = false;
                let stairsDetail = "";
                try {
                    Object.assign(Aethra.GameState.hunt, { isActive: true, isAtStairs: true, huntId: "whispering_forest", currentRoom: 1, currentEnemy: null });
                    Aethra.Ui3HuntScreen?.render?.();
                    const stairsState = Aethra.HuntSystem.getStairsState();
                    const stairsButton = huntScreen?.querySelector(".ui3-hunt__target [data-ui3-next-room]");
                    const stairsShown = Boolean(stairsButton) && /Andar 1 de 10 limpo/.test(huntScreen?.querySelector(".ui3-hunt__target")?.textContent || "");
                    stairsButton?.click();
                    stairsWorks = stairsState.atStairs === true && stairsState.maxRooms === 10 && stairsShown && nextRoomCalls === 1;
                    stairsDetail = `${stairsShown ? "cartão da escada" : "sem cartão"} · descer ${nextRoomCalls === 1 ? "pelo HuntSystem" : "não encaminhado"}`;
                } finally {
                    Aethra.HuntSystem.nextRoom = nextRoomOriginal;
                    Object.keys(Aethra.GameState.hunt).forEach((key) => {
                        if (!(key in stairsHuntBefore)) delete Aethra.GameState.hunt[key];
                    });
                    Object.assign(Aethra.GameState.hunt, stairsHuntBefore);
                    Aethra.Ui3HuntScreen?.render?.();
                }
                checks.push(createCheck("UI 3.0 Hunt mostra a escada entre andares e desce pelo HuntSystem", stairsWorks, stairsDetail));

                Aethra.UIManager?.setPrimaryView?.("city", { source: "integration-ui3-hunt" });
                const cityReleasesCanvas = Aethra.Ui3HuntScreen?.isVisible?.() === false
                    && Aethra.TileMapCanvas?.isHosted?.() === false
                    && document.querySelectorAll("#tilemap-canvas").length <= 1
                    // A Cidade nova (fase 4) cobre a clássica: a camada continua inerte.
                    && Aethra.Ui3CityScreen?.isVisible?.() === true
                    && (!worldLayer || worldLayer.inert === true);
                Aethra.UIManager?.setPrimaryView?.(huntViewBefore, { source: "integration-restore" });
                Aethra.GameState.hero.characterCreated = createdBefore;
                /*
                 * UI 3.0 — fase 3 (Mochila). A janela nova assume "inventory-view"
                 * pelo WindowManager: os mesmos chamadores abrem a versão certa,
                 * e equipar passa pelo EquipSystem.
                 */
                Aethra.GameState.hero.characterCreated = true;
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
                checks.push(
                    createCheck(
                        "UI 3.0 Mochila fecha com Esc",
                        escClosed,
                        `Esc ${escClosed ? "fechou" : "não fechou"}`
                    )
                );
                /*
                 * UI 3.0 — fase 3 (Loja). Compra e venda passam pelo
                 * MarketplaceSystem; o preço mostrado é o da cotação do dono.
                 */
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
                const journalSize = Aethra.ProgressionJournal?.getViewModel?.().entries.length || 0;
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
                 * Pontos de habilidade: 1 por nível do herói; cada ponto sobe 1
                 * nível da habilidade escolhida (CharacterBuildSystem), respeitando
                 * XP pausado. A janela de Habilidades usa o ponto e a barra do
                 * topo mostra quantos estão livres.
                 */
                const pointHero = Aethra.GameState.hero;
                const pointBackup = {
                    skillPoints: pointHero.skillPoints,
                    disciplines: JSON.parse(JSON.stringify(pointHero.disciplines || {})),
                    investment: JSON.parse(JSON.stringify(pointHero.masteryInvestment || {}))
                };
                let skillPointWorks = false;
                let skillPointDetail = "";
                try {
                    const build = Aethra.CharacterBuildSystem;
                    pointHero.skillPoints = 0;
                    const noPoints = build.canAllocateSkillPoint("sword").reason === "no-points"
                        && build.allocateSkillPoint("sword") === false;
                    pointHero.skillPoints = 2;
                    Aethra.Ui3TopBar?.render?.();
                    const badgeShown = /2/.test(document.querySelector("#ui3-root [data-ui3-nav='skills'] .ui3-topbar__badge")?.textContent || "");
                    const axeSkill = Aethra.XPSystem.getSkillState("axe");
                    const axeModeBefore = axeSkill.trainingMode;
                    axeSkill.trainingMode = "locked";
                    const lockedRespected = build.canAllocateSkillPoint("axe").reason === "training-locked"
                        && build.allocateSkillPoint("axe") === false
                        && pointHero.skillPoints === 2;
                    axeSkill.trainingMode = axeModeBefore;
                    const swordLevelBefore = Aethra.XPSystem.getSkillState("sword").level;
                    windowManager.openWindow("skills-view", { source: "integration-skill-points" });
                    const skillsLayer = document.querySelector("#ui3-root [data-ui3-window='skills-view']");
                    skillsLayer?.querySelector("[data-ui3-tab='journal'], [data-ui3-skills-tab='journal']")?.click();
                    skillsLayer?.querySelector("[data-ui3-skill-entry='sword']")?.click();
                    skillsLayer?.querySelector("[data-ui3-skill-point='sword']")?.click();
                    const swordAfter = Aethra.XPSystem.getSkillState("sword");
                    const spentByUi = swordAfter.level === swordLevelBefore + 1 && pointHero.skillPoints === 1;
                    windowManager.closeWindow("skills-view", { source: "integration-restore" });
                    skillPointWorks = noPoints && badgeShown && lockedRespected && spentByUi;
                    skillPointDetail = `sem pontos ${noPoints ? "recusa" : "aceita"} · contador ${badgeShown ? "na barra" : "ausente"} · XP pausado ${lockedRespected ? "respeitado" : "ignorado"} · espada Nv ${swordLevelBefore} → ${swordAfter.level} (${pointHero.skillPoints} restante)`;
                } finally {
                    pointHero.skillPoints = pointBackup.skillPoints;
                    pointHero.disciplines = pointBackup.disciplines;
                    pointHero.masteryInvestment = pointBackup.investment;
                    Aethra.Ui3TopBar?.render?.();
                }
                checks.push(createCheck("Ponto de habilidade sobe 1 nível pela janela de Habilidades", skillPointWorks, skillPointDetail));

                /*
                 * UI 3.0 — fase 5.2 (Oficinas). Ui3Navigation.openWorkshop abre a
                 * janela nova, que produz pelo CraftingSystem.
                 */
                const workshopViewBefore = Aethra.UIManager?.primaryView || "hunt";
                const workshopBagBefore = [...(Aethra.GameState.hero.bag || [])];
                if (Aethra.GameState.hunt?.isActive) Aethra.HuntSystem.stopHunt("integration-ui3-workshop");
                Aethra.UIManager?.setPrimaryView?.("city", { source: "integration-ui3-workshop" });
                Aethra.Ui3Navigation.openWorkshop("blacksmithing", { source: "integration-ui3-workshop" });
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
                    const noInterfaceChoice = !optionsLayer?.querySelector("[data-ui3-option-interface]");
                    optionsWorks = optionsOpen && speedSet && motionToggled && resetAsked && resetCancelled && noInterfaceChoice;
                    optionsDetail = `${optionsOpen ? "abriu" : "não abriu"} · velocidade ${speedSet ? "4×" : "inalterada"} · animações ${motionToggled ? "alternadas" : "iguais"} · apagar ${resetAsked && resetCancelled ? "pediu confirmação" : "sem confirmação"} · escolha de interface ${noInterfaceChoice ? "ausente" : "presente"}`;
                } finally {
                    Aethra.SaveManager.reset = optionsResetOriginal;
                    settings.setCombatSpeed(optionsSpeedBefore, { source: "integration-restore" });
                    settings.set("hud", optionsHudBefore, { source: "integration-restore" });
                }
                checks.push(createCheck("UI 3.0 Opções mudam preferências pelo dono e só apagam com confirmação", optionsWorks, optionsDetail));

                // UI 3.0 — fase 5.2 (Mural de Chefes): requisitos e recompensa vêm do BossSystem.
                Aethra.Ui3Navigation.openBosses({ source: "integration-ui3-bosses" });
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
                    Aethra.Ui3Navigation.openSpecialization(specProfessionId, { source: "integration-ui3-specialization" });
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
                const navigation = Aethra.Ui3Navigation;
                const mentorGuidanceOriginal = navigation.followQuestGuidance;
                const mentorTreeOriginal = navigation.openSpecialization;
                const mentorCalls = { guidance: [], tree: [] };
                navigation.followQuestGuidance = (guidance) => {
                    mentorCalls.guidance.push(guidance);
                    return true;
                };
                navigation.openSpecialization = (professionId) => {
                    mentorCalls.tree.push(professionId);
                    return true;
                };
                let mentorWorks = false;
                let mentorDetail = "";
                try {
                    navigation.openMentor({ source: "integration-ui3-mentor" });
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
                    navigation.followQuestGuidance = mentorGuidanceOriginal;
                    navigation.openSpecialization = mentorTreeOriginal;
                    windowManager.closeWindow("profession-mentor-view", { source: "integration-restore" });
                }
                checks.push(createCheck("UI 3.0 Mentora mostra a rota do herói e encaminha árvore e orientação", mentorWorks, mentorDetail));

                /*
                 * Ui3Navigation: a orientação de missão e de foco leva à janela certa,
                 * e a oficina só tem estação quando o herói está na Cidade.
                 */
                const navViewBefore = Aethra.UIManager?.primaryView || "hunt";
                if (Aethra.GameState.hunt?.isActive) Aethra.HuntSystem.stopHunt("integration-ui3-nav");
                let navWorks = false;
                let navDetail = "";
                {
                    navigation.followQuestGuidance({ action: "open-bosses" }, { source: "integration-ui3-nav" });
                    const navBosses = Aethra.Ui3BossesWindow?.isOpen?.() === true && Aethra.UIManager?.primaryView === "city";
                    windowManager.closeWindow("bosses-view", { source: "integration-restore" });
                    navigation.followQuestGuidance({ action: "something-new" }, { source: "integration-ui3-nav" });
                    const navQuests = Aethra.Ui3QuestsWindow?.isOpen?.() === true;
                    windowManager.closeWindow("quests-view", { source: "integration-restore" });
                    navigation.followDisciplineGuidance({ action: "open-workshop", professionId: "alchemy" }, { source: "integration-ui3-nav" });
                    const navWorkshop = Aethra.Ui3WorkshopWindow?.isOpen?.() === true
                        && Boolean(document.querySelector("#ui3-root [data-ui3-window='profession-workshop-view'] [data-ui3-workshop-profession='alchemy'][aria-pressed='true']"));
                    windowManager.closeWindow("profession-workshop-view", { source: "integration-restore" });
                    const stationRule = Aethra.CraftingGuidance.stationFor("alchemy", { inCity: true }) === "laboratory"
                        && Aethra.CraftingGuidance.stationFor("alchemy", { inCity: false }) === null;
                    navWorks = navBosses && navQuests && navWorkshop && stationRule;
                    navDetail = `chefes ${navBosses ? "ok" : "falhou"} · missões ${navQuests ? "ok" : "falhou"} · oficina ${navWorkshop ? "alquimia" : "errada"} · estação ${stationRule ? "só na Cidade" : "incoerente"}`;
                }
                Aethra.UIManager?.setPrimaryView?.(navViewBefore, { source: "integration-restore" });
                checks.push(createCheck("UI 3.0 navegação segue a orientação até a janela certa", navWorks, navDetail));

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

                // UI 3.0 — fase 5.2 (Cash): diamantes são moeda paga; comprar pede um segundo clique.
                const premiumBuyOriginal = marketplace.buyPremiumItem;
                const premiumCalls = [];
                marketplace.buyPremiumItem = (...args) => {
                    premiumCalls.push(args);
                    return false;
                };
                const premiumHero = Aethra.GameState.hero;
                const premiumDiamondsBefore = premiumHero.diamonds;
                let premiumWorks = false;
                let premiumDetail = "";
                try {
                    const premiumItem = marketplace.getPremiumCatalog()[0];
                    premiumHero.diamonds = Number(premiumItem?.diamondPrice || 0) + 1;
                    windowManager.openWindow("premium-shop-view", { source: "integration-ui3-premium" });
                    const premiumLayer = document.querySelector("#ui3-root [data-ui3-window='premium-shop-view']");
                    const premiumOpen = Aethra.Ui3PremiumShopWindow?.isOpen?.() === true;
                    const premiumRows = premiumLayer?.querySelectorAll("[data-ui3-premium-item]").length || 0;
                    premiumLayer?.querySelector(`[data-ui3-premium-item='${premiumItem?.id}']`)?.click();
                    premiumLayer?.querySelector("[data-ui3-premium-buy]")?.click();
                    const premiumAsked = premiumCalls.length === 0 && /confirmar/i.test(premiumLayer?.querySelector("[data-ui3-premium-buy]")?.textContent || "");
                    premiumLayer?.querySelector("[data-ui3-premium-buy]")?.click();
                    const premiumRouted = premiumCalls.length === 1 && premiumCalls[0][0] === premiumItem?.id;
                    premiumWorks = premiumOpen && premiumRows === marketplace.getPremiumCatalog().length && premiumAsked && premiumRouted;
                    premiumDetail = `${premiumOpen ? "janela nova" : "janela errada"} · ${premiumRows} itens · ${premiumAsked ? "pediu confirmação" : "sem confirmação"} · ${premiumRouted ? "delegou ao MarketplaceSystem" : "não delegou"}`;
                } finally {
                    marketplace.buyPremiumItem = premiumBuyOriginal;
                    premiumHero.diamonds = premiumDiamondsBefore;
                    windowManager.closeWindow("premium-shop-view", { source: "integration-restore" });
                }
                checks.push(createCheck("UI 3.0 Loja de Diamantes confirma a compra e delega ao MarketplaceSystem", premiumWorks, premiumDetail));

                /*
                 * UI 3.0 — fase 5.3 (Automação). Cada ajuste vai ao IdleLoopSystem na
                 * hora; o uso automático vira política do ConsumableSystem.
                 */
                const idleSystem = Aethra.IdleLoopSystem;
                const idleBefore = JSON.parse(JSON.stringify(Aethra.GameState.idleLoop || {}));
                const policyBefore = JSON.parse(JSON.stringify(Aethra.ConsumableSystem?.ensurePolicy?.() || {}));
                const idlePurchaseOriginal = idleSystem.purchaseSupplies;
                const idlePurchases = [];
                idleSystem.purchaseSupplies = (requests, options) => {
                    idlePurchases.push({ requests: { ...requests }, options });
                    return { purchased: 0, cost: 0, items: [], reason: "INSUFFICIENT_BUDGET" };
                };
                let automationWorks = false;
                let automationDetail = "";
                try {
                    windowManager.openWindow("automation-view", { source: "integration-ui3-automation" });
                    const autoLayer = document.querySelector("#ui3-root [data-ui3-window='automation-view']");
                    const autoOpen = Aethra.Ui3AutomationWindow?.isOpen?.() === true;
                    const autoSellBefore = idleSystem.config.autoSell;
                    autoLayer?.querySelector("[data-ui3-auto-setting='autoSell']")?.click();
                    const autoSellToggled = idleSystem.config.autoSell === !autoSellBefore;
                    const targetInput = autoLayer?.querySelector("[data-ui3-auto-rule='target'][data-supply='potion_health']");
                    if (targetInput) {
                        targetInput.value = "9";
                        targetInput.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                    const targetSaved = idleSystem.getSnapshot().supplyPlan.potion_health.target === 9;
                    const useToggle = autoLayer?.querySelector("[data-ui3-auto-use='potion_mana']");
                    const manaUseBefore = idleSystem.getSupplyOverview().supplies.find((supply) => supply.id === "potion_mana").autoUse.enabled;
                    useToggle?.click();
                    const policyAfter = Aethra.ConsumableSystem.ensurePolicy();
                    const manaUseToggled = (policyAfter.manaItemId === "potion_mana" && policyAfter.enabled !== false) === !manaUseBefore;
                    autoLayer?.querySelector("[data-ui3-auto-order='potion_health'][data-delta='1']")?.click();
                    autoLayer?.querySelector("[data-ui3-auto-order='potion_health'][data-delta='1']")?.click();
                    const buyButton = autoLayer?.querySelector("[data-ui3-auto-buy]");
                    if (buyButton) buyButton.disabled = false;
                    buyButton?.click();
                    const orderRouted = idlePurchases.length === 1 && idlePurchases[0].requests.potion_health === 2;
                    const overview = idleSystem.getSupplyOverview();
                    const overviewOk = overview.supplies.length === idleSystem.supplies.length
                        && overview.supplies.find((supply) => supply.id === "potion_health").rule.target === 9
                        && typeof overview.summary.restockReady === "boolean";
                    automationWorks = autoOpen && autoSellToggled && targetSaved && manaUseToggled && orderRouted && overviewOk;
                    automationDetail = `${autoOpen ? "janela nova" : "janela errada"} · auto-venda ${autoSellToggled ? "alternou" : "parada"} · meta ${targetSaved ? "salva" : "ignorada"} · uso de mana ${manaUseToggled ? "alternou" : "parado"} · pedido ${orderRouted ? "encaminhado" : "perdido"} · leitura ${overviewOk ? "coerente" : "incoerente"}`;
                } finally {
                    idleSystem.purchaseSupplies = idlePurchaseOriginal;
                    Aethra.GameState.idleLoop = idleBefore;
                    Aethra.ConsumableSystem?.configure?.(policyBefore);
                    windowManager.closeWindow("automation-view", { source: "integration-restore" });
                }
                checks.push(createCheck("UI 3.0 Automação ajusta o IdleLoopSystem e a política de consumíveis", automationWorks, automationDetail));

                /*
                 * UI 3.0 — fase 5.3 (save compartilhado). Indicador na carteira e
                 * aviso na raiz 3.0; a versão clássica fica muda. Publicar passa
                 * pelo SaveManager.
                 */
                const saveManager = Aethra.SaveManager;
                const publishOriginal = saveManager.publishShared;
                const publishCalls = [];
                saveManager.publishShared = async (reason) => {
                    publishCalls.push(reason);
                    return true;
                };
                let saveStatusWorks = false;
                let saveStatusDetail = "";
                try {
                    Aethra.Ui3TopBar?.render?.();
                    const chip = document.querySelector("#ui3-root .ui3-topbar [data-ui3-save-chip]");
                    const chipShown = Boolean(chip) && chip.textContent.length > 0;
                    Aethra.EventBus.emit("save:shared-empty", { profile: "principal", supported: true, exists: false });
                    const toast = document.querySelector("#ui3-root .ui3-toast");
                    const publishOffered = Boolean(toast?.querySelector("[data-ui3-save-publish]")) && toast?.hidden === false;
                    toast?.querySelector("[data-ui3-save-publish]")?.click();
                    const published = publishOffered && publishCalls.length === 1 && publishCalls[0] === "select-canonical-save";
                    Aethra.EventBus.emit("save:shared-conflict", {});
                    const conflictShown = toast?.hidden === false && toast.classList.contains("is-warning");
                    const classicBanner = document.getElementById("aethra-shared-save-banner");
                    const classicQuiet = !classicBanner || classicBanner.hidden === true;
                    toast?.querySelector("[data-ui3-save-dismiss]")?.click();
                    const dismissed = toast?.hidden === true;
                    saveStatusWorks = chipShown && conflictShown && classicQuiet && dismissed && published;
                    saveStatusDetail = `indicador ${chipShown ? `"${chip.textContent.trim()}"` : "ausente"} · conflito ${conflictShown ? "avisado" : "mudo"} · clássica ${classicQuiet ? "muda" : "duplicada"} · fechar ${dismissed ? "ok" : "falhou"} · publicar ${published ? "pelo SaveManager" : "falhou"}`;
                } finally {
                    saveManager.publishShared = publishOriginal;
                    Aethra.Ui3SaveStatus?.hide?.();
                }
                checks.push(createCheck("UI 3.0 mostra o save compartilhado e publica pelo SaveManager", saveStatusWorks, saveStatusDetail));

                /*
                 * A Automação roda ao fim de cada andar: o evento real é
                 * hunt:stairs-reached (o antigo tilemap:floor-cleared não existia mais,
                 * e as poções só eram repostas ao encerrar a caçada).
                 */
                const cycleIdle = Aethra.IdleLoopSystem;
                const cycleBefore = JSON.parse(JSON.stringify(Aethra.GameState.idleLoop || {}));
                // Sem vender nem comprar: só o ciclo conta.
                Object.assign(cycleIdle.config, { enabled: true, autoSell: false, autoRestock: false });
                const cyclesBefore = cycleIdle.config.cyclesCompleted;
                Aethra.EventBus.emit("hunt:stairs-reached", { huntId: "whispering_forest", room: 1 });
                const floorCycles = cycleIdle.config.cyclesCompleted - cyclesBefore;
                // Ao partir, a reposição roda (o herói não sai sem poções depois de morrer).
                Aethra.GameState.idleLoop = cycleBefore;
                const restockSpy = [];
                Aethra.EventBus.on("idle-loop:restocked", (payload) => restockSpy.push(payload));
                const departHero = Aethra.GameState.hero;
                const departBag = departHero.bag;
                const departGold = departHero.gold;
                departHero.bag = departBag.filter((item) => (item?.templateId || item?.id) !== "potion_health");
                departHero.gold = 500;
                Object.assign(cycleIdle.config, { enabled: true, autoRestock: true, goldReserve: 0, maxRestockSpend: 0 });
                Aethra.EventBus.emit("hunt:started", { huntId: "integration_depart", hunt: { name: "Teste" } });
                const restockedOnDepart = restockSpy.some((payload) => payload.items?.some((line) => line.itemId === "potion_health"));
                departHero.bag = departBag;
                departHero.gold = departGold;
                Aethra.GameState.idleLoop = cycleBefore;
                checks.push(createCheck(
                    "Automação repõe suprimentos ao fim de cada andar e ao partir",
                    floorCycles === 1 && restockedOnDepart,
                    `${floorCycles} ciclo(s) ao limpar o andar · ao partir ${restockedOnDepart ? "repôs Poção de Vida" : "não repôs"}`
                ));

                /*
                 * A auto-venda guarda insumo das Oficinas (a armadura vem da Forja e
                 * do Curtume): minério de loot fica, retalho de pano é vendido. A
                 * janela de Automação desliga a regra.
                 */
                const keepIdle = Aethra.IdleLoopSystem;
                const keepBefore = JSON.parse(JSON.stringify(Aethra.GameState.idleLoop || {}));
                let keepWorks = false;
                let keepDetail = "";
                try {
                    Object.assign(keepIdle.config, { enabled: true, autoSell: true, keepCraftingMaterials: true });
                    const oreLoot = { templateId: "iron_ore", type: "material", source: "hunt-loot" };
                    const scrapLoot = { templateId: "cloth_scrap", type: "material", source: "hunt-loot" };
                    const oreKept = keepIdle.isAutoSellEligible(oreLoot) === false;
                    const scrapSold = keepIdle.isAutoSellEligible(scrapLoot) === true;
                    windowManager.openWindow("automation-view", { source: "integration-keep-materials" });
                    document.querySelector("#ui3-root [data-ui3-window='automation-view'] [data-ui3-auto-setting='keepCraftingMaterials']")?.click();
                    const toggledOff = keepIdle.config.keepCraftingMaterials === false && keepIdle.isAutoSellEligible(oreLoot) === true;
                    windowManager.closeWindow("automation-view", { source: "integration-restore" });
                    keepWorks = oreKept && scrapSold && toggledOff;
                    keepDetail = `minério ${oreKept ? "guardado" : "vendido"} · retalho ${scrapSold ? "vendido" : "guardado"} · opção ${toggledOff ? "desliga pela janela" : "sem efeito"}`;
                } finally {
                    Aethra.GameState.idleLoop = keepBefore;
                }
                checks.push(createCheck("Auto-venda guarda materiais das Oficinas", keepWorks, keepDetail));

                /*
                 * Com a expedição parada, o painel da Hunt mostra o próximo passo da
                 * missão (antes só aparecia durante a caçada, e depois de "A Linha
                 * Goblin" o jogador só via "Iniciar expedição").
                 */
                const questSystem = Aethra.QuestSystem;
                const questStubs = { tracked: questSystem.getTrackedQuest, guidance: questSystem.getGuidance, follow: Aethra.Ui3Navigation?.followQuestGuidance };
                const idleHunt = Aethra.GameState.hunt;
                const idleActiveBefore = idleHunt.isActive;
                const viewBefore = Aethra.UIManager?.primaryView;
                const followed = [];
                let idleQuestShown = false;
                let idleQuestFollowed = false;
                let idleQuestHiddenHere = false;
                try {
                    const bossGuidance = { action: "open-bosses", actionLabel: "Desafiar Lobo Alfa", target: "alpha_wolf", objective: { label: "Derrote o Lobo Alfa", progress: 0, required: 1 } };
                    let guidanceNow = bossGuidance;
                    questSystem.getTrackedQuest = () => ({ id: "integration_idle_quest", title: "O Alfa dos Sussurros" });
                    questSystem.getGuidance = () => guidanceNow;
                    if (Aethra.Ui3Navigation) Aethra.Ui3Navigation.followQuestGuidance = (guidance) => { followed.push(guidance); return true; };
                    idleHunt.isActive = false;
                    withUi3Game(() => {
                        Aethra.UIManager?.setPrimaryView?.("hunt");
                        Aethra.Ui3HuntScreen.sync();
                        Aethra.Ui3HuntScreen.render();
                        const button = document.querySelector("#ui3-root .ui3-hunt [data-ui3-hunt-quest]");
                        idleQuestShown = /Desafiar Lobo Alfa/.test(button?.textContent || "");
                        button?.click();
                        idleQuestFollowed = followed[0]?.action === "open-bosses";
                        guidanceNow = { action: "focus-hunt", actionLabel: "Caçar", objective: { label: "Derrote lobos", progress: 0, required: 5 } };
                        Aethra.Ui3HuntScreen.render();
                        idleQuestHiddenHere = !document.querySelector("#ui3-root .ui3-hunt [data-ui3-hunt-quest]")
                            && /Derrote lobos/.test(document.querySelector("#ui3-root .ui3-hunt-quest")?.textContent || "");
                    });
                } finally {
                    questSystem.getTrackedQuest = questStubs.tracked;
                    questSystem.getGuidance = questStubs.guidance;
                    if (Aethra.Ui3Navigation) Aethra.Ui3Navigation.followQuestGuidance = questStubs.follow;
                    idleHunt.isActive = idleActiveBefore;
                    if (viewBefore) Aethra.UIManager?.setPrimaryView?.(viewBefore);
                    Aethra.Ui3HuntScreen?.render?.();
                }
                checks.push(createCheck(
                    "Hunt parada mostra o próximo passo da missão",
                    idleQuestShown && idleQuestFollowed && idleQuestHiddenHere,
                    `botão ${idleQuestShown ? "Desafiar Lobo Alfa" : "ausente"} · clique ${idleQuestFollowed ? "segue a orientação" : "perdido"} · passo na própria caçada ${idleQuestHiddenHere ? "sem botão" : "errado"}`
                ));

                // Registro em português e no andar final a escada conclui a expedição.
                const rewardText = Aethra.BattleLogger.formatRewardMessage("Lobo", { xp: 5, gold: 0, lootCount: 2 });
                const finalHunt = Aethra.GameState.hunt;
                const finalBackup = { isActive: finalHunt.isActive, currentRoom: finalHunt.currentRoom, huntId: finalHunt.huntId };
                const idleEnabledBefore = Aethra.GameState.idleLoop?.enabled;
                let finalLog = "";
                try {
                    if (Aethra.GameState.idleLoop) Aethra.GameState.idleLoop.enabled = false;
                    finalHunt.isActive = true;
                    finalHunt.huntId = finalHunt.huntId || "whispering_forest";
                    finalHunt.currentRoom = Aethra.HuntSystem.getStairsState().maxRooms;
                    Aethra.EventBus.emit("hunt:stairs-reached", { huntId: finalHunt.huntId, room: finalHunt.currentRoom });
                    finalLog = Aethra.Ui3HuntScreen?.getLog?.().slice(-1)[0]?.text || "";
                } finally {
                    Object.assign(finalHunt, finalBackup);
                    if (Aethra.GameState.idleLoop) Aethra.GameState.idleLoop.enabled = idleEnabledBefore;
                }
                checks.push(createCheck(
                    "Registro diz 2 itens e o andar final pede para concluir",
                    /2 itens de loot/.test(rewardText) && /conclua a expedição/.test(finalLog),
                    `${rewardText} · ${finalLog || "sem registro"}`
                ));

                // UI 3.0 — fase 5.2 (Social): só o mercador está disponível offline e leva à Loja.
                windowManager.openWindow("social-view", { source: "integration-ui3-social" });
                const socialLayer = document.querySelector("#ui3-root [data-ui3-window='social-view']");
                const socialOpen = Aethra.Ui3SocialWindow?.isOpen?.() === true;
                const socialEnabled = [...(socialLayer?.querySelectorAll("[data-ui3-social]") || [])]
                    .filter((button) => !button.disabled)
                    .map((button) => button.dataset.ui3Social);
                socialLayer?.querySelector("[data-ui3-social='merchant']")?.click();
                const socialOpensShop = Aethra.Ui3ShopWindow?.isOpen?.() === true;
                windowManager.closeWindow("npc-shop-view", { source: "integration-restore" });
                windowManager.closeWindow("social-view", { source: "integration-restore" });
                checks.push(
                    createCheck(
                        "UI 3.0 Social mostra só o que funciona offline e leva ao mercador",
                        socialOpen && socialEnabled.join(",") === "merchant" && socialOpensShop,
                        `${socialOpen ? "janela nova" : "janela errada"} · ativos: ${socialEnabled.join(", ") || "nenhum"} · ${socialOpensShop ? "abriu a Loja" : "não abriu a Loja"}`
                    )
                );

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

                // HuntSystem fecha rotas acima do nível do herói e encerra a luta ao parar.
                const heroLevelNow = Math.max(1, Number(Aethra.GameState.hero?.level || 1));
                const lockedHunt = Object.values(Aethra.HuntSystem.hunts || {})
                    .find((definition) => Number(definition?.minLevel || 1) > heroLevelNow);
                const lockedEvents = [];
                const stopLocked = Aethra.EventBus.on("hunt:locked", (payload) => lockedEvents.push(payload));
                const lockedStart = lockedHunt ? Aethra.HuntSystem.startHunt(lockedHunt.id, { source: "integration-locked" }) : null;
                if (typeof stopLocked === "function") stopLocked();
                const combatStopsBefore = [];
                const originalStopCombat = Aethra.BattleSystem.stopCombat;
                Aethra.BattleSystem.stopCombat = function (...args) {
                    combatStopsBefore.push(args[0]);
                    return originalStopCombat.apply(this, args);
                };
                try {
                    Aethra.HuntSystem.stopHunt("integration-stop-combat");
                } finally {
                    Aethra.BattleSystem.stopCombat = originalStopCombat;
                }
                const lockWorks = Boolean(lockedHunt)
                    && lockedStart === false
                    && lockedEvents.length === 1
                    && lockedEvents[0].huntId === lockedHunt.id
                    && lockedEvents[0].heroLevel === heroLevelNow;
                checks.push(
                    createCheck(
                        "HuntSystem fecha rotas acima do nível e encerra a luta ao parar",
                        lockWorks && combatStopsBefore.includes("hunt-stopped"),
                        `${lockedHunt ? `${lockedHunt.name} (Nv ${lockedHunt.minLevel})` : "nenhuma rota acima do nível"} ${lockedStart === false ? "recusada" : "aberta"} · parar ${combatStopsBefore.includes("hunt-stopped") ? "encerra a luta" : "não encerra"}`
                    )
                );

                /*
                 * UI 3.0 — fase 4 (Mapa-Mundi). Ui3Navigation.openHuntMap abre a
                 * janela nova; a caçada focada começa pelo HuntAtlas.
                 */
                const atlasViewBefore = Aethra.UIManager?.primaryView || "hunt";
                Aethra.Ui3Navigation.openHuntMap({ source: "integration-ui3-atlas", mode: "expeditions" });
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

                Aethra.GameState.hero.characterCreated = createdBefore;

                checks.push(
                    createCheck(
                        "UI 3.0 Cidade devolve o mapa ao sair da Hunt",
                        cityReleasesCanvas,
                        `cidade ${cityReleasesCanvas ? "liberou o mapa" : "prendeu o mapa"}`
                    )
                );

                /*
                 * UI 3.0 — fase 4 (Tela de título). Segura as telas de jogo,
                 * "Novo herói" só apaga depois da confirmação e "Continuar"
                 * devolve o jogo.
                 */
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

                /*
                 * UI 3.0 — fase 4 (Criação). Última verificação da suíte: criar
                 * um herói reinicia a progressão. A tela nova assume
                 * a criação quando não há herói, recusa nome curto e cria pelo
                 * CharacterBuildSystem.
                 */
                Aethra.GameState.hero.characterCreated = false;
                Aethra.Ui3CreationScreen?.sync?.();
                const creationScreen = document.querySelector("#ui3-root [data-ui3-screen='creation']");
                const creationShown = Aethra.Ui3CreationScreen?.isVisible?.() === true;
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
