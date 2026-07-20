// MonsterCatalogAdapter.js - Normaliza registros PocketDM para o schema de Aethra
(function (Aethra) {
    "use strict";

    const clone = (value) => JSON.parse(JSON.stringify(value));

    Aethra.MonsterCatalogAdapter = {
        normalize(raw = {}) {
            const combat = Aethra.CreatureBalanceConfig.getEncounterStats(raw);
            const type = String(raw.type || "unknown").toLowerCase();
            const rank = Aethra.CreatureBalanceConfig.getRank(raw);
            const abilities = Aethra.MonsterAbilityParser.parseMonster(raw);
            const monster = {
                id: raw.id,
                sourceId: raw.id,
                slug: raw.slug,
                name: raw.name,
                sourceName: raw.name,
                catalogSource: "pocketdm-srd",
                source: raw.source,
                rulesetVersion: raw.ruleset_version,
                isSrd: raw.is_srd === true,
                size: raw.size,
                type,
                alignment: raw.alignment,
                challengeRating: raw.challenge_rating,
                challengeRatingValue: Aethra.CreatureBalanceConfig.parseChallengeRating(raw.challenge_rating),
                recommendedLevel: combat.level,
                level: combat.level,
                tier: combat.tier,
                rank,
                ...combat,
                abilities,
                specialAbilities: (raw.special_abilities || []).map((ability) => ({
                    name: ability.name,
                    description: ability.desc
                })),
                speed: clone(raw.speed || {}),
                sourceStats: {
                    armorClass: raw.armor_class,
                    hitPoints: raw.hit_points,
                    hpFormula: raw.hp_formula,
                    xp: raw.xp,
                    attributes: clone(raw.attributes || {})
                },
                resistances: raw.damage_resistances,
                vulnerabilities: raw.damage_vulnerabilities,
                immunities: raw.damage_immunities,
                conditionImmunities: raw.condition_immunities,
                senses: raw.senses,
                languages: raw.languages,
                lootProfile: type,
                sprite: null,
                assetMissing: true,
                sourceTokenUrl: raw.token_url,
                sourceUrl: raw.url
            };
            monster.lootTable = Aethra.LootProfileRegistry.buildLootTable(monster);
            return monster;
        },

        adaptCollection(records = []) {
            return records.filter((record) => record?.is_srd === true).map((record) => this.normalize(record));
        }
    };
})(window.Aethra = window.Aethra || {});
