// IdleLoopSystem.js — automação segura apoiada na economia e na caçada oficiais.
(function initIdleLoopSystem(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const DEFAULTS = Object.freeze({
        enabled: true,
        autoSell: true,
        autoRestock: true,
        keepEquipment: true,
        healthTarget: 5,
        manaTarget: 5,
        cyclesCompleted: 0,
        totalProfit: 0,
        totalRestockCost: 0,
        lastCycleAt: null
    });
    const esc = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    const fmt = (value) => new Intl.NumberFormat("pt-BR").format(Math.floor(Number(value) || 0));

    function ensureState() {
        const state = Aethra.GameState || {};
        const stored = state.idleLoop && typeof state.idleLoop === "object" ? state.idleLoop : {};
        state.idleLoop = {
            ...DEFAULTS,
            ...stored,
            cyclesCompleted: Math.max(0, Math.floor(Number(stored.cyclesCompleted) || 0)),
            totalProfit: Math.max(0, Math.floor(Number(stored.totalProfit) || 0)),
            totalRestockCost: Math.max(0, Math.floor(Number(stored.totalRestockCost) || 0))
        };
        return state.idleLoop;
    }

    function originOf(item = {}) {
        return item.market?.purchaseOrigin || item.origin?.source || item.source || "unknown";
    }

    function isAutoSellEligible(item = {}) {
        const config = ensureState();
        const type = String(item.type || item.itemType || "").toLowerCase();
        const origin = originOf(item);
        if (item.ownership?.bound || origin === "character-created" || origin === "npc-shop") return false;
        if (config.keepEquipment && item.slot) return false;
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
        }
        renderControls();
        return { sold, total };
    }

    function inventoryQuantity(templateId) {
        return (Aethra.GameState?.hero?.bag || []).reduce((total, item) => {
            return (item.templateId || item.id) === templateId
                ? total + Math.max(1, Math.floor(Number(item.quantity) || 1))
                : total;
        }, 0);
    }

    function restockSupplies() {
        const config = ensureState();
        const hero = Aethra.GameState?.hero;
        if (!config.enabled || !config.autoRestock || !hero?.characterCreated) return { purchased: 0, cost: 0 };
        const targets = [
            ["potion_health", Math.max(0, Math.floor(Number(config.healthTarget) || 0))],
            ["potion_mana", Math.max(0, Math.floor(Number(config.manaTarget) || 0))]
        ];
        let purchased = 0;
        let cost = 0;
        targets.forEach(([itemId, target]) => {
            const missing = Math.max(0, target - inventoryQuantity(itemId));
            const item = Aethra.GameData?.getItem?.(itemId) || Aethra.GameData?.items?.[itemId];
            const unitPrice = Math.max(0, Math.floor(Number(item?.price || item?.value) || 0));
            const affordable = unitPrice > 0 ? Math.min(missing, Math.floor((Number(hero.gold) || 0) / unitPrice)) : 0;
            if (affordable <= 0) return;
            const result = Aethra.MarketplaceSystem?.buyItem?.(itemId, affordable);
            if (!result) return;
            purchased += affordable;
            cost += Number(result.totalPrice || unitPrice * affordable);
        });
        if (cost > 0) {
            config.totalRestockCost += cost;
            Aethra.EventBus.emit("idle-loop:restocked", { purchased, cost, totalRestockCost: config.totalRestockCost });
        }
        renderControls();
        return { purchased, cost };
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
        renderControls();
        return payload;
    }

    function updateSetting(key, value) {
        if (!["enabled", "autoSell", "autoRestock"].includes(key)) return false;
        const config = ensureState();
        config[key] = Boolean(value);
        Aethra.EventBus.emit("idle-loop:setting-changed", { key, value: config[key], config: { ...config } });
        Aethra.SaveManager?.save?.("idle-loop-setting");
        renderControls();
        return config[key];
    }

    function toggleLoop(forceState = null) {
        const config = ensureState();
        return updateSetting("enabled", forceState === null ? !config.enabled : forceState);
    }

    function renderControls() {
        const root = document.getElementById("idle-loop-controls-root");
        if (!root) return false;
        const config = ensureState();
        root.innerHTML = `
            <div class="idle-loop-bar">
                <div class="idle-loop-status">
                    <span class="idle-loop-indicator ${config.enabled ? "" : "is-inactive"}">${config.enabled ? "● Continuidade ativa" : "○ Automação pausada"}</span>
                    <div class="idle-loop-telemetry"><span>Ciclos <strong>${fmt(config.cyclesCompleted)}</strong></span>
                        <span>Auto-venda <strong>+${fmt(config.totalProfit)} G</strong></span>
                        <span>Reposição <strong>−${fmt(config.totalRestockCost)} G</strong></span></div>
                </div>
                <div class="idle-loop-controls">
                    <button type="button" class="idle-toggle-btn ${config.autoSell ? "is-active" : ""}" data-idle-setting="autoSell"
                        title="Vende automaticamente apenas materiais e loot; equipamentos são preservados.">Loot ${config.autoSell ? "ON" : "OFF"}</button>
                    <button type="button" class="idle-toggle-btn ${config.autoRestock ? "is-active" : ""}" data-idle-setting="autoRestock"
                        title="Repõe poções de vida e mana até o estoque mínimo, se houver ouro.">Supplies ${config.autoRestock ? "ON" : "OFF"}</button>
                    <button type="button" class="idle-toggle-btn ${config.enabled ? "is-active" : ""}" data-idle-setting="enabled">${config.enabled ? "Pausar" : "Ativar"}</button>
                </div>
            </div>`;
        return true;
    }

    Aethra.EventBus.on("bag:items-added", ({ items = [], source } = {}) => {
        if (source === "character-created" || source === "npc-shop") return;
        autoSellItems(Array.isArray(items) ? items : []);
    });
    Aethra.EventBus.on("tilemap:floor-cleared", () => processCycle("floor-cleared"));
    Aethra.EventBus.on("hunt:ended", ({ reason } = {}) => {
        if (reason !== "hero-defeated") processCycle(`hunt-ended:${reason || "unknown"}`);
    });
    Aethra.EventBus.on("tilemap:ready", renderControls);
    Aethra.EventBus.on("state:restored", () => {
        ensureState();
        renderControls();
    });

    document.addEventListener("click", (event) => {
        const button = event.target.closest("#idle-loop-controls-root [data-idle-setting]");
        if (!button) return;
        const key = button.dataset.idleSetting;
        const config = ensureState();
        updateSetting(key, !config[key]);
    });

    Aethra.IdleLoopSystem = {
        get config() { return ensureState(); },
        toggleLoop,
        updateSetting,
        autoSellItems,
        restockSupplies,
        processCycle,
        renderControls,
        isAutoSellEligible,
        getSnapshot: () => ({ ...ensureState() })
    };

    ensureState();
})(window.Aethra = window.Aethra || {});
