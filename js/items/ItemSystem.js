// ItemSystem.js - Seção 9: Itens individualizados
// Gera instâncias únicas de itens para LootSystem, BagSystem e EquipSystem.
// Requer game-core.js e GameData.js carregados antes deste arquivo.

window.Aethra = window.Aethra || {};

(function initItemSystem(Aethra) {
    "use strict";

    if (!Aethra.GameState || !Aethra.EventBus || !Aethra.GameData) {
        throw new Error("ItemSystem.js requer game-core.js e GameData.js carregados antes deste arquivo.");
    }

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const deepClone = (value) => JSON.parse(JSON.stringify(value));

    let fallbackIdCounter = 0;

    function randomInt(randomSource, min, max) {
        const low = Math.ceil(Math.min(min, max));
        const high = Math.floor(Math.max(min, max));
        return Math.floor(randomSource() * (high - low + 1)) + low;
    }

    function round(value, decimals = 2) {
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
    }

    function normalizeRollPercent(value, minimum, maximum) {
        const numeric = Number(value);
        const min = Number(minimum);
        const max = Number(maximum);

        if (
            !Number.isFinite(numeric) ||
            !Number.isFinite(min) ||
            !Number.isFinite(max) ||
            max <= min
        ) {
            return 100;
        }

        return round(clamp((numeric - min) / (max - min), 0, 1) * 100, 1);
    }

    function average(values) {
        const valid = values
            .map(Number)
            .filter(Number.isFinite);

        if (valid.length === 0) return 100;
        return round(valid.reduce((sum, value) => sum + value, 0) / valid.length, 1);
    }

    function createUniqueId(prefix) {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return `${prefix}_${window.crypto.randomUUID()}`;
        }

        fallbackIdCounter += 1;
        const time = Date.now().toString(36);
        const performancePart = typeof performance !== "undefined"
            ? Math.floor(performance.now() * 1000).toString(36)
            : "0";
        const randomPart = Math.random().toString(36).slice(2, 11);

        return `${prefix}_${time}_${performancePart}_${fallbackIdCounter}_${randomPart}`;
    }

    function normalizeBaseStats(template) {
        const stats = { ...(template.baseStats || template.stats || {}) };

        if (Number.isFinite(Number(template.baseDamage))) {
            const baseDamage = Number(template.baseDamage);
            stats.damageMin = Number.isFinite(Number(stats.damageMin))
                ? Number(stats.damageMin)
                : Math.max(1, Math.floor(baseDamage * 0.85));
            stats.damageMax = Number.isFinite(Number(stats.damageMax))
                ? Number(stats.damageMax)
                : Math.max(stats.damageMin, Math.ceil(baseDamage * 1.15));
        }

        if (Number.isFinite(Number(template.baseDefense))) {
            stats.defense = Number.isFinite(Number(stats.defense))
                ? Number(stats.defense)
                : Number(template.baseDefense);
        }

        return stats;
    }

    function qualityMultiplier(quality) {
        // Q1 = 0,76x | Q50 = 1,00x | Q100 = 1,25x
        return 0.75 + quality * 0.005;
    }

    function getRarityScore(quality, potential, luckBonus = 0) {
        return clamp(
            quality * 0.62 + potential * 0.38 + Number(luckBonus || 0),
            0,
            100
        );
    }

    const RARITY_TIERS = [
        { id: "common", name: "Comum", minScore: 0, affixMin: 0, affixMax: 0, priceMult: 1 },
        { id: "uncommon", name: "Incomum", minScore: 52, affixMin: 1, affixMax: 1, priceMult: 1.35 },
        { id: "rare", name: "Raro", minScore: 68, affixMin: 1, affixMax: 2, priceMult: 2.1 },
        { id: "epic", name: "Épico", minScore: 81, affixMin: 2, affixMax: 3, priceMult: 3.7 },
        { id: "legendary", name: "Lendário", minScore: 91, affixMin: 3, affixMax: 4, priceMult: 7.5 },
        { id: "mythic", name: "Mítico", minScore: 98, affixMin: 4, affixMax: 5, priceMult: 15 }
    ];

    function resolveRarity(quality, potential, forcedRarity, luckBonus = 0) {
        if (forcedRarity) {
            const normalized = String(forcedRarity).toLowerCase();
            const forced = RARITY_TIERS.find((tier) =>
                tier.id === normalized || tier.name.toLowerCase() === normalized
            );
            if (forced) return forced;
        }

        const score = getRarityScore(quality, potential, luckBonus);
        return [...RARITY_TIERS]
            .reverse()
            .find((tier) => score >= tier.minScore) || RARITY_TIERS[0];
    }

    function affixAppliesTo(affix, template) {
        const allowedSlots = affix.slots || ["any"];
        const allowedTypes = affix.types || ["any"];
        const slotMatch = allowedSlots.includes("any") || allowedSlots.includes(template.slot);
        const typeMatch = allowedTypes.includes("any") || allowedTypes.includes(template.type);
        return slotMatch && typeMatch;
    }

    function buildDisplayName(template, affixes) {
        const prefixes = affixes.filter((affix) => affix.kind === "prefix");
        const suffixes = affixes.filter((affix) => affix.kind === "suffix");

        const prefixText = prefixes.length > 0
            ? `${prefixes.map((affix) => affix.name).join(" ")} `
            : "";
        const suffixText = suffixes.length > 0
            ? ` ${suffixes.map((affix) => affix.name).join(" ")}`
            : "";

        return `${prefixText}${template.name}${suffixText}`.trim();
    }

    Aethra.ItemTemplates = Aethra.ItemTemplates || {};

    function normalizeTemplateFromGameData(templateId, data) {
        const source = deepClone(data || {});
        const type = source.type || "misc";
        const damage = Number(source.damage);
        const defense = Number(source.defense);
        const effect = Number(source.effect);

        const baseStats = { ...(source.baseStats || source.stats || {}) };

        [
            "damageMin",
            "damageMax",
            "defense",
            "str",
            "mag",
            "precision",
            "critical",
            "evasion",
            "blockChance",
            "blockReduction",
            "hpMax",
            "manaMax"
        ].forEach((stat) => {
            const value = Number(source[stat]);
            if (Number.isFinite(value)) {
                baseStats[stat] = value;
            }
        });

        if (Number.isFinite(damage)) {
            baseStats.damageMin = Number.isFinite(Number(baseStats.damageMin))
                ? Number(baseStats.damageMin)
                : damage;
            baseStats.damageMax = Number.isFinite(Number(baseStats.damageMax))
                ? Number(baseStats.damageMax)
                : damage;
        }

        if (Number.isFinite(defense)) {
            baseStats.defense = Number.isFinite(Number(baseStats.defense))
                ? Number(baseStats.defense)
                : defense;
        }

        const inferredSlot = source.slot || (
            type === "weapon" ? "weapon" :
            type === "armor" ? "chest" :
            null
        );

        const inferredStackable = source.stackable !== undefined
            ? Boolean(source.stackable)
            : ["consumable", "material"].includes(type);

        return {
            ...source,
            id: templateId,
            name: source.name || templateId,
            type,
            slot: inferredSlot,
            basePrice: Number(source.basePrice ?? source.price) || 0,
            price: Number(source.price ?? source.basePrice) || 0,
            stackable: inferredStackable,
            maxStack: Number(source.maxStack) || (inferredStackable ? 20 : 1),
            baseDamage: Number.isFinite(damage) ? damage : undefined,
            baseDefense: Number.isFinite(defense) ? defense : undefined,
            effect: Number.isFinite(effect) ? effect : source.effect,
            baseStats
        };
    }

    function syncTemplatesFromGameData() {
        Object.entries(Aethra.GameData.items || {}).forEach(([templateId, data]) => {
            Aethra.ItemTemplates[templateId] = normalizeTemplateFromGameData(
                templateId,
                data
            );
        });

        return Aethra.ItemTemplates;
    }

    syncTemplatesFromGameData();

    Aethra.ItemSystem = {
        templates: Aethra.ItemTemplates,
        rarityTiers: RARITY_TIERS.map((tier) => ({ ...tier })),
        randomSource: Math.random,

        affixPool: {
            tempered: {
                id: "tempered",
                name: "Temperada",
                kind: "prefix",
                slots: ["weapon"],
                types: ["weapon"],
                stat: "damageMax",
                min: 2,
                max: 6
            },
            precise: {
                id: "precise",
                name: "Precisa",
                kind: "prefix",
                slots: ["weapon"],
                types: ["weapon"],
                stat: "precision",
                min: 2,
                max: 7
            },
            brutal: {
                id: "brutal",
                name: "Brutal",
                kind: "prefix",
                slots: ["weapon"],
                types: ["weapon"],
                stat: "str",
                min: 1,
                max: 4
            },
            of_power: {
                id: "of_power",
                name: "do Poder",
                kind: "suffix",
                slots: ["weapon", "chest", "head", "hands", "legs", "feet", "ring1", "ring2", "relic"],
                types: ["weapon", "armor", "accessory"],
                stat: "str",
                min: 1,
                max: 5
            },
            of_critical: {
                id: "of_critical",
                name: "do Golpe Crítico",
                kind: "suffix",
                slots: ["weapon", "ring1", "ring2", "relic"],
                types: ["weapon", "accessory"],
                stat: "critical",
                min: 0.01,
                max: 0.05,
                decimals: 3
            },
            reinforced: {
                id: "reinforced",
                name: "Reforçada",
                kind: "prefix",
                slots: ["chest", "head", "hands", "legs", "feet", "offhand"],
                types: ["armor", "shield"],
                stat: "defense",
                min: 2,
                max: 8
            },
            agile: {
                id: "agile",
                name: "Ágil",
                kind: "prefix",
                slots: ["chest", "head", "hands", "legs", "feet", "ring1", "ring2"],
                types: ["armor", "accessory"],
                stat: "evasion",
                min: 0.01,
                max: 0.04,
                decimals: 3
            },
            of_guarding: {
                id: "of_guarding",
                name: "da Guarda",
                kind: "suffix",
                slots: ["chest", "offhand", "head", "hands", "legs", "feet"],
                types: ["armor", "shield"],
                stat: "blockChance",
                min: 0.01,
                max: 0.05,
                decimals: 3
            },
            arcane: {
                id: "arcane",
                name: "Arcana",
                kind: "prefix",
                slots: ["weapon", "offhand", "ring1", "ring2", "relic"],
                types: ["weapon", "accessory", "focus"],
                stat: "mag",
                min: 1,
                max: 5
            },
            of_vitality: {
                id: "of_vitality",
                name: "da Vitalidade",
                kind: "suffix",
                slots: ["any"],
                types: ["weapon", "armor", "accessory", "shield", "focus"],
                stat: "hpMax",
                min: 8,
                max: 30
            }
        },

        setRandomSource(fn) {
            if (typeof fn !== "function") {
                throw new TypeError("ItemSystem.setRandomSource: fn deve ser uma função.");
            }
            this.randomSource = fn;
        },

        registerTemplate(templateId, template) {
            if (typeof templateId !== "string" || !templateId.trim()) {
                throw new TypeError("ItemSystem.registerTemplate: templateId inválido.");
            }
            if (!template || typeof template !== "object") {
                throw new TypeError("ItemSystem.registerTemplate: template inválido.");
            }

            Aethra.GameData.items = Aethra.GameData.items || {};
            Aethra.GameData.items[templateId] = deepClone(template);

            const normalized = normalizeTemplateFromGameData(
                templateId,
                Aethra.GameData.items[templateId]
            );

            Aethra.ItemTemplates[templateId] = normalized;
            this.templates = Aethra.ItemTemplates;

            Aethra.EventBus.emit("gamedata:item-registered", {
                itemId: templateId,
                item: deepClone(Aethra.GameData.items[templateId])
            });

            Aethra.EventBus.emit("item:template-registered", {
                templateId,
                template: deepClone(normalized)
            });

            return normalized;
        },

        syncFromGameData() {
            syncTemplatesFromGameData();
            this.templates = Aethra.ItemTemplates;

            Aethra.EventBus.emit("item:templates-synced", {
                templates: Object.keys(this.templates)
            });

            return this.templates;
        },

        registerAffix(affixId, affix) {
            if (typeof affixId !== "string" || !affixId.trim()) {
                throw new TypeError("ItemSystem.registerAffix: affixId inválido.");
            }
            if (!affix || typeof affix !== "object") {
                throw new TypeError("ItemSystem.registerAffix: affix inválido.");
            }

            this.affixPool[affixId] = { id: affixId, ...deepClone(affix) };
            Aethra.EventBus.emit("item:affix-registered", {
                affixId,
                affix: this.affixPool[affixId]
            });
            return this.affixPool[affixId];
        },

        rollAffixes(template, rarity, options = {}) {
            if (template.stackable || !template.slot) return [];

            const available = Object.values(this.affixPool)
                .filter((affix) => affixAppliesTo(affix, template));

            if (available.length === 0) return [];

            const requestedCount = Number.isFinite(Number(options.affixCount))
                ? Number(options.affixCount)
                : randomInt(this.randomSource, rarity.affixMin, rarity.affixMax);
            const count = clamp(requestedCount, 0, available.length);
            const selected = [];
            const candidates = [...available];

            while (selected.length < count && candidates.length > 0) {
                const index = randomInt(this.randomSource, 0, candidates.length - 1);
                const definition = candidates.splice(index, 1)[0];
                const decimals = Number.isFinite(definition.decimals)
                    ? definition.decimals
                    : 0;
                const rawValue = definition.min +
                    this.randomSource() * (definition.max - definition.min);
                const value = round(rawValue, decimals);

                selected.push({
                    id: definition.id,
                    name: definition.name,
                    kind: definition.kind || "suffix",
                    stat: definition.stat,
                    value,
                    // O IV do afixo é derivado do valor realmente rolado.
                    // Não existe mais um segundo sorteio visual desconectado.
                    rollPercent: normalizeRollPercent(
                        value,
                        definition.min,
                        definition.max
                    )
                });
            }

            return selected;
        },


        rollItemMultiplier(rarity, template, options = {}) {
            if (template.stackable || !template.slot) {
                return 1;
            }

            const forced = Number(
                options.statMultiplier ?? options.multiplier
            );

            if (Number.isFinite(forced) && forced > 0) {
                return round(forced, 2);
            }

            const definition =
                Aethra.GameData.getRarityPresentation?.(rarity.id) ||
                Aethra.GameData.itemGeneration?.rarities?.[rarity.id] ||
                {
                    multiplierMin: qualityMultiplier(1),
                    multiplierMax: qualityMultiplier(100)
                };

            const minimum = Number(definition.multiplierMin || 1);
            const maximum = Number(definition.multiplierMax || minimum);

            return round(
                minimum + this.randomSource() * (maximum - minimum),
                2
            );
        },

        rollBaseStats(template, quality, statMultiplier = null) {
            const baseStats = normalizeBaseStats(template);
            const multiplier = Number.isFinite(Number(statMultiplier))
                ? Number(statMultiplier)
                : qualityMultiplier(quality);
            const rolledStats = {};
            const individualRolls = {};
            const individualMultipliers = {};

            Object.entries(baseStats).forEach(([stat, baseValue]) => {
                const numericBase = Number(baseValue);
                if (!Number.isFinite(numericBase)) return;

                // Cada atributo recebe sua própria rolagem. Isso evita que a qualidade
                // seja apenas um multiplicador uniforme em todos os valores.
                const rollPercent = randomInt(this.randomSource, 85, 115);
                individualRolls[stat] = rollPercent;
                individualMultipliers[stat] = round(rollPercent / 100, 2);

                const effectiveMultiplier = multiplier * (rollPercent / 100);
                const decimals = Math.abs(numericBase) < 1 ? 3 : 0;
                rolledStats[stat] = Math.max(
                    numericBase > 0 && decimals === 0 ? 1 : 0,
                    round(numericBase * effectiveMultiplier, decimals)
                );
            });

            if (
                Number.isFinite(rolledStats.damageMin) &&
                Number.isFinite(rolledStats.damageMax) &&
                rolledStats.damageMax < rolledStats.damageMin
            ) {
                rolledStats.damageMax = rolledStats.damageMin;
            }

            return {
                baseStats,
                rolledStats,
                individualRolls,
                individualMultipliers,
                statMultiplier: round(multiplier, 2)
            };
        },

        applyAffixes(stats, affixes) {
            const result = { ...stats };

            affixes.forEach((affix) => {
                if (!affix.stat || !Number.isFinite(Number(affix.value))) return;
                result[affix.stat] = round(
                    (Number(result[affix.stat]) || 0) + Number(affix.value),
                    Math.abs(Number(affix.value)) < 1 ? 3 : 0
                );
            });

            return result;
        },

        generateItem(templateId, options = {}) {
            if (
                !Aethra.ItemTemplates[templateId] &&
                Aethra.GameData.items?.[templateId]
            ) {
                Aethra.ItemTemplates[templateId] =
                    normalizeTemplateFromGameData(
                        templateId,
                        Aethra.GameData.items[templateId]
                    );
            }

            const template = Aethra.ItemTemplates[templateId];

            if (!template) {
                const error = {
                    code: "ITEM_TEMPLATE_NOT_FOUND",
                    templateId
                };

                Aethra.EventBus.emit("item:error", error);
                console.error(
                    `[ItemSystem] Template não encontrado: ${templateId}`
                );
                return null;
            }

            const qualityMin = Number.isFinite(Number(options.qualityMin))
                ? Number(options.qualityMin)
                : 1;
            const qualityMax = Number.isFinite(Number(options.qualityMax))
                ? Number(options.qualityMax)
                : 100;
            const potentialMin = Number.isFinite(Number(options.potentialMin))
                ? Number(options.potentialMin)
                : 1;
            const potentialMax = Number.isFinite(Number(options.potentialMax))
                ? Number(options.potentialMax)
                : 100;

            const quality = Number.isFinite(Number(options.quality))
                ? clamp(Math.floor(Number(options.quality)), 1, 100)
                : randomInt(this.randomSource, qualityMin, qualityMax);
            const potential = Number.isFinite(Number(options.potential))
                ? clamp(Math.floor(Number(options.potential)), 1, 100)
                : randomInt(this.randomSource, potentialMin, potentialMax);

            const rarity = resolveRarity(
                quality,
                potential,
                options.rarity,
                options.luckBonus
            );

            const statMultiplier = this.rollItemMultiplier(
                rarity,
                template,
                options
            );

            const roll = this.rollBaseStats(
                template,
                quality,
                statMultiplier
            );

            const affixes = Array.isArray(options.affixes)
                ? deepClone(options.affixes)
                : this.rollAffixes(template, rarity, options);

            const quantity = template.stackable
                ? clamp(
                    Math.floor(Number(options.quantity) || 1),
                    1,
                    template.maxStack || 999
                )
                : 1;

            const createdAt = new Date().toISOString();
            const instanceId = createUniqueId(`item_${templateId}`);

            const draft = {
                instanceId,
                seed: createUniqueId("seed"),
                templateId,
                name: buildDisplayName(template, affixes),
                baseName: template.name,
                description: template.description || "",
                image: template.image || template.icon || null,
                weaponFamily: template.weaponFamily || template.family || null,
                type: template.type || "misc",
                itemType: String(
                    template.itemType ||
                    template.type ||
                    "misc"
                ).trim().toUpperCase(),
                slot: template.slot || null,
                allowedSlots: deepClone(
                    template.allowedSlots ||
                    (template.slot ? [template.slot] : [])
                ),
                rarity: rarity.name,
                rarityId: rarity.id,
                quality,
                potential,
                statMultiplier,
                multiplier: statMultiplier,
                baseStats: deepClone(roll.baseStats),
                baseRolls: deepClone(roll.individualRolls),
                individualMultipliers: deepClone(
                    roll.individualMultipliers
                ),
                affixes,
                quantity,
                stackable: Boolean(template.stackable),
                maxStack: template.maxStack || 1,
                effect: template.effect ?? null,
                healAmount:
                    Number(template.healAmount ?? template.effect) || 0
            };

            const finalStats =
                Aethra.GameData.calculateItemStats(draft);

            const basePrice =
                Number(template.basePrice ?? template.price) || 0;

            const statValue = Object.values(finalStats).reduce(
                (sum, value) => {
                    const numeric = Number(value);
                    return Number.isFinite(numeric)
                        ? sum + Math.abs(numeric)
                        : sum;
                },
                0
            );

            const price = Math.max(
                0,
                Math.floor(
                    basePrice * statMultiplier * rarity.priceMult +
                    statValue * 0.5
                )
            );

            const item = {
                ...draft,
                basePrice,
                price,
                stats: finalStats,
                upgrades: {
                    level: 0,
                    maxLevel: Math.max(
                        1,
                        Math.floor(potential / 10)
                    ),
                    investedMaterials: []
                },
                bond: {
                    level: 0,
                    xp: 0,
                    xpNext: 100
                },
                ownership: {
                    ownerId: options.ownerId || null,
                    bound: Boolean(options.bound),
                    tradeable: options.tradeable !== false
                },
                origin: {
                    source: options.source || "generated",
                    enemyId: options.enemyId || null,
                    huntId: options.huntId || null,
                    bossId: options.bossId || null,
                    professionId: options.professionId || null,
                    crafterId: options.crafterId || null,
                    rareEncounterId: options.rareEncounterId || null,
                    economyRollId: options.economyRollId || null,
                    createdAt
                },
                economy: {
                    authority: Aethra.EconomyRNGManager?.config?.authority || "client-prototype",
                    tradeClass: options.tradeClass || (template.stackable ? "stackable" : "individual"),
                    rareEncounter: Boolean(options.rareEncounterId),
                    rollId: options.economyRollId || null
                },
                history: [
                    {
                        type: "created",
                        at: createdAt,
                        source: options.source || "generated"
                    }
                ]
            };

            const inspection = this.getItemInspection(item);
            if (inspection) {
                item.iv = {
                    percent: inspection.ivPercent,
                    tier: inspection.tier,
                    multiplierPercent: inspection.multiplierIV
                };
                item.rollScore = inspection.ivPercent;
            }

            Aethra.EventBus.emit("ItemGenerated", {
                item,
                template,
                options
            });
            Aethra.EventBus.emit("item:generated", {
                item,
                template,
                options
            });

            return item;
        },

        calculateItemStats(item) {
            return Aethra.GameData.calculateItemStats(item);
        },

        /**
         * Retorna a memória completa da rolagem do item.
         *
         * O IV global compara o multiplicador do item com o intervalo possível
         * da raridade. Cada atributo também recebe um IV próprio, calculado a
         * partir da variação individual persistida (85% a 115%).
         */
        getItemInspection(item) {
            if (!item || typeof item !== "object") return null;

            const breakdown =
                Aethra.GameData.getItemStatBreakdown?.(item) || {
                    baseStats: deepClone(item.baseStats || {}),
                    finalStats: deepClone(item.stats || {}),
                    bonuses: {},
                    multiplier: Number(
                        item.statMultiplier ?? item.multiplier ?? 1
                    ),
                    individualMultipliers: deepClone(
                        item.individualMultipliers || {}
                    ),
                    affixBonuses: {},
                    affixes: deepClone(item.affixes || [])
                };

            const rarity =
                Aethra.GameData.getRarityPresentation?.(item) || {
                    id: item.rarityId || "common",
                    name: item.rarity || "Comum",
                    multiplierMin: 1,
                    multiplierMax: 1
                };

            const multiplier = Number(
                breakdown.multiplier ??
                item.statMultiplier ??
                item.multiplier ??
                1
            );
            const multiplierMin = Number(rarity.multiplierMin ?? multiplier);
            const multiplierMax = Number(rarity.multiplierMax ?? multiplier);
            const multiplierIV = normalizeRollPercent(
                multiplier,
                multiplierMin,
                multiplierMax
            );

            const baseStats = breakdown.baseStats || {};
            const finalStats = breakdown.finalStats || {};
            const bonuses = breakdown.bonuses || {};
            const individualMultipliers = {
                ...(breakdown.individualMultipliers || {})
            };

            Object.entries(item.baseRolls || {}).forEach(
                ([stat, rollPercent]) => {
                    if (individualMultipliers[stat] === undefined) {
                        individualMultipliers[stat] = Number(rollPercent) / 100;
                    }
                }
            );

            const attributeRolls = Object.keys({
                ...baseStats,
                ...finalStats,
                ...individualMultipliers
            }).map((stat) => {
                const individualMultiplier = Number(
                    individualMultipliers[stat] ?? 1
                );
                const rawRollPercent = Number(
                    item.baseRolls?.[stat] ??
                    individualMultiplier * 100
                );
                const rollPercent = Number.isFinite(rawRollPercent)
                    ? round(rawRollPercent, 1)
                    : 100;
                const ivPercent = normalizeRollPercent(
                    individualMultiplier,
                    0.85,
                    1.15
                );

                return {
                    stat,
                    base: Number(baseStats[stat] || 0),
                    final: Number(finalStats[stat] || 0),
                    bonus: Number(bonuses[stat] || 0),
                    affixBonus: Number(
                        breakdown.affixBonuses?.[stat] || 0
                    ),
                    individualMultiplier: round(individualMultiplier, 3),
                    rollPercent,
                    ivPercent
                };
            });

            const affixRolls = (item.affixes || []).map((affix) => {
                const definition = this.affixPool?.[affix.id] || null;
                const ivPercent = definition
                    ? normalizeRollPercent(
                        affix.value,
                        definition.min,
                        definition.max
                    )
                    : clamp(Number(affix.rollPercent || 100), 0, 100);

                return {
                    id: affix.id,
                    name: affix.name || affix.id,
                    stat: affix.stat,
                    value: Number(affix.value || 0),
                    ivPercent: round(ivPercent, 1)
                };
            });

            const attributeIV = attributeRolls.length > 0
                ? average(attributeRolls.map((roll) => roll.ivPercent))
                : null;
            const affixIV = affixRolls.length > 0
                ? average(affixRolls.map((roll) => roll.ivPercent))
                : null;
            const potentialIV = clamp(Number(item.potential || 1), 1, 100);
            const weights = Aethra.EconomyRNGManager?.getIVWeights?.() || {
                multiplier: 0.35,
                attributes: 0.35,
                affixes: 0.20,
                potential: 0.10
            };
            const components = [
                { value: multiplierIV, weight: Number(weights.multiplier || 0) },
                ...(attributeIV === null ? [] : [{ value: attributeIV, weight: Number(weights.attributes || 0) }]),
                ...(affixIV === null ? [] : [{ value: affixIV, weight: Number(weights.affixes || 0) }]),
                { value: potentialIV, weight: Number(weights.potential || 0) }
            ].filter((component) => component.weight > 0);
            const totalWeight = Math.max(
                0.0001,
                components.reduce((sum, component) => sum + component.weight, 0)
            );
            const ivPercent = round(
                components.reduce(
                    (sum, component) => sum + component.value * component.weight,
                    0
                ) / totalWeight,
                1
            );

            const strongestAttribute = [...attributeRolls]
                .filter((roll) => Number.isFinite(roll.final))
                .sort((a, b) => Math.abs(b.bonus) - Math.abs(a.bonus))[0] || null;

            return {
                ivPercent,
                tier:
                    ivPercent >= 99 ? "Perfeito" :
                    ivPercent >= 90 ? "Excelente" :
                    ivPercent >= 75 ? "Superior" :
                    ivPercent >= 50 ? "Regular" :
                    "Baixo",
                multiplier: round(multiplier, 2),
                multiplierMin: round(multiplierMin, 2),
                multiplierMax: round(multiplierMax, 2),
                multiplierIV,
                attributeIV,
                affixIV,
                potentialIV,
                ivWeights: deepClone(weights),
                attributeRolls,
                affixRolls,
                strongestAttribute,
                rarity: {
                    id: rarity.id || item.rarityId || "common",
                    name: rarity.name || item.rarity || "Comum",
                    color: rarity.color || "#c7c7c7"
                }
            };
        },

        getItemHardcoreSummary(item) {
            const inspection = this.getItemInspection(item);
            if (!inspection) return null;

            const strongest = inspection.strongestAttribute;

            return {
                name: item.name || item.baseName || item.templateId || "Item",
                rarity: inspection.rarity.name,
                multiplier: inspection.multiplier,
                ivPercent: inspection.ivPercent,
                tier: inspection.tier,
                primaryStat: strongest?.stat || null,
                primaryBase: strongest?.base || 0,
                primaryFinal: strongest?.final || 0,
                primaryBonus: strongest?.bonus || 0,
                text:
                    `${item.name || item.baseName || "Item"} ` +
                    `[${inspection.rarity.name}] | ` +
                    `Mult: ${inspection.multiplier.toFixed(2)}x | ` +
                    `IV: ${inspection.ivPercent.toFixed(1)}%`
            };
        },

        // Alias para compatibilidade com o nome utilizado nos sistemas anteriores.
        generateInstance(templateId, options = {}) {
            return this.generateItem(templateId, options);
        },

        // Integra o LootSystem sem fazer o ItemSystem adicionar diretamente na bag.
        // LootSystem continua responsável por sortear o drop; BagSystem continua
        // responsável por reagir ao evento itemObtained.
        connectLootSystem() {
            if (!Aethra.LootSystem || Aethra.LootSystem.__usesItemSystem) {
                return false;
            }

            Aethra.LootSystem.createInstance = (templateId, options = {}) =>
                this.generateItem(templateId, options);
            Aethra.LootSystem.__usesItemSystem = true;

            Aethra.EventBus.emit("item:loot-system-connected", {
                connected: true
            });
            return true;
        }
    };

    Aethra.ItemSystem.connectLootSystem();

    // Permite carregar ItemSystem antes ou depois de LootSystem.
    Aethra.EventBus.on("loot:ready", () => {
        Aethra.ItemSystem.connectLootSystem();
    });

    Aethra.EventBus.on("gamedata:item-registered", () => {
        Aethra.ItemSystem.syncFromGameData();
    });

    Aethra.EventBus.emit("item-system:ready", {
        templates: Object.keys(Aethra.ItemTemplates),
        affixes: Object.keys(Aethra.ItemSystem.affixPool),
        rarities: Aethra.ItemSystem.rarityTiers.map((tier) => tier.name)
    });
})(window.Aethra);
