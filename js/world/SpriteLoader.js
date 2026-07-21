// SpriteLoader.js — Gerenciador e Carregador de Sprites 2D (Tibia / OpenGameArt / Custom PNGs)
(function initSpriteLoader(Aethra) {
    "use strict";

    const spriteCache = new Map();
    const loadStatus = new Map();

    // Default sprite definitions mapping entity/archetype IDs to asset paths
    const SPRITE_MANIFEST = {
        // Hero Archetypes
        "vanguard":   "assets/entities/player_idle.png",
        "berserker":  "assets/entities/player_idle.png",
        "arcanist":   "assets/entities/player_idle.png",
        "ranger":     "assets/entities/player_idle.png",
        "nightblade": "assets/entities/player_idle.png",
        "templar":    "assets/entities/player_idle.png",

        // Monsters (falls back to asset path or procedural)
        "rat":        "assets/sprites/monsters/rat.png",
        "goblin":     "assets/sprites/monsters/goblin.png",
        "wolf":       "assets/sprites/monsters/wolf.png",
        "skeleton":   "assets/sprites/monsters/skeleton.png",

        // Tilesets
        "tileset_grass": "assets/sprites/tiles/grass_tileset.png"
    };

    function loadSprite(key, url) {
        if (spriteCache.has(key)) {
            return spriteCache.get(key);
        }

        const img = new Image();
        img.src = url || SPRITE_MANIFEST[key] || `assets/sprites/${key}.png`;
        loadStatus.set(key, "loading");

        img.onload = () => {
            loadStatus.set(key, "ready");
            Aethra.EventBus?.emit("sprite:loaded", { key, url: img.src });
        };

        img.onerror = () => {
            loadStatus.set(key, "error");
        };

        spriteCache.set(key, img);
        return img;
    }

    function isReady(key) {
        return loadStatus.get(key) === "ready";
    }

    function drawSprite(ctx, key, dx, dy, dw = 32, dh = 32, options = {}) {
        const img = spriteCache.get(key) || loadSprite(key);
        
        if (img && isReady(key) && img.complete && img.naturalWidth > 0) {
            const sx = options.sx || 0;
            const sy = options.sy || 0;
            const sw = options.sw || img.naturalWidth;
            const sh = options.sh || img.naturalHeight;

            ctx.save();
            if (options.flipH) {
                ctx.translate(dx + dw, dy);
                ctx.scale(-1, 1);
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
            } else {
                ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
            }
            ctx.restore();
            return true;
        }

        return false; // Returns false if fallback drawing should be used
    }

    // Preload default manifest
    Object.entries(SPRITE_MANIFEST).forEach(([key, url]) => loadSprite(key, url));

    Aethra.SpriteLoader = {
        load: loadSprite,
        draw: drawSprite,
        isReady,
        cache: spriteCache,
        manifest: SPRITE_MANIFEST
    };
})(window.Aethra = window.Aethra || {});
