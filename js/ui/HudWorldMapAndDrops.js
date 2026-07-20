// HudWorldMapAndDrops.js - Mapa Mundi, Inspect suspenso e Drops da Expedição
(function (Aethra) {
    "use strict";

    if (!Aethra?.RenderEngine || !Aethra?.EventBus || !Aethra?.HuntSystem) {
        return;
    }

    if (Aethra.RenderEngine._worldMapDropsPatchApplied) return;
    Aethra.RenderEngine._worldMapDropsPatchApplied = true;

    const Render = Aethra.RenderEngine;
    const Hunt = Aethra.HuntSystem;
    const WorldWindows = Aethra.WindowManager;
    const escapeHTML = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    const formatNumber = (value) => new Intl.NumberFormat("pt-BR")
        .format(Number(value || 0));

    const WORLD_MAP_FILTER_KEY = "aethra.worldMap.huntFilters.v1";

    function loadHuntFilters() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        if (Aethra.GameState.ui.huntCatalogFilters) {
            return Aethra.GameState.ui.huntCatalogFilters;
        }
        let stored = {};
        try {
            stored = JSON.parse(localStorage.getItem(WORLD_MAP_FILTER_KEY) || "{}") || {};
        } catch (error) {
            stored = {};
        }
        const normalized = {
            search: String(stored.search || ""),
            type: String(stored.type || "all"),
            biome: String(stored.biome || "all"),
            access: String(stored.access || "all"),
            sort: String(stored.sort || "level")
        };
        Aethra.GameState.ui.huntCatalogFilters = normalized;
        return normalized;
    }

    function saveHuntFilters(next = {}) {
        const filters = { ...loadHuntFilters(), ...next };
        Aethra.GameState.ui.huntCatalogFilters = filters;
        try {
            localStorage.setItem(WORLD_MAP_FILTER_KEY, JSON.stringify(filters));
        } catch (error) {
            // O protótipo continua funcionando quando o armazenamento está indisponível.
        }
        return filters;
    }

    function normalizedSearch(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    const HUNT_WORLD_DEFINITIONS = Aethra.HuntCatalog?.getDefinitions?.() || {
        whispering_forest: {
            id: "whispering_forest",
            name: "Bosque dos Sussurros",
            region: "Fronteira de Aethra",
            biome: "Floresta antiga",
            description: "Rota inicial do mundo de Aethra.",
            minLevel: 1,
            maxLevel: 8,
            danger: 1,
            icon: "♣",
            position: { x: 22, y: 62 },
            rewards: ["Couro", "Ervas", "Baús comuns"],
            enemies: [
                { id: "forest_wolf", weight: 80 },
                { id: "giant_rat", weight: 20 }
            ],
            encounterChance: 0.35
        }
    };

    Object.entries(HUNT_WORLD_DEFINITIONS).forEach(([huntId, definition]) => {
        Hunt.hunts[huntId] = {
            ...(Hunt.hunts[huntId] || {}),
            ...definition,
            enemies: definition.enemies.map((enemy) => ({ ...enemy }))
        };
    });

    const originalStartHunt = Hunt.startHunt.bind(Hunt);
    Hunt.startHunt = function (huntId = "whispering_forest", options = {}) {
        const definition = this.hunts[huntId];
        const heroLevel = Math.max(1, Number(Aethra.GameState.hero?.level || 1));
        const requiredLevel = Math.max(1, Number(definition?.minLevel || 1));

        if (definition && heroLevel < requiredLevel) {
            Aethra.EventBus.emit("BattleLog", {
                message: `${definition.name} exige nível ${requiredLevel}. Seu herói está no nível ${heroLevel}.`,
                color: "#ffb36a",
                type: "system"
            });
            Aethra.EventBus.emit("hunt:locked", {
                huntId,
                minLevel: requiredLevel,
                heroLevel
            });
            return false;
        }

        const started = originalStartHunt(huntId, options);
        if (started && Aethra.GameState?.hunt) {
            Aethra.GameState.hunt.mode = options.mode || definition?.mode || 'expedition';
            Aethra.GameState.hunt.targetCreatureId = options.targetCreatureId || null;
        }
        return started;
    };

    function getHeroLevel() {
        return Math.max(1, Number(Aethra.GameState.hero?.level || 1));
    }

    function getHuntDefinition(huntId) {
        return Hunt.hunts[huntId] || Hunt.hunts.whispering_forest;
    }

    function ensureWorldMapWindow() {
        let windowElement = document.getElementById("hunt-world-map-view");

        if (!windowElement) {
            windowElement = document.createElement("section");
            windowElement.id = "hunt-world-map-view";
            windowElement.className = "game-window hidden hunt-world-map-window";
            windowElement.dataset.aethraWindow = "hunt-world-map-view";
            windowElement.dataset.windowSize = "large";
            windowElement.setAttribute("aria-hidden", "true");
            windowElement.innerHTML = `
                <header class="window-header hunt-world-map-window__header">
                    <div>
                        <small id="hunt-world-map-heading-kicker">Rotas, níveis e recompensas</small>
                        <h2 id="hunt-world-map-heading-title">Mapa Mundi de Expedições</h2>
                    </div>
                    <div class="hunt-world-map-window__actions">
                        <div class="hunt-world-map-mode-toggle" role="tablist" aria-label="Modo do mapa">
                            <button type="button" class="is-active" data-world-map-mode="expeditions" role="tab" aria-selected="true">Expedições</button>
                            <button type="button" data-world-map-mode="hunts" role="tab" aria-selected="false">Hunts</button>
                        </div>
                        <button type="button" class="window-close" data-close-window="hunt-world-map-view" aria-label="Fechar Mapa Mundi">×</button>
                    </div>
                </header>
                <div id="hunt-world-map-content" class="hunt-world-map-content"></div>
            `;
            document.body.appendChild(windowElement);
        }

        WorldWindows?.registerWindow?.("hunt-world-map-view", windowElement);
        return windowElement;
    }

    function getEncounterCreatureIds(definition) {
        return Array.from(new Set((definition?.enemies || []).map((entry) => typeof entry === "string" ? entry : entry.id).filter(Boolean)));
    }

    function buildCreatureCatalog() {
        const byId = new Map();
        const definitions = Object.values(Hunt.hunts || {});
        definitions.forEach((huntDef) => {
            getEncounterCreatureIds(huntDef).forEach((creatureId) => {
                const creature = Aethra.GameData?.creatures?.[creatureId];
                if (!creature) return;
                const level = Number(creature.level || creature.recommendedLevel || huntDef.minLevel || 1);
                const existing = byId.get(creatureId) || {
                    id: creatureId,
                    name: creature.name || creatureId,
                    level,
                    type: creature.type || creature.family || creature.monsterType || 'Criatura',
                    hunts: [],
                    rewards: new Set(),
                    tags: new Set()
                };
                existing.level = Math.min(existing.level, level);
                existing.hunts.push({
                    id: huntDef.id,
                    name: huntDef.name,
                    biome: huntDef.biome,
                    minLevel: Number(huntDef.minLevel || 1),
                    region: huntDef.region
                });
                (huntDef.rewards || []).forEach((reward) => existing.rewards.add(reward));
                [creature.type, creature.family, huntDef.biome, huntDef.region].filter(Boolean).forEach((tag) => existing.tags.add(String(tag)));
                byId.set(creatureId, existing);
            });
        });
        return Array.from(byId.values()).sort((a,b) => a.level - b.level || a.name.localeCompare(b.name));
    }

    function getCreatureLootPreview(creature = {}) {
        const economyPreview = Aethra.LootSystem?.getEconomyPreview?.(creature.id || creature.catalogId);
        if (economyPreview?.drops?.length) {
            return economyPreview.drops
                .map((drop) => ({
                    templateId: drop.templateId,
                    name: drop.name,
                    icon: drop.icon || '◆',
                    chance: Math.max(0, Number(drop.chance || 0)),
                    min: Math.max(1, Number(drop.min || 1)),
                    max: Math.max(1, Number(drop.max || drop.min || 1)),
                    rarity: drop.rarity || 'Comum',
                    value: Number(drop.value || 0),
                    guaranteed: drop.guaranteed === true,
                    sourceClass: drop.sourceClass || 'material'
                }))
                .sort((a, b) => Number(b.guaranteed) - Number(a.guaranteed) || b.chance - a.chance || b.value - a.value);
        }

        const directTable = Array.isArray(creature.lootTable) && creature.lootTable.length
            ? creature.lootTable
            : Aethra.LootProfileRegistry?.buildLootTable?.(creature) || [];
        return directTable.map((drop) => {
            const templateId = drop.templateId || drop.id;
            const template = Aethra.GameData?.items?.[templateId] || Aethra.ItemTemplates?.[templateId] || Aethra.LootProfileRegistry?.materials?.[templateId] || {};
            return {
                templateId,
                name: drop.name || template.name || templateId,
                icon: drop.icon || template.icon || '◆',
                chance: Math.max(0, Number(drop.chance || 0)),
                min: Math.max(1, Number(drop.min ?? drop.minQuantity ?? 1)),
                max: Math.max(1, Number(drop.max ?? drop.maxQuantity ?? drop.min ?? 1)),
                rarity: drop.rarity || template.rarity || 'Comum',
                value: Number(template.price ?? template.value ?? template.basePrice ?? 0)
            };
        }).sort((a, b) => b.chance - a.chance || b.value - a.value);
    }

    function rarityClass(rarity) {
        return normalizedSearch(rarity).replace(/[^a-z0-9]+/g, '-') || 'comum';
    }

    function getExpeditionTags(definition = {}) {
        const enemies = getEncounterCreatureIds(definition)
            .map((id) => Aethra.GameData?.creatures?.[id])
            .filter(Boolean);
        const danger = Number(definition.danger || 1);
        const ranks = enemies.map((entry) => normalizedSearch(entry.rank));
        const tags = [];
        if (danger <= 3) tags.push('SOLO');
        if (danger >= 3) tags.push('GRUPO');
        if (danger >= 4 || ranks.some((rank) => rank.includes('elite'))) tags.push('ELITE');
        if (danger >= 5 || ranks.some((rank) => rank.includes('boss') || rank.includes('legend'))) tags.push('BOSS');
        return tags.length ? tags : ['SOLO'];
    }

    function getExpeditionRecommendedMode(definition = {}) {
        const tags = getExpeditionTags(definition);
        if (tags.includes('BOSS')) return 'Grupo 3–5';
        if (tags.includes('GRUPO')) return 'Solo avançado / Grupo';
        return 'Solo';
    }

    function filterCreatureCatalog(creatures, heroLevel, filters) {
        const query = normalizedSearch(filters.search);
        return creatures
            .filter((entry) => {
                const searchable = normalizedSearch([
                    entry.name,
                    entry.type,
                    ...Array.from(entry.tags || []),
                    ...(entry.hunts || []).flatMap((hunt) => [hunt.name, hunt.biome, hunt.region])
                ].join(' '));
                if (query && !searchable.includes(query)) return false;
                if (filters.type !== 'all' && normalizedSearch(entry.type) !== normalizedSearch(filters.type)) return false;
                if (filters.biome !== 'all') {
                    const biomes = (entry.hunts || []).map((hunt) => normalizedSearch(hunt.biome));
                    if (!biomes.includes(normalizedSearch(filters.biome))) return false;
                }
                if (filters.access === 'unlocked' && heroLevel < Number(entry.level || 1)) return false;
                if (filters.access === 'locked' && heroLevel >= Number(entry.level || 1)) return false;
                return true;
            })
            .sort((a, b) => {
                if (filters.sort === 'name') return a.name.localeCompare(b.name);
                if (filters.sort === 'type') return String(a.type).localeCompare(String(b.type)) || a.level - b.level;
                return a.level - b.level || a.name.localeCompare(b.name);
            });
    }

    function ensureTargetedCreatureHunt(creatureId) {
        const creature = Aethra.GameData?.creatures?.[creatureId];
        if (!creature) return null;
        const source = Object.values(Hunt.hunts || {}).find((hunt) => getEncounterCreatureIds(hunt).includes(creatureId));
        const huntId = `targeted__${creatureId}`;
        Hunt.hunts[huntId] = {
            id: huntId,
            name: `Caçada: ${creature.name || creatureId}`,
            region: source?.region || 'Hunt Direta',
            biome: source?.biome || (creature.type || 'Caçada Direta'),
            description: `Caçada focada em ${creature.name || creatureId}. Loop contínuo com essa criatura como alvo principal.`,
            minLevel: Number(creature.level || creature.recommendedLevel || source?.minLevel || 1),
            maxLevel: Number(creature.level || creature.recommendedLevel || source?.maxLevel || source?.minLevel || 1),
            danger: Number(source?.danger || Math.max(1, Math.ceil(Number(creature.level || source?.minLevel || 1) / 20))),
            icon: source?.icon || '✦',
            position: source?.position || { x: 50, y: 50 },
            rewards: Array.isArray(source?.rewards) ? [...source.rewards] : ['Loot focado', 'XP direta'],
            enemies: [{ id: creatureId, weight: 100 }],
            encounterChance: 0.82,
            mode: 'hunt'
        };
        return Hunt.hunts[huntId];
    }

    function getSpecializedHunts() {
        return Object.values(Hunt.hunts || {})
            .filter((definition) => definition?.id && definition.mode === "specialized")
            .sort((a, b) => Number(a.minLevel || 1) - Number(b.minLevel || 1));
    }

    function getHuntAtlasView() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        return Aethra.GameState.ui.huntAtlasView === "creatures" ? "creatures" : "focus";
    }

    function renderHuntAtlasToggle(activeView) {
        return `
            <div class="hunt-atlas-submode" role="tablist" aria-label="Tipo de Hunt">
                <button type="button" class="${activeView === "focus" ? "is-active" : ""}" data-hunt-atlas-view="focus" role="tab" aria-selected="${activeView === "focus"}">Por foco</button>
                <button type="button" class="${activeView === "creatures" ? "is-active" : ""}" data-hunt-atlas-view="creatures" role="tab" aria-selected="${activeView === "creatures"}">Por criatura</button>
            </div>
        `;
    }

    function formatFocusMultiplier(value, suffix = "x") {
        const number = Number(value ?? 1);
        return `${number.toFixed(number % 1 === 0 ? 0 : 2)}${suffix}`;
    }

    function getFocusEventNames(definition) {
        const labels = {
            chest: "Baús", locked_chest: "Baús trancados", secret_door: "Portas secretas",
            trap: "Armadilhas", mining: "Veios de minério", forge: "Forjas",
            herb: "Ervas", trail: "Trilhas", shrine: "Altares", camp: "Acampamentos"
        };
        return Object.entries(definition?.modifiers?.eventWeights || {})
            .filter(([, weight]) => Number(weight) > 1)
            .sort((a, b) => Number(b[1]) - Number(a[1]))
            .slice(0, 4)
            .map(([eventId]) => labels[eventId] || eventId);
    }

    function renderSpecializedHunts(root, selectedId, heroLevel, activeId) {
        const definitions = getSpecializedHunts();
        const selected = definitions.find((entry) => entry.id === (selectedId || Aethra.GameState.ui?.selectedFocusHunt)) || definitions[0] || null;
        if (selected) Aethra.GameState.ui.selectedFocusHunt = selected.id;
        const locked = selected ? heroLevel < Number(selected.minLevel || 1) : false;
        const focusSkill = selected?.focus?.skill ? Aethra.ProfessionSystem?.getState?.(selected.focus.skill) : null;
        const modifiers = selected?.modifiers || {};
        const professionEntries = Object.entries(modifiers.professionXp || {})
            .filter(([, multiplier]) => Number(multiplier) > 0)
            .sort((a, b) => Number(b[1]) - Number(a[1]));
        const eventNames = getFocusEventNames(selected);

        root.innerHTML = `
            ${renderHuntAtlasToggle("focus")}
            <div class="hunt-world-map-toolbar hunt-world-map-toolbar--hunts">
                <div>
                    <span class="hunt-world-map-level">Herói NV. ${heroLevel}</span>
                    <strong>${definitions.filter((entry) => heroLevel >= Number(entry.minLevel || 1)).length} de ${definitions.length} Hunts especializadas liberadas</strong>
                </div>
                <p>Escolha o que deseja evoluir. Cada bioma altera eventos, economia e XP para que as ações da Hunt determinem a progressão.</p>
            </div>
            <div class="hunt-specialized-layout">
                <section class="hunt-focus-catalog" aria-label="Hunts especializadas por foco">
                    ${definitions.map((definition) => {
                        const isLocked = heroLevel < Number(definition.minLevel || 1);
                        const isSelected = definition.id === selected?.id;
                        const primarySkill = definition.focus?.skill ? Aethra.ProfessionSystem?.getState?.(definition.focus.skill) : null;
                        return `
                            <button type="button" class="hunt-focus-card ${isLocked ? "is-locked" : "is-unlocked"} ${isSelected ? "is-selected" : ""}" data-focus-hunt-select="${escapeHTML(definition.id)}">
                                <span class="hunt-focus-card__icon">${escapeHTML(definition.focus?.icon || definition.icon || "⌖")}</span>
                                <div>
                                    <small>${escapeHTML(definition.biome || "Bioma")}</small>
                                    <strong>${escapeHTML(definition.name)}</strong>
                                    <p>${escapeHTML(definition.focus?.name || "Progressão especializada")}</p>
                                </div>
                                <aside><b>NV. ${Number(definition.minLevel || 1)}</b>${primarySkill ? `<small>Skill ${Number(primarySkill.level || 1)}</small>` : ""}</aside>
                            </button>
                        `;
                    }).join("")}
                </section>
                <aside class="hunt-focus-detail ${locked ? "is-locked" : "is-unlocked"}">
                    ${selected ? `
                        <header>
                            <span>${escapeHTML(selected.focus?.icon || selected.icon || "⌖")}</span>
                            <div><small>FOCO PRINCIPAL</small><h3>${escapeHTML(selected.name)}</h3><p>${escapeHTML(selected.focus?.name || selected.biome || "Hunt especializada")}</p></div>
                            <b>NV. ${Number(selected.minLevel || 1)}</b>
                        </header>
                        <p class="hunt-focus-detail__description">${escapeHTML(selected.description || "Hunt especializada.")}</p>
                        <div class="hunt-focus-modifiers">
                            <article class="${Number(modifiers.combatXp ?? 1) >= 1 ? "is-positive" : "is-negative"}"><small>XP do herói</small><strong>${formatFocusMultiplier(modifiers.combatXp ?? 1)}</strong><span>somente por abates</span></article>
                            <article class="${Number(modifiers.gold ?? 1) >= 1 ? "is-positive" : "is-negative"}"><small>Gold</small><strong>${formatFocusMultiplier(modifiers.gold ?? 1)}</strong><span>economia da Hunt</span></article>
                            <article class="${Number(modifiers.materialChance ?? 1) >= 1 ? "is-positive" : "is-negative"}"><small>Materiais</small><strong>${formatFocusMultiplier(modifiers.materialChance ?? 1)}</strong><span>chance de drop</span></article>
                            <article class="${Number(modifiers.eventChance ?? 1) >= 1 ? "is-positive" : "is-negative"}"><small>Eventos</small><strong>${formatFocusMultiplier(modifiers.eventChance ?? 1)}</strong><span>frequência no bioma</span></article>
                        </div>
                        <section class="hunt-focus-skill-matrix">
                            <header><small>MATRIZ DE PROGRESSÃO</small><strong>XP isolado por ação</strong></header>
                            <div>
                                ${professionEntries.length ? professionEntries.map(([professionId, multiplier]) => {
                                    const profession = Aethra.ProfessionSystem?.getState?.(professionId) || Aethra.ProfessionSystem?.professions?.[professionId] || { name: professionId, icon: "•", level: 1 };
                                    return `<span class="${Number(multiplier) >= 1 ? "is-boosted" : "is-reduced"}"><i>${escapeHTML(profession.icon || "•")}</i><b>${escapeHTML(profession.name || professionId)}</b><em>${formatFocusMultiplier(multiplier)}</em></span>`;
                                }).join("") : `<span><i>⚔</i><b>Combate</b><em>${formatFocusMultiplier(modifiers.combatSkillXp ?? 1)}</em></span>`}
                            </div>
                        </section>
                        <section class="hunt-focus-events">
                            <header><small>EVENTOS FAVORECIDOS</small><strong>${eventNames.length ? eventNames.join(" · ") : "Combates contínuos"}</strong></header>
                            <p>${selected.focus?.id === "thievery" ? `Baús, portas e armadilhas exigem teste de Ladinagem. Nível atual: ${Number(focusSkill?.level || Aethra.ProfessionSystem?.getState?.("thievery")?.level || 1)}.` : "Apenas a ação correspondente concede XP para cada skill."}</p>
                        </section>
                        <div class="hunt-world-map-detail__enemies"><small>Criaturas do bioma</small><div>${(selected.enemies || []).slice(0, 7).map((entry) => { const id = typeof entry === "string" ? entry : entry.id; return `<span>${escapeHTML(Aethra.GameData?.creatures?.[id]?.name || id)}</span>`; }).join("")}</div></div>
                        <button type="button" class="hunt-world-map-start" data-specialized-hunt-start="${escapeHTML(selected.id)}" ${locked ? "disabled" : ""}>${locked ? `Bloqueada até o nível ${Number(selected.minLevel || 1)}` : activeId === selected.id ? "Retomar Hunt especializada" : "Iniciar Hunt especializada"}</button>
                    ` : `<div class="hunt-world-map-detail__empty"><strong>Nenhuma Hunt especializada</strong></div>`}
                </aside>
            </div>
        `;

        root.querySelectorAll("[data-hunt-atlas-view]").forEach((button) => {
            button.addEventListener("click", () => {
                Aethra.GameState.ui.huntAtlasView = button.dataset.huntAtlasView;
                renderWorldMap(null, "hunts");
            });
        });
        root.querySelectorAll("[data-focus-hunt-select]").forEach((button) => {
            button.addEventListener("click", () => renderWorldMap(button.dataset.focusHuntSelect, "hunts"));
        });
        root.querySelector("[data-specialized-hunt-start]")?.addEventListener("click", (event) => {
            const huntId = event.currentTarget.dataset.specializedHuntStart;
            const current = Aethra.GameState.hunt || {};
            Aethra.UIManager?.setPrimaryView?.("hunt", { source: "specialized-hunt" });
            if (current.isActive && current.huntId !== huntId) Hunt.stopHunt?.("specialized-hunt-switch");
            const started = current.isActive && current.huntId === huntId
                ? true
                : Hunt.startHunt?.(huntId, { mode: "specialized" });
            if (!started) return renderWorldMap(huntId, "hunts");
            WorldWindows?.closeWindow?.("hunt-world-map-view", { source: "specialized-hunt-start" });
            Render.renderBattleCards?.();
            Render.renderExplorationFeed?.();
            Render.renderHunt?.();
        });
        return true;
    }

    function bindWorldMapModeControls(mode, selectedId) {
        document.querySelectorAll('[data-world-map-mode]').forEach((button) => {
            const active = button.dataset.worldMapMode === mode;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
            button.onclick = () => renderWorldMap(null, button.dataset.worldMapMode);
        });
        const title = document.getElementById('hunt-world-map-heading-title');
        const kicker = document.getElementById('hunt-world-map-heading-kicker');
        if (title) title.textContent = mode === 'hunts' ? 'Atlas de Hunts' : 'Mapa Mundi de Expedições';
        if (kicker) kicker.textContent = mode === 'hunts' ? 'Criaturas, níveis e loot focado' : 'Rotas, níveis e recompensas';
    }

    function renderWorldMap(selectedId = null, requestedMode = null) {
        ensureWorldMapWindow();
        const root = document.getElementById("hunt-world-map-content");
        if (!root) return false;

        const heroLevel = getHeroLevel();
        const definitions = Object.values(Hunt.hunts)
            .filter((definition) => definition?.id && definition.mode !== 'specialized' && !String(definition.id).startsWith('targeted__'))
            .sort((a, b) => Number(a.minLevel || 1) - Number(b.minLevel || 1));
        const unlocked = definitions.filter((definition) => heroLevel >= Number(definition.minLevel || 1));

        Aethra.GameState.ui = Aethra.GameState.ui || {};
        const mode = requestedMode || Aethra.GameState.ui.worldMapMode || 'expeditions';
        Aethra.GameState.ui.worldMapMode = mode;
        bindWorldMapModeControls(mode, selectedId);
        const activeId = Aethra.GameState.hunt?.isActive ? Aethra.GameState.hunt?.huntId : null;

        if (mode === 'hunts') {
            const atlasView = getHuntAtlasView();
            if (atlasView === 'focus') {
                return renderSpecializedHunts(root, selectedId, heroLevel, activeId);
            }
            const creatures = buildCreatureCatalog();
            const filters = loadHuntFilters();
            const filteredCreatures = filterCreatureCatalog(creatures, heroLevel, filters);
            const selectedCreature = filteredCreatures.find((entry) => entry.id === (selectedId || Aethra.GameState.ui?.selectedHuntCreature)) || filteredCreatures[0] || null;
            if (selectedCreature) Aethra.GameState.ui.selectedHuntCreature = selectedCreature.id;
            const selectedCreatureData = selectedCreature ? (Aethra.GameData?.creatures?.[selectedCreature.id] || {}) : {};
            const creatureLocked = selectedCreature ? heroLevel < Number(selectedCreature.level || 1) : false;
            const sourceHuntsHtml = (selectedCreature?.hunts || []).slice(0, 8).map((huntInfo) => `<span>${escapeHTML(huntInfo.name)} · NV. ${Number(huntInfo.minLevel || 1)}</span>`).join('');
            const lootPreview = selectedCreature ? getCreatureLootPreview(selectedCreatureData) : [];
            const types = Array.from(new Set(creatures.map((entry) => entry.type).filter(Boolean))).sort((a,b) => String(a).localeCompare(String(b)));
            const biomes = Array.from(new Set(creatures.flatMap((entry) => (entry.hunts || []).map((hunt) => hunt.biome)).filter(Boolean))).sort((a,b) => String(a).localeCompare(String(b)));
            const unlockedCount = creatures.filter((entry) => heroLevel >= Number(entry.level || 1)).length;

            root.innerHTML = `
                ${renderHuntAtlasToggle("creatures")}
                <div class="hunt-world-map-toolbar hunt-world-map-toolbar--hunts">
                    <div>
                        <span class="hunt-world-map-level">Herói NV. ${heroLevel}</span>
                        <strong>${unlockedCount} de ${creatures.length} criaturas liberadas</strong>
                    </div>
                    <p>Hunts são caçadas focadas em uma criatura específica. Use busca e filtros para encontrar o alvo e conferir o loot real antes de iniciar.</p>
                </div>
                <div class="hunt-catalog-filters" data-hunt-catalog-filters>
                    <label class="hunt-catalog-search">
                        <span>Buscar criatura</span>
                        <input type="search" value="${escapeHTML(filters.search)}" placeholder="Nome, tipo, bioma ou região" data-hunt-filter="search" autocomplete="off">
                    </label>
                    <label><span>Tipo</span><select data-hunt-filter="type"><option value="all">Todos</option>${types.map((type) => `<option value="${escapeHTML(type)}" ${filters.type === type ? 'selected' : ''}>${escapeHTML(type)}</option>`).join('')}</select></label>
                    <label><span>Bioma</span><select data-hunt-filter="biome"><option value="all">Todos</option>${biomes.map((biome) => `<option value="${escapeHTML(biome)}" ${filters.biome === biome ? 'selected' : ''}>${escapeHTML(biome)}</option>`).join('')}</select></label>
                    <label><span>Acesso</span><select data-hunt-filter="access"><option value="all" ${filters.access === 'all' ? 'selected' : ''}>Todas</option><option value="unlocked" ${filters.access === 'unlocked' ? 'selected' : ''}>Liberadas</option><option value="locked" ${filters.access === 'locked' ? 'selected' : ''}>Bloqueadas</option></select></label>
                    <label><span>Ordenar</span><select data-hunt-filter="sort"><option value="level" ${filters.sort === 'level' ? 'selected' : ''}>Nível</option><option value="name" ${filters.sort === 'name' ? 'selected' : ''}>Nome</option><option value="type" ${filters.sort === 'type' ? 'selected' : ''}>Tipo</option></select></label>
                    <button type="button" class="hunt-catalog-reset" data-hunt-filter-reset>Limpar</button>
                    <output>${filteredCreatures.length} resultado(s)</output>
                </div>
                <div class="hunt-world-map-layout hunt-world-map-layout--hunts">
                    <section class="hunt-creature-catalog" aria-label="Catálogo de criaturas">
                        ${filteredCreatures.length ? filteredCreatures.map((entry) => {
                            const locked = heroLevel < Number(entry.level || 1);
                            const selected = entry.id === selectedCreature?.id;
                            const primaryBiome = entry.hunts?.[0]?.biome || 'Mundo aberto';
                            return `<button type="button" class="hunt-creature-card ${locked ? 'is-locked' : 'is-unlocked'} ${selected ? 'is-selected' : ''}" data-hunt-creature-select="${escapeHTML(entry.id)}"><div><b>${escapeHTML(entry.name)}</b><small>${escapeHTML(entry.type || 'Criatura')} · ${escapeHTML(primaryBiome)}</small></div><span>NV. ${Number(entry.level || 1)}</span></button>`;
                        }).join('') : `<div class="hunt-creature-empty"><span>⌕</span><strong>Nenhuma criatura encontrada</strong><small>Ajuste a busca ou limpe os filtros para ver o catálogo completo.</small></div>`}
                    </section>
                    <aside class="hunt-world-map-detail ${creatureLocked ? 'is-locked' : 'is-unlocked'} hunt-world-map-detail--creature">
                        ${selectedCreature ? `
                        <header>
                            <span>✦</span>
                            <div>
                                <small>HUNT FOCADA</small>
                                <h3>${escapeHTML(selectedCreature.name)}</h3>
                                <p>${escapeHTML(selectedCreature.type || 'Criatura')}</p>
                            </div>
                            <b>NV. ${Number(selectedCreature.level || 1)}</b>
                        </header>
                        <div class="hunt-creature-combat-kpis">
                            <span><small>HP</small><b>${formatNumber(selectedCreatureData.maxHp || selectedCreatureData.hp)}</b></span>
                            <span><small>DANO</small><b>${formatNumber(selectedCreatureData.damageMin)}–${formatNumber(selectedCreatureData.damageMax || selectedCreatureData.damage)}</b></span>
                            <span><small>XP</small><b>${formatNumber(selectedCreatureData.xp)}</b></span>
                            <span><small>RANK</small><b>${escapeHTML(selectedCreatureData.rank || 'normal')}</b></span>
                        </div>
                        <p class="hunt-world-map-detail__description">${escapeHTML(selectedCreatureData.description || `Caçada direta contra ${selectedCreature.name}. Ideal para farmar materiais específicos, testar builds e otimizar a rota de drop.`)}</p>
                        <section class="hunt-loot-preview">
                            <header><div><small>DROP TABLE REAL</small><strong>Possíveis recompensas</strong></div><span>${lootPreview.length} itens base</span></header>
                            <div class="hunt-loot-preview__list">
                                ${lootPreview.length ? lootPreview.map((drop) => {
                                    const chance = drop.guaranteed ? `Garantido` : drop.chance >= 0.1 ? `${Math.round(drop.chance * 100)}%` : `${(drop.chance * 100).toFixed(2)}%`;
                                    const quantity = drop.max > drop.min ? `${drop.min}–${drop.max}` : `${drop.min}`;
                                    return `<article class="hunt-loot-preview__item is-${rarityClass(drop.rarity)}"><span class="hunt-loot-preview__icon">${escapeHTML(drop.icon)}</span><div><b>${escapeHTML(drop.name)}</b><small>${escapeHTML(drop.rarity)} · valor ${formatNumber(drop.value)}</small></div><em>${chance}</em><strong>x${quantity}</strong></article>`;
                                }).join('') : `<div class="hunt-loot-preview__empty">A criatura usa o perfil de loot global e ainda não possui material base cadastrado.</div>`}
                                <article class="hunt-loot-preview__item is-special"><span class="hunt-loot-preview__icon">✦</span><div><b>Equipamento com IV</b><small>Raridade, multiplicador e atributos individuais</small></div><em>RNG raro</em><strong>Único</strong></article>
                            </div>
                        </section>
                        <div class="hunt-world-map-detail__enemies"><small>Encontrada em</small><div>${sourceHuntsHtml || '<span>Catálogo global</span>'}</div></div>
                        <div class="hunt-world-map-detail__rewards"><small>Tags</small><div>${Array.from(selectedCreature.tags || []).slice(0,8).map((tag) => `<span>${escapeHTML(tag)}</span>`).join('')}</div></div>
                        <button type="button" class="hunt-world-map-start" data-world-hunt-creature-start="${escapeHTML(selectedCreature.id)}" ${creatureLocked ? 'disabled' : ''}>${creatureLocked ? `Bloqueada até o nível ${Number(selectedCreature.level || 1)}` : 'Iniciar Hunt focada'}</button>
                        <small class="hunt-world-map-lock-message">A Hunt foca em uma criatura por vez. Use Expedições para conteúdo de dungeon solo ou em grupo, com múltiplos monstros e eventos.</small>
                        ` : '<div class="hunt-world-map-detail__empty"><strong>Sem alvo selecionado</strong><p>Escolha uma criatura no catálogo para ver atributos e drops.</p></div>'}
                    </aside>
                </div>
            `;

            root.querySelectorAll("[data-hunt-atlas-view]").forEach((button) => {
                button.addEventListener("click", () => {
                    Aethra.GameState.ui.huntAtlasView = button.dataset.huntAtlasView;
                    renderWorldMap(null, "hunts");
                });
            });

            const rerenderFilters = (patch, focusSearch = false) => {
                const nextFilters = saveHuntFilters(patch);
                renderWorldMap(null, 'hunts');
                if (focusSearch) {
                    window.setTimeout(() => {
                        const input = document.querySelector('[data-hunt-filter="search"]');
                        input?.focus();
                        input?.setSelectionRange?.(nextFilters.search.length, nextFilters.search.length);
                    }, 0);
                }
            };

            let searchTimer = null;
            root.querySelector('[data-hunt-filter="search"]')?.addEventListener('input', (event) => {
                window.clearTimeout(searchTimer);
                const value = event.currentTarget.value;
                searchTimer = window.setTimeout(() => rerenderFilters({ search: value }, true), 140);
            });
            ['type', 'biome', 'access', 'sort'].forEach((filterId) => {
                root.querySelector(`[data-hunt-filter="${filterId}"]`)?.addEventListener('change', (event) => {
                    rerenderFilters({ [filterId]: event.currentTarget.value });
                });
            });
            root.querySelector('[data-hunt-filter-reset]')?.addEventListener('click', () => {
                saveHuntFilters({ search: '', type: 'all', biome: 'all', access: 'all', sort: 'level' });
                renderWorldMap(null, 'hunts');
            });
            root.querySelectorAll('[data-hunt-creature-select]').forEach((button) => {
                button.addEventListener('click', () => renderWorldMap(button.dataset.huntCreatureSelect, 'hunts'));
            });
            root.querySelector('[data-world-hunt-creature-start]')?.addEventListener('click', (event) => {
                const creatureId = event.currentTarget.dataset.worldHuntCreatureStart;
                const definition = ensureTargetedCreatureHunt(creatureId);
                if (!definition) return;
                Aethra.UIManager?.setPrimaryView?.('hunt', { source: 'world-map-hunt' });
                if (Aethra.GameState.hunt?.isActive && Aethra.GameState.hunt?.huntId !== definition.id) {
                    Hunt.stopHunt?.('world-map-hunt-switch');
                }
                const started = Aethra.GameState.hunt?.isActive && Aethra.GameState.hunt?.huntId === definition.id ? true : Hunt.startHunt?.(definition.id, { mode: 'hunt', targetCreatureId: creatureId });
                if (!started) return renderWorldMap(creatureId, 'hunts');
                WorldWindows?.closeWindow?.('hunt-world-map-view', { source: 'world-map-hunt-start' });
                Render.renderBattleCards?.(); Render.renderExplorationFeed?.(); Render.renderHunt?.();
            });
            return true;
        }

        const selected = getHuntDefinition(
            selectedId ||
            Aethra.GameState.ui?.selectedWorldHunt ||
            Aethra.GameState.hunt?.huntId ||
            unlocked[0]?.id ||
            definitions[0]?.id
        );
        const isSelectedLocked = heroLevel < Number(selected.minLevel || 1);
        Aethra.GameState.ui.selectedWorldHunt = selected.id;
        const nodes = definitions.map((definition) => {
            const locked = heroLevel < Number(definition.minLevel || 1);
            const active = activeId === definition.id;
            const selectedNode = selected.id === definition.id;
            const expeditionTags = getExpeditionTags(definition);
            return `
                <button
                    type="button"
                    class="world-map-node ${locked ? "is-locked" : "is-unlocked"} ${active ? "is-active" : ""} ${selectedNode ? "is-selected" : ""}"
                    style="--node-x:${Number(definition.position?.x || 50)}%;--node-y:${Number(definition.position?.y || 50)}%;"
                    data-world-hunt-select="${escapeHTML(definition.id)}"
                    aria-label="${escapeHTML(definition.name)}${locked ? `, bloqueada até o nível ${definition.minLevel}` : ", disponível"}"
                >
                    <span class="world-map-node__icon">${locked ? "⌾" : escapeHTML(definition.icon || "⌖")}</span>
                    <span class="world-map-node__copy">
                        <b>${escapeHTML(definition.name)}</b>
                        <small>NV. ${Number(definition.minLevel || 1)}${active ? " · ATIVA" : ""}</small>
                        <em>${escapeHTML(expeditionTags.slice(-1)[0] || 'SOLO')}</em>
                    </span>
                </button>
            `;
        }).join("");

        const dangers = Array.from({ length: 6 }, (_, index) => `<i class="${index < Number(selected.danger || 1) ? "is-filled" : ""}"></i>`).join("");
        const selectedExpeditionTags = getExpeditionTags(selected);
        const selectedRecommendedMode = getExpeditionRecommendedMode(selected);

        root.innerHTML = `
            <div class="hunt-world-map-toolbar">
                <div>
                    <span class="hunt-world-map-level">Herói NV. ${heroLevel}</span>
                    <strong>${unlocked.length} de ${definitions.length} expedições liberadas</strong>
                </div>
                <p>Expedições são rotas amplas com múltiplos monstros, eventos e espaço para a futura mecânica de dungeon solo ou em grupo.</p>
            </div>
            <div class="hunt-world-map-layout">
                <section class="hunt-world-map-board" aria-label="Mapa das regiões de Aethra">
                    <div class="hunt-world-map-board__terrain" aria-hidden="true">
                        <span class="terrain-island terrain-island--west"></span>
                        <span class="terrain-island terrain-island--north"></span>
                        <span class="terrain-island terrain-island--east"></span>
                        <span class="terrain-island terrain-island--south"></span>
                        <span class="terrain-route terrain-route--one"></span>
                        <span class="terrain-route terrain-route--two"></span>
                        <span class="terrain-route terrain-route--three"></span>
                    </div>
                    ${nodes}
                    <div class="hunt-world-map-compass" aria-hidden="true"><b>N</b><span>✦</span></div>
                </section>
                <aside class="hunt-world-map-detail ${isSelectedLocked ? "is-locked" : "is-unlocked"}">
                    <header>
                        <span>${escapeHTML(selected.icon || "⌖")}</span>
                        <div>
                            <small>${escapeHTML(selected.region || "Região")}</small>
                            <h3>${escapeHTML(selected.name)}</h3>
                            <p>${escapeHTML(selected.biome || "Área de expedição")}</p>
                        </div>
                        <b>NV. ${Number(selected.minLevel || 1)}</b>
                    </header>
                    <div class="hunt-world-map-detail__danger"><span>Perigo</span><div>${dangers}</div></div>
                    <p class="hunt-world-map-detail__description">${escapeHTML(selected.description || "Expedição disponível.")}</p>
                    <div class="hunt-world-map-detail__rewards"><small>Principais recompensas</small><div>${(selected.rewards || []).map((reward) => `<span>${escapeHTML(reward)}</span>`).join("")}</div></div>
                    <div class="hunt-world-map-detail__enemies"><small>Criaturas conhecidas</small><div>${(selected.enemies || []).map((entry) => {
                        const creature = Aethra.GameData?.creatures?.[typeof entry === 'string' ? entry : entry.id];
                        return `<span>${escapeHTML(creature?.name || (typeof entry === 'string' ? entry : entry.id))}</span>`;
                    }).join("")}</div></div>
                    <div class="expedition-format-panel">
                        <div><small>FORMATO RECOMENDADO</small><strong>${escapeHTML(selectedRecommendedMode)}</strong></div>
                        <div class="expedition-format-tags">${selectedExpeditionTags.map((tag) => `<span class="is-${normalizedSearch(tag)}">${escapeHTML(tag)}</span>`).join('')}</div>
                    </div>
                    <div class="hunt-world-map-detail__rewards"><small>Estrutura da Expedição</small><div><span>Exploração contínua</span><span>Múltiplas criaturas</span><span>Eventos e objetivos</span><span>Dungeon solo/time</span></div></div>
                    <button type="button" class="hunt-world-map-start" data-world-hunt-start="${escapeHTML(selected.id)}" ${isSelectedLocked ? "disabled" : ""}>${isSelectedLocked ? `Bloqueada até o nível ${Number(selected.minLevel || 1)}` : activeId === selected.id ? "Retomar expedição" : "Entrar na expedição"}</button>
                    ${isSelectedLocked ? `<small class="hunt-world-map-lock-message">Faltam ${Math.max(0, Number(selected.minLevel || 1) - heroLevel)} nível(is) para liberar esta expedição.</small>` : `<small class="hunt-world-map-lock-message">Expedições serão a base para o conteúdo de dungeon, com suporte futuro a solo ou grupo.</small>`}
                </aside>
            </div>
        `;
        root.querySelectorAll('[data-world-hunt-select]').forEach((button) => {
            button.addEventListener('click', () => renderWorldMap(button.dataset.worldHuntSelect, 'expeditions'));
        });
        root.querySelector('[data-world-hunt-start]')?.addEventListener('click', (event) => {
            const huntId = event.currentTarget.dataset.worldHuntStart;
            const current = Aethra.GameState.hunt || {};
            Aethra.UIManager?.setPrimaryView?.('hunt', { source: 'world-map' });
            if (current.isActive && current.huntId !== huntId) {
                Hunt.stopHunt?.('world-map-route-change');
            }
            const started = current.isActive && current.huntId === huntId ? true : Hunt.startHunt?.(huntId, { mode: 'expedition' });
            if (!started) {
                renderWorldMap(huntId, 'expeditions');
                return;
            }
            WorldWindows?.closeWindow?.('hunt-world-map-view', { source: 'world-map-start' });
            Render.renderBattleCards?.(); Render.renderExplorationFeed?.(); Render.renderHunt?.();
        });
        return true;
    }

    function openWorldMap(options = {}) {
        ensureWorldMapWindow();
        renderWorldMap(options.huntId || options.creatureId || null, options.mode || null);
        const width = Math.min(1040, Math.max(760, window.innerWidth - 120));
        const height = Math.min(720, Math.max(560, window.innerHeight - 120));
        return WorldWindows?.openWindow?.("hunt-world-map-view", {
            source: options.source || "hunt-navigation",
            position: {
                left: Math.max(20, (window.innerWidth - width) / 2),
                top: Math.max(72, (window.innerHeight - height) / 2)
            }
        });
    }

    Aethra.openHuntWorldMap = openWorldMap;
    Aethra.renderHuntWorldMap = renderWorldMap;

    const originalBuildCombatInspect = Render.buildCombatInspectHTML.bind(Render);
    Render.buildCombatInspectHTML = function () {
        return "";
    };

    function ensureCombatInspectWindow() {
        let windowElement = document.getElementById("combat-inspect-view");
        if (!windowElement) {
            windowElement = document.createElement("section");
            windowElement.id = "combat-inspect-view";
            windowElement.className = "game-window hidden combat-inspect-window";
            windowElement.dataset.aethraWindow = "combat-inspect-view";
            windowElement.dataset.windowSize = "medium";
            windowElement.setAttribute("aria-hidden", "true");
            windowElement.innerHTML = `
                <header class="window-header combat-inspect-window__header">
                    <div>
                        <small>Ficha de combate</small>
                        <h2>Inspect</h2>
                    </div>
                    <button type="button" class="window-close" data-close-window="combat-inspect-view" aria-label="Fechar Inspect">×</button>
                </header>
                <div id="combat-inspect-window-content" class="combat-inspect-window__content"></div>
            `;
            document.body.appendChild(windowElement);
        }
        WorldWindows?.registerWindow?.("combat-inspect-view", windowElement);
        return windowElement;
    }

    function getCurrentCombatant(side) {
        if (side === "hero") return Aethra.GameState.hero || null;
        const battle = Aethra.GameState.battle || {};
        const combat = Aethra.GameState.combat || {};
        const hunt = Aethra.GameState.hunt || {};
        return (battle.isFighting ? battle.creature : null) ||
            (combat.isActive ? combat.enemy : null) ||
            hunt.currentEnemy ||
            null;
    }

    function openCombatInspect(side = "hero") {
        const combatant = getCurrentCombatant(side);
        if (!combatant) return false;
        ensureCombatInspectWindow();
        const content = document.getElementById("combat-inspect-window-content");
        const title = document.querySelector("#combat-inspect-view .window-header h2");
        if (!content) return false;

        if (title) {
            title.textContent = side === "hero"
                ? "Ficha da Build"
                : `Análise: ${combatant.name || "Inimigo"}`;
        }

        content.innerHTML = originalBuildCombatInspect(combatant, side);
        content.querySelector("[data-combat-inspect-close]")?.addEventListener("click", () => {
            WorldWindows?.closeWindow?.("combat-inspect-view", {
                source: "inspect-inner-close"
            });
        });

        const width = Math.min(720, Math.max(560, window.innerWidth * 0.48));
        const height = Math.min(620, Math.max(460, window.innerHeight * 0.7));
        WorldWindows?.openWindow?.("combat-inspect-view", {
            source: `combat-inspect-${side}`,
            position: {
                left: Math.max(20, (window.innerWidth - width) / 2),
                top: Math.max(76, (window.innerHeight - height) / 2)
            }
        });
        return true;
    }

    Aethra.openCombatInspect = openCombatInspect;
    Render.bindCombatInspect = function (card) {
        const button = card?.querySelector("[data-combat-inspect-toggle]");
        if (!button) return false;
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openCombatInspect(card.id === "battle-enemy-card" ? "enemy" : "hero");
        });
        return true;
    };

    const LOOT_VIEW_DEFAULTS = {
        activeTab: "stackables",
        specialFilter: "all",
        sortMode: "value"
    };

    function ensureLootSessionState() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        const current = Aethra.GameState.ui.lootSession || {};
        current.stackables = current.stackables && typeof current.stackables === "object"
            ? current.stackables
            : {};
        current.specials = Array.isArray(current.specials)
            ? current.specials
            : [];
        current.seenSpecialIds = current.seenSpecialIds && typeof current.seenSpecialIds === "object"
            ? current.seenSpecialIds
            : {};
        current.activeTab = ["stackables", "specials"].includes(current.activeTab)
            ? current.activeTab
            : LOOT_VIEW_DEFAULTS.activeTab;
        current.specialFilter = ["all", "equipment", "rare"].includes(current.specialFilter)
            ? current.specialFilter
            : LOOT_VIEW_DEFAULTS.specialFilter;
        current.sortMode = ["value", "quantity", "recent"].includes(current.sortMode)
            ? current.sortMode
            : LOOT_VIEW_DEFAULTS.sortMode;
        Aethra.GameState.ui.lootSession = current;
        return current;
    }

    function resetLootSession() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.lootSession = {
            stackables: {},
            specials: [],
            seenSpecialIds: {},
            ...LOOT_VIEW_DEFAULTS
        };
        // Remove o formato antigo para não reaparecer após carregar um save legado.
        Aethra.GameState.ui.dropLog = [];
        renderDropLog();
    }

    function normalizeLootKey(value) {
        return String(value || "loot")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "") || "loot";
    }

    function itemTemplate(item = {}) {
        const id = item.templateId || item.id;
        return id && Aethra.GameData?.items?.[id]
            ? Aethra.GameData.items[id]
            : (id && Aethra.ItemTemplates?.[id] ? Aethra.ItemTemplates[id] : {});
    }

    function itemType(item = {}) {
        const template = itemTemplate(item);
        return String(
            item.itemType || item.type || template.itemType || template.type || "misc"
        ).toLowerCase();
    }

    function itemSlot(item = {}) {
        const template = itemTemplate(item);
        return item.slot || item.equipmentSlot || template.slot || template.equipmentSlot || null;
    }

    function itemUnitValue(item = {}) {
        return Math.max(0, Number(
            item.price ?? item.value ?? item.basePrice ?? itemTemplate(item).price ?? 0
        ));
    }

    function isEquipmentLike(item = {}) {
        const type = itemType(item);
        return Boolean(
            itemSlot(item) ||
            ["weapon", "armor", "equipment", "equip", "helmet", "chest", "legs", "boots", "shield", "accessory"].includes(type)
        );
    }

    function hasIndividualRolls(item = {}) {
        if (item.iv || item.rollScore !== undefined) return true;
        if (Number(item.statMultiplier ?? item.multiplier ?? 1) !== 1) return true;
        if (Object.keys(item.baseRolls || {}).length) return true;
        if (Object.keys(item.individualMultipliers || {}).length) return true;
        if (Array.isArray(item.affixes) && item.affixes.length) return true;
        return false;
    }

    function isSpecialDrop(item = {}) {
        const template = itemTemplate(item);
        if (item.stackable === true || template.stackable === true) return false;
        return isEquipmentLike(item) || hasIndividualRolls(item);
    }

    function statLabel(stat) {
        const labels = {
            damageMin: "Dano mínimo",
            damageMax: "Dano máximo",
            defense: "Defesa",
            str: "Força",
            mag: "Magia",
            precision: "Precisão",
            critical: "Crítico",
            evasion: "Esquiva",
            blockChance: "Bloqueio",
            blockReduction: "Redução de bloqueio",
            hpMax: "Vida máxima",
            manaMax: "Mana máxima"
        };
        return labels[stat] || String(stat || "Atributo");
    }

    function rarityRank(rarityId) {
        return {
            common: 1,
            uncommon: 2,
            rare: 3,
            epic: 4,
            legendary: 5,
            mythic: 6
        }[String(rarityId || "common").toLowerCase()] || 1;
    }

    function createSpecialDrop(item = {}, context = {}) {
        const presentation = itemPresentation(item);
        const inspection = Aethra.ItemSystem?.getItemInspection?.(item) || null;
        const strongest = inspection?.strongestAttribute || null;
        const instanceId = item.instanceId || `special_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const rarityName = inspection?.rarity?.name || item.rarity || "Comum";
        const rarityId = inspection?.rarity?.id || presentation.tone || "common";
        const primaryStat = strongest
            ? `${strongest.final >= 0 ? "+" : ""}${formatNumber(strongest.final)} ${statLabel(strongest.stat)}`
            : (itemSlot(item) ? `Slot: ${String(itemSlot(item)).replaceAll("_", " ")}` : "Roll individualizado");

        return {
            id: instanceId,
            instanceId,
            createdAt: Date.now(),
            image: presentation.image,
            icon: item.icon || "◆",
            color: inspection?.rarity?.color || presentation.color,
            tone: rarityId,
            rarityId,
            rarityName,
            rarityRank: rarityRank(rarityId),
            name: presentation.name,
            category: isEquipmentLike(item) ? "equipment" : "unique",
            ivPercent: Number(inspection?.ivPercent ?? item.iv?.percent ?? item.rollScore ?? item.quality ?? 0),
            ivTier: inspection?.tier || item.iv?.tier || "Roll",
            multiplier: Number(inspection?.multiplier ?? item.statMultiplier ?? item.multiplier ?? 1),
            primaryStat,
            value: itemUnitValue(item),
            source: context.source || item.origin?.source || "drop",
            enemyName: context.enemyName || "",
            detail: context.detail || "",
            item: {
                instanceId: item.instanceId,
                templateId: item.templateId || item.id,
                slot: itemSlot(item),
                stats: item.stats || {},
                affixes: item.affixes || []
            }
        };
    }

    function registerSpecialDrop(item = {}, context = {}) {
        const state = ensureLootSessionState();
        const entry = createSpecialDrop(item, context);
        if (state.seenSpecialIds[entry.instanceId]) return false;
        state.seenSpecialIds[entry.instanceId] = true;
        state.specials.unshift(entry);
        state.specials = state.specials.slice(0, 100);
        renderDropLog();
        return true;
    }

    function registerStackable(item = {}, context = {}) {
        const state = ensureLootSessionState();
        const presentation = itemPresentation(item);
        const quantity = Math.max(1, Number(context.quantity ?? item.quantity ?? 1));
        const unitValue = Math.max(0, Number(context.unitValue ?? itemUnitValue(item)));
        const key = context.key || `item:${normalizeLootKey(item.templateId || item.id || presentation.name)}`;
        const current = state.stackables[key] || {
            key,
            image: presentation.image,
            icon: item.icon || context.icon || "◆",
            color: context.color || presentation.color,
            tone: context.tone || presentation.tone,
            category: context.category || itemType(item) || "loot",
            name: context.name || presentation.name,
            quantity: 0,
            totalValue: 0,
            dropCount: 0,
            firstDropAt: Date.now(),
            lastDropAt: Date.now(),
            lastSource: ""
        };
        current.quantity += quantity;
        current.totalValue += Math.max(0, Number(context.totalValue ?? unitValue * quantity));
        current.dropCount += 1;
        current.lastDropAt = Date.now();
        current.lastSource = context.source || "drop";
        current.image = current.image || presentation.image;
        state.stackables[key] = current;
        renderDropLog();
        return current;
    }

    function registerGold(amount, context = {}) {
        const quantity = Math.max(0, Number(amount || 0));
        if (!quantity) return false;
        return registerStackable({
            id: "gold",
            templateId: "gold",
            name: "Gold",
            icon: "●",
            rarity: "Comum",
            stackable: true,
            price: 1,
            quantity
        }, {
            key: "currency:gold",
            name: "Gold",
            category: "moeda",
            icon: "●",
            color: "#e8c76d",
            tone: "gold",
            quantity,
            unitValue: 1,
            source: context.source || "hunt"
        });
    }

    // Compatibilidade com patches antigos. Entradas genéricas viram stackables.
    function dropEntries() {
        const state = ensureLootSessionState();
        return Object.values(state.stackables);
    }

    function pushDrop(entry = {}) {
        return registerStackable({
            id: entry.id || entry.title,
            name: entry.title || "Recompensa",
            icon: entry.icon || "◆",
            rarity: entry.category || "Comum",
            stackable: true,
            quantity: Number(entry.quantity || 1),
            price: Number(entry.unitValue || entry.value || 0)
        }, {
            key: entry.key || `legacy:${normalizeLootKey(entry.title)}`,
            name: entry.title || "Recompensa",
            category: entry.category || "loot",
            icon: entry.icon || "◆",
            color: entry.color,
            tone: entry.tone,
            quantity: Number(entry.quantity || 1),
            totalValue: Number(entry.totalValue || entry.value || 0),
            source: entry.detail || "drop"
        });
    }

    function progressionEntries() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.progressionLog = Array.isArray(Aethra.GameState.ui.progressionLog)
            ? Aethra.GameState.ui.progressionLog
            : [];
        return Aethra.GameState.ui.progressionLog;
    }

    function resetProgressionLog() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.progressionLog = [];
        renderProgressionLog();
    }

    function pushProgression(entry) {
        const list = progressionEntries();
        const now = Date.now();
        const normalized = {
            id: entry.id || `progress_${now}_${Math.random().toString(36).slice(2, 7)}`,
            createdAt: now,
            icon: "✦",
            tone: "xp",
            kind: "skill-xp",
            title: "Progressão recebida",
            detail: "",
            amount: 0,
            mergeKey: null,
            ...entry
        };

        const latest = list[0];
        const canMerge = normalized.mergeKey && latest?.mergeKey === normalized.mergeKey &&
            now - Number(latest.createdAt || 0) < 12000 &&
            latest.kind === normalized.kind;

        if (canMerge) {
            latest.amount = Number(latest.amount || 0) + Number(normalized.amount || 0);
            latest.createdAt = now;
            latest.title = normalized.titleBuilder
                ? normalized.titleBuilder(latest.amount)
                : normalized.title;
            latest.detail = normalized.detail;
        } else {
            delete normalized.titleBuilder;
            list.unshift(normalized);
        }

        Aethra.GameState.ui.progressionLog = list.slice(0, 60);
        renderProgressionLog();
    }

    function progressionTotals(list = progressionEntries()) {
        return list.reduce((totals, entry) => {
            const amount = Math.max(0, Number(entry.amount || 0));
            if (entry.kind === "hero-xp") totals.heroXp += amount;
            if (entry.kind === "skill-xp" || entry.kind === "profession-xp") totals.skillXp += amount;
            if (entry.kind === "hero-level" || entry.kind === "skill-level" || entry.kind === "profession-level") {
                totals.levelUps += Math.max(1, Number(entry.levels || 1));
            }
            return totals;
        }, { heroXp: 0, skillXp: 0, levelUps: 0 });
    }

    function ensureProgressionPanel() {
        const sidebar = document.querySelector(".battle-sidebar--combat");
        const huntPanel = sidebar?.querySelector(".battle-panel--hunt");
        if (!sidebar || !huntPanel) return false;

        let panel = sidebar.querySelector(".battle-panel--progression");
        if (!panel) {
            panel = document.createElement("section");
            panel.className = "battle-panel battle-panel--progression";
            panel.innerHTML = `
                <header class="battle-panel__header">
                    <div>
                        <small>XP, níveis e maestrias</small>
                        <h2>Progressão</h2>
                    </div>
                    <button type="button" class="hud-help" aria-label="Entender Progressão" data-ui-tooltip data-tooltip-kind="hud" data-tooltip-eyebrow="EVOLUÇÃO DA EXPEDIÇÃO" data-tooltip-title="Progressão" data-tooltip-body="Registra separadamente XP do herói, XP das habilidades e níveis conquistados. Nenhum destes eventos aparece no painel de Drops." data-tooltip-hint="Abra Skills no menu superior para consultar níveis e benefícios permanentes.">?</button>
                </header>
                <div id="progression-log-display" class="progression-log-display"></div>
            `;
            sidebar.insertBefore(panel, huntPanel);
        }
        renderProgressionLog();
        return true;
    }

    function renderProgressionLog() {
        const root = document.getElementById("progression-log-display");
        if (!root) return false;
        const list = progressionEntries();
        const totals = progressionTotals(list);
        const recent = list.slice(0, 4);

        root.innerHTML = `
            <div class="progression-log-summary">
                <span><small>XP herói</small><strong>${formatNumber(totals.heroXp)}</strong></span>
                <span><small>XP skills</small><strong>${formatNumber(totals.skillXp)}</strong></span>
                <span><small>Levels</small><strong>${formatNumber(totals.levelUps)}</strong></span>
            </div>
            <div class="progression-log-list">
                ${recent.length ? recent.map((entry) => `
                    <article class="progression-log-entry is-${escapeHTML(entry.tone || "xp")}">
                        <span>${escapeHTML(entry.icon || "✦")}</span>
                        <div>
                            <strong>${escapeHTML(entry.title)}</strong>
                            <small>${escapeHTML(entry.detail || "")}</small>
                        </div>
                        <time>${new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                    </article>
                `).join("") : `
                    <div class="progression-log-empty">
                        <span>✦</span>
                        <p>XP, níveis e maestrias da Hunt aparecerão aqui.</p>
                    </div>
                `}
            </div>
        `;
        return true;
    }

    function ensureCombatLogWindow() {
        let windowElement = document.getElementById("combat-log-view");
        if (!windowElement) {
            windowElement = document.createElement("section");
            windowElement.id = "combat-log-view";
            windowElement.className = "game-window hidden combat-log-window";
            windowElement.dataset.aethraWindow = "combat-log-view";
            windowElement.dataset.windowSize = "medium";
            windowElement.setAttribute("aria-hidden", "true");
            windowElement.innerHTML = `
                <header class="window-header">
                    <div>
                        <small>Telemetria matemática</small>
                        <h2>Log de Combate</h2>
                    </div>
                    <button type="button" class="window-close" data-close-window="combat-log-view" aria-label="Fechar Log de Combate">×</button>
                </header>
                <div id="combat-log-window-body" class="combat-log-window__body"></div>
            `;
            document.body.appendChild(windowElement);
        }
        WorldWindows?.registerWindow?.("combat-log-view", windowElement);
        return windowElement;
    }

    function ensureDropPanel() {
        const panel = document.querySelector(".battle-panel--log");
        if (!panel) return false;
        ensureCombatLogWindow();

        const worldCombatDisplay = panel.querySelector("#combat-display");
        const combatBody = document.getElementById("combat-log-window-body");
        if (worldCombatDisplay && combatBody) {
            combatBody.replaceChildren(worldCombatDisplay);
        }

        const header = panel.querySelector(".battle-panel__header");
        if (header) {
            header.innerHTML = `
                <div>
                    <small>Acumulados e itens individualizados</small>
                    <h2>Loot da Expedição</h2>
                </div>
                <div class="battle-panel__tools">
                    <span class="battle-live-dot">LIVE</span>
                    <button type="button" class="drop-log-combat-button" data-open-window="combat-log-view" title="Abrir Log de Combate">⚔ Log</button>
                    <button type="button" class="hud-help" aria-label="Entender Drops da Expedição" data-ui-tooltip data-tooltip-kind="hud" data-tooltip-eyebrow="RECOMPENSAS EM TEMPO REAL" data-tooltip-title="Loot da Expedição" data-tooltip-body="Materiais, Gold e consumíveis são somados por tipo. Equipamentos e itens com IV ficam em um histórico individual com raridade, multiplicador e atributos próprios.">?</button>
                </div>
            `;
        }

        let root = panel.querySelector("#drop-log-display");
        if (!root) {
            root = document.createElement("div");
            root.id = "drop-log-display";
            root.className = "drop-log-display";
            panel.appendChild(root);
        }
        ensureProgressionPanel();
        renderDropLog();
        return true;
    }

    function itemPresentation(item = {}) {
        const rarity = Aethra.GameData?.getRarityPresentation?.(item) || {};
        const image = Aethra.GameData?.getItemImage?.(item) || "";
        const rarityId = String(rarity.id || item.rarityId || item.rarity || "common").toLowerCase();
        return {
            image,
            color: rarity.color || "#9cb0b8",
            tone: rarityId,
            name: item.name || item.templateId || item.id || "Item"
        };
    }

    function lootSessionTotals(state = ensureLootSessionState()) {
        const stackables = Object.values(state.stackables || {});
        const specials = state.specials || [];
        const stackValue = stackables.reduce((sum, entry) => sum + Number(entry.totalValue || 0), 0);
        const specialValue = specials.reduce((sum, entry) => sum + Number(entry.value || 0), 0);
        return {
            stackTypes: stackables.length,
            totalUnits: stackables.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0),
            stackValue,
            specialValue,
            sessionValue: stackValue + specialValue,
            specialCount: specials.length,
            bestIV: specials.reduce((best, entry) => Math.max(best, Number(entry.ivPercent || 0)), 0)
        };
    }

    function sortedStackables(state) {
        const entries = Object.values(state.stackables || {});
        const mode = state.sortMode || "value";
        return entries.sort((a, b) => {
            if (mode === "quantity") return Number(b.quantity || 0) - Number(a.quantity || 0);
            if (mode === "recent") return Number(b.lastDropAt || 0) - Number(a.lastDropAt || 0);
            return Number(b.totalValue || 0) - Number(a.totalValue || 0);
        });
    }

    function filteredSpecials(state) {
        return (state.specials || []).filter((entry) => {
            if (state.specialFilter === "equipment") return entry.category === "equipment";
            if (state.specialFilter === "rare") return Number(entry.rarityRank || 1) >= 3;
            return true;
        });
    }

    function specialTooltipAttributes(entry) {
        const detail = [
            `${entry.rarityName} · ${entry.ivTier}`,
            `IV ${Number(entry.ivPercent || 0).toFixed(1)}%`,
            `Multiplicador ${Number(entry.multiplier || 1).toFixed(2)}x`,
            entry.primaryStat,
            entry.value > 0 ? `Valor estimado ${formatNumber(entry.value)}` : ""
        ].filter(Boolean).join(" | ");
        return `
            data-ui-tooltip
            data-tooltip-kind="item"
            data-tooltip-eyebrow="DROP INDIVIDUAL"
            data-tooltip-title="${escapeHTML(entry.name)}"
            data-tooltip-body="${escapeHTML(detail)}"
            data-tooltip-value="${escapeHTML(entry.primaryStat || "Roll individualizado")}"
            data-tooltip-hint="Cada equipamento mantém IV, multiplicador e atributos próprios. Passe pela mochila para equipar ou comparar."
        `;
    }

    function renderStackableLoot(state, totals) {
        const list = sortedStackables(state);
        if (!list.length) {
            return `
                <div class="drop-log-empty drop-log-empty--compact">
                    <span>◇</span>
                    <strong>Nenhum loot acumulado</strong>
                    <small>Gold, materiais, recursos e consumíveis serão agrupados automaticamente.</small>
                </div>
            `;
        }

        return `
            <div class="session-loot-toolbar">
                <div>
                    <small>TIPOS</small><strong>${formatNumber(totals.stackTypes)}</strong>
                </div>
                <div>
                    <small>UNIDADES</small><strong>${formatNumber(totals.totalUnits)}</strong>
                </div>
                <div>
                    <small>VALOR TOTAL</small><strong>${formatNumber(totals.stackValue)}</strong>
                </div>
                <label>
                    <span>Ordenar</span>
                    <select data-loot-sort aria-label="Ordenar loot acumulado">
                        <option value="value" ${state.sortMode === "value" ? "selected" : ""}>Valor</option>
                        <option value="quantity" ${state.sortMode === "quantity" ? "selected" : ""}>Quantidade</option>
                        <option value="recent" ${state.sortMode === "recent" ? "selected" : ""}>Recente</option>
                    </select>
                </label>
            </div>
            <div class="session-loot-list">
                ${list.map((entry) => `
                    <article class="session-loot-row is-${escapeHTML(entry.tone || "common")}" style="--drop-color:${escapeHTML(entry.color || "#82b7ca")};">
                        <span class="session-loot-row__icon" data-drop-fallback="${escapeHTML(entry.icon || "◆")}">
                            ${entry.image
                                ? `<img src="${escapeHTML(entry.image)}" alt="" draggable="false">`
                                : escapeHTML(entry.icon || "◆")}
                        </span>
                        <div class="session-loot-row__copy">
                            <strong>${escapeHTML(entry.name)}</strong>
                            <small>${formatNumber(entry.dropCount)} coleta${Number(entry.dropCount || 0) === 1 ? "" : "s"} · último ${new Date(entry.lastDropAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>
                        </div>
                        <b class="session-loot-row__quantity">×${formatNumber(entry.quantity)}</b>
                        <strong class="session-loot-row__value">${entry.totalValue > 0 ? `${formatNumber(entry.totalValue)} G` : "—"}</strong>
                    </article>
                `).join("")}
            </div>
        `;
    }

    function renderSpecialLoot(state, totals) {
        const list = filteredSpecials(state);
        if (!list.length) {
            return `
                <div class="special-drop-toolbar">
                    <div class="special-drop-filters" role="group" aria-label="Filtrar itens especiais">
                        ${[
                            ["all", "Todos"],
                            ["equipment", "Equipamentos"],
                            ["rare", "Raro+"]
                        ].map(([id, label]) => `<button type="button" class="${state.specialFilter === id ? "is-active" : ""}" data-special-drop-filter="${id}">${label}</button>`).join("")}
                    </div>
                </div>
                <div class="drop-log-empty drop-log-empty--compact">
                    <span>✦</span>
                    <strong>Nenhum item individual encontrado</strong>
                    <small>Armas, armaduras e itens com IV aparecerão aqui como registros únicos.</small>
                </div>
            `;
        }

        return `
            <div class="special-drop-toolbar">
                <div class="special-drop-filters" role="group" aria-label="Filtrar itens especiais">
                    ${[
                        ["all", "Todos"],
                        ["equipment", "Equipamentos"],
                        ["rare", "Raro+"]
                    ].map(([id, label]) => `<button type="button" class="${state.specialFilter === id ? "is-active" : ""}" data-special-drop-filter="${id}">${label}</button>`).join("")}
                </div>
                <div class="special-drop-summary">
                    <span><small>ITENS</small><strong>${formatNumber(totals.specialCount)}</strong></span>
                    <span><small>MELHOR IV</small><strong>${totals.bestIV ? `${totals.bestIV.toFixed(0)}%` : "—"}</strong></span>
                    <button type="button" class="special-drop-clear" data-clear-special-drops title="Limpar apenas o histórico visual; os itens continuam na mochila.">Limpar</button>
                </div>
            </div>
            <div class="special-drop-list">
                ${list.map((entry) => `
                    <article class="special-drop-row is-${escapeHTML(entry.rarityId || "common")}" style="--drop-color:${escapeHTML(entry.color || "#9cb0b8")};" ${specialTooltipAttributes(entry)}>
                        <span class="special-drop-row__icon" data-drop-fallback="${escapeHTML(entry.icon || "◆")}">
                            ${entry.image
                                ? `<img src="${escapeHTML(entry.image)}" alt="" draggable="false">`
                                : escapeHTML(entry.icon || "◆")}
                        </span>
                        <div class="special-drop-row__identity">
                            <strong>${escapeHTML(entry.name)}</strong>
                            <small>${escapeHTML(entry.rarityName)} · <b>IV ${Number(entry.ivPercent || 0).toFixed(0)}%</b></small>
                        </div>
                        <div class="special-drop-row__roll">
                            <strong>${Number(entry.multiplier || 1).toFixed(2)}x</strong>
                            <small>${escapeHTML(entry.primaryStat || entry.ivTier || "Roll")}</small>
                        </div>
                        <time>${new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                    </article>
                `).join("")}
            </div>
        `;
    }

    function renderDropLog() {
        const root = document.getElementById("drop-log-display");
        if (!root) return false;
        const state = ensureLootSessionState();
        const totals = lootSessionTotals(state);

        root.innerHTML = `
            <div class="loot-session-tabs" role="tablist" aria-label="Visualização dos drops">
                <button type="button" role="tab" aria-selected="${state.activeTab === "stackables"}" class="${state.activeTab === "stackables" ? "is-active" : ""}" data-loot-session-tab="stackables">
                    <span>▦</span>
                    <b>Acumulados</b>
                    <em>${formatNumber(totals.totalUnits)}</em>
                </button>
                <button type="button" role="tab" aria-selected="${state.activeTab === "specials"}" class="${state.activeTab === "specials" ? "is-active" : ""}" data-loot-session-tab="specials">
                    <span>✦</span>
                    <b>Itens com IV</b>
                    <em>${formatNumber(totals.specialCount)}</em>
                </button>
            </div>
            <div class="loot-session-view is-${escapeHTML(state.activeTab)}">
                ${state.activeTab === "specials"
                    ? renderSpecialLoot(state, totals)
                    : renderStackableLoot(state, totals)}
            </div>
        `;

        root.querySelectorAll("img").forEach((image) => {
            image.addEventListener("error", () => {
                const holder = image.parentElement;
                const fallback = holder?.dataset.dropFallback || "◆";
                image.remove();
                if (holder && !holder.textContent.trim()) holder.textContent = fallback;
            }, { once: true });
        });

        Aethra.TooltipManager?.refresh?.(root);
        return true;
    }

    const originalRenderBattleCards = Render.renderBattleCards.bind(Render);
    Render.renderBattleCards = function (...args) {
        const result = originalRenderBattleCards(...args);
        const huntActive = Boolean(Aethra.GameState.hunt?.isActive || Hunt.config?.isRunning);
        const launcher = document.querySelector("#battle-enemy-card .hunt-launcher");
        const launcherButton = launcher?.querySelector("[data-start-hunt]");

        if (launcherButton && !huntActive) {
            launcherButton.removeAttribute("data-start-hunt");
            launcherButton.dataset.openHuntMap = "";
            launcherButton.textContent = "Escolher Hunt no Mapa Mundi";
            launcherButton.classList.add("hunt-launcher__world-map");
            const label = launcher.querySelector("label");
            if (label) label.textContent = "Expedição";
            const select = launcher.querySelector("select");
            if (select) select.hidden = true;
        }

        ensureDropPanel();
        return result;
    };

    const originalActivateBattleMode = Render.activateBattleMode.bind(Render);
    Render.activateBattleMode = function (...args) {
        const result = originalActivateBattleMode(...args);
        ensureDropPanel();
        ensureHeroInspectShortcut();
        return result;
    };

    const originalRenderAll = Render.renderAll.bind(Render);
    Render.renderAll = function (...args) {
        const result = originalRenderAll(...args);
        ensureDropPanel();
        ensureHeroInspectShortcut();
        renderDropLog();
        return result;
    };

    const originalExplorationFeed = Render.renderExplorationFeed?.bind(Render);
    if (originalExplorationFeed) {
        Render.renderExplorationFeed = function (...args) {
            const result = originalExplorationFeed(...args);
            const huntActive = Boolean(Aethra.GameState.hunt?.isActive || Hunt.config?.isRunning);
            if (!huntActive) {
                const focus = document.querySelector("#exploration-feed .journey-focus");
                if (focus) {
                    focus.className = "journey-focus is-world-map-cta";
                    focus.innerHTML = `
                        <span class="journey-focus__icon">⌖</span>
                        <div class="journey-focus__copy">
                            <small>PRÓXIMA EXPEDIÇÃO</small>
                            <strong>Escolha uma rota no Mapa Mundi</strong>
                            <p>Veja Hunts disponíveis, bloqueios por nível, ameaças e recompensas antes de partir.</p>
                        </div>
                        <button type="button" data-open-hunt-map>Abrir Mapa</button>
                    `;
                }
                const empty = document.querySelector("#exploration-feed .journey-stream__empty");
                if (empty) {
                    empty.innerHTML = "A jornada começa no <b>Mapa Mundi</b>. Selecione uma região para iniciar a expedição.";
                }
            }
            return result;
        };
    }

    function ensureHeroInspectShortcut() {
        const overview = document.querySelector('[data-hero-panel-view="overview"] .hero-hub__accordion-heading');
        if (!overview || overview.querySelector("[data-open-hero-inspect]")) return false;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "hero-hub__inspect-shortcut";
        button.dataset.openHeroInspect = "";
        button.textContent = "Ficha";
        button.title = "Abrir ficha detalhada da build";
        overview.appendChild(button);
        return true;
    }

    function improveActionBarDragHandles() {
        const bar = document.getElementById("skill-action-bar");
        if (!bar) return false;
        bar.querySelectorAll(".battle-action-slot.is-filled").forEach((slot) => {
            const handle = slot.querySelector(".battle-action-slot__drag-handle");
            if (!handle) return;
            handle.draggable = true;
            slot.draggable = false;
            handle.setAttribute("role", "button");
            handle.setAttribute("aria-label", "Arrastar habilidade para trocar de posição");
            handle.tabIndex = 0;

            handle.ondragstart = (event) => {
                const index = Number(slot.dataset.slotIndex);
                event.stopPropagation();
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/x-aethra-skill-slot", String(index));
                event.dataTransfer.setData("text/plain", String(index));
                slot.classList.add("is-dragging");
                bar.classList.add("is-reordering");
            };
            handle.ondragend = () => {
                slot.classList.remove("is-dragging");
                bar.classList.remove("is-reordering");
                bar.querySelectorAll(".is-drag-target").forEach((node) => node.classList.remove("is-drag-target"));
            };
        });
        return true;
    }

    const originalRenderActionBar = Render.renderActionBar.bind(Render);
    Render.renderActionBar = function (...args) {
        const result = originalRenderActionBar(...args);
        improveActionBarDragHandles();
        return result;
    };

    document.addEventListener("click", (event) => {
        const tab = event.target.closest("[data-loot-session-tab]");
        if (tab) {
            const state = ensureLootSessionState();
            state.activeTab = tab.dataset.lootSessionTab === "specials" ? "specials" : "stackables";
            renderDropLog();
            return;
        }

        const filter = event.target.closest("[data-special-drop-filter]");
        if (filter) {
            const state = ensureLootSessionState();
            state.specialFilter = ["all", "equipment", "rare"].includes(filter.dataset.specialDropFilter)
                ? filter.dataset.specialDropFilter
                : "all";
            renderDropLog();
            return;
        }

        const clearSpecials = event.target.closest("[data-clear-special-drops]");
        if (clearSpecials) {
            const state = ensureLootSessionState();
            state.specials = [];
            state.seenSpecialIds = {};
            renderDropLog();
        }
    });

    document.addEventListener("change", (event) => {
        const sort = event.target.closest("[data-loot-sort]");
        if (!sort) return;
        const state = ensureLootSessionState();
        state.sortMode = ["value", "quantity", "recent"].includes(sort.value)
            ? sort.value
            : "value";
        renderDropLog();
    });

    document.addEventListener("click", (event) => {
        const topHunt = event.target.closest(".topbar [data-primary-view='hunt']");
        if (topHunt) {
            event.preventDefault();
            event.stopImmediatePropagation();
            Aethra.UIManager?.setPrimaryView?.("hunt", { source: "topbar-world-map" });
            openWorldMap({ source: "topbar-hunt" });
            return;
        }

        const mapButton = event.target.closest("[data-open-hunt-map]");
        if (mapButton) {
            event.preventDefault();
            event.stopPropagation();
            openWorldMap({ source: "world-map-button" });
            return;
        }

        const heroInspect = event.target.closest("[data-open-hero-inspect]");
        if (heroInspect) {
            event.preventDefault();
            event.stopPropagation();
            openCombatInspect("hero");
        }
    }, true);

    Aethra.EventBus.on("hunt:started", () => {
        resetLootSession();
        resetProgressionLog();
    });

    Aethra.EventBus.on("hunt:loot-generated", (payload = {}) => {
        const enemyName = Aethra.GameData?.creatures?.[payload.enemyId]?.name || payload.enemyId || "Criatura";
        (payload.items || []).forEach((item) => {
            if (isSpecialDrop(item)) {
                registerSpecialDrop(item, {
                    source: "creature",
                    enemyName,
                    detail: `Drop de ${enemyName}`
                });
                return;
            }

            registerStackable(item, {
                source: `drop:${enemyName}`,
                category: itemType(item),
                quantity: Number(item.quantity || 1),
                unitValue: itemUnitValue(item)
            });
        });
    });

    Aethra.EventBus.on("hunt:enemy-defeated", (payload = {}) => {
        registerGold(payload.gold, {
            source: payload.name || payload.enemy?.name || "criatura"
        });
    });

    Aethra.EventBus.on("exploration:resource-collected", (payload = {}) => {
        const item = payload.item || {};
        if (!item.name && !item.templateId && !item.id) return;
        if (isSpecialDrop(item)) {
            registerSpecialDrop(item, {
                source: payload.source || "exploration",
                detail: payload.title || "Recurso individual encontrado"
            });
            return;
        }
        registerStackable(item, {
            source: payload.title || payload.source || "exploration",
            category: itemType(item) || "resource",
            quantity: Number(item.quantity || 1),
            unitValue: itemUnitValue(item)
        });
    });

    Aethra.EventBus.on("exploration:event-resolved", (event = {}) => {
        (event.rewards?.items || []).forEach((item) => {
            if (isSpecialDrop(item)) {
                registerSpecialDrop(item, {
                    source: `event:${event.id || "exploration"}`,
                    detail: event.title || "Evento de exploração"
                });
                return;
            }
            registerStackable(item, {
                source: event.title || "evento de exploração",
                category: itemType(item) || "resource",
                quantity: Number(item.quantity || 1),
                unitValue: itemUnitValue(item)
            });
        });
        registerGold(event.rewards?.gold, {
            source: event.title || "evento de exploração"
        });
    });

    Aethra.EventBus.on("exploration:rare-encounter-resolved", (event = {}) => {
        (event.rewards?.items || []).forEach((item) => {
            if (isSpecialDrop(item)) {
                registerSpecialDrop(item, {
                    source: "encontro-raro",
                    enemyName: event.enemyName || "",
                    detail: event.specialItem
                        ? `Jackpot encontrado após ${event.enemyName || "uma criatura"}`
                        : "Item individual de encontro raro"
                });
                return;
            }

            registerStackable(item, {
                source: `encontro raro: ${event.enemyName || "expedição"}`,
                category: itemType(item) || "resource",
                quantity: Number(item.quantity || 1),
                unitValue: itemUnitValue(item),
                color: "#9f7aea",
                tone: "rare"
            });
        });

        registerGold(event.rewards?.gold, {
            source: `encontro raro: ${event.enemyName || "expedição"}`
        });
    });

    Aethra.EventBus.on("xpChanged", (payload = {}) => {
        const amount = Math.max(0, Number(payload.amount || 0));
        if (!amount) return;
        pushProgression({
            icon: "✦",
            tone: "hero",
            kind: "hero-xp",
            amount,
            mergeKey: "hero-xp",
            title: `+${formatNumber(amount)} XP do herói`,
            titleBuilder: (total) => `+${formatNumber(total)} XP do herói`,
            detail: payload.source ? `Fonte: ${String(payload.source).replaceAll("_", " ")}` : "Experiência da expedição"
        });
    });

    Aethra.EventBus.on("levelUp", (payload = {}) => {
        pushProgression({
            icon: "↑",
            tone: "level",
            kind: "hero-level",
            level: Number(payload.level || 1),
            title: `Herói alcançou o nível ${formatNumber(payload.level || 1)}`,
            detail: "Vida máxima e atributos de marco foram atualizados."
        });
    });

    Aethra.EventBus.on("skill:progression-changed", (payload = {}) => {
        const amount = Math.max(0, Number(payload.gain || 0));
        if (!amount) return;
        const name = payload.skill?.name || payload.skillId || "Habilidade";
        pushProgression({
            icon: payload.skill?.icon || "✧",
            tone: "skill",
            kind: "skill-xp",
            amount,
            mergeKey: `skill:${payload.skillId || name}`,
            title: `${name}: +${formatNumber(amount)} XP`,
            titleBuilder: (total) => `${name}: +${formatNumber(total)} XP`,
            detail: `Nível ${formatNumber(payload.progression?.level || 1)} · ${formatNumber(payload.progression?.xpCurrent || 0)} / ${formatNumber(payload.progression?.xpNext || 0)} XP`
        });
    });

    Aethra.EventBus.on("skill:level-up", (payload = {}) => {
        const name = payload.skill?.name || payload.skillId || "Habilidade";
        pushProgression({
            icon: "↑",
            tone: "level",
            kind: "skill-level",
            levels: Math.max(1, Number(payload.levelsGained || 1)),
            title: `${name} alcançou o nível ${formatNumber(payload.progression?.level || 1)}`,
            detail: `Potência atual ${Number((payload.progression?.powerMultiplier || Aethra.SkillSystem?.getSkillPowerMultiplier?.(payload.skillId) || 1) * 100 - 100).toFixed(1)}% acima da base.`
        });
    });

    Aethra.EventBus.on("profession:xpChanged", (payload = {}) => {
        const amount = Math.max(0, Number(payload.amount || 0));
        if (!amount) return;
        const name = payload.definition?.name || payload.professionId || "Profissão";
        pushProgression({
            icon: payload.definition?.icon || "◆",
            tone: "profession",
            kind: "profession-xp",
            amount,
            mergeKey: `profession:${payload.professionId || name}`,
            title: `${name}: +${formatNumber(amount)} XP`,
            titleBuilder: (total) => `${name}: +${formatNumber(total)} XP`,
            detail: `Nível ${formatNumber(payload.state?.level || 1)} · ${formatNumber(payload.state?.xp || 0)} / ${formatNumber(payload.state?.xpNext || 0)} XP`
        });
    });

    Aethra.EventBus.on("profession:rankUp", (payload = {}) => {
        const profession = payload.definition || Aethra.ProfessionSystem?.professions?.[payload.professionId];
        pushProgression({
            icon: "↑",
            tone: "level",
            kind: "profession-level",
            title: `${profession?.name || payload.professionId || "Skill"} alcançou o nível ${formatNumber(payload.level || 1)}`,
            detail: profession?.nextBenefit || "Novo benefício de progressão desbloqueado."
        });
    });

    [
        "EngineReady",
        "render:battle-mode-ready",
        "render:ready",
        "hunt:updated",
        "inventory:changed",
        "equipment:changed"
    ].forEach((eventName) => {
        Aethra.EventBus.on(eventName, () => {
            ensureDropPanel();
            ensureProgressionPanel();
            renderProgressionLog();
            ensureHeroInspectShortcut();
            improveActionBarDragHandles();
        });
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            ensureWorldMapWindow();
            ensureCombatInspectWindow();
            ensureCombatLogWindow();
            ensureDropPanel();
            ensureProgressionPanel();
            renderProgressionLog();
            ensureHeroInspectShortcut();
        }, { once: true });
    } else {
        ensureWorldMapWindow();
        ensureCombatInspectWindow();
        ensureCombatLogWindow();
        ensureDropPanel();
        ensureProgressionPanel();
        renderProgressionLog();
        ensureHeroInspectShortcut();
    }
})(window.Aethra);
