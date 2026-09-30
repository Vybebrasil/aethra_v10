/*
 * Ui3Shell.js — raiz e ciclo de vida da UI 3.0.
 *
 * A UI 3.0 é construída em #ui3-root, fora das camadas legadas, e substitui a
 * interface clássica tela a tela. A escolha fica em
 * SettingsManager.interfaceVersion ("classic" | "v3"); este módulo só
 * apresenta e reage a ela.
 *
 * Desenvolvimento:
 *   ?ui=3 ou ?ui=classic  troca a interface (persistido nas preferências)
 *   ?ui3=galeria          abre a galeria de componentes sobre o jogo
 */
(function initUi3Shell(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const ROOT_ID = "ui3-root";
    let initialized = false;
    let galleryOpen = false;

    function kit() {
        return Aethra.Ui3Kit;
    }

    function ensureRoot() {
        let root = document.getElementById(ROOT_ID);
        if (!root) {
            root = document.createElement("div");
            root.id = ROOT_ID;
            root.className = "ui3";
            root.hidden = true;
            document.body.appendChild(root);
        }
        return root;
    }

    function currentVersion() {
        return Aethra.SettingsManager?.getInterfaceVersion?.() || "classic";
    }

    // "Reduzir animações" das Opções (SettingsManager.hud.reduceMotion).
    function applyMotionPreference() {
        const hud = Aethra.SettingsManager?.get?.("hud", {}) || {};
        ensureRoot().classList.toggle("ui3-reduce-motion", hud.reduceMotion === true);
    }

    function applyVersion() {
        const active = currentVersion() === "v3";
        applyMotionPreference();
        document.body.classList.toggle("ui3-active", active);
        syncRootVisibility();
        Aethra.EventBus.emit("ui3:version-applied", { active, version: currentVersion() });
        return active;
    }

    /*
     * Camadas clássicas que uma tela da UI 3.0 pode cobrir. A tela declara
     * data-ui3-covers; a camada coberta vira inert para não receber foco nem
     * clique por baixo. Some junto com a UI clássica na fase 5.
     */
    const LEGACY_COVER_TARGETS = Object.freeze({
        world: ["#world-layer", "#hud-layer"],
        topbar: ["#hud-layer > .topbar"]
    });

    function syncLegacyCover(root) {
        const covered = new Set();
        root.querySelectorAll("[data-ui3-screen][data-ui3-covers]:not([hidden])").forEach((screen) => {
            String(screen.dataset.ui3Covers || "").split(/\s+/).forEach((key) => {
                (LEGACY_COVER_TARGETS[key] || []).forEach((selector) => covered.add(selector));
            });
        });
        Object.values(LEGACY_COVER_TARGETS).flat().forEach((selector) => {
            document.querySelectorAll(selector).forEach((element) => {
                element.inert = covered.has(selector);
            });
        });
    }

    // A raiz aparece quando há algo da UI 3.0 para mostrar.
    function syncRootVisibility() {
        const root = ensureRoot();
        root.hidden = !galleryOpen && !root.querySelector("[data-ui3-screen]:not([hidden])");
        syncLegacyCover(root);
    }

    /*
     * O jogo em si (não a tela de título nem a criação de personagem) está na tela e a
     * UI 3.0 está ligada: só então as telas de jogo da UI 3.0 aparecem.
     */
    /*
     * Uma tela de tela cheia (título) pode segurar as telas de jogo. Quem
     * segura avisa por ui3:screens-changed, e as telas se ressincronizam.
     */
    const gameHolds = new Set();

    function holdGame(key, held) {
        const before = gameHolds.size;
        if (held) gameHolds.add(key);
        else gameHolds.delete(key);
        if (gameHolds.size !== before) Aethra.EventBus.emit("ui3:screens-changed", { holds: [...gameHolds] });
        return gameHolds.size > 0;
    }

    function canShowGame() {
        if (currentVersion() !== "v3") return false;
        if (gameHolds.size > 0) return false;
        if (document.body.classList.contains("is-creating-character")) return false;
        return Aethra.GameState?.hero?.characterCreated === true;
    }

    function readUrlOptions() {
        let params;
        try {
            params = new URLSearchParams(window.location.search);
        } catch (error) {
            return;
        }
        const requested = String(params.get("ui") || "").trim().toLowerCase();
        const version = requested === "3" ? "v3" : requested;
        if (version && Aethra.SettingsManager?.isValidInterfaceVersion?.(version)) {
            Aethra.SettingsManager.setInterfaceVersion(version, { source: "url" });
        }
        if (String(params.get("ui3") || "").toLowerCase() === "galeria") {
            showGallery();
        }
    }

    function itemIcon(templateId) {
        return Aethra.GameData?.getItemImage?.(templateId) || "";
    }

    function galleryHTML() {
        const K = kit();
        const group = (title, content) => `<div class="ui3-gallery__group"><span class="ui3-eyebrow">${K.esc(title)}</span>${content}</div>`;
        const swordIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 17.5 3 6V3h3l11.5 11.5"></path><path d="m13 19 6-6"></path><path d="m16 16 4 4"></path></svg>`;

        const buttons = `<div class="ui3-stack">
            ${K.button({ label: "Equipar", variant: "primary" })}
            ${K.button({ label: "Ver mapa" })}
            ${K.button({ label: "Encerrar expedição", variant: "danger" })}
            ${K.button({ label: "Ouro insuficiente", disabled: true })}
            <div class="ui3-row">${K.button({ label: "Atacar", icon: swordIcon, variant: "ghost" })}${K.button({ icon: swordIcon, ariaLabel: "Atacar" })}</div>
        </div>`;

        const bars = `<div class="ui3-stack">
            ${K.bar({ kind: "hp", value: 58, max: 75, label: "HP" })}
            ${K.bar({ kind: "mana", value: 26, max: 26, label: "Mana" })}
            ${K.bar({ kind: "vigor", value: 72, max: 80, label: "Vigor" })}
            ${K.bar({ kind: "xp", value: 42, max: 100, label: "Experiência" })}
        </div>`;

        const slots = `<div class="ui3-row">
            ${K.slot({ empty: true, hotkey: "6" })}
            ${K.slot({ icon: itemIcon("eg_sword_l1"), label: "Espada de Recruta", rarity: "common" })}
            ${K.slot({ icon: itemIcon("eg_ring_l1"), label: "Anel Recruta", rarity: "uncommon" })}
            ${K.slot({ icon: itemIcon("eg_axe_l5"), label: "Machado", rarity: "rare", selected: true })}
            ${K.slot({ icon: itemIcon("eg_focus_l6"), label: "Foco", rarity: "epic" })}
            ${K.slot({ icon: itemIcon("eg_bow_l10"), label: "Arco", rarity: "legendary" })}
            ${K.slot({ icon: itemIcon("potion_health"), label: "Poção de Vida, 5 unidades", quantity: 5, hotkey: "4" })}
            ${K.slot({ glyph: "✚", label: "Cura, recarregando", hotkey: "3", cooldown: 3 })}
        </div>`;

        const navigation = `<div class="ui3-stack">
            ${K.tabs({ label: "Detalhes da expedição", items: [{ id: "resumo", label: "Resumo" }, { id: "loot", label: "Loot" }, { id: "registro", label: "Registro" }], selected: "resumo" })}
            <div class="ui3-row">${K.chip({ label: "Tudo 12", pressed: true })}${K.chip({ label: "Materiais 3" })}${K.chip({ label: "Consumíveis 2" })}</div>
        </div>`;

        const indicators = `<div class="ui3-row" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr))">
            ${K.kpi({ label: "XP / hora", value: "1.240" })}
            ${K.kpi({ label: "Lucro", value: "+412", tone: "positive" })}
        </div>`;

        const type = `<div class="ui3-stack">
            <p class="ui3-display">Bosque dos Sussurros</p>
            <p class="ui3-window-title">Mochila e Equipamento</p>
            <p class="ui3-heading">Herói de Teste</p>
            <p style="margin:0">Corte Preciso acerta Orc Guerreiro</p>
            <p class="ui3-caption" style="margin:0">Raro · Machado · Nv 5</p>
            <span class="ui3-eyebrow">XP / hora</span>
        </div>`;

        const samplePanel = K.panel({
            eyebrow: "Expedição",
            title: "Bosque dos Sussurros",
            body: indicators
        });

        return `<section class="ui3-gallery" role="dialog" aria-modal="true" aria-labelledby="ui3-gallery-title" data-ui3-gallery>
            <header class="ui3-gallery__head">
                <div class="ui3-stack">
                    <span class="ui3-eyebrow">UI 3.0 · Ferro e Ouro</span>
                    <h2 id="ui3-gallery-title" class="ui3-window-title">Galeria de componentes</h2>
                    <span class="ui3-caption">Renderizada dentro do jogo, com todo o CSS clássico carregado ao lado.</span>
                </div>
                ${K.button({ label: "Fechar", attributes: { "data-ui3-gallery-close": "" } })}
            </header>
            <div class="ui3-gallery__grid">
                ${group("Botões", buttons)}
                ${group("Barras de recurso", bars)}
                ${group("Slots de item e habilidade", slots)}
                ${group("Abas e filtros", navigation)}
                ${group("Painel sobre o mapa", samplePanel)}
                ${group("Tipografia", type)}
            </div>
        </section>`;
    }

    function onGalleryKey(event) {
        if (event.key === "Escape") hideGallery();
    }

    function showGallery() {
        if (!kit()) return false;
        const root = ensureRoot();
        root.querySelector("[data-ui3-gallery]")?.remove();
        root.insertAdjacentHTML("beforeend", galleryHTML());
        root.querySelector("[data-ui3-gallery-close]")?.addEventListener("click", hideGallery);
        document.addEventListener("keydown", onGalleryKey);
        galleryOpen = true;
        syncRootVisibility();
        return true;
    }

    function hideGallery() {
        ensureRoot().querySelector("[data-ui3-gallery]")?.remove();
        document.removeEventListener("keydown", onGalleryKey);
        galleryOpen = false;
        syncRootVisibility();
        return true;
    }

    function init() {
        if (initialized) return applyVersion();
        initialized = true;
        ensureRoot();
        readUrlOptions();
        return applyVersion();
    }

    Aethra.Ui3Shell = {
        get root() {
            return ensureRoot();
        },
        init,
        isActive: () => currentVersion() === "v3",
        canShowGame,
        holdGame,
        refresh: syncRootVisibility,
        showGallery,
        hideGallery,
        isGalleryOpen: () => galleryOpen
    };

    // Inscrito no carregamento: uma troca de interface feita antes do
    // engine:ready (por outro módulo ou teste) não pode se perder.
    Aethra.EventBus.on("settings:interface-changed", applyVersion);
    Aethra.EventBus.on("settings:changed", applyMotionPreference);
    Aethra.EventBus.on("engine:ready", init);
})(window.Aethra = window.Aethra || {});
