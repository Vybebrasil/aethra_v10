// GameData.js - Repositório Central de Dados e Balanceamento
(function (Aethra) {
    "use strict";

    if (!Aethra) {
        throw new Error("GameData.js requer o namespace global window.Aethra.");
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const round = (value, decimals = 3) => {
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
    };

    /*
     * Calibração da curva de XP
     * -------------------------
     * - Nível 1 -> 2: 100 XP, equivalentes a 10 minutos a 10 XP/min.
     * - Nível 1 -> 1000: aproximadamente 8.760 horas na mesma taxa efetiva.
     * - A razão abaixo foi resolvida para a soma geométrica de 999 níveis.
     */
    const XP_GROWTH = 1.0057337263598426;

    Aethra.GameData = {
        /*
         * Padrão de assets
         * ----------------
         * O index.html fica na raiz do projeto.
         *
         * assets/
         * ├── icons/       imagens de itens
         * └── entities/    sprites de monstros e NPCs
         *
         * Nos itens e criaturas, informe somente o nome do arquivo.
         */
        assets: {
            basePath: "assets",

            folders: {
                item: "icons",
                creature: "entities",
                ui: "ui"
            },

            resolve(assetType, fileName) {
                if (!fileName) return null;

                const source = String(fileName).trim();

                if (!source) return null;

                /*
                 * Permite usar URL completa, data URL, blob URL ou caminho
                 * já iniciado em assets/.
                 */
                if (
                    /^(https?:|data:|blob:)/i.test(source) ||
                    source.startsWith("assets/") ||
                    source.startsWith("./assets/")
                ) {
                    return source;
                }

                const cleanFile = source
                    .replace(/^\.\//, "")
                    .replace(/^\//, "");

                const folder = this.folders[assetType] || "";

                return [
                    this.basePath.replace(/\/$/, ""),
                    folder.replace(/^\//, "").replace(/\/$/, ""),
                    cleanFile
                ].filter(Boolean).join("/");
            }
        },


        itemGeneration: {
            version: 2,
            individualRollMin: 0.90,
            individualRollMax: 1.10,

            rarities: {
                common: {
                    id: "common",
                    name: "Comum",
                    color: "#c7c7c7",
                    multiplierMin: 0.85,
                    multiplierMax: 1.05
                },
                uncommon: {
                    id: "uncommon",
                    name: "Incomum",
                    color: "#66d17a",
                    multiplierMin: 1.05,
                    multiplierMax: 1.20
                },
                rare: {
                    id: "rare",
                    name: "Raro",
                    color: "#58a6ff",
                    multiplierMin: 1.20,
                    multiplierMax: 1.40
                },
                epic: {
                    id: "epic",
                    name: "Épico",
                    color: "#bd78ff",
                    multiplierMin: 1.40,
                    multiplierMax: 1.65
                },
                legendary: {
                    id: "legendary",
                    name: "Lendário",
                    color: "#ffb84d",
                    multiplierMin: 1.65,
                    multiplierMax: 2.00
                },
                mythic: {
                    id: "mythic",
                    name: "Mítico",
                    color: "#ff625c",
                    multiplierMin: 2.00,
                    multiplierMax: 2.50
                }
            },

            getRarity(value) {
                const normalized = String(value || "common")
                    .trim()
                    .toLowerCase();

                return (
                    Object.values(this.rarities).find((rarity) => {
                        return (
                            rarity.id === normalized ||
                            rarity.name.toLowerCase() === normalized
                        );
                    }) || this.rarities.common
                );
            },

            getBaseStats(template = {}) {
                const stats = {
                    ...(template.baseStats || {}),
                    ...(template.stats || {})
                };

                const directStats = [
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
                ];

                directStats.forEach((stat) => {
                    const value = Number(template[stat]);
                    if (Number.isFinite(value)) {
                        stats[stat] = value;
                    }
                });

                const damage = Number(
                    template.damage ?? template.baseDamage
                );

                if (Number.isFinite(damage)) {
                    if (!Number.isFinite(Number(stats.damageMin))) {
                        stats.damageMin = Math.max(
                            1,
                            Math.floor(damage * 0.85)
                        );
                    }

                    if (!Number.isFinite(Number(stats.damageMax))) {
                        stats.damageMax = Math.max(
                            stats.damageMin,
                            Math.ceil(damage * 1.15)
                        );
                    }
                }

                const defense = Number(
                    template.defense ?? template.baseDefense
                );

                if (
                    Number.isFinite(defense) &&
                    !Number.isFinite(Number(stats.defense))
                ) {
                    stats.defense = defense;
                }

                return Object.fromEntries(
                    Object.entries(stats).filter(([, value]) => {
                        return Number.isFinite(Number(value));
                    })
                );
            }
        },

        balance: {
            progression: {
                maxLevel: 1000,
                baseXP: 100,
                xpGrowth: XP_GROWTH,
                targetXPPerMinute: 10,
                targetHoursToMaxLevel: 8760,

                getXPRequired(currentLevel) {
                    const level = clamp(
                        Math.floor(Number(currentLevel) || 1),
                        1,
                        this.maxLevel
                    );

                    if (level >= this.maxLevel) return 0;

                    return Math.max(
                        1,
                        Math.round(
                            this.baseXP * this.xpGrowth ** (level - 1)
                        )
                    );
                },

                getCumulativeXP(targetLevel) {
                    const target = clamp(
                        Math.floor(Number(targetLevel) || 1),
                        1,
                        this.maxLevel
                    );

                    let total = 0;

                    for (let level = 1; level < target; level += 1) {
                        total += this.getXPRequired(level);
                    }

                    return total;
                },

                getExpectedMinutesToLevel(targetLevel, xpPerMinute = this.targetXPPerMinute) {
                    const rate = Math.max(0.0001, Number(xpPerMinute) || this.targetXPPerMinute);
                    return this.getCumulativeXP(targetLevel) / rate;
                }
            },

            monsters: {
                hpPerLevelMultiplier: 1.004,
                damagePerLevelMultiplier: 1.003,
                defensePerLevelMultiplier: 1.002,

                getScale(level) {
                    const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
                    const exponent = safeLevel - 1;

                    return {
                        level: safeLevel,
                        hp: round(this.hpPerLevelMultiplier ** exponent),
                        damage: round(this.damagePerLevelMultiplier ** exponent),
                        defense: round(this.defensePerLevelMultiplier ** exponent)
                    };
                }
            },

            economy: {
                tierBasePrice: 50,
                tierPriceMultiplier: 2.05,
                levelsPerGoldBand: 100,
                goldChanceBandMultiplier: 1.08,
                goldAmountBandMultiplier: 1.05,
                maxGoldDropChance: 0.25,

                getTierPrice(tier, basePrice = this.tierBasePrice) {
                    const safeTier = Math.max(1, Math.floor(Number(tier) || 1));
                    const safeBase = Math.max(1, Number(basePrice) || this.tierBasePrice);

                    return Math.round(
                        safeBase * this.tierPriceMultiplier ** (safeTier - 1)
                    );
                },

                scaleGold(baseChance, baseMin, baseMax, monsterLevel) {
                    const level = Math.max(1, Math.floor(Number(monsterLevel) || 1));
                    const band = Math.floor((level - 1) / this.levelsPerGoldBand);
                    const chance = clamp(
                        Number(baseChance || 0) * this.goldChanceBandMultiplier ** band,
                        0,
                        this.maxGoldDropChance
                    );
                    const amountMultiplier = this.goldAmountBandMultiplier ** band;

                    return {
                        chance: round(chance, 4),
                        min: Math.max(1, Math.round(Number(baseMin || 1) * amountMultiplier)),
                        max: Math.max(1, Math.round(Number(baseMax || baseMin || 1) * amountMultiplier))
                    };
                }
            }
        },

        items: {
            sword_iron: {
                id: "sword_iron",
                name: "Espada de Ferro",
                image: "sword_iron.png",
                type: "weapon",
                slot: "weapon",
                tier: 1,
                levelReq: 1,
                damage: 10,
                damageMin: 8,
                damageMax: 12,
                defense: 0,
                price: 50,
                value: 50,
                rarity: "Comum",
                stackable: false,
                maxStack: 1,
                description:
                    "Uma espada simples e confiável para aventureiros iniciantes."
            },

            potion_health: {
                id: "potion_health",
                name: "Poção de Vida",
                image: "potion_health.png",
                type: "consumable",
                slot: null,
                tier: 1,
                levelReq: 1,
                effect: 20,
                healAmount: 20,
                price: 10,
                value: 10,
                rarity: "Comum",
                stackable: true,
                maxStack: 20,
                description: "Recupera 20 pontos de vida."
            },

            wolf_hide: {
                id: "wolf_hide",
                name: "Pele de Lobo",
                image: "wolf_hide.png",
                type: "material",
                slot: null,
                tier: 1,
                levelReq: 1,
                price: 2,
                value: 2,
                rarity: "Comum",
                stackable: true,
                maxStack: 99,
                description: "Material obtido de lobos da floresta."
            }
        },

        creatures: {
            giant_rat: {
                id: "giant_rat",
                name: "Rato Gigante",
                /*
                 * Este pacote gratuito não possui sprite de rato.
                 * Adicione giant_rat.png em assets/entities/ para ativar.
                 */
                sprite: null,
                assetMissing: true,
                level: 1,
                hp: 15,
                damage: 3,
                xp: 2,
                goldChance: 0.08,
                goldMin: 1,
                goldMax: 1,
                stats: {
                    str: 3,
                    precision: 6,
                    defense: 1,
                    critical: 0.03,
                    evasion: 0.08,
                    blockChance: 0,
                    blockReduction: 0,
                    damageMin: 1,
                    damageMax: 3
                },
                lootTable: [
                    {
                        templateId: "potion_health",
                        chance: 0.015,
                        min: 1,
                        max: 1
                    }
                ]
            },

            forest_wolf: {
                id: "forest_wolf",
                name: "Lobo da Floresta",
                /*
                 * Este pacote gratuito não possui sprite de lobo.
                 * Adicione forest_wolf.png em assets/entities/ para ativar.
                 */
                sprite: null,
                assetMissing: true,
                level: 1,
                hp: 30,
                damage: 6,
                xp: 4,
                goldChance: 0.12,
                goldMin: 1,
                goldMax: 1,
                stats: {
                    str: 6,
                    precision: 8,
                    defense: 2,
                    critical: 0.05,
                    evasion: 0.05,
                    blockChance: 0,
                    blockReduction: 0,
                    damageMin: 3,
                    damageMax: 6
                },
                lootTable: [
                    {
                        templateId: "wolf_hide",
                        chance: 0.35,
                        min: 1,
                        max: 1
                    },
                    {
                        templateId: "potion_health",
                        chance: 0.025,
                        min: 1,
                        max: 1
                    }
                ]
            },

            orc_scout: {
                id: "orc_scout",
                name: "Batedor Orc",
                sprite: "orc_scout.png",
                level: 2,
                hp: 24,
                damage: 5,
                xp: 4,
                goldChance: 0.08,
                goldMin: 1,
                goldMax: 1,
                stats: {
                    str: 5,
                    precision: 7,
                    defense: 2,
                    critical: 0.04,
                    evasion: 0.04,
                    blockChance: 0,
                    blockReduction: 0,
                    damageMin: 2,
                    damageMax: 5
                },
                lootTable: []
            },

            skeleton_guard: {
                id: "skeleton_guard",
                name: "Esqueleto Guardião",
                sprite: "skeleton_guard.png",
                level: 3,
                hp: 32,
                damage: 6,
                xp: 6,
                goldChance: 0.06,
                goldMin: 1,
                goldMax: 1,
                stats: {
                    str: 6,
                    precision: 7,
                    defense: 3,
                    critical: 0.04,
                    evasion: 0.03,
                    blockChance: 0.05,
                    blockReduction: 0.15,
                    damageMin: 3,
                    damageMax: 6
                },
                lootTable: []
            }
        },

        quests: {
            area_cleanup: {
                id: "area_cleanup",
                title: "Limpeza de Área",
                description:
                    "Os lobos estão se aproximando da estrada da vila. Derrote-os para tornar a passagem segura.",
                levelReq: 1,
                objectives: [
                    {
                        id: "defeat_forest_wolves",
                        type: "DefeatEnemy",
                        target: "forest_wolf",
                        label: "Derrote Lobos da Floresta",
                        required: 5,
                        progress: 0,
                        completed: false
                    }
                ],
                reward: {
                    xp: 15,
                    gold: 1,
                    items: [
                        {
                            templateId: "sword_iron",
                            quantity: 1
                        }
                    ]
                }
            }
        },


        calculateItemStats(item) {
            if (!item || typeof item !== "object") return {};

            const template =
                this.items[item.templateId] ||
                this.items[item.id] ||
                {};

            const savedBaseStats =
                item.baseStats &&
                typeof item.baseStats === "object" &&
                Object.keys(item.baseStats).length > 0
                    ? clone(item.baseStats)
                    : this.itemGeneration.getBaseStats(template);

            if (Object.keys(savedBaseStats).length === 0) {
                return clone(item.stats || {});
            }

            /*
             * Nunca sorteia novamente. O multiplicador é lido do objeto
             * da instância, garantindo que save/load, tooltip e equipamento
             * utilizem exatamente a mesma matemática.
             */
            const legacyQualityMultiplier =
                0.75 + clamp(Number(item.quality || 50), 1, 100) * 0.005;

            const savedMultiplier = Number(
                item.statMultiplier ??
                item.multiplier ??
                legacyQualityMultiplier
            );

            const multiplier = Number.isFinite(savedMultiplier)
                ? Math.max(0.01, savedMultiplier)
                : 1;

            const individualMultipliers = {
                ...(item.individualMultipliers || {})
            };

            Object.entries(item.baseRolls || {}).forEach(
                ([stat, rollPercent]) => {
                    if (
                        individualMultipliers[stat] === undefined &&
                        Number.isFinite(Number(rollPercent))
                    ) {
                        individualMultipliers[stat] =
                            Number(rollPercent) / 100;
                    }
                }
            );

            const result = {};

            Object.entries(savedBaseStats).forEach(
                ([stat, baseValue]) => {
                    const numericBase = Number(baseValue);
                    if (!Number.isFinite(numericBase)) return;

                    const individual = Number(
                        individualMultipliers[stat] ?? 1
                    );

                    const safeIndividual = Number.isFinite(individual)
                        ? Math.max(0.01, individual)
                        : 1;

                    const decimals = Math.abs(numericBase) < 1 ? 3 : 0;

                    result[stat] = Math.max(
                        numericBase > 0 && decimals === 0 ? 1 : 0,
                        round(
                            numericBase * multiplier * safeIndividual,
                            decimals
                        )
                    );
                }
            );

            (item.affixes || []).forEach((affix) => {
                if (
                    !affix?.stat ||
                    !Number.isFinite(Number(affix.value))
                ) {
                    return;
                }

                const value = Number(affix.value);

                result[affix.stat] = round(
                    (Number(result[affix.stat]) || 0) + value,
                    Math.abs(value) < 1 ? 3 : 0
                );
            });

            if (
                Number.isFinite(Number(result.damageMin)) &&
                Number.isFinite(Number(result.damageMax)) &&
                result.damageMax < result.damageMin
            ) {
                result.damageMax = result.damageMin;
            }

            return result;
        },

        getItemStatBreakdown(item) {
            const template =
                this.items[item?.templateId] ||
                this.items[item?.id] ||
                {};

            const baseStats =
                item?.baseStats &&
                Object.keys(item.baseStats).length > 0
                    ? clone(item.baseStats)
                    : this.itemGeneration.getBaseStats(template);

            const finalStats = this.calculateItemStats(item);
            const bonuses = {};

            Object.keys({ ...baseStats, ...finalStats }).forEach((stat) => {
                bonuses[stat] = round(
                    (Number(finalStats[stat]) || 0) -
                    (Number(baseStats[stat]) || 0),
                    Math.abs(Number(finalStats[stat]) || 0) < 1 ? 3 : 0
                );
            });

            const multiplier = Number(
                item?.statMultiplier ??
                item?.multiplier ??
                (0.75 + clamp(Number(item?.quality || 50), 1, 100) * 0.005)
            );

            const normalizedMultiplier = Number.isFinite(multiplier)
                ? Math.max(0.01, multiplier)
                : 1;

            const individualMultipliers = clone(
                item?.individualMultipliers || {}
            );

            const scaledStats = {};
            const affixBonuses = {};
            const effectiveMultipliers = {};

            Object.entries(baseStats).forEach(([stat, baseValue]) => {
                const base = Number(baseValue);
                if (!Number.isFinite(base)) return;

                const individual = Number(
                    individualMultipliers[stat] ?? 1
                );

                const safeIndividual = Number.isFinite(individual)
                    ? Math.max(0.01, individual)
                    : 1;

                const decimals = Math.abs(base) < 1 ? 3 : 0;
                const effectiveMultiplier =
                    normalizedMultiplier * safeIndividual;

                const scaledValue = Math.max(
                    base > 0 && decimals === 0 ? 1 : 0,
                    round(
                        base * effectiveMultiplier,
                        decimals
                    )
                );

                scaledStats[stat] = scaledValue;
                effectiveMultipliers[stat] = round(
                    effectiveMultiplier,
                    3
                );

                affixBonuses[stat] = round(
                    (Number(finalStats[stat]) || 0) -
                    scaledValue,
                    Math.abs(Number(finalStats[stat]) || 0) < 1
                        ? 3
                        : 0
                );
            });

            return {
                baseStats,
                finalStats,
                bonuses,
                multiplier: round(normalizedMultiplier, 2),
                individualMultipliers,
                effectiveMultipliers,
                scaledStats,
                affixBonuses,
                affixes: clone(item?.affixes || [])
            };
        },

        getRarityPresentation(itemOrRarity) {
            const value =
                typeof itemOrRarity === "object"
                    ? itemOrRarity.rarityId || itemOrRarity.rarity
                    : itemOrRarity;

            return clone(this.itemGeneration.getRarity(value));
        },

        generateItem(templateId, options = {}) {
            if (
                !Aethra.ItemSystem ||
                typeof Aethra.ItemSystem.generateItem !== "function"
            ) {
                throw new Error(
                    "GameData.generateItem requer ItemSystem.js carregado."
                );
            }

            return Aethra.ItemSystem.generateItem(
                templateId,
                options
            );
        },

        getAssetPath(assetType, fileName) {
            return this.assets.resolve(assetType, fileName);
        },

        getItemImage(itemOrId) {
            const item =
                typeof itemOrId === "string"
                    ? this.items[itemOrId]
                    : itemOrId;

            if (!item) return null;

            const template =
                item.templateId && this.items[item.templateId]
                    ? this.items[item.templateId]
                    : item;

            const fileName =
                item.image ||
                item.icon ||
                template.image ||
                template.icon ||
                null;

            return this.getAssetPath("item", fileName);
        },

        getCreatureImage(creatureOrId) {
            const creature =
                typeof creatureOrId === "string"
                    ? this.creatures[creatureOrId]
                    : creatureOrId;

            if (!creature) return null;

            const template =
                creature.id && this.creatures[creature.id]
                    ? this.creatures[creature.id]
                    : creature;

            const fileName =
                creature.sprite ||
                creature.image ||
                template.sprite ||
                template.image ||
                null;

            return this.getAssetPath("creature", fileName);
        },

        getItem(itemId) {
            const item = this.items[itemId];
            return item ? clone(item) : null;
        },

        getCreature(creatureId, encounterLevel = null) {
            const base = this.creatures[creatureId];
            if (!base) return null;

            const creature = clone(base);
            const level = Math.max(
                1,
                Math.floor(Number(encounterLevel || creature.level || 1))
            );
            const scale = this.balance.monsters.getScale(level);
            const gold = this.balance.economy.scaleGold(
                creature.goldChance,
                creature.goldMin,
                creature.goldMax,
                level
            );

            creature.level = level;
            creature.hp = Math.max(1, Math.round(Number(creature.hp || 1) * scale.hp));
            creature.maxHp = creature.hp;
            creature.damage = Math.max(1, Math.round(Number(creature.damage || 1) * scale.damage));
            creature.goldChance = gold.chance;
            creature.goldMin = gold.min;
            creature.goldMax = gold.max;
            creature.scale = scale;
            creature.stats = creature.stats || {};
            creature.stats.str = Math.max(
                1,
                Math.round(Number(creature.stats.str || creature.damage) * scale.damage)
            );
            creature.stats.damageMin = Math.max(
                1,
                Math.round(Number(creature.stats.damageMin || creature.damage) * scale.damage)
            );
            creature.stats.damageMax = Math.max(
                creature.stats.damageMin,
                Math.round(Number(creature.stats.damageMax || creature.damage) * scale.damage)
            );
            creature.stats.defense = Math.max(
                0,
                Math.round(Number(creature.stats.defense || 0) * scale.defense)
            );

            return creature;
        },

        getQuest(questId) {
            const quest = this.quests[questId];
            return quest ? clone(quest) : null;
        },

        registerItem(itemId, data) {
            if (!itemId || !data || typeof data !== "object") return false;

            this.items[itemId] = {
                id: itemId,
                ...clone(data)
            };

            Aethra.EventBus?.emit("gamedata:item-registered", {
                itemId,
                item: this.getItem(itemId)
            });

            return true;
        },

        registerCreature(creatureId, data) {
            if (!creatureId || !data || typeof data !== "object") return false;

            this.creatures[creatureId] = {
                id: creatureId,
                ...clone(data)
            };

            Aethra.EventBus?.emit("gamedata:creature-registered", {
                creatureId,
                creature: clone(this.creatures[creatureId])
            });

            return true;
        },

        registerQuest(questId, data) {
            if (!questId || !data || typeof data !== "object") return false;

            this.quests[questId] = {
                id: questId,
                ...clone(data)
            };

            Aethra.EventBus?.emit("gamedata:quest-registered", {
                questId,
                quest: this.getQuest(questId)
            });

            return true;
        }
    };

    Aethra.EventBus?.emit("GameDataReady", {
        itemCount: Object.keys(Aethra.GameData.items).length,
        creatureCount: Object.keys(Aethra.GameData.creatures).length,
        questCount: Object.keys(Aethra.GameData.quests).length,
        progression: {
            maxLevel: Aethra.GameData.balance.progression.maxLevel,
            baseXP: Aethra.GameData.balance.progression.baseXP,
            xpGrowth: Aethra.GameData.balance.progression.xpGrowth
        }
    });
})(window.Aethra);
