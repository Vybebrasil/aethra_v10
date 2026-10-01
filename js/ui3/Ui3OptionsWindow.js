/*
 * Ui3OptionsWindow.js — Opções na UI 3.0 (fase 5.2).
 *
 * Assume "options-view" pelo Ui3Window/WindowManager.
 *   leitura   SettingsManager (interface, velocidade, hud.reduceMotion),
 *             SaveManager.getSharedStatus
 *   comandos  SettingsManager.setCombatSpeed / set,
 *             SaveManager.save / reset (reset só depois de confirmar)
 * O modo de batalha (cartas ou mapa) e a HUD compacta são da interface
 * clássica: a Hunt da UI 3.0 é sempre o mapa.
 */
(function initUi3OptionsWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "options-view";
    const SPEEDS = Object.freeze([1, 2, 4]);
    const NOTICE_MS = 3500;

    const state = { confirmingReset: false, notice: null };
    const rendered = new WeakMap();
    let parts = {};
    let noticeTimer = null;

    function kit() {
        return Aethra.Ui3Kit;
    }

    function settings() {
        return Aethra.SettingsManager;
    }

    function patch(element, html) {
        if (!element || rendered.get(element) === html) return false;
        element.innerHTML = html;
        rendered.set(element, html);
        return true;
    }

    function hudPreferences() {
        const value = settings()?.get?.("hud", {});
        return value && typeof value === "object" ? value : {};
    }

    function notify(text, tone = "ok") {
        state.notice = { text, tone };
        if (noticeTimer) window.clearTimeout(noticeTimer);
        noticeTimer = window.setTimeout(() => {
            state.notice = null;
            noticeTimer = null;
            render();
        }, NOTICE_MS);
    }

    function sharedStatusText() {
        const status = Aethra.SaveManager?.getSharedStatus?.() || {};
        if (!status.supported) return "Salvo neste navegador.";
        if (!status.ready) return "Conectando ao save do servidor local…";
        return status.exists
            ? `Salvo neste navegador e no servidor local (revisão ${kit().formatNumber(status.revision)}).`
            : "Salvo neste navegador; o servidor local ainda não tem cópia.";
    }

    function sectionHTML(title, caption, body) {
        const K = kit();
        return `<section class="ui3-options__section">
                <div class="ui3-stack"><span class="ui3-eyebrow">${K.esc(title)}</span>${caption ? `<span class="ui3-caption">${K.esc(caption)}</span>` : ""}</div>
                ${body}
            </section>`;
    }

    function render() {
        const K = kit();
        const speed = settings()?.getCombatSpeed?.() || 1;
        const reduceMotion = hudPreferences().reduceMotion === true;
        const notice = state.notice
            ? `<p class="ui3-notice ui3-notice--${K.esc(state.notice.tone)}" role="status">${K.esc(state.notice.text)}</p>`
            : "";
        const speedChips = SPEEDS.map((value) => K.chip({ label: `${value}×`, pressed: value === speed, attributes: { "data-ui3-option-speed": value } })).join("");
        const reset = state.confirmingReset
            ? `<div class="ui3-title-confirm" role="alertdialog" aria-labelledby="ui3-options-reset-text">
                    <p id="ui3-options-reset-text"><strong>Apagar ${K.esc(Aethra.GameState?.hero?.name || "o herói")} e começar do zero?</strong> Nível, itens, ouro e missões somem também do save do servidor. Não dá para desfazer.</p>
                    <div class="ui3-expedition__row">
                        ${K.button({ label: "Cancelar", attributes: { "data-ui3-option-reset-cancel": "" } })}
                        ${K.button({ label: "Apagar e recomeçar", variant: "danger", attributes: { "data-ui3-option-reset-confirm": "" } })}
                    </div>
                </div>`
            : K.button({ label: "Apagar save e começar do zero", variant: "danger", attributes: { "data-ui3-option-reset": "" } });

        patch(parts.body, `${notice}
            ${sectionHTML("Combate", "Velocidade das rodadas ao entrar em combate.", `<div class="ui3-row" role="group" aria-label="Velocidade do combate">${speedChips}</div>`)}
            ${sectionHTML("Acessibilidade", "", `<div class="ui3-row-between"><span>Reduzir animações</span>${K.toggle({ checked: reduceMotion, label: "Reduzir animações", onText: "Ligado", offText: "Desligado", attributes: { "data-ui3-option-motion": "" } })}</div>`)}
            ${sectionHTML("Save", sharedStatusText(), `<div class="ui3-expedition__row">
                ${K.button({ label: "Salvar agora", attributes: { "data-ui3-option-save": "" } })}
                ${K.button({ label: "Tela inicial", attributes: { "data-ui3-option-title": "" } })}
            </div>`)}
            ${sectionHTML("Zona de perigo", "", reset)}`);
    }

    function onClick(event) {
        const target = event.target;
        const speedChip = target.closest("[data-ui3-option-speed]");
        if (speedChip) {
            settings()?.setCombatSpeed?.(Number(speedChip.dataset.ui3OptionSpeed), { source: "ui3-options" });
            return render();
        }
        if (target.closest("[data-ui3-option-motion]")) {
            const next = { ...hudPreferences(), reduceMotion: hudPreferences().reduceMotion !== true };
            settings()?.set?.("hud", next, { source: "ui3-options" });
            return render();
        }
        if (target.closest("[data-ui3-option-save]")) {
            const saved = Aethra.SaveManager?.save?.("ui3-options") === true;
            notify(saved ? "Jogo salvo." : "Não foi possível salvar agora.", saved ? "ok" : "error");
            return render();
        }
        if (target.closest("[data-ui3-option-title]")) {
            Aethra.WindowManager?.closeWindow?.(WINDOW_ID, { source: "ui3-options" });
            return Aethra.Ui3TitleScreen?.show?.();
        }
        if (target.closest("[data-ui3-option-reset]")) {
            state.confirmingReset = true;
            render();
            return parts.body.querySelector("[data-ui3-option-reset-cancel]")?.focus();
        }
        if (target.closest("[data-ui3-option-reset-cancel]")) {
            state.confirmingReset = false;
            return render();
        }
        if (target.closest("[data-ui3-option-reset-confirm]")) {
            state.confirmingReset = false;
            const done = Aethra.SaveManager?.reset?.({ reload: true }) === true;
            if (!done) notify("Não foi possível apagar o save. Nada foi alterado.", "error");
            return render();
        }
        return undefined;
    }

    function setup(body) {
        body.classList.add("ui3-options");
        body.innerHTML = `<div class="ui3-options__body ui3-scroll" data-ui3-part="body"></div>`;
        parts = { body: body.querySelector("[data-ui3-part='body']") };
        body.addEventListener("click", onClick);
    }

    function onOpen() {
        state.confirmingReset = false;
        state.notice = null;
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3OptionsWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Opções",
            setup,
            render,
            onOpen,
            getSubtitle: () => "Interface, combate e save",
            events: ["settings:changed", "save:completed", "save:shared-ready", "save:shared-empty"]
        });
    }
})(window.Aethra = window.Aethra || {});
