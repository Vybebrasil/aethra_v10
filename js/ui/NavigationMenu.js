// NavigationMenu.js - Barra de Navegação da Aethra Engine
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.EventBus || !Aethra.WindowManager) {
        throw new Error(
            "NavigationMenu.js requer game-core.js e WindowManager.js carregados antes deste arquivo."
        );
    }

    Aethra.NavigationMenu = {
        initialized: false,
        containerId: "game-container",
        navId: "main-nav",
        position: "bottom",

        items: [
            { id: "city-view", label: "Cidade", icon: "🏙️" },
            { id: "inventory-grid", label: "Inventário", icon: "🎒" },
            { id: "quests-view", label: "Quests", icon: "📜" },
            { id: "professions-grid", label: "Profissões", icon: "🛠️" },
            { id: "dungeon-view", label: "Dungeon", icon: "⚔️" }
        ],

        init(options = {}) {
            if (this.initialized) {
                return this.getElement();
            }

            if (options.containerId) {
                this.containerId = options.containerId;
            }

            if (options.navId) {
                this.navId = options.navId;
            }

            if (options.position === "top" || options.position === "bottom") {
                this.position = options.position;
            }

            if (Array.isArray(options.items)) {
                this.items = options.items;
            }

            const container = document.getElementById(this.containerId);

            if (!container) {
                console.warn(
                    `NavigationMenu: container #${this.containerId} não encontrado.`
                );

                Aethra.EventBus.emit("NavigationMenuError", {
                    reason: "container-not-found",
                    containerId: this.containerId
                });

                return null;
            }

            const existing = document.getElementById(this.navId);

            if (existing) {
                existing.remove();
            }

            this.injectStyles();

            const nav = document.createElement("nav");
            nav.id = this.navId;
            nav.className = [
                "aethra-main-nav",
                `aethra-main-nav--${this.position}`
            ].join(" ");

            nav.setAttribute("aria-label", "Navegação principal do jogo");

            this.items.forEach((item) => {
                const button = this.createButton(item);
                nav.appendChild(button);
            });

            container.appendChild(nav);

            this.bindEvents();
            this.initialized = true;

            const payload = {
                navId: this.navId,
                containerId: this.containerId,
                position: this.position,
                items: this.items.map((item) => ({ ...item }))
            };

            Aethra.EventBus.emit("NavigationMenuReady", payload);
            Aethra.EventBus.emit("navigation:ready", payload);

            return nav;
        },

        createButton(item) {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "aethra-main-nav__button";
            button.dataset.windowId = item.id;
            button.setAttribute("aria-label", `Abrir ${item.label}`);

            button.innerHTML = `
                <span class="aethra-main-nav__icon" aria-hidden="true">
                    ${item.icon || ""}
                </span>
                <span class="aethra-main-nav__label">
                    ${item.label}
                </span>
            `;

            button.addEventListener("click", () => {
                const opened = Aethra.WindowManager.openWindow(item.id, {
                    source: "navigation-menu"
                });

                if (!opened) {
                    Aethra.EventBus.emit("NavigationItemFailed", {
                        id: item.id,
                        label: item.label
                    });
                }
            });

            return button;
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            Aethra.EventBus.on("WindowOpened", ({ id }) => {
                this.setActive(id);
            });

            Aethra.EventBus.on("WindowClosed", ({ id }) => {
                const button = this.getButton(id);

                if (button) {
                    button.classList.remove("is-active");
                    button.setAttribute("aria-pressed", "false");
                }
            });
        },

        setActive(windowId) {
            const nav = this.getElement();
            if (!nav) return false;

            nav.querySelectorAll("[data-window-id]").forEach((button) => {
                const active = button.dataset.windowId === windowId;

                button.classList.toggle("is-active", active);
                button.setAttribute(
                    "aria-pressed",
                    active ? "true" : "false"
                );
            });

            Aethra.EventBus.emit("navigation:item-activated", {
                id: windowId
            });

            return true;
        },

        getButton(windowId) {
            const nav = this.getElement();

            if (!nav) return null;

            return nav.querySelector(
                `[data-window-id="${CSS.escape(windowId)}"]`
            );
        },

        getElement() {
            return document.getElementById(this.navId);
        },

        addItem(item) {
            if (!item || !item.id || !item.label) {
                return false;
            }

            const existingIndex = this.items.findIndex(
                (current) => current.id === item.id
            );

            if (existingIndex >= 0) {
                this.items[existingIndex] = {
                    ...this.items[existingIndex],
                    ...item
                };
            } else {
                this.items.push({ ...item });
            }

            const nav = this.getElement();

            if (nav) {
                const oldButton = this.getButton(item.id);

                if (oldButton) {
                    oldButton.replaceWith(this.createButton(item));
                } else {
                    nav.appendChild(this.createButton(item));
                }
            }

            Aethra.EventBus.emit("navigation:item-added", {
                item: { ...item }
            });

            return true;
        },

        removeItem(windowId) {
            this.items = this.items.filter((item) => item.id !== windowId);

            const button = this.getButton(windowId);

            if (button) {
                button.remove();
            }

            Aethra.EventBus.emit("navigation:item-removed", {
                id: windowId
            });

            return true;
        },

        injectStyles() {
            if (document.getElementById("aethra-navigation-menu-styles")) {
                return;
            }

            const style = document.createElement("style");
            style.id = "aethra-navigation-menu-styles";

            style.textContent = `
                .aethra-main-nav {
                    position: fixed;
                    left: 50%;
                    z-index: 9999;
                    width: min(760px, calc(100% - 24px));
                    display: grid;
                    grid-template-columns: repeat(5, minmax(0, 1fr));
                    gap: 8px;
                    padding: 10px;
                    border: 1px solid rgba(111, 151, 199, .35);
                    border-radius: 14px;
                    background: rgba(7, 17, 29, .94);
                    box-shadow: 0 14px 40px rgba(0, 0, 0, .4);
                    backdrop-filter: blur(14px);
                    transform: translateX(-50%);
                }

                .aethra-main-nav--bottom {
                    bottom: 12px;
                }

                .aethra-main-nav--top {
                    top: 12px;
                }

                .aethra-main-nav__button {
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    padding: 9px 6px;
                    border: 1px solid transparent;
                    border-radius: 10px;
                    background: transparent;
                    color: #9db0c9;
                    font: inherit;
                    cursor: pointer;
                    transition:
                        background .16s ease,
                        border-color .16s ease,
                        color .16s ease,
                        transform .16s ease;
                }

                .aethra-main-nav__button:hover {
                    color: #ffffff;
                    background: rgba(37, 74, 113, .45);
                    transform: translateY(-1px);
                }

                .aethra-main-nav__button.is-active {
                    color: #ffffff;
                    border-color: rgba(95, 176, 255, .7);
                    background: linear-gradient(
                        180deg,
                        rgba(36, 102, 166, .85),
                        rgba(18, 57, 95, .9)
                    );
                }

                .aethra-main-nav__icon {
                    font-size: 20px;
                    line-height: 1;
                }

                .aethra-main-nav__label {
                    max-width: 100%;
                    overflow: hidden;
                    font-size: 12px;
                    font-weight: 700;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                @media (max-width: 560px) {
                    .aethra-main-nav {
                        width: calc(100% - 12px);
                        bottom: 6px;
                        gap: 3px;
                        padding: 6px;
                    }

                    .aethra-main-nav__button {
                        padding: 8px 2px;
                    }

                    .aethra-main-nav__label {
                        font-size: 10px;
                    }
                }
            `;

            document.head.appendChild(style);
        }
    };

    function startNavigationMenu() {
        Aethra.NavigationMenu.init();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            startNavigationMenu,
            { once: true }
        );
    } else {
        startNavigationMenu();
    }
})(window.Aethra);
