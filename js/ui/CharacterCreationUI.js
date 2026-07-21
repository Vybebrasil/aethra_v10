// CharacterCreationUI.js - fluxo cinematográfico de criação e disciplinas.
(function initCharacterCreationUI(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const esc = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    const fmt = (value) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(value || 0));
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const sum = (values = {}) => Object.values(values).reduce((total, value) => total + Number(value || 0), 0);

    const getStarterWeaponBonus = (entry) => {
        const item = Aethra.GameData?.items?.[entry.starterItemId] || {};
        if (!item.name) return "Equipamento padrão";
        const damage = `${item.damageMin}–${item.damageMax}`;
        const extra = item.mag ? `, +${item.mag} Magia` : "";
        return `${item.name} (Dano: ${damage}${extra})`;
    };

    const ARCHETYPE_META = {
        vanguard: {
            focus: "Defensor / Tanque",
            difficulty: "Fácil (★☆☆)",
            highlight: "Vitalidade & Defesa",
            starterSkillId: "precise_strike"
        },
        berserker: {
            focus: "Dano Físico / Risco",
            difficulty: "Média (★★☆)",
            highlight: "Força Física",
            starterSkillId: "brutal_cleave"
        },
        arcanist: {
            focus: "Elemental / Conjurador",
            difficulty: "Difícil (★★★)",
            highlight: "Magia & Mana",
            starterSkillId: "fire_bolt"
        },
        ranger: {
            focus: "Distância / Utilitário",
            difficulty: "Fácil (★☆☆)",
            highlight: "Precisão & Esquiva",
            starterSkillId: "aimed_shot"
        },
        nightblade: {
            focus: "Velocidade / Assassino",
            difficulty: "Difícil (★★★)",
            highlight: "Agilidade & Crítico",
            starterSkillId: "twin_fang"
        },
        templar: {
            focus: "Híbrido / Suporte",
            difficulty: "Média (★★☆)",
            highlight: "Maças & Restauração",
            starterSkillId: "armor_breaker"
        }
    };

    const STEP_META = [
        { id: 1, label: "Origem", title: "Escolha sua fantasia", copy: "Seu arquétipo define o ponto de partida, não o seu destino." },
        { id: 2, label: "Atributos", title: "Modele o corpo e a mente", copy: "Cada ponto muda números que você verá durante o combate." },
        { id: 3, label: "Disciplinas", title: "Defina como você joga", copy: "Armas e escolas evoluem conforme são usadas; pontos iniciais aceleram sua identidade." },
        { id: 4, label: "Juramento", title: "Confirme sua jornada", copy: "Revise seu equipamento, técnicas e os riscos antes de entrar em Aethra." }
    ];
    const FILTERS = [
        { id: "weapons", label: "Armas", icon: "⚔" },
        { id: "arcana", label: "Arcana", icon: "✦" },
        { id: "defense", label: "Defesa", icon: "⬡" },
        { id: "world", label: "Mundo", icon: "⌖" }
    ];

    let draft = null;
    let activeMode = null;
    let activeStep = 1;
    let activeFilter = "weapons";

    function system() {
        return Aethra.CharacterBuildSystem;
    }

    function ensureLayer() {
        let layer = document.getElementById("character-creation-layer");
        if (!layer) {
            layer = document.createElement("div");
            layer.id = "character-creation-layer";
            (document.getElementById("modal-layer") || document.body).appendChild(layer);
        }
        return layer;
    }

    function emptyFor(definitions) {
        return Object.fromEntries(Object.keys(definitions || {}).map((id) => [id, 0]));
    }

    function initialDraft() {
        return {
            name: "Aethra",
            archetypeId: null,
            attributes: emptyFor(system().attributes),
            masteries: emptyFor(system().masteries)
        };
    }

    function archetype() {
        return system().archetypes?.[draft?.archetypeId] || null;
    }

    function points() {
        return {
            attributes: system().attributePoints - sum(draft.attributes),
            masteries: system().initialSkillPoints - sum(draft.masteries)
        };
    }

    function stepReady(step) {
        const remaining = points();
        if (step === 1) return Boolean(archetype()) && String(draft.name || "").trim().length >= 3;
        if (step === 2) return remaining.attributes === 0;
        if (step === 3) return remaining.masteries === 0;
        return system().validateCreation(draft).valid;
    }

    function canVisit(step) {
        if (step <= 1) return true;
        for (let index = 1; index < step; index += 1) {
            if (!stepReady(index)) return false;
        }
        return true;
    }

    function selectArchetype(id) {
        const selected = system().archetypes?.[id];
        if (!selected) return false;
        draft.archetypeId = id;
        draft.attributes = { ...emptyFor(system().attributes), ...clone(selected.attributes) };
        draft.masteries = { ...emptyFor(system().masteries), ...clone(selected.masteries) };
        renderCreation();
        return true;
    }

    function selectedDisciplines() {
        return Object.values(system().masteries)
            .filter((definition) => Number(draft.masteries[definition.id] || 0) > 0)
            .sort((a, b) => Number(draft.masteries[b.id] || 0) - Number(draft.masteries[a.id] || 0));
    }

    function starterSkills() {
        return Aethra.DisciplineSystem?.getStarterSkills?.(draft.masteries) || [];
    }

    function previewData() {
        const preview = system().previewAttributes(draft.attributes);
        return {
            ...preview,
            hit: Math.min(98, 85 + Number(preview.stats.precision || 0)),
            crit: Number(preview.stats.critical || 0) * 100,
            evade: Number(preview.stats.evasion || 0) * 100
        };
    }

    function renderProgress() {
        return STEP_META.map((step) => {
            const current = activeStep === step.id;
            const complete = step.id < activeStep && stepReady(step.id);
            const allowed = canVisit(step.id);
            return `
                <button type="button" class="creation-progress__step ${current ? "is-current" : ""} ${complete ? "is-complete" : ""}"
                    data-creation-step="${step.id}" ${allowed ? "" : "disabled"} aria-current="${current ? "step" : "false"}">
                    <span>${complete ? "✓" : step.id}</span><small>ETAPA ${step.id}</small><strong>${step.label}</strong>
                </button>`;
        }).join("");
    }

    function renderHeroPreview() {
        const selected = archetype();
        const preview = previewData();
        const starterItem = selected ? (Aethra.GameData?.items?.[selected.starterItemId] || {}) : null;
        const avatarTooltip = starterItem 
            ? `data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-eyebrow="EQUIPAMENTO INICIAL" data-tooltip-title="${esc(starterItem.name)}" data-tooltip-body="${esc(starterItem.description || '')} Dano: ${starterItem.damageMin}-${starterItem.damageMax}."`
            : "";
        return `
            <aside class="creation-hero-preview">
                <div class="creation-hero-preview__identity">
                    <small>SEU PERSONAGEM</small>
                    <label><span>Nome</span><input type="text" maxlength="18" value="${esc(draft.name)}" data-character-name autocomplete="off" spellcheck="false"></label>
                </div>
                <div class="creation-avatar ${selected ? "has-archetype" : ""}" ${avatarTooltip}>
                    <i></i><i></i><i></i>
                    <div class="creation-avatar__sigil" data-sigil="${esc(selected?.id || "")}">${esc(selected?.icon || "A")}</div>
                    <img src="assets/entities/player_idle.png" alt="Prévia do herói" draggable="false">
                    <span>${esc(selected?.name || "Sem arquétipo")}</span>
                </div>
                <div class="creation-hero-preview__role">
                    <small>IDENTIDADE DA BUILD</small>
                    <strong data-creation-hero-name>${esc(draft.name || "Novo Herói")}</strong>
                    <p>${esc(selected?.title || "Escolha uma origem para revelar sua função.")}</p>
                </div>
                <div class="creation-vitals">
                    <span class="is-hp" data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-eyebrow="RECURSO VITAL" data-tooltip-title="Vida Máxima (HP)" data-tooltip-body="Sua reserva de sobrevivência. Se cair a zero durante uma caçada, você será derrotado, perderá ouro e XP, e retornará para a cidade."><small>HP</small><i><b style="width:${Math.min(100, preview.stats.maxHp)}%"></b></i><strong>${fmt(preview.stats.maxHp)}</strong></span>
                    <span class="is-mana" data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-eyebrow="RECURSO MÁGICO" data-tooltip-title="Mana Máxima (MP)" data-tooltip-body="Consumido para conjurar magias de ataque elementais (Fogo, Gelo, Trevas) e habilidades de suporte/cura."><small>MP</small><i><b style="width:${Math.min(100, preview.stats.maxMana)}%"></b></i><strong>${fmt(preview.stats.maxMana)}</strong></span>
                    <span class="is-vigor" data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-eyebrow="RECURSO FÍSICO" data-tooltip-title="Vigor Máximo (VIG)" data-tooltip-body="Consumido para deferir golpes físicos e manter posturas corporais de combate."><small>VIG</small><i><b style="width:${Math.min(100, preview.stats.maxEnergy)}%"></b></i><strong>${fmt(preview.stats.maxEnergy)}</strong></span>
                </div>
                <div class="creation-combat-stats">
                    <header><small>ATRIBUTOS DE COMBATE</small></header>
                    <div class="creation-vitals">
                        <span class="is-atk" data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-eyebrow="ATRIBUTO DE COMBATE" data-tooltip-title="Ataque (ATK)" data-tooltip-body="Faixa de dano físico e mágico base causado pelo herói com a arma inicial selecionada."><small>ATK</small><i><b style="width:${Math.min(100, (preview.stats.damage / 10) * 100)}%"></b></i><strong>${fmt(preview.stats.damageMin)}–${fmt(preview.stats.damageMax)}</strong></span>
                        <span class="is-def" data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-eyebrow="ATRIBUTO DE COMBATE" data-tooltip-title="Defesa (DEF)" data-tooltip-body="Reduz diretamente o dano físico sofrido de ataques e habilidades inimigas antes da aplicação de bloqueios."><small>DEF</small><i><b style="width:${Math.min(100, (preview.stats.defense / 10) * 100)}%"></b></i><strong>${fmt(preview.stats.defense)}</strong></span>
                        <span class="is-crit" data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-eyebrow="ATRIBUTO DE COMBATE" data-tooltip-title="Chance de Crítico (CRT)" data-tooltip-body="Chance de causar dano crítico aumentado (175% do dano normal)."><small>CRT</small><i><b style="width:${Math.min(100, (preview.crit / 10) * 100)}%"></b></i><strong>${preview.crit.toFixed(1)}%</strong></span>
                        <span class="is-esq" data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-eyebrow="ATRIBUTO DE COMBATE" data-tooltip-title="Esquiva (ESQ)" data-tooltip-body="Chance de evitar totalmente qualquer ataque direcionado ao seu herói, sem receber dano."><small>ESQ</small><i><b style="width:${Math.min(100, (preview.evade / 10) * 100)}%"></b></i><strong>${preview.evade.toFixed(1)}%</strong></span>
                        <span class="is-act" data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-eyebrow="ATRIBUTO DE COMBATE" data-tooltip-title="Precisão (ACT)" data-tooltip-body="Sua chance base de acertar golpes físicos ou mágicos antes de ser reduzida pela esquiva do alvo."><small>ACT</small><i><b style="width:${preview.hit}%"></b></i><strong>${preview.hit.toFixed(0)}%</strong></span>
                    </div>
                </div>
                <div class="creation-death-rule" data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-eyebrow="REGRA DE DERROTA" data-tooltip-title="A Morte Deixa Marcas" data-tooltip-body="Se a vida cair a zero durante uma caçada, você ressucita na cidade perdendo 10% de ouro e 10% de XP."><span>☠</span><p><strong>A morte deixa marcas</strong><small>Derrota: −10% XP do nível, −10% Gold e retorno à cidade.</small></p></div>
            </aside>`;
    }

    function archetypeCard(entry) {
        const selected = draft.archetypeId === entry.id;
        const mainDiscipline = Object.entries(entry.masteries)
            .sort((a, b) => Number(b[1]) - Number(a[1]))
            .map(([id]) => system().masteries[id])
            .find(Boolean);
        const starterItem = Aethra.GameData?.items?.[entry.starterItemId] || {};
        const meta = ARCHETYPE_META[entry.id] || {};
        const skill = Aethra.SkillSystem?.getSkill?.(meta.starterSkillId) || {};
        
        const weaponDmg = `${starterItem.damageMin}–${starterItem.damageMax}`;
        const weaponExtra = starterItem.mag ? `, +${starterItem.mag} Magia` : "";
        const weaponName = starterItem.name || "Nenhuma";
        const weaponIcon = entry.id === "vanguard" ? "⚔️" : entry.id === "berserker" ? "🪓" : entry.id === "arcanist" ? "✦" : entry.id === "ranger" ? "➶" : "☾";

        const tooltipBodyHtml = `
            <div class="creation-tooltip">
                <p class="creation-tooltip__desc">${esc(entry.description)}</p>
                <div class="creation-tooltip__section">
                    <small>EQUIPAMENTO INICIAL</small>
                    <div class="creation-tooltip__item">
                        <span>${esc(weaponIcon)}</span>
                        <strong>${esc(weaponName)}</strong>
                        <em>Dano: ${esc(weaponDmg)}${esc(weaponExtra)}</em>
                    </div>
                </div>
                <div class="creation-tooltip__section">
                    <small>DISTRIBUIÇÃO DE MAESTRIAS</small>
                    <div class="creation-tooltip__masteries">
                        ${Object.entries(entry.masteries)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3)
                            .map(([id, val]) => {
                                const mastery = system().masteries[id];
                                return `<span>${esc(mastery?.icon || "✦")} ${esc(mastery?.name || id)} +${val}</span>`;
                            }).join("")}
                    </div>
                </div>
                <div class="creation-tooltip__section">
                    <small>PROCS E PASSIVAS DE COMBATE</small>
                    <div class="creation-tooltip__proc">
                        <strong>✨ ${esc(mainDiscipline?.procName || "Aprimoramento")}</strong>
                        <p>${esc(mainDiscipline?.role || "Evolução livre por uso de habilidades no combate.")}</p>
                    </div>
                </div>
            </div>
        `;

        return `
            <button type="button" class="creation-archetype ${selected ? "is-selected" : ""}" data-select-archetype="${esc(entry.id)}" style="--archetype-accent:${esc(entry.accent)}"
                data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-html="true" data-tooltip-eyebrow="ORIGEM DISPONÍVEL" data-tooltip-title="${esc(entry.name)} · ${esc(entry.title)}" data-tooltip-body="${esc(tooltipBodyHtml)}">
                <span class="creation-archetype__icon">${esc(entry.icon)}</span>
                <small>${esc(entry.title)}</small>
                <strong>${esc(entry.name)}</strong>
                <p>${esc(entry.description)}</p>

                <div class="creation-archetype__specs">
                    <span><b>Foco:</b> ${esc(meta.focus)}</span>
                    <span><b>Dif.:</b> ${esc(meta.difficulty)}</span>
                    <span><b>Destaque:</b> ${esc(meta.highlight)}</span>
                </div>

                <div class="creation-archetype__dna">
                    ${Object.entries(entry.masteries)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([id, val]) => {
                            const mastery = system().masteries[id];
                            return `<span><b data-mastery="${esc(id)}">${esc(mastery?.icon || "✦")}</b> ${esc(mastery?.name || id)} +${val}</span>`;
                        }).join("")}
                </div>

                <div class="creation-archetype__skill-row" data-ui-tooltip="true" data-tooltip-kind="skill" data-skill-id="${esc(meta.starterSkillId)}">
                    <small>TÉCNICA INICIAL</small>
                    <div>
                        <b data-skill-id="${esc(meta.starterSkillId)}">${esc(skill.icon || "✦")}</b>
                        <strong>${esc(skill.name || meta.starterSkillId)}</strong>
                    </div>
                </div>

                <div class="creation-archetype__tags">${entry.tags.map((tag) => `<em>${esc(tag)}</em>`).join("")}</div>
                <footer><span>${selected ? "ARQUÉTIPO ESCOLHIDO" : "ESCOLHER ARQUÉTIPO"}</span><b>${esc(getStarterWeaponBonus(entry))}</b></footer>
            </button>`;
    }

    function renderOriginStep() {
        return `
            <section class="creation-step-content creation-step-content--origin">
                <header class="creation-step-heading"><div><small>ESCOLHA DE ARQUÉTIPO</small><h2>Qual fantasia você quer viver?</h2><p>É um ponto de partida completo com arma, técnicas e atributos. Depois, qualquer disciplina pode ser aprendida pelo uso.</p></div><span>5 ORIGENS</span></header>
                <div class="creation-archetype-grid">${Object.values(system().archetypes).map(archetypeCard).join("")}</div>
                <div class="creation-freedom-note"><span>↗</span><p><strong>Sem classes rígidas</strong><small>Um Berserker pode aprender Gelo; um Arcanista pode equipar uma espada. O que você usa é o que evolui.</small></p></div>
            </section>`;
    }

    function attributeCard(definition) {
        const value = Number(draft.attributes[definition.id] || 0);
        const pips = Array.from({ length: system().maxInitialAttribute }, (_, index) => `<i class="${index < value ? "is-filled" : ""}"></i>`).join("");
        return `
            <article class="creation-attribute ${value > 0 ? "is-invested" : ""}" data-creation-attribute-card="${esc(definition.id)}"
                data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-eyebrow="ATRIBUTO BÁSICO" data-tooltip-title="${esc(definition.name)} (${esc(definition.short)})" data-tooltip-body="${esc(definition.description)} Benefício por ponto: ${esc(definition.perPoint)}">
                <span class="creation-attribute__icon">${esc(definition.icon)}</span>
                <div class="creation-attribute__copy"><header><strong>${esc(definition.name)}</strong><em>${esc(definition.short)}</em></header><p>${esc(definition.description)}</p><small>${esc(definition.perPoint)}</small><div class="creation-pips">${pips}</div></div>
                <div class="creation-stepper"><button type="button" data-creation-adjust="attribute" data-id="${esc(definition.id)}" data-delta="-1" aria-label="Remover ponto de ${esc(definition.name)}">−</button><b>${value}</b><button type="button" data-creation-adjust="attribute" data-id="${esc(definition.id)}" data-delta="1" aria-label="Adicionar ponto de ${esc(definition.name)}">+</button></div>
            </article>`;
    }

    function renderAttributeStep() {
        const remaining = points().attributes;
        const preview = previewData();
        return `
            <section class="creation-step-content creation-step-content--attributes">
                <header class="creation-step-heading"><div><small>DISTRIBUIÇÃO DE ATRIBUTOS</small><h2>Construa os seus números</h2><p>O arquétipo trouxe uma sugestão pronta. Ajuste se quiser especializar ou assumir mais risco.</p></div><span class="creation-point-orb ${remaining === 0 ? "is-complete" : ""}"><b>${remaining}</b><small>PONTOS</small></span></header>
                <div class="creation-attribute-grid">${Object.values(system().attributes).map(attributeCard).join("")}</div>
                <div class="creation-stat-delta">
                    <span><small>Dano base</small><strong>${fmt(preview.stats.damageMin)}–${fmt(preview.stats.damageMax)}</strong></span>
                    <span><small>Acerto</small><strong>${fmt(preview.hit)}%</strong></span>
                    <span><small>Crítico</small><strong>${fmt(preview.crit)}%</strong></span>
                    <span><small>Esquiva</small><strong>${fmt(preview.evade)}%</strong></span>
                    <button type="button" data-reset-build>Restaurar arquétipo</button>
                </div>
            </section>`;
    }

    function disciplineCard(definition, mode = "creation") {
        const runtime = Aethra.DisciplineSystem?.getState?.(definition.id);
        const value = mode === "creation"
            ? Number(draft.masteries[definition.id] || 0)
            : Number(Aethra.GameState.hero?.masteryInvestment?.[definition.id] || runtime?.invested || 0);
        const available = Number(Aethra.GameState.hero?.skillPoints || 0) > 0;
        const proc = Number(definition.procChance || 0) > 0
            ? `${Math.round(Number(definition.procChance) * 100)}% · ${definition.procName}`
            : definition.professionId ? "Evolui em ações do mundo" : "Especialização passiva";
        return `
            <article class="creation-discipline ${value > 0 ? "is-invested" : ""}" data-discipline-group="${esc(definition.group)}"
                data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-html="true" data-tooltip-eyebrow="DISCIPLINA DISPONÍVEL" data-tooltip-title="${esc(definition.name)} (${esc(definition.category)})" data-tooltip-body="${esc(definition.description)}<br><br><b>Efeito por nível:</b> ${esc(definition.benefit)}<br><b>Especialização:</b> ${esc(proc)}">
                <span class="creation-discipline__icon" data-discipline-id="${esc(definition.id)}">${esc(definition.icon)}</span>
                <div class="creation-discipline__copy">
                    <small>${esc(definition.category)} · ${esc(definition.role)}</small>
                    <strong>${esc(definition.name)}</strong>
                    <p>${esc(definition.description)}</p>
                    <span class="creation-discipline__benefit">Bônus: ${esc(definition.benefit)}</span>
                    <em>${esc(proc)}</em>
                </div>
                ${mode === "creation" ? `<div class="creation-stepper"><button type="button" data-creation-adjust="mastery" data-id="${esc(definition.id)}" data-delta="-1">−</button><b>${value}</b><button type="button" data-creation-adjust="mastery" data-id="${esc(definition.id)}" data-delta="1">+</button></div>` : `<div class="creation-discipline__runtime"><small>NV. ${fmt(runtime?.level || 1)}</small><i><b style="width:${fmt(runtime?.progressPercent || 0)}%"></b></i><em>${fmt(runtime?.xpCurrent || 0)}/${fmt(runtime?.xpNext || 1)} XP</em></div><button type="button" class="creation-discipline__spend" data-spend-skill-point="${esc(definition.id)}" ${available ? "" : "disabled"}>+1</button>`}
            </article>`;
    }

    function renderDisciplineStep() {
        const remaining = points().masteries;
        const entries = Object.values(system().masteries).filter((entry) => entry.group === activeFilter);
        return `
            <section class="creation-step-content creation-step-content--disciplines">
                <header class="creation-step-heading"><div><small>MAESTRIA PELO USO</small><h2>Escolha suas primeiras disciplinas</h2><p>Pontos dão níveis imediatos. Durante o jogo, cada acerto, magia ou ação de mundo também concede XP à disciplina usada.</p></div><span class="creation-point-orb ${remaining === 0 ? "is-complete" : ""}"><b>${remaining}</b><small>PONTOS</small></span></header>
                <nav class="creation-discipline-tabs">${FILTERS.map((filter) => `<button type="button" data-discipline-filter="${filter.id}" class="${activeFilter === filter.id ? "is-active" : ""}"><span>${filter.icon}</span>${filter.label}<b>${Object.values(system().masteries).filter((entry) => entry.group === filter.id).length}</b></button>`).join("")}</nav>
                <div class="creation-discipline-grid">${entries.map((entry) => disciplineCard(entry)).join("")}</div>
                <div class="creation-use-xp"><span>∞</span><div><strong>Use para evoluir</strong><small>Espadas sobem com golpes de espada. Fogo sobe ao lançar Fogo. Ladinagem sobe ao superar fechaduras e armadilhas.</small></div><em>Pontos por nível continuam existindo como aceleração da build.</em></div>
            </section>`;
    }

    function renderStarterBar() {
        return starterSkills().map((skillId, index) => {
            const skill = Aethra.SkillSystem?.getSkill?.(skillId) || {};
            return `<span data-ui-tooltip="true" data-tooltip-kind="skill" data-skill-id="${esc(skillId)}"><small>${index + 1}</small><b>${esc(skill.icon || "+")}</b><em>${esc(skill.name || skillId)}</em></span>`;
        }).join("");
    }

    function renderReviewStep() {
        const selected = archetype();
        const preview = previewData();
        const disciplines = selectedDisciplines();
        return `
            <section class="creation-step-content creation-step-content--review">
                <header class="creation-step-heading"><div><small>RESUMO DA JORNADA</small><h2>${esc(draft.name)}, ${esc(selected?.name || "Aventureiro")}</h2><p>Esta é a sua abertura. Equipamentos, decisões e disciplinas usadas poderão transformar completamente a build.</p></div><span class="creation-ready-seal">PRONTO</span></header>
                <div class="creation-review-grid">
                    <article class="creation-review-card creation-review-card--origin" data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-eyebrow="RESUMO DA CLASSE" data-tooltip-title="${esc(selected?.name)}" data-tooltip-body="${esc(selected?.description)}"><small>ARQUÉTIPO</small><span>${esc(selected?.icon || "A")}</span><div><strong>${esc(selected?.name || "—")}</strong><p>${esc(selected?.description || "")}</p><div>${selected?.tags?.map((tag) => `<em>${esc(tag)}</em>`).join("") || ""}</div></div></article>
                    <article class="creation-review-card creation-review-card--stats" data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-eyebrow="RESUMO DE COMBATE" data-tooltip-title="Atributos de Combate" data-tooltip-body="Os atributos calculados que seu personagem usará em batalha (HP, MP, Vigor e modificadores)."><small>ATRIBUTOS FINAIS</small><div><span><b>${fmt(preview.stats.maxHp)}</b><em>HP</em></span><span><b>${fmt(preview.stats.maxMana)}</b><em>Mana</em></span><span><b>${fmt(preview.stats.maxEnergy)}</b><em>Vigor</em></span><span><b>${fmt(preview.hit)}%</b><em>Acerto</em></span><span><b>${fmt(preview.crit)}%</b><em>Crítico</em></span><span><b>${fmt(preview.evade)}%</b><em>Esquiva</em></span></div></article>
                    <article class="creation-review-card creation-review-card--disciplines" data-ui-tooltip="true" data-tooltip-kind="hud" data-tooltip-eyebrow="RESUMO DE DISCIPLINAS" data-tooltip-title="Suas Disciplinas Iniciais" data-tooltip-body="A distribuição inicial de maestria que impulsiona suas procs e passivas de combate."><small>DISCIPLINAS INICIAIS</small><div>${disciplines.map((entry) => `<span><b>${esc(entry.icon)}</b><p><strong>${esc(entry.name)}</strong><small>${esc(entry.role)}</small></p><em>+${fmt(draft.masteries[entry.id])}</em></span>`).join("")}</div></article>
                    <article class="creation-review-card creation-review-card--bar"><small>ACTIONBAR INICIAL</small><div>${renderStarterBar()}</div><p>As técnicas escolhidas entram prontas; novas combinações podem ocupar até quatro barras.</p></article>
                </div>
                <label class="creation-oath"><input type="checkbox" data-creation-oath ${draft.oath ? "checked" : ""}><span>✓</span><p><strong>Eu aceito que Aethra tem risco real.</strong><small>Posso errar ataques, falhar em eventos e morrer. A derrota custa XP e Ouro.</small></p></label>
            </section>`;
    }

    function renderStepContent() {
        if (activeStep === 1) return renderOriginStep();
        if (activeStep === 2) return renderAttributeStep();
        if (activeStep === 3) return renderDisciplineStep();
        return renderReviewStep();
    }

    function renderFooter() {
        const meta = STEP_META[activeStep - 1];
        const last = activeStep === STEP_META.length;
        const valid = stepReady(activeStep) && (!last || draft.oath === true);
        return `
            <footer class="character-creation__footer">
                <button type="button" class="creation-nav-button is-back" data-creation-back ${activeStep === 1 ? "disabled" : ""}>← <span>Voltar</span></button>
                <div><small>ETAPA ${activeStep} DE ${STEP_META.length}</small><strong>${esc(meta.label)}</strong><i><b style="width:${(activeStep / STEP_META.length) * 100}%"></b></i></div>
                ${last
                    ? `<button type="button" class="creation-nav-button is-primary" data-create-character ${valid ? "" : "disabled"}>Entrar em Aethra <span>→</span></button>`
                    : `<button type="button" class="creation-nav-button is-primary" data-creation-next ${valid ? "" : "disabled"}>Continuar <span>→</span></button>`}
            </footer>`;
    }

    function renderCreation() {
        activeMode = "creation";
        draft = draft || initialDraft();
        const selected = archetype();
        const meta = STEP_META[activeStep - 1];
        const layer = ensureLayer();
        layer.innerHTML = `
            <div class="character-creation-backdrop"><i></i><i></i><i></i></div>
            <main class="character-creation" role="dialog" aria-modal="true" aria-labelledby="character-creation-title" data-creation-active-step="${activeStep}" style="--creation-accent:${esc(selected?.accent || "#d9b85f")}">
                <header class="character-creation__header">
                    <div class="creation-brand"><span>A</span><p><small>CRÔNICAS DE AETHRA</small><strong id="character-creation-title">Forje seu herói</strong></p></div>
                    <nav class="creation-progress" aria-label="Etapas da criação">${renderProgress()}</nav>
                    <button type="button" class="creation-reset" data-reset-creation title="Recomeçar criação">↻ <span>Recomeçar</span></button>
                </header>
                <div class="character-creation__body">
                    ${renderHeroPreview()}
                    <section class="creation-workspace"><div class="creation-workspace__ambient"><i></i><i></i></div><header class="creation-workspace__mobile-title"><small>ETAPA ${activeStep}</small><strong>${esc(meta.title)}</strong><p>${esc(meta.copy)}</p></header>${renderStepContent()}</section>
                </div>
                ${renderFooter()}
            </main>`;
        document.body.classList.add("is-creating-character");
    }

    function renderSkillAllocation() {
        activeMode = "skills";
        const layer = ensureLayer();
        const hero = Aethra.GameState.hero || {};
        const disciplines = Object.values(system().masteries);
        layer.innerHTML = `
            <div class="character-creation-backdrop" data-close-skill-allocation><i></i><i></i></div>
            <main class="skill-allocation" role="dialog" aria-modal="true" aria-labelledby="skill-allocation-title">
                <header><div><small>PROGRESSÃO PERMANENTE</small><h2 id="skill-allocation-title">Acelerar uma disciplina</h2><p>O uso concede XP naturalmente; pontos de nível permitem especialização imediata.</p></div><button type="button" data-close-skill-allocation aria-label="Fechar">×</button></header>
                <div class="skill-allocation__balance"><span>PONTOS DISPONÍVEIS</span><strong>${fmt(hero.skillPoints)}</strong><small>+1 a cada nível do herói</small></div>
                <div class="skill-allocation__grid">${disciplines.map((entry) => disciplineCard(entry, "allocation")).join("")}</div>
                <footer><p>As disciplinas também continuam evoluindo enquanto você joga.</p><button type="button" data-close-skill-allocation>Concluir</button></footer>
            </main>`;
        document.body.classList.add("is-allocating-skills");
    }

    function closeLayer() {
        ensureLayer().replaceChildren();
        document.body.classList.remove("is-creating-character", "is-allocating-skills");
        activeMode = null;
    }

    function adjust(kind, id, delta) {
        if (!draft) return;
        const bucket = kind === "attribute" ? draft.attributes : draft.masteries;
        if (!(id in bucket)) return;
        const totalLimit = kind === "attribute" ? system().attributePoints : system().initialSkillPoints;
        const perItemLimit = kind === "attribute" ? system().maxInitialAttribute : system().maxInitialMastery;
        const current = Number(bucket[id] || 0);
        const next = Math.max(0, Math.min(perItemLimit, current + Number(delta || 0)));
        if (next > current && sum(bucket) >= totalLimit) return;
        bucket[id] = next;
        renderCreation();
    }

    function createCharacter() {
        const result = system().createCharacter(draft);
        if (!result.valid) {
            activeStep = result.errors.some((error) => error.includes("atributo")) ? 2 : result.errors.some((error) => error.includes("skill")) ? 3 : 1;
            renderCreation();
            return false;
        }
        closeLayer();
        Aethra.UIManager?.setPrimaryView?.("city", { source: "character-created" });
        Aethra.RenderEngine?.renderAll?.();
        return true;
    }

    function showDeathRecap(payload = {}) {
        document.querySelector(".death-recap")?.remove();
        const recap = document.createElement("aside");
        recap.className = "death-recap";
        recap.innerHTML = `<span>☠</span><div><small>VOCÊ FOI DERROTADO</small><strong>Retorno à cidade</strong><p>Perdas: ${fmt(payload.xpLost)} XP e ${fmt(payload.goldLost ?? payload.penalty)} G.</p></div><button type="button" aria-label="Fechar">×</button>`;
        recap.querySelector("button")?.addEventListener("click", () => recap.remove());
        document.body.appendChild(recap);
        window.setTimeout(() => recap.remove(), 8000);
    }

    document.addEventListener("click", (event) => {
        const adjustButton = event.target.closest("[data-creation-adjust]");
        if (adjustButton) return adjust(adjustButton.dataset.creationAdjust, adjustButton.dataset.id, adjustButton.dataset.delta);

        const archetypeButton = event.target.closest("[data-select-archetype]");
        if (archetypeButton) return selectArchetype(archetypeButton.dataset.selectArchetype);

        const stepButton = event.target.closest("[data-creation-step]");
        if (stepButton && canVisit(Number(stepButton.dataset.creationStep))) {
            activeStep = Number(stepButton.dataset.creationStep);
            renderCreation();
            return;
        }

        const filter = event.target.closest("[data-discipline-filter]");
        if (filter) {
            activeFilter = filter.dataset.disciplineFilter;
            renderCreation();
            return;
        }

        if (event.target.closest("[data-creation-next]") && stepReady(activeStep)) {
            activeStep = Math.min(STEP_META.length, activeStep + 1);
            renderCreation();
            return;
        }
        if (event.target.closest("[data-creation-back]")) {
            activeStep = Math.max(1, activeStep - 1);
            renderCreation();
            return;
        }
        if (event.target.closest("[data-reset-build]") && archetype()) {
            selectArchetype(draft.archetypeId);
            return;
        }
        if (event.target.closest("[data-reset-creation]")) {
            draft = initialDraft();
            activeStep = 1;
            activeFilter = "weapons";
            renderCreation();
            return;
        }
        if (event.target.closest("[data-create-character]")) return createCharacter();
        if (event.target.closest("[data-open-skill-allocation]")) return renderSkillAllocation();
        if (event.target.closest("[data-close-skill-allocation]")) return closeLayer();

        const spend = event.target.closest("[data-spend-skill-point]");
        if (spend && system().allocateSkillPoint(spend.dataset.spendSkillPoint)) {
            renderSkillAllocation();
            Aethra.PlayerHudWorkspace?.renderSkills?.();
        }
    });

    document.addEventListener("input", (event) => {
        if (!event.target.matches("[data-character-name]")) return;
        draft.name = event.target.value;
        document.querySelectorAll("[data-creation-hero-name]").forEach((node) => { node.textContent = draft.name || "Novo Herói"; });
        const next = document.querySelector("[data-creation-next]");
        if (next && activeStep === 1) next.disabled = !stepReady(1);
    });

    document.addEventListener("change", (event) => {
        if (!event.target.matches("[data-creation-oath]")) return;
        draft.oath = event.target.checked;
        const create = document.querySelector("[data-create-character]");
        if (create) create.disabled = !draft.oath || !stepReady(4);
    });

    function maybeShowCreation() {
        if (window.AETHRA_INTEGRATION_TEST === true) return;
        if (!system()?.ensureState) return;
        if (!Aethra.GameState.hero?.characterCreated) renderCreation();
    }

    Aethra.EventBus.on("EngineReady", maybeShowCreation);
    Aethra.EventBus.on("engine:ready", maybeShowCreation);
    Aethra.EventBus.on("save:reset", () => window.setTimeout(maybeShowCreation, 0));
    Aethra.EventBus.on("battle:player-defeated", showDeathRecap);

    Aethra.CharacterCreationUI = {
        show: renderCreation,
        showSkillAllocation: renderSkillAllocation,
        close: closeLayer,
        getDraft: () => draft ? clone(draft) : null,
        get mode() { return activeMode; },
        get step() { return activeStep; }
    };
})(window.Aethra);
