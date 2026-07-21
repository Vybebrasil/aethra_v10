// ProfessionWorkshopUI.js — oficina funcional de Forjaria e Couraria.
// Exibe receitas descobertas, tier por tier, com seção "A Descobrir" para as bloqueadas.
(function initProfessionWorkshopUI(Aethra) {
    "use strict";

    const WINDOW_ID = "profession-workshop-view";
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const esc   = (value) => String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    const fmt   = (value) => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("pt-BR");

    const ui = {
        professionId: "blacksmithing",
        stationId: null,
        techniqueId: "balanced",
        quantity: 1,
        notice: null,
        tab: "known",          // "known" | "undiscovered"
        newlyDiscovered: []    // IDs vistos como novidade desde a última abertura
    };
    let quantityRenderTimer = null;

    const professionMeta = {
        blacksmithing: { name: "Forjaria",  icon: "⚒", stationId: "forge",   station: "Forja da Cidade",   color: "#e5b65f" },
        leatherworking: { name: "Couraria", icon: "◈", stationId: "tannery", station: "Curtume da Cidade", color: "#b68a62" }
    };

    const TIER_LABELS = { 1: "Iniciante", 2: "Oficial", 3: "Mestre" };

    // ─── DOM ──────────────────────────────────────────────────────────────────
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

    // ─── Helpers de texto ─────────────────────────────────────────────────────
    function itemName(itemId) {
        return Aethra.GameData?.items?.[itemId]?.name || Aethra.ItemSystem?.templates?.[itemId]?.name || itemId;
    }

    function reasonText(validation) {
        const reasons = {
            "wrong-station":         `Acesse ${professionMeta[ui.professionId]?.station || "a estação correta"} na Cidade.`,
            "hunt-active":           "Finalize ou abandone a Hunt antes de produzir.",
            "insufficient-level":    `Requer nível ${validation.requiredLevel}; você está no ${validation.level}.`,
            "missing-materials":     "Materiais insuficientes.",
            "profession-locked":     "Este ofício ainda está bloqueado.",
            "recipe-not-discovered": "Esta receita ainda não foi descoberta."
        };
        return reasons[validation.reason] || "Esta receita ainda não pode ser criada.";
    }

    function qualityEstimate(recipe, technique) {
        const level   = Aethra.ProfessionSystem?.getState?.(recipe.professionId)?.level || 1;
        const mastery = Aethra.XPSystem?.getDiminishingSkillBonus?.(level, { scale: 14, interval: 14 }) || 0;
        const challenge = Math.min(18, Math.max(-12, (level - recipe.requiredLevel) * 0.7));
        const center  = Math.min(100, Math.max(1, Math.round(42 + mastery + challenge + Number(technique.qualityDelta || 0))));
        return `${Math.max(1, center - 8)}–${Math.min(100, center + 8)}`;
    }

    // ─── Renderização de um card de receita conhecida ─────────────────────────
    function recipeCard(recipe) {
        const cs         = Aethra.CraftingSystem;
        const technique  = cs.techniques[ui.techniqueId] || cs.techniques.balanced;
        const requirements = cs.resolveRequirements(recipe, ui.techniqueId, ui.quantity);
        const validation = cs.validateCraft(recipe.id, { stationId: ui.stationId, techniqueId: ui.techniqueId, quantity: ui.quantity });
        const output     = recipe.outputs.map((e) => `${e.quantity * ui.quantity}× ${itemName(e.itemId)}`).join(", ");
        const isNew      = ui.newlyDiscovered.includes(recipe.id);

        return `<article class="workshop-recipe ${validation.allowed ? "is-ready" : "is-blocked"}${isNew ? " is-new" : ""}">
            <header>
                <span>${esc(recipe.icon)}</span>
                <div>
                    <small>${esc(recipe.action.toUpperCase())} · NV. ${fmt(recipe.requiredLevel)}</small>
                    <strong>${esc(recipe.name)}${isNew ? " <mark class=\"badge-new\">NOVO</mark>" : ""}</strong>
                    <p>${esc(recipe.description)}</p>
                </div>
                <em>+${fmt(recipe.xp * ui.quantity)} XP</em>
            </header>
            <div class="workshop-recipe__flow">
                <div><small>MATERIAIS</small>${requirements.inputs.map((input) => {
                    const owned = Aethra.BagSystem?.countItem?.(input.itemId) || 0;
                    return `<span class="${owned >= input.quantity ? "has-item" : "missing-item"}"><b>${fmt(owned)}/${fmt(input.quantity)}</b> ${esc(itemName(input.itemId))}</span>`;
                }).join("")}</div>
                <i>→</i>
                <div>
                    <small>RESULTADO</small>
                    <strong>${esc(output)}</strong>
                    <span>Qualidade estimada ${qualityEstimate(recipe, technique)}</span>
                </div>
            </div>
            <footer>
                <small>${validation.allowed ? `Pronto em ${professionMeta[recipe.professionId].station}` : esc(reasonText(validation))}</small>
                <button type="button" data-craft-recipe="${esc(recipe.id)}" ${validation.allowed ? "" : "disabled"}>Criar ${fmt(ui.quantity)}</button>
            </footer>
        </article>`;
    }

    // ─── Card de receita ainda não descoberta ─────────────────────────────────
    function lockedCard(recipe) {
        const profLevel = Aethra.ProfessionSystem?.getState?.(recipe.professionId)?.level || 1;
        const needed    = recipe.unlockLevel;
        const delta     = Math.max(0, needed - profLevel);
        return `<article class="workshop-recipe is-locked" aria-label="Receita bloqueada: ${esc(recipe.name)}">
            <header>
                <span class="locked-icon">🔒</span>
                <div>
                    <small>${TIER_LABELS[recipe.tier] || "Tier " + recipe.tier} · NV. ${fmt(recipe.requiredLevel)}</small>
                    <strong>${esc(recipe.name)}</strong>
                    <p>${esc(recipe.description)}</p>
                </div>
            </header>
            <footer>
                <small>${delta > 0 ? `Descobre no nível ${needed} de ${professionMeta[recipe.professionId]?.name || recipe.professionId} (faltam ${delta} nível${delta > 1 ? "is" : ""})` : "Reinicie ou crie um personagem novo para descobrir esta receita."}</small>
            </footer>
        </article>`;
    }

    // ─── Seção por tier ───────────────────────────────────────────────────────
    function tierSection(tier, recipes, renderFn) {
        const label = TIER_LABELS[tier] || `Tier ${tier}`;
        return `<section class="workshop-tier">
            <h3 class="workshop-tier__label"><span>${label}</span></h3>
            <div class="workshop-tier__recipes">${recipes.map(renderFn).join("")}</div>
        </section>`;
    }

    // ─── Renderização principal ───────────────────────────────────────────────
    function render() {
        const element    = ensureWindow();
        const meta       = professionMeta[ui.professionId] || professionMeta.blacksmithing;
        const skill      = Aethra.ProfessionSystem?.getState?.(ui.professionId) || { level: 1, xpCurrent: 0, xpNext: 1 };
        const cs         = Aethra.CraftingSystem;
        element.style.setProperty("--workshop-accent", meta.color);

        // Receitas conhecidas agrupadas por tier
        const known      = cs?.getRecipes?.(ui.professionId) || [];
        const byTier     = {};
        known.forEach((recipe) => {
            const t = recipe.tier || 1;
            (byTier[t] = byTier[t] || []).push(recipe);
        });
        const knownHTML  = Object.keys(byTier).sort().map((tier) => tierSection(Number(tier), byTier[tier], recipeCard)).join("") || "<p class=\"workshop-empty\">Nenhuma receita descoberta ainda. Pratique o ofício!</p>";

        // Receitas ainda não descobertas
        const undiscovered = cs?.getUndiscovered?.(ui.professionId) || [];
        const uByTier    = {};
        undiscovered.forEach((recipe) => {
            const t = recipe.tier || 1;
            (uByTier[t] = uByTier[t] || []).push(recipe);
        });
        const undiscoveredHTML = Object.keys(uByTier).sort().map((tier) => tierSection(Number(tier), uByTier[tier], lockedCard)).join("") || "<p class=\"workshop-empty\">Você conhece todas as receitas disponíveis! 🎉</p>";

        const badgeCount = ui.newlyDiscovered.filter((id) => cs?.getRecipe?.(id)?.professionId === ui.professionId).length;

        element.innerHTML = `<div class="profession-workshop__shell">
            <header class="profession-workshop__header">
                <span>${meta.icon}</span>
                <div>
                    <small>OFÍCIO E PRODUÇÃO</small>
                    <h2>${esc(meta.name)}</h2>
                    <p>${ui.stationId ? esc(meta.station) : "Catálogo · visite a estação na Cidade para produzir"}</p>
                </div>
                <button type="button" data-close-window="${WINDOW_ID}" aria-label="Fechar">×</button>
            </header>

            <section class="profession-workshop__status">
                <span><small>NÍVEL DO OFÍCIO</small><strong>${fmt(skill.level)}</strong></span>
                <span><small>PROGRESSO</small><strong>${fmt(skill.xpCurrent)}/${fmt(skill.xpNext)} XP</strong></span>
                <span><small>MODO DE XP</small><strong>${skill.trainingMode === "locked" ? "Travado" : "Treinando"}</strong></span>
            </section>

            <nav class="profession-workshop__tabs">
                ${Object.entries(professionMeta).map(([id, entry]) =>
                    `<button type="button" data-workshop-profession="${id}" class="${id === ui.professionId ? "is-active" : ""}">${entry.icon} ${entry.name}</button>`
                ).join("")}
            </nav>

            <nav class="profession-workshop__subtabs">
                <button type="button" data-workshop-tab="known"        class="${ui.tab === "known"        ? "is-active" : ""}">Conhecidas</button>
                <button type="button" data-workshop-tab="undiscovered" class="${ui.tab === "undiscovered" ? "is-active" : ""}">A Descobrir${undiscovered.length > 0 ? ` <span class="badge-count">${undiscovered.length}</span>` : ""}${badgeCount > 0 ? ` <span class="badge-new-pill">${badgeCount} novo${badgeCount > 1 ? "s" : ""}</span>` : ""}</button>
            </nav>

            <section class="profession-workshop__controls">
                <label>Técnica
                    <select data-workshop-technique>
                        ${Object.values(cs?.techniques || {}).map((t) =>
                            `<option value="${t.id}" ${t.id === ui.techniqueId ? "selected" : ""}>${esc(t.name)} — ${esc(t.description)}</option>`
                        ).join("")}
                    </select>
                </label>
                <label>Quantidade
                    <input type="number" min="1" max="20" value="${ui.quantity}" data-workshop-quantity>
                </label>
            </section>

            ${ui.notice ? `<div class="profession-workshop__notice is-${esc(ui.notice.tone)}" role="status">${esc(ui.notice.message)}</div>` : ""}

            <div class="profession-workshop__recipes">
                ${ui.tab === "known" ? knownHTML : undiscoveredHTML}
            </div>
        </div>`;

        return element;
    }

    // ─── Abrir oficina ────────────────────────────────────────────────────────
    function open(professionId = "blacksmithing", stationId = null) {
        if (professionMeta[professionId]) ui.professionId = professionId;
        const inCity = Aethra.GameState.ui?.primaryView === "city" && !Aethra.GameState.hunt?.isActive;
        ui.stationId  = stationId || (inCity ? professionMeta[ui.professionId].stationId : null);
        ui.notice     = null;
        ui.tab        = "known";

        // Seeding: se não há receitas descobertas, descobre os starters agora
        const cs = Aethra.CraftingSystem;
        if (cs && typeof cs.discoverStarters === "function") {
            const discovered = Aethra.GameState.crafting?.discovered || [];
            if (discovered.length === 0) {
                ["blacksmithing", "leatherworking"].forEach((id) => cs.discoverStarters(id));
            }
        }

        render();
        return Aethra.WindowManager?.openWindow?.(WINDOW_ID, { source: "profession-workshop", exclusive: true });
    }

    // ─── Execução de craft ────────────────────────────────────────────────────
    function craft(recipeId) {
        const result = Aethra.CraftingSystem?.craft?.(recipeId, {
            stationId:   ui.stationId,
            techniqueId: ui.techniqueId,
            quantity:    ui.quantity,
            commandId:   window.crypto?.randomUUID?.() || `craft_${Date.now()}_${Math.random()}`
        });
        ui.notice = result?.accepted
            ? { tone: "success", message: `${result.recipe.name}: ${result.outputs.length} resultado(s) criado(s).` }
            : { tone: "error",   message: reasonText(result || {}) };
        render();
        return result;
    }

    // ─── Event listeners ──────────────────────────────────────────────────────
    document.addEventListener("click", (event) => {
        // Abrir da cidade / NPC
        const openButton = event.target.closest(`[data-open-profession-workshop]`);
        if (openButton && !openButton.closest(`#${WINDOW_ID}`)) {
            open(openButton.dataset.openProfessionWorkshop);
            return;
        }
        // Trocar profissão
        const profession = event.target.closest(`#${WINDOW_ID} [data-workshop-profession]`);
        if (profession) {
            ui.professionId = profession.dataset.workshopProfession;
            const inCity = Aethra.GameState.ui?.primaryView === "city" && !Aethra.GameState.hunt?.isActive;
            ui.stationId = inCity ? professionMeta[ui.professionId].stationId : null;
            ui.notice = null;
            render();
            return;
        }
        // Trocar aba
        const tab = event.target.closest(`#${WINDOW_ID} [data-workshop-tab]`);
        if (tab) {
            ui.tab = tab.dataset.workshopTab;
            // Ao ver a aba conhecidas novamente, limpar novidades desta profissão
            if (ui.tab === "known") {
                ui.newlyDiscovered = ui.newlyDiscovered.filter(
                    (id) => Aethra.CraftingSystem?.getRecipe?.(id)?.professionId !== ui.professionId
                );
            }
            render();
            return;
        }
        // Executar craft
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

    // ─── Reatividade a eventos ────────────────────────────────────────────────
    Aethra.EventBus.on("crafting:completed", render);
    Aethra.EventBus.on("inventory:changed", () => {
        if (Aethra.WindowManager?.isWindowOpen?.(WINDOW_ID)) render();
    });
    Aethra.EventBus.on("crafting:recipe-discovered", ({ recipeId } = {}) => {
        if (recipeId && !ui.newlyDiscovered.includes(recipeId)) {
            ui.newlyDiscovered.push(recipeId);
        }
        if (Aethra.WindowManager?.isWindowOpen?.(WINDOW_ID)) render();
    });
    Aethra.EventBus.on("city:npcInteracted", ({ entity } = {}) => {
        if (entity?.id === "blacksmith") open("blacksmithing", "forge");
        if (entity?.id === "tanner")     open("leatherworking", "tannery");
    });

    // ─── API pública ──────────────────────────────────────────────────────────
    Aethra.ProfessionWorkshopUI = { open, render, craft, getState: () => clone(ui) };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureWindow, { once: true });
    else ensureWindow();
})(window.Aethra);
