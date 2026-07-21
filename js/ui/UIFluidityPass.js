// UIFluidityPass.js - Visual hierarchy, contextual panels and lightweight feedback.
(function (Aethra) {
    "use strict";

    if (!Aethra?.RenderEngine || !Aethra?.EventBus) return;
    if (Aethra.RenderEngine._uiFluidityPassApplied) return;
    Aethra.RenderEngine._uiFluidityPassApplied = true;

    const Render = Aethra.RenderEngine;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const tabOrder = ["analyzer", "loot", "progression"];
    const panelSelectors = {
        loot: ".battle-panel--log",
        progression: ".battle-panel--progression",
        analyzer: ".battle-panel--hunt"
    };
    const tabLabels = {
        loot: ["▦", "Loot"],
        progression: ["✦", "Progresso"],
        analyzer: ["⌁", "Análise"]
    };
    const counterValues = new Map();
    const counterFrames = new WeakMap();
    let scheduledFrame = null;

    function currentTab() {
        const stateTab = Aethra.GameState.ui?.intelligenceTab;
        if (tabOrder.includes(stateTab)) return stateTab;
        try {
            const saved = window.localStorage.getItem("aethra.interface.intelligence-tab");
            if (tabOrder.includes(saved)) return saved;
        } catch (_error) {
            // Interface preference is optional when storage is unavailable.
        }
        return "analyzer";
    }

    function setCurrentTab(tab, { focus = false } = {}) {
        if (!tabOrder.includes(tab)) return false;
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.intelligenceTab = tab;
        try {
            window.localStorage.setItem("aethra.interface.intelligence-tab", tab);
        } catch (_error) {
            // The tab still works for the current session.
        }

        document.querySelectorAll("[data-intelligence-tab]").forEach((button) => {
            const active = button.dataset.intelligenceTab === tab;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-selected", active ? "true" : "false");
            button.tabIndex = active ? 0 : -1;
            if (active && focus) button.focus({ preventScroll: true });
        });
        document.querySelectorAll("[data-intelligence-panel]").forEach((panel) => {
            const active = panel.dataset.intelligencePanel === tab;
            panel.classList.toggle("is-current", active);
            panel.hidden = !active;
            panel.setAttribute("aria-hidden", active ? "false" : "true");
        });
        return true;
    }

    function panelBadge(tab) {
        if (tab === "loot") {
            const units = document.querySelector('[data-loot-session-tab="stackables"] em');
            const rows = document.querySelectorAll(".session-loot-row").length;
            return String(units?.textContent || rows || 0).replace(/\s+/g, " ").trim();
        }
        if (tab === "progression") {
            return String(document.querySelectorAll(".progression-log-entry").length || 0);
        }
        return Aethra.GameState.hunt?.isActive ? "LIVE" : "—";
    }

    function ensureIntelligenceTabs() {
        const sidebar = document.querySelector(".battle-sidebar--combat");
        if (!sidebar) return false;
        const panels = tabOrder.map((tab) => sidebar.querySelector(panelSelectors[tab]));
        if (panels.some((panel) => !panel)) return false;

        let nav = sidebar.querySelector(":scope > .intelligence-tabs");
        if (!nav) {
            nav = document.createElement("nav");
            nav.className = "intelligence-tabs";
            nav.setAttribute("aria-label", "Informações da expedição");
            nav.setAttribute("role", "tablist");
            sidebar.insertBefore(nav, sidebar.firstElementChild);
        }

        nav.innerHTML = tabOrder.map((tab) => {
            const [icon, label] = tabLabels[tab];
            return `
                <button type="button" role="tab" data-intelligence-tab="${tab}" aria-controls="intelligence-panel-${tab}">
                    <span aria-hidden="true">${icon}</span>
                    <b>${label}</b>
                    <em data-intelligence-badge="${tab}">${panelBadge(tab)}</em>
                </button>
            `;
        }).join("");

        panels.forEach((panel, index) => {
            const tab = tabOrder[index];
            panel.id = `intelligence-panel-${tab}`;
            panel.dataset.intelligencePanel = tab;
            panel.setAttribute("role", "tabpanel");
            panel.setAttribute("aria-labelledby", `intelligence-tab-${tab}`);
            nav.querySelector(`[data-intelligence-tab="${tab}"]`)?.setAttribute("id", `intelligence-tab-${tab}`);
        });
        setCurrentTab(currentTab());
        return true;
    }

    function refreshIntelligenceBadges() {
        tabOrder.forEach((tab) => {
            const badge = document.querySelector(`[data-intelligence-badge="${tab}"]`);
            if (badge) badge.textContent = panelBadge(tab);
        });
    }

    function biomeTone() {
        const hunt = Aethra.GameState.hunt || {};
        const definition = Aethra.HuntSystem?.hunts?.[hunt.huntId] || {};
        const token = [hunt.huntId, definition.id, definition.name, definition.region, definition.biome]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("pt-BR");
        if (/cripta|crypt|tumba|morto|undead|cemit/.test(token)) return "crypt";
        if (/mina|mine|caverna|cave|pedra|rocha/.test(token)) return "cavern";
        if (/gelo|ice|frost|neve|snow/.test(token)) return "frost";
        if (/fogo|fire|lava|vulc/.test(token)) return "ember";
        if (/costa|coast|mar|praia|ocean/.test(token)) return "coast";
        if (/vazio|void|arcane|astral/.test(token)) return "arcane";
        return "forest";
    }

    function enhanceEncounter() {
        const stage = document.querySelector(".battle-stage-panel");
        if (!stage) return false;
        const pending = Aethra.ExplorationSystem?.getSnapshot?.()?.pendingEvent
            || Aethra.GameState.exploration?.pendingEvent
            || null;
        const combat = Boolean(Aethra.GameState.battle?.isFighting);
        document.body.classList.toggle("has-pending-world-event", Boolean(pending));
        document.body.classList.toggle("has-active-combat", combat);
        stage.dataset.biome = biomeTone();
        stage.dataset.encounterState = combat ? "combat" : pending ? "event" : Aethra.GameState.hunt?.isActive ? "exploring" : "idle";

        stage.querySelectorAll(".combatant-card__portrait img").forEach((image) => {
            if (!image.complete || image.naturalWidth <= 0) return;
            image.hidden = false;
            const fallback = image.closest(".combatant-card__portrait")?.querySelector(".combatant-card__fallback");
            if (fallback) fallback.hidden = true;
        });

        document.querySelectorAll(".is-fluid-actionable").forEach((element) => element.classList.remove("is-fluid-actionable"));
        const actionable = pending
            ? document.querySelector("[data-resolve-exploration]")
            : !Aethra.GameState.hunt?.isActive
                ? document.querySelector("[data-open-hunt-map], .hunt-launcher__world-map")
                : null;
        actionable?.classList.add("is-fluid-actionable");
        return true;
    }

    function enhanceHeroPanel() {
        document.querySelectorAll(".hero-attribute").forEach((card) => {
            const raw = card.querySelector(".hero-attribute__copy strong")?.textContent?.trim() || "";
            const numeric = Number(raw.replace("%", "").replace(",", "."));
            card.classList.toggle("is-zero", Number.isFinite(numeric) && numeric === 0);
        });
    }

    function enhanceActionBar() {
        const slots = [...document.querySelectorAll("#skill-action-bar .battle-action-slot")];
        slots.forEach((slot) => slot.classList.remove("is-fluid-overflow"));
        const configure = document.querySelector("#battle-actionbar-layer #open-skill-settings");
        if (configure) {
            const filled = slots.filter((slot) => slot.classList.contains("is-filled")).length;
            configure.title = `Configurar barras e habilidades · ${filled}/${slots.length} slots preenchidos`;
        }
    }

    function parseCounter(text) {
        const normalized = String(text || "").trim();
        if (!/^-?\d{1,3}(?:\.\d{3})*$|^-?\d+$/.test(normalized)) return null;
        const value = Number(normalized.replaceAll(".", ""));
        return Number.isFinite(value) ? value : null;
    }

    function animateCounters() {
        const selectors = [
            "[data-currency]",
            ".loot-session-kpis strong",
            ".progression-log-summary strong",
            ".expedition-live-stats strong",
            ".analyzer-primary-kpis strong"
        ];
        selectors.forEach((selector, selectorIndex) => {
            document.querySelectorAll(selector).forEach((element, index) => {
                if (element.dataset.fluidCounting === "true") return;
                const finalText = element.textContent.trim();
                const next = parseCounter(finalText);
                if (next === null) return;
                const key = element.id || `${selectorIndex}:${index}`;
                const previous = counterValues.get(key);
                counterValues.set(key, next);
                if (previous === undefined || previous === next || reducedMotion.matches) return;

                const oldFrame = counterFrames.get(element);
                if (oldFrame) cancelAnimationFrame(oldFrame);
                const startedAt = performance.now();
                const duration = 260;
                element.dataset.fluidCounting = "true";
                const tick = (now) => {
                    const progress = Math.min(1, (now - startedAt) / duration);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    const value = Math.round(previous + (next - previous) * eased);
                    element.textContent = new Intl.NumberFormat("pt-BR").format(value);
                    if (progress < 1) {
                        counterFrames.set(element, requestAnimationFrame(tick));
                    } else {
                        element.textContent = finalText;
                        delete element.dataset.fluidCounting;
                        counterFrames.delete(element);
                    }
                };
                counterFrames.set(element, requestAnimationFrame(tick));
            });
        });
    }

    function enhanceAll() {
        document.body.classList.add("aethra-fluid-ui");
        ensureIntelligenceTabs();
        refreshIntelligenceBadges();
        enhanceEncounter();
        enhanceHeroPanel();
        enhanceActionBar();
        animateCounters();
    }

    function scheduleEnhance() {
        if (scheduledFrame !== null) return;
        scheduledFrame = requestAnimationFrame(() => {
            scheduledFrame = null;
            enhanceAll();
        });
    }

    function flashTarget(payload = {}) {
        if (reducedMotion.matches) return;
        const target = payload.side === "hero"
            ? document.getElementById("battle-enemy-card")
            : document.getElementById("battle-hero-card");
        if (!target) return;
        target.classList.remove("is-fluid-hit", "is-fluid-critical");
        void target.offsetWidth;
        target.classList.add(payload.isCrit ? "is-fluid-critical" : "is-fluid-hit");
        window.setTimeout(() => target.classList.remove("is-fluid-hit", "is-fluid-critical"), 360);
    }

    function flyLoot(payload = {}) {
        if (reducedMotion.matches || Number(payload.lootCount || 0) <= 0) return;
        const source = document.getElementById("battle-enemy-card") || document.querySelector(".battle-stage-panel");
        const target = document.querySelector('[data-intelligence-tab="loot"]');
        if (!source || !target) return;
        const from = source.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        const count = Math.min(3, Math.max(1, Number(payload.lootCount || 1)));

        for (let index = 0; index < count; index += 1) {
            const orb = document.createElement("span");
            orb.className = "fluid-loot-orb";
            orb.textContent = index === 0 ? "◆" : "·";
            const startX = from.left + from.width * 0.72 + index * 5;
            const startY = from.top + from.height * 0.48 + index * 3;
            const endX = to.left + to.width * 0.5;
            const endY = to.top + to.height * 0.5;
            orb.style.left = `${startX}px`;
            orb.style.top = `${startY}px`;
            orb.style.setProperty("--loot-x", `${endX - startX}px`);
            orb.style.setProperty("--loot-y", `${endY - startY}px`);
            orb.style.setProperty("--loot-delay", `${index * 45}ms`);
            document.body.appendChild(orb);
            orb.addEventListener("animationend", () => orb.remove(), { once: true });
            window.setTimeout(() => orb.remove(), 950);
        }
        target.classList.add("has-incoming-loot");
        window.setTimeout(() => target.classList.remove("has-incoming-loot"), 820);
    }

    document.addEventListener("click", (event) => {
        const tab = event.target.closest("[data-intelligence-tab]");
        if (tab) setCurrentTab(tab.dataset.intelligenceTab);
    });

    document.addEventListener("keydown", (event) => {
        const tab = event.target.closest?.("[data-intelligence-tab]");
        if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const currentIndex = tabOrder.indexOf(tab.dataset.intelligenceTab);
        const nextIndex = event.key === "Home"
            ? 0
            : event.key === "End"
                ? tabOrder.length - 1
                : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabOrder.length) % tabOrder.length;
        setCurrentTab(tabOrder[nextIndex], { focus: true });
    });

    ["renderAll", "renderBattleCards", "renderActionBar", "renderHeroStats", "renderHunt", "renderExplorationFeed"]
        .forEach((methodName) => {
            const original = Render[methodName]?.bind(Render);
            if (!original) return;
            Render[methodName] = function (...args) {
                const result = original(...args);
                scheduleEnhance();
                return result;
            };
        });

    [
        "render:battle-mode-ready",
        "hunt:started",
        "hunt:updated",
        "hunt:ended",
        "hunt:enemy-defeated",
        "exploration:updated",
        "exploration:event-found",
        "exploration:event-resolved",
        "xpChanged",
        "profession:xpChanged",
        "BattleStarted",
        "BattleEnded",
        "EnemyEncountered",
        "EnemyDefeated"
    ].forEach((eventName) => Aethra.EventBus.on(eventName, scheduleEnhance));

    Aethra.EventBus.on("DamageDealt", (payload) => {
        flashTarget(payload);
        scheduleEnhance();
    });
    Aethra.EventBus.on("hunt:loot-generated", (payload) => {
        flyLoot(payload);
        scheduleEnhance();
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => window.setTimeout(scheduleEnhance, 0), { once: true });
    } else {
        window.setTimeout(scheduleEnhance, 0);
    }
})(window.Aethra);
