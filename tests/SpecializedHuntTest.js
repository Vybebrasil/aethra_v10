const assert = require('assert');
const path = require('path');

global.window = global;
global.localStorage = {
  store: new Map(),
  getItem(key) { return this.store.has(key) ? this.store.get(key) : null; },
  setItem(key, value) { this.store.set(key, String(value)); },
  removeItem(key) { this.store.delete(key); }
};

global.Aethra = {
  GameState: {
    hero: { level: 20, gold: 0, stats: { maxHp: 100, hp: 100 } },
    hunt: {},
    professions: {},
    exploration: {},
    ui: {}
  },
  EventBus: {
    handlers: new Map(),
    events: [],
    on(name, fn) {
      if (!this.handlers.has(name)) this.handlers.set(name, []);
      this.handlers.get(name).push(fn);
    },
    emit(name, payload) {
      this.events.push({ name, payload });
      (this.handlers.get(name) || []).forEach((fn) => fn(payload));
    }
  },
  Commands: {},
  GameData: {
    items: {},
    creatures: {
      'bandit-xmm-2024': { id: 'bandit-xmm-2024', name: 'Bandido', hp: 20, xp: 10, damage: 4, stats: {}, type: 'humanoid', rank: 'normal' },
      'gargoyle-xmm-2024': { id: 'gargoyle-xmm-2024', name: 'Gárgula', hp: 60, xp: 40, damage: 8, stats: {}, type: 'construct', rank: 'normal' },
      'wolf-xmm-2024': { id: 'wolf-xmm-2024', name: 'Lobo', hp: 24, xp: 12, damage: 5, stats: {}, type: 'beast', tags: ['skinnable'], rank: 'normal' },
      'skeleton-xmm-2024': { id: 'skeleton-xmm-2024', name: 'Esqueleto', hp: 30, xp: 18, damage: 6, stats: {}, type: 'undead', rank: 'normal' },
      'orc-mm': { id: 'orc-mm', name: 'Orc', hp: 36, xp: 20, damage: 7, stats: {}, type: 'humanoid', rank: 'normal' },
      'hobgoblin-mm': { id: 'hobgoblin-mm', name: 'Hobgoblin', hp: 38, xp: 22, damage: 7, stats: {}, type: 'humanoid', rank: 'normal' },
      'bugbear-mm': { id: 'bugbear-mm', name: 'Bugbear', hp: 45, xp: 25, damage: 8, stats: {}, type: 'humanoid', rank: 'normal' },
      'ogre-xmm-2024': { id: 'ogre-xmm-2024', name: 'Ogro', hp: 70, xp: 35, damage: 10, stats: {}, type: 'giant', rank: 'normal' },
      'troll-xmm-2024': { id: 'troll-xmm-2024', name: 'Troll', hp: 85, xp: 45, damage: 12, stats: {}, type: 'giant', rank: 'normal' },
      'goblin-mm': { id: 'goblin-mm', name: 'Goblin', hp: 18, xp: 9, damage: 3, stats: {}, type: 'humanoid', rank: 'normal' },
      'goblin-boss-xmm-2024': { id: 'goblin-boss-xmm-2024', name: 'Chefe Goblin', hp: 80, xp: 50, damage: 10, stats: {}, type: 'humanoid', rank: 'boss' },
      'earth-elemental-xmm-2024': { id: 'earth-elemental-xmm-2024', name: 'Elemental da Terra', hp: 90, xp: 55, damage: 12, stats: {}, type: 'elemental', rank: 'normal' },
      'xorn-xmm-2024': { id: 'xorn-xmm-2024', name: 'Xorn', hp: 75, xp: 48, damage: 11, stats: {}, type: 'elemental', rank: 'normal' },
      'stone-giant-xmm-2024': { id: 'stone-giant-xmm-2024', name: 'Gigante de Pedra', hp: 120, xp: 75, damage: 16, stats: {}, type: 'giant', rank: 'elite' },
      'boar-xmm-2024': { id: 'boar-xmm-2024', name: 'Javali', hp: 25, xp: 13, damage: 5, stats: {}, type: 'beast', tags: ['skinnable'], rank: 'normal' },
      'black-bear-xmm-2024': { id: 'black-bear-xmm-2024', name: 'Urso Negro', hp: 35, xp: 17, damage: 6, stats: {}, type: 'beast', tags: ['skinnable'], rank: 'normal' },
      'owlbear-xmm-2024': { id: 'owlbear-xmm-2024', name: 'Urso-Coruja', hp: 55, xp: 28, damage: 9, stats: {}, type: 'monstrosity', tags: ['skinnable'], rank: 'normal' },
      'giant-wolf-spider-xmm-2024': { id: 'giant-wolf-spider-xmm-2024', name: 'Aranha-Lobo Gigante', hp: 28, xp: 15, damage: 5, stats: {}, type: 'beast', tags: ['skinnable'], rank: 'normal' },
      'winter-wolf-xmm-2024': { id: 'winter-wolf-xmm-2024', name: 'Lobo Invernal', hp: 65, xp: 32, damage: 10, stats: {}, type: 'monstrosity', tags: ['skinnable'], rank: 'normal' },
      'zombie-xmm-2024': { id: 'zombie-xmm-2024', name: 'Zumbi', hp: 35, xp: 18, damage: 6, stats: {}, type: 'undead', rank: 'normal' },
      'ghoul-xmm-2024': { id: 'ghoul-xmm-2024', name: 'Carniçal', hp: 45, xp: 22, damage: 7, stats: {}, type: 'undead', rank: 'normal' },
      'specter-xmm-2024': { id: 'specter-xmm-2024', name: 'Espectro', hp: 50, xp: 25, damage: 8, stats: {}, type: 'undead', rank: 'normal' },
      'wight-xmm-2024': { id: 'wight-xmm-2024', name: 'Inumano', hp: 65, xp: 32, damage: 9, stats: {}, type: 'undead', rank: 'elite' }
    },
    getCreature(id) { return this.creatures[id] || null; }
  },
  BagSystem: { items: [], addItem(item) { this.items.push(item); return true; } },
  ItemTemplates: {},
  ItemSystem: { syncFromGameData() {} },
  LootProfileRegistry: { buildLootTable() { return []; } },
  SaveManager: { save() {} }
};

require(path.resolve('js/progression/ProfessionSystem.js'));
require(path.resolve('js/data/HuntCatalog.js'));
require(path.resolve('js/world/HuntSystem.js'));
require(path.resolve('js/items/LootSystem.js'));
require(path.resolve('js/world/ExplorationSystem.js'));

Aethra.ProfessionSystem.init();
Aethra.HuntSystem.init();
Aethra.ExplorationSystem.init();

const results = {};

assert.ok(Aethra.ProfessionSystem.professions.thievery, 'Thievery should exist');
results.thieveryAvailable = true;

Aethra.HuntSystem.config.useBattleSystem = false;
Aethra.HuntSystem.config.useCombatSystem = false;
Aethra.HuntSystem.config.autoResolveWithoutCombat = false;

Aethra.HuntSystem.startHunt('deep_mines_focus', { mode: 'specialized' });
Aethra.HuntSystem.clearTimers();
const miningXp = Aethra.ProfessionSystem.grantActionXP('mining', 10, 'mine', { source: 'test:mining' });
assert.equal(miningXp.amount, 27, 'Mining XP should receive 2.75x and floor to 27');
const invalidXp = Aethra.ProfessionSystem.addXP('mining', 10, { action: 'lockpick', source: 'test:invalid' });
assert.equal(invalidXp, false, 'Mining cannot gain XP from lockpicking');
results.miningMultiplier = miningXp.amount;
results.invalidActionRejected = true;

const mineEncounter = Aethra.HuntSystem.handleEncounter('gargoyle-xmm-2024');
assert.equal(mineEncounter.sourceXp, 40);
assert.equal(mineEncounter.xp, 6, 'Deep mines combat XP should be 15%');
results.deepMineCombatXp = mineEncounter.xp;
Aethra.GameState.hunt.currentEnemy = null;
Aethra.HuntSystem.stopHunt('test');

Aethra.HuntSystem.startHunt('arena_focus', { mode: 'specialized' });
Aethra.HuntSystem.clearTimers();
const arenaEncounter = Aethra.HuntSystem.handleEncounter('bandit-xmm-2024');
assert.equal(arenaEncounter.xp, 25, 'Arena combat XP should be 2.5x');
results.arenaCombatXp = arenaEncounter.xp;
Aethra.GameState.hunt.currentEnemy = null;
Aethra.HuntSystem.stopHunt('test');

Aethra.HuntSystem.startHunt('catacombs_focus', { mode: 'specialized' });
Aethra.HuntSystem.clearTimers();
Aethra.GameState.professions.thievery.level = 10;
Aethra.GameState.professions.thievery.xpNext = Aethra.ProfessionSystem.getXPRequired(10);
Aethra.GameState.exploration.pendingEvent = {
  id: 'locked_chest', eventId: 'evt_test', icon: '▤', title: 'Baú trancado', description: 'Teste',
  actionLabel: 'Arrombar', professionId: 'thievery', actionType: 'lockpick', requiredLevel: 3,
  xp: [10, 10], category: 'thievery', requiresManual: true, status: 'pending'
};
Aethra.ExplorationSystem.randomSource = () => 0;
const explorationBefore = Aethra.ProfessionSystem.getState('exploration').xpTotal;
const thieveryBefore = Aethra.ProfessionSystem.getState('thievery').xpTotal;
const resolved = Aethra.ExplorationSystem.resolveEvent('evt_test', { manual: true });
assert.equal(resolved.status, 'resolved');
const thieveryAfter = Aethra.ProfessionSystem.getState('thievery').xpTotal;
const explorationAfter = Aethra.ProfessionSystem.getState('exploration').xpTotal;
assert.ok(thieveryAfter > thieveryBefore, 'Locked chest should grant Thievery XP');
assert.equal(explorationAfter, explorationBefore, 'Locked chest should not grant Exploration XP');
results.thieveryXpGain = thieveryAfter - thieveryBefore;
results.explorationXpLeak = explorationAfter - explorationBefore;

Aethra.LootSystem.economyProfiles.set('economy-test', {
  enemyId: 'economy-test', monsterName: 'Teste', tierId: 'T1', tierLabel: 'Teste', cr: 1, rank: 'normal',
  gold: { chance: 1, min: 10, max: 10 },
  drops: [{ id: 'potion_health', chance: 0.5, minQuantity: 1, maxQuantity: 1, rarity: 'Comum', sourceClass: 'material' }]
});
Aethra.LootSystem.randomSource = () => 0;
const economy = Aethra.LootSystem.processMonsterDefeat('economy-test', {
  goldMultiplier: 2.5, materialChanceMultiplier: 2, quantityMultiplier: 2, huntId: 'merchant_ruins_focus'
});
assert.equal(economy.gold, 25, 'Gold multiplier should be applied');
assert.equal(economy.items[0].quantity, 2, 'Resource quantity multiplier should be applied');
results.goldMultiplierResult = economy.gold;
results.quantityMultiplierResult = economy.items[0].quantity;

Aethra.HuntSystem.stopHunt('test-end');

const report = {
  passed: true,
  specializedHunts: Object.values(Aethra.HuntSystem.hunts).filter((h) => h.mode === 'specialized').length,
  results
};
console.log(JSON.stringify(report, null, 2));
