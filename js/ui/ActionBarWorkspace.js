// ActionBarWorkspace.js - Scalable multi-bar HUD inspired by classic MMO action grids.
(function (Aethra) {
    "use strict";

    if (!Aethra?.RenderEngine || !Aethra?.SkillSystem || !Aethra?.EventBus) return;
    if (Aethra.ActionBarWorkspace) return;

    const Render = Aethra.RenderEngine;
    const MAX_BARS = 4;
    const HOTKEY_CODES = [
        "Digit1", "Digit2", "Digit3", "Digit4", "Digit5",
        "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"
    ];
    let scheduledFrame = null;
    let lastWheelAt = 0;

    const escapeHTML = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    function getBars() {
        return Aethra.SkillSystem.getActionBars?.() || [];
    }

    function activeIndex() {
        return Math.max(0, Number(Aethra.GameState.hero?.activeActionBar || 0));
    }

    function keyLabel(slotIndex) {
        if (slotIndex >= 0 && slotIndex <= 8) return String(slotIndex + 1);
        if (slotIndex === 9) return "0";
        return `S${slotIndex + 1}`;
    }

    function isStackOpen() {
        return Aethra.GameState.ui?.actionBarStackOpen === true;
    }

    function setStackOpen(open) {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.actionBarStackOpen = Boolean(open);
        renderStackDrawer();
    }

    function refreshSkillSettings() {
        const skillsWindow = document.getElementById("skills-view");
        if (!skillsWindow || skillsWindow.classList.contains("hidden")) return;
        Aethra.UIManager?.renderSkillSettings?.();
    }

    function switchBar(index, { render = true } = {}) {
        const bars = getBars();
        if (!bars.length) return false;
        const normalized = ((Number(index) % bars.length) + bars.length) % bars.length;
        const changed = Aethra.SkillSystem.setActiveBar?.(normalized);
        if (changed === false) return false;
        if (render) Render.renderActionBar?.();
        refreshSkillSettings();
        return true;
    }

    function cycleBar(direction) {
        const bars = getBars();
        if (bars.length < 2) return false;
        return switchBar(activeIndex() + (direction < 0 ? -1 : 1));
    }

    function addBar() {
        const bars = getBars();
        if (bars.length >= MAX_BARS) {
            Aethra.EventBus.emit("BattleLog", {
                message: "O limite de quatro ActionBars já foi alcançado.",
                color: "#f1d17a",
                type: "system"
            });
            return false;
        }
        const created = Aethra.SkillSystem.addBar?.();
        if (!created) return false;
        switchBar(getBars().length - 1);
        return true;
    }

    function normalizeActiveSlots() {
        const slots = [...document.querySelectorAll("#skill-action-bar .battle-action-slot")];
        slots.forEach((slot) => {
            const index = Number(slot.dataset.slotIndex || 0);
            slot.classList.remove("is-fluid-overflow");
            slot.dataset.hotkey = keyLabel(index);
            const key = slot.querySelector(".battle-action-slot__key");
            if (key) key.textContent = keyLabel(index);
            const priority = slot.querySelector(".battle-action-slot__priority");
            if (priority) {
                const priorityNumber = priority.textContent.match(/\d+/)?.[0] || String(index + 1);
                priority.textContent = `P${priorityNumber}`;
            }
            const button = slot.querySelector(".battle-action-slot__skill");
            if (button) {
                button.setAttribute("aria-keyshortcuts", index < 10 ? keyLabel(index) : "");
            }
            if (slot.classList.contains("is-empty")) {
                slot.draggable = false;
                slot.title = `Slot ${index + 1} vazio · clique para configurar`;
            }
        });
        return slots;
    }

    function toolbarHTML(bars, current) {
        const bar = bars[current] || { name: "Barra 1", slots: [] };
        const filled = (bar.slots || []).filter(Boolean).length;
        return `
            <div class="actionbar-workspace__identity">
                <span class="actionbar-workspace__eyebrow">LOADOUT ATIVO</span>
                <strong>${escapeHTML(bar.name || `Barra ${current + 1}`)}</strong>
                <small>${filled}/${bar.slots?.length || 0}</small>
            </div>
            <button type="button" class="actionbar-workspace__arrow" data-actionbar-cycle="-1" aria-label="ActionBar anterior" title="Barra anterior">‹</button>
            <div class="actionbar-workspace__bar-tabs" role="tablist" aria-label="ActionBars" data-actionbar-wheel-zone>
                ${bars.map((item, index) => `
                    <button type="button" role="tab" data-actionbar-index="${index}" aria-selected="${index === current}" class="${index === current ? "is-active" : ""}" title="${escapeHTML(item.name || `Barra ${index + 1}`)}">
                        ${index + 1}
                    </button>
                `).join("")}
            </div>
            <button type="button" class="actionbar-workspace__arrow" data-actionbar-cycle="1" aria-label="Próxima ActionBar" title="Próxima barra">›</button>
            <button type="button" class="actionbar-workspace__tool" data-actionbar-add aria-label="Criar ActionBar" title="Criar nova ActionBar" ${bars.length >= MAX_BARS ? "disabled" : ""}>＋</button>
            <button type="button" class="actionbar-workspace__tool ${isStackOpen() ? "is-active" : ""}" data-actionbar-stack aria-expanded="${isStackOpen()}" aria-label="Exibir todas as ActionBars" title="Exibir barras empilhadas">▦</button>
            <span class="actionbar-workspace__hint"><kbd>1–0</kbd> usar <i></i> role sobre os números para trocar</span>
        `;
    }

    function ensureWorkspace() {
        const deck = document.querySelector("#battle-actionbar-layer .skill-action-deck");
        const bar = document.getElementById("skill-action-bar");
        if (!deck || !bar) return false;

        document.body.classList.add("aethra-actionbar-workspace");
        deck.classList.add("skill-action-deck--workspace");
        deck.querySelector(".battle-priority-legend")?.classList.add("is-workspace-hidden");

        let toolbar = deck.querySelector(":scope > .actionbar-workspace__toolbar");
        if (!toolbar) {
            toolbar = document.createElement("div");
            toolbar.className = "actionbar-workspace__toolbar";
            bar.before(toolbar);
        }

        const bars = getBars();
        const current = Math.min(activeIndex(), Math.max(0, bars.length - 1));
        toolbar.innerHTML = toolbarHTML(bars, current);
        bar.style.setProperty("--actionbar-slot-count", String(Math.max(1, bars[current]?.slots?.length || 10)));
        bar.dataset.activeBarIndex = String(current);
        normalizeActiveSlots();
        renderStackDrawer();
        if (!Aethra.CombatHudModernizer) ensureLoadoutEditor();
        return true;
    }

    function stackRowHTML(bar, barIndex, current) {
        const slots = Array.isArray(bar.slots) ? bar.slots : [];
        return `
            <section class="actionbar-stack-row ${barIndex === current ? "is-active" : ""}" data-stack-bar="${barIndex}">
                <button type="button" class="actionbar-stack-row__label" data-actionbar-index="${barIndex}" aria-label="Ativar ${escapeHTML(bar.name || `Barra ${barIndex + 1}`)}">
                    <b>${barIndex + 1}</b><span>${escapeHTML(bar.name || `Barra ${barIndex + 1}`)}</span>
                </button>
                <div class="actionbar-stack-row__slots">
                    ${slots.map((skillId, slotIndex) => {
                        const skill = skillId ? Aethra.SkillSystem.getSkill?.(skillId) : null;
                        return `
                            <button type="button" class="actionbar-stack-slot ${skill ? "is-filled" : "is-empty"}" data-stack-bar-index="${barIndex}" data-stack-slot-index="${slotIndex}" ${skill ? `data-stack-skill="${escapeHTML(skillId)}"` : ""} title="${escapeHTML(skill?.name || `Slot ${slotIndex + 1} vazio`)}">
                                <small>${escapeHTML(keyLabel(slotIndex))}</small>
                                <strong>${escapeHTML(skill?.icon || "+")}</strong>
                            </button>
                        `;
                    }).join("")}
                </div>
            </section>
        `;
    }

    function renderStackDrawer() {
        const deck = document.querySelector("#battle-actionbar-layer .skill-action-deck");
        if (!deck) return false;
        let drawer = deck.querySelector(":scope > .actionbar-stack-drawer");
        if (!drawer) {
            drawer = document.createElement("aside");
            drawer.className = "actionbar-stack-drawer";
            drawer.setAttribute("aria-label", "Todas as ActionBars");
            deck.appendChild(drawer);
        }

        const bars = getBars();
        const current = activeIndex();
        drawer.hidden = !isStackOpen();
        drawer.setAttribute("aria-hidden", isStackOpen() ? "false" : "true");
        drawer.innerHTML = `
            <header><div><small>ACESSO RÁPIDO</small><strong>Barras empilhadas</strong></div><span>${bars.length}/${MAX_BARS}</span></header>
            <div class="actionbar-stack-drawer__rows">
                ${bars.map((bar, index) => stackRowHTML(bar, index, current)).join("")}
            </div>
        `;
        return true;
    }

    function skillOptionsHTML(skills, selectedId) {
        return [
            `<option value="">Vazio</option>`,
            ...skills.map((skill) => `
                <option value="${escapeHTML(skill.id)}" ${skill.id === selectedId ? "selected" : ""}>${escapeHTML(skill.name)}</option>
            `)
        ].join("");
    }

    function ensureLoadoutEditor() {
        const container = document.getElementById("skills-config-list");
        if (!container) return false;
        const bars = getBars();
        const current = Math.min(activeIndex(), Math.max(0, bars.length - 1));
        const bar = bars[current];
        if (!bar) return false;

        let editor = container.querySelector(":scope > .actionbar-loadout-editor");
        if (!editor) {
            editor = document.createElement("section");
            editor.className = "actionbar-loadout-editor";
            container.prepend(editor);
        }

        const skills = Object.values(Aethra.SkillSystem.getSkills?.() || {})
            .filter((skill) => skill && skill.category !== "primary" && !skill.primarySlot);
        editor.innerHTML = `
            <header class="actionbar-loadout-editor__header">
                <div><small>LOADOUT E ATALHOS</small><strong>${escapeHTML(bar.name || `Barra ${current + 1}`)}</strong></div>
                <nav aria-label="Editar ActionBar">
                    ${bars.map((item, index) => `<button type="button" data-loadout-bar-index="${index}" class="${index === current ? "is-active" : ""}">${index + 1}</button>`).join("")}
                    <button type="button" data-actionbar-add aria-label="Criar ActionBar" ${bars.length >= MAX_BARS ? "disabled" : ""}>＋</button>
                </nav>
            </header>
            <p>Escolha uma habilidade para cada tecla. Se ela já estiver nesta barra, os dois slots serão trocados.</p>
            <div class="actionbar-loadout-editor__grid">
                ${bar.slots.map((skillId, slotIndex) => {
                    const skill = skillId ? Aethra.SkillSystem.getSkill?.(skillId) : null;
                    return `
                        <label class="actionbar-loadout-slot ${skill ? "is-filled" : "is-empty"}">
                            <span><kbd>${escapeHTML(keyLabel(slotIndex))}</kbd><i>${escapeHTML(skill?.icon || "+")}</i></span>
                            <select data-loadout-slot="${slotIndex}" aria-label="Habilidade do slot ${slotIndex + 1}" title="${escapeHTML(skill?.name || `Slot ${slotIndex + 1} vazio`)}">
                                ${skillOptionsHTML(skills, skillId)}
                            </select>
                        </label>
                    `;
                }).join("")}
            </div>
        `;
        return true;
    }

    function assignLoadoutSkill(slotIndex, skillId) {
        const bar = Aethra.SkillSystem.getActiveBar?.();
        if (!bar) return false;
        const nextSkillId = skillId || null;
        const existingIndex = nextSkillId ? bar.slots.indexOf(nextSkillId) : -1;
        const changed = existingIndex >= 0 && existingIndex !== slotIndex
            ? Aethra.SkillSystem.moveSkill(existingIndex, slotIndex)
            : Aethra.SkillSystem.assignSkill(slotIndex, nextSkillId);
        if (!changed) return false;
        Render.renderActionBar?.();
        Aethra.UIManager?.renderSkillSettings?.();
        return true;
    }

    function useActiveSlot(slotIndex) {
        const slot = document.querySelector(`#skill-action-bar .battle-action-slot.is-filled[data-slot-index="${slotIndex}"]`);
        const button = slot?.querySelector("[data-actionbar-skill]");
        if (!button || button.disabled) return false;
        button.click();
        return true;
    }

    function useStackSlot(barIndex, slotIndex, skillId) {
        if (!skillId) {
            switchBar(barIndex);
            document.querySelector('#battle-actionbar-layer [data-open-window="skills-view"]')?.click();
            return false;
        }
        switchBar(barIndex);
        return useActiveSlot(slotIndex);
    }

    function scheduleWorkspace() {
        if (scheduledFrame !== null) return;
        scheduledFrame = requestAnimationFrame(() => {
            scheduledFrame = null;
            ensureWorkspace();
        });
    }

    const originalRenderActionBar = Render.renderActionBar.bind(Render);
    Render.renderActionBar = function (...args) {
        const result = originalRenderActionBar(...args);
        ensureWorkspace();
        return result;
    };

    const skillSettingsOwner = Aethra.UIManager;
    if (skillSettingsOwner?.renderSkillSettings && !skillSettingsOwner._actionBarWorkspaceWrapped) {
        const originalSkillSettings = skillSettingsOwner.renderSkillSettings;
        skillSettingsOwner.renderSkillSettings = function (...args) {
            const result = originalSkillSettings.apply(this, args);
            ensureLoadoutEditor();
            return result;
        };
        skillSettingsOwner._actionBarWorkspaceWrapped = true;
    }

    document.addEventListener("click", (event) => {
        const cycle = event.target.closest?.("[data-actionbar-cycle]");
        if (cycle) {
            cycleBar(Number(cycle.dataset.actionbarCycle));
            return;
        }
        const barButton = event.target.closest?.("[data-actionbar-index], [data-loadout-bar-index]");
        if (barButton) {
            const index = Number(barButton.dataset.actionbarIndex ?? barButton.dataset.loadoutBarIndex);
            switchBar(index);
            return;
        }
        if (event.target.closest?.("[data-actionbar-add]")) {
            addBar();
            return;
        }
        const stackToggle = event.target.closest?.("[data-actionbar-stack]");
        if (stackToggle) {
            setStackOpen(!isStackOpen());
            ensureWorkspace();
            return;
        }
        const stackSlot = event.target.closest?.("[data-stack-slot-index]");
        if (stackSlot) {
            useStackSlot(
                Number(stackSlot.dataset.stackBarIndex),
                Number(stackSlot.dataset.stackSlotIndex),
                stackSlot.dataset.stackSkill || null
            );
        }
    });

    document.addEventListener("change", (event) => {
        const select = event.target.closest?.("[data-loadout-slot]");
        if (!select) return;
        assignLoadoutSkill(Number(select.dataset.loadoutSlot), select.value || null);
    });

    document.addEventListener("wheel", (event) => {
        if (!event.target.closest?.("[data-actionbar-wheel-zone]")) return;
        event.preventDefault();
        const now = performance.now();
        if (now - lastWheelAt < 180) return;
        lastWheelAt = now;
        cycleBar(event.deltaY < 0 ? -1 : 1);
    }, { passive: false });

    document.addEventListener("keydown", (event) => {
        if (event.defaultPrevented || event.repeat) return;
        const target = event.target;
        if (target instanceof Element && target.closest("input, textarea, select, [contenteditable=true]")) return;
        if (!document.body.classList.contains("aethra-battle-mode")) return;
        if (document.querySelector('.game-window[data-aethra-window]:not(#city-view):not(.hidden)[aria-hidden="false"]')) return;

        const hotkeyIndex = HOTKEY_CODES.indexOf(event.code);
        if (hotkeyIndex >= 0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
            if (useActiveSlot(hotkeyIndex)) event.preventDefault();
            return;
        }
        if (event.code === "BracketLeft" || event.code === "BracketRight") {
            event.preventDefault();
            cycleBar(event.code === "BracketLeft" ? -1 : 1);
        }
    });

    ["actionBarChanged", "skill:registered", "window:opened", "render:battle-mode-ready"]
        .forEach((eventName) => Aethra.EventBus.on(eventName, scheduleWorkspace));

    Aethra.ActionBarWorkspace = {
        maxBars: MAX_BARS,
        ensure: ensureWorkspace,
        switchBar,
        cycleBar,
        addBar,
        setStackOpen,
        assignLoadoutSkill,
        useActiveSlot
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => window.setTimeout(scheduleWorkspace, 0), { once: true });
    } else {
        window.setTimeout(scheduleWorkspace, 0);
    }
})(window.Aethra);
