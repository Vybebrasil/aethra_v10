// HuntAnalyzer.js — medição da expedição, sem tela: métricas da sessão,
// pico de DPS (janela móvel de 5 s) e recordes persistentes do herói por
// Hunt. Recordes ficam em hero.huntAnalyzerRecords; a sessão, em
// hunt.analyzerSession. Avisa por "hunt:analyzer-updated".
(function initHuntAnalyzer(Aethra) {
    "use strict";

    if (!Aethra?.EventBus || !Aethra?.HuntSystem) return;
    if (Aethra.HuntAnalyzer) return;

    const RECORD_RATE_MINIMUM_MS = 10_000;
    const PEAK_DPS_WINDOW_MS = 5_000;
    let damageWindow = [];

    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const integer = (value) => Math.max(0, Math.floor(number(value, 0)));

    function recordsState() {
        const hero = Aethra.GameState.hero = Aethra.GameState.hero || {};
        hero.huntAnalyzerRecords = hero.huntAnalyzerRecords || {};
        const records = hero.huntAnalyzerRecords;
        records.version = 1;
        records.overall = records.overall || { maxDps: 0 };
        records.byHunt = records.byHunt || {};
        return records;
    }

    function sessionIdentity(hunt) {
        return [hunt.huntId || "idle", hunt.startedAt || "not-started"].join(":");
    }

    function newSession(hunt) {
        damageWindow = [];
        return {
            sessionId: sessionIdentity(hunt),
            huntId: hunt.huntId || null,
            peakDps: 0,
            createdAt: Date.now()
        };
    }

    // A sessão acompanha a Hunt: outra rota ou outro início abre uma sessão nova.
    function session() {
        const hunt = Aethra.GameState.hunt = Aethra.GameState.hunt || {};
        if (!hunt.analyzerSession || hunt.analyzerSession.sessionId !== sessionIdentity(hunt)) {
            hunt.analyzerSession = newSession(hunt);
        }
        return hunt.analyzerSession;
    }

    function resetSession() {
        const hunt = Aethra.GameState.hunt = Aethra.GameState.hunt || {};
        hunt.analyzerSession = newSession(hunt);
    }

    function getMetrics() {
        const hunt = Aethra.GameState.hunt || {};
        const current = session();
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
            session: current,
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
            peakDps: number(current.peakDps, 0)
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

    /*
     * Taxas por hora só contam depois de 10 s de sessão; uma sessão conta
     * uma única vez como concluída, e só se teve alguma atividade.
     */
    function updateRecords({ completed = false } = {}) {
        const current = getMetrics();
        const huntId = current.hunt.huntId;
        const record = recordForHunt(huntId);
        if (!record) return null;

        if (current.elapsedMs >= RECORD_RATE_MINIMUM_MS) {
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
            || current.peakDps > 0;
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
        const peak = damageWindow.reduce((sum, entry) => sum + entry.amount, 0) / (PEAK_DPS_WINDOW_MS / 1000);
        const current = session();
        current.peakDps = Math.max(number(current.peakDps), peak);
        updateRecords();
        Aethra.EventBus.emit("hunt:analyzer-updated", { reason: "damage" });
        return true;
    }

    // Fecha a medição atual (conta como sessão concluída) e zera os totais da Hunt.
    function resetMeasurement() {
        updateRecords({ completed: true });
        damageWindow = [];
        return Aethra.HuntSystem.resetAnalyzer?.();
    }

    Aethra.EventBus.on("DamageDealt", registerDamage);
    Aethra.EventBus.on("hunt:started", resetSession);
    Aethra.EventBus.on("hunt:session-finalizing", () => updateRecords({ completed: true }));
    Aethra.EventBus.on("hunt:ended", () => updateRecords({ completed: true }));
    Aethra.EventBus.on("hunt:analyzer-reset", resetSession);
    Aethra.EventBus.on("save:loaded", () => {
        recordsState();
        resetSession();
    });

    recordsState();

    Aethra.HuntAnalyzer = {
        recordRateMinimumMs: RECORD_RATE_MINIMUM_MS,
        peakDpsWindowMs: PEAK_DPS_WINDOW_MS,
        getMetrics,
        getRecords: recordsState,
        updateRecords,
        resetMeasurement
    };
})(window.Aethra = window.Aethra || {});
