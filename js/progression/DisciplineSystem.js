// DisciplineSystem.js - maestrias específicas que evoluem pelo uso.
(function initDisciplineSystem(Aethra) {
    "use strict";

    if (!Aethra?.GameState || !Aethra?.EventBus) {
        throw new Error("DisciplineSystem.js requer game-core.js.");
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const integer = (value, fallback = 0) => Math.max(0, Math.floor(number(value, fallback)));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const DEFINITIONS = Object.freeze({
        sword: {
            id: "sword", name: "Espadas", icon: "⚔", group: "weapons", category: "Armas",
            role: "Equilíbrio e precisão", description: "Golpes consistentes, mais acerto e chance de Lâmina Precisa.",
            benefit: "+2% de dano com espadas por nível.", procName: "Lâmina Precisa", procChance: 0.14,
            hitBonus: 0.03, procMultiplier: 1.25, starterSkill: "precise_strike", skillIds: ["precise_strike"]
        },
        axe: {
            id: "axe", name: "Machados", icon: "🪓", group: "weapons", category: "Armas",
            role: "Alto risco e impacto", description: "Menos precisão, mas golpes selvagens com multiplicador elevado.",
            benefit: "+2% de dano com machados por nível.", procName: "Golpe Selvagem", procChance: 0.18,
            hitBonus: -0.04, procMultiplier: 1.55, starterSkill: "brutal_cleave", skillIds: ["brutal_cleave"]
        },
        mace: {
            id: "mace", name: "Maças e Clavas", icon: "◆", group: "weapons", category: "Armas",
            role: "Quebra-armadura", description: "Perfura parte da Defesa e pode causar Impacto Esmagador.",
            benefit: "+2% de dano com maças por nível.", procName: "Impacto Esmagador", procChance: 0.18,
            armorPenetration: 0.55, procMultiplier: 1.28, starterSkill: "armor_breaker", skillIds: ["armor_breaker"]
        },
        dagger: {
            id: "dagger", name: "Adagas", icon: "†", group: "weapons", category: "Armas",
            role: "Velocidade e sangramento", description: "Mais acerto e chance de um segundo corte na mesma abertura.",
            benefit: "+2% de dano com adagas por nível.", procName: "Corte Duplo", procChance: 0.22,
            hitBonus: 0.04, procMultiplier: 1.35, starterSkill: "twin_fang", skillIds: ["twin_fang"]
        },
        bow: {
            id: "bow", name: "Arcos", icon: "➶", group: "weapons", category: "Armas",
            role: "Precisão e crítico", description: "Maior chance de acerto e de atingir um Ponto Vital.",
            benefit: "+2% de dano com arcos por nível.", procName: "Ponto Vital", procChance: 0.13,
            hitBonus: 0.06, criticalBonus: 0.05, procMultiplier: 1.42, starterSkill: "aimed_shot", skillIds: ["aimed_shot"]
        },
        unarmed: {
            id: "unarmed", name: "Desarmado", icon: "✊", group: "weapons", category: "Armas",
            role: "Improviso e contra-ataque", description: "Transforma mãos vazias em uma escolha real de combate.",
            benefit: "+2% de dano desarmado por nível.", procName: "Contra-golpe", procChance: 0.12,
            hitBonus: 0.02, procMultiplier: 1.25, starterSkill: "heavy_strike", skillIds: ["heavy_strike"]
        },
        fire: {
            id: "fire", name: "Fogo", icon: "🔥", group: "arcana", category: "Arcana",
            role: "Explosão e queimadura", description: "Dano volátil com chance de Combustão causar uma explosão adicional.",
            benefit: "+2% de poder de Fogo por nível.", procName: "Combustão", procChance: 0.22,
            procMultiplier: 1.32, starterSkill: "fire_bolt", skillIds: ["fire_bolt"]
        },
        ice: {
            id: "ice", name: "Gelo", icon: "❄", group: "arcana", category: "Arcana",
            role: "Controle e proteção", description: "Magia estável que pode reduzir o dano da próxima ação inimiga.",
            benefit: "+2% de poder de Gelo por nível.", procName: "Congelamento", procChance: 0.20,
            hitBonus: 0.02, procMultiplier: 1.16, enemyDamageModifier: 0.72, starterSkill: "ice_shard", skillIds: ["ice_shard"]
        },
        shadow: {
            id: "shadow", name: "Trevas", icon: "☾", group: "arcana", category: "Arcana",
            role: "Execução e roubo de vida", description: "Poder instável que pode drenar parte do dano causado como HP.",
            benefit: "+2% de poder das Trevas por nível.", procName: "Dreno Sombrio", procChance: 0.18,
            hitBonus: -0.02, procMultiplier: 1.45, leechRate: 0.28, starterSkill: "shadow_bolt", skillIds: ["shadow_bolt"]
        },
        restoration: {
            id: "restoration", name: "Restauração", icon: "✚", group: "arcana", category: "Arcana",
            role: "Cura e sustentação", description: "Aumenta a cura e reduz a dependência de consumíveis.",
            benefit: "+2% de cura por nível.", procName: "Cura Plena", procChance: 0.12,
            procMultiplier: 1.2, starterSkill: "heal", skillIds: ["heal"]
        },
        shield: {
            id: "shield", name: "Escudos", icon: "⬡", group: "defense", category: "Defesa",
            role: "Bloqueio reativo", description: "Melhora posturas e abre espaço para bloqueios decisivos.",
            benefit: "+1% de bloqueio por nível investido.", starterSkill: "guard", skillIds: ["guard"]
        },
        cloth_armor: {
            id: "cloth_armor", name: "Armadura de Tecido", icon: "🥋", group: "defense", category: "Defesa",
            role: "Conjuradores e mana", description: "Especialização leve para quem foca em poder mágico.",
            benefit: "+1% Poder Mágico e +0.5% Mana Máxima por nível.", starterSkill: "guard", skillIds: ["guard"]
        },
        leather_armor: {
            id: "leather_armor", name: "Armadura de Couro", icon: "▧", group: "defense", category: "Defesa",
            role: "Agilidade e Evasão", description: "Especialização média voltada para precisão e esquiva de ataques.",
            benefit: "+0.5% Evasão e +0.2% Chance Crítica por nível.", starterSkill: "guard", skillIds: ["guard"]
        },
        plate_armor: {
            id: "plate_armor", name: "Armadura de Placa", icon: "♜", group: "defense", category: "Defesa",
            role: "Dano Físico e Mitigação", description: "Especialização pesada para absorver grandes impactos de dano.",
            benefit: "+1% eficiência de Defesa e +1% Vida Máxima por nível.", starterSkill: "guard", skillIds: ["guard"]
        },
        mining: {
            id: "mining", name: "Mineração", icon: "⛏", group: "world", category: "Coleta",
            role: "Minérios e gemas", description: "Evolui extraindo veios e recursos metálicos.", benefit: "Melhora rendimento e raridade.", professionId: "mining"
        },
        skinning: {
            id: "skinning", name: "Esfolamento", icon: "◒", group: "world", category: "Coleta",
            role: "Peles e ossos", description: "Evolui extraindo materiais de criaturas derrotadas.", benefit: "Melhora quantidade e qualidade.", professionId: "skinning"
        },
        herbalism: {
            id: "herbalism", name: "Herbalismo", icon: "❧", group: "world", category: "Coleta",
            role: "Ervas e reagentes", description: "Evolui encontrando e colhendo plantas.", benefit: "Aumenta descobertas raras.", professionId: "herbalism"
        },
        exploration: {
            id: "exploration", name: "Exploração", icon: "⌖", group: "world", category: "Mundo",
            role: "Eventos e segredos", description: "Evolui investigando caminhos e eventos da Hunt.", benefit: "Melhora frequência e qualidade de eventos.", professionId: "exploration"
        },
        survival: {
            id: "survival", name: "Sobrevivência", icon: "△", group: "world", category: "Mundo",
            role: "Recuperação e economia", description: "Evolui resistindo a riscos e caçadas longas.", benefit: "Reduz custos e melhora recuperação.", professionId: "survival"
        },
        blacksmithing: {
            id: "blacksmithing", name: "Forjaria", icon: "⚒", group: "world", category: "Criação",
            role: "Armas e reforços", description: "Evolui criando, refinando e reparando equipamentos.", benefit: "Melhora reforços e potencial.", professionId: "blacksmithing"
        },
        leatherworking: {
            id: "leatherworking", name: "Couraria", icon: "◈", group: "world", category: "Criação",
            role: "Couros e armaduras leves", description: "Evolui curtindo peles e criando equipamentos de couro.", benefit: "Melhora qualidade, rendimento e técnicas de couro.", professionId: "leatherworking"
        },
        thievery: {
            id: "thievery", name: "Ladinagem", icon: "⚿", group: "world", category: "Utilidade",
            role: "Fechaduras e armadilhas", description: "Evolui superando mecanismos, segredos e armadilhas.", benefit: "Aumenta sucesso e loot especial.", professionId: "thievery"
        }
    });

    function xpRequired(level) {
        return Aethra.XPSystem?.getSkillXPRequired?.(level)
            || Math.max(45, Math.round(45 + (20 * (Math.max(1, integer(level, 1)) ** 1.72))));
    }

    function inferByText(value = "") {
        const text = String(value).toLowerCase();
        if (/axe|machado|cleaver|cutelo/.test(text)) return "axe";
        if (/mace|maça|club|clava|hammer|martelo/.test(text)) return "mace";
        if (/dagger|adaga|faca|knife/.test(text)) return "dagger";
        if (/bow|arco|crossbow|besta/.test(text)) return "bow";
        if (/sword|espada|blade|lâmina/.test(text)) return "sword";
        if (/focus|foco|staff|cajado|wand|varinha/.test(text)) return "arcane_focus";
        return null;
    }

    Aethra.DisciplineSystem = {
        initialized: false,
        definitions: clone(DEFINITIONS),

        init() {
            this.ensureState();
            if (this.initialized) return this.getSnapshot();
            this.bindEvents();
            this.initialized = true;
            Aethra.EventBus.emit("disciplines:ready", this.getSnapshot());
            return this.getSnapshot();
        },

        ensureState(forceReset = false) {
            const hero = Aethra.GameState.hero || (Aethra.GameState.hero = {});
            if (forceReset || !hero.disciplines || typeof hero.disciplines !== "object" || Array.isArray(hero.disciplines)) {
                hero.disciplines = {};
            }
            Object.keys(DEFINITIONS).forEach((id) => {
                const current = hero.disciplines[id] || {};
                const level = Math.max(1, integer(current.level, 1) || 1);
                const xpNext = xpRequired(level);
                hero.disciplines[id] = {
                    level,
                    xpCurrent: clamp(integer(current.xpCurrent, 0), 0, xpNext - 1),
                    xpTotal: integer(current.xpTotal, 0),
                    xpNext,
                    uses: integer(current.uses, 0),
                    invested: integer(current.invested ?? hero.masteryInvestment?.[id], 0),
                    lastUsedAt: current.lastUsedAt || null,
                    trainingMode: current.trainingMode === "locked" ? "locked" : "training",
                    discovered: Boolean(current.discovered || current.uses > 0 || current.xpTotal > 0 || current.level > 1),
                    discoveredAt: current.discoveredAt || null
                };
            });
            return hero.disciplines;
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;
            Aethra.EventBus.on("primary-attack:used", (payload = {}) => {
                const id = this.resolveWeaponDiscipline(payload.weapon);
                this.addUseXP(id, 3, { source: "weapon-use", payload });
            });
            Aethra.EventBus.on("skill:used", (payload = {}) => {
                const id = this.resolveSkillDiscipline(payload.skillId, payload.skill);
                if (id) this.addUseXP(id, 4, { source: "skill-use", payload });
            });
            Aethra.EventBus.on("battle:damage-dealt", (payload = {}) => {
                if (payload.side === "creature" && payload.hit) {
                    if (payload.isBlocked) {
                        this.addUseXP("shield", 2, { source: "defense-block", payload });
                    }
                    const chestItem = Aethra.GameState.hero?.equipment?.chest;
                    if (chestItem) {
                        const armorType = this.resolveArmorType(chestItem);
                        if (armorType) {
                            this.addUseXP(armorType, 2, { source: "defense-hit", payload });
                        }
                    }
                }
            });
            Aethra.EventBus.on("game:reset", () => this.ensureState(true));
            Aethra.EventBus.on("save:loaded", () => this.ensureState());
        },

        resolveArmorType(item = null) {
            if (!item) return null;
            const template = Aethra.GameData?.items?.[item.templateId || item.id] || {};
            const armorType = item.armorType || template.armorType;
            if (armorType && ["cloth", "leather", "plate"].includes(armorType)) {
                return `${armorType}_armor`;
            }
            const name = String(item.name || template.name || "").toLowerCase();
            if (/tecido|cloth|mago|arcanista|arcanist|seda|linho|runico|focus|wand|staff/.test(name)) {
                return "cloth_armor";
            }
            if (/couro|leather|batedor|ranger|assassino|nightblade|adaga|veloz|skinning/.test(name)) {
                return "leather_armor";
            }
            if (/placa|plate|ferro|aco|vanguarda|berserker|heavy|pesado|elmo|peitoral|perneiras|guard|shield|escudo/.test(name)) {
                return "plate_armor";
            }
            return "plate_armor";
        },

        resolveWeaponDiscipline(weapon = null) {
            if (!weapon) return "unarmed";
            const template = Aethra.GameData?.items?.[weapon.templateId || weapon.id] || {};
            const explicit = weapon.weaponFamily || weapon.family || template.weaponFamily || template.family;
            const normalized = String(explicit || "").toLowerCase();
            if (DEFINITIONS[normalized]) return normalized;
            const inferred = inferByText(`${weapon.templateId || ""} ${weapon.id || ""} ${weapon.name || ""} ${template.name || ""}`);
            return inferred === "arcane_focus" ? "unarmed" : (inferred || "unarmed");
        },

        resolveSkillDiscipline(skillId, skill = null) {
            const definition = skill || Aethra.SkillSystem?.skills?.[skillId] || {};
            if (definition.disciplineId && DEFINITIONS[definition.disciplineId]) return definition.disciplineId;
            return Object.keys(DEFINITIONS).find((id) => DEFINITIONS[id].skillIds?.includes(skillId)) || null;
        },

        resolveAttackDiscipline(options = {}) {
            return options.disciplineId || this.resolveSkillDiscipline(options.skillId) || this.resolveWeaponDiscipline(options.weapon);
        },

        getState(id) {
            this.ensureState();
            const definition = DEFINITIONS[id];
            const state = Aethra.GameState.hero.disciplines?.[id];
            if (!definition || !state) return null;
            return { ...clone(definition), ...clone(state), progressPercent: Number(((state.xpCurrent / state.xpNext) * 100).toFixed(1)) };
        },

        getSnapshot() {
            this.ensureState();
            return Object.fromEntries(Object.keys(DEFINITIONS).map((id) => [id, this.getState(id)]));
        },

        getPowerMultiplier(id) {
            const level = this.getState(id)?.level || 1;
            const bonusPercent = Aethra.XPSystem?.getDiminishingSkillBonus?.(level, { scale: 12, interval: 10 })
                ?? (12 * Math.log1p(Math.max(0, level - 1) / 10));
            return Number((1 + (bonusPercent / 100)).toFixed(4));
        },

        getCombatProfile(id) {
            const definition = DEFINITIONS[id] || DEFINITIONS.unarmed;
            return {
                id: definition.id,
                name: definition.name,
                level: this.getState(definition.id)?.level || 1,
                powerMultiplier: this.getPowerMultiplier(definition.id),
                hitBonus: number(definition.hitBonus, 0),
                criticalBonus: number(definition.criticalBonus, 0),
                armorPenetration: clamp(number(definition.armorPenetration, 0), 0, 0.9),
                procName: definition.procName || null,
                procChance: clamp(number(definition.procChance, 0), 0, 0.75),
                procMultiplier: Math.max(1, number(definition.procMultiplier, 1)),
                leechRate: clamp(number(definition.leechRate, 0), 0, 1),
                enemyDamageModifier: clamp(number(definition.enemyDamageModifier, 1), 0.1, 1)
            };
        },

        rollCombatProc(id, randomSource = Math.random) {
            const profile = this.getCombatProfile(id);
            const roll = number(randomSource(), 1);
            const triggered = Boolean(profile.procName && roll <= profile.procChance);
            return {
                disciplineId: profile.id,
                disciplineName: profile.name,
                triggered,
                name: triggered ? profile.procName : null,
                chance: profile.procChance,
                roll,
                damageMultiplier: triggered ? profile.procMultiplier : 1,
                leechRate: triggered ? profile.leechRate : 0,
                enemyDamageModifier: triggered ? profile.enemyDamageModifier : 1
            };
        },

        investPoint(id, amount = 1) {
            if (!DEFINITIONS[id]) return false;
            const hero = Aethra.GameState.hero;
            this.ensureState();
            const points = Math.max(1, integer(amount, 1));
            const state = hero.disciplines[id];
            state.invested += points;
            hero.masteryInvestment = hero.masteryInvestment || {};
            hero.masteryInvestment[id] = state.invested;
            Aethra.EventBus.emit("discipline:invested", { id, amount: points, state: this.getState(id) });
            return this.getState(id);
        },

        addUseXP(id, amount, options = {}) {
            if (!DEFINITIONS[id]) return false;
            this.ensureState();
            return Aethra.XPSystem?.grantSkillXP?.(id, amount, {
                ...options,
                source: options.source || "use",
                difficulty: options.difficulty ?? Aethra.GameState.hero.disciplines[id].level
            }) || false;
        },

        setTrainingMode(id, mode, source = "discipline-ui") {
            if (!DEFINITIONS[id]) return false;
            return Aethra.XPSystem?.setSkillTrainingMode?.(id, mode, source) || false;
        },

        getDiminishingBonus(id, options = {}) {
            const level = this.getState(id)?.level || 1;
            return Aethra.XPSystem?.getDiminishingSkillBonus?.(level, options)
                ?? Number((12 * Math.log1p(Math.max(0, level - 1) / 10)).toFixed(3));
        },

        getStarterSkills(investments = {}) {
            const selected = Object.entries(investments)
                .filter(([id, value]) => number(value, 0) > 0 && DEFINITIONS[id]?.starterSkill)
                .sort((a, b) => number(b[1], 0) - number(a[1], 0))
                .map(([id]) => DEFINITIONS[id].starterSkill);
            return [...new Set([...selected, "heal", "guard"])].slice(0, 10);
        },

        configureStarterLoadout(investments = {}) {
            Aethra.SkillSystem?.ensureState?.(true);
            const hero = Aethra.GameState.hero;
            const bar = hero.actionBars?.[0];
            if (!bar) return false;
            bar.slots = Array(Math.max(10, bar.slots.length)).fill(null);
            this.getStarterSkills(investments).forEach((skillId, index) => {
                if (Aethra.SkillSystem.skills?.[skillId]) bar.slots[index] = skillId;
            });
            hero.activeActionBar = 0;
            Aethra.SkillSystem.emitActionBarChanged?.("starter-build");
            return clone(bar);
        }
    };
})(window.Aethra);
