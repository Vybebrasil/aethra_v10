/*
 * Ui3WorkshopWindow.js — Oficinas (Forjaria, Couraria, Alquimia) na UI 3.0
 * (fase 5.2).
 *
 * Assume "profession-workshop-view" pelo Ui3Window/WindowManager. O pedido
 * (ofício, estação, aba) chega nas opções de openWindow, normalmente por
 * Ui3Navigation.openWorkshop.
 *   leitura   CraftingSystem (receitas, requisitos, validação, estimativa
 *             de qualidade), CraftingGuidance (ofícios, estações, receita
 *             pedida pelo contrato), EquipmentMaintenanceSystem
 *             (manutenção), ProfessionSystem (nível do ofício)
 *   comandos  CraftingSystem.craft, EquipmentMaintenanceSystem.repairItem /
 *             repairEligible / setPolicy
 */
(function initUi3WorkshopWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "profession-workshop-view";
    const NOTICE_MS = 4500;
    const MAX_QUANTITY = 20;
    const TIER_LABELS = Object.freeze({ 1: "Iniciante", 2: "Oficial", 3: "Mestre" });
    const MAINTAINED = Object.freeze(["blacksmithing", "leatherworking"]);
    const CRAFT_REASONS = Object.freeze({
        "wrong-station": "Produza na estação da Cidade.",
        "hunt-active": "Encerre a expedição antes de produzir.",
        "missing-materials": "Materiais insuficientes.",
        "profession-locked": "Este ofício ainda está bloqueado.",
        "recipe-not-discovered": "Receita ainda não descoberta."
    });
    const REPAIR_REASONS = Object.freeze({
        "not-damaged": "A peça já está em condição máxima.",
        "not-in-city": "Visite a oficina na Cidade.",
        "wrong-station": "Use a oficina correta.",
        "missing-materials": "Falta material de reparo.",
        "insufficient-gold": "A reserva de ouro impede este reparo.",
        "cycle-budget": "O limite de gasto deste ciclo foi atingido.",
        "item-not-maintainable": "Esta peça não exige manutenção."
    });
    const STATUS_LABELS = Object.freeze({ good: "Estável", worn: "Desgastado", critical: "Crítico", broken: "Quebrado" });

    const state = {
        professionId: "blacksmithing",
        stationId: null,
        tab: "known",
        techniqueId: "balanced",
        quantity: 1,
        notice: null
    };
    const rendered = new WeakMap();
    let parts = {};
    let noticeTimer = null;

    function kit() {
        return Aethra.Ui3Kit;
    }

    function crafting() {
        return Aethra.CraftingSystem;
    }

    function maintenance() {
        return Aethra.EquipmentMaintenanceSystem;
    }

    function craftingGuidance() {
        return Aethra.CraftingGuidance;
    }

    function patch(element, html) {
        if (!element || rendered.get(element) === html) return false;
        element.innerHTML = html;
        rendered.set(element, html);
        return true;
    }

    function number(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function professions() {
        return craftingGuidance().professions;
    }

    function meta(id = state.professionId) {
        return professions()[id] || professions().blacksmithing;
    }

    function inCity() {
        const view = Aethra.UIManager?.primaryView || Aethra.GameState?.ui?.primaryView;
        return view === "city" && !Aethra.GameState?.hunt?.isActive;
    }

    function itemTemplate(itemId) {
        return Aethra.GameData?.items?.[itemId] || Aethra.ItemSystem?.templates?.[itemId] || { templateId: itemId, name: itemId };
    }

    function itemName(itemId) {
        return itemTemplate(itemId).name || itemId;
    }

    function notify(text, tone = "ok") {
        state.notice = { text, tone };
        if (noticeTimer) window.clearTimeout(noticeTimer);
        noticeTimer = window.setTimeout(() => {
            state.notice = null;
            noticeTimer = null;
            render();
        }, NOTICE_MS);
    }

    function noticeHTML() {
        const K = kit();
        return state.notice
            ? `<p class="ui3-notice ui3-notice--${K.esc(state.notice.tone)}" role="status">${K.esc(state.notice.text)}</p>`
            : "";
    }

    function craftReason(validation = {}) {
        if (validation.reason === "insufficient-level") return `Requer nível ${validation.requiredLevel}; você está no ${validation.level}.`;
        if (validation.reason === "wrong-station") return `Produza em ${meta().station}.`;
        return CRAFT_REASONS[validation.reason] || "Esta receita ainda não pode ser criada.";
    }

    function repairReason(validation = {}) {
        if (validation.reason === "missing-materials" && validation.materialName) return `Falta ${validation.materialName}.`;
        return REPAIR_REASONS[validation.reason] || "Este reparo não pode ser feito agora.";
    }

    /* ---------------------------------------------------------------
       Renderização
       --------------------------------------------------------------- */

    function sidebarHTML() {
        const K = kit();
        const buttons = Object.entries(professions()).map(([id, entry]) => {
            const skill = Aethra.ProfessionSystem?.getState?.(id) || { level: 1, xpCurrent: 0, xpNext: 1 };
            const percent = Math.max(0, Math.min(100, (number(skill.xpCurrent) / Math.max(1, number(skill.xpNext, 1))) * 100));
            return `<button type="button" class="ui3-list-row" data-ui3-workshop-profession="${K.esc(id)}" aria-pressed="${id === state.professionId ? "true" : "false"}">
                    <span class="ui3-glyph-box" aria-hidden="true">${K.esc(entry.icon)}</span>
                    <span class="ui3-list-row__text">
                        <strong>${K.esc(entry.name)} <span class="ui3-tag">Nv ${K.formatNumber(skill.level)}</span></strong>
                        <small>${K.formatNumber(skill.xpCurrent)} / ${K.formatNumber(skill.xpNext)} XP${skill.trainingMode === "locked" ? " · XP pausado" : ""}</small>
                        <span class="ui3-progress" aria-hidden="true"><span style="display:block;height:100%;width:${percent.toFixed(1)}%;background:var(--ui3-xp)"></span></span>
                    </span>
                </button>`;
        }).join("");
        const hasSpecialization = Boolean(Aethra.ProfessionSystem?.getSpecializationTree?.(state.professionId));
        return `<span class="ui3-eyebrow">Ofícios</span>
            <div class="ui3-stack">${buttons}</div>
            <div class="ui3-note"><span>${state.stationId ? "Estação" : "Catálogo"}</span><strong>${K.esc(state.stationId ? meta().station : "Produza na estação da Cidade")}</strong></div>
            ${hasSpecialization ? K.button({ label: "Especialização e maestria", variant: "ghost", attributes: { "data-ui3-workshop-specialization": state.professionId } }) : ""}`;
    }

    function tabsHTML() {
        const K = kit();
        const known = crafting()?.getRecipes?.(state.professionId) || [];
        const undiscovered = crafting()?.getUndiscovered?.(state.professionId) || [];
        const items = [
            { id: "known", label: `Conhecidas ${known.length}` },
            { id: "undiscovered", label: `A descobrir ${undiscovered.length}` }
        ];
        if (MAINTAINED.includes(state.professionId)) {
            const critical = number(maintenance()?.getSnapshot?.(state.professionId)?.critical);
            items.push({ id: "maintenance", label: critical > 0 ? `Manutenção · ${critical} crítica(s)` : "Manutenção" });
        }
        return K.tabs({ label: "Seções da oficina", items, selected: state.tab });
    }

    function guidanceHTML(guidance) {
        const K = kit();
        if (!guidance) return "";
        const type = guidance.objective?.type;
        const recipe = type === "CraftRecipe" ? crafting()?.getRecipe?.(guidance.target) : null;
        const title = type === "CraftEquipment" ? "Escolha seu primeiro equipamento"
            : type === "CraftSupply" ? "Escolha seu primeiro suprimento"
                : recipe ? `Produza ${recipe.name}` : guidance.objective?.label || "Passo da missão";
        return `<div class="ui3-note ui3-workshop__guidance" role="status"><span>Passo da missão</span><strong>${K.esc(title)}</strong></div>`;
    }

    function controlsHTML() {
        const K = kit();
        const techniques = Object.values(crafting()?.techniques || {});
        const alchemy = state.professionId === "alchemy";
        return `<div class="ui3-workshop__controls">
                ${alchemy ? "" : `<label class="ui3-select"><span>Técnica</span><select data-ui3-workshop-technique>${techniques.map((technique) => `<option value="${K.esc(technique.id)}"${technique.id === state.techniqueId ? " selected" : ""}>${K.esc(technique.name)} · ${K.esc(technique.description)}</option>`).join("")}</select></label>`}
                <span class="ui3-select"><span>Quantidade</span>
                    <span class="ui3-stepper">
                        <button type="button" class="ui3-btn ui3-btn--icon" data-ui3-workshop-quantity="-1" aria-label="Diminuir quantidade" ${state.quantity <= 1 ? "disabled" : ""}>−</button>
                        <strong aria-live="polite">${state.quantity}</strong>
                        <button type="button" class="ui3-btn ui3-btn--icon" data-ui3-workshop-quantity="1" aria-label="Aumentar quantidade" ${state.quantity >= MAX_QUANTITY ? "disabled" : ""}>+</button>
                    </span>
                </span>
            </div>`;
    }

    function recipeCardHTML(recipe, guidance) {
        const K = kit();
        const I = Aethra.Ui3Items;
        const system = crafting();
        const requirements = system.resolveRequirements(recipe, state.techniqueId, state.quantity);
        const validation = system.validateCraft(recipe.id, { stationId: state.stationId, techniqueId: state.techniqueId, quantity: state.quantity });
        const guided = Boolean(guidance && Aethra.CraftingGuidance.isGuidedRecipe(recipe, guidance));
        const xpBonus = number(Aethra.ProfessionSystem?.getProfessionModifiers?.(recipe.professionId)?.craftXpPercent);
        const xp = Math.max(1, Math.round(number(recipe.xp) * state.quantity * (1 + xpBonus / 100)));
        const quality = recipe.professionId === "alchemy" ? null : system.estimateQuality?.(recipe, state.techniqueId);
        const materials = requirements.inputs.map((input) => {
            const owned = number(Aethra.BagSystem?.countItem?.(input.itemId));
            const enough = owned >= input.quantity;
            return `<div class="ui3-loot-row">${I.thumbHTML(itemTemplate(input.itemId))}<span class="ui3-loot-row__name">${K.esc(itemName(input.itemId))}</span><span class="ui3-loot-row__value ${enough ? "ui3-text-ok" : "ui3-text-bad"}">${K.formatNumber(owned)}/${K.formatNumber(input.quantity)}</span></div>`;
        }).join("");
        const outputs = (recipe.outputs || []).map((output) => `<div class="ui3-loot-row">${I.thumbHTML(itemTemplate(output.itemId))}<span class="ui3-loot-row__name">${K.formatNumber(output.quantity * state.quantity)}× ${K.esc(itemName(output.itemId))}</span></div>`).join("");
        return `<article class="ui3-recipe${validation.allowed ? " is-ready" : ""}${guided ? " is-guided" : ""}">
                <header class="ui3-recipe__head">
                    <span class="ui3-glyph-box" aria-hidden="true">${K.esc(recipe.icon || "◆")}</span>
                    <span class="ui3-list-row__text">
                        <strong>${K.esc(recipe.name)}${guided ? ` <span class="ui3-tag ui3-tag--gold">Missão</span>` : ""}</strong>
                        <small>${K.esc(String(recipe.action || "").toLowerCase())} · Nv ${K.formatNumber(recipe.requiredLevel)} · +${K.formatNumber(xp)} XP</small>
                    </span>
                </header>
                ${recipe.description ? `<p class="ui3-item-description">${K.esc(recipe.description)}</p>` : ""}
                <div class="ui3-recipe__flow">
                    <section class="ui3-stack"><span class="ui3-eyebrow">Materiais</span>${materials}</section>
                    <section class="ui3-stack"><span class="ui3-eyebrow">Resultado</span>${outputs}<span class="ui3-caption">${quality ? `Qualidade ${quality.min}–${quality.max}` : "Rendimento fixo por lote"}</span></section>
                </div>
                ${recipe.sourceHint ? `<p class="ui3-caption">Onde conseguir: ${K.esc(recipe.sourceHint)}</p>` : ""}
                <footer class="ui3-row-between">
                    <span class="ui3-caption">${K.esc(validation.allowed ? `Pronto em ${meta(recipe.professionId).station}` : craftReason(validation))}</span>
                    ${K.button({ label: `Criar ${state.quantity}`, variant: validation.allowed ? "primary" : "secondary", disabled: !validation.allowed, attributes: { "data-ui3-craft": recipe.id } })}
                </footer>
            </article>`;
    }

    function lockedCardHTML(recipe) {
        const K = kit();
        const level = number(Aethra.ProfessionSystem?.getState?.(recipe.professionId)?.level, 1);
        const missing = Math.max(0, number(recipe.unlockLevel) - level);
        return `<article class="ui3-recipe is-locked">
                <header class="ui3-recipe__head">
                    <span class="ui3-glyph-box" aria-hidden="true">${K.icon("skull", 16)}</span>
                    <span class="ui3-list-row__text"><strong>${K.esc(recipe.name)}</strong><small>${K.esc(TIER_LABELS[recipe.tier] || `Tier ${recipe.tier}`)} · Nv ${K.formatNumber(recipe.requiredLevel)}</small></span>
                </header>
                ${recipe.description ? `<p class="ui3-item-description">${K.esc(recipe.description)}</p>` : ""}
                <span class="ui3-caption">${missing > 0 ? `Descobre no nível ${K.formatNumber(recipe.unlockLevel)} de ${K.esc(meta(recipe.professionId).name)} (faltam ${missing}).` : "Descoberta por outra fonte."}${recipe.sourceHint ? ` ${K.esc(recipe.sourceHint)}` : ""}</span>
            </article>`;
    }

    function byTier(recipes, renderCard) {
        const groups = {};
        recipes.forEach((recipe) => {
            (groups[recipe.tier || 1] = groups[recipe.tier || 1] || []).push(recipe);
        });
        return Object.keys(groups).sort().map((tier) => `<section class="ui3-stack">
                <span class="ui3-eyebrow">${kit().esc(TIER_LABELS[tier] || `Tier ${tier}`)}</span>
                <div class="ui3-recipe-grid">${groups[tier].map(renderCard).join("")}</div>
            </section>`).join("");
    }

    function maintenanceHTML() {
        const K = kit();
        const I = Aethra.Ui3Items;
        const snapshot = maintenance()?.getSnapshot?.(state.professionId) || { policy: {}, items: [], damaged: 0, critical: 0, broken: 0, estimatedGold: 0 };
        const policy = snapshot.policy || {};
        const items = [...(snapshot.items || [])].sort((a, b) => number(a.percent) - number(b.percent));
        const damaged = items.filter((entry) => number(entry.percent) < 100).length;
        const rows = items.map((entry) => {
            const item = entry.item || {};
            const percent = Math.max(0, Math.min(100, number(entry.percent)));
            const validation = maintenance()?.validateRepair?.(item.instanceId, { stationId: state.stationId }) || { allowed: false };
            return `<article class="ui3-recipe">
                    <header class="ui3-recipe__head">
                        ${I.thumbHTML(item)}
                        <span class="ui3-list-row__text"><strong>${K.esc(I.nameOf(item))}</strong><small>${entry.equipped ? `Equipado · ${K.esc(I.SLOT_LABELS[entry.slot] || entry.slot || "")}` : "Na mochila"} · ${K.esc(STATUS_LABELS[entry.status] || "Estável")}${number(entry.effectiveness, 1) < 1 ? ` · ${Math.round(number(entry.effectiveness) * 100)}% dos atributos` : ""}</small></span>
                        <strong>${percent.toFixed(0)}%</strong>
                    </header>
                    ${I.durabilityHTML({ durability: { current: entry.before ?? percent, max: entry.after ?? 100 } })}
                    ${percent < 100 ? `<div class="ui3-note"><span>${K.formatNumber(entry.gold)} o · ${K.formatNumber(entry.ownedMaterial)}/${K.formatNumber(entry.materialQuantity)} ${K.esc(entry.materialName || "material")}</span><strong>+${K.formatNumber(entry.xp)} XP</strong></div>` : ""}
                    <footer class="ui3-row-between">
                        <span class="ui3-caption">${K.esc(validation.allowed ? "Pronto para reparar" : repairReason(validation))}</span>
                        ${K.button({ label: "Reparar", disabled: !validation.allowed, attributes: { "data-ui3-repair": item.instanceId || "" } })}
                    </footer>
                </article>`;
        }).join("");
        return `<div class="ui3-kpi-grid ui3-kpi-grid--4">
                ${K.kpi({ label: "Danificados", value: K.formatNumber(snapshot.damaged) })}
                ${K.kpi({ label: "Críticos", value: K.formatNumber(snapshot.critical), tone: number(snapshot.critical) > 0 ? "negative" : "" })}
                ${K.kpi({ label: "Quebrados", value: K.formatNumber(snapshot.broken), tone: number(snapshot.broken) > 0 ? "negative" : "" })}
                ${K.kpi({ label: "Estimativa", value: `${K.formatNumber(snapshot.estimatedGold)} o` })}
            </div>
            <section class="ui3-workshop__policy">
                <div class="ui3-row-between">
                    <span class="ui3-stack"><strong>Reparar antes de cada expedição</strong><span class="ui3-caption">Prioriza as peças mais gastas e respeita a reserva e o teto por ciclo.</span></span>
                    ${K.toggle({ checked: policy.enabled === true, label: "Reparo automático", onText: "Ativo", offText: "Desligado", attributes: { "data-ui3-policy-toggle": "" } })}
                </div>
                <div class="ui3-workshop__policy-fields">
                    <label class="ui3-field"><span class="ui3-eyebrow">Reparar abaixo de (%)</span><input type="number" min="5" max="90" step="5" value="${K.esc(number(policy.thresholdPercent, 35))}" data-ui3-policy="thresholdPercent"></label>
                    <label class="ui3-field"><span class="ui3-eyebrow">Reserva de ouro</span><input type="number" min="0" step="5" value="${K.esc(number(policy.reserveGold, 25))}" data-ui3-policy="reserveGold"></label>
                    <label class="ui3-field"><span class="ui3-eyebrow">Limite por ciclo</span><input type="number" min="0" step="5" value="${K.esc(number(policy.maxGoldPerCycle, 100))}" data-ui3-policy="maxGoldPerCycle"></label>
                </div>
            </section>
            <div class="ui3-row-between"><span class="ui3-caption">${K.formatNumber(damaged)} peça(s) aguardando manutenção</span>${K.button({ label: "Reparar elegíveis", disabled: damaged === 0, attributes: { "data-ui3-repair-all": "" } })}</div>
            <div class="ui3-recipe-grid">${rows || `<p class="ui3-empty">Nenhum equipamento atendido por esta oficina.</p>`}</div>`;
    }

    function contentHTML() {
        if (state.tab === "maintenance") return maintenanceHTML();
        if (state.tab === "undiscovered") {
            const locked = crafting()?.getUndiscovered?.(state.professionId) || [];
            return locked.length ? byTier(locked, lockedCardHTML) : `<p class="ui3-empty">Você conhece todas as receitas deste ofício.</p>`;
        }
        const guidance = Aethra.CraftingGuidance.getGuidance(state.professionId);
        const known = [...(crafting()?.getRecipes?.(state.professionId) || [])]
            .sort((a, b) => Number(Boolean(guidance && Aethra.CraftingGuidance.isGuidedRecipe(b, guidance))) - Number(Boolean(guidance && Aethra.CraftingGuidance.isGuidedRecipe(a, guidance))));
        return `${guidanceHTML(guidance)}${controlsHTML()}${known.length ? byTier(known, (recipe) => recipeCardHTML(recipe, guidance)) : `<p class="ui3-empty">Nenhuma receita descoberta ainda.</p>`}`;
    }

    function render() {
        if (!crafting()) return;
        if (state.professionId === "alchemy") state.techniqueId = "balanced";
        if (!MAINTAINED.includes(state.professionId) && state.tab === "maintenance") state.tab = "known";
        patch(parts.sidebar, sidebarHTML());
        patch(parts.tabs, tabsHTML());
        patch(parts.notice, noticeHTML());
        patch(parts.content, contentHTML());
    }

    /* ---------------------------------------------------------------
       Comandos
       --------------------------------------------------------------- */

    function commandId(prefix) {
        return window.crypto?.randomUUID?.() || `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }

    function craft(recipeId) {
        const result = crafting()?.craft?.(recipeId, {
            stationId: state.stationId,
            techniqueId: state.techniqueId,
            quantity: state.quantity,
            commandId: commandId("craft")
        });
        notify(result?.accepted
            ? `${result.recipe.name}: ${result.outputs.length} resultado(s) na mochila.`
            : craftReason(result || {}), result?.accepted ? "ok" : "error");
        render();
        return result;
    }

    function repair(instanceId) {
        const result = maintenance()?.repairItem?.(instanceId, { stationId: state.stationId, commandId: commandId("repair"), source: "ui3-workshop" });
        notify(result?.accepted
            ? `${result.item.name}: +${kit().formatNumber(result.restored)} de durabilidade por ${kit().formatNumber(result.gold)} o.`
            : repairReason(result || {}), result?.accepted ? "ok" : "error");
        render();
        return result;
    }

    function repairAll() {
        const result = maintenance()?.repairEligible?.({ professionId: state.professionId, stationId: state.stationId, commandId: commandId("repair_cycle"), source: "ui3-workshop" });
        notify(result?.repaired?.length
            ? `${result.repaired.length} peça(s) reparada(s) por ${kit().formatNumber(result.goldSpent)} o.`
            : repairReason(result?.skipped?.[0] || result || {}), result?.repaired?.length ? "ok" : "error");
        render();
        return result;
    }

    function savePolicy(patchValues) {
        maintenance()?.setPolicy?.(patchValues, "ui3-workshop");
        notify("Reparo automático atualizado.");
        render();
    }

    function onClick(event) {
        const target = event.target;
        const profession = target.closest("[data-ui3-workshop-profession]");
        if (profession) {
            state.professionId = profession.dataset.ui3WorkshopProfession;
            state.stationId = craftingGuidance().stationFor(state.professionId, { inCity: inCity() });
            state.notice = null;
            return render();
        }
        const tab = target.closest("[data-ui3-tab]");
        if (tab) {
            state.tab = tab.dataset.ui3Tab;
            return render();
        }
        const quantity = target.closest("[data-ui3-workshop-quantity]");
        if (quantity) {
            state.quantity = Math.max(1, Math.min(MAX_QUANTITY, state.quantity + Number(quantity.dataset.ui3WorkshopQuantity)));
            return render();
        }
        const craftButton = target.closest("[data-ui3-craft]");
        if (craftButton) return craft(craftButton.dataset.ui3Craft);
        const repairButton = target.closest("[data-ui3-repair]");
        if (repairButton) return repair(repairButton.dataset.ui3Repair);
        if (target.closest("[data-ui3-repair-all]")) return repairAll();
        const toggle = target.closest("[data-ui3-policy-toggle]");
        if (toggle) return savePolicy({ enabled: toggle.getAttribute("aria-checked") !== "true" });
        const specialization = target.closest("[data-ui3-workshop-specialization]");
        if (specialization) return Aethra.Ui3Navigation?.openSpecialization?.(specialization.dataset.ui3WorkshopSpecialization, { source: "ui3-workshop" });
        return undefined;
    }

    function onChange(event) {
        if (event.target.matches("[data-ui3-workshop-technique]")) {
            state.techniqueId = event.target.value;
            return render();
        }
        const field = event.target.closest("[data-ui3-policy]");
        if (field) {
            return savePolicy({ [field.dataset.ui3Policy]: Number(field.value) });
        }
        return undefined;
    }

    function setup(body) {
        body.classList.add("ui3-workshop");
        body.innerHTML = `<aside class="ui3-workshop__sidebar" aria-label="Ofícios" data-ui3-part="sidebar"></aside>
            <section class="ui3-workshop__main" aria-label="Receitas">
                <div data-ui3-part="tabs"></div>
                <div data-ui3-part="notice" aria-live="polite"></div>
                <div class="ui3-workshop__content ui3-scroll" data-ui3-part="content"></div>
            </section>`;
        const part = (name) => body.querySelector(`[data-ui3-part="${name}"]`);
        parts = { sidebar: part("sidebar"), tabs: part("tabs"), notice: part("notice"), content: part("content") };
        body.addEventListener("click", onClick);
        body.addEventListener("change", onChange);
    }

    // Pedido de abertura: { professionId, stationId, tab }.
    function onOpen(options = {}) {
        if (professions()[options.professionId]) state.professionId = options.professionId;
        state.stationId = options.stationId || craftingGuidance().stationFor(state.professionId, { inCity: inCity() });
        state.tab = options.tab === "maintenance" ? "maintenance" : options.tab === "undiscovered" ? "undiscovered" : "known";
        state.notice = null;
        Aethra.CraftingSystem?.ensureStarterRecipes?.();
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3WorkshopWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Oficinas",
            className: "ui3-dialog--wide",
            setup,
            render,
            onOpen,
            getSubtitle: () => (state.stationId ? meta().station : "Catálogo · produza na estação da Cidade"),
            getHeaderExtra: () => `<span class="ui3-currency"><span class="ui3-currency__coin" aria-hidden="true"></span><strong>${kit().formatNumber(Aethra.GameState?.hero?.gold)}</strong><small>ouro</small></span>`,
            events: [
                "crafting:completed",
                "crafting:recipe-discovered",
                "inventory:changed",
                "quest:objective-updated",
                "quest:finished",
                "maintenance:repaired",
                "maintenance:policy-changed",
                "equipment:durability-changed",
                "profession:xpChanged",
                "goldChanged"
            ]
        });
    }
})(window.Aethra = window.Aethra || {});
