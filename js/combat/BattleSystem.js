// BattleSystem.js - O Coração do Combate Hardcore
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus || !Aethra.GameData) {
        throw new Error(
            "BattleSystem.js requer game-core.js e GameData.js carregados antes deste arquivo."
        );
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function number(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function integer(value, fallback = 0) {
        return Math.floor(number(value, fallback));
    }

    Aethra.BattleSystem = {
        initialized: false,
        isFighting: false,
        timerId: null,
        battleToken: 0,
        lastTickAt: null,
        randomSource: Math.random,

        config: {
            tickMs: 1000,
            hardcoreGoldPenalty: 0.10,
            autoStartOnEnemyEncountered: false,
            mirrorCombatState: true,
            defaultCriticalMultiplier: 1.75
        },

        init(options = {}) {
            if (this.initialized) {
                return this.getSnapshot();
            }

            this.config = {
                ...this.config,
                ...options
            };

            this.ensureState();
            this.bindEvents();
            this.initialized = true;

            Aethra.EventBus.emit("BattleSystemReady", this.getSnapshot());
            Aethra.EventBus.emit("battle:ready", this.getSnapshot());

            return this.getSnapshot();
        },

        ensureState() {
            const state = Aethra.GameState;

            state.hero = state.hero || {};
            state.hero.stats = state.hero.stats || {};
            state.hero.gold = Math.max(
                0,
                integer(state.hero.gold ?? state.hero.stats.gold, 0)
            );

            const stats = state.hero.stats;
            const maxHp = Math.max(
                1,
                integer(
                    stats.maxHp ??
                    state.hero.maxHp ??
                    stats.hp ??
                    state.hero.hp,
                    100
                )
            );

            stats.maxHp = maxHp;
            stats.hp = clamp(
                integer(stats.hp ?? state.hero.hp, maxHp),
                0,
                maxHp
            );

            if (!Number.isFinite(Number(stats.damage))) {
                stats.damage = Math.max(
                    1,
                    integer(
                        stats.damageMax ??
                        stats.str,
                        5
                    )
                );
            }

            state.battle = state.battle || {};

            Object.assign(state.battle, {
                isFighting: Boolean(state.battle.isFighting),
                battleId: state.battle.battleId || null,
                round: Math.max(0, integer(state.battle.round, 0)),
                creature: state.battle.creature || null,
                source: state.battle.source || null,
                startedAt: state.battle.startedAt || null,
                endedAt: state.battle.endedAt || null,
                lastResult: state.battle.lastResult || null,
                lastMessage: state.battle.lastMessage || "",
                lastMessageColor:
                    state.battle.lastMessageColor || null,
                logs: Array.isArray(state.battle.logs)
                    ? state.battle.logs
                    : [],
                lastLog: state.battle.lastLog || null,
                lastRewards: state.battle.lastRewards || null,
                lastEnemy: state.battle.lastEnemy || null,
                lastHeroAction: state.battle.lastHeroAction || null
            });

            this.isFighting = Boolean(state.battle.isFighting);

            return state.battle;
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            Aethra.EventBus.on("BattleRequested", (payload = {}) => {
                const creature =
                    payload.creature ||
                    payload.enemy ||
                    payload.creatureId ||
                    payload.enemyId ||
                    payload.id;

                this.startCombat(creature, payload.options || payload);
            });

            Aethra.EventBus.on("battle:start-requested", (payload = {}) => {
                const creature =
                    payload.creature ||
                    payload.enemy ||
                    payload.creatureId ||
                    payload.enemyId ||
                    payload.id;

                this.startCombat(creature, payload.options || payload);
            });

            Aethra.EventBus.on("BattleStopRequested", (payload = {}) => {
                this.stopCombat(payload.reason || "event-request");
            });

            Aethra.EventBus.on("battle:stop-requested", (payload = {}) => {
                this.stopCombat(payload.reason || "event-request");
            });

            Aethra.EventBus.on("PrimaryAttackRequested", (payload = {}) => {
                this.queuePrimaryAttack(payload.slot || "left");
            });

            Aethra.EventBus.on("primary-attack:requested", (payload = {}) => {
                this.queuePrimaryAttack(payload.slot || "left");
            });

            Aethra.EventBus.on("EnemyEncountered", (payload = {}) => {
                const shouldStart =
                    this.config.autoStartOnEnemyEncountered ||
                    payload.useBattleSystem === true ||
                    payload.combatEngine === "BattleSystem";

                if (!shouldStart) return;

                this.startCombat(payload, {
                    source: payload.source || "encounter",
                    huntId: payload.huntId,
                    encounterId: payload.encounterId
                });
            });

            Aethra.EventBus.on("save:loaded", () => {
                this.cancelTimer();
                this.battleToken += 1;
                this.ensureState();

                Aethra.GameState.battle.isFighting = false;
                Aethra.GameState.battle.creature = null;
                this.isFighting = false;

                this.syncCombatMirror();
            });

            Aethra.EventBus.on("state:restored", () => {
                this.cancelTimer();
                this.battleToken += 1;
                this.ensureState();

                Aethra.GameState.battle.isFighting = false;
                Aethra.GameState.battle.creature = null;
                this.isFighting = false;

                this.syncCombatMirror();
            });
        },

        validateCreature(creatureId) {
            if (!creatureId || typeof creatureId !== "string") {
                return {
                    valid: false,
                    reason: "CREATURE_ID_INVALID"
                };
            }

            if (!Aethra.GameData.creatures?.[creatureId]) {
                return {
                    valid: false,
                    reason: "CREATURE_NOT_FOUND",
                    creatureId
                };
            }

            return {
                valid: true,
                creatureId
            };
        },

        resolveCreature(creatureOrId) {
            const runtimeCreature =
                creatureOrId && typeof creatureOrId === "object"
                    ? creatureOrId
                    : null;

            const creatureId =
                typeof creatureOrId === "string"
                    ? creatureOrId
                    : runtimeCreature?.id || runtimeCreature?.enemyId;

            const validation = this.validateCreature(creatureId);

            if (!validation.valid) {
                Aethra.EventBus.emit("BattleError", validation);
                Aethra.EventBus.emit("battle:error", validation);
                return null;
            }

            const heroLevel = Math.max(
                1,
                integer(Aethra.GameState.hero?.level, 1)
            );

            const source =
                typeof Aethra.GameData.getCreature === "function"
                    ? Aethra.GameData.getCreature(creatureId, heroLevel)
                    : clone(Aethra.GameData.creatures[creatureId]);

            if (!source) {
                return null;
            }

            const creature = {
                ...clone(source),
                ...(runtimeCreature ? clone(runtimeCreature) : {})
            };

            creature.id = creatureId;
            creature.name = creature.name || creatureId;
            creature.level = Math.max(1, integer(creature.level, heroLevel));
            creature.maxHp = Math.max(
                1,
                integer(creature.maxHp ?? creature.hp, 1)
            );
            creature.hp = clamp(
                integer(creature.hp, creature.maxHp),
                0,
                creature.maxHp
            );
            creature.damage = Math.max(1, integer(creature.damage, 1));
            creature.xp = Math.max(0, integer(creature.xp, 0));
            creature.stats = {
                ...(source.stats ? clone(source.stats) : {}),
                ...(runtimeCreature?.stats ? clone(runtimeCreature.stats) : {})
            };

            return creature;
        },

        startCombat(creatureOrId, options = {}) {
            this.ensureState();

            if (this.isFighting) {
                const payload = {
                    reason: "BATTLE_ALREADY_ACTIVE",
                    activeBattle: this.getSnapshot()
                };

                Aethra.EventBus.emit("BattleStartDenied", payload);
                Aethra.EventBus.emit("battle:start-denied", payload);
                return false;
            }

            const creature = this.resolveCreature(creatureOrId);
            if (!creature) return false;

            this.cancelTimer();
            this.battleToken += 1;
            this.isFighting = true;
            this.lastTickAt = null;

            const state = Aethra.GameState.battle;
            const battleId = this.createBattleId();

            Object.assign(state, {
                isFighting: true,
                battleId,
                round: 0,
                creature,
                source: options.source || "manual",
                huntId: options.huntId || creature.huntId || null,
                encounterId: options.encounterId || creature.encounterId || null,
                startedAt: new Date().toISOString(),
                endedAt: null,
                lastResult: null,
                lastMessage: `Combate iniciado contra ${creature.name}.`,
                lastMessageColor: null,
                logs: [],
                lastLog: null,
                lastRewards: null,
                lastHeroAction: null,
                queuedPrimaryAttacks: []
            });

            this.syncCombatMirror();

            const payload = {
                battleId,
                source: state.source,
                creature: clone(creature),
                hero: this.getHeroSnapshot(),
                message: state.lastMessage
            };

            console.log(`Combate iniciado contra: ${creature.name}`);

            Aethra.EventBus.emit("BattleStarted", payload);
            Aethra.EventBus.emit("CombatStarted", payload);
            Aethra.EventBus.emit("battle:started", payload);

            this.scheduleNextTick(this.battleToken, 0);
            return true;
        },

        processCombat(creature = null) {
            if (creature && !this.isFighting) {
                return this.startCombat(creature);
            }

            if (!this.isFighting) return false;

            this.scheduleNextTick(this.battleToken, 0);
            return true;
        },

        scheduleNextTick(token, delay = this.config.tickMs) {
            this.cancelTimer();

            this.timerId = window.setTimeout(() => {
                if (token !== this.battleToken || !this.isFighting) return;
                this.tick(token);
            }, Math.max(0, integer(delay, this.config.tickMs)));
        },

        queuePrimaryAttack(slot = "left") {
            const normalizedSlot = slot === "right" ? "right" : "left";
            const battle = this.ensureState();
            battle.queuedPrimaryAttacks = Array.isArray(battle.queuedPrimaryAttacks)
                ? battle.queuedPrimaryAttacks
                : [];

            if (!battle.queuedPrimaryAttacks.includes(normalizedSlot)) {
                battle.queuedPrimaryAttacks.push(normalizedSlot);
            }

            Aethra.EventBus.emit("primary-attack:queued", {
                slot: normalizedSlot,
                battleId: battle.battleId || null,
                round: battle.round || 0
            });
            return true;
        },

        getPrimaryWeapon(slot = "left") {
            const equipment =
                Aethra.GameState.playerEquipment ||
                Aethra.GameState.hero?.equipment ||
                {};
            const item = slot === "right"
                ? equipment.offhand || null
                : equipment.weapon || null;

            if (slot !== "right") return item;
            if (!item) return null;

            const type = String(item.type || item.itemType || "").toLowerCase();
            const template = String(item.templateId || item.id || "").toLowerCase();
            const weaponLike =
                type === "weapon" ||
                type === "offhand-weapon" ||
                Array.isArray(item.equipSlots) && item.equipSlots.includes("weapon") ||
                /sword|dagger|axe|mace|wand|bow|blade/.test(template);

            return weaponLike ? item : null;
        },

        getPrimaryAttackState(slot = "left", now = Date.now()) {
            const primary = Aethra.SkillSystem?.getPrimaryAttack?.(slot);
            if (!primary) {
                return {
                    slot,
                    available: false,
                    reason: "primary-attack-missing"
                };
            }

            const weapon = this.getPrimaryWeapon(slot);
            const requiresWeapon = Boolean(primary.skill?.effect?.requiresWeapon);
            const readyAt = Math.max(0, number(primary.nextReadyAt, 0));

            return {
                ...primary,
                slot,
                weapon,
                available: !requiresWeapon || Boolean(weapon),
                reason: requiresWeapon && !weapon ? "offhand-weapon-required" : null,
                readyAt,
                cooldownRemaining: Math.max(0, readyAt - now),
                ready: readyAt <= now
            };
        },

        executePrimaryAttack(slot, creature, options = {}) {
            if (!creature || creature.hp <= 0) return null;

            const now = options.now || Date.now();
            const state = this.getPrimaryAttackState(slot, now);
            if (!state.available || !state.ready) return null;

            const skill = state.skill || {};
            const damageMultiplier = Math.max(
                0.05,
                number(skill.effect?.damageMultiplier, slot === "right" ? 0.7 : 1)
            );
            const attack = this.resolveAttack(
                this.getHeroCombatant(),
                creature,
                "hero",
                {
                    weapon: state.weapon,
                    damageMultiplier,
                    primarySlot: slot,
                    skillId: state.skillId,
                    attackLabel: skill.name || (slot === "right"
                        ? "Ataque da Mão Secundária"
                        : "Ataque da Mão Principal")
                }
            );

            if (attack.hit) {
                creature.hp = Math.max(0, creature.hp - attack.amount);
            }

            const result = this.emitAttackResult(attack);
            Aethra.SkillSystem?.markPrimaryAttackUsed?.(slot, now);

            const payload = {
                slot,
                skillId: state.skillId,
                skill: clone(skill),
                result: clone(result),
                weapon: state.weapon ? clone(state.weapon) : null,
                source: options.source || "primary-layer",
                battleId: Aethra.GameState.battle?.battleId || null,
                round: Aethra.GameState.battle?.round || 0,
                usedAt: now
            };
            Aethra.EventBus.emit("PrimaryAttackUsed", clone(payload));
            Aethra.EventBus.emit("primary-attack:used", clone(payload));
            return result;
        },

        processPrimaryAttacks(creature, options = {}) {
            const battle = Aethra.GameState.battle || {};
            const queued = new Set(
                Array.isArray(battle.queuedPrimaryAttacks)
                    ? battle.queuedPrimaryAttacks
                    : []
            );
            battle.queuedPrimaryAttacks = [];

            const primaryAttacks = Aethra.SkillSystem?.getPrimaryAttacks?.() || {};
            const results = [];
            const now = options.now || Date.now();

            ["left", "right"].forEach((slot) => {
                if (creature.hp <= 0) return;
                const attack = primaryAttacks[slot];
                const shouldUse = queued.has(slot) || attack?.auto === true;
                if (!shouldUse) return;

                const result = this.executePrimaryAttack(slot, creature, {
                    now,
                    source: queued.has(slot) ? "primary-manual" : "primary-auto"
                });
                if (result) results.push(result);
            });

            return results;
        },

        updateCreatureAbilityReadiness(creature) {
            if (!creature || !Array.isArray(creature.abilities)) return;
            creature.abilityReadiness = creature.abilityReadiness || {};
            creature.abilities.forEach((ability) => {
                if (!ability?.recharge) return;
                const current = creature.abilityReadiness[ability.id];
                if (current !== false) {
                    creature.abilityReadiness[ability.id] = true;
                    return;
                }
                const roll = this.randomInt(1, 6);
                if (roll >= Number(ability.recharge.min || 6)) {
                    creature.abilityReadiness[ability.id] = true;
                    this.emitBattleLog({
                        message: `${creature.name} recuperou ${ability.name}.`,
                        color: "#d7a9ff",
                        type: "enemy-recharge",
                        source: "monster-catalog"
                    });
                }
            });
        },

        selectCreatureAbility(creature) {
            const abilities = Array.isArray(creature?.abilities)
                ? creature.abilities.filter((ability) => Number(ability?.averageDamage || 0) > 0)
                : [];

            if (abilities.length === 0) {
                return { name: "Ataque Básico", damageMultiplier: 1, ability: null };
            }

            this.updateCreatureAbilityReadiness(creature);
            const basic = abilities.find((ability) => !ability.recharge && ability.type !== "multiattack") || abilities[0];
            const specialCandidates = abilities.filter((ability) => {
                return ability.recharge && creature.abilityReadiness?.[ability.id] !== false;
            });
            const selected = specialCandidates.length > 0 && this.randomSource() <= 0.28
                ? specialCandidates[this.randomInt(0, specialCandidates.length - 1)]
                : basic;

            if (selected?.recharge) {
                creature.abilityReadiness[selected.id] = false;
            }

            const basicAverage = Math.max(1, Number(basic?.averageDamage || selected?.averageDamage || 1));
            const selectedAverage = Math.max(1, Number(selected?.averageDamage || basicAverage));
            const damageMultiplier = clamp(selectedAverage / basicAverage, 0.75, 1.75);

            return {
                name: selected?.name || "Ataque Básico",
                damageMultiplier,
                ability: selected || null
            };
        },

        tick(token = this.battleToken) {
            if (token !== this.battleToken || !this.isFighting) return;

            this.ensureState();

            const monotonicNow =
                typeof performance !== "undefined" &&
                typeof performance.now === "function"
                    ? performance.now()
                    : Date.now();
            const wallClockNow = Date.now();
            const deltaTime = this.lastTickAt === null
                ? this.config.tickMs
                : Math.max(0, monotonicNow - this.lastTickAt);
            this.lastTickAt = monotonicNow;

            const battle = Aethra.GameState.battle;
            const hero = Aethra.GameState.hero;
            const creature = battle.creature;

            if (!creature) {
                this.stopCombat("creature-missing");
                return;
            }

            battle.round += 1;

            /*
             * Duas camadas independentes:
             * 1. SkillController usa suporte/magia/vigor conforme prioridade.
             * 2. Ataques primários continuam no próprio intervalo, sem ocupar a fila.
             */
            let supportHealingLog = null;
            let controllerAction = null;
            let skillResult = null;

            const skillController = hero.skillController || Aethra.SkillController;
            if (skillController && typeof skillController.update === "function") {
                controllerAction = skillController.update(deltaTime, {
                    battle,
                    hero,
                    creature,
                    target: creature,
                    token
                });

                if (controllerAction?.executed === true) {
                    skillResult = {
                        ...(controllerAction.result || {}),
                        action: controllerAction.action || controllerAction.result?.action || "skill",
                        skillId: controllerAction.skillId || null,
                        skillName: controllerAction.skill?.name || controllerAction.result?.skillName || null,
                        message: controllerAction.result?.message || controllerAction.message || "Habilidade executada.",
                        log: controllerAction.log || null,
                        logColor: controllerAction.logColor || controllerAction.log?.color || null
                    };
                }

                const supportHealTriggered = Boolean(
                    controllerAction?.executed === true &&
                    controllerAction?.priority === 1 &&
                    controllerAction?.action === "heal" &&
                    (
                        controllerAction?.source === "checkSupportPriorities" ||
                        controllerAction?.source === "auto-support"
                    )
                );

                if (supportHealTriggered) {
                    supportHealingLog = {
                        message:
                            controllerAction?.log?.message ||
                            controllerAction?.result?.message ||
                            controllerAction?.message ||
                            "Cura automática executada.",
                        color: "#00ff00",
                        type: "heal",
                        source: "checkSupportPriorities",
                        skillId: controllerAction?.skillId || null,
                        battleId: battle.battleId || null,
                        round: battle.round || 0,
                        createdAt: wallClockNow
                    };
                }
            }

            if (creature.hp <= 0) {
                const cycleResult = {
                    action: "skill-cycle",
                    skillAction: skillResult,
                    primaryAttacks: [],
                    message: skillResult?.message || "O inimigo foi derrotado.",
                    logColor: skillResult?.logColor || null
                };
                this.emitCombatTick(cycleResult, null);
                if (supportHealingLog) this.emitBattleLog(supportHealingLog);
                this.victory(creature);
                return;
            }

            const primaryResults = this.processPrimaryAttacks(creature, {
                now: wallClockNow
            });

            const actionMessages = [
                skillResult?.message,
                ...primaryResults.map((result) => result?.message)
            ].filter(Boolean);

            const heroCycleResult = {
                action: "combat-cycle",
                skillAction: skillResult ? clone(skillResult) : null,
                primaryAttacks: clone(primaryResults),
                amount: primaryResults.reduce((total, result) => total + integer(result?.amount, 0), 0) + integer(skillResult?.amount, 0),
                message: actionMessages.join(" ") || "Preparando o próximo ataque.",
                log: supportHealingLog || skillResult?.log || null,
                logColor: supportHealingLog?.color || skillResult?.logColor || null
            };

            if (controllerAction?.executed === true) {
                this.recordHeroAction({
                    name:
                        controllerAction.skill?.name ||
                        controllerAction.result?.skillName ||
                        "Habilidade",
                    skillId: controllerAction.skillId || null,
                    type: controllerAction.action || "skill",
                    source: controllerAction.source || "skill-layer",
                    result: skillResult
                });
            } else if (primaryResults.length > 0) {
                const lastPrimary = primaryResults[primaryResults.length - 1];
                this.recordHeroAction({
                    name: lastPrimary.attackLabel || lastPrimary.skillName || "Ataque da Mão Principal",
                    skillId: null,
                    type: "primary-attack",
                    source: "primary-layer",
                    result: lastPrimary
                });
            }

            if (creature.hp <= 0) {
                this.emitCombatTick(heroCycleResult, null);
                if (supportHealingLog) this.emitBattleLog(supportHealingLog);
                this.victory(creature);
                return;
            }

            const creatureAbility = this.selectCreatureAbility(creature);
            const creatureAttack = this.resolveAttack(
                creature,
                this.getHeroCombatant(),
                "creature",
                {
                    attackLabel: creatureAbility.name,
                    damageMultiplier: creatureAbility.damageMultiplier,
                    monsterAbility: creatureAbility.ability
                }
            );

            if (creatureAttack.hit) {
                hero.stats.hp = Math.max(
                    0,
                    integer(hero.stats.hp, 0) - creatureAttack.amount
                );
            }

            const creatureAttackResult = this.emitAttackResult(creatureAttack);
            this.emitCombatTick(heroCycleResult, creatureAttackResult);

            if (supportHealingLog) this.emitBattleLog(supportHealingLog);

            this.syncCombatMirror();

            if (hero.stats.hp <= 0) {
                this.defeat();
                return;
            }

            this.scheduleNextTick(token, this.config.tickMs);
        },

        recordHeroAction(action = {}) {
            const name = String(action.name || "").trim();
            if (!name) return false;

            const battle = this.ensureState();
            const payload = {
                name,
                skillId: action.skillId || null,
                type: action.type || "attack",
                source: action.source || "battle-system",
                battleId: battle.battleId || null,
                round: battle.round || 0,
                executedAt: Date.now(),
                result: action.result ? clone(action.result) : null
            };

            battle.lastHeroAction = payload;

            Aethra.EventBus.emit("HeroActionExecuted", clone(payload));
            Aethra.EventBus.emit("battle:hero-action", clone(payload));

            return clone(payload);
        },

        emitBattleLog(log = {}) {
            const message =
                typeof log === "string"
                    ? log
                    : log.message;

            if (!message) return false;

            const payload = {
                ...(typeof log === "object" ? clone(log) : {}),
                message,
                color:
                    log.color || "#00ff00",
                createdAt:
                    log.createdAt || Date.now()
            };

            const battle = this.ensureState();
            battle.logs = Array.isArray(battle.logs)
                ? battle.logs
                : [];
            battle.logs.push(payload);
            battle.logs = battle.logs.slice(-50);
            battle.lastLog = payload;
            battle.lastMessage = payload.message;
            battle.lastMessageColor = payload.color;

            Aethra.EventBus.emit(
                "BattleLog",
                clone(payload)
            );
            Aethra.EventBus.emit(
                "battle:log",
                clone(payload)
            );

            return clone(payload);
        },

        getEquippedWeapon(slot = "weapon") {
            const state = Aethra.GameState;
            const hero = state.hero || {};
            const normalizedSlot = slot === "offhand" ? "offhand" : "weapon";

            return (
                state.playerEquipment?.[normalizedSlot] ||
                hero.equipment?.[normalizedSlot] ||
                null
            );
        },

        getWeaponDamageProfile(weapon = this.getEquippedWeapon()) {
            const hero = Aethra.GameState.hero || {};
            const heroBaseStats = hero.baseStats || hero.stats || {};

            if (!weapon) {
                const baseMin = Math.max(
                    1,
                    integer(
                        heroBaseStats.damageMin ??
                        heroBaseStats.damage ??
                        heroBaseStats.str,
                        1
                    )
                );

                const baseMax = Math.max(
                    baseMin,
                    integer(
                        heroBaseStats.damageMax ??
                        heroBaseStats.damage ??
                        baseMin,
                        baseMin
                    )
                );

                return {
                    weapon: null,
                    weaponId: null,
                    weaponName: "Ataque desarmado",
                    baseMin,
                    baseMax,
                    multiplier: 1,
                    individualMin: 1,
                    individualMax: 1,
                    affixMin: 0,
                    affixMax: 0
                };
            }

            const template =
                Aethra.GameData.items?.[weapon.templateId] ||
                Aethra.GameData.items?.[weapon.id] ||
                {};

            const breakdown =
                Aethra.GameData.getItemStatBreakdown?.(weapon) ||
                {
                    baseStats:
                        weapon.baseStats ||
                        template.baseStats ||
                        {},
                    multiplier:
                        weapon.statMultiplier ||
                        weapon.multiplier ||
                        1,
                    individualMultipliers:
                        weapon.individualMultipliers || {},
                    affixBonuses: {}
                };

            const baseStats = breakdown.baseStats || {};

            const fallbackDamage = Math.max(
                1,
                integer(
                    baseStats.damage ??
                    template.damage ??
                    weapon.damage,
                    1
                )
            );

            const baseMin = Math.max(
                1,
                integer(
                    baseStats.damageMin,
                    fallbackDamage
                )
            );

            const baseMax = Math.max(
                baseMin,
                integer(
                    baseStats.damageMax,
                    fallbackDamage
                )
            );

            return {
                weapon: clone(weapon),
                weaponId:
                    weapon.instanceId ||
                    weapon.templateId ||
                    weapon.id ||
                    null,
                weaponName:
                    weapon.name ||
                    template.name ||
                    "Arma equipada",
                baseMin,
                baseMax,
                multiplier: Math.max(
                    0.01,
                    number(
                        breakdown.multiplier ??
                        weapon.statMultiplier ??
                        weapon.multiplier,
                        1
                    )
                ),
                individualMin: Math.max(
                    0.01,
                    number(
                        breakdown.individualMultipliers?.damageMin ??
                        breakdown.individualMultipliers?.damage ??
                        1,
                        1
                    )
                ),
                individualMax: Math.max(
                    0.01,
                    number(
                        breakdown.individualMultipliers?.damageMax ??
                        breakdown.individualMultipliers?.damage ??
                        1,
                        1
                    )
                ),
                affixMin: number(
                    breakdown.affixBonuses?.damageMin ??
                    breakdown.affixBonuses?.damage ??
                    0,
                    0
                ),
                affixMax: number(
                    breakdown.affixBonuses?.damageMax ??
                    breakdown.affixBonuses?.damage ??
                    0,
                    0
                )
            };
        },

        getCombatantInspection(combatant, side = "hero") {
            const source = combatant || {};
            const stats = {
                ...source,
                ...(source.stats || {})
            };
            const baseStats = source.baseStats || {};
            const isHero = side === "hero";
            const criticalChance = clamp(number(stats.critical, 0.05), 0, 0.75);
            const evasionRaw = number(stats.evasion, 0);
            const evasionChance = clamp(
                evasionRaw <= 1 ? evasionRaw : evasionRaw * 0.005,
                0,
                0.75
            );
            const defense = Math.max(0, number(stats.defense, 0));
            const armorReduction = clamp(defense / (defense + 100), 0, 0.90);
            const blockChance = clamp(number(stats.blockChance, 0), 0, 0.75);
            const blockReduction = clamp(
                number(stats.blockReduction, 0.35),
                0,
                0.90
            );
            const criticalMultiplier = Math.max(
                1,
                number(
                    stats.criticalMultiplier ?? stats.critMultiplier,
                    this.config.defaultCriticalMultiplier
                )
            );
            const weaponProfile = isHero
                ? this.getWeaponDamageProfile()
                : null;
            const damageMultiplier = isHero
                ? number(weaponProfile?.multiplier, 1)
                : Math.max(
                    0.01,
                    number(stats.damageMultiplier ?? source.damageMultiplier, 1)
                );

            const statBonuses = Object.keys({ ...baseStats, ...stats })
                .map((stat) => ({
                    stat,
                    base: number(baseStats[stat], 0),
                    final: number(stats[stat], 0),
                    bonus:
                        number(stats[stat], 0) -
                        number(baseStats[stat], 0)
                }))
                .filter((entry) => Math.abs(entry.bonus) > 0.0001)
                .sort((a, b) => Math.abs(b.bonus) - Math.abs(a.bonus));

            const equipment = isHero
                ? (
                    Aethra.GameState.playerEquipment ||
                    Aethra.GameState.hero?.equipment ||
                    {}
                )
                : {};
            const itemRolls = isHero
                ? Object.entries(equipment)
                    .filter(([, item]) => Boolean(item))
                    .map(([slot, item]) => {
                        const inspection = Aethra.ItemSystem
                            ?.getItemInspection?.(item);

                        return {
                            slot,
                            itemId:
                                item.instanceId ||
                                item.templateId ||
                                item.id ||
                                null,
                            name:
                                item.name ||
                                item.baseName ||
                                item.templateId ||
                                "Item",
                            rarity:
                                inspection?.rarity?.name ||
                                item.rarity ||
                                "Comum",
                            multiplier:
                                inspection?.multiplier ||
                                number(item.statMultiplier ?? item.multiplier, 1),
                            ivPercent:
                                inspection?.ivPercent ??
                                number(item.rollScore, 100)
                        };
                    })
                : [];

            return {
                side,
                name: source.name || (isHero ? "Herói" : "Inimigo"),
                criticalChance,
                criticalMultiplier,
                damageMultiplier,
                evasionChance,
                defense,
                armorReduction,
                blockChance,
                blockReduction,
                precision: number(stats.precision, 0),
                damageMin: number(
                    stats.damageMin ?? source.damageMin,
                    number(stats.damage ?? source.damage, 0)
                ),
                damageMax: number(
                    stats.damageMax ?? source.damageMax,
                    number(stats.damage ?? source.damage, 0)
                ),
                statBonuses,
                itemRolls,
                weapon: weaponProfile
                    ? {
                        name: weaponProfile.weaponName,
                        multiplier: weaponProfile.multiplier,
                        individualMin: weaponProfile.individualMin,
                        individualMax: weaponProfile.individualMax,
                        affixMin: weaponProfile.affixMin,
                        affixMax: weaponProfile.affixMax
                    }
                    : null
            };
        },

        /**
         * Calcula o dano final do herói.
         *
         * Fórmula:
         * dano = dano-base da arma
         *      × multiplicador aleatório salvo
         *      × variação individual salva
         *      + bônus de afixo
         *      - defesa total do inimigo
         *
         * Por padrão retorna apenas o número final.
         * Use { details: true } para receber toda a memória do cálculo.
         */
        calculateDamage(defender, options = {}) {
            Aethra.EquipSystem?.updatePlayerStats?.({
                emit: false,
                save: false,
                source: "battle-damage-calculation"
            });

            const profile = this.getWeaponDamageProfile(
                options.weapon || this.getEquippedWeapon()
            );

            const baseDamage = Number.isFinite(
                Number(options.baseDamage)
            )
                ? Math.max(
                    1,
                    integer(options.baseDamage, profile.baseMin)
                )
                : this.randomInt(
                    profile.baseMin,
                    profile.baseMax
                );

            const range =
                Math.max(1, profile.baseMax - profile.baseMin);

            const rangeProgress = clamp(
                (baseDamage - profile.baseMin) / range,
                0,
                1
            );

            const individualMultiplier =
                profile.individualMin +
                (
                    profile.individualMax -
                    profile.individualMin
                ) * rangeProgress;

            const affixBonus =
                profile.affixMin +
                (
                    profile.affixMax -
                    profile.affixMin
                ) * rangeProgress;

            const scaledWeaponDamage = Math.max(
                1,
                Math.round(
                    baseDamage *
                    profile.multiplier *
                    individualMultiplier +
                    affixBonus
                )
            );

            const heroStats = Aethra.GameState.hero?.stats || {};
            const criticalChance = clamp(
                number(heroStats.critical, 0.05),
                0,
                0.75
            );
            const shouldRollCritical =
                options.isCrit === undefined &&
                options.rollCritical !== false;
            const isCrit = options.isCrit === true || (
                shouldRollCritical &&
                this.randomSource() <= criticalChance
            );
            const criticalMultiplier = isCrit
                ? Math.max(
                    1,
                    number(
                        options.criticalMultiplier ??
                        heroStats.criticalMultiplier ??
                        heroStats.critMultiplier,
                        this.config.defaultCriticalMultiplier
                    )
                )
                : 1;

            const damageBeforeDefense = Math.max(
                1,
                Math.round(
                    scaledWeaponDamage * criticalMultiplier
                )
            );

            const enemyDefense = Math.max(
                0,
                number(
                    defender?.stats?.defense ??
                    defender?.defense,
                    0
                )
            );

            let finalDamage = Math.max(
                1,
                Math.round(
                    damageBeforeDefense - enemyDefense
                )
            );

            const blockReduction =
                options.isBlocked === true
                    ? clamp(
                        number(options.blockReduction, 0.35),
                        0,
                        0.90
                    )
                    : 0;

            if (blockReduction > 0) {
                finalDamage = Math.max(
                    1,
                    Math.round(
                        finalDamage * (1 - blockReduction)
                    )
                );
            }

            const result = {
                amount: finalDamage,
                baseDamage,
                multiplier: Number(
                    profile.multiplier.toFixed(2)
                ),
                individualMultiplier: Number(
                    individualMultiplier.toFixed(3)
                ),
                affixBonus: Number(
                    affixBonus.toFixed(3)
                ),
                scaledWeaponDamage,
                isCrit,
                criticalChance,
                criticalMultiplier,
                damageBeforeDefense,
                enemyDefense,
                blockReduction,
                weaponId: profile.weaponId,
                weaponName: profile.weaponName,
                weapon: profile.weapon
            };

            return options.details === true
                ? result
                : result.amount;
        },

        getFloatingTextPosition(result = {}) {
            const targetEntity =
                Aethra.EntityManager?.getEntity?.(
                    result.target
                ) ||
                Aethra.EntityManager?.getEntity?.(
                    Aethra.GameState.battle?.creature?.id
                );

            const playerEntity =
                Aethra.EntityManager?.getEntity?.("player");

            const creature =
                Aethra.GameState.battle?.creature || {};

            const source =
                targetEntity ||
                (
                    Number.isFinite(Number(creature.x)) &&
                    Number.isFinite(Number(creature.y))
                        ? creature
                        : null
                ) ||
                playerEntity ||
                null;

            if (source) {
                return {
                    x: number(source.x, 0) + 16,
                    y: number(source.y, 0) - 10
                };
            }

            return {
                x: Math.round(window.innerWidth / 2),
                y: Math.round(window.innerHeight / 2)
            };
        },

        emitFloatingCombatText(result) {
            if (!result || result.side !== "hero") {
                return false;
            }

            const position =
                this.getFloatingTextPosition(result);

            const payload = {
                battleId:
                    Aethra.GameState.battle?.battleId || null,
                round:
                    Aethra.GameState.battle?.round || 0,
                text: result.hit
                    ? `Dano: ${integer(result.amount, 0)}`
                    : "Errou!",
                amount: result.hit
                    ? integer(result.amount, 0)
                    : 0,
                type: !result.hit
                    ? "miss"
                    : result.isCrit
                        ? "critical"
                        : "damage",
                x: position.x,
                y: position.y,
                targetId: result.target || null,
                weaponId: result.weaponId || null,
                weaponName: result.weaponName || null
            };

            Aethra.EventBus.emit(
                "BattleFloatingText",
                payload
            );

            return payload;
        },

        resolveAttack(attacker, defender, side, options = {}) {
            const attackerStats = attacker.stats || {};
            const defenderStats = defender.stats || {};

            const precision = number(attackerStats.precision, 0);
            const evasion = number(defenderStats.evasion, 0);
            const normalizedEvasion = evasion <= 1
                ? evasion
                : evasion * 0.005;

            const hitChance = clamp(
                0.85 + precision * 0.01 - normalizedEvasion,
                0.10,
                0.98
            );

            const hit = this.randomSource() <= hitChance;

            const attackerId =
                attacker.id || (side === "hero" ? "hero" : "creature");
            const defenderId =
                defender.id || (side === "hero" ? "creature" : "hero");
            const attackerName =
                attacker.name || (side === "hero" ? "Você" : "O inimigo");
            const defenderName =
                defender.name || (side === "hero" ? "O inimigo" : "Você");

            if (!hit) {
                const weapon =
                    side === "hero"
                        ? (options.weapon || this.getEquippedWeapon())
                        : null;

                const result = {
                    hit: false,
                    amount: 0,
                    attacker: attackerId,
                    attackerName,
                    target: defenderId,
                    targetName: defenderName,
                    side,
                    hitChance,
                    isCrit: false,
                    isBlocked: false,
                    weaponId:
                        weapon?.instanceId ||
                        weapon?.templateId ||
                        weapon?.id ||
                        null,
                    weaponName:
                        weapon?.name ||
                        (
                            side === "hero"
                                ? "Ataque desarmado"
                                : null
                        ),
                    primarySlot: options.primarySlot || null,
                    skillId: options.skillId || null,
                    skillName: options.attackLabel || null,
                    attackLabel: options.attackLabel || null,
                    damageMultiplier: Math.max(0.05, number(options.damageMultiplier, 1)),
                    monsterAbility: options.monsterAbility ? clone(options.monsterAbility) : null
                };

                result.message = this.formatAttackMessage(result);
                return result;
            }

            const criticalChance = clamp(
                number(attackerStats.critical, 0.05),
                0,
                0.75
            );

            const isCrit =
                this.randomSource() <= criticalChance;

            const blockChance = clamp(
                number(defenderStats.blockChance, 0),
                0,
                0.75
            );

            const isBlocked =
                this.randomSource() <= blockChance;

            const blockReduction = isBlocked
                ? clamp(
                    number(
                        defenderStats.blockReduction,
                        0.35
                    ),
                    0,
                    0.90
                )
                : 0;

            let amount;
            let damageBreakdown = null;

            if (side === "hero") {
                damageBreakdown = this.calculateDamage(
                    defender,
                    {
                        details: true,
                        isCrit,
                        isBlocked,
                        blockReduction,
                        weapon: options.weapon || this.getEquippedWeapon()
                    }
                );

                const attackMultiplier = Math.max(
                    0.05,
                    number(options.damageMultiplier, 1)
                );
                if (Math.abs(attackMultiplier - 1) > 0.0001) {
                    damageBreakdown.damageBeforeDefense = Math.max(
                        1,
                        Math.round(damageBreakdown.damageBeforeDefense * attackMultiplier)
                    );
                    damageBreakdown.attackMultiplier = attackMultiplier;
                    damageBreakdown.amount = Math.max(
                        1,
                        Math.round(damageBreakdown.damageBeforeDefense - damageBreakdown.enemyDefense)
                    );
                    if (blockReduction > 0) {
                        damageBreakdown.amount = Math.max(
                            1,
                            Math.round(damageBreakdown.amount * (1 - blockReduction))
                        );
                    }
                }

                amount = damageBreakdown.amount;
            } else {
                const fallbackDamage = Math.max(
                    1,
                    integer(
                        attacker.damage ??
                        attackerStats.damage ??
                        attackerStats.str,
                        1
                    )
                );

                const minDamage = Math.max(
                    1,
                    integer(
                        attackerStats.damageMin,
                        fallbackDamage
                    )
                );

                const maxDamage = Math.max(
                    minDamage,
                    integer(
                        attackerStats.damageMax,
                        fallbackDamage
                    )
                );

                amount = this.randomInt(
                    minDamage,
                    maxDamage
                );

                if (isCrit) {
                    amount = Math.max(
                        1,
                        Math.round(amount * 1.75)
                    );
                }

                const defense = Math.max(
                    0,
                    number(defenderStats.defense, 0)
                );

                amount = Math.max(
                    1,
                    Math.round(amount - defense * 0.5)
                );

                if (isBlocked) {
                    amount = Math.max(
                        1,
                        Math.round(
                            amount * (1 - blockReduction)
                        )
                    );
                }

                const creatureAttackMultiplier = Math.max(
                    0.05,
                    number(options.damageMultiplier, 1)
                );
                if (Math.abs(creatureAttackMultiplier - 1) > 0.0001) {
                    amount = Math.max(1, Math.round(amount * creatureAttackMultiplier));
                }

                damageBreakdown = {
                    baseDamage: amount,
                    multiplier: creatureAttackMultiplier,
                    individualMultiplier: 1,
                    affixBonus: 0,
                    scaledWeaponDamage: amount,
                    isCrit,
                    criticalChance,
                    criticalMultiplier:
                        isCrit
                            ? this.config.defaultCriticalMultiplier
                            : 1,
                    damageBeforeDefense: amount,
                    enemyDefense: Math.max(
                        0,
                        number(defenderStats.defense, 0)
                    ),
                    blockReduction
                };
            }

            const result = {
                hit: true,
                amount,
                attacker: attackerId,
                attackerName,
                target: defenderId,
                targetName: defenderName,
                side,
                hitChance,
                criticalChance,
                isCrit,
                criticalMultiplier:
                    damageBreakdown?.criticalMultiplier ||
                    (isCrit
                        ? this.config.defaultCriticalMultiplier
                        : 1),
                isBlocked,
                blockReduction,
                weaponId:
                    damageBreakdown?.weaponId || null,
                weaponName:
                    damageBreakdown?.weaponName || null,
                damageBreakdown:
                    damageBreakdown
                        ? clone(damageBreakdown)
                        : null,
                primarySlot: options.primarySlot || null,
                skillId: options.skillId || null,
                skillName: options.attackLabel || null,
                attackLabel: options.attackLabel || null,
                damageMultiplier: Math.max(0.05, number(options.damageMultiplier, 1)),
                monsterAbility: options.monsterAbility ? clone(options.monsterAbility) : null
            };

            result.message = this.formatAttackMessage(result);
            return result;
        },

        formatAttackMessage(result) {
            if (!result) return "Aguardando ação...";

            if (result.side === "hero") {
                const targetName =
                    String(
                        result.targetName ||
                        Aethra.GameState.battle?.creature?.name ||
                        "inimigo"
                    )
                        .replace(/^O\s+/i, "")
                        .replace(/^A\s+/i, "");

                const weaponName =
                    result.weaponName ||
                    this.getEquippedWeapon(result.primarySlot === "right" ? "offhand" : "weapon")?.name ||
                    "Ataque desarmado";
                const attackLabel = result.attackLabel || null;

                if (!result.hit) {
                    return attackLabel
                        ? `${attackLabel} errou ${targetName}!`
                        : weaponName === "Ataque desarmado"
                            ? `Você errou o ataque contra ${targetName}!`
                            : `Sua ${weaponName} errou o ataque contra ${targetName}!`;
                }

                const critical = result.isCrit ? " Golpe crítico!" : "";
                const blocked = result.isBlocked
                    ? " O golpe foi parcialmente bloqueado."
                    : "";

                if (attackLabel) {
                    return `${attackLabel} causou ${integer(result.amount, 0)} de dano no ${targetName}!${critical}${blocked}`;
                }

                return weaponName === "Ataque desarmado"
                    ? `Seu ataque causou ${integer(result.amount, 0)} de dano no ${targetName}!${critical}${blocked}`
                    : `Sua ${weaponName} causou ${integer(result.amount, 0)} de dano no ${targetName}!${critical}${blocked}`;
            }

            const enemyName =
                result.attackerName ||
                Aethra.GameState.battle?.creature?.name ||
                "O inimigo";

            const enemyDisplay = enemyName.startsWith("O ") ? enemyName : `O ${enemyName}`;
            const enemyAttackName = result.attackLabel || result.skillName || "Ataque Básico";

            if (!result.hit) {
                return `${enemyDisplay} usou ${enemyAttackName}, mas errou!`;
            }

            const critical = result.isCrit ? " Ataque crítico!" : "";
            const blocked = result.isBlocked
                ? " Você bloqueou parte do dano."
                : "";

            return `${enemyDisplay} usou ${enemyAttackName} e causou ${integer(result.amount, 0)} de dano em você!${critical}${blocked}`;
        },

        getAnalyticCombatLogs(result) {
            if (!result?.hit) return [];

            const breakdown = result.damageBreakdown || {};
            const logs = [];
            const format = (value, digits = 2) =>
                Number(value || 0).toFixed(digits);

            if (result.isCrit) {
                const criticalMultiplier = Math.max(
                    1,
                    number(
                        result.criticalMultiplier ?? breakdown.criticalMultiplier,
                        this.config.defaultCriticalMultiplier
                    )
                );

                logs.push({
                    type: "critical-analysis",
                    color: "#ffb347",
                    message:
                        `CRÍTICO ATIVADO! ${format(criticalMultiplier)}x de dano` +
                        (breakdown.damageBeforeDefense !== undefined
                            ? ` | Pré-armadura ${integer(breakdown.damageBeforeDefense, 0)}`
                            : "") +
                        (breakdown.enemyDefense !== undefined
                            ? ` | DEF ${format(breakdown.enemyDefense, 0)}`
                            : "") +
                        ` | Final ${integer(result.amount, 0)}`
                });
            }

            const skillMultiplier = number(result.damageMultiplier, 1);
            if (skillMultiplier > 1.0001) {
                logs.push({
                    type: "skill-bonus-analysis",
                    color: "#66c2ff",
                    message:
                        `BÔNUS DE SKILL ATIVADO: ${format(skillMultiplier)}x` +
                        (result.skillName ? ` (${result.skillName})` : "") +
                        ` | Dano final ${integer(result.amount, 0)}`
                });
            }

            const itemMultiplier = number(breakdown.multiplier, 1);
            const individualMultiplier = number(
                breakdown.individualMultiplier,
                1
            );
            const affixBonus = number(breakdown.affixBonus, 0);
            const hasItemBonus =
                result.side === "hero" &&
                (
                    Math.abs(itemMultiplier - 1) > 0.0001 ||
                    Math.abs(individualMultiplier - 1) > 0.0001 ||
                    Math.abs(affixBonus) > 0.0001
                );

            if (hasItemBonus && (result.isCrit || skillMultiplier > 1.0001)) {
                logs.push({
                    type: "item-roll-analysis",
                    color: "#bd8cff",
                    message:
                        `ROLL DA BUILD: item ${format(itemMultiplier)}x` +
                        ` × IV ${format(individualMultiplier, 3)}x` +
                        (Math.abs(affixBonus) > 0.0001
                            ? ` + ${format(affixBonus, 1)} de afixo`
                            : "") +
                        (breakdown.baseDamage !== undefined
                            ? ` | Base ${integer(breakdown.baseDamage, 0)}`
                            : "")
                });
            }

            if (result.isBlocked) {
                const reduction = clamp(
                    number(result.blockReduction ?? breakdown.blockReduction, 0),
                    0,
                    0.90
                );

                logs.push({
                    type: "block-analysis",
                    color: "#8fd3ff",
                    message:
                        `BLOQUEIO ATIVADO: ${(reduction * 100).toFixed(1)}% de redução` +
                        ` | Dano recebido ${integer(result.amount, 0)}`
                });
            }

            return logs.map((entry) => ({
                ...entry,
                battleId: Aethra.GameState.battle?.battleId || null,
                round: Aethra.GameState.battle?.round || 0,
                source: "battle-analytics",
                createdAt: Date.now()
            }));
        },

        emitAnalyticCombatLogs(result) {
            const logs = this.getAnalyticCombatLogs(result);
            logs.forEach((log) => this.emitBattleLog(log));
            return logs;
        },

        emitAttackResult(result) {
            const payload = {
                ...clone(result),
                message:
                    result?.message ||
                    this.formatAttackMessage(result)
            };

            if (payload.side === "hero") {
                this.emitFloatingCombatText(payload);
            }

            if (!payload.hit) {
                Aethra.EventBus.emit("AttackMissed", payload);
                Aethra.EventBus.emit("battle:attack-missed", clone(payload));
                return payload;
            }

            Aethra.EventBus.emit("DamageDealt", payload);
            Aethra.EventBus.emit("battle:damage-dealt", clone(payload));
            this.emitAnalyticCombatLogs(payload);
            return payload;
        },

        emitCombatTick(heroAttack, creatureAttack) {
            const battle = Aethra.GameState.battle;
            const payload = {
                battleId: battle.battleId,
                round: battle.round,
                creatureId: battle.creature?.id || null,
                creatureHp: Math.max(0, integer(battle.creature?.hp, 0)),
                creatureMaxHp: Math.max(1, integer(battle.creature?.maxHp, 1)),
                heroHp: Math.max(0, integer(Aethra.GameState.hero.stats.hp, 0)),
                heroMaxHp: Math.max(1, integer(Aethra.GameState.hero.stats.maxHp, 1)),
                heroAttack: clone(heroAttack),
                creatureAttack: creatureAttack ? clone(creatureAttack) : null,
                message: [
                    heroAttack?.message,
                    creatureAttack?.message
                ].filter(Boolean).join(" "),
                rewards: battle.lastRewards
                    ? clone(battle.lastRewards)
                    : null
            };

            battle.lastResult = payload;
            battle.lastMessage =
                payload.message || battle.lastMessage || "";
            battle.lastMessageColor =
                heroAttack?.logColor || null;

            Aethra.EventBus.emit("CombatTick", payload);
            Aethra.EventBus.emit("battle:tick", payload);
            Aethra.EventBus.emit("HealthChanged", {
                heroHp: payload.heroHp,
                heroMaxHp: payload.heroMaxHp,
                creatureHp: payload.creatureHp,
                creatureMaxHp: payload.creatureMaxHp
            });
        },

        victory(creature) {
            if (!this.isFighting) return false;

            const battle = Aethra.GameState.battle;
            const isHuntBattle = Boolean(
                battle.source === "hunt" ||
                battle.huntId ||
                creature.huntId ||
                battle.encounterId ||
                creature.encounterId
            );

            const gold = Number.isFinite(Number(creature.gold))
                ? Math.max(0, integer(creature.gold, 0))
                : this.rollGold(creature);

            const rewards = {
                xp: Math.max(0, integer(creature.xp, 0)),
                gold,
                items: [],
                lootCount: 0,
                lootValue: 0
            };

            const defeatedPayload = {
                id: creature.id,
                enemyId: creature.id,
                name: creature.name,
                xp: rewards.xp,
                gold: rewards.gold,
                level: creature.level,
                battleId: battle.battleId,
                huntId: battle.huntId || creature.huntId || null,
                encounterId:
                    battle.encounterId ||
                    creature.encounterId ||
                    null,
                source:
                    isHuntBattle
                        ? "battle-hunt"
                        : "battle-standalone",
                enemy: clone(creature),
                rewards: clone(rewards),
                defeatedAt: new Date().toISOString()
            };

            /*
             * O EventBus é síncrono. Quando o emit retorna, o HuntSystem já
             * processou XP, gold e loot da caçada.
             */
            Aethra.EventBus.emit("EnemyDefeated", defeatedPayload);

            if (isHuntBattle) {
                const huntRewards =
                    Aethra.GameState.hunt?.lastRewards || null;

                const sameEnemy =
                    huntRewards &&
                    (!huntRewards.enemyId ||
                        huntRewards.enemyId === creature.id);

                const sameEncounter =
                    huntRewards &&
                    (!defeatedPayload.encounterId ||
                        !huntRewards.encounterId ||
                        huntRewards.encounterId ===
                            defeatedPayload.encounterId);

                if (sameEnemy && sameEncounter) {
                    Object.assign(rewards, clone(huntRewards));
                }
            } else {
                let economyResult = null;

                if (
                    Aethra.LootSystem &&
                    typeof Aethra.LootSystem.processMonsterDefeat === "function"
                ) {
                    economyResult = Aethra.LootSystem.processMonsterDefeat(
                        creature.id,
                        {
                            enemyId: creature.id,
                            battleId: battle.battleId,
                            source: "battle-system"
                        }
                    );
                } else if (
                    Aethra.LootSystem &&
                    typeof Aethra.LootSystem.generateLoot === "function"
                ) {
                    const items = Aethra.LootSystem.generateLoot(creature.id, {
                        enemyId: creature.id,
                        battleId: battle.battleId,
                        source: "battle-system"
                    }) || [];
                    economyResult = {
                        gold: rewards.gold,
                        items,
                        ...this.summarizeLoot(items)
                    };
                } else {
                    Aethra.EventBus.emit("LootFound", {
                        enemyId: creature.id,
                        battleId: battle.battleId,
                        source: "battle-system"
                    });
                }

                if (economyResult) {
                    rewards.gold = Math.max(0, integer(economyResult.gold, 0));
                    rewards.items = clone(economyResult.items || []);
                    rewards.lootCount = Math.max(0, integer(economyResult.lootCount, 0));
                    rewards.lootValue = Math.max(0, integer(economyResult.lootValue, 0));
                    rewards.economyProfile = economyResult.profile
                        ? clone(economyResult.profile)
                        : null;
                }

                this.applyStandaloneGold(rewards.gold, creature.id);
            }

            const payload = {
                ...defeatedPayload,
                gold: Math.max(0, integer(rewards.gold, 0)),
                rewards: clone(rewards),
                message: this.formatRewardMessage(
                    creature.name,
                    rewards
                )
            };

            battle.lastRewards = clone(rewards);
            battle.lastMessage = payload.message;
            battle.lastResult = clone(payload);

            Aethra.EventBus.emit(
                "BattleRewardsGranted",
                clone(payload)
            );
            Aethra.EventBus.emit(
                "battle:rewards-granted",
                clone(payload)
            );

            console.log(payload.message);

            this.endBattle("victory", payload);
            return payload;
        },

        summarizeLoot(items = []) {
            const safeItems = Array.isArray(items) ? items : [];
            let lootCount = 0;
            let lootValue = 0;

            safeItems.forEach((item) => {
                const quantity = Math.max(
                    1,
                    integer(item?.quantity, 1)
                );

                const unitValue = Math.max(
                    0,
                    integer(
                        item?.price ??
                        item?.value ??
                        item?.basePrice,
                        0
                    )
                );

                lootCount += quantity;
                lootValue += unitValue * quantity;
            });

            return {
                items: clone(safeItems),
                lootCount,
                lootValue
            };
        },

        formatRewardMessage(creatureName, rewards = {}) {
            const xp = Math.max(0, integer(rewards.xp, 0));
            const gold = Math.max(0, integer(rewards.gold, 0));
            const lootCount = Math.max(
                0,
                integer(rewards.lootCount, 0)
            );

            const goldText =
                gold > 0
                    ? `+${gold} de ouro`
                    : "nenhum ouro";

            const lootText =
                lootCount > 0
                    ? `${lootCount} item${lootCount === 1 ? "" : "s"} de loot`
                    : "nenhum loot";

            return `Vitória contra ${creatureName}! +${xp} XP, ${goldText} e ${lootText}.`;
        },

        defeat() {
            if (!this.isFighting) return false;

            const hero = Aethra.GameState.hero;
            const battle = Aethra.GameState.battle;
            const currentGold = Math.max(0, integer(hero.gold, 0));
            const penalty = Math.floor(
                currentGold * clamp(this.config.hardcoreGoldPenalty, 0, 1)
            );

            hero.gold = Math.max(0, currentGold - penalty);

            if (Object.prototype.hasOwnProperty.call(hero.stats, "gold")) {
                hero.stats.gold = hero.gold;
            }

            hero.stats.hp = Math.max(1, integer(hero.stats.maxHp, 100));

            const defeatMessage =
                `Você foi derrotado! Perdeu ${penalty} de ouro.`;

            battle.lastMessage = defeatMessage;

            const payload = {
                battleId: battle.battleId,
                creatureId: battle.creature?.id || null,
                penalty,
                goldBefore: currentGold,
                goldAfter: hero.gold,
                restoredHp: hero.stats.hp,
                source: battle.source || "battle",
                message: defeatMessage
            };

            Aethra.EventBus.emit("goldChanged", {
                amount: -penalty,
                total: hero.gold,
                source: "hardcore-defeat"
            });

            Aethra.EventBus.emit("PlayerDefeated", payload);
            Aethra.EventBus.emit("HeroDefeated", payload);
            Aethra.EventBus.emit("battle:player-defeated", payload);

            console.warn(defeatMessage);

            this.endBattle("defeat", payload);
            return payload;
        },

        stopCombat(reason = "manual") {
            if (!this.isFighting) return false;

            const payload = {
                battleId: Aethra.GameState.battle.battleId,
                reason
            };

            this.endBattle(reason, payload);
            return true;
        },

        endBattle(reason, result = null) {
            this.cancelTimer();
            this.battleToken += 1;
            this.isFighting = false;
            this.lastTickAt = null;

            const battle = Aethra.GameState.battle;
            const endedCreature = battle.creature ? clone(battle.creature) : null;

            battle.isFighting = false;
            battle.endedAt = new Date().toISOString();
            battle.lastResult = result ? clone(result) : battle.lastResult;
            battle.lastMessage =
                result?.message ||
                battle.lastMessage ||
                "";
            battle.lastEnemy = endedCreature;
            battle.queuedPrimaryAttacks = [];

            const payload = {
                reason,
                battleId: battle.battleId,
                source: battle.source,
                creature: endedCreature,
                result: result ? clone(result) : null,
                startedAt: battle.startedAt,
                endedAt: battle.endedAt
            };

            battle.creature = null;
            this.syncCombatMirror();

            Aethra.EventBus.emit("BattleEnded", payload);
            Aethra.EventBus.emit("CombatEnded", payload);
            Aethra.EventBus.emit("battle:ended", payload);

            this.save();
            return payload;
        },

        applyStandaloneGold(gold, creatureId) {
            const amount = Math.max(0, integer(gold, 0));
            if (amount <= 0) return 0;

            const hero = Aethra.GameState.hero;
            hero.gold = Math.max(0, integer(hero.gold, 0) + amount);

            if (Object.prototype.hasOwnProperty.call(hero.stats, "gold")) {
                hero.stats.gold = hero.gold;
            }

            Aethra.EventBus.emit("goldChanged", {
                amount,
                total: hero.gold,
                source: "battle",
                enemyId: creatureId
            });

            return amount;
        },

        rollGold(creature) {
            const guaranteedGold = integer(creature.gold, 0);

            if (!Number.isFinite(Number(creature.goldChance))) {
                return Math.max(0, guaranteedGold);
            }

            const chance = clamp(number(creature.goldChance, 0), 0, 1);
            if (this.randomSource() > chance) return 0;

            const min = Math.max(0, integer(creature.goldMin, guaranteedGold));
            const max = Math.max(min, integer(creature.goldMax, min));

            return this.randomInt(min, max);
        },

        getHeroCombatant() {
            const hero = Aethra.GameState.hero;

            return {
                id: hero.id || "hero",
                name: hero.name || "Aethra",
                hp: hero.stats.hp,
                maxHp: hero.stats.maxHp,
                damage: hero.stats.damage,
                stats: hero.stats
            };
        },

        getHeroSnapshot() {
            const hero = Aethra.GameState.hero;

            return {
                id: hero.id || "hero",
                name: hero.name || "Aethra",
                level: Math.max(1, integer(hero.level, 1)),
                gold: Math.max(0, integer(hero.gold, 0)),
                stats: clone(hero.stats || {})
            };
        },

        syncCombatMirror() {
            if (!this.config.mirrorCombatState) return;

            const battle = Aethra.GameState.battle;
            Aethra.GameState.combat = Aethra.GameState.combat || {};

            Object.assign(Aethra.GameState.combat, {
                isActive: Boolean(battle.isFighting),
                combatId: battle.battleId,
                round: battle.round,
                turn: "automatic",
                enemy: battle.creature ? clone(battle.creature) : null,
                lastEnemy:
                    battle.lastEnemy
                        ? clone(battle.lastEnemy)
                        : Aethra.GameState.combat.lastEnemy || null,
                lastResult:
                    battle.lastResult
                        ? clone(battle.lastResult)
                        : null,
                lastMessage: battle.lastMessage || "",
                lastMessageColor:
                    battle.lastMessageColor || null,
                logs: Array.isArray(battle.logs)
                    ? clone(battle.logs)
                    : [],
                lastLog:
                    battle.lastLog
                        ? clone(battle.lastLog)
                        : null,
                lastRewards:
                    battle.lastRewards
                        ? clone(battle.lastRewards)
                        : null,
                startedAt: battle.startedAt,
                endedAt: battle.endedAt
            });
        },

        getSnapshot() {
            this.ensureState();

            const battle = Aethra.GameState.battle;

            return {
                initialized: this.initialized,
                isFighting: this.isFighting,
                battleId: battle.battleId,
                round: battle.round,
                source: battle.source,
                creature: battle.creature ? clone(battle.creature) : null,
                hero: this.getHeroSnapshot(),
                startedAt: battle.startedAt,
                endedAt: battle.endedAt,
                lastResult: battle.lastResult ? clone(battle.lastResult) : null
            };
        },

        setRandomSource(fn) {
            if (typeof fn !== "function") return false;
            this.randomSource = fn;
            return true;
        },

        setTickSpeed(milliseconds) {
            const speed = Math.max(100, integer(milliseconds, 1000));
            this.config.tickMs = speed;
            return speed;
        },

        createBattleId() {
            if (window.crypto?.randomUUID) {
                return `battle_${window.crypto.randomUUID()}`;
            }

            return `battle_${Date.now().toString(36)}_${Math.random()
                .toString(36)
                .slice(2, 9)}`;
        },

        randomInt(min, max) {
            const safeMin = Math.ceil(number(min, 0));
            const safeMax = Math.floor(number(max, safeMin));

            return Math.floor(
                this.randomSource() * (safeMax - safeMin + 1)
            ) + safeMin;
        },

        cancelTimer() {
            if (this.timerId !== null) {
                window.clearTimeout(this.timerId);
                this.timerId = null;
            }
        },

        save() {
            if (
                Aethra.SaveManager &&
                typeof Aethra.SaveManager.save === "function"
            ) {
                Aethra.SaveManager.save("battle-system");
            }
        }
    };

    Aethra.BattleSystem.init();
})(window.Aethra);
