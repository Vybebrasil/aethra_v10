// SettingsManager.js - Preferências persistentes do jogador
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.EventBus || !Aethra.GameState) {
        throw new Error(
            "SettingsManager.js requer game-core.js carregado antes deste arquivo."
        );
    }

    const DEFAULT_STORAGE_KEY = "aethra.settings";
    const LEGACY_BATTLE_MODE_KEY = "aethra.battleMode";
    const VALID_BATTLE_MODES = Object.freeze(["cards", "map2d"]);
    const DEFAULT_SETTINGS = Object.freeze({
        battleMode: "cards"
    });

    function clone(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }

    function readStorage(key) {
        try {
            return window.localStorage?.getItem(key) ?? null;
        } catch (error) {
            console.warn("SettingsManager: localStorage indisponível.", error);
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            window.localStorage?.setItem(key, value);
            return true;
        } catch (error) {
            console.warn("SettingsManager: não foi possível salvar as preferências.", error);
            return false;
        }
    }

    function normalizeBattleMode(value) {
        const mode = String(value || "").trim().toLowerCase();
        return VALID_BATTLE_MODES.includes(mode)
            ? mode
            : DEFAULT_SETTINGS.battleMode;
    }

    Aethra.SettingsManager = {
        initialized: false,
        storageKey: DEFAULT_STORAGE_KEY,
        settings: { ...DEFAULT_SETTINGS },
        uiBound: false,

        init(options = {}) {
            if (options.storageKey) {
                this.storageKey = String(options.storageKey);
            }

            if (!this.initialized) {
                this.load();
                this.save();
                this.initialized = true;
            }

            this.bindUIWhenReady();
            this.syncUI();

            const state = this.getAll();

            Aethra.EventBus.emit("SettingsManagerReady", state);
            Aethra.EventBus.emit("settings:ready", state);

            return state;
        },

        load() {
            let storedSettings = {};
            const raw = readStorage(this.storageKey);

            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === "object") {
                        storedSettings = parsed;
                    }
                } catch (error) {
                    console.warn(
                        "SettingsManager: preferências inválidas foram ignoradas.",
                        error
                    );
                }
            }

            const legacyBattleMode = readStorage(LEGACY_BATTLE_MODE_KEY);
            const battleMode = normalizeBattleMode(
                storedSettings.battleMode ?? legacyBattleMode
            );

            this.settings = {
                ...DEFAULT_SETTINGS,
                ...storedSettings,
                battleMode
            };

            this.syncGameState();
            return this.getAll();
        },

        save() {
            const payload = JSON.stringify(this.settings);
            const saved = writeStorage(this.storageKey, payload);

            // Chave simples mantida para facilitar compatibilidade e inspeção.
            writeStorage(LEGACY_BATTLE_MODE_KEY, this.settings.battleMode);

            return saved;
        },

        syncGameState() {
            Aethra.GameState.settings = {
                ...(Aethra.GameState.settings || {}),
                ...clone(this.settings)
            };
        },

        get(key, fallback = undefined) {
            if (!key) return this.getAll();
            return Object.prototype.hasOwnProperty.call(this.settings, key)
                ? this.settings[key]
                : fallback;
        },

        getAll() {
            return clone(this.settings);
        },

        getBattleMode() {
            return normalizeBattleMode(this.settings.battleMode);
        },

        isValidBattleMode(mode) {
            return VALID_BATTLE_MODES.includes(
                String(mode || "").trim().toLowerCase()
            );
        },

        setBattleMode(mode, options = {}) {
            if (!this.isValidBattleMode(mode)) {
                console.warn(
                    `SettingsManager: modo de batalha inválido: ${String(mode)}`
                );
                return false;
            }

            const nextMode = normalizeBattleMode(mode);
            const previousMode = this.getBattleMode();

            this.settings.battleMode = nextMode;
            this.syncGameState();
            this.save();
            this.syncUI();

            const payload = {
                key: "battleMode",
                value: nextMode,
                battleMode: nextMode,
                previousValue: previousMode,
                previousBattleMode: previousMode,
                changed: previousMode !== nextMode,
                source: options.source || "settings-ui",
                timestamp: Date.now()
            };

            Aethra.EventBus.emit("settings:changed", clone(payload));
            Aethra.EventBus.emit(
                "settings:battle-mode-changed",
                clone(payload)
            );

            return nextMode;
        },

        bindUIWhenReady() {
            if (document.readyState === "loading") {
                document.addEventListener(
                    "DOMContentLoaded",
                    () => {
                        this.bindUI();
                        this.syncUI();
                    },
                    { once: true }
                );
                return;
            }

            this.bindUI();
        },

        bindUI() {
            if (this.uiBound) return;
            this.uiBound = true;

            document.addEventListener("change", (event) => {
                const input = event.target?.closest?.(
                    "[data-battle-mode-option]"
                );

                if (!input || !input.checked) return;

                this.setBattleMode(input.value, {
                    source: "options-panel"
                });
            });

            document.addEventListener("click", (event) => {
                const control = event.target?.closest?.(
                    "[data-set-battle-mode]"
                );

                if (!control) return;

                const mode = control.dataset.setBattleMode;
                if (!this.isValidBattleMode(mode)) return;

                event.preventDefault();
                this.setBattleMode(mode, {
                    source: "options-panel-button"
                });
            });
        },

        syncUI(root = document) {
            if (!root?.querySelectorAll) return false;

            const currentMode = this.getBattleMode();

            root.querySelectorAll("[data-battle-mode-option]")
                .forEach((input) => {
                    const active = input.value === currentMode;
                    input.checked = active;
                    input.setAttribute(
                        "aria-checked",
                        active ? "true" : "false"
                    );

                    input.closest("[data-battle-mode-choice]")
                        ?.classList.toggle("is-selected", active);
                });

            root.querySelectorAll("[data-set-battle-mode]")
                .forEach((button) => {
                    const active =
                        button.dataset.setBattleMode === currentMode;
                    button.classList.toggle("is-selected", active);
                    button.setAttribute(
                        "aria-pressed",
                        active ? "true" : "false"
                    );
                });

            const status = root.querySelector(
                "#battle-mode-setting-status"
            );

            if (status) {
                status.textContent = currentMode === "cards"
                    ? "Modo ativo: Cartas"
                    : "Modo ativo: 3D/Mapa. Visualização em desenvolvimento.";
                status.dataset.mode = currentMode;
            }

            return true;
        }
    };

    Aethra.SettingsManager.init();
})(window.Aethra);
