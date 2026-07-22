// LobbyUI.js — Tela de seleção de personagens (3 slots com multi-save)
(function initLobbyUI(Aethra) {
    "use strict";
    if (!Aethra?.EventBus) return;

    // ─── constants ─────────────────────────────────────────────────────────
    const SLOT_KEYS  = ["aethra_lobby_slot_0", "aethra_lobby_slot_1", "aethra_lobby_slot_2"];
    const MAIN_SAVE  = typeof window.AETHRA_SAVE_KEY === "string" && window.AETHRA_SAVE_KEY.trim()
        ? window.AETHRA_SAVE_KEY.trim()
        : "aethra_save_v71_disciplines";
    const ACTIVE_KEY = "aethra_active_slot";

    const ARCHETYPE_ICONS = {
        vanguard:   "⚔",
        berserker:  "✕",
        arcanist:   "✦",
        ranger:     "➶",
        nightblade: "†",
        templar:    "◆"
    };

    const ARCHETYPE_NAMES = {
        vanguard:   "Vanguarda",
        berserker:  "Berserker",
        arcanist:   "Arcanista",
        ranger:     "Batedor",
        nightblade: "Lâmina Sombria",
        templar:    "Templário"
    };

    const esc = (v) => String(v ?? "")
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;");

    const fmt = (v) => new Intl.NumberFormat("pt-BR").format(Math.floor(Number(v) || 0));

    Aethra.LobbyUI = {
        active: false,
        open: null,
        exit: null
    };

    // ─── slot storage ───────────────────────────────────────────────────────
    function readSlot(n) {
        try {
            const raw = localStorage.getItem(SLOT_KEYS[n]);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    function writeSlot(n, state) {
        try {
            localStorage.setItem(SLOT_KEYS[n], JSON.stringify(state));
            return true;
        } catch { return false; }
    }

    function deleteSlot(n) {
        localStorage.removeItem(SLOT_KEYS[n]);
    }

    function getActiveSlot() {
        const v = parseInt(localStorage.getItem(ACTIVE_KEY) ?? "-1", 10);
        return [0, 1, 2].includes(v) ? v : -1;
    }

    function setActiveSlot(n) {
        localStorage.setItem(ACTIVE_KEY, String(n));
    }

    // ─── migration: old single save → slot 0 ───────────────────────────────
    function migrateOldSave() {
        if (readSlot(0) !== null) return; // already migrated
        try {
            const old = localStorage.getItem(MAIN_SAVE);
            if (!old) return;
            const parsed = JSON.parse(old);
            if (parsed?.hero?.characterCreated) {
                writeSlot(0, parsed);
                setActiveSlot(0);
                console.log("[LobbyUI] Save antigo migrado para slot 0.");
            }
        } catch { /* ignore */ }
    }

    // ─── xp progress ───────────────────────────────────────────────────────
    function xpPercent(hero) {
        const cur = Number(hero?.xpCurrent || hero?.xp || 0);
        const needed = Number(hero?.xpTotal || hero?.xpNeeded || 100);
        return needed > 0 ? Math.min(100, Math.round((cur / needed) * 100)) : 0;
    }

    // ─── render ────────────────────────────────────────────────────────────
    function slotHTML(n) {
        const data = readSlot(n);
        const hero = data?.hero ?? null;
        const filled = hero?.characterCreated === true;

        if (filled) {
            const arch   = hero.archetypeId || "vanguard";
            const icon   = ARCHETYPE_ICONS[arch] || "⚔";
            const cls    = ARCHETYPE_NAMES[arch] || arch;
            const lvl    = hero.level || 1;
            const gold   = hero.gold || 0;
            const xp     = xpPercent(hero);
            const lastZone = data?.huntState?.currentZoneName || data?.meta?.lastZone || "Bosque dos Sussurros";

            return `
            <div class="lobby-slot lobby-slot--filled" data-slot-index="${n}">
                <span class="lobby-slot__badge">Slot ${n + 1}</span>
                <div class="lobby-slot__archetype-icon">${esc(icon)}</div>
                <div class="lobby-slot__name">${esc(hero.name || "Herói")}</div>
                <div class="lobby-slot__class">${esc(cls)}</div>
                <div class="lobby-slot__stats">
                    <div class="lobby-slot__stat">
                        <span>Nível</span>
                        <strong>${esc(lvl)}</strong>
                    </div>
                    <div class="lobby-slot__stat">
                        <span>Ouro</span>
                        <strong>${fmt(gold)} G</strong>
                    </div>
                    <div class="lobby-slot__stat">
                        <span>Última zona</span>
                        <strong>${esc(lastZone)}</strong>
                    </div>
                    <div class="lobby-slot__stat">
                        <span>HP</span>
                        <strong>${fmt(hero.maxHp || hero.stats?.maxHp || 0)}</strong>
                    </div>
                </div>
                <div class="lobby-slot__xpbar">
                    <div class="lobby-slot__xpbar-fill" style="width:${xp}%"></div>
                </div>
                <div class="lobby-slot__actions">
                    <button type="button" class="lobby-play-btn" data-lobby-play="${n}">
                        ▶ Jogar
                    </button>
                    <button type="button" class="lobby-delete-btn" data-lobby-delete="${n}"
                        title="Apagar personagem" aria-label="Apagar ${esc(hero.name || "personagem")}">Excluir</button>
                </div>
            </div>`;
        }

        return `
        <button type="button" class="lobby-slot lobby-slot--empty" data-lobby-create="${n}">
            <span class="lobby-slot__empty-icon">+</span>
            <span class="lobby-slot__empty-label">Slot ${n + 1}<br>Criar herói</span>
        </button>`;
    }

    function renderLobby() {
        const view = document.getElementById("lobby-view");
        if (!view) return;

        view.innerHTML = `
        <div class="lobby-title">
            <span class="lobby-title__eyebrow">Bem-vindo a</span>
            <span class="lobby-title__main">Crônicas de Aethra</span>
            <span class="lobby-title__sub">Escolha seu herói para continuar</span>
        </div>

        <div class="lobby-slots">
            ${slotHTML(0)}
            ${slotHTML(1)}
            ${slotHTML(2)}
        </div>

        <p class="lobby-footer">Aethra Engine · Slots salvos localmente neste dispositivo</p>`;

        bindLobbyEvents(view);
    }

    // ─── actions ───────────────────────────────────────────────────────────
    function playSlot(n) {
        const data = readSlot(n);
        if (!data?.hero?.characterCreated) return createFromSlot(n);

        setActiveSlot(n);

        // Load full GameState from this slot into live state
        try {
            const SM = Aethra.SaveManager;
            const mergeState = SM?._merge;

            // Deep-copy slot data into GameState via replaceState-like approach
            // We can't call load() (it reads from MAIN_SAVE), so we use a workaround:
            // write the slot to MAIN_SAVE then call load()
            localStorage.setItem(MAIN_SAVE, JSON.stringify(data));
            SM.load();
        } catch (e) {
            console.error("[LobbyUI] Erro ao carregar slot:", e);
        }

        exitLobby(() => {
            Aethra.UIManager?.setPrimaryView?.("city", { source: "lobby" });
            Aethra.RenderEngine?.renderAll?.();
        });
    }

    function createFromSlot(n) {
        pendingSlot = n;
        setActiveSlot(n);

        // Reset hero so CharacterCreationUI shows
        if (Aethra.GameState?.hero) {
            Aethra.GameState.hero.characterCreated = false;
        }

        exitLobby(() => {
            Aethra.CharacterCreationUI?.show?.();
        });
    }

    let pendingSlot = -1;

    function confirmDelete(n) {
        const hero = readSlot(n)?.hero;
        if (!hero) return;

        const modal = document.createElement("div");
        modal.className = "lobby-confirm";
        modal.innerHTML = `
        <div class="lobby-confirm__box">
            <div class="lobby-confirm__icon">×</div>
            <div class="lobby-confirm__title">Apagar Personagem?</div>
            <p class="lobby-confirm__body">
                <span class="lobby-confirm__name">${esc(hero.name)}</span><br>
                Nível ${hero.level || 1} · ${ARCHETYPE_NAMES[hero.archetypeId] || hero.archetypeId}<br><br>
                Esta ação é permanente e não pode ser desfeita.
            </p>
            <div class="lobby-confirm__actions">
                <button type="button" class="lobby-confirm__cancel" data-lobby-cancel>Cancelar</button>
                <button type="button" class="lobby-confirm__delete" data-lobby-confirm-delete="${n}">Apagar</button>
            </div>
        </div>`;

        modal.querySelector("[data-lobby-cancel]").addEventListener("click", () => modal.remove());
        modal.querySelector(`[data-lobby-confirm-delete]`).addEventListener("click", () => {
            deleteSlot(n);
            modal.remove();
            renderLobby();
        });

        document.body.appendChild(modal);
    }

    // ─── exit animation ────────────────────────────────────────────────────
    function exitLobby(callback) {
        const view = document.getElementById("lobby-view");
        if (!view) { callback?.(); return; }
        view.classList.add("is-exiting");
        setTimeout(() => {
            view.classList.add("is-hidden");
            view.classList.remove("is-exiting");
            Aethra.LobbyUI.active = false;
            callback?.();
        }, 450);
    }

    // ─── event binding ─────────────────────────────────────────────────────
    function bindLobbyEvents(view) {
        view.addEventListener("click", (e) => {
            const playBtn   = e.target.closest("[data-lobby-play]");
            const deleteBtn = e.target.closest("[data-lobby-delete]");
            const createBtn = e.target.closest("[data-lobby-create]");

            if (playBtn)   return playSlot(parseInt(playBtn.dataset.lobbyPlay, 10));
            if (deleteBtn) return confirmDelete(parseInt(deleteBtn.dataset.lobbyDelete, 10));
            if (createBtn) return createFromSlot(parseInt(createBtn.dataset.lobbyCreate, 10));
        });
    }

    // ─── intercept CharacterCreationUI — save to pending slot on commit ────
    Aethra.EventBus.on("character:created", () => {
        const slot = pendingSlot >= 0 ? pendingSlot : getActiveSlot();
        if (slot < 0) return;

        // Give CharacterBuildSystem a tick to finish writing hero before we snapshot
        setTimeout(() => {
            writeSlot(slot, JSON.parse(JSON.stringify(Aethra.GameState)));
            console.log(`[LobbyUI] Personagem salvo no slot ${slot}.`);
            pendingSlot = -1;
        }, 200);
    });

    // Auto-sync active slot on save events
    Aethra.EventBus.on("save:completed", () => {
        const slot = getActiveSlot();
        if (slot < 0 || Aethra.LobbyUI.active) return;
        try {
            const raw = localStorage.getItem(MAIN_SAVE);
            if (raw) writeSlot(slot, JSON.parse(raw));
        } catch { /* ignore */ }
    });

    // ─── boot hook — intercept maybeShowCreation ───────────────────────────
    // Patch CharacterCreationUI to not auto-show while lobby is active
    const _origMaybe = Aethra.CharacterCreationUI?.show;

    function checkAutoCreateIfEmpty() {
        const slot0 = readSlot(0);
        const slot1 = readSlot(1);
        const slot2 = readSlot(2);

        const hasAnyCharacter = (slot0?.hero?.characterCreated === true) ||
                               (slot1?.hero?.characterCreated === true) ||
                               (slot2?.hero?.characterCreated === true);

        if (!hasAnyCharacter) {
            console.log("[LobbyUI] Nenhum personagem criado encontrado. Abrindo tela de criação de personagem.");
            window.setTimeout(() => {
                createFromSlot(0);
            }, 100);
        }
    }

    Aethra.EventBus.on("engine:ready", () => {
        Aethra.LobbyUI.active = true;
        migrateOldSave();
        renderLobby();

        // Show lobby, hide game content underneath
        const view = document.getElementById("lobby-view");
        if (view) {
            view.classList.remove("is-hidden");
        }
        checkAutoCreateIfEmpty();
    });

    Aethra.EventBus.on("EngineReady", () => {
        // Secondary trigger fallback (same as engine:ready)
        if (!Aethra.LobbyUI.active) {
            Aethra.LobbyUI.active = true;
            migrateOldSave();
            renderLobby();
            const view = document.getElementById("lobby-view");
            if (view) view.classList.remove("is-hidden");
            checkAutoCreateIfEmpty();
        }
    });

    // Public API
    Aethra.LobbyUI = {
        active: false,
        open: () => {
            Aethra.LobbyUI.active = true;
            migrateOldSave();
            renderLobby();
            const view = document.getElementById("lobby-view");
            if (view) view.classList.remove("is-hidden");
        },
        exit: exitLobby
    };

})(window.Aethra = window.Aethra || {});
