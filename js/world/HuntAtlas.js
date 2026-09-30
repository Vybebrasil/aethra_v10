// HuntAtlas.js — catálogo de rotas e caçadas para o mapa-múndi.
//
// Módulo não visual. Monta, a partir do HuntSystem e do GameData, o que as
// interfaces mostram no mapa (expedições, criaturas, loot esperado, focos de
// ofício) e concentra a troca de rota: parar a expedição atual e iniciar
// outra, inclusive a caçada focada numa criatura.
(function initHuntAtlas(Aethra) {
    "use strict";

    if (!Aethra) return;

    const TARGETED_PREFIX = "targeted__";

    function hunt() {
        return Aethra.HuntSystem;
    }

    function number(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function normalized(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
            .trim();
    }

    function heroLevel() {
        return Math.max(1, number(Aethra.GameState?.hero?.level, 1));
    }

    function definitions() {
        return Object.values(hunt()?.hunts || {}).filter((definition) => definition?.id);
    }

    function encounterCreatureIds(definition) {
        return Array.from(new Set((definition?.enemies || [])
            .map((entry) => (typeof entry === "string" ? entry : entry?.id))
            .filter(Boolean)));
    }

    function isTargeted(definition) {
        return String(definition?.id || "").startsWith(TARGETED_PREFIX);
    }

    // Expedições: rotas amplas (nem focos de ofício, nem caçadas focadas).
    function getExpeditions() {
        return definitions()
            .filter((definition) => definition.mode !== "specialized" && !isTargeted(definition))
            .sort((a, b) => number(a.minLevel, 1) - number(b.minLevel, 1));
    }

    function getSpecializedHunts() {
        return definitions()
            .filter((definition) => definition.mode === "specialized")
            .sort((a, b) => number(a.minLevel, 1) - number(b.minLevel, 1));
    }

    function isUnlocked(definitionOrLevel, level = heroLevel()) {
        const required = typeof definitionOrLevel === "object"
            ? number(definitionOrLevel?.minLevel ?? definitionOrLevel?.level, 1)
            : number(definitionOrLevel, 1);
        return level >= Math.max(1, required);
    }

    function getCreatureCatalog() {
        const byId = new Map();
        definitions().forEach((definition) => {
            encounterCreatureIds(definition).forEach((creatureId) => {
                const creature = Aethra.GameData?.creatures?.[creatureId];
                if (!creature) return;
                const level = number(creature.level || creature.recommendedLevel || definition.minLevel, 1);
                const existing = byId.get(creatureId) || {
                    id: creatureId,
                    name: creature.name || creatureId,
                    level,
                    type: creature.type || creature.family || creature.monsterType || "Criatura",
                    hunts: [],
                    rewards: [],
                    tags: []
                };
                existing.level = Math.min(existing.level, level);
                existing.hunts.push({
                    id: definition.id,
                    name: definition.name,
                    biome: definition.biome,
                    minLevel: number(definition.minLevel, 1),
                    region: definition.region
                });
                (definition.rewards || []).forEach((reward) => {
                    if (!existing.rewards.includes(reward)) existing.rewards.push(reward);
                });
                [creature.type, creature.family, definition.biome, definition.region]
                    .filter(Boolean)
                    .map(String)
                    .forEach((tag) => {
                        if (!existing.tags.includes(tag)) existing.tags.push(tag);
                    });
                byId.set(creatureId, existing);
            });
        });
        return Array.from(byId.values()).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    }

    // Tabela de loot esperada: prévia econômica oficial quando existe.
    function getCreatureLootPreview(creatureOrId = {}) {
        const creature = typeof creatureOrId === "string"
            ? Aethra.GameData?.creatures?.[creatureOrId] || { id: creatureOrId }
            : creatureOrId || {};
        const economyPreview = Aethra.LootSystem?.getEconomyPreview?.(creature.id || creature.catalogId);
        if (economyPreview?.drops?.length) {
            return economyPreview.drops
                .map((drop) => ({
                    templateId: drop.templateId,
                    name: drop.name,
                    icon: drop.icon || "◆",
                    chance: Math.max(0, number(drop.chance)),
                    min: Math.max(1, number(drop.min, 1)),
                    max: Math.max(1, number(drop.max || drop.min, 1)),
                    rarity: drop.rarity || "Comum",
                    value: number(drop.value),
                    guaranteed: drop.guaranteed === true,
                    sourceClass: drop.sourceClass || "material"
                }))
                .sort((a, b) => Number(b.guaranteed) - Number(a.guaranteed) || b.chance - a.chance || b.value - a.value);
        }

        const table = Array.isArray(creature.lootTable) && creature.lootTable.length
            ? creature.lootTable
            : Aethra.LootProfileRegistry?.buildLootTable?.(creature) || [];
        return table.map((drop) => {
            const templateId = drop.templateId || drop.id;
            const template = Aethra.GameData?.items?.[templateId]
                || Aethra.ItemTemplates?.[templateId]
                || Aethra.LootProfileRegistry?.materials?.[templateId]
                || {};
            return {
                templateId,
                name: drop.name || template.name || templateId,
                icon: drop.icon || template.icon || "◆",
                chance: Math.max(0, number(drop.chance)),
                min: Math.max(1, number(drop.min ?? drop.minQuantity, 1)),
                max: Math.max(1, number(drop.max ?? drop.maxQuantity ?? drop.min, 1)),
                rarity: drop.rarity || template.rarity || "Comum",
                value: number(template.price ?? template.value ?? template.basePrice)
            };
        }).sort((a, b) => b.chance - a.chance || b.value - a.value);
    }

    function getExpeditionTags(definition = {}) {
        const enemies = encounterCreatureIds(definition)
            .map((id) => Aethra.GameData?.creatures?.[id])
            .filter(Boolean);
        const danger = number(definition.danger, 1);
        const ranks = enemies.map((entry) => normalized(entry.rank));
        const tags = [];
        if (danger <= 3) tags.push("SOLO");
        if (danger >= 3) tags.push("GRUPO");
        if (danger >= 4 || ranks.some((rank) => rank.includes("elite"))) tags.push("ELITE");
        if (danger >= 5 || ranks.some((rank) => rank.includes("boss") || rank.includes("legend"))) tags.push("BOSS");
        return tags.length ? tags : ["SOLO"];
    }

    function getRecommendedMode(definition = {}) {
        const tags = getExpeditionTags(definition);
        if (tags.includes("BOSS")) return "Grupo 3–5";
        if (tags.includes("GRUPO")) return "Solo avançado / Grupo";
        return "Solo";
    }

    // Registra (ou atualiza) a rota de caçada focada numa criatura.
    function ensureTargetedHunt(creatureId) {
        const creature = Aethra.GameData?.creatures?.[creatureId];
        if (!creature || !hunt()?.hunts) return null;
        const source = definitions().find((definition) => !isTargeted(definition) && encounterCreatureIds(definition).includes(creatureId));
        const huntId = `${TARGETED_PREFIX}${creatureId}`;
        const level = number(creature.level || creature.recommendedLevel || source?.minLevel, 1);
        hunt().hunts[huntId] = {
            id: huntId,
            name: `Caçada: ${creature.name || creatureId}`,
            region: source?.region || "Hunt Direta",
            biome: source?.biome || (creature.type || "Caçada Direta"),
            description: `Caçada focada em ${creature.name || creatureId}. Loop contínuo com essa criatura como alvo principal.`,
            minLevel: level,
            maxLevel: number(creature.level || creature.recommendedLevel || source?.maxLevel || source?.minLevel, 1),
            danger: number(source?.danger, Math.max(1, Math.ceil(level / 20))),
            icon: source?.icon || "✦",
            position: source?.position || { x: 50, y: 50 },
            rewards: Array.isArray(source?.rewards) ? [...source.rewards] : ["Loot focado", "XP direta"],
            enemies: [{ id: creatureId, weight: 100 }],
            encounterChance: 0.82,
            mode: "hunt"
        };
        return hunt().hunts[huntId];
    }

    /*
     * Leva o herói para uma rota. Se já estiver nela, só confirma; se estiver
     * em outra, encerra a atual antes (as recompensas da sessão são fechadas
     * pelo HuntSystem). Retorna { started, resumed, huntId }.
     */
    function startRoute(huntId, options = {}) {
        const system = hunt();
        if (!huntId || !system?.startHunt) return { started: false, resumed: false, huntId };
        const current = Aethra.GameState?.hunt || {};
        if (current.isActive && current.huntId === huntId) {
            return { started: true, resumed: true, huntId };
        }
        if (current.isActive) system.stopHunt?.(options.stopReason || "route-change");
        const started = Boolean(system.startHunt(huntId, {
            mode: options.mode,
            targetCreatureId: options.targetCreatureId
        }));
        return { started, resumed: false, huntId };
    }

    function startCreatureHunt(creatureId, options = {}) {
        const definition = ensureTargetedHunt(creatureId);
        if (!definition) return { started: false, resumed: false, huntId: null };
        return startRoute(definition.id, { ...options, mode: "hunt", targetCreatureId: creatureId });
    }

    Aethra.HuntAtlas = Object.freeze({
        heroLevel,
        isUnlocked,
        encounterCreatureIds,
        getExpeditions,
        getSpecializedHunts,
        getCreatureCatalog,
        getCreatureLootPreview,
        getExpeditionTags,
        getRecommendedMode,
        ensureTargetedHunt,
        startRoute,
        startCreatureHunt
    });
})(window.Aethra = window.Aethra || {});
