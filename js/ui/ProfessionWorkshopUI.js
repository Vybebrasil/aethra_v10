// ProfessionWorkshopUI.js - oficina funcional de Forjaria e Couraria.
(function initProfessionWorkshopUI(Aethra) {
    "use strict";

    const WINDOW_ID = "profession-workshop-view";
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
    const fmt = (value) => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("pt-BR");
    const ui = { professionId: "blacksmithing", stationId: null, techniqueId: "balanced", quantity: 1, notice: null };
    let quantityRenderTimer = null;

    const professionMeta = {
        blacksmithing: { name: "Forjaria", icon: "⚒", stationId: "forge", station: "Forja da Cidade", color: "#e5b65f" },
        leatherworking: { name: "Couraria", icon: "◈", stationId: "tannery", station: "Curtume da Cidade", color: "#b68a62" }
    };

    function ensureWindow() {
        let element = document.getElementById(WINDOW_ID);
        if (!element) {
            element = document.createElement("section");
            element.id = WINDOW_ID;
            element.className = "game-window profession-workshop hidden";
            element.dataset.aethraWindow = WINDOW_ID;
            element.setAttribute("aria-hidden", "true");
            (document.getElementById("modal-layer") || document.body).appendChild(element);
        }
        Aethra.WindowManager?.registerWindow?.(WINDOW_ID, element);
        return element;
    }

    function itemName(itemId) {
        return Aethra.GameData?.items?.[itemId]?.name || Aethra.ItemSystem?.templates?.[itemId]?.name || itemId;
    }

    function reasonText(validation) {
        const reasons = {
            "wrong-station": `Acesse ${professionMeta[ui.professionId]?.station || "a estação correta"} na Cidade.`,
            "hunt-active": "Finalize ou abandone a Hunt antes de produzir.",
            "insufficient-level": `Requer nível ${validation.requiredLevel}; você está no ${validation.level}.`,
            "missing-materials": "Materiais insuficientes.",
            "profession-locked": "Este ofício ainda está bloqueado."
        };
        return reasons[validation.reason] || "Esta receita ainda não pode ser criada.";
    }

    function qualityEstimate(recipe, technique) {
        const level = Aethra.ProfessionSystem?.getState?.(recipe.professionId)?.level || 1;
        const mastery = Aethra.XPSystem?.getDiminishingSkillBonus?.(level, { scale: 14, interval: 14 }) || 0;
        const challenge = Math.min(18, Math.max(-12, (level - recipe.requiredLevel) * 0.7));
        const center = Math.min(100, Math.max(1, Math.round(42 + mastery + challenge + Number(technique.qualityDelta || 0))));
        return `${Math.max(1, center - 8)}–${Math.min(100, center + 8)}`;
    }

    function recipeCard(recipe) {
        const technique = Aethra.CraftingSystem.techniques[ui.techniqueId] || Aethra.CraftingSystem.techniques.balanced;
        const requirements = Aethra.CraftingSystem.resolveRequirements(recipe, ui.techniqueId, ui.quantity);
        const validation = Aethra.CraftingSystem.validateCraft(recipe.id, { stationId: ui.stationId, techniqueId: ui.techniqueId, quantity: ui.quantity });
        const output = recipe.outputs.map((entry) => `${entry.quantity * ui.quantity}× ${itemName(entry.itemId)}`).join(", ");
        return `<article class="workshop-recipe ${validation.allowed ? "is-ready" : "is-blocked"}">
            <header><span>${esc(recipe.icon)}</span><div><small>${esc(recipe.action.toUpperCase())} · NV. ${fmt(recipe.requiredLevel)}</small><strong>${esc(recipe.name)}</strong><p>${esc(recipe.description)}</p></div><em>+${fmt(recipe.xp * ui.quantity)} XP</em></header>
            <div class="workshop-recipe__flow">
                <div><small>MATERIAIS</small>${requirements.inputs.map((input) => {
                    const owned = Aethra.BagSystem?.countItem?.(input.itemId) || 0;
                    return `<span class="${owned >= input.quantity ? "has-item" : "missing-item"}"><b>${fmt(owned)}/${fmt(input.quantity)}</b> ${esc(itemName(input.itemId))}</span>`;
                }).join("")}</div><i>→</i><div><small>RESULTADO</small><strong>${esc(output)}</strong><span>Qualidade estimada ${qualityEstimate(recipe, technique)}</span></div>
            </div>
            <footer><small>${validation.allowed ? `Pronto em ${professionMeta[recipe.professionId].station}` : esc(reasonText(validation))}</small><button type="button" data-craft-recipe="${esc(recipe.id)}" ${validation.allowed ? "" : "disabled"}>Criar ${fmt(ui.quantity)}</button></footer>
        </article>`;
    }

    function render() {
        const element = ensureWindow();
        const meta = professionMeta[ui.professionId] || professionMeta.blacksmithing;
        const skill = Aethra.ProfessionSystem?.getState?.(ui.professionId) || { level: 1, xpCurrent: 0, xpNext: 1 };
        const recipes = Aethra.CraftingSystem?.getRecipes?.(ui.professionId) || [];
        element.style.setProperty("--workshop-accent", meta.color);
        element.innerHTML = `<div class="profession-workshop__shell">
            <header class="profession-workshop__header"><span>${meta.icon}</span><div><small>OFÍCIO E PRODUÇÃO</small><h2>${esc(meta.name)}</h2><p>${ui.stationId ? esc(meta.station) : "Catálogo · visite a estação na Cidade para produzir"}</p></div><button type="button" data-close-window="${WINDOW_ID}" aria-label="Fechar">×</button></header>
            <section class="profession-workshop__status"><span><small>NÍVEL DO OFÍCIO</small><strong>${fmt(skill.level)}</strong></span><span><small>PROGRESSO</small><strong>${fmt(skill.xpCurrent)}/${fmt(skill.xpNext)} XP</strong></span><span><small>MODO DE XP</small><strong>${skill.trainingMode === "locked" ? "Travado" : "Treinando"}</strong></span></section>
            <nav class="profession-workshop__tabs">${Object.entries(professionMeta).map(([id, entry]) => `<button type="button" data-workshop-profession="${id}" class="${id === ui.professionId ? "is-active" : ""}">${entry.icon} ${entry.name}</button>`).join("")}</nav>
            <section class="profession-workshop__controls"><label>Técnica<select data-workshop-technique>${Object.values(Aethra.CraftingSystem?.techniques || {}).map((technique) => `<option value="${technique.id}" ${technique.id === ui.techniqueId ? "selected" : ""}>${esc(technique.name)} — ${esc(technique.description)}</option>`).join("")}</select></label><label>Quantidade<input type="number" min="1" max="20" value="${ui.quantity}" data-workshop-quantity></label></section>
            ${ui.notice ? `<div class="profession-workshop__notice is-${esc(ui.notice.tone)}" role="status">${esc(ui.notice.message)}</div>` : ""}
            <div class="profession-workshop__recipes">${recipes.map(recipeCard).join("")}</div>
        </div>`;
        return element;
    }

    function open(professionId = "blacksmithing", stationId = null) {
        if (professionMeta[professionId]) ui.professionId = professionId;
        const inCity = Aethra.GameState.ui?.primaryView === "city" && !Aethra.GameState.hunt?.isActive;
        ui.stationId = stationId || (inCity ? professionMeta[ui.professionId].stationId : null);
        ui.notice = null;
        render();
        return Aethra.WindowManager?.openWindow?.(WINDOW_ID, { source: "profession-workshop", exclusive: true });
    }

    function craft(recipeId) {
        const result = Aethra.CraftingSystem?.craft?.(recipeId, {
            stationId: ui.stationId,
            techniqueId: ui.techniqueId,
            quantity: ui.quantity,
            commandId: window.crypto?.randomUUID?.() || `craft_${Date.now()}_${Math.random()}`
        });
        ui.notice = result?.accepted
            ? { tone: "success", message: `${result.recipe.name}: ${result.outputs.length} resultado(s) criado(s).` }
            : { tone: "error", message: reasonText(result || {}) };
        render();
        return result;
    }

    document.addEventListener("click", (event) => {
        const openButton = event.target.closest(`[data-open-profession-workshop]`);
        if (openButton && !openButton.closest(`#${WINDOW_ID}`)) {
            open(openButton.dataset.openProfessionWorkshop);
            return;
        }
        const profession = event.target.closest(`#${WINDOW_ID} [data-workshop-profession]`);
        if (profession) {
            ui.professionId = profession.dataset.workshopProfession;
            const inCity = Aethra.GameState.ui?.primaryView === "city" && !Aethra.GameState.hunt?.isActive;
            ui.stationId = inCity ? professionMeta[ui.professionId].stationId : null;
            ui.notice = null;
            render();
            return;
        }
        const recipe = event.target.closest(`#${WINDOW_ID} [data-craft-recipe]`);
        if (recipe) craft(recipe.dataset.craftRecipe);
    });

    document.addEventListener("change", (event) => {
        if (event.target.matches(`#${WINDOW_ID} [data-workshop-technique]`)) {
            ui.techniqueId = event.target.value;
            render();
        }
    });

    document.addEventListener("input", (event) => {
        if (!event.target.matches(`#${WINDOW_ID} [data-workshop-quantity]`)) return;
        ui.quantity = Math.min(20, Math.max(1, Math.floor(Number(event.target.value) || 1)));
        window.clearTimeout(quantityRenderTimer);
        quantityRenderTimer = window.setTimeout(render, 180);
    });

    Aethra.EventBus.on("crafting:completed", render);
    Aethra.EventBus.on("inventory:changed", () => {
        if (Aethra.WindowManager?.isWindowOpen?.(WINDOW_ID)) render();
    });
    Aethra.EventBus.on("city:npcInteracted", ({ entity } = {}) => {
        if (entity?.id === "blacksmith") open("blacksmithing", "forge");
        if (entity?.id === "tanner") open("leatherworking", "tannery");
    });

    Aethra.ProfessionWorkshopUI = { open, render, craft, getState: () => clone(ui) };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureWindow, { once: true });
    else ensureWindow();
})(window.Aethra);
