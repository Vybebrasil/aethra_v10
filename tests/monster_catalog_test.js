const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
global.window = global;
global.performance = { now: () => Date.now() };
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] ?? null; },
  setItem(key, value) { this.store[key] = String(value); },
  removeItem(key) { delete this.store[key]; }
};

function load(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInThisContext(source, { filename: file });
}

load('js/core/game-core.js');
load('js/data/GameData.js');
load('js/data/monsters/CreatureBalanceConfig.js');
load('js/data/monsters/MonsterAbilityParser.js');
load('js/data/loot/LootProfileRegistry.js');
load('js/data/monsters/MonsterCatalogAdapter.js');
load('js/data/monsters/MonsterCatalogData.js');
load('js/economy/EconomyRNGManager.js');
load('js/items/LootSystem.js');
load('js/data/monsters/MonsterCatalog.js');
load('js/data/hunts/HuntCatalog.js');
load('js/world/HuntSystem.js');
load('js/combat/BattleSystem.js');

const catalogStats = Aethra.MonsterCatalog.init();
Aethra.HuntCatalog.init();
Aethra.HuntSystem.init();
Aethra.BattleSystem.init();

const validation = Aethra.HuntCatalog.validate();
const wolf = Aethra.MonsterCatalog.get('forest_wolf');
const dragon = Aethra.MonsterCatalog.get('adult-black-dragon-xmm-2024');
const hunt = Aethra.HuntSystem.hunts.whispering_forest;
const runtimeWolf = Aethra.GameData.getCreature('forest_wolf', 1);
const abilityCreature = Aethra.GameData.getCreature('adult-black-dragon-xmm-2024', 86);
const abilitySelection = Aethra.BattleSystem.selectCreatureAbility(abilityCreature);

const report = {
  passed: catalogStats.total === 327 && validation.valid && Object.keys(Aethra.HuntSystem.hunts).length === 17,
  catalog: catalogStats,
  huntCatalog: Aethra.HuntCatalog.getStats(),
  huntValidation: validation,
  aliases: {
    forestWolf: wolf?.sourceId,
    giantRat: Aethra.MonsterCatalog.get('giant_rat')?.sourceId
  },
  samples: {
    wolf: { name: wolf?.name, level: wolf?.recommendedLevel, hp: runtimeWolf?.hp, loot: runtimeWolf?.lootTable?.length },
    dragon: { name: dragon?.name, level: dragon?.recommendedLevel, abilities: dragon?.abilities?.map((ability) => ability.name) },
    selectedAbility: abilitySelection?.name,
    whisperingForestEnemies: hunt?.enemies?.length
  },
  registered: {
    gameDataCreatures: Object.keys(Aethra.GameData.creatures).length,
    lootTables: Object.keys(Aethra.LootSystem.tables).length,
    itemTemplates: Object.keys(Aethra.ItemTemplates).length
  }
};

fs.writeFileSync(path.join(root, 'MONSTER_CATALOG_TEST_REPORT.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exit(1);
