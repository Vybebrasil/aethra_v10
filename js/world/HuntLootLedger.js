// HuntLootLedger.js — registro do loot da expedição atual, sem tela.
// Junta drops de criaturas, recursos e eventos de exploração em pilhas
// (materiais, ouro) e itens especiais (equipamentos e rolagens individuais).
// Zera a cada hunt:started; guarda em GameState.ui.lootSession (formato
// mantido para saves existentes) e avisa por "hunt:loot-ledger-updated".
(function initHuntLootLedger(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;
    if (Aethra.HuntLootLedger) return;

    const MAX_SPECIALS = 100;
    const VIEW_DEFAULTS = Object.freeze({ activeTab: "stackables", specialFilter: "all", sortMode: "value" });
    const EQUIPMENT_TYPES = Object.freeze(["weapon", "armor", "equipment", "equip", "helmet", "chest", "legs", "boots", "shield", "accessory"]);
    const RARITY_RANK = Object.freeze({ common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 });
    const STAT_LABELS = Object.freeze({
        damageMin: "Dano mínimo",
        damageMax: "Dano máximo",
        defense: "Defesa",
        str: "Força",
        mag: "Magia",
        precision: "Precisão",
        critical: "Crítico",
        evasion: "Esquiva",
        blockChance: "Bloqueio",
        blockReduction: "Redução de bloqueio",
        hpMax: "Vida máxima",
        manaMax: "Mana máxima"
    });

    const formatNumber = (value) => new Intl.NumberFormat("pt-BR").format(Number(value || 0));

    function ensureState() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        const current = Aethra.GameState.ui.lootSession || {};
        current.stackables = current.stackables && typeof current.stackables === "object" ? current.stackables : {};
        current.specials = Array.isArray(current.specials) ? current.specials : [];
        current.seenSpecialIds = current.seenSpecialIds && typeof current.seenSpecialIds === "object" ? current.seenSpecialIds : {};
        current.activeTab = ["stackables", "specials"].includes(current.activeTab) ? current.activeTab : VIEW_DEFAULTS.activeTab;
        current.specialFilter = ["all", "equipment", "rare"].includes(current.specialFilter) ? current.specialFilter : VIEW_DEFAULTS.specialFilter;
        current.sortMode = ["value", "quantity", "recent"].includes(current.sortMode) ? current.sortMode : VIEW_DEFAULTS.sortMode;
        Aethra.GameState.ui.lootSession = current;
        return current;
    }

    function changed(reason) {
        Aethra.EventBus.emit("hunt:loot-ledger-updated", { reason });
    }

    function reset() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.lootSession = { stackables: {}, specials: [], seenSpecialIds: {}, ...VIEW_DEFAULTS };
        // Formato antigo, para não reaparecer depois de carregar um save legado.
        Aethra.GameState.ui.dropLog = [];
        changed("reset");
    }

    function normalizeKey(value) {
        return String(value || "loot")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "") || "loot";
    }

    function itemTemplate(item = {}) {
        const id = item.templateId || item.id;
        return id && Aethra.GameData?.items?.[id]
            ? Aethra.GameData.items[id]
            : (id && Aethra.ItemTemplates?.[id] ? Aethra.ItemTemplates[id] : {});
    }

    function itemType(item = {}) {
        const template = itemTemplate(item);
        return String(item.itemType || item.type || template.itemType || template.type || "misc").toLowerCase();
    }

    function itemSlot(item = {}) {
        const template = itemTemplate(item);
        return item.slot || item.equipmentSlot || template.slot || template.equipmentSlot || null;
    }

    function unitValue(item = {}) {
        return Math.max(0, Number(item.price ?? item.value ?? item.basePrice ?? itemTemplate(item).price ?? 0));
    }

    function isEquipmentLike(item = {}) {
        return Boolean(itemSlot(item) || EQUIPMENT_TYPES.includes(itemType(item)));
    }

    function hasIndividualRolls(item = {}) {
        if (item.iv || item.rollScore !== undefined) return true;
        if (Number(item.statMultiplier ?? item.multiplier ?? 1) !== 1) return true;
        if (Object.keys(item.baseRolls || {}).length) return true;
        if (Object.keys(item.individualMultipliers || {}).length) return true;
        return Array.isArray(item.affixes) && item.affixes.length > 0;
    }

    // Especial: peça única (equipamento ou rolagem individual); o resto empilha.
    function isSpecialDrop(item = {}) {
        if (item.stackable === true || itemTemplate(item).stackable === true) return false;
        return isEquipmentLike(item) || hasIndividualRolls(item);
    }

    function presentation(item = {}) {
        const rarity = Aethra.GameData?.getRarityPresentation?.(item) || {};
        return {
            image: Aethra.GameData?.getItemImage?.(item) || "",
            color: rarity.color || "#9cb0b8",
            tone: String(rarity.id || item.rarityId || item.rarity || "common").toLowerCase(),
            name: item.name || item.templateId || item.id || "Item"
        };
    }

    function createSpecialEntry(item = {}, context = {}) {
        const view = presentation(item);
        const inspection = Aethra.ItemSystem?.getItemInspection?.(item) || null;
        const strongest = inspection?.strongestAttribute || null;
        const instanceId = item.instanceId || `special_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const rarityId = inspection?.rarity?.id || view.tone || "common";
        const primaryStat = strongest
            ? `${strongest.final >= 0 ? "+" : ""}${formatNumber(strongest.final)} ${STAT_LABELS[strongest.stat] || String(strongest.stat || "Atributo")}`
            : (itemSlot(item) ? `Slot: ${String(itemSlot(item)).replaceAll("_", " ")}` : "Roll individualizado");
        return {
            id: instanceId,
            instanceId,
            createdAt: Date.now(),
            image: view.image,
            icon: item.icon || "◆",
            color: inspection?.rarity?.color || view.color,
            tone: rarityId,
            rarityId,
            rarityName: inspection?.rarity?.name || item.rarity || "Comum",
            rarityRank: RARITY_RANK[String(rarityId).toLowerCase()] || 1,
            name: view.name,
            category: isEquipmentLike(item) ? "equipment" : "unique",
            ivPercent: Number(inspection?.ivPercent ?? item.iv?.percent ?? item.rollScore ?? item.quality ?? 0),
            ivTier: inspection?.tier || item.iv?.tier || "Roll",
            multiplier: Number(inspection?.multiplier ?? item.statMultiplier ?? item.multiplier ?? 1),
            primaryStat,
            value: unitValue(item),
            source: context.source || item.origin?.source || "drop",
            enemyName: context.enemyName || "",
            detail: context.detail || "",
            item: {
                instanceId: item.instanceId,
                templateId: item.templateId || item.id,
                slot: itemSlot(item),
                stats: item.stats || {},
                affixes: item.affixes || []
            }
        };
    }

    function registerSpecial(item = {}, context = {}) {
        const state = ensureState();
        const entry = createSpecialEntry(item, context);
        if (state.seenSpecialIds[entry.instanceId]) return false;
        state.seenSpecialIds[entry.instanceId] = true;
        state.specials.unshift(entry);
        state.specials = state.specials.slice(0, MAX_SPECIALS);
        changed("special");
        return true;
    }

    function registerStackable(item = {}, context = {}) {
        const state = ensureState();
        const view = presentation(item);
        const quantity = Math.max(1, Number(context.quantity ?? item.quantity ?? 1));
        const value = Math.max(0, Number(context.unitValue ?? unitValue(item)));
        const key = context.key || `item:${normalizeKey(item.templateId || item.id || view.name)}`;
        const current = state.stackables[key] || {
            key,
            image: view.image,
            icon: item.icon || context.icon || "◆",
            color: context.color || view.color,
            tone: context.tone || view.tone,
            category: context.category || itemType(item) || "loot",
            name: context.name || view.name,
            quantity: 0,
            totalValue: 0,
            dropCount: 0,
            firstDropAt: Date.now(),
            lastDropAt: Date.now(),
            lastSource: ""
        };
        current.quantity += quantity;
        current.totalValue += Math.max(0, Number(context.totalValue ?? value * quantity));
        current.dropCount += 1;
        current.lastDropAt = Date.now();
        current.lastSource = context.source || "drop";
        current.image = current.image || view.image;
        state.stackables[key] = current;
        changed("stackable");
        return current;
    }

    function registerGold(amount, context = {}) {
        const quantity = Math.max(0, Number(amount || 0));
        if (!quantity) return false;
        return registerStackable({
            id: "gold",
            templateId: "gold",
            name: "Gold",
            icon: "●",
            rarity: "Comum",
            stackable: true,
            price: 1,
            quantity
        }, {
            key: "currency:gold",
            name: "Gold",
            category: "moeda",
            icon: "●",
            color: "#e8c76d",
            tone: "gold",
            quantity,
            unitValue: 1,
            source: context.source || "hunt"
        });
    }

    function registerItem(item = {}, special = {}, stack = {}) {
        if (isSpecialDrop(item)) return registerSpecial(item, special);
        return registerStackable(item, {
            category: itemType(item) || "resource",
            quantity: Number(item.quantity || 1),
            unitValue: unitValue(item),
            ...stack
        });
    }

    function totals(state = ensureState()) {
        const stackables = Object.values(state.stackables || {});
        const specials = state.specials || [];
        const stackValue = stackables.reduce((sum, entry) => sum + Number(entry.totalValue || 0), 0);
        const specialValue = specials.reduce((sum, entry) => sum + Number(entry.value || 0), 0);
        return {
            stackTypes: stackables.length,
            totalUnits: stackables.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0),
            stackValue,
            specialValue,
            sessionValue: stackValue + specialValue,
            specialCount: specials.length,
            bestIV: specials.reduce((best, entry) => Math.max(best, Number(entry.ivPercent || 0)), 0)
        };
    }

    Aethra.EventBus.on("hunt:started", reset);

    Aethra.EventBus.on("hunt:loot-generated", (payload = {}) => {
        const enemyName = Aethra.GameData?.creatures?.[payload.enemyId]?.name || payload.enemyId || "Criatura";
        (payload.items || []).forEach((item) => registerItem(
            item,
            { source: "creature", enemyName, detail: `Drop de ${enemyName}` },
            { source: `drop:${enemyName}`, category: itemType(item) }
        ));
    });

    Aethra.EventBus.on("hunt:enemy-defeated", (payload = {}) => {
        registerGold(payload.gold, { source: payload.name || payload.enemy?.name || "criatura" });
    });

    Aethra.EventBus.on("exploration:resource-collected", (payload = {}) => {
        const item = payload.item || {};
        if (!item.name && !item.templateId && !item.id) return;
        registerItem(
            item,
            { source: payload.source || "exploration", detail: payload.title || "Recurso individual encontrado" },
            { source: payload.title || payload.source || "exploration" }
        );
    });

    Aethra.EventBus.on("exploration:event-resolved", (event = {}) => {
        (event.rewards?.items || []).forEach((item) => registerItem(
            item,
            { source: `event:${event.id || "exploration"}`, detail: event.title || "Evento de exploração" },
            { source: event.title || "evento de exploração" }
        ));
        registerGold(event.rewards?.gold, { source: event.title || "evento de exploração" });
    });

    Aethra.EventBus.on("exploration:rare-encounter-resolved", (event = {}) => {
        const source = `encontro raro: ${event.enemyName || "expedição"}`;
        (event.rewards?.items || []).forEach((item) => registerItem(
            item,
            {
                source: "encontro-raro",
                enemyName: event.enemyName || "",
                detail: event.specialItem
                    ? `Jackpot encontrado após ${event.enemyName || "uma criatura"}`
                    : "Item individual de encontro raro"
            },
            { source, color: "#9f7aea", tone: "rare" }
        ));
        registerGold(event.rewards?.gold, { source });
    });

    Aethra.HuntLootLedger = {
        ensureState,
        reset,
        isSpecialDrop,
        registerSpecial,
        registerStackable,
        registerGold,
        totals,
        getSession: () => JSON.parse(JSON.stringify(ensureState()))
    };
})(window.Aethra = window.Aethra || {});
