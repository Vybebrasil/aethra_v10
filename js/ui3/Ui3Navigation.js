/*
 * Ui3Navigation.js — rotas da UI 3.0: abrir janelas com o pedido certo e
 * seguir a orientação de missões e do treino em foco.
 *
 * Só navega. Quem decide o próximo passo são QuestSystem.getGuidance e
 * DisciplineSystem.getFocusedGuidance; quem troca Hunt/Cidade é o UIManager;
 * as janelas recebem o pedido nas opções de WindowManager.openWindow.
 */
(function initUi3Navigation(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    // NPCs da Cidade que abrem a oficina do seu ofício.
    const WORKSHOP_NPCS = Object.freeze({
        blacksmith: "blacksmithing",
        tanner: "leatherworking"
    });

    function openWindow(id, options = {}) {
        return Aethra.WindowManager?.openWindow?.(id, options) ?? false;
    }

    function setView(view, source) {
        Aethra.UIManager?.setPrimaryView?.(view, { source });
    }

    function inCity() {
        return Aethra.UIManager?.primaryView === "city" && !Aethra.GameState?.hunt?.isActive;
    }

    const Navigation = {
        /*
         * Mapa-Mundi. focusSkillId abre na caçada que treina a habilidade;
         * mode "hunts" abre no catálogo de criaturas.
         */
        openHuntMap({ source = "ui3", huntId = null, creatureId = null, focusSkillId = null, mode = null } = {}) {
            const focus = focusSkillId ? Aethra.DisciplineSystem?.getFocusedGuidance?.(focusSkillId) : null;
            return openWindow("hunt-world-map-view", {
                source,
                mode: mode || focus?.mapMode || null,
                huntId: huntId || focus?.huntId || null,
                creatureId,
                view: focus?.mapMode === "hunts" ? "focus" : null
            });
        },

        openWorkshop(professionId, { source = "ui3", tab = null, stationId = null } = {}) {
            return openWindow("profession-workshop-view", {
                source,
                exclusive: true,
                professionId,
                tab,
                stationId: stationId || Aethra.CraftingGuidance?.stationFor?.(professionId, { inCity: inCity() }) || null
            });
        },

        openSpecialization(professionId, { source = "ui3" } = {}) {
            return openWindow("profession-specialization-view", { source, exclusive: true, professionId });
        },

        openBosses({ source = "ui3" } = {}) {
            return openWindow("bosses-view", { source, exclusive: true });
        },

        openMentor({ source = "ui3" } = {}) {
            return openWindow("profession-mentor-view", { source, exclusive: true });
        },

        // Segue QuestSystem.getGuidance: cada ação leva à tela ou janela certa.
        followQuestGuidance(guidance, { source = "quest-tracker" } = {}) {
            if (!guidance) return false;
            switch (guidance.action) {
                case "open-hunt-map":
                    setView("hunt", source);
                    return Navigation.openHuntMap({ source, huntId: guidance.huntId || null });
                case "go-city":
                    setView("city", source);
                    return true;
                case "interact-npc":
                    setView("city", source);
                    return Aethra.EntityManager?.interactWithEntity?.(guidance.target, { source }) ?? false;
                case "focus-hunt":
                    setView("hunt", source);
                    return true;
                case "open-workshop":
                    setView("city", source);
                    return Navigation.openWorkshop(guidance.professionId || guidance.target, { source });
                case "open-bosses":
                    setView("city", source);
                    return Navigation.openBosses({ source });
                default:
                    return openWindow("quests-view", { source });
            }
        },

        // Segue DisciplineSystem.getFocusedGuidance: oficina ou caçada que treina.
        followDisciplineGuidance(guidance, { source = "skill-focus-tracker" } = {}) {
            if (!guidance) return false;
            if (guidance.action === "open-workshop") {
                setView("city", source);
                return Navigation.openWorkshop(guidance.professionId || guidance.disciplineId, { source });
            }
            setView("hunt", source);
            return Navigation.openHuntMap({
                source,
                focusSkillId: guidance.disciplineId,
                huntId: guidance.huntId || null,
                mode: guidance.mapMode || null
            });
        }
    };

    Aethra.Ui3Navigation = Navigation;

    Aethra.EventBus.on("city:npcInteracted", ({ entity } = {}) => {
        if (!Aethra.Ui3Shell?.isActive?.()) return;
        const professionId = WORKSHOP_NPCS[entity?.id];
        if (professionId) Navigation.openWorkshop(professionId, { source: "city-npc", stationId: Aethra.CraftingGuidance?.professions?.[professionId]?.stationId });
    });
})(window.Aethra = window.Aethra || {});
