# Contrato de durabilidade e manutenção

Atualizado em: 2026-07-29

## Objetivo e autoridade

`js/items/EquipmentMaintenanceSystem.js` é a única autoridade para:

- inicializar e alterar `item.durability`;
- calcular condição, status e efetividade do equipamento;
- consumir material e Gold em reparos;
- conceder XP de Forjaria/Couraria pelo trabalho realizado;
- persistir e executar a política automática antes da Hunt.

Combate, Hunt, HUD e oficinas apenas publicam eventos, enviam comandos ou
apresentam snapshots. Não reduza durabilidade em `BattleSystem`, não consuma
recursos em `ProfessionWorkshopUI` e não crie outra política em
`IdleLoopSystem`.

## Estado persistido

Cada instância equipável possui:

```js
durability: {
    current: 100,
    max: 100,
    lastChangedAt: null,
    brokenAt: null
}
```

O estado global usa:

```js
GameState.maintenance = {
    policy: {
        enabled: false,
        thresholdPercent: 35,
        reserveGold: 25,
        maxGoldPerCycle: 100
    },
    processedCommands: [],
    totals: {
        repairs: 0,
        durabilityRestored: 0,
        goldSpent: 0
    },
    lastAutoRepair: null
};
```

O schema atual é 77. A migração v76 → v77 adiciona `100/100` somente a itens
equipáveis e cria a política desligada; materiais, loot e consumíveis não
recebem durabilidade.

## Regras de desgaste

- ataque primário ou habilidade com arma: `-1` na arma usada;
- dano recebido: `-0,4` em escudo/armaduras equipadas;
- dano recebido: `-0,1` em acessórios equipados;
- erro do ataque ainda desgasta a arma porque a ação física aconteceu;
- Coliseu não aplica desgaste enquanto o combate competitivo é protótipo local;
- eventos oficiais consumidos: `primary-attack:used`, `battle:hero-action` e
  `battle:damage-dealt`.

Nunca consuma simultaneamente um evento canônico e seu alias legado. Isso
aplicaria o mesmo desgaste duas vezes.

## Efetividade

- condição acima ou igual a 25%: 100% dos atributos;
- entre 0% e 25%: queda gradual de 100% para 75%;
- em 0%: efetividade 0, item quebrado e inativo;
- item quebrado permanece no slot para ficar visível e reparável;
- `EquipSystem` usa `ItemSystem.getEffectiveItemStats(...)`;
- `BattleSystem` trata arma em 0% como indisponível e aplica a efetividade ao
  perfil de dano quando a condição está crítica.

## Reparo transacional

Fluxo obrigatório:

1. resolver a instância real na mochila/equipamento;
2. calcular cotação proporcional ao dano e ao valor da peça;
3. validar Cidade, estação, material, Gold, reserva e orçamento;
4. consumir material por `BagSystem.consumeItem(...)`;
5. descontar Gold uma única vez;
6. restaurar a durabilidade e registrar histórico;
7. conceder XP por `ProfessionSystem.grantActionXP(...)`;
8. registrar `commandId`, emitir eventos e salvar.

Forjaria atende armas, escudos, placa e acessórios. Couraria atende peças com
`armorType: leather`, template de couro ou origem `leatherworking`.

Materiais atuais por tier:

| Ofício | Tier 1 | Tier 2 | Tier 3+ |
|---|---|---|---|
| Forjaria | Minério de Ferro | Lingote de Aço | Liga Aetheriana |
| Couraria | Couro de Fera | Couro Reforçado | Couro Sombrio |

A quantidade varia de 1 a 3 unidades conforme a durabilidade ausente. O XP é
proporcional ao que foi restaurado, limitado a 12 por peça, e não existe quando
a peça já está íntegra. Um `commandId` repetido retorna `duplicate-command` sem
novo custo nem XP.

## Automação antes da Hunt

`HuntSystem.startHunt(...)` chama `runAutoRepair({ trigger: "before-hunt" })`
antes de ativar a expedição. O ciclo:

- só roda quando `policy.enabled === true`;
- seleciona peças abaixo do percentual configurado;
- ordena da mais danificada para a mais íntegra;
- respeita `reserveGold` e `maxGoldPerCycle`;
- ignora peças sem recursos suficientes e permite iniciar a Hunt;
- persiste o resumo em `lastAutoRepair`.

## Eventos oficiais

| Evento | Produtor/momento | Consumidores |
|---|---|---|
| `maintenance:ready` | sistema inicializado e estado reconciliado | diagnóstico/UI |
| `equipment:durability-changed` | desgaste ou reparo efetivado | HUD, tooltips, autosave |
| `equipment:broken` | condição chega a zero | HUD, logs futuros |
| `maintenance:repaired` | transação individual concluída | oficina, autosave, telemetria |
| `maintenance:repair-rejected` | validação recusa o comando | oficina |
| `maintenance:cycle-completed` | lote manual/automático termina | oficina, telemetria |
| `maintenance:auto-completed` | política pré-Hunt termina | analyzer/log futuro |
| `maintenance:policy-changed` | jogador altera configuração | oficina, autosave |

Eventos econômicos carregam `commandId` quando representam uma transação. A
lista `processedCommands` mantém os 100 identificadores mais recentes.

## Cobertura obrigatória

Antes de alterar este contrato, rode:

```powershell
node scripts/verify-project.mjs
node scripts/run-integration.mjs --timeout 90 --viewport 1280x720
node scripts/run-integration.mjs --timeout 90 --viewport 1920x1080
```

A integração precisa provar migração, criação, desgaste, penalidade, quebra,
reparo, consumo de recursos, XP e idempotência. Abra também Forja/Curtume no
navegador e confirme ausência de overflow horizontal, erro de console ou 404.
