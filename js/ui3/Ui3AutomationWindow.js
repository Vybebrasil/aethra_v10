/*
 * Ui3AutomationWindow.js — Automação na UI 3.0 (fase 5.3).
 *
 * Janela "automation-view": continuidade da caçada, auto-venda de loot e uso
 * automático de poções em combate. Não há reposição nem compra por aqui:
 * suprimento se compra no mercador (ou se fabrica na Alquimia).
 *   leitura   IdleLoopSystem.getSupplyOverview
 *   comandos  IdleLoopSystem.updateSetting, configureAutoUse
 * Cada ajuste vale na hora; não há "salvar".
 */
(function initUi3AutomationWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "automation-view";

    const state = { deferred: false };
    const rendered = new WeakMap();
    let parts = {};

    function kit() {
        return Aethra.Ui3Kit;
    }

    function idle() {
        return Aethra.IdleLoopSystem;
    }

    function patch(element, html) {
        if (!element || rendered.get(element) === html) return false;
        element.innerHTML = html;
        rendered.set(element, html);
        return true;
    }

    function whole(value, max = 99) {
        const parsed = Math.floor(Number(value));
        return Math.min(max, Math.max(0, Number.isFinite(parsed) ? parsed : 0));
    }

    function gold() {
        return whole(Aethra.GameState?.hero?.gold, Number.MAX_SAFE_INTEGER);
    }

    function numberInput({ value, min = 0, max = 99, step = 1, label, attributes }) {
        const K = kit();
        const attrs = Object.entries(attributes).map(([key, val]) => ` ${key}="${K.esc(val)}"`).join("");
        return `<input type="number" class="ui3-number" inputmode="numeric" min="${min}" max="${max}" step="${step}" value="${K.esc(value)}" aria-label="${K.esc(label)}"${attrs}>`;
    }

    function settingsHTML(config) {
        const K = kit();
        const row = (title, caption, key, checked) => `<div class="ui3-row-between ui3-automation__setting">
                <span class="ui3-list-row__text"><strong>${K.esc(title)}</strong><small>${K.esc(caption)}</small></span>
                ${K.toggle({ checked, label: title, onText: "Ligado", offText: "Desligado", attributes: { "data-ui3-auto-setting": key } })}
            </div>`;
        return `<section class="ui3-options__section">
                <span class="ui3-eyebrow">Ciclo da caçada</span>
                ${row("Continuidade", "Ao fim de cada andar ou caçada, vende o loot.", "enabled", config.enabled)}
                ${row("Auto-venda", "Vende só materiais e loot; equipamento fica na mochila.", "autoSell", config.autoSell)}
                ${row("Guardar materiais de ofício", "Minério, couro, ervas e lingotes que as Oficinas usam não são vendidos.", "keepCraftingMaterials", config.keepCraftingMaterials)}
                <div class="ui3-kpi-grid">
                    ${K.kpi({ label: "Ciclos", value: K.formatNumber(config.cyclesCompleted) })}
                    ${K.kpi({ label: "Auto-venda", value: `${config.totalProfit > 0 ? "+" : ""}${K.formatNumber(config.totalProfit)} o`, tone: config.totalProfit > 0 ? "positive" : "" })}
                </div>
            </section>`;
    }

    function supplyHTML(supply) {
        const K = kit();
        const range = idle().autoUseRange || { min: 5, max: 95 };
        const where = supply.unitPrice > 0
            ? `Mercador: ${K.formatNumber(supply.unitPrice)} o cada${supply.craftRecipeId ? " · ou fabrique na Alquimia" : ""}`
            : `O mercador não vende${supply.craftRecipeId ? "; fabrique na Alquimia" : ""}.`;
        return `<article class="ui3-city-card ui3-automation__supply">
                <header class="ui3-row-between">
                    <span class="ui3-row"><span class="ui3-glyph-box" aria-hidden="true">${K.esc(supply.icon)}</span>
                        <span class="ui3-list-row__text"><strong>${K.esc(supply.label)}</strong><small>${K.esc(supply.role)} · ${K.esc(supply.effect)}</small></span></span>
                    <span class="ui3-list-row__text ui3-automation__stock"><strong>${K.formatNumber(supply.current)}</strong><small class="${supply.current > 0 ? "" : "ui3-text-warn"}">${supply.current > 0 ? "na mochila" : "acabou"}</small></span>
                </header>
                <div class="ui3-automation__controls">
                    ${supply.autoUse ? `<div class="ui3-row-between"><span>Usar em combate abaixo de</span><span class="ui3-row">${numberInput({ value: supply.autoUse.thresholdPercent, min: range.min, max: range.max, step: 5, label: `Limite de uso de ${supply.label}`, attributes: { "data-ui3-auto-threshold": supply.id } })}<span>%</span>${K.toggle({ checked: supply.autoUse.enabled, label: `Usar ${supply.label} automaticamente`, onText: "Usar", offText: "Manual", attributes: { "data-ui3-auto-use": supply.id } })}</span></div>`
                        : `<p class="ui3-caption">Uso manual, quando o herói estiver envenenado.</p>`}
                    <p class="ui3-caption">${K.esc(where)}</p>
                </div>
            </article>`;
    }

    // Campo numérico em edição: redesenhar agora tiraria o foco no meio da digitação.
    function isEditing() {
        const active = document.activeElement;
        return Boolean(parts.body && active && parts.body.contains(active) && active.matches("input"));
    }

    function render() {
        const K = kit();
        if (!idle()?.getSupplyOverview) return;
        if (isEditing()) {
            state.deferred = true;
            return;
        }
        state.deferred = false;
        const { config, supplies } = idle().getSupplyOverview();
        patch(parts.body, `${settingsHTML(config)}
            <section class="ui3-options__section">
                <span class="ui3-eyebrow">Suprimentos na mochila</span>
                <p class="ui3-caption">Nada é comprado sozinho: quando acabar, volte ao mercador, venda o loot ou fabrique.</p>
                <div class="ui3-automation__supplies">${supplies.map(supplyHTML).join("")}</div>
                ${K.button({ label: "Abrir loja", attributes: { "data-ui3-open-window": "npc-shop-view" } })}
            </section>`);
    }

    function onClick(event) {
        const target = event.target;
        const setting = target.closest("[data-ui3-auto-setting]");
        if (setting) {
            const key = setting.dataset.ui3AutoSetting;
            idle().updateSetting(key, !idle().config[key]);
            return render();
        }
        const autoUse = target.closest("[data-ui3-auto-use]");
        if (autoUse) {
            idle().configureAutoUse({ [autoUse.dataset.ui3AutoUse]: { enabled: autoUse.getAttribute("aria-checked") !== "true" } });
            return render();
        }
        const windowButton = target.closest("[data-ui3-open-window]");
        if (windowButton) return Aethra.WindowManager?.openWindow?.(windowButton.dataset.ui3OpenWindow, { source: "ui3-automation" });
        return undefined;
    }

    // Números valem ao sair do campo (change), sem redesenhar enquanto se digita.
    function onChange(event) {
        const input = event.target;
        const threshold = input.closest("[data-ui3-auto-threshold]");
        if (threshold) {
            idle().configureAutoUse({ [threshold.dataset.ui3AutoThreshold]: { thresholdPercent: input.value } });
            input.blur();
            return render();
        }
        return undefined;
    }

    function setup(body) {
        body.classList.add("ui3-options");
        body.innerHTML = `<div class="ui3-options__body ui3-scroll" data-ui3-part="body"></div>`;
        parts = { body: body.querySelector("[data-ui3-part='body']") };
        body.addEventListener("click", onClick);
        body.addEventListener("change", onChange);
        body.addEventListener("focusout", () => window.setTimeout(() => {
            if (state.deferred) render();
        }, 0));
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3AutomationWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Automação",
            className: "ui3-dialog--medium",
            setup,
            render,
            getSubtitle: () => "Auto-venda e uso de poções",
            getHeaderExtra: () => `<span class="ui3-currency"><span class="ui3-currency__coin" aria-hidden="true"></span><strong>${kit().formatNumber(gold())}</strong><small>ouro</small></span>`,
            events: ["idle-loop:updated", "consumable:used", "consumable:policy-changed", "goldChanged", "inventory:changed", "bag:changed"]
        });
    }
})(window.Aethra = window.Aethra || {});
