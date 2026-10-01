/*
 * Ui3AutomationWindow.js — Automação na UI 3.0 (fase 5.3).
 *
 * Janela "automation-view": continuidade da caçada, auto-venda de loot,
 * reposição de suprimentos (gatilho, meta, reserva e teto), uso automático
 * de poções em combate e compra imediata.
 *   leitura   IdleLoopSystem.getSupplyOverview
 *   comandos  IdleLoopSystem.updateSetting, configureRestock,
 *             configureAutoUse, purchaseSupplies
 * Cada ajuste vale na hora; não há "salvar".
 */
(function initUi3AutomationWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "automation-view";
    const NOTICE_MS = 4000;
    const STOCK = Object.freeze({
        manual: { label: "Só manual", tone: "" },
        ready: { label: "Estoque pronto", tone: "ui3-text-ok" },
        stable: { label: "Estoque estável", tone: "" },
        low: { label: "Abaixo do gatilho", tone: "ui3-text-warn" }
    });

    const state = { order: {}, notice: null, deferred: false };
    const rendered = new WeakMap();
    let parts = {};
    let noticeTimer = null;

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

    function notify(text, tone = "ok") {
        state.notice = { text, tone };
        if (noticeTimer) window.clearTimeout(noticeTimer);
        noticeTimer = window.setTimeout(() => {
            state.notice = null;
            noticeTimer = null;
            render();
        }, NOTICE_MS);
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
                ${row("Continuidade", "Ao fim de cada andar ou caçada, vende o loot e repõe suprimentos.", "enabled", config.enabled)}
                ${row("Auto-venda", "Vende só materiais e loot; equipamento fica na mochila.", "autoSell", config.autoSell)}
                ${row("Guardar materiais de ofício", "Minério, couro, ervas e lingotes que as Oficinas usam não são vendidos.", "keepCraftingMaterials", config.keepCraftingMaterials)}
                ${row("Reposição automática", "Compra suprimentos que ficarem abaixo do gatilho.", "autoRestock", config.autoRestock)}
                <div class="ui3-kpi-grid ui3-kpi-grid--3">
                    ${K.kpi({ label: "Ciclos", value: K.formatNumber(config.cyclesCompleted) })}
                    ${K.kpi({ label: "Auto-venda", value: `${config.totalProfit > 0 ? "+" : ""}${K.formatNumber(config.totalProfit)} o`, tone: config.totalProfit > 0 ? "positive" : "" })}
                    ${K.kpi({ label: "Reposição", value: `${config.totalRestockCost > 0 ? "−" : ""}${K.formatNumber(config.totalRestockCost)} o` })}
                </div>
            </section>`;
    }

    function supplyHTML(supply) {
        const K = kit();
        const range = idle().autoUseRange || { min: 5, max: 95 };
        const stock = STOCK[supply.stockState] || STOCK.stable;
        const percent = supply.rule.target > 0 ? Math.min(100, Math.round((supply.current / supply.rule.target) * 100)) : 100;
        const ordered = whole(state.order[supply.id]);
        return `<article class="ui3-city-card ui3-automation__supply">
                <header class="ui3-row-between">
                    <span class="ui3-row"><span class="ui3-glyph-box" aria-hidden="true">${K.esc(supply.icon)}</span>
                        <span class="ui3-list-row__text"><strong>${K.esc(supply.label)}</strong><small>${K.esc(supply.role)} · ${K.esc(supply.effect)}${supply.craftRecipeId ? " · produzível na Alquimia" : ""}</small></span></span>
                    <span class="ui3-list-row__text ui3-automation__stock"><strong>${K.formatNumber(supply.current)} / ${K.formatNumber(supply.rule.target)}</strong><small class="${stock.tone}">${K.esc(stock.label)}</small></span>
                </header>
                <div class="ui3-progress" role="meter" aria-label="Estoque de ${K.esc(supply.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><div style="width:${percent}%"></div></div>
                <div class="ui3-automation__controls">
                    <div class="ui3-row-between"><span>Reposição automática</span>${K.toggle({ checked: supply.rule.enabled && supply.unitPrice > 0, disabled: supply.unitPrice <= 0, label: `Repor ${supply.label}`, onText: "Repor", offText: "Não repor", attributes: { "data-ui3-auto-restock-item": supply.id } })}</div>
                    <div class="ui3-row-between"><span>Comprar quando tiver menos de</span>${numberInput({ value: supply.rule.reorderAt, label: `Gatilho de ${supply.label}`, attributes: { "data-ui3-auto-rule": "reorderAt", "data-supply": supply.id } })}</div>
                    <div class="ui3-row-between"><span>Completar até</span>${numberInput({ value: supply.rule.target, label: `Meta de ${supply.label}`, attributes: { "data-ui3-auto-rule": "target", "data-supply": supply.id } })}</div>
                    ${supply.autoUse ? `<div class="ui3-row-between"><span>Usar em combate abaixo de</span><span class="ui3-row">${numberInput({ value: supply.autoUse.thresholdPercent, min: range.min, max: range.max, step: 5, label: `Limite de uso de ${supply.label}`, attributes: { "data-ui3-auto-threshold": supply.id } })}<span>%</span>${K.toggle({ checked: supply.autoUse.enabled, label: `Usar ${supply.label} automaticamente`, onText: "Usar", offText: "Manual", attributes: { "data-ui3-auto-use": supply.id } })}</span></div>`
                        : `<p class="ui3-caption">Uso manual, quando o herói estiver envenenado.</p>`}
                    ${supply.unitPrice > 0 ? `<div class="ui3-row-between"><span>Comprar agora <span class="ui3-caption">· ${K.formatNumber(supply.unitPrice)} o cada</span></span>
                        <span class="ui3-row">
                            ${K.button({ label: "−", ariaLabel: `Menos ${supply.label}`, disabled: ordered <= 0, attributes: { "data-ui3-auto-order": supply.id, "data-delta": "-1" } })}
                            <strong class="ui3-automation__order">${K.formatNumber(ordered)}</strong>
                            ${K.button({ label: "+", ariaLabel: `Mais ${supply.label}`, attributes: { "data-ui3-auto-order": supply.id, "data-delta": "1" } })}
                        </span>
                    </div>` : `<p class="ui3-caption">O mercador não vende este item${supply.craftRecipeId ? "; produza na Alquimia" : ""}.</p>`}
                </div>
            </article>`;
    }

    function protocolHTML(config, summary) {
        const K = kit();
        return `<section class="ui3-options__section">
                <span class="ui3-eyebrow">Limites de gasto da reposição</span>
                <div class="ui3-row-between"><span>Reserva que nunca é gasta</span><span class="ui3-row">${numberInput({ value: config.goldReserve, max: 999999, step: 10, label: "Reserva de ouro", attributes: { "data-ui3-auto-budget": "goldReserve" } })}<span>o</span></span></div>
                <div class="ui3-row-between"><span>Teto por ciclo <span class="ui3-caption">· 0 = sem teto</span></span><span class="ui3-row">${numberInput({ value: config.maxRestockSpend, max: 999999, step: 10, label: "Teto por ciclo", attributes: { "data-ui3-auto-budget": "maxRestockSpend" } })}<span>o</span></span></div>
                <div class="ui3-row-between"><span>Compra parcial <span class="ui3-caption">· comprar o que o ouro permitir</span></span>${K.toggle({ checked: config.allowPartialRestock, label: "Compra parcial", attributes: { "data-ui3-auto-partial": "" } })}</div>
                <div class="ui3-note"><span>Próxima reposição</span><strong class="${summary.restockReady ? "" : "ui3-text-warn"}">${K.formatNumber(summary.restockCost)} o · ${summary.restockReady ? "orçamento suficiente" : `faltam ${K.formatNumber(summary.restockCost - summary.cycleBudget)} o`}</strong></div>
            </section>`;
    }

    function orderHTML(supplies) {
        const K = kit();
        const total = supplies.reduce((sum, supply) => sum + whole(state.order[supply.id]) * supply.unitPrice, 0);
        const units = supplies.reduce((sum, supply) => sum + whole(state.order[supply.id]), 0);
        const missing = Math.max(0, total - gold());
        return `<div class="ui3-row-between ui3-automation__order-bar">
                <span class="ui3-list-row__text"><strong>Pedido: ${K.formatNumber(units)} item(ns) · ${K.formatNumber(total)} o</strong><small>Sobram ${K.formatNumber(Math.max(0, gold() - total))} o</small></span>
                ${K.button({
                    label: missing > 0 ? `Faltam ${K.formatNumber(missing)} o` : "Comprar agora",
                    variant: "primary",
                    disabled: units === 0 || missing > 0,
                    attributes: { "data-ui3-auto-buy": "" }
                })}
            </div>`;
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
        const { config, supplies, summary } = idle().getSupplyOverview();
        const notice = state.notice
            ? `<p class="ui3-notice ui3-notice--${K.esc(state.notice.tone)}" role="status">${K.esc(state.notice.text)}</p>`
            : "";
        patch(parts.body, `${notice}${settingsHTML(config)}
            <section class="ui3-options__section">
                <span class="ui3-eyebrow">Suprimentos · ${K.formatNumber(summary.current)}/${K.formatNumber(summary.target)} em estoque</span>
                <div class="ui3-automation__supplies">${supplies.map(supplyHTML).join("")}</div>
                ${orderHTML(supplies)}
            </section>
            ${protocolHTML(config, summary)}`);
    }

    function planFor(supplyId, change) {
        const rule = idle().getSupplyOverview().supplies.find((supply) => supply.id === supplyId)?.rule;
        return rule ? { [supplyId]: { ...rule, ...change } } : null;
    }

    function onClick(event) {
        const target = event.target;
        const setting = target.closest("[data-ui3-auto-setting]");
        if (setting) {
            const key = setting.dataset.ui3AutoSetting;
            idle().updateSetting(key, !idle().config[key]);
            return render();
        }
        const restockItem = target.closest("[data-ui3-auto-restock-item]");
        if (restockItem) {
            const id = restockItem.dataset.ui3AutoRestockItem;
            const plan = planFor(id, { enabled: restockItem.getAttribute("aria-checked") !== "true" });
            if (plan) idle().configureRestock({ supplyPlan: plan });
            return render();
        }
        const autoUse = target.closest("[data-ui3-auto-use]");
        if (autoUse) {
            idle().configureAutoUse({ [autoUse.dataset.ui3AutoUse]: { enabled: autoUse.getAttribute("aria-checked") !== "true" } });
            return render();
        }
        if (target.closest("[data-ui3-auto-partial]")) {
            idle().configureRestock({ allowPartialRestock: !idle().config.allowPartialRestock });
            return render();
        }
        const order = target.closest("[data-ui3-auto-order]");
        if (order && !order.disabled) {
            const id = order.dataset.ui3AutoOrder;
            state.order[id] = whole(whole(state.order[id]) + Number(order.dataset.delta || 0));
            return render();
        }
        if (target.closest("[data-ui3-auto-buy]")) {
            const result = idle().purchaseSupplies(state.order, { source: "ui3-automation" });
            if (result.purchased > 0) {
                state.order = {};
                notify(`${kit().formatNumber(result.purchased)} suprimento(s) comprado(s) por ${kit().formatNumber(result.cost)} o.`);
            } else {
                notify(result.reason === "INSUFFICIENT_BUDGET" ? "Ouro insuficiente para o pedido." : "Escolha ao menos um item.", "error");
            }
            return render();
        }
        return undefined;
    }

    // Números valem ao sair do campo (change), sem redesenhar enquanto se digita.
    function onChange(event) {
        const input = event.target;
        const rule = input.closest("[data-ui3-auto-rule]");
        if (rule) {
            const id = rule.dataset.supply;
            const current = idle().getSupplyOverview().supplies.find((supply) => supply.id === id)?.rule;
            if (!current) return render();
            const value = whole(input.value);
            const change = rule.dataset.ui3AutoRule === "target"
                ? { target: value, reorderAt: Math.min(current.reorderAt, value) }
                : { reorderAt: Math.min(value, current.target) };
            idle().configureRestock({ supplyPlan: planFor(id, change) });
            input.blur();
            return render();
        }
        const threshold = input.closest("[data-ui3-auto-threshold]");
        if (threshold) {
            idle().configureAutoUse({ [threshold.dataset.ui3AutoThreshold]: { thresholdPercent: input.value } });
            input.blur();
            return render();
        }
        const budget = input.closest("[data-ui3-auto-budget]");
        if (budget) {
            idle().configureRestock({ [budget.dataset.ui3AutoBudget]: whole(input.value, 999999) });
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

    function onOpen() {
        state.order = {};
        state.notice = null;
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3AutomationWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Automação",
            className: "ui3-dialog--medium",
            setup,
            render,
            onOpen,
            getSubtitle: () => "Auto-venda, suprimentos e poções",
            getHeaderExtra: () => `<span class="ui3-currency"><span class="ui3-currency__coin" aria-hidden="true"></span><strong>${kit().formatNumber(gold())}</strong><small>ouro</small></span>`,
            events: ["idle-loop:updated", "consumable:used", "consumable:policy-changed", "goldChanged", "inventory:changed", "bag:changed"]
        });
    }
})(window.Aethra = window.Aethra || {});
