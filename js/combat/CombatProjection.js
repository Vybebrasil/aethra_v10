// CombatProjection.js - Read model único do combate oficial.
(function initCombatProjection(Aethra) {
    "use strict";

    if (!Aethra?.GameState || !Aethra?.EventBus || !Aethra?.BattleSystem) {
        throw new Error("CombatProjection.js requer BattleSystem, GameState e EventBus.");
    }

    const MAX_TIMELINE = 40;
    const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const integer = (value, fallback = 0) => Math.max(0, Math.floor(number(value, fallback)));
    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

    const runtime = {
        initialized: false,
        sequence: 0,
        revision: 0,
        timeline: [],
        lastOutcome: null,
        lastReason: "bootstrap"
    };

    function resource(current, maximum, fallbackMaximum = 1) {
        const max = Math.max(0, number(maximum, fallbackMaximum));
        return {
            current: clamp(number(current, max), 0, max),
            maximum: max,
            percent: max > 0 ? clamp(number(current, max) / max, 0, 1) : 0
        };
    }

    function heroProjection() {
        const hero = Aethra.GameState.hero || {};
        const stats = hero.stats || {};
        return {
            id: String(hero.id || "hero"),
            name: String(hero.name || "Aethra"),
            level: Math.max(1, integer(hero.level, 1)),
            resources: {
                hp: resource(
                    hero.hp ?? stats.currentHp ?? stats.hp,
                    hero.maxHp ?? stats.maxHp,
                    1
                ),
                mana: resource(
                    hero.mana ?? stats.currentMana ?? stats.mana,
                    hero.maxMana ?? stats.maxMana,
                    0
                ),
                energy: resource(
                    hero.energy ?? hero.vigor ?? stats.currentEnergy ?? stats.energy ?? stats.vigor,
                    hero.maxEnergy ?? hero.maxVigor ?? stats.maxEnergy ?? stats.maxVigor,
                    0
                )
            },
            stats: clone(stats),
            lastAction: clone(Aethra.GameState.battle?.lastHeroAction || null)
        };
    }

    function enemyProjection(enemy = null) {
        if (!enemy) return null;
        const stats = enemy.stats || {};
        return {
            ...clone(enemy),
            id: String(enemy.id || enemy.enemyId || enemy.instanceId || "enemy"),
            name: String(enemy.name || "Criatura"),
            resources: {
                hp: resource(enemy.hp, enemy.maxHp ?? stats.maxHp ?? enemy.hp, 1),
                mana: resource(enemy.mana ?? stats.mana, enemy.maxMana ?? stats.maxMana, 0)
            }
        };
    }

    function activeEnemy() {
        const battle = Aethra.GameState.battle || {};
        return battle.creature || null;
    }

    function actorFrom(payload = {}) {
        const side = String(payload.side || payload.actor || payload.attacker || "").toLowerCase();
        if (["creature", "enemy", "monster"].includes(side)) return "enemy";
        return "hero";
    }

    function identityFor(actor, enemy = activeEnemy()) {
        if (actor === "enemy") {
            return {
                id: String(enemy?.id || "enemy"),
                name: String(enemy?.name || "Criatura")
            };
        }
        const hero = Aethra.GameState.hero || {};
        return {
            id: String(hero.id || "hero"),
            name: String(hero.name || "Aethra")
        };
    }

    function normalizeAttack(payload = {}, hit = payload.hit !== false) {
        const actor = actorFrom(payload);
        const source = identityFor(actor);
        const target = identityFor(actor === "hero" ? "enemy" : "hero");
        const amount = hit ? integer(payload.amount, 0) : 0;
        const outcome = !hit
            ? "miss"
            : payload.isCrit && payload.isBlocked
                ? "critical-blocked"
                : payload.isCrit
                    ? "critical"
                    : payload.isBlocked
                        ? "blocked"
                        : "hit";
        return {
            eventId: payload.eventId || null,
            kind: "attack",
            actor,
            actorId: payload.attackerId || payload.attacker || source.id,
            actorName: payload.attackerName || source.name,
            targetId: payload.targetId || payload.target || target.id,
            targetName: payload.targetName || target.name,
            ability: payload.skillName || payload.attackLabel || payload.weaponName || (actor === "hero" ? "Ataque principal" : "Ataque básico"),
            outcome,
            amount,
            hit: Boolean(hit),
            critical: Boolean(payload.isCrit),
            blocked: Boolean(payload.isBlocked),
            message: String(payload.message || ""),
            disciplineProc: clone(payload.disciplineProc || null),
            source: "battle-system"
        };
    }

    function normalizeHealing(payload = {}) {
        const hero = identityFor("hero");
        return {
            eventId: payload.eventId || null,
            kind: "healing",
            actor: "hero",
            actorId: hero.id,
            actorName: hero.name,
            targetId: hero.id,
            targetName: hero.name,
            ability: payload.skillName || payload.itemName || payload.name || "Cura",
            outcome: "healed",
            amount: integer(payload.amount ?? payload.healedAmount, 0),
            hit: true,
            critical: false,
            blocked: false,
            message: String(payload.message || ""),
            source: payload.source || "battle-system"
        };
    }

    function normalizeConsumable(payload = {}) {
        const hero = identityFor("hero");
        const effects = payload.effects || {};
        return {
            eventId: payload.eventId || null,
            kind: "consumable",
            actor: "hero",
            actorId: hero.id,
            actorName: hero.name,
            targetId: hero.id,
            targetName: hero.name,
            ability: payload.item?.name || payload.itemName || "Consumível",
            outcome: "used",
            amount: integer(effects.hp || effects.mana || effects.energy, 0),
            effects: clone(effects),
            hit: true,
            critical: false,
            blocked: false,
            message: String(payload.message || ""),
            source: "consumable-system"
        };
    }

    function appendEvent(event = {}) {
        const battle = Aethra.GameState.battle || {};
        const normalized = {
            ...clone(event),
            eventId: event.eventId || `combat_projection_${++runtime.sequence}`,
            battleId: event.battleId || battle.battleId || null,
            round: Math.max(0, integer(event.round ?? battle.round, 0)),
            occurredAt: event.occurredAt || new Date().toISOString()
        };

        if (runtime.timeline.some((entry) => entry.eventId === normalized.eventId)) {
            return null;
        }

        runtime.timeline.unshift(normalized);
        runtime.timeline = runtime.timeline.slice(0, MAX_TIMELINE);
        return normalized;
    }

    function getSnapshot() {
        const battle = Aethra.GameState.battle || {};
        const enemy = activeEnemy();
        return {
            schemaVersion: 1,
            revision: runtime.revision,
            source: "BattleSystem",
            active: Boolean(battle.isFighting && enemy),
            battleId: battle.battleId || null,
            round: Math.max(0, integer(battle.round, 0)),
            phase: String(battle.phase || "waiting"),
            battleSource: battle.source || null,
            startedAt: battle.startedAt || null,
            endedAt: battle.endedAt || null,
            hero: heroProjection(),
            enemy: enemyProjection(enemy),
            lastEnemy: enemyProjection(battle.lastEnemy || null),
            lastResult: clone(battle.lastResult || null),
            lastMessage: String(battle.lastMessage || ""),
            lastMessageColor: battle.lastMessageColor || null,
            timeline: clone(runtime.timeline),
            lastOutcome: clone(runtime.lastOutcome),
            updatedAt: new Date().toISOString()
        };
    }

    function publish(reason, event = null) {
        runtime.revision += 1;
        runtime.lastReason = reason;
        const payload = {
            reason,
            event: clone(event),
            snapshot: getSnapshot()
        };
        Aethra.EventBus.emit("combat:projection-changed", payload);
        return payload.snapshot;
    }

    function reset(reason = "reset") {
        runtime.timeline = [];
        runtime.lastOutcome = null;
        runtime.sequence = 0;
        return publish(reason);
    }

    function bindEvents() {
        Aethra.EventBus.on("battle:started", (payload = {}) => {
            runtime.timeline = [];
            runtime.lastOutcome = null;
            appendEvent({
                eventId: payload.eventId || `${payload.battleId || "battle"}:started`,
                kind: "system",
                actor: "system",
                actorName: "Arena",
                ability: "Encontro iniciado",
                outcome: "started",
                message: payload.message || `Combate iniciado contra ${payload.creature?.name || "uma criatura"}.`,
                battleId: payload.battleId,
                round: 0,
                source: "battle-system"
            });
            publish("battle-started", runtime.timeline[0]);
        });

        Aethra.EventBus.on("battle:round-started", () => publish("round-started"));
        Aethra.EventBus.on("battle:damage-dealt", (payload = {}) => {
            const entry = appendEvent({ ...normalizeAttack(payload, true), battleId: payload.battleId, round: payload.round });
            publish("action-resolved", entry);
        });
        Aethra.EventBus.on("battle:attack-missed", (payload = {}) => {
            const entry = appendEvent({ ...normalizeAttack(payload, false), battleId: payload.battleId, round: payload.round });
            publish("action-resolved", entry);
        });
        Aethra.EventBus.on("HealingReceived", (payload = {}) => {
            if (payload.source === "consumable-system") return;
            const entry = appendEvent({ ...normalizeHealing(payload), battleId: payload.battleId, round: payload.round });
            publish("action-resolved", entry);
        });
        Aethra.EventBus.on("consumable:used", (payload = {}) => {
            const entry = appendEvent({ ...normalizeConsumable(payload), battleId: payload.battleId, round: payload.round });
            publish("action-resolved", entry);
        });
        Aethra.EventBus.on("battle:round-resolved", () => publish("round-resolved"));
        Aethra.EventBus.on("battle:ended", (payload = {}) => {
            runtime.lastOutcome = {
                reason: payload.reason || "ended",
                battleId: payload.battleId || null,
                source: payload.source || null,
                enemy: enemyProjection(payload.creature || null),
                result: clone(payload.result || null),
                round: Math.max(0, integer(Aethra.GameState.battle?.round, 0)),
                endedAt: payload.endedAt || new Date().toISOString()
            };
            publish("battle-ended");
        });

        ["HealthChanged", "ManaChanged", "EnergyChanged", "resourceChanged", "statsChanged"]
            .forEach((eventName) => Aethra.EventBus.on(eventName, () => publish("resources-changed")));
        ["game:reset", "save:loaded", "state:restored"]
            .forEach((eventName) => Aethra.EventBus.on(eventName, () => reset(eventName)));
    }

    Aethra.CombatProjection = {
        init() {
            if (runtime.initialized) return getSnapshot();
            bindEvents();
            runtime.initialized = true;
            publish("initialized");
            return getSnapshot();
        },
        getSnapshot,
        reset,
        getTimeline: () => clone(runtime.timeline),
        isAuthoritative: () => Aethra.BattleSystem?.getSnapshot instanceof Function
    };
})(window.Aethra = window.Aethra || {});
