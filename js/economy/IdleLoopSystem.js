// IdleLoopSystem.js — suprimentos do herói e uso automático de poções em combate.
// Estilo velha guarda (decisão do Paulo, 2026-10-01): nada é comprado nem
// vendido sozinho. Poção acabou, o jogador volta ao mercador; loot fica na
// mochila até ele vender. Resta a política de uso em combate, que gasta só o
// que o herói carrega (ConsumableSystem).
// Não desenha nada: avisa por "idle-loop:updated" e as telas leem
// getSupplyOverview.
(function initIdleLoopSystem(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const SUPPLIES = Object.freeze([
        Object.freeze({ id: "potion_health", label: "Poção de Vida", shortLabel: "Vida", icon: "✚", effect: "+20 HP", role: "Sobrevivência", craftRecipeId: "brew_health_potion", tone: "health", policyItemKey: "healthItemId", policyThresholdKey: "healthThreshold" }),
        Object.freeze({ id: "potion_mana", label: "Poção de Mana", shortLabel: "Mana", icon: "◆", effect: "+20 Mana", role: "Recurso arcano", craftRecipeId: "brew_mana_potion", tone: "mana", policyItemKey: "manaItemId", policyThresholdKey: "manaThreshold" }),
        Object.freeze({ id: "minor_vigor_tonic", label: "Tônico de Vigor", shortLabel: "Vigor", icon: "ϟ", effect: "+18 Vigor", role: "Recurso físico", craftRecipeId: "brew_vigor_tonic", tone: "vigor", policyItemKey: "energyItemId", policyThresholdKey: "energyThreshold" }),
        Object.freeze({ id: "field_antidote", label: "Antídoto de Campanha", shortLabel: "Antídoto", icon: "☤", effect: "Remove veneno", role: "Cura de condição", tone: "antidote" })
    ]);
    const AUTO_USE_MIN_PERCENT = 5;
    const AUTO_USE_MAX_PERCENT = 95;

    const integer = (value, fallback = 0, maximum = Number.MAX_SAFE_INTEGER) => {
        const parsed = Number(value);
        return Math.min(maximum, Math.max(0, Math.floor(Number.isFinite(parsed) ? parsed : fallback)));
    };
    const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

    // Saves antigos guardam auto-venda, reposição e ciclos em GameState.idleLoop.
    function retireLegacyState() {
        if (!Aethra.GameState || !Object.prototype.hasOwnProperty.call(Aethra.GameState, "idleLoop")) return false;
        delete Aethra.GameState.idleLoop;
        return true;
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

    function inventoryQuantity(templateId) {
        return (Aethra.GameState?.hero?.bag || []).reduce((total, item) => {
            return (item.templateId || item.id) === templateId
                ? total + Math.max(1, Math.floor(Number(item.quantity) || 1))
                : total;
        }, 0);
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
        return { supplies, summary: { current: supplies.reduce((total, supply) => total + supply.current, 0) } };
    }

    ["save:loaded", "state:restored"].forEach((eventName) => {
        Aethra.EventBus.on(eventName, () => {
            retireLegacyState();
            notifyChanged(eventName);
        });
    });

    Aethra.IdleLoopSystem = {
        supplies: SUPPLIES,
        autoUseRange: Object.freeze({ min: AUTO_USE_MIN_PERCENT, max: AUTO_USE_MAX_PERCENT }),
        configureAutoUse,
        inventoryQuantity,
        unitPriceFor,
        getSupplyOverview,
        retireLegacyState
    };

    retireLegacyState();
})(window.Aethra = window.Aethra || {});
