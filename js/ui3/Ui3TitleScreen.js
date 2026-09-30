/*
 * Ui3TitleScreen.js — tela de título da UI 3.0 (fase 4).
 *
 * Substitui o lobby de 3 slots (decisão de 2026-09-30): um herói por save,
 * persistido só pelo SaveManager. Aparece ao abrir o jogo com a UI 3.0 e um
 * herói já criado; sem herói, a criação assume direto.
 *   leitura   GameState.hero (só lê), HuntSystem (última rota)
 *   comandos  "Continuar" libera as telas de jogo; "Novo herói" chama
 *             SaveManager.reset (apaga save local e do servidor e recarrega),
 *             sempre depois de uma confirmação explícita.
 */
(function initUi3TitleScreen(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const SCREEN_ID = "title";
    const HOLD_KEY = "title";

    let screen = null;
    let parts = {};
    let bootChecked = false;
    let eligible = false;
    let open = false;
    let confirming = false;
    let failure = null;
    const rendered = new WeakMap();

    function kit() {
        return Aethra.Ui3Kit;
    }

    function patch(element, html) {
        if (!element || rendered.get(element) === html) return false;
        element.innerHTML = html;
        rendered.set(element, html);
        return true;
    }

    function number(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function hero() {
        return Aethra.GameState?.hero || {};
    }

    function heroCreated() {
        return hero().characterCreated === true;
    }

    function archetypeName(id) {
        const definitions = Aethra.CharacterBuildSystem?.archetypes || {};
        return definitions[id]?.name || "";
    }

    function lastRouteName() {
        const hunt = Aethra.GameState?.hunt || {};
        return Aethra.HuntSystem?.getHuntDefinition?.(hunt.huntId)?.name || null;
    }

    /* ---------------------------------------------------------------
       Renderização
       --------------------------------------------------------------- */

    function heroCardHTML() {
        const K = kit();
        const current = hero();
        const level = Math.max(1, Math.floor(number(current.level, 1)));
        const xpNext = Math.max(1, number(current.xpNext, 1));
        const xpPercent = Math.max(0, Math.min(100, (number(current.xpCurrent) / xpNext) * 100));
        const portrait = Aethra.SpriteLoader?.getHeroSource?.(current.archetypeId) || "";
        const route = lastRouteName();
        return `<div class="ui3-title-hero">
                <div class="ui3-portrait ui3-portrait--hero">
                    ${portrait ? `<img class="ui3-portrait__img" src="${K.esc(portrait)}" alt="" draggable="false">` : ""}
                    <span class="ui3-portrait__level" aria-label="Nível ${level}">${level}</span>
                </div>
                <div class="ui3-stack">
                    <strong class="ui3-quest-head__title">${K.esc(current.name || "Herói")}</strong>
                    <span class="ui3-caption">${K.esc([archetypeName(current.archetypeId), `Nível ${level}`].filter(Boolean).join(" · "))}</span>
                    ${K.bar({ kind: "xp", value: xpPercent, max: 100, label: "Experiência" })}
                </div>
            </div>
            <div class="ui3-kpi-grid ui3-kpi-grid--3">
                ${K.kpi({ label: "Ouro", value: K.formatNumber(current.gold) })}
                ${K.kpi({ label: "Vida", value: `${K.formatNumber(current.hp)}/${K.formatNumber(current.maxHp)}` })}
                ${K.kpi({ label: "Última rota", value: route || "Cidade" })}
            </div>`;
    }

    function actionsHTML() {
        const K = kit();
        if (confirming) {
            return `<div class="ui3-title-confirm" role="alertdialog" aria-labelledby="ui3-title-confirm-text">
                    <p id="ui3-title-confirm-text"><strong>Começar do zero apaga ${K.esc(hero().name || "este herói")}</strong>: nível, itens, ouro e missões, também no save do servidor. Não dá para desfazer.</p>
                    <div class="ui3-expedition__row">
                        ${K.button({ label: "Cancelar", attributes: { "data-ui3-title-cancel": "", "data-ui3-autofocus": "" } })}
                        ${K.button({ label: "Apagar e criar novo herói", variant: "danger", attributes: { "data-ui3-title-reset": "" } })}
                    </div>
                </div>`;
        }
        return `${failure ? `<p class="ui3-notice ui3-notice--error" role="alert">${K.esc(failure)}</p>` : ""}
            ${K.button({ label: "Continuar", variant: "primary", attributes: { "data-ui3-title-continue": "", "data-ui3-autofocus": "" } })}
            <div class="ui3-expedition__row">
                ${K.button({ label: "Novo herói", variant: "ghost", attributes: { "data-ui3-title-new": "" } })}
                ${K.button({ label: "Interface clássica", variant: "ghost", attributes: { "data-ui3-title-classic": "" } })}
            </div>`;
    }

    function render() {
        if (!screen || screen.hidden || !kit()) return false;
        patch(parts.hero, heroCardHTML());
        patch(parts.actions, actionsHTML());
        return true;
    }

    function focusPrimary() {
        window.setTimeout(() => parts.actions?.querySelector("[data-ui3-autofocus]")?.focus({ preventScroll: true }), 0);
    }

    /* ---------------------------------------------------------------
       Comandos
       --------------------------------------------------------------- */

    function dismiss() {
        open = false;
        confirming = false;
        sync();
        return true;
    }

    function onClick(event) {
        const target = event.target;
        if (target.closest("[data-ui3-title-continue]")) return dismiss();
        if (target.closest("[data-ui3-title-new]")) {
            confirming = true;
            failure = null;
            render();
            return focusPrimary();
        }
        if (target.closest("[data-ui3-title-cancel]")) {
            confirming = false;
            render();
            return focusPrimary();
        }
        if (target.closest("[data-ui3-title-reset]")) {
            confirming = false;
            const done = Aethra.SaveManager?.reset?.({ reload: true }) === true;
            // Com sucesso a página recarrega na criação; se falhar, o jogador
            // volta às opções com um aviso em vez de ficar preso na confirmação.
            failure = done ? null : "Não foi possível apagar o save. Nada foi alterado.";
            render();
            return done;
        }
        if (target.closest("[data-ui3-title-classic]")) {
            open = false;
            return Aethra.SettingsManager?.setInterfaceVersion?.("classic", { source: "ui3-title" });
        }
        return undefined;
    }

    function onKeyDown(event) {
        if (event.key === "Escape" && confirming) {
            confirming = false;
            render();
            focusPrimary();
        }
    }

    /* ---------------------------------------------------------------
       Montagem e ciclo de vida
       --------------------------------------------------------------- */

    function buildScreen(root) {
        const element = document.createElement("section");
        element.className = "ui3-title";
        element.dataset.ui3Screen = SCREEN_ID;
        element.dataset.ui3Covers = "world topbar";
        element.setAttribute("aria-labelledby", "ui3-title-heading");
        element.hidden = true;
        element.innerHTML = `<div class="ui3-title__card">
                <div class="ui3-stack ui3-title__brand">
                    <span class="ui3-eyebrow">Bem-vindo a</span>
                    <h1 class="ui3-display" id="ui3-title-heading">Crônicas de Aethra</h1>
                </div>
                <div class="ui3-stack" data-ui3-part="hero"></div>
                <div class="ui3-stack ui3-title__actions" data-ui3-part="actions"></div>
                <p class="ui3-caption ui3-title__footer">Um herói por save, guardado pelo jogo e pelo servidor local.</p>
            </div>`;
        element.addEventListener("click", onClick);
        element.addEventListener("keydown", onKeyDown);
        root.appendChild(element);
        parts = {
            hero: element.querySelector("[data-ui3-part='hero']"),
            actions: element.querySelector("[data-ui3-part='actions']")
        };
        return element;
    }

    function ensureScreen() {
        const root = Aethra.Ui3Shell?.root;
        if (!root) return null;
        if (!screen || !root.contains(screen)) screen = buildScreen(root);
        return screen;
    }

    function sync() {
        const active = Boolean(Aethra.Ui3Shell?.isActive?.());
        const visible = open && active && heroCreated();
        Aethra.Ui3Shell?.holdGame?.(HOLD_KEY, visible);
        if (!visible && !screen) return false;
        ensureScreen();
        if (!screen) return false;
        const wasHidden = screen.hidden;
        screen.hidden = !visible;
        if (visible) {
            render();
            if (wasHidden) focusPrimary();
        }
        Aethra.Ui3Shell?.refresh?.();
        return visible;
    }

    // Só na abertura do jogo: trocar para a UI 3.0 no meio da sessão não
    // devolve o jogador à tela de título.
    function onBoot() {
        if (bootChecked) return sync();
        bootChecked = true;
        eligible = Boolean(Aethra.Ui3Shell?.isActive?.());
        // Sem herói a criação assume; depois dela o jogador entra direto.
        open = eligible && heroCreated();
        return sync();
    }

    function show() {
        if (!Aethra.Ui3Shell?.isActive?.() || !heroCreated()) return false;
        open = true;
        confirming = false;
        return sync();
    }

    Aethra.EventBus.on("engine:ready", () => window.setTimeout(onBoot, 0));
    Aethra.EventBus.on("character:created", () => {
        open = false;
        sync();
    });
    ["ui3:version-applied", "state:restored", "save:loaded"]
        .forEach((eventName) => Aethra.EventBus.on(eventName, () => {
            if (bootChecked) sync();
        }));
    ["goldChanged", "hunt:updated"].forEach((eventName) => Aethra.EventBus.on(eventName, () => render()));

    Aethra.Ui3TitleScreen = {
        show,
        dismiss,
        sync,
        isVisible: () => Boolean(screen && !screen.hidden)
    };
})(window.Aethra = window.Aethra || {});
