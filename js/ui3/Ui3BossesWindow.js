/*
 * Ui3BossesWindow.js — Mural de Chefes na UI 3.0 (fase 5.2).
 *
 * Assume "bosses-view" pelo Ui3Window/WindowManager (a Cidade e as missões
 * abrem por Ui3Navigation.openBosses).
 *   leitura   BossSystem (chefes, requisitos, recarga, histórico,
 *             getWeeklySnapshot)
 *   comandos  BossSystem.challenge (leva à Hunt, onde o combate aparece)
 *             e claimWeeklyReward
 */
(function initUi3BossesWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "bosses-view";
    const NOTICE_MS = 4000;

    const state = { notice: null };
    const rendered = new WeakMap();
    let parts = {};
    let noticeTimer = null;
    let ticker = null;

    function kit() {
        return Aethra.Ui3Kit;
    }

    function bosses() {
        return Aethra.BossSystem;
    }

    function patch(element, html) {
        if (!element || rendered.get(element) === html) return false;
        element.innerHTML = html;
        rendered.set(element, html);
        return true;
    }

    function number(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function duration(ms) {
        const total = Math.max(0, Math.floor(number(ms) / 1000));
        const days = Math.floor(total / 86400);
        const hours = Math.floor((total % 86400) / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}min`;
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    }

    function notify(text, tone = "ok") {
        state.notice = { text, tone };
        if (noticeTimer) window.clearTimeout(noticeTimer);
        noticeTimer = window.setTimeout(() => {
            state.notice = null;
            noticeTimer = null;
            render();
        }, NOTICE_MS);
    }

    function weeklyHTML() {
        const K = kit();
        const weekly = bosses()?.getWeeklySnapshot?.();
        if (!weekly) return "";
        const itemName = Aethra.GameData?.items?.[weekly.rewards?.item]?.name || "Item especial";
        const percent = Math.min(100, (number(weekly.progress) / Math.max(1, number(weekly.required, 1))) * 100);
        return `<section class="ui3-city-card ui3-bosses__weekly">
                <div class="ui3-row-between"><span class="ui3-eyebrow">Recompensa semanal</span><span class="ui3-caption">Reinicia em ${K.esc(duration(weekly.resetInMs))}</span></div>
                <h2 class="ui3-service__title">Baú dos Grandes Caçadores</h2>
                <p>Derrote ${K.formatNumber(weekly.required)} chefe nesta semana. Progresso: ${K.formatNumber(weekly.progress)}/${K.formatNumber(weekly.required)}.</p>
                <div class="ui3-progress ui3-progress--gold" role="meter" aria-label="Progresso semanal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent.toFixed(0)}"><div style="width:${percent.toFixed(1)}%"></div></div>
                <div class="ui3-row-between">
                    <span class="ui3-row"><span class="ui3-tag">${K.formatNumber(weekly.rewards?.gold)} de ouro</span><span class="ui3-tag">${K.esc(itemName)}</span></span>
                    ${K.button({
                        label: weekly.claimed ? "Recompensa coletada" : weekly.canClaim ? "Coletar recompensa" : "Derrote um chefe primeiro",
                        variant: weekly.canClaim ? "primary" : "secondary",
                        disabled: !weekly.canClaim,
                        attributes: { "data-ui3-boss-claim": "" }
                    })}
                </div>
            </section>`;
    }

    function bossHTML(bossId, boss) {
        const K = kit();
        const system = bosses();
        const requirement = system.getRequirementStatus(bossId);
        const history = Aethra.GameState?.bosses?.history?.[bossId] || null;
        const cooldown = number(system.getCooldownRemaining(bossId));
        const locked = boss.status === "locked";
        const status = locked
            ? boss.unlockLabel || "Bloqueado"
            : cooldown > 0 ? `Volta em ${duration(cooldown)}` : requirement.allowed ? "Disponível agora" : requirement.reason;
        const portrait = Aethra.SpriteLoader?.getCreatureSource?.({ id: bossId, name: boss.name }) || "";
        return `<article class="ui3-recipe ui3-boss${requirement.allowed ? " is-ready" : ""}${locked ? " is-locked" : ""}">
                <header class="ui3-recipe__head">
                    <span class="ui3-portrait ui3-portrait--target">${portrait ? `<img class="ui3-portrait__img" src="${K.esc(portrait)}" alt="" draggable="false">` : ""}</span>
                    <span class="ui3-list-row__text">
                        <strong>${K.esc(boss.name)} <span class="ui3-tag">Nv ${K.formatNumber(boss.levelReq)}</span></strong>
                        <small class="${requirement.allowed ? "ui3-text-ok" : ""}">${K.esc(status)}</small>
                    </span>
                </header>
                ${boss.description ? `<p class="ui3-item-description">${K.esc(boss.description)}</p>` : ""}
                <div class="ui3-row">
                    <span class="ui3-tag">${K.formatNumber(boss.phases || 1)} fase(s)</span>
                    ${boss.reward ? `<span class="ui3-tag ui3-tag--gold">${K.esc(boss.reward)}</span>` : ""}
                </div>
                ${(boss.techniques || []).length ? `<section class="ui3-stack"><span class="ui3-eyebrow">Técnicas</span><ul class="ui3-plain-list">${boss.techniques.map((technique) => `<li>${K.esc(technique)}</li>`).join("")}</ul></section>` : ""}
                <footer class="ui3-row-between">
                    <span class="ui3-caption">${history ? `Vitórias: ${K.formatNumber(history.defeats)} · melhor tempo ${K.esc(duration(history.bestTimeMs || 0))}` : "Ainda não derrotado"}</span>
                    ${K.button({
                        label: requirement.allowed ? "Desafiar" : locked ? "Bloqueado" : requirement.reason,
                        variant: requirement.allowed ? "primary" : "secondary",
                        disabled: !requirement.allowed,
                        attributes: { "data-ui3-boss-challenge": bossId }
                    })}
                </footer>
            </article>`;
    }

    function render() {
        const K = kit();
        if (!bosses()) return;
        const notice = state.notice
            ? `<p class="ui3-notice ui3-notice--${K.esc(state.notice.tone)}" role="status">${K.esc(state.notice.text)}</p>`
            : "";
        const list = Object.entries(bosses().bosses || {}).map(([id, boss]) => bossHTML(id, boss)).join("");
        patch(parts.body, `${notice}${weeklyHTML()}
            <div class="ui3-recipe-grid">${list || `<p class="ui3-empty">Nenhum chefe registrado.</p>`}</div>`);
    }

    function onClick(event) {
        const challenge = event.target.closest("[data-ui3-boss-challenge]");
        if (challenge) {
            const started = bosses()?.challenge?.(challenge.dataset.ui3BossChallenge) === true;
            if (!started) {
                notify("O desafio não pôde começar agora.", "error");
                return render();
            }
            Aethra.WindowManager?.closeWindow?.(WINDOW_ID, { source: "ui3-bosses" });
            Aethra.UIManager?.setPrimaryView?.("hunt", { source: "ui3-bosses" });
            return true;
        }
        if (event.target.closest("[data-ui3-boss-claim]")) {
            const claimed = bosses()?.claimWeeklyReward?.() === true;
            notify(claimed ? "Recompensa semanal coletada." : "A recompensa ainda não pode ser coletada.", claimed ? "ok" : "error");
            return render();
        }
        return undefined;
    }

    function setup(body) {
        body.classList.add("ui3-options");
        body.innerHTML = `<div class="ui3-options__body ui3-scroll" data-ui3-part="body"></div>`;
        parts = { body: body.querySelector("[data-ui3-part='body']") };
        body.addEventListener("click", onClick);
    }

    // Recarga e reinício semanal contam em tempo real enquanto a janela está aberta.
    function onOpen() {
        state.notice = null;
        if (!ticker) ticker = window.setInterval(render, 1000);
    }

    function onClose() {
        if (ticker) window.clearInterval(ticker);
        ticker = null;
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3BossesWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Mural de Chefes",
            className: "ui3-dialog--medium",
            setup,
            render,
            onOpen,
            onClose,
            getSubtitle: () => "Grandes alvos, requisitos e recompensas",
            events: ["boss:defeated", "boss:weekly-reset", "boss:weekly-reward-claimed", "boss:challenge-started", "levelUp", "hero:level-up"]
        });
    }
})(window.Aethra = window.Aethra || {});
