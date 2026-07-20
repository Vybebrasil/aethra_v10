(function (Aethra) {
    "use strict";
    if (!Aethra?.RenderEngine || !Aethra?.EventBus) return;

    const Render = Aethra.RenderEngine;
    const UI = Aethra.UI_Renderer;
    const STORE = "aethra.heroPanel.sections";
    const fmt = (v) => new Intl.NumberFormat("pt-BR").format(Number(v || 0));
    const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v || 0)));
    const time = (s) => {
        s = Math.max(0, Math.floor(Number(s || 0)));
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
        if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
        if (m) return `${m}m ${String(r).padStart(2, "0")}s`;
        return `${r}s`;
    };
    const sectionInfo = {
        overview: ["✦", "Atributos", false],
        equipment: ["♟", "Equipamentos", true],
        backpack: ["▦", "Backpack", true],
        skills: ["↑", "Skills", true]
    };

    function readSections() {
        try { return JSON.parse(localStorage.getItem(STORE) || "{}"); }
        catch (_e) { return {}; }
    }
    function saveSections(value) {
        try { localStorage.setItem(STORE, JSON.stringify(value)); }
        catch (_e) { /* optional */ }
    }

    Render.ensureClassicHeroPanel = function () {
        const hub = document.querySelector("[data-hero-hub]");
        if (!hub) return false;
        hub.classList.add("hero-hub--classic");
        const tabs = hub.querySelector(".hero-hub__tabs");
        if (tabs) tabs.hidden = true;
        const views = hub.querySelector(".hero-hub__views");
        if (!views) return false;
        views.classList.add("hero-hub__accordion");
        const state = readSections();

        views.querySelectorAll("[data-hero-panel-view]").forEach((section) => {
            const id = section.dataset.heroPanelView;
            const [icon, label, defaultClosed] = sectionInfo[id] || ["•", id, false];
            section.hidden = false;
            section.classList.add("hero-hub__accordion-section", "is-active");
            const heading = section.querySelector(".hero-hub__section-heading");
            if (!heading) return;
            heading.classList.add("hero-hub__accordion-heading");
            let toggle = heading.querySelector("[data-hero-section-toggle]");
            if (!toggle) {
                toggle = document.createElement("button");
                toggle.type = "button";
                toggle.className = "hero-hub__collapse-toggle";
                toggle.dataset.heroSectionToggle = id;
                toggle.innerHTML = `<span>${icon}</span><b>${esc(label)}</b><i>⌄</i>`;
                toggle.setAttribute("aria-label", `Expandir ou recolher ${label}`);
                heading.prepend(toggle);
                toggle.addEventListener("click", (event) => {
                    event.stopPropagation();
                    const closed = !section.classList.contains("is-collapsed");
                    section.classList.toggle("is-collapsed", closed);
                    toggle.setAttribute("aria-expanded", closed ? "false" : "true");
                    const next = readSections(); next[id] = closed; saveSections(next);
                });
            }
            const closed = typeof state[id] === "boolean" ? state[id] : defaultClosed;
            section.classList.toggle("is-collapsed", closed);
            toggle.setAttribute("aria-expanded", closed ? "false" : "true");
        });

        const tools = hub.querySelector(".hero-hub__header .battle-panel__tools");
        if (tools && !tools.querySelector("[data-toggle-hero-sections]")) {
            const all = document.createElement("button");
            all.type = "button";
            all.className = "hero-hub__toggle-all";
            all.dataset.toggleHeroSections = "";
            all.textContent = "▤";
            all.title = "Expandir ou recolher todos os blocos";
            tools.prepend(all);
            all.addEventListener("click", () => {
                const sections = [...views.querySelectorAll(".hero-hub__accordion-section")];
                const expand = sections.some((item) => item.classList.contains("is-collapsed"));
                const next = readSections();
                sections.forEach((item) => {
                    item.classList.toggle("is-collapsed", !expand);
                    item.querySelector("[data-hero-section-toggle]")?.setAttribute("aria-expanded", expand ? "true" : "false");
                    next[item.dataset.heroPanelView] = !expand;
                });
                saveSections(next);
            });
        }
        this.syncClassicHeroCounts();
        return true;
    };

    Render.syncClassicHeroCounts = function () {
        const counts = {
            overview: "6",
            equipment: document.getElementById("hero-equipment-tab-count")?.textContent || "0/6",
            backpack: document.getElementById("hero-backpack-tab-count")?.textContent || "0",
            skills: document.getElementById("hero-skills-tab-count")?.textContent || "0"
        };
        document.querySelectorAll("[data-hero-panel-view]").forEach((section) => {
            const heading = section.querySelector(".hero-hub__accordion-heading");
            if (!heading) return;
            let badge = heading.querySelector(".hero-hub__section-count");
            if (!badge) { badge = document.createElement("span"); badge.className = "hero-hub__section-count"; heading.appendChild(badge); }
            badge.textContent = counts[section.dataset.heroPanelView] || "";
        });
    };

    Render.enableActionBarDrag = function () {
        const bar = document.getElementById("skill-action-bar");
        if (!bar) return false;
        bar.querySelectorAll(".battle-action-slot").forEach((slot) => {
            const index = Number(slot.dataset.slotIndex);
            const filled = slot.classList.contains("is-filled");
            slot.draggable = filled;
            if (filled && !slot.querySelector(".battle-action-slot__drag-handle")) {
                const handle = document.createElement("span");
                handle.className = "battle-action-slot__drag-handle";
                handle.textContent = "⠿";
                handle.title = "Arraste para trocar a ordem";
                slot.appendChild(handle);
            }
            slot.ondragstart = (event) => {
                if (!filled) return event.preventDefault();
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/x-aethra-skill-slot", String(index));
                slot.classList.add("is-dragging"); bar.classList.add("is-reordering");
            };
            slot.ondragend = () => {
                slot.classList.remove("is-dragging"); bar.classList.remove("is-reordering");
                bar.querySelectorAll(".is-drag-target").forEach((node) => node.classList.remove("is-drag-target"));
            };
            slot.ondragover = (event) => { event.preventDefault(); slot.classList.add("is-drag-target"); };
            slot.ondragleave = () => slot.classList.remove("is-drag-target");
            slot.ondrop = (event) => {
                event.preventDefault(); slot.classList.remove("is-drag-target");
                const from = Number(event.dataTransfer.getData("application/x-aethra-skill-slot"));
                const to = Number(slot.dataset.slotIndex);
                if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return;
                if (Aethra.SkillSystem?.moveSkill?.(from, to)) {
                    Aethra.EventBus.emit("BattleLog", { message: `ActionBar reorganizada: slot ${from + 1} → ${to + 1}.`, color: "#78d8ff", type: "system" });
                }
            };
        });
        return true;
    };

    function activityList() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.worldActivity = Array.isArray(Aethra.GameState.ui.worldActivity) ? Aethra.GameState.ui.worldActivity : [];
        return Aethra.GameState.ui.worldActivity;
    }
    function addActivity(entry) {
        const list = activityList();
        list.unshift({ id: entry.id || `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now(), icon: "•", tone: "system", ...entry });
        Aethra.GameState.ui.worldActivity = list.slice(0, 30);
    }
    function ambient(hunt) {
        if (!hunt.isActive) return ["⌖", "Expedição aguardando", "Escolha uma Hunt para iniciar o ciclo contínuo de exploração."];
        if (hunt.currentEnemy || Aethra.GameState.battle?.isFighting) return ["⚔", "Combate em andamento", "O herói concentra-se na ameaça encontrada nesta região."];
        const phases = [
            ["◌", "Lendo rastros", "Pegadas recentes indicam movimento entre as árvores."],
            ["❧", "Vasculhando recursos", "O herói observa plantas, pedras e pontos de coleta."],
            ["⌖", "Explorando a região", "A caçada continua enquanto novos pontos de interesse são encontrados."],
            ["✦", "Sentindo energia antiga", "Sinais incomuns podem indicar um evento raro."],
            ["▣", "Procurando esconderijos", "Ruínas e raízes podem ocultar recompensas."]
        ];
        return phases[Math.floor(Number(hunt.elapsedTicks || 0) / 2) % phases.length];
    }

    Render.renderExplorationFeed = function () {
        const root = document.getElementById("exploration-feed");
        if (!root) return false;
        const snap = Aethra.ExplorationSystem?.getSnapshot?.() || { events: [], totals: {}, pendingEvent: null };
        const hunt = Aethra.GameState.hunt || {};
        const pending = snap.pendingEvent;
        const totals = snap.totals || {};
        const regionName = Aethra.HuntSystem?.hunts?.[hunt.huntId]?.name || "Nenhuma Hunt ativa";
        const [ambientIcon, ambientTitle, ambientText] = ambient(hunt);
        const entries = [
            ...activityList(),
            ...(snap.events || []).map((e) => ({ id: e.id || e.eventId, createdAt: new Date(e.createdAt).getTime(), icon: e.icon, title: e.title, detail: e.detail, tone: e.tone || "event" }))
        ]
            .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
            .filter((e, i, a) => a.findIndex((x) => x.id === e.id) === i)
            .slice(0, 14);

        const panel = root.closest('.battle-panel--exploration');
        const eyebrow = panel?.querySelector('.exploration-panel__header small');
        const heading = panel?.querySelector('.exploration-panel__header h2');
        const liveState = panel?.querySelector('.exploration-panel__live');
        if (eyebrow) eyebrow.textContent = hunt.isActive ? 'EVENTOS DA HUNT' : 'EXPLORAÇÃO E EVENTOS';
        if (heading) heading.textContent = hunt.isActive ? regionName : 'Atividade da Expedição';
        if (liveState) {
            liveState.classList.toggle('is-paused', !hunt.isActive);
            liveState.innerHTML = `<i></i>${hunt.isActive ? 'HUNT ATIVA' : 'AGUARDANDO'}`;
        }

        const latestEntry = entries[0] || null;
        const emptyMessage = hunt.isActive
            ? 'A região está sendo explorada. Combates, recursos e descobertas aparecerão aqui conforme acontecerem.'
            : 'Escolha uma Hunt no Mapa Mundi para começar a receber eventos.';
        const routeState = !hunt.isActive
            ? 'Aguardando rota'
            : pending
                ? 'Decisão pendente'
                : (Aethra.GameState.battle?.isFighting || hunt.currentEnemy)
                    ? 'Combate em andamento'
                    : 'Exploração contínua';
        const routeHint = !hunt.isActive
            ? 'Abra o mapa e selecione a Hunt desejada.'
            : pending
                ? 'Um evento apareceu e pode render bônus imediatos.'
                : latestEntry?.detail || 'O herói segue em loop na região até você parar a Hunt.';

        root.innerHTML = `
            <div class="journey-dashboard journey-dashboard--continuous">
                <section class="journey-focus ${pending ? `is-${esc(pending.category)}` : 'is-ambient'}">
                    <span class="journey-focus__icon">${esc(pending?.icon || ambientIcon)}</span>
                    <div class="journey-focus__copy"><small>${pending ? 'DECISÃO DE EXPLORAÇÃO' : (hunt.isActive ? 'ATIVIDADE ATUAL' : 'EXPEDIÇÃO')}</small><strong>${esc(pending?.title || ambientTitle)}</strong><p>${esc(pending?.description || ambientText)}</p></div>
                    ${pending ? `<button type="button" data-resolve-exploration="${esc(pending.eventId)}">${esc(pending.actionLabel)}</button>` : (hunt.isActive ? `<span class="journey-focus__pulse"><i></i>explorando</span>` : `<button type="button" data-open-hunt-map>Abrir Mapa</button>`)}
                </section>
                <section class="journey-overview">
                    <article class="journey-overview__card"><small>Região</small><strong>${esc(regionName)}</strong><span>${hunt.isActive ? 'Loop contínuo ativo' : 'Sem expedição em curso'}</span></article>
                    <article class="journey-overview__card"><small>Status</small><strong>${esc(routeState)}</strong><span>${esc(routeHint)}</span></article>
                    <article class="journey-overview__card"><small>Último destaque</small><strong>${esc(latestEntry?.title || 'Nenhum evento ainda')}</strong><span>${esc(latestEntry?.detail || emptyMessage)}</span></article>
                </section>
                <section class="journey-stream">
                    <header><strong>Eventos da região</strong><span>mais recente primeiro</span></header>
                    <div class="journey-stream__list">${entries.length ? entries.map((e) => `<article class="journey-entry is-${esc(e.tone || 'system')}"><span>${esc(e.icon || '•')}</span><div><strong>${esc(e.title || 'Evento')}</strong><small>${esc(e.detail || '')}</small></div><time>${new Date(e.createdAt || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time></article>`).join('') : `<div class="journey-stream__empty">${esc(emptyMessage)}</div>`}</div>
                </section>
                <aside class="journey-stats"><span><small>Eventos</small><strong>${fmt(totals.events)}</strong></span><span><small>Recursos</small><strong>${fmt(totals.resources)}</strong></span><span><small>Skill XP</small><strong>${fmt(totals.skillXP)}</strong></span><span><small>Raros</small><strong>${fmt(totals.rareEvents)}</strong></span></aside>
            </div>`;
        root.querySelector('[data-resolve-exploration]')?.addEventListener('click', (event) => Aethra.ExplorationSystem?.resolveEvent?.(event.currentTarget.dataset.resolveExploration, { manual: true }));
        root.querySelector('[data-open-hunt-map]')?.addEventListener('click', () => Aethra.openHuntWorldMap?.());
        return true;
    };

    function telemetry() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.huntTelemetry = Aethra.GameState.ui.huntTelemetry || { damage: 0, damageTaken: 0, healing: 0, criticals: 0, attacks: 0 };
        return Aethra.GameState.ui.huntTelemetry;
    }

    Render.renderHunt = function () {
        const root = document.getElementById("hunt-display");
        if (!root) return false;
        const hunt = Aethra.GameState.hunt || {}, totals = Aethra.ExplorationSystem?.getSnapshot?.().totals || {}, combat = telemetry();
        const seconds = Math.max(0, Number(hunt.elapsedMs || 0) / 1000), hours = Math.max(seconds / 3600, 1 / 3600);
        const kills = Number(hunt.kills || 0), xp = Number(hunt.xp || 0), gold = Number(hunt.gold || 0), loot = Number(hunt.lootValue || 0), costs = Number(hunt.supplyCost || 0), profit = gold + loot - costs;
        const definition = Aethra.HuntSystem?.hunts?.[hunt.huntId] || null;
        const name = definition?.name || "Nenhuma hunt ativa";
        const focus = definition?.focus || null;
        const modifiers = definition?.modifiers || {};
        const focusProfession = focus?.skill ? Aethra.ProfessionSystem?.getState?.(focus.skill) : null;
        const focusMultiplier = focus?.skill ? Number(modifiers.professionXp?.[focus.skill] ?? 1) : Number(modifiers.combatXp ?? modifiers.gold ?? 1);
        root.innerHTML = `<section class="hunt-analyzer hunt-analyzer--command">
            <header class="hunt-analyzer__session"><div><small>${hunt.isActive ? "SESSÃO AO VIVO" : "SESSÃO PARADA"}</small><strong>${esc(name)}</strong></div><time>${time(seconds)}</time></header>
            ${focus ? `<div class="hunt-analyzer__focus"><span>${esc(focus.icon || "⌖")}</span><div><small>FOCO ATIVO</small><strong>${esc(focus.name || focus.id)}</strong></div><em>${focusProfession ? `Skill ${fmt(focusProfession.level || 1)} · ` : ""}${Number(focusMultiplier || 1).toFixed(2)}x</em></div>` : ""}
            <div class="analyzer-primary-kpis"><article class="is-xp"><small>XP/h</small><strong>${fmt(Math.floor(xp / hours))}</strong><span>${fmt(xp)} XP</span></article><article class="is-profit"><small>Profit/h</small><strong>${fmt(Math.floor(profit / hours))}</strong><span>${fmt(profit)} líquido</span></article><article class="is-kill"><small>Kills</small><strong>${fmt(kills)}</strong><span>${kills ? `${time(seconds / kills)} / kill` : "sem abates"}</span></article></div>
            <div class="analyzer-section-title"><strong>Combate</strong><span>automático</span></div>
            <div class="analyzer-detail-grid"><span><small>DPS médio</small><b>${seconds ? (combat.damage / seconds).toFixed(1) : "0.0"}</b></span><span><small>Dano causado</small><b>${fmt(combat.damage)}</b></span><span><small>Dano recebido</small><b>${fmt(combat.damageTaken)}</b></span><span><small>Críticos</small><b>${fmt(combat.criticals)}</b></span></div>
            <div class="analyzer-section-title"><strong>Mundo e economia</strong><span>${fmt(totals.events)} eventos</span></div>
            <div class="analyzer-economy-list"><span><i>◆</i><b>Loot</b><em>${fmt(loot)}</em></span><span><i>●</i><b>Gold</b><em>${fmt(gold)}</em></span><span><i>✦</i><b>Skill XP</b><em>${fmt(totals.skillXP)}</em></span><span><i>▦</i><b>Recursos</b><em>${fmt(totals.resources)}</em></span><span><i>▣</i><b>Custos</b><em>${fmt(costs)}</em></span><span><i>◇</i><b>Raros</b><em>${fmt(totals.rareEvents)}</em></span></div>
            <button type="button" class="hunt-analyzer__reset" data-reset-hunt-analyzer>Resetar medição</button>
        </section>`;
        root.querySelector("[data-reset-hunt-analyzer]")?.addEventListener("click", () => { Aethra.GameState.ui.huntTelemetry = { damage: 0, damageTaken: 0, healing: 0, criticals: 0, attacks: 0 }; Aethra.HuntSystem?.resetAnalyzer?.(); });
        return true;
    };

    const originalActivate = Render.activateBattleMode.bind(Render);
    Render.activateBattleMode = function (...args) { const result = originalActivate(...args); this.ensureClassicHeroPanel(); return result; };
    const originalAll = Render.renderAll.bind(Render);
    Render.renderAll = function (...args) { const result = originalAll(...args); this.ensureClassicHeroPanel(); this.enableActionBarDrag(); this.renderExplorationFeed(); this.renderHunt(); return result; };
    const originalBar = Render.renderActionBar.bind(Render);
    Render.renderActionBar = function (...args) { const result = originalBar(...args); this.enableActionBarDrag(); return result; };
    ["renderBattleEquipment", "renderBattleInventory", "renderHeroSkillProgression"].forEach((name) => {
        if (typeof Render[name] !== "function") return;
        const original = Render[name].bind(Render);
        Render[name] = function (...args) { const result = original(...args); this.ensureClassicHeroPanel(); this.syncClassicHeroCounts(); return result; };
    });

    if (UI?.showFloatingCombatText) {
        UI.showFloatingCombatText = function (payload = {}) {
            if (!payload.text) return false;
            const hero = Aethra.GameState.hero || {};
            const targetHero = ["player", "hero", hero.id].includes(payload.targetId);
            const card = document.getElementById(targetHero ? "battle-hero-card" : "battle-enemy-card");
            const anchor = card?.querySelector(".combatant-card__portrait") || card;
            if (!anchor) return false;
            const node = document.createElement("div");
            node.className = `combat-card-float combat-card-float--${payload.type || "damage"}`;
            node.textContent = payload.type === "miss" ? "ERROU" : payload.type === "critical" ? `-${fmt(payload.amount)} CRIT!` : `-${fmt(payload.amount)}`;
            anchor.appendChild(node); requestAnimationFrame(() => node.classList.add("is-visible"));
            const remove = () => node.remove(); node.addEventListener("animationend", remove, { once: true }); setTimeout(remove, 1300); return node;
        };
    }

    Aethra.EventBus.on("hunt:started", () => { Aethra.GameState.ui.huntTelemetry = { damage: 0, damageTaken: 0, healing: 0, criticals: 0, attacks: 0 }; Aethra.GameState.ui.worldActivity = []; addActivity({ icon: "⌖", title: "A expedição começou", detail: "A rota está sendo analisada em busca de ameaças e recursos." }); });
    Aethra.EventBus.on("hunt:encountered", (e = {}) => { addActivity({ icon: "⚔", title: `${e.name || "Criatura"} encontrado`, detail: "A ameaça bloqueou o avanço da expedição.", tone: "danger" }); Render.renderExplorationFeed(); });
    Aethra.EventBus.on("hunt:enemy-defeated", (p = {}) => { addActivity({ icon: "✓", title: "Ameaça eliminada", detail: `+${fmt(p.xp)} XP · +${fmt(p.gold)} gold · ${fmt(p.lootCount)} item(ns).`, tone: "success" }); Render.renderExplorationFeed(); });
    Aethra.EventBus.on("hunt:loot-generated", (p = {}) => { if (Number(p.lootCount || 0)) addActivity({ icon: "▦", title: "Loot recolhido", detail: `${fmt(p.lootCount)} item(ns), valor ${fmt(p.lootValue)}.`, tone: "loot" }); });
    Aethra.EventBus.on("profession:rankUp", (p = {}) => { const d = Aethra.ProfessionSystem?.professions?.[p.professionId]; addActivity({ icon: "↑", title: `${d?.name || "Skill"} subiu`, detail: `Novo nível: ${fmt(p.level)}.`, tone: "level" }); });
    Aethra.EventBus.on("DamageDealt", (p = {}) => { const t = telemetry(); t.attacks += 1; if (p.side === "hero") { t.damage += Number(p.amount || 0); if (p.isCrit) t.criticals += 1; } else t.damageTaken += Number(p.amount || 0); Render.renderHunt(); });
    ["hunt:tick", "hunt:updated", "exploration:updated", "exploration:event-found", "exploration:event-resolved", "profession:xpChanged"].forEach((event) => Aethra.EventBus.on(event, () => { Render.renderExplorationFeed(); Render.renderHunt(); Render.syncClassicHeroCounts(); }));
})(window.Aethra);
