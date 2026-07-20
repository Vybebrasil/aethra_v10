// EntityManager.js - Estado reativo das entidades do mundo
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus) {
        throw new Error(
            "EntityManager.js requer game-core.js carregado antes deste arquivo."
        );
    }

    function clone(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }

    function finiteNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function normalizeEntity(entity) {
        if (!entity || typeof entity !== "object") {
            throw new TypeError("A entidade precisa ser um objeto.");
        }

        const id = String(entity.id || "").trim();
        const name = String(entity.name || "").trim();
        const spriteUrl = String(
            entity.sprite_url || entity.spriteUrl || ""
        ).trim();

        if (!id) {
            throw new Error("Toda entidade precisa de um id.");
        }

        if (!name) {
            throw new Error(`A entidade ${id} precisa de um name.`);
        }

        if (!spriteUrl) {
            throw new Error(`A entidade ${id} precisa de um sprite_url.`);
        }

        return {
            id,
            name,
            sprite_url: spriteUrl,
            x: finiteNumber(entity.x, 0),
            y: finiteNumber(entity.y, 0),
            type: entity.type || "npc",
            width: Math.max(1, finiteNumber(entity.width, 32)),
            height: Math.max(1, finiteNumber(entity.height, 32)),
            visible: entity.visible !== false,
            interactive: entity.interactive !== false,
            metadata: clone(entity.metadata || {})
        };
    }

    Aethra.EntityManager = {
        initialized: false,

        defaultEntities: [
            {
                id: "player",
                name: "Aventureiro",
                sprite_url: "assets/entities/player_idle.png",
                x: 100,
                y: 100,
                type: "player",
                width: 32,
                height: 32,
                interactive: true
            },
            {
                id: "merchant",
                name: "Mercador",
                sprite_url: "assets/entities/npc_idle.png",
                x: 200,
                y: 150,
                type: "npc",
                width: 32,
                height: 32,
                interactive: true,
                metadata: {
                    role: "merchant",
                    opensWindow: "npc-shop-view"
                }
            }
        ],

        ensureState() {
            if (!Aethra.GameState.entities) {
                Aethra.GameState.entities = {
                    list: []
                };
            }

            if (!Array.isArray(Aethra.GameState.entities.list)) {
                Aethra.GameState.entities.list = [];
            }

            return Aethra.GameState.entities;
        },

        init(options = {}) {
            const state = this.ensureState();

            if (this.initialized) {
                return this.getEntities();
            }

            const seedDefaults = options.seedDefaults !== false;

            if (seedDefaults && state.list.length === 0) {
                this.defaultEntities.forEach((entity) => {
                    this.addEntity(entity, {
                        silent: true,
                        replace: false
                    });
                });
            } else {
                state.list = state.list.map(normalizeEntity);
            }

            this.initialized = true;

            const payload = {
                entities: this.getEntities(),
                count: state.list.length
            };

            Aethra.EventBus.emit("EntityManagerReady", payload);
            Aethra.EventBus.emit("entity:manager-ready", clone(payload));

            return payload.entities;
        },

        addEntity(entity, options = {}) {
            const state = this.ensureState();
            const normalized = normalizeEntity(entity);
            const existingIndex = state.list.findIndex(
                (entry) => entry.id === normalized.id
            );

            if (existingIndex !== -1) {
                if (options.replace !== true) {
                    return false;
                }

                state.list[existingIndex] = normalized;
            } else {
                state.list.push(normalized);
            }

            if (!options.silent) {
                const payload = {
                    entity: clone(normalized),
                    replaced: existingIndex !== -1
                };

                Aethra.EventBus.emit("EntityAdded", payload);
                Aethra.EventBus.emit("entity:added", clone(payload));
                this.emitChanged("add", normalized.id);
            }

            return clone(normalized);
        },

        updateEntity(entityId, changes = {}) {
            const state = this.ensureState();
            const index = state.list.findIndex(
                (entity) => entity.id === entityId
            );

            if (index === -1) return false;

            const updated = normalizeEntity({
                ...state.list[index],
                ...changes,
                id: state.list[index].id
            });

            state.list[index] = updated;

            const payload = {
                entity: clone(updated),
                changes: clone(changes)
            };

            Aethra.EventBus.emit("EntityUpdated", payload);
            Aethra.EventBus.emit("entity:updated", clone(payload));
            this.emitChanged("update", entityId);

            return clone(updated);
        },

        moveEntity(entityId, x, y, options = {}) {
            const state = this.ensureState();
            const index = state.list.findIndex(
                (entity) => entity.id === entityId
            );

            if (index === -1) return false;

            const previous = {
                x: state.list[index].x,
                y: state.list[index].y
            };

            const nextX = finiteNumber(x, previous.x);
            const nextY = finiteNumber(y, previous.y);

            state.list[index] = {
                ...state.list[index],
                x: nextX,
                y: nextY,
                metadata: {
                    ...(state.list[index].metadata || {}),
                    direction:
                        options.direction ||
                        state.list[index].metadata?.direction ||
                        "down"
                }
            };

            const updated = clone(state.list[index]);

            const payload = {
                entity: updated,
                previous,
                position: {
                    x: nextX,
                    y: nextY
                },
                direction:
                    options.direction ||
                    updated.metadata?.direction ||
                    "down",
                source: options.source || "entity-manager"
            };

            Aethra.EventBus.emit("EntityMoved", payload);
            Aethra.EventBus.emit("entity:moved", clone(payload));

            return updated;
        },

        removeEntity(entityId) {
            const state = this.ensureState();
            const index = state.list.findIndex(
                (entity) => entity.id === entityId
            );

            if (index === -1) return false;

            const [removed] = state.list.splice(index, 1);
            const payload = {
                entity: clone(removed),
                entityId
            };

            Aethra.EventBus.emit("EntityRemoved", payload);
            Aethra.EventBus.emit("entity:removed", clone(payload));
            this.emitChanged("remove", entityId);

            return clone(removed);
        },


        getDistance(entityAOrId, entityBOrId) {
            const entityA =
                typeof entityAOrId === "string"
                    ? this.getEntity(entityAOrId)
                    : entityAOrId;
            const entityB =
                typeof entityBOrId === "string"
                    ? this.getEntity(entityBOrId)
                    : entityBOrId;

            if (!entityA || !entityB) return Infinity;

            const centerAX = Number(entityA.x || 0) +
                Number(entityA.width || 32) / 2;
            const centerAY = Number(entityA.y || 0) +
                Number(entityA.height || 32) / 2;
            const centerBX = Number(entityB.x || 0) +
                Number(entityB.width || 32) / 2;
            const centerBY = Number(entityB.y || 0) +
                Number(entityB.height || 32) / 2;

            return Math.hypot(
                centerBX - centerAX,
                centerBY - centerAY
            );
        },

        getNearbyEntities(entityId, radius = 72, options = {}) {
            const origin = this.getEntity(entityId);
            if (!origin) return [];

            return this.getEntities({ visibleOnly: true })
                .filter((entity) => {
                    if (entity.id === entityId) return false;
                    if (
                        options.interactiveOnly &&
                        entity.interactive === false
                    ) {
                        return false;
                    }
                    if (
                        options.type &&
                        entity.type !== options.type
                    ) {
                        return false;
                    }

                    return this.getDistance(origin, entity) <= radius;
                })
                .sort((a, b) => {
                    return (
                        this.getDistance(origin, a) -
                        this.getDistance(origin, b)
                    );
                });
        },

        getNearestInteractable(entityId = "player", radius = 72) {
            return (
                this.getNearbyEntities(entityId, radius, {
                    interactiveOnly: true
                })[0] || null
            );
        },

        interactWithEntity(entityId, options = {}) {
            const entity = this.getEntity(entityId);

            if (!entity || entity.interactive === false) {
                return false;
            }

            const payload = {
                entity: clone(entity),
                actorId: options.actorId || "player",
                source: options.source || "entity-interaction"
            };

            Aethra.EventBus.emit("EntityInteracted", payload);
            Aethra.EventBus.emit("entity:interacted", clone(payload));
            Aethra.EventBus.emit("NPCInteracted", {
                npcId: entity.id,
                entity: clone(entity),
                source: payload.source
            });

            const targetWindow = entity.metadata?.opensWindow;

            if (targetWindow) {
                Aethra.WindowManager?.openWindow?.(
                    targetWindow,
                    {
                        source: payload.source,
                        entityId: entity.id
                    }
                );
            }

            return payload;
        },

        setVisible(entityId, visible) {
            return this.updateEntity(entityId, {
                visible: Boolean(visible)
            });
        },

        getEntity(entityId) {
            const entity = this.ensureState().list.find(
                (entry) => entry.id === entityId
            );

            return entity ? clone(entity) : null;
        },

        getEntities(options = {}) {
            const entities = this.ensureState().list;
            const filtered = options.visibleOnly
                ? entities.filter((entity) => entity.visible !== false)
                : entities;

            return clone(filtered);
        },

        clear(options = {}) {
            const state = this.ensureState();
            const removed = clone(state.list);
            state.list = [];

            if (!options.silent) {
                Aethra.EventBus.emit("EntitiesCleared", {
                    removed
                });
                Aethra.EventBus.emit("entity:cleared", {
                    removed: clone(removed)
                });
                this.emitChanged("clear", null);
            }

            return removed;
        },

        emitChanged(reason, entityId) {
            const payload = {
                reason,
                entityId,
                entities: this.getEntities(),
                count: this.ensureState().list.length
            };

            Aethra.EventBus.emit("EntitiesChanged", payload);
            Aethra.EventBus.emit("entity:changed", clone(payload));
        }
    };
})(window.Aethra);
