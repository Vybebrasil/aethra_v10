// LootSystem.js
// Economia automatizada de caça baseada no catálogo SRD de monstros.
// Requer game-core.js carregado antes deste arquivo.

window.Aethra = window.Aethra || {};

(function initLootSystem(Aethra) {
    "use strict";

    if (!Aethra.EventBus || !Aethra.Commands || !Aethra.GameState) {
        throw new Error(
            "LootSystem.js requer game-core.js carregado antes deste arquivo."
        );
    }

    const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value || 0)));
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const integer = (value, fallback = 0) => {
        const parsed = Math.floor(Number(value));
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const normalize = (value) => String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    const DEFAULT_LOOT_TEMPLATES = {
        wolf_hide: {
            id: "wolf_hide",
            name: "Couro de Lobo",
            rarity: "Comum",
            type: "material",
            itemType: "MATERIAL",
            price: 12,
            stackable: true,
            maxStack: 999
        },
        crystal_shard: {
            id: "crystal_shard",
            name: "Fragmento de Cristal",
            rarity: "Raro",
            type: "material",
            itemType: "MATERIAL",
            price: 145,
            stackable: true,
            maxStack: 999
        },
        aether_fragment: {
            id: "aether_fragment",
            name: "Fragmento de Éter",
            rarity: "Raro",
            rarityId: "rare",
            type: "material",
            itemType: "MATERIAL",
            price: 28,
            stackable: true,
            maxStack: 999,
            description: "Resíduo de energia obtido em encontros raros."
        },
        potion_health: {
            id: "potion_health",
            name: "Poção de Vida",
            image: "potion_health.png",
            rarity: "Comum",
            type: "consumable",
            itemType: "CONSUMABLE",
            effect: 20,
            healAmount: 20,
            price: 10,
            stackable: true,
            maxStack: 99,
            description: "Recupera 20 pontos de Vida."
        },
        potion_mana: {
            id: "potion_mana",
            name: "Poção de Mana",
            image: "potion_mana.png",
            rarity: "Comum",
            type: "consumable",
            itemType: "CONSUMABLE",
            effect: 20,
            manaAmount: 20,
            price: 12,
            stackable: true,
            maxStack: 99,
            description: "Recupera 20 pontos de Mana."
        },
        monster_core: {
            id: "monster_core",
            name: "Núcleo de Criatura",
            icon: "◈",
            rarity: "Raro",
            type: "material",
            itemType: "MATERIAL",
            price: 75,
            stackable: true,
            maxStack: 999,
            description: "Catalisador de crafting extraído de criaturas poderosas."
        },
        boss_sigil: {
            id: "boss_sigil",
            name: "Selo de Chefe",
            icon: "✹",
            rarity: "Épico",
            type: "material",
            itemType: "MATERIAL",
            price: 260,
            stackable: true,
            maxStack: 999,
            description: "Selo raro utilizado em receitas de equipamento de chefe."
        },
        adult_dragon_heart: {
            id: "adult_dragon_heart",
            name: "Coração de Dragão Adulto",
            icon: "♥",
            rarity: "Lendário",
            type: "material",
            itemType: "MATERIAL",
            price: 1600,
            stackable: true,
            maxStack: 99,
            description: "Componente lendário para forjar artefatos dracônicos."
        },
        ancient_dragon_heart: {
            id: "ancient_dragon_heart",
            name: "Coração de Dragão Ancião",
            icon: "♥",
            rarity: "Lendário",
            type: "material",
            itemType: "MATERIAL",
            price: 5200,
            stackable: true,
            maxStack: 99,
            description: "Coração primordial usado nas receitas mais poderosas de Aethra."
        },
        primordial_dragon_scale: {
            id: "primordial_dragon_scale",
            name: "Escama Dracônica Primordial",
            icon: "◩",
            rarity: "Lendário",
            type: "material",
            itemType: "MATERIAL",
            price: 2400,
            stackable: true,
            maxStack: 999,
            description: "Escama de qualidade lendária para armaduras dracônicas."
        },
        draconic_forge_catalyst: {
            id: "draconic_forge_catalyst",
            name: "Catalisador da Forja Dracônica",
            icon: "✦",
            rarity: "Lendário",
            type: "material",
            itemType: "MATERIAL",
            price: 4000,
            stackable: true,
            maxStack: 99,
            description: "Catalisador usado para despertar itens dracônicos."
        },
        primordial_flame_core: {
            id: "primordial_flame_core",
            name: "Núcleo de Chama Primordial",
            icon: "🔥",
            rarity: "Lendário",
            type: "material",
            itemType: "MATERIAL",
            price: 3200,
            stackable: true,
            maxStack: 99
        },
        primordial_frost_core: {
            id: "primordial_frost_core",
            name: "Núcleo de Geada Primordial",
            icon: "❄",
            rarity: "Lendário",
            type: "material",
            itemType: "MATERIAL",
            price: 3200,
            stackable: true,
            maxStack: 99
        },
        primordial_storm_core: {
            id: "primordial_storm_core",
            name: "Núcleo de Tempestade Primordial",
            icon: "⚡",
            rarity: "Lendário",
            type: "material",
            itemType: "MATERIAL",
            price: 3200,
            stackable: true,
            maxStack: 99
        },
        primordial_acid_core: {
            id: "primordial_acid_core",
            name: "Núcleo de Ácido Primordial",
            icon: "◉",
            rarity: "Lendário",
            type: "material",
            itemType: "MATERIAL",
            price: 3200,
            stackable: true,
            maxStack: 99
        },
        primordial_venom_core: {
            id: "primordial_venom_core",
            name: "Núcleo de Veneno Primordial",
            icon: "☣",
            rarity: "Lendário",
            type: "material",
            itemType: "MATERIAL",
            price: 3200,
            stackable: true,
            maxStack: 99
        },
        orcish_cleaver: {
            id: "orcish_cleaver",
            name: "Cutelo do Batedor",
            image: "sword_iron.png",
            rarity: "Incomum",
            type: "weapon",
            slot: "weapon",
            price: 85,
            stackable: false,
            maxStack: 1,
            stats: { damageMin: 7, damageMax: 13, str: 2 }
        },
        bone_guard: {
            id: "bone_guard",
            name: "Armadura de Ossos",
            rarity: "Raro",
            type: "armor",
            slot: "chest",
            price: 130,
            stackable: false,
            maxStack: 1,
            stats: { defense: 5, hpMax: 12 }
        }
    };

    const ECONOMY_TIERS = [
        {
            id: "T0",
            label: "CR 0–1/4",
            crMax: 0.25,
            xpMax: 50,
            gold: { chance: 0.55, min: 0, max: 2 },
            healthPotionChance: 0.012,
            manaPotionChance: 0.006,
            materialMultiplier: 0.85,
            quantityBonus: 0,
            rareMaterialChance: 0.002
        },
        {
            id: "T1",
            label: "CR 1/2–1",
            crMax: 1,
            xpMax: 200,
            gold: { chance: 0.68, min: 1, max: 4 },
            healthPotionChance: 0.02,
            manaPotionChance: 0.01,
            materialMultiplier: 1,
            quantityBonus: 0,
            rareMaterialChance: 0.004
        },
        {
            id: "T2",
            label: "CR 2–4",
            crMax: 4,
            xpMax: 1100,
            gold: { chance: 0.76, min: 2, max: 8 },
            healthPotionChance: 0.03,
            manaPotionChance: 0.018,
            materialMultiplier: 1.08,
            quantityBonus: 0,
            rareMaterialChance: 0.008
        },
        {
            id: "T3",
            label: "CR 5–8",
            crMax: 8,
            xpMax: 3900,
            gold: { chance: 0.84, min: 5, max: 16 },
            healthPotionChance: 0.04,
            manaPotionChance: 0.026,
            materialMultiplier: 1.16,
            quantityBonus: 1,
            rareMaterialChance: 0.015
        },
        {
            id: "T4",
            label: "CR 9–12",
            crMax: 12,
            xpMax: 8400,
            gold: { chance: 0.9, min: 10, max: 30 },
            healthPotionChance: 0.052,
            manaPotionChance: 0.036,
            materialMultiplier: 1.25,
            quantityBonus: 1,
            rareMaterialChance: 0.026
        },
        {
            id: "T5",
            label: "CR 13–16",
            crMax: 16,
            xpMax: 15000,
            gold: { chance: 0.95, min: 18, max: 52 },
            healthPotionChance: 0.065,
            manaPotionChance: 0.048,
            materialMultiplier: 1.36,
            quantityBonus: 2,
            rareMaterialChance: 0.042
        },
        {
            id: "T6",
            label: "CR 17–20",
            crMax: 20,
            xpMax: 25000,
            gold: { chance: 0.98, min: 32, max: 90 },
            healthPotionChance: 0.08,
            manaPotionChance: 0.062,
            materialMultiplier: 1.48,
            quantityBonus: 3,
            rareMaterialChance: 0.07
        },
        {
            id: "T7",
            label: "CR 21+",
            crMax: Infinity,
            xpMax: Infinity,
            gold: { chance: 1, min: 55, max: 160 },
            healthPotionChance: 0.1,
            manaPotionChance: 0.08,
            materialMultiplier: 1.62,
            quantityBonus: 4,
            rareMaterialChance: 0.11
        }
    ];

    const LEGACY_SPECIAL_TABLES = {
        forest_wolf: [
            { id: "wolf_hide", chance: 0.8, minQuantity: 1, maxQuantity: 2, rarity: "Comum" },
            { id: "crystal_shard", chance: 0.1, minQuantity: 1, maxQuantity: 1, rarity: "Raro" }
        ],
        orc_scout: [
            {
                id: "orcish_cleaver",
                chance: 0.025,
                minQuantity: 1,
                maxQuantity: 1,
                qualityMin: 1,
                qualityMax: 100,
                economyClass: "normal-equipment"
            }
        ],
        skeleton_guard: [
            {
                id: "bone_guard",
                chance: 0.015,
                minQuantity: 1,
                maxQuantity: 1,
                qualityMin: 1,
                qualityMax: 100,
                economyClass: "normal-equipment"
            }
        ]
    };

    const DRAGON_ELEMENTS = {
        red: "primordial_flame_core",
        gold: "primordial_flame_core",
        brass: "primordial_flame_core",
        white: "primordial_frost_core",
        silver: "primordial_frost_core",
        blue: "primordial_storm_core",
        bronze: "primordial_storm_core",
        black: "primordial_acid_core",
        copper: "primordial_acid_core",
        green: "primordial_venom_core"
    };

    const MANUAL_BOSS_OVERRIDES = {
        "adult-brass-dragon-xmm-2024": { age: "adult", element: "brass" },
        "adult-white-dragon-xmm-2024": { age: "adult", element: "white" },
        "adult-black-dragon-xmm-2024": { age: "adult", element: "black" },
        "adult-copper-dragon-xmm-2024": { age: "adult", element: "copper" },
        "adult-bronze-dragon-xmm-2024": { age: "adult", element: "bronze" },
        "adult-green-dragon-xmm-2024": { age: "adult", element: "green" },
        "adult-blue-dragon-xmm-2024": { age: "adult", element: "blue" },
        "adult-silver-dragon-xmm-2024": { age: "adult", element: "silver" },
        "adult-gold-dragon-xmm-2024": { age: "adult", element: "gold" },
        "adult-red-dragon-xmm-2024": { age: "adult", element: "red" },
        "ancient-brass-dragon-xmm-2024": { age: "ancient", element: "brass" },
        "ancient-white-dragon-xmm-2024": { age: "ancient", element: "white" },
        "ancient-copper-dragon-xmm-2024": { age: "ancient", element: "copper" },
        "ancient-black-dragon-xmm-2024": { age: "ancient", element: "black" },
        "ancient-bronze-dragon-xmm-2024": { age: "ancient", element: "bronze" },
        "ancient-green-dragon-xmm-2024": { age: "ancient", element: "green" },
        "ancient-silver-dragon-xmm-2024": { age: "ancient", element: "silver" },
        "ancient-blue-dragon-xmm-2024": { age: "ancient", element: "blue" },
        "ancient-gold-dragon-xmm-2024": { age: "ancient", element: "gold" },
        "ancient-red-dragon-xmm-2024": { age: "ancient", element: "red" }
    };

    function createInstanceId(templateId) {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
            return `item_${templateId}_${window.crypto.randomUUID()}`;
        }
        return `item_${templateId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }

    Aethra.ItemTemplates = {
        ...DEFAULT_LOOT_TEMPLATES,
        ...(Aethra.ItemTemplates || {})
    };

    Aethra.LootSystem = {
        initialized: false,
        tables: clone(LEGACY_SPECIAL_TABLES),
        economyProfiles: new Map(),
        randomSource: Math.random,
        schemaVersion: 2,
        economyTiers: ECONOMY_TIERS,
        bossOverrides: MANUAL_BOSS_OVERRIDES,
        metrics: {
            compiledProfiles: 0,
            killsProcessed: 0,
            goldGenerated: 0,
            lootValueGenerated: 0,
            itemsGenerated: 0,
            bossOverridesTriggered: 0
        },

        init() {
            if (this.initialized) return this.getStats();
            this.registerDefaultTemplates();
            this.bindEvents();
            this.rebuildCatalogEconomy();
            this.initialized = true;
            Aethra.EventBus.emit("loot:economy-ready", this.getStats());
            return this.getStats();
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;
            Aethra.EventBus.on("monster-catalog:ready", () => this.rebuildCatalogEconomy());
            Aethra.EventBus.on("gamedata:creature-registered", ({ creatureId } = {}) => {
                if (creatureId) this.invalidateProfile(creatureId);
            });
            Aethra.EventBus.on("loot:table-registered", ({ enemyId } = {}) => {
                if (enemyId) this.invalidateProfile(enemyId);
            });
        },

        registerDefaultTemplates() {
            Object.entries(DEFAULT_LOOT_TEMPLATES).forEach(([id, template]) => {
                Aethra.ItemTemplates[id] = { ...(Aethra.ItemTemplates[id] || {}), ...template, id };
                if (Aethra.GameData?.items) {
                    Aethra.GameData.items[id] = { ...(Aethra.GameData.items[id] || {}), ...template, id };
                }
            });
            Aethra.ItemSystem?.syncFromGameData?.();
        },

        setRandomSource(fn) {
            if (typeof fn !== "function") {
                throw new TypeError("LootSystem.setRandomSource: fn deve ser uma função.");
            }
            this.randomSource = fn;
        },

        registerTemplate(templateId, template) {
            if (typeof templateId !== "string" || !templateId.trim()) {
                throw new TypeError("LootSystem.registerTemplate: templateId inválido.");
            }
            if (!template || typeof template !== "object") {
                throw new TypeError("LootSystem.registerTemplate: template inválido.");
            }
            Aethra.ItemTemplates[templateId] = { id: templateId, ...template };
            if (Aethra.GameData?.items) {
                Aethra.GameData.items[templateId] = {
                    ...(Aethra.GameData.items[templateId] || {}),
                    id: templateId,
                    ...template
                };
            }
            Aethra.EventBus.emit("loot:template-registered", {
                templateId,
                template: Aethra.ItemTemplates[templateId]
            });
            return Aethra.ItemTemplates[templateId];
        },

        registerTable(enemyId, drops) {
            if (typeof enemyId !== "string" || !enemyId.trim()) {
                throw new TypeError("LootSystem.registerTable: enemyId inválido.");
            }
            if (!Array.isArray(drops)) {
                throw new TypeError("LootSystem.registerTable: drops deve ser um array.");
            }
            this.tables[enemyId] = drops.map((drop) => ({ ...drop }));
            this.invalidateProfile(enemyId);
            Aethra.EventBus.emit("loot:table-registered", {
                enemyId,
                drops: this.tables[enemyId]
            });
            return this.tables[enemyId];
        },

        invalidateProfile(enemyId) {
            this.economyProfiles.delete(enemyId);
            const creature = Aethra.GameData?.creatures?.[enemyId];
            if (creature?.catalogId) this.economyProfiles.delete(creature.catalogId);
        },

        parseChallengeRating(value) {
            if (Aethra.CreatureBalanceConfig?.parseChallengeRating) {
                return Aethra.CreatureBalanceConfig.parseChallengeRating(value);
            }
            const source = String(value ?? "0");
            if (source.includes("/")) {
                const [a, b] = source.split("/").map(Number);
                return b ? a / b : 0;
            }
            const parsed = Number(source);
            return Number.isFinite(parsed) ? parsed : 0;
        },

        resolveMonster(enemyId) {
            const direct = Aethra.GameData?.creatures?.[enemyId] || Aethra.MonsterCatalog?.get?.(enemyId);
            return direct ? clone(direct) : null;
        },

        resolveTier(monster = {}) {
            const cr = this.parseChallengeRating(
                monster.challengeRatingValue ?? monster.challengeRating ?? monster.challenge_rating
            );
            const sourceXp = Math.max(0, Number(
                monster.sourceStats?.xp ?? monster.sourceXp ?? monster.catalogXp ?? 0
            ));
            const tier = ECONOMY_TIERS.find((entry) => {
                if (Number.isFinite(cr) && cr > 0) return cr <= entry.crMax;
                return sourceXp <= entry.xpMax;
            }) || ECONOMY_TIERS.at(-1);
            return { ...tier, cr, sourceXp };
        },

        getDragonOverride(enemyId, monster = {}) {
            const catalogId = monster.catalogId || monster.sourceId || enemyId;
            const explicit = MANUAL_BOSS_OVERRIDES[catalogId] || MANUAL_BOSS_OVERRIDES[enemyId];
            if (explicit) return explicit;
            const name = normalize(`${monster.slug || ""} ${monster.name || ""}`);
            if (String(monster.type || "").toLowerCase() !== "dragon") return null;
            const age = name.includes("ancient") || name.includes("anciao") ? "ancient"
                : name.includes("adult") || name.includes("adulto") ? "adult"
                    : null;
            if (!age) return null;
            const element = Object.keys(DRAGON_ELEMENTS).find((key) => name.includes(key)) || "red";
            return { age, element };
        },

        normalizeDrop(drop = {}) {
            return {
                id: drop.id || drop.templateId,
                chance: clamp(drop.chance, 0, 1),
                minQuantity: Math.max(1, integer(drop.minQuantity ?? drop.min, 1)),
                maxQuantity: Math.max(1, integer(drop.maxQuantity ?? drop.max ?? drop.minQuantity ?? drop.min, 1)),
                rarity: drop.rarity,
                forceRarity: drop.forceRarity === true,
                qualityMin: drop.qualityMin,
                qualityMax: drop.qualityMax,
                guaranteed: drop.guaranteed === true,
                sourceClass: drop.sourceClass || "material"
            };
        },

        buildBaseDrops(enemyId, monster, tier) {
            const sourceTable = Array.isArray(this.tables[enemyId]) && this.tables[enemyId].length
                ? this.tables[enemyId]
                : Array.isArray(monster.lootTable) && monster.lootTable.length
                    ? monster.lootTable
                    : Aethra.LootProfileRegistry?.buildLootTable?.(monster) || [];

            return sourceTable
                .map((drop) => this.normalizeDrop(drop))
                .filter((drop) => drop.id)
                .map((drop, index) => ({
                    ...drop,
                    chance: clamp(drop.chance * tier.materialMultiplier, 0, index === 0 ? 0.92 : 0.72),
                    maxQuantity: Math.max(drop.minQuantity, drop.maxQuantity + (index === 0 ? tier.quantityBonus : Math.floor(tier.quantityBonus / 2))),
                    sourceClass: drop.sourceClass || "family-material"
                }));
        },

        buildBossDrops(monster, tier) {
            const rank = String(monster.rank || "normal").toLowerCase();
            if (!["boss", "legendary"].includes(rank)) return [];
            return [
                {
                    id: "boss_sigil",
                    chance: rank === "legendary" ? 0.24 : 0.12,
                    minQuantity: 1,
                    maxQuantity: tier.id === "T7" ? 2 : 1,
                    rarity: "Épico",
                    sourceClass: "boss-material"
                },
                {
                    id: "monster_core",
                    chance: rank === "legendary" ? 0.42 : 0.22,
                    minQuantity: 1,
                    maxQuantity: Math.max(1, Math.floor(tier.quantityBonus / 2) + 1),
                    rarity: "Raro",
                    sourceClass: "boss-material"
                }
            ];
        },

        buildDragonDrops(enemyId, monster, tier) {
            const override = this.getDragonOverride(enemyId, monster);
            if (!override) return { drops: [], goldMultiplier: 1, override: null };
            const ancient = override.age === "ancient";
            const elementCore = DRAGON_ELEMENTS[override.element] || "primordial_flame_core";
            const drops = ancient
                ? [
                    { id: "dragon_scale", chance: 1, guaranteed: true, minQuantity: 6, maxQuantity: 12, rarity: "Raro", sourceClass: "dragon-guaranteed" },
                    { id: "draconic_essence", chance: 0.7, minQuantity: 2, maxQuantity: 5, rarity: "Épico", sourceClass: "dragon-crafting" },
                    { id: "primordial_dragon_scale", chance: 0.03, minQuantity: 1, maxQuantity: 1, rarity: "Lendário", sourceClass: "dragon-legendary" },
                    { id: "ancient_dragon_heart", chance: 0.015, minQuantity: 1, maxQuantity: 1, rarity: "Lendário", sourceClass: "dragon-legendary" },
                    { id: elementCore, chance: 0.005, minQuantity: 1, maxQuantity: 1, rarity: "Lendário", sourceClass: "dragon-element" },
                    { id: "draconic_forge_catalyst", chance: 0.0008, minQuantity: 1, maxQuantity: 1, rarity: "Lendário", sourceClass: "dragon-jackpot" }
                ]
                : [
                    { id: "dragon_scale", chance: 1, guaranteed: true, minQuantity: 3, maxQuantity: 7, rarity: "Raro", sourceClass: "dragon-guaranteed" },
                    { id: "draconic_essence", chance: 0.38, minQuantity: 1, maxQuantity: 3, rarity: "Épico", sourceClass: "dragon-crafting" },
                    { id: "adult_dragon_heart", chance: 0.008, minQuantity: 1, maxQuantity: 1, rarity: "Lendário", sourceClass: "dragon-legendary" },
                    { id: elementCore, chance: 0.002, minQuantity: 1, maxQuantity: 1, rarity: "Lendário", sourceClass: "dragon-element" },
                    { id: "draconic_forge_catalyst", chance: 0.00025, minQuantity: 1, maxQuantity: 1, rarity: "Lendário", sourceClass: "dragon-jackpot" }
                ];
            return {
                drops: drops.map((drop) => this.normalizeDrop(drop)),
                goldMultiplier: ancient ? 4 : 2.35,
                override: { ...override, catalogId: monster.catalogId || monster.sourceId || enemyId }
            };
        },

        compileMonsterProfile(enemyId) {
            const monster = this.resolveMonster(enemyId);
            if (!monster) return null;
            const tier = this.resolveTier(monster);
            const rank = String(monster.rank || "normal").toLowerCase();
            const rankGoldMultiplier = rank === "legendary" ? 2.5 : rank === "boss" ? 1.8 : rank === "elite" ? 1.25 : 1;
            const familyDrops = this.buildBaseDrops(enemyId, monster, tier);
            const dragon = this.buildDragonDrops(enemyId, monster, tier);
            const drops = [
                ...familyDrops,
                {
                    id: "potion_health",
                    chance: tier.healthPotionChance,
                    minQuantity: 1,
                    maxQuantity: tier.id === "T7" ? 2 : 1,
                    rarity: "Comum",
                    sourceClass: "potion"
                },
                {
                    id: "potion_mana",
                    chance: tier.manaPotionChance,
                    minQuantity: 1,
                    maxQuantity: tier.id === "T7" ? 2 : 1,
                    rarity: "Comum",
                    sourceClass: "potion"
                },
                {
                    id: "aether_fragment",
                    chance: tier.rareMaterialChance,
                    minQuantity: 1,
                    maxQuantity: tier.quantityBonus >= 3 ? 2 : 1,
                    rarity: "Raro",
                    sourceClass: "rare-material"
                },
                ...(tier.cr >= 2 ? [{
                    id: "monster_core",
                    chance: tier.rareMaterialChance * 0.42,
                    minQuantity: 1,
                    maxQuantity: tier.id === "T7" ? 2 : 1,
                    rarity: "Raro",
                    sourceClass: "rare-material"
                }] : []),
                ...this.buildBossDrops(monster, tier),
                ...dragon.drops
            ].map((drop) => this.normalizeDrop(drop));

            const goldMultiplier = rankGoldMultiplier * dragon.goldMultiplier;
            const profile = {
                enemyId,
                catalogId: monster.catalogId || monster.sourceId || enemyId,
                monsterName: monster.name || enemyId,
                monsterType: monster.type || "unknown",
                rank,
                tierId: tier.id,
                tierLabel: tier.label,
                cr: tier.cr,
                sourceXp: tier.sourceXp,
                gold: {
                    chance: rank === "boss" || rank === "legendary" || dragon.override ? 1 : tier.gold.chance,
                    min: Math.max(0, Math.round(tier.gold.min * goldMultiplier)),
                    max: Math.max(1, Math.round(tier.gold.max * goldMultiplier))
                },
                drops,
                override: dragon.override,
                compiledAt: Date.now()
            };
            this.economyProfiles.set(enemyId, profile);
            if (profile.catalogId !== enemyId) this.economyProfiles.set(profile.catalogId, profile);
            return profile;
        },

        getEconomyProfile(enemyId) {
            if (!enemyId) return null;
            return this.economyProfiles.get(enemyId) || this.compileMonsterProfile(enemyId);
        },

        rebuildCatalogEconomy() {
            this.economyProfiles.clear();
            let compiled = 0;
            Object.entries(Aethra.GameData?.creatures || {}).forEach(([enemyId, monster]) => {
                if (!monster || (!monster.catalogSource && !LEGACY_SPECIAL_TABLES[enemyId])) return;
                if (this.compileMonsterProfile(enemyId)) compiled += 1;
            });
            this.metrics.compiledProfiles = compiled;
            Aethra.EventBus.emit("loot:economy-catalog-built", {
                compiled,
                tiers: ECONOMY_TIERS.length,
                bossOverrides: Object.keys(MANUAL_BOSS_OVERRIDES).length
            });
            return compiled;
        },

        createInstance(templateId, options = {}) {
            const template = (Aethra.ItemTemplates || window.ITEMS || {})[templateId];
            if (!template) {
                Aethra.EventBus.emit("loot:error", { code: "TEMPLATE_NOT_FOUND", templateId });
                return null;
            }
            const qualityMin = Number.isFinite(options.qualityMin) ? options.qualityMin : 70;
            const qualityMax = Number.isFinite(options.qualityMax) ? options.qualityMax : 100;
            const qualityRoll = Math.floor(this.randomSource() * (qualityMax - qualityMin + 1)) + qualityMin;
            const potentialRoll = Number.isFinite(options.potential) ? options.potential : Math.floor(this.randomSource() * 101);
            const quantity = clamp(Number.isFinite(options.quantity) ? options.quantity : 1, 1, template.maxStack || 999);
            const basePrice = Number(template.price) || 0;
            const instance = {
                instanceId: createInstanceId(templateId),
                templateId,
                name: template.name || templateId,
                type: template.type || "misc",
                itemType: template.itemType || String(template.type || "MISC").toUpperCase(),
                slot: template.slot || null,
                rarity: options.rarity || template.rarity || "Comum",
                quality: qualityRoll,
                potential: potentialRoll,
                quantity,
                stackable: Boolean(template.stackable),
                maxStack: template.maxStack || 1,
                price: Math.max(0, Math.floor(basePrice * (qualityRoll / 100))),
                basePrice,
                stats: template.stats ? { ...template.stats } : {},
                affixes: Array.isArray(options.affixes) ? [...options.affixes] : [],
                origin: {
                    source: options.source || "loot",
                    enemyId: options.enemyId || null,
                    huntId: options.huntId || null,
                    economyTier: options.economyTier || null,
                    obtainedAt: new Date().toISOString()
                },
                bond: { level: 0, xp: 0 },
                history: []
            };
            Aethra.EventBus.emit("loot:instance-created", { item: instance });
            return instance;
        },

        rollQuantity(drop, multiplier = 1) {
            const safeMultiplier = Math.max(0, Number(multiplier || 0));
            const min = Math.max(1, integer(drop.minQuantity, 1));
            const max = Math.max(min, integer(drop.maxQuantity, min));
            const rolled = Math.floor(this.randomSource() * (max - min + 1)) + min;
            if (safeMultiplier <= 0) return 0;
            const scaled = rolled * safeMultiplier;
            const floor = Math.floor(scaled);
            return Math.max(1, floor + (this.randomSource() < scaled - floor ? 1 : 0));
        },

        rollGold(goldProfile = {}, multiplier = 1) {
            const safeMultiplier = Math.max(0, Number(multiplier || 0));
            if (safeMultiplier <= 0 || this.randomSource() > clamp(goldProfile.chance, 0, 1)) return 0;
            const min = Math.max(0, integer(goldProfile.min, 0));
            const max = Math.max(min, integer(goldProfile.max, min));
            const rolled = Math.floor(this.randomSource() * (max - min + 1)) + min;
            return Math.max(0, Math.round(rolled * safeMultiplier));
        },

        rollItems(profile, context = {}) {
            const results = [];
            const materialChanceMultiplier = Math.max(0, Number(context.materialChanceMultiplier ?? 1));
            const quantityMultiplier = Math.max(0, Number(context.quantityMultiplier ?? 1));
            const rareDropMultiplier = clamp(Number(context.rareDropMultiplier ?? 1), 0, 1.25);
            const materialClasses = new Set(["material", "family-material"]);
            const protectedClasses = new Set(["rare-material", "boss-material", "dragon-crafting", "dragon-legendary", "dragon-element", "dragon-jackpot"]);

            (profile?.drops || []).forEach((drop) => {
                const sourceClass = String(drop.sourceClass || "material");
                const chanceMultiplier = materialClasses.has(sourceClass)
                    ? materialChanceMultiplier
                    : protectedClasses.has(sourceClass)
                        ? rareDropMultiplier
                        : 1;
                const effectiveChance = clamp(Number(drop.chance || 0) * chanceMultiplier, 0, drop.guaranteed ? 1 : 0.96);
                if (!drop.guaranteed && this.randomSource() > effectiveChance) return;
                const template = Aethra.ItemTemplates?.[drop.id] || Aethra.GameData?.items?.[drop.id] || {};
                const isEquipment = Boolean(template.slot && !template.stackable);
                const rolledRarity = isEquipment
                    ? (drop.forceRarity && drop.rarity
                        ? drop.rarity
                        : Aethra.EconomyRNGManager?.rollEquipmentRarity?.({ source: context.source || "monster-economy" }) || drop.rarity || template.rarity || "Comum")
                    : (drop.rarity || template.rarity || "Comum");
                const appliesQuantityFocus = materialClasses.has(sourceClass) && !isEquipment;
                const quantity = this.rollQuantity(drop, appliesQuantityFocus ? quantityMultiplier : 1);
                if (quantity <= 0) return;
                const item = this.createInstance(drop.id, {
                    quantity,
                    rarity: rolledRarity,
                    enemyId: profile.enemyId,
                    huntId: context.huntId || null,
                    source: context.source || "monster-economy",
                    qualityMin: drop.qualityMin,
                    qualityMax: drop.qualityMax,
                    tradeClass: isEquipment ? "individual" : "stackable",
                    economyRollId: context.economyRollId || null,
                    economyTier: profile.tierId
                });
                if (item) results.push(item);
            });
            return results;
        },

        summarizeItems(items = []) {
            return (Array.isArray(items) ? items : []).reduce((summary, item) => {
                const quantity = Math.max(1, integer(item?.quantity, 1));
                const unitValue = Math.max(0, integer(item?.price ?? item?.value ?? item?.basePrice, 0));
                summary.lootCount += quantity;
                summary.lootValue += unitValue * quantity;
                return summary;
            }, { lootCount: 0, lootValue: 0 });
        },

        processMonsterDefeat(enemyId, context = {}) {
            const profile = this.getEconomyProfile(enemyId);
            if (!profile) {
                return { enemyId, gold: 0, items: [], lootCount: 0, lootValue: 0, profile: null };
            }
            const gold = context.includeGold === false
                ? 0
                : this.rollGold(profile.gold, Math.max(0, Number(context.goldMultiplier ?? 1)));
            const items = this.rollItems(profile, context);
            const summary = this.summarizeItems(items);
            const result = {
                enemyId,
                huntId: context.huntId || null,
                encounterId: context.encounterId || null,
                gold,
                items,
                ...summary,
                profile: {
                    tierId: profile.tierId,
                    tierLabel: profile.tierLabel,
                    cr: profile.cr,
                    rank: profile.rank,
                    override: profile.override ? clone(profile.override) : null,
                    focusId: context.focusId || null,
                    goldMultiplier: Math.max(0, Number(context.goldMultiplier ?? 1)),
                    materialChanceMultiplier: Math.max(0, Number(context.materialChanceMultiplier ?? 1)),
                    quantityMultiplier: Math.max(0, Number(context.quantityMultiplier ?? 1))
                },
                generatedAt: new Date().toISOString(),
                economy: {
                    authority: Aethra.EconomyRNGManager?.config?.authority || "client-prototype",
                    schemaVersion: this.schemaVersion,
                    eligible: true
                }
            };

            this.metrics.killsProcessed += 1;
            this.metrics.goldGenerated += gold;
            this.metrics.lootValueGenerated += summary.lootValue;
            this.metrics.itemsGenerated += summary.lootCount;
            if (profile.override) this.metrics.bossOverridesTriggered += 1;

            Aethra.EventBus.emit("loot:generated", clone(result));
            Aethra.EventBus.emit("loot:economy-processed", clone(result));
            if (items.length > 0) Aethra.EventBus.emit("itemObtained", items);
            return result;
        },

        // Compatibilidade: sistemas antigos esperam somente o array de itens.
        generateLoot(enemyId, context = {}) {
            return this.processMonsterDefeat(enemyId, {
                ...context,
                includeGold: false
            }).items;
        },

        getEconomyPreview(enemyId) {
            const profile = this.getEconomyProfile(enemyId);
            if (!profile) return null;
            return {
                enemyId,
                monsterName: profile.monsterName,
                tierId: profile.tierId,
                tierLabel: profile.tierLabel,
                cr: profile.cr,
                rank: profile.rank,
                gold: clone(profile.gold),
                override: profile.override ? clone(profile.override) : null,
                drops: profile.drops.map((drop) => {
                    const template = Aethra.ItemTemplates?.[drop.id] || Aethra.GameData?.items?.[drop.id] || {};
                    return {
                        templateId: drop.id,
                        name: template.name || drop.id,
                        icon: template.icon || "◆",
                        rarity: drop.rarity || template.rarity || "Comum",
                        chance: drop.guaranteed ? 1 : drop.chance,
                        guaranteed: drop.guaranteed,
                        min: drop.minQuantity,
                        max: drop.maxQuantity,
                        value: Number(template.price ?? template.value ?? template.basePrice ?? 0),
                        sourceClass: drop.sourceClass
                    };
                })
            };
        },

        getStats() {
            return {
                initialized: this.initialized,
                schemaVersion: this.schemaVersion,
                cachedProfiles: this.economyProfiles.size,
                tiers: ECONOMY_TIERS.length,
                bossOverrides: Object.keys(MANUAL_BOSS_OVERRIDES).length,
                templates: Object.keys(Aethra.ItemTemplates || {}).length,
                ...clone(this.metrics)
            };
        }
    };

    Aethra.LootSystem.bindEvents();
    Aethra.LootSystem.registerDefaultTemplates();

    Aethra.EventBus.emit("loot:ready", {
        tables: Object.keys(Aethra.LootSystem.tables),
        templates: Object.keys(Aethra.ItemTemplates),
        schemaVersion: Aethra.LootSystem.schemaVersion
    });
})(window.Aethra);
