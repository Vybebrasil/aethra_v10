// CombatHudModernizer.js - Compact combat HUD and usable survival/loadout control center.
(function (Aethra) {
    "use strict";

    if (!Aethra?.RenderEngine || !Aethra?.SkillSystem || !Aethra?.SkillController || !Aethra?.EventBus) return;
    if (Aethra.CombatHudModernizer) return;

    const Render = Aethra.RenderEngine;
    const UI = Aethra.UIManager || Aethra.UI_Renderer;
    let scheduledFrame = null;

    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const format = (value) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(number(value, 0));
    const escapeHTML = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    function bars() {
        return Aethra.SkillSystem.getActionBars?.() || [];
    }

    function activeBarIndex() {
        const collection = bars();
        return clamp(Math.floor(number(Aethra.GameState.hero?.activeActionBar, 0)), 0, Math.max(0, collection.length - 1));
    }

    function activeBar() {
        return bars()[activeBarIndex()] || { name: "Barra 1", slots: [] };
    }

    function selectedSlot() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        const size = Math.max(1, activeBar().slots?.length || 10);
        const selected = clamp(Math.floor(number(Aethra.GameState.ui.combatConfigSlot, 0)), 0, size - 1);
        Aethra.GameState.ui.combatConfigSlot = selected;
        return selected;
    }

    function setSelectedSlot(index) {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.combatConfigSlot = clamp(Math.floor(number(index, 0)), 0, Math.max(0, (activeBar().slots?.length || 10) - 1));
        return Aethra.GameState.ui.combatConfigSlot;
    }

    function resourceState() {
        const hero = Aethra.GameState.hero || {};
        const stats = hero.stats || {};
        const hp = Math.max(0, number(hero.hp ?? stats.hp, 0));
        const maxHp = Math.max(1, number(hero.maxHp ?? stats.maxHp, 1));
        const mana = Math.max(0, number(hero.mana ?? stats.mana, 0));
        const maxMana = Math.max(1, number(hero.maxMana ?? stats.maxMana, 1));
        const energy = Math.max(0, number(hero.vigor ?? stats.vigor ?? hero.energy ?? stats.energy, 0));
        const maxEnergy = Math.max(1, number(hero.maxVigor ?? stats.maxVigor ?? hero.maxEnergy ?? stats.maxEnergy, 100));
        return {
            hp: { label: "HP", current: hp, max: maxHp, percent: clamp((hp / maxHp) * 100, 0, 100) },
            mana: { label: "MP", current: mana, max: maxMana, percent: clamp((mana / maxMana) * 100, 0, 100) },
            energy: { label: "Vigor", current: energy, max: maxEnergy, percent: clamp((energy / maxEnergy) * 100, 0, 100) }
        };
    }

    function skillType(skill) {
        const type = String(skill?.type || skill?.effect?.type || "utility").toLowerCase();
        if (type === "heal") return { id: "support", label: "Sobrevivência" };
        if (["damage", "attack", "offensive"].includes(type)) return { id: "damage", label: "Dano" };
        return { id: "utility", label: "Utilidade" };
    }

    function skillCost(skill) {
        const cost = skill?.cost || {};
        const amount = Math.max(0, number(skill?.manaCost ?? cost.amount ?? cost.value, 0));
        if (amount <= 0) return "Sem custo";
        const resource = String(cost.resource || cost.type || "mana").toLowerCase();
        return `${format(amount)} ${resource === "energy" ? "Vigor" : "Mana"}`;
    }

    function cooldownText(skill) {
        const rounds = Math.max(0, number(skill?.cooldownRounds, 0));
        if (rounds > 0) return `${rounds} rodada${rounds === 1 ? "" : "s"} de recarga`;
        const raw = Math.max(0, number(skill?.cooldown, 0));
        const seconds = raw > 60 ? raw / 1000 : raw;
        return seconds > 0 ? `${seconds.toFixed(seconds % 1 ? 1 : 0)}s recarga` : "Sem recarga";
    }

    function resourceChipHTML(id, resource, compact = false) {
        return `
            <span class="modern-resource modern-resource--${id}" data-modern-resource="${id}" data-ui-tooltip data-tooltip-kind="resource" data-tooltip-title="${escapeHTML(resource.label)}" data-tooltip-value="${format(resource.current)} / ${format(resource.max)}" data-tooltip-body="Recurso atual do herói usado pelas regras de sobrevivência e habilidades.">
                <small>${escapeHTML(resource.label)}</small>
                <i><u style="width:${resource.percent.toFixed(2)}%"></u></i>
                <b>${compact ? format(resource.current) : `${format(resource.current)}/${format(resource.max)}`}</b>
            </span>`;
    }

    function renderSurvivalStrip() {
        const header = document.querySelector("#battle-actionbar-layer > .battle-panel--actionbar > .battle-panel__header");
        if (!header) return false;

        document.body.classList.add("aethra-combat-hud-modern");
        let strip = header.querySelector(":scope > .combat-survival-strip");
        if (!strip) {
            strip = document.createElement("div");
            strip.className = "combat-survival-strip";
            const tools = header.querySelector(":scope > .battle-panel__tools");
            header.insertBefore(strip, tools || null);
        }

        const resources = resourceState();
        const settings = Aethra.SkillController.getSettings?.() || {};
        const autoSkills = Object.values(settings).filter((setting) => setting?.auto === true).length;
        strip.innerHTML = `
            ${resourceChipHTML("hp", resources.hp, true)}
            ${resourceChipHTML("mana", resources.mana, true)}
            ${resourceChipHTML("energy", resources.energy, true)}
            <span class="combat-survival-strip__automation"><i></i><b>${autoSkills}</b><small>AUTO</small></span>`;
        return true;
    }

    function enhancePrimaryAttacks() {
        document.querySelectorAll("#primary-attack-bar .primary-attack-card").forEach((card) => {
            card.classList.add("primary-attack-card--modern");
            const slot = card.dataset.primarySlot;
            const button = card.querySelector("[data-primary-attack]");
            if (button) button.title = slot === "right" ? "Ataque da mão secundária" : "Ataque da mão principal";
        });
        return true;
    }

    function loadoutSlotHTML(skillId, slotIndex, settings, selected) {
        const skill = skillId ? Aethra.SkillSystem.getSkill?.(skillId) : null;
        const isAuto = Boolean(skillId && settings[skillId]?.auto);
        return `
            <button type="button" class="modern-loadout-slot ${skill ? "is-filled" : "is-empty"} ${isAuto ? "is-auto" : ""} ${slotIndex === selected ? "is-selected" : ""}" data-modern-slot="${slotIndex}" aria-pressed="${slotIndex === selected}" title="${escapeHTML(skill?.name || `Slot ${slotIndex + 1} vazio`)}">
                <kbd>${slotIndex === 9 ? "0" : slotIndex + 1}</kbd>
                <strong>${escapeHTML(skill?.icon || "+")}</strong>
                <span>${escapeHTML(skill?.name || "Vazio")}</span>
                ${isAuto ? "<i>A</i>" : ""}
            </button>`;
    }

    function availableSkillHTML(skill, selectedSkillId) {
        const role = skillType(skill);
        return `
            <button type="button" class="modern-skill-pick is-${role.id} ${skill.id === selectedSkillId ? "is-current" : ""}" data-modern-assign-skill="${escapeHTML(skill.id)}" title="Colocar ${escapeHTML(skill.name)} no slot selecionado">
                <strong>${escapeHTML(skill.icon || "✦")}</strong>
                <span><b>${escapeHTML(skill.name)}</b><small>${escapeHTML(role.label)} · ${escapeHTML(skillCost(skill))}</small></span>
            </button>`;
    }

    function priorityCardHTML(entry, index, count) {
        const { skillId, slotIndex, skill, setting } = entry;
        const role = skillType(skill);
        const isHeal = role.id === "support";
        const threshold = clamp(number(setting?.hpThreshold ?? skill?.hpThreshold, 50), 5, 95);
        return `
            <article class="modern-skill-rule is-${role.id}" data-modern-skill-rule="${escapeHTML(skillId)}">
                <div class="modern-skill-rule__priority">
                    <span><small>PRIO</small><b>${index + 1}</b></span>
                    <div>
                        <button type="button" data-modern-move="up" data-modern-skill-id="${escapeHTML(skillId)}" aria-label="Subir ${escapeHTML(skill.name)}" ${index === 0 ? "disabled" : ""}>↑</button>
                        <button type="button" data-modern-move="down" data-modern-skill-id="${escapeHTML(skillId)}" aria-label="Descer ${escapeHTML(skill.name)}" ${index === count - 1 ? "disabled" : ""}>↓</button>
                    </div>
                </div>
                <div class="modern-skill-rule__identity">
                    <span>${escapeHTML(skill.icon || "✦")}</span>
                    <div><strong>${escapeHTML(skill.name)}</strong><small>${escapeHTML(role.label)} · Tecla ${slotIndex === 9 ? "0" : slotIndex + 1}</small></div>
                </div>
                <div class="modern-skill-rule__facts"><span>${escapeHTML(skillCost(skill))}</span><i></i><span>${escapeHTML(cooldownText(skill))}</span></div>
                <label class="modern-auto-switch">
                    <input type="checkbox" data-modern-auto="${escapeHTML(skillId)}" ${setting?.auto ? "checked" : ""}>
                    <span><i></i><b>${setting?.auto ? "Auto ativo" : "Manual"}</b></span>
                </label>
                <button type="button" class="modern-use-now" data-modern-use="${escapeHTML(skillId)}">Usar agora</button>
                ${isHeal ? `
                    <div class="modern-heal-rule">
                        <span><small>CURAR ABAIXO DE</small><output data-modern-threshold-output="${escapeHTML(skillId)}">${Math.round(threshold)}%</output></span>
                        <input type="range" min="5" max="95" step="5" value="${Math.round(threshold)}" data-modern-threshold="${escapeHTML(skillId)}" style="--threshold:${threshold}%" aria-label="Limite de vida para ${escapeHTML(skill.name)}">
                    </div>` : ""}
            </article>`;
    }

    function primaryControlHTML(slot, attack) {
        const isRight = slot === "right";
        const available = attack?.available !== false;
        return `
            <label class="modern-primary-control ${available ? "" : "is-unavailable"}">
                <span><kbd>${isRight ? "RMB" : "LMB"}</kbd><strong>${isRight ? "Mão secundária" : "Mão principal"}</strong><small>${escapeHTML(attack?.weapon?.name || (isRight ? "Sem arma equipada" : "Ataque desarmado"))}</small></span>
                <input type="checkbox" data-modern-primary-auto="${slot}" ${attack?.auto ? "checked" : ""} ${available ? "" : "disabled"}>
                <i></i>
            </label>`;
    }

    function renderSkillSettings(containerId = "skills-config-list") {
        const container = document.getElementById(containerId);
        const view = document.getElementById("skills-view");
        const status = document.getElementById("skills-priority-status");
        if (!container || !view || !status) return false;

        view.classList.add("skills-view--modern");
        view.querySelector(".skills-priority-guide")?.setAttribute("hidden", "");

        const snapshot = Aethra.SkillController.getSnapshot?.() || {};
        const entries = snapshot.orderedSkills || [];
        const settings = Aethra.SkillController.getSettings?.() || {};
        const resources = resourceState();
        const collection = bars();
        const currentIndex = activeBarIndex();
        const bar = collection[currentIndex] || { name: `Barra ${currentIndex + 1}`, slots: [] };
        const selected = selectedSlot();
        const selectedSkillId = bar.slots?.[selected] || null;
        const skills = Object.values(Aethra.SkillSystem.getSkills?.() || {})
            .filter((skill) => skill && skill.category !== "primary" && !skill.primarySlot);
        const primary = Aethra.BattleSystem?.getPrimaryAttackState
            ? {
                left: Aethra.BattleSystem.getPrimaryAttackState("left"),
                right: Aethra.BattleSystem.getPrimaryAttackState("right")
            }
            : Aethra.SkillSystem.getPrimaryAttacks?.() || {};
        const autoCount = entries.filter((entry) => entry.setting?.auto).length;
        const lastAction = snapshot.lastAction?.skill?.name || snapshot.lastAction?.message || "Aguardando combate";

        status.innerHTML = `
            <section class="modern-combat-summary">
                <div class="modern-combat-summary__state"><span><i></i>AUTOMAÇÃO</span><strong>${autoCount} regra(s) ativa(s)</strong><small>${escapeHTML(lastAction)}</small></div>
                <div class="modern-combat-summary__resources">
                    ${resourceChipHTML("hp", resources.hp)}
                    ${resourceChipHTML("mana", resources.mana)}
                    ${resourceChipHTML("energy", resources.energy)}
                </div>
            </section>`;

        container.innerHTML = `
            <div class="modern-combat-config">
                <aside class="modern-loadout-panel">
                    <header><div><small>LOADOUT ATIVO</small><strong>${escapeHTML(bar.name || `Barra ${currentIndex + 1}`)}</strong></div><nav>${collection.map((item, index) => `<button type="button" data-modern-bar="${index}" class="${index === currentIndex ? "is-active" : ""}" aria-label="Abrir ${escapeHTML(item.name || `Barra ${index + 1}`)}">${index + 1}</button>`).join("")}<button type="button" data-modern-add-bar aria-label="Criar ActionBar" ${collection.length >= (Aethra.ActionBarWorkspace?.maxBars || 4) ? "disabled" : ""}>＋</button></nav></header>
                    <p>Selecione um slot e depois uma habilidade.</p>
                    <div class="modern-loadout-grid">${(bar.slots || []).map((skillId, index) => loadoutSlotHTML(skillId, index, settings, selected)).join("")}</div>
                    <div class="modern-skill-library">
                        <header><span><strong>Habilidades</strong><small>Destino: tecla ${selected === 9 ? "0" : selected + 1}</small></span>${selectedSkillId ? "<button type=\"button\" data-modern-clear-slot>Limpar</button>" : ""}</header>
                        <div>${skills.map((skill) => availableSkillHTML(skill, selectedSkillId)).join("")}</div>
                    </div>
                    <details class="modern-decision-guide"><summary>Como a automação decide</summary><ol><li><b>1</b><span>Sobrevivência abaixo do limite de HP.</span></li><li><b>2</b><span>Primeira skill automática pronta.</span></li><li><b>3</b><span>Comando manual na fila.</span></li></ol></details>
                </aside>
                <main class="modern-rules-panel">
                    <header><div><small>REGRAS DA BARRA ${currentIndex + 1}</small><strong>Prioridade de execução</strong></div><span>${entries.length} configurada(s)</span></header>
                    <div class="modern-primary-controls">${primaryControlHTML("left", primary.left)}${primaryControlHTML("right", primary.right)}</div>
                    <div class="modern-rules-list">${entries.length ? entries.map((entry, index) => priorityCardHTML(entry, index, entries.length)).join("") : `<div class="modern-rules-empty"><strong>Esta barra está vazia</strong><span>Escolha um slot e adicione uma habilidade pela biblioteca.</span></div>`}</div>
                </main>
            </div>`;

        UI?.updateSkillUI?.();
        Aethra.EventBus.emit("ui:skills-settings-rendered", { count: entries.length, activeBar: bar, modern: true });
        return true;
    }

    function refreshResourceReadouts() {
        const resources = resourceState();
        Object.entries(resources).forEach(([id, resource]) => {
            document.querySelectorAll(`[data-modern-resource="${id}"]`).forEach((node) => {
                const bar = node.querySelector("i > u");
                const value = node.querySelector(":scope > b");
                if (bar) bar.style.width = `${resource.percent.toFixed(2)}%`;
                if (value) value.textContent = node.closest(".combat-survival-strip")
                    ? format(resource.current)
                    : `${format(resource.current)}/${format(resource.max)}`;
                node.dataset.tooltipValue = `${format(resource.current)} / ${format(resource.max)}`;
            });
        });
    }

    function scheduleModernHud() {
        if (scheduledFrame !== null) return;
        scheduledFrame = requestAnimationFrame(() => {
            scheduledFrame = null;
            renderSurvivalStrip();
            enhancePrimaryAttacks();
            refreshResourceReadouts();
        });
    }

    const originalActionBar = Render.renderActionBar.bind(Render);
    Render.renderActionBar = function (...args) {
        const result = originalActionBar(...args);
        scheduleModernHud();
        return result;
    };

    [Aethra.UIManager, Aethra.UI_Renderer]
        .filter((owner, index, collection) => owner && collection.indexOf(owner) === index)
        .forEach((owner) => {
            if (owner.renderSkillSettings) owner.renderSkillSettings = renderSkillSettings;
        });

    document.addEventListener("click", (event) => {
        const slot = event.target.closest?.("[data-modern-slot]");
        if (slot) {
            setSelectedSlot(Number(slot.dataset.modernSlot));
            renderSkillSettings();
            return;
        }
        const skill = event.target.closest?.("[data-modern-assign-skill]");
        if (skill) {
            Aethra.ActionBarWorkspace?.assignLoadoutSkill?.(selectedSlot(), skill.dataset.modernAssignSkill);
            renderSkillSettings();
            return;
        }
        if (event.target.closest?.("[data-modern-clear-slot]")) {
            Aethra.ActionBarWorkspace?.assignLoadoutSkill?.(selectedSlot(), null);
            renderSkillSettings();
            return;
        }
        const bar = event.target.closest?.("[data-modern-bar]");
        if (bar) {
            Aethra.ActionBarWorkspace?.switchBar?.(Number(bar.dataset.modernBar));
            setSelectedSlot(0);
            renderSkillSettings();
            return;
        }
        if (event.target.closest?.("[data-modern-add-bar]")) {
            Aethra.ActionBarWorkspace?.addBar?.();
            setSelectedSlot(0);
            renderSkillSettings();
            return;
        }
        const move = event.target.closest?.("[data-modern-move]");
        if (move) {
            Aethra.SkillController.moveSkill?.(move.dataset.modernSkillId, move.dataset.modernMove);
            renderSkillSettings();
            return;
        }
        const use = event.target.closest?.("[data-modern-use]");
        if (use) {
            const queued = Aethra.SkillController.queueManualSkill?.(use.dataset.modernUse);
            UI?.notify?.(queued ? "Habilidade adicionada à fila manual." : "Não foi possível usar a habilidade.", queued ? "success" : "error");
        }
    });

    document.addEventListener("input", (event) => {
        const range = event.target.closest?.("[data-modern-threshold]");
        if (!range) return;
        const value = clamp(number(range.value, 50), 5, 95);
        range.style.setProperty("--threshold", `${value}%`);
        const output = document.querySelector(`[data-modern-threshold-output="${range.dataset.modernThreshold}"]`);
        if (output) output.textContent = `${Math.round(value)}%`;
    });

    document.addEventListener("change", (event) => {
        const auto = event.target.closest?.("[data-modern-auto]");
        if (auto) {
            const skillId = auto.dataset.modernAuto;
            const enabled = auto.checked;
            window.setTimeout(() => Aethra.SkillController.setAuto?.(skillId, enabled), 0);
            return;
        }
        const primary = event.target.closest?.("[data-modern-primary-auto]");
        if (primary) {
            const slot = primary.dataset.modernPrimaryAuto;
            const enabled = primary.checked;
            window.setTimeout(() => Aethra.SkillSystem.setPrimaryAuto?.(slot, enabled), 0);
            return;
        }
        const threshold = event.target.closest?.("[data-modern-threshold]");
        if (threshold) {
            const skillId = threshold.dataset.modernThreshold;
            const value = threshold.value;
            window.setTimeout(() => Aethra.SkillController.setHpThreshold?.(skillId, value), 0);
        }
    });

    [
        "render:battle-mode-ready",
        "actionBarChanged",
        "actionbar:changed",
        "primary-attack:settings-changed",
        "primary-attack:used",
        "HealthChanged",
        "ManaChanged",
        "EnergyChanged",
        "statsChanged",
        "save:loaded"
    ].forEach((eventName) => Aethra.EventBus.on(eventName, scheduleModernHud));

    Aethra.EventBus.on("window:opened", (payload = {}) => {
        if ((payload.id || payload.windowId) === "skills-view") renderSkillSettings();
    });
    Aethra.EventBus.on("WindowOpened", (payload = {}) => {
        if ((payload.id || payload.windowId) === "skills-view") renderSkillSettings();
    });

    Aethra.CombatHudModernizer = {
        ensure: scheduleModernHud,
        renderSkillSettings,
        renderSurvivalStrip,
        selectSlot: setSelectedSlot,
        assignSkill(skillId, slotIndex = selectedSlot()) {
            setSelectedSlot(slotIndex);
            return Aethra.ActionBarWorkspace?.assignLoadoutSkill?.(selectedSlot(), skillId || null);
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => window.setTimeout(scheduleModernHud, 0), { once: true });
    } else {
        window.setTimeout(scheduleModernHud, 0);
    }
})(window.Aethra);
