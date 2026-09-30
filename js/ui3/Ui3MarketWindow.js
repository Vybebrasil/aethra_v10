/*
 * Ui3MarketWindow.js — Mercado de Players na UI 3.0 (fase 5.2).
 *
 * Assume "player-market-view" pelo Ui3Window/WindowManager. Mesmo layout
 * da Loja: lista à esquerda, item escolhido à direita.
 *   leitura   MarketplaceSystem.getActiveListings/getListableItems/
 *             getListingQuote/getSellerSummary
 *   comandos  MarketplaceSystem.buyFromPlayer, listForSale, cancelListing,
 *             claimSellerBalance
 */
(function initUi3MarketWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "player-market-view";
    const NOTICE_MS = 4000;
    const TABS = Object.freeze([
        { id: "buy", label: "Comprar" },
        { id: "sell", label: "Anunciar" },
        { id: "history", label: "Meus anúncios" }
    ]);

    const state = { tab: "buy", selected: null, query: "", price: 1, notice: null };
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

    function gold() {
        return Math.max(0, Math.floor(Number(Aethra.GameState?.hero?.gold) || 0));
    }

    function patch(element, html) {
        if (!element || rendered.get(element) === html) return false;
        element.innerHTML = html;
        rendered.set(element, html);
        return true;
    }

    function summary() {
        return market()?.getSellerSummary?.() || { sellerId: null, balance: 0, taxRate: 0, activeListings: [], history: [] };
    }

    function listings() {
        const term = state.query.trim().toLocaleLowerCase("pt-BR");
        return (market()?.getActiveListings?.() || []).filter((listing) => {
            if (!term) return true;
            return `${shared().nameOf(listing.item)} ${listing.sellerName || ""}`.toLocaleLowerCase("pt-BR").includes(term);
        });
    }

    function listable() {
        return market()?.getListableItems?.() || [];
    }

    function defaultPrice(item) {
        return Math.max(1, Math.floor(shared().unitValue(item) * shared().quantityOf(item)));
    }

    function selectedListing(list = market()?.getActiveListings?.() || []) {
        return state.tab !== "sell" ? list.find((listing) => listing.listingId === state.selected) || null : null;
    }

    function selectedItem() {
        return state.tab === "sell" ? listable().find((item) => item.instanceId === state.selected) || null : null;
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

    function quoteText(price) {
        const K = kit();
        const quote = market().getListingQuote(price);
        return `Taxa ${K.formatNumber(quote.tax)} o (${Math.round(quote.taxRate * 100)}%, mínimo 1) · você recebe ${K.formatNumber(quote.sellerNet)} o`;
    }

    /* ---------------------------------------------------------------
       Lista
       --------------------------------------------------------------- */

    function headHTML() {
        const K = kit();
        const active = market()?.getActiveListings?.() || [];
        const rate = Math.round(Number(summary().taxRate || 0) * 100);
        return `${K.tabs({ label: "Áreas do Mercado", items: TABS, selected: state.tab })}
            <div class="ui3-note"><span>Mercado local · taxa de ${rate}% cobrada do vendedor na venda</span><strong>${K.formatNumber(active.length)} ${active.length === 1 ? "oferta ativa" : "ofertas ativas"}</strong></div>`;
    }

    function listingRowHTML(listing, ownId) {
        const K = kit();
        const I = shared();
        const own = listing.sellerId === ownId;
        return `<button type="button" class="ui3-list-row" data-ui3-market-listing="${K.esc(listing.listingId)}" aria-pressed="${state.selected === listing.listingId ? "true" : "false"}">
                ${I.thumbHTML(listing.item)}
                <span class="ui3-list-row__text">
                    <strong class="ui3-rarity-text--${I.rarityOf(listing.item).id}">${K.esc(I.nameOf(listing.item))}${I.quantityOf(listing.item) > 1 ? ` <small>×${K.formatNumber(I.quantityOf(listing.item))}</small>` : ""}</strong>
                    <small>${own ? "Seu anúncio" : `Vendido por ${K.esc(listing.sellerName || "Jogador")}`}</small>
                </span>
                <span class="ui3-price${gold() >= listing.price || own ? "" : " is-short"}">${K.formatNumber(listing.price)}</span>
            </button>`;
    }

    function buyListHTML() {
        const ownId = summary().sellerId;
        const rows = listings().map((listing) => listingRowHTML(listing, ownId)).join("");
        return `<div class="ui3-list ui3-scroll">${rows || `<p class="ui3-empty">${state.query ? "Nenhuma oferta com esse nome ou vendedor." : "Nenhuma oferta ativa. Anuncie uma peça na aba Anunciar."}</p>`}</div>`;
    }

    function sellListHTML() {
        const K = kit();
        const I = shared();
        const rows = listable().map((item) => `<button type="button" class="ui3-list-row" data-ui3-market-item="${K.esc(item.instanceId)}" aria-pressed="${state.selected === item.instanceId ? "true" : "false"}">
                ${I.thumbHTML(item)}
                <span class="ui3-list-row__text">
                    <strong class="ui3-rarity-text--${I.rarityOf(item).id}">${K.esc(I.nameOf(item))}${I.quantityOf(item) > 1 ? ` <small>×${K.formatNumber(I.quantityOf(item))}</small>` : ""}</strong>
                    <small>${K.esc(I.metaLine?.(item) || I.typeLabel?.(item) || "")}</small>
                </span>
            </button>`).join("");
        return `<div class="ui3-note"><span>Itens vinculados, premium e o kit inicial não podem ser anunciados.</span><strong>${K.formatNumber(listable().length)} negociáveis</strong></div>
            <div class="ui3-list ui3-scroll">${rows || `<p class="ui3-empty">Nenhum item negociável na mochila.</p>`}</div>`;
    }

    function historyListHTML() {
        const K = kit();
        const own = summary();
        const active = own.activeListings.map((listing) => listingRowHTML(listing, own.sellerId)).join("");
        const history = own.history.map((listing) => `<div class="ui3-row-between ui3-market__history-row">
                <span>${K.esc(shared().nameOf(listing.item))} · ${K.esc(listing.sellerName || "Jogador")}</span>
                <strong>${K.esc(listing.status === "sold" ? "Vendido" : listing.status === "cancelled" ? "Cancelado" : "Finalizado")} · ${K.formatNumber(listing.price)} o</strong>
            </div>`).join("");
        return `<div class="ui3-list ui3-scroll">
                <span class="ui3-eyebrow">Anúncios ativos · ${K.formatNumber(own.activeListings.length)}</span>
                ${active || `<p class="ui3-empty">Você não possui anúncios ativos.</p>`}
                <span class="ui3-eyebrow">Histórico recente</span>
                ${history || `<p class="ui3-empty">Nenhuma transação concluída ainda.</p>`}
            </div>`;
    }

    /* ---------------------------------------------------------------
       Painel do item
       --------------------------------------------------------------- */

    function listingDetailsHTML(listing) {
        const K = kit();
        const I = shared();
        const own = listing.sellerId === summary().sellerId;
        const missing = Math.max(0, listing.price - gold());
        const action = own
            ? K.button({ label: "Cancelar anúncio", variant: "danger", attributes: { "data-ui3-market-cancel": listing.listingId } })
            : K.button({
                label: missing > 0 ? `Faltam ${K.formatNumber(missing)} o` : `Comprar por ${K.formatNumber(listing.price)} o`,
                variant: "primary",
                disabled: missing > 0,
                attributes: { "data-ui3-market-buy": listing.listingId }
            });
        return `${I.headHTML(listing.item)}
            ${I.rowsHTML(I.statRows(listing.item))}
            ${I.isEquipable(listing.item) ? I.comparisonHTML(listing.item) : ""}
            <div class="ui3-row-between ui3-item-value"><span>${own ? "Seu preço" : `Oferta de ${K.esc(listing.sellerName || "Jogador")}`}</span><strong>${K.formatNumber(listing.price)} o</strong></div>
            ${own ? `<p class="ui3-caption">Cancelar devolve a peça à mochila.</p>` : `<p class="ui3-caption">Peças compradas de jogadores não podem ser revendidas ao mercador.</p>`}
            <div class="ui3-item-actions">${noticeHTML()}${action}</div>`;
    }

    function itemDetailsHTML(item) {
        const K = kit();
        const I = shared();
        return `${I.headHTML(item)}
            ${I.rowsHTML(I.statRows(item))}
            <label class="ui3-field">
                <span class="ui3-eyebrow">Preço total em ouro</span>
                <input type="number" min="1" step="1" inputmode="numeric" value="${K.esc(state.price)}" data-ui3-market-price>
            </label>
            <p class="ui3-caption" data-ui3-market-quote>${K.esc(quoteText(state.price))}</p>
            <p class="ui3-caption">A peça sai da mochila enquanto a oferta estiver ativa.</p>
            <div class="ui3-item-actions">${noticeHTML()}${K.button({ label: "Publicar oferta", variant: "primary", attributes: { "data-ui3-market-publish": item.instanceId } })}</div>`;
    }

    function balanceHTML() {
        const K = kit();
        const own = summary();
        const hint = state.tab === "history"
            ? "Escolha um anúncio para cancelá-lo."
            : state.tab === "sell" ? "Escolha uma peça da mochila para anunciar." : "Escolha uma oferta para ver atributos e comprar.";
        return `<div class="ui3-bag__placeholder">
                <span class="ui3-eyebrow">Saldo a receber</span>
                <strong class="ui3-market__balance">${K.formatNumber(own.balance)} o</strong>
                <p class="ui3-caption">Vendas concluídas ficam guardadas aqui até o resgate.</p>
                ${K.button({ label: "Resgatar saldo", variant: own.balance > 0 ? "primary" : "secondary", disabled: own.balance <= 0, attributes: { "data-ui3-market-claim": "" } })}
                <p class="ui3-empty">${K.esc(hint)}</p>
                ${noticeHTML()}
            </div>`;
    }

    function detailsHTML() {
        const listing = selectedListing();
        if (listing) return listingDetailsHTML(listing);
        const item = selectedItem();
        if (item) return itemDetailsHTML(item);
        return balanceHTML();
    }

    function render() {
        if (!market() || !shared()) return;
        if (state.selected && !selectedListing() && !selectedItem()) state.selected = null;
        parts.search.hidden = state.tab !== "buy";
        patch(parts.head, headHTML());
        patch(parts.list, state.tab === "sell" ? sellListHTML() : state.tab === "history" ? historyListHTML() : buyListHTML());
        patch(parts.details, detailsHTML());
    }

    /* ---------------------------------------------------------------
       Comandos
       --------------------------------------------------------------- */

    function buy(listingId) {
        const listing = selectedListing();
        const result = market().buyFromPlayer(listingId);
        notify(result ? `${shared().nameOf(listing?.item)} foi para a mochila.` : "A compra não pôde ser concluída.", result ? "ok" : "error");
        if (result) state.selected = null;
        render();
        return Boolean(result);
    }

    function publish(instanceId) {
        const quote = market().getListingQuote(state.price);
        const result = market().listForSale(instanceId, quote.price);
        notify(result ? `Oferta publicada por ${kit().formatNumber(quote.price)} o.` : "Não foi possível publicar esta oferta.", result ? "ok" : "error");
        if (result) state.selected = null;
        render();
        return Boolean(result);
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
        const listing = target.closest("[data-ui3-market-listing]");
        if (listing) {
            state.selected = listing.dataset.ui3MarketListing;
            state.notice = null;
            return render();
        }
        const item = target.closest("[data-ui3-market-item]");
        if (item) {
            state.selected = item.dataset.ui3MarketItem;
            state.price = defaultPrice(selectedItem());
            state.notice = null;
            return render();
        }
        const buyButton = target.closest("[data-ui3-market-buy]");
        if (buyButton) return buy(buyButton.dataset.ui3MarketBuy);
        const publishButton = target.closest("[data-ui3-market-publish]");
        if (publishButton) return publish(publishButton.dataset.ui3MarketPublish);
        const cancel = target.closest("[data-ui3-market-cancel]");
        if (cancel) {
            const result = market().cancelListing(cancel.dataset.ui3MarketCancel);
            notify(result ? "Anúncio cancelado; a peça voltou à mochila." : "Este anúncio não pode ser cancelado.", result ? "ok" : "error");
            if (result) state.selected = null;
            return render();
        }
        if (target.closest("[data-ui3-market-claim]")) {
            const result = market().claimSellerBalance();
            notify(result ? `+${kit().formatNumber(result.amount)} o resgatados.` : "Não há saldo para resgatar.", result ? "ok" : "error");
            return render();
        }
        return undefined;
    }

    // Digitar o preço atualiza só a projeção, sem redesenhar o campo.
    function onInput(event) {
        if (event.target.matches("[data-ui3-market-price]")) {
            state.price = Math.max(1, Math.floor(Number(event.target.value) || 0));
            const quote = parts.details.querySelector("[data-ui3-market-quote]");
            if (quote) quote.textContent = quoteText(state.price);
            return;
        }
        if (event.target.matches("[data-ui3-market-search]")) {
            state.query = event.target.value;
            patch(parts.list, buyListHTML());
        }
    }

    function setup(body) {
        const K = kit();
        body.classList.add("ui3-shop");
        body.innerHTML = `<section class="ui3-shop__main" aria-label="Ofertas">
                <div class="ui3-shop__tabs" data-ui3-part="head"></div>
                <label class="ui3-search ui3-market__search" data-ui3-part="search">
                    <span class="ui3-search__icon">${K.icon("search", 15)}</span>
                    <span class="ui3-sr-only">Buscar oferta</span>
                    <input type="search" placeholder="Item ou vendedor" autocomplete="off" data-ui3-market-search>
                </label>
                <div class="ui3-shop__list" data-ui3-part="list"></div>
            </section>
            <section class="ui3-bag__details" aria-label="Oferta selecionada" aria-live="polite" data-ui3-part="details"></section>`;
        const part = (name) => body.querySelector(`[data-ui3-part="${name}"]`);
        parts = { head: part("head"), search: part("search"), list: part("list"), details: part("details") };
        body.addEventListener("click", onClick);
        body.addEventListener("input", onInput);
    }

    function onOpen(options = {}) {
        state.tab = TABS.some((tab) => tab.id === options.tab) ? options.tab : "buy";
        state.selected = null;
        state.query = "";
        state.notice = null;
        const search = parts.search?.querySelector("input");
        if (search) search.value = "";
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3MarketWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Mercado de Players",
            className: "ui3-dialog--wide",
            setup,
            render,
            onOpen,
            getSubtitle: () => "Negociação entre aventureiros",
            getHeaderExtra: () => `<span class="ui3-currency"><span class="ui3-currency__coin" aria-hidden="true"></span><strong>${kit().formatNumber(gold())}</strong><small>ouro</small></span>`,
            events: [
                "market:listing-created", "market:purchase-completed", "market:listing-cancelled", "market:seller-balance-claimed",
                "goldChanged", "market:currency-changed", "inventory:changed", "bag:changed", "hero.bag:changed", "bag:item-removed"
            ]
        });
    }
})(window.Aethra = window.Aethra || {});
