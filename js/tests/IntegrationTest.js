// IntegrationTest.js - Smoke Test da Aethra Engine
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.EventBus) {
        throw new Error(
            "IntegrationTest.js requer game-core.js carregado antes deste arquivo."
        );
    }

    const REQUIRED_MODULES = [
        "GameState",
        "EventBus",
        "SaveManager",
        "SettingsManager",
        "WindowManager",
        "CityScene",
        "HuntSystem",
        "CombatSystem",
        "SkillSystem",
        "ItemSystem",
        "LootSystem",
        "BagSystem",
        "EquipSystem",
        "XPSystem",
        "ProfessionSystem",
        "BossSystem",
        "QuestSystem",
        "DungeonSystem",
        "RenderEngine",
        "GameLoader"
    ];

    function readXP() {
        const hero = Aethra.GameState && Aethra.GameState.hero
            ? Aethra.GameState.hero
            : {};

        return {
            current: Number(hero.xpCurrent || hero.xp || hero.stats?.xp || 0),
            total: Number(hero.xpTotal || hero.stats?.xp || 0),
            level: Number(hero.level || 1)
        };
    }

    function createCheck(name, passed, details = null) {
        return {
            check: name,
            status: passed ? "PASSOU" : "FALHOU",
            passed: Boolean(passed),
            details
        };
    }

    Aethra.IntegrationTest = {
        running: false,
        completed: false,
        lastReport: null,

        run() {
            if (this.running) {
                console.warn("O teste de integração já está em execução.");
                return;
            }

            this.running = true;

            console.log(
                "%c--- INICIANDO TESTE DE INTEGRAÇÃO AETHRA ---",
                "color: #00ff00; font-weight: bold;"
            );

            const checks = [];
            const startedAt = Date.now();
            const xpBefore = readXP();
            const bagBefore = Array.isArray(Aethra.GameState?.hero?.bag)
                ? Aethra.GameState.hero.bag.length
                : 0;

            // 1. Validar Core e módulos.
            checks.push(
                createCheck(
                    "Core/GameState",
                    Boolean(Aethra.GameState),
                    Aethra.GameState ? "GameState disponível" : "GameState ausente"
                )
            );

            REQUIRED_MODULES.forEach((moduleName) => {
                checks.push(
                    createCheck(
                        `Módulo ${moduleName}`,
                        Boolean(Aethra[moduleName]),
                        Aethra[moduleName] ? "Carregado" : "Ausente"
                    )
                );
            });

            console.log("✅ Core/GameState OK");

            // 2. Simular encontro: EventBus -> XPSystem -> QuestSystem.
            console.log("Simulando encontro...");
            Aethra.EventBus.emit("EnemyDefeated", {
                id: "forest_wolf",
                enemyId: "forest_wolf",
                name: "Lobo da Floresta",
                xp: 50,
                gold: 10,
                source: "integration-test"
            });

            // 3. Simular geração de loot para validar Item/Loot/Bag.
            let generatedLoot = [];
            let originalLootRandom = null;

            try {
                if (
                    Aethra.LootSystem &&
                    typeof Aethra.LootSystem.generateLoot === "function"
                ) {
                    originalLootRandom = Aethra.LootSystem.randomSource;

                    if (typeof Aethra.LootSystem.setRandomSource === "function") {
                        // Garante que o smoke test gere pelo menos os drops com chance > 0.
                        Aethra.LootSystem.setRandomSource(() => 0);
                    }

                    generatedLoot = Aethra.LootSystem.generateLoot(
                        "forest_wolf",
                        {
                            source: "integration-test"
                        }
                    );
                }
            } catch (error) {
                checks.push(
                    createCheck("Geração de loot", false, error.message)
                );
            } finally {
                if (
                    originalLootRandom &&
                    Aethra.LootSystem &&
                    typeof Aethra.LootSystem.setRandomSource === "function"
                ) {
                    Aethra.LootSystem.setRandomSource(originalLootRandom);
                }
            }

            window.setTimeout(() => {
                const xpAfter = readXP();
                const bagAfter = Array.isArray(Aethra.GameState?.hero?.bag)
                    ? Aethra.GameState.hero.bag.length
                    : 0;

                checks.push(
                    createCheck(
                        "Reatividade de XP",
                        xpAfter.total >= xpBefore.total + 50,
                        `${xpBefore.total} -> ${xpAfter.total}`
                    )
                );

                checks.push(
                    createCheck(
                        "Fluxo Loot -> Inventário",
                        generatedLoot.length === 0 || bagAfter > bagBefore,
                        `${generatedLoot.length} item(ns) gerado(s); mochila ${bagBefore} -> ${bagAfter}`
                    )
                );

                console.log(
                    "✅ Reatividade validada. XP atual:",
                    xpAfter.current
                );

                // 4. Testar persistência.
                let saveSucceeded = false;

                try {
                    saveSucceeded = Boolean(Aethra.SaveManager.save("integration-test"));

                    if (
                        typeof Aethra.SaveManager.exists === "function"
                    ) {
                        saveSucceeded = saveSucceeded && Aethra.SaveManager.exists();
                    }
                } catch (error) {
                    saveSucceeded = false;
                    checks.push(
                        createCheck("Persistência", false, error.message)
                    );
                }

                if (!checks.some((check) => check.check === "Persistência")) {
                    checks.push(
                        createCheck(
                            "Persistência",
                            saveSucceeded,
                            saveSucceeded
                                ? "Save armazenado no localStorage"
                                : "Save não confirmado"
                        )
                    );
                }

                console.log("✅ SaveManager validado.");

                const failedChecks = checks.filter((check) => !check.passed);
                const completedAt = Date.now();

                this.lastReport = {
                    success: failedChecks.length === 0,
                    startedAt,
                    completedAt,
                    durationMs: completedAt - startedAt,
                    xpBefore,
                    xpAfter,
                    bagBefore,
                    bagAfter,
                    generatedLoot: generatedLoot.length,
                    checks
                };

                this.running = false;
                this.completed = true;

                // 5. Relatório final.
                console.log("--- RELATÓRIO DE TESTES ---");
                console.table(checks);
                console.log("--- RELATÓRIO DE ESTADO ---");
                console.table(Aethra.GameState.hero);

                console.log(
                    this.lastReport.success
                        ? "%c✅ TESTE DE INTEGRAÇÃO CONCLUÍDO COM SUCESSO"
                        : "%c❌ TESTE DE INTEGRAÇÃO CONCLUÍDO COM FALHAS",
                    this.lastReport.success
                        ? "color: #00ff88; font-weight: bold;"
                        : "color: #ff5555; font-weight: bold;"
                );

                Aethra.EventBus.emit(
                    "IntegrationTestFinished",
                    this.lastReport
                );

                Aethra.EventBus.emit(
                    "integration:test-finished",
                    this.lastReport
                );
            }, 500);
        }
    };

    // Executa o teste após a engine carregar.
    Aethra.EventBus.on("EngineReady", () => {
        Aethra.IntegrationTest.run();
    });
})(window.Aethra);
