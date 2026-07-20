// BossSystem.js - Seção 11: Engine de Bosses
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus) {
        throw new Error(
            "BossSystem.js requer game-core.js carregado antes deste arquivo."
        );
    }

    const DEFAULT_CONTAINER = "#boss-list";
    const DEFAULT_WEEKLY_CONTAINER = "#boss-weekly-reward";
    const TIMER_INTERVAL_MS = 1000;

    const now = () => Date.now();

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function getHeroLevel() {
        return Number(Aethra.GameState.hero.level || 1);
    }

    function getMondayKey(date = new Date()) {
        const copy = new Date(date);
        const day = copy.getDay();
        const distanceToMonday = day === 0 ? -6 : 1 - day;

        copy.setDate(copy.getDate() + distanceToMonday);
        copy.setHours(0, 0, 0, 0);

        return [
            copy.getFullYear(),
            String(copy.getMonth() + 1).padStart(2, "0"),
            String(copy.getDate()).padStart(2, "0")
        ].join("-");
    }

    function getNextWeeklyReset() {
        const reset = new Date();
        const currentDay = reset.getDay();
        const daysUntilMonday = currentDay === 0 ? 1 : 8 - currentDay;

        reset.setDate(reset.getDate() + daysUntilMonday);
        reset.setHours(0, 0, 0, 0);

        return reset.getTime();
    }

    function formatDuration(milliseconds) {
        const safeMs = Math.max(0, Number(milliseconds) || 0);
        const totalSeconds = Math.ceil(safeMs / 1000);

        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (days > 0) {
            return `${days}d ${String(hours).padStart(2, "0")}h`;
        }

        return [
            String(hours).padStart(2, "0"),
            String(minutes).padStart(2, "0"),
            String(seconds).padStart(2, "0")
        ].join(":");
    }

    function ensureBossState() {
        const state = Aethra.GameState;

        if (!state.bosses || typeof state.bosses !== "object") {
            state.bosses = {};
        }

        const currentWeek = getMondayKey();

        if (!state.bosses.weekly || state.bosses.weekly.weekKey !== currentWeek) {
            state.bosses.weekly = {
                weekKey: currentWeek,
                defeatedBosses: [],
                progress: 0,
                required: 1,
                claimed: false
            };
        }

        if (!state.bosses.cooldowns || typeof state.bosses.cooldowns !== "object") {
            state.bosses.cooldowns = {};
        }

        if (!state.bosses.history || typeof state.bosses.history !== "object") {
            state.bosses.history = {};
        }

        if (!Object.prototype.hasOwnProperty.call(state.bosses, "activeBossId")) {
            state.bosses.activeBossId = null;
        }

        return state.bosses;
    }

    Aethra.BossSystem = {
        bosses: {
            alpha_wolf: {
                id: "alpha_wolf",
                name: "Lobo Alfa",
                description:
                    "Predador dominante do Bosque dos Sussurros. Invoca lobos menores e entra em fúria ao perder metade da vida.",
                levelReq: 10,
                status: "available",
                reward: "Colar de Prata",
                weeklyRewardLabel: "Baú do Caçador Alfa",
                cooldownMs: 5 * 60 * 1000,
                phases: 2,
                techniques: [
                    "Mordida Dilacerante",
                    "Uivo da Matilha",
                    "Fúria Alfa"
                ],
                rewards: [
                    { type: "gold", min: 80, max: 130 },
                    { type: "item", templateId: "silver_necklace", chance: 0.35 },
                    { type: "item", templateId: "wolf_hide", chance: 1 }
                ],
                combat: {
                    hp: 260,
                    xp: 120,
                    gold: 90,
                    stats: {
                        str: 18,
                        precision: 18,
                        defense: 8,
                        critical: 0.12,
                        evasion: 0.08,
                        blockChance: 0.02,
                        blockReduction: 0.25,
                        damageMin: 12,
                        damageMax: 22
                    }
                }
            },

            shadow_knight: {
                id: "shadow_knight",
                name: "Cavaleiro Sombrio",
                description:
                    "Um antigo campeão corrompido que domina golpes sombrios e contra-ataques.",
                levelReq: 20,
                status: "locked",
                reward: "Espada do Crepúsculo",
                unlockLabel: "Conteúdo futuro",
                phases: 3,
                techniques: ["Corte Sombrio", "Contra-Ataque", "Marcha da Ruína"]
            },

            ancient_golem: {
                id: "ancient_golem",
                name: "Golem Ancestral",
                description:
                    "Colosso de pedra rúnica com defesa elevada e ataques que atingem toda a arena.",
                levelReq: 30,
                status: "locked",
                reward: "Núcleo Rúnico",
                unlockLabel: "Conteúdo futuro",
                phases: 3,
                techniques: ["Punho Sísmico", "Pele de Rocha", "Colapso Rúnico"]
            },

            blood_witch: {
                id: "blood_witch",
                name: "Bruxa de Sangue",
                description:
                    "Conjuradora que transforma a própria vida em magia e drena recursos do herói.",
                levelReq: 40,
                status: "locked",
                reward: "Grimório Carmesim",
                unlockLabel: "Conteúdo futuro",
                phases: 3,
                techniques: ["Dreno Vital", "Maldição", "Lua Carmesim"]
            },

            frost_dragon: {
                id: "frost_dragon",
                name: "Dragão do Gelo",
                description:
                    "Dragão ancestral que congela áreas do campo e exige resistência elemental.",
                levelReq: 55,
                status: "locked",
                reward: "Escama Glacial",
                unlockLabel: "Conteúdo futuro",
                phases: 4,
                techniques: ["Sopro Glacial", "Voo Rasante", "Inverno Eterno"]
            },

            void_herald: {
                id: "void_herald",
                name: "Arauto do Vazio",
                description:
                    "Entidade final do primeiro arco de bosses. Alterna entre formas física e arcana.",
                levelReq: 70,
                status: "locked",
                reward: "Fragmento do Vazio",
                unlockLabel: "Conteúdo futuro",
                phases: 4,
                techniques: ["Ruptura", "Forma Etérea", "Eclipse do Vazio"]
            }
        },

        options: {
            container: DEFAULT_CONTAINER,
            weeklyContainer: DEFAULT_WEEKLY_CONTAINER
        },

        timerId: null,
        initialized: false,

        init(options = {}) {
            this.options = {
                ...this.options,
                ...options
            };

            ensureBossState();
            this.bindEvents();
            this.startTimer();
            this.renderBossList();
            this.renderWeeklyReward();

            this.initialized = true;

            Aethra.EventBus.emit("boss:ready", {
                bosses: clone(this.bosses),
                state: clone(Aethra.GameState.bosses)
            });
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            Aethra.EventBus.on("levelUp", () => {
                this.renderBossList();
            });

            Aethra.EventBus.on("save:loaded", () => {
                ensureBossState();
                this.renderBossList();
                this.renderWeeklyReward();
            });

            Aethra.EventBus.on("state:restored", () => {
                ensureBossState();
                this.renderBossList();
                this.renderWeeklyReward();
            });

            Aethra.EventBus.on("EnemyDefeated", (enemy) => {
                const bossId = enemy && (enemy.bossId || (enemy.isBoss ? enemy.id : null));

                if (bossId && this.bosses[bossId]) {
                    this.handleBossDefeated(bossId, enemy);
                }
            });

            Aethra.EventBus.on("combat:enemy-defeated", (enemy) => {
                const data = enemy && enemy.enemy ? enemy.enemy : enemy;
                const bossId = data && (data.bossId || (data.isBoss ? data.id : null));

                if (bossId && this.bosses[bossId]) {
                    this.handleBossDefeated(bossId, data);
                }
            });
        },

        startTimer() {
            if (this.timerId !== null) return;

            this.timerId = window.setInterval(() => {
                this.updateTimers();
            }, TIMER_INTERVAL_MS);

            this.updateTimers();
        },

        stopTimer() {
            if (this.timerId === null) return;

            window.clearInterval(this.timerId);
            this.timerId = null;
        },

        updateTimers() {
            this.resetWeeklyStateIfNeeded();

            const payload = {
                weeklyResetAt: getNextWeeklyReset(),
                weeklyRemainingMs: getNextWeeklyReset() - now(),
                bosses: {}
            };

            Object.keys(this.bosses).forEach((bossId) => {
                const remainingMs = this.getCooldownRemaining(bossId);

                payload.bosses[bossId] = {
                    bossId,
                    remainingMs,
                    available: remainingMs <= 0 && this.bosses[bossId].status === "available"
                };

                const timerElement = document.querySelector(
                    `[data-boss-timer="${bossId}"]`
                );

                if (timerElement) {
                    timerElement.textContent =
                        remainingMs > 0
                            ? `Disponível em ${formatDuration(remainingMs)}`
                            : "Disponível agora";
                }

                const button = document.querySelector(
                    `[data-boss-challenge="${bossId}"]`
                );

                if (button) {
                    const requirement = this.getRequirementStatus(bossId);
                    button.disabled = !requirement.allowed;
                    button.textContent =
                        remainingMs > 0
                            ? formatDuration(remainingMs)
                            : requirement.allowed
                                ? "Desafiar"
                                : requirement.reason;
                }
            });

            const resetElement = document.querySelector("[data-weekly-reset]");
            if (resetElement) {
                resetElement.textContent = formatDuration(payload.weeklyRemainingMs);
            }

            Aethra.EventBus.emit("boss:timer-tick", payload);
        },

        resetWeeklyStateIfNeeded() {
            const state = ensureBossState();
            const currentWeek = getMondayKey();

            if (state.weekly.weekKey !== currentWeek) {
                state.weekly = {
                    weekKey: currentWeek,
                    defeatedBosses: [],
                    progress: 0,
                    required: 1,
                    claimed: false
                };

                Aethra.EventBus.emit("boss:weekly-reset", clone(state.weekly));
                this.save();
            }
        },

        getCooldownRemaining(bossId) {
            const state = ensureBossState();
            const readyAt = Number(state.cooldowns[bossId] || 0);

            return Math.max(0, readyAt - now());
        },

        getRequirementStatus(bossId) {
            const boss = this.bosses[bossId];

            if (!boss) {
                return {
                    allowed: false,
                    reason: "Boss inválido"
                };
            }

            if (boss.status !== "available") {
                return {
                    allowed: false,
                    reason: boss.unlockLabel || "Bloqueado"
                };
            }

            const heroLevel = getHeroLevel();

            if (heroLevel < boss.levelReq) {
                return {
                    allowed: false,
                    reason: `Nível ${boss.levelReq}`
                };
            }

            const remainingMs = this.getCooldownRemaining(bossId);

            if (remainingMs > 0) {
                return {
                    allowed: false,
                    reason: formatDuration(remainingMs),
                    remainingMs
                };
            }

            if (Aethra.GameState.bosses.activeBossId) {
                return {
                    allowed: false,
                    reason: "Em combate"
                };
            }

            return {
                allowed: true,
                reason: "Disponível"
            };
        },

        checkRequirement(bossId) {
            return this.getRequirementStatus(bossId).allowed;
        },

        challenge(bossId) {
            const boss = this.bosses[bossId];
            const requirement = this.getRequirementStatus(bossId);

            if (!boss || !requirement.allowed) {
                Aethra.EventBus.emit("boss:challenge-denied", {
                    bossId,
                    boss: boss ? clone(boss) : null,
                    reason: requirement.reason
                });

                return false;
            }

            const state = ensureBossState();
            state.activeBossId = bossId;

            const combatEnemy = {
                id: bossId,
                bossId,
                isBoss: true,
                name: boss.name,
                hp: boss.combat.hp,
                maxHp: boss.combat.hp,
                xp: boss.combat.xp,
                gold: boss.combat.gold,
                stats: clone(boss.combat.stats),
                phases: boss.phases,
                techniques: clone(boss.techniques),
                rewardTable: clone(boss.rewards)
            };

            Aethra.EventBus.emit("BossChallengeStarted", {
                bossId,
                boss: clone(boss),
                enemy: clone(combatEnemy)
            });

            Aethra.EventBus.emit("boss:challenge-started", {
                bossId,
                boss: clone(boss),
                enemy: clone(combatEnemy)
            });

            if (
                Aethra.CombatSystem &&
                typeof Aethra.CombatSystem.startCombat === "function"
            ) {
                Aethra.CombatSystem.startCombat(combatEnemy);
            } else {
                Aethra.EventBus.emit("boss:combat-requested", {
                    bossId,
                    enemy: clone(combatEnemy)
                });
            }

            this.renderBossList();
            this.save();

            return true;
        },

        handleBossDefeated(bossId, enemyData = {}) {
            const boss = this.bosses[bossId];
            if (!boss) return false;

            const state = ensureBossState();
            const history = state.history[bossId] || {
                defeats: 0,
                firstDefeatedAt: null,
                lastDefeatedAt: null,
                bestTimeMs: null
            };

            const defeatedAt = now();
            const combatStartedAt =
                Number(
                    Aethra.GameState.combat &&
                    Aethra.GameState.combat.startedAt
                ) || defeatedAt;

            const durationMs = Math.max(0, defeatedAt - combatStartedAt);

            history.defeats += 1;
            history.firstDefeatedAt = history.firstDefeatedAt || defeatedAt;
            history.lastDefeatedAt = defeatedAt;

            if (
                history.bestTimeMs === null ||
                durationMs < history.bestTimeMs
            ) {
                history.bestTimeMs = durationMs;
            }

            state.history[bossId] = history;
            state.activeBossId = null;
            state.cooldowns[bossId] = defeatedAt + Number(boss.cooldownMs || 0);

            if (!state.weekly.defeatedBosses.includes(bossId)) {
                state.weekly.defeatedBosses.push(bossId);
                state.weekly.progress = state.weekly.defeatedBosses.length;
            }

            Aethra.EventBus.emit("BossDefeated", {
                bossId,
                boss: clone(boss),
                history: clone(history),
                weekly: clone(state.weekly),
                enemy: clone(enemyData)
            });

            Aethra.EventBus.emit("boss:defeated", {
                bossId,
                boss: clone(boss),
                history: clone(history),
                weekly: clone(state.weekly)
            });

            this.renderBossList();
            this.renderWeeklyReward();
            this.save();

            return true;
        },

        claimWeeklyReward() {
            const state = ensureBossState();
            const weekly = state.weekly;

            if (weekly.claimed) {
                Aethra.EventBus.emit("boss:weekly-reward-denied", {
                    reason: "Recompensa já coletada."
                });
                return false;
            }

            if (weekly.progress < weekly.required) {
                Aethra.EventBus.emit("boss:weekly-reward-denied", {
                    reason: "Progresso semanal insuficiente.",
                    progress: weekly.progress,
                    required: weekly.required
                });
                return false;
            }

            weekly.claimed = true;

            const goldReward = 250;
            Aethra.GameState.hero.gold =
                Number(Aethra.GameState.hero.gold || 0) + goldReward;

            let generatedItem = null;

            if (
                Aethra.ItemSystem &&
                typeof Aethra.ItemSystem.generateItem === "function"
            ) {
                generatedItem = Aethra.ItemSystem.generateItem("silver_necklace", {
                    source: "weekly-boss-reward",
                    qualityMin: 75,
                    qualityMax: 100
                });

                if (generatedItem) {
                    Aethra.EventBus.emit("itemObtained", [generatedItem]);
                }
            }

            Aethra.EventBus.emit("goldChanged", {
                amount: goldReward,
                total: Aethra.GameState.hero.gold,
                source: "weekly-boss-reward"
            });

            Aethra.EventBus.emit("boss:weekly-reward-claimed", {
                gold: goldReward,
                item: generatedItem,
                weekly: clone(weekly)
            });

            this.renderWeeklyReward();
            this.save();

            return true;
        },

        renderBossList() {
            const container = document.querySelector(this.options.container);
            if (!container) return;

            ensureBossState();
            container.innerHTML = "";

            Object.entries(this.bosses).forEach(([id, boss]) => {
                const requirement = this.getRequirementStatus(id);
                const history = Aethra.GameState.bosses.history[id];
                const remainingMs = this.getCooldownRemaining(id);

                const card = document.createElement("article");
                card.className = `boss-card boss-card--${boss.status}`;
                card.dataset.bossId = id;

                const techniques = (boss.techniques || [])
                    .map((technique) => `<li>${technique}</li>`)
                    .join("");

                const statusText =
                    boss.status === "locked"
                        ? boss.unlockLabel || "Bloqueado"
                        : remainingMs > 0
                            ? `Disponível em ${formatDuration(remainingMs)}`
                            : requirement.allowed
                                ? "Disponível agora"
                                : requirement.reason;

                card.innerHTML = `
                    <header class="boss-card__header">
                        <div>
                            <span class="boss-card__status">${statusText}</span>
                            <h3>${boss.name}</h3>
                        </div>
                        <strong>Nível ${boss.levelReq}</strong>
                    </header>

                    <p class="boss-card__description">${boss.description}</p>

                    <div class="boss-card__meta">
                        <span>Fases: ${boss.phases || 1}</span>
                        <span>Recompensa: ${boss.reward || "Não revelada"}</span>
                    </div>

                    <ul class="boss-card__techniques">${techniques}</ul>

                    <div class="boss-card__history">
                        ${
                            history
                                ? `Vitórias: ${history.defeats} · Melhor tempo: ${formatDuration(history.bestTimeMs || 0)}`
                                : "Ainda não derrotado"
                        }
                    </div>

                    ${
                        boss.status === "locked"
                            ? `<button type="button" disabled>Bloqueado</button>`
                            : `
                                <div class="boss-card__timer" data-boss-timer="${id}">
                                    ${remainingMs > 0 ? `Disponível em ${formatDuration(remainingMs)}` : "Disponível agora"}
                                </div>
                                <button
                                    type="button"
                                    data-boss-challenge="${id}"
                                    ${requirement.allowed ? "" : "disabled"}
                                >
                                    ${requirement.allowed ? "Desafiar" : requirement.reason}
                                </button>
                            `
                    }
                `;

                const challengeButton = card.querySelector(
                    `[data-boss-challenge="${id}"]`
                );

                if (challengeButton) {
                    challengeButton.addEventListener("click", () => {
                        this.challenge(id);
                    });
                }

                container.appendChild(card);
            });

            Aethra.EventBus.emit("boss:list-rendered", {
                count: Object.keys(this.bosses).length
            });
        },

        renderWeeklyReward() {
            const container = document.querySelector(
                this.options.weeklyContainer
            );

            if (!container) return;

            const state = ensureBossState();
            const weekly = state.weekly;
            const canClaim =
                weekly.progress >= weekly.required && !weekly.claimed;

            container.innerHTML = `
                <section class="boss-weekly">
                    <div>
                        <span>Recompensa semanal</span>
                        <h3>Baú dos Grandes Caçadores</h3>
                        <p>
                            Derrote ${weekly.required} boss disponível nesta semana.
                            Progresso: ${weekly.progress}/${weekly.required}.
                        </p>
                        <p>
                            Reinicia em
                            <strong data-weekly-reset>
                                ${formatDuration(getNextWeeklyReset() - now())}
                            </strong>
                        </p>
                    </div>

                    <div class="boss-weekly__rewards">
                        <span>250 ouro</span>
                        <span>1 item especial</span>
                    </div>

                    <button
                        type="button"
                        data-claim-weekly-boss
                        ${canClaim ? "" : "disabled"}
                    >
                        ${
                            weekly.claimed
                                ? "Recompensa coletada"
                                : canClaim
                                    ? "Coletar recompensa"
                                    : "Recompensa bloqueada"
                        }
                    </button>
                </section>
            `;

            const button = container.querySelector("[data-claim-weekly-boss]");
            if (button) {
                button.addEventListener("click", () => {
                    this.claimWeeklyReward();
                });
            }
        },

        registerBoss(bossId, config) {
            if (!bossId || !config || typeof config !== "object") {
                return false;
            }

            this.bosses[bossId] = {
                id: bossId,
                status: "locked",
                levelReq: 1,
                phases: 1,
                techniques: [],
                ...clone(config)
            };

            this.renderBossList();

            Aethra.EventBus.emit("boss:registered", {
                bossId,
                boss: clone(this.bosses[bossId])
            });

            return true;
        },

        unlockBoss(bossId) {
            const boss = this.bosses[bossId];
            if (!boss) return false;

            boss.status = "available";
            this.renderBossList();

            Aethra.EventBus.emit("boss:unlocked", {
                bossId,
                boss: clone(boss)
            });

            return true;
        },

        save() {
            if (
                Aethra.SaveManager &&
                typeof Aethra.SaveManager.save === "function"
            ) {
                Aethra.SaveManager.save();
            }
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            Aethra.BossSystem.init();
        });
    } else {
        Aethra.BossSystem.init();
    }
})(window.Aethra);
