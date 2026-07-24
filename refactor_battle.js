const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'js/combat/BattleSystem.js');
let content = fs.readFileSync(srcPath, 'utf8');

const mathMethods = ['calculateDamage', 'resolveAttack', 'rollGold'];
const logMethods = ['emitBattleLog', 'getFloatingTextPosition', 'emitFloatingCombatText', 'formatAttackMessage', 'getAnalyticCombatLogs', 'emitAnalyticCombatLogs', 'emitAttackResult', 'emitCombatTick', 'formatRewardMessage'];

function extractMethods(methods, moduleName) {
    let extractedCode = `// ${moduleName}.js - Extracted from BattleSystem.js\n(function (Aethra) {\n    "use strict";\n\n    Aethra.${moduleName} = {\n`;
    
    for (let j = 0; j < methods.length; j++) {
        const method = methods[j];
        
        const regex = new RegExp(`^\\s+${method}\\s*\\([^)]*\\)\\s*\\{`, 'm');
        const match = content.match(regex);
        if (!match) {
            console.log("Could not find method " + method);
            continue;
        }
        
        const startIndex = match.index;
        
        let i = startIndex + match[0].length;
        let braceCount = 1; 
        
        while (i < content.length) {
            if (content[i] === '{') {
                braceCount++;
            } else if (content[i] === '}') {
                braceCount--;
            }
            
            i++; 
            
            if (braceCount === 0) {
                break;
            }
        }
        
        const methodCode = content.substring(startIndex, i);
        
        extractedCode += methodCode;
        if (j < methods.length - 1) {
            extractedCode += ",\n\n";
        } else {
            extractedCode += "\n";
        }
        
        const methodSignature = match[0].replace(/\{$/, '').trim();
        const proxyCode = `        ${methodSignature} {\n            return Aethra.${moduleName}.${method}.apply(this, arguments);\n        }`;
        content = content.substring(0, startIndex) + proxyCode + content.substring(i);
    }
    
    extractedCode += `    };\n})(window.Aethra);\n`;
    fs.writeFileSync(path.join(__dirname, 'js', 'combat', moduleName + '.js'), extractedCode);
    console.log(`Created ${moduleName}.js`);
}

extractMethods(mathMethods, 'BattleMath');
extractMethods(logMethods, 'BattleLogger');

fs.writeFileSync(srcPath, content);
console.log("Updated BattleSystem.js with proxies.");
