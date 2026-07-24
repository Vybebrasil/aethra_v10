// BattleMath.js - Extracted from BattleSystem.js
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

    Aethra.BattleMath = {

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

            const rawEnemyDefense = Math.max(
                0,
                number(
                    defender?.stats?.defense ??
                    defender?.defense,
                    0
                )
            );
            const defenseMultiplier = clamp(number(options.defenseMultiplier, 1), 0, 1);
            const enemyDefense = rawEnemyDefense * defenseMultiplier;

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
                rawEnemyDefense,
                armorPenetration: 1 - defenseMultiplier,
                blockReduction,
                weaponId: profile.weaponId,
                weaponName: profile.weaponName,
                weapon: profile.weapon
            };

            return options.details === true
                ? result
                : result.amount;
        },



        resolveAttack(attacker, defender, side, options = {}) {
            const attackerStats = attacker.stats || {};
            const defenderStats = defender.stats || {};
            const attackWeapon = side === "hero"
                ? (options.weapon || this.getEquippedWeapon())
                : null;
            const disciplineId = side === "hero"
                ? Aethra.DisciplineSystem?.resolveAttackDiscipline?.({
                    ...options,
                    weapon: attackWeapon
                }) || null
                : null;
            const disciplineProfile = disciplineId
                ? Aethra.DisciplineSystem?.getCombatProfile?.(disciplineId)
                : null;

            const precision = number(attackerStats.precision, 0);
            const evasion = number(defenderStats.evasion, 0);
            const normalizedEvasion = evasion <= 1
                ? evasion
                : evasion * 0.005;

            const hitChance = clamp(
                0.85 + precision * 0.01 - normalizedEvasion + number(disciplineProfile?.hitBonus, 0),
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
                const weapon = attackWeapon;

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
                    disciplineId,
                    disciplineName: disciplineProfile?.name || null,
                    disciplineLevel: disciplineProfile?.level || null,
                    disciplineProc: null,
                    monsterAbility: options.monsterAbility ? clone(options.monsterAbility) : null
                };

                result.message = this.formatAttackMessage(result);
                return result;
            }

            const criticalChance = clamp(
                number(attackerStats.critical, 0.05) + number(disciplineProfile?.criticalBonus, 0),
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
            const disciplineProc = side === "hero" && disciplineId
                ? Aethra.DisciplineSystem?.rollCombatProc?.(disciplineId, this.randomSource) || null
                : null;

            if (side === "hero") {
                damageBreakdown = this.calculateDamage(
                    defender,
                    {
                        details: true,
                        isCrit,
                        isBlocked,
                        blockReduction,
                        weapon: attackWeapon,
                        baseDamage: options.baseDamage,
                        defenseMultiplier: 1 - clamp(number(disciplineProfile?.armorPenetration, 0), 0, 0.9)
                    }
                );

                const attackMultiplier = Math.max(
                    0.05,
                    number(options.damageMultiplier, 1) *
                    Math.max(1, number(disciplineProfile?.powerMultiplier, 1)) *
                    Math.max(1, number(disciplineProc?.damageMultiplier, 1))
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
                disciplineId,
                disciplineName: disciplineProfile?.name || null,
                disciplineLevel: disciplineProfile?.level || null,
                disciplinePowerMultiplier: Math.max(1, number(disciplineProfile?.powerMultiplier, 1)),
                disciplineProc: disciplineProc ? clone(disciplineProc) : null,
                monsterAbility: options.monsterAbility ? clone(options.monsterAbility) : null
            };

            result.message = this.formatAttackMessage(result);
            return result;
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
        }
    };
})(window.Aethra);
