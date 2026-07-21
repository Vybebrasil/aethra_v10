// CraftingSystem.js — transações reais de refino e criação por ofício.
// Proprietário exclusivo de: receitas ativas, validação, consumo, criação e XP de fabricação.
// Receitas declarativas vivem em js/data/recipes/RecipeCatalog.js.
(function initCraftingSystem(Aethra) {
    "use strict";

    if (!Aethra?.GameState || !Aethra?.EventBus) {
        throw new Error("CraftingSystem.js requer game-core.js.");
    }

    const clone  = (value) => JSON.parse(JSON.stringify(value));
    const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const clamp  = (value, min, max) => Math.min(max, Math.max(min, number(value)));

    // ─── Técnicas ─────────────────────────────────────────────────────────────
    const TECHNIQUES = Object.freeze({
        balanced:   { id: "balanced",   name: "Equilibrada",  materialDelta: 0,  qualityDelta: 0,  description: "Custo e qualidade normais." },
        economical: { id: "economical", name: "Econômica",    materialDelta: -1, qualityDelta: -10, description: "Poupa 1 material principal, mas reduz a qualidade." },
        masterwork: { id: "masterwork", name: "Obra-prima",   materialDelta: 1,  qualityDelta: 9,  difficultyDelta: 2, description: "Gasta 1 material extra para buscar qualidade superior." }
    });

    // ─── Catálogo em memória (carregado pelo RecipeCatalog via loadCatalog) ────
    let _catalog = {};   // recipeId → recipe (objeto imutável)

    // ─── Helpers internos ─────────────────────────────────────────────────────
    function ensureDiscovered() {
        const crafting = Aethra.GameState.crafting;
        if (!Array.isArray(crafting.discovered)) crafting.discovered = [];
        return crafting.discovered;
    }

    function getRecipeRaw(recipeId) {
        return _catalog[recipeId] || null;
    }

    // ─── API pública ──────────────────────────────────────────────────────────
    Aethra.CraftingSystem = {
        initialized: false,
        randomSource: Math.random,
        techniques: clone(TECHNIQUES),

        // ── Carregamento de catálogo ─────────────────────────────────────────
        /** Chamado pelo GameLoader após RecipeCatalog estar pronto. */
        loadCatalog(recipeArray) {
            if (!Array.isArray(recipeArray)) return;
            _catalog = {};
            recipeArray.forEach((recipe) => {
                if (recipe?.id) _catalog[recipe.id] = Object.freeze(Object.assign({}, recipe));
            });
        },

        // ── Estado de descoberta ──────────────────────────────────────────────
        isDiscovered(recipeId) {
            return ensureDiscovered().includes(recipeId);
        },

        /**
         * Marca uma ou mais receitas como descobertas e emite crafting:recipe-discovered
         * para cada nova descoberta. Idempotente.
         */
        discoverRecipe(recipeId, options = {}) {
            const recipe = getRecipeRaw(recipeId);
            if (!recipe) return false;
            const discovered = ensureDiscovered();
            if (discovered.includes(recipeId)) return false;   // já conhecida

            discovered.push(recipeId);

            const payload = {
                recipeId,
                professionId: recipe.professionId,
                level: Aethra.ProfessionSystem?.getState?.(recipe.professionId)?.level || 1,
                recipe: Object.assign({}, recipe),
                source: options.source || "auto"
            };
            Aethra.EventBus.emit("crafting:recipe-discovered", payload);

            if (options.save !== false) Aethra.SaveManager?.save?.();
            return true;
        },

        /**
         * Descobre todas as receitas de uma profissão cujo unlockLevel <= newLevel.
         * Chamado por ProfessionSystem ao subir de rank.
         */
        discoverByProfessionLevel(professionId, newLevel) {
            const toDiscover = Object.values(_catalog).filter(
                (recipe) =>
                    recipe.professionId === professionId &&
                    recipe.unlockLevel <= newLevel &&
                    !this.isDiscovered(recipe.id)
            );
            toDiscover.forEach((recipe) => this.discoverRecipe(recipe.id, { save: false }));
            if (toDiscover.length > 0) Aethra.SaveManager?.save?.();
            return toDiscover.map((recipe) => recipe.id);
        },

        /**
         * Descobre as receitas iniciais (tier 1 nível 1) de uma profissão.
         * Chamado na criação do personagem e na migração de save.
         */
        discoverStarters(professionId) {
            const starterIds = Aethra.RecipeCatalog?.starterIds?.(professionId) || [];
            starterIds.forEach((id) => this.discoverRecipe(id, { save: false }));
            return starterIds;
        },

        // ── Consulta de receitas ──────────────────────────────────────────────
        getRecipe(recipeId) {
            const recipe = getRecipeRaw(recipeId);
            return recipe ? Object.assign({}, recipe) : null;
        },

        /**
         * Retorna receitas filtradas por profissão.
         * options.includeUndiscovered: false (padrão) — só descobertas
         *                              true — todas (catálogo completo)
         */
        getRecipes(professionId = null, options = {}) {
            const includeUndiscovered = options.includeUndiscovered === true;
            return Object.values(_catalog)
                .filter((recipe) => {
                    if (professionId && recipe.professionId !== professionId) return false;
                    if (!includeUndiscovered && !this.isDiscovered(recipe.id)) return false;
                    return true;
                })
                .map((recipe) => Object.assign({}, recipe));
        },

        /** Receitas agrupadas por tier para uma profissão. */
        getRecipesByTier(professionId) {
            const tiers = {};
            this.getRecipes(professionId, { includeUndiscovered: true }).forEach((recipe) => {
                const tier = recipe.tier || 1;
                if (!tiers[tier]) tiers[tier] = [];
                tiers[tier].push(recipe);
            });
            return tiers;
        },

        /** Receitas ainda não descobertas de uma profissão (visíveis como "A Descobrir"). */
        getUndiscovered(professionId) {
            return Object.values(_catalog)
                .filter((recipe) =>
                    recipe.professionId === professionId &&
                    !this.isDiscovered(recipe.id)
                )
                .map((recipe) => Object.assign({}, recipe));
        },

        getSnapshot() {
            return {
                recipes: this.getRecipes(null, { includeUndiscovered: false }),
                catalogSize: Object.keys(_catalog).length,
                techniques: clone(TECHNIQUES),
                state: clone(this.ensureState())
            };
        },

        // ── Estado de crafting ────────────────────────────────────────────────
        ensureState(forceReset = false) {
            if (forceReset || !Aethra.GameState.crafting || typeof Aethra.GameState.crafting !== "object") {
                Aethra.GameState.crafting = {
                    completed: 0,
                    recipeCounts: {},
                    processedCommands: [],
                    discovered: []
                };
            }
            const state = Aethra.GameState.crafting;
            state.completed = Math.max(0, Math.floor(number(state.completed)));
            if (!state.recipeCounts || typeof state.recipeCounts !== "object") state.recipeCounts = {};
            if (!Array.isArray(state.processedCommands)) state.processedCommands = [];
            if (!Array.isArray(state.discovered))        state.discovered = [];
            state.processedCommands = state.processedCommands.slice(-100);
            return state;
        },

        // ── Técnicas ─────────────────────────────────────────────────────────
        setRandomSource(fn) {
            if (typeof fn !== "function") throw new TypeError("CraftingSystem.setRandomSource requer função.");
            this.randomSource = fn;
        },

        resetRandomSource() {
            this.randomSource = Math.random;
        },

        // ── Validação e requisitos ────────────────────────────────────────────
        resolveRequirements(recipe, techniqueId = "balanced", batches = 1) {
            const technique = TECHNIQUES[techniqueId] || TECHNIQUES.balanced;
            const inputs = recipe.inputs.map((input, index) => ({
                ...input,
                quantity: Math.max(1, (input.quantity + (index === 0 ? technique.materialDelta : 0)) * batches)
            }));
            return { technique, inputs, requiredLevel: recipe.requiredLevel + number(technique.difficultyDelta) };
        },

        validateCraft(recipeId, options = {}) {
            const recipe = getRecipeRaw(recipeId);
            if (!recipe) return { allowed: false, reason: "unknown-recipe" };
            if (!this.isDiscovered(recipeId)) return { allowed: false, reason: "recipe-not-discovered", recipeId };

            const batches = clamp(Math.floor(number(options.quantity, 1)), 1, 20);
            const requirements = this.resolveRequirements(recipe, options.techniqueId, batches);
            const state = Aethra.ProfessionSystem?.getState?.(recipe.professionId);
            if (!state || state.status === "locked") return { allowed: false, reason: "profession-locked", recipe: Object.assign({}, recipe) };
            if (Aethra.GameState.hunt?.isActive) return { allowed: false, reason: "hunt-active", recipe: Object.assign({}, recipe) };
            if (options.stationId !== recipe.stationId) return { allowed: false, reason: "wrong-station", stationId: recipe.stationId, recipe: Object.assign({}, recipe) };
            if (state.level < requirements.requiredLevel) return { allowed: false, reason: "insufficient-level", requiredLevel: requirements.requiredLevel, level: state.level, recipe: Object.assign({}, recipe) };

            const missing = requirements.inputs
                .filter((input) => number(Aethra.BagSystem?.countItem?.(input.itemId)) < input.quantity)
                .map((input) => ({ ...input, available: number(Aethra.BagSystem?.countItem?.(input.itemId)) }));
            if (missing.length > 0) return { allowed: false, reason: "missing-materials", missing, inputs: requirements.inputs, recipe: Object.assign({}, recipe) };

            return { allowed: true, recipe: Object.assign({}, recipe), batches, state, ...requirements };
        },

        // ── Cálculo de qualidade ──────────────────────────────────────────────
        rollQuality(skillLevel, requiredLevel, technique) {
            const mastery   = Aethra.XPSystem?.getDiminishingSkillBonus?.(skillLevel, { scale: 14, interval: 14 }) || 0;
            const challenge = clamp((skillLevel - requiredLevel) * 0.7, -12, 18);
            const variance  = (clamp(this.randomSource(), 0, 1) * 16) - 8;
            return clamp(Math.round(42 + mastery + challenge + technique.qualityDelta + variance), 1, 100);
        },

        // ── Transação de craft ────────────────────────────────────────────────
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
                accepted: true, recipeId, recipe: Object.assign({}, recipe), technique: clone(technique),
                batches, inputs: clone(inputs), outputs: clone(added), xp, commandId,
                completedAt: new Date().toISOString()
            };
            Aethra.EventBus.emit("crafting:completed", payload);
            Aethra.EventBus.emit("inventory:changed", { source: "crafting", recipeId, items: clone(added) });
            Aethra.SaveManager?.save?.();
            return clone(payload);
        },

        // ── Inicialização ─────────────────────────────────────────────────────
        init() {
            this.ensureState();
            // Carregar catálogo do RecipeCatalog (deve estar inicializado antes)
            if (Aethra.RecipeCatalog) {
                this.loadCatalog(Aethra.RecipeCatalog.all());
            }
            this.initialized = true;
            Aethra.EventBus.emit("crafting:ready", this.getSnapshot());
            return this.getSnapshot();
        }
    };
})(window.Aethra);
