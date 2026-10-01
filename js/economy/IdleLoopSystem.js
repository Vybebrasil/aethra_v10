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
        Object.freeze({ id: "potion_health", label: "Poção de Vida", pluralLabel: "Poções de Vida", shortLabel: "Vida", icon: "✚", effect: "+20 HP", role: "Sobrevivência", craftRecipeId: "brew_health_potion", tone: "health", policyItemKey: "healthItemId", policyThresholdKey: "healthThreshold" }),
        Object.freeze({ id: "potion_health_strong", label: "Poção de Vida Forte", pluralLabel: "Poções de Vida Fortes", shortLabel: "Vida", icon: "✚", effect: "+50 HP", role: "Sobrevivência", craftRecipeId: "brew_health_potion_strong", tone: "health", policyItemKey: "healthItemId", policyThresholdKey: "healthThreshold" }),
        Object.freeze({ id: "potion_health_great", label: "Poção de Vida Grande", pluralLabel: "Poções de Vida Grandes", shortLabel: "Vida", icon: "✚", effect: "+110 HP", role: "Sobrevivência", craftRecipeId: "brew_health_potion_great", tone: "health", policyItemKey: "healthItemId", policyThresholdKey: "healthThreshold" }),
        Object.freeze({ id: "potion_mana", label: "Poção de Mana", pluralLabel: "Poções de Mana", shortLabel: "Mana", icon: "◆", effect: "+20 Mana", role: "Recurso arcano", craftRecipeId: "brew_mana_potion", tone: "mana", policyItemKey: "manaItemId", policyThresholdKey: "manaThreshold" }),
        Object.freeze({ id: "potion_mana_strong", label: "Poção de Mana Forte", pluralLabel: "Poções de Mana Fortes", shortLabel: "Mana", icon: "◆", effect: "+50 Mana", role: "Recurso arcano", craftRecipeId: "brew_mana_potion_strong", tone: "mana", policyItemKey: "manaItemId", policyThresholdKey: "manaThreshold" }),
        Object.freeze({ id: "potion_mana_great", label: "Poção de Mana Grande", pluralLabel: "Poções de Mana Grandes", shortLabel: "Mana", icon: "◆", effect: "+110 Mana", role: "Recurso arcano", craftRecipeId: "brew_mana_potion_great", tone: "mana", policyItemKey: "manaItemId", policyThresholdKey: "manaThreshold" }),
        Object.freeze({ id: "minor_vigor_tonic", label: "Tônico de Vigor", pluralLabel: "Tônicos de Vigor", shortLabel: "Vigor", icon: "ϟ", effect: "+18 Vigor", role: "Recurso físico", craftRecipeId: "brew_vigor_tonic", tone: "vigor", policyItemKey: "energyItemId", policyThresholdKey: "energyThreshold" }),
        Object.freeze({ id: "vigor_tonic_concentrated", label: "Tônico de Vigor Concentrado", pluralLabel: "Tônicos de Vigor Concentrados", shortLabel: "Vigor", icon: "ϟ", effect: "+45 Vigor", role: "Recurso físico", craftRecipeId: "brew_vigor_tonic_concentrated", tone: "vigor", policyItemKey: "energyItemId", policyThresholdKey: "energyThreshold" }),
        Object.freeze({ id: "field_antidote", label: "Antídoto de Campanha", pluralLabel: "Antídotos de Campanha", shortLabel: "Antídoto", icon: "☤", effect: "Remove veneno", role: "Cura de condição", tone: "antidote" })
    ]);
    const LOW_STOCK = 2;
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
     * Cada família (Vida, Mana, Vigor) usa UMA poção escolhida: ligar uma
     * desliga as outras da família; o limite é da família. Traduz para a
     * política do ConsumableSystem, ligada se alguma família tiver escolha.
     */
    function configureAutoUse(patch = {}) {
        const policy = Aethra.ConsumableSystem?.ensurePolicy?.() || {};
        const policyPatch = {};
        const keys = [...new Set(SUPPLIES.map((definition) => definition.policyItemKey).filter(Boolean))];
        keys.forEach((itemKey) => {
            const members = SUPPLIES.filter((definition) => definition.policyItemKey === itemKey);
            const thresholdKey = members[0].policyThresholdKey;
            let chosen = policy.enabled !== false ? policy[itemKey] || null : null;
            members.forEach((definition) => {
                const request = patch[definition.id];
                if (request?.enabled === true) chosen = definition.id;
                if (request?.enabled === false && chosen === definition.id) chosen = null;
            });
            const requestedPercent = members.map((definition) => patch[definition.id]?.thresholdPercent).find((value) => value !== undefined);
            const currentPercent = Math.round((Number(policy[thresholdKey]) || 0) * 100);
            const percent = Math.min(AUTO_USE_MAX_PERCENT, Math.max(AUTO_USE_MIN_PERCENT,
                integer(requestedPercent, currentPercent || 30)));
            policyPatch[itemKey] = chosen;
            policyPatch[thresholdKey] = percent / 100;
        });
        policyPatch.enabled = keys.some((itemKey) => Boolean(policyPatch[itemKey]));
        const result = Aethra.ConsumableSystem?.configure?.(policyPatch);
        notifyChanged("auto-use-configured");
        return result;
    }

    // Leitura pronta para telas: estoque, nível, se o mercador vende e uso automático de cada suprimento.
    function getSupplyOverview() {
        const policy = Aethra.ConsumableSystem?.ensurePolicy?.() || {};
        const heroLevel = Math.max(1, integer(Aethra.GameState?.hero?.level, 1));
        const merchantIds = new Set((Aethra.MarketplaceSystem?.getNpcCatalog?.(heroLevel) || []).map((item) => item.id || item.templateId));
        const supplies = SUPPLIES.map((definition) => ({
            ...clone(definition),
            current: inventoryQuantity(definition.id),
            unitPrice: unitPriceFor(definition.id),
            levelReq: Math.max(1, integer(templateFor(definition.id)?.levelReq, 1)),
            soldByMerchant: merchantIds.has(definition.id),
            autoUse: definition.policyItemKey
                ? {
                    enabled: policy.enabled !== false && policy[definition.policyItemKey] === definition.id,
                    thresholdPercent: Math.round((Number(policy[definition.policyThresholdKey]) || 0) * 100)
                }
                : null
        }));
        return { supplies, summary: { current: supplies.reduce((total, supply) => total + supply.current, 0) } };
    }

    /*
     * Sem reposição, o jogador precisa saber quando o estoque acaba: avisa no
     * registro com 2, 1 e 0 unidades depois de cada uso.
     */
    function warnLowStock(payload = {}) {
        const supply = SUPPLIES.find((definition) => definition.id === payload.itemId);
        if (!supply) return null;
        const left = inventoryQuantity(supply.id);
        if (left > LOW_STOCK) return null;
        const message = left === 0
            ? `Acabaram as ${supply.pluralLabel}. Volte à cidade para comprar ou fabrique na Alquimia.`
            : `${left === 1 ? "Resta" : "Restam"} ${left} ${left === 1 ? supply.label : supply.pluralLabel}.`;
        Aethra.EventBus.emit("BattleLog", { message, color: left === 0 ? "#ff7a6a" : "#ffb36a", type: "system" });
        Aethra.EventBus.emit("supplies:low", { itemId: supply.id, left });
        return { itemId: supply.id, left, message };
    }
    Aethra.EventBus.on("consumable:used", warnLowStock);

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
