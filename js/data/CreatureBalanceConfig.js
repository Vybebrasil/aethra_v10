// CreatureBalanceConfig.js - Conversão do CR de D&D para o balanceamento de Aethra
(function (Aethra) {
    "use strict";

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function parseChallengeRating(value) {
        const source = String(value ?? "0").trim();
        if (source.includes("/")) {
            const [numerator, denominator] = source.split("/").map(Number);
            return denominator ? numerator / denominator : 0;
        }
        const parsed = Number(source);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function levelForChallengeRating(value) {
        const cr = Math.max(0, parseChallengeRating(value));
        if (cr <= 0) return 1;
        if (cr <= 0.125) return 1;
        if (cr <= 0.25) return 2;
        if (cr <= 0.5) return 4;
        if (cr <= 1) return 8;
        return Math.max(9, Math.round(8 + (cr - 1) * 6));
    }

    Aethra.CreatureBalanceConfig = {
        schemaVersion: 1,
        parseChallengeRating,
        levelForChallengeRating,

        getTier(level) {
            return Math.max(1, Math.ceil((Number(level) || 1) / 10));
        },

        getRank(monster = {}) {
            const cr = parseChallengeRating(monster.challenge_rating ?? monster.challengeRating);
            if (Array.isArray(monster.legendary_actions) && monster.legendary_actions.length) {
                return "legendary";
            }
            if (cr >= 10) return "boss";
            if (cr >= 5) return "elite";
            return "normal";
        },

        getEncounterStats(monster = {}) {
            const cr = parseChallengeRating(monster.challenge_rating ?? monster.challengeRating);
            const level = levelForChallengeRating(cr);
            const tier = this.getTier(level);
            const sourceHp = Math.max(1, Number(monster.hit_points ?? monster.sourceStats?.hitPoints ?? 1));
            const expectedSourceHp = Math.max(6, 12 + cr * 14);
            const durability = clamp(sourceHp / expectedSourceHp, 0.65, 1.55);
            const hp = Math.max(1, Math.round((18 + level * 5.2) * durability));
            const armorClass = Number(monster.armor_class ?? monster.sourceStats?.armorClass ?? 10);
            const attributes = monster.attributes || monster.sourceStats?.attributes || {};
            const dexterityModifier = (Number(attributes.dex || 10) - 10) / 2;
            const strengthModifier = (Number(attributes.str || 10) - 10) / 2;
            const averageDamage = Math.max(2, 2.6 + level * 0.48);
            const damageMin = Math.max(1, Math.round(averageDamage * 0.72));
            const damageMax = Math.max(damageMin + 1, Math.round(averageDamage * 1.28));

            return {
                level,
                tier,
                hp,
                damageMin,
                damageMax,
                damage: Math.round((damageMin + damageMax) / 2),
                xp: Math.max(2, Math.round(3 + level * 1.55)),
                goldChance: Math.min(0.22, Number((0.07 + tier * 0.008).toFixed(3))),
                goldMin: Math.max(1, tier),
                goldMax: Math.max(1, tier * 2),
                stats: {
                    str: Math.max(1, Math.round(4 + strengthModifier * 1.2 + level * 0.12)),
                    precision: Math.max(3, Math.round(8 + dexterityModifier * 1.6 + level * 0.12)),
                    defense: Math.max(0, Math.round((armorClass - 10) * 0.85 + level * 0.035)),
                    critical: clamp(Number((0.035 + Math.max(0, dexterityModifier) * 0.004).toFixed(3)), 0.02, 0.18),
                    evasion: clamp(Number((0.025 + Math.max(-1, dexterityModifier) * 0.006).toFixed(3)), 0.01, 0.20),
                    blockChance: 0,
                    blockReduction: 0,
                    damageMin,
                    damageMax
                }
            };
        }
    };
})(window.Aethra = window.Aethra || {});
