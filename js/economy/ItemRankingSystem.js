// ItemRankingSystem.js - índice vivo e determinístico das relíquias do mundo.
(function (Aethra) {
    "use strict";

    if (!Aethra?.GameState || !Aethra?.EventBus || !Aethra?.ItemSystem) {
        throw new Error("ItemRankingSystem requer GameState, EventBus e ItemSystem.");
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const round = (value, decimals = 1) => {
        const factor = 10 ** decimals;
        return Math.round(Number(value || 0) * factor) / factor;
    };
    const normalize = (value) => String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    const RARITY_SCORE = {
        common: 0,
        uncommon: 65,
        rare: 155,
        epic: 310,
        legendary: 560,
        mythic: 900
    };

    const STAT_WEIGHTS = {
        damageMin: 15,
        damageMax: 18,
        defense: 13,
        str: 12,
        mag: 12,
        precision: 7,
        critical: 1900,
        evasion: 1700,
        blockChance: 1500,
        blockReduction: 850,
        hpMax: 0.8,
        manaMax: 0.9,
        maxEnergy: 0.65,
        armorPenetration: 1400,
        lifeSteal: 1250
    };

    const CATEGORY_LABELS = {
        sword: "Espadas",
        axe: "Machados",
        mace: "Maças",
        dagger: "Adagas",
        bow: "Arcos",
        focus: "Focos arcanos",
        shield: "Escudos",
        head: "Elmos",
        chest: "Peitorais",
        hands: "Luvas",
        legs: "Perneiras",
        feet: "Botas",
        ring: "Anéis",
        neck: "Amuletos",
        relic: "Relíquias",
        equipment: "Equipamentos"
    };

    const WORLD_OWNERS = [
        "Kael", "Morrigan", "Thorne", "Nyx", "Baldric", "Seraphine",
        "Rurik", "Ilyra", "Darian", "Vesper", "Orion", "Maelis"
    ];
    const RELIC_GRADES = [
        "Recruta", "Vigia", "Ferro", "Fronteira", "Mercenário",
        "Caçador", "Veterano", "Arena", "Rúnico", "Aetheriano"
    ];

    function rarityId(item) {
        const raw = normalize(item?.rarityId || item?.rarity || "common");
        const aliases = {
            comum: "common", incomum: "uncommon", raro: "rare",
            epico: "epic", lendario: "legendary", mitico: "mythic"
        };
        return aliases[raw] || raw || "common";
    }

    function resolveCategory(item = {}) {
        const family = normalize(item.weaponFamily || item.family);
        if (CATEGORY_LABELS[family]) return family;
        const slot = normalize(item.slot || item.allowedSlots?.[0]);
        if (slot === "ring1" || slot === "ring2") return "ring";
        if (CATEGORY_LABELS[slot]) return slot;
        if (normalize(item.type) === "shield") return "shield";
        return item.slot ? "equipment" : null;
    }

    function scoreSpecialties(stats = {}) {
        return Object.entries(stats)
            .map(([stat, raw]) => ({
                stat,
                value: Number(raw || 0),
                score: Math.abs(Number(raw || 0)) * Number(STAT_WEIGHTS[stat] || 2)
            }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
    }

    function rankLabel(rank, total) {
        if (!rank || !total) return "Não ranqueado";
        if (rank <= 3) return `TOP ${rank}`;
        if (rank <= 100) return `#${rank}`;
        const percentile = Math.max(0.1, round((rank / total) * 100, 1));
        return `Top ${percentile}%`;
    }

    Aethra.ItemRankingSystem = {
        initialized: false,
        schemaVersion: 1,
        categoryLabels: CATEGORY_LABELS,
        statWeights: STAT_WEIGHTS,

        ensureState() {
            const state = Aethra.GameState;
            state.world = state.world || {};
            state.world.itemRanking = state.world.itemRanking || {
                schemaVersion: this.schemaVersion,
                registry: {},
                categoryIndexes: {},
                lastIndexedAt: null,
                worldSeeded: false
            };
            return state.world.itemRanking;
        },

        init() {
            if (this.initialized) return this.getStats();
            this.ensureState();
            this.seedWorldRelics();
            this.bindEvents();
            this.rescanOwnedItems();
            this.reindexAll();
            this.initialized = true;
            Aethra.EventBus.emit("item-ranking:ready", this.getStats());
            return this.getStats();
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;
            Aethra.EventBus.on("item:generated", ({ item, options } = {}) => {
                if (item) this.registerItem(item, { source: "generated", ...(options || {}) });
            });
            [
                "itemEquipped", "itemUnequipped", "equipment:changed",
                "inventory:changed", "bag:items-added", "state:restored"
            ].forEach((eventName) => {
                Aethra.EventBus.on(eventName, () => this.rescanOwnedItems());
            });
            ["item:upgraded", "item:enchanted", "item:socket-changed"].forEach((eventName) => {
                Aethra.EventBus.on(eventName, ({ item } = {}) => {
                    if (item) this.registerItem(item, { source: eventName, forceReindex: true });
                });
            });
            Aethra.EventBus.on("item:destroyed", ({ instanceId } = {}) => {
                if (instanceId) this.removeItem(instanceId, "destroyed");
            });
        },

        calculateItemPower(item) {
            if (!item || !resolveCategory(item)) return 0;
            const stats = Aethra.GameData?.calculateItemStats?.(item) || item.stats || {};
            const statScore = Object.entries(stats).reduce((total, [stat, value]) => {
                const weight = Number(STAT_WEIGHTS[stat] || 2);
                return total + Math.abs(Number(value || 0)) * weight;
            }, 0);
            const level = Math.max(1, Number(
                item.levelReq || Aethra.GameData?.items?.[item.templateId]?.levelReq || 1
            ));
            const tier = Math.max(1, Number(item.tier || Aethra.GameData?.items?.[item.templateId]?.tier || 1));
            const rarity = rarityId(item);
            const affixScore = (item.affixes || []).reduce((total, affix) => {
                return total + Math.abs(Number(affix.value || 0)) * Number(STAT_WEIGHTS[affix.stat] || 3) * 0.35;
            }, 0);
            const upgradeLevel = Math.max(0, Number(item.upgrades?.level || item.upgradeLevel || 0));
            const bondLevel = Math.max(0, Number(item.bond?.level || 0));
            const quality = Math.max(0, Number(item.quality || 0));
            const potential = Math.max(0, Number(item.potential || 0));
            return Math.max(1, Math.round(
                statScore +
                level * 42 +
                tier * 58 +
                Number(RARITY_SCORE[rarity] || 0) +
                quality * 1.4 +
                potential * 1.15 +
                affixScore +
                upgradeLevel * 72 +
                bondLevel * 28
            ));
        },

        registerItem(item, options = {}) {
            if (!item?.instanceId || item.stackable || !item.slot) return null;
            const state = this.ensureState();
            const category = resolveCategory(item);
            if (!category) return null;
            const previous = state.registry[item.instanceId] || null;
            const score = this.calculateItemPower(item);
            const ownerName = options.ownerName || item.ownership?.ownerName ||
                Aethra.GameState.hero?.name || "Aventureiro";
            const now = new Date().toISOString();
            const record = {
                instanceId: item.instanceId,
                templateId: item.templateId || item.id || null,
                name: item.name || item.baseName || "Item sem nome",
                category,
                categoryLabel: CATEGORY_LABELS[category] || "Equipamentos",
                score,
                rarityId: rarityId(item),
                rarity: item.rarity || "Comum",
                quality: Number(item.quality || 0),
                potential: Number(item.potential || 0),
                ownerId: options.ownerId || item.ownership?.ownerId || Aethra.GameState.hero?.id || "local-player",
                ownerName,
                createdAt: item.origin?.createdAt || previous?.createdAt || now,
                updatedAt: now,
                source: item.origin?.source || options.source || "unknown",
                stats: clone(Aethra.GameData?.calculateItemStats?.(item) || item.stats || {}),
                specialties: scoreSpecialties(Aethra.GameData?.calculateItemStats?.(item) || item.stats || {}),
                previousRank: previous?.rank || null,
                bestRank: previous?.bestRank || null,
                history: Array.isArray(previous?.history) ? previous.history.slice(-12) : []
            };
            if (previous && previous.score !== score) {
                record.history.push({ type: "power-changed", from: previous.score, to: score, at: now, source: options.source || "update" });
            }
            state.registry[item.instanceId] = record;
            this.reindexCategory(category);
            const ranking = this.getItemRanking(item.instanceId);
            item.worldRanking = ranking ? clone(ranking) : null;
            Aethra.EventBus.emit("item-ranking:updated", { item, ranking });
            if (ranking?.rank === 1 && previous?.rank !== 1) {
                Aethra.EventBus.emit("world:relic-crowned", { item: clone(record), ranking });
            }
            return ranking;
        },

        reindexCategory(category) {
            const state = this.ensureState();
            const entries = Object.values(state.registry)
                .filter((entry) => entry.category === category)
                .sort((a, b) => b.score - a.score || String(a.createdAt).localeCompare(String(b.createdAt)) || a.instanceId.localeCompare(b.instanceId));
            const now = new Date().toISOString();
            let lastScore = null;
            let sharedRank = 0;
            entries.forEach((entry, index) => {
                const oldRank = entry.rank || null;
                if (lastScore !== entry.score) sharedRank = index + 1;
                lastScore = entry.score;
                entry.previousRank = oldRank;
                entry.rank = sharedRank;
                entry.totalInCategory = entries.length;
                entry.percentile = round((sharedRank / Math.max(1, entries.length)) * 100, 1);
                entry.movement = oldRank ? oldRank - sharedRank : 0;
                entry.bestRank = entry.bestRank ? Math.min(entry.bestRank, sharedRank) : sharedRank;
                entry.rankLabel = rankLabel(sharedRank, entries.length);
                entry.rankedAt = now;
            });
            state.categoryIndexes[category] = entries.map((entry) => entry.instanceId);
            state.lastIndexedAt = now;
            return entries;
        },

        reindexAll() {
            const categories = new Set(Object.values(this.ensureState().registry).map((entry) => entry.category));
            categories.forEach((category) => this.reindexCategory(category));
            return this.getStats();
        },

        getItemRanking(itemOrId) {
            const instanceId = typeof itemOrId === "string" ? itemOrId : itemOrId?.instanceId;
            if (!instanceId) return null;
            const entry = this.ensureState().registry[instanceId];
            return entry ? clone({
                instanceId: entry.instanceId,
                score: entry.score,
                category: entry.category,
                categoryLabel: entry.categoryLabel,
                rank: entry.rank,
                total: entry.totalInCategory,
                percentile: entry.percentile,
                movement: entry.movement,
                bestRank: entry.bestRank,
                rankLabel: entry.rankLabel,
                specialties: entry.specialties,
                ownerName: entry.ownerName
            }) : null;
        },

        getLeaderboard(category = "sword", limit = 50) {
            const state = this.ensureState();
            const ids = state.categoryIndexes[category] || [];
            return ids.slice(0, Math.max(1, Number(limit) || 50))
                .map((id) => state.registry[id])
                .filter(Boolean)
                .map(clone);
        },

        getCategories() {
            const state = this.ensureState();
            return Object.entries(state.categoryIndexes)
                .map(([id, ids]) => ({ id, name: CATEGORY_LABELS[id] || id, total: ids.length }))
                .filter((entry) => entry.total > 0)
                .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
        },

        removeItem(instanceId, reason = "removed") {
            const state = this.ensureState();
            const record = state.registry[instanceId];
            if (!record) return false;
            delete state.registry[instanceId];
            this.reindexCategory(record.category);
            Aethra.EventBus.emit("item-ranking:removed", { instanceId, reason, category: record.category });
            return true;
        },

        removeOwnedItems(ownerId = null, reason = "owner-reset") {
            const state = this.ensureState();
            const targetOwnerId = ownerId || Aethra.GameState.hero?.id || "local-player";
            const ownedIds = Object.values(state.registry)
                .filter((entry) => entry.ownerId === targetOwnerId)
                .map((entry) => entry.instanceId);
            ownedIds.forEach((instanceId) => this.removeItem(instanceId, reason));
            return ownedIds.length;
        },

        rescanOwnedItems() {
            const hero = Aethra.GameState.hero || {};
            const equipment = Aethra.GameState.playerEquipment || hero.equipment || {};
            const items = [
                ...(Array.isArray(hero.bag) ? hero.bag : []),
                ...Object.values(equipment).filter(Boolean)
            ];
            const unique = new Map(items.filter((entry) => entry?.instanceId).map((entry) => [entry.instanceId, entry]));
            unique.forEach((entry) => this.registerItem(entry, { source: "owned-rescan", ownerName: hero.name }));
            return unique.size;
        },

        seedWorldRelics() {
            const state = this.ensureState();
            if (state.worldSeeded) return false;
            const categories = ["sword", "axe", "mace", "dagger", "bow", "focus", "shield", "chest", "ring"];
            categories.forEach((category, categoryIndex) => {
                for (let rank = 1; rank <= 18; rank += 1) {
                    const score = Math.max(180, Math.round(1720 - rank * 73 + categoryIndex * 11));
                    const id = `world_${category}_${String(rank).padStart(2, "0")}`;
                    state.registry[id] = {
                        instanceId: id,
                        templateId: null,
                        name: `${CATEGORY_LABELS[category] || "Relíquia"} ${RELIC_GRADES[Math.min(9, Math.max(0, 10 - Math.ceil(rank / 2)))]}`,
                        category,
                        categoryLabel: CATEGORY_LABELS[category],
                        score,
                        rarityId: rank <= 2 ? "legendary" : rank <= 7 ? "epic" : "rare",
                        rarity: rank <= 2 ? "Lendário" : rank <= 7 ? "Épico" : "Raro",
                        quality: Math.max(55, 101 - rank * 2),
                        potential: Math.max(60, 103 - rank),
                        ownerId: `world-player-${categoryIndex}-${rank}`,
                        ownerName: WORLD_OWNERS[(rank + categoryIndex) % WORLD_OWNERS.length],
                        createdAt: new Date(Date.UTC(2026, 6, Math.max(1, 20 - rank))).toISOString(),
                        updatedAt: new Date().toISOString(),
                        source: "world-seed",
                        stats: {},
                        specialties: [],
                        previousRank: null,
                        bestRank: null,
                        history: []
                    };
                }
            });
            state.worldSeeded = true;
            return true;
        },

        getStats() {
            const state = this.ensureState();
            return {
                initialized: this.initialized,
                schemaVersion: this.schemaVersion,
                items: Object.keys(state.registry).length,
                categories: Object.keys(state.categoryIndexes).length,
                lastIndexedAt: state.lastIndexedAt
            };
        }
    };
})(window.Aethra = window.Aethra || {});
