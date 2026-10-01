// UIManager.js — vista principal do jogo: "hunt" (expedição) ou "city".
// Sistemas (BattleSystem, ColiseumSystem) e a UI 3.0 trocam a vista por
// setPrimaryView; a escolha fica em GameState.ui.primaryView (vai no save)
// e é avisada por "ui:primary-view-changed".
(function initUIManager(Aethra) {
    "use strict";

    if (!Aethra?.EventBus || !Aethra?.GameState) {
        throw new Error("UIManager.js requer game-core.js carregado antes deste arquivo.");
    }

    const VIEWS = Object.freeze(["hunt", "city"]);

    function normalize(view) {
        return view === "city" ? "city" : "hunt";
    }

    const UIManager = {
        views: VIEWS,
        primaryView: normalize(Aethra.GameState.ui?.primaryView),

        normalizePrimaryView: normalize,

        setPrimaryView(view, options = {}) {
            const nextView = normalize(view);
            const previousView = this.primaryView;
            this.primaryView = nextView;
            Aethra.GameState.ui = Aethra.GameState.ui || {};
            Aethra.GameState.ui.primaryView = nextView;
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

        // Depois de carregar um save, a vista volta à que estava gravada.
        restoreFromState(source = "state-restored") {
            return this.setPrimaryView(Aethra.GameState.ui?.primaryView || this.primaryView, { source });
        }
    };

    Aethra.UIManager = UIManager;

    ["save:loaded", "state:restored"].forEach((eventName) => {
        Aethra.EventBus.on(eventName, () => UIManager.restoreFromState(eventName));
    });
})(window.Aethra);
