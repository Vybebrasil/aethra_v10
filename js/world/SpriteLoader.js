// SpriteLoader.js — Gerenciador de Sprites 2D com suporte a PNGs externos e SVGs de Pixel Art integrados
(function initSpriteLoader(Aethra) {
    "use strict";

    const spriteCache = new Map();
    const loadStatus = new Map();

    // High quality embedded SVG Pixel Art Data URIs for instant rendering
    const PIXEL_SPRITES = {
        vanguard: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="10" y="4" width="12" height="10" fill="%238a9ea8"/><rect x="13" y="7" width="6" height="3" fill="%2350c878"/><rect x="8" y="14" width="16" height="14" fill="%232c4c68"/><rect x="4" y="14" width="5" height="12" fill="%23d9b85f"/><rect x="23" y="12" width="5" height="14" fill="%23c0c0c0"/><rect x="24" y="8" width="3" height="4" fill="%23d9b85f"/></svg>`,
        berserker: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="10" y="4" width="12" height="10" fill="%23a85038"/><rect x="12" y="7" width="8" height="3" fill="%23ff4d4d"/><rect x="8" y="14" width="16" height="14" fill="%23682c2c"/><rect x="23" y="8" width="6" height="18" fill="%23a0a0a0"/><rect x="20" y="6" width="12" height="6" fill="%23d0d0d0"/></svg>`,
        arcanist: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="10" y="4" width="12" height="10" fill="%234a38a8"/><rect x="13" y="7" width="6" height="3" fill="%2379c9e8"/><rect x="7" y="14" width="18" height="16" fill="%232c1c68"/><rect x="3" y="8" width="4" height="22" fill="%238b5a2b"/><circle cx="5" cy="6" r="4" fill="%2379c9e8"/></svg>`,
        ranger: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="10" y="4" width="12" height="10" fill="%23388a4a"/><rect x="12" y="7" width="8" height="3" fill="%23ffe066"/><rect x="8" y="14" width="16" height="14" fill="%232c5838"/><path d="M24 6 C28 16 28 20 24 30" stroke="%238b5a2b" stroke-width="3" fill="none"/></svg>`,
        nightblade: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="10" y="4" width="12" height="10" fill="%23282838"/><rect x="12" y="7" width="8" height="3" fill="%23e850e8"/><rect x="8" y="14" width="16" height="14" fill="%23181824"/><rect x="4" y="14" width="3" height="12" fill="%23d0d0d0"/><rect x="25" y="14" width="3" height="12" fill="%23d0d0d0"/></svg>`,
        templar: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="10" y="4" width="12" height="10" fill="%23d0c080"/><rect x="13" y="7" width="6" height="3" fill="%23ffffff"/><rect x="8" y="14" width="16" height="14" fill="%23506080"/><rect x="4" y="12" width="5" height="14" fill="%23ffd700"/><rect x="23" y="10" width="6" height="6" fill="%23c0c0c0"/><rect x="25" y="16" width="2" height="12" fill="%238b5a2b"/></svg>`,
        goblin: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="10" y="8" width="12" height="10" fill="%233a7838"/><rect x="6" y="6" width="5" height="6" fill="%233a7838"/><rect x="21" y="6" width="5" height="6" fill="%233a7838"/><rect x="12" y="11" width="3" height="3" fill="%23ffff00"/><rect x="17" y="11" width="3" height="3" fill="%23ffff00"/><rect x="9" y="18" width="14" height="10" fill="%23583820"/></svg>`,
        wolf: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M6 22 L14 10 L22 10 L28 22 Z" fill="%235a6068"/><rect x="10" y="12" width="3" height="3" fill="%23ff4d4d"/><rect x="22" y="18" width="8" height="6" fill="%234a5058"/></svg>`,
        skeleton: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="10" y="4" width="12" height="10" fill="%23e0e0d0"/><rect x="12" y="8" width="3" height="3" fill="%23000"/><rect x="17" y="8" width="3" height="3" fill="%23000"/><rect x="14" y="14" width="4" height="12" fill="%23e0e0d0"/><rect x="8" y="16" width="16" height="3" fill="%23e0e0d0"/></svg>`
    };

    const SPRITE_MANIFEST = {
        "vanguard":   "assets/entities/player_idle.png",
        "berserker":  PIXEL_SPRITES.berserker,
        "arcanist":   PIXEL_SPRITES.arcanist,
        "ranger":     PIXEL_SPRITES.ranger,
        "nightblade": PIXEL_SPRITES.nightblade,
        "templar":    PIXEL_SPRITES.templar,
        "goblin":     PIXEL_SPRITES.goblin,
        "wolf":       PIXEL_SPRITES.wolf,
        "skeleton":   PIXEL_SPRITES.skeleton
    };

    function loadSprite(key) {
        if (spriteCache.has(key)) return spriteCache.get(key);

        const img = new Image();
        loadStatus.set(key, "loading");

        img.onload = () => {
            loadStatus.set(key, "ready");
            Aethra.EventBus?.emit("sprite:loaded", { key, url: img.src });
        };

        img.onerror = () => {
            // If external PNG fails to load, use embedded SVG pixel sprite fallback!
            if (PIXEL_SPRITES[key]) {
                const fallbackImg = new Image();
                fallbackImg.src = PIXEL_SPRITES[key];
                fallbackImg.onload = () => {
                    loadStatus.set(key, "ready");
                    spriteCache.set(key, fallbackImg);
                };
            } else {
                loadStatus.set(key, "error");
            }
        };

        img.src = SPRITE_MANIFEST[key] || `assets/sprites/${key}.png`;
        spriteCache.set(key, img);

        // Pre-initialize SVG fallback immediately so there is zero delay
        if (PIXEL_SPRITES[key] && !isReady(key)) {
            const svgImg = new Image();
            svgImg.src = PIXEL_SPRITES[key];
            svgImg.onload = () => {
                if (loadStatus.get(key) !== "ready") {
                    loadStatus.set(key, "ready");
                    spriteCache.set(key, svgImg);
                }
            };
        }

        return img;
    }

    function isReady(key) {
        return loadStatus.get(key) === "ready";
    }

    function drawSprite(ctx, key, dx, dy, dw = 32, dh = 32, options = {}) {
        let img = spriteCache.get(key);
        if (!img) img = loadSprite(key);

        if (img && (isReady(key) || img.complete) && img.naturalWidth > 0) {
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

        return false;
    }

    // Preload default keys
    Object.keys(PIXEL_SPRITES).forEach((key) => loadSprite(key));

    Aethra.SpriteLoader = {
        load: loadSprite,
        draw: drawSprite,
        isReady,
        cache: spriteCache,
        manifest: SPRITE_MANIFEST,
        pixelSprites: PIXEL_SPRITES
    };
})(window.Aethra = window.Aethra || {});
