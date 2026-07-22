// QuestSystem.js - Quests orientadas por Aethra.GameData
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus || !Aethra.GameData) {
        throw new Error("QuestSystem.js requer game-core.js e GameData.js.");
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));

    function ensureQuestState() {
        const state = Aethra.GameState;
        state.quests = state.quests || {};
        if (!Array.isArray(state.quests.active)) state.quests.active = [];
        if (!Array.isArray(state.quests.completed)) state.quests.completed = [];
        if (!Array.isArray(state.quests.available)) state.quests.available = [];
        return state.quests;
    }

    Aethra.QuestSystem = {
        initialized: false,
        processedItemInstances: new Set(),

        init() {
            if (this.initialized) return this.getState();

            const state = ensureQuestState();
            state.available = Object.keys(Aethra.GameData.quests || {}).filter((questId) => {
                return !state.active.some((quest) => quest.id === questId) &&
                    !state.completed.some((quest) => quest.id === questId);
            });

            if (state.active.length === 0 && state.completed.length === 0) {
                const firstQuestId = Aethra.GameData.quests.quest_01
                    ? "quest_01"
                    : Object.keys(Aethra.GameData.quests || {})[0];

                if (firstQuestId) this.acceptQuest(firstQuestId);
            }

            this.bindEvents();
            this.initialized = true;

            Aethra.EventBus.emit("quest:ready", this.getState());
            return this.getState();
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            Aethra.EventBus.on("EnemyDefeated", (data = {}) => {
                const enemyId = data.enemyId || data.id || data.enemy?.id;
                if (enemyId) this.updateProgress("DefeatEnemy", enemyId, 1, data);
            });

            Aethra.EventBus.on("ItemAcquired", (data) => {
                this.handleItemsAcquired(data, "ItemAcquired");
            });

            Aethra.EventBus.on("itemObtained", (data) => {
                this.handleItemsAcquired(data, "itemObtained");
            });

            Aethra.EventBus.on("NPCInteracted", (data = {}) => {
                const npcId = data.npcId || data.id || data.npc?.id;
                if (npcId) this.updateProgress("TalkToNPC", npcId, 1, data);
            });

            Aethra.EventBus.on("ZoneEntered", (data = {}) => {
                const zoneId = data.zoneId || data.id || data.location;
                if (zoneId) this.updateProgress("EnterZone", zoneId, 1, data);
            });

            Aethra.EventBus.on("gamedata:quest-registered", ({ questId }) => {
                const state = ensureQuestState();
                if (!state.available.includes(questId)) state.available.push(questId);
            });
        },

        getDefinition(questId) {
            const definition = Aethra.GameData.quests?.[questId];

            if (!definition) return null;

            return {
                id: questId,
                ...clone(definition)
            };
        },

        acceptQuest(questId) {
            const state = ensureQuestState();
            const definition = this.getDefinition(questId);

            if (!definition) {
                Aethra.EventBus.emit("quest:error", {
                    operation: "acceptQuest",
                    questId,
                    reason: "Quest não encontrada no GameData."
                });
                return null;
            }

            const existing = state.active.find((quest) => quest.id === questId) ||
                state.completed.find((quest) => quest.id === questId);
            if (existing) return existing;

            const quest = {
                ...clone(definition),
                id: questId,
                status: "active",
                acceptedAt: Date.now(),
                completedAt: null,
                objectives: (definition.objectives || []).map((objective, index) => ({
                    id: objective.id || `${questId}_objective_${index}`,
                    type: objective.type,
                    target: objective.target,
                    label: objective.label || objective.target || objective.type,
                    required: Math.max(1, Number(objective.required || 1)),
                    progress: Math.max(0, Number(objective.progress || 0)),
                    completed: Boolean(objective.completed)
                }))
            };

            state.active.push(quest);
            state.available = state.available.filter((id) => id !== questId);

            Aethra.EventBus.emit("QuestAccepted", clone(quest));
            Aethra.EventBus.emit("quest:accepted", clone(quest));
            this.save();
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

                const amount = Math.max(1, Number(item.quantity || item.amount || 1));
                this.updateProgress("ItemAcquired", itemId, amount, {
                    sourceEvent,
                    item
                });
            });
        },

        updateProgress(type, targetId, amount = 1, context = {}) {
            const state = ensureQuestState();
            const increment = Math.max(0, Number(amount || 0));
            if (increment <= 0) return [];

            const updated = [];

            [...state.active].forEach((quest) => {
                if (quest.status !== "active") return;
                let changed = false;

                quest.objectives.forEach((objective) => {
                    if (
                        objective.type !== type ||
                        objective.target !== targetId ||
                        objective.completed
                    ) return;

                    const previous = objective.progress;
                    objective.progress = Math.min(
                        objective.required,
                        objective.progress + increment
                    );
                    objective.completed = objective.progress >= objective.required;

                    if (objective.progress !== previous) {
                        changed = true;
                        Aethra.EventBus.emit("QuestObjectiveUpdated", {
                            questId: quest.id,
                            questTitle: quest.title,
                            objective: clone(objective),
                            context: clone(context)
                        });
                        Aethra.EventBus.emit("quest:objective-updated", {
                            questId: quest.id,
                            objective: clone(objective)
                        });
                    }
                });

                if (!changed) return;
                updated.push(clone(quest));
                Aethra.EventBus.emit("QuestUpdated", clone(quest));
                Aethra.EventBus.emit("quest:updated", clone(quest));

                if (this.isQuestComplete(quest)) this.finishQuest(quest.id);
            });

            if (updated.length > 0) this.save();
            return updated;
        },

        isQuestComplete(quest) {
            return Boolean(
                quest &&
                Array.isArray(quest.objectives) &&
                quest.objectives.length > 0 &&
                quest.objectives.every((objective) => objective.completed)
            );
        },

        finishQuest(questId) {
            const state = ensureQuestState();
            const index = state.active.findIndex((quest) => quest.id === questId);
            if (index < 0) return null;

            const quest = state.active[index];
            if (!this.isQuestComplete(quest)) return null;

            quest.status = "completed";
            quest.completedAt = Date.now();
            state.active.splice(index, 1);
            state.completed.push(quest);

            Aethra.EventBus.emit("QuestFinished", clone(quest));
            Aethra.EventBus.emit("quest:finished", clone(quest));

            if (quest.nextQuestId && Aethra.GameData.quests?.[quest.nextQuestId]) {
                this.acceptQuest(quest.nextQuestId);
                if (Aethra.GameState?.ui) Aethra.GameState.ui.trackedQuestId = quest.nextQuestId;
            }

            this.save();
            return quest;
        },

        registerQuest(questId, definition) {
            if (!questId || !definition || typeof definition !== "object") {
                return false;
            }

            Aethra.GameData.quests = Aethra.GameData.quests || {};
            Aethra.GameData.quests[questId] = clone(definition);

            const state = ensureQuestState();
            const isKnown = state.active.some((quest) => quest.id === questId) ||
                state.completed.some((quest) => quest.id === questId) ||
                state.available.includes(questId);

            if (!isKnown) state.available.push(questId);

            Aethra.EventBus.emit("gamedata:quest-registered", {
                questId,
                quest: this.getDefinition(questId)
            });

            Aethra.EventBus.emit("quest:registered", {
                questId,
                quest: this.getDefinition(questId)
            });

            return this.getDefinition(questId);
        },

        resetQuest(questId) {
            const state = ensureQuestState();
            state.active = state.active.filter((quest) => quest.id !== questId);
            state.completed = state.completed.filter((quest) => quest.id !== questId);
            if (!state.available.includes(questId)) state.available.push(questId);
            return this.acceptQuest(questId);
        },

        getQuest(questId) {
            const state = ensureQuestState();
            return state.active.find((quest) => quest.id === questId) ||
                state.completed.find((quest) => quest.id === questId) ||
                null;
        },

        getState() {
            const state = ensureQuestState();
            return clone({
                active: state.active,
                completed: state.completed,
                available: state.available
            });
        },

        save() {
            if (Aethra.SaveManager?.save) Aethra.SaveManager.save("quest-system");
        }
    };
})(window.Aethra);
