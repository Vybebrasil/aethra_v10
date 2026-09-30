/*
 * Ui3QuestsWindow.js — Missões na UI 3.0 (fase 4).
 *
 * Assume a janela "quests-view" pelo Ui3Window/WindowManager.
 *   leitura   QuestSystem.getState/getGuidance/getProgress, GameData.items
 *   comandos  QuestSystem.trackQuest; "Ir para o objetivo" segue
 *             Ui3Navigation.followQuestGuidance (o mesmo da Cidade)
 */
(function initUi3QuestsWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "quests-view";

    const state = { selected: null };
    const rendered = new WeakMap();
    let parts = {};

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

    function questState() {
        const current = Aethra.QuestSystem?.getState?.() || {};
        return {
            active: Array.isArray(current.active) ? current.active : [],
            completed: Array.isArray(current.completed) ? current.completed : [],
            tracked: current.trackedQuestId || Aethra.GameState?.ui?.trackedQuestId || null
        };
    }

    function percentOf(quest) {
        const totals = (quest.objectives || []).reduce((sum, objective) => {
            const required = Math.max(1, number(objective.required, 1));
            sum.progress += Math.min(number(objective.progress), required);
            sum.required += required;
            return sum;
        }, { progress: 0, required: 0 });
        if (quest.status === "completed" || quest.completedAt) return 100;
        return Math.round((totals.progress / Math.max(1, totals.required)) * 100);
    }

    function selectedQuest(current) {
        const all = [...current.active, ...current.completed];
        if (!all.some((quest) => quest.id === state.selected)) {
            state.selected = current.tracked && all.some((quest) => quest.id === current.tracked)
                ? current.tracked
                : all[0]?.id || null;
        }
        return all.find((quest) => quest.id === state.selected) || null;
    }

    function progressBar(percent, label) {
        const value = Math.max(0, Math.min(100, number(percent)));
        return `<div class="ui3-progress ui3-progress--gold" role="meter" aria-label="${kit().esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><div style="width:${value}%"></div></div>`;
    }

    function rowHTML(quest, current, completed) {
        const K = kit();
        const percent = percentOf(quest);
        const tracked = quest.id === current.tracked;
        return `<button type="button" class="ui3-list-row ui3-quest-row${completed ? " is-done" : ""}" data-ui3-quest="${K.esc(quest.id)}" aria-pressed="${quest.id === state.selected ? "true" : "false"}">
                <span class="ui3-glyph-box${completed ? " ui3-glyph-box--green" : ""}">${K.icon(completed ? "check" : "scroll", 18)}</span>
                <span class="ui3-list-row__text">
                    <strong>${K.esc(quest.title)}</strong>
                    <small>${completed ? "Concluída" : `${percent}% · Nível ${K.formatNumber(quest.levelReq || 1)}`}${tracked ? " · acompanhando" : ""}</small>
                    ${completed ? "" : progressBar(percent, `Progresso de ${quest.title}`)}
                </span>
            </button>`;
    }

    function listHTML(current) {
        const active = current.active.map((quest) => rowHTML(quest, current, false)).join("");
        const done = current.completed.map((quest) => rowHTML(quest, current, true)).join("");
        return `<span class="ui3-eyebrow">Ativas · ${current.active.length}</span>
            ${active || `<p class="ui3-empty">Nenhuma missão ativa agora.</p>`}
            ${current.completed.length ? `<span class="ui3-eyebrow ui3-quests__divider">Concluídas · ${current.completed.length}</span>${done}` : ""}`;
    }

    function rewardsHTML(quest) {
        const K = kit();
        const reward = quest.reward || Aethra.QuestSystem?.getDefinition?.(quest.id)?.reward || {};
        const rows = [];
        if (number(reward.xp) > 0) rows.push(`<div class="ui3-reward"><span class="ui3-glyph-box ui3-glyph-box--violet">XP</span><strong>${K.formatNumber(reward.xp)} de experiência</strong></div>`);
        if (number(reward.gold) > 0) rows.push(`<div class="ui3-reward"><span class="ui3-glyph-box"><span class="ui3-currency__coin" aria-hidden="true"></span></span><strong>${K.formatNumber(reward.gold)} de ouro</strong></div>`);
        (reward.items || []).forEach((entry) => {
            const templateId = entry.templateId || entry.id;
            const template = Aethra.GameData?.items?.[templateId] || { templateId, name: templateId };
            rows.push(`<div class="ui3-reward">${Aethra.Ui3Items.thumbHTML({ ...template, templateId })}<strong>${K.formatNumber(entry.quantity || 1)}× ${K.esc(template.name || templateId)}</strong></div>`);
        });
        if (!rows.length) {
            const practice = (quest.objectives || []).some((objective) => objective.type === "PracticeSkill");
            return `<p class="ui3-empty">${practice ? "Aprendizado e progresso do ofício." : "Sem recompensa material."}</p>`;
        }
        return rows.join("");
    }

    function detailHTML(current) {
        const K = kit();
        const quest = selectedQuest(current);
        if (!quest) {
            return `<div class="ui3-bag__placeholder"><span class="ui3-eyebrow">Missões</span><p class="ui3-empty">Nenhuma missão ainda. Converse com os mestres da cidade.</p></div>`;
        }
        const completed = quest.status === "completed" || Boolean(quest.completedAt);
        const percent = percentOf(quest);
        const tracked = quest.id === current.tracked;
        const guidance = !completed ? Aethra.QuestSystem?.getGuidance?.(quest) : null;
        const objectives = (quest.objectives || []).map((objective) => {
            const required = Math.max(1, number(objective.required, 1));
            const progress = Math.min(number(objective.progress), required);
            const done = objective.completed || progress >= required;
            return `<li class="${done ? "is-done" : ""}"><span class="ui3-check" aria-hidden="true">${done ? "✓" : ""}</span><span>${K.esc(objective.label || objective.target || objective.type)}</span><strong>${K.formatNumber(progress)}/${K.formatNumber(required)}</strong></li>`;
        }).join("");
        return `<div class="ui3-quest-head">
                <span class="ui3-eyebrow">${completed ? "Concluída" : `Missão ativa · nível ${K.formatNumber(quest.levelReq || 1)}`}</span>
                <h3 class="ui3-quest-head__title">${K.esc(quest.title)}</h3>
                ${quest.description ? `<p class="ui3-item-description">${K.esc(quest.description)}</p>` : ""}
            </div>
            <section class="ui3-section">
                <div class="ui3-row-between"><span class="ui3-eyebrow">Objetivos</span><strong>${percent}%</strong></div>
                ${progressBar(percent, `Progresso de ${quest.title}`)}
                <ul class="ui3-objectives">${objectives}</ul>
                ${guidance?.detail ? `<p>${K.esc(guidance.detail)}</p>` : ""}
            </section>
            <section class="ui3-section">
                <span class="ui3-eyebrow">Recompensas</span>
                <div class="ui3-rewards">${rewardsHTML(quest)}</div>
            </section>
            ${completed ? "" : `<div class="ui3-item-actions">
                ${guidance ? K.button({ label: guidance.actionLabel || "Ir para o objetivo", variant: "primary", attributes: { "data-ui3-quest-go": quest.id } }) : ""}
                ${K.button({ label: tracked ? "Parar de acompanhar" : "Acompanhar", attributes: { "data-ui3-quest-track": quest.id, "aria-pressed": tracked ? "true" : "false" } })}
            </div>`}`;
    }

    function render() {
        const current = questState();
        selectedQuest(current);
        patch(parts.list, listHTML(current));
        patch(parts.detail, detailHTML(current));
    }

    function onClick(event) {
        const row = event.target.closest("[data-ui3-quest]");
        if (row) {
            state.selected = row.dataset.ui3Quest;
            return render();
        }
        const track = event.target.closest("[data-ui3-quest-track]");
        if (track) {
            const current = questState();
            const questId = track.dataset.ui3QuestTrack;
            Aethra.QuestSystem?.trackQuest?.(current.tracked === questId ? null : questId);
            return render();
        }
        const go = event.target.closest("[data-ui3-quest-go]");
        if (go) {
            const quest = questState().active.find((entry) => entry.id === go.dataset.ui3QuestGo);
            const guidance = quest ? Aethra.QuestSystem?.getGuidance?.(quest) : null;
            if (!guidance) return false;
            Aethra.WindowManager?.closeWindow?.(WINDOW_ID, { source: "ui3-quests" });
            return Aethra.Ui3Navigation?.followQuestGuidance?.(guidance, { source: "ui3-quests" });
        }
        return undefined;
    }

    function setup(body) {
        body.classList.add("ui3-quests");
        body.innerHTML = `<section class="ui3-quests__list ui3-scroll" aria-label="Lista de missões" data-ui3-part="list"></section>
            <section class="ui3-bag__details" aria-label="Missão selecionada" aria-live="polite" data-ui3-part="detail"></section>`;
        parts = {
            list: body.querySelector("[data-ui3-part='list']"),
            detail: body.querySelector("[data-ui3-part='detail']")
        };
        body.addEventListener("click", onClick);
    }

    function onOpen(options = {}) {
        if (options.questId) state.selected = options.questId;
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3QuestsWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Missões",
            className: "ui3-dialog--medium",
            setup,
            render,
            onOpen,
            getSubtitle: () => {
                const current = questState();
                return `${current.active.length} ${current.active.length === 1 ? "ativa" : "ativas"} · ${current.completed.length} ${current.completed.length === 1 ? "concluída" : "concluídas"}`;
            },
            events: [
                "quest:accepted",
                "quest:objective-updated",
                "quest:finished",
                "quest:tracking-changed",
                "quest:updated",
                "quest:reward-granted",
                "state:restored"
            ]
        });
    }
})(window.Aethra = window.Aethra || {});
