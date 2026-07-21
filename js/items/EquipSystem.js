// EquipSystem.js - Equipamento persistente, validação e atributos dinâmicos
(function (Aethra) {
    "use strict";

    if (
        !Aethra ||
        !Aethra.GameState ||
        !Aethra.EventBus ||
        !Aethra.SaveManager ||
        !Aethra.GameData
    ) {
        throw new Error(
            "EquipSystem.js requer Core, GameData e SaveManager."
        );
    }

    const VALID_SLOTS = Object.freeze([
        "weapon",
        "offhand",
        "head",
        "chest",
        "hands",
        "legs",
        "feet",
        "neck",
        "ring1",
        "ring2",
        "relic"
    ]);

    const TYPE_SLOT_RULES = Object.freeze({
        WEAPON: ["weapon"],
        SHIELD: ["offhand"],
        OFFHAND: ["offhand"],
        HELMET: ["head"],
        HEAD: ["head"],
        ARMOR: ["chest"],
        CHEST: ["chest"],
        GLOVES: ["hands"],
        HANDS: ["hands"],
        LEGS: ["legs"],
        PANTS: ["legs"],
        BOOTS: ["feet"],
        FEET: ["feet"],
        AMULET: ["neck"],
        NECK: ["neck"],
        RING: ["ring1", "ring2"],
        RELIC: ["relic"],
        CONSUMABLE: [],
        MATERIAL: [],
        LOOT: [],
        QUEST: [],
        MISC: []
    });

    function clone(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }

    function createEmptyEquipment() {
        return Object.fromEntries(
            VALID_SLOTS.map((slot) => [slot, null])
        );
    }

    function cloneStats(stats) {
        return Object.fromEntries(
            Object.entries(stats || {}).map(([key, value]) => [
                key,
                Number.isFinite(Number(value))
                    ? Number(value)
                    : value
            ])
        );
    }

    function getTemplate(item) {
        return (
            Aethra.GameData.items?.[item?.templateId] ||
            Aethra.GameData.items?.[item?.id] ||
            null
        );
    }

    function normalizeItemType(item) {
        const template = getTemplate(item) || {};

        return String(
            item?.itemType ||
            item?.type ||
            template.itemType ||
            template.type ||
            "MISC"
        )
            .trim()
            .toUpperCase();
    }

    function hasEquippedItems(equipment) {
        return Boolean(
            equipment &&
            typeof equipment === "object" &&
            Object.values(equipment).some(Boolean)
        );
    }

    function ensureSlots(equipment) {
        const target =
            equipment &&
            typeof equipment === "object"
                ? equipment
                : {};

        VALID_SLOTS.forEach((slot) => {
            if (!(slot in target)) {
                target[slot] = null;
            }
        });

        return target;
    }

    function inferBaseStats(hero, equipment) {
        const inferred = cloneStats(hero.stats || {});

        Object.values(equipment || {}).forEach((item) => {
            if (!item) return;

            const itemStats =
                Aethra.GameData.calculateItemStats(item);

            Object.entries(itemStats).forEach(([stat, value]) => {
                const numericValue = Number(value);
                if (!Number.isFinite(numericValue)) return;

                const targetStat =
                    stat === "hpMax"
                        ? "maxHp"
                        : stat === "manaMax"
                            ? "maxMana"
                            : stat;

                inferred[targetStat] =
                    (Number(inferred[targetStat]) || 0) -
                    numericValue;
            });
        });

        return inferred;
    }

    function ensureHeroEquipmentState() {
        const state = Aethra.GameState;
        const hero = state.hero || (state.hero = {});

        hero.bag = Array.isArray(hero.bag)
            ? hero.bag
            : [];

        const persistentState =
            state.playerEquipment &&
            typeof state.playerEquipment === "object"
                ? state.playerEquipment
                : null;

        const legacyState =
            hero.equipment &&
            typeof hero.equipment === "object"
                ? hero.equipment
                : null;

        let equipment;

        if (hasEquippedItems(persistentState)) {
            equipment = persistentState;
        } else if (hasEquippedItems(legacyState)) {
            equipment = legacyState;
        } else {
            equipment =
                persistentState ||
                legacyState ||
                createEmptyEquipment();
        }

        equipment = ensureSlots(equipment);

        state.playerEquipment = equipment;
        hero.equipment = equipment;

        if (!hero.stats || typeof hero.stats !== "object") {
            hero.stats = {};
        }

        if (
            !hero.baseStats ||
            typeof hero.baseStats !== "object" ||
            Object.keys(hero.baseStats).length === 0
        ) {
            hero.baseStats = inferBaseStats(hero, equipment);
        }

        return {
            hero,
            equipment
        };
    }

    function resolveItem(itemOrInstanceId) {
        if (
            itemOrInstanceId &&
            typeof itemOrInstanceId === "object"
        ) {
            return itemOrInstanceId;
        }

        const instanceId = String(itemOrInstanceId || "");
        if (!instanceId) return null;

        const { hero, equipment } =
            ensureHeroEquipmentState();

        return (
            hero.bag.find((item) => {
                return item?.instanceId === instanceId;
            }) ||
            Object.values(equipment).find((item) => {
                return item?.instanceId === instanceId;
            }) ||
            null
        );
    }

    function getAllowedSlots(item) {
        if (!item || typeof item !== "object") {
            return [];
        }

        const template = getTemplate(item) || {};
        const type = normalizeItemType(item);
        const naturalSlot =
            item.slot ||
            template.slot ||
            null;

        if (type === "WEAPON") {
            return ["weapon"];
        }

        if (type === "ARMOR") {
            const armorSlots = [
                "head",
                "chest",
                "hands",
                "legs",
                "feet"
            ];

            return armorSlots.includes(naturalSlot)
                ? [naturalSlot]
                : ["chest"];
        }

        if (TYPE_SLOT_RULES[type]) {
            return [...TYPE_SLOT_RULES[type]];
        }

        const configured =
            item.allowedSlots ||
            template.allowedSlots ||
            [];

        if (
            Array.isArray(configured) &&
            configured.length > 0
        ) {
            return configured.filter((slot) => {
                return VALID_SLOTS.includes(slot);
            });
        }

        return naturalSlot && VALID_SLOTS.includes(naturalSlot)
            ? [naturalSlot]
            : [];
    }

    function getEquipmentBonuses(equipment) {
        const bonuses = {};

        Object.values(equipment || {}).forEach((item) => {
            if (!item) return;

            const itemStats =
                Aethra.GameData.calculateItemStats(item);

            item.stats = clone(itemStats);

            Object.entries(itemStats).forEach(([stat, value]) => {
                const numericValue = Number(value);
                if (!Number.isFinite(numericValue)) return;

                const targetStat =
                    stat === "hpMax"
                        ? "maxHp"
                        : stat === "manaMax"
                            ? "maxMana"
                            : stat;

                bonuses[targetStat] =
                    (Number(bonuses[targetStat]) || 0) +
                    numericValue;
            });
        });

        return bonuses;
    }

    Aethra.EquipSystem = {
        initialized: false,
        validSlots: [...VALID_SLOTS],
        typeSlotRules: clone(TYPE_SLOT_RULES),

        init() {
            if (this.initialized) {
                return this.getEquipment();
            }

            ensureHeroEquipmentState();

            this.updatePlayerStats({
                emit: false,
                save: false,
                source: "equipment-init"
            });

            this.bindRestoreEvents();
            this.initialized = true;

            Aethra.EventBus.emit("equipment:ready", {
                equipment: this.getEquipment(),
                validSlots: [...this.validSlots],
                typeSlotRules: clone(this.typeSlotRules)
            });

            return this.getEquipment();
        },

        bindRestoreEvents() {
            if (this._restoreEventsBound) return;
            this._restoreEventsBound = true;

            const restore = () => {
                ensureHeroEquipmentState();

                this.updatePlayerStats({
                    emit: true,
                    save: false,
                    source: "state-restored"
                });
            };

            Aethra.EventBus.on("state:restored", restore);
            Aethra.EventBus.on("save:loaded", restore);
        },

        getItemType(itemOrInstanceId) {
            const item = resolveItem(itemOrInstanceId);
            return item ? normalizeItemType(item) : null;
        },

        getAllowedSlots(itemOrInstanceId) {
            const item = resolveItem(itemOrInstanceId);
            return item ? getAllowedSlots(item) : [];
        },

        canEquip(itemOrInstanceId, slot) {
            return this.validateEquip(
                itemOrInstanceId,
                slot
            ).allowed;
        },

        validateEquip(itemOrInstanceId, requestedSlot = null) {
            ensureHeroEquipmentState();

            const item = resolveItem(itemOrInstanceId);

            if (!item) {
                return {
                    allowed: false,
                    code: "ITEM_NOT_FOUND",
                    item: null,
                    slot: requestedSlot,
                    allowedSlots: []
                };
            }

            const itemType = normalizeItemType(item);
            const allowedSlots = getAllowedSlots(item);
            const targetSlot =
                requestedSlot ||
                allowedSlots[0] ||
                null;

            if (
                !targetSlot ||
                !VALID_SLOTS.includes(targetSlot)
            ) {
                return {
                    allowed: false,
                    code: "INVALID_EQUIPMENT_SLOT",
                    item: clone(item),
                    itemType,
                    slot: targetSlot,
                    allowedSlots
                };
            }

            if (!allowedSlots.includes(targetSlot)) {
                return {
                    allowed: false,
                    code: "ITEM_TYPE_SLOT_MISMATCH",
                    item: clone(item),
                    itemType,
                    slot: targetSlot,
                    allowedSlots,
                    message:
                        `${itemType} não pode ser equipado em ${targetSlot}.`
                };
            }

            const requiredLevel = Math.max(
                0,
                Number(
                    item.levelReq ||
                    getTemplate(item)?.levelReq ||
                    0
                )
            );

            const heroLevel = Math.max(
                1,
                Number(Aethra.GameState.hero?.level || 1)
            );

            if (heroLevel < requiredLevel) {
                return {
                    allowed: false,
                    code: "LEVEL_REQUIREMENT_NOT_MET",
                    item: clone(item),
                    itemType,
                    slot: targetSlot,
                    allowedSlots,
                    requiredLevel,
                    heroLevel
                };
            }

            return {
                allowed: true,
                code: "OK",
                item: clone(item),
                itemType,
                slot: targetSlot,
                allowedSlots
            };
        },

        equip(instanceId, requestedSlot = null) {
            const { hero, equipment } =
                ensureHeroEquipmentState();

            const validation = this.validateEquip(
                instanceId,
                requestedSlot
            );

            if (!validation.allowed) {
                Aethra.EventBus.emit(
                    "equipment:error",
                    validation
                );

                Aethra.EventBus.emit(
                    "equipment:validation-failed",
                    clone(validation)
                );

                return false;
            }

            const itemIndex = hero.bag.findIndex((item) => {
                return item?.instanceId === instanceId;
            });

            if (itemIndex === -1) {
                Aethra.EventBus.emit("equipment:error", {
                    code: "ITEM_NOT_IN_BAG",
                    instanceId
                });

                return false;
            }

            const item = hero.bag[itemIndex];
            const slot = validation.slot;
            const previousItem = equipment[slot] || null;

            item.itemType = normalizeItemType(item);
            item.stats =
                Aethra.GameData.calculateItemStats(item);

            hero.bag.splice(itemIndex, 1);

            if (previousItem) {
                hero.bag.push(previousItem);
            }

            equipment[slot] = item;

            Aethra.GameState.playerEquipment = equipment;
            hero.equipment = equipment;

            const stats = this.updatePlayerStats({
                emit: false,
                save: false,
                source: "item-equipped"
            });

            const payload = {
                item: clone(item),
                slot,
                itemType: item.itemType,
                previousItem: clone(previousItem),
                playerEquipment: clone(equipment),
                equipment: clone(equipment),
                stats: clone(stats)
            };

            Aethra.EventBus.emit("itemEquipped", payload);
            Aethra.EventBus.emit(
                "equipment:changed",
                payload
            );
            Aethra.EventBus.emit(
                "equipment:item-dropped",
                payload
            );

            Aethra.EventBus.emit("bag:changed", {
                reason: "item-equipped",
                bag: clone(hero.bag)
            });

            Aethra.EventBus.emit("statsChanged", {
                stats: clone(stats),
                hero,
                source: "equipment",
                item: clone(item),
                slot,
                previousItem: clone(previousItem)
            });

            Aethra.SaveManager.save("item-equipped");
            return true;
        },

        unequip(slot) {
            const { hero, equipment } =
                ensureHeroEquipmentState();

            if (!VALID_SLOTS.includes(slot)) {
                Aethra.EventBus.emit("equipment:error", {
                    code: "INVALID_EQUIPMENT_SLOT",
                    slot
                });

                return false;
            }

            const item = equipment[slot];

            if (!item) return false;

            equipment[slot] = null;
            hero.bag.push(item);

            Aethra.GameState.playerEquipment = equipment;
            hero.equipment = equipment;

            const stats = this.updatePlayerStats({
                emit: false,
                save: false,
                source: "item-unequipped"
            });

            const payload = {
                item: clone(item),
                slot,
                playerEquipment: clone(equipment),
                equipment: clone(equipment),
                stats: clone(stats)
            };

            Aethra.EventBus.emit("itemUnequipped", payload);
            Aethra.EventBus.emit(
                "equipment:changed",
                payload
            );

            Aethra.EventBus.emit("bag:changed", {
                reason: "item-unequipped",
                bag: clone(hero.bag)
            });

            Aethra.EventBus.emit("statsChanged", {
                stats: clone(stats),
                hero,
                source: "equipment",
                item: clone(item),
                slot
            });

            Aethra.SaveManager.save("item-unequipped");
            return true;
        },

        updatePlayerStats(options = {}) {
            const { hero, equipment } =
                ensureHeroEquipmentState();

            const previousStats = cloneStats(hero.stats);
            const baseStats = cloneStats(hero.baseStats);
            const equipmentBonuses =
                getEquipmentBonuses(equipment);

            const nextStats = cloneStats(baseStats);

            Object.entries(equipmentBonuses).forEach(
                ([stat, value]) => {
                    const numericValue = Number(value);
                    if (!Number.isFinite(numericValue)) return;

                    nextStats[stat] =
                        (Number(nextStats[stat]) || 0) +
                        numericValue;
                }
            );

            if (
                Number.isFinite(Number(nextStats.damageMin)) ||
                Number.isFinite(Number(nextStats.damageMax))
            ) {
                const damageMin = Math.max(
                    0,
                    Number(
                        nextStats.damageMin ??
                        nextStats.damageMax ??
                        0
                    )
                );

                const damageMax = Math.max(
                    damageMin,
                    Number(
                        nextStats.damageMax ??
                        damageMin
                    )
                );

                nextStats.damageMin = damageMin;
                nextStats.damageMax = damageMax;
                nextStats.damage = Math.round(
                    (damageMin + damageMax) / 2
                );
            }

            nextStats.defense = Math.max(
                0,
                Number(nextStats.defense || 0)
            );

            const maxHp = Math.max(
                1,
                Number(
                    nextStats.maxHp ??
                    previousStats.maxHp ??
                    100
                )
            );

            const maxMana = Math.max(
                0,
                Number(
                    nextStats.maxMana ??
                    previousStats.maxMana ??
                    0
                )
            );

            nextStats.maxHp = maxHp;
            nextStats.hp = Math.min(
                maxHp,
                Math.max(
                    0,
                    Number(
                        previousStats.hp ??
                        maxHp
                    )
                )
            );

            nextStats.maxMana = maxMana;
            nextStats.mana = Math.min(
                maxMana,
                Math.max(
                    0,
                    Number(
                        previousStats.mana ??
                        maxMana
                    )
                )
            );

            ["xp", "gold", "diamonds"].forEach((resource) => {
                if (
                    Number.isFinite(
                        Number(previousStats[resource])
                    )
                ) {
                    nextStats[resource] =
                        Number(previousStats[resource]);
                }
            });

            // Apply armor discipline passives to nextStats
            if (Aethra.DisciplineSystem) {
                const clothLevel = Math.max(1, Number(Aethra.DisciplineSystem.getState("cloth_armor")?.level || 1));
                const leatherLevel = Math.max(1, Number(Aethra.DisciplineSystem.getState("leather_armor")?.level || 1));
                const plateLevel = Math.max(1, Number(Aethra.DisciplineSystem.getState("plate_armor")?.level || 1));

                if (clothLevel > 1) {
                    nextStats.mag = (nextStats.mag || 0) * (1 + (clothLevel - 1) * 0.01);
                    nextStats.maxMana = (nextStats.maxMana || 0) * (1 + (clothLevel - 1) * 0.005);
                }
                if (leatherLevel > 1) {
                    nextStats.evasion = (nextStats.evasion || 0) + (leatherLevel - 1) * 0.005;
                    nextStats.critical = (nextStats.critical || 0) + (leatherLevel - 1) * 0.002;
                }
                if (plateLevel > 1) {
                    nextStats.defense = (nextStats.defense || 0) * (1 + (plateLevel - 1) * 0.01);
                    nextStats.maxHp = (nextStats.maxHp || 0) * (1 + (plateLevel - 1) * 0.01);
                }
            }

            hero.stats = nextStats;
            hero.equipment = equipment;
            Aethra.GameState.playerEquipment = equipment;

            const payload = {
                baseStats: clone(baseStats),
                equipmentBonuses: clone(equipmentBonuses),
                finalStats: clone(nextStats),
                playerEquipment: clone(equipment),
                source:
                    options.source ||
                    "equipment-update"
            };

            if (options.emit !== false) {
                Aethra.EventBus.emit(
                    "PlayerStatsUpdated",
                    payload
                );
                Aethra.EventBus.emit(
                    "equipment:stats-updated",
                    clone(payload)
                );
                Aethra.EventBus.emit("statsChanged", {
                    stats: clone(nextStats),
                    hero,
                    source: payload.source
                });
            }

            if (options.save === true) {
                Aethra.SaveManager.save(
                    options.source ||
                    "equipment-stats"
                );
            }

            return hero.stats;
        },

        recalculateStats(options = {}) {
            return this.updatePlayerStats(options);
        },

        getEquipped(slot) {
            const { equipment } =
                ensureHeroEquipmentState();

            return equipment[slot] || null;
        },

        getEquipment() {
            const { equipment } =
                ensureHeroEquipmentState();

            return clone(equipment);
        },

        getPlayerEquipment() {
            return this.getEquipment();
        }
    };

    Aethra.EquipSystem.init();
})(window.Aethra);
