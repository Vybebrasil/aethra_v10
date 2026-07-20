// BagSystem.js - Inventário orientado por GameState e EventBus
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus) {
        throw new Error("BagSystem.js requer game-core.js.");
    }

    const normalizeItems = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.items)) return payload.items;
        if (payload?.item) return [payload.item];
        if (payload && typeof payload === "object") return [payload];
        return [];
    };

    Aethra.BagSystem = {
        initialized: false,

        init() {
            if (this.initialized) return this.getItems();

            Aethra.GameState.hero = Aethra.GameState.hero || {};
            if (!Array.isArray(Aethra.GameState.hero.bag)) {
                Aethra.GameState.hero.bag = [];
            }

            this.bindEvents();
            this.initialized = true;

            Aethra.EventBus.emit("bag:ready", {
                itemCount: this.getItems().length
            });

            return this.getItems();
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            Aethra.EventBus.on("itemObtained", (payload) => {
                this.addItems(payload, "itemObtained");
            });

            Aethra.EventBus.on("state:replaced", () => {
                Aethra.GameState.hero = Aethra.GameState.hero || {};
                if (!Array.isArray(Aethra.GameState.hero.bag)) {
                    Aethra.GameState.hero.bag = [];
                }
            });
        },

        getItems() {
            const bag = Aethra.GameState.hero?.bag;
            return Array.isArray(bag) ? bag : [];
        },

        hasItem(instanceId) {
            return Boolean(
                instanceId &&
                this.getItems().some((item) => item?.instanceId === instanceId)
            );
        },

        addItem(item, source = "bag-system") {
            if (!item || typeof item !== "object") return false;

            if (item.instanceId && this.hasItem(item.instanceId)) {
                Aethra.EventBus.emit("bag:item-ignored", {
                    reason: "DUPLICATE_INSTANCE",
                    item,
                    source
                });
                return false;
            }

            if (Aethra.Commands?.addItem) {
                Aethra.Commands.addItem(item, source);
            } else {
                this.getItems().push(item);
                Aethra.EventBus.emit("hero.bag:changed", {
                    item,
                    source,
                    bag: this.getItems()
                });
            }

            return true;
        },

        addItems(payload, source = "bag-system") {
            const added = [];
            const ignored = [];

            normalizeItems(payload).forEach((item) => {
                if (this.addItem(item, source)) added.push(item);
                else ignored.push(item);
            });

            if (added.length > 0) {
                Aethra.EventBus.emit("bag:items-added", {
                    items: added,
                    ignored,
                    source,
                    bagSize: this.getItems().length
                });
            }

            return { added, ignored };
        },

        removeItem(instanceId, source = "bag-system") {
            const bag = this.getItems();
            const item = bag.find((entry) => entry?.instanceId === instanceId);
            if (!item) return null;

            const nextBag = bag.filter((entry) => entry?.instanceId !== instanceId);

            if (Aethra.StateManager?.set) {
                Aethra.StateManager.set("hero.bag", nextBag, { source });
            } else {
                Aethra.GameState.hero.bag = nextBag;
            }

            Aethra.EventBus.emit("bag:item-removed", {
                item,
                instanceId,
                source
            });
            Aethra.EventBus.emit("inventory:item-removed", {
                item,
                instanceId,
                source
            });

            return item;
        },

        clear(source = "bag-system") {
            if (Aethra.StateManager?.set) {
                Aethra.StateManager.set("hero.bag", [], { source });
            } else {
                Aethra.GameState.hero.bag = [];
            }

            Aethra.EventBus.emit("bag:cleared", { source });
            return true;
        }
    };
})(window.Aethra);
