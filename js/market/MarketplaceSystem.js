// MarketplaceSystem.js - Ecossistema de Mercados da Aethra Engine
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus) {
        throw new Error(
            "MarketplaceSystem.js requer game-core.js carregado antes deste arquivo."
        );
    }

    const DEFAULT_TAX_RATE = 0.05;
    const DEFAULT_SELLBACK_RATE = 0.50;

    const clone = (value) => JSON.parse(JSON.stringify(value));

    function uniqueId(prefix) {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return `${prefix}_${window.crypto.randomUUID()}`;
        }

        return [
            prefix,
            Date.now(),
            Math.floor(Math.random() * 1000000)
        ].join("_");
    }

    function ensureHeroState() {
        const hero = Aethra.GameState.hero;

        if (!hero.stats || typeof hero.stats !== "object") {
            hero.stats = {};
        }

        if (!Array.isArray(hero.bag)) {
            hero.bag = [];
        }

        if (!Number.isFinite(Number(hero.gold))) {
            hero.gold = Number(hero.stats.gold || 0);
        }

        if (!Number.isFinite(Number(hero.diamonds))) {
            hero.diamonds = Number(hero.stats.diamonds || 0);
        }

        hero.gold = Math.max(0, Number(hero.gold || 0));
        hero.diamonds = Math.max(0, Number(hero.diamonds || 0));

        hero.stats.gold = hero.gold;
        hero.stats.diamonds = hero.diamonds;

        return hero;
    }

    function ensureMarketState() {
        const state = Aethra.GameState;

        if (!state.playerMarket || typeof state.playerMarket !== "object") {
            state.playerMarket = {};
        }

        const market = state.playerMarket;

        if (!Array.isArray(market.listings)) {
            market.listings = [];
        }

        if (!Array.isArray(market.history)) {
            market.history = [];
        }

        if (!market.sellerBalances || typeof market.sellerBalances !== "object") {
            market.sellerBalances = {};
        }

        if (!Number.isFinite(Number(market.treasuryGold))) {
            market.treasuryGold = 0;
        }

        if (!Number.isFinite(Number(market.transactionTaxRate))) {
            market.transactionTaxRate = DEFAULT_TAX_RATE;
        }

        market.transactionTaxRate = Math.min(
            0.25,
            Math.max(0, Number(market.transactionTaxRate))
        );

        return market;
    }

    function getTemplate(itemId) {
        if (!itemId || !Aethra.GameData) {
            return null;
        }

        if (typeof Aethra.GameData.getItem === "function") {
            return Aethra.GameData.getItem(itemId);
        }

        const template = Aethra.GameData.items?.[itemId];
        return template ? clone(template) : null;
    }

    function getTemplateId(item) {
        return item?.templateId || item?.id || null;
    }

    function getItemBasePrice(item) {
        const templateId = getTemplateId(item);
        const template = templateId ? getTemplate(templateId) : null;

        return Math.max(
            0,
            Math.floor(
                Number(
                    item?.price ??
                    item?.value ??
                    template?.price ??
                    template?.value ??
                    0
                )
            )
        );
    }

    function findInventoryItem(itemId) {
        const hero = ensureHeroState();

        let index = hero.bag.findIndex(
            (item) => item.instanceId === itemId
        );

        if (index === -1) {
            index = hero.bag.findIndex((item) => {
                return (
                    item.templateId === itemId ||
                    item.id === itemId
                );
            });
        }

        if (index === -1) {
            return null;
        }

        return {
            index,
            item: hero.bag[index]
        };
    }

    function createFallbackInstance(templateId, template, metadata = {}) {
        return {
            instanceId: uniqueId(`item_${templateId}`),
            templateId,
            id: templateId,
            name: template.name || templateId,
            type: template.type || "misc",
            itemType: String(template.itemType || template.type || "misc").toUpperCase(),
            slot: template.slot || null,
            icon: template.icon || template.image || null,
            image: template.image || template.icon || null,
            description: template.description || "",
            quantity: template.stackable
                ? Math.max(1, Math.floor(Number(metadata.quantity) || 1))
                : 1,
            stackable: Boolean(template.stackable),
            maxStack: Number(template.maxStack || 1),
            quality: 50,
            potential: 50,
            rarity: template.rarity || "Comum",
            price: Number(template.price || template.value || 0),
            stats: {
                damage:
                    Number(template.damage || 0),
                damageMin:
                    Number(template.damageMin ?? template.damage ?? 0),
                damageMax:
                    Number(template.damageMax ?? template.damage ?? 0),
                defense:
                    Number(template.defense || 0)
            },
            market: {
                ...metadata
            },
            origin: {
                source: metadata.source || "marketplace",
                createdAt: new Date().toISOString()
            },
            createdAt: Date.now()
        };
    }

    function createItemInstance(templateId, metadata = {}) {
        const template = getTemplate(templateId);

        if (!template) {
            return null;
        }

        let item = null;

        if (
            Aethra.ItemSystem &&
            typeof Aethra.ItemSystem.generateItem === "function"
        ) {
            item = Aethra.ItemSystem.generateItem(templateId, {
                source: metadata.source || "marketplace",
                qualityMin: metadata.qualityMin,
                qualityMax: metadata.qualityMax,
                quantity: metadata.quantity
            });
        } else if (
            Aethra.ItemSystem &&
            typeof Aethra.ItemSystem.generateInstance === "function"
        ) {
            item = Aethra.ItemSystem.generateInstance(templateId);
        }

        if (!item) {
            item = createFallbackInstance(templateId, template, metadata);
        }

        item.market = {
            ...(item.market || {}),
            ...metadata
        };

        return item;
    }

    function addItemToBag(item, source) {
        const hero = ensureHeroState();
        const result = Aethra.BagSystem?.addItems
            ? Aethra.BagSystem.addItems([item], source)
            : null;

        if (result && result.added.length === 0) return false;
        if (!result) hero.bag.push(item);

        const payload = {
            item: clone(item),
            items: [clone(item)],
            source
        };

        Aethra.EventBus.emit("ItemAcquired", payload);
        Aethra.EventBus.emit("inventory:item-added", payload);
        Aethra.EventBus.emit("inventory:changed", {
            reason: "item-added",
            source,
            bag: clone(hero.bag)
        });
        return true;
    }

    function removeItemFromBag(index, source) {
        const hero = ensureHeroState();

        if (index < 0 || index >= hero.bag.length) {
            return null;
        }

        const candidate = hero.bag[index];
        const item = candidate?.instanceId && Aethra.BagSystem?.removeItem
            ? Aethra.BagSystem.removeItem(candidate.instanceId, source)
            : hero.bag.splice(index, 1)[0];

        if (!item) return null;

        const payload = {
            item: clone(item),
            source
        };

        if (!candidate?.instanceId || !Aethra.BagSystem?.removeItem) {
            Aethra.EventBus.emit("inventory:item-removed", payload);
        }
        Aethra.EventBus.emit("inventory:changed", {
            reason: "item-removed",
            source,
            bag: clone(hero.bag)
        });

        return item;
    }

    function setGold(amount, reason, delta) {
        const hero = ensureHeroState();

        hero.gold = Math.max(0, Math.floor(Number(amount || 0)));
        hero.stats.gold = hero.gold;

        Aethra.EventBus.emit("goldChanged", {
            total: hero.gold,
            amount: Number(delta || 0),
            reason
        });

        Aethra.EventBus.emit("market:currency-changed", {
            currency: "gold",
            total: hero.gold,
            amount: Number(delta || 0),
            reason
        });
    }

    function setDiamonds(amount, reason, delta) {
        const hero = ensureHeroState();

        hero.diamonds = Math.max(0, Math.floor(Number(amount || 0)));
        hero.stats.diamonds = hero.diamonds;

        Aethra.EventBus.emit("diamondsChanged", {
            total: hero.diamonds,
            amount: Number(delta || 0),
            reason
        });

        Aethra.EventBus.emit("market:currency-changed", {
            currency: "diamonds",
            total: hero.diamonds,
            amount: Number(delta || 0),
            reason
        });
    }

    Aethra.MarketplaceSystem = {
        initialized: false,
        lockedListings: new Set(),

        premiumCatalog: {
            premium_founder_blade: {
                id: "premium_founder_blade",
                name: "Lâmina do Fundador",
                type: "weapon",
                slot: "weapon",
                diamondPrice: 120,
                exclusive: true,
                noSellBack: true,
                noPlayerMarket: true,
                stats: {
                    damageMin: 10,
                    damageMax: 14
                }
            },

            premium_health_crystal: {
                id: "premium_health_crystal",
                name: "Cristal Vital",
                type: "consumable",
                diamondPrice: 20,
                exclusive: true,
                noSellBack: true,
                noPlayerMarket: true,
                effect: "heal",
                healAmount: 50
            }
        },

        init() {
            if (this.initialized) {
                return this.getMarketState();
            }

            ensureHeroState();
            ensureMarketState();

            this.initialized = true;

            Aethra.EventBus.emit("MarketplaceReady", this.getMarketState());
            Aethra.EventBus.emit("market:ready", this.getMarketState());

            return this.getMarketState();
        },

        // =========================================================
        // NPC SHOP
        // =========================================================

        buyItem(itemId, quantity = 1) {
            const hero = ensureHeroState();
            const template = getTemplate(itemId);
            const amount = Math.max(1, Math.floor(Number(quantity || 1)));

            if (!template) {
                return this.fail("buyItem", "item-not-found", { itemId });
            }

            const unitPrice = Math.max(
                0,
                Math.floor(Number(template.price || template.value || 0))
            );

            if (unitPrice <= 0) {
                return this.fail("buyItem", "invalid-price", { itemId });
            }

            const totalPrice = unitPrice * amount;

            if (hero.gold < totalPrice) {
                return this.fail("buyItem", "insufficient-gold", {
                    itemId,
                    required: totalPrice,
                    available: hero.gold
                });
            }

            const purchasedItems = [];
            const instancesToCreate = template.stackable ? 1 : amount;

            for (let index = 0; index < instancesToCreate; index += 1) {
                const item = createItemInstance(itemId, {
                    source: "npc-shop",
                    purchaseOrigin: "npc-shop",
                    purchasePrice: unitPrice,
                    purchasedAt: Date.now(),
                    sellBackEligible: true,
                    sellBackRate: DEFAULT_SELLBACK_RATE,
                    premium: false,
                    quantity: template.stackable ? amount : 1
                });

                if (!item) {
                    return this.fail("buyItem", "instance-generation-failed", {
                        itemId
                    });
                }

                purchasedItems.push(item);
            }

            setGold(
                hero.gold - totalPrice,
                "npc-shop-purchase",
                -totalPrice
            );

            purchasedItems.forEach((item) => {
                addItemToBag(item, "npc-shop");
            });

            const payload = {
                itemId,
                quantity: amount,
                unitPrice,
                totalPrice,
                items: clone(purchasedItems)
            };

            Aethra.EventBus.emit("NPCItemPurchased", payload);
            Aethra.EventBus.emit("market:npc-item-purchased", payload);

            this.save();

            return payload;
        },

        sellLoot(itemId) {
            const hero = ensureHeroState();
            const found = findInventoryItem(itemId);

            if (!found) {
                return this.fail("sellLoot", "item-not-in-inventory", {
                    itemId
                });
            }

            const item = found.item;
            const origin = item.market?.purchaseOrigin || item.source || null;

            const isLoot =
                origin === "loot" ||
                origin === "enemy-drop" ||
                origin === "hunt-loot" ||
                origin === "hunt-system" ||
                origin === "monster-economy" ||
                origin === "battle-hunt" ||
                item.type === "loot" ||
                item.type === "material";

            if (!isLoot) {
                return this.fail("sellLoot", "item-is-not-loot", {
                    itemId,
                    instanceId: item.instanceId
                });
            }

            const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
            const salePrice = getItemBasePrice(item) * quantity;

            if (salePrice <= 0) {
                return this.fail("sellLoot", "invalid-price", {
                    itemId
                });
            }

            const soldItem = removeItemFromBag(found.index, "npc-loot-sale");

            setGold(
                hero.gold + salePrice,
                "npc-loot-sale",
                salePrice
            );

            const payload = {
                item: clone(soldItem),
                salePrice,
                quantity,
                rate: 1
            };

            Aethra.EventBus.emit("LootSold", payload);
            Aethra.EventBus.emit("market:loot-sold", payload);

            this.save();

            return payload;
        },

        sellBack(itemId) {
            const hero = ensureHeroState();
            const found = findInventoryItem(itemId);

            if (!found) {
                return this.fail("sellBack", "item-not-in-inventory", {
                    itemId
                });
            }

            const item = found.item;
            const marketData = item.market || {};

            if (
                marketData.premium === true ||
                marketData.noSellBack === true ||
                item.noSellBack === true
            ) {
                return this.fail("sellBack", "sellback-disabled", {
                    itemId,
                    instanceId: item.instanceId
                });
            }

            if (
                marketData.purchaseOrigin !== "npc-shop" ||
                marketData.sellBackEligible !== true
            ) {
                return this.fail("sellBack", "item-not-eligible", {
                    itemId,
                    instanceId: item.instanceId
                });
            }

            const unitPurchasePrice = Math.max(
                0,
                Number(
                    marketData.purchasePrice ||
                    getItemBasePrice(item)
                )
            );

            const rate = Math.min(
                1,
                Math.max(
                    0,
                    Number(
                        marketData.sellBackRate ??
                        DEFAULT_SELLBACK_RATE
                    )
                )
            );

            const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
            const purchasePrice = unitPurchasePrice * quantity;
            const salePrice = Math.floor(purchasePrice * rate);

            const soldItem = removeItemFromBag(found.index, "npc-sellback");

            setGold(
                hero.gold + salePrice,
                "npc-sellback",
                salePrice
            );

            const payload = {
                item: clone(soldItem),
                unitPurchasePrice,
                purchasePrice,
                salePrice,
                quantity,
                rate
            };

            Aethra.EventBus.emit("ItemSoldBack", payload);
            Aethra.EventBus.emit("market:item-sold-back", payload);

            this.save();

            return payload;
        },

        // =========================================================
        // PREMIUM SHOP
        // =========================================================

        buyPremiumItem(itemId, quantity = 1) {
            const hero = ensureHeroState();
            const premiumTemplate = this.premiumCatalog[itemId];
            const amount = Math.max(1, Math.floor(Number(quantity || 1)));

            if (!premiumTemplate) {
                return this.fail(
                    "buyPremiumItem",
                    "premium-item-not-found",
                    { itemId }
                );
            }

            const unitPrice = Math.max(
                0,
                Math.floor(Number(premiumTemplate.diamondPrice || 0))
            );

            const totalPrice = unitPrice * amount;

            if (unitPrice <= 0) {
                return this.fail(
                    "buyPremiumItem",
                    "invalid-diamond-price",
                    { itemId }
                );
            }

            if (hero.diamonds < totalPrice) {
                return this.fail(
                    "buyPremiumItem",
                    "insufficient-diamonds",
                    {
                        itemId,
                        required: totalPrice,
                        available: hero.diamonds
                    }
                );
            }

            const purchasedItems = [];

            for (let index = 0; index < amount; index += 1) {
                const item = {
                    instanceId: uniqueId(`premium_${itemId}`),
                    templateId: itemId,
                    id: itemId,
                    name: premiumTemplate.name,
                    type: premiumTemplate.type,
                    slot: premiumTemplate.slot || null,
                    rarity: "Premium",
                    quality: 100,
                    potential: 100,
                    stats: clone(premiumTemplate.stats || {}),
                    effect: premiumTemplate.effect || null,
                    healAmount: Number(premiumTemplate.healAmount || 0),
                    noSellBack: true,
                    noPlayerMarket: true,
                    market: {
                        source: "premium-shop",
                        purchaseOrigin: "premium-shop",
                        premium: true,
                        exclusive: true,
                        purchasePriceDiamonds: unitPrice,
                        noSellBack: true,
                        noPlayerMarket: true,
                        purchasedAt: Date.now()
                    },
                    createdAt: Date.now()
                };

                purchasedItems.push(item);
            }

            setDiamonds(
                hero.diamonds - totalPrice,
                "premium-shop-purchase",
                -totalPrice
            );

            purchasedItems.forEach((item) => {
                addItemToBag(item, "premium-shop");
            });

            const payload = {
                itemId,
                quantity: amount,
                unitPrice,
                totalPrice,
                currency: "diamonds",
                items: clone(purchasedItems)
            };

            Aethra.EventBus.emit("PremiumItemPurchased", payload);
            Aethra.EventBus.emit("market:premium-item-purchased", payload);

            this.save();

            return payload;
        },

        registerPremiumItem(itemId, data) {
            if (!itemId || !data || typeof data !== "object") {
                return false;
            }

            this.premiumCatalog[itemId] = {
                id: itemId,
                exclusive: true,
                noSellBack: true,
                noPlayerMarket: true,
                ...clone(data)
            };

            Aethra.EventBus.emit("market:premium-item-registered", {
                itemId,
                item: clone(this.premiumCatalog[itemId])
            });

            return true;
        },

        // =========================================================
        // PLAYER MARKET
        // =========================================================

        listForSale(itemId, price) {
            const hero = ensureHeroState();
            const market = ensureMarketState();
            const found = findInventoryItem(itemId);
            const listingPrice = Math.floor(Number(price || 0));

            if (!found) {
                return this.fail(
                    "listForSale",
                    "item-not-in-inventory",
                    { itemId }
                );
            }

            if (listingPrice <= 0) {
                return this.fail(
                    "listForSale",
                    "invalid-listing-price",
                    { itemId, price }
                );
            }

            const item = found.item;

            if (
                item.noPlayerMarket === true ||
                item.market?.noPlayerMarket === true ||
                item.market?.premium === true ||
                item.bound === true
            ) {
                return this.fail(
                    "listForSale",
                    "item-cannot-be-listed",
                    {
                        itemId,
                        instanceId: item.instanceId
                    }
                );
            }

            const removedItem = removeItemFromBag(
                found.index,
                "player-market-listing"
            );

            const listing = {
                listingId: uniqueId("listing"),
                sellerId: hero.id || hero.name || "local-player",
                sellerName: hero.name || "Jogador",
                item: clone(removedItem),
                price: listingPrice,
                currency: "gold",
                status: "active",
                createdAt: Date.now(),
                soldAt: null,
                buyerId: null,
                tax: 0,
                sellerNet: 0
            };

            market.listings.push(listing);

            const payload = clone(listing);

            Aethra.EventBus.emit("PlayerMarketListingCreated", payload);
            Aethra.EventBus.emit("market:listing-created", payload);

            this.save();

            return payload;
        },

        buyFromPlayer(listingId) {
            const hero = ensureHeroState();
            const market = ensureMarketState();

            if (this.lockedListings.has(listingId)) {
                return this.fail(
                    "buyFromPlayer",
                    "listing-locked",
                    { listingId }
                );
            }

            const listingIndex = market.listings.findIndex(
                (listing) =>
                    listing.listingId === listingId &&
                    listing.status === "active"
            );

            if (listingIndex === -1) {
                return this.fail(
                    "buyFromPlayer",
                    "listing-not-found",
                    { listingId }
                );
            }

            const listing = market.listings[listingIndex];
            const buyerId = hero.id || hero.name || "local-player";

            if (listing.sellerId === buyerId) {
                return this.fail(
                    "buyFromPlayer",
                    "cannot-buy-own-listing",
                    { listingId }
                );
            }

            if (hero.gold < listing.price) {
                return this.fail(
                    "buyFromPlayer",
                    "insufficient-gold",
                    {
                        listingId,
                        required: listing.price,
                        available: hero.gold
                    }
                );
            }

            this.lockedListings.add(listingId);

            try {
                const taxRate = market.transactionTaxRate;
                const tax = Math.max(
                    1,
                    Math.floor(listing.price * taxRate)
                );

                const sellerNet = Math.max(0, listing.price - tax);

                setGold(
                    hero.gold - listing.price,
                    "player-market-purchase",
                    -listing.price
                );

                market.treasuryGold += tax;

                market.sellerBalances[listing.sellerId] =
                    Number(market.sellerBalances[listing.sellerId] || 0) +
                    sellerNet;

                listing.status = "sold";
                listing.soldAt = Date.now();
                listing.buyerId = buyerId;
                listing.tax = tax;
                listing.sellerNet = sellerNet;

                const purchasedItem = clone(listing.item);

                purchasedItem.market = {
                    ...(purchasedItem.market || {}),
                    source: "player-market",
                    purchaseOrigin: "player-market",
                    playerMarketPrice: listing.price,
                    purchasedAt: Date.now(),
                    sellerId: listing.sellerId,
                    noSellBack: true,
                    sellBackEligible: false
                };

                addItemToBag(purchasedItem, "player-market");

                market.history.push(clone(listing));

                const payload = {
                    listingId,
                    buyerId,
                    sellerId: listing.sellerId,
                    item: clone(purchasedItem),
                    price: listing.price,
                    tax,
                    taxRate,
                    sellerNet
                };

                Aethra.EventBus.emit("PlayerMarketPurchaseCompleted", payload);
                Aethra.EventBus.emit("market:purchase-completed", payload);

                this.save();

                return payload;
            } finally {
                this.lockedListings.delete(listingId);
            }
        },

        cancelListing(listingId) {
            const hero = ensureHeroState();
            const market = ensureMarketState();

            const listing = market.listings.find(
                (entry) =>
                    entry.listingId === listingId &&
                    entry.status === "active"
            );

            if (!listing) {
                return this.fail(
                    "cancelListing",
                    "listing-not-found",
                    { listingId }
                );
            }

            const sellerId = hero.id || hero.name || "local-player";

            if (listing.sellerId !== sellerId) {
                return this.fail(
                    "cancelListing",
                    "not-listing-owner",
                    { listingId }
                );
            }

            listing.status = "cancelled";
            listing.cancelledAt = Date.now();

            addItemToBag(clone(listing.item), "player-market-cancel");

            market.history.push(clone(listing));

            const payload = {
                listingId,
                item: clone(listing.item)
            };

            Aethra.EventBus.emit("PlayerMarketListingCancelled", payload);
            Aethra.EventBus.emit("market:listing-cancelled", payload);

            this.save();

            return payload;
        },

        claimSellerBalance(sellerId = null) {
            const hero = ensureHeroState();
            const market = ensureMarketState();
            const resolvedSellerId =
                sellerId ||
                hero.id ||
                hero.name ||
                "local-player";

            const balance = Math.max(
                0,
                Math.floor(
                    Number(market.sellerBalances[resolvedSellerId] || 0)
                )
            );

            if (balance <= 0) {
                return this.fail(
                    "claimSellerBalance",
                    "no-balance",
                    { sellerId: resolvedSellerId }
                );
            }

            market.sellerBalances[resolvedSellerId] = 0;

            setGold(
                hero.gold + balance,
                "player-market-seller-payout",
                balance
            );

            const payload = {
                sellerId: resolvedSellerId,
                amount: balance
            };

            Aethra.EventBus.emit("PlayerMarketBalanceClaimed", payload);
            Aethra.EventBus.emit("market:seller-balance-claimed", payload);

            this.save();

            return payload;
        },

        getActiveListings() {
            return clone(
                ensureMarketState().listings.filter(
                    (listing) => listing.status === "active"
                )
            );
        },

        getMarketState() {
            return clone(ensureMarketState());
        },

        fail(operation, reason, details = {}) {
            const payload = {
                operation,
                reason,
                ...clone(details)
            };

            Aethra.EventBus.emit("MarketplaceOperationFailed", payload);
            Aethra.EventBus.emit("market:operation-failed", payload);

            console.warn(
                `MarketplaceSystem: ${operation} falhou (${reason}).`,
                details
            );

            return false;
        },

        save() {
            if (
                Aethra.SaveManager &&
                typeof Aethra.SaveManager.save === "function"
            ) {
                Aethra.SaveManager.save("marketplace");
            }
        }
    };

    Aethra.MarketplaceSystem.init();
})(window.Aethra);
