/*
 * Ui3Window.js — moldura de janela modal da UI 3.0 (fase 3).
 *
 * Cada janela nova assume a apresentação de uma janela clássica pelo
 * WindowManager.registerPresenter: quem chama openWindow("inventory-view")
 * continua chamando igual, e a versão nova aparece quando a UI 3.0 está
 * ligada. Esc e exclusividade seguem as regras do WindowManager.
 */
(function initUi3Window(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const CLOSE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"></path><path d="M18 6 6 18"></path></svg>';
    const FOCUSABLE = "input:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])";

    const windows = new Map();

    function kit() {
        return Aethra.Ui3Kit;
    }

    function isActive() {
        return Boolean(Aethra.Ui3Shell?.canShowGame?.());
    }

    // Enquanto um diálogo está aberto, as outras telas da UI 3.0 não recebem
    // foco nem clique (as clássicas ficam inertes pelo data-ui3-covers).
    function syncSiblingInert() {
        const root = Aethra.Ui3Shell?.root;
        if (!root) return;
        const anyOpen = [...windows.values()].some((entry) => entry.open);
        root.querySelectorAll(":scope > [data-ui3-screen]:not([data-ui3-window])").forEach((screen) => {
            screen.inert = anyOpen;
        });
    }

    function build(entry) {
        const K = kit();
        const root = Aethra.Ui3Shell?.root;
        if (!root || !K) return null;
        const titleId = `ui3-dialog-${entry.id}-title`;
        const layer = document.createElement("div");
        layer.className = "ui3-dialog-layer";
        layer.dataset.ui3Screen = `dialog-${entry.id}`;
        layer.dataset.ui3Window = entry.id;
        layer.dataset.ui3Covers = "world topbar";
        layer.hidden = true;
        layer.innerHTML = `<div class="ui3-dialog-backdrop" data-ui3-dialog-dismiss></div>
            <section class="ui3-dialog ${K.esc(entry.className || "")}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
                <header class="ui3-dialog__head">
                    <h2 class="ui3-dialog__title" id="${titleId}">${K.esc(entry.title)}</h2>
                    <span class="ui3-dialog__subtitle" data-ui3-dialog-subtitle></span>
                    <div class="ui3-dialog__extra" data-ui3-dialog-extra></div>
                    <button type="button" class="ui3-btn ui3-btn--icon" data-ui3-dialog-close aria-label="Fechar ${K.esc(entry.title)}">${CLOSE_ICON}</button>
                </header>
                <div class="ui3-dialog__body" data-ui3-dialog-body></div>
            </section>`;
        layer.addEventListener("click", (event) => {
            if (event.target.closest("[data-ui3-dialog-close]") || event.target.matches("[data-ui3-dialog-dismiss]")) {
                Aethra.WindowManager?.closeWindow?.(entry.id, { source: "ui3-dialog" });
            }
        });
        root.appendChild(layer);
        entry.layer = layer;
        entry.body = layer.querySelector("[data-ui3-dialog-body]");
        entry.subtitle = layer.querySelector("[data-ui3-dialog-subtitle]");
        entry.extra = layer.querySelector("[data-ui3-dialog-extra]");
        entry.setup?.(entry.body, entry);
        return layer;
    }

    function ensureLayer(entry) {
        const root = Aethra.Ui3Shell?.root;
        if (entry.layer && root?.contains(entry.layer)) return entry.layer;
        return build(entry);
    }

    function refresh(entry) {
        if (!entry.open || !entry.layer) return false;
        const subtitle = entry.getSubtitle?.() || "";
        if (entry.subtitle.textContent !== subtitle) entry.subtitle.textContent = subtitle;
        const extra = entry.getHeaderExtra?.() || "";
        if (entry.lastExtra !== extra) {
            entry.extra.innerHTML = extra;
            entry.lastExtra = extra;
        }
        entry.render?.(entry.body, entry);
        return true;
    }

    function scheduleRefresh(entry) {
        if (!entry.open || entry.frame !== null) return;
        entry.frame = requestAnimationFrame(() => {
            entry.frame = null;
            refresh(entry);
        });
    }

    function open(entry, options = {}) {
        if (!isActive() || !ensureLayer(entry)) return false;
        const wasOpen = entry.open;
        entry.open = true;
        entry.layer.hidden = false;
        if (!wasOpen) {
            entry.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            entry.onOpen?.(options, entry);
        }
        refresh(entry);
        syncSiblingInert();
        Aethra.Ui3Shell?.refresh?.();
        if (!wasOpen) {
            const target = entry.layer.querySelector("[data-ui3-autofocus]")
                || entry.body.querySelector(FOCUSABLE)
                || entry.layer.querySelector("[data-ui3-dialog-close]");
            window.setTimeout(() => target?.focus?.({ preventScroll: true }), 0);
        }
        return true;
    }

    function close(entry) {
        if (!entry.open) return false;
        entry.open = false;
        if (entry.layer) entry.layer.hidden = true;
        entry.onClose?.(entry);
        syncSiblingInert();
        Aethra.Ui3Shell?.refresh?.();
        if (entry.returnFocus?.isConnected && !entry.returnFocus.closest("[inert]")) {
            entry.returnFocus.focus({ preventScroll: true });
        }
        entry.returnFocus = null;
        return true;
    }

    /*
     * definition = {
     *   id, title, className,
     *   setup(body, entry)      monta o esqueleto uma vez
     *   render(body, entry)     atualiza a cada mudança de estado
     *   getSubtitle(), getHeaderExtra(), onOpen(options), onClose()
     *   events: [eventos do EventBus que pedem atualização]
     * }
     */
    function define(definition) {
        if (!definition?.id || windows.has(definition.id)) return windows.get(definition?.id)?.api || null;
        const entry = {
            ...definition,
            open: false,
            layer: null,
            frame: null,
            lastExtra: null,
            returnFocus: null
        };
        entry.api = Object.freeze({
            id: entry.id,
            open: (options) => Aethra.WindowManager?.openWindow?.(entry.id, options) ?? open(entry, options),
            close: () => Aethra.WindowManager?.closeWindow?.(entry.id, { source: "ui3" }) ?? close(entry),
            isOpen: () => entry.open,
            refresh: () => refresh(entry),
            get element() {
                return entry.layer;
            }
        });
        windows.set(entry.id, entry);

        (definition.events || []).forEach((eventName) => Aethra.EventBus.on(eventName, () => scheduleRefresh(entry)));

        const presenter = {
            isActive,
            open: (options) => open(entry, options),
            close: () => close(entry),
            isOpen: () => entry.open
        };
        const register = () => Aethra.WindowManager?.registerPresenter?.(entry.id, presenter);
        if (!register()) Aethra.EventBus.on("window:manager-ready", register);
        return entry.api;
    }

    // Ao voltar para a interface clássica (ou sair do jogo), a janela nova
    // fecha pelo WindowManager, que também limpa a lista de janelas ativas.
    function closeInactive() {
        if (isActive()) return;
        windows.forEach((entry) => {
            if (entry.open) Aethra.WindowManager?.closeWindow?.(entry.id, { source: "ui3-inactive" });
        });
    }

    ["ui3:version-applied", "state:restored", "save:loaded"]
        .forEach((eventName) => Aethra.EventBus.on(eventName, closeInactive));

    Aethra.Ui3Window = Object.freeze({
        define,
        get: (id) => windows.get(id)?.api || null,
        anyOpen: () => [...windows.values()].some((entry) => entry.open)
    });
})(window.Aethra = window.Aethra || {});
