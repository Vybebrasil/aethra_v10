/*
 * Ui3PremiumShopWindow.js — Loja de Diamantes (Cash) na UI 3.0 (fase 5.2).
 *
 * Assume "premium-shop-view" pelo Ui3Window/WindowManager. Mesmo layout da
 * Loja. Diamantes são moeda paga: a compra pede um segundo clique.
 *   leitura   MarketplaceSystem.getPremiumCatalog, GameState.hero.diamonds
 *   comando   MarketplaceSystem.buyPremiumItem
 */
(function initUi3PremiumShopWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "premium-shop-view";
    const NOTICE_MS = 4000;
    const CONFIRM_MS = 4000;

    const state = { selected: null, confirmUntil: 0, notice: null };
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

    function diamonds() {
        return Math.max(0, Math.floor(Number(Aethra.GameState?.hero?.diamonds) || 0));
    }

    function patch(element, html) {
        if (!element || rendered.get(element) === html) return false;
        element.innerHTML = html;
        rendered.set(element, html);
        return true;
    }

    function catalog() {
        return market()?.getPremiumCatalog?.() || [];
    }

    function price(item) {
        return Math.max(0, Math.floor(Number(item?.diamondPrice) || 0));
    }

    function selected() {
        return catalog().find((item) => item.id === state.selected) || null;
    }

    function notify(text, tone = "ok") {
        state.notice = { text, tone };
        if (noticeTimer) window.clearTimeout(noticeTimer);
        noticeTimer = window.setTimeout(() => {
            state.notice = null;
            noticeTimer = null;
            render();
        }, NOTICE_MS);
    }

    function noticeHTML() {
        const K = kit();
        return state.notice
            ? `<p class="ui3-notice ui3-notice--${K.esc(state.notice.tone)}" role="status">${K.esc(state.notice.text)}</p>`
            : "";
    }

    function gemPrice(amount, affordable) {
        return `<span class="ui3-price${affordable ? "" : " is-short"}"><span class="ui3-currency__gem" aria-hidden="true"></span>${kit().formatNumber(amount)}</span>`;
    }

    function listHTML() {
        const K = kit();
        const I = shared();
        const rows = catalog().map((item) => `<button type="button" class="ui3-list-row" data-ui3-premium-item="${K.esc(item.id)}" aria-pressed="${state.selected === item.id ? "true" : "false"}">
                ${I.thumbHTML(item)}
                <span class="ui3-list-row__text">
                    <strong>${K.esc(I.nameOf(item))}</strong>
                    <small>${K.esc(I.typeLabel(item))} · exclusivo</small>
                </span>
                ${gemPrice(price(item), diamonds() >= price(item))}
            </button>`).join("");
        return `<div class="ui3-note"><span>Itens exclusivos: não voltam ao mercador nem vão ao Mercado de Players.</span><strong>${K.formatNumber(catalog().length)} itens</strong></div>
            <div class="ui3-list ui3-scroll">${rows || `<p class="ui3-empty">A vitrine está vazia no momento.</p>`}</div>`;
    }

    function detailsHTML() {
        const K = kit();
        const I = shared();
        const item = selected();
        if (!item) {
            return `<div class="ui3-bag__placeholder">
                    <span class="ui3-eyebrow">Item selecionado</span>
                    <p class="ui3-empty">Escolha um item para ver o que ele faz e o preço em diamantes.</p>
                    ${noticeHTML()}
                </div>`;
        }
        const cost = price(item);
        const missing = Math.max(0, cost - diamonds());
        const confirming = Date.now() < state.confirmUntil;
        return `${I.headHTML(item)}
            ${I.rowsHTML(I.statRows(item))}
            ${I.isEquipable(item) ? I.comparisonHTML(item) : ""}
            <div class="ui3-row-between ui3-item-value"><span>Preço</span><strong>${K.formatNumber(cost)} diamantes</strong></div>
            <p class="ui3-caption">Sem revenda ao mercador e sem anúncio no Mercado de Players.</p>
            <div class="ui3-item-actions">${noticeHTML()}${K.button({
                label: missing > 0
                    ? `Faltam ${K.formatNumber(missing)} diamantes`
                    : confirming ? `Confirmar: gastar ${K.formatNumber(cost)} diamantes` : `Comprar por ${K.formatNumber(cost)} diamantes`,
                variant: confirming ? "danger" : "primary",
                disabled: missing > 0,
                attributes: { "data-ui3-premium-buy": item.id }
            })}</div>`;
    }

    function render() {
        if (!market() || !shared()) return;
        if (state.selected && !selected()) state.selected = null;
        patch(parts.list, listHTML());
        patch(parts.details, detailsHTML());
    }

    function buy(itemId) {
        if (Date.now() >= state.confirmUntil) {
            state.confirmUntil = Date.now() + CONFIRM_MS;
            render();
            window.setTimeout(render, CONFIRM_MS + 50);
            return false;
        }
        state.confirmUntil = 0;
        const item = selected();
        const result = market().buyPremiumItem(itemId, 1);
        notify(result ? `${shared().nameOf(item)} foi para a mochila.` : "A compra não pôde ser concluída.", result ? "ok" : "error");
        render();
        return Boolean(result);
    }

    function onClick(event) {
        const row = event.target.closest("[data-ui3-premium-item]");
        if (row) {
            state.selected = row.dataset.ui3PremiumItem;
            state.confirmUntil = 0;
            state.notice = null;
            return render();
        }
        const buyButton = event.target.closest("[data-ui3-premium-buy]");
        if (buyButton) return buy(buyButton.dataset.ui3PremiumBuy);
        return undefined;
    }

    function setup(body) {
        body.classList.add("ui3-shop");
        body.innerHTML = `<section class="ui3-shop__main" aria-label="Vitrine">
                <div class="ui3-shop__list" data-ui3-part="list"></div>
            </section>
            <section class="ui3-bag__details" aria-label="Item selecionado" aria-live="polite" data-ui3-part="details"></section>`;
        const part = (name) => body.querySelector(`[data-ui3-part="${name}"]`);
        parts = { list: part("list"), details: part("details") };
        body.addEventListener("click", onClick);
    }

    function onOpen() {
        state.selected = null;
        state.confirmUntil = 0;
        state.notice = null;
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3PremiumShopWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Loja de Diamantes",
            className: "ui3-dialog--wide",
            setup,
            render,
            onOpen,
            getSubtitle: () => "Itens exclusivos",
            getHeaderExtra: () => `<span class="ui3-currency"><span class="ui3-currency__gem" aria-hidden="true"></span><strong>${kit().formatNumber(diamonds())}</strong><small>diamantes</small></span>`,
            events: ["market:premium-item-purchased", "market:premium-item-registered", "market:currency-changed", "diamondsChanged", "inventory:changed", "bag:changed"]
        });
    }
})(window.Aethra = window.Aethra || {});
