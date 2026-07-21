// NpcShopUI.js — Loja NPC integrada ao catálogo, inventário e economia oficiais.
(function initNpcShopUI(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const esc = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    const fmt = (value) => new Intl.NumberFormat("pt-BR").format(Math.floor(Number(value) || 0));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const CATEGORIES = [
        ["all", "Todos"],
        ["consumable", "Poções"],
        ["weapon", "Armas"],
        ["armor", "Armaduras"],
        ["shield", "Escudos"],
        ["accessory", "Acessórios"]
    ];
    const ICONS = {
        consumable: "◉", weapon: "⚔", armor: "▣", shield: "⬡",
        accessory: "○", material: "◆", loot: "◇"
    };

    let activeTab = "buy";
    let activeCategory = "all";
    let notice = null;
    let noticeTimer = null;

    function hero() {
        return Aethra.GameState?.hero || {};
    }

    function gold() {
        return Math.max(0, Math.floor(Number(hero().gold) || 0));
    }

    function template(itemId) {
        return Aethra.GameData?.getItem?.(itemId) || Aethra.GameData?.items?.[itemId] || null;
    }

    function categoryOf(item = {}) {
        const type = String(item.type || item.itemType || "").toLowerCase();
        if (type === "accessory" || String(item.slot || "").startsWith("ring")) return "accessory";
        if (type === "shield" || item.slot === "offhand") return "shield";
        return type || "misc";
    }

    function iconOf(item = {}) {
        if (item.icon && !String(item.icon).includes(".")) return item.icon;
        const familyIcons = { sword: "⚔", axe: "◩", mace: "✣", dagger: "†", bow: "➶", focus: "✦" };
        return familyIcons[item.weaponFamily] || ICONS[categoryOf(item)] || "◆";
    }

    function statLine(item = {}) {
        const stats = item.baseStats || item.stats || item;
        const parts = [];
        const min = Number(stats.damageMin ?? item.damageMin);
        const max = Number(stats.damageMax ?? item.damageMax);
        if (Number.isFinite(min) && Number.isFinite(max) && (min || max)) parts.push(`Dano ${min}–${max}`);
        if (Number(stats.defense)) parts.push(`Defesa +${fmt(stats.defense)}`);
        if (Number(stats.hpMax)) parts.push(`HP +${fmt(stats.hpMax)}`);
        if (Number(stats.manaMax)) parts.push(`Mana +${fmt(stats.manaMax)}`);
        if (Number(stats.precision)) parts.push(`Precisão +${fmt(stats.precision)}`);
        if (Number(stats.blockChance)) parts.push(`Bloqueio ${(Number(stats.blockChance) * 100).toFixed(1)}%`);
        if (Number(item.healAmount)) parts.push(`Recupera ${fmt(item.healAmount)} HP`);
        if (Number(item.manaAmount)) parts.push(`Recupera ${fmt(item.manaAmount)} Mana`);
        if (Number(item.energyAmount)) parts.push(`Recupera ${fmt(item.energyAmount)} Vigor`);
        return parts.join(" · ") || item.description || "Item comercializado pelo mercador.";
    }

    function getShopCatalog(heroLevel = hero().level) {
        const level = clamp(Math.floor(Number(heroLevel) || 1), 1, 10);
        const levels = [...new Set([Math.max(1, level - 1), level])];
        const ids = ["potion_health", "potion_mana", "minor_vigor_tonic", "field_antidote"];
        levels.forEach((currentLevel) => {
            ["sword", "axe", "mace", "dagger", "bow", "focus"].forEach((family) => {
                ids.push(`eg_${family}_l${currentLevel}`);
            });
            ["head", "chest", "hands", "legs", "feet"].forEach((slot) => {
                ["cloth", "leather", "plate"].forEach((armorClass) => {
                    ids.push(`eg_${slot}_${armorClass}_l${currentLevel}`);
                });
            });
            ids.push(`eg_shield_l${currentLevel}`, `eg_ring_l${currentLevel}`);
        });

        return [...new Set(ids)].map((id) => template(id)).filter((item) => {
            return item && Math.floor(Number(item.price || item.value || 0)) > 0;
        }).map((item) => ({
            ...item,
            category: categoryOf(item),
            price: Math.floor(Number(item.price || item.value || 0))
        }));
    }

    function itemOrigin(item = {}) {
        return item.market?.purchaseOrigin || item.origin?.source || item.source || "unknown";
    }

    function saleMode(item = {}) {
        const origin = itemOrigin(item);
        if (origin === "npc-shop" && item.market?.sellBackEligible === true) return "sellback";
        if (["loot", "enemy-drop", "hunt-loot", "hunt-system", "monster-economy", "battle-hunt", "battle-loot"].includes(origin)) return "loot";
        if (["loot", "material"].includes(String(item.type || item.itemType || "").toLowerCase())) return "loot";
        return null;
    }

    function getSalePrice(item = {}, mode = saleMode(item)) {
        const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
        if (mode === "sellback") {
            const unit = Number(item.market?.purchasePrice || item.price || item.value || 0);
            const rate = Number(item.market?.sellBackRate ?? 0.5);
            return Math.max(0, Math.floor(unit * quantity * rate));
        }
        const itemTemplate = template(item.templateId || item.id);
        const unit = Number(item.price ?? item.value ?? itemTemplate?.price ?? itemTemplate?.value ?? 0);
        return Math.max(0, Math.floor(unit) * quantity);
    }

    function getSellableItems() {
        return (Array.isArray(hero().bag) ? hero().bag : []).map((item, index) => ({
            item,
            index,
            mode: saleMode(item)
        })).filter((entry) => entry.mode && getSalePrice(entry.item, entry.mode) > 0);
    }

    function setNotice(message, tone = "success") {
        notice = { message, tone };
        window.clearTimeout(noticeTimer);
        noticeTimer = window.setTimeout(() => {
            notice = null;
            const toast = document.querySelector("#npc-shop-view .npc-shop-toast");
            toast?.remove();
        }, 2600);
    }

    function itemCard(item) {
        const affordable = gold() >= item.price;
        const stackable = Boolean(item.stackable);
        return `
            <article class="shop-card" data-ui-tooltip="true" data-tooltip-kind="hud"
                data-tooltip-eyebrow="${esc(categoryOf(item).toUpperCase())} · NÍVEL ${fmt(item.levelReq || 1)}"
                data-tooltip-title="${esc(item.name)}" data-tooltip-body="${esc(item.description || statLine(item))}"
                data-tooltip-effect="${esc(statLine(item))}">
                <div class="shop-card__icon">${esc(iconOf(item))}</div>
                <div class="shop-card__info">
                    <strong>${esc(item.name)}</strong>
                    <small>${esc(statLine(item))}</small>
                    <div class="shop-card__price">● ${fmt(item.price)} Ouro</div>
                </div>
                <div class="shop-card__actions">
                    <button type="button" class="shop-buy-btn" data-buy-id="${esc(item.id)}" data-buy-qty="1"
                        ${affordable ? "" : "disabled"}>${affordable ? "Comprar" : "Sem ouro"}</button>
                    ${stackable ? `
                        <button type="button" class="shop-buy-btn is-bulk" data-buy-id="${esc(item.id)}" data-buy-qty="5"
                            ${gold() >= item.price * 5 ? "" : "disabled"}>+5</button>
                        <button type="button" class="shop-buy-btn is-bulk" data-buy-id="${esc(item.id)}" data-buy-qty="10"
                            ${gold() >= item.price * 10 ? "" : "disabled"}>+10</button>` : ""}
                </div>
            </article>`;
    }

    function sellRow({ item, mode }) {
        const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const sourceLabel = mode === "sellback" ? "Devolução ao mercador · 50%" : "Drop de caçada · valor integral";
        return `
            <article class="shop-sell-row" data-ui-tooltip="true" data-tooltip-kind="hud"
                data-tooltip-eyebrow="${esc(sourceLabel.toUpperCase())}" data-tooltip-title="${esc(item.name || item.id)}"
                data-tooltip-body="${esc(item.description || statLine(item))}" data-tooltip-effect="${esc(statLine(item))}">
                <span class="shop-sell-row__icon">${esc(iconOf(item))}</span>
                <div class="shop-sell-row__info">
                    <strong>${esc(item.name || item.id)}${quantity > 1 ? ` ×${quantity}` : ""}</strong>
                    <small>${esc(sourceLabel)}</small>
                </div>
                <span class="shop-sell-row__val">+${fmt(getSalePrice(item, mode))} G</span>
                <button type="button" class="shop-sell-btn" data-sell-id="${esc(item.instanceId || item.id)}" data-sell-mode="${mode}">Vender</button>
            </article>`;
    }

    function render() {
        const win = document.getElementById("npc-shop-view");
        if (!win) return false;
        const catalog = getShopCatalog();
        const filtered = activeCategory === "all"
            ? catalog
            : catalog.filter((item) => item.category === activeCategory);
        const sellable = getSellableItems();
        const loot = sellable.filter((entry) => entry.mode === "loot");
        const lootValue = loot.reduce((sum, entry) => sum + getSalePrice(entry.item, entry.mode), 0);

        win.innerHTML = `
            <div class="npc-shop-container">
                <header class="npc-shop-header">
                    <div class="npc-shop-brand"><span class="npc-shop-avatar">♜</span><div>
                        <h2>Velho Varian</h2><p>Suprimentos, equipamento regional e compra de espólios.</p>
                    </div></div>
                    <div class="npc-shop-header__right">
                        <div class="npc-shop-gold-badge"><small>SEU SALDO</small><strong>● ${fmt(gold())} Ouro</strong></div>
                        <button type="button" class="npc-shop-close-btn" data-close-window="npc-shop-view" aria-label="Fechar loja">×</button>
                    </div>
                </header>
                <nav class="npc-shop-tabs" aria-label="Seções da loja">
                    <button type="button" class="npc-shop-tab ${activeTab === "buy" ? "is-active" : ""}" data-npc-tab="buy">COMPRAR <small>${catalog.length}</small></button>
                    <button type="button" class="npc-shop-tab ${activeTab === "sell" ? "is-active" : ""}" data-npc-tab="sell">VENDER <small>${sellable.length}</small></button>
                </nav>
                ${activeTab === "buy" ? `
                    <div class="npc-shop-filters">
                        ${CATEGORIES.map(([id, label]) => `<button type="button" class="shop-filter-btn ${activeCategory === id ? "is-active" : ""}" data-shop-cat="${id}">${label}</button>`).join("")}
                    </div>
                    <div class="npc-shop-grid">
                        ${filtered.length ? filtered.map(itemCard).join("") : `<div class="npc-shop-empty-sell">Nenhum item disponível nesta categoria.</div>`}
                    </div>` : `
                    <div class="npc-shop-sell-container">
                        <div class="npc-shop-sell-hero-banner"><div><h3>Espólios negociáveis</h3>
                            <p>Itens vinculados e suprimentos iniciais ficam protegidos.</p></div>
                            <button type="button" class="npc-shop-sell-all-btn" data-sell-all ${loot.length ? "" : "disabled"}>
                                Vender ${loot.length} drop(s) · +${fmt(lootValue)} G
                            </button>
                        </div>
                        <div class="npc-shop-sell-list">
                            ${sellable.length ? sellable.map(sellRow).join("") : `<div class="npc-shop-empty-sell">Nenhum drop ou item comprado nesta loja está disponível para venda.</div>`}
                        </div>
                    </div>`}
                ${notice ? `<div class="npc-shop-toast is-${esc(notice.tone)}" role="status">${esc(notice.message)}</div>` : ""}
            </div>`;

        Aethra.TooltipManager?.refresh?.();
        return true;
    }

    function buy(itemId, quantity) {
        const item = template(itemId);
        const amount = Math.max(1, Math.floor(Number(quantity) || 1));
        const price = Number(item?.price || item?.value || 0) * amount;
        if (!item || price <= 0) setNotice("Este item não está disponível.", "error");
        else if (gold() < price) setNotice(`Faltam ${fmt(price - gold())} G para esta compra.`, "error");
        else {
            const result = Aethra.MarketplaceSystem?.buyItem?.(itemId, amount);
            setNotice(result ? `${item.name}${amount > 1 ? ` ×${amount}` : ""} adicionado à mochila.` : "A compra não pôde ser concluída.", result ? "success" : "error");
        }
        render();
    }

    function sell(itemId, mode) {
        const result = mode === "sellback"
            ? Aethra.MarketplaceSystem?.sellBack?.(itemId)
            : Aethra.MarketplaceSystem?.sellLoot?.(itemId);
        setNotice(result ? `Venda concluída: +${fmt(result.salePrice)} G.` : "Este item não pode ser vendido.", result ? "success" : "error");
        render();
        return result;
    }

    function sellAllLoot() {
        const entries = getSellableItems().filter((entry) => entry.mode === "loot");
        let total = 0;
        let sold = 0;
        entries.forEach(({ item }) => {
            const result = Aethra.MarketplaceSystem?.sellLoot?.(item.instanceId || item.id);
            if (result) {
                total += Number(result.salePrice || 0);
                sold += 1;
            }
        });
        setNotice(sold ? `${sold} drop(s) vendidos por ${fmt(total)} G.` : "Não há drops elegíveis para vender.", sold ? "success" : "error");
        render();
        return { sold, total };
    }

    document.addEventListener("click", (event) => {
        const tab = event.target.closest("#npc-shop-view [data-npc-tab]");
        if (tab) {
            activeTab = tab.dataset.npcTab;
            render();
            return;
        }
        const category = event.target.closest("#npc-shop-view [data-shop-cat]");
        if (category) {
            activeCategory = category.dataset.shopCat;
            render();
            return;
        }
        const buyButton = event.target.closest("#npc-shop-view [data-buy-id]");
        if (buyButton) {
            buy(buyButton.dataset.buyId, buyButton.dataset.buyQty);
            return;
        }
        const sellButton = event.target.closest("#npc-shop-view [data-sell-id]");
        if (sellButton) {
            sell(sellButton.dataset.sellId, sellButton.dataset.sellMode);
            return;
        }
        if (event.target.closest("#npc-shop-view [data-sell-all]")) sellAllLoot();
    });

    Aethra.EventBus.on("window:opened", ({ id } = {}) => {
        if (id === "npc-shop-view") render();
    });
    ["market:currency-changed", "inventory:changed", "state:restored"].forEach((eventName) => {
        Aethra.EventBus.on(eventName, () => {
            const win = document.getElementById("npc-shop-view");
            if (win && !win.classList.contains("hidden")) render();
        });
    });

    Aethra.NpcShopUI = {
        render,
        getShopCatalog,
        getSellableItems,
        getSalePrice,
        buy,
        sell,
        sellAllLoot,
        show() {
            Aethra.WindowManager?.open?.("npc-shop-view", { source: "npc-shop-ui" });
            render();
        }
    };
})(window.Aethra = window.Aethra || {});
