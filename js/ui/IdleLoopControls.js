// IdleLoopControls.js — controles clássicos da automação (barra sobre o mapa e
// painel de suprimentos). Só desenha e encaminha comandos ao IdleLoopSystem.
// Sai junto com a interface clássica; a UI 3.0 usa Ui3AutomationWindow.
(function initIdleLoopControls(Aethra) {
    "use strict";

    if (!Aethra?.EventBus || !Aethra?.IdleLoopSystem) return;

    const System = Aethra.IdleLoopSystem;
    const ROOT_ID = "idle-loop-controls-root";
    const uiState = {
        supplyPanelOpen: false,
        manualQuantities: Object.fromEntries(System.supplies.map((supply) => [supply.id, 0])),
        feedback: "",
        positionFrame: 0
    };
    const esc = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    const fmt = (value) => new Intl.NumberFormat("pt-BR").format(Math.floor(Number(value) || 0));
    const integer = (value, fallback = 0, maximum = Number.MAX_SAFE_INTEGER) => {
        const parsed = Number(value);
        return Math.min(maximum, Math.max(0, Math.floor(Number.isFinite(parsed) ? parsed : fallback)));
    };

    function syncControlPosition() {
        const root = document.getElementById(ROOT_ID);
        const workspace = document.querySelector(".tilemap-workspace");
        if (!root || !workspace) return false;
        const bounds = workspace.getBoundingClientRect();
        const actionbarBounds = document.getElementById("battle-actionbar-layer")?.getBoundingClientRect?.();
        const fixedContextTop = root.closest(".world-scene")?.getBoundingClientRect?.().top || 0;
        const visibleBottom = Math.min(
            bounds.bottom - 12,
            actionbarBounds?.top ? actionbarBounds.top - 18 : window.innerHeight - 18
        );
        const panelTop = Math.max(8, bounds.top + 48);
        root.style.setProperty("--idle-map-left", `${Math.max(0, bounds.left)}px`);
        root.style.setProperty("--idle-map-right", `${Math.min(window.innerWidth, bounds.right)}px`);
        root.style.setProperty("--idle-dock-top", `${Math.max(0, visibleBottom - 40 - fixedContextTop)}px`);
        root.style.setProperty("--idle-panel-top", `${Math.max(0, panelTop - fixedContextTop)}px`);
        root.style.setProperty("--idle-panel-height", `${Math.max(260, visibleBottom - panelTop)}px`);
        return true;
    }

    function scheduleControlPosition() {
        if (uiState.positionFrame) cancelAnimationFrame(uiState.positionFrame);
        uiState.positionFrame = requestAnimationFrame(() => {
            uiState.positionFrame = 0;
            syncControlPosition();
        });
    }

    const STOCK_LABELS = { manual: "Somente manual", ready: "Estoque pronto", low: "Reposição pendente", stable: "Estoque estável" };
    const STOCK_KEYS = { manual: "manual", ready: "ready", low: "danger", stable: "stable" };

    function renderSupplyCard(supply) {
        const rule = supply.rule;
        const manualQuantity = integer(uiState.manualQuantities[supply.id], 0, 99);
        const stockRatio = rule.target > 0 ? Math.min(100, Math.round(supply.current / rule.target * 100)) : 100;
        return `
            <article class="idle-supply-card idle-tone-${supply.tone} ${rule.enabled ? "is-enabled" : ""}">
                <header class="idle-supply-card-head">
                    <span class="idle-supply-icon" aria-hidden="true">${supply.icon}</span>
                    <span class="idle-supply-identity"><strong>${esc(supply.label)}</strong><small>${esc(supply.role)} · ${esc(supply.effect)}${supply.craftRecipeId ? " · Produzível na Alquimia" : ""}</small></span>
                    <span class="idle-stock-count"><b>${fmt(supply.current)}</b><small>/ ${fmt(rule.target)}</small></span>
                </header>
                <div class="idle-stock-track"><i style="width:${stockRatio}%"></i></div>
                <div class="idle-card-meta"><span class="idle-stock-state is-${STOCK_KEYS[supply.stockState]}">${STOCK_LABELS[supply.stockState]}</span><span>${fmt(supply.unitPrice)} G <small>/ unidade</small></span></div>
                <div class="idle-auto-buy-row">
                    <label class="idle-switch-label" title="Incluir este item na reposição automática">
                        <input type="checkbox" data-supply-field="enabled" data-item-id="${supply.id}" ${rule.enabled ? "checked" : ""}>
                        <span class="idle-switch-control"></span>
                        <span><b>Auto-compra</b><small>${rule.enabled ? "Item protegido pelo loop" : "Reposição desativada"}</small></span>
                    </label>
                    <div class="idle-rule-inputs">
                        <label><span>Gatilho</span><i>&lt;</i><input type="number" min="0" max="99" step="1" value="${rule.reorderAt}" data-supply-field="reorderAt" data-item-id="${supply.id}"></label>
                        <span class="idle-rule-arrow">→</span>
                        <label><span>Meta</span><input type="number" min="0" max="99" step="1" value="${rule.target}" data-supply-field="target" data-item-id="${supply.id}"></label>
                    </div>
                </div>
                <div class="idle-manual-row">
                    <span class="idle-manual-copy"><b>Compra imediata</b><small data-manual-subtotal="${supply.id}">Subtotal ${fmt(manualQuantity * supply.unitPrice)} G</small></span>
                    <div class="idle-quantity-stepper">
                        <button type="button" data-idle-action="quantity" data-item-id="${supply.id}" data-delta="-1" aria-label="Diminuir ${esc(supply.label)}">−</button>
                        <input type="number" min="0" max="99" step="1" value="${manualQuantity}" data-manual-quantity="${supply.id}" aria-label="Quantidade de ${esc(supply.label)}">
                        <button type="button" data-idle-action="quantity" data-item-id="${supply.id}" data-delta="1" aria-label="Aumentar ${esc(supply.label)}">+</button>
                    </div>
                </div>
                ${supply.autoUse ? `
                    <div class="idle-auto-use-row">
                        <label class="idle-switch-label idle-switch-label--small">
                            <input type="checkbox" data-auto-use-item="${supply.id}" ${supply.autoUse.enabled ? "checked" : ""}>
                            <span class="idle-switch-control"></span>
                            <span><b>Auto-uso</b></span>
                        </label>
                        <label class="idle-threshold-label"><span>Ativar abaixo de</span>
                            <input type="number" min="5" max="95" step="5" value="${supply.autoUse.thresholdPercent}" data-auto-threshold="${supply.id}">%
                        </label>
                    </div>` : `<div class="idle-auto-use-note"><span>☤</span><div><b>Uso tático manual</b><small>Disponível quando o herói estiver envenenado.</small></div></div>`}
            </article>`;
    }

    function renderSupplyPanel(overview) {
        const { config, supplies, summary } = overview;
        const selectedTotal = supplies.reduce((total, supply) => total + integer(uiState.manualQuantities[supply.id], 0, 99) * supply.unitPrice, 0);
        const selectedUnits = supplies.reduce((total, supply) => total + integer(uiState.manualQuantities[supply.id], 0, 99), 0);
        const gold = integer(Aethra.GameState?.hero?.gold);
        return `
            <section class="idle-supply-panel" role="dialog" aria-modal="false" aria-label="Gerenciar supplies">
                <div class="idle-supply-panel-head">
                    <span class="idle-panel-emblem" aria-hidden="true">▦</span>
                    <div class="idle-panel-title"><span class="idle-panel-kicker">QUARTEL-MESTRE // PROTOCOLO DE CAMPO</span><h3>Arsenal de Suprimentos</h3><p>O loop verifica o estoque ao concluir cada andar ou caçada.</p></div>
                    <button type="button" class="idle-panel-close" data-idle-action="close-supplies" aria-label="Fechar painel">×</button>
                </div>
                <div class="idle-supply-overview">
                    <div><span class="idle-overview-icon">◈</span><small>OURO DISPONÍVEL</small><strong>${fmt(gold)} G</strong><em>${fmt(config.goldReserve)} G protegidos</em></div>
                    <div><span class="idle-overview-icon">▰</span><small>ESTOQUE PROTEGIDO</small><strong>${fmt(summary.current)} / ${fmt(summary.target)}</strong><em>${summary.enabled} de ${supplies.length} tipos ativos</em></div>
                    <div class="${summary.restockReady ? "is-ready" : "is-warning"}"><span class="idle-overview-icon">${summary.restockReady ? "✓" : "!"}</span><small>PRÓXIMA REPOSIÇÃO</small><strong>${fmt(summary.restockCost)} G</strong><em>${summary.restockReady ? "Orçamento suficiente" : `Faltam ${fmt(summary.restockCost - summary.cycleBudget)} G`}</em></div>
                </div>
                <div class="idle-supply-grid">${supplies.map(renderSupplyCard).join("")}</div>
                <div class="idle-restock-protocol">
                    <div class="idle-protocol-head"><span>⚙</span><div><strong>Protocolo automático</strong><small>Define até onde o quartel-mestre pode gastar sem sua confirmação.</small></div></div>
                    <div class="idle-restock-options">
                        <label class="idle-switch-label idle-option-primary">
                            <input type="checkbox" data-restock-option="autoRestock" ${config.autoRestock ? "checked" : ""}>
                            <span class="idle-switch-control"></span>
                            <span><b>Reposição do loop</b><small>${config.autoRestock ? "Operacional" : "Pausada"}</small></span>
                        </label>
                        <label><span>Reserva inviolável</span><span class="idle-input-suffix"><input type="number" min="0" step="10" value="${config.goldReserve}" data-restock-option="goldReserve"><b>G</b></span></label>
                        <label><span>Teto por ciclo</span><span class="idle-input-suffix"><input type="number" min="0" step="10" value="${config.maxRestockSpend}" data-restock-option="maxRestockSpend"><b>G</b></span><small>0 significa sem limite</small></label>
                        <label class="idle-switch-label idle-partial-option">
                            <input type="checkbox" data-restock-option="allowPartialRestock" ${config.allowPartialRestock ? "checked" : ""}>
                            <span class="idle-switch-control"></span>
                            <span><b>Compra parcial</b><small>Comprar o que o ouro permitir</small></span>
                        </label>
                    </div>
                </div>
                ${uiState.feedback ? `<div class="idle-panel-feedback" role="status">${esc(uiState.feedback)}</div>` : ""}
                <footer class="idle-supply-panel-footer">
                    <div class="idle-purchase-total"><small>PEDIDO MANUAL</small><strong>Total: ${fmt(selectedTotal)} G</strong><span data-purchase-detail>${fmt(selectedUnits)} unidade(s) · saldo após compra ${fmt(Math.max(0, gold - selectedTotal))} G</span></div>
                    <div class="idle-panel-actions">
                        <button type="button" class="idle-secondary-btn" data-idle-action="save-supplies"><span>✓</span> Salvar protocolo</button>
                        <button type="button" class="idle-primary-btn" data-idle-action="purchase-supplies" ${selectedTotal <= 0 ? "disabled" : ""}><span>◆</span> Comprar agora</button>
                    </div>
                </footer>
            </section>`;
    }

    function renderControls() {
        const root = document.getElementById(ROOT_ID);
        if (!root) return false;
        const overview = System.getSupplyOverview();
        const { config, summary } = overview;
        root.classList.toggle("is-panel-open", uiState.supplyPanelOpen);
        root.innerHTML = `
            ${uiState.supplyPanelOpen ? renderSupplyPanel(overview) : ""}
            <div class="idle-loop-bar">
                <div class="idle-loop-status">
                    <span class="idle-loop-indicator ${config.enabled ? "" : "is-inactive"}">${config.enabled ? "● Continuidade ativa" : "○ Automação pausada"}</span>
                    <div class="idle-loop-telemetry"><span>Ciclos <strong>${fmt(config.cyclesCompleted)}</strong></span>
                        <span>Auto-venda <strong>+${fmt(config.totalProfit)} G</strong></span>
                        <span>Reposição <strong>−${fmt(config.totalRestockCost)} G</strong></span></div>
                </div>
                <div class="idle-loop-controls">
                    <button type="button" class="idle-toggle-btn ${config.autoSell ? "is-active" : ""}" data-idle-setting="autoSell"
                        title="Vende automaticamente apenas materiais e loot; equipamentos são preservados."><span class="idle-quick-icon">◆</span><span><small>AUTO-VENDA</small><strong>${config.autoSell ? "ATIVA" : "DESLIGADA"}</strong></span></button>
                    <button type="button" class="idle-toggle-btn idle-supplies-btn ${config.autoRestock ? "is-active" : ""}" data-idle-action="open-supplies"
                        title="Escolher supplies, quantidades e regras de reposição."><span class="idle-quick-icon">▦</span><span><small>SUPRIMENTOS</small><strong>${summary.current}/${summary.target} EM ESTOQUE</strong></span></button>
                    <button type="button" class="idle-toggle-btn ${config.enabled ? "is-active" : ""}" data-idle-setting="enabled"><span class="idle-quick-icon">${config.enabled ? "▶" : "Ⅱ"}</span><span><small>CONTINUIDADE</small><strong>${config.enabled ? "LOOP ATIVO" : "PAUSADO"}</strong></span></button>
                </div>
            </div>`;
        scheduleControlPosition();
        return true;
    }

    function readManualQuantities(root) {
        root?.querySelectorAll?.("[data-manual-quantity]").forEach((input) => {
            uiState.manualQuantities[input.dataset.manualQuantity] = integer(input.value, 0, 99);
        });
    }

    function savePanelConfiguration(root) {
        const supplyPlan = {};
        const autoUse = {};
        System.supplies.forEach((definition) => {
            const enabled = root.querySelector(`[data-supply-field="enabled"][data-item-id="${definition.id}"]`)?.checked === true;
            const reorderAt = integer(root.querySelector(`[data-supply-field="reorderAt"][data-item-id="${definition.id}"]`)?.value, 0, 99);
            const target = integer(root.querySelector(`[data-supply-field="target"][data-item-id="${definition.id}"]`)?.value, 0, 99);
            supplyPlan[definition.id] = { enabled, reorderAt: Math.min(reorderAt, target), target };
            if (definition.policyItemKey) {
                autoUse[definition.id] = {
                    enabled: root.querySelector(`[data-auto-use-item="${definition.id}"]`)?.checked === true,
                    thresholdPercent: root.querySelector(`[data-auto-threshold="${definition.id}"]`)?.value
                };
            }
        });
        System.configureRestock({
            autoRestock: root.querySelector('[data-restock-option="autoRestock"]')?.checked === true,
            goldReserve: root.querySelector('[data-restock-option="goldReserve"]')?.value,
            maxRestockSpend: root.querySelector('[data-restock-option="maxRestockSpend"]')?.value,
            allowPartialRestock: root.querySelector('[data-restock-option="allowPartialRestock"]')?.checked === true,
            supplyPlan
        });
        System.configureAutoUse(autoUse);
        uiState.feedback = "Configuração salva.";
        renderControls();
    }

    ["idle-loop:updated", "tilemap:ready", "consumable:used"]
        .forEach((eventName) => Aethra.EventBus.on(eventName, renderControls));

    document.addEventListener("input", (event) => {
        const input = event.target.closest?.(`#${ROOT_ID} [data-manual-quantity]`);
        if (!input) return;
        uiState.manualQuantities[input.dataset.manualQuantity] = integer(input.value, 0, 99);
        const root = document.getElementById(ROOT_ID);
        const total = System.supplies.reduce((sum, definition) => sum + integer(uiState.manualQuantities[definition.id]) * System.unitPriceFor(definition.id), 0);
        const units = System.supplies.reduce((sum, definition) => sum + integer(uiState.manualQuantities[definition.id]), 0);
        const totalElement = root?.querySelector(".idle-purchase-total strong");
        const detailElement = root?.querySelector("[data-purchase-detail]");
        const subtotalElement = root?.querySelector(`[data-manual-subtotal="${input.dataset.manualQuantity}"]`);
        const purchaseButton = root?.querySelector('[data-idle-action="purchase-supplies"]');
        if (totalElement) totalElement.textContent = `Total: ${fmt(total)} G`;
        if (detailElement) detailElement.textContent = `${fmt(units)} unidade(s) · saldo após compra ${fmt(Math.max(0, integer(Aethra.GameState?.hero?.gold) - total))} G`;
        if (subtotalElement) subtotalElement.textContent = `Subtotal ${fmt(integer(input.value) * System.unitPriceFor(input.dataset.manualQuantity))} G`;
        if (purchaseButton) purchaseButton.disabled = total <= 0;
    });

    document.addEventListener("click", (event) => {
        const root = event.target.closest?.(`#${ROOT_ID}`);
        if (!root) return;
        const settingButton = event.target.closest("[data-idle-setting]");
        if (settingButton) {
            const key = settingButton.dataset.idleSetting;
            System.updateSetting(key, !System.config[key]);
            return;
        }
        const actionButton = event.target.closest("[data-idle-action]");
        if (!actionButton) return;
        const action = actionButton.dataset.idleAction;
        if (action === "open-supplies") {
            uiState.supplyPanelOpen = true;
            uiState.feedback = "";
            renderControls();
        } else if (action === "close-supplies") {
            readManualQuantities(root);
            uiState.supplyPanelOpen = false;
            renderControls();
        } else if (action === "quantity") {
            readManualQuantities(root);
            const itemId = actionButton.dataset.itemId;
            uiState.manualQuantities[itemId] = integer(uiState.manualQuantities[itemId] + Number(actionButton.dataset.delta || 0), 0, 99);
            renderControls();
        } else if (action === "save-supplies") {
            readManualQuantities(root);
            savePanelConfiguration(root);
        } else if (action === "purchase-supplies") {
            readManualQuantities(root);
            const result = System.purchaseSupplies(uiState.manualQuantities, { source: "player-manual" });
            if (result.reason === "INSUFFICIENT_BUDGET") {
                uiState.feedback = `Ouro insuficiente: faltam ${fmt(result.requestedCost - integer(Aethra.GameState?.hero?.gold))} G.`;
            } else if (result.purchased > 0) {
                uiState.feedback = `${fmt(result.purchased)} supply(s) comprado(s) por ${fmt(result.cost)} G.`;
                result.items.forEach((line) => { uiState.manualQuantities[line.itemId] = 0; });
            } else {
                uiState.feedback = "Escolha ao menos uma quantidade para comprar.";
            }
            renderControls();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !uiState.supplyPanelOpen) return;
        uiState.supplyPanelOpen = false;
        renderControls();
    });
    window.addEventListener("resize", scheduleControlPosition, { passive: true });
    window.addEventListener("scroll", scheduleControlPosition, { passive: true });

    Aethra.IdleLoopControls = { render: renderControls, syncPosition: syncControlPosition };
})(window.Aethra = window.Aethra || {});
