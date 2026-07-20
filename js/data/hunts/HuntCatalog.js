// HuntCatalog.js - Regiões de caça construídas sobre o bestiário SRD
(function (Aethra) {
    "use strict";

    const clone = (value) => JSON.parse(JSON.stringify(value));

    const DEFINITIONS = {
        whispering_forest: {
            id: "whispering_forest",
            name: "Bosque dos Sussurros",
            region: "Fronteira de Aethra",
            biome: "Floresta antiga",
            description: "Feras pequenas, saqueadores e recursos básicos para iniciar combate, exploração e couraria.",
            minLevel: 1,
            maxLevel: 8,
            danger: 1,
            icon: "♣",
            position: { x: 17, y: 67 },
            rewards: ["Couro", "Carne", "Ervas"],
            encounterChance: 0.35,
            focus: { id: "skinning", name: "Couraria / Feras", skill: "skinning", icon: "♣" },
            modifiers: {
                combatXp: 1.0,
                gold: 1.0,
                materialChance: 1.5,
                resourceQuantity: 1.2,
                eventChance: 1.25,
                professionXp: { skinning: 2.2, herbalism: 1.4, exploration: 1.2 },
                eventWeights: { herb: 1.8, wood: 1.5, trail: 1.2 }
            },
            enemies: [
                { id: "giant-rat-xmm-2024", weight: 24 },
                { id: "wolf-xmm-2024", weight: 24 },
                { id: "boar-xmm-2024", weight: 18 },
                { id: "giant-fire-beetle-xmm-2024", weight: 14 },
                { id: "bandit-xmm-2024", weight: 12 },
                { id: "black-bear-xmm-2024", weight: 8 }
            ]
        },
        goblin_frontier: {
            id: "goblin_frontier",
            name: "Fronteira Goblin",
            region: "Estrada do Norte",
            biome: "Acampamentos e paliçadas",
            description: "Patrulhas goblinoides guardam rotas comerciais e carregam materiais de armas e armaduras.",
            minLevel: 5,
            maxLevel: 15,
            danger: 2,
            icon: "⚑",
            position: { x: 35, y: 48 },
            rewards: ["Gold", "Tecido", "Fragmentos de arma"],
            encounterChance: 0.39,
            focus: { id: "gold", name: "Gold / Saques", skill: null, icon: "●" },
            modifiers: {
                combatXp: 1.15,
                gold: 2.0,
                materialChance: 1.0,
                resourceQuantity: 1.0,
                eventChance: 1.0,
                professionXp: { exploration: 1.2, thievery: 1.3 },
                eventWeights: { chest: 1.6, camp: 2.2 }
            },
            enemies: [
                { id: "goblin-mm", weight: 30 },
                { id: "orc-mm", weight: 25 },
                { id: "hobgoblin-mm", weight: 20 },
                { id: "bugbear-mm", weight: 15 },
                { id: "goblin-boss-xmm-2024", weight: 10 }
            ]
        },
        forgotten_crypt: {
            id: "forgotten_crypt",
            name: "Cripta Esquecida",
            region: "Colinas de Cinza",
            biome: "Ruínas subterrâneas",
            description: "Mortos-vivos, poeira funerária e essências espirituais. Cura e defesa tornam-se essenciais.",
            minLevel: 10,
            maxLevel: 24,
            danger: 3,
            icon: "▦",
            position: { x: 61, y: 73 },
            rewards: ["Ossos", "Ectoplasma", "Relíquias"],
            encounterChance: 0.43,
            focus: { id: "thievery", name: "Ladinagem / Baús", skill: "thievery", icon: "⌖" },
            modifiers: {
                combatXp: 0.85,
                gold: 1.0,
                materialChance: 1.15,
                resourceQuantity: 1.1,
                eventChance: 1.3,
                professionXp: { thievery: 2.5, exploration: 1.3 },
                eventWeights: { locked_chest: 2.4, secret_door: 2.0, trap: 1.6 }
            },
            enemies: [
                { id: "skeleton-xmm-2024", weight: 28 },
                { id: "zombie-xmm-2024", weight: 26 },
                { id: "ghoul-xmm-2024", weight: 20 },
                { id: "specter-xmm-2024", weight: 16 },
                { id: "wight-xmm-2024", weight: 10 }
            ]
        },
        spider_hollow: {
            id: "spider_hollow",
            name: "Covil das Tecelãs",
            region: "Mata Sombria",
            biome: "Cavernas e teias",
            description: "Criaturas venenosas protegem casulos e passagens ocultas. Precisão e sobrevivência ganham valor.",
            minLevel: 18,
            maxLevel: 32,
            danger: 3,
            icon: "✣",
            position: { x: 28, y: 25 },
            rewards: ["Veneno", "Couro", "Baús ocultos"],
            encounterChance: 0.45,
            focus: { id: "survival", name: "Sobrevivência", skill: "survival", icon: "▲" },
            modifiers: {
                combatXp: 1.0,
                gold: 0.7,
                materialChance: 1.6,
                resourceQuantity: 1.2,
                eventChance: 1.2,
                professionXp: { survival: 2.4, exploration: 1.1 },
                eventWeights: { trap: 2.2, trail: 1.5, chest: 0.8 }
            },
            enemies: [
                { id: "giant-wolf-spider-xmm-2024", weight: 28 },
                { id: "giant-spider-xmm-2024", weight: 27 },
                { id: "ettercap-xmm-2024", weight: 22 },
                { id: "phase-spider-xmm-2024", weight: 13 },
                { id: "owlbear-xmm-2024", weight: 10 }
            ]
        },
        moonfen: {
            id: "moonfen",
            name: "Pântano da Lua",
            region: "Terras do Sul",
            biome: "Pântano arcano",
            description: "Névoa, plantas incomuns e predadores anfíbios. Herbalismo e magia evoluem mais rápido.",
            minLevel: 25,
            maxLevel: 40,
            danger: 4,
            icon: "☾",
            position: { x: 48, y: 88 },
            rewards: ["Ervas", "Resina", "Essência"],
            encounterChance: 0.48,
            focus: { id: "herbalism", name: "Herbalismo / Ervas", skill: "herbalism", icon: "✿" },
            modifiers: {
                combatXp: 0.9,
                gold: 0.8,
                materialChance: 1.3,
                resourceQuantity: 1.3,
                eventChance: 1.4,
                professionXp: { herbalism: 2.6, exploration: 1.2, survival: 1.1 },
                eventWeights: { herb: 2.8, shrine: 1.8 }
            },
            enemies: [
                { id: "giant-toad-xmm-2024", weight: 25 },
                { id: "crocodile-xmm-2024", weight: 22 },
                { id: "green-hag-xmm-2024", weight: 20 },
                { id: "shambling-mound-xmm-2024", weight: 18 },
                { id: "troll-xmm-2024", weight: 15 }
            ]
        },
        iron_hills: {
            id: "iron_hills",
            name: "Colinas de Ferro",
            region: "Cordilheira Oriental",
            biome: "Montanhas minerais",
            description: "Construtos, elementais e gigantes rondam jazidas valiosas e núcleos arcanos.",
            minLevel: 35,
            maxLevel: 52,
            danger: 4,
            icon: "⛏",
            position: { x: 78, y: 27 },
            rewards: ["Minério", "Núcleos", "Mineração"],
            encounterChance: 0.49,
            focus: { id: "mining", name: "Mineração / Minérios", skill: "mining", icon: "⛏" },
            modifiers: {
                combatXp: 0.9,
                gold: 1.0,
                materialChance: 1.8,
                resourceQuantity: 1.5,
                eventChance: 1.5,
                professionXp: { mining: 2.8, blacksmithing: 1.8, exploration: 0.9 },
                eventWeights: { mining: 3.5, forge: 2.0 }
            },
            enemies: [
                { id: "gargoyle-xmm-2024", weight: 25 },
                { id: "ogre-xmm-2024", weight: 23 },
                { id: "earth-elemental-xmm-2024", weight: 20 },
                { id: "xorn-xmm-2024", weight: 18 },
                { id: "stone-giant-xmm-2024", weight: 14 }
            ]
        },
        frozen_pass: {
            id: "frozen_pass",
            name: "Passagem Congelada",
            region: "Coroa do Norte",
            biome: "Tundra e geleiras",
            description: "Feras de gelo e gigantes testam sustain, resistência e preparação para longas sessões.",
            minLevel: 45,
            maxLevel: 62,
            danger: 5,
            icon: "❄",
            position: { x: 57, y: 15 },
            rewards: ["Peles raras", "Ossos", "Essência gélida"],
            encounterChance: 0.51,
            focus: { id: "survival", name: "Sobrevivência gélida", skill: "survival", icon: "❄" },
            modifiers: {
                combatXp: 1.1,
                gold: 0.9,
                materialChance: 1.4,
                resourceQuantity: 1.2,
                eventChance: 1.1,
                professionXp: { survival: 2.2, exploration: 1.2 },
                eventWeights: { trail: 1.8, camp: 1.5 }
            },
            enemies: [
                { id: "polar-bear-xmm-2024", weight: 27 },
                { id: "winter-wolf-xmm-2024", weight: 26 },
                { id: "frost-giant-xmm-2024", weight: 21 },
                { id: "young-white-dragon-xmm-2024", weight: 12 },
                { id: "wyvern-xmm-2024", weight: 14 }
            ]
        },
        dragon_coast: {
            id: "dragon_coast",
            name: "Costa dos Dragões",
            region: "Falésias Ocidentais",
            biome: "Penhascos dracônicos",
            description: "Wyverns e dragões jovens transformam escamas e essências em recursos econômicos importantes.",
            minLevel: 55,
            maxLevel: 74,
            danger: 5,
            icon: "♨",
            position: { x: 8, y: 39 },
            rewards: ["Escamas", "Essências", "Loot dracônico"],
            encounterChance: 0.53,
            focus: { id: "skinning", name: "Couraria Dracônica", skill: "skinning", icon: "♨" },
            modifiers: {
                combatXp: 1.3,
                gold: 1.2,
                materialChance: 1.5,
                resourceQuantity: 1.3,
                eventChance: 1.0,
                professionXp: { skinning: 2.5, survival: 1.5 },
                eventWeights: { trail: 1.5, shrine: 1.4 }
            },
            enemies: [
                { id: "wyvern-xmm-2024", weight: 30 },
                { id: "young-black-dragon-xmm-2024", weight: 20 },
                { id: "young-green-dragon-xmm-2024", weight: 18 },
                { id: "young-red-dragon-xmm-2024", weight: 17 },
                { id: "young-blue-dragon-xmm-2024", weight: 15 }
            ]
        },
        abyssal_rift: {
            id: "abyssal_rift",
            name: "Fenda Abissal",
            region: "Terras Quebradas",
            biome: "Plano infernal instável",
            description: "Demônios e diabos concedem materiais valiosos, mas pressionam cura, resistência e dano mágico.",
            minLevel: 65,
            maxLevel: 86,
            danger: 6,
            icon: "♠",
            position: { x: 88, y: 78 },
            rewards: ["Cinza infernal", "Icor", "Afixos raros"],
            encounterChance: 0.55,
            focus: { id: "alchemy", name: "Alquimia / Icor", skill: null, icon: "☠" },
            modifiers: {
                combatXp: 1.4,
                gold: 1.5,
                materialChance: 1.3,
                resourceQuantity: 1.2,
                eventChance: 1.2,
                professionXp: { exploration: 1.5, survival: 1.4 },
                eventWeights: { shrine: 2.0, trap: 1.5 }
            },
            enemies: [
                { id: "vrock-xmm-2024", weight: 30 },
                { id: "hezrou-xmm-2024", weight: 27 },
                { id: "chain-devil-xmm-2024", weight: 23 },
                { id: "bone-devil-xmm-2024", weight: 20 }
            ]
        },
        sunken_temple: {
            id: "sunken_temple",
            name: "Templo Submerso",
            region: "Mar Interior",
            biome: "Ruínas abissais",
            description: "Seres aquáticos e psíquicos guardam artefatos antigos em corredores inundados.",
            minLevel: 78,
            maxLevel: 98,
            danger: 6,
            icon: "≋",
            position: { x: 23, y: 87 },
            rewards: ["Resíduo psíquico", "Relíquias", "Tesouros"],
            encounterChance: 0.56,
            focus: { id: "thievery", name: "Ladinagem Abissal", skill: "thievery", icon: "≋" },
            modifiers: {
                combatXp: 1.1,
                gold: 1.4,
                materialChance: 1.2,
                resourceQuantity: 1.2,
                eventChance: 1.3,
                professionXp: { thievery: 2.3, exploration: 1.4 },
                eventWeights: { secret_door: 2.5, locked_chest: 2.0 }
            },
            enemies: [
                { id: "aboleth-xmm-2024", weight: 28 },
                { id: "hydra-xmm-2024", weight: 26 },
                { id: "guardian-naga-xmm-2024", weight: 24 },
                { id: "young-blue-dragon-xmm-2024", weight: 22 }
            ]
        },
        black_fortress: {
            id: "black_fortress",
            name: "Fortaleza Negra",
            region: "Fronteira Proibida",
            biome: "Cidadela amaldiçoada",
            description: "Chefes mortos-vivos e monstros lendários fazem desta região uma prova completa de build.",
            minLevel: 92,
            maxLevel: 130,
            danger: 6,
            icon: "♜",
            position: { x: 81, y: 53 },
            rewards: ["Relíquias", "Loot épico", "Essências"],
            encounterChance: 0.58,
            focus: { id: "combat", name: "Combate Lendário", skill: null, icon: "♜" },
            modifiers: {
                combatXp: 1.8,
                gold: 1.6,
                materialChance: 1.4,
                resourceQuantity: 1.2,
                eventChance: 1.2,
                professionXp: { exploration: 1.6, survival: 1.6 },
                eventWeights: { shrine: 2.2, camp: 1.8 }
            },
            enemies: [
                { id: "vampire-xmm-2024", weight: 32 },
                { id: "mummy-lord-xmm-2024", weight: 28 },
                { id: "adult-black-dragon-xmm-2024", weight: 24 },
                { id: "lich-xmm-2024", weight: 16 }
            ]
        },
        worlds_end: {
            id: "worlds_end",
            name: "Fim do Mundo",
            region: "Além do Véu",
            biome: "Zona de cataclismo",
            description: "Conteúdo de alto nível com criaturas lendárias e chances econômicas extremamente controladas.",
            minLevel: 125,
            maxLevel: 220,
            danger: 6,
            icon: "✦",
            position: { x: 50, y: 45 },
            rewards: ["Cinza estelar", "Minério estelar", "XP supremo"],
            encounterChance: 0.6,
            focus: { id: "exploration", name: "Exploração Suprema", skill: "exploration", icon: "✦" },
            modifiers: {
                combatXp: 2.0,
                gold: 2.0,
                materialChance: 2.0,
                resourceQuantity: 1.5,
                eventChance: 1.5,
                professionXp: { exploration: 3.0, survival: 2.0, thievery: 2.0, mining: 2.0, skinning: 2.0, herbalism: 2.0 },
                eventWeights: { shrine: 2.5, chest: 2.0, locked_chest: 2.0 }
            },
            enemies: [
                { id: "ancient-black-dragon-xmm-2024", weight: 30 },
                { id: "ancient-red-dragon-xmm-2024", weight: 28 },
                { id: "kraken-xmm-2024", weight: 24 },
                { id: "tarrasque-xmm-2024", weight: 18 }
            ]
        },

        // Mantenha as definições de foco especializado para manter a compatibilidade total com os testes unitários
        merchant_ruins_focus: {
            id: "merchant_ruins_focus",
            mode: "specialized",
            name: "Ruínas dos Mercadores",
            region: "Estrada das Moedas",
            biome: "Ruínas comerciais",
            description: "Caçada especializada em Gold. Sacrifica parte do XP de combate para maximizar retorno econômico.",
            focus: { id: "gold", name: "Gold", skill: null, icon: "●" },
            minLevel: 1,
            maxLevel: 25,
            danger: 2,
            icon: "◉",
            rewards: ["Gold elevado", "Baús", "Fragmentos de arma"],
            encounterChance: 0.52,
            modifiers: {
                combatXp: 0.6,
                gold: 2.5,
                materialChance: 0.85,
                resourceQuantity: 1,
                eventChance: 1.35,
                professionXp: { exploration: 0.8, thievery: 1.25 },
                eventWeights: { chest: 2.4, locked_chest: 1.8, trail: 0.7, mining: 0.25, herb: 0.25 }
            },
            enemies: [
                { id: "bandit-xmm-2024", weight: 38 },
                { id: "goblin-mm", weight: 24 }
            ]
        },
        deep_mines_focus: {
            id: "deep_mines_focus",
            mode: "specialized",
            name: "Minas Profundas",
            region: "Subsolo Oriental",
            biome: "Galerias minerais",
            description: "Hunt de coleta com veios frequentes, forjas antigas e pouca experiência de combate. Ideal para Mineração.",
            focus: { id: "mining", name: "Mineração", skill: "mining", icon: "⛏" },
            minLevel: 5,
            maxLevel: 45,
            danger: 3,
            icon: "⛏",
            rewards: ["Minério", "Componentes metálicos"],
            encounterChance: 0.2,
            modifiers: {
                combatXp: 0.15,
                gold: 0.4,
                materialChance: 2.25,
                resourceQuantity: 1.8,
                eventChance: 2.4,
                professionXp: { mining: 2.75, blacksmithing: 1.85, exploration: 0.25 },
                eventWeights: { mining: 4.8, forge: 2.4 }
            },
            enemies: [
                { id: "gargoyle-xmm-2024", weight: 30 }
            ]
        },
        whispering_woods_focus: {
            id: "whispering_woods_focus",
            mode: "specialized",
            name: "Floresta dos Sussurros",
            region: "Fronteira Verde",
            biome: "Floresta de caça",
            description: "Predadores e animais dominam a região. O foco é Esfolamento e couro.",
            focus: { id: "skinning", name: "Esfolamento", skill: "skinning", icon: "◒" },
            minLevel: 1,
            maxLevel: 30,
            danger: 2,
            icon: "♣",
            rewards: ["Couro", "Carne"],
            encounterChance: 0.42,
            modifiers: {
                combatXp: 0.7,
                gold: 0.5,
                materialChance: 2.1,
                resourceQuantity: 1.5,
                eventChance: 1.8,
                professionXp: { skinning: 2.5, herbalism: 0.65, exploration: 0.4 },
                eventWeights: { herb: 2.2 }
            },
            enemies: [
                { id: "wolf-xmm-2024", weight: 30 }
            ]
        },
        catacombs_focus: {
            id: "catacombs_focus",
            mode: "specialized",
            name: "Catacumbas dos Sem-Nome",
            region: "Subcidade Antiga",
            biome: "Catacumbas e passagens secretas",
            description: "Ladinagem e Baús trancados.",
            focus: { id: "thievery", name: "Ladinagem", skill: "thievery", icon: "⚿" },
            minLevel: 10,
            maxLevel: 55,
            danger: 4,
            icon: "⚿",
            rewards: ["Baús trancados"],
            encounterChance: 0.28,
            modifiers: {
                combatXp: 0.3,
                gold: 1.3,
                materialChance: 0.8,
                resourceQuantity: 1.1,
                eventChance: 2.6,
                professionXp: { thievery: 2.8, exploration: 0.5, survival: 0.45 },
                eventWeights: { locked_chest: 4.2 }
            },
            enemies: [
                { id: "skeleton-xmm-2024", weight: 30 }
            ]
        },
        arena_focus: {
            id: "arena_focus",
            mode: "specialized",
            name: "Arena de Aethra",
            region: "Distrito Marcial",
            biome: "Arena de combate",
            description: "Combate puro.",
            focus: { id: "combat", name: "XP de Combate", skill: null, icon: "⚔" },
            minLevel: 1,
            maxLevel: 220,
            danger: 3,
            icon: "⚔",
            rewards: ["XP de Combate"],
            encounterChance: 0.92,
            modifiers: {
                combatXp: 2.5,
                combatSkillXp: 1.75,
                gold: 0.18,
                materialChance: 0.12,
                resourceQuantity: 0.25,
                eventChance: 0.04,
                professionXp: { mining: 0, skinning: 0, herbalism: 0, exploration: 0 },
                eventWeights: { chest: 0 }
            },
            enemies: [
                { id: "bandit-xmm-2024", weight: 24 }
            ]
        }
    };

    Aethra.HuntCatalog = {
        initialized: false,
        definitions: DEFINITIONS,

        init() {
            this.initialized = true;
            return this.getStats();
        },

        getDefinitions() {
            return clone(this.definitions);
        },

        get(huntId) {
            return this.definitions[huntId] ? clone(this.definitions[huntId]) : null;
        },

        getUnlocked(level = 1) {
            const heroLevel = Math.max(1, Number(level || 1));
            return Object.values(this.definitions)
                .filter((hunt) => heroLevel >= Number(hunt.minLevel || 1))
                .sort((a, b) => a.minLevel - b.minLevel)
                .map(clone);
        },

        validate() {
            const missing = [];
            Object.values(this.definitions).forEach((hunt) => {
                hunt.enemies.forEach((entry) => {
                    if (!Aethra.MonsterCatalog?.get?.(entry.id)) {
                        missing.push({ huntId: hunt.id, monsterId: entry.id });
                    }
                });
            });
            return { valid: missing.length === 0, missing };
        },

        applyTo(huntSystem) {
            if (!huntSystem) return false;
            Object.entries(this.definitions).forEach(([huntId, definition]) => {
                huntSystem.hunts[huntId] = clone(definition);
            });
            Aethra.EventBus?.emit?.("hunt-catalog:applied", this.getStats());
            return true;
        },

        getStats() {
            const definitions = Object.values(this.definitions);
            return {
                initialized: this.initialized,
                hunts: definitions.length,
                encounters: definitions.reduce((total, hunt) => total + hunt.enemies.length, 0),
                minLevel: Math.min(...definitions.map((hunt) => hunt.minLevel)),
                maxLevel: Math.max(...definitions.map((hunt) => hunt.maxLevel))
            };
        }
    };
})(window.Aethra = window.Aethra || {});
