// ProfessionSystem.js - Progressão de skills de coleta e exploração
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus) {
        throw new Error("ProfessionSystem.js requer game-core.js.");
    }

    const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value || 0)));
    const clone = (value) => JSON.parse(JSON.stringify(value));

    const DEFINITIONS = {
        mining: {
            id: "mining",
            name: "Mineração",
            icon: "⛏",
            category: "gathering",
            status: "available",
            description: "Extrai minérios, gemas e materiais metálicos.",
            benefit: "Aumenta rendimento e chance de minério raro.",
            nextBenefit: "+1% de chance de minério extra por nível.",
            actionTypes: ["mine", "mining-node", "ore-extraction"]
        },
        skinning: {
            id: "skinning",
            name: "Couraria",
            icon: "◒",
            category: "gathering",
            status: "available",
            description: "Aproveita couro, pele e ossos de criaturas derrotadas.",
            benefit: "Melhora quantidade e qualidade de materiais animais.",
            nextBenefit: "+1% de chance de couro adicional por nível.",
            actionTypes: ["skin", "creature-harvest", "hide-extraction"]
        },
        herbalism: {
            id: "herbalism",
            name: "Herbalismo",
            icon: "❧",
            category: "gathering",
            status: "available",
            description: "Coleta ervas, sementes e reagentes naturais.",
            benefit: "Aumenta a descoberta de plantas raras.",
            nextBenefit: "+1% de chance de erva rara por nível.",
            actionTypes: ["gather-herb", "herb-node", "botany"]
        },
        exploration: {
            id: "exploration",
            name: "Exploração",
            icon: "⌖",
            category: "world",
            status: "available",
            description: "Evolui ao descobrir eventos, trilhas e segredos.",
            benefit: "Aumenta frequência e qualidade de eventos da hunt.",
            nextBenefit: "+0,5% de chance de evento especial por nível.",
            actionTypes: ["discover", "explore-trail", "investigate", "map-secret"]
        },
        survival: {
            id: "survival",
            name: "Sobrevivência",
            icon: "△",
            category: "world",
            status: "available",
            description: "Representa adaptação, vigor e resistência em caçadas longas.",
            benefit: "Reduz custos de suprimentos e melhora recuperação.",
            nextBenefit: "-0,5% de custo de suprimentos por nível.",
            actionTypes: ["survive", "camp", "recover", "endure-trap"]
        },
        blacksmithing: {
            id: "blacksmithing",
            name: "Forjaria",
            icon: "⚒",
            category: "crafting",
            status: "available",
            description: "Cria, repara e refina armas e armaduras.",
            benefit: "Melhora o potencial de equipamentos e rerolls.",
            nextBenefit: "+0,5% de eficiência de reforço por nível.",
            actionTypes: ["forge", "smelt", "repair", "refine-metal"]
        },
        alchemy: {
            id: "alchemy",
            name: "Alquimia",
            icon: "⚗",
            category: "crafting",
            status: "locked",
            description: "Produz poções, óleos e consumíveis especiais.",
            benefit: "Aumenta potência e duração de consumíveis.",
            nextBenefit: "+1% de potência de poções por nível.",
            actionTypes: ["brew", "distill", "mix-potion"]
        },
        thievery: {
            id: "thievery",
            name: "Ladinagem",
            icon: "⚿",
            category: "utility",
            status: "available",
            description: "Arromba fechaduras, desarma armadilhas e descobre passagens protegidas.",
            benefit: "Aumenta a chance de superar mecanismos e melhora o loot de baús trancados.",
            nextBenefit: "+1,25% de chance em testes de Ladinagem por nível.",
            actionTypes: ["lockpick", "disarm-trap", "secret-door", "pickpocket"]
        }
    };

    Aethra.ProfessionSystem = {
        initialized: false,
        professions: clone(DEFINITIONS),

        init() {
            this.ensureState();
            if (this.initialized) return this.getSnapshot();

            this.initialized = true;
            Aethra.EventBus.emit("profession:ready", this.getSnapshot());
            return this.getSnapshot();
        },

        getXPRequired(level) {
            const safeLevel = Math.max(1, Math.floor(Number(level || 1)));
            return Math.max(30, Math.round(45 * (1.18 ** (safeLevel - 1))));
        },

        ensureState() {
            Aethra.GameState.professions = Aethra.GameState.professions || {};

            Object.values(this.professions).forEach((definition) => {
                const current = Aethra.GameState.professions[definition.id] || {};
                const level = Math.max(1, Math.floor(Number(current.level || 1)));
                const xpNext = this.getXPRequired(level);

                Aethra.GameState.professions[definition.id] = {
                    status: definition.status === "available"
                        ? "available"
                        : (current.status || definition.status || "locked"),
                    rank: current.rank || "E",
                    level,
                    xp: clamp(current.xp || 0, 0, Math.max(0, xpNext - 1)),
                    xpTotal: Math.max(0, Math.floor(Number(current.xpTotal || 0))),
                    xpNext,
                    actions: Math.max(0, Math.floor(Number(current.actions || 0))),
                    lastGain: Math.max(0, Math.floor(Number(current.lastGain || 0))),
                    lastActionAt: current.lastActionAt || null
                };
            });

            return Aethra.GameState.professions;
        },

        getState(professionId) {
            this.ensureState();
            const definition = this.professions[professionId];
            const state = Aethra.GameState.professions?.[professionId];
            if (!definition || !state) return null;

            return {
                ...clone(definition),
                ...clone(state),
                progressPercent: state.xpNext > 0
                    ? clamp((state.xp / state.xpNext) * 100, 0, 100)
                    : 100
            };
        },

        getSnapshot() {
            this.ensureState();
            return Object.fromEntries(
                Object.keys(this.professions).map((id) => [id, this.getState(id)])
            );
        },

        inferActionType(options = {}) {
            if (options.action) return String(options.action);
            const source = String(options.source || "").toLowerCase();
            const mappings = [
                ["creature-harvest", "skin"], ["skinning", "skin"],
                ["mining", "mine"], ["ore", "mine"],
                ["herb", "gather-herb"], ["herbal", "gather-herb"],
                ["locked-chest", "lockpick"], ["lockpick", "lockpick"],
                ["secret-door", "secret-door"], ["trap", "disarm-trap"],
                ["forge", "forge"], ["smith", "forge"],
                ["camp", "camp"], ["survival", "survive"],
                ["trail", "explore-trail"], ["shrine", "investigate"],
                ["exploration", "discover"]
            ];
            return mappings.find(([token]) => source.includes(token))?.[1] || null;
        },

        isActionAllowed(professionId, actionType) {
            const definition = this.professions[professionId];
            if (!definition) return false;
            const allowed = Array.isArray(definition.actionTypes) ? definition.actionTypes : [];
            if (!actionType) return allowed.length === 0;
            return allowed.includes(String(actionType));
        },

        check(professionId, difficulty = 1, options = {}) {
            const state = this.getState(professionId);
            if (!state || state.status === "locked") {
                return { success: false, professionId, level: 0, requiredLevel: Math.max(1, Number(difficulty || 1)), chance: 0, roll: 1, reason: "locked" };
            }
            const requiredLevel = Math.max(1, Math.floor(Number(difficulty || 1)));
            const currentLevel = Number(state.level || 1);
            if (currentLevel < requiredLevel) {
                return {
                    success: false,
                    professionId,
                    level: currentLevel,
                    requiredLevel,
                    chance: 0,
                    roll: 1,
                    reason: "insufficient-level"
                };
            }
            const levelDelta = currentLevel - requiredLevel;
            const baseChance = Math.min(0.98, 0.72 + levelDelta * 0.035);
            const chance = clamp(baseChance + Number(options.bonusChance || 0), 0.05, 0.99);
            const random = typeof options.randomSource === "function" ? options.randomSource : Math.random;
            const roll = Number(random());
            return {
                success: roll <= chance,
                professionId,
                level: currentLevel,
                requiredLevel,
                chance,
                roll,
                reason: roll <= chance ? "success" : "failed-check"
            };
        },

        getHuntMultiplier(professionId) {
            return Math.max(0, Number(Aethra.HuntSystem?.getProfessionXPMultiplier?.(professionId) ?? 1));
        },

        grantActionXP(professionId, amount, actionType, options = {}) {
            return this.addXP(professionId, amount, {
                ...options,
                action: actionType,
                multiplier: Math.max(0, Number(options.multiplier ?? 1)) * this.getHuntMultiplier(professionId)
            });
        },

        addXP(professionId, amount, options = {}) {
            this.ensureState();
            const definition = this.professions[professionId];
            const state = Aethra.GameState.professions?.[professionId];
            if (!definition || !state || state.status === "locked") return false;

            const actionType = this.inferActionType(options);
            if (!this.isActionAllowed(professionId, actionType)) {
                const rejected = {
                    professionId,
                    action: actionType,
                    source: options.source || "profession-action",
                    reason: "action-not-allowed"
                };
                Aethra.EventBus.emit("profession:xpRejected", rejected);
                return false;
            }

            const multiplier = Math.max(0, Number(options.multiplier ?? 1));
            const gain = Math.max(0, Math.floor(Number(amount || 0) * multiplier));
            if (gain <= 0) return false;

            state.xp += gain;
            state.xpTotal += gain;
            state.actions += 1;
            state.lastGain = gain;
            state.lastActionAt = new Date().toISOString();

            const levelUps = [];
            while (state.xp >= state.xpNext) {
                state.xp -= state.xpNext;
                state.level += 1;
                state.xpNext = this.getXPRequired(state.level);
                levelUps.push(state.level);
                Aethra.EventBus.emit("profession:rankUp", {
                    professionId,
                    definition: clone(definition),
                    state: clone(state),
                    level: state.level
                });
            }

            const payload = {
                professionId,
                definition: clone(definition),
                state: clone(state),
                amount: gain,
                baseAmount: Math.max(0, Math.floor(Number(amount || 0))),
                multiplier,
                action: actionType,
                levelUps,
                source: options.source || "profession-action"
            };

            Aethra.EventBus.emit("profession:xpChanged", payload);
            Aethra.EventBus.emit("profession:updated", payload);
            Aethra.EventBus.emit("mastery:updated", payload);
            return clone(payload);
        },

        unlock(professionId) {
            this.ensureState();
            const definition = this.professions[professionId];
            const state = Aethra.GameState.professions?.[professionId];
            if (!definition || !state) return false;

            definition.status = "available";
            state.status = "available";
            Aethra.EventBus.emit("profession:unlocked", {
                professionId,
                state: clone(state)
            });
            return true;
        }
    };
})(window.Aethra);
