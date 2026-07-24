// BattleLogger.js - Extracted from BattleSystem.js
(function (Aethra) {
    "use strict";

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function number(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function integer(value, fallback = 0) {
        return Math.floor(number(value, fallback));
    }

    Aethra.BattleLogger = {


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
                const proc = result.disciplineProc?.triggered
                    ? ` ${result.disciplineProc.name}!`
                    : "";

                if (attackLabel) {
                    return `${attackLabel} causou ${integer(result.amount, 0)} de dano no ${targetName}!${proc}${critical}${blocked}`;
                }

                return weaponName === "Ataque desarmado"
                    ? `Seu ataque causou ${integer(result.amount, 0)} de dano no ${targetName}!${proc}${critical}${blocked}`
                    : `Sua ${weaponName} causou ${integer(result.amount, 0)} de dano no ${targetName}!${proc}${critical}${blocked}`;
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

            if (result.disciplineProc?.triggered) {
                logs.push({
                    type: "discipline-proc-analysis",
                    color: "#e9c96f",
                    message:
                        `${String(result.disciplineProc.name || "PROC").toUpperCase()}! ` +
                        `${result.disciplineName || result.disciplineId} NV. ${result.disciplineLevel || 1}` +
                        ` | chance ${(number(result.disciplineProc.chance, 0) * 100).toFixed(0)}%` +
                        ` | dano ${integer(result.amount, 0)}`
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


            if (payload.side === "hero" && payload.disciplineProc?.triggered) {
                const proc = payload.disciplineProc;
                if (number(proc.leechRate, 0) > 0) {
                    const hero = Aethra.GameState.hero || {};
                    const stats = hero.stats || {};
                    const maxHp = Math.max(1, integer(stats.maxHp ?? hero.maxHp, 1));
                    const previousHp = clamp(integer(stats.hp ?? hero.hp, maxHp), 0, maxHp);
                    const healed = Math.min(
                        maxHp - previousHp,
                        Math.max(1, Math.round(integer(payload.amount, 0) * number(proc.leechRate, 0)))
                    );
                    if (healed > 0) {
                        stats.hp = previousHp + healed;
                        hero.hp = stats.hp;
                        proc.healed = healed;
                        Aethra.EventBus.emit("HealingReceived", {
                            amount: healed,
                            skillName: proc.name,
                            source: "discipline-proc",
                            round: Aethra.GameState.battle?.round || 0
                        });
                    }
                }
                if (number(proc.enemyDamageModifier, 1) < 1 && Aethra.GameState.battle) {
                    Aethra.GameState.battle.enemyDamageModifier = Math.min(
                        number(Aethra.GameState.battle.enemyDamageModifier, 1),
                        number(proc.enemyDamageModifier, 1)
                    );
                }
                Aethra.EventBus.emit("discipline:proc", clone(payload));
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
        }
    };
})(window.Aethra);
