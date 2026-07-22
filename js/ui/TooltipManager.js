// TooltipManager.js - Tooltips modernos e não bloqueantes da interface Aethra.
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState) {
        throw new Error(
            "TooltipManager.js requer game-core.js carregado antes deste arquivo."
        );
    }

    function escapeHTML(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function number(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("pt-BR", {
            maximumFractionDigits: 1
        }).format(number(value, 0));
    }

    function getSkillCost(skill) {
        const cost = skill?.cost || {};
        return {
            resource: String(
                cost.resource || cost.type || "mana"
            ).toLowerCase(),
            amount: Math.max(
                0,
                number(
                    skill?.manaCost ?? cost.amount ?? cost.value,
                    0
                )
            )
        };
    }

    function getCooldownSeconds(skill) {
        const raw = Math.max(0, number(skill?.cooldown, 0));
        return raw > 60 ? raw / 1000 : raw;
    }

    function getSkillType(skill) {
        const type = String(
            skill?.type || skill?.effect?.type || "utility"
        ).toLowerCase();

        if (["damage", "attack", "offensive"].includes(type)) {
            return "Ofensivo";
        }

        if (["heal", "support", "buff", "shield", "guard"].includes(type)) {
            return "Suporte";
        }

        return "Utilidade";
    }

    function getSkillPower(skill) {
        const effect = skill?.effect || {};
        const type = String(
            skill?.type || effect.type || "utility"
        ).toLowerCase();

        if (type === "heal") {
            const base = Math.max(
                0,
                number(
                    effect.baseAmount ?? effect.heal ?? skill.healAmount,
                    0
                )
            );
            const scaling = Math.max(0, number(effect.magicScaling, 0));
            const percentHeal = Math.max(
                0,
                number(effect.percent ?? effect.healPercent ?? skill.healPercent, 0)
            );
            const magic = Math.max(
                0,
                number(Aethra.GameState.hero?.stats?.mag, 0)
            );
            const maxHp = Math.max(
                1,
                number(
                    Aethra.GameState.hero?.maxHp ??
                    Aethra.GameState.hero?.stats?.maxHp,
                    1
                )
            );
            const estimated = Math.round(
                base +
                magic * scaling +
                maxHp * (percentHeal > 1 ? percentHeal / 100 : percentHeal)
            );

            return {
                label: percentHeal > 0 ? "Cura estimada" : "Cura base estimada",
                value: `${formatNumber(estimated)} HP`,
                formula: [
                    base > 0 ? `${formatNumber(base)} base` : "",
                    scaling > 0 ? `${formatNumber(scaling)}× MAG` : "",
                    percentHeal > 0
                        ? `${formatNumber(percentHeal > 1 ? percentHeal : percentHeal * 100)}% HP máx.`
                        : ""
                ].filter(Boolean).join(" + ")
            };
        }

        if (["buff", "shield", "support"].includes(type)) {
            const stat = effect.stat || "atributo";
            const amount = number(effect.amount, 0);
            const durationMs = Math.max(0, number(effect.duration, 0));
            return {
                label: "Bônus aplicado",
                value: `+${formatNumber(amount)} ${String(stat).toUpperCase()}`,
                formula: durationMs > 0
                    ? `Duração: ${(durationMs / 1000).toFixed(1)}s`
                    : "Efeito imediato"
            };
        }

        const directDamage = number(
            effect.baseDamage ?? effect.damage ?? skill?.baseDamage,
            NaN
        );

        if (Number.isFinite(directDamage)) {
            return {
                label: "Dano base estimado",
                value: formatNumber(directDamage),
                formula: "Antes de crítico e defesa do alvo"
            };
        }

        const multiplier = Math.max(0, number(effect.damageMultiplier, 1));
        const profile = Aethra.BattleSystem?.getWeaponDamageProfile?.();

        if (profile) {
            const minimum = Math.max(0, Math.round(number(profile.baseMin, 0) * multiplier));
            const maximum = Math.max(minimum, Math.round(number(profile.baseMax, minimum) * multiplier));
            return {
                label: "Dano estimado",
                value: `${formatNumber(minimum)}–${formatNumber(maximum)}`,
                formula: `Dano da arma × ${multiplier.toFixed(2)}x`
            };
        }

        return {
            label: "Potência",
            value: `${multiplier.toFixed(2)}x do dano da arma`,
            formula: "Antes de crítico e defesa do alvo"
        };
    }

    Aethra.TooltipManager = {
        initialized: false,
        tooltip: null,
        activeTrigger: null,
        lastPointer: { x: 0, y: 0 },

        init() {
            if (this.initialized) return this.ensureTooltip();

            this.ensureTooltip();
            this.bindGlobalEvents();
            this.initialized = true;

            Aethra.EventBus?.emit?.("tooltip:ready", {
                id: this.tooltip?.id || null
            });

            return this.tooltip;
        },

        ensureTooltip() {
            // O tooltip vive diretamente no body para não ser recortado por
            // overflow/transform das camadas de HUD e janelas flutuantes.
            const host = document.body;
            const existing = document.getElementById("aethra-ui-tooltip");

            if (existing) {
                if (existing.parentElement !== host) {
                    host.appendChild(existing);
                }
                this.tooltip = existing;
                return existing;
            }

            const tooltip = document.createElement("div");
            tooltip.id = "aethra-ui-tooltip";
            tooltip.className = "aethra-ui-tooltip";
            tooltip.setAttribute("role", "tooltip");
            tooltip.hidden = true;
            host.appendChild(tooltip);
            this.tooltip = tooltip;
            return tooltip;
        },

        bindGlobalEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;

            const resolveTrigger = (target) => {
                return target?.closest?.("[data-ui-tooltip]") || null;
            };

            const enter = (event) => {
                const trigger = resolveTrigger(event.target);
                if (!trigger) return;
                this.show(trigger, event);
            };

            const leave = (event) => {
                if (!this.activeTrigger) return;
                const trigger = resolveTrigger(event.target);
                if (trigger !== this.activeTrigger) return;

                const related = event.relatedTarget;
                if (related && this.activeTrigger.contains(related)) {
                    return;
                }

                this.hide();
            };

            // Captura pointerenter/mouseenter para funcionar também em cards
            // reconstruídos dinamicamente pelo RenderEngine.
            document.addEventListener("pointerenter", enter, true);
            document.addEventListener("mouseenter", enter, true);
            document.addEventListener("pointerleave", leave, true);
            document.addEventListener("mouseleave", leave, true);

            document.addEventListener("pointermove", (event) => {
                this.lastPointer = {
                    x: event.clientX,
                    y: event.clientY
                };

                if (this.activeTrigger) {
                    this.position(event);
                }
            });

            document.addEventListener("focusin", (event) => {
                const trigger = resolveTrigger(event.target);
                if (!trigger) return;
                this.show(trigger);
            });

            document.addEventListener("focusout", (event) => {
                const trigger = resolveTrigger(event.target);
                if (trigger === this.activeTrigger) {
                    this.hide();
                }
            });

            document.addEventListener("keydown", (event) => {
                if (event.key === "Escape") this.hide();
            });

            window.addEventListener("blur", () => this.hide());
            window.addEventListener("resize", () => {
                if (this.activeTrigger) this.position();
            });
        },

        buildSkillHTML(skillId) {
            const skill = Aethra.SkillSystem?.getSkill?.(skillId);
            if (!skill) return "";

            const cost = getSkillCost(skill);
            const power = getSkillPower(skill);
            const cooldown = getCooldownSeconds(skill);
            const cooldownRounds = Aethra.SkillSystem?.getCooldownRounds?.(skill) || 0;
            const type = getSkillType(skill);
            const resourceLabel = cost.resource === "energy"
                ? "Vigor"
                : cost.resource === "mana"
                    ? "Mana"
                    : cost.resource;
            const readyAt = number(
                Aethra.GameState.hero?.cooldowns?.[skillId],
                0
            );
            const remaining = Math.max(0, readyAt - Date.now()) / 1000;
            const remainingRounds = Aethra.GameState.battle?.isFighting
                ? Aethra.SkillSystem?.getCooldownRoundsRemaining?.(skillId) || 0
                : 0;
            const settings = Aethra.SkillController?.getSettings?.() || {};
            const autoEnabled = settings[skillId]?.auto === true;
            const isCreating = document.body.classList.contains("is-creating-character");
            const priorityTitle = isCreating ? "Técnica da Origem" : "Ordem da ActionBar";
            const priorityLabel = isCreating
                ? "Disponível ao Iniciar"
                : (priorityIndex >= 0 ? `Prioridade ${priorityIndex + 1}` : "Fora da prioridade");

            return `
                <article class="aethra-ui-tooltip__skill">
                    <header>
                        <span class="aethra-ui-tooltip__icon" data-skill-id="${escapeHTML(skillId)}">${escapeHTML(skill.icon || "✦")}</span>
                        <div>
                            <small>HABILIDADE</small>
                            <strong>${escapeHTML(skill.name || skillId)}</strong>
                        </div>
                        <span class="aethra-ui-tooltip__type is-${type.toLowerCase()}">${escapeHTML(type)}</span>
                    </header>

                    <p>${escapeHTML(skill.description || "Habilidade configurada na ActionBar.")}</p>

                    <div class="aethra-ui-tooltip__metrics">
                        <div class="is-power">
                            <small>${escapeHTML(power.label)}</small>
                            <b>${escapeHTML(power.value)}</b>
                        </div>
                        <div>
                            <small>Custo de recurso</small>
                            <b>${cost.amount > 0
                                ? `${formatNumber(cost.amount)} ${escapeHTML(resourceLabel)}`
                                : "Sem custo"}</b>
                        </div>
                        <div>
                            <small>Cooldown (CD)</small>
                            <b>${cooldownRounds > 0
                                ? `${cooldownRounds} rodada${cooldownRounds === 1 ? "" : "s"}`
                                : cooldown > 0
                                ? `${cooldown.toFixed(cooldown % 1 === 0 ? 0 : 1)}s`
                                : "Sem recarga"}</b>
                        </div>
                        <div>
                            <small>Disponibilidade</small>
                            <b>${remainingRounds > 0
                                ? `Pronta em ${remainingRounds} rodada${remainingRounds === 1 ? "" : "s"}`
                                : remaining > 0
                                ? `Pronta em ${remaining.toFixed(1)}s`
                                : "Pronta para usar"}</b>
                        </div>
                        <div>
                            <small>Modo de execução</small>
                            <b>${autoEnabled ? "Automático ligado" : "Manual"}</b>
                        </div>
                        <div>
                            <small>${escapeHTML(priorityTitle)}</small>
                            <b>${escapeHTML(priorityLabel)}</b>
                        </div>
                    </div>

                    ${power.formula ? `
                        <footer class="aethra-ui-tooltip__skill-formula">
                            ${escapeHTML(power.formula)}
                        </footer>
                    ` : ""}
                </article>
            `;
        },

        buildStatHTML(trigger) {
            const title = trigger.dataset.tooltipTitle || "Atributo";
            const body = trigger.dataset.tooltipBody || "";
            const value = trigger.dataset.tooltipValue || "";
            const effect = trigger.dataset.tooltipEffect || "";
            const formula = trigger.dataset.tooltipFormula || "";

            return `
                <article class="aethra-ui-tooltip__stat">
                    <small>STATUS DO HERÓI</small>
                    <header>
                        <strong>${escapeHTML(title)}</strong>
                        ${value ? `<b>${escapeHTML(value)}</b>` : ""}
                    </header>
                    <p>${escapeHTML(body)}</p>
                    ${effect ? `
                        <div class="aethra-ui-tooltip__impact">
                            <small>IMPACTO ATUAL</small>
                            <strong>${escapeHTML(effect)}</strong>
                        </div>
                    ` : ""}
                    ${formula ? `
                        <code class="aethra-ui-tooltip__formula">${escapeHTML(formula)}</code>
                    ` : ""}
                </article>
            `;
        },

        buildHudHTML(trigger) {
            const eyebrow = trigger.dataset.tooltipEyebrow || "INFORMAÇÃO DA HUD";
            const title = trigger.dataset.tooltipTitle || "Informação";
            const value = trigger.dataset.tooltipValue || "";
            const body = trigger.dataset.tooltipBody || "";
            const effect = trigger.dataset.tooltipEffect || "";
            const formula = trigger.dataset.tooltipFormula || "";
            const hint = trigger.dataset.tooltipHint || "";
            const isHtml = trigger.dataset.tooltipHtml === "true";

            const esc = isHtml ? (x) => x : escapeHTML;

            return `
                <article class="aethra-ui-tooltip__hud">
                    <small>${escapeHTML(eyebrow)}</small>
                    <header>
                        <strong>${escapeHTML(title)}</strong>
                        ${value ? `<b>${esc(value)}</b>` : ""}
                    </header>
                    ${body ? `<div class="aethra-ui-tooltip__body">${esc(body)}</div>` : ""}
                    ${effect ? `
                        <div class="aethra-ui-tooltip__impact">
                            <small>RESULTADO ATUAL</small>
                            <strong>${esc(effect)}</strong>
                        </div>
                    ` : ""}
                    ${formula ? `<code class="aethra-ui-tooltip__formula">${esc(formula)}</code>` : ""}
                    ${hint ? `<footer>${esc(hint)}</footer>` : ""}
                </article>
            `;
        },

        getItem(itemId) {
            if (!itemId) return null;
            const equipment = Aethra.GameState.hero?.equipment || {};
            const eqItem = Object.values(equipment).find(it => it && it.id === itemId);
            if (eqItem) return eqItem;

            const inventory = Aethra.GameState.hero?.inventory || [];
            const invItem = inventory.find(it => it && it.id === itemId);
            if (invItem) return invItem;

            return Aethra.GameData?.items?.[itemId] || null;
        },

        buildItemHTML(itemId) {
            const item = this.getItem(itemId);
            if (!item) return `
                <article class="aethra-ui-tooltip__text">
                    <strong>Item Desconhecido</strong>
                    <p>ID do item não encontrado: ${escapeHTML(itemId)}</p>
                </article>
            `;

            const rarityInfo = Aethra.GameData?.itemGeneration?.getRarity?.(item.rarity) || {
                name: item.rarity || "Comum",
                color: "#c7c7c7"
            };

            const slotNames = {
                weapon: "Mão Principal",
                shield: "Mão Secundária",
                offhand: "Mão Secundária",
                head: "Cabeça",
                chest: "Peitoral",
                legs: "Pernas",
                feet: "Botas",
                neck: "Amuleto",
                ring1: "Anel 1",
                ring2: "Anel 2",
                relic: "Relíquia",
                hands: "Mãos / Luvas"
            };

            const slotLabel = slotNames[item.slot || item.type] || item.slot || "Inventário";
            const levelReq = number(item.levelReq || item.level, 1);
            const heroLevel = number(Aethra.GameState.hero?.level, 1);
            const levelOk = heroLevel >= levelReq;

            let statRows = "";
            if (Number.isFinite(item.damageMin) && Number.isFinite(item.damageMax)) {
                statRows += `
                    <div class="aethra-item-stat-row">
                        <small>DANO DE ATAQUE</small>
                        <strong>⚔️ ${formatNumber(item.damageMin)} – ${formatNumber(item.damageMax)}</strong>
                    </div>
                `;
            }
            if (Number.isFinite(item.defense) && item.defense > 0) {
                statRows += `
                    <div class="aethra-item-stat-row">
                        <small>DEFESA CONSTANTE</small>
                        <strong>🛡️ +${formatNumber(item.defense)}</strong>
                    </div>
                `;
            }

            const bonusLabels = {
                str: "Força",
                mag: "Poder Mágico",
                precision: "Precisão",
                critical: "Chance Crítica",
                evasion: "Evasão",
                blockChance: "Chance de Bloqueio",
                hpMax: "Vida Máxima",
                manaMax: "Mana Máxima"
            };

            let bonusList = [];
            Object.entries(bonusLabels).forEach(([key, label]) => {
                const val = number(item[key]);
                if (val > 0) {
                    const isPercent = ["critical", "evasion", "blockChance"].includes(key);
                    const formatted = isPercent ? `${formatNumber(val)}%` : `+${formatNumber(val)}`;
                    bonusList.push(`<li>${formatted} ${label}</li>`);
                }
            });

            const weaponFamilyNames = {
                sword: "Espada",
                axe: "Machado",
                mace: "Maça",
                dagger: "Adaga",
                bow: "Arco"
            };
            const typeLabel = item.type === "weapon"
                ? (weaponFamilyNames[item.weaponFamily] || "Arma")
                : item.type === "armor"
                    ? "Armadura"
                    : item.type === "shield"
                        ? "Escudo"
                        : "Utilitário";

            const itemIcon = item.weaponFamily === "sword" ? "⚔️"
                : item.weaponFamily === "axe" ? "🪓"
                : item.weaponFamily === "mace" ? "🔨"
                : item.weaponFamily === "dagger" ? "🗡️"
                : item.weaponFamily === "bow" ? "🏹"
                : "🎒";

            return `
                <article class="aethra-ui-tooltip__item-detail" style="--item-rarity-color: ${rarityInfo.color}">
                    <header>
                        <span class="aethra-ui-tooltip__item-icon" data-item-type="${escapeHTML(item.weaponFamily || item.type)}">${escapeHTML(itemIcon)}</span>
                        <div>
                            <strong>${escapeHTML(item.name)}</strong>
                            <small style="color: ${rarityInfo.color}; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;">
                                ${escapeHTML(rarityInfo.name)}
                            </small>
                        </div>
                        <span class="aethra-ui-tooltip__item-slot">${escapeHTML(typeLabel)} · ${escapeHTML(slotLabel)}</span>
                    </header>

                    ${statRows ? `<div class="aethra-ui-tooltip__item-stats">${statRows}</div>` : ""}

                    ${bonusList.length > 0 ? `
                        <div class="aethra-ui-tooltip__item-bonuses">
                            <small>PROPRIEDADES ADICIONAIS</small>
                            <ul>${bonusList.join("")}</ul>
                        </div>
                    ` : ""}

                    ${item.description ? `
                        <p class="aethra-ui-tooltip__item-desc"><em>"${escapeHTML(item.description)}"</em></p>
                    ` : ""}

                    <footer class="aethra-ui-tooltip__item-footer">
                        <span class="${levelOk ? "is-ok" : "is-failed"}">
                            Req: Nível ${levelReq}
                        </span>
                        ${item.price ? `
                            <span class="aethra-ui-tooltip__item-price">
                                🪙 ${formatNumber(item.price)} Ouro
                            </span>
                        ` : ""}
                    </footer>
                </article>
            `;
        },

        buildHTML(trigger) {
            const kind = trigger.dataset.tooltipKind || "text";

            if (kind === "skill") {
                return this.buildSkillHTML(trigger.dataset.skillId);
            }

            if (kind === "item") {
                return this.buildItemHTML(trigger.dataset.itemIdRef || trigger.dataset.itemId);
            }

            if (kind === "stat") {
                return this.buildStatHTML(trigger);
            }

            if (["hud", "resource", "metric"].includes(kind)) {
                return this.buildHudHTML(trigger);
            }

            const title = trigger.dataset.tooltipTitle || "Informação";
            const body = trigger.dataset.tooltipBody || "";
            return `
                <article class="aethra-ui-tooltip__text">
                    <strong>${escapeHTML(title)}</strong>
                    ${body ? `<p>${escapeHTML(body)}</p>` : ""}
                </article>
            `;
        },

        show(trigger, event = null) {
            this.init();
            const html = this.buildHTML(trigger);
            if (!html) return false;

            this.activeTrigger = trigger;
            this.tooltip.innerHTML = html;
            this.tooltip.hidden = false;
            this.tooltip.classList.add("is-visible");
            trigger.setAttribute("aria-describedby", this.tooltip.id);

            this.position(event);
            return true;
        },

        position(event = null) {
            if (!this.tooltip || this.tooltip.hidden || !this.activeTrigger) {
                return false;
            }

            const margin = 12;
            const gap = 12;
            const rect = this.activeTrigger.getBoundingClientRect();
            const tooltipRect = this.tooltip.getBoundingClientRect();
            const kind = this.activeTrigger.dataset.tooltipKind || "text";
            const isActionBarSkill = kind === "skill";
            const pointerX = event?.clientX ?? this.lastPointer.x;
            const pointerY = event?.clientY ?? this.lastPointer.y;
            const hasPointer = Number.isFinite(pointerX) && pointerX > 0;

            let x;
            let y;

            if (isActionBarSkill) {
                x = rect.left + rect.width / 2 - tooltipRect.width / 2;
                y = rect.top - tooltipRect.height - gap;
            } else {
                x = hasPointer
                    ? pointerX + gap
                    : rect.left + rect.width / 2 - tooltipRect.width / 2;
                y = hasPointer
                    ? pointerY - tooltipRect.height - gap
                    : rect.top - tooltipRect.height - gap;
            }

            if (x + tooltipRect.width > window.innerWidth - margin) {
                x = window.innerWidth - tooltipRect.width - margin;
            }

            if (x < margin) x = margin;

            if (y < margin) {
                y = isActionBarSkill
                    ? Math.min(
                        window.innerHeight - tooltipRect.height - margin,
                        rect.bottom + gap
                    )
                    : (hasPointer ? pointerY + gap : rect.bottom + gap);
            }

            if (y + tooltipRect.height > window.innerHeight - margin) {
                y = window.innerHeight - tooltipRect.height - margin;
            }

            this.tooltip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
            return true;
        },

        hide() {
            if (!this.tooltip) return false;

            if (this.activeTrigger) {
                this.activeTrigger.removeAttribute("aria-describedby");
            }

            this.activeTrigger = null;
            this.tooltip.classList.remove("is-visible");
            this.tooltip.hidden = true;
            return true;
        },

        refresh() {
            this.init();
            return true;
        }
    };
})(window.Aethra);
