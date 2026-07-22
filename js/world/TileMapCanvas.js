// TileMapCanvas.js — Tibia Hunt State Machine (Caminhada, Hordas, Magias, Abates e Escadas)
(function initTileMapCanvas(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const TILE_SIZE = 32;
    const BASE_MAP_COLS = 24;
    const BASE_MAP_ROWS = 16;
    let mapCols = BASE_MAP_COLS;
    let mapRows = BASE_MAP_ROWS;

    let canvas = null;
    let ctx = null;
    let animationFrameId = null;
    let isRunning = false;
    let isTransitioningFloor = false;
    let lastProjectedEventId = null;
    let canvasResizeObserver = null;

    // Progression & Floor State
    let waveState = {
        currentWave: 1,
        maxWaves: 5,
        currentFloor: 1,
        floorsCleared: 0
    };

    // Hero Entity State
    const player = {
        x: 4,
        y: 8,
        targetX: 4,
        targetY: 8,
        moveSpeed: 0.12, // Smooth Tibia tile walking speed
        animFrame: 0,
        animTimer: 0,
        state: "idle", // idle, walking, attacking, climbing
        attackTimer: 0,
        spellText: "",
        spellTextTimer: 0
    };

    // Horde of Creatures in current room
    let horde = [];
    let currentTargetIndex = -1;

    // Staircase position
    let stairsPos = { x: 19, y: 7 };

    const floatingTexts = [];
    const chatLogs = [];

    function getHeroActiveSkillName() {
        const equipped = Aethra.GameState?.hero?.equippedSkills;
        if (Array.isArray(equipped) && equipped.length > 0) {
            const first = equipped[0];
            const sk = Aethra.SkillSystem?.getSkill?.(first?.id || first);
            if (sk?.name) return sk.name;
        }
        const archetype = Aethra.GameState?.hero?.archetypeId;
        const ARCHETYPE_SKILLS = {
            vanguard: "Corte Preciso",
            berserker: "Golpe Brutal",
            arcanist: "Projétil de Fogo",
            ranger: "Tiro Mirado",
            nightblade: "Presa Dupla",
            templar: "Quebra-Armadura"
        };
        return ARCHETYPE_SKILLS[archetype] || "Corte Preciso";
    }

    const MONSTER_SPECIES = [
        { key: "goblin",   name: "Goblin Ladrão", hp: 60,  maxHp: 60 },
        { key: "wolf",     name: "Lobo Feroz",    hp: 85,  maxHp: 85 },
        { key: "skeleton", name: "Esqueleto",    hp: 110, maxHp: 110 },
        { key: "rat",      name: "Rato Gigante", hp: 45,  maxHp: 45 },
        { key: "boss",     name: "👹 DEMÔNIO ANCIÃO (MINI-BOSS)", hp: 320, maxHp: 320 }
    ];

    function addFloatingText(text, x, y, color = "#ff4d4d", fontSize = 14) {
        floatingTexts.push({
            text,
            x: x + (Math.random() * 12 - 6),
            y,
            vy: -1.2,
            alpha: 1.0,
            color,
            fontSize,
            life: 0
        });
    }

    function addChatLog(text, type = "info") {
        const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        chatLogs.unshift({ time, text, type });
        if (chatLogs.length > 6) chatLogs.pop();
        
        const chatEl = document.getElementById("tilemap-chat-log");
        if (chatEl) {
            chatEl.innerHTML = chatLogs.map(log => 
                `<div class="tilemap-chat-line tilemap-chat-line--${log.type}"><small>[${log.time}]</small> <span>${log.text}</span></div>`
            ).join("");
        }
    }

    function buildRoomGrid() {
        const dirtStartX = Math.max(3, Math.floor(mapCols * 0.18));
        const dirtEndX = Math.max(dirtStartX + 4, stairsPos.x - 1);
        const dirtStartY = Math.max(4, Math.floor(mapRows * 0.30));
        const dirtEndY = Math.min(mapRows - 3, Math.max(dirtStartY + 4, Math.ceil(mapRows * 0.72)));
        const treeEndX = Math.max(5, Math.floor(mapCols * 0.32));
        const flowerStartX = Math.max(treeEndX + 3, Math.floor(mapCols * 0.48));
        const flowerEndX = Math.min(mapCols - 3, Math.max(flowerStartX + 3, Math.floor(mapCols * 0.72)));

        return Array.from({ length: mapRows }, (_, r) =>
            Array.from({ length: mapCols }, (_, c) => {
                if (r === 0 || r === mapRows - 1 || c === 0 || c === mapCols - 1) return 2; // Wood log wall
                if (r === stairsPos.y && c === stairsPos.x) return 7; // Spiral Stone Staircase
                if (c >= stairsPos.x && Math.abs(r - stairsPos.y) <= 2) return 6; // Stone floor near stairs
                if ((r === 1 || r === 2) && c >= 2 && c <= treeEndX) return 4; // Tree patch
                if ((r === 1 || r === 2) && c >= flowerStartX && c <= flowerEndX) return 5; // Flowers
                if (r >= dirtStartY && r <= dirtEndY && c >= dirtStartX && c <= dirtEndX) return 1; // Dirt path
                return 0; // Grass
            })
        );
    }

    let mapGrid = buildRoomGrid();

    const clampCell = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || minimum));

    function heroSpawnPoint() {
        return {
            x: clampCell(Math.round(mapCols * 0.30), 3, mapCols - 6),
            y: clampCell(Math.round(mapRows * 0.55), 3, mapRows - 4)
        };
    }

    function enemySpawnPoint() {
        return {
            x: clampCell(Math.round(mapCols * 0.62), 7, stairsPos.x - 3),
            y: clampCell(stairsPos.y, 3, mapRows - 4)
        };
    }

    function resizeCanvasToArena(options = {}) {
        if (!canvas?.parentElement) return false;
        const parent = canvas.parentElement;
        const width = Math.floor(parent.clientWidth);
        const height = Math.floor(parent.clientHeight);
        if (width < TILE_SIZE * 8 || height < TILE_SIZE * 8) return false;

        const previousCols = mapCols;
        const previousRows = mapRows;
        const nextCols = Math.max(12, Math.ceil(width / TILE_SIZE));
        const nextRows = Math.max(10, Math.ceil(height / TILE_SIZE));
        const geometryChanged = canvas.width !== width
            || canvas.height !== height
            || nextCols !== mapCols
            || nextRows !== mapRows;
        if (!geometryChanged) return false;

        canvas.width = width;
        canvas.height = height;
        mapCols = nextCols;
        mapRows = nextRows;
        stairsPos = {
            x: Math.max(8, mapCols - 4),
            y: clampCell(Math.round(mapRows * 0.50), 3, mapRows - 4)
        };
        mapGrid = buildRoomGrid();

        if (options.resetPlayer === true) {
            const spawn = heroSpawnPoint();
            Object.assign(player, {
                x: spawn.x,
                y: spawn.y,
                targetX: spawn.x,
                targetY: spawn.y
            });
        } else if (previousCols > 0 && previousRows > 0) {
            const scaleX = mapCols / previousCols;
            const scaleY = mapRows / previousRows;
            player.x = clampCell(player.x * scaleX, 2, mapCols - 3);
            player.y = clampCell(player.y * scaleY, 2, mapRows - 3);
            player.targetX = clampCell(player.targetX * scaleX, 2, mapCols - 3);
            player.targetY = clampCell(player.targetY * scaleY, 2, mapRows - 3);
            horde.forEach((enemy) => {
                enemy.x = clampCell(enemy.x * scaleX, 3, mapCols - 4);
                enemy.y = clampCell(enemy.y * scaleY, 3, mapRows - 4);
                enemy.baseX = enemy.x;
                enemy.baseY = enemy.y;
            });
        }

        floatingTexts.length = 0;
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

    function spawnRoomHorde() {
        horde = [];
        const isBossFloor = waveState.currentWave === waveState.maxWaves;
        const count = isBossFloor ? 1 : Math.floor(Math.random() * 2 + 3); // 3 to 5 monsters scattered

        const center = enemySpawnPoint();
        const spawnPositions = [
            center,
            { x: center.x + 2, y: center.y - 2 },
            { x: center.x - 2, y: center.y + 2 },
            { x: center.x + 3, y: center.y + 2 },
            { x: center.x - 3, y: center.y - 2 }
        ].map((position) => ({
            x: clampCell(position.x, 3, stairsPos.x - 2),
            y: clampCell(position.y, 3, mapRows - 4)
        }));

        for (let i = 0; i < count; i++) {
            const spec = isBossFloor ? MONSTER_SPECIES[4] : MONSTER_SPECIES[Math.floor(Math.random() * 4)];
            const pos = spawnPositions[i] || { x: 10 + i * 2, y: 6 };

            const tileX = Math.round(pos.x);
            const tileY = Math.round(pos.y);

            horde.push({
                id: `m_${i}_${Date.now()}`,
                key: spec.key,
                name: spec.name,
                hp: spec.hp + (waveState.currentFloor * 12),
                maxHp: spec.maxHp + (waveState.currentFloor * 12),
                tileX: tileX,
                tileY: tileY,
                targetTileX: tileX,
                targetTileY: tileY,
                stepProgress: 1.0,
                stepSpeed: spec.key === "rat" || spec.key === "wolf" ? 0.08 : 0.05,
                x: tileX,
                y: tileY,
                baseX: tileX,
                baseY: tileY,
                thinkTimer: Math.floor(Math.random() * 15),
                hurtTimer: 0,
                isBoss: isBossFloor,
                isDead: false
            });
        }

        currentTargetIndex = 0;
        selectNextAliveTarget();
        renderWaveProgress();
    }

    function selectNextAliveTarget() {
        for (let i = 0; i < horde.length; i++) {
            if (!horde[i].isDead && horde[i].hp > 0) {
                currentTargetIndex = i;
                // Walk player towards this target creature (clamped strictly inside visible grid)
                const target = horde[i];
                player.targetX = clampCell(target.x - 1, 3, mapCols - 4);
                player.targetY = clampCell(target.y, 3, mapRows - 4);
                player.state = "walking";
                return true;
            }
        }
        currentTargetIndex = -1;
        return false;
    }

    function renderWaveProgress() {
        const barEl = document.getElementById("tilemap-wave-pips");
        if (!barEl) return;

        let html = "";
        for (let i = 1; i <= waveState.maxWaves; i++) {
            const isActive = i <= waveState.currentWave;
            const isCurrent = i === waveState.currentWave;
            const isBoss = i === waveState.maxWaves;
            html += `<span class="wave-pip ${isActive ? "is-active" : ""} ${isCurrent ? "is-current" : ""} ${isBoss ? "is-boss" : ""}" title="Onda ${i}">${isBoss ? "👹" : i}</span>`;
        }
        barEl.innerHTML = html;

        const bossBadge = document.getElementById("tilemap-boss-badge");
        if (bossBadge) {
            bossBadge.textContent = waveState.currentWave === waveState.maxWaves ? "👹 MINI-BOSS" : `ONDA ${waveState.currentWave}/5`;
            bossBadge.className = `tilemap-header__badge ${waveState.currentWave === waveState.maxWaves ? "is-boss-active" : ""}`;
        }
    }

    function renderJourneyStats() {
        const root = document.getElementById("tilemap-journey-stats");
        if (!root) return false;
        const totals = Aethra.ExplorationSystem?.getSnapshot?.().totals || {};
        root.innerHTML = `
            <span><small>Eventos</small><strong>${fmtNumber(totals.events)}</strong></span>
            <span><small>Recursos</small><strong>${fmtNumber(totals.resources)}</strong></span>
            <span><small>Skill XP</small><strong>${fmtNumber(totals.skillXP)}</strong></span>
            <span><small>Raros</small><strong>${fmtNumber(totals.rareEvents)}</strong></span>`;
        return true;
    }

    function drawTile(c, r, tileType, time) {
        const px = c * TILE_SIZE;
        const py = r * TILE_SIZE;

        if (tileType === 2) {
            ctx.fillStyle = "#4a321a";
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = "#2c1c0c";
            ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            ctx.fillStyle = "#6e4b28";
            ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, 4);
            return;
        }

        if (tileType === 6 || tileType === 7) {
            ctx.fillStyle = "#48525a";
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = "rgba(0,0,0,0.3)";
            ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);

            if (tileType === 7) {
                // Stone Spiral Staircase (Escada de Pedra Tibia)
                ctx.fillStyle = "#2c343c";
                ctx.beginPath();
                ctx.arc(px + 16, py + 16, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "#8a9aa8";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(px + 16, py + 16, 10, 0, Math.PI * 1.5);
                ctx.stroke();
                ctx.fillStyle = "#ffd700";
                ctx.font = "bold 8.5px Outfit, sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("▲ ANDAR", px + 16, py - 4);
            }
            return;
        }

        ctx.fillStyle = tileType === 1 ? "#5e4b33" : "#2a5427";
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);

        if (tileType === 0) {
            ctx.fillStyle = "rgba(60, 120, 50, 0.4)";
            ctx.fillRect(px + 6, py + 8, 4, 3);
            ctx.fillRect(px + 18, py + 20, 3, 4);
        } else if (tileType === 4) {
            ctx.fillStyle = "#3a2618";
            ctx.fillRect(px + 12, py + 18, 8, 14);
            ctx.fillStyle = "#1c4a18";
            ctx.beginPath();
            ctx.arc(px + 16, py + 12, 13, 0, Math.PI * 2);
            ctx.fill();
        } else if (tileType === 5) {
            ctx.fillStyle = "#255a20";
            ctx.beginPath();
            ctx.arc(px + 16, py + 16, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#e05585";
            ctx.fillRect(px + 14, py + 12, 4, 4);
        }
    }

    function drawPlayer(time) {
        const px = player.x * TILE_SIZE;
        const py = player.y * TILE_SIZE;
        const hurtShake = player.hurtTimer > 0 ? (Math.random() * 6 - 3) : 0;
        const bob = player.state === "walking" ? Math.sin(time * 0.015) * 3 : Math.sin(time * 0.006) * 2;

        ctx.strokeStyle = "rgba(120, 200, 255, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(px + 16 + hurtShake, py + 28 + bob, 12, 6, 0, 0, Math.PI * 2);
        ctx.stroke();

        const hero = Aethra.GameState?.hero || {};
        const archetypeId = hero.archetypeId || "vanguard";

        const spriteDrawn = Aethra.SpriteLoader?.draw?.(ctx, archetypeId, px + hurtShake, py + bob, 32, 32);

        if (!spriteDrawn) {
            ctx.fillStyle = player.hurtTimer > 0 ? "#ff7777" : "#2c4c68";
            ctx.fillRect(px + 9 + hurtShake, py + 12 + bob, 14, 14);
            ctx.fillStyle = "#8a9ea8";
            ctx.fillRect(px + 10 + hurtShake, py + 4 + bob, 12, 10);
            ctx.fillStyle = "#50c878";
            ctx.fillRect(px + 13 + hurtShake, py + 8 + bob, 6, 2);
        }

        if (player.spellTextTimer > 0) {
            ctx.save();
            ctx.fillStyle = "#ffe066";
            ctx.font = "bold 11px Outfit, sans-serif";
            ctx.shadowColor = "rgba(0,0,0,0.9)";
            ctx.shadowBlur = 5;
            ctx.textAlign = "center";
            ctx.fillText(player.spellText, px + 16, py - 20);
            ctx.restore();
        }

        const curHp = hero.hp || hero.stats?.hp || 50;
        const maxHp = hero.maxHp || hero.stats?.maxHp || 50;
        const hpPct = Math.max(0, Math.min(1, curHp / maxHp));

        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(px + 2, py - 10, 28, 4);
        ctx.fillStyle = "#50c878";
        ctx.fillRect(px + 2, py - 10, 28 * hpPct, 4);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(hero.name || "Herói", px + 16, py - 11);
    }

    function drawHorde(time) {
        horde.forEach((m, idx) => {
            if (m.isDead || m.hp <= 0) return;

            const px = m.x * TILE_SIZE;
            const py = m.y * TILE_SIZE;
            const shake = m.hurtTimer > 0 ? (Math.random() * 6 - 3) : 0;
            const bob = Math.sin(time * 0.005 + m.x + idx) * 2.5;
            const hpPct = Math.max(0, Math.min(1, m.hp / m.maxHp));

            const spriteDrawn = Aethra.SpriteLoader?.draw?.(ctx, m.key, px + shake, py + bob, 32, 32);

            if (!spriteDrawn) {
                ctx.fillStyle = m.hurtTimer > 0 ? "#ff4444" : "#8c3a3a";
                ctx.fillRect(px + 8 + shake, py + 10 + bob, 16, 16);
                ctx.fillStyle = "#ffff00";
                ctx.fillRect(px + 11 + shake, py + 13 + bob, 3, 3);
                ctx.fillRect(px + 18 + shake, py + 13 + bob, 3, 3);
            }

            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(px + 2, py - 10, 28, 4);
            ctx.fillStyle = m.isBoss ? "#ffd700" : "#e54d4d";
            ctx.fillRect(px + 2, py - 10, 28 * hpPct, 4);

            ctx.fillStyle = m.isBoss ? "#ffd700" : "#ff8888";
            ctx.font = "bold 8.5px Outfit, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(m.name, px + 16, py - 11);
        });
    }

    function updateAndDrawFloatingTexts() {
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            const ft = floatingTexts[i];
            ft.y += ft.vy;
            ft.life += 1;
            ft.alpha -= 0.02;

            if (ft.alpha <= 0 || ft.life > 60) {
                floatingTexts.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = Math.max(0, ft.alpha);
            ctx.fillStyle = ft.color;
            ctx.font = `bold ${ft.fontSize}px Outfit, sans-serif`;
            ctx.shadowColor = "rgba(0,0,0,0.9)";
            ctx.shadowBlur = 5;
            ctx.textAlign = "center";
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }
    }

    let combatStepCounter = 0;
    const STEP_OFFSETS = [
        { x: 0, y: -1 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 0 }
    ];

    function updatePhysics() {
        // Movimento suave do jogador
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;

        if (Math.abs(dx) > 0.08 || Math.abs(dy) > 0.08) {
            player.x += dx * player.moveSpeed;
            player.y += dy * player.moveSpeed;
        } else {
            player.x = player.targetX;
            player.y = player.targetY;

            // Kiting continuo e reposicionamento ativo durante o combate contra a horda!
            const target = horde[currentTargetIndex] || horde[0];
            if (target && !target.isDead && target.hp > 0 && !isTransitioningFloor) {
                combatStepCounter++;
                if (combatStepCounter % 35 === 0) {
                    const offset = STEP_OFFSETS[Math.floor(combatStepCounter / 35) % STEP_OFFSETS.length];
                    player.targetX = clampCell(target.x + offset.x, 3, mapCols - 4);
                    player.targetY = clampCell(target.y + offset.y, 3, mapRows - 4);
                    player.state = "walking";
                }
            } else if (player.state === "walking") {
                player.state = "idle";
            }
        }

        if (player.spellTextTimer > 0) player.spellTextTimer--;
        if (player.hurtTimer > 0) player.hurtTimer--;

        // Movimento por Passos Discretos de Grid 32x32 do Tibia
        horde.forEach((m, idx) => {
            if (m.hurtTimer > 0) m.hurtTimer--;
            if (m.isDead || m.hp <= 0) return;

            // Se o monstro está no meio do passo de 1 tile
            if (m.stepProgress < 1.0) {
                m.stepProgress = Math.min(1.0, m.stepProgress + (m.stepSpeed || 0.06));
                m.x = m.tileX + (m.targetTileX - m.tileX) * m.stepProgress;
                m.y = m.tileY + (m.targetTileY - m.tileY) * m.stepProgress;
                if (m.stepProgress >= 1.0) {
                    m.tileX = m.targetTileX;
                    m.tileY = m.targetTileY;
                    m.x = m.tileX;
                    m.y = m.tileY;
                }
                return;
            }

            // Monstro pronto para dar o próximo passo discreto de 1 tile
            if (m.thinkTimer > 0) {
                m.thinkTimer--;
                return;
            }

            // Escolher o próximo tile inteiro livre de cerco ao redor do herói
            const heroTileX = Math.round(player.x);
            const heroTileY = Math.round(player.y);
            const angles = [0, 0.78, 1.57, 2.35, 3.14, 3.92, 4.71, 5.49];
            const angle = angles[idx % angles.length];
            const idealX = clampCell(Math.round(heroTileX + Math.cos(angle)), 2, mapCols - 3);
            const idealY = clampCell(Math.round(heroTileY + Math.sin(angle)), 2, mapRows - 3);

            let nextX = m.tileX;
            let nextY = m.tileY;

            if (m.tileX < idealX) nextX++;
            else if (m.tileX > idealX) nextX--;

            if (m.tileY < idealY) nextY++;
            else if (m.tileY > idealY) nextY--;

            // Checar se o tile de destino está livre (não sobrepor outro monstro nem parede)
            const isBlocked = (mapGrid[nextY]?.[nextX] === 2) || horde.some((other, oIdx) =>
                oIdx !== idx && !other.isDead && (other.targetTileX === nextX && other.targetTileY === nextY)
            );

            if (!isBlocked && (nextX !== m.tileX || nextY !== m.tileY)) {
                m.targetTileX = nextX;
                m.targetTileY = nextY;
                m.stepProgress = 0.0;
                m.thinkTimer = Math.floor(Math.random() * 8 + 4);
            }
        });
    }

    function renderLoop(time) {
        if (!isRunning || !ctx || !canvas) return;

        updatePhysics();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let r = 0; r < mapRows; r++) {
            for (let c = 0; c < mapCols; c++) {
                drawTile(c, r, mapGrid[r][c], time);
            }
        }

        drawPlayer(time);
        drawHorde(time);
        updateAndDrawFloatingTexts();

        animationFrameId = requestAnimationFrame(renderLoop);
    }

    function resolveSpeciesKey(enemy = {}) {
        const value = `${enemy.id || ""} ${enemy.name || ""}`.toLowerCase();
        if (/wolf|lobo/.test(value)) return "wolf";
        if (/rat|rato/.test(value)) return "rat";
        if (/skeleton|esqueleto/.test(value)) return "skeleton";
        if (/goblin/.test(value)) return "goblin";
        if (/boss|demon|demônio|chefe/.test(value)) return "boss";
        return "goblin";
    }

    function syncEncounter(payload = {}) {
        const enemy = payload.enemy || payload.creature || payload;
        if (!enemy?.id && !enemy?.enemyId) return false;
        const encounterId = enemy.encounterId || enemy.id || enemy.enemyId;
        const hp = Math.max(1, Number(enemy.hp ?? enemy.stats?.hp ?? 1));
        const maxHp = Math.max(hp, Number(enemy.maxHp ?? enemy.stats?.maxHp ?? hp));

        if (!Array.isArray(horde) || horde.length === 0) {
            spawnRoomHorde();
        }

        if (horde[0]) {
            horde[0].id = encounterId;
            horde[0].name = enemy.name || horde[0].name;
            horde[0].hp = hp;
            horde[0].maxHp = maxHp;
            horde[0].key = resolveSpeciesKey(enemy);
        }

        selectNextAliveTarget();
        addChatLog(`${enemy.name || "Horda"} se aproximou.`, "wave");
        return true;
    }

    // O mapa apenas espelha o resultado calculado pelo BattleSystem.
    function executeHuntTick(payload = {}) {
        const target = horde[currentTargetIndex] || horde[0];
        if (!target || target.isDead) return false;
        const side = payload.side || payload.actor || payload.attacker;
        const amount = Math.max(0, Math.floor(Number(payload.amount) || 0));
        const hit = payload.hit !== false;
        const isHeroAttack = side === "hero";
        const skillName = payload.skillName || payload.abilityName || getHeroActiveSkillName();

        if (!hit) {
            const x = isHeroAttack ? target.x * TILE_SIZE + 16 : player.x * TILE_SIZE + 16;
            const y = isHeroAttack ? target.y * TILE_SIZE : player.y * TILE_SIZE;
            addFloatingText("ERROU", x, y, "#a9bac4", 12);
            addChatLog(payload.message || `${isHeroAttack ? "Herói" : target.name} errou o ataque.`, "info");
            return true;
        }

        if (isHeroAttack) {
            player.state = "attacking";
            player.spellText = skillName;
            player.spellTextTimer = 40;
            target.hurtTimer = 16;
            target.hp = Math.max(0, Number(Aethra.GameState?.battle?.creature?.hp ?? target.hp - amount));
            const x = target.x * TILE_SIZE + 16;
            const y = target.y * TILE_SIZE;

            // Efeito visual de magia/projétil se o herói for atacante a distância / arcano
            const px = player.x * TILE_SIZE + 16;
            const py = player.y * TILE_SIZE + 16;
            const isMagic = /fogo|projétil|arcano|raio|cura|foco|varinha/i.test(skillName);
            const beamColor = isMagic ? "#b87eff" : "#ffd700";
            addFloatingText(isMagic ? `✨ ${skillName}` : "", px, py - 14, beamColor, 11);

            addFloatingText(payload.isCrit ? `💥 ${amount}!` : `-${amount}`, x, y, payload.isCrit ? "#ffcc00" : "#ff4d4d", payload.isCrit ? 17 : 14);
            addChatLog(payload.message || `${skillName}: ${amount} de dano em ${target.name}.`, payload.isCrit ? "crit" : "atk");
        } else {
            player.hurtTimer = 16;
            const x = player.x * TILE_SIZE + 16;
            const y = player.y * TILE_SIZE;
            addFloatingText(payload.isBlocked ? `🛡 ${amount}` : `-${amount}`, x, y, payload.isBlocked ? "#79c9e8" : "#ff7180", 14);
            addChatLog(payload.message || `${target.name} causou ${amount} de dano no herói.`, payload.isBlocked ? "info" : "atk");
        }
        return true;
    }

    function visualizeDefeat(payload = {}) {
        const target = horde[currentTargetIndex] || horde[0];
        if (target) {
            target.hp = 0;
            target.isDead = true;
            const x = target.x * TILE_SIZE + 16;
            const y = target.y * TILE_SIZE;
            const rewards = payload.rewards || payload;
            if (Number(rewards.gold)) addFloatingText(`+${fmtNumber(rewards.gold)} G`, x, y - 18, "#ffd700", 13);
            if (Number(rewards.xp)) addFloatingText(`+${fmtNumber(rewards.xp)} XP`, x, y - 32, "#79c9e8", 13);
            addChatLog(`☠ ${target.name} derrotado. +${fmtNumber(rewards.xp)} XP · +${fmtNumber(rewards.gold)} G`, "kill");
        }

        const hasMoreEnemies = selectNextAliveTarget();
        if (!hasMoreEnemies) {
            setTimeout(() => {
                triggerFloorClimb();
            }, 600);
        }
        return true;
    }

    function fmtNumber(value) {
        return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.floor(Number(value) || 0)));
    }

    function triggerFloorClimb() {
        if (isTransitioningFloor) return;
        isTransitioningFloor = true;

        if (waveState.currentWave < waveState.maxWaves) {
            waveState.currentWave++;
        } else {
            waveState.floorsCleared++;
            waveState.currentFloor++;
            waveState.currentWave = 1;
        }

        const bannerTitle = waveState.currentWave === waveState.maxWaves
            ? `👹 SALA DO MINI-BOSS (ANDAR ${waveState.currentFloor})`
            : `▲ SUBINDO PARA A SALA ${waveState.currentWave}/5 (ANDAR ${waveState.currentFloor})`;

        const container = document.getElementById("tilemap-canvas-root");
        if (container) {
            const banner = document.createElement("div");
            banner.className = "floor-transition-banner";
            banner.innerHTML = `
                <div class="floor-banner-title">${bannerTitle}</div>
                <div class="floor-banner-sub">Subindo escadas de pedra... Horda encontrada!</div>
            `;
            container.appendChild(banner);
            setTimeout(() => banner.remove(), 1200);
        }

        spawnRoomHorde();
        const spawn = heroSpawnPoint();
        player.x = 2;
        player.y = stairsPos.y;
        player.targetX = spawn.x;
        player.targetY = spawn.y;
        player.state = "walking";

        setTimeout(() => {
            isTransitioningFloor = false;
            Aethra.EventBus.emit("tilemap:floor-changed", { ...waveState });
        }, 1200);
    }

    function startEngine() {
        const container = document.getElementById("tilemap-canvas-root");
        if (!container) return;
        if (isRunning && canvas && container.contains(canvas)) {
            resizeCanvasToArena();
            renderWaveProgress();
            renderJourneyStats();
            Aethra.IdleLoopSystem?.renderControls?.();
            return true;
        }

        const zoneName = Aethra.GameState?.huntState?.currentZoneName || "Bosque dos Sussurros";

        container.innerHTML = `
            <div class="tilemap-workspace">
                <div class="tilemap-header">
                    <div class="tilemap-header__left">
                        <span class="tilemap-zone-tag">🗺 ${zoneName} (Andar ${waveState.currentFloor})</span>
                        <div class="tilemap-wave-pips" id="tilemap-wave-pips"></div>
                    </div>
                    <div class="tilemap-header__right">
                        <span class="tilemap-header__badge" id="tilemap-boss-badge">ONDA 1/5</span>
                    </div>
                </div>

                <div id="idle-loop-controls-root"></div>

                <aside id="tilemap-journey-stats" class="tilemap-journey-stats expedition-live-stats" aria-label="Resumo da exploração"></aside>

                <div class="tilemap-canvas-container">
                    <canvas id="tilemap-canvas" width="${BASE_MAP_COLS * TILE_SIZE}" height="${BASE_MAP_ROWS * TILE_SIZE}"></canvas>
                    
                    <div class="tilemap-chat-dock">
                        <header><span>Log de Caçada em Tempo Real</span></header>
                        <div class="tilemap-chat-log" id="tilemap-chat-log">
                            <div class="tilemap-chat-line"><small>[Caçada]</small> <span>Iniciada no ${zoneName}... Herói em movimento!</span></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        canvas = document.getElementById("tilemap-canvas");
        if (!canvas) return;
        ctx = canvas.getContext("2d");

        resizeCanvasToArena({ resetPlayer: true });
        canvasResizeObserver?.disconnect?.();
        if (typeof ResizeObserver === "function" && canvas.parentElement) {
            canvasResizeObserver = new ResizeObserver(() => resizeCanvasToArena());
            canvasResizeObserver.observe(canvas.parentElement);
        }

        horde = [];
        currentTargetIndex = -1;
        const activeEnemy = Aethra.CombatProjection?.getSnapshot?.()?.enemy || null;
        if (activeEnemy) syncEncounter(activeEnemy);
        else addChatLog(Aethra.GameState?.hunt?.isActive ? "Explorando a região em busca de ameaças..." : "Escolha uma caçada para iniciar a jornada.", "info");
        renderJourneyStats();

        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        isRunning = true;
        animationFrameId = requestAnimationFrame(renderLoop);
        Aethra.EventBus.emit("tilemap:ready", { wave: { ...waveState } });
    }

    function ensureStarted() {
        if (!isRunning || !canvas || !document.body.contains(canvas)) startEngine();
    }

    Aethra.EventBus.on("hunt:started", ({ hunt } = {}) => {
        ensureStarted();
        waveState = { currentWave: 1, maxWaves: 5, currentFloor: 1, floorsCleared: 0 };
        horde = [];
        currentTargetIndex = -1;
        renderWaveProgress();
        addChatLog(`Caçada iniciada em ${hunt?.name || "Aethra"}.`, "wave");
    });
    Aethra.EventBus.on("combat:projection-changed", ({ reason, event, snapshot } = {}) => {
        ensureStarted();

        if (reason === "battle-started" && snapshot?.enemy) {
            lastProjectedEventId = null;
            syncEncounter(snapshot.enemy);
            return;
        }

        if (reason === "action-resolved" && event?.eventId && event.eventId !== lastProjectedEventId) {
            lastProjectedEventId = event.eventId;
            if (event.kind === "attack") executeHuntTick(event);
            else if (event.kind === "consumable") {
                addChatLog(event.message || `${event.actorName || "Herói"} usou ${event.ability}.`, "info");
            }
            return;
        }

        if (reason === "battle-ended") {
            const outcome = snapshot?.lastOutcome;
            if (outcome?.reason === "victory") {
                visualizeDefeat({
                    enemyId: outcome.enemy?.id,
                    enemy: outcome.enemy,
                    rewards: outcome.result?.rewards || outcome.result || {}
                });
            } else if (outcome?.reason === "defeat") {
                horde = [];
                currentTargetIndex = -1;
                addChatLog("O herói foi derrotado e retornou à cidade.", "crit");
            }
        }
    });
    Aethra.EventBus.on("hunt:ended", ({ reason } = {}) => {
        horde = [];
        currentTargetIndex = -1;
        addChatLog(reason === "hero-defeated" ? "Caçada encerrada por derrota." : "Caçada encerrada.", "info");
    });
    ["hunt:updated", "exploration:updated", "exploration:event-resolved", "profession:xpChanged"].forEach((eventName) => {
        Aethra.EventBus.on(eventName, renderJourneyStats);
    });

    Aethra.TileMapCanvas = {
        start: startEngine,
        triggerAttack: executeHuntTick,
        triggerFloorClimb,
        syncEncounter,
        resize: resizeCanvasToArena,
        getSnapshot: () => ({
            wave: { ...waveState },
            enemies: horde.map((enemy) => ({ ...enemy })),
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

    window.addEventListener("resize", () => resizeCanvasToArena());

    Aethra.EventBus.on("EngineReady", () => setTimeout(startEngine, 100));
    Aethra.EventBus.on("engine:ready", () => setTimeout(startEngine, 100));
    Aethra.EventBus.on("render:all", () => setTimeout(startEngine, 50));
    Aethra.EventBus.on("state:restored", () => setTimeout(startEngine, 50));
})(window.Aethra = window.Aethra || {});
