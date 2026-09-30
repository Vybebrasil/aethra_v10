/*
 * Ui3Items.js — apresentação de itens compartilhada pelas janelas da UI 3.0.
 *
 * Nome, raridade, ícone, atributos, efeitos, comparação com o equipado e
 * durabilidade. Só leitura: GameData, EquipSystem e o próprio item. Serve
 * tanto a itens da mochila quanto a modelos do catálogo da loja.
 */
(function initUi3Items(Aethra) {
    "use strict";

    if (!Aethra) return;

    const SLOT_LABELS = Object.freeze({
        head: "Capacete",
        neck: "Amuleto",
        chest: "Peitoral",
        hands: "Luvas",
        ring1: "Anel 1",
        relic: "Relíquia",
        weapon: "Arma",
        offhand: "Mão secundária",
        legs: "Calça",
        feet: "Botas",
        ring2: "Anel 2"
    });
    const TYPE_LABELS = Object.freeze({
        WEAPON: "Arma",
        SHIELD: "Escudo",
        OFFHAND: "Mão secundária",
        HELMET: "Elmo",
        HEAD: "Elmo",
        ARMOR: "Armadura",
        CHEST: "Armadura",
        GLOVES: "Luvas",
        HANDS: "Luvas",
        LEGS: "Calça",
        PANTS: "Calça",
        BOOTS: "Botas",
        FEET: "Botas",
        AMULET: "Amuleto",
        NECK: "Amuleto",
        RING: "Anel",
        ACCESSORY: "Acessório",
        RELIC: "Relíquia",
        CONSUMABLE: "Consumível",
        TOOL: "Ferramenta",
        MATERIAL: "Material",
        LOOT: "Espólio",
        QUEST: "Missão"
    });
    const WEAPON_FAMILIES = Object.freeze({
        sword: "Espada",
        axe: "Machado",
        mace: "Maça",
        dagger: "Adaga",
        bow: "Arco",
        focus: "Foco",
        staff: "Cajado",
        wand: "Varinha"
    });
    const RARITY_RANK = Object.freeze({ common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 });

    function kit() {
        return Aethra.Ui3Kit;
    }

    function number(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function template(item) {
        const id = item?.templateId || item?.id;
        return (id && (Aethra.GameData?.items?.[id] || Aethra.GameData?.getItem?.(id))) || {};
    }

    function typeOf(item) {
        return String(item?.itemType || item?.type || "").toUpperCase();
    }

    function allowedSlots(item) {
        return Aethra.EquipSystem?.getAllowedSlots?.(item) || [];
    }

    function isEquipable(item) {
        return allowedSlots(item).length > 0;
    }

    function rarityOf(item) {
        const presentation = Aethra.GameData?.getRarityPresentation?.(item);
        return {
            id: kit().normalizeRarity(presentation?.id || item?.rarityId || item?.rarity),
            name: presentation?.name || item?.rarity || "Comum"
        };
    }

    function rarityRank(item) {
        return RARITY_RANK[rarityOf(item).id] || 1;
    }

    function imageOf(item) {
        return Aethra.GameData?.getItemImage?.(item) || "";
    }

    function nameOf(item) {
        return item?.name || item?.baseName || item?.templateId || item?.id || "Item";
    }

    function glyphOf(item) {
        const icon = String(item?.icon || "");
        return icon && !icon.includes(".") && !icon.includes("/") ? icon : nameOf(item).charAt(0).toUpperCase();
    }

    function unitValue(item) {
        const base = template(item);
        return Math.max(0, number(item?.price ?? item?.basePrice ?? item?.value ?? base.price ?? base.value));
    }

    function quantityOf(item) {
        return Math.max(1, Math.floor(number(item?.quantity, 1)));
    }

    function typeLabel(item) {
        const family = String(item?.weaponFamily || "").toLowerCase();
        return WEAPON_FAMILIES[family] || TYPE_LABELS[typeOf(item)] || "Item";
    }

    function metaLine(item) {
        const level = Math.max(1, Math.floor(number(item?.levelReq, 1)));
        return [rarityOf(item).name, typeLabel(item), `Nv ${level}`].join(" · ");
    }

    function statsOf(item) {
        return item?.stats && Object.keys(item.stats).length ? item.stats : item?.baseStats || {};
    }

    // Linhas [rótulo, valor] de atributos e efeitos de consumível.
    function statRows(item) {
        const K = kit();
        const stats = statsOf(item);
        const rows = [];
        const keys = Object.keys(stats).filter((key) => number(stats[key]) !== 0);
        if (keys.includes("damageMin") || keys.includes("damageMax")) {
            rows.push(["Dano", `${K.formatNumber(stats.damageMin)}–${K.formatNumber(stats.damageMax)}`]);
        }
        keys.filter((key) => key !== "damageMin" && key !== "damageMax").forEach((key) => {
            rows.push([K.statLabel(key), K.formatStat(key, stats[key], { signed: true })]);
        });
        const base = template(item);
        [["healAmount", "Recupera vida"], ["manaAmount", "Recupera mana"], ["energyAmount", "Recupera vigor"]]
            .forEach(([key, label]) => {
                const amount = number(item?.[key] ?? base[key]);
                if (amount > 0) rows.push([label, `+${K.formatNumber(amount)}`]);
            });
        return rows;
    }

    function rowsHTML(rows) {
        const K = kit();
        if (!rows.length) return "";
        return `<div class="ui3-item-stats">${rows.map(([label, value]) => `<div class="ui3-row-between"><span>${K.esc(label)}</span><strong>${K.esc(value)}</strong></div>`).join("")}</div>`;
    }

    // Em qual espaço o item entraria e o que está lá hoje.
    function compareTarget(item) {
        const validation = item?.instanceId ? Aethra.EquipSystem?.validateEquip?.(item) : null;
        const slots = validation?.allowedSlots?.length ? validation.allowedSlots : allowedSlots(item);
        const equipment = Aethra.EquipSystem?.getEquipment?.() || {};
        const slot = validation?.slot
            || slots.find((candidate) => !equipment[candidate])
            || slots[0]
            || null;
        return { slot, equipped: slot ? equipment[slot] || null : null, validation };
    }

    function comparisonHTML(item, { baseValues = false } = {}) {
        const K = kit();
        const { slot, equipped } = compareTarget(item);
        if (!slot) return "";
        const next = statsOf(item);
        const current = equipped ? statsOf(equipped) : {};
        const diffs = [];
        const averageDamage = (stats) => (number(stats.damageMin) + number(stats.damageMax)) / 2;
        const damageDiff = averageDamage(next) - averageDamage(current);
        if (Math.abs(damageDiff) > 0.001) diffs.push(["Dano médio", damageDiff, "damage"]);
        [...new Set([...Object.keys(next), ...Object.keys(current)])]
            .filter((key) => key !== "damageMin" && key !== "damageMax")
            .forEach((key) => {
                const diff = number(next[key]) - number(current[key]);
                if (Math.abs(diff) > 0.0001) diffs.push([K.statLabel(key), diff, key]);
            });
        const title = equipped
            ? `Comparado a ${nameOf(equipped)}${baseValues ? " · valores base" : ""}`
            : `${SLOT_LABELS[slot] || "Espaço"} vazio`;
        const rows = diffs.length
            ? diffs.map(([label, diff, key]) => `<div class="ui3-row-between"><span>${K.esc(label)}</span><strong class="${diff > 0 ? "is-up" : "is-down"}">${diff > 0 ? "▲" : "▼"} ${K.esc(K.formatStat(key, diff, { signed: true }))}</strong></div>`).join("")
            : `<p class="ui3-empty">Nenhuma diferença de atributos.</p>`;
        return `<div class="ui3-compare"><span class="ui3-eyebrow">${K.esc(title)}</span>${rows}</div>`;
    }

    function durabilityHTML(item) {
        const K = kit();
        const durability = item?.durability;
        if (!durability || !number(durability.max)) return "";
        const percent = Math.max(0, Math.min(100, (number(durability.current) / number(durability.max)) * 100));
        const tone = percent <= 25 ? "is-low" : percent <= 50 ? "is-mid" : "";
        return `<div class="ui3-durability ${tone}">
                <div class="ui3-row-between"><span>Durabilidade</span><strong>${K.formatNumber(durability.current)} / ${K.formatNumber(durability.max)}</strong></div>
                <div class="ui3-durability__track" role="meter" aria-label="Durabilidade" aria-valuemin="0" aria-valuemax="${K.esc(durability.max)}" aria-valuenow="${K.esc(durability.current)}"><div style="width:${percent.toFixed(1)}%"></div></div>
            </div>`;
    }

    function headHTML(item, extraMeta = "") {
        const K = kit();
        const rarity = rarityOf(item);
        const image = imageOf(item);
        return `<div class="ui3-item-head">
                <div class="ui3-item-head__icon ui3-item-head__icon--${rarity.id}">${image
                    ? `<img src="${K.esc(image)}" alt="" draggable="false">`
                    : `<span aria-hidden="true">${K.esc(glyphOf(item))}</span>`}</div>
                <div class="ui3-item-head__text">
                    <strong class="ui3-item-head__name ui3-rarity-text--${rarity.id}">${K.esc(nameOf(item))}</strong>
                    <span class="ui3-caption">${K.esc(metaLine(item))}${extraMeta ? ` · ${K.esc(extraMeta)}` : ""}</span>
                </div>
            </div>`;
    }

    function descriptionOf(item) {
        return item?.description || template(item).description || "";
    }

    // Ícone pequeno (32px) para listas.
    function thumbHTML(item) {
        const K = kit();
        const rarity = rarityOf(item);
        const image = imageOf(item);
        return `<span class="ui3-loot-row__icon ui3-loot-row__icon--${rarity.id}">${image
            ? `<img src="${K.esc(image)}" alt="" draggable="false">`
            : `<span aria-hidden="true">${K.esc(glyphOf(item))}</span>`}</span>`;
    }

    Aethra.Ui3Items = Object.freeze({
        SLOT_LABELS,
        typeOf,
        isEquipable,
        allowedSlots,
        rarityOf,
        rarityRank,
        imageOf,
        nameOf,
        glyphOf,
        unitValue,
        quantityOf,
        typeLabel,
        metaLine,
        statsOf,
        statRows,
        rowsHTML,
        compareTarget,
        comparisonHTML,
        durabilityHTML,
        headHTML,
        descriptionOf,
        thumbHTML
    });
})(window.Aethra = window.Aethra || {});
