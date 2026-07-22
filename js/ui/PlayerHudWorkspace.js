// PlayerHudWorkspace.js - cockpit compacto do herói, inspirado em HUDs de MMO.
(function (Aethra) {
    "use strict";

    if (!Aethra?.RenderEngine || !Aethra?.EventBus) return;

    const Render = Aethra.RenderEngine;
    const SLOT_DEFINITIONS = [
        { id: "head", label: "Cabeça", icon: "⌃" },
        { id: "neck", label: "Amuleto", icon: "◇" },
        { id: "relic", label: "Relíquia", icon: "✦" },
        { id: "weapon", label: "Arma", icon: "⚔" },
        { id: "chest", label: "Peitoral", icon: "▣" },
        { id: "offhand", label: "Mão 2", icon: "◐" },
        { id: "ring1", label: "Anel 1", icon: "○" },
        { id: "hands", label: "Luvas", icon: "✥" },
        { id: "ring2", label: "Anel 2", icon: "○" },
        { id: "legs", label: "Pernas", icon: "Ⅱ" },
        { id: "feet", label: "Botas", icon: "⌄" }
    ];
    const SECTION_ORDER = ["backpack", "skills", "overview"];
    const SECTION_LABELS = {
        equipment: ["♟", "Set equipado", "0/11 slots ativos", "inventory-view", "Gerenciar"],
        backpack: ["▦", "Backpack", "Loot, supplies e materiais", "inventory-view", "Abrir"],
        skills: ["↑", "Skills", "Maestrias por categoria", "skills-view", "Prioridades"],
        overview: ["✦", "Atributos", "Impacto real da build", null, "6 atributos"]
    };
    const RARITY_ORDER = {
        common: 1,
        uncommon: 2,
        rare: 3,
        epic: 4,
        legendary: 5,
        mythic: 6
    };

    const esc = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    const fmt = (value) => new Intl.NumberFormat("pt-BR").format(Number(value || 0));
    const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value || 0)));
    const normalize = (value) => String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    function uiState() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        return Aethra.GameState.ui;
    }

    function getHeroLevel(hero) {
        return Math.max(1, Number(hero.level ?? hero.stats?.level ?? 1));
    }

    function getHeroResources() {
        const hero = Aethra.GameState.hero || {};
        const stats = hero.stats || {};
        const hp = Number(hero.hp ?? stats.hp ?? stats.health ?? 0);
        const hpMax = Math.max(1, Number(hero.maxHp ?? stats.maxHp ?? stats.maxHealth ?? hp ?? 1));
        const mana = Number(hero.mana ?? stats.mana ?? 0);
        const manaMax = Math.max(1, Number(hero.maxMana ?? stats.maxMana ?? mana ?? 1));
        const vigor = Number(hero.energy ?? hero.vigor ?? stats.energy ?? stats.vigor ?? 0);
        const vigorMax = Math.max(1, Number(hero.maxEnergy ?? hero.maxVigor ?? stats.maxEnergy ?? stats.maxVigor ?? vigor ?? 100));
        const xp = Number(hero.xpCurrent ?? hero.xp ?? stats.xpCurrent ?? stats.xp ?? 0);
        const xpMax = Math.max(1, Number(hero.xpNext ?? stats.xpNext ?? 100));
        return { hero, stats, hp, hpMax, mana, manaMax, vigor, vigorMax, xp, xpMax };
    }

    function currentLocation() {
        const hunt = Aethra.GameState.hunt || {};
        const definition = Aethra.HuntSystem?.hunts?.[hunt.huntId];
        const inCity = (Aethra.UIManager?.primaryView || uiState().primaryView) === "city";
        if (inCity) return { name: "Vila de Aethra", state: "Zona segura", tone: "safe" };
        if (hunt.isActive) return {
            name: definition?.name || "Área de caçada",
            state: hunt.currentEnemy || Aethra.GameState.battle?.isFighting ? "Em combate" : "Explorando",
            tone: hunt.currentEnemy || Aethra.GameState.battle?.isFighting ? "danger" : "active"
        };
        return { name: "Acampamento", state: "Aguardando Hunt", tone: "idle" };
    }

    function resourceRow(id, label, current, max, icon) {
        const percent = clamp((current / Math.max(1, max)) * 100);
        return `
            <div class="player-vital player-vital--${id}" tabindex="0"
                data-ui-tooltip data-tooltip-kind="resource" data-tooltip-title="${esc(label)}"
                data-tooltip-value="${fmt(current)} / ${fmt(max)}"
                data-tooltip-body="${id === "hp" ? "Ao chegar a zero, o combate termina." : id === "mana" ? "Consumida por magias e habilidades de suporte." : id === "vigor" ? "Consumido por ataques físicos e posturas." : "Experiência até o próximo nível do herói."}">
                <span class="player-vital__icon" aria-hidden="true">${icon}</span>
                <div class="player-vital__body">
                    <header><strong>${esc(label)}</strong><span>${fmt(current)} / ${fmt(max)}</span></header>
                    <i><b style="width:${percent.toFixed(2)}%"></b></i>
                </div>
                <em>${percent.toFixed(0)}%</em>
            </div>`;
    }

    function getTopDiscipline(hero) {
        const disciplines = hero.disciplines || {};
        let topName = "Combate";
        let topLevel = 1;
        Object.entries(disciplines).forEach(([id, data]) => {
            const level = Number(data?.level || 1);
            if (level > topLevel) {
                topLevel = level;
                topName = Aethra.DisciplineSystem?.definitions?.[id]?.name || id;
            }
        });
        return `${topName} Nv. ${topLevel}`;
    }

    function renderSummary() {
        const root = document.getElementById("stats-display");
        if (!root) return false;
        const { hero, stats, hp, hpMax, mana, manaMax, vigor, vigorMax, xp, xpMax } = getHeroResources();
        const name = hero.name || "Aethra";
        const arena = Aethra.ColiseumSystem?.getSnapshot?.() || null;
        const rankTag = arena?.player?.rankTag || "#43";
        const bagCount = (hero.bag || []).length;
        const xpPercent = clamp((xp / Math.max(1, xpMax)) * 100).toFixed(0);

        const dmgMin = Math.max(1, Math.floor(Number(stats.damageMin || stats.attack || 1)));
        const dmgMax = Math.max(dmgMin, Math.floor(Number(stats.damageMax || stats.attack || dmgMin)));
        const defense = Math.max(0, Math.floor(Number(stats.defense || stats.armor || 0)));
        const precision = Math.round(clamp(Number(stats.precision || 0.85), 0, 1) * 100);
        const critical = Math.round(clamp(Number(stats.critical || 0.05), 0, 1) * 100);
        const topDiscipline = getTopDiscipline(hero);

        root.innerHTML = `
            <section class="player-hud-summary" aria-label="Resumo do personagem">
                <header class="player-hud-summary__identity">
                    <span class="player-hud-summary__portrait">
                        <img src="assets/entities/player_idle.png" alt="" draggable="false">
                    </span>
                    <div>
                        <strong>${esc(name)}</strong>
                        <span>NV ${fmt(getHeroLevel(hero))} · ${fmt(hero.gold)} Gold</span>
                    </div>
                </header>

                <div class="player-hud-summary__vitals">
                    ${resourceRow("hp", "HP", hp, hpMax, "♥")}
                    ${resourceRow("mana", "Mana", mana, manaMax, "✦")}
                    ${resourceRow("vigor", "Vigor", vigor, vigorMax, "⚡")}
                </div>

                <div class="player-hud-summary__body">
                    <div class="player-hud-summary__col player-hud-summary__col--left">
                        <div class="player-stat-badge" data-ui-tooltip data-tooltip-kind="hud" data-tooltip-title="Poder de Ataque" data-tooltip-body="Dano físico mínimo e máximo por golpe.">
                            <small>⚔ DANO</small>
                            <strong>${dmgMin}–${dmgMax}</strong>
                        </div>
                        <div class="player-stat-badge" data-ui-tooltip data-tooltip-kind="hud" data-tooltip-title="Defesa da Armadura" data-tooltip-body="Reduz o dano bruto recebido dos inimigos.">
                            <small>🛡 DEFESA</small>
                            <strong>${defense}</strong>
                        </div>
                        <div class="player-stat-badge" data-ui-tooltip data-tooltip-kind="hud" data-tooltip-title="Precisão" data-tooltip-body="Chance de acertar ataques e ignorar esquiva.">
                            <small>🎯 PRECISÃO</small>
                            <strong>${precision}%</strong>
                        </div>
                        <div class="player-stat-badge" data-ui-tooltip data-tooltip-kind="hud" data-tooltip-title="Crítico" data-tooltip-body="Chance de desfazer acerto crítico com dano elevado.">
                            <small>💥 CRÍTICO</small>
                            <strong>${critical}%</strong>
                        </div>
                    </div>

                    <div id="battle-equipment-summary" class="player-equipment-matrix player-equipment-matrix--tibia"></div>

                    <div class="player-hud-summary__col player-hud-summary__col--right">
                        <div class="player-stat-badge" data-ui-tooltip data-tooltip-kind="hud" data-tooltip-title="Mochila sem Limites" data-tooltip-body="Itens acumulados no inventário. O scroll da mochila é infinito.">
                            <small>🎒 MOCHILA</small>
                            <strong>${bagCount} itens</strong>
                        </div>
                        <div class="player-stat-badge" data-ui-tooltip data-tooltip-kind="hud" data-tooltip-title="Progresso de XP" data-tooltip-body="Experiência necessária para alcançar o próximo nível do herói.">
                            <small>⬆ XP NÍVEL</small>
                            <strong>${xpPercent}%</strong>
                        </div>
                        <div class="player-stat-badge" data-ui-tooltip data-tooltip-kind="hud" data-tooltip-title="Ranking do Coliseu" data-tooltip-body="Sua colocação no Coliseu de Aethra.">
                            <small>⚜ RANK</small>
                            <strong>${esc(rankTag)}</strong>
                        </div>
                        <div class="player-stat-badge" data-ui-tooltip data-tooltip-kind="hud" data-tooltip-title="Foco de Maestria" data-tooltip-body="Sua disciplina principal mais desenvolvida.">
                            <small>⚔ FOCO</small>
                            <strong>${esc(topDiscipline)}</strong>
                        </div>
                    </div>
                </div>
            </section>`;

        renderEquipmentMatrix();
        Aethra.TooltipManager?.refresh?.();
        return true;
    }

    function sectionHeading(id) {
        const [icon, title, subtitle, windowId, action] = SECTION_LABELS[id];
        const subtitleAttribute = id === "equipment" ? " data-player-fixed-equipment-count" : "";
        return `
            <div class="player-hud-section__title">
                <span aria-hidden="true">${icon}</span>
                <div><strong>${title}</strong><small${subtitleAttribute}>${subtitle}</small></div>
            </div>
            ${windowId
                ? `<button type="button" data-open-window="${windowId}">${action}</button>`
                : `<span class="player-hud-section__badge">${action}</span>`}`;
    }

    function activateSection(nav, views, sectionId) {
        const selectedId = SECTION_ORDER.includes(sectionId)
            ? sectionId
            : SECTION_ORDER[0];
        uiState().playerHudTab = selectedId;
        const hub = nav.closest("[data-hero-hub]");
        if (hub) hub.dataset.playerHudSection = selectedId;

        views.querySelectorAll("[data-hero-panel-view]").forEach((section) => {
            const active = section.dataset.heroPanelView === selectedId;
            section.hidden = !active;
            section.classList.toggle("is-active", active);
            section.setAttribute("aria-hidden", active ? "false" : "true");
        });

        nav.querySelectorAll("[data-player-hud-target]").forEach((button) => {
            const active = button.dataset.playerHudTarget === selectedId;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-selected", active ? "true" : "false");
            button.setAttribute("aria-current", active ? "page" : "false");
        });
    }

    function bindNavigation(hub, views) {
        const nav = hub.querySelector("[data-player-hud-nav]");
        if (!nav || nav.dataset.bound === "true") return;
        nav.dataset.bound = "true";

        nav.addEventListener("click", (event) => {
            const button = event.target.closest("[data-player-hud-target]");
            if (!button) return;
            activateSection(nav, views, button.dataset.playerHudTarget);
        });

        activateSection(nav, views, uiState().playerHudTab || SECTION_ORDER[0]);
    }

    function ensureBackpackTools(section) {
        let tools = section.querySelector("[data-player-backpack-tools]");
        if (!tools) {
            tools = document.createElement("div");
            tools.className = "player-backpack-tools";
            tools.dataset.playerBackpackTools = "";
            tools.innerHTML = `
                <label><span aria-hidden="true">⌕</span><input type="search" data-backpack-search placeholder="Buscar item" autocomplete="off" aria-label="Buscar item na mochila"></label>
                <select data-backpack-sort aria-label="Ordenar mochila">
                    <option value="recent">Mais recentes</option>
                    <option value="rarity">Raridade</option>
                    <option value="value">Maior valor</option>
                    <option value="name">Nome A–Z</option>
                </select>`;
            section.querySelector(".hero-hub__section-heading")?.insertAdjacentElement("afterend", tools);
        }
        const state = uiState();
        const search = tools.querySelector("[data-backpack-search]");
        const sort = tools.querySelector("[data-backpack-sort]");
        if (search && search.dataset.bound !== "true") {
            search.dataset.bound = "true";
            search.value = state.backpackSearch || "";
            search.addEventListener("input", () => {
                state.backpackSearch = search.value;
                renderBackpackGrid();
            });
        }
        if (sort && sort.dataset.bound !== "true") {
            sort.dataset.bound = "true";
            sort.value = state.backpackSort || "recent";
            sort.addEventListener("change", () => {
                state.backpackSort = sort.value;
                renderBackpackGrid();
            });
        }
        return tools;
    }

    function ensurePanelStructure() {
        const hub = document.querySelector("[data-hero-hub]");
        const views = hub?.querySelector(".hero-hub__views");
        if (!hub || !views) return false;

        hub.classList.add("hero-hub--cockpit");
        hub.classList.remove("hero-hub--classic");
        views.classList.add("player-hud-workspace");
        views.classList.remove("hero-hub__accordion");
        views.removeAttribute("style");

        const headerCopy = hub.querySelector(".hero-hub__header > div:first-child");
        if (headerCopy) headerCopy.innerHTML = `<small>PERSONAGEM E INVENTÁRIO</small><h2>Central do Herói</h2>`;
        hub.querySelector(".hero-hub__toggle-all")?.remove();
        hub.querySelector(".hero-hub__tabs")?.remove();

        let nav = hub.querySelector("[data-player-hud-nav]");
        if (nav?.querySelector("[data-player-hud-target='equipment']")) {
            nav.remove();
            nav = null;
        }
        if (!nav) {
            nav = document.createElement("nav");
            nav.className = "player-hud-nav";
            nav.dataset.playerHudNav = "";
            nav.setAttribute("aria-label", "Atalhos do painel do herói");
            nav.innerHTML = `
                <button type="button" class="is-active" data-player-hud-target="backpack"><span>▦</span><b>Itens</b><em data-player-bag-count>0</em></button>
                <button type="button" data-player-hud-target="skills"><span>↑</span><b>Skills</b><em data-player-skill-count>0</em></button>
                <button type="button" data-player-hud-target="overview"><span>✦</span><b>Build</b><em data-player-build-count>0</em></button>`;
            views.insertAdjacentElement("beforebegin", nav);
        }

        const fixedEquipment = hub.querySelector("[data-player-hud-fixed-equipment]")
            || views.querySelector("[data-hero-panel-view='equipment']");
        if (fixedEquipment) {
            fixedEquipment.remove();
        }

        SECTION_ORDER.forEach((id) => {
            const section = views.querySelector(`[data-hero-panel-view='${id}']`);
            if (!section) return;
            section.hidden = true;
            section.classList.remove("hero-hub__accordion-section", "is-collapsed");
            section.classList.add("player-hud-section", `player-hud-section--${id}`);
            section.removeAttribute("data-collapsed");
            section.style.removeProperty("display");
            section.style.removeProperty("height");
            section.style.removeProperty("min-height");
            section.style.removeProperty("max-height");
            [...section.children].forEach((child) => {
                child.hidden = false;
                child.removeAttribute("aria-hidden");
                child.style.removeProperty("display");
            });
            const heading = section.querySelector(".hero-hub__section-heading");
            if (heading) {
                if (id === "skills") {
                    heading.remove();
                } else {
                    heading.className = "hero-hub__section-heading player-hud-section__heading";
                    heading.innerHTML = sectionHeading(id);
                }
            }
            views.appendChild(section);
        });

        const backpack = views.querySelector("[data-hero-panel-view='backpack']");
        if (backpack) ensureBackpackTools(backpack);
        bindNavigation(hub, views);
        activateSection(nav, views, uiState().playerHudTab || SECTION_ORDER[0]);
        return true;
    }

    function itemPresentation(item) {
        const tooltip = Aethra.UIManager?.getItemTooltipData?.(item, { source: "player-hud" }) || {};
        const rarity = Aethra.GameData?.getRarityPresentation?.(item) || {
            id: String(item?.rarityId || item?.rarity || "common").toLowerCase(),
            name: item?.rarity || "Comum",
            color: "#738791"
        };
        const quantity = Math.max(1, Number(item?.quantity || 1));
        const unitValue = Math.max(0, Number(tooltip.resaleValue || item?.price || item?.value || 0));
        return { tooltip, rarity, quantity, unitValue, totalValue: unitValue * quantity };
    }

    function itemCategory(item) {
        const type = String(item?.itemType || item?.type || "MISC").toUpperCase();
        if (["WEAPON", "SHIELD", "OFFHAND", "HELMET", "HEAD", "ARMOR", "CHEST", "GLOVES", "HANDS", "LEGS", "PANTS", "BOOTS", "FEET", "AMULET", "NECK", "RING", "RELIC"].includes(type)) return "equipment";
        if (type === "CONSUMABLE") return "consumable";
        if (type === "MATERIAL" || item?.category === "resource") return "resource";
        return "loot";
    }

    function filteredBackpackItems() {
        const state = uiState();
        const bag = Array.isArray(Aethra.GameState.hero?.bag) ? [...Aethra.GameState.hero.bag] : [];
        const category = state.backpackFilter || "all";
        const query = normalize(state.backpackSearch || "");
        const filtered = bag.filter((item) => {
            if (category !== "all" && itemCategory(item) !== category) return false;
            if (!query) return true;
            const rarity = Aethra.GameData?.getRarityPresentation?.(item)?.name || item?.rarity || "";
            return normalize([item?.name, item?.templateId, item?.type, item?.itemType, rarity].join(" ")).includes(query);
        });
        const sort = state.backpackSort || "recent";
        if (sort === "name") filtered.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
        if (sort === "value") filtered.sort((a, b) => itemPresentation(b).totalValue - itemPresentation(a).totalValue);
        if (sort === "rarity") filtered.sort((a, b) => {
            const ar = itemPresentation(a).rarity.id || String(a.rarity || "common").toLowerCase();
            const br = itemPresentation(b).rarity.id || String(b.rarity || "common").toLowerCase();
            return Number(RARITY_ORDER[br] || 0) - Number(RARITY_ORDER[ar] || 0);
        });
        return { bag, filtered, category, query };
    }

    function openInventoryDetails(item, source) {
        if (item?.instanceId) Render.setSelectedInventoryItem?.(item.instanceId);
        Aethra.WindowManager?.openWindow?.("inventory-view", { source, instanceId: item?.instanceId || null });
        Render.renderInventory?.();
        if (item) Render.renderInventoryDetails?.(item);
    }

    function bindBackpackItem(button, item) {
        button.addEventListener("click", () => {
            Render.setSelectedInventoryItem?.(item.instanceId);
            renderBackpackGrid();
            Render.renderInventoryDetails?.(item);
        });
        button.addEventListener("dblclick", () => {
            if (String(item.itemType || item.type || "").toLowerCase() === "consumable") {
                Aethra.EventBus.emit("consumable:use-requested", {
                    instanceId: item.instanceId,
                    itemId: item.templateId || item.id,
                    source: "player-backpack"
                });
                return;
            }
            const slot = Aethra.EquipSystem?.getAllowedSlots?.(item)?.[0] || item.slot;
            if (slot && Aethra.EquipSystem?.canEquip?.(item, slot)) {
                Aethra.EquipSystem.equip(item.instanceId, slot);
            }
        });
        Aethra.UIManager?.bindItemTooltip?.(button, item, { source: "player-backpack" });
    }

    function renderBackpackGrid() {
        const container = document.getElementById("battle-inventory-grid");
        if (!container) return false;
        const { bag, filtered, category, query } = filteredBackpackItems();
        const explicitCapacity = Number(Aethra.GameState.hero?.bagCapacity || 0);
        const visualSlots = Math.max(18, Math.ceil(Math.max(filtered.length, 1) / 6) * 6);
        const selectedId = Render.getSelectedInventoryItemId?.();
        const totalValue = bag.reduce((total, item) => total + itemPresentation(item).totalValue, 0);

        const count = document.getElementById("battle-inventory-count");
        if (count) count.textContent = explicitCapacity > 0 ? `${bag.length} / ${Math.max(explicitCapacity, bag.length)}` : `${bag.length} itens · ${fmt(totalValue)} G`;
        const legacyCount = document.getElementById("hero-backpack-tab-count");
        if (legacyCount) legacyCount.textContent = String(bag.length);
        document.querySelectorAll("[data-player-bag-count]").forEach((node) => { node.textContent = String(bag.length); });

        container.className = "hero-backpack-grid tibia-backpack-grid player-backpack-grid";
        container.replaceChildren();

        if (filtered.length === 0 && (bag.length === 0 || query || category !== "all")) {
            const emptyBag = bag.length === 0;
            container.innerHTML = `<div class="player-backpack-empty"><span>${emptyBag ? "▦" : "⌕"}</span><strong>${emptyBag ? "Mochila vazia" : "Nenhum item encontrado"}</strong><small>${emptyBag ? "Loot, supplies e materiais aparecerão aqui." : "Tente outro nome ou categoria."}</small></div>`;
        } else {
            const fragment = document.createDocumentFragment();
            for (let index = 0; index < visualSlots; index += 1) {
                const item = filtered[index] || null;
                const button = document.createElement("button");
                button.type = "button";
                button.className = `tibia-backpack-slot player-backpack-slot ${item ? "is-filled" : "is-empty"} ${item?.instanceId === selectedId ? "is-selected" : ""}`;
                button.dataset.slotIndex = String(index + 1);
                if (!item) {
                    button.disabled = true;
                    button.innerHTML = `<span class="tibia-backpack-slot__index">${index + 1}</span>`;
                } else {
                    const image = Aethra.GameData?.getItemImage?.(item) || "";
                    const { rarity, quantity, totalValue: stackValue } = itemPresentation(item);
                    const compactValue = stackValue >= 1000000 ? `${(stackValue / 1000000).toFixed(1)}M` : stackValue >= 1000 ? `${(stackValue / 1000).toFixed(1)}K` : fmt(stackValue);
                    const fallback = esc((item.icon && String(item.icon).trim()) || String(item.name || "?").charAt(0).toUpperCase());
                    button.dataset.instanceId = item.instanceId || "";
                    button.style.setProperty("--slot-rarity", rarity.color || "#738791");
                    button.setAttribute("aria-label", `${item.name || "Item"}, ${rarity.name || "Comum"}, quantidade ${quantity}`);
                    button.innerHTML = `
                        <span class="tibia-backpack-slot__index">${index + 1}</span>
                        <span class="tibia-backpack-slot__icon"><b aria-hidden="true">${fallback}</b>${image ? `<img src="${esc(image)}" alt="" draggable="false" onerror="this.style.display='none'">` : ""}</span>
                        <span class="tibia-backpack-slot__rarity-dot" aria-hidden="true"></span>
                        ${quantity > 1 ? `<strong class="tibia-backpack-slot__quantity">${fmt(quantity)}</strong>` : ""}
                        ${stackValue > 0 ? `<em class="tibia-backpack-slot__value">${compactValue} G</em>` : ""}`;
                    bindBackpackItem(button, item);
                }
                fragment.appendChild(button);
            }
            container.appendChild(fragment);
        }

        const selected = bag.find((item) => item.instanceId === selectedId) || null;
        const selectedRoot = document.getElementById("battle-inventory-selected");
        if (selectedRoot) {
            if (selected) {
                const { rarity, quantity, totalValue: stackValue } = itemPresentation(selected);
                selectedRoot.style.setProperty("--battle-item-color", rarity.color || "#7bbddd");
                selectedRoot.innerHTML = `<span><b>${esc(selected.name || "Item")}</b><small>${esc(rarity.name || "Comum")} · x${fmt(quantity)} · ${fmt(stackValue)} G</small></span><button type="button" data-player-item-details>Detalhes</button>`;
                selectedRoot.querySelector("[data-player-item-details]")?.addEventListener("click", () => openInventoryDetails(selected, "player-hud-selection"));
            } else {
                selectedRoot.innerHTML = `<span><b>Inspecione sua mochila</b><small>Hover: ficha completa · clique: selecionar · duplo clique: equipar</small></span>`;
            }
        }
        Aethra.TooltipManager?.refresh?.();
        return true;
    }

    function renderEquipmentMatrix() {
        const container = document.getElementById("battle-equipment-summary");
        if (!container) return false;
        const equipment = Aethra.GameState.playerEquipment || Aethra.GameState.hero?.equipment || {};
        const equipped = SLOT_DEFINITIONS.filter((slot) => equipment[slot.id]);

        container.className = "hero-paperdoll player-equipment-matrix player-equipment-matrix--persistent";
        container.innerHTML = SLOT_DEFINITIONS.map((slot) => {
            const item = equipment[slot.id] || null;
            const image = item ? Aethra.GameData?.getItemImage?.(item) : "";
            const rarity = item ? Aethra.GameData?.getRarityPresentation?.(item) : null;
            const fallback = esc((item?.icon && String(item.icon).trim()) || slot.icon);
            return `
                <button type="button" class="hero-paperdoll__slot player-equipment-slot player-equipment-slot--${slot.id} ${item ? "is-filled" : "is-empty"}"
                    data-battle-equipment-slot="${slot.id}" style="--slot-rarity:${esc(rarity?.color || "#415661")};"
                    aria-label="${esc(item?.name || `${slot.label} vazio`)}"
                    ${item ? "" : `data-ui-tooltip data-tooltip-kind="hud" data-tooltip-title="${esc(slot.label)}" data-tooltip-value="Vazio" data-tooltip-body="Clique para abrir a mochila e equipar este slot."`}>
                    <span class="hero-paperdoll__slot-icon"><b aria-hidden="true">${fallback}</b>${image ? `<img src="${esc(image)}" alt="" draggable="false">` : ""}</span>
                    <span class="player-equipment-slot__copy"><small>${slot.label}</small><strong>${esc(item?.name || "Vazio")}</strong></span>
                    ${item ? `<i class="player-equipment-slot__rarity"></i>` : ""}
                </button>`;
        }).join("");

        container.querySelectorAll("[data-battle-equipment-slot]").forEach((button) => {
            const slot = button.dataset.battleEquipmentSlot;
            const item = equipment[slot] || null;
            let clickTimer = null;
            button.addEventListener("click", (event) => {
                if (!item) {
                    openInventoryDetails(null, "player-hud-empty-slot");
                    return;
                }
                if (event.detail > 1) return;
                clearTimeout(clickTimer);
                clickTimer = setTimeout(() => openInventoryDetails(item, "player-hud-equipment"), 180);
            });
            button.addEventListener("dblclick", () => {
                clearTimeout(clickTimer);
                if (item) Aethra.EquipSystem?.unequip?.(slot);
            });
            if (item) Aethra.UIManager?.bindItemTooltip?.(button, item, { source: "player-equipment", slot });
        });

        const count = `${equipped.length}/${SLOT_DEFINITIONS.length}`;
        const legacyCount = document.getElementById("hero-equipment-tab-count");
        if (legacyCount) legacyCount.textContent = count;
        document.querySelectorAll("[data-player-gear-count]").forEach((node) => { node.textContent = count; });
        document.querySelectorAll("[data-player-fixed-equipment-count]").forEach((node) => {
            node.textContent = `${count} slots ativos`;
        });

        const inspections = equipped.map((slot) => Aethra.ItemSystem?.getItemInspection?.(equipment[slot.id])).filter(Boolean);
        const averageIv = inspections.length ? inspections.reduce((sum, entry) => sum + Number(entry.ivPercent || 0), 0) / inspections.length : 0;
        const highestMultiplier = inspections.length ? Math.max(...inspections.map((entry) => Number(entry.multiplier || 1))) : 1;
        const build = document.getElementById("hero-build-summary");
        if (build) build.innerHTML = `
            <span><small>Equipado</small><strong>${count}</strong></span>
            <span><small>IV médio</small><strong>${averageIv.toFixed(0)}%</strong></span>
            <span><small>Maior item</small><strong>${highestMultiplier.toFixed(2)}x</strong></span>
            <span><small>Interação</small><strong>Hover / 2x</strong></span>`;
        Aethra.TooltipManager?.refresh?.();
        return true;
    }

    function skillGroupLabel(category) {
        const labels = {
            Armas: ["⚔", "Armas"],
            Arcana: ["✦", "Escolas arcanas"],
            Defesa: ["⬡", "Defesa"],
            Combate: ["⚔", "Combate"],
            Coleta: ["⛏", "Coleta"],
            Mundo: ["⌖", "Mundo & exploração"],
            Criação: ["⚒", "Criação"],
            Craft: ["⚒", "Criação"],
            Utilidade: ["✦", "Utilidade"]
        };
        return labels[category] || ["•", category || "Outras"];
    }

    function overviewSignature() {
        const hero = Aethra.GameState.hero || {};
        const stats = hero.stats || {};
        return [
            hero.level,
            stats.str,
            stats.mag,
            stats.precision,
            stats.defense,
            stats.critical,
            stats.criticalMultiplier,
            stats.evasion,
            stats.damageMin,
            stats.damageMax
        ].map((value) => Number(value || 0)).join("|");
    }

    function markOverviewRendered() {
        const container = document.getElementById("hero-attributes-grid");
        if (!container) return false;
        const cards = container.querySelectorAll(".hero-attribute");
        if (cards.length >= 6) container.dataset.playerOverviewSignature = overviewSignature();
        document.querySelectorAll("[data-player-build-count]").forEach((node) => {
            node.textContent = String(cards.length);
        });
        return cards.length >= 6;
    }

    function renderOverview() {
        const container = document.getElementById("hero-attributes-grid");
        if (!container) return false;
        const stale = container.dataset.playerOverviewSignature !== overviewSignature();
        if (container.querySelectorAll(".hero-attribute").length < 6 || stale) {
            Render.renderHeroStats?.();
        }
        return markOverviewRendered();
    }

    function bindSkillSearch(container) {
        const input = container.querySelector("[data-player-skill-search]");
        if (!input) return;
        const apply = () => {
            const query = normalize(input.value);
            uiState().skillSearch = input.value;
            container.querySelectorAll(".player-skill-entry").forEach((entry) => {
                entry.hidden = Boolean(query) && !normalize(entry.dataset.search).includes(query);
            });
            container.querySelectorAll(".player-skill-group").forEach((group) => {
                group.hidden = ![...group.querySelectorAll(".player-skill-entry")].some((entry) => !entry.hidden);
            });
        };
        input.addEventListener("input", apply);
        apply();
    }

    function renderCategorizedSkills() {
        const container = document.getElementById("hero-skill-progression");
        if (!container) return false;
        const disciplineSnapshot = Aethra.DisciplineSystem?.getSnapshot?.();
        const masteries = disciplineSnapshot
            ? Object.values(disciplineSnapshot)
            : (Render.getMasteryCards?.() || []);

        const state = uiState();
        state.minimizedSkills = state.minimizedSkills || {};
        const activeCategory = state.selectedSkillCategory || "all";
        const searchQuery = normalize(state.skillSearch || "");

        const categories = ["all", "Armas", "Arcana", "Defesa", "Coleta", "Criação", "Mundo"];
        const categoryLabels = {
            all: "Todas",
            Armas: "⚔ Armas",
            Arcana: "✦ Arcana",
            Defesa: "🛡 Defesa",
            Coleta: "⛏ Coleta",
            Criação: "⚒ Criação",
            Mundo: "⌖ Mundo"
        };

        const filteredMasteries = masteries.filter((entry) => {
            const cat = entry.category || "Outras";
            if (activeCategory !== "all" && cat !== activeCategory && (activeCategory !== "Criação" || (cat !== "Criação" && cat !== "Craft"))) return false;
            if (!searchQuery) return true;
            return normalize(`${entry.name} ${cat} ${entry.description || ""}`).includes(searchQuery);
        });

        // Ordenação Inteligente:
        // 1. Skills Expandidas (Pinned / Foco) ficam SEMPRE NO TOPO!
        // 2. Dentro de cada grupo, ordena por Modo de Treino (Ativo > Travado) e Nível/XP
        filteredMasteries.sort((a, b) => {
            const aId = String(a.id || a.name || "");
            const bId = String(b.id || b.name || "");
            const aMinimized = state.minimizedSkills[aId] === true;
            const bMinimized = state.minimizedSkills[bId] === true;

            if (aMinimized !== bMinimized) {
                return aMinimized ? 1 : -1;
            }

            const aTraining = a.trainingMode !== "locked" ? 1 : 0;
            const bTraining = b.trainingMode !== "locked" ? 1 : 0;
            if (aTraining !== bTraining) {
                return bTraining - aTraining;
            }

            const aLevel = Number(a.level || 1);
            const bLevel = Number(b.level || 1);
            if (aLevel !== bLevel) {
                return bLevel - aLevel;
            }

            return Number(b.xpTotal || 0) - Number(a.xpTotal || 0);
        });

        const cardsHTML = filteredMasteries.map((entry, index) => {
            const current = Number(entry.xpCurrent ?? entry.xp ?? 0);
            const next = Math.max(1, Number(entry.xpNext || 1));
            const progress = clamp(entry.progressPercent ?? (current / next) * 100);
            const entryId = String(entry.id || entry.name || `skill-${index}`);
            const benefit = entry.benefit || entry.nextBenefit || "Ganha bônus no próximo nível.";
            const nextBenefit = entry.nextBenefit || "Ganha maior eficiência no próximo nível.";
            const profession = Aethra.ProfessionSystem?.professions?.[entryId] || null;
            const isGathering = profession?.policy === true;
            const policyEnabled = isGathering && Aethra.ProfessionSystem?.getPolicy?.(entryId)?.enabled === true;
            const isCrafting = ["blacksmithing", "leatherworking"].includes(entryId);
            const trainingLocked = entry.trainingMode === "locked";
            const [icon, categoryLabel] = skillGroupLabel(entry.category);

            const isExplicitlyMinimized = state.minimizedSkills[entryId] === true;
            const isMinimized = isExplicitlyMinimized;

            return `
                <article class="player-skill-card-slim ${isMinimized ? "is-minimized" : "is-expanded"} ${trainingLocked ? "is-locked" : ""}" data-skill-id="${esc(entryId)}"
                    data-ui-tooltip data-tooltip-kind="hud"
                    data-tooltip-eyebrow="${esc(categoryLabel.toUpperCase())}"
                    data-tooltip-title="${esc(entry.name)} (Nível ${fmt(entry.level)})"
                    data-tooltip-value="${fmt(current)} / ${fmt(next)} XP (${progress.toFixed(0)}%)"
                    data-tooltip-body="${esc(entry.description || "Evolui automaticamente ao praticar esta disciplina.")}"
                    data-tooltip-effect="✦ Efeito Atual: ${esc(benefit)}"
                    data-tooltip-hint="✦ Próximo Nível: ${esc(nextBenefit)}">

                    <button type="button" class="player-skill-pin-btn ${isMinimized ? "" : "is-pinned"}"
                        data-toggle-skill-pin="${esc(entryId)}"
                        data-ui-tooltip data-tooltip-kind="hud" data-tooltip-title="${isMinimized ? "Fixar no Topo & Expandir" : "Minimizar & Mover pro Rodapé"}"
                        data-tooltip-body="${isMinimized ? "Clique para fixar no topo e acompanhar a barra de XP." : "Clique para minimizar e mover para baixo."}">
                        ${isMinimized ? "📌" : "📍"}
                    </button>

                    <span class="player-skill-card-slim__icon">${esc(entry.icon || icon || "⚔")}</span>

                    <div class="player-skill-card-slim__main">
                        <div class="player-skill-card-slim__title">
                            <strong>${esc(entry.name)}</strong>
                            <small>Lv. <b>${fmt(entry.level)}</b></small>
                        </div>
                        ${!isMinimized ? `
                            <div class="player-skill-card-slim__bar">
                                <b style="width: ${progress.toFixed(1)}%"></b>
                            </div>
                            <div class="player-skill-card-slim__meta">
                                <span>${esc(entry.category || "Maestria")}</span>
                                <em>${fmt(current)} / ${fmt(next)} XP (${progress.toFixed(0)}%)</em>
                            </div>` : ""}
                    </div>

                    <div class="player-skill-card-slim__actions">
                        <button type="button" class="player-skill-card__btn ${trainingLocked ? "btn--locked" : "btn--training"}"
                            data-skill-training-mode="${esc(entryId)}" data-next-mode="${trainingLocked ? "training" : "locked"}">
                            ${trainingLocked ? "🔒 Travado" : "◆ Treinando"}
                        </button>
                        ${!isMinimized && isGathering ? `
                            <button type="button" class="player-skill-card__btn ${policyEnabled ? "btn--active" : "btn--inactive"}"
                                data-profession-policy="${esc(entryId)}" data-policy-enabled="${policyEnabled ? "false" : "true"}">
                                ${policyEnabled ? "✓ Coletar" : "○ Ignorar"}
                            </button>` : ""}
                        ${!isMinimized && isCrafting ? `
                            <button type="button" class="player-skill-card__btn btn--workshop" data-open-profession-workshop="${esc(entryId)}">
                                ⚒ Oficina
                            </button>` : ""}
                    </div>
                </article>`;
        }).join("");

        container.className = "hero-skill-progression player-skill-workspace--v3";
        container.innerHTML = `
            <div class="player-skill-controls-row">
                <select class="player-skill-category-select" data-skill-category-select aria-label="Filtrar por categoria de habilidade">
                    ${categories.map((cat) => {
                        const count = cat === "all" ? masteries.length : masteries.filter((m) => m.category === cat || (cat === "Criação" && m.category === "Craft")).length;
                        if (cat !== "all" && count === 0) return "";
                        const selected = activeCategory === cat;
                        return `<option value="${esc(cat)}" ${selected ? "selected" : ""}>${categoryLabels[cat] || cat} (${count})</option>`;
                    }).join("")}
                </select>

                <button type="button" class="player-skill-toggle-all-btn" data-toggle-all-skill-pins
                    data-ui-tooltip data-tooltip-kind="hud" data-tooltip-title="Alternar Visão de Skills" data-tooltip-body="Minimiza todas as skills inativas para focar apenas nas habilidades que está evoluindo.">
                    📌 Visão Foco
                </button>

                <label class="player-skill-search">
                    <span aria-hidden="true">⌕</span>
                    <input type="search" data-player-skill-search value="${esc(state.skillSearch || "")}" placeholder="Buscar skill..." aria-label="Buscar habilidades">
                </label>
            </div>

            <div class="player-skill-grid-slim">
                ${cardsHTML || `<div class="player-skill-empty">Nenhuma habilidade encontrada.</div>`}
            </div>`;

        const select = container.querySelector("[data-skill-category-select]");
        if (select) {
            select.addEventListener("change", () => {
                state.selectedSkillCategory = select.value;
                renderCategorizedSkills();
            });
        }

        container.querySelectorAll("[data-toggle-skill-pin]").forEach((btn) => {
            btn.addEventListener("click", (ev) => {
                ev.stopPropagation();
                const skillId = btn.dataset.toggleSkillPin;
                state.minimizedSkills[skillId] = !state.minimizedSkills[skillId];
                renderCategorizedSkills();
            });
        });

        const toggleAllBtn = container.querySelector("[data-toggle-all-skill-pins]");
        if (toggleAllBtn) {
            toggleAllBtn.addEventListener("click", () => {
                const anyExpanded = masteries.some((m) => !state.minimizedSkills[m.id]);
                masteries.forEach((m) => {
                    state.minimizedSkills[m.id] = anyExpanded;
                });
                renderCategorizedSkills();
            });
        }

        container.querySelectorAll("[data-skill-training-mode]").forEach((button) => {
            button.addEventListener("click", () => {
                Aethra.DisciplineSystem?.setTrainingMode?.(button.dataset.skillTrainingMode, button.dataset.nextMode, "hero-skills");
                renderCategorizedSkills();
            });
        });

        // Event listeners para política de coleta
        container.querySelectorAll("[data-profession-policy]").forEach((button) => {
            button.addEventListener("click", () => {
                Aethra.ProfessionSystem?.setCollectionPolicy?.(button.dataset.professionPolicy, button.dataset.policyEnabled === "true", "hero-skills");
                renderCategorizedSkills();
            });
        });

        bindSkillSearch(container);

        const legacyCount = document.getElementById("hero-skills-tab-count");
        if (legacyCount) legacyCount.textContent = String(masteries.length);
        document.querySelectorAll("[data-player-skill-count]").forEach((node) => { node.textContent = String(masteries.length); });
        Aethra.TooltipManager?.refresh?.();
        return true;
    }

    function refresh() {
        if (!ensurePanelStructure()) return false;
        renderSummary();
        renderOverview();
        renderEquipmentMatrix();
        renderBackpackGrid();
        renderCategorizedSkills();
        return true;
    }

    function wrap(name, after) {
        if (typeof Render[name] !== "function") return;
        const original = Render[name].bind(Render);
        Render[name] = function (...args) {
            const result = original(...args);
            ensurePanelStructure();
            after?.();
            return result;
        };
    }

    wrap("activateBattleMode", () => renderSummary());
    wrap("renderHeroStats", () => {
        renderSummary();
        markOverviewRendered();
    });
    wrap("renderBattleEquipment", () => renderEquipmentMatrix());
    wrap("renderBattleInventory", () => renderBackpackGrid());
    wrap("renderHeroSkillProgression", () => renderCategorizedSkills());
    wrap("renderAll", () => refresh());

    Aethra.PlayerHudWorkspace = {
        refresh,
        ensurePanelStructure,
        renderSummary,
        renderOverview,
        renderEquipment: renderEquipmentMatrix,
        renderBackpack: renderBackpackGrid,
        renderSkills: renderCategorizedSkills,
        slots: SLOT_DEFINITIONS.map((slot) => slot.id)
    };

    ["HealthChanged", "ManaChanged", "EnergyChanged", "resourceChanged", "hero:level-changed", "hunt:started", "hunt:stopped", "hunt:updated", "coliseum:rank-updated", "coliseum:match-resolved"].forEach((eventName) => {
        Aethra.EventBus.on(eventName, renderSummary);
    });
    ["itemEquipped", "itemUnequipped", "equipment:changed"].forEach((eventName) => {
        Aethra.EventBus.on(eventName, () => {
            ensurePanelStructure();
            renderEquipmentMatrix();
            renderBackpackGrid();
            renderOverview();
        });
    });
    ["skillXPChanged", "profession:xpChanged", "profession:rankUp", "mastery:updated", "levelUp", "skill-point:spent", "discipline:xp-changed", "discipline:level-up", "discipline:invested", "skill:discovered", "skill:training-mode-changed", "profession:policy-changed", "crafting:completed"].forEach((eventName) => {
        Aethra.EventBus.on(eventName, () => {
            ensurePanelStructure();
            renderCategorizedSkills();
            renderOverview();
        });
    });

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
    else refresh();
})(window.Aethra);
