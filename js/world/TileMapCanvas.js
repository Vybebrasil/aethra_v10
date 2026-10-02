// TileMapCanvas.js — cena viva da caçada (visão lateral) como projeção do
// estado oficial. O herói corre pela trilha com o fundo em camadas
// (parallax); o monstro entra pela direita; cada golpe, cura, esquiva e
// morte que a CombatProjection publica vira animação, efeito e número.
// Nada aqui decide combate, XP, ouro ou loot: só desenha.
// Arte: assets/scene (créditos em assets/scene/CREDITS.md), catálogo gerado
// em HuntSceneCatalog.js.
(function initTileMapCanvas(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const TILE_SIZE = 32;
    const BASE_ROUND_MS = 1800;
    const WORLD_HEIGHT = 150;      // altura útil do mundo em pixels de arte
    const WALK_SPEED = 46;         // pixels de arte por segundo (1×)
    const MAX_LOGS = 5;

    let canvas = null;
    let context = null;
    let animationFrameId = null;
    let resizeObserver = null;
    let running = false;
    let mapCols = 24;
    let mapRows = 16;
    let projection = null;
    let lastProjectedEventId = null;
    let lastFrameAt = 0;

    const logs = [];
    const images = new Map();
    const floaters = [];
    const effects = [];
    const particles = [];
    const coins = [];

    const scene = {
        worldX: 0,
        shakeUntil: 0,
        shakePower: 0,
        darkness: 0,
        nextSlot: 0,
        queue: [],
        prop: null,
        zoneKey: null,
        banner: null
    };

    const hero = createActor("hero");
    let enemy = null;
    let corpse = null;          // inimigo derrotado sumindo enquanto o próximo chega

    const clamp = (value, minimum, maximum) =>
        Math.min(maximum, Math.max(minimum, Number(value) || 0));
    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const formatNumber = (value) =>
        new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.floor(Number(value) || 0)));
    const escapeHTML = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    // Aleatoriedade só visual (partículas, tremor): não toca o jogo.
    const visualRandom = () => Math.random();

    function catalog() {
        return Aethra.HuntSceneCatalog || { actors: {}, backgrounds: {}, fx: {}, props: {} };
    }

    function image(src) {
        if (!src) return null;
        let entry = images.get(src);
        if (!entry) {
            const element = new Image();
            entry = { element, ready: false, failed: false };
            element.onload = () => { entry.ready = true; };
            element.onerror = () => { entry.failed = true; };
            element.src = src;
            images.set(src, entry);
        }
        return entry.ready ? entry.element : null;
    }

    /* ---------------------------------------------------------------
       Elenco: quem é cada criatura na cena
       --------------------------------------------------------------- */

    // [regra, sprite, ajuste de tamanho, filtro de cor]. A altura vem do
    // tamanho da criatura (Pequeno, Médio, Grande…); o ajuste só refina.
    const CAST = [
        [/alpha[_-]?wolf/, "hellhound", 0.95, "brightness(1.15) contrast(1.15)"],
        [/winter-wolf/, "wolf", 1.1, "grayscale(1) brightness(1.5)"],
        [/wolf-spider/, "bigspider", 1, "sepia(.5) brightness(1.25)"],
        [/phase-spider/, "bigspider", 1, "hue-rotate(200deg) saturate(1.6) opacity(.82)"],
        [/ettercap/, "bigspider", 1.1, "hue-rotate(60deg) saturate(1.4)"],
        [/spider/, "bigspider", 1, ""],
        [/wolf/, "wolf", 1, "grayscale(.45) brightness(.88)"],
        [/rat/, "rat", 1, ""],
        [/boar/, "boar", 1, ""],
        [/beetle/, "larva", 1, "hue-rotate(-40deg) saturate(1.6)"],
        [/bandit/, "bandit", 1, ""],
        [/polar-bear/, "bear", 1, "grayscale(1) brightness(2.3)"],
        [/owlbear/, "bear", 1.1, "sepia(.5) hue-rotate(-20deg) brightness(1.15)"],
        [/black-bear|brown-bear|grizzly|^bear/, "bear", 1, "brightness(.55) saturate(.7)"],
        [/hobgoblin/, "goblin", 1, "hue-rotate(-70deg) saturate(1.2)"],
        [/bugbear/, "goblin", 1.15, "sepia(.6) hue-rotate(-20deg)"],
        [/goblin-boss|goblin_boss/, "goblin", 1.2, "saturate(1.4) brightness(1.1)"],
        [/goblin/, "goblin", 1, ""],
        [/orc/, "brute", 1, "sepia(.35) hue-rotate(60deg) saturate(1.3)"],
        [/ogre/, "brute", 1, "sepia(.5) hue-rotate(10deg)"],
        [/troll/, "brute", 1, "sepia(.6) hue-rotate(70deg) saturate(1.2) brightness(.8)"],
        [/stone-giant/, "king", 1, "grayscale(1) brightness(1.1)"],
        [/frost-giant/, "king", 1, "grayscale(.6) hue-rotate(180deg) brightness(1.2)"],
        [/zombie/, "zombie", 1, "sepia(.6) hue-rotate(50deg) saturate(1.5)"],
        [/ghoul/, "zombie", 1, "hue-rotate(220deg) brightness(.8)"],
        [/mummy/, "zombie", 1.05, "sepia(1) brightness(1.2)"],
        [/wight/, "knight", 1, "grayscale(.8) brightness(.7)"],
        [/bone-devil/, "demon", 0.9, "grayscale(1) brightness(1.5)"],
        [/skeleton/, "skeleton", 1, ""],
        [/specter|ghost|spirit|wraith/, "ghost", 1, ""],
        [/vampire/, "warlock", 1, "hue-rotate(130deg) saturate(1.4)"],
        [/lich/, "warlock", 1, "hue-rotate(-60deg) brightness(1.1)"],
        [/hag/, "warlock", 1, "hue-rotate(200deg)"],
        [/toad|frog/, "beast2", 1, "hue-rotate(60deg)"],
        [/crocodile/, "lizard", 1, ""],
        [/shambling|mound/, "mushroom", 1, "hue-rotate(90deg) brightness(.8)"],
        [/gargoyle/, "demon", 0.75, "grayscale(1) brightness(1.15)"],
        [/vrock/, "demon", 0.9, "hue-rotate(60deg)"],
        [/hezrou/, "hellbeast", 1, "hue-rotate(90deg)"],
        [/chain-devil/, "hellbeast", 1, "hue-rotate(-30deg) brightness(1.1)"],
        [/fire-elemental|flame|magma/, "fireskull", 1, ""],
        [/earth-elemental/, "hellbeast", 1, "grayscale(.7) sepia(.8) brightness(.8)"],
        [/xorn/, "mole", 1, ""],
        [/white-dragon/, "drake", 1.15, "grayscale(1) brightness(1.9)"],
        [/black-dragon/, "drake", 1.15, "brightness(.55)"],
        [/green-dragon/, "drake", 1.15, "sepia(1) hue-rotate(60deg) saturate(2.2)"],
        [/blue-dragon/, "drake", 1.15, "sepia(1) hue-rotate(170deg) saturate(2.2)"],
        [/red-dragon/, "drake", 1.15, "sepia(1) hue-rotate(-30deg) saturate(3)"],
        [/wyvern/, "drake", 1.2, "sepia(1) hue-rotate(10deg) saturate(1.6)"],
        [/hydra/, "drake", 1.3, "sepia(1) hue-rotate(80deg) saturate(2)"],
        [/tarrasque/, "drake", 1.6, "brightness(.6) sepia(.6)"],
        [/dragon/, "drake", 1.15, ""],
        [/aboleth/, "mollusc", 1, "hue-rotate(160deg)"],
        [/kraken/, "mollusc", 1, "hue-rotate(250deg)"],
        [/naga/, "snake", 1, "sepia(.8) saturate(2)"],
        [/slime|ooze/, "slime", 1, ""],
        [/mimic/, "mimic", 1, ""],
        [/mushroom|myconid/, "mushroom", 1, ""],
        [/eye|beholder/, "eye", 1, ""],
        [/bat/, "bat", 1, ""]
    ];
    const TYPE_CAST = {
        beast: "bear", humanoid: "bandit", undead: "zombie", monstrosity: "hellbeast", dragon: "drake",
        giant: "brute", elemental: "hellbeast", fiend: "demon", plant: "mushroom", ooze: "slime",
        aberration: "eye", fey: "warlock", celestial: "ghost", construct: "knight"
    };
    // Altura alvo (pixels de arte) por tamanho; quadrúpedes e rastejantes são baixos.
    const SIZE_HEIGHT = { tiny: 20, small: 34, medium: 50, large: 70, huge: 92, gargantuan: 112 };
    const LOW_PROFILE = new Set(["wolf", "bigdog", "bear", "hellhound", "hellcat", "bigspider", "boar", "rat",
        "spider_red", "spider_yellow", "lizard", "snake", "larva", "mole", "slime", "mimic"]);
    const HERO_HEIGHT = 54;

    function sizeHeight(creature = {}) {
        const size = String(creature.size || "medium").toLowerCase().split(/[\s/]/).pop();
        return SIZE_HEIGHT[size] || SIZE_HEIGHT.medium;
    }

    function castFor(creature = {}) {
        const id = String(creature.bossId || creature.id || creature.enemyId || "").toLowerCase();
        const source = `${id} ${String(creature.catalogId || "").toLowerCase()}`;
        let key;
        let adjust = 1;
        let filter = "";
        if (/^coliseum_/.test(id)) {
            key = /mago|bruxo/.test(String(creature.title || "").toLowerCase()) ? "warlock" : "knight";
        } else {
            const rule = CAST.find(([pattern]) => pattern.test(source));
            if (rule) [, key, adjust, filter] = rule;
            else key = TYPE_CAST[String(creature.type || creature.creatureType || "").toLowerCase()] || "beast";
        }
        if (!catalog().actors?.[key]) key = "bear";
        const def = catalog().actors?.[key];
        const boss = creature.isBoss || creature.rank === "boss" || /alpha[_-]?wolf/.test(id) ? 1.12 : 1;
        const target = sizeHeight(creature) * (LOW_PROFILE.has(key) ? 0.62 : 1) * adjust * boss;
        const scale = clamp(target / Math.max(8, def?.height || 40), 0.45, 7);
        return { key, scale: Number(scale.toFixed(3)), filter };
    }

    /* ---------------------------------------------------------------
       Atores
       --------------------------------------------------------------- */

    function createActor(side) {
        return {
            side,
            key: null,
            scale: 1,
            filter: "",
            anim: "idle",
            animStart: 0,
            animSpeed: 1,
            x: 0,
            offsetX: 0,
            lunge: null,
            flashUntil: 0,
            knockUntil: 0,
            alpha: 1,
            dying: false,
            deadAt: 0,
            name: "",
            hp: { current: 1, maximum: 1 },
            enterFrom: 0,
            enterAt: 0,
            enterMs: 0
        };
    }

    function actorDef(actor) {
        return catalog().actors?.[actor?.key] || null;
    }

    function speedFactor() {
        const roundMs = number(Aethra.BattleSystem?.config?.roundMs, BASE_ROUND_MS);
        return clamp(BASE_ROUND_MS / Math.max(250, roundMs), 1, 4);
    }

    function roundMs() {
        return Math.max(250, number(Aethra.BattleSystem?.config?.roundMs, BASE_ROUND_MS));
    }

    function animDef(actor, name) {
        const def = actorDef(actor);
        if (!def) return null;
        return def.anims?.[name] || null;
    }

    function animDuration(actor, name) {
        const anim = animDef(actor, name);
        if (!anim) return 0;
        return (anim.frames / Math.max(1, anim.fps)) * 1000 / Math.max(1, actor.animSpeed || 1);
    }

    function play(actor, name, { speed = 1, force = false } = {}) {
        if (!actor) return 0;
        if (actor.dying && name !== "death") return 0;
        const available = animDef(actor, name) ? name : null;
        if (!available) return 0;
        if (!force && actor.anim === name && animDef(actor, name)?.loop) return animDuration(actor, name);
        actor.anim = name;
        actor.animStart = performance.now();
        actor.animSpeed = speed;
        return animDuration(actor, name);
    }

    function frameFor(actor, now) {
        const anim = animDef(actor, actor.anim) || animDef(actor, "idle");
        if (!anim) return { anim: null, index: 0, done: true };
        const elapsed = (now - actor.animStart) / 1000;
        const raw = Math.floor(elapsed * anim.fps * (actor.animSpeed || 1));
        if (anim.loop) return { anim, index: raw % anim.frames, done: false };
        return { anim, index: Math.min(anim.frames - 1, raw), done: raw >= anim.frames };
    }

    function idleOrRun(actor) {
        const walking = actor === hero && isWalking();
        return walking ? "run" : "idle";
    }

    /* ---------------------------------------------------------------
       Estado lido do jogo (só leitura)
       --------------------------------------------------------------- */

    function currentHunt() {
        return Aethra.GameState?.hunt || {};
    }

    function currentHuntDefinition() {
        const hunt = currentHunt();
        return Aethra.HuntSystem?.hunts?.[hunt.huntId] || null;
    }

    function currentZoneName() {
        return currentHuntDefinition()?.name
            || Aethra.GameState?.huntState?.currentZoneName
            || "Bosque dos Sussurros";
    }

    const ZONE_BACKGROUND = {
        whispering_forest: "forest", whispering_woods_focus: "forest", verdant_grove_focus: "forest",
        goblin_frontier: "sunset", merchant_ruins_focus: "autumn", arena_focus: "sunset",
        forgotten_crypt: "graveyard", catacombs_focus: "graveyard", black_fortress: "nighttown",
        spider_hollow: "hollow", moonfen: "swamp", sunken_temple: "crypt",
        iron_hills: "hills", apprentice_mines_focus: "hills", deep_mines_focus: "hills",
        frozen_pass: "frost", dragon_coast: "ember", abyssal_rift: "ember", worlds_end: "nighttown"
    };

    function zoneBackgroundKey() {
        const huntId = String(currentHunt().huntId || "whispering_forest");
        const key = ZONE_BACKGROUND[huntId] || "autumn";
        return catalog().backgrounds?.[key] ? key : Object.keys(catalog().backgrounds || {})[0];
    }

    function enemyArriving(now = performance.now()) {
        return Boolean(enemy && !enemy.dying && enemy.enterMs > 0 && now < enemy.enterAt + enemy.enterMs);
    }

    // Andando: expedição ativa, sem escada nem evento, e ninguém parado à frente
    // (o próximo monstro ainda está chegando, ou o último caiu).
    function isWalking() {
        const hunt = currentHunt();
        if (!hunt.isActive || hunt.isAtStairs || hero.dying) return false;
        if (Aethra.ExplorationSystem?.getEventPreview?.()) return false;
        if (!enemy || enemy.dying) return !Aethra.HuntSystem?.config?.isPaused;
        return enemyArriving();
    }

    /* ---------------------------------------------------------------
       Registro (workspace clássico, mantido para quem ainda o monta)
       --------------------------------------------------------------- */

    function addLog(text, tone = "info") {
        const safeText = String(text || "").trim();
        if (!safeText) return false;
        logs.unshift({
            time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            text: safeText,
            tone
        });
        logs.splice(MAX_LOGS);
        const root = document.getElementById("tilemap-chat-log");
        if (root) {
            root.innerHTML = logs.map((entry) => `
                <div class="tilemap-chat-line tilemap-chat-line--${escapeHTML(entry.tone)}">
                    <small>[${escapeHTML(entry.time)}]</small>
                    <span>${escapeHTML(entry.text)}</span>
                </div>`).join("");
        }
        return true;
    }

    /* ---------------------------------------------------------------
       Geometria
       --------------------------------------------------------------- */

    let stageHost = null;
    let stageInsets = { top: 0, right: 0, bottom: 0, left: 0 };

    function activeStageHost() {
        return stageHost && document.body.contains(stageHost) ? stageHost : null;
    }

    function playArea() {
        const insets = activeStageHost() ? stageInsets : { top: 0, right: 0, bottom: 0, left: 0 };
        const left = clamp(insets.left, 0, canvas.width * 0.32);
        const right = clamp(insets.right, 0, canvas.width * 0.45);
        const top = clamp(insets.top, 0, canvas.height * 0.4);
        const bottom = clamp(insets.bottom, 0, canvas.height * 0.4);
        return { x: left, y: top, width: Math.max(1, canvas.width - left - right), height: Math.max(1, canvas.height - top - bottom) };
    }

    // Escala final de um ator: monstro enorme encolhe só o bastante para caber
    // em metade da área de luta (dragão adulto, gigante...).
    function scaleOf(actor, area, unit) {
        const base = actor?.scale || 1;
        if (!actor || actor === hero) return base;
        const width = (actorDef(actor)?.width || 40) * base * unit;
        return base * Math.min(1, (area.width * 0.56) / Math.max(1, width));
    }

    // Linha do chão (pés) e tamanho de um pixel de arte em pixels de tela.
    function layout() {
        const area = playArea();
        const baseline = Math.round(area.y + area.height - Math.max(10, area.height * 0.06));
        const unit = Math.max(1.5, Math.min(baseline / WORLD_HEIGHT, canvas.width / 260));
        let heroX = Math.round(area.x + Math.max(40, area.width * 0.24));
        // Inimigo grande: o herói recua em vez de o inimigo invadir o espaço dele.
        if (enemy && !enemy.dying) {
            const heroHalf = (actorDef(hero)?.width || 40) * scaleOf(hero, area, unit) / 2;
            const enemyHalf = (actorDef(enemy)?.width || 40) * scaleOf(enemy, area, unit) / 2;
            const overflow = heroX + (heroHalf + enemyHalf + 10) * unit - (area.x + area.width - enemyHalf * unit - 8);
            if (overflow > 0) heroX = Math.round(Math.max(area.x + heroHalf * unit * 0.6, heroX - overflow));
        }
        return { area, baseline, unit, heroX };
    }

    // Distância de luta pela largura real dos dois corpos (sem sobreposição).
    function engageX(geo) {
        const heroHalf = (actorDef(hero)?.width || 40) * scaleOf(hero, geo.area, geo.unit) / 2;
        const enemyHalf = (actorDef(enemy)?.width || 40) * scaleOf(enemy, geo.area, geo.unit) / 2;
        const gap = (heroHalf + enemyHalf + 10) * geo.unit;
        return Math.min(geo.area.x + geo.area.width - enemyHalf * geo.unit - 8, geo.heroX + gap);
    }

    function actorScreenX(actor, geo, now) {
        if (actor === hero) return geo.heroX + actor.offsetX;
        if (actor.fixedX !== undefined) return actor.fixedX - (scene.worldX - actor.worldAnchor) * 0.6 * geo.unit;
        let x = engageX(geo);
        if (actor.enterMs > 0 && now < actor.enterAt + actor.enterMs) {
            const t = clamp((now - actor.enterAt) / actor.enterMs, 0, 1);
            const eased = 1 - (1 - t) * (1 - t);
            x = actor.enterFrom + (x - actor.enterFrom) * eased;
        }
        return x + actor.offsetX;
    }

    function actorBody(actor, geo) {
        const def = actorDef(actor);
        const height = (def?.height || 40) * scaleOf(actor, geo.area, geo.unit) * geo.unit;
        return { height, top: geo.baseline - height, center: geo.baseline - height * 0.55 };
    }

    /* ---------------------------------------------------------------
       Desenho
       --------------------------------------------------------------- */

    function drawBackground(geo, now) {
        const background = catalog().backgrounds?.[zoneBackgroundKey()];
        context.fillStyle = background?.ground || "#101418";
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (!background) return;
        const layers = background.layers || [];
        const unit = geo.unit;
        const bottom = geo.baseline + 8 * unit;
        // Céu acima do fundo: cor do topo da primeira camada.
        const first = image(layers[0]?.src);
        const firstTop = bottom - (layers[0]?.h || 160) * unit;
        if (first && firstTop > 0) {
            context.drawImage(first, 0, 0, 1, 1, 0, 0, canvas.width, firstTop + 1);
        }
        layers.forEach((layer) => {
            const img = image(layer.src);
            if (!img) return;
            const width = layer.w * unit;
            const height = layer.h * unit;
            const top = bottom - height;
            let offset = -((scene.worldX * layer.speed * unit) % width);
            if (offset > 0) offset -= width;
            context.save();
            if (layer.glow) context.globalAlpha = 0.55 + Math.sin(now / 1400) * 0.25;
            for (let x = offset; x < canvas.width; x += width) {
                context.drawImage(img, Math.floor(x), Math.floor(top), Math.ceil(width) + 1, Math.ceil(height));
            }
            context.restore();
        });
        drawGround(geo, background);
    }

    // Trilha: terra com borda de grama, rolando na velocidade da camada da frente.
    const GROUND_STYLE = {
        forest: ["#3f6b22", "#2b4a17", "#3a2a18"], autumn: ["#8a4f1d", "#5e3413", "#2e1d10"],
        sunset: ["#6a2f1c", "#45200f", "#24130c"], crypt: ["#3b4660", "#262e40", "#151a26"],
        hollow: ["#4a3560", "#30223f", "#1a1224"], swamp: ["#3d5a3a", "#283d27", "#172317"],
        hills: ["#6b6258", "#48413a", "#2a2622"], frost: ["#dfe9f2", "#a9bccc", "#5d6e7e"],
        ember: ["#7a2418", "#4e160f", "#250b08"], graveyard: ["#3a3550", "#25213a", "#141220"],
        nighttown: ["#2f3a4a", "#1d2531", "#10141c"]
    };

    function drawGround(geo, background) {
        const [grass, edge, dirt] = GROUND_STYLE[zoneBackgroundKey()] || GROUND_STYLE.forest;
        const unit = geo.unit;
        const top = Math.round(geo.baseline - unit);
        if (top >= canvas.height) return;
        context.fillStyle = dirt || background?.ground || "#101418";
        context.fillRect(0, top, canvas.width, canvas.height - top);
        const block = Math.max(2, Math.round(unit));
        const shift = Math.floor(scene.worldX * 0.6);
        for (let x = 0; x < canvas.width + block; x += block) {
            const column = Math.floor(x / block) + shift;
            const noise = ((column * 2654435761) >>> 0) % 7;
            const blade = noise < 2 ? 2 : noise < 5 ? 1 : 0;
            context.fillStyle = grass;
            context.fillRect(x, top - blade * block, block, block * (blade + 2));
            context.fillStyle = edge;
            context.fillRect(x, top + block * 2, block, block);
            if (noise === 3) {
                context.fillStyle = "rgba(0,0,0,.18)";
                context.fillRect(x, top + block * (5 + (column % 4)), block * 2, block);
            }
        }
    }

    function drawShadow(x, geo, width) {
        context.fillStyle = "rgba(0,0,0,.32)";
        context.beginPath();
        context.ellipse(x, geo.baseline + geo.unit, width, Math.max(3, geo.unit * 2.2), 0, 0, Math.PI * 2);
        context.fill();
    }

    function drawActor(actor, geo, now) {
        const def = actorDef(actor);
        if (!def) return false;
        const { anim, index, done } = frameFor(actor, now);
        if (!anim) return false;
        const img = image(anim.src);
        if (done && !actor.dying && !anim.loop) play(actor, idleOrRun(actor), { force: true });
        if (!img) return false;

        const k = scaleOf(actor, geo.area, geo.unit) * geo.unit;
        const x = actorScreenX(actor, geo, now);
        const facingRight = actor === hero;
        const flip = def.facing === "front" ? false : (def.facing === "left") === facingRight;
        let dx = x - def.centerX * k;
        if (flip) dx = x - (anim.fw - def.centerX) * k;
        const dy = geo.baseline - def.footY * k;

        drawShadow(x, geo, Math.max(8, (def.height || 30) * 0.32 * k));
        context.save();
        context.globalAlpha = clamp(actor.alpha, 0, 1);
        const filters = [];
        if (actor.filter) filters.push(actor.filter);
        if (actor.flashUntil > now) filters.push("brightness(2.6) saturate(.2)");
        if (filters.length) context.filter = filters.join(" ");
        if (flip) {
            context.translate(Math.round(dx + anim.fw * k), Math.round(dy));
            context.scale(-1, 1);
            context.drawImage(img, index * anim.fw, 0, anim.fw, anim.fh, 0, 0, anim.fw * k, anim.fh * k);
        } else {
            context.drawImage(img, index * anim.fw, 0, anim.fw, anim.fh, Math.round(dx), Math.round(dy), anim.fw * k, anim.fh * k);
        }
        context.restore();
        return true;
    }

    function drawHealthBar(actor, geo, now) {
        if (!actor || actor.dying) return;
        const body = actorBody(actor, geo);
        const x = actorScreenX(actor, geo, now);
        const width = 96;
        const y = Math.max(geo.area.y + 4, body.top - 22);
        const maximum = Math.max(1, number(actor.hp.maximum, 1));
        const ratio = clamp(number(actor.hp.current, maximum) / maximum, 0, 1);
        context.fillStyle = "rgba(4,8,10,.82)";
        context.fillRect(Math.round(x - width / 2) - 2, y - 2, width + 4, 9);
        context.fillStyle = "#3a1418";
        context.fillRect(Math.round(x - width / 2), y, width, 5);
        context.fillStyle = actor === hero ? "#52d89b" : "#ef4f5f";
        context.fillRect(Math.round(x - width / 2), y, Math.round(width * ratio), 5);
        if (actor !== hero && actor.name) {
            context.font = "700 12px Outfit, sans-serif";
            context.textAlign = "center";
            context.lineWidth = 3;
            context.strokeStyle = "rgba(0,0,0,.85)";
            context.strokeText(actor.name, x, y - 6);
            context.fillStyle = "#f3e9d6";
            context.fillText(actor.name, x, y - 6);
        }
    }

    function spawnFx(key, x, y, { scale = 1, flip = false, speed = 1, filter = "" } = {}) {
        const def = catalog().fx?.[key];
        if (!def) return;
        image(def.src);
        effects.push({ def, x, y, scale, flip, speed, filter, bornAt: performance.now() });
    }

    function drawEffects(geo, now) {
        for (let index = effects.length - 1; index >= 0; index -= 1) {
            const fx = effects[index];
            if (fx.projectile) continue;
            const frame = Math.floor(((now - fx.bornAt) / 1000) * fx.def.fps * fx.speed);
            if (frame >= fx.def.frames) {
                effects.splice(index, 1);
                continue;
            }
            const img = image(fx.def.src);
            if (!img) continue;
            const k = fx.scale * geo.unit;
            const w = fx.def.fw * k;
            const h = fx.def.fh * k;
            context.save();
            if (fx.filter) context.filter = fx.filter;
            context.translate(Math.round(fx.x), Math.round(fx.y));
            if (fx.flip) context.scale(-1, 1);
            context.drawImage(img, frame * fx.def.fw, 0, fx.def.fw, fx.def.fh, -w / 2, -h / 2, w, h);
            context.restore();
        }
    }

    function addFloater(text, actor, tone = "damage", extra = 0) {
        floaters.push({ text: String(text || ""), actor, tone, bornAt: performance.now(), duration: 1100, drift: (visualRandom() - 0.5) * 30, extra });
    }

    function drawFloaters(geo, now) {
        for (let index = floaters.length - 1; index >= 0; index -= 1) {
            const entry = floaters[index];
            const progress = clamp((now - entry.bornAt) / entry.duration, 0, 1);
            if (progress >= 1) {
                floaters.splice(index, 1);
                continue;
            }
            const actor = entry.actor === "enemy" ? enemy : hero;
            const body = actor ? actorBody(actor, geo) : { top: geo.baseline - 80 };
            const x = (actor ? actorScreenX(actor, geo, now) : geo.heroX) + entry.drift;
            const pop = progress < 0.15 ? 1 + (0.15 - progress) * 4 : 1;
            const size = { critical: 30, level: 28, heal: 20, mana: 18, miss: 17, gold: 17, xp: 17 }[entry.tone] || 22;
            const color = { critical: "#ffd166", heal: "#5ff0a0", mana: "#7cc7ff", miss: "#c9d3d6", level: "#ffe08a", gold: "#ffd166", xp: "#b9a7ff" }[entry.tone] || "#ff6b6b";
            const y = body.top - 30 - progress * 46 - entry.extra * 24;
            context.save();
            context.globalAlpha = progress > 0.7 ? (1 - progress) / 0.3 : 1;
            context.font = `900 ${Math.round(size * pop)}px Outfit, sans-serif`;
            context.textAlign = "center";
            context.lineWidth = 5;
            context.strokeStyle = "rgba(0,0,0,.85)";
            context.strokeText(entry.text, x, y);
            context.fillStyle = color;
            context.fillText(entry.text, x, y);
            context.restore();
        }
    }

    function drawCoins(geo, now) {
        const coin = catalog().props?.coin;
        const img = coin ? image(coin.src) : null;
        for (let index = coins.length - 1; index >= 0; index -= 1) {
            const c = coins[index];
            const t = (now - c.bornAt) / 1000;
            if (t > 1.4) {
                coins.splice(index, 1);
                continue;
            }
            const x = c.x + c.vx * t * geo.unit;
            const y = Math.min(geo.baseline - 2, c.y - (c.vy * t - 90 * t * t) * geo.unit);
            context.save();
            context.globalAlpha = t > 1 ? (1.4 - t) / 0.4 : 1;
            if (img) context.drawImage(img, Math.round(x), Math.round(y), 7 * geo.unit * 0.8, 7 * geo.unit * 0.8);
            context.restore();
        }
    }

    function ambientKind() {
        const key = zoneBackgroundKey();
        if (key === "frost") return "snow";
        if (key === "crypt" || key === "hollow" || key === "graveyard" || key === "nighttown") return "firefly";
        if (key === "ember") return "ember";
        return "leaf";
    }

    function updateParticles(geo, now, dt) {
        const kind = ambientKind();
        const target = kind === "snow" ? 60 : kind === "firefly" ? 26 : 18;
        while (particles.length < target) {
            particles.push({
                kind,
                x: visualRandom() * canvas.width,
                y: visualRandom() * geo.baseline,
                vx: kind === "snow" ? -10 - visualRandom() * 20 : kind === "leaf" ? -20 - visualRandom() * 30 : (visualRandom() - 0.5) * 12,
                vy: kind === "snow" ? 25 + visualRandom() * 25 : kind === "leaf" ? 18 + visualRandom() * 16 : kind === "ember" ? -14 - visualRandom() * 14 : (visualRandom() - 0.5) * 10,
                phase: visualRandom() * Math.PI * 2,
                frame: Math.floor(visualRandom() * 8)
            });
        }
        const walking = isWalking() ? WALK_SPEED * speedFactor() * 0.6 * geo.unit : 0;
        const leafFx = catalog().fx?.leaf;
        const snowFx = catalog().fx?.snow;
        for (let index = particles.length - 1; index >= 0; index -= 1) {
            const p = particles[index];
            if (p.kind !== kind) {
                particles.splice(index, 1);
                continue;
            }
            p.x += (p.vx - walking) * dt + Math.sin(now / 900 + p.phase) * 0.3;
            p.y += p.vy * dt;
            if (p.x < -20) p.x = canvas.width + 10;
            if (p.x > canvas.width + 20) p.x = -10;
            if (p.y > geo.baseline + 10) p.y = -10;
            if (p.y < -20) p.y = geo.baseline;
            context.save();
            if (kind === "firefly" || kind === "ember") {
                const glow = 0.4 + Math.sin(now / 400 + p.phase) * 0.4;
                context.globalAlpha = clamp(glow, 0, 1);
                context.fillStyle = kind === "ember" ? "#ff8a3d" : "#c8ff7a";
                context.shadowColor = context.fillStyle;
                context.shadowBlur = 8;
                context.fillRect(p.x, p.y, Math.max(2, geo.unit * 0.8), Math.max(2, geo.unit * 0.8));
            } else {
                const def = kind === "snow" ? snowFx : leafFx;
                const img = def ? image(def.src) : null;
                if (img) {
                    const frame = (p.frame + Math.floor(now / 160)) % def.frames;
                    context.globalAlpha = 0.85;
                    context.drawImage(img, frame * def.fw, 0, def.fw, def.fh, p.x, p.y, def.fw * geo.unit * 0.7, def.fh * geo.unit * 0.7);
                }
            }
            context.restore();
        }
    }

    // Objeto à frente do herói, lido do estado: escada no fim do andar,
    // evento de exploração pendente, ou o que o último evento deixou.
    function currentProp() {
        const pending = Aethra.ExplorationSystem?.getEventPreview?.();
        if (pending) {
            const id = String(Aethra.ExplorationSystem?.ensureState?.()?.pendingEvent?.id || pending.category || "");
            return { kind: /chest/.test(id) ? "chest" : /camp/.test(id) ? "camp" : "spark", opened: false };
        }
        if (currentHunt().isActive && currentHunt().isAtStairs && !enemy) return { kind: "stairs" };
        return scene.prop;
    }

    function drawProp(geo, now) {
        const prop = currentProp();
        if (!prop) return;
        const x = geo.heroX + 64 * geo.unit;
        if (prop.kind === "chest") {
            const def = catalog().props?.chest;
            const img = def ? image(def.src) : null;
            if (img) {
                const frame = prop.opened ? 1 : 0;
                const k = geo.unit * 1.4;
                drawShadow(x, geo, def.w * k * 0.45);
                context.drawImage(img, frame * def.w, 0, def.w, def.h, Math.round(x - def.w * k / 2), Math.round(geo.baseline - def.h * k), def.w * k, def.h * k);
            }
        } else if (prop.kind === "camp") {
            const def = catalog().fx?.flame;
            const img = def ? image(def.src) : null;
            if (img) {
                const frame = Math.floor(now / 90) % def.frames;
                const k = geo.unit * 1.2;
                context.drawImage(img, frame * def.fw, 0, def.fw, def.fh, Math.round(x - def.fw * k / 2), Math.round(geo.baseline - def.fh * k + geo.unit * 2), def.fw * k, def.fh * k);
            }
        } else if (prop.kind === "stairs") {
            // Entrada de mina: a passagem para o próximo andar, com brilho na boca.
            const def = catalog().props?.entrance;
            const img = def ? image(def.src) : null;
            if (img) {
                const k = geo.unit * 0.62;
                const left = Math.round(x - def.w * k / 2);
                const top = Math.round(geo.baseline - 118 * k);
                context.drawImage(img, left, top, def.w * k, def.h * k);
                const pulse = 0.18 + Math.sin(now / 380) * 0.1;
                context.fillStyle = `rgba(255,209,102,${pulse})`;
                context.fillRect(Math.round(left + 34 * k), Math.round(top + 64 * k), Math.round(48 * k), Math.round(54 * k));
            }
        } else {
            const def = catalog().fx?.spark;
            const img = def ? image(def.src) : null;
            if (img) {
                const frame = Math.floor(now / 80) % def.frames;
                const k = geo.unit * 1.2;
                context.drawImage(img, frame * def.fw, 0, def.fw, def.fh, Math.round(x - def.fw * k / 2), Math.round(geo.baseline - def.fh * k - 6 * geo.unit), def.fw * k, def.fh * k);
            }
        }
    }

    function drawBanner(now) {
        const banner = scene.banner;
        if (!banner) return;
        const progress = (now - banner.bornAt) / banner.duration;
        if (progress >= 1) {
            scene.banner = null;
            return;
        }
        const area = playArea();
        context.save();
        context.globalAlpha = progress < 0.15 ? progress / 0.15 : progress > 0.75 ? (1 - progress) / 0.25 : 1;
        context.font = "900 34px Outfit, sans-serif";
        context.textAlign = "center";
        context.lineWidth = 6;
        context.strokeStyle = "rgba(0,0,0,.8)";
        const y = area.y + Math.max(70, area.height * 0.22);
        context.strokeText(banner.text, area.x + area.width / 2, y);
        context.fillStyle = banner.color || "#ffe08a";
        context.fillText(banner.text, area.x + area.width / 2, y);
        if (banner.caption) {
            context.font = "700 15px Outfit, sans-serif";
            context.lineWidth = 4;
            context.strokeText(banner.caption, area.x + area.width / 2, y + 26);
            context.fillStyle = "#e9e2d0";
            context.fillText(banner.caption, area.x + area.width / 2, y + 26);
        }
        context.restore();
    }

    /* ---------------------------------------------------------------
       Ações de combate (vindas da CombatProjection)
       --------------------------------------------------------------- */

    function heroStyle() {
        const archetypeId = Aethra.GameState?.hero?.archetypeId || "vanguard";
        if (archetypeId === "ranger") return "arrow";
        if (archetypeId === "arcanist") return "fire";
        if (archetypeId === "templar") return "holy";
        return "blade";
    }

    function enemyStyle() {
        return /wolf|dog|hound|cat|rat|bear|boar|spider|beast|owl|lizard|dragon|drake|cyclope|mole|bat|larva|snake|trex|mollusc|demon/.test(enemy?.key || "")
            ? "claw"
            : "blade";
    }

    function schedule(item) {
        const now = performance.now();
        const step = item.kind === "attack" ? roundMs() * 0.42 : roundMs() * 0.18;
        if (scene.nextSlot < now) scene.nextSlot = now;
        // O golpe espera o monstro chegar correndo.
        if (enemy && !enemy.dying && enemy.enterMs > 0) scene.nextSlot = Math.max(scene.nextSlot, enemy.enterAt + enemy.enterMs);
        // Atraso grande demais (aba em segundo plano): pula para o presente.
        if (scene.nextSlot - now > roundMs() * 3) {
            scene.queue.length = 0;
            scene.nextSlot = now;
        }
        item.at = scene.nextSlot;
        scene.nextSlot += step;
        scene.queue.push(item);
    }

    function runQueue(now) {
        while (scene.queue.length && scene.queue[0].at <= now) {
            const item = scene.queue.shift();
            perform(item, now);
        }
    }

    function perform(item, now) {
        const geo = canvas ? layout() : null;
        if (!geo) return;
        const event = item.event;
        if (item.kind === "heal") {
            const body = actorBody(hero, geo);
            spawnFx("heal", actorScreenX(hero, geo, now), body.center, { scale: 1.6 });
            const restored = event.effects || {};
            if (number(restored.mana, 0) > 0 && !number(restored.hp, 0)) addFloater(`+${formatNumber(restored.mana)} mana`, "hero", "mana");
            else addFloater(`+${formatNumber(event.amount || restored.hp || 0)}`, "hero", "heal");
            return;
        }
        const attacker = event.actor === "enemy" ? enemy : hero;
        const target = event.actor === "enemy" ? hero : enemy;
        if (!attacker || !target) return;
        const speed = speedFactor();
        const name = attacker === hero && animDef(hero, "attack2") && event.critical ? "attack2" : "attack";
        const duration = play(attacker, name, { speed: Math.max(1, speed * 0.9), force: true }) || 300 / speed;
        const lungeDir = attacker === hero ? 1 : -1;
        const ranged = attacker === hero && ["arrow", "fire"].includes(heroStyle());
        attacker.lunge = ranged ? null : { start: now, duration: Math.max(160, duration), distance: 10 * lungeDir };
        if (!animDef(attacker, "attack")) attacker.lunge = { start: now, duration: 260 / speed, distance: 16 * lungeDir };
        const impactDelay = Math.min(duration * 0.5, 320 / speed) + (ranged ? 140 / speed : 0);
        if (ranged) {
            const from = actorScreenX(hero, geo, now) + 14 * geo.unit;
            const projectile = heroStyle() === "arrow" ? "arrow" : "fireball";
            effects.push({ projectile, from, to: actorScreenX(target, geo, now), y: actorBody(hero, geo).center, bornAt: now + Math.min(duration * 0.45, 200 / speed), duration: 140 / speed });
        }
        window.setTimeout(() => impact(event, attacker, target), impactDelay);
    }

    function impact(event, attacker, target) {
        if (!canvas) return;
        const geo = layout();
        const now = performance.now();
        const targetSide = target === hero ? "hero" : "enemy";
        if (!target || (target === enemy && !enemy)) return;
        if (event.hit === false || event.outcome === "miss") {
            addFloater(target === hero ? "ESQUIVOU" : "ERROU", targetSide, "miss");
            target.offsetX = target === hero ? -6 * geo.unit : 6 * geo.unit;
            target.knockUntil = now + 220;
            return;
        }
        const body = actorBody(target, geo);
        const x = actorScreenX(target, geo, now);
        const style = attacker === hero ? heroStyle() : enemyStyle();
        const fxKey = event.critical ? (style === "fire" ? "explosion" : "slash_big")
            : style === "fire" ? "explosion" : style === "claw" ? "claw" : style === "arrow" ? "spark" : "slash";
        spawnFx(fxKey, x, body.center, { scale: (fxKey === "explosion" ? 0.9 : 1.15) * (event.critical ? 1.3 : 1), flip: attacker !== hero, speed: Math.max(1, speedFactor() * 0.8) });
        if (style === "holy" && event.critical) spawnFx("holy", x, body.center, { scale: 1.8 });
        target.flashUntil = now + 110;
        target.offsetX = (target === hero ? -1 : 1) * (event.critical ? 9 : 5) * geo.unit;
        target.knockUntil = now + 200;
        if (!target.dying && number(event.amount, 0) > 0) play(target, "hurt", { speed: Math.max(1, speedFactor() * 0.8), force: true });
        const amount = formatNumber(event.amount || 0);
        if (event.blocked) addFloater(`BLOQUEOU -${amount}`, targetSide, "miss");
        else if (event.critical) addFloater(`-${amount}!`, targetSide, "critical");
        else addFloater(`-${amount}`, targetSide, "damage");
        if (event.critical) {
            scene.shakeUntil = now + 180;
            scene.shakePower = 4;
        }
    }

    function updateActors(now) {
        [hero, enemy].forEach((actor) => {
            if (!actor) return;
            if (actor.lunge) {
                const t = (now - actor.lunge.start) / actor.lunge.duration;
                if (t >= 1) {
                    actor.lunge = null;
                    if (actor.knockUntil <= now) actor.offsetX = 0;
                } else {
                    const geoUnit = canvas ? layout().unit : 2;
                    actor.offsetX = Math.sin(Math.PI * clamp(t, 0, 1)) * actor.lunge.distance * geoUnit;
                }
            } else if (actor.knockUntil <= now && actor.offsetX !== 0) {
                actor.offsetX *= 0.7;
                if (Math.abs(actor.offsetX) < 0.5) actor.offsetX = 0;
            }
        });
        [enemy, corpse].forEach((actor) => {
            if (!actor?.dying) return;
            const anim = animDef(actor, "death");
            const elapsed = now - actor.deadAt;
            const hold = anim ? animDuration(actor, "death") + 450 : 150;
            if (!anim) actor.alpha = clamp(1 - elapsed / 700, 0, 1);
            else if (elapsed > hold) actor.alpha = clamp(1 - (elapsed - hold) / 500, 0, 1);
        });
        if (enemy?.dying && enemy.alpha <= 0) enemy = null;
        if (corpse && corpse.alpha <= 0) corpse = null;
        const wanted = idleOrRun(hero);
        if (!hero.dying && (hero.anim === "idle" || hero.anim === "run") && hero.anim !== wanted) play(hero, wanted, { speed: wanted === "run" ? Math.min(2, speedFactor()) : 1 });
    }

    /* ---------------------------------------------------------------
       Projeção → cena
       --------------------------------------------------------------- */

    function syncHeroIdentity() {
        const archetypeId = Aethra.GameState?.hero?.archetypeId || "vanguard";
        const key = catalog().actors?.[archetypeId] ? archetypeId : "vanguard";
        if (hero.key !== key) {
            hero.key = key;
            hero.scale = clamp(HERO_HEIGHT / Math.max(8, catalog().actors?.[key]?.height || HERO_HEIGHT), 0.6, 2);
            hero.dying = false;
            hero.alpha = 1;
            play(hero, "idle", { force: true });
        }
        const resources = projection?.hero?.resources?.hp;
        const state = Aethra.GameState?.hero || {};
        hero.hp = resources || { current: number(state.hp, 1), maximum: number(state.maxHp, 1) };
        hero.name = state.name || "";
    }

    function spawnEnemy(creature) {
        if (!creature) return;
        const cast = castFor(creature);
        const id = String(creature.id || creature.enemyId || "enemy");
        if (enemy && !enemy.dying && enemy.id === id) return;
        if (enemy?.dying) {
            if (enemy.fixedX === undefined && canvas) {
                enemy.fixedX = actorScreenX(enemy, layout(), performance.now());
                enemy.worldAnchor = scene.worldX;
            }
            corpse = enemy;
        }
        const actor = createActor("enemy");
        actor.id = id;
        actor.key = cast.key;
        actor.scale = cast.scale;
        actor.filter = cast.filter;
        actor.name = creature.name || "Criatura";
        actor.hp = { current: number(creature.resources?.hp?.current ?? creature.hp, 1), maximum: number(creature.resources?.hp?.maximum ?? creature.maxHp, 1) };
        const geo = canvas ? layout() : null;
        actor.enterFrom = geo ? canvas.width + 60 : 0;
        actor.enterAt = performance.now();
        actor.enterMs = clamp(roundMs() * 0.9, 550, 1100);
        play(actor, "run", { speed: Math.min(2, speedFactor()), force: true });
        window.setTimeout(() => {
            if (enemy === actor && !actor.dying) play(actor, "idle", { force: true });
        }, actor.enterMs);
        enemy = actor;
        scene.prop = null;
        // Pré-carrega as animações do novo inimigo.
        Object.values(actorDef(actor)?.anims || {}).forEach((anim) => image(anim.src));
    }

    function enemyDefeated(outcome) {
        if (!enemy || enemy.dying) return;
        enemy.dying = true;
        enemy.deadAt = performance.now();
        play(enemy, "death", { force: true });
        const geo = canvas ? layout() : null;
        if (geo) {
            // Fica no chão onde caiu e vai ficando para trás quando o herói segue.
            enemy.fixedX = actorScreenX(enemy, geo, performance.now());
            enemy.worldAnchor = scene.worldX;
            const body = actorBody(enemy, geo);
            const x = actorScreenX(enemy, geo, performance.now());
            if (!animDef(enemy, "death")) spawnFx("smoke", x, body.center, { scale: 2 });
            for (let i = 0; i < 6; i += 1) {
                coins.push({ x, y: geo.baseline - 10 * geo.unit, vx: (visualRandom() - 0.5) * 70, vy: 50 + visualRandom() * 40, bornAt: performance.now() + i * 30 });
            }
        }
        const result = outcome?.result || {};
        if (number(result.xp, 0) > 0) addFloater(`+${formatNumber(result.xp)} XP`, "enemy", "xp", 1);
        if (number(result.gold, 0) > 0) addFloater(`+${formatNumber(result.gold)} ouro`, "enemy", "gold", 0);
    }

    function heroDefeated() {
        hero.dying = true;
        play(hero, "death", { force: true });
        scene.darkness = 0.55;
    }

    function syncFromProjection() {
        syncHeroIdentity();
        const current = projection?.enemy || null;
        if (current) {
            spawnEnemy(current);
            if (enemy && !enemy.dying) {
                enemy.hp = { current: number(current.resources?.hp?.current, enemy.hp.current), maximum: number(current.resources?.hp?.maximum, enemy.hp.maximum) };
                enemy.name = current.name || enemy.name;
            }
        }
    }

    function visualizeAction(event = {}) {
        if (!event || (event.eventId && event.eventId === lastProjectedEventId)) return false;
        if (event.eventId) lastProjectedEventId = event.eventId;
        if (event.kind === "healing" || event.kind === "consumable") {
            const restored = number(event.amount, 0) + number(event.effects?.mana, 0) + number(event.effects?.energy, 0);
            if (restored <= 0) return false;
            schedule({ kind: "heal", event });
            addLog(event.message || `${event.ability || "Recurso"} recuperou o herói.`, "heal");
            return true;
        }
        const normalized = {
            ...event,
            kind: "attack",
            actor: event.actor || (String(event.side || "").match(/enemy|creature|monster/) ? "enemy" : "hero"),
            hit: event.hit !== false && event.outcome !== "miss"
        };
        if (!enemy && normalized.actor === "hero" && projection?.enemy) spawnEnemy(projection.enemy);
        schedule({ kind: "attack", event: normalized });
        addLog(event.message || `${event.ability || event.skillName || "Ataque"}: ${formatNumber(event.amount || 0)}.`, event.critical ? "critical" : "damage");
        return true;
    }

    function handleProjectionChange({ reason, event, snapshot } = {}) {
        projection = snapshot || Aethra.CombatProjection?.getSnapshot?.() || null;
        if (reason === "battle-started") {
            lastProjectedEventId = null;
            hero.dying = false;
            hero.alpha = 1;
            scene.darkness = 0;
            syncFromProjection();
            addLog(projection?.lastMessage || `Encontro contra ${projection?.enemy?.name || "uma criatura"}.`, "encounter");
            return;
        }
        if (reason === "action-resolved" && event) {
            syncFromProjection();
            visualizeAction(event);
            return;
        }
        if (reason === "battle-ended") {
            const outcome = projection?.lastOutcome;
            const finish = () => {
                if (outcome?.reason === "victory") enemyDefeated(outcome);
                else if (outcome?.reason === "defeat") heroDefeated();
                else if (enemy && !enemy.dying) {
                    enemy.dying = true;
                    enemy.deadAt = performance.now();
                }
            };
            // A morte espera o último golpe da fila aparecer.
            const wait = Math.max(0, scene.nextSlot - performance.now()) + 260 / speedFactor();
            window.setTimeout(finish, wait);
            addLog(outcome?.reason === "victory" ? `${outcome?.enemy?.name || "Criatura"} foi derrotado.` : outcome?.reason === "defeat" ? "O herói caiu." : "O encontro foi encerrado.",
                outcome?.reason === "victory" ? "victory" : "info");
            return;
        }
        syncFromProjection();
    }

    /* ---------------------------------------------------------------
       Laço de desenho
       --------------------------------------------------------------- */

    function drawProjectiles(geo, now) {
        for (let index = effects.length - 1; index >= 0; index -= 1) {
            const fx = effects[index];
            if (!fx.projectile) continue;
            const t = (now - fx.bornAt) / fx.duration;
            if (t < 0) continue;
            if (t >= 1) {
                effects.splice(index, 1);
                continue;
            }
            const x = fx.from + (fx.to - fx.from) * t;
            if (fx.projectile === "arrow") {
                const def = catalog().props?.arrow;
                const img = def ? image(def.src) : null;
                if (img) context.drawImage(img, Math.round(x), Math.round(fx.y), def.w * geo.unit, def.h * geo.unit);
            } else {
                const def = catalog().fx?.fireball;
                const img = def ? image(def.src) : null;
                if (img) {
                    const frame = Math.floor(now / 60) % def.frames;
                    const k = geo.unit * 1.4;
                    context.drawImage(img, frame * def.fw, 0, def.fw, def.fh, Math.round(x - def.fw * k / 2), Math.round(fx.y - def.fh * k / 2), def.fw * k, def.fh * k);
                }
            }
        }
    }

    function drawScene(now) {
        if (!running || !context || !canvas) return;
        const dt = clamp((now - (lastFrameAt || now)) / 1000, 0, 0.1);
        lastFrameAt = now;
        const geo = layout();
        context.imageSmoothingEnabled = false;
        if (isWalking()) scene.worldX += WALK_SPEED * Math.min(2.5, speedFactor()) * dt;
        if (zoneBackgroundKey() !== scene.zoneKey) {
            scene.zoneKey = zoneBackgroundKey();
            particles.length = 0;
        }
        runQueue(now);
        updateActors(now);

        context.save();
        if (scene.shakeUntil > now) {
            context.translate((visualRandom() - 0.5) * scene.shakePower * 2, (visualRandom() - 0.5) * scene.shakePower * 2);
        }
        drawBackground(geo, now);
        drawProp(geo, now);
        if (corpse) drawActor(corpse, geo, now);
        if (enemy) drawActor(enemy, geo, now);
        drawActor(hero, geo, now);
        drawEffects(geo, now);
        drawProjectiles(geo, now);
        drawCoins(geo, now);
        updateParticles(geo, now, dt);
        context.restore();

        if (scene.darkness > 0) {
            context.fillStyle = `rgba(0,0,0,${scene.darkness})`;
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
        drawHealthBar(enemy, geo, now);
        drawHealthBar(hero, geo, now);
        drawFloaters(geo, now);
        drawBanner(now);
        animationFrameId = requestAnimationFrame(drawScene);
    }

    /* ---------------------------------------------------------------
       Canvas e palco
       --------------------------------------------------------------- */

    function resizeCanvasToArena() {
        if (!canvas?.parentElement) return false;
        const parent = canvas.parentElement;
        const width = Math.max(TILE_SIZE * 12, Math.floor(parent.clientWidth));
        const height = Math.max(TILE_SIZE * 10, Math.floor(parent.clientHeight));
        if (canvas.width === width && canvas.height === height) return false;
        canvas.width = width;
        canvas.height = height;
        mapCols = Math.ceil(width / TILE_SIZE);
        mapRows = Math.ceil(height / TILE_SIZE);
        if (context) context.imageSmoothingEnabled = false;
        Aethra.EventBus.emit("tilemap:resized", {
            width, height, columns: mapCols, rows: mapRows,
            coveredWidth: mapCols * TILE_SIZE, coveredHeight: mapRows * TILE_SIZE
        });
        return true;
    }

    function setStageInsets(insets = {}) {
        stageInsets = ["top", "right", "bottom", "left"].reduce((result, side) => {
            result[side] = Math.max(0, Math.floor(Number(insets[side]) || 0));
            return result;
        }, {});
        return { ...stageInsets };
    }

    function ensureCanvasElement() {
        let element = document.getElementById("tilemap-canvas");
        if (!element) {
            element = document.createElement("canvas");
            element.id = "tilemap-canvas";
            element.width = 768;
            element.height = 512;
            element.setAttribute("aria-label", "Cena da expedição");
        }
        return element;
    }

    function placeCanvas(element) {
        const target = activeStageHost()
            || document.querySelector("#tilemap-canvas-root .tilemap-canvas-container");
        if (target && element.parentElement !== target) target.prepend(element);
        return Boolean(target);
    }

    function preload() {
        const key = zoneBackgroundKey();
        (catalog().backgrounds?.[key]?.layers || []).forEach((layer) => image(layer.src));
        Object.values(catalog().actors?.[hero.key || "vanguard"]?.anims || {}).forEach((anim) => image(anim.src));
        Object.values(catalog().fx || {}).forEach((fx) => image(fx.src));
        Object.values(catalog().props || {}).forEach((prop) => image(prop.src));
    }

    function startEngine() {
        const root = document.getElementById("tilemap-canvas-root");
        if (!root && !activeStageHost()) return false;
        if (root && !root.querySelector(".tilemap-canvas-container")) {
            root.innerHTML = `<div class="tilemap-workspace"><div class="tilemap-canvas-container">
                <div class="tilemap-chat-dock"><header>Registro da expedição</header><div class="tilemap-chat-log" id="tilemap-chat-log"></div></div>
            </div></div>`;
        }
        canvas = ensureCanvasElement();
        if (!placeCanvas(canvas)) return false;
        context = canvas.getContext?.("2d") || null;
        if (!context) return false;
        context.imageSmoothingEnabled = false;
        projection = Aethra.CombatProjection?.getSnapshot?.() || null;
        resizeCanvasToArena();
        syncFromProjection();
        preload();

        resizeObserver?.disconnect?.();
        if (typeof ResizeObserver === "function" && canvas.parentElement) {
            resizeObserver = new ResizeObserver(() => resizeCanvasToArena());
            resizeObserver.observe(canvas.parentElement);
        }
        if (!running) {
            running = true;
            lastFrameAt = 0;
            animationFrameId = requestAnimationFrame(drawScene);
        }
        Aethra.EventBus.emit("tilemap:ready", { huntId: currentHunt().huntId || null, zoneName: currentZoneName(), source: "combat-projection" });
        return true;
    }

    function setStageHost(element = null) {
        const next = element instanceof HTMLElement ? element : null;
        if (next === stageHost) return ensureStarted();
        stageHost = next;
        const started = startEngine();
        Aethra.EventBus.emit("tilemap:stage-changed", { hosted: Boolean(activeStageHost()), started });
        return started;
    }

    function ensureStarted() {
        if (!running || !canvas || !document.body.contains(canvas)) return startEngine();
        if (activeStageHost() && canvas.parentElement !== stageHost) return startEngine();
        resizeCanvasToArena();
        return true;
    }

    function syncEncounter(enemyPayload = null) {
        const candidate = enemyPayload?.enemy || enemyPayload?.creature || enemyPayload;
        const current = Aethra.CombatProjection?.getSnapshot?.() || projection || {};
        projection = { ...current, enemy: current.enemy || candidate || null };
        syncFromProjection();
        return Boolean(projection.enemy);
    }

    function banner(text, caption = "", color = "#ffe08a", duration = 1800) {
        scene.banner = { text, caption, color, duration, bornAt: performance.now() };
    }

    Aethra.EventBus.on("combat:projection-changed", handleProjectionChange);
    Aethra.EventBus.on("hunt:started", ({ hunt } = {}) => {
        ensureStarted();
        logs.length = 0;
        hero.dying = false;
        hero.alpha = 1;
        scene.darkness = 0;
        scene.prop = null;
        banner(hunt?.name || currentZoneName(), "Expedição iniciada");
        addLog(`Expedição iniciada em ${hunt?.name || currentZoneName()}.`, "encounter");
    });
    Aethra.EventBus.on("hunt:ended", () => {
        scene.prop = null;
        addLog("Expedição encerrada.", "info");
    });
    Aethra.EventBus.on("hunt:stairs-reached", () => {
        scene.prop = { kind: "stairs" };
    });
    Aethra.EventBus.on("hunt:room-entered", ({ room } = {}) => {
        scene.prop = null;
        if (room) banner(`Andar ${room}`, currentZoneName(), "#e9e2d0", 1400);
    });
    Aethra.EventBus.on("exploration:event-found", (event = {}) => {
        const id = String(event.id || event.definitionId || event.type || "");
        scene.prop = { kind: /chest/.test(id) ? "chest" : /camp/.test(id) ? "camp" : "spark", opened: false };
    });
    Aethra.EventBus.on("exploration:event-resolved", (event = {}) => {
        if (scene.prop?.kind === "chest") scene.prop.opened = true;
        if (canvas) {
            const geo = layout();
            spawnFx("spark", geo.heroX + 64 * geo.unit, geo.baseline - 20 * geo.unit, { scale: 1.6 });
        }
        window.setTimeout(() => { scene.prop = null; }, 900);
        return event;
    });
    Aethra.EventBus.on("levelUp", (payload = {}) => {
        if (!canvas) return;
        const geo = layout();
        spawnFx("aura", geo.heroX, geo.baseline - 6 * geo.unit, { scale: 3 });
        spawnFx("spark", geo.heroX, actorBody(hero, geo).center, { scale: 2.2 });
        banner(`Nível ${formatNumber(payload.level || Aethra.GameState?.hero?.level || 1)}!`, "Vida, mana e vigor restaurados", "#ffe08a", 2200);
    });
    ["EngineReady", "engine:ready", "state:restored"]
        .forEach((eventName) => Aethra.EventBus.on(eventName, () => setTimeout(startEngine, 60)));
    window.addEventListener("resize", resizeCanvasToArena, { passive: true });

    Aethra.TileMapCanvas = {
        start: startEngine,
        resize: resizeCanvasToArena,
        setStageHost,
        setStageInsets,
        isHosted: () => Boolean(activeStageHost() && canvas?.parentElement === stageHost),
        syncEncounter,
        triggerAttack: visualizeAction,
        castFor,
        getSnapshot: () => ({
            huntId: currentHunt().huntId || null,
            zoneName: currentZoneName(),
            source: "CombatProjection",
            background: zoneBackgroundKey(),
            hero: { sprite: hero.key, anim: hero.anim, dying: hero.dying },
            walking: isWalking(),
            enemy: enemy ? { sprite: enemy.key, anim: enemy.anim, name: enemy.name, dying: enemy.dying } : null,
            prop: currentProp()?.kind || null,
            activeEnemy: projection?.enemy ? { ...projection.enemy } : null,
            viewport: {
                width: canvas?.width || 0,
                height: canvas?.height || 0,
                columns: mapCols,
                rows: mapRows,
                coveredWidth: mapCols * TILE_SIZE,
                coveredHeight: mapRows * TILE_SIZE
            }
        })
    };
})(window.Aethra = window.Aethra || {});
