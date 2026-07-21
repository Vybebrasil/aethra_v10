# Regras obrigatórias de desenvolvimento — Crônicas de Aethra

Estas instruções valem para todo o repositório e para qualquer agente, IDE ou
desenvolvedor que altere o projeto.

Antes de editar código, leia `docs/ENGINEERING_STANDARD.md`. Não implemente uma
segunda versão de um sistema sem primeiro identificar o módulo proprietário.

## Fontes de verdade

| Domínio | Módulo proprietário |
| --- | --- |
| Combate, rodadas, dano e morte | `js/combat/BattleSystem.js` |
| Execução de habilidades | `js/combat/SkillController.js` |
| Caçada e encontros | `js/world/HuntSystem.js` |
| XP e nível | `js/progression/XPSystem.js` |
| Templates e instâncias de itens | `js/data/GameData.js` e `js/items/ItemSystem.js` |
| Mochila | `js/items/BagSystem.js` |
| Uso de consumíveis | `js/items/ConsumableSystem.js` |
| Equipamento | `js/items/EquipSystem.js` |
| Compra e venda | `js/market/MarketplaceSystem.js` |
| Persistência | `js/infrastructure/SaveManager.js` |
| Autoridade competitiva | `js/infrastructure/AuthorityGateway.js` e backend |
| RNG econômico | `js/economy/EconomyRNGManager.js` |
| Interface | `js/ui/*` — somente apresentação e comandos do jogador |

## Regras inegociáveis

1. A interface nunca concede XP, ouro, loot, dano ou cura diretamente.
2. Canvas, animações e HUDs são projeções do estado oficial. Eles não executam
   combate ou economia paralelos.
3. Itens são criados pelo `ItemSystem`, inseridos pelo `BagSystem`, equipados
   pelo `EquipSystem` e negociados pelo `MarketplaceSystem`.
4. Não criar novo acesso direto a `localStorage`. Use `SaveManager` ou
   `SettingsManager`. Os acessos antigos permitidos pelo quality gate são dívida
   técnica, não exemplos a copiar.
5. RNG que altera gameplay deve ser centralizado e aceitar uma fonte injetável
   para testes. `Math.random()` só pode ser usado para efeitos visuais ou IDs
   sem influência no resultado.
6. Um evento de domínio possui um único produtor oficial. Consumidores devem
   ser idempotentes e não repetir recompensas.
7. IDs HTML devem ser únicos. Não duplicar janelas, painéis ou containers para
   substituir uma implementação antiga.
8. Não mascarar arquivo ausente com fallback silencioso. Uma tela aprovada não
   pode gerar erro de console, exceção ou resposta HTTP 404.
9. Não sobrescrever métodos de outro módulo por ordem de carregamento. Evolua o
   proprietário ou crie uma API explícita de composição.
10. Preserve alterações existentes do usuário. Não faça limpeza ou reescrita
    fora do escopo sem autorização.
11. RNG, ranking, mercado, transferência e apostas competitivas exigem uma
    capacidade liberada pelo `AuthorityGateway`; o modo local é só protótipo.

## Fluxo obrigatório

1. Mapear módulos, estado lido/escrito e eventos envolvidos.
2. Definir qual módulo é o proprietário da mudança.
3. Implementar o menor fluxo vertical completo, sem duplicar lógica.
4. Adicionar ou atualizar teste de regressão em `js/tests/IntegrationTest.js`.
5. Executar `node scripts/verify-project.mjs`.
6. Abrir `tests/integration.html` e exigir 100% das verificações.
7. Validar a interface real em 1280×720 e 1920×1080, incluindo console e rede.

Uma tarefa não está concluída com testes falhando, erros de sintaxe, IDs
duplicados, assets ausentes, 404s ou discrepâncias entre duas HUDs que exibem o
mesmo atributo.

## Entrega

Informe sempre: comportamento alterado, módulos proprietários tocados, testes
executados, resultado, riscos restantes e arquivos modificados. Não declare
“pronto” quando só o caminho visual foi testado.
