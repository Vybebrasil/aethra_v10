// HuntAnalyzerWorkspace.js - Session ledger, supply detail and persistent hunt records.
(function (Aethra) {
    "use strict";

    if (!Aethra?.RenderEngine || !Aethra?.HuntSystem || !Aethra?.EventBus) return;
    if (Aethra.HuntAnalyzerWorkspace) return;

    const Render = Aethra.RenderEngine;
    const RECORD_RATE_MINIMUM_MS = 10_000;
    const PEAK_DPS_WINDOW_MS = 5_000;
    let damageWindow = [];

    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const integer = (value) => Math.max(0, Math.floor(number(value, 0)));
    const format = (value, digits = 0) => new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    }).format(number(value, 0));
    const escapeHTML = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    function formatDuration(secondsValue) {
        const total = Math.max(0, Math.floor(number(secondsValue, 0)));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;
        return hours > 0
            ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
            : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    function tooltip({ eyebrow = "HUNT ANALYZER", title, value = "", body, hint = "" }) {
        return `tabindex="0" data-ui-tooltip data-tooltip-kind="hud" data-tooltip-eyebrow="${escapeHTML(eyebrow)}" data-tooltip-title="${escapeHTML(title)}" data-tooltip-value="${escapeHTML(value)}" data-tooltip-body="${escapeHTML(body)}"${hint ? ` data-tooltip-hint="${escapeHTML(hint)}"` : ""}`;
    }

    function telemetry() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.huntTelemetry = Aethra.GameState.ui.huntTelemetry || {
            damage: 0,
            damageTaken: 0,
            healing: 0,
            criticals: 0,
            attacks: 0
        };
        return Aethra.GameState.ui.huntTelemetry;
    }

    function recordsState() {
        const hero = Aethra.GameState.hero = Aethra.GameState.hero || {};
        hero.huntAnalyzerRecords = hero.huntAnalyzerRecords || {};
        const records = hero.huntAnalyzerRecords;
        records.version = 1;
        records.overall = records.overall || { maxDps: 0 };
        records.byHunt = records.byHunt || {};
        return records;
    }

    function createSessionIdentity(hunt) {
        return [hunt.huntId || "idle", hunt.startedAt || "not-started"].join(":");
    }

    function analyzerSession() {
        const hunt = Aethra.GameState.hunt = Aethra.GameState.hunt || {};
        const expectedId = createSessionIdentity(hunt);
        const current = hunt.analyzerSession;
        if (!current || current.sessionId !== expectedId) {
            hunt.analyzerSession = {
                sessionId: expectedId,
                huntId: hunt.huntId || null,
                peakDps: 0,
                createdAt: Date.now()
            };
            damageWindow = [];
        }
        return hunt.analyzerSession;
    }

    function metrics() {
        const hunt = Aethra.GameState.hunt || {};
        const combat = telemetry();
        const session = analyzerSession();
        const elapsedMs = Math.max(0, number(hunt.elapsedMs, 0));
        const seconds = elapsedMs / 1000;
        const hours = Math.max(seconds / 3600, 1 / 3600);
        const xp = integer(hunt.xp);
        const gold = integer(hunt.gold);
        const loot = integer(hunt.lootValue);
        const spent = integer(hunt.supplyCost);
        const gained = gold + loot;
        const profit = gained - spent;
        return {
            hunt,
            combat,
            session,
            elapsedMs,
            seconds,
            xp,
            xpPerHour: xp > 0 ? Math.floor(xp / hours) : 0,
            gold,
            loot,
            spent,
            gained,
            profit,
            profitPerHour: profit !== 0 ? Math.floor(profit / hours) : 0,
            kills: integer(hunt.kills),
            averageDps: seconds > 0 ? number(combat.damage, 0) / seconds : 0,
            peakDps: number(session.peakDps, 0)
        };
    }

    function recordForHunt(huntId) {
        if (!huntId) return null;
        const records = recordsState();
        records.byHunt[huntId] = records.byHunt[huntId] || {
            sessions: 0,
            bestXpPerHour: 0,
            bestProfitPerHour: 0,
            bestSessionXp: 0,
            bestSessionProfit: 0,
            maxDps: 0,
            lastCompletedSessionId: null,
            updatedAt: null
        };
        return records.byHunt[huntId];
    }

    function updateRecords({ completed = false } = {}) {
        const current = metrics();
        const huntId = current.hunt.huntId;
        const record = recordForHunt(huntId);
        if (!record) return null;

        const eligibleRate = current.elapsedMs >= RECORD_RATE_MINIMUM_MS;
        if (eligibleRate) {
            record.bestXpPerHour = Math.max(number(record.bestXpPerHour), current.xpPerHour);
            record.bestProfitPerHour = Math.max(number(record.bestProfitPerHour), current.profitPerHour);
        }
        record.bestSessionXp = Math.max(number(record.bestSessionXp), current.xp);
        record.bestSessionProfit = Math.max(number(record.bestSessionProfit), current.profit);
        record.maxDps = Math.max(number(record.maxDps), current.peakDps);

        const records = recordsState();
        records.overall.maxDps = Math.max(number(records.overall.maxDps), current.peakDps);
        record.updatedAt = Date.now();

        const hasActivity = current.elapsedMs > 0
            || current.xp > 0
            || current.gained > 0
            || current.spent > 0
            || current.kills > 0
            || number(current.combat.damage, 0) > 0;
        if (completed && hasActivity && record.lastCompletedSessionId !== current.session.sessionId) {
            record.sessions = integer(record.sessions) + 1;
            record.lastCompletedSessionId = current.session.sessionId;
            Aethra.EventBus.emit("hunt:record-updated", {
                huntId,
                sessionId: current.session.sessionId,
                record: { ...record }
            });
        }
        return record;
    }

    function registerDamage(payload = {}) {
        if (payload.side !== "hero") return false;
        const amount = Math.max(0, number(payload.amount, 0));
        if (amount <= 0) return false;

        const now = Date.now();
        damageWindow.push({ at: now, amount });
        damageWindow = damageWindow.filter((entry) => now - entry.at <= PEAK_DPS_WINDOW_MS);

        const windowDamage = damageWindow.reduce((sum, entry) => sum + entry.amount, 0);
        const peak = windowDamage / (PEAK_DPS_WINDOW_MS / 1000);
        const session = analyzerSession();
        session.peakDps = Math.max(number(session.peakDps), peak);
        updateRecords();
        Render.renderHunt?.();
        return true;
    }

    function supplyRows(current) {
        const entries = Object.values(current.hunt.supplyBreakdown || {})
            .map((entry) => ({
                id: entry.itemId || entry.id || "supply",
                name: entry.name || entry.itemId || "Supply",
                quantity: integer(entry.quantity),
                totalCost: integer(entry.totalCost ?? entry.cost)
            }))
            .filter((entry) => entry.quantity > 0 || entry.totalCost > 0)
            .sort((left, right) => right.totalCost - left.totalCost);
        const accounted = entries.reduce((sum, entry) => sum + entry.totalCost, 0);
        if (current.spent > accounted) {
            entries.push({
                id: "legacy-supplies",
                name: "Outros supplies",
                quantity: 0,
                totalCost: current.spent - accounted
            });
        }
        return entries;
    }

    function metricCard({ tone = "", label, value, detail, tooltipData, attribute = "" }) {
        return `<article class="analyzer-ledger-card ${tone ? `is-${tone}` : ""}" ${attribute} ${tooltip(tooltipData)}><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong><span>${escapeHTML(detail)}</span></article>`;
    }

    function renderHuntAnalyzer() {
        const root = document.getElementById("hunt-display");
        if (!root) return false;

        const current = metrics();
        const totals = Aethra.ExplorationSystem?.getSnapshot?.().totals || {};
        const definition = Aethra.HuntSystem.hunts?.[current.hunt.huntId] || null;
        const huntName = definition?.name || "Nenhuma hunt ativa";
        const record = updateRecords() || {};
        const overall = recordsState().overall;
        const supplies = supplyRows(current);
        const attacks = integer(current.combat.attacks);
        const expanded = current.hunt.isActive
            ? Boolean(Aethra.GameState.ui?.huntAnalyzerExpanded)
            : true;
        const supplyHTML = supplies.length
            ? supplies.map((entry) => `
                <div class="analyzer-supply-row">
                    <span><i aria-hidden="true">${entry.id.includes("potion") ? "◉" : "▣"}</i><b>${escapeHTML(entry.name)}</b><small>${entry.quantity > 0 ? `${format(entry.quantity)} usado(s)` : "custo importado"}</small></span>
                    <strong>${format(entry.totalCost)} G</strong>
                </div>`).join("")
            : `<div class="analyzer-empty-row"><span>✓</span><p><strong>Nenhum supply consumido</strong><small>Poções, runas e outros consumíveis aparecerão aqui.</small></p></div>`;

        root.innerHTML = `
            <section class="hunt-analyzer hunt-analyzer--ledger" aria-label="Hunt Analyzer detalhado">
                <header class="analyzer-session-bar">
                    <div><span class="analyzer-live-state ${current.hunt.isActive ? "is-live" : ""}"><i></i>${current.hunt.isActive ? "AO VIVO" : "PARADA"}</span><strong>${escapeHTML(huntName)}</strong></div>
                    <time datetime="PT${Math.floor(current.seconds)}S">${formatDuration(current.seconds)}</time>
                </header>

                <div class="analyzer-ledger-grid">
                    ${metricCard({ tone: "xp", label: "XP total", value: format(current.xp), detail: `${format(current.xpPerHour)} XP/h`, attribute: 'data-analyzer-value="xp-total"', tooltipData: { title: "XP total da sessão", value: `${format(current.xp)} XP`, body: "Toda a experiência de herói obtida desde o início ou o último reset desta medição." } })}
                    ${metricCard({ tone: "rate", label: "XP por hora", value: format(current.xpPerHour), detail: "ritmo atual", attribute: 'data-analyzer-value="xp-hour"', tooltipData: { title: "Ritmo de experiência", value: `${format(current.xpPerHour)} XP/h`, body: "Projeção por hora calculada a partir do XP total e da duração desta sessão.", hint: "A taxa fica mais estável conforme a Hunt dura mais." } })}
                    ${metricCard({ tone: "gain", label: "Ganhos totais", value: `${format(current.gained)} G`, detail: "gold + valor do loot", attribute: 'data-analyzer-value="gained-total"', tooltipData: { title: "Entradas brutas", value: `${format(current.gained)} G`, body: "Soma do gold coletado com o valor estimado de venda de todo o loot." } })}
                    ${metricCard({ tone: "cost", label: "Gastos totais", value: `${format(current.spent)} G`, detail: "supplies consumidos", attribute: 'data-analyzer-value="spent-total"', tooltipData: { title: "Custo de supplies", value: `${format(current.spent)} G`, body: "Valor de compra das poções, runas e demais consumíveis usados nesta sessão." } })}
                    ${metricCard({ tone: current.profit < 0 ? "loss" : "profit", label: "Saldo líquido", value: `${current.profit > 0 ? "+" : ""}${format(current.profit)} G`, detail: `${format(current.profitPerHour)} G/h`, attribute: 'data-analyzer-value="profit-total"', tooltipData: { title: "Profit da sessão", value: `${format(current.profit)} G`, body: "Ganhos brutos menos os gastos totais com supplies." } })}
                    ${metricCard({ tone: "kill", label: "Abates", value: format(current.kills), detail: current.kills ? `${formatDuration(current.seconds / current.kills)} por abate` : "sem abates", attribute: 'data-analyzer-value="kills"', tooltipData: { title: "Criaturas derrotadas", value: format(current.kills), body: "Quantidade de inimigos eliminados desde o início desta medição." } })}
                </div>

                <details class="analyzer-extended" data-analyzer-extended ${expanded ? "open" : ""}>
                    <summary><span><strong>Análise completa</strong><small>Economia, combate, recordes e exploração</small></span><b>${current.hunt.isActive ? "Durante a Hunt" : "Resumo da sessão"}</b></summary>
                    <div class="analyzer-extended__body">
                <div class="analyzer-section-heading"><div><strong>Economia da sessão</strong><small>de onde entrou e para onde saiu</small></div><em>${current.profit >= 0 ? "POSITIVO" : "NEGATIVO"}</em></div>
                <div class="analyzer-ledger-lines">
                    <span><i class="is-gain">＋</i><b>Gold coletado</b><strong>${format(current.gold)} G</strong></span>
                    <span><i class="is-gain">＋</i><b>Valor estimado do loot</b><strong>${format(current.loot)} G</strong></span>
                    <span><i class="is-cost">−</i><b>Supplies consumidos</b><strong>${format(current.spent)} G</strong></span>
                </div>

                <details class="analyzer-disclosure" open>
                    <summary><span><strong>Detalhe de supplies</strong><small>${supplies.length ? `${format(supplies.length)} tipo(s) consumido(s)` : "sem consumo nesta sessão"}</small></span><b>${format(current.spent)} G</b></summary>
                    <div class="analyzer-supply-list">${supplyHTML}</div>
                </details>

                <div class="analyzer-section-heading"><div><strong>Combate</strong><small>DPS de pico usa uma janela móvel de 5 segundos</small></div></div>
                <div class="analyzer-combat-grid">
                    <span ${tooltip({ title: "DPS médio", value: format(current.averageDps, 1), body: "Dano total causado dividido pelo tempo completo da sessão." })}><small>DPS médio</small><b>${format(current.averageDps, 1)}</b></span>
                    <span ${tooltip({ title: "Pico de DPS da sessão", value: format(current.peakDps, 1), body: "Maior dano por segundo observado em uma janela móvel de cinco segundos." })}><small>Pico DPS sessão</small><b>${format(current.peakDps, 1)}</b></span>
                    <span><small>Dano causado</small><b>${format(current.combat.damage)}</b></span>
                    <span><small>Dano recebido</small><b>${format(current.combat.damageTaken)}</b></span>
                    <span><small>Ataques</small><b>${format(attacks)}</b></span>
                    <span><small>Críticos</small><b>${format(current.combat.criticals)}</b></span>
                </div>

                <div class="analyzer-section-heading"><div><strong>Recordes do herói</strong><small>${escapeHTML(huntName)} · taxas válidas após 10s</small></div><em>${format(record.sessions || 0)} SESSÕES</em></div>
                <div class="analyzer-record-grid">
                    <span ${tooltip({ eyebrow: "RECORDE NESTA HUNT", title: "Melhor XP por hora", value: `${format(record.bestXpPerHour)} XP/h`, body: "Maior ritmo de XP que este herói já registrou nesta Hunt.", hint: `Maior total em uma sessão: ${format(record.bestSessionXp)} XP.` })}><small>Melhor XP/h</small><b>${format(record.bestXpPerHour)}</b><em>${format(record.bestSessionXp)} XP em sessão</em></span>
                    <span ${tooltip({ eyebrow: "RECORDE NESTA HUNT", title: "Melhor profit por hora", value: `${format(record.bestProfitPerHour)} G/h`, body: "Maior ritmo de lucro líquido que este herói já registrou nesta Hunt.", hint: `Maior saldo em uma sessão: ${format(record.bestSessionProfit)} G.` })}><small>Melhor profit/h</small><b>${format(record.bestProfitPerHour)}</b><em>${format(record.bestSessionProfit)} G em sessão</em></span>
                    <span ${tooltip({ eyebrow: "RECORDE NESTA HUNT", title: "Maior DPS nesta Hunt", value: format(record.maxDps, 1), body: "Maior pico de DPS deste herói registrado especificamente nesta Hunt." })}><small>Máx. DPS Hunt</small><b>${format(record.maxDps, 1)}</b><em>janela de 5s</em></span>
                    <span ${tooltip({ eyebrow: "RECORDE GERAL", title: "Maior DPS do herói", value: format(overall.maxDps, 1), body: "Maior pico de DPS já registrado por este herói em qualquer Hunt." })}><small>Máx. DPS geral</small><b>${format(overall.maxDps, 1)}</b><em>todas as Hunts</em></span>
                </div>

                <div class="analyzer-section-heading"><div><strong>Exploração da rota</strong><small>eventos do mapa; não entram no profit</small></div></div>
                <div class="analyzer-exploration-grid">
                    <span ${tooltip({ eyebrow: "EXPLORAÇÃO", title: "Eventos encontrados", value: format(totals.events), body: "Quantidade de acontecimentos da rota descobertos nesta sessão, como altares, baús e acampamentos." })}><i>⌁</i><small>Eventos</small><b>${format(totals.events)}</b></span>
                    <span ${tooltip({ eyebrow: "EXPLORAÇÃO", title: "Recursos coletados", value: format(totals.resources), body: "Total de unidades de materiais de exploração recolhidas nos eventos da rota." })}><i>▦</i><small>Recursos</small><b>${format(totals.resources)}</b></span>
                    <span ${tooltip({ eyebrow: "EXPLORAÇÃO", title: "XP de profissões", value: format(totals.skillXP), body: "Experiência concedida às profissões usadas para resolver eventos; não é XP de nível do herói." })}><i>✦</i><small>XP profissão</small><b>${format(totals.skillXP)}</b></span>
                    <span ${tooltip({ eyebrow: "EXPLORAÇÃO", title: "Eventos raros", value: format(totals.rareEvents), body: "Número de eventos especiais ou encontros raros encontrados nesta rota." })}><i>◇</i><small>Raros</small><b>${format(totals.rareEvents)}</b></span>
                </div>

                <button type="button" class="hunt-analyzer__reset" data-reset-hunt-analyzer>Resetar apenas esta medição</button>
                    </div>
                </details>
            </section>`;

        root.querySelector("[data-reset-hunt-analyzer]")?.addEventListener("click", () => Aethra.HuntAnalyzerWorkspace.resetMeasurement());
        root.querySelector("[data-analyzer-extended]")?.addEventListener("toggle", (event) => {
            Aethra.GameState.ui = Aethra.GameState.ui || {};
            Aethra.GameState.ui.huntAnalyzerExpanded = Boolean(event.currentTarget.open);
        });
        return true;
    }

    function resetMeasurement() {
        updateRecords({ completed: true });
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.huntTelemetry = {
            damage: 0,
            damageTaken: 0,
            healing: 0,
            criticals: 0,
            attacks: 0
        };
        damageWindow = [];
        return Aethra.HuntSystem.resetAnalyzer?.();
    }

    function resetSession() {
        const hunt = Aethra.GameState.hunt || {};
        hunt.analyzerSession = {
            sessionId: createSessionIdentity(hunt),
            huntId: hunt.huntId || null,
            peakDps: 0,
            createdAt: Date.now()
        };
        damageWindow = [];
    }

    Aethra.HuntAnalyzerWorkspace = {
        recordRateMinimumMs: RECORD_RATE_MINIMUM_MS,
        peakDpsWindowMs: PEAK_DPS_WINDOW_MS,
        getMetrics: metrics,
        getRecords: recordsState,
        updateRecords,
        recordSupplyUse: (...args) => Aethra.HuntSystem.recordSupplyUse(...args),
        resetMeasurement,
        render: renderHuntAnalyzer
    };

    Render.renderHunt = renderHuntAnalyzer;

    Aethra.EventBus.on("DamageDealt", registerDamage);
    Aethra.EventBus.on("hunt:started", () => {
        resetSession();
        renderHuntAnalyzer();
    });
    Aethra.EventBus.on("hunt:session-finalizing", () => updateRecords({ completed: true }));
    Aethra.EventBus.on("hunt:ended", () => {
        updateRecords({ completed: true });
        renderHuntAnalyzer();
    });
    Aethra.EventBus.on("hunt:analyzer-reset", () => {
        resetSession();
        renderHuntAnalyzer();
    });
    Aethra.EventBus.on("hunt:supply-used", renderHuntAnalyzer);
    Aethra.EventBus.on("save:loaded", () => {
        recordsState();
        resetSession();
        renderHuntAnalyzer();
    });

    recordsState();
    window.setTimeout(renderHuntAnalyzer, 0);
})(window.Aethra);
