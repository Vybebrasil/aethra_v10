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
    const FOCUS_SETTING_KEY = "progressionJournalFocus";

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

    const TRAINING_GUIDES = Object.freeze({
        shield: {
            where: "Em Hunts com um escudo equipado.",
            action: "Use Postura de Guarda e bloqueie ataques inimigos.",
            chain: ["Equipar escudo", "Entrar em uma Hunt", "Bloquear e usar Guarda"],
            destination: "hunt"
        },
        cloth_armor: {
            where: "Em combate usando um peitoral de tecido.",
            action: "Receba ataques com esse tipo de armadura equipado.",
            chain: ["Equipar tecido", "Entrar em uma Hunt", "Resistir a ataques"],
            destination: "hunt"
        },
        leather_armor: {
            where: "Em combate usando um peitoral de couro.",
            action: "Receba ataques e sobreviva com esse tipo de armadura equipado.",
            chain: ["Equipar couro", "Entrar em uma Hunt", "Resistir a ataques"],
            destination: "hunt"
        },
        plate_armor: {
            where: "Em combate usando um peitoral de placa.",
            action: "Receba ataques e bloqueie impactos com esse tipo de armadura.",
            chain: ["Equipar placa", "Entrar em uma Hunt", "Absorver impactos"],
            destination: "hunt"
        },
        mining: {
            where: "Em Hunts que tenham veios de minério.",
            action: "Ative a coleta, extraia os veios e leve o minério para a forja.",
            chain: ["Encontrar um veio", "Minerar", "Fundir e forjar"],
            destination: "hunt",
            policy: true,
            workshopProfessionId: "blacksmithing"
        },
        skinning: {
            where: "Em Hunts com criaturas que possam ser esfoladas.",
            action: "Ative a coleta, derrote a criatura e extraia sua pele.",
            chain: ["Caçar criatura", "Esfolar", "Curtir e costurar"],
            destination: "hunt",
            policy: true,
            workshopProfessionId: "leatherworking"
        },
        herbalism: {
            where: "Em Hunts com plantas e eventos de coleta.",
            action: "Ative a coleta e investigue recursos naturais encontrados no caminho.",
            chain: ["Explorar", "Colher ervas", "Guardar reagentes"],
            destination: "hunt",
            policy: true
        },
        exploration: {
            where: "No mapa das Hunts e durante expedições.",
            action: "Siga trilhas, investigue eventos e descubra segredos.",
            chain: ["Escolher região", "Explorar caminhos", "Resolver eventos"],
            destination: "hunt"
        },
        survival: {
            where: "Em Hunts longas, acampamentos e situações de risco.",
            action: "Sobreviva, recupere recursos e administre os suprimentos da expedição.",
            chain: ["Preparar supplies", "Resistir aos riscos", "Recuperar no acampamento"],
            destination: "hunt"
        },
        blacksmithing: {
            where: "Na Forja da Cidade.",
            action: "Funda minérios, crie equipamentos de metal e repare peças.",
            chain: ["Obter minério", "Fundir barras", "Forjar ou reparar"],
            destination: "workshop",
            workshopProfessionId: "blacksmithing"
        },
        leatherworking: {
            where: "No Curtume da Cidade.",
            action: "Curta peles, produza couro e confeccione equipamentos leves.",
            chain: ["Obter peles", "Curtir couro", "Costurar ou reparar"],
            destination: "workshop",
            workshopProfessionId: "leatherworking"
        },
        thievery: {
            where: "Em eventos com fechaduras, armadilhas e passagens secretas.",
            action: "Explore Hunts e tente superar mecanismos encontrados.",
            chain: ["Encontrar mecanismo", "Desarmar ou abrir", "Recolher recompensa"],
            destination: "hunt"
        }
    });

    function trainingGuide(id) {
        const definition = DEFINITIONS[id];
        if (!definition) return null;
        if (TRAINING_GUIDES[id]) return clone(TRAINING_GUIDES[id]);
        if (definition.group === "weapons") {
            return {
                where: `Em Hunts usando ${definition.name.toLowerCase()} como estilo de ataque.`,
                action: "Ataque com a arma correspondente e use suas técnicas na ActionBar.",
                chain: ["Equipar arma", "Entrar em uma Hunt", "Atacar e usar técnicas"],
                destination: "hunt"
            };
        }
        if (definition.group === "arcana") {
            return {
                where: `Em Hunts conjurando habilidades de ${definition.name}.`,
                action: "Equipe a técnica correspondente na ActionBar e use-a em combate.",
                chain: ["Equipar técnica", "Entrar em uma Hunt", "Conjurar em combate"],
                destination: "hunt"
            };
        }
        return {
            where: "Durante atividades relacionadas a esta habilidade.",
            action: definition.description,
            chain: ["Preparar", "Praticar", "Evoluir"],
            destination: "hunt"
        };
    }

    const TRAINING_EVENT_KEYS = Object.freeze({
        mining: ["mining"],
        herbalism: ["herb"],
        thievery: ["locked_chest", "secret_door", "trap"],
        exploration: ["trail", "shrine"],
        survival: ["camp"],
        blacksmithing: ["forge"]
    });

    function huntRecommendationScore(definition, disciplineId) {
        const discipline = DEFINITIONS[disciplineId];
        if (!definition || !discipline) return 0;
        const modifiers = definition.modifiers || {};
        const professionMultiplier = Math.max(0, number(modifiers.professionXp?.[disciplineId], 0));
        const exactFocus = definition.focus?.skill === disciplineId || definition.focus?.id === disciplineId;
        const eventScore = (TRAINING_EVENT_KEYS[disciplineId] || []).reduce((total, eventId) => {
            return total + Math.max(0, number(modifiers.eventWeights?.[eventId], 0));
        }, 0);
        const combatDiscipline = ["weapons", "arcana", "defense"].includes(discipline.group);
        return (exactFocus ? 120 : 0)
            + (professionMultiplier * 24)
            + (eventScore * 8)
            + (combatDiscipline ? Math.max(0, number(modifiers.combatXp, 1)) * 12 : 0);
    }

    function activityRecommendations(disciplineId, limit = 3) {
        if (!DEFINITIONS[disciplineId]) return [];
        const heroLevel = Math.max(1, integer(Aethra.GameState.hero?.level, 1) || 1);
        const definitions = Object.values(Aethra.HuntCatalog?.getDefinitions?.() || Aethra.HuntSystem?.hunts || {});
        const ranked = definitions
            .filter((definition) => definition?.id && !String(definition.id).startsWith("targeted__"))
            .map((definition) => {
                const score = huntRecommendationScore(definition, disciplineId);
                const minLevel = Math.max(1, integer(definition.minLevel, 1) || 1);
                const unlocked = heroLevel >= minLevel;
                return {
                    id: definition.id,
                    name: definition.name,
                    icon: definition.icon || definition.focus?.icon || "⌖",
                    region: definition.region || definition.biome || "Aethra",
                    biome: definition.biome || "Região de Hunt",
                    description: definition.description || "Atividade recomendada para esta skill.",
                    minLevel,
                    maxLevel: Math.max(minLevel, integer(definition.maxLevel, minLevel)),
                    unlocked,
                    mode: definition.mode === "specialized" ? "hunts" : "expeditions",
                    score: Number(score.toFixed(2)),
                    xpMultiplier: Math.max(0, number(definition.modifiers?.professionXp?.[disciplineId], 0)),
                    eventMultiplier: Math.max(...(TRAINING_EVENT_KEYS[disciplineId] || []).map((eventId) => number(definition.modifiers?.eventWeights?.[eventId], 0)), 0),
                    exactFocus: definition.focus?.skill === disciplineId || definition.focus?.id === disciplineId
                };
            })
            .filter((entry) => entry.score > 0);
        const unlocked = ranked.filter((entry) => entry.unlocked);
        const pool = unlocked.length > 0 ? unlocked : ranked;
        return pool
            .sort((a, b) => b.score - a.score || a.minLevel - b.minLevel || a.name.localeCompare(b.name, "pt-BR"))
            .slice(0, Math.max(1, integer(limit, 3) || 3))
            .map(clone);
    }

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
            Aethra.EventBus.on("quest:ready", () => {
                const focusId = this.getFocusId();
                if (!focusId) return;
                const trainingState = Aethra.ProfessionSystem?.getFocusTrainingState?.(focusId);
                if (trainingState?.active || trainingState?.completed) return;
                const recommendation = activityRecommendations(focusId, 1)[0] || null;
                Aethra.ProfessionSystem?.activateFocusTraining?.(focusId, {
                    huntId: recommendation?.id || null,
                    source: "discipline-focus-resume"
                });
            });
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

        getTrainingGuide(id) {
            return trainingGuide(id);
        },

        getFocusId() {
            const focusId = String(Aethra.SettingsManager?.get?.(FOCUS_SETTING_KEY, "") || "");
            return DEFINITIONS[focusId] ? focusId : null;
        },

        setFocus(id, source = "discipline-ui") {
            if (!DEFINITIONS[id]) return false;
            const previousId = this.getFocusId();
            Aethra.SettingsManager?.set?.(FOCUS_SETTING_KEY, id, { source });
            if (previousId && previousId !== id) {
                Aethra.ProfessionSystem?.pauseFocusTraining?.(previousId, "discipline-focus-changed");
            }
            const recommendation = activityRecommendations(id, 1)[0] || null;
            const focusTraining = Aethra.ProfessionSystem?.activateFocusTraining?.(id, {
                huntId: recommendation?.id || null,
                source
            }) || null;
            const payload = {
                id,
                disciplineId: id,
                previousId,
                changed: previousId !== id,
                source,
                state: this.getState(id),
                focusTraining,
                guidance: this.getFocusedGuidance(id)
            };
            Aethra.EventBus.emit("discipline:focus-changed", clone(payload));
            return clone(payload);
        },

        getActivityRecommendations(id, options = {}) {
            return activityRecommendations(id, options.limit || 3);
        },

        getFocusedGuidance(requestedId = null) {
            const id = DEFINITIONS[requestedId] ? requestedId : this.getFocusId();
            const skill = id ? this.getState(id) : null;
            if (!skill) return null;
            const guide = trainingGuide(id);
            const recommendation = activityRecommendations(id, 1)[0] || null;
            const focusTraining = Aethra.ProfessionSystem?.getFocusTrainingState?.(id) || null;
            const contractGuidance = focusTraining?.active ? focusTraining.guidance : null;
            const isWorkshop = contractGuidance
                ? contractGuidance.action === "open-workshop"
                : guide?.destination === "workshop";
            const contractHuntId = contractGuidance?.huntId || null;
            const contractHunt = contractHuntId
                ? (Aethra.HuntCatalog?.get?.(contractHuntId) || Aethra.HuntSystem?.hunts?.[contractHuntId])
                : null;
            const percent = clamp(number(skill.progressPercent), 0, 100);
            return {
                disciplineId: id,
                name: skill.name,
                icon: skill.icon || "✦",
                level: skill.level,
                xpCurrent: skill.xpCurrent,
                xpNext: skill.xpNext,
                percent,
                title: contractGuidance ? focusTraining.title : `Treinar ${skill.name}`,
                detail: contractGuidance?.detail || guide?.action || skill.description,
                chain: clone(guide?.chain || []),
                action: isWorkshop ? "open-workshop" : "open-skill-hunt",
                actionLabel: contractGuidance?.actionLabel || (isWorkshop
                    ? `Abrir ${id === "leatherworking" ? "Curtume" : "Forja"}`
                    : recommendation
                        ? `Ir para ${recommendation.name}`
                        : "Encontrar Hunt"),
                professionId: isWorkshop
                    ? (contractGuidance?.professionId || guide.workshopProfessionId || id)
                    : null,
                huntId: contractHuntId || recommendation?.id || null,
                mapMode: contractHunt
                    ? (contractHunt.mode === "specialized" ? "hunts" : "expeditions")
                    : recommendation?.mode || "expeditions",
                recommendation,
                contract: focusTraining ? clone(focusTraining) : null
            };
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
            return [...new Set([...selected, "guard", "heal"])].slice(0, 5);
        },

        configureStarterLoadout(investments = {}) {
            Aethra.SkillSystem?.ensureState?.(true);
            const hero = Aethra.GameState.hero;
            hero.actionBars = [
                { id: 0, name: "Barra Principal", slots: Array(10).fill(null) }
            ];
            const bar = hero.actionBars[0];
            this.getStarterSkills(investments).forEach((skillId, index) => {
                if (Aethra.SkillSystem.skills?.[skillId]) bar.slots[index] = skillId;
            });
            hero.activeActionBar = 0;
            Aethra.SkillController?.ensureState?.(true);
            Aethra.EventBus.emit("actionbar:changed", { actionBars: hero.actionBars });
            return clone(bar);
        }
    };
})(window.Aethra);
