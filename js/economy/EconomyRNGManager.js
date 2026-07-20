// EconomyRNGManager.js - RNG econômico em camadas e telemetria de oferta
// Protótipo client-side. Em produção/RMT, os sorteios devem ser autoritativos no servidor.
(function initEconomyRNGManager(Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus) {
        throw new Error("EconomyRNGManager.js requer game-core.js.");
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value || 0)));
    const integer = (value, fallback = 0) => {
        const parsed = Math.floor(Number(value));
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const round = (value, decimals = 6) => {
        const factor = 10 ** decimals;
        return Math.round(Number(value || 0) * factor) / factor;
    };

    const NORMAL_RARITY_WEIGHTS = Object.freeze([
        { id: "common", weight: 0.65 },
        { id: "uncommon", weight: 0.24 },
        { id: "rare", weight: 0.08 },
        { id: "epic", weight: 0.024 },
        { id: "legendary", weight: 0.0055 },
        { id: "mythic", weight: 0.0005 }
    ]);

    const RARE_ENCOUNTER_RARITY_WEIGHTS = Object.freeze([
        { id: "rare", weight: 0.70 },
        { id: "epic", weight: 0.24 },
        { id: "legendary", weight: 0.055 },
        { id: "mythic", weight: 0.005 }
    ]);

    function randomId(prefix = "rng") {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return `${prefix}_${window.crypto.randomUUID()}`;
        }

        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function normalizeWeights(entries) {
        const valid = (entries || [])
            .map((entry) => ({
                id: String(entry.id || "common").toLowerCase(),
                weight: Math.max(0, Number(entry.weight || 0))
            }))
            .filter((entry) => entry.weight > 0);
        const total = valid.reduce((sum, entry) => sum + entry.weight, 0);
        if (total <= 0) return [{ id: "common", weight: 1 }];
        return valid.map((entry) => ({ ...entry, weight: entry.weight / total }));
    }

    Aethra.EconomyRNGManager = {
        initialized: false,
        randomSource: Math.random,

        config: {
            version: 1,
            authority: "client-prototype",
            rareEncounter: {
                // Aproximadamente 1 encontro raro a cada 500 kills elegíveis.
                baseChance: 1 / 500,
                maxAppearanceChance: 0.05,
                // O encontro sempre oferece uma recompensa de consolação.
                consolation: {
                    templateId: "aether_fragment",
                    minQuantity: 1,
                    maxQuantity: 3,
                    goldMin: 4,
                    goldMax: 12
                }
            },
            specialItem: {
                // Chance por encontro raro: 0,15%. Em média 1 item especial
                // por 666,7 encontros raros, antes de raridade/IV/afixos.
                chance: 0.0015,
                maxEconomicModifier: 0.10,
                pool: ["orcish_cleaver", "bone_guard", "sword_iron"]
            },
            rarity: {
                normal: NORMAL_RARITY_WEIGHTS,
                rareEncounter: RARE_ENCOUNTER_RARITY_WEIGHTS
            },
            ivWeights: {
                multiplier: 0.35,
                attributes: 0.35,
                affixes: 0.20,
                potential: 0.10
            },
            dryProtection: {
                // Não garante o jackpot. Só concede fragmentos extras após
                // longas secas, preservando a escassez econômica.
                enabled: true,
                extraFragmentEveryEligibleRolls: 2500,
                maxExtraFragments: 3
            }
        },

        init() {
            this.ensureState();
            if (this.initialized) return this.getSnapshot();
            this.bindEvents();
            this.initialized = true;
            Aethra.EventBus.emit("economy-rng:ready", this.getSnapshot());
            return this.getSnapshot();
        },

        ensureState() {
            const state = Aethra.GameState.economyRng || {};
            state.version = this.config.version;
            state.modifiers = state.modifiers || {};
            state.telemetry = state.telemetry || {};

            Object.assign(state.modifiers, {
                eventAppearanceBonus: clamp(state.modifiers.eventAppearanceBonus, 0, 20),
                eventActive: Boolean(state.modifiers.eventActive),
                eventExpiresAt: state.modifiers.eventExpiresAt || null,
                boosterAppearanceBonus: clamp(state.modifiers.boosterAppearanceBonus, 0, 20),
                boosterActive: Boolean(state.modifiers.boosterActive),
                boosterExpiresAt: state.modifiers.boosterExpiresAt || null,
                economicBonus: clamp(
                    state.modifiers.economicBonus,
                    0,
                    this.config.specialItem.maxEconomicModifier
                )
            });

            const telemetry = state.telemetry;
            Object.assign(telemetry, {
                eligibleRolls: integer(telemetry.eligibleRolls),
                rareEncounters: integer(telemetry.rareEncounters),
                specialItems: integer(telemetry.specialItems),
                perfectItems: integer(telemetry.perfectItems),
                legendaryItems: integer(telemetry.legendaryItems),
                mythicItems: integer(telemetry.mythicItems),
                dryEligibleRolls: integer(telemetry.dryEligibleRolls),
                consolationFragments: integer(telemetry.consolationFragments),
                lastRareEncounterAt: telemetry.lastRareEncounterAt || null,
                lastSpecialItemAt: telemetry.lastSpecialItemAt || null
            });
            telemetry.rarityCounts = telemetry.rarityCounts || {};
            ["common", "uncommon", "rare", "epic", "legendary", "mythic"]
                .forEach((rarityId) => {
                    telemetry.rarityCounts[rarityId] = integer(
                        telemetry.rarityCounts[rarityId]
                    );
                });

            Aethra.GameState.economyRng = state;
            return state;
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            Aethra.EventBus.on("save:loaded", () => this.ensureState());
            Aethra.EventBus.on("ItemGenerated", ({ item } = {}) => {
                if (!item?.slot) return;
                const state = this.ensureState();
                const rarityId = String(item.rarityId || "common").toLowerCase();
                if (state.telemetry.rarityCounts[rarityId] !== undefined) {
                    state.telemetry.rarityCounts[rarityId] += 1;
                }
                if (rarityId === "legendary") state.telemetry.legendaryItems += 1;
                if (rarityId === "mythic") state.telemetry.mythicItems += 1;
                if (Number(item.iv?.percent || item.rollScore || 0) >= 99) {
                    state.telemetry.perfectItems += 1;
                }
            });
        },

        setRandomSource(fn) {
            if (typeof fn !== "function") {
                throw new TypeError("EconomyRNGManager.setRandomSource: fn deve ser uma função.");
            }
            this.randomSource = fn;
            return true;
        },

        setAppearanceEvent(options = {}) {
            const state = this.ensureState();
            state.modifiers.eventAppearanceBonus = clamp(options.bonus ?? 0.5, 0, 20);
            state.modifiers.eventActive = options.active !== false;
            state.modifiers.eventExpiresAt = options.expiresAt || null;
            Aethra.EventBus.emit("economy-rng:modifiers-changed", this.getModifierSnapshot());
            return this.getModifierSnapshot();
        },

        setBooster(options = {}) {
            const state = this.ensureState();
            state.modifiers.boosterAppearanceBonus = clamp(options.bonus ?? 3, 0, 20);
            state.modifiers.boosterActive = options.active !== false;
            state.modifiers.boosterExpiresAt = options.expiresAt || null;
            Aethra.EventBus.emit("economy-rng:modifiers-changed", this.getModifierSnapshot());
            return this.getModifierSnapshot();
        },

        clearModifiers() {
            const state = this.ensureState();
            Object.assign(state.modifiers, {
                eventAppearanceBonus: 0,
                eventActive: false,
                eventExpiresAt: null,
                boosterAppearanceBonus: 0,
                boosterActive: false,
                boosterExpiresAt: null,
                economicBonus: 0
            });
            Aethra.EventBus.emit("economy-rng:modifiers-changed", this.getModifierSnapshot());
            return this.getModifierSnapshot();
        },

        isModifierActive(active, expiresAt) {
            if (!active) return false;
            if (!expiresAt) return true;
            return Date.now() < new Date(expiresAt).getTime();
        },

        getModifierSnapshot(overrides = {}) {
            const state = this.ensureState();
            const modifiers = state.modifiers;

            const eventActive = overrides.eventActive !== undefined
                ? Boolean(overrides.eventActive)
                : this.isModifierActive(modifiers.eventActive, modifiers.eventExpiresAt);
            const boosterActive = overrides.boosterActive !== undefined
                ? Boolean(overrides.boosterActive)
                : this.isModifierActive(modifiers.boosterActive, modifiers.boosterExpiresAt);

            const eventBonus = eventActive
                ? clamp(overrides.eventAppearanceBonus ?? modifiers.eventAppearanceBonus, 0, 20)
                : 0;
            const boosterBonus = boosterActive
                ? clamp(overrides.boosterAppearanceBonus ?? modifiers.boosterAppearanceBonus, 0, 20)
                : 0;

            const eventMultiplier = 1 + eventBonus;
            const boosterMultiplier = 1 + boosterBonus;
            const appearanceMultiplier = eventMultiplier * boosterMultiplier;

            return {
                eventActive,
                eventBonus,
                eventMultiplier,
                boosterActive,
                boosterBonus,
                boosterMultiplier,
                appearanceMultiplier,
                economicBonus: clamp(
                    overrides.economicBonus ?? modifiers.economicBonus,
                    0,
                    this.config.specialItem.maxEconomicModifier
                )
            };
        },

        getRareEncounterChance(context = {}) {
            const modifiers = this.getModifierSnapshot(context.modifiers || {});
            const baseChance = clamp(
                context.baseChance ?? this.config.rareEncounter.baseChance,
                0,
                1
            );
            const chance = clamp(
                baseChance * modifiers.appearanceMultiplier,
                0,
                this.config.rareEncounter.maxAppearanceChance
            );

            return {
                baseChance,
                chance,
                odds: chance > 0 ? Math.round(1 / chance) : Infinity,
                modifiers
            };
        },

        rollRareEncounter(context = {}) {
            const state = this.ensureState();
            const chanceInfo = this.getRareEncounterChance(context);
            const roll = this.randomSource();
            const success = roll < chanceInfo.chance;
            const dryStreakBeforeRoll = state.telemetry.dryEligibleRolls;

            state.telemetry.eligibleRolls += 1;
            state.telemetry.dryEligibleRolls = success
                ? 0
                : state.telemetry.dryEligibleRolls + 1;

            if (success) {
                state.telemetry.rareEncounters += 1;
                state.telemetry.lastRareEncounterAt = new Date().toISOString();
            }

            const result = {
                rollId: randomId("rare"),
                success,
                roll: round(roll, 8),
                ...chanceInfo,
                context: clone({
                    enemyId: context.enemyId || null,
                    huntId: context.huntId || null,
                    playerId: context.playerId || null,
                    source: context.source || "eligible-kill"
                }),
                dryStreakBeforeRoll,
                rolledAt: new Date().toISOString()
            };

            Aethra.EventBus.emit("economy-rng:rare-encounter-roll", clone(result));
            if (success) {
                Aethra.EventBus.emit("economy-rng:rare-encounter", clone(result));
            }
            return result;
        },

        rollWeighted(entries) {
            const weights = normalizeWeights(entries);
            let roll = this.randomSource();
            for (const entry of weights) {
                roll -= entry.weight;
                if (roll <= 0) return entry.id;
            }
            return weights.at(-1)?.id || "common";
        },

        rollEquipmentRarity(options = {}) {
            const table = options.rareEncounter
                ? this.config.rarity.rareEncounter
                : this.config.rarity.normal;
            const rarityId = this.rollWeighted(table);
            Aethra.EventBus.emit("economy-rng:rarity-roll", {
                rarityId,
                source: options.source || "equipment",
                rareEncounter: Boolean(options.rareEncounter),
                rolledAt: new Date().toISOString()
            });
            return rarityId;
        },

        rollSpecialItem(context = {}) {
            const state = this.ensureState();
            const modifiers = this.getModifierSnapshot(context.modifiers || {});
            const baseChance = clamp(
                context.chance ?? this.config.specialItem.chance,
                0,
                1
            );
            // Eventos/boosters aumentam encontros, não o jackpot. Apenas um
            // bônus econômico explicitamente controlado pode alterar esta etapa.
            const chance = clamp(
                baseChance * (1 + modifiers.economicBonus),
                0,
                1
            );
            const roll = this.randomSource();
            const success = roll < chance;

            const pool = Array.isArray(context.pool) && context.pool.length
                ? context.pool
                : this.config.specialItem.pool;
            const templateId = success
                ? pool[Math.floor(this.randomSource() * pool.length)]
                : null;
            const rarityId = success
                ? this.rollEquipmentRarity({
                    rareEncounter: true,
                    source: "rare-encounter"
                })
                : null;

            if (success) {
                state.telemetry.specialItems += 1;
                state.telemetry.lastSpecialItemAt = new Date().toISOString();
            }

            const result = {
                rollId: randomId("jackpot"),
                success,
                roll: round(roll, 8),
                baseChance,
                chance,
                templateId,
                rarityId,
                rolledAt: new Date().toISOString(),
                sourceRareRollId: context.rareRollId || null
            };

            Aethra.EventBus.emit("economy-rng:special-item-roll", clone(result));
            if (success) {
                Aethra.EventBus.emit("economy-rng:special-item", clone(result));
            }
            return result;
        },

        getConsolationReward(options = {}) {
            const state = this.ensureState();
            const definition = this.config.rareEncounter.consolation;
            const min = integer(definition.minQuantity, 1);
            const max = Math.max(min, integer(definition.maxQuantity, min));
            let quantity = min + Math.floor(this.randomSource() * (max - min + 1));

            if (this.config.dryProtection.enabled) {
                const interval = Math.max(
                    1,
                    integer(this.config.dryProtection.extraFragmentEveryEligibleRolls, 2500)
                );
                const extra = Math.min(
                    integer(this.config.dryProtection.maxExtraFragments, 3),
                    Math.floor(Number(
                        options.dryStreak ?? state.telemetry.dryEligibleRolls
                    ) / interval)
                );
                quantity += extra;
            }

            const goldMin = integer(definition.goldMin, 0);
            const goldMax = Math.max(goldMin, integer(definition.goldMax, goldMin));
            const gold = goldMin + Math.floor(this.randomSource() * (goldMax - goldMin + 1));
            state.telemetry.consolationFragments += quantity;

            return {
                templateId: definition.templateId,
                quantity,
                gold
            };
        },

        resolveRareEncounter(context = {}) {
            const rareRoll = context.rareRoll || this.rollRareEncounter(context);
            if (!rareRoll.success) return null;

            const consolation = this.getConsolationReward({
                dryStreak: rareRoll.dryStreakBeforeRoll
            });
            const specialItem = this.rollSpecialItem({
                rareRollId: rareRoll.rollId,
                pool: context.specialItemPool,
                modifiers: context.modifiers
            });

            const resolution = {
                encounterId: randomId("encounter"),
                rareRoll: clone(rareRoll),
                consolation,
                specialItem,
                resolvedAt: new Date().toISOString()
            };

            Aethra.EventBus.emit("economy-rng:rare-encounter-resolved", clone(resolution));
            return resolution;
        },

        getIVWeights() {
            return clone(this.config.ivWeights);
        },

        getSnapshot() {
            const state = this.ensureState();
            return clone({
                version: state.version,
                authority: this.config.authority,
                modifiers: this.getModifierSnapshot(),
                rareEncounter: this.getRareEncounterChance(),
                telemetry: state.telemetry,
                ivWeights: this.config.ivWeights
            });
        },

        simulate(options = {}) {
            const rolls = Math.max(1, integer(options.rolls, 100000));
            let encounters = 0;
            let specialItems = 0;
            const rarities = {
                common: 0,
                uncommon: 0,
                rare: 0,
                epic: 0,
                legendary: 0,
                mythic: 0
            };

            const chanceInfo = this.getRareEncounterChance({
                modifiers: options.modifiers || {}
            });

            for (let index = 0; index < rolls; index += 1) {
                if (this.randomSource() >= chanceInfo.chance) continue;
                encounters += 1;
                if (this.randomSource() >= this.config.specialItem.chance) continue;
                specialItems += 1;
                const rarity = this.rollWeighted(this.config.rarity.rareEncounter);
                rarities[rarity] += 1;
            }

            return {
                rolls,
                chance: chanceInfo.chance,
                expectedEncounters: rolls * chanceInfo.chance,
                encounters,
                specialItems,
                rarities
            };
        }
    };

    Aethra.EconomyRNGManager.init();
})(window.Aethra);
