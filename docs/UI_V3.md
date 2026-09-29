# UI 3.0 — "Ferro e Ouro"

Contrato da nova interface. Leia antes de mexer em qualquer tela.

Protótipo aprovado (29/09/2026): canvas "Aethra UI 3.0" —
https://claude.ai/artifact/Tt5X2Z9x67Nb678jSrKYhP (pranchas Hunt, Mochila,
Antes e Sistema visual).

## Por que uma raiz nova

A UI clássica acumulou 13 folhas de CSS, ~3.800 `!important` e 35
sobrescritas de métodos do `RenderEngine`. Cada rodada de ajustes (HUD 3.0 →
5.2 → v6) adicionou mais uma camada por cima da anterior. Uma folha nova sem
`!important` perderia qualquer disputa com esse CSS no mesmo elemento.

Por isso a UI 3.0 vive em `#ui3-root`, fora das camadas clássicas, com classes
próprias. Medido em 29/09: só 9 regras clássicas alcançam essa raiz, todas
inofensivas (`box-sizing`, `font: inherit`, `color: inherit` e o bloco de
movimento reduzido). A galeria de componentes, renderizada dentro do jogo com
todo o CSS clássico carregado, sai idêntica ao protótipo.

## Regras (o quality gate reprova quem violar)

1. Todo seletor de `css/aethra-ui3.css` começa em `#ui3-root` ou `.ui3`.
2. Nenhum `!important` na folha.
3. Nenhuma fonte abaixo de 11px: use os tokens `--ui3-fs-*` (clamp com
   mínimo ≥ 11px) ou px ≥ 11. `em`, `rem` e `%` em `font-size` são recusados.
4. Os módulos de `js/ui3/` não escrevem no `GameState`. Eles leem dados prontos
   e disparam comandos pelos sistemas donos (regra 1 do `AGENTS.md`).
5. Não crie `aethra-ui4.css`, `hud-v7.css` nem folhas "de ajuste". Evolua
   `aethra-ui3.css` e o `Ui3Kit`.

## Peças

| Peça | Arquivo | Papel |
| --- | --- | --- |
| Tokens e componentes | `css/aethra-ui3.css` | Cores, tipografia, espaço e todos os componentes |
| Componentes | `js/ui3/Ui3Kit.js` | Funções puras que devolvem HTML; escapam todo texto |
| Raiz e versão | `js/ui3/Ui3Shell.js` | Cria `#ui3-root`, aplica a versão, galeria de dev |
| Preferência | `SettingsManager.interfaceVersion` | `"classic"` (padrão) ou `"v3"` |

Tipografia: Cinzel (títulos) + Barlow (interface), números tabulares. Os tokens
de fonte valem exatamente 11/12/13/14/16/20/28px em 1280px e crescem até
12/13/15/16/19/24/34px em 1920px.

## Desenvolvimento

- `?ui3=galeria` abre a galeria de componentes sobre o jogo.
- `?ui=3` ativa a UI 3.0; `?ui=classic` volta (fica salvo nas preferências).
- Uma tela da UI 3.0 é um elemento com `data-ui3-screen` dentro de
  `#ui3-root`; a raiz só aparece quando há uma tela ou a galeria.

## Migração por fases (branch `ui-v3`)

| Fase | Escopo | Estado |
| --- | --- | --- |
| 1. Fundação | tokens, componentes, raiz, preferência, regras no gate | concluída |
| 2. Hunt | mapa 2D como palco; HUD flutuante: herói, alvo, expedição, registro, barra de ações | pendente |
| 3. Janelas | Mochila/Equipamento, Loja, Habilidades/Automação | pendente |
| 4. Demais telas | Cidade, Mapa-Mundi/Atlas, Missões, Lobby, Criação | pendente |
| 5. Limpeza | remover `style.css` + v2/v5/v6 e o CSS/JS morto; desfazer os monkey-patches | pendente |

Cada fase termina com a suíte verde, o gate verde e validação em 1280×720 e
1920×1080. Ao substituir uma tela, migre também os testes dela para os
seletores novos; não deixe teste apontando para markup morto.
