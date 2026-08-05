// ProgressionJournalUI.js - projeção e comandos do Diário de Progressão.
(function initProgressionJournalUI(Aethra) {
    "use strict";

    if (!Aethra?.EventBus || !Aethra?.DisciplineSystem) return;
    if (Aethra.ProgressionJournalUI) return;

    const WINDOW_ID = "skills-view";
    const ROOT_ID = "progression-journal-root";
    const MAX_RECENT = 8;
    const state = {
        tab: "journal",
        category: "all",
        search: "",
        selectedId: null,
        recent: [],
        renderFrame: null,
        initialized: false
    };

    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const fmt = (value) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(number(value));
    const esc = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    function allSkills() {
        return Object.values(Aethra.DisciplineSystem.getSnapshot?.() || {});
    }

    function validSkillId(id, skills = allSkills()) {
        return skills.some((entry) => entry.id === id) ? id : null;
    }

    function focusId(skills = allSkills()) {
        return validSkillId(Aethra.DisciplineSystem.getFocusId?.(), skills);
    }

    function selectedId(skills = allSkills()) {
        const preferred = validSkillId(state.selectedId, skills)
            || focusId(skills)
            || validSkillId(Aethra.GameState.hero?.introProfessionId, skills)
            || skills.find((entry) => entry.discovered)?.id
            || skills[0]?.id
            || null;
        state.selectedId = preferred;
        return preferred;
    }

    function nextMilestone(skill) {
        const level = Math.max(1, number(skill?.level, 1));
        const candidates = [];
        const disciplineMilestone = (Aethra.RenderEngine?.getDisciplineMilestones?.(skill.id) || [])
            .filter((entry) => number(entry.level) > level)
            .sort((a, b) => number(a.level) - number(b.level))[0];
        if (disciplineMilestone) {
            candidates.push({
                level: disciplineMilestone.level,
                type: disciplineMilestone.type || "marco",
                title: disciplineMilestone.title,
                description: disciplineMilestone.desc
            });
        }

        const recipes = Aethra.RecipeCatalog?.byProfession?.(skill.id) || [];
        const recipe = recipes
            .filter((entry) => number(entry.unlockLevel, 1) > level)
            .sort((a, b) => number(a.unlockLevel) - number(b.unlockLevel))[0];
        if (recipe) {
            candidates.push({
                level: recipe.unlockLevel,
                type: "receita",
                title: recipe.name,
                description: `${Aethra.RecipeCatalog?.tierName?.(recipe.tier) || `Tier ${recipe.tier}`} · ${recipe.description || "Nova receita de criação."}`
            });
        }

        const specialization = Aethra.ProfessionSystem?.getSpecializationState?.(skill.id);
        const tree = Aethra.ProfessionSystem?.getSpecializationTree?.(skill.id);
        if (specialization && tree) {
            if (!specialization.branchId) {
                candidates.push({
                    level: Math.max(level, specialization.unlockLevel),
                    type: "especialização",
                    title: level >= specialization.unlockLevel ? "Especialização disponível" : "Escolha de especialização",
                    description: level >= specialization.unlockLevel
                        ? "Escolha agora um caminho permanente para esta profissão."
                        : "Dois caminhos permanentes passam a definir sua maestria."
                });
            } else {
                const nextNode = specialization.branch?.nodes
                    ?.filter((entry) => number(entry.level) > level)
                    .sort((a, b) => number(a.level) - number(b.level))[0];
                if (nextNode) {
                    candidates.push({
                        level: nextNode.level,
                        type: "especialização",
                        title: nextNode.name,
                        description: nextNode.description || `Novo marco de ${specialization.branch.name}.`
                    });
                } else {
                    candidates.push({
                        level: specialization.nextMasteryLevel,
                        type: "maestria",
                        title: `Pulso de ${specialization.branch.name}`,
                        description: "Novo ganho permanente com retorno decrescente; a progressão não tem nível máximo."
                    });
                }
            }
        }

        return candidates.sort((a, b) => number(a.level) - number(b.level))[0] || {
            level: level + 1,
            type: "nível",
            title: "Maestria contínua",
            description: "Continue praticando: os benefícios crescem sem um nível máximo, com retorno decrescente."
        };
    }

    function entryViewModel(skill, focused) {
        const guide = Aethra.DisciplineSystem.getTrainingGuide?.(skill.id) || {};
        const specialization = Aethra.ProfessionSystem?.getSpecializationState?.(skill.id) || null;
        const policy = skill.policy || Aethra.ProfessionSystem?.getState?.(skill.id)?.policy || null;
        const bonus = Aethra.DisciplineSystem.getDiminishingBonus?.(skill.id, { scale: 12, interval: 10 });
        return {
            ...skill,
            focused: skill.id === focused,
            training: skill.trainingMode !== "locked",
            guide,
            policy,
            specialization,
            contract: skill.id === focused
                ? Aethra.ProfessionSystem?.getFocusTrainingState?.(skill.id) || null
                : null,
            nextUnlock: nextMilestone(skill),
            bonusPercent: number(bonus),
            progressPercent: Math.min(100, Math.max(0, number(skill.progressPercent)))
        };
    }

    function getViewModel() {
        const skills = allSkills();
        const focused = focusId(skills);
        const selected = selectedId(skills);
        const entries = skills.map((skill) => entryViewModel(skill, focused));
        const categories = [...new Set(entries.map((entry) => entry.category))];
        const normalizedSearch = state.search.trim().toLocaleLowerCase("pt-BR");
        const filtered = entries.filter((entry) => {
            const categoryMatches = state.category === "all" || entry.category === state.category;
            const searchMatches = !normalizedSearch || `${entry.name} ${entry.role} ${entry.description}`
                .toLocaleLowerCase("pt-BR")
                .includes(normalizedSearch);
            return categoryMatches && searchMatches;
        });
        return {
            entries,
            filtered,
            categories,
            selected: entries.find((entry) => entry.id === selected) || entries[0] || null,
            focused: entries.find((entry) => entry.focused) || null,
            summary: {
                total: entries.length,
                training: entries.filter((entry) => entry.training).length,
                paused: entries.filter((entry) => !entry.training).length,
                discovered: entries.filter((entry) => entry.discovered).length
            },
            recent: clone(state.recent),
            category: state.category,
            search: state.search
        };
    }

    function summaryHTML(model) {
        const focus = model.focused;
        return `<section class="progression-summary">
            <div class="progression-summary__focus">
                <span>${focus ? esc(focus.icon) : "✦"}</span>
                <div><small>FOCO ATUAL</small><strong>${esc(focus?.name || "Nenhuma skill focada")}</strong><p>${focus ? `Nível ${fmt(focus.level)} · ${focus.training ? "ganhando XP" : "XP pausado"}` : "Escolha uma habilidade para acompanhar."}</p></div>
            </div>
            <div class="progression-summary__metrics">
                <span><small>DESCOBERTAS</small><strong>${model.summary.discovered}/${model.summary.total}</strong></span>
                <span><small>TREINANDO</small><strong>${model.summary.training}</strong></span>
                <span><small>PAUSADAS</small><strong>${model.summary.paused}</strong></span>
            </div>
        </section>`;
    }

    function filtersHTML(model) {
        return `<section class="progression-filters">
            <label><span aria-hidden="true">⌕</span><input type="search" data-progression-search value="${esc(model.search)}" placeholder="Buscar skill, função ou benefício" aria-label="Buscar skill"></label>
            <div class="progression-filter-chips" role="list" aria-label="Filtrar skills por categoria">
                <button type="button" data-progression-category="all" class="${model.category === "all" ? "is-active" : ""}">Todas</button>
                ${model.categories.map((category) => `<button type="button" data-progression-category="${esc(category)}" class="${model.category === category ? "is-active" : ""}">${esc(category)}</button>`).join("")}
            </div>
        </section>`;
    }

    function skillCardHTML(entry, selectedIdValue) {
        return `<button type="button" class="progression-skill-card ${entry.id === selectedIdValue ? "is-selected" : ""} ${entry.focused ? "is-focused" : ""} ${entry.training ? "" : "is-paused"}" data-progression-skill="${esc(entry.id)}" aria-pressed="${entry.id === selectedIdValue}">
            <span class="progression-skill-card__icon">${esc(entry.icon || "•")}</span>
            <span class="progression-skill-card__body"><small>${esc(entry.category)} · ${esc(entry.role)}</small><strong>${esc(entry.name)} <b>Nv. ${fmt(entry.level)}</b></strong><i><u style="width:${entry.progressPercent.toFixed(1)}%"></u></i><em>${fmt(entry.xpCurrent)} / ${fmt(entry.xpNext)} XP</em></span>
            <span class="progression-skill-card__state">${entry.focused ? "★ FOCO" : entry.training ? "XP ON" : "PAUSADA"}</span>
        </button>`;
    }

    function unlockHTML(unlock) {
        return `<article class="progression-next-unlock">
            <span><small>PRÓXIMO MARCO · NÍVEL ${fmt(unlock.level)}</small><strong>${esc(unlock.title)}</strong><p>${esc(unlock.description)}</p></span>
            <b>${esc(unlock.type)}</b>
        </article>`;
    }

    function contractHTML(contract) {
        if (!contract?.quest) return "";
        const objectives = contract.quest.objectives || [];
        const current = objectives.find((entry) => !entry.completed) || null;
        return `<section class="progression-contract ${contract.completed ? "is-complete" : "is-active"}">
            <header>
                <span><small>CONTRATO DE FOCO</small><strong>${esc(contract.title)}</strong><p>${esc(contract.summary)}</p></span>
                <b>${fmt(contract.progress?.percent || 0)}%</b>
            </header>
            <i><u style="width:${Math.min(100, Math.max(0, number(contract.progress?.percent))).toFixed(1)}%"></u></i>
            <ol>
                ${objectives.map((objective, index) => `<li class="${objective.completed ? "is-complete" : objective.id === current?.id ? "is-current" : "is-pending"}"><b>${objective.completed ? "✓" : index + 1}</b><span><strong>${esc(objective.label)}</strong><small>${fmt(objective.progress)}/${fmt(objective.required)}</small></span></li>`).join("")}
            </ol>
            ${current ? `<p class="progression-contract__current"><strong>Agora:</strong> ${esc(current.label)}</p>` : `<p class="progression-contract__current"><strong>Ciclo concluído.</strong> Continue praticando livremente para evoluir sem limite.</p>`}
        </section>`;
    }

    function recentHTML(model, skillId) {
        const recent = model.recent.filter((entry) => entry.skillId === skillId).slice(0, 4);
        if (!recent.length) return `<div class="progression-recent-empty"><span>◇</span><p>Nenhum XP desta skill na sessão atual.<br><small>A próxima ação aparecerá aqui.</small></p></div>`;
        return `<ol class="progression-recent-list">${recent.map((entry) => `<li><span>+${fmt(entry.amount)} XP</span><strong>${esc(entry.sourceLabel)}</strong><time>${esc(entry.time)}</time></li>`).join("")}</ol>`;
    }

    function detailHTML(model) {
        const entry = model.selected;
        if (!entry) return `<div class="progression-empty">Nenhuma skill disponível.</div>`;
        const guide = entry.guide || {};
        const guidance = Aethra.DisciplineSystem.getFocusedGuidance?.(entry.id) || null;
        const specialization = entry.specialization;
        const specializationText = specialization
            ? (specialization.branch?.name || (entry.level >= specialization.unlockLevel ? "Escolha disponível" : `Disponível no nível ${specialization.unlockLevel}`))
            : null;
        const destinationLabel = guidance?.actionLabel || (guide.destination === "workshop" ? "Abrir oficina" : "Encontrar Hunt");
        return `<aside class="progression-detail" aria-label="Detalhes de ${esc(entry.name)}">
            <header>
                <span>${esc(entry.icon || "•")}</span>
                <div><small>${esc(entry.category)} · ${esc(entry.role)}</small><h3>${esc(entry.name)}</h3><p>Nível ${fmt(entry.level)} · bônus acumulado aproximado de <strong>+${fmt(entry.bonusPercent)}%</strong></p></div>
            </header>
            <section class="progression-detail__benefit"><small>O QUE VOCÊ GANHA</small><strong>${esc(entry.benefit)}</strong><p>${esc(entry.description)}</p></section>
            <section class="progression-detail__training"><small>COMO EVOLUIR</small><strong>${esc(guide.where)}</strong><p>${esc(guide.action)}</p><ol>${(guide.chain || []).map((step, index) => `<li><b>${index + 1}</b><span>${esc(step)}</span></li>`).join("")}</ol></section>
            ${contractHTML(entry.contract)}
            ${unlockHTML(entry.nextUnlock)}
            ${specializationText ? `<section class="progression-specialization"><span><small>CAMINHO DE OFÍCIO</small><strong>${esc(specializationText)}</strong></span><button type="button" data-progression-specialization="${esc(entry.id)}">Ver árvore</button></section>` : ""}
            <section class="progression-recent"><header><small>XP RECENTE · ESTA SESSÃO</small><span>${model.recent.filter((item) => item.skillId === entry.id).length} registro(s)</span></header>${recentHTML(model, entry.id)}</section>
            <footer class="progression-detail__actions">
                <button type="button" class="is-primary" data-progression-focus="${esc(entry.id)}" ${entry.focused ? "disabled" : ""}>${entry.focused ? "Skill focada" : "Definir como foco"}</button>
                <button type="button" data-progression-training="${esc(entry.id)}" data-training-mode="${entry.training ? "locked" : "training"}">${entry.training ? "Pausar XP" : "Retomar XP"}</button>
                ${entry.policy ? `<button type="button" data-progression-policy="${esc(entry.id)}" data-policy-enabled="${entry.policy.enabled ? "false" : "true"}">${entry.policy.enabled ? "Desativar coleta" : "Ativar coleta"}</button>` : ""}
                <button type="button" data-progression-destination="${esc(entry.id)}">${destinationLabel}</button>
                ${guide.workshopProfessionId && guide.destination !== "workshop" ? `<button type="button" data-progression-workshop="${esc(guide.workshopProfessionId)}">Abrir oficina</button>` : ""}
            </footer>
        </aside>`;
    }

    function render() {
        const root = document.getElementById(ROOT_ID);
        if (!root) return false;
        const model = getViewModel();
        root.innerHTML = `${summaryHTML(model)}${filtersHTML(model)}<div class="progression-workspace"><section class="progression-skill-list" aria-label="Lista de skills">${model.filtered.length ? model.filtered.map((entry) => skillCardHTML(entry, model.selected?.id)).join("") : `<div class="progression-empty">Nenhuma skill corresponde ao filtro.</div>`}</section>${detailHTML(model)}</div>`;
        Aethra.TooltipManager?.refresh?.();
        return model;
    }

    function scheduleRender() {
        if (state.renderFrame !== null) return;
        state.renderFrame = window.requestAnimationFrame(() => {
            state.renderFrame = null;
            if (state.tab === "journal" || Aethra.WindowManager?.isWindowOpen?.(WINDOW_ID)) render();
        });
    }

    function setActiveTab(tab = "journal") {
        const nextTab = tab === "actionbar" ? "actionbar" : "journal";
        state.tab = nextTab;
        document.querySelectorAll("[data-skills-workspace-tab]").forEach((button) => {
            const active = button.dataset.skillsWorkspaceTab === nextTab;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-selected", String(active));
        });
        document.querySelectorAll("[data-skills-workspace-panel]").forEach((panel) => {
            panel.hidden = panel.dataset.skillsWorkspacePanel !== nextTab;
        });
        if (nextTab === "journal") render();
        else Aethra.CombatHudModernizer?.renderSkillSettings?.();
        return nextTab;
    }

    function open(tab = "journal") {
        setActiveTab(tab);
        render();
        return Aethra.WindowManager?.openWindow?.(WINDOW_ID, { source: "progression-journal", exclusive: true });
    }

    function sourceLabel(source) {
        const labels = {
            "weapon-use": "Ataque com arma",
            "skill-use": "Técnica usada",
            "defense-block": "Bloqueio",
            "defense-hit": "Armadura em combate",
            mining: "Mineração",
            "creature-harvest": "Esfolamento",
            forge: "Forjaria",
            smelt: "Fundição",
            tan: "Curtimento",
            "craft-leather": "Couraria",
            exploration: "Exploração",
            survival: "Sobrevivência"
        };
        return labels[source] || String(source || "Ação de treino").replaceAll("-", " ");
    }

    function recordXP(payload = {}) {
        const skillId = payload.skillId || payload.id;
        if (!validSkillId(skillId) || number(payload.amount) <= 0) return;
        state.recent.unshift({
            skillId,
            amount: number(payload.amount),
            source: payload.source || "skill-action",
            sourceLabel: sourceLabel(payload.source),
            time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date())
        });
        state.recent = state.recent.slice(0, MAX_RECENT);
        scheduleRender();
    }

    function handleClick(event) {
        const tab = event.target.closest("[data-skills-workspace-tab]");
        if (tab) return void setActiveTab(tab.dataset.skillsWorkspaceTab);

        const opener = event.target.closest('[data-open-window="skills-view"]');
        if (opener) setActiveTab(opener.dataset.skillsTab || "journal");

        const category = event.target.closest("[data-progression-category]");
        if (category) {
            state.category = category.dataset.progressionCategory || "all";
            return void render();
        }
        const skill = event.target.closest("[data-progression-skill]");
        if (skill) {
            state.selectedId = skill.dataset.progressionSkill;
            return void render();
        }
        const focus = event.target.closest("[data-progression-focus]");
        if (focus) {
            state.selectedId = focus.dataset.progressionFocus;
            Aethra.DisciplineSystem.setFocus?.(state.selectedId, "progression-journal");
            return void render();
        }
        const training = event.target.closest("[data-progression-training]");
        if (training) {
            Aethra.DisciplineSystem.setTrainingMode?.(training.dataset.progressionTraining, training.dataset.trainingMode, "progression-journal");
            return void render();
        }
        const policy = event.target.closest("[data-progression-policy]");
        if (policy) {
            Aethra.ProfessionSystem?.setCollectionPolicy?.(policy.dataset.progressionPolicy, policy.dataset.policyEnabled === "true", "progression-journal");
            return void render();
        }
        const specialization = event.target.closest("[data-progression-specialization]");
        if (specialization) return void Aethra.ProfessionSpecializationUI?.open?.(specialization.dataset.progressionSpecialization);
        const workshop = event.target.closest("[data-progression-workshop]");
        if (workshop) return void Aethra.ProfessionWorkshopUI?.open?.(workshop.dataset.progressionWorkshop);
        const destination = event.target.closest("[data-progression-destination]");
        if (destination) {
            const disciplineId = destination.dataset.progressionDestination;
            const guidance = Aethra.DisciplineSystem.getFocusedGuidance?.(disciplineId) || null;
            if (guidance?.action === "open-workshop") {
                return void Aethra.ProfessionWorkshopUI?.open?.(guidance.professionId || disciplineId);
            }
            Aethra.WindowManager?.closeWindow?.(WINDOW_ID, { source: "progression-journal" });
            Aethra.UIManager?.setPrimaryView?.("hunt", { source: "progression-journal" });
            return void Aethra.openHuntWorldMap?.({
                source: "progression-journal",
                focusSkillId: disciplineId,
                huntId: guidance?.huntId || null,
                mode: guidance?.mapMode || null
            });
        }
    }

    function init() {
        if (state.initialized) return render();
        state.initialized = true;
        document.addEventListener("click", handleClick, true);
        document.addEventListener("input", (event) => {
            if (!event.target.matches("[data-progression-search]")) return;
            const caret = event.target.selectionStart;
            state.search = event.target.value;
            render();
            const input = document.querySelector("[data-progression-search]");
            input?.focus?.({ preventScroll: true });
            input?.setSelectionRange?.(caret, caret);
        });
        Aethra.EventBus.on("skill:xp-changed", recordXP);
        [
            "skill:training-mode-changed",
            "profession:policy-changed",
            "profession:specialization-chosen",
            "profession:perk-unlocked",
            "crafting:recipe-discovered",
            "discipline:focus-changed",
            "quest:accepted",
            "quest:objective-updated",
            "quest:finished",
            "save:loaded",
            "state:restored"
        ].forEach((eventName) => Aethra.EventBus.on(eventName, scheduleRender));
        Aethra.EventBus.on("window:opened", (payload = {}) => {
            if ((payload.id || payload.windowId) === WINDOW_ID) scheduleRender();
        });
        setActiveTab("journal");
        return render();
    }

    Aethra.ProgressionJournalUI = {
        init,
        open,
        render,
        setActiveTab,
        selectSkill(id) {
            state.selectedId = validSkillId(id) || state.selectedId;
            return render();
        },
        getViewModel,
        getState: () => clone({ ...state, renderFrame: null })
    };

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})(window.Aethra);
