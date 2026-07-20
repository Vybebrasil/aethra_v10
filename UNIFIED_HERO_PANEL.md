# Unified Hero Panel

A coluna esquerda foi consolidada em um único painel de personagem, mantendo o dashboard em tela única.

## Seções

- **Visão:** identidade, mapa atual, vigor, Vida, Mana, XP e atributos com impacto real.
- **Equipamentos:** seis slots compactos e resumo da build, incluindo IV médio, multiplicador máximo e bônus brutos.
- **Mochila:** capacidade, itens rápidos e detalhes do item selecionado.
- **Skills:** nível individual, experiência, usos registrados, domínio e benefício do próximo nível.

## Progressão de skills

Cada habilidade possui nível e experiência próprios. O uso da habilidade concede XP de maestria. Cada nível aumenta em 2,5% a potência da habilidade, aplicado ao dano ou à cura.

O estado é mantido em `hero.skillProgression` e permanece compatível com o sistema de save atual.

## Arquivos principais

- `js/combat/SkillSystem.js`
- `js/combat/SkillController.js`
- `js/ui/RenderEngine.js`
- `js/ui/UIManager.js`
- `style.css`
