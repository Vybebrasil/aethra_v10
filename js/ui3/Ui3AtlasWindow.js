/*
 * Ui3AtlasWindow.js — Mapa-Mundi na UI 3.0 (fase 4).
 *
 * Assume a janela "hunt-world-map-view" pelo Ui3Window/WindowManager, então
 * Aethra.openHuntWorldMap (botões "Ver mapa", atalho M, Cidade, Missões)
 * abre esta versão quando a UI 3.0 está ligada.
 *   leitura   HuntAtlas (expedições, criaturas, loot esperado, focos),
 *             QuestSystem/DisciplineSystem (rota recomendada)
 *   comandos  HuntAtlas.startRoute/startCreatureHunt, UIManager (Hunt)
 */
(function initUi3AtlasWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "hunt-world-map-view";
    const TABS = Object.freeze([
        { id: "expeditions", label: "Expedições" },
        { id: "creatures", label: "Caçadas" },
        { id: "focus", label: "Focos de ofício" }
    ]);
    const FOCUS_EVENT_LABELS = Object.freeze({
        chest: "Baús",
        locked_chest: "Baús trancados",
        secret_door: "Portas secretas",
        trap: "Armadilhas",
        mining: "Veios de minério",
        forge: "Forjas",
        herb: "Ervas",
        trail: "Trilhas",
        shrine: "Altares",
        camp: "Acampamentos"
    });

    const state = {
        tab: "expeditions",
        expedition: null,
        creature: null,
        focus: null,
        search: "",
        type: "all",
        biome: "all",
        access: "all",
        notice: null
    };
    const rendered = new WeakMap();
    let parts = {};

    function kit() {
        return Aethra.Ui3Kit;
    }

    function atlas() {
        return Aethra.HuntAtlas;
    }

    function patch(element, html) {
        if (!element || rendered.get(element) === html) return false;
        element.innerHTML = html;
        rendered.set(element, html);
        return true;
    }

    function number(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function normalized(value) {
        return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    }

    function heroLevel() {
        return atlas()?.heroLevel?.() || 1;
    }

    function activeHuntId() {
        return Aethra.GameState?.hunt?.isActive ? Aethra.GameState.hunt.huntId : null;
    }

    function creatureName(id) {
        return Aethra.GameData?.creatures?.[id]?.name || id;
    }

    function multiplier(value) {
        const amount = number(value, 1);
        return `${amount.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}×`;
    }

    function recommended() {
        const quest = Aethra.QuestSystem?.getGuidance?.() || null;
        const skill = Aethra.DisciplineSystem?.getFocusedGuidance?.() || null;
        return {
            questHuntId: quest?.huntId || null,
            skillHuntId: skill?.mapMode === "expeditions" ? skill.huntId : null,
            focusHuntId: skill?.mapMode === "hunts" ? skill.huntId : null,
            skill
        };
    }

    function notice() {
        const K = kit();
        return state.notice
            ? `<p class="ui3-notice ui3-notice--${K.esc(state.notice.tone)}" role="status">${K.esc(state.notice.text)}</p>`
            : "";
    }

    function chipsHTML(items) {
        const K = kit();
        return items.filter(Boolean).map((item) => `<span class="ui3-tag">${K.esc(item)}</span>`).join("");
    }

    function dangerHTML(level) {
        const danger = Math.max(0, Math.min(6, Math.round(number(level, 1))));
        return `<span class="ui3-danger" role="img" aria-label="Perigo ${danger} de 6">${Array.from({ length: 6 }, (_, index) => `<i class="${index < danger ? "is-on" : ""}"></i>`).join("")}</span>`;
    }

    function startButtonHTML(definition, attribute, idleLabel) {
        const K = kit();
        const locked = !atlas().isUnlocked(definition);
        const active = activeHuntId() === definition.id;
        return K.button({
            label: locked ? `Bloqueada até o nível ${K.formatNumber(definition.minLevel || definition.level || 1)}` : active ? "Voltar para a rota ativa" : idleLabel,
            variant: "primary",
            disabled: locked,
            attributes: { [attribute]: definition.id }
        });
    }

    function modifiersHTML(modifiers) {
        if (!modifiers) return "";
        const K = kit();
        const kpi = (label, value) => K.kpi({ label, value: multiplier(value ?? 1), tone: number(value ?? 1, 1) > 1 ? "positive" : number(value ?? 1, 1) < 1 ? "negative" : "" });
        return `<div class="ui3-kpi-grid ui3-kpi-grid--4">
                ${kpi("XP do herói", modifiers.combatXp)}
                ${kpi("Ouro", modifiers.gold)}
                ${kpi("Materiais", modifiers.materialChance)}
                ${kpi("Eventos", modifiers.eventChance)}
            </div>`;
    }

    /* ---------------------------------------------------------------
       Expedições
       --------------------------------------------------------------- */

    function selectedExpedition(list, recommendation) {
        const ids = list.map((definition) => definition.id);
        if (!ids.includes(state.expedition)) {
            state.expedition = [recommendation.questHuntId, recommendation.skillHuntId, activeHuntId(), list.find((definition) => atlas().isUnlocked(definition))?.id, ids[0]]
                .find((id) => id && ids.includes(id)) || null;
        }
        return list.find((definition) => definition.id === state.expedition) || null;
    }

    function expeditionsHTML() {
        const K = kit();
        const list = atlas().getExpeditions();
        const recommendation = recommended();
        const selected = selectedExpedition(list, recommendation);
        const unlocked = list.filter((definition) => atlas().isUnlocked(definition)).length;
        const nodes = list.map((definition) => {
            const locked = !atlas().isUnlocked(definition);
            const mark = definition.id === recommendation.questHuntId ? "Missão" : definition.id === recommendation.skillHuntId ? "Foco" : "";
            const x = Math.max(4, Math.min(96, number(definition.position?.x, 50)));
            const y = Math.max(6, Math.min(94, number(definition.position?.y, 50)));
            return `<button type="button" class="ui3-map-node${locked ? " is-locked" : ""}${definition.id === selected?.id ? " is-selected" : ""}${definition.id === activeHuntId() ? " is-active" : ""}" style="left:${x}%;top:${y}%" data-ui3-expedition="${K.esc(definition.id)}" aria-pressed="${definition.id === selected?.id ? "true" : "false"}" aria-label="${K.esc(definition.name)}, nível ${K.esc(definition.minLevel || 1)}${locked ? ", bloqueada" : ""}${mark ? `, recomendada pela ${mark === "Missão" ? "missão" : "habilidade em foco"}` : ""}">
                    <span class="ui3-map-node__dot" aria-hidden="true">${locked ? K.icon("skull", 14) : K.esc(definition.icon || "✦")}</span>
                    <span class="ui3-map-node__label"><strong>${K.esc(definition.name)}</strong><small>Nv ${K.esc(definition.minLevel || 1)}${mark ? ` · ${K.esc(mark)}` : ""}</small></span>
                </button>`;
        }).join("");
        const detail = selected ? `<span class="ui3-eyebrow">${K.esc(selected.region || "Região")}</span>
                <h3 class="ui3-quest-head__title">${K.esc(selected.name)}</h3>
                <div class="ui3-row">${chipsHTML([`Nv ${selected.minLevel || 1}+`, selected.biome, atlas().getRecommendedMode(selected)])}${dangerHTML(selected.danger)}</div>
                ${selected.id === recommendation.questHuntId ? `<p class="ui3-notice ui3-notice--ok">Destino da sua missão atual.</p>` : selected.id === recommendation.skillHuntId ? `<p class="ui3-notice ui3-notice--ok">Rota recomendada para ${K.esc(recommendation.skill?.name || "a habilidade em foco")}.</p>` : ""}
                ${selected.description ? `<p class="ui3-item-description">${K.esc(selected.description)}</p>` : ""}
                ${selected.focus ? `<div class="ui3-note"><span>Foco regional</span><strong>${K.esc(selected.focus.icon || "")} ${K.esc(selected.focus.name)}</strong></div>` : ""}
                ${modifiersHTML(selected.modifiers)}
                <section class="ui3-section"><span class="ui3-eyebrow">Principais recompensas</span><div class="ui3-row">${chipsHTML(selected.rewards || [])}</div></section>
                <section class="ui3-section"><span class="ui3-eyebrow">Criaturas conhecidas</span><div class="ui3-row">${chipsHTML(atlas().encounterCreatureIds(selected).map(creatureName))}</div></section>
                <div class="ui3-item-actions">${notice()}${startButtonHTML(selected, "data-ui3-expedition-start", "Entrar na expedição")}</div>`
            : `<p class="ui3-empty">Nenhuma expedição disponível.</p>`;
        return {
            main: `<div class="ui3-row-between"><span class="ui3-eyebrow">Herói Nv ${K.formatNumber(heroLevel())}</span><span class="ui3-caption">${unlocked} de ${list.length} expedições liberadas</span></div>
                <div class="ui3-map" role="group" aria-label="Mapa das regiões de Aethra">
                    <span class="ui3-map__compass" aria-hidden="true">N</span>
                    ${nodes}
                </div>`,
            detail
        };
    }

    /* ---------------------------------------------------------------
       Caçadas focadas
       --------------------------------------------------------------- */

    function filteredCreatures(catalog) {
        const query = normalized(state.search);
        const level = heroLevel();
        return catalog.filter((entry) => {
            const text = normalized([entry.name, entry.type, ...(entry.tags || []), ...(entry.hunts || []).flatMap((item) => [item.name, item.biome, item.region])].join(" "));
            if (query && !text.includes(query)) return false;
            if (state.type !== "all" && normalized(entry.type) !== normalized(state.type)) return false;
            if (state.biome !== "all" && !(entry.hunts || []).some((item) => normalized(item.biome) === normalized(state.biome))) return false;
            if (state.access === "unlocked" && level < number(entry.level, 1)) return false;
            if (state.access === "locked" && level >= number(entry.level, 1)) return false;
            return true;
        });
    }

    function optionsHTML(values, current, allLabel, label = (value) => value) {
        const K = kit();
        return `<option value="all">${K.esc(allLabel)}</option>${values.map((value) => `<option value="${K.esc(value)}"${value === current ? " selected" : ""}>${K.esc(label(value))}</option>`).join("")}`;
    }

    function creaturesHTML() {
        const K = kit();
        const catalog = atlas().getCreatureCatalog();
        const list = filteredCreatures(catalog);
        if (!list.some((entry) => entry.id === state.creature)) state.creature = list[0]?.id || null;
        const selected = list.find((entry) => entry.id === state.creature) || null;
        const types = [...new Set(catalog.map((entry) => entry.type).filter(Boolean))].sort((a, b) => K.creatureType(a).localeCompare(K.creatureType(b)));
        const biomes = [...new Set(catalog.flatMap((entry) => (entry.hunts || []).map((item) => item.biome)).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
        const rows = list.map((entry) => {
            const locked = !atlas().isUnlocked(entry.level);
            return `<button type="button" class="ui3-list-row${locked ? " is-locked" : ""}" data-ui3-creature="${K.esc(entry.id)}" aria-pressed="${entry.id === selected?.id ? "true" : "false"}">
                    <span class="ui3-glyph-box"><img src="${K.esc(Aethra.SpriteLoader?.getCreatureSource?.({ id: entry.id, name: entry.name }) || "")}" alt="" draggable="false"></span>
                    <span class="ui3-list-row__text"><strong>${K.esc(entry.name)}</strong><small>${K.esc(K.creatureType(entry.type))} · ${K.esc(entry.hunts?.[0]?.biome || "Mundo aberto")}</small></span>
                    <span class="ui3-tag">Nv ${K.formatNumber(entry.level)}</span>
                </button>`;
        }).join("");
        let detail = `<p class="ui3-empty">Nenhuma criatura com estes filtros.</p>`;
        if (selected) {
            const data = Aethra.GameData?.creatures?.[selected.id] || {};
            const loot = atlas().getCreatureLootPreview(data.id ? data : { ...data, id: selected.id });
            const lootRows = loot.slice(0, 8).map((drop) => {
                const chance = drop.guaranteed ? "Garantido" : drop.chance >= 0.1 ? `${Math.round(drop.chance * 100)}%` : `${(drop.chance * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
                const quantity = drop.max > drop.min ? `${drop.min}–${drop.max}` : `${drop.min}`;
                const template = Aethra.GameData?.items?.[drop.templateId] || { templateId: drop.templateId, name: drop.name, icon: drop.icon, rarity: drop.rarity };
                return `<div class="ui3-loot-row">${Aethra.Ui3Items.thumbHTML({ ...template, templateId: drop.templateId })}<span class="ui3-loot-row__name">${K.esc(drop.name)} <small>×${K.esc(quantity)}</small></span><span class="ui3-loot-row__value">${K.esc(chance)}</span></div>`;
            }).join("");
            detail = `<span class="ui3-eyebrow">Caçada focada</span>
                <h3 class="ui3-quest-head__title">${K.esc(selected.name)}</h3>
                <div class="ui3-row">${chipsHTML([`Nv ${selected.level}`, K.creatureType(selected.type), data.rank && data.rank !== "normal" ? data.rank : ""])}</div>
                <div class="ui3-kpi-grid ui3-kpi-grid--3">
                    ${K.kpi({ label: "Vida", value: K.formatNumber(data.maxHp || data.hp) })}
                    ${K.kpi({ label: "Dano", value: `${K.formatNumber(data.damageMin)}–${K.formatNumber(data.damageMax || data.damage)}` })}
                    ${K.kpi({ label: "XP", value: K.formatNumber(data.xp) })}
                </div>
                <section class="ui3-section"><span class="ui3-eyebrow">Loot esperado</span>${lootRows || `<p class="ui3-empty">Usa o perfil de loot geral da região.</p>`}<p>Equipamentos raros com atributos individuais também podem cair.</p></section>
                <section class="ui3-section"><span class="ui3-eyebrow">Encontrada em</span><div class="ui3-row">${chipsHTML((selected.hunts || []).slice(0, 6).map((item) => `${item.name} · Nv ${item.minLevel}`))}</div></section>
                <div class="ui3-item-actions">${notice()}${startButtonHTML({ id: `targeted__${selected.id}`, minLevel: selected.level }, "data-ui3-creature-start", "Iniciar caçada focada")}</div>`;
        }
        return {
            main: `<div class="ui3-atlas__filters">
                    <label class="ui3-search"><span class="ui3-search__icon">${K.icon("search", 15)}</span><span class="ui3-sr-only">Buscar criatura</span><input type="search" placeholder="Nome, tipo, bioma ou região" value="${K.esc(state.search)}" autocomplete="off" data-ui3-atlas-search></label>
                    <label class="ui3-select"><span>Tipo</span><select data-ui3-atlas-filter="type">${optionsHTML(types, state.type, "Todos", K.creatureType)}</select></label>
                    <label class="ui3-select"><span>Bioma</span><select data-ui3-atlas-filter="biome">${optionsHTML(biomes, state.biome, "Todos")}</select></label>
                    <label class="ui3-select"><span>Acesso</span><select data-ui3-atlas-filter="access"><option value="all"${state.access === "all" ? " selected" : ""}>Todas</option><option value="unlocked"${state.access === "unlocked" ? " selected" : ""}>Liberadas</option><option value="locked"${state.access === "locked" ? " selected" : ""}>Bloqueadas</option></select></label>
                </div>
                <span class="ui3-caption">${list.length} de ${catalog.length} criaturas · ${catalog.filter((entry) => atlas().isUnlocked(entry.level)).length} liberadas no nível ${K.formatNumber(heroLevel())}</span>
                <div class="ui3-list ui3-scroll" data-ui3-atlas-list>${rows || `<p class="ui3-empty">Ajuste a busca ou os filtros.</p>`}</div>`,
            detail
        };
    }

    /* ---------------------------------------------------------------
       Focos de ofício
       --------------------------------------------------------------- */

    function focusHTML() {
        const K = kit();
        const list = atlas().getSpecializedHunts();
        const recommendation = recommended();
        if (!list.some((definition) => definition.id === state.focus)) {
            state.focus = [recommendation.focusHuntId, list[0]?.id].find((id) => id && list.some((definition) => definition.id === id)) || null;
        }
        const selected = list.find((definition) => definition.id === state.focus) || null;
        const rows = list.map((definition) => {
            const locked = !atlas().isUnlocked(definition);
            const mine = definition.id === recommendation.focusHuntId;
            return `<button type="button" class="ui3-list-row${locked ? " is-locked" : ""}" data-ui3-focus-hunt="${K.esc(definition.id)}" aria-pressed="${definition.id === selected?.id ? "true" : "false"}">
                    <span class="ui3-glyph-box" aria-hidden="true">${K.esc(definition.focus?.icon || definition.icon || "⌖")}</span>
                    <span class="ui3-list-row__text"><strong>${K.esc(definition.name)}${mine ? ` <span class="ui3-tag">Seu foco</span>` : ""}</strong><small>${K.esc(definition.focus?.name || "Progressão especializada")} · ${K.esc(definition.biome || "")}</small></span>
                    <span class="ui3-tag">Nv ${K.formatNumber(definition.minLevel || 1)}</span>
                </button>`;
        }).join("");
        let detail = `<p class="ui3-empty">Nenhum foco de ofício disponível.</p>`;
        if (selected) {
            const modifiers = selected.modifiers || {};
            const professions = Object.entries(modifiers.professionXp || {})
                .filter(([, value]) => number(value) > 0)
                .sort((a, b) => number(b[1]) - number(a[1]))
                .map(([professionId, value]) => {
                    const profession = Aethra.ProfessionSystem?.getState?.(professionId) || Aethra.ProfessionSystem?.professions?.[professionId] || { name: professionId };
                    return `<div class="ui3-row-between"><span>${K.esc(profession.icon || "")} ${K.esc(profession.name || professionId)}</span><strong class="${number(value) >= 1 ? "is-up" : "is-down"}">${multiplier(value)}</strong></div>`;
                }).join("");
            const events = Object.entries(modifiers.eventWeights || {})
                .filter(([, weight]) => number(weight) > 1)
                .sort((a, b) => number(b[1]) - number(a[1]))
                .slice(0, 4)
                .map(([eventId]) => FOCUS_EVENT_LABELS[eventId] || eventId);
            detail = `<span class="ui3-eyebrow">${K.esc(selected.biome || "Bioma")}</span>
                <h3 class="ui3-quest-head__title">${K.esc(selected.name)}</h3>
                <div class="ui3-row">${chipsHTML([`Nv ${selected.minLevel || 1}+`, selected.focus?.name])}</div>
                ${selected.description ? `<p class="ui3-item-description">${K.esc(selected.description)}</p>` : ""}
                ${modifiersHTML(modifiers)}
                <section class="ui3-section ui3-compare"><span class="ui3-eyebrow">XP de ofício por ação</span>${professions || `<p class="ui3-empty">Combate contínuo.</p>`}</section>
                <section class="ui3-section"><span class="ui3-eyebrow">Eventos favorecidos</span><strong>${K.esc(events.length ? events.join(" · ") : "Combates contínuos")}</strong></section>
                <section class="ui3-section"><span class="ui3-eyebrow">Criaturas do bioma</span><div class="ui3-row">${chipsHTML(atlas().encounterCreatureIds(selected).slice(0, 7).map(creatureName))}</div></section>
                <div class="ui3-item-actions">${notice()}${startButtonHTML(selected, "data-ui3-focus-start", "Iniciar foco de ofício")}</div>`;
        }
        return {
            main: `<span class="ui3-caption">Cada bioma muda eventos, economia e XP de ofício. Só a ação correspondente concede XP a cada ofício.</span>
                <div class="ui3-list ui3-scroll">${rows}</div>`,
            detail
        };
    }

    /* ---------------------------------------------------------------
       Renderização e comandos
       --------------------------------------------------------------- */

    function render() {
        const K = kit();
        patch(parts.tabs, K.tabs({ label: "Seções do mapa", items: TABS, selected: state.tab }));
        const view = state.tab === "creatures" ? creaturesHTML() : state.tab === "focus" ? focusHTML() : expeditionsHTML();
        parts.body.dataset.view = state.tab;
        const searchFocused = document.activeElement?.matches?.("[data-ui3-atlas-search]");
        const caret = searchFocused ? document.activeElement.selectionStart : null;
        if (patch(parts.main, view.main) && searchFocused) {
            const input = parts.main.querySelector("[data-ui3-atlas-search]");
            input?.focus({ preventScroll: true });
            if (caret !== null) input?.setSelectionRange?.(caret, caret);
        }
        patch(parts.detail, view.detail);
    }

    function goToHunt(result, failure) {
        if (!result?.started) {
            state.notice = { tone: "error", text: failure };
            render();
            return false;
        }
        state.notice = null;
        Aethra.WindowManager?.closeWindow?.(WINDOW_ID, { source: "ui3-atlas" });
        Aethra.UIManager?.setPrimaryView?.("hunt", { source: "ui3-atlas" });
        return true;
    }

    function onClick(event) {
        const target = event.target;
        const tab = target.closest("[data-ui3-tab]");
        if (tab) {
            state.tab = tab.dataset.ui3Tab;
            state.notice = null;
            return render();
        }
        const node = target.closest("[data-ui3-expedition]");
        if (node) {
            state.expedition = node.dataset.ui3Expedition;
            state.notice = null;
            return render();
        }
        const creature = target.closest("[data-ui3-creature]");
        if (creature) {
            state.creature = creature.dataset.ui3Creature;
            state.notice = null;
            return render();
        }
        const focus = target.closest("[data-ui3-focus-hunt]");
        if (focus) {
            state.focus = focus.dataset.ui3FocusHunt;
            state.notice = null;
            return render();
        }
        const startExpedition = target.closest("[data-ui3-expedition-start]");
        if (startExpedition) {
            return goToHunt(atlas().startRoute(startExpedition.dataset.ui3ExpeditionStart, { mode: "expedition", stopReason: "ui3-atlas-route-change" }), "A expedição não pôde começar.");
        }
        const startCreature = target.closest("[data-ui3-creature-start]");
        if (startCreature) {
            return goToHunt(atlas().startCreatureHunt(state.creature, { stopReason: "ui3-atlas-hunt-switch" }), "A caçada não pôde começar.");
        }
        const startFocus = target.closest("[data-ui3-focus-start]");
        if (startFocus) {
            return goToHunt(atlas().startRoute(startFocus.dataset.ui3FocusStart, { mode: "specialized", stopReason: "ui3-atlas-focus-switch" }), "O foco de ofício não pôde começar.");
        }
        return undefined;
    }

    function onInput(event) {
        if (!event.target.matches("[data-ui3-atlas-search]")) return;
        state.search = event.target.value;
        render();
    }

    function onChange(event) {
        const filter = event.target.closest("[data-ui3-atlas-filter]");
        if (!filter) return;
        state[filter.dataset.ui3AtlasFilter] = filter.value;
        render();
    }

    function setup(body) {
        body.classList.add("ui3-atlas");
        body.innerHTML = `<div class="ui3-skills__tabs" data-ui3-part="tabs"></div>
            <div class="ui3-atlas__body" data-ui3-part="body">
                <section class="ui3-atlas__main" aria-label="Rotas" data-ui3-part="main"></section>
                <section class="ui3-bag__details" aria-label="Rota selecionada" aria-live="polite" data-ui3-part="detail"></section>
            </div>`;
        const part = (name) => body.querySelector(`[data-ui3-part="${name}"]`);
        parts = { tabs: part("tabs"), body: part("body"), main: part("main"), detail: part("detail") };
        body.addEventListener("click", onClick);
        body.addEventListener("input", onInput);
        body.addEventListener("change", onChange);
    }

    /*
     * Pedidos de abertura chegam pelo estado que Aethra.openHuntWorldMap já
     * registra (modo, rota, criatura e foco), para qualquer chamador antigo
     * abrir o mapa na seleção certa.
     */
    function onOpen(options = {}) {
        const ui = Aethra.GameState?.ui || {};
        const mode = options.mode || ui.worldMapMode || "expeditions";
        state.tab = mode === "hunts" ? (ui.huntAtlasView === "focus" ? "focus" : "creatures") : "expeditions";
        if (options.huntId || ui.selectedWorldHunt) state.expedition = options.huntId || ui.selectedWorldHunt;
        if (ui.selectedHuntCreature) state.creature = ui.selectedHuntCreature;
        if (ui.selectedFocusHunt) state.focus = ui.selectedFocusHunt;
        state.notice = null;
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3AtlasWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Mapa-Mundi",
            className: "ui3-dialog--wide",
            setup,
            render,
            onOpen,
            getSubtitle: () => "Expedições, caçadas focadas e focos de ofício",
            events: ["hunt:started", "hunt:ended", "quest:tracking-changed", "discipline:focus-changed", "levelUp", "hero:level-up"]
        });
    }
})(window.Aethra = window.Aethra || {});
