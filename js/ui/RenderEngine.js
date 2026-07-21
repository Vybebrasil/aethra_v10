// RenderEngine.js - A camada visual central da Aethra Engine
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus) {
        throw new Error(
            "RenderEngine.js requer game-core.js carregado antes deste arquivo."
        );
    }

    const DEFAULT_SELECTORS = {
        heroStats: "#stats-display",
        heroAttributes: "#hero-attributes-grid",
        heroSkills: "#hero-skill-progression",
        inventory: "#inventory-grid",
        equipment: "#equipment-grid",
        quests: "#quests-list",
        hunt: "#hunt-display",
        combat: "#combat-display",
        actionBar: "#skill-action-bar",
        primaryAttacks: "#primary-attack-bar",
        battleInventory: "#battle-inventory-grid",
        battleEquipment: "#battle-equipment-summary",
        battleHeroCard: "#battle-hero-card",
        battleEnemyCard: "#battle-enemy-card",
        cityHero: "#hero-sprite",
        bossList: "#boss-list",
        professions: "#professions-grid",
        engineStatus: "#engine-status"
    };

    function clone(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatNumber(value) {
        const number = Number(value || 0);
        return new Intl.NumberFormat("pt-BR").format(number);
    }

    function formatDuration(totalSeconds) {
        const seconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainder = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${String(minutes).padStart(2, "0")}m`;
        }

        if (minutes > 0) {
            return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
        }

        return `${remainder}s`;
    }

    function percent(value) {
        const number = Number(value || 0);
        return `${Math.round(number * 100)}%`;
    }

    function precisePercent(value) {
        const numeric = Number(value || 0) * 100;
        return `${numeric.toFixed(numeric % 1 === 0 ? 0 : 1)}%`;
    }

    function statLabel(stat) {
        const labels = {
            damage: "Dano",
            damageMin: "Dano mín.",
            damageMax: "Dano máx.",
            defense: "Defesa",
            str: "Força",
            mag: "Magia",
            precision: "Precisão",
            critical: "Crítico",
            evasion: "Esquiva",
            blockChance: "Bloqueio",
            blockReduction: "Redução de bloqueio",
            maxHp: "HP máximo",
            maxMana: "Mana máxima",
            hpMax: "HP máximo",
            manaMax: "Mana máxima"
        };

        return labels[stat] || stat;
    }

    function safeColor(value, fallback = "") {
        const color = String(value || "").trim();

        return /^#[0-9a-f]{6}$/i.test(color)
            ? color
            : fallback;
    }

    function getElement(selector) {
        if (!selector) return null;

        if (selector instanceof Element) {
            return selector;
        }

        return document.querySelector(selector);
    }

    function resolveSpritePath(entity, fallback = null) {
        const raw =
            entity?.sprite_url ||
            entity?.spriteUrl ||
            entity?.sprite ||
            entity?.image ||
            fallback;

        if (!raw) return null;

        const path = String(raw).trim();

        if (
            /^(?:https?:)?\/\//i.test(path) ||
            path.startsWith("data:") ||
            path.startsWith("blob:") ||
            path.startsWith("/") ||
            path.includes("/")
        ) {
            return path;
        }

        return `assets/entities/${path}`;
    }

    function getSkillCost(skill) {
        const cost = skill?.cost || {};
        const resource = String(
            cost.resource || cost.type || "mana"
        ).toLowerCase();
        const amount = Math.max(
            0,
            Number(
                skill?.manaCost ??
                cost.amount ??
                cost.value ??
                0
            ) || 0
        );

        return { resource, amount };
    }

    function getSkillCooldownMs(skill) {
        const raw = Math.max(0, Number(skill?.cooldown || 0));
        return raw <= 60 ? raw * 1000 : raw;
    }

    function getHeroLevel(hero) {
        return Number(hero.level || hero.currentLevel || 1);
    }

    function getHeroXP(hero) {
        return {
            current: Number(hero.xpCurrent || hero.xp || 0),
            total: Number(hero.xpTotal || 0),
            next: Number(hero.xpNext || 100)
        };
    }

    function normalizeQuestState() {
        const quests = Aethra.GameState.quests || {};

        return {
            active: Array.isArray(quests.active)
                ? quests.active
                : Array.isArray(Aethra.QuestSystem?.activeQuests)
                    ? Aethra.QuestSystem.activeQuests
                    : [],
            completed: Array.isArray(quests.completed)
                ? quests.completed
                : []
        };
    }

    Aethra.RenderEngine = {
        selectors: { ...DEFAULT_SELECTORS },
        initialized: false,
        battleMode: "cards",
        viewMode: "battle-cards",
        eventBindings: [],
        pendingRenders: new Map(),
        renderFrame: null,
        cooldownAnimationFrame: null,

        init(options = {}) {
            if (this.initialized) {
                this.renderSelectedBattleMode();
                return;
            }

            if (options.selectors && typeof options.selectors === "object") {
                this.selectors = {
                    ...this.selectors,
                    ...options.selectors
                };
            }

            this.injectStyles();
            Aethra.TooltipManager?.init?.();
            this.bindEvents();
            this.renderSelectedBattleMode();

            this.initialized = true;

            console.log("RenderEngine pronta para atualizar a UI.");

            Aethra.EventBus.emit("render:ready", {
                selectors: clone(this.selectors),
                battleMode: this.battleMode,
                viewMode: this.viewMode
            });
        },

        bindEvents() {
            const bind = (eventName, callback) => {
                Aethra.EventBus.on(eventName, callback);
                this.eventBindings.push({ eventName, callback });
            };

            // Estado do herói.
            [
                "statsChanged",
                "xpChanged",
                "levelUp",
                "goldChanged",
                "resourceChanged",
                "manaChanged",
                "energyChanged",
                "hero:changed"
            ].forEach((eventName) => {
                bind(eventName, () => {
                    this.schedule("heroStats", () => this.renderHeroStats());
                });
            });

            // Progressão das habilidades.
            [
                "skills:ready",
                "SkillUsed",
                "skill:used",
                "skillXPChanged",
                "skill:xp-changed",
                "skill:progression-changed",
                "skillLevelUp",
                "skill:level-up"
            ].forEach((eventName) => {
                bind(eventName, () => {
                    this.schedule("heroSkills", () => this.renderHeroSkillProgression());
                });
            });

            bind("window:opened", (payload = {}) => {
                if (payload.id === "discipline-guide-view") {
                    const disciplineId = payload.options?.disciplineId || "sword";
                    this.renderDisciplineGuide(disciplineId);
                }
            });

            // Mochila e equipamento.
            [
                "itemObtained",
                "ItemAcquired",
                "bag:items-added",
                "bag:item-removed",
                "bag:cleared",
                "inventory:item-removed",
                "inventory:changed"
            ].forEach((eventName) => {
                bind(eventName, () => {
                    this.schedule("inventory", () => this.renderInventory());
                    this.schedule("battleInventory", () => this.renderBattleInventory());
                });
            });

            [
                "itemEquipped",
                "itemUnequipped",
                "equipment:changed"
            ].forEach((eventName) => {
                bind(eventName, () => {
                    this.schedule("equipment", () => this.renderEquipment());
                    this.schedule("battleEquipment", () => this.renderBattleEquipment());
                    this.schedule("heroStats", () => this.renderHeroStats());
                    this.schedule("inventory", () => this.renderInventory());
                    this.schedule("actionBar", () => this.renderActionBar());
                });
            });

            // Quests.
            [
                "QuestAccepted",
                "QuestUpdated",
                "QuestObjectiveUpdated",
                "QuestFinished",
                "quest:accepted",
                "quest:updated",
                "quest:objective-updated",
                "quest:finished",
                "quest:reset"
            ].forEach((eventName) => {
                bind(eventName, () => {
                    this.schedule("quests", () => this.renderQuests());
                });
            });

            // Cidade.
            bind("playerMoved", (payload) => {
                this.schedule("cityHero", () => {
                    this.renderCityPosition(payload);
                });
            });

            bind("locationChanged", () => {
                this.schedule("cityHero", () => this.renderCityPosition());
            });

            bind("scene:changed", () => {
                this.schedule("cityHero", () => this.renderCityPosition());
            });

            // Caçada.
            [
                "hunt:started",
                "hunt:updated",
                "hunt:tick",
                "hunt:enemy-defeated",
                "hunt:paused",
                "hunt:resumed",
                "hunt:ended",
                "hunt:xpChanged",
                "hunt:loot-generated",
                "hunt:rewards-updated"
            ].forEach((eventName) => {
                bind(eventName, () => {
                    this.schedule("hunt", () => this.renderHunt());
                });
            });

            // Combate.
            [
                "CombatStarted",
                "CombatEnded",
                "TurnStarted",
                "TurnEnded",
                "DamageDealt",
                "AttackMissed",
                "HealthChanged",
                "CombatTick",
                "battle:tick",
                "EnemyDefeated",
                "BattleRewardsGranted",
                "battle:rewards-granted",
                "HeroDefeated",
                "SkillUsed",
                "BattleLog",
                "SkillControllerActionExecuted",
                "HeroActionExecuted",
                "combat:started",
                "combat:updated",
                "combat:ended"
            ].forEach((eventName) => {
                bind(eventName, () => {
                    this.schedule("combat", () => this.renderCombat());
                });
            });

            // ActionBar, prioridades e recursos.
            [
                "SkillControllerReady",
                "SkillControllerSettingsChanged",
                "skill-controller:settings-changed",
                "actionBarChanged",
                "actionbar:changed",
                "skill:cooldown-started",
                "SkillUseFailed",
                "skill-controller:manual-queued",
                "PrimaryAttackUsed",
                "primary-attack:used",
                "primary-attack:queued",
                "primary-attack:settings-changed",
                "primary-attack:cooldowns-reset"
            ].forEach((eventName) => {
                bind(eventName, () => {
                    this.schedule("actionBar", () => this.renderActionBar());
                });
            });

            // Bosses.
            [
                "boss:ready",
                "boss:timer-tick",
                "boss:challenge-started",
                "boss:challenge-denied",
                "boss:defeated",
                "boss:weekly-reset",
                "boss:weekly-reward-claimed",
                "boss:unlocked",
                "BossChallengeStarted",
                "BossDefeated"
            ].forEach((eventName) => {
                bind(eventName, () => {
                    this.schedule("bosses", () => this.renderBosses());
                });
            });

            // Profissões.
            [
                "profession:ready",
                "profession:updated",
                "profession:unlocked",
                "profession:xpChanged",
                "profession:rankUp"
            ].forEach((eventName) => {
                bind(eventName, () => {
                    this.schedule("professions", () => this.renderProfessions());
                });
            });

            // Engine e save.
            bind("EngineReady", () => {
                this.schedule("all", () => this.renderAll());
                this.schedule("engineStatus", () => {
                    this.renderEngineStatus("Pronta");
                });
            });

            bind("EngineError", (payload) => {
                this.schedule("engineStatus", () => {
                    this.renderEngineStatus(
                        payload?.message || "Erro ao iniciar a engine",
                        true
                    );
                });
            });

            bind("save:loaded", () => {
                this.schedule("all", () => this.renderAll());
            });

            bind("state:restored", () => {
                this.schedule("all", () => this.renderAll());
            });

            bind("settings:battle-mode-changed", (payload) => {
                this.setBattleMode(
                    payload?.battleMode || payload?.value || "cards",
                    { source: payload?.source || "settings" }
                );
            });
        },

        schedule(key, callback) {
            this.pendingRenders.set(key, callback);

            if (this.renderFrame !== null) {
                return;
            }

            this.renderFrame = window.requestAnimationFrame(() => {
                const jobs = [...this.pendingRenders.values()];
                this.pendingRenders.clear();
                this.renderFrame = null;

                jobs.forEach((job) => {
                    try {
                        job();
                    } catch (error) {
                        console.error("Erro de renderização:", error);
                        Aethra.EventBus.emit("render:error", {
                            error,
                            message: error.message
                        });
                    }
                });
            });
        },

        getSelectedBattleMode() {
            const configuredMode =
                Aethra.SettingsManager?.getBattleMode?.() ||
                Aethra.GameState.settings?.battleMode ||
                "cards";

            return configuredMode === "map2d" ? "map2d" : "cards";
        },

        renderSelectedBattleMode(mode = null) {
            const selectedMode = mode || this.getSelectedBattleMode();

            if (selectedMode === "map2d") {
                return this.activateMap2DPlaceholder();
            }

            const activated = this.activateBattleMode();
            if (activated) {
                this.renderAll();
            }

            return activated;
        },

        setBattleMode(mode, options = {}) {
            const selectedMode = mode === "map2d" ? "map2d" : "cards";
            const previousMode = this.battleMode;
            const rendered = selectedMode === "map2d"
                ? this.activateMap2DPlaceholder()
                : this.activateBattleMode();

            if (selectedMode === "cards" && rendered) {
                this.renderAll();
            } else {
                this.renderEngineStatus(
                    Aethra.GameLoader?.initialized ? "Pronta" : "Carregando"
                );
            }

            Aethra.EventBus.emit("render:battle-mode-changed", {
                battleMode: selectedMode,
                previousBattleMode: previousMode,
                source: options.source || "render-engine",
                rendered,
                timestamp: Date.now()
            });

            return rendered;
        },

        clearActionBarOverlay() {
            const actionBarLayer = document.getElementById(
                "battle-actionbar-layer"
            );

            if (actionBarLayer) {
                actionBarLayer.replaceChildren();
            }
        },

        activateMap2DPlaceholder() {
            this.battleMode = "map2d";
            this.viewMode = "map2d";

            Aethra.GameState.ui = Aethra.GameState.ui || {};
            Aethra.GameState.ui.battleMode = "map2d";
            Aethra.GameState.ui.viewMode = "map2d";

            document.body.classList.add("aethra-battle-mode");
            document.body.classList.add("aethra-map2d-placeholder-mode");

            const cityView = document.getElementById("city-view");
            if (!cityView) return false;

            cityView.dataset.renderMode = "map2d";
            this.clearActionBarOverlay();

            const placeholderAlreadyMounted = Boolean(
                cityView.querySelector("[data-map2d-placeholder]")
            );

            if (!placeholderAlreadyMounted) {
                cityView.innerHTML = `
                    <div id="tilemap-canvas-root" data-map2d-placeholder class="map2d-active-root"></div>
                    <div class="battle-compatibility-nodes" hidden>
                        <div id="stats-display"></div>
                        <div id="hunt-display"></div>
                        <div id="combat-display"></div>
                        <div id="skill-action-bar"></div>
                        <div id="city-grid"></div>
                        <div id="hero-sprite"></div>
                        <div id="boss-weekly-reward"></div>
                        <div id="boss-list"></div>
                    </div>
                `;
            }

            if (!placeholderAlreadyMounted) {
                Aethra.EventBus.emit("render:map2d-placeholder-ready", {
                    battleMode: "map2d",
                    mode: this.viewMode
                });
            }

            return true;
        },

        activateBattleMode() {
            this.battleMode = "cards";
            this.viewMode = "battle-cards";

            Aethra.GameState.ui = Aethra.GameState.ui || {};
            Aethra.GameState.ui.battleMode = "cards";
            Aethra.GameState.ui.viewMode = this.viewMode;

            document.body.classList.add("aethra-battle-mode");
            document.body.classList.remove("aethra-map2d-placeholder-mode");

            const cityView = document.getElementById("city-view");
            if (!cityView) return false;

            cityView.dataset.renderMode = this.viewMode;

            if (cityView.querySelector("[data-battle-mode-layout]")) {
                return true;
            }

            this.clearActionBarOverlay();
            cityView.innerHTML = `
                <div class="battle-mode-layout" data-battle-mode-layout>
                    <section
                        class="primary-screen primary-screen--hunt"
                        data-primary-screen="hunt"
                        aria-label="Painel de caçada"
                    >
                    <div class="battle-hunt-layout">
                    <aside class="battle-sidebar battle-sidebar--hero">
                        <section class="battle-panel battle-panel--hero-hub" data-hero-hub>
                            <header class="battle-panel__header hero-hub__header">
                                <div>
                                    <small>Personagem e progressão</small>
                                    <h2>Painel do Herói</h2>
                                </div>
                                <div class="battle-panel__tools">
                                    <span class="battle-mode-badge">CORE 1.65x</span>
                                    <button
                                        type="button"
                                        class="hud-help"
                                        aria-label="Entender o Painel do Herói"
                                        data-ui-tooltip
                                        data-tooltip-kind="hud"
                                        data-tooltip-eyebrow="CENTRAL DO PERSONAGEM"
                                        data-tooltip-title="Painel do Herói"
                                        data-tooltip-body="Reúne recursos, atributos, equipamentos, mochila e evolução das habilidades em um único lugar."
                                        data-tooltip-hint="Use as abas internas para acompanhar a build sem abrir várias janelas."
                                    >?</button>
                                </div>
                            </header>

                            <div id="stats-display" class="hero-hub__summary"></div>

                            <nav class="hero-hub__tabs" aria-label="Seções do herói">
                                <button type="button" data-hero-panel-tab="overview" class="is-active" aria-pressed="true">
                                    <span>Visão</span>
                                    <small>Atributos</small>
                                </button>
                                <button type="button" data-hero-panel-tab="equipment" aria-pressed="false">
                                    <span>Equip.</span>
                                    <small id="hero-equipment-tab-count">0/6</small>
                                </button>
                                <button type="button" data-hero-panel-tab="backpack" aria-pressed="false">
                                    <span>Mochila</span>
                                    <small id="hero-backpack-tab-count">0/40</small>
                                </button>
                                <button type="button" data-hero-panel-tab="skills" aria-pressed="false">
                                    <span>Skills</span>
                                    <small id="hero-skills-tab-count">5</small>
                                </button>
                            </nav>

                            <div class="hero-hub__views">
                                <section class="hero-hub__view is-active" data-hero-panel-view="overview" aria-label="Atributos do herói">
                                    <div class="hero-hub__section-heading">
                                        <div>
                                            <small>Build atual</small>
                                            <strong>Atributos e impacto</strong>
                                        </div>
                                        <span>Passe o mouse para entender</span>
                                    </div>
                                    <div id="hero-attributes-grid" class="hero-attributes-grid"></div>
                                </section>

                                <section class="hero-hub__view" data-hero-panel-view="equipment" aria-label="Equipamentos do herói" hidden>
                                    <div class="hero-hub__section-heading">
                                        <div>
                                            <small>Paperdoll</small>
                                            <strong>Equipamentos ativos</strong>
                                        </div>
                                        <button type="button" data-open-window="inventory-view">Gerenciar</button>
                                    </div>
                                    <div id="battle-equipment-summary" class="battle-equipment-summary hero-equipment-grid" aria-label="Equipamentos do herói"></div>
                                    <div id="hero-build-summary" class="hero-build-summary"></div>
                                </section>

                                <section class="hero-hub__view" data-hero-panel-view="backpack" aria-label="Mochila do herói" hidden>
                                    <div class="hero-hub__section-heading">
                                        <div>
                                            <small>Backpack</small>
                                            <strong>Loot e consumíveis</strong>
                                        </div>
                                        <button type="button" id="open-full-inventory">Abrir mochila</button>
                                    </div>
                                    <div class="battle-inventory-meta hero-backpack-meta">
                                        <span>Espaços usados</span>
                                        <strong id="battle-inventory-count">0 / 40</strong>
                                    </div>
                                    <div id="battle-inventory-grid" class="battle-inventory-grid hero-backpack-grid" aria-label="Inventário rápido"></div>
                                    <div id="battle-inventory-selected" class="battle-inventory-selected hero-backpack-selected">Selecione um item para ver seus dados.</div>
                                    <p class="battle-inventory-help hero-backpack-help">
                                        <span>Duplo clique: equipar</span>
                                        <span>Clique: detalhes</span>
                                    </p>
                                </section>

                                <section class="hero-hub__view" data-hero-panel-view="skills" aria-label="Progressão das habilidades" hidden>
                                    <div class="hero-hub__section-heading">
                                        <div>
                                            <small>Maestria</small>
                                            <strong>Skills e progressão</strong>
                                        </div>
                                        <button type="button" data-open-window="skills-view">Prioridades</button>
                                    </div>
                                    <div id="hero-skill-progression" class="hero-skill-progression"></div>
                                </section>
                            </div>
                        </section>
                    </aside>

                    <main class="battle-main-column">
                        <section class="battle-stage-panel">
                            <header class="battle-panel__header battle-stage-panel__header" style="margin-bottom: 8px;">
                                <div>
                                    <small>Visualização de combate</small>
                                    <h2 id="central-stage-mode-title">Palco 2D em Tempo Real</h2>
                                </div>
                                <div class="battle-mode-switcher" style="display:flex; gap:4px;">
                                    <button type="button" class="stage-mode-btn is-active" data-set-stage-mode="map2d" style="padding:4px 10px; border-radius:6px; border:1px solid rgba(91,175,200,0.4); background:rgba(91,175,200,0.15); color:#79c9e8; font:700 9px Outfit,sans-serif; cursor:pointer;">🗺 Mapa 2D</button>
                                    <button type="button" class="stage-mode-btn" data-set-stage-mode="cards" style="padding:4px 10px; border-radius:6px; border:1px solid rgba(91,139,162,0.25); background:rgba(6,14,20,0.6); color:#6a8894; font:700 9px Outfit,sans-serif; cursor:pointer;">🃏 Cartas</button>
                                </div>
                            </header>

                            <!-- Mode 1: 2D Canvas Map -->
                            <div id="tilemap-canvas-root" class="map2d-active-root"></div>

                            <!-- Mode 2: Card Arena (Hero vs Enemy) -->
                            <div id="battle-card-arena-container" class="battle-card-arena" hidden style="margin-top: 10px;">
                                <article id="battle-hero-card" class="combatant-card combatant-card--hero"></article>
                                <div class="battle-versus" aria-hidden="true">
                                    <span>VS</span>
                                    <small>POR RODADAS</small>
                                </div>
                                <article id="battle-enemy-card" class="combatant-card combatant-card--enemy"></article>
                            </div>

                            <div id="battle-round-indicator" hidden></div>
                            <div id="battle-status-strip" hidden></div>
                        </section>

                        <section class="battle-panel battle-panel--actionbar">
                            <header class="battle-panel__header">
                                <div>
                                    <small>Combate tático por rodadas</small>
                                    <h2>Ataques & Habilidades</h2>
                                </div>
                                <div class="battle-panel__tools">
                                    <button
                                        type="button"
                                        class="battle-panel__link"
                                        id="open-skill-settings"
                                    >
                                        Configurar
                                    </button>
                                    <button
                                        type="button"
                                        class="hud-help"
                                        aria-label="Entender ActionBar"
                                        data-ui-tooltip
                                        data-tooltip-kind="hud"
                                        data-tooltip-eyebrow="AUTOMAÇÃO POR RODADAS"
                                        data-tooltip-title="Uma decisão por rodada"
                                        data-tooltip-body="Em cada rodada o herói executa uma habilidade ou um ataque primário; depois o inimigo responde. Cooldowns são contados em rodadas."
                                        data-tooltip-hint="A ordem da ActionBar define qual ação automática será tentada primeiro."
                                    >?</button>
                                </div>
                            </header>

                            <div class="combat-action-deck">
                                <section class="primary-attack-deck" aria-label="Ataques primários">
                                    <div class="combat-action-deck__label">
                                        <span>Ataques primários</span>
                                        <small>fallback da rodada</small>
                                    </div>
                                    <div id="primary-attack-bar" class="primary-attack-bar"></div>
                                </section>

                                <section class="skill-action-deck" aria-label="Habilidades automáticas">
                                    <div class="battle-priority-legend">
                                        <span><b>1</b> emergência</span>
                                        <span><b>2</b> manual</span>
                                        <span><b>3</b> auto por ordem</span>
                                    </div>
                                    <div
                                        id="skill-action-bar"
                                        class="action-bar battle-action-bar"
                                        data-action-bar
                                        aria-label="Habilidades de Mana e Vigor"
                                    ></div>
                                </section>
                            </div>
                        </section>
                    </main>

                    <aside class="battle-sidebar battle-sidebar--combat">
                        <section class="battle-panel battle-panel--log">
                            <header class="battle-panel__header">
                                <div>
                                    <small>Eventos em tempo real</small>
                                    <h2>Log de Combate</h2>
                                </div>
                                <div class="battle-panel__tools">
                                    <span class="battle-live-dot">LIVE</span>
                                    <button
                                        type="button"
                                        class="hud-help"
                                        aria-label="Entender log de combate"
                                        data-ui-tooltip
                                        data-tooltip-kind="hud"
                                        data-tooltip-eyebrow="TELEMETRIA DA LUTA"
                                        data-tooltip-title="Log de Combate"
                                        data-tooltip-body="Registra dano, cura, crítico, bloqueio e ativações da build em ordem cronológica. As cores ajudam a separar eventos ofensivos, defensivos e de suporte."
                                        data-tooltip-hint="Use o log para verificar se multiplicadores e prioridades estão rendendo como esperado."
                                    >?</button>
                                </div>
                            </header>
                            <div id="combat-display"></div>
                        </section>

                        <section class="battle-panel battle-panel--hunt">
                            <header class="battle-panel__header">
                                <div>
                                    <small>Métricas da sessão</small>
                                    <h2>Hunt Analyzer</h2>
                                </div>
                                <button
                                    type="button"
                                    class="hud-help"
                                    aria-label="Entender Hunt Analyzer"
                                    data-ui-tooltip
                                    data-tooltip-kind="hud"
                                    data-tooltip-eyebrow="EFICIÊNCIA DA CAÇADA"
                                    data-tooltip-title="Hunt Analyzer"
                                    data-tooltip-body="Mostra XP, entradas, gastos por supply, profit, combate e recordes persistentes do herói por Hunt."
                                    data-tooltip-hint="DPS de pico usa uma janela de 5 segundos; recordes de taxa começam após 10 segundos de sessão."
                                >?</button>
                            </header>
                            <div id="hunt-display"></div>
                        </section>
                    </aside>
                    </div>
                    </section>

                    <section
                        class="primary-screen primary-screen--city"
                        data-primary-screen="city"
                        aria-label="Hub da cidade"
                        hidden
                    >
                        <header class="city-hub__header">
                            <div>
                                <small>Vila de Aethra</small>
                                <h2>Hub da Cidade</h2>
                                <p>
                                    Prepare equipamentos, visite comerciantes e
                                    organize o herói antes da próxima caçada.
                                </p>
                            </div>
                            <button
                                type="button"
                                class="city-hub__hunt-button"
                                data-primary-view="hunt"
                            >
                                Voltar para Hunt
                            </button>
                        </header>

                        <div class="city-hub__grid">
                            <article class="city-service-card city-service-card--merchant">
                                <div class="city-service-card__portrait">
                                    <img
                                        src="assets/entities/npc_idle.png"
                                        alt="Mercador da cidade"
                                        draggable="false"
                                    >
                                </div>
                                <div class="city-service-card__content">
                                    <small>NPC</small>
                                    <h3>Mercador da Vila</h3>
                                    <p>Compre suprimentos e venda o loot obtido nas hunts.</p>
                                    <button
                                        type="button"
                                        data-open-window="npc-shop-view"
                                    >
                                        Abrir Mercador
                                    </button>
                                </div>
                            </article>

                            <article class="city-service-card">
                                <div class="city-service-card__icon" aria-hidden="true">⚖</div>
                                <div class="city-service-card__content">
                                    <small>Comércio</small>
                                    <h3>Mercado de Jogadores</h3>
                                    <p>Consulte ofertas e negocie itens com outros aventureiros.</p>
                                    <button
                                        type="button"
                                        data-open-window="player-market-view"
                                    >
                                        Abrir Mercado
                                    </button>
                                </div>
                            </article>

                            <article class="city-service-card">
                                <div class="city-service-card__icon" aria-hidden="true">🎒</div>
                                <div class="city-service-card__content">
                                    <small>Preparação</small>
                                    <h3>Mochila e Equipamentos</h3>
                                    <p>Troque peças e confira o multiplicador de atributos 1.65x.</p>
                                    <button
                                        type="button"
                                        data-open-window="inventory-view"
                                    >
                                        Abrir Inventário
                                    </button>
                                </div>
                            </article>

                            <article class="city-service-card">
                                <div class="city-service-card__icon" aria-hidden="true">✦</div>
                                <div class="city-service-card__content">
                                    <small>Treinamento</small>
                                    <h3>Mestre de Habilidades</h3>
                                    <p>Organize prioridades, automações e limites de suporte.</p>
                                    <button
                                        type="button"
                                        data-open-window="skills-view"
                                    >
                                        Configurar Skills
                                    </button>
                                </div>
                            </article>
                        </div>
                    </section>

                    <div class="battle-compatibility-nodes" hidden>
                        <div id="city-grid"></div>
                        <div id="hero-sprite"></div>
                        <div id="boss-weekly-reward"></div>
                        <div id="boss-list"></div>
                    </div>
                </div>
            `;

            document
                .getElementById("open-full-inventory")
                ?.addEventListener("click", () => {
                    Aethra.WindowManager?.openWindow?.(
                        "inventory-view",
                        { source: "battle-dashboard" }
                    );
                });

            document
                .getElementById("open-skill-settings")
                ?.addEventListener("click", () => {
                    Aethra.WindowManager?.openWindow?.(
                        "skills-view",
                        { source: "battle-dashboard" }
                    );
                });

            this.syncHeroPanelTabs();

            Aethra.EventBus.emit("render:battle-mode-ready", {
                battleMode: this.battleMode,
                mode: this.viewMode
            });

            return true;
        },

        buildCombatInspectHTML(combatant, side) {
            const inspection = Aethra.BattleSystem
                ?.getCombatantInspection?.(combatant, side);

            if (!inspection) return "";

            const allowedBonusStats = new Set([
                "str",
                "mag",
                "precision",
                "critical",
                "evasion",
                "defense",
                "damage",
                "damageMin",
                "damageMax",
                "blockChance",
                "blockReduction",
                "maxHp",
                "maxMana",
                "hpMax",
                "manaMax"
            ]);

            const bonuses = (inspection.statBonuses || [])
                .filter((entry) => allowedBonusStats.has(entry.stat))
                .filter((entry, index, list) => {
                    const normalized = entry.stat === "hpMax"
                        ? "maxHp"
                        : entry.stat === "manaMax"
                            ? "maxMana"
                            : entry.stat;

                    return list.findIndex((candidate) => {
                        const candidateNormalized = candidate.stat === "hpMax"
                            ? "maxHp"
                            : candidate.stat === "manaMax"
                                ? "maxMana"
                                : candidate.stat;
                        return candidateNormalized === normalized;
                    }) === index;
                })
                .slice(0, 5);

            const itemRolls = (inspection.itemRolls || [])
                .sort((a, b) => Number(b.ivPercent || 0) - Number(a.ivPercent || 0))
                .slice(0, 4);

            const bonusHTML = bonuses.length > 0
                ? bonuses.map((entry) => {
                    const formattedBonus = Aethra.UIManager?.formatStatValue?.(
                        entry.stat,
                        entry.bonus
                    ) ?? String(entry.bonus);

                    return `
                        <li class="combat-inspect__bonus">
                            <span>${escapeHTML(statLabel(entry.stat))}</span>
                            <strong class="${entry.bonus >= 0 ? "is-positive" : "is-negative"}">
                                ${entry.bonus >= 0 ? "+" : ""}${escapeHTML(formattedBonus)}
                            </strong>
                        </li>
                    `;
                }).join("")
                : `
                    <li class="combat-inspect__empty">
                        <span>Sem bônus de atributos ativos</span>
                        <small>Equipe itens para ampliar a build.</small>
                    </li>
                `;

            const itemRollsHTML = itemRolls.length > 0
                ? itemRolls.map((item) => {
                    const iv = Math.max(
                        0,
                        Math.min(100, Number(item.ivPercent || 0))
                    );
                    const grade = iv >= 95
                        ? "Perfeito"
                        : iv >= 85
                            ? "Excelente"
                            : iv >= 70
                                ? "Superior"
                                : iv >= 45
                                    ? "Regular"
                                    : "Baixo";

                    return `
                        <li class="combat-inspect__gear-item">
                            <div class="combat-inspect__gear-heading">
                                <span>${escapeHTML(item.name)}</span>
                                <b>${Number(item.multiplier || 1).toFixed(2)}x</b>
                            </div>
                            <div class="combat-inspect__gear-progress">
                                <i><b style="width:${iv.toFixed(1)}%"></b></i>
                                <small>${grade} · IV ${iv.toFixed(0)}%</small>
                            </div>
                        </li>
                    `;
                }).join("")
                : `
                    <li class="combat-inspect__empty combat-inspect__empty--gear">
                        <span>Nenhum equipamento detectado</span>
                    </li>
                `;

            const damageMin = Math.max(0, Number(inspection.damageMin || 0));
            const damageMax = Math.max(damageMin, Number(inspection.damageMax || damageMin));
            const damageRange = damageMax > damageMin
                ? `${formatNumber(damageMin)}–${formatNumber(damageMax)}`
                : formatNumber(damageMax);

            const roleLabel = side === "hero" ? "BUILD DO HERÓI" : "ANÁLISE DO ALVO";
            const weaponName = inspection.weapon?.name || (side === "hero" ? "Ataque desarmado" : "Ataque natural");
            const weaponMultiplier = Number(
                inspection.weapon?.multiplier || inspection.damageMultiplier || 1
            ).toFixed(2);
            const averageIv = itemRolls.length > 0
                ? itemRolls.reduce(
                    (total, item) => total + Number(item.ivPercent || 0),
                    0
                ) / itemRolls.length
                : 0;
            const headerTag = side === "hero"
                ? `IV ${averageIv.toFixed(0)}%`
                : "TARGET";
            const monsterAbilities = side === "enemy" && Array.isArray(combatant?.abilities)
                ? combatant.abilities
                    .filter((ability) => ability?.name && ability.type !== "multiattack")
                    .slice(0, 4)
                : [];
            const monsterAbilitiesHTML = monsterAbilities.map((ability) => {
                const damage = Number(ability.averageDamage || 0);
                const recharge = ability.recharge
                    ? `Recarga ${ability.recharge.min}${ability.recharge.max !== ability.recharge.min ? `–${ability.recharge.max}` : ""}`
                    : "Ação padrão";
                const detail = [
                    damage > 0 ? `${formatNumber(damage)} dano-fonte` : null,
                    recharge,
                    ability.saveDC ? `CD ${ability.saveDC}` : null
                ].filter(Boolean).join(" · ");
                return `<li><strong>${escapeHTML(ability.name)}</strong><small>${escapeHTML(detail)}</small></li>`;
            }).join("");

            return `
                <div class="combat-inspect-popover" role="dialog" aria-label="Inspeção detalhada de ${escapeHTML(inspection.name)}">
                    <header class="combat-inspect__header">
                        <div class="combat-inspect__identity">
                            <span class="combat-inspect__sigil" aria-hidden="true">${side === "hero" ? "✦" : "◆"}</span>
                            <div>
                                <small>${roleLabel}</small>
                                <strong>${escapeHTML(inspection.name)}</strong>
                            </div>
                        </div>
                        <div class="combat-inspect__header-actions">
                            <span>${headerTag}</span>
                            <button type="button" data-combat-inspect-close aria-label="Fechar inspeção">×</button>
                        </div>
                    </header>

                    <div class="combat-inspect__hero-metrics">
                        <article class="combat-inspect__primary-stat is-damage">
                            <small>Dano base</small>
                            <strong>${damageRange}</strong>
                            <span>${weaponMultiplier}x multiplicador</span>
                        </article>
                        <article class="combat-inspect__primary-stat is-critical">
                            <small>Crítico</small>
                            <strong>${precisePercent(inspection.criticalChance)}</strong>
                            <span>${Number(inspection.criticalMultiplier || 1).toFixed(2)}x no acerto</span>
                        </article>
                        <article class="combat-inspect__primary-stat is-defense">
                            <small>Mitigação</small>
                            <strong>${precisePercent(inspection.armorReduction)}</strong>
                            <span>${formatNumber(inspection.defense)} de armadura</span>
                        </article>
                    </div>

                    <div class="combat-inspect__content-grid">
                        <section class="combat-inspect__panel">
                            <div class="combat-inspect__panel-title">
                                <span>Combate</span>
                                <small>estatísticas efetivas</small>
                            </div>
                            <div class="combat-inspect__stat-list">
                                <div><span>Multiplicador de dano</span><strong>${Number(inspection.damageMultiplier || 1).toFixed(2)}x</strong></div>
                                <div><span>Esquiva</span><strong>${precisePercent(inspection.evasionChance)}</strong></div>
                                <div><span>Bloqueio</span><strong>${precisePercent(inspection.blockChance)}</strong></div>
                                <div><span>Redução no bloqueio</span><strong>${precisePercent(inspection.blockReduction)}</strong></div>
                                <div><span>Precisão</span><strong>${formatNumber(inspection.precision)}</strong></div>
                            </div>
                        </section>

                        <section class="combat-inspect__panel">
                            <div class="combat-inspect__panel-title">
                                <span>Bônus ativos</span>
                                <small>ganhos da build</small>
                            </div>
                            <ul class="combat-inspect__bonus-list">${bonusHTML}</ul>
                        </section>
                    </div>

                    ${side === "enemy" && monsterAbilitiesHTML ? `
                        <section class="combat-inspect__loadout combat-inspect__abilities">
                            <div class="combat-inspect__panel-title">
                                <span>Ações do alvo</span>
                                <small>extraídas do bestiário SRD</small>
                            </div>
                            <ul class="combat-inspect__ability-list">${monsterAbilitiesHTML}</ul>
                        </section>
                    ` : ""}

                    ${side === "hero" ? `
                        <section class="combat-inspect__loadout">
                            <div class="combat-inspect__panel-title">
                                <span>Equipamentos em destaque</span>
                                <small>qualidade dos rolls</small>
                            </div>
                            <ul class="combat-inspect__gear-grid">${itemRollsHTML}</ul>
                        </section>
                    ` : ""}

                    <footer class="combat-inspect__weapon">
                        <div>
                            <small>Fonte principal de dano</small>
                            <strong>${escapeHTML(weaponName)}</strong>
                        </div>
                        <span>${weaponMultiplier}x</span>
                    </footer>
                </div>
            `;
        },

        bindCombatInspect(card) {
            if (!card) return false;

            const button = card.querySelector("[data-combat-inspect-toggle]");
            const closeButton = card.querySelector("[data-combat-inspect-close]");
            if (!button) return false;

            const setOpen = (isOpen) => {
                const side = card.id === "battle-enemy-card"
                    ? "enemy"
                    : "hero";

                Aethra.GameState.ui = Aethra.GameState.ui || {};
                Aethra.GameState.ui.combatInspect = isOpen ? side : null;

                document
                    .querySelectorAll(".combatant-card.is-inspecting")
                    .forEach((activeCard) => {
                        if (activeCard !== card || !isOpen) {
                            activeCard.classList.remove("is-inspecting");
                            activeCard
                                .querySelector("[data-combat-inspect-toggle]")
                                ?.setAttribute("aria-expanded", "false");
                        }
                    });

                card.classList.toggle("is-inspecting", isOpen);
                button.setAttribute("aria-expanded", isOpen ? "true" : "false");
            };

            button.addEventListener("click", (event) => {
                event.stopPropagation();
                setOpen(!card.classList.contains("is-inspecting"));
            });

            closeButton?.addEventListener("click", (event) => {
                event.stopPropagation();
                setOpen(false);
                button.focus();
            });

            return true;
        },

        renderBattleCards() {
            const hero = Aethra.GameState.hero || {};
            const stats = hero.stats || {};
            const battle = Aethra.GameState.battle || {};
            const combat = Aethra.GameState.combat || {};
            const hunt = Aethra.GameState.hunt || {};
            const exploration = Aethra.GameState.exploration || {};
            const pendingEvent = exploration.pendingEvent || null;
            const enemy =
                (battle.isFighting ? battle.creature : null) ||
                (combat.isActive ? combat.enemy : null) ||
                hunt.currentEnemy ||
                null;
            const combatActive = Boolean(
                battle.isFighting || combat.isActive || enemy
            );
            const hasEventCard = Boolean(!combatActive && pendingEvent);
            const lastHeroAction = battle.lastHeroAction || null;
            const lastHeroActionIsRecent = Boolean(
                lastHeroAction?.name &&
                Date.now() - Number(lastHeroAction.executedAt || 0) < 2800
            );

            const heroCard = getElement(this.selectors.battleHeroCard);
            const enemyCard = getElement(this.selectors.battleEnemyCard);
            const arena = heroCard?.closest('.battle-card-arena');
            const versus = arena?.querySelector('.battle-versus');
            if (!heroCard || !enemyCard) return false;

            heroCard.classList.toggle('is-combat-active', combatActive);
            enemyCard.classList.toggle('is-combat-active', combatActive && Boolean(enemy));
            heroCard.classList.toggle('is-exploring', !combatActive);
            enemyCard.classList.toggle('is-idle', !enemy && !hasEventCard);
            enemyCard.classList.toggle('is-event-card', hasEventCard);
            enemyCard.hidden = !combatActive && !hasEventCard;
            if (arena) {
                arena.classList.toggle('is-hero-only', !combatActive && !hasEventCard);
                arena.classList.toggle('has-context-card', combatActive || hasEventCard);
                arena.classList.toggle('has-enemy-card', combatActive && Boolean(enemy));
                arena.classList.toggle('has-event-card', hasEventCard);
            }
            if (versus) {
                versus.hidden = !combatActive && !hasEventCard;
                versus.innerHTML = hasEventCard
                    ? '<span>✦</span><small>EVENTO</small>'
                    : '<span>VS</span><small>POR RODADAS</small>';
            }

            const heroHp = Number(hero.hp ?? stats.hp ?? 0);
            const heroMaxHp = Math.max(1, Number(hero.maxHp ?? stats.maxHp ?? heroHp ?? 1));
            const heroMana = Number(hero.mana ?? stats.mana ?? 0);
            const heroMaxMana = Math.max(1, Number(hero.maxMana ?? stats.maxMana ?? heroMana ?? 1));
            const heroVigor = Number(hero.vigor ?? stats.vigor ?? hero.energy ?? stats.energy ?? 0);
            const heroMaxVigor = Math.max(1, Number(hero.maxVigor ?? stats.maxVigor ?? hero.maxEnergy ?? stats.maxEnergy ?? heroVigor ?? 1));
            const heroSprite = resolveSpritePath(hero, 'assets/entities/player_idle.png');
            const currentHuntName = Aethra.HuntSystem?.hunts?.[hunt.huntId]?.name || 'Sem hunt ativa';
            const heroStateTitle = combatActive
                ? 'Em combate'
                : pendingEvent
                    ? 'Evento encontrado'
                    : hunt.isActive
                        ? 'Explorando a região'
                        : 'Aguardando expedição';
            const heroStateDetail = combatActive
                ? (enemy?.name ? `Enfrentando ${enemy.name}` : 'Combate ativo')
                : pendingEvent
                    ? pendingEvent.title
                    : hunt.isActive
                        ? currentHuntName
                        : 'Abra o Mapa Mundi para escolher a próxima Hunt';
            const lastActionText = combatActive
                ? (lastHeroAction?.name || 'Preparando ação')
                : pendingEvent
                    ? (pendingEvent.actionLabel || 'Interagir')
                    : hunt.isActive
                        ? 'Avançando pela Hunt em loop contínuo'
                        : 'Nenhuma hunt selecionada';
            const heroMetrics = [
                ['ATQ', formatNumber(stats.damage ?? stats.damageMax ?? stats.str)],
                ['DEF', formatNumber(stats.defense)],
                ['CRIT', percent(stats.critical)],
                ['ESQ', percent(stats.dodge ?? stats.evasion)]
            ];

            heroCard.innerHTML = `
                <header class="combatant-card__header combatant-card__header--split">
                    <div>
                        <small>HERÓI</small>
                        <h3>${escapeHTML(hero.name || 'Aethra')}</h3>
                    </div>
                    <div class="combatant-card__header-actions">
                        <span>NV. ${getHeroLevel(hero)}</span>
                        <button
                            type="button"
                            class="combatant-card__inspect-button"
                            data-combat-inspect-toggle
                            aria-expanded="false"
                        >INSPECT</button>
                    </div>
                </header>

                <div class="combatant-card__body combatant-card__body--hero">
                    <div class="combatant-card__visual-wrap">
                        <div class="combatant-card__portrait combatant-card__portrait--standalone">
                            <span class="combatant-card__fallback">H</span>
                            ${heroSprite ? `
                                <img
                                    src="${escapeHTML(heroSprite)}"
                                    alt="${escapeHTML(hero.name || 'Herói')}"
                                    draggable="false"
                                >
                            ` : ''}
                        </div>
                    </div>

                    <div class="combatant-card__info-panel">
                        <div class="combatant-card__state-line">
                            <span class="combatant-card__state-pill is-${combatActive ? 'combat' : pendingEvent ? 'event' : hunt.isActive ? 'exploring' : 'idle'}">${escapeHTML(heroStateTitle)}</span>
                            <span class="combatant-card__location">${escapeHTML(heroStateDetail)}</span>
                        </div>

                        <div class="combatant-card__resources combatant-card__resources--stacked">
                            <div class="combatant-resource combatant-resource--hp">
                                <span><b>HP</b> ${formatNumber(heroHp)} / ${formatNumber(heroMaxHp)}</span>
                                <progress max="${heroMaxHp}" value="${Math.min(heroHp, heroMaxHp)}"></progress>
                            </div>
                            <div class="combatant-resource combatant-resource--mana">
                                <span><b>MP</b> ${formatNumber(heroMana)} / ${formatNumber(heroMaxMana)}</span>
                                <progress max="${heroMaxMana}" value="${Math.min(heroMana, heroMaxMana)}"></progress>
                            </div>
                            <div class="combatant-resource combatant-resource--vigor">
                                <span><b>VIGOR</b> ${formatNumber(heroVigor)} / ${formatNumber(heroMaxVigor)}</span>
                                <progress max="${heroMaxVigor}" value="${Math.min(heroVigor, heroMaxVigor)}"></progress>
                            </div>
                        </div>

                        <div class="combatant-card__info-bar">
                            <div class="combatant-card__activity">
                                <small>${combatActive ? 'ÚLTIMA AÇÃO' : pendingEvent ? 'PRÓXIMA INTERAÇÃO' : 'STATUS DA JORNADA'}</small>
                                <strong>${escapeHTML(lastActionText)}</strong>
                            </div>
                            <div class="combatant-card__mini-metrics">
                                ${heroMetrics.map(([label, value]) => `<span><small>${label}</small><b>${escapeHTML(value)}</b></span>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                ${lastHeroActionIsRecent ? `
                    <div
                        class="combatant-card__last-action is-${escapeHTML(String(lastHeroAction.type || 'attack').toLowerCase())}"
                        data-action-timestamp="${Number(lastHeroAction.executedAt || 0)}"
                    >
                        <span class="combatant-card__last-action-icon" aria-hidden="true">${String(lastHeroAction.type || 'attack').toLowerCase() === 'heal' ? '✚' : '⚔'}</span>
                        <span>
                            <small>AÇÃO DO TURNO</small>
                            <strong>${escapeHTML(lastHeroAction.name)}</strong>
                        </span>
                    </div>
                ` : ''}

                ${this.buildCombatInspectHTML(hero, 'hero')}
            `;

            if (combatActive && enemy) {
                const enemyName = enemy?.name || enemy?.id || 'Inimigo';
                const enemyHp = Number(enemy?.hp || 0);
                const enemyMaxHp = Math.max(1, Number(enemy?.maxHp || enemy?.hp || 1));
                const enemyMana = Number(enemy?.mana ?? enemy?.stats?.mana ?? 0);
                const enemyMaxMana = Math.max(1, Number(enemy?.maxMana ?? enemy?.stats?.maxMana ?? enemyMana ?? 1));
                const enemySprite = resolveSpritePath(enemy, null);
                const enemyInitial = String(enemyName).charAt(0).toUpperCase();
                const family = enemy?.type || enemy?.family || enemy?.monsterType || 'Criatura';
                const enemyThreat = enemy?.rarity || enemy?.rank || (enemy?.xp > heroMaxHp ? 'Perigoso' : 'Normal');
                const enemyAction = battle.lastEnemyAction?.name || enemy?.lastAction?.name || 'Aguardando ação';
                const compactIntel = (value, fallback) => {
                    const text = String(value || fallback || '').trim();
                    return text.length > 34 ? `${text.slice(0, 31)}...` : text;
                };
                const enemyResistance = compactIntel(enemy?.immunities || enemy?.resistances, 'Nenhuma conhecida');
                const enemyVulnerability = compactIntel(enemy?.vulnerabilities, 'Não identificada');
                const enemyMetrics = [
                    ['ATQ', formatNumber(enemy?.damage ?? enemy?.stats?.damageMax)],
                    ['DEF', formatNumber(enemy?.stats?.defense)],
                    ['CR', escapeHTML(String(enemy?.challengeRating || enemy?.challengeRatingValue || '—'))],
                    ['XP', formatNumber(enemy?.xp)]
                ];

                enemyCard.innerHTML = `
                    <header class="combatant-card__header combatant-card__header--split">
                        <div>
                            <small>INIMIGO</small>
                            <h3>${escapeHTML(enemyName)}</h3>
                        </div>
                        <div class="combatant-card__header-actions">
                            <span>NV. ${formatNumber(enemy.level || 1)}</span>
                            <button
                                type="button"
                                class="combatant-card__inspect-button"
                                data-combat-inspect-toggle
                                aria-expanded="false"
                            >INSPECT</button>
                        </div>
                    </header>

                    <div class="combatant-card__body combatant-card__body--enemy">
                        <div class="combatant-card__visual-wrap">
                            <div class="combatant-card__portrait combatant-card__portrait--standalone">
                                <span class="combatant-card__fallback">${escapeHTML(enemyInitial || '?')}</span>
                                ${enemySprite ? `
                                    <img
                                        src="${escapeHTML(enemySprite)}"
                                        alt="${escapeHTML(enemyName)}"
                                        draggable="false"
                                    >
                                ` : ''}
                            </div>
                        </div>

                        <div class="combatant-card__info-panel">
                            <div class="combatant-card__state-line">
                                <span class="combatant-card__state-pill is-danger">${escapeHTML(family)}</span>
                                <span class="combatant-card__location">${escapeHTML(String(enemyThreat))}</span>
                            </div>

                            <div class="combatant-card__resources combatant-card__resources--stacked">
                                <div class="combatant-resource combatant-resource--hp">
                                    <span><b>HP</b> ${formatNumber(enemyHp)} / ${formatNumber(enemyMaxHp)}</span>
                                    <progress max="${enemyMaxHp}" value="${Math.min(enemyHp, enemyMaxHp)}"></progress>
                                </div>
                                <div class="combatant-resource combatant-resource--mana">
                                    <span><b>MP</b> ${formatNumber(enemyMana)} / ${formatNumber(enemyMaxMana)}</span>
                                    <progress max="${enemyMaxMana}" value="${Math.min(enemyMana, enemyMaxMana)}"></progress>
                                </div>
                            </div>

                            <div class="combatant-card__intel">
                                <span><small>FRAQUEZA</small><strong>${escapeHTML(enemyVulnerability)}</strong></span>
                                <span><small>RESISTÊNCIA</small><strong>${escapeHTML(enemyResistance)}</strong></span>
                            </div>

                            <div class="combatant-card__info-bar">
                                <div class="combatant-card__activity">
                                    <small>AÇÃO DO ALVO</small>
                                    <strong>${escapeHTML(enemyAction)}</strong>
                                </div>
                                <div class="combatant-card__mini-metrics">
                                    ${enemyMetrics.map(([label, value]) => `<span><small>${label}</small><b>${escapeHTML(value)}</b></span>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    ${this.buildCombatInspectHTML(enemy, 'enemy')}
                `;
            } else if (hasEventCard) {
                const professionName = Aethra.ProfessionSystem?.professions?.[pendingEvent.professionId]?.name || 'Exploração';
                const professionState = Aethra.ProfessionSystem?.getState?.(pendingEvent.professionId) || {};
                const eventSkillMultiplier = Math.max(0, Number(Aethra.HuntSystem?.getProfessionXPMultiplier?.(pendingEvent.professionId) ?? 1));
                const eventXpRange = Array.isArray(pendingEvent.xp)
                    ? `${formatNumber(Math.round(Number(pendingEvent.xp[0] || 0) * 1.25 * eventSkillMultiplier))}–${formatNumber(Math.round(Number(pendingEvent.xp[1] || 0) * 1.25 * eventSkillMultiplier))}`
                    : formatNumber(Math.round(Number(pendingEvent.xp || 0) * 1.25 * eventSkillMultiplier));
                const requiredLevel = Math.max(1, Number(pendingEvent.requiredLevel || 1));
                const checkPreview = pendingEvent.requiresManual
                    ? Aethra.ProfessionSystem?.check?.(pendingEvent.professionId, requiredLevel, { randomSource: () => 0 })
                    : null;
                const eventRisk = pendingEvent.category === 'thievery'
                    ? (Number(professionState.level || 1) < requiredLevel ? 'Alto' : 'Teste')
                    : pendingEvent.category === 'arcane'
                        ? 'Médio'
                        : pendingEvent.category === 'survival'
                            ? 'Baixo'
                            : 'Seguro';
                enemyCard.innerHTML = `
                    <header class="combatant-card__header combatant-card__header--split">
                        <div>
                            <small>EVENTO</small>
                            <h3>${escapeHTML(pendingEvent.title || 'Descoberta')}</h3>
                        </div>
                        <div class="combatant-card__header-actions">
                            <span>INTERAÇÃO</span>
                        </div>
                    </header>
                    <div class="combatant-card__body combatant-card__body--event">
                        <div class="combatant-card__visual-wrap combatant-card__visual-wrap--event">
                            <div class="combatant-card__event-icon">${escapeHTML(pendingEvent.icon || '✦')}</div>
                        </div>
                        <div class="combatant-card__info-panel">
                            <div class="combatant-card__state-line">
                                <span class="combatant-card__state-pill is-event">${escapeHTML(professionName)}</span>
                                <span class="combatant-card__location">Evento de ${escapeHTML(pendingEvent.category || 'mundo')}</span>
                            </div>
                            <div class="combatant-card__event-copy">
                                <p>${escapeHTML(pendingEvent.description || 'Um novo ponto de interesse apareceu durante a caçada.')}</p>
                            </div>
                            <div class="combatant-card__event-metrics">
                                <span><small>SKILL</small><strong>${escapeHTML(professionName)}</strong></span>
                                <span><small>NÍVEL</small><strong>${formatNumber(professionState.level || 1)}${pendingEvent.requiresManual ? ` / ${formatNumber(requiredLevel)}` : ''}</strong></span>
                                <span><small>XP POSSÍVEL</small><strong>${escapeHTML(eventXpRange)}</strong></span>
                                <span><small>${pendingEvent.requiresManual ? 'SUCESSO' : 'RISCO'}</small><strong>${pendingEvent.requiresManual ? `${Math.round(Number(checkPreview?.chance || 0) * 100)}%` : escapeHTML(eventRisk)}</strong></span>
                            </div>
                            <div class="combatant-card__event-actions">
                                <button type="button" class="combatant-card__event-button" data-resolve-exploration="${escapeHTML(pendingEvent.eventId)}">${escapeHTML(pendingEvent.actionLabel || 'Interagir')}</button>
                            </div>
                        </div>
                    </div>
                `;
                enemyCard.querySelector('[data-resolve-exploration]')?.addEventListener('click', (event) => {
                    Aethra.ExplorationSystem?.resolveEvent?.(event.currentTarget.dataset.resolveExploration, { manual: true });
                });
            } else {
                enemyCard.innerHTML = '';
            }

            const activeInspect = Aethra.GameState.ui?.combatInspect || null;
            heroCard.classList.toggle('is-inspecting', activeInspect === 'hero');
            enemyCard.classList.toggle('is-inspecting', activeInspect === 'enemy');
            heroCard
                .querySelector('[data-combat-inspect-toggle]')
                ?.setAttribute('aria-expanded', activeInspect === 'hero' ? 'true' : 'false');
            enemyCard
                .querySelector('[data-combat-inspect-toggle]')
                ?.setAttribute('aria-expanded', activeInspect === 'enemy' ? 'true' : 'false');

            [heroCard, enemyCard].forEach((card) => {
                this.bindCombatInspect(card);
                const image = card.querySelector('img');
                const fallback = card.querySelector('.combatant-card__fallback');
                if (!image) return;
                image.addEventListener('load', () => {
                    image.hidden = false;
                    if (fallback) fallback.hidden = true;
                }, { once: true });
                image.addEventListener('error', () => {
                    image.hidden = true;
                    if (fallback) fallback.hidden = false;
                }, { once: true });
            });

            const indicator = document.getElementById('battle-round-indicator');
            const strip = document.getElementById('battle-status-strip');
            const active = combatActive;
            const round = Number(battle.round || combat.round || 0);

            if (indicator) {
                indicator.textContent = active
                    ? `Rodada ${formatNumber(round)}`
                    : hasEventCard
                        ? 'Evento ativo'
                        : hunt.isActive
                            ? 'Explorando'
                            : 'Aguardando';
                indicator.classList.toggle('is-active', active || hasEventCard);
            }

            if (strip) {
                const lastMessage =
                    battle.lastMessage ||
                    combat.lastMessage ||
                    (hasEventCard
                        ? `${pendingEvent.title}: ${pendingEvent.description}`
                        : hunt.isActive
                            ? `Explorando ${currentHuntName}. Os eventos e combates aparecerão automaticamente no loop da Hunt.`
                            : 'Abra o Mapa Mundi para escolher a Hunt e iniciar a expedição.');
                const color = safeColor(battle.lastMessageColor || combat.lastMessageColor, '');
                strip.textContent = lastMessage;
                strip.style.color = color || '';
            }

            return true;
        },

        stopActionBarCooldownTicker() {
            if (this.cooldownAnimationFrame !== null) {
                cancelAnimationFrame(this.cooldownAnimationFrame);
                this.cooldownAnimationFrame = null;
            }
        },

        updateActionBarCooldownVisuals() {
            const skillContainer = getElement(this.selectors.actionBar);
            const primaryContainer = getElement(this.selectors.primaryAttacks);
            const roots = [skillContainer, primaryContainer].filter(Boolean);
            if (roots.length === 0) {
                this.stopActionBarCooldownTicker();
                return false;
            }

            const now = Date.now();
            let activeCooldowns = 0;
            let realtimeCooldowns = 0;
            const slots = roots.flatMap((root) => [
                ...root.querySelectorAll("[data-ready-at]")
            ]);

            slots.forEach((slot) => {
                const roundMode = slot.dataset.cooldownMode === "rounds";
                const skillId = slot.dataset.skillId || null;
                const readyAt = Number(slot.dataset.readyAt || 0);
                const duration = Math.max(1, Number(slot.dataset.cooldownMs || 1));
                const remainingRounds = roundMode && skillId
                    ? Number(Aethra.SkillSystem?.getCooldownRoundsRemaining?.(skillId) || 0)
                    : 0;
                const remaining = roundMode ? remainingRounds : Math.max(0, readyAt - now);
                const roundDuration = Math.max(1, Number(slot.dataset.cooldownRounds || 1));
                const progress = Math.min(1, remaining / (roundMode ? roundDuration : duration));
                const button = slot.querySelector(
                    "[data-actionbar-skill], [data-primary-attack]"
                );
                const countdown = slot.querySelector(
                    ".battle-action-slot__cooldown-time, .primary-attack-card__cooldown"
                );

                slot.style.setProperty("--cooldown-progress", progress.toFixed(4));
                slot.style.setProperty("--cooldown-angle", `${Math.round(progress * 360)}deg`);
                slot.dataset.cooldownRemaining = remaining > 0
                    ? (roundMode ? String(remainingRounds) : (remaining / 1000).toFixed(1))
                    : "0";
                slot.classList.toggle("is-cooldown", remaining > 0);

                if (button) {
                    button.classList.toggle("is-recharging", remaining > 0);
                    button.setAttribute("aria-busy", remaining > 0 ? "true" : "false");
                    if (button.matches("[data-actionbar-skill]")) {
                        button.disabled = remaining > 0;
                        button.setAttribute("aria-disabled", remaining > 0 ? "true" : "false");
                    }
                }

                if (countdown) {
                    countdown.textContent = remaining > 0
                        ? (roundMode ? `${remainingRounds}R` : `${(remaining / 1000).toFixed(1)}s`)
                        : "PRONTO";
                }

                if (remaining > 0) {
                    activeCooldowns += 1;
                    if (!roundMode) realtimeCooldowns += 1;
                }
            });

            if (realtimeCooldowns > 0) {
                this.cooldownAnimationFrame = requestAnimationFrame(() => {
                    this.updateActionBarCooldownVisuals();
                });
            } else {
                this.cooldownAnimationFrame = null;
            }

            return activeCooldowns;
        },

        startActionBarCooldownTicker() {
            this.stopActionBarCooldownTicker();
            return this.updateActionBarCooldownVisuals();
        },

        renderPrimaryAttackBar() {
            const container = getElement(this.selectors.primaryAttacks);
            if (!container || !Aethra.SkillSystem) return false;

            const attacks = Aethra.SkillSystem.getPrimaryAttacks?.() || {};
            container.innerHTML = "";
            const fragment = document.createDocumentFragment();

            ["left", "right"].forEach((slot) => {
                const attack = attacks[slot];
                if (!attack?.skill) return;

                const state = Aethra.BattleSystem?.getPrimaryAttackState?.(slot) || attack;
                const skill = attack.skill;
                const isRight = slot === "right";
                const mouseLabel = isRight ? "RMB" : "LMB";
                const weaponName = state.weapon?.name || (
                    isRight ? "Equipe arma na Mão 2" : "Ataque desarmado"
                );
                const available = state.available !== false;
                const readyAt = Number(state.readyAt ?? attack.nextReadyAt ?? 0);
                const intervalMs = Math.max(250, Number(attack.intervalMs || 1000));
                const remaining = Math.max(0, readyAt - Date.now());

                const hasWeapon = !!state.weapon;
                const displayIcon = hasWeapon ? (skill.icon || (isRight ? "🗡" : "⚔")) : "👊";

                const card = document.createElement("article");
                card.className = [
                    "primary-attack-card",
                    attack.auto ? "is-auto" : "is-manual",
                    available ? "is-available" : "is-unavailable",
                    remaining > 0 ? "is-cooldown" : ""
                ].filter(Boolean).join(" ");
                card.dataset.readyAt = String(readyAt);
                card.dataset.cooldownMs = String(intervalMs);
                card.dataset.primarySlot = slot;
                card.dataset.uiTooltip = "true";
                card.dataset.tooltipKind = "skill";
                card.dataset.skillId = attack.skillId;
                card.tabIndex = 0;

                card.innerHTML = `
                    <button
                        type="button"
                        class="primary-attack-card__button"
                        data-primary-attack="${slot}"
                        aria-label="Usar ${escapeHTML(skill.name)}"
                        aria-busy="${remaining > 0 ? "true" : "false"}"
                        ${available ? "" : "disabled"}
                    >
                        <span class="primary-attack-card__mouse">${mouseLabel}</span>
                        <strong class="primary-attack-card__icon">${escapeHTML(displayIcon)}</strong>
                        <span class="primary-attack-card__copy">
                            <b>${isRight ? "Secundária" : "Principal"}</b>
                            <small>${escapeHTML(weaponName)}</small>
                        </span>
                        <span class="primary-attack-card__interval">1 ação/rodada</span>
                        <span class="primary-attack-card__cooldown">${remaining > 0
                            ? `${(remaining / 1000).toFixed(1)}s`
                            : available ? "PRONTO" : "BLOQUEADO"}</span>
                        <span class="primary-attack-card__wipe" aria-hidden="true"></span>
                    </button>
                    <label class="primary-attack-card__auto" title="Ataque automático">
                        <input type="checkbox" data-primary-auto="${slot}" ${attack.auto ? "checked" : ""} ${available ? "" : "disabled"}>
                        <span><i></i><em>AUTO</em></span>
                    </label>
                `;

                const button = card.querySelector("[data-primary-attack]");
                button?.addEventListener("click", () => {
                    if (!Aethra.GameState.battle?.isFighting) {
                        Aethra.EventBus.emit("BattleLog", {
                            message: "Nenhum combate ativo para usar o ataque primário.",
                            color: "#f1d17a",
                            type: "system"
                        });
                        return;
                    }
                    Aethra.EventBus.emit("PrimaryAttackRequested", { slot });
                });

                if (isRight) {
                    button?.addEventListener("contextmenu", (event) => {
                        event.preventDefault();
                        if (Aethra.GameState.battle?.isFighting) {
                            Aethra.EventBus.emit("PrimaryAttackRequested", { slot: "right" });
                        }
                    });
                }

                card.querySelector("[data-primary-auto]")?.addEventListener("change", (event) => {
                    Aethra.SkillSystem.setPrimaryAuto?.(slot, event.currentTarget.checked);
                    this.renderPrimaryAttackBar();
                });

                fragment.appendChild(card);
            });

            container.appendChild(fragment);

            const enemyCard = getElement(this.selectors.battleEnemyCard);
            if (enemyCard && enemyCard.dataset.primaryMouseBound !== "true") {
                enemyCard.dataset.primaryMouseBound = "true";
                enemyCard.addEventListener("click", (event) => {
                    if (event.target.closest("button, input, label, a")) return;
                    if (!Aethra.GameState.battle?.isFighting) return;
                    Aethra.EventBus.emit("PrimaryAttackRequested", { slot: "left" });
                });
                enemyCard.addEventListener("contextmenu", (event) => {
                    if (event.target.closest("button, input, label, a")) return;
                    event.preventDefault();
                    if (!Aethra.GameState.battle?.isFighting) return;
                    Aethra.EventBus.emit("PrimaryAttackRequested", { slot: "right" });
                });
            }

            Aethra.TooltipManager?.refresh?.();
            return true;
        },

        renderActionBar() {
            const container = getElement(this.selectors.actionBar);
            if (!container || !Aethra.SkillSystem) return false;

            Aethra.SkillSystem.ensureState?.();
            this.renderPrimaryAttackBar();

            const bar = Aethra.SkillSystem.getActiveBar?.() || {
                name: "Barra 1",
                slots: []
            };
            const slots = Array.isArray(bar.slots) ? bar.slots : [];
            const settings =
                Aethra.SkillController?.getSettings?.() || {};
            const ordered =
                Aethra.SkillController?.getOrderedSkills?.() || [];
            const priorityBySkill = new Map(
                ordered.map((entry, index) => [
                    entry.skillId,
                    index + 1
                ])
            );
            const cooldowns = Aethra.GameState.hero?.cooldowns || {};
            const roundCombat = Boolean(Aethra.GameState.battle?.isFighting);
            const now = Date.now();

            this.stopActionBarCooldownTicker();
            container.innerHTML = "";

            const fragment = document.createDocumentFragment();

            slots.forEach((skillId, slotIndex) => {
                const skill = skillId
                    ? Aethra.SkillSystem.getSkill(skillId)
                    : null;
                const setting = skillId ? settings[skillId] : null;
                const wrapper = document.createElement("article");
                const priority = skillId
                    ? priorityBySkill.get(skillId)
                    : null;
                const cost = getSkillCost(skill);
                const readyAt = Number(cooldowns[skillId] || 0);
                const cooldownMs = Math.max(
                    1,
                    getSkillCooldownMs(skill)
                );
                const cooldownRounds = Aethra.SkillSystem?.getCooldownRounds?.(skill) || 0;
                const remainingRounds = roundCombat
                    ? Aethra.SkillSystem?.getCooldownRoundsRemaining?.(skillId) || 0
                    : 0;
                const remaining = roundCombat
                    ? remainingRounds
                    : Math.max(0, readyAt - now);

                wrapper.className = [
                    "battle-action-slot",
                    skill ? "is-filled" : "is-empty",
                    setting?.auto === true ? "is-auto" : "",
                    remaining > 0 ? "is-cooldown" : ""
                ].filter(Boolean).join(" ");
                wrapper.dataset.slotIndex = String(slotIndex);

                if (!skill) {
                    wrapper.innerHTML = `
                        <button
                            type="button"
                            class="battle-action-slot__skill"
                            data-slot-index="${slotIndex}"
                            data-open-window="skills-view"
                            aria-label="Configurar slot ${slotIndex + 1}"
                            title="Slot vazio · clique para configurar"
                        >
                            <span class="battle-action-slot__key">${slotIndex + 1}</span>
                            <span class="battle-action-slot__empty">+</span>
                            <small>Vazio</small>
                        </button>
                    `;
                    fragment.appendChild(wrapper);
                    return;
                }

                const isHeal = String(
                    skill.type || skill.effect?.type || ""
                ).toLowerCase() === "heal";
                const resourceLabel = cost.resource === "energy"
                    ? "VIGOR"
                    : cost.resource === "mana"
                        ? "MANA"
                        : cost.resource.toUpperCase();
                const baseCooldownSeconds = cooldownMs / 1000;
                const cooldownLabel = cooldownRounds > 0
                    ? `CD ${cooldownRounds} rodada${cooldownRounds === 1 ? "" : "s"}`
                    : baseCooldownSeconds > 0
                        ? `CD ${baseCooldownSeconds.toFixed(1)}s`
                    : "SEM CD";
                const autoEnabled = setting?.auto === true;

                wrapper.dataset.readyAt = String(readyAt);
                wrapper.dataset.cooldownMs = String(cooldownMs);
                wrapper.dataset.cooldownMode = roundCombat ? "rounds" : "time";
                wrapper.dataset.cooldownRounds = String(cooldownRounds);
                wrapper.dataset.uiTooltip = "true";
                wrapper.dataset.tooltipKind = "skill";
                wrapper.dataset.skillId = skillId;
                wrapper.tabIndex = 0;

                wrapper.innerHTML = `
                    <button
                        type="button"
                        class="battle-action-slot__skill"
                        data-actionbar-skill="${escapeHTML(skillId)}"
                        data-skill-id="${escapeHTML(skillId)}"
                        data-slot-index="${slotIndex}"
                        aria-label="Executar ${escapeHTML(skill.name)}"
                        aria-busy="${remaining > 0 ? "true" : "false"}"
                        ${remaining > 0 ? "disabled" : ""}
                    >
                        <span class="battle-action-slot__topline" aria-hidden="true">
                            <span class="battle-action-slot__key">${slotIndex + 1}</span>
                            <span class="battle-action-slot__priority" title="Prioridade de execução">
                                PRIO ${priority || slotIndex + 1}
                            </span>
                        </span>

                        <strong class="battle-action-slot__icon" aria-hidden="true">${escapeHTML(skill.icon || "✦")}</strong>

                        <span class="battle-action-slot__copy">
                            <b class="battle-action-slot__name">${escapeHTML(skill.name)}</b>
                            <span class="battle-action-slot__meta-line">
                                <small class="battle-action-slot__cost">${cost.amount > 0
                                    ? `${formatNumber(cost.amount)} ${escapeHTML(resourceLabel)}`
                                    : "GRÁTIS"}</small>
                                <small class="battle-action-slot__base-cd">${escapeHTML(cooldownLabel)}</small>
                            </span>
                            <small class="battle-action-slot__condition ${isHeal ? "is-visible" : ""}">
                                ${isHeal
                                    ? `CURA EM HP&lt;${formatNumber(setting?.hpThreshold ?? 50)}%`
                                    : ""}
                            </small>
                        </span>

                        <span class="battle-action-slot__cooldown-mask" aria-hidden="true"></span>
                        <span class="battle-action-slot__cooldown-ring" aria-hidden="true"></span>
                        <span class="battle-action-slot__cooldown-time" aria-live="polite">${remaining > 0
                            ? (roundCombat ? `${remainingRounds}R` : `${(remaining / 1000).toFixed(1)}s`)
                            : ""}</span>
                    </button>

                    <div class="battle-action-slot__controls">
                        <button
                            type="button"
                            class="battle-action-slot__priority-control"
                            data-priority-move="up"
                            data-priority-skill="${escapeHTML(skillId)}"
                            aria-label="Mover ${escapeHTML(skill.name)} para uma prioridade anterior"
                            title="Prioridade anterior"
                            ${priority === 1 ? "disabled" : ""}
                        >◀</button>

                        <label
                            class="battle-action-slot__auto-toggle"
                            aria-label="Alternar execução automática de ${escapeHTML(skill.name)}"
                            title="${autoEnabled ? "Automático ligado" : "Execução manual"}"
                        >
                            <input
                                type="checkbox"
                                data-auto-skill="${escapeHTML(skillId)}"
                                ${autoEnabled ? "checked" : ""}
                            >
                            <span><i></i><em>AUTO</em></span>
                        </label>

                        <button
                            type="button"
                            class="battle-action-slot__priority-control"
                            data-priority-move="down"
                            data-priority-skill="${escapeHTML(skillId)}"
                            aria-label="Mover ${escapeHTML(skill.name)} para uma prioridade posterior"
                            title="Prioridade posterior"
                            ${priority === ordered.length ? "disabled" : ""}
                        >▶</button>
                    </div>
                `;

                wrapper
                    .querySelector("[data-actionbar-skill]")
                    ?.addEventListener("click", () => {
                        const battle = Aethra.GameState.battle || {};
                        const target = isHeal
                            ? Aethra.GameState.hero
                            : battle.creature || null;

                        if (!battle.isFighting) {
                            Aethra.EventBus.emit("BattleLog", {
                                message: "Nenhum combate ativo para executar a skill.",
                                color: "#f1d17a",
                                type: "system"
                            });
                            return;
                        }

                        if (
                            Aethra.SkillSystem?.isOnCooldown?.(skillId)
                        ) {
                            return;
                        }

                        Aethra.SkillController?.queueManualSkill?.(
                            skillId,
                            target
                        );
                    });

                wrapper
                    .querySelector("[data-auto-skill]")
                    ?.addEventListener("change", (event) => {
                        Aethra.SkillController?.setAuto?.(
                            skillId,
                            event.currentTarget.checked
                        );

                        this.renderActionBar();
                    });

                wrapper
                    .querySelectorAll("[data-priority-move]")
                    .forEach((button) => {
                        button.addEventListener("click", () => {
                            const moved =
                                Aethra.SkillController?.moveSkill?.(
                                    skillId,
                                    button.dataset.priorityMove
                                );

                            if (moved) {
                                this.renderActionBar();
                            }
                        });
                    });

                fragment.appendChild(wrapper);
            });

            container.appendChild(fragment);
            Aethra.UIManager?.updateSkillUI?.(container);
            Aethra.TooltipManager?.refresh?.();
            this.startActionBarCooldownTicker();

            Aethra.EventBus.emit("render:action-bar", {
                barId: bar.id || null,
                barName: bar.name || null,
                slotCount: slots.length,
                activeSkills: ordered.length
            });

            return true;
        },

        renderBattleInventorySelection(item) {
            const selected = document.getElementById("battle-inventory-selected");
            if (!selected) return false;

            selected.classList.add("is-tooltip-driven");

            if (!item) {
                selected.innerHTML = `
                    <span>Passe o mouse sobre um item para ver os detalhes. Clique para selecionar e duplo clique para equipar.</span>
                `;
                return true;
            }

            const rarity = Aethra.GameData?.getRarityPresentation?.(item) || {
                color: "#c7c7c7",
                name: item.rarity || "Comum"
            };
            selected.style.setProperty("--battle-item-color", rarity.color);
            selected.innerHTML = `
                <span><b>${escapeHTML(item.name || item.templateId || "Item")}</b> selecionado. Passe o mouse para inspecionar ou clique em <em>Ver detalhes</em> no modal da mochila.</span>
            `;
            return true;
        },

        renderBattleInventory() {
            const container = getElement(this.selectors.battleInventory);
            if (!container) return false;

            const hero = Aethra.GameState.hero || {};
            const bag = Array.isArray(hero.bag) ? hero.bag : [];
            const capacity = Math.max(
                bag.length,
                Number(hero.bagCapacity || 40)
            );
            const count = document.getElementById(
                "battle-inventory-count"
            );
            const selectedId = this.getSelectedInventoryItemId();

            if (count) {
                count.textContent = `${bag.length} / ${capacity}`;
            }

            const backpackTabCount = document.getElementById("hero-backpack-tab-count");
            if (backpackTabCount) {
                backpackTabCount.textContent = `${bag.length}/${capacity}`;
            }

            container.replaceChildren();

            if (bag.length === 0) {
                container.innerHTML = `
                    <div class="battle-inventory-empty">
                        <span aria-hidden="true">◇</span>
                        <strong>Mochila vazia</strong>
                        <small>O loot da próxima caçada aparecerá aqui.</small>
                    </div>
                `;
                this.renderBattleInventorySelection(null);
                return true;
            }

            const fragment = document.createDocumentFragment();

            bag.slice(0, capacity).forEach((item, index) => {
                const button = document.createElement("button");
                const imagePath =
                    Aethra.GameData?.getItemImage?.(item) || "";
                const rarity =
                    Aethra.GameData?.getRarityPresentation?.(item) || {
                        color: "#c7c7c7"
                    };
                const quantity = Math.max(1, Number(item.quantity || 1));

                button.type = "button";
                button.className = [
                    "battle-inventory-slot",
                    item.instanceId === selectedId ? "is-selected" : ""
                ].filter(Boolean).join(" ");
                button.dataset.instanceId = item.instanceId || "";
                button.style.setProperty(
                    "--battle-item-color",
                    rarity.color
                );
                button.title = item.name || item.templateId || "Item";
                button.innerHTML = `
                    <span class="battle-inventory-slot__icon">
                        ${imagePath ? `
                            <img
                                src="${escapeHTML(imagePath)}"
                                alt="${escapeHTML(item.name || "Item")}" 
                                draggable="false"
                            >
                        ` : `
                            <b>${escapeHTML(String(item.name || "?").charAt(0))}</b>
                        `}
                    </span>
                    ${quantity > 1 ? `<strong>${formatNumber(quantity)}</strong>` : ""}
                    <small>${escapeHTML(item.name || item.templateId || `Item ${index + 1}`)}</small>
                `;

                button.addEventListener("click", () => {
                    this.setSelectedInventoryItem(item.instanceId);
                    container
                        .querySelectorAll(".battle-inventory-slot")
                        .forEach((slot) => {
                            slot.classList.toggle(
                                "is-selected",
                                slot.dataset.instanceId === item.instanceId
                            );
                        });
                    this.renderBattleInventorySelection(item);
                    this.renderInventoryDetails(item);
                });

                button.addEventListener("dblclick", () => {
                    if (item.instanceId && item.slot) {
                        Aethra.EquipSystem?.equip?.(
                            item.instanceId,
                            item.slot
                        );
                    }
                });

                Aethra.UIManager?.bindItemTooltip?.(
                    button,
                    item,
                    { source: "battle-inventory" }
                );

                fragment.appendChild(button);
            });

            container.appendChild(fragment);

            const selectedItem = bag.find(
                (item) => item.instanceId === selectedId
            );
            this.renderBattleInventorySelection(selectedItem || null);

            return true;
        },

        renderBattleEquipment() {
            const container = getElement(this.selectors.battleEquipment);
            if (!container) return false;

            const equipment =
                Aethra.GameState.playerEquipment ||
                Aethra.GameState.hero?.equipment ||
                {};
            const slots = [
                ["head", "Cabeça"],
                ["chest", "Peito"],
                ["weapon", "Arma"],
                ["offhand", "Mão 2"],
                ["legs", "Pernas"],
                ["feet", "Pés"]
            ];

            container.innerHTML = slots.map(([slot, label]) => {
                const item = equipment[slot] || null;
                const imagePath = item
                    ? Aethra.GameData?.getItemImage?.(item)
                    : "";
                const rarity = item
                    ? Aethra.GameData?.getRarityPresentation?.(item)
                    : null;
                const inspection = item
                    ? Aethra.ItemSystem?.getItemInspection?.(item)
                    : null;
                const ivPercent = Math.max(
                    0,
                    Math.min(100, Number(inspection?.ivPercent || 0))
                );
                const hardcoreSummary = item
                    ? Aethra.ItemSystem?.getItemHardcoreSummary?.(item)
                    : null;

                return `
                    <button
                        type="button"
                        class="battle-equipment-slot ${item ? "is-filled" : ""}"
                        data-battle-equipment-slot="${escapeHTML(slot)}"
                        style="--battle-item-color:${escapeHTML(rarity?.color || "#494338")};"
                        aria-label="${item ? escapeHTML(hardcoreSummary?.text || item.name) : escapeHTML(`${label}: espaço vazio`)}"
                        ${item ? "" : `
                            tabindex="0"
                            data-ui-tooltip
                            data-tooltip-kind="hud"
                            data-tooltip-eyebrow="SLOT DE EQUIPAMENTO"
                            data-tooltip-title="${escapeHTML(label)}"
                            data-tooltip-body="Este espaço está vazio. Equipe um item compatível pelo inventário rápido ou pela mochila."
                            data-tooltip-hint="Itens equipados transferem seus atributos, multiplicador e IV para a build."
                        `}
                    >
                        <small>${escapeHTML(label)}</small>
                        <span>
                            ${imagePath ? `
                                <img
                                    src="${escapeHTML(imagePath)}"
                                    alt="${escapeHTML(item.name)}"
                                    draggable="false"
                                >
                            ` : "+"}
                        </span>
                        ${item && inspection ? `
                            <b class="battle-equipment-slot__multiplier">
                                ${Number(inspection.multiplier || 1).toFixed(2)}x
                            </b>
                            ${hardcoreSummary?.primaryStat ? `
                                <span class="battle-equipment-slot__primary">
                                    ${Number(hardcoreSummary.primaryBonus) >= 0 ? "+" : ""}${escapeHTML(
                                        Aethra.UIManager?.formatStatValue?.(
                                            hardcoreSummary.primaryStat,
                                            hardcoreSummary.primaryBonus
                                        ) ?? String(hardcoreSummary.primaryBonus)
                                    )} ${escapeHTML(statLabel(hardcoreSummary.primaryStat))}
                                </span>
                            ` : ""}
                            <div class="battle-equipment-slot__iv" aria-label="IV ${ivPercent.toFixed(1)}%">
                                <i><b style="width:${ivPercent.toFixed(1)}%"></b></i>
                                <em>IV ${ivPercent.toFixed(0)}%</em>
                            </div>
                        ` : ""}
                    </button>
                `;
            }).join("");

            const equippedItems = slots
                .map(([slot]) => equipment[slot])
                .filter(Boolean);
            const equipmentTabCount = document.getElementById("hero-equipment-tab-count");
            if (equipmentTabCount) {
                equipmentTabCount.textContent = `${equippedItems.length}/${slots.length}`;
            }

            const buildSummary = document.getElementById("hero-build-summary");
            if (buildSummary) {
                const inspections = equippedItems
                    .map((item) => Aethra.ItemSystem?.getItemInspection?.(item))
                    .filter(Boolean);
                const averageIv = inspections.length > 0
                    ? inspections.reduce((total, entry) => total + Number(entry.ivPercent || 0), 0) / inspections.length
                    : 0;
                const highestMultiplier = inspections.length > 0
                    ? Math.max(...inspections.map((entry) => Number(entry.multiplier || 1)))
                    : 1;
                const totalBonuses = equippedItems.reduce((total, item) => {
                    const breakdown = Aethra.GameData?.getItemStatBreakdown?.(item);
                    return total + Object.values(breakdown?.finalStats || item.stats || {})
                        .reduce((sum, value) => sum + Math.abs(Number(value || 0)), 0);
                }, 0);

                buildSummary.innerHTML = `
                    <span><small>Peças ativas</small><strong>${equippedItems.length}/${slots.length}</strong></span>
                    <span><small>IV médio</small><strong>${averageIv.toFixed(0)}%</strong></span>
                    <span><small>Maior mult.</small><strong>${highestMultiplier.toFixed(2)}x</strong></span>
                    <span><small>Bônus bruto</small><strong>+${formatNumber(Math.round(totalBonuses))}</strong></span>
                `;
            }

            container
                .querySelectorAll("[data-battle-equipment-slot]")
                .forEach((button) => {
                    const slot = button.dataset.battleEquipmentSlot;
                    const item = equipment[slot] || null;

                    button.addEventListener("click", () => {
                        if (item) {
                            Aethra.EquipSystem?.unequip?.(slot);
                        }
                    });

                    if (item) {
                        Aethra.UIManager?.bindItemTooltip?.(
                            button,
                            item,
                            { source: "battle-equipment", slot }
                        );
                    }
                });

            return true;
        },

        renderAll() {
            if (this.getSelectedBattleMode() === "map2d") {
                this.activateMap2DPlaceholder();
                this.renderEngineStatus(
                    Aethra.GameLoader?.initialized ? "Pronta" : "Carregando"
                );
                return true;
            }

            this.activateBattleMode();
            this.renderHeroStats();
            this.renderInventory();
            this.renderEquipment();
            this.renderQuests();
            this.renderHunt();
            this.renderCombat();
            this.renderActionBar();
            this.renderBattleCards();
            this.renderBattleInventory();
            this.renderBattleEquipment();
            this.renderHeroSkillProgression();
            this.syncHeroPanelTabs();
            this.renderBosses();
            this.renderProfessions();
            this.renderEngineStatus(
                Aethra.GameLoader?.initialized ? "Pronta" : "Carregando"
            );

            Aethra.EventBus.emit("render:all-completed", {
                timestamp: Date.now(),
                battleMode: this.battleMode,
                mode: this.viewMode
            });
        },

        getHeroPanelTab() {
            Aethra.GameState.ui = Aethra.GameState.ui || {};
            const allowed = new Set(["overview", "equipment", "backpack", "skills"]);
            let stored = Aethra.GameState.ui.heroPanelTab || null;

            if (!stored) {
                try {
                    stored = localStorage.getItem("aethra.heroPanelTab");
                } catch (error) {
                    stored = null;
                }
            }

            return allowed.has(stored) ? stored : "overview";
        },

        setHeroPanelTab(tab, options = {}) {
            const allowed = new Set(["overview", "equipment", "backpack", "skills"]);
            const next = allowed.has(tab) ? tab : "overview";

            Aethra.GameState.ui = Aethra.GameState.ui || {};
            Aethra.GameState.ui.heroPanelTab = next;

            if (options.persist !== false) {
                try {
                    localStorage.setItem("aethra.heroPanelTab", next);
                } catch (error) {
                    // O painel continua funcional quando o storage estiver indisponível.
                }
            }

            document.querySelectorAll("[data-hero-panel-tab]").forEach((button) => {
                const active = button.dataset.heroPanelTab === next;
                button.classList.toggle("is-active", active);
                button.setAttribute("aria-pressed", active ? "true" : "false");
            });

            document.querySelectorAll("[data-hero-panel-view]").forEach((panel) => {
                const active = panel.dataset.heroPanelView === next;
                panel.hidden = !active;
                panel.classList.toggle("is-active", active);
                panel.setAttribute("aria-hidden", active ? "false" : "true");
            });

            Aethra.EventBus.emit("ui:hero-panel-tab-changed", {
                tab: next,
                source: options.source || "hero-panel"
            });

            return next;
        },

        syncHeroPanelTabs() {
            return this.setHeroPanelTab(this.getHeroPanelTab(), {
                persist: false,
                source: "render-sync"
            });
        },

        renderHeroStats() {
            const hero = Aethra.GameState.hero || {};
            const stats = hero.stats || {};
            const xp = getHeroXP(hero);
            const element = getElement(this.selectors.heroStats);
            const attributesElement = getElement(this.selectors.heroAttributes);

            if (!element) return false;

            const clampValue = (value, min, max) => {
                return Math.min(max, Math.max(min, Number(value || 0)));
            };

            const hpCurrent = Number(hero.hp ?? stats.hp ?? stats.health ?? stats.currentHp ?? 0);
            const hpMax = Math.max(1, Number(hero.maxHp ?? stats.maxHp ?? stats.maxHealth ?? hpCurrent));
            const manaCurrent = Number(hero.mana ?? stats.mana ?? stats.currentMana ?? 0);
            const manaMax = Math.max(1, Number(hero.maxMana ?? stats.maxMana ?? manaCurrent));
            const energyCurrent = Number(hero.energy ?? stats.energy ?? stats.currentEnergy ?? 0);
            const energyMax = Math.max(1, Number((hero.maxEnergy ?? stats.maxEnergy ?? energyCurrent) || 100));
            const xpMax = Math.max(1, xp.next);
            const xpCurrent = Math.min(Math.max(0, xp.current), xpMax);
            const xpRemaining = Math.max(0, xpMax - xpCurrent);
            const xpPercentValue = clampValue((xpCurrent / xpMax) * 100, 0, 100);

            const hpPercent = clampValue((hpCurrent / hpMax) * 100, 0, 100);
            const manaPercent = clampValue((manaCurrent / manaMax) * 100, 0, 100);
            const energyPercent = clampValue((energyCurrent / energyMax) * 100, 0, 100);

            const strength = Number(stats.str || 0);
            const magic = Number(stats.mag || 0);
            const precision = Number(stats.precision || 0);
            const defense = Math.max(0, Number(stats.defense || 0));
            const criticalChance = clampValue(Number(stats.critical || 0), 0, 0.75);
            const criticalMultiplier = Math.max(1, Number(stats.criticalMultiplier ?? stats.critMultiplier ?? 1.75));
            const evasionRaw = Number(stats.evasion || 0);
            const evasionChance = clampValue(evasionRaw <= 1 ? evasionRaw : evasionRaw * 0.005, 0, 0.75);
            const damageMin = Math.max(0, Number(stats.damageMin ?? stats.damage ?? strength));
            const damageMax = Math.max(damageMin, Number(stats.damageMax ?? stats.damage ?? damageMin));
            const precisionHitChance = clampValue(0.85 + precision * 0.01, 0.10, 0.98);
            const defenseReduction = clampValue(defense / (defense + 100), 0, 0.90);
            const healSkill = Aethra.SkillSystem?.getSkill?.("heal") || {};
            const healEffect = healSkill.effect || {};
            const healBase = Math.max(0, Number(healEffect.baseAmount || 0));
            const healScaling = Math.max(0, Number(healEffect.magicScaling || 0));
            const projectedHeal = Math.max(0, Math.round((healBase + magic * healScaling) * Number(healSkill.masteryMultiplier || 1)));

            const activeHunt = Aethra.GameState.hunt || {};
            const huntDefinition = Aethra.HuntSystem?.hunts?.[activeHunt.huntId] || null;
            const primaryView = Aethra.UIManager?.primaryView || Aethra.GameState.ui?.primaryView || "hunt";
            const locationName = primaryView === "city"
                ? "Vila de Aethra"
                : huntDefinition?.name || (activeHunt.isActive ? "Área de caçada" : "Acampamento de Hunt");
            const locationStatus = activeHunt.isActive
                ? (huntDefinition?.focus?.name ? `Foco: ${huntDefinition.focus.name}` : "Caçada ativa")
                : primaryView === "city"
                    ? "Zona segura"
                    : "Preparando caçada";

            const statCards = [
                {
                    key: "strength",
                    icon: "⚔",
                    label: "Força",
                    value: formatNumber(strength),
                    impact: `Dano ${formatNumber(damageMin)}–${formatNumber(damageMax)}`,
                    body: "É a base ofensiva física do herói e aumenta ataques que escalam com poder físico.",
                    effect: `Sua faixa física atual é ${formatNumber(damageMin)}–${formatNumber(damageMax)} antes de crítico e defesa inimiga.`,
                    formula: "Dano final = base × multiplicador do item × IV + afixos"
                },
                {
                    key: "magic",
                    icon: "✦",
                    label: "Magia",
                    value: formatNumber(magic),
                    impact: projectedHeal > 0 ? `Cura ${formatNumber(projectedHeal)} HP` : "Escala mágica",
                    body: "Amplifica curas e habilidades que usam escala de Magia.",
                    effect: projectedHeal > 0 ? `A Cura atual recupera aproximadamente ${formatNumber(projectedHeal)} HP com sua maestria.` : "Nenhuma habilidade com escala mágica está disponível.",
                    formula: healScaling > 0 ? `${formatNumber(healBase)} + MAG × ${healScaling.toFixed(2)} × maestria` : "Resultado definido pela habilidade"
                },
                {
                    key: "precision",
                    icon: "◎",
                    label: "Precisão",
                    value: formatNumber(precision),
                    impact: `Acerto ${precisePercent(precisionHitChance)}`,
                    body: "Aumenta a chance de acertar e compensa parte da esquiva do alvo.",
                    effect: `Contra um alvo sem esquiva, sua chance estimada de acerto é ${precisePercent(precisionHitChance)}.`,
                    formula: "Acerto = 85% + Precisão × 1% − Esquiva do alvo"
                },
                {
                    key: "defense",
                    icon: "⬡",
                    label: "Defesa",
                    value: formatNumber(defense),
                    impact: `Mitig. ${precisePercent(defenseReduction)}`,
                    body: "Diminui o dano recebido antes de bloqueios e outros efeitos defensivos.",
                    effect: `${formatNumber(defense)} DEF representa cerca de ${precisePercent(defenseReduction)} de mitigação estimada.`,
                    formula: "Mitigação = DEF ÷ (DEF + 100)"
                },
                {
                    key: "critical",
                    icon: "✹",
                    label: "Crítico",
                    value: precisePercent(criticalChance),
                    impact: `Dano ${criticalMultiplier.toFixed(2)}x`,
                    body: "Define a chance de transformar um ataque elegível em dano multiplicado.",
                    effect: `${precisePercent(criticalChance)} dos ataques podem causar ${criticalMultiplier.toFixed(2)}x de dano.`,
                    formula: "Dano crítico = dano pré-armadura × multiplicador crítico"
                },
                {
                    key: "evasion",
                    icon: "◇",
                    label: "Esquiva",
                    value: precisePercent(evasionChance),
                    impact: `Evita ${precisePercent(evasionChance)}`,
                    body: "Chance de anular completamente um ataque antes do cálculo de dano.",
                    effect: evasionChance > 0 ? `A cada 100 ataques, cerca de ${(evasionChance * 100).toFixed(0)} podem ser evitados.` : "Nenhuma esquiva está ativa no momento.",
                    formula: "O teste de esquiva acontece antes da mitigação"
                }
            ];

            element.innerHTML = `
                <section class="hero-summary-card">
                    <header class="hero-summary-card__identity">
                        <span class="hero-summary-card__avatar" aria-hidden="true">${escapeHTML(String(hero.name || "A").charAt(0))}</span>
                        <div class="hero-summary-card__name">
                            <strong>${escapeHTML(hero.name || "Aethra")}</strong>
                            <span>Nível ${getHeroLevel(hero)} · Build ativa</span>
                        </div>
                        <span class="hero-summary-card__gold" tabindex="0" data-ui-tooltip data-tooltip-kind="hud" data-tooltip-title="Gold disponível" data-tooltip-body="Moeda usada em lojas, mercado e melhorias." data-tooltip-value="${escapeHTML(formatNumber(hero.gold))} G">${formatNumber(hero.gold)} G</span>
                    </header>

                    <div class="hero-summary-card__context">
                        <span tabindex="0" data-ui-tooltip data-tooltip-kind="hud" data-tooltip-eyebrow="LOCAL ATUAL" data-tooltip-title="${escapeHTML(locationName)}" data-tooltip-body="O local atual determina quais inimigos, recompensas e serviços estão disponíveis.">
                            <i aria-hidden="true">⌖</i>
                            <b>${escapeHTML(locationName)}</b>
                            <small>${escapeHTML(locationStatus)}</small>
                        </span>
                        <span tabindex="0" data-ui-tooltip data-tooltip-kind="resource" data-tooltip-eyebrow="RITMO DE COMBATE" data-tooltip-title="Vigor" data-tooltip-value="${formatNumber(energyCurrent)} / ${formatNumber(energyMax)}" data-tooltip-body="Consumido por golpes físicos e posturas. Regenera conforme as regras do combate.">
                            <i aria-hidden="true">⚡</i>
                            <b>Vigor ${formatNumber(energyCurrent)}/${formatNumber(energyMax)}</b>
                            <small>${energyPercent.toFixed(0)}% disponível</small>
                        </span>
                    </div>

                    <div class="hero-summary-card__resources">
                        <article class="hero-resource hero-resource--hp ${hpPercent <= 30 ? "is-danger" : ""}" tabindex="0" data-ui-tooltip data-tooltip-kind="resource" data-tooltip-title="Vida" data-tooltip-value="${formatNumber(hpCurrent)} / ${formatNumber(hpMax)}" data-tooltip-body="Ao chegar a zero, o combate termina." data-tooltip-effect="${hpPercent.toFixed(0)}% disponível.">
                            <header><span>Vida</span><strong>${formatNumber(hpCurrent)} / ${formatNumber(hpMax)}</strong></header>
                            <progress max="${hpMax}" value="${Math.min(hpCurrent, hpMax)}"></progress>
                        </article>
                        <article class="hero-resource hero-resource--mana ${manaPercent <= 25 ? "is-low" : ""}" tabindex="0" data-ui-tooltip data-tooltip-kind="resource" data-tooltip-title="Mana" data-tooltip-value="${formatNumber(manaCurrent)} / ${formatNumber(manaMax)}" data-tooltip-body="Consumida por curas e habilidades mágicas." data-tooltip-effect="${manaPercent.toFixed(0)}% disponível.">
                            <header><span>Mana</span><strong>${formatNumber(manaCurrent)} / ${formatNumber(manaMax)}</strong></header>
                            <progress max="${manaMax}" value="${Math.min(manaCurrent, manaMax)}"></progress>
                        </article>
                        <article class="hero-resource hero-resource--energy" tabindex="0" data-ui-tooltip data-tooltip-kind="resource" data-tooltip-title="Vigor" data-tooltip-value="${formatNumber(energyCurrent)} / ${formatNumber(energyMax)}" data-tooltip-body="Usado por ataques físicos e habilidades defensivas." data-tooltip-effect="${energyPercent.toFixed(0)}% disponível.">
                            <header><span>Vigor</span><strong>${formatNumber(energyCurrent)} / ${formatNumber(energyMax)}</strong></header>
                            <progress max="${energyMax}" value="${Math.min(energyCurrent, energyMax)}"></progress>
                        </article>
                        <article class="hero-resource hero-resource--xp" tabindex="0" data-ui-tooltip data-tooltip-kind="resource" data-tooltip-title="Experiência do herói" data-tooltip-value="${formatNumber(xpCurrent)} / ${formatNumber(xpMax)} XP" data-tooltip-body="Preencha a barra para avançar de nível e desbloquear crescimento permanente." data-tooltip-effect="Faltam ${formatNumber(xpRemaining)} XP para o próximo nível.">
                            <header><span>XP do herói</span><strong>${formatNumber(xpCurrent)} / ${formatNumber(xpMax)} <em>${xpPercentValue.toFixed(0)}%</em></strong></header>
                            <progress max="${xpMax}" value="${xpCurrent}"></progress>
                        </article>
                    </div>
                </section>
            `;

            if (attributesElement) {
                attributesElement.innerHTML = statCards.map((card) => `
                    <article class="hero-attribute hero-attribute--${escapeHTML(card.key)}" tabindex="0" data-ui-tooltip data-tooltip-kind="stat" data-tooltip-title="${escapeHTML(card.label)}" data-tooltip-value="${escapeHTML(card.value)}" data-tooltip-body="${escapeHTML(card.body)}" data-tooltip-effect="${escapeHTML(card.effect)}" data-tooltip-formula="${escapeHTML(card.formula)}">
                        <span class="hero-attribute__icon" aria-hidden="true">${card.icon}</span>
                        <span class="hero-attribute__copy">
                            <small>${escapeHTML(card.label)}</small>
                            <strong>${escapeHTML(card.value)}</strong>
                            <em>${escapeHTML(card.impact)}</em>
                        </span>
                        <i class="hero-attribute__info" aria-hidden="true">i</i>
                    </article>
                `).join("");
            }

            Aethra.TooltipManager?.refresh?.();

            Aethra.EventBus.emit("render:hero-stats", {
                hero: clone(hero),
                location: locationName,
                vigor: { current: energyCurrent, max: energyMax }
            });

            this.renderBattleCards();
            this.renderActionBar();
            return true;
        },

        renderHeroSkillProgression() {
            const container = getElement(this.selectors.heroSkills);
            if (!container || !Aethra.SkillSystem) return false;

            const skills = Aethra.SkillSystem.getSkills?.() || {};
            const activeBar = Aethra.SkillSystem.getActiveBar?.() || { slots: [] };
            const orderedIds = [...new Set([
                ...(activeBar.slots || []).filter(Boolean),
                ...Object.keys(skills)
            ])];
            const hero = Aethra.GameState.hero || {};
            const stats = hero.stats || {};
            const settings = Aethra.SkillController?.getSettings?.() || {};
            const damageMin = Math.max(1, Number(stats.damageMin ?? stats.damage ?? stats.str ?? 1));
            const damageMax = Math.max(damageMin, Number(stats.damageMax ?? stats.damage ?? damageMin));
            const magic = Math.max(0, Number(stats.mag || 0));

            const typePresentation = (skill) => {
                const type = String(skill.type || skill.effect?.type || "utility").toLowerCase();
                if (type === "damage") return { label: "Ofensiva", className: "is-offense" };
                if (type === "heal") return { label: "Suporte", className: "is-support" };
                if (type === "buff") return { label: "Defensiva", className: "is-defense" };
                return { label: "Utilidade", className: "is-utility" };
            };

            const effectText = (skill, masteryMultiplier) => {
                const effect = skill.effect || {};
                const type = String(skill.type || effect.type || "utility").toLowerCase();

                if (type === "damage") {
                    const multiplier = Math.max(0.01, Number(effect.damageMultiplier || 1) * masteryMultiplier);
                    return `${formatNumber(Math.round(damageMin * multiplier))}–${formatNumber(Math.round(damageMax * multiplier))} dano · ${multiplier.toFixed(2)}x`;
                }

                if (type === "heal") {
                    const amount = Math.max(1, Math.round((Number(effect.baseAmount || 0) + magic * Number(effect.magicScaling || 0)) * masteryMultiplier));
                    return `Cura estimada: ${formatNumber(amount)} HP`;
                }

                if (type === "buff") {
                    const duration = Math.max(0, Number(effect.duration || 0) / 1000);
                    return `+${formatNumber(effect.amount || 0)} ${statLabel(effect.stat || "defense")} · ${duration.toFixed(0)}s`;
                }

                return skill.description || "Efeito utilitário";
            };

            const rows = orderedIds.map((skillId) => {
                const skill = skills[skillId] || Aethra.SkillSystem.getSkill?.(skillId);
                if (!skill) return "";

                const progression = Aethra.SkillSystem.getSkillProgression?.(skillId) || {
                    level: 1,
                    xpCurrent: 0,
                    xpNext: 36,
                    xpTotal: 0,
                    uses: 0,
                    progressPercent: 0,
                    powerMultiplier: 1
                };
                const type = typePresentation(skill);
                const setting = settings[skillId] || {};
                const nextBonus = progression.level < 50 ? "+2,5% de potência" : "Maestria máxima";
                const effect = effectText(skill, Number(progression.powerMultiplier || 1));
                const cost = getSkillCost(skill);
                const costText = cost.amount > 0 ? `${formatNumber(cost.amount)} ${cost.resource === "energy" ? "Vigor" : "Mana"}` : "Sem custo";

                return `
                    <article class="hero-skill-row ${type.className}" tabindex="0" data-ui-tooltip data-tooltip-kind="hud" data-tooltip-eyebrow="MAESTRIA DE HABILIDADE" data-tooltip-title="${escapeHTML(skill.name)}" data-tooltip-value="Nível ${progression.level}" data-tooltip-body="${escapeHTML(skill.description || effect)}" data-tooltip-effect="${escapeHTML(effect)}" data-tooltip-formula="Cada nível concede +2,5% de potência. Próximo ganho: ${escapeHTML(nextBonus)}.">
                        <span class="hero-skill-row__icon" aria-hidden="true">${escapeHTML(skill.icon || "✦")}</span>
                        <div class="hero-skill-row__main">
                            <header>
                                <strong>${escapeHTML(skill.name)}</strong>
                                <span>Lv. ${progression.level}</span>
                            </header>
                            <small>${escapeHTML(type.label)} · ${escapeHTML(effect)}</small>
                            <div class="hero-skill-row__progress">
                                <i><b style="width:${Math.max(0, Math.min(100, Number(progression.progressPercent || 0))).toFixed(2)}%"></b></i>
                                <em>${formatNumber(progression.xpCurrent)} / ${formatNumber(progression.xpNext)} XP</em>
                            </div>
                        </div>
                        <div class="hero-skill-row__meta">
                            <b>${setting.auto === true ? "AUTO" : "MANUAL"}</b>
                            <small>${escapeHTML(costText)}</small>
                            <em>${escapeHTML(nextBonus)}</em>
                        </div>
                    </article>
                `;
            }).join("");

            const progressionEntries = orderedIds
                .map((skillId) => Aethra.SkillSystem.getSkillProgression?.(skillId))
                .filter(Boolean);
            const totalLevels = progressionEntries.reduce((total, entry) => total + Number(entry.level || 1), 0);
            const totalUses = progressionEntries.reduce((total, entry) => total + Number(entry.uses || 0), 0);
            const strongest = orderedIds
                .map((skillId) => ({ skill: skills[skillId], progression: Aethra.SkillSystem.getSkillProgression?.(skillId) }))
                .filter((entry) => entry.skill && entry.progression)
                .sort((a, b) => Number(b.progression.level || 1) - Number(a.progression.level || 1) || Number(b.progression.xpTotal || 0) - Number(a.progression.xpTotal || 0))[0];

            container.innerHTML = `
                <div class="hero-skill-summary">
                    <span><small>Níveis de maestria</small><strong>${formatNumber(totalLevels)}</strong></span>
                    <span><small>Usos registrados</small><strong>${formatNumber(totalUses)}</strong></span>
                    <span><small>Skill destaque</small><strong>${escapeHTML(strongest?.skill?.name || "Nenhuma")}</strong></span>
                </div>
                <div class="hero-skill-list">${rows || '<div class="aethra-empty">Nenhuma habilidade aprendida.</div>'}</div>
            `;

            const counter = document.getElementById("hero-skills-tab-count");
            if (counter) counter.textContent = String(orderedIds.length);

            Aethra.TooltipManager?.refresh?.();
            Aethra.EventBus.emit("render:hero-skill-progression", {
                skillCount: orderedIds.length,
                totalLevels,
                totalUses
            });
            return true;
        },
        getSelectedInventoryItemId() {
            Aethra.GameState.ui = Aethra.GameState.ui || {};
            return Aethra.GameState.ui.selectedInventoryItemId || null;
        },

        setSelectedInventoryItem(instanceId) {
            Aethra.GameState.ui = Aethra.GameState.ui || {};
            Aethra.GameState.ui.selectedInventoryItemId =
                instanceId || null;
        },

        renderInventoryDetails(item) {
            const selectedElement =
                document.getElementById("inventory-selected");

            if (!selectedElement) return false;

            if (!item) {
                selectedElement.innerHTML = `
                    <span>Nenhum item selecionado.</span>
                `;
                return true;
            }

            const template =
                Aethra.GameData?.items?.[item.templateId] || {};
            const breakdown =
                Aethra.GameData?.getItemStatBreakdown?.(item) || {
                    baseStats: {},
                    finalStats: item.stats || {},
                    bonuses: {},
                    multiplier: item.statMultiplier || 1,
                    individualMultipliers:
                        item.individualMultipliers || {},
                    scaledStats: item.stats || {},
                    affixBonuses: {}
                };
            const rarity =
                Aethra.GameData?.getRarityPresentation?.(item) || {
                    color: "#c7c7c7",
                    name: item.rarity || "Comum"
                };

            const statRows = Object.keys({
                ...breakdown.baseStats,
                ...breakdown.finalStats
            }).map((stat) => {
                const base = Number(
                    breakdown.baseStats[stat] || 0
                );
                const final = Number(
                    breakdown.finalStats[stat] || 0
                );
                const bonus = Number(
                    breakdown.bonuses[stat] || 0
                );
                const individual = Number(
                    breakdown.individualMultipliers?.[stat] ?? 1
                );
                const affixBonus = Number(
                    breakdown.affixBonuses?.[stat] || 0
                );

                const label =
                    Aethra.UI_Renderer?.getStatLabel?.(stat) ||
                    stat;

                const format = (value) => {
                    return (
                        Aethra.UI_Renderer?.formatStatValue?.(
                            stat,
                            value
                        ) ?? value
                    );
                };

                const formula = [
                    `Base ${format(base)}`,
                    `× ${Number(
                        breakdown.multiplier || 1
                    ).toFixed(2)}x`,
                    Math.abs(individual - 1) > 0.0001
                        ? `× ${individual.toFixed(2)} var.`
                        : "",
                    Math.abs(affixBonus) > 0.0001
                        ? `${affixBonus >= 0 ? "+" : "−"} `
                          + `${format(Math.abs(affixBonus))} afixo`
                        : ""
                ].filter(Boolean).join(" ");

                return `
                    <div class="inventory-selected__stat-row">
                        <span>${escapeHTML(label)}</span>
                        <small>${escapeHTML(format(base))}</small>
                        <em class="${bonus >= 0 ? "is-positive" : "is-negative"}">
                            ${bonus >= 0 ? "+" : ""}${escapeHTML(
                                format(bonus)
                            )}
                        </em>
                        <strong>${escapeHTML(format(final))}</strong>

                        <code class="inventory-selected__formula">
                            ${escapeHTML(
                                `${label}: ${format(final)} (${formula})`
                            )}
                        </code>
                    </div>
                `;
            }).join("");

            selectedElement.style.setProperty(
                "--selected-rarity-color",
                rarity.color
            );

            selectedElement.innerHTML = `
                <header class="inventory-selected__header">
                    <div>
                        <strong>${escapeHTML(
                            item.name || item.baseName || item.templateId
                        )}</strong>
                        <small>${escapeHTML(rarity.name)}</small>
                    </div>

                    <b>${Number(breakdown.multiplier || 1).toFixed(2)}x</b>
                </header>

                <p>${escapeHTML(
                    item.description ||
                    template.description ||
                    "Sem descrição."
                )}</p>

                <div class="inventory-selected__stats-table">
                    ${statRows || "<span>Sem atributos de combate.</span>"}
                </div>
            `;

            return true;
        },

        renderInventory() {
            const hero = Aethra.GameState.hero || {};
            const bag = Array.isArray(hero.bag) ? hero.bag : [];
            const grid = getElement(this.selectors.inventory);
            const countElement =
                document.getElementById("inventory-count");

            this.renderBattleInventory();

            if (!grid) return false;

            const capacity = Math.max(
                bag.length,
                Number(hero.bagCapacity || 40)
            );

            if (countElement) {
                countElement.textContent = `${bag.length} / ${capacity}`;
            }

            const selectedId = this.getSelectedInventoryItemId();
            const selectedItem = bag.find((item) => {
                return item?.instanceId === selectedId;
            }) || null;

            if (selectedId && !selectedItem) {
                this.setSelectedInventoryItem(null);
            }

            this.renderInventoryDetails(selectedItem);
            grid.replaceChildren();

            if (bag.length === 0) {
                grid.innerHTML = `
                    <div class="aethra-empty inventory-empty">
                        A mochila está vazia.
                    </div>
                `;
                return true;
            }

            const fragment = document.createDocumentFragment();

            bag.forEach((item, index) => {
                const card = document.createElement("button");
                const templateId =
                    item.templateId || item.id || "";
                const imagePath =
                    Aethra.GameData?.getItemImage?.(item) || "";
                const quantity = Math.max(
                    1,
                    Number(item.quantity || 1)
                );
                const rarity =
                    Aethra.GameData?.getRarityPresentation?.(item) || {
                        id: item.rarityId || "common",
                        color: "#c7c7c7"
                    };
                const multiplier = Number(
                    item.statMultiplier || item.multiplier || 1
                );

                card.type = "button";
                card.draggable = Boolean(item.instanceId);
                card.className = [
                    "item-card",
                    "tibia-item-slot",
                    `item-card--${escapeHTML(rarity.id)}`,
                    item.instanceId === selectedId
                        ? "is-selected"
                        : ""
                ].filter(Boolean).join(" ");

                card.dataset.instanceId = item.instanceId || "";
                card.dataset.itemIndex = String(index);
                card.setAttribute(
                    "aria-pressed",
                    item.instanceId === selectedId
                        ? "true"
                        : "false"
                );
                card.style.setProperty(
                    "--item-rarity-color",
                    rarity.color
                );

                card.innerHTML = `
                    <span class="tibia-item-slot__icon">
                        ${imagePath
                            ? `
                                <img
                                    src="${escapeHTML(imagePath)}"
                                    alt="${escapeHTML(item.name || templateId || "Item")}" 
                                    class="inventory-item-icon"
                                    draggable="false"
                                >
                            `
                            : `
                                <span class="inventory-item-fallback">
                                    ${escapeHTML(
                                        String(item.name || templateId || "?").charAt(0)
                                    )}
                                </span>
                            `
                        }

                        ${quantity > 1
                            ? `
                                <strong class="inventory-item-quantity">
                                    ${formatNumber(quantity)}
                                </strong>
                            `
                            : ""
                        }

                        ${item.slot
                            ? `
                                <b class="inventory-item-multiplier">
                                    ${multiplier.toFixed(2)}x
                                </b>
                            `
                            : ""
                        }
                    </span>

                    <span class="tibia-item-slot__name">
                        ${escapeHTML(item.name || templateId || "Item")}
                    </span>

                    <span class="tibia-item-slot__meta">
                        ${escapeHTML(item.rarity || "Comum")}
                    </span>
                `;

                card.addEventListener("click", () => {
                    this.setSelectedInventoryItem(item.instanceId);
                    grid.querySelectorAll(".tibia-item-slot").forEach(
                        (entry) => {
                            const active =
                                entry.dataset.instanceId === item.instanceId;
                            entry.classList.toggle("is-selected", active);
                            entry.setAttribute(
                                "aria-pressed",
                                active ? "true" : "false"
                            );
                        }
                    );

                    this.renderInventoryDetails(item);

                    Aethra.EventBus.emit("inventory:item-selected", {
                        instanceId: item.instanceId,
                        item: clone(item),
                        index
                    });
                });

                card.addEventListener("dblclick", () => {
                    if (
                        item.instanceId &&
                        item.slot &&
                        Aethra.EquipSystem?.canEquip?.(
                            item,
                            item.slot
                        )
                    ) {
                        Aethra.EquipSystem.equip(
                            item.instanceId,
                            item.slot
                        );
                    }
                });

                card.addEventListener("dragstart", (event) => {
                    if (!item.instanceId) {
                        event.preventDefault();
                        return;
                    }

                    const payload = JSON.stringify({
                        instanceId: item.instanceId,
                        slot: item.slot || null,
                        templateId
                    });

                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(
                        "application/x-aethra-item",
                        payload
                    );
                    event.dataTransfer.setData(
                        "text/plain",
                        item.instanceId
                    );

                    Aethra.GameState.ui = Aethra.GameState.ui || {};
                    Aethra.GameState.ui.draggedItemInstanceId =
                        item.instanceId;

                    card.classList.add("is-dragging");

                    document
                        .querySelectorAll("[data-equipment-slot]")
                        .forEach((slotElement) => {
                            const slot =
                                slotElement.dataset.equipmentSlot;

                            const allowed =
                                Aethra.EquipSystem?.canEquip?.(
                                    item,
                                    slot
                                ) === true;

                            slotElement.classList.toggle(
                                "is-valid-drop",
                                allowed
                            );

                            slotElement.classList.toggle(
                                "is-invalid-drop",
                                !allowed
                            );
                        });

                    Aethra.EventBus.emit("inventory:drag-started", {
                        item: clone(item),
                        instanceId: item.instanceId
                    });
                });

                card.addEventListener("dragend", () => {
                    card.classList.remove("is-dragging");

                    if (Aethra.GameState.ui) {
                        Aethra.GameState.ui.draggedItemInstanceId = null;
                    }

                    document
                        .querySelectorAll(
                            ".is-drop-target, .is-valid-drop, .is-invalid-drop"
                        )
                        .forEach((element) => {
                            element.classList.remove(
                                "is-drop-target",
                                "is-valid-drop",
                                "is-invalid-drop"
                            );
                        });
                });

                Aethra.UI_Renderer?.bindItemTooltip?.(
                    card,
                    item,
                    { source: "inventory" }
                );

                fragment.appendChild(card);
            });

            grid.appendChild(fragment);

            Aethra.EventBus.emit("render:inventory", {
                count: bag.length,
                capacity
            });

            return true;
        },

        renderEquipment() {
            const equipment =
                Aethra.GameState.playerEquipment &&
                typeof Aethra.GameState.playerEquipment === "object"
                    ? Aethra.GameState.playerEquipment
                    : Aethra.GameState.hero?.equipment &&
                      typeof Aethra.GameState.hero.equipment === "object"
                        ? Aethra.GameState.hero.equipment
                        : {};
            const container = getElement(this.selectors.equipment);

            this.renderBattleEquipment();

            if (!container) return false;

            const slots = [
                { id: "head", label: "Capacete" },
                { id: "chest", label: "Peitoral" },
                { id: "legs", label: "Calça" },
                { id: "feet", label: "Botas" },
                { id: "weapon", label: "Arma" },
                { id: "offhand", label: "Escudo" }
            ];

            container.innerHTML = slots.map(({ id, label }) => {
                const item = equipment[id];
                const imagePath = item
                    ? Aethra.GameData?.getItemImage?.(item)
                    : "";
                const rarity = item
                    ? Aethra.GameData?.getRarityPresentation?.(item)
                    : null;

                return `
                    <button
                        type="button"
                        class="equipment-slot paperdoll-slot paperdoll-slot--${escapeHTML(id)} ${item ? "equipment-slot--filled" : ""}"
                        data-equipment-slot="${escapeHTML(id)}"
                        style="--item-rarity-color: ${escapeHTML(rarity?.color || "#4c4437")};"
                        title="${item ? `Clique para remover ${escapeHTML(item.name)}` : `Solte ${escapeHTML(label)} aqui`}"
                    >
                        <small>${escapeHTML(label)}</small>

                        <span class="paperdoll-slot__icon">
                            ${imagePath
                                ? `
                                    <img
                                        src="${escapeHTML(imagePath)}"
                                        alt="${escapeHTML(item.name)}"
                                        class="equipment-item-icon"
                                        draggable="false"
                                    >
                                `
                                : `
                                    <span class="paperdoll-slot__empty">+</span>
                                `
                            }
                        </span>

                        <strong>${item ? escapeHTML(item.name) : "Vazio"}</strong>
                    </button>
                `;
            }).join("");

            container.querySelectorAll("[data-equipment-slot]").forEach(
                (button) => {
                    const slot = button.dataset.equipmentSlot;
                    const item = equipment[slot] || null;

                    button.addEventListener("click", () => {
                        if (item) {
                            Aethra.EquipSystem?.unequip?.(slot);
                            return;
                        }

                        Aethra.EventBus.emit("equipment:slot-selected", {
                            slot,
                            item: null
                        });
                    });

                    button.addEventListener("dragenter", (event) => {
                        const instanceId =
                            Aethra.GameState.ui?.draggedItemInstanceId;
                        const allowed =
                            Aethra.EquipSystem?.canEquip?.(
                                instanceId,
                                slot
                            ) === true;

                        if (allowed) {
                            event.preventDefault();
                            button.classList.add("is-drop-target");
                        }
                    });

                    button.addEventListener("dragover", (event) => {
                        const instanceId =
                            Aethra.GameState.ui?.draggedItemInstanceId;
                        const allowed =
                            Aethra.EquipSystem?.canEquip?.(
                                instanceId,
                                slot
                            ) === true;

                        if (!allowed) return;

                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        button.classList.add("is-drop-target");
                    });

                    button.addEventListener("dragleave", () => {
                        button.classList.remove("is-drop-target");
                    });

                    button.addEventListener("drop", (event) => {
                        event.preventDefault();
                        button.classList.remove("is-drop-target");

                        let instanceId =
                            Aethra.GameState.ui?.draggedItemInstanceId ||
                            event.dataTransfer.getData("text/plain");

                        try {
                            const data = JSON.parse(
                                event.dataTransfer.getData(
                                    "application/x-aethra-item"
                                ) || "{}"
                            );
                            instanceId = data.instanceId || instanceId;
                        } catch (error) {
                            // Mantém o fallback text/plain.
                        }

                        const allowed =
                            Aethra.EquipSystem?.canEquip?.(
                                instanceId,
                                slot
                            ) === true;

                        if (!allowed) {
                            Aethra.EventBus.emit(
                                "equipment:drop-rejected",
                                {
                                    instanceId,
                                    slot,
                                    reason:
                                        "ITEM_TYPE_SLOT_MISMATCH"
                                }
                            );

                            return;
                        }

                        const equipped =
                            Aethra.EquipSystem?.equip?.(
                                instanceId,
                                slot
                            );

                        if (equipped) {
                            this.setSelectedInventoryItem(null);
                            Aethra.UI_Renderer?.hideTooltip?.();
                        }
                    });

                    if (item) {
                        Aethra.UI_Renderer?.bindItemTooltip?.(
                            button,
                            item,
                            { source: "equipment", slot }
                        );
                    }
                }
            );

            Aethra.EventBus.emit("render:equipment", {
                equipment: clone(equipment)
            });

            return true;
        },

        renderQuests() {
            const questState = normalizeQuestState();
            const container = getElement(this.selectors.quests);

            if (!container) return false;

            const activeHTML = questState.active.length > 0
                ? questState.active
                    .map((quest) => {
                        const objectives = (quest.objectives || [])
                            .map((objective) => {
                                const progress = Math.min(
                                    Number(objective.progress || 0),
                                    Number(objective.required || 1)
                                );

                                const required = Number(
                                    objective.required || 1
                                );

                                return `
                                    <li class="${objective.completed ? "is-complete" : ""}">
                                        <span>
                                            ${escapeHTML(
                                                objective.label ||
                                                objective.target ||
                                                objective.type
                                            )}
                                        </span>
                                        <strong>${progress}/${required}</strong>
                                    </li>
                                `;
                            })
                            .join("");

                        return `
                            <article class="quest-card quest-card--active">
                                <header>
                                    <span>Missão ativa</span>
                                    <h3>${escapeHTML(quest.title)}</h3>
                                </header>

                                <p>${escapeHTML(quest.description || "")}</p>

                                <ul>${objectives}</ul>
                            </article>
                        `;
                    })
                    .join("")
                : `
                    <div class="aethra-empty">
                        Nenhuma missão ativa.
                    </div>
                `;

            const completedHTML = questState.completed.length > 0
                ? `
                    <details class="quest-completed">
                        <summary>
                            Concluídas (${questState.completed.length})
                        </summary>

                        ${questState.completed
                            .map((quest) => {
                                return `
                                    <div class="quest-card quest-card--completed">
                                        ${escapeHTML(quest.title)}
                                    </div>
                                `;
                            })
                            .join("")}
                    </details>
                `
                : "";

            container.innerHTML = activeHTML + completedHTML;

            Aethra.EventBus.emit("render:quests", {
                active: questState.active.length,
                completed: questState.completed.length
            });

            return true;
        },

        renderHunt() {
            const hunt = Aethra.GameState.hunt || {};
            const container = getElement(this.selectors.hunt);

            if (!container) return false;

            const definition = Aethra.HuntSystem?.hunts?.[hunt.huntId] || {};
            const elapsedMs = Math.max(0, Number(hunt.elapsedMs || 0));
            const elapsedSeconds = elapsedMs / 1000;
            const elapsedHours = elapsedMs / 3600000;
            const kills = Math.max(0, Number(hunt.kills || 0));
            const xp = Math.max(0, Number(hunt.xp || 0));
            const gold = Math.max(0, Number(hunt.gold || 0));
            const lootValue = Math.max(0, Number(hunt.lootValue || 0));
            const supplyCost = Math.max(0, Number(hunt.supplyCost || 0));
            const profit = gold + lootValue - supplyCost;
            const xpPerHour = elapsedHours > 0 ? xp / elapsedHours : 0;
            const profitPerHour = elapsedHours > 0 ? profit / elapsedHours : 0;
            const averageKillSeconds = kills > 0 ? elapsedSeconds / kills : 0;
            const running = Boolean(
                hunt.isActive ||
                Aethra.HuntSystem?.config?.isRunning
            );

            container.innerHTML = `
                <section class="hunt-analyzer" aria-label="Hunt Analyzer">
                    <header class="hunt-analyzer__session">
                        <div>
                            <span class="hunt-analyzer__status ${running ? "is-running" : ""}">
                                ${running ? "Sessão ativa" : "Sessão parada"}
                            </span>
                            <strong>${escapeHTML(definition.name || hunt.huntId || "Sem caçada")}</strong>
                        </div>
                        <time>${formatDuration(elapsedSeconds)}</time>
                    </header>

                    <div class="hunt-analyzer__grid">
                        <article
                            class="hunt-analyzer__metric hunt-analyzer__metric--xp"
                            tabindex="0"
                            data-ui-tooltip
                            data-tooltip-kind="metric"
                            data-tooltip-eyebrow="PROGRESSÃO"
                            data-tooltip-title="Experiência da sessão"
                            data-tooltip-value="${escapeHTML(`${formatNumber(xp)} XP`)}"
                            data-tooltip-body="Soma toda a experiência obtida desde o início ou último reset do Analyzer."
                            data-tooltip-formula="XP/h = XP total ÷ duração da sessão em horas"
                            data-tooltip-hint="Use XP/h para comparar a eficiência de diferentes hunts."
                        >
                            <span class="hunt-analyzer__metric-icon" aria-hidden="true">✦</span>
                            <small>XP Total</small>
                            <strong>${formatNumber(xp)}</strong>
                            <span>${formatNumber(Math.floor(xpPerHour))} XP/h</span>
                        </article>

                        <article
                            class="hunt-analyzer__metric hunt-analyzer__metric--profit"
                            tabindex="0"
                            data-ui-tooltip
                            data-tooltip-kind="metric"
                            data-tooltip-eyebrow="ECONOMIA"
                            data-tooltip-title="Gold e lucro por hora"
                            data-tooltip-value="${escapeHTML(`${formatNumber(gold)} Gold`)}"
                            data-tooltip-body="Gold coletado mostra apenas moeda direta. Profit/h considera Gold, loot e custos da sessão."
                            data-tooltip-formula="Profit/h = (Gold + loot − suprimentos) ÷ horas"
                        >
                            <span class="hunt-analyzer__metric-icon" aria-hidden="true">●</span>
                            <small>Gold coletado</small>
                            <strong>${formatNumber(gold)}</strong>
                            <span>${formatNumber(Math.floor(profitPerHour))} Profit/h</span>
                        </article>

                        <article
                            class="hunt-analyzer__metric hunt-analyzer__metric--kills"
                            tabindex="0"
                            data-ui-tooltip
                            data-tooltip-kind="metric"
                            data-tooltip-eyebrow="RITMO DE COMBATE"
                            data-tooltip-title="Kills e tempo médio"
                            data-tooltip-value="${escapeHTML(`${formatNumber(kills)} kills`)}"
                            data-tooltip-body="Conta inimigos derrotados e mede quanto tempo, em média, cada abate consumiu."
                            data-tooltip-formula="Tempo médio = duração total ÷ kills"
                        >
                            <span class="hunt-analyzer__metric-icon" aria-hidden="true">☠</span>
                            <small>Kills totais</small>
                            <strong>${formatNumber(kills)}</strong>
                            <span>${formatDuration(averageKillSeconds)} / kill</span>
                        </article>

                        <article
                            class="hunt-analyzer__metric"
                            tabindex="0"
                            data-ui-tooltip
                            data-tooltip-kind="metric"
                            data-tooltip-eyebrow="LOOT"
                            data-tooltip-title="Valor estimado do loot"
                            data-tooltip-value="${escapeHTML(formatNumber(lootValue))}"
                            data-tooltip-body="Soma o valor econômico estimado dos itens encontrados, mesmo antes de serem vendidos."
                            data-tooltip-hint="O valor pode diferir do preço real obtido no mercado."
                        >
                            <span class="hunt-analyzer__metric-icon" aria-hidden="true">◆</span>
                            <small>Valor do loot</small>
                            <strong>${formatNumber(lootValue)}</strong>
                            <span>${formatNumber(Number(hunt.lootCount || 0))} itens</span>
                        </article>

                        <article
                            class="hunt-analyzer__metric"
                            tabindex="0"
                            data-ui-tooltip
                            data-tooltip-kind="metric"
                            data-tooltip-eyebrow="CUSTO OPERACIONAL"
                            data-tooltip-title="Suprimentos consumidos"
                            data-tooltip-value="${escapeHTML(formatNumber(supplyCost))}"
                            data-tooltip-body="Registra gastos atribuídos à sessão, como consumíveis e outros recursos contabilizados pelo sistema."
                            data-tooltip-hint="Custos maiores reduzem o lucro líquido e o Profit/h."
                        >
                            <span class="hunt-analyzer__metric-icon" aria-hidden="true">▣</span>
                            <small>Suprimentos</small>
                            <strong>${formatNumber(supplyCost)}</strong>
                            <span>Custo da sessão</span>
                        </article>

                        <article
                            class="hunt-analyzer__metric hunt-analyzer__metric--balance ${profit < 0 ? "is-negative" : ""}"
                            tabindex="0"
                            data-ui-tooltip
                            data-tooltip-kind="metric"
                            data-tooltip-eyebrow="RESULTADO LÍQUIDO"
                            data-tooltip-title="Lucro da sessão"
                            data-tooltip-value="${escapeHTML(formatNumber(profit))}"
                            data-tooltip-body="Resultado econômico real estimado da hunt depois de somar recompensas e descontar custos."
                            data-tooltip-formula="Lucro = Gold + valor do loot − suprimentos"
                        >
                            <span class="hunt-analyzer__metric-icon" aria-hidden="true">↗</span>
                            <small>Lucro líquido</small>
                            <strong>${formatNumber(profit)}</strong>
                            <span>Gold + loot − custos</span>
                        </article>
                    </div>

                    <button
                        type="button"
                        class="hunt-analyzer__reset"
                        data-reset-hunt-analyzer
                        data-ui-tooltip
                        data-tooltip-kind="hud"
                        data-tooltip-eyebrow="NOVA MEDIÇÃO"
                        data-tooltip-title="Resetar Analyzer"
                        data-tooltip-body="Zera apenas as métricas locais da sessão. Não remove Gold, XP ou itens já recebidos pelo herói."
                    >
                        Resetar Estatísticas
                    </button>
                </section>
            `;

            Aethra.EventBus.emit("render:hunt", {
                hunt: clone(hunt),
                analyzer: {
                    elapsedMs,
                    xpPerHour,
                    profitPerHour,
                    averageKillSeconds,
                    profit
                }
            });

            return true;
        },

        renderCombat() {
            const combat = Aethra.GameState.combat || {};
            const container = getElement(this.selectors.combat);

            if (!container) return false;

            if (!combat.isActive && !combat.enemy && !combat.lastEnemy) {
                container.innerHTML = `
                    <div class="aethra-empty">
                        Nenhum combate ativo.
                    </div>
                `;
                this.renderBattleCards();
                this.renderActionBar();
                return true;
            }

            const enemy = combat.enemy || combat.lastEnemy || {};
            const enemyHp = Number(enemy.hp || 0);
            const enemyMaxHp = Number(enemy.maxHp || enemyHp || 1);
            const readableMessage =
                Aethra.UI_Renderer?.getCombatMessage?.(
                    combat.lastResult,
                    enemy
                ) ||
                combat.lastMessage ||
                combat.lastResult?.message ||
                "Aguardando ação...";

            const messageColor = safeColor(
                combat.lastMessageColor ||
                combat.lastResult?.logColor ||
                combat.lastResult?.color,
                ""
            );

            const recentLogs = Array.isArray(combat.logs)
                ? combat.logs.slice(-12)
                : [];

            container.innerHTML = `
                <section class="aethra-combat">
                    <header>
                        <div>
                            <span>Combate</span>
                            <h3>${escapeHTML(enemy.name || enemy.id || "Inimigo")}</h3>
                        </div>

                        <strong>Rodada ${formatNumber(combat.round)}</strong>
                    </header>

                    <div class="aethra-resource">
                        <div>
                            <span>Vida do inimigo</span>
                            <strong>${formatNumber(enemyHp)} / ${formatNumber(enemyMaxHp)}</strong>
                        </div>

                        <progress
                            max="${Math.max(1, enemyMaxHp)}"
                            value="${Math.min(enemyHp, enemyMaxHp)}"
                        ></progress>
                    </div>

                    <div
                        class="aethra-combat__last"
                        ${messageColor ? `style="color:${messageColor}"` : ""}
                    >
                        ${escapeHTML(readableMessage)}
                    </div>

                    <div class="aethra-combat__legend" aria-label="Legenda do log">
                        <span><i class="is-damage"></i>Dano</span>
                        <span><i class="is-heal"></i>Cura</span>
                        <span><i class="is-critical"></i>Crítico</span>
                    </div>

                    ${
                        recentLogs.length > 0
                            ? `
                                <div class="aethra-combat__log" aria-label="Log de combate">
                                    ${recentLogs.map((entry) => {
                                        const color = safeColor(
                                            entry.color,
                                            ""
                                        );

                                        return `
                                            <div
                                                class="aethra-combat__log-entry"
                                                ${color ? `style="color:${color}"` : ""}
                                            >
                                                ${escapeHTML(entry.message || "")}
                                            </div>
                                        `;
                                    }).join("")}
                                </div>
                            `
                            : ""
                    }
                </section>
            `;

            Aethra.EventBus.emit("render:combat", {
                combat: clone(combat)
            });

            this.renderBattleCards();
            this.renderActionBar();

            return true;
        },

        renderCityPosition(payload = null) {
            if (this.battleMode === "cards" || this.battleMode === "map2d") {
                return true;
            }

            const heroElement = getElement(this.selectors.cityHero);

            if (!heroElement) return false;

            const sourcePosition =
                payload?.position ||
                payload ||
                Aethra.GameState.world?.playerPos ||
                Aethra.CityScene?.playerPos ||
                { x: 0, y: 0 };

            const x = Number(sourcePosition.x || 0);
            const y = Number(sourcePosition.y || 0);

            const tileSize =
                Number(Aethra.CityScene?.tileSize) ||
                Number(heroElement.dataset.tileSize) ||
                48;

            heroElement.style.transform =
                `translate(${x * tileSize}px, ${y * tileSize}px)`;

            heroElement.dataset.gridX = String(x);
            heroElement.dataset.gridY = String(y);

            Aethra.EventBus.emit("render:city-position", {
                x,
                y,
                tileSize
            });

            return true;
        },

        renderBosses() {
            const container = getElement(this.selectors.bossList);

            if (!container) return false;

            const bosses = Aethra.BossSystem?.bosses || {};
            const bossState = Aethra.GameState.bosses || {};
            const heroLevel = getHeroLevel(Aethra.GameState.hero || {});

            container.innerHTML = Object.entries(bosses)
                .map(([bossId, boss]) => {
                    const history = bossState.history?.[bossId];
                    const status = typeof Aethra.BossSystem?.getRequirementStatus === "function"
                        ? Aethra.BossSystem.getRequirementStatus(bossId)
                        : {
                            allowed:
                                boss.status === "available" &&
                                heroLevel >= Number(boss.levelReq || 1),
                            reason: boss.status === "locked"
                                ? "Bloqueado"
                                : `Nível ${boss.levelReq}`
                        };

                    return `
                        <article class="boss-card ${boss.status === "locked" ? "is-locked" : ""}">
                            <header>
                                <div>
                                    <span>${boss.status === "locked" ? "Bloqueado" : "Boss"}</span>
                                    <h3>${escapeHTML(boss.name)}</h3>
                                </div>

                                <strong>Nível ${formatNumber(boss.levelReq)}</strong>
                            </header>

                            <p>${escapeHTML(boss.description || "")}</p>

                            <div class="boss-card__rewards">
                                Recompensa: ${escapeHTML(boss.reward || "Não revelada")}
                            </div>

                            <div class="boss-card__history">
                                ${history ? `Vitórias: ${formatNumber(history.defeats)}` : "Ainda não derrotado"}
                            </div>

                            <button
                                type="button"
                                data-render-challenge-boss="${escapeHTML(bossId)}"
                                ${status.allowed ? "" : "disabled"}
                            >
                                ${status.allowed ? "Desafiar" : escapeHTML(status.reason)}
                            </button>
                        </article>
                    `;
                })
                .join("");

            container
                .querySelectorAll("[data-render-challenge-boss]")
                .forEach((button) => {
                    button.addEventListener("click", () => {
                        Aethra.BossSystem?.challenge(
                            button.dataset.renderChallengeBoss
                        );
                    });
                });

            Aethra.EventBus.emit("render:bosses", {
                count: Object.keys(bosses).length
            });

            return true;
        },

        renderProfessions() {
            const container = getElement(this.selectors.professions);

            if (!container) return false;

            const definitions =
                Aethra.ProfessionSystem?.professions ||
                Aethra.ProfessionSystem?.definitions ||
                {};

            const state =
                Aethra.GameState.professions &&
                typeof Aethra.GameState.professions === "object"
                    ? Aethra.GameState.professions
                    : {};

            if (Object.keys(definitions).length === 0) {
                container.innerHTML = `
                    <div class="aethra-empty">
                        Nenhuma profissão registrada.
                    </div>
                `;

                return true;
            }

            container.innerHTML = Object.entries(definitions)
                .map(([professionId, profession]) => {
                    const professionState =
                        state[professionId] ||
                        state.entries?.[professionId] ||
                        {};

                    const locked =
                        profession.status === "locked" ||
                        professionState.status === "locked";

                    return `
                        <article class="profession-card ${locked ? "is-locked" : ""}">
                            <header>
                                <span>${locked ? "Bloqueada" : "Disponível"}</span>
                                <h3>${escapeHTML(profession.name || professionId)}</h3>
                            </header>

                            <p>${escapeHTML(profession.description || "")}</p>

                            <div>
                                Rank:
                                <strong>
                                    ${escapeHTML(
                                        professionState.rank ||
                                        profession.rank ||
                                        "E"
                                    )}
                                </strong>
                            </div>

                            <div>
                                XP:
                                <strong>
                                    ${formatNumber(professionState.xp || 0)}
                                </strong>
                            </div>
                        </article>
                    `;
                })
                .join("");

            Aethra.EventBus.emit("render:professions", {
                count: Object.keys(definitions).length
            });

            return true;
        },

        renderEngineStatus(status, isError = false) {
            const element = getElement(this.selectors.engineStatus);

            if (!element) return false;

            element.textContent = status;
            element.classList.toggle("is-error", isError);
            element.classList.toggle("is-ready", !isError && status === "Pronta");

            return true;
        },

        setSelector(name, selector) {
            if (!Object.prototype.hasOwnProperty.call(this.selectors, name)) {
                return false;
            }

            this.selectors[name] = selector;
            return true;
        },

        refresh(section = "all") {
            const renderers = {
                all: () => this.renderAll(),
                heroStats: () => this.renderHeroStats(),
                inventory: () => this.renderInventory(),
                equipment: () => this.renderEquipment(),
                quests: () => this.renderQuests(),
                hunt: () => this.renderHunt(),
                combat: () => this.renderCombat(),
                actionBar: () => this.renderActionBar(),
                battleCards: () => this.renderBattleCards(),
                battleInventory: () => this.renderBattleInventory(),
                battleEquipment: () => this.renderBattleEquipment(),
                cityHero: () => this.renderCityPosition(),
                bosses: () => this.renderBosses(),
                professions: () => this.renderProfessions()
            };

            if (!renderers[section]) {
                return false;
            }

            renderers[section]();
            return true;
        },

        injectStyles() {
            if (document.getElementById("aethra-render-engine-styles")) {
                return;
            }

            const style = document.createElement("style");
            style.id = "aethra-render-engine-styles";
            style.textContent = `
                .aethra-stats,
                .aethra-hunt,
                .aethra-combat,
                .quest-card,
                .boss-card,
                .profession-card {
                    color: #edf4ff;
                }

                .aethra-stats__header,
                .aethra-hunt header,
                .aethra-combat header,
                .quest-card header,
                .boss-card header,
                .profession-card header {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    align-items: center;
                }

                .aethra-stats__header span,
                .aethra-hunt header span,
                .aethra-combat header span,
                .quest-card header span,
                .boss-card header span,
                .profession-card header span {
                    color: #8ea6c4;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: .08em;
                }

                .aethra-stats__grid,
                .aethra-hunt__grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
                    gap: 8px;
                    margin: 12px 0;
                }

                .aethra-stat,
                .aethra-hunt__grid > div {
                    padding: 10px;
                    border: 1px solid rgba(89, 129, 178, .28);
                    border-radius: 10px;
                    background: rgba(8, 19, 32, .68);
                }

                .aethra-stat small,
                .aethra-hunt__grid small {
                    display: block;
                    color: #8fa5c2;
                    margin-bottom: 4px;
                }

                .aethra-resource {
                    display: grid;
                    gap: 5px;
                    margin-top: 10px;
                }

                .aethra-resource > div {
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                    font-size: 13px;
                }

                .aethra-resource progress {
                    width: 100%;
                    height: 9px;
                }

                #inventory-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 8px;
                }

                .item-card,
                .equipment-slot {
                    min-height: 92px;
                    padding: 10px;
                    border: 1px solid rgba(84, 127, 179, .38);
                    border-radius: 10px;
                    background: linear-gradient(180deg, #10243a, #081421);
                    color: #edf4ff;
                    text-align: left;
                    cursor: pointer;
                }

                .item-card__name,
                .item-card__meta,
                .item-card__quality,
                .item-card__stats {
                    display: block;
                }

                .item-card__name {
                    font-weight: 700;
                }

                .item-card__meta,
                .item-card__quality,
                .item-card__stats {
                    color: #9db0c9;
                    font-size: 12px;
                    margin-top: 5px;
                }

                .item-card__stats span {
                    display: block;
                }

                #equipment-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 8px;
                }

                .equipment-slot small,
                .equipment-slot strong {
                    display: block;
                }

                .equipment-slot small {
                    color: #8ea6c4;
                    text-transform: uppercase;
                }

                .equipment-slot--filled {
                    border-color: #d8aa50;
                }

                #quests-list,
                #boss-list,
                #professions-grid {
                    display: grid;
                    gap: 10px;
                }

                .quest-card,
                .boss-card,
                .profession-card {
                    padding: 12px;
                    border: 1px solid rgba(83, 126, 177, .32);
                    border-radius: 12px;
                    background: rgba(8, 19, 33, .75);
                }

                .quest-card h3,
                .boss-card h3,
                .profession-card h3 {
                    margin: 3px 0 0;
                }

                .quest-card ul {
                    margin: 10px 0 0;
                    padding: 0;
                    list-style: none;
                }

                .quest-card li {
                    display: flex;
                    justify-content: space-between;
                    gap: 10px;
                    padding: 7px 0;
                    border-top: 1px solid rgba(92, 128, 170, .2);
                }

                .quest-card li.is-complete {
                    color: #65dda8;
                }

                .boss-card.is-locked,
                .profession-card.is-locked {
                    opacity: .62;
                }

                .boss-card button {
                    margin-top: 12px;
                    width: 100%;
                    padding: 9px;
                    border-radius: 9px;
                    border: 1px solid #6e91b8;
                    background: #10243a;
                    color: #fff;
                    cursor: pointer;
                }

                .boss-card button:disabled {
                    cursor: not-allowed;
                    opacity: .55;
                }

                .aethra-empty {
                    padding: 18px;
                    border: 1px dashed rgba(101, 140, 184, .42);
                    border-radius: 10px;
                    color: #8298b5;
                    text-align: center;
                }

                #engine-status.is-ready {
                    color: #59d79e;
                }

                #engine-status.is-error {
                    color: #ff776f;
                }
            `;

            document.head.appendChild(style);
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            () => Aethra.RenderEngine.init(),
            { once: true }
        );
    } else {
        Aethra.RenderEngine.init();
    }
})(window.Aethra);

// Progression & Exploration HUD Pass - paperdoll, backpack grid, masteries and live world feed
(function (Aethra) {
    "use strict";

    if (!Aethra?.RenderEngine) return;

    const Render = Aethra.RenderEngine;
    const esc = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    const fmt = (value) => new Intl.NumberFormat("pt-BR").format(Number(value || 0));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value || 0)));
    const duration = (seconds) => {
        const total = Math.max(0, Math.floor(Number(seconds || 0)));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
        if (m) return `${m}m ${String(s).padStart(2, "0")}s`;
        return `${s}s`;
    };

    Render.ensureProgressionExplorationLayout = function () {
        const main = document.querySelector(".battle-main-column");
        const stage = main?.querySelector(".battle-stage-panel");
        if (!main || !stage) return false;

        main.classList.add("battle-main-column--world-loop");
        stage.classList.add("battle-stage-panel--compact");
        const stageHeading = stage.querySelector(".battle-stage-panel__header h2");
        const stageEyebrow = stage.querySelector(".battle-stage-panel__header small");
        if (stageHeading) stageHeading.textContent = "Encontro";
        if (stageEyebrow) stageEyebrow.textContent = "Combate e interação atual";

        // Exploration feed is handled inside sidebars or overlays
        const oldFeed = document.querySelector(".battle-panel--exploration");
        if (oldFeed) oldFeed.remove();

        const backpackView = document.querySelector('[data-hero-panel-view="backpack"]');
        if (backpackView && !backpackView.querySelector("[data-backpack-filters]")) {
            const heading = backpackView.querySelector(".hero-hub__section-heading");
            const filters = document.createElement("div");
            filters.className = "hero-backpack-filters";
            filters.dataset.backpackFilters = "";
            filters.innerHTML = [
                ["all", "Todos"],
                ["equipment", "Equip."],
                ["consumable", "Consumo"],
                ["resource", "Recursos"],
                ["loot", "Loot"]
            ].map(([id, label], index) => `
                <button type="button" data-backpack-filter="${id}" class="${index === 0 ? "is-active" : ""}">${label}</button>
            `).join("");
            heading?.insertAdjacentElement("afterend", filters);
            filters.addEventListener("click", (event) => {
                const button = event.target.closest("[data-backpack-filter]");
                if (!button) return;
                Aethra.GameState.ui = Aethra.GameState.ui || {};
                Aethra.GameState.ui.backpackFilter = button.dataset.backpackFilter;
                filters.querySelectorAll("button").forEach((entry) => entry.classList.toggle("is-active", entry === button));
                this.renderBattleInventory();
            });
        }

        return true;
    };

    const originalActivateBattleMode = Render.activateBattleMode.bind(Render);
    Render.activateBattleMode = function (...args) {
        const result = originalActivateBattleMode(...args);
        this.ensureProgressionExplorationLayout();
        return result;
    };

    const originalBindEvents = Render.bindEvents.bind(Render);
    Render.bindEvents = function (...args) {
        const result = originalBindEvents(...args);
        if (this._progressionExplorationEventsBound) return result;
        this._progressionExplorationEventsBound = true;

        const refreshWorld = () => {
            this.schedule?.("explorationFeed", () => this.renderExplorationFeed());
            this.schedule?.("hunt", () => this.renderHunt());
            this.schedule?.("heroSkills", () => this.renderHeroSkillProgression());
            this.schedule?.("battleInventory", () => this.renderBattleInventory());
        };

        [
            "exploration:ready",
            "exploration:updated",
            "exploration:event-found",
            "exploration:event-resolved",
            "exploration:feed",
            "profession:ready",
            "profession:updated",
            "profession:xpChanged",
            "profession:rankUp",
            "mastery:updated"
        ].forEach((eventName) => Aethra.EventBus.on(eventName, refreshWorld));
        return result;
    };

    Render.renderBattleEquipment = function () {
        const container = document.getElementById("battle-equipment-summary");
        if (!container) return false;

        const equipment = Aethra.GameState.playerEquipment || Aethra.GameState.hero?.equipment || {};
        const slots = [
            { id: "head", label: "Capacete", icon: "⌃" },
            { id: "weapon", label: "Arma", icon: "⚔" },
            { id: "chest", label: "Armadura", icon: "▣" },
            { id: "offhand", label: "Mão 2", icon: "◐" },
            { id: "legs", label: "Pernas", icon: "Ⅱ" },
            { id: "feet", label: "Botas", icon: "⌄" }
        ];

        const slotHTML = slots.map((slot) => {
            const item = equipment[slot.id] || null;
            const image = item ? Aethra.GameData?.getItemImage?.(item) : "";
            const rarity = item ? Aethra.GameData?.getRarityPresentation?.(item) : null;
            const inspect = item ? Aethra.ItemSystem?.getItemInspection?.(item) : null;
            const iv = clamp(inspect?.ivPercent || 0, 0, 100);
            return `
                <button type="button"
                    class="hero-paperdoll__slot hero-paperdoll__slot--${slot.id} ${item ? "is-filled" : ""}"
                    data-battle-equipment-slot="${slot.id}"
                    style="--slot-rarity:${esc(rarity?.color || "#33444e")};"
                    aria-label="${esc(item?.name || `${slot.label} vazio`)}">
                    <span class="hero-paperdoll__slot-icon">
                        ${image ? `<img src="${esc(image)}" alt="${esc(item.name)}" draggable="false">` : `<b>${slot.icon}</b>`}
                    </span>
                    <small>${slot.label}</small>
                    ${item ? `<em>${Number(inspect?.multiplier || 1).toFixed(2)}x · IV ${iv.toFixed(0)}%</em>` : `<em>Vazio</em>`}
                </button>
            `;
        }).join("");

        container.className = "hero-paperdoll";
        container.innerHTML = `
            <div class="hero-paperdoll__body" aria-hidden="true">
                <span class="hero-paperdoll__silhouette">
                    <i class="hero-paperdoll__head"></i>
                    <i class="hero-paperdoll__torso"></i>
                    <i class="hero-paperdoll__legs"></i>
                </span>
                <img src="assets/entities/player_idle.png" alt="" draggable="false">
            </div>
            ${slotHTML}
        `;

        const equippedItems = slots.map((slot) => equipment[slot.id]).filter(Boolean);
        const count = document.getElementById("hero-equipment-tab-count");
        if (count) count.textContent = `${equippedItems.length}/${slots.length}`;

        const inspections = equippedItems.map((item) => Aethra.ItemSystem?.getItemInspection?.(item)).filter(Boolean);
        const averageIv = inspections.length ? inspections.reduce((total, value) => total + Number(value.ivPercent || 0), 0) / inspections.length : 0;
        const highestMultiplier = inspections.length ? Math.max(...inspections.map((value) => Number(value.multiplier || 1))) : 1;
        const totalBonuses = equippedItems.reduce((sum, item) => {
            const breakdown = Aethra.GameData?.getItemStatBreakdown?.(item);
            return sum + Object.values(breakdown?.finalStats || item.stats || {}).reduce((sub, value) => sub + Math.abs(Number(value || 0)), 0);
        }, 0);
        const summary = document.getElementById("hero-build-summary");
        if (summary) {
            summary.innerHTML = `
                <span><small>Equipado</small><strong>${equippedItems.length}/${slots.length}</strong></span>
                <span><small>IV da build</small><strong>${averageIv.toFixed(0)}%</strong></span>
                <span><small>Maior mult.</small><strong>${highestMultiplier.toFixed(2)}x</strong></span>
                <span><small>Bônus total</small><strong>+${fmt(Math.round(totalBonuses))}</strong></span>
            `;
        }

        container.querySelectorAll("[data-battle-equipment-slot]").forEach((button) => {
            const slot = button.dataset.battleEquipmentSlot;
            const item = equipment[slot] || null;
            button.addEventListener("click", () => {
                if (item) Aethra.EquipSystem?.unequip?.(slot);
                else Aethra.WindowManager?.openWindow?.("inventory-view", { source: "paperdoll-empty-slot" });
            });
            if (item) Aethra.UIManager?.bindItemTooltip?.(button, item, { source: "hero-paperdoll", slot });
        });
        Aethra.TooltipManager?.refresh?.();
        return true;
    };

    Render.getBackpackFilter = function () {
        return Aethra.GameState.ui?.backpackFilter || "all";
    };

    Render.renderBattleInventory = function () {
        const container = document.getElementById("battle-inventory-grid");
        if (!container) return false;
        this.ensureProgressionExplorationLayout();

        const hero = Aethra.GameState.hero || {};
        const bag = Array.isArray(hero.bag) ? hero.bag : [];
        const filter = this.getBackpackFilter();
        const normalizeCategory = (item) => {
            const type = String(item?.itemType || item?.type || "MISC").toUpperCase();
            if (["WEAPON", "SHIELD", "OFFHAND", "HELMET", "HEAD", "ARMOR", "CHEST", "GLOVES", "HANDS", "LEGS", "PANTS", "BOOTS", "FEET", "AMULET", "NECK", "RING", "RELIC"].includes(type)) return "equipment";
            if (type === "CONSUMABLE") return "consumable";
            if (type === "MATERIAL" || item?.category === "resource") return "resource";
            if (type === "LOOT" || type === "QUEST") return "loot";
            return "loot";
        };
        const filtered = filter === "all" ? bag : bag.filter((item) => normalizeCategory(item) === filter);
        const visibleSlots = Math.max(40, Math.ceil(Math.max(filtered.length, 1) / 8) * 8);
        const selectedId = this.getSelectedInventoryItemId?.();

        const count = document.getElementById("battle-inventory-count");
        if (count) count.textContent = `${bag.length} itens · ${visibleSlots} slots`;
        const tabCount = document.getElementById("hero-backpack-tab-count");
        if (tabCount) tabCount.textContent = String(bag.length);

        document.querySelectorAll("[data-backpack-filter]").forEach((button) => {
            button.classList.toggle("is-active", button.dataset.backpackFilter === filter);
        });

        container.className = "hero-backpack-grid tibia-backpack-grid";
        container.replaceChildren();
        const fragment = document.createDocumentFragment();

        for (let index = 0; index < visibleSlots; index += 1) {
            const item = filtered[index] || null;
            const slot = document.createElement("button");
            slot.type = "button";
            slot.className = `tibia-backpack-slot ${item ? "is-filled" : "is-empty"} ${item?.instanceId === selectedId ? "is-selected" : ""}`;
            slot.dataset.slotIndex = String(index + 1);
            if (item?.instanceId) slot.dataset.instanceId = item.instanceId;

            if (!item) {
                slot.innerHTML = `<span>${index + 1}</span>`;
                slot.disabled = true;
            } else {
                const image = Aethra.GameData?.getItemImage?.(item) || "";
                const rarity = Aethra.GameData?.getRarityPresentation?.(item) || { color: "#6a7880" };
                const quantity = Math.max(1, Number(item.quantity || 1));
                const tooltipData = Aethra.UIManager?.getItemTooltipData?.(item, { source: "tibia-backpack" }) || {};
                const unitValue = Math.max(0, Number(tooltipData.resaleValue || item.price || item.value || 0));
                const totalValue = unitValue * quantity;
                const compactValue = totalValue >= 1000000
                    ? `${(totalValue / 1000000).toFixed(totalValue >= 10000000 ? 0 : 1)}M`
                    : totalValue >= 1000
                        ? `${(totalValue / 1000).toFixed(totalValue >= 10000 ? 0 : 1)}K`
                        : fmt(totalValue);
                slot.style.setProperty("--slot-rarity", rarity.color);
                const fallbackLabel = esc((item.icon && String(item.icon).trim()) || String(item.name || "?").trim().charAt(0).toUpperCase());
                slot.innerHTML = `
                    <span class="tibia-backpack-slot__index">${index + 1}</span>
                    <span class="tibia-backpack-slot__icon">
                        <b aria-hidden="true">${fallbackLabel}</b>
                        ${image ? `<img src="${esc(image)}" alt="${esc(item.name || "Item")}" draggable="false" onerror="this.style.display='none'">` : ""}
                    </span>
                    <span class="tibia-backpack-slot__rarity-dot" aria-hidden="true"></span>
                    ${quantity > 1 ? `<strong class="tibia-backpack-slot__quantity">x${fmt(quantity)}</strong>` : ""}
                    ${totalValue > 0 ? `<em class="tibia-backpack-slot__value">${esc(compactValue)} G</em>` : ""}
                `;
                slot.addEventListener("click", () => {
                    this.setSelectedInventoryItem?.(item.instanceId);
                    this.renderBattleInventory();
                    this.renderBattleInventorySelection?.(item);
                    this.renderInventoryDetails?.(item);
                });
                slot.addEventListener("dblclick", () => {
                    if (item.slot && Aethra.EquipSystem?.canEquip?.(item, item.slot)) {
                        Aethra.EquipSystem.equip(item.instanceId, item.slot);
                    }
                });
                Aethra.UIManager?.bindItemTooltip?.(slot, item, { source: "tibia-backpack" });
            }
            fragment.appendChild(slot);
        }
        container.appendChild(fragment);

        const selectedItem = bag.find((item) => item.instanceId === selectedId) || null;
        this.renderBattleInventorySelection?.(selectedItem);
        Aethra.TooltipManager?.refresh?.();
        return true;
    };

    Render.getMasteryCards = function () {
        const skillProgress = Aethra.GameState.hero?.skillProgression || {};
        const skill = (id) => skillProgress[id] || { level: 1, xpCurrent: 0, xpNext: 36, xpTotal: 0 };
        const aggregate = (ids, definition) => {
            const entries = ids.map(skill);
            const level = Math.max(1, Math.floor(entries.reduce((sum, entry) => sum + Number(entry.level || 1), 0) / entries.length));
            const xpCurrent = entries.reduce((sum, entry) => sum + Number(entry.xpCurrent || 0), 0);
            const xpNext = entries.reduce((sum, entry) => sum + Number(entry.xpNext || 36), 0);
            const xpTotal = entries.reduce((sum, entry) => sum + Number(entry.xpTotal || 0), 0);
            return { ...definition, level, xpCurrent, xpNext, xpTotal, progressPercent: xpNext ? clamp((xpCurrent / xpNext) * 100, 0, 100) : 100 };
        };

        const profession = (id) => Aethra.ProfessionSystem?.getState?.(id) || {
            id,
            name: id,
            icon: "•",
            level: 1,
            xp: 0,
            xpNext: 45,
            progressPercent: 0,
            description: "Skill de mundo.",
            nextBenefit: "Novo bônus no próximo nível."
        };

        return [
            aggregate(["basic_attack", "offhand_attack", "heavy_strike"], { id: "attack", name: "Ataque", icon: "⚔", category: "Combate", description: "Evolui usando ataques físicos.", nextBenefit: "+2,5% de potência física por nível de habilidade." }),
            aggregate(["guard"], { id: "defense", name: "Defesa", icon: "⬡", category: "Combate", description: "Evolui usando posturas e bloqueios.", nextBenefit: "Melhora a eficiência de habilidades defensivas." }),
            aggregate(["fire_bolt"], { id: "magic", name: "Magia", icon: "✦", category: "Combate", description: "Evolui usando habilidades mágicas.", nextBenefit: "+2,5% de potência mágica por nível." }),
            aggregate(["heal"], { id: "healing", name: "Cura", icon: "✚", category: "Combate", description: "Evolui restaurando vida.", nextBenefit: "+2,5% na cura por nível." }),
            ...["mining", "skinning", "herbalism", "exploration", "survival", "blacksmithing", "thievery"].map((id) => {
                const entry = profession(id);
                const categoryLabels = {
                    world: "Mundo",
                    gathering: "Coleta",
                    crafting: "Craft",
                    utility: "Utilidade"
                };
                return {
                    ...entry,
                    xpCurrent: entry.xp,
                    category: categoryLabels[entry.category] || "Skill"
                };
            })
        ];
    };

    Render.renderHeroSkillProgression = function () {
        const container = document.getElementById("hero-skill-progression");
        if (!container) return false;
        const masteries = this.getMasteryCards();
        const totalLevels = masteries.reduce((sum, entry) => sum + Number(entry.level || 1), 0);
        const totalXP = masteries.reduce((sum, entry) => sum + Number(entry.xpTotal || entry.xp || 0), 0);
        const strongest = [...masteries].sort((a, b) => Number(b.level || 1) - Number(a.level || 1) || Number(b.xpTotal || 0) - Number(a.xpTotal || 0))[0];

        container.innerHTML = `
            <div class="mastery-overview">
                <span><small>Níveis totais</small><strong>${fmt(totalLevels)}</strong></span>
                <span><small>XP de skills</small><strong>${fmt(totalXP)}</strong></span>
                <span><small>Maior domínio</small><strong>${esc(strongest?.name || "Ataque")}</strong></span>
            </div>
            <div class="runescape-skill-grid">
                ${masteries.map((entry) => {
                    const current = Number(entry.xpCurrent ?? entry.xp ?? 0);
                    const next = Math.max(1, Number(entry.xpNext || 1));
                    const progress = clamp(entry.progressPercent ?? (current / next * 100), 0, 100);
                    return `
                        <article class="runescape-skill-card" tabindex="0"
                            data-discipline-id="${esc(entry.id)}"
                            data-ui-tooltip data-tooltip-kind="hud"
                            data-tooltip-eyebrow="${esc(entry.category || "SKILL")}" data-tooltip-title="${esc(entry.name)}"
                            data-tooltip-value="Nível ${fmt(entry.level)}"
                            data-tooltip-body="${esc(entry.description || entry.benefit || "Skill de progressão do personagem.")}"
                            data-tooltip-effect="${esc(entry.benefit || entry.nextBenefit || "Evolui conforme é utilizada.")}"
                            data-tooltip-hint="Clique para abrir o Guia de Maestria"
                            style="cursor: pointer;">
                            <span class="runescape-skill-card__icon">${esc(entry.icon || "•")}</span>
                            <div class="runescape-skill-card__content">
                                <small>${esc(entry.category || "Skill")}</small>
                                <strong>${esc(entry.name)}</strong>
                                <div class="runescape-skill-card__xp"><i><b style="width:${progress.toFixed(2)}%"></b></i><span>${fmt(current)} / ${fmt(next)} XP</span></div>
                            </div>
                            <em>Lv. ${fmt(entry.level)}</em>
                        </article>
                    `;
                }).join("")}
            </div>
            <div class="mastery-footnote"><span>Clique em qualquer disciplina para ver o guia de progressão de níveis.</span><b>Combate · Coleta · Mundo</b></div>
        `;

        const counter = document.getElementById("hero-skills-tab-count");
        if (counter) counter.textContent = String(masteries.length);
        Aethra.TooltipManager?.refresh?.();
        return true;
    };

    const DISCIPLINE_UNLOCKS = {
        sword: [
            { level: 1, type: "skill", title: "Corte Preciso", icon: "⚔", desc: "Desbloqueia a técnica de ataque confiável de espada." },
            { level: 10, type: "passive", title: "Foco de Lâmina", desc: "Aumenta a precisão de ataques com espada em +5%." },
            { level: 20, type: "passive", title: "Corte Profundo", desc: "Aumenta a chance crítica com espadas em +3%." },
            { level: 30, type: "passive", title: "Fluxo de Combate", desc: "Reduz o custo de Vigor de Corte Preciso em 20%." },
            { level: 40, type: "passive", title: "Estilo de Duelo", desc: "Aumenta o dano crítico com espadas em +15%." },
            { level: 50, type: "mastery", title: "Mestre de Espadas", desc: "Dobra a chance de acionamento do Proc de combate de Espadas." }
        ],
        axe: [
            { level: 1, type: "skill", title: "Talho Brutal", icon: "🪓", desc: "Desbloqueia o ataque pesado de machado." },
            { level: 10, type: "passive", title: "Peso de Batalha", desc: "Aumenta o dano mínimo de machados em +10%." },
            { level: 20, type: "passive", title: "Fúria Desperta", desc: "Aumenta a chance crítica com machados em +4%." },
            { level: 30, type: "passive", title: "Talho Incessante", desc: "Reduz o custo de Vigor de Talho Brutal em 20%." },
            { level: 40, type: "passive", title: "Golpe Esmagador", desc: "Aumenta o multiplicador de dano crítico com machados em +20%." },
            { level: 50, type: "mastery", title: "Mestre de Machados", desc: "Aumenta o multiplicador do Proc de machados de 1.4x para 1.7x." }
        ],
        mace: [
            { level: 1, type: "skill", title: "Quebra-Armadura", icon: "◆", desc: "Desbloqueia o impacto de maça que perfura a Defesa." },
            { level: 10, type: "passive", title: "Peso de Ferro", desc: "Aumenta o dano base com maças em +8%." },
            { level: 20, type: "passive", title: "Ruptura de Placas", desc: "Ignora mais +10% da defesa constante do inimigo." },
            { level: 30, type: "passive", title: "Impacto Fluido", desc: "Reduz o tempo de recarga de Quebra-Armadura em 1 rodada." },
            { level: 40, type: "passive", title: "Golpe de Concussão", desc: "Adiciona +5% de chance de atordoar inimigos por 1 rodada com maça." },
            { level: 50, type: "mastery", title: "Mestre de Maças", desc: "Dobra a chance de acionamento do Proc Impacto Esmagador." }
        ],
        dagger: [
            { level: 1, type: "skill", title: "Presa Dupla", icon: "†", desc: "Desbloqueia o ataque rápido com chance de corte duplo." },
            { level: 10, type: "passive", title: "Lâmina Oculta", desc: "Aumenta a evasão em +3% ao usar adagas." },
            { level: 20, type: "passive", title: "Corte Cirúrgico", desc: "Aumenta a chance crítica com adagas em +5%." },
            { level: 30, type: "passive", title: "Reflexos Rápidos", desc: "Reduz o custo de Vigor de Presa Dupla em 25%." },
            { level: 40, type: "passive", title: "Toxina Letal", desc: "Ataques críticos de adaga adicionam envenenamento ao alvo." },
            { level: 50, type: "mastery", title: "Mestre de Adagas", desc: "Dobra a chance de acionamento do Proc de ataque duplo." }
        ],
        bow: [
            { level: 1, type: "skill", title: "Tiro Mirado", icon: "➶", desc: "Desbloqueia o disparo concentrado de longa distância." },
            { level: 10, type: "passive", title: "Olho de Águia", desc: "Aumenta a precisão com arcos em +6%." },
            { level: 20, type: "passive", title: "Tiro Penetrante", desc: "Ignora 10% da defesa do inimigo com tiros de arco." },
            { level: 30, type: "passive", title: "Estreitamento", desc: "Reduz o tempo de recarga de Tiro Mirado em 1 rodada." },
            { level: 40, type: "passive", title: "Distanciamento", desc: "Reduz o dano recebido em 5% enquanto usar arcos." },
            { level: 50, type: "mastery", title: "Mestre de Arcos", desc: "Dobra a chance de acionamento do Proc de acerto crítico de arco." }
        ],
        fire: [
            { level: 1, type: "skill", title: "Projétil de Fogo", icon: "🔥", desc: "Desbloqueia a magia de fogo com chance de queimadura." },
            { level: 10, type: "passive", title: "Ignição", desc: "Aumenta o dano de queima do Projétil de Fogo em +15%." },
            { level: 20, type: "passive", title: "Calor Intenso", desc: "Aumenta o multiplicador mágico de fogo em +10%." },
            { level: 30, type: "passive", title: "Conjuração Rápida", desc: "Reduz o custo de Mana de Projétil de Fogo em 20%." },
            { level: 40, type: "passive", title: "Piro-explosão", desc: "Aumenta a chance crítica de magias de fogo em +6%." },
            { level: 50, type: "mastery", title: "Mestre do Fogo", desc: "Dobra a chance de acionamento da queima do Projétil de Fogo." }
        ],
        ice: [
            { level: 1, type: "skill", title: "Estilhaço de Gelo", icon: "❄", desc: "Desbloqueia o estilhaço de gelo com congelamento." },
            { level: 10, type: "passive", title: "Geada", desc: "Aumenta a redução de dano inimigo pelo congelamento em +5%." },
            { level: 20, type: "passive", title: "Crio-resiliência", desc: "Aumenta a defesa constante em +4 ao usar gelo." },
            { level: 30, type: "passive", title: "Congelamento Rápido", desc: "Reduz o tempo de recarga de Estilhaço de Gelo em 1 rodada." },
            { level: 40, type: "passive", title: "Barreira Glacial", desc: "Ganhe um escudo de gelo equivalente a 10% da vida máxima ao início de combates." },
            { level: 50, type: "mastery", title: "Mestre do Gelo", desc: "Estilhaço de Gelo tem chance de congelar o inimigo por 1 rodada." }
        ],
        shadow: [
            { level: 1, type: "skill", title: "Seta Sombria", icon: "☾", desc: "Desbloqueia a magia de trevas com roubo de vida." },
            { level: 10, type: "passive", title: "Dreno de Alma", desc: "Aumenta o dreno de vida de Seta Sombria em +5%." },
            { level: 20, type: "passive", title: "Aura Escura", desc: "Aumenta o Poder Mágico em +8% ao usar trevas." },
            { level: 30, type: "passive", title: "Corrupção de Sangue", desc: "Seta Sombria aplica veneno de trevas ao alvo." },
            { level: 40, type: "passive", title: "Pacto Sombrio", desc: "Recupere 3 de Mana cada vez que conjurar Seta Sombria." },
            { level: 50, type: "mastery", title: "Mestre das Trevas", desc: "Dobra a taxa de roubo de vida de todas as magias de trevas." }
        ],
        restoration: [
            { level: 1, type: "skill", title: "Cura", icon: "✚", desc: "Desbloqueia a magia de cura de HP." },
            { level: 10, type: "passive", title: "Voz de Luz", desc: "Aumenta a eficiência de Cura em +15%." },
            { level: 20, type: "passive", title: "Prece Silenciosa", desc: "Reduz o custo de Mana de Cura em 20%." },
            { level: 30, type: "passive", title: "Renovação", desc: "Adiciona uma cura regenerativa leve ao longo de 3 rodadas." },
            { level: 40, type: "passive", title: "Preservação", desc: "Se o HP cair abaixo de 20%, a cura é instantaneamente conjurada sem gastar mana." },
            { level: 50, type: "mastery", title: "Mestre Restaurador", desc: "Dobra a chance de acionamento do Proc Cura Plena." }
        ],
        shield: [
            { level: 1, type: "skill", title: "Postura de Guarda", icon: "🛡", desc: "Desbloqueia a postura que aumenta defesa e bloqueio." },
            { level: 10, type: "passive", title: "Reforço de Escudo", desc: "Aumenta a redução de dano bloqueado em +8%." },
            { level: 20, type: "passive", title: "Guarda Impenetrável", desc: "Aumenta a chance de bloqueio básico em +5%." },
            { level: 30, type: "passive", title: "Aparar Eficiente", desc: "Postura de Guarda dura mais 1 rodada no combate." },
            { level: 40, type: "passive", title: "Contra-Ataque", desc: "Bloquear um ataque tem 25% de chance de causar contra-golpe físico." },
            { level: 50, type: "mastery", title: "Mestre de Escudos", desc: "Aumenta a eficiência de bloqueio em +15% permanentes." }
        ],
        cloth_armor: [
            { level: 1, type: "passive", title: "Leveza", desc: "Permite usar armaduras de tecido com bônus de Magia." },
            { level: 10, type: "passive", title: "Mente Clara", desc: "Aumenta a regeneração de mana no mundo em +10%." },
            { level: 20, type: "passive", title: "Túnica Rúnica", desc: "Aumenta a resistência a magias elementais em +12%." },
            { level: 30, type: "passive", title: "Escudo Arcano", desc: "Ganha barreira de mana equivalente a 15% do MP máximo." },
            { level: 40, type: "passive", title: "Alquimia Corporal", desc: "Poções de vida e vigor curam +15% a mais." },
            { level: 50, type: "mastery", title: "Mestre do Tecido", desc: "Ao conjurar magias, tem 10% de chance de não gastar mana." }
        ],
        leather_armor: [
            { level: 1, type: "passive", title: "Mobilidade", desc: "Permite usar armaduras de couro com bônus de Evasão." },
            { level: 10, type: "passive", title: "Passo Leve", desc: "Aumenta a chance de esquiva básica em +3%." },
            { level: 20, type: "passive", title: "Sombra Fluida", desc: "Aumenta a chance crítica de ataques físicos em +2.5%." },
            { level: 30, type: "passive", title: "Evasão Consecutiva", desc: "Esquivar-se de um golpe aumenta a precisão do próximo golpe em +10%." },
            { level: 40, type: "passive", title: "Fuga Oportunista", desc: "Esquivar-se de um golpe recupera 5 de Vigor." },
            { level: 50, type: "mastery", title: "Mestre do Couro", desc: "Esquivas físicas têm 15% de chance de zerar o tempo de recarga da sua skill ativa." }
        ],
        plate_armor: [
            { level: 1, type: "passive", title: "Fortaleza", desc: "Permite usar armaduras de placa com bônus de Defesa." },
            { level: 10, type: "passive", title: "Aço Temperado", desc: "Aumenta a Defesa constante em +3." },
            { level: 20, type: "passive", title: "Sangue de Titã", desc: "Aumenta a Vida máxima em +10%." },
            { level: 30, type: "passive", title: "Barreira de Ferro", desc: "Reduz o dano físico sofrido de monstros elite ou boss em 12%." },
            { level: 40, type: "passive", title: "Peso de Guarda", desc: "Aumenta o bloqueio com escudos em +5%." },
            { level: 50, type: "mastery", title: "Mestre de Placas", desc: "Reduz todo o dano físico sofrido em 5% permanentes." }
        ],
        survival: [
            { level: 1, type: "passive", title: "Resistência", desc: "Evolui resistindo a riscos e caçadas longas." },
            { level: 10, type: "passive", title: "Nutrição", desc: "Aumenta a cura de acampamentos em +20%." },
            { level: 20, type: "passive", title: "Economia de Viagem", desc: "Reduz o custo de suprimentos de expedição em 15%." },
            { level: 30, type: "passive", title: "Pele Grossa", desc: "Reduz a chance de receber status negativos (queimadura, envenenamento)." },
            { level: 40, type: "passive", title: "Vigor do Caçador", desc: "Aumenta a regeneração de vigor em combate em +1 por rodada." },
            { level: 50, type: "mastery", title: "Mestre Sobrevivente", desc: "Permite resistir a um golpe fatal com 1 de HP por caçada." }
        ]
    };

    Render.renderDisciplineGuide = function (disciplineId) {
        const container = document.getElementById("discipline-guide-content");
        const titleEl = document.getElementById("discipline-guide-title");
        if (!container) return false;

        const state = Aethra.DisciplineSystem?.getState?.(disciplineId);
        if (!state) return false;

        if (titleEl) titleEl.textContent = `Livro de Habilidade: ${state.name}`;

        const unlocks = DISCIPLINE_UNLOCKS[disciplineId] || [];
        const currentLevel = Number(state.level || 1);
        const currentXP = Number(state.xpCurrent || 0);
        const nextXP = Number(state.xpNext || 1);
        const progress = clamp((currentXP / nextXP) * 100, 0, 100);

        const headerHTML = `
            <div class="discipline-guide-header">
                <span class="discipline-guide-header__icon" data-discipline-id="${esc(disciplineId)}">${esc(state.icon || "•")}</span>
                <div class="discipline-guide-header__details">
                    <h3>${esc(state.name)} <small style="color: #efd070; font-size: 11px; font-weight: bold; margin-left: 5px;">Nível ${currentLevel}</small></h3>
                    <p>${esc(state.description)}</p>
                    <div class="discipline-guide-header__xp">
                        <i><b style="width: ${progress.toFixed(2)}%"></b></i>
                        <span>${fmt(currentXP)} / ${fmt(nextXP)} XP</span>
                    </div>
                </div>
            </div>
        `;

        const milestonesHTML = `
            <div class="discipline-guide-milestones">
                <small style="color: #72909b; font-size: 8px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;">Linha do Tempo de Desbloqueios</small>
                ${unlocks.map((milestone) => {
                    const isUnlocked = currentLevel >= milestone.level;
                    return `
                        <article class="discipline-guide-milestone ${isUnlocked ? "is-unlocked" : ""}">
                            <span class="discipline-guide-milestone__lvl">LV. ${milestone.level}</span>
                            <span class="discipline-guide-milestone__status">${isUnlocked ? "✓" : "🔒"}</span>
                            <div class="discipline-guide-milestone__info">
                                <strong>${esc(milestone.title)} ${milestone.icon ? `<b style="font-style: normal; margin-left: 4px;">${esc(milestone.icon)}</b>` : ""}</strong>
                                <p>${esc(milestone.desc)}</p>
                            </div>
                        </article>
                    `;
                }).join("")}
            </div>
        `;

        container.innerHTML = `
            <div class="discipline-guide-wrapper">
                ${headerHTML}
                ${milestonesHTML}
            </div>
        `;
        return true;
    };

    Render.renderExplorationFeed = function () {
        const container = document.getElementById("exploration-feed");
        if (!container) return false;
        const snapshot = Aethra.ExplorationSystem?.getSnapshot?.() || { events: [], pendingEvent: null, totals: {} };
        const hunt = Aethra.GameState.hunt || {};
        const pending = snapshot.pendingEvent;
        const events = (snapshot.events || []).slice(0, 12);

        container.innerHTML = `
            ${pending ? `
                <article class="exploration-active-event is-${esc(pending.category)}">
                    <span class="exploration-active-event__icon">${esc(pending.icon)}</span>
                    <div><small>Evento encontrado</small><strong>${esc(pending.title)}</strong><p>${esc(pending.description)}</p></div>
                    <button type="button" data-resolve-exploration="${esc(pending.eventId)}">${esc(pending.actionLabel)}</button>
                </article>
            ` : `
                <div class="exploration-searching"><span>⌖</span><div><strong>${hunt.isActive ? "Vasculhando a região..." : "Inicie uma hunt para explorar"}</strong><small>Combates e eventos aparecem continuamente enquanto a Hunt estiver ativa.</small></div></div>
            `}
            <div class="exploration-timeline">
                ${events.length ? events.map((entry) => `
                    <article class="exploration-feed-item is-${esc(entry.tone)}">
                        <span>${esc(entry.icon)}</span>
                        <div><strong>${esc(entry.title)}</strong><small>${esc(entry.detail)}</small></div>
                        <time>${new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                    </article>
                `).join("") : `<div class="exploration-feed-empty">A região ainda não registrou eventos.</div>`}
            </div>
        `;

        container.querySelector("[data-resolve-exploration]")?.addEventListener("click", (event) => {
            Aethra.ExplorationSystem?.resolveEvent?.(event.currentTarget.dataset.resolveExploration, { manual: true });
        });
        return true;
    };

    Render.renderHunt = function () {
        const container = document.getElementById("hunt-display");
        if (!container) return false;
        const hunt = Aethra.GameState.hunt || {};
        const exploration = Aethra.ExplorationSystem?.getSnapshot?.() || { totals: {} };
        const totals = exploration.totals || {};
        const elapsedSeconds = Math.max(0, Number(hunt.elapsedMs || 0) / 1000);
        const hours = Math.max(elapsedSeconds / 3600, 1 / 3600);
        const kills = Number(hunt.kills || 0);
        const xp = Number(hunt.xp || 0);
        const gold = Number(hunt.gold || 0);
        const lootValue = Number(hunt.lootValue || 0);
        const supplyCost = Number(hunt.supplyCost || 0);
        const profit = gold + lootValue - supplyCost;
        const xpPerHour = xp / hours;
        const profitPerHour = profit / hours;
        const averageKill = kills ? elapsedSeconds / kills : 0;
        const huntName = Aethra.HuntSystem?.hunts?.[hunt.huntId]?.name || "Nenhuma hunt ativa";

        container.innerHTML = `
            <section class="hunt-analyzer hunt-analyzer--live">
                <div class="hunt-analyzer__session">
                    <div><small>${hunt.isActive ? "SESSÃO ATIVA" : "SESSÃO PARADA"}</small><strong>${esc(huntName)}</strong></div>
                    <time>${duration(elapsedSeconds)}</time>
                </div>
                <div class="hunt-analyzer-tabs" aria-label="Categorias do Analyzer">
                    <span class="is-active">Visão geral</span><span>Combate</span><span>Loot</span><span>Exploração</span>
                </div>
                <div class="hunt-analyzer-live-grid">
                    <article class="analyzer-live-card is-xp"><small>XP por hora</small><strong>${fmt(Math.floor(xpPerHour))}</strong><span>${fmt(xp)} XP obtidos</span></article>
                    <article class="analyzer-live-card is-profit"><small>Lucro por hora</small><strong>${fmt(Math.floor(profitPerHour))}</strong><span>${fmt(profit)} líquido</span></article>
                    <article class="analyzer-live-card"><small>Kills e ritmo</small><strong>${kills}</strong><span>${duration(averageKill)} por abate</span></article>
                    <article class="analyzer-live-card is-world"><small>Eventos encontrados</small><strong>${fmt(totals.events || 0)}</strong><span>${fmt(totals.rareEvents || 0)} raros · ${fmt(totals.chests || 0)} baús</span></article>
                </div>
                <div class="hunt-analyzer-breakdown hunt-analyzer-breakdown--economy">
                    <span><b>◆</b><em>Loot</em>${fmt(lootValue)}</span>
                    <span><b>✦</b><em>Skill XP</em>${fmt(totals.skillXP || 0)}</span>
                    <span><b>▦</b><em>Recursos</em>${fmt(totals.resources || 0)}</span>
                    <span><b>▣</b><em>Custos</em>${fmt(supplyCost)}</span>
                </div>
                <button type="button" class="hunt-analyzer__reset" data-reset-hunt-analyzer>Resetar medição</button>
            </section>
        `;
        container.querySelector("[data-reset-hunt-analyzer]")?.addEventListener("click", () => Aethra.HuntSystem?.resetAnalyzer?.());
        return true;
    };

    const originalRenderAll = Render.renderAll.bind(Render);
    Render.renderAll = function (...args) {
        const result = originalRenderAll(...args);
        this.ensureProgressionExplorationLayout();
        this.renderExplorationFeed();
        return result;
    };
})(window.Aethra);

// Mantém a carteira da navbar sincronizada com o estado real do herói.
(function (Aethra) {
    "use strict";
    if (!Aethra?.RenderEngine) return;
    const Render = Aethra.RenderEngine;
    const original = Render.renderHeroStats.bind(Render);
    Render.renderHeroStats = function (...args) {
        const result = original(...args);
        const hero = Aethra.GameState.hero || {};
        document.querySelectorAll("[data-currency='gold']").forEach((node) => {
            node.textContent = String(Math.max(0, Number(hero.gold ?? hero.stats?.gold ?? 0)));
        });
        document.querySelectorAll("[data-currency='diamonds']").forEach((node) => {
            node.textContent = String(Math.max(0, Number(hero.diamonds ?? hero.stats?.diamonds ?? 0)));
        });
        return result;
    };
})(window.Aethra);
