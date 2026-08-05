// ProfessionWorkshopUI.js — oficina funcional de Forjaria, Couraria e Alquimia.
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
        guidedRecipeId: null,
        tab: "known",          // "known" | "undiscovered" | "maintenance"
        newlyDiscovered: []    // IDs vistos como novidade desde a última abertura
    };
    let quantityRenderTimer = null;

    const professionMeta = {
        blacksmithing: { name: "Forjaria",  icon: "⚒", stationId: "forge",   station: "Forja da Cidade",   color: "#e5b65f" },
        leatherworking: { name: "Couraria", icon: "◈", stationId: "tannery", station: "Curtume da Cidade", color: "#b68a62" },
        alchemy: { name: "Alquimia", icon: "⚗", stationId: "laboratory", station: "Laboratório de Alquimia", color: "#72d6a5" }
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
        const perkBonus = Number(Aethra.ProfessionSystem?.getProfessionModifiers?.(recipe.professionId)?.craftQuality || 0);
        const center  = Math.min(100, Math.max(1, Math.round(42 + mastery + challenge + Number(technique.qualityDelta || 0) + perkBonus)));
        return `${Math.max(1, center - 8)}–${Math.min(100, center + 8)}`;
    }

    function isEquipmentRecipe(recipe) {
        return (recipe?.outputs || []).some((output) => {
            const template = Aethra.GameData?.items?.[output.itemId]
                || Aethra.ItemSystem?.templates?.[output.itemId]
                || {};
            return Boolean(template.slot || template.allowedSlots?.length);
        });
    }

    function resolveWorkshopGuidance() {
        const tracked = Aethra.QuestSystem?.getGuidance?.();
        if (tracked?.action === "open-workshop" && tracked.professionId === ui.professionId) {
            return tracked;
        }
        const focusId = Aethra.DisciplineSystem?.getFocusId?.();
        const focus = focusId ? Aethra.ProfessionSystem?.getFocusTrainingState?.(focusId) : null;
        const focusedGuidance = focus?.active ? focus.guidance : null;
        return focusedGuidance?.action === "open-workshop" && focusedGuidance.professionId === ui.professionId
            ? focusedGuidance
            : null;
    }

    function resolveGuidedRecipeId(guidance = resolveWorkshopGuidance()) {
        return guidance?.objective?.type === "CraftRecipe" ? guidance.target : null;
    }

    function isGuidedRecipe(recipe, guidance = resolveWorkshopGuidance()) {
        if (!guidance || guidance.professionId !== recipe.professionId) return false;
        if (guidance.objective?.type === "CraftRecipe") return guidance.target === recipe.id;
        if (guidance.objective?.type === "CraftSupply") {
            const allowedRecipeIds = guidance.objective.allowedRecipeIds || [];
            return allowedRecipeIds.length === 0 || allowedRecipeIds.includes(recipe.id);
        }
        if (guidance.objective?.type !== "CraftEquipment" || !isEquipmentRecipe(recipe)) return false;
        const allowedRecipeIds = guidance.objective.allowedRecipeIds || [];
        return allowedRecipeIds.length === 0 || allowedRecipeIds.includes(recipe.id);
    }

    function workshopGuidanceHTML(guidance) {
        if (!guidance) return "";
        const choosingEquipment = guidance.objective?.type === "CraftEquipment";
        const choosingSupply = guidance.objective?.type === "CraftSupply";
        const recipe = guidance.objective?.type === "CraftRecipe"
            ? Aethra.CraftingSystem?.getRecipe?.(guidance.target)
            : null;
        const title = choosingEquipment
            ? "Escolha seu primeiro equipamento"
            : choosingSupply
                ? "Escolha seu primeiro supply"
            : recipe
                ? `Produza ${recipe.name}`
                : guidance.objective?.label;
        const detail = choosingEquipment
            ? guidance.professionId === "leatherworking"
                ? "Botas, Chapéu e Calças de Couro concluem o contrato. Compare as opções destacadas e escolha a que combina com seu estilo."
                : "Espada, Machado e Maça de Ferro concluem o contrato. Compare as opções destacadas e escolha a que combina com seu estilo."
            : choosingSupply
                ? "Poção de Vida, Poção de Mana ou Tônico de Vigor concluem o contrato. A escolha produz 3 unidades e entra no estoque da Hunt."
            : "A receita necessária foi trazida para o topo. Confira os materiais e conclua esta etapa do contrato.";
        return `<section class="profession-workshop__guidance" role="status">
            <span>✦</span>
            <div><small>PASSO DO CONTRATO</small><strong>${esc(title)}</strong><p>${esc(detail)}</p></div>
        </section>`;
    }

    function sourceGuidance(recipe) {
        if (!recipe?.sourceHint) return "";
        return `<aside class="workshop-recipe__source"><small>ONDE CONSEGUIR</small><span>${esc(recipe.sourceHint)}</span></aside>`;
    }

    // ─── Renderização de um card de receita conhecida ─────────────────────────
    function recipeCard(recipe) {
        const cs         = Aethra.CraftingSystem;
        const technique  = cs.techniques[ui.techniqueId] || cs.techniques.balanced;
        const requirements = cs.resolveRequirements(recipe, ui.techniqueId, ui.quantity);
        const validation = cs.validateCraft(recipe.id, { stationId: ui.stationId, techniqueId: ui.techniqueId, quantity: ui.quantity });
        const output     = recipe.outputs.map((e) => `${e.quantity * ui.quantity}× ${itemName(e.itemId)}`).join(", ");
        const isNew      = ui.newlyDiscovered.includes(recipe.id);
        const isGuided   = isGuidedRecipe(recipe);
        const xpBonus    = Number(Aethra.ProfessionSystem?.getProfessionModifiers?.(recipe.professionId)?.craftXpPercent || 0);
        const earnedXp   = Math.max(1, Math.round(recipe.xp * ui.quantity * (1 + (xpBonus / 100))));

        return `<article class="workshop-recipe ${validation.allowed ? "is-ready" : "is-blocked"}${isNew ? " is-new" : ""}${isGuided ? " is-guided" : ""}">
            <header>
                <span>${esc(recipe.icon)}</span>
                <div>
                    <small>${esc(recipe.action.toUpperCase())} · NV. ${fmt(recipe.requiredLevel)}</small>
                    <strong>${esc(recipe.name)}${isNew ? " <mark class=\"badge-new\">NOVO</mark>" : ""}${isGuided ? " <mark class=\"badge-guided\">MISSÃO</mark>" : ""}</strong>
                    <p>${esc(recipe.description)}</p>
                </div>
                <em>+${fmt(earnedXp)} XP${xpBonus > 0 ? ` <small>(+${xpBonus.toFixed(1)}%)</small>` : ""}</em>
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
                    <span>${recipe.professionId === "alchemy" ? "Rendimento fixo por lote" : `Qualidade estimada ${qualityEstimate(recipe, technique)}`}</span>
                </div>
            </div>
            ${sourceGuidance(recipe)}
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
            ${sourceGuidance(recipe)}
            <footer>
                <small>${delta > 0 ? `Descobre no nível ${needed} de ${professionMeta[recipe.professionId]?.name || recipe.professionId} (faltam ${delta} nível${delta > 1 ? "is" : ""})` : "Reinicie ou crie um personagem novo para descobrir esta receita."}</small>
            </footer>
        </article>`;
    }

    function maintenanceReasonText(validation = {}) {
        const reasons = {
            "not-damaged": "Este item já está em condição máxima.",
            "not-in-city": "Visite a oficina correta na Cidade.",
            "wrong-station": `Use ${professionMeta[ui.professionId]?.station || "a oficina correta"}.`,
            "missing-materials": `Falta ${validation.materialName || "material de reparo"}.`,
            "insufficient-gold": "A reserva de Gold impede este reparo.",
            "cycle-budget": "O limite de gasto deste ciclo foi atingido.",
            "item-not-maintainable": "Este item não exige manutenção."
        };
        return reasons[validation.reason] || "Este reparo não pode ser realizado agora.";
    }

    function durabilityLabel(status) {
        return {
            good: "Estável",
            worn: "Desgastado",
            critical: "Crítico",
            broken: "Quebrado"
        }[status] || "Estável";
    }

    function maintenanceCard(entry) {
        const item = entry.item || {};
        const validation = Aethra.EquipmentMaintenanceSystem?.validateRepair?.(
            item.instanceId,
            { stationId: ui.stationId }
        ) || { allowed: false, reason: "item-not-maintainable" };
        const percent = Math.max(0, Math.min(100, Number(entry.percent || 0)));
        const isDamaged = percent < 100;
        const icon = item.icon || Aethra.GameData?.items?.[item.templateId]?.icon || "◇";
        return `<article class="workshop-maintenance-card is-${esc(entry.status)}${entry.equipped ? " is-equipped" : ""}">
            <header>
                <span>${esc(icon)}</span>
                <div>
                    <small>${entry.equipped ? `EQUIPADO · ${esc(String(entry.slot || "slot").toUpperCase())}` : "NA MOCHILA"}</small>
                    <strong>${esc(item.name || item.baseName || item.templateId || "Equipamento")}</strong>
                    <p>${durabilityLabel(entry.status)}${entry.effectiveness < 1 ? ` · ${Math.round(entry.effectiveness * 100)}% dos atributos ativos` : " · atributos completos"}</p>
                </div>
                <em>${percent.toFixed(0)}%</em>
            </header>
            <div class="workshop-durability" role="meter" aria-label="Durabilidade" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent.toFixed(0)}">
                <i><b style="width:${percent}%"></b></i>
                <span>${fmt(entry.before)}/${fmt(entry.after)}</span>
            </div>
            <div class="workshop-maintenance-card__cost">
                <span><small>GOLD</small><strong>${isDamaged ? `${fmt(entry.gold)} G` : "—"}</strong></span>
                <span class="${entry.hasMaterial || !isDamaged ? "has-item" : "missing-item"}"><small>MATERIAL</small><strong>${isDamaged ? `${fmt(entry.ownedMaterial)}/${fmt(entry.materialQuantity)} ${esc(entry.materialName)}` : "Peça íntegra"}</strong></span>
                <span><small>OFÍCIO</small><strong>+${fmt(entry.xp)} XP</strong></span>
            </div>
            <footer>
                <small>${validation.allowed ? `Pronto em ${esc(professionMeta[entry.professionId]?.station || "oficina")}` : esc(maintenanceReasonText(validation))}</small>
                <button type="button" data-repair-item="${esc(item.instanceId || "")}" ${validation.allowed ? "" : "disabled"}>Reparar</button>
            </footer>
        </article>`;
    }

    function maintenancePanel() {
        const system = Aethra.EquipmentMaintenanceSystem;
        const snapshot = system?.getSnapshot?.(ui.professionId) || {
            policy: { enabled: false, thresholdPercent: 35, reserveGold: 25, maxGoldPerCycle: 100 },
            items: [], damaged: 0, critical: 0, broken: 0, estimatedGold: 0
        };
        const policy = snapshot.policy;
        const items = [...snapshot.items].sort((a, b) => Number(a.percent) - Number(b.percent));
        const damaged = items.filter((entry) => Number(entry.percent) < 100);
        const cards = items.length
            ? items.map(maintenanceCard).join("")
            : `<p class="workshop-empty">Nenhum equipamento atendido por esta oficina.</p>`;
        return `<section class="workshop-maintenance-dashboard">
            <header class="workshop-maintenance-summary">
                <span><small>DANIFICADOS</small><strong>${fmt(snapshot.damaged)}</strong></span>
                <span><small>CRÍTICOS</small><strong>${fmt(snapshot.critical)}</strong></span>
                <span><small>QUEBRADOS</small><strong>${fmt(snapshot.broken)}</strong></span>
                <span><small>ESTIMATIVA</small><strong>${fmt(snapshot.estimatedGold)} G</strong></span>
            </header>
            <section class="workshop-maintenance-policy">
                <div>
                    <small>SERVIÇO AUTOMÁTICO DA CIDADE</small>
                    <strong>Reparar antes de iniciar uma Hunt</strong>
                    <p>Prioriza os itens mais danificados e respeita sua reserva e o teto por ciclo.</p>
                </div>
                <label class="workshop-policy-toggle"><input type="checkbox" data-maintenance-policy="enabled" ${policy.enabled ? "checked" : ""}><span>${policy.enabled ? "Ativo" : "Desligado"}</span></label>
                <label>Reparar abaixo de <input type="number" min="5" max="90" step="5" value="${fmt(policy.thresholdPercent)}" data-maintenance-policy="thresholdPercent"><em>%</em></label>
                <label>Reserva de Gold <input type="number" min="0" step="5" value="${fmt(policy.reserveGold)}" data-maintenance-policy="reserveGold"><em>G</em></label>
                <label>Limite por ciclo <input type="number" min="0" step="5" value="${fmt(policy.maxGoldPerCycle)}" data-maintenance-policy="maxGoldPerCycle"><em>G</em></label>
            </section>
            <div class="workshop-maintenance-actions">
                <p><strong>${fmt(damaged.length)} peça(s) aguardando manutenção</strong><small>Reparos manuais restauram a peça por completo.</small></p>
                <button type="button" data-repair-all ${damaged.length > 0 ? "" : "disabled"}>Reparar elegíveis</button>
            </div>
            <div class="workshop-maintenance-list">${cards}</div>
        </section>`;
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
        if (ui.professionId === "alchemy") ui.techniqueId = "balanced";
        const hasMaintenance = ["blacksmithing", "leatherworking"].includes(ui.professionId);
        const hasSpecialization = Boolean(Aethra.ProfessionSystem?.getSpecializationTree?.(ui.professionId));
        if (!hasMaintenance && ui.tab === "maintenance") ui.tab = "known";
        element.style.setProperty("--workshop-accent", meta.color);
        const workshopGuidance = resolveWorkshopGuidance();
        ui.guidedRecipeId = resolveGuidedRecipeId(workshopGuidance);

        // Receitas conhecidas agrupadas por tier
        const known      = (cs?.getRecipes?.(ui.professionId) || [])
            .sort((a, b) => Number(isGuidedRecipe(b, workshopGuidance)) - Number(isGuidedRecipe(a, workshopGuidance)));
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

            ${hasSpecialization ? `<button type="button" class="profession-workshop__specialization" data-open-profession-specialization="${esc(ui.professionId)}">
                ✦ Ver especialização e maestria infinita
            </button>` : ""}

            <nav class="profession-workshop__tabs">
                ${Object.entries(professionMeta).map(([id, entry]) =>
                    `<button type="button" data-workshop-profession="${id}" class="${id === ui.professionId ? "is-active" : ""}">${entry.icon} ${entry.name}</button>`
                ).join("")}
            </nav>

            <nav class="profession-workshop__subtabs">
                <button type="button" data-workshop-tab="known"        class="${ui.tab === "known"        ? "is-active" : ""}">Conhecidas${badgeCount > 0 ? ` <span class="badge-new-pill">${badgeCount} novo${badgeCount > 1 ? "s" : ""}</span>` : ""}</button>
                <button type="button" data-workshop-tab="undiscovered" class="${ui.tab === "undiscovered" ? "is-active" : ""}">A Descobrir${undiscovered.length > 0 ? ` <span class="badge-count">${undiscovered.length}</span>` : ""}</button>
                ${hasMaintenance ? `<button type="button" data-workshop-tab="maintenance" class="${ui.tab === "maintenance" ? "is-active" : ""}">Manutenção${Aethra.EquipmentMaintenanceSystem?.getSnapshot?.(ui.professionId)?.critical > 0 ? ` <span class="badge-count is-alert">${Aethra.EquipmentMaintenanceSystem.getSnapshot(ui.professionId).critical}</span>` : ""}</button>` : ""}
            </nav>

            ${ui.tab !== "maintenance" ? workshopGuidanceHTML(workshopGuidance) : ""}

            ${ui.tab !== "maintenance" ? `<section class="profession-workshop__controls">
                ${ui.professionId !== "alchemy" ? `<label>Técnica
                    <select data-workshop-technique>
                        ${Object.values(cs?.techniques || {}).map((t) =>
                            `<option value="${t.id}" ${t.id === ui.techniqueId ? "selected" : ""}>${esc(t.name)} — ${esc(t.description)}</option>`
                        ).join("")}
                    </select>
                </label>` : ""}
                <label>Quantidade
                    <input type="number" min="1" max="20" value="${ui.quantity}" data-workshop-quantity>
                </label>
            </section>` : ""}

            ${ui.notice ? `<div class="profession-workshop__notice is-${esc(ui.notice.tone)}" role="status">${esc(ui.notice.message)}</div>` : ""}

            <div class="profession-workshop__recipes">
                ${ui.tab === "maintenance" ? maintenancePanel() : ui.tab === "known" ? knownHTML : undiscoveredHTML}
            </div>
        </div>`;

        return element;
    }

    // ─── Abrir oficina ────────────────────────────────────────────────────────
    function open(professionId = "blacksmithing", stationId = null, options = {}) {
        if (professionMeta[professionId]) ui.professionId = professionId;
        const inCity = Aethra.GameState.ui?.primaryView === "city" && !Aethra.GameState.hunt?.isActive;
        ui.stationId  = stationId || (inCity ? professionMeta[ui.professionId].stationId : null);
        ui.notice     = null;
        ui.guidedRecipeId = options.recipeId || resolveGuidedRecipeId();
        ui.tab        = options.tab === "maintenance" && ["blacksmithing", "leatherworking"].includes(ui.professionId) ? "maintenance" : "known";

        // Seeding: se não há receitas descobertas, descobre os starters agora
        const cs = Aethra.CraftingSystem;
        if (cs && typeof cs.discoverStarters === "function") {
            const discovered = Aethra.GameState.crafting?.discovered || [];
            if (discovered.length === 0) {
                ["blacksmithing", "leatherworking", "alchemy"].forEach((id) => cs.discoverStarters(id));
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

    function repair(instanceId) {
        const result = Aethra.EquipmentMaintenanceSystem?.repairItem?.(instanceId, {
            stationId: ui.stationId,
            commandId: window.crypto?.randomUUID?.() || `repair_${Date.now()}_${Math.random()}`,
            source: "profession-workshop"
        });
        ui.notice = result?.accepted
            ? { tone: "success", message: `${result.item.name}: +${fmt(result.restored)} de durabilidade por ${fmt(result.gold)} G.` }
            : { tone: "error", message: maintenanceReasonText(result || {}) };
        render();
        return result;
    }

    function repairAll() {
        const result = Aethra.EquipmentMaintenanceSystem?.repairEligible?.({
            professionId: ui.professionId,
            stationId: ui.stationId,
            commandId: window.crypto?.randomUUID?.() || `repair_cycle_${Date.now()}_${Math.random()}`,
            source: "profession-workshop"
        });
        ui.notice = result?.repaired?.length
            ? { tone: "success", message: `${result.repaired.length} peça(s) reparada(s) · ${fmt(result.restored)} de durabilidade · ${fmt(result.goldSpent)} G.` }
            : { tone: "error", message: maintenanceReasonText(result?.skipped?.[0] || result || {}) };
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
        const repairButton = event.target.closest(`#${WINDOW_ID} [data-repair-item]`);
        if (repairButton) repair(repairButton.dataset.repairItem);
        const repairAllButton = event.target.closest(`#${WINDOW_ID} [data-repair-all]`);
        if (repairAllButton) repairAll();
    });

    document.addEventListener("change", (event) => {
        if (event.target.matches(`#${WINDOW_ID} [data-workshop-technique]`)) {
            ui.techniqueId = event.target.value;
            render();
        }
        if (event.target.matches(`#${WINDOW_ID} [data-maintenance-policy]`)) {
            const controls = document.querySelectorAll(`#${WINDOW_ID} [data-maintenance-policy]`);
            const patch = {};
            controls.forEach((control) => {
                patch[control.dataset.maintenancePolicy] = control.type === "checkbox"
                    ? control.checked
                    : Number(control.value);
            });
            Aethra.EquipmentMaintenanceSystem?.setPolicy?.(patch, "profession-workshop");
            ui.notice = { tone: "success", message: "Política de manutenção atualizada." };
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
    Aethra.EventBus.on("quest:objective-updated", () => {
        if (Aethra.WindowManager?.isWindowOpen?.(WINDOW_ID)) render();
    });
    Aethra.EventBus.on("quest:accepted", () => {
        if (Aethra.WindowManager?.isWindowOpen?.(WINDOW_ID)) render();
    });
    Aethra.EventBus.on("quest:finished", () => {
        ui.guidedRecipeId = resolveGuidedRecipeId();
        if (Aethra.WindowManager?.isWindowOpen?.(WINDOW_ID)) render();
    });
    Aethra.EventBus.on("inventory:changed", () => {
        if (Aethra.WindowManager?.isWindowOpen?.(WINDOW_ID)) render();
    });
    ["maintenance:repaired", "maintenance:policy-changed", "equipment:durability-changed"].forEach((eventName) => {
        Aethra.EventBus.on(eventName, () => {
            if (Aethra.WindowManager?.isWindowOpen?.(WINDOW_ID)) render();
        });
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
    Aethra.ProfessionWorkshopUI = { open, render, craft, repair, repairAll, getState: () => clone(ui) };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureWindow, { once: true });
    else ensureWindow();
})(window.Aethra);
