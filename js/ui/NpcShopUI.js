// NpcShopUI.js — Loja do Mercador NPC (UI completa)
(function initNpcShopUI(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    // ─── helpers ────────────────────────────────────────────────────────────
    const esc = (v) => String(v ?? "")
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;");

    const fmt = (v) =>
        new Intl.NumberFormat("pt-BR").format(Math.floor(Number(v) || 0));

    const gold = () =>
        Math.max(0, Math.floor(Number(
            Aethra.GameState?.hero?.gold ?? Aethra.GameState?.hero?.stats?.gold ?? 0
        )));

    // ─── NPC shop catalog ────────────────────────────────────────────────────
    // Builds a structured list from EarlyGameItemCatalog for hero's current level
    const CATEGORIES = [
        { id: "all",       label: "Todos",       icon: "⊞" },
        { id: "weapon",    label: "Armas",        icon: "⚔" },
        { id: "armor",     label: "Armaduras",    icon: "▣" },
        { id: "shield",    label: "Escudos",      icon: "⬡" },
        { id: "accessory", label: "Acessórios",   icon: "○" },
        { id: "consumable",label: "Consumíveis",  icon: "⚡" },
    ];

    // Extra consumables not in the level-loop
    const EXTRA_SHOP_ITEMS = [
        {
            id: "minor_health_potion",
            name: "Poção de Vida Menor", icon: "🧪",
            type: "consumable", price: 15,
            healAmount: 25,
            description: "Recupera 25 de HP. Útil nas primeiras caçadas.",
            rarity: "Comum"
        },
        {
            id: "minor_mana_potion",
            name: "Poção de Mana Menor", icon: "💧",
            type: "consumable", price: 18,
            manaAmount: 20,
            description: "Restaura 20 de Mana. Essencial para arcanistas.",
            rarity: "Comum"
        },
        {
            id: "minor_vigor_tonic",
            name: "Tônico de Vigor", icon: "⚡",
            type: "consumable", price: 12,
            energyAmount: 18,
            description: "Recupera 18 de Vigor.",
            rarity: "Comum"
        }
    ];

    function getShopCatalog(heroLevel = 1) {
        const lvl = Math.max(1, Math.min(10, Math.floor(heroLevel)));
        const items = [];

        // Weapons and armor for hero level and one level below (for accessibility)
        for (let l = Math.max(1, lvl - 1); l <= lvl; l++) {
            // One weapon per family
            ["sword", "axe", "mace", "dagger", "bow", "focus"].forEach((family) => {
                const id = `eg_${family}_l${l}`;
                const tpl = Aethra.GameData?.items?.[id];
                if (tpl) items.push({ ...tpl, id, shopLevel: l });
            });

            // Chest pieces (one per armor class)
            ["cloth", "leather", "plate"].forEach((cls) => {
                const id = `eg_chest_${cls}_l${l}`;
                const tpl = Aethra.GameData?.items?.[id];
                if (tpl) items.push({ ...tpl, id, shopLevel: l });
            });

            // Shield
            const shieldId = `eg_shield_l${l}`;
            const shield = Aethra.GameData?.items?.[shieldId];
            if (shield) items.push({ ...shield, id: shieldId, shopLevel: l });

            // Ring
            const ringId = `eg_ring_l${l}`;
            const ring = Aethra.GameData?.items?.[ringId];
            if (ring) items.push({ ...ring, id: ringId, shopLevel: l });
        }

        // Register and add consumables
        EXTRA_SHOP_ITEMS.forEach((item) => {
            if (!Aethra.GameData?.items?.[item.id]) {
                Aethra.GameData?.registerItem?.(item.id, item);
            }
            items.push({ ...item, shopLevel: 1 });
        });

        return items;
    }

    // ─── sell list ───────────────────────────────────────────────────────────
    function getSellableItems() {
        const bag = Aethra.GameState?.hero?.bag || [];
        return bag
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => {
                if (!item) return false;
                const origin = item.market?.purchaseOrigin || item.source || "";
                const isLoot = ["loot", "enemy-drop", "hunt-loot"].includes(origin) ||
                    item.type === "loot" || item.type === "material";
                const isSellBack = origin === "npc-shop" && item.market?.sellBackEligible;
                return isLoot || isSellBack;
            });
    }

    function getSalePrice(item) {
        if (!item) return 0;
        const origin = item.market?.purchaseOrigin || item.source || "";
        if (origin === "npc-shop" && item.market?.sellBackEligible) {
            const buyPrice = item.market?.purchasePrice || item.price || item.value || 0;
            const rate = item.market?.sellBackRate ?? 0.5;
            return Math.floor(buyPrice * rate);
        }
        return Math.floor(Number(item.price || item.value || 0));
    }

    // ─── render helpers ──────────────────────────────────────────────────────
    function statLine(item) {
        const s = item.stats || item.baseStats || {};
        const parts = [];
        if (s.damageMin != null) parts.push(`Dano: ${s.damageMin}–${s.damageMax}`);
        if (s.defense)  parts.push(`DEF +${s.defense}`);
        if (s.mag)      parts.push(`Magia +${s.mag}`);
        if (s.hpMax)    parts.push(`HP +${s.hpMax}`);
        if (s.blockChance) parts.push(`Bloqueio ${(s.blockChance * 100).toFixed(0)}%`);
        if (s.critical) parts.push(`Crit +${(s.critical * 100).toFixed(1)}%`);
        return parts.slice(0, 2).join(" · ") || item.description?.slice(0, 40) || "";
    }

    function rarityColor(rarity) {
        const map = { "Incomum": "#72d898", "Raro": "#7a9ae8", "Épico": "#c888e8", "Lendário": "#e8a840" };
        return map[rarity] || "#8fa8b4";
    }

    function itemCardHTML(item, canAfford) {
        const price = Math.floor(Number(item.price || item.value || 0));
        const affordable = canAfford >= price;
        const rarity = item.rarity || "Comum";
        return `
        <div class="shop-item-card" data-rarity="${esc(rarity)}"
             data-ui-tooltip="true" data-tooltip-kind="hud"
             data-tooltip-eyebrow="${esc((item.type || "item").toUpperCase())}"
             data-tooltip-title="${esc(item.name)}"
             data-tooltip-body="${esc(item.description || statLine(item))}"
             data-tooltip-effect="${esc(statLine(item))}">
            <div class="shop-item-card__icon">${esc(item.icon || "?")}</div>
            <div class="shop-item-card__name">${esc(item.name)}</div>
            <div class="shop-item-card__meta">${esc(statLine(item))}</div>
            <div class="shop-item-card__footer">
                <span class="shop-price">
                    <span>🪙</span>${fmt(price)}
                </span>
                <button type="button" class="shop-buy-btn"
                    data-shop-buy="${esc(item.id)}"
                    data-price="${price}"
                    ${affordable ? "" : "disabled"}
                    title="${affordable ? `Comprar ${item.name}` : "Ouro insuficiente"}"
                >${affordable ? "Comprar" : "Sem ouro"}</button>
            </div>
        </div>`;
    }

    function sellItemHTML({ item, index }) {
        const price = getSalePrice(item);
        const origin = item.market?.purchaseOrigin || item.source || "loot";
        const sourceLabel = origin === "npc-shop" ? "Comprado · devolução 50%" : "Drop de caçada";
        return `
        <div class="shop-sell-item" data-sell-index="${index}">
            <div class="shop-sell-item__icon">${esc(item.icon || "?")}</div>
            <div>
                <div class="shop-sell-item__name">${esc(item.name || item.id)}</div>
                <span class="shop-sell-item__source">${esc(sourceLabel)}</span>
            </div>
            <span class="shop-sell-item__price">🪙 ${fmt(price)}</span>
            <button type="button" class="shop-sell-btn"
                data-shop-sell="${esc(item.instanceId || item.id)}"
                data-sell-price="${price}">Vender</button>
        </div>`;
    }

    // ─── main render ─────────────────────────────────────────────────────────
    let activeTab = "buy";
    let activeCategory = "all";

    function render() {
        const win = document.getElementById("npc-shop-view");
        if (!win) return;

        const heroLevel = Aethra.GameState?.hero?.level || 1;
        const currentGold = gold();
        const catalog = getShopCatalog(heroLevel);
        const sellList = getSellableItems();
        const totalSellValue = sellList.reduce((sum, { item }) => sum + getSalePrice(item), 0);
        const lootCount = sellList.filter(({ item }) =>
            (item.market?.purchaseOrigin || item.source || "") !== "npc-shop").length;

        // Filter catalog by category
        const filtered = activeCategory === "all"
            ? catalog
            : catalog.filter((item) => item.type === activeCategory ||
                (activeCategory === "armor" && item.slot && !["weapon","offhand","ring1","ring2"].includes(item.slot) && item.type === "armor") ||
                (activeCategory === "shield" && item.type === "shield") ||
                (activeCategory === "accessory" && (item.type === "accessory" || item.slot?.startsWith("ring"))) ||
                (activeCategory === "consumable" && item.type === "consumable"));

        win.innerHTML = `
        <div class="shop-header">
            <div class="shop-header__merchant">
                <div class="shop-header__avatar">🧙</div>
                <div class="shop-header__info">
                    <small>Mercador NPC</small>
                    <strong>Velho Varian</strong>
                </div>
            </div>
            <div></div>
            <div class="shop-header__wallet">
                <div class="shop-wallet-badge">
                    <span>🪙 Ouro</span>
                    <strong id="shop-gold-display">${fmt(currentGold)}</strong>
                </div>
                <button type="button" class="window-close" data-close-window="npc-shop-view" aria-label="Fechar loja">×</button>
            </div>
        </div>

        <div class="shop-tabs">
            <button type="button" class="shop-tab ${activeTab === "buy" ? "is-active" : ""}" data-shop-tab="buy">
                🛒 Comprar <span class="shop-tab__count">${catalog.length}</span>
            </button>
            <button type="button" class="shop-tab ${activeTab === "sell" ? "is-active" : ""}" data-shop-tab="sell">
                💰 Vender <span class="shop-tab__count">${sellList.length}</span>
            </button>
        </div>

        <!-- BUY PANEL -->
        <div class="shop-panel ${activeTab === "buy" ? "is-active" : ""}">
            <div class="shop-category-tabs">
                ${CATEGORIES.map((cat) => `
                    <button type="button" class="shop-cat-btn ${activeCategory === cat.id ? "is-active" : ""}"
                        data-shop-category="${cat.id}">
                        ${cat.icon} ${cat.label}
                    </button>
                `).join("")}
            </div>
            <div class="shop-item-grid">
                ${filtered.length
                    ? filtered.map((item) => itemCardHTML(item, currentGold)).join("")
                    : `<div class="shop-empty"><span>📦</span>Nenhum item nesta categoria.</div>`
                }
            </div>
        </div>

        <!-- SELL PANEL -->
        <div class="shop-panel ${activeTab === "sell" ? "is-active" : ""}">
            <div class="shop-sell-header">
                <small>Itens elegíveis para venda (${sellList.length})</small>
                <button type="button" class="shop-sell-all-btn" data-shop-sell-all
                    ${lootCount === 0 ? "disabled" : ""}
                    title="Vender todos os drops de caçada">
                    🗑 Vender Todo Loot ${lootCount > 0 ? `(🪙 ${fmt(totalSellValue)})` : ""}
                </button>
            </div>
            <div class="shop-sell-list">
                ${sellList.length
                    ? sellList.map((entry) => sellItemHTML(entry)).join("")
                    : `<div class="shop-empty"><span>🎒</span>Nenhum item para vender.<br>Faça uma caçada e volte com o loot!</div>`
                }
            </div>
        </div>

        <div class="shop-toast" id="shop-toast"></div>`;

        bindEvents(win);
        if (Aethra.TooltipManager?.refresh) Aethra.TooltipManager.refresh();
    }

    // ─── toast ───────────────────────────────────────────────────────────────
    let toastTimer = null;
    function showToast(msg, isError = false) {
        const el = document.getElementById("shop-toast");
        if (!el) return;
        el.textContent = msg;
        el.classList.toggle("is-error", isError);
        el.classList.add("is-visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2200);
    }

    // ─── event binding ───────────────────────────────────────────────────────
    function bindEvents(win) {
        // Tab switch
        win.querySelectorAll("[data-shop-tab]").forEach((btn) => {
            btn.addEventListener("click", () => {
                activeTab = btn.dataset.shopTab;
                render();
            });
        });

        // Category filter
        win.querySelectorAll("[data-shop-category]").forEach((btn) => {
            btn.addEventListener("click", () => {
                activeCategory = btn.dataset.shopCategory;
                render();
            });
        });

        // Buy
        win.querySelectorAll("[data-shop-buy]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const itemId = btn.dataset.shopBuy;
                const result = Aethra.MarketplaceSystem?.buyItem?.(itemId, 1);
                if (!result || result.error) {
                    showToast(result?.reason === "insufficient-gold"
                        ? "Ouro insuficiente!"
                        : "Não foi possível comprar.", true);
                } else {
                    const item = Aethra.GameData?.items?.[itemId];
                    showToast(`✓ ${item?.name || itemId} adquirido!`);
                    render();
                }
            });
        });

        // Sell single
        win.querySelectorAll("[data-shop-sell]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const instanceId = btn.dataset.shopSell;
                let result = Aethra.MarketplaceSystem?.sellLoot?.(instanceId);
                if (!result || result.error) {
                    result = Aethra.MarketplaceSystem?.sellBack?.(instanceId);
                }
                if (!result || result.error) {
                    showToast("Não foi possível vender este item.", true);
                } else {
                    showToast(`🪙 +${fmt(result.salePrice)} recebido!`);
                    render();
                }
            });
        });

        // Sell all loot
        const sellAllBtn = win.querySelector("[data-shop-sell-all]");
        if (sellAllBtn) {
            sellAllBtn.addEventListener("click", () => {
                const loot = getSellableItems().filter(({ item }) =>
                    (item.market?.purchaseOrigin || item.source || "") !== "npc-shop");
                if (!loot.length) return;
                let total = 0;
                loot.forEach(({ item }) => {
                    const r = Aethra.MarketplaceSystem?.sellLoot?.(
                        item.instanceId || item.id
                    );
                    if (r && !r.error) total += r.salePrice || 0;
                });
                showToast(`🪙 +${fmt(total)} — ${loot.length} iten(s) vendido(s)!`);
                render();
            });
        }
    }

    // ─── reactive updates ────────────────────────────────────────────────────
    function onCurrencyChange() {
        const display = document.getElementById("shop-gold-display");
        if (display) display.textContent = fmt(gold());
        // Refresh buy button states without full re-render
        const win = document.getElementById("npc-shop-view");
        if (!win || win.classList.contains("hidden")) return;
        const g = gold();
        win.querySelectorAll("[data-shop-buy]").forEach((btn) => {
            const price = Number(btn.dataset.price || 0);
            btn.disabled = g < price;
            btn.textContent = g >= price ? "Comprar" : "Sem ouro";
        });
    }

    function onInventoryChange() {
        const win = document.getElementById("npc-shop-view");
        if (win && !win.classList.contains("hidden") && activeTab === "sell") render();
    }

    Aethra.EventBus.on("goldChanged", onCurrencyChange);
    Aethra.EventBus.on("market:currency-changed", onCurrencyChange);
    Aethra.EventBus.on("inventory:changed", onInventoryChange);
    Aethra.EventBus.on("inventory:item-added", onInventoryChange);
    Aethra.EventBus.on("inventory:item-removed", onInventoryChange);

    // Re-render when window is opened
    Aethra.EventBus.on("window:opened", (data) => {
        if (data?.id === "npc-shop-view") {
            activeTab = "buy";
            activeCategory = "all";
            render();
        }
    });

    // Public API
    Aethra.NpcShopUI = { render };

})(window.Aethra = window.Aethra || {});
