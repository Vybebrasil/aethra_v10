// ExplorationSystem.js - Eventos de mundo, gathering e feed vivo da hunt
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus) {
        throw new Error("ExplorationSystem.js requer game-core.js.");
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value || 0)));
    const integer = (value, fallback = 0) => {
        const parsed = Math.floor(Number(value));
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const EVENT_DEFINITIONS = {
        chest: {
            id: "chest",
            icon: "▣",
            title: "Baú antigo encontrado",
            description: "Um baú esquecido está escondido entre raízes e pedras.",
            actionLabel: "Abrir baú",
            professionId: "exploration",
            actionType: "discover",
            xp: [7, 12],
            weight: 22,
            category: "discovery"
        },
        mining: {
            id: "mining",
            icon: "⛏",
            title: "Veio de minério",
            description: "Uma formação mineral pode render minério e pedras raras.",
            actionLabel: "Minerar",
            professionId: "mining",
            actionType: "mine",
            xp: [8, 14],
            weight: 20,
            category: "gathering"
        },
        herb: {
            id: "herb",
            icon: "❧",
            title: "Ervas luminosas",
            description: "Plantas úteis cresceram em uma clareira protegida.",
            actionLabel: "Coletar ervas",
            professionId: "herbalism",
            actionType: "gather-herb",
            xp: [7, 13],
            weight: 18,
            category: "gathering"
        },
        shrine: {
            id: "shrine",
            icon: "✦",
            title: "Altar esquecido",
            description: "Runas antigas ainda guardam uma centelha de poder.",
            actionLabel: "Investigar",
            professionId: "exploration",
            actionType: "investigate",
            xp: [10, 17],
            weight: 11,
            category: "arcane"
        },
        trail: {
            id: "trail",
            icon: "⌖",
            title: "Trilha oculta",
            description: "Marcas recentes revelam uma passagem fora da rota comum.",
            actionLabel: "Explorar trilha",
            professionId: "exploration",
            actionType: "explore-trail",
            xp: [6, 11],
            weight: 19,
            category: "discovery"
        },
        camp: {
            id: "camp",
            icon: "△",
            title: "Acampamento abandonado",
            description: "Restos de suprimentos podem ajudar na sobrevivência da sessão.",
            actionLabel: "Vasculhar",
            professionId: "survival",
            actionType: "camp",
            xp: [7, 12],
            weight: 10,
            category: "survival"
        },
        forge: {
            id: "forge",
            icon: "⚒",
            title: "Forja antiga",
            description: "Uma forja esquecida ainda pode refinar minério e revelar técnicas antigas.",
            actionLabel: "Refinar metal",
            professionId: "blacksmithing",
            actionType: "forge",
            xp: [10, 17],
            weight: 6,
            category: "crafting"
        },
        locked_chest: {
            id: "locked_chest",
            icon: "▤",
            title: "Baú trancado",
            description: "Uma fechadura complexa protege moedas antigas e itens exclusivos.",
            actionLabel: "Arrombar fechadura",
            professionId: "thievery",
            actionType: "lockpick",
            requiredLevel: 1,
            xp: [12, 22],
            weight: 4,
            category: "thievery",
            requiresManual: true
        },
        secret_door: {
            id: "secret_door",
            icon: "▥",
            title: "Porta secreta",
            description: "Marcas discretas indicam uma passagem protegida por mecanismo oculto.",
            actionLabel: "Destravar passagem",
            professionId: "thievery",
            actionType: "secret-door",
            requiredLevel: 3,
            xp: [14, 24],
            weight: 3,
            category: "thievery",
            requiresManual: true
        },
        trap: {
            id: "trap",
            icon: "⚠",
            title: "Armadilha mecânica",
            description: "Um mecanismo perigoso bloqueia o avanço e pode esconder componentes valiosos.",
            actionLabel: "Desarmar armadilha",
            professionId: "thievery",
            actionType: "disarm-trap",
            requiredLevel: 2,
            xp: [10, 20],
            weight: 4,
            category: "thievery",
            requiresManual: true
        }
    };

    const RESOURCE_ITEMS = {
        iron_ore: {
            templateId: "iron_ore",
            name: "Minério de Ferro",
            itemType: "MATERIAL",
            type: "MATERIAL",
            rarity: "Comum",
            rarityId: "common",
            price: 4,
            icon: "◆",
            category: "resource"
        },
        moonleaf: {
            templateId: "moonleaf",
            name: "Folha Lunar",
            itemType: "MATERIAL",
            type: "MATERIAL",
            rarity: "Incomum",
            rarityId: "uncommon",
            price: 6,
            icon: "❧",
            category: "resource"
        },
        beast_hide: {
            templateId: "beast_hide",
            name: "Couro de Fera",
            itemType: "MATERIAL",
            type: "MATERIAL",
            rarity: "Comum",
            rarityId: "common",
            price: 5,
            icon: "◒",
            category: "resource"
        },
        ancient_token: {
            templateId: "ancient_token",
            name: "Símbolo Antigo",
            itemType: "LOOT",
            type: "LOOT",
            rarity: "Raro",
            rarityId: "rare",
            price: 18,
            icon: "✦",
            category: "loot"
        },
        thieves_mark: {
            templateId: "thieves_mark",
            name: "Marca dos Ladrões",
            itemType: "LOOT",
            type: "LOOT",
            rarity: "Raro",
            rarityId: "rare",
            price: 34,
            icon: "⚿",
            category: "loot"
        },
        hidden_map_fragment: {
            templateId: "hidden_map_fragment",
            name: "Fragmento de Mapa Oculto",
            itemType: "LOOT",
            type: "LOOT",
            rarity: "Épico",
            rarityId: "epic",
            price: 85,
            icon: "⌖",
            category: "loot"
        },
        trap_components: {
            templateId: "trap_components",
            name: "Componentes de Armadilha",
            itemType: "MATERIAL",
            type: "MATERIAL",
            rarity: "Incomum",
            rarityId: "uncommon",
            price: 12,
            icon: "⚙",
            category: "resource"
        },
        refined_ingot: {
            templateId: "refined_ingot",
            name: "Lingote Refinado",
            itemType: "MATERIAL",
            type: "MATERIAL",
            rarity: "Incomum",
            rarityId: "uncommon",
            price: 16,
            icon: "▰",
            category: "resource"
        }
    };

    Aethra.ExplorationSystem = {
        initialized: false,
        randomSource: Math.random,
        pendingTimer: null,
        eventChance: 0.26,
        minimumTickGap: 2,

        init() {
            this.ensureState();
            if (this.initialized) return this.getSnapshot();
            this.bindEvents();
            this.initialized = true;
            Aethra.EventBus.emit("exploration:ready", this.getSnapshot());
            return this.getSnapshot();
        },

        ensureState() {
            const state = Aethra.GameState.exploration || {};
            state.events = Array.isArray(state.events) ? state.events : [];
            state.pendingEvent = state.pendingEvent || null;
            state.lastEventTick = integer(state.lastEventTick, -99);
            state.totals = {
                events: integer(state.totals?.events),
                chests: integer(state.totals?.chests),
                miningNodes: integer(state.totals?.miningNodes),
                herbs: integer(state.totals?.herbs),
                hides: integer(state.totals?.hides),
                rareEvents: integer(state.totals?.rareEvents),
                rareEncounters: integer(state.totals?.rareEncounters),
                specialItems: integer(state.totals?.specialItems),
                resources: integer(state.totals?.resources),
                skillXP: integer(state.totals?.skillXP),
                lockedChests: integer(state.totals?.lockedChests),
                secretDoors: integer(state.totals?.secretDoors),
                traps: integer(state.totals?.traps),
                forges: integer(state.totals?.forges),
                failedChecks: integer(state.totals?.failedChecks)
            };
            Aethra.GameState.exploration = state;
            return state;
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            Aethra.EventBus.on("hunt:started", () => this.resetSession());
            Aethra.EventBus.on("hunt:analyzer-reset", () => this.resetMetrics());
            Aethra.EventBus.on("hunt:enemy-defeated", (payload) => this.handleCreatureHarvest(payload || {}));
            Aethra.EventBus.on("profession:rankUp", (payload) => {
                const definition = Aethra.ProfessionSystem?.professions?.[payload.professionId];
                this.pushFeed({
                    type: "skill-up",
                    icon: "↑",
                    title: `${definition?.name || "Skill"} subiu para o nível ${payload.level}`,
                    detail: definition?.nextBenefit || "Novo bônus de progressão desbloqueado.",
                    tone: "level"
                });
            });
        },

        resetSession() {
            if (this.pendingTimer) window.clearTimeout(this.pendingTimer);
            const state = this.ensureState();
            state.events = [];
            state.pendingEvent = null;
            state.lastEventTick = -99;
            state.totals = {
                events: 0,
                chests: 0,
                miningNodes: 0,
                herbs: 0,
                hides: 0,
                rareEvents: 0,
                rareEncounters: 0,
                specialItems: 0,
                resources: 0,
                skillXP: 0,
                lockedChests: 0,
                secretDoors: 0,
                traps: 0,
                forges: 0,
                failedChecks: 0
            };
            this.pushFeed({
                type: "journey",
                icon: "⌖",
                title: "A expedição começou",
                detail: "A região pode revelar combates, recursos, baús e eventos raros durante o loop da caçada.",
                tone: "system"
            });
            Aethra.EventBus.emit("exploration:updated", this.getSnapshot());
        },

        resetMetrics() {
            const state = this.ensureState();
            state.totals = {
                events: 0,
                chests: 0,
                miningNodes: 0,
                herbs: 0,
                hides: 0,
                rareEvents: 0,
                rareEncounters: 0,
                specialItems: 0,
                resources: 0,
                skillXP: 0,
                lockedChests: 0,
                secretDoors: 0,
                traps: 0,
                forges: 0,
                failedChecks: 0
            };
            Aethra.EventBus.emit("exploration:updated", this.getSnapshot());
        },

        setRandomSource(fn) {
            if (typeof fn !== "function") return false;
            this.randomSource = fn;
            return true;
        },

        tryTrigger(context = {}) {
            const state = this.ensureState();
            const huntState = Aethra.GameState.hunt || {};
            const tick = integer(context.tick ?? huntState.elapsedTicks);

            if (state.pendingEvent) return true;
            if (huntState.currentEnemy) return false;
            if (tick - state.lastEventTick < this.minimumTickGap) return false;

            const explorationLevel = Aethra.ProfessionSystem?.getState?.("exploration")?.level || 1;
            const focusMultiplier = Math.max(0, Number(context.modifiers?.eventChance ?? Aethra.HuntSystem?.getModifier?.("eventChance", 1) ?? 1));
            const chance = clamp((this.eventChance + (explorationLevel - 1) * 0.005) * focusMultiplier, 0, 0.92);
            if (this.randomSource() > chance) return false;

            const definition = this.pickEvent(context);
            if (!definition) return false;

            const event = {
                ...clone(definition),
                eventId: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
                createdAt: new Date().toISOString(),
                tick,
                huntId: huntState.huntId,
                status: "pending",
                requiredLevel: Math.max(
                    1,
                    integer(definition.requiredLevel || 1) + Math.max(0, Math.floor(Number(Aethra.HuntSystem?.getHuntDefinition?.(huntState.huntId)?.minLevel || 1) / 20))
                )
            };

            state.pendingEvent = event;
            state.lastEventTick = tick;
            this.pushFeed({
                type: "event-found",
                icon: definition.icon,
                title: definition.title,
                detail: definition.description,
                tone: definition.category === "rare" ? "rare" : "event",
                eventId: event.eventId
            });

            Aethra.EventBus.emit("exploration:event-found", clone(event));
            Aethra.EventBus.emit("exploration:updated", this.getSnapshot());

            this.pendingTimer = window.setTimeout(() => {
                this.resolveEvent(event.eventId, {
                    manual: false,
                    skip: Boolean(event.requiresManual)
                });
            }, event.requiresManual ? 9000 : 2200);

            return true;
        },

        pickEvent(context = {}) {
            const modifiers = context.modifiers || Aethra.HuntSystem?.getActiveModifiers?.() || {};
            const weights = modifiers.eventWeights || {};
            const entries = Object.values(EVENT_DEFINITIONS)
                .map((entry) => ({
                    ...entry,
                    effectiveWeight: Math.max(
                        0,
                        Number(entry.weight || 1) * Math.max(0, Number(weights[entry.id] ?? Aethra.HuntSystem?.getEventWeightMultiplier?.(entry.id) ?? 1))
                    )
                }))
                .filter((entry) => entry.effectiveWeight > 0);
            const total = entries.reduce((sum, entry) => sum + entry.effectiveWeight, 0);
            if (total <= 0) return null;
            let roll = this.randomSource() * total;
            for (const entry of entries) {
                roll -= entry.effectiveWeight;
                if (roll <= 0) {
                    const result = { ...entry };
                    delete result.effectiveWeight;
                    return result;
                }
            }
            const result = entries.at(-1) ? { ...entries.at(-1) } : null;
            if (result) delete result.effectiveWeight;
            return result;
        },

        resolveEvent(eventId, options = {}) {
            const state = this.ensureState();
            const event = state.pendingEvent;
            if (!event || event.eventId !== eventId) return false;

            if (this.pendingTimer) {
                window.clearTimeout(this.pendingTimer);
                this.pendingTimer = null;
            }

            if (options.skip) {
                event.status = "skipped";
                event.resolvedAt = new Date().toISOString();
                event.manual = false;
                state.pendingEvent = null;
                this.pushFeed({
                    type: "event-skipped",
                    icon: event.icon,
                    title: `${event.title} ignorado`,
                    detail: "O herói seguiu pela Hunt sem interromper o loop.",
                    tone: "system"
                });
                Aethra.EventBus.emit("exploration:event-skipped", clone(event));
                Aethra.EventBus.emit("exploration:updated", this.getSnapshot());
                return clone(event);
            }

            const requiresCheck = Boolean(event.requiresManual || event.requiredLevel > 1);
            const skillCheck = requiresCheck
                ? Aethra.ProfessionSystem?.check?.(
                    event.professionId,
                    event.requiredLevel || 1,
                    { randomSource: this.randomSource }
                )
                : { success: true, level: Aethra.ProfessionSystem?.getState?.(event.professionId)?.level || 1, requiredLevel: 1, chance: 1, roll: 0 };

            if (!skillCheck?.success) {
                event.status = "failed";
                event.resolvedAt = new Date().toISOString();
                event.manual = Boolean(options.manual);
                event.skillCheck = clone(skillCheck || {});
                state.pendingEvent = null;
                state.totals.failedChecks += 1;

                if (event.id === "trap") {
                    const hero = Aethra.GameState.hero || {};
                    const stats = hero.stats || {};
                    const maxHp = Math.max(1, Number(hero.maxHp ?? stats.maxHp ?? 100));
                    const damage = Math.max(1, Math.round(maxHp * 0.06));
                    if (Object.prototype.hasOwnProperty.call(hero, "hp")) hero.hp = Math.max(1, Number(hero.hp || maxHp) - damage);
                    if (Object.prototype.hasOwnProperty.call(stats, "hp")) stats.hp = Math.max(1, Number(stats.hp || maxHp) - damage);
                    event.failureDamage = damage;
                }

                const failedProfessionName = Aethra.ProfessionSystem?.professions?.[event.professionId]?.name || "Skill";
                this.pushFeed({
                    type: "skill-check-failed",
                    icon: "×",
                    title: `${event.title}: falha`,
                    detail: `${failedProfessionName} NV. ${skillCheck?.level || 1} · exigido NV. ${skillCheck?.requiredLevel || event.requiredLevel || 1}${event.failureDamage ? ` · ${event.failureDamage} de dano` : ""}`,
                    tone: "combat"
                });
                Aethra.EventBus.emit("exploration:event-failed", clone(event));
                Aethra.EventBus.emit("exploration:updated", this.getSnapshot());
                return clone(event);
            }

            const manualMultiplier = options.manual ? 1.25 : 1;
            const xpMin = integer(event.xp?.[0], 5);
            const xpMax = Math.max(xpMin, integer(event.xp?.[1], xpMin));
            const baseXp = Math.max(1, Math.round((xpMin + Math.floor(this.randomSource() * (xpMax - xpMin + 1))) * manualMultiplier));
            const xpPayload = Aethra.ProfessionSystem?.grantActionXP?.(
                event.professionId,
                baseXp,
                event.actionType || event.id,
                { source: `exploration:${event.id}` }
            );
            const xpGain = Math.max(0, Number(xpPayload?.amount || 0));
            const rewards = this.generateRewards(event, { skillCheck, manual: Boolean(options.manual) });

            rewards.items.forEach((item) => {
                Aethra.BagSystem?.addItem?.(item, `exploration:${event.id}`);
            });

            const eventLootSummary = rewards.items.reduce((summary, item) => {
                const quantity = Math.max(1, Number(item.quantity || 1));
                const unitValue = Math.max(0, Number(item.price ?? item.value ?? item.basePrice ?? 0));
                summary.lootCount += quantity;
                summary.lootValue += unitValue * quantity;
                return summary;
            }, { lootCount: 0, lootValue: 0 });
            const huntEconomy = Aethra.GameState.hunt || {};
            huntEconomy.lootCount = Math.max(0, Number(huntEconomy.lootCount || 0) + eventLootSummary.lootCount);
            huntEconomy.lootValue = Math.max(0, Number(huntEconomy.lootValue || 0) + eventLootSummary.lootValue);

            if (rewards.gold > 0) {
                const hero = Aethra.GameState.hero || (Aethra.GameState.hero = {});
                hero.gold = Math.max(0, Number(hero.gold || 0) + rewards.gold);
                hero.stats = hero.stats || {};
                hero.stats.gold = hero.gold;
                const huntState = Aethra.GameState.hunt || {};
                huntState.gold = Math.max(0, Number(huntState.gold || 0) + rewards.gold);
                Aethra.EventBus.emit("goldChanged", {
                    amount: rewards.gold,
                    total: hero.gold,
                    source: `exploration:${event.id}`
                });
            }

            if (eventLootSummary.lootCount > 0 || rewards.gold > 0) {
                Aethra.EventBus.emit("hunt:loot-generated", {
                    enemyId: null,
                    huntId: event.huntId,
                    encounterId: event.eventId,
                    source: `exploration:${event.id}`,
                    eventId: event.id,
                    gold: rewards.gold,
                    items: clone(rewards.items),
                    lootCount: eventLootSummary.lootCount,
                    lootValue: eventLootSummary.lootValue,
                    totalGold: Number(huntEconomy.gold || 0),
                    totalLootValue: Number(huntEconomy.lootValue || 0)
                });
                Aethra.EventBus.emit("hunt:economy-updated", {
                    huntId: event.huntId,
                    source: `exploration:${event.id}`,
                    gold: rewards.gold,
                    lootValue: eventLootSummary.lootValue,
                    lootCount: eventLootSummary.lootCount,
                    profitValue: Number(huntEconomy.gold || 0) + Number(huntEconomy.lootValue || 0) - Number(huntEconomy.supplyCost || 0),
                    totalGold: Number(huntEconomy.gold || 0),
                    totalLootValue: Number(huntEconomy.lootValue || 0)
                });
            }

            event.status = "resolved";
            event.resolvedAt = new Date().toISOString();
            event.manual = Boolean(options.manual);
            event.rewards = clone(rewards);
            event.xpGain = xpGain;
            event.baseXp = baseXp;
            event.skillCheck = clone(skillCheck || {});
            state.pendingEvent = null;
            state.totals.events += 1;
            state.totals.skillXP += xpGain;
            state.totals.resources += rewards.items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
            if (event.id === "chest") state.totals.chests += 1;
            if (event.id === "mining") state.totals.miningNodes += 1;
            if (event.id === "herb") state.totals.herbs += 1;
            if (event.id === "locked_chest") state.totals.lockedChests += 1;
            if (event.id === "secret_door") state.totals.secretDoors += 1;
            if (event.id === "trap") state.totals.traps += 1;
            if (event.id === "forge") state.totals.forges += 1;
            if (event.category === "rare") state.totals.rareEvents += 1;

            this.pushFeed({
                type: "event-resolved",
                icon: event.icon,
                title: `${event.title} concluído`,
                detail: `${xpGain} XP em ${Aethra.ProfessionSystem?.professions?.[event.professionId]?.name || "skill"}${rewards.summary ? ` · ${rewards.summary}` : ""}`,
                tone: event.category === "rare" || event.category === "thievery" ? "rare" : "reward"
            });

            Aethra.EventBus.emit("exploration:event-resolved", clone(event));
            Aethra.EventBus.emit("exploration:updated", this.getSnapshot());
            Aethra.EventBus.emit("inventory:changed", { source: `exploration:${event.id}` });
            return clone(event);
        },

        generateRewards(event, context = {}) {
            const createItem = (template, quantity = 1) => ({
                ...clone(template),
                id: template.templateId,
                instanceId: `${template.templateId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                quantity
            });
            const quantityMultiplier = Math.max(0, Number(Aethra.HuntSystem?.getModifier?.("resourceQuantity", 1) ?? 1));
            const goldMultiplier = Math.max(0, Number(Aethra.HuntSystem?.getModifier?.("gold", 1) ?? 1));
            const scaleQuantity = (value) => {
                const scaled = Math.max(0, Number(value || 0) * quantityMultiplier);
                const floor = Math.floor(scaled);
                return Math.max(1, floor + (this.randomSource() < scaled - floor ? 1 : 0));
            };
            const scaleGold = (value) => Math.max(0, Math.round(Number(value || 0) * goldMultiplier));
            const checkBonus = Math.max(0, Number(context.skillCheck?.level || 1) - Number(context.skillCheck?.requiredLevel || 1));

            if (event.id === "mining") {
                const quantity = scaleQuantity(1 + (this.randomSource() < 0.25 ? 1 : 0));
                return { items: [createItem(RESOURCE_ITEMS.iron_ore, quantity)], gold: 0, summary: `${quantity}x Minério de Ferro` };
            }

            if (event.id === "forge") {
                const quantity = scaleQuantity(1 + (this.randomSource() < 0.2 + Math.min(0.25, checkBonus * 0.025) ? 1 : 0));
                return { items: [createItem(RESOURCE_ITEMS.refined_ingot, quantity)], gold: 0, summary: `${quantity}x Lingote Refinado` };
            }

            if (event.id === "herb") {
                const quantity = scaleQuantity(1 + (this.randomSource() < 0.3 ? 1 : 0));
                return { items: [createItem(RESOURCE_ITEMS.moonleaf, quantity)], gold: 0, summary: `${quantity}x Folha Lunar` };
            }

            if (event.id === "chest") {
                const gold = scaleGold(6 + integer(this.randomSource() * 13));
                const items = this.randomSource() < 0.32
                    ? [createItem(RESOURCE_ITEMS.ancient_token, 1)]
                    : [];
                return { items, gold, summary: `${gold} Gold${items.length ? " + Símbolo Antigo" : ""}` };
            }

            if (event.id === "locked_chest") {
                const gold = scaleGold(16 + integer(this.randomSource() * 29) + checkBonus * 2);
                const items = [createItem(RESOURCE_ITEMS.thieves_mark, scaleQuantity(1))];
                if (this.randomSource() < Math.min(0.55, 0.14 + checkBonus * 0.035)) {
                    items.push(createItem(RESOURCE_ITEMS.hidden_map_fragment, 1));
                }
                return { items, gold, summary: `${gold} Gold · Marca dos Ladrões${items.length > 1 ? " · Mapa Oculto" : ""}` };
            }

            if (event.id === "secret_door") {
                const gold = scaleGold(10 + integer(this.randomSource() * 21));
                const quantity = scaleQuantity(1 + (checkBonus >= 4 && this.randomSource() < 0.3 ? 1 : 0));
                return {
                    items: [createItem(RESOURCE_ITEMS.hidden_map_fragment, quantity)],
                    gold,
                    summary: `${quantity}x Fragmento de Mapa Oculto · ${gold} Gold`
                };
            }

            if (event.id === "trap") {
                const quantity = scaleQuantity(1 + (this.randomSource() < 0.35 ? 1 : 0));
                return {
                    items: [createItem(RESOURCE_ITEMS.trap_components, quantity)],
                    gold: 0,
                    summary: `${quantity}x Componentes de Armadilha`
                };
            }

            if (event.id === "shrine") {
                const hero = Aethra.GameState.hero || {};
                const stats = hero.stats || {};
                stats.mana = Math.min(Number(stats.maxMana || 50), Number(stats.mana || 0) + 10);
                stats.energy = Math.min(Number(stats.maxEnergy || 100), Number(stats.energy || 0) + 15);
                return { items: [], gold: 0, summary: "+10 Mana e +15 Vigor" };
            }

            if (event.id === "camp") {
                const hunt = Aethra.GameState.hunt || {};
                hunt.supplyCost = Math.max(0, Number(hunt.supplyCost || 0) - 3);
                return { items: [], gold: 0, summary: "3 de custo recuperado" };
            }

            return { items: [], gold: scaleGold(2), summary: `${scaleGold(2)} Gold encontrados` };
        },

        tryRareEncounter(payload = {}) {
            const manager = Aethra.EconomyRNGManager;
            if (!manager?.resolveRareEncounter) return null;

            const hunt = Aethra.GameState.hunt || {};
            const enemyId = payload.enemyId || payload.id || payload.enemy?.id || null;
            const enemyName = payload.name || payload.enemy?.name || "criatura";
            const resolution = manager.resolveRareEncounter({
                enemyId,
                huntId: hunt.huntId || null,
                source: "enemy-defeated",
                specialItemPool: hunt.rareDropPool
            });

            if (!resolution) return null;

            const rewards = { items: [], gold: Number(resolution.consolation?.gold || 0) };
            const fragment = Aethra.ItemSystem?.generateItem?.(
                resolution.consolation.templateId,
                {
                    quantity: resolution.consolation.quantity,
                    rarity: "rare",
                    source: "rare-encounter-consolation",
                    enemyId,
                    huntId: hunt.huntId || null,
                    rareEncounterId: resolution.encounterId,
                    economyRollId: resolution.rareRoll?.rollId,
                    tradeClass: "stackable"
                }
            );

            if (fragment) {
                rewards.items.push(fragment);
                Aethra.BagSystem?.addItem?.(fragment, "rare-encounter-consolation");
            }

            let specialItem = null;
            if (resolution.specialItem?.success && resolution.specialItem.templateId) {
                specialItem = Aethra.ItemSystem?.generateItem?.(
                    resolution.specialItem.templateId,
                    {
                        rarity: resolution.specialItem.rarityId,
                        source: "rare-encounter-jackpot",
                        enemyId,
                        huntId: hunt.huntId || null,
                        rareEncounterId: resolution.encounterId,
                        economyRollId: resolution.specialItem.rollId,
                        tradeClass: "individual",
                        tradeable: true,
                        qualityMin: 1,
                        qualityMax: 100,
                        potentialMin: 1,
                        potentialMax: 100
                    }
                );

                if (specialItem) {
                    rewards.items.push(specialItem);
                    Aethra.BagSystem?.addItem?.(specialItem, "rare-encounter-jackpot");
                }
            }

            if (rewards.gold > 0) {
                const hero = Aethra.GameState.hero || (Aethra.GameState.hero = {});
                hero.gold = Math.max(0, Number(hero.gold || 0) + rewards.gold);
                hero.stats = hero.stats || {};
                hero.stats.gold = hero.gold;
                Aethra.EventBus.emit("goldChanged", {
                    amount: rewards.gold,
                    total: hero.gold,
                    source: "rare-encounter"
                });
            }

            const state = this.ensureState();
            state.totals.rareEvents += 1;
            state.totals.rareEncounters += 1;
            state.totals.resources += Number(fragment?.quantity || 0);
            if (specialItem) state.totals.specialItems += 1;

            const specialSummary = specialItem
                ? ` · DROP ESPECIAL: ${specialItem.name} [${specialItem.rarity}] · IV ${Number(specialItem.iv?.percent || specialItem.rollScore || 0).toFixed(1)}%`
                : "";

            this.pushFeed({
                type: "rare-encounter",
                icon: "✧",
                title: `Encontro raro após ${enemyName}`,
                detail: `${Number(fragment?.quantity || 0)}x Fragmento de Éter · ${rewards.gold} Gold${specialSummary}`,
                tone: specialItem ? "legendary" : "rare"
            });

            const payloadOut = {
                ...clone(resolution),
                enemyId,
                enemyName,
                rewards: clone(rewards),
                specialItem: specialItem ? clone(specialItem) : null
            };
            Aethra.EventBus.emit("exploration:rare-encounter-resolved", payloadOut);
            Aethra.EventBus.emit("exploration:updated", this.getSnapshot());
            Aethra.EventBus.emit("inventory:changed", { source: "rare-encounter" });
            return payloadOut;
        },

        handleCreatureHarvest(payload = {}) {
            const state = this.ensureState();
            const enemyId = payload.enemyId || payload.id || payload.enemy?.id || null;
            const creature = enemyId ? (Aethra.GameData?.creatures?.[enemyId] || payload.enemy || {}) : (payload.enemy || {});
            const enemyName = payload.name || creature?.name || "criatura";
            this.tryRareEncounter(payload);

            const tags = Array.isArray(creature?.tags) ? creature.tags.map((tag) => String(tag).toLowerCase()) : [];
            const type = String(creature?.type || creature?.family || "").toLowerCase();
            const skinnable = tags.includes("skinnable") || ["beast", "monstrosity", "dragon"].includes(type);
            if (!skinnable) {
                this.pushFeed({
                    type: "combat",
                    icon: "⚔",
                    title: `${enemyName} derrotado`,
                    detail: `${integer(payload.xp)} XP · ${integer(payload.gold)} Gold`,
                    tone: "combat"
                });
                return;
            }

            const harvestMultiplier = Math.max(0, Number(Aethra.HuntSystem?.getModifier?.("harvestChance", 1) ?? 1));
            const baseHarvestChance = 0.38;
            if (this.randomSource() > clamp(baseHarvestChance * harvestMultiplier, 0, 0.95)) {
                this.pushFeed({
                    type: "combat",
                    icon: "⚔",
                    title: `${enemyName} derrotado`,
                    detail: `${integer(payload.xp)} XP · ${integer(payload.gold)} Gold`,
                    tone: "combat"
                });
                return;
            }

            const quantityMultiplier = Math.max(0, Number(Aethra.HuntSystem?.getModifier?.("resourceQuantity", 1) ?? 1));
            const baseQuantity = 1 + (this.randomSource() < 0.18 ? 1 : 0);
            const scaledQuantity = Math.max(1, baseQuantity * quantityMultiplier);
            const quantity = Math.max(1, Math.floor(scaledQuantity) + (this.randomSource() < scaledQuantity - Math.floor(scaledQuantity) ? 1 : 0));
            const item = {
                ...clone(RESOURCE_ITEMS.beast_hide),
                id: "beast_hide",
                instanceId: `beast_hide_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                quantity
            };
            Aethra.BagSystem?.addItem?.(item, "exploration:skinning");
            const baseXp = 5 + integer(this.randomSource() * 7);
            const xpPayload = Aethra.ProfessionSystem?.grantActionXP?.("skinning", baseXp, "skin", { source: "creature-harvest" });
            const xpGain = Math.max(0, Number(xpPayload?.amount || 0));
            state.totals.hides += quantity;
            state.totals.resources += quantity;
            state.totals.skillXP += xpGain;

            this.pushFeed({
                type: "gathering",
                icon: "◒",
                title: `${enemyName}: material aproveitado`,
                detail: `${quantity}x Couro de Fera · +${xpGain} XP de Couraria`,
                tone: "reward"
            });
            Aethra.EventBus.emit("exploration:resource-collected", {
                source: "skinning",
                title: `${enemyName}: material coletado`,
                item: clone(item),
                xpGain
            });
            Aethra.EventBus.emit("exploration:updated", this.getSnapshot());
            Aethra.EventBus.emit("inventory:changed", { source: "exploration:skinning" });
        },

        pushFeed(entry) {
            const state = this.ensureState();
            const normalized = {
                id: entry.id || `feed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
                type: entry.type || "system",
                icon: entry.icon || "•",
                title: entry.title || "Evento",
                detail: entry.detail || "",
                tone: entry.tone || "system",
                eventId: entry.eventId || null,
                createdAt: entry.createdAt || new Date().toISOString()
            };
            state.events.unshift(normalized);
            state.events = state.events.slice(0, 30);
            Aethra.EventBus.emit("exploration:feed", clone(normalized));
            return clone(normalized);
        },

        getSnapshot() {
            const state = this.ensureState();
            return clone({
                events: state.events,
                pendingEvent: state.pendingEvent,
                totals: state.totals
            });
        }
    };
})(window.Aethra);
