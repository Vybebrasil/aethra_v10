// ProfessionSystem.js - Regras de ações, políticas e caminhos de ofício.
(function initProfessionSystem(Aethra) {
    "use strict";

    if (!Aethra?.GameState || !Aethra?.EventBus) {
        throw new Error("ProfessionSystem.js requer game-core.js.");
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, number(value)));

    const DEFINITIONS = Object.freeze({
        mining: {
            id: "mining", name: "Mineração", icon: "⛏", category: "gathering", status: "available",
            description: "Extrai minérios, gemas e materiais metálicos.", benefit: "Rendimento crescente, sem teto rígido.",
            actionTypes: ["mine", "mining-node", "ore-extraction"], requiredTool: "apprentice_pickaxe", policy: true
        },
        skinning: {
            id: "skinning", name: "Esfolamento", icon: "◒", category: "gathering", status: "available",
            description: "Extrai couro, pele e ossos de criaturas derrotadas.", benefit: "Mais rendimento e materiais melhores.",
            actionTypes: ["skin", "creature-harvest", "hide-extraction"], requiredTool: "skinning_knife", policy: true
        },
        herbalism: {
            id: "herbalism", name: "Herbalismo", icon: "❧", category: "gathering", status: "available",
            description: "Coleta ervas, sementes e reagentes naturais.", benefit: "Aumenta rendimento e descobertas raras.",
            actionTypes: ["gather-herb", "herb-node", "botany"], requiredTool: "herb_knife", policy: true
        },
        exploration: {
            id: "exploration", name: "Exploração", icon: "⌖", category: "world", status: "available",
            description: "Evolui ao descobrir eventos, trilhas e segredos.", benefit: "Melhora a leitura e o aproveitamento do mundo.",
            actionTypes: ["discover", "explore-trail", "investigate", "map-secret"]
        },
        survival: {
            id: "survival", name: "Sobrevivência", icon: "△", category: "world", status: "available",
            description: "Adaptação, vigor e resistência em caçadas longas.", benefit: "Melhora recuperação e eficiência de recursos.",
            actionTypes: ["survive", "camp", "recover", "endure-trap"]
        },
        blacksmithing: {
            id: "blacksmithing", name: "Forjaria", icon: "⚒", category: "crafting", status: "available",
            description: "Refina metal e cria armas e armaduras pesadas.", benefit: "Desbloqueia receitas e melhora a qualidade criada.",
            actionTypes: ["forge", "smelt", "repair", "refine-metal"]
        },
        leatherworking: {
            id: "leatherworking", name: "Couraria", icon: "◈", category: "crafting", status: "available",
            description: "Curte peles e cria armaduras e acessórios de couro.", benefit: "Desbloqueia receitas e melhora a qualidade criada.",
            actionTypes: ["tan", "craft-leather", "repair-leather"]
        },
        alchemy: {
            id: "alchemy", name: "Alquimia", icon: "⚗", category: "crafting", status: "locked",
            description: "Produz poções, óleos e consumíveis especiais.", benefit: "Será liberada por conteúdo futuro.",
            actionTypes: ["brew", "distill", "mix-potion"]
        },
        thievery: {
            id: "thievery", name: "Ladinagem", icon: "⚿", category: "utility", status: "available",
            description: "Arromba fechaduras, desarma armadilhas e encontra passagens.", benefit: "Melhora testes e acesso a loot especial.",
            actionTypes: ["lockpick", "disarm-trap", "secret-door", "pickpocket"]
        }
    });

    const INTRO_PATHS = Object.freeze({
        mining: {
            id: "mining", title: "Aprendiz de Mineração", summary: "Aprenda a reconhecer e extrair seu primeiro veio.",
            toolId: "apprentice_pickaxe", action: "mine", objective: "Extraia seu primeiro minério"
        },
        skinning: {
            id: "skinning", title: "Aprendiz de Esfolamento", summary: "Aprenda a aproveitar os materiais de uma criatura.",
            toolId: "skinning_knife", action: "skin", objective: "Extraia sua primeira pele"
        },
        herbalism: {
            id: "herbalism", title: "Aprendiz de Herbalismo", summary: "Aprenda a reconhecer e colher um reagente natural.",
            toolId: "herb_knife", action: "gather-herb", objective: "Colha sua primeira erva"
        },
        blacksmithing: {
            id: "blacksmithing", title: "Aprendiz de Forjaria", summary: "Visite a forja e refine seu primeiro metal.",
            toolId: "smith_hammer", action: "smelt", objective: "Refine seu primeiro lingote"
        }
    });

    Aethra.ProfessionSystem = {
        initialized: false,
        professions: clone(DEFINITIONS),
        introPaths: clone(INTRO_PATHS),

        init() {
            this.ensureState();
            if (this.initialized) return this.getSnapshot();
            this.bindEvents();
            this.initialized = true;
            Aethra.EventBus.emit("profession:ready", this.getSnapshot());
            return this.getSnapshot();
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;
            Aethra.EventBus.on("skill:discovered", ({ skillId, source } = {}) => {
                if (!skillId) return;
                Aethra.QuestSystem?.updateProgress?.("PracticeSkill", skillId, 1, { source });
            });
            Aethra.EventBus.on("save:loaded", () => this.ensureState());
            Aethra.EventBus.on("game:reset", () => this.ensureState(true));
        },

        getXPRequired(level) {
            return Aethra.XPSystem?.getSkillXPRequired?.(level) || 45;
        },

        ensureState(forceReset = false) {
            Aethra.DisciplineSystem?.ensureState?.(forceReset);
            const hero = Aethra.GameState.hero || (Aethra.GameState.hero = {});
            const legacy = Aethra.GameState.professions && typeof Aethra.GameState.professions === "object"
                ? Aethra.GameState.professions
                : {};

            if (!forceReset && number(hero.professionMigrationVersion, 0) < 2) {
                Object.keys(DEFINITIONS).forEach((id) => {
                    const old = legacy[id];
                    const skill = hero.disciplines?.[id];
                    if (!old || !skill) return;
                    const oldLevel = Math.max(1, Math.floor(number(old.level, 1)));
                    if (oldLevel > skill.level) {
                        skill.level = oldLevel;
                        skill.xpNext = this.getXPRequired(oldLevel);
                    }
                    skill.xpCurrent = Math.min(skill.xpNext - 1, Math.max(skill.xpCurrent, Math.floor(number(old.xp, 0))));
                    skill.xpTotal = Math.max(skill.xpTotal, Math.floor(number(old.xpTotal, 0)));
                    skill.uses = Math.max(skill.uses, Math.floor(number(old.actions, 0)));
                });
                hero.professionMigrationVersion = 2;
            }

            if (forceReset || !Aethra.GameState.professionPolicies || typeof Aethra.GameState.professionPolicies !== "object") {
                Aethra.GameState.professionPolicies = {};
            }
            Object.values(DEFINITIONS).filter((definition) => definition.policy).forEach((definition) => {
                const current = Aethra.GameState.professionPolicies[definition.id];
                Aethra.GameState.professionPolicies[definition.id] = {
                    enabled: current?.enabled === true,
                    changedAt: current?.changedAt || null
                };
            });
            this.syncCompatibilityState();
            return Aethra.GameState.professions;
        },

        syncCompatibilityState() {
            const hero = Aethra.GameState.hero || {};
            Aethra.GameState.professions = {};
            Object.values(DEFINITIONS).forEach((definition) => {
                const skill = hero.disciplines?.[definition.id] || {};
                Aethra.GameState.professions[definition.id] = {
                    status: definition.status,
                    rank: "∞",
                    level: Math.max(1, Math.floor(number(skill.level, 1))),
                    xp: Math.max(0, Math.floor(number(skill.xpCurrent, 0))),
                    xpTotal: Math.max(0, Math.floor(number(skill.xpTotal, 0))),
                    xpNext: Math.max(1, Math.floor(number(skill.xpNext, this.getXPRequired(skill.level)))),
                    actions: Math.max(0, Math.floor(number(skill.uses, 0))),
                    trainingMode: skill.trainingMode === "locked" ? "locked" : "training",
                    discovered: Boolean(skill.discovered),
                    lastActionAt: skill.lastUsedAt || null
                };
            });
            return Aethra.GameState.professions;
        },

        getState(professionId) {
            this.ensureState();
            const definition = DEFINITIONS[professionId];
            const discipline = Aethra.DisciplineSystem?.getState?.(professionId);
            if (!definition || !discipline) return null;
            return {
                ...clone(definition),
                ...clone(discipline),
                status: definition.status,
                xp: discipline.xpCurrent,
                actions: discipline.uses,
                policy: definition.policy ? this.getPolicy(professionId) : null
            };
        },

        getSnapshot() {
            this.ensureState();
            return Object.fromEntries(Object.keys(DEFINITIONS).map((id) => [id, this.getState(id)]));
        },

        inferActionType(options = {}) {
            if (options.action) return String(options.action);
            const source = String(options.source || "").toLowerCase();
            const mappings = [
                ["creature-harvest", "skin"], ["skinning", "skin"], ["mining", "mine"], ["ore", "mine"],
                ["herb", "gather-herb"], ["locked-chest", "lockpick"], ["lockpick", "lockpick"],
                ["secret-door", "secret-door"], ["trap", "disarm-trap"], ["forge", "forge"], ["smelt", "smelt"],
                ["tann", "tan"], ["leather", "craft-leather"], ["camp", "camp"], ["survival", "survive"],
                ["trail", "explore-trail"], ["shrine", "investigate"], ["exploration", "discover"]
            ];
            return mappings.find(([token]) => source.includes(token))?.[1] || null;
        },

        isActionAllowed(professionId, actionType) {
            const allowed = DEFINITIONS[professionId]?.actionTypes || [];
            return Boolean(actionType && allowed.includes(String(actionType)));
        },

        getPolicy(professionId) {
            return clone(Aethra.GameState.professionPolicies?.[professionId] || { enabled: false, changedAt: null });
        },

        setCollectionPolicy(professionId, enabled, source = "player-command") {
            this.ensureState();
            if (!DEFINITIONS[professionId]?.policy) return false;
            const policy = Aethra.GameState.professionPolicies[professionId];
            policy.enabled = enabled === true;
            policy.changedAt = new Date().toISOString();
            const payload = { professionId, enabled: policy.enabled, source, policy: clone(policy) };
            Aethra.EventBus.emit("profession:policy-changed", payload);
            Aethra.SaveManager?.save?.();
            return clone(payload);
        },

        shouldCollect(professionId) {
            const definition = DEFINITIONS[professionId];
            return !definition?.policy || this.getPolicy(professionId).enabled === true;
        },

        hasRequiredTool(professionId) {
            const toolId = DEFINITIONS[professionId]?.requiredTool;
            return !toolId || number(Aethra.BagSystem?.countItem?.(toolId), 0) > 0;
        },

        canPerformFieldAction(professionId) {
            const state = this.getState(professionId);
            if (!state || state.status === "locked") return { allowed: false, reason: "locked" };
            if (!this.shouldCollect(professionId)) return { allowed: false, reason: "policy-disabled" };
            if (!this.hasRequiredTool(professionId)) return { allowed: false, reason: "missing-tool", toolId: state.requiredTool };
            return { allowed: true, professionId, state };
        },

        check(professionId, difficulty = 1, options = {}) {
            const state = this.getState(professionId);
            const requiredLevel = Math.max(1, Math.floor(number(difficulty, 1)));
            if (!state || state.status === "locked") return { success: false, professionId, level: 0, requiredLevel, chance: 0, roll: 1, reason: "locked" };
            if (state.level < requiredLevel) return { success: false, professionId, level: state.level, requiredLevel, chance: 0, roll: 1, reason: "insufficient-level" };
            const mastery = Aethra.XPSystem?.getDiminishingSkillBonus?.(state.level, { scale: 5, interval: 20 }) || 0;
            const chance = clamp(0.74 + ((state.level - requiredLevel) * 0.012) + (mastery / 100) + number(options.bonusChance), 0.08, 0.98);
            const random = typeof options.randomSource === "function" ? options.randomSource : Math.random;
            const roll = clamp(random(), 0, 1);
            return { success: roll <= chance, professionId, level: state.level, requiredLevel, chance, roll, reason: roll <= chance ? "success" : "failed-check" };
        },

        getHuntMultiplier(professionId) {
            return Math.max(0, number(Aethra.HuntSystem?.getProfessionXPMultiplier?.(professionId), 1));
        },

        grantActionXP(professionId, amount, actionType, options = {}) {
            return this.addXP(professionId, amount, {
                ...options,
                action: actionType,
                multiplier: Math.max(0, number(options.multiplier, 1)) * this.getHuntMultiplier(professionId)
            });
        },

        addXP(professionId, amount, options = {}) {
            const definition = DEFINITIONS[professionId];
            if (!definition || definition.status === "locked") return false;
            const action = this.inferActionType(options);
            if (!this.isActionAllowed(professionId, action)) {
                Aethra.EventBus.emit("profession:xpRejected", { professionId, action, source: options.source || "profession-action", reason: "action-not-allowed" });
                return false;
            }
            const payload = Aethra.XPSystem?.grantSkillXP?.(professionId, amount, {
                ...options,
                action,
                difficulty: options.difficulty ?? 1,
                source: options.source || "profession-action"
            });
            if (!payload?.accepted) return payload || false;
            this.syncCompatibilityState();
            const professionPayload = { ...clone(payload), professionId, action, definition: clone(definition), state: this.getState(professionId) };
            Aethra.EventBus.emit("profession:xpChanged", professionPayload);
            Aethra.EventBus.emit("profession:updated", professionPayload);
            if (payload.levelsGained > 0) {
                Aethra.EventBus.emit("profession:rankUp", professionPayload);
                // Descobrir receitas desbloqueadas pelo novo nível de profissão.
                Aethra.CraftingSystem?.discoverByProfessionLevel?.(
                    professionId,
                    professionPayload.state?.level || payload.newLevel || 1
                );
            }
            return professionPayload;
        },

        setTrainingMode(professionId, mode, source = "profession-ui") {
            const result = Aethra.XPSystem?.setSkillTrainingMode?.(professionId, mode, source);
            if (result) this.syncCompatibilityState();
            return result;
        },

        getYieldBonus(professionId) {
            const level = this.getState(professionId)?.level || 1;
            return Aethra.XPSystem?.getDiminishingSkillBonus?.(level, { scale: 18, interval: 18 }) || 0;
        },

        startIntroPath(professionId) {
            const path = INTRO_PATHS[professionId];
            if (!path) return false;
            const hero = Aethra.GameState.hero || (Aethra.GameState.hero = {});
            hero.introProfessionId = professionId;
            if (DEFINITIONS[professionId]?.policy) this.setCollectionPolicy(professionId, true, "intro-path");

            if (path.toolId && number(Aethra.BagSystem?.countItem?.(path.toolId), 0) === 0) {
                const tool = Aethra.ItemSystem?.generateItem?.(path.toolId, {
                    origin: "intro-profession", quality: 20, potential: 20, tradeable: false
                });
                if (tool) {
                    tool.bound = true;
                    tool.tradeable = false;
                    Aethra.BagSystem?.addItem?.(tool, "intro-profession");
                }
            }

            const questId = `intro_profession_${professionId}`;
            Aethra.QuestSystem?.registerQuest?.(questId, {
                name: path.title,
                description: path.summary,
                objectives: [{ type: "PracticeSkill", target: professionId, required: 1, label: path.objective }],
                rewards: { gold: 0, xp: 0 }
            });
            Aethra.QuestSystem?.acceptQuest?.(questId);
            Aethra.EventBus.emit("profession:intro-started", { professionId, path: clone(path), questId });
            return { professionId, path: clone(path), questId };
        },

        unlock(professionId) {
            const definition = this.professions[professionId];
            if (!definition) return false;
            definition.status = "available";
            Aethra.EventBus.emit("profession:unlocked", { professionId, state: this.getState(professionId) });
            return true;
        }
    };
})(window.Aethra);
