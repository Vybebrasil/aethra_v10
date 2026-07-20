// MonsterAbilityParser.js - Extrai ações estruturadas das descrições SRD
(function (Aethra) {
    "use strict";

    const CONDITIONS = [
        "blinded", "charmed", "deafened", "frightened", "grappled",
        "incapacitated", "invisible", "paralyzed", "petrified", "poisoned",
        "prone", "restrained", "stunned", "unconscious", "exhaustion"
    ];

    const slugify = (value) => String(value || "action")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

    Aethra.MonsterAbilityParser = {
        parseDamage(description = "") {
            const results = [];
            const expression = /(\d+)\s*\(([^)]+)\)\s*([A-Za-z]+)\s+damage/gi;
            let match;
            while ((match = expression.exec(description))) {
                results.push({
                    average: Number(match[1]),
                    dice: match[2].trim(),
                    damageType: match[3].toLowerCase()
                });
            }
            return results;
        },

        parseAction(action = {}) {
            const name = action.name || "Ação";
            const description = action.desc || action.description || "";
            const damage = this.parseDamage(description);
            const rechargeMatch = `${name} ${description}`.match(/Recharge\s*(\d)(?:\s*[-–]\s*(\d))?/i);
            const attackMatch = description.match(/Attack:?\s*\+(\d+)/i);
            const saveMatch = description.match(/DC\s*(\d+)/i);
            const healingMatch = description.match(/regains?\s+(\d+)(?:\s*\(([^)]+)\))?\s+Hit Points/i);
            const lower = `${name} ${description}`.toLowerCase();
            let type = "special";
            if (name.toLowerCase().includes("multiattack")) type = "multiattack";
            else if (healingMatch) type = "healing";
            else if (lower.includes("saving throw") || saveMatch) type = "save";
            else if (lower.includes("ranged attack")) type = "ranged";
            else if (lower.includes("melee attack")) type = "melee";

            return {
                id: slugify(name),
                name,
                type,
                description,
                damage,
                averageDamage: damage.reduce((total, entry) => total + Number(entry.average || 0), 0),
                attackBonus: attackMatch ? Number(attackMatch[1]) : null,
                saveDC: saveMatch ? Number(saveMatch[1]) : null,
                recharge: rechargeMatch ? {
                    min: Number(rechargeMatch[1]),
                    max: Number(rechargeMatch[2] || rechargeMatch[1])
                } : null,
                conditions: CONDITIONS.filter((condition) => {
                    return new RegExp(`\\b${condition}\\b`, "i").test(description);
                }),
                healing: healingMatch ? {
                    average: Number(healingMatch[1]),
                    dice: healingMatch[2] || null
                } : null
            };
        },

        parseMonster(monster = {}) {
            return (monster.actions || []).map((action) => this.parseAction(action));
        }
    };
})(window.Aethra = window.Aethra || {});
