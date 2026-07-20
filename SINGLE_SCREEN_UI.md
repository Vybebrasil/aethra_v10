# Single Screen UI

A interface do modo Cartas foi reorganizada para funcionar sem scroll vertical em viewports desktop.

## Navegação

- **Hunt** exibe status do herói, cartas de combate, log e resumo da sessão.
- **Cidade** troca o conteúdo principal pelo hub de NPCs e serviços.
- Janelas como Inventário, Skills, Mercado e Loja continuam flutuantes sobre a tela ativa.

## Caçada

Quando não existe inimigo ativo, a carta do inimigo mostra:

- seletor do local de hunt;
- botão **Iniciar Caçada**;
- opção **Buscar inimigo agora** quando a sessão já está ativa.

O botão inicia o `HuntSystem` e força o primeiro encontro para evitar que a tela permaneça em “Aguardando inimigo”.

## Layout

- `body` e `city-view` usam `overflow: hidden`.
- A ActionBar fica fixa em `bottom: 0`.
- O painel principal usa a área entre a HUD superior e a ActionBar.
- O modo Cidade oculta a ActionBar, devolvendo a altura completa ao hub.
