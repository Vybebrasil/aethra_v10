/*
 * Ui3MentorWindow.js — Mestra Ilyra, mentora de ofícios, na UI 3.0
 * (fase 5.2).
 *
 * Assume "profession-mentor-view" pelo Ui3Window/WindowManager (a Cidade
 * abre por Ui3Navigation.openMentor).
 *   leitura   ProfessionSystem (rota inicial, benefício, especialização),
 *             QuestSystem (missão da rota, missão acompanhada, orientação)
 *   comandos  Ui3Navigation.openSpecialization e followQuestGuidance
 */
(function initUi3MentorWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "profession-mentor-view";
    const PORTRAIT = "assets/entities/npc_guildmaster.png";
    const ROUTE_STATUS = Object.freeze({
        completed: { label: "Concluída", className: "ui3-tag--gold" },
        active: { label: "Em andamento", className: "" }
    });

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

    function snapshot() {
        const professions = Aethra.ProfessionSystem;
        const professionId = Aethra.GameState?.hero?.introProfessionId || null;
        const perk = professions?.getIntroPerk?.(professionId) || null;
        const routeQuest = professionId ? Aethra.QuestSystem?.getQuest?.(`intro_profession_${professionId}`) || null : null;
        const trackedQuest = Aethra.QuestSystem?.getTrackedQuest?.() || null;
        return {
            professionId,
            profession: professions?.professions?.[professionId] || null,
            path: professions?.introPaths?.[professionId] || null,
            perk,
            perkUnlocked: Boolean(perk && professions?.hasPerk?.(professionId, perk.id)),
            specialization: professionId ? professions?.getSpecializationState?.(professionId) || null : null,
            routeQuest,
            pendingObjective: routeQuest?.objectives?.find((objective) => !objective.completed) || null,
            guidance: trackedQuest ? Aethra.QuestSystem?.getGuidance?.(trackedQuest) || null : null
        };
    }

    function stepHTML({ eyebrow, title, body, done = false }) {
        const K = kit();
        return `<article class="ui3-city-card ui3-mentor__step${done ? " is-done" : ""}">
                <span class="ui3-eyebrow">${K.esc(eyebrow)}</span>
                <strong class="ui3-service__title">${done ? `<span class="ui3-text-ok" aria-hidden="true">✓ </span>` : ""}${K.esc(title)}</strong>
                <p class="ui3-caption">${K.esc(body)}</p>
            </article>`;
    }

    function render() {
        const K = kit();
        const view = snapshot();
        const status = ROUTE_STATUS[view.routeQuest?.status] || { label: "Preparação", className: "" };
        const objective = view.pendingObjective;
        const lesson = stepHTML({
            eyebrow: "Primeira lição",
            title: objective?.label || view.path?.objective || "Conclua seus primeiros passos em Aethra",
            body: objective
                ? `${K.formatNumber(objective.progress)}/${K.formatNumber(objective.required)} concluído`
                : view.routeQuest?.status === "completed" ? "Lição concluída." : "Ilyra liberará esta etapa no momento certo.",
            done: view.routeQuest?.status === "completed"
        });
        const perk = stepHTML({
            eyebrow: "Benefício permanente",
            title: view.perk?.name || "Benefício da rota",
            body: view.perk?.description || "Conclua a jornada introdutória para desbloquear.",
            done: view.perkUnlocked
        });
        const spec = view.specialization;
        const longTerm = spec ? stepHTML({
            eyebrow: "Progressão de longo prazo",
            title: spec.branch?.name || `Especialização no nível ${spec.unlockLevel}`,
            body: spec.branch
                ? `Próximo pulso de maestria no nível ${spec.nextMasteryLevel}.`
                : `Você está no nível ${spec.level}. Conheça os dois caminhos antes de decidir.`,
            done: Boolean(spec.branch)
        }) : "";
        const actions = [
            spec ? K.button({ label: "Ver árvore do ofício", attributes: { "data-ui3-mentor-tree": view.professionId } }) : "",
            view.guidance ? K.button({ label: view.guidance.actionLabel || "Seguir orientação", variant: "primary", attributes: { "data-ui3-mentor-guidance": "" } }) : ""
        ].join("");
        patch(parts.body, `<header class="ui3-mentor__intro">
                <img class="ui3-service__portrait" src="${PORTRAIT}" alt="" draggable="false">
                <p>Seu ofício não limita o herói. Ele dá direção para a primeira descoberta.</p>
            </header>
            <section class="ui3-city-card">
                <div class="ui3-row-between"><span class="ui3-eyebrow">Sua rota inicial</span><span class="ui3-tag ${status.className}">${K.esc(status.label)}</span></div>
                <h2 class="ui3-service__title">${K.esc(view.profession?.icon || "✦")} ${K.esc(view.path?.title || "Caminho ainda não escolhido")}</h2>
                <p>${K.esc(view.path?.summary || "Crie um personagem e escolha um ofício para receber uma jornada dirigida.")}</p>
            </section>
            <div class="ui3-mentor__steps">${lesson}${perk}${longTerm}</div>
            <footer class="ui3-mentor__footer">
                <p class="ui3-caption">${K.esc(view.guidance?.detail || "Continue explorando Aethra e volte quando precisar de direção.")}</p>
                ${actions ? `<div class="ui3-expedition__row">${actions}</div>` : ""}
            </footer>`);
    }

    function onClick(event) {
        const tree = event.target.closest("[data-ui3-mentor-tree]");
        if (tree) return Aethra.Ui3Navigation?.openSpecialization?.(tree.dataset.ui3MentorTree, { source: "ui3-mentor" });
        if (event.target.closest("[data-ui3-mentor-guidance]")) {
            const view = snapshot();
            Aethra.WindowManager?.closeWindow?.(WINDOW_ID, { source: "ui3-mentor-guidance" });
            return view.guidance ? Aethra.Ui3Navigation?.followQuestGuidance?.(view.guidance, { source: "ui3-mentor" }) : false;
        }
        return undefined;
    }

    function setup(body) {
        body.classList.add("ui3-options");
        body.innerHTML = `<div class="ui3-options__body ui3-scroll" data-ui3-part="body"></div>`;
        parts = { body: body.querySelector("[data-ui3-part='body']") };
        body.addEventListener("click", onClick);
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3MentorWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Mestra Ilyra",
            className: "ui3-dialog--medium",
            setup,
            render,
            getSubtitle: () => "Mentora de ofícios",
            events: ["quest:updated", "quest:tracking-changed", "quest:finished", "quest:objective-updated", "profession:perk-unlocked", "profession:specialization-chosen", "profession:rankUp"]
        });
    }
})(window.Aethra = window.Aethra || {});
