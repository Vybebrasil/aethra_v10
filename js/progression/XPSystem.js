// XPSystem.js - Progressão geométrica orientada por Aethra.GameData
window.Aethra = window.Aethra || {};

(function (Aethra) {
    "use strict";

    const DEFAULT_XP_NEXT = 100;
    const FALLBACK_XP_MULTIPLIER = 1.0057337263598426;

    function toSafeNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    Aethra.XPSystem = {
        initialized: false,

        init() {
            if (this.initialized) return;

            if (!Aethra.GameState) {
                throw new Error("Aethra.GameState não foi carregado antes de XPSystem.js.");
            }

            if (!Aethra.EventBus || typeof Aethra.EventBus.on !== "function") {
                throw new Error("Aethra.EventBus não foi carregado antes de XPSystem.js.");
            }

            this.ensureState();

            Aethra.EventBus.on("EnemyDefeated", (data = {}) => {
                const xp = toSafeNumber(data.xp, 0);
                if (xp > 0) this.addXP(xp, data);
            });

            this.initialized = true;
            Aethra.EventBus.emit("xp:ready", this.getSnapshot());
        },

        getMaxLevel() {
            return Math.max(
                1,
                Math.floor(
                    toSafeNumber(
                        Aethra.GameData?.balance?.progression?.maxLevel,
                        1000
                    )
                )
            );
        },

        getXPRequired(level) {
            const progression = Aethra.GameData?.balance?.progression;

            if (progression && typeof progression.getXPRequired === "function") {
                return progression.getXPRequired(level);
            }

            const safeLevel = Math.max(1, Math.floor(toSafeNumber(level, 1)));
            return Math.max(
                1,
                Math.round(
                    DEFAULT_XP_NEXT * FALLBACK_XP_MULTIPLIER ** (safeLevel - 1)
                )
            );
        },

        ensureState() {
            const state = Aethra.GameState;

            state.hero = state.hero || {};
            state.hero.stats = state.hero.stats || {};
            state.hunt = state.hunt || {};

            if (!Number.isInteger(state.hero.level) || state.hero.level < 1) {
                state.hero.level = 1;
            }

            state.hero.level = Math.min(state.hero.level, this.getMaxLevel());
            state.hero.xpTotal = Math.max(0, toSafeNumber(state.hero.xpTotal, 0));
            state.hero.xpCurrent = Math.max(0, toSafeNumber(state.hero.xpCurrent, 0));
            state.hero.xpNext = state.hero.level >= this.getMaxLevel()
                ? 0
                : this.getXPRequired(state.hero.level);

            state.hero.stats.str = toSafeNumber(state.hero.stats.str, 14);
            state.hero.stats.mag = toSafeNumber(state.hero.stats.mag, 10);
            state.hero.stats.maxHp = toSafeNumber(state.hero.stats.maxHp, 100);
            state.hero.stats.maxFocus = toSafeNumber(state.hero.stats.maxFocus, 50);

            state.hunt.xp = Math.max(0, toSafeNumber(state.hunt.xp, 0));
        },

        addXP(amount, source = {}) {
            this.ensureState();

            const value = Math.floor(toSafeNumber(amount, 0));
            if (value <= 0) return this.getSnapshot();

            const hero = Aethra.GameState.hero;
            const hunt = Aethra.GameState.hunt;
            const maxLevel = this.getMaxLevel();

            if (hero.level >= maxLevel) {
                return this.getSnapshot();
            }

            hero.xpTotal += value;
            hero.xpCurrent += value;
            hunt.xp += value;

            const levelsGained = [];

            while (
                hero.level < maxLevel &&
                hero.xpNext > 0 &&
                hero.xpCurrent >= hero.xpNext
            ) {
                hero.xpCurrent -= hero.xpNext;
                levelsGained.push(this.levelUp({ save: false, source }));
            }

            if (hero.level >= maxLevel) {
                hero.xpCurrent = 0;
                hero.xpNext = 0;
            }

            const snapshot = this.getSnapshot();

            Aethra.EventBus.emit("xpChanged", {
                amount: value,
                source,
                levelsGained: levelsGained.length,
                ...snapshot
            });

            Aethra.EventBus.emit("hunt:xpChanged", {
                amount: value,
                huntXP: hunt.xp,
                source
            });

            this.save();
            return snapshot;
        },

        levelUp(options = {}) {
            this.ensureState();

            const hero = Aethra.GameState.hero;
            const maxLevel = this.getMaxLevel();

            if (hero.level >= maxLevel) {
                return this.getSnapshot();
            }

            const previousLevel = hero.level;
            const previousXpNext = hero.xpNext;

            hero.level += 1;
            hero.xpNext = hero.level >= maxLevel
                ? 0
                : this.getXPRequired(hero.level);

            // Crescimento controlado: atributos avançam em marcos, evitando números inflados.
            if (hero.level % 5 === 0) hero.stats.str += 1;
            hero.stats.maxHp += 1;
            if (hero.level % 10 === 0) hero.stats.maxFocus += 1;

            if (Object.prototype.hasOwnProperty.call(hero, "hp")) {
                hero.hp = hero.stats.maxHp;
            }

            if (Object.prototype.hasOwnProperty.call(hero, "focus")) {
                hero.focus = hero.stats.maxFocus;
            }

            const payload = {
                previousLevel,
                level: hero.level,
                previousXpNext,
                xpNext: hero.xpNext,
                xpCurrent: hero.xpCurrent,
                xpTotal: hero.xpTotal,
                stats: clone(hero.stats),
                source: options.source || null
            };

            Aethra.EventBus.emit("levelUp", payload);
            Aethra.EventBus.emit("statsChanged", {
                reason: "levelUp",
                stats: clone(hero.stats),
                level: hero.level
            });

            if (options.save !== false) this.save();
            return payload;
        },

        getSnapshot() {
            this.ensureState();

            const hero = Aethra.GameState.hero;
            const progress = hero.xpNext > 0
                ? Math.min(100, Math.max(0, (hero.xpCurrent / hero.xpNext) * 100))
                : 100;

            return {
                currentLevel: hero.level,
                maxLevel: this.getMaxLevel(),
                xpCurrent: hero.xpCurrent,
                xpTotal: hero.xpTotal,
                xpNext: hero.xpNext,
                progressPercent: Number(progress.toFixed(2)),
                huntXP: Aethra.GameState.hunt.xp
            };
        },

        resetHuntXP() {
            this.ensureState();
            Aethra.GameState.hunt.xp = 0;
            Aethra.EventBus.emit("hunt:xpChanged", {
                amount: 0,
                huntXP: 0,
                reset: true
            });
            this.save();
        },

        save() {
            if (Aethra.SaveManager && typeof Aethra.SaveManager.save === "function") {
                Aethra.SaveManager.save();
            }
        }
    };

    Aethra.XPSystem.init();
})(window.Aethra);
