
    // ── Armaduras e Armas baseadas nos Assets Curados (Nível 1 a 10) ──

    // Set Recruta (Nível 1)
    item("chest_1", {
        name: "Peitoral Recruta", icon: "▣", image: "assets/organized/items/armor/Icon30_11.png", price: 30, value: 30,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "chest", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { defense: 3, hpMax: 4, str: 0.5 }, stats: { defense: 3, hpMax: 4, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("head_1", {
        name: "Elmo Recruta", icon: "⌃", image: "assets/organized/items/helmets/Icon30_01.png", price: 23, value: 23,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "head", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { defense: 2, hpMax: 2 }, stats: { defense: 2, hpMax: 2 }, stackable: false, maxStack: 1
    });
    item("legs_1", {
        name: "Perneiras Recruta", icon: "Ⅱ", image: "assets/organized/items/legs/Icon30_21.png", price: 27, value: 27,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "legs", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { defense: 2, hpMax: 3 }, stats: { defense: 2, hpMax: 3 }, stackable: false, maxStack: 1
    });
    item("feet_1", {
        name: "Botas Recruta", icon: "⌄", image: "assets/organized/items/boots/Icon30_31.png", price: 19, value: 19,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "feet", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { defense: 1, hpMax: 2, evasion: 0.003 }, stats: { defense: 1, hpMax: 2, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("hands_1", {
        name: "Luvas Recruta", icon: "✥", image: "assets/craftpix/craftpix-net-127812-free-clothing-32x32-pixel-icons/PNG/06/06_1.png", price: 19, value: 19,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "hands", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { defense: 1, hpMax: 2, precision: 1 }, stats: { defense: 1, hpMax: 2, precision: 1 }, stackable: false, maxStack: 1
    });
    item("sword_1", {
        name: "Espada Recruta", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_01.png", price: 21, value: 21,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { damageMin: 3, damageMax: 5, precision: 1 }, stats: { damageMin: 3, damageMax: 5, precision: 1 }, stackable: false, maxStack: 1
    });
    item("axe_1", {
        name: "Machado Recruta", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_11.png", price: 21, value: 21,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { damageMin: 3, damageMax: 6, precision: 0, critical: 0.007 }, stats: { damageMin: 3, damageMax: 6, precision: 0, critical: 0.007 }, stackable: false, maxStack: 1
    });
    item("mace_1", {
        name: "Maça Recruta", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_21.png", price: 21, value: 21,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { damageMin: 3, damageMax: 6, precision: 0, defense: 1 }, stats: { damageMin: 3, damageMax: 6, precision: 0, defense: 1 }, stackable: false, maxStack: 1
    });
    item("dagger_1", {
        name: "Adaga Recruta", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_31.png", price: 21, value: 21,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { damageMin: 2, damageMax: 4, precision: 2, critical: 0.013 }, stats: { damageMin: 2, damageMax: 4, precision: 2, critical: 0.013 }, stackable: false, maxStack: 1
    });
    item("bow_1", {
        name: "Arco Recruta", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_01.png", price: 21, value: 21,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 1, tier: 1,
        baseStats: { damageMin: 2, damageMax: 5, precision: 3, critical: 0.005 }, stats: { damageMin: 2, damageMax: 5, precision: 3, critical: 0.005 }, stackable: false, maxStack: 1
    });
    item("focus_1", {
        name: "Foco Recruta", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_11.png", price: 21, value: 21,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 1, tier: 1,
        baseStats: { damageMin: 2, damageMax: 4, precision: 1, mag: 2 }, stats: { damageMin: 2, damageMax: 4, precision: 1, mag: 2 }, stackable: false, maxStack: 1
    });

    // Set Aventureiro (Nível 2)
    item("chest_2", {
        name: "Peitoral Aventureiro", icon: "▣", image: "assets/organized/items/armor/Icon30_12.png", price: 40, value: 40,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "chest", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { defense: 4, hpMax: 9, str: 0.5 }, stats: { defense: 4, hpMax: 9, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("head_2", {
        name: "Elmo Aventureiro", icon: "⌃", image: "assets/organized/items/helmets/Icon30_02.png", price: 31, value: 31,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "head", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { defense: 2, hpMax: 5 }, stats: { defense: 2, hpMax: 5 }, stackable: false, maxStack: 1
    });
    item("legs_2", {
        name: "Perneiras Aventureiro", icon: "Ⅱ", image: "assets/organized/items/legs/Icon30_22.png", price: 36, value: 36,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "legs", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { defense: 3, hpMax: 6 }, stats: { defense: 3, hpMax: 6 }, stackable: false, maxStack: 1
    });
    item("feet_2", {
        name: "Botas Aventureiro", icon: "⌄", image: "assets/organized/items/boots/Icon30_32.png", price: 26, value: 26,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "feet", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { defense: 2, hpMax: 4, evasion: 0.003 }, stats: { defense: 2, hpMax: 4, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("hands_2", {
        name: "Luvas Aventureiro", icon: "✥", image: "assets/craftpix/craftpix-net-127812-free-clothing-32x32-pixel-icons/PNG/06/06_1.png", price: 26, value: 26,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "hands", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { defense: 2, hpMax: 4, precision: 1 }, stats: { defense: 2, hpMax: 4, precision: 1 }, stackable: false, maxStack: 1
    });
    item("sword_2", {
        name: "Espada Aventureiro", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_02.png", price: 42, value: 42,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { damageMin: 4, damageMax: 7, precision: 1 }, stats: { damageMin: 4, damageMax: 7, precision: 1 }, stackable: false, maxStack: 1
    });
    item("axe_2", {
        name: "Machado Aventureiro", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_12.png", price: 42, value: 42,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { damageMin: 4, damageMax: 8, precision: 0, critical: 0.008 }, stats: { damageMin: 4, damageMax: 8, precision: 0, critical: 0.008 }, stackable: false, maxStack: 1
    });
    item("mace_2", {
        name: "Maça Aventureiro", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_22.png", price: 42, value: 42,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { damageMin: 4, damageMax: 7, precision: 0, defense: 1 }, stats: { damageMin: 4, damageMax: 7, precision: 0, defense: 1 }, stackable: false, maxStack: 1
    });
    item("dagger_2", {
        name: "Adaga Aventureiro", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_32.png", price: 42, value: 42,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { damageMin: 3, damageMax: 6, precision: 2, critical: 0.014 }, stats: { damageMin: 3, damageMax: 6, precision: 2, critical: 0.014 }, stackable: false, maxStack: 1
    });
    item("bow_2", {
        name: "Arco Aventureiro", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_02.png", price: 42, value: 42,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 2, tier: 1,
        baseStats: { damageMin: 3, damageMax: 6, precision: 3, critical: 0.006 }, stats: { damageMin: 3, damageMax: 6, precision: 3, critical: 0.006 }, stackable: false, maxStack: 1
    });
    item("focus_2", {
        name: "Foco Aventureiro", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_12.png", price: 42, value: 42,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 2, tier: 1,
        baseStats: { damageMin: 3, damageMax: 6, precision: 1, mag: 3 }, stats: { damageMin: 3, damageMax: 6, precision: 1, mag: 3 }, stackable: false, maxStack: 1
    });

    // Set Vybe (Nível 3)
    item("chest_3", {
        name: "Peitoral Vybe", icon: "▣", image: "assets/organized/items/armor/Icon30_13.png", price: 50, value: 50,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "chest", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { defense: 6, hpMax: 13, str: 0.5 }, stats: { defense: 6, hpMax: 13, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("head_3", {
        name: "Elmo Vybe", icon: "⌃", image: "assets/organized/items/helmets/Icon30_03.png", price: 39, value: 39,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "head", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { defense: 3, hpMax: 7 }, stats: { defense: 3, hpMax: 7 }, stackable: false, maxStack: 1
    });
    item("legs_3", {
        name: "Perneiras Vybe", icon: "Ⅱ", image: "assets/organized/items/legs/Icon30_23.png", price: 45, value: 45,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "legs", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { defense: 4, hpMax: 9 }, stats: { defense: 4, hpMax: 9 }, stackable: false, maxStack: 1
    });
    item("feet_3", {
        name: "Botas Vybe", icon: "⌄", image: "assets/organized/items/boots/Icon30_33.png", price: 33, value: 33,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "feet", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { defense: 2, hpMax: 5, evasion: 0.003 }, stats: { defense: 2, hpMax: 5, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("hands_3", {
        name: "Luvas Vybe", icon: "✥", image: "assets/craftpix/craftpix-net-127812-free-clothing-32x32-pixel-icons/PNG/06/06_1.png", price: 33, value: 33,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "hands", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { defense: 2, hpMax: 5, precision: 1 }, stats: { defense: 2, hpMax: 5, precision: 1 }, stackable: false, maxStack: 1
    });
    item("sword_3", {
        name: "Espada Vybe", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_03.png", price: 77, value: 77,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { damageMin: 5, damageMax: 9, precision: 2 }, stats: { damageMin: 5, damageMax: 9, precision: 2 }, stackable: false, maxStack: 1
    });
    item("axe_3", {
        name: "Machado Vybe", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_13.png", price: 77, value: 77,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { damageMin: 6, damageMax: 10, precision: 1, critical: 0.008 }, stats: { damageMin: 6, damageMax: 10, precision: 1, critical: 0.008 }, stackable: false, maxStack: 1
    });
    item("mace_3", {
        name: "Maça Vybe", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_23.png", price: 77, value: 77,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { damageMin: 5, damageMax: 9, precision: 1, defense: 1 }, stats: { damageMin: 5, damageMax: 9, precision: 1, defense: 1 }, stackable: false, maxStack: 1
    });
    item("dagger_3", {
        name: "Adaga Vybe", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_33.png", price: 77, value: 77,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { damageMin: 4, damageMax: 7, precision: 3, critical: 0.014 }, stats: { damageMin: 4, damageMax: 7, precision: 3, critical: 0.014 }, stackable: false, maxStack: 1
    });
    item("bow_3", {
        name: "Arco Vybe", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_03.png", price: 77, value: 77,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 3, tier: 2,
        baseStats: { damageMin: 4, damageMax: 8, precision: 4, critical: 0.006 }, stats: { damageMin: 4, damageMax: 8, precision: 4, critical: 0.006 }, stackable: false, maxStack: 1
    });
    item("focus_3", {
        name: "Foco Vybe", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_13.png", price: 77, value: 77,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 3, tier: 2,
        baseStats: { damageMin: 4, damageMax: 7, precision: 2, mag: 3 }, stats: { damageMin: 4, damageMax: 7, precision: 2, mag: 3 }, stackable: false, maxStack: 1
    });

    // Set Guarda (Nível 4)
    item("chest_4", {
        name: "Peitoral Guarda", icon: "▣", image: "assets/organized/items/armor/Icon30_14.png", price: 60, value: 60,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "chest", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { defense: 7, hpMax: 18, str: 0.5 }, stats: { defense: 7, hpMax: 18, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("head_4", {
        name: "Elmo Guarda", icon: "⌃", image: "assets/organized/items/helmets/Icon30_04.png", price: 47, value: 47,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "head", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { defense: 4, hpMax: 9 }, stats: { defense: 4, hpMax: 9 }, stackable: false, maxStack: 1
    });
    item("legs_4", {
        name: "Perneiras Guarda", icon: "Ⅱ", image: "assets/organized/items/legs/Icon30_24.png", price: 54, value: 54,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "legs", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { defense: 5, hpMax: 13 }, stats: { defense: 5, hpMax: 13 }, stackable: false, maxStack: 1
    });
    item("feet_4", {
        name: "Botas Guarda", icon: "⌄", image: "assets/organized/items/boots/Icon30_34.png", price: 40, value: 40,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "feet", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { defense: 3, hpMax: 7, evasion: 0.003 }, stats: { defense: 3, hpMax: 7, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("hands_4", {
        name: "Luvas Guarda", icon: "✥", image: "assets/craftpix/craftpix-net-127812-free-clothing-32x32-pixel-icons/PNG/06/06_1.png", price: 40, value: 40,
        rarity: "Comum", type: "armor", itemType: "ARMOR", slot: "hands", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { defense: 3, hpMax: 7, precision: 1 }, stats: { defense: 3, hpMax: 7, precision: 1 }, stackable: false, maxStack: 1
    });
    item("sword_4", {
        name: "Espada Guarda", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_04.png", price: 126, value: 126,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { damageMin: 6, damageMax: 11, precision: 2 }, stats: { damageMin: 6, damageMax: 11, precision: 2 }, stackable: false, maxStack: 1
    });
    item("axe_4", {
        name: "Machado Guarda", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_14.png", price: 126, value: 126,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { damageMin: 7, damageMax: 12, precision: 1, critical: 0.009 }, stats: { damageMin: 7, damageMax: 12, precision: 1, critical: 0.009 }, stackable: false, maxStack: 1
    });
    item("mace_4", {
        name: "Maça Guarda", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_24.png", price: 126, value: 126,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { damageMin: 6, damageMax: 11, precision: 1, defense: 2 }, stats: { damageMin: 6, damageMax: 11, precision: 1, defense: 2 }, stackable: false, maxStack: 1
    });
    item("dagger_4", {
        name: "Adaga Guarda", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_34.png", price: 126, value: 126,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { damageMin: 5, damageMax: 9, precision: 3, critical: 0.015 }, stats: { damageMin: 5, damageMax: 9, precision: 3, critical: 0.015 }, stackable: false, maxStack: 1
    });
    item("bow_4", {
        name: "Arco Guarda", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_04.png", price: 126, value: 126,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 4, tier: 2,
        baseStats: { damageMin: 5, damageMax: 10, precision: 4, critical: 0.007 }, stats: { damageMin: 5, damageMax: 10, precision: 4, critical: 0.007 }, stackable: false, maxStack: 1
    });
    item("focus_4", {
        name: "Foco Guarda", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_14.png", price: 126, value: 126,
        rarity: "Comum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 4, tier: 2,
        baseStats: { damageMin: 4, damageMax: 8, precision: 2, mag: 4 }, stats: { damageMin: 4, damageMax: 8, precision: 2, mag: 4 }, stackable: false, maxStack: 1
    });

    // Set Mercenário (Nível 5)
    item("chest_5", {
        name: "Peitoral Mercenário", icon: "▣", image: "assets/organized/items/armor/Icon30_15.png", price: 70, value: 70,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "chest", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { defense: 8, hpMax: 22, str: 0.5 }, stats: { defense: 8, hpMax: 22, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("head_5", {
        name: "Elmo Mercenário", icon: "⌃", image: "assets/organized/items/helmets/Icon30_05.png", price: 55, value: 55,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "head", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { defense: 4, hpMax: 11 }, stats: { defense: 4, hpMax: 11 }, stackable: false, maxStack: 1
    });
    item("legs_5", {
        name: "Perneiras Mercenário", icon: "Ⅱ", image: "assets/organized/items/legs/Icon30_25.png", price: 63, value: 63,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "legs", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { defense: 6, hpMax: 15 }, stats: { defense: 6, hpMax: 15 }, stackable: false, maxStack: 1
    });
    item("feet_5", {
        name: "Botas Mercenário", icon: "⌄", image: "assets/organized/items/boots/Icon30_35.png", price: 47, value: 47,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "feet", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { defense: 3, hpMax: 9, evasion: 0.003 }, stats: { defense: 3, hpMax: 9, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("hands_5", {
        name: "Luvas Mercenário", icon: "✥", image: "assets/craftpix/craftpix-net-127812-free-clothing-32x32-pixel-icons/PNG/06/06_1.png", price: 47, value: 47,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "hands", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { defense: 3, hpMax: 9, precision: 1 }, stats: { defense: 3, hpMax: 9, precision: 1 }, stackable: false, maxStack: 1
    });
    item("sword_5", {
        name: "Espada Mercenário", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_05.png", price: 189, value: 189,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { damageMin: 7, damageMax: 12, precision: 2 }, stats: { damageMin: 7, damageMax: 12, precision: 2 }, stackable: false, maxStack: 1
    });
    item("axe_5", {
        name: "Machado Mercenário", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_15.png", price: 189, value: 189,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { damageMin: 8, damageMax: 14, precision: 1, critical: 0.01 }, stats: { damageMin: 8, damageMax: 14, precision: 1, critical: 0.01 }, stackable: false, maxStack: 1
    });
    item("mace_5", {
        name: "Maça Mercenário", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_25.png", price: 189, value: 189,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { damageMin: 8, damageMax: 13, precision: 1, defense: 2 }, stats: { damageMin: 8, damageMax: 13, precision: 1, defense: 2 }, stackable: false, maxStack: 1
    });
    item("dagger_5", {
        name: "Adaga Mercenário", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_35.png", price: 189, value: 189,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { damageMin: 6, damageMax: 10, precision: 3, critical: 0.016 }, stats: { damageMin: 6, damageMax: 10, precision: 3, critical: 0.016 }, stackable: false, maxStack: 1
    });
    item("bow_5", {
        name: "Arco Mercenário", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_05.png", price: 189, value: 189,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 5, tier: 3,
        baseStats: { damageMin: 6, damageMax: 11, precision: 4, critical: 0.008 }, stats: { damageMin: 6, damageMax: 11, precision: 4, critical: 0.008 }, stackable: false, maxStack: 1
    });
    item("focus_5", {
        name: "Foco Mercenário", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_15.png", price: 189, value: 189,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 5, tier: 3,
        baseStats: { damageMin: 5, damageMax: 10, precision: 2, mag: 4 }, stats: { damageMin: 5, damageMax: 10, precision: 2, mag: 4 }, stackable: false, maxStack: 1
    });

    // Set Explorador (Nível 6)
    item("chest_6", {
        name: "Peitoral Explorador", icon: "▣", image: "assets/organized/items/armor/Icon30_16.png", price: 80, value: 80,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "chest", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { defense: 9, hpMax: 27, str: 0.5 }, stats: { defense: 9, hpMax: 27, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("head_6", {
        name: "Elmo Explorador", icon: "⌃", image: "assets/organized/items/helmets/Icon30_06.png", price: 63, value: 63,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "head", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { defense: 5, hpMax: 14 }, stats: { defense: 5, hpMax: 14 }, stackable: false, maxStack: 1
    });
    item("legs_6", {
        name: "Perneiras Explorador", icon: "Ⅱ", image: "assets/organized/items/legs/Icon30_26.png", price: 72, value: 72,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "legs", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { defense: 6, hpMax: 19 }, stats: { defense: 6, hpMax: 19 }, stackable: false, maxStack: 1
    });
    item("feet_6", {
        name: "Botas Explorador", icon: "⌄", image: "assets/organized/items/boots/Icon30_36.png", price: 54, value: 54,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "feet", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { defense: 4, hpMax: 11, evasion: 0.003 }, stats: { defense: 4, hpMax: 11, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("hands_6", {
        name: "Luvas Explorador", icon: "✥", image: "assets/craftpix/craftpix-net-127812-free-clothing-32x32-pixel-icons/PNG/06/06_1.png", price: 54, value: 54,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "hands", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { defense: 4, hpMax: 11, precision: 1 }, stats: { defense: 4, hpMax: 11, precision: 1 }, stackable: false, maxStack: 1
    });
    item("sword_6", {
        name: "Espada Explorador", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_06.png", price: 266, value: 266,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { damageMin: 8, damageMax: 14, precision: 3 }, stats: { damageMin: 8, damageMax: 14, precision: 3 }, stackable: false, maxStack: 1
    });
    item("axe_6", {
        name: "Machado Explorador", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_16.png", price: 266, value: 266,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { damageMin: 9, damageMax: 16, precision: 2, critical: 0.011 }, stats: { damageMin: 9, damageMax: 16, precision: 2, critical: 0.011 }, stackable: false, maxStack: 1
    });
    item("mace_6", {
        name: "Maça Explorador", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_26.png", price: 266, value: 266,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { damageMin: 9, damageMax: 15, precision: 2, defense: 2 }, stats: { damageMin: 9, damageMax: 15, precision: 2, defense: 2 }, stackable: false, maxStack: 1
    });
    item("dagger_6", {
        name: "Adaga Explorador", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_36.png", price: 266, value: 266,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { damageMin: 7, damageMax: 12, precision: 4, critical: 0.017 }, stats: { damageMin: 7, damageMax: 12, precision: 4, critical: 0.017 }, stackable: false, maxStack: 1
    });
    item("bow_6", {
        name: "Arco Explorador", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_06.png", price: 266, value: 266,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 6, tier: 3,
        baseStats: { damageMin: 7, damageMax: 13, precision: 5, critical: 0.009 }, stats: { damageMin: 7, damageMax: 13, precision: 5, critical: 0.009 }, stackable: false, maxStack: 1
    });
    item("focus_6", {
        name: "Foco Explorador", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_16.png", price: 266, value: 266,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 6, tier: 3,
        baseStats: { damageMin: 6, damageMax: 11, precision: 3, mag: 5 }, stats: { damageMin: 6, damageMax: 11, precision: 3, mag: 5 }, stackable: false, maxStack: 1
    });

    // Set Veterano (Nível 7)
    item("chest_7", {
        name: "Peitoral Veterano", icon: "▣", image: "assets/organized/items/armor/Icon30_17.png", price: 90, value: 90,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "chest", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { defense: 11, hpMax: 31, str: 0.5 }, stats: { defense: 11, hpMax: 31, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("head_7", {
        name: "Elmo Veterano", icon: "⌃", image: "assets/organized/items/helmets/Icon30_07.png", price: 71, value: 71,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "head", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { defense: 6, hpMax: 16 }, stats: { defense: 6, hpMax: 16 }, stackable: false, maxStack: 1
    });
    item("legs_7", {
        name: "Perneiras Veterano", icon: "Ⅱ", image: "assets/organized/items/legs/Icon30_27.png", price: 81, value: 81,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "legs", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { defense: 8, hpMax: 22 }, stats: { defense: 8, hpMax: 22 }, stackable: false, maxStack: 1
    });
    item("feet_7", {
        name: "Botas Veterano", icon: "⌄", image: "assets/organized/items/boots/Icon30_37.png", price: 61, value: 61,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "feet", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { defense: 4, hpMax: 12, evasion: 0.003 }, stats: { defense: 4, hpMax: 12, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("hands_7", {
        name: "Luvas Veterano", icon: "✥", image: "assets/craftpix/craftpix-net-127812-free-clothing-32x32-pixel-icons/PNG/06/06_1.png", price: 61, value: 61,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "hands", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { defense: 4, hpMax: 12, precision: 1 }, stats: { defense: 4, hpMax: 12, precision: 1 }, stackable: false, maxStack: 1
    });
    item("sword_7", {
        name: "Espada Veterano", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_07.png", price: 357, value: 357,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { damageMin: 9, damageMax: 16, precision: 3 }, stats: { damageMin: 9, damageMax: 16, precision: 3 }, stackable: false, maxStack: 1
    });
    item("axe_7", {
        name: "Machado Veterano", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_17.png", price: 357, value: 357,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { damageMin: 11, damageMax: 18, precision: 2, critical: 0.012 }, stats: { damageMin: 11, damageMax: 18, precision: 2, critical: 0.012 }, stackable: false, maxStack: 1
    });
    item("mace_7", {
        name: "Maça Veterano", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_27.png", price: 357, value: 357,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { damageMin: 10, damageMax: 17, precision: 2, defense: 2 }, stats: { damageMin: 10, damageMax: 17, precision: 2, defense: 2 }, stackable: false, maxStack: 1
    });
    item("dagger_7", {
        name: "Adaga Veterano", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_37.png", price: 357, value: 357,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { damageMin: 8, damageMax: 13, precision: 4, critical: 0.018 }, stats: { damageMin: 8, damageMax: 13, precision: 4, critical: 0.018 }, stackable: false, maxStack: 1
    });
    item("bow_7", {
        name: "Arco Veterano", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_07.png", price: 357, value: 357,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 7, tier: 4,
        baseStats: { damageMin: 9, damageMax: 15, precision: 5, critical: 0.01 }, stats: { damageMin: 9, damageMax: 15, precision: 5, critical: 0.01 }, stackable: false, maxStack: 1
    });
    item("focus_7", {
        name: "Foco Veterano", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_17.png", price: 357, value: 357,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 7, tier: 4,
        baseStats: { damageMin: 7, damageMax: 12, precision: 3, mag: 5 }, stats: { damageMin: 7, damageMax: 12, precision: 3, mag: 5 }, stackable: false, maxStack: 1
    });

    // Set Coliseu (Nível 8)
    item("chest_8", {
        name: "Peitoral Coliseu", icon: "▣", image: "assets/organized/items/armor/Icon30_18.png", price: 100, value: 100,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "chest", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { defense: 12, hpMax: 36, str: 0.5 }, stats: { defense: 12, hpMax: 36, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("head_8", {
        name: "Elmo Coliseu", icon: "⌃", image: "assets/organized/items/helmets/Icon30_08.png", price: 79, value: 79,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "head", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { defense: 6, hpMax: 18 }, stats: { defense: 6, hpMax: 18 }, stackable: false, maxStack: 1
    });
    item("legs_8", {
        name: "Perneiras Coliseu", icon: "Ⅱ", image: "assets/organized/items/legs/Icon30_28.png", price: 90, value: 90,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "legs", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { defense: 8, hpMax: 25 }, stats: { defense: 8, hpMax: 25 }, stackable: false, maxStack: 1
    });
    item("feet_8", {
        name: "Botas Coliseu", icon: "⌄", image: "assets/organized/items/boots/Icon30_38.png", price: 68, value: 68,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "feet", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { defense: 5, hpMax: 14, evasion: 0.003 }, stats: { defense: 5, hpMax: 14, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("hands_8", {
        name: "Luvas Coliseu", icon: "✥", image: "assets/craftpix/craftpix-net-127812-free-clothing-32x32-pixel-icons/PNG/06/06_1.png", price: 68, value: 68,
        rarity: "Incomum", type: "armor", itemType: "ARMOR", slot: "hands", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { defense: 5, hpMax: 14, precision: 1 }, stats: { defense: 5, hpMax: 14, precision: 1 }, stackable: false, maxStack: 1
    });
    item("sword_8", {
        name: "Espada Coliseu", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_08.png", price: 462, value: 462,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { damageMin: 10, damageMax: 18, precision: 3 }, stats: { damageMin: 10, damageMax: 18, precision: 3 }, stackable: false, maxStack: 1
    });
    item("axe_8", {
        name: "Machado Coliseu", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_18.png", price: 462, value: 462,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { damageMin: 12, damageMax: 20, precision: 2, critical: 0.012 }, stats: { damageMin: 12, damageMax: 20, precision: 2, critical: 0.012 }, stackable: false, maxStack: 1
    });
    item("mace_8", {
        name: "Maça Coliseu", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_28.png", price: 462, value: 462,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { damageMin: 11, damageMax: 19, precision: 2, defense: 3 }, stats: { damageMin: 11, damageMax: 19, precision: 2, defense: 3 }, stackable: false, maxStack: 1
    });
    item("dagger_8", {
        name: "Adaga Coliseu", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_38.png", price: 462, value: 462,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { damageMin: 8, damageMax: 15, precision: 4, critical: 0.018 }, stats: { damageMin: 8, damageMax: 15, precision: 4, critical: 0.018 }, stackable: false, maxStack: 1
    });
    item("bow_8", {
        name: "Arco Coliseu", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_08.png", price: 462, value: 462,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 8, tier: 4,
        baseStats: { damageMin: 10, damageMax: 16, precision: 5, critical: 0.01 }, stats: { damageMin: 10, damageMax: 16, precision: 5, critical: 0.01 }, stackable: false, maxStack: 1
    });
    item("focus_8", {
        name: "Foco Coliseu", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_18.png", price: 462, value: 462,
        rarity: "Incomum", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 8, tier: 4,
        baseStats: { damageMin: 8, damageMax: 14, precision: 3, mag: 6 }, stats: { damageMin: 8, damageMax: 14, precision: 3, mag: 6 }, stackable: false, maxStack: 1
    });

    // Set Rúnico (Nível 9)
    item("chest_9", {
        name: "Peitoral Rúnico", icon: "▣", image: "assets/organized/items/armor/Icon30_19.png", price: 110, value: 110,
        rarity: "Raro", type: "armor", itemType: "ARMOR", slot: "chest", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { defense: 13, hpMax: 40, str: 0.5 }, stats: { defense: 13, hpMax: 40, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("head_9", {
        name: "Elmo Rúnico", icon: "⌃", image: "assets/organized/items/helmets/Icon30_09.png", price: 87, value: 87,
        rarity: "Raro", type: "armor", itemType: "ARMOR", slot: "head", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { defense: 7, hpMax: 20 }, stats: { defense: 7, hpMax: 20 }, stackable: false, maxStack: 1
    });
    item("legs_9", {
        name: "Perneiras Rúnico", icon: "Ⅱ", image: "assets/organized/items/legs/Icon30_29.png", price: 99, value: 99,
        rarity: "Raro", type: "armor", itemType: "ARMOR", slot: "legs", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { defense: 9, hpMax: 28 }, stats: { defense: 9, hpMax: 28 }, stackable: false, maxStack: 1
    });
    item("feet_9", {
        name: "Botas Rúnico", icon: "⌄", image: "assets/organized/items/boots/Icon30_39.png", price: 75, value: 75,
        rarity: "Raro", type: "armor", itemType: "ARMOR", slot: "feet", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { defense: 5, hpMax: 16, evasion: 0.003 }, stats: { defense: 5, hpMax: 16, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("hands_9", {
        name: "Luvas Rúnico", icon: "✥", image: "assets/craftpix/craftpix-net-127812-free-clothing-32x32-pixel-icons/PNG/06/06_1.png", price: 75, value: 75,
        rarity: "Raro", type: "armor", itemType: "ARMOR", slot: "hands", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { defense: 5, hpMax: 16, precision: 1 }, stats: { defense: 5, hpMax: 16, precision: 1 }, stackable: false, maxStack: 1
    });
    item("sword_9", {
        name: "Espada Rúnico", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_09.png", price: 581, value: 581,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { damageMin: 12, damageMax: 19, precision: 4 }, stats: { damageMin: 12, damageMax: 19, precision: 4 }, stackable: false, maxStack: 1
    });
    item("axe_9", {
        name: "Machado Rúnico", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_19.png", price: 581, value: 581,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { damageMin: 13, damageMax: 22, precision: 3, critical: 0.013 }, stats: { damageMin: 13, damageMax: 22, precision: 3, critical: 0.013 }, stackable: false, maxStack: 1
    });
    item("mace_9", {
        name: "Maça Rúnico", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_29.png", price: 581, value: 581,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { damageMin: 13, damageMax: 21, precision: 3, defense: 3 }, stats: { damageMin: 13, damageMax: 21, precision: 3, defense: 3 }, stackable: false, maxStack: 1
    });
    item("dagger_9", {
        name: "Adaga Rúnico", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_39.png", price: 581, value: 581,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { damageMin: 9, damageMax: 16, precision: 5, critical: 0.019 }, stats: { damageMin: 9, damageMax: 16, precision: 5, critical: 0.019 }, stackable: false, maxStack: 1
    });
    item("bow_9", {
        name: "Arco Rúnico", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_09.png", price: 581, value: 581,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 9, tier: 5,
        baseStats: { damageMin: 11, damageMax: 18, precision: 6, critical: 0.011 }, stats: { damageMin: 11, damageMax: 18, precision: 6, critical: 0.011 }, stackable: false, maxStack: 1
    });
    item("focus_9", {
        name: "Foco Rúnico", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_19.png", price: 581, value: 581,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 9, tier: 5,
        baseStats: { damageMin: 9, damageMax: 15, precision: 4, mag: 6 }, stats: { damageMin: 9, damageMax: 15, precision: 4, mag: 6 }, stackable: false, maxStack: 1
    });

    // Set Aetheriano (Nível 10)
    item("chest_10", {
        name: "Peitoral Aetheriano", icon: "▣", image: "assets/organized/items/armor/Icon30_20.png", price: 120, value: 120,
        rarity: "Raro", type: "armor", itemType: "ARMOR", slot: "chest", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { defense: 14, hpMax: 45, str: 0.5 }, stats: { defense: 14, hpMax: 45, str: 0.5 }, stackable: false, maxStack: 1
    });
    item("head_10", {
        name: "Elmo Aetheriano", icon: "⌃", image: "assets/organized/items/helmets/Icon30_10.png", price: 95, value: 95,
        rarity: "Raro", type: "armor", itemType: "ARMOR", slot: "head", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { defense: 7, hpMax: 23 }, stats: { defense: 7, hpMax: 23 }, stackable: false, maxStack: 1
    });
    item("legs_10", {
        name: "Perneiras Aetheriano", icon: "Ⅱ", image: "assets/organized/items/legs/Icon30_30.png", price: 108, value: 108,
        rarity: "Raro", type: "armor", itemType: "ARMOR", slot: "legs", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { defense: 10, hpMax: 31 }, stats: { defense: 10, hpMax: 31 }, stackable: false, maxStack: 1
    });
    item("feet_10", {
        name: "Botas Aetheriano", icon: "⌄", image: "assets/organized/items/boots/Icon30_40.png", price: 82, value: 82,
        rarity: "Raro", type: "armor", itemType: "ARMOR", slot: "feet", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { defense: 6, hpMax: 18, evasion: 0.003 }, stats: { defense: 6, hpMax: 18, evasion: 0.003 }, stackable: false, maxStack: 1
    });
    item("hands_10", {
        name: "Luvas Aetheriano", icon: "✥", image: "assets/craftpix/craftpix-net-127812-free-clothing-32x32-pixel-icons/PNG/06/06_1.png", price: 82, value: 82,
        rarity: "Raro", type: "armor", itemType: "ARMOR", slot: "hands", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { defense: 6, hpMax: 18, precision: 1 }, stats: { defense: 6, hpMax: 18, precision: 1 }, stackable: false, maxStack: 1
    });
    item("sword_10", {
        name: "Espada Aetheriano", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_10.png", price: 714, value: 714,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "sword", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { damageMin: 13, damageMax: 21, precision: 4 }, stats: { damageMin: 13, damageMax: 21, precision: 4 }, stackable: false, maxStack: 1
    });
    item("axe_10", {
        name: "Machado Aetheriano", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_20.png", price: 714, value: 714,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "axe", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { damageMin: 15, damageMax: 24, precision: 3, critical: 0.014 }, stats: { damageMin: 15, damageMax: 24, precision: 3, critical: 0.014 }, stackable: false, maxStack: 1
    });
    item("mace_10", {
        name: "Maça Aetheriano", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_30.png", price: 714, value: 714,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "mace", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { damageMin: 14, damageMax: 23, precision: 3, defense: 3 }, stats: { damageMin: 14, damageMax: 23, precision: 3, defense: 3 }, stackable: false, maxStack: 1
    });
    item("dagger_10", {
        name: "Adaga Aetheriano", icon: "⚔", image: "assets/organized/items/weapons/all/Iicon_32_40.png", price: 714, value: 714,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "dagger", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { damageMin: 10, damageMax: 17, precision: 5, critical: 0.02 }, stats: { damageMin: 10, damageMax: 17, precision: 5, critical: 0.02 }, stackable: false, maxStack: 1
    });
    item("bow_10", {
        name: "Arco Aetheriano", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_10.png", price: 714, value: 714,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "bow", equipmentClass: "martial", levelReq: 10, tier: 5,
        baseStats: { damageMin: 12, damageMax: 19, precision: 6, critical: 0.012 }, stats: { damageMin: 12, damageMax: 19, precision: 6, critical: 0.012 }, stackable: false, maxStack: 1
    });
    item("focus_10", {
        name: "Foco Aetheriano", icon: "⚔", image: "assets/organized/items/weapons/all/icon_32_2_20.png", price: 714, value: 714,
        rarity: "Raro", type: "weapon", itemType: "WEAPON", slot: "weapon", weaponFamily: "focus", equipmentClass: "arcane", levelReq: 10, tier: 5,
        baseStats: { damageMin: 10, damageMax: 17, precision: 4, mag: 7 }, stats: { damageMin: 10, damageMax: 17, precision: 4, mag: 7 }, stackable: false, maxStack: 1
    });
