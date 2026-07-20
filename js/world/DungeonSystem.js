// DungeonSystem.js - Estado e entrada em masmorras
(function (Aethra) {
    "use strict";

    if (!Aethra || !Aethra.GameState || !Aethra.EventBus) {
        throw new Error("DungeonSystem.js requer game-core.js.");
    }

    Aethra.DungeonSystem = {
        initialized: false,

        dungeons: {
            burned_crypt: {
                id: "burned_crypt",
                name: "Cripta Queimada",
                levelReq: 12,
                capacity: 2,
                status: "available",
                rooms: 4,
                boss: "Guardião das Cinzas"
            },
            iron_depths: {
                id: "iron_depths",
                name: "Profundezas de Ferro",
                levelReq: 25,
                capacity: 4,
                status: "locked",
                rooms: 6,
                boss: "Colosso Ferruginoso"
            },
            void_temple: {
                id: "void_temple",
                name: "Templo do Vazio",
                levelReq: 45,
                capacity: 6,
                status: "locked",
                rooms: 8,
                boss: "Oráculo Abissal"
            }
        },

        init() {
            if (this.initialized) return Aethra.GameState.dungeons;

            Aethra.GameState.dungeons = Aethra.GameState.dungeons || {
                activeId: null,
                history: {}
            };

            this.initialized = true;
            Aethra.EventBus.emit("dungeon:ready", {
                dungeons: this.dungeons
            });

            return Aethra.GameState.dungeons;
        },

        checkRequirement(dungeonId) {
            const dungeon = this.dungeons[dungeonId];
            const heroLevel = Number(Aethra.GameState.hero.level || 1);

            return Boolean(
                dungeon &&
                dungeon.status === "available" &&
                heroLevel >= dungeon.levelReq
            );
        },

        enter(dungeonId) {
            const dungeon = this.dungeons[dungeonId];

            if (!this.checkRequirement(dungeonId)) {
                Aethra.EventBus.emit("dungeon:entry-denied", {
                    dungeonId,
                    reason: dungeon
                        ? `Requer nível ${dungeon.levelReq}`
                        : "Masmorra inválida"
                });
                return false;
            }

            Aethra.GameState.dungeons.activeId = dungeonId;
            Aethra.EventBus.emit("dungeon:entered", {
                dungeon: { ...dungeon }
            });
            return true;
        }
    };
})(window.Aethra);
