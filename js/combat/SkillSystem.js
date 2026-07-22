// SkillSystem.js
// Seção 8: Habilidades, recursos, cooldowns e Action Bars.
// Requer game-core.js carregado antes deste arquivo.

window.Aethra = window.Aethra || {};

(function initSkillSystem(Aethra) {
    "use strict";

    if (!Aethra.GameState || !Aethra.EventBus) {
        throw new Error(
            "SkillSystem.js requer game-core.js carregado antes deste arquivo."
        );
    }

    const DEFAULT_BAR_SIZE = 10;
    const MAX_BAR_SIZE = 16;
    const DEFAULT_BAR_COUNT = 2;
    const PRIMARY_ATTACK_SLOTS = Object.freeze(["left", "right"]);
    const COMBAT_LOADOUT_VERSION = 2;

    function clone(value) {
        if (value === undefined) return undefined;
        return JSON.parse(JSON.stringify(value));
    }

    function safeNumber(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function normalizeCost(cost) {
        if (typeof cost === "number") {
            return {
                resource: "mana",
                amount: Math.max(0, cost)
            };
        }

        if (!cost || typeof cost !== "object") {
            return {
                resource: "mana",
                amount: 0
            };
        }

        return {
            resource: cost.resource || cost.type || "mana",
            amount: Math.max(0, safeNumber(cost.amount ?? cost.value, 0))
        };
    }

    function normalizeCooldown(cooldown) {
        const numeric = Math.max(0, safeNumber(cooldown, 0));

        // Valores pequenos são interpretados como segundos, como no GDD.
        return numeric <= 60 ? numeric * 1000 : numeric;
    }

    function getSkillXPRequired(level) {
        const safeLevel = Math.max(1, Math.floor(safeNumber(level, 1)));
        return Math.max(20, Math.round(36 * (1.24 ** (safeLevel - 1))));
    }

    const DEFAULT_SKILLS = {
        basic_attack: {
            id: "basic_attack",
            name: "Ataque da Mão Principal",
            shortName: "Mão Principal",
            description: "Ataque contínuo da arma principal. Funciona fora da fila de habilidades.",
            icon: "⚔",
            type: "damage",
            category: "primary",
            primarySlot: "left",
            cost: { resource: "energy", amount: 0 },
            cooldown: 1,
            cooldownRounds: 0,
            effect: {
                type: "damage",
                damageMultiplier: 1,
                weaponSlot: "weapon"
            }
        },

        offhand_attack: {
            id: "offhand_attack",
            name: "Ataque da Mão Secundária",
            shortName: "Mão Secundária",
            description: "Ataque alternado da arma secundária. Requer uma arma equipada na mão 2.",
            icon: "🗡",
            type: "damage",
            category: "primary",
            primarySlot: "right",
            cost: { resource: "energy", amount: 0 },
            cooldown: 1.8,
            cooldownRounds: 0,
            effect: {
                type: "damage",
                damageMultiplier: 0.7,
                weaponSlot: "offhand",
                requiresWeapon: true
            }
        },

        heavy_strike: {
            id: "heavy_strike",
            name: "Golpe Pesado",
            description: "Um golpe lento que causa dano físico elevado.",
            icon: "🗡",
            type: "damage",
            disciplineId: "unarmed",
            cost: { resource: "energy", amount: 10 },
            cooldown: 3,
            cooldownRounds: 3,
            effect: {
                type: "damage",
                damageMultiplier: 2.5,
                damageType: "physical"
            }
        },

        precise_strike: {
            id: "precise_strike",
            name: "Corte Preciso",
            description: "Técnica de espada confiável que privilegia acerto e consistência.",
            icon: "⚔",
            type: "damage",
            disciplineId: "sword",
            cost: { resource: "energy", amount: 8 },
            cooldown: 2,
            cooldownRounds: 2,
            effect: { type: "damage", damageMultiplier: 1.45, damageType: "physical" }
        },

        brutal_cleave: {
            id: "brutal_cleave",
            name: "Talho Brutal",
            description: "Ataque de machado impreciso, pesado e com grande teto de dano.",
            icon: "🪓",
            type: "damage",
            disciplineId: "axe",
            cost: { resource: "energy", amount: 12 },
            cooldown: 3,
            cooldownRounds: 3,
            effect: { type: "damage", damageMultiplier: 2.05, damageType: "physical" }
        },

        armor_breaker: {
            id: "armor_breaker",
            name: "Quebra-Armadura",
            description: "Impacto de maça que atravessa parte da Defesa do alvo.",
            icon: "◆",
            type: "damage",
            disciplineId: "mace",
            cost: { resource: "energy", amount: 10 },
            cooldown: 3,
            cooldownRounds: 3,
            effect: { type: "damage", damageMultiplier: 1.7, damageType: "physical" }
        },

        twin_fang: {
            id: "twin_fang",
            name: "Presa Dupla",
            description: "Ataque rápido de adaga com alta chance de abrir um segundo corte.",
            icon: "†",
            type: "damage",
            disciplineId: "dagger",
            cost: { resource: "energy", amount: 7 },
            cooldown: 2,
            cooldownRounds: 2,
            effect: { type: "damage", damageMultiplier: 1.28, damageType: "physical" }
        },

        aimed_shot: {
            id: "aimed_shot",
            name: "Tiro Mirado",
            description: "Disparo paciente que procura um ponto vital do inimigo.",
            icon: "➶",
            type: "damage",
            disciplineId: "bow",
            cost: { resource: "energy", amount: 9 },
            cooldown: 2,
            cooldownRounds: 2,
            effect: { type: "damage", damageMultiplier: 1.55, damageType: "physical" }
        },

        heal: {
            id: "heal",
            name: "Cura",
            description: "Restaura parte da vida do herói.",
            icon: "✚",
            type: "heal",
            disciplineId: "restoration",
            hpThreshold: 50,
            cost: { resource: "mana", amount: 15 },
            cooldown: 5,
            cooldownRounds: 3,
            effect: {
                type: "heal",
                baseAmount: 18,
                magicScaling: 1.2,
                target: "self"
            }
        },

        guard: {
            id: "guard",
            name: "Postura de Guarda",
            description: "Aumenta temporariamente a defesa e o bloqueio.",
            icon: "🛡",
            type: "buff",
            disciplineId: "shield",
            cost: { resource: "energy", amount: 8 },
            cooldown: 6,
            cooldownRounds: 3,
            effect: {
                type: "buff",
                stat: "defense",
                amount: 8,
                duration: 4000,
                blockChance: 0.15
            }
        },

        fire_bolt: {
            id: "fire_bolt",
            name: "Projétil de Fogo",
            description: "Ataque mágico com chance de causar queimadura.",
            icon: "🔥",
            type: "damage",
            disciplineId: "fire",
            cost: { resource: "mana", amount: 12 },
            cooldown: 2.5,
            cooldownRounds: 2,
            effect: {
                type: "damage",
                damageMultiplier: 1.8,
                damageType: "magic",
                magicScaling: 0.7,
                status: {
                    id: "burn",
                    chance: 0.25,
                    duration: 3000
                }
            }
        },

        ice_shard: {
            id: "ice_shard",
            name: "Estilhaço de Gelo",
            description: "Projétil estável que pode congelar e enfraquecer a próxima ação inimiga.",
            icon: "❄",
            type: "damage",
            disciplineId: "ice",
            cost: { resource: "mana", amount: 10 },
            cooldown: 2,
            cooldownRounds: 2,
            effect: { type: "damage", damageMultiplier: 1.55, damageType: "magic", magicScaling: 0.72 }
        },

        shadow_bolt: {
            id: "shadow_bolt",
            name: "Seta Sombria",
            description: "Magia arriscada que pode drenar a vitalidade do alvo.",
            icon: "☾",
            type: "damage",
            disciplineId: "shadow",
            cost: { resource: "mana", amount: 11 },
            cooldown: 2,
            cooldownRounds: 2,
            effect: { type: "damage", damageMultiplier: 1.7, damageType: "magic", magicScaling: 0.78 }
        }
    };

    Aethra.SkillSystem = {
        initialized: false,
        maxBarSize: MAX_BAR_SIZE,
        skills: clone(DEFAULT_SKILLS),

        init() {
            if (this.initialized) return;

            this.ensureState();
            this.cleanupCooldowns();
            this.bindProgressionEvents();

            Aethra.EventBus.on("BattleStarted", () => {
                this.resetPrimaryAttackCooldowns();
                this.resetRoundCooldowns();
            });

            Aethra.EventBus.on("game:reset", () => {
                this.ensureState(true);
                this.emitActionBarChanged("game-reset");
            });

            Aethra.EventBus.on("save:loaded", () => {
                this.ensureState();
                this.cleanupCooldowns();
                this.emitActionBarChanged("save-loaded");
            });

            Aethra.EventBus.on("state:restored", () => {
                this.ensureState();
                this.cleanupCooldowns();
                this.emitActionBarChanged("state-restored");
            });

            this.initialized = true;

            Aethra.EventBus.emit("skills:ready", {
                skills: this.getSkills(),
                actionBars: this.getActionBars(),
                activeBarIndex: Aethra.GameState.hero.activeActionBar
            });
        },

        ensureState(forceReset = false) {
            const hero = Aethra.GameState.hero || (Aethra.GameState.hero = {});
            hero.stats = hero.stats || {};

            hero.stats.maxMana = Math.max(
                0,
                safeNumber(hero.stats.maxMana, 60)
            );
            hero.stats.mana = clamp(
                safeNumber(hero.stats.mana, hero.stats.maxMana),
                0,
                hero.stats.maxMana
            );

            hero.stats.maxEnergy = Math.max(
                0,
                safeNumber(hero.stats.maxEnergy, 100)
            );
            hero.stats.energy = clamp(
                safeNumber(hero.stats.energy, hero.stats.maxEnergy),
                0,
                hero.stats.maxEnergy
            );

            if (forceReset || !hero.cooldowns || typeof hero.cooldowns !== "object") {
                hero.cooldowns = {};
            }

            if (forceReset || !hero.roundCooldowns || typeof hero.roundCooldowns !== "object") {
                hero.roundCooldowns = {};
            }

            if (forceReset || !Array.isArray(hero.actionBars)) {
                hero.actionBars = this.createDefaultActionBars();
                hero.combatLoadoutVersion = COMBAT_LOADOUT_VERSION;
            }

            if (hero.actionBars.length === 0) {
                hero.actionBars = this.createDefaultActionBars();
                hero.combatLoadoutVersion = COMBAT_LOADOUT_VERSION;
            }

            this.ensurePrimaryAttacks(forceReset);
            this.migrateActionBarsToPrimaryLayer(hero);

            hero.actionBars = hero.actionBars.map((bar, index) =>
                this.normalizeBar(bar, index)
            );

            hero.activeActionBar = clamp(
                Math.floor(safeNumber(hero.activeActionBar, 0)),
                0,
                Math.max(0, hero.actionBars.length - 1)
            );

            this.ensureSkillProgression(forceReset);
            return hero;
        },

        bindProgressionEvents() {
            if (this._progressionEventsBound) return;
            this._progressionEventsBound = true;

            Aethra.EventBus.on("skill:used", (payload = {}) => {
                const reward = this.getSkillXPReward(payload.skillId, payload);
                if (reward <= 0) return;

                this.addSkillXP(payload.skillId, reward, {
                    source: payload.source || "skill-use",
                    payload,
                    save: false
                });
            });

            // O BattleSystem pode executar o ataque padrão diretamente quando
            // nenhuma skill automática assume o tick. Esse fallback também
            // alimenta a maestria sem duplicar usos disparados pelo SkillSystem.
            Aethra.EventBus.on("primary-attack:used", (payload = {}) => {
                const skillId = payload.skillId || (
                    payload.slot === "right" ? "offhand_attack" : "basic_attack"
                );
                if (!this.skills[skillId]) return;

                this.addSkillXP(skillId, payload.slot === "right" ? 2 : 2, {
                    source: payload.source || "primary-attack",
                    payload,
                    save: false
                });
            });

            Aethra.EventBus.on("HeroActionExecuted", (payload = {}) => {
                if (payload.skillId) return;
                const normalized = String(payload.name || "").toLowerCase();
                if (!normalized.includes("ataque básico") && !normalized.includes("mão principal")) return;

                this.addSkillXP("basic_attack", 2, {
                    source: payload.source || "battle-basic-attack",
                    payload,
                    save: false
                });
            });
        },

        ensureSkillProgression(forceReset = false) {
            const hero = Aethra.GameState.hero || (Aethra.GameState.hero = {});

            if (
                forceReset ||
                !hero.skillProgression ||
                typeof hero.skillProgression !== "object" ||
                Array.isArray(hero.skillProgression)
            ) {
                hero.skillProgression = {};
            }

            Object.keys(this.skills).forEach((skillId) => {
                const source = hero.skillProgression[skillId] || {};
                const level = clamp(
                    Math.floor(safeNumber(source.level, 1)),
                    1,
                    50
                );
                const xpNext = getSkillXPRequired(level);

                hero.skillProgression[skillId] = {
                    level,
                    xpCurrent: clamp(
                        Math.floor(safeNumber(source.xpCurrent, 0)),
                        0,
                        Math.max(0, xpNext - 1)
                    ),
                    xpTotal: Math.max(0, Math.floor(safeNumber(source.xpTotal, 0))),
                    xpNext,
                    uses: Math.max(0, Math.floor(safeNumber(source.uses, 0))),
                    lastUsedAt: source.lastUsedAt || null,
                    lastGain: Math.max(0, Math.floor(safeNumber(source.lastGain, 0)))
                };
            });

            return hero.skillProgression;
        },

        getSkillXPRequired(level) {
            return getSkillXPRequired(level);
        },

        getSkillXPReward(skillId, payload = {}) {
            const skill = this.skills[skillId];
            if (!skill) return 0;

            const cost = normalizeCost(skill.cost);
            const cooldownSeconds = Math.max(
                normalizeCooldown(skill.cooldown) / 1000,
                safeNumber(skill.cooldownRounds, 0)
            );
            let reward = skillId === "basic_attack" ? 2 : 3;

            reward += Math.min(4, Math.floor(cost.amount / 5));
            reward += Math.min(3, Math.round(cooldownSeconds / 2));

            if (skill.type === "heal" || skill.effect?.type === "heal") reward += 1;
            if (skill.type === "buff" || skill.effect?.type === "buff") reward += 1;
            if (payload.source === "manual" || payload.source === "action-bar") reward += 1;

            return clamp(Math.floor(reward), 1, 12);
        },

        getSkillProgression(skillId) {
            this.ensureState();
            const entry = Aethra.GameState.hero.skillProgression?.[skillId];
            if (!entry) return null;

            const progressPercent = entry.xpNext > 0
                ? clamp((entry.xpCurrent / entry.xpNext) * 100, 0, 100)
                : 100;

            return {
                ...clone(entry),
                progressPercent: Number(progressPercent.toFixed(2)),
                powerMultiplier: this.getSkillPowerMultiplier(skillId)
            };
        },

        getSkillProgressionSnapshot() {
            this.ensureState();
            return Object.fromEntries(
                Object.keys(this.skills).map((skillId) => [
                    skillId,
                    this.getSkillProgression(skillId)
                ])
            );
        },

        getSkillPowerMultiplier(skillId) {
            const entry = Aethra.GameState.hero?.skillProgression?.[skillId];
            const level = clamp(
                Math.floor(safeNumber(entry?.level, 1)),
                1,
                50
            );
            return Number((1 + (level - 1) * 0.025).toFixed(4));
        },

        addSkillXP(skillId, amount, options = {}) {
            if (!this.skills[skillId]) return null;
            this.ensureState();

            const entry = Aethra.GameState.hero.skillProgression[skillId];
            const huntMultiplier = Math.max(0, Number(Aethra.HuntSystem?.getCombatSkillXPMultiplier?.() ?? 1));
            const localMultiplier = Math.max(0, Number(options.multiplier ?? 1));
            const gain = Math.max(0, Math.floor(safeNumber(amount, 0) * huntMultiplier * localMultiplier));
            if (gain <= 0) return this.getSkillProgression(skillId);

            const previousLevel = entry.level;
            entry.xpCurrent += gain;
            entry.xpTotal += gain;
            entry.uses += 1;
            entry.lastGain = gain;
            entry.lastUsedAt = Date.now();

            let levelsGained = 0;
            while (entry.level < 50 && entry.xpCurrent >= entry.xpNext) {
                entry.xpCurrent -= entry.xpNext;
                entry.level += 1;
                entry.xpNext = getSkillXPRequired(entry.level);
                levelsGained += 1;
            }

            if (entry.level >= 50) {
                entry.level = 50;
                entry.xpCurrent = Math.min(entry.xpCurrent, entry.xpNext);
            }

            const progression = this.getSkillProgression(skillId);
            const payload = {
                skillId,
                skill: clone(this.skills[skillId]),
                gain,
                baseGain: Math.max(0, Math.floor(safeNumber(amount, 0))),
                multiplier: huntMultiplier * localMultiplier,
                previousLevel,
                levelsGained,
                progression,
                source: options.source || "skill-use",
                timestamp: Date.now()
            };

            Aethra.EventBus.emit("skillXPChanged", clone(payload));
            Aethra.EventBus.emit("skill:xp-changed", clone(payload));
            Aethra.EventBus.emit("skill:progression-changed", clone(payload));

            if (levelsGained > 0) {
                Aethra.EventBus.emit("skillLevelUp", clone(payload));
                Aethra.EventBus.emit("skill:level-up", clone(payload));
            }

            if (options.save !== false) this.save();
            return progression;
        },

        isPrimarySkill(skillOrId) {
            const skill = typeof skillOrId === "string"
                ? this.skills[skillOrId]
                : skillOrId;
            return Boolean(
                skill && (
                    skill.category === "primary" ||
                    PRIMARY_ATTACK_SLOTS.includes(skill.primarySlot)
                )
            );
        },

        ensurePrimaryAttacks(forceReset = false) {
            const hero = Aethra.GameState.hero || (Aethra.GameState.hero = {});
            const defaults = {
                left: {
                    skillId: "basic_attack",
                    auto: true,
                    intervalMs: normalizeCooldown(this.skills.basic_attack?.cooldown || 1),
                    nextReadyAt: 0,
                    lastUsedAt: null
                },
                right: {
                    skillId: "offhand_attack",
                    auto: false,
                    intervalMs: normalizeCooldown(this.skills.offhand_attack?.cooldown || 1.8),
                    nextReadyAt: 0,
                    lastUsedAt: null
                }
            };

            if (
                forceReset ||
                !hero.primaryAttacks ||
                typeof hero.primaryAttacks !== "object" ||
                Array.isArray(hero.primaryAttacks)
            ) {
                hero.primaryAttacks = clone(defaults);
            }

            PRIMARY_ATTACK_SLOTS.forEach((slot) => {
                const source = hero.primaryAttacks[slot] || {};
                const fallback = defaults[slot];
                const skillId = this.isPrimarySkill(source.skillId)
                    ? source.skillId
                    : fallback.skillId;
                const skill = this.skills[skillId] || this.skills[fallback.skillId];

                hero.primaryAttacks[slot] = {
                    skillId,
                    auto: source.auto !== undefined
                        ? Boolean(source.auto)
                        : fallback.auto,
                    intervalMs: Math.max(
                        250,
                        safeNumber(
                            source.intervalMs,
                            normalizeCooldown(skill?.cooldown || 1)
                        )
                    ),
                    nextReadyAt: Math.max(0, safeNumber(source.nextReadyAt, 0)),
                    lastUsedAt: source.lastUsedAt || null
                };
            });

            return hero.primaryAttacks;
        },

        migrateActionBarsToPrimaryLayer(hero = Aethra.GameState.hero) {
            if (!hero || safeNumber(hero.combatLoadoutVersion, 0) >= COMBAT_LOADOUT_VERSION) {
                return false;
            }

            const bars = Array.isArray(hero.actionBars) ? hero.actionBars : [];
            bars.forEach((bar) => {
                if (!Array.isArray(bar?.slots)) return;
                const skills = bar.slots.filter((skillId) => (
                    skillId && this.skills[skillId] && !this.isPrimarySkill(skillId)
                ));
                bar.slots = [
                    ...skills,
                    ...Array(Math.max(0, bar.slots.length - skills.length)).fill(null)
                ];
            });

            hero.combatLoadoutVersion = COMBAT_LOADOUT_VERSION;
            return true;
        },

        getPrimaryAttacks() {
            this.ensureState();
            const hero = Aethra.GameState.hero;
            return Object.fromEntries(
                PRIMARY_ATTACK_SLOTS.map((slot) => {
                    const state = hero.primaryAttacks[slot];
                    return [slot, {
                        ...clone(state),
                        slot,
                        skill: this.getSkill(state.skillId)
                    }];
                })
            );
        },

        getPrimaryAttack(slot = "left") {
            const attacks = this.getPrimaryAttacks();
            return attacks[slot] || null;
        },

        setPrimaryAuto(slot, enabled) {
            this.ensureState();
            if (!PRIMARY_ATTACK_SLOTS.includes(slot)) return false;

            const attack = Aethra.GameState.hero.primaryAttacks[slot];
            if (!attack) return false;

            attack.auto = Boolean(enabled);
            Aethra.EventBus.emit("primary-attack:settings-changed", {
                slot,
                auto: attack.auto,
                primaryAttacks: this.getPrimaryAttacks()
            });
            this.save();
            return attack.auto;
        },

        markPrimaryAttackUsed(slot, usedAt = Date.now()) {
            this.ensureState();
            if (!PRIMARY_ATTACK_SLOTS.includes(slot)) return false;
            const attack = Aethra.GameState.hero.primaryAttacks[slot];
            if (!attack) return false;

            attack.lastUsedAt = usedAt;
            attack.nextReadyAt = usedAt + Math.max(250, safeNumber(attack.intervalMs, 1000));
            return clone(attack);
        },

        resetPrimaryAttackCooldowns() {
            this.ensureState();
            PRIMARY_ATTACK_SLOTS.forEach((slot) => {
                const attack = Aethra.GameState.hero.primaryAttacks[slot];
                if (!attack) return;
                attack.nextReadyAt = 0;
                attack.lastUsedAt = null;
            });
            Aethra.EventBus.emit("primary-attack:cooldowns-reset", {
                primaryAttacks: this.getPrimaryAttacks()
            });
            return true;
        },

        createDefaultActionBars() {
            const bars = [];

            for (let index = 0; index < DEFAULT_BAR_COUNT; index += 1) {
                bars.push({
                    id: `bar_${index + 1}`,
                    name: `Barra ${index + 1}`,
                    slots: Array(DEFAULT_BAR_SIZE).fill(null)
                });
            }

            bars[0].slots[0] = "heavy_strike";
            bars[0].slots[1] = "heal";
            bars[0].slots[2] = "guard";
            bars[0].slots[3] = "fire_bolt";

            return bars;
        },

        normalizeBar(bar, index) {
            const source = bar && typeof bar === "object" ? bar : {};
            const rawSlots = Array.isArray(source.slots) ? source.slots : [];
            const size = clamp(
                Math.max(DEFAULT_BAR_SIZE, rawSlots.length),
                DEFAULT_BAR_SIZE,
                MAX_BAR_SIZE
            );

            const slots = Array(size).fill(null);
            rawSlots.slice(0, size).forEach((skillId, slotIndex) => {
                slots[slotIndex] = this.skills[skillId] ? skillId : null;
            });

            return {
                id: source.id || `bar_${index + 1}`,
                name: source.name || `Barra ${index + 1}`,
                slots
            };
        },

        registerSkill(skillId, definition) {
            if (typeof skillId !== "string" || !skillId.trim()) {
                throw new TypeError("SkillSystem.registerSkill: skillId inválido.");
            }

            if (!definition || typeof definition !== "object") {
                throw new TypeError(
                    "SkillSystem.registerSkill: definition deve ser um objeto."
                );
            }

            const normalized = {
                ...clone(definition),
                id: skillId,
                name: definition.name || skillId,
                description: definition.description || "",
                type: definition.type || definition.effect?.type || "utility",
                hpThreshold:
                    String(
                        definition.type ||
                        definition.effect?.type ||
                        ""
                    ).toLowerCase() === "heal"
                        ? clamp(
                            Math.round(
                                safeNumber(
                                    definition.hpThreshold ??
                                    definition.effect?.hpThreshold,
                                    50
                                )
                            ),
                            5,
                            95
                        )
                        : null,
                cost: normalizeCost(definition.cost),
                cooldown: Math.max(0, safeNumber(definition.cooldown, 0)),
                effect: clone(definition.effect || {})
            };

            this.skills[skillId] = normalized;

            Aethra.EventBus.emit("skill:registered", {
                skillId,
                skill: clone(normalized)
            });

            return clone(normalized);
        },

        getSkill(skillId) {
            if (!this.skills[skillId]) return null;

            const skill = clone(this.skills[skillId]);
            skill.progression = this.getSkillProgression(skillId);
            skill.masteryMultiplier = this.getSkillPowerMultiplier(skillId);
            return skill;
        },

        getSkills() {
            return Object.fromEntries(
                Object.keys(this.skills).map((skillId) => [
                    skillId,
                    this.getSkill(skillId)
                ])
            );
        },

        getActionBars() {
            this.ensureState();
            return clone(Aethra.GameState.hero.actionBars);
        },

        getActiveBar() {
            this.ensureState();
            const hero = Aethra.GameState.hero;
            return clone(hero.actionBars[hero.activeActionBar]);
        },

        setActiveBar(index) {
            this.ensureState();
            const hero = Aethra.GameState.hero;
            const nextIndex = Math.floor(safeNumber(index, -1));

            if (nextIndex < 0 || nextIndex >= hero.actionBars.length) {
                return false;
            }

            const previousIndex = hero.activeActionBar;
            hero.activeActionBar = nextIndex;

            Aethra.EventBus.emit("actionBarChanged", {
                reason: "active-bar",
                previousIndex,
                activeBarIndex: nextIndex,
                bar: clone(hero.actionBars[nextIndex]),
                actionBars: this.getActionBars()
            });

            this.save();
            return true;
        },

        assignSkill(slotIndex, skillId, barIndex = null) {
            this.ensureState();
            const hero = Aethra.GameState.hero;
            const resolvedBarIndex = barIndex === null
                ? hero.activeActionBar
                : Math.floor(safeNumber(barIndex, -1));

            const bar = hero.actionBars[resolvedBarIndex];
            if (!bar) return false;

            const resolvedSlot = Math.floor(safeNumber(slotIndex, -1));
            if (resolvedSlot < 0 || resolvedSlot >= bar.slots.length) return false;

            if (skillId !== null && !this.skills[skillId]) {
                Aethra.EventBus.emit("skill:assignment-failed", {
                    reason: "unknown-skill",
                    skillId,
                    slotIndex: resolvedSlot,
                    barIndex: resolvedBarIndex
                });
                return false;
            }

            if (skillId !== null && this.isPrimarySkill(skillId)) {
                Aethra.EventBus.emit("skill:assignment-failed", {
                    reason: "primary-skill-reserved",
                    skillId,
                    slotIndex: resolvedSlot,
                    barIndex: resolvedBarIndex
                });
                return false;
            }

            const previousSkillId = bar.slots[resolvedSlot];
            bar.slots[resolvedSlot] = skillId;

            this.emitActionBarChanged("assign", {
                barIndex: resolvedBarIndex,
                slotIndex: resolvedSlot,
                skillId,
                previousSkillId
            });

            this.save();
            return true;
        },

        removeSkill(slotIndex, barIndex = null) {
            return this.assignSkill(slotIndex, null, barIndex);
        },

        moveSkill(fromSlot, toSlot, barIndex = null) {
            this.ensureState();
            const hero = Aethra.GameState.hero;
            const resolvedBarIndex = barIndex === null
                ? hero.activeActionBar
                : Math.floor(safeNumber(barIndex, -1));

            const bar = hero.actionBars[resolvedBarIndex];
            if (!bar) return false;

            const from = Math.floor(safeNumber(fromSlot, -1));
            const to = Math.floor(safeNumber(toSlot, -1));

            if (
                from < 0 ||
                to < 0 ||
                from >= bar.slots.length ||
                to >= bar.slots.length ||
                from === to
            ) {
                return false;
            }

            const movedSkill = bar.slots[from];
            bar.slots[from] = bar.slots[to];
            bar.slots[to] = movedSkill;

            this.emitActionBarChanged("move", {
                barIndex: resolvedBarIndex,
                fromSlot: from,
                toSlot: to
            });

            this.save();
            return true;
        },

        addBar(name = null, size = DEFAULT_BAR_SIZE) {
            this.ensureState();
            const hero = Aethra.GameState.hero;

            if (hero.actionBars.length >= 4) {
                Aethra.EventBus.emit("actionBarCreateFailed", {
                    reason: "maximum-bars",
                    maximum: 4
                });
                return null;
            }

            const barIndex = hero.actionBars.length;
            const bar = {
                id: `bar_${Date.now().toString(36)}_${barIndex + 1}`,
                name: name || `Barra ${barIndex + 1}`,
                slots: Array(
                    clamp(
                        Math.floor(safeNumber(size, DEFAULT_BAR_SIZE)),
                        DEFAULT_BAR_SIZE,
                        MAX_BAR_SIZE
                    )
                ).fill(null)
            };

            hero.actionBars.push(bar);
            this.emitActionBarChanged("bar-added", { barIndex });
            this.save();
            return clone(bar);
        },

        resizeBar(size, barIndex = null) {
            this.ensureState();
            const hero = Aethra.GameState.hero;
            const resolvedBarIndex = barIndex === null
                ? hero.activeActionBar
                : Math.floor(safeNumber(barIndex, -1));
            const bar = hero.actionBars[resolvedBarIndex];

            if (!bar) return false;

            const newSize = clamp(
                Math.floor(safeNumber(size, bar.slots.length)),
                DEFAULT_BAR_SIZE,
                MAX_BAR_SIZE
            );

            if (newSize > bar.slots.length) {
                while (bar.slots.length < newSize) bar.slots.push(null);
            } else if (newSize < bar.slots.length) {
                const removed = bar.slots.slice(newSize).filter(Boolean);
                if (removed.length > 0) {
                    Aethra.EventBus.emit("actionBarResizeFailed", {
                        reason: "occupied-slots",
                        removedSkillIds: clone(removed),
                        barIndex: resolvedBarIndex
                    });
                    return false;
                }
                bar.slots.length = newSize;
            }

            this.emitActionBarChanged("resize", {
                barIndex: resolvedBarIndex,
                size: newSize
            });
            this.save();
            return true;
        },

        getResource(resourceName) {
            this.ensureState();
            const stats = Aethra.GameState.hero.stats;
            return Math.max(0, safeNumber(stats[resourceName], 0));
        },

        setResource(resourceName, value, reason = "skill-system") {
            this.ensureState();
            const hero = Aethra.GameState.hero;
            const stats = hero.stats;
            const maximumKey = `max${resourceName.charAt(0).toUpperCase()}${resourceName.slice(1)}`;
            const maximum = Math.max(0, safeNumber(stats[maximumKey], Infinity));
            const previous = Math.max(0, safeNumber(stats[resourceName], 0));
            const next = clamp(safeNumber(value, previous), 0, maximum);

            stats[resourceName] = next;
            hero[resourceName] = next;
            if (Number.isFinite(maximum)) hero[maximumKey] = maximum;

            Aethra.EventBus.emit("resourceChanged", {
                resource: resourceName,
                previous,
                value: next,
                maximum: Number.isFinite(maximum) ? maximum : null,
                delta: next - previous,
                reason
            });

            Aethra.EventBus.emit(`${resourceName}Changed`, {
                previous,
                value: next,
                maximum: Number.isFinite(maximum) ? maximum : null,
                delta: next - previous,
                reason
            });

            return next;
        },

        getCooldownRemaining(skillId, now = Date.now()) {
            this.ensureState();
            if (Aethra.GameState.battle?.isFighting) {
                const rounds = this.getCooldownRoundsRemaining(skillId);
                return rounds * Math.max(100, safeNumber(Aethra.BattleSystem?.config?.roundMs, 1800));
            }
            const readyAt = safeNumber(
                Aethra.GameState.hero.cooldowns[skillId],
                0
            );
            return Math.max(0, readyAt - now);
        },

        isOnCooldown(skillId) {
            if (Aethra.GameState.battle?.isFighting) {
                return this.getCooldownRoundsRemaining(skillId) > 0;
            }
            return this.getCooldownRemaining(skillId) > 0;
        },

        getCooldownRounds(skillOrId) {
            const skill = typeof skillOrId === "string"
                ? this.skills[skillOrId]
                : skillOrId;
            if (!skill) return 0;
            return Math.max(0, Math.floor(safeNumber(
                skill.cooldownRounds,
                Math.ceil(normalizeCooldown(skill.cooldown) / 1800)
            )));
        },

        getCooldownRoundsRemaining(skillId, round = Aethra.GameState.battle?.round || 0) {
            this.ensureState();
            const readyRound = Math.max(0, Math.floor(safeNumber(
                Aethra.GameState.hero.roundCooldowns?.[skillId],
                0
            )));
            if (readyRound <= round) return 0;
            return Math.max(0, readyRound - Math.max(0, Math.floor(safeNumber(round, 0))));
        },

        resetRoundCooldowns() {
            this.ensureState();
            Aethra.GameState.hero.roundCooldowns = {};
            Aethra.EventBus.emit("skill:round-cooldowns-reset", {
                battleId: Aethra.GameState.battle?.battleId || null
            });
            return true;
        },

        cleanupCooldowns(now = Date.now()) {
            this.ensureState();
            const cooldowns = Aethra.GameState.hero.cooldowns;

            Object.keys(cooldowns).forEach((skillId) => {
                if (safeNumber(cooldowns[skillId], 0) <= now) {
                    delete cooldowns[skillId];
                }
            });

            const currentRound = Math.max(0, Math.floor(safeNumber(Aethra.GameState.battle?.round, 0)));
            const roundCooldowns = Aethra.GameState.hero.roundCooldowns || {};
            Object.keys(roundCooldowns).forEach((skillId) => {
                if (safeNumber(roundCooldowns[skillId], 0) <= currentRound) {
                    delete roundCooldowns[skillId];
                }
            });
        },

        getSkillRequirement(skillOrId) {
            const skill = typeof skillOrId === "string" ? this.skills[skillOrId] : skillOrId;
            if (!skill || !skill.disciplineId) return { usable: true, reason: null };

            const discipline = skill.disciplineId;
            if (["unarmed", "survival", "restoration"].includes(discipline)) {
                return { usable: true, reason: null };
            }

            const equippedWeapon = Aethra.BattleSystem?.getHeroCombatant?.()?.weapon
                || Aethra.EquipSystem?.getEquippedItem?.("weapon")
                || {};

            const templateId = equippedWeapon.templateId || equippedWeapon.id || "";
            const template = Aethra.GameData?.items?.[templateId] || {};
            const weaponType = (equippedWeapon.weaponType || template.weaponType || template.category || "").toLowerCase();
            const weaponName = (equippedWeapon.name || template.name || "").toLowerCase();

            const requirements = {
                sword: { check: (t, n) => t.includes("sword") || n.includes("espada") || n.includes("lâmina"), label: "Espada" },
                axe: { check: (t, n) => t.includes("axe") || n.includes("machado") || n.includes("cutelo"), label: "Machado" },
                mace: { check: (t, n) => t.includes("mace") || n.includes("maça") || n.includes("martelo") || n.includes("clava"), label: "Maça / Clava" },
                dagger: { check: (t, n) => t.includes("dagger") || n.includes("adaga") || n.includes("faca"), label: "Adaga" },
                bow: { check: (t, n) => t.includes("bow") || n.includes("arco") || n.includes("besta"), label: "Arco" },
                fire: { check: (t, n) => t.includes("focus") || t.includes("staff") || n.includes("foco") || n.includes("cajado") || n.includes("varinha"), label: "Foco Mágico / Cajado" },
                ice: { check: (t, n) => t.includes("focus") || t.includes("staff") || n.includes("foco") || n.includes("cajado") || n.includes("varinha"), label: "Foco Mágico / Cajado" },
                shadow: { check: (t, n) => t.includes("focus") || t.includes("staff") || n.includes("foco") || n.includes("cajado") || n.includes("varinha"), label: "Foco Mágico / Cajado" }
            };

            const req = requirements[discipline];
            if (!req) return { usable: true, reason: null };

            const isValid = req.check(weaponType, weaponName);
            if (!isValid) {
                return { usable: false, reason: `Requer ${req.label} equipada` };
            }

            return { usable: true, reason: null };
        },

        canUseSkill(skillId, target = null) {
            this.ensureState();
            this.cleanupCooldowns();

            const skill = this.skills[skillId];
            if (!skill) {
                return {
                    ok: false,
                    reason: "unknown-skill",
                    skillId
                };
            }

            const req = this.getSkillRequirement(skill);
            if (!req.usable) {
                return {
                    ok: false,
                    reason: "weapon-requirement",
                    skillId,
                    requirementReason: req.reason
                };
            }

            const cost = normalizeCost(skill.cost);
            const currentResource = this.getResource(cost.resource);
            const roundCombat = Boolean(Aethra.GameState.battle?.isFighting);
            const cooldownRoundsRemaining = roundCombat
                ? this.getCooldownRoundsRemaining(skillId)
                : 0;
            const cooldownRemaining = roundCombat
                ? cooldownRoundsRemaining * Math.max(100, safeNumber(Aethra.BattleSystem?.config?.roundMs, 1800))
                : this.getCooldownRemaining(skillId);

            if (cooldownRemaining > 0) {
                return {
                    ok: false,
                    reason: "cooldown",
                    skillId,
                    cooldownRemaining,
                    cooldownRoundsRemaining
                };
            }

            if (currentResource < cost.amount) {
                return {
                    ok: false,
                    reason: "insufficient-resource",
                    skillId,
                    resource: cost.resource,
                    current: currentResource,
                    required: cost.amount
                };
            }

            if (
                skill.effect?.target === "enemy" &&
                !target &&
                !Aethra.GameState.combat?.enemy
            ) {
                return {
                    ok: false,
                    reason: "missing-target",
                    skillId
                };
            }

            return {
                ok: true,
                skillId,
                skill: clone(skill),
                cost,
                target: target || Aethra.GameState.combat?.enemy || null
            };
        },

        useSkill(skillId, target = null, options = {}) {
            const validation = this.canUseSkill(skillId, target);

            if (!validation.ok) {
                const failure = {
                    ...validation,
                    requestedAt: Date.now(),
                    source: options.source || "manual"
                };

                Aethra.EventBus.emit("SkillUseFailed", failure);
                Aethra.EventBus.emit("skill:use-failed", failure);
                return false;
            }

            const skill = this.skills[skillId];
            const cost = validation.cost;
            const usedAt = Date.now();
            const cooldownMs = normalizeCooldown(skill.cooldown);
            const readyAt = usedAt + cooldownMs;
            const roundCombat = Boolean(Aethra.GameState.battle?.isFighting);
            const cooldownRounds = this.getCooldownRounds(skill);
            const currentRound = Math.max(0, Math.floor(safeNumber(Aethra.GameState.battle?.round, 0)));
            const readyRound = roundCombat && cooldownRounds > 0
                ? currentRound + cooldownRounds
                : 0;

            if (cost.amount > 0) {
                this.setResource(
                    cost.resource,
                    this.getResource(cost.resource) - cost.amount,
                    `skill:${skillId}`
                );
            }

            if (roundCombat && cooldownRounds > 0) {
                Aethra.GameState.hero.roundCooldowns[skillId] = readyRound;

                Aethra.EventBus.emit("skill:round-cooldown-started", {
                    skillId,
                    cooldownRounds,
                    readyRound,
                    currentRound
                });
            } else if (cooldownMs > 0) {
                Aethra.GameState.hero.cooldowns[skillId] = readyAt;

                Aethra.EventBus.emit("skill:cooldown-started", {
                    skillId,
                    cooldownMs,
                    readyAt
                });
            }

            const resolvedTarget = target || validation.target || null;
            const payload = {
                skillId,
                skill: clone(skill),
                effect: clone(skill.effect || {}),
                casterId: Aethra.GameState.hero.id || "hero",
                target: clone(resolvedTarget),
                cost: clone(cost),
                cooldownMs,
                readyAt,
                cooldownRounds,
                readyRound,
                usedAt,
                source: options.source || "manual",
                actionBarIndex: Number.isInteger(options.actionBarIndex)
                    ? options.actionBarIndex
                    : Aethra.GameState.hero.activeActionBar,
                slotIndex: Number.isInteger(options.slotIndex)
                    ? options.slotIndex
                    : null
            };

            // O CombatSystem ou outro sistema escuta este evento e aplica o efeito.
            Aethra.EventBus.emit("SkillUsed", payload);
            Aethra.EventBus.emit("skill:used", payload);

            this.save();
            return clone(payload);
        },

        useSlot(slotIndex, target = null, barIndex = null) {
            this.ensureState();
            const hero = Aethra.GameState.hero;
            const resolvedBarIndex = barIndex === null
                ? hero.activeActionBar
                : Math.floor(safeNumber(barIndex, -1));
            const bar = hero.actionBars[resolvedBarIndex];

            if (!bar) return false;

            const resolvedSlot = Math.floor(safeNumber(slotIndex, -1));
            if (resolvedSlot < 0 || resolvedSlot >= bar.slots.length) {
                return false;
            }

            const skillId = bar.slots[resolvedSlot];
            if (!skillId) {
                const payload = {
                    barIndex: resolvedBarIndex,
                    slotIndex: resolvedSlot
                };
                Aethra.EventBus.emit("actionBarSlotEmpty", payload);
                return false;
            }

            return this.useSkill(skillId, target, {
                source: "action-bar",
                actionBarIndex: resolvedBarIndex,
                slotIndex: resolvedSlot
            });
        },

        emitActionBarChanged(reason, extra = {}) {
            this.ensureState();
            const hero = Aethra.GameState.hero;
            const payload = {
                reason,
                activeBarIndex: hero.activeActionBar,
                activeBar: clone(hero.actionBars[hero.activeActionBar]),
                actionBars: clone(hero.actionBars),
                ...clone(extra)
            };

            Aethra.EventBus.emit("actionBarChanged", payload);
            Aethra.EventBus.emit("actionbar:changed", payload);
        },

        save() {
            if (Aethra.SaveManager && typeof Aethra.SaveManager.save === "function") {
                Aethra.SaveManager.save();
            }
        }
    };

    Aethra.SkillSystem.init();
})(window.Aethra);
