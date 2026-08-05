// RecipeCatalog.js — catálogo declarativo de receitas de ofício.
// Autoridade: somente dados. Nenhuma lógica de gameplay vive aqui.
// O CraftingSystem é o único responsável por validar, consumir e gerar itens.
(function initRecipeCatalog(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) {
        throw new Error("RecipeCatalog.js requer game-core.js.");
    }

    // ─── Definições ──────────────────────────────────────────────────────────
    // unlockLevel: nível de profissão em que a receita APARECE na oficina.
    // requiredLevel: nível mínimo para poder EXECUTAR a receita.
    // tier: agrupamento visual (1 = Iniciante, 2 = Oficial, 3 = Mestre).

    const RECIPES = Object.freeze([

        // ── Forjaria T1 (Iniciante) ──────────────────────────────────────────
        {
            id: "smelt_iron",
            name: "Fundir Ferro",
            icon: "▰",
            professionId: "blacksmithing",
            action: "smelt",
            stationId: "forge",
            tier: 1,
            unlockLevel: 1,
            requiredLevel: 1,
            xp: 8,
            inputs: [{ itemId: "iron_ore", quantity: 2 }],
            outputs: [{ itemId: "refined_ingot", quantity: 1 }],
            description: "Transforma minério bruto em um lingote utilizável na forja."
        },
        {
            id: "forge_iron_sword",
            name: "Espada de Ferro",
            icon: "⚔",
            professionId: "blacksmithing",
            action: "forge",
            stationId: "forge",
            tier: 1,
            unlockLevel: 1,
            requiredLevel: 1,
            xp: 18,
            inputs: [{ itemId: "refined_ingot", quantity: 3 }],
            outputs: [{ itemId: "eg_sword_l1", quantity: 1 }],
            description: "Forja uma espada individual com qualidade própria."
        },
        {
            id: "forge_iron_axe",
            name: "Machado de Ferro",
            icon: "◩",
            professionId: "blacksmithing",
            action: "forge",
            stationId: "forge",
            tier: 1,
            unlockLevel: 1,
            requiredLevel: 1,
            xp: 18,
            inputs: [{ itemId: "refined_ingot", quantity: 3 }],
            outputs: [{ itemId: "eg_axe_l1", quantity: 1 }],
            description: "Forja um machado pesado com bônus de dano bruto."
        },
        {
            id: "forge_iron_mace",
            name: "Maça de Ferro",
            icon: "✣",
            professionId: "blacksmithing",
            action: "forge",
            stationId: "forge",
            tier: 1,
            unlockLevel: 1,
            requiredLevel: 1,
            xp: 18,
            inputs: [{ itemId: "refined_ingot", quantity: 3 }],
            outputs: [{ itemId: "eg_mace_l1", quantity: 1 }],
            description: "Forja uma maça robusta que aumenta a defesa do portador."
        },
        {
            id: "forge_iron_helm",
            name: "Elmo de Ferro",
            icon: "⌃",
            professionId: "blacksmithing",
            action: "forge",
            stationId: "forge",
            tier: 1,
            unlockLevel: 1,
            requiredLevel: 3,
            xp: 20,
            inputs: [{ itemId: "refined_ingot", quantity: 3 }],
            outputs: [{ itemId: "eg_head_l1", quantity: 1 }],
            description: "Forja um elmo de placa que protege contra golpes críticos."
        },
        {
            id: "forge_iron_legs",
            name: "Perneiras de Ferro",
            icon: "Ⅱ",
            professionId: "blacksmithing",
            action: "forge",
            stationId: "forge",
            tier: 1,
            unlockLevel: 1,
            requiredLevel: 3,
            xp: 22,
            inputs: [{ itemId: "refined_ingot", quantity: 4 }],
            outputs: [{ itemId: "eg_legs_l1", quantity: 1 }],
            description: "Forja perneiras de placa com boa cobertura lateral."
        },
        {
            id: "forge_plate_chest",
            name: "Peitoral de Placa",
            icon: "▣",
            professionId: "blacksmithing",
            action: "forge",
            stationId: "forge",
            tier: 1,
            unlockLevel: 1,
            requiredLevel: 4,
            xp: 25,
            inputs: [{ itemId: "refined_ingot", quantity: 5 }],
            outputs: [{ itemId: "eg_chest_l1", quantity: 1 }],
            description: "Cria uma proteção pesada com qualidade variável."
        },

        // ── Forjaria T2 (Oficial) ─────────────────────────────────────────────
        {
            id: "smelt_steel",
            name: "Fundir Aço",
            icon: "▰",
            professionId: "blacksmithing",
            action: "smelt",
            stationId: "forge",
            tier: 2,
            unlockLevel: 5,
            requiredLevel: 5,
            xp: 18,
            inputs: [{ itemId: "refined_ingot", quantity: 2 }, { itemId: "iron_ore", quantity: 1 }],
            outputs: [{ itemId: "steel_ingot", quantity: 1 }],
            description: "Combina lingotes refinados com minério para produzir aço endurecido."
        },
        {
            id: "forge_steel_sword",
            name: "Espada de Aço",
            icon: "⚔",
            professionId: "blacksmithing",
            action: "forge",
            stationId: "forge",
            tier: 2,
            unlockLevel: 5,
            requiredLevel: 6,
            xp: 35,
            inputs: [{ itemId: "steel_ingot", quantity: 3 }],
            outputs: [{ itemId: "eg_sword_l2", quantity: 1 }],
            description: "Espada de aço com dano e precisão superiores ao ferro."
        },
        {
            id: "forge_steel_axe",
            name: "Machado de Aço",
            icon: "◩",
            professionId: "blacksmithing",
            action: "forge",
            stationId: "forge",
            tier: 2,
            unlockLevel: 5,
            requiredLevel: 6,
            xp: 35,
            inputs: [{ itemId: "steel_ingot", quantity: 3 }],
            outputs: [{ itemId: "eg_axe_l2", quantity: 1 }],
            description: "Machado de aço que amplia o multiplicador de dano bruto."
        },
        {
            id: "forge_steel_chest",
            name: "Peitoral de Aço",
            icon: "▣",
            professionId: "blacksmithing",
            action: "forge",
            stationId: "forge",
            tier: 2,
            unlockLevel: 5,
            requiredLevel: 7,
            xp: 48,
            inputs: [{ itemId: "steel_ingot", quantity: 5 }],
            outputs: [{ itemId: "eg_chest_l2", quantity: 1 }],
            description: "Proteção de aço com defesa e HP base significativamente maiores."
        },
        {
            id: "forge_steel_helm",
            name: "Elmo de Aço",
            icon: "⌃",
            professionId: "blacksmithing",
            action: "forge",
            stationId: "forge",
            tier: 2,
            unlockLevel: 5,
            requiredLevel: 7,
            xp: 38,
            inputs: [{ itemId: "steel_ingot", quantity: 3 }],
            outputs: [{ itemId: "eg_head_l2", quantity: 1 }],
            description: "Elmo de aço com resistência a críticos e bônus de HP."
        },

        // ── Couraria T1 (Iniciante) ───────────────────────────────────────────
        {
            id: "tan_beast_hide",
            name: "Curtir Pele",
            icon: "▧",
            professionId: "leatherworking",
            action: "tan",
            stationId: "tannery",
            tier: 1,
            unlockLevel: 1,
            requiredLevel: 1,
            xp: 8,
            inputs: [{ itemId: "beast_hide", quantity: 2 }],
            outputs: [{ itemId: "treated_leather", quantity: 1 }],
            description: "Transforma pele bruta em couro pronto para criação."
        },
        {
            id: "craft_leather_boots",
            name: "Botas de Couro",
            icon: "⌄",
            professionId: "leatherworking",
            action: "craft-leather",
            stationId: "tannery",
            tier: 1,
            unlockLevel: 1,
            requiredLevel: 1,
            xp: 15,
            inputs: [{ itemId: "treated_leather", quantity: 2 }],
            outputs: [{ itemId: "crafted_leather_feet_l1", quantity: 1 }],
            description: "Cria botas leves com qualidade individual e bônus de evasão."
        },
        {
            id: "craft_leather_helm",
            name: "Chapéu de Couro",
            icon: "⌃",
            professionId: "leatherworking",
            action: "craft-leather",
            stationId: "tannery",
            tier: 1,
            unlockLevel: 1,
            requiredLevel: 1,
            xp: 15,
            inputs: [{ itemId: "treated_leather", quantity: 2 }],
            outputs: [{ itemId: "crafted_leather_head_l1", quantity: 1 }],
            description: "Capuz de couro que equilibra proteção e mobilidade."
        },
        {
            id: "craft_leather_legs",
            name: "Calças de Couro",
            icon: "Ⅱ",
            professionId: "leatherworking",
            action: "craft-leather",
            stationId: "tannery",
            tier: 1,
            unlockLevel: 1,
            requiredLevel: 1,
            xp: 20,
            inputs: [{ itemId: "treated_leather", quantity: 3 }],
            outputs: [{ itemId: "crafted_leather_legs_l1", quantity: 1 }],
            description: "Calças de couro com boa cobertura e evasão adicional."
        },
        {
            id: "craft_leather_chest",
            name: "Peitoral de Couro",
            icon: "▣",
            professionId: "leatherworking",
            action: "craft-leather",
            stationId: "tannery",
            tier: 1,
            unlockLevel: 1,
            requiredLevel: 4,
            xp: 25,
            inputs: [{ itemId: "treated_leather", quantity: 4 }],
            outputs: [{ itemId: "crafted_leather_chest_l1", quantity: 1 }],
            description: "Costura uma proteção leve com qualidade variável."
        },

        // ── Couraria T2 (Oficial) ─────────────────────────────────────────────
        {
            id: "tan_thick_hide",
            name: "Curtir Pele Grossa",
            icon: "▧",
            professionId: "leatherworking",
            action: "tan",
            stationId: "tannery",
            tier: 2,
            unlockLevel: 5,
            requiredLevel: 5,
            xp: 18,
            inputs: [{ itemId: "beast_hide", quantity: 3 }, { itemId: "chipped_claw", quantity: 1 }],
            outputs: [{ itemId: "reinforced_leather", quantity: 1 }],
            description: "Combina pele com garras para produzir couro reforçado e rígido."
        },
        {
            id: "craft_reinforced_chest",
            name: "Peitoral Reforçado",
            icon: "▣",
            professionId: "leatherworking",
            action: "craft-leather",
            stationId: "tannery",
            tier: 2,
            unlockLevel: 5,
            requiredLevel: 6,
            xp: 38,
            inputs: [{ itemId: "reinforced_leather", quantity: 4 }],
            outputs: [{ itemId: "crafted_reinforced_chest_l6", quantity: 1 }],
            description: "Proteção de couro reforçado com evasão e HP superiores."
        },
        {
            id: "craft_reinforced_boots",
            name: "Botas Reforçadas",
            icon: "⌄",
            professionId: "leatherworking",
            action: "craft-leather",
            stationId: "tannery",
            tier: 2,
            unlockLevel: 5,
            requiredLevel: 6,
            xp: 30,
            inputs: [{ itemId: "reinforced_leather", quantity: 2 }],
            outputs: [{ itemId: "crafted_reinforced_feet_l6", quantity: 1 }],
            description: "Botas reforçadas com alta evasão para caçadores experientes."
        },
        {
            id: "craft_reinforced_helm",
            name: "Capacete Reforçado",
            icon: "⌃",
            professionId: "leatherworking",
            action: "craft-leather",
            stationId: "tannery",
            tier: 2,
            unlockLevel: 5,
            requiredLevel: 7,
            xp: 35,
            inputs: [{ itemId: "reinforced_leather", quantity: 3 }],
            outputs: [{ itemId: "crafted_reinforced_head_l6", quantity: 1 }],
            description: "Capacete de couro reforçado com resistência adicional."
        },

        // ── Forjaria T3 (Mestre) ──────────────────────────────────────────────
        {
            id: "temper_aether_alloy",
            name: "Temperar Liga Aetheriana",
            icon: "◈",
            professionId: "blacksmithing",
            action: "smelt",
            stationId: "forge",
            tier: 3,
            unlockLevel: 10,
            requiredLevel: 10,
            xp: 40,
            inputs: [
                { itemId: "steel_ingot", quantity: 2 },
                { itemId: "aether_fragment", quantity: 2 },
                { itemId: "monster_core", quantity: 1 }
            ],
            outputs: [{ itemId: "aether_alloy", quantity: 1 }],
            sourceHuntId: "forgotten_crypt",
            sourceHint: "Cace mortos-vivos poderosos na Cripta Esquecida para obter Fragmentos de Éter e Núcleos de Criatura.",
            description: "Estabiliza aço com energia de Éter para criar uma liga de mestre."
        },
        {
            id: "forge_aether_sword",
            name: "Espada Aetheriana",
            icon: "⚔",
            professionId: "blacksmithing",
            action: "forge",
            stationId: "forge",
            tier: 3,
            unlockLevel: 10,
            requiredLevel: 10,
            xp: 75,
            inputs: [{ itemId: "aether_alloy", quantity: 3 }],
            outputs: [{ itemId: "eg_sword_l10", quantity: 1 }],
            sourceHint: "Produza Liga Aetheriana na Forja antes de montar a arma.",
            description: "Forja uma arma rara de nível 10 com dano e precisão elevados."
        },
        {
            id: "forge_aether_chest",
            name: "Peitoral Aetheriano",
            icon: "▣",
            professionId: "blacksmithing",
            action: "forge",
            stationId: "forge",
            tier: 3,
            unlockLevel: 10,
            requiredLevel: 10,
            xp: 95,
            inputs: [{ itemId: "aether_alloy", quantity: 5 }],
            outputs: [{ itemId: "eg_chest_l10", quantity: 1 }],
            sourceHint: "Produza Liga Aetheriana na Forja antes de montar a armadura.",
            description: "Molda uma couraça pesada rara para os desafios após o nível 10."
        },
        {
            id: "forge_aether_helm",
            name: "Elmo Aetheriano",
            icon: "⌃",
            professionId: "blacksmithing",
            action: "forge",
            stationId: "forge",
            tier: 3,
            unlockLevel: 10,
            requiredLevel: 10,
            xp: 75,
            inputs: [{ itemId: "aether_alloy", quantity: 3 }],
            outputs: [{ itemId: "eg_head_l10", quantity: 1 }],
            sourceHint: "Produza Liga Aetheriana na Forja antes de montar a armadura.",
            description: "Forja um elmo raro de placa com grande defesa e vitalidade."
        },

        // ── Couraria T3 (Mestre) ──────────────────────────────────────────────
        {
            id: "tan_shadow_leather",
            name: "Curtir Couro Sombrio",
            icon: "◒",
            professionId: "leatherworking",
            action: "tan",
            stationId: "tannery",
            tier: 3,
            unlockLevel: 10,
            requiredLevel: 10,
            xp: 40,
            inputs: [
                { itemId: "reinforced_leather", quantity: 2 },
                { itemId: "shadow_thread", quantity: 1 },
                { itemId: "aether_fragment", quantity: 1 }
            ],
            outputs: [{ itemId: "shadow_leather", quantity: 1 }],
            sourceHuntId: "forgotten_crypt",
            sourceHint: "Espectros da Cripta Esquecida podem fornecer o Fio Sombrio.",
            description: "Une couro reforçado e fios espectrais em um material leve raro."
        },
        {
            id: "craft_shadow_chest",
            name: "Peitoral do Véu",
            icon: "▣",
            professionId: "leatherworking",
            action: "craft-leather",
            stationId: "tannery",
            tier: 3,
            unlockLevel: 10,
            requiredLevel: 10,
            xp: 90,
            inputs: [{ itemId: "shadow_leather", quantity: 4 }],
            outputs: [{ itemId: "crafted_shadow_chest_l10", quantity: 1 }],
            sourceHint: "Produza Couro Sombrio no Curtume antes de costurar esta peça.",
            description: "Costura uma armadura rara que equilibra defesa, vida e evasão."
        },
        {
            id: "craft_shadow_boots",
            name: "Botas do Véu",
            icon: "⌄",
            professionId: "leatherworking",
            action: "craft-leather",
            stationId: "tannery",
            tier: 3,
            unlockLevel: 10,
            requiredLevel: 10,
            xp: 68,
            inputs: [{ itemId: "shadow_leather", quantity: 2 }],
            outputs: [{ itemId: "crafted_shadow_feet_l10", quantity: 1 }],
            sourceHint: "Produza Couro Sombrio no Curtume antes de costurar esta peça.",
            description: "Botas raras de caçador com alta mobilidade e boa proteção."
        },
        {
            id: "craft_shadow_hood",
            name: "Capuz do Véu",
            icon: "⌃",
            professionId: "leatherworking",
            action: "craft-leather",
            stationId: "tannery",
            tier: 3,
            unlockLevel: 10,
            requiredLevel: 10,
            xp: 75,
            inputs: [{ itemId: "shadow_leather", quantity: 3 }],
            outputs: [{ itemId: "crafted_shadow_head_l10", quantity: 1 }],
            sourceHint: "Produza Couro Sombrio no Curtume antes de costurar esta peça.",
            description: "Capuz raro que protege sem sacrificar precisão e evasão."
        }
    ]);

    // ── Nomes de tier ─────────────────────────────────────────────────────────
    const TIER_NAMES = Object.freeze({ 1: "Iniciante", 2: "Oficial", 3: "Mestre" });

    // ── Receitas base de cada profissão ao nível 1 (já descobertas ao criar personagem) ──
    const STARTER_RECIPES = Object.freeze({
        blacksmithing: ["smelt_iron", "forge_iron_sword", "forge_iron_axe", "forge_iron_mace", "forge_iron_helm", "forge_iron_legs", "forge_plate_chest"],
        leatherworking: ["tan_beast_hide", "craft_leather_boots", "craft_leather_helm", "craft_leather_legs", "craft_leather_chest"]
    });

    // ── API pública ───────────────────────────────────────────────────────────
    Aethra.RecipeCatalog = {
        initialized: false,

        /** Todas as receitas (clone protegido). */
        all() {
            return RECIPES.map((recipe) => Object.assign({}, recipe));
        },

        /** Receitas de uma profissão específica. */
        byProfession(professionId) {
            return RECIPES
                .filter((recipe) => recipe.professionId === professionId)
                .map((recipe) => Object.assign({}, recipe));
        },

        /** Receitas que devem ser descobertas ao atingir determinado nível. */
        byUnlockLevel(professionId, level) {
            return RECIPES
                .filter((recipe) => recipe.professionId === professionId && recipe.unlockLevel === level)
                .map((recipe) => Object.assign({}, recipe));
        },

        /** IDs de receitas que um personagem novo já começa sabendo. */
        starterIds(professionId) {
            return (STARTER_RECIPES[professionId] || []).slice();
        },

        /** Nome legível do tier. */
        tierName(tier) {
            return TIER_NAMES[tier] || `Tier ${tier}`;
        },

        /** Receita por ID. */
        get(recipeId) {
            const found = RECIPES.find((recipe) => recipe.id === recipeId);
            return found ? Object.assign({}, found) : null;
        },

        init() {
            if (this.initialized) return;
            this.initialized = true;

            const byProfession = {};
            RECIPES.forEach((recipe) => {
                byProfession[recipe.professionId] = (byProfession[recipe.professionId] || 0) + 1;
            });

            Aethra.EventBus.emit("crafting:catalog-loaded", {
                total: RECIPES.length,
                byProfession
            });
        }
    };

    Aethra.RecipeCatalog.init();
})(window.Aethra);
