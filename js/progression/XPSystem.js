// XPSystem.js - Progressão geométrica orientada por Aethra.GameData
window.Aethra = window.Aethra || {};

(function (Aethra) {
    "use strict";

    const DEFAULT_XP_NEXT = 100;
    const FALLBACK_XP_MULTIPLIER = 1.0057337263598426;
    const SKILL_XP_BASE = 45;
    const SKILL_XP_SCALE = 20;
    const SKILL_XP_EXPONENT = 1.72;

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

        // Skills não possuem nível máximo. A curva polinomial continua crescendo
        // sem tornar os níveis altos matematicamente impossíveis como uma curva
        // exponencial faria.
        getSkillXPRequired(level) {
            const safeLevel = Math.max(1, Math.floor(toSafeNumber(level, 1)));
            const required = SKILL_XP_BASE + SKILL_XP_SCALE * ((safeLevel - 1) ** SKILL_XP_EXPONENT);
            return Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.round(required)));
        },

        // Bônus sem teto fixo: cresce para sempre, mas cada nível novo acrescenta
        // menos que o anterior. O retorno efetivo pode ser calibrado por domínio.
        getDiminishingSkillBonus(level, options = {}) {
            const safeLevel = Math.max(1, Math.floor(toSafeNumber(level, 1)));
            const scale = Math.max(0, toSafeNumber(options.scale, 12));
            const interval = Math.max(1, toSafeNumber(options.interval, 10));
            return Number((scale * Math.log1p((safeLevel - 1) / interval)).toFixed(4));
        },

        getSkillState(skillId) {
            Aethra.DisciplineSystem?.ensureState?.();
            return Aethra.GameState.hero?.disciplines?.[skillId] || null;
        },

        setSkillTrainingMode(skillId, mode = "training", source = "player-command") {
            const state = this.getSkillState(skillId);
            if (!state) return false;
            const normalized = mode === "locked" ? "locked" : "training";
            if (state.trainingMode === normalized) return clone(state);
            state.trainingMode = normalized;
            const payload = {
                skillId,
                mode: normalized,
                source,
                state: clone(state)
            };
            Aethra.EventBus.emit("skill:training-mode-changed", payload);
            Aethra.EventBus.emit("discipline:updated", payload);
            this.save();
            return clone(state);
        },

        grantSkillXP(skillId, amount, context = {}) {
            const definition = Aethra.DisciplineSystem?.definitions?.[skillId];
            const state = this.getSkillState(skillId);
            if (!definition || !state) {
                return { accepted: false, amount: 0, skillId, reason: "unknown-skill" };
            }

            const occurredAt = new Date().toISOString();
            const discoveredNow = state.discovered !== true;
            if (discoveredNow) {
                state.discovered = true;
                state.discoveredAt = occurredAt;
                Aethra.EventBus.emit("skill:discovered", {
                    skillId,
                    definition: clone(definition),
                    state: clone(state),
                    source: context.source || "skill-action",
                    occurredAt
                });
            }

            if (state.trainingMode === "locked") {
                const rejected = {
                    accepted: false,
                    amount: 0,
                    skillId,
                    discoveredNow,
                    reason: "training-locked",
                    source: context.source || "skill-action",
                    state: clone(state)
                };
                Aethra.EventBus.emit("skill:xp-rejected", rejected);
                if (discoveredNow) this.save();
                return rejected;
            }

            const baseAmount = Math.max(0, Math.floor(toSafeNumber(amount, 0)));
            if (baseAmount <= 0) {
                return { accepted: false, amount: 0, skillId, discoveredNow, reason: "no-xp" };
            }

            const difficulty = Math.max(1, Math.floor(toSafeNumber(context.difficulty, state.level)));
            const levelDelta = state.level - difficulty;
            let challengeMultiplier = 1;
            if (levelDelta > 100) challengeMultiplier = 0.05;
            else if (levelDelta > 40) challengeMultiplier = 0.15;
            else if (levelDelta > 20) challengeMultiplier = 0.4;
            else if (levelDelta < 0) challengeMultiplier = Math.min(1.5, 1 + Math.abs(levelDelta) * 0.03);

            const multiplier = Math.max(0, toSafeNumber(context.multiplier, 1)) * challengeMultiplier;
            const gain = Math.max(1, Math.floor(baseAmount * multiplier));
            state.xpCurrent += gain;
            state.xpTotal += gain;
            state.uses = Math.max(0, Math.floor(toSafeNumber(state.uses, 0))) + 1;
            state.lastUsedAt = occurredAt;

            const levelUps = [];
            while (state.xpCurrent >= state.xpNext) {
                state.xpCurrent -= state.xpNext;
                state.level += 1;
                state.xpNext = this.getSkillXPRequired(state.level);
                levelUps.push(state.level);
            }

            const payload = {
                accepted: true,
                skillId,
                id: skillId,
                amount: gain,
                baseAmount,
                multiplier,
                challengeMultiplier,
                difficulty,
                discoveredNow,
                levelsGained: levelUps.length,
                levelUps,
                source: context.source || "skill-action",
                occurredAt,
                state: clone(state)
            };
            Aethra.EventBus.emit("skill:xp-changed", payload);
            Aethra.EventBus.emit("skillXPChanged", payload);
            Aethra.EventBus.emit("discipline:xp-changed", payload);
            if (levelUps.length > 0) {
                Aethra.EventBus.emit("skill:level-up", payload);
                Aethra.EventBus.emit("discipline:level-up", payload);
            }
            this.save();
            return clone(payload);
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
            state.hero.skillPoints = Math.max(0, Math.floor(toSafeNumber(state.hero.skillPoints, 0)));
            state.hero.skillPointsEarned = Math.max(0, Math.floor(toSafeNumber(state.hero.skillPointsEarned, 0)));
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
            hero.skillPoints += 1;
            hero.skillPointsEarned += 1;
            hero.xpNext = hero.level >= maxLevel
                ? 0
                : this.getXPRequired(hero.level);

            // Crescimento controlado: atributos avançam em marcos, evitando números inflados.
            hero.baseStats = hero.baseStats || clone(hero.stats);
            if (hero.level % 5 === 0) {
                hero.stats.str += 1;
                hero.baseStats.str = toSafeNumber(hero.baseStats.str, hero.stats.str - 1) + 1;
            }
            hero.stats.maxHp += 1;
            hero.baseStats.maxHp = toSafeNumber(hero.baseStats.maxHp, hero.stats.maxHp - 1) + 1;
            if (hero.level % 10 === 0) {
                hero.stats.maxFocus = toSafeNumber(hero.stats.maxFocus, 50) + 1;
                hero.baseStats.maxFocus = toSafeNumber(hero.baseStats.maxFocus, hero.stats.maxFocus - 1) + 1;
            }

            if (Object.prototype.hasOwnProperty.call(hero, "hp")) {
                hero.hp = hero.stats.maxHp;
                hero.maxHp = hero.stats.maxHp;
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
                skillPointsAwarded: 1,
                skillPoints: hero.skillPoints,
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

        loseXP(amountOrRate = 0.10, source = {}) {
            this.ensureState();

            const hero = Aethra.GameState.hero;
            const current = Math.max(0, Math.floor(toSafeNumber(hero.xpCurrent, 0)));
            const numeric = Math.max(0, toSafeNumber(amountOrRate, 0));
            const requested = numeric > 0 && numeric < 1
                ? Math.max(current > 0 ? 1 : 0, Math.floor(current * numeric))
                : Math.floor(numeric);
            const lost = Math.min(current, requested);

            if (lost <= 0) {
                return { lost: 0, ...this.getSnapshot() };
            }

            hero.xpCurrent -= lost;
            hero.xpTotal = Math.max(0, hero.xpTotal - lost);

            const snapshot = this.getSnapshot();
            const payload = {
                amount: -lost,
                lost,
                source,
                ...snapshot
            };

            Aethra.EventBus.emit("xpChanged", payload);
            Aethra.EventBus.emit("hero:xp-lost", payload);
            this.save();
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
