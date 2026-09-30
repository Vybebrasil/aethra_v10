/*
 * Ui3SkillsWindow.js — Habilidades, progressão e automação na UI 3.0
 * (fase 3).
 *
 * Assume a janela "skills-view" pelo Ui3Window/WindowManager.
 * Aba Progressão
 *   leitura   ProgressionJournal.getViewModel (projeção pronta das
 *             maestrias; os filtros desta janela são próprios)
 *   comandos  DisciplineSystem.setFocus/setTrainingMode,
 *             ProfessionSystem.setCollectionPolicy
 * Aba Barra e automação
 *   leitura   SkillSystem (barras, requisitos, recarga), SkillController
 *             (ordem, automático, limite de cura), BattleSystem (ataques)
 *   comandos  SkillSystem.placeSkill/setActiveBar/addBar/setPrimaryAuto,
 *             SkillController.moveSkill/setAuto/setHpThreshold/requestManualSkill
 */
(function initUi3SkillsWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "skills-view";
    const MAX_BARS = 4;
    const NOTICE_MS = 3500;
    const TABS = Object.freeze([
        { id: "journal", label: "Progressão" },
        { id: "actionbar", label: "Barra e automação" }
    ]);
    const COST_LABELS = Object.freeze({ mana: "Mana", energy: "Vigor", hp: "Vida" });

    const state = {
        tab: "journal",
        category: "all",
        search: "",
        selectedSkill: null,
        slot: 0,
        notice: null
    };
    const rendered = new WeakMap();
    let parts = {};
    let noticeTimer = null;

    function kit() {
        return Aethra.Ui3Kit;
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

    function hotkeyLabel(index) {
        return index === 9 ? "0" : String(index + 1);
    }

    function noticeHTML() {
        const K = kit();
        return state.notice
            ? `<p class="ui3-notice ui3-notice--${K.esc(state.notice.tone)}" role="status">${K.esc(state.notice.text)}</p>`
            : "";
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

    /* ---------------------------------------------------------------
       Aba Progressão
       --------------------------------------------------------------- */

    function journal() {
        return Aethra.ProgressionJournal?.getViewModel?.() || { entries: [], categories: [], summary: {}, recent: [] };
    }

    function filteredEntries(model) {
        const query = state.search.trim().toLocaleLowerCase("pt-BR");
        return model.entries.filter((entry) => {
            const categoryMatches = state.category === "all" || entry.category === state.category;
            const text = `${entry.name} ${entry.role} ${entry.description || ""}`.toLocaleLowerCase("pt-BR");
            return categoryMatches && (!query || text.includes(query));
        });
    }

    function selectedEntry(model) {
        const ids = model.entries.map((entry) => entry.id);
        if (!ids.includes(state.selectedSkill)) {
            state.selectedSkill = model.focused?.id || model.entries.find((entry) => entry.discovered)?.id || ids[0] || null;
        }
        return model.entries.find((entry) => entry.id === state.selectedSkill) || null;
    }

    function progressHTML(entry) {
        const K = kit();
        const percent = Math.max(0, Math.min(100, number(entry.progressPercent)));
        return `<div class="ui3-progress" role="meter" aria-label="Experiência de ${K.esc(entry.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent.toFixed(0)}"><div style="width:${percent.toFixed(1)}%"></div></div>`;
    }

    function journalSummaryHTML(model) {
        const K = kit();
        const summary = model.summary || {};
        return `<div class="ui3-kpi-grid ui3-kpi-grid--4">
                ${K.kpi({ label: "Foco atual", value: model.focused ? `${model.focused.name} · Nv ${K.formatNumber(model.focused.level)}` : "Nenhum" })}
                ${K.kpi({ label: "Descobertas", value: `${K.formatNumber(summary.discovered)}/${K.formatNumber(summary.total)}` })}
                ${K.kpi({ label: "Treinando", value: K.formatNumber(summary.training) })}
                ${K.kpi({ label: "Pausadas", value: K.formatNumber(summary.paused), tone: number(summary.paused) > 0 ? "negative" : "" })}
            </div>`;
    }

    function journalChipsHTML(model) {
        const K = kit();
        return [{ id: "all", label: "Todas" }, ...model.categories.map((category) => ({ id: category, label: category }))]
            .map((category) => K.chip({ label: category.label, pressed: state.category === category.id, attributes: { "data-ui3-skill-category": category.id } }))
            .join("");
    }

    function journalListHTML(model, selected) {
        const K = kit();
        const entries = filteredEntries(model);
        if (!entries.length) return `<p class="ui3-empty">Nenhuma habilidade corresponde ao filtro.</p>`;
        return entries.map((entry) => {
            const status = entry.focused ? "★ Foco" : entry.training ? "" : "XP pausado";
            return `<button type="button" class="ui3-list-row ui3-skill-row${entry.discovered ? "" : " is-undiscovered"}" data-ui3-skill-entry="${K.esc(entry.id)}" aria-pressed="${selected?.id === entry.id ? "true" : "false"}">
                    <span class="ui3-glyph-box" aria-hidden="true">${K.esc(entry.icon || "•")}</span>
                    <span class="ui3-list-row__text">
                        <strong>${K.esc(entry.name)} <span class="ui3-tag">Nv ${K.formatNumber(entry.level)}</span></strong>
                        <small>${K.esc(entry.category)} · ${K.esc(entry.role)}</small>
                        ${progressHTML(entry)}
                    </span>
                    ${status ? `<span class="ui3-skill-row__status${entry.focused ? " is-focus" : " is-paused"}">${K.esc(status)}</span>` : ""}
                </button>`;
        }).join("");
    }

    function journalDetailHTML(model, entry) {
        const K = kit();
        if (!entry) return `<p class="ui3-empty">Nenhuma habilidade disponível.</p>`;
        const guide = entry.guide || {};
        const guidance = Aethra.DisciplineSystem?.getFocusedGuidance?.(entry.id) || null;
        const destination = guidance?.actionLabel || (guide.destination === "workshop" ? "Abrir oficina" : "Encontrar Hunt");
        const next = entry.nextUnlock;
        const contract = entry.contract?.quest ? entry.contract : null;
        const currentObjective = contract?.quest?.objectives?.find((objective) => !objective.completed) || null;
        const recent = (model.recent || []).filter((item) => item.skillId === entry.id).slice(0, 4);
        const specialization = entry.specialization;
        return `<div class="ui3-item-head">
                <div class="ui3-item-head__icon"><span aria-hidden="true">${K.esc(entry.icon || "•")}</span></div>
                <div class="ui3-item-head__text">
                    <strong class="ui3-item-head__name">${K.esc(entry.name)}</strong>
                    <span class="ui3-caption">${K.esc(entry.category)} · ${K.esc(entry.role)}</span>
                </div>
            </div>
            <div class="ui3-stack">
                <div class="ui3-row-between"><span>Nível ${K.formatNumber(entry.level)}</span><strong>${K.formatNumber(entry.xpCurrent)} / ${K.formatNumber(entry.xpNext)} XP</strong></div>
                ${progressHTML(entry)}
                <span class="ui3-caption">Bônus acumulado aproximado: +${K.esc(Number(entry.bonusPercent || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 }))}%</span>
            </div>
            <section class="ui3-section">
                <span class="ui3-eyebrow">O que você ganha</span>
                <strong>${K.esc(entry.benefit || "")}</strong>
                ${entry.description ? `<p>${K.esc(entry.description)}</p>` : ""}
            </section>
            <section class="ui3-section">
                <span class="ui3-eyebrow">Como evoluir</span>
                <strong>${K.esc(guide.where || "")}</strong>
                ${guide.action ? `<p>${K.esc(guide.action)}</p>` : ""}
                ${(guide.chain || []).length ? `<ol class="ui3-steps">${guide.chain.map((step) => `<li>${K.esc(step)}</li>`).join("")}</ol>` : ""}
            </section>
            ${contract ? `<section class="ui3-section">
                <span class="ui3-eyebrow">Contrato de foco · ${K.formatNumber(contract.progress?.percent || 0)}%</span>
                <strong>${K.esc(contract.title)}</strong>
                <p>${K.esc(currentObjective ? `Agora: ${currentObjective.label} (${K.formatNumber(currentObjective.progress)}/${K.formatNumber(currentObjective.required)})` : "Ciclo concluído.")}</p>
            </section>` : ""}
            ${next ? `<section class="ui3-section">
                <span class="ui3-eyebrow">Próximo marco · Nv ${K.formatNumber(next.level)}</span>
                <strong>${K.esc(next.title)}</strong>
                ${next.description ? `<p>${K.esc(next.description)}</p>` : ""}
            </section>` : ""}
            <section class="ui3-section">
                <span class="ui3-eyebrow">XP recente nesta sessão</span>
                ${recent.length
                    ? `<ul class="ui3-plain-list">${recent.map((item) => `<li><strong>+${K.formatNumber(item.amount)} XP</strong> <span>${K.esc(item.sourceLabel)} · ${K.esc(item.time)}</span></li>`).join("")}</ul>`
                    : `<p class="ui3-empty">A próxima ação que treinar esta habilidade aparece aqui.</p>`}
            </section>
            <div class="ui3-item-actions">
                ${noticeHTML()}
                ${K.button({ label: entry.focused ? "Habilidade em foco" : "Definir como foco", variant: "primary", disabled: entry.focused, attributes: { "data-ui3-skill-focus": entry.id } })}
                <div class="ui3-expedition__row">
                    ${K.button({ label: entry.training ? "Pausar XP" : "Retomar XP", attributes: { "data-ui3-skill-training": entry.id, "data-mode": entry.training ? "locked" : "training" } })}
                    ${K.button({ label: destination, attributes: { "data-ui3-skill-destination": entry.id } })}
                </div>
                ${entry.policy ? K.button({ label: entry.policy.enabled ? "Desativar coleta" : "Ativar coleta", attributes: { "data-ui3-skill-policy": entry.id, "data-enabled": entry.policy.enabled ? "false" : "true" } }) : ""}
                ${specialization ? K.button({ label: "Ver árvore de especialização", variant: "ghost", attributes: { "data-ui3-skill-specialization": entry.id } }) : ""}
            </div>`;
    }

    /* ---------------------------------------------------------------
       Aba Barra e automação
       --------------------------------------------------------------- */

    function bars() {
        return Aethra.SkillSystem?.getActionBars?.() || [];
    }

    function activeBarIndex() {
        return Math.max(0, Math.floor(number(Aethra.GameState?.hero?.activeActionBar)));
    }

    function costText(skill) {
        const cost = skill?.cost || {};
        const amount = number(cost.amount);
        if (amount <= 0) return "Grátis";
        return `${Aethra.Ui3Kit.formatNumber(amount)} ${COST_LABELS[String(cost.resource || "").toLowerCase()] || cost.resource || ""}`.trim();
    }

    function cooldownText(skill) {
        const rounds = number(Aethra.SkillSystem?.getCooldownRounds?.(skill));
        return rounds > 0 ? `${rounds} ${rounds === 1 ? "rodada" : "rodadas"} de recarga` : "Sem recarga";
    }

    function roleText(skill) {
        const type = String(skill?.type || skill?.effect?.type || "").toLowerCase();
        return type === "heal" ? "Sobrevivência" : type === "buff" ? "Utilidade" : "Dano";
    }

    function requirement(skill) {
        return Aethra.SkillSystem?.getSkillRequirement?.(skill) || { usable: true };
    }

    function loadoutHTML() {
        const K = kit();
        const collection = bars();
        const current = Math.min(activeBarIndex(), Math.max(0, collection.length - 1));
        const bar = collection[current] || { name: "Barra 1", slots: [] };
        const settings = Aethra.SkillController?.getSettings?.() || {};
        const slots = (bar.slots || []).slice(0, 10);
        if (state.slot >= slots.length) state.slot = 0;
        const selectedSkillId = slots[state.slot] || null;
        const barButtons = collection.map((item, index) => K.chip({
            label: item.name || `Barra ${index + 1}`,
            pressed: index === current,
            attributes: { "data-ui3-bar-index": index }
        })).join("");
        const slotButtons = slots.map((skillId, index) => {
            const skill = skillId ? Aethra.SkillSystem?.getSkill?.(skillId) : null;
            const hotkey = hotkeyLabel(index);
            if (!skill) {
                return K.slot({ empty: true, hotkey, selected: index === state.slot, label: `Tecla ${hotkey}: vazia`, attributes: { "data-ui3-loadout-slot": index } });
            }
            return K.slot({
                ...K.skillVisual(skill),
                hotkey,
                badge: settings[skillId]?.auto ? "AUTO" : "",
                selected: index === state.slot,
                label: `Tecla ${hotkey}: ${skill.name}`,
                attributes: { "data-ui3-loadout-slot": index, title: skill.name }
            });
        }).join("");
        const library = Object.values(Aethra.SkillSystem?.getSkills?.() || {})
            .filter((skill) => skill && skill.category !== "primary" && !skill.primarySlot)
            .map((skill) => {
                const req = requirement(skill);
                const inBar = slots.indexOf(skill.id);
                const visual = K.skillVisual(skill);
                return `<button type="button" class="ui3-list-row${req.usable ? "" : " is-locked"}" data-ui3-library-skill="${K.esc(skill.id)}" aria-pressed="${skill.id === selectedSkillId ? "true" : "false"}">
                        <span class="ui3-glyph-box ui3-glyph-box--${visual.tone}">${K.icon(visual.symbol, 20)}</span>
                        <span class="ui3-list-row__text">
                            <strong>${K.esc(skill.name)}${inBar >= 0 ? ` <span class="ui3-tag">Tecla ${hotkeyLabel(inBar)}</span>` : ""}</strong>
                            <small>${req.usable ? `${K.esc(roleText(skill))} · ${K.esc(costText(skill))}` : `Bloqueada · ${K.esc(req.reason || "requisito pendente")}`}</small>
                        </span>
                    </button>`;
            }).join("");
        return `<div class="ui3-section-head">
                <span class="ui3-eyebrow">Montar barra</span>
                <div class="ui3-row">${barButtons}${K.button({ label: "+ Nova barra", variant: "ghost", disabled: collection.length >= MAX_BARS, attributes: { "data-ui3-bar-add": "" } })}</div>
            </div>
            <div class="ui3-loadout">${slotButtons}</div>
            <div class="ui3-row-between">
                <span class="ui3-caption">Escolha uma tecla e depois uma habilidade. Destino: tecla ${hotkeyLabel(state.slot)}.</span>
                ${K.button({ label: "Esvaziar tecla", variant: "ghost", disabled: !selectedSkillId, attributes: { "data-ui3-loadout-clear": "" } })}
            </div>
            <div class="ui3-list ui3-scroll" aria-label="Habilidades disponíveis">${library}</div>`;
    }

    function primaryRowHTML(slot) {
        const K = kit();
        const attack = Aethra.BattleSystem?.getPrimaryAttackState?.(slot) || Aethra.SkillSystem?.getPrimaryAttack?.(slot) || {};
        const available = attack.available !== false;
        const isLeft = slot === "left";
        return `<div class="ui3-rule">
                <span class="ui3-glyph-box ui3-glyph-box--gold">${K.icon(isLeft ? "sword" : "dagger", 20)}</span>
                <span class="ui3-list-row__text">
                    <strong>${isLeft ? "Mão principal" : "Mão secundária"}</strong>
                    <small>${K.esc(attack.weapon?.name || (isLeft ? "Ataque desarmado" : "Sem arma equipada"))}</small>
                </span>
                ${K.toggle({
                    checked: attack.auto === true && available,
                    label: `Ataque automático da ${isLeft ? "mão principal" : "mão secundária"}`,
                    onText: "Auto",
                    offText: available ? "Manual" : "Indisponível",
                    disabled: !available,
                    attributes: { "data-ui3-primary-auto": slot }
                })}
            </div>`;
    }

    function ruleHTML(entry, index, count) {
        const K = kit();
        const skill = entry.skill || Aethra.SkillSystem?.getSkill?.(entry.skillId);
        if (!skill) return "";
        const req = requirement(skill);
        const setting = entry.setting || {};
        const isHeal = String(skill.type || skill.effect?.type || "").toLowerCase() === "heal";
        const threshold = Math.round(Math.min(95, Math.max(5, number(setting.hpThreshold ?? skill.hpThreshold, 50))));
        const visual = K.skillVisual(skill);
        return `<article class="ui3-rule ui3-rule--skill${req.usable ? "" : " is-locked"}">
                <div class="ui3-rule__priority">
                    <span class="ui3-rule__rank" aria-label="Prioridade ${index + 1}">${index + 1}</span>
                    <div class="ui3-rule__moves">
                        <button type="button" class="ui3-btn ui3-btn--ghost ui3-btn--mini" data-ui3-rule-move="up" data-skill="${K.esc(entry.skillId)}" aria-label="Subir ${K.esc(skill.name)}" ${index === 0 ? "disabled" : ""}>▲</button>
                        <button type="button" class="ui3-btn ui3-btn--ghost ui3-btn--mini" data-ui3-rule-move="down" data-skill="${K.esc(entry.skillId)}" aria-label="Descer ${K.esc(skill.name)}" ${index === count - 1 ? "disabled" : ""}>▼</button>
                    </div>
                </div>
                <span class="ui3-glyph-box ui3-glyph-box--${visual.tone}">${K.icon(visual.symbol, 20)}</span>
                <span class="ui3-list-row__text">
                    <strong>${K.esc(skill.name)} <span class="ui3-tag">Tecla ${hotkeyLabel(entry.slotIndex)}</span></strong>
                    <small>${req.usable ? `${K.esc(costText(skill))} · ${K.esc(cooldownText(skill))}` : `Bloqueada · ${K.esc(req.reason || "requisito pendente")}`}</small>
                </span>
                <div class="ui3-rule__actions">
                    ${K.toggle({
                        checked: setting.auto === true && req.usable,
                        label: `Execução automática de ${skill.name}`,
                        onText: "Auto",
                        offText: req.usable ? "Manual" : "Indisponível",
                        disabled: !req.usable,
                        attributes: { "data-ui3-rule-auto": entry.skillId }
                    })}
                    ${K.button({ label: "Usar agora", variant: "ghost", disabled: !req.usable, attributes: { "data-ui3-rule-use": entry.skillId } })}
                </div>
                ${isHeal ? `<label class="ui3-threshold">
                    <span>Curar abaixo de <output data-ui3-threshold-output="${K.esc(entry.skillId)}">${threshold}%</output> de vida</span>
                    <input type="range" min="5" max="95" step="5" value="${threshold}" data-ui3-threshold="${K.esc(entry.skillId)}" aria-label="Limite de vida para ${K.esc(skill.name)}">
                </label>` : ""}
            </article>`;
    }

    function automationHTML() {
        const K = kit();
        const snapshot = Aethra.SkillController?.getSnapshot?.() || {};
        const entries = snapshot.orderedSkills || [];
        const autoCount = entries.filter((entry) => entry.setting?.auto).length;
        const last = snapshot.lastAction?.skill?.name || snapshot.lastAction?.message || "Aguardando combate";
        return `<div class="ui3-section-head">
                <span class="ui3-eyebrow">Automação · ${K.formatNumber(autoCount)} ${autoCount === 1 ? "regra ativa" : "regras ativas"}</span>
                <span class="ui3-caption">Última decisão: ${K.esc(last)}</span>
            </div>
            <div class="ui3-stack">${primaryRowHTML("left")}${primaryRowHTML("right")}</div>
            <span class="ui3-eyebrow">Prioridade de execução</span>
            <div class="ui3-list ui3-scroll">${entries.length
                ? entries.map((entry, index) => ruleHTML(entry, index, entries.length)).join("")
                : `<p class="ui3-empty">Esta barra está vazia. Coloque habilidades nas teclas ao lado.</p>`}</div>
            <p class="ui3-caption ui3-rule-note">A cada rodada: primeiro a cura, se a vida estiver abaixo do limite; depois a primeira habilidade automática pronta, na ordem acima; por fim o comando manual na fila.</p>
            ${noticeHTML()}`;
    }

    /* ---------------------------------------------------------------
       Renderização e comandos
       --------------------------------------------------------------- */

    function render() {
        patch(parts.tabs, kit().tabs({ label: "Seções de habilidades", items: TABS, selected: state.tab }));
        parts.journal.hidden = state.tab !== "journal";
        parts.actionbar.hidden = state.tab !== "actionbar";
        if (state.tab === "journal") {
            const model = journal();
            const selected = selectedEntry(model);
            patch(parts.summary, journalSummaryHTML(model));
            patch(parts.chips, journalChipsHTML(model));
            patch(parts.list, journalListHTML(model, selected));
            patch(parts.detail, journalDetailHTML(model, selected));
        } else {
            patch(parts.loadout, loadoutHTML());
            patch(parts.automation, automationHTML());
        }
    }

    function goToDestination(skillId) {
        const guidance = Aethra.DisciplineSystem?.getFocusedGuidance?.(skillId) || null;
        if (guidance?.action === "open-workshop") {
            return Aethra.Ui3Navigation?.openWorkshop?.(guidance.professionId || skillId, { source: "ui3-skills" });
        }
        Aethra.WindowManager?.closeWindow?.(WINDOW_ID, { source: "ui3-skills" });
        Aethra.UIManager?.setPrimaryView?.("hunt", { source: "ui3-skills" });
        return Aethra.Ui3Navigation?.openHuntMap?.({
            source: "ui3-skills",
            focusSkillId: skillId,
            huntId: guidance?.huntId || null,
            mode: guidance?.mapMode || null
        });
    }

    function placeFromLibrary(skillId) {
        const skill = Aethra.SkillSystem?.getSkill?.(skillId);
        if (!skill) return false;
        const placed = Aethra.SkillSystem?.placeSkill?.(state.slot, skillId);
        if (placed) {
            Aethra.RenderEngine?.renderActionBar?.();
            notify(`${skill.name} na tecla ${hotkeyLabel(state.slot)}.`);
            state.slot = Math.min(9, state.slot + 1);
        } else {
            notify("Não foi possível colocar a habilidade nesta tecla.", "error");
        }
        render();
        return placed;
    }

    function onClick(event) {
        const target = event.target;
        const tab = target.closest("[data-ui3-tab]");
        if (tab) {
            state.tab = tab.dataset.ui3Tab;
            state.notice = null;
            return render();
        }
        const category = target.closest("[data-ui3-skill-category]");
        if (category) {
            state.category = category.dataset.ui3SkillCategory;
            return render();
        }
        const entry = target.closest("[data-ui3-skill-entry]");
        if (entry) {
            state.selectedSkill = entry.dataset.ui3SkillEntry;
            state.notice = null;
            return render();
        }
        const focus = target.closest("[data-ui3-skill-focus]");
        if (focus) {
            Aethra.DisciplineSystem?.setFocus?.(focus.dataset.ui3SkillFocus, "ui3-skills");
            return render();
        }
        const training = target.closest("[data-ui3-skill-training]");
        if (training) {
            Aethra.DisciplineSystem?.setTrainingMode?.(training.dataset.ui3SkillTraining, training.dataset.mode, "ui3-skills");
            return render();
        }
        const policy = target.closest("[data-ui3-skill-policy]");
        if (policy) {
            Aethra.ProfessionSystem?.setCollectionPolicy?.(policy.dataset.ui3SkillPolicy, policy.dataset.enabled === "true", "ui3-skills");
            return render();
        }
        const specialization = target.closest("[data-ui3-skill-specialization]");
        if (specialization) return Aethra.Ui3Navigation?.openSpecialization?.(specialization.dataset.ui3SkillSpecialization, { source: "ui3-skills" });
        const destination = target.closest("[data-ui3-skill-destination]");
        if (destination) return goToDestination(destination.dataset.ui3SkillDestination);

        const barIndex = target.closest("[data-ui3-bar-index]");
        if (barIndex) {
            Aethra.SkillSystem?.setActiveBar?.(Number(barIndex.dataset.ui3BarIndex));
            state.slot = 0;
            return render();
        }
        if (target.closest("[data-ui3-bar-add]")) {
            const bar = Aethra.SkillSystem?.addBar?.();
            if (bar) Aethra.SkillSystem.setActiveBar(bars().length - 1);
            state.slot = 0;
            return render();
        }
        const slot = target.closest("[data-ui3-loadout-slot]");
        if (slot) {
            state.slot = Number(slot.dataset.ui3LoadoutSlot) || 0;
            return render();
        }
        if (target.closest("[data-ui3-loadout-clear]")) {
            Aethra.SkillSystem?.placeSkill?.(state.slot, null);
            Aethra.RenderEngine?.renderActionBar?.();
            return render();
        }
        const library = target.closest("[data-ui3-library-skill]");
        if (library) return placeFromLibrary(library.dataset.ui3LibrarySkill);
        const primary = target.closest("[data-ui3-primary-auto]");
        if (primary) {
            Aethra.SkillSystem?.setPrimaryAuto?.(primary.dataset.ui3PrimaryAuto, primary.getAttribute("aria-checked") !== "true");
            Aethra.RenderEngine?.renderActionBar?.();
            return render();
        }
        const move = target.closest("[data-ui3-rule-move]");
        if (move) {
            Aethra.SkillController?.moveSkill?.(move.dataset.skill, move.dataset.ui3RuleMove);
            Aethra.RenderEngine?.renderActionBar?.();
            return render();
        }
        const auto = target.closest("[data-ui3-rule-auto]");
        if (auto) {
            Aethra.SkillController?.setAuto?.(auto.dataset.ui3RuleAuto, auto.getAttribute("aria-checked") !== "true");
            Aethra.RenderEngine?.renderActionBar?.();
            return render();
        }
        const use = target.closest("[data-ui3-rule-use]");
        if (use) {
            const result = Aethra.SkillController?.requestManualSkill?.(use.dataset.ui3RuleUse);
            notify(result?.ok ? "Habilidade na fila manual." : result?.reason === "no-battle" ? "Só é possível usar durante um combate." : "Habilidade recarregando.", result?.ok ? "ok" : "error");
            return render();
        }
        return undefined;
    }

    function onInput(event) {
        if (event.target.matches("[data-ui3-skills-search]")) {
            state.search = event.target.value;
            const model = journal();
            patch(parts.list, journalListHTML(model, selectedEntry(model)));
            return;
        }
        const range = event.target.closest("[data-ui3-threshold]");
        if (range) {
            const output = parts.automation.querySelector(`[data-ui3-threshold-output="${range.dataset.ui3Threshold}"]`);
            if (output) output.textContent = `${range.value}%`;
        }
    }

    function onChange(event) {
        const range = event.target.closest("[data-ui3-threshold]");
        if (!range) return;
        Aethra.SkillController?.setHpThreshold?.(range.dataset.ui3Threshold, Number(range.value));
        render();
    }

    function onTabKeys(event) {
        const tab = event.target.closest?.("[data-ui3-tab]");
        if (!tab || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const index = TABS.findIndex((entry) => entry.id === tab.dataset.ui3Tab);
        state.tab = TABS[(index + (event.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].id;
        render();
        parts.tabs.querySelector(`[data-ui3-tab="${state.tab}"]`)?.focus();
    }

    function setup(body) {
        body.classList.add("ui3-skills");
        body.innerHTML = `<div class="ui3-skills__tabs" data-ui3-part="tabs"></div>
            <div class="ui3-skills__panel ui3-skills__journal" data-ui3-part="journal">
                <section class="ui3-skills__main" aria-label="Habilidades">
                    <div data-ui3-part="summary"></div>
                    <label class="ui3-search">
                        <span class="ui3-search__icon">${kit().icon("search", 15)}</span>
                        <span class="ui3-sr-only">Buscar habilidade</span>
                        <input type="search" placeholder="Buscar habilidade, função ou benefício" autocomplete="off" data-ui3-skills-search data-ui3-autofocus>
                    </label>
                    <div class="ui3-bag__chips" role="group" aria-label="Categorias" data-ui3-part="chips"></div>
                    <div class="ui3-list ui3-scroll" data-ui3-part="list"></div>
                </section>
                <section class="ui3-bag__details" aria-label="Habilidade selecionada" data-ui3-part="detail"></section>
            </div>
            <div class="ui3-skills__panel ui3-skills__bar" data-ui3-part="actionbar" hidden>
                <section class="ui3-skills__column" aria-label="Montar barra" data-ui3-part="loadout"></section>
                <section class="ui3-skills__column" aria-label="Automação" data-ui3-part="automation"></section>
            </div>`;
        const part = (name) => body.querySelector(`[data-ui3-part="${name}"]`);
        parts = {
            tabs: part("tabs"),
            journal: part("journal"),
            summary: part("summary"),
            chips: part("chips"),
            list: part("list"),
            detail: part("detail"),
            actionbar: part("actionbar"),
            loadout: part("loadout"),
            automation: part("automation"),
            search: body.querySelector("[data-ui3-skills-search]")
        };
        body.addEventListener("click", onClick);
        body.addEventListener("input", onInput);
        body.addEventListener("change", onChange);
        body.addEventListener("keydown", onTabKeys);
    }

    function onOpen(options = {}) {
        state.tab = options.tab === "actionbar" ? "actionbar" : "journal";
        if (Number.isInteger(options.slot)) state.slot = Math.max(0, Math.min(9, options.slot));
        state.notice = null;
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3SkillsWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Habilidades",
            className: "ui3-dialog--wide",
            setup,
            render,
            onOpen,
            getSubtitle: () => "Maestrias, barra de ações e automação",
            events: [
                "actionBarChanged",
                "skill-controller:settings-changed",
                "primary-attack:settings-changed",
                "skill:xp-changed",
                "skill:training-mode-changed",
                "discipline:focus-changed",
                "profession:policy-changed",
                "profession:specialization-chosen",
                "itemEquipped",
                "itemUnequipped",
                "state:restored"
            ]
        });
    }
})(window.Aethra = window.Aethra || {});
