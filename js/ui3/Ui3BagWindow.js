/*
 * Ui3BagWindow.js — Mochila e Equipamento da UI 3.0 (fase 3).
 *
 * Assume a janela "inventory-view" pelo Ui3Window/WindowManager.
 *   leitura   hero.bag, EquipSystem.getEquipment, hero.stats, GameData
 *   comandos  EquipSystem.equip/unequip, ConsumableSystem.use
 * Vender continua na Loja, como na interface clássica: a mochila só mostra
 * o valor base do item.
 */
(function initUi3BagWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "inventory-view";
    const DEFAULT_CAPACITY = 40;
    const NOTICE_MS = 4000;
    const LEFT_SLOTS = Object.freeze([
        ["head", "Capacete"],
        ["neck", "Amuleto"],
        ["chest", "Peitoral"],
        ["hands", "Luvas"],
        ["ring1", "Anel 1"],
        ["relic", "Relíquia"]
    ]);
    const RIGHT_SLOTS = Object.freeze([
        ["weapon", "Arma"],
        ["offhand", "Mão secundária"],
        ["legs", "Calça"],
        ["feet", "Botas"],
        ["ring2", "Anel 2"]
    ]);
    const SLOT_LABELS = Object.freeze(Object.fromEntries([...LEFT_SLOTS, ...RIGHT_SLOTS]));
    const FILTERS = Object.freeze([
        { id: "all", label: "Tudo" },
        { id: "equipment", label: "Equipamento" },
        { id: "consumable", label: "Consumíveis" },
        { id: "material", label: "Materiais" },
        { id: "tool", label: "Ferramentas" }
    ]);
    const SORTS = Object.freeze([
        { id: "rarity", label: "Raridade" },
        { id: "value", label: "Valor" },
        { id: "recent", label: "Recentes" },
        { id: "name", label: "Nome" }
    ]);
    const EQUIP_ERRORS = Object.freeze({
        LEVEL_REQUIREMENT_NOT_MET: "Nível insuficiente",
        ITEM_TYPE_SLOT_MISMATCH: "Não cabe neste espaço",
        INVALID_EQUIPMENT_SLOT: "Espaço inválido",
        ITEM_NOT_IN_BAG: "O item não está na mochila",
        ITEM_NOT_FOUND: "Item não encontrado"
    });
    const USE_ERRORS = Object.freeze({
        NO_EFFECT_NEEDED: "Recursos já estão cheios",
        LEVEL_TOO_LOW: "Seu herói ainda não tem nível para esta poção",
        ITEM_NOT_CONSUMABLE: "Este item não é consumível",
        ITEM_NOT_FOUND: "Item não encontrado"
    });

    const state = {
        filter: "all",
        fitsSlot: null,
        sort: "rarity",
        query: "",
        selected: null,
        notice: null
    };
    const rendered = new WeakMap();
    let parts = {};
    let noticeTimer = null;

    function kit() {
        return Aethra.Ui3Kit;
    }

    function patch(element, html) {
        if (!element || rendered.get(element) === html) return false;
        element.innerHTML = html;
        rendered.set(element, html);
        return true;
    }

    function number(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    /* ---------------------------------------------------------------
       Leitura
       --------------------------------------------------------------- */

    function hero() {
        return Aethra.GameState?.hero || {};
    }

    function bagItems() {
        const bag = hero().bag;
        return Array.isArray(bag) ? bag.filter(Boolean) : [];
    }

    function equipment() {
        return Aethra.EquipSystem?.getEquipment?.() || Aethra.GameState?.playerEquipment || hero().equipment || {};
    }

    function itemKey(item, index) {
        return item?.instanceId || `index:${index}`;
    }

    // Apresentação de item compartilhada com a Loja (Ui3Items).
    function shared() {
        return Aethra.Ui3Items;
    }

    function typeOf(item) {
        return shared().typeOf(item);
    }

    function isEquipable(item) {
        return shared().isEquipable(item);
    }

    function categoryOf(item) {
        if (isEquipable(item)) return "equipment";
        const type = typeOf(item);
        if (type === "CONSUMABLE") return "consumable";
        if (type === "TOOL") return "tool";
        return "material";
    }

    function rarityOf(item) {
        return shared().rarityOf(item);
    }

    function imageOf(item) {
        return shared().imageOf(item);
    }

    function nameOf(item) {
        return shared().nameOf(item);
    }

    function glyphOf(item) {
        return shared().glyphOf(item);
    }

    function unitValue(item) {
        return shared().unitValue(item);
    }

    function quantityOf(item) {
        return shared().quantityOf(item);
    }

    function selectedEntry() {
        const selected = state.selected;
        if (!selected) return null;
        if (selected.kind === "slot") {
            const item = equipment()[selected.id];
            return item ? { kind: "slot", slot: selected.id, item } : null;
        }
        const items = bagItems();
        const index = items.findIndex((item, position) => itemKey(item, position) === selected.id);
        return index >= 0 ? { kind: "bag", key: selected.id, item: items[index] } : null;
    }

    /* ---------------------------------------------------------------
       Renderização
       --------------------------------------------------------------- */

    function equipSlotHTML([slot, label], equipped) {
        const K = kit();
        const item = equipped[slot] || null;
        const selected = state.selected?.kind === "slot" && state.selected.id === slot;
        if (!item) {
            const fits = state.fitsSlot === slot;
            return K.slot({
                empty: true,
                caption: label,
                selected: fits,
                label: `${label}: vazio. Mostrar itens da mochila que cabem aqui.`,
                attributes: { "data-ui3-equip-slot": slot, title: label }
            });
        }
        return K.slot({
            icon: imageOf(item),
            glyph: glyphOf(item),
            rarity: rarityOf(item).id,
            selected,
            label: `${label}: ${nameOf(item)}`,
            attributes: { "data-ui3-equip-slot": slot, title: `${label} · ${nameOf(item)}` }
        });
    }

    function heroStatsHTML() {
        const K = kit();
        const stats = hero().stats || {};
        const entries = [
            ["Ataque", `${K.formatNumber(stats.damageMin)}–${K.formatNumber(stats.damageMax)}`],
            ["Defesa", K.formatStat("defense", stats.defense)],
            ["Bloqueio", K.formatStat("blockChance", stats.blockChance)],
            ["Crítico", K.formatStat("critical", stats.critical)],
            ["Esquiva", K.formatStat("evasion", stats.evasion)],
            ["Precisão", K.formatStat("precision", stats.precision)]
        ];
        return entries.map(([label, value]) => `<div class="ui3-stat"><span class="ui3-eyebrow">${K.esc(label)}</span><strong>${K.esc(value)}</strong></div>`).join("");
    }

    function equipColumnHTML() {
        const K = kit();
        const equipped = equipment();
        const count = Object.keys(SLOT_LABELS).filter((slot) => equipped[slot]).length;
        const portrait = Aethra.SpriteLoader?.getHeroSource?.(hero().archetypeId) || "";
        return `<span class="ui3-eyebrow">Equipado · ${count} de ${Object.keys(SLOT_LABELS).length}</span>
            <div class="ui3-paperdoll">
                <div class="ui3-paperdoll__column">${LEFT_SLOTS.map((entry) => equipSlotHTML(entry, equipped)).join("")}</div>
                <div class="ui3-paperdoll__figure">
                    ${portrait ? `<img src="${K.esc(portrait)}" alt="${K.esc(hero().name || "Herói")} equipado" draggable="false">` : ""}
                    <span class="ui3-paperdoll__shadow" aria-hidden="true"></span>
                </div>
                <div class="ui3-paperdoll__column">${RIGHT_SLOTS.map((entry) => equipSlotHTML(entry, equipped)).join("")}</div>
            </div>
            <div class="ui3-stat-grid">${heroStatsHTML()}</div>`;
    }

    function matchesFilters(item) {
        if (state.fitsSlot) {
            if (!Aethra.EquipSystem?.canEquip?.(item, state.fitsSlot)) return false;
        } else if (state.filter !== "all" && categoryOf(item) !== state.filter) {
            return false;
        }
        const query = state.query.trim().toLowerCase();
        return !query || nameOf(item).toLowerCase().includes(query);
    }

    function sortedEntries() {
        const entries = bagItems().map((item, index) => ({ item, index, key: itemKey(item, index) }));
        const byName = (left, right) => nameOf(left.item).localeCompare(nameOf(right.item), "pt-BR");
        const comparators = {
            rarity: (left, right) => (shared().rarityRank(right.item) - shared().rarityRank(left.item)) || byName(left, right),
            value: (left, right) => (unitValue(right.item) * quantityOf(right.item) - unitValue(left.item) * quantityOf(left.item)) || byName(left, right),
            recent: (left, right) => right.index - left.index,
            name: byName
        };
        return entries.sort(comparators[state.sort] || comparators.rarity);
    }

    function chipsHTML() {
        const K = kit();
        const items = bagItems();
        if (state.fitsSlot) {
            return K.chip({
                label: `Cabem em ${SLOT_LABELS[state.fitsSlot] || state.fitsSlot} ✕`,
                pressed: true,
                attributes: { "data-ui3-clear-slot-filter": "", "aria-label": `Remover filtro: cabem em ${SLOT_LABELS[state.fitsSlot] || state.fitsSlot}` }
            });
        }
        return FILTERS.map((filter) => {
            const count = filter.id === "all" ? items.length : items.filter((item) => categoryOf(item) === filter.id).length;
            return K.chip({ label: `${filter.label} ${count}`, pressed: state.filter === filter.id, attributes: { "data-ui3-filter": filter.id } });
        }).join("");
    }

    function gridHTML() {
        const K = kit();
        const entries = sortedEntries().filter((entry) => matchesFilters(entry.item));
        const filtering = state.fitsSlot || state.filter !== "all" || state.query.trim();
        if (!entries.length) {
            return `<p class="ui3-empty ui3-bag__empty">${filtering ? "Nenhum item com este filtro." : "A mochila está vazia."}</p>`;
        }
        const cells = entries.map(({ item, key }) => {
            const rarity = rarityOf(item);
            const quantity = quantityOf(item);
            const selected = state.selected?.kind === "bag" && state.selected.id === key;
            return K.slot({
                icon: imageOf(item),
                glyph: glyphOf(item),
                rarity: rarity.id,
                quantity,
                selected,
                label: `${nameOf(item)}, ${rarity.name.toLowerCase()}${quantity > 1 ? `, ${quantity} unidades` : ""}`,
                attributes: { "data-ui3-bag-item": key, title: nameOf(item) }
            });
        });
        if (!filtering) {
            const capacity = Math.max(bagItems().length, number(hero().bagCapacity, DEFAULT_CAPACITY));
            for (let index = entries.length; index < capacity; index += 1) {
                cells.push('<span class="ui3-bag__cell" aria-hidden="true"></span>');
            }
        }
        return cells.join("");
    }

    function footerHTML() {
        const K = kit();
        const items = bagItems();
        const capacity = Math.max(items.length, number(hero().bagCapacity, DEFAULT_CAPACITY));
        const value = items.reduce((sum, item) => sum + unitValue(item) * quantityOf(item), 0);
        return `<span><strong>${K.formatNumber(items.length)}</strong> / ${K.formatNumber(capacity)} espaços</span>
            <span>Valor base <strong>${K.formatNumber(value)} o</strong></span>
            <span class="ui3-caption">Venda na Loja da cidade</span>`;
    }

    function compareTarget(item) {
        return shared().compareTarget(item);
    }

    function actionsHTML(entry) {
        const K = kit();
        const item = entry.item;
        if (entry.kind === "slot") {
            return K.button({ label: "Desequipar", variant: "primary", attributes: { "data-ui3-unequip": entry.slot } });
        }
        if (isEquipable(item)) {
            const { validation } = compareTarget(item);
            if (validation?.allowed) {
                return K.button({ label: "Equipar", variant: "primary", attributes: { "data-ui3-equip": entry.key } });
            }
            const reason = validation?.code === "LEVEL_REQUIREMENT_NOT_MET"
                ? `Requer nível ${validation.requiredLevel}`
                : EQUIP_ERRORS[validation?.code] || "Não é possível equipar";
            return K.button({ label: reason, variant: "primary", disabled: true });
        }
        if (typeOf(item) === "CONSUMABLE") {
            const preview = Aethra.ConsumableSystem?.preview?.(item.instanceId || item.templateId);
            if (preview?.usable) {
                return K.button({ label: "Usar", variant: "primary", attributes: { "data-ui3-use": entry.key } });
            }
            return K.button({ label: USE_ERRORS[preview?.reason] || "Sem efeito agora", variant: "primary", disabled: true });
        }
        return "";
    }

    function detailsHTML() {
        const K = kit();
        const entry = selectedEntry();
        if (!entry) {
            return `<div class="ui3-bag__placeholder">
                    <span class="ui3-eyebrow">Item selecionado</span>
                    <p class="ui3-empty">Escolha um item da mochila ou um espaço equipado para ver atributos, comparação e ações.</p>
                </div>`;
        }
        const I = shared();
        const item = entry.item;
        const quantity = quantityOf(item);
        const description = I.descriptionOf(item);
        const notice = state.notice
            ? `<p class="ui3-notice ui3-notice--${K.esc(state.notice.tone)}" role="status">${K.esc(state.notice.text)}</p>`
            : "";
        return `${I.headHTML(item, entry.kind === "slot" ? `equipado em ${SLOT_LABELS[entry.slot] || entry.slot}` : "")}
            ${description ? `<p class="ui3-item-description">${K.esc(description)}</p>` : ""}
            ${I.rowsHTML(I.statRows(item))}
            ${entry.kind === "bag" && isEquipable(item) ? I.comparisonHTML(item) : ""}
            ${I.durabilityHTML(item)}
            <div class="ui3-row-between ui3-item-value"><span>Valor base${quantity > 1 ? ` (${K.formatNumber(quantity)} un.)` : ""}</span><strong>${K.formatNumber(unitValue(item) * quantity)} o</strong></div>
            <div class="ui3-item-actions">${notice}${actionsHTML(entry)}</div>`;
    }

    function render() {
        patch(parts.equip, equipColumnHTML());
        patch(parts.chips, chipsHTML());
        patch(parts.grid, gridHTML());
        patch(parts.footer, footerHTML());
        if (!selectedEntry()) state.selected = null;
        patch(parts.details, detailsHTML());
    }

    /* ---------------------------------------------------------------
       Comandos
       --------------------------------------------------------------- */

    function notify(text, tone = "info") {
        state.notice = { text, tone };
        if (noticeTimer) window.clearTimeout(noticeTimer);
        noticeTimer = window.setTimeout(() => {
            state.notice = null;
            noticeTimer = null;
            render();
        }, NOTICE_MS);
    }

    function select(kind, id) {
        state.selected = id ? { kind, id } : null;
        state.notice = null;
        render();
    }

    function findBagItem(key) {
        const items = bagItems();
        return items.find((item, index) => itemKey(item, index) === key) || null;
    }

    function equipItem(key) {
        const item = findBagItem(key);
        if (!item?.instanceId || !Aethra.EquipSystem?.equip) return false;
        const { slot, validation } = compareTarget(item);
        if (!validation?.allowed) {
            notify(EQUIP_ERRORS[validation?.code] || "Não é possível equipar.", "error");
            render();
            return false;
        }
        const equipped = Aethra.EquipSystem.equip(item.instanceId, slot);
        if (equipped) {
            state.selected = { kind: "slot", id: slot };
            notify(`${nameOf(item)} equipado.`, "ok");
        } else {
            notify("Não foi possível equipar.", "error");
        }
        render();
        return equipped;
    }

    function unequipSlot(slot) {
        const item = equipment()[slot];
        if (!item || !Aethra.EquipSystem?.unequip) return false;
        const done = Aethra.EquipSystem.unequip(slot);
        if (done) {
            const index = bagItems().findIndex((entry) => entry.instanceId === item.instanceId);
            state.selected = index >= 0 ? { kind: "bag", id: item.instanceId } : null;
            notify(`${nameOf(item)} voltou para a mochila.`, "ok");
        } else {
            notify("Não foi possível desequipar. A mochila pode estar cheia.", "error");
        }
        render();
        return done;
    }

    function useItem(key) {
        const item = findBagItem(key);
        if (!item || !Aethra.ConsumableSystem?.use) return false;
        const result = Aethra.ConsumableSystem.use(item.instanceId || item.templateId, { source: "ui3-bag" });
        if (result?.used === false) {
            notify(USE_ERRORS[result.reason] || "Não foi possível usar o item.", "error");
        } else {
            notify(`Você usou ${nameOf(item)}.`, "ok");
        }
        render();
        return result?.used !== false;
    }

    function primaryAction(key) {
        const item = findBagItem(key);
        if (!item) return false;
        if (isEquipable(item)) return equipItem(key);
        if (typeOf(item) === "CONSUMABLE") return useItem(key);
        return false;
    }

    function onClick(event) {
        const target = event.target;
        const filter = target.closest("[data-ui3-filter]");
        if (filter) {
            state.filter = filter.dataset.ui3Filter;
            return render();
        }
        if (target.closest("[data-ui3-clear-slot-filter]")) {
            state.fitsSlot = null;
            return render();
        }
        const bagItem = target.closest("[data-ui3-bag-item]");
        if (bagItem) return select("bag", bagItem.dataset.ui3BagItem);
        const slot = target.closest("[data-ui3-equip-slot]");
        if (slot) {
            const slotId = slot.dataset.ui3EquipSlot;
            if (equipment()[slotId]) {
                state.fitsSlot = null;
                return select("slot", slotId);
            }
            state.fitsSlot = state.fitsSlot === slotId ? null : slotId;
            return render();
        }
        const equip = target.closest("[data-ui3-equip]");
        if (equip) return equipItem(equip.dataset.ui3Equip);
        const use = target.closest("[data-ui3-use]");
        if (use) return useItem(use.dataset.ui3Use);
        const unequip = target.closest("[data-ui3-unequip]");
        if (unequip) return unequipSlot(unequip.dataset.ui3Unequip);
        return undefined;
    }

    function onDoubleClick(event) {
        const bagItem = event.target.closest("[data-ui3-bag-item]");
        if (bagItem) primaryAction(bagItem.dataset.ui3BagItem);
    }

    /* ---------------------------------------------------------------
       Montagem
       --------------------------------------------------------------- */

    function setup(body) {
        const K = kit();
        body.classList.add("ui3-bag");
        body.innerHTML = `<section class="ui3-bag__equip" aria-label="Equipado" data-ui3-part="equip"></section>
            <section class="ui3-bag__items" aria-label="Mochila">
                <div class="ui3-bag__toolbar">
                    <label class="ui3-search">
                        <span class="ui3-search__icon">${K.icon("search", 15)}</span>
                        <span class="ui3-sr-only">Buscar na mochila</span>
                        <input type="search" placeholder="Buscar item" autocomplete="off" data-ui3-bag-search data-ui3-autofocus>
                    </label>
                    <label class="ui3-select">
                        <span>Ordenar</span>
                        <select data-ui3-bag-sort>${SORTS.map((sort) => `<option value="${sort.id}">${K.esc(sort.label)}</option>`).join("")}</select>
                    </label>
                </div>
                <div class="ui3-bag__chips" role="group" aria-label="Filtrar itens" data-ui3-part="chips"></div>
                <div class="ui3-bag__grid" data-ui3-part="grid"></div>
                <footer class="ui3-bag__footer" data-ui3-part="footer"></footer>
            </section>
            <section class="ui3-bag__details" aria-label="Item selecionado" aria-live="polite" data-ui3-part="details"></section>`;
        const part = (name) => body.querySelector(`[data-ui3-part="${name}"]`);
        parts = {
            equip: part("equip"),
            chips: part("chips"),
            grid: part("grid"),
            footer: part("footer"),
            details: part("details"),
            search: body.querySelector("[data-ui3-bag-search]"),
            sort: body.querySelector("[data-ui3-bag-sort]")
        };
        body.addEventListener("click", onClick);
        body.addEventListener("dblclick", onDoubleClick);
        parts.search.addEventListener("input", () => {
            state.query = parts.search.value;
            patch(parts.grid, gridHTML());
        });
        parts.sort.addEventListener("change", () => {
            state.sort = parts.sort.value;
            patch(parts.grid, gridHTML());
        });
    }

    function onOpen(options = {}) {
        state.query = "";
        state.fitsSlot = options.slot || null;
        if (parts.search) parts.search.value = "";
        if (parts.sort) parts.sort.value = state.sort;
    }

    function register() {
        if (!Aethra.Ui3Window?.define) return false;
        Aethra.Ui3BagWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Mochila e Equipamento",
            className: "ui3-dialog--wide",
            setup,
            render,
            onOpen,
            getSubtitle: () => `${hero().name || "Herói"} · Nv ${Math.max(1, Math.floor(number(hero().level, 1)))}`,
            getHeaderExtra: () => `<span class="ui3-currency"><span class="ui3-currency__coin" aria-hidden="true"></span><strong>${kit().formatNumber(hero().gold)}</strong><small>ouro</small></span>`,
            events: [
                "inventory:changed",
                "bag:changed",
                "hero.bag:changed",
                "bag:item-removed",
                "bag:cleared",
                "itemEquipped",
                "itemUnequipped",
                "statsChanged",
                "goldChanged",
                "consumable:used",
                "LootSold",
                "ItemSoldBack"
            ]
        });
        return true;
    }

    register();
})(window.Aethra = window.Aethra || {});
