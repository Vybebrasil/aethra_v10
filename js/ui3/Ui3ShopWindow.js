/*
 * Ui3ShopWindow.js — Loja do mercador na UI 3.0 (fase 3).
 *
 * Assume a janela "npc-shop-view" pelo Ui3Window/WindowManager.
 *   leitura   MarketplaceSystem.getNpcCatalog/getSaleQuote, hero.bag
 *   comandos  MarketplaceSystem.buyItem, sellToNpc, sellLoot
 * Preços e elegibilidade vêm sempre da cotação do dono: a tela nunca
 * oferece uma venda que o mercador recusaria.
 */
(function initUi3ShopWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "npc-shop-view";
    const NOTICE_MS = 4000;
    const CONFIRM_MS = 4000;
    const QUANTITIES = Object.freeze([1, 5, 10]);
    const TABS = Object.freeze([
        { id: "buy", label: "Comprar" },
        { id: "sell", label: "Vender" }
    ]);
    const CATEGORIES = Object.freeze([
        { id: "all", label: "Todos" },
        { id: "consumable", label: "Poções" },
        { id: "weapon", label: "Armas" },
        { id: "armor", label: "Armaduras" },
        { id: "shield", label: "Escudos" },
        { id: "accessory", label: "Acessórios" }
    ]);

    const state = {
        tab: "buy",
        category: "all",
        selected: null,
        quantity: 1,
        notice: null,
        confirmSellAllUntil: 0
    };
    const rendered = new WeakMap();
    let parts = {};
    let noticeTimer = null;

    function kit() {
        return Aethra.Ui3Kit;
    }

    function shared() {
        return Aethra.Ui3Items;
    }

    function market() {
        return Aethra.MarketplaceSystem;
    }

    function patch(element, html) {
        if (!element || rendered.get(element) === html) return false;
        element.innerHTML = html;
        rendered.set(element, html);
        return true;
    }

    function hero() {
        return Aethra.GameState?.hero || {};
    }

    function gold() {
        return Math.max(0, Math.floor(Number(hero().gold) || 0));
    }

    function heroLevel() {
        return Math.max(1, Math.floor(Number(hero().level) || 1));
    }

    /* ---------------------------------------------------------------
       Leitura
       --------------------------------------------------------------- */

    function categoryOf(item = {}) {
        const type = String(item.type || item.itemType || "").toLowerCase();
        if (type === "accessory" || String(item.slot || "").startsWith("ring")) return "accessory";
        if (type === "shield" || item.slot === "offhand") return "shield";
        return type || "misc";
    }

    function catalog() {
        return (market()?.getNpcCatalog?.(heroLevel()) || []).map((item) => ({ ...item, category: categoryOf(item) }));
    }

    function sellables() {
        const bag = Array.isArray(hero().bag) ? hero().bag : [];
        return bag
            .filter(Boolean)
            .map((item) => ({ item, quote: market()?.getSaleQuote?.(item) || { sellable: false } }))
            .filter((entry) => entry.quote.sellable);
    }

    function isStackable(item) {
        return item?.stackable === true;
    }

    function unitPrice(item) {
        return Math.max(0, Math.floor(Number(item?.price || item?.value || 0)));
    }

    function statLine(item) {
        const rows = shared().statRows(item);
        return rows.length ? rows.slice(0, 3).map(([label, value]) => `${label} ${value}`).join(" · ") : shared().typeLabel(item);
    }

    function sourceLabel(quote) {
        return quote.mode === "sellback"
            ? `Devolução ao mercador · ${Math.round(Number(quote.rate ?? 0.5) * 100)}%`
            : "Drop de caçada · valor integral";
    }

    function selectedBuy() {
        if (state.tab !== "buy" || !state.selected) return null;
        return catalog().find((item) => item.id === state.selected) || null;
    }

    function selectedSell() {
        if (state.tab !== "sell" || !state.selected) return null;
        return sellables().find((entry) => entry.item.instanceId === state.selected) || null;
    }

    /* ---------------------------------------------------------------
       Renderização
       --------------------------------------------------------------- */

    function tabsHTML() {
        const K = kit();
        const counts = { buy: catalog().length, sell: sellables().length };
        return K.tabs({
            label: "Seções da loja",
            items: TABS.map((tab) => ({ id: tab.id, label: `${tab.label} ${counts[tab.id]}` })),
            selected: state.tab
        });
    }

    function priceHTML(amount, affordable = true) {
        const K = kit();
        return `<span class="ui3-price${affordable ? "" : " is-short"}"><span class="ui3-currency__coin" aria-hidden="true"></span>${K.formatNumber(amount)}</span>`;
    }

    function buyListHTML() {
        const K = kit();
        const items = catalog();
        const filtered = state.category === "all" ? items : items.filter((item) => item.category === state.category);
        const chips = CATEGORIES.map((category) => K.chip({
            label: category.label,
            pressed: state.category === category.id,
            attributes: { "data-ui3-shop-category": category.id }
        })).join("");
        const rows = filtered.map((item) => {
            const selected = state.selected === item.id;
            const locked = Number(item.levelReq || 1) > heroLevel();
            return `<button type="button" class="ui3-list-row" data-ui3-shop-buy="${K.esc(item.id)}" aria-pressed="${selected ? "true" : "false"}">
                    ${shared().thumbHTML(item)}
                    <span class="ui3-list-row__text">
                        <strong class="ui3-rarity-text--${shared().rarityOf(item).id}">${K.esc(shared().nameOf(item))}</strong>
                        <small>${K.esc(statLine(item))}${locked ? ` · requer Nv ${K.esc(item.levelReq)}` : ""}</small>
                    </span>
                    ${priceHTML(unitPrice(item), gold() >= unitPrice(item))}
                </button>`;
        }).join("");
        return `<div class="ui3-bag__chips" role="group" aria-label="Categorias">${chips}</div>
            <div class="ui3-list ui3-scroll">${rows || `<p class="ui3-empty">Nenhum item nesta categoria.</p>`}</div>`;
    }

    function sellListHTML() {
        const K = kit();
        const entries = sellables();
        const loot = entries.filter((entry) => entry.quote.mode === "loot");
        const lootValue = loot.reduce((sum, entry) => sum + entry.quote.salePrice, 0);
        const confirming = Date.now() < state.confirmSellAllUntil;
        const rows = entries.map(({ item, quote }) => {
            const selected = state.selected === item.instanceId;
            return `<button type="button" class="ui3-list-row" data-ui3-shop-sell="${K.esc(item.instanceId)}" aria-pressed="${selected ? "true" : "false"}">
                    ${shared().thumbHTML(item)}
                    <span class="ui3-list-row__text">
                        <strong class="ui3-rarity-text--${shared().rarityOf(item).id}">${K.esc(shared().nameOf(item))}${quote.quantity > 1 ? ` <small>×${K.formatNumber(quote.quantity)}</small>` : ""}</strong>
                        <small>${K.esc(sourceLabel(quote))}</small>
                    </span>
                    <span class="ui3-price is-gain">+${K.formatNumber(quote.salePrice)}</span>
                </button>`;
        }).join("");
        return `<div class="ui3-note">
                <span>Itens vinculados e o kit inicial ficam protegidos.</span>
                <strong>${K.formatNumber(entries.length)} ${entries.length === 1 ? "vendável" : "vendáveis"}</strong>
            </div>
            ${K.button({
                label: loot.length
                    ? (confirming ? `Confirmar: vender ${loot.length} drop(s) por ${K.formatNumber(lootValue)} o` : `Vender todos os drops (${loot.length}) · +${K.formatNumber(lootValue)} o`)
                    : "Nenhum drop para vender",
                variant: confirming ? "danger" : "secondary",
                disabled: !loot.length,
                attributes: { "data-ui3-shop-sell-all": "" }
            })}
            <div class="ui3-list ui3-scroll">${rows || `<p class="ui3-empty">Nenhum drop ou item comprado aqui está disponível para venda.</p>`}</div>`;
    }

    function noticeHTML() {
        const K = kit();
        return state.notice
            ? `<p class="ui3-notice ui3-notice--${K.esc(state.notice.tone)}" role="status">${K.esc(state.notice.text)}</p>`
            : "";
    }

    function buyDetailsHTML(item) {
        const K = kit();
        const I = shared();
        const stackable = isStackable(item);
        const quantity = stackable ? state.quantity : 1;
        const total = unitPrice(item) * quantity;
        const missing = Math.max(0, total - gold());
        const description = I.descriptionOf(item);
        const quantityPicker = stackable
            ? `<div class="ui3-stack">
                    <span class="ui3-eyebrow">Quantidade</span>
                    <div class="ui3-row" role="group" aria-label="Quantidade">${QUANTITIES.map((amount) => K.chip({
                        label: `${amount}×`,
                        pressed: quantity === amount,
                        attributes: { "data-ui3-shop-quantity": amount }
                    })).join("")}</div>
                </div>`
            : "";
        return `${I.headHTML(item)}
            ${description ? `<p class="ui3-item-description">${K.esc(description)}</p>` : ""}
            ${I.rowsHTML(I.statRows(item))}
            ${I.isEquipable(item) ? I.comparisonHTML(item, { baseValues: true }) : ""}
            ${I.isEquipable(item) ? `<p class="ui3-caption">Cada peça comprada recebe sua própria variação de atributos.</p>` : ""}
            ${quantityPicker}
            <div class="ui3-row-between ui3-item-value"><span>Preço${quantity > 1 ? ` (${quantity} × ${K.formatNumber(unitPrice(item))})` : ""}</span><strong>${K.formatNumber(total)} o</strong></div>
            <div class="ui3-item-actions">${noticeHTML()}${K.button({
                label: missing > 0 ? `Faltam ${K.formatNumber(missing)} o` : `Comprar por ${K.formatNumber(total)} o`,
                variant: "primary",
                disabled: missing > 0,
                attributes: { "data-ui3-shop-confirm-buy": item.id }
            })}</div>`;
    }

    function sellDetailsHTML(entry) {
        const K = kit();
        const I = shared();
        const { item, quote } = entry;
        return `${I.headHTML(item)}
            ${I.rowsHTML(I.statRows(item))}
            ${I.durabilityHTML(item)}
            <div class="ui3-note"><span>${K.esc(sourceLabel(quote))}</span><strong>${quote.quantity > 1 ? `${K.formatNumber(quote.quantity)} un.` : "1 un."}</strong></div>
            <div class="ui3-item-actions">${noticeHTML()}${K.button({
                label: `Vender por +${K.formatNumber(quote.salePrice)} o`,
                variant: "primary",
                attributes: { "data-ui3-shop-confirm-sell": item.instanceId }
            })}</div>`;
    }

    function detailsHTML() {
        const buy = selectedBuy();
        if (buy) return buyDetailsHTML(buy);
        const sell = selectedSell();
        if (sell) return sellDetailsHTML(sell);
        const hint = state.tab === "buy"
            ? "Escolha um item para ver atributos, comparar com o equipado e comprar."
            : "Escolha um item para ver quanto o mercador paga por ele.";
        return `<div class="ui3-bag__placeholder">
                <span class="ui3-eyebrow">Item selecionado</span>
                <p class="ui3-empty">${kit().esc(hint)}</p>
                ${noticeHTML()}
            </div>`;
    }

    function render() {
        if (state.selected && !selectedBuy() && !selectedSell()) state.selected = null;
        patch(parts.tabs, tabsHTML());
        patch(parts.list, state.tab === "buy" ? buyListHTML() : sellListHTML());
        patch(parts.details, detailsHTML());
    }

    /* ---------------------------------------------------------------
       Comandos
       --------------------------------------------------------------- */

    function notify(text, tone = "ok") {
        state.notice = { text, tone };
        if (noticeTimer) window.clearTimeout(noticeTimer);
        noticeTimer = window.setTimeout(() => {
            state.notice = null;
            noticeTimer = null;
            render();
        }, NOTICE_MS);
    }

    function buy(itemId) {
        const item = catalog().find((entry) => entry.id === itemId);
        if (!item) return false;
        const quantity = isStackable(item) ? state.quantity : 1;
        const result = market()?.buyItem?.(itemId, quantity);
        notify(
            result
                ? `${shared().nameOf(item)}${quantity > 1 ? ` ×${quantity}` : ""} foi para a mochila.`
                : "A compra não pôde ser concluída.",
            result ? "ok" : "error"
        );
        render();
        return Boolean(result);
    }

    function sell(instanceId) {
        const entry = sellables().find((candidate) => candidate.item.instanceId === instanceId);
        if (!entry) return false;
        const result = market()?.sellToNpc?.(instanceId);
        notify(result ? `Venda concluída: +${kit().formatNumber(result.salePrice)} o.` : "O mercador recusou este item.", result ? "ok" : "error");
        state.selected = null;
        render();
        return Boolean(result);
    }

    function sellAllLoot() {
        if (Date.now() >= state.confirmSellAllUntil) {
            state.confirmSellAllUntil = Date.now() + CONFIRM_MS;
            render();
            window.setTimeout(render, CONFIRM_MS + 50);
            return false;
        }
        state.confirmSellAllUntil = 0;
        let sold = 0;
        let total = 0;
        sellables()
            .filter((entry) => entry.quote.mode === "loot")
            .forEach(({ item }) => {
                const result = market()?.sellLoot?.(item.instanceId);
                if (result) {
                    sold += 1;
                    total += Number(result.salePrice || 0);
                }
            });
        notify(sold ? `${sold} drop(s) vendidos por ${kit().formatNumber(total)} o.` : "Nenhum drop pôde ser vendido.", sold ? "ok" : "error");
        state.selected = null;
        render();
        return sold > 0;
    }

    function onClick(event) {
        const target = event.target;
        const tab = target.closest("[data-ui3-tab]");
        if (tab) {
            state.tab = tab.dataset.ui3Tab;
            state.selected = null;
            state.notice = null;
            return render();
        }
        const category = target.closest("[data-ui3-shop-category]");
        if (category) {
            state.category = category.dataset.ui3ShopCategory;
            return render();
        }
        const buyRow = target.closest("[data-ui3-shop-buy]");
        if (buyRow) {
            state.selected = buyRow.dataset.ui3ShopBuy;
            state.quantity = 1;
            state.notice = null;
            return render();
        }
        const sellRow = target.closest("[data-ui3-shop-sell]");
        if (sellRow) {
            state.selected = sellRow.dataset.ui3ShopSell;
            state.notice = null;
            return render();
        }
        const quantity = target.closest("[data-ui3-shop-quantity]");
        if (quantity) {
            state.quantity = Number(quantity.dataset.ui3ShopQuantity) || 1;
            return render();
        }
        const confirmBuy = target.closest("[data-ui3-shop-confirm-buy]");
        if (confirmBuy) return buy(confirmBuy.dataset.ui3ShopConfirmBuy);
        const confirmSell = target.closest("[data-ui3-shop-confirm-sell]");
        if (confirmSell) return sell(confirmSell.dataset.ui3ShopConfirmSell);
        if (target.closest("[data-ui3-shop-sell-all]")) return sellAllLoot();
        return undefined;
    }

    function setup(body) {
        body.classList.add("ui3-shop");
        body.innerHTML = `<section class="ui3-shop__main" aria-label="Mercadorias">
                <div class="ui3-shop__tabs" data-ui3-part="tabs"></div>
                <div class="ui3-shop__list" data-ui3-part="list"></div>
            </section>
            <section class="ui3-bag__details" aria-label="Item selecionado" aria-live="polite" data-ui3-part="details"></section>`;
        const part = (name) => body.querySelector(`[data-ui3-part="${name}"]`);
        parts = { tabs: part("tabs"), list: part("list"), details: part("details") };
        body.addEventListener("click", onClick);
    }

    function onOpen(options = {}) {
        state.tab = options.tab === "sell" ? "sell" : "buy";
        state.selected = null;
        state.notice = null;
        state.confirmSellAllUntil = 0;
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3ShopWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Loja",
            className: "ui3-dialog--wide",
            setup,
            render,
            onOpen,
            getSubtitle: () => "Velho Varian · suprimentos, equipamento e compra de espólios",
            getHeaderExtra: () => `<span class="ui3-currency"><span class="ui3-currency__coin" aria-hidden="true"></span><strong>${kit().formatNumber(gold())}</strong><small>ouro</small></span>`,
            events: [
                "inventory:changed",
                "bag:changed",
                "hero.bag:changed",
                "bag:item-removed",
                "goldChanged",
                "market:currency-changed",
                "NPCItemPurchased",
                "LootSold",
                "ItemSoldBack",
                "itemEquipped",
                "itemUnequipped"
            ]
        });
    }
})(window.Aethra = window.Aethra || {});
