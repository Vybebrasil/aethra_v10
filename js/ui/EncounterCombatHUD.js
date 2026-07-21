// EncounterCombatHUD.js - Arena central orientada a leitura do combate.
(function initEncounterCombatHUD(Aethra) {
    "use strict";

    if (!Aethra?.GameState || !Aethra?.EventBus || !Aethra?.RenderEngine) {
        return;
    }

    const MAX_HISTORY = 14;
    const BASE_ROUND_MS = 1800;
    const runtime = {
        history: [],
        currentBattleId: null,
        sequence: 0,
        lastAnimatedId: null,
        lastOutcome: null
    };

    const escapeHTML = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const integer = (value, fallback = 0) => Math.max(0, Math.floor(number(value, fallback)));
    const format = (value) => new Intl.NumberFormat("pt-BR").format(integer(value));
    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

    function combatSnapshot() {
        return Aethra.CombatProjection?.getSnapshot?.() || null;
    }

    function timelineEntryToView(entry = {}) {
        const outcomeLabels = {
            hit: "Acertou",
            miss: "Errou",
            critical: "Crítico",
            blocked: "Bloqueado",
            "critical-blocked": "Crítico · bloqueado",
            healed: "Curou",
            used: "Usou",
            started: "AO VIVO"
        };
        const tone = entry.kind === "healing"
            ? "heal"
            : entry.kind === "consumable"
                ? (Number(entry.effects?.hp || 0) > 0 ? "heal" : "utility")
                : entry.outcome === "hit"
                    ? "damage"
                    : entry.outcome || "system";
        const effectDetail = entry.kind === "consumable"
            ? [
                Number(entry.effects?.hp || 0) > 0 ? `+${format(entry.effects.hp)} HP` : "",
                Number(entry.effects?.mana || 0) > 0 ? `+${format(entry.effects.mana)} MP` : "",
                Number(entry.effects?.energy || 0) > 0 ? `+${format(entry.effects.energy)} Vigor` : ""
            ].filter(Boolean).join(" · ")
            : "";
        return {
            id: entry.eventId,
            battleId: entry.battleId,
            round: entry.round,
            actor: entry.actor,
            actorName: entry.actorName,
            targetName: entry.targetName,
            ability: entry.ability,
            outcome: outcomeLabels[entry.outcome] || entry.outcome || "Executou",
            amount: integer(entry.amount, 0),
            tone,
            detail: entry.message || effectDetail || `${entry.actorName || "Combatente"} executou ${entry.ability || "uma ação"}.`,
            createdAt: Date.parse(entry.occurredAt) || Date.now()
        };
    }

    function syncProjection(snapshot = combatSnapshot()) {
        if (!snapshot) return null;
        runtime.history = (snapshot.timeline || []).map(timelineEntryToView);
        runtime.currentBattleId = snapshot.battleId;
        if (snapshot.lastOutcome) {
            const victory = snapshot.lastOutcome.reason === "victory";
            const defeat = snapshot.lastOutcome.reason === "defeat";
            const enemyName = snapshot.lastOutcome.enemy?.name || "Criatura";
            runtime.lastOutcome = {
                tone: victory ? "victory" : defeat ? "defeat" : "system",
                title: victory ? `${enemyName} derrotado` : defeat ? "Herói derrotado" : "Combate encerrado",
                detail: victory
                    ? `Vitória em ${format(snapshot.lastOutcome.round || 0)} rodada(s).`
                    : `Motivo: ${String(snapshot.lastOutcome.reason || "encerrado").replaceAll("-", " ")}.`
            };
        }
        return snapshot;
    }

    function combatSpeed() {
        return [1, 2, 4].includes(Number(Aethra.SettingsManager?.getCombatSpeed?.()))
            ? Number(Aethra.SettingsManager.getCombatSpeed())
            : 1;
    }

    function applyCombatSpeed(speed = combatSpeed()) {
        const factor = [1, 2, 4].includes(Number(speed)) ? Number(speed) : 1;
        Aethra.BattleSystem?.setTickSpeed?.(BASE_ROUND_MS / factor);
        document.querySelectorAll("[data-battle-speed]").forEach((button) => {
            const active = Number(button.dataset.battleSpeed) === factor;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", active ? "true" : "false");
        });
        return factor;
    }

    function ensureCombatSpeedControls() {
        const host = document.querySelector(".battle-panel--actionbar > .battle-panel__header")
            || document.querySelector(".battle-stage-panel");
        if (!host) return null;
        let controls = host.querySelector(":scope > .battle-speed-controls");
        if (!controls) {
            controls = document.createElement("div");
            controls.className = "battle-speed-controls";
            controls.setAttribute("aria-label", "Velocidade do combate");
            controls.innerHTML = [1, 2, 4].map((speed) => `
                <button type="button" data-battle-speed="${speed}" aria-label="Combate em ${speed} vezes" aria-pressed="false">${speed}×</button>
            `).join("");
            host.appendChild(controls);
        }
        return controls;
    }

    function heroIdentity() {
        const projected = combatSnapshot()?.hero;
        const hero = Aethra.GameState.hero || {};
        return {
            id: String(projected?.id || hero.id || "hero"),
            name: String(projected?.name || hero.name || "Aethra")
        };
    }

    // Recursos atuais vivem no herói. `stats` é apenas fallback/base e pode
    // permanecer com o valor máximo depois que o herói recebe dano.
    function liveHeroResources() {
        const projected = combatSnapshot()?.hero?.resources;
        if (projected) {
            return {
                hp: { current: projected.hp.current, maximum: projected.hp.maximum },
                mana: { current: projected.mana.current, maximum: projected.mana.maximum },
                vigor: { current: projected.energy.current, maximum: projected.energy.maximum }
            };
        }
        const hero = Aethra.GameState.hero || {};
        const stats = hero.stats || {};
        return {
            hp: {
                current: hero.hp ?? stats.currentHp ?? stats.hp ?? stats.health ?? 0,
                maximum: hero.maxHp ?? stats.maxHp ?? stats.maxHealth ?? 1
            },
            mana: {
                current: hero.mana ?? stats.currentMana ?? stats.mana ?? 0,
                maximum: hero.maxMana ?? stats.maxMana ?? 1
            },
            vigor: {
                current: hero.energy ?? hero.vigor ?? stats.currentEnergy ?? stats.energy ?? stats.vigor ?? 0,
                maximum: hero.maxEnergy ?? hero.maxVigor ?? stats.maxEnergy ?? stats.maxVigor ?? 1
            }
        };
    }

    function enemyIdentity() {
        const projected = combatSnapshot();
        const enemy = projected?.enemy || projected?.lastEnemy || {};
        return {
            id: String(enemy.id || enemy.instanceId || "enemy"),
            name: String(enemy.name || "Criatura")
        };
    }

    function isHeroActor(payload = {}) {
        const hero = heroIdentity();
        const explicit = String(payload.side || "").toLowerCase();
        if (explicit === "hero" || explicit === "player") return true;
        if (["creature", "enemy", "monster"].includes(explicit)) return false;

        const actor = String(payload.attacker || payload.attackerId || payload.casterId || "").toLowerCase();
        return actor === "hero" || actor === "player" || actor === hero.id.toLowerCase() || actor === hero.name.toLowerCase();
    }

    function currentRound(payload = {}) {
        return Math.max(0, integer(payload.round ?? combatSnapshot()?.round, 0));
    }

    function pushEntry(entry = {}, options = {}) {
        const normalized = {
            id: entry.id || `exchange_${Date.now().toString(36)}_${++runtime.sequence}`,
            battleId: entry.battleId || combatSnapshot()?.battleId || null,
            round: currentRound(entry),
            actor: entry.actor === "enemy" ? "enemy" : entry.actor === "system" ? "system" : "hero",
            actorName: String(entry.actorName || (entry.actor === "enemy" ? enemyIdentity().name : heroIdentity().name)),
            targetName: String(entry.targetName || ""),
            ability: String(entry.ability || "Ação de combate"),
            outcome: String(entry.outcome || "Executou"),
            amount: integer(entry.amount, 0),
            tone: String(entry.tone || "damage"),
            detail: String(entry.detail || ""),
            createdAt: number(entry.createdAt, Date.now())
        };

        const previous = runtime.history[0];
        const duplicate = previous &&
            previous.battleId === normalized.battleId &&
            previous.round === normalized.round &&
            previous.actor === normalized.actor &&
            previous.ability === normalized.ability &&
            previous.outcome === normalized.outcome &&
            previous.amount === normalized.amount &&
            normalized.createdAt - previous.createdAt < 80;

        if (duplicate) return previous;

        runtime.history.unshift(normalized);
        runtime.history = runtime.history.slice(0, MAX_HISTORY);

        if (options.render !== false) {
            renderEncounterEnhancements();
        }

        return normalized;
    }

    function resultTone(payload = {}) {
        if (payload.hit === false || payload.missed === true) return "miss";
        if (payload.isCrit && payload.isBlocked) return "critical-blocked";
        if (payload.isCrit) return "critical";
        if (payload.isBlocked) return "blocked";
        return "damage";
    }

    function resultLabel(payload = {}) {
        if (payload.hit === false || payload.missed === true) return "Errou";
        if (payload.isCrit && payload.isBlocked) return "Crítico · bloqueado";
        if (payload.isCrit) return "Crítico";
        if (payload.isBlocked) return "Bloqueado";
        return "Acertou";
    }

    function addAttack(payload = {}) {
        const heroActor = isHeroActor(payload);
        const hero = heroIdentity();
        const enemy = enemyIdentity();
        const actorName = payload.attackerName || (heroActor ? hero.name : enemy.name);
        const targetName = payload.targetName || (heroActor ? enemy.name : hero.name);
        const ability = payload.skillName || payload.attackLabel || payload.weaponName || (heroActor ? "Ataque principal" : "Ataque básico");
        const amount = integer(payload.amount, 0);
        const tone = resultTone(payload);
        const proc = payload.disciplineProc?.triggered ? payload.disciplineProc : null;
        const discipline = payload.disciplineName || null;
        const detail = payload.hit === false || payload.missed === true
            ? `${actorName} não acertou ${targetName}.`
            : `${actorName} causou ${format(amount)} de dano em ${targetName}.${proc ? ` ${proc.name} foi ativado.` : discipline ? ` Disciplina: ${discipline}.` : ""}`;

        return pushEntry({
            battleId: payload.battleId || payload.combatId,
            round: payload.round,
            actor: heroActor ? "hero" : "enemy",
            actorName,
            targetName,
            ability,
            outcome: `${resultLabel(payload)}${proc ? ` · ${proc.name}` : ""}`,
            amount,
            tone,
            detail,
            createdAt: Date.now()
        });
    }

    function addHealing(payload = {}) {
        const hero = heroIdentity();
        const amount = integer(payload.amount ?? payload.healedAmount, 0);
        return pushEntry({
            battleId: payload.battleId,
            round: payload.round,
            actor: "hero",
            actorName: hero.name,
            targetName: hero.name,
            ability: payload.skillName || payload.name || "Cura",
            outcome: "Curou",
            amount,
            tone: "heal",
            detail: `${hero.name} recuperou ${format(amount)} de vida.`,
            createdAt: Date.now()
        });
    }

    function resetHistory(battleId = null) {
        runtime.history = [];
        runtime.currentBattleId = battleId;
        runtime.lastAnimatedId = null;
        runtime.lastOutcome = null;
    }

    function resourceHTML(label, current, maximum, tone, compact = false) {
        const safeMax = Math.max(1, integer(maximum, 1));
        const safeCurrent = clamp(integer(current, safeMax), 0, safeMax);
        const percentage = clamp((safeCurrent / safeMax) * 100, 0, 100);
        return `
            <div class="encounter-resource is-${escapeHTML(tone)}${compact ? " is-compact" : ""}" data-encounter-resource="${escapeHTML(label.toLowerCase())}">
                <div class="encounter-resource__label">
                    <span><i aria-hidden="true"></i>${escapeHTML(label)}</span>
                    <strong>${format(safeCurrent)} <em>/ ${format(safeMax)}</em></strong>
                </div>
                <div class="encounter-resource__track" role="progressbar" aria-label="${escapeHTML(label)}" aria-valuemin="0" aria-valuemax="${safeMax}" aria-valuenow="${safeCurrent}">
                    <i style="--encounter-resource-value:${percentage.toFixed(2)}%"></i>
                </div>
            </div>
        `;
    }

    function latestFor(actor) {
        return runtime.history.find((entry) => entry.actor === actor) || null;
    }

    function recapHTML(entry, actor) {
        if (!entry) {
            return `
                <div class="combatant-card__combat-recap is-waiting">
                    <span>${actor === "hero" ? "SUA PRÓXIMA AÇÃO" : "PRÓXIMA AÇÃO DO ALVO"}</span>
                    <strong>Aguardando o primeiro ciclo</strong>
                    <small>O resultado aparecerá aqui assim que a ação for resolvida.</small>
                </div>
            `;
        }

        const amount = entry.tone === "miss"
            ? "ERROU"
            : entry.tone === "heal"
                ? `+${format(entry.amount)} HP`
                : `-${format(entry.amount)} HP`;

        return `
            <div class="combatant-card__combat-recap is-${escapeHTML(entry.tone)}">
                <span>${actor === "hero" ? "SUA ÚLTIMA AÇÃO" : "ÚLTIMA AÇÃO DO ALVO"}<b>${escapeHTML(entry.outcome)}</b></span>
                <strong>${escapeHTML(entry.ability)} <em>${escapeHTML(amount)}</em></strong>
                <small>${escapeHTML(entry.detail)}</small>
            </div>
        `;
    }

    function enhanceCombatantCards(combatActive) {
        const resources = liveHeroResources();
        const heroCard = document.getElementById("battle-hero-card");
        const enemyCard = document.getElementById("battle-enemy-card");
        if (!heroCard || !enemyCard) return false;

        const heroHeaderLabel = heroCard.querySelector(".combatant-card__header small");
        if (heroHeaderLabel) heroHeaderLabel.textContent = combatActive ? "VOCÊ · HERÓI" : "SEU HERÓI";

        const heroResources = heroCard.querySelector(".combatant-card__resources");
        if (heroResources) {
            heroResources.classList.add("encounter-resource-grid", "encounter-resource-grid--hero");
            heroResources.innerHTML = [
                resourceHTML("HP", resources.hp.current, resources.hp.maximum, "hp"),
                resourceHTML("MP", resources.mana.current, resources.mana.maximum, "mana", true),
                resourceHTML("Vigor", resources.vigor.current, resources.vigor.maximum, "vigor", true)
            ].join("");
        }

        heroCard.querySelector(".combatant-card__combat-recap")?.remove();
        if (combatActive) {
            heroCard.querySelector(".combatant-card__resources")?.insertAdjacentHTML("afterend", recapHTML(latestFor("hero"), "hero"));
        }

        const enemy = combatSnapshot()?.enemy || null;
        if (combatActive && enemy) {
            const enemyHeaderLabel = enemyCard.querySelector(".combatant-card__header small");
            if (enemyHeaderLabel) enemyHeaderLabel.textContent = "ALVO · INIMIGO";

            const enemyResources = enemyCard.querySelector(".combatant-card__resources");
            if (enemyResources) {
                const enemyStats = enemy.stats || {};
                const manaMaximum = number(enemy.maxMana ?? enemyStats.maxMana, 0);
                enemyResources.classList.add("encounter-resource-grid", "encounter-resource-grid--enemy");
                enemyResources.innerHTML = [
                    resourceHTML("HP", enemy.hp, enemy.maxHp ?? enemyStats.maxHp ?? enemy.hp, "enemy-hp"),
                    manaMaximum > 0 ? resourceHTML("MP", enemy.mana ?? enemyStats.mana, manaMaximum, "mana", true) : ""
                ].join("");
            }

            enemyCard.querySelector(".combatant-card__combat-recap")?.remove();
            enemyCard.querySelector(".combatant-card__resources")?.insertAdjacentHTML("afterend", recapHTML(latestFor("enemy"), "enemy"));
        }

        const mostRecent = runtime.history.find((entry) => entry.actor !== "system");
        heroCard.classList.toggle("is-latest-actor", mostRecent?.actor === "hero");
        heroCard.classList.toggle("is-latest-target", mostRecent?.actor === "enemy");
        enemyCard.classList.toggle("is-latest-actor", mostRecent?.actor === "enemy");
        enemyCard.classList.toggle("is-latest-target", mostRecent?.actor === "hero");
        return true;
    }

    function entryAmountHTML(entry) {
        if (entry.actor === "system") return `<b class="encounter-exchange__result">${escapeHTML(entry.outcome)}</b>`;
        if (entry.tone === "miss") return `<b class="encounter-exchange__result">ERROU</b>`;
        const prefix = entry.tone === "heal" ? "+" : "−";
        const suffix = entry.tone === "heal" ? "HP" : "DANO";
        return `<b class="encounter-exchange__amount">${prefix}${format(entry.amount)}<small>${suffix}</small></b>`;
    }

    function exchangeEntryHTML(entry, animate) {
        const hero = heroIdentity();
        const enemy = enemyIdentity();
        const actorLabel = entry.actor === "hero" ? "VOCÊ" : entry.actor === "enemy" ? "INIMIGO" : "ARENA";
        const targetLabel = entry.actor === "hero" ? enemy.name : entry.actor === "enemy" ? "VOCÊ" : "";
        const icon = entry.actor === "hero" ? "A" : entry.actor === "enemy" ? String(enemy.name).charAt(0).toUpperCase() : "◆";
        return `
            <article class="encounter-exchange__event is-${escapeHTML(entry.actor)} is-${escapeHTML(entry.tone)}${animate ? " is-new" : ""}" data-combat-entry-id="${escapeHTML(entry.id)}">
                <span class="encounter-exchange__avatar" aria-hidden="true">${escapeHTML(icon)}</span>
                <div class="encounter-exchange__copy">
                    <span class="encounter-exchange__route">${escapeHTML(actorLabel)}${targetLabel ? `<i>→</i>${escapeHTML(targetLabel)}` : ""}<em>R${format(entry.round)}</em></span>
                    <strong>${escapeHTML(entry.ability)}</strong>
                    <small><b>${escapeHTML(entry.outcome)}</b>${entry.tone === "blocked" || entry.tone === "critical-blocked" ? " · dano reduzido pela defesa" : entry.tone === "miss" ? " · nenhum dano causado" : ""}</small>
                </div>
                ${entryAmountHTML(entry)}
            </article>
        `;
    }

    function renderActiveExchange(versus, battle, enemy) {
        const events = runtime.history.filter((entry) => entry.actor !== "system").slice(0, 3);
        const newestId = events[0]?.id || null;
        const shouldAnimate = Boolean(newestId && newestId !== runtime.lastAnimatedId);
        const enemyName = enemy?.name || "Criatura";

        versus.hidden = false;
        versus.className = "battle-versus encounter-exchange is-active";
        versus.setAttribute("aria-label", "Linha do tempo do combate");
        versus.innerHTML = `
            <header class="encounter-exchange__header">
                <span><i></i> COMBATE AO VIVO</span>
                <strong>RODADA ${format(battle.round || 0)}</strong>
            </header>
            <div class="encounter-exchange__timeline" aria-live="polite">
                ${events.length
                    ? events.map((entry, index) => exchangeEntryHTML(entry, shouldAnimate && index === 0)).join("")
                    : `
                        <div class="encounter-exchange__empty">
                            <span>⚔</span>
                            <strong>${escapeHTML(heroIdentity().name)} contra ${escapeHTML(enemyName)}</strong>
                            <small>Aguardando a primeira troca de golpes.</small>
                        </div>
                    `}
            </div>
            <footer class="encounter-exchange__footer">
                <span><i></i> Resolução automática</span>
                <small>${events[0] ? `Último resultado: ${escapeHTML(events[0].outcome)}` : "Preparando ações"}</small>
            </footer>
        `;

        if (shouldAnimate) runtime.lastAnimatedId = newestId;
    }

    function renderIdleBrief(versus, hunt) {
        const activeHunt = Boolean(hunt.isActive);
        const lastOutcome = runtime.lastOutcome;
        versus.hidden = false;
        versus.className = "battle-versus encounter-exchange encounter-idle-brief";
        versus.setAttribute("aria-label", activeHunt ? "Estado da exploração" : "Próxima jornada");
        versus.innerHTML = `
            <span class="encounter-idle-brief__icon" aria-hidden="true">${activeHunt ? "⌖" : "◇"}</span>
            <div class="encounter-idle-brief__copy">
                <small>${activeHunt ? "EXPEDIÇÃO EM CURSO" : "ARENA LIVRE"}</small>
                <strong>${activeHunt ? "Procurando a próxima ameaça" : "Pronto para uma nova jornada"}</strong>
                <p>${activeHunt
                    ? "A exploração continua. O próximo encontro aparecerá aqui sem esticar o cartão do herói."
                    : "Escolha uma Hunt ou Expedição para começar a próxima sequência de encontros."}</p>
            </div>
            ${lastOutcome ? `
                <div class="encounter-idle-brief__last is-${escapeHTML(lastOutcome.tone || "victory")}">
                    <span>ÚLTIMO COMBATE</span>
                    <strong>${escapeHTML(lastOutcome.title)}</strong>
                    <small>${escapeHTML(lastOutcome.detail)}</small>
                </div>
            ` : ""}
            ${!activeHunt ? `<button type="button" data-open-hunt-map>Abrir Mapa Mundi</button>` : `<span class="encounter-idle-brief__pulse"><i></i> BUSCANDO</span>`}
        `;
    }

    function renderEncounterEnhancements() {
        const projection = syncProjection();
        ensureCombatSpeedControls();
        const stage = document.querySelector(".battle-stage-panel");
        const arena = stage?.querySelector(".battle-card-arena");
        const versus = arena?.querySelector(".battle-versus");
        if (!stage || !arena || !versus) return false;

        const battle = projection
            ? {
                isFighting: projection.active,
                battleId: projection.battleId,
                round: projection.round,
                phase: projection.phase,
                creature: projection.enemy
            }
            : (Aethra.GameState.battle || {});
        const combat = projection
            ? { isActive: projection.active, combatId: projection.battleId, round: projection.round, enemy: projection.enemy }
            : (Aethra.GameState.combat || {});
        const hunt = Aethra.GameState.hunt || {};
        const enemy = (battle.isFighting ? battle.creature : null) || (combat.isActive ? combat.enemy : null) || null;
        const combatActive = Boolean((battle.isFighting || combat.isActive) && enemy);
        const hasEvent = arena.classList.contains("has-event-card") && !combatActive;

        if (!combatActive && !hasEvent) {
            arena.classList.add("is-hero-only");
            arena.classList.remove("has-enemy-card", "has-context-card");
            const enemyCard = document.getElementById("battle-enemy-card");
            if (enemyCard) enemyCard.hidden = true;
        }

        document.body.classList.add("aethra-encounter-combat-hud");
        stage.classList.toggle("is-modern-combat-active", combatActive);
        stage.classList.toggle("is-modern-combat-idle", !combatActive && !hasEvent);

        const header = stage.querySelector(":scope > .battle-panel__header");
        const kicker = header?.querySelector("small");
        const title = header?.querySelector("h2");
        const indicator = document.getElementById("battle-round-indicator");

        if (combatActive) {
            if (kicker) kicker.textContent = "TROCA DE AÇÕES POR RODADA";
            if (title) title.textContent = "Arena de Combate";
            if (indicator) {
                indicator.innerHTML = battle.phase === "victory-resolution"
                    ? "VITÓRIA"
                    : `<i></i> RODADA ${format(battle.round || combat.round || 0)}`;
            }
            renderActiveExchange(versus, battle, enemy);
        } else if (!hasEvent) {
            if (kicker) kicker.textContent = hunt.isActive ? "EXPLORAÇÃO E PRÓXIMO ENCONTRO" : "PREPARAÇÃO DO HERÓI";
            if (title) title.textContent = hunt.isActive ? "Entre Encontros" : "Próxima Jornada";
            if (indicator) indicator.innerHTML = hunt.isActive ? "<i></i> EXPLORANDO" : "AGUARDANDO";
            renderIdleBrief(versus, hunt);
        } else {
            versus.classList.remove("encounter-exchange", "encounter-idle-brief", "is-active");
        }

        enhanceCombatantCards(combatActive);
        applyCombatSpeed();
        return true;
    }

    Aethra.EventBus.on("render:battle-cards", renderEncounterEnhancements);
    Aethra.EventBus.on("render:all-completed", renderEncounterEnhancements);
    Aethra.EventBus.on("combat:projection-changed", () => {
        Aethra.RenderEngine.schedule("combat-projection", () => Aethra.RenderEngine.renderBattleCards());
    });

    document.addEventListener("click", (event) => {
        const speedControl = event.target.closest("[data-battle-speed]");
        if (speedControl) {
            event.preventDefault();
            const speed = Number(speedControl.dataset.battleSpeed);
            Aethra.SettingsManager?.setCombatSpeed?.(speed, { source: "combat-hud" });
            applyCombatSpeed(speed);
            return;
        }

        if (!event.target.closest(".encounter-idle-brief [data-open-hunt-map]")) return;
        event.preventDefault();
        Aethra.openHuntWorldMap?.();
    });

    Aethra.EncounterCombatHUD = {
        enhance: renderEncounterEnhancements,
        ensureCombatSpeedControls,
        getHistory: () => runtime.history.map((entry) => ({ ...entry })),
        getHeroResources: liveHeroResources,
        pushEntry,
        resetHistory
    };

    Aethra.EventBus.on("settings:combat-speed-changed", (payload = {}) => {
        applyCombatSpeed(payload.combatSpeed);
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => window.setTimeout(renderEncounterEnhancements, 0), { once: true });
    } else {
        window.setTimeout(renderEncounterEnhancements, 0);
    }
    applyCombatSpeed();
})(window.Aethra);
