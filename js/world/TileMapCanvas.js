// TileMapCanvas.js — Engine de Mapa 2D estilo Tibia/Poketibia Idle (Canvas Top-Down/Isometric)
(function initTileMapCanvas(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const TILE_SIZE = 32;
    const MAP_COLS = 22;
    const MAP_ROWS = 14;

    let canvas = null;
    let ctx = null;
    let animationFrameId = null;
    let isRunning = false;

    // Entities on map
    const player = {
        x: 6,
        y: 7,
        animFrame: 0,
        animTimer: 0,
        state: "idle", // idle, attack, hurt
        attackTimer: 0,
        targetX: 6,
        targetY: 7
    };

    const monster = {
        x: 15,
        y: 7,
        animFrame: 0,
        animTimer: 0,
        state: "idle",
        hurtTimer: 0,
        name: "Goblin",
        hp: 100,
        maxHp: 100
    };

    // Floating Combat Text array
    const floatingTexts = [];

    function addFloatingText(text, x, y, color = "#ff4d4d", fontSize = 14) {
        floatingTexts.push({
            text,
            x: x + (Math.random() * 16 - 8),
            y,
            vy: -1.2,
            alpha: 1.0,
            color,
            fontSize,
            life: 0
        });
    }

    // Procedural TileMap matrix (0: grass, 1: path/dirt, 2: stone wall, 3: water, 4: tree, 5: flower/bush)
    const mapGrid = Array.from({ length: MAP_ROWS }, (_, r) =>
        Array.from({ length: MAP_COLS }, (_, c) => {
            if (r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) return 2; // stone border
            if (r >= 6 && r <= 8 && c >= 4 && c <= 17) return 1; // dirt path in middle
            if ((r === 2 || r === 3) && (c === 3 || c === 4 || c === 18 || c === 19)) return 4; // trees
            if ((r === 11 || r === 12) && (c === 8 || c === 9 || c === 10)) return 3; // water pond
            if (Math.random() < 0.08) return 5; // flower
            return 0; // grass
        })
    );

    // Color definitions for procedurally drawn tiles/sprites
    const TILE_COLORS = {
        0: "#2a5427", // grass base
        1: "#635037", // dirt path
        2: "#3a444d", // stone wall
        3: "#1a4b6e", // water
        4: "#1c3c1a", // tree
        5: "#2a5427"  // grass with flower
    };

    function drawTile(c, r, tileType, time) {
        const px = c * TILE_SIZE;
        const py = r * TILE_SIZE;

        // Base color
        ctx.fillStyle = TILE_COLORS[tileType] || "#2a5427";
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        // Tile grid outline (subtle Tibia tile border)
        ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);

        // Details
        if (tileType === 0) {
            // Grass texture dots
            ctx.fillStyle = "rgba(60, 120, 50, 0.4)";
            ctx.fillRect(px + 6, py + 8, 3, 3);
            ctx.fillRect(px + 20, py + 18, 4, 3);
        } else if (tileType === 1) {
            // Dirt texture
            ctx.fillStyle = "rgba(40, 30, 20, 0.3)";
            ctx.fillRect(px + 10, py + 12, 4, 4);
            ctx.fillRect(px + 22, py + 6, 3, 3);
        } else if (tileType === 3) {
            // Water animation
            const wave = Math.sin(time * 0.003 + c + r) * 3;
            ctx.fillStyle = "rgba(100, 200, 255, 0.25)";
            ctx.fillRect(px + 4 + wave, py + 12, 12, 3);
        } else if (tileType === 4) {
            // Tree trunk + leaves
            ctx.fillStyle = "#3a2618";
            ctx.fillRect(px + 12, py + 18, 8, 14);
            ctx.fillStyle = "#1e4d1b";
            ctx.beginPath();
            ctx.arc(px + 16, py + 12, 12, 0, Math.PI * 2);
            ctx.fill();
        } else if (tileType === 5) {
            // Flower
            ctx.fillStyle = "#e05585";
            ctx.fillRect(px + 14, py + 14, 4, 4);
        }
    }

    function drawPlayer(time) {
        const px = player.x * TILE_SIZE;
        const py = player.y * TILE_SIZE;
        const bob = Math.sin(time * 0.006) * 2;

        // Selection highlight ring
        ctx.strokeStyle = "rgba(120, 200, 255, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(px + 16, py + 28, 12, 6, 0, 0, Math.PI * 2);
        ctx.stroke();

        const hero = Aethra.GameState?.hero || {};
        const archetypeId = hero.archetypeId || "vanguard";

        // Try drawing sprite image via SpriteLoader first
        const spriteDrawn = Aethra.SpriteLoader?.draw?.(ctx, archetypeId, px, py + bob, 32, 32);

        if (!spriteDrawn) {
            // Procedural fallback character drawing
            ctx.fillStyle = "#2c4c68";
            ctx.fillRect(px + 9, py + 12 + bob, 14, 14);

            ctx.fillStyle = "#8a9ea8";
            ctx.fillRect(px + 10, py + 4 + bob, 12, 10);

            ctx.fillStyle = "#50c878";
            ctx.fillRect(px + 13, py + 8 + bob, 6, 2);

            ctx.fillStyle = "#d9b85f";
            if (player.state === "attack") {
                ctx.strokeStyle = "#ffe066";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(px + 28, py + 16, 16, -Math.PI / 4, Math.PI / 4);
                ctx.stroke();
                ctx.fillRect(px + 24, py + 10, 10, 4);
            } else {
                ctx.fillRect(px + 4, py + 12 + bob, 5, 12);
            }
        }

        // Overhead HP bar
        const curHp = hero.hp || hero.stats?.hp || 50;
        const maxHp = hero.maxHp || hero.stats?.maxHp || 50;
        const hpPct = Math.max(0, Math.min(1, curHp / maxHp));

        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(px + 2, py - 10, 28, 4);
        ctx.fillStyle = "#50c878";
        ctx.fillRect(px + 2, py - 10, 28 * hpPct, 4);

        // Name tag overhead
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(hero.name || "Herói", px + 16, py - 13);
    }

    function drawMonster(time) {
        const currentEnemy = Aethra.GameState?.battle?.enemy || Aethra.GameState?.huntState?.currentMonster || null;
        const mName = currentEnemy?.name || monster.name || "Inimigo";
        const mCurHp = currentEnemy?.hp || monster.hp;
        const mMaxHp = currentEnemy?.maxHp || monster.maxHp || 100;
        const hpPct = Math.max(0, Math.min(1, mCurHp / mMaxHp));

        const px = monster.x * TILE_SIZE;
        const py = monster.y * TILE_SIZE;
        const shake = monster.hurtTimer > 0 ? (Math.random() * 4 - 2) : 0;
        const bob = Math.sin(time * 0.005 + 1) * 2;

        const mKey = (currentEnemy?.id || "monster").toLowerCase();
        const spriteDrawn = Aethra.SpriteLoader?.draw?.(ctx, mKey, px + shake, py + bob, 32, 32);

        if (!spriteDrawn) {
            // Procedural fallback monster drawing
            ctx.fillStyle = monster.hurtTimer > 0 ? "#ff8888" : "#8c3a3a";
            ctx.fillRect(px + 8 + shake, py + 10 + bob, 16, 16);

            ctx.fillStyle = "#ffff00";
            ctx.fillRect(px + 11 + shake, py + 13 + bob, 3, 3);
            ctx.fillRect(px + 18 + shake, py + 13 + bob, 3, 3);

            ctx.fillStyle = "#e0e0e0";
            ctx.fillRect(px + 7 + shake, py + 6 + bob, 4, 6);
            ctx.fillRect(px + 21 + shake, py + 6 + bob, 4, 6);
        }

        // Overhead HP bar
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(px + 2, py - 10, 28, 4);
        ctx.fillStyle = "#e54d4d";
        ctx.fillRect(px + 2, py - 10, 28 * hpPct, 4);

        // Name tag
        ctx.fillStyle = "#ff6666";
        ctx.font = "bold 9px Outfit, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(mName, px + 16, py - 13);
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
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.shadowBlur = 4;
            ctx.textAlign = "center";
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
        }
    }

    function renderLoop(time) {
        if (!isRunning || !ctx || !canvas) return;

        // Timers update
        if (player.attackTimer > 0) player.attackTimer--;
        else player.state = "idle";

        if (monster.hurtTimer > 0) monster.hurtTimer--;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw tile map grid
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                drawTile(c, r, mapGrid[r][c], time);
            }
        }

        // Draw entities
        drawPlayer(time);
        drawMonster(time);

        // Draw floating combat numbers
        updateAndDrawFloatingTexts();

        animationFrameId = requestAnimationFrame(renderLoop);
    }

    // Wave State Tracking
    let waveState = {
        currentWave: 1,
        maxWaves: 5,
        isBossWave: false,
        isLoop: true,
        floorsCleared: 0
    };

    const chatLogs = [];

    function addChatLog(text, type = "info") {
        const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        chatLogs.unshift({ time, text, type });
        if (chatLogs.length > 5) chatLogs.pop();
        
        const chatEl = document.getElementById("tilemap-chat-log");
        if (chatEl) {
            chatEl.innerHTML = chatLogs.map(log => 
                `<div class="tilemap-chat-line tilemap-chat-line--${log.type}"><small>[${log.time}]</small> <span>${log.text}</span></div>`
            ).join("");
        }
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

    function advanceWave() {
        if (waveState.currentWave < waveState.maxWaves) {
            waveState.currentWave++;
            addChatLog(`Avançou para a Onda ${waveState.currentWave}/5 da sala!`, "wave");
        } else {
            // Cleared Wave 5 / Boss
            waveState.floorsCleared++;
            addChatLog(`🏆 Mini-Boss derrotado! Sala ${waveState.floorsCleared} limpa. Avançando...`, "boss");
            waveState.currentWave = 1;
        }
        renderWaveProgress();
    }

    function startEngine() {
        const container = document.getElementById("tilemap-canvas-root");
        if (!container) return;

        const zoneName = Aethra.GameState?.huntState?.currentZoneName || "Bosque dos Sussurros";

        container.innerHTML = `
            <div class="tilemap-workspace">
                <div class="tilemap-header">
                    <div class="tilemap-header__left">
                        <span class="tilemap-zone-tag">🗺 ${zoneName}</span>
                        <div class="tilemap-wave-pips" id="tilemap-wave-pips"></div>
                    </div>
                    <div class="tilemap-header__right">
                        <span class="tilemap-header__badge" id="tilemap-boss-badge">ONDA 1/5</span>
                        <button type="button" class="tilemap-btn" id="tilemap-loop-btn">🔄 Loop</button>
                    </div>
                </div>

                <div class="tilemap-canvas-container">
                    <canvas id="tilemap-canvas" width="${MAP_COLS * TILE_SIZE}" height="${MAP_ROWS * TILE_SIZE}"></canvas>
                    
                    <!-- Chat / Log Overlay in bottom-left corner of map viewport (Baiak style) -->
                    <div class="tilemap-chat-dock">
                        <header><span>Log de Combate</span></header>
                        <div class="tilemap-chat-log" id="tilemap-chat-log">
                            <div class="tilemap-chat-line"><small>[Sessão]</small> <span>Caçada iniciada em ${zoneName}...</span></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        canvas = document.getElementById("tilemap-canvas");
        if (!canvas) return;
        ctx = canvas.getContext("2d");

        renderWaveProgress();

        isRunning = true;
        animationFrameId = requestAnimationFrame(renderLoop);
    }

    function triggerAttackAnimation(payload = {}) {
        player.state = "attack";
        player.attackTimer = 12;
        monster.hurtTimer = 14;

        const dmg = payload.damage || payload.amount || Math.floor(Math.random() * 20 + 10);
        const isCrit = payload.isCrit || payload.critical;
        const isEvade = payload.evaded || payload.type === "evasion";
        const isBlock = payload.blocked || payload.type === "block";

        const px = monster.x * TILE_SIZE + 16;
        const py = monster.y * TILE_SIZE;

        if (isEvade) {
            addFloatingText("ESQUIVA!", px, py, "#79c9e8", 13);
            addChatLog("Você se esquivou do ataque!", "def");
        } else if (isBlock) {
            addFloatingText("BLOQUEIO!", px, py, "#d9b85f", 13);
            addChatLog("Ataque bloqueado com sucesso!", "def");
        } else if (isCrit) {
            addFloatingText(`💥 ${dmg}!`, px, py - 5, "#ffcc00", 17);
            addChatLog(`Ataque crítico de ${dmg} de dano!`, "crit");
        } else {
            addFloatingText(`-${dmg}`, px, py, "#ff4d4d", 14);
            addChatLog(`Causou ${dmg} de dano no inimigo.`, "atk");
        }
    }

    function onEnemyDefeated(payload = {}) {
        const name = payload.enemyName || payload.name || "Inimigo";
        addChatLog(`☠ ${name} foi derrotado!`, "kill");
        advanceWave();
    }

    // Event bus listeners for combat integration
    Aethra.EventBus.on("battle:damage-dealt", triggerAttackAnimation);
    Aethra.EventBus.on("battle:round-processed", triggerAttackAnimation);
    Aethra.EventBus.on("combat:hit", triggerAttackAnimation);
    Aethra.EventBus.on("EnemyDefeated", onEnemyDefeated);
    Aethra.EventBus.on("battle:enemy-defeated", onEnemyDefeated);

    Aethra.TileMapCanvas = {
        start: startEngine,
        triggerAttack: triggerAttackAnimation,
        advanceWave
    };

    // Auto mount when container is available
    Aethra.EventBus.on("EngineReady", () => setTimeout(startEngine, 100));
    Aethra.EventBus.on("engine:ready", () => setTimeout(startEngine, 100));
    Aethra.EventBus.on("render:all", () => setTimeout(startEngine, 50));
    Aethra.EventBus.on("state:restored", () => setTimeout(startEngine, 50));
})(window.Aethra = window.Aethra || {});

