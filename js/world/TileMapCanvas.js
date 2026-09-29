// TileMapCanvas.js — projeção visual do Hunt e do combate oficial.
(function initTileMapCanvas(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const TILE_SIZE = 32;
    const ACTOR_SIZE = 64;
    const MIN_COLS = 12;
    const MIN_ROWS = 10;
    const MAX_LOGS = 5;

    let canvas = null;
    let context = null;
    let animationFrameId = null;
    let resizeObserver = null;
    let running = false;
    let mapCols = 24;
    let mapRows = 16;
    let terrainKey = "whispering_forest";
    let projection = null;
    let lastProjectedEventId = null;

    const logs = [];
    const floatingTexts = [];
    const heroActor = { x: 0.34, y: 0.56, bob: 0, hurtUntil: 0, actionUntil: 0 };
    const enemyActor = { x: 0.66, y: 0.46, bob: 0, hurtUntil: 0, actionUntil: 0 };

    const clamp = (value, minimum, maximum) =>
        Math.min(maximum, Math.max(minimum, Number(value) || minimum));

    const formatNumber = (value) =>
        new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.floor(Number(value) || 0)));

    const escapeHTML = (value) => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    function hashText(value) {
        let hash = 2166136261;
        const text = String(value || "aethra");
        for (let index = 0; index < text.length; index += 1) {
            hash ^= text.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function cellNoise(column, row, salt = 0) {
        let value = hashText(terrainKey) ^ Math.imul(column + 11, 374761393);
        value ^= Math.imul(row + 17, 668265263);
        value ^= Math.imul(salt + 23, 2246822519);
        value = Math.imul(value ^ (value >>> 13), 1274126177);
        return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
    }

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

    function currentTerrainKey() {
        return String(currentHunt().huntId || "whispering_forest");
    }

    function paletteForZone() {
        const key = currentTerrainKey();
        if (/mine|gallery|crypt|dungeon|ruin/i.test(key)) {
            return {
                floor: ["#263237", "#2c383b", "#303d3e"],
                path: ["#465052", "#505a5b"],
                edge: "#182326",
                detail: "#657173",
                accent: "#6fc5e8",
                kind: "stone"
            };
        }
        if (/goblin|frontier/i.test(key)) {
            return {
                floor: ["#203f28", "#24472d", "#294d30"],
                path: ["#5d4a31", "#6a5336"],
                edge: "#13291b",
                detail: "#8d7044",
                accent: "#eabf55",
                kind: "frontier"
            };
        }
        if (/herb|clearing|green/i.test(key)) {
            return {
                floor: ["#245d39", "#29673e", "#307147"],
                path: ["#675437", "#735e3c"],
                edge: "#173d27",
                detail: "#8bdd72",
                accent: "#52d89b",
                kind: "clearing"
            };
        }
        return {
            floor: ["#1d4a2e", "#225335", "#275b39"],
            path: ["#604d34", "#6b573a"],
            edge: "#12301f",
            detail: "#6fa451",
            accent: "#52d89b",
            kind: "forest"
        };
    }

    function addLog(text, tone = "info") {
        const safeText = String(text || "").trim();
        if (!safeText) return false;
        logs.unshift({
            time: new Date().toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }),
            text: safeText,
            tone
        });
        logs.splice(MAX_LOGS);
        renderLogs();
        return true;
    }

    function renderLogs() {
        const root = document.getElementById("tilemap-chat-log");
        if (!root) return false;
        root.innerHTML = logs.length
            ? logs.map((entry) => `
                <div class="tilemap-chat-line tilemap-chat-line--${escapeHTML(entry.tone)}">
                    <small>[${escapeHTML(entry.time)}]</small>
                    <span>${escapeHTML(entry.text)}</span>
                </div>
            `).join("")
            : `<div class="tilemap-chat-line"><span>Aguardando atividade da expedição.</span></div>`;
        return true;
    }

    function addFloatingText(text, actor, tone = "damage") {
        const anchor = actor === "enemy" ? enemyActor : heroActor;
        const offset = (floatingTexts.length % 3 - 1) * 8;
        floatingTexts.push({
            text: String(text || ""),
            x: anchor.x,
            y: anchor.y,
            offset,
            bornAt: performance.now(),
            duration: 1050,
            tone
        });
    }

    function renderJourneyStats() {
        const root = document.getElementById("tilemap-journey-stats");
        const totals = Aethra.ExplorationSystem?.getSnapshot?.().totals || {};
        const battle = projection || Aethra.CombatProjection?.getSnapshot?.() || {};
        if (root) {
            root.innerHTML = `
                <span><small>Rodada</small><strong>${formatNumber(battle.round || 0)}</strong></span>
                <span><small>Eventos</small><strong>${formatNumber(totals.events || 0)}</strong></span>
                <span><small>Recursos</small><strong>${formatNumber(totals.resources || 0)}</strong></span>
                <span><small>Skill XP</small><strong>${formatNumber(totals.skillXP || 0)}</strong></span>
            `;
        }
        const visibleStats = {
            round: battle.round || 0,
            events: totals.events || 0,
            resources: totals.resources || 0,
            skillXP: totals.skillXP || 0
        };
        Object.entries(visibleStats).forEach(([key, value]) => {
            const target = document.querySelector(`[data-expedition-stat="${key}"]`);
            if (target) target.textContent = formatNumber(value);
        });
        return true;
    }

    function renderHeader() {
        const zone = document.querySelector("[data-tilemap-zone]");
        const badge = document.querySelector("[data-tilemap-status]");
        const battle = projection || Aethra.CombatProjection?.getSnapshot?.() || {};
        if (zone) zone.textContent = currentZoneName();
        if (badge) {
            badge.textContent = battle.active
                ? `RODADA ${Math.max(1, Number(battle.round || 1))}`
                : currentHunt().isActive
                    ? "EXPLORANDO"
                    : "AGUARDANDO HUNT";
            badge.classList.toggle("is-active", Boolean(battle.active));
        }
        renderJourneyStats();
    }

    function resizeCanvasToArena() {
        if (!canvas?.parentElement) return false;
        const parent = canvas.parentElement;
        const width = Math.max(TILE_SIZE * MIN_COLS, Math.floor(parent.clientWidth));
        const height = Math.max(TILE_SIZE * MIN_ROWS, Math.floor(parent.clientHeight));
        if (canvas.width === width && canvas.height === height) return false;

        canvas.width = width;
        canvas.height = height;
        mapCols = Math.max(MIN_COLS, Math.ceil(width / TILE_SIZE));
        mapRows = Math.max(MIN_ROWS, Math.ceil(height / TILE_SIZE));

        Aethra.EventBus.emit("tilemap:resized", {
            width,
            height,
            columns: mapCols,
            rows: mapRows,
            coveredWidth: mapCols * TILE_SIZE,
            coveredHeight: mapRows * TILE_SIZE
        });
        return true;
    }

    function isPathCell(column, row) {
        const centerY = Math.floor(mapRows * 0.55);
        const curve = Math.round(Math.sin(column * 0.42 + hashText(terrainKey) % 7) * 1.25);
        return Math.abs(row - centerY - curve) <= 1;
    }

    function isNearPathCell(column, row) {
        return [-2, -1, 0, 1, 2].some((offset) => isPathCell(column, row + offset));
    }

    function drawPixelTree(x, y, scale, palette) {
        context.fillStyle = "rgba(0,0,0,.22)";
        context.fillRect(x + scale * 0.3, y + scale * 0.76, scale * 0.52, scale * 0.14);
        context.fillStyle = "#26341f";
        context.fillRect(x + scale * 0.43, y + scale * 0.48, scale * 0.18, scale * 0.38);
        context.fillStyle = palette.edge;
        context.fillRect(x + scale * 0.16, y + scale * 0.18, scale * 0.68, scale * 0.46);
        context.fillStyle = palette.floor[1];
        context.fillRect(x + scale * 0.26, y + scale * 0.06, scale * 0.48, scale * 0.44);
        context.fillStyle = palette.detail;
        context.fillRect(x + scale * 0.34, y + scale * 0.12, scale * 0.16, scale * 0.11);
    }

    function drawPixelShrub(x, y, scale, palette) {
        context.fillStyle = "rgba(0,0,0,.18)";
        context.fillRect(x + scale * .12, y + scale * .7, scale * .76, scale * .14);
        context.fillStyle = palette.edge;
        context.fillRect(x + scale * .08, y + scale * .34, scale * .84, scale * .42);
        context.fillStyle = palette.floor[2];
        context.fillRect(x + scale * .18, y + scale * .18, scale * .34, scale * .46);
        context.fillRect(x + scale * .5, y + scale * .26, scale * .32, scale * .4);
        context.fillStyle = palette.detail;
        context.fillRect(x + scale * .27, y + scale * .26, scale * .12, scale * .1);
    }

    function drawPixelRock(x, y, scale, palette) {
        context.fillStyle = "rgba(0,0,0,.2)";
        context.fillRect(x + scale * .08, y + scale * .68, scale * .84, scale * .14);
        context.fillStyle = palette.edge;
        context.fillRect(x + scale * .13, y + scale * .37, scale * .72, scale * .4);
        context.fillStyle = palette.kind === "stone" ? palette.detail : "#73817a";
        context.fillRect(x + scale * .24, y + scale * .23, scale * .48, scale * .42);
        context.fillStyle = "rgba(235,245,239,.16)";
        context.fillRect(x + scale * .31, y + scale * .29, scale * .2, scale * .08);
    }

    function drawGrassCluster(x, y, palette, seed) {
        context.fillStyle = palette.detail;
        const offset = Math.floor(seed * 9);
        context.fillRect(x + 7 + offset, y + 18, 2, 7);
        context.fillRect(x + 4 + offset, y + 20, 2, 5);
        context.fillRect(x + 10 + offset, y + 16, 2, 9);
        context.fillStyle = "rgba(192,226,151,.24)";
        context.fillRect(x + 10 + offset, y + 15, 2, 2);
    }

    function drawTerrain() {
        const palette = paletteForZone();
        context.fillStyle = palette.floor[0];
        context.fillRect(0, 0, canvas.width, canvas.height);

        for (let row = 0; row < mapRows; row += 1) {
            for (let column = 0; column < mapCols; column += 1) {
                const x = column * TILE_SIZE;
                const y = row * TILE_SIZE;
                const noise = cellNoise(column, row);
                const edge = row < 2 || row >= mapRows - 2 || column < 1 || column >= mapCols - 1;
                const path = isPathCell(column, row);

                context.fillStyle = path
                    ? palette.path[noise > 0.52 ? 1 : 0]
                    : palette.floor[Math.min(2, Math.floor(noise * 3))];
                context.fillRect(x, y, TILE_SIZE + 1, TILE_SIZE + 1);

                if (path) {
                    context.fillStyle = "rgba(24, 17, 11, .14)";
                    const pebbleX = x + 5 + Math.floor(cellNoise(column, row, 2) * 20);
                    const pebbleY = y + 6 + Math.floor(cellNoise(column, row, 3) * 18);
                    context.fillRect(pebbleX, pebbleY, 3, 2);
                    if (cellNoise(column, row, 14) > .76) {
                        context.fillStyle = "rgba(224,195,127,.18)";
                        context.fillRect(x + 20, y + 10, 5, 3);
                    }
                } else if (!edge) {
                    const detailNoise = cellNoise(column, row, 11);
                    if (!isNearPathCell(column, row) && detailNoise > .945) {
                        drawPixelTree(x - 4, y - 10, 42, palette);
                    } else if (detailNoise > .84) {
                        drawPixelShrub(x + 4, y + 5, 25, palette);
                    } else if (detailNoise > .76 && cellNoise(column, row, 12) > .58) {
                        drawPixelRock(x + 7, y + 8, 22, palette);
                    } else if (detailNoise > .54) {
                        drawGrassCluster(x, y, palette, cellNoise(column, row, 13));
                    }
                }

                if (edge && cellNoise(column, row, 7) > 0.24) {
                    drawPixelTree(x - 8, y - 14, 48, palette);
                }
            }
        }

        context.strokeStyle = "rgba(222, 239, 225, .012)";
        context.lineWidth = 1;
        for (let column = 0; column <= mapCols; column += 1) {
            context.beginPath();
            context.moveTo(column * TILE_SIZE + 0.5, 0);
            context.lineTo(column * TILE_SIZE + 0.5, canvas.height);
            context.stroke();
        }
        for (let row = 0; row <= mapRows; row += 1) {
            context.beginPath();
            context.moveTo(0, row * TILE_SIZE + 0.5);
            context.lineTo(canvas.width, row * TILE_SIZE + 0.5);
            context.stroke();
        }
    }

    function actorPoint(actor) {
        const marginX = Math.min(130, canvas.width * 0.16);
        const marginY = Math.min(96, canvas.height * 0.18);
        return {
            x: marginX + actor.x * Math.max(1, canvas.width - marginX * 2),
            y: marginY + actor.y * Math.max(1, canvas.height - marginY * 2)
        };
    }

    function drawNameplate(point, name, resource, tone) {
        const label = String(name || "Aventureiro");
        const width = clamp(context.measureText(label).width + 24, 86, 164);
        const x = clamp(point.x - width / 2, 8, canvas.width - width - 8);
        const y = Math.max(8, point.y - 63);
        const maximum = Math.max(1, Number(resource?.maximum || 1));
        const current = clamp(Number(resource?.current ?? maximum), 0, maximum);

        context.fillStyle = "rgba(3, 9, 11, .86)";
        context.fillRect(x, y, width, 26);
        context.strokeStyle = "rgba(199, 226, 219, .24)";
        context.strokeRect(x + .5, y + .5, width - 1, 25);
        context.fillStyle = "#e7f0ee";
        context.font = "700 11px Outfit, sans-serif";
        context.textAlign = "center";
        context.fillText(label, x + width / 2, y + 11);
        context.fillStyle = "rgba(255,255,255,.09)";
        context.fillRect(x + 7, y + 18, width - 14, 4);
        context.fillStyle = tone;
        context.fillRect(x + 7, y + 18, (width - 14) * (current / maximum), 4);
    }

    function drawFallbackActor(point, tone, hurt) {
        context.fillStyle = "rgba(0,0,0,.3)";
        context.beginPath();
        context.ellipse(point.x, point.y + 19, 20, 7, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = hurt ? "#f0838d" : tone;
        context.fillRect(point.x - 13, point.y - 10, 26, 32);
        context.fillStyle = "#d7ddd9";
        context.fillRect(point.x - 9, point.y - 21, 18, 13);
    }

    function drawActor(actor, identity, spriteKey, tone, now) {
        const point = actorPoint(actor);
        const bob = Math.sin(now * 0.004 + actor.x * 10) * 1.6;
        const hurt = actor.hurtUntil > now;
        const action = actor.actionUntil > now;
        const shake = hurt ? Math.sin(now * .08) * 3 : 0;
        const drawX = Math.round(point.x - ACTOR_SIZE / 2 + shake + (action ? (actor === heroActor ? 5 : -5) : 0));
        const drawY = Math.round(point.y - ACTOR_SIZE / 2 + bob);

        context.fillStyle = "rgba(0,0,0,.34)";
        context.beginPath();
        context.ellipse(point.x + shake, point.y + 19, 19, 7, 0, 0, Math.PI * 2);
        context.fill();

        const spriteDrawn = Aethra.SpriteLoader?.draw?.(
            context,
            spriteKey,
            drawX,
            drawY,
            ACTOR_SIZE,
            ACTOR_SIZE
        );
        if (!spriteDrawn) drawFallbackActor(point, tone, hurt);
        drawNameplate(point, identity?.name, identity?.resources?.hp, tone);
        return point;
    }

    function resolveEnemySprite(enemy = {}) {
        const value = `${enemy.id || ""} ${enemy.name || ""}`.toLowerCase();
        if (/wolf|lobo/.test(value)) return "wolf";
        if (/rat|rato/.test(value)) return "rat";
        if (/skeleton|esqueleto/.test(value)) return "skeleton";
        if (/goblin/.test(value)) return "goblin";
        if (/boss|demon|demônio|chefe/.test(value)) return "boss";
        return "goblin";
    }

    function drawWaitingMarker(now) {
        const x = canvas.width * .68;
        const y = canvas.height * .48;
        const scale = clamp(Math.min(canvas.width / 760, canvas.height / 440), .9, 1.35);
        const markerRadius = 20 * scale;
        const panelWidth = 206 * scale;
        const panelHeight = 45 * scale;
        const pulse = .62 + Math.sin(now * .003) * .2;
        context.fillStyle = `rgba(82,216,155,${.05 + pulse * .04})`;
        context.beginPath();
        context.arc(x, y, markerRadius + 9 * scale, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = `rgba(82,216,155,${pulse})`;
        context.lineWidth = 2 * scale;
        context.beginPath();
        context.arc(x, y, markerRadius, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = "rgba(3,10,13,.88)";
        context.fillRect(x - panelWidth / 2, y + 31 * scale, panelWidth, panelHeight);
        context.strokeStyle = "rgba(82,216,155,.2)";
        context.strokeRect(x - panelWidth / 2 + .5, y + 31 * scale + .5, panelWidth - 1, panelHeight - 1);
        context.fillStyle = currentHunt().isActive ? "#9aafb2" : "#52d89b";
        context.font = `800 ${Math.round(11 * scale)}px Outfit, sans-serif`;
        context.textAlign = "center";
        context.fillText(
            currentHunt().isActive ? "PROCURANDO ENCONTRO" : "EXPEDIÇÃO DISPONÍVEL",
            x,
            y + 49 * scale
        );
        context.fillStyle = "#8ca5a7";
        context.font = `700 ${Math.round(7 * scale)}px Outfit, sans-serif`;
        context.fillText(
            currentHunt().isActive ? "A ROTA AVANÇA AUTOMATICAMENTE" : "ESCOLHA A ROTA NO PAINEL AO LADO",
            x,
            y + 64 * scale
        );
    }

    function drawFloatingTexts(now) {
        for (let index = floatingTexts.length - 1; index >= 0; index -= 1) {
            const entry = floatingTexts[index];
            const progress = clamp((now - entry.bornAt) / entry.duration, 0, 1);
            if (progress >= 1) {
                floatingTexts.splice(index, 1);
                continue;
            }
            const anchor = actorPoint({ x: entry.x, y: entry.y });
            context.save();
            context.globalAlpha = 1 - progress;
            context.fillStyle = entry.tone === "heal"
                ? "#52d89b"
                : entry.tone === "miss"
                    ? "#9aafb2"
                    : entry.tone === "critical"
                        ? "#eabf55"
                        : "#f06472";
            context.font = `800 ${entry.tone === "critical" ? 16 : 13}px Outfit, sans-serif`;
            context.textAlign = "center";
            context.shadowColor = "rgba(0,0,0,.82)";
            context.shadowBlur = 5;
            context.fillText(entry.text, anchor.x + entry.offset, anchor.y - 44 - progress * 34);
            context.restore();
        }
    }

    function drawScene(now) {
        if (!running || !context || !canvas) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawTerrain();

        const current = projection || Aethra.CombatProjection?.getSnapshot?.() || {};
        const hero = current.hero || {
            name: Aethra.GameState?.hero?.name || "Aethra",
            resources: { hp: { current: 1, maximum: 1 } }
        };
        const archetypeId = Aethra.GameState?.hero?.archetypeId || "vanguard";
        drawActor(heroActor, hero, archetypeId, "#52d89b", now);

        if (current.enemy) {
            drawActor(enemyActor, current.enemy, resolveEnemySprite(current.enemy), "#f06472", now);
        } else {
            drawWaitingMarker(now);
        }

        drawFloatingTexts(now);
        animationFrameId = requestAnimationFrame(drawScene);
    }

    function syncEncounter(enemy = null) {
        const candidate = enemy?.enemy || enemy?.creature || enemy;
        const current = Aethra.CombatProjection?.getSnapshot?.() || projection || {};
        projection = {
            ...current,
            enemy: current.enemy || candidate || null
        };
        renderHeader();
        return Boolean(projection.enemy);
    }

    function visualizeAction(event = {}) {
        if (!event || (event.eventId && event.eventId === lastProjectedEventId)) return false;
        if (event.eventId) lastProjectedEventId = event.eventId;

        const actor = event.actor === "enemy" ? enemyActor : heroActor;
        const target = event.actor === "enemy" ? heroActor : enemyActor;
        const targetName = event.targetName || (event.actor === "enemy" ? "Herói" : "Criatura");
        actor.actionUntil = performance.now() + 260;

        if (event.kind === "healing" || event.kind === "consumable") {
            addFloatingText(`+${formatNumber(event.amount || 0)}`, "hero", "heal");
            addLog(event.message || `${event.ability || "Recurso"} recuperou o herói.`, "heal");
            return true;
        }

        if (event.kind !== "attack") return false;
        if (event.hit === false || event.outcome === "miss") {
            addFloatingText("ERROU", target === enemyActor ? "enemy" : "hero", "miss");
            addLog(event.message || `${event.actorName || "Atacante"} errou ${targetName}.`, "info");
            return true;
        }

        target.hurtUntil = performance.now() + 320;
        addFloatingText(
            `-${formatNumber(event.amount || 0)}${event.critical ? "!" : ""}`,
            target === enemyActor ? "enemy" : "hero",
            event.critical ? "critical" : "damage"
        );
        addLog(
            event.message || `${event.ability || "Ataque"}: ${formatNumber(event.amount || 0)} em ${targetName}.`,
            event.critical ? "critical" : "damage"
        );
        return true;
    }

    function handleProjectionChange({ reason, event, snapshot } = {}) {
        projection = snapshot || Aethra.CombatProjection?.getSnapshot?.() || null;
        renderHeader();

        if (reason === "battle-started") {
            lastProjectedEventId = null;
            addLog(projection?.lastMessage || `Encontro iniciado contra ${projection?.enemy?.name || "uma criatura"}.`, "encounter");
            return;
        }
        if (reason === "action-resolved" && event) {
            visualizeAction(event);
            return;
        }
        if (reason === "battle-ended") {
            const outcome = projection?.lastOutcome;
            addLog(
                outcome?.reason === "victory"
                    ? `${outcome?.enemy?.name || "Criatura"} foi derrotado.`
                    : outcome?.reason === "defeat"
                        ? "O herói foi derrotado e retornará à cidade."
                        : "O encontro foi encerrado.",
                outcome?.reason === "victory" ? "victory" : "info"
            );
        }
    }

    function startEngine() {
        const root = document.getElementById("tilemap-canvas-root");
        if (!root) return false;
        terrainKey = currentTerrainKey();

        if (!root.querySelector(".tilemap-workspace")) {
            root.innerHTML = `
                <div class="tilemap-workspace">
                    <header class="tilemap-header">
                        <div class="tilemap-header__left">
                            <span class="tilemap-zone-tag" data-tilemap-zone>${escapeHTML(currentZoneName())}</span>
                        </div>
                        <div class="tilemap-header__right">
                            <span class="tilemap-header__badge" data-tilemap-status>AGUARDANDO HUNT</span>
                        </div>
                    </header>
                    <aside id="tilemap-journey-stats" class="tilemap-journey-stats" aria-label="Resumo da expedição"></aside>
                    <div class="tilemap-canvas-container">
                        <canvas id="tilemap-canvas" width="768" height="512" aria-label="Mapa tático da expedição"></canvas>
                        <div class="tilemap-chat-dock">
                            <header>Registro da expedição</header>
                            <div class="tilemap-chat-log" id="tilemap-chat-log"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        canvas = document.getElementById("tilemap-canvas");
        context = canvas?.getContext?.("2d") || null;
        if (!canvas || !context) return false;

        context.imageSmoothingEnabled = false;
        projection = Aethra.CombatProjection?.getSnapshot?.() || null;
        resizeCanvasToArena();
        renderHeader();
        renderLogs();

        resizeObserver?.disconnect?.();
        if (typeof ResizeObserver === "function" && canvas.parentElement) {
            resizeObserver = new ResizeObserver(() => resizeCanvasToArena());
            resizeObserver.observe(canvas.parentElement);
        }

        if (!running) {
            running = true;
            animationFrameId = requestAnimationFrame(drawScene);
        }

        Aethra.EventBus.emit("tilemap:ready", {
            huntId: currentHunt().huntId || null,
            zoneName: currentZoneName(),
            source: "combat-projection"
        });
        return true;
    }

    function ensureStarted() {
        if (!running || !canvas || !document.body.contains(canvas)) {
            return startEngine();
        }
        terrainKey = currentTerrainKey();
        resizeCanvasToArena();
        renderHeader();
        return true;
    }

    Aethra.EventBus.on("combat:projection-changed", handleProjectionChange);
    Aethra.EventBus.on("hunt:started", ({ hunt } = {}) => {
        ensureStarted();
        terrainKey = currentTerrainKey();
        logs.length = 0;
        addLog(`Expedição iniciada em ${hunt?.name || currentZoneName()}.`, "encounter");
        renderHeader();
    });
    Aethra.EventBus.on("hunt:ended", () => {
        addLog("Expedição encerrada.", "info");
        renderHeader();
    });
    ["hunt:updated", "exploration:updated", "exploration:event-resolved", "profession:xpChanged"]
        .forEach((eventName) => Aethra.EventBus.on(eventName, renderJourneyStats));
    ["EngineReady", "engine:ready", "render:all", "state:restored"]
        .forEach((eventName) => Aethra.EventBus.on(eventName, () => setTimeout(startEngine, 60)));

    window.addEventListener("resize", resizeCanvasToArena, { passive: true });

    Aethra.TileMapCanvas = {
        start: startEngine,
        resize: resizeCanvasToArena,
        syncEncounter,
        triggerAttack: visualizeAction,
        getSnapshot: () => ({
            huntId: currentHunt().huntId || null,
            zoneName: currentZoneName(),
            source: "CombatProjection",
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
