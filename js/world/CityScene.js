// CityScene.js
// Cena 2D da cidade: grid, movimento, colisão, interação e eventos.
(function (Aethra) {
    'use strict';

    if (!Aethra || !Aethra.EventBus || !Aethra.GameState) {
        throw new Error('CityScene.js requer game-core.js carregado antes.');
    }

    const DEFAULT_MAP = [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
        [1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1],
        [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
        [1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1],
        [1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1],
        [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1],
        [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
        [1, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ];

    const DEFAULT_ENTITIES = [
        {
            id: 'hunt_master',
            type: 'npc',
            name: 'Mestre das Caçadas',
            x: 8,
            y: 2,
            solid: true,
            icon: '⚔'
        },
        {
            id: 'blacksmith',
            type: 'npc',
            name: 'Ferreiro Torven',
            x: 2,
            y: 7,
            solid: true,
            icon: '⚒'
        },
        {
            id: 'market_door',
            type: 'door',
            name: 'Mercado',
            x: 10,
            y: 1,
            solid: false,
            targetScene: 'market',
            icon: '▣'
        },
        {
            id: 'south_gate',
            type: 'door',
            name: 'Portão Sul',
            x: 1,
            y: 10,
            solid: false,
            targetScene: 'world',
            icon: '⇩'
        }
    ];

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function ensureWorldState() {
        const state = Aethra.GameState;
        if (!state.world || typeof state.world !== 'object') state.world = {};
        if (!state.world.city || typeof state.world.city !== 'object') state.world.city = {};
        if (!state.world.city.playerPos) state.world.city.playerPos = { x: 2, y: 2 };
        if (!state.world.city.id) state.world.city.id = 'frontier_village';
        if (!state.world.scene) state.world.scene = 'city';
    }

    function isEditableTarget(target) {
        if (!target) return false;
        const tag = target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    }

    Aethra.CityScene = {
        containerSelector: '#city-grid',
        container: null,
        tileSize: 46,
        map: clone(DEFAULT_MAP),
        entities: clone(DEFAULT_ENTITIES),
        playerPos: { x: 2, y: 2 },
        initialized: false,
        keyboardEnabled: true,
        interactionRange: 1,
        _keyHandler: null,
        _clickHandler: null,

        init(options = {}) {
            ensureWorldState();

            if (Array.isArray(options.map)) this.setMap(options.map, { render: false });
            if (Array.isArray(options.entities)) this.setEntities(options.entities, { render: false });
            if (Number.isFinite(options.tileSize)) this.tileSize = Math.max(24, options.tileSize);
            if (typeof options.container === 'string') this.containerSelector = options.container;
            if (typeof options.keyboardEnabled === 'boolean') this.keyboardEnabled = options.keyboardEnabled;
            if (Number.isFinite(options.interactionRange)) {
                this.interactionRange = Math.max(0, Math.floor(options.interactionRange));
            }

            const savedPos = Aethra.GameState.world.city.playerPos;
            const startPos = options.startPosition || savedPos || { x: 2, y: 2 };
            this.playerPos = this.findNearestWalkable(startPos.x, startPos.y);
            this.writePositionToState();

            this.mount(this.containerSelector);
            this.bindEvents();
            this.render();
            this.initialized = true;

            Aethra.EventBus.emit('city:ready', {
                cityId: Aethra.GameState.world.city.id,
                position: { ...this.playerPos },
                map: this.map,
                entities: this.entities
            });

            return this;
        },

        mount(selector = this.containerSelector) {
            this.containerSelector = selector;
            this.container = document.querySelector(selector);

            if (!this.container) {
                Aethra.EventBus.emit('city:error', {
                    code: 'CONTAINER_NOT_FOUND',
                    selector
                });
                return null;
            }

            this.container.classList.add('aethra-city-grid');
            this.injectStyles();
            return this.container;
        },

        bindEvents() {
            this.unbindEvents();

            this._keyHandler = (event) => {
                if (!this.keyboardEnabled || isEditableTarget(event.target)) return;

                const key = event.key.toLowerCase();
                const directions = {
                    arrowup: [0, -1],
                    w: [0, -1],
                    arrowdown: [0, 1],
                    s: [0, 1],
                    arrowleft: [-1, 0],
                    a: [-1, 0],
                    arrowright: [1, 0],
                    d: [1, 0]
                };

                if (directions[key]) {
                    event.preventDefault();
                    const [dx, dy] = directions[key];
                    this.movePlayer(dx, dy, { source: 'keyboard' });
                    return;
                }

                if (key === 'e') {
                    const entity = this.getNearestInteractable();
                    if (entity) {
                        event.preventDefault();
                        this.interact(entity.x, entity.y, { source: 'keyboard' });
                    }
                }
            };

            this._clickHandler = (event) => {
                const tile = event.target.closest('[data-city-x][data-city-y]');
                if (!tile || !this.container || !this.container.contains(tile)) return;

                const x = Number(tile.dataset.cityX);
                const y = Number(tile.dataset.cityY);
                this.interact(x, y, { source: 'pointer' });
            };

            document.addEventListener('keydown', this._keyHandler);
            if (this.container) this.container.addEventListener('click', this._clickHandler);

            Aethra.EventBus.on('state:restored', () => {
                ensureWorldState();
                const pos = Aethra.GameState.world.city.playerPos || this.playerPos;
                this.playerPos = this.findNearestWalkable(pos.x, pos.y);
                this.render();
            });

            Aethra.EventBus.on('city:move', (payload = {}) => {
                this.movePlayer(Number(payload.dx) || 0, Number(payload.dy) || 0, {
                    source: payload.source || 'event'
                });
            });

            Aethra.EventBus.on('city:interact', (payload = {}) => {
                this.interact(Number(payload.x), Number(payload.y), {
                    source: payload.source || 'event'
                });
            });
        },

        unbindEvents() {
            if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
            if (this._clickHandler && this.container) {
                this.container.removeEventListener('click', this._clickHandler);
            }
            this._keyHandler = null;
            this._clickHandler = null;
        },

        movePlayer(dx, dy, meta = {}) {
            dx = Math.trunc(Number(dx) || 0);
            dy = Math.trunc(Number(dy) || 0);

            if (Math.abs(dx) + Math.abs(dy) !== 1) {
                Aethra.EventBus.emit('movementBlocked', {
                    reason: 'INVALID_DIRECTION',
                    from: { ...this.playerPos },
                    requestedDelta: { dx, dy }
                });
                return false;
            }

            const newX = this.playerPos.x + dx;
            const newY = this.playerPos.y + dy;

            if (!this.isInsideMap(newX, newY)) {
                this.emitBlocked('OUT_OF_BOUNDS', newX, newY, meta);
                return false;
            }

            if (!this.isWalkable(newX, newY)) {
                this.emitBlocked('COLLISION', newX, newY, meta);
                return false;
            }

            const previous = { ...this.playerPos };
            this.playerPos = { x: newX, y: newY };
            this.writePositionToState();
            this.renderPlayer();
            this.highlightNearbyInteractable();

            const payload = {
                previous,
                position: { ...this.playerPos },
                cityId: Aethra.GameState.world.city.id,
                source: meta.source || 'system'
            };

            Aethra.EventBus.emit('playerMoved', payload.position);
            Aethra.EventBus.emit('city:playerMoved', payload);
            return true;
        },

        interact(x, y, meta = {}) {
            x = Math.trunc(Number(x));
            y = Math.trunc(Number(y));

            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

            const entity = this.getEntityAt(x, y);
            if (!entity) {
                Aethra.EventBus.emit('city:interactionMissed', {
                    x,
                    y,
                    position: { ...this.playerPos },
                    source: meta.source || 'system'
                });
                return null;
            }

            const distance = this.manhattanDistance(this.playerPos, entity);
            if (distance > this.interactionRange) {
                Aethra.EventBus.emit('city:interactionBlocked', {
                    reason: 'TOO_FAR',
                    entity: { ...entity },
                    distance,
                    maxDistance: this.interactionRange
                });
                return null;
            }

            const basePayload = {
                entity: { ...entity },
                position: { x, y },
                playerPosition: { ...this.playerPos },
                source: meta.source || 'system'
            };

            Aethra.EventBus.emit('city:entityInteracted', basePayload);

            if (entity.type === 'npc') {
                Aethra.EventBus.emit('npcInteracted', entity);
                Aethra.EventBus.emit('city:npcInteracted', basePayload);
            } else if (entity.type === 'door') {
                Aethra.EventBus.emit('doorInteracted', entity);
                Aethra.EventBus.emit('city:doorInteracted', basePayload);

                if (entity.targetScene) {
                    Aethra.EventBus.emit('sceneTransitionRequested', {
                        from: 'city',
                        to: entity.targetScene,
                        via: entity.id
                    });
                }
            }

            return entity;
        },

        render() {
            if (!this.container) this.mount(this.containerSelector);
            if (!this.container) return false;

            const height = this.map.length;
            const width = Math.max(...this.map.map(row => row.length));

            this.container.style.setProperty('--city-tile-size', `${this.tileSize}px`);
            this.container.style.gridTemplateColumns = `repeat(${width}, var(--city-tile-size))`;
            this.container.innerHTML = '';

            const fragment = document.createDocumentFragment();

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const tileValue = this.map[y]?.[x] ?? 1;
                    const tile = document.createElement('button');
                    tile.type = 'button';
                    tile.className = `city-tile city-tile-${tileValue}`;
                    tile.dataset.cityX = String(x);
                    tile.dataset.cityY = String(y);
                    tile.setAttribute('aria-label', `Posição ${x}, ${y}`);

                    const entity = this.getEntityAt(x, y);
                    if (entity) {
                        tile.classList.add('has-entity', `entity-${entity.type}`);
                        tile.dataset.entityId = entity.id;
                        tile.title = entity.name || entity.id;

                        const entityElement = document.createElement('span');
                        entityElement.className = 'city-entity';
                        entityElement.textContent = entity.icon || (entity.type === 'npc' ? 'NPC' : '▣');
                        tile.appendChild(entityElement);
                    }

                    fragment.appendChild(tile);
                }
            }

            this.container.appendChild(fragment);
            this.renderPlayer();
            this.highlightNearbyInteractable();

            Aethra.EventBus.emit('city:rendered', {
                width,
                height,
                position: { ...this.playerPos }
            });

            return true;
        },

        renderPlayer() {
            if (!this.container) return;

            this.container.querySelectorAll('.city-player').forEach(node => node.remove());
            this.container.querySelectorAll('.is-player-tile').forEach(node => node.classList.remove('is-player-tile'));

            const tile = this.getTileElement(this.playerPos.x, this.playerPos.y);
            if (!tile) return;

            tile.classList.add('is-player-tile');

            const player = document.createElement('span');
            player.className = 'city-player';
            player.textContent = '◆';
            player.title = Aethra.GameState.hero?.name || 'Herói';
            tile.appendChild(player);
        },

        highlightNearbyInteractable() {
            if (!this.container) return;

            this.container.querySelectorAll('.is-interactable-nearby')
                .forEach(node => node.classList.remove('is-interactable-nearby'));

            const entity = this.getNearestInteractable();
            if (!entity) {
                Aethra.EventBus.emit('city:nearbyEntityChanged', null);
                return;
            }

            const tile = this.getTileElement(entity.x, entity.y);
            if (tile) tile.classList.add('is-interactable-nearby');

            Aethra.EventBus.emit('city:nearbyEntityChanged', { ...entity });
        },

        setMap(map, options = {}) {
            if (!Array.isArray(map) || map.length === 0 || !map.every(Array.isArray)) {
                throw new TypeError('CityScene.setMap(map): map deve ser uma matriz não vazia.');
            }

            this.map = clone(map);
            this.playerPos = this.findNearestWalkable(this.playerPos.x, this.playerPos.y);
            this.writePositionToState();

            if (options.render !== false) this.render();
            Aethra.EventBus.emit('city:mapChanged', { map: this.map });
        },

        setEntities(entities, options = {}) {
            if (!Array.isArray(entities)) {
                throw new TypeError('CityScene.setEntities(entities): entities deve ser um array.');
            }

            this.entities = clone(entities);
            if (options.render !== false) this.render();
            Aethra.EventBus.emit('city:entitiesChanged', { entities: this.entities });
        },

        addEntity(entity) {
            if (!entity || !entity.id || !Number.isInteger(entity.x) || !Number.isInteger(entity.y)) {
                throw new TypeError('Entidade inválida. Informe id, x e y inteiros.');
            }

            const existingIndex = this.entities.findIndex(item => item.id === entity.id);
            if (existingIndex >= 0) this.entities[existingIndex] = clone(entity);
            else this.entities.push(clone(entity));

            this.render();
            Aethra.EventBus.emit('city:entityAdded', { entity: clone(entity) });
        },

        removeEntity(entityId) {
            const index = this.entities.findIndex(entity => entity.id === entityId);
            if (index < 0) return false;

            const [removed] = this.entities.splice(index, 1);
            this.render();
            Aethra.EventBus.emit('city:entityRemoved', { entity: removed });
            return true;
        },

        isInsideMap(x, y) {
            return y >= 0 && y < this.map.length && x >= 0 && x < (this.map[y]?.length || 0);
        },

        isWalkable(x, y) {
            if (!this.isInsideMap(x, y)) return false;

            const tileValue = this.map[y][x];
            if (tileValue === 1) return false;

            const blockingEntity = this.entities.find(entity => (
                entity.x === x && entity.y === y && entity.solid === true
            ));

            return !blockingEntity;
        },

        getEntityAt(x, y) {
            return this.entities.find(entity => entity.x === x && entity.y === y) || null;
        },

        getNearestInteractable() {
            const candidates = this.entities
                .map(entity => ({
                    entity,
                    distance: this.manhattanDistance(this.playerPos, entity)
                }))
                .filter(entry => entry.distance <= this.interactionRange)
                .sort((a, b) => a.distance - b.distance);

            return candidates[0]?.entity || null;
        },

        getTileElement(x, y) {
            if (!this.container) return null;
            return this.container.querySelector(`[data-city-x="${x}"][data-city-y="${y}"]`);
        },

        findNearestWalkable(x, y) {
            const startX = Number.isFinite(Number(x)) ? Math.trunc(Number(x)) : 1;
            const startY = Number.isFinite(Number(y)) ? Math.trunc(Number(y)) : 1;

            if (this.isWalkable(startX, startY)) return { x: startX, y: startY };

            const queue = [{ x: startX, y: startY }];
            const visited = new Set([`${startX},${startY}`]);
            const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

            while (queue.length) {
                const current = queue.shift();

                for (const [dx, dy] of directions) {
                    const next = { x: current.x + dx, y: current.y + dy };
                    const key = `${next.x},${next.y}`;
                    if (visited.has(key)) continue;
                    visited.add(key);

                    if (this.isWalkable(next.x, next.y)) return next;
                    if (this.isInsideMap(next.x, next.y)) queue.push(next);
                }
            }

            return { x: 1, y: 1 };
        },

        manhattanDistance(a, b) {
            return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        },

        writePositionToState() {
            ensureWorldState();
            Aethra.GameState.world.city.playerPos = { ...this.playerPos };
        },

        emitBlocked(reason, x, y, meta = {}) {
            const entity = this.getEntityAt(x, y);
            const payload = {
                reason,
                from: { ...this.playerPos },
                target: { x, y },
                entity: entity ? { ...entity } : null,
                source: meta.source || 'system'
            };

            Aethra.EventBus.emit('movementBlocked', payload);
            Aethra.EventBus.emit('city:movementBlocked', payload);
        },

        destroy() {
            this.unbindEvents();
            if (this.container) this.container.innerHTML = '';
            this.container = null;
            this.initialized = false;
            Aethra.EventBus.emit('city:destroyed');
        },

        injectStyles() {
            if (document.getElementById('aethra-city-scene-styles')) return;

            const style = document.createElement('style');
            style.id = 'aethra-city-scene-styles';
            style.textContent = `
                .aethra-city-grid {
                    --city-tile-size: 46px;
                    display: grid;
                    width: max-content;
                    max-width: 100%;
                    overflow: auto;
                    border: 1px solid rgba(104, 146, 194, .45);
                    border-radius: 14px;
                    background: #07111d;
                    padding: 8px;
                    gap: 1px;
                    box-shadow: inset 0 0 28px rgba(0, 0, 0, .45);
                    user-select: none;
                }

                .city-tile {
                    position: relative;
                    width: var(--city-tile-size);
                    height: var(--city-tile-size);
                    padding: 0;
                    border: 0;
                    border-radius: 5px;
                    display: grid;
                    place-items: center;
                    color: #dce9ff;
                    cursor: pointer;
                    outline: none;
                }

                .city-tile-0 { background: linear-gradient(135deg, #263b38, #1a2c2a); }
                .city-tile-1 { background: linear-gradient(135deg, #303844, #171e28); cursor: not-allowed; }
                .city-tile-2 { background: linear-gradient(135deg, #745b2d, #3c2c17); }
                .city-tile-3 { background: linear-gradient(135deg, #476a75, #223944); }

                .city-tile:hover:not(.city-tile-1) {
                    box-shadow: inset 0 0 0 2px rgba(114, 184, 255, .35);
                }

                .city-entity,
                .city-player {
                    position: absolute;
                    display: grid;
                    place-items: center;
                    width: 72%;
                    height: 72%;
                    border-radius: 50%;
                    font-weight: 900;
                    pointer-events: none;
                }

                .city-entity {
                    background: #11253a;
                    border: 1px solid #5d89b8;
                    color: #efc76e;
                    font-size: 18px;
                }

                .city-player {
                    z-index: 5;
                    background: radial-gradient(circle at 35% 30%, #63b9ff, #185181 65%, #0b2946);
                    border: 2px solid #dceeff;
                    color: white;
                    box-shadow: 0 4px 14px rgba(0, 0, 0, .55), 0 0 16px rgba(77, 169, 255, .45);
                }

                .is-interactable-nearby {
                    animation: aethra-city-pulse 1.2s infinite alternate;
                    box-shadow: inset 0 0 0 2px #efc76e, 0 0 14px rgba(239, 199, 110, .45);
                }

                @keyframes aethra-city-pulse {
                    from { filter: brightness(1); }
                    to { filter: brightness(1.35); }
                }
            `;
            document.head.appendChild(style);
        }
    };
})(window.Aethra);
