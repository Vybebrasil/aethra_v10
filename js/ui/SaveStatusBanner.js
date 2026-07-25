/*
 * SaveStatusBanner.js — Aviso persistente de falha de persistência.
 *
 * O SaveManager é infraestrutura e não toca no DOM: ele apenas emite
 * `save:error`. Sem ninguém escutando, uma falha de gravação (cota do
 * localStorage estourada, modo privado, disco cheio) só aparecia no console
 * e o jogador seguia jogando achando que o progresso estava salvo.
 *
 * O aviso é persistente de propósito: perder progresso é grave demais para um
 * toast de dois segundos. Ele some sozinho quando um save volta a funcionar.
 */
(function initSaveStatusBanner(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;
    if (Aethra._saveStatusBannerApplied) return;
    Aethra._saveStatusBannerApplied = true;

    const BANNER_ID = "aethra-save-status";
    let banner = null;

    function describe(error) {
        const name = String(error?.name || "");
        const message = String(error?.message || "");

        if (/quota|exceed/i.test(`${name} ${message}`)) {
            return "O armazenamento local encheu. Libere espaço ou apague saves antigos para voltar a salvar.";
        }

        if (/secur|denied|access/i.test(`${name} ${message}`)) {
            return "O navegador bloqueou o armazenamento local (janela anônima ou permissão negada).";
        }

        return message || "Motivo desconhecido.";
    }

    function ensureStyles() {
        if (document.getElementById("aethra-save-status-styles")) return;

        const style = document.createElement("style");
        style.id = "aethra-save-status-styles";
        style.textContent = `
            #${BANNER_ID} {
                position: fixed;
                z-index: 99999;
                left: 50%;
                bottom: 18px;
                transform: translateX(-50%);
                display: flex;
                align-items: center;
                gap: 12px;
                max-width: min(680px, calc(100vw - 32px));
                padding: 12px 16px;
                border: 1px solid rgba(255, 138, 128, 0.55);
                border-radius: 10px;
                background: rgba(46, 12, 12, 0.97);
                box-shadow: 0 14px 38px rgba(0, 0, 0, 0.55);
                color: #ffd9d4;
                font: 13px/1.4 "Outfit", system-ui, sans-serif;
            }

            #${BANNER_ID}[hidden] { display: none; }

            #${BANNER_ID} .save-status__icon {
                flex: 0 0 auto;
                font-size: 18px;
            }

            #${BANNER_ID} strong {
                display: block;
                margin-bottom: 2px;
                color: #fff3f1;
                font-size: 13px;
                letter-spacing: 0.02em;
            }

            #${BANNER_ID} small {
                color: #f3b7b0;
                font-size: 12px;
            }

            #${BANNER_ID} button {
                flex: 0 0 auto;
                padding: 7px 12px;
                border: 1px solid rgba(255, 173, 165, 0.5);
                border-radius: 7px;
                background: rgba(0, 0, 0, 0.35);
                color: #ffd9d4;
                font: inherit;
                font-weight: 600;
                cursor: pointer;
            }

            #${BANNER_ID} button:hover {
                background: rgba(255, 120, 110, 0.28);
            }
        `;
        document.head.appendChild(style);
    }

    function ensureBanner() {
        if (banner && document.body.contains(banner)) return banner;

        ensureStyles();

        banner = document.createElement("div");
        banner.id = BANNER_ID;
        banner.hidden = true;
        banner.setAttribute("role", "alert");
        banner.setAttribute("aria-live", "assertive");
        banner.innerHTML = `
            <span class="save-status__icon" aria-hidden="true">⚠</span>
            <div>
                <strong>O progresso não está sendo salvo</strong>
                <small data-save-status-detail></small>
            </div>
            <button type="button" data-save-status-retry>Tentar de novo</button>
        `;

        banner.querySelector("[data-save-status-retry]")
            ?.addEventListener("click", () => {
                // save() reemite save:error se ainda falhar, mantendo o aviso.
                Aethra.SaveManager?.save?.("retry-manual");
            });

        document.body.appendChild(banner);
        return banner;
    }

    function show(error) {
        const element = ensureBanner();
        const detail = element.querySelector("[data-save-status-detail]");
        if (detail) detail.textContent = describe(error);
        element.hidden = false;
    }

    function hide() {
        if (banner) banner.hidden = true;
    }

    Aethra.EventBus.on("save:error", (payload) => show(payload?.error));
    Aethra.EventBus.on("save:completed", hide);

    Aethra.SaveStatusBanner = { show, hide };
})(window.Aethra = window.Aethra || {});
