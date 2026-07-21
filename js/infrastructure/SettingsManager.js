// SettingsManager.js - Preferências persistentes do jogador
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.EventBus || !Aethra.GameState) {
        throw new Error(
            "SettingsManager.js requer game-core.js carregado antes deste arquivo."
        );
    }

    const configuredStorageKey = typeof window.AETHRA_SETTINGS_KEY === "string"
        ? window.AETHRA_SETTINGS_KEY.trim()
        : "";
    const DEFAULT_STORAGE_KEY = configuredStorageKey || "aethra.settings";
    const LEGACY_BATTLE_MODE_KEY = configuredStorageKey
        ? `${configuredStorageKey}.battleMode`
        : "aethra.battleMode";
    const VALID_BATTLE_MODES = Object.freeze(["cards", "map2d"]);
    const VALID_COMBAT_SPEEDS = Object.freeze([1, 2, 4]);
    const DEFAULT_SETTINGS = Object.freeze({
        battleMode: "cards",
        combatSpeed: 1
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

    function normalizeCombatSpeed(value) {
        const speed = Number(value);
        return VALID_COMBAT_SPEEDS.includes(speed)
            ? speed
            : DEFAULT_SETTINGS.combatSpeed;
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
            const combatSpeed = normalizeCombatSpeed(storedSettings.combatSpeed);

            this.settings = {
                ...DEFAULT_SETTINGS,
                ...storedSettings,
                battleMode,
                combatSpeed
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

        set(key, value, options = {}) {
            const settingKey = String(key || "").trim();
            if (!settingKey) return false;
            if (settingKey === "battleMode") {
                return this.setBattleMode(value, options);
            }
            if (settingKey === "combatSpeed") {
                return this.setCombatSpeed(value, options);
            }

            const previousValue = clone(this.settings[settingKey]);
            this.settings[settingKey] = clone(value);
            this.syncGameState();
            this.save();
            const payload = {
                key: settingKey,
                value: clone(value),
                previousValue,
                changed: JSON.stringify(previousValue) !== JSON.stringify(value),
                source: options.source || "settings-ui",
                timestamp: Date.now()
            };
            Aethra.EventBus.emit("settings:changed", clone(payload));
            return clone(value);
        },

        getBattleMode() {
            return normalizeBattleMode(this.settings.battleMode);
        },

        getCombatSpeed() {
            return normalizeCombatSpeed(this.settings.combatSpeed);
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

        setCombatSpeed(speed, options = {}) {
            const nextSpeed = normalizeCombatSpeed(speed);
            const previousSpeed = this.getCombatSpeed();

            this.settings.combatSpeed = nextSpeed;
            this.syncGameState();
            this.save();
            this.syncUI();

            const payload = {
                key: "combatSpeed",
                value: nextSpeed,
                combatSpeed: nextSpeed,
                previousValue: previousSpeed,
                changed: previousSpeed !== nextSpeed,
                source: options.source || "combat-hud",
                timestamp: Date.now()
            };

            Aethra.EventBus.emit("settings:changed", clone(payload));
            Aethra.EventBus.emit("settings:combat-speed-changed", clone(payload));
            return nextSpeed;
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
            const currentCombatSpeed = this.getCombatSpeed();

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
                    ? "Modo ativo: Cartas táticas"
                    : "Modo ativo: Mapa 2D em tempo real";
                status.dataset.mode = currentMode;
            }

            root.querySelectorAll("[data-battle-speed]")
                .forEach((button) => {
                    const active = Number(button.dataset.battleSpeed) === currentCombatSpeed;
                    button.classList.toggle("is-active", active);
                    button.setAttribute("aria-pressed", active ? "true" : "false");
                });

            return true;
        }
    };

    Aethra.SettingsManager.init();
})(window.Aethra);
