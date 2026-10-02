// RegenerationSystem.js — regeneração natural estilo Tibia (decisão do Paulo,
// 2026-10-02): cada vocação recupera vida, mana e vigor no próprio ritmo, o
// tempo todo — na luta, entre lutas, parado na escada ou num evento. A placa
// fecha feridas; o Arcanista recupera mana. Poção continua sendo o reforço.
//
// Ritmo: um pulso por rodada de combate (1,8 s; mais rápido no 2×/4×).
// Valores fracionados acumulam até virar ponto inteiro.
// Dono: vida pelo BattleSystem.applyHealing (silencioso), mana e vigor pelo
// SkillSystem.setResource.
(function initRegenerationSystem(Aethra) {
    "use strict";

    if (!Aethra?.EventBus || !Aethra?.GameState) return;

    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const DEFAULT_PULSE_MS = 1800;
    // Por pulso. Mana ganha ainda +1 a cada 5 de Magia.
    const VOCATION_REGEN = Object.freeze({
        vanguard: Object.freeze({ hp: 2, mana: 0.5, energy: 2 }),
        berserker: Object.freeze({ hp: 1.5, mana: 0.5, energy: 3 }),
        templar: Object.freeze({ hp: 1.5, mana: 1, energy: 2 }),
        ranger: Object.freeze({ hp: 1, mana: 1, energy: 3 }),
        nightblade: Object.freeze({ hp: 1, mana: 1.5, energy: 2 }),
        arcanist: Object.freeze({ hp: 0.5, mana: 2, energy: 1 })
    });
    const FALLBACK_REGEN = Object.freeze({ hp: 1, mana: 1, energy: 2 });
    const RESOURCES = ["hp", "mana", "energy"];

    const carry = { hp: 0, mana: 0, energy: 0 };
    let timerId = null;
    let running = false;

    function getProfile(hero = Aethra.GameState.hero) {
        const base = VOCATION_REGEN[hero?.archetypeId] || FALLBACK_REGEN;
        const mag = Math.max(0, number(hero?.stats?.mag, 0));
        return {
            hp: base.hp,
            mana: Number((base.mana + mag / 5).toFixed(2)),
            energy: base.energy
        };
    }

    function current(resource, hero) {
        const stats = hero.stats || {};
        return number(resource === "hp" ? (hero.hp ?? stats.hp) : (stats[resource] ?? hero[resource]), 0);
    }

    function maximum(resource, hero) {
        const stats = hero.stats || {};
        const key = `max${resource.charAt(0).toUpperCase()}${resource.slice(1)}`;
        return number(stats[key] ?? hero[key], 0);
    }

    // Um pulso. Herói caído (vida 0) não se levanta sozinho.
    function pulse(source = "regeneration") {
        const hero = Aethra.GameState.hero;
        if (!hero?.characterCreated || current("hp", hero) <= 0) return null;
        const profile = getProfile(hero);
        const applied = { hp: 0, mana: 0, energy: 0 };
        RESOURCES.forEach((resource) => {
            const now = current(resource, hero);
            const max = maximum(resource, hero);
            if (now >= max) {
                carry[resource] = 0;
                return;
            }
            carry[resource] += profile[resource];
            const whole = Math.floor(carry[resource] + 1e-9);
            if (whole <= 0) return;
            carry[resource] -= whole;
            const amount = Math.min(whole, max - now);
            if (resource === "hp") {
                const healing = Aethra.BattleSystem?.applyHealing?.(amount, { source, quiet: true, skillName: "Regeneração" });
                applied.hp = Math.max(0, Math.floor(number(healing?.healedAmount, 0)));
            } else if (Aethra.SkillSystem?.setResource) {
                Aethra.SkillSystem.setResource(resource, now + amount, source);
                applied[resource] = amount;
            }
        });
        return applied;
    }

    function intervalMs() {
        return Math.max(250, number(Aethra.BattleSystem?.config?.roundMs, DEFAULT_PULSE_MS));
    }

    function schedule() {
        window.clearTimeout(timerId);
        if (!running) return;
        timerId = window.setTimeout(() => {
            pulse();
            schedule();
        }, intervalMs());
    }

    function start() {
        running = true;
        schedule();
        return true;
    }

    function stop() {
        running = false;
        window.clearTimeout(timerId);
        timerId = null;
        return true;
    }

    // Herói novo ou save carregado: frações da sessão anterior não valem.
    ["character:created", "save:loaded", "state:restored"].forEach((eventName) => {
        Aethra.EventBus.on(eventName, () => RESOURCES.forEach((resource) => { carry[resource] = 0; }));
    });

    Aethra.RegenerationSystem = {
        vocations: VOCATION_REGEN,
        getProfile,
        pulse,
        intervalMs,
        start,
        stop,
        isRunning: () => running
    };

    start();
})(window.Aethra = window.Aethra || {});
