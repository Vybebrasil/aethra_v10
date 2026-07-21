# Padrão de Engenharia — Crônicas de Aethra

## 1. Objetivo

Este documento define como evoluir o jogo sem criar fontes de verdade
concorrentes, recompensas duplicadas ou interfaces que discordam do estado
real. O padrão vale para humanos e agentes de código.

O princípio central é simples:

> Um domínio possui um proprietário. Outros módulos enviam comandos ou exibem
> sua projeção; não recriam suas regras.

## 2. Fluxo arquitetural

```text
Entrada do jogador / automação
              ↓
        Comando de domínio
              ↓
 Sistema proprietário valida e altera GameState
              ↓
          Evento oficial
              ↓
 HUD, mapa, áudio, analyzer e telemetria renderizam o resultado
```

Exemplo correto: a ActionBar solicita `SkillController.useSkill`; o
`BattleSystem` resolve acerto e dano; um evento oficial informa o resultado; a
HUD e o mapa animam esse mesmo resultado.

Exemplo proibido: o mapa sorteia dano, reduz HP, concede XP e depois também
ouve o resultado emitido pelo `BattleSystem`.

## 3. Ownership e limites

### Combate

- `BattleSystem` é a única autoridade para rodada, acerto, erro, defesa,
  bloqueio, dano, cura, vitória e morte.
- Cooldowns são medidos em rodadas. Velocidade muda apenas a apresentação.
- A HUD nunca infere um segundo resultado; ela apresenta o payload oficial.
- Todo resultado aleatório importante deve ser reproduzível em teste por meio
  de `randomSource` injetável.

### Progressão

- `XPSystem` é a única porta para ganhar ou perder XP e subir de nível.
- Chance de acerto, esquiva, crítico e bloqueio usa curvas limitadas. Nenhuma
  probabilidade chega a 100% por progressão comum.
- Crescimento infinito deve ser testado em marcos como níveis 1, 10, 100, 300,
  500, 1.000 e 2.000 antes de ser liberado.

### Itens e economia

- Template descreve o tipo; instância descreve aquele item específico.
- Todo equipamento persistente precisa de `instanceId`, origem, vínculo,
  qualidade e rolls já resolvidos.
- A mochila não recebe objetos crus por `push`.
- Compra e venda são transações: validar → calcular → mutar uma vez → emitir um
  evento → salvar.
- Itens `bound`, `starter` ou não negociáveis jamais entram em venda em massa.
- A mesma recompensa não pode ser creditada por evento visual e evento de
  domínio.

### Persistência

- Save possui versão de schema e migrações explícitas.
- `SaveManager` controla o estado persistente; `SettingsManager`, preferências
  locais de interface.
- Nunca apagar ou reinicializar save por incompatibilidade silenciosa.
- Testar criação nova, carregamento de save atual e migração do save anterior.

### Interface

- UI pode manter estado efêmero sob `GameState.ui`, mas não regras econômicas ou
  de combate.
- O mesmo atributo deve vir do mesmo selector/ViewModel em todas as HUDs.
- Componentes precisam de empty, loading, active, disabled, failure e overflow
  states quando aplicáveis.
- Todo botão precisa de estado acessível e feedback de sucesso/erro.
- Fallback de imagem é aceitável apenas depois de registrar o asset ausente em
  desenvolvimento; não pode esconder 404 em produção.

## 4. Eventos e idempotência

Todo evento novo precisa declarar:

- produtor oficial;
- momento da emissão;
- formato do payload;
- consumidores esperados;
- se pode ser repetido;
- chave de idempotência para eventos econômicos.

Convenção recomendada:

```js
{
    eventId: "identificador-unico",
    source: "battle-system",
    occurredAt: "ISO-8601",
    actor: { id: "hero", name: "Aethra" },
    target: { id: "bandit", name: "Bandido" },
    result: { kind: "damage", amount: 4, hit: true, critical: false }
}
```

Consumidores visuais podem repetir a renderização. Consumidores econômicos
devem rejeitar um `eventId` já processado.

## 5. Processo para cada mudança

Antes de codar, registre no raciocínio ou descrição da tarefa:

1. problema observado;
2. comportamento esperado;
3. proprietário do domínio;
4. estado lido e estado alterado;
5. eventos produzidos e consumidos;
6. cenários de sucesso, falha e borda;
7. impacto em saves existentes.

Durante a implementação:

- prefira corrigir o proprietário em vez de aplicar um patch posterior;
- evite reescrever arquivos inteiros quando uma alteração localizada resolve;
- remova a implementação substituída no mesmo fluxo;
- use nomes de cache/versionamento quando um asset carregado pelo HTML mudar;
- não adicione dependência sem justificar custo e manutenção.

## 6. Definition of Done

Uma alteração está pronta somente quando:

- o comportamento possui um único dono;
- há teste de regressão para o bug ou regra criada;
- `node scripts/verify-project.mjs` termina com sucesso;
- `tests/integration.html` apresenta 100% de aprovação;
- não há erro no console nem 404 na rede;
- não há ID duplicado;
- o layout foi validado em 1280×720 e 1920×1080;
- novo personagem e save existente continuam funcionando;
- o relatório final descreve riscos que ainda não foram resolvidos.

## 7. Regras para beta, PvP e itens valiosos

Antes de ranking competitivo, negociação valiosa ou apostas:

- servidor autoritativo para combate competitivo, inventário e moeda;
- RNG e geração de itens assinados pelo servidor;
- operações transacionais e idempotentes;
- log de auditoria de criação, transferência e destruição de itens;
- proteção contra replay, edição de save e duplicação;
- matchmaking por rating e faixa de poder/nível, sem normalizar o potencial do
  personagem;
- revisão jurídica e regional antes de qualquer aposta entre jogadores.

O cliente local pode simular essas funções no protótipo, mas nunca é autoridade
competitiva.

## 8. Dívida técnica conhecida

Estas exceções existem hoje e devem diminuir, nunca aumentar:

- outras áreas da UI ainda complementam métodos do `RenderEngine`; o caminho
  central de combate já usa composição por evento;
- algumas preferências antigas acessam `localStorage` fora dos managers;
- Lobby e save principal ainda precisam de um gerenciador único de perfis;
- o backend competitivo ainda precisa implementar o contrato do
  `AuthorityGateway`;
- o catálogo gerado precisa migrar para schema declarativo validado.

Ao tocar uma dessas áreas, prefira remover uma exceção em vez de adicionar outra.

## 9. Continuidade entre desenvolvedores

Antes de alterar um subsistema existente, leia `docs/DEVELOPER_HANDOFF.md`. Esse
arquivo registra os proprietários atuais de estado e comportamento, os contratos
entre gameplay e HUD, a migração de save, o último resultado dos testes e o
backlog recomendado.

Se uma mudança transferir responsabilidade, adicionar uma nova autoridade de
domínio, alterar eventos ou modificar o schema persistido, atualize o handoff no
mesmo commit. Um novo sistema não deve ser criado sem antes confirmar que a regra
não pertence a um proprietário já existente.
