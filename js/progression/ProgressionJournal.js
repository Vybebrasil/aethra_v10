// ProgressionJournal.js — projeção do Diário de Progressão, sem tela.
// Junta DisciplineSystem, ProfessionSystem, RecipeCatalog e os marcos das
// disciplinas em um modelo pronto para qualquer interface, e guarda o XP
// recente recebido nesta sessão. Não escreve estado de jogo.
(function initProgressionJournal(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;
    if (Aethra.ProgressionJournal) return;

    const MAX_RECENT = 8;
    const SOURCE_LABELS = Object.freeze({
        "weapon-use": "Ataque com arma",
        "skill-use": "Técnica usada",
        "defense-block": "Bloqueio",
        "defense-hit": "Armadura em combate",
        mining: "Mineração",
        "creature-harvest": "Esfolamento",
        forge: "Forjaria",
        smelt: "Fundição",
        tan: "Curtimento",
        "craft-leather": "Couraria",
        exploration: "Exploração",
        survival: "Sobrevivência"
    });

    let recent = [];

    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const clone = (value) => JSON.parse(JSON.stringify(value));

    function allSkills() {
        return Object.values(Aethra.DisciplineSystem?.getSnapshot?.() || {});
    }

    function focusId(skills = allSkills()) {
        const id = Aethra.DisciplineSystem?.getFocusId?.();
        return skills.some((entry) => entry.id === id) ? id : null;
    }

    // O próximo marco mais próximo entre disciplina, receita e especialização.
    function nextMilestone(skill) {
        const level = Math.max(1, number(skill?.level, 1));
        const candidates = [];
        const disciplineMilestone = (Aethra.DisciplineMilestones?.get?.(skill.id) || [])
            .filter((entry) => number(entry.level) > level)
            .sort((a, b) => number(a.level) - number(b.level))[0];
        if (disciplineMilestone) {
            candidates.push({
                level: disciplineMilestone.level,
                type: disciplineMilestone.type || "marco",
                title: disciplineMilestone.title,
                description: disciplineMilestone.desc
            });
        }

        const recipe = (Aethra.RecipeCatalog?.byProfession?.(skill.id) || [])
            .filter((entry) => number(entry.unlockLevel, 1) > level)
            .sort((a, b) => number(a.unlockLevel) - number(b.unlockLevel))[0];
        if (recipe) {
            candidates.push({
                level: recipe.unlockLevel,
                type: "receita",
                title: recipe.name,
                description: `${Aethra.RecipeCatalog?.tierName?.(recipe.tier) || `Tier ${recipe.tier}`} · ${recipe.description || "Nova receita de criação."}`
            });
        }

        const specialization = Aethra.ProfessionSystem?.getSpecializationState?.(skill.id);
        const tree = Aethra.ProfessionSystem?.getSpecializationTree?.(skill.id);
        if (specialization && tree) {
            if (!specialization.branchId) {
                candidates.push({
                    level: Math.max(level, specialization.unlockLevel),
                    type: "especialização",
                    title: level >= specialization.unlockLevel ? "Especialização disponível" : "Escolha de especialização",
                    description: level >= specialization.unlockLevel
                        ? "Escolha agora um caminho permanente para esta profissão."
                        : "Dois caminhos permanentes passam a definir sua maestria."
                });
            } else {
                const nextNode = specialization.branch?.nodes
                    ?.filter((entry) => number(entry.level) > level)
                    .sort((a, b) => number(a.level) - number(b.level))[0];
                candidates.push(nextNode
                    ? {
                        level: nextNode.level,
                        type: "especialização",
                        title: nextNode.name,
                        description: nextNode.description || `Novo marco de ${specialization.branch.name}.`
                    }
                    : {
                        level: specialization.nextMasteryLevel,
                        type: "maestria",
                        title: `Pulso de ${specialization.branch.name}`,
                        description: "Novo ganho permanente com retorno decrescente; a progressão não tem nível máximo."
                    });
            }
        }

        return candidates.sort((a, b) => number(a.level) - number(b.level))[0] || {
            level: level + 1,
            type: "nível",
            title: "Maestria contínua",
            description: "Continue praticando: os benefícios crescem sem um nível máximo, com retorno decrescente."
        };
    }

    function entryViewModel(skill, focused) {
        const discipline = Aethra.DisciplineSystem;
        const bonus = discipline?.getDiminishingBonus?.(skill.id, { scale: 12, interval: 10 });
        return {
            ...skill,
            focused: skill.id === focused,
            training: skill.trainingMode !== "locked",
            guide: discipline?.getTrainingGuide?.(skill.id) || {},
            policy: skill.policy || Aethra.ProfessionSystem?.getState?.(skill.id)?.policy || null,
            specialization: Aethra.ProfessionSystem?.getSpecializationState?.(skill.id) || null,
            contract: skill.id === focused
                ? Aethra.ProfessionSystem?.getFocusTrainingState?.(skill.id) || null
                : null,
            nextUnlock: nextMilestone(skill),
            bonusPercent: number(bonus),
            progressPercent: Math.min(100, Math.max(0, number(skill.progressPercent)))
        };
    }

    function getViewModel() {
        const skills = allSkills();
        const focused = focusId(skills);
        const entries = skills.map((skill) => entryViewModel(skill, focused));
        return {
            entries,
            categories: [...new Set(entries.map((entry) => entry.category))],
            focused: entries.find((entry) => entry.focused) || null,
            summary: {
                total: entries.length,
                training: entries.filter((entry) => entry.training).length,
                paused: entries.filter((entry) => !entry.training).length,
                discovered: entries.filter((entry) => entry.discovered).length
            },
            recent: clone(recent)
        };
    }

    function sourceLabel(source) {
        return SOURCE_LABELS[source] || String(source || "Ação de treino").replaceAll("-", " ");
    }

    function recordXP(payload = {}) {
        const skillId = payload.skillId || payload.id;
        if (!skillId || number(payload.amount) <= 0) return;
        if (!allSkills().some((entry) => entry.id === skillId)) return;
        recent.unshift({
            skillId,
            amount: number(payload.amount),
            source: payload.source || "skill-action",
            sourceLabel: sourceLabel(payload.source),
            time: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date())
        });
        recent = recent.slice(0, MAX_RECENT);
        Aethra.EventBus.emit("progression-journal:recent-changed", { skillId });
    }

    Aethra.EventBus.on("skill:xp-changed", recordXP);

    Aethra.ProgressionJournal = Object.freeze({
        getViewModel,
        nextMilestone,
        getRecent: () => clone(recent)
    });
})(window.Aethra = window.Aethra || {});
