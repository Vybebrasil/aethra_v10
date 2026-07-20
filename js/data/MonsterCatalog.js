// MonsterCatalog.js - Catálogo oficial de criaturas de Aethra
(function (Aethra) {
    "use strict";

    if (!Aethra?.GameData || !Aethra?.MonsterCatalogData) {
        throw new Error("MonsterCatalog.js requer GameData.js e MonsterCatalogData.js.");
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const normalize = (value) => String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    const ALIASES = {
        giant_rat: "giant-rat-xmm-2024",
        forest_wolf: "wolf-xmm-2024",
        orc_scout: "orc-mm",
        skeleton_guard: "skeleton-xmm-2024"
    };

    Aethra.MonsterCatalog = {
        initialized: false,
        entries: new Map(),
        aliases: { ...ALIASES },
        source: "PocketDM SRD / CC-BY-4.0",

        init() {
            if (this.initialized) return this.getStats();
            Aethra.LootProfileRegistry?.registerTemplates?.();

            Aethra.MonsterCatalogData.forEach((record) => {
                const monster = clone(record);
                monster.lootTable = Aethra.LootProfileRegistry?.buildLootTable?.(monster) || monster.lootTable || [];
                this.entries.set(monster.id, monster);
                if (monster.slug) this.aliases[monster.slug] = monster.id;
                this.aliases[normalize(monster.sourceName || monster.name)] = monster.id;
                Aethra.GameData.creatures[monster.id] = clone(monster);
            });

            Object.entries(ALIASES).forEach(([alias, targetId]) => {
                const target = this.entries.get(targetId);
                if (!target) return;
                Aethra.GameData.creatures[alias] = {
                    ...clone(target),
                    id: alias,
                    catalogId: targetId,
                    aliasOf: targetId
                };
            });

            this.patchCreatureScaling();
            this.initialized = true;

            Aethra.EventBus?.emit?.("monster-catalog:ready", this.getStats());
            return this.getStats();
        },

        patchCreatureScaling() {
            if (Aethra.GameData._monsterCatalogScalingPatched) return;
            Aethra.GameData._monsterCatalogScalingPatched = true;
            const original = Aethra.GameData.getCreature.bind(Aethra.GameData);

            Aethra.GameData.getCreature = function (creatureId, encounterLevel = null) {
                const base = this.creatures[creatureId];
                if (!base || base.catalogSource !== "pocketdm-srd") {
                    return original(creatureId, encounterLevel);
                }

                const creature = clone(base);
                const nativeLevel = Math.max(1, Number(creature.recommendedLevel || creature.level || 1));
                const requestedLevel = Math.max(1, Number(encounterLevel || nativeLevel));
                const delta = requestedLevel - nativeLevel;
                const hpScale = this.balance.monsters.hpPerLevelMultiplier ** delta;
                const damageScale = this.balance.monsters.damagePerLevelMultiplier ** delta;
                const defenseScale = this.balance.monsters.defensePerLevelMultiplier ** delta;
                const gold = this.balance.economy.scaleGold(
                    creature.goldChance,
                    creature.goldMin,
                    creature.goldMax,
                    requestedLevel
                );

                creature.nativeLevel = nativeLevel;
                creature.level = requestedLevel;
                creature.hp = Math.max(1, Math.round(Number(creature.hp || 1) * hpScale));
                creature.maxHp = creature.hp;
                creature.damage = Math.max(1, Math.round(Number(creature.damage || 1) * damageScale));
                creature.goldChance = gold.chance;
                creature.goldMin = gold.min;
                creature.goldMax = gold.max;
                creature.stats = creature.stats || {};
                creature.stats.str = Math.max(1, Math.round(Number(creature.stats.str || creature.damage) * damageScale));
                creature.stats.damageMin = Math.max(1, Math.round(Number(creature.stats.damageMin || creature.damage) * damageScale));
                creature.stats.damageMax = Math.max(creature.stats.damageMin, Math.round(Number(creature.stats.damageMax || creature.damage) * damageScale));
                creature.stats.defense = Math.max(0, Math.round(Number(creature.stats.defense || 0) * defenseScale));
                creature.scale = { level: requestedLevel, nativeLevel, delta, hp: hpScale, damage: damageScale, defense: defenseScale };
                return creature;
            };
        },

        registerLootTables() {
            if (!Aethra.LootSystem?.registerTable) return 0;
            let total = 0;
            Object.entries(Aethra.GameData.creatures).forEach(([id, monster]) => {
                if (monster.catalogSource !== "pocketdm-srd") return;
                const table = (monster.lootTable || []).map((drop) => ({
                    id: drop.templateId || drop.id,
                    chance: drop.chance,
                    minQuantity: drop.min || drop.minQuantity || 1,
                    maxQuantity: drop.max || drop.maxQuantity || drop.min || 1,
                    rarity: drop.rarity
                }));
                Aethra.LootSystem.registerTable(id, table);
                total += 1;
            });
            return total;
        },

        resolveId(idOrAlias) {
            if (this.entries.has(idOrAlias)) return idOrAlias;
            return this.aliases[idOrAlias] || this.aliases[normalize(idOrAlias)] || idOrAlias;
        },

        get(idOrAlias) {
            const id = this.resolveId(idOrAlias);
            const value = this.entries.get(id) || Aethra.GameData.creatures[idOrAlias];
            return value ? clone(value) : null;
        },

        search(query = "", options = {}) {
            const term = normalize(query);
            const minLevel = Number(options.minLevel || 0);
            const maxLevel = Number(options.maxLevel || Infinity);
            const type = options.type ? String(options.type).toLowerCase() : null;
            return [...this.entries.values()].filter((monster) => {
                if (monster.recommendedLevel < minLevel || monster.recommendedLevel > maxLevel) return false;
                if (type && monster.type !== type) return false;
                if (!term) return true;
                return [monster.name, monster.sourceName, monster.slug, monster.type, ...(monster.tags || [])]
                    .some((value) => normalize(value).includes(term));
            }).map(clone);
        },

        getByLevel(minLevel, maxLevel, options = {}) {
            return this.search("", { ...options, minLevel, maxLevel });
        },

        getStats() {
            const entries = [...this.entries.values()];
            const byType = {};
            const byRank = {};
            entries.forEach((monster) => {
                byType[monster.type] = (byType[monster.type] || 0) + 1;
                byRank[monster.rank] = (byRank[monster.rank] || 0) + 1;
            });
            return {
                initialized: this.initialized,
                total: entries.length,
                aliases: Object.keys(this.aliases).length,
                byType,
                byRank,
                source: this.source
            };
        }
    };
})(window.Aethra = window.Aethra || {});
