// LootProfileRegistry.js - Loot coerente por família de criatura
(function (Aethra) {
    "use strict";

    const MATERIALS = {
        beast_hide: { name: "Couro de Fera", icon: "▧", price: 5 },
        raw_meat: { name: "Carne Crua", icon: "◆", price: 3 },
        bone_fragment: { name: "Fragmento de Osso", icon: "◇", price: 4 },
        monster_fang: { name: "Presa de Monstro", icon: "◢", price: 8 },
        cloth_scrap: { name: "Retalho de Tecido", icon: "▤", price: 4 },
        weapon_fragment: { name: "Fragmento de Arma", icon: "†", price: 10 },
        grave_dust: { name: "Pó de Sepultura", icon: "✦", price: 8 },
        ectoplasm: { name: "Ectoplasma", icon: "◌", price: 18, rarity: "Incomum" },
        iron_ore: { name: "Minério de Ferro", icon: "⬢", price: 9 },
        arcane_core: { name: "Núcleo Arcano", icon: "◈", price: 28, rarity: "Raro" },
        wild_herb: { name: "Erva Selvagem", icon: "♧", price: 6 },
        ancient_resin: { name: "Resina Antiga", icon: "●", price: 15, rarity: "Incomum" },
        dragon_scale: { name: "Escama Dracônica", icon: "◩", price: 55, rarity: "Raro" },
        draconic_essence: { name: "Essência Dracônica", icon: "✹", price: 160, rarity: "Épico" },
        infernal_ash: { name: "Cinza Infernal", icon: "♨", price: 18, rarity: "Incomum" },
        demon_ichor: { name: "Icor Demoníaco", icon: "●", price: 48, rarity: "Raro" },
        elemental_mote: { name: "Partícula Elemental", icon: "✧", price: 22, rarity: "Incomum" },
        fey_dust: { name: "Pó Feérico", icon: "✺", price: 24, rarity: "Incomum" },
        aberrant_tissue: { name: "Tecido Aberrante", icon: "◉", price: 30, rarity: "Incomum" },
        psychic_residue: { name: "Resíduo Psíquico", icon: "◎", price: 70, rarity: "Raro" },
        giant_bone: { name: "Osso de Gigante", icon: "▰", price: 36, rarity: "Incomum" },
        radiant_essence: { name: "Essência Radiante", icon: "☼", price: 90, rarity: "Raro" },
        alchemical_slime: { name: "Lodo Alquímico", icon: "◍", price: 16, rarity: "Incomum" }
    };

    const PROFILES = {
        beast: ["beast_hide", "raw_meat", "bone_fragment"],
        monstrosity: ["beast_hide", "monster_fang", "bone_fragment"],
        humanoid: ["cloth_scrap", "weapon_fragment"],
        undead: ["bone_fragment", "grave_dust", "ectoplasm"],
        construct: ["iron_ore", "arcane_core"],
        plant: ["wild_herb", "ancient_resin"],
        dragon: ["dragon_scale", "draconic_essence"],
        fiend: ["infernal_ash", "demon_ichor"],
        elemental: ["elemental_mote", "arcane_core"],
        fey: ["fey_dust", "wild_herb"],
        aberration: ["aberrant_tissue", "psychic_residue"],
        giant: ["giant_bone", "beast_hide"],
        celestial: ["radiant_essence", "arcane_core"],
        ooze: ["alchemical_slime"],
        default: ["bone_fragment"]
    };

    Aethra.LootProfileRegistry = {
        materials: MATERIALS,
        profiles: PROFILES,

        getProfile(type) {
            return this.profiles[String(type || "default").toLowerCase()] || this.profiles.default;
        },

        buildLootTable(monster = {}) {
            const ids = this.getProfile(monster.type || monster.lootProfile);
            const tier = Math.max(1, Number(monster.tier || 1));
            return ids.map((templateId, index) => ({
                templateId,
                chance: index === 0 ? 0.34 : index === 1 ? 0.13 : 0.035,
                min: 1,
                max: index === 0 && tier >= 4 ? 2 : 1,
                rarity: MATERIALS[templateId]?.rarity || "Comum"
            }));
        },

        registerTemplates() {
            Aethra.GameData.items = Aethra.GameData.items || {};
            Aethra.ItemTemplates = Aethra.ItemTemplates || {};
            Object.entries(this.materials).forEach(([id, definition]) => {
                const template = {
                    id,
                    name: definition.name,
                    icon: definition.icon,
                    image: null,
                    type: "material",
                    itemType: "MATERIAL",
                    rarity: definition.rarity || "Comum",
                    price: definition.price,
                    value: definition.price,
                    stackable: true,
                    maxStack: 999,
                    description: "Material obtido de criaturas do bestiário de Aethra."
                };
                Aethra.GameData.items[id] = { ...(Aethra.GameData.items[id] || {}), ...template };
                Aethra.ItemTemplates[id] = { ...(Aethra.ItemTemplates[id] || {}), ...template };
                Aethra.LootSystem?.registerTemplate?.(id, template);
            });
            return Object.keys(this.materials).length;
        }
    };
})(window.Aethra = window.Aethra || {});
