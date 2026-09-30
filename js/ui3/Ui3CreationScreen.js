/*
 * Ui3CreationScreen.js — Criação de personagem na UI 3.0 (fase 4).
 *
 * Aparece quando a UI 3.0 está ligada e o herói ainda não foi criado.
 * Assume CharacterCreationUI.show() pelo registerPresenter, então quem já
 * abria a criação (início do jogo, novo slot) abre esta versão.
 *   leitura   CharacterBuildSystem (arquétipos, atributos, ofícios,
 *             previewAttributes, validateCreation), DisciplineSystem
 *             (técnicas iniciais), GameData (arma inicial)
 *   comando   CharacterBuildSystem.createCharacter
 */
(function initUi3CreationScreen(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const SCREEN_ID = "creation";
    const NAME_MIN = 3;
    const NAME_MAX = 18;
    const DEFAULT_ARCHETYPE = "vanguard";

    // Texto de apresentação dos arquétipos (o mesmo da criação clássica).
    const ARCHETYPE_META = Object.freeze({
        vanguard: { focus: "Defensor", difficulty: "Fácil", trait: "Aparar: 12% de chance de aparar e reduzir 35% do dano sofrido." },
        berserker: { focus: "Dano físico", difficulty: "Média", trait: "Sangramento: dano máximo maior e 15% de chance de corte profundo." },
        arcanist: { focus: "Conjurador elemental", difficulty: "Difícil", trait: "Confluência arcana: +20% em todos os efeitos mágicos." },
        ranger: { focus: "Distância", difficulty: "Fácil", trait: "Disparo distante: +12% de esquiva e +15% de dano mantendo distância." },
        nightblade: { focus: "Assassino veloz", difficulty: "Difícil", trait: "Perfuração: +15% de crítico e ignora 30% da armadura do alvo." },
        templar: { focus: "Híbrido de suporte", difficulty: "Média", trait: "Esmagar: ignora 25% da defesa e 10% de chance de atordoar." }
    });

    let screen = null;
    let parts = {};
    let draft = null;
    let errors = [];
    const rendered = new WeakMap();

    function kit() {
        return Aethra.Ui3Kit;
    }

    function build() {
        return Aethra.CharacterBuildSystem;
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

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function sum(values = {}) {
        return Object.values(values).reduce((total, value) => total + number(value), 0);
    }

    function zeros(definitions) {
        return Object.fromEntries(Object.keys(definitions || {}).map((id) => [id, 0]));
    }

    /* ---------------------------------------------------------------
       Rascunho (só nesta tela; o herói só muda em createCharacter)
       --------------------------------------------------------------- */

    function applyArchetype(id) {
        const archetype = build()?.archetypes?.[id];
        if (!archetype) return false;
        draft.archetypeId = id;
        draft.attributes = { ...zeros(build().attributes), ...clone(archetype.attributes || {}) };
        draft.masteries = { ...zeros(build().masteries), ...clone(archetype.masteries || {}) };
        return true;
    }

    function ensureDraft() {
        if (draft) return draft;
        draft = { name: "", archetypeId: null, introProfessionId: null, attributes: {}, masteries: {} };
        applyArchetype(DEFAULT_ARCHETYPE) || applyArchetype(Object.keys(build()?.archetypes || {})[0]);
        return draft;
    }

    function remainingPoints() {
        return number(build()?.attributePoints) - sum(draft.attributes);
    }

    function validation() {
        return build()?.validateCreation?.(draft) || { valid: false, errors: ["Sistema de criação indisponível."] };
    }

    function nameError() {
        const length = String(draft.name || "").trim().length;
        return length < NAME_MIN ? `O nome precisa de pelo menos ${NAME_MIN} letras.` : null;
    }

    /* ---------------------------------------------------------------
       Renderização
       --------------------------------------------------------------- */

    function previewHTML() {
        const K = kit();
        const archetype = build().archetypes?.[draft.archetypeId] || null;
        const stats = build().previewAttributes(draft.attributes)?.stats || {};
        const sprite = Aethra.SpriteLoader?.getHeroSource?.(draft.archetypeId) || "";
        const hit = Math.min(98, 85 + number(stats.precision));
        return `<div class="ui3-creation__figure">
                ${sprite ? `<img src="${K.esc(sprite)}" alt="Prévia do herói" draggable="false">` : ""}
                <span class="ui3-paperdoll__shadow" aria-hidden="true"></span>
            </div>
            <div class="ui3-stack ui3-creation__identity">
                <strong class="ui3-quest-head__title">${K.esc(String(draft.name || "").trim() || "Novo herói")}</strong>
                <span class="ui3-caption">${K.esc(archetype ? `${archetype.name} · ${archetype.title || ""}` : "Escolha uma origem")}</span>
            </div>
            <div class="ui3-kpi-grid ui3-kpi-grid--3">
                ${K.kpi({ label: "Vida", value: K.formatNumber(stats.maxHp) })}
                ${K.kpi({ label: "Mana", value: K.formatNumber(stats.maxMana) })}
                ${K.kpi({ label: "Vigor", value: K.formatNumber(stats.maxEnergy) })}
            </div>
            <div class="ui3-stat-grid">
                <div class="ui3-stat"><span class="ui3-eyebrow">Ataque</span><strong>${K.formatNumber(stats.damageMin)}–${K.formatNumber(stats.damageMax)}</strong></div>
                <div class="ui3-stat"><span class="ui3-eyebrow">Defesa</span><strong>${K.esc(K.formatStat("defense", stats.defense))}</strong></div>
                <div class="ui3-stat"><span class="ui3-eyebrow">Acerto</span><strong>${hit}%</strong></div>
                <div class="ui3-stat"><span class="ui3-eyebrow">Crítico</span><strong>${K.esc(K.formatStat("critical", stats.critical))}</strong></div>
                <div class="ui3-stat"><span class="ui3-eyebrow">Esquiva</span><strong>${K.esc(K.formatStat("evasion", stats.evasion))}</strong></div>
            </div>
            <div class="ui3-note ui3-creation__risk"><span>A morte deixa marcas: derrota custa 10% do XP do nível e 10% do ouro, e o herói volta à cidade.</span></div>`;
    }

    function archetypeCardHTML(archetype) {
        const K = kit();
        const meta = ARCHETYPE_META[archetype.id] || {};
        const weapon = Aethra.GameData?.items?.[archetype.starterItemId] || {};
        const selected = archetype.id === draft.archetypeId;
        const topMasteries = Object.entries(archetype.masteries || {})
            .sort((a, b) => number(b[1]) - number(a[1]))
            .slice(0, 3)
            .map(([id]) => build().masteries?.[id]?.name || id);
        return `<button type="button" class="ui3-archetype${selected ? " is-selected" : ""}" data-ui3-archetype="${K.esc(archetype.id)}" aria-pressed="${selected ? "true" : "false"}" style="--ui3-accent:${K.esc(archetype.accent || "#D8B25C")}">
                <span class="ui3-archetype__icon" aria-hidden="true">${K.esc(archetype.icon || "✦")}</span>
                <span class="ui3-eyebrow">${K.esc(meta.focus || "")} · ${K.esc(meta.difficulty || "")}</span>
                <strong class="ui3-archetype__name">${K.esc(archetype.name)}</strong>
                <span class="ui3-archetype__weapon">${K.esc(weapon.name || "Arma inicial")}${weapon.damageMin ? ` · dano ${K.formatNumber(weapon.damageMin)}–${K.formatNumber(weapon.damageMax)}` : ""}</span>
                <span class="ui3-row">${topMasteries.map((name) => `<span class="ui3-tag">${K.esc(name)}</span>`).join("")}</span>
            </button>`;
    }

    function spotlightHTML() {
        const K = kit();
        const archetype = build().archetypes?.[draft.archetypeId];
        if (!archetype) return "";
        const meta = ARCHETYPE_META[archetype.id] || {};
        const starters = Aethra.DisciplineSystem?.getStarterSkills?.(draft.masteries) || [];
        const slots = starters.map((skillId, index) => {
            const skill = Aethra.SkillSystem?.getSkill?.(skillId);
            return skill ? K.slot({ ...K.skillVisual(skill), hotkey: String(index + 1), label: skill.name, attributes: { title: skill.name, tabindex: "-1" } }) : "";
        }).join("");
        return `<section class="ui3-creation__spotlight">
                <div class="ui3-stack">
                    <span class="ui3-eyebrow">${K.esc(archetype.title || "Origem escolhida")}</span>
                    <p class="ui3-item-description">${K.esc(archetype.description || "")}</p>
                    ${meta.trait ? `<p class="ui3-caption"><strong>Passiva da arma:</strong> ${K.esc(meta.trait)}</p>` : ""}
                </div>
                <div class="ui3-stack">
                    <span class="ui3-eyebrow">Barra inicial</span>
                    <div class="ui3-row">${slots || `<span class="ui3-caption">Sem técnicas iniciais.</span>`}</div>
                </div>
                <p class="ui3-caption">Sem classes fixas: o que você usa é o que evolui. Qualquer arma ou magia pode ser aprendida na jornada.</p>
            </section>`;
    }

    function attributesHTML() {
        const K = kit();
        const max = number(build().maxInitialAttribute, 6);
        const remaining = remainingPoints();
        const rows = Object.values(build().attributes || {}).map((definition) => {
            const value = number(draft.attributes[definition.id]);
            const pips = Array.from({ length: max }, (_, index) => `<i class="${index < value ? "is-on" : ""}"></i>`).join("");
            return `<div class="ui3-attribute" title="${K.esc(definition.perPoint || "")}">
                    <span class="ui3-glyph-box" aria-hidden="true">${K.esc(definition.icon || "•")}</span>
                    <span class="ui3-list-row__text"><strong>${K.esc(definition.name)}</strong><small>${K.esc(definition.short || "")}</small><span class="ui3-pips" aria-hidden="true">${pips}</span></span>
                    <span class="ui3-stepper">
                        <button type="button" class="ui3-btn ui3-btn--icon" data-ui3-attribute="${K.esc(definition.id)}" data-delta="-1" aria-label="Remover ponto de ${K.esc(definition.name)}" ${value <= 0 ? "disabled" : ""}>−</button>
                        <strong aria-live="polite">${value}</strong>
                        <button type="button" class="ui3-btn ui3-btn--icon" data-ui3-attribute="${K.esc(definition.id)}" data-delta="1" aria-label="Adicionar ponto de ${K.esc(definition.name)}" ${value >= max || remaining <= 0 ? "disabled" : ""}>+</button>
                    </span>
                </div>`;
        }).join("");
        return `<div class="ui3-row-between"><span class="ui3-eyebrow">Atributos</span><strong class="${remaining === 0 ? "ui3-text-ok" : "ui3-text-warn"}">${remaining} ${remaining === 1 ? "ponto livre" : "pontos livres"}</strong></div>
            ${rows}
            ${K.button({ label: "Restaurar sugestão do arquétipo", variant: "ghost", attributes: { "data-ui3-reset-attributes": "" } })}`;
    }

    function professionsHTML() {
        const K = kit();
        const entries = Object.values(build().introProfessions || {});
        return `<span class="ui3-eyebrow">Primeiro ofício</span>
            <p class="ui3-caption">Só orienta a missão inicial; todas as habilidades começam no nível 1.</p>
            <div class="ui3-profession-grid">${entries.map((path) => {
                const definition = Aethra.ProfessionSystem?.professions?.[path.id] || {};
                const selected = draft.introProfessionId === path.id;
                return `<button type="button" class="ui3-list-row" data-ui3-profession="${K.esc(path.id)}" aria-pressed="${selected ? "true" : "false"}">
                        <span class="ui3-glyph-box" aria-hidden="true">${K.esc(definition.icon || "◇")}</span>
                        <span class="ui3-list-row__text"><strong>${K.esc(path.title)}</strong><small>${K.esc(path.objective || "")}</small></span>
                    </button>`;
            }).join("")}</div>`;
    }

    function submitHTML() {
        const K = kit();
        const result = validation();
        const problems = [nameError(), ...(result.errors || [])].filter(Boolean);
        const shown = errors.length ? errors : [];
        return `${shown.length ? `<ul class="ui3-errors" role="alert">${shown.map((error) => `<li>${K.esc(error)}</li>`).join("")}</ul>` : ""}
            ${K.button({ label: "Entrar em Aethra", variant: "primary", disabled: problems.length > 0, attributes: { "data-ui3-create": "" } })}
            ${problems.length ? `<p class="ui3-caption">${K.esc(problems[0])}</p>` : `<p class="ui3-caption">Tudo pronto.</p>`}`;
    }

    function render() {
        if (!screen || screen.hidden || !build()) return false;
        ensureDraft();
        patch(parts.preview, previewHTML());
        patch(parts.archetypes, Object.values(build().archetypes || {}).map(archetypeCardHTML).join(""));
        patch(parts.spotlight, spotlightHTML());
        patch(parts.attributes, attributesHTML());
        patch(parts.professions, professionsHTML());
        patch(parts.submit, submitHTML());
        if (parts.name && parts.name.value !== draft.name) parts.name.value = draft.name;
        return true;
    }

    /* ---------------------------------------------------------------
       Comandos
       --------------------------------------------------------------- */

    function adjustAttribute(id, delta) {
        if (!(id in draft.attributes)) return false;
        const max = number(build().maxInitialAttribute, 6);
        const current = number(draft.attributes[id]);
        const next = Math.max(0, Math.min(max, current + Number(delta)));
        if (next > current && remainingPoints() <= 0) return false;
        draft.attributes[id] = next;
        errors = [];
        render();
        return true;
    }

    function create() {
        const problems = [nameError(), ...(validation().errors || [])].filter(Boolean);
        if (problems.length) {
            errors = problems;
            render();
            return false;
        }
        const result = build().createCharacter({ ...draft, name: String(draft.name).trim() });
        if (!result?.valid) {
            errors = result?.errors?.length ? result.errors : ["Não foi possível criar o herói."];
            render();
            return false;
        }
        errors = [];
        draft = null;
        Aethra.UIManager?.setPrimaryView?.("city", { source: "character-created" });
        Aethra.RenderEngine?.renderAll?.();
        sync();
        return true;
    }

    function onClick(event) {
        const target = event.target;
        const archetype = target.closest("[data-ui3-archetype]");
        if (archetype) {
            applyArchetype(archetype.dataset.ui3Archetype);
            errors = [];
            return render();
        }
        const attribute = target.closest("[data-ui3-attribute]");
        if (attribute) return adjustAttribute(attribute.dataset.ui3Attribute, Number(attribute.dataset.delta));
        if (target.closest("[data-ui3-reset-attributes]")) {
            applyArchetype(draft.archetypeId);
            return render();
        }
        const profession = target.closest("[data-ui3-profession]");
        if (profession) {
            draft.introProfessionId = profession.dataset.ui3Profession;
            errors = [];
            return render();
        }
        if (target.closest("[data-ui3-creation-reset]")) {
            draft = null;
            errors = [];
            return render();
        }
        if (target.closest("[data-ui3-create]")) return create();
        return undefined;
    }

    function onInput(event) {
        if (!event.target.matches("[data-ui3-hero-name]")) return;
        draft.name = event.target.value.slice(0, NAME_MAX);
        errors = [];
        patch(parts.preview, previewHTML());
        patch(parts.submit, submitHTML());
    }

    /* ---------------------------------------------------------------
       Montagem e ciclo de vida
       --------------------------------------------------------------- */

    function buildScreen(root) {
        const element = document.createElement("section");
        element.className = "ui3-creation";
        element.dataset.ui3Screen = SCREEN_ID;
        element.dataset.ui3Covers = "world topbar";
        element.setAttribute("role", "dialog");
        element.setAttribute("aria-modal", "true");
        element.setAttribute("aria-labelledby", "ui3-creation-title");
        element.hidden = true;
        element.innerHTML = `<header class="ui3-creation__header">
                <div class="ui3-topbar__brand">
                    <span class="ui3-topbar__mark" aria-hidden="true">A</span>
                    <span class="ui3-stack"><span class="ui3-eyebrow">Crônicas de Aethra</span><h1 class="ui3-dialog__title" id="ui3-creation-title">Forje seu herói</h1></span>
                </div>
                <button type="button" class="ui3-btn ui3-btn--ghost" data-ui3-creation-reset>Recomeçar</button>
            </header>
            <div class="ui3-creation__body">
                <aside class="ui3-creation__panel" aria-label="Seu personagem">
                    <label class="ui3-field">
                        <span class="ui3-eyebrow">Nome do herói</span>
                        <input type="text" maxlength="${NAME_MAX}" placeholder="Como vão chamar você?" autocomplete="off" spellcheck="false" data-ui3-hero-name data-ui3-autofocus>
                    </label>
                    <div class="ui3-stack" data-ui3-part="preview"></div>
                </aside>
                <main class="ui3-creation__main" aria-label="Origem">
                    <div class="ui3-stack">
                        <span class="ui3-eyebrow">Origem</span>
                        <h2 class="ui3-heading">Qual fantasia você quer viver?</h2>
                    </div>
                    <div class="ui3-archetype-grid" data-ui3-part="archetypes"></div>
                    <div data-ui3-part="spotlight"></div>
                </main>
                <aside class="ui3-creation__panel" aria-label="Atributos e ofício">
                    <section class="ui3-stack" data-ui3-part="attributes"></section>
                    <section class="ui3-stack" data-ui3-part="professions"></section>
                    <section class="ui3-stack ui3-creation__submit" data-ui3-part="submit"></section>
                </aside>
            </div>`;
        element.addEventListener("click", onClick);
        element.addEventListener("input", onInput);
        root.appendChild(element);
        const part = (name) => element.querySelector(`[data-ui3-part="${name}"]`);
        parts = {
            preview: part("preview"),
            archetypes: part("archetypes"),
            spotlight: part("spotlight"),
            attributes: part("attributes"),
            professions: part("professions"),
            submit: part("submit"),
            name: element.querySelector("[data-ui3-hero-name]")
        };
        return element;
    }

    function ensureScreen() {
        const root = Aethra.Ui3Shell?.root;
        if (!root) return null;
        if (!screen || !root.contains(screen)) screen = buildScreen(root);
        return screen;
    }

    function shouldShow() {
        return Boolean(Aethra.Ui3Shell?.isActive?.())
            && Boolean(build())
            && Aethra.GameState?.hero?.characterCreated !== true;
    }

    function sync() {
        const visible = shouldShow();
        if (!visible && !screen) return false;
        ensureScreen();
        if (!screen) return false;
        const wasHidden = screen.hidden;
        screen.hidden = !visible;
        if (visible) {
            render();
            if (wasHidden) window.setTimeout(() => parts.name?.focus({ preventScroll: true }), 0);
        }
        Aethra.Ui3Shell?.refresh?.();
        return visible;
    }

    const presenter = {
        isActive: () => Boolean(Aethra.Ui3Shell?.isActive?.()),
        show: () => sync(),
        close: () => {
            if (screen) screen.hidden = true;
            Aethra.Ui3Shell?.refresh?.();
        }
    };
    Aethra.CharacterCreationUI?.registerPresenter?.(presenter);

    ["ui3:version-applied", "character:created", "state:restored", "save:loaded", "save:reset", "engine:ready"]
        .forEach((eventName) => Aethra.EventBus.on(eventName, () => {
            sync();
            window.setTimeout(sync, 0);
        }));

    Aethra.Ui3CreationScreen = {
        sync,
        render,
        isVisible: () => Boolean(screen && !screen.hidden),
        getDraft: () => (draft ? clone(draft) : null)
    };
})(window.Aethra = window.Aethra || {});
