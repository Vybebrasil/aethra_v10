// TileMapCanvas.js — Tibia Hunt State Machine (Caminhada, Hordas, Magias, Abates e Escadas)
(function initTileMapCanvas(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const TILE_SIZE = 32;
    const MAP_COLS = 24;
    const MAP_ROWS = 16;

    let canvas = null;
    let ctx = null;
    let animationFrameId = null;
    let isRunning = false;
    let isTransitioningFloor = false;

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
    const STAIRS_POS = { x: 21, y: 8 };

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
        return Array.from({ length: MAP_ROWS }, (_, r) =>
            Array.from({ length: MAP_COLS }, (_, c) => {
                if (r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) return 2; // Wood log wall
                if (r === STAIRS_POS.y && c === STAIRS_POS.x) return 7; // Spiral Stone Staircase
                if (c >= 19 && Math.abs(r - STAIRS_POS.y) <= 2) return 6; // Stone floor near stairs
                if ((r === 1 || r === 2) && (c >= 2 && c <= 8)) return 4; // Tree patch
                if ((r === 1 || r === 2) && (c >= 12 && c <= 17)) return 5; // Flowers
                if (r >= 5 && r <= 11 && c >= 4 && c <= 18) return 1; // Dirt path
                return 0; // Grass
            })
        );
    }

    let mapGrid = buildRoomGrid();

    function spawnRoomHorde() {
        horde = [];
        const isBossFloor = waveState.currentWave === waveState.maxWaves;
        const count = isBossFloor ? 1 : Math.floor(Math.random() * 2 + 3); // 3 to 5 monsters scattered

        const spawnPositions = [
            { x: 9, y: 5 },
            { x: 14, y: 7 },
            { x: 11, y: 11 },
            { x: 17, y: 5 },
            { x: 16, y: 10 }
        ];

        for (let i = 0; i < count; i++) {
            const spec = isBossFloor ? MONSTER_SPECIES[4] : MONSTER_SPECIES[Math.floor(Math.random() * 4)];
            const pos = spawnPositions[i] || { x: 10 + i * 2, y: 6 };

            horde.push({
                id: `m_${i}_${Date.now()}`,
                key: spec.key,
                name: spec.name,
                hp: spec.hp + (waveState.currentFloor * 12),
                maxHp: spec.maxHp + (waveState.currentFloor * 12),
                x: pos.x,
                y: pos.y,
                baseX: pos.x,
                baseY: pos.y,
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
                // Walk player towards this target creature
                const target = horde[i];
                player.targetX = Math.max(2, target.x - 1);
                player.targetY = target.y;
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
        const bob = player.state === "walking" ? Math.sin(time * 0.015) * 3 : Math.sin(time * 0.006) * 2;

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
        horde.forEach((m) => {
            if (m.isDead || m.hp <= 0) return;

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

    function updatePhysics() {
        // Smooth player grid movement
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;

        if (Math.abs(dx) > 0.08 || Math.abs(dy) > 0.08) {
            player.x += dx * player.moveSpeed;
            player.y += dy * player.moveSpeed;
        } else {
            player.x = player.targetX;
            player.y = player.targetY;
            if (player.state === "walking") {
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

    // Active Hunt Tick — Hero Walks, Engages Target, Casts Spells & Collects Loot
    function executeHuntTick() {
        if (isTransitioningFloor) return;

        const aliveMonsters = horde.filter(m => !m.isDead && m.hp > 0);

        if (aliveMonsters.length === 0) {
            // Room cleared! Walk hero to the spiral stone stairs
            if (player.targetX !== STAIRS_POS.x || player.targetY !== STAIRS_POS.y) {
                player.targetX = STAIRS_POS.x;
                player.targetY = STAIRS_POS.y;
                player.state = "walking";
                addChatLog("Sala limpa! Caminhando para a escada de pedra...", "wave");
            } else if (Math.abs(player.x - STAIRS_POS.x) < 0.2 && Math.abs(player.y - STAIRS_POS.y) < 0.2) {
                triggerFloorClimb();
            }
            return;
        }

        // Get current target monster
        let target = horde[currentTargetIndex];
        if (!target || target.isDead || target.hp <= 0) {
            if (!selectNextAliveTarget()) return;
            target = horde[currentTargetIndex];
        }

        // Walk hero towards target if not yet in melee/spell range
        const dist = Math.hypot(player.x - target.x, player.y - target.y);
        if (dist > 2.5) {
            player.targetX = Math.max(2, target.x - 1);
            player.targetY = target.y;
            player.state = "walking";
            return;
        }

        // Hero is in range -> Execute Attack / Skill Chant
        player.state = "attacking";
        const skillName = getHeroActiveSkillName();
        player.spellText = skillName;
        player.spellTextTimer = 40;

        addChatLog(`Usou "${skillName}"!`, "spell");

        // Damage target monster
        target.hurtTimer = 16;
        const dmg = Math.floor(Math.random() * 30 + 20);
        const isCrit = Math.random() < 0.3;

        target.hp = Math.max(0, target.hp - dmg);

        const px = target.x * TILE_SIZE + 16;
        const py = target.y * TILE_SIZE;

        if (isCrit) {
            addFloatingText(`💥 ${dmg}!`, px, py - 6, "#ffcc00", 17);
            addChatLog(`Acerto crítico de ${dmg} em ${target.name}!`, "crit");
        } else {
            addFloatingText(`-${dmg}`, px, py, "#ff4d4d", 14);
            addChatLog(`Causou ${dmg} de dano em ${target.name}.`, "atk");
        }

        if (target.hp <= 0) {
            target.isDead = true;
            const goldLoot = Math.floor(Math.random() * 15 + 8);
            addFloatingText(`+${goldLoot} 🪙`, px, py - 18, "#ffd700", 13);
            addChatLog(`☠ ${target.name} foi derrotado! Loot: +${goldLoot} Ouro.`, "kill");

            // Dispatch loot event to backend GameState
            Aethra.EventBus.emit("goldChanged", { amount: goldLoot, total: (Aethra.GameState?.hero?.gold || 0) + goldLoot });

            // Select next target in horde
            selectNextAliveTarget();
        }
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
                <div class="floor-banner-sub">Subindo escadas de pedra... Novas criaturas encontradas!</div>
            `;
            container.appendChild(banner);
            setTimeout(() => banner.remove(), 2200);
        }

        setTimeout(() => {
            player.x = 4;
            player.y = 8;
            player.targetX = 4;
            player.targetY = 8;
            player.state = "idle";
            isTransitioningFloor = false;
            spawnRoomHorde();
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

        spawnRoomHorde();

        isRunning = true;
        animationFrameId = requestAnimationFrame(renderLoop);

        // Continuous active hunt loop — hero walks, targets creatures, casts spells & climbs floors!
        clearInterval(autoCombatInterval);
        autoCombatInterval = setInterval(() => {
            if (isRunning) executeHuntTick();
        }, 1200);
    }

    // Event bus listeners
    Aethra.EventBus.on("battle:damage-dealt", executeHuntTick);
    Aethra.EventBus.on("battle:round-processed", executeHuntTick);
    Aethra.EventBus.on("combat:hit", executeHuntTick);

    Aethra.TileMapCanvas = {
        start: startEngine,
        triggerAttack: executeHuntTick,
        triggerFloorClimb
    };

    Aethra.EventBus.on("EngineReady", () => setTimeout(startEngine, 100));
    Aethra.EventBus.on("engine:ready", () => setTimeout(startEngine, 100));
    Aethra.EventBus.on("render:all", () => setTimeout(startEngine, 50));
    Aethra.EventBus.on("state:restored", () => setTimeout(startEngine, 50));
})(window.Aethra = window.Aethra || {});
