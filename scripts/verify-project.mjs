import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
let checks = 0;

function check(condition, message) {
    checks += 1;
    if (!condition) failures.push(message);
}

function walk(directory, predicate) {
    const files = [];
    for (const name of readdirSync(directory)) {
        const absolute = join(directory, name);
        const entry = statSync(absolute);
        if (entry.isDirectory()) files.push(...walk(absolute, predicate));
        else if (predicate(absolute)) files.push(absolute);
    }
    return files;
}

function read(projectPath) {
    return readFileSync(join(root, projectPath), "utf8");
}

function projectPath(absolute) {
    return relative(root, absolute).replaceAll("\\", "/");
}

const jsFiles = walk(join(root, "js"), (file) => extname(file) === ".js");
for (const file of jsFiles) {
    const result = spawnSync(process.execPath, ["--check", file], {
        encoding: "utf8"
    });
    check(
        result.status === 0,
        `${projectPath(file)}: sintaxe inválida\n${result.stderr.trim()}`
    );
}

for (const htmlPath of ["index.html", "tests/integration.html"]) {
    const source = read(htmlPath);
    const ids = [...source.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)]
        .map((match) => match[1]);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    check(duplicateIds.length === 0, `${htmlPath}: IDs duplicados: ${duplicateIds.join(", ")}`);

    const localReferences = [...source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)]
        .map((match) => match[1])
        .filter((value) => !/^(?:https?:|data:|blob:|#)/i.test(value))
        .map((value) => value.split(/[?#]/)[0])
        .filter(Boolean);

    for (const reference of localReferences) {
        const target = resolve(root, reference);
        check(existsSync(target), `${htmlPath}: referência local ausente: ${reference}`);
    }

    const scriptSources = [...source.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/g)]
        .map((match) => match[1].split(/[?#]/)[0]);
    const duplicateScripts = [...new Set(scriptSources.filter((src, index) => scriptSources.indexOf(src) !== index))];
    check(duplicateScripts.length === 0, `${htmlPath}: scripts carregados duas vezes: ${duplicateScripts.join(", ")}`);
}

const indexSource = read("index.html");
check(
    (indexSource.match(/\bid\s*=\s*["']npc-shop-view["']/g) || []).length === 1,
    "index.html: deve existir exatamente uma janela npc-shop-view"
);

const tileMapSource = read("js/world/TileMapCanvas.js");
for (const [pattern, description] of [
    [/XPSystem\s*\.\s*(?:add|grant)/, "concessão de XP"],
    [/GameState\s*\.\s*hero\s*\.\s*gold\s*(?:\+?=|-?=)/, "mutação de ouro"],
    [/LootSystem\s*\.\s*(?:roll|grant|award)/, "geração de loot"]
]) {
    check(!pattern.test(tileMapSource), `TileMapCanvas não pode executar ${description}`);
}
check(
    !/EventBus\.on\(["'](?:battle:damage-dealt|battle:attack-missed|EnemyDefeated|HeroDefeated)["']/.test(tileMapSource),
    "TileMapCanvas deve consumir apenas CombatProjection para resultados de combate"
);

const combatProjectionSource = read("js/combat/CombatProjection.js");
check(
    /source:\s*["']BattleSystem["']/.test(combatProjectionSource),
    "CombatProjection deve declarar BattleSystem como autoridade"
);
check(
    /combat:projection-changed/.test(combatProjectionSource),
    "CombatProjection deve publicar snapshots oficiais"
);

const consumableSource = read("js/items/ConsumableSystem.js");
check(
    /BagSystem\.consumeItem\(/.test(consumableSource),
    "ConsumableSystem deve consumir supplies pela transação do BagSystem"
);
check(
    /recordSupplyUse\?\.\(/.test(consumableSource),
    "ConsumableSystem deve registrar o custo consumido no HuntSystem"
);

const authorityGatewaySource = read("js/infrastructure/AuthorityGateway.js");
check(
    ["combatRng", "itemMint", "rankingWrite", "marketWrite", "wagerEscrow"]
        .every((capability) => authorityGatewaySource.includes(`"${capability}"`)),
    "AuthorityGateway deve proteger todos os domínios competitivos"
);
check(
    existsSync(join(root, "docs", "BACKEND_AUTHORITY_CONTRACT.md")),
    "Contrato do backend autoritativo deve existir"
);
const coliseumSource = read("js/pvp/ColiseumSystem.js");
check(
    !/removeItem\?\.\([^\n]+coliseum-escrow/.test(coliseumSource),
    "ColiseumSystem não pode retirar item apostado no cliente local"
);

for (const file of jsFiles.filter((file) => projectPath(file) !== "js/combat/CombatSystem.js")) {
    const source = readFileSync(file, "utf8");
    check(
        !/CombatSystem\s*\.\s*(?:startCombat|processTurn|heroAttack|enemyAttack|stopCombat)\s*\(/.test(source),
        `${projectPath(file)}: runtime deve comandar combate apenas pelo BattleSystem`
    );
}

const uiFiles = walk(join(root, "js", "ui"), (file) => extname(file) === ".js");
for (const file of uiFiles) {
    const source = readFileSync(file, "utf8");
    check(
        !/Render(?:Engine)?\.renderBattleCards\s*=/.test(source),
        `${projectPath(file)}: não sobrescreva renderBattleCards; consuma render:battle-cards`
    );
    check(
        !/GameState\s*\.\s*hero\s*\.\s*gold\s*(?:\+?=|-?=)/.test(source),
        `${projectPath(file)}: UI não pode alterar ouro diretamente`
    );
    check(
        !/XPSystem\s*\.\s*(?:addXP|gainXP|grantXP)/.test(source),
        `${projectPath(file)}: UI não pode conceder XP diretamente`
    );
}

const localStorageAllowlist = new Set([
    "js/core/game-core.js",
    "js/infrastructure/SaveManager.js",
    "js/infrastructure/SettingsManager.js",
    "js/ui/EncounterInteractionPass.js",
    "js/ui/HudExperience.js",
    "js/ui/HudWorldMapAndDrops.js",
    "js/ui/LobbyUI.js",
    "js/ui/RenderEngine.js",
    "js/ui/UIFluidityPass.js",
    "js/ui/WindowManager.js"
]);

for (const file of jsFiles) {
    const path = projectPath(file);
    const source = readFileSync(file, "utf8");
    const accessesLocalStorage = /\b(?:window\s*\.\s*)?localStorage\s*(?:\?\.|\.)\s*(?:getItem|setItem|removeItem|clear)\s*\(/.test(source);
    check(
        !accessesLocalStorage || localStorageAllowlist.has(path),
        `${path}: novo acesso direto a localStorage; use SaveManager ou SettingsManager`
    );
}

const assetReferences = new Set();
for (const file of [
    ...jsFiles,
    ...walk(join(root, "css"), (entry) => extname(entry) === ".css"),
    join(root, "index.html"),
    join(root, "tests", "integration.html")
]) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/assets\/[A-Za-z0-9_./-]+\.(?:avif|gif|jpe?g|png|svg|webp)/gi)) {
        assetReferences.add(match[0]);
    }
}

for (const asset of assetReferences) {
    check(existsSync(join(root, asset)), `Asset local ausente: ${asset}`);
}

if (failures.length > 0) {
    console.error(`Quality gate falhou: ${failures.length}/${checks} verificação(ões).`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log(`Quality gate aprovado: ${checks}/${checks} verificações.`);
