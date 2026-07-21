// ConsumableSystem.js - Uso transacional de supplies e efeitos oficiais.
(function initConsumableSystem(Aethra) {
    "use strict";

    if (!Aethra?.GameState || !Aethra?.EventBus || !Aethra?.BagSystem || !Aethra?.BattleSystem) {
        throw new Error("ConsumableSystem.js requer GameState, EventBus, BagSystem e BattleSystem.");
    }

    const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const integer = (value, fallback = 0) => Math.max(0, Math.floor(number(value, fallback)));
    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

    const DEFAULT_POLICY = Object.freeze({
        enabled: true,
        healthThreshold: 0.35,
        manaThreshold: 0.20,
        energyThreshold: 0.15,
        healthItemId: "potion_health",
        manaItemId: "potion_mana",
        energyItemId: "minor_vigor_tonic"
    });

    const runtime = {
        initialized: false,
        sequence: 0,
        lastAutoKey: null
    };

    function templateFor(item = {}) {
        return Aethra.GameData?.items?.[item.templateId || item.id] ||
            Aethra.ItemSystem?.templates?.[item.templateId || item.id] ||
            {};
    }

    function resolveItem(itemOrId) {
        const bag = Aethra.BagSystem.getItems();
        if (itemOrId && typeof itemOrId === "object") {
            if (itemOrId.instanceId) {
                return bag.find((item) => item?.instanceId === itemOrId.instanceId) || null;
            }
            itemOrId = itemOrId.templateId || itemOrId.id;
        }
        return bag.find((item) => item?.instanceId === itemOrId)
            || bag.find((item) => String(item?.templateId || item?.id || "") === String(itemOrId || ""))
            || null;
    }

    function effectsFor(item) {
        const template = templateFor(item);
        const effect = item.effect ?? template.effect ?? null;
        return {
            hp: integer(item.healAmount ?? template.healAmount, 0),
            mana: integer(item.manaAmount ?? template.manaAmount, 0),
            energy: integer(item.energyAmount ?? template.energyAmount, 0),
            cleansePoison: effect === "cleanse_poison" || item.cleansePoison === true || template.cleansePoison === true
        };
    }

    function currentResources() {
        const projected = Aethra.CombatProjection?.getSnapshot?.()?.hero?.resources;
        const hero = Aethra.GameState.hero || {};
        const stats = hero.stats || {};
        return projected || {
            hp: {
                current: number(hero.hp ?? stats.hp, 0),
                maximum: Math.max(1, number(hero.maxHp ?? stats.maxHp, 1))
            },
            mana: {
                current: number(hero.mana ?? stats.mana, 0),
                maximum: Math.max(0, number(hero.maxMana ?? stats.maxMana, 0))
            },
            energy: {
                current: number(hero.energy ?? stats.energy, 0),
                maximum: Math.max(0, number(hero.maxEnergy ?? stats.maxEnergy, 0))
            }
        };
    }

    function preview(itemOrId) {
        const item = resolveItem(itemOrId);
        if (!item) return { usable: false, reason: "ITEM_NOT_FOUND" };
        const type = String(item.itemType || item.type || "").toLowerCase();
        if (type !== "consumable") return { usable: false, reason: "ITEM_NOT_CONSUMABLE", item: clone(item) };

        const requested = effectsFor(item);
        const resources = currentResources();
        const hero = Aethra.GameState.hero || {};
        const statusEffects = Array.isArray(hero.statusEffects) ? hero.statusEffects : [];
        const poisonActive = statusEffects.some((status) => /poison|veneno/i.test(String(status?.id || status?.type || status)));
        const recoverable = {
            hp: Math.min(requested.hp, Math.max(0, number(resources.hp.maximum) - number(resources.hp.current))),
            mana: Math.min(requested.mana, Math.max(0, number(resources.mana.maximum) - number(resources.mana.current))),
            energy: Math.min(requested.energy, Math.max(0, number(resources.energy.maximum) - number(resources.energy.current))),
            cleansePoison: requested.cleansePoison && poisonActive
        };
        const useful = recoverable.hp > 0 || recoverable.mana > 0 || recoverable.energy > 0 || recoverable.cleansePoison;
        return {
            usable: useful,
            reason: useful ? null : "NO_EFFECT_NEEDED",
            item: clone(item),
            requested,
            recoverable,
            resources: clone(resources)
        };
    }

    function fail(reason, details = {}) {
        const payload = { used: false, reason, ...clone(details) };
        Aethra.EventBus.emit("consumable:use-failed", payload);
        return payload;
    }

    function removePoison() {
        const hero = Aethra.GameState.hero || {};
        if (!Array.isArray(hero.statusEffects)) return 0;
        const before = hero.statusEffects.length;
        hero.statusEffects = hero.statusEffects.filter((status) => {
            return !/poison|veneno/i.test(String(status?.id || status?.type || status));
        });
        return before - hero.statusEffects.length;
    }

    Aethra.ConsumableSystem = {
        initialized: false,
        defaults: DEFAULT_POLICY,

        init() {
            if (runtime.initialized) return this.getSnapshot();
            this.ensurePolicy();
            Aethra.EventBus.on("consumable:use-requested", (payload = {}) => {
                this.use(payload.instanceId || payload.itemId || payload.templateId, {
                    ...payload,
                    source: payload.source || "player-request"
                });
            });
            ["game:reset", "save:loaded", "state:restored", "battle:ended"]
                .forEach((eventName) => Aethra.EventBus.on(eventName, () => {
                    runtime.lastAutoKey = null;
                    this.ensurePolicy();
                }));
            runtime.initialized = true;
            this.initialized = true;
            Aethra.EventBus.emit("consumable:ready", this.getSnapshot());
            return this.getSnapshot();
        },

        ensurePolicy() {
            const hero = Aethra.GameState.hero || (Aethra.GameState.hero = {});
            hero.autoConsumables = {
                ...DEFAULT_POLICY,
                ...(hero.autoConsumables || {})
            };
            hero.autoConsumables.enabled = hero.autoConsumables.enabled !== false;
            ["healthThreshold", "manaThreshold", "energyThreshold"].forEach((key) => {
                hero.autoConsumables[key] = clamp(number(hero.autoConsumables[key], DEFAULT_POLICY[key]), 0.05, 0.95);
            });
            return hero.autoConsumables;
        },

        configure(patch = {}) {
            const policy = this.ensurePolicy();
            Object.assign(policy, patch);
            this.ensurePolicy();
            Aethra.EventBus.emit("consumable:policy-changed", clone(policy));
            Aethra.SaveManager?.save?.("consumable-policy");
            return clone(policy);
        },

        preview,

        use(itemOrId, options = {}) {
            const evaluation = preview(itemOrId);
            if (!evaluation.item) return fail(evaluation.reason || "ITEM_NOT_FOUND", { itemId: itemOrId });
            if (!evaluation.usable && options.allowWaste !== true) {
                return fail(evaluation.reason, { item: evaluation.item });
            }

            const consumed = Aethra.BagSystem.consumeItem(
                evaluation.item,
                1,
                options.source || "consumable-system"
            );
            if (!consumed) return fail("CONSUME_TRANSACTION_FAILED", { item: evaluation.item });

            const eventId = options.eventId || `consumable_${Date.now().toString(36)}_${++runtime.sequence}`;
            const applied = { hp: 0, mana: 0, energy: 0, cleansed: 0 };

            if (evaluation.recoverable.hp > 0) {
                const healing = Aethra.BattleSystem.applyHealing(evaluation.requested.hp, {
                    eventId,
                    itemName: evaluation.item.name,
                    source: "consumable-system"
                });
                applied.hp = integer(healing?.amount, 0);
            }
            if (evaluation.recoverable.mana > 0) {
                const before = Aethra.SkillSystem?.getResource?.("mana") ?? evaluation.resources.mana.current;
                const after = Aethra.SkillSystem?.setResource?.("mana", before + evaluation.requested.mana, "consumable-system");
                applied.mana = Math.max(0, integer(after, before) - integer(before, 0));
            }
            if (evaluation.recoverable.energy > 0) {
                const before = Aethra.SkillSystem?.getResource?.("energy") ?? evaluation.resources.energy.current;
                const after = Aethra.SkillSystem?.setResource?.("energy", before + evaluation.requested.energy, "consumable-system");
                applied.energy = Math.max(0, integer(after, before) - integer(before, 0));
            }
            if (evaluation.recoverable.cleansePoison) applied.cleansed = removePoison();

            const battle = Aethra.GameState.battle || {};
            const unitCost = Math.max(0, number(
                options.unitCost,
                evaluation.item.price ?? evaluation.item.basePrice ?? templateFor(evaluation.item).price ?? 0
            ));
            const supply = Aethra.HuntSystem?.recordSupplyUse?.(evaluation.item, 1, {
                itemId: evaluation.item.templateId || evaluation.item.id,
                name: evaluation.item.name,
                unitCost,
                source: options.source || "consumable-system"
            }) || null;
            const effectLabels = [
                applied.hp > 0 ? `+${applied.hp} HP` : "",
                applied.mana > 0 ? `+${applied.mana} MP` : "",
                applied.energy > 0 ? `+${applied.energy} Vigor` : "",
                applied.cleansed > 0 ? "veneno removido" : ""
            ].filter(Boolean);
            const payload = {
                eventId,
                used: true,
                action: "consumable",
                item: evaluation.item,
                itemId: evaluation.item.templateId || evaluation.item.id,
                quantity: 1,
                effects: applied,
                battleId: battle.battleId || null,
                round: battle.round || 0,
                consumesAction: options.consumesAction !== false,
                automatic: options.automatic === true,
                supply,
                source: options.source || "consumable-system",
                message: `${evaluation.item.name} usado${effectLabels.length ? `: ${effectLabels.join(" · ")}` : ""}.`
            };

            Aethra.EventBus.emit("consumable:used", clone(payload));
            const battleLog = {
                eventId,
                message: payload.message,
                color: "#66d9a7",
                type: "supply",
                source: "consumable-system",
                battleId: payload.battleId,
                round: payload.round
            };
            if (typeof Aethra.BattleSystem?.emitBattleLog === "function") {
                Aethra.BattleSystem.emitBattleLog(battleLog);
            } else {
                Aethra.EventBus.emit("BattleLog", battleLog);
            }
            Aethra.SaveManager?.save?.("consumable-used");
            return clone(payload);
        },

        tryAutoUse(context = {}) {
            const projection = Aethra.CombatProjection?.getSnapshot?.();
            if (!projection?.active) return false;
            const policy = this.ensurePolicy();
            if (!policy.enabled) return false;

            const autoKey = `${projection.battleId}:${projection.round}`;
            if (runtime.lastAutoKey === autoKey) return false;

            const resources = projection.hero.resources;
            const candidates = [
                resources.hp.maximum > 0 && resources.hp.percent <= policy.healthThreshold ? policy.healthItemId : null,
                resources.mana.maximum > 0 && resources.mana.percent <= policy.manaThreshold ? policy.manaItemId : null,
                resources.energy.maximum > 0 && resources.energy.percent <= policy.energyThreshold ? policy.energyItemId : null
            ].filter(Boolean);

            for (const itemId of candidates) {
                if (Aethra.BagSystem.countItem(itemId) <= 0) continue;
                const result = this.use(itemId, {
                    automatic: true,
                    consumesAction: true,
                    source: "auto-supply",
                    context
                });
                if (result?.used) {
                    runtime.lastAutoKey = autoKey;
                    return result;
                }
            }
            return false;
        },

        getSnapshot() {
            return {
                initialized: runtime.initialized,
                policy: clone(this.ensurePolicy()),
                inventory: {
                    health: Aethra.BagSystem.countItem("potion_health"),
                    mana: Aethra.BagSystem.countItem("potion_mana"),
                    energy: Aethra.BagSystem.countItem("minor_vigor_tonic")
                },
                lastAutoKey: runtime.lastAutoKey
            };
        }
    };
})(window.Aethra = window.Aethra || {});
