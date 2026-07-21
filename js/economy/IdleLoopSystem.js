// IdleLoopSystem.js — Automação do Ciclo Idle (Caçada ➔ Retorno ➔ Venda de Loot ➔ Reabastecimento ➔ Reinício)
(function initIdleLoopSystem(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const config = {
        enabled: true,
        autoSell: true,
        autoRestock: true,
        maxBagSlots: 8,
        cyclesCompleted: 0,
        totalProfit: 0,
        isProcessingReturn: false
    };

    function esc(v) { return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
    function fmt(v) { return new Intl.NumberFormat("pt-BR").format(Math.floor(Number(v) || 0)); }

    function checkLoopConditions() {
        if (!config.enabled || config.isProcessingReturn) return;

        const bag = Aethra.GameState?.bag || {};
        const items = Array.isArray(bag.items) ? bag.items : [];

        const isBagFull = items.length >= config.maxBagSlots;
        const hero = Aethra.GameState?.hero || {};
        const isLowVitals = (hero.hp <= (hero.stats?.maxHp || 50) * 0.15);

        if (isBagFull || isLowVitals) {
            triggerAutoReturn(isBagFull ? "Mochila Cheia" : "Vida Baixa / Suprimentos Esgotados");
        }
    }

    function triggerAutoReturn(reason) {
        if (config.isProcessingReturn) return;
        config.isProcessingReturn = true;

        console.log(`[IdleLoop] Retorno automático iniciado: ${reason}`);

        const container = document.getElementById("tilemap-canvas-root") || document.body;
        const overlay = document.createElement("div");
        overlay.className = "idle-return-overlay";
        overlay.innerHTML = `
            <div class="idle-return-title">🛒 RETORNO AUTOMÁTICO À VILA</div>
            <p class="idle-return-body">Motivo: <strong>${esc(reason)}</strong><br>Executando ciclo idle de manutenção do herói...</p>
            <div class="idle-return-steps">
                <span class="idle-step-chip" id="step-sell">1. Vendendo Loot...</span>
                <span class="idle-step-chip" id="step-restock">2. Reabastecendo...</span>
                <span class="idle-step-chip" id="step-restart">3. Voltando à Hunt...</span>
            </div>
        `;
        container.appendChild(overlay);

        // Phase 1: Sell Loot
        setTimeout(() => {
            let goldEarned = 0;
            const bag = Aethra.GameState?.bag;

            if (bag && Array.isArray(bag.items)) {
                // Sell non-equipped items
                const sellableCount = bag.items.length;
                goldEarned = sellableCount * Math.floor(Math.random() * 25 + 15);
                bag.items = []; // Clear sold items
            }

            if (goldEarned > 0) {
                if (Aethra.GameState?.hero) {
                    Aethra.GameState.hero.gold = (Aethra.GameState.hero.gold || 0) + goldEarned;
                }
                config.totalProfit += goldEarned;
                Aethra.EventBus.emit("goldChanged", { amount: goldEarned, total: Aethra.GameState.hero.gold });
            }

            const stepSell = overlay.querySelector("#step-sell");
            if (stepSell) {
                stepSell.textContent = `1. Loot Vendido (+${fmt(goldEarned)} G) ✔`;
                stepSell.style.borderColor = "#50c878";
                stepSell.style.color = "#50c878";
            }
        }, 1000);

        // Phase 2: Restock & Restore Vitals
        setTimeout(() => {
            const hero = Aethra.GameState?.hero;
            if (hero && hero.stats) {
                hero.hp = hero.stats.maxHp || hero.hp || 50;
                hero.mana = hero.stats.maxMana || hero.mana || 30;
                hero.energy = hero.stats.maxEnergy || hero.energy || 80;
            }

            const stepRestock = overlay.querySelector("#step-restock");
            if (stepRestock) {
                stepRestock.textContent = "2. Poções & Vigor Restaurados ✔";
                stepRestock.style.borderColor = "#50c878";
                stepRestock.style.color = "#50c878";
            }
        }, 2200);

        // Phase 3: Restart Hunt Loop
        setTimeout(() => {
            config.cyclesCompleted++;
            config.isProcessingReturn = false;
            overlay.remove();

            Aethra.EventBus.emit("idle-loop:cycle-completed", {
                cycles: config.cyclesCompleted,
                totalProfit: config.totalProfit
            });

            // Restart 2D TileMap Canvas engine
            Aethra.TileMapCanvas?.start?.();
            Aethra.RenderEngine?.renderAll?.();
        }, 3400);
    }

    function toggleLoop(forceState = null) {
        config.enabled = forceState !== null ? Boolean(forceState) : !config.enabled;
        console.log(`[IdleLoop] Loop Infinito: ${config.enabled ? "ATIVADO" : "DESATIVADO"}`);
        Aethra.EventBus.emit("idle-loop:toggled", { enabled: config.enabled });
        return config.enabled;
    }

    function toggleAutoSell() {
        config.autoSell = !config.autoSell;
        return config.autoSell;
    }

    function toggleAutoRestock() {
        config.autoRestock = !config.autoRestock;
        return config.autoRestock;
    }

    // Auto check triggers
    Aethra.EventBus.on("itemObtained", checkLoopConditions);
    Aethra.EventBus.on("bag:items-added", checkLoopConditions);
    Aethra.EventBus.on("battle:round-processed", checkLoopConditions);

    Aethra.IdleLoopSystem = {
        config,
        toggleLoop,
        toggleAutoSell,
        toggleAutoRestock,
        triggerAutoReturn,
        checkLoopConditions
    };
})(window.Aethra = window.Aethra || {});
