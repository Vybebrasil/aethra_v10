// EarlyGameItemCatalog.js - banco oficial de itens e drops dos níveis 1–10.
(function (Aethra) {
    "use strict";

    if (!Aethra?.GameData || !Aethra?.EventBus) {
        throw new Error("EarlyGameItemCatalog requer GameData e EventBus.");
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const normalize = (value) => String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    const LEVEL_NAMES = [
        "Recruta", "Vigia", "Ferro", "Fronteira", "Mercenário",
        "Caçador", "Veterano", "Arena", "Rúnico", "Aetheriano"
    ];

    const WEAPON_FAMILIES = {
        sword: { name: "Espada", icon: "⚔", damage: 1, precision: 1, critical: 0 },
        axe: { name: "Machado", icon: "◩", damage: 1.15, precision: 0, critical: 0.006 },
        mace: { name: "Maça", icon: "✣", damage: 1.08, precision: 0, defense: 1 },
        dagger: { name: "Adaga", icon: "†", damage: 0.82, precision: 2, critical: 0.012 },
        bow: { name: "Arco", icon: "➶", damage: 0.92, precision: 3, critical: 0.004 },
        focus: { name: "Foco", icon: "✦", damage: 0.78, precision: 1, mag: 2 }
    };

    const ARMOR_PIECES = {
        head: { name: "Elmo", icon: "⌃", defense: 0.68, hp: 1.2 },
        chest: { name: "Peitoral", icon: "▣", defense: 1.35, hp: 3.2 },
        hands: { name: "Luvas", icon: "✥", defense: 0.52, hp: 0.8, precision: 1 },
        legs: { name: "Perneiras", icon: "Ⅱ", defense: 0.92, hp: 2.1 },
        feet: { name: "Botas", icon: "⌄", defense: 0.48, hp: 0.8, evasion: 0.003 }
    };

    const ARMOR_CLASSES = {
        cloth: { name: "de Tecido", defMultiplier: 0.5, bonusName: "mag", bonusVal: 0.6, bonusHp: 0.8 },
        leather: { name: "de Couro", defMultiplier: 0.8, bonusName: "evasion", bonusVal: 0.0006, bonusHp: 1.0 },
        plate: { name: "de Placa", defMultiplier: 1.3, bonusName: "str", bonusVal: 0.5, bonusHp: 1.4 }
    };

    const FAMILY_MATERIALS = {
        beast: ["beast_hide", "raw_meat", "monster_fang"],
        monstrosity: ["monster_fang", "beast_hide", "aether_fragment"],
        humanoid: ["cloth_scrap", "weapon_fragment", "iron_ore"],
        undead: ["bone_fragment", "grave_dust", "ectoplasm"],
        construct: ["iron_ore", "weapon_fragment", "arcane_core"],
        plant: ["wild_herb", "ancient_resin", "aether_fragment"],
        dragon: ["dragon_scale", "draconic_essence", "aether_fragment"],
        fiend: ["infernal_ash", "demon_ichor", "aether_fragment"],
        elemental: ["elemental_mote", "arcane_core", "aether_fragment"],
        fey: ["fey_dust", "wild_herb", "aether_fragment"],
        aberration: ["aberrant_tissue", "psychic_residue", "aether_fragment"],
        celestial: ["radiant_essence", "arcane_core", "aether_fragment"],
        ooze: ["alchemical_slime", "aether_fragment", "wild_herb"],
        default: ["bone_fragment", "cloth_scrap", "aether_fragment"]
    };

    const EXTRA_MATERIALS = {
        chipped_claw: ["Garra Lascada", "◢", 3, "Comum"],
        coarse_fur: ["Pelagem Áspera", "▧", 4, "Comum"],
        venom_sac: ["Bolsa de Veneno", "☣", 9, "Incomum"],
        goblin_token: ["Marca Goblin", "●", 7, "Comum"],
        shadow_thread: ["Fio Sombrio", "≋", 18, "Incomum"],
        ember_gland: ["Glândula de Brasa", "♨", 21, "Incomum"],
        frost_crystal: ["Cristal de Geada", "❄", 22, "Incomum"],
        arena_badge: ["Insígnia de Arena", "◆", 35, "Raro"]
    };

    const templates = {};
    const item = (id, data) => {
        templates[id] = { id, ...data };
        return templates[id];
    };

    Object.entries(EXTRA_MATERIALS).forEach(([id, [name, icon, price, rarity]]) => {
        item(id, {
            name, icon, price, value: price, rarity,
            type: "material", itemType: "MATERIAL", stackable: true, maxStack: 999,
            description: "Componente de criação encontrado nas regiões iniciais de Aethra."
        });
    });

    [
        ["iron_ore", "Minério de Ferro", "⬟", 5, "Rocha bruta usada na fundição."],
        ["refined_ingot", "Lingote de Ferro", "▰", 14, "Metal refinado para armas e armaduras."],
        ["beast_hide", "Pele de Fera", "◒", 6, "Pele bruta obtida por Esfolamento."],
        ["treated_leather", "Couro Tratado", "▧", 16, "Couro curtido pronto para criação."],
        ["wild_herb", "Erva Silvestre", "❧", 4, "Reagente colhido por Herbalismo."],
        ["trap_components", "Componentes de Armadilha", "⚙", 12, "Peças recuperadas de um mecanismo desarmado."]
    ].forEach(([id, name, icon, price, description]) => item(id, {
        name, icon, price, value: price, description,
        rarity: "Comum", type: "material", itemType: "MATERIAL", stackable: true, maxStack: 999
    }));

    [
        ["apprentice_pickaxe", "Picareta de Aprendiz", "⛏", "Permite extrair veios de minério."],
        ["skinning_knife", "Faca de Esfolamento", "†", "Permite extrair pele de criaturas derrotadas."],
        ["herb_knife", "Foice de Herbalista", "❧", "Permite colher ervas sem danificar seus reagentes."],
        ["smith_hammer", "Martelo de Aprendiz", "⚒", "Ferramenta de orientação para seu primeiro trabalho na forja."]
    ].forEach(([id, name, icon, description]) => item(id, {
        name, icon, description, price: 0, value: 0,
        rarity: "Comum", type: "tool", itemType: "TOOL", stackable: false, maxStack: 1, tradeable: false
    }));

    [
        ["ancient_token", "Símbolo Antigo", "✦", 18, "Raro"],
        ["thieves_mark", "Marca dos Ladrões", "⚿", 34, "Raro"],
        ["hidden_map_fragment", "Fragmento de Mapa Oculto", "⌖", 85, "Épico"]
    ].forEach(([id, name, icon, price, rarity]) => item(id, {
        name, icon, price, value: price, rarity,
        type: "loot", itemType: "LOOT", stackable: true, maxStack: 999,
        description: "Achado especial de exploração; pode ser negociado ou usado em conteúdo futuro."
    }));

    item("minor_vigor_tonic", {
        name: "Tônico Menor de Vigor", icon: "⚡", price: 12, value: 12,
        rarity: "Comum", type: "consumable", itemType: "CONSUMABLE",
        effect: 18, energyAmount: 18, stackable: true, maxStack: 99,
        description: "Recupera 18 de Vigor."
    });
    item("field_antidote", {
        name: "Antídoto de Campanha", icon: "+", price: 18, value: 18,
        rarity: "Incomum", type: "consumable", itemType: "CONSUMABLE",
        effect: "cleanse_poison", stackable: true, maxStack: 99,
        description: "Remove veneno e reduz sua duração nas próximas duas rodadas."
    });

    // ── Suprimentos iniciais (usados por CharacterBuildSystem.createCharacter) ──
    item("potion_health", {
        name: "Poção de Vida", icon: "🧪", price: 10, value: 10,
        rarity: "Comum", type: "consumable", itemType: "CONSUMABLE",
        healAmount: 20, stackable: true, maxStack: 99,
        description: "Recupera 20 de HP. Item inicial de todo aventureiro."
    });
    item("potion_mana", {
        name: "Poção de Mana", icon: "💧", price: 18, value: 18,
        rarity: "Comum", type: "consumable", itemType: "CONSUMABLE",
        manaAmount: 25, stackable: true, maxStack: 99,
        description: "Restaura 25 de Mana. Essencial para arcanistas."
    });

    // ── Armas de treino iniciais por arquétipo ────────────────────────────────
    item("training_sword", {
        name: "Espada de Treino", icon: "⚔", price: 0, value: 0,
        rarity: "Comum", type: "weapon", itemType: "WEAPON",
        slot: "weapon", weaponFamily: "sword",
        baseStats: { damageMin: 4, damageMax: 8, precision: 1 },
        stats:     { damageMin: 4, damageMax: 8, precision: 1 },
        levelReq: 1, stackable: false, maxStack: 1,
        description: "Espada de madeira reforçada. Item de iniciante vinculado ao herói."
    });
    item("training_axe", {
        name: "Machado de Treino", icon: "◩", price: 0, value: 0,
        rarity: "Comum", type: "weapon", itemType: "WEAPON",
        slot: "weapon", weaponFamily: "axe",
        baseStats: { damageMin: 5, damageMax: 10, critical: 0.04 },
        stats:     { damageMin: 5, damageMax: 10, critical: 0.04 },
        levelReq: 1, stackable: false, maxStack: 1,
        description: "Machado pesado de treino. Item de iniciante vinculado ao herói."
    });
    item("training_mace", {
        name: "Maça de Treino", icon: "✣", price: 0, value: 0,
        rarity: "Comum", type: "weapon", itemType: "WEAPON",
        slot: "weapon", weaponFamily: "mace",
        baseStats: { damageMin: 4, damageMax: 9, defense: 1 },
        stats:     { damageMin: 4, damageMax: 9, defense: 1 },
        levelReq: 1, stackable: false, maxStack: 1,
        description: "Maça de madeira pesada. Item de iniciante vinculado ao herói."
    });
    item("training_dagger", {
        name: "Adaga de Treino", icon: "†", price: 0, value: 0,
        rarity: "Comum", type: "weapon", itemType: "WEAPON",
        slot: "weapon", weaponFamily: "dagger",
        baseStats: { damageMin: 3, damageMax: 7, precision: 2, critical: 0.06 },
        stats:     { damageMin: 3, damageMax: 7, precision: 2, critical: 0.06 },
        levelReq: 1, stackable: false, maxStack: 1,
        description: "Adaga fina de prática. Item de iniciante vinculado ao herói."
    });
    item("training_bow", {
        name: "Arco de Treino", icon: "➶", price: 0, value: 0,
        rarity: "Comum", type: "weapon", itemType: "WEAPON",
        slot: "weapon", weaponFamily: "bow",
        baseStats: { damageMin: 4, damageMax: 8, precision: 3 },
        stats:     { damageMin: 4, damageMax: 8, precision: 3 },
        levelReq: 1, stackable: false, maxStack: 1,
        description: "Arco de cipó resistente. Item de iniciante vinculado ao herói."
    });
    item("novice_focus", {
        name: "Foco de Novato", icon: "✦", price: 0, value: 0,
        rarity: "Comum", type: "weapon", itemType: "WEAPON",
        slot: "weapon", weaponFamily: "focus",
        baseStats: { damageMin: 3, damageMax: 6, mag: 3, precision: 1 },
        stats:     { damageMin: 3, damageMax: 6, mag: 3, precision: 1 },
        levelReq: 1, stackable: false, maxStack: 1,
        description: "Orbe canalizado para iniciantes em magia. Item de iniciante vinculado ao herói."
    });

    for (let level = 1; level <= 10; level += 1) {
        const grade = LEVEL_NAMES[level - 1];
        const tier = Math.ceil(level / 2);

        Object.entries(WEAPON_FAMILIES).forEach(([family, definition]) => {
            const base = 2.4 + level * 1.45;
            const average = base * definition.damage;
            const stats = {
                damageMin: Math.max(1, Math.floor(average * 0.78)),
                damageMax: Math.max(2, Math.ceil(average * 1.22)),
                precision: Math.max(0, Math.floor(level * 0.35 + definition.precision))
            };
            if (definition.critical) stats.critical = Number((definition.critical + level * 0.0008).toFixed(3));
            if (definition.defense) stats.defense = Math.max(1, Math.floor(level * 0.25 + definition.defense));
            if (definition.mag) stats.mag = Math.max(1, Math.floor(level * 0.55 + definition.mag));

            item(`eg_${family}_l${level}`, {
                name: `${definition.name} ${grade}`,
                icon: definition.icon,
                type: "weapon",
                itemType: "WEAPON",
                slot: "weapon",
                weaponFamily: family,
                equipmentClass: family === "focus" ? "arcane" : "martial",
                levelReq: level,
                tier,
                rarity: level >= 9 ? "Raro" : level >= 5 ? "Incomum" : "Comum",
                price: 14 + level * level * 7,
                value: 14 + level * level * 7,
                stackable: false,
                maxStack: 1,
                baseStats: stats,
                stats: clone(stats),
                description: `${definition.name} de nível ${level}, criada para ter rolls e afixos individualizados.`
            });
        });

        Object.entries(ARMOR_PIECES).forEach(([slot, definition]) => {
            Object.entries(ARMOR_CLASSES).forEach(([armorClass, classDef]) => {
                const defBase = Math.max(1, Math.round((1 + level * 0.72) * definition.defense * classDef.defMultiplier));
                const hpBase = Math.max(1, Math.round(level * definition.hp * classDef.bonusHp));
                
                const stats = {
                    defense: defBase,
                    hpMax: hpBase
                };
                
                if (classDef.bonusName === "evasion") {
                    stats.evasion = Number((classDef.bonusVal * level + (definition.evasion || 0)).toFixed(4));
                } else if (classDef.bonusName) {
                    stats[classDef.bonusName] = Math.max(1, Math.round(classDef.bonusVal * level));
                }
                
                if (definition.precision) {
                    stats.precision = Math.max(1, Math.floor(level * 0.2 + definition.precision));
                }

                item(`eg_${slot}_${armorClass}_l${level}`, {
                    name: `${definition.name} ${classDef.name} ${grade}`,
                    icon: definition.icon,
                    type: "armor",
                    itemType: slot.toUpperCase(),
                    slot,
                    equipmentClass: "armor",
                    armorType: armorClass,
                    levelReq: level,
                    tier,
                    rarity: level >= 9 ? "Raro" : level >= 5 ? "Incomum" : "Comum",
                    price: Math.round((11 + level * level * 5) * classDef.defMultiplier),
                    value: Math.round((11 + level * level * 5) * classDef.defMultiplier),
                    stackable: false,
                    maxStack: 1,
                    baseStats: stats,
                    stats: clone(stats),
                    description: `Proteção de ${armorClass === "cloth" ? "Tecido" : armorClass === "leather" ? "Couro" : "Placa"} de nível ${level} com atributos variáveis.`
                });
            });
        });

        const shieldStats = {
            defense: 1 + Math.ceil(level * 0.85),
            blockChance: Number((0.025 + level * 0.003).toFixed(3)),
            blockReduction: Number((0.18 + level * 0.008).toFixed(3))
        };
        item(`eg_shield_l${level}`, {
            name: `Escudo ${grade}`, icon: "⬡", type: "shield", itemType: "SHIELD",
            slot: "offhand", levelReq: level, tier, equipmentClass: "defensive",
            rarity: level >= 9 ? "Raro" : level >= 5 ? "Incomum" : "Comum",
            price: 13 + level * level * 6, value: 13 + level * level * 6,
            stackable: false, maxStack: 1, baseStats: shieldStats, stats: clone(shieldStats),
            description: `Escudo de nível ${level}; melhora defesa e bloqueio sem criar imunidade.`
        });

        const ringStats = level % 2 === 0
            ? { critical: Number((0.004 + level * 0.001).toFixed(3)), precision: Math.ceil(level * 0.3) }
            : { hpMax: 2 + level * 2, manaMax: 1 + level };
        item(`eg_ring_l${level}`, {
            name: `Anel ${grade}`, icon: "○", type: "accessory", itemType: "RING",
            slot: "ring1", allowedSlots: ["ring1", "ring2"], levelReq: level, tier,
            equipmentClass: "accessory", rarity: level >= 8 ? "Raro" : "Incomum",
            price: 22 + level * level * 8, value: 22 + level * level * 8,
            stackable: false, maxStack: 1, baseStats: ringStats, stats: clone(ringStats),
            description: `Joia de nível ${level}; seus rolls podem colocá-la no ranking mundial.`
        });
    }

    function hash(value) {
        let result = 2166136261;
        String(value).split("").forEach((character) => {
            result ^= character.charCodeAt(0);
            result = Math.imul(result, 16777619);
        });
        return Math.abs(result >>> 0);
    }

    function equipmentPool(level) {
        const safeLevel = clamp(Math.floor(Number(level) || 1), 1, 10);
        const pool = [
            ...Object.keys(WEAPON_FAMILIES).map((family) => `eg_${family}_l${safeLevel}`),
            `eg_shield_l${safeLevel}`,
            `eg_ring_l${safeLevel}`
        ];
        Object.keys(ARMOR_PIECES).forEach((slot) => {
            pool.push(`eg_${slot}_cloth_l${safeLevel}`);
            pool.push(`eg_${slot}_leather_l${safeLevel}`);
            pool.push(`eg_${slot}_plate_l${safeLevel}`);
        });
        return pool;
    }

    function signatureMaterials(monster) {
        const type = String(monster?.type || monster?.lootProfile || "default").toLowerCase();
        const materials = FAMILY_MATERIALS[type] || FAMILY_MATERIALS.default;
        const name = normalize(monster?.name || monster?.id);
        const extras = [];
        if (/venom|poison|serpente|snake|spider|aranha|scorpion/.test(name)) extras.push("venom_sac");
        if (/fire|fogo|magma/.test(name)) extras.push("ember_gland");
        if (/ice|gelo|frost/.test(name)) extras.push("frost_crystal");
        if (/goblin/.test(name)) extras.push("goblin_token");
        if (/shadow|sombra|specter|espectro/.test(name)) extras.push("shadow_thread");
        return [...new Set([...materials, ...extras])];
    }

    function buildCreatureTable(monster) {
        const level = clamp(Math.floor(Number(monster?.level || monster?.recommendedLevel || 1)), 1, 10);
        const seed = hash(monster?.id || monster?.name || level);
        const materials = signatureMaterials(monster);
        const pool = equipmentPool(level);
        const previousPool = level > 1 ? equipmentPool(level - 1) : pool;
        const equipmentA = pool[seed % pool.length];
        const equipmentB = pool[(seed * 7 + 3) % pool.length];
        const equipmentC = previousPool[(seed * 13 + 5) % previousPool.length];
        const rank = String(monster?.rank || "normal").toLowerCase();
        const elite = rank === "elite" || rank === "boss" || rank === "legendary";

        return [
            { id: materials[0], chance: 0.42, minQuantity: 1, maxQuantity: level >= 8 ? 3 : 2, sourceClass: "family-material" },
            { id: materials[1] || materials[0], chance: 0.18, minQuantity: 1, maxQuantity: 1, sourceClass: "family-material" },
            ...(materials[2] ? [{ id: materials[2], chance: 0.055, minQuantity: 1, maxQuantity: 1, sourceClass: "rare-material" }] : []),
            { id: equipmentA, chance: elite ? 0.055 : 0.018, minQuantity: 1, maxQuantity: 1, qualityMin: 22 + level * 3, qualityMax: 100, sourceClass: "normal-equipment" },
            { id: equipmentB, chance: elite ? 0.032 : 0.009, minQuantity: 1, maxQuantity: 1, qualityMin: 35 + level * 2, qualityMax: 100, sourceClass: "normal-equipment" },
            { id: equipmentC, chance: elite ? 0.08 : 0.028, minQuantity: 1, maxQuantity: 1, qualityMin: 15 + level * 2, qualityMax: 92, sourceClass: "normal-equipment" }
        ];
    }

    Aethra.EarlyGameItemCatalog = {
        initialized: false,
        maxLevel: 10,
        templates,
        creatureTables: {},
        summary: null,

        init() {
            if (this.initialized) return clone(this.summary);

            Object.entries(this.templates).forEach(([id, definition]) => {
                if (Aethra.LootSystem?.registerTemplate) {
                    Aethra.LootSystem.registerTemplate(id, definition);
                } else {
                    Aethra.GameData.registerItem(id, definition);
                }
            });
            Aethra.ItemSystem?.syncFromGameData?.();

            const monsters = Aethra.MonsterCatalog?.getByLevel?.(1, this.maxLevel) || [];
            monsters.forEach((monster) => {
                const table = buildCreatureTable(monster);
                this.creatureTables[monster.id] = table;
                const target = Aethra.GameData.creatures?.[monster.id];
                if (target) {
                    target.lootTable = table.map((drop) => ({
                        templateId: drop.id,
                        chance: drop.chance,
                        min: drop.minQuantity,
                        max: drop.maxQuantity,
                        sourceClass: drop.sourceClass,
                        qualityMin: drop.qualityMin,
                        qualityMax: drop.qualityMax
                    }));
                    target.earlyGameCatalog = true;
                }
                Aethra.LootSystem?.registerTable?.(monster.id, table);
            });

            Aethra.LootSystem?.rebuildCatalogEconomy?.();
            this.initialized = true;
            this.summary = {
                maxLevel: this.maxLevel,
                templates: Object.keys(this.templates).length,
                equipment: Object.values(this.templates).filter((entry) => entry.slot).length,
                materials: Object.values(this.templates).filter((entry) => entry.type === "material").length,
                creaturesCovered: Object.keys(this.creatureTables).length,
                generatedAt: new Date().toISOString()
            };
            Aethra.EventBus.emit("early-game-catalog:ready", clone(this.summary));
            return clone(this.summary);
        },

        getCreatureDrops(creatureId) {
            return clone(this.creatureTables[creatureId] || []);
        },

        getItemsByLevel(level) {
            const safeLevel = clamp(Math.floor(Number(level) || 1), 1, 10);
            return Object.values(this.templates)
                .filter((entry) => Number(entry.levelReq || 0) === safeLevel)
                .map(clone);
        },

        auditCoverage() {
            const monsters = Aethra.MonsterCatalog?.getByLevel?.(1, this.maxLevel) || [];
            const missing = monsters.filter((monster) => !this.creatureTables[monster.id]);
            const invalidDrops = [];
            Object.entries(this.creatureTables).forEach(([creatureId, table]) => {
                table.forEach((drop) => {
                    if (!Aethra.GameData.items?.[drop.id] && !Aethra.ItemTemplates?.[drop.id]) {
                        invalidDrops.push({ creatureId, templateId: drop.id });
                    }
                });
            });
            return {
                valid: missing.length === 0 && invalidDrops.length === 0,
                creatures: monsters.length,
                covered: monsters.length - missing.length,
                missing: missing.map((entry) => entry.id),
                invalidDrops
            };
        }
    };
})(window.Aethra = window.Aethra || {});
