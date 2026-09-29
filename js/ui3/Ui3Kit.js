/*
 * Ui3Kit.js — componentes da UI 3.0 "Ferro e Ouro".
 *
 * Funções puras que devolvem HTML com as classes de css/aethra-ui3.css.
 * Só apresentação: nenhum componente lê ou altera o estado do jogo; quem
 * chama passa os valores prontos. Todo texto recebido é escapado.
 */
(function initUi3Kit(Aethra) {
    "use strict";

    if (!Aethra) return;

    const RARITIES = Object.freeze(["common", "uncommon", "rare", "epic", "legendary"]);
    const RARITY_ALIASES = Object.freeze({
        comum: "common",
        incomum: "uncommon",
        raro: "rare",
        epico: "epic",
        "épico": "epic",
        lendario: "legendary",
        "lendário": "legendary"
    });
    const BAR_KINDS = Object.freeze(["hp", "mana", "vigor", "xp"]);
    const BUTTON_VARIANTS = Object.freeze(["secondary", "primary", "ghost", "danger"]);

    function esc(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function number(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function formatNumber(value) {
        return Math.round(number(value)).toLocaleString("pt-BR");
    }

    function normalizeRarity(value) {
        const key = String(value || "common").trim().toLowerCase();
        const resolved = RARITY_ALIASES[key] || key;
        return RARITIES.includes(resolved) ? resolved : "common";
    }

    /* Atributos extras como data-*, aria-*; valores escapados. */
    function attrs(extra = {}) {
        return Object.entries(extra)
            .filter(([, value]) => value !== undefined && value !== null && value !== false)
            .map(([name, value]) => (value === true ? ` ${esc(name)}` : ` ${esc(name)}="${esc(value)}"`))
            .join("");
    }

    function button({ label, variant = "secondary", icon = "", ariaLabel, disabled = false, attributes = {} } = {}) {
        const kind = BUTTON_VARIANTS.includes(variant) ? variant : "secondary";
        const iconOnly = Boolean(icon) && !label;
        const classes = ["ui3-btn", kind !== "secondary" ? `ui3-btn--${kind}` : "", iconOnly ? "ui3-btn--icon" : ""]
            .filter(Boolean)
            .join(" ");
        return `<button type="button" class="${classes}"${attrs({
            "aria-label": ariaLabel || (iconOnly ? label : undefined),
            disabled,
            ...attributes
        })}>${icon}${label ? esc(label) : ""}</button>`;
    }

    function bar({ kind = "hp", value = 0, max = 1, label = "", showValue = true } = {}) {
        const type = BAR_KINDS.includes(kind) ? kind : "hp";
        const safeMax = Math.max(1, number(max, 1));
        const safeValue = Math.min(safeMax, Math.max(0, number(value)));
        const percent = (safeValue / safeMax) * 100;
        const text = type === "xp" || !showValue
            ? ""
            : `<span class="ui3-bar__text"><span>${esc(label)}</span><span>${formatNumber(safeValue)} / ${formatNumber(safeMax)}</span></span>`;
        return `<div class="ui3-bar ui3-bar--${type}" role="meter" aria-label="${esc(label || type)}" aria-valuemin="0" aria-valuemax="${esc(safeMax)}" aria-valuenow="${esc(safeValue)}"><div class="ui3-bar__fill" style="width:${percent.toFixed(1)}%"></div>${text}</div>`;
    }

    function slot({
        icon = "",
        glyph = "",
        label = "",
        rarity = "common",
        quantity = null,
        hotkey = "",
        cooldown = null,
        selected = false,
        empty = false,
        attributes = {}
    } = {}) {
        const key = hotkey !== "" && hotkey !== null ? `<span class="ui3-slot__key">${esc(hotkey)}</span>` : "";
        if (empty) {
            return `<button type="button" class="ui3-slot ui3-slot--empty"${attrs({ "aria-label": label || "Espaço vazio", ...attributes })}>${key}</button>`;
        }
        const tier = normalizeRarity(rarity);
        const classes = ["ui3-slot", tier !== "common" ? `ui3-slot--${tier}` : "", selected ? "is-selected" : ""]
            .filter(Boolean)
            .join(" ");
        const visual = icon
            ? `<img class="ui3-slot__icon" src="${esc(icon)}" alt="" draggable="false">`
            : `<span class="ui3-slot__glyph" aria-hidden="true">${esc(glyph || "◆")}</span>`;
        const qty = number(quantity, 0) > 1 ? `<span class="ui3-slot__qty">${formatNumber(quantity)}</span>` : "";
        const cd = number(cooldown, 0) > 0 ? `<span class="ui3-slot__cooldown">${formatNumber(cooldown)}</span>` : "";
        return `<button type="button" class="${classes}"${attrs({ "aria-label": label, "aria-pressed": selected ? "true" : undefined, ...attributes })}>${visual}${key}${qty}${cd}</button>`;
    }

    function tabs({ label = "Abas", items = [], selected } = {}) {
        const buttons = items.map((item) => {
            const isSelected = item.id === selected;
            return `<button type="button" role="tab" class="ui3-tab" aria-selected="${isSelected ? "true" : "false"}"${attrs({ "data-ui3-tab": item.id })}>${esc(item.label)}</button>`;
        }).join("");
        return `<div class="ui3-tabs" role="tablist" aria-label="${esc(label)}">${buttons}</div>`;
    }

    function chip({ label, pressed = false, attributes = {} } = {}) {
        return `<button type="button" class="ui3-chip" aria-pressed="${pressed ? "true" : "false"}"${attrs(attributes)}>${esc(label)}</button>`;
    }

    function kpi({ label, value, tone = "" } = {}) {
        const modifier = tone === "positive" || tone === "negative" ? ` ui3-kpi--${tone}` : "";
        return `<div class="ui3-kpi${modifier}"><span class="ui3-eyebrow">${esc(label)}</span><span class="ui3-kpi__value">${esc(value)}</span></div>`;
    }

    function panel({ eyebrow = "", title = "", body = "", label = "", attributes = {} } = {}) {
        const head = eyebrow || title
            ? `<header class="ui3-panel__head">${eyebrow ? `<span class="ui3-eyebrow">${esc(eyebrow)}</span>` : ""}${title ? `<h2 class="ui3-panel__title">${esc(title)}</h2>` : ""}</header>`
            : "";
        return `<section class="ui3-panel"${attrs({ "aria-label": label || title || undefined, ...attributes })}>${head}${body}</section>`;
    }

    Aethra.Ui3Kit = Object.freeze({
        RARITIES,
        esc,
        formatNumber,
        normalizeRarity,
        button,
        bar,
        slot,
        tabs,
        chip,
        kpi,
        panel
    });
})(window.Aethra = window.Aethra || {});
