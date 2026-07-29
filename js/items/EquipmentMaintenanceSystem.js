// EquipmentMaintenanceSystem.js - autoridade unica de durabilidade e reparos.
(function initEquipmentMaintenanceSystem(Aethra) {
    "use strict";

    if (!Aethra?.GameState || !Aethra?.EventBus) {
        throw new Error("EquipmentMaintenanceSystem.js requer game-core.js.");
    }

    const MAX_DURABILITY = 100;
    const LOW_DURABILITY_PERCENT = 25;
    const WEAPON_WEAR = 1;
    const ARMOR_WEAR = 0.4;
    const ACCESSORY_WEAR = 0.1;
    const ARMOR_SLOTS = new Set(["offhand", "head", "chest", "hands", "legs", "feet"]);
    const ACCESSORY_SLOTS = new Set(["neck", "ring1", "ring2", "relic"]);
    const DEFAULT_POLICY = Object.freeze({
        enabled: false,
        thresholdPercent: 35,
        reserveGold: 25,
        maxGoldPerCycle: 100
    });

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, number(value, min)));
    const round = (value, digits = 1) => {
        const multiplier = 10 ** digits;
        return Math.round(number(value) * multiplier) / multiplier;
    };
    const nowISO = () => new Date().toISOString();
    const commandId = (prefix = "maintenance") => {
        return window.crypto?.randomUUID?.()
            ? `${prefix}_${window.crypto.randomUUID()}`
            : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    };

    function getTemplate(item) {
        return Aethra.GameData?.items?.[item?.templateId || item?.id] || {};
    }

    function getSlot(item) {
        const template = getTemplate(item);
        return String(item?.slot || template.slot || "").toLowerCase();
    }

    function isMaintainable(item) {
        if (!item || typeof item !== "object" || item.stackable === true) return false;
        const slot = getSlot(item);
        return slot === "weapon" || ARMOR_SLOTS.has(slot) || ACCESSORY_SLOTS.has(slot);
    }

    function ensureDurability(item) {
        if (!isMaintainable(item)) return null;
        const source = item.durability && typeof item.durability === "object"
            ? item.durability
            : {};
        const max = Math.max(1, round(source.max, MAX_DURABILITY));
        const current = clamp(source.current ?? max, 0, max);
        item.durability = {
            current: round(current),
            max: round(max),
            lastChangedAt: source.lastChangedAt || null,
            brokenAt: source.brokenAt || null
        };
        return item.durability;
    }

    function getPercent(item) {
        const durability = ensureDurability(item);
        if (!durability) return 100;
        return round((durability.current / Math.max(1, durability.max)) * 100);
    }

    function getEffectiveness(item) {
        if (!isMaintainable(item)) return 1;
        const percent = getPercent(item);
        if (percent <= 0) return 0;
        if (percent >= LOW_DURABILITY_PERCENT) return 1;
        return round(0.75 + (0.25 * (percent / LOW_DURABILITY_PERCENT)), 3);
    }

    function getStatus(item) {
        const percent = getPercent(item);
        if (percent <= 0) return "broken";
        if (percent <= LOW_DURABILITY_PERCENT) return "critical";
        if (percent <= 50) return "worn";
        return "good";
    }

    function resolveItem(itemOrId) {
        if (itemOrId && typeof itemOrId === "object") return itemOrId;
        const id = String(itemOrId || "");
        if (!id) return null;
        const bag = Array.isArray(Aethra.GameState.hero?.bag) ? Aethra.GameState.hero.bag : [];
        const equipment = Aethra.GameState.playerEquipment || Aethra.GameState.hero?.equipment || {};
        return bag.find((item) => item?.instanceId === id)
            || Object.values(equipment).find((item) => item?.instanceId === id)
            || null;
    }

    function getAllItemReferences() {
        const bag = Array.isArray(Aethra.GameState.hero?.bag) ? Aethra.GameState.hero.bag : [];
        const equipment = Aethra.GameState.playerEquipment || Aethra.GameState.hero?.equipment || {};
        const result = [];
        const seen = new Set();

        Object.entries(equipment).forEach(([slot, item]) => {
            if (!item || !isMaintainable(item)) return;
            const key = item.instanceId || item;
            if (seen.has(key)) return;
            seen.add(key);
            ensureDurability(item);
            result.push({ item, slot, equipped: true });
        });

        bag.forEach((item) => {
            if (!isMaintainable(item)) return;
            const key = item.instanceId || item;
            if (seen.has(key)) return;
            seen.add(key);
            ensureDurability(item);
            result.push({ item, slot: getSlot(item), equipped: false });
        });

        return result;
    }

    function getProfessionId(item) {
        const template = getTemplate(item);
        const armorType = String(item?.armorType || template.armorType || "").toLowerCase();
        const templateId = String(item?.templateId || item?.id || "").toLowerCase();
        const craftedBy = String(item?.origin?.professionId || "").toLowerCase();
        return armorType === "leather"
            || templateId.includes("leather")
            || craftedBy === "leatherworking"
            ? "leatherworking"
            : "blacksmithing";
    }

    function getTier(item) {
        const template = getTemplate(item);
        const explicit = Math.floor(number(item?.tier ?? template.tier, 0));
        if (explicit > 0) return clamp(explicit, 1, 3);
        const level = Math.max(1, Math.floor(number(item?.levelReq ?? template.levelReq, 1)));
        return clamp(Math.floor((level - 1) / 10) + 1, 1, 3);
    }

    function getRepairMaterial(item) {
        const professionId = getProfessionId(item);
        const tier = getTier(item);
        if (professionId === "leatherworking") {
            return {
                itemId: tier >= 3 ? "shadow_leather" : tier >= 2 ? "reinforced_leather" : "beast_hide",
                professionId,
                stationId: "tannery",
                actionType: "repair-leather"
            };
        }
        return {
            itemId: tier >= 3 ? "aether_alloy" : tier >= 2 ? "steel_ingot" : "iron_ore",
            professionId,
            stationId: "forge",
            actionType: "repair"
        };
    }

    function getMaterialName(itemId) {
        return Aethra.GameData?.items?.[itemId]?.name
            || Aethra.ItemSystem?.templates?.[itemId]?.name
            || itemId;
    }

    function getRepairQuote(itemOrId) {
        const item = resolveItem(itemOrId);
        if (!item || !isMaintainable(item)) return { allowed: false, reason: "item-not-maintainable" };
        const durability = ensureDurability(item);
        const missing = round(durability.max - durability.current);
        const missingRatio = missing / Math.max(1, durability.max);
        const material = getRepairMaterial(item);
        const referencePrice = Math.max(10, number(item.price ?? item.basePrice ?? getTemplate(item).price, 10));
        const gold = missing > 0 ? Math.max(1, Math.ceil(referencePrice * missingRatio * 0.25)) : 0;
        const materialQuantity = missing > 0 ? Math.max(1, Math.ceil(missingRatio * 3)) : 0;
        const ownedMaterial = Aethra.BagSystem?.countItem?.(material.itemId) || 0;
        const heroGold = Math.max(0, number(Aethra.GameState.hero?.gold, 0));

        return {
            allowed: missing > 0,
            reason: missing > 0 ? null : "not-damaged",
            item,
            instanceId: item.instanceId || null,
            before: round(durability.current),
            after: round(durability.max),
            missing,
            percent: getPercent(item),
            status: getStatus(item),
            effectiveness: getEffectiveness(item),
            professionId: material.professionId,
            stationId: material.stationId,
            actionType: material.actionType,
            gold,
            heroGold,
            materialId: material.itemId,
            materialName: getMaterialName(material.itemId),
            materialQuantity,
            ownedMaterial,
            canAffordGold: heroGold >= gold,
            hasMaterial: ownedMaterial >= materialQuantity,
            xp: missing > 0 ? Math.min(12, Math.max(1, Math.round(missing / 10))) : 0
        };
    }

    function normalizePolicy(policy = {}) {
        return {
            enabled: policy.enabled === true,
            thresholdPercent: Math.round(clamp(policy.thresholdPercent, 5, 90)),
            reserveGold: Math.max(0, Math.floor(number(policy.reserveGold, DEFAULT_POLICY.reserveGold))),
            maxGoldPerCycle: Math.max(0, Math.floor(number(policy.maxGoldPerCycle, DEFAULT_POLICY.maxGoldPerCycle)))
        };
    }

    function ensureState() {
        const state = Aethra.GameState;
        state.maintenance = state.maintenance && typeof state.maintenance === "object"
            ? state.maintenance
            : {};
        state.maintenance.policy = normalizePolicy({
            ...DEFAULT_POLICY,
            ...(state.maintenance.policy || {})
        });
        state.maintenance.processedCommands = Array.isArray(state.maintenance.processedCommands)
            ? state.maintenance.processedCommands.slice(-100)
            : [];
        state.maintenance.totals = state.maintenance.totals && typeof state.maintenance.totals === "object"
            ? state.maintenance.totals
            : {};
        state.maintenance.totals.repairs = Math.max(0, Math.floor(number(state.maintenance.totals.repairs, 0)));
        state.maintenance.totals.durabilityRestored = Math.max(0, number(state.maintenance.totals.durabilityRestored, 0));
        state.maintenance.totals.goldSpent = Math.max(0, Math.floor(number(state.maintenance.totals.goldSpent, 0)));
        state.maintenance.lastAutoRepair = state.maintenance.lastAutoRepair || null;
        getAllItemReferences();
        return state.maintenance;
    }

    function hasProcessed(id) {
        return Boolean(id && Aethra.GameState.maintenance?.processedCommands?.includes(id));
    }

    function markProcessed(id) {
        if (!id) return;
        const list = Aethra.GameState.maintenance.processedCommands;
        if (!list.includes(id)) list.push(id);
        Aethra.GameState.maintenance.processedCommands = list.slice(-100);
    }

    function isCompetitiveBattle() {
        return Aethra.GameState.battle?.source === "coliseum"
            || Boolean(Aethra.GameState.coliseum?.activeMatch);
    }

    Aethra.EquipmentMaintenanceSystem = {
        initialized: false,
        constants: {
            maxDurability: MAX_DURABILITY,
            lowDurabilityPercent: LOW_DURABILITY_PERCENT,
            weaponWear: WEAPON_WEAR,
            armorWear: ARMOR_WEAR,
            accessoryWear: ACCESSORY_WEAR
        },

        init() {
            if (this.initialized) return this.getSnapshot();
            ensureState();
            this.bindEvents();
            this.initialized = true;
            Aethra.EquipSystem?.recalculateStats?.({
                emit: true,
                save: false,
                source: "maintenance-init"
            });
            Aethra.EventBus.emit("maintenance:ready", this.getSnapshot());
            return this.getSnapshot();
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            Aethra.EventBus.on("item:generated", ({ item } = {}) => ensureDurability(item));
            Aethra.EventBus.on("primary-attack:used", ({ weapon, result } = {}) => {
                if (isCompetitiveBattle()) return;
                this.applyWear(weapon?.instanceId || result?.weaponId, WEAPON_WEAR, {
                    source: "primary-attack",
                    battleId: result?.battleId || Aethra.GameState.battle?.battleId || null,
                    round: result?.round || Aethra.GameState.battle?.round || 0
                });
            });
            Aethra.EventBus.on("battle:hero-action", ({ type, result } = {}) => {
                if (type === "primary-attack" || isCompetitiveBattle()) return;
                if (result?.side !== "hero" || !result?.weaponId) return;
                this.applyWear(result.weaponId, WEAPON_WEAR, {
                    source: "skill-attack",
                    battleId: result.battleId || Aethra.GameState.battle?.battleId || null,
                    round: result.round || Aethra.GameState.battle?.round || 0
                });
            });
            Aethra.EventBus.on("battle:damage-dealt", (payload = {}) => {
                if (payload.side !== "creature" || !payload.hit || number(payload.amount) <= 0 || isCompetitiveBattle()) return;
                this.applyDefensiveWear(payload);
            });
            const restore = () => {
                ensureState();
                Aethra.EquipSystem?.recalculateStats?.({ emit: true, save: false, source: "maintenance-state-restored" });
            };
            Aethra.EventBus.on("save:loaded", restore);
            Aethra.EventBus.on("state:restored", restore);
        },

        ensureItemDurability(item) {
            const durability = ensureDurability(item);
            return durability ? clone(durability) : null;
        },

        isMaintainable,
        getPercent,
        getStatus,
        getEffectiveness,
        getProfessionId,
        getRepairQuote,

        getEffectiveStats(item) {
            const raw = Aethra.GameData?.calculateItemStats?.(item) || clone(item?.stats || {});
            const factor = getEffectiveness(item);
            if (factor >= 1) return raw;
            return Object.fromEntries(Object.entries(raw).map(([stat, value]) => {
                const numeric = Number(value);
                if (!Number.isFinite(numeric)) return [stat, value];
                const digits = Math.abs(numeric) < 1 ? 3 : 1;
                return [stat, round(numeric * factor, digits)];
            }));
        },

        applyWear(itemOrId, amount = 1, context = {}) {
            const item = resolveItem(itemOrId);
            if (!item || !isMaintainable(item) || number(amount) <= 0) return false;
            const durability = ensureDurability(item);
            if (durability.current <= 0) return false;
            const before = durability.current;
            const beforeEffectiveness = getEffectiveness(item);
            durability.current = round(clamp(before - number(amount), 0, durability.max));
            durability.lastChangedAt = nowISO();
            if (durability.current <= 0 && !durability.brokenAt) durability.brokenAt = durability.lastChangedAt;
            const afterEffectiveness = getEffectiveness(item);
            const payload = {
                item,
                instanceId: item.instanceId || null,
                before,
                after: durability.current,
                percent: getPercent(item),
                status: getStatus(item),
                source: context.source || "equipment-wear",
                battleId: context.battleId || null,
                round: context.round || 0
            };
            if (beforeEffectiveness !== afterEffectiveness) {
                Aethra.EquipSystem?.recalculateStats?.({ emit: true, save: false, source: "durability-effectiveness" });
            }
            if (context.emit !== false) {
                Aethra.EventBus.emit("equipment:durability-changed", clone(payload));
                if (payload.status === "broken") Aethra.EventBus.emit("equipment:broken", clone(payload));
            }
            return clone(payload);
        },

        applyDefensiveWear(attack = {}) {
            const equipment = Aethra.GameState.playerEquipment || Aethra.GameState.hero?.equipment || {};
            const changed = [];
            Object.entries(equipment).forEach(([slot, item]) => {
                if (!item) return;
                const itemSlot = slot || getSlot(item);
                const amount = ARMOR_SLOTS.has(itemSlot)
                    ? ARMOR_WEAR
                    : ACCESSORY_SLOTS.has(itemSlot)
                        ? ACCESSORY_WEAR
                        : 0;
                if (amount <= 0) return;
                const result = this.applyWear(item, amount, {
                    emit: false,
                    source: "damage-received",
                    battleId: attack.battleId || Aethra.GameState.battle?.battleId || null,
                    round: attack.round || Aethra.GameState.battle?.round || 0
                });
                if (result) changed.push(result);
            });
            if (changed.length > 0) {
                const payload = {
                    items: changed,
                    source: "damage-received",
                    battleId: attack.battleId || Aethra.GameState.battle?.battleId || null,
                    round: attack.round || Aethra.GameState.battle?.round || 0
                };
                Aethra.EventBus.emit("equipment:durability-changed", clone(payload));
                changed.filter((entry) => entry.status === "broken").forEach((entry) => {
                    Aethra.EventBus.emit("equipment:broken", clone(entry));
                });
            }
            return clone(changed);
        },

        validateRepair(itemOrId, options = {}) {
            ensureState();
            const quote = getRepairQuote(itemOrId);
            if (!quote.allowed) return quote;
            const inCity = Aethra.GameState.ui?.primaryView === "city" && !Aethra.GameState.hunt?.isActive;
            if (options.bypassStation !== true && !inCity) return { ...quote, allowed: false, reason: "not-in-city" };
            if (options.bypassStation !== true && options.stationId !== quote.stationId) {
                return { ...quote, allowed: false, reason: "wrong-station" };
            }
            if (!quote.hasMaterial) return { ...quote, allowed: false, reason: "missing-materials" };
            const reserveGold = Math.max(0, number(options.reserveGold, 0));
            if (quote.heroGold - quote.gold < reserveGold) {
                return { ...quote, allowed: false, reason: "insufficient-gold" };
            }
            if (Number.isFinite(Number(options.remainingBudget)) && quote.gold > number(options.remainingBudget)) {
                return { ...quote, allowed: false, reason: "cycle-budget" };
            }
            return { ...quote, allowed: true, reason: null };
        },

        repairItem(itemOrId, options = {}) {
            ensureState();
            const id = options.commandId || commandId("repair");
            if (hasProcessed(id)) return { accepted: false, reason: "duplicate-command", commandId: id };
            const validation = this.validateRepair(itemOrId, options);
            if (!validation.allowed) {
                Aethra.EventBus.emit("maintenance:repair-rejected", { ...clone(validation), commandId: id });
                return { ...clone(validation), accepted: false, commandId: id };
            }

            const consumed = Aethra.BagSystem?.consumeItem?.(
                validation.materialId,
                validation.materialQuantity,
                "equipment-repair"
            );
            if (!consumed) return { ...clone(validation), accepted: false, reason: "material-consume-failed", commandId: id };

            const hero = Aethra.GameState.hero;
            hero.gold = Math.max(0, number(hero.gold) - validation.gold);
            const durability = ensureDurability(validation.item);
            durability.current = durability.max;
            durability.lastChangedAt = nowISO();
            durability.brokenAt = null;
            validation.item.history = Array.isArray(validation.item.history) ? validation.item.history : [];
            validation.item.history.push({
                type: "repaired",
                at: durability.lastChangedAt,
                source: options.source || "workshop",
                restored: validation.missing,
                gold: validation.gold,
                materialId: validation.materialId,
                materialQuantity: validation.materialQuantity
            });
            validation.item.history = validation.item.history.slice(-50);

            markProcessed(id);
            const maintenance = Aethra.GameState.maintenance;
            maintenance.totals.repairs += 1;
            maintenance.totals.durabilityRestored = round(maintenance.totals.durabilityRestored + validation.missing);
            maintenance.totals.goldSpent += validation.gold;

            const professionXP = Aethra.ProfessionSystem?.grantActionXP?.(
                validation.professionId,
                validation.xp,
                validation.actionType,
                {
                    source: "equipment-repair",
                    difficulty: getTier(validation.item),
                    itemId: validation.item.templateId || validation.item.id
                }
            ) || null;

            Aethra.EquipSystem?.recalculateStats?.({ emit: true, save: false, source: "equipment-repaired" });
            const payload = {
                accepted: true,
                commandId: id,
                item: clone(validation.item),
                instanceId: validation.instanceId,
                before: validation.before,
                after: durability.current,
                restored: validation.missing,
                gold: validation.gold,
                materialId: validation.materialId,
                materialName: validation.materialName,
                materialQuantity: validation.materialQuantity,
                professionId: validation.professionId,
                xp: validation.xp,
                professionXP,
                source: options.source || "workshop"
            };
            Aethra.EventBus.emit("goldChanged", { gold: hero.gold, delta: -validation.gold, source: "equipment-repair" });
            Aethra.EventBus.emit("maintenance:repaired", clone(payload));
            Aethra.EventBus.emit("equipment:durability-changed", clone(payload));
            if (options.save !== false) Aethra.SaveManager?.save?.("equipment-repaired");
            return payload;
        },

        repairEligible(options = {}) {
            ensureState();
            const professionId = options.professionId || null;
            const threshold = options.thresholdOnly === true
                ? clamp(options.thresholdPercent ?? Aethra.GameState.maintenance.policy.thresholdPercent, 0, 100)
                : 100;
            const reserveGold = Math.max(0, number(options.reserveGold, 0));
            const maxGold = Number.isFinite(Number(options.maxGold))
                ? Math.max(0, number(options.maxGold))
                : Infinity;
            let goldSpent = 0;
            const repaired = [];
            const skipped = [];
            const candidates = getAllItemReferences()
                .filter(({ item }) => !professionId || getProfessionId(item) === professionId)
                .filter(({ item }) => getPercent(item) <= threshold && getPercent(item) < 100)
                .sort((a, b) => getPercent(a.item) - getPercent(b.item));

            candidates.forEach(({ item }) => {
                const result = this.repairItem(item, {
                    commandId: `${options.commandId || commandId("repair-cycle")}:${item.instanceId || item.templateId}`,
                    stationId: options.stationId,
                    bypassStation: options.bypassStation === true,
                    reserveGold,
                    remainingBudget: maxGold - goldSpent,
                    save: false,
                    source: options.source || "repair-cycle"
                });
                if (result.accepted) {
                    repaired.push(result);
                    goldSpent += result.gold;
                } else {
                    skipped.push(result);
                }
            });

            const summary = {
                accepted: repaired.length > 0,
                professionId,
                repaired,
                skipped,
                goldSpent,
                restored: round(repaired.reduce((total, entry) => total + number(entry.restored), 0)),
                source: options.source || "repair-cycle"
            };
            if (repaired.length > 0) Aethra.SaveManager?.save?.("equipment-repair-cycle");
            Aethra.EventBus.emit("maintenance:cycle-completed", clone(summary));
            return summary;
        },

        runAutoRepair(options = {}) {
            ensureState();
            const policy = Aethra.GameState.maintenance.policy;
            if (!policy.enabled) return { accepted: false, reason: "policy-disabled", repaired: [], skipped: [] };
            const result = this.repairEligible({
                commandId: options.commandId || commandId("auto-repair"),
                thresholdOnly: true,
                thresholdPercent: policy.thresholdPercent,
                reserveGold: policy.reserveGold,
                maxGold: policy.maxGoldPerCycle,
                bypassStation: true,
                source: `auto-repair:${options.trigger || "automatic"}`
            });
            Aethra.GameState.maintenance.lastAutoRepair = {
                at: nowISO(),
                trigger: options.trigger || "automatic",
                repaired: result.repaired.length,
                skipped: result.skipped.length,
                goldSpent: result.goldSpent,
                restored: result.restored
            };
            Aethra.EventBus.emit("maintenance:auto-completed", clone({ ...result, policy, trigger: options.trigger || "automatic" }));
            return result;
        },

        setPolicy(patch = {}, source = "player-command") {
            ensureState();
            Aethra.GameState.maintenance.policy = normalizePolicy({
                ...Aethra.GameState.maintenance.policy,
                ...patch
            });
            const payload = { policy: clone(Aethra.GameState.maintenance.policy), source, changedAt: nowISO() };
            Aethra.EventBus.emit("maintenance:policy-changed", payload);
            Aethra.SaveManager?.save?.("maintenance-policy-changed");
            return clone(payload.policy);
        },

        getPolicy() {
            ensureState();
            return clone(Aethra.GameState.maintenance.policy);
        },

        getItems(professionId = null) {
            return getAllItemReferences()
                .filter(({ item }) => !professionId || getProfessionId(item) === professionId)
                .map(({ item, slot, equipped }) => {
                    const quote = getRepairQuote(item);
                    const { item: _itemReference, ...quoteData } = quote;
                    return {
                        item: clone(item),
                        slot,
                        equipped,
                        ...clone(quoteData)
                    };
                });
        },

        getSnapshot(professionId = null) {
            ensureState();
            const items = this.getItems(professionId);
            return {
                policy: clone(Aethra.GameState.maintenance.policy),
                totals: clone(Aethra.GameState.maintenance.totals),
                lastAutoRepair: clone(Aethra.GameState.maintenance.lastAutoRepair),
                items,
                damaged: items.filter((entry) => entry.percent < 100).length,
                critical: items.filter((entry) => entry.percent <= LOW_DURABILITY_PERCENT).length,
                broken: items.filter((entry) => entry.percent <= 0).length,
                estimatedGold: items.filter((entry) => entry.percent < 100).reduce((total, entry) => total + number(entry.gold), 0)
            };
        }
    };
})(window.Aethra);
