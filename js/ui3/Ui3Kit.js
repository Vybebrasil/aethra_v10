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
    const SLOT_TONES = Object.freeze(["gold", "blue", "green", "red", "violet"]);

    /* Ícones de traço (24×24). Só nomes desta tabela viram SVG. */
    const ICON_PATHS = Object.freeze({
        sword: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"></path><path d="m13 19 6-6"></path><path d="m16 16 4 4"></path><path d="m19 21 2-2"></path>',
        shield: '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"></path>',
        plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
        flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"></path>',
        snow: '<path d="M12 2v20"></path><path d="m4.9 7 14.2 10"></path><path d="m19.1 7-14.2 10"></path><path d="m9 4 3 2 3-2"></path><path d="m9 20 3-2 3 2"></path>',
        moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path>',
        spark: '<path d="M12 3v4"></path><path d="M12 17v4"></path><path d="M3 12h4"></path><path d="M17 12h4"></path><path d="m7 7 2.5 2.5"></path><path d="m14.5 14.5 2.5 2.5"></path><path d="m17 7-2.5 2.5"></path><path d="m9.5 14.5-2.5 2.5"></path>',
        axe: '<path d="m14 12-9 9"></path><path d="M13 4c3 0 7 3 7 7l-4 1-4-4z"></path>',
        dagger: '<path d="m14 4 6 0 0 6-9 9-3-3z"></path><path d="m5 16 3 3"></path><path d="m3 21 2-2"></path>',
        bow: '<path d="M5 3c8 2 14 8 16 16"></path><path d="M5 3 19 19"></path><path d="m15 3 6 0 0 6"></path>',
        hammer: '<path d="m15 12-8.5 8.5a2.1 2.1 0 0 1-3-3L12 9"></path><path d="m17.6 11.6-5.2-5.2 3-3 5.2 5.2z"></path>',
        fist: '<path d="M7 11V7a2 2 0 0 1 4 0v4"></path><path d="M11 10V6a2 2 0 0 1 4 0v5"></path><path d="M15 10a2 2 0 0 1 4 0v4a7 7 0 0 1-7 7h-1a6 6 0 0 1-6-6v-2a2 2 0 0 1 2-2h2"></path>'
    });

    function icon(name, size = 24) {
        const paths = ICON_PATHS[name];
        if (!paths) return "";
        const px = Math.max(10, Math.min(48, Number(size) || 24));
        return `<svg class="ui3-icon" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
    }

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
        icon: image = "",
        symbol = "",
        glyph = "",
        tone = "",
        label = "",
        rarity = "common",
        quantity = null,
        hotkey = "",
        cooldown = null,
        badge = "",
        selected = false,
        active = false,
        disabled = false,
        empty = false,
        attributes = {}
    } = {}) {
        const key = hotkey !== "" && hotkey !== null ? `<span class="ui3-slot__key">${esc(hotkey)}</span>` : "";
        if (empty) {
            return `<button type="button" class="ui3-slot ui3-slot--empty"${attrs({ "aria-label": label || "Espaço vazio", ...attributes })}>${key}</button>`;
        }
        const tier = normalizeRarity(rarity);
        const hue = SLOT_TONES.includes(tone) ? tone : "";
        const classes = [
            "ui3-slot",
            tier !== "common" ? `ui3-slot--${tier}` : "",
            hue ? `ui3-slot--tone-${hue}` : "",
            selected ? "is-selected" : "",
            active ? "is-active" : "",
            disabled ? "is-disabled" : ""
        ].filter(Boolean).join(" ");
        const visual = image
            ? `<img class="ui3-slot__icon" src="${esc(image)}" alt="" draggable="false">`
            : ICON_PATHS[symbol]
                ? `<span class="ui3-slot__symbol">${icon(symbol, 26)}</span>`
                : `<span class="ui3-slot__glyph" aria-hidden="true">${esc(glyph || "◆")}</span>`;
        const qty = number(quantity, 0) > 1 ? `<span class="ui3-slot__qty">${formatNumber(quantity)}</span>` : "";
        const tag = !qty && badge ? `<span class="ui3-slot__badge">${esc(badge)}</span>` : "";
        const cd = number(cooldown, 0) > 0 ? `<span class="ui3-slot__cooldown">${formatNumber(cooldown)}</span>` : "";
        return `<button type="button" class="${classes}"${attrs({
            "aria-label": label,
            "aria-pressed": selected ? "true" : undefined,
            "aria-disabled": disabled ? "true" : undefined,
            ...attributes
        })}>${visual}${key}${qty}${tag}${cd}</button>`;
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
        icon,
        iconNames: Object.freeze(Object.keys(ICON_PATHS)),
        button,
        bar,
        slot,
        tabs,
        chip,
        kpi,
        panel
    });
})(window.Aethra = window.Aethra || {});
