/*
 * Ui3CityScreen.js — Cidade da UI 3.0 (fase 4).
 *
 * Hub de preparação: resumo do herói, serviços da vila e o próximo passo
 * da missão acompanhada. Só apresentação:
 *   leitura   GameState.hero (só lê), QuestSystem, DisciplineSystem,
 *             ProfessionSystem
 *   comandos  WindowManager (janelas), ProfessionWorkshopUI.open,
 *             EntityManager.interactWithEntity (mentora), UIManager
 *             (Hunt), RenderEngine.handleQuestGuidance/handleDisciplineGuidance
 *             (roteador de objetivos, reaproveitado até a fase 5)
 */
(function initUi3CityScreen(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const SCREEN_ID = "city";
    const REFRESH_MS = 1000;
    const DEFAULT_CAPACITY = 40;

    const SERVICES = Object.freeze([
        {
            id: "merchant",
            portrait: "assets/entities/npc_idle.png",
            eyebrow: "Comércio",
            title: "Mercador da Vila",
            body: "Compre suprimentos e venda o que trouxe das caçadas.",
            action: "Abrir loja",
            command: { window: "npc-shop-view" }
        },
        {
            id: "mentor",
            portrait: "assets/entities/npc_guildmaster.png",
            eyebrow: "Mentora de ofícios",
            title: "Mestra Ilyra",
            body: "Receba orientação para transformar sua escolha inicial em um caminho de progressão.",
            action: "Conversar sobre ofícios",
            command: { npc: "profession_mentor" }
        },
        {
            id: "bag",
            symbol: "bag",
            eyebrow: "Preparação",
            title: "Mochila e Equipamento",
            body: "Troque peças, compare atributos e use consumíveis.",
            action: "Abrir mochila",
            command: { window: "inventory-view" }
        },
        {
            id: "skills",
            symbol: "layers",
            eyebrow: "Treinamento",
            title: "Mestre de Habilidades",
            body: "Monte a barra de ações e ajuste prioridades e automação.",
            action: "Configurar habilidades",
            command: { window: "skills-view", options: { tab: "actionbar" } }
        },
        {
            id: "forge",
            symbol: "hammer",
            eyebrow: "Produção · metal",
            title: "Forja da Cidade",
            body: "Refine minério e produza armas e armaduras de placa.",
            action: "Abrir forja",
            command: { workshop: "blacksmithing" }
        },
        {
            id: "tannery",
            symbol: "hide",
            eyebrow: "Produção · couro",
            title: "Curtume da Cidade",
            body: "Trate peles e confeccione equipamentos leves de couro.",
            action: "Abrir curtume",
            command: { workshop: "leatherworking" }
        },
        {
            id: "alchemy",
            symbol: "flask",
            eyebrow: "Produção · suprimentos",
            title: "Laboratório de Alquimia",
            body: "Destile ervas e prepare poções de Vida, Mana ou Vigor.",
            action: "Abrir laboratório",
            command: { workshop: "alchemy" }
        },
        {
            id: "bosses",
            symbol: "skull",
            eyebrow: "Desafio do capítulo · nível 10",
            title: "Mural de Chefes",
            body: "Consulte os grandes alvos, requisitos e recompensas.",
            action: "Abrir mural",
            command: { bosses: true }
        }
    ]);

    let screen = null;
    let parts = {};
    let timer = null;
    let frame = null;
    const rendered = new WeakMap();

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

    function hero() {
        return Aethra.GameState?.hero || {};
    }

    /* ---------------------------------------------------------------
       Leitura
       --------------------------------------------------------------- */

    // Mesmo texto que a cidade clássica mostra para a mentora.
    function mentorCopy() {
        const professionId = hero().introProfessionId;
        const path = Aethra.ProfessionSystem?.introPaths?.[professionId] || null;
        const perk = Aethra.ProfessionSystem?.getIntroPerk?.(professionId) || null;
        const mentorQuest = Aethra.QuestSystem?.getQuest?.("tutorial_profession_mentor");
        const routeQuest = professionId ? Aethra.QuestSystem?.getQuest?.(`intro_profession_${professionId}`) : null;
        const isObjective = mentorQuest?.status === "active"
            && mentorQuest.objectives?.some((objective) => objective.type === "TalkToNPC" && !objective.completed);
        const perkUnlocked = Boolean(perk && Aethra.ProfessionSystem?.hasPerk?.(professionId, perk.id));
        return {
            highlight: Boolean(isObjective),
            eyebrow: isObjective
                ? "Objetivo atual · fale comigo"
                : perkUnlocked
                    ? "Benefício permanente conquistado"
                    : path ? `Rota: ${path.title}` : "Mentora de ofícios",
            body: perkUnlocked
                ? `${perk.name}: ${perk.description}`
                : routeQuest?.status === "active"
                    ? `${path?.objective || "Pratique seu ofício"}. Ilyra continua acompanhando seu progresso.`
                    : path
                        ? `Sua primeira lição será ${String(path.objective || "").toLocaleLowerCase("pt-BR")}.`
                        : null,
            action: isObjective ? "Falar com Mestra Ilyra" : "Conversar sobre ofícios"
        };
    }

    function trackedQuest() {
        const quest = Aethra.QuestSystem?.getTrackedQuest?.() || null;
        const guidance = quest ? Aethra.QuestSystem?.getGuidance?.(quest) : null;
        const progress = quest ? Aethra.QuestSystem?.getProgress?.(quest) : null;
        return quest && guidance ? { quest, guidance, progress: progress || { percent: 0 } } : null;
    }

    /* ---------------------------------------------------------------
       Renderização
       --------------------------------------------------------------- */

    function headerHTML() {
        const K = kit();
        const current = hero();
        const bagCount = Array.isArray(current.bag) ? current.bag.filter(Boolean).length : 0;
        const capacity = Math.max(bagCount, number(current.bagCapacity, DEFAULT_CAPACITY));
        const hpPercent = Math.round((number(current.hp) / Math.max(1, number(current.maxHp, 1))) * 100);
        return `<div class="ui3-city__title">
                <span class="ui3-eyebrow">Vila de Aethra · zona segura</span>
                <h1 class="ui3-display">Cidade</h1>
                <p class="ui3-caption">Prepare equipamento, visite os mestres e organize o herói antes da próxima caçada.</p>
            </div>
            <div class="ui3-city__kpis">
                ${K.kpi({ label: "Ouro", value: K.formatNumber(current.gold) })}
                ${K.kpi({ label: "Mochila", value: `${K.formatNumber(bagCount)}/${K.formatNumber(capacity)}`, tone: bagCount >= capacity ? "negative" : "" })}
                ${K.kpi({ label: "Vida", value: `${hpPercent}%`, tone: hpPercent < 70 ? "negative" : "positive" })}
            </div>
            ${K.button({ label: "Ir para a Hunt", variant: "primary", attributes: { "data-ui3-city-hunt": "" } })}`;
    }

    function serviceHTML(service) {
        const K = kit();
        const mentor = service.id === "mentor" ? mentorCopy() : null;
        const eyebrow = mentor?.eyebrow || service.eyebrow;
        const body = mentor?.body || service.body;
        const action = mentor?.action || service.action;
        const visual = service.portrait
            ? `<img class="ui3-service__portrait" src="${K.esc(service.portrait)}" alt="" draggable="false">`
            : `<span class="ui3-service__icon">${K.icon(service.symbol, 28)}</span>`;
        return `<article class="ui3-service${mentor?.highlight ? " is-objective" : ""}">
                <div class="ui3-service__visual">${visual}</div>
                <div class="ui3-service__text">
                    <span class="ui3-eyebrow">${K.esc(eyebrow)}</span>
                    <h2 class="ui3-service__title">${K.esc(service.title)}</h2>
                    <p>${K.esc(body)}</p>
                </div>
                ${K.button({ label: action, variant: mentor?.highlight ? "primary" : "secondary", attributes: { "data-ui3-city-service": service.id } })}
            </article>`;
    }

    function progressBar(percent, label) {
        const value = Math.max(0, Math.min(100, number(percent)));
        return `<div class="ui3-progress ui3-progress--gold" role="meter" aria-label="${kit().esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value.toFixed(0)}"><div style="width:${value.toFixed(1)}%"></div></div>`;
    }

    function guidanceHTML() {
        const K = kit();
        const tracked = trackedQuest();
        const focus = Aethra.DisciplineSystem?.getFocusedGuidance?.() || null;
        const questState = Aethra.QuestSystem?.getState?.() || { active: [], completed: [] };
        const activeCount = (questState.active || []).length;
        const questBlock = tracked
            ? `<section class="ui3-city-card">
                    <div class="ui3-row-between"><span class="ui3-eyebrow">Próximo passo</span><strong>${K.formatNumber(tracked.progress.percent)}%</strong></div>
                    <h2 class="ui3-service__title">${K.esc(tracked.quest.title)}</h2>
                    <p class="ui3-city-card__objective">${K.esc(tracked.guidance.objective?.label || "")} <strong>${K.formatNumber(tracked.guidance.objective?.progress)}/${K.formatNumber(tracked.guidance.objective?.required)}</strong></p>
                    ${tracked.guidance.detail ? `<p class="ui3-caption">${K.esc(tracked.guidance.detail)}</p>` : ""}
                    ${progressBar(tracked.progress.percent, `Progresso de ${tracked.quest.title}`)}
                    <div class="ui3-expedition__row">
                        ${K.button({ label: tracked.guidance.actionLabel || "Continuar", variant: "primary", attributes: { "data-ui3-city-quest-action": "" } })}
                        ${K.button({ label: "Detalhes", attributes: { "data-ui3-city-quests": "" } })}
                    </div>
                </section>`
            : `<section class="ui3-city-card">
                    <span class="ui3-eyebrow">Próximo passo</span>
                    <p class="ui3-empty">Nenhuma missão acompanhada. Escolha uma em Missões.</p>
                    ${K.button({ label: "Abrir missões", attributes: { "data-ui3-city-quests": "" } })}
                </section>`;
        const focusContract = focus?.contract?.active ? focus.contract : null;
        const focusPercent = focusContract?.progress?.percent ?? focus?.percent ?? 0;
        const focusBlock = focus
            ? `<section class="ui3-city-card">
                    <div class="ui3-row-between"><span class="ui3-eyebrow">${focusContract ? "Contrato de foco" : "Habilidade em foco"}</span><strong>${focusContract ? `${K.formatNumber(focusPercent)}%` : `Nv ${K.formatNumber(focus.level)}`}</strong></div>
                    <h2 class="ui3-service__title">${K.esc(focusContract?.title || focus.title || focus.name)}</h2>
                    ${focus.detail ? `<p class="ui3-caption">${K.esc(focus.detail)}</p>` : ""}
                    ${progressBar(focusPercent, "Progresso do foco")}
                    ${K.button({ label: focus.actionLabel || "Treinar", attributes: { "data-ui3-city-focus-action": "" } })}
                </section>`
            : "";
        return `${questBlock}${focusBlock}
            <p class="ui3-caption">${K.formatNumber(activeCount)} ${activeCount === 1 ? "missão ativa" : "missões ativas"} · ${K.formatNumber((questState.completed || []).length)} concluídas</p>`;
    }

    function render() {
        if (!screen || screen.hidden || !kit()) return false;
        patch(parts.header, headerHTML());
        patch(parts.services, SERVICES.map(serviceHTML).join(""));
        patch(parts.guidance, guidanceHTML());
        return true;
    }

    function scheduleRender() {
        if (frame !== null || !screen || screen.hidden) return;
        frame = requestAnimationFrame(() => {
            frame = null;
            render();
        });
    }

    /* ---------------------------------------------------------------
       Comandos
       --------------------------------------------------------------- */

    function runService(id) {
        const service = SERVICES.find((entry) => entry.id === id);
        const command = service?.command || {};
        if (command.window) return Aethra.WindowManager?.openWindow?.(command.window, { source: "ui3-city", ...(command.options || {}) });
        if (command.workshop) return Aethra.ProfessionWorkshopUI?.open?.(command.workshop, null, { source: "ui3-city" });
        if (command.bosses) return Aethra.RenderEngine?.openBossesHall?.({ source: "ui3-city" });
        if (command.npc) {
            const interaction = Aethra.EntityManager?.interactWithEntity?.(command.npc, { source: "ui3-city" });
            if (interaction && command.npc === "profession_mentor") Aethra.RenderEngine?.openProfessionMentor?.();
            return interaction;
        }
        return false;
    }

    function onClick(event) {
        const target = event.target;
        if (target.closest("[data-ui3-city-hunt]")) return Aethra.UIManager?.setPrimaryView?.("hunt", { source: "ui3-city" });
        const service = target.closest("[data-ui3-city-service]");
        if (service) return runService(service.dataset.ui3CityService);
        if (target.closest("[data-ui3-city-quests]")) return Aethra.WindowManager?.openWindow?.("quests-view", { source: "ui3-city" });
        if (target.closest("[data-ui3-city-quest-action]")) {
            const tracked = trackedQuest();
            return tracked ? Aethra.RenderEngine?.handleQuestGuidance?.(tracked.guidance) : false;
        }
        if (target.closest("[data-ui3-city-focus-action]")) {
            const focus = Aethra.DisciplineSystem?.getFocusedGuidance?.();
            return focus ? Aethra.RenderEngine?.handleDisciplineGuidance?.(focus) : false;
        }
        return undefined;
    }

    /* ---------------------------------------------------------------
       Montagem e ciclo de vida
       --------------------------------------------------------------- */

    function buildScreen(root) {
        const element = document.createElement("section");
        element.className = "ui3-city";
        element.dataset.ui3Screen = SCREEN_ID;
        element.dataset.ui3Covers = "world";
        element.setAttribute("aria-label", "Cidade");
        element.hidden = true;
        element.innerHTML = `<header class="ui3-city__header" data-ui3-part="header"></header>
            <div class="ui3-city__body">
                <div class="ui3-city__services" aria-label="Serviços da vila" data-ui3-part="services"></div>
                <aside class="ui3-city__guidance" aria-label="Próximo passo" data-ui3-part="guidance"></aside>
            </div>`;
        element.addEventListener("click", onClick);
        root.appendChild(element);
        const part = (name) => element.querySelector(`[data-ui3-part="${name}"]`);
        parts = { header: part("header"), services: part("services"), guidance: part("guidance") };
        return element;
    }

    function ensureScreen() {
        const root = Aethra.Ui3Shell?.root;
        if (!root) return null;
        if (!screen || !root.contains(screen)) screen = buildScreen(root);
        return screen;
    }

    function currentView() {
        return Aethra.UIManager?.primaryView || Aethra.GameState?.ui?.primaryView || "hunt";
    }

    function sync() {
        const visible = Boolean(Aethra.Ui3Shell?.canShowGame?.()) && currentView() === "city";
        if (!visible && !screen) return false;
        ensureScreen();
        if (!screen) return false;
        screen.hidden = !visible;
        if (visible) {
            render();
            if (!timer) timer = window.setInterval(render, REFRESH_MS);
        } else if (timer) {
            window.clearInterval(timer);
            timer = null;
        }
        Aethra.Ui3Shell?.refresh?.();
        return visible;
    }

    ["ui3:version-applied", "ui3:screens-changed", "ui:primary-view-changed", "lobby:exited", "character:created", "state:restored", "save:loaded", "engine:ready"]
        .forEach((eventName) => Aethra.EventBus.on(eventName, () => {
            sync();
            window.setTimeout(sync, 0);
        }));
    [
        "quest:accepted",
        "quest:objective-updated",
        "quest:finished",
        "quest:tracking-changed",
        "quest:updated",
        "discipline:focus-changed",
        "skill:xp-changed",
        "goldChanged",
        "inventory:changed",
        "profession:perk-unlocked"
    ].forEach((eventName) => Aethra.EventBus.on(eventName, scheduleRender));

    Aethra.Ui3CityScreen = {
        sync,
        render,
        isVisible: () => Boolean(screen && !screen.hidden)
    };
})(window.Aethra = window.Aethra || {});
