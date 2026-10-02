// CityRest.js — a cidade é zona segura: ao voltar para ela, o herói descansa
// e vida, mana e vigor enchem (decisão do Paulo, 2026-10-01). Fora dela a
// recuperação é a regeneração da vocação (RegenerationSystem), poção e nível.
// "Na cidade" = vista principal "city", sem expedição ativa e sem luta: dá
// para olhar a Cidade com a caçada rodando, e isso não cura.
(function initCityRest(Aethra) {
    "use strict";

    if (!Aethra?.EventBus || !Aethra?.GameState) return;

    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    function isInCity() {
        const view = Aethra.UIManager?.primaryView || Aethra.GameState.ui?.primaryView;
        return view === "city"
            && !Aethra.GameState.hunt?.isActive
            && !Aethra.BattleSystem?.isFighting;
    }

    function rest(source = "city") {
        const hero = Aethra.GameState.hero;
        if (!hero?.characterCreated || !isInCity()) return false;
        const stats = hero.stats = hero.stats || {};
        const maxHp = Math.max(1, Math.floor(number(stats.maxHp ?? hero.maxHp, 1)));
        const maxMana = Math.max(0, Math.floor(number(stats.maxMana ?? hero.maxMana, 0)));
        const maxEnergy = Math.max(0, Math.floor(number(stats.maxEnergy ?? hero.maxEnergy, 0)));
        const before = {
            hp: number(hero.hp ?? stats.hp, maxHp),
            mana: number(hero.mana ?? stats.mana, maxMana),
            energy: number(hero.energy ?? stats.energy, maxEnergy)
        };
        if (before.hp >= maxHp && before.mana >= maxMana && before.energy >= maxEnergy) return false;

        stats.hp = maxHp;
        stats.mana = maxMana;
        stats.energy = maxEnergy;
        Object.assign(hero, { hp: maxHp, maxHp, mana: maxMana, maxMana, energy: maxEnergy, maxEnergy });

        const payload = {
            source,
            restored: {
                hp: Math.max(0, maxHp - before.hp),
                mana: Math.max(0, maxMana - before.mana),
                energy: Math.max(0, maxEnergy - before.energy)
            }
        };
        Aethra.EventBus.emit("HealthChanged", { heroHp: maxHp, heroMaxHp: maxHp });
        Aethra.EventBus.emit("BattleLog", {
            message: "Você descansou na cidade: vida, mana e vigor restaurados.",
            color: "#8fd18f",
            type: "system"
        });
        Aethra.EventBus.emit("hero:rested", payload);
        Aethra.SaveManager?.save?.("city-rest");
        return payload;
    }

    Aethra.EventBus.on("ui:primary-view-changed", ({ view } = {}) => {
        if (view === "city") rest("entered-city");
    });
    // Expedição encerrada com o jogador olhando a Cidade: agora ele está nela.
    Aethra.EventBus.on("hunt:ended", () => rest("hunt-ended-in-city"));
    // Luta de chefe ou do Coliseu acabou e o herói ficou na cidade.
    Aethra.EventBus.on("battle:ended", () => rest("battle-ended-in-city"));
    ["save:loaded", "state:restored"].forEach((eventName) => {
        Aethra.EventBus.on(eventName, () => rest(eventName));
    });

    Aethra.CityRest = { isInCity, rest };

    // O save pode ter sido carregado antes destes listeners.
    rest("boot");
})(window.Aethra = window.Aethra || {});
