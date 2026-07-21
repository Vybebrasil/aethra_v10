// UI_Renderer.js - Renderização das lojas da Aethra Engine
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus) {
        throw new Error(
            "UI_Renderer.js requer game-core.js carregado antes deste arquivo."
        );
    }

    const MODES = Object.freeze({
        NPC_BUY: "npc_buy",
        NPC_SELL: "npc_sell",
        PREMIUM_BUY: "premium_buy",
        MARKET: "market"
    });

    const DEFAULT_CONTAINERS = Object.freeze({
        npcBuy: "npc-shop-grid",
        npcSell: "npc-sell-grid",
        premium: "premium-shop-grid",
        market: "player-market-grid"
    });

    function clone(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("pt-BR").format(
            Math.max(0, Math.floor(Number(value || 0)))
        );
    }

    function normalizeItems(items) {
        if (Array.isArray(items)) {
            return items;
        }

        if (items && typeof items === "object") {
            return Object.entries(items).map(([id, item]) => ({
                id,
                ...item
            }));
        }

        return [];
    }

    function getHero() {
        const hero = Aethra.GameState.hero || {};

        hero.stats = hero.stats || {};
        hero.bag = Array.isArray(hero.bag) ? hero.bag : [];

        hero.gold = Math.max(
            0,
            Number(hero.gold ?? hero.stats.gold ?? 0)
        );

        hero.diamonds = Math.max(
            0,
            Number(hero.diamonds ?? hero.stats.diamonds ?? 0)
        );

        return hero;
    }

    function getTemplate(templateId) {
        if (!templateId || !Aethra.GameData) {
            return null;
        }

        if (typeof Aethra.GameData.getItem === "function") {
            return Aethra.GameData.getItem(templateId);
        }

        const template = Aethra.GameData.items?.[templateId];
        return template ? clone(template) : null;
    }

    function getItemId(item) {
        return (
            item.listingId ||
            item.instanceId ||
            item.templateId ||
            item.id ||
            null
        );
    }

    function getTemplateId(item) {
        return (
            item.templateId ||
            item.item?.templateId ||
            item.item?.id ||
            item.id ||
            null
        );
    }

    function getDisplayItem(item, mode) {
        if (mode === MODES.MARKET && item.item) {
            return {
                ...item.item,
                listingId: item.listingId,
                listingPrice: item.price,
                sellerName: item.sellerName,
                sellerId: item.sellerId
            };
        }

        return item;
    }

    function getBasePrice(item) {
        const templateId = getTemplateId(item);
        const template = templateId ? getTemplate(templateId) : null;

        return Math.max(
            0,
            Math.floor(
                Number(
                    item.price ??
                    item.value ??
                    template?.price ??
                    template?.value ??
                    0
                )
            )
        );
    }

    function getSellPrice(item) {
        const basePrice = getBasePrice(item);
        const market = item.market || {};
        const origin =
            market.purchaseOrigin ||
            market.source ||
            item.source ||
            null;

        const isPremium =
            market.premium === true ||
            market.noSellBack === true ||
            item.noSellBack === true;

        if (isPremium) {
            return {
                price: 0,
                enabled: false,
                kind: "blocked",
                label: "Sem revenda"
            };
        }

        const isBoughtFromNPC =
            origin === "npc-shop" &&
            market.sellBackEligible === true;

        if (isBoughtFromNPC) {
            const purchasePrice = Number(
                market.purchasePrice || basePrice
            );

            const rate = Number(
                market.sellBackRate ?? 0.5
            );

            return {
                price: Math.floor(purchasePrice * rate),
                enabled: true,
                kind: "sellback",
                label: "50% do valor"
            };
        }

        const isLoot =
            origin === "loot" ||
            origin === "enemy-drop" ||
            origin === "hunt-loot" ||
            item.type === "loot" ||
            item.type === "material";

        if (isLoot) {
            return {
                price: basePrice,
                enabled: basePrice > 0,
                kind: "loot",
                label: "Valor cheio"
            };
        }

        return {
            price: 0,
            enabled: false,
            kind: "blocked",
            label: "Item não vendável"
        };
    }

    function getPriceData(item, mode) {
        switch (mode) {
            case MODES.NPC_BUY:
                return {
                    amount: getBasePrice(item),
                    currency: "gold",
                    label: "Preço"
                };

            case MODES.NPC_SELL: {
                const sell = getSellPrice(item);

                return {
                    amount: sell.price,
                    currency: "gold",
                    label: "Revenda",
                    sell
                };
            }

            case MODES.PREMIUM_BUY:
                return {
                    amount: Math.max(
                        0,
                        Math.floor(Number(item.diamondPrice || 0))
                    ),
                    currency: "diamonds",
                    label: "Preço"
                };

            case MODES.MARKET:
                return {
                    amount: Math.max(
                        0,
                        Math.floor(
                            Number(item.listingPrice ?? item.price ?? 0)
                        )
                    ),
                    currency: "gold",
                    label: "Oferta"
                };

            default:
                return {
                    amount: 0,
                    currency: "gold",
                    label: "Preço"
                };
        }
    }

    function getStats(item) {
        const stats = item.stats || {};
        const damage =
            item.damage ??
            stats.damage ??
            stats.damageMax ??
            0;

        const defense =
            item.defense ??
            stats.defense ??
            0;

        return {
            damage: Number(damage || 0),
            defense: Number(defense || 0)
        };
    }

    function getCurrencyBalance(currency) {
        const hero = getHero();

        return currency === "diamonds"
            ? hero.diamonds
            : hero.gold;
    }

    function getCurrencyLabel(currency) {
        return currency === "diamonds"
            ? "Diamantes"
            : "Gold";
    }

    function getCurrencySymbol(currency) {
        return currency === "diamonds"
            ? "◆"
            : "◉";
    }

    function getVisualSource(data, assetType = "item") {
        if (!data) return null;

        if (assetType === "creature") {
            if (
                Aethra.GameData &&
                typeof Aethra.GameData.getCreatureImage === "function"
            ) {
                return Aethra.GameData.getCreatureImage(data);
            }

            const fileName = data.sprite || data.image || null;

            return fileName
                ? `assets/entities/${fileName}`
                : null;
        }

        const templateId = getTemplateId(data);
        const template = templateId ? getTemplate(templateId) : null;

        if (
            Aethra.GameData &&
            typeof Aethra.GameData.getItemImage === "function"
        ) {
            return Aethra.GameData.getItemImage({
                ...(template || {}),
                ...data,
                templateId
            });
        }

        const fileName =
            data.image ||
            data.icon ||
            template?.image ||
            template?.icon ||
            null;

        return fileName
            ? `assets/icons/${fileName}`
            : null;
    }

    function getImageFallbackLabel(data) {
        const name =
            data?.name ||
            data?.baseName ||
            data?.templateId ||
            data?.id ||
            "?";

        return String(name).trim().charAt(0).toUpperCase() || "?";
    }

    Aethra.UI_Renderer = {
        initialized: false,
        tooltip: null,
        toast: null,
        renderQueue: null,
        entityLayer: null,
        entityNodes: new Map(),

        containers: {
            ...DEFAULT_CONTAINERS
        },

        init(options = {}) {
            if (options.containers) {
                this.containers = {
                    ...this.containers,
                    ...options.containers
                };
            }

            this.injectStyles();
            this.createTooltip();
            this.createToast();
            this.bindEvents();
            this.renderShops();

            if (Aethra.GameState.ui?.viewMode !== "battle-cards") {
                this.renderEntities();
            }

            this.updateSkillUI();

            this.initialized = true;

            Aethra.EventBus.emit("UIRendererReady", {
                containers: clone(this.containers)
            });

            Aethra.EventBus.emit("ui:shops-ready", {
                containers: clone(this.containers)
            });
        },

        /**
         * Componente reutilizável das lojas.
         *
         * @param {string} containerId ID do container.
         * @param {Array|Object} items Lista ou objeto de itens.
         * @param {"npc_buy"|"npc_sell"|"premium_buy"|"market"} mode
         */
        renderGrid(containerId, items, mode) {
            const container = document.getElementById(containerId);

            if (!container) {
                return false;
            }

            const normalizedItems = normalizeItems(items);
            container.innerHTML = "";
            container.dataset.shopMode = mode;

            if (normalizedItems.length === 0) {
                container.innerHTML = `
                    <div class="aethra-shop-empty">
                        Nenhum item disponível.
                    </div>
                `;

                return true;
            }

            const fragment = document.createDocumentFragment();

            normalizedItems.forEach((rawItem) => {
                const item = getDisplayItem(rawItem, mode);
                const card = this.createItemCard(item, mode);

                fragment.appendChild(card);
            });

            container.appendChild(fragment);

            Aethra.EventBus.emit("ui:shop-grid-rendered", {
                containerId,
                mode,
                count: normalizedItems.length
            });

            return true;
        },

        createItemCard(item, mode) {
            const card = document.createElement("article");
            const priceData = getPriceData(item, mode);
            const actionId = this.getActionId(item, mode);
            const balance = getCurrencyBalance(priceData.currency);
            const sellData = priceData.sell || null;

            const invalidPrice = priceData.amount <= 0;
            const insufficientBalance =
                mode !== MODES.NPC_SELL &&
                balance < priceData.amount;

            const saleBlocked =
                mode === MODES.NPC_SELL &&
                (!sellData || sellData.enabled !== true);

            const disabled =
                invalidPrice ||
                insufficientBalance ||
                saleBlocked;

            const stats = getStats(item);
            const rarity = item.rarity || "Comum";
            const itemName =
                item.name ||
                item.templateId ||
                item.id ||
                "Item";
            const imagePath = this.getImagePath(item, "item");
            const fallbackLabel = getImageFallbackLabel(item);

            card.className = [
                "aethra-shop-card",
                disabled ? "is-disabled" : "",
                `aethra-shop-card--${String(rarity)
                    .toLowerCase()
                    .replaceAll(" ", "-")}`
            ].filter(Boolean).join(" ");

            card.dataset.actionId = actionId || "";
            card.dataset.mode = mode;

            const priceClass = insufficientBalance
                ? "aethra-shop-price aethra-shop-price--insufficient"
                : "aethra-shop-price";

            const sellerHTML =
                mode === MODES.MARKET
                    ? `
                        <span class="aethra-shop-card__seller">
                            Vendedor: ${escapeHTML(item.sellerName || "Jogador")}
                        </span>
                    `
                    : "";

            const saleInfoHTML =
                mode === MODES.NPC_SELL && sellData
                    ? `
                        <span class="aethra-shop-card__sale-type">
                            ${escapeHTML(sellData.label)}
                        </span>
                    `
                    : "";

            card.innerHTML = `
                <div class="aethra-shop-card__header">
                    <span class="aethra-shop-card__rarity">
                        ${escapeHTML(rarity)}
                    </span>

                    <span class="aethra-shop-card__type">
                        ${escapeHTML(item.type || "item")}
                    </span>
                </div>

                <div class="aethra-shop-card__media">
                    ${
                        imagePath
                            ? `
                                <img
                                    class="aethra-shop-card__image"
                                    src="${escapeHTML(imagePath)}"
                                    alt="${escapeHTML(itemName)}"
                                    loading="lazy"
                                    decoding="async"
                                    draggable="false"
                                    data-aethra-item-image
                                >
                            `
                            : ""
                    }

                    <span
                        class="aethra-shop-card__image-fallback"
                        ${imagePath ? "hidden" : ""}
                        data-aethra-image-fallback
                        aria-hidden="true"
                    >
                        ${escapeHTML(fallbackLabel)}
                    </span>
                </div>

                <h3 class="aethra-shop-card__name">
                    ${escapeHTML(itemName)}
                </h3>

                <div class="aethra-shop-card__stats">
                    <span>Dano: <strong>${formatNumber(stats.damage)}</strong></span>
                    <span>Defesa: <strong>${formatNumber(stats.defense)}</strong></span>
                </div>

                ${sellerHTML}
                ${saleInfoHTML}

                <div class="${priceClass}">
                    <span>${escapeHTML(priceData.label)}</span>
                    <strong>
                        ${getCurrencySymbol(priceData.currency)}
                        ${formatNumber(priceData.amount)}
                        ${getCurrencyLabel(priceData.currency)}
                    </strong>
                </div>

                <button
                    type="button"
                    class="aethra-shop-action ${disabled ? "disabled" : ""}"
                    data-shop-action
                    ${disabled ? "disabled" : ""}
                >
                    ${escapeHTML(this.getButtonLabel(mode))}
                </button>
            `;

            const imageElement = card.querySelector(
                "[data-aethra-item-image]"
            );
            const fallbackElement = card.querySelector(
                "[data-aethra-image-fallback]"
            );

            imageElement?.addEventListener("error", () => {
                imageElement.hidden = true;

                if (fallbackElement) {
                    fallbackElement.hidden = false;
                }

                Aethra.EventBus.emit("ui:asset-load-error", {
                    type: "item",
                    itemId: getTemplateId(item),
                    path: imagePath
                });
            });

            const tooltipData = this.buildTooltipData(
                item,
                mode,
                priceData
            );

            card.addEventListener("mouseenter", (event) => {
                this.showTooltip(tooltipData, event);
            });

            card.addEventListener("mousemove", (event) => {
                this.moveTooltip(event);
            });

            card.addEventListener("mouseleave", () => {
                this.hideTooltip();
            });

            const actionButton = card.querySelector("[data-shop-action]");

            actionButton?.addEventListener("click", async () => {
                if (disabled) return;

                actionButton.disabled = true;
                actionButton.classList.add("is-processing");

                try {
                    await this.handleAction(mode, actionId);
                } finally {
                    actionButton.classList.remove("is-processing");
                }
            });

            return card;
        },

        getImagePath(data, assetType = "item") {
            return getVisualSource(data, assetType);
        },

        renderCreaturePortrait(
            containerId,
            creatureOrId,
            options = {}
        ) {
            const container = document.getElementById(containerId);

            if (!container) return false;

            const creature =
                typeof creatureOrId === "string"
                    ? Aethra.GameData?.getCreature?.(
                        creatureOrId,
                        options.level
                    )
                    : creatureOrId;

            if (!creature) {
                container.replaceChildren();
                return false;
            }

            const imagePath = this.getImagePath(
                creature,
                "creature"
            );
            const name =
                creature.name ||
                creature.id ||
                "Criatura";
            const fallbackLabel =
                getImageFallbackLabel(creature);

            container.innerHTML = `
                <div class="aethra-creature-portrait">
                    ${
                        imagePath
                            ? `
                                <img
                                    class="aethra-creature-portrait__image"
                                    src="${escapeHTML(imagePath)}"
                                    alt="${escapeHTML(name)}"
                                    decoding="async"
                                    draggable="false"
                                    data-aethra-creature-image
                                >
                            `
                            : ""
                    }

                    <span
                        class="aethra-creature-portrait__fallback"
                        ${imagePath ? "hidden" : ""}
                        data-aethra-creature-fallback
                    >
                        ${escapeHTML(fallbackLabel)}
                    </span>

                    <div class="aethra-creature-portrait__info">
                        <strong>${escapeHTML(name)}</strong>
                        <span>Nível ${formatNumber(creature.level || 1)}</span>
                    </div>
                </div>
            `;

            const imageElement = container.querySelector(
                "[data-aethra-creature-image]"
            );
            const fallbackElement = container.querySelector(
                "[data-aethra-creature-fallback]"
            );

            imageElement?.addEventListener("error", () => {
                imageElement.hidden = true;

                if (fallbackElement) {
                    fallbackElement.hidden = false;
                }

                Aethra.EventBus.emit("ui:asset-load-error", {
                    type: "creature",
                    creatureId: creature.id,
                    path: imagePath
                });
            });

            return true;
        },

        getActionId(item, mode) {
            if (mode === MODES.MARKET) {
                return item.listingId || null;
            }

            if (mode === MODES.NPC_SELL) {
                return item.instanceId || item.id || null;
            }

            return item.templateId || item.id || null;
        },

        getButtonLabel(mode) {
            const labels = {
                [MODES.NPC_BUY]: "Comprar",
                [MODES.NPC_SELL]: "Vender",
                [MODES.PREMIUM_BUY]: "Comprar com Diamantes",
                [MODES.MARKET]: "Comprar do Jogador"
            };

            return labels[mode] || "Ação";
        },

        async handleAction(mode, actionId) {
            const market = Aethra.MarketplaceSystem;

            if (!market) {
                this.notify(
                    "MarketplaceSystem não está carregado.",
                    "error"
                );
                return false;
            }

            let result = false;

            try {
                switch (mode) {
                    case MODES.NPC_BUY:
                        result = market.buyItem(actionId);
                        break;

                    case MODES.NPC_SELL: {
                        const hero = getHero();
                        const item = hero.bag.find(
                            (entry) =>
                                entry.instanceId === actionId ||
                                entry.id === actionId
                        );

                        if (!item) {
                            result = false;
                            break;
                        }

                        const sellData = getSellPrice(item);

                        result =
                            sellData.kind === "loot"
                                ? market.sellLoot(actionId)
                                : market.sellBack(actionId);

                        break;
                    }

                    case MODES.PREMIUM_BUY:
                        result = market.buyPremiumItem(actionId);
                        break;

                    case MODES.MARKET:
                        result = market.buyFromPlayer(actionId);
                        break;

                    default:
                        result = false;
                }
            } catch (error) {
                console.error("Falha na ação da loja:", error);
                result = false;
            }

            if (!result) {
                this.notify(
                    "A transação não pôde ser concluída.",
                    "error"
                );

                this.scheduleRender();
                return false;
            }

            const currency =
                mode === MODES.PREMIUM_BUY
                    ? "diamonds"
                    : "gold";

            this.flashCurrency(currency);
            this.animateTransaction(mode);
            this.notify(
                this.getSuccessMessage(mode),
                "success"
            );

            /*
             * O MarketplaceSystem já altera o GameState. A camada visual
             * apenas redesenha as partes afetadas.
             */
            this.scheduleRender();

            Aethra.RenderEngine?.renderInventory?.();
            Aethra.RenderEngine?.renderHeroStats?.();

            Aethra.EventBus.emit("ui:shop-action-completed", {
                mode,
                actionId,
                result: clone(result)
            });

            return result;
        },

        getSuccessMessage(mode) {
            const messages = {
                [MODES.NPC_BUY]: "Item comprado.",
                [MODES.NPC_SELL]: "Item vendido.",
                [MODES.PREMIUM_BUY]: "Item premium adquirido.",
                [MODES.MARKET]: "Compra realizada no Mercado de Jogadores."
            };

            return messages[mode] || "Transação concluída.";
        },

        getCombatMessage(payload = null, enemy = null) {
            if (!payload) {
                return (
                    Aethra.GameState.combat?.lastMessage ||
                    "Aguardando ação..."
                );
            }

            if (typeof payload === "string") {
                return payload;
            }

            if (
                typeof payload.message === "string" &&
                payload.message.trim()
            ) {
                return payload.message.trim();
            }

            if (payload.heroAttack || payload.creatureAttack) {
                return [
                    this.formatAttackMessage(
                        payload.heroAttack,
                        enemy
                    ),
                    this.formatAttackMessage(
                        payload.creatureAttack,
                        enemy
                    )
                ].filter(Boolean).join(" ");
            }

            if (
                payload.rewards ||
                payload.xp !== undefined ||
                payload.gold !== undefined
            ) {
                return this.formatRewardMessage(payload);
            }

            if (
                payload.amount !== undefined ||
                payload.hit !== undefined
            ) {
                return this.formatAttackMessage(payload, enemy);
            }

            return (
                Aethra.GameState.combat?.lastMessage ||
                "Aguardando ação..."
            );
        },

        formatAttackMessage(payload = null, enemy = null) {
            if (!payload) return "";

            if (
                typeof payload.message === "string" &&
                payload.message.trim()
            ) {
                return payload.message.trim();
            }

            const side = payload.side;
            const hit = payload.hit !== false;
            const amount = Math.max(
                0,
                Math.floor(Number(payload.amount || 0))
            );

            if (side === "hero") {
                if (!hit) return "Você errou o ataque!";

                return `Você causou ${amount} de dano!`;
            }

            const enemyName =
                payload.attackerName ||
                enemy?.name ||
                Aethra.GameState.combat?.enemy?.name ||
                Aethra.GameState.combat?.lastEnemy?.name ||
                "Inimigo";

            const namedEnemy = enemyName.startsWith("O ")
                ? enemyName
                : `O ${enemyName}`;

            if (!hit) {
                return `${namedEnemy} errou o ataque!`;
            }

            return `${namedEnemy} causou ${amount} de dano em você!`;
        },

        formatRewardMessage(payload = {}) {
            if (
                typeof payload.message === "string" &&
                payload.message.trim()
            ) {
                return payload.message.trim();
            }

            const rewards = payload.rewards || payload;
            const name =
                payload.name ||
                payload.enemy?.name ||
                "o inimigo";

            const xp = Math.max(
                0,
                Math.floor(Number(rewards.xp || 0))
            );
            const gold = Math.max(
                0,
                Math.floor(Number(rewards.gold || 0))
            );
            const lootCount = Math.max(
                0,
                Math.floor(Number(rewards.lootCount || 0))
            );

            return (
                `Vitória contra ${name}! ` +
                `+${xp} XP, ` +
                `${gold > 0 ? `+${gold} de ouro` : "nenhum ouro"} e ` +
                `${lootCount > 0
                    ? `${lootCount} item${lootCount === 1 ? "" : "s"} de loot`
                    : "nenhum loot"}.`
            );
        },

        setCombatMessage(message, payload = null) {
            if (!message) return false;

            Aethra.GameState.combat =
                Aethra.GameState.combat || {};
            Aethra.GameState.battle =
                Aethra.GameState.battle || {};

            const logColor =
                payload?.color ||
                payload?.logColor ||
                null;

            Aethra.GameState.combat.lastMessage = message;
            Aethra.GameState.combat.lastMessageColor = logColor;
            Aethra.GameState.battle.lastMessage = message;
            Aethra.GameState.battle.lastMessageColor = logColor;

            if (
                payload &&
                typeof payload === "object"
            ) {
                Aethra.GameState.combat.lastResult = {
                    ...clone(payload),
                    message
                };
            } else if (
                Aethra.GameState.combat.lastResult &&
                typeof Aethra.GameState.combat.lastResult === "object"
            ) {
                Aethra.GameState.combat.lastResult.message =
                    message;
            }

            Aethra.RenderEngine?.renderCombat?.();
            return true;
        },

        showCombatLog(
            message,
            color = "#00ff00",
            payload = {}
        ) {
            if (!message) return false;

            const logEntry = {
                ...clone(payload),
                message: String(message),
                color,
                createdAt:
                    payload.createdAt || Date.now()
            };

            Aethra.GameState.combat =
                Aethra.GameState.combat || {};

            const logs = Array.isArray(
                Aethra.GameState.combat.logs
            )
                ? Aethra.GameState.combat.logs
                : [];

            logs.push(logEntry);
            Aethra.GameState.combat.logs = logs.slice(-50);

            this.setCombatMessage(
                logEntry.message,
                logEntry
            );

            this.notify(
                logEntry.message,
                "combat-log",
                { color }
            );

            return clone(logEntry);
        },

        showFloatingCombatText(payload = {}) {
            const worldLayer =
                document.getElementById("world-layer");

            if (!worldLayer || !payload.text) {
                return false;
            }

            const node = document.createElement("div");

            node.className = [
                "aethra-floating-combat-text",
                `aethra-floating-combat-text--${payload.type || "damage"}`
            ].join(" ");

            node.textContent = String(payload.text);
            node.setAttribute("aria-hidden", "true");

            const x = Number.isFinite(Number(payload.x))
                ? Number(payload.x)
                : Math.round(window.innerWidth / 2);

            const y = Number.isFinite(Number(payload.y))
                ? Number(payload.y)
                : Math.round(window.innerHeight / 2);

            node.style.left = `${x}px`;
            node.style.top = `${y}px`;

            worldLayer.appendChild(node);

            requestAnimationFrame(() => {
                node.classList.add("is-visible");
            });

            const remove = () => {
                node.remove();
            };

            node.addEventListener(
                "animationend",
                remove,
                { once: true }
            );

            window.setTimeout(remove, 1400);

            Aethra.EventBus.emit(
                "ui:floating-combat-text-rendered",
                {
                    text: payload.text,
                    type: payload.type || "damage",
                    x,
                    y
                }
            );

            return node;
        },

        ensureEntityLayer() {
            if (
                this.entityLayer &&
                this.entityLayer.isConnected
            ) {
                return this.entityLayer;
            }

            Aethra.WindowManager?.ensureLayerStructure?.();

            const worldLayer = document.getElementById("world-layer");
            if (!worldLayer) return null;

            let entityLayer = document.getElementById("entity-layer");

            if (!entityLayer) {
                entityLayer = document.createElement("div");
                entityLayer.id = "entity-layer";
                entityLayer.setAttribute(
                    "aria-label",
                    "Entidades do mundo"
                );
                worldLayer.appendChild(entityLayer);
            } else if (entityLayer.parentElement !== worldLayer) {
                worldLayer.appendChild(entityLayer);
            }

            this.entityLayer = entityLayer;
            return entityLayer;
        },

        renderEntities(entities = null) {
            const layer = this.ensureEntityLayer();
            if (!layer) return false;

            const list = Array.isArray(entities)
                ? entities
                : Aethra.EntityManager?.getEntities?.() ||
                  Aethra.GameState.entities?.list ||
                  [];

            const activeIds = new Set();

            list.forEach((entity) => {
                if (!entity?.id) return;

                activeIds.add(entity.id);
                this.renderEntity(entity);
            });

            this.entityNodes.forEach((node, entityId) => {
                if (!activeIds.has(entityId)) {
                    node.remove();
                    this.entityNodes.delete(entityId);
                }
            });

            Aethra.EventBus.emit("WorldEntitiesRendered", {
                count: activeIds.size
            });
            Aethra.EventBus.emit("ui:entities-rendered", {
                count: activeIds.size
            });

            return true;
        },

        renderEntity(entity) {
            const layer = this.ensureEntityLayer();
            if (!layer || !entity?.id) return false;

            let node = this.entityNodes.get(entity.id);

            if (!node || !node.isConnected) {
                node = document.createElement("div");
                node.className = "aethra-world-entity";
                node.dataset.entityId = entity.id;
                node.tabIndex = entity.interactive === false ? -1 : 0;

                const sprite = document.createElement("img");
                sprite.className = "aethra-world-entity__sprite sprite-entity";
                sprite.draggable = false;
                sprite.decoding = "async";
                sprite.dataset.entitySprite = "";

                const fallback = document.createElement("span");
                fallback.className = "aethra-world-entity__fallback";
                fallback.dataset.entityFallback = "";
                fallback.hidden = true;

                const label = document.createElement("span");
                label.className = "aethra-world-entity__label";
                label.dataset.entityLabel = "";

                node.append(sprite, fallback, label);
                layer.appendChild(node);
                this.entityNodes.set(entity.id, node);

                node.addEventListener("click", () => {
                    const current =
                        Aethra.EntityManager?.getEntity?.(entity.id) ||
                        entity;

                    Aethra.EventBus.emit("EntitySelected", {
                        entity: clone(current)
                    });
                    Aethra.EventBus.emit("entity:selected", {
                        entity: clone(current)
                    });

                    Aethra.EntityManager?.interactWithEntity?.(
                        entity.id,
                        {
                            actorId: "player",
                            source: "entity-click"
                        }
                    );
                });

                node.addEventListener("keydown", (event) => {
                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {
                        event.preventDefault();
                        node.click();
                    }
                });
            }

            this.updateEntityNode(node, entity);
            return node;
        },

        updateEntityNode(node, entity) {
            if (!node || !entity) return false;

            const x = Number.isFinite(Number(entity.x))
                ? Number(entity.x)
                : 0;
            const y = Number.isFinite(Number(entity.y))
                ? Number(entity.y)
                : 0;
            const width = Math.max(1, Number(entity.width || 32));
            const height = Math.max(1, Number(entity.height || 32));

            node.dataset.entityType = entity.type || "npc";
            node.dataset.entityName = entity.name || entity.id;
            node.classList.toggle(
                "aethra-world-entity--player",
                entity.type === "player"
            );
            node.classList.toggle(
                "is-hidden",
                entity.visible === false
            );
            node.setAttribute(
                "aria-label",
                entity.name || entity.id
            );
            node.style.setProperty("--entity-x", `${x}px`);
            node.style.setProperty("--entity-y", `${y}px`);
            node.style.setProperty("--entity-width", `${width}px`);
            node.style.setProperty("--entity-height", `${height}px`);
            node.style.zIndex = String(20 + Math.max(0, Math.floor(y)));

            const sprite = node.querySelector("[data-entity-sprite]");
            const fallback = node.querySelector("[data-entity-fallback]");
            const label = node.querySelector("[data-entity-label]");

            if (label) {
                label.textContent = entity.name || entity.id;
            }

            if (fallback) {
                fallback.textContent = String(
                    entity.name || entity.id || "?"
                ).charAt(0).toUpperCase();
            }

            if (sprite) {
                sprite.alt = entity.name || entity.id;
                sprite.style.width = `${width}px`;
                sprite.style.height = `${height}px`;

                if (sprite.dataset.currentSrc !== entity.sprite_url) {
                    sprite.dataset.currentSrc = entity.sprite_url;
                    sprite.hidden = false;

                    if (fallback) fallback.hidden = true;

                    sprite.onerror = () => {
                        sprite.hidden = true;
                        if (fallback) fallback.hidden = false;

                        Aethra.EventBus.emit("ui:asset-load-error", {
                            type: "entity",
                            entityId: entity.id,
                            path: entity.sprite_url
                        });
                    };

                    sprite.onload = () => {
                        sprite.hidden = false;
                        if (fallback) fallback.hidden = true;
                    };

                    sprite.src = entity.sprite_url;
                }
            }

            return true;
        },

        removeEntity(entityId) {
            const node = this.entityNodes.get(entityId);
            if (!node) return false;

            node.remove();
            this.entityNodes.delete(entityId);
            return true;
        },

        clearWorldEntities() {
            this.entityNodes.forEach((node) => node.remove());
            this.entityNodes.clear();
            this.entityLayer?.replaceChildren();
            return true;
        },

        /**
         * Sincroniza a ActionBar com as configurações do SkillController.
         * Botões ligados a skills automáticas recebem a classe `is-auto`.
         */
        updateSkillUI(root = document) {
            if (!root || !Aethra.SkillController) {
                return 0;
            }

            const activeBar =
                Aethra.SkillSystem?.getActiveBar?.() ||
                { slots: [] };

            const slots = Array.isArray(activeBar.slots)
                ? activeBar.slots
                : [];

            const settings =
                Aethra.SkillController.getSettings?.() || {};

            const actionBarSelectors = [
                "[data-action-bar]",
                ".action-bar",
                "#action-bar",
                "#skill-action-bar"
            ];

            const actionBars = [];

            if (
                typeof Element !== "undefined" &&
                root instanceof Element &&
                root.matches(actionBarSelectors.join(","))
            ) {
                actionBars.push(root);
            }

            if (typeof root.querySelectorAll === "function") {
                root.querySelectorAll(
                    actionBarSelectors.join(",")
                ).forEach((element) => {
                    if (!actionBars.includes(element)) {
                        actionBars.push(element);
                    }
                });
            }

            const buttons = new Set();

            actionBars.forEach((actionBar) => {
                const skillButtons = actionBar.querySelectorAll(
                    [
                        "button[data-actionbar-skill]",
                        "button[data-action-bar-skill]",
                        "button[data-skill-slot]",
                        "button[data-slot-index][data-skill-id]"
                    ].join(",")
                );

                skillButtons.forEach((button) => buttons.add(button));
            });

            /*
             * Compatibilidade com ActionBars renderizadas sem um container
             * dedicado, desde que o botão se identifique como skill da barra.
             */
            if (typeof root.querySelectorAll === "function") {
                root.querySelectorAll(
                    [
                        "button[data-actionbar-skill]",
                        "button[data-action-bar-skill]",
                        "button[data-skill-slot]",
                        "button[data-slot-index][data-skill-id]"
                    ].join(",")
                ).forEach((button) => buttons.add(button));
            }

            let autoCount = 0;

            buttons.forEach((button) => {
                const rawSlotIndex =
                    button.dataset.slotIndex ??
                    button.dataset.skillSlotIndex ??
                    button.dataset.skillSlot;

                const parsedSlotIndex = Number(rawSlotIndex);
                const slotSkillId = Number.isInteger(parsedSlotIndex)
                    ? slots[parsedSlotIndex]
                    : null;

                const skillId =
                    button.dataset.skillId ||
                    button.dataset.actionbarSkill ||
                    button.dataset.actionBarSkill ||
                    (
                        rawSlotIndex &&
                        !Number.isInteger(parsedSlotIndex)
                            ? rawSlotIndex
                            : null
                    ) ||
                    slotSkillId ||
                    null;

                const isAuto = Boolean(
                    skillId &&
                    settings[skillId]?.auto === true
                );

                button.classList.toggle("is-auto", isAuto);
                button.dataset.auto = isAuto ? "true" : "false";

                if (isAuto) {
                    autoCount += 1;
                }
            });

            Aethra.EventBus.emit("ui:skill-auto-state-updated", {
                buttonCount: buttons.size,
                autoCount,
                activeBarIndex:
                    Aethra.GameState.hero?.activeActionBar ?? 0
            });

            return autoCount;
        },

        renderSkillSettings(
            containerId = "skills-config-list"
        ) {
            const container =
                document.getElementById(
                    containerId
                );

            if (!container) return false;

            if (!Aethra.SkillController) {
                container.innerHTML = `
                    <div class="aethra-empty">
                        SkillController não carregado.
                    </div>
                `;
                return false;
            }

            const snapshot =
                Aethra.SkillController
                    .getSnapshot();

            const entries =
                snapshot.orderedSkills || [];

            const hp = snapshot.hp || {
                hp: 0,
                maxHp: 1,
                percent: 0
            };

            const lastAction =
                snapshot.lastAction;

            const status =
                document.getElementById(
                    "skills-priority-status"
                );

            if (status) {
                status.innerHTML = `
                    <div>
                        <small>HP atual</small>
                        <strong>
                            ${formatNumber(hp.hp)}
                            /
                            ${formatNumber(hp.maxHp)}
                        </strong>
                    </div>

                    <div>
                        <small>HP percentual</small>
                        <strong>
                            ${Math.round(hp.percent)}%
                        </strong>
                    </div>

                    <div>
                        <small>Última ação</small>
                        <strong>
                            ${escapeHTML(
                                lastAction?.skill?.name ||
                                lastAction?.message ||
                                "Nenhuma"
                            )}
                        </strong>
                    </div>
                `;
            }

            container.innerHTML = "";

            if (entries.length === 0) {
                container.innerHTML = `
                    <div class="aethra-empty">
                        A ActionBar ativa não possui skills.
                    </div>
                `;
                return true;
            }

            const fragment =
                document.createDocumentFragment();

            entries.forEach(
                (entry, index) => {
                    const {
                        skillId,
                        slotIndex,
                        skill,
                        setting
                    } = entry;

                    const isHeal =
                        String(
                            skill.type ||
                            skill.effect?.type ||
                            ""
                        ).toLowerCase() === "heal";

                    const isDamage =
                        String(
                            skill.type ||
                            skill.effect?.type ||
                            ""
                        ).toLowerCase() === "damage";

                    const card =
                        document.createElement(
                            "article"
                        );

                    card.className = [
                        "skill-config-card",
                        isHeal
                            ? "skill-config-card--support"
                            : isDamage
                                ? "skill-config-card--damage"
                                : "skill-config-card--utility"
                    ].join(" ");

                    card.dataset.skillId =
                        skillId;

                    const threshold =
                        Number(
                            setting?.hpThreshold ??
                            skill.hpThreshold ??
                            50
                        );

                    card.innerHTML = `
                        <div class="skill-config-card__order">
                            <span>
                                ${index + 1}
                            </span>

                            <button
                                type="button"
                                data-skill-move="up"
                                aria-label="Subir ${escapeHTML(skill.name)}"
                                ${index === 0 ? "disabled" : ""}
                            >
                                ▲
                            </button>

                            <button
                                type="button"
                                data-skill-move="down"
                                aria-label="Descer ${escapeHTML(skill.name)}"
                                ${
                                    index === entries.length - 1
                                        ? "disabled"
                                        : ""
                                }
                            >
                                ▼
                            </button>
                        </div>

                        <div class="skill-config-card__identity">
                            <span
                                class="skill-config-card__icon"
                                aria-hidden="true"
                            >
                                ${escapeHTML(skill.icon || "✦")}
                            </span>

                            <div>
                                <strong>
                                    ${escapeHTML(skill.name)}
                                </strong>

                                <small>
                                    ${escapeHTML(
                                        isHeal
                                            ? "Suporte / Cura"
                                            : isDamage
                                                ? "Ataque"
                                                : "Utilidade"
                                    )}
                                    · Slot ${slotIndex + 1}
                                </small>
                            </div>
                        </div>

                        <p class="skill-config-card__description">
                            ${escapeHTML(
                                skill.description ||
                                "Sem descrição."
                            )}
                        </p>

                        <label class="skill-auto-toggle">
                            <input
                                type="checkbox"
                                data-skill-auto
                                ${setting?.auto ? "checked" : ""}
                            >

                            <span>Auto</span>
                        </label>

                        ${
                            isHeal
                                ? `
                                    <div class="skill-threshold-control">
                                        <div class="skill-threshold-control__header">
                                            <label
                                                for="skill-threshold-${escapeHTML(skillId)}"
                                            >
                                                Curar abaixo de
                                            </label>

                                            <output
                                                data-threshold-output
                                            >
                                                ${Math.round(threshold)}%
                                            </output>
                                        </div>

                                        <div class="skill-threshold-control__inputs">
                                            <input
                                                id="skill-threshold-${escapeHTML(skillId)}"
                                                type="range"
                                                min="5"
                                                max="95"
                                                step="5"
                                                value="${Math.round(threshold)}"
                                                data-skill-threshold-range
                                            >

                                            <input
                                                type="number"
                                                min="5"
                                                max="95"
                                                step="1"
                                                value="${Math.round(threshold)}"
                                                data-skill-threshold-number
                                                aria-label="HP percentual de ${escapeHTML(skill.name)}"
                                            >
                                        </div>

                                        <small>
                                            Segurança: nunca dispara
                                            automaticamente em 95% de HP
                                            ou mais.
                                        </small>
                                    </div>
                                `
                                : ""
                        }

                        <button
                            type="button"
                            class="skill-manual-button"
                            data-skill-manual
                        >
                            Usar manualmente
                        </button>
                    `;

                    const autoInput =
                        card.querySelector(
                            "[data-skill-auto]"
                        );

                    autoInput?.addEventListener(
                        "change",
                        () => {
                            Aethra.SkillController
                                .setAuto(
                                    skillId,
                                    autoInput.checked
                                );
                        }
                    );

                    const rangeInput =
                        card.querySelector(
                            "[data-skill-threshold-range]"
                        );

                    const numberInput =
                        card.querySelector(
                            "[data-skill-threshold-number]"
                        );

                    const output =
                        card.querySelector(
                            "[data-threshold-output]"
                        );

                    const updateThreshold =
                        (value) => {
                            const saved =
                                Aethra.SkillController
                                    .setHpThreshold(
                                        skillId,
                                        value
                                    );

                            if (saved === false) {
                                return;
                            }

                            if (rangeInput) {
                                rangeInput.value =
                                    String(saved);
                            }

                            if (numberInput) {
                                numberInput.value =
                                    String(saved);
                            }

                            if (output) {
                                output.textContent =
                                    `${saved}%`;
                            }
                        };

                    rangeInput?.addEventListener(
                        "input",
                        () => {
                            updateThreshold(
                                rangeInput.value
                            );
                        }
                    );

                    numberInput?.addEventListener(
                        "change",
                        () => {
                            updateThreshold(
                                numberInput.value
                            );
                        }
                    );

                    card
                        .querySelector(
                            "[data-skill-move='up']"
                        )
                        ?.addEventListener(
                            "click",
                            () => {
                                Aethra.SkillController
                                    .moveSkill(
                                        skillId,
                                        "up"
                                    );

                                this.renderSkillSettings(
                                    containerId
                                );
                            }
                        );

                    card
                        .querySelector(
                            "[data-skill-move='down']"
                        )
                        ?.addEventListener(
                            "click",
                            () => {
                                Aethra.SkillController
                                    .moveSkill(
                                        skillId,
                                        "down"
                                    );

                                this.renderSkillSettings(
                                    containerId
                                );
                            }
                        );

                    card
                        .querySelector(
                            "[data-skill-manual]"
                        )
                        ?.addEventListener(
                            "click",
                            () => {
                                const queued =
                                    Aethra.SkillController
                                        .queueManualSkill(
                                            skillId
                                        );

                                this.notify(
                                    queued
                                        ? `${skill.name} adicionada à fila manual.`
                                        : "Não foi possível adicionar a skill.",
                                    queued
                                        ? "success"
                                        : "error"
                                );
                            }
                        );

                    fragment.appendChild(card);
                }
            );

            container.appendChild(fragment);

            Aethra.EventBus.emit(
                "ui:skills-settings-rendered",
                {
                    count: entries.length,
                    activeBar:
                        Aethra.SkillSystem
                            ?.getActiveBar?.()
                }
            );

            this.updateSkillUI();
            return true;
        },

        renderShops() {
            const gameItems = Aethra.GameData?.items || {};
            const inventory = getHero().bag;
            const premiumItems =
                Aethra.MarketplaceSystem?.premiumCatalog || {};
            const marketListings =
                Aethra.MarketplaceSystem?.getActiveListings?.() || [];

            this.renderGrid(
                this.containers.npcBuy,
                gameItems,
                MODES.NPC_BUY
            );

            this.renderGrid(
                this.containers.npcSell,
                inventory,
                MODES.NPC_SELL
            );

            this.renderGrid(
                this.containers.premium,
                premiumItems,
                MODES.PREMIUM_BUY
            );

            this.renderGrid(
                this.containers.market,
                marketListings,
                MODES.MARKET
            );

            return true;
        },

        scheduleRender() {
            if (this.renderQueue !== null) {
                return;
            }

            this.renderQueue = window.requestAnimationFrame(() => {
                this.renderQueue = null;
                this.renderShops();
            });
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            [
                "MarketplaceReady",
                "market:ready",
                "market:npc-item-purchased",
                "market:loot-sold",
                "market:item-sold-back",
                "market:premium-item-purchased",
                "market:listing-created",
                "market:purchase-completed",
                "market:listing-cancelled",
                "market:seller-balance-claimed",
                "inventory:item-added",
                "inventory:item-removed",
                "inventory:changed",
                "itemObtained",
                "ItemAcquired",
                "goldChanged",
                "diamondsChanged",
                "save:loaded",
                "state:restored"
            ].forEach((eventName) => {
                Aethra.EventBus.on(eventName, () => {
                    this.scheduleRender();
                });
            });

            Aethra.EventBus.on(
                "market:operation-failed",
                (payload) => {
                    this.notify(
                        this.getFailureMessage(payload?.reason),
                        "error"
                    );
                }
            );

            Aethra.EventBus.on("WindowOpened", ({ id }) => {
                const shopWindows = [
                    "npc-shop-view",
                    "premium-shop-view",
                    "player-market-view",
                    "marketplace-view"
                ];

                if (shopWindows.includes(id)) {
                    this.scheduleRender();
                }

                if (id === "skills-view") {
                    this.renderSkillSettings();
                }
            });

            Aethra.EventBus.on(
                "BattleFloatingText",
                (payload) => {
                    this.showFloatingCombatText(payload);
                }
            );

            Aethra.EventBus.on("CombatTick", (payload) => {
                this.setCombatMessage(
                    this.getCombatMessage(payload),
                    payload
                );
            });

            Aethra.EventBus.on("battle:tick", (payload) => {
                this.setCombatMessage(
                    this.getCombatMessage(payload),
                    payload
                );
            });

            Aethra.EventBus.on("DamageDealt", (payload) => {
                this.setCombatMessage(
                    this.formatAttackMessage(payload),
                    payload
                );
            });

            Aethra.EventBus.on("AttackMissed", (payload) => {
                this.setCombatMessage(
                    this.formatAttackMessage(payload),
                    payload
                );
            });

            Aethra.EventBus.on(
                "BattleRewardsGranted",
                (payload) => {
                    this.setCombatMessage(
                        this.formatRewardMessage(payload),
                        payload
                    );

                    Aethra.RenderEngine?.renderHunt?.();
                    Aethra.RenderEngine?.renderInventory?.();
                    this.flashCurrency("gold");
                }
            );

            Aethra.EventBus.on(
                "battle:rewards-granted",
                (payload) => {
                    this.setCombatMessage(
                        this.formatRewardMessage(payload),
                        payload
                    );
                }
            );

            Aethra.EventBus.on("PlayerDefeated", (payload) => {
                const message =
                    payload?.message ||
                    `Você foi derrotado! Perdeu ${Math.max(
                        0,
                        Math.floor(Number(payload?.penalty || 0))
                    )} de ouro.`;

                this.setCombatMessage(message, payload);
                this.flashCurrency("gold");
            });

            Aethra.EventBus.on(
                "hunt:rewards-updated",
                () => {
                    Aethra.RenderEngine?.renderHunt?.();
                    this.flashCurrency("gold");
                }
            );

            [
                "SkillControllerReady",
                "SkillControllerSettingsChanged",
                "skill-controller:settings-changed",
                "actionBarChanged",
                "actionbar:changed",
                "skills:ready"
            ].forEach((eventName) => {
                Aethra.EventBus.on(
                    eventName,
                    () => {
                        this.updateSkillUI();

                        if (
                            Aethra.WindowManager
                                ?.isOpen?.(
                                    "skills-view"
                                )
                        ) {
                            this.renderSkillSettings();
                        }
                    }
                );
            });

            Aethra.EventBus.on(
                "BattleLog",
                (payload = {}) => {
                    const message =
                        payload.message ||
                        payload.logMessage;

                    if (!message) return;

                    this.showCombatLog(
                        message,
                        payload.color || "#00ff00",
                        payload
                    );
                }
            );

            Aethra.EventBus.on(
                "SkillControllerActionExecuted",
                (payload) => {
                    const message =
                        payload?.message ||
                        payload?.result?.message;

                    if (message) {
                        this.setCombatMessage(
                            message,
                            payload
                        );
                    }

                    if (
                        Aethra.WindowManager
                            ?.isOpen?.(
                                "skills-view"
                            )
                    ) {
                        this.renderSkillSettings();
                    }
                }
            );

            Aethra.EventBus.on(
                "equipment:drop-rejected",
                () => {
                    this.notify(
                        "Este tipo de item não pode ser equipado nesse slot.",
                        "error"
                    );
                }
            );

            Aethra.EventBus.on(
                "equipment:validation-failed",
                (payload) => {
                    const message =
                        payload?.code === "LEVEL_REQUIREMENT_NOT_MET"
                            ? "Seu nível é insuficiente para equipar este item."
                            : "Este tipo de item não pode ser equipado nesse slot.";

                    this.notify(message, "error");
                }
            );

            Aethra.EventBus.on("EntityManagerReady", ({ entities }) => {
                if (Aethra.GameState.ui?.viewMode === "battle-cards") return;
                this.renderEntities(entities);
            });

            Aethra.EventBus.on("EntityAdded", ({ entity }) => {
                if (Aethra.GameState.ui?.viewMode === "battle-cards") return;
                this.renderEntity(entity);
            });

            Aethra.EventBus.on("EntityUpdated", ({ entity }) => {
                if (Aethra.GameState.ui?.viewMode === "battle-cards") return;
                this.renderEntity(entity);
            });

            Aethra.EventBus.on("EntityMoved", ({ entity }) => {
                if (Aethra.GameState.ui?.viewMode === "battle-cards") return;
                this.renderEntity(entity);
            });

            Aethra.EventBus.on("EntityRemoved", ({ entityId, entity }) => {
                if (Aethra.GameState.ui?.viewMode === "battle-cards") return;
                this.removeEntity(entityId || entity?.id);
            });

            Aethra.EventBus.on("EntitiesCleared", () => {
                if (Aethra.GameState.ui?.viewMode === "battle-cards") return;
                this.clearWorldEntities();
            });

            Aethra.EventBus.on("WindowManagerReady", () => {
                if (Aethra.GameState.ui?.viewMode === "battle-cards") return;
                this.renderEntities();
            });

            Aethra.EventBus.on("EngineReady", () => {
                if (Aethra.GameState.ui?.viewMode === "battle-cards") return;
                this.renderEntities();
            });
        },

        getFailureMessage(reason) {
            const messages = {
                "insufficient-gold": "Gold insuficiente.",
                "insufficient-diamonds": "Diamantes insuficientes.",
                "item-not-found": "Item não encontrado.",
                "item-not-in-inventory": "Item não está no inventário.",
                "item-is-not-loot": "Este item não pode ser vendido como loot.",
                "item-not-eligible": "Este item não possui sellback.",
                "sellback-disabled": "Itens premium não possuem sellback.",
                "listing-not-found": "A oferta não está mais disponível.",
                "cannot-buy-own-listing": "Você não pode comprar sua própria oferta.",
                "item-cannot-be-listed": "Este item não pode ser anunciado."
            };

            return messages[reason] || "Transação recusada.";
        },

        getItemTooltipData(item, extra = {}) {
            const templateId = getTemplateId(item);
            const template = templateId
                ? getTemplate(templateId) || {}
                : {};

            const merged = {
                ...template,
                ...item,
                templateId
            };

            const breakdown =
                Aethra.GameData?.getItemStatBreakdown?.(merged) ||
                {
                    baseStats: clone(template.baseStats || {}),
                    finalStats: clone(item.stats || {}),
                    bonuses: {},
                    multiplier: Number(
                        item.statMultiplier || item.multiplier || 1
                    ),
                    individualMultipliers: clone(
                        item.individualMultipliers || {}
                    ),
                    scaledStats: clone(item.stats || {}),
                    affixBonuses: {},
                    affixes: clone(item.affixes || [])
                };

            const rarity =
                Aethra.GameData?.getRarityPresentation?.(merged) ||
                {
                    id: merged.rarityId || "common",
                    name: merged.rarity || "Comum",
                    color: "#c7c7c7"
                };

            const sell = getSellPrice(merged);
            const inspection =
                Aethra.ItemSystem?.getItemInspection?.(merged) || null;
            const worldRanking =
                Aethra.ItemRankingSystem?.getItemRanking?.(merged) ||
                merged.worldRanking ||
                null;

            return {
                name:
                    merged.name ||
                    merged.baseName ||
                    merged.templateId ||
                    merged.id ||
                    "Item",
                type: merged.type || "Item",
                rarity: rarity.name,
                rarityId: rarity.id,
                rarityColor: rarity.color,
                description:
                    merged.description ||
                    template.description ||
                    "Sem descrição.",
                multiplier: breakdown.multiplier,
                baseStats: breakdown.baseStats,
                finalStats: breakdown.finalStats,
                bonuses: breakdown.bonuses,
                individualMultipliers:
                    breakdown.individualMultipliers || {},
                effectiveMultipliers:
                    breakdown.effectiveMultipliers || {},
                scaledStats:
                    breakdown.scaledStats || {},
                affixBonuses:
                    breakdown.affixBonuses || {},
                affixes: breakdown.affixes,
                quality: Number(merged.quality || 0),
                potential: Number(merged.potential || 0),
                inspection,
                ivPercent:
                    inspection?.ivPercent ??
                    Number(merged.rollScore ?? merged.iv?.percent ?? 100),
                multiplierIV:
                    inspection?.multiplierIV ?? 100,
                attributeRolls:
                    inspection?.attributeRolls || [],
                affixRolls:
                    inspection?.affixRolls || [],
                worldRanking,
                resaleValue: sell.price,
                resaleLabel: sell.label,
                ...extra
            };
        },

        buildTooltipData(item, mode, priceData) {
            return this.getItemTooltipData(item, {
                mode,
                price: priceData.amount,
                currency: priceData.currency
            });
        },

        getItemComparison(item, preferredSlot = null) {
            if (!item || !Aethra.EquipSystem) return null;

            const allowedSlots = Aethra.EquipSystem.getAllowedSlots?.(item) || [];
            const slots = [preferredSlot, item.slot, ...allowedSlots]
                .filter(Boolean)
                .filter((slot, index, array) => array.indexOf(slot) === index);

            for (const slot of slots) {
                const equipped = Aethra.EquipSystem.getEquipped?.(slot);
                if (!equipped) continue;
                if (equipped.instanceId && equipped.instanceId === item.instanceId) continue;
                return {
                    slot,
                    item: equipped,
                    data: this.getItemTooltipData(equipped, {
                        comparisonSource: true
                    })
                };
            }

            return null;
        },

        bindItemTooltip(element, item, extra = {}) {
            if (!element || !item) return false;
            if (!this.tooltip) this.createTooltip();
            if (element.dataset.itemTooltipBound === "true") return true;
            element.dataset.itemTooltipBound = "true";

            const show = (event) => {
                const anchorEvent = event || {
                    clientX: element.getBoundingClientRect().left + 16,
                    clientY: element.getBoundingClientRect().top + 16
                };
                const comparison = this.getItemComparison(item, extra.slot || null);
                const quantity = Math.max(1, Number(item.quantity || 1));
                const baseData = this.getItemTooltipData(item, extra);
                this.showTooltip({
                    ...baseData,
                    quantity,
                    stackValue: Math.max(0, Number(baseData.resaleValue || item.price || item.value || 0)) * quantity,
                    comparison
                }, anchorEvent);
            };

            element.addEventListener("mouseenter", show);
            element.addEventListener("pointerenter", show);
            element.addEventListener("focus", show);
            element.addEventListener("mousemove", (event) => {
                this.moveTooltip(event);
            });
            element.addEventListener("pointermove", (event) => {
                this.moveTooltip(event);
            });
            element.addEventListener("mouseleave", () => {
                this.hideTooltip();
            });
            element.addEventListener("pointerleave", () => {
                this.hideTooltip();
            });
            element.addEventListener("blur", () => {
                this.hideTooltip();
            });
            element.addEventListener("dragstart", () => {
                this.hideTooltip();
            });

            return true;
        },

        getStatLabel(stat) {
            const labels = {
                damageMin: "Dano mínimo",
                damageMax: "Dano máximo",
                defense: "Defesa",
                str: "Força",
                mag: "Magia",
                precision: "Precisão",
                critical: "Crítico",
                evasion: "Evasão",
                blockChance: "Bloqueio",
                blockReduction: "Redução de bloqueio",
                hpMax: "Vida máxima",
                manaMax: "Mana máxima"
            };

            return labels[stat] || stat;
        },

        formatStatValue(stat, value) {
            const numeric = Number(value || 0);

            if (
                [
                    "critical",
                    "evasion",
                    "blockChance",
                    "blockReduction"
                ].includes(stat)
            ) {
                return `${Math.round(numeric * 1000) / 10}%`;
            }

            return new Intl.NumberFormat("pt-BR", {
                maximumFractionDigits: 3
            }).format(numeric);
        },

        createTooltip() {
            if (document.getElementById("aethra-shop-tooltip")) {
                this.tooltip = document.getElementById(
                    "aethra-shop-tooltip"
                );
                return;
            }

            this.tooltip = document.createElement("div");
            this.tooltip.id = "aethra-shop-tooltip";
            this.tooltip.className = "aethra-shop-tooltip";
            this.tooltip.setAttribute("role", "tooltip");
            this.tooltip.hidden = true;

            document.body.appendChild(this.tooltip);
        },

        showTooltip(data, event) {
            if (!this.tooltip) return;

            const statKeys = Object.keys({
                ...(data.baseStats || {}),
                ...(data.finalStats || {})
            });

            const statsHTML = statKeys.length > 0
                ? statKeys.map((stat) => {
                    const base = Number(
                        data.baseStats?.[stat] || 0
                    );
                    const final = Number(
                        data.finalStats?.[stat] || 0
                    );
                    const bonus = Number(
                        data.bonuses?.[stat] || 0
                    );
                    const individual = Number(
                        data.individualMultipliers?.[stat] ?? 1
                    );
                    const affixBonus = Number(
                        data.affixBonuses?.[stat] || 0
                    );
                    const globalMultiplier = Number(
                        data.multiplier || 1
                    );

                    const bonusClass = bonus >= 0
                        ? "is-positive"
                        : "is-negative";

                    const formulaParts = [
                        `Base ${this.formatStatValue(stat, base)}`,
                        `× ${globalMultiplier.toFixed(2)}x`,
                        Math.abs(individual - 1) > 0.0001
                            ? `× ${individual.toFixed(2)} var.`
                            : "",
                        Math.abs(affixBonus) > 0.0001
                            ? `${affixBonus >= 0 ? "+" : "−"} `
                              + `${this.formatStatValue(
                                  stat,
                                  Math.abs(affixBonus)
                              )} afixo`
                            : ""
                    ].filter(Boolean);

                    const formulaText =
                        `${this.getStatLabel(stat)}: `
                        + `${this.formatStatValue(stat, final)} `
                        + `(${formulaParts.join(" ")})`;
                    const roll = (data.attributeRolls || []).find(
                        (entry) => entry.stat === stat
                    );
                    const ivPercent = Math.max(
                        0,
                        Math.min(100, Number(roll?.ivPercent ?? 100))
                    );
                    const rawRoll = Number(
                        roll?.rollPercent ?? individual * 100
                    );

                    return `
                        <div class="aethra-item-tooltip__stat-row">
                            <span>${escapeHTML(this.getStatLabel(stat))}</span>
                            <small>${escapeHTML(this.formatStatValue(stat, base))}</small>
                            <em class="${bonusClass}">
                                ${bonus >= 0 ? "+" : ""}${escapeHTML(
                                    this.formatStatValue(stat, bonus)
                                )}
                            </em>
                            <strong>${escapeHTML(
                                this.formatStatValue(stat, final)
                            )}</strong>

                            <code class="aethra-item-tooltip__formula">
                                ${escapeHTML(formulaText)}
                            </code>

                            <div class="aethra-item-tooltip__roll">
                                <span>
                                    Roll ${Number.isFinite(rawRoll) ? rawRoll.toFixed(1) : "100.0"}%
                                </span>
                                <i><b style="width:${ivPercent.toFixed(1)}%"></b></i>
                                <strong>IV ${ivPercent.toFixed(1)}%</strong>
                            </div>
                        </div>
                    `;
                }).join("")
                : `
                    <div class="aethra-item-tooltip__empty">
                        Este item não possui atributos de combate.
                    </div>
                `;

            const affixesHTML = (data.affixes || []).length > 0
                ? `
                    <div class="aethra-item-tooltip__affixes">
                        ${(data.affixes || []).map((affix) => {
                            return `
                                <span>
                                    ${escapeHTML(affix.name || affix.id)}:
                                    +${escapeHTML(
                                        this.formatStatValue(
                                            affix.stat,
                                            affix.value
                                        )
                                    )}
                                </span>
                            `;
                        }).join("")}
                    </div>
                `
                : "";

            const stackHTML = Number(data.quantity || 1) > 1
                ? `
                    <div class="aethra-item-tooltip__stack-summary">
                        <span><small>Quantidade</small><strong>x${formatNumber(data.quantity)}</strong></span>
                        <span><small>Valor unitário</small><strong>${formatNumber(data.resaleValue || 0)} G</strong></span>
                        <span><small>Valor acumulado</small><strong>${formatNumber(data.stackValue || 0)} G</strong></span>
                    </div>
                `
                : "";

            const comparisonData = data.comparison?.data || null;
            const comparisonStats = comparisonData
                ? Array.from(new Set([
                    ...Object.keys(data.finalStats || {}),
                    ...Object.keys(comparisonData.finalStats || {})
                ])).map((stat) => {
                    const current = Number(data.finalStats?.[stat] || 0);
                    const equipped = Number(comparisonData.finalStats?.[stat] || 0);
                    const delta = current - equipped;
                    return { stat, current, equipped, delta };
                }).filter((entry) => Math.abs(entry.delta) > 0.0001)
                : [];

            const comparisonHTML = comparisonData
                ? `
                    <section class="aethra-item-tooltip__comparison">
                        <header>
                            <div>
                                <small>COMPARAÇÃO COM EQUIPADO</small>
                                <strong>${escapeHTML(comparisonData.name || "Item equipado")}</strong>
                            </div>
                            <span>${escapeHTML(String(data.comparison?.slot || "slot").toUpperCase())}</span>
                        </header>
                        <div class="aethra-item-tooltip__comparison-summary">
                            <span class="${Number(data.multiplier || 1) - Number(comparisonData.multiplier || 1) >= 0 ? "is-positive" : "is-negative"}">
                                Mult. ${Number(data.multiplier || 1).toFixed(2)}x
                                <b>${Number(data.multiplier || 1) - Number(comparisonData.multiplier || 1) >= 0 ? "+" : ""}${(Number(data.multiplier || 1) - Number(comparisonData.multiplier || 1)).toFixed(2)}x</b>
                            </span>
                            <span class="${Number(data.ivPercent || 0) - Number(comparisonData.ivPercent || 0) >= 0 ? "is-positive" : "is-negative"}">
                                IV ${Number(data.ivPercent || 0).toFixed(1)}%
                                <b>${Number(data.ivPercent || 0) - Number(comparisonData.ivPercent || 0) >= 0 ? "+" : ""}${(Number(data.ivPercent || 0) - Number(comparisonData.ivPercent || 0)).toFixed(1)}%</b>
                            </span>
                        </div>
                        <div class="aethra-item-tooltip__comparison-list">
                            ${comparisonStats.length ? comparisonStats.slice(0, 6).map((entry) => `
                                <span>
                                    <small>${escapeHTML(this.getStatLabel(entry.stat))}</small>
                                    <em>${escapeHTML(this.formatStatValue(entry.stat, entry.equipped))} → ${escapeHTML(this.formatStatValue(entry.stat, entry.current))}</em>
                                    <b class="${entry.delta > 0 ? "is-positive" : "is-negative"}">${entry.delta > 0 ? "+" : ""}${escapeHTML(this.formatStatValue(entry.stat, entry.delta))}</b>
                                </span>
                            `).join("") : `<p>Sem diferença nos atributos principais.</p>`}
                        </div>
                    </section>
                `
                : "";

            const worldRankingHTML = data.worldRanking
                ? `
                    <div class="aethra-item-tooltip__world-rank">
                        <span>${Number(data.worldRanking.rank || 0) <= 3 ? ["", "Ⅰ", "Ⅱ", "Ⅲ"][Number(data.worldRanking.rank || 0)] : `#${Number(data.worldRanking.rank || 0)}`}</span>
                        <div>
                            <small>RANKING VIVO · ${escapeHTML(String(data.worldRanking.categoryLabel || "EQUIPAMENTOS").toUpperCase())}</small>
                            <strong>${escapeHTML(data.worldRanking.rankLabel || "Não ranqueado")} do servidor</strong>
                        </div>
                        <em>${formatNumber(data.worldRanking.score || 0)} poder<br>recorde #${formatNumber(data.worldRanking.bestRank || data.worldRanking.rank || 0)}</em>
                    </div>
                `
                : "";

            this.tooltip.style.setProperty(
                "--item-rarity-color",
                data.rarityColor || "#c7c7c7"
            );

            this.tooltip.innerHTML = `
                <header class="aethra-item-tooltip__header">
                    <div>
                        <strong>${escapeHTML(data.name)}</strong>
                        <span>${escapeHTML(data.rarity)} · ${escapeHTML(data.type)}</span>
                    </div>

                    <div class="aethra-item-tooltip__power">
                        <b class="aethra-item-tooltip__multiplier">
                            ${Number(data.multiplier || 1).toFixed(2)}x
                        </b>
                        <b class="aethra-item-tooltip__iv-badge">
                            IV ${Math.max(0, Math.min(100, Number(data.ivPercent ?? 100))).toFixed(1)}%
                        </b>
                    </div>
                </header>

                ${worldRankingHTML}

                ${stackHTML}

                <div class="aethra-item-tooltip__overall-iv">
                    <span>Roll global da peça</span>
                    <i><b style="width:${Math.max(0, Math.min(100, Number(data.ivPercent ?? 100))).toFixed(1)}%"></b></i>
                    <strong>${Math.max(0, Math.min(100, Number(data.ivPercent ?? 100))).toFixed(1)}%</strong>
                </div>

                <div class="aethra-item-tooltip__stat-head">
                    <span>Atributo</span>
                    <small>Base</small>
                    <em>Bônus</em>
                    <strong>Final</strong>
                </div>

                <div class="aethra-item-tooltip__stats-list">
                    ${statsHTML}
                </div>

                ${affixesHTML}

                ${comparisonHTML}

                <p>${escapeHTML(data.description || "Sem descrição.")}</p>

                <footer class="aethra-item-tooltip__footer">
                    <span>
                        Qualidade ${formatNumber(data.quality || 0)} ·
                        Potencial ${formatNumber(data.potential || 0)}
                    </span>

                    <strong>
                        ${data.resaleValue > 0
                            ? `${formatNumber(data.resaleValue)} Gold`
                            : escapeHTML(data.resaleLabel || "Sem revenda")}
                    </strong>
                </footer>
            `;

            this.tooltip.hidden = false;
            this.moveTooltip(event);
        },

        moveTooltip(event) {
            if (!this.tooltip || this.tooltip.hidden) return;

            const margin = 14;
            const tooltipRect = this.tooltip.getBoundingClientRect();

            let x = event.clientX + margin;
            let y = event.clientY + margin;

            if (x + tooltipRect.width > window.innerWidth - margin) {
                x = event.clientX - tooltipRect.width - margin;
            }

            if (y + tooltipRect.height > window.innerHeight - margin) {
                y = event.clientY - tooltipRect.height - margin;
            }

            this.tooltip.style.transform =
                `translate(${Math.max(margin, x)}px, ${Math.max(margin, y)}px)`;
        },

        hideTooltip() {
            if (this.tooltip) {
                this.tooltip.hidden = true;
            }
        },

        flashCurrency(currency) {
            const selectors =
                currency === "diamonds"
                    ? [
                        "[data-currency='diamonds']",
                        "#diamonds-display",
                        "#hero-diamonds"
                    ]
                    : [
                        "[data-currency='gold']",
                        "#gold-display",
                        "#hero-gold",
                        "#stats-display"
                    ];

            document
                .querySelectorAll(selectors.join(","))
                .forEach((element) => {
                    element.classList.remove("aethra-currency-flash");

                    // Reinicia a animação quando transações são rápidas.
                    void element.offsetWidth;

                    element.classList.add("aethra-currency-flash");

                    window.setTimeout(() => {
                        element.classList.remove(
                            "aethra-currency-flash"
                        );
                    }, 700);
                });
        },

        animateTransaction(mode) {
            document
                .querySelectorAll(
                    `[data-shop-mode="${mode}"]`
                )
                .forEach((container) => {
                    container.classList.remove(
                        "aethra-shop-transaction"
                    );

                    void container.offsetWidth;

                    container.classList.add(
                        "aethra-shop-transaction"
                    );

                    window.setTimeout(() => {
                        container.classList.remove(
                            "aethra-shop-transaction"
                        );
                    }, 450);
                });
        },

        createToast() {
            if (document.getElementById("aethra-shop-toast")) {
                this.toast = document.getElementById(
                    "aethra-shop-toast"
                );
                return;
            }

            this.toast = document.createElement("div");
            this.toast.id = "aethra-shop-toast";
            this.toast.className = "aethra-shop-toast";
            this.toast.hidden = true;

            document.body.appendChild(this.toast);
        },

        notify(message, type = "info", options = {}) {
            if (!this.toast) return;

            this.toast.textContent = message;
            this.toast.className =
                `aethra-shop-toast aethra-shop-toast--${type}`;
            this.toast.style.removeProperty("color");

            if (options.color) {
                this.toast.style.color = options.color;
            }

            this.toast.hidden = false;

            window.clearTimeout(this._toastTimer);

            this._toastTimer = window.setTimeout(() => {
                this.toast.hidden = true;
            }, 2200);
        },

        injectStyles() {
            if (document.getElementById("aethra-shop-renderer-styles")) {
                return;
            }

            const style = document.createElement("style");
            style.id = "aethra-shop-renderer-styles";

            style.textContent = `
                #npc-shop-grid,
                #npc-sell-grid,
                #premium-shop-grid,
                #player-market-grid,
                [data-shop-mode] {
                    display: grid;
                    grid-template-columns: repeat(
                        auto-fill,
                        minmax(190px, 1fr)
                    );
                    gap: 12px;
                }

                .aethra-shop-card {
                    position: relative;
                    display: grid;
                    gap: 10px;
                    min-height: 235px;
                    padding: 14px;
                    border: 1px solid rgba(101, 145, 196, .34);
                    border-radius: 14px;
                    background:
                        linear-gradient(
                            180deg,
                            rgba(18, 39, 63, .97),
                            rgba(7, 18, 31, .98)
                        );
                    color: #ecf4ff;
                    box-shadow: 0 12px 30px rgba(0, 0, 0, .22);
                    transition:
                        transform .16s ease,
                        border-color .16s ease,
                        box-shadow .16s ease;
                }

                .aethra-shop-card:hover {
                    z-index: 2;
                    border-color: rgba(102, 182, 255, .78);
                    box-shadow: 0 18px 40px rgba(0, 0, 0, .35);
                    transform: translateY(-3px);
                }

                .aethra-shop-card.is-disabled {
                    opacity: .72;
                }

                .aethra-shop-card__media {
                    position: relative;
                    display: grid;
                    place-items: center;
                    width: 100%;
                    min-height: 104px;
                    overflow: hidden;
                    border: 1px solid rgba(242, 207, 115, .24);
                    border-radius: 10px;
                    background:
                        radial-gradient(
                            circle,
                            rgba(242, 207, 115, .12),
                            rgba(4, 14, 25, .62) 68%
                        );
                }

                .aethra-shop-card__image {
                    display: block;
                    width: 80px;
                    height: 80px;
                    object-fit: contain;
                    image-rendering: pixelated;
                    image-rendering: crisp-edges;
                    filter:
                        drop-shadow(0 7px 8px rgba(0, 0, 0, .48));
                    transition:
                        transform .16s ease,
                        filter .16s ease;
                }

                .aethra-shop-card:hover
                .aethra-shop-card__image {
                    transform: scale(1.08);
                    filter:
                        brightness(1.08)
                        drop-shadow(0 9px 10px rgba(0, 0, 0, .56));
                }

                .aethra-shop-card__image-fallback,
                .aethra-creature-portrait__fallback {
                    display: grid;
                    place-items: center;
                    width: 68px;
                    height: 68px;
                    border: 1px solid rgba(242, 207, 115, .35);
                    border-radius: 12px;
                    background: rgba(242, 207, 115, .08);
                    color: #f2cf73;
                    font-size: 28px;
                    font-weight: 800;
                }

                .aethra-creature-portrait {
                    display: grid;
                    grid-template-columns: 96px minmax(0, 1fr);
                    align-items: center;
                    gap: 14px;
                    padding: 12px;
                    border: 1px solid rgba(242, 207, 115, .28);
                    border-radius: 12px;
                    background: rgba(4, 14, 25, .68);
                }

                .aethra-creature-portrait__image {
                    display: block;
                    width: 96px;
                    height: 96px;
                    object-fit: contain;
                    image-rendering: pixelated;
                    image-rendering: crisp-edges;
                    filter:
                        drop-shadow(0 8px 9px rgba(0, 0, 0, .55));
                }

                .aethra-creature-portrait__info {
                    display: grid;
                    gap: 3px;
                }

                .aethra-creature-portrait__info strong {
                    color: #f2cf73;
                    font-size: 18px;
                }

                .aethra-creature-portrait__info span {
                    color: #92a9c5;
                    font-size: 12px;
                }

                .aethra-shop-card__header,
                .aethra-shop-card__stats,
                .aethra-shop-price {
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                }

                .aethra-shop-card__rarity,
                .aethra-shop-card__type,
                .aethra-shop-card__seller,
                .aethra-shop-card__sale-type {
                    color: #92a9c5;
                    font-size: 11px;
                    letter-spacing: .06em;
                    text-transform: uppercase;
                }

                .aethra-shop-card__name {
                    margin: 0;
                    font-size: 17px;
                    line-height: 1.25;
                }

                .aethra-shop-card__stats {
                    padding: 9px;
                    border: 1px solid rgba(99, 139, 186, .23);
                    border-radius: 9px;
                    background: rgba(4, 14, 25, .48);
                    color: #aebfd3;
                    font-size: 12px;
                }

                .aethra-shop-price {
                    align-items: center;
                    margin-top: auto;
                    padding-top: 10px;
                    border-top: 1px solid rgba(112, 148, 187, .2);
                }

                .aethra-shop-price span {
                    color: #91a7c0;
                    font-size: 12px;
                }

                .aethra-shop-price strong {
                    color: #f2cf73;
                }

                .aethra-shop-price--insufficient strong {
                    color: #ff615b;
                }

                .aethra-shop-action {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #67aeea;
                    border-radius: 9px;
                    background:
                        linear-gradient(180deg, #286ca5, #17466f);
                    color: white;
                    font: inherit;
                    font-weight: 700;
                    cursor: pointer;
                }

                .aethra-shop-action:hover:not(:disabled) {
                    filter: brightness(1.12);
                }

                .aethra-shop-action.disabled,
                .aethra-shop-action:disabled {
                    border-color: rgba(120, 138, 158, .4);
                    background: #293644;
                    color: #77899d;
                    cursor: not-allowed;
                }

                .aethra-shop-action.is-processing {
                    opacity: .6;
                    pointer-events: none;
                }

                .aethra-shop-empty {
                    grid-column: 1 / -1;
                    padding: 24px;
                    border: 1px dashed rgba(100, 143, 191, .4);
                    border-radius: 12px;
                    color: #8196b1;
                    text-align: center;
                }

                .aethra-shop-tooltip {
                    position: fixed;
                    top: 0;
                    left: 0;
                    z-index: 20000;
                    width: min(290px, calc(100vw - 28px));
                    padding: 12px;
                    border: 1px solid rgba(107, 171, 231, .62);
                    border-radius: 10px;
                    background: rgba(3, 11, 20, .97);
                    color: #edf5ff;
                    box-shadow: 0 15px 45px rgba(0, 0, 0, .52);
                    pointer-events: none;
                }

                .aethra-shop-tooltip > strong,
                .aethra-shop-tooltip > span {
                    display: block;
                }

                .aethra-shop-tooltip > span {
                    margin-top: 3px;
                    color: #8fa6c1;
                    font-size: 11px;
                    text-transform: uppercase;
                }

                .aethra-shop-tooltip__stats {
                    display: flex;
                    gap: 14px;
                    margin-top: 10px;
                    color: #b9c7d8;
                    font-size: 12px;
                }

                .aethra-shop-tooltip__value {
                    margin-top: 9px;
                    padding-top: 9px;
                    border-top: 1px solid rgba(98, 135, 177, .25);
                    font-size: 12px;
                }

                .aethra-shop-tooltip p {
                    margin: 9px 0 0;
                    color: #a9b9cb;
                    font-size: 12px;
                    line-height: 1.45;
                }

                .aethra-shop-toast {
                    position: fixed;
                    top: 18px;
                    left: 50%;
                    z-index: 21000;
                    padding: 10px 16px;
                    border: 1px solid rgba(110, 157, 207, .45);
                    border-radius: 999px;
                    background: rgba(7, 18, 31, .96);
                    color: #edf5ff;
                    box-shadow: 0 12px 35px rgba(0, 0, 0, .35);
                    transform: translateX(-50%);
                    animation: aethra-toast-in .2s ease;
                }

                .aethra-shop-toast--success {
                    border-color: rgba(74, 211, 149, .65);
                    color: #75e2b0;
                }

                .aethra-shop-toast--error {
                    border-color: rgba(255, 97, 91, .65);
                    color: #ff827d;
                }

                .aethra-currency-flash {
                    animation: aethra-currency-flash .65s ease;
                }

                .aethra-shop-transaction {
                    animation: aethra-shop-transaction .4s ease;
                }

                @keyframes aethra-currency-flash {
                    0% {
                        filter: brightness(1);
                        transform: scale(1);
                    }

                    35% {
                        filter: brightness(1.8);
                        transform: scale(1.035);
                    }

                    100% {
                        filter: brightness(1);
                        transform: scale(1);
                    }
                }

                @keyframes aethra-shop-transaction {
                    0% {
                        opacity: .7;
                    }

                    45% {
                        opacity: 1;
                        transform: scale(.992);
                    }

                    100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                @keyframes aethra-toast-in {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -8px);
                    }

                    to {
                        opacity: 1;
                        transform: translate(-50%, 0);
                    }
                }
            `;

            document.head.appendChild(style);
        }
    };

    /*
     * UI_Renderer já exerce o papel do UIManager nesta arquitetura.
     * O alias mantém compatibilidade com integrações que usam esse nome.
     */
    Aethra.UIManager = Aethra.UI_Renderer;

    function startRenderer() {
        Aethra.UI_Renderer.init();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            startRenderer,
            { once: true }
        );
    } else {
        startRenderer();
    }
})(window.Aethra);
