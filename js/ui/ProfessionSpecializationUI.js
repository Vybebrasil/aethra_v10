// ProfessionSpecializationUI.js — projeção e comandos da progressão de longo prazo.
(function initProfessionSpecializationUI(Aethra) {
    "use strict";

    const WINDOW_ID = "profession-specialization-view";
    const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[character]));
    const fmt = (value, decimals = 0) => Number(value || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
    const ui = { professionId: "mining", pendingBranchId: null, notice: null };

    const modifierLabels = {
        yieldPercent: "Rendimento",
        resourceQuality: "Qualidade do recurso",
        extraResourceChance: "Chance de recurso extra",
        craftQuality: "Qualidade de fabricação",
        craftXpPercent: "XP de fabricação"
    };

    function formatModifier(key, value) {
        const numeric = Number(value || 0);
        if (key === "extraResourceChance") return `+${fmt(numeric * 100, numeric * 100 % 1 ? 1 : 0)}%`;
        if (key.endsWith("Percent")) return `+${fmt(numeric, numeric % 1 ? 1 : 0)}%`;
        return `+${fmt(numeric, numeric % 1 ? 1 : 0)}`;
    }

    function ensureWindow() {
        let element = document.getElementById(WINDOW_ID);
        if (!element) {
            element = document.createElement("section");
            element.id = WINDOW_ID;
            element.className = "game-window profession-specialization hidden";
            element.dataset.aethraWindow = WINDOW_ID;
            element.setAttribute("aria-hidden", "true");
            (document.getElementById("modal-layer") || document.body).appendChild(element);
        }
        Aethra.WindowManager?.registerWindow?.(WINDOW_ID, element);
        return element;
    }

    function branchCard(branch, specialization) {
        const chosen = specialization.branchId === branch.id;
        const excluded = Boolean(specialization.branchId && !chosen);
        const canChoose = !specialization.branchId && specialization.level >= specialization.unlockLevel;
        const nodes = branch.nodes.map((node) => {
            const active = chosen && specialization.level >= node.level;
            const levelReady = specialization.level >= node.level;
            return `<li class="${active ? "is-active" : levelReady ? "is-ready" : "is-locked"}">
                <span>${active ? "✓" : levelReady ? "◆" : "◇"}</span>
                <div><small>NÍVEL ${fmt(node.level)}</small><strong>${esc(node.name)}</strong><p>${esc(node.description)}</p></div>
            </li>`;
        }).join("");
        const buttonText = chosen
            ? "Caminho escolhido"
            : excluded
                ? "Caminho encerrado"
                : canChoose
                    ? "Escolher permanentemente"
                    : `Disponível no nível ${specialization.unlockLevel}`;

        return `<article class="profession-specialization__branch ${chosen ? "is-chosen" : ""} ${excluded ? "is-excluded" : ""}">
            <header><span>${esc(branch.icon)}</span><div><small>CAMINHO DE OFÍCIO</small><h3>${esc(branch.name)}</h3><p>${esc(branch.description)}</p></div></header>
            <ol>${nodes}</ol>
            <button type="button" data-specialization-branch="${esc(branch.id)}" ${chosen || excluded || !canChoose ? "disabled" : ""}>${buttonText}</button>
        </article>`;
    }

    function masteryText(state) {
        if (!state.branch) return `Escolha um caminho no nível ${state.unlockLevel} para iniciar a maestria.`;
        if (state.level < Aethra.ProfessionSystem.specializationMasteryStart) {
            return `O caminho amadurece no nível ${Aethra.ProfessionSystem.specializationMasteryStart}. Depois disso, novos pulsos chegam a cada ${Aethra.ProfessionSystem.specializationMasteryInterval} níveis.`;
        }
        const label = modifierLabels[state.masteryModifier] || state.masteryModifier;
        return `${state.pulses} pulso(s) de maestria · ${label} ${formatModifier(state.masteryModifier, state.masteryBonus)} · próximo no nível ${state.nextMasteryLevel}.`;
    }

    function render() {
        const system = Aethra.ProfessionSystem;
        const element = ensureWindow();
        const tree = system?.getSpecializationTree?.(ui.professionId);
        if (!tree) return element;
        const profession = system.professions[ui.professionId] || { name: ui.professionId, icon: "✦" };
        const specialization = system.getSpecializationState(ui.professionId);
        const modifiers = system.getProfessionModifiers(ui.professionId);
        const tabs = Object.keys(system.specializationTrees || {}).map((professionId) => {
            const meta = system.professions[professionId] || { name: professionId, icon: "✦" };
            return `<button type="button" data-specialization-profession="${esc(professionId)}" class="${professionId === ui.professionId ? "is-active" : ""}">${esc(meta.icon)} ${esc(meta.name)}</button>`;
        }).join("");
        const effects = Object.entries(modifiers).filter(([, value]) => Number(value) !== 0).map(([key, value]) => `
            <span><small>${esc(modifierLabels[key] || key)}</small><strong>${formatModifier(key, value)}</strong></span>
        `).join("") || `<p>Nenhum bônus ativo. O primeiro caminho pode ser escolhido no nível ${tree.unlockLevel}.</p>`;
        const pending = tree.branches.find((branch) => branch.id === ui.pendingBranchId) || null;

        element.innerHTML = `<div class="profession-specialization__shell">
            <header class="profession-specialization__header">
                <span>${esc(profession.icon)}</span>
                <div><small>PROGRESSÃO SEM TETO</small><h2>${esc(profession.name)}</h2><p>Escolha uma identidade no nível ${tree.unlockLevel}; a skill continua evoluindo para sempre.</p></div>
                <button type="button" data-close-window="${WINDOW_ID}" aria-label="Fechar">×</button>
            </header>

            <nav class="profession-specialization__tabs">${tabs}</nav>

            <section class="profession-specialization__summary">
                <span><small>NÍVEL ATUAL</small><strong>${fmt(specialization.level)}</strong></span>
                <span><small>CAMINHO</small><strong>${esc(specialization.branch?.name || "Não escolhido")}</strong></span>
                <span><small>PRÓXIMO MARCO</small><strong>Nível ${fmt(specialization.nextMasteryLevel)}</strong></span>
            </section>

            <section class="profession-specialization__effects"><small>EFEITOS ATIVOS</small><div>${effects}</div></section>

            ${ui.notice ? `<div class="profession-specialization__notice is-${esc(ui.notice.tone)}" role="status">${esc(ui.notice.message)}</div>` : ""}

            ${pending ? `<section class="profession-specialization__confirm" role="alert">
                <div><small>DECISÃO PERMANENTE</small><strong>Seguir o caminho ${esc(pending.name)}?</strong><p>O outro caminho ficará indisponível para este personagem.</p></div>
                <button type="button" data-specialization-cancel>Voltar</button>
                <button type="button" data-specialization-confirm="${esc(pending.id)}">Confirmar caminho</button>
            </section>` : ""}

            <div class="profession-specialization__branches">${tree.branches.map((branch) => branchCard(branch, specialization)).join("")}</div>

            <footer class="profession-specialization__mastery">
                <span>∞</span><div><small>MAESTRIA INFINITA</small><strong>Sem nível máximo e sem “cheguei a tudo”.</strong><p>${esc(masteryText(specialization))}</p></div>
            </footer>
        </div>`;
        return element;
    }

    function open(professionId = null) {
        const fallback = Aethra.GameState.hero?.introProfessionId;
        const target = professionId || fallback || ui.professionId;
        if (Aethra.ProfessionSystem?.getSpecializationTree?.(target)) ui.professionId = target;
        ui.pendingBranchId = null;
        ui.notice = null;
        render();
        return Aethra.WindowManager?.openWindow?.(WINDOW_ID, { source: "profession-specialization", exclusive: true });
    }

    document.addEventListener("click", (event) => {
        const openButton = event.target.closest("[data-open-profession-specialization]");
        if (openButton && !openButton.closest(`#${WINDOW_ID}`)) {
            open(openButton.dataset.openProfessionSpecialization);
            return;
        }
        const professionButton = event.target.closest(`#${WINDOW_ID} [data-specialization-profession]`);
        if (professionButton) {
            ui.professionId = professionButton.dataset.specializationProfession;
            ui.pendingBranchId = null;
            ui.notice = null;
            render();
            return;
        }
        const branchButton = event.target.closest(`#${WINDOW_ID} [data-specialization-branch]`);
        if (branchButton && !branchButton.disabled) {
            ui.pendingBranchId = branchButton.dataset.specializationBranch;
            ui.notice = null;
            render();
            return;
        }
        if (event.target.closest(`#${WINDOW_ID} [data-specialization-cancel]`)) {
            ui.pendingBranchId = null;
            render();
            return;
        }
        const confirmButton = event.target.closest(`#${WINDOW_ID} [data-specialization-confirm]`);
        if (confirmButton) {
            const result = Aethra.ProfessionSystem?.chooseSpecialization?.(
                ui.professionId,
                confirmButton.dataset.specializationConfirm,
                { source: "profession-specialization-ui" }
            );
            ui.pendingBranchId = null;
            ui.notice = result?.accepted
                ? { tone: "success", message: `${result.branch.name} agora define sua progressão de longo prazo.` }
                : { tone: "error", message: result?.reason === "insufficient-level" ? `Requer nível ${result.requiredLevel}.` : "Este caminho não pode mais ser escolhido." };
            render();
        }
    });

    ["profession:specialization-chosen", "profession:perk-unlocked", "profession:rankUp", "skill:training-mode-changed"].forEach((eventName) => {
        Aethra.EventBus.on(eventName, () => {
            if (Aethra.WindowManager?.isWindowOpen?.(WINDOW_ID)) render();
        });
    });

    Aethra.ProfessionSpecializationUI = { open, render, getState: () => ({ ...ui }) };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureWindow, { once: true });
    else ensureWindow();
})(window.Aethra);
