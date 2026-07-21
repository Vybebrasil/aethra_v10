// UIStabilityPass.js - Final UI authority for compact, readable, non-overlapping HUD.
(function (Aethra) {
    "use strict";

    if (!Aethra?.RenderEngine || !Aethra?.EventBus) return;
    if (Aethra.RenderEngine._uiStabilityPassApplied) return;
    Aethra.RenderEngine._uiStabilityPassApplied = true;

    const Render = Aethra.RenderEngine;
    const esc = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    const fmt = (value) => new Intl.NumberFormat("pt-BR").format(Number(value || 0));

    function getEntries(pending = null) {
        const activities = Array.isArray(Aethra.GameState.ui?.worldActivity)
            ? Aethra.GameState.ui.worldActivity
            : [];
        const exploration = Aethra.ExplorationSystem?.getSnapshot?.() || { events: [] };
        const events = (exploration.events || []).map((entry) => ({
            id: entry.id || entry.eventId,
            createdAt: new Date(entry.createdAt || Date.now()).getTime(),
            icon: entry.icon || "•",
            title: entry.title || "Evento",
            detail: entry.detail || entry.description || "",
            tone: entry.tone || entry.category || "event"
        }));

        const pendingId = String(pending?.eventId || pending?.id || "");
        const pendingTitle = String(pending?.title || "").trim().toLocaleLowerCase("pt-BR");

        return [...activities, ...events]
            .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
            .filter((entry, index, list) => list.findIndex((item) => item.id === entry.id) === index)
            .filter((entry) => {
                if (!pending) return true;
                const entryId = String(entry?.id || entry?.eventId || "");
                const entryTitle = String(entry?.title || "").trim().toLocaleLowerCase("pt-BR");
                if (pendingId && entryId === pendingId) return false;
                return !pendingTitle || entryTitle !== pendingTitle;
            })
            .slice(0, 8);
    }

    function getAmbient(hunt, pending) {
        if (pending) {
            return {
                icon: pending.icon || "✦",
                kicker: "DECISÃO DE EXPLORAÇÃO",
                title: pending.title || "Evento encontrado",
                detail: pending.description || "Uma interação apareceu durante a Hunt.",
                action: pending.actionLabel || "Interagir"
            };
        }
        if (!hunt.isActive) {
            return {
                icon: "⌖",
                kicker: "PRÓXIMA JORNADA",
                title: "Escolha uma Hunt ou Expedição",
                detail: "Abra o mapa para selecionar farm focado ou conteúdo de exploração.",
                action: "Abrir Mapa"
            };
        }
        if (hunt.currentEnemy || Aethra.GameState.battle?.isFighting) {
            return {
                icon: "⚔",
                kicker: "ATIVIDADE ATUAL",
                title: "Combate em andamento",
                detail: "O herói está enfrentando a ameaça atual enquanto o loop da Hunt continua.",
                action: null
            };
        }
        return {
            icon: "◌",
            kicker: "ATIVIDADE ATUAL",
            title: "Explorando a região",
            detail: "O herói segue em loop até você trocar de Hunt, sair ou voltar para a cidade.",
            action: null
        };
    }

    Render.renderExplorationFeed = function () {
        const root = document.getElementById("exploration-feed");
        if (!root) return false;

        const hunt = Aethra.GameState.hunt || {};
        const snapshot = Aethra.ExplorationSystem?.getSnapshot?.() || {
            events: [],
            totals: {},
            pendingEvent: null
        };
        const pending = snapshot.pendingEvent || Aethra.GameState.exploration?.pendingEvent || null;
        const totals = snapshot.totals || {};
        const entries = getEntries(pending);
        const region = Aethra.HuntSystem?.hunts?.[hunt.huntId];
        const regionName = region?.name || "Nenhuma Hunt ativa";
        const ambient = getAmbient(hunt, pending);
        const mode = hunt.mode === "hunt" ? "HUNT FOCADA" : "EXPEDIÇÃO";

        const panel = root.closest(".battle-panel--exploration");
        const eyebrow = panel?.querySelector(".exploration-panel__header small");
        const title = panel?.querySelector(".exploration-panel__header h2");
        const live = panel?.querySelector(".exploration-panel__live");

        if (eyebrow) eyebrow.textContent = hunt.isActive ? mode : "EXPLORAÇÃO E EVENTOS";
        if (title) title.textContent = hunt.isActive ? regionName : "Atividade da Jornada";
        if (live) {
            live.classList.toggle("is-paused", !hunt.isActive);
            live.innerHTML = `<i></i>${hunt.isActive ? "ATIVA" : "AGUARDANDO"}`;
        }

        root.innerHTML = `
            <div class="expedition-live-layout">
                <section class="expedition-live-main">
                    ${pending ? "" : `<article class="expedition-current-card">
                        <span class="expedition-current-card__icon">${esc(ambient.icon)}</span>
                        <div class="expedition-current-card__copy">
                            <small>${esc(ambient.kicker)}</small>
                            <strong>${esc(ambient.title)}</strong>
                            <p>${esc(ambient.detail)}</p>
                        </div>
                        ${!hunt.isActive ? `
                            <button type="button" class="expedition-current-card__action" data-stable-open-map>${esc(ambient.action)}</button>
                        ` : `
                            <span class="expedition-current-card__state">LOOP ATIVO</span>
                        `}
                    </article>`}

                    <div class="expedition-event-stream">
                        ${entries.length ? entries.map((entry) => `
                            <article class="expedition-event-row is-${esc(entry.tone || "system")}">
                                <span>${esc(entry.icon || "•")}</span>
                                <div>
                                    <strong>${esc(entry.title || "Evento")}</strong>
                                    <small>${esc(entry.detail || "")}</small>
                                </div>
                                <time>${new Date(entry.createdAt || Date.now()).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                            </article>
                        `).join("") : `
                            <div class="expedition-event-empty">
                                ${hunt.isActive
                                    ? "A jornada está ativa. Combates, loot e descobertas aparecerão aqui."
                                    : "Selecione uma Hunt ou Expedição para iniciar o loop."}
                            </div>
                        `}
                    </div>
                </section>

                <aside class="expedition-live-stats" aria-label="Resumo da exploração">
                    <span><small>Eventos</small><strong>${fmt(totals.events)}</strong></span>
                    <span><small>Recursos</small><strong>${fmt(totals.resources)}</strong></span>
                    <span><small>Skill XP</small><strong>${fmt(totals.skillXP)}</strong></span>
                    <span><small>Raros</small><strong>${fmt(totals.rareEvents)}</strong></span>
                </aside>
            </div>
        `;

        root.querySelector("[data-stable-resolve-event]")?.addEventListener("click", (event) => {
            Aethra.ExplorationSystem?.resolveEvent?.(
                event.currentTarget.dataset.stableResolveEvent,
                { manual: true }
            );
        });
        root.querySelector("[data-stable-open-map]")?.addEventListener("click", () => {
            Aethra.openHuntWorldMap?.();
        });
        return true;
    };

    function syncContextTitles() {
        const mode = Aethra.GameState.hunt?.mode === "hunt" ? "hunt" : "expedition";
        const lootTitle = document.querySelector(".battle-panel--log .battle-panel__header h2");
        const lootKicker = document.querySelector(".battle-panel--log .battle-panel__header small");
        if (lootTitle) lootTitle.textContent = mode === "hunt" ? "Loot da Hunt" : "Loot da Expedição";
        if (lootKicker) lootKicker.textContent = "Acumulados e itens individualizados";

        const sidebar = document.querySelector(".battle-sidebar--combat");
        sidebar?.querySelectorAll(":scope > .battle-panel").forEach((panel) => {
            panel.classList.add("is-stability-managed");
        });
    }

    function stabilizeEncounterDock() {
        const dock = document.getElementById("encounter-context-dock");
        if (!dock) return;
        const items = [...dock.querySelectorAll(".encounter-context-item")];
        items.forEach((item, index) => {
            item.hidden = index > 0;
            item.setAttribute("aria-hidden", index > 0 ? "true" : "false");
        });
    }

    function stabilizeHeroSections() {
        document.querySelectorAll(".hero-hub__accordion-section.is-collapsed").forEach((section) => {
            section.style.setProperty("height", "40px", "important");
            section.style.setProperty("min-height", "40px", "important");
            section.style.setProperty("max-height", "40px", "important");
        });
    }


    function clampFloatingWindow(windowId) {
        const element = document.getElementById(windowId);
        if (
            !element ||
            element.classList.contains("hidden") ||
            Aethra.WindowManager?.isWorldWindow?.(windowId)
        ) return false;

        const viewportPadding = 8;
        const safeTop = Aethra.WindowManager?.getSafeTopOffset?.() || 64;
        const maxWidth = Math.max(320, window.innerWidth - viewportPadding * 2);
        const maxHeight = Math.max(240, window.innerHeight - safeTop - viewportPadding);
        const preferredSizes = {
            "inventory-view": { width: 780, height: 680 },
            "skills-view": { width: 900, height: maxHeight },
            "combat-inspect-view": { width: 720, height: Math.min(620, maxHeight) },
            "hunt-world-map-view": { width: Math.min(1040, maxWidth), height: Math.min(720, maxHeight) }
        };
        const preferred = preferredSizes[windowId];
        if (preferred) {
            element.style.setProperty("width", `${Math.min(preferred.width, maxWidth)}px`, "important");
            element.style.setProperty("height", `${Math.min(preferred.height, maxHeight)}px`, "important");
            element.style.setProperty("max-height", `${maxHeight}px`, "important");
        }

        let rect = element.getBoundingClientRect();

        if (rect.width > maxWidth) {
            element.style.setProperty("width", `${maxWidth}px`, "important");
        }
        if (rect.height > maxHeight) {
            element.style.setProperty("height", `${maxHeight}px`, "important");
            element.style.setProperty("max-height", `${maxHeight}px`, "important");
        }

        rect = element.getBoundingClientRect();
        const left = Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - rect.width - viewportPadding));
        const top = Math.max(safeTop, Math.min(rect.top, window.innerHeight - rect.height - viewportPadding));
        element.style.setProperty("left", `${Math.round(left)}px`, "important");
        element.style.setProperty("top", `${Math.round(top)}px`, "important");
        element.style.setProperty("right", "auto", "important");
        element.style.setProperty("bottom", "auto", "important");
        return true;
    }

    function releaseWorldWindowConstraints() {
        const worldWindowIds = Aethra.WindowManager?.config?.worldWindowIds || [];
        worldWindowIds.forEach((windowId) => {
            const element = document.getElementById(windowId);
            if (!element) return;
            [
                "width",
                "height",
                "max-height",
                "left",
                "top",
                "right",
                "bottom",
                "inset",
                "transform"
            ].forEach((property) => element.style.removeProperty(property));
            delete element.dataset.floatingPositioned;
        });
    }

    function hideActiveTooltip() {
        Aethra.TooltipManager?.hide?.();
    }

    function stabilizeAll() {
        releaseWorldWindowConstraints();
        syncContextTitles();
        stabilizeEncounterDock();
        stabilizeHeroSections();
        Render.renderExplorationFeed();
    }

    Aethra.EventBus.on("window:opened", (payload = {}) => {
        requestAnimationFrame(() => {
            clampFloatingWindow(payload.id);
            hideActiveTooltip();
        });
    });

    window.addEventListener("resize", () => {
        releaseWorldWindowConstraints();
        Aethra.WindowManager?.activeWindows?.forEach?.((windowId) => clampFloatingWindow(windowId));
    });

    document.addEventListener("click", (event) => {
        if (event.target.closest(".aethra-navbar, [data-primary-view], [data-open-window], [data-close-window]")) {
            hideActiveTooltip();
        }
    }, true);

    const originalRenderAll = Render.renderAll.bind(Render);
    Render.renderAll = function (...args) {
        const result = originalRenderAll(...args);
        stabilizeAll();
        return result;
    };

    Aethra.EventBus.on("render:battle-cards", () => {
        stabilizeEncounterDock();
        syncContextTitles();
    });

    const originalHunt = Render.renderHunt?.bind(Render);
    if (originalHunt) {
        Render.renderHunt = function (...args) {
            const result = originalHunt(...args);
            syncContextTitles();
            return result;
        };
    }

    [
        "hunt:started",
        "hunt:updated",
        "hunt:ended",
        "hunt:enemy-defeated",
        "exploration:updated",
        "exploration:event-found",
        "exploration:event-resolved",
        "BattleStarted",
        "BattleEnded",
        "EnemyEncountered",
        "EnemyDefeated"
    ].forEach((eventName) => {
        Aethra.EventBus.on(eventName, () => {
            requestAnimationFrame(() => {
                syncContextTitles();
                stabilizeEncounterDock();
                Render.renderExplorationFeed();
            });
        });
    });

    function init() {
        stabilizeAll();
    }

    // Clique em card de maestria → abre o Livro de Habilidade
    document.addEventListener("click", (event) => {
        const card = event.target.closest("[data-discipline-id]");
        if (!card) return;
        const disciplineId = card.dataset.disciplineId;
        if (!disciplineId) return;
        Aethra.WindowManager?.openWindow?.("discipline-guide-view", {
            source: "skill-card-click",
            disciplineId
        });
        Aethra.RenderEngine?.renderDisciplineGuide?.(disciplineId);
    });

    // Alternador de Modo Palco: 🗺 Mapa 2D vs 🃏 Cartas
    document.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-set-stage-mode]");
        if (!btn) return;
        const mode = btn.dataset.setStageMode;
        if (!Aethra.SettingsManager?.isValidBattleMode?.(mode)) return;

        Aethra.SettingsManager.setBattleMode(mode, {
            source: "central-stage-toggle"
        });
        
        const mapRoot = document.getElementById("tilemap-canvas-root");
        const cardsRoot = document.getElementById("battle-card-arena-container");
        const titleEl = document.getElementById("central-stage-mode-title");
        const allBtns = document.querySelectorAll("[data-set-stage-mode]");

        allBtns.forEach((b) => {
            const isSelected = b.dataset.setStageMode === mode;
            b.classList.toggle("is-active", isSelected);
            b.style.background = isSelected ? "rgba(91,175,200,0.15)" : "rgba(6,14,20,0.6)";
            b.style.borderColor = isSelected ? "rgba(91,175,200,0.4)" : "rgba(91,139,162,0.25)";
            b.style.color = isSelected ? "#79c9e8" : "#6a8894";
        });

        if (mode === "map2d") {
            if (mapRoot) mapRoot.hidden = false;
            if (cardsRoot) cardsRoot.hidden = true;
            if (titleEl) titleEl.textContent = "Palco 2D em Tempo Real";
            Aethra.TileMapCanvas?.start?.();
        } else if (mode === "cards") {
            if (mapRoot) mapRoot.hidden = true;
            if (cardsRoot) cardsRoot.hidden = false;
            if (titleEl) titleEl.textContent = "Combate em Cartas Táticas";
            Aethra.RenderEngine?.renderBattleHeroCard?.();
            Aethra.RenderEngine?.renderBattleEnemyCard?.();
        }
    });

    // Botão "Novo Personagem" → volta ao Lobby (seleção/criação/deleção de personagens)
    document.addEventListener("click", (event) => {
        if (!event.target.closest("[data-new-character]")) return;
        const confirmed = window.confirm(
            "Tem certeza? Você será levado à seleção de personagens. O progresso do herói atual está salvo no slot ativo."
        );
        if (!confirmed) return;
        Aethra.WindowManager?.closeAll?.();
        // Navegar ao Lobby em vez de criar diretamente
        window.setTimeout(() => {
            Aethra.LobbyUI?.open?.();
        }, 100);
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0), { once: true });
    } else {
        setTimeout(init, 0);
    }
})(window.Aethra);
