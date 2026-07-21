// EncounterInteractionPass.js - Hero panel compacto, ActionBar por ponteiro e ticker contextual
(function (Aethra) {
    "use strict";

    if (!Aethra?.RenderEngine || !Aethra?.EventBus) return;

    const Render = Aethra.RenderEngine;
    const PANEL_STORE = "aethra.heroPanel.minimized";
    const SECTION_STORE = "aethra.heroPanel.sections";
    const MAX_HIGHLIGHTS = 4;

    const escapeHTML = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const formatNumber = (value) => new Intl.NumberFormat("pt-BR").format(Number(value || 0));

    function readJSON(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return value ?? fallback;
        } catch (_error) {
            return fallback;
        }
    }

    function writeJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (_error) {
            // Persistência opcional.
        }
    }

    function getHeroSidebar() {
        return document.querySelector(".battle-sidebar--hero");
    }

    function getHuntLayout() {
        return document.querySelector(".battle-hunt-layout");
    }

    function applySectionState(section, collapsed) {
        if (!section) return false;
        section.classList.toggle("is-collapsed", collapsed);
        section.dataset.collapsed = collapsed ? "true" : "false";
        section.style.setProperty("min-height", collapsed ? "38px" : "0", "important");
        section.style.setProperty("height", collapsed ? "38px" : "auto", "important");
        section.style.setProperty("max-height", collapsed ? "38px" : "none", "important");

        const heading = section.querySelector(":scope > .hero-hub__accordion-heading");
        heading?.querySelector("[data-hero-section-toggle]")
            ?.setAttribute("aria-expanded", collapsed ? "false" : "true");

        [...section.children].forEach((child) => {
            if (child === heading) return;
            child.hidden = collapsed;
            child.setAttribute("aria-hidden", collapsed ? "true" : "false");
            if (collapsed) {
                child.style.setProperty("display", "none", "important");
            } else {
                child.style.removeProperty("display");
            }
        });
        return true;
    }

    function syncAllSectionStates() {
        const state = readJSON(SECTION_STORE, {});
        document.querySelectorAll(".hero-hub__accordion-section").forEach((section) => {
            const id = section.dataset.heroPanelView;
            const collapsed = typeof state[id] === "boolean"
                ? state[id]
                : section.classList.contains("is-collapsed");
            applySectionState(section, collapsed);
        });
    }

    function setWholeHeroPanelMinimized(minimized, { persist = true } = {}) {
        const sidebar = getHeroSidebar();
        const layout = getHuntLayout();
        if (!sidebar || !layout) return false;

        sidebar.classList.toggle("is-minimized", minimized);
        layout.classList.toggle("is-hero-panel-minimized", minimized);
        sidebar.querySelector("[data-minimize-hero-panel]")
            ?.setAttribute("aria-expanded", minimized ? "false" : "true");
        sidebar.querySelector("[data-expand-hero-panel]")
            ?.setAttribute("aria-hidden", minimized ? "false" : "true");

        if (persist) writeJSON(PANEL_STORE, minimized);
        return true;
    }

    function renderHeroMiniRail() {
        const sidebar = getHeroSidebar();
        if (!sidebar) return false;

        let rail = sidebar.querySelector(".hero-panel-mini-rail");
        if (!rail) {
            rail = document.createElement("aside");
            rail.className = "hero-panel-mini-rail";
            rail.innerHTML = `
                <button type="button" class="hero-panel-mini-rail__expand" data-expand-hero-panel aria-label="Expandir Painel do Herói">▶</button>
                <div class="hero-panel-mini-rail__avatar" aria-hidden="true">A</div>
                <div class="hero-panel-mini-rail__resource is-hp"><i></i></div>
                <div class="hero-panel-mini-rail__resource is-mana"><i></i></div>
                <div class="hero-panel-mini-rail__resource is-vigor"><i></i></div>
                <button type="button" class="hero-panel-mini-rail__inspect" data-open-hero-inspect title="Abrir ficha">?</button>
            `;
            sidebar.appendChild(rail);
        }

        const hero = Aethra.GameState.hero || {};
        const stats = hero.stats || {};
        const hp = Number(hero.hp ?? stats.hp ?? 0);
        const maxHp = Math.max(1, Number(hero.maxHp ?? stats.maxHp ?? hp ?? 1));
        const mana = Number(hero.mana ?? stats.mana ?? 0);
        const maxMana = Math.max(1, Number(hero.maxMana ?? stats.maxMana ?? mana ?? 1));
        const vigor = Number(hero.vigor ?? stats.vigor ?? hero.energy ?? stats.energy ?? 0);
        const maxVigor = Math.max(1, Number(hero.maxVigor ?? stats.maxVigor ?? hero.maxEnergy ?? stats.maxEnergy ?? vigor ?? 1));

        const setFill = (selector, current, max) => {
            const node = rail.querySelector(selector);
            if (!node) return;
            node.style.setProperty("--resource-fill", `${Math.max(0, Math.min(100, (current / max) * 100))}%`);
            node.title = `${formatNumber(current)} / ${formatNumber(max)}`;
        };
        setFill(".is-hp", hp, maxHp);
        setFill(".is-mana", mana, maxMana);
        setFill(".is-vigor", vigor, maxVigor);
        rail.querySelector(".hero-panel-mini-rail__avatar").textContent = String(hero.name || "A").charAt(0).toUpperCase();
        return true;
    }

    function ensureHeroPanelControls() {
        const sidebar = getHeroSidebar();
        const panel = sidebar?.querySelector("[data-hero-hub]");
        if (!sidebar || !panel) return false;

        const tools = panel.querySelector(".hero-hub__header .battle-panel__tools");
        if (tools && !tools.querySelector("[data-minimize-hero-panel]")) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "hero-panel-minimize-button";
            button.dataset.minimizeHeroPanel = "";
            button.setAttribute("aria-label", "Minimizar Painel do Herói");
            button.setAttribute("aria-expanded", "true");
            button.textContent = "◀";
            tools.prepend(button);
        }

        renderHeroMiniRail();
        syncAllSectionStates();
        setWholeHeroPanelMinimized(Boolean(readJSON(PANEL_STORE, false)), { persist: false });
        return true;
    }

    function highlightState() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.encounterHighlights = Array.isArray(Aethra.GameState.ui.encounterHighlights)
            ? Aethra.GameState.ui.encounterHighlights
            : [];
        return Aethra.GameState.ui.encounterHighlights;
    }

    function pushHighlight(entry = {}) {
        const list = highlightState();
        const normalized = {
            id: entry.id || `enc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            createdAt: Date.now(),
            type: entry.type || "system",
            icon: entry.icon || "•",
            title: entry.title || "Atualização",
            detail: entry.detail || "",
            action: entry.action || null
        };
        list.unshift(normalized);
        Aethra.GameState.ui.encounterHighlights = list.slice(0, MAX_HIGHLIGHTS);
        renderEncounterDock();
        return normalized;
    }

    function ensureEncounterDock() {
        const stage = document.querySelector(".battle-stage-panel");
        const arena = stage?.querySelector(".battle-card-arena");
        if (!stage || !arena) return null;

        let dock = stage.querySelector("#encounter-context-dock");
        if (!dock) {
            dock = document.createElement("section");
            dock.id = "encounter-context-dock";
            dock.className = "encounter-context-dock";
            dock.setAttribute("aria-live", "polite");
            arena.insertAdjacentElement("afterend", dock);
        }
        return dock;
    }

    function renderEncounterDock() {
        const dock = ensureEncounterDock();
        if (!dock) return false;
        const entries = highlightState().slice(0, 3);
        const hunt = Aethra.GameState.hunt || {};
        const fallback = {
            type: hunt.isActive ? "exploration" : "system",
            icon: hunt.isActive ? "⌖" : "◇",
            title: hunt.isActive ? "Exploração contínua" : "Nenhuma expedição ativa",
            detail: hunt.isActive
                ? "Combates, eventos e drops aparecerão aqui quando acontecerem."
                : "Abra o Mapa Mundi para escolher uma Hunt.",
            action: hunt.isActive ? null : "map"
        };
        const rows = entries.length ? entries : [fallback];

        dock.innerHTML = `
            <div class="encounter-context-dock__stream">
                ${rows.map((entry) => `
                    <button type="button" class="encounter-context-item is-${escapeHTML(entry.type)}" ${entry.action ? `data-context-action="${escapeHTML(entry.action)}"` : ""}>
                        <span class="encounter-context-item__icon">${escapeHTML(entry.icon)}</span>
                        <span class="encounter-context-item__copy"><strong>${escapeHTML(entry.title)}</strong><small>${escapeHTML(entry.detail)}</small></span>
                    </button>
                `).join("")}
            </div>
            <div class="encounter-context-dock__actions">
                <button type="button" data-context-action="drops">▦ Drops</button>
                <button type="button" data-context-action="combat-log">⚔ Combate</button>
            </div>
        `;
        return true;
    }

    function openDropPanel() {
        const panel = document.querySelector(".battle-panel--drops, .battle-panel--log");
        if (!panel) return false;
        panel.classList.remove("is-drop-pulse");
        requestAnimationFrame(() => panel.classList.add("is-drop-pulse"));
        setTimeout(() => panel.classList.remove("is-drop-pulse"), 1200);
        panel.querySelector("[data-loot-session-tab='stackables']")?.click();
        return true;
    }

    function openCombatLog() {
        const manager = Aethra.WindowManager;
        if (manager?.openWindow) {
            manager.openWindow("combat-log-view", { source: "encounter-dock" });
            return true;
        }
        document.querySelector("[data-open-window='combat-log-view']")?.click();
        return true;
    }

    function resolveContextAction(action) {
        if (action === "drops") return openDropPanel();
        if (action === "combat-log") return openCombatLog();
        if (action === "map") return Aethra.openHuntWorldMap?.();
        if (action === "event") {
            const pending = Aethra.GameState.exploration?.pendingEvent;
            if (pending?.eventId) return Aethra.ExplorationSystem?.resolveEvent?.(pending.eventId, { manual: true });
        }
        return false;
    }

    function skillIdForSlot(slot) {
        const index = Number(slot?.dataset.slotIndex);
        const hero = Aethra.GameState.hero || {};
        const bar = hero.actionBars?.[hero.activeActionBar || 0];
        return Number.isInteger(index) ? bar?.slots?.[index] || null : null;
    }

    function cleanupPointerDrag(bar) {
        const drag = bar?._pointerSkillDrag;
        if (!drag) return;
        drag.ghost?.remove();
        drag.source?.classList.remove("is-dragging");
        bar.querySelectorAll(".is-drag-target").forEach((node) => node.classList.remove("is-drag-target"));
        bar.classList.remove("is-reordering", "is-pointer-reordering");
        bar._pointerSkillDrag = null;
    }

    function startPointerDrag(event, handle, slot, bar) {
        if (event.button !== 0) return;
        const from = Number(slot.dataset.slotIndex);
        if (!Number.isInteger(from) || !skillIdForSlot(slot)) return;

        event.preventDefault();
        handle.setPointerCapture?.(event.pointerId);
        const rect = slot.getBoundingClientRect();
        const ghost = slot.cloneNode(true);
        ghost.classList.add("battle-action-slot--drag-ghost");
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        document.body.appendChild(ghost);

        bar._pointerSkillDrag = {
            pointerId: event.pointerId,
            from,
            source: slot,
            handle,
            ghost,
            target: null,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top
        };
        slot.classList.add("is-dragging");
        bar.classList.add("is-reordering", "is-pointer-reordering");
        ghost.style.transform = `translate3d(${event.clientX - bar._pointerSkillDrag.offsetX}px, ${event.clientY - bar._pointerSkillDrag.offsetY}px, 0)`;
    }

    function movePointerDrag(event, bar) {
        const drag = bar._pointerSkillDrag;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        drag.ghost.style.transform = `translate3d(${event.clientX - drag.offsetX}px, ${event.clientY - drag.offsetY}px, 0)`;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".battle-action-slot");
        bar.querySelectorAll(".is-drag-target").forEach((node) => node.classList.remove("is-drag-target"));
        if (target && target.closest("#skill-action-bar") === bar && target !== drag.source) {
            target.classList.add("is-drag-target");
            drag.target = target;
        } else {
            drag.target = null;
        }
    }

    function endPointerDrag(event, bar) {
        const drag = bar._pointerSkillDrag;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const target = drag.target;
        const from = drag.from;
        const to = Number(target?.dataset.slotIndex);
        cleanupPointerDrag(bar);

        if (!Number.isInteger(to) || from === to) return;
        const moved = Aethra.SkillSystem?.moveSkill?.(from, to);
        if (moved) {
            Aethra.RenderEngine?.renderActionBar?.();
            pushHighlight({
                type: "system",
                icon: "⠿",
                title: "Prioridade alterada",
                detail: `A habilidade foi movida do slot ${from + 1} para o slot ${to + 1}.`,
                action: null
            });
        }
    }

    function ensureAdvancedActionBarDrag() {
        const bar = document.getElementById("skill-action-bar");
        if (!bar) return false;

        bar.querySelectorAll(".battle-action-slot").forEach((slot) => {
            const handle = slot.querySelector(".battle-action-slot__drag-handle");
            if (!handle || handle.dataset.pointerDragBound === "true") return;
            handle.dataset.pointerDragBound = "true";
            handle.tabIndex = 0;
            handle.setAttribute("role", "button");
            handle.setAttribute("aria-label", "Arrastar ou mover esta habilidade");
            handle.draggable = false;

            handle.addEventListener("pointerdown", (event) => startPointerDrag(event, handle, slot, bar));
            handle.addEventListener("pointermove", (event) => movePointerDrag(event, bar));
            handle.addEventListener("pointerup", (event) => endPointerDrag(event, bar));
            handle.addEventListener("pointercancel", () => cleanupPointerDrag(bar));
            handle.addEventListener("keydown", (event) => {
                if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
                event.preventDefault();
                const from = Number(slot.dataset.slotIndex);
                const direction = event.key === "ArrowLeft" ? -1 : 1;
                const to = from + direction;
                if (to < 0 || to > 9) return;
                if (Aethra.SkillSystem?.moveSkill?.(from, to)) {
                    Aethra.RenderEngine?.renderActionBar?.();
                    setTimeout(() => document.querySelector(`.battle-action-slot[data-slot-index='${to}'] .battle-action-slot__drag-handle`)?.focus(), 0);
                }
            });
        });
        return true;
    }

    function bindGlobalControls() {
        if (document.documentElement.dataset.encounterInteractionBound === "true") return;
        document.documentElement.dataset.encounterInteractionBound = "true";

        document.addEventListener("click", (event) => {
            const minimize = event.target.closest("[data-minimize-hero-panel]");
            if (minimize) {
                event.preventDefault();
                setWholeHeroPanelMinimized(true);
                return;
            }
            const expand = event.target.closest("[data-expand-hero-panel]");
            if (expand) {
                event.preventDefault();
                setWholeHeroPanelMinimized(false);
                return;
            }
            const sectionToggle = event.target.closest("[data-hero-section-toggle]");
            if (sectionToggle) {
                const section = sectionToggle.closest(".hero-hub__accordion-section");
                if (!section) return;
                setTimeout(() => {
                    const collapsed = section.classList.contains("is-collapsed");
                    applySectionState(section, collapsed);
                }, 0);
                return;
            }
            const contextAction = event.target.closest("[data-context-action]");
            if (contextAction) {
                event.preventDefault();
                resolveContextAction(contextAction.dataset.contextAction);
            }
        }, true);
    }

    function refreshPass() {
        ensureHeroPanelControls();
        renderHeroMiniRail();
        ensureAdvancedActionBarDrag();
        renderEncounterDock();
    }

    Aethra.EventBus.on("render:battle-cards", renderEncounterDock);

    const originalRenderActionBar = Render.renderActionBar.bind(Render);
    Render.renderActionBar = function (...args) {
        const result = originalRenderActionBar(...args);
        ensureAdvancedActionBarDrag();
        return result;
    };

    const originalRenderAll = Render.renderAll.bind(Render);
    Render.renderAll = function (...args) {
        const result = originalRenderAll(...args);
        refreshPass();
        return result;
    };

    Aethra.EventBus.on("BattleLog", (payload = {}) => {
        const message = String(payload.message || "").trim();
        const type = String(payload.type || "").toLowerCase();
        if (!message) return;
        if (/actionbar reorganizada|prioridade|bônus de skill ativado|roll da build/i.test(message)) return;
        const isCritical = type.includes("critical") || /crítico ativado/i.test(message);
        const isHeal = type.includes("heal") || type.includes("support") || /restaurou|cura/i.test(message);
        const isBlock = type.includes("block") || /bloqueio ativado/i.test(message);
        const isRecharge = type.includes("recharge");
        if (!isCritical && !isHeal && !isBlock && !isRecharge) return;
        pushHighlight({
            type: isHeal ? "heal" : isCritical ? "critical" : isBlock ? "defense" : "combat",
            icon: isHeal ? "✚" : isCritical ? "✦" : isBlock ? "⬡" : "⚔",
            title: isCritical ? "Golpe crítico" : isHeal ? "Recuperação" : isBlock ? "Bloqueio" : "Habilidade recuperada",
            detail: message,
            action: "combat-log"
        });
    });

    Aethra.EventBus.on("hunt:loot-generated", (payload = {}) => {
        const items = Array.isArray(payload.items) ? payload.items : [];
        const names = items.slice(0, 2).map((item) => item.name || item.templateId || item.id).filter(Boolean);
        pushHighlight({
            type: "loot",
            icon: "▦",
            title: "Loot recolhido",
            detail: names.length
                ? `${names.join(", ")}${items.length > 2 ? ` e mais ${items.length - 2}` : ""}`
                : `${formatNumber(payload.lootCount || 0)} item(ns), valor ${formatNumber(payload.lootValue || 0)}.`,
            action: "drops"
        });
    });

    Aethra.EventBus.on("hunt:enemy-defeated", (payload = {}) => {
        pushHighlight({
            type: "victory",
            icon: "✓",
            title: `${payload.name || payload.enemy?.name || "Criatura"} derrotado`,
            detail: `+${formatNumber(payload.xp || 0)} XP · +${formatNumber(payload.gold || 0)} Gold`,
            action: "drops"
        });
    });

    Aethra.EventBus.on("exploration:event-found", (payload = {}) => {
        pushHighlight({
            type: "event",
            icon: payload.icon || "✦",
            title: payload.title || "Evento encontrado",
            detail: payload.description || "Uma interação apareceu durante a Hunt.",
            action: "event"
        });
    });

    Aethra.EventBus.on("hunt:started", () => {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.encounterHighlights = [];
        pushHighlight({
            type: "exploration",
            icon: "⌖",
            title: "Hunt iniciada",
            detail: "O herói continuará explorando até você sair ou trocar de região."
        });
    });

    ["HealthChanged", "ManaChanged", "EnergyChanged", "hunt:tick", "hunt:updated"].forEach((eventName) => {
        Aethra.EventBus.on(eventName, () => renderHeroMiniRail());
    });

    bindGlobalControls();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", refreshPass, { once: true });
    } else {
        refreshPass();
    }
})(window.Aethra);
