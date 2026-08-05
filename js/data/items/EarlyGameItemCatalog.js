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

    let templates = {};

    function item(id, definition) {
        templates[id] = { id, ...definition };
    }

    const rarityIds = { Comum: "common", Incomum: "uncommon", Raro: "rare", Épico: "epic" };

    // Materiais próprios da progressão produtiva. Mantê-los no catálogo oficial
    // garante que todo ingrediente exibido por uma receita também possa existir
    // como item real na mochila.
    const CRAFT_MATERIALS = {
        refined_ingot: ["Lingote Refinado", "▰", 16, "Incomum", "Ferro purificado e pronto para a forja."],
        steel_ingot: ["Lingote de Aço", "▰", 28, "Incomum", "Liga endurecida usada por ferreiros oficiais."],
        treated_leather: ["Couro Tratado", "▧", 14, "Incomum", "Pele curtida e preparada para costura."],
        reinforced_leather: ["Couro Reforçado", "▧", 27, "Incomum", "Couro rígido reforçado com componentes de fera."],
        aether_alloy: ["Liga Aetheriana", "◈", 48, "Raro", "Liga de aço estabilizada com éter e núcleo de criatura."],
        shadow_leather: ["Couro Sombrio", "◒", 45, "Raro", "Couro reforçado costurado com fios espectrais."],
        botanical_extract: ["Extrato Botânico", "⚗", 12, "Incomum", "Essência concentrada usada na preparação de supplies alquímicos."]
    };

    Object.entries({ ...EXTRA_MATERIALS, ...CRAFT_MATERIALS }).forEach(([id, definition]) => {
        const [name, icon, price, rarity, description] = definition;
        item(id, {
            name,
            icon,
            price,
            value: price,
            rarity,
            rarityId: rarityIds[rarity] || "common",
            type: "material",
            itemType: "MATERIAL",
            category: "resource",
            stackable: true,
            maxStack: 999,
            description: description || "Material obtido de criaturas e usado nos ofícios de Aethra."
        });
    });

    // Couraria produz armadura leve própria. Antes estas receitas apontavam para
    // peças de placa da Forjaria, o que fazia dois ofícios criarem o mesmo set.
    const LEATHER_ARMOR = [
        ["crafted_leather_feet_l1", "Botas de Couro", "⌄", "FEET", "feet", 1, 1, 18, "Comum", { defense: 1, hpMax: 1, evasion: 0.008 }],
        ["crafted_leather_head_l1", "Capuz de Couro", "⌃", "HEAD", "head", 1, 1, 21, "Comum", { defense: 1, hpMax: 2, evasion: 0.004 }],
        ["crafted_leather_legs_l1", "Calças de Couro", "Ⅱ", "LEGS", "legs", 1, 1, 25, "Comum", { defense: 1, hpMax: 2, evasion: 0.005 }],
        ["crafted_leather_chest_l1", "Peitoral de Couro", "▣", "CHEST", "chest", 1, 1, 30, "Comum", { defense: 2, hpMax: 3, evasion: 0.006 }],
        ["crafted_reinforced_feet_l6", "Botas Reforçadas", "⌄", "FEET", "feet", 6, 3, 58, "Incomum", { defense: 2, hpMax: 6, evasion: 0.015 }],
        ["crafted_reinforced_head_l6", "Capuz Reforçado", "⌃", "HEAD", "head", 6, 3, 65, "Incomum", { defense: 3, hpMax: 7, evasion: 0.008 }],
        ["crafted_reinforced_chest_l6", "Peitoral Reforçado", "▣", "CHEST", "chest", 6, 3, 82, "Incomum", { defense: 7, hpMax: 15, evasion: 0.012 }],
        ["crafted_shadow_feet_l10", "Botas do Véu", "⌄", "FEET", "feet", 10, 5, 126, "Raro", { defense: 4, hpMax: 13, evasion: 0.02 }],
        ["crafted_shadow_head_l10", "Capuz do Véu", "⌃", "HEAD", "head", 10, 5, 145, "Raro", { defense: 5, hpMax: 16, evasion: 0.012, precision: 1 }],
        ["crafted_shadow_chest_l10", "Peitoral do Véu", "▣", "CHEST", "chest", 10, 5, 190, "Raro", { defense: 11, hpMax: 32, evasion: 0.018, critical: 0.005 }]
    ];

    LEATHER_ARMOR.forEach(([id, name, icon, itemType, slot, levelReq, tier, price, rarity, stats]) => {
        item(id, {
            name,
            icon,
            price,
            value: price,
            rarity,
            rarityId: rarityIds[rarity] || "common",
            type: "armor",
            itemType,
            slot,
            equipmentClass: "armor",
            armorType: "leather",
            levelReq,
            tier,
            baseStats: { ...stats },
            stats: { ...stats },
            stackable: false,
            maxStack: 1,
            description: "Armadura leve produzida por Couraria, com mobilidade superior à placa."
        });
    });

    // ── Armaduras e Armas baseadas nos Assets Curados (Nível 1 a 10) ──

    // Set Recruta (Nível 1)
    item("eg_chest_l1", {
        name: "Peitoral Recruta", icon: "▣", image: "assets/organized/items/armor/armor_001.png", price: 30, value: 30,
        rarity: "Comum", type: "armor", itemType: "CHEST", slot: "chest", equipmentClass: "armor", armorType: "plate", levelReq: 1, tier: 1,
        baseStats: { defense: 3, hpMax: 4, str: 0.5 }, stats: { defense: 3, hpMax: 4, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("eg_head_l1", {
        name: "Elmo Recruta", icon: "⌃", image: "assets/organized/items/helmets/helmets_001.png", price: 23, value: 23,
        rarity: "Comum", type: "armor", itemType: "HEAD", slot: "head", equipmentClass: "armor", armorType: "plate", levelReq: 1, tier: 1,
        baseStats: { defense: 2, hpMax: 2 }, stats: { defense: 2, hpMax: 2 }, stackable: false, maxStack: 1
    });
    item("eg_legs_l1", {
        name: "Perneiras Recruta", icon: "Ⅱ", image: "assets/organized/items/legs/legs_001.png", price: 27, value: 27,
        rarity: "Comum", type: "armor", itemType: "LEGS", slot: "legs", equipmentClass: "armor", armorType: "plate", levelReq: 1, tier: 1,
        baseStats: { defense: 2, hpMax: 3 }, stats: { defense: 2, hpMax: 3 }, stackable: false, maxStack: 1
    });
    item("eg_feet_l1", {
        name: "Botas Recruta", icon: "⌄", image: "assets/organized/items/boots/boots_001.png", price: 19, value: 19,
        rarity: "Comum", type: "armor", itemType: "FEET", slot: "feet", equipmentClass: "armor", armorType: "plate", levelReq: 1, tier: 1,
        baseStats: { defense: 1, hpMax: 2, evasion: 0.003 }, stats: { defense: 1, hpMax: 2, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("eg_hands_l1", {
        name: "Luvas Recruta", icon: "✥", price: 19, value: 19,
        rarity: "Comum", type: "armor", itemType: "HANDS", slot: "hands", equipmentClass: "armor", armorType: "plate", levelReq: 1, tier: 1,
        baseStats: { defense: 1, hpMax: 2, precision: 1 }, stats: { defense: 1, hpMax: 2, precision: 1 }, stackable: false, maxStack: 1
    });
    item("eg_sword_l1", {
        name: "Espada Recruta", icon: "⚔", image: "assets/organized/items/weapons/all/weapons_011.png", price: 21, value: 21,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { damageMin: 3, damageMax: 5, precision: 1 }, stats: { damageMin: 3, damageMax: 5, precision: 1 }, stackable: false, maxStack: 1
    });
    item("eg_axe_l1", {
        name: "Machado Recruta", icon: "⚔", image: "assets/organized/items/weapons/axes/axe_l01.png", price: 21, value: 21,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { damageMin: 3, damageMax: 6, precision: 0, critical: 0.007 }, stats: { damageMin: 3, damageMax: 6, precision: 0, critical: 0.007 }, stackable: false, maxStack: 1
    });
    item("eg_mace_l1", {
        name: "Maça Recruta", icon: "⚔", image: "assets/organized/items/weapons/maces/mace_l01.png", price: 21, value: 21,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { damageMin: 3, damageMax: 6, precision: 0, defense: 1 }, stats: { damageMin: 3, damageMax: 6, precision: 0, defense: 1 }, stackable: false, maxStack: 1
    });
    item("eg_dagger_l1", {
        name: "Adaga Recruta", icon: "⚔", image: "assets/organized/items/weapons/daggers/dagger_l01.png", price: 21, value: 21,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { damageMin: 2, damageMax: 4, precision: 2, critical: 0.013 }, stats: { damageMin: 2, damageMax: 4, precision: 2, critical: 0.013 }, stackable: false, maxStack: 1
    });
    item("eg_bow_l1", {
        name: "Arco Recruta", icon: "⚔", image: "assets/organized/items/weapons/bows/Icon1_no_effect.png", price: 21, value: 21,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { damageMin: 2, damageMax: 5, precision: 3, critical: 0.005 }, stats: { damageMin: 2, damageMax: 5, precision: 3, critical: 0.005 }, stackable: false, maxStack: 1
    });
    item("eg_focus_l1", {
        name: "Foco Recruta", icon: "⚔", image: "assets/organized/items/weapons/foco/focus_l01.png", price: 21, value: 21,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 1, tier: 1,
        baseStats: { damageMin: 2, damageMax: 4, precision: 1, mag: 2 }, stats: { damageMin: 2, damageMax: 4, precision: 1, mag: 2 }, stackable: false, maxStack: 1
    });
    item("eg_shield_l1", {
        name: "Escudo Recruta", icon: "⬡", image: "assets/organized/items/shields/Shield_1/1.png", type: "shield", itemType: "SHIELD",
        slot: "offhand", levelReq: 1, tier: 1, equipmentClass: "defensive", rarity: "Comum",
        price: 19, value: 19,
        stackable: false, maxStack: 1, baseStats: {"defense":2,"blockChance":0.028,"blockReduction":0.188}, stats: {"defense":2,"blockChance":0.028,"blockReduction":0.188},
        description: "Escudo de nível 1; melhora defesa e bloqueio sem criar imunidade."
    });
    item("eg_ring_l1", {
        name: "Anel Recruta", icon: "○", image: "assets/organized/items/loot/all/loot_051.png", type: "accessory", itemType: "RING",
        slot: "ring1", allowedSlots: ["ring1", "ring2"], levelReq: 1, tier: 1,
        equipmentClass: "accessory", rarity: "Incomum",
        price: 30, value: 30,
        stackable: false, maxStack: 1, baseStats: {"hpMax":4,"manaMax":2}, stats: {"hpMax":4,"manaMax":2},
        description: "Joia de nível 1; seus rolls podem colocá-la no ranking mundial."
    });

    // Set Aventureiro (Nível 2)
    item("eg_chest_l2", {
        name: "Peitoral Aventureiro", icon: "▣", image: "assets/organized/items/armor/armor_002.png", price: 40, value: 40,
        rarity: "Comum", type: "armor", itemType: "CHEST", slot: "chest", equipmentClass: "armor", armorType: "plate", levelReq: 2, tier: 1,
        baseStats: { defense: 4, hpMax: 9, str: 0.5 }, stats: { defense: 4, hpMax: 9, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("eg_head_l2", {
        name: "Elmo Aventureiro", icon: "⌃", image: "assets/organized/items/helmets/helmets_002.png", price: 31, value: 31,
        rarity: "Comum", type: "armor", itemType: "HEAD", slot: "head", equipmentClass: "armor", armorType: "plate", levelReq: 2, tier: 1,
        baseStats: { defense: 2, hpMax: 5 }, stats: { defense: 2, hpMax: 5 }, stackable: false, maxStack: 1
    });
    item("eg_legs_l2", {
        name: "Perneiras Aventureiro", icon: "Ⅱ", image: "assets/organized/items/legs/legs_002.png", price: 36, value: 36,
        rarity: "Comum", type: "armor", itemType: "LEGS", slot: "legs", equipmentClass: "armor", armorType: "plate", levelReq: 2, tier: 1,
        baseStats: { defense: 3, hpMax: 6 }, stats: { defense: 3, hpMax: 6 }, stackable: false, maxStack: 1
    });
    item("eg_feet_l2", {
        name: "Botas Aventureiro", icon: "⌄", image: "assets/organized/items/boots/boots_002.png", price: 26, value: 26,
        rarity: "Comum", type: "armor", itemType: "FEET", slot: "feet", equipmentClass: "armor", armorType: "plate", levelReq: 2, tier: 1,
        baseStats: { defense: 2, hpMax: 4, evasion: 0.003 }, stats: { defense: 2, hpMax: 4, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("eg_hands_l2", {
        name: "Luvas Aventureiro", icon: "✥", price: 26, value: 26,
        rarity: "Comum", type: "armor", itemType: "HANDS", slot: "hands", equipmentClass: "armor", armorType: "plate", levelReq: 2, tier: 1,
        baseStats: { defense: 2, hpMax: 4, precision: 1 }, stats: { defense: 2, hpMax: 4, precision: 1 }, stackable: false, maxStack: 1
    });
    item("eg_sword_l2", {
        name: "Espada Aventureiro", icon: "⚔", image: "assets/organized/items/weapons/all/weapons_012.png", price: 42, value: 42,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { damageMin: 4, damageMax: 7, precision: 1 }, stats: { damageMin: 4, damageMax: 7, precision: 1 }, stackable: false, maxStack: 1
    });
    item("eg_axe_l2", {
        name: "Machado Aventureiro", icon: "⚔", image: "assets/organized/items/weapons/axes/axe_l02.png", price: 42, value: 42,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { damageMin: 4, damageMax: 8, precision: 0, critical: 0.008 }, stats: { damageMin: 4, damageMax: 8, precision: 0, critical: 0.008 }, stackable: false, maxStack: 1
    });
    item("eg_mace_l2", {
        name: "Maça Aventureiro", icon: "⚔", image: "assets/organized/items/weapons/maces/mace_l02.png", price: 42, value: 42,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { damageMin: 4, damageMax: 7, precision: 0, defense: 1 }, stats: { damageMin: 4, damageMax: 7, precision: 0, defense: 1 }, stackable: false, maxStack: 1
    });
    item("eg_dagger_l2", {
        name: "Adaga Aventureiro", icon: "⚔", image: "assets/organized/items/weapons/daggers/dagger_l02.png", price: 42, value: 42,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { damageMin: 3, damageMax: 6, precision: 2, critical: 0.014 }, stats: { damageMin: 3, damageMax: 6, precision: 2, critical: 0.014 }, stackable: false, maxStack: 1
    });
    item("eg_bow_l2", {
        name: "Arco Aventureiro", icon: "⚔", image: "assets/organized/items/weapons/bows/Icon13_no_effect.png", price: 42, value: 42,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { damageMin: 3, damageMax: 6, precision: 3, critical: 0.006 }, stats: { damageMin: 3, damageMax: 6, precision: 3, critical: 0.006 }, stackable: false, maxStack: 1
    });
    item("eg_focus_l2", {
        name: "Foco Aventureiro", icon: "⚔", image: "assets/organized/items/weapons/foco/focus_l02.png", price: 42, value: 42,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 2, tier: 1,
        baseStats: { damageMin: 3, damageMax: 6, precision: 1, mag: 3 }, stats: { damageMin: 3, damageMax: 6, precision: 1, mag: 3 }, stackable: false, maxStack: 1
    });
    item("eg_shield_l2", {
        name: "Escudo Aventureiro", icon: "⬡", image: "assets/organized/items/shields/Shield_1/2.png", type: "shield", itemType: "SHIELD",
        slot: "offhand", levelReq: 2, tier: 1, equipmentClass: "defensive", rarity: "Comum",
        price: 37, value: 37,
        stackable: false, maxStack: 1, baseStats: {"defense":3,"blockChance":0.031,"blockReduction":0.196}, stats: {"defense":3,"blockChance":0.031,"blockReduction":0.196},
        description: "Escudo de nível 2; melhora defesa e bloqueio sem criar imunidade."
    });
    item("eg_ring_l2", {
        name: "Anel Aventureiro", icon: "○", image: "assets/organized/items/loot/all/loot_051.png", type: "accessory", itemType: "RING",
        slot: "ring1", allowedSlots: ["ring1", "ring2"], levelReq: 2, tier: 1,
        equipmentClass: "accessory", rarity: "Incomum",
        price: 54, value: 54,
        stackable: false, maxStack: 1, baseStats: {"critical":0.006,"precision":1}, stats: {"critical":0.006,"precision":1},
        description: "Joia de nível 2; seus rolls podem colocá-la no ranking mundial."
    });

    // Set Vybe (Nível 3)
    item("eg_chest_l3", {
        name: "Peitoral Vybe", icon: "▣", image: "assets/organized/items/armor/armor_003.png", price: 50, value: 50,
        rarity: "Comum", type: "armor", itemType: "CHEST", slot: "chest", equipmentClass: "armor", armorType: "plate", levelReq: 3, tier: 2,
        baseStats: { defense: 6, hpMax: 13, str: 0.5 }, stats: { defense: 6, hpMax: 13, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("eg_head_l3", {
        name: "Elmo Vybe", icon: "⌃", image: "assets/organized/items/helmets/helmets_003.png", price: 39, value: 39,
        rarity: "Comum", type: "armor", itemType: "HEAD", slot: "head", equipmentClass: "armor", armorType: "plate", levelReq: 3, tier: 2,
        baseStats: { defense: 3, hpMax: 7 }, stats: { defense: 3, hpMax: 7 }, stackable: false, maxStack: 1
    });
    item("eg_legs_l3", {
        name: "Perneiras Vybe", icon: "Ⅱ", image: "assets/organized/items/legs/legs_003.png", price: 45, value: 45,
        rarity: "Comum", type: "armor", itemType: "LEGS", slot: "legs", equipmentClass: "armor", armorType: "plate", levelReq: 3, tier: 2,
        baseStats: { defense: 4, hpMax: 9 }, stats: { defense: 4, hpMax: 9 }, stackable: false, maxStack: 1
    });
    item("eg_feet_l3", {
        name: "Botas Vybe", icon: "⌄", image: "assets/organized/items/boots/boots_003.png", price: 33, value: 33,
        rarity: "Comum", type: "armor", itemType: "FEET", slot: "feet", equipmentClass: "armor", armorType: "plate", levelReq: 3, tier: 2,
        baseStats: { defense: 2, hpMax: 5, evasion: 0.003 }, stats: { defense: 2, hpMax: 5, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("eg_hands_l3", {
        name: "Luvas Vybe", icon: "✥", price: 33, value: 33,
        rarity: "Comum", type: "armor", itemType: "HANDS", slot: "hands", equipmentClass: "armor", armorType: "plate", levelReq: 3, tier: 2,
        baseStats: { defense: 2, hpMax: 5, precision: 1 }, stats: { defense: 2, hpMax: 5, precision: 1 }, stackable: false, maxStack: 1
    });
    item("eg_sword_l3", {
        name: "Espada Vybe", icon: "⚔", image: "assets/organized/items/weapons/all/weapons_013.png", price: 77, value: 77,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { damageMin: 5, damageMax: 9, precision: 2 }, stats: { damageMin: 5, damageMax: 9, precision: 2 }, stackable: false, maxStack: 1
    });
    item("eg_axe_l3", {
        name: "Machado Vybe", icon: "⚔", image: "assets/organized/items/weapons/axes/axe_l03.png", price: 77, value: 77,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { damageMin: 6, damageMax: 10, precision: 1, critical: 0.008 }, stats: { damageMin: 6, damageMax: 10, precision: 1, critical: 0.008 }, stackable: false, maxStack: 1
    });
    item("eg_mace_l3", {
        name: "Maça Vybe", icon: "⚔", image: "assets/organized/items/weapons/maces/mace_l03.png", price: 77, value: 77,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { damageMin: 5, damageMax: 9, precision: 1, defense: 1 }, stats: { damageMin: 5, damageMax: 9, precision: 1, defense: 1 }, stackable: false, maxStack: 1
    });
    item("eg_dagger_l3", {
        name: "Adaga Vybe", icon: "⚔", image: "assets/organized/items/weapons/daggers/dagger_l03.png", price: 77, value: 77,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { damageMin: 4, damageMax: 7, precision: 3, critical: 0.014 }, stats: { damageMin: 4, damageMax: 7, precision: 3, critical: 0.014 }, stackable: false, maxStack: 1
    });
    item("eg_bow_l3", {
        name: "Arco Vybe", icon: "⚔", image: "assets/organized/items/weapons/bows/Icon20_no_effect.png", price: 77, value: 77,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { damageMin: 4, damageMax: 8, precision: 4, critical: 0.006 }, stats: { damageMin: 4, damageMax: 8, precision: 4, critical: 0.006 }, stackable: false, maxStack: 1
    });
    item("eg_focus_l3", {
        name: "Foco Vybe", icon: "⚔", image: "assets/organized/items/weapons/foco/focus_l03.png", price: 77, value: 77,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 3, tier: 2,
        baseStats: { damageMin: 4, damageMax: 7, precision: 2, mag: 3 }, stats: { damageMin: 4, damageMax: 7, precision: 2, mag: 3 }, stackable: false, maxStack: 1
    });
    item("eg_shield_l3", {
        name: "Escudo Vybe", icon: "⬡", image: "assets/organized/items/shields/Shield_2/2.png", type: "shield", itemType: "SHIELD",
        slot: "offhand", levelReq: 3, tier: 2, equipmentClass: "defensive", rarity: "Comum",
        price: 67, value: 67,
        stackable: false, maxStack: 1, baseStats: {"defense":4,"blockChance":0.034,"blockReduction":0.204}, stats: {"defense":4,"blockChance":0.034,"blockReduction":0.204},
        description: "Escudo de nível 3; melhora defesa e bloqueio sem criar imunidade."
    });
    item("eg_ring_l3", {
        name: "Anel Vybe", icon: "○", image: "assets/organized/items/loot/all/loot_051.png", type: "accessory", itemType: "RING",
        slot: "ring1", allowedSlots: ["ring1", "ring2"], levelReq: 3, tier: 2,
        equipmentClass: "accessory", rarity: "Incomum",
        price: 94, value: 94,
        stackable: false, maxStack: 1, baseStats: {"hpMax":8,"manaMax":4}, stats: {"hpMax":8,"manaMax":4},
        description: "Joia de nível 3; seus rolls podem colocá-la no ranking mundial."
    });

    // Set Guarda (Nível 4)
    item("eg_chest_l4", {
        name: "Peitoral Guarda", icon: "▣", image: "assets/organized/items/armor/armor_004.png", price: 60, value: 60,
        rarity: "Comum", type: "armor", itemType: "CHEST", slot: "chest", equipmentClass: "armor", armorType: "plate", levelReq: 4, tier: 2,
        baseStats: { defense: 7, hpMax: 18, str: 0.5 }, stats: { defense: 7, hpMax: 18, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("eg_head_l4", {
        name: "Elmo Guarda", icon: "⌃", image: "assets/organized/items/helmets/helmets_004.png", price: 47, value: 47,
        rarity: "Comum", type: "armor", itemType: "HEAD", slot: "head", equipmentClass: "armor", armorType: "plate", levelReq: 4, tier: 2,
        baseStats: { defense: 4, hpMax: 9 }, stats: { defense: 4, hpMax: 9 }, stackable: false, maxStack: 1
    });
    item("eg_legs_l4", {
        name: "Perneiras Guarda", icon: "Ⅱ", image: "assets/organized/items/legs/legs_004.png", price: 54, value: 54,
        rarity: "Comum", type: "armor", itemType: "LEGS", slot: "legs", equipmentClass: "armor", armorType: "plate", levelReq: 4, tier: 2,
        baseStats: { defense: 5, hpMax: 13 }, stats: { defense: 5, hpMax: 13 }, stackable: false, maxStack: 1
    });
    item("eg_feet_l4", {
        name: "Botas Guarda", icon: "⌄", image: "assets/organized/items/boots/boots_004.png", price: 40, value: 40,
        rarity: "Comum", type: "armor", itemType: "FEET", slot: "feet", equipmentClass: "armor", armorType: "plate", levelReq: 4, tier: 2,
        baseStats: { defense: 3, hpMax: 7, evasion: 0.003 }, stats: { defense: 3, hpMax: 7, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("eg_hands_l4", {
        name: "Luvas Guarda", icon: "✥", price: 40, value: 40,
        rarity: "Comum", type: "armor", itemType: "HANDS", slot: "hands", equipmentClass: "armor", armorType: "plate", levelReq: 4, tier: 2,
        baseStats: { defense: 3, hpMax: 7, precision: 1 }, stats: { defense: 3, hpMax: 7, precision: 1 }, stackable: false, maxStack: 1
    });
    item("eg_sword_l4", {
        name: "Espada Guarda", icon: "⚔", image: "assets/organized/items/weapons/all/weapons_014.png", price: 126, value: 126,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { damageMin: 6, damageMax: 11, precision: 2 }, stats: { damageMin: 6, damageMax: 11, precision: 2 }, stackable: false, maxStack: 1
    });
    item("eg_axe_l4", {
        name: "Machado Guarda", icon: "⚔", image: "assets/organized/items/weapons/axes/axe_l04.png", price: 126, value: 126,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { damageMin: 7, damageMax: 12, precision: 1, critical: 0.009 }, stats: { damageMin: 7, damageMax: 12, precision: 1, critical: 0.009 }, stackable: false, maxStack: 1
    });
    item("eg_mace_l4", {
        name: "Maça Guarda", icon: "⚔", image: "assets/organized/items/weapons/maces/mace_l04.png", price: 126, value: 126,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { damageMin: 6, damageMax: 11, precision: 1, defense: 2 }, stats: { damageMin: 6, damageMax: 11, precision: 1, defense: 2 }, stackable: false, maxStack: 1
    });
    item("eg_dagger_l4", {
        name: "Adaga Guarda", icon: "⚔", image: "assets/organized/items/weapons/daggers/dagger_l04.png", price: 126, value: 126,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { damageMin: 5, damageMax: 9, precision: 3, critical: 0.015 }, stats: { damageMin: 5, damageMax: 9, precision: 3, critical: 0.015 }, stackable: false, maxStack: 1
    });
    item("eg_bow_l4", {
        name: "Arco Guarda", icon: "⚔", image: "assets/organized/items/weapons/bows/Icon2_no_effect.png", price: 126, value: 126,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { damageMin: 5, damageMax: 10, precision: 4, critical: 0.007 }, stats: { damageMin: 5, damageMax: 10, precision: 4, critical: 0.007 }, stackable: false, maxStack: 1
    });
    item("eg_focus_l4", {
        name: "Foco Guarda", icon: "⚔", image: "assets/organized/items/weapons/foco/focus_l04.png", price: 126, value: 126,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 4, tier: 2,
        baseStats: { damageMin: 4, damageMax: 8, precision: 2, mag: 4 }, stats: { damageMin: 4, damageMax: 8, precision: 2, mag: 4 }, stackable: false, maxStack: 1
    });
    item("eg_shield_l4", {
        name: "Escudo Guarda", icon: "⬡", image: "assets/organized/items/shields/Shield_3/3.png", type: "shield", itemType: "SHIELD",
        slot: "offhand", levelReq: 4, tier: 2, equipmentClass: "defensive", rarity: "Comum",
        price: 109, value: 109,
        stackable: false, maxStack: 1, baseStats: {"defense":5,"blockChance":0.037,"blockReduction":0.212}, stats: {"defense":5,"blockChance":0.037,"blockReduction":0.212},
        description: "Escudo de nível 4; melhora defesa e bloqueio sem criar imunidade."
    });
    item("eg_ring_l4", {
        name: "Anel Guarda", icon: "○", image: "assets/organized/items/loot/all/loot_051.png", type: "accessory", itemType: "RING",
        slot: "ring1", allowedSlots: ["ring1", "ring2"], levelReq: 4, tier: 2,
        equipmentClass: "accessory", rarity: "Incomum",
        price: 150, value: 150,
        stackable: false, maxStack: 1, baseStats: {"critical":0.008,"precision":2}, stats: {"critical":0.008,"precision":2},
        description: "Joia de nível 4; seus rolls podem colocá-la no ranking mundial."
    });

    // Set Mercenário (Nível 5)
    item("eg_chest_l5", {
        name: "Peitoral Mercenário", icon: "▣", image: "assets/organized/items/armor/armor_005.png", price: 70, value: 70,
        rarity: "Incomum", type: "armor", itemType: "CHEST", slot: "chest", equipmentClass: "armor", armorType: "plate", levelReq: 5, tier: 3,
        baseStats: { defense: 8, hpMax: 22, str: 0.5 }, stats: { defense: 8, hpMax: 22, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("eg_head_l5", {
        name: "Elmo Mercenário", icon: "⌃", image: "assets/organized/items/helmets/helmets_005.png", price: 55, value: 55,
        rarity: "Incomum", type: "armor", itemType: "HEAD", slot: "head", equipmentClass: "armor", armorType: "plate", levelReq: 5, tier: 3,
        baseStats: { defense: 4, hpMax: 11 }, stats: { defense: 4, hpMax: 11 }, stackable: false, maxStack: 1
    });
    item("eg_legs_l5", {
        name: "Perneiras Mercenário", icon: "Ⅱ", image: "assets/organized/items/legs/legs_005.png", price: 63, value: 63,
        rarity: "Incomum", type: "armor", itemType: "LEGS", slot: "legs", equipmentClass: "armor", armorType: "plate", levelReq: 5, tier: 3,
        baseStats: { defense: 6, hpMax: 15 }, stats: { defense: 6, hpMax: 15 }, stackable: false, maxStack: 1
    });
    item("eg_feet_l5", {
        name: "Botas Mercenário", icon: "⌄", image: "assets/organized/items/boots/boots_005.png", price: 47, value: 47,
        rarity: "Incomum", type: "armor", itemType: "FEET", slot: "feet", equipmentClass: "armor", armorType: "plate", levelReq: 5, tier: 3,
        baseStats: { defense: 3, hpMax: 9, evasion: 0.003 }, stats: { defense: 3, hpMax: 9, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("eg_hands_l5", {
        name: "Luvas Mercenário", icon: "✥", price: 47, value: 47,
        rarity: "Incomum", type: "armor", itemType: "HANDS", slot: "hands", equipmentClass: "armor", armorType: "plate", levelReq: 5, tier: 3,
        baseStats: { defense: 3, hpMax: 9, precision: 1 }, stats: { defense: 3, hpMax: 9, precision: 1 }, stackable: false, maxStack: 1
    });
    item("eg_sword_l5", {
        name: "Espada Mercenário", icon: "⚔", image: "assets/organized/items/weapons/all/weapons_015.png", price: 189, value: 189,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { damageMin: 7, damageMax: 12, precision: 2 }, stats: { damageMin: 7, damageMax: 12, precision: 2 }, stackable: false, maxStack: 1
    });
    item("eg_axe_l5", {
        name: "Machado Mercenário", icon: "⚔", image: "assets/organized/items/weapons/axes/axe_l05.png", price: 189, value: 189,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { damageMin: 8, damageMax: 14, precision: 1, critical: 0.01 }, stats: { damageMin: 8, damageMax: 14, precision: 1, critical: 0.01 }, stackable: false, maxStack: 1
    });
    item("eg_mace_l5", {
        name: "Maça Mercenário", icon: "⚔", image: "assets/organized/items/weapons/maces/mace_l05.png", price: 189, value: 189,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { damageMin: 8, damageMax: 13, precision: 1, defense: 2 }, stats: { damageMin: 8, damageMax: 13, precision: 1, defense: 2 }, stackable: false, maxStack: 1
    });
    item("eg_dagger_l5", {
        name: "Adaga Mercenário", icon: "⚔", image: "assets/organized/items/weapons/daggers/dagger_l05.png", price: 189, value: 189,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { damageMin: 6, damageMax: 10, precision: 3, critical: 0.016 }, stats: { damageMin: 6, damageMax: 10, precision: 3, critical: 0.016 }, stackable: false, maxStack: 1
    });
    item("eg_bow_l5", {
        name: "Arco Mercenário", icon: "⚔", image: "assets/organized/items/weapons/bows/Icon25_no_effect.png", price: 189, value: 189,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { damageMin: 6, damageMax: 11, precision: 4, critical: 0.008 }, stats: { damageMin: 6, damageMax: 11, precision: 4, critical: 0.008 }, stackable: false, maxStack: 1
    });
    item("eg_focus_l5", {
        name: "Foco Mercenário", icon: "⚔", image: "assets/organized/items/weapons/foco/focus_l05.png", price: 189, value: 189,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 5, tier: 3,
        baseStats: { damageMin: 5, damageMax: 10, precision: 2, mag: 4 }, stats: { damageMin: 5, damageMax: 10, precision: 2, mag: 4 }, stackable: false, maxStack: 1
    });
    item("eg_shield_l5", {
        name: "Escudo Mercenário", icon: "⬡", image: "assets/organized/items/shields/Shield_4/3.png", type: "shield", itemType: "SHIELD",
        slot: "offhand", levelReq: 5, tier: 3, equipmentClass: "defensive", rarity: "Incomum",
        price: 163, value: 163,
        stackable: false, maxStack: 1, baseStats: {"defense":6,"blockChance":0.04,"blockReduction":0.22}, stats: {"defense":6,"blockChance":0.04,"blockReduction":0.22},
        description: "Escudo de nível 5; melhora defesa e bloqueio sem criar imunidade."
    });
    item("eg_ring_l5", {
        name: "Anel Mercenário", icon: "○", image: "assets/organized/items/loot/all/loot_051.png", type: "accessory", itemType: "RING",
        slot: "ring1", allowedSlots: ["ring1", "ring2"], levelReq: 5, tier: 3,
        equipmentClass: "accessory", rarity: "Incomum",
        price: 222, value: 222,
        stackable: false, maxStack: 1, baseStats: {"hpMax":12,"manaMax":6}, stats: {"hpMax":12,"manaMax":6},
        description: "Joia de nível 5; seus rolls podem colocá-la no ranking mundial."
    });

    // Set Explorador (Nível 6)
    item("eg_chest_l6", {
        name: "Peitoral Explorador", icon: "▣", image: "assets/organized/items/armor/armor_006.png", price: 80, value: 80,
        rarity: "Incomum", type: "armor", itemType: "CHEST", slot: "chest", equipmentClass: "armor", armorType: "plate", levelReq: 6, tier: 3,
        baseStats: { defense: 9, hpMax: 27, str: 0.5 }, stats: { defense: 9, hpMax: 27, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("eg_head_l6", {
        name: "Elmo Explorador", icon: "⌃", image: "assets/organized/items/helmets/helmets_006.png", price: 63, value: 63,
        rarity: "Incomum", type: "armor", itemType: "HEAD", slot: "head", equipmentClass: "armor", armorType: "plate", levelReq: 6, tier: 3,
        baseStats: { defense: 5, hpMax: 14 }, stats: { defense: 5, hpMax: 14 }, stackable: false, maxStack: 1
    });
    item("eg_legs_l6", {
        name: "Perneiras Explorador", icon: "Ⅱ", image: "assets/organized/items/legs/legs_006.png", price: 72, value: 72,
        rarity: "Incomum", type: "armor", itemType: "LEGS", slot: "legs", equipmentClass: "armor", armorType: "plate", levelReq: 6, tier: 3,
        baseStats: { defense: 6, hpMax: 19 }, stats: { defense: 6, hpMax: 19 }, stackable: false, maxStack: 1
    });
    item("eg_feet_l6", {
        name: "Botas Explorador", icon: "⌄", image: "assets/organized/items/boots/boots_006.png", price: 54, value: 54,
        rarity: "Incomum", type: "armor", itemType: "FEET", slot: "feet", equipmentClass: "armor", armorType: "plate", levelReq: 6, tier: 3,
        baseStats: { defense: 4, hpMax: 11, evasion: 0.003 }, stats: { defense: 4, hpMax: 11, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("eg_hands_l6", {
        name: "Luvas Explorador", icon: "✥", price: 54, value: 54,
        rarity: "Incomum", type: "armor", itemType: "HANDS", slot: "hands", equipmentClass: "armor", armorType: "plate", levelReq: 6, tier: 3,
        baseStats: { defense: 4, hpMax: 11, precision: 1 }, stats: { defense: 4, hpMax: 11, precision: 1 }, stackable: false, maxStack: 1
    });
    item("eg_sword_l6", {
        name: "Espada Explorador", icon: "⚔", image: "assets/organized/items/weapons/all/weapons_016.png", price: 266, value: 266,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { damageMin: 8, damageMax: 14, precision: 3 }, stats: { damageMin: 8, damageMax: 14, precision: 3 }, stackable: false, maxStack: 1
    });
    item("eg_axe_l6", {
        name: "Machado Explorador", icon: "⚔", image: "assets/organized/items/weapons/axes/axe_l06.png", price: 266, value: 266,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { damageMin: 9, damageMax: 16, precision: 2, critical: 0.011 }, stats: { damageMin: 9, damageMax: 16, precision: 2, critical: 0.011 }, stackable: false, maxStack: 1
    });
    item("eg_mace_l6", {
        name: "Maça Explorador", icon: "⚔", image: "assets/organized/items/weapons/maces/mace_l06.png", price: 266, value: 266,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { damageMin: 9, damageMax: 15, precision: 2, defense: 2 }, stats: { damageMin: 9, damageMax: 15, precision: 2, defense: 2 }, stackable: false, maxStack: 1
    });
    item("eg_dagger_l6", {
        name: "Adaga Explorador", icon: "⚔", image: "assets/organized/items/weapons/daggers/dagger_l06.png", price: 266, value: 266,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { damageMin: 7, damageMax: 12, precision: 4, critical: 0.017 }, stats: { damageMin: 7, damageMax: 12, precision: 4, critical: 0.017 }, stackable: false, maxStack: 1
    });
    item("eg_bow_l6", {
        name: "Arco Explorador", icon: "⚔", image: "assets/organized/items/weapons/bows/Icon14.png", price: 266, value: 266,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { damageMin: 7, damageMax: 13, precision: 5, critical: 0.009 }, stats: { damageMin: 7, damageMax: 13, precision: 5, critical: 0.009 }, stackable: false, maxStack: 1
    });
    item("eg_focus_l6", {
        name: "Foco Explorador", icon: "⚔", image: "assets/organized/items/weapons/foco/focus_l06.png", price: 266, value: 266,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 6, tier: 3,
        baseStats: { damageMin: 6, damageMax: 11, precision: 3, mag: 5 }, stats: { damageMin: 6, damageMax: 11, precision: 3, mag: 5 }, stackable: false, maxStack: 1
    });
    item("eg_shield_l6", {
        name: "Escudo Explorador", icon: "⬡", image: "assets/organized/items/shields/Shield_5/3.png", type: "shield", itemType: "SHIELD",
        slot: "offhand", levelReq: 6, tier: 3, equipmentClass: "defensive", rarity: "Incomum",
        price: 229, value: 229,
        stackable: false, maxStack: 1, baseStats: {"defense":7,"blockChance":0.043,"blockReduction":0.228}, stats: {"defense":7,"blockChance":0.043,"blockReduction":0.228},
        description: "Escudo de nível 6; melhora defesa e bloqueio sem criar imunidade."
    });
    item("eg_ring_l6", {
        name: "Anel Explorador", icon: "○", image: "assets/organized/items/loot/all/loot_051.png", type: "accessory", itemType: "RING",
        slot: "ring1", allowedSlots: ["ring1", "ring2"], levelReq: 6, tier: 3,
        equipmentClass: "accessory", rarity: "Incomum",
        price: 310, value: 310,
        stackable: false, maxStack: 1, baseStats: {"critical":0.01,"precision":2}, stats: {"critical":0.01,"precision":2},
        description: "Joia de nível 6; seus rolls podem colocá-la no ranking mundial."
    });

    // Set Veterano (Nível 7)
    item("eg_chest_l7", {
        name: "Peitoral Veterano", icon: "▣", image: "assets/organized/items/armor/armor_007.png", price: 90, value: 90,
        rarity: "Incomum", type: "armor", itemType: "CHEST", slot: "chest", equipmentClass: "armor", armorType: "plate", levelReq: 7, tier: 4,
        baseStats: { defense: 11, hpMax: 31, str: 0.5 }, stats: { defense: 11, hpMax: 31, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("eg_head_l7", {
        name: "Elmo Veterano", icon: "⌃", image: "assets/organized/items/helmets/helmets_007.png", price: 71, value: 71,
        rarity: "Incomum", type: "armor", itemType: "HEAD", slot: "head", equipmentClass: "armor", armorType: "plate", levelReq: 7, tier: 4,
        baseStats: { defense: 6, hpMax: 16 }, stats: { defense: 6, hpMax: 16 }, stackable: false, maxStack: 1
    });
    item("eg_legs_l7", {
        name: "Perneiras Veterano", icon: "Ⅱ", image: "assets/organized/items/legs/legs_007.png", price: 81, value: 81,
        rarity: "Incomum", type: "armor", itemType: "LEGS", slot: "legs", equipmentClass: "armor", armorType: "plate", levelReq: 7, tier: 4,
        baseStats: { defense: 8, hpMax: 22 }, stats: { defense: 8, hpMax: 22 }, stackable: false, maxStack: 1
    });
    item("eg_feet_l7", {
        name: "Botas Veterano", icon: "⌄", image: "assets/organized/items/boots/boots_007.png", price: 61, value: 61,
        rarity: "Incomum", type: "armor", itemType: "FEET", slot: "feet", equipmentClass: "armor", armorType: "plate", levelReq: 7, tier: 4,
        baseStats: { defense: 4, hpMax: 12, evasion: 0.003 }, stats: { defense: 4, hpMax: 12, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("eg_hands_l7", {
        name: "Luvas Veterano", icon: "✥", price: 61, value: 61,
        rarity: "Incomum", type: "armor", itemType: "HANDS", slot: "hands", equipmentClass: "armor", armorType: "plate", levelReq: 7, tier: 4,
        baseStats: { defense: 4, hpMax: 12, precision: 1 }, stats: { defense: 4, hpMax: 12, precision: 1 }, stackable: false, maxStack: 1
    });
    item("eg_sword_l7", {
        name: "Espada Veterano", icon: "⚔", image: "assets/organized/items/weapons/all/weapons_017.png", price: 357, value: 357,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { damageMin: 9, damageMax: 16, precision: 3 }, stats: { damageMin: 9, damageMax: 16, precision: 3 }, stackable: false, maxStack: 1
    });
    item("eg_axe_l7", {
        name: "Machado Veterano", icon: "⚔", image: "assets/organized/items/weapons/axes/axe_l07.png", price: 357, value: 357,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { damageMin: 11, damageMax: 18, precision: 2, critical: 0.012 }, stats: { damageMin: 11, damageMax: 18, precision: 2, critical: 0.012 }, stackable: false, maxStack: 1
    });
    item("eg_mace_l7", {
        name: "Maça Veterano", icon: "⚔", image: "assets/organized/items/weapons/maces/mace_l07.png", price: 357, value: 357,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { damageMin: 10, damageMax: 17, precision: 2, defense: 2 }, stats: { damageMin: 10, damageMax: 17, precision: 2, defense: 2 }, stackable: false, maxStack: 1
    });
    item("eg_dagger_l7", {
        name: "Adaga Veterano", icon: "⚔", image: "assets/organized/items/weapons/daggers/dagger_l07.png", price: 357, value: 357,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { damageMin: 8, damageMax: 13, precision: 4, critical: 0.018 }, stats: { damageMin: 8, damageMax: 13, precision: 4, critical: 0.018 }, stackable: false, maxStack: 1
    });
    item("eg_bow_l7", {
        name: "Arco Veterano", icon: "⚔", image: "assets/organized/items/weapons/bows/Icon17.png", price: 357, value: 357,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { damageMin: 9, damageMax: 15, precision: 5, critical: 0.01 }, stats: { damageMin: 9, damageMax: 15, precision: 5, critical: 0.01 }, stackable: false, maxStack: 1
    });
    item("eg_focus_l7", {
        name: "Foco Veterano", icon: "⚔", image: "assets/organized/items/weapons/foco/focus_l07.png", price: 357, value: 357,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 7, tier: 4,
        baseStats: { damageMin: 7, damageMax: 12, precision: 3, mag: 5 }, stats: { damageMin: 7, damageMax: 12, precision: 3, mag: 5 }, stackable: false, maxStack: 1
    });
    item("eg_shield_l7", {
        name: "Escudo Veterano", icon: "⬡", image: "assets/organized/items/shields/Shield_6/4.png", type: "shield", itemType: "SHIELD",
        slot: "offhand", levelReq: 7, tier: 4, equipmentClass: "defensive", rarity: "Incomum",
        price: 307, value: 307,
        stackable: false, maxStack: 1, baseStats: {"defense":7,"blockChance":0.046,"blockReduction":0.236}, stats: {"defense":7,"blockChance":0.046,"blockReduction":0.236},
        description: "Escudo de nível 7; melhora defesa e bloqueio sem criar imunidade."
    });
    item("eg_ring_l7", {
        name: "Anel Veterano", icon: "○", image: "assets/organized/items/loot/all/loot_051.png", type: "accessory", itemType: "RING",
        slot: "ring1", allowedSlots: ["ring1", "ring2"], levelReq: 7, tier: 4,
        equipmentClass: "accessory", rarity: "Incomum",
        price: 414, value: 414,
        stackable: false, maxStack: 1, baseStats: {"hpMax":16,"manaMax":8}, stats: {"hpMax":16,"manaMax":8},
        description: "Joia de nível 7; seus rolls podem colocá-la no ranking mundial."
    });

    // Set Coliseu (Nível 8)
    item("eg_chest_l8", {
        name: "Peitoral Coliseu", icon: "▣", image: "assets/organized/items/armor/armor_008.png", price: 100, value: 100,
        rarity: "Incomum", type: "armor", itemType: "CHEST", slot: "chest", equipmentClass: "armor", armorType: "plate", levelReq: 8, tier: 4,
        baseStats: { defense: 12, hpMax: 36, str: 0.5 }, stats: { defense: 12, hpMax: 36, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("eg_head_l8", {
        name: "Elmo Coliseu", icon: "⌃", image: "assets/organized/items/helmets/helmets_008.png", price: 79, value: 79,
        rarity: "Incomum", type: "armor", itemType: "HEAD", slot: "head", equipmentClass: "armor", armorType: "plate", levelReq: 8, tier: 4,
        baseStats: { defense: 6, hpMax: 18 }, stats: { defense: 6, hpMax: 18 }, stackable: false, maxStack: 1
    });
    item("eg_legs_l8", {
        name: "Perneiras Coliseu", icon: "Ⅱ", image: "assets/organized/items/legs/legs_008.png", price: 90, value: 90,
        rarity: "Incomum", type: "armor", itemType: "LEGS", slot: "legs", equipmentClass: "armor", armorType: "plate", levelReq: 8, tier: 4,
        baseStats: { defense: 8, hpMax: 25 }, stats: { defense: 8, hpMax: 25 }, stackable: false, maxStack: 1
    });
    item("eg_feet_l8", {
        name: "Botas Coliseu", icon: "⌄", image: "assets/organized/items/boots/boots_008.png", price: 68, value: 68,
        rarity: "Incomum", type: "armor", itemType: "FEET", slot: "feet", equipmentClass: "armor", armorType: "plate", levelReq: 8, tier: 4,
        baseStats: { defense: 5, hpMax: 14, evasion: 0.003 }, stats: { defense: 5, hpMax: 14, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("eg_hands_l8", {
        name: "Luvas Coliseu", icon: "✥", price: 68, value: 68,
        rarity: "Incomum", type: "armor", itemType: "HANDS", slot: "hands", equipmentClass: "armor", armorType: "plate", levelReq: 8, tier: 4,
        baseStats: { defense: 5, hpMax: 14, precision: 1 }, stats: { defense: 5, hpMax: 14, precision: 1 }, stackable: false, maxStack: 1
    });
    item("eg_sword_l8", {
        name: "Espada Coliseu", icon: "⚔", image: "assets/organized/items/weapons/all/weapons_018.png", price: 462, value: 462,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { damageMin: 10, damageMax: 18, precision: 3 }, stats: { damageMin: 10, damageMax: 18, precision: 3 }, stackable: false, maxStack: 1
    });
    item("eg_axe_l8", {
        name: "Machado Coliseu", icon: "⚔", image: "assets/organized/items/weapons/axes/axe_l08.png", price: 462, value: 462,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { damageMin: 12, damageMax: 20, precision: 2, critical: 0.012 }, stats: { damageMin: 12, damageMax: 20, precision: 2, critical: 0.012 }, stackable: false, maxStack: 1
    });
    item("eg_mace_l8", {
        name: "Maça Coliseu", icon: "⚔", image: "assets/organized/items/weapons/maces/mace_l08.png", price: 462, value: 462,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { damageMin: 11, damageMax: 19, precision: 2, defense: 3 }, stats: { damageMin: 11, damageMax: 19, precision: 2, defense: 3 }, stackable: false, maxStack: 1
    });
    item("eg_dagger_l8", {
        name: "Adaga Coliseu", icon: "⚔", image: "assets/organized/items/weapons/daggers/dagger_l08.png", price: 462, value: 462,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { damageMin: 8, damageMax: 15, precision: 4, critical: 0.018 }, stats: { damageMin: 8, damageMax: 15, precision: 4, critical: 0.018 }, stackable: false, maxStack: 1
    });
    item("eg_bow_l8", {
        name: "Arco Coliseu", icon: "⚔", image: "assets/organized/items/weapons/bows/Icon21.png", price: 462, value: 462,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { damageMin: 10, damageMax: 16, precision: 5, critical: 0.01 }, stats: { damageMin: 10, damageMax: 16, precision: 5, critical: 0.01 }, stackable: false, maxStack: 1
    });
    item("eg_focus_l8", {
        name: "Foco Coliseu", icon: "⚔", image: "assets/organized/items/weapons/foco/focus_l08.png", price: 462, value: 462,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 8, tier: 4,
        baseStats: { damageMin: 8, damageMax: 14, precision: 3, mag: 6 }, stats: { damageMin: 8, damageMax: 14, precision: 3, mag: 6 }, stackable: false, maxStack: 1
    });
    item("eg_shield_l8", {
        name: "Escudo Coliseu", icon: "⬡", image: "assets/organized/items/shields/Shield_2/5.png", type: "shield", itemType: "SHIELD",
        slot: "offhand", levelReq: 8, tier: 4, equipmentClass: "defensive", rarity: "Incomum",
        price: 397, value: 397,
        stackable: false, maxStack: 1, baseStats: {"defense":8,"blockChance":0.049,"blockReduction":0.244}, stats: {"defense":8,"blockChance":0.049,"blockReduction":0.244},
        description: "Escudo de nível 8; melhora defesa e bloqueio sem criar imunidade."
    });
    item("eg_ring_l8", {
        name: "Anel Coliseu", icon: "○", image: "assets/organized/items/loot/all/loot_051.png", type: "accessory", itemType: "RING",
        slot: "ring1", allowedSlots: ["ring1", "ring2"], levelReq: 8, tier: 4,
        equipmentClass: "accessory", rarity: "Raro",
        price: 534, value: 534,
        stackable: false, maxStack: 1, baseStats: {"critical":0.012,"precision":3}, stats: {"critical":0.012,"precision":3},
        description: "Joia de nível 8; seus rolls podem colocá-la no ranking mundial."
    });

    // Set Rúnico (Nível 9)
    item("eg_chest_l9", {
        name: "Peitoral Rúnico", icon: "▣", image: "assets/organized/items/armor/armor_009.png", price: 110, value: 110,
        rarity: "Raro", type: "armor", itemType: "CHEST", slot: "chest", equipmentClass: "armor", armorType: "plate", levelReq: 9, tier: 5,
        baseStats: { defense: 13, hpMax: 40, str: 0.5 }, stats: { defense: 13, hpMax: 40, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("eg_head_l9", {
        name: "Elmo Rúnico", icon: "⌃", image: "assets/organized/items/helmets/helmets_009.png", price: 87, value: 87,
        rarity: "Raro", type: "armor", itemType: "HEAD", slot: "head", equipmentClass: "armor", armorType: "plate", levelReq: 9, tier: 5,
        baseStats: { defense: 7, hpMax: 20 }, stats: { defense: 7, hpMax: 20 }, stackable: false, maxStack: 1
    });
    item("eg_legs_l9", {
        name: "Perneiras Rúnico", icon: "Ⅱ", image: "assets/organized/items/legs/legs_009.png", price: 99, value: 99,
        rarity: "Raro", type: "armor", itemType: "LEGS", slot: "legs", equipmentClass: "armor", armorType: "plate", levelReq: 9, tier: 5,
        baseStats: { defense: 9, hpMax: 28 }, stats: { defense: 9, hpMax: 28 }, stackable: false, maxStack: 1
    });
    item("eg_feet_l9", {
        name: "Botas Rúnico", icon: "⌄", image: "assets/organized/items/boots/boots_009.png", price: 75, value: 75,
        rarity: "Raro", type: "armor", itemType: "FEET", slot: "feet", equipmentClass: "armor", armorType: "plate", levelReq: 9, tier: 5,
        baseStats: { defense: 5, hpMax: 16, evasion: 0.003 }, stats: { defense: 5, hpMax: 16, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("eg_hands_l9", {
        name: "Luvas Rúnico", icon: "✥", price: 75, value: 75,
        rarity: "Raro", type: "armor", itemType: "HANDS", slot: "hands", equipmentClass: "armor", armorType: "plate", levelReq: 9, tier: 5,
        baseStats: { defense: 5, hpMax: 16, precision: 1 }, stats: { defense: 5, hpMax: 16, precision: 1 }, stackable: false, maxStack: 1
    });
    item("eg_sword_l9", {
        name: "Espada Rúnico", icon: "⚔", image: "assets/organized/items/weapons/all/weapons_019.png", price: 581, value: 581,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { damageMin: 12, damageMax: 19, precision: 4 }, stats: { damageMin: 12, damageMax: 19, precision: 4 }, stackable: false, maxStack: 1
    });
    item("eg_axe_l9", {
        name: "Machado Rúnico", icon: "⚔", image: "assets/organized/items/weapons/axes/axe_l09.png", price: 581, value: 581,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { damageMin: 13, damageMax: 22, precision: 3, critical: 0.013 }, stats: { damageMin: 13, damageMax: 22, precision: 3, critical: 0.013 }, stackable: false, maxStack: 1
    });
    item("eg_mace_l9", {
        name: "Maça Rúnico", icon: "⚔", image: "assets/organized/items/weapons/maces/mace_l09.png", price: 581, value: 581,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { damageMin: 13, damageMax: 21, precision: 3, defense: 3 }, stats: { damageMin: 13, damageMax: 21, precision: 3, defense: 3 }, stackable: false, maxStack: 1
    });
    item("eg_dagger_l9", {
        name: "Adaga Rúnico", icon: "⚔", image: "assets/organized/items/weapons/daggers/dagger_l09.png", price: 581, value: 581,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { damageMin: 9, damageMax: 16, precision: 5, critical: 0.019 }, stats: { damageMin: 9, damageMax: 16, precision: 5, critical: 0.019 }, stackable: false, maxStack: 1
    });
    item("eg_bow_l9", {
        name: "Arco Rúnico", icon: "⚔", image: "assets/organized/items/weapons/bows/Icon24.png", price: 581, value: 581,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { damageMin: 11, damageMax: 18, precision: 6, critical: 0.011 }, stats: { damageMin: 11, damageMax: 18, precision: 6, critical: 0.011 }, stackable: false, maxStack: 1
    });
    item("eg_focus_l9", {
        name: "Foco Rúnico", icon: "⚔", image: "assets/organized/items/weapons/foco/focus_l09.png", price: 581, value: 581,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 9, tier: 5,
        baseStats: { damageMin: 9, damageMax: 15, precision: 4, mag: 6 }, stats: { damageMin: 9, damageMax: 15, precision: 4, mag: 6 }, stackable: false, maxStack: 1
    });
    item("eg_shield_l9", {
        name: "Escudo Rúnico", icon: "⬡", image: "assets/organized/items/shields/Shield_5/5.png", type: "shield", itemType: "SHIELD",
        slot: "offhand", levelReq: 9, tier: 5, equipmentClass: "defensive", rarity: "Raro",
        price: 499, value: 499,
        stackable: false, maxStack: 1, baseStats: {"defense":9,"blockChance":0.052,"blockReduction":0.252}, stats: {"defense":9,"blockChance":0.052,"blockReduction":0.252},
        description: "Escudo de nível 9; melhora defesa e bloqueio sem criar imunidade."
    });
    item("eg_ring_l9", {
        name: "Anel Rúnico", icon: "○", image: "assets/organized/items/loot/all/loot_051.png", type: "accessory", itemType: "RING",
        slot: "ring1", allowedSlots: ["ring1", "ring2"], levelReq: 9, tier: 5,
        equipmentClass: "accessory", rarity: "Raro",
        price: 670, value: 670,
        stackable: false, maxStack: 1, baseStats: {"hpMax":20,"manaMax":10}, stats: {"hpMax":20,"manaMax":10},
        description: "Joia de nível 9; seus rolls podem colocá-la no ranking mundial."
    });

    // Set Aetheriano (Nível 10)
    item("eg_chest_l10", {
        name: "Peitoral Aetheriano", icon: "▣", image: "assets/organized/items/armor/armor_010.png", price: 120, value: 120,
        rarity: "Raro", type: "armor", itemType: "CHEST", slot: "chest", equipmentClass: "armor", armorType: "plate", levelReq: 10, tier: 5,
        baseStats: { defense: 14, hpMax: 45, str: 0.5 }, stats: { defense: 14, hpMax: 45, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("eg_head_l10", {
        name: "Elmo Aetheriano", icon: "⌃", image: "assets/organized/items/helmets/helmets_010.png", price: 95, value: 95,
        rarity: "Raro", type: "armor", itemType: "HEAD", slot: "head", equipmentClass: "armor", armorType: "plate", levelReq: 10, tier: 5,
        baseStats: { defense: 7, hpMax: 23 }, stats: { defense: 7, hpMax: 23 }, stackable: false, maxStack: 1
    });
    item("eg_legs_l10", {
        name: "Perneiras Aetheriano", icon: "Ⅱ", image: "assets/organized/items/legs/legs_010.png", price: 108, value: 108,
        rarity: "Raro", type: "armor", itemType: "LEGS", slot: "legs", equipmentClass: "armor", armorType: "plate", levelReq: 10, tier: 5,
        baseStats: { defense: 10, hpMax: 31 }, stats: { defense: 10, hpMax: 31 }, stackable: false, maxStack: 1
    });
    item("eg_feet_l10", {
        name: "Botas Aetheriano", icon: "⌄", image: "assets/organized/items/boots/boots_010.png", price: 82, value: 82,
        rarity: "Raro", type: "armor", itemType: "FEET", slot: "feet", equipmentClass: "armor", armorType: "plate", levelReq: 10, tier: 5,
        baseStats: { defense: 6, hpMax: 18, evasion: 0.003 }, stats: { defense: 6, hpMax: 18, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("eg_hands_l10", {
        name: "Luvas Aetheriano", icon: "✥", price: 82, value: 82,
        rarity: "Raro", type: "armor", itemType: "HANDS", slot: "hands", equipmentClass: "armor", armorType: "plate", levelReq: 10, tier: 5,
        baseStats: { defense: 6, hpMax: 18, precision: 1 }, stats: { defense: 6, hpMax: 18, precision: 1 }, stackable: false, maxStack: 1
    });
    item("eg_sword_l10", {
        name: "Espada Aetheriano", icon: "⚔", image: "assets/organized/items/weapons/all/weapons_020.png", price: 714, value: 714,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { damageMin: 13, damageMax: 21, precision: 4 }, stats: { damageMin: 13, damageMax: 21, precision: 4 }, stackable: false, maxStack: 1
    });
    item("eg_axe_l10", {
        name: "Machado Aetheriano", icon: "⚔", image: "assets/organized/items/weapons/axes/axe_l10.png", price: 714, value: 714,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { damageMin: 15, damageMax: 24, precision: 3, critical: 0.014 }, stats: { damageMin: 15, damageMax: 24, precision: 3, critical: 0.014 }, stackable: false, maxStack: 1
    });
    item("eg_mace_l10", {
        name: "Maça Aetheriano", icon: "⚔", image: "assets/organized/items/weapons/maces/mace_l10.png", price: 714, value: 714,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { damageMin: 14, damageMax: 23, precision: 3, defense: 3 }, stats: { damageMin: 14, damageMax: 23, precision: 3, defense: 3 }, stackable: false, maxStack: 1
    });
    item("eg_dagger_l10", {
        name: "Adaga Aetheriano", icon: "⚔", image: "assets/organized/items/weapons/daggers/dagger_l10.png", price: 714, value: 714,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { damageMin: 10, damageMax: 17, precision: 5, critical: 0.02 }, stats: { damageMin: 10, damageMax: 17, precision: 5, critical: 0.02 }, stackable: false, maxStack: 1
    });
    item("eg_bow_l10", {
        name: "Arco Aetheriano", icon: "⚔", image: "assets/organized/items/weapons/bows/Icon22.png", price: 714, value: 714,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { damageMin: 12, damageMax: 19, precision: 6, critical: 0.012 }, stats: { damageMin: 12, damageMax: 19, precision: 6, critical: 0.012 }, stackable: false, maxStack: 1
    });
    item("eg_focus_l10", {
        name: "Foco Aetheriano", icon: "⚔", image: "assets/organized/items/weapons/foco/focus_l10.png", price: 714, value: 714,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 10, tier: 5,
        baseStats: { damageMin: 10, damageMax: 17, precision: 4, mag: 7 }, stats: { damageMin: 10, damageMax: 17, precision: 4, mag: 7 }, stackable: false, maxStack: 1
    });
    item("eg_shield_l10", {
        name: "Escudo Aetheriano", icon: "⬡", image: "assets/organized/items/shields/Shield_7/5.png", type: "shield", itemType: "SHIELD",
        slot: "offhand", levelReq: 10, tier: 5, equipmentClass: "defensive", rarity: "Raro",
        price: 613, value: 613,
        stackable: false, maxStack: 1, baseStats: {"defense":10,"blockChance":0.055,"blockReduction":0.26}, stats: {"defense":10,"blockChance":0.055,"blockReduction":0.26},
        description: "Escudo de nível 10; melhora defesa e bloqueio sem criar imunidade."
    });
    item("eg_ring_l10", {
        name: "Anel Aetheriano", icon: "○", image: "assets/organized/items/loot/all/loot_051.png", type: "accessory", itemType: "RING",
        slot: "ring1", allowedSlots: ["ring1", "ring2"], levelReq: 10, tier: 5,
        equipmentClass: "accessory", rarity: "Raro",
        price: 822, value: 822,
        stackable: false, maxStack: 1, baseStats: {"critical":0.014,"precision":3}, stats: {"critical":0.014,"precision":3},
        description: "Joia de nível 10; seus rolls podem colocá-la no ranking mundial."
    });

    // ── Ferramentas de profissão (exigidas por ProfessionSystem) ──
    item("apprentice_pickaxe", {
        name: "Picareta de Aprendiz", icon: "⛏", image: "assets/organized/items/materials/all/materials_001.png", price: 25, value: 25,
        rarity: "Comum", type: "tool", itemType: "TOOL", toolType: "mining", levelReq: 1, tier: 1,
        stackable: false, maxStack: 1, description: "Ferramenta básica para extrair minérios em campo."
    });
    item("skinning_knife", {
        name: "Faca de Esfolar", icon: "◒", image: "assets/organized/items/loot/all/loot_066.png", price: 25, value: 25,
        rarity: "Comum", type: "tool", itemType: "TOOL", toolType: "skinning", levelReq: 1, tier: 1,
        stackable: false, maxStack: 1, description: "Lâmina curva para extrair couro de criaturas abatidas."
    });
    item("herb_knife", {
        name: "Foice de Herbalista", icon: "❧", image: "assets/organized/items/loot/all/loot_084.png", price: 25, value: 25,
        rarity: "Comum", type: "tool", itemType: "TOOL", toolType: "herbalism", levelReq: 1, tier: 1,
        stackable: false, maxStack: 1, description: "Corta ervas sem danificar as propriedades alquímicas."
    });
    item("smith_hammer", {
        name: "Martelo de Forja", icon: "⚒", image: "assets/organized/items/weapons/all/weapons_002.png", price: 25, value: 25,
        rarity: "Comum", type: "tool", itemType: "TOOL", toolType: "smithing", levelReq: 1, tier: 1,
        stackable: false, maxStack: 1, description: "Martelo pesado usado para refinar lingotes na forja."
    });


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
        return [
            `eg_sword_l${safeLevel}`, `eg_axe_l${safeLevel}`, `eg_mace_l${safeLevel}`,
            `eg_dagger_l${safeLevel}`, `eg_bow_l${safeLevel}`, `eg_focus_l${safeLevel}`,
            `eg_shield_l${safeLevel}`,
            `eg_ring_l${safeLevel}`,
            `eg_head_l${safeLevel}`,
            `eg_chest_l${safeLevel}`,
            `eg_hands_l${safeLevel}`,
            `eg_legs_l${safeLevel}`,
            `eg_feet_l${safeLevel}`
        ];
    }

    function signatureMaterials(monster) {
        const type = String(monster?.type || monster?.lootProfile || "default").toLowerCase();
        const materials = FAMILY_MATERIALS[type] || FAMILY_MATERIALS.default;
        const name = normalize(monster?.name || monster?.id);
        const extras = [];
        if (type === "beast" || type === "monstrosity") extras.push("chipped_claw");
        if (type === "beast") extras.push("coarse_fur");
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
            ...materials.slice(2).map((id, index) => ({
                id,
                chance: index === 0 ? 0.055 : 0.04,
                minQuantity: 1,
                maxQuantity: 1,
                sourceClass: index === 0 ? "rare-material" : "signature-material"
            })),
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
