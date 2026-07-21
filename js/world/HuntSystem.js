// HuntSystem.js - Motor de caçadas orientado por Aethra.GameData
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus || !Aethra.GameData) {
        throw new Error("HuntSystem.js requer game-core.js e GameData.js.");
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    Aethra.HuntSystem = {
        initialized: false,
        timerId: null,
        encounterTimerId: null,
        sessionToken: 0,
        randomSource: Math.random,

        config: {
            speed: 1000,
            isRunning: false,
            isPaused: false,
            encounterResolveDelay: 1200,
            combatEngine: "BattleSystem",
            useBattleSystem: true,
            useCombatSystem: false,
            autoResolveWithoutCombat: true,
            autoGenerateLoot: true
        },

        hunts: {
            whispering_forest: {
                id: "whispering_forest",
                name: "Bosque dos Sussurros",
                encounterChance: 0.35,
                enemies: [
                    { id: "forest_wolf", weight: 80 },
                    { id: "giant_rat", weight: 20 }
                ]
            }
        },

        init() {
            if (this.initialized) return this.getSnapshot();

            this.ensureState();
            Aethra.HuntCatalog?.applyTo?.(this);
            this.syncGameDataWithLootSystem();
            this.bindEvents();
            this.initialized = true;

            Aethra.EventBus.emit("hunt:ready", {
                hunts: Object.keys(this.hunts),
                creatures: Object.keys(Aethra.GameData.creatures || {})
            });

            return this.getSnapshot();
        },

        ensureState() {
            const state = Aethra.GameState;
            state.hero = state.hero || {};
            state.hero.gold = Math.max(0, number(state.hero.gold, 0));

            state.hunt = state.hunt || {};
            state.hunt.isActive = Boolean(state.hunt.isActive);
            state.hunt.isPaused = Boolean(state.hunt.isPaused);
            state.hunt.huntId = state.hunt.huntId || null;
            state.hunt.mode = state.hunt.mode || null;
            state.hunt.focusId = state.hunt.focusId || null;
            state.hunt.focusName = state.hunt.focusName || null;
            state.hunt.modifiers = state.hunt.modifiers && typeof state.hunt.modifiers === "object"
                ? clone(state.hunt.modifiers)
                : {};
            state.hunt.kills = Math.max(0, Math.floor(number(state.hunt.kills, 0)));
            state.hunt.xp = Math.max(0, Math.floor(number(state.hunt.xp, 0)));
            state.hunt.gold = Math.max(0, Math.floor(number(state.hunt.gold, 0)));
            state.hunt.lootCount = Math.max(
                0,
                Math.floor(number(state.hunt.lootCount, 0))
            );
            state.hunt.lootValue = Math.max(
                0,
                Math.floor(number(state.hunt.lootValue, 0))
            );
            state.hunt.supplyCost = Math.max(
                0,
                Math.floor(number(state.hunt.supplyCost, 0))
            );
            state.hunt.supplyBreakdown = state.hunt.supplyBreakdown
                && typeof state.hunt.supplyBreakdown === "object"
                && !Array.isArray(state.hunt.supplyBreakdown)
                ? clone(state.hunt.supplyBreakdown)
                : {};
            state.hunt.lastRewards = state.hunt.lastRewards || null;
            state.hunt.elapsedTicks = Math.max(0, Math.floor(number(state.hunt.elapsedTicks, 0)));
            state.hunt.elapsedMs = Math.max(0, number(state.hunt.elapsedMs, 0));
            state.hunt.currentEnemy = state.hunt.currentEnemy || null;
            state.hunt.lastEnemy = state.hunt.lastEnemy || null;
            state.hunt.startedAt = state.hunt.startedAt || null;
            state.hunt.endedAt = state.hunt.endedAt || null;
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            Aethra.EventBus.on("EnemyDefeated", (payload) => {
                this.handleEnemyDefeated(payload || {});
            });

            Aethra.EventBus.on("HeroDefeated", () => {
                if (this.config.isRunning) this.stopHunt("hero-defeated");
            });

            Aethra.EventBus.on("save:loaded", () => {
                this.clearTimers();
                this.config.isRunning = false;
                this.config.isPaused = false;
                this.ensureState();
                Aethra.GameState.hunt.isActive = false;
                Aethra.GameState.hunt.isPaused = false;
                Aethra.GameState.hunt.currentEnemy = null;
            });

            Aethra.EventBus.on("gamedata:creature-registered", () => {
                this.syncGameDataWithLootSystem();
            });

            Aethra.EventBus.on("gamedata:item-registered", () => {
                this.syncGameDataWithLootSystem();
            });
        },

        syncGameDataWithLootSystem() {
            if (!Aethra.LootSystem) return false;

            if (Aethra.ItemSystem?.syncFromGameData) {
                Aethra.ItemSystem.syncFromGameData();
            }

            Object.entries(Aethra.GameData.items || {}).forEach(([itemId, item]) => {
                if (typeof Aethra.LootSystem.registerTemplate !== "function") return;

                const normalizedTemplate = Aethra.ItemSystem?.templates?.[itemId];

                Aethra.LootSystem.registerTemplate(
                    itemId,
                    normalizedTemplate
                        ? clone(normalizedTemplate)
                        : {
                            ...clone(item),
                            id: itemId,
                            basePrice: number(item.price, 0),
                            baseDamage: number(item.damage, 0),
                            baseDefense: number(item.defense, 0)
                        }
                );
            });

            Object.entries(Aethra.GameData.creatures || {}).forEach(([creatureId, creature]) => {
                const sourceDrops = Array.isArray(creature.lootTable)
                    ? creature.lootTable
                    : [];

                const drops = sourceDrops.map((drop) => ({
                    id: drop.templateId || drop.id,
                    chance: clamp(number(drop.chance, 0), 0, 1),
                    minQuantity: Math.max(1, Math.floor(number(drop.min, drop.minQuantity || 1))),
                    maxQuantity: Math.max(1, Math.floor(number(drop.max, drop.maxQuantity || drop.min || 1))),
                    rarity: drop.rarity
                }));

                if (typeof Aethra.LootSystem.registerTable === "function") {
                    // Uma lootTable vazia no GameData não apaga extensões de
                    // conteúdo já registradas pelo LootSystem.
                    if (drops.length > 0 || !Array.isArray(Aethra.LootSystem.tables?.[creatureId])) {
                        Aethra.LootSystem.registerTable(creatureId, drops);
                    }
                }
            });

            // registerTable invalida os perfis individualmente. Recompila uma
            // única vez ao fim da sincronização para manter as rolagens O(1)
            // durante o loop da Hunt e no preview do Atlas.
            Aethra.LootSystem.rebuildCatalogEconomy?.();

            return true;
        },

        getCreature(creatureId) {
            if (!creatureId) return null;

            const heroLevel = Math.max(
                1,
                Math.floor(number(Aethra.GameState.hero?.level, 1))
            );

            const source = typeof Aethra.GameData.getCreature === "function"
                ? Aethra.GameData.getCreature(creatureId, heroLevel)
                : Aethra.GameData.creatures?.[creatureId];

            if (!source) return null;

            const creature = clone(source);
            const baseDamage = Math.max(1, number(creature.damage, 1));
            const sourceStats = creature.stats || {};

            return {
                ...creature,
                id: creatureId,
                name: creature.name || creatureId,
                hp: Math.max(1, number(creature.hp, 1)),
                xp: Math.max(0, Math.floor(number(creature.xp, 0))),
                gold: Math.max(0, Math.floor(number(creature.gold, 0))),
                damage: baseDamage,
                stats: {
                    ...clone(sourceStats),
                    str: number(sourceStats.str, baseDamage),
                    damageMin: number(
                        sourceStats.damageMin ?? creature.damageMin,
                        baseDamage
                    ),
                    damageMax: number(
                        sourceStats.damageMax ?? creature.damageMax,
                        baseDamage
                    )
                }
            };
        },

        registerHunt(huntId, definition) {
            if (!huntId || !definition || typeof definition !== "object") return false;

            this.hunts[huntId] = {
                ...clone(definition),
                id: huntId,
                name: definition.name || huntId,
                encounterChance: clamp(number(definition.encounterChance, 0.3), 0, 1),
                focus: definition.focus ? clone(definition.focus) : null,
                modifiers: definition.modifiers ? clone(definition.modifiers) : {},
                enemies: Array.isArray(definition.enemies)
                    ? definition.enemies.map((enemy) => ({ ...enemy }))
                    : []
            };

            Aethra.EventBus.emit("hunt:registered", {
                huntId,
                hunt: clone(this.hunts[huntId])
            });

            return clone(this.hunts[huntId]);
        },

        registerEnemy(enemyId, definition) {
            if (!enemyId || !definition || typeof definition !== "object") {
                return false;
            }

            Aethra.GameData.creatures = Aethra.GameData.creatures || {};
            Aethra.GameData.creatures[enemyId] = clone(definition);

            Aethra.EventBus.emit("gamedata:creature-registered", {
                creatureId: enemyId,
                creature: clone(Aethra.GameData.creatures[enemyId])
            });

            return this.getCreature(enemyId);
        },

        setRandomSource(fn) {
            if (typeof fn !== "function") return false;
            this.randomSource = fn;
            return true;
        },

        getHuntDefinition(huntId = Aethra.GameState.hunt?.huntId) {
            return huntId ? this.hunts[huntId] || null : null;
        },

        getActiveModifiers() {
            const state = Aethra.GameState.hunt || {};
            if (!state.isActive && !this.config.isRunning) return {};
            const definition = this.getHuntDefinition();
            return clone(definition?.modifiers || state.modifiers || {});
        },

        getModifier(key, fallback = 1) {
            const modifiers = this.getActiveModifiers();
            const value = modifiers?.[key];
            return Number.isFinite(Number(value)) ? Number(value) : fallback;
        },

        getProfessionXPMultiplier(professionId) {
            const modifiers = this.getActiveModifiers();
            const value = modifiers?.professionXp?.[professionId];
            return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 1;
        },

        getCombatSkillXPMultiplier() {
            return Math.max(0, this.getModifier("combatSkillXp", 1));
        },

        getEventWeightMultiplier(eventId) {
            const modifiers = this.getActiveModifiers();
            const value = modifiers?.eventWeights?.[eventId];
            return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 1;
        },

        getFocusSnapshot(huntId = Aethra.GameState.hunt?.huntId) {
            const definition = this.getHuntDefinition(huntId);
            return definition ? {
                huntId: definition.id,
                mode: definition.mode || "expedition",
                focus: definition.focus ? clone(definition.focus) : null,
                modifiers: clone(definition.modifiers || {})
            } : null;
        },

        startHunt(huntId = "whispering_forest", options = {}) {
            this.ensureState();
            const hunt = this.hunts[huntId];

            if (!hunt) {
                Aethra.EventBus.emit("hunt:error", {
                    code: "HUNT_NOT_FOUND",
                    huntId
                });
                return false;
            }

            const previousSession = this.getSnapshot();
            if (previousSession.huntId && (
                previousSession.elapsedMs > 0
                || previousSession.xp > 0
                || previousSession.kills > 0
                || previousSession.gold > 0
                || previousSession.lootValue > 0
                || previousSession.supplyCost > 0
            )) {
                Aethra.EventBus.emit("hunt:session-finalizing", {
                    reason: "new-hunt",
                    ...previousSession
                });
            }

            this.clearTimers();
            this.sessionToken += 1;
            this.config.speed = Math.max(100, Math.floor(number(options.speed, this.config.speed)));
            this.config.isRunning = true;
            this.config.isPaused = false;

            const state = Aethra.GameState.hunt;
            Object.assign(state, {
                isActive: true,
                isPaused: false,
                huntId,
                mode: options.mode || hunt.mode || "expedition",
                focusId: hunt.focus?.id || null,
                focusName: hunt.focus?.name || null,
                modifiers: clone(hunt.modifiers || {}),
                kills: 0,
                xp: 0,
                gold: 0,
                lootCount: 0,
                lootValue: 0,
                supplyCost: 0,
                supplyBreakdown: {},
                lastRewards: null,
                elapsedTicks: 0,
                elapsedMs: 0,
                currentEnemy: null,
                lastEnemy: null,
                startedAt: new Date().toISOString(),
                endedAt: null
            });

            Aethra.EventBus.emit("hunt:started", {
                huntId,
                hunt: clone(hunt),
                focus: hunt.focus ? clone(hunt.focus) : null,
                modifiers: clone(hunt.modifiers || {}),
                state: this.getSnapshot()
            });

            Aethra.EventBus.emit("hunt:updated", this.getSnapshot());
            this.scheduleNextTick(this.sessionToken, 0);
            return true;
        },

        resetAnalyzer() {
            this.ensureState();

            const state = Aethra.GameState.hunt;
            const wasRunning = Boolean(
                this.config.isRunning || state.isActive
            );

            Aethra.EventBus.emit("hunt:session-finalizing", {
                reason: "analyzer-reset",
                ...this.getSnapshot()
            });

            Object.assign(state, {
                kills: 0,
                xp: 0,
                gold: 0,
                lootCount: 0,
                lootValue: 0,
                supplyCost: 0,
                supplyBreakdown: {},
                lastRewards: null,
                lastEnemy: null,
                elapsedTicks: 0,
                elapsedMs: 0,
                startedAt: wasRunning
                    ? new Date().toISOString()
                    : state.startedAt,
                endedAt: wasRunning ? null : state.endedAt
            });

            const snapshot = this.getSnapshot();

            Aethra.EventBus.emit("hunt:analyzer-reset", snapshot);
            Aethra.EventBus.emit("hunt:updated", snapshot);

            return snapshot;
        },

        stopHunt(reason = "manual") {
            this.ensureState();
            const wasRunning = this.config.isRunning || Aethra.GameState.hunt.isActive;

            this.config.isRunning = false;
            this.config.isPaused = false;
            this.sessionToken += 1;
            this.clearTimers();

            Object.assign(Aethra.GameState.hunt, {
                isActive: false,
                isPaused: false,
                currentEnemy: null,
                endedAt: new Date().toISOString()
            });

            const snapshot = this.getSnapshot();

            if (wasRunning) {
                Aethra.EventBus.emit("hunt:ended", { reason, ...snapshot });
                Aethra.EventBus.emit("hunt:updated", snapshot);
            }

            return snapshot;
        },

        pauseHunt() {
            if (!this.config.isRunning || this.config.isPaused) return false;
            this.config.isPaused = true;
            Aethra.GameState.hunt.isPaused = true;
            this.clearTickTimer();
            Aethra.EventBus.emit("hunt:paused", this.getSnapshot());
            return true;
        },

        resumeHunt() {
            if (!this.config.isRunning || !this.config.isPaused) return false;
            this.config.isPaused = false;
            Aethra.GameState.hunt.isPaused = false;
            Aethra.EventBus.emit("hunt:resumed", this.getSnapshot());
            this.scheduleNextTick(this.sessionToken, this.config.speed);
            return true;
        },

        recordSupplyUse(itemOrId, quantity = 1, options = {}) {
            this.ensureState();

            const state = Aethra.GameState.hunt;
            if (!state.isActive && options.allowInactive !== true) return false;

            const item = typeof itemOrId === "object" && itemOrId
                ? itemOrId
                : Aethra.GameData.items?.[itemOrId]
                    || Aethra.ItemSystem?.templates?.[itemOrId]
                    || { id: itemOrId };
            const itemId = String(
                options.itemId
                || item.templateId
                || item.id
                || "unknown_supply"
            );
            const amount = Math.max(1, Math.floor(number(quantity, 1)));
            const unitCost = Math.max(0, number(
                options.unitCost,
                item.price ?? item.basePrice ?? item.value ?? 0
            ));
            const totalCost = Math.max(0, number(
                options.totalCost,
                unitCost * amount
            ));
            const current = state.supplyBreakdown[itemId] || {};

            state.supplyBreakdown[itemId] = {
                itemId,
                name: String(options.name || item.name || current.name || itemId),
                quantity: Math.max(0, Math.floor(number(current.quantity, 0))) + amount,
                totalCost: Math.max(0, number(current.totalCost, 0)) + totalCost
            };
            state.supplyCost = Math.max(0, number(state.supplyCost, 0) + totalCost);

            const payload = {
                ...clone(state.supplyBreakdown[itemId]),
                amount,
                unitCost,
                cost: totalCost,
                source: options.source || "hunt-system",
                huntId: state.huntId,
                supplyCost: state.supplyCost
            };

            Aethra.EventBus.emit("hunt:supply-used", payload);
            Aethra.EventBus.emit("hunt:updated", this.getSnapshot());
            return payload;
        },

        scheduleNextTick(token, delay = this.config.speed) {
            this.clearTickTimer();
            this.timerId = window.setTimeout(() => {
                if (token === this.sessionToken) this.tick(token);
            }, Math.max(0, delay));
        },

        tick(token = this.sessionToken) {
            if (token !== this.sessionToken || !this.config.isRunning || this.config.isPaused) return;

            const state = Aethra.GameState.hunt;
            const hunt = this.hunts[state.huntId];

            if (!hunt) {
                this.stopHunt("invalid-hunt");
                return;
            }

            state.elapsedTicks += 1;
            state.elapsedMs += this.config.speed;

            Aethra.EventBus.emit("hunt:tick", {
                huntId: state.huntId,
                tick: state.elapsedTicks,
                elapsedMs: state.elapsedMs,
                elapsedSeconds: Math.floor(state.elapsedMs / 1000),
                state: this.getSnapshot()
            });

            // Durante a curta resolução visual do combate anterior, não cria
            // um encontro que seria recusado e deixaria a Hunt travada.
            if (!state.currentEnemy && !Aethra.BattleSystem?.isFighting) {
                const explorationTriggered = Boolean(
                    Aethra.ExplorationSystem?.tryTrigger?.({
                        huntId: state.huntId,
                        tick: state.elapsedTicks,
                        elapsedMs: state.elapsedMs,
                        focus: hunt.focus ? clone(hunt.focus) : null,
                        modifiers: clone(hunt.modifiers || {})
                    })
                );

                const encounterChance = clamp(
                    number(hunt.encounterChance, 0.3) * Math.max(0, number(hunt.modifiers?.encounterChance, 1)),
                    0,
                    1
                );
                if (!explorationTriggered && this.randomSource() <= encounterChance) {
                    this.handleEncounter();
                }
            }

            Aethra.EventBus.emit("hunt:updated", this.getSnapshot());
            this.scheduleNextTick(token, this.config.speed);
        },

        handleEncounter(enemyId = null) {
            this.ensureState();
            if (!this.config.isRunning || this.config.isPaused) return null;
            if (Aethra.GameState.hunt.currentEnemy) return clone(Aethra.GameState.hunt.currentEnemy);

            const hunt = this.hunts[Aethra.GameState.hunt.huntId];
            const selectedId = enemyId || this.pickEnemy(hunt);
            const creature = this.getCreature(selectedId);

            if (!creature) {
                Aethra.EventBus.emit("hunt:error", {
                    code: "CREATURE_NOT_FOUND_IN_GAMEDATA",
                    enemyId: selectedId
                });
                return null;
            }

            const combatXpMultiplier = Math.max(0, number(hunt.modifiers?.combatXp, 1));
            const sourceXp = Math.max(0, Math.floor(number(creature.xp, 0)));
            const encounter = {
                ...clone(creature),
                encounterId: this.createEncounterId(),
                huntId: Aethra.GameState.hunt.huntId,
                huntMode: hunt.mode || "expedition",
                huntFocus: hunt.focus ? clone(hunt.focus) : null,
                sourceXp,
                xp: Math.max(0, Math.round(sourceXp * combatXpMultiplier)),
                xpMultiplier: combatXpMultiplier,
                hp: number(creature.hp, 1),
                maxHp: number(creature.hp, 1),
                gold: 0,
                stats: clone(creature.stats || {}),
                encounteredAt: new Date().toISOString()
            };

            Aethra.GameState.hunt.currentEnemy = encounter;

            Aethra.EventBus.emit("EnemyEncountered", clone(encounter));
            Aethra.EventBus.emit("hunt:encountered", clone(encounter));
            Aethra.EventBus.emit("hunt:updated", this.getSnapshot());

            if (
                this.config.useBattleSystem &&
                Aethra.BattleSystem &&
                typeof Aethra.BattleSystem.startCombat === "function"
            ) {
                Aethra.BattleSystem.startCombat(clone(encounter), {
                    source: "hunt",
                    huntId: encounter.huntId,
                    encounterId: encounter.encounterId
                });
            } else if (
                this.config.useCombatSystem &&
                Aethra.CombatSystem &&
                typeof Aethra.CombatSystem.startCombat === "function"
            ) {
                Aethra.CombatSystem.startCombat(clone(encounter), {
                    source: "hunt",
                    huntId: encounter.huntId,
                    encounterId: encounter.encounterId
                });
            } else if (this.config.autoResolveWithoutCombat) {
                const token = this.sessionToken;
                this.encounterTimerId = window.setTimeout(() => {
                    if (token === this.sessionToken) {
                        this.resolveEncounter(encounter.encounterId);
                    }
                }, this.config.encounterResolveDelay);
            }

            return clone(encounter);
        },

        resolveEncounter(encounterId = null) {
            const enemy = Aethra.GameState.hunt.currentEnemy;
            if (!enemy) return null;
            if (encounterId && enemy.encounterId !== encounterId) return null;

            const payload = {
                id: enemy.id,
                enemyId: enemy.id,
                name: enemy.name,
                xp: number(enemy.xp, 0),
                gold: number(enemy.gold, this.rollGold(enemy)),
                huntId: enemy.huntId,
                encounterId: enemy.encounterId,
                enemy: clone(enemy),
                defeatedAt: new Date().toISOString(),
                source: "hunt-auto-resolve"
            };

            Aethra.EventBus.emit("EnemyDefeated", payload);
            return payload;
        },

        handleEnemyDefeated(payload) {
            this.ensureState();
            const state = Aethra.GameState.hunt;
            const current = state.currentEnemy;
            const enemyId = payload.enemyId || payload.id || payload.enemy?.id;

            if (!state.isActive || !current || !enemyId) return false;
            if (current.id !== enemyId) return false;
            if (payload.encounterId && current.encounterId !== payload.encounterId) return false;

            const xp = Math.max(0, Math.floor(number(payload.xp, current.xp || 0)));
            const activeHunt = this.getHuntDefinition(state.huntId) || {};
            const modifiers = activeHunt.modifiers || {};
            const lootPayload = {
                enemyId,
                huntId: state.huntId,
                encounterId: current.encounterId,
                source: "hunt-system",
                huntMode: activeHunt.mode || state.mode || "expedition",
                focusId: activeHunt.focus?.id || state.focusId || null,
                goldMultiplier: Math.max(0, number(modifiers.gold, 1)),
                materialChanceMultiplier: Math.max(0, number(modifiers.materialChance, 1)),
                quantityMultiplier: Math.max(0, number(modifiers.resourceQuantity, 1)),
                rareDropMultiplier: Math.max(0, Math.min(1.25, number(modifiers.rareDrop, 1)))
            };

            Aethra.EventBus.emit("LootFound", lootPayload);

            let economyResult = {
                gold: Math.max(0, Math.floor(number(payload.gold, current.gold || 0))),
                items: [],
                lootCount: 0,
                lootValue: 0,
                profile: null
            };

            if (
                this.config.autoGenerateLoot &&
                Aethra.LootSystem &&
                typeof Aethra.LootSystem.processMonsterDefeat === "function"
            ) {
                economyResult = Aethra.LootSystem.processMonsterDefeat(
                    enemyId,
                    lootPayload
                ) || economyResult;
            } else if (
                this.config.autoGenerateLoot &&
                Aethra.LootSystem &&
                typeof Aethra.LootSystem.generateLoot === "function"
            ) {
                const items = Aethra.LootSystem.generateLoot(enemyId, lootPayload) || [];
                economyResult.items = items;
                items.forEach((item) => {
                    const quantity = Math.max(1, Math.floor(number(item?.quantity, 1)));
                    const unitValue = Math.max(0, Math.floor(number(item?.price ?? item?.value ?? item?.basePrice, 0)));
                    economyResult.lootCount += quantity;
                    economyResult.lootValue += unitValue * quantity;
                });
            }

            const gold = Math.max(0, Math.floor(number(economyResult.gold, 0)));
            const items = Array.isArray(economyResult.items) ? economyResult.items : [];
            const lootCount = Math.max(0, Math.floor(number(economyResult.lootCount, 0)));
            const lootValue = Math.max(0, Math.floor(number(economyResult.lootValue, 0)));

            state.kills += 1;
            if (!Aethra.XPSystem) state.xp += xp;
            state.gold += gold;
            state.lootCount += lootCount;
            state.lootValue += lootValue;
            state.lastEnemy = clone(current);
            state.currentEnemy = null;

            Aethra.GameState.hero.gold = Math.max(
                0,
                number(Aethra.GameState.hero.gold, 0) + gold
            );
            Aethra.GameState.hero.stats = Aethra.GameState.hero.stats || {};
            Aethra.GameState.hero.stats.gold = Aethra.GameState.hero.gold;

            Aethra.EventBus.emit("goldChanged", {
                amount: gold,
                total: Aethra.GameState.hero.gold,
                source: "hunt",
                enemyId,
                huntId: state.huntId,
                economyTier: economyResult.profile?.tierId || null
            });

            const rewards = {
                enemyId,
                encounterId: current.encounterId,
                huntId: state.huntId,
                xp,
                sourceXp: Math.max(0, Math.floor(number(current.sourceXp, xp))),
                xpMultiplier: Math.max(0, number(current.xpMultiplier, 1)),
                gold,
                items: clone(items),
                lootCount,
                lootValue,
                economyProfile: economyResult.profile ? clone(economyResult.profile) : null,
                totalGold: state.gold,
                totalLootCount: state.lootCount,
                totalLootValue: state.lootValue
            };

            state.lastRewards = clone(rewards);

            Aethra.EventBus.emit("hunt:loot-generated", {
                ...lootPayload,
                gold,
                items: clone(items),
                lootCount,
                lootValue,
                economyProfile: economyResult.profile ? clone(economyResult.profile) : null,
                totalGold: state.gold,
                totalLootValue: state.lootValue
            });

            Aethra.EventBus.emit("hunt:economy-updated", {
                enemyId,
                huntId: state.huntId,
                gold,
                lootValue,
                lootCount,
                profitValue: state.gold + state.lootValue - state.supplyCost,
                totalGold: state.gold,
                totalLootValue: state.lootValue,
                profile: economyResult.profile ? clone(economyResult.profile) : null
            });

            Aethra.EventBus.emit(
                "hunt:rewards-updated",
                clone(rewards)
            );

            const result = {
                ...payload,
                enemyId,
                xp,
                gold,
                lootCount,
                lootValue,
                items: clone(items),
                rewards: clone(rewards),
                kills: state.kills
            };

            Aethra.EventBus.emit("hunt:enemy-defeated", result);
            Aethra.EventBus.emit("hunt:updated", this.getSnapshot());
            return true;
        },

        pickEnemy(hunt) {
            if (!hunt || !Array.isArray(hunt.enemies) || hunt.enemies.length === 0) return null;

            const entries = hunt.enemies
                .map((entry) => ({
                    id: typeof entry === "string" ? entry : entry.id,
                    weight: Math.max(0, number(typeof entry === "string" ? 1 : entry.weight, 1))
                }))
                .filter((entry) => entry.id && entry.weight > 0 && this.getCreature(entry.id));

            const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
            if (total <= 0) return entries[0]?.id || null;

            let roll = this.randomSource() * total;
            for (const entry of entries) {
                roll -= entry.weight;
                if (roll <= 0) return entry.id;
            }
            return entries.at(-1)?.id || null;
        },

        rollGold(creature) {
            const chance = clamp(number(creature.goldChance, 1), 0, 1);

            if (this.randomSource() > chance) {
                return 0;
            }

            const min = Math.max(0, Math.floor(number(creature.goldMin, creature.gold || 0)));
            const max = Math.max(min, Math.floor(number(creature.goldMax, creature.gold || min)));
            return Math.floor(this.randomSource() * (max - min + 1)) + min;
        },

        createEncounterId() {
            if (window.crypto?.randomUUID) return `enc_${window.crypto.randomUUID()}`;
            return `enc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
        },

        getSnapshot() {
            this.ensureState();
            const state = Aethra.GameState.hunt;
            return {
                isRunning: this.config.isRunning,
                isPaused: this.config.isPaused,
                huntId: state.huntId,
                mode: state.mode,
                focusId: state.focusId,
                focusName: state.focusName,
                modifiers: clone(state.modifiers || {}),
                focus: this.getHuntDefinition(state.huntId)?.focus ? clone(this.getHuntDefinition(state.huntId).focus) : null,
                kills: state.kills,
                xp: state.xp,
                gold: state.gold,
                lootCount: state.lootCount,
                lootValue: state.lootValue,
                supplyCost: state.supplyCost,
                supplyBreakdown: clone(state.supplyBreakdown || {}),
                lastRewards: state.lastRewards
                    ? clone(state.lastRewards)
                    : null,
                elapsedTicks: state.elapsedTicks,
                elapsedMs: state.elapsedMs,
                elapsedSeconds: Math.floor(state.elapsedMs / 1000),
                currentEnemy: clone(state.currentEnemy),
                lastEnemy: clone(state.lastEnemy),
                startedAt: state.startedAt,
                endedAt: state.endedAt
            };
        },

        clearTickTimer() {
            if (this.timerId !== null) {
                window.clearTimeout(this.timerId);
                this.timerId = null;
            }
        },

        clearEncounterTimer() {
            if (this.encounterTimerId !== null) {
                window.clearTimeout(this.encounterTimerId);
                this.encounterTimerId = null;
            }
        },

        clearTimers() {
            this.clearTickTimer();
            this.clearEncounterTimer();
        }
    };
})(window.Aethra);
