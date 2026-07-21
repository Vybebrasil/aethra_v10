// UIManager.js - Camada de sobreposição do Modo Painel/Carta
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.EventBus || !Aethra.UI_Renderer) {
        throw new Error(
            "UIManager.js requer game-core.js e UI_Renderer.js carregados antes deste arquivo."
        );
    }

    const BaseUI = Aethra.UI_Renderer;

    const UIManager = Object.create(BaseUI);

    Object.assign(UIManager, {
        overlayInitialized: false,
        overlayEventsBound: false,
        actionBarLayer: null,
        battleRoot: null,
        layoutObserver: null,
        primaryView: "hunt",

        getBattleMode() {
            return Aethra.SettingsManager?.getBattleMode?.() === "map2d"
                ? "map2d"
                : "cards";
        },

        initOverlay() {
            if (this.overlayInitialized) {
                this.syncBattleOverlay();
                return this.getOverlayState();
            }

            Aethra.WindowManager?.ensureLayerStructure?.();
            this.ensureBattleLayout();
            this.ensureActionBarLayer();
            this.mountActionBarOverlay();
            this.bindOverlayEvents();
            this.observeBattleLayout();
            this.syncBattleOverlay();

            this.overlayInitialized = true;

            const state = this.getOverlayState();
            Aethra.EventBus.emit("UIManagerReady", state);
            Aethra.EventBus.emit("ui:overlay-ready", state);
            return state;
        },

        ensureBattleLayout() {
            const battleMode = this.getBattleMode();
            const cityView = document.getElementById("city-view");
            if (!cityView) return false;

            const hasBattleLayout = Boolean(
                cityView.querySelector("[data-battle-mode-layout]")
            );
            if (!hasBattleLayout) {
                if (battleMode === "map2d") {
                    Aethra.RenderEngine?.activateMap2DPlaceholder?.();
                } else {
                    Aethra.RenderEngine?.activateBattleMode?.();
                }
            } else {
                Aethra.RenderEngine?.syncStageMode?.(battleMode);
            }
            cityView.classList.add("battle-overlay-root");
            cityView.setAttribute(
                "aria-label",
                battleMode === "map2d" ? "Painel de batalha no Mapa 2D" : "Painel de batalha em Cartas táticas"
            );

            const arena = cityView.querySelector(".battle-card-arena");
            const heroCard = document.getElementById("battle-hero-card");
            const enemyCard = document.getElementById("battle-enemy-card");

            if (!arena || !heroCard || !enemyCard) {
                return false;
            }

            arena.dataset.battleCards = "true";
            heroCard.dataset.combatant = "hero";
            enemyCard.dataset.combatant = "enemy";
            this.battleRoot = cityView;
            this.applyPrimaryView();
            return true;
        },

        normalizePrimaryView(view) {
            return view === "city" ? "city" : "hunt";
        },

        setPrimaryView(view, options = {}) {
            const nextView = this.normalizePrimaryView(view);
            const previousView = this.primaryView;

            this.primaryView = nextView;

            Aethra.GameState.ui = Aethra.GameState.ui || {};
            Aethra.GameState.ui.primaryView = nextView;

            this.applyPrimaryView();
            Aethra.RenderEngine?.renderHeroStats?.();

            if (options.emit !== false && previousView !== nextView) {
                Aethra.EventBus.emit("ui:primary-view-changed", {
                    view: nextView,
                    previousView,
                    source: options.source || "ui-manager",
                    timestamp: Date.now()
                });
            }

            return nextView;
        },

        applyPrimaryView() {
            const savedView = Aethra.GameState.ui?.primaryView;
            const activeView = this.normalizePrimaryView(
                savedView || this.primaryView
            );

            this.primaryView = activeView;

            document
                .querySelectorAll("[data-primary-screen]")
                .forEach((screen) => {
                    const isActive = screen.dataset.primaryScreen === activeView;
                    screen.hidden = !isActive;
                    screen.classList.toggle("is-active", isActive);
                    screen.setAttribute("aria-hidden", isActive ? "false" : "true");
                });

            document
                .querySelectorAll("[data-primary-view]")
                .forEach((control) => {
                    const isActive = control.dataset.primaryView === activeView;
                    control.classList.toggle("is-active", isActive);
                    control.setAttribute("aria-pressed", isActive ? "true" : "false");
                });

            document.body.classList.toggle(
                "aethra-primary-view-city",
                activeView === "city"
            );
            document.body.classList.toggle(
                "aethra-primary-view-hunt",
                activeView === "hunt"
            );

            const actionBarLayer = this.ensureActionBarLayer();
            if (actionBarLayer) {
                actionBarLayer.hidden = activeView !== "hunt";
                actionBarLayer.setAttribute(
                    "aria-hidden",
                    activeView === "hunt" ? "false" : "true"
                );
            }

            return activeView;
        },

        startHuntFromUI() {
            const huntSystem = Aethra.HuntSystem;
            if (!huntSystem) return false;

            const select = document.getElementById("hunt-location-select");
            const huntId =
                select?.value ||
                Aethra.GameState.hunt?.huntId ||
                Object.keys(huntSystem.hunts || {})[0] ||
                "whispering_forest";
            const state = Aethra.GameState.hunt || {};
            const running = Boolean(
                state.isActive || huntSystem.config?.isRunning
            );

            this.setPrimaryView("hunt", {
                source: "hunt-launcher"
            });

            if (!running || state.huntId !== huntId) {
                if (running) {
                    huntSystem.stopHunt?.("change-location");
                }

                if (!huntSystem.startHunt?.(huntId)) {
                    return false;
                }
            }

            if (
                !Aethra.GameState.hunt?.currentEnemy &&
                !Aethra.GameState.battle?.isFighting
            ) {
                huntSystem.handleEncounter?.();
            }

            Aethra.RenderEngine?.renderHunt?.();
            Aethra.RenderEngine?.renderCombat?.();
            Aethra.RenderEngine?.renderBattleCards?.();

            return true;
        },

        ensureActionBarLayer() {
            const hudLayer =
                document.getElementById("hud-layer") ||
                Aethra.WindowManager?.layers?.hud;

            if (!hudLayer) return null;

            let layer = document.getElementById("battle-actionbar-layer");

            if (!layer) {
                layer = document.createElement("div");
                layer.id = "battle-actionbar-layer";
                layer.className = "battle-actionbar-overlay";
                layer.setAttribute("aria-label", "ActionBar fixa");
                hudLayer.appendChild(layer);
            }

            this.actionBarLayer = layer;
            return layer;
        },

        mountActionBarOverlay() {
            const layer = this.ensureActionBarLayer();
            const actionPanel = document.querySelector(
                ".battle-panel--actionbar"
            );

            if (!layer || !actionPanel) return false;

            actionPanel.classList.add("is-fixed-actionbar");
            actionPanel.dataset.uiLayer = "hud";

            if (actionPanel.parentElement !== layer) {
                layer.appendChild(actionPanel);
            }

            Aethra.RenderEngine?.renderActionBar?.();
            this.updateSkillUI(layer);
            return true;
        },

        renderBattleCards() {
            if (!this.ensureBattleLayout()) return false;
            return Aethra.RenderEngine?.renderBattleCards?.() !== false;
        },

        syncBattleOverlay() {
            const hasCardLayout = this.ensureBattleLayout();

            if (hasCardLayout) {
                this.mountActionBarOverlay();
                Aethra.RenderEngine?.renderBattleCards?.();
                this.updateSkillUI(this.actionBarLayer || document);
                this.applyPrimaryView();
            } else {
                this.ensureActionBarLayer()?.replaceChildren();
            }

            Aethra.SettingsManager?.syncUI?.();

            document.body.classList.toggle(
                "has-floating-game-window",
                Boolean(
                    Aethra.WindowManager?.activeWindows?.some?.(
                        (windowId) =>
                            !Aethra.WindowManager.isWorldWindow(windowId)
                    )
                )
            );

            return this.getOverlayState();
        },

        bindOverlayEvents() {
            if (this.overlayEventsBound) return;
            this.overlayEventsBound = true;

            document.addEventListener("click", (event) => {
                const heroPanelTab = event.target.closest(
                    "[data-hero-panel-tab]"
                );

                if (heroPanelTab) {
                    event.preventDefault();
                    Aethra.RenderEngine?.setHeroPanelTab?.(
                        heroPanelTab.dataset.heroPanelTab,
                        { source: "hero-panel-navigation" }
                    );
                    return;
                }

                const primaryViewControl = event.target.closest(
                    "[data-primary-view]"
                );

                if (primaryViewControl) {
                    event.preventDefault();
                    Aethra.WindowManager?.closeAll?.({
                        modalOnly: true,
                        source: "primary-view-navigation"
                    });
                    this.setPrimaryView(
                        primaryViewControl.dataset.primaryView,
                        { source: "navigation" }
                    );
                    return;
                }

                const huntControl = event.target.closest("[data-start-hunt]");

                if (huntControl) {
                    event.preventDefault();
                    this.startHuntFromUI();
                    return;
                }

                const resetAnalyzerControl = event.target.closest(
                    "[data-reset-hunt-analyzer]"
                );

                if (resetAnalyzerControl) {
                    event.preventDefault();
                    Aethra.HuntSystem?.resetAnalyzer?.();
                    Aethra.RenderEngine?.renderHunt?.();
                    Aethra.EventBus.emit("BattleLog", {
                        message: "Hunt Analyzer reiniciado.",
                        color: "#f1d17a",
                        type: "system"
                    });
                }
            });

            [
                "render:battle-mode-ready",
                "render:map2d-placeholder-ready",
                "render:battle-mode-changed",
                "settings:battle-mode-changed",
                "render:ready",
                "EngineReady",
                "BattleStarted",
                "BattleUpdated",
                "BattleTick",
                "battle:started",
                "battle:updated",
                "battle:tick",
                "CombatStarted",
                "CombatUpdated",
                "CombatEnded",
                "HeroStatsChanged",
                "hero:stats-changed",
                "resource:changed",
                "inventory:changed",
                "equipment:changed",
                "actionBarChanged",
                "actionbar:changed",
                "hunt:analyzer-reset"
            ].forEach((eventName) => {
                Aethra.EventBus.on(eventName, () => {
                    this.syncBattleOverlay();
                });
            });

            Aethra.EventBus.on("WindowOpened", () => {
                this.syncBattleOverlay();
            });

            Aethra.EventBus.on("WindowClosed", () => {
                this.syncBattleOverlay();
            });
        },

        observeBattleLayout() {
            if (this.layoutObserver || typeof MutationObserver === "undefined") {
                return;
            }

            const cityView = document.getElementById("city-view");
            if (!cityView) return;

            this.layoutObserver = new MutationObserver(() => {
                if (!document.getElementById("battle-actionbar-layer")) {
                    this.ensureActionBarLayer();
                }

                if (
                    document.querySelector(".battle-panel--actionbar") &&
                    !this.actionBarLayer?.contains(
                        document.querySelector(".battle-panel--actionbar")
                    )
                ) {
                    this.mountActionBarOverlay();
                }
            });

            this.layoutObserver.observe(cityView, {
                childList: true,
                subtree: true
            });
        },

        getOverlayState() {
            return {
                initialized: this.overlayInitialized,
                battleMode: this.getBattleMode(),
                primaryView: this.primaryView,
                battleLayout: Boolean(
                    document.querySelector("[data-battle-mode-layout]")
                ),
                heroCard: Boolean(document.getElementById("battle-hero-card")),
                enemyCard: Boolean(document.getElementById("battle-enemy-card")),
                fixedActionBar: Boolean(
                    document
                        .getElementById("battle-actionbar-layer")
                        ?.querySelector(".battle-panel--actionbar")
                ),
                openWindows: [
                    ...(Aethra.WindowManager?.activeWindows || [])
                ]
            };
        }
    });

    Aethra.UIManager = UIManager;

    function startUIManager() {
        UIManager.initOverlay();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startUIManager, {
            once: true
        });
    } else {
        startUIManager();
    }
})(window.Aethra);
