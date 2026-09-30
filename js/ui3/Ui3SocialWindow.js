/*
 * Ui3SocialWindow.js — Social na UI 3.0 (fase 5.2).
 *
 * Assume "social-view" pelo Ui3Window/WindowManager. Nesta sessão local não
 * há outros jogadores: a janela diz isso com clareza e leva ao que existe
 * (o mercador da vila). Grupo e guilda aparecem como indisponíveis até haver
 * servidor.
 */
(function initUi3SocialWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "social-view";
    const FEATURES = Object.freeze([
        {
            id: "merchant",
            eyebrow: "NPC disponível",
            title: "Mercador da Vila",
            body: "Compre suprimentos e venda loot na Cidade.",
            action: "Visitar mercador",
            symbol: "bag",
            available: true
        },
        {
            id: "party",
            eyebrow: "Grupo",
            title: "Companheiros",
            body: "Não há outros jogadores conectados nesta sessão local.",
            action: "Requer modo online",
            symbol: "shield"
        },
        {
            id: "guild",
            eyebrow: "Comunidade",
            title: "Guilda",
            body: "Guildas, convites e chat chegam com a infraestrutura online.",
            action: "Indisponível offline",
            symbol: "layers"
        }
    ]);

    let body = null;

    function kit() {
        return Aethra.Ui3Kit;
    }

    function featureHTML(feature) {
        const K = kit();
        return `<article class="ui3-service${feature.available ? "" : " is-locked"}">
                <div class="ui3-service__visual"><span class="ui3-service__icon">${K.icon(feature.symbol, 28)}</span></div>
                <div class="ui3-service__text">
                    <span class="ui3-eyebrow">${K.esc(feature.eyebrow)}</span>
                    <h2 class="ui3-service__title">${K.esc(feature.title)}</h2>
                    <p>${K.esc(feature.body)}</p>
                </div>
                ${K.button({ label: feature.action, variant: feature.available ? "primary" : "secondary", disabled: !feature.available, attributes: { "data-ui3-social": feature.id } })}
            </article>`;
    }

    function render() {
        if (!body || !kit()) return;
        const html = `<div class="ui3-options__body ui3-scroll">
                <div class="ui3-note"><span>Sessão local</span><strong>O progresso fica salvo neste dispositivo. Recursos online exigem um servidor conectado.</strong></div>
                <div class="ui3-social__list">${FEATURES.map(featureHTML).join("")}</div>
            </div>`;
        if (body.innerHTML !== html) body.innerHTML = html;
    }

    function onClick(event) {
        if (event.target.closest("[data-ui3-social='merchant']")) {
            return Aethra.WindowManager?.openWindow?.("npc-shop-view", { source: "ui3-social" });
        }
        return undefined;
    }

    function setup(element) {
        body = element;
        body.classList.add("ui3-options");
        body.addEventListener("click", onClick);
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3SocialWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Social",
            setup,
            render,
            getSubtitle: () => "Comunidade"
        });
    }
})(window.Aethra = window.Aethra || {});
