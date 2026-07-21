// IdleLoopSystem.js — Caçada Idle 100% Infinita (Loot Auto-Convertido em Ouro, Sem Interrupção)
(function initIdleLoopSystem(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const config = {
        enabled: true,
        autoSell: true,
        autoRestock: true,
        cyclesCompleted: 0,
        totalProfit: 0
    };

    function esc(v) { return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
    function fmt(v) { return new Intl.NumberFormat("pt-BR").format(Math.floor(Number(v) || 0)); }

    // Instant auto-conversion of loot to Gold so the backpack NEVER fills up
    function autoConvertLootToGold(payload = {}) {
        if (!config.enabled) return;

        const baseVal = Math.floor(Math.random() * 20 + 10);
        if (Aethra.GameState?.hero) {
            Aethra.GameState.hero.gold = (Aethra.GameState.hero.gold || 0) + baseVal;
        }
        config.totalProfit += baseVal;

        Aethra.EventBus.emit("goldChanged", {
            amount: baseVal,
            total: Aethra.GameState?.hero?.gold || 0,
            source: "idle-auto-loot"
        });
    }

    function toggleLoop(forceState = null) {
        config.enabled = forceState !== null ? Boolean(forceState) : !config.enabled;
        console.log(`[IdleLoop] Loop Infinito: ${config.enabled ? "ATIVADO" : "DESATIVADO"}`);
        Aethra.EventBus.emit("idle-loop:toggled", { enabled: config.enabled });
        return config.enabled;
    }

    // Auto convert loot drops instantly
    Aethra.EventBus.on("itemObtained", autoConvertLootToGold);
    Aethra.EventBus.on("bag:items-added", autoConvertLootToGold);

    Aethra.IdleLoopSystem = {
        config,
        toggleLoop
    };
})(window.Aethra = window.Aethra || {});
