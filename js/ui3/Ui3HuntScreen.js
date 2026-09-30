/*
 * Ui3HuntScreen.js — tela de Hunt da UI 3.0 (fase 2).
 *
 * O mapa 2D é o palco em tela cheia; herói, alvo, expedição, registro e
 * barra de ações flutuam sobre ele. Tudo aqui é projeção:
 *   leitura   CombatProjection, HuntSystem, HuntAnalyzer,
 *             SkillSystem, SkillController, BattleSystem, GameState (só lê)
 *   comandos  HuntSystem.startHunt/stopHunt, SkillController.requestManualSkill,
 *             PrimaryAttackRequested, SettingsManager.setCombatSpeed,
 *             WindowManager e UIManager
 * O canvas é emprestado pelo TileMapCanvas.setStageHost; não há segundo mapa.
 */
(function initUi3HuntScreen(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const SCREEN_ID = "hunt";
    const REFRESH_MS = 500;
    const LOG_LIMIT = 60;
    const HUD_LOG_LINES = 5;
    const LOOT_PREVIEW = 4;
    const STOP_CONFIRM_MS = 4000;
    const SPEEDS = Object.freeze([1, 2, 4]);
    const HOTKEY_CODES = Object.freeze([
        "Digit1", "Digit2", "Digit3", "Digit4", "Digit5",
        "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"
    ]);
    const TABS = Object.freeze([
        { id: "resumo", label: "Resumo" },
        { id: "loot", label: "Loot" },
        { id: "registro", label: "Registro" }
    ]);

    let screen = null;
    let parts = {};
    let timer = null;
    let frame = null;
    let activeTab = "resumo";
    let stopConfirmUntil = 0;
    let logSequence = 0;
    const archetypeNames = new Map();
    const rendered = new WeakMap();
    const log = [];

    function kit() {
        return Aethra.Ui3Kit;
    }

    // Troca o HTML só quando muda: preserva foco e hover entre atualizações.
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

    function formatDuration(totalSeconds) {
        const total = Math.max(0, Math.floor(number(totalSeconds)));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;
        const pad = (value) => String(value).padStart(2, "0");
        return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
    }

    function signed(value) {
        const amount = Math.round(number(value));
        const text = kit().formatNumber(Math.abs(amount));
        return amount > 0 ? `+${text}` : amount < 0 ? `−${text}` : text;
    }

    /* ---------------------------------------------------------------
       Leitura de estado
       --------------------------------------------------------------- */

    function projection() {
        return Aethra.CombatProjection?.getSnapshot?.() || null;
    }

    function huntState() {
        return Aethra.GameState?.hunt || {};
    }

    function isHuntRunning() {
        return Boolean(huntState().isActive);
    }

    function archetypeName(archetypeId) {
        if (!archetypeId) return "";
        if (!archetypeNames.has(archetypeId)) {
            const definitions = Aethra.CharacterBuildSystem?.getSnapshot?.()?.definitions?.archetypes || {};
            Object.values(definitions).forEach((entry) => {
                if (entry?.id) archetypeNames.set(entry.id, entry.name || entry.id);
            });
            if (!archetypeNames.has(archetypeId)) archetypeNames.set(archetypeId, "");
        }
        return archetypeNames.get(archetypeId);
    }

    function huntName(hunt = huntState()) {
        const definition = Aethra.HuntSystem?.getHuntDefinition?.(hunt.huntId);
        if (definition?.name) return definition.name;
        if (hunt.targetCreatureId) {
            const creature = Aethra.GameData?.getCreature?.(hunt.targetCreatureId);
            if (creature?.name) return `Caçada: ${creature.name}`;
        }
        return "Expedição";
    }

    function recommendedHunt() {
        const quest = Aethra.QuestSystem?.getTrackedQuest?.()
            || Aethra.QuestSystem?.getState?.()?.active?.[0]
            || null;
        const guidance = quest ? Aethra.QuestSystem?.getGuidance?.(quest) : null;
        const hunts = Aethra.HuntSystem?.hunts || {};
        const candidates = [guidance?.huntId, huntState().huntId, "whispering_forest"];
        const huntId = candidates.find((id) => id && hunts[id]) || null;
        return huntId ? { id: huntId, definition: hunts[huntId] } : null;
    }

    function metrics() {
        const current = Aethra.HuntAnalyzer?.getMetrics?.();
        if (current) return current;
        const hunt = huntState();
        const seconds = number(hunt.elapsedMs) / 1000;
        const hours = Math.max(seconds / 3600, 1 / 3600);
        const xp = number(hunt.xp);
        const gold = number(hunt.gold);
        const loot = number(hunt.lootValue);
        const spent = number(hunt.supplyCost);
        return {
            seconds,
            xp,
            xpPerHour: xp > 0 ? Math.floor(xp / hours) : 0,
            gold,
            profit: gold + loot - spent,
            spent,
            kills: number(hunt.kills)
        };
    }

    function lootEntries() {
        const session = Aethra.GameState?.ui?.lootSession || {};
        const K = kit();
        const stackables = Object.values(session.stackables || {})
            .filter((entry) => entry && entry.key !== "currency:gold")
            .map((entry) => ({
                id: entry.key,
                name: entry.name,
                image: entry.image || "",
                glyph: entry.icon || "◆",
                quantity: number(entry.quantity, 1),
                value: number(entry.totalValue),
                rarity: K.normalizeRarity(entry.tone),
                at: number(entry.lastDropAt)
            }));
        const specials = (Array.isArray(session.specials) ? session.specials : []).map((entry) => ({
            id: entry.instanceId || entry.id,
            name: entry.name,
            image: entry.image || "",
            glyph: entry.icon || "◆",
            quantity: 1,
            value: number(entry.value),
            rarity: K.normalizeRarity(entry.rarityId || entry.tone),
            at: number(entry.createdAt)
        }));
        return [...stackables, ...specials];
    }

    function supplyUsage(current) {
        const breakdown = Object.values(huntState().supplyBreakdown || {});
        const used = breakdown.reduce((sum, entry) => sum + Math.max(0, number(entry?.quantity)), 0);
        return { used, spent: number(current.spent) };
    }

    function readiness() {
        const hero = Aethra.GameState?.hero || {};
        const hp = number(hero.hp ?? hero.stats?.hp);
        const hpMax = Math.max(1, number(hero.maxHp ?? hero.stats?.maxHp, hp || 1));
        const equipment = Aethra.GameState?.playerEquipment || hero.equipment || {};
        const bag = Array.isArray(hero.bag) ? hero.bag : [];
        const supplies = bag
            .filter((item) => String(item?.itemType || item?.type || "").toLowerCase() === "consumable")
            .reduce((sum, item) => sum + Math.max(1, number(item?.quantity, 1)), 0);
        return {
            hpPercent: Math.round((hp / hpMax) * 100),
            equipped: Object.values(equipment).filter(Boolean).length,
            supplies
        };
    }

    function itemImage(item) {
        if (!item) return "";
        return Aethra.GameData?.getItemImage?.(item.templateId || item.id) || item.image || "";
    }

    /* ---------------------------------------------------------------
       Registro (memória da apresentação; o estado oficial não muda)
       --------------------------------------------------------------- */

    function pushLog(text, tone = "info") {
        const message = String(text || "").trim();
        if (!message) return;
        log.push({ id: ++logSequence, text: message, tone });
        if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT);
        scheduleRender();
    }

    function toneForAction(event = {}) {
        if (event.kind === "healing" || event.kind === "consumable") return "heal";
        if (event.outcome === "miss") return "muted";
        if (event.actor === "enemy") return "taken";
        return event.critical ? "crit" : "dealt";
    }

    function describeAction(event = {}) {
        if (event.message) return event.message;
        const amount = kit().formatNumber(event.amount);
        if (event.outcome === "miss") return `${event.actorName} erra ${event.ability}.`;
        if (event.kind === "healing") return `${event.ability} recupera ${amount} de vida.`;
        return `${event.ability} acerta ${event.targetName}: ${amount}.`;
    }

    function onProjection({ reason, event, snapshot } = {}) {
        if (reason === "battle-started") {
            const enemy = snapshot?.enemy;
            if (enemy) pushLog(`Encontro: ${enemy.name}${enemy.level ? ` (Nv ${enemy.level})` : ""}.`, "encounter");
            return;
        }
        if (reason === "action-resolved" && event) {
            pushLog(describeAction(event), toneForAction(event));
            return;
        }
        scheduleRender();
    }

    /* ---------------------------------------------------------------
       Renderização
       --------------------------------------------------------------- */

    function heroHTML(snapshot) {
        const K = kit();
        const hero = Aethra.GameState?.hero || {};
        const resources = snapshot?.hero?.resources || {};
        const hp = resources.hp || { current: hero.hp, maximum: hero.maxHp };
        const mana = resources.mana || { current: hero.mana, maximum: hero.maxMana };
        const vigor = resources.energy || { current: hero.energy, maximum: hero.maxEnergy };
        const level = Math.max(1, Math.floor(number(hero.level, 1)));
        const xpNext = Math.max(1, number(hero.xpNext, 1));
        const xpPercent = Math.max(0, Math.min(100, (number(hero.xpCurrent) / xpNext) * 100));
        const portrait = Aethra.SpriteLoader?.getHeroSource?.(hero.archetypeId) || "";
        const role = archetypeName(hero.archetypeId);
        return `<div class="ui3-portrait ui3-portrait--hero">
                ${portrait ? `<img class="ui3-portrait__img" src="${K.esc(portrait)}" alt="" draggable="false">` : ""}
                <span class="ui3-portrait__level" aria-label="Nível ${level}">${level}</span>
            </div>
            <div class="ui3-unit__body">
                <div class="ui3-unit__head">
                    <strong class="ui3-unit__name">${K.esc(hero.name || "Herói")}</strong>
                    ${role ? `<span class="ui3-unit__meta">${K.esc(role)}</span>` : ""}
                </div>
                ${K.bar({ kind: "hp", value: hp.current, max: hp.maximum, label: "HP" })}
                ${K.bar({ kind: "mana", value: mana.current, max: mana.maximum, label: "Mana" })}
                ${K.bar({ kind: "vigor", value: vigor.current, max: vigor.maximum, label: "Vigor" })}
                <div class="ui3-xpline">
                    ${K.bar({ kind: "xp", value: xpPercent, max: 100, label: "Experiência" })}
                    <span>XP ${Math.floor(xpPercent)}%</span>
                </div>
            </div>`;
    }

    function targetHTML(snapshot) {
        const K = kit();
        const enemy = snapshot?.active ? snapshot.enemy : null;
        if (!enemy) return "";
        const hp = enemy.resources?.hp || { current: enemy.hp, maximum: enemy.maxHp };
        const type = enemy.type ? K.creatureType(enemy.type) : "";
        const meta = [enemy.level ? `Nv ${enemy.level}` : "", type].filter(Boolean).join(" · ");
        const portrait = Aethra.SpriteLoader?.getCreatureSource?.(enemy) || "";
        return `<div class="ui3-portrait ui3-portrait--target">
                ${portrait ? `<img class="ui3-portrait__img" src="${K.esc(portrait)}" alt="" draggable="false">` : ""}
            </div>
            <div class="ui3-unit__body">
                <div class="ui3-unit__head">
                    <strong class="ui3-unit__name">${K.esc(enemy.name)}</strong>
                    ${meta ? `<span class="ui3-unit__meta">${K.esc(meta)}</span>` : ""}
                </div>
                ${K.bar({ kind: "hp", value: hp.current, max: hp.maximum, label: "HP" })}
            </div>`;
    }

    function expeditionHeadHTML() {
        const K = kit();
        const hunt = huntState();
        if (isHuntRunning()) {
            const definition = Aethra.HuntSystem?.getHuntDefinition?.(hunt.huntId);
            const chips = [
                definition?.minLevel ? `Nv ${definition.minLevel}+` : "",
                hunt.focusName || (hunt.targetCreatureId ? "Direcionada" : "Solo")
            ].filter(Boolean);
            return `<span class="ui3-eyebrow">${hunt.isPaused ? "Expedição pausada" : "Expedição em andamento"}</span>
                <h2 class="ui3-expedition__title">${K.esc(huntName(hunt))}</h2>
                <div class="ui3-expedition__meta">
                    ${chips.map((chip) => `<span class="ui3-tag">${K.esc(chip)}</span>`).join("")}
                    <span class="ui3-expedition__timer" aria-label="Tempo de expedição">${formatDuration(number(hunt.elapsedMs) / 1000)}</span>
                </div>`;
        }
        const next = recommendedHunt();
        return `<span class="ui3-eyebrow">Próxima rota</span>
            <h2 class="ui3-expedition__title">${K.esc(next?.definition?.name || "Escolha seu destino")}</h2>
            <div class="ui3-expedition__meta">
                ${next?.definition ? `<span class="ui3-tag">Nv ${K.esc(next.definition.minLevel || 1)}+</span>` : ""}
                <span class="ui3-caption">Nenhuma expedição ativa</span>
            </div>`;
    }

    function lootRowsHTML(entries) {
        const K = kit();
        return entries.map((entry) => `<div class="ui3-loot-row">
                <span class="ui3-loot-row__icon ui3-loot-row__icon--${entry.rarity}">${entry.image
                    ? `<img src="${K.esc(entry.image)}" alt="" draggable="false">`
                    : `<span aria-hidden="true">${K.esc(entry.glyph)}</span>`}</span>
                <span class="ui3-loot-row__name ui3-rarity-text--${entry.rarity}">${K.esc(entry.name)}${entry.quantity > 1 ? ` <small>×${K.formatNumber(entry.quantity)}</small>` : ""}</span>
                <span class="ui3-loot-row__value">${K.formatNumber(entry.value)} o</span>
            </div>`).join("");
    }

    function logLinesHTML(entries) {
        const K = kit();
        return entries.map((entry) => `<p class="ui3-log__line ui3-log__line--${K.esc(entry.tone)}">${K.esc(entry.text)}</p>`).join("");
    }

    function summaryHTML(current) {
        const K = kit();
        const hours = Math.max(number(current.seconds) / 3600, 1 / 3600);
        const goldPerHour = number(current.gold) > 0 ? Math.floor(number(current.gold) / hours) : 0;
        const recent = lootEntries().sort((left, right) => right.at - left.at).slice(0, LOOT_PREVIEW);
        const supplies = supplyUsage(current);
        const profitTone = current.profit > 0 ? "positive" : current.profit < 0 ? "negative" : "";
        return `<div class="ui3-kpi-grid">
                ${K.kpi({ label: "XP / hora", value: K.formatNumber(current.xpPerHour) })}
                ${K.kpi({ label: "Ouro / hora", value: K.formatNumber(goldPerHour) })}
                ${K.kpi({ label: "Abates", value: K.formatNumber(current.kills) })}
                ${K.kpi({ label: "Lucro", value: signed(current.profit), tone: profitTone })}
            </div>
            <div class="ui3-stack">
                <span class="ui3-eyebrow">Loot recente</span>
                ${recent.length ? lootRowsHTML(recent) : `<p class="ui3-empty">Nenhum item ainda. Os drops aparecem aqui.</p>`}
            </div>
            <div class="ui3-note">
                <span>Suprimentos usados</span>
                <strong>${supplies.used > 0
                    ? `${K.formatNumber(supplies.used)} ${supplies.used === 1 ? "item" : "itens"} · −${K.formatNumber(supplies.spent)} o`
                    : "Nenhum"}</strong>
            </div>`;
    }

    function lootTabHTML() {
        const K = kit();
        const entries = lootEntries().sort((left, right) => right.value - left.value || right.at - left.at);
        const total = entries.reduce((sum, entry) => sum + entry.value, 0);
        if (!entries.length) return `<p class="ui3-empty">Nenhum drop nesta sessão.</p>`;
        return `<div class="ui3-note"><span>${K.formatNumber(entries.length)} ${entries.length === 1 ? "tipo de item" : "tipos de item"}</span><strong>${K.formatNumber(total)} o</strong></div>
            <div class="ui3-stack ui3-scroll">${lootRowsHTML(entries)}</div>`;
    }

    function registerTabHTML() {
        const entries = log.slice(-30);
        if (!entries.length) return `<p class="ui3-empty">O registro começa quando a expedição tiver atividade.</p>`;
        return `<div class="ui3-log ui3-scroll">${logLinesHTML(entries)}</div>`;
    }

    function idleBodyHTML(current) {
        const K = kit();
        const ready = readiness();
        const hasPrevious = number(current.seconds) > 0 || number(current.xp) > 0 || number(current.kills) > 0;
        const tone = (ok) => (ok ? "positive" : "negative");
        return `<div class="ui3-stack">
                <span class="ui3-eyebrow">Antes de partir</span>
                <div class="ui3-kpi-grid ui3-kpi-grid--3">
                    ${K.kpi({ label: "Vida", value: `${ready.hpPercent}%`, tone: tone(ready.hpPercent >= 70) })}
                    ${K.kpi({ label: "Equipado", value: `${ready.equipped}/11`, tone: tone(ready.equipped >= 3) })}
                    ${K.kpi({ label: "Suprimentos", value: K.formatNumber(ready.supplies), tone: tone(ready.supplies > 0) })}
                </div>
            </div>
            ${hasPrevious ? `<div class="ui3-stack">
                <span class="ui3-eyebrow">Última expedição · ${formatDuration(current.seconds)}</span>
                <div class="ui3-kpi-grid ui3-kpi-grid--3">
                    ${K.kpi({ label: "XP", value: K.formatNumber(current.xp) })}
                    ${K.kpi({ label: "Saldo", value: signed(current.profit), tone: current.profit > 0 ? "positive" : current.profit < 0 ? "negative" : "" })}
                    ${K.kpi({ label: "Abates", value: K.formatNumber(current.kills) })}
                </div>
            </div>` : ""}`;
    }

    function expeditionBodyHTML() {
        const current = metrics();
        if (!isHuntRunning()) return idleBodyHTML(current);
        if (activeTab === "loot") return lootTabHTML();
        if (activeTab === "registro") return registerTabHTML();
        return summaryHTML(current);
    }

    function expeditionActionsHTML() {
        const K = kit();
        if (!isHuntRunning()) {
            const next = recommendedHunt();
            return `${K.button({ label: "Iniciar expedição", variant: "primary", disabled: !next, attributes: { "data-ui3-hunt-start": next?.id || "" } })}
                <div class="ui3-expedition__row">
                    ${K.button({ label: "Ver mapa", attributes: { "data-ui3-hunt-map": "" } })}
                    ${K.button({ label: "Missões", attributes: { "data-ui3-open-window": "quests-view" } })}
                </div>`;
        }
        const confirming = Date.now() < stopConfirmUntil;
        return `<div class="ui3-expedition__row">
                ${K.button({ label: "Ver mapa", attributes: { "data-ui3-hunt-map": "" } })}
                ${K.button({ label: confirming ? "Confirmar" : "Encerrar", variant: "danger", attributes: { "data-ui3-hunt-stop": "", "aria-describedby": confirming ? "ui3-stop-hint" : undefined } })}
            </div>
            ${confirming ? `<p class="ui3-caption ui3-expedition__hint" id="ui3-stop-hint">Clique de novo para encerrar e fechar a sessão.</p>` : ""}`;
    }

    function tabsHTML() {
        if (!isHuntRunning()) return "";
        return kit().tabs({ label: "Detalhes da expedição", items: TABS, selected: activeTab });
    }

    function primaryHTML(slot) {
        const K = kit();
        const state = Aethra.BattleSystem?.getPrimaryAttackState?.(slot) || null;
        if (!state?.skill) {
            return K.slot({ empty: true, hotkey: slot === "left" ? "P" : "S", label: slot === "left" ? "Ataque principal indisponível" : "Ataque secundário indisponível" });
        }
        const isLeft = slot === "left";
        const weapon = state.weapon || null;
        const name = isLeft ? "Ataque principal" : "Ataque secundário";
        const detail = weapon?.name || (isLeft ? "Desarmado" : "Requer arma na mão 2");
        const auto = state.auto === true && state.available !== false;
        return K.slot({
            icon: itemImage(weapon),
            symbol: weapon ? "sword" : isLeft ? "fist" : "dagger",
            tone: "gold",
            hotkey: isLeft ? "P" : "S",
            badge: auto ? "AUTO" : "",
            active: auto,
            disabled: state.available === false,
            label: `${name}: ${detail}${auto ? ", automático" : ""}. Botão direito alterna o automático.`,
            attributes: { "data-ui3-primary": slot, title: `${name} · ${detail}` }
        });
    }

    function skillSlotHTML(skillId, index, settings, fighting) {
        const K = kit();
        const hotkey = index <= 8 ? String(index + 1) : index === 9 ? "0" : "";
        const skill = skillId ? Aethra.SkillSystem?.getSkill?.(skillId) : null;
        if (!skill) {
            return K.slot({ empty: true, hotkey, label: `${hotkey}: vazio. Clique para configurar.`, attributes: { "data-ui3-skill-slot": index } });
        }
        const system = Aethra.SkillSystem;
        const remaining = fighting
            ? number(system?.getCooldownRoundsRemaining?.(skillId))
            : Math.ceil(number(system?.getCooldownRemaining?.(skillId)) / 1000);
        const cost = skill.cost || {};
        const resource = String(cost.resource || "").toLowerCase();
        const pool = resource === "mana" ? "mana" : resource === "energy" ? "energy" : "";
        const hero = Aethra.GameState?.hero || {};
        const affordable = !pool || number(cost.amount) <= number(pool === "mana" ? hero.mana : hero.energy);
        const auto = settings?.[skillId]?.auto === true;
        const unit = fighting ? (remaining === 1 ? "rodada" : "rodadas") : "s";
        const status = remaining > 0 ? `, recarregando ${remaining} ${unit}` : !affordable ? ", recurso insuficiente" : "";
        return K.slot({
            ...K.skillVisual(skill),
            hotkey,
            cooldown: remaining,
            badge: auto ? "AUTO" : "",
            disabled: !affordable,
            label: `${hotkey}: ${skill.name}${auto ? ", automático" : ""}${status}. Botão direito alterna o automático.`,
            attributes: { "data-ui3-skill-slot": index, "data-ui3-skill": skillId, title: skill.name }
        });
    }

    function speedHTML() {
        const K = kit();
        const current = Aethra.SettingsManager?.getCombatSpeed?.() || 1;
        return SPEEDS.map((speed) => `<button type="button" class="ui3-speed__option" data-ui3-speed="${speed}" aria-pressed="${speed === current ? "true" : "false"}">${K.esc(speed)}×</button>`).join("");
    }

    function renderActions() {
        const bar = Aethra.SkillSystem?.getActiveBar?.() || { slots: [] };
        const slots = Array.isArray(bar.slots) ? bar.slots.slice(0, 10) : [];
        while (slots.length < 10) slots.push(null);
        const settings = Aethra.SkillController?.getSettings?.() || {};
        const fighting = Boolean(Aethra.GameState?.battle?.isFighting);
        patch(parts.primaryLeft, primaryHTML("left"));
        patch(parts.primaryRight, primaryHTML("right"));
        slots.forEach((skillId, index) => patch(parts.skills[index], skillSlotHTML(skillId, index, settings, fighting)));
        patch(parts.speed, speedHTML());
    }

    // Informa ao mapa quais faixas os painéis cobrem, para herói, inimigo e
    // marcadores não nascerem embaixo da expedição ou da barra de ações.
    function syncStageInsets() {
        const stage = parts.stage?.getBoundingClientRect?.();
        if (!stage?.width) return;
        const expedition = screen.querySelector(".ui3-hunt__expedition")?.getBoundingClientRect?.();
        const actions = screen.querySelector(".ui3-hunt__actions")?.getBoundingClientRect?.();
        const hero = parts.hero?.getBoundingClientRect?.();
        Aethra.TileMapCanvas?.setStageInsets?.({
            top: hero ? hero.bottom - stage.top : 0,
            right: expedition ? stage.right - expedition.left : 0,
            bottom: actions ? stage.bottom - actions.top : 0,
            left: 0
        });
    }

    function render() {
        if (!screen || screen.hidden || !kit()) return false;
        const snapshot = projection();
        patch(parts.hero, heroHTML(snapshot));
        const target = targetHTML(snapshot);
        parts.target.hidden = !target;
        patch(parts.target, target);
        screen.classList.toggle("is-running", isHuntRunning());
        patch(parts.expeditionHead, expeditionHeadHTML());
        patch(parts.expeditionTabs, tabsHTML());
        patch(parts.expeditionBody, expeditionBodyHTML());
        patch(parts.expeditionActions, expeditionActionsHTML());
        const recentLog = log.slice(-HUD_LOG_LINES);
        patch(parts.logLines, recentLog.length
            ? logLinesHTML(recentLog)
            : `<p class="ui3-log__line ui3-log__line--muted">Aguardando atividade da expedição.</p>`);
        renderActions();
        syncStageInsets();
        return true;
    }

    function scheduleRender() {
        if (frame !== null || !screen || screen.hidden) return;
        frame = requestAnimationFrame(() => {
            frame = null;
            render();
        });
    }

    /* ---------------------------------------------------------------
       Comandos
       --------------------------------------------------------------- */

    function startHunt(huntId) {
        if (!huntId || !Aethra.HuntSystem?.startHunt) return false;
        const started = Aethra.HuntSystem.startHunt(huntId);
        if (started) {
            activeTab = "resumo";
            Aethra.UIManager?.setPrimaryView?.("hunt", { source: "ui3-hunt" });
        }
        render();
        return started;
    }

    function stopHunt() {
        if (Date.now() >= stopConfirmUntil) {
            stopConfirmUntil = Date.now() + STOP_CONFIRM_MS;
            render();
            window.setTimeout(render, STOP_CONFIRM_MS + 50);
            return false;
        }
        stopConfirmUntil = 0;
        Aethra.HuntSystem?.stopHunt?.("player-ended");
        render();
        return true;
    }

    function openMap() {
        return Aethra.Ui3Navigation?.openHuntMap?.({ source: "ui3-hunt", huntId: huntState().huntId || recommendedHunt()?.id });
    }

    function usePrimary(slot) {
        if (!Aethra.GameState?.battle?.isFighting) {
            Aethra.EventBus.emit("BattleLog", {
                message: "Nenhum combate ativo para usar o ataque primário.",
                color: "#f1d17a",
                type: "system"
            });
            return false;
        }
        Aethra.EventBus.emit("PrimaryAttackRequested", { slot });
        return true;
    }

    function togglePrimaryAuto(slot) {
        const state = Aethra.BattleSystem?.getPrimaryAttackState?.(slot);
        if (!state || state.available === false) return false;
        Aethra.SkillSystem?.setPrimaryAuto?.(slot, state.auto !== true);
        Aethra.RenderEngine?.renderActionBar?.();
        renderActions();
        return true;
    }

    function useSlot(index) {
        const bar = Aethra.SkillSystem?.getActiveBar?.();
        const skillId = bar?.slots?.[index] || null;
        if (!skillId) {
            Aethra.WindowManager?.openWindow?.("skills-view", { source: "ui3-actionbar", tab: "actionbar", slot: index });
            return false;
        }
        const result = Aethra.SkillController?.requestManualSkill?.(skillId);
        renderActions();
        return Boolean(result?.ok);
    }

    function toggleSkillAuto(index) {
        const skillId = Aethra.SkillSystem?.getActiveBar?.()?.slots?.[index];
        if (!skillId || !Aethra.SkillController?.setAuto) return false;
        const current = Aethra.SkillController.getSettings?.()?.[skillId]?.auto === true;
        Aethra.SkillController.setAuto(skillId, !current);
        Aethra.RenderEngine?.renderActionBar?.();
        renderActions();
        return true;
    }

    function selectTab(id) {
        if (!TABS.some((tab) => tab.id === id)) return;
        activeTab = id;
        render();
        parts.expeditionTabs?.querySelector(`[data-ui3-tab="${id}"]`)?.focus();
    }

    function onClick(event) {
        const target = event.target;
        const tab = target.closest("[data-ui3-tab]");
        if (tab) return selectTab(tab.dataset.ui3Tab);
        const start = target.closest("[data-ui3-hunt-start]");
        if (start) return startHunt(start.dataset.ui3HuntStart);
        if (target.closest("[data-ui3-hunt-stop]")) return stopHunt();
        if (target.closest("[data-ui3-hunt-map]")) return openMap();
        const windowButton = target.closest("[data-ui3-open-window]");
        if (windowButton) return Aethra.WindowManager?.openWindow?.(windowButton.dataset.ui3OpenWindow, { source: "ui3-hunt" });
        const primary = target.closest("[data-ui3-primary]");
        if (primary) return usePrimary(primary.dataset.ui3Primary);
        const slot = target.closest("[data-ui3-skill-slot]");
        if (slot) return useSlot(Number(slot.dataset.ui3SkillSlot));
        const speed = target.closest("[data-ui3-speed]");
        if (speed) {
            Aethra.SettingsManager?.setCombatSpeed?.(Number(speed.dataset.ui3Speed), { source: "ui3-hunt" });
            return renderActions();
        }
        return undefined;
    }

    function onContextMenu(event) {
        const primary = event.target.closest("[data-ui3-primary]");
        const slot = event.target.closest("[data-ui3-skill][data-ui3-skill-slot]");
        if (!primary && !slot) return;
        event.preventDefault();
        if (primary) togglePrimaryAuto(primary.dataset.ui3Primary);
        else toggleSkillAuto(Number(slot.dataset.ui3SkillSlot));
    }

    function onTabKeys(event) {
        const tab = event.target.closest?.("[data-ui3-tab]");
        if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const index = TABS.findIndex((entry) => entry.id === tab.dataset.ui3Tab);
        const last = TABS.length - 1;
        const next = event.key === "Home" ? 0
            : event.key === "End" ? last
                : event.key === "ArrowLeft" ? (index <= 0 ? last : index - 1)
                    : (index >= last ? 0 : index + 1);
        selectTab(TABS[next].id);
    }

    function isTyping(target) {
        return target instanceof Element
            && Boolean(target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
    }

    function hasOpenWindow() {
        return Boolean(Aethra.Ui3Window?.anyOpen?.())
            || Boolean(document.querySelector('.game-window[data-aethra-window]:not(#city-view):not(.hidden)[aria-hidden="false"]'));
    }

    // Captura: roda antes do atalho clássico e o bloqueia (defaultPrevented),
    // para a tecla não disparar a habilidade duas vezes.
    function onHotkey(event) {
        if (!screen || screen.hidden || event.repeat || isTyping(event.target)) return;
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        const index = HOTKEY_CODES.indexOf(event.code);
        if (index < 0) return;
        if (Aethra.Ui3Window?.anyOpen?.()) {
            // Janela nova aberta: a tecla não vira habilidade em nenhuma barra.
            event.preventDefault();
            return;
        }
        if (hasOpenWindow()) return;
        event.preventDefault();
        useSlot(index);
    }

    /* ---------------------------------------------------------------
       Montagem e ciclo de vida
       --------------------------------------------------------------- */

    function buildScreen(root) {
        const element = document.createElement("section");
        element.className = "ui3-hunt";
        element.dataset.ui3Screen = SCREEN_ID;
        element.dataset.ui3Covers = "world";
        element.setAttribute("aria-label", "Hunt");
        element.hidden = true;
        element.innerHTML = `<div class="ui3-hunt__stage" data-ui3-stage></div>
            <section class="ui3-hud-card ui3-unit ui3-hunt__hero" aria-label="Herói" data-ui3-part="hero"></section>
            <section class="ui3-hud-card ui3-unit ui3-unit--target ui3-hunt__target" aria-label="Alvo" data-ui3-part="target" hidden></section>
            <section class="ui3-hud-card ui3-expedition ui3-hunt__expedition" aria-label="Expedição">
                <header class="ui3-expedition__head" data-ui3-part="expedition-head"></header>
                <div class="ui3-expedition__tabs" data-ui3-part="expedition-tabs"></div>
                <div class="ui3-expedition__body" data-ui3-part="expedition-body"></div>
                <footer class="ui3-expedition__actions" data-ui3-part="expedition-actions"></footer>
            </section>
            <section class="ui3-log ui3-hunt__log" aria-label="Registro de combate">
                <span class="ui3-eyebrow">Registro</span>
                <div class="ui3-log__lines" data-ui3-part="log"></div>
            </section>
            <div class="ui3-actionbar ui3-hunt__actions" role="toolbar" aria-label="Barra de ações">
                <span data-ui3-part="primary-left"></span>
                <span data-ui3-part="primary-right"></span>
                <span class="ui3-actionbar__divider" aria-hidden="true"></span>
                ${Array.from({ length: 10 }, (_, index) => `<span data-ui3-part="skill-${index}"></span>`).join("")}
                <span class="ui3-actionbar__divider" aria-hidden="true"></span>
                <div class="ui3-speed" role="group" aria-label="Velocidade do combate" data-ui3-part="speed"></div>
            </div>`;
        element.addEventListener("click", onClick);
        element.addEventListener("contextmenu", onContextMenu);
        element.addEventListener("keydown", onTabKeys);
        root.appendChild(element);

        const part = (name) => element.querySelector(`[data-ui3-part="${name}"]`);
        parts = {
            stage: element.querySelector("[data-ui3-stage]"),
            hero: part("hero"),
            target: part("target"),
            expeditionHead: part("expedition-head"),
            expeditionTabs: part("expedition-tabs"),
            expeditionBody: part("expedition-body"),
            expeditionActions: part("expedition-actions"),
            logLines: part("log"),
            primaryLeft: part("primary-left"),
            primaryRight: part("primary-right"),
            skills: Array.from({ length: 10 }, (_, index) => part(`skill-${index}`)),
            speed: part("speed")
        };
        return element;
    }

    function ensureScreen() {
        const root = Aethra.Ui3Shell?.root;
        if (!root) return null;
        if (!screen || !root.contains(screen)) screen = buildScreen(root);
        return screen;
    }

    function currentView() {
        return Aethra.UIManager?.primaryView || Aethra.GameState?.ui?.primaryView || "hunt";
    }

    function sync() {
        const visible = Boolean(Aethra.Ui3Shell?.canShowGame?.()) && currentView() === "hunt";
        if (!visible && !screen) return false;
        ensureScreen();
        if (!screen) return false;
        const changed = screen.hidden === visible;
        screen.hidden = !visible;
        if (changed) Aethra.TileMapCanvas?.setStageHost?.(visible ? parts.stage : null);
        if (visible) {
            render();
            if (!timer) timer = window.setInterval(render, REFRESH_MS);
        } else if (timer) {
            window.clearInterval(timer);
            timer = null;
        }
        Aethra.Ui3Shell?.refresh?.();
        return visible;
    }

    document.addEventListener("keydown", onHotkey, true);

    Aethra.EventBus.on("combat:projection-changed", onProjection);
    Aethra.EventBus.on("battle:rewards-granted", (payload = {}) => pushLog(payload.message, "reward"));
    Aethra.EventBus.on("battle:player-defeated", (payload = {}) => pushLog(payload.message, "danger"));
    Aethra.EventBus.on("hunt:started", (payload = {}) => pushLog(`Expedição iniciada: ${payload.hunt?.name || huntName()}.`, "system"));
    Aethra.EventBus.on("hunt:ended", () => pushLog("Expedição encerrada.", "system"));
    Aethra.EventBus.on("BattleLog", (payload = {}) => {
        if (payload.type === "system") pushLog(payload.message, "system");
    });

    ["ui3:version-applied", "ui3:screens-changed", "ui:primary-view-changed", "character:created", "state:restored", "save:loaded", "engine:ready"]
        .forEach((eventName) => Aethra.EventBus.on(eventName, () => {
            sync();
            window.setTimeout(sync, 0);
        }));
    ["hunt:updated", "actionBarChanged", "settings:changed", "skill-controller:manual-queued", "itemObtained"]
        .forEach((eventName) => Aethra.EventBus.on(eventName, scheduleRender));

    Aethra.Ui3HuntScreen = {
        sync,
        render,
        isVisible: () => Boolean(screen && !screen.hidden),
        selectTab,
        getLog: () => log.map((entry) => ({ ...entry }))
    };
})(window.Aethra = window.Aethra || {});
