// TileMapCanvas.js — Visor de Arena 2D Tibia/Baiak Idle com Hordas de Criaturas, Magias e Troca de Andares
(function initTileMapCanvas(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const TILE_SIZE = 32;
    const MAP_COLS = 24;
    const MAP_ROWS = 16;

    let canvas = null;
    let ctx = null;
    let animationFrameId = null;
    let autoCombatInterval = null;
    let isRunning = false;
    let isTransitioningFloor = false;

    // Progression State
    let waveState = {
        currentWave: 1,
        maxWaves: 5,
        currentFloor: 1,
        floorsCleared: 0,
        isBossWave: false
    };

    // Hero Entity
    const player = {
        x: 6,
        y: 8,
        targetX: 6,
        targetY: 8,
        animFrame: 0,
        animTimer: 0,
        state: "idle", // idle, move, cast, attack
        attackTimer: 0,
        spellText: "",
        spellTextTimer: 0
    };

    // Horde of Creatures (Array of active monsters in current room)
    let horde = [];

    // Staircase Position (Right side of the room)
    const STAIRS_POS = { x: 21, y: 7 };

    // Floating Combat Text array
    const floatingTexts = [];
    const chatLogs = [];

    const SPELL_LIST = [
        "exori infir",
        "exori mas",
        "adori infir mas tere",
        "exori gran",
        "exori amp vis"
    ];

    const MONSTER_SPECIES = [
        { key: "goblin",   name: "Goblin Ladrão", hp: 60,  maxHp: 60 },
        { key: "wolf",     name: "Lobo Feroz",    hp: 85,  maxHp: 85 },
        { key: "skeleton", name: "Esqueleto",    hp: 110, maxHp: 110 },
        { key: "rat",      name: "Rato Gigante", hp: 45,  maxHp: 45 },
        { key: "boss",     name: "👹 DEMÔNIO ANCIÃO (MINI-BOSS)", hp: 300, maxHp: 300 }
    ];

    function addFloatingText(text, x, y, color = "#ff4d4d", fontSize = 14) {
        floatingTexts.push({
            text,
            x: x + (Math.random() * 14 - 7),
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

    // Rich Tibia Room Map Grid Generation
    // 0: grass, 1: dirt path, 2: wood log wall, 3: water, 4: tree, 5: flower/bush, 6: stone floor, 7: spiral stairs
    function buildRoomGrid() {
        return Array.from({ length: MAP_ROWS }, (_, r) =>
            Array.from({ length: MAP_COLS }, (_, c) => {
                // Outer wooden log wall border
                if (r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) return 2;
                // Staircase tile on right
                if (r === STAIRS_POS.y && c === STAIRS_POS.x) return 7;
                // Stone path on right side near stairs
                if (c >= 20 && Math.abs(r - 7) <= 2) return 6;
                // Dense grass & trees
                if ((r === 1 || r === 2) && (c >= 2 && c <= 8)) return 4; // Top trees
                if ((r === 1 || r === 2) && (c >= 12 && c <= 17)) return 5; // Flower garden
                if (r >= 4 && r <= 12 && c >= 3 && c <= 18) return 0; // Central grass arena
                return 0;
            })
        );
    }

    let mapGrid = buildRoomGrid();

    function spawnHorde() {
        horde = [];
        const isBoss = waveState.currentWave === waveState.maxWaves;
        const monsterCount = isBoss ? 1 : Math.floor(Math.random() * 3 + 3); // 3 to 5 monsters!

        for (let i = 0; i < monsterCount; i++) {
            const spec = isBoss
                ? MONSTER_SPECIES[4]
                : MONSTER_SPECIES[Math.floor(Math.random() * 4)];

            // Position monsters in a cluster on the right side of room
            const posX = 12 + Math.floor(Math.random() * 6);
            const posY = 4 + Math.floor(Math.random() * 7);

            horde.push({
                id: `m_${i}_${Date.now()}`,
                key: spec.key,
                name: spec.name,
                hp: spec.hp + (waveState.currentFloor * 10),
                maxHp: spec.maxHp + (waveState.currentFloor * 10),
                x: posX,
                y: posY,
                baseX: posX,
                baseY: posY,
                hurtTimer: 0,
                isBoss
            });
        }

        renderWaveProgress();
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

    function drawTile(c, r, tileType, time) {
        const px = c * TILE_SIZE;
        const py = r * TILE_SIZE;

        if (tileType === 2) {
            // Wood Log Wall (Tibia border)
            ctx.fillStyle = "#4a321a";
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = "#2c1c0c";
            ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            ctx.fillStyle = "#6e4b28";
            ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, 4);
            return;
        }

        if (tileType === 6 || tileType === 7) {
            // Stone floor
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
                ctx.font = "bold 9px Outfit, sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("▲ ANDAR", px + 16, py - 4);
            }
            return;
        }

        // Base Grass / Path
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
            // Tree
            ctx.fillStyle = "#3a2618";
            ctx.fillRect(px + 12, py + 18, 8, 14);
            ctx.fillStyle = "#1c4a18";
            ctx.beginPath();
            ctx.arc(px + 16, py + 12, 13, 0, Math.PI * 2);
            ctx.fill();
        } else if (tileType === 5) {
            // Bush / Flowers
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
        const bob = Math.sin(time * 0.006) * 2;

        // Selection highlight ring
        ctx.strokeStyle = "rgba(120, 200, 255, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(px + 16, py + 28, 12, 6, 0, 0, Math.PI * 2);
        ctx.stroke();

        const hero = Aethra.GameState?.hero || {};
        const archetypeId = hero.archetypeId || "vanguard";

        const spriteDrawn = Aethra.SpriteLoader?.draw?.(ctx, archetypeId, px, py + bob, 32, 32);

        if (!spriteDrawn) {
            ctx.fillStyle = "#2c4c68";
            ctx.fillRect(px + 9, py + 12 + bob, 14, 14);
            ctx.fillStyle = "#8a9ea8";
            ctx.fillRect(px + 10, py + 4 + bob, 12, 10);
            ctx.fillStyle = "#50c878";
            ctx.fillRect(px + 13, py + 8 + bob, 6, 2);
        }

        // Spell chant text overhead (e.g., "exori infir pug")
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

        // Overhead HP bar
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
        horde.forEach((m) => {
            if (m.hp <= 0) return; // Monster dead

            const px = m.x * TILE_SIZE;
            const py = m.y * TILE_SIZE;
            const shake = m.hurtTimer > 0 ? (Math.random() * 4 - 2) : 0;
            const bob = Math.sin(time * 0.005 + m.x) * 2;
            const hpPct = Math.max(0, Math.min(1, m.hp / m.maxHp));

            const spriteDrawn = Aethra.SpriteLoader?.draw?.(ctx, m.key, px + shake, py + bob, 32, 32);

            if (!spriteDrawn) {
                ctx.fillStyle = m.hurtTimer > 0 ? "#ff8888" : "#8c3a3a";
                ctx.fillRect(px + 8 + shake, py + 10 + bob, 16, 16);
                ctx.fillStyle = "#ffff00";
                ctx.fillRect(px + 11 + shake, py + 13 + bob, 3, 3);
                ctx.fillRect(px + 18 + shake, py + 13 + bob, 3, 3);
            }

            // Overhead HP bar
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(px + 2, py - 10, 28, 4);
            ctx.fillStyle = m.isBoss ? "#ffd700" : "#e54d4d";
            ctx.fillRect(px + 2, py - 10, 28 * hpPct, 4);

            // Name tag overhead
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

    function updatePhysics() {
        // Player smooth movement
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        if (Math.abs(dx) > 0.05) player.x += dx * 0.22;
        else player.x = player.targetX;

        if (Math.abs(dy) > 0.05) player.y += dy * 0.22;
        else player.y = player.targetY;

        if (player.attackTimer > 0) {
            player.attackTimer--;
            if (player.attackTimer === 0) {
                player.state = "idle";
            }
        }

        if (player.spellTextTimer > 0) player.spellTextTimer--;

        horde.forEach((m) => {
            if (m.hurtTimer > 0) m.hurtTimer--;
        });
    }

    function renderLoop(time) {
        if (!isRunning || !ctx || !canvas) return;

        updatePhysics();

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                drawTile(c, r, mapGrid[r][c], time);
            }
        }

        drawPlayer(time);
        drawHorde(time);
        updateAndDrawFloatingTexts();

        animationFrameId = requestAnimationFrame(renderLoop);
    }

    function triggerHordeAttack() {
        if (isTransitioningFloor) return;

        const aliveMonsters = horde.filter(m => m.hp > 0);
        if (aliveMonsters.length === 0) {
            // Wave cleared!
            if (waveState.currentWave < waveState.maxWaves) {
                waveState.currentWave++;
                addChatLog(`Horda eliminada! Avançando para a Onda ${waveState.currentWave}/5...`, "wave");
                spawnHorde();
            } else {
                // All 5 waves cleared on this floor → Walk to stairs & climb floor!
                triggerFloorTransition();
            }
            return;
        }

        // Target nearest alive monster
        const target = aliveMonsters[0];

        // Move player towards target
        player.targetX = Math.max(2, target.x - 2);
        player.targetY = target.y;
        player.state = "attack";
        player.attackTimer = 16;

        // Spell chant
        const spell = SPELL_LIST[Math.floor(Math.random() * SPELL_LIST.length)];
        player.spellText = spell;
        player.spellTextTimer = 45;
        addChatLog(`Magia: "${spell}"`, "spell");

        // Damage all alive monsters in horde (AoE spell hit!)
        aliveMonsters.forEach((m) => {
            m.hurtTimer = 16;
            const dmg = Math.floor(Math.random() * 30 + 20);
            const isCrit = Math.random() < 0.3;

            m.hp = Math.max(0, m.hp - dmg);

            const px = m.x * TILE_SIZE + 16;
            const py = m.y * TILE_SIZE;

            if (isCrit) {
                addFloatingText(`💥 ${dmg}!`, px, py - 6, "#ffcc00", 17);
            } else {
                addFloatingText(`-${dmg}`, px, py, "#ff4d4d", 14);
            }

            if (m.hp === 0) {
                addChatLog(`☠ ${m.name} foi derrotado!`, "kill");
            }
        });
    }

    function triggerFloorTransition() {
        isTransitioningFloor = true;
        waveState.floorsCleared++;
        waveState.currentFloor++;
        waveState.currentWave = 1;

        addChatLog(`🏆 Sala e Mini-Boss derrotados! Subindo para o Andar ${waveState.currentFloor}...`, "boss");

        // Walk player to stairs
        player.targetX = STAIRS_POS.x;
        player.targetY = STAIRS_POS.y;

        const container = document.getElementById("tilemap-canvas-root");
        if (container) {
            const banner = document.createElement("div");
            banner.className = "floor-transition-banner";
            banner.innerHTML = `
                <div class="floor-banner-title">▲ SUBINDO PARA O ANDAR ${waveState.currentFloor}</div>
                <div class="floor-banner-sub">Novas hordas de criaturas aguardam...</div>
            `;
            container.appendChild(banner);
            setTimeout(() => banner.remove(), 2200);
        }

        setTimeout(() => {
            player.x = 6;
            player.y = 8;
            player.targetX = 6;
            player.targetY = 8;
            isTransitioningFloor = false;
            spawnHorde();
        }, 2200);
    }

    function startEngine() {
        const container = document.getElementById("tilemap-canvas-root");
        if (!container) return;

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
                        <button type="button" class="tilemap-btn" id="tilemap-loop-btn">🔄 Loop</button>
                    </div>
                </div>

                <div class="tilemap-canvas-container">
                    <canvas id="tilemap-canvas" width="${MAP_COLS * TILE_SIZE}" height="${MAP_ROWS * TILE_SIZE}"></canvas>
                    
                    <div class="tilemap-chat-dock">
                        <header><span>Log de Combate & Chat</span></header>
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

        spawnHorde();

        isRunning = true;
        animationFrameId = requestAnimationFrame(renderLoop);

        // Continuous active combat tick simulation every 1.6 seconds
        clearInterval(autoCombatInterval);
        autoCombatInterval = setInterval(() => {
            if (isRunning) triggerHordeAttack();
        }, 1600);
    }

    // Event bus listeners
    Aethra.EventBus.on("battle:damage-dealt", triggerHordeAttack);
    Aethra.EventBus.on("battle:round-processed", triggerHordeAttack);
    Aethra.EventBus.on("combat:hit", triggerHordeAttack);

    Aethra.TileMapCanvas = {
        start: startEngine,
        triggerAttack: triggerHordeAttack,
        triggerFloorTransition
    };

    Aethra.EventBus.on("EngineReady", () => setTimeout(startEngine, 100));
    Aethra.EventBus.on("engine:ready", () => setTimeout(startEngine, 100));
    Aethra.EventBus.on("render:all", () => setTimeout(startEngine, 50));
    Aethra.EventBus.on("state:restored", () => setTimeout(startEngine, 50));
})(window.Aethra = window.Aethra || {});
