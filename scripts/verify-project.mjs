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
const uiSpriteSheetLeaks = jsFiles
    .filter((file) => projectPath(file).startsWith("js/ui/"))
    .filter((file) => /Fighter2_(?:Idle|Walk)_without_shadow\.png/i.test(readFileSync(file, "utf8")))
    .map(projectPath);
check(
    uiSpriteSheetLeaks.length === 0,
    `UI renderiza spritesheet bruto em <img>: ${uiSpriteSheetLeaks.join(", ")}`
);
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

const questSystemSource = read("js/progression/QuestSystem.js");
const gameCoreSource = read("js/core/game-core.js");
const characterCreationSource = read("js/ui/CharacterCreationUI.js");
const characterBuildSource = read("js/progression/CharacterBuildSystem.js");
const professionSource = read("js/progression/ProfessionSystem.js");
const recipeCatalogSource = read("js/data/recipes/RecipeCatalog.js");
const professionSpecializationUiSource = read("js/ui/ProfessionSpecializationUI.js");
const professionWorkshopUiSource = read("js/ui/ProfessionWorkshopUI.js");
const progressionJournalUiSource = read("js/ui/ProgressionJournalUI.js");
const disciplineSource = read("js/progression/DisciplineSystem.js");
const huntCatalogSource = read("js/data/hunts/HuntCatalog.js");
const worldMapSource = read("js/ui/HudWorldMapAndDrops.js");
const playerHudSource = read("js/ui/PlayerHudWorkspace.js");
const saveManagerSource = read("js/infrastructure/SaveManager.js");
const maintenanceSource = read("js/items/EquipmentMaintenanceSystem.js");
const responsiveHudSource = read("css/hud-modernization.css");
const renderEngineSource = read("js/ui/RenderEngine.js");
const explorationSource = read("js/world/ExplorationSystem.js");
const devServerSource = read("scripts/dev-server.ps1");
const gameLauncherSource = read("INICIAR_JOGO.cmd");
check(
    !/registerQuest\(["']tutorial_first_steps["']/.test(characterCreationSource)
        && !/acceptQuest\(["']tutorial_first_steps["']/.test(characterCreationSource)
        && /acceptQuest\?\.\(["']tutorial_first_steps["']/.test(characterBuildSource),
    "CharacterBuildSystem deve iniciar a missão oficial sem lógica de quest na UI"
);
check(
    /getIntroQuestDefinition\(/.test(professionSource)
        && /CraftRecipe/.test(professionSource)
        && /queueIntroGuarantee/.test(professionSource)
        && /reward:\s*\{\s*gold:\s*40,\s*xp:\s*75,\s*items:\s*\[\]/.test(professionSource),
    "ProfessionSystem deve gerar missões iniciais no contrato canônico"
);
check(
    /SPECIALIZATION_UNLOCK_LEVEL\s*=\s*10/.test(professionSource)
        && /SPECIALIZATION_MASTERY_INTERVAL\s*=\s*25/.test(professionSource)
        && /Math\.log2\(pulses \+ 1\)/.test(professionSource)
        && /chooseSpecialization\(/.test(professionSource)
        && /getProfessionModifiers\(/.test(professionSource),
    "ProfessionSystem deve possuir escolha exclusiva e maestria infinita com retorno decrescente"
);
check(
    indexSource.includes("css/profession-specialization.css")
        && indexSource.includes("js/ui/ProfessionSpecializationUI.js")
        && /chooseSpecialization\?\.\(/.test(professionSpecializationUiSource)
        && !/professionPerks\s*\[/.test(professionSpecializationUiSource),
    "Árvore de profissão deve estar indexada e enviar comandos sem mutar perks na UI"
);
check(
    indexSource.includes("css/progression-journal.css")
        && indexSource.includes("js/ui/ProgressionJournalUI.js")
        && /getTrainingGuide\(/.test(disciplineSource)
        && /getDisciplineMilestones/.test(renderEngineSource)
        && /DisciplineSystem\.setTrainingMode\?\.\(/.test(progressionJournalUiSource)
        && /ProfessionSystem\?\.setCollectionPolicy\?\.\(/.test(progressionJournalUiSource),
    "Diário de Progressão deve consumir guias e marcos oficiais e enviar comandos aos sistemas donos"
);
check(
    !/grantSkillXP|addUseXP|xpCurrent\s*(?:\+?=|-?=)/.test(progressionJournalUiSource),
    "Diário de Progressão não pode conceder ou alterar XP diretamente"
);
check(
    /DisciplineSystem\.setFocus\?\.\(/.test(progressionJournalUiSource)
        && !/SettingsManager\?\.set\?\.\([^\n]*progressionJournalFocus/.test(progressionJournalUiSource)
        && /discipline:focus-changed/.test(disciplineSource)
        && /getFocusedGuidance\(/.test(disciplineSource),
    "Foco de skill deve ser comandado pelo DisciplineSystem e publicado como evento oficial"
);
check(
    /apprentice_mines_focus:\s*\{/.test(huntCatalogSource)
        && /id:\s*["']apprentice_mines_focus["'][\s\S]{0,500}minLevel:\s*1/.test(huntCatalogSource)
        && /focusSkillId/.test(worldMapSource)
        && /data-hunt-atlas-view=["']focus["']/.test(worldMapSource),
    "Mineração deve ter rota inicial acessível e o mapa deve abrir a recomendação da skill"
);
check(
    /data-focus-discipline/.test(playerHudSource)
        && /discipline:focus-changed/.test(playerHudSource)
        && /data-focus-skill-next-action/.test(renderEngineSource)
        && /handleDisciplineGuidance/.test(renderEngineSource),
    "Central do Herói e Próximo passo devem refletir e executar o foco oficial"
);
check(
    /CONTRACT_VERSION\s*=\s*4/.test(questSystemSource)
        && /grantRewards\(quest\)/.test(questSystemSource)
        && /MonsterCatalog\?\.resolveId/.test(questSystemSource)
        && /["']hunt:started["']/.test(questSystemSource)
        && /auditReachability\(\)/.test(questSystemSource)
        && /CraftEquipment/.test(questSystemSource)
        && /dependsOn/.test(questSystemSource),
    "QuestSystem v4 deve preservar dependências, equipamentos e recompensas"
);
check(
    /CURRENT_SCHEMA_VERSION\s*=\s*78/.test(saveManagerSource)
        && /schemaVersion:\s*78/.test(gameCoreSource)
        && /quests\.contractVersion\s*=\s*4/.test(saveManagerSource)
        && /hero\.professionPerks/.test(saveManagerSource)
        && /item\.durability/.test(saveManagerSource)
        && /tutorialGuarantee/.test(saveManagerSource),
    "Save v78 deve migrar missões, perks, durabilidade e garantias de treino"
);
check(
    /getFocusTrainingQuestDefinition/.test(professionSource)
        && /practice_focus_mining/.test(professionSource)
        && /smelt_focus_ingots/.test(professionSource)
        && /forge_focus_equipment/.test(professionSource)
        && /queueTrainingGuarantee/.test(professionSource),
    "ProfessionSystem deve definir o contrato vertical oficial de Mineração"
);
check(
    /data-skip-exploration/.test(renderEngineSource)
        && /skip:\s*true/.test(renderEngineSource)
        && /remaining/.test(explorationSource)
        && /guaranteedSuccess/.test(explorationSource)
        && /minimumQuantity/.test(explorationSource),
    "Exploração guiada deve permitir Minerar/Ignorar sem consumir a garantia ao ignorar"
);
check(
    /CraftEquipment/.test(professionWorkshopUiSource)
        && /isEquipmentRecipe/.test(professionWorkshopUiSource)
        && /Escolha seu primeiro equipamento/.test(professionWorkshopUiSource)
        && !/BagSystem\?\.(?:addItem|consumeItem)/.test(professionWorkshopUiSource)
        && /id:\s*["']forge_iron_sword["'][\s\S]{0,250}requiredLevel:\s*1/.test(recipeCatalogSource),
    "Oficina deve projetar a escolha de equipamento sem mutar a economia na UI"
);
check(
    /battle:damage-dealt/.test(maintenanceSource)
        && /primary-attack:used/.test(maintenanceSource)
        && /BagSystem\?\.consumeItem/.test(maintenanceSource)
        && /ProfessionSystem\?\.grantActionXP/.test(maintenanceSource)
        && /maintenance:policy-changed/.test(maintenanceSource),
    "EquipmentMaintenanceSystem deve ser a autoridade de desgaste, reparo e automação"
);
check(
    /@media \(max-width: 1119px\)/.test(responsiveHudSource)
        && /min-width:\s*0\s*!important/.test(responsiveHudSource)
        && /grid-template-columns:\s*minmax\(0, 1fr\)\s*!important/.test(responsiveHudSource)
        && /order:\s*1/.test(responsiveHudSource)
        && /order:\s*2/.test(responsiveHudSource)
        && /order:\s*3/.test(responsiveHudSource),
    "HUD compacta deve remover o piso desktop e reutilizar os três painéis em pilha"
);
check(
    /data-compact-hunt-nav/.test(renderEngineSource)
        && ["combat", "hero", "analysis"].every((panel) => (
            renderEngineSource.includes(`data-compact-hunt-target="${panel}"`)
        ))
        && /bindCompactHuntNavigation\(\)/.test(renderEngineSource)
        && /syncActivePanel/.test(renderEngineSource)
        && /\.compact-hunt-nav\s*\{/.test(responsiveHudSource),
    "HUD estreita deve oferecer navegação única entre combate, herói e análise"
);
check(
    /Test-AethraServer/.test(devServerSource)
        && /Start-Process/.test(devServerSource)
        && /127\.0\.0\.1/.test(devServerSource)
        && /\.pid/.test(devServerSource)
        && /scripts\\dev-server\.ps1/.test(gameLauncherSource),
    "Launcher local deve iniciar um único servidor rastreado e verificar sua saúde"
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
