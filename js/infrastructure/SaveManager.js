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
    const CURRENT_SCHEMA_VERSION = 73;
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

    Aethra.SaveManager = {
        key: SAVE_KEY,
        initialized: false,

        save(reason = 'manual') {
            try {
                Aethra.GameState.meta = Aethra.GameState.meta || {};
                Aethra.GameState.meta.schemaVersion = CURRENT_SCHEMA_VERSION;
                const data = JSON.stringify(Aethra.GameState);
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
                replaceState(Aethra.GameState, defaultState);

                Aethra.EventBus.emit('save:reset', {
                    key: SAVE_KEY,
                    state: Aethra.GameState
                });

                console.log('[SaveManager] Save apagado e estado inicial restaurado.');

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
