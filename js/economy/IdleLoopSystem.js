// IdleLoopSystem.js — automação segura apoiada na economia e na caçada oficiais.
// Regras e estado (GameState.idleLoop): auto-venda de loot, uso automático de
// poções em combate e continuidade. Não existe reposição nem compra à
// distância (decisão do Paulo, 2026-10-01): poção acabou, o jogador volta ao
// mercador, vende algo ou fabrica.
// Não desenha nada: avisa por "idle-loop:updated" e as telas leem
// getSupplyOverview/getSnapshot.
(function initIdleLoopSystem(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const SUPPLIES = Object.freeze([
        Object.freeze({ id: "potion_health", label: "Poção de Vida", shortLabel: "Vida", icon: "✚", effect: "+20 HP", role: "Sobrevivência", craftRecipeId: "brew_health_potion", tone: "health", policyItemKey: "healthItemId", policyThresholdKey: "healthThreshold" }),
        Object.freeze({ id: "potion_mana", label: "Poção de Mana", shortLabel: "Mana", icon: "◆", effect: "+20 Mana", role: "Recurso arcano", craftRecipeId: "brew_mana_potion", tone: "mana", policyItemKey: "manaItemId", policyThresholdKey: "manaThreshold" }),
        Object.freeze({ id: "minor_vigor_tonic", label: "Tônico de Vigor", shortLabel: "Vigor", icon: "ϟ", effect: "+18 Vigor", role: "Recurso físico", craftRecipeId: "brew_vigor_tonic", tone: "vigor", policyItemKey: "energyItemId", policyThresholdKey: "energyThreshold" }),
        Object.freeze({ id: "field_antidote", label: "Antídoto de Campanha", shortLabel: "Antídoto", icon: "☤", effect: "Remove veneno", role: "Cura de condição", tone: "antidote" })
    ]);
    const DEFAULTS = Object.freeze({
        enabled: true,
        autoSell: true,
        keepEquipment: true,
        keepCraftingMaterials: true,
        cyclesCompleted: 0,
        totalProfit: 0,
        lastCycleAt: null
    });
    // Campos da antiga reposição automática; saem do save ao carregar.
    const RETIRED_FIELDS = Object.freeze([
        "autoRestock", "supplyPlan", "healthTarget", "manaTarget", "goldReserve",
        "maxRestockSpend", "allowPartialRestock", "totalRestockCost"
    ]);
    const AUTO_USE_MIN_PERCENT = 5;
    const AUTO_USE_MAX_PERCENT = 95;

    const integer = (value, fallback = 0, maximum = Number.MAX_SAFE_INTEGER) => {
        const parsed = Number(value);
        return Math.min(maximum, Math.max(0, Math.floor(Number.isFinite(parsed) ? parsed : fallback)));
    };
    const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

    function ensureState() {
        const state = Aethra.GameState || {};
        const stored = state.idleLoop && typeof state.idleLoop === "object" ? state.idleLoop : {};
        // Normaliza no mesmo objeto: quem já tem a referência (processCycle)
        // continua escrevendo no estado salvo.
        const normalized = {
            ...DEFAULTS,
            ...stored,
            enabled: stored.enabled !== false,
            autoSell: stored.autoSell !== false,
            keepEquipment: stored.keepEquipment !== false,
            keepCraftingMaterials: stored.keepCraftingMaterials !== false,
            cyclesCompleted: integer(stored.cyclesCompleted),
            totalProfit: integer(stored.totalProfit)
        };
        RETIRED_FIELDS.forEach((field) => delete normalized[field]);
        if (state.idleLoop && typeof state.idleLoop === "object") {
            RETIRED_FIELDS.forEach((field) => delete state.idleLoop[field]);
            Object.assign(state.idleLoop, normalized);
        } else {
            state.idleLoop = normalized;
        }
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

    function processCycle(source = "idle-cycle") {
        const config = ensureState();
        if (!config.enabled) return false;
        const sale = autoSellItems(Aethra.GameState?.hero?.bag || []);
        config.cyclesCompleted += 1;
        config.lastCycleAt = new Date().toISOString();
        const payload = {
            source,
            cycle: config.cyclesCompleted,
            sale,
            net: sale.total
        };
        Aethra.EventBus.emit("idle-loop:cycle-completed", payload);
        Aethra.SaveManager?.save?.("idle-loop-cycle");
        notifyChanged("cycle-completed");
        return payload;
    }

    function updateSetting(key, value) {
        if (!["enabled", "autoSell", "keepCraftingMaterials"].includes(key)) return false;
        const config = ensureState();
        config[key] = Boolean(value);
        Aethra.EventBus.emit("idle-loop:setting-changed", { key, value: config[key], config: clone(config) });
        Aethra.SaveManager?.save?.("idle-loop-setting");
        notifyChanged("setting-changed");
        return config[key];
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

    // Leitura pronta para telas: estoque, preço no mercador e uso automático de cada suprimento.
    function getSupplyOverview() {
        const config = ensureState();
        const policy = Aethra.ConsumableSystem?.ensurePolicy?.() || {};
        const supplies = SUPPLIES.map((definition) => ({
            ...clone(definition),
            current: inventoryQuantity(definition.id),
            unitPrice: unitPriceFor(definition.id),
            autoUse: definition.policyItemKey
                ? {
                    enabled: policy.enabled !== false && policy[definition.policyItemKey] === definition.id,
                    thresholdPercent: Math.round((Number(policy[definition.policyThresholdKey]) || 0) * 100)
                }
                : null
        }));
        const summary = { current: supplies.reduce((total, supply) => total + supply.current, 0) };
        return { config: clone(config), supplies, summary };
    }

    Aethra.EventBus.on("bag:items-added", ({ items = [], source } = {}) => {
        if (source === "character-created" || source === "npc-shop") return;
        autoSellItems(Array.isArray(items) ? items : []);
    });
    // Andar limpo (a expedição para na escada): vende o loot.
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
        configureAutoUse,
        autoSellItems,
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
