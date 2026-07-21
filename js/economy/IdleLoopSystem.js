// IdleLoopSystem.js — automação segura apoiada na economia e na caçada oficiais.
(function initIdleLoopSystem(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const SUPPLIES = Object.freeze([
        Object.freeze({ id: "potion_health", label: "Poção de Vida", shortLabel: "Vida", icon: "✚", effect: "+20 HP", role: "Sobrevivência", tone: "health", enabled: true, reorderAt: 5, target: 5, policyItemKey: "healthItemId", policyThresholdKey: "healthThreshold" }),
        Object.freeze({ id: "potion_mana", label: "Poção de Mana", shortLabel: "Mana", icon: "◆", effect: "+25 Mana", role: "Recurso arcano", tone: "mana", enabled: true, reorderAt: 5, target: 5, policyItemKey: "manaItemId", policyThresholdKey: "manaThreshold" }),
        Object.freeze({ id: "minor_vigor_tonic", label: "Tônico de Vigor", shortLabel: "Vigor", icon: "ϟ", effect: "+18 Vigor", role: "Recurso físico", tone: "vigor", enabled: false, reorderAt: 2, target: 3, policyItemKey: "energyItemId", policyThresholdKey: "energyThreshold" }),
        Object.freeze({ id: "field_antidote", label: "Antídoto de Campanha", shortLabel: "Antídoto", icon: "☤", effect: "Remove veneno", role: "Cura de condição", tone: "antidote", enabled: false, reorderAt: 1, target: 2 })
    ]);
    const DEFAULTS = Object.freeze({
        enabled: true,
        autoSell: true,
        autoRestock: true,
        keepEquipment: true,
        healthTarget: 5,
        manaTarget: 5,
        goldReserve: 0,
        maxRestockSpend: 0,
        allowPartialRestock: true,
        cyclesCompleted: 0,
        totalProfit: 0,
        totalRestockCost: 0,
        lastCycleAt: null
    });
    const uiState = {
        supplyPanelOpen: false,
        manualQuantities: Object.fromEntries(SUPPLIES.map((supply) => [supply.id, 0])),
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
    const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

    function normalizeSupplyPlan(storedPlan = {}, legacy = {}) {
        return Object.fromEntries(SUPPLIES.map((definition) => {
            const stored = storedPlan?.[definition.id] || {};
            const legacyTarget = definition.id === "potion_health"
                ? legacy.healthTarget
                : definition.id === "potion_mana" ? legacy.manaTarget : undefined;
            const target = integer(stored.target, legacyTarget ?? definition.target, 99);
            const reorderAt = Math.min(target, integer(stored.reorderAt, legacyTarget ?? definition.reorderAt, 99));
            return [definition.id, {
                enabled: stored.enabled === undefined ? definition.enabled : Boolean(stored.enabled),
                reorderAt,
                target,
                priority: integer(stored.priority, SUPPLIES.indexOf(definition) + 1, SUPPLIES.length)
            }];
        }));
    }

    function ensureState() {
        const state = Aethra.GameState || {};
        const stored = state.idleLoop && typeof state.idleLoop === "object" ? state.idleLoop : {};
        const supplyPlan = normalizeSupplyPlan(stored.supplyPlan, stored);
        state.idleLoop = {
            ...DEFAULTS,
            ...stored,
            enabled: stored.enabled !== false,
            autoSell: stored.autoSell !== false,
            autoRestock: stored.autoRestock !== false,
            keepEquipment: stored.keepEquipment !== false,
            allowPartialRestock: stored.allowPartialRestock !== false,
            goldReserve: integer(stored.goldReserve, DEFAULTS.goldReserve),
            maxRestockSpend: integer(stored.maxRestockSpend, DEFAULTS.maxRestockSpend),
            cyclesCompleted: integer(stored.cyclesCompleted),
            totalProfit: integer(stored.totalProfit),
            totalRestockCost: integer(stored.totalRestockCost),
            supplyPlan,
            healthTarget: supplyPlan.potion_health.target,
            manaTarget: supplyPlan.potion_mana.target
        };
        return state.idleLoop;
    }

    function templateFor(itemId) {
        return Aethra.GameData?.getItem?.(itemId)
            || Aethra.GameData?.items?.[itemId]
            || Aethra.ItemSystem?.templates?.[itemId]
            || null;
    }

    function unitPriceFor(itemId) {
        const item = templateFor(itemId);
        return integer(item?.price ?? item?.value, 0);
    }

    function originOf(item = {}) {
        return item.market?.purchaseOrigin || item.origin?.source || item.source || "unknown";
    }

    function isAutoSellEligible(item = {}) {
        const config = ensureState();
        const type = String(item.type || item.itemType || "").toLowerCase();
        const origin = originOf(item);
        if (item.ownership?.bound || origin === "character-created" || origin === "npc-shop") return false;
        if (config.keepEquipment && item.slot) return false;
        return ["material", "loot"].includes(type) && [
            "loot", "enemy-drop", "hunt-loot", "hunt-system",
            "monster-economy", "battle-hunt", "battle-loot"
        ].includes(origin);
    }

    function autoSellItems(items = []) {
        const config = ensureState();
        if (!config.enabled || !config.autoSell) return { sold: 0, total: 0 };
        let sold = 0;
        let total = 0;
        [...items].filter(isAutoSellEligible).forEach((item) => {
            const result = Aethra.MarketplaceSystem?.sellLoot?.(item.instanceId || item.id);
            if (!result) return;
            sold += 1;
            total += Math.max(0, Number(result.salePrice) || 0);
        });
        if (total > 0) {
            config.totalProfit += total;
            Aethra.EventBus.emit("idle-loop:auto-sold", { sold, total, totalProfit: config.totalProfit });
        }
        renderControls();
        return { sold, total };
    }

    function inventoryQuantity(templateId) {
        return (Aethra.GameState?.hero?.bag || []).reduce((total, item) => {
            return (item.templateId || item.id) === templateId
                ? total + Math.max(1, Math.floor(Number(item.quantity) || 1))
                : total;
        }, 0);
    }

    function purchaseSupplies(requests = {}, options = {}) {
        const hero = Aethra.GameState?.hero;
        if (!hero?.characterCreated) return { purchased: 0, cost: 0, items: [], reason: "CHARACTER_REQUIRED" };
        const lines = SUPPLIES.map((definition) => {
            const quantity = integer(requests?.[definition.id], 0, 99);
            const unitPrice = unitPriceFor(definition.id);
            return { itemId: definition.id, quantity, unitPrice, cost: quantity * unitPrice };
        }).filter((line) => line.quantity > 0 && line.unitPrice > 0);
        const requestedCost = lines.reduce((total, line) => total + line.cost, 0);
        const spendingLimit = options.spendingLimit === undefined
            ? Number(hero.gold) || 0
            : Math.min(Number(hero.gold) || 0, integer(options.spendingLimit));
        if (lines.length === 0) return { purchased: 0, cost: 0, items: [], reason: "EMPTY_REQUEST" };
        if (requestedCost > spendingLimit) {
            return { purchased: 0, cost: 0, requestedCost, items: [], reason: "INSUFFICIENT_BUDGET" };
        }

        let purchased = 0;
        let cost = 0;
        const items = [];
        for (const line of lines) {
            const result = Aethra.MarketplaceSystem?.buyItem?.(line.itemId, line.quantity);
            if (!result) break;
            const paid = integer(result.totalPrice, line.cost);
            purchased += line.quantity;
            cost += paid;
            items.push({ ...line, cost: paid });
        }
        if (purchased > 0) {
            Aethra.EventBus.emit("idle-loop:supplies-purchased", {
                source: options.source || "manual",
                purchased,
                cost,
                items: clone(items)
            });
        }
        renderControls();
        return { purchased, cost, requestedCost, items };
    }

    function restockSupplies() {
        const config = ensureState();
        const hero = Aethra.GameState?.hero;
        if (!config.enabled || !config.autoRestock || !hero?.characterCreated) return { purchased: 0, cost: 0, items: [] };

        const spendableGold = Math.max(0, (Number(hero.gold) || 0) - config.goldReserve);
        let remainingBudget = config.maxRestockSpend > 0
            ? Math.min(spendableGold, config.maxRestockSpend)
            : spendableGold;
        let purchased = 0;
        let cost = 0;
        const items = [];
        const orderedSupplies = [...SUPPLIES].sort((a, b) => {
            return config.supplyPlan[a.id].priority - config.supplyPlan[b.id].priority;
        });

        orderedSupplies.forEach((definition) => {
            const rule = config.supplyPlan[definition.id];
            const current = inventoryQuantity(definition.id);
            if (!rule.enabled || current >= rule.reorderAt || rule.target <= current) return;
            const missing = rule.target - current;
            const unitPrice = unitPriceFor(definition.id);
            if (unitPrice <= 0) return;
            let quantity = Math.min(missing, Math.floor(remainingBudget / unitPrice));
            if (!config.allowPartialRestock && quantity < missing) quantity = 0;
            if (quantity <= 0) return;
            const result = Aethra.MarketplaceSystem?.buyItem?.(definition.id, quantity);
            if (!result) return;
            const paid = integer(result.totalPrice, unitPrice * quantity);
            purchased += quantity;
            cost += paid;
            remainingBudget = Math.max(0, remainingBudget - paid);
            items.push({ itemId: definition.id, quantity, unitPrice, cost: paid });
        });
        if (cost > 0) {
            config.totalRestockCost += cost;
            Aethra.EventBus.emit("idle-loop:restocked", {
                purchased,
                cost,
                items: clone(items),
                totalRestockCost: config.totalRestockCost
            });
        }
        renderControls();
        return { purchased, cost, items };
    }

    function processCycle(source = "idle-cycle") {
        const config = ensureState();
        if (!config.enabled) return false;
        const sale = autoSellItems(Aethra.GameState?.hero?.bag || []);
        const restock = restockSupplies();
        config.cyclesCompleted += 1;
        config.lastCycleAt = new Date().toISOString();
        const payload = {
            source,
            cycle: config.cyclesCompleted,
            sale,
            restock,
            net: sale.total - restock.cost
        };
        Aethra.EventBus.emit("idle-loop:cycle-completed", payload);
        Aethra.SaveManager?.save?.("idle-loop-cycle");
        renderControls();
        return payload;
    }

    function updateSetting(key, value) {
        if (!["enabled", "autoSell", "autoRestock"].includes(key)) return false;
        const config = ensureState();
        config[key] = Boolean(value);
        Aethra.EventBus.emit("idle-loop:setting-changed", { key, value: config[key], config: clone(config) });
        Aethra.SaveManager?.save?.("idle-loop-setting");
        renderControls();
        return config[key];
    }

    function configureRestock(patch = {}) {
        const config = ensureState();
        if (patch.autoRestock !== undefined) config.autoRestock = Boolean(patch.autoRestock);
        if (patch.goldReserve !== undefined) config.goldReserve = integer(patch.goldReserve);
        if (patch.maxRestockSpend !== undefined) config.maxRestockSpend = integer(patch.maxRestockSpend);
        if (patch.allowPartialRestock !== undefined) config.allowPartialRestock = Boolean(patch.allowPartialRestock);
        if (patch.supplyPlan && typeof patch.supplyPlan === "object") {
            config.supplyPlan = normalizeSupplyPlan({ ...config.supplyPlan, ...patch.supplyPlan }, config);
        }
        config.healthTarget = config.supplyPlan.potion_health.target;
        config.manaTarget = config.supplyPlan.potion_mana.target;
        Aethra.EventBus.emit("idle-loop:restock-configured", clone(config));
        Aethra.SaveManager?.save?.("idle-loop-restock-config");
        renderControls();
        return clone(config);
    }

    function toggleLoop(forceState = null) {
        const config = ensureState();
        return updateSetting("enabled", forceState === null ? !config.enabled : forceState);
    }

    function syncControlPosition() {
        const root = document.getElementById("idle-loop-controls-root");
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

    function supplySummary(config) {
        return SUPPLIES.reduce((summary, definition) => {
            const rule = config.supplyPlan[definition.id];
            if (!rule.enabled) return summary;
            const current = inventoryQuantity(definition.id);
            const missing = Math.max(0, rule.target - current);
            summary.current += current;
            summary.target += rule.target;
            summary.enabled += 1;
            summary.missing += missing;
            summary.restockCost += missing * unitPriceFor(definition.id);
            return summary;
        }, { current: 0, target: 0, enabled: 0, missing: 0, restockCost: 0 });
    }

    function renderSupplyCard(definition, config, policy) {
        const rule = config.supplyPlan[definition.id];
        const current = inventoryQuantity(definition.id);
        const price = unitPriceFor(definition.id);
        const autoUse = definition.policyItemKey
            ? policy.enabled !== false && policy[definition.policyItemKey] === definition.id
            : false;
        const threshold = definition.policyThresholdKey
            ? Math.round((Number(policy[definition.policyThresholdKey]) || 0) * 100)
            : 0;
        const manualQuantity = integer(uiState.manualQuantities[definition.id], 0, 99);
        const stockRatio = rule.target > 0 ? Math.min(100, Math.round(current / rule.target * 100)) : 100;
        const stockState = !rule.enabled
            ? { key: "manual", label: "Somente manual" }
            : current >= rule.target
                ? { key: "ready", label: "Estoque pronto" }
                : current < rule.reorderAt
                    ? { key: "danger", label: "Reposição pendente" }
                    : { key: "stable", label: "Estoque estável" };
        return `
            <article class="idle-supply-card idle-tone-${definition.tone} ${rule.enabled ? "is-enabled" : ""}">
                <header class="idle-supply-card-head">
                    <span class="idle-supply-icon" aria-hidden="true">${definition.icon}</span>
                    <span class="idle-supply-identity"><strong>${esc(definition.label)}</strong><small>${esc(definition.role)} · ${esc(definition.effect)}</small></span>
                    <span class="idle-stock-count"><b>${fmt(current)}</b><small>/ ${fmt(rule.target)}</small></span>
                </header>
                <div class="idle-stock-track"><i style="width:${stockRatio}%"></i></div>
                <div class="idle-card-meta"><span class="idle-stock-state is-${stockState.key}">${stockState.label}</span><span>${fmt(price)} G <small>/ unidade</small></span></div>
                <div class="idle-auto-buy-row">
                    <label class="idle-switch-label" title="Incluir este item na reposição automática">
                        <input type="checkbox" data-supply-field="enabled" data-item-id="${definition.id}" ${rule.enabled ? "checked" : ""}>
                        <span class="idle-switch-control"></span>
                        <span><b>Auto-compra</b><small>${rule.enabled ? "Item protegido pelo loop" : "Reposição desativada"}</small></span>
                    </label>
                    <div class="idle-rule-inputs">
                        <label><span>Gatilho</span><i>&lt;</i><input type="number" min="0" max="99" step="1" value="${rule.reorderAt}" data-supply-field="reorderAt" data-item-id="${definition.id}"></label>
                        <span class="idle-rule-arrow">→</span>
                        <label><span>Meta</span><input type="number" min="0" max="99" step="1" value="${rule.target}" data-supply-field="target" data-item-id="${definition.id}"></label>
                    </div>
                </div>
                <div class="idle-manual-row">
                    <span class="idle-manual-copy"><b>Compra imediata</b><small data-manual-subtotal="${definition.id}">Subtotal ${fmt(manualQuantity * price)} G</small></span>
                    <div class="idle-quantity-stepper">
                        <button type="button" data-idle-action="quantity" data-item-id="${definition.id}" data-delta="-1" aria-label="Diminuir ${esc(definition.label)}">−</button>
                        <input type="number" min="0" max="99" step="1" value="${manualQuantity}" data-manual-quantity="${definition.id}" aria-label="Quantidade de ${esc(definition.label)}">
                        <button type="button" data-idle-action="quantity" data-item-id="${definition.id}" data-delta="1" aria-label="Aumentar ${esc(definition.label)}">+</button>
                    </div>
                </div>
                ${definition.policyItemKey ? `
                    <div class="idle-auto-use-row">
                        <label class="idle-switch-label idle-switch-label--small">
                            <input type="checkbox" data-auto-use-item="${definition.id}" ${autoUse ? "checked" : ""}>
                            <span class="idle-switch-control"></span>
                            <span><b>Auto-uso</b></span>
                        </label>
                        <label class="idle-threshold-label"><span>Ativar abaixo de</span>
                            <input type="number" min="5" max="95" step="5" value="${threshold}" data-auto-threshold="${definition.id}">%
                        </label>
                    </div>` : `<div class="idle-auto-use-note"><span>☤</span><div><b>Uso tático manual</b><small>Disponível quando o herói estiver envenenado.</small></div></div>`}
            </article>`;
    }

    function renderSupplyPanel(config) {
        const policy = Aethra.ConsumableSystem?.ensurePolicy?.() || {};
        const selectedTotal = SUPPLIES.reduce((total, definition) => {
            return total + integer(uiState.manualQuantities[definition.id], 0, 99) * unitPriceFor(definition.id);
        }, 0);
        const selectedUnits = SUPPLIES.reduce((total, definition) => {
            return total + integer(uiState.manualQuantities[definition.id], 0, 99);
        }, 0);
        const gold = integer(Aethra.GameState?.hero?.gold);
        const summary = supplySummary(config);
        const spendableGold = Math.max(0, gold - config.goldReserve);
        const cycleBudget = config.maxRestockSpend > 0
            ? Math.min(spendableGold, config.maxRestockSpend)
            : spendableGold;
        const restockReady = summary.restockCost <= cycleBudget;
        return `
            <section class="idle-supply-panel" role="dialog" aria-modal="false" aria-label="Gerenciar supplies">
                <div class="idle-supply-panel-head">
                    <span class="idle-panel-emblem" aria-hidden="true">▦</span>
                    <div class="idle-panel-title"><span class="idle-panel-kicker">QUARTEL-MESTRE // PROTOCOLO DE CAMPO</span><h3>Arsenal de Suprimentos</h3><p>O loop verifica o estoque ao concluir cada andar ou caçada.</p></div>
                    <button type="button" class="idle-panel-close" data-idle-action="close-supplies" aria-label="Fechar painel">×</button>
                </div>
                <div class="idle-supply-overview">
                    <div><span class="idle-overview-icon">◈</span><small>OURO DISPONÍVEL</small><strong>${fmt(gold)} G</strong><em>${fmt(config.goldReserve)} G protegidos</em></div>
                    <div><span class="idle-overview-icon">▰</span><small>ESTOQUE PROTEGIDO</small><strong>${fmt(summary.current)} / ${fmt(summary.target)}</strong><em>${summary.enabled} de ${SUPPLIES.length} tipos ativos</em></div>
                    <div class="${restockReady ? "is-ready" : "is-warning"}"><span class="idle-overview-icon">${restockReady ? "✓" : "!"}</span><small>PRÓXIMA REPOSIÇÃO</small><strong>${fmt(summary.restockCost)} G</strong><em>${restockReady ? "Orçamento suficiente" : `Faltam ${fmt(summary.restockCost - cycleBudget)} G`}</em></div>
                </div>
                <div class="idle-supply-grid">${SUPPLIES.map((definition) => renderSupplyCard(definition, config, policy)).join("")}</div>
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
        const root = document.getElementById("idle-loop-controls-root");
        if (!root) return false;
        const config = ensureState();
        const summary = supplySummary(config);
        root.classList.toggle("is-panel-open", uiState.supplyPanelOpen);
        root.innerHTML = `
            ${uiState.supplyPanelOpen ? renderSupplyPanel(config) : ""}
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
        SUPPLIES.forEach((definition) => {
            const enabled = root.querySelector(`[data-supply-field="enabled"][data-item-id="${definition.id}"]`)?.checked === true;
            const reorderAt = integer(root.querySelector(`[data-supply-field="reorderAt"][data-item-id="${definition.id}"]`)?.value, 0, 99);
            const target = integer(root.querySelector(`[data-supply-field="target"][data-item-id="${definition.id}"]`)?.value, 0, 99);
            supplyPlan[definition.id] = { enabled, reorderAt: Math.min(reorderAt, target), target };
        });
        configureRestock({
            autoRestock: root.querySelector('[data-restock-option="autoRestock"]')?.checked === true,
            goldReserve: root.querySelector('[data-restock-option="goldReserve"]')?.value,
            maxRestockSpend: root.querySelector('[data-restock-option="maxRestockSpend"]')?.value,
            allowPartialRestock: root.querySelector('[data-restock-option="allowPartialRestock"]')?.checked === true,
            supplyPlan
        });

        const policyPatch = {};
        let anyAutoUse = false;
        SUPPLIES.filter((definition) => definition.policyItemKey).forEach((definition) => {
            const checked = root.querySelector(`[data-auto-use-item="${definition.id}"]`)?.checked === true;
            const percent = integer(root.querySelector(`[data-auto-threshold="${definition.id}"]`)?.value, 5, 95);
            policyPatch[definition.policyItemKey] = checked ? definition.id : null;
            policyPatch[definition.policyThresholdKey] = percent / 100;
            anyAutoUse ||= checked;
        });
        policyPatch.enabled = anyAutoUse;
        Aethra.ConsumableSystem?.configure?.(policyPatch);
        uiState.feedback = "Configuração salva.";
        renderControls();
    }

    Aethra.EventBus.on("bag:items-added", ({ items = [], source } = {}) => {
        if (source === "character-created" || source === "npc-shop") return;
        autoSellItems(Array.isArray(items) ? items : []);
    });
    Aethra.EventBus.on("tilemap:floor-cleared", () => processCycle("floor-cleared"));
    Aethra.EventBus.on("hunt:ended", ({ reason } = {}) => {
        if (reason !== "hero-defeated") processCycle(`hunt-ended:${reason || "unknown"}`);
    });
    Aethra.EventBus.on("tilemap:ready", renderControls);
    Aethra.EventBus.on("consumable:used", renderControls);
    Aethra.EventBus.on("state:restored", () => {
        ensureState();
        renderControls();
    });

    document.addEventListener("input", (event) => {
        const input = event.target.closest?.("#idle-loop-controls-root [data-manual-quantity]");
        if (!input) return;
        uiState.manualQuantities[input.dataset.manualQuantity] = integer(input.value, 0, 99);
        const root = document.getElementById("idle-loop-controls-root");
        const total = SUPPLIES.reduce((sum, definition) => sum + integer(uiState.manualQuantities[definition.id]) * unitPriceFor(definition.id), 0);
        const units = SUPPLIES.reduce((sum, definition) => sum + integer(uiState.manualQuantities[definition.id]), 0);
        const totalElement = root?.querySelector(".idle-purchase-total strong");
        const detailElement = root?.querySelector("[data-purchase-detail]");
        const subtotalElement = root?.querySelector(`[data-manual-subtotal="${input.dataset.manualQuantity}"]`);
        const purchaseButton = root?.querySelector('[data-idle-action="purchase-supplies"]');
        if (totalElement) totalElement.textContent = `Total: ${fmt(total)} G`;
        if (detailElement) detailElement.textContent = `${fmt(units)} unidade(s) · saldo após compra ${fmt(Math.max(0, integer(Aethra.GameState?.hero?.gold) - total))} G`;
        if (subtotalElement) subtotalElement.textContent = `Subtotal ${fmt(integer(input.value) * unitPriceFor(input.dataset.manualQuantity))} G`;
        if (purchaseButton) purchaseButton.disabled = total <= 0;
    });

    document.addEventListener("click", (event) => {
        const root = event.target.closest?.("#idle-loop-controls-root");
        if (!root) return;
        const settingButton = event.target.closest("[data-idle-setting]");
        if (settingButton) {
            const key = settingButton.dataset.idleSetting;
            const config = ensureState();
            updateSetting(key, !config[key]);
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
            const result = purchaseSupplies(uiState.manualQuantities, { source: "player-manual" });
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

    Aethra.IdleLoopSystem = {
        get config() { return ensureState(); },
        supplies: SUPPLIES,
        toggleLoop,
        updateSetting,
        configureRestock,
        purchaseSupplies,
        autoSellItems,
        restockSupplies,
        processCycle,
        renderControls,
        syncControlPosition,
        inventoryQuantity,
        isAutoSellEligible,
        getSnapshot: () => clone(ensureState())
    };

    ensureState();
})(window.Aethra = window.Aethra || {});
