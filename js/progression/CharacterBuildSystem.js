// CharacterBuildSystem.js - criação do herói e distribuição permanente da build.
(function initCharacterBuildSystem(Aethra) {
    "use strict";

    if (!Aethra?.GameState || !Aethra?.EventBus) {
        throw new Error("CharacterBuildSystem.js requer game-core.js.");
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const integer = (value, fallback = 0) => Math.floor(number(value, fallback));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const ATTRIBUTE_POINTS = 14;
    const INITIAL_SKILL_POINTS = 0;
    const MAX_INITIAL_ATTRIBUTE = 6;
    const MAX_INITIAL_MASTERY = 3;

    const ATTRIBUTES = Object.freeze({
        strength: {
            id: "strength",
            name: "Força",
            icon: "⚔",
            short: "+poder físico",
            description: "Aumenta o dano dos ataques físicos e o Vigor máximo.",
            perPoint: "+1 Força, +2 Vigor; a cada 3 pontos, +1 dano mínimo e máximo."
        },
        magic: {
            id: "magic",
            name: "Magia",
            icon: "✦",
            short: "+magias e cura",
            description: "Amplifica dano mágico, cura e a reserva de Mana.",
            perPoint: "+1 Magia e +4 Mana máxima."
        },
        precision: {
            id: "precision",
            name: "Precisão",
            icon: "◎",
            short: "+chance de acerto",
            description: "Reduz ataques perdidos contra inimigos com Esquiva.",
            perPoint: "+1 ponto percentual de acerto antes da Esquiva do alvo."
        },
        vitality: {
            id: "vitality",
            name: "Vitalidade",
            icon: "♥",
            short: "+vida máxima",
            description: "Permite sobreviver por mais rodadas antes de ser derrotado.",
            perPoint: "+6 HP máximo."
        },
        defense: {
            id: "defense",
            name: "Defesa",
            icon: "⬡",
            short: "+redução de dano",
            description: "Reduz o dano físico recebido antes de bloqueios.",
            perPoint: "+1 Defesa; aproximadamente -1 de dano a cada 2 pontos."
        },
        agility: {
            id: "agility",
            name: "Agilidade",
            icon: "◇",
            short: "+esquiva e crítico",
            description: "Cria oportunidades de evitar totalmente um golpe e melhora críticos.",
            perPoint: "+0,75% Esquiva, +0,25% Crítico e +2 Vigor."
        }
    });

    const MASTERIES = Object.freeze(clone(Aethra.DisciplineSystem?.definitions || {}));

    const RECOMMENDED_ATTRIBUTES = Object.freeze({
        strength: 3,
        magic: 2,
        precision: 3,
        vitality: 3,
        defense: 2,
        agility: 1
    });

    const RECOMMENDED_MASTERIES = Object.freeze({
        sword: 2,
        fire: 1,
        restoration: 1,
        plate_armor: 1,
        exploration: 1,
        survival: 1,
        skinning: 1
    });

    const ARCHETYPES = Object.freeze({
        vanguard: {
            id: "vanguard", name: "Vanguarda", title: "A muralha que avança", icon: "⚔",
            accent: "#79c9e8", description: "Espada, armadura e controle. Uma entrada segura para aprender o combate.",
            tags: ["Espadas", "Defesa", "Consistente"], starterItemId: "training_sword",
            starterArmorClass: "plate", starterShield: true,
            attributes: { strength: 3, magic: 0, precision: 2, vitality: 4, defense: 4, agility: 1 },
            masteries: { sword: 3, plate_armor: 2, shield: 1, survival: 1, blacksmithing: 1 }
        },
        berserker: {
            id: "berserker", name: "Berserker", title: "Risco em cada golpe", icon: "🪓",
            accent: "#ff806f", description: "Machados, críticos e dano explosivo. Erra mais, destrói quando conecta.",
            tags: ["Machados", "Crítico", "Alto risco"], starterItemId: "training_axe",
            starterArmorClass: "plate", starterShield: false,
            attributes: { strength: 5, magic: 0, precision: 3, vitality: 2, defense: 1, agility: 3 },
            masteries: { axe: 3, plate_armor: 1, survival: 2, exploration: 1, skinning: 1 }
        },
        arcanist: {
            id: "arcanist", name: "Arcanista", title: "Três escolas, muitas respostas", icon: "✦",
            accent: "#aa8cff", description: "Alterna Fogo, Gelo e Trevas para explosão, controle ou drenagem.",
            tags: ["Elementos", "Mana", "Versátil"], starterItemId: "novice_focus",
            starterArmorClass: "cloth", starterShield: false,
            attributes: { strength: 1, magic: 5, precision: 3, vitality: 2, defense: 1, agility: 2 },
            masteries: { fire: 2, ice: 2, shadow: 2, cloth_armor: 1, restoration: 1 }
        },
        ranger: {
            id: "ranger", name: "Batedor", title: "Precisão antes do perigo", icon: "➶",
            accent: "#72dda7", description: "Arco, exploração e coleta. Encontra mais oportunidades e escolhe o alvo.",
            tags: ["Arcos", "Exploração", "Precisão"], starterItemId: "training_bow",
            starterArmorClass: "leather", starterShield: false,
            attributes: { strength: 2, magic: 0, precision: 5, vitality: 2, defense: 1, agility: 4 },
            masteries: { bow: 3, survival: 2, exploration: 1, leather_armor: 1, skinning: 1 }
        },
        nightblade: {
            id: "nightblade", name: "Lâmina Sombria", title: "Velocidade e oportunismo", icon: "☾",
            accent: "#d47de7", description: "Adagas e Trevas criam cortes duplos, drenagem e rotas de Ladinagem.",
            tags: ["Adagas", "Trevas", "Ladinagem"], starterItemId: "training_dagger",
            starterArmorClass: "leather", starterShield: false,
            attributes: { strength: 2, magic: 2, precision: 4, vitality: 1, defense: 1, agility: 4 },
            masteries: { dagger: 3, shadow: 2, thievery: 2, leather_armor: 1 }
        },
        templar: {
            id: "templar", name: "Templário", title: "Martelo e luz sagrada", icon: "✣",
            accent: "#efd070", description: "Maças, armadura de placa e luz. Uma build híbrida de defesa robusta e magias de cura.",
            tags: ["Maças", "Defesa", "Restauração"], starterItemId: "training_mace",
            starterArmorClass: "plate", starterShield: true,
            attributes: { strength: 3, magic: 2, precision: 2, vitality: 3, defense: 3, agility: 1 },
            masteries: { mace: 3, plate_armor: 2, shield: 1, restoration: 1, survival: 1 }
        }
    });

    /*
     * Progressão por vocação (decisão do Paulo, 2026-10-01): cada nível dá
     * vida, mana e vigor conforme o arquétipo; a cada 5 níveis, o atributo da
     * vocação sobe. Quem luta na linha de frente ganha vida; quem conjura, mana.
     */
    const VOCATION_GROWTH = Object.freeze({
        vanguard: Object.freeze({ perLevel: { maxHp: 7, maxMana: 2, maxEnergy: 2 }, everyFive: { str: 1, defense: 1 } }),
        berserker: Object.freeze({ perLevel: { maxHp: 6, maxMana: 1, maxEnergy: 3 }, everyFive: { str: 2 } }),
        arcanist: Object.freeze({ perLevel: { maxHp: 2, maxMana: 8, maxEnergy: 1 }, everyFive: { mag: 2 } }),
        ranger: Object.freeze({ perLevel: { maxHp: 4, maxMana: 3, maxEnergy: 3 }, everyFive: { precision: 1, str: 1 } }),
        nightblade: Object.freeze({ perLevel: { maxHp: 4, maxMana: 4, maxEnergy: 2 }, everyFive: { precision: 1, mag: 1 } }),
        templar: Object.freeze({ perLevel: { maxHp: 6, maxMana: 4, maxEnergy: 1 }, everyFive: { str: 1, mag: 1 } })
    });

    function emptyAllocation(definitions) {
        return Object.fromEntries(Object.keys(definitions).map((id) => [id, 0]));
    }

    function normalizeAllocation(source, definitions, maximum) {
        const result = emptyAllocation(definitions);
        Object.keys(result).forEach((id) => {
            result[id] = clamp(integer(source?.[id], 0), 0, maximum);
        });
        return result;
    }

    function allocationTotal(allocation) {
        return Object.values(allocation || {}).reduce((sum, value) => sum + Math.max(0, integer(value, 0)), 0);
    }

    // Peitoral inicial pela classe de armadura do arquétipo.
    const STARTER_CHEST = Object.freeze({ plate: "eg_chest_l1", leather: "eg_chest_leather_l1", cloth: "eg_chest_cloth_l1" });
    // Suprimentos pelo que cada vocação gasta (vida, mana da Cura/magias, vigor das técnicas).
    const STARTER_SUPPLIES = Object.freeze({
        vanguard: { potion_health: 5, minor_vigor_tonic: 3 },
        berserker: { potion_health: 5, minor_vigor_tonic: 4 },
        arcanist: { potion_health: 3, potion_mana: 8 },
        ranger: { potion_health: 5, minor_vigor_tonic: 4 },
        nightblade: { potion_health: 4, potion_mana: 3, minor_vigor_tonic: 2 },
        templar: { potion_health: 4, potion_mana: 5 }
    });

    // Itens do kit inicial: iguais para todo herói (sorteios fixos) e vinculados.
    const STARTER_ITEM_OPTIONS = Object.freeze({
        fixedRolls: true,
        quality: 55,
        potential: 45,
        rarity: "common",
        affixes: [],
        bound: true,
        tradeable: false,
        source: "character-created"
    });

    Aethra.CharacterBuildSystem = {
        initialized: false,
        attributePoints: ATTRIBUTE_POINTS,
        initialSkillPoints: INITIAL_SKILL_POINTS,
        maxInitialAttribute: MAX_INITIAL_ATTRIBUTE,
        maxInitialMastery: MAX_INITIAL_MASTERY,
        attributes: clone(ATTRIBUTES),
        masteries: clone(MASTERIES),
        archetypes: clone(ARCHETYPES),
        vocationGrowth: clone(VOCATION_GROWTH),
        recommendedAttributes: clone(RECOMMENDED_ATTRIBUTES),
        recommendedMasteries: clone(RECOMMENDED_MASTERIES),
        introProfessions: clone(Aethra.ProfessionSystem?.introPaths || {}),

        init() {
            this.ensureState();
            if (this.initialized) return this.getSnapshot();
            this.initialized = true;
            // Saves carregados antes ou depois: base refeita pela vocação.
            ["save:loaded", "state:restored"].forEach((eventName) => {
                Aethra.EventBus.on(eventName, () => this.rebuildBaseStats());
            });
            this.rebuildBaseStats();
            Aethra.EventBus.emit("character-build:ready", this.getSnapshot());
            return this.getSnapshot();
        },

        ensureState() {
            const hero = Aethra.GameState.hero || (Aethra.GameState.hero = {});
            hero.characterCreated = hero.characterCreated === true;
            hero.attributeAllocation = normalizeAllocation(hero.attributeAllocation, ATTRIBUTES, MAX_INITIAL_ATTRIBUTE);
            hero.masteryInvestment = normalizeAllocation(hero.masteryInvestment, MASTERIES, 999);
            hero.skillPoints = Math.max(0, integer(hero.skillPoints, 0));
            hero.skillPointsEarned = Math.max(0, integer(hero.skillPointsEarned, 0));
            hero.deaths = Math.max(0, integer(hero.deaths, 0));
            hero.archetypeId = ARCHETYPES[hero.archetypeId] ? hero.archetypeId : null;
            hero.introProfessionId = Aethra.ProfessionSystem?.introPaths?.[hero.introProfessionId] ? hero.introProfessionId : null;
            Aethra.DisciplineSystem?.ensureState?.();
            return hero;
        },

        previewAttributes(source = {}) {
            const attributes = normalizeAllocation(source, ATTRIBUTES, MAX_INITIAL_ATTRIBUTE);
            const strengthPoints = attributes.strength;
            const magicPoints = attributes.magic;
            const agilityPoints = attributes.agility;
            const damageMin = 2 + Math.floor(strengthPoints / 3);
            const damageMax = damageMin + 2;
            const maxHp = 46 + attributes.vitality * 6;
            const maxMana = 26 + magicPoints * 4;
            const maxEnergy = 72 + strengthPoints * 2 + agilityPoints * 2;

            return {
                attributes,
                spent: allocationTotal(attributes),
                remaining: ATTRIBUTE_POINTS - allocationTotal(attributes),
                stats: {
                    str: 6 + strengthPoints,
                    mag: 4 + magicPoints,
                    precision: 2 + attributes.precision,
                    vitality: attributes.vitality,
                    agility: agilityPoints,
                    damageMin,
                    damageMax,
                    damage: Math.round((damageMin + damageMax) / 2),
                    defense: attributes.defense,
                    critical: Number((0.04 + agilityPoints * 0.0025).toFixed(4)),
                    criticalMultiplier: 1.75,
                    evasion: Number((agilityPoints * 0.0075).toFixed(4)),
                    maxHp,
                    hp: maxHp,
                    maxMana,
                    mana: maxMana,
                    maxEnergy,
                    energy: maxEnergy
                }
            };
        },

        // Equipamento com que cada arquétipo nasce (a criação e a prévia usam a mesma lista).
        getStarterEquipment(archetypeId) {
            const archetype = ARCHETYPES[archetypeId];
            if (!archetype) return [];
            return [
                { slot: "weapon", templateId: archetype.starterItemId },
                { slot: "chest", templateId: STARTER_CHEST[archetype.starterArmorClass] || STARTER_CHEST.plate },
                archetype.starterShield ? { slot: "offhand", templateId: "eg_shield_l1" } : null
            ].filter((entry) => entry?.templateId);
        },

        getStarterSupplies(archetypeId) {
            return { ...(STARTER_SUPPLIES[archetypeId] || { potion_health: 5, potion_mana: 5 }) };
        },

        /*
         * Prévia da criação com o kit inicial vestido: os números que o herói
         * terá ao entrar (antes mostrava só os atributos, sem arma nem peitoral).
         */
        previewStarterStats(source = {}, archetypeId = null) {
            const preview = this.previewAttributes(source);
            const equipment = {};
            this.getStarterEquipment(archetypeId).forEach(({ slot, templateId }) => {
                const item = Aethra.ItemSystem?.generateItem?.(templateId, { ...STARTER_ITEM_OPTIONS, preview: true });
                if (item) equipment[slot] = item;
            });
            const composed = Aethra.EquipSystem?.composeStats?.(preview.stats, equipment);
            return { ...preview, stats: composed ? composed.stats : preview.stats };
        },

        // Ganho acumulado da vocação até o nível (o nível 1 não ganha nada).
        getLevelGrowth(archetypeId, level = 1) {
            const growth = VOCATION_GROWTH[archetypeId];
            const levels = Math.max(0, integer(level, 1) - 1);
            if (!growth || levels <= 0) return {};
            const bonus = {};
            Object.entries(growth.perLevel).forEach(([stat, value]) => {
                bonus[stat] = (bonus[stat] || 0) + value * levels;
            });
            const milestones = Math.floor(integer(level, 1) / 5);
            Object.entries(growth.everyFive).forEach(([stat, value]) => {
                bonus[stat] = (bonus[stat] || 0) + value * milestones;
            });
            return bonus;
        },

        /*
         * Atributos base = criação (atributos distribuídos) + vocação no nível
         * atual. Recalculado em vez de somado aos poucos: saves antigos (que só
         * ganhavam +1 de vida por nível) ficam certos ao carregar.
         */
        rebuildBaseStats(hero = Aethra.GameState.hero) {
            if (!hero?.characterCreated || !hero.archetypeId || !ARCHETYPES[hero.archetypeId]) return null;
            const base = this.previewAttributes(hero.attributeAllocation).stats;
            Object.entries(this.getLevelGrowth(hero.archetypeId, hero.level)).forEach(([stat, value]) => {
                base[stat] = (Number(base[stat]) || 0) + value;
            });
            base.hp = base.maxHp;
            base.mana = base.maxMana;
            base.energy = base.maxEnergy;
            hero.baseStats = base;
            Aethra.EquipSystem?.recalculateStats?.({ emit: true, save: false, source: "vocation-growth" });
            return clone(base);
        },

        validateCreation(input = {}) {
            const name = String(input.name || "").trim().slice(0, 18);
            const attributePreview = this.previewAttributes(input.attributes);
            const masteries = emptyAllocation(MASTERIES);
            const masterySpent = 0;
            const archetypeId = ARCHETYPES[input.archetypeId] ? input.archetypeId : null;
            const introProfessionId = Aethra.ProfessionSystem?.introPaths?.[input.introProfessionId] ? input.introProfessionId : null;
            const errors = [];

            if (name.length < 3) errors.push("Escolha um nome com pelo menos 3 caracteres.");
            if (!archetypeId) errors.push("Escolha um arquétipo inicial.");
            if (!introProfessionId) errors.push("Escolha o ofício que vai orientar sua primeira missão.");
            if (attributePreview.spent !== ATTRIBUTE_POINTS) errors.push(`Distribua exatamente ${ATTRIBUTE_POINTS} pontos de atributo.`);

            return {
                valid: errors.length === 0,
                errors,
                name,
                archetypeId,
                introProfessionId,
                attributes: attributePreview.attributes,
                stats: attributePreview.stats,
                masteries,
                masterySpent
            };
        },

        resetProgressionForNewHero() {
            const state = Aethra.GameState;
            const hero = state.hero;
            Aethra.BattleSystem?.cancelTimer?.();
            if (Aethra.BattleSystem) {
                Aethra.BattleSystem.battleToken = Number(Aethra.BattleSystem.battleToken || 0) + 1;
                Aethra.BattleSystem.isFighting = false;
                Aethra.BattleSystem.lastTickAt = null;
            }
            hero.level = 1;
            hero.xpCurrent = 0;
            hero.xpTotal = 0;
            hero.xpNext = Aethra.XPSystem?.getXPRequired?.(1) || 100;
            hero.skillPoints = 0;
            hero.skillPointsEarned = 0;
            hero.deaths = 0;
            hero.gold = 100;
            hero.bag = [];
            hero.cooldowns = {};
            hero.roundCooldowns = {};
            hero.skillProgression = {};
            hero.actionBars = null;
            hero.primaryAttacks = null;
            hero.disciplines = {};
            const emptyEquipment = {
                weapon: null, offhand: null, head: null, chest: null, hands: null,
                legs: null, feet: null, neck: null, ring1: null, ring2: null, relic: null
            };
            state.playerEquipment = emptyEquipment;
            hero.equipment = emptyEquipment;
            state.professions = {};
            state.professionPolicies = {};
            state.crafting = null;
            state.quests = {
                contractVersion: Aethra.QuestSystem?.CONTRACT_VERSION || 3,
                active: [],
                completed: [],
                available: [],
                rewardClaims: []
            };
            state.ui = state.ui || {};
            state.ui.trackedQuestId = null;
            hero.introProfessionId = null;
            hero.introProfessionActivatedAt = null;
            hero.introPrepared = {};
            hero.introProvisioned = {};
            hero.professionPerks = {};
            state.hunt = {
                isActive: false,
                isPaused: false,
                huntId: null,
                kills: 0,
                xp: 0,
                gold: 0,
                lootCount: 0,
                lootValue: 0,
                supplyCost: 0,
                supplyBreakdown: {},
                elapsedTicks: 0,
                elapsedMs: 0,
                currentEnemy: null
            };
            state.battle = {
                isFighting: false,
                battleId: null,
                matchId: null,
                round: 0,
                creature: null,
                source: null,
                phase: "waiting",
                startedAt: null,
                endedAt: null,
                lastResult: null,
                lastMessage: "",
                logs: [],
                queuedPrimaryAttacks: [],
                nonLethal: false,
                noRewards: false
            };
            state.combat = {
                isActive: false,
                enemy: null,
                round: 0,
                turn: "hero"
            };
            state.coliseum = null;
            Aethra.ItemRankingSystem?.removeOwnedItems?.(hero.id || "local-player", "new-character");
            Aethra.ColiseumSystem?.seedLeaderboard?.();
            Aethra.ColiseumSystem?.rebuildLeaderboard?.();
        },

        raiseMastery(masteryId, amount = 1) {
            const definition = MASTERIES[masteryId];
            if (!definition) return false;
            const points = Math.max(1, integer(amount, 1));
            this.ensureState();
            return Boolean(Aethra.DisciplineSystem?.investPoint?.(masteryId, points));
        },

        /*
         * Pontos de habilidade: o herói ganha 1 por nível (XPSystem) e cada
         * ponto sobe 1 nível da disciplina escolhida, entregue como o XP que
         * falta para o próximo nível. Disciplina com XP travado não recebe.
         */
        canAllocateSkillPoint(masteryId) {
            const hero = this.ensureState();
            if (!MASTERIES[masteryId]) return { allowed: false, reason: "unknown-mastery" };
            if (integer(hero.skillPoints, 0) <= 0) return { allowed: false, reason: "no-points" };
            const skill = Aethra.XPSystem?.getSkillState?.(masteryId);
            if (!skill) return { allowed: false, reason: "unknown-mastery" };
            if (skill.trainingMode === "locked") return { allowed: false, reason: "training-locked" };
            return { allowed: true, reason: null, xpToNextLevel: Math.max(1, integer(skill.xpNext, 1) - integer(skill.xpCurrent, 0)) };
        },

        allocateSkillPoint(masteryId) {
            const hero = this.ensureState();
            const check = this.canAllocateSkillPoint(masteryId);
            if (!check.allowed) return false;
            const levelBefore = integer(Aethra.XPSystem.getSkillState(masteryId)?.level, 1);
            const grant = Aethra.XPSystem.grantSkillXP(masteryId, check.xpToNextLevel, {
                source: "skill-point",
                difficulty: levelBefore,
                multiplier: 1
            });
            if (!grant?.accepted || grant.levelsGained < 1) return false;
            this.raiseMastery(masteryId, 1);
            hero.skillPoints -= 1;

            const payload = {
                masteryId,
                mastery: clone(MASTERIES[masteryId]),
                remaining: hero.skillPoints,
                investment: hero.masteryInvestment[masteryId],
                levelBefore,
                levelAfter: grant.state.level
            };
            Aethra.EventBus.emit("skill-point:spent", clone(payload));
            Aethra.EventBus.emit("mastery:updated", clone(payload));
            Aethra.SaveManager?.save?.("skill-point-spent");
            return payload;
        },

        createCharacter(input = {}) {
            const validation = this.validateCreation(input);
            if (!validation.valid) return validation;

            const hero = this.ensureState();
            this.resetProgressionForNewHero();
            hero.name = validation.name;
            hero.characterCreated = true;
            hero.archetypeId = validation.archetypeId;
            hero.introProfessionId = validation.introProfessionId;
            hero.attributeAllocation = clone(validation.attributes);
            hero.masteryInvestment = emptyAllocation(MASTERIES);
            hero.baseStats = clone(validation.stats);
            hero.stats = clone(validation.stats);
            hero.hp = validation.stats.maxHp;
            hero.maxHp = validation.stats.maxHp;
            hero.mana = validation.stats.maxMana;
            hero.maxMana = validation.stats.maxMana;
            hero.energy = validation.stats.maxEnergy;
            hero.maxEnergy = validation.stats.maxEnergy;

            Aethra.DisciplineSystem?.ensureState?.(true);
            Aethra.SkillSystem?.ensureState?.(true);
            Aethra.ProfessionSystem?.ensureState?.(true);
            Aethra.CraftingSystem?.ensureState?.(true);

            const archetype = ARCHETYPES[validation.archetypeId];
            Aethra.DisciplineSystem?.configureStarterLoadout?.(archetype?.masteries || {});
            const generateStarter = (templateId, options = {}) => {
                if (!templateId) return null;
                return Aethra.ItemSystem?.generateItem?.(templateId, { ...STARTER_ITEM_OPTIONS, ...options }) || null;
            };
            const starterEquipment = this.getStarterEquipment(validation.archetypeId)
                .map(({ slot, templateId }) => ({ slot, item: generateStarter(templateId) }))
                .filter((entry) => entry.item);
            const starterSupplies = Object.entries(this.getStarterSupplies(validation.archetypeId))
                .map(([templateId, quantity]) => generateStarter(templateId, { quantity }))
                .filter(Boolean);

            Aethra.BagSystem?.addItems?.(
                [...starterEquipment.map((entry) => entry.item), ...starterSupplies],
                "character-created"
            );
            starterEquipment.forEach(({ item, slot }) => {
                Aethra.EquipSystem?.equip?.(item.instanceId, slot);
            });
            Aethra.EquipSystem?.recalculateStats?.({ emit: false, save: false, source: "character-created" });
            Aethra.ProfessionSystem?.startIntroPath?.(validation.introProfessionId);
            Aethra.QuestSystem?.acceptQuest?.("tutorial_first_steps");
            Aethra.QuestSystem?.trackQuest?.("tutorial_first_steps", { save: false });

            Aethra.GameState.ui = Aethra.GameState.ui || {};
            Aethra.GameState.ui.primaryView = "city";

            const payload = {
                created: true,
                name: hero.name,
                archetypeId: hero.archetypeId,
                archetype: clone(ARCHETYPES[hero.archetypeId]),
                introProfessionId: hero.introProfessionId,
                introProfession: clone(Aethra.ProfessionSystem?.introPaths?.[hero.introProfessionId] || null),
                attributes: clone(hero.attributeAllocation),
                masteries: clone(hero.masteryInvestment),
                stats: clone(hero.stats)
            };
            Aethra.EventBus.emit("character:created", clone(payload));
            Aethra.EventBus.emit("statsChanged", { reason: "character-created", stats: clone(hero.stats) });
            Aethra.SaveManager?.save?.("character-created");
            return { valid: true, ...payload };
        },

        getSnapshot() {
            const hero = this.ensureState();
            return {
                characterCreated: hero.characterCreated,
                name: hero.name,
                archetypeId: hero.archetypeId,
                skillPoints: hero.skillPoints,
                attributes: clone(hero.attributeAllocation),
                masteries: clone(hero.masteryInvestment),
                definitions: {
                    attributes: clone(ATTRIBUTES),
                    masteries: clone(MASTERIES),
                    archetypes: clone(ARCHETYPES)
                }
            };
        }
    };
})(window.Aethra);
