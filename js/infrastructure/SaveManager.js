// SaveManager.js
(function (Aethra) {
    'use strict';

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus) {
        throw new Error('[SaveManager] game-core.js deve ser carregado antes de SaveManager.js.');
    }

    const SAVE_KEY = 'aethra_save_v68';
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

                const restoredState = mergeState(defaultState, parsedData);
                replaceState(Aethra.GameState, restoredState);

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
                'goldChanged',
                'statsChanged',
                'itemEquipped',
                'itemUnequipped',
                'bag:items-added',
                'bag:item-removed',
                'hunt:started',
                'hunt:ended',
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
