// IdleLoopSystem.js — automação segura apoiada na economia e na caçada oficiais.
// Regras e estado (GameState.idleLoop): auto-venda de loot, reposição de
// suprimentos, compra manual, uso automático de poções e continuidade.
// Não desenha nada: avisa por "idle-loop:updated" e as telas leem
// getSupplyOverview/getSnapshot.
(function initIdleLoopSystem(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const SUPPLIES = Object.freeze([
        Object.freeze({ id: "potion_health", label: "Poção de Vida", shortLabel: "Vida", icon: "✚", effect: "+20 HP", role: "Sobrevivência", craftRecipeId: "brew_health_potion", tone: "health", enabled: true, reorderAt: 5, target: 5, policyItemKey: "healthItemId", policyThresholdKey: "healthThreshold" }),
        Object.freeze({ id: "potion_mana", label: "Poção de Mana", shortLabel: "Mana", icon: "◆", effect: "+20 Mana", role: "Recurso arcano", craftRecipeId: "brew_mana_potion", tone: "mana", enabled: true, reorderAt: 5, target: 5, policyItemKey: "manaItemId", policyThresholdKey: "manaThreshold" }),
        Object.freeze({ id: "minor_vigor_tonic", label: "Tônico de Vigor", shortLabel: "Vigor", icon: "ϟ", effect: "+18 Vigor", role: "Recurso físico", craftRecipeId: "brew_vigor_tonic", tone: "vigor", enabled: false, reorderAt: 2, target: 3, policyItemKey: "energyItemId", policyThresholdKey: "energyThreshold" }),
        Object.freeze({ id: "field_antidote", label: "Antídoto de Campanha", shortLabel: "Antídoto", icon: "☤", effect: "Remove veneno", role: "Cura de condição", tone: "antidote", enabled: false, reorderAt: 1, target: 2 })
    ]);
    const DEFAULTS = Object.freeze({
        enabled: true,
        autoSell: true,
        autoRestock: true,
        keepEquipment: true,
        keepCraftingMaterials: true,
        healthTarget: 5,
        manaTarget: 5,
        goldReserve: 0,
        maxRestockSpend: 0,
        allowPartialRestock: true,
        cyclesCompleted: 0,
        totalProfit: 0,
        totalRestockCost: 0,
        lastCycleAt: null
    });
    const AUTO_USE_MIN_PERCENT = 5;
    const AUTO_USE_MAX_PERCENT = 95;

    const integer = (value, fallback = 0, maximum = Number.MAX_SAFE_INTEGER) => {
        const parsed = Number(value);
        return Math.min(maximum, Math.max(0, Math.floor(Number.isFinite(parsed) ? parsed : fallback)));
    };
    const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

    function normalizeSupplyPlan(storedPlan = {}, legacy = {}) {
        return Object.fromEntries(SUPPLIES.map((definition) => {
            const stored = storedPlan?.[definition.id] || {};
            const legacyTarget = definition.id === "potion_health"
                ? legacy.healthTarget
                : definition.id === "potion_mana" ? legacy.manaTarget : undefined;
            const target = integer(stored.target, legacyTarget ?? definition.target, 99);
            const reorderAt = Math.min(target, integer(stored.reorderAt, legacyTarget ?? definition.reorderAt, 99));
            return [definition.id, {
                enabled: stored.enabled === undefined ? definition.enabled : Boolean(stored.enabled),
                reorderAt,
                target,
                priority: integer(stored.priority, SUPPLIES.indexOf(definition) + 1, SUPPLIES.length)
            }];
        }));
    }

    function ensureState() {
        const state = Aethra.GameState || {};
        const stored = state.idleLoop && typeof state.idleLoop === "object" ? state.idleLoop : {};
        const supplyPlan = normalizeSupplyPlan(stored.supplyPlan, stored);
        // Normaliza no mesmo objeto: quem já tem a referência (processCycle)
        // continua escrevendo no estado salvo.
        const normalized = {
            ...DEFAULTS,
            ...stored,
            enabled: stored.enabled !== false,
            autoSell: stored.autoSell !== false,
            autoRestock: stored.autoRestock !== false,
            keepEquipment: stored.keepEquipment !== false,
            keepCraftingMaterials: stored.keepCraftingMaterials !== false,
            allowPartialRestock: stored.allowPartialRestock !== false,
            goldReserve: integer(stored.goldReserve, DEFAULTS.goldReserve),
            maxRestockSpend: integer(stored.maxRestockSpend, DEFAULTS.maxRestockSpend),
            cyclesCompleted: integer(stored.cyclesCompleted),
            totalProfit: integer(stored.totalProfit),
            totalRestockCost: integer(stored.totalRestockCost),
            supplyPlan,
            healthTarget: supplyPlan.potion_health.target,
            manaTarget: supplyPlan.potion_mana.target
        };
        if (state.idleLoop && typeof state.idleLoop === "object") Object.assign(state.idleLoop, normalized);
        else state.idleLoop = normalized;
        return state.idleLoop;
    }

    function notifyChanged(reason) {
        Aethra.EventBus.emit("idle-loop:updated", { reason });
    }

    function templateFor(itemId) {
        return Aethra.GameData?.getItem?.(itemId)
            || Aethra.GameData?.items?.[itemId]
            || Aethra.ItemSystem?.templates?.[itemId]
            || null;
    }

    function unitPriceFor(itemId) {
        const item = templateFor(itemId);
        return integer(item?.price ?? item?.value, 0);
    }

    function originOf(item = {}) {
        return item.market?.purchaseOrigin || item.origin?.source || item.source || "unknown";
    }

    // Insumos de alguma receita das Oficinas (minério, couro, ervas, lingotes).
    function isCraftingMaterial(itemId) {
        if (!itemId) return false;
        return (Aethra.CraftingSystem?.getRecipes?.() || [])
            .some((recipe) => (recipe.inputs || []).some((input) => input.itemId === itemId));
    }

    function isAutoSellEligible(item = {}) {
        const config = ensureState();
        const type = String(item.type || item.itemType || "").toLowerCase();
        const origin = originOf(item);
        if (item.ownership?.bound || origin === "character-created" || origin === "npc-shop") return false;
        if (config.keepEquipment && item.slot) return false;
        // A armadura vem das Oficinas: vender o insumo trava a Forja e o Curtume.
        if (config.keepCraftingMaterials && isCraftingMaterial(item.templateId || item.itemId || item.id)) return false;
        return ["material", "loot"].includes(type) && [
            "loot", "enemy-drop", "hunt-loot", "hunt-system",
            "monster-economy", "battle-hunt", "battle-loot"
        ].includes(origin);
    }

    function autoSellItems(items = []) {
        const config = ensureState();
        if (!config.enabled || !config.autoSell) return { sold: 0, total: 0 };
        let sold = 0;
        let total = 0;
        [...items].filter(isAutoSellEligible).forEach((item) => {
            const result = Aethra.MarketplaceSystem?.sellLoot?.(item.instanceId || item.id);
            if (!result) return;
            sold += 1;
            total += Math.max(0, Number(result.salePrice) || 0);
        });
        if (total > 0) {
            config.totalProfit += total;
            Aethra.EventBus.emit("idle-loop:auto-sold", { sold, total, totalProfit: config.totalProfit });
            notifyChanged("auto-sold");
        }
        return { sold, total };
    }

    function inventoryQuantity(templateId) {
        return (Aethra.GameState?.hero?.bag || []).reduce((total, item) => {
            return (item.templateId || item.id) === templateId
                ? total + Math.max(1, Math.floor(Number(item.quantity) || 1))
                : total;
        }, 0);
    }

    function purchaseSupplies(requests = {}, options = {}) {
        const hero = Aethra.GameState?.hero;
        if (!hero?.characterCreated) return { purchased: 0, cost: 0, items: [], reason: "CHARACTER_REQUIRED" };
        const lines = SUPPLIES.map((definition) => {
            const quantity = integer(requests?.[definition.id], 0, 99);
            const unitPrice = unitPriceFor(definition.id);
            return { itemId: definition.id, quantity, unitPrice, cost: quantity * unitPrice };
        }).filter((line) => line.quantity > 0 && line.unitPrice > 0);
        const requestedCost = lines.reduce((total, line) => total + line.cost, 0);
        const spendingLimit = options.spendingLimit === undefined
            ? Number(hero.gold) || 0
            : Math.min(Number(hero.gold) || 0, integer(options.spendingLimit));
        if (lines.length === 0) return { purchased: 0, cost: 0, items: [], reason: "EMPTY_REQUEST" };
        if (requestedCost > spendingLimit) {
            return { purchased: 0, cost: 0, requestedCost, items: [], reason: "INSUFFICIENT_BUDGET" };
        }

        let purchased = 0;
        let cost = 0;
        const items = [];
        for (const line of lines) {
            const result = Aethra.MarketplaceSystem?.buyItem?.(line.itemId, line.quantity);
            if (!result) break;
            const paid = integer(result.totalPrice, line.cost);
            purchased += line.quantity;
            cost += paid;
            items.push({ ...line, cost: paid });
        }
        if (purchased > 0) {
            Aethra.EventBus.emit("idle-loop:supplies-purchased", {
                source: options.source || "manual",
                purchased,
                cost,
                items: clone(items)
            });
            notifyChanged("supplies-purchased");
        }
        return { purchased, cost, requestedCost, items };
    }

    // Quanto a reposição automática pode gastar agora: ouro menos a reserva, até o teto por ciclo.
    function cycleBudget(config = ensureState()) {
        const spendableGold = Math.max(0, (Number(Aethra.GameState?.hero?.gold) || 0) - config.goldReserve);
        return config.maxRestockSpend > 0 ? Math.min(spendableGold, config.maxRestockSpend) : spendableGold;
    }

    function restockSupplies() {
        const config = ensureState();
        const hero = Aethra.GameState?.hero;
        if (!config.enabled || !config.autoRestock || !hero?.characterCreated) return { purchased: 0, cost: 0, items: [] };

        let remainingBudget = cycleBudget(config);
        let purchased = 0;
        let cost = 0;
        const items = [];
        const orderedSupplies = [...SUPPLIES].sort((a, b) => {
            return config.supplyPlan[a.id].priority - config.supplyPlan[b.id].priority;
        });

        orderedSupplies.forEach((definition) => {
            const rule = config.supplyPlan[definition.id];
            const current = inventoryQuantity(definition.id);
            if (!rule.enabled || current >= rule.reorderAt || rule.target <= current) return;
            const missing = rule.target - current;
            const unitPrice = unitPriceFor(definition.id);
            if (unitPrice <= 0) return;
            let quantity = Math.min(missing, Math.floor(remainingBudget / unitPrice));
            if (!config.allowPartialRestock && quantity < missing) quantity = 0;
            if (quantity <= 0) return;
            const result = Aethra.MarketplaceSystem?.buyItem?.(definition.id, quantity);
            if (!result) return;
            const paid = integer(result.totalPrice, unitPrice * quantity);
            purchased += quantity;
            cost += paid;
            remainingBudget = Math.max(0, remainingBudget - paid);
            items.push({ itemId: definition.id, quantity, unitPrice, cost: paid });
        });
        if (cost > 0) {
            config.totalRestockCost += cost;
            Aethra.EventBus.emit("idle-loop:restocked", {
                purchased,
                cost,
                items: clone(items),
                totalRestockCost: config.totalRestockCost
            });
            notifyChanged("restocked");
        }
        return { purchased, cost, items };
    }

    function processCycle(source = "idle-cycle") {
        const config = ensureState();
        if (!config.enabled) return false;
        const sale = autoSellItems(Aethra.GameState?.hero?.bag || []);
        const restock = restockSupplies();
        config.cyclesCompleted += 1;
        config.lastCycleAt = new Date().toISOString();
        const payload = {
            source,
            cycle: config.cyclesCompleted,
            sale,
            restock,
            net: sale.total - restock.cost
        };
        Aethra.EventBus.emit("idle-loop:cycle-completed", payload);
        Aethra.SaveManager?.save?.("idle-loop-cycle");
        notifyChanged("cycle-completed");
        return payload;
    }

    function updateSetting(key, value) {
        if (!["enabled", "autoSell", "autoRestock", "keepCraftingMaterials"].includes(key)) return false;
        const config = ensureState();
        config[key] = Boolean(value);
        Aethra.EventBus.emit("idle-loop:setting-changed", { key, value: config[key], config: clone(config) });
        Aethra.SaveManager?.save?.("idle-loop-setting");
        notifyChanged("setting-changed");
        return config[key];
    }

    function configureRestock(patch = {}) {
        const config = ensureState();
        if (patch.autoRestock !== undefined) config.autoRestock = Boolean(patch.autoRestock);
        if (patch.goldReserve !== undefined) config.goldReserve = integer(patch.goldReserve);
        if (patch.maxRestockSpend !== undefined) config.maxRestockSpend = integer(patch.maxRestockSpend);
        if (patch.allowPartialRestock !== undefined) config.allowPartialRestock = Boolean(patch.allowPartialRestock);
        if (patch.supplyPlan && typeof patch.supplyPlan === "object") {
            config.supplyPlan = normalizeSupplyPlan({ ...config.supplyPlan, ...patch.supplyPlan }, config);
        }
        config.healthTarget = config.supplyPlan.potion_health.target;
        config.manaTarget = config.supplyPlan.potion_mana.target;
        Aethra.EventBus.emit("idle-loop:restock-configured", clone(config));
        Aethra.SaveManager?.save?.("idle-loop-restock-config");
        notifyChanged("restock-configured");
        return clone(config);
    }

    function toggleLoop(forceState = null) {
        const config = ensureState();
        return updateSetting("enabled", forceState === null ? !config.enabled : forceState);
    }

    /*
     * Uso automático em combate: { [supplyId]: { enabled, thresholdPercent } }.
     * Traduz para a política do ConsumableSystem; a política fica ligada se
     * algum suprimento continuar com uso automático.
     */
    function configureAutoUse(patch = {}) {
        const policy = Aethra.ConsumableSystem?.ensurePolicy?.() || {};
        const policyPatch = {};
        SUPPLIES.filter((definition) => definition.policyItemKey).forEach((definition) => {
            const request = patch[definition.id];
            const currentlyEnabled = policy.enabled !== false && policy[definition.policyItemKey] === definition.id;
            const enabled = request?.enabled === undefined ? currentlyEnabled : Boolean(request.enabled);
            const currentPercent = Math.round((Number(policy[definition.policyThresholdKey]) || 0) * 100);
            const percent = Math.min(AUTO_USE_MAX_PERCENT, Math.max(AUTO_USE_MIN_PERCENT,
                integer(request?.thresholdPercent, currentPercent || 30)));
            policyPatch[definition.policyItemKey] = enabled ? definition.id : null;
            policyPatch[definition.policyThresholdKey] = percent / 100;
        });
        policyPatch.enabled = SUPPLIES.some((definition) => definition.policyItemKey && policyPatch[definition.policyItemKey] === definition.id);
        const result = Aethra.ConsumableSystem?.configure?.(policyPatch);
        notifyChanged("auto-use-configured");
        return result;
    }

    // Leitura pronta para telas: estoque, regra, preço e uso automático de cada suprimento.
    function getSupplyOverview() {
        const config = ensureState();
        const policy = Aethra.ConsumableSystem?.ensurePolicy?.() || {};
        const supplies = SUPPLIES.map((definition) => {
            const rule = config.supplyPlan[definition.id];
            const current = inventoryQuantity(definition.id);
            const stockState = !rule.enabled
                ? "manual"
                : current >= rule.target ? "ready" : current < rule.reorderAt ? "low" : "stable";
            return {
                ...clone(definition),
                current,
                unitPrice: unitPriceFor(definition.id),
                rule: clone(rule),
                stockState,
                autoUse: definition.policyItemKey
                    ? {
                        enabled: policy.enabled !== false && policy[definition.policyItemKey] === definition.id,
                        thresholdPercent: Math.round((Number(policy[definition.policyThresholdKey]) || 0) * 100)
                    }
                    : null
            };
        });
        const summary = supplies.reduce((total, supply) => {
            if (!supply.rule.enabled) return total;
            const missing = Math.max(0, supply.rule.target - supply.current);
            total.current += supply.current;
            total.target += supply.rule.target;
            total.enabled += 1;
            total.missing += missing;
            total.restockCost += missing * supply.unitPrice;
            return total;
        }, { current: 0, target: 0, enabled: 0, missing: 0, restockCost: 0 });
        summary.cycleBudget = cycleBudget(config);
        summary.restockReady = summary.restockCost <= summary.cycleBudget;
        return { config: clone(config), supplies, summary };
    }

    Aethra.EventBus.on("bag:items-added", ({ items = [], source } = {}) => {
        if (source === "character-created" || source === "npc-shop") return;
        autoSellItems(Array.isArray(items) ? items : []);
    });
    // Ao partir, repõe o que faltar (por exemplo, depois de uma derrota).
    Aethra.EventBus.on("hunt:started", () => restockSupplies());
    // Andar limpo (a expedição para na escada): vende o loot e repõe suprimentos.
    Aethra.EventBus.on("hunt:stairs-reached", () => processCycle("floor-cleared"));
    Aethra.EventBus.on("hunt:ended", ({ reason } = {}) => {
        if (reason !== "hero-defeated") processCycle(`hunt-ended:${reason || "unknown"}`);
    });
    Aethra.EventBus.on("state:restored", () => {
        ensureState();
        notifyChanged("state-restored");
    });

    Aethra.IdleLoopSystem = {
        get config() { return ensureState(); },
        supplies: SUPPLIES,
        autoUseRange: Object.freeze({ min: AUTO_USE_MIN_PERCENT, max: AUTO_USE_MAX_PERCENT }),
        toggleLoop,
        updateSetting,
        configureRestock,
        configureAutoUse,
        purchaseSupplies,
        autoSellItems,
        restockSupplies,
        processCycle,
        inventoryQuantity,
        unitPriceFor,
        isAutoSellEligible,
        isCraftingMaterial,
        getSupplyOverview,
        getSnapshot: () => clone(ensureState())
    };

    ensureState();
})(window.Aethra = window.Aethra || {});
