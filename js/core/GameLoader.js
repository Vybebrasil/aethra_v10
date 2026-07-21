// GameLoader.js - O Maestro da Aethra Engine
(function (Aethra) {
    "use strict";

    if (!Aethra) {
        throw new Error(
            "GameLoader.js requer window.Aethra. Carregue game-core.js primeiro."
        );
    }

    const REQUIRED_MODULES = [
        "GameState",
        "EventBus",
        "SaveManager",
        "SettingsManager",
        "AuthorityGateway",
        "EconomyRNGManager",
        "MonsterCatalog",
        "HuntCatalog",
        "LootSystem",
        "EarlyGameItemCatalog",
        "BagSystem",
        "ItemRankingSystem",
        "WindowManager",
        "TooltipManager",
        "EntityManager",
        "SkillSystem",
        "DisciplineSystem",
        "SkillController",
        "BattleSystem",
        "CombatProjection",
        "ConsumableSystem",
        "ColiseumSystem",
        "HuntSystem",
        "ProfessionSystem",
        "RecipeCatalog",
        "CraftingSystem",
        "CharacterBuildSystem",
        "ExplorationSystem",
        "QuestSystem"
    ];

    const INIT_ORDER = [
        "SaveManager",
        "SettingsManager",
        "AuthorityGateway",
        "EconomyRNGManager",
        "MonsterCatalog",
        "HuntCatalog",
        "LootSystem",
        "EarlyGameItemCatalog",
        "BagSystem",
        "ItemRankingSystem",
        "WindowManager",
        "TooltipManager",
        "EntityManager",
        "SkillSystem",
        "DisciplineSystem",
        "SkillController",
        "BattleSystem",
        "CombatProjection",
        "ConsumableSystem",
        "ColiseumSystem",
        "HuntSystem",
        "ProfessionSystem",
        "RecipeCatalog",
        "CraftingSystem",
        "CharacterBuildSystem",
        "ExplorationSystem",
        "QuestSystem"
    ];

    function isFunction(value) {
        return typeof value === "function";
    }

    function clone(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }

    Aethra.GameLoader = {
        initialized: false,
        initializing: false,
        startedAt: null,
        completedAt: null,
        initResults: [],
        errors: [],

        checkModules() {
            const missing = REQUIRED_MODULES.filter((moduleName) => {
                return !Aethra[moduleName];
            });

            const loaded = REQUIRED_MODULES.filter((moduleName) => {
                return Boolean(Aethra[moduleName]);
            });

            return {
                valid: missing.length === 0,
                missing,
                loaded
            };
        },

        async initializeModule(moduleName) {
            const module = Aethra[moduleName];

            if (!module) {
                throw new Error(`Módulo ausente: ${moduleName}`);
            }

            const startedAt = Date.now();

            Aethra.EventBus.emit("engine:module-initializing", {
                moduleName,
                startedAt
            });

            let result = null;

            /*
             * Alguns módulos atuais já executam init() automaticamente ao serem
             * carregados. Para evitar listeners e timers duplicados, o loader
             * verifica flags comuns antes de chamar init() novamente.
             */
            const alreadyInitialized =
                module.initialized === true ||
                module.isInitialized === true ||
                module._initialized === true;

            if (isFunction(module.init) && !alreadyInitialized) {
                result = module.init();

                if (result && isFunction(result.then)) {
                    result = await result;
                }
            }

            const completedAt = Date.now();

            const moduleResult = {
                moduleName,
                initialized: true,
                skippedInit: alreadyInitialized || !isFunction(module.init),
                startedAt,
                completedAt,
                durationMs: completedAt - startedAt,
                result
            };

            this.initResults.push(moduleResult);

            Aethra.EventBus.emit("engine:module-ready", clone(moduleResult));

            return moduleResult;
        },

        async init() {
            if (this.initialized) {
                Aethra.EventBus.emit("EngineReady", {
                    repeated: true,
                    startedAt: this.startedAt,
                    completedAt: this.completedAt,
                    modules: clone(this.initResults)
                });

                return {
                    success: true,
                    repeated: true,
                    modules: clone(this.initResults)
                };
            }

            if (this.initializing) {
                return {
                    success: false,
                    reason: "initialization-in-progress"
                };
            }

            this.initializing = true;
            this.startedAt = Date.now();
            this.errors = [];
            this.initResults = [];

            console.log("Iniciando Aethra Engine...");

            try {
                const moduleCheck = this.checkModules();

                if (!moduleCheck.valid) {
                    const error = new Error(
                        `Módulos ausentes: ${moduleCheck.missing.join(", ")}`
                    );

                    this.errors.push({
                        stage: "module-check",
                        message: error.message,
                        missing: moduleCheck.missing
                    });

                    Aethra.EventBus &&
                        Aethra.EventBus.emit("EngineError", {
                            stage: "module-check",
                            error,
                            missing: moduleCheck.missing,
                            loaded: moduleCheck.loaded
                        });

                    throw error;
                }

                /*
                 * O Core já está carregado neste ponto.
                 * A ordem abaixo respeita:
                 * Core -> Save -> Window -> Battle -> Hunt -> Quest.
                 * O mapa 2D permanece fora do bootstrap no Modo de Batalha.
                 */
                for (const moduleName of INIT_ORDER) {
                    await this.initializeModule(moduleName);
                }

                this.initialized = true;
                this.completedAt = Date.now();

                const payload = {
                    success: true,
                    startedAt: this.startedAt,
                    completedAt: this.completedAt,
                    durationMs: this.completedAt - this.startedAt,
                    modules: clone(this.initResults),
                    state: Aethra.GameState
                };

                console.log("Aethra Engine pronta!");

                Aethra.EventBus.emit("EngineReady", payload);
                Aethra.EventBus.emit("engine:ready", payload);

                return payload;
            } catch (error) {
                this.completedAt = Date.now();

                const failure = {
                    success: false,
                    startedAt: this.startedAt,
                    completedAt: this.completedAt,
                    durationMs: this.completedAt - this.startedAt,
                    error,
                    message: error.message,
                    modules: clone(this.initResults),
                    errors: clone(this.errors)
                };

                console.error("Falha ao inicializar a Aethra Engine:", error);

                if (Aethra.EventBus && isFunction(Aethra.EventBus.emit)) {
                    Aethra.EventBus.emit("EngineError", failure);
                    Aethra.EventBus.emit("engine:error", failure);
                }

                return failure;
            } finally {
                this.initializing = false;
            }
        },

        getStatus() {
            const modules = this.checkModules();

            return {
                initialized: this.initialized,
                initializing: this.initializing,
                startedAt: this.startedAt,
                completedAt: this.completedAt,
                modules,
                initResults: clone(this.initResults),
                errors: clone(this.errors)
            };
        }
    };

    function startEngine() {
        Aethra.GameLoader.init();
    }

    if (document.readyState === "loading") {
        window.addEventListener("DOMContentLoaded", startEngine, {
            once: true
        });
    } else {
        startEngine();
    }
})(window.Aethra);
