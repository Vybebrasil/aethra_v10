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
        resilience: {
            id: "resilience", name: "Resiliência", icon: "△", category: "world", status: "available",
            description: "Capacidade de recuperar HP e Mana ao descansar nas escadarias.", benefit: "Aumenta a cura passiva entre andares.",
            actionTypes: ["survive", "camp", "recover", "endure-trap"]
        },
        exploration: {
            id: "exploration", name: "Exploração", icon: "⌖", category: "world", status: "available",
            description: "Investiga trilhas, santuários e segredos durante a caçada.", benefit: "Melhora frequência e qualidade de eventos.",
            actionTypes: ["discover", "investigate", "explore-trail"]
        },
        survival: {
            id: "survival", name: "Sobrevivência", icon: "△", category: "world", status: "available",
            description: "Acampamentos, recuperação e resistência em caçadas longas.", benefit: "Reduz custos e melhora recuperação.",
            actionTypes: ["camp", "survive", "recover", "endure-trap"]
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
            id: "alchemy", name: "Alquimia", icon: "⚗", category: "crafting", status: "available",
            description: "Destila reagentes e produz poções, tônicos e consumíveis.", benefit: "Transforma coleta em supplies escolhidos pelo jogador.",
            actionTypes: ["brew", "distill", "mix-potion"]
        },
        thievery: {
            id: "thievery", name: "Ladinagem", icon: "⚿", category: "utility", status: "available",
            description: "Abordagem ladina para arrombar baús e desarmar armadilhas.", benefit: "Garante loot intacto de baús trancados.",
            actionTypes: ["lockpick", "disarm-trap", "secret-door", "pickpocket"]
        },
        arcanism: {
            id: "arcanism", name: "Arcanismo", icon: "✦", category: "utility", status: "available",
            description: "Abordagem mágica para desfazer selos e desviar de perigos.", benefit: "Consome mana, mas ignora mecânicas de tranca física.",
            actionTypes: ["dispel-seal", "deflect-trap"]
        },
        athletics: {
            id: "athletics", name: "Atletismo", icon: "💪", category: "utility", status: "available",
            description: "Abordagem bruta para esmagar baús e suportar armadilhas.", benefit: "Rápido, mas pode quebrar itens frágeis.",
            actionTypes: ["smash-chest", "endure-trap"]
        }
    });

    const INTRO_PATHS = Object.freeze({
        mining: {
            id: "mining", title: "Aprendiz de Mineração", summary: "Aprenda a reconhecer e extrair seu primeiro veio.",
            toolId: "apprentice_pickaxe", action: "mine", objective: "Extraia seu primeiro minério", huntId: "apprentice_mines_focus"
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

    const FOCUS_TRAINING_PATHS = Object.freeze({
        mining: {
            id: "mining",
            questId: "focus_training_mining",
            title: "Ciclo do Prospector",
            summary: "Extraia minério, refine lingotes e escolha seu primeiro equipamento forjado.",
            huntId: "apprentice_mines_focus",
            guaranteedEvents: 3,
            minimumQuantity: 2
        },
        skinning: {
            id: "skinning",
            questId: "focus_training_skinning",
            title: "Ciclo do Curtidor",
            summary: "Escolha quais criaturas esfolar, curta as peles e produza seu primeiro equipamento de couro.",
            huntId: "whispering_woods_focus",
            guaranteedEvents: 3,
            minimumQuantity: 2
        },
        herbalism: {
            id: "herbalism",
            questId: "focus_training_herbalism",
            title: "Ciclo do Alquimista",
            summary: "Escolha quais ervas colher, destile extratos e prepare o supply que combina com sua jornada.",
            huntId: "verdant_grove_focus",
            guaranteedEvents: 3,
            minimumQuantity: 2
        }
    });

    const INTRO_PERKS = Object.freeze({
        mining: {
            id: "keen_vein",
            name: "Olhar de Veio",
            description: "+5% de rendimento ao minerar.",
            modifiers: { yieldPercent: 5 }
        },
        skinning: {
            id: "clean_cut",
            name: "Corte Limpo",
            description: "+5% de rendimento ao extrair couro.",
            modifiers: { yieldPercent: 5 }
        },
        herbalism: {
            id: "botanical_instinct",
            name: "Instinto Botânico",
            description: "+8% de chance de encontrar uma erva extra.",
            modifiers: { extraResourceChance: 0.08 }
        },
        blacksmithing: {
            id: "steady_hammer",
            name: "Martelo Firme",
            description: "+3 de qualidade em itens produzidos na forja.",
            modifiers: { craftQuality: 3 }
        }
    });

    const SPECIALIZATION_UNLOCK_LEVEL = 10;
    const SPECIALIZATION_MASTERY_START = 60;
    const SPECIALIZATION_MASTERY_INTERVAL = 25;
    const SPECIALIZATION_TREES = Object.freeze({
        mining: {
            branches: [
                {
                    id: "extractor", perkId: "specialization_extractor", name: "Extrator", icon: "⛏",
                    description: "Prioriza volume e aproveitamento total de cada veio.",
                    masteryModifier: "yieldPercent", masteryStep: 0.75,
                    nodes: [
                        { id: "open_vein", level: 10, name: "Veio Aberto", description: "+3% de rendimento.", modifiers: { yieldPercent: 3 } },
                        { id: "deep_cut", level: 30, name: "Corte Profundo", description: "+4% de rendimento.", modifiers: { yieldPercent: 4 } },
                        { id: "total_excavation", level: 60, name: "Lavra Total", description: "+5% de rendimento.", modifiers: { yieldPercent: 5 } }
                    ]
                },
                {
                    id: "prospector", perkId: "specialization_prospector", name: "Prospector", icon: "✦",
                    description: "Seleciona veios melhores e extrai minério de maior qualidade.",
                    masteryModifier: "resourceQuality", masteryStep: 0.6,
                    nodes: [
                        { id: "ore_reading", level: 10, name: "Leitura da Rocha", description: "+2 de qualidade nos minérios.", modifiers: { resourceQuality: 2 } },
                        { id: "pure_seam", level: 30, name: "Filão Puro", description: "+3 de qualidade nos minérios.", modifiers: { resourceQuality: 3 } },
                        { id: "master_prospection", level: 60, name: "Prospecção Mestra", description: "+5 de qualidade nos minérios.", modifiers: { resourceQuality: 5 } }
                    ]
                }
            ]
        },
        skinning: {
            branches: [
                {
                    id: "field_harvester", perkId: "specialization_field_harvester", name: "Extrator de Campo", icon: "◒",
                    description: "Aproveita mais couro e pele de cada criatura.",
                    masteryModifier: "yieldPercent", masteryStep: 0.75,
                    nodes: [
                        { id: "wide_cut", level: 10, name: "Corte Amplo", description: "+3% de rendimento.", modifiers: { yieldPercent: 3 } },
                        { id: "full_harvest", level: 30, name: "Aproveitamento Integral", description: "+4% de rendimento.", modifiers: { yieldPercent: 4 } },
                        { id: "nothing_wasted", level: 60, name: "Nada se Perde", description: "+5% de rendimento.", modifiers: { yieldPercent: 5 } }
                    ]
                },
                {
                    id: "hide_curator", perkId: "specialization_hide_curator", name: "Curador de Peles", icon: "◇",
                    description: "Preserva as melhores partes e entrega matéria-prima superior.",
                    masteryModifier: "resourceQuality", masteryStep: 0.6,
                    nodes: [
                        { id: "clean_edges", level: 10, name: "Bordas Limpas", description: "+2 de qualidade no couro.", modifiers: { resourceQuality: 2 } },
                        { id: "preserved_fiber", level: 30, name: "Fibra Preservada", description: "+3 de qualidade no couro.", modifiers: { resourceQuality: 3 } },
                        { id: "pristine_hide", level: 60, name: "Pele Impecável", description: "+5 de qualidade no couro.", modifiers: { resourceQuality: 5 } }
                    ]
                }
            ]
        },
        herbalism: {
            branches: [
                {
                    id: "forager", perkId: "specialization_forager", name: "Colhedor", icon: "❧",
                    description: "Colhe mais reagentes sem abandonar partes úteis da planta.",
                    masteryModifier: "yieldPercent", masteryStep: 0.75,
                    nodes: [
                        { id: "careful_harvest", level: 10, name: "Colheita Cuidadosa", description: "+3% de rendimento.", modifiers: { yieldPercent: 3 } },
                        { id: "full_basket", level: 30, name: "Cesto Cheio", description: "+4% de rendimento.", modifiers: { yieldPercent: 4 } },
                        { id: "season_keeper", level: 60, name: "Guardião da Safra", description: "+5% de rendimento.", modifiers: { yieldPercent: 5 } }
                    ]
                },
                {
                    id: "botanist", perkId: "specialization_botanist", name: "Botânico", icon: "✿",
                    description: "Reconhece brotos raros e encontra plantas adicionais.",
                    masteryModifier: "extraResourceChance", masteryStep: 0.005,
                    nodes: [
                        { id: "second_bud", level: 10, name: "Segundo Broto", description: "+2% de chance de erva extra.", modifiers: { extraResourceChance: 0.02 } },
                        { id: "rare_bloom", level: 30, name: "Floração Rara", description: "+3% de chance de erva extra.", modifiers: { extraResourceChance: 0.03 } },
                        { id: "living_catalog", level: 60, name: "Catálogo Vivo", description: "+4% de chance de erva extra.", modifiers: { extraResourceChance: 0.04 } }
                    ]
                }
            ]
        },
        blacksmithing: {
            branches: [
                {
                    id: "master_anvil", perkId: "specialization_master_anvil", name: "Mestre da Bigorna", icon: "⚒",
                    description: "Dedica cada golpe à qualidade final da peça.",
                    masteryModifier: "craftQuality", masteryStep: 0.35,
                    nodes: [
                        { id: "measured_strike", level: 10, name: "Golpe Medido", description: "+1 de qualidade no craft.", modifiers: { craftQuality: 1 } },
                        { id: "tempered_finish", level: 30, name: "Acabamento Temperado", description: "+2 de qualidade no craft.", modifiers: { craftQuality: 2 } },
                        { id: "masterpiece", level: 60, name: "Obra-Prima", description: "+3 de qualidade no craft.", modifiers: { craftQuality: 3 } }
                    ]
                },
                {
                    id: "forge_rhythm", perkId: "specialization_forge_rhythm", name: "Ritmo da Forja", icon: "◆",
                    description: "Transforma repetição consciente em aprendizado mais eficiente.",
                    masteryModifier: "craftXpPercent", masteryStep: 0.75,
                    nodes: [
                        { id: "steady_cycle", level: 10, name: "Ciclo Constante", description: "+4% de XP de Forjaria.", modifiers: { craftXpPercent: 4 } },
                        { id: "hot_workflow", level: 30, name: "Fluxo a Quente", description: "+6% de XP de Forjaria.", modifiers: { craftXpPercent: 6 } },
                        { id: "endless_forge", level: 60, name: "Forja Incansável", description: "+10% de XP de Forjaria.", modifiers: { craftXpPercent: 10 } }
                    ]
                }
            ]
        },
        leatherworking: {
            branches: [
                {
                    id: "leather_artisan", perkId: "specialization_leather_artisan", name: "Artesão do Couro", icon: "◈",
                    description: "Aprimora corte, costura e acabamento de cada peça.",
                    masteryModifier: "craftQuality", masteryStep: 0.35,
                    nodes: [
                        { id: "true_cut", level: 10, name: "Molde Preciso", description: "+1 de qualidade no craft.", modifiers: { craftQuality: 1 } },
                        { id: "reinforced_seam", level: 30, name: "Costura Reforçada", description: "+2 de qualidade no craft.", modifiers: { craftQuality: 2 } },
                        { id: "signature_finish", level: 60, name: "Acabamento de Assinatura", description: "+3 de qualidade no craft.", modifiers: { craftQuality: 3 } }
                    ]
                },
                {
                    id: "tannery_rhythm", perkId: "specialization_tannery_rhythm", name: "Ritmo do Curtume", icon: "◇",
                    description: "Acelera o domínio do ofício mantendo a produção consciente.",
                    masteryModifier: "craftXpPercent", masteryStep: 0.75,
                    nodes: [
                        { id: "prepared_bench", level: 10, name: "Bancada Preparada", description: "+4% de XP de Couraria.", modifiers: { craftXpPercent: 4 } },
                        { id: "learned_hands", level: 30, name: "Mãos Treinadas", description: "+6% de XP de Couraria.", modifiers: { craftXpPercent: 6 } },
                        { id: "endless_tannery", level: 60, name: "Curtume Incansável", description: "+10% de XP de Couraria.", modifiers: { craftXpPercent: 10 } }
                    ]
                }
            ]
        }
    });

    Aethra.ProfessionSystem = {
        initialized: false,
        professions: clone(DEFINITIONS),
        introPaths: clone(INTRO_PATHS),
        focusTrainingPaths: clone(FOCUS_TRAINING_PATHS),
        introPerks: clone(INTRO_PERKS),
        specializationTrees: clone(SPECIALIZATION_TREES),
        specializationUnlockLevel: SPECIALIZATION_UNLOCK_LEVEL,
        specializationMasteryStart: SPECIALIZATION_MASTERY_START,
        specializationMasteryInterval: SPECIALIZATION_MASTERY_INTERVAL,

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
            Aethra.EventBus.on("quest:accepted", ({ id } = {}) => {
                if (!String(id || "").startsWith("intro_profession_")) return;
                this.activateIntroPath(String(id).replace("intro_profession_", ""));
            });
            Aethra.EventBus.on("quest:finished", ({ id } = {}) => {
                if (!String(id || "").startsWith("intro_profession_")) return;
                this.unlockIntroPerk(String(id).replace("intro_profession_", ""));
            });
            Aethra.EventBus.on("quest:objective-updated", ({ questId, objective } = {}) => {
                if (!String(questId || "").startsWith("focus_training_")) return;
                const professionId = String(questId).replace("focus_training_", "");
                if (objective?.type === "ItemAcquired" && objective.completed) {
                    Aethra.ExplorationSystem?.cancelTrainingGuarantee?.(professionId, "focus-materials-complete");
                }
            });
        },

        getXPRequired(level) {
            return Aethra.XPSystem?.getSkillXPRequired?.(level) || 45;
        },

        ensureState(forceReset = false) {
            Aethra.DisciplineSystem?.ensureState?.(forceReset);
            const hero = Aethra.GameState.hero || (Aethra.GameState.hero = {});
            if (forceReset || !hero.professionPerks || typeof hero.professionPerks !== "object" || Array.isArray(hero.professionPerks)) {
                hero.professionPerks = {};
            }
            Object.keys(INTRO_PERKS).forEach((professionId) => {
                if (!Array.isArray(hero.professionPerks[professionId])) {
                    hero.professionPerks[professionId] = [];
                }
                hero.professionPerks[professionId] = [...new Set(hero.professionPerks[professionId].map(String))];
            });
            Object.keys(SPECIALIZATION_TREES).forEach((professionId) => {
                if (!Array.isArray(hero.professionPerks[professionId])) hero.professionPerks[professionId] = [];
                hero.professionPerks[professionId] = [...new Set(hero.professionPerks[professionId].map(String))]
                    .filter(Boolean);
                const selectedBranches = SPECIALIZATION_TREES[professionId].branches
                    .filter((branch) => hero.professionPerks[professionId].includes(branch.perkId));
                selectedBranches.slice(1).forEach((branch) => {
                    hero.professionPerks[professionId] = hero.professionPerks[professionId]
                        .filter((perkId) => perkId !== branch.perkId);
                });
            });
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
            Aethra.QuestSystem?.updateProgress?.("PracticeSkill", professionId, 1, {
                source: options.source || "profession-action",
                action
            });
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
            const progressionBonus = Aethra.XPSystem?.getDiminishingSkillBonus?.(level, { scale: 18, interval: 18 }) || 0;
            return progressionBonus + number(this.getProfessionModifiers(professionId).yieldPercent, 0);
        },

        getIntroPerk(professionId) {
            return INTRO_PERKS[professionId] ? clone(INTRO_PERKS[professionId]) : null;
        },

        hasPerk(professionId, perkId) {
            this.ensureState();
            return Aethra.GameState.hero.professionPerks?.[professionId]?.includes(String(perkId)) === true;
        },

        getUnlockedPerks(professionId) {
            this.ensureState();
            const ids = Aethra.GameState.hero.professionPerks?.[professionId] || [];
            return ids.map((perkId) => {
                const introPerk = INTRO_PERKS[professionId];
                if (introPerk?.id === perkId) return clone(introPerk);
                const branch = SPECIALIZATION_TREES[professionId]?.branches?.find((entry) => entry.perkId === perkId);
                return branch
                    ? { id: perkId, name: branch.name, description: branch.description, modifiers: {}, specializationBranchId: branch.id }
                    : { id: perkId, name: perkId, description: "", modifiers: {} };
            });
        },

        getPerkModifiers(professionId) {
            return this.getUnlockedPerks(professionId).reduce((total, perk) => {
                Object.entries(perk.modifiers || {}).forEach(([key, value]) => {
                    total[key] = number(total[key], 0) + number(value, 0);
                });
                return total;
            }, {});
        },

        getSpecializationTree(professionId) {
            const tree = SPECIALIZATION_TREES[professionId];
            return tree ? { professionId, unlockLevel: SPECIALIZATION_UNLOCK_LEVEL, ...clone(tree) } : null;
        },

        getSpecializationState(professionId) {
            this.ensureState();
            const tree = SPECIALIZATION_TREES[professionId];
            if (!tree) return null;
            const level = this.getState(professionId)?.level || 1;
            const branch = tree.branches.find((entry) => this.hasPerk(professionId, entry.perkId)) || null;
            const pulses = branch && level >= SPECIALIZATION_MASTERY_START
                ? Math.max(0, Math.floor((level - SPECIALIZATION_MASTERY_START) / SPECIALIZATION_MASTERY_INTERVAL))
                : 0;
            const masteryBonus = branch && pulses > 0
                ? number(branch.masteryStep, 0) * Math.log2(pulses + 1)
                : 0;
            const nextMasteryLevel = branch
                ? (level < SPECIALIZATION_MASTERY_START
                    ? SPECIALIZATION_MASTERY_START
                    : SPECIALIZATION_MASTERY_START + ((pulses + 1) * SPECIALIZATION_MASTERY_INTERVAL))
                : SPECIALIZATION_UNLOCK_LEVEL;
            return {
                professionId,
                level,
                unlockLevel: SPECIALIZATION_UNLOCK_LEVEL,
                branchId: branch?.id || null,
                branch: branch ? clone(branch) : null,
                pulses,
                masteryBonus,
                masteryModifier: branch?.masteryModifier || null,
                nextMasteryLevel
            };
        },

        canChooseSpecialization(professionId, branchId) {
            const tree = SPECIALIZATION_TREES[professionId];
            if (!tree) return { allowed: false, reason: "profession-not-specializable", professionId, branchId };
            const state = this.getSpecializationState(professionId);
            if (!tree.branches.some((branch) => branch.id === branchId)) {
                return { allowed: false, reason: "branch-not-found", professionId, branchId };
            }
            if (state.branchId) return { allowed: false, reason: "specialization-already-chosen", professionId, branchId, state };
            if (state.level < SPECIALIZATION_UNLOCK_LEVEL) {
                return { allowed: false, reason: "insufficient-level", requiredLevel: SPECIALIZATION_UNLOCK_LEVEL, professionId, branchId, state };
            }
            return { allowed: true, professionId, branchId, state };
        },

        chooseSpecialization(professionId, branchId, options = {}) {
            this.ensureState();
            const validation = this.canChooseSpecialization(professionId, branchId);
            if (!validation.allowed) {
                Aethra.EventBus.emit("profession:specialization-rejected", { ...validation, source: options.source || "player-command" });
                return validation;
            }
            const branch = SPECIALIZATION_TREES[professionId].branches.find((entry) => entry.id === branchId);
            Aethra.GameState.hero.professionPerks[professionId].push(branch.perkId);
            const payload = {
                accepted: true,
                professionId,
                branchId,
                branch: clone(branch),
                state: this.getSpecializationState(professionId),
                modifiers: this.getProfessionModifiers(professionId),
                source: options.source || "player-command",
                chosenAt: new Date().toISOString()
            };
            Aethra.EventBus.emit("profession:specialization-chosen", payload);
            Aethra.EventBus.emit("profession:updated", payload);
            if (options.save !== false) Aethra.SaveManager?.save?.("profession-specialization-chosen");
            return clone(payload);
        },

        getSpecializationModifiers(professionId) {
            const state = this.getSpecializationState(professionId);
            if (!state?.branch) return {};
            const modifiers = state.branch.nodes.reduce((total, node) => {
                if (state.level < node.level) return total;
                Object.entries(node.modifiers || {}).forEach(([key, value]) => {
                    total[key] = number(total[key], 0) + number(value, 0);
                });
                return total;
            }, {});
            if (state.masteryModifier && state.masteryBonus > 0) {
                modifiers[state.masteryModifier] = number(modifiers[state.masteryModifier], 0) + state.masteryBonus;
            }
            return modifiers;
        },

        getProfessionModifiers(professionId) {
            return [this.getPerkModifiers(professionId), this.getSpecializationModifiers(professionId)]
                .reduce((combined, group) => {
                    Object.entries(group || {}).forEach(([key, value]) => {
                        combined[key] = number(combined[key], 0) + number(value, 0);
                    });
                    return combined;
                }, {});
        },

        unlockPerk(professionId, perkId, options = {}) {
            this.ensureState();
            const perk = INTRO_PERKS[professionId];
            if (!perk || perk.id !== perkId || this.hasPerk(professionId, perkId)) return false;
            Aethra.GameState.hero.professionPerks[professionId].push(perkId);
            const payload = { professionId, perk: clone(perk), source: options.source || "profession-progression" };
            if (options.emit !== false) Aethra.EventBus.emit("profession:perk-unlocked", payload);
            if (options.save !== false) Aethra.SaveManager?.save?.("profession-perk-unlocked");
            return clone(payload);
        },

        unlockIntroPerk(professionId, options = {}) {
            const perk = INTRO_PERKS[professionId];
            return perk ? this.unlockPerk(professionId, perk.id, { source: "intro-profession-quest", ...options }) : false;
        },

        reconcileIntroPerks() {
            this.ensureState();
            const completedIds = new Set((Aethra.GameState.quests?.completed || []).map((quest) => quest?.id));
            const unlocked = [];
            Object.keys(INTRO_PERKS).forEach((professionId) => {
                if (!completedIds.has(`intro_profession_${professionId}`)) return;
                const result = this.unlockIntroPerk(professionId, { emit: false, save: false });
                if (result) unlocked.push(result);
            });
            return unlocked;
        },

        getIntroQuestDefinition(professionId) {
            const path = INTRO_PATHS[professionId];
            if (!path) return null;
            const objectivesByProfession = {
                mining: [
                    {
                        id: "practice_mining",
                        type: "PracticeSkill",
                        target: "mining",
                        huntId: "whispering_forest",
                        required: 1,
                        label: "Minere um veio no Bosque dos Sussurros"
                    },
                    {
                        id: "collect_first_iron_ore",
                        type: "ItemAcquired",
                        target: "iron_ore",
                        huntId: "whispering_forest",
                        required: 1,
                        label: "Colete seu primeiro Minério de Ferro"
                    }
                ],
                skinning: [
                    {
                        id: "practice_skinning",
                        type: "PracticeSkill",
                        target: "skinning",
                        huntId: "whispering_forest",
                        required: 1,
                        label: "Aproveite o couro de uma fera derrotada"
                    },
                    {
                        id: "collect_first_beast_hide",
                        type: "ItemAcquired",
                        target: "beast_hide",
                        huntId: "whispering_forest",
                        required: 1,
                        label: "Colete seu primeiro Couro de Fera"
                    }
                ],
                herbalism: [
                    {
                        id: "practice_herbalism",
                        type: "PracticeSkill",
                        target: "herbalism",
                        huntId: "whispering_forest",
                        required: 1,
                        label: "Colha um foco de ervas no Bosque dos Sussurros"
                    },
                    {
                        id: "collect_first_wild_herb",
                        type: "ItemAcquired",
                        target: "wild_herb",
                        huntId: "whispering_forest",
                        required: 1,
                        label: "Colete sua primeira Erva Silvestre"
                    }
                ],
                blacksmithing: [
                    {
                        id: "receive_training_ore",
                        type: "ItemAcquired",
                        target: "iron_ore",
                        professionId: "blacksmithing",
                        required: 2,
                        label: "Receba 2 Minérios de Ferro para treinamento"
                    },
                    {
                        id: "craft_first_ingot",
                        type: "CraftRecipe",
                        target: "smelt_iron",
                        professionId: "blacksmithing",
                        required: 1,
                        label: "Funda seu primeiro Lingote de Ferro na oficina"
                    }
                ]
            };
            return {
                id: `intro_profession_${professionId}`,
                title: path.title,
                description: path.summary,
                levelReq: 1,
                objectives: clone(objectivesByProfession[professionId] || []),
                reward: { gold: 40, xp: 75, items: [] }
            };
        },

        getFocusTrainingQuestDefinition(professionId) {
            const path = FOCUS_TRAINING_PATHS[professionId];
            if (!path) return null;
            if (professionId === "mining") {
                return {
                    id: path.questId,
                    title: path.title,
                    description: path.summary,
                    levelReq: 1,
                    objectives: [
                        {
                            id: "practice_focus_mining",
                            type: "PracticeSkill",
                            target: "mining",
                            huntId: path.huntId,
                            required: 1,
                            label: "Minere manualmente um veio nas Galerias do Aprendiz"
                        },
                        {
                            id: "collect_focus_ore",
                            type: "ItemAcquired",
                            target: "iron_ore",
                            huntId: path.huntId,
                            required: 6,
                            dependsOn: ["practice_focus_mining"],
                            label: "Reúna 6 Minérios de Ferro"
                        },
                        {
                            id: "smelt_focus_ingots",
                            type: "CraftRecipe",
                            target: "smelt_iron",
                            professionId: "blacksmithing",
                            required: 3,
                            dependsOn: ["collect_focus_ore"],
                            label: "Funda 3 Lingotes de Ferro na Forja da Cidade"
                        },
                        {
                            id: "forge_focus_equipment",
                            type: "CraftEquipment",
                            target: "blacksmithing",
                            professionId: "blacksmithing",
                            allowedRecipeIds: ["forge_iron_sword", "forge_iron_axe", "forge_iron_mace"],
                            required: 1,
                            dependsOn: ["smelt_focus_ingots"],
                            label: "Escolha e forje seu primeiro equipamento de ferro"
                        }
                    ],
                    reward: { gold: 0, xp: 0, items: [] }
                };
            }
            if (professionId === "skinning") {
                return {
                    id: path.questId,
                    title: path.title,
                    description: path.summary,
                    levelReq: 1,
                    objectives: [
                        {
                            id: "practice_focus_skinning",
                            type: "PracticeSkill",
                            target: "skinning",
                            huntId: path.huntId,
                            required: 1,
                            label: "Esfole manualmente uma criatura na Floresta dos Sussurros"
                        },
                        {
                            id: "collect_focus_hides",
                            type: "ItemAcquired",
                            target: "beast_hide",
                            huntId: path.huntId,
                            required: 6,
                            dependsOn: ["practice_focus_skinning"],
                            label: "Reúna 6 Peles de Fera"
                        },
                        {
                            id: "tan_focus_leather",
                            type: "CraftRecipe",
                            target: "tan_beast_hide",
                            professionId: "leatherworking",
                            required: 3,
                            dependsOn: ["collect_focus_hides"],
                            label: "Produza 3 Couros Tratados no Curtume da Cidade"
                        },
                        {
                            id: "craft_focus_leather_equipment",
                            type: "CraftEquipment",
                            target: "leatherworking",
                            professionId: "leatherworking",
                            allowedRecipeIds: ["craft_leather_boots", "craft_leather_helm", "craft_leather_legs"],
                            required: 1,
                            dependsOn: ["tan_focus_leather"],
                            label: "Escolha e produza seu primeiro equipamento de couro"
                        }
                    ],
                    reward: { gold: 0, xp: 0, items: [] }
                };
            }
            if (professionId === "herbalism") {
                return {
                    id: path.questId,
                    title: path.title,
                    description: path.summary,
                    levelReq: 1,
                    objectives: [
                        {
                            id: "practice_focus_herbalism",
                            type: "PracticeSkill",
                            target: "herbalism",
                            huntId: path.huntId,
                            required: 1,
                            label: "Colha manualmente uma erva na Clareira Verdejante"
                        },
                        {
                            id: "collect_focus_herbs",
                            type: "ItemAcquired",
                            target: "wild_herb",
                            huntId: path.huntId,
                            required: 6,
                            dependsOn: ["practice_focus_herbalism"],
                            label: "Reúna 6 Ervas Silvestres"
                        },
                        {
                            id: "distill_focus_extracts",
                            type: "CraftRecipe",
                            target: "distill_wild_herb",
                            professionId: "alchemy",
                            required: 3,
                            dependsOn: ["collect_focus_herbs"],
                            label: "Destile 3 Extratos Botânicos no Laboratório"
                        },
                        {
                            id: "brew_focus_supply",
                            type: "CraftSupply",
                            target: "alchemy",
                            professionId: "alchemy",
                            allowedRecipeIds: ["brew_health_potion", "brew_mana_potion", "brew_vigor_tonic"],
                            required: 1,
                            dependsOn: ["distill_focus_extracts"],
                            label: "Escolha e prepare seu primeiro supply alquímico"
                        }
                    ],
                    reward: { gold: 0, xp: 0, items: [] }
                };
            }
            return null;
        },

        prepareTrainingPath(professionId, options = {}) {
            const path = INTRO_PATHS[professionId];
            if (!path) return false;
            const hero = Aethra.GameState.hero || (Aethra.GameState.hero = {});
            hero.introPrepared = hero.introPrepared && typeof hero.introPrepared === "object"
                ? hero.introPrepared
                : {};
            const policy = DEFINITIONS[professionId]?.policy ? this.getPolicy(professionId) : null;
            const alreadyPrepared = hero.introPrepared[professionId] === true
                || Boolean(policy?.changedAt)
                || (path.toolId && number(Aethra.BagSystem?.countItem?.(path.toolId), 0) > 0);
            if (DEFINITIONS[professionId]?.policy && !alreadyPrepared) {
                this.setCollectionPolicy(professionId, true, options.source || "profession-training");
            }

            if (path.toolId && number(Aethra.BagSystem?.countItem?.(path.toolId), 0) === 0) {
                const tool = Aethra.ItemSystem?.generateItem?.(path.toolId, {
                    origin: options.origin || "profession-training",
                    quality: 20,
                    potential: 20,
                    tradeable: false
                });
                if (tool) {
                    tool.bound = true;
                    tool.tradeable = false;
                    Aethra.BagSystem?.addItem?.(tool, options.source || "profession-training");
                }
            }
            hero.introPrepared[professionId] = true;
            return { professionId, path: clone(path), alreadyPrepared };
        },

        startIntroPath(professionId, options = {}) {
            const path = INTRO_PATHS[professionId];
            if (!path) return false;
            const hero = Aethra.GameState.hero || (Aethra.GameState.hero = {});
            const training = this.prepareTrainingPath(professionId, {
                source: options.source || "intro-profession",
                origin: "intro-profession"
            });
            if (!hero.introProfessionId || options.setAsOrigin === true) hero.introProfessionId = professionId;

            const questId = `intro_profession_${professionId}`;
            Aethra.QuestSystem?.registerQuest?.(
                questId,
                this.getIntroQuestDefinition(professionId)
            );
            Aethra.EventBus.emit("profession:intro-prepared", { professionId, path: clone(path), questId });
            return { professionId, path: clone(path), questId, alreadyPrepared: training?.alreadyPrepared === true };
        },

        activateIntroPath(professionId, options = {}) {
            const path = INTRO_PATHS[professionId];
            if (!path) return false;
            const prepared = this.startIntroPath(professionId, options);
            const hero = Aethra.GameState.hero || (Aethra.GameState.hero = {});
            hero.introProvisioned = hero.introProvisioned && typeof hero.introProvisioned === "object"
                ? hero.introProvisioned
                : {};

            if (professionId === "blacksmithing" && !hero.introProvisioned.blacksmithing) {
                const ore = Aethra.ItemSystem?.generateItem?.("iron_ore", {
                    quantity: 2,
                    source: "intro-profession:blacksmithing",
                    origin: "intro-profession",
                    quality: 20,
                    potential: 20,
                    tradeable: false
                });
                if (ore && Aethra.BagSystem?.addItem?.(ore, "intro-profession:blacksmithing")) {
                    hero.introProvisioned.blacksmithing = true;
                    Aethra.EventBus.emit("ItemAcquired", ore);
                }
            } else if (["mining", "skinning", "herbalism"].includes(professionId)) {
                Aethra.ExplorationSystem?.queueIntroGuarantee?.(professionId, {
                    huntId: path.huntId || "whispering_forest"
                });
            }

            hero.introProfessionActivatedAt = hero.introProfessionActivatedAt || new Date().toISOString();
            Aethra.EventBus.emit("profession:intro-started", {
                professionId,
                path: clone(path),
                questId: prepared.questId
            });
            return prepared;
        },

        activateFocusTraining(professionId, options = {}) {
            const path = FOCUS_TRAINING_PATHS[professionId];
            if (!path) return false;
            this.prepareTrainingPath(professionId, {
                source: options.source || "focus-training",
                origin: "focus-training"
            });
            Aethra.QuestSystem?.registerQuest?.(
                path.questId,
                this.getFocusTrainingQuestDefinition(professionId)
            );
            const quest = options.accept === false
                ? Aethra.QuestSystem?.getQuest?.(path.questId)
                : Aethra.QuestSystem?.acceptQuest?.(path.questId);
            const activeQuest = Aethra.QuestSystem?.getQuest?.(path.questId) || quest;
            const resourceObjective = activeQuest?.objectives?.find((entry) => entry.type === "ItemAcquired");
            if (activeQuest?.status === "active" && !resourceObjective?.completed) {
                const missing = Math.max(1, Number(resourceObjective?.required || 6) - Number(resourceObjective?.progress || 0));
                const remaining = Math.max(1, Math.ceil(missing / Math.max(1, Number(path.minimumQuantity || 1))));
                Aethra.ExplorationSystem?.queueTrainingGuarantee?.(professionId, {
                    huntId: options.huntId || path.huntId,
                    remaining,
                    manual: true,
                    guaranteedSuccess: true,
                    minimumQuantity: path.minimumQuantity,
                    source: "focus-training",
                    activationSource: options.source || "focus-training"
                });
            }
            const payload = this.getFocusTrainingState(professionId);
            Aethra.EventBus.emit("profession:focus-training-activated", clone(payload || { professionId }));
            return payload;
        },

        pauseFocusTraining(professionId, source = "focus-changed") {
            return Aethra.ExplorationSystem?.cancelTrainingGuarantee?.(professionId, source) || false;
        },

        getFocusTrainingState(professionId) {
            const path = FOCUS_TRAINING_PATHS[professionId];
            if (!path) return null;
            const quest = Aethra.QuestSystem?.getQuest?.(path.questId) || null;
            const guidance = quest?.status === "active" ? Aethra.QuestSystem?.getGuidance?.(quest) : null;
            const progress = quest ? Aethra.QuestSystem?.getProgress?.(quest) : { progress: 0, required: 0, percent: 0 };
            return {
                professionId,
                questId: path.questId,
                title: path.title,
                summary: path.summary,
                huntId: path.huntId,
                status: quest?.status || "available",
                active: quest?.status === "active",
                completed: quest?.status === "completed",
                quest: quest ? clone(quest) : null,
                guidance: guidance ? clone(guidance) : null,
                progress: clone(progress)
            };
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
