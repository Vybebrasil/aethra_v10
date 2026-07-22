// SpriteLoader.js — Gerenciador de Sprites 2D com suporte a PNGs externos e SVGs de Pixel Art integrados
(function initSpriteLoader(Aethra) {
    "use strict";

    const spriteCache = new Map();
    const loadStatus = new Map();

    // High quality embedded SVG Pixel Art Data URIs with Tibia 8.0 style black outlines
    const PIXEL_SPRITES = {
        vanguard: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="%23000000" stroke-width="0.8"><rect x="10" y="3" width="12" height="10" rx="2" fill="%239ab0c0"/><rect x="11" y="6" width="10" height="3" fill="%232c3e50"/><rect x="12" y="7" width="8" height="1" fill="%2350c878"/><rect x="8" y="13" width="16" height="14" rx="2" fill="%2334495e"/><rect x="6" y="13" width="4" height="6" fill="%23f1c40f"/><rect x="22" y="13" width="4" height="6" fill="%23f1c40f"/><rect x="3" y="12" width="6" height="15" rx="1" fill="%237f8c8d"/><rect x="5" y="14" width="2" height="11" fill="%23f1c40f"/><rect x="24" y="10" width="3" height="18" fill="%23bdc3c7"/><rect x="23" y="14" width="5" height="3" fill="%23e67e22"/><rect x="10" y="27" width="5" height="4" fill="%231a252f"/><rect x="17" y="27" width="5" height="4" fill="%231a252f"/></g></svg>`,
        berserker: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="%23000000" stroke-width="0.8"><rect x="10" y="4" width="12" height="9" rx="1" fill="%2395a5a6"/><path d="M7 3 L11 7 L9 8 Z" fill="%23ecf0f1"/><path d="M25 3 L21 7 L23 8 Z" fill="%23ecf0f1"/><rect x="12" y="7" width="8" height="3" fill="%23e74c3c"/><rect x="8" y="13" width="16" height="14" rx="2" fill="%2378281f"/><rect x="23" y="4" width="7" height="22" fill="%23bdc3c7"/><rect x="20" y="14" width="12" height="4" fill="%23e67e22"/><rect x="10" y="27" width="5" height="4" fill="%234a235a"/><rect x="17" y="27" width="5" height="4" fill="%234a235a"/></g></svg>`,
        arcanist: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="%23000000" stroke-width="0.8"><path d="M10 13 L16 1 L22 13 Z" fill="%232c3e50"/><rect x="10" y="7" width="12" height="7" fill="%2334495e"/><circle cx="16" cy="10" r="2" fill="%233498db"/><rect x="7" y="14" width="18" height="16" rx="3" fill="%231b2631"/><rect x="12" y="14" width="8" height="16" fill="%232980b9"/><rect x="3" y="6" width="3" height="24" rx="1" fill="%237e5109"/><circle cx="4.5" cy="5" r="4" fill="%235dade2"/><circle cx="4.5" cy="5" r="2" fill="%23ffffff"/></g></svg>`,
        ranger: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="%23000000" stroke-width="0.8"><rect x="10" y="4" width="12" height="9" rx="2" fill="%231e8449"/><rect x="12" y="7" width="8" height="2" fill="%23f4d03f"/><path d="M22 2 L25 5 L22 7 Z" fill="%23f39c12"/><rect x="8" y="13" width="16" height="14" rx="2" fill="%23145a32"/><path d="M25 5 C29 15 29 21 25 31" stroke="%237e5109" stroke-width="3" fill="none"/><line x1="25" y1="6" x2="25" y2="30" stroke="%23ecf0f1" stroke-width="1.5"/></g></svg>`,
        nightblade: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="%23000000" stroke-width="0.8"><rect x="10" y="4" width="12" height="9" rx="2" fill="%23283747"/><rect x="12" y="7" width="8" height="2" fill="%238e44ad"/><rect x="8" y="13" width="16" height="14" rx="2" fill="%231b2631"/><rect x="3" y="12" width="3" height="16" fill="%23ecf0f1"/><rect x="26" y="12" width="3" height="16" fill="%23ecf0f1"/></g></svg>`,
        templar: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="%23000000" stroke-width="0.8"><rect x="10" y="3" width="12" height="10" rx="2" fill="%23f1c40f"/><rect x="12" y="6" width="8" height="3" fill="%23ffffff"/><rect x="8" y="13" width="16" height="14" rx="2" fill="%23d4ac0d"/><rect x="4" y="11" width="5" height="16" rx="1" fill="%23f39c12"/><rect x="24" y="8" width="4" height="20" fill="%23ecf0f1"/></g></svg>`,
        goblin: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="%23000000" stroke-width="0.8"><rect x="10" y="6" width="12" height="10" rx="2" fill="%2327ae60"/><polygon points="4,6 10,8 8,12" fill="%2327ae60"/><polygon points="28,6 22,8 24,12" fill="%2327ae60"/><rect x="12" y="9" width="3" height="3" fill="%23f1c40f"/><rect x="17" y="9" width="3" height="3" fill="%23f1c40f"/><rect x="9" y="16" width="14" height="12" rx="2" fill="%236e2c00"/><rect x="23" y="14" width="3" height="12" fill="%23bdc3c7"/></g></svg>`,
        wolf: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="%23000000" stroke-width="0.8"><path d="M4 22 L12 8 L22 8 L28 22 Z" fill="%23566573"/><polygon points="8,4 12,9 6,10" fill="%2334495e"/><polygon points="20,4 24,10 18,9" fill="%2334495e"/><rect x="10" y="11" width="3" height="3" fill="%23e74c3c"/><rect x="19" y="11" width="3" height="3" fill="%23e74c3c"/><rect x="22" y="18" width="9" height="7" rx="2" fill="%232c3e50"/></g></svg>`,
        skeleton: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="%23000000" stroke-width="0.8"><rect x="10" y="4" width="12" height="10" rx="3" fill="%23ecf0f1"/><rect x="12" y="7" width="3" height="4" fill="%2317202a"/><rect x="17" y="7" width="3" height="4" fill="%2317202a"/><rect x="14" y="14" width="4" height="14" fill="%23bdc3c7"/><rect x="7" y="16" width="18" height="3" fill="%23ecf0f1"/><rect x="24" y="10" width="3" height="18" fill="%237f8c8d"/></g></svg>`,
        rat: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="%23000000" stroke-width="0.8"><ellipse cx="16" cy="20" rx="10" ry="7" fill="%236e2c00"/><circle cx="10" cy="16" r="4" fill="%2385929e"/><circle cx="8" cy="13" r="3" fill="%23f1948a"/><rect x="6" y="16" width="2" height="2" fill="%23e74c3c"/><path d="M26 21 C29 21 31 23 30 27" stroke="%23f1948a" stroke-width="2.5" fill="none"/></g></svg>`,
        boss: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="%23000000" stroke-width="0.8"><path d="M8 2 L12 9 L6 10 Z" fill="%23c0392b"/><path d="M24 2 L26 10 L20 9 Z" fill="%23c0392b"/><rect x="9" y="8" width="14" height="11" rx="2" fill="%23922b21"/><rect x="11" y="11" width="3" height="3" fill="%23f1c40f"/><rect x="18" y="11" width="3" height="3" fill="%23f1c40f"/><rect x="7" y="19" width="18" height="12" rx="3" fill="%23641e16"/><path d="M2 12 Q-2 22 7 28 Z" fill="%2317202a"/><path d="M30 12 Q34 22 25 28 Z" fill="%2317202a"/></g></svg>`
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
        "skeleton":   PIXEL_SPRITES.skeleton,
        "rat":        PIXEL_SPRITES.rat,
        "boss":       PIXEL_SPRITES.boss
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
