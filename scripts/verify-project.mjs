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
    !/\bid\s*=\s*["']game-container["']/.test(indexSource) && !/data-aethra-window/.test(indexSource),
    "index.html: a casca da interface clássica não pode voltar (a UI 3.0 é a única)"
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
const ui3CreationSource = read("js/ui3/Ui3CreationScreen.js");
const craftingGuidanceSource = read("js/items/CraftingGuidance.js");
const progressionJournalSource = read("js/progression/ProgressionJournal.js");
const ui3SkillsSource = read("js/ui3/Ui3SkillsWindow.js");
const characterBuildSource = read("js/progression/CharacterBuildSystem.js");
const professionSource = read("js/progression/ProfessionSystem.js");
const xpSystemSource = read("js/progression/XPSystem.js");
const recipeCatalogSource = read("js/data/recipes/RecipeCatalog.js");
const ui3WorkshopSource = read("js/ui3/Ui3WorkshopWindow.js");
const disciplineSource = read("js/progression/DisciplineSystem.js");
const huntCatalogSource = read("js/data/hunts/HuntCatalog.js");
const ui3NavigationSource = read("js/ui3/Ui3Navigation.js");
const ui3AtlasSource = read("js/ui3/Ui3AtlasWindow.js");
const ui3CitySource = read("js/ui3/Ui3CityScreen.js");
const saveManagerSource = read("js/infrastructure/SaveManager.js");
const maintenanceSource = read("js/items/EquipmentMaintenanceSystem.js");
const ui3HuntSource = read("js/ui3/Ui3HuntScreen.js");
const explorationSource = read("js/world/ExplorationSystem.js");
const lootSystemSource = read("js/items/LootSystem.js");
const earlyGameItemCatalogSource = read("js/data/items/EarlyGameItemCatalog.js");
const idleLoopSource = read("js/economy/IdleLoopSystem.js");
const devServerSource = read("scripts/dev-server.ps1");
const gameLauncherSource = read("INICIAR_JOGO.cmd");
check(
    !/registerQuest\(["']tutorial_first_steps["']/.test(ui3CreationSource)
        && !/acceptQuest\(["']tutorial_first_steps["']/.test(ui3CreationSource)
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
const ui3SpecializationSource = read("js/ui3/Ui3SpecializationWindow.js");
check(
    indexSource.includes("js/ui3/Ui3SpecializationWindow.js")
        && /chooseSpecialization\?\.\(/.test(ui3SpecializationSource)
        && !/professionPerks\s*\[/.test(ui3SpecializationSource),
    "Árvore de profissão deve estar indexada e enviar comandos sem mutar perks na UI"
);
check(
    indexSource.includes("js/progression/ProgressionJournal.js")
        && indexSource.includes("js/ui3/Ui3SkillsWindow.js")
        && /getTrainingGuide\?\.\(/.test(progressionJournalSource)
        && /DisciplineMilestones\?\.get\?\.\(/.test(progressionJournalSource)
        && /DisciplineSystem\?\.setTrainingMode\?\.\(/.test(ui3SkillsSource)
        && /ProfessionSystem\?\.setCollectionPolicy\?\.\(/.test(ui3SkillsSource),
    "Diário de Progressão deve consumir guias e marcos oficiais e enviar comandos aos sistemas donos"
);
check(
    !/grantSkillXP|addUseXP|xpCurrent\s*(?:\+?=|-?=)/.test(progressionJournalSource + ui3SkillsSource),
    "Diário de Progressão não pode conceder ou alterar XP diretamente"
);
check(
    /DisciplineSystem\?\.setFocus\?\.\(/.test(ui3SkillsSource)
        && !/SettingsManager\?\.set\?\.\([^\n]*progressionJournalFocus/.test(ui3SkillsSource)
        && /discipline:focus-changed/.test(disciplineSource)
        && /getFocusedGuidance\(/.test(disciplineSource),
    "Foco de skill deve ser comandado pelo DisciplineSystem e publicado como evento oficial"
);
check(
    /apprentice_mines_focus:\s*\{/.test(huntCatalogSource)
        && /id:\s*["']apprentice_mines_focus["'][\s\S]{0,500}minLevel:\s*1/.test(huntCatalogSource)
        && /focusSkillId/.test(ui3NavigationSource)
        && /options\.view === ["']focus["']/.test(ui3AtlasSource),
    "Mineração deve ter rota inicial acessível e o mapa deve abrir a recomendação da skill"
);
check(
    /discipline:focus-changed/.test(ui3CitySource)
        && /data-ui3-city-focus-action/.test(ui3CitySource)
        && /followDisciplineGuidance/.test(ui3NavigationSource),
    "Cidade e navegação devem refletir e executar o foco oficial"
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
    /focus_training_skinning/.test(professionSource)
        && /practice_focus_skinning/.test(professionSource)
        && /collect_focus_hides/.test(professionSource)
        && /tan_focus_leather/.test(professionSource)
        && /craft_focus_leather_equipment/.test(professionSource)
        && /whispering_woods_focus/.test(professionSource),
    "ProfessionSystem deve definir o contrato vertical oficial de Esfolamento"
);
check(
    /focus_training_herbalism/.test(professionSource)
        && /practice_focus_herbalism/.test(professionSource)
        && /collect_focus_herbs/.test(professionSource)
        && /distill_focus_extracts/.test(professionSource)
        && /brew_focus_supply/.test(professionSource)
        && /CraftSupply/.test(professionSource),
    "ProfessionSystem deve definir o contrato vertical oficial de Herbalismo e Alquimia"
);
check(
    /verdant_grove_focus:\s*\{/.test(huntCatalogSource)
        && /id:\s*["']verdant_grove_focus["'][\s\S]{0,500}minLevel:\s*1/.test(huntCatalogSource)
        && /actionLabel:\s*["']Colher["']/.test(explorationSource)
        && /event\.minimumQuantity/.test(explorationSource),
    "Herbalismo deve possuir rota inicial e decisÃ£o Colher/Ignorar com rendimento mÃ­nimo"
);
check(
    ["distill_wild_herb", "brew_health_potion", "brew_mana_potion", "brew_vigor_tonic"].every((recipeId) => (
        new RegExp(`id:\\s*["']${recipeId}["'][\\s\\S]{0,250}professionId:\\s*["']alchemy["']`).test(recipeCatalogSource)
    ))
        && /botanical_extract/.test(earlyGameItemCatalogSource)
        && /minor_vigor_tonic/.test(lootSystemSource),
    "CatÃ¡logos oficiais devem conter destilaÃ§Ã£o, trÃªs supplies e seus templates"
);
check(
    /CraftSupply/.test(questSystemSource)
        && /Escolha seu primeiro suprimento/.test(craftingGuidanceSource)
        && /workshop:\s*["']alchemy["']/.test(ui3CitySource)
        && /craftRecipeId:\s*["']brew_health_potion["']/.test(idleLoopSource)
        && !/BagSystem\?\.(?:addItem|consumeItem)/.test(ui3WorkshopSource),
    "LaboratÃ³rio deve projetar a escolha de supply e reutilizar o estoque oficial"
);
check(
    /data-ui3-event-skip/.test(ui3HuntSource)
        && /skip:\s*true/.test(ui3HuntSource)
        && /remaining/.test(explorationSource)
        && /guaranteedSuccess/.test(explorationSource)
        && /minimumQuantity/.test(explorationSource),
    "Exploração guiada deve permitir Minerar/Ignorar sem consumir a garantia ao ignorar"
);
check(
    /["']creature-harvest["']:\s*\{/.test(explorationSource)
        && /actionLabel:\s*["']Esfolar["']/.test(explorationSource)
        && /guaranteedHarvest\?\.manual/.test(explorationSource)
        && /pauseHunt\?\.\(/.test(explorationSource)
        && /resumeHuntAfterEvent/.test(explorationSource)
        && /event\.id === ["']creature-harvest["']/.test(explorationSource),
    "Esfolamento guiado deve pausar a Hunt e resolver Esfolar/Ignorar pelo ExplorationSystem"
);
check(
    /grantSkillXP\(skillId,[\s\S]{0,220}let state = this\.getSkillState\(skillId\)/.test(xpSystemSource)
        && /state = this\.getSkillState\(skillId\) \|\| state/.test(xpSystemSource),
    "XPSystem deve preservar o primeiro XP quando a descoberta normaliza o estado da skill"
);
check(
    /CraftEquipment/.test(craftingGuidanceSource)
        && /isEquipmentRecipe/.test(craftingGuidanceSource)
        && /Escolha seu primeiro equipamento/.test(craftingGuidanceSource)
        && !/BagSystem\?\.(?:addItem|consumeItem)/.test(ui3WorkshopSource)
        && /id:\s*["']forge_iron_sword["'][\s\S]{0,250}requiredLevel:\s*1/.test(recipeCatalogSource),
    "Oficina deve projetar a escolha de equipamento sem mutar a economia na UI"
);
check(
    ["craft_leather_boots", "craft_leather_helm", "craft_leather_legs"].every((recipeId) => (
        new RegExp(`id:\\s*["']${recipeId}["'][\\s\\S]{0,250}requiredLevel:\\s*1`).test(recipeCatalogSource)
    ))
        && /Botas, Chapéu e Calças de Couro/.test(craftingGuidanceSource),
    "Curtume inicial deve oferecer três escolhas de equipamento acessíveis no nível 1"
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

/*
 * UI 3.0 ("Ferro e Ouro"). A folha nova só funciona sem disputar com o CSS
 * clássico se ficar isolada em #ui3-root; estas regras impedem que ela
 * volte a acumular !important, fontes minúsculas e seletores globais.
 */
const ui3CssPath = "css/aethra-ui3.css";
check(existsSync(join(root, ui3CssPath)), `${ui3CssPath} ausente`);
if (existsSync(join(root, ui3CssPath))) {
    const ui3Css = read(ui3CssPath).replace(/\/\*[\s\S]*?\*\//g, "");

    check(!/!important/i.test(ui3Css), `${ui3CssPath}: !important é proibido na UI 3.0`);

    for (const match of ui3Css.matchAll(/--ui3-fs-[a-z0-9]+\s*:\s*([^;]+);/gi)) {
        const minimum = Number((match[1].match(/(\d+(?:\.\d+)?)px/) || [])[1]);
        check(
            match[1].trim().startsWith("clamp(") && minimum >= 11,
            `${ui3CssPath}: token de fonte precisa de clamp() com mínimo ≥ 11px (${match[0].trim()})`
        );
    }

    for (const match of ui3Css.matchAll(/(?<!-)font-size\s*:\s*([^;}]+)/gi)) {
        const value = match[1].trim();
        const fixedPx = value.match(/^(\d+(?:\.\d+)?)px$/);
        check(
            value.startsWith("var(--ui3-fs-") || (fixedPx && Number(fixedPx[1]) >= 11),
            `${ui3CssPath}: font-size deve usar um token --ui3-fs-* ou px ≥ 11 (${value})`
        );
    }

    let buffer = "";
    for (const char of ui3Css) {
        if (char === "{") {
            const header = buffer.trim();
            buffer = "";
            if (!header || header.startsWith("@")) continue;
            for (const selector of header.split(",").map((part) => part.trim())) {
                check(
                    selector.startsWith("#ui3-root") || selector.startsWith(".ui3"),
                    `${ui3CssPath}: seletor fora do escopo #ui3-root/.ui3: ${selector}`
                );
            }
        } else if (char === "}") {
            buffer = "";
        } else {
            buffer += char;
        }
    }
}

check(/<div id="ui3-root"/.test(indexSource), "index.html: #ui3-root ausente");
// Folhas de estilo do jogo: base da página, UI 3.0 e a tela de derrota.
const ALLOWED_STYLESHEETS = ["css/aethra-base.css", "css/aethra-ui3.css", "css/death-modal.css"];
const indexStylesheets = [...indexSource.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/g)]
    .map((match) => match[1].split(/[?#]/)[0])
    .filter((href) => !/^https?:/.test(href));
const unexpectedStylesheets = indexStylesheets.filter((href) => !ALLOWED_STYLESHEETS.includes(href));
check(
    unexpectedStylesheets.length === 0,
    `index.html: folhas fora da lista permitida: ${unexpectedStylesheets.join(", ")}`
);

for (const file of walk(join(root, "js", "ui3"), (entry) => extname(entry) === ".js")) {
    const source = readFileSync(file, "utf8");
    check(
        !/GameState(?:\.[A-Za-z_$][\w$]*)+\s*=(?!=)/.test(source),
        `${projectPath(file)}: a UI 3.0 não escreve no GameState (regra 1 do AGENTS.md)`
    );
}

// Tela de derrota: o BattleSystem aplica a penalidade e restaura a vida;
// a tela só mostra, em português, quem derrotou o herói.
const deathModalSource = read("js/ui/DeathModalUI.js");
check(
    !/\b(?:hero|stats)\.(?:hp|mana|energy|gold)\s*=(?!=)/.test(deathModalSource),
    "js/ui/DeathModalUI.js: a tela de derrota não restaura vida nem mexe no ouro (é o BattleSystem)"
);
check(
    /payload\.creatureName/.test(deathModalSource) && !/\b(?:supplies|Skills|slots)\b/.test(deathModalSource),
    "js/ui/DeathModalUI.js: nomeie a criatura (payload.creatureName) e use rótulos em português"
);
const deathCss = read("css/death-modal.css").replace(/\/\*[\s\S]*?\*\//g, "");
for (const match of deathCss.matchAll(/(?<!-)font(?:-size)?\s*:\s*[^;]*?(\d+(?:\.\d+)?)px/gi)) {
    check(Number(match[1]) >= 11, `css/death-modal.css: fonte abaixo de 11px (${match[0].trim()})`);
}

if (failures.length > 0) {
    console.error(`Quality gate falhou: ${failures.length}/${checks} verificação(ões).`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log(`Quality gate aprovado: ${checks}/${checks} verificações.`);
