/*
 * Ui3SpecializationWindow.js — Especialização de ofício na UI 3.0
 * (fase 5.2).
 *
 * Assume "profession-specialization-view" pelo Ui3Window/WindowManager.
 * ProfessionSpecializationUI.open(ofício) continua a porta de entrada.
 *   leitura   ProfessionSystem (árvores, estado, modificadores)
 *   comando   ProfessionSystem.chooseSpecialization, só depois de uma
 *             confirmação (a escolha é permanente)
 */
(function initUi3SpecializationWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "profession-specialization-view";
    const MODIFIER_LABELS = Object.freeze({
        yieldPercent: "Rendimento",
        resourceQuality: "Qualidade do recurso",
        extraResourceChance: "Chance de recurso extra",
        craftQuality: "Qualidade de fabricação",
        craftXpPercent: "XP de fabricação"
    });

    const state = { professionId: "mining", pendingBranchId: null, notice: null };
    const rendered = new WeakMap();
    let parts = {};

    function kit() {
        return Aethra.Ui3Kit;
    }

    function system() {
        return Aethra.ProfessionSystem;
    }

    function patch(element, html) {
        if (!element || rendered.get(element) === html) return false;
        element.innerHTML = html;
        rendered.set(element, html);
        return true;
    }

    function decimal(value) {
        const numeric = Number(value || 0);
        return numeric.toLocaleString("pt-BR", { maximumFractionDigits: numeric % 1 ? 1 : 0 });
    }

    function formatModifier(key, value) {
        const numeric = Number(value || 0);
        if (key === "extraResourceChance") return `+${decimal(numeric * 100)}%`;
        if (key.endsWith("Percent")) return `+${decimal(numeric)}%`;
        return `+${decimal(numeric)}`;
    }

    function masteryText(specialization) {
        const start = system().specializationMasteryStart;
        const interval = system().specializationMasteryInterval;
        if (!specialization.branch) return `Escolha um caminho no nível ${specialization.unlockLevel} para iniciar a maestria.`;
        if (specialization.level < start) return `O caminho amadurece no nível ${start}; depois, um novo pulso a cada ${interval} níveis.`;
        const label = MODIFIER_LABELS[specialization.masteryModifier] || specialization.masteryModifier;
        return `${specialization.pulses} pulso(s) de maestria · ${label} ${formatModifier(specialization.masteryModifier, specialization.masteryBonus)} · próximo no nível ${specialization.nextMasteryLevel}.`;
    }

    function branchHTML(branch, specialization) {
        const K = kit();
        const chosen = specialization.branchId === branch.id;
        const excluded = Boolean(specialization.branchId && !chosen);
        const canChoose = !specialization.branchId && specialization.level >= specialization.unlockLevel;
        const nodes = (branch.nodes || []).map((node) => {
            const active = chosen && specialization.level >= node.level;
            const ready = specialization.level >= node.level;
            return `<li class="${active ? "is-done" : ""}"><span class="ui3-check" aria-hidden="true">${active ? "✓" : ready ? "◆" : ""}</span><span><strong>Nível ${K.formatNumber(node.level)} · ${K.esc(node.name)}</strong><br><span class="ui3-caption">${K.esc(node.description)}</span></span></li>`;
        }).join("");
        const label = chosen ? "Caminho escolhido" : excluded ? "Caminho encerrado" : canChoose ? "Escolher este caminho" : `Disponível no nível ${specialization.unlockLevel}`;
        return `<article class="ui3-recipe${chosen ? " is-guided" : ""}${excluded ? " is-locked" : ""}">
                <header class="ui3-recipe__head">
                    <span class="ui3-glyph-box" aria-hidden="true">${K.esc(branch.icon || "✦")}</span>
                    <span class="ui3-list-row__text"><strong>${K.esc(branch.name)}</strong><small>Caminho de ofício</small></span>
                </header>
                ${branch.description ? `<p class="ui3-item-description">${K.esc(branch.description)}</p>` : ""}
                <ol class="ui3-objectives ui3-specialization__nodes">${nodes}</ol>
                ${K.button({ label, variant: canChoose ? "primary" : "secondary", disabled: !canChoose, attributes: { "data-ui3-branch": branch.id } })}
            </article>`;
    }

    function render() {
        const K = kit();
        const tree = system()?.getSpecializationTree?.(state.professionId);
        if (!tree) {
            patch(parts.body, `<p class="ui3-empty">Este ofício não tem especialização.</p>`);
            return;
        }
        const specialization = system().getSpecializationState(state.professionId);
        const modifiers = system().getProfessionModifiers(state.professionId) || {};
        const tabs = K.tabs({
            label: "Ofícios com especialização",
            items: Object.keys(system().specializationTrees || {}).map((id) => {
                const meta = system().professions?.[id] || { name: id, icon: "✦" };
                return { id, label: `${meta.icon || ""} ${meta.name}`.trim() };
            }),
            selected: state.professionId
        });
        const effects = Object.entries(modifiers)
            .filter(([, value]) => Number(value) !== 0)
            .map(([key, value]) => K.kpi({ label: MODIFIER_LABELS[key] || key, value: formatModifier(key, value), tone: "positive" }))
            .join("");
        const pending = (tree.branches || []).find((branch) => branch.id === state.pendingBranchId) || null;
        const notice = state.notice
            ? `<p class="ui3-notice ui3-notice--${K.esc(state.notice.tone)}" role="status">${K.esc(state.notice.text)}</p>`
            : "";
        patch(parts.body, `${tabs}
            <div class="ui3-kpi-grid ui3-kpi-grid--3">
                ${K.kpi({ label: "Nível atual", value: K.formatNumber(specialization.level) })}
                ${K.kpi({ label: "Caminho", value: specialization.branch?.name || "Não escolhido" })}
                ${K.kpi({ label: "Próximo marco", value: `Nível ${K.formatNumber(specialization.nextMasteryLevel)}` })}
            </div>
            <section class="ui3-section"><span class="ui3-eyebrow">Efeitos ativos</span>${effects ? `<div class="ui3-kpi-grid">${effects}</div>` : `<p>Nenhum bônus ativo. O primeiro caminho pode ser escolhido no nível ${K.formatNumber(tree.unlockLevel)}.</p>`}</section>
            ${notice}
            ${pending ? `<div class="ui3-title-confirm" role="alertdialog" aria-labelledby="ui3-spec-confirm">
                <p id="ui3-spec-confirm"><strong>Seguir o caminho ${K.esc(pending.name)}?</strong> A escolha é permanente: o outro caminho fica indisponível para este herói.</p>
                <div class="ui3-expedition__row">
                    ${K.button({ label: "Voltar", attributes: { "data-ui3-branch-cancel": "" } })}
                    ${K.button({ label: "Confirmar caminho", variant: "primary", attributes: { "data-ui3-branch-confirm": pending.id } })}
                </div>
            </div>` : ""}
            <div class="ui3-recipe-grid ui3-specialization__paths">${(tree.branches || []).map((branch) => branchHTML(branch, specialization)).join("")}</div>
            <div class="ui3-note"><span>Maestria infinita · sem nível máximo</span><strong>${K.esc(masteryText(specialization))}</strong></div>`);
    }

    function onClick(event) {
        const target = event.target;
        const tab = target.closest("[data-ui3-tab]");
        if (tab) {
            state.professionId = tab.dataset.ui3Tab;
            state.pendingBranchId = null;
            state.notice = null;
            return render();
        }
        const branch = target.closest("[data-ui3-branch]");
        if (branch && !branch.disabled) {
            state.pendingBranchId = branch.dataset.ui3Branch;
            render();
            return parts.body.querySelector("[data-ui3-branch-cancel]")?.focus();
        }
        if (target.closest("[data-ui3-branch-cancel]")) {
            state.pendingBranchId = null;
            return render();
        }
        const confirm = target.closest("[data-ui3-branch-confirm]");
        if (confirm) {
            const result = system()?.chooseSpecialization?.(state.professionId, confirm.dataset.ui3BranchConfirm, { source: "ui3-specialization" });
            state.pendingBranchId = null;
            state.notice = result?.accepted
                ? { tone: "ok", text: `${result.branch.name} agora define sua progressão de longo prazo.` }
                : { tone: "error", text: result?.reason === "insufficient-level" ? `Requer nível ${result.requiredLevel}.` : "Este caminho não pode mais ser escolhido." };
            return render();
        }
        return undefined;
    }

    function setup(body) {
        body.classList.add("ui3-options");
        body.innerHTML = `<div class="ui3-options__body ui3-scroll" data-ui3-part="body"></div>`;
        parts = { body: body.querySelector("[data-ui3-part='body']") };
        body.addEventListener("click", onClick);
    }

    // O ofício pedido vem de ProfessionSpecializationUI.open.
    function onOpen() {
        const requested = Aethra.ProfessionSpecializationUI?.getState?.()?.professionId;
        if (system()?.getSpecializationTree?.(requested)) state.professionId = requested;
        state.pendingBranchId = null;
        state.notice = null;
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3SpecializationWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Especialização",
            className: "ui3-dialog--medium",
            setup,
            render,
            onOpen,
            getSubtitle: () => "Progressão sem teto dos ofícios",
            events: ["profession:specialization-chosen", "profession:perk-unlocked", "profession:rankUp", "profession:xpChanged"]
        });
    }
})(window.Aethra = window.Aethra || {});
