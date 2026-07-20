# Economy RNG V1

## Objetivo

Criar um RNG em camadas inspirado na experiência relatada com Pokémon idle:

- o encontro raro pode aparecer com frequência maior durante eventos;
- encontrar a oportunidade rara não garante o jackpot econômico;
- o jogador sempre recebe uma recompensa de consolação;
- equipamentos especiais continuam passando por raridade, multiplicador, IV e afixos;
- boosters de aparição não multiplicam diretamente a chance do jackpot.

## Camadas

### 1. Encontro raro

Taxa padrão:

- `1 / 500` kills elegíveis;
- chance base de `0,2%`.

Modificadores são multiplicativos:

- evento `+50%` = `1,5x`;
- booster `+300%` = `4x`;
- combinação = `6x`;
- taxa combinada = `1,2%`, aproximadamente `1 / 83,3`.

Em 40.000 kills, a expectativa matemática é de 480 encontros raros.

### 2. Consolação

Todo encontro raro concede:

- 1 a 3 Fragmentos de Éter;
- 4 a 12 Gold;
- fragmentos extras após secas muito longas.

Não existe pity que garanta equipamento especial. A proteção contra azar melhora apenas a recompensa paralela.

### 3. Jackpot econômico

Cada encontro raro possui `0,15%` de chance de gerar um equipamento especial.

Após 482 encontros raros, ainda existe aproximadamente `48,5%` de chance de nenhum equipamento especial ter aparecido.

Eventos e boosters aumentam a quantidade de encontros raros, mas não alteram diretamente os `0,15%`. Apenas um modificador econômico separado e limitado a `+10%` pode alterar essa etapa.

### 4. Raridade

Equipamentos normais:

- Comum: 65%
- Incomum: 24%
- Raro: 8%
- Épico: 2,4%
- Lendário: 0,55%
- Mítico: 0,05%

Equipamentos de encontro raro:

- Raro: 70%
- Épico: 24%
- Lendário: 5,5%
- Mítico: 0,5%

### 5. IV

O IV global agora usa componentes verificáveis:

- multiplicador principal: 35%;
- atributos individuais: 35%;
- afixos: 20%;
- potencial de evolução: 10%.

Componentes inexistentes não recebem nota perfeita artificialmente. O peso é redistribuído entre os componentes aplicáveis.

O IV do afixo é calculado pelo valor efetivamente rolado:

`(valor - mínimo) / (máximo - mínimo)`

Não existe mais um segundo sorteio apenas para exibição.

## Telemetria interna

`Aethra.GameState.economyRng.telemetry` registra:

- kills elegíveis;
- encontros raros;
- equipamentos especiais;
- seca atual;
- fragmentos de consolação;
- itens Lendários, Míticos e Perfeitos;
- distribuição de raridades.

Esses dados não são exibidos na HUD principal.

## API de eventos e boosters

Ativar evento de +50%:

```js
Aethra.EconomyRNGManager.setAppearanceEvent({ bonus: 0.5 });
```

Ativar booster de +300%:

```js
Aethra.EconomyRNGManager.setBooster({ bonus: 3 });
```

Desativar todos os modificadores:

```js
Aethra.EconomyRNGManager.clearModifiers();
```

## Segurança

Esta versão ainda é um protótipo client-side. O objeto do item registra `authority: "client-prototype"`.

Antes de qualquer RMT, os sorteios, criação de IDs, propriedade, inventário e transações precisam ser movidos para um servidor autoritativo.
