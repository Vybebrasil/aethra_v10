// HudModernization.js - camada coesa de navegação, comércio e preferências do HUD.
(function (Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const marketEvents = [
        "market:ready",
        "market:listing-created",
        "market:purchase-completed",
        "market:listing-cancelled",
        "market:seller-balance-claimed"
    ];
    let responsiveFrame = 0;
    let responsiveListenersBound = false;

    const esc = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    const fmt = (value) => new Intl.NumberFormat("pt-BR").format(Number(value || 0));

    function getPreferences() {
        const value = Aethra.SettingsManager?.get?.("hud", {});
        return value && typeof value === "object" ? value : {};
    }

    function savePreferences(next) {
        return Aethra.SettingsManager?.set?.("hud", next, {
            source: "hud-preferences"
        });
    }

    function getResponsiveProfile(width = window.innerWidth, height = window.innerHeight) {
        const safeWidth = Math.max(0, Number(width) || 0);
        const safeHeight = Math.max(0, Number(height) || 0);
        const aspectRatio = safeHeight > 0 ? safeWidth / safeHeight : 1;

        if (safeWidth < 1180 || safeHeight < 680) return "narrow";
        if (safeWidth <= 1440 || safeHeight <= 820) return "compact";
        if (aspectRatio >= 2.15) return "ultrawide";
        if (safeWidth >= 2200 && safeHeight >= 1100) return "wide";
        return "standard";
    }

    function syncResponsiveProfile() {
        const viewport = window.visualViewport;
        const width = Math.round(viewport?.width || window.innerWidth || 0);
        const height = Math.round(viewport?.height || window.innerHeight || 0);
        const profile = getResponsiveProfile(width, height);
        const previous = document.body.dataset.hudViewport || "";

        document.documentElement.dataset.hudViewport = profile;
        document.body.dataset.hudViewport = profile;
        document.body.style.setProperty("--hud-viewport-width", `${width}px`);
        document.body.style.setProperty("--hud-viewport-height", `${height}px`);

        if (profile !== previous) {
            Aethra.EventBus.emit("hud:viewport-changed", {
                profile,
                previous: previous || null,
                width,
                height
            });
        }
        return { profile, width, height };
    }

    function scheduleResponsiveProfile() {
        if (responsiveFrame) cancelAnimationFrame(responsiveFrame);
        responsiveFrame = requestAnimationFrame(() => {
            responsiveFrame = 0;
            syncResponsiveProfile();
        });
    }

    function bindResponsiveProfile() {
        if (responsiveListenersBound) return;
        responsiveListenersBound = true;
        window.addEventListener("resize", scheduleResponsiveProfile, { passive: true });
        window.visualViewport?.addEventListener?.("resize", scheduleResponsiveProfile, { passive: true });
    }

    function applyPreferences() {
        const preferences = getPreferences();
        document.body.classList.toggle("aethra-hud-compact", Boolean(preferences.compact));
        document.body.classList.toggle("aethra-reduce-motion", Boolean(preferences.reduceMotion));

        const compact = document.querySelector("[data-hud-compact]");
        const reduceMotion = document.querySelector("[data-hud-reduce-motion]");
        if (compact) compact.checked = Boolean(preferences.compact);
        if (reduceMotion) reduceMotion.checked = Boolean(preferences.reduceMotion);
    }

    function bindPreferences() {
        document.querySelectorAll("[data-hud-compact], [data-hud-reduce-motion]")
            .forEach((input) => {
                if (input.dataset.hudPreferenceBound === "true") return;
                input.dataset.hudPreferenceBound = "true";
                input.addEventListener("change", () => {
                    const preferences = getPreferences();
                    preferences.compact = Boolean(document.querySelector("[data-hud-compact]")?.checked);
                    preferences.reduceMotion = Boolean(document.querySelector("[data-hud-reduce-motion]")?.checked);
                    savePreferences(preferences);
                    applyPreferences();
                    Aethra.EventBus.emit("hud:preferences-changed", { ...preferences });
                });
            });
    }

    function setMoreMenu(open) {
        const root = document.querySelector("[data-hud-more]");
        const toggle = root?.querySelector("[data-hud-more-toggle]");
        const menu = root?.querySelector("[data-hud-more-menu]");
        if (!root || !toggle || !menu) return false;

        root.classList.toggle("is-open", Boolean(open));
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        menu.hidden = !open;
        return true;
    }

    function bindMoreMenu() {
        const root = document.querySelector("[data-hud-more]");
        const toggle = root?.querySelector("[data-hud-more-toggle]");
        if (!root || !toggle || root.dataset.bound === "true") return;
        root.dataset.bound = "true";

        toggle.addEventListener("click", (event) => {
            event.stopPropagation();
            setMoreMenu(toggle.getAttribute("aria-expanded") !== "true");
        });
        root.querySelector("[data-hud-more-menu]")?.addEventListener("click", (event) => {
            const control = event.target.closest("[data-open-window]");
            const windowId = control?.dataset.openWindow;
            if (windowId) {
                event.preventDefault();
                Aethra.WindowManager?.openWindow?.(windowId, {
                    source: "hud-more-menu"
                });
            }
            setMoreMenu(false);
        });
        document.addEventListener("click", (event) => {
            if (!event.target.closest("[data-hud-more]")) setMoreMenu(false);
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") setMoreMenu(false);
        });
    }

    function applyCommerceFilter(gridId) {
        const grid = document.getElementById(gridId);
        if (!grid) return 0;
        const search = document.querySelector(`[data-commerce-search="${gridId}"]`);
        const category = document.querySelector(`[data-commerce-category="${gridId}"]`);
        const term = String(search?.value || "").trim().toLocaleLowerCase("pt-BR");
        const selectedCategory = category?.value || "all";
        let visible = 0;

        grid.querySelectorAll(":scope > .aethra-shop-card").forEach((card) => {
            const text = String(card.textContent || "").toLocaleLowerCase("pt-BR");
            const categoryMatches = selectedCategory === "all" || text.includes(selectedCategory);
            const matches = (!term || text.includes(term)) && categoryMatches;
            card.hidden = !matches;
            if (matches) visible += 1;
        });

        const count = document.querySelector(`[data-commerce-count="${gridId}"]`);
        if (count) {
            const label = gridId === "player-market-grid" ? "oferta" : "item";
            count.textContent = `${visible} ${label}${visible === 1 ? "" : "s"}`;
        }
        return visible;
    }

    function bindCommerceFilters() {
        document.querySelectorAll("[data-commerce-search], [data-commerce-category]")
            .forEach((control) => {
                if (control.dataset.commerceBound === "true") return;
                control.dataset.commerceBound = "true";
                const gridId = control.dataset.commerceSearch || control.dataset.commerceCategory;
                control.addEventListener(control.matches("select") ? "change" : "input", () => {
                    applyCommerceFilter(gridId);
                });
            });
    }

    function eligibleMarketItems() {
        return (Aethra.GameState.hero?.bag || []).filter((item) => {
            return item && !item.bound && !item.noPlayerMarket &&
                !item.market?.noPlayerMarket && !item.market?.premium;
        });
    }

    function sellerId() {
        const hero = Aethra.GameState.hero || {};
        return hero.id || hero.name || "local-player";
    }

    function setMarketTab(tabName) {
        const selected = ["buy", "sell", "history"].includes(tabName) ? tabName : "buy";
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.marketTab = selected;
        document.querySelectorAll("[data-market-tab]").forEach((button) => {
            const active = button.dataset.marketTab === selected;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-selected", active ? "true" : "false");
        });
        document.querySelectorAll("[data-market-panel]").forEach((panel) => {
            panel.hidden = panel.dataset.marketPanel !== selected;
        });
    }

    function renderMarketWorkspace() {
        const system = Aethra.MarketplaceSystem;
        const state = system?.getMarketState?.();
        if (!state) return false;

        const active = (state.listings || []).filter((listing) => listing.status === "active");
        const owner = sellerId();
        const balance = Number(state.sellerBalances?.[owner] || 0);
        const hero = Aethra.GameState.hero || {};
        const listingCount = document.querySelector("[data-market-listing-count]");
        const gold = document.querySelector("[data-market-gold]");
        if (listingCount) listingCount.textContent = `${active.length} oferta${active.length === 1 ? "" : "s"} ativa${active.length === 1 ? "" : "s"}`;
        if (gold) gold.textContent = `${fmt(hero.gold)} G`;

        const sellRoot = document.getElementById("market-sell-workspace");
        const items = eligibleMarketItems();
        if (sellRoot) {
            sellRoot.innerHTML = `
                <div class="market-sell-layout">
                    <div class="market-sell-form">
                        <div><small>NOVO ANÚNCIO</small><h3>Colocar item à venda</h3><p>A taxa de 5% é descontada somente quando o item for vendido.</p></div>
                        <label><span>Item da mochila</span><select data-market-sell-item ${items.length ? "" : "disabled"}>
                            ${items.length
                                ? items.map((item) => `<option value="${esc(item.instanceId || item.id || item.templateId)}" data-base-price="${Number(item.price || item.value || 1)}">${esc(item.name || item.templateId || item.id)} · ${fmt(item.quantity || 1)} un.</option>`).join("")
                                : '<option value="">Nenhum item negociável</option>'}
                        </select></label>
                        <label><span>Preço total em Gold</span><input type="number" min="1" step="1" value="1" data-market-sell-price ${items.length ? "" : "disabled"}></label>
                        <div class="market-sale-projection" data-market-sale-projection>Você recebe 1 G após a taxa.</div>
                        <button type="button" data-market-publish ${items.length ? "" : "disabled"}>Publicar oferta</button>
                    </div>
                    <aside><small>REGRAS DO MERCADO</small><strong>Venda segura</strong><ul><li>Itens vinculados e premium não podem ser anunciados.</li><li>O item sai da mochila enquanto a oferta estiver ativa.</li><li>Você pode cancelar suas próprias ofertas.</li></ul></aside>
                </div>`;

            const select = sellRoot.querySelector("[data-market-sell-item]");
            const price = sellRoot.querySelector("[data-market-sell-price]");
            const projection = sellRoot.querySelector("[data-market-sale-projection]");
            const updateProjection = (preferBase = false) => {
                const basePrice = Number(select?.selectedOptions?.[0]?.dataset.basePrice || 1);
                if (preferBase && price) price.value = String(Math.max(1, basePrice));
                const total = Math.max(1, Math.floor(Number(price?.value || 1)));
                const net = Math.max(0, total - Math.floor(total * 0.05));
                if (projection) projection.textContent = `Preço ${fmt(total)} G · você recebe ${fmt(net)} G após a taxa.`;
            };
            select?.addEventListener("change", () => updateProjection(true));
            price?.addEventListener("input", () => updateProjection(false));
            updateProjection(true);

            sellRoot.querySelector("[data-market-publish]")?.addEventListener("click", () => {
                const itemId = select?.value;
                const listingPrice = Math.max(1, Math.floor(Number(price?.value || 0)));
                const result = system.listForSale?.(itemId, listingPrice);
                if (!result) {
                    Aethra.UI_Renderer?.notify?.("Não foi possível publicar esta oferta.", "error");
                    return;
                }
                Aethra.UI_Renderer?.notify?.("Oferta publicada no mercado local.", "success");
                Aethra.UI_Renderer?.renderGrid?.("player-market-grid", system.getActiveListings?.() || [], "market");
                renderMarketWorkspace();
                setMarketTab("buy");
            });
        }

        const historyRoot = document.getElementById("market-history-workspace");
        if (historyRoot) {
            const ownedActive = active.filter((listing) => listing.sellerId === owner);
            const history = (state.history || []).slice().reverse();
            historyRoot.innerHTML = `
                <div class="market-balance-card">
                    <div><small>SALDO A RECEBER</small><strong>${fmt(balance)} G</strong><span>Vendas concluídas nesta sessão local</span></div>
                    <button type="button" data-market-claim ${balance > 0 ? "" : "disabled"}>Resgatar saldo</button>
                </div>
                <section class="market-history-section"><header><strong>Seus anúncios ativos</strong><span>${ownedActive.length}</span></header>
                    ${ownedActive.length ? ownedActive.map((listing) => `<article><div><small>ATIVO</small><strong>${esc(listing.item?.name || "Item")}</strong><span>${fmt(listing.price)} G</span></div><button type="button" data-market-cancel="${esc(listing.listingId)}">Cancelar</button></article>`).join("") : '<p class="commerce-empty">Você não possui anúncios ativos.</p>'}
                </section>
                <section class="market-history-section"><header><strong>Histórico recente</strong><span>${history.length}</span></header>
                    ${history.length ? history.slice(0, 12).map((listing) => `<article><div><small>${esc(String(listing.status || "finalizado").toUpperCase())}</small><strong>${esc(listing.item?.name || "Item")}</strong><span>${fmt(listing.price)} G · ${esc(listing.sellerName || "Jogador")}</span></div></article>`).join("") : '<p class="commerce-empty">Nenhuma transação foi concluída ainda.</p>'}
                </section>`;

            historyRoot.querySelector("[data-market-claim]")?.addEventListener("click", () => {
                if (system.claimSellerBalance?.()) renderMarketWorkspace();
            });
            historyRoot.querySelectorAll("[data-market-cancel]").forEach((button) => {
                button.addEventListener("click", () => {
                    if (!system.cancelListing?.(button.dataset.marketCancel)) return;
                    Aethra.UI_Renderer?.renderGrid?.("player-market-grid", system.getActiveListings?.() || [], "market");
                    renderMarketWorkspace();
                });
            });
        }

        setMarketTab(Aethra.GameState.ui?.marketTab || "buy");
        requestAnimationFrame(() => applyCommerceFilter("player-market-grid"));
        return true;
    }

    function bindMarketTabs() {
        document.querySelectorAll("[data-market-tab]").forEach((button) => {
            if (button.dataset.marketTabBound === "true") return;
            button.dataset.marketTabBound = "true";
            button.addEventListener("click", () => setMarketTab(button.dataset.marketTab));
        });
    }

    function updateCommerceBalances() {
        const hero = Aethra.GameState.hero || {};
        document.querySelectorAll("[data-premium-balance]").forEach((node) => {
            node.textContent = fmt(hero.diamonds);
        });
        updateCityStatus();
        requestAnimationFrame(() => {
            applyCommerceFilter("premium-shop-grid");
            applyCommerceFilter("player-market-grid");
        });
    }

    function updateCityStatus() {
        const hero = Aethra.GameState.hero || {};
        const bag = Array.isArray(hero.bag) ? hero.bag : [];
        const capacity = Math.max(bag.length, Number(hero.bagCapacity || 40));
        document.querySelectorAll("[data-city-gold]").forEach((node) => {
            node.textContent = `${fmt(hero.gold)} G`;
        });
        document.querySelectorAll("[data-city-bag]").forEach((node) => {
            node.textContent = `${bag.length} / ${capacity}`;
        });
    }

    function ensureInventoryTools() {
        const panel = document.querySelector("#inventory-view .inventory-backpack-panel");
        const header = panel?.querySelector(".inventory-panel-header");
        if (!panel || !header || panel.querySelector("[data-full-inventory-tools]")) return;
        const tools = document.createElement("div");
        tools.className = "full-inventory-tools";
        tools.dataset.fullInventoryTools = "";
        tools.innerHTML = `
            <label><span aria-hidden="true">⌕</span><input type="search" data-full-inventory-search placeholder="Buscar na mochila" aria-label="Buscar item na mochila"></label>
            <select data-full-inventory-filter aria-label="Filtrar inventário"><option value="all">Todos</option><option value="equipment">Equipamentos</option><option value="consumable">Consumíveis</option><option value="material">Materiais e loot</option></select>`;
        header.insertAdjacentElement("afterend", tools);

        const filter = () => {
            const term = String(tools.querySelector("[data-full-inventory-search]")?.value || "").trim().toLocaleLowerCase("pt-BR");
            const type = tools.querySelector("[data-full-inventory-filter]")?.value || "all";
            document.querySelectorAll("#inventory-grid .tibia-item-slot").forEach((card) => {
                const text = String(card.textContent || "").toLocaleLowerCase("pt-BR");
                const itemType = String(card.dataset.itemType || text).toLocaleLowerCase("pt-BR");
                const typeMatches = type === "all" ||
                    (type === "equipment" && (itemType.includes("arma") || itemType.includes("armor") || itemType.includes("equip"))) ||
                    (type === "consumable" && (itemType.includes("poção") || itemType.includes("potion") || itemType.includes("consum"))) ||
                    (type === "material" && !itemType.includes("poção") && !itemType.includes("potion"));
                card.hidden = Boolean(term && !text.includes(term)) || !typeMatches;
            });
        };
        tools.querySelector("input")?.addEventListener("input", filter);
        tools.querySelector("select")?.addEventListener("change", filter);
    }

    function syncStageButtons() {
        const mode = Aethra.SettingsManager?.getBattleMode?.() || "cards";
        document.querySelectorAll("[data-set-stage-mode]").forEach((button) => {
            const active = button.dataset.setStageMode === mode;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        });
    }

    function refresh() {
        syncResponsiveProfile();
        bindMoreMenu();
        bindPreferences();
        bindCommerceFilters();
        bindMarketTabs();
        ensureInventoryTools();
        applyPreferences();
        updateCommerceBalances();
        syncStageButtons();
        renderMarketWorkspace();
    }

    function init() {
        if (Aethra.HudModernization?.initialized) {
            refresh();
            return;
        }

        Aethra.HudModernization = {
            initialized: true,
            refresh,
            renderMarketWorkspace,
            setMarketTab,
            applyCommerceFilter,
            getPreferences,
            getResponsiveProfile,
            syncResponsiveProfile
        };

        bindResponsiveProfile();
        refresh();
        Aethra.EventBus.emit("hud:modernization-ready", {
            exclusiveWindows: Aethra.WindowManager?.config?.exclusive === true,
            equipmentSlots: Aethra.EquipSystem?.validSlots?.length || 0
        });
    }

    document.addEventListener("click", (event) => {
        if (event.target.closest("[data-open-window]")) setMoreMenu(false);
    });

    [
        "EngineReady",
        "render:battle-mode-ready",
        "render:inventory",
        "render:equipment",
        "settings:battle-mode-changed",
        "currency:changed",
        "window:opened"
    ].forEach((eventName) => Aethra.EventBus.on(eventName, () => requestAnimationFrame(refresh)));
    marketEvents.forEach((eventName) => Aethra.EventBus.on(eventName, () => requestAnimationFrame(() => {
        renderMarketWorkspace();
        updateCommerceBalances();
    })));

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})(window.Aethra);
