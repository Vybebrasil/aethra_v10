/*
 * Ui3TopBar.js — barra superior da UI 3.0 (fase 2).
 *
 * Navegação principal, carteira e atalhos B/K/M. Só apresenta: troca de
 * tela passa pelo UIManager, janelas pelo WindowManager e a carteira é lida
 * do herói. Enquanto as janelas não migram (fase 3), elas abrem as versões
 * clássicas, que ficam acima da #ui3-root.
 */
(function initUi3TopBar(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const SCREEN_ID = "topbar";
    const LEGACY_TOPBAR = "#hud-layer > .topbar";
    const MIN_HEIGHT = 48;
    const REFRESH_MS = 1000;

    const ICONS = Object.freeze({
        hunt: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"></path><path d="m13 19 6-6"></path><path d="m16 16 4 4"></path><path d="m19 21 2-2"></path></svg>',
        city: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18"></path><path d="M5 21V9l7-5 7 5v12"></path><path d="M10 21v-6h4v6"></path></svg>',
        bag: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12l1 13H5z"></path><path d="M9 8V6a3 3 0 0 1 6 0v2"></path></svg>',
        skills: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5z"></path><path d="m3 13 9 5 9-5"></path></svg>',
        map: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"></path><path d="M9 4v14"></path><path d="M15 6v14"></path></svg>',
        chevron: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>'
    });

    const MORE_ITEMS = Object.freeze([
        { window: "npc-shop-view", label: "Loja", hint: "Comprar e vender com mercadores" },
        { window: "quests-view", label: "Missões", hint: "Objetivos e recompensas" },
        { window: "automation-view", label: "Poções em combate", hint: "Quando cada poção é usada sozinha" },
        { window: "player-market-view", label: "Mercado", hint: "Comprar e anunciar" },
        { window: "premium-shop-view", label: "Cash", hint: "Itens de diamantes" },
        { window: "coliseum-view", label: "Coliseu", hint: "PvP e ranking" },
        { window: "social-view", label: "Social", hint: "Grupo e comunidade" },
        { window: "options-view", label: "Opções", hint: "Interface e batalha" }
    ]);

    const HOTKEYS = Object.freeze({ KeyB: "bag", KeyK: "skills", KeyM: "map" });

    let screen = null;
    let menuOpen = false;
    let lastHTML = "";
    let timer = null;
    let frame = null;

    function kit() {
        return Aethra.Ui3Kit;
    }

    function primaryView() {
        return Aethra.UIManager?.primaryView || Aethra.GameState?.ui?.primaryView || "hunt";
    }

    function wallet() {
        const hero = Aethra.GameState?.hero || {};
        return {
            gold: Number(hero.gold ?? hero.stats?.gold ?? 0),
            diamonds: Number(hero.diamonds ?? hero.stats?.diamonds ?? 0)
        };
    }

    function navButton({ id, label, icon, key = "", current = false, badge = 0 }) {
        const K = kit();
        const badgeHTML = badge > 0
            ? `<span class="ui3-topbar__badge" aria-label="${K.esc(`${badge} ${badge === 1 ? "ponto livre" : "pontos livres"}`)}">${K.formatNumber(badge)}</span>`
            : "";
        return `<button type="button" class="ui3-topbar__nav-item" data-ui3-nav="${K.esc(id)}"${current ? ' aria-current="page"' : ""}${key ? ` aria-keyshortcuts="${K.esc(key)}"` : ""}>${icon}<span>${K.esc(label)}</span>${badgeHTML}${key ? `<kbd class="ui3-kbd">${K.esc(key)}</kbd>` : ""}</button>`;
    }

    function menuHTML() {
        const K = kit();
        const items = MORE_ITEMS.map((item) => `<button type="button" role="menuitem" class="ui3-menu__item" data-ui3-open-window="${K.esc(item.window)}"><span>${K.esc(item.label)}</span><small>${K.esc(item.hint)}</small></button>`).join("");
        return `<div class="ui3-menu" role="menu" aria-label="Mais opções" data-ui3-more-menu${menuOpen ? "" : " hidden"}>
            ${items}
            <div class="ui3-menu__separator" role="separator"></div>
            <button type="button" role="menuitem" class="ui3-menu__item" data-ui3-title-open><span>Tela inicial</span><small>Continuar ou começar um novo herói</small></button>
        </div>`;
    }

    function render() {
        const K = kit();
        if (!screen || !K) return false;
        const view = primaryView();
        const money = wallet();
        const html = `<div class="ui3-topbar__brand">
                <span class="ui3-topbar__mark" aria-hidden="true">A</span>
                <span class="ui3-topbar__title">Crônicas de Aethra</span>
            </div>
            <nav class="ui3-topbar__nav" aria-label="Menu principal">
                ${navButton({ id: "hunt", label: "Hunt", icon: ICONS.hunt, current: view === "hunt" })}
                ${navButton({ id: "city", label: "Cidade", icon: ICONS.city, current: view === "city" })}
                ${navButton({ id: "bag", label: "Mochila", icon: ICONS.bag, key: "B" })}
                ${navButton({ id: "skills", label: "Habilidades", icon: ICONS.skills, key: "K", badge: Math.max(0, Math.floor(Number(Aethra.GameState?.hero?.skillPoints) || 0)) })}
                ${navButton({ id: "map", label: "Mapa", icon: ICONS.map, key: "M" })}
                <div class="ui3-topbar__more">
                    <button type="button" class="ui3-topbar__nav-item" data-ui3-more aria-haspopup="menu" aria-expanded="${menuOpen ? "true" : "false"}"><span>Mais</span>${ICONS.chevron}</button>
                    ${menuHTML()}
                </div>
            </nav>
            <div class="ui3-topbar__wallet" aria-label="Carteira">
                ${Aethra.Ui3SaveStatus?.chipHTML?.() || ""}
                <span class="ui3-currency"><span class="ui3-currency__coin" aria-hidden="true"></span><strong data-ui3-wallet="gold">${K.formatNumber(money.gold)}</strong><small>ouro</small></span>
                <span class="ui3-currency"><span class="ui3-currency__gem" aria-hidden="true"></span><strong data-ui3-wallet="diamonds">${K.formatNumber(money.diamonds)}</strong><small>diamantes</small></span>
            </div>`;
        if (html !== lastHTML) {
            screen.innerHTML = html;
            lastHTML = html;
        }
        return true;
    }

    function scheduleRender() {
        if (frame !== null || !screen || screen.hidden) return;
        frame = requestAnimationFrame(() => {
            frame = null;
            render();
        });
    }

    // A barra nova cobre a clássica: mesma altura, para a cidade e as janelas
    // clássicas continuarem alinhadas embaixo dela.
    function syncHeight() {
        const legacy = document.querySelector(LEGACY_TOPBAR);
        const height = Math.max(MIN_HEIGHT, Math.round(legacy?.getBoundingClientRect?.().height || 0));
        Aethra.Ui3Shell?.root?.style.setProperty("--ui3-topbar-h", `${height}px`);
    }

    function setMenuOpen(open) {
        menuOpen = Boolean(open);
        render();
        if (menuOpen) screen?.querySelector("[data-ui3-more-menu] [role='menuitem']")?.focus();
    }

    function toggleWindow(windowId) {
        const manager = Aethra.WindowManager;
        if (!manager) return false;
        return manager.isOpen?.(windowId)
            ? manager.closeWindow(windowId, { source: "ui3-topbar" })
            : manager.openWindow(windowId, { source: "ui3-topbar" });
    }

    function runNav(id) {
        switch (id) {
            case "hunt":
            case "city":
                return Aethra.UIManager?.setPrimaryView?.(id, { source: "ui3-topbar" });
            case "bag":
                return toggleWindow("inventory-view");
            case "skills":
                return toggleWindow("skills-view");
            case "map":
                if (Aethra.WindowManager?.isOpen?.("hunt-world-map-view")) {
                    return Aethra.WindowManager.closeWindow("hunt-world-map-view", { source: "ui3-topbar" });
                }
                return Aethra.Ui3Navigation?.openHuntMap?.({ source: "ui3-topbar" });
            default:
                return false;
        }
    }

    function onClick(event) {
        if (event.target.closest("[data-ui3-save-chip]")) {
            setMenuOpen(false);
            Aethra.Ui3SaveStatus?.onChipClick?.();
            return;
        }
        const nav = event.target.closest("[data-ui3-nav]");
        if (nav) {
            setMenuOpen(false);
            runNav(nav.dataset.ui3Nav);
            render();
            return;
        }
        if (event.target.closest("[data-ui3-more]")) {
            setMenuOpen(!menuOpen);
            return;
        }
        const windowItem = event.target.closest("[data-ui3-open-window]");
        if (windowItem) {
            setMenuOpen(false);
            toggleWindow(windowItem.dataset.ui3OpenWindow);
            return;
        }
        if (event.target.closest("[data-ui3-title-open]")) {
            setMenuOpen(false);
            Aethra.Ui3TitleScreen?.show?.();
        }
    }

    function isTyping(target) {
        return target instanceof Element
            && Boolean(target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
    }

    function onKeyDown(event) {
        if (!screen || screen.hidden) return;
        if (event.key === "Escape" && menuOpen) {
            setMenuOpen(false);
            screen.querySelector("[data-ui3-more]")?.focus();
            return;
        }
        if (event.defaultPrevented || event.repeat || isTyping(event.target)) return;
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        const action = HOTKEYS[event.code];
        if (!action) return;
        event.preventDefault();
        runNav(action);
    }

    function onDocumentPointer(event) {
        if (menuOpen && !event.target.closest?.(".ui3-topbar__more")) setMenuOpen(false);
    }

    function ensureScreen() {
        const root = Aethra.Ui3Shell?.root;
        if (!root) return null;
        if (screen && root.contains(screen)) return screen;
        screen = document.createElement("header");
        screen.className = "ui3-topbar";
        screen.dataset.ui3Screen = SCREEN_ID;
        screen.dataset.ui3Covers = "topbar";
        screen.hidden = true;
        screen.addEventListener("click", onClick);
        root.prepend(screen);
        lastHTML = "";
        return screen;
    }

    function sync() {
        const visible = Boolean(Aethra.Ui3Shell?.canShowGame?.());
        if (!visible && !screen) return false;
        ensureScreen();
        if (!screen) return false;
        screen.hidden = !visible;
        if (visible) {
            syncHeight();
            render();
            if (!timer) timer = window.setInterval(render, REFRESH_MS);
        } else {
            menuOpen = false;
            if (timer) window.clearInterval(timer);
            timer = null;
        }
        Aethra.Ui3Shell?.refresh?.();
        return visible;
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onDocumentPointer);
    window.addEventListener("resize", () => {
        if (screen && !screen.hidden) syncHeight();
    }, { passive: true });

    ["ui3:version-applied", "ui3:screens-changed", "ui:primary-view-changed", "character:created", "state:restored", "save:loaded", "engine:ready"]
        .forEach((eventName) => Aethra.EventBus.on(eventName, () => {
            sync();
            window.setTimeout(sync, 0);
        }));
    ["goldChanged", "hunt:updated", "battle:rewards-granted", "window:opened", "levelUp", "skill-point:spent"]
        .forEach((eventName) => Aethra.EventBus.on(eventName, scheduleRender));

    Aethra.Ui3TopBar = {
        sync,
        render,
        isVisible: () => Boolean(screen && !screen.hidden),
        setMenuOpen
    };
})(window.Aethra = window.Aethra || {});
