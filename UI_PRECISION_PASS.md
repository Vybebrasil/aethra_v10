# HUD Precision Pass V4

Refinamento visual e funcional aplicado sobre `aethra_hud_modern_explained`.

## ActionBar

- Altura reservada de 156 px em 1366×768 e 164 px em viewports maiores.
- Dez slots permanecem visíveis sem scroll.
- Nome da habilidade aceita duas linhas sem cortar custo ou controles.
- Ícone, prioridade, custo, badge AUTO e threshold de cura possuem áreas próprias.
- Cooldown usa wipe escuro, anel progressivo e contador decimal.
- O botão da habilidade permanece desabilitado até o cooldown terminar.

## Tooltips

- Tooltip anexado diretamente ao `body` e excluído do filtro que ocultava elementos fora das camadas principais.
- Habilidades mostram nome, tipo, potência estimada, custo, cooldown e disponibilidade.
- Atributos mostram efeito atual e fórmula.
- Posicionamento das habilidades é ancorado acima do slot para evitar jitter.

## Combate e recursos

- Ataques básicos agora também atualizam `lastHeroAction` quando o SkillController está ativo.
- O card do herói mostra a ação do turno com animação e ícone contextual.
- XP possui linha fixa de 44 px abaixo de Vida e Mana.
- Bloco de status não cria scroll interno.
- Cards de Herói e Inimigo receberam bordas em gradiente, sombras e maior respiro interno.

## Validação

Testado em 1366×768, 1440×900 e 1920×1080:

- sem scroll da página;
- ActionBar sem sobrepor o conteúdo;
- XP visível;
- tooltips visíveis;
- nenhum erro JavaScript de execução no harness de UI.
