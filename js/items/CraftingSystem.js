// CraftingSystem.js - transações reais de refino e criação por ofício.
(function initCraftingSystem(Aethra) {
    "use strict";

    if (!Aethra?.GameState || !Aethra?.EventBus) {
        throw new Error("CraftingSystem.js requer game-core.js.");
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, number(value)));

    const TECHNIQUES = Object.freeze({
        balanced: { id: "balanced", name: "Equilibrada", materialDelta: 0, qualityDelta: 0, description: "Custo e qualidade normais." },
        economical: { id: "economical", name: "Econômica", materialDelta: -1, qualityDelta: -10, description: "Poupa 1 material principal, mas reduz a qualidade." },
        masterwork: { id: "masterwork", name: "Obra-prima", materialDelta: 1, qualityDelta: 9, difficultyDelta: 2, description: "Gasta 1 material extra para buscar qualidade superior." }
    });

    const RECIPES = Object.freeze({
        smelt_iron: {
            id: "smelt_iron", name: "Fundir ferro", icon: "▰", professionId: "blacksmithing", action: "smelt", stationId: "forge",
            requiredLevel: 1, xp: 8, inputs: [{ itemId: "iron_ore", quantity: 2 }], outputs: [{ itemId: "refined_ingot", quantity: 1 }],
            description: "Transforma minério bruto em um lingote utilizável."
        },
        forge_iron_sword: {
            id: "forge_iron_sword", name: "Espada de ferro", icon: "⚔", professionId: "blacksmithing", action: "forge", stationId: "forge",
            requiredLevel: 2, xp: 18, inputs: [{ itemId: "refined_ingot", quantity: 3 }], outputs: [{ itemId: "eg_sword_l1", quantity: 1 }],
            description: "Forja uma espada individual com qualidade própria."
        },
        forge_plate_chest: {
            id: "forge_plate_chest", name: "Peitoral de placa", icon: "▣", professionId: "blacksmithing", action: "forge", stationId: "forge",
            requiredLevel: 4, xp: 25, inputs: [{ itemId: "refined_ingot", quantity: 5 }], outputs: [{ itemId: "eg_chest_plate_l1", quantity: 1 }],
            description: "Cria uma proteção pesada com qualidade variável."
        },
        tan_beast_hide: {
            id: "tan_beast_hide", name: "Curtir pele", icon: "▧", professionId: "leatherworking", action: "tan", stationId: "tannery",
            requiredLevel: 1, xp: 8, inputs: [{ itemId: "beast_hide", quantity: 2 }], outputs: [{ itemId: "treated_leather", quantity: 1 }],
            description: "Transforma pele bruta em couro pronto para criação."
        },
        craft_leather_chest: {
            id: "craft_leather_chest", name: "Peitoral de couro", icon: "▣", professionId: "leatherworking", action: "craft-leather", stationId: "tannery",
            requiredLevel: 4, xp: 25, inputs: [{ itemId: "treated_leather", quantity: 4 }], outputs: [{ itemId: "eg_chest_leather_l1", quantity: 1 }],
            description: "Costura uma proteção leve com qualidade variável."
        },
        craft_leather_boots: {
            id: "craft_leather_boots", name: "Botas de couro", icon: "⌄", professionId: "leatherworking", action: "craft-leather", stationId: "tannery",
            requiredLevel: 2, xp: 15, inputs: [{ itemId: "treated_leather", quantity: 2 }], outputs: [{ itemId: "eg_feet_leather_l1", quantity: 1 }],
            description: "Cria botas leves com qualidade individual."
        }
    });

    Aethra.CraftingSystem = {
        initialized: false,
        randomSource: Math.random,
        recipes: clone(RECIPES),
        techniques: clone(TECHNIQUES),

        init() {
            this.ensureState();
            this.initialized = true;
            Aethra.EventBus.emit("crafting:ready", this.getSnapshot());
            return this.getSnapshot();
        },

        ensureState(forceReset = false) {
            if (forceReset || !Aethra.GameState.crafting || typeof Aethra.GameState.crafting !== "object") {
                Aethra.GameState.crafting = { completed: 0, recipeCounts: {}, processedCommands: [] };
            }
            const state = Aethra.GameState.crafting;
            state.completed = Math.max(0, Math.floor(number(state.completed)));
            if (!state.recipeCounts || typeof state.recipeCounts !== "object") state.recipeCounts = {};
            if (!Array.isArray(state.processedCommands)) state.processedCommands = [];
            state.processedCommands = state.processedCommands.slice(-100);
            return state;
        },

        setRandomSource(fn) {
            if (typeof fn !== "function") throw new TypeError("CraftingSystem.setRandomSource requer função.");
            this.randomSource = fn;
        },

        resetRandomSource() {
            this.randomSource = Math.random;
        },

        getRecipe(recipeId) {
            return RECIPES[recipeId] ? clone(RECIPES[recipeId]) : null;
        },

        getRecipes(professionId = null) {
            return Object.values(RECIPES).filter((recipe) => !professionId || recipe.professionId === professionId).map(clone);
        },

        getSnapshot() {
            return { recipes: this.getRecipes(), techniques: clone(TECHNIQUES), state: clone(this.ensureState()) };
        },

        resolveRequirements(recipe, techniqueId = "balanced", batches = 1) {
            const technique = TECHNIQUES[techniqueId] || TECHNIQUES.balanced;
            const inputs = recipe.inputs.map((input, index) => ({
                ...input,
                quantity: Math.max(1, (input.quantity + (index === 0 ? technique.materialDelta : 0)) * batches)
            }));
            return { technique, inputs, requiredLevel: recipe.requiredLevel + number(technique.difficultyDelta) };
        },

        validateCraft(recipeId, options = {}) {
            const recipe = RECIPES[recipeId];
            if (!recipe) return { allowed: false, reason: "unknown-recipe" };
            const batches = clamp(Math.floor(number(options.quantity, 1)), 1, 20);
            const requirements = this.resolveRequirements(recipe, options.techniqueId, batches);
            const state = Aethra.ProfessionSystem?.getState?.(recipe.professionId);
            if (!state || state.status === "locked") return { allowed: false, reason: "profession-locked", recipe: clone(recipe) };
            if (Aethra.GameState.hunt?.isActive) return { allowed: false, reason: "hunt-active", recipe: clone(recipe) };
            if (options.stationId !== recipe.stationId) return { allowed: false, reason: "wrong-station", stationId: recipe.stationId, recipe: clone(recipe) };
            if (state.level < requirements.requiredLevel) return { allowed: false, reason: "insufficient-level", requiredLevel: requirements.requiredLevel, level: state.level, recipe: clone(recipe) };
            const missing = requirements.inputs.filter((input) => number(Aethra.BagSystem?.countItem?.(input.itemId)) < input.quantity)
                .map((input) => ({ ...input, available: number(Aethra.BagSystem?.countItem?.(input.itemId)) }));
            if (missing.length > 0) return { allowed: false, reason: "missing-materials", missing, inputs: requirements.inputs, recipe: clone(recipe) };
            return { allowed: true, recipe: clone(recipe), batches, state, ...requirements };
        },

        rollQuality(skillLevel, requiredLevel, technique) {
            const mastery = Aethra.XPSystem?.getDiminishingSkillBonus?.(skillLevel, { scale: 14, interval: 14 }) || 0;
            const challenge = clamp((skillLevel - requiredLevel) * 0.7, -12, 18);
            const variance = (clamp(this.randomSource(), 0, 1) * 16) - 8;
            return clamp(Math.round(42 + mastery + challenge + technique.qualityDelta + variance), 1, 100);
        },

        craft(recipeId, options = {}) {
            this.ensureState();
            const commandId = options.commandId ? String(options.commandId) : null;
            if (commandId && Aethra.GameState.crafting.processedCommands.includes(commandId)) {
                return { accepted: false, reason: "duplicate-command", commandId };
            }
            const validation = this.validateCraft(recipeId, options);
            if (!validation.allowed) {
                Aethra.EventBus.emit("crafting:rejected", validation);
                return { accepted: false, ...validation };
            }

            const { recipe, batches, technique, inputs, requiredLevel, state } = validation;
            const generated = [];
            for (let batch = 0; batch < batches; batch += 1) {
                const quality = this.rollQuality(state.level, requiredLevel, technique);
                recipe.outputs.forEach((output) => {
                    const item = Aethra.ItemSystem?.generateItem?.(output.itemId, {
                        quantity: output.quantity,
                        quality,
                        potential: clamp(quality + Math.round((clamp(this.randomSource(), 0, 1) * 10) - 5), 1, 100),
                        source: "player-crafting",
                        professionId: recipe.professionId,
                        crafterId: Aethra.GameState.hero?.id || Aethra.GameState.hero?.name || "hero"
                    });
                    if (item) {
                        item.crafting = { recipeId, techniqueId: technique.id, skillLevel: state.level, quality };
                        generated.push(item);
                    }
                });
            }
            if (generated.length === 0) return { accepted: false, reason: "output-generation-failed", recipeId };

            const consumed = inputs.map((input) => Aethra.BagSystem?.consumeItem?.(input.itemId, input.quantity, `crafting:${recipeId}`));
            if (consumed.some((result) => !result)) {
                Aethra.EventBus.emit("crafting:rejected", { recipeId, reason: "transaction-consume-failed" });
                return { accepted: false, reason: "transaction-consume-failed", recipeId };
            }
            const added = generated.filter((item) => Aethra.BagSystem?.addItem?.(item, `crafting:${recipeId}`));
            if (added.length !== generated.length) return { accepted: false, reason: "transaction-add-failed", recipeId };

            const xp = Aethra.ProfessionSystem?.grantActionXP?.(recipe.professionId, recipe.xp * batches, recipe.action, {
                source: `crafting:${recipeId}`, difficulty: requiredLevel
            });
            const craftState = Aethra.GameState.crafting;
            craftState.completed += batches;
            craftState.recipeCounts[recipeId] = Math.max(0, Math.floor(number(craftState.recipeCounts[recipeId]))) + batches;
            if (commandId) craftState.processedCommands.push(commandId);
            craftState.processedCommands = craftState.processedCommands.slice(-100);

            const payload = {
                accepted: true, recipeId, recipe: clone(recipe), technique: clone(technique), batches,
                inputs: clone(inputs), outputs: clone(added), xp, commandId, completedAt: new Date().toISOString()
            };
            Aethra.EventBus.emit("crafting:completed", payload);
            Aethra.EventBus.emit("inventory:changed", { source: "crafting", recipeId, items: clone(added) });
            Aethra.SaveManager?.save?.();
            return clone(payload);
        }
    };
})(window.Aethra);
