// DisciplineMilestones.js — marcos de cada disciplina (técnicas, passivas e
// maestria por nível). Somente dados; quem aplica os efeitos são os sistemas
// de combate e progressão.
(function initDisciplineMilestones(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) {
        throw new Error("DisciplineMilestones.js requer game-core.js.");
    }

    const MILESTONES = {
        sword: [
            { level: 1, type: "skill", title: "Corte Preciso", icon: "⚔", desc: "Desbloqueia a técnica de ataque confiável de espada." },
            { level: 10, type: "passive", title: "Foco de Lâmina", desc: "Aumenta a precisão de ataques com espada em +5%." },
            { level: 20, type: "passive", title: "Corte Profundo", desc: "Aumenta a chance crítica com espadas em +3%." },
            { level: 30, type: "passive", title: "Fluxo de Combate", desc: "Reduz o custo de Vigor de Corte Preciso em 20%." },
            { level: 40, type: "passive", title: "Estilo de Duelo", desc: "Aumenta o dano crítico com espadas em +15%." },
            { level: 50, type: "mastery", title: "Mestre de Espadas", desc: "Dobra a chance de acionamento do Proc de combate de Espadas." }
        ],
        axe: [
            { level: 1, type: "skill", title: "Talho Brutal", icon: "🪓", desc: "Desbloqueia o ataque pesado de machado." },
            { level: 10, type: "passive", title: "Peso de Batalha", desc: "Aumenta o dano mínimo de machados em +10%." },
            { level: 20, type: "passive", title: "Fúria Desperta", desc: "Aumenta a chance crítica com machados em +4%." },
            { level: 30, type: "passive", title: "Talho Incessante", desc: "Reduz o custo de Vigor de Talho Brutal em 20%." },
            { level: 40, type: "passive", title: "Golpe Esmagador", desc: "Aumenta o multiplicador de dano crítico com machados em +20%." },
            { level: 50, type: "mastery", title: "Mestre de Machados", desc: "Aumenta o multiplicador do Proc de machados de 1.4x para 1.7x." }
        ],
        mace: [
            { level: 1, type: "skill", title: "Quebra-Armadura", icon: "◆", desc: "Desbloqueia o impacto de maça que perfura a Defesa." },
            { level: 10, type: "passive", title: "Peso de Ferro", desc: "Aumenta o dano base com maças em +8%." },
            { level: 20, type: "passive", title: "Ruptura de Placas", desc: "Ignora mais +10% da defesa constante do inimigo." },
            { level: 30, type: "passive", title: "Impacto Fluido", desc: "Reduz o tempo de recarga de Quebra-Armadura em 1 rodada." },
            { level: 40, type: "passive", title: "Golpe de Concussão", desc: "Adiciona +5% de chance de atordoar inimigos por 1 rodada com maça." },
            { level: 50, type: "mastery", title: "Mestre de Maças", desc: "Dobra a chance de acionamento do Proc Impacto Esmagador." }
        ],
        dagger: [
            { level: 1, type: "skill", title: "Presa Dupla", icon: "†", desc: "Desbloqueia o ataque rápido com chance de corte duplo." },
            { level: 10, type: "passive", title: "Lâmina Oculta", desc: "Aumenta a evasão em +3% ao usar adagas." },
            { level: 20, type: "passive", title: "Corte Cirúrgico", desc: "Aumenta a chance crítica com adagas em +5%." },
            { level: 30, type: "passive", title: "Reflexos Rápidos", desc: "Reduz o custo de Vigor de Presa Dupla em 25%." },
            { level: 40, type: "passive", title: "Toxina Letal", desc: "Ataques críticos de adaga adicionam envenenamento ao alvo." },
            { level: 50, type: "mastery", title: "Mestre de Adagas", desc: "Dobra a chance de acionamento do Proc de ataque duplo." }
        ],
        bow: [
            { level: 1, type: "skill", title: "Tiro Mirado", icon: "➶", desc: "Desbloqueia o disparo concentrado de longa distância." },
            { level: 10, type: "passive", title: "Olho de Águia", desc: "Aumenta a precisão com arcos em +6%." },
            { level: 20, type: "passive", title: "Tiro Penetrante", desc: "Ignora 10% da defesa do inimigo com tiros de arco." },
            { level: 30, type: "passive", title: "Estreitamento", desc: "Reduz o tempo de recarga de Tiro Mirado em 1 rodada." },
            { level: 40, type: "passive", title: "Distanciamento", desc: "Reduz o dano recebido em 5% enquanto usar arcos." },
            { level: 50, type: "mastery", title: "Mestre de Arcos", desc: "Dobra a chance de acionamento do Proc de acerto crítico de arco." }
        ],
        fire: [
            { level: 1, type: "skill", title: "Projétil de Fogo", icon: "🔥", desc: "Desbloqueia a magia de fogo com chance de queimadura." },
            { level: 10, type: "passive", title: "Ignição", desc: "Aumenta o dano de queima do Projétil de Fogo em +15%." },
            { level: 20, type: "passive", title: "Calor Intenso", desc: "Aumenta o multiplicador mágico de fogo em +10%." },
            { level: 30, type: "passive", title: "Conjuração Rápida", desc: "Reduz o custo de Mana de Projétil de Fogo em 20%." },
            { level: 40, type: "passive", title: "Piro-explosão", desc: "Aumenta a chance crítica de magias de fogo em +6%." },
            { level: 50, type: "mastery", title: "Mestre do Fogo", desc: "Dobra a chance de acionamento da queima do Projétil de Fogo." }
        ],
        ice: [
            { level: 1, type: "skill", title: "Estilhaço de Gelo", icon: "❄", desc: "Desbloqueia o estilhaço de gelo com congelamento." },
            { level: 10, type: "passive", title: "Geada", desc: "Aumenta a redução de dano inimigo pelo congelamento em +5%." },
            { level: 20, type: "passive", title: "Crio-resiliência", desc: "Aumenta a defesa constante em +4 ao usar gelo." },
            { level: 30, type: "passive", title: "Congelamento Rápido", desc: "Reduz o tempo de recarga de Estilhaço de Gelo em 1 rodada." },
            { level: 40, type: "passive", title: "Barreira Glacial", desc: "Ganhe um escudo de gelo equivalente a 10% da vida máxima ao início de combates." },
            { level: 50, type: "mastery", title: "Mestre do Gelo", desc: "Estilhaço de Gelo tem chance de congelar o inimigo por 1 rodada." }
        ],
        shadow: [
            { level: 1, type: "skill", title: "Seta Sombria", icon: "☾", desc: "Desbloqueia a magia de trevas com roubo de vida." },
            { level: 10, type: "passive", title: "Dreno de Alma", desc: "Aumenta o dreno de vida de Seta Sombria em +5%." },
            { level: 20, type: "passive", title: "Aura Escura", desc: "Aumenta o Poder Mágico em +8% ao usar trevas." },
            { level: 30, type: "passive", title: "Corrupção de Sangue", desc: "Seta Sombria aplica veneno de trevas ao alvo." },
            { level: 40, type: "passive", title: "Pacto Sombrio", desc: "Recupere 3 de Mana cada vez que conjurar Seta Sombria." },
            { level: 50, type: "mastery", title: "Mestre das Trevas", desc: "Dobra a taxa de roubo de vida de todas as magias de trevas." }
        ],
        restoration: [
            { level: 1, type: "skill", title: "Cura", icon: "✚", desc: "Desbloqueia a magia de cura de HP." },
            { level: 10, type: "passive", title: "Voz de Luz", desc: "Aumenta a eficiência de Cura em +15%." },
            { level: 20, type: "passive", title: "Prece Silenciosa", desc: "Reduz o custo de Mana de Cura em 20%." },
            { level: 30, type: "passive", title: "Renovação", desc: "Adiciona uma cura regenerativa leve ao longo de 3 rodadas." },
            { level: 40, type: "passive", title: "Preservação", desc: "Se o HP cair abaixo de 20%, a cura é instantaneamente conjurada sem gastar mana." },
            { level: 50, type: "mastery", title: "Mestre Restaurador", desc: "Dobra a chance de acionamento do Proc Cura Plena." }
        ],
        shield: [
            { level: 1, type: "skill", title: "Postura de Guarda", icon: "🛡", desc: "Desbloqueia a postura que aumenta defesa e bloqueio." },
            { level: 10, type: "passive", title: "Reforço de Escudo", desc: "Aumenta a redução de dano bloqueado em +8%." },
            { level: 20, type: "passive", title: "Guarda Impenetrável", desc: "Aumenta a chance de bloqueio básico em +5%." },
            { level: 30, type: "passive", title: "Aparar Eficiente", desc: "Postura de Guarda dura mais 1 rodada no combate." },
            { level: 40, type: "passive", title: "Contra-Ataque", desc: "Bloquear um ataque tem 25% de chance de causar contra-golpe físico." },
            { level: 50, type: "mastery", title: "Mestre de Escudos", desc: "Aumenta a eficiência de bloqueio em +15% permanentes." }
        ],
        cloth_armor: [
            { level: 1, type: "passive", title: "Leveza", desc: "Permite usar armaduras de tecido com bônus de Magia." },
            { level: 10, type: "passive", title: "Mente Clara", desc: "Aumenta a regeneração de mana no mundo em +10%." },
            { level: 20, type: "passive", title: "Túnica Rúnica", desc: "Aumenta a resistência a magias elementais em +12%." },
            { level: 30, type: "passive", title: "Escudo Arcano", desc: "Ganha barreira de mana equivalente a 15% do MP máximo." },
            { level: 40, type: "passive", title: "Alquimia Corporal", desc: "Poções de vida e vigor curam +15% a mais." },
            { level: 50, type: "mastery", title: "Mestre do Tecido", desc: "Ao conjurar magias, tem 10% de chance de não gastar mana." }
        ],
        leather_armor: [
            { level: 1, type: "passive", title: "Mobilidade", desc: "Permite usar armaduras de couro com bônus de Evasão." },
            { level: 10, type: "passive", title: "Passo Leve", desc: "Aumenta a chance de esquiva básica em +3%." },
            { level: 20, type: "passive", title: "Sombra Fluida", desc: "Aumenta a chance crítica de ataques físicos em +2.5%." },
            { level: 30, type: "passive", title: "Evasão Consecutiva", desc: "Esquivar-se de um golpe aumenta a precisão do próximo golpe em +10%." },
            { level: 40, type: "passive", title: "Fuga Oportunista", desc: "Esquivar-se de um golpe recupera 5 de Vigor." },
            { level: 50, type: "mastery", title: "Mestre do Couro", desc: "Esquivas físicas têm 15% de chance de zerar o tempo de recarga da sua skill ativa." }
        ],
        plate_armor: [
            { level: 1, type: "passive", title: "Fortaleza", desc: "Permite usar armaduras de placa com bônus de Defesa." },
            { level: 10, type: "passive", title: "Aço Temperado", desc: "Aumenta a Defesa constante em +3." },
            { level: 20, type: "passive", title: "Sangue de Titã", desc: "Aumenta a Vida máxima em +10%." },
            { level: 30, type: "passive", title: "Barreira de Ferro", desc: "Reduz o dano físico sofrido de monstros elite ou boss em 12%." },
            { level: 40, type: "passive", title: "Peso de Guarda", desc: "Aumenta o bloqueio com escudos em +5%." },
            { level: 50, type: "mastery", title: "Mestre de Placas", desc: "Reduz todo o dano físico sofrido em 5% permanentes." }
        ],
        survival: [
            { level: 1, type: "passive", title: "Resistência", desc: "Evolui resistindo a riscos e caçadas longas." },
            { level: 10, type: "passive", title: "Nutrição", desc: "Aumenta a cura de acampamentos em +20%." },
            { level: 20, type: "passive", title: "Economia de Viagem", desc: "Reduz o custo de suprimentos de expedição em 15%." },
            { level: 30, type: "passive", title: "Pele Grossa", desc: "Reduz a chance de receber status negativos (queimadura, envenenamento)." },
            { level: 40, type: "passive", title: "Vigor do Caçador", desc: "Aumenta a regeneração de vigor em combate em +1 por rodada." },
            { level: 50, type: "mastery", title: "Mestre Sobrevivente", desc: "Permite resistir a um golpe fatal com 1 de HP por caçada." }
        ]
    };

    Aethra.DisciplineMilestones = Object.freeze({
        // Cópia dos marcos da disciplina, em ordem de nível.
        get(disciplineId) {
            return JSON.parse(JSON.stringify(MILESTONES[disciplineId] || []));
        }
    });
})(window.Aethra = window.Aethra || {});
