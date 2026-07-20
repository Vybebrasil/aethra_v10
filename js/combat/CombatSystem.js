// CombatSystem.js
// Engine de combate em turnos/hits para Crônicas de Aethra V68.
// Requer game-core.js carregado antes deste arquivo.

window.Aethra = window.Aethra || {};

(function initCombatSystem(Aethra) {
    "use strict";

    if (!Aethra.GameState || !Aethra.EventBus) {
        throw new Error(
            "CombatSystem.js requer game-core.js carregado antes deste arquivo."
        );
    }

    const DEFAULTS = {
        turnDelay: 700,
        baseHitChance: 0.78,
        minimumHitChance: 0.05,
        maximumHitChance: 0.98,
        defaultCriticalChance: 0.1,
        defaultCriticalMultiplier: 2,
        defaultEvasion: 0.05,
        defaultBlockChance: 0,
        defaultBlockReduction: 0.4,
        maximumDefenseMitigation: 0.75
    };

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function safeNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function clone(value) {
        if (value === undefined) return undefined;
        return JSON.parse(JSON.stringify(value));
    }

    function createCombatId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return `combat_${window.crypto.randomUUID()}`;
        }

        return `combat_${Date.now().toString(36)}_${Math.random()
            .toString(36)
            .slice(2, 9)}`;
    }

    // Aceita chances em formato decimal (0.15) ou percentual (15).
    function normalizeChance(value, fallback = 0) {
        let chance = safeNumber(value, fallback);
        if (chance > 1) chance /= 100;
        return clamp(chance, 0, 1);
    }

    function getStats(combatant) {
        return combatant && combatant.stats ? combatant.stats : {};
    }

    function getCombatantId(combatant, fallback) {
        return combatant?.id || combatant?.instanceId || combatant?.name || fallback;
    }

    Aethra.CombatSystem = {
        initialized: false,
        timerId: null,
        randomSource: Math.random,
        lastCalculation: null,

        config: {
            autoCombat: true,
            turnDelay: DEFAULTS.turnDelay
        },

        init() {
            if (this.initialized) return;

            this.ensureState();

            Aethra.EventBus.on("game:reset", () => {
                this.stopCombat("game-reset");
                this.ensureState(true);
            });

            Aethra.EventBus.on("save:loaded", () => {
                // Um combate não deve continuar sozinho depois de recarregar a página.
                this.clearTimer();
                this.ensureState();
                Aethra.GameState.combat.isActive = false;
                Aethra.GameState.combat.turn = "hero";
            });

            this.initialized = true;

            Aethra.EventBus.emit("combat:ready", {
                config: clone(this.config),
                state: this.getSnapshot()
            });
        },

        ensureState(forceReset = false) {
            const state = Aethra.GameState;

            state.hero = state.hero || {};
            state.hero.stats = state.hero.stats || {};

            const heroStats = state.hero.stats;

            heroStats.str = safeNumber(heroStats.str, 14);
            heroStats.mag = safeNumber(heroStats.mag, 10);
            heroStats.precision = safeNumber(heroStats.precision, 20);
            heroStats.defense = safeNumber(heroStats.defense, 5);
            heroStats.critical = normalizeChance(
                heroStats.critical,
                DEFAULTS.defaultCriticalChance
            );
            heroStats.criticalMultiplier = Math.max(
                1,
                safeNumber(
                    heroStats.criticalMultiplier,
                    DEFAULTS.defaultCriticalMultiplier
                )
            );
            heroStats.evasion = normalizeChance(
                heroStats.evasion,
                DEFAULTS.defaultEvasion
            );
            heroStats.blockChance = normalizeChance(
                heroStats.blockChance ?? heroStats.block,
                DEFAULTS.defaultBlockChance
            );
            heroStats.blockReduction = normalizeChance(
                heroStats.blockReduction,
                DEFAULTS.defaultBlockReduction
            );
            heroStats.maxHp = Math.max(1, safeNumber(heroStats.maxHp, 100));

            if (!Number.isFinite(Number(state.hero.hp))) {
                state.hero.hp = heroStats.maxHp;
            }

            state.hero.hp = clamp(
                safeNumber(state.hero.hp, heroStats.maxHp),
                0,
                heroStats.maxHp
            );

            if (forceReset || !state.combat) {
                state.combat = {
                    isActive: false,
                    combatId: null,
                    round: 0,
                    turn: "hero",
                    enemy: null,
                    lastEnemy: null,
                    lastResult: null,
                    startedAt: null,
                    endedAt: null
                };
            } else {
                state.combat.isActive = Boolean(state.combat.isActive);
                state.combat.round = Math.max(
                    0,
                    Math.floor(safeNumber(state.combat.round, 0))
                );
                state.combat.turn = state.combat.turn === "enemy" ? "enemy" : "hero";
            }

            return state.combat;
        },

        setRandomSource(fn) {
            if (typeof fn !== "function") {
                throw new TypeError(
                    "CombatSystem.setRandomSource: fn deve ser uma função."
                );
            }

            this.randomSource = fn;
        },

        setTurnDelay(milliseconds) {
            const delay = Math.max(50, Math.floor(safeNumber(milliseconds, 700)));
            this.config.turnDelay = delay;
            return delay;
        },

        normalizeEnemy(enemy = {}) {
            const stats = enemy.stats || {};
            const maxHp = Math.max(
                1,
                safeNumber(enemy.maxHp ?? stats.maxHp ?? enemy.hp, 45)
            );

            return {
                ...clone(enemy),
                id: getCombatantId(enemy, "enemy"),
                role: "enemy",
                name: enemy.name || "Inimigo",
                hp: clamp(safeNumber(enemy.hp, maxHp), 0, maxHp),
                maxHp,
                xp: Math.max(0, Math.floor(safeNumber(enemy.xp, 0))),
                gold: Math.max(0, Math.floor(safeNumber(enemy.gold, 0))),
                stats: {
                    str: safeNumber(stats.str, 8),
                    mag: safeNumber(stats.mag, 0),
                    precision: safeNumber(stats.precision, 14),
                    defense: Math.max(0, safeNumber(stats.defense, 3)),
                    critical: normalizeChance(
                        stats.critical,
                        DEFAULTS.defaultCriticalChance
                    ),
                    criticalMultiplier: Math.max(
                        1,
                        safeNumber(
                            stats.criticalMultiplier,
                            DEFAULTS.defaultCriticalMultiplier
                        )
                    ),
                    evasion: normalizeChance(
                        stats.evasion,
                        DEFAULTS.defaultEvasion
                    ),
                    blockChance: normalizeChance(
                        stats.blockChance ?? stats.block,
                        DEFAULTS.defaultBlockChance
                    ),
                    blockReduction: normalizeChance(
                        stats.blockReduction,
                        DEFAULTS.defaultBlockReduction
                    ),
                    damageMin: safeNumber(stats.damageMin ?? enemy.damageMin, 0),
                    damageMax: safeNumber(stats.damageMax ?? enemy.damageMax, 0),
                    attackSpeed: Math.max(
                        100,
                        safeNumber(stats.attackSpeed, this.config.turnDelay)
                    )
                }
            };
        },

        getHeroCombatant() {
            this.ensureState();

            const hero = Aethra.GameState.hero;
            hero.id = hero.id || "hero";
            hero.role = "hero";
            hero.name = hero.name || "Aethra";
            hero.maxHp = hero.stats.maxHp;

            return hero;
        },

        /*
         * Calcula o dano sem alterar PV.
         * Por padrão retorna apenas o valor numérico para manter compatibilidade
         * com o exemplo inicial. Use { detailed: true } para obter todos os dados.
         */
        calculateDamage(attacker, defender, options = {}) {
            const attackerStats = getStats(attacker);
            const defenderStats = getStats(defender);

            const attackerId = getCombatantId(attacker, "attacker");
            const defenderId = getCombatantId(defender, "defender");

            const precision = Math.max(
                0,
                safeNumber(attackerStats.precision, 10)
            );

            const precisionBonus = precision <= 1
                ? precision * 0.2
                : (precision / (precision + 100)) * 0.28;

            const evasionChance = normalizeChance(
                defenderStats.evasion,
                DEFAULTS.defaultEvasion
            );

            const baseHitChance = normalizeChance(
                attackerStats.hitChance,
                DEFAULTS.baseHitChance
            );

            const hitChance = clamp(
                baseHitChance + precisionBonus - evasionChance,
                DEFAULTS.minimumHitChance,
                DEFAULTS.maximumHitChance
            );

            const hitRoll = this.randomSource();

            if (hitRoll > hitChance) {
                const missResult = {
                    amount: 0,
                    hit: false,
                    missed: true,
                    reason: "evasion",
                    attackerId,
                    targetId: defenderId,
                    hitChance,
                    hitRoll,
                    isCrit: false,
                    isBlocked: false,
                    rawDamage: 0,
                    defenseMitigation: 0,
                    blockReduction: 0
                };

                this.lastCalculation = missResult;
                return options.detailed === true ? clone(missResult) : 0;
            }

            const strength = Math.max(0, safeNumber(attackerStats.str, 1));
            const magic = Math.max(0, safeNumber(attackerStats.mag, 0));
            const scalingStat = attackerStats.damageType === "magic"
                ? magic
                : strength;

            const fallbackDamage = Math.max(1, scalingStat * 1.5);

            let damageMin = safeNumber(
                attackerStats.damageMin ?? attackerStats.attackMin,
                fallbackDamage * 0.85
            );

            let damageMax = safeNumber(
                attackerStats.damageMax ?? attackerStats.attackMax,
                fallbackDamage * 1.15
            );

            damageMin = Math.max(1, damageMin);
            damageMax = Math.max(damageMin, damageMax);

            let rawDamage = damageMin + this.randomSource() * (damageMax - damageMin);

            const criticalChance = normalizeChance(
                attackerStats.critical,
                DEFAULTS.defaultCriticalChance
            );
            const criticalRoll = this.randomSource();
            const isCrit = criticalRoll <= criticalChance;

            if (isCrit) {
                rawDamage *= Math.max(
                    1,
                    safeNumber(
                        attackerStats.criticalMultiplier,
                        DEFAULTS.defaultCriticalMultiplier
                    )
                );
            }

            const defense = Math.max(0, safeNumber(defenderStats.defense, 0));
            const defenseMitigation = Math.min(
                DEFAULTS.maximumDefenseMitigation,
                defense / (defense + 100)
            );

            let mitigatedDamage = rawDamage * (1 - defenseMitigation);

            const blockChance = normalizeChance(
                defenderStats.blockChance ?? defenderStats.block,
                DEFAULTS.defaultBlockChance
            );
            const blockRoll = this.randomSource();
            const isBlocked = blockRoll <= blockChance;
            const blockReduction = isBlocked
                ? normalizeChance(
                    defenderStats.blockReduction,
                    DEFAULTS.defaultBlockReduction
                )
                : 0;

            if (isBlocked) {
                mitigatedDamage *= 1 - blockReduction;
            }

            const finalDamage = Math.max(1, Math.floor(mitigatedDamage));

            const result = {
                amount: finalDamage,
                hit: true,
                missed: false,
                reason: null,
                attackerId,
                targetId: defenderId,
                hitChance,
                hitRoll,
                isCrit,
                criticalChance,
                criticalRoll,
                isBlocked,
                blockChance,
                blockRoll,
                blockReduction,
                rawDamage: Math.max(1, Math.floor(rawDamage)),
                defense,
                defenseMitigation
            };

            this.lastCalculation = result;
            return options.detailed === true ? clone(result) : finalDamage;
        },

        resolveHit(attacker, defender, context = {}) {
            if (!attacker || !defender) {
                throw new TypeError(
                    "CombatSystem.resolveHit requer attacker e defender."
                );
            }

            const result = this.calculateDamage(attacker, defender, {
                detailed: true
            });

            const attackerId = getCombatantId(attacker, "attacker");
            const targetId = getCombatantId(defender, "defender");

            if (!result.hit) {
                const payload = {
                    combatId: Aethra.GameState.combat?.combatId || null,
                    round: Aethra.GameState.combat?.round || 0,
                    attacker: attackerId,
                    target: targetId,
                    reason: result.reason,
                    hitChance: result.hitChance,
                    hitRoll: result.hitRoll,
                    context: clone(context)
                };

                Aethra.EventBus.emit("AttackMissed", payload);
                Aethra.EventBus.emit("combat:attack-missed", payload);
                return { ...result, targetHp: safeNumber(defender.hp, 0) };
            }

            const maxHp = Math.max(
                1,
                safeNumber(defender.maxHp ?? defender.stats?.maxHp, 1)
            );
            const hpBefore = clamp(safeNumber(defender.hp, maxHp), 0, maxHp);
            const hpAfter = clamp(hpBefore - result.amount, 0, maxHp);

            defender.hp = hpAfter;

            if (defender.role === "hero") {
                Aethra.GameState.hero.hp = hpAfter;
            }

            const payload = {
                combatId: Aethra.GameState.combat?.combatId || null,
                round: Aethra.GameState.combat?.round || 0,
                amount: result.amount,
                rawDamage: result.rawDamage,
                isCrit: result.isCrit,
                isBlocked: result.isBlocked,
                defenseMitigation: result.defenseMitigation,
                blockReduction: result.blockReduction,
                attacker: attackerId,
                target: targetId,
                hpBefore,
                hpAfter,
                maxHp,
                context: clone(context)
            };

            Aethra.EventBus.emit("DamageDealt", payload);
            Aethra.EventBus.emit("combat:damage-dealt", payload);
            Aethra.EventBus.emit("HealthChanged", {
                target: targetId,
                hp: hpAfter,
                maxHp,
                delta: -result.amount,
                combatId: payload.combatId
            });

            return {
                ...result,
                hpBefore,
                targetHp: hpAfter,
                targetDefeated: hpAfter <= 0
            };
        },

        startCombat(enemy, options = {}) {
            this.ensureState();
            this.clearTimer();

            if (!enemy || typeof enemy !== "object") {
                throw new TypeError(
                    "CombatSystem.startCombat: enemy deve ser um objeto."
                );
            }

            if (Aethra.GameState.combat.isActive) {
                this.stopCombat("replaced-by-new-combat");
            }

            const hero = this.getHeroCombatant();
            const normalizedEnemy = this.normalizeEnemy(enemy);
            const combat = Aethra.GameState.combat;

            combat.isActive = true;
            combat.combatId = createCombatId();
            combat.round = 0;
            combat.turn = options.firstTurn === "enemy" ? "enemy" : "hero";
            combat.enemy = normalizedEnemy;
            combat.lastResult = null;
            combat.startedAt = new Date().toISOString();
            combat.endedAt = null;
            combat.source = options.source || "manual";
            combat.huntId = options.huntId || enemy.huntId || null;
            combat.encounterId = options.encounterId || enemy.encounterId || null;

            const payload = {
                combatId: combat.combatId,
                hero: clone(hero),
                enemy: clone(normalizedEnemy),
                firstTurn: combat.turn,
                source: combat.source,
                huntId: combat.huntId,
                encounterId: combat.encounterId
            };

            Aethra.EventBus.emit("CombatStarted", payload);
            Aethra.EventBus.emit("combat:started", payload);
            Aethra.EventBus.emit("combat:updated", this.getSnapshot());

            const auto = options.auto !== undefined
                ? Boolean(options.auto)
                : this.config.autoCombat;

            if (auto) {
                this.scheduleTurn(0);
            }

            return this.getSnapshot();
        },

        scheduleTurn(delay = this.config.turnDelay) {
            this.clearTimer();

            this.timerId = window.setTimeout(() => {
                this.processTurn();
            }, Math.max(0, safeNumber(delay, this.config.turnDelay)));
        },

        processTurn() {
            this.ensureState();

            const combat = Aethra.GameState.combat;
            if (!combat.isActive || !combat.enemy) return null;

            const hero = this.getHeroCombatant();
            const enemy = combat.enemy;

            if (hero.hp <= 0) {
                return this.finishHeroDefeat();
            }

            if (enemy.hp <= 0) {
                return this.finishEnemyDefeat();
            }

            combat.round += 1;

            const heroTurn = combat.turn === "hero";
            const attacker = heroTurn ? hero : enemy;
            const defender = heroTurn ? enemy : hero;

            const turnPayload = {
                combatId: combat.combatId,
                round: combat.round,
                turn: combat.turn,
                attacker: getCombatantId(attacker, "attacker"),
                target: getCombatantId(defender, "defender")
            };

            Aethra.EventBus.emit("TurnStarted", turnPayload);
            Aethra.EventBus.emit("combat:turn-started", turnPayload);

            const result = this.resolveHit(attacker, defender, {
                turn: combat.turn,
                round: combat.round
            });

            combat.lastResult = clone(result);

            if (result.targetDefeated) {
                return heroTurn
                    ? this.finishEnemyDefeat()
                    : this.finishHeroDefeat();
            }

            combat.turn = heroTurn ? "enemy" : "hero";

            Aethra.EventBus.emit("TurnEnded", {
                ...turnPayload,
                result: clone(result),
                nextTurn: combat.turn
            });
            Aethra.EventBus.emit("combat:updated", this.getSnapshot());

            if (this.config.autoCombat) {
                const nextAttacker = combat.turn === "hero" ? hero : enemy;
                const nextDelay = safeNumber(
                    nextAttacker.stats?.attackSpeed,
                    this.config.turnDelay
                );
                this.scheduleTurn(nextDelay);
            }

            return result;
        },

        heroAttack() {
            this.ensureState();
            if (!Aethra.GameState.combat.isActive) return null;

            Aethra.GameState.combat.turn = "hero";
            return this.processTurn();
        },

        enemyAttack() {
            this.ensureState();
            if (!Aethra.GameState.combat.isActive) return null;

            Aethra.GameState.combat.turn = "enemy";
            return this.processTurn();
        },

        finishEnemyDefeat() {
            this.ensureState();
            this.clearTimer();

            const combat = Aethra.GameState.combat;
            const enemy = combat.enemy;
            if (!enemy) return null;

            const payload = {
                id: enemy.id,
                enemyId: enemy.id,
                name: enemy.name,
                xp: Math.max(0, Math.floor(safeNumber(enemy.xp, 0))),
                gold: Math.max(0, Math.floor(safeNumber(enemy.gold, 0))),
                combatId: combat.combatId,
                huntId: combat.huntId || enemy.huntId || null,
                encounterId: combat.encounterId || enemy.encounterId || null,
                rounds: combat.round,
                defeatedAt: new Date().toISOString(),
                enemy: clone(enemy)
            };

            Aethra.EventBus.emit("EnemyDefeated", payload);
            Aethra.EventBus.emit("combat:enemy-defeated", payload);

            return this.stopCombat("enemy-defeated", {
                defeatedEnemy: payload
            });
        },

        finishHeroDefeat() {
            this.ensureState();
            this.clearTimer();

            const combat = Aethra.GameState.combat;
            const payload = {
                heroId: Aethra.GameState.hero.id || "hero",
                combatId: combat.combatId,
                enemyId: combat.enemy?.id || null,
                rounds: combat.round,
                defeatedAt: new Date().toISOString()
            };

            Aethra.EventBus.emit("HeroDefeated", payload);
            Aethra.EventBus.emit("combat:hero-defeated", payload);

            return this.stopCombat("hero-defeated", {
                defeatedHero: payload
            });
        },

        stopCombat(reason = "manual", extra = {}) {
            this.ensureState();
            this.clearTimer();

            const combat = Aethra.GameState.combat;
            const wasActive = combat.isActive;
            const previousSnapshot = this.getSnapshot();

            combat.isActive = false;
            combat.endedAt = new Date().toISOString();
            combat.lastEnemy = combat.enemy ? clone(combat.enemy) : combat.lastEnemy;
            combat.enemy = null;
            combat.turn = "hero";

            const payload = {
                reason,
                wasActive,
                combatId: previousSnapshot.combatId,
                rounds: previousSnapshot.round,
                endedAt: combat.endedAt,
                previous: previousSnapshot,
                ...clone(extra)
            };

            if (wasActive) {
                Aethra.EventBus.emit("CombatEnded", payload);
                Aethra.EventBus.emit("combat:ended", payload);
                Aethra.EventBus.emit("combat:updated", this.getSnapshot());
            }

            return payload;
        },

        clearTimer() {
            if (this.timerId !== null) {
                window.clearTimeout(this.timerId);
                this.timerId = null;
            }
        },

        getSnapshot() {
            this.ensureState();

            const combat = Aethra.GameState.combat;
            return {
                isActive: combat.isActive,
                combatId: combat.combatId,
                round: combat.round,
                turn: combat.turn,
                hero: clone(this.getHeroCombatant()),
                enemy: clone(combat.enemy),
                lastEnemy: clone(combat.lastEnemy),
                lastResult: clone(combat.lastResult),
                startedAt: combat.startedAt,
                endedAt: combat.endedAt,
                source: combat.source || null,
                huntId: combat.huntId || null,
                encounterId: combat.encounterId || null
            };
        }
    };

    Aethra.CombatSystem.init();
})(window.Aethra);
