// GameInitializer.js - Setup e validação da integração de lojas
(function (Aethra) {
    "use strict";

    if (
        !Aethra ||
        !Aethra.GameState ||
        !Aethra.EventBus ||
        !Aethra.GameData ||
        !Aethra.SkillController ||
        !Aethra.MarketplaceSystem ||
        !Aethra.UI_Renderer ||
        !Aethra.WindowManager
    ) {
        throw new Error(
            "GameInitializer.js requer Core, GameData, SkillController, MarketplaceSystem, UI_Renderer e WindowManager."
        );
    }

    const wait = (milliseconds) =>
        new Promise((resolve) => window.setTimeout(resolve, milliseconds));

    const clone = (value) => JSON.parse(JSON.stringify(value));

    Aethra.GameInitializer = {
        initialized: false,
        running: false,
        lastReport: null,

        resetInitialState() {
            const previousHero = Aethra.GameState.hero || {};

            Aethra.GameState.hero = {
                ...previousHero,
                id: "local-player",
                name: previousHero.name || "Aethra",
                level: 1,
                gold: 100,
                diamonds: 0,
                bag: [],
                equipment: previousHero.equipment || {},
                stats: {
                    ...(previousHero.stats || {}),
                    hp: 100,
                    maxHp: 100,
                    damage: 10,
                    str: Number(previousHero.stats?.str || 10),
                    mana: Number(previousHero.stats?.mana || 50),
                    maxMana: Number(previousHero.stats?.maxMana || 50),
                    xp: 0,
                    gold: 100,
                    diamonds: 0
                }
            };

            const player = Aethra.GameState.hero;

            /*
             * A instância em execução acompanha a entidade player, enquanto
             * o estado serializável permanece em player.skillControllerState.
             */
            Aethra.SkillController.init(player);
            Aethra.SkillController.bindPlayer(player);

            this.player = player;
            this.skillController = player.skillController;

            Aethra.GameState.playerMarket = {
                listings: [],
                history: [],
                sellerBalances: {},
                treasuryGold: 0,
                transactionTaxRate: 0.05
            };

            Aethra.EventBus.emit("statsChanged", {
                source: "game-initializer"
            });

            Aethra.EventBus.emit("goldChanged", {
                total: 100,
                amount: 0,
                reason: "initial-setup"
            });

            Aethra.EventBus.emit("diamondsChanged", {
                total: 0,
                amount: 0,
                reason: "initial-setup"
            });

            Aethra.EventBus.emit("inventory:changed", {
                reason: "initial-setup",
                bag: []
            });

            this.updateCurrencyCounters();

            return clone(Aethra.GameState.hero);
        },

        updateCurrencyCounters() {
            const hero = Aethra.GameState.hero;

            document
                .querySelectorAll("[data-currency='gold']")
                .forEach((element) => {
                    element.textContent = String(hero.gold);
                });

            document
                .querySelectorAll("[data-currency='diamonds']")
                .forEach((element) => {
                    element.textContent = String(hero.diamonds);
                });
        },

        bindVisualState() {
            if (this._visualEventsBound) return;
            this._visualEventsBound = true;

            [
                "goldChanged",
                "diamondsChanged",
                "inventory:changed",
                "market:npc-item-purchased"
            ].forEach((eventName) => {
                Aethra.EventBus.on(eventName, () => {
                    this.updateCurrencyCounters();
                    this.renderLiveState();
                });
            });
        },

        renderLiveState() {
            const hero = Aethra.GameState.hero;
            const liveState = document.getElementById("live-state");

            if (!liveState) return;

            const bagHTML = hero.bag.length
                ? hero.bag
                    .map((item) => {
                        return `<li>${item.name} <small>${item.instanceId}</small></li>`;
                    })
                    .join("")
                : "<li>Inventário vazio</li>";

            liveState.innerHTML = `
                <strong>Estado atual</strong>
                <span>Gold: ${hero.gold}</span>
                <span>Diamantes: ${hero.diamonds}</span>
                <span>Itens: ${hero.bag.length}</span>
                <ul>${bagHTML}</ul>
            `;
        },

        renderReport(report) {
            const reportElement = document.getElementById("setup-report");
            if (!reportElement) return;

            reportElement.className = report.success
                ? "setup-report setup-report--success"
                : "setup-report setup-report--error";

            reportElement.innerHTML = `
                <h2>${report.success ? "Integração validada" : "Falha na integração"}</h2>

                <div class="report-grid">
                    <span>Janela aberta</span>
                    <strong>${report.windowOpened ? "PASSOU" : "FALHOU"}</strong>

                    <span>Gold inicial</span>
                    <strong>${report.goldBefore}</strong>

                    <span>Preço da poção</span>
                    <strong>${report.potionPrice}</strong>

                    <span>Gold esperado</span>
                    <strong>${report.expectedGold}</strong>

                    <span>Gold final</span>
                    <strong>${report.goldAfter}</strong>

                    <span>Poção no inventário</span>
                    <strong>${report.hasPotion ? "PASSOU" : "FALHOU"}</strong>

                    <span>Itens no inventário</span>
                    <strong>${report.inventoryCount}</strong>
                </div>
            `;
        },

        async run(options = {}) {
            if (this.running) {
                return this.lastReport;
            }

            if (this.initialized && options.force !== true) {
                return this.lastReport;
            }

            this.running = true;

            try {
                this.resetInitialState();
                this.bindVisualState();

                Aethra.MarketplaceSystem.init();
                Aethra.RenderEngine?.init?.();
                Aethra.UI_Renderer.init();
                Aethra.WindowManager.init();

                const goldBefore = Aethra.GameState.hero.gold;
                const potionPrice = Number(
                    Aethra.GameData.items.potion_health?.price || 0
                );

                const windowOpened =
                    Aethra.WindowManager.openWindow("shop-window", {
                        source: "game-initializer"
                    });

                // Dá um frame para o WindowManager disparar o UI_Renderer.
                await wait(120);

                const purchaseResult =
                    await Aethra.UI_Renderer.handleAction(
                        "npc_buy",
                        "potion_health"
                    );

                // Aguarda o EventBus e o requestAnimationFrame concluírem.
                await wait(180);

                const hero = Aethra.GameState.hero;
                const expectedGold = goldBefore - potionPrice;
                const hasPotion = hero.bag.some((item) => {
                    return (
                        item.templateId === "potion_health" ||
                        item.id === "potion_health"
                    );
                });

                const report = {
                    success: Boolean(
                        windowOpened &&
                        purchaseResult &&
                        hero.gold === expectedGold &&
                        hasPotion
                    ),
                    windowOpened: Boolean(windowOpened),
                    purchaseCompleted: Boolean(purchaseResult),
                    goldBefore,
                    potionPrice,
                    expectedGold,
                    goldAfter: hero.gold,
                    hasPotion,
                    inventoryCount: hero.bag.length,
                    inventory: clone(hero.bag),
                    timestamp: Date.now()
                };

                this.initialized = true;
                this.lastReport = report;

                this.updateCurrencyCounters();
                this.renderLiveState();
                this.renderReport(report);

                console.log(
                    "%c--- AETHRA: RESULTADO DO SETUP ---",
                    "color:#64e6a6;font-weight:bold"
                );
                console.table({
                    "Janela shop-window": report.windowOpened,
                    "Gold antes": report.goldBefore,
                    "Preço potion_health": report.potionPrice,
                    "Gold depois": report.goldAfter,
                    "Gold esperado": report.expectedGold,
                    "Poção no inventário": report.hasPotion,
                    "Resultado": report.success ? "PASSOU" : "FALHOU"
                });

                Aethra.EventBus.emit(
                    "GameInitializationFinished",
                    clone(report)
                );

                Aethra.EventBus.emit(
                    "setup:validation-finished",
                    clone(report)
                );

                return report;
            } catch (error) {
                const report = {
                    success: false,
                    error: error.message,
                    timestamp: Date.now()
                };

                this.lastReport = report;
                this.renderReport(report);

                console.error("Falha no GameInitializer:", error);

                Aethra.EventBus.emit("setup:validation-error", {
                    error,
                    message: error.message
                });

                return report;
            } finally {
                this.running = false;
            }
        }
    };

    function start() {
        const rerunButton = document.getElementById("run-setup-again");

        rerunButton?.addEventListener("click", () => {
            Aethra.GameInitializer.initialized = false;
            Aethra.GameInitializer.run({ force: true });
        });

        Aethra.GameInitializer.run();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, {
            once: true
        });
    } else {
        start();
    }
})(window.Aethra);
