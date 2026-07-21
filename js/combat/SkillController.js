// SkillController.js - Prioridades, Targeting e Smart Healing
(function (Aethra) {
    "use strict";

    if (
        !Aethra ||
        !Aethra.GameState ||
        !Aethra.EventBus ||
        !Aethra.SkillSystem
    ) {
        throw new Error(
            "SkillController.js requer GameState, EventBus e SkillSystem."
        );
    }

    const DEFAULT_HEAL_THRESHOLD = 50;
    const MIN_HEAL_THRESHOLD = 5;
    const MAX_HEAL_THRESHOLD = 95;
    const OVERHEAL_SAFETY_PERCENT = 95;
    const CONTROLLER_STATE_VERSION = 2;

    function clone(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }

    function safeNumber(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed)
            ? parsed
            : fallback;
    }

    function clamp(value, minimum, maximum) {
        return Math.min(
            maximum,
            Math.max(minimum, value)
        );
    }

    function normalizeThreshold(value, fallback = DEFAULT_HEAL_THRESHOLD) {
        return Math.round(
            clamp(
                safeNumber(value, fallback),
                MIN_HEAL_THRESHOLD,
                MAX_HEAL_THRESHOLD
            )
        );
    }

    function isHealingSkill(skill) {
        if (!skill) return false;

        return (
            String(skill.type || "").toLowerCase() === "heal" ||
            String(skill.effect?.type || "").toLowerCase() === "heal"
        );
    }

    function isDamageSkill(skill) {
        if (!skill) return false;

        return (
            String(skill.type || "").toLowerCase() === "damage" ||
            String(skill.effect?.type || "").toLowerCase() === "damage"
        );
    }

    function isPrimarySkill(skillOrId) {
        return Boolean(Aethra.SkillSystem?.isPrimarySkill?.(skillOrId));
    }

    function getDefaultAutoValue(skillId, skill) {
        if (isPrimarySkill(skill)) return false;
        if (isHealingSkill(skill)) return true;
        return isDamageSkill(skill);
    }

    function getSkillTarget(skill, context = {}) {
        const targetType =
            String(skill?.effect?.target || "").toLowerCase();

        if (
            targetType === "self" ||
            isHealingSkill(skill)
        ) {
            return Aethra.GameState.hero;
        }

        return (
            context.creature ||
            context.target ||
            Aethra.GameState.battle?.creature ||
            Aethra.GameState.combat?.enemy ||
            null
        );
    }

    Aethra.SkillController = {
        initialized: false,
        lastProcessedTick: null,
        manualQueue: [],

        constants: Object.freeze({
            defaultHealThreshold: DEFAULT_HEAL_THRESHOLD,
            minHealThreshold: MIN_HEAL_THRESHOLD,
            maxHealThreshold: MAX_HEAL_THRESHOLD,
            overhealSafetyPercent: OVERHEAL_SAFETY_PERCENT
        }),

        init(player = Aethra.GameState.hero) {
            this.bindPlayer(player);

            if (this.initialized) {
                return this.getSnapshot();
            }

            this.ensureState();
            this.bindEvents();
            this.initialized = true;

            const payload = this.getSnapshot();

            Aethra.EventBus.emit(
                "SkillControllerReady",
                payload
            );
            Aethra.EventBus.emit(
                "skill-controller:ready",
                clone(payload)
            );

            return payload;
        },

        bindPlayer(player = Aethra.GameState.hero) {
            if (!player || typeof player !== "object") {
                return null;
            }

            /*
             * Versões anteriores guardavam o estado serializável em
             * hero.skillController. Antes de anexar a instância em execução,
             * migra esse conteúdo para hero.skillControllerState.
             */
            const legacyState =
                player.skillController &&
                player.skillController !== this &&
                typeof player.skillController === "object"
                    ? player.skillController
                    : null;

            if (
                !player.skillControllerState &&
                legacyState
            ) {
                player.skillControllerState = legacyState;
            }

            Object.defineProperty(this, "player", {
                value: player,
                writable: true,
                configurable: true,
                enumerable: false
            });

            Object.defineProperty(player, "skillController", {
                value: this,
                writable: true,
                configurable: true,
                enumerable: false
            });

            return this;
        },

        ensureState(forceReset = false) {
            Aethra.SkillSystem.ensureState();

            const currentHero =
                Aethra.GameState.hero ||
                (Aethra.GameState.hero = {});

            if (this.player !== currentHero) {
                this.bindPlayer(currentHero);
            }

            const hero = this.player || currentHero;

            if (
                forceReset ||
                !hero.skillControllerState ||
                typeof hero.skillControllerState !== "object"
            ) {
                hero.skillControllerState = {
                    version: CONTROLLER_STATE_VERSION,
                    settings: {},
                    lastAction: null,
                    lastDecision: null
                };
            }

            const state = hero.skillControllerState;
            const previousVersion = Math.max(1, Math.floor(safeNumber(state.version, 1)));
            state.settings =
                state.settings &&
                typeof state.settings === "object"
                    ? state.settings
                    : {};

            const skills = Aethra.SkillSystem.getSkills();

            Object.entries(skills).forEach(
                ([skillId, skill]) => {
                    const previous =
                        state.settings[skillId] || {};

                    state.settings[skillId] = {
                        auto:
                            previousVersion < CONTROLLER_STATE_VERSION &&
                            (skillId === "heavy_strike" || skillId === "fire_bolt")
                                ? true
                                : previous.auto !== undefined
                                    ? Boolean(previous.auto)
                                    : getDefaultAutoValue(
                                        skillId,
                                        skill
                                    ),

                        hpThreshold: isHealingSkill(skill)
                            ? normalizeThreshold(
                                previous.hpThreshold ??
                                Aethra.WindowManager
                                    ?.loadHpThreshold?.(
                                        skillId,
                                        null
                                    ) ??
                                skill.hpThreshold ??
                                skill.effect?.hpThreshold,
                                DEFAULT_HEAL_THRESHOLD
                            )
                            : null
                    };
                }
            );

            Object.keys(state.settings).forEach((skillId) => {
                if (!skills[skillId]) {
                    delete state.settings[skillId];
                }
            });

            state.version = CONTROLLER_STATE_VERSION;
            return state;
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            const restore = () => {
                this.lastProcessedTick = null;
                this.manualQueue = [];
                this.bindPlayer(Aethra.GameState.hero);
                this.ensureState();

                Aethra.EventBus.emit(
                    "SkillControllerSettingsChanged",
                    this.getSnapshot()
                );
            };

            Aethra.EventBus.on("game:reset", () => {
                this.ensureState(true);
                restore();
            });

            Aethra.EventBus.on("save:loaded", restore);
            Aethra.EventBus.on("state:restored", restore);

            Aethra.EventBus.on("skill:registered", () => {
                this.ensureState();

                Aethra.EventBus.emit(
                    "SkillControllerSettingsChanged",
                    this.getSnapshot()
                );
            });

            Aethra.EventBus.on("BattleStarted", () => {
                this.lastProcessedTick = null;
                this.manualQueue = [];
            });

            Aethra.EventBus.on("CombatEnded", () => {
                this.lastProcessedTick = null;
                this.manualQueue = [];
            });
        },

        getHeroHpState() {
            const hero =
                this.player ||
                Aethra.GameState.hero ||
                {};
            const stats = hero.stats || {};

            const maxHp = Math.max(
                1,
                safeNumber(
                    stats.maxHp ??
                    hero.maxHp,
                    100
                )
            );

            const hp = clamp(
                safeNumber(
                    stats.hp ??
                    hero.hp,
                    maxHp
                ),
                0,
                maxHp
            );

            return {
                hp,
                maxHp,
                percent: maxHp > 0
                    ? (hp / maxHp) * 100
                    : 0,
                missing: Math.max(0, maxHp - hp)
            };
        },

        getSkillSetting(skillId) {
            const state = this.ensureState();
            const setting = state.settings[skillId];

            return setting
                ? clone(setting)
                : null;
        },

        getSettings() {
            return clone(
                this.ensureState().settings
            );
        },

        setAuto(skillId, enabled) {
            const state = this.ensureState();
            const skill = Aethra.SkillSystem.getSkill(skillId);

            if (!skill || !state.settings[skillId]) {
                return false;
            }

            state.settings[skillId].auto =
                Boolean(enabled);

            this.emitSettingsChanged(
                "auto",
                {
                    skillId,
                    auto:
                        state.settings[skillId].auto
                }
            );

            this.save("skill-auto-setting");
            return true;
        },

        setHpThreshold(skillId, value) {
            const state = this.ensureState();
            const skill = Aethra.SkillSystem.getSkill(skillId);

            if (
                !skill ||
                !isHealingSkill(skill) ||
                !state.settings[skillId]
            ) {
                return false;
            }

            const threshold =
                normalizeThreshold(value);

            state.settings[skillId].hpThreshold =
                threshold;

            this.emitSettingsChanged(
                "hp-threshold",
                {
                    skillId,
                    hpThreshold: threshold
                }
            );

            this.save("skill-heal-threshold");
            return threshold;
        },

        moveSkill(skillId, direction) {
            const bar =
                Aethra.SkillSystem.getActiveBar();

            if (!bar) return false;

            const currentIndex =
                bar.slots.indexOf(skillId);

            if (currentIndex < 0) return false;

            const delta =
                direction === "up" ||
                direction === -1
                    ? -1
                    : direction === "down" ||
                      direction === 1
                        ? 1
                        : 0;

            if (delta === 0) return false;

            let targetIndex =
                currentIndex + delta;

            while (
                targetIndex >= 0 &&
                targetIndex < bar.slots.length &&
                !bar.slots[targetIndex]
            ) {
                targetIndex += delta;
            }

            if (
                targetIndex < 0 ||
                targetIndex >= bar.slots.length
            ) {
                return false;
            }

            const moved =
                Aethra.SkillSystem.moveSkill(
                    currentIndex,
                    targetIndex
                );

            if (moved) {
                this.emitSettingsChanged(
                    "order",
                    {
                        skillId,
                        fromSlot: currentIndex,
                        toSlot: targetIndex
                    }
                );
            }

            return moved;
        },

        getOrderedSkills() {
            const bar =
                Aethra.SkillSystem.getActiveBar();

            if (!bar) return [];

            return bar.slots
                .map((skillId, slotIndex) => {
                    if (!skillId) return null;

                    const skill =
                        Aethra.SkillSystem.getSkill(
                            skillId
                        );

                    if (!skill || isPrimarySkill(skill)) return null;

                    return {
                        skillId,
                        slotIndex,
                        skill,
                        setting:
                            this.getSkillSetting(
                                skillId
                            )
                    };
                })
                .filter(Boolean);
        },

        /**
         * Prioridade absoluta de suporte.
         *
         * Esta função é chamada uma vez por rodada pelo BattleSystem.
         */
        checkSupportPriorities(context = {}) {
            const hp = this.getHeroHpState();

            /*
             * Smart Healing:
             * em 95% ou mais, nenhuma cura automática é permitida.
             */
            if (
                hp.percent >=
                OVERHEAL_SAFETY_PERCENT
            ) {
                return null;
            }

            const candidates =
                this.getOrderedSkills();

            for (const entry of candidates) {
                const {
                    skillId,
                    slotIndex,
                    skill,
                    setting
                } = entry;

                if (
                    !isHealingSkill(skill) ||
                    setting?.auto !== true
                ) {
                    continue;
                }

                const hpThreshold =
                    normalizeThreshold(
                        setting.hpThreshold,
                        DEFAULT_HEAL_THRESHOLD
                    );

                if (hp.percent >= hpThreshold) {
                    continue;
                }

                const target =
                    getSkillTarget(
                        skill,
                        context
                    );

                const validation =
                    Aethra.SkillSystem.canUseSkill(
                        skillId,
                        target
                    );

                if (!validation.ok) {
                    Aethra.EventBus.emit(
                        "skill-controller:heal-unavailable",
                        {
                            skillId,
                            hpPercent: hp.percent,
                            hpThreshold,
                            reason:
                                validation.reason
                        }
                    );

                    continue;
                }

                return {
                    priority: 1,
                    action: "heal",
                    source: "checkSupportPriorities",
                    skillId,
                    slotIndex,
                    skill,
                    setting,
                    target,
                    hp,
                    hpThreshold,
                    log: {
                        message:
                            `Cura automática ativada: ${skill.name}.`,
                        color: "#00ff00",
                        type: "heal",
                        source: "checkSupportPriorities"
                    }
                };
            }

            return null;
        },

        checkAutoAttackPriorities(context = {}) {
            const candidates =
                this.getOrderedSkills();

            for (const entry of candidates) {
                const {
                    skillId,
                    slotIndex,
                    skill,
                    setting
                } = entry;

                if (
                    !isDamageSkill(skill) ||
                    setting?.auto !== true
                ) {
                    continue;
                }

                const target =
                    getSkillTarget(
                        skill,
                        context
                    );

                if (!target) continue;

                const validation =
                    Aethra.SkillSystem.canUseSkill(
                        skillId,
                        target
                    );

                if (!validation.ok) {
                    continue;
                }

                return {
                    priority: 2,
                    action: "attack",
                    skillId,
                    slotIndex,
                    skill,
                    setting,
                    target
                };
            }

            return null;
        },

        queueManualSkill(skillId, target = null) {
            const skill =
                Aethra.SkillSystem.getSkill(skillId);

            if (!skill) return false;

            this.manualQueue.push({
                skillId,
                target: target
                    ? clone(target)
                    : null,
                queuedAt: Date.now()
            });

            Aethra.EventBus.emit(
                "skill-controller:manual-queued",
                {
                    skillId,
                    queueLength:
                        this.manualQueue.length
                }
            );

            return true;
        },

        consumeManualPriority(context = {}) {
            while (this.manualQueue.length > 0) {
                const command =
                    this.manualQueue.shift();

                const skill =
                    Aethra.SkillSystem.getSkill(
                        command.skillId
                    );

                if (!skill) continue;

                const target =
                    command.target ||
                    getSkillTarget(
                        skill,
                        context
                    );

                const validation =
                    Aethra.SkillSystem.canUseSkill(
                        command.skillId,
                        target
                    );

                if (!validation.ok) {
                    Aethra.EventBus.emit(
                        "skill-controller:manual-failed",
                        {
                            ...command,
                            reason:
                                validation.reason
                        }
                    );

                    continue;
                }

                return {
                    priority: 3,
                    action: isHealingSkill(skill)
                        ? "heal"
                        : isDamageSkill(skill)
                            ? "attack"
                            : "utility",
                    skillId:
                        command.skillId,
                    slotIndex: null,
                    skill,
                    setting:
                        this.getSkillSetting(
                            command.skillId
                        ),
                    target,
                    source: "manual-queue"
                };
            }

            return null;
        },

        checkPriorities(context = {}) {
            const support =
                this.checkSupportPriorities(
                    context
                );

            if (support) return support;

            const manual =
                this.consumeManualPriority(
                    context
                );

            if (manual) return manual;

            const automatic =
                this.checkAutoAttackPriorities(
                    context
                );

            if (automatic) return automatic;

            return {
                priority: 3,
                action: "wait",
                reason:
                    "waiting-manual-command"
            };
        },

        processCombatTick(context = {}) {
            const battle =
                context.battle ||
                Aethra.GameState.battle ||
                {};

            const tickKey =
                `${battle.battleId || "battle"}:`
                + `${battle.round || 0}`;

            if (this.lastProcessedTick === tickKey) {
                return {
                    executed: false,
                    action: "duplicate-tick",
                    tickKey
                };
            }

            this.lastProcessedTick = tickKey;

            const decision =
                this.checkPriorities({
                    ...context,
                    battle,
                    creature:
                        context.creature ||
                        battle.creature ||
                        null
                });

            const state = this.ensureState();

            state.lastDecision = {
                ...clone(decision),
                battleId:
                    battle.battleId || null,
                round:
                    battle.round || 0,
                decidedAt:
                    Date.now()
            };

            Aethra.EventBus.emit(
                "SkillPriorityChecked",
                clone(state.lastDecision)
            );

            if (decision.action === "wait") {
                const payload = {
                    executed: false,
                    ...decision,
                    message:
                        "Aguardando comando manual do jogador."
                };

                state.lastAction =
                    clone(payload);

                Aethra.EventBus.emit(
                    "skill-controller:waiting-manual",
                    clone(payload)
                );

                return payload;
            }

            return this.executeDecision(
                decision,
                {
                    ...context,
                    battle
                }
            );
        },

        update(deltaTime = 0, context = {}) {
            if (!this.initialized) {
                this.init(
                    context.hero ||
                    Aethra.GameState.hero
                );
            }

            const battle =
                context.battle ||
                Aethra.GameState.battle ||
                null;

            if (
                !battle ||
                battle.isActive === false ||
                battle.isFighting === false
            ) {
                return {
                    executed: false,
                    action: "no-active-battle",
                    deltaTime: safeNumber(deltaTime, 0)
                };
            }

            return this.processCombatTick({
                ...context,
                battle,
                hero:
                    context.hero ||
                    this.player ||
                    Aethra.GameState.hero,
                creature:
                    context.creature ||
                    battle.creature ||
                    null,
                deltaTime:
                    Math.max(
                        0,
                        safeNumber(deltaTime, 0)
                    )
            });
        },

        executeSkill(skillOrId, target = null, options = {}) {
            const skill =
                typeof skillOrId === "string"
                    ? Aethra.SkillSystem.getSkill(skillOrId)
                    : skillOrId;

            if (!skill) {
                return false;
            }

            const player =
                this.player ||
                Aethra.GameState.hero ||
                {};

            const manaCost = Math.max(
                0,
                safeNumber(
                    skill.manaCost ??
                    (
                        String(skill.cost?.resource || "")
                            .toLowerCase() === "mana"
                            ? skill.cost?.amount
                            : 0
                    ),
                    0
                )
            );

            const playerMana = Math.max(
                0,
                safeNumber(
                    player.mana ??
                    player.stats?.mana,
                    0
                )
            );

            if (playerMana < manaCost) {
                const failure = {
                    executed: false,
                    reason: "insufficient-mana",
                    skillId: skill.id,
                    currentMana: playerMana,
                    requiredMana: manaCost,
                    source:
                        options.source ||
                        "skill-controller"
                };

                Aethra.EventBus.emit(
                    "SkillUseFailed",
                    clone(failure)
                );
                Aethra.EventBus.emit(
                    "skill:use-failed",
                    clone(failure)
                );

                return false;
            }

            return Aethra.SkillSystem.useSkill(
                skill.id,
                target,
                options
            );
        },

        executeDecision(decision, context = {}) {
            const source =
                decision.source ||
                (
                    decision.priority === 1
                        ? "auto-support"
                        : decision.priority === 2
                            ? "auto-action-bar"
                            : "manual"
                );

            const usage =
                this.executeSkill(
                    decision.skillId,
                    decision.target,
                    {
                        source,
                        actionBarIndex:
                            Aethra.GameState.hero
                                ?.activeActionBar,
                        slotIndex:
                            decision.slotIndex
                    }
                );

            if (!usage) {
                return {
                    executed: false,
                    action:
                        decision.action,
                    skillId:
                        decision.skillId,
                    reason:
                        "skill-use-failed"
                };
            }

            let result;

            if (decision.action === "heal") {
                result =
                    this.applyHealingSkill(
                        decision.skill,
                        usage,
                        context
                    );
            } else if (decision.action === "attack") {
                result =
                    this.applyDamageSkill(
                        decision.skill,
                        usage,
                        decision.target,
                        context
                    );
            } else if (
                String(decision.skill?.type || decision.skill?.effect?.type || "").toLowerCase() === "buff"
            ) {
                result = this.applyBuffSkill(
                    decision.skill,
                    usage,
                    context
                );
            } else {
                result = {
                    action: "utility",
                    skillId:
                        decision.skillId,
                    message:
                        `${decision.skill.name} foi ativada.`
                };

                Aethra.EventBus.emit(
                    "SkillEffectApplied",
                    clone(result)
                );
            }

            const log = decision.log
                ? {
                    ...clone(decision.log),
                    message:
                        result?.message ||
                        decision.log.message,
                    color:
                        decision.log.color ||
                        "#00ff00"
                }
                : null;

            const payload = {
                executed: true,
                priority:
                    decision.priority,
                source,
                action:
                    decision.action,
                skillId:
                    decision.skillId,
                slotIndex:
                    decision.slotIndex,
                skill:
                    clone(decision.skill),
                usage:
                    clone(usage),
                result:
                    clone(result),
                log,
                logMessage:
                    log?.message || null,
                logColor:
                    log?.color || null,
                message:
                    result?.message ||
                    `${decision.skill.name} executada.`
            };

            const state = this.ensureState();

            state.lastAction = {
                ...clone(payload),
                executedAt:
                    Date.now()
            };

            Aethra.EventBus.emit(
                "SkillControllerActionExecuted",
                clone(payload)
            );
            Aethra.EventBus.emit(
                "skill-controller:action-executed",
                clone(payload)
            );

            return payload;
        },

        applyHealingSkill(skill, usage, context = {}) {
            const hero =
                Aethra.GameState.hero;
            const stats =
                hero.stats ||
                (hero.stats = {});

            const maxHp = Math.max(
                1,
                safeNumber(
                    stats.maxHp,
                    100
                )
            );

            const previousHp = clamp(
                safeNumber(
                    stats.hp,
                    maxHp
                ),
                0,
                maxHp
            );

            const effect =
                skill.effect || {};

            const baseAmount = Math.max(
                0,
                safeNumber(
                    effect.baseAmount,
                    0
                )
            );

            const magicScaling = Math.max(
                0,
                safeNumber(
                    effect.magicScaling,
                    0
                )
            );

            const magic = Math.max(
                0,
                safeNumber(
                    stats.mag,
                    0
                )
            );

            const masteryMultiplier = Math.max(
                1,
                safeNumber(
                    Aethra.SkillSystem?.getSkillPowerMultiplier?.(skill.id),
                    1
                )
            ) * Math.max(
                1,
                safeNumber(
                    Aethra.DisciplineSystem?.getPowerMultiplier?.(skill.disciplineId || "restoration"),
                    1
                )
            );

            const requestedAmount = Math.max(
                1,
                Math.round(
                    (
                        baseAmount +
                        magic * magicScaling
                    ) * masteryMultiplier
                )
            );

            const officialHealing = Aethra.BattleSystem?.applyHealing?.(
                requestedAmount,
                {
                    skillId: skill.id,
                    skillName: skill.name,
                    source: usage.source || "skill-controller"
                }
            );
            const nextHp = officialHealing
                ? officialHealing.hp
                : Math.min(maxHp, previousHp + requestedAmount);
            const healedAmount = officialHealing
                ? officialHealing.amount
                : nextHp - previousHp;

            if (!officialHealing) {
                stats.hp = nextHp;
                hero.hp = nextHp;
            }

            const message =
                `${skill.name} restaurou `
                + `${healedAmount} de vida!`;

            const result = {
                action: "heal",
                eventId: officialHealing?.eventId || null,
                skillId: skill.id,
                skillName: skill.name,
                amount: healedAmount,
                requestedAmount,
                previousHp,
                hp: nextHp,
                maxHp,
                hpPercent:
                    (nextHp / maxHp) * 100,
                masteryMultiplier,
                masteryLevel:
                    Aethra.SkillSystem?.getSkillProgression?.(skill.id)?.level || 1,
                message,
                source:
                    usage.source ||
                    "skill-controller"
            };

            if (!officialHealing) {
                Aethra.EventBus.emit(
                    "HealingReceived",
                    clone(result)
                );
            }
            Aethra.EventBus.emit(
                "SkillEffectApplied",
                clone(result)
            );

            const player =
                Aethra.EntityManager?.getEntity?.(
                    "player"
                );

            Aethra.EventBus.emit(
                "BattleFloatingText",
                {
                    text:
                        `+${healedAmount} HP`,
                    amount:
                        healedAmount,
                    type: "heal",
                    x:
                        safeNumber(
                            player?.x,
                            window.innerWidth / 2
                        ) + 16,
                    y:
                        safeNumber(
                            player?.y,
                            window.innerHeight / 2
                        ) - 10,
                    targetId: "player",
                    skillId:
                        skill.id
                }
            );

            return result;
        },

        applyBuffSkill(skill, usage, context = {}) {
            const effect = skill.effect || {};
            const battle = Aethra.GameState.battle || (Aethra.GameState.battle = {});
            const currentRound = Math.max(0, Math.floor(safeNumber(battle.round, 0)));
            const disciplineId = skill.disciplineId || "shield";
            const disciplineLevel = Aethra.DisciplineSystem?.getState?.(disciplineId)?.level || 1;
            const powerMultiplier = Math.max(
                1,
                safeNumber(Aethra.DisciplineSystem?.getPowerMultiplier?.(disciplineId), 1)
            );
            const defenseBonus = Math.max(0, Math.round(safeNumber(effect.amount, 0) * powerMultiplier));
            const blockChance = clamp(
                safeNumber(effect.blockChance, 0) + Math.max(0, disciplineLevel - 1) * 0.01,
                0,
                0.75
            );
            const blockReduction = clamp(safeNumber(effect.blockReduction, 0.5), 0, 0.9);

            battle.heroGuard = {
                skillId: skill.id,
                skillName: skill.name,
                disciplineId,
                disciplineLevel,
                defenseBonus,
                blockChance,
                blockReduction,
                activatedRound: currentRound,
                expiresRound: currentRound + 1
            };

            const result = {
                action: "buff",
                skillId: skill.id,
                skillName: skill.name,
                disciplineId,
                disciplineLevel,
                defenseBonus,
                blockChance,
                blockReduction,
                message: `${skill.name}: +${defenseBonus} Defesa e ${Math.round(blockChance * 100)}% de bloqueio até o próximo ataque inimigo.`,
                source: usage.source || context.source || "skill-controller"
            };

            Aethra.EventBus.emit("BuffApplied", clone(result));
            Aethra.EventBus.emit("SkillEffectApplied", clone(result));
            return result;
        },

        applyDamageSkill(
            skill,
            usage,
            target,
            context = {}
        ) {
            if (!target) {
                return {
                    action: "attack",
                    skillId: skill.id,
                    amount: 0,
                    message:
                        `${skill.name} não encontrou um alvo.`
                };
            }

            const effect =
                skill.effect || {};

            const masteryMultiplier = Math.max(
                1,
                safeNumber(
                    Aethra.SkillSystem?.getSkillPowerMultiplier?.(skill.id),
                    1
                )
            );

            const skillMultiplier = Math.max(
                0.01,
                safeNumber(
                    effect.damageMultiplier,
                    1
                ) * masteryMultiplier
            );

            const targetName =
                target.name ||
                target.id ||
                "inimigo";

            const magicBaseDamage = String(effect.damageType || "").toLowerCase() === "magic"
                ? Math.max(
                    2,
                    Math.round(
                        2 + safeNumber(Aethra.GameState.hero?.stats?.mag, 0) *
                        Math.max(0.35, safeNumber(effect.magicScaling, 0.65))
                    )
                )
                : null;

            // Habilidades ofensivas participam do mesmo teste de acerto,
            // crítico, esquiva e bloqueio que ataques primários.
            const attackResult = Aethra.BattleSystem?.resolveAttack?.(
                Aethra.BattleSystem.getHeroCombatant(),
                target,
                "hero",
                {
                    damageMultiplier: skillMultiplier,
                    skillId: skill.id,
                    attackLabel: skill.name,
                    disciplineId: skill.disciplineId || null,
                    baseDamage: magicBaseDamage
                }
            );

            const fallbackAmount = Math.max(
                1,
                Math.round(
                    safeNumber(Aethra.GameState.hero?.stats?.damage, 1) * skillMultiplier -
                    safeNumber(target.stats?.defense ?? target.defense, 0)
                )
            );

            const result = {
                ...(attackResult || {
                    hit: true,
                    side: "hero",
                    amount: fallbackAmount,
                    attacker: "hero",
                    target: target.id || "enemy",
                    targetName,
                    message: `${skill.name} causou ${fallbackAmount} de dano em ${targetName}!`
                }),
                action: "attack",
                skillId: skill.id,
                skillName: skill.name,
                damageMultiplier: skillMultiplier,
                masteryMultiplier,
                masteryLevel: Aethra.SkillSystem?.getSkillProgression?.(skill.id)?.level || 1
            };

            if (result.hit) {
                target.hp = Math.max(
                    0,
                    safeNumber(target.hp, 0) - safeNumber(result.amount, 0)
                );
            }

            if (
                Aethra.BattleSystem
                    ?.emitAttackResult
            ) {
                Aethra.BattleSystem
                    .emitAttackResult(result);
            } else {
                Aethra.EventBus.emit(
                    "DamageDealt",
                    clone(result)
                );
            }

            Aethra.EventBus.emit(
                "SkillEffectApplied",
                clone(result)
            );

            return result;
        },

        emitSettingsChanged(reason, extra = {}) {
            const payload = {
                reason,
                settings:
                    this.getSettings(),
                activeBar:
                    Aethra.SkillSystem
                        .getActiveBar(),
                ...clone(extra)
            };

            Aethra.EventBus.emit(
                "SkillControllerSettingsChanged",
                payload
            );
            Aethra.EventBus.emit(
                "skill-controller:settings-changed",
                clone(payload)
            );
        },

        getSnapshot() {
            return {
                initialized:
                    this.initialized,
                hp:
                    this.getHeroHpState(),
                settings:
                    this.getSettings(),
                orderedSkills:
                    this.getOrderedSkills(),
                manualQueue:
                    clone(this.manualQueue),
                lastAction:
                    clone(
                        this.ensureState()
                            .lastAction
                    ),
                lastDecision:
                    clone(
                        this.ensureState()
                            .lastDecision
                    ),
                constants:
                    clone(this.constants)
            };
        },

        save(reason = "skill-controller") {
            if (
                Aethra.SaveManager &&
                typeof Aethra.SaveManager.save === "function"
            ) {
                Aethra.SaveManager.save(reason);
            }
        }
    };

    Aethra.SkillController.init();
})(window.Aethra);
