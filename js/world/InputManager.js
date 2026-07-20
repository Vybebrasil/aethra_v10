// InputManager.js - Movimento WASD da Aethra Engine
(function (Aethra) {
    "use strict";

    if (
        !Aethra ||
        !Aethra.GameState ||
        !Aethra.EventBus ||
        !Aethra.EntityManager
    ) {
        throw new Error(
            "InputManager.js requer GameState, EventBus e EntityManager."
        );
    }

    const MOVEMENT_KEYS = Object.freeze({
        KeyW: { x: 0, y: -1, direction: "up" },
        KeyA: { x: -1, y: 0, direction: "left" },
        KeyS: { x: 0, y: 1, direction: "down" },
        KeyD: { x: 1, y: 0, direction: "right" }
    });

    function clamp(value, minimum, maximum) {
        return Math.min(maximum, Math.max(minimum, value));
    }

    function isTypingTarget(target) {
        if (!(target instanceof Element)) return false;

        return Boolean(
            target.closest(
                "input, textarea, select, [contenteditable='true']"
            )
        );
    }

    Aethra.InputManager = {
        initialized: false,
        playerId: "player",
        speed: 120,
        pressedKeys: new Set(),
        animationFrame: null,
        lastTimestamp: 0,
        lastDirection: "down",
        interactionRadius: 72,

        init(options = {}) {
            if (this.initialized) {
                return this.getState();
            }

            this.playerId = options.playerId || this.playerId;
            this.speed = Math.max(
                20,
                Number(options.speed || this.speed)
            );

            this.bindEvents();
            this.initialized = true;

            const payload = this.getState();

            Aethra.EventBus.emit("InputManagerReady", payload);
            Aethra.EventBus.emit("input:ready", payload);

            return payload;
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            this._onKeyDown = (event) => {
                if (isTypingTarget(event.target)) return;

                if (event.code === "Space") {
                    if (event.repeat || this.isMovementBlocked()) return;

                    event.preventDefault();
                    this.interactWithNearestEntity();
                    return;
                }

                if (!MOVEMENT_KEYS[event.code]) return;
                if (this.isMovementBlocked()) return;

                event.preventDefault();

                this.pressedKeys.add(event.code);
                this.startLoop();

                Aethra.EventBus.emit("input:key-down", {
                    code: event.code,
                    playerId: this.playerId
                });
            };

            this._onKeyUp = (event) => {
                if (!MOVEMENT_KEYS[event.code]) return;

                this.pressedKeys.delete(event.code);

                Aethra.EventBus.emit("input:key-up", {
                    code: event.code,
                    playerId: this.playerId
                });
            };

            this._onBlur = () => {
                this.stopMovement();
            };

            this._onVisibilityChange = () => {
                if (document.hidden) {
                    this.stopMovement();
                }
            };

            window.addEventListener("keydown", this._onKeyDown, {
                passive: false
            });

            window.addEventListener("keyup", this._onKeyUp);

            window.addEventListener("blur", this._onBlur);

            document.addEventListener(
                "visibilitychange",
                this._onVisibilityChange
            );

            Aethra.EventBus.on("WindowOpened", ({ layer }) => {
                if (layer === "modal") {
                    this.stopMovement();
                }
            });
        },

        isMovementBlocked() {
            const modalLayer = document.getElementById("modal-layer");

            return Boolean(
                modalLayer?.classList.contains("has-open-window")
            );
        },

        startLoop() {
            if (this.animationFrame !== null) return;

            this.lastTimestamp = performance.now();

            this.animationFrame = requestAnimationFrame(
                (timestamp) => this.update(timestamp)
            );
        },

        update(timestamp) {
            this.animationFrame = null;

            if (
                this.pressedKeys.size === 0 ||
                this.isMovementBlocked()
            ) {
                this.lastTimestamp = timestamp;
                return;
            }

            const deltaSeconds = Math.min(
                0.05,
                Math.max(0, (timestamp - this.lastTimestamp) / 1000)
            );

            this.lastTimestamp = timestamp;

            let movementX = 0;
            let movementY = 0;

            this.pressedKeys.forEach((code) => {
                const movement = MOVEMENT_KEYS[code];
                if (!movement) return;

                movementX += movement.x;
                movementY += movement.y;

                if (movement.x !== 0 || movement.y !== 0) {
                    this.lastDirection = movement.direction;
                }
            });

            if (movementX !== 0 || movementY !== 0) {
                const magnitude =
                    Math.hypot(movementX, movementY) || 1;

                movementX /= magnitude;
                movementY /= magnitude;

                this.movePlayer(
                    movementX * this.speed * deltaSeconds,
                    movementY * this.speed * deltaSeconds
                );
            }

            if (this.pressedKeys.size > 0) {
                this.animationFrame = requestAnimationFrame(
                    (nextTimestamp) => this.update(nextTimestamp)
                );
            }
        },

        movePlayer(deltaX, deltaY) {
            const player =
                Aethra.EntityManager.getEntity(this.playerId);

            if (!player) return false;

            const worldLayer =
                document.getElementById("world-layer");

            const worldWidth =
                worldLayer?.clientWidth || window.innerWidth;

            const worldHeight =
                worldLayer?.clientHeight || window.innerHeight;

            const spriteWidth = Math.max(
                1,
                Number(player.width || 32)
            );

            const spriteHeight = Math.max(
                1,
                Number(player.height || 32)
            );

            const nextX = clamp(
                Number(player.x || 0) + deltaX,
                0,
                Math.max(0, worldWidth - spriteWidth)
            );

            const nextY = clamp(
                Number(player.y || 0) + deltaY,
                0,
                Math.max(0, worldHeight - spriteHeight)
            );

            const moved = Aethra.EntityManager.moveEntity(
                this.playerId,
                Math.round(nextX * 100) / 100,
                Math.round(nextY * 100) / 100,
                {
                    direction: this.lastDirection,
                    source: "wasd"
                }
            );

            if (!moved) return false;

            Aethra.EventBus.emit("PlayerMovedByInput", {
                playerId: this.playerId,
                x: moved.x,
                y: moved.y,
                direction: this.lastDirection,
                source: "wasd"
            });

            Aethra.EventBus.emit("input:player-moved", {
                playerId: this.playerId,
                x: moved.x,
                y: moved.y,
                direction: this.lastDirection
            });

            return moved;
        },


        interactWithNearestEntity() {
            const entity =
                Aethra.EntityManager.getNearestInteractable?.(
                    this.playerId,
                    this.interactionRadius
                );

            if (!entity) {
                Aethra.EventBus.emit("interaction:none-nearby", {
                    playerId: this.playerId,
                    radius: this.interactionRadius
                });
                return false;
            }

            const result =
                Aethra.EntityManager.interactWithEntity?.(
                    entity.id,
                    {
                        actorId: this.playerId,
                        source: "space-key"
                    }
                );

            Aethra.EventBus.emit("input:interaction", {
                playerId: this.playerId,
                entity,
                success: Boolean(result)
            });

            return result;
        },

        stopMovement() {
            this.pressedKeys.clear();

            if (this.animationFrame !== null) {
                cancelAnimationFrame(this.animationFrame);
                this.animationFrame = null;
            }

            this.lastTimestamp = 0;
        },

        setSpeed(speed) {
            const numericSpeed = Number(speed);

            if (!Number.isFinite(numericSpeed) || numericSpeed <= 0) {
                return false;
            }

            this.speed = numericSpeed;

            Aethra.EventBus.emit("input:speed-changed", {
                speed: this.speed
            });

            return this.speed;
        },

        getState() {
            return {
                initialized: this.initialized,
                playerId: this.playerId,
                speed: this.speed,
                pressedKeys: [...this.pressedKeys],
                direction: this.lastDirection,
                interactionRadius: this.interactionRadius
            };
        },

        destroy() {
            this.stopMovement();

            if (!this._eventsBound) return true;

            window.removeEventListener(
                "keydown",
                this._onKeyDown
            );

            window.removeEventListener(
                "keyup",
                this._onKeyUp
            );

            window.removeEventListener(
                "blur",
                this._onBlur
            );

            document.removeEventListener(
                "visibilitychange",
                this._onVisibilityChange
            );

            this._eventsBound = false;
            this.initialized = false;

            return true;
        }
    };
})(window.Aethra);
