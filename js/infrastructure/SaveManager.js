// SaveManager.js
(function (Aethra) {
    'use strict';

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus) {
        throw new Error('[SaveManager] game-core.js deve ser carregado antes de SaveManager.js.');
    }

    const configuredSaveKey = typeof window.AETHRA_SAVE_KEY === 'string'
        ? window.AETHRA_SAVE_KEY.trim()
        : '';
    // A mudança para combate por rodadas e criação distribuída inaugura um
    // formato de progressão novo. O save anterior permanece preservado.
    const SAVE_KEY = configuredSaveKey || 'aethra_save_v71_disciplines';
    const CURRENT_SCHEMA_VERSION = 78;
    const AUTO_SAVE_DELAY = 120;

    let initialized = false;
    let autoSaveTimer = null;

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    // Guarda uma cópia do estado inicial para reset e compatibilidade com saves antigos.
    const defaultState = clone(Aethra.GameState);

    function isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    // Combina o save antigo com a estrutura atual da engine.
    // Campos novos continuam existindo mesmo quando o save foi criado antes deles.
    function mergeState(base, saved) {
        if (Array.isArray(saved)) return clone(saved);
        if (!isObject(saved)) return saved;

        const result = isObject(base) ? clone(base) : {};

        Object.keys(saved).forEach((key) => {
            const savedValue = saved[key];
            const baseValue = result[key];

            result[key] = isObject(savedValue)
                ? mergeState(baseValue, savedValue)
                : clone(savedValue);
        });

        return result;
    }

    function migrateSave(saved) {
        const migrated = clone(saved);
        migrated.meta = isObject(migrated.meta) ? migrated.meta : {};
        const fromVersion = Math.max(71, Math.floor(Number(migrated.meta.schemaVersion) || 71));

        // v72 → v73: garantir crafting.discovered como array
        // Personagens que já fizeram craft recebem as receitas base como descobertas.
        if (fromVersion < 73) {
            if (!migrated.crafting || typeof migrated.crafting !== 'object') {
                migrated.crafting = { completed: 0, recipeCounts: {}, processedCommands: [], discovered: [] };
            }
            if (!Array.isArray(migrated.crafting.discovered)) {
                migrated.crafting.discovered = [];
            }
            // Se já tem crafts anteriores, descobrir os starters da Forjaria e Couraria.
            const alreadyCrafted = Number(migrated.crafting.completed || 0) > 0;
            if (alreadyCrafted && migrated.crafting.discovered.length === 0) {
                const legacyIds = [
                    'smelt_iron', 'forge_iron_sword', 'forge_iron_axe', 'forge_iron_mace',
                    'forge_iron_helm', 'forge_iron_legs', 'forge_plate_chest',
                    'tan_beast_hide', 'craft_leather_boots', 'craft_leather_helm',
                    'craft_leather_legs', 'craft_leather_chest'
                ];
                legacyIds.forEach((id) => {
                    if (!migrated.crafting.discovered.includes(id)) {
                        migrated.crafting.discovered.push(id);
                    }
                });
            }
        }

        // v73 → v74: o domínio de missões passa a ter contrato próprio,
        // rastreamento seguro e registro idempotente de recompensas.
        if (fromVersion < 74) {
            if (!migrated.quests || typeof migrated.quests !== 'object') {
                migrated.quests = {};
            }
            if (!Array.isArray(migrated.quests.active)) migrated.quests.active = [];
            if (!Array.isArray(migrated.quests.completed)) migrated.quests.completed = [];
            if (!Array.isArray(migrated.quests.available)) migrated.quests.available = [];
            if (!Array.isArray(migrated.quests.rewardClaims)) migrated.quests.rewardClaims = [];
            migrated.quests.completed.forEach((quest) => {
                if (!quest?.id) return;
                quest.rewardClaimed = true;
                if (!migrated.quests.rewardClaims.includes(quest.id)) {
                    migrated.quests.rewardClaims.push(quest.id);
                }
            });
            migrated.quests.contractVersion = 2;
        }

        // v74 → v75: tutorial acessível e ramificado pelo ofício inicial.
        // O QuestSystem v3 reconstrói objetivos canônicos e converte a missão
        // genérica antiga para a rota escolhida pelo personagem.
        if (fromVersion < 75) {
            if (!migrated.quests || typeof migrated.quests !== 'object') migrated.quests = {};
            migrated.quests.contractVersion = 3;
            if (!Array.isArray(migrated.quests.active)) migrated.quests.active = [];
            if (!Array.isArray(migrated.quests.completed)) migrated.quests.completed = [];
            if (!Array.isArray(migrated.quests.available)) migrated.quests.available = [];
            if (!Array.isArray(migrated.quests.rewardClaims)) migrated.quests.rewardClaims = [];
        }

        // v75 → v76: introduz a mentora de ofícios e benefícios permanentes.
        // A lista de NPCs é completada pelo EntityManager de forma idempotente;
        // aqui normalizamos apenas os dados persistentes do herói.
        if (fromVersion < 76) {
            migrated.hero = isObject(migrated.hero) ? migrated.hero : {};
            if (!isObject(migrated.hero.professionPerks)) migrated.hero.professionPerks = {};
            if (!isObject(migrated.hero.introPrepared)) migrated.hero.introPrepared = {};
            if (!isObject(migrated.hero.introProvisioned)) migrated.hero.introProvisioned = {};
        }

        // v76 -> v77: ciclo persistente de durabilidade e manutencao.
        // Itens equipaveis antigos entram com 100/100; materiais e consumiveis
        // continuam sem durabilidade. A politica automatica nasce desligada.
        if (fromVersion < 77) {
            const maintainableSlots = new Set([
                'weapon', 'offhand', 'head', 'chest', 'hands', 'legs', 'feet',
                'neck', 'ring1', 'ring2', 'relic'
            ]);
            const normalizeItemDurability = (item, slotHint = null) => {
                if (!isObject(item) || item.stackable === true) return;
                const slot = String(item.slot || slotHint || '').toLowerCase();
                if (!maintainableSlots.has(slot)) return;
                const source = isObject(item.durability) ? item.durability : {};
                const max = Math.max(1, Number(source.max) || 100);
                const current = Math.min(max, Math.max(0, Number(source.current ?? max)));
                item.durability = {
                    current,
                    max,
                    lastChangedAt: source.lastChangedAt || null,
                    brokenAt: source.brokenAt || null
                };
            };

            migrated.hero = isObject(migrated.hero) ? migrated.hero : {};
            if (Array.isArray(migrated.hero.bag)) {
                migrated.hero.bag.forEach((item) => normalizeItemDurability(item));
            }
            if (isObject(migrated.playerEquipment)) {
                Object.entries(migrated.playerEquipment).forEach(([slot, item]) => normalizeItemDurability(item, slot));
            }
            if (isObject(migrated.hero.equipment)) {
                Object.entries(migrated.hero.equipment).forEach(([slot, item]) => normalizeItemDurability(item, slot));
            }

            migrated.maintenance = isObject(migrated.maintenance) ? migrated.maintenance : {};
            migrated.maintenance.policy = {
                enabled: false,
                thresholdPercent: 35,
                reserveGold: 25,
                maxGoldPerCycle: 100,
                ...(isObject(migrated.maintenance.policy) ? migrated.maintenance.policy : {})
            };
            if (!Array.isArray(migrated.maintenance.processedCommands)) migrated.maintenance.processedCommands = [];
            migrated.maintenance.totals = {
                repairs: 0,
                durabilityRestored: 0,
                goldSpent: 0,
                ...(isObject(migrated.maintenance.totals) ? migrated.maintenance.totals : {})
            };
            migrated.maintenance.lastAutoRepair = migrated.maintenance.lastAutoRepair || null;
        }

        // v77 -> v78: contrato vertical de foco em Mineracao. O contrato de
        // quests passa a conhecer dependencias entre objetivos e a garantia de
        // exploracao preserva a quantidade restante quando o jogador ignora o veio.
        if (fromVersion < 78) {
            migrated.quests = isObject(migrated.quests) ? migrated.quests : {};
            migrated.quests.contractVersion = 4;
            if (!Array.isArray(migrated.quests.active)) migrated.quests.active = [];
            if (!Array.isArray(migrated.quests.completed)) migrated.quests.completed = [];
            if (!Array.isArray(migrated.quests.available)) migrated.quests.available = [];
            if (!Array.isArray(migrated.quests.rewardClaims)) migrated.quests.rewardClaims = [];

            migrated.exploration = isObject(migrated.exploration) ? migrated.exploration : {};
            if (isObject(migrated.exploration.tutorialGuarantee)) {
                const guarantee = migrated.exploration.tutorialGuarantee;
                guarantee.remaining = Math.max(1, Math.floor(Number(guarantee.remaining) || 1));
                guarantee.manual = guarantee.manual === true;
                guarantee.guaranteedSuccess = guarantee.guaranteedSuccess === true;
                guarantee.minimumQuantity = Math.max(1, Math.floor(Number(guarantee.minimumQuantity) || 1));
            }
        }

        migrated.meta.schemaVersion = CURRENT_SCHEMA_VERSION;
        return { state: migrated, fromVersion, toVersion: CURRENT_SCHEMA_VERSION };
    }

    // Atualiza o mesmo objeto GameState para não quebrar referências usadas por HUDs e sistemas.
    function replaceState(target, source) {
        Object.keys(target).forEach((key) => {
            if (!(key in source)) delete target[key];
        });

        Object.keys(source).forEach((key) => {
            const sourceValue = source[key];
            const targetValue = target[key];

            if (isObject(sourceValue) && isObject(targetValue)) {
                replaceState(targetValue, sourceValue);
            } else {
                target[key] = clone(sourceValue);
            }
        });
    }

    function scheduleAutoSave(reason) {
        window.clearTimeout(autoSaveTimer);

        autoSaveTimer = window.setTimeout(() => {
            Aethra.SaveManager.save(reason || 'auto');
        }, AUTO_SAVE_DELAY);
    }

    /*
     * Serializadores por fatia do estado.
     *
     * Alguns módulos mantêm em memória dados grandes e reconstruíveis (seeds
     * determinísticos, índices derivados). Persistir isso incha o save sem
     * necessidade. Cada módulo dono registra aqui como a sua fatia deve ser
     * gravada — o SaveManager não conhece as regras de domínio.
     *
     * A troca acontece por identidade durante o stringify, então o estado vivo
     * nunca é modificado: o jogo continua com os dados completos em memória.
     */
    const stateSerializers = new Map();

    function resolveStatePath(path) {
        return String(path).split('.').reduce(
            (node, key) => (node == null ? node : node[key]),
            Aethra.GameState
        );
    }

    function buildSaveReplacer() {
        const overrides = new Map();

        stateSerializers.forEach((serialize, path) => {
            const target = resolveStatePath(path);
            if (!target || typeof target !== 'object') return;
            try {
                overrides.set(target, serialize(target));
            } catch (error) {
                console.warn(`[SaveManager] Serializador de "${path}" falhou; gravando estado completo.`, error);
            }
        });

        if (overrides.size === 0) return undefined;

        return function replaceRegenerableState(key, value) {
            return overrides.has(value) ? overrides.get(value) : value;
        };
    }

    Aethra.SaveManager = {
        key: SAVE_KEY,
        initialized: false,

        migrateForTest(saved) {
            return migrateSave(saved);
        },

        /**
         * Registra como uma fatia do estado deve ser persistida.
         * @param {string} path caminho em GameState, ex.: "world.itemRanking"
         * @param {(slice: object) => object} serialize versão a gravar
         */
        registerSerializer(path, serialize) {
            if (!path || typeof serialize !== 'function') return false;
            stateSerializers.set(String(path), serialize);
            return true;
        },

        /**
         * Mostra como uma fatia ficaria no disco, sem gravar nada.
         * Usado por diagnósticos e pelo teste de integração.
         */
        serializeStateForTest(path) {
            const serialize = stateSerializers.get(String(path));
            const target = resolveStatePath(path);
            if (!serialize || !target || typeof target !== 'object') return null;
            return serialize(target);
        },

        save(reason = 'manual') {
            try {
                Aethra.GameState.meta = Aethra.GameState.meta || {};
                Aethra.GameState.meta.schemaVersion = CURRENT_SCHEMA_VERSION;
                const data = JSON.stringify(Aethra.GameState, buildSaveReplacer());
                localStorage.setItem(SAVE_KEY, data);

                Aethra.EventBus.emit('save:completed', {
                    key: SAVE_KEY,
                    reason,
                    savedAt: Date.now()
                });

                console.log(`[SaveManager] Jogo salvo (${reason}).`);
                return true;
            } catch (error) {
                console.error('[SaveManager] Erro ao salvar o jogo:', error);

                Aethra.EventBus.emit('save:error', {
                    operation: 'save',
                    error
                });

                return false;
            }
        },

        load() {
            try {
                const rawData = localStorage.getItem(SAVE_KEY);

                if (!rawData) {
                    Aethra.EventBus.emit('save:not-found', { key: SAVE_KEY });
                    return false;
                }

                const parsedData = JSON.parse(rawData);

                if (!isObject(parsedData)) {
                    throw new Error('O conteúdo do save não representa um GameState válido.');
                }

                const migration = migrateSave(parsedData);
                const restoredState = mergeState(defaultState, migration.state);
                replaceState(Aethra.GameState, restoredState);

                if (migration.fromVersion !== migration.toVersion) {
                    Aethra.EventBus.emit('save:migrated', migration);
                }

                Aethra.EventBus.emit('save:loaded', {
                    key: SAVE_KEY,
                    state: Aethra.GameState
                });

                // Os HUDs podem ouvir este evento para redesenhar toda a interface.
                Aethra.EventBus.emit('state:restored', Aethra.GameState);

                console.log('[SaveManager] Progresso carregado.');
                return true;
            } catch (error) {
                console.error('[SaveManager] Erro ao carregar o jogo:', error);

                Aethra.EventBus.emit('save:error', {
                    operation: 'load',
                    error
                });

                return false;
            }
        },

        reset(options = {}) {
            const reload = options.reload !== false;

            try {
                localStorage.removeItem(SAVE_KEY);
                localStorage.removeItem('aethra_lobby_slot_0');
                localStorage.removeItem('aethra_lobby_slot_1');
                localStorage.removeItem('aethra_lobby_slot_2');
                localStorage.removeItem('aethra_active_slot');

                if (Aethra.GameState && Aethra.GameState.hero) {
                    Aethra.GameState.hero.characterCreated = false;
                }

                replaceState(Aethra.GameState, defaultState);

                Aethra.EventBus.emit('save:reset', {
                    key: SAVE_KEY,
                    state: Aethra.GameState
                });

                console.log('[SaveManager] Save e slots de lobby apagados. Estado inicial restaurado.');

                if (reload && typeof location !== 'undefined') {
                    location.reload();
                }

                return true;
            } catch (error) {
                console.error('[SaveManager] Erro ao resetar o jogo:', error);

                Aethra.EventBus.emit('save:error', {
                    operation: 'reset',
                    error
                });

                return false;
            }
        },

        resetProgress(reload = true) {
            return this.reset({ reload: reload !== false });
        },

        deleteSave(reload = true) {
            return this.reset({ reload: reload !== false });
        },

        exists() {
            return localStorage.getItem(SAVE_KEY) !== null;
        },

        init() {
            if (this.initialized || initialized) return;
            this.initialized = true;
            initialized = true;

            // O load precisa acontecer antes dos outros módulos renderizarem seus HUDs.
            this.load();

            const criticalEvents = [
                'itemObtained',
                'xpChanged',
                'levelUp',
                'character:created',
                'skill-point:spent',
                'skill:training-mode-changed',
                'discipline:xp-changed',
                'profession:policy-changed',
                'crafting:completed',
                'crafting:recipe-discovered',
                'maintenance:policy-changed',
                'maintenance:repaired',
                'equipment:durability-changed',
                'hero:death-penalty',
                'goldChanged',
                'statsChanged',
                'itemEquipped',
                'itemUnequipped',
                'bag:items-added',
                'bag:item-removed',
                'hunt:started',
                'hunt:ended',
                'hunt:supply-used',
                'hunt:record-updated',
                'coliseum:match-resolved',
                'coliseum:wager-locked',
                'coliseum:wager-cancelled',
                'coliseum:wager-settled',
                'item-ranking:updated',
                'item-ranking:removed',
                'questUpdated'
            ];

            criticalEvents.forEach((eventName) => {
                Aethra.EventBus.on(eventName, () => scheduleAutoSave(eventName));
            });

            // Salvamento extra quando a aba é fechada ou recarregada.
            window.addEventListener('beforeunload', () => {
                this.save('beforeunload');
            });

            Aethra.EventBus.emit('save:ready', {
                key: SAVE_KEY,
                autoSaveEvents: criticalEvents.slice()
            });
        }
    };

    Aethra.SaveManager.init();
})(window.Aethra);
