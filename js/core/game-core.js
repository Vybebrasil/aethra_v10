// game-core.js
// Núcleo central de estado, eventos e salvamento de Crônicas de Aethra.
// Compatível com uso direto no navegador, sem servidor e sem módulos ES.

window.Aethra = window.Aethra || {};

(function initAethraCore(Aethra) {
    "use strict";

    const SAVE_KEY = "aethra_save";
    const SAVE_VERSION = 1;

    const clone = (value) => JSON.parse(JSON.stringify(value));

    const createEmptyEquipment = () => ({
        weapon: null,
        offhand: null,
        head: null,
        chest: null,
        hands: null,
        legs: null,
        feet: null,
        neck: null,
        ring1: null,
        ring2: null,
        relic: null
    });

    const createInitialState = () => {
        const playerEquipment = createEmptyEquipment();

        const baseStats = {
            str: 6,
            mag: 4,
            precision: 2,
            vitality: 0,
            agility: 0,
            damageMin: 2,
            damageMax: 4,
            damage: 3,
            defense: 0,
            critical: 0.04,
            criticalMultiplier: 1.75,
            evasion: 0,
            maxHp: 46,
            hp: 46,
            maxMana: 26,
            mana: 26,
            maxEnergy: 72,
            energy: 72
        };

        return {
            meta: {
                version: SAVE_VERSION,
                lastSavedAt: null
            },

            playerEquipment,

            hero: {
                name: "Novo Herói",
                characterCreated: false,
                level: 1,
                xpCurrent: 0,
                xpTotal: 0,
                skillPoints: 0,
                gold: 100,
                baseStats: clone(baseStats),
                stats: clone(baseStats),
                hp: baseStats.hp,
                maxHp: baseStats.maxHp,
                mana: baseStats.mana,
                maxMana: baseStats.maxMana,
                energy: baseStats.energy,
                maxEnergy: baseStats.maxEnergy,
                bag: [],
                equipment: playerEquipment
            },

            hunt: {
                isActive: false,
                kills: 0,
                xp: 0
            }
        };
    };

    // 1. Estado Central
    // HUD, Inventário, Combate, Loot e demais sistemas devem ler deste objeto.
    Aethra.GameState = createInitialState();

    // 2. Barramento de Eventos
    Aethra.EventBus = {
        listeners: Object.create(null),

        on(event, fn) {
            if (typeof event !== "string" || !event.trim()) {
                throw new TypeError("EventBus.on: o nome do evento deve ser uma string válida.");
            }

            if (typeof fn !== "function") {
                throw new TypeError("EventBus.on: o listener deve ser uma função.");
            }

            if (!this.listeners[event]) {
                this.listeners[event] = [];
            }

            this.listeners[event].push(fn);

            // Retorna uma função para cancelar a inscrição.
            return () => this.off(event, fn);
        },

        off(event, fn) {
            const eventListeners = this.listeners[event];
            if (!eventListeners) return false;

            const index = eventListeners.indexOf(fn);
            if (index === -1) return false;

            eventListeners.splice(index, 1);

            if (eventListeners.length === 0) {
                delete this.listeners[event];
            }

            return true;
        },

        once(event, fn) {
            const wrapped = (data) => {
                this.off(event, wrapped);
                fn(data);
            };

            return this.on(event, wrapped);
        },

        emit(event, data) {
            const eventListeners = this.listeners[event];
            if (!eventListeners || eventListeners.length === 0) return;

            // Cria uma cópia para evitar problemas caso um listener seja removido durante o emit.
            [...eventListeners].forEach((fn) => {
                try {
                    fn(data);
                } catch (error) {
                    console.error(`[Aethra.EventBus] Erro no evento "${event}":`, error);
                }
            });
        },

        clear(event) {
            if (typeof event === "string") {
                delete this.listeners[event];
                return;
            }

            this.listeners = Object.create(null);
        }
    };

    // 3. Gerenciador de Estado
    // Evita que cada HUD altere o estado de forma diferente.
    Aethra.StateManager = {
        get(path) {
            if (!path) return Aethra.GameState;

            return path.split(".").reduce((current, key) => {
                if (current == null) return undefined;
                return current[key];
            }, Aethra.GameState);
        },

        set(path, value, options = {}) {
            if (typeof path !== "string" || !path.trim()) {
                throw new TypeError("StateManager.set: o caminho deve ser uma string válida.");
            }

            const keys = path.split(".");
            const finalKey = keys.pop();
            let target = Aethra.GameState;

            keys.forEach((key) => {
                if (
                    typeof target[key] !== "object" ||
                    target[key] === null ||
                    Array.isArray(target[key])
                ) {
                    target[key] = {};
                }

                target = target[key];
            });

            const previousValue = target[finalKey];
            target[finalKey] = value;

            const payload = {
                path,
                value,
                previousValue,
                source: options.source || "unknown"
            };

            Aethra.EventBus.emit("state:changed", payload);
            Aethra.EventBus.emit(`${path}:changed`, payload);

            const rootSection = path.split(".")[0];
            Aethra.EventBus.emit(`${rootSection}:changed`, payload);

            if (options.save === true) {
                Aethra.SaveManager.save();
            }

            return value;
        },

        update(path, updater, options = {}) {
            if (typeof updater !== "function") {
                throw new TypeError("StateManager.update: updater deve ser uma função.");
            }

            const currentValue = this.get(path);
            const nextValue = updater(currentValue);
            return this.set(path, nextValue, options);
        },

        push(path, item, options = {}) {
            const currentValue = this.get(path);

            if (!Array.isArray(currentValue)) {
                throw new TypeError(`StateManager.push: "${path}" não é um array.`);
            }

            const nextValue = [...currentValue, item];
            this.set(path, nextValue, options);
            return item;
        },

        remove(path, predicate, options = {}) {
            const currentValue = this.get(path);

            if (!Array.isArray(currentValue)) {
                throw new TypeError(`StateManager.remove: "${path}" não é um array.`);
            }

            const matcher = typeof predicate === "function"
                ? predicate
                : (item) => item === predicate;

            const removed = currentValue.filter(matcher);
            const nextValue = currentValue.filter((item) => !matcher(item));

            this.set(path, nextValue, options);
            return removed;
        },

        replace(nextState, options = {}) {
            if (!nextState || typeof nextState !== "object") {
                throw new TypeError("StateManager.replace: o novo estado deve ser um objeto.");
            }

            const previousState = Aethra.GameState;
            Aethra.GameState = nextState;

            Aethra.EventBus.emit("state:replaced", {
                state: Aethra.GameState,
                previousState,
                source: options.source || "unknown"
            });

            if (options.save === true) {
                Aethra.SaveManager.save();
            }

            return Aethra.GameState;
        },

        reset(options = {}) {
            const freshState = createInitialState();
            this.replace(freshState, {
                source: options.source || "reset",
                save: options.save === true
            });

            Aethra.EventBus.emit("game:reset", clone(freshState));
            return Aethra.GameState;
        }
    };

    // 4. Gerenciador de Salvamento
    Aethra.SaveManager = {
        key: SAVE_KEY,

        save() {
            try {
                Aethra.GameState.meta = Aethra.GameState.meta || {};
                Aethra.GameState.meta.version = SAVE_VERSION;
                Aethra.GameState.meta.lastSavedAt = new Date().toISOString();

                localStorage.setItem(this.key, JSON.stringify(Aethra.GameState));

                Aethra.EventBus.emit("save:completed", {
                    key: this.key,
                    savedAt: Aethra.GameState.meta.lastSavedAt
                });

                return true;
            } catch (error) {
                console.error("[Aethra.SaveManager] Falha ao salvar:", error);
                Aethra.EventBus.emit("save:failed", { error });
                return false;
            }
        },

        load() {
            try {
                const rawData = localStorage.getItem(this.key);
                if (!rawData) {
                    Aethra.EventBus.emit("save:not-found", { key: this.key });
                    return false;
                }

                const parsedData = JSON.parse(rawData);

                if (!parsedData || typeof parsedData !== "object") {
                    throw new Error("Save inválido.");
                }

                Aethra.StateManager.replace(parsedData, { source: "save-load" });
                Aethra.EventBus.emit("save:loaded", clone(Aethra.GameState));
                return true;
            } catch (error) {
                console.error("[Aethra.SaveManager] Falha ao carregar:", error);
                Aethra.EventBus.emit("save:failed", { error });
                return false;
            }
        },

        exists() {
            return localStorage.getItem(this.key) !== null;
        },

        clear() {
            try {
                localStorage.removeItem(this.key);
                Aethra.EventBus.emit("save:cleared", { key: this.key });
                return true;
            } catch (error) {
                console.error("[Aethra.SaveManager] Falha ao limpar save:", error);
                Aethra.EventBus.emit("save:failed", { error });
                return false;
            }
        }
    };

    // 5. Comandos básicos usados pelos sistemas do jogo.
    Aethra.Commands = {
        addGold(amount, source = "system") {
            if (!Number.isFinite(amount)) {
                throw new TypeError("Commands.addGold: amount deve ser numérico.");
            }

            return Aethra.StateManager.update(
                "hero.gold",
                (gold = 0) => Math.max(0, gold + amount),
                { source }
            );
        },

        addItem(item, source = "loot") {
            if (!item || typeof item !== "object") {
                throw new TypeError("Commands.addItem: item inválido.");
            }

            Aethra.StateManager.push("hero.bag", item, { source });
            Aethra.EventBus.emit("inventory:item-added", { item, source });
            return item;
        },

        startHunt(source = "hunt-system") {
            Aethra.StateManager.set("hunt.isActive", true, { source });
            Aethra.EventBus.emit("hunt:started", clone(Aethra.GameState.hunt));
        },

        stopHunt(source = "hunt-system") {
            Aethra.StateManager.set("hunt.isActive", false, { source });
            Aethra.EventBus.emit("hunt:stopped", clone(Aethra.GameState.hunt));
        },

        registerKill({ xp = 0, loot = [], source = "combat-system" } = {}) {
            Aethra.StateManager.update("hunt.kills", (kills = 0) => kills + 1, { source });
            Aethra.StateManager.update("hunt.xp", (currentXp = 0) => currentXp + xp, { source });

            loot.forEach((item) => this.addItem(item, source));

            const payload = {
                kills: Aethra.GameState.hunt.kills,
                xpEarned: xp,
                totalXp: Aethra.GameState.hunt.xp,
                loot
            };

            Aethra.EventBus.emit("combat:enemy-defeated", payload);
            return payload;
        }
    };

    // Evento disparado quando o núcleo termina de carregar.
    Aethra.EventBus.emit("core:ready", {
        state: Aethra.GameState,
        version: SAVE_VERSION
    });
})(window.Aethra);
