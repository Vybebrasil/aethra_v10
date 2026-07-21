// WindowManager.js - Game Client Overlay e Janelas Flutuantes
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.EventBus) {
        throw new Error(
            "WindowManager.js requer game-core.js carregado antes deste arquivo."
        );
    }

    function clone(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }

    function asArray(value) {
        return Array.isArray(value) ? value : [];
    }

    Aethra.WindowManager = {
        activeWindows: [],
        registeredWindows: new Map(),
        windowRenderers: new Map(),
        initialized: false,
        zIndexCounter: 110,
        lastFocusedElement: null,

        layers: {
            world: null,
            hud: null,
            modal: null,
            backdrop: null
        },

        config: {
            exclusive: true,
            modeless: true,
            draggable: true,
            hiddenClass: "hidden",
            openClass: "is-open",
            frontClass: "is-front-window",
            windowSelector: "[data-aethra-window]",
            clearContentOnClose: false,
            closeOnBackdrop: false,
            closeOnEscape: true,
            hpThresholdStorageKey:
                "aethra.skillController.hpThresholds",
            worldWindowIds: ["city-view"],
            windowAliases: {
                "shop-window": "npc-shop-view",
                "shop-view": "npc-shop-view",
                "inventory-window": "inventory-view",
                "skills-window": "skills-view"
            },
            windowPositionsStorageKey: "aethra.windowManager.positions"
        },

        init(options = {}) {
            if (this.initialized) {
                return this.getState();
            }

            this.config = {
                ...this.config,
                ...options,
                worldWindowIds:
                    options.worldWindowIds ||
                    this.config.worldWindowIds
            };

            this.ensureLayerStructure();
            this.configureDefaultRenderers();
            this.discoverWindows();
            this.adoptWindowsIntoLayers();
            this.bindControls();
            this.bindWindowDragging();
            this.syncFromDOM();
            this.refreshModalLayer();

            this.initialized = true;

            const state = this.getState();

            Aethra.EventBus.emit("WindowManagerReady", state);
            Aethra.EventBus.emit("window:manager-ready", state);

            return state;
        },

        /* =====================================================
           CAMADAS
           ===================================================== */

        ensureLayerStructure() {
            let worldLayer = document.getElementById("world-layer");
            let hudLayer = document.getElementById("hud-layer");
            let modalLayer = document.getElementById("modal-layer");

            if (!worldLayer) {
                worldLayer = document.createElement("div");
                worldLayer.id = "world-layer";
                worldLayer.setAttribute("aria-label", "Mundo do jogo");
                document.body.prepend(worldLayer);
            }

            if (!hudLayer) {
                hudLayer = document.createElement("div");
                hudLayer.id = "hud-layer";
                hudLayer.setAttribute("aria-label", "Interface principal");
                document.body.appendChild(hudLayer);
            }

            if (!modalLayer) {
                modalLayer = document.createElement("div");
                modalLayer.id = "modal-layer";
                modalLayer.setAttribute("aria-live", "polite");
                document.body.appendChild(modalLayer);
            }

            let backdrop = modalLayer.querySelector(
                ".aethra-modal-backdrop"
            );

            if (!backdrop) {
                backdrop = document.createElement("button");
                backdrop.type = "button";
                backdrop.className = "aethra-modal-backdrop";
                backdrop.tabIndex = -1;
                backdrop.setAttribute("aria-label", "Fechar janela");
                modalLayer.prepend(backdrop);
            }

            this.layers = {
                world: worldLayer,
                hud: hudLayer,
                modal: modalLayer,
                backdrop
            };

            modalLayer.classList.toggle(
                "is-modeless",
                this.config.modeless !== false
            );

            backdrop.hidden = this.config.modeless !== false;

            this.adoptHudElements();

            return this.layers;
        },

        adoptHudElements() {
            const hud = this.layers.hud;
            if (!hud) return false;

            const topbar = document.querySelector(".topbar");

            if (topbar && topbar.parentElement !== hud) {
                hud.appendChild(topbar);
            }

            [
                ".window-tabs",
                ".controls"
            ].forEach((selector) => {
                const element = document.querySelector(selector);

                /*
                 * A navegação pode estar integrada à navbar. Nesse caso ela
                 * deve permanecer dentro da topbar para evitar quebras de
                 * linha e manter marca, botões e carteira na mesma faixa.
                 */
                if (
                    element &&
                    !topbar?.contains(element) &&
                    element.parentElement !== hud
                ) {
                    hud.appendChild(element);
                }
            });

            return true;
        },

        isWorldWindow(windowId) {
            return asArray(this.config.worldWindowIds)
                .includes(windowId);
        },

        adoptWindowsIntoLayers() {
            this.registeredWindows.forEach((element, windowId) => {
                this.placeWindowInCorrectLayer(windowId, element);
                this.ensureCloseButton(windowId, element);
            });

            return true;
        },

        placeWindowInCorrectLayer(windowId, element) {
            if (!element) return false;

            if (this.isWorldWindow(windowId)) {
                element.classList.add("world-scene");
                element.classList.remove(this.config.openClass);
                element.classList.remove(this.config.frontClass);

                if (
                    this.layers.world &&
                    element.parentElement !== this.layers.world
                ) {
                    this.layers.world.appendChild(element);
                }

                element.removeAttribute("role");
                element.removeAttribute("aria-modal");
                return true;
            }

            element.classList.remove("world-scene");
            element.classList.add("aethra-floating-window");
            element.dataset.floatingWindow = windowId;
            element.setAttribute("role", "dialog");
            element.setAttribute(
                "aria-modal",
                this.config.modeless === false ? "true" : "false"
            );

            if (
                this.layers.modal &&
                element.parentElement !== this.layers.modal
            ) {
                this.layers.modal.appendChild(element);
            }

            return true;
        },

        ensureCloseButton(windowId, element) {
            if (
                !element ||
                this.isWorldWindow(windowId)
            ) {
                return null;
            }

            let closeButton = element.querySelector(
                "[data-close-window]"
            );

            if (!closeButton) {
                closeButton = document.createElement("button");
                closeButton.type = "button";
                closeButton.className =
                    "window-close aethra-window-close";
                closeButton.dataset.closeWindow = windowId;
                closeButton.setAttribute(
                    "aria-label",
                    `Fechar ${windowId}`
                );
                closeButton.title = "Fechar";
                closeButton.textContent = "×";

                const header =
                    element.querySelector(".window-header");

                if (header) {
                    header.appendChild(closeButton);
                } else {
                    element.prepend(closeButton);
                }
            } else {
                closeButton.type = "button";
                closeButton.dataset.closeWindow = windowId;
                closeButton.classList.add(
                    "window-close",
                    "aethra-window-close"
                );
                closeButton.setAttribute(
                    "aria-label",
                    closeButton.getAttribute("aria-label") ||
                    `Fechar ${windowId}`
                );
                closeButton.title =
                    closeButton.title || "Fechar";
                closeButton.textContent = "×";
            }

            return closeButton;
        },

        refreshModalLayer() {
            const modalIds = this.activeWindows.filter(
                (windowId) => !this.isWorldWindow(windowId)
            );

            const hasModal = modalIds.length > 0;

            this.layers.modal?.classList.toggle(
                "has-open-window",
                hasModal
            );

            document.body.classList.toggle(
                "has-aethra-modal",
                hasModal && this.config.modeless === false
            );
            document.body.classList.toggle(
                "has-aethra-floating-window",
                hasModal
            );

            if (this.layers.backdrop) {
                this.layers.backdrop.hidden =
                    this.config.modeless !== false || !hasModal;
            }

            this.registeredWindows.forEach((element, windowId) => {
                if (this.isWorldWindow(windowId)) return;

                element.classList.toggle(
                    this.config.frontClass,
                    windowId === modalIds[modalIds.length - 1]
                );
            });

            return hasModal;
        },

        /* =====================================================
           RENDERERS
           ===================================================== */

        configureDefaultRenderers() {
            if (this._defaultRenderersConfigured) return;
            this._defaultRenderersConfigured = true;

            const renderInventory = () => {
                Aethra.RenderEngine?.renderInventory?.();
                Aethra.RenderEngine?.renderEquipment?.();
            };

            const renderQuests = () => {
                Aethra.RenderEngine?.renderQuests?.();
            };

            const renderSkills = () => {
                return Aethra.UI_Renderer
                    ?.renderSkillSettings?.(
                        "skills-config-list"
                    );
            };

            const renderProfessions = () => {
                Aethra.RenderEngine?.renderProfessions?.();
            };

            const renderDungeon = () => {
                if (
                    typeof Aethra.RenderEngine?.renderDungeons ===
                    "function"
                ) {
                    Aethra.RenderEngine.renderDungeons();
                    return;
                }

                Aethra.DungeonSystem?.render?.();
            };

            const getNpcCatalog = () => {
                if (
                    typeof Aethra.ShopSystem?.getCatalog ===
                    "function"
                ) {
                    return Aethra.ShopSystem.getCatalog();
                }

                return Aethra.GameData?.items || {};
            };

            const renderNpcShop = (
                containerId = "shop-container"
            ) => {
                if (!Aethra.UI_Renderer?.renderGrid) {
                    return false;
                }

                return Aethra.UI_Renderer.renderGrid(
                    containerId,
                    getNpcCatalog(),
                    "npc_buy"
                );
            };

            const renderNpcSell = () => {
                if (!Aethra.UI_Renderer?.renderGrid) {
                    return false;
                }

                return Aethra.UI_Renderer.renderGrid(
                    "npc-sell-grid",
                    Aethra.GameState?.hero?.bag || [],
                    "npc_sell"
                );
            };

            const renderPremiumShop = () => {
                if (!Aethra.UI_Renderer?.renderGrid) {
                    return false;
                }

                return Aethra.UI_Renderer.renderGrid(
                    "premium-shop-grid",
                    Aethra.MarketplaceSystem?.premiumCatalog || {},
                    "premium_buy"
                );
            };

            const renderPlayerMarket = () => {
                if (!Aethra.UI_Renderer?.renderGrid) {
                    return false;
                }

                return Aethra.UI_Renderer.renderGrid(
                    "player-market-grid",
                    Aethra.MarketplaceSystem
                        ?.getActiveListings?.() || [],
                    "market"
                );
            };

            this.registerWindowRenderer("inventory-view", {
                containers: [
                    "inventory-grid",
                    "equipment-grid"
                ],
                render: renderInventory
            });

            this.registerWindowRenderer("inventory-grid", {
                containers: ["inventory-grid"],
                render: renderInventory
            });

            this.registerWindowRenderer("quests-view", {
                containers: ["quests-list"],
                render: renderQuests
            });

            this.registerWindowRenderer("skills-view", {
                containers: ["skills-config-list"],
                render: renderSkills
            });

            this.registerWindowRenderer("professions-view", {
                containers: ["professions-grid"],
                render: renderProfessions
            });

            this.registerWindowRenderer("dungeon-view", {
                containers: ["dungeon-list"],
                render: renderDungeon
            });

            this.registerWindowRenderer("shop-window", {
                containers: ["shop-container"],
                render: () => renderNpcShop("shop-container")
            });

            this.registerWindowRenderer("npc-shop-view", {
                containers: [],
                clearOnClose: false,
                render: () => Aethra.NpcShopUI?.render?.()
            });

            this.registerWindowRenderer("npc-sell-view", {
                containers: ["npc-sell-grid"],
                render: renderNpcSell
            });

            this.registerWindowRenderer("premium-shop-view", {
                containers: ["premium-shop-grid"],
                render: renderPremiumShop
            });

            this.registerWindowRenderer("player-market-view", {
                containers: ["player-market-grid"],
                render: renderPlayerMarket
            });

            this.registerWindowRenderer("marketplace-view", {
                containers: [
                    "npc-shop-grid",
                    "npc-sell-grid",
                    "premium-shop-grid",
                    "player-market-grid"
                ],
                render: () => {
                    if (
                        typeof Aethra.UI_Renderer?.renderShops ===
                        "function"
                    ) {
                        return Aethra.UI_Renderer.renderShops();
                    }

                    renderNpcShop("npc-shop-grid");
                    renderNpcSell();
                    renderPremiumShop();
                    renderPlayerMarket();
                    return true;
                }
            });

            this.registerWindowRenderer("city-view", {
                containers: [],
                clearOnClose: false,
                render: () => {
                    Aethra.RenderEngine?.renderCityPosition?.();
                    Aethra.RenderEngine?.renderHeroStats?.();
                    Aethra.RenderEngine?.renderHunt?.();
                    Aethra.RenderEngine?.renderCombat?.();
                    Aethra.RenderEngine?.renderBosses?.();
                }
            });
        },

        registerWindowRenderer(windowId, config) {
            if (!windowId || !config) return false;

            const normalized =
                typeof config === "function"
                    ? {
                        render: config,
                        containers: [],
                        clearOnClose: true
                    }
                    : {
                        render: config.render,
                        containers: Array.isArray(
                            config.containers
                        )
                            ? [...config.containers]
                            : config.containerId
                                ? [config.containerId]
                                : [],
                        clearOnClose:
                            config.clearOnClose !== undefined
                                ? Boolean(config.clearOnClose)
                                : true
                    };

            if (typeof normalized.render !== "function") {
                return false;
            }

            this.windowRenderers.set(windowId, normalized);

            Aethra.EventBus.emit(
                "window:renderer-registered",
                {
                    windowId,
                    containers: [...normalized.containers],
                    clearOnClose: normalized.clearOnClose
                }
            );

            return true;
        },

        unregisterWindowRenderer(windowId) {
            return this.windowRenderers.delete(windowId);
        },

        /* =====================================================
           REGISTRO DE JANELAS
           ===================================================== */

        discoverWindows() {
            document
                .querySelectorAll(this.config.windowSelector)
                .forEach((element) => {
                    if (element.id) {
                        this.registerWindow(
                            element.id,
                            element
                        );
                    }
                });
        },

        registerWindow(
            windowId,
            elementOrSelector = null
        ) {
            windowId = this.resolveWindowId(windowId);
            if (!windowId) return false;

            let element = elementOrSelector;

            if (typeof elementOrSelector === "string") {
                element = document.querySelector(
                    elementOrSelector
                );
            }

            if (!element) {
                element = document.getElementById(windowId);
            }

            if (!element) return false;

            this.registeredWindows.set(windowId, element);
            element.dataset.aethraWindow =
                element.dataset.aethraWindow ||
                windowId;

            this.placeWindowInCorrectLayer(
                windowId,
                element
            );

            this.ensureCloseButton(windowId, element);

            if (!this.isWorldWindow(windowId)) {
                element.classList.add("aethra-floating-window");
                element.dataset.floatingWindow = windowId;
            }

            const isHidden = element.classList.contains(
                this.config.hiddenClass
            );

            element.setAttribute(
                "aria-hidden",
                isHidden ? "true" : "false"
            );

            return true;
        },

        unregisterWindow(windowId) {
            windowId = this.resolveWindowId(windowId);
            this.closeWindow(windowId, {
                silent: true,
                keepContent: false
            });

            return this.registeredWindows.delete(windowId);
        },

        resolveWindowId(windowId) {
            if (!windowId) return windowId;

            return this.config.windowAliases?.[windowId] || windowId;
        },

        getStoredWindowPositions() {
            try {
                const raw = window.localStorage?.getItem(
                    this.config.windowPositionsStorageKey
                );
                const parsed = raw ? JSON.parse(raw) : {};
                return parsed && typeof parsed === "object" ? parsed : {};
            } catch (error) {
                return {};
            }
        },

        saveWindowPosition(windowId, left, top) {
            if (!windowId) return false;

            const x = Math.max(8, Math.round(Number(left) || 0));
            const y = Math.max(8, Math.round(Number(top) || 0));

            try {
                const positions = this.getStoredWindowPositions();
                positions[windowId] = { left: x, top: y };
                window.localStorage?.setItem(
                    this.config.windowPositionsStorageKey,
                    JSON.stringify(positions)
                );
                return positions[windowId];
            } catch (error) {
                return false;
            }
        },

        getDefaultWindowPosition(windowId, element) {
            const rect = element.getBoundingClientRect();
            const width = Math.max(rect.width, 320);
            const height = Math.max(rect.height, 220);
            const gap = 16;
            const safeTop = this.getSafeTopOffset();
            const top = Math.max(safeTop, Math.min(112, window.innerHeight * 0.12));
            const maxLeft = Math.max(gap, window.innerWidth - width - gap);
            const maxTop = Math.max(safeTop, window.innerHeight - height - gap);

            const presets = {
                "inventory-view": { left: gap, top },
                "skills-view": { left: maxLeft, top },
                "npc-shop-view": {
                    left: Math.max(gap, (window.innerWidth - width) / 2),
                    top
                },
                "premium-shop-view": {
                    left: Math.max(gap, (window.innerWidth - width) / 2),
                    top
                },
                "player-market-view": {
                    left: Math.max(gap, (window.innerWidth - width) / 2),
                    top
                }
            };

            const selected = presets[windowId] || {
                left: Math.max(gap, (window.innerWidth - width) / 2),
                top: Math.max(gap, Math.min(top, maxTop))
            };

            return {
                left: Math.min(maxLeft, Math.max(gap, selected.left)),
                top: Math.min(maxTop, Math.max(safeTop, selected.top))
            };
        },

        getSafeTopOffset() {
            const topbar = document.querySelector("#hud-layer .topbar, .topbar");
            const bottom = Number(topbar?.getBoundingClientRect?.().bottom || 0);
            return Math.max(64, Math.ceil(bottom) + 8);
        },

        positionFloatingWindow(windowId, element, options = {}) {
            if (!element || this.isWorldWindow(windowId)) return false;

            const safeTop = this.getSafeTopOffset();
            const safeBottom = 8;
            const availableHeight = Math.max(220, window.innerHeight - safeTop - safeBottom);
            element.style.setProperty("max-height", `${Math.floor(availableHeight)}px`, "important");

            const stored = this.getStoredWindowPositions()[windowId];
            const position = options.position || stored ||
                this.getDefaultWindowPosition(windowId, element);
            const rect = element.getBoundingClientRect();
            const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
            const maxTop = Math.max(safeTop, window.innerHeight - rect.height - safeBottom);
            const left = Math.min(maxLeft, Math.max(8, Number(position.left) || 8));
            const top = Math.min(maxTop, Math.max(safeTop, Number(position.top) || safeTop));

            element.style.setProperty("left", `${Math.round(left)}px`, "important");
            element.style.setProperty("top", `${Math.round(top)}px`, "important");
            element.style.setProperty("right", "auto", "important");
            element.style.setProperty("transform", "none", "important");
            element.dataset.floatingPositioned = "true";

            return { left, top };
        },

        getWindow(windowId) {
            windowId = this.resolveWindowId(windowId);
            if (this.registeredWindows.has(windowId)) {
                return this.registeredWindows.get(windowId);
            }

            const element = document.getElementById(windowId);

            if (element) {
                this.registerWindow(windowId, element);
                return element;
            }

            return null;
        },

        /* =====================================================
           ABERTURA, FOCO E FECHAMENTO
           ===================================================== */

        openWindow(windowId, options = {}) {
            windowId = this.resolveWindowId(windowId);
            const element = this.getWindow(windowId);

            if (!element) {
                const payload = {
                    id: windowId,
                    reason: "window-not-found"
                };

                Aethra.EventBus.emit(
                    "WindowOpenFailed",
                    payload
                );
                Aethra.EventBus.emit(
                    "window:open-failed",
                    payload
                );

                console.warn(
                    `Janela não encontrada: ${windowId}`
                );

                return false;
            }

            const isWorld = this.isWorldWindow(windowId);

            this.lastFocusedElement =
                document.activeElement instanceof HTMLElement
                    ? document.activeElement
                    : null;

            if (!isWorld) {
                const exclusive =
                    options.exclusive !== undefined
                        ? Boolean(options.exclusive)
                        : this.config.exclusive;

                if (exclusive) {
                    this.closeAll({
                        modalOnly: true,
                        except: windowId,
                        silent:
                            options.silentClose === true,
                        source: "openWindow"
                    });
                }
            }

            element.classList.remove(
                this.config.hiddenClass
            );
            element.classList.add(
                this.config.openClass
            );

            element.setAttribute("aria-hidden", "false");
            element.style.zIndex = String(
                ++this.zIndexCounter
            );

            this.activeWindows = this.activeWindows.filter(
                (id) => id !== windowId
            );
            this.activeWindows.push(windowId);

            if (!isWorld) {
                this.positionFloatingWindow(
                    windowId,
                    element,
                    options
                );
            }

            const payload = {
                id: windowId,
                activeWindows: [...this.activeWindows],
                exclusive:
                    options.exclusive !== undefined
                        ? Boolean(options.exclusive)
                        : this.config.exclusive,
                source: options.source || null,
                renderTriggered: false,
                layer: isWorld ? "world" : "modal"
            };

            if (options.render !== false) {
                payload.renderTriggered =
                    this.renderWindowContent(
                        windowId,
                        payload
                    ) !== false;
            }

            this.refreshModalLayer();
            this.focusWindow(element);

            Aethra.EventBus.emit("WindowOpened", payload);
            Aethra.EventBus.emit("window:opened", payload);

            return true;
        },

        focusWindow(element) {
            if (!element) return false;

            const focusable = element.querySelector(
                [
                    "[data-close-window]",
                    "button:not(:disabled)",
                    "input:not(:disabled)",
                    "select:not(:disabled)",
                    "textarea:not(:disabled)",
                    "[tabindex]:not([tabindex='-1'])"
                ].join(",")
            );

            if (focusable instanceof HTMLElement) {
                window.setTimeout(() => {
                    focusable.focus({
                        preventScroll: true
                    });
                }, 0);
            } else {
                element.tabIndex = -1;

                window.setTimeout(() => {
                    element.focus({
                        preventScroll: true
                    });
                }, 0);
            }

            return true;
        },

        bringToFront(windowId) {
            windowId = this.resolveWindowId(windowId);
            const element = this.getWindow(windowId);

            if (!element || !this.isOpen(windowId)) {
                return false;
            }

            element.style.zIndex = String(
                ++this.zIndexCounter
            );

            this.activeWindows = this.activeWindows.filter(
                (id) => id !== windowId
            );
            this.activeWindows.push(windowId);

            this.refreshModalLayer();

            Aethra.EventBus.emit(
                "window:brought-to-front",
                {
                    id: windowId,
                    zIndex: this.zIndexCounter
                }
            );

            return true;
        },

        closeWindow(windowId, options = {}) {
            windowId = this.resolveWindowId(windowId);
            const element = this.getWindow(windowId);
            if (!element) return false;

            if (this.isWorldWindow(windowId)) {
                /*
                 * A cena principal não deve desaparecer ao fechar um
                 * modal. Ela permanece como fundo do cliente.
                 */
                if (options.force !== true) {
                    return false;
                }
            }

            const wasActive =
                this.activeWindows.includes(windowId);
            const wasVisible =
                !element.classList.contains(
                    this.config.hiddenClass
                );

            element.classList.remove(
                this.config.openClass,
                this.config.frontClass
            );
            element.classList.add(
                this.config.hiddenClass
            );
            element.setAttribute("aria-hidden", "true");
            element.style.removeProperty("z-index");

            this.activeWindows = this.activeWindows.filter(
                (id) => id !== windowId
            );

            const shouldClear =
                options.keepContent !== true &&
                this.config.clearContentOnClose;

            if (shouldClear) {
                this.clearWindowContent(windowId);
            }

            this.refreshModalLayer();

            if (
                !options.silent &&
                (wasActive || wasVisible)
            ) {
                const payload = {
                    id: windowId,
                    activeWindows:
                        [...this.activeWindows],
                    source: options.source || null,
                    contentCleared: shouldClear
                };

                Aethra.EventBus.emit(
                    "WindowClosed",
                    payload
                );
                Aethra.EventBus.emit(
                    "window:closed",
                    payload
                );
            }

            if (
                this.activeWindows.filter(
                    (id) => !this.isWorldWindow(id)
                ).length === 0 &&
                this.lastFocusedElement?.isConnected
            ) {
                this.lastFocusedElement.focus?.({
                    preventScroll: true
                });
            }

            return true;
        },

        closeAll(options = {}) {
            const except = options.except || null;
            const modalOnly =
                options.modalOnly === true;

            [...this.activeWindows].forEach(
                (windowId) => {
                    if (windowId === except) return;

                    if (
                        modalOnly &&
                        this.isWorldWindow(windowId)
                    ) {
                        return;
                    }

                    this.closeWindow(windowId, {
                        silent:
                            options.silent === true,
                        source:
                            options.source ||
                            "closeAll",
                        keepContent:
                            options.keepContent === true,
                        force:
                            options.force === true
                    });
                }
            );

            return [...this.activeWindows];
        },

        toggleWindow(windowId, options = {}) {
            windowId = this.resolveWindowId(windowId);
            return this.isOpen(windowId)
                ? this.closeWindow(
                    windowId,
                    options
                )
                : this.openWindow(
                    windowId,
                    options
                );
        },

        isOpen(windowId) {
            windowId = this.resolveWindowId(windowId);
            const element = this.getWindow(windowId);

            return Boolean(
                element &&
                this.activeWindows.includes(windowId) &&
                !element.classList.contains(
                    this.config.hiddenClass
                )
            );
        },

        /* =====================================================
           RENDERIZAÇÃO
           ===================================================== */

        renderWindowContent(
            windowId,
            context = {}
        ) {
            windowId = this.resolveWindowId(windowId);
            const renderer =
                this.windowRenderers.get(windowId);

            if (!renderer) {
                Aethra.EventBus.emit(
                    "window:render-skipped",
                    {
                        windowId,
                        reason: "renderer-not-mapped"
                    }
                );

                return false;
            }

            const payload = {
                windowId,
                containers:
                    [...renderer.containers],
                context: clone(context)
            };

            Aethra.EventBus.emit(
                "WindowRenderStarted",
                payload
            );
            Aethra.EventBus.emit(
                "window:render-started",
                payload
            );

            try {
                const result = renderer.render({
                    windowId,
                    element:
                        this.getWindow(windowId),
                    context
                });

                if (
                    result &&
                    typeof result.then === "function"
                ) {
                    result
                        .then((resolved) => {
                            this.emitWindowRendered(
                                windowId,
                                renderer,
                                resolved
                            );
                        })
                        .catch((error) => {
                            this.emitWindowRenderError(
                                windowId,
                                error
                            );
                        });
                } else {
                    this.emitWindowRendered(
                        windowId,
                        renderer,
                        result
                    );
                }

                return result === false
                    ? false
                    : true;
            } catch (error) {
                this.emitWindowRenderError(
                    windowId,
                    error
                );
                return false;
            }
        },

        emitWindowRendered(
            windowId,
            renderer,
            result
        ) {
            const payload = {
                windowId,
                containers:
                    [...renderer.containers],
                result
            };

            Aethra.EventBus.emit(
                "WindowRendered",
                payload
            );
            Aethra.EventBus.emit(
                "window:rendered",
                payload
            );
        },

        emitWindowRenderError(windowId, error) {
            const payload = {
                windowId,
                error,
                message:
                    error?.message ||
                    String(error)
            };

            console.error(
                `Falha ao renderizar a janela ${windowId}:`,
                error
            );

            Aethra.EventBus.emit(
                "WindowRenderFailed",
                payload
            );
            Aethra.EventBus.emit(
                "window:render-failed",
                payload
            );
        },

        clearWindowContent(windowId) {
            windowId = this.resolveWindowId(windowId);
            const renderer =
                this.windowRenderers.get(windowId);

            if (
                !renderer ||
                renderer.clearOnClose === false
            ) {
                return false;
            }

            let cleared = 0;

            renderer.containers.forEach(
                (containerId) => {
                    const container =
                        document.getElementById(
                            containerId
                        );

                    if (!container) return;

                    container.replaceChildren();
                    cleared += 1;
                }
            );

            const payload = {
                windowId,
                containers:
                    [...renderer.containers],
                cleared
            };

            Aethra.EventBus.emit(
                "WindowContentCleared",
                payload
            );
            Aethra.EventBus.emit(
                "window:content-cleared",
                payload
            );

            return cleared > 0;
        },

        /* =====================================================
           SINCRONIZAÇÃO E CONTROLES
           ===================================================== */

        syncFromDOM() {
            this.activeWindows = [];

            this.registeredWindows.forEach(
                (element, windowId) => {
                    const isWorld =
                        this.isWorldWindow(windowId);

                    const visible =
                        isWorld ||
                        !element.classList.contains(
                            this.config.hiddenClass
                        );

                    element.setAttribute(
                        "aria-hidden",
                        visible ? "false" : "true"
                    );

                    if (visible) {
                        if (isWorld) {
                            element.classList.remove(
                                this.config.hiddenClass
                            );
                        } else {
                            element.classList.add(
                                this.config.openClass
                            );
                        }

                        this.activeWindows.push(
                            windowId
                        );
                    }
                }
            );

            return [...this.activeWindows];
        },

        getStoredHpThresholds() {
            try {
                const serialized = window.localStorage?.getItem(
                    this.config.hpThresholdStorageKey
                );

                if (!serialized) return {};

                const parsed = JSON.parse(serialized);
                return parsed && typeof parsed === "object"
                    ? parsed
                    : {};
            } catch (error) {
                return {};
            }
        },

        loadHpThreshold(skillId, fallback = null) {
            try {
                const directValue = skillId
                    ? window.localStorage?.getItem(
                        `${this.config.hpThresholdStorageKey}.${skillId}`
                    )
                    : null;

                const stored = this.getStoredHpThresholds();
                const value =
                    directValue ??
                    (skillId ? stored[skillId] : null) ??
                    window.localStorage?.getItem("hpThreshold") ??
                    fallback;

                if (
                    value === null ||
                    value === undefined ||
                    value === ""
                ) {
                    return fallback;
                }

                const parsed = Number(value);

                if (!Number.isFinite(parsed)) {
                    return fallback;
                }

                return Math.round(
                    Math.min(95, Math.max(5, parsed))
                );
            } catch (error) {
                return fallback;
            }
        },

        saveHpThreshold(
            skillId,
            value,
            options = {}
        ) {
            if (value === undefined) {
                value = skillId;
                skillId = null;
            }

            const parsed = Number(value);

            if (!Number.isFinite(parsed)) {
                return false;
            }

            const hpThreshold = Math.round(
                Math.min(95, Math.max(5, parsed))
            );

            try {
                const stored = this.getStoredHpThresholds();

                if (skillId) {
                    stored[skillId] = hpThreshold;
                }

                window.localStorage?.setItem(
                    this.config.hpThresholdStorageKey,
                    JSON.stringify(stored)
                );

                if (skillId) {
                    window.localStorage?.setItem(
                        `${this.config.hpThresholdStorageKey}.${skillId}`,
                        String(hpThreshold)
                    );
                }

                /* Chave simples para compatibilidade com versões antigas. */
                window.localStorage?.setItem(
                    "hpThreshold",
                    String(hpThreshold)
                );
            } catch (error) {
                Aethra.EventBus.emit(
                    "window:hp-threshold-save-failed",
                    {
                        skillId: skillId || null,
                        hpThreshold,
                        error: error?.message || String(error)
                    }
                );

                return false;
            }

            if (
                options.syncController !== false &&
                skillId &&
                Aethra.SkillController?.setHpThreshold
            ) {
                Aethra.SkillController.setHpThreshold(
                    skillId,
                    hpThreshold
                );
            }

            Aethra.EventBus.emit(
                "HpThresholdSaved",
                {
                    skillId: skillId || null,
                    hpThreshold
                }
            );
            Aethra.EventBus.emit(
                "window:hp-threshold-saved",
                {
                    skillId: skillId || null,
                    hpThreshold
                }
            );

            return hpThreshold;
        },

        bindWindowDragging() {
            if (this._draggingBound || this.config.draggable === false) return;
            this._draggingBound = true;

            let dragState = null;

            document.addEventListener("pointerdown", (event) => {
                const header = event.target.closest?.(
                    ".aethra-floating-window .window-header"
                );
                if (!header) return;
                if (event.target.closest("button, input, select, textarea, a")) return;

                const element = header.closest(this.config.windowSelector);
                if (!element?.id || !this.isOpen(element.id)) return;

                const rect = element.getBoundingClientRect();
                this.bringToFront(element.id);
                element.classList.add("is-dragging");

                dragState = {
                    id: element.id,
                    element,
                    offsetX: event.clientX - rect.left,
                    offsetY: event.clientY - rect.top
                };

                header.setPointerCapture?.(event.pointerId);
                event.preventDefault();
            });

            document.addEventListener("pointermove", (event) => {
                if (!dragState) return;

                const { element, offsetX, offsetY } = dragState;
                const rect = element.getBoundingClientRect();
                const safeTop = this.getSafeTopOffset();
                const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
                const maxTop = Math.max(safeTop, window.innerHeight - rect.height - 8);
                const left = Math.min(maxLeft, Math.max(8, event.clientX - offsetX));
                const top = Math.min(maxTop, Math.max(safeTop, event.clientY - offsetY));

                element.style.setProperty("left", `${Math.round(left)}px`, "important");
                element.style.setProperty("top", `${Math.round(top)}px`, "important");
                element.style.setProperty("transform", "none", "important");
            });

            document.addEventListener("pointerup", () => {
                if (!dragState) return;

                const { id, element } = dragState;
                const rect = element.getBoundingClientRect();
                element.classList.remove("is-dragging");
                this.saveWindowPosition(id, rect.left, rect.top);
                dragState = null;
            });

            window.addEventListener("resize", () => {
                this.activeWindows.forEach((windowId) => {
                    if (this.isWorldWindow(windowId)) return;
                    const element = this.getWindow(windowId);
                    if (element) this.positionFloatingWindow(windowId, element);
                });
            });
        },

        bindControls() {
            if (this._controlsBound) return;
            this._controlsBound = true;

            const persistThresholdFromInput = (event) => {
                const input = event.target?.closest?.(
                    [
                        "[data-skill-threshold-range]",
                        "[data-skill-threshold-number]",
                        "[data-hp-threshold]"
                    ].join(",")
                );

                if (!input) return;

                /*
                 * O listener direto do input pode redesenhar o modal antes
                 * de o evento chegar ao document. Por isso, a persistência
                 * usa os atributos do próprio controle, mesmo se ele já tiver
                 * sido temporariamente desconectado do DOM.
                 */
                const skillId =
                    input.dataset.skillId ||
                    input.closest("[data-skill-id]")
                        ?.dataset.skillId ||
                    null;

                this.saveHpThreshold(
                    skillId,
                    input.value,
                    { syncController: false }
                );
            };

            document.addEventListener(
                "input",
                persistThresholdFromInput
            );
            document.addEventListener(
                "change",
                persistThresholdFromInput
            );

            document.addEventListener(
                "click",
                (event) => {
                    const openControl =
                        event.target.closest(
                            "[data-open-window]"
                        );

                    if (openControl) {
                        const windowId =
                            openControl.dataset
                                .openWindow;

                        if (windowId) {
                            event.preventDefault();

                            this.openWindow(
                                windowId,
                                {
                                    source:
                                        "control"
                                }
                            );
                        }

                        return;
                    }

                    const closeControl =
                        event.target.closest(
                            "[data-close-window]"
                        );

                    if (closeControl) {
                        const windowId =
                            closeControl.dataset
                                .closeWindow ||
                            closeControl.closest(
                                this.config
                                    .windowSelector
                            )?.id;

                        if (windowId) {
                            event.preventDefault();

                            this.closeWindow(
                                windowId,
                                {
                                    source:
                                        "close-button"
                                }
                            );
                        }

                        return;
                    }

                    const windowElement =
                        event.target.closest(
                            this.config
                                .windowSelector
                        );

                    if (
                        windowElement?.id &&
                        !this.isWorldWindow(
                            windowElement.id
                        )
                    ) {
                        this.bringToFront(
                            windowElement.id
                        );
                    }
                }
            );

            this.layers.backdrop?.addEventListener(
                "click",
                () => {
                    if (!this.config.closeOnBackdrop) {
                        return;
                    }

                    const modalIds =
                        this.activeWindows.filter(
                            (windowId) =>
                                !this.isWorldWindow(
                                    windowId
                                )
                        );

                    const frontWindow =
                        modalIds[
                            modalIds.length - 1
                        ];

                    if (frontWindow) {
                        this.closeWindow(
                            frontWindow,
                            {
                                source:
                                    "backdrop"
                            }
                        );
                    }
                }
            );

            document.addEventListener(
                "keydown",
                (event) => {
                    if (
                        event.key !== "Escape" ||
                        !this.config.closeOnEscape
                    ) {
                        return;
                    }

                    const modalIds =
                        this.activeWindows.filter(
                            (windowId) =>
                                !this.isWorldWindow(
                                    windowId
                                )
                        );

                    const frontWindow =
                        modalIds[
                            modalIds.length - 1
                        ];

                    if (!frontWindow) return;

                    event.preventDefault();

                    this.closeWindow(
                        frontWindow,
                        {
                            source:
                                "escape-key"
                        }
                    );
                }
            );
        },

        getState() {
            return {
                initialized: this.initialized,
                activeWindows:
                    [...this.activeWindows],
                registeredWindows:
                    [...this.registeredWindows.keys()],
                rendererMappings:
                    [...this.windowRenderers.keys()],
                exclusive:
                    this.config.exclusive,
                modeless:
                    this.config.modeless,
                draggable:
                    this.config.draggable,
                clearContentOnClose:
                    this.config.clearContentOnClose,
                layers: {
                    world:
                        this.layers.world?.id ||
                        null,
                    hud:
                        this.layers.hud?.id ||
                        null,
                    modal:
                        this.layers.modal?.id ||
                        null
                }
            };
        },

        // Aliases de compatibilidade.
        saveHPThreshold(skillId, value, options = {}) {
            return this.saveHpThreshold(
                skillId,
                value,
                options
            );
        },

        open(windowId, options = {}) {
            return this.openWindow(
                windowId,
                options
            );
        },

        close(windowId, options = {}) {
            return this.closeWindow(
                windowId,
                options
            );
        }
    };
})(window.Aethra);
