// ColiseumSystem.js - ladder global, matchmaking por poder e duelos com custódia.
(function (Aethra) {
    "use strict";

    if (!Aethra?.GameState || !Aethra?.EventBus || !Aethra?.BattleSystem) {
        throw new Error("ColiseumSystem requer GameState, EventBus e BattleSystem.");
    }

    const clone = (value) => JSON.parse(JSON.stringify(value));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value || 0)));
    const integer = (value, fallback = 0) => {
        const parsed = Math.floor(Number(value));
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const nowISO = () => new Date().toISOString();

    const DIVISIONS = [
        { id: "iron", name: "Ferro", min: 0, color: "#82909a" },
        { id: "bronze", name: "Bronze", min: 900, color: "#bf7d4b" },
        { id: "silver", name: "Prata", min: 1150, color: "#b9cad4" },
        { id: "gold", name: "Ouro", min: 1400, color: "#e6c55d" },
        { id: "platinum", name: "Platina", min: 1700, color: "#67d6c0" },
        { id: "diamond", name: "Diamante", min: 2000, color: "#76bfff" },
        { id: "immortal", name: "Imortal", min: 2350, color: "#dc8cff" }
    ];

    const GATEKEEPERS = [
        { id: "gate_bronze", name: "Brakus, o Portão de Bronze", title: "Gladiador de Bronze", rating: 1080, level: 3, power: 360, style: "guard", badge: "B" },
        { id: "gate_silver", name: "Veyra Lâmina Fria", title: "Campeã de Prata", rating: 1370, level: 6, power: 610, style: "precision", badge: "P" },
        { id: "gate_gold", name: "Gorath Quebra-Escudos", title: "Campeão de Ouro", rating: 1660, level: 10, power: 940, style: "brutal", badge: "O" },
        { id: "gate_platinum", name: "Seris da Arena Rubra", title: "Guardiã de Platina", rating: 1970, level: 16, power: 1450, style: "critical", badge: "PL" },
        { id: "gate_diamond", name: "Asterion, o Imortal", title: "Boss do Coliseu", rating: 2340, level: 25, power: 2280, style: "champion", badge: "D" }
    ];

    const SEED_NAMES = [
        "Kael", "Morrigan", "Thorne", "Nyx", "Baldric", "Seraphine", "Rurik",
        "Ilyra", "Darian", "Vesper", "Orion", "Maelis", "Cassian", "Freya",
        "Draegon", "Selene", "Aldric", "Ravenna", "Torvald", "Lysandra"
    ];

    function divisionFor(rating) {
        return [...DIVISIONS].reverse().find((entry) => Number(rating || 0) >= entry.min) || DIVISIONS[0];
    }

    function rankTag(rank) {
        if (!rank) return "SEM RANK";
        if (rank <= 3) return `TOP ${rank}`;
        if (rank <= 100) return `#${rank} GLOBAL`;
        return `#${rank}`;
    }

    function heroStats(hero = Aethra.GameState.hero || {}) {
        const stats = { ...(hero.baseStats || hero.stats || {}) };
        const equipment = Aethra.GameState.playerEquipment || hero.equipment || {};
        Object.values(equipment).filter(Boolean).forEach((item) => {
            const bonuses = Aethra.GameData?.calculateItemStats?.(item) || item.stats || {};
            Object.entries(bonuses).forEach(([stat, rawValue]) => {
                const value = Number(rawValue);
                if (!Number.isFinite(value)) return;
                const target = stat === "hpMax" ? "maxHp" : stat === "manaMax" ? "maxMana" : stat;
                stats[target] = Number(stats[target] || 0) + value;
            });
        });
        return stats;
    }

    Aethra.ColiseumSystem = {
        initialized: false,
        divisions: DIVISIONS,
        gatekeepers: GATEKEEPERS,
        config: {
            initialRating: 1000,
            placementMatches: 5,
            ratingK: 32,
            initialRatingWindow: 140,
            maxRatingWindow: 520,
            initialPowerRatioMin: 0.82,
            initialPowerRatioMax: 1.22,
            maxPowerRatioMin: 0.64,
            maxPowerRatioMax: 1.58,
            repeatOpponentPenalty: 0.35,
            gatekeeperRepeatPoints: 0
        },

        ensureState() {
            const state = Aethra.GameState;
            state.hero = state.hero || {};
            state.hero.id = state.hero.id || "local-player";
            state.coliseum = state.coliseum || {};
            const coliseum = state.coliseum;
            coliseum.schemaVersion = 1;
            coliseum.season = coliseum.season || { id: "preseason-1", name: "Pré-temporada I", startedAt: nowISO() };
            coliseum.profile = coliseum.profile || {
                rating: this.config.initialRating,
                wins: 0,
                losses: 0,
                streak: 0,
                bestStreak: 0,
                bestRating: this.config.initialRating,
                bestGlobalRank: null,
                placementPlayed: 0,
                provisional: true,
                gatekeepersDefeated: []
            };
            coliseum.leaderboard = Array.isArray(coliseum.leaderboard) ? coliseum.leaderboard : [];
            coliseum.matchHistory = Array.isArray(coliseum.matchHistory) ? coliseum.matchHistory : [];
            coliseum.activeMatch = coliseum.activeMatch || null;
            coliseum.queue = coliseum.queue || null;
            coliseum.escrow = coliseum.escrow || null;
            coliseum.seeded = Boolean(coliseum.seeded);
            return coliseum;
        },

        init() {
            if (this.initialized) return this.getSnapshot();
            this.ensureState();
            this.seedLeaderboard();
            this.bindEvents();
            this.rebuildLeaderboard();
            this.initialized = true;
            Aethra.EventBus.emit("coliseum:ready", this.getSnapshot());
            return this.getSnapshot();
        },

        bindEvents() {
            if (this._eventsBound) return;
            this._eventsBound = true;
            Aethra.EventBus.on("state:restored", () => {
                this.ensureState();
                this.rebuildLeaderboard();
            });
            Aethra.EventBus.on("hero:level-changed", () => this.rebuildLeaderboard());
            Aethra.EventBus.on("statsChanged", () => this.rebuildLeaderboard());
            Aethra.EventBus.on("equipment:changed", () => this.rebuildLeaderboard());
        },

        calculateCombatPower(hero = Aethra.GameState.hero) {
            const stats = hero === Aethra.GameState.hero ? heroStats(hero) : (hero.stats || {});
            const level = Math.max(1, Number(hero?.level || stats.level || 1));
            const hp = Math.max(1, Number(stats.maxHp ?? hero?.maxHp ?? stats.hp ?? 1));
            const mana = Math.max(0, Number(stats.maxMana ?? hero?.maxMana ?? 0));
            const vigor = Math.max(0, Number(stats.maxEnergy ?? hero?.maxEnergy ?? 0));
            const damageMin = Math.max(1, Number(stats.damageMin ?? stats.damage ?? 1));
            const damageMax = Math.max(damageMin, Number(stats.damageMax ?? stats.damage ?? damageMin));
            const damageAverage = (damageMin + damageMax) / 2;
            const defense = Math.max(0, Number(stats.defense || 0));
            const precision = Math.max(0, Number(stats.precision || 0));
            const mag = Math.max(0, Number(stats.mag || 0));
            const probabilityPower =
                clamp(stats.critical, 0, 0.75) * 330 +
                clamp(stats.evasion, 0, 0.75) * 300 +
                clamp(stats.blockChance, 0, 0.75) * 270 +
                clamp(stats.blockReduction, 0, 0.90) * 125;
            const disciplinePower = Object.values(hero?.disciplines || {})
                .reduce((sum, entry) => sum + Math.sqrt(Math.max(1, Number(entry.level || 1))) * 1.8, 0);
            const visibleLevelScale = Math.sqrt(1 + level / 100);
            return Math.max(1, Math.round((
                hp * 0.72 + mana * 0.32 + vigor * 0.18 + damageAverage * 17 +
                defense * 10 + precision * 4.5 + mag * 5 + probabilityPower + disciplinePower
            ) * visibleLevelScale));
        },

        seedLeaderboard() {
            const state = this.ensureState();
            if (state.seeded && state.leaderboard.length) return false;
            state.leaderboard = [];
            for (let index = 0; index < 42; index += 1) {
                const rating = Math.max(760, Math.round(2660 - index * 45 + ((index % 4) - 1.5) * 9));
                const level = Math.max(1, Math.round(2 + (42 - index) ** 1.34 / 3.7));
                const power = Math.max(155, Math.round(210 + level * 47 + rating * 0.25));
                state.leaderboard.push({
                    id: `world-player-${index + 1}`,
                    name: SEED_NAMES[index % SEED_NAMES.length] + (index >= SEED_NAMES.length ? ` ${Math.floor(index / SEED_NAMES.length) + 1}` : ""),
                    rating,
                    level,
                    combatPower: power,
                    wins: Math.max(3, 95 - index),
                    losses: 18 + (index * 7) % 44,
                    streak: (index * 3) % 8,
                    isBot: false,
                    isSeed: true,
                    online: index % 3 !== 0
                });
            }
            GATEKEEPERS.forEach((bot) => {
                state.leaderboard.push({ ...clone(bot), combatPower: bot.power, wins: 0, losses: 0, streak: 0, isBot: true, isSeed: true, online: true });
            });
            state.seeded = true;
            return true;
        },

        rebuildLeaderboard() {
            const state = this.ensureState();
            const profile = state.profile;
            const hero = Aethra.GameState.hero || {};
            const playerEntry = {
                id: hero.id || "local-player",
                name: hero.name || "Aethra",
                rating: integer(profile.rating, this.config.initialRating),
                level: Math.max(1, integer(hero.level, 1)),
                combatPower: this.calculateCombatPower(hero),
                wins: integer(profile.wins, 0),
                losses: integer(profile.losses, 0),
                streak: integer(profile.streak, 0),
                isPlayer: true,
                isBot: false,
                online: true
            };
            const opponents = state.leaderboard.filter((entry) => !entry.isPlayer && entry.id !== playerEntry.id);
            state.leaderboard = [...opponents, playerEntry]
                .sort((a, b) => b.rating - a.rating || b.combatPower - a.combatPower || a.id.localeCompare(b.id));
            state.leaderboard.forEach((entry, index) => {
                entry.globalRank = index + 1;
                entry.rankTag = rankTag(index + 1);
                entry.division = clone(divisionFor(entry.rating));
            });
            const current = state.leaderboard.find((entry) => entry.isPlayer);
            profile.globalRank = current?.globalRank || state.leaderboard.length;
            profile.bestGlobalRank = profile.bestGlobalRank
                ? Math.min(profile.bestGlobalRank, profile.globalRank)
                : profile.globalRank;
            profile.division = clone(divisionFor(profile.rating));
            profile.combatPower = playerEntry.combatPower;
            profile.provisional = integer(profile.placementPlayed, 0) < this.config.placementMatches;
            const signature = [
                profile.rating,
                profile.globalRank,
                profile.combatPower,
                profile.wins,
                profile.losses,
                profile.streak
            ].join(":");
            if (signature !== this._rankSignature) {
                this._rankSignature = signature;
                Aethra.EventBus.emit("coliseum:rank-updated", {
                    profile: clone(profile),
                    player: clone(current)
                });
            }
            return state.leaderboard;
        },

        findMatch(options = {}) {
            const state = this.ensureState();
            this.rebuildLeaderboard();
            const player = state.leaderboard.find((entry) => entry.isPlayer);
            const mode = options.mode === "open" ? "open" : "ranked";
            const searchStep = clamp(options.searchStep || 0, 0, 4);
            const ratingWindow = this.config.initialRatingWindow + searchStep * 95;
            const minRatio = this.config.initialPowerRatioMin - searchStep * 0.045;
            const maxRatio = this.config.initialPowerRatioMax + searchStep * 0.09;
            const recentIds = new Set(state.matchHistory.slice(-4).map((entry) => entry.opponentId));
            let candidates = state.leaderboard.filter((entry) => {
                if (entry.isPlayer || entry.id === player.id || !entry.online) return false;
                if (mode === "open") return true;
                const ratio = entry.combatPower / Math.max(1, player.combatPower);
                return Math.abs(entry.rating - player.rating) <= Math.min(this.config.maxRatingWindow, ratingWindow)
                    && ratio >= Math.max(this.config.maxPowerRatioMin, minRatio)
                    && ratio <= Math.min(this.config.maxPowerRatioMax, maxRatio);
            });
            candidates.sort((a, b) => {
                const aRepeat = recentIds.has(a.id) ? 400 : 0;
                const bRepeat = recentIds.has(b.id) ? 400 : 0;
                const aScore = Math.abs(a.rating - player.rating) + Math.abs(a.combatPower - player.combatPower) * 0.55 + aRepeat;
                const bScore = Math.abs(b.rating - player.rating) + Math.abs(b.combatPower - player.combatPower) * 0.55 + bRepeat;
                return aScore - bScore;
            });
            if (!candidates.length && searchStep < 4) return this.findMatch({ ...options, searchStep: searchStep + 1 });
            if (!candidates.length) candidates = [this.createMatchmakerBot(player)];
            const opponent = candidates[0] ? clone(candidates[0]) : null;
            state.queue = opponent ? {
                id: `queue_${Date.now().toString(36)}`,
                mode,
                searchStep,
                foundAt: nowISO(),
                opponent
            } : null;
            Aethra.EventBus.emit(opponent ? "coliseum:match-found" : "coliseum:match-not-found", clone(state.queue || { mode }));
            return clone(state.queue);
        },

        createMatchmakerBot(player) {
            const state = this.ensureState();
            const index = state.matchHistory.length % 4;
            const names = ["Cássia da Fila", "Roth Punho Firme", "Mira Vento-Curto", "Doran do Círculo"];
            const styles = ["precision", "guard", "critical", "brutal"];
            const ratios = [0.96, 1.03, 1.08, 0.99];
            return {
                id: `matchmaker-bot-${index}`,
                name: names[index],
                title: "Gladiador da Fila",
                rating: Math.max(0, Number(player.rating || this.config.initialRating) + [18, -12, 26, -20][index]),
                level: Math.max(1, Number(Aethra.GameState.hero?.level || player.level || 1)),
                combatPower: Math.max(1, Math.round(Number(player.combatPower || 1) * ratios[index])),
                wins: 0,
                losses: 0,
                streak: 0,
                style: styles[index],
                badge: names[index].charAt(0),
                isBot: true,
                isMatchmakerBot: true,
                online: true,
                division: clone(divisionFor(player.rating))
            };
        },

        expectedScore(player, opponent) {
            const powerRatio = Math.max(0.05, opponent.combatPower / Math.max(1, player.combatPower));
            const powerRating = 420 * Math.log10(powerRatio);
            return 1 / (1 + 10 ** ((opponent.rating - player.rating + powerRating) / 400));
        },

        ratingDelta(result, opponent) {
            const state = this.ensureState();
            const player = {
                rating: Number(state.profile.rating || this.config.initialRating),
                combatPower: this.calculateCombatPower()
            };
            const actual = result === "win" ? 1 : 0;
            const expected = this.expectedScore(player, opponent);
            let delta = Math.round(this.config.ratingK * (actual - expected));
            if (actual === 1) delta = Math.max(4, delta);
            else delta = Math.min(-4, delta);
            const repeats = state.matchHistory.slice(-8).filter((entry) => entry.opponentId === opponent.id).length;
            if (repeats >= 2) delta = Math.round(delta * this.config.repeatOpponentPenalty);
            if (opponent.isBot && state.profile.gatekeepersDefeated.includes(opponent.id) && result === "win") {
                delta = this.config.gatekeeperRepeatPoints;
            }
            return { delta, expected: Math.round(expected * 1000) / 1000, repeats };
        },

        createOpponentCreature(opponent) {
            const playerPower = Math.max(1, this.calculateCombatPower());
            const ratio = clamp(opponent.combatPower / playerPower, 0.45, 2.2);
            const hero = Aethra.GameState.hero || {};
            const stats = heroStats();
            const heroHp = Math.max(35, Number(stats.maxHp || hero.maxHp || 46));
            const heroDamageMin = Math.max(2, Number(stats.damageMin || 2));
            const heroDamageMax = Math.max(heroDamageMin + 1, Number(stats.damageMax || 4));
            const creature = {
                id: `coliseum_${opponent.id}`,
                name: opponent.name,
                title: opponent.title || opponent.division?.name || "Gladiador",
                type: "humanoid",
                rank: opponent.isBot ? "boss" : "elite",
                level: opponent.level,
                hp: Math.max(32, Math.round(heroHp * (0.88 + ratio * 0.18))),
                maxHp: Math.max(32, Math.round(heroHp * (0.88 + ratio * 0.18))),
                damage: Math.max(2, Math.round(((heroDamageMin + heroDamageMax) / 2) * (0.78 + ratio * 0.24))),
                xp: 0,
                goldChance: 0,
                goldMin: 0,
                goldMax: 0,
                catalogSource: "aethra-coliseum",
                noLoot: true,
                combatPower: opponent.combatPower,
                stats: {
                    str: Math.max(3, Math.round(Number(stats.str || 5) * (0.72 + ratio * 0.28))),
                    precision: Math.max(2, Math.round(Number(stats.precision || 2) * (0.8 + ratio * 0.22))),
                    defense: Math.max(0, Math.round(Number(stats.defense || 0) * (0.74 + ratio * 0.25))),
                    critical: clamp(0.035 + (ratio - 1) * 0.015, 0.02, 0.11),
                    evasion: clamp(0.025 + (ratio - 1) * 0.012, 0.01, 0.09),
                    blockChance: opponent.style === "guard" ? 0.12 : 0.035,
                    blockReduction: opponent.style === "guard" ? 0.32 : 0.2,
                    damageMin: Math.max(1, Math.round(heroDamageMin * (0.76 + ratio * 0.22))),
                    damageMax: Math.max(2, Math.round(heroDamageMax * (0.8 + ratio * 0.25)))
                },
                abilities: opponent.isBot ? [{ id: "arena_strike", name: "Golpe de Arena", type: "melee", averageDamage: 0 }] : []
            };
            Aethra.GameData.registerCreature(creature.id, creature);
            return creature;
        },

        startMatch(opponentOrId = null, options = {}) {
            const state = this.ensureState();
            if (Aethra.BattleSystem.isFighting || state.activeMatch) return { success: false, reason: "match-active" };
            const queued = state.queue?.opponent || null;
            const opponent = opponentOrId && typeof opponentOrId === "object"
                ? clone(opponentOrId)
                : state.leaderboard.find((entry) => entry.id === opponentOrId) || queued;
            if (!opponent) return { success: false, reason: "opponent-not-found" };
            const matchId = `arena_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
            const creature = this.createOpponentCreature(opponent);
            state.activeMatch = {
                id: matchId,
                mode: options.mode || state.queue?.mode || "ranked",
                ranked: (options.mode || state.queue?.mode || "ranked") === "ranked",
                opponent: clone(opponent),
                playerPower: this.calculateCombatPower(),
                startedAt: nowISO(),
                wagerId: state.escrow?.status === "locked" ? state.escrow.id : null
            };
            state.queue = null;
            Aethra.GameState.ui = Aethra.GameState.ui || {};
            Aethra.GameState.ui.primaryView = "hunt";
            Aethra.UIManager?.setPrimaryView?.("hunt", { source: "coliseum-match" });
            Aethra.WindowManager?.closeWindow?.("coliseum-view", { source: "coliseum-match" });
            const started = Aethra.BattleSystem.startCombat(creature, {
                source: "coliseum",
                matchId,
                nonLethal: true,
                noRewards: true
            });
            if (!started) {
                state.activeMatch = null;
                return { success: false, reason: "battle-start-failed" };
            }
            Aethra.GameState.battle.matchId = matchId;
            Aethra.GameState.battle.nonLethal = true;
            Aethra.EventBus.emit("coliseum:match-started", clone(state.activeMatch));
            return { success: true, match: clone(state.activeMatch) };
        },

        resolveActiveMatch(result, battlePayload = {}) {
            const state = this.ensureState();
            const match = state.activeMatch;
            if (!match || !["win", "loss"].includes(result)) return null;
            const before = integer(state.profile.rating, this.config.initialRating);
            const rating = match.ranked ? this.ratingDelta(result, match.opponent) : { delta: 0, expected: null, repeats: 0 };
            state.profile.rating = Math.max(0, before + rating.delta);
            if (result === "win") {
                state.profile.wins += 1;
                state.profile.streak = Math.max(0, integer(state.profile.streak, 0)) + 1;
                state.profile.bestStreak = Math.max(state.profile.bestStreak, state.profile.streak);
                if (match.opponent.isBot && !state.profile.gatekeepersDefeated.includes(match.opponent.id)) {
                    state.profile.gatekeepersDefeated.push(match.opponent.id);
                }
            } else {
                state.profile.losses += 1;
                state.profile.streak = 0;
            }
            state.profile.placementPlayed = Math.min(this.config.placementMatches, integer(state.profile.placementPlayed, 0) + 1);
            state.profile.bestRating = Math.max(state.profile.bestRating, state.profile.rating);
            state.profile.provisional = state.profile.placementPlayed < this.config.placementMatches;
            const historyEntry = {
                id: match.id,
                opponentId: match.opponent.id,
                opponentName: match.opponent.name,
                opponentRating: match.opponent.rating,
                opponentPower: match.opponent.combatPower,
                playerPower: match.playerPower,
                result,
                ratingBefore: before,
                ratingAfter: state.profile.rating,
                ratingDelta: rating.delta,
                expectedScore: rating.expected,
                mode: match.mode,
                wagerId: match.wagerId,
                startedAt: match.startedAt,
                endedAt: nowISO(),
                battleId: battlePayload.battleId || Aethra.GameState.battle?.battleId || null
            };
            state.matchHistory.unshift(historyEntry);
            state.matchHistory = state.matchHistory.slice(0, 60);
            if (match.wagerId) this.settleWager(result === "win" ? "player" : "opponent");
            state.activeMatch = null;
            this.rebuildLeaderboard();
            Aethra.EventBus.emit("coliseum:match-resolved", { match: clone(historyEntry), profile: clone(state.profile) });
            return clone(historyEntry);
        },

        createWager(playerItemInstanceId, opponentItem, opponent = null) {
            const state = this.ensureState();
            if (state.escrow?.status === "locked") return { success: false, reason: "escrow-active" };
            const bag = Aethra.GameState.hero?.bag || [];
            const playerItem = bag.find((entry) => entry?.instanceId === playerItemInstanceId);
            if (!playerItem) return { success: false, reason: "item-not-in-bag" };
            if (playerItem.stackable || playerItem.ownership?.tradeable === false || playerItem.ownership?.bound) {
                return { success: false, reason: "item-not-wagerable" };
            }
            const rivalItem = opponentItem || this.createOpponentWagerItem(opponent || state.queue?.opponent);
            if (!rivalItem) return { success: false, reason: "opponent-item-missing" };
            const removed = Aethra.BagSystem?.removeItem?.(playerItemInstanceId, "coliseum-escrow");
            if (!removed) return { success: false, reason: "escrow-lock-failed" };
            state.escrow = {
                id: `escrow_${Date.now().toString(36)}`,
                status: "locked",
                playerItem: clone(removed),
                opponentItem: clone(rivalItem),
                opponentId: opponent?.id || state.queue?.opponent?.id || null,
                lockedAt: nowISO(),
                settledAt: null,
                winner: null
            };
            Aethra.EventBus.emit("coliseum:wager-locked", clone(state.escrow));
            return { success: true, escrow: clone(state.escrow) };
        },

        createOpponentWagerItem(opponent = null) {
            const level = clamp(opponent?.level || Aethra.GameState.hero?.level || 1, 1, 10);
            const families = ["sword", "axe", "mace", "dagger", "bow", "focus"];
            const family = families[integer(opponent?.rating || level, level) % families.length];
            return Aethra.ItemSystem.generateItem(`eg_${family}_l${level}`, {
                ownerId: opponent?.id || "arena-opponent",
                ownerName: opponent?.name || "Gladiador",
                source: "coliseum-wager",
                qualityMin: 45,
                qualityMax: 96,
                potentialMin: 50,
                potentialMax: 100,
                tradeable: true
            });
        },

        settleWager(winner) {
            const state = this.ensureState();
            const escrow = state.escrow;
            if (!escrow || escrow.status !== "locked") return false;
            if (winner === "player") {
                Aethra.BagSystem?.addItems?.([escrow.playerItem, escrow.opponentItem], "coliseum-wager-win");
            }
            escrow.status = "settled";
            escrow.winner = winner;
            escrow.settledAt = nowISO();
            Aethra.EventBus.emit("coliseum:wager-settled", clone(escrow));
            return clone(escrow);
        },

        cancelWager() {
            const state = this.ensureState();
            const escrow = state.escrow;
            if (!escrow || escrow.status !== "locked" || state.activeMatch) return false;
            Aethra.BagSystem?.addItem?.(escrow.playerItem, "coliseum-wager-cancelled");
            escrow.status = "cancelled";
            escrow.settledAt = nowISO();
            Aethra.EventBus.emit("coliseum:wager-cancelled", clone(escrow));
            return true;
        },

        getLeaderboard(limit = 100) {
            return this.rebuildLeaderboard().slice(0, Math.max(1, Number(limit) || 100)).map(clone);
        },

        getSnapshot() {
            const state = this.ensureState();
            this.rebuildLeaderboard();
            const player = state.leaderboard.find((entry) => entry.isPlayer);
            return {
                initialized: this.initialized,
                season: clone(state.season),
                profile: clone(state.profile),
                player: clone(player),
                queue: clone(state.queue),
                activeMatch: clone(state.activeMatch),
                escrow: clone(state.escrow),
                history: clone(state.matchHistory),
                gatekeepers: GATEKEEPERS.map((entry) => ({
                    ...clone(entry),
                    defeated: state.profile.gatekeepersDefeated.includes(entry.id),
                    division: clone(divisionFor(entry.rating))
                }))
            };
        }
    };
})(window.Aethra = window.Aethra || {});
