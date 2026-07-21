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

        countItem(itemOrId) {
            const stringId = typeof itemOrId === "string" ? itemOrId : null;
            const instanceId = typeof itemOrId === "object"
                ? itemOrId?.instanceId
                : this.getItems().some((item) => item?.instanceId === stringId)
                    ? stringId
                    : null;
            const templateId = typeof itemOrId === "object"
                ? itemOrId?.templateId || itemOrId?.id
                : instanceId
                    ? null
                    : itemOrId;

            return this.getItems().reduce((total, item) => {
                const matches = instanceId
                    ? item?.instanceId === instanceId
                    : String(item?.templateId || item?.id || "") === String(templateId || "");
                if (!matches) return total;
                return total + Math.max(1, Math.floor(Number(item?.quantity) || 1));
            }, 0);
        },

        consumeItem(itemOrId, quantity = 1, source = "bag-system") {
            const requested = Math.max(1, Math.floor(Number(quantity) || 1));
            const stringId = typeof itemOrId === "string" ? itemOrId : null;
            const instanceId = typeof itemOrId === "object"
                ? itemOrId?.instanceId
                : this.getItems().some((item) => item?.instanceId === stringId)
                    ? stringId
                    : null;
            const templateId = typeof itemOrId === "object"
                ? itemOrId?.templateId || itemOrId?.id
                : instanceId
                    ? null
                    : itemOrId;
            const matches = (item) => instanceId
                ? item?.instanceId === instanceId
                : String(item?.templateId || item?.id || "") === String(templateId || "");
            const available = this.countItem(itemOrId);

            if (!templateId && !instanceId) return false;
            if (available < requested) {
                Aethra.EventBus.emit("bag:item-consume-failed", {
                    instanceId,
                    templateId,
                    requested,
                    available,
                    reason: "INSUFFICIENT_QUANTITY",
                    source
                });
                return false;
            }

            let remaining = requested;
            const consumed = [];
            const nextBag = [];

            this.getItems().forEach((item) => {
                if (remaining <= 0 || !matches(item)) {
                    nextBag.push(item);
                    return;
                }

                const currentQuantity = Math.max(1, Math.floor(Number(item?.quantity) || 1));
                const amount = Math.min(currentQuantity, remaining);
                const nextQuantity = currentQuantity - amount;
                remaining -= amount;
                consumed.push({ item: { ...item }, quantity: amount });

                if (nextQuantity > 0) {
                    nextBag.push({ ...item, quantity: nextQuantity });
                }
            });

            if (Aethra.StateManager?.set) {
                Aethra.StateManager.set("hero.bag", nextBag, { source });
            } else {
                Aethra.GameState.hero.bag = nextBag;
            }

            const payload = {
                instanceId,
                templateId: templateId || consumed[0]?.item?.templateId || consumed[0]?.item?.id,
                quantity: requested,
                consumed,
                source,
                bagSize: nextBag.length
            };
            Aethra.EventBus.emit("bag:item-consumed", payload);
            Aethra.EventBus.emit("inventory:changed", payload);
            return payload;
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
