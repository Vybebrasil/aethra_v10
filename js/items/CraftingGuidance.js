// CraftingGuidance.js — ofícios de criação, suas estações e que receita o
// contrato ativo pede. Só leitura: junta QuestSystem, DisciplineSystem,
// ProfessionSystem e CraftingSystem para qualquer interface de oficina.
(function initCraftingGuidance(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const PROFESSIONS = Object.freeze({
        blacksmithing: Object.freeze({ name: "Forjaria", icon: "⚒", stationId: "forge", station: "Forja da Cidade", color: "#e5b65f" }),
        leatherworking: Object.freeze({ name: "Couraria", icon: "◈", stationId: "tannery", station: "Curtume da Cidade", color: "#b68a62" }),
        alchemy: Object.freeze({ name: "Alquimia", icon: "⚗", stationId: "laboratory", station: "Laboratório de Alquimia", color: "#72d6a5" })
    });

    function isEquipmentRecipe(recipe) {
        return (recipe?.outputs || []).some((output) => {
            const template = Aethra.GameData?.items?.[output.itemId]
                || Aethra.ItemSystem?.templates?.[output.itemId]
                || {};
            return Boolean(template.slot || template.allowedSlots?.length);
        });
    }

    // Passo de contrato que pede este ofício: a missão acompanhada ou o treino em foco.
    function getGuidance(professionId) {
        const tracked = Aethra.QuestSystem?.getGuidance?.();
        if (tracked?.action === "open-workshop" && tracked.professionId === professionId) return tracked;
        const focusId = Aethra.DisciplineSystem?.getFocusId?.();
        const focus = focusId ? Aethra.ProfessionSystem?.getFocusTrainingState?.(focusId) : null;
        const focusedGuidance = focus?.active ? focus.guidance : null;
        return focusedGuidance?.action === "open-workshop" && focusedGuidance.professionId === professionId
            ? focusedGuidance
            : null;
    }

    function guidedRecipeId(guidance) {
        return guidance?.objective?.type === "CraftRecipe" ? guidance.target : null;
    }

    function isGuidedRecipe(recipe, guidance) {
        if (!guidance || guidance.professionId !== recipe?.professionId) return false;
        const type = guidance.objective?.type;
        if (type === "CraftRecipe") return guidance.target === recipe.id;
        const allowedRecipeIds = guidance.objective?.allowedRecipeIds || [];
        if (type === "CraftSupply") return allowedRecipeIds.length === 0 || allowedRecipeIds.includes(recipe.id);
        if (type !== "CraftEquipment" || !isEquipmentRecipe(recipe)) return false;
        return allowedRecipeIds.length === 0 || allowedRecipeIds.includes(recipe.id);
    }

    // Título e explicação do passo de contrato, para qualquer oficina mostrar.
    function describe(guidance) {
        if (!guidance) return null;
        const type = guidance.objective?.type;
        const recipe = type === "CraftRecipe" ? Aethra.CraftingSystem?.getRecipe?.(guidance.target) : null;
        if (type === "CraftEquipment") {
            return {
                title: "Escolha seu primeiro equipamento",
                detail: guidance.professionId === "leatherworking"
                    ? "Botas, Capuz e Calças de Couro concluem o contrato. Compare as opções destacadas e escolha a que combina com seu estilo."
                    : "Espada, Machado e Maça de Recruta concluem o contrato. Compare as opções destacadas e escolha a que combina com seu estilo."
            };
        }
        if (type === "CraftSupply") {
            return {
                title: "Escolha seu primeiro suprimento",
                detail: "Poção de Vida, Poção de Mana ou Tônico de Vigor concluem o contrato. A escolha produz 3 unidades e entra no estoque da Hunt."
            };
        }
        return {
            title: recipe ? `Produza ${recipe.name}` : guidance.objective?.label || "Passo da missão",
            detail: "A receita necessária foi trazida para o topo. Confira os materiais e conclua esta etapa do contrato."
        };
    }

    // Só se produz na estação da Cidade; na Hunt a oficina é apenas catálogo.
    function stationFor(professionId, { inCity = false } = {}) {
        return inCity ? PROFESSIONS[professionId]?.stationId || null : null;
    }

    Aethra.CraftingGuidance = Object.freeze({
        professions: PROFESSIONS,
        getGuidance,
        guidedRecipeId,
        isGuidedRecipe,
        describe,
        isEquipmentRecipe,
        stationFor
    });
})(window.Aethra = window.Aethra || {});
