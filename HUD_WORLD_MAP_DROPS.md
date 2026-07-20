# HUD World Map & Drops Pass

## Fluxo de Hunt

- O botão **Hunt** da navbar abre o **Mapa Mundi de Expedições**.
- O mapa apresenta seis regiões, com nível mínimo, perigo, bioma, ameaças e recompensas.
- Regiões acima do nível do herói permanecem bloqueadas.
- A Hunt só é iniciada depois que o jogador escolhe uma região e usa **Viajar e iniciar Hunt**.
- O card sem inimigo também direciona para o Mapa Mundi.

## Encontro

- O painel do encontro voltou a ter altura legível.
- Herói e inimigo possuem retratos maiores, barras completas e métricas visíveis.
- O Inspect não é mais renderizado dentro da carta.

## Inspect

- O botão **Inspect** abre uma janela suspensa independente.
- A ficha não altera a altura das cartas nem cria scroll interno no encontro.
- A ficha do herói também pode ser aberta pelo botão **Ficha** no bloco de atributos.

## Drops da Expedição

- O antigo painel principal de Log de Combate foi substituído por **Drops da Expedição**.
- São registrados Gold, XP, itens, recursos, baús, raridades e skill ups.
- O Log de Combate matemático permanece disponível em uma janela secundária pelo botão **Log**.

## Painel do Herói

- Blocos recolhidos agora ocupam apenas a altura do cabeçalho.
- Não sobra espaço vazio de Equipamentos, Backpack ou Skills ao minimizar.

## ActionBar

- O drag and drop utiliza um puxador visível e interativo.
- O puxador possui `draggable=true` e troca os slots usando `SkillSystem.moveSkill()`.
