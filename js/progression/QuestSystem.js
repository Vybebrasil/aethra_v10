// QuestSystem.js - contrato, progressão, recompensas e orientação das missões.
(function initQuestSystem(Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus || !Aethra.GameData) {
        throw new Error("QuestSystem.js requer game-core.js e GameData.js.");
    }

    const CONTRACT_VERSION = 3;
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const number = (value, fallback = 0) => Number.isFinite(Number(value))
        ? Number(value)
        : fallback;

    function ensureQuestState() {
        const state = Aethra.GameState;
        state.quests = state.quests && typeof state.quests === "object"
            ? state.quests
            : {};
        if (!Array.isArray(state.quests.active)) state.quests.active = [];
        if (!Array.isArray(state.quests.completed)) state.quests.completed = [];
        if (!Array.isArray(state.quests.available)) state.quests.available = [];
        if (!Array.isArray(state.quests.rewardClaims)) state.quests.rewardClaims = [];
        return state.quests;
    }

    function inferObjectiveType(objective = {}) {
        if (objective.type) return String(objective.type);
        const hint = `${objective.id || ""} ${objective.label || objective.text || ""}`.toLowerCase();
        if (hint.includes("start_hunt") || hint.includes("iniciar") && hint.includes("caçad")) return "StartHunt";
        if (hint.includes("defeat") || hint.includes("derrot") || hint.includes("abater")) return "DefeatEnemy";
        if (hint.includes("colet") || hint.includes("adquir") || hint.includes("item")) return "ItemAcquired";
        if (hint.includes("falar") || hint.includes("npc")) return "TalkToNPC";
        return "Custom";
    }

    function inferObjectiveTarget(objective, type) {
        if (objective?.target != null && String(objective.target).trim()) {
            return String(objective.target);
        }
        if (type === "StartHunt") return "whispering_forest";
        if (type === "DefeatEnemy") return "forest_wolf";
        return String(objective?.id || type || "objective");
    }

    function normalizeObjective(questId, objective = {}, index = 0) {
        const type = inferObjectiveType(objective);
        const target = inferObjectiveTarget(objective, type);
        const required = Math.max(1, Math.floor(number(objective.required, 1)));
        const rawProgress = objective.progress ?? objective.current ?? 0;
        const progress = Math.min(required, Math.max(0, number(rawProgress, 0)));
        const completed = Boolean(objective.completed) || progress >= required;

        return {
            ...clone(objective),
            id: String(objective.id || `${questId}_objective_${index}`),
            type,
            target,
            label: String(objective.label || objective.text || target || type),
            required,
            progress: completed ? required : progress,
            completed
        };
    }

    function normalizeReward(definition = {}) {
        const source = definition.reward && typeof definition.reward === "object"
            ? definition.reward
            : definition.rewards && typeof definition.rewards === "object"
                ? definition.rewards
                : {};
        const items = Array.isArray(source.items)
            ? source.items
                .map((entry) => typeof entry === "string"
                    ? { templateId: entry, quantity: 1 }
                    : {
                        templateId: String(entry?.templateId || entry?.id || ""),
                        quantity: Math.max(1, Math.floor(number(entry?.quantity, 1)))
                    })
                .filter((entry) => entry.templateId)
            : [];

        if (source.item && typeof source.item === "string") {
            const byName = Object.entries(Aethra.GameData.items || {}).find(([, item]) => {
                return String(item?.name || "").toLocaleLowerCase("pt-BR") === source.item.toLocaleLowerCase("pt-BR");
            });
            if (byName && !items.some((entry) => entry.templateId === byName[0])) {
                items.push({ templateId: byName[0], quantity: 1 });
            }
        }

        return {
            xp: Math.max(0, Math.floor(number(source.xp, 0))),
            gold: Math.max(0, Math.floor(number(source.gold, 0))),
            items
        };
    }

    function normalizeDefinition(questId, definition = {}) {
        const id = String(questId || definition.id || "").trim();
        if (!id) return null;

        return {
            ...clone(definition),
            id,
            title: String(definition.title || definition.name || `Missão ${id}`),
            description: String(definition.description || definition.summary || ""),
            levelReq: Math.max(1, Math.floor(number(definition.levelReq, 1))),
            objectives: (Array.isArray(definition.objectives) ? definition.objectives : [])
                .map((objective, index) => normalizeObjective(id, objective, index)),
            reward: normalizeReward(definition),
            nextQuestId: definition.nextQuestId ? String(definition.nextQuestId) : null
        };
    }

    function validateDefinition(definition) {
        return Boolean(
            definition?.id &&
            definition?.title &&
            Array.isArray(definition.objectives) &&
            definition.objectives.length > 0 &&
            definition.objectives.every((objective) => {
                return objective.id && objective.type && objective.target && objective.label && objective.required > 0;
            }) &&
            definition.reward &&
            Array.isArray(definition.reward.items)
        );
    }

    function normalizedTarget(type, target) {
        if (type === "DefeatEnemy" && Aethra.MonsterCatalog?.resolveId) {
            return String(Aethra.MonsterCatalog.resolveId(target) || target || "");
        }
        return String(target || "");
    }

    function targetsMatch(type, expected, actual) {
        return normalizedTarget(type, expected) === normalizedTarget(type, actual);
    }

    function progressTotals(quest) {
        return (quest?.objectives || []).reduce((totals, objective) => {
            totals.progress += Math.min(number(objective.progress), number(objective.required, 1));
            totals.required += Math.max(1, number(objective.required, 1));
            return totals;
        }, { progress: 0, required: 0 });
    }

    Aethra.QuestSystem = {
        CONTRACT_VERSION,
        initialized: false,
        processedItemInstances: new Set(),

        init() {
            if (this.initialized) return this.getState();

            this.bindEvents();
            this.repairState({ emit: false, save: false });
            const state = ensureQuestState();
            const routeQuestIds = Object.keys(Aethra.ProfessionSystem?.introPaths || {})
                .map((professionId) => `intro_profession_${professionId}`);
            const hasModernProfessionStep = ["tutorial_profession_mentor", ...routeQuestIds]
                .some((questId) => state.active.some((quest) => quest.id === questId)
                    || state.completed.some((quest) => quest.id === questId));
            const completedLegacyCraft = state.completed.some((quest) => quest.id === "tutorial_apprentice_craft");
            if (
                Aethra.GameState.hero?.characterCreated
                && state.completed.some((quest) => quest.id === "tutorial_first_hunt")
                && !hasModernProfessionStep
                && !completedLegacyCraft
            ) {
                this.acceptQuest("tutorial_profession_mentor");
                this.trackQuest("tutorial_profession_mentor", { save: false });
            }
            const activeIntroQuest = state.active.find((quest) => String(quest.id || "").startsWith("intro_profession_"));
            if (activeIntroQuest) {
                Aethra.ProfessionSystem?.activateIntroPath?.(
                    activeIntroQuest.id.replace("intro_profession_", "")
                );
            }

            if (
                state.active.length === 0 &&
                state.completed.length === 0 &&
                Aethra.GameState.hero?.characterCreated
            ) {
                const firstQuestId = Aethra.GameData.quests?.tutorial_first_steps
                    ? "tutorial_first_steps"
                    : Object.keys(Aethra.GameData.quests || {})[0];
                if (firstQuestId) this.acceptQuest(firstQuestId);
            }

            Aethra.ProfessionSystem?.reconcileIntroPerks?.();

            this.initialized = true;
            this.repairState({ emit: true, save: true });
            Aethra.EventBus.emit("quest:ready", this.getState());
            return this.getState();
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            Aethra.EventBus.on("EnemyDefeated", (data = {}) => {
                const enemyId = data.enemyId || data.id || data.enemy?.id;
                if (enemyId) this.updateProgress("DefeatEnemy", enemyId, 1, data);
                const huntId = data.huntId || data.state?.huntId || Aethra.GameState.hunt?.huntId;
                if (huntId) this.updateProgress("DefeatInHunt", huntId, 1, data);
            });
            Aethra.EventBus.on("hunt:started", (data = {}) => {
                const huntId = data.huntId || data.state?.huntId || data.id;
                if (huntId) this.updateProgress("StartHunt", huntId, 1, data);
            });
            Aethra.EventBus.on("ItemAcquired", (data) => this.handleItemsAcquired(data, "ItemAcquired"));
            Aethra.EventBus.on("itemObtained", (data) => this.handleItemsAcquired(data, "itemObtained"));
            Aethra.EventBus.on("exploration:resource-collected", (data = {}) => {
                if (data.item) this.handleItemsAcquired(data.item, "exploration:resource-collected");
            });
            Aethra.EventBus.on("exploration:event-resolved", (data = {}) => {
                this.handleItemsAcquired(data.rewards?.items || [], "exploration:event-resolved");
            });
            Aethra.EventBus.on("crafting:completed", (data = {}) => {
                if (data.recipeId) this.updateProgress("CraftRecipe", data.recipeId, Math.max(1, number(data.batches, 1)), data);
                this.handleItemsAcquired(data.outputs || [], "crafting:completed");
            });
            Aethra.EventBus.on("NPCInteracted", (data = {}) => {
                const npcId = data.npcId || data.id || data.npc?.id;
                if (npcId) this.updateProgress("TalkToNPC", npcId, 1, data);
            });
            Aethra.EventBus.on("ZoneEntered", (data = {}) => {
                const zoneId = data.zoneId || data.id || data.location;
                if (zoneId) this.updateProgress("EnterZone", zoneId, 1, data);
            });
            Aethra.EventBus.on("state:replaced", () => {
                this.repairState({ emit: true, save: false });
            });
        },

        getDefinition(questId) {
            let definition = Aethra.GameData.quests?.[questId] || null;
            if (questId === "tutorial_apprentice_craft" && Aethra.GameState.hero?.introProfessionId) {
                definition = Aethra.ProfessionSystem?.getIntroQuestDefinition?.(
                    Aethra.GameState.hero.introProfessionId
                ) || definition;
            }
            if (!definition && String(questId).startsWith("intro_profession_")) {
                const professionId = String(questId).replace("intro_profession_", "");
                definition = Aethra.ProfessionSystem?.getIntroQuestDefinition?.(professionId) || null;
            }
            return definition ? normalizeDefinition(questId, definition) : null;
        },

        validateDefinition(definition, questId = definition?.id) {
            return validateDefinition(normalizeDefinition(questId, definition));
        },

        repairRuntimeQuest(rawQuest, status) {
            if (!rawQuest?.id) return null;
            const canonical = this.getDefinition(rawQuest.id) || normalizeDefinition(rawQuest.id, rawQuest);
            if (!canonical || !validateDefinition(canonical)) return null;
            const previousObjectives = Array.isArray(rawQuest.objectives) ? rawQuest.objectives : [];
            const objectives = canonical.objectives.map((objective, index) => {
                const previous = previousObjectives.find((entry) => entry?.id === objective.id)
                    || previousObjectives.find((entry) => {
                        const previousType = inferObjectiveType(entry);
                        return previousType === objective.type && targetsMatch(objective.type, inferObjectiveTarget(entry, previousType), objective.target);
                    })
                    || (previousObjectives[index]?.type == null && previousObjectives[index]?.target == null
                        ? previousObjectives[index]
                        : null)
                    || {};
                const rawProgress = previous.progress ?? previous.current ?? objective.progress ?? 0;
                const wasCompleted = Boolean(previous.completed) || status === "completed";
                const progress = wasCompleted
                    ? objective.required
                    : Math.min(objective.required, Math.max(0, number(rawProgress, 0)));
                return {
                    ...objective,
                    progress,
                    completed: progress >= objective.required
                };
            });

            return {
                ...canonical,
                status,
                acceptedAt: number(rawQuest.acceptedAt, Date.now()),
                completedAt: status === "completed" ? number(rawQuest.completedAt, Date.now()) : null,
                rewardClaimed: status === "completed" ? rawQuest.rewardClaimed !== false : Boolean(rawQuest.rewardClaimed),
                rewardedAt: rawQuest.rewardedAt || null,
                rewardResult: rawQuest.rewardResult ? clone(rawQuest.rewardResult) : null,
                objectives
            };
        },

        repairState(options = {}) {
            const state = ensureQuestState();
            const before = JSON.stringify({ quests: state, trackedQuestId: Aethra.GameState.ui?.trackedQuestId || null });
            const completed = [];
            const completedIds = new Set();

            state.completed.forEach((rawQuest) => {
                const repaired = this.repairRuntimeQuest(rawQuest, "completed");
                if (!repaired || completedIds.has(repaired.id)) return;
                repaired.rewardClaimed = true;
                completedIds.add(repaired.id);
                completed.push(repaired);
            });

            const active = [];
            const activeIds = new Set();
            state.active.forEach((rawQuest) => {
                const introProfessionId = Aethra.GameState.hero?.introProfessionId;
                const migratedQuest = rawQuest?.id === "tutorial_apprentice_craft" && introProfessionId
                    ? { ...rawQuest, id: `intro_profession_${introProfessionId}` }
                    : rawQuest;
                const repaired = this.repairRuntimeQuest(migratedQuest, "active");
                if (!repaired || completedIds.has(repaired.id) || activeIds.has(repaired.id)) return;
                activeIds.add(repaired.id);
                active.push(repaired);
            });

            const registeredIds = Object.keys(Aethra.GameData.quests || {});
            const legacyAvailable = state.available.filter((questId) => this.getDefinition(questId));
            state.active = active;
            state.completed = completed;
            state.available = [...new Set([...registeredIds, ...legacyAvailable])]
                .filter((questId) => !activeIds.has(questId) && !completedIds.has(questId));
            state.rewardClaims = [...new Set([
                ...state.rewardClaims.map(String),
                ...completed.map((quest) => quest.id)
            ])];
            state.contractVersion = CONTRACT_VERSION;

            Aethra.GameState.ui = Aethra.GameState.ui || {};
            const trackedId = Aethra.GameState.ui.trackedQuestId;
            if (!activeIds.has(trackedId)) {
                Aethra.GameState.ui.trackedQuestId = active[0]?.id || null;
            }

            const changed = before !== JSON.stringify({ quests: state, trackedQuestId: Aethra.GameState.ui.trackedQuestId || null });
            if (changed && options.emit !== false) {
                Aethra.EventBus.emit("quest:state-repaired", {
                    contractVersion: CONTRACT_VERSION,
                    active: active.length,
                    completed: completed.length,
                    trackedQuestId: Aethra.GameState.ui.trackedQuestId
                });
            }
            if (changed && options.save !== false) this.save("quest-contract-migration");
            return { changed, ...this.getState() };
        },

        acceptQuest(questId) {
            const state = ensureQuestState();
            const definition = this.getDefinition(questId);
            if (!definition || !validateDefinition(definition)) {
                Aethra.EventBus.emit("quest:error", {
                    operation: "acceptQuest",
                    questId,
                    reason: "Missão ausente ou fora do contrato oficial."
                });
                return null;
            }

            const existing = state.active.find((quest) => quest.id === questId)
                || state.completed.find((quest) => quest.id === questId);
            if (existing) return existing;

            const quest = this.repairRuntimeQuest({
                ...definition,
                acceptedAt: Date.now()
            }, "active");
            state.active.push(quest);
            state.available = state.available.filter((id) => id !== questId);

            if (!this.getTrackedQuest()) {
                Aethra.GameState.ui = Aethra.GameState.ui || {};
                Aethra.GameState.ui.trackedQuestId = questId;
            }

            Aethra.EventBus.emit("QuestAccepted", clone(quest));
            Aethra.EventBus.emit("quest:accepted", clone(quest));
            this.save("quest-accepted");
            return quest;
        },

        handleItemsAcquired(data, sourceEvent) {
            const items = Array.isArray(data)
                ? data
                : Array.isArray(data?.items)
                    ? data.items
                    : data && typeof data === "object"
                        ? [data]
                        : [];

            items.forEach((item) => {
                const instanceId = item?.instanceId;
                if (instanceId && this.processedItemInstances.has(instanceId)) return;
                if (instanceId) {
                    this.processedItemInstances.add(instanceId);
                    if (this.processedItemInstances.size > 5000) {
                        this.processedItemInstances.clear();
                        this.processedItemInstances.add(instanceId);
                    }
                }
                const itemId = item?.templateId || item?.itemId || item?.id;
                if (!itemId) return;
                this.updateProgress("ItemAcquired", itemId, Math.max(1, number(item.quantity || item.amount, 1)), {
                    sourceEvent,
                    item
                });
            });
        },

        updateProgress(type, targetId, amount = 1, context = {}) {
            const state = ensureQuestState();
            const increment = Math.max(0, number(amount, 0));
            if (increment <= 0) return [];
            const updated = [];

            [...state.active].forEach((quest) => {
                if (quest.status !== "active") return;
                let changed = false;
                quest.objectives.forEach((objective) => {
                    if (objective.type !== type || !targetsMatch(type, objective.target, targetId) || objective.completed) return;
                    const previous = objective.progress;
                    objective.progress = Math.min(objective.required, objective.progress + increment);
                    objective.completed = objective.progress >= objective.required;
                    if (objective.progress === previous) return;
                    changed = true;
                    const payload = {
                        questId: quest.id,
                        questTitle: quest.title,
                        objective: clone(objective),
                        context: clone(context)
                    };
                    Aethra.EventBus.emit("QuestObjectiveUpdated", payload);
                    Aethra.EventBus.emit("quest:objective-updated", payload);
                });

                if (!changed) return;
                updated.push(clone(quest));
                Aethra.EventBus.emit("QuestUpdated", clone(quest));
                Aethra.EventBus.emit("quest:updated", clone(quest));
                if (this.isQuestComplete(quest)) this.finishQuest(quest.id);
            });

            if (updated.length > 0) this.save("quest-progress");
            return updated;
        },

        isQuestComplete(quest) {
            return Boolean(quest?.objectives?.length && quest.objectives.every((objective) => objective.completed));
        },

        grantRewards(quest) {
            const state = ensureQuestState();
            if (!quest || quest.rewardClaimed || state.rewardClaims.includes(quest.id)) {
                return quest?.rewardResult || null;
            }

            const reward = normalizeReward(quest);
            const result = { questId: quest.id, xp: 0, gold: 0, items: [], failures: [] };

            try {
                if (reward.xp > 0) {
                    Aethra.XPSystem?.addXP?.(reward.xp, { source: "quest", questId: quest.id });
                    result.xp = reward.xp;
                }
                if (reward.gold > 0) {
                    Aethra.Commands?.addGold?.(reward.gold, `quest:${quest.id}`);
                    result.gold = reward.gold;
                }
                reward.items.forEach((entry) => {
                    for (let unit = 0; unit < entry.quantity; unit += 1) {
                        const item = Aethra.ItemSystem?.generateItem?.(entry.templateId, {
                            source: "quest",
                            origin: `quest:${quest.id}`,
                            quality: 35,
                            potential: 35
                        });
                        const stored = item ? Aethra.BagSystem?.addItem?.(item, `quest:${quest.id}`) : null;
                        if (stored) result.items.push(entry.templateId);
                        else result.failures.push({ templateId: entry.templateId, reason: "ITEM_NOT_GRANTED" });
                    }
                });
            } catch (error) {
                result.failures.push({ reason: "REWARD_ERROR", message: error.message });
            }

            quest.rewardClaimed = true;
            quest.rewardedAt = Date.now();
            quest.rewardResult = clone(result);
            state.rewardClaims.push(quest.id);
            Aethra.EventBus.emit("quest:reward-granted", clone(result));
            return result;
        },

        finishQuest(questId) {
            const state = ensureQuestState();
            const index = state.active.findIndex((quest) => quest.id === questId);
            if (index < 0) return null;
            const quest = state.active[index];
            if (!this.isQuestComplete(quest)) return null;

            this.grantRewards(quest);
            quest.status = "completed";
            quest.completedAt = Date.now();
            state.active.splice(index, 1);
            state.completed.push(quest);

            Aethra.EventBus.emit("QuestFinished", clone(quest));
            Aethra.EventBus.emit("quest:finished", clone(quest));

            const nextQuestId = this.resolveNextQuestId(quest);
            if (nextQuestId && this.getDefinition(nextQuestId)) {
                this.acceptQuest(nextQuestId);
                this.trackQuest(nextQuestId, { save: false });
            } else if (Aethra.GameState.ui?.trackedQuestId === questId) {
                this.trackQuest(state.active[0]?.id || null, { save: false });
            }

            this.save("quest-finished");
            return quest;
        },

        resolveNextQuestId(quest) {
            if (quest?.nextQuestByIntroProfession) {
                const professionId = Aethra.GameState.hero?.introProfessionId;
                return Aethra.ProfessionSystem?.introPaths?.[professionId]
                    ? `intro_profession_${professionId}`
                    : null;
            }
            return quest?.nextQuestId || null;
        },

        registerQuest(questId, definition, options = {}) {
            if (!questId || !definition || typeof definition !== "object") return false;
            Aethra.GameData.quests = Aethra.GameData.quests || {};

            if (Aethra.GameData.quests[questId] && options.replace !== true) {
                return this.getDefinition(questId);
            }

            const normalized = normalizeDefinition(questId, definition);
            if (!validateDefinition(normalized)) {
                Aethra.EventBus.emit("quest:error", {
                    operation: "registerQuest",
                    questId,
                    reason: "Definição fora do contrato oficial."
                });
                return false;
            }

            Aethra.GameData.quests[questId] = clone(normalized);
            const state = ensureQuestState();
            const isKnown = state.active.some((quest) => quest.id === questId)
                || state.completed.some((quest) => quest.id === questId)
                || state.available.includes(questId);
            if (!isKnown) state.available.push(questId);

            const payload = { questId, quest: this.getDefinition(questId) };
            Aethra.EventBus.emit("gamedata:quest-registered", payload);
            Aethra.EventBus.emit("quest:registered", payload);
            return payload.quest;
        },

        trackQuest(questId, options = {}) {
            const state = ensureQuestState();
            const nextId = questId && state.active.some((quest) => quest.id === questId)
                ? String(questId)
                : null;
            Aethra.GameState.ui = Aethra.GameState.ui || {};
            Aethra.GameState.ui.trackedQuestId = nextId;
            Aethra.EventBus.emit("quest:tracking-changed", {
                questId: nextId,
                quest: nextId ? clone(state.active.find((quest) => quest.id === nextId)) : null
            });
            if (options.save !== false) this.save("quest-tracking");
            return nextId;
        },

        getTrackedQuest() {
            const trackedId = Aethra.GameState.ui?.trackedQuestId;
            return ensureQuestState().active.find((quest) => quest.id === trackedId) || null;
        },

        getGuidance(questOrId = this.getTrackedQuest()) {
            const quest = typeof questOrId === "string" ? this.getQuest(questOrId) : questOrId;
            const objective = quest?.objectives?.find((entry) => !entry.completed) || null;
            if (!quest || !objective) return null;
            const profession = Aethra.ProfessionSystem?.professions?.[objective.target];
            let action = "open-quests";
            let actionLabel = "Ver missão";
            let detail = objective.label;

            if (objective.type === "DefeatInHunt") {
                action = "focus-hunt";
                actionLabel = "Continuar expedição";
                detail = "Continue combatendo nesta expedição; qualquer criatura derrotada conta.";
            } else if (["StartHunt", "DefeatEnemy", "EnterZone", "ItemAcquired"].includes(objective.type)) {
                action = "open-hunt-map";
                actionLabel = objective.type === "StartHunt" ? "Escolher expedição" : "Abrir mapa";
                detail = objective.type === "DefeatEnemy"
                    ? "Escolha uma Hunt que tenha essa criatura e inicie a expedição."
                    : objective.type === "ItemAcquired"
                        ? "Confira no mapa onde obter o material necessário."
                        : "Escolha seu destino no mapa de expedições."
            } else if (objective.type === "TalkToNPC") {
                const alreadyInCity = Aethra.GameState.ui?.primaryView === "city"
                    && !Aethra.GameState.hunt?.isActive;
                action = alreadyInCity ? "interact-npc" : "go-city";
                actionLabel = alreadyInCity ? "Falar com Ilyra" : "Ir à cidade";
                detail = alreadyInCity
                    ? "Mestra Ilyra está destacada entre os serviços do Hub da Cidade."
                    : "Volte à cidade para encontrar Mestra Ilyra e receber sua orientação."
            } else if (objective.type === "PracticeSkill" && profession?.category === "crafting") {
                action = "open-workshop";
                actionLabel = "Abrir oficina";
                detail = `Pratique ${profession.name} na oficina da cidade.`;
            } else if (objective.type === "PracticeSkill") {
                action = "open-hunt-map";
                actionLabel = "Procurar recurso";
                detail = profession
                    ? `Procure recursos de ${profession.name} durante uma expedição.`
                    : "Procure uma atividade compatível durante uma expedição.";
            } else if (objective.type === "CraftRecipe") {
                const recipe = Aethra.RecipeCatalog?.get?.(objective.target);
                action = "open-workshop";
                actionLabel = "Abrir oficina";
                detail = recipe
                    ? `Produza ${recipe.name} na oficina usando os materiais indicados.`
                    : "Abra a oficina e conclua a receita indicada.";
            }

            return {
                questId: quest.id,
                objectiveId: objective.id,
                objective: clone(objective),
                action,
                actionLabel,
                target: objective.target,
                huntId: objective.huntId || (["StartHunt", "DefeatInHunt"].includes(objective.type) ? objective.target : null),
                professionId: objective.professionId || Aethra.RecipeCatalog?.get?.(objective.target)?.professionId || profession?.id || null,
                detail
            };
        },

        getProgress(questOrId) {
            const quest = typeof questOrId === "string" ? this.getQuest(questOrId) : questOrId;
            const totals = progressTotals(quest);
            return {
                ...totals,
                percent: Math.round((totals.progress / Math.max(1, totals.required)) * 100)
            };
        },

        auditReachability() {
            const issues = [];
            const definitions = [
                ...Object.entries(Aethra.GameData.quests || {}).map(([id, definition]) => normalizeDefinition(id, definition)),
                ...Object.keys(Aethra.ProfessionSystem?.introPaths || {}).map((professionId) => {
                    const id = `intro_profession_${professionId}`;
                    return normalizeDefinition(id, Aethra.ProfessionSystem.getIntroQuestDefinition(professionId));
                })
            ].filter(Boolean);
            const hunts = Aethra.HuntCatalog?.getDefinitions?.() || Aethra.HuntSystem?.hunts || {};
            const huntEntries = Object.values(hunts);
            const accessibleHunts = (levelReq) => huntEntries.filter((hunt) => number(hunt.minLevel, 1) <= number(levelReq, 1));
            const hasEnemyAtLevel = (target, levelReq) => accessibleHunts(levelReq).some((hunt) => {
                return (hunt.enemies || []).some((enemy) => targetsMatch("DefeatEnemy", target, enemy.id));
            });
            const recipeOutputs = new Set((Aethra.RecipeCatalog?.all?.() || [])
                .flatMap((recipe) => (recipe.outputs || []).map((output) => output.itemId)));
            const explorationResources = new Set(Aethra.ExplorationSystem?.getResourceTemplateIds?.() || []);
            const monsterDrops = new Set(Object.values(Aethra.GameData.creatures || {})
                .flatMap((creature) => (creature.lootTable || []).map((drop) => drop.templateId || drop.itemId || drop.id))
                .filter(Boolean));

            definitions.forEach((quest) => {
                if (!validateDefinition(quest)) {
                    issues.push({ questId: quest?.id || null, reason: "invalid-definition" });
                    return;
                }
                quest.objectives.forEach((objective) => {
                    if (["StartHunt", "DefeatInHunt"].includes(objective.type)) {
                        const hunt = hunts[objective.target];
                        if (!hunt) {
                            issues.push({ questId: quest.id, objectiveId: objective.id, reason: "missing-hunt", target: objective.target });
                        } else if (number(hunt.minLevel, 1) > quest.levelReq) {
                            issues.push({ questId: quest.id, objectiveId: objective.id, reason: "hunt-level-gated", target: objective.target });
                        }
                    } else if (objective.type === "DefeatEnemy" && !hasEnemyAtLevel(objective.target, quest.levelReq)) {
                        issues.push({ questId: quest.id, objectiveId: objective.id, reason: "enemy-unreachable", target: objective.target });
                    } else if (objective.type === "PracticeSkill" && !Aethra.ProfessionSystem?.professions?.[objective.target]) {
                        issues.push({ questId: quest.id, objectiveId: objective.id, reason: "missing-skill", target: objective.target });
                    } else if (objective.type === "CraftRecipe" && !Aethra.RecipeCatalog?.get?.(objective.target)) {
                        issues.push({ questId: quest.id, objectiveId: objective.id, reason: "missing-recipe", target: objective.target });
                    } else if (objective.type === "TalkToNPC" && !Aethra.EntityManager?.getEntity?.(objective.target)) {
                        issues.push({ questId: quest.id, objectiveId: objective.id, reason: "missing-npc", target: objective.target });
                    } else if (objective.type === "ItemAcquired") {
                        const itemExists = Boolean(Aethra.GameData.items?.[objective.target]);
                        const sourceExists = explorationResources.has(objective.target)
                            || recipeOutputs.has(objective.target)
                            || monsterDrops.has(objective.target);
                        if (!itemExists || !sourceExists) {
                            issues.push({
                                questId: quest.id,
                                objectiveId: objective.id,
                                reason: !itemExists ? "missing-item" : "item-source-unreachable",
                                target: objective.target
                            });
                        }
                    }
                });
                if (quest.nextQuestId && !Aethra.GameData.quests?.[quest.nextQuestId] && !String(quest.nextQuestId).startsWith("intro_profession_")) {
                    issues.push({ questId: quest.id, reason: "missing-next-quest", target: quest.nextQuestId });
                }
                if (quest.nextQuestByIntroProfession && Object.keys(Aethra.ProfessionSystem?.introPaths || {}).length === 0) {
                    issues.push({ questId: quest.id, reason: "missing-intro-profession-routes" });
                }
            });

            return { valid: issues.length === 0, checked: definitions.length, issues };
        },

        resetQuest(questId) {
            const state = ensureQuestState();
            state.active = state.active.filter((quest) => quest.id !== questId);
            state.completed = state.completed.filter((quest) => quest.id !== questId);
            state.rewardClaims = state.rewardClaims.filter((id) => id !== questId);
            if (!state.available.includes(questId)) state.available.push(questId);
            Aethra.EventBus.emit("quest:reset", { questId });
            return this.acceptQuest(questId);
        },

        getQuest(questId) {
            const state = ensureQuestState();
            return state.active.find((quest) => quest.id === questId)
                || state.completed.find((quest) => quest.id === questId)
                || null;
        },

        getState() {
            const state = ensureQuestState();
            return clone({
                contractVersion: state.contractVersion || CONTRACT_VERSION,
                active: state.active,
                completed: state.completed,
                available: state.available,
                rewardClaims: state.rewardClaims,
                trackedQuestId: Aethra.GameState.ui?.trackedQuestId || null
            });
        },

        save(reason = "quest-system") {
            if (Aethra.SaveManager?.save) Aethra.SaveManager.save(reason);
        }
    };
})(window.Aethra);
