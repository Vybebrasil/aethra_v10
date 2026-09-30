/*
 * Ui3ColiseumWindow.js — Coliseu (duelos, ranking global e relíquias) na
 * UI 3.0 (fase 5.2).
 *
 * Assume "coliseum-view" pelo Ui3Window/WindowManager. O estado de tela
 * (aba, categoria, peça marcada) fica aqui, fora do GameState.
 *   leitura   ColiseumSystem.getSnapshot/getLeaderboard/getWagerCandidates/
 *             config, ItemRankingSystem (categorias, ranking de relíquias)
 *   comandos  ColiseumSystem.findMatch, startMatch (fecha a janela e leva à
 *             Hunt, onde o combate aparece), createWager, cancelWager
 */
(function initUi3ColiseumWindow(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const WINDOW_ID = "coliseum-view";
    const NOTICE_MS = 4000;
    const RANKING_ROWS = 32;
    const TABS = Object.freeze([
        { id: "arena", label: "Arena" },
        { id: "ranking", label: "Ranking global" },
        { id: "relics", label: "Relíquias" }
    ]);
    const START_FAILURES = Object.freeze({
        "match-active": "Já existe um combate em andamento.",
        "opponent-not-found": "O adversário da fila não está mais disponível.",
        "battle-start-failed": "A arena não conseguiu preparar este adversário. Busque outro duelo."
    });

    const state = { tab: "arena", category: null, wagerItem: null, notice: null };
    const rendered = new WeakMap();
    let parts = {};
    let noticeTimer = null;

    function kit() {
        return Aethra.Ui3Kit;
    }

    function coliseum() {
        return Aethra.ColiseumSystem;
    }

    function patch(element, html) {
        if (!element || rendered.get(element) === html) return false;
        element.innerHTML = html;
        rendered.set(element, html);
        return true;
    }

    function rankLabel(rank) {
        return ["Ⅰ", "Ⅱ", "Ⅲ"][rank - 1] || `#${kit().formatNumber(rank)}`;
    }

    function signed(value) {
        const numeric = Number(value || 0);
        return `${numeric > 0 ? "+" : ""}${kit().formatNumber(numeric)}`;
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

    function profileHTML(snapshot) {
        const K = kit();
        const { profile, player } = snapshot;
        const total = profile.wins + profile.losses;
        const winRate = total ? Math.round((profile.wins / total) * 100) : 0;
        return `<section class="ui3-city-card ui3-coliseum__profile">
                <div class="ui3-stack">
                    <span class="ui3-eyebrow">${K.esc(snapshot.season?.name || "Temporada")} · ${profile.provisional ? `${K.formatNumber(profile.placementPlayed)}/5 colocações` : "Classificado"}</span>
                    <h2 class="ui3-service__title">${K.esc(player?.name || "Herói")} <span class="ui3-tag ui3-tag--gold">${K.esc(player?.rankTag || "")}</span></h2>
                    <span class="ui3-caption">${K.esc(profile.division?.name || "Ferro")} · Nível ${K.formatNumber(player?.level)} · poder completo, sem normalização</span>
                </div>
                <div class="ui3-kpi-grid ui3-coliseum__kpis">
                    ${K.kpi({ label: "Rating", value: K.formatNumber(profile.rating) })}
                    ${K.kpi({ label: "Poder", value: K.formatNumber(profile.combatPower) })}
                    ${K.kpi({ label: "V / D", value: `${K.formatNumber(profile.wins)} / ${K.formatNumber(profile.losses)} · ${winRate}%` })}
                    ${K.kpi({ label: "Sequência", value: `${K.formatNumber(profile.streak)} · recorde ${K.formatNumber(profile.bestStreak)}` })}
                </div>
            </section>`;
    }

    function fighterHTML({ eyebrow, name, detail }) {
        const K = kit();
        return `<div class="ui3-coliseum__fighter">
                <span class="ui3-glyph-box" aria-hidden="true">${K.esc(String(name || "?").charAt(0))}</span>
                <span class="ui3-list-row__text"><small>${K.esc(eyebrow)}</small><strong>${K.esc(name)}</strong><small>${K.esc(detail)}</small></span>
            </div>`;
    }

    function matchmakerHTML(snapshot) {
        const K = kit();
        const opponent = snapshot.queue?.opponent || null;
        const config = coliseum().config || {};
        const band = `±${K.formatNumber(config.initialRatingWindow)} RP · ${Math.round((config.initialPowerRatioMin || 0) * 100)}–${Math.round((config.initialPowerRatioMax || 0) * 100)}% de poder`;
        const body = opponent
            ? `<div class="ui3-coliseum__versus">
                    ${fighterHTML({ eyebrow: `Você · ${K.formatNumber(snapshot.profile.rating)} RP`, name: snapshot.player?.name, detail: `${K.formatNumber(snapshot.player?.combatPower)} de poder` })}
                    <strong class="ui3-coliseum__vs">VS<small>${snapshot.queue.mode === "ranked" ? "Ranqueada" : "Livre"}</small></strong>
                    ${fighterHTML({ eyebrow: opponent.isBot ? "Gladiador bot" : opponent.rankTag || "Oponente", name: opponent.name, detail: `${K.formatNumber(opponent.combatPower)} de poder · Nv ${K.formatNumber(opponent.level)}` })}
                </div>
                <div class="ui3-expedition__row">
                    ${K.button({ label: "Buscar outro", attributes: { "data-ui3-coliseum-search": snapshot.queue.mode } })}
                    ${K.button({ label: "Entrar na arena", variant: "primary", attributes: { "data-ui3-coliseum-fight": "" } })}
                </div>`
            : `<p>Seu herói entra com 100% do poder conquistado. A busca cruza rating e Poder de Combate e amplia aos poucos, sem alterar atributos.</p>
                <div class="ui3-expedition__row">
                    ${K.button({ label: "Coliseu livre", attributes: { "data-ui3-coliseum-search": "open" } })}
                    ${K.button({ label: "Buscar ranqueada", variant: "primary", attributes: { "data-ui3-coliseum-search": "ranked" } })}
                </div>`;
        return `<section class="ui3-city-card">
                <div class="ui3-row-between"><span class="ui3-eyebrow">Matchmaking global</span><span class="ui3-caption">Faixa inicial ${K.esc(band)}</span></div>
                <h3 class="ui3-service__title">${opponent ? "Adversário encontrado" : "Procure um duelo"}</h3>
                ${body}
            </section>`;
    }

    function wagerHTML(snapshot) {
        const K = kit();
        const escrow = snapshot.escrow?.status === "locked" ? snapshot.escrow : null;
        const enabled = snapshot.authority?.capabilities?.wagerEscrow === true;
        let body;
        if (escrow) {
            body = `<div class="ui3-row-between"><span>Sua aposta</span><strong>${K.esc(escrow.playerItem?.name)}</strong></div>
                <div class="ui3-row-between"><span>Aposta rival</span><strong>${K.esc(escrow.opponentItem?.name)}</strong></div>
                <p class="ui3-caption">Os dois itens saíram dos inventários e só serão entregues ao vencedor.</p>
                ${K.button({ label: "Cancelar antes do combate", disabled: Boolean(snapshot.activeMatch), attributes: { "data-ui3-coliseum-cancel-wager": "" } })}`;
        } else if (!enabled) {
            body = `<p>Apostas aguardam o servidor autoritativo: itens, resultado e custódia não podem depender do save local. Os duelos contra bots continuam como simulação.</p>`;
        } else {
            const items = coliseum().getWagerCandidates().slice(0, 8);
            const rows = items.map((item) => {
                const ranking = Aethra.ItemRankingSystem?.getItemRanking?.(item);
                return `<button type="button" class="ui3-list-row" data-ui3-coliseum-wager-item="${K.esc(item.instanceId)}" aria-pressed="${state.wagerItem === item.instanceId ? "true" : "false"}">
                        ${Aethra.Ui3Items.thumbHTML(item)}
                        <span class="ui3-list-row__text"><strong class="ui3-rarity-text--${Aethra.Ui3Items.rarityOf(item).id}">${K.esc(Aethra.Ui3Items.nameOf(item))}</strong><small>${K.esc(ranking?.rankLabel || "Não ranqueado")} · ${K.formatNumber(ranking?.score || 0)}</small></span>
                    </button>`;
            }).join("");
            body = `<p class="ui3-caption">Escolha uma peça negociável da mochila. O rival colocará um item de valor compatível.</p>
                <div class="ui3-list">${rows || `<p class="ui3-empty">Nenhum equipamento negociável na mochila.</p>`}</div>
                ${K.button({ label: "Travar aposta em custódia", variant: "primary", disabled: !snapshot.queue?.opponent || !state.wagerItem, attributes: { "data-ui3-coliseum-lock-wager": "" } })}`;
        }
        return `<section class="ui3-city-card">
                <div class="ui3-row-between"><span class="ui3-eyebrow">Aposta 1×1</span><span class="ui3-tag">${escrow ? "Travada" : enabled ? "Opcional" : "Indisponível"}</span></div>
                <h3 class="ui3-service__title">${escrow ? "Itens em custódia" : "Arrisque uma relíquia"}</h3>
                ${body}
            </section>`;
    }

    function gatekeepersHTML(snapshot) {
        const K = kit();
        const cards = (snapshot.gatekeepers || []).map((gate) => `<article class="ui3-recipe${gate.defeated ? " is-guided" : ""}">
                <header class="ui3-recipe__head">
                    <span class="ui3-glyph-box" aria-hidden="true">${K.esc(gate.badge)}</span>
                    <span class="ui3-list-row__text"><strong>${K.esc(gate.name)}</strong><small>${K.esc(gate.title)}</small></span>
                </header>
                <span class="ui3-caption">Nv ${K.formatNumber(gate.level)} · ${K.formatNumber(gate.power)} de poder · ${K.formatNumber(gate.rating)} RP${gate.defeated ? " · derrotado" : ""}</span>
                ${K.button({ label: gate.defeated ? "Enfrentar novamente" : "Desafiar guardião", variant: gate.defeated ? "secondary" : "primary", attributes: { "data-ui3-coliseum-gatekeeper": gate.id } })}
            </article>`).join("");
        return `<section class="ui3-section">
                <div class="ui3-row-between"><span class="ui3-eyebrow">Chefes da arena</span><span class="ui3-caption">A primeira vitória concede rating; repetições não rendem pontos.</span></div>
                <div class="ui3-recipe-grid">${cards}</div>
            </section>`;
    }

    function arenaHTML(snapshot) {
        return `<div class="ui3-coliseum__arena">${matchmakerHTML(snapshot)}${wagerHTML(snapshot)}</div>${gatekeepersHTML(snapshot)}`;
    }

    function tableHTML({ label, head, rows }) {
        const K = kit();
        return `<div class="ui3-rank-table" role="table" aria-label="${K.esc(label)}">
                <div class="ui3-rank-table__row ui3-rank-table__head" role="row">${head.map((cell) => `<span role="columnheader">${K.esc(cell)}</span>`).join("")}</div>
                ${rows.join("")}
            </div>`;
    }

    function rankingHTML(snapshot) {
        const K = kit();
        const leaderboard = coliseum().getLeaderboard(100);
        // O herói fora do top aparece fixo no fim, para nunca sumir da tabela.
        const visible = leaderboard.slice(0, RANKING_ROWS);
        const player = leaderboard.find((entry) => entry.isPlayer);
        if (player && !visible.includes(player)) visible.push(player);
        const rows = visible.map((entry) => `<div class="ui3-rank-table__row${entry.isPlayer ? " is-player" : ""}" role="row">
                <span role="cell" class="ui3-rank-table__rank">${rankLabel(entry.globalRank)}</span>
                <span role="cell" class="ui3-list-row__text"><strong>${K.esc(entry.name)}</strong><small>${entry.isBot ? "Chefe · " : ""}${K.esc(entry.division?.name || "Ferro")} · Nv ${K.formatNumber(entry.level)}</small></span>
                <span role="cell">${K.formatNumber(entry.rating)}</span>
                <span role="cell">${K.formatNumber(entry.combatPower)}</span>
                <span role="cell">${K.formatNumber(entry.wins)}–${K.formatNumber(entry.losses)}</span>
            </div>`);
        const history = (snapshot.history || []).slice(0, 8).map((entry) => `<div class="ui3-row-between">
                <span><strong class="${entry.result === "win" ? "ui3-text-ok" : "ui3-text-warn"}">${entry.result === "win" ? "V" : "D"}</strong> ${K.esc(entry.opponentName)}</span>
                <strong>${K.esc(signed(entry.ratingDelta))} RP</strong>
            </div>`).join("");
        return `<div class="ui3-coliseum__ranking">
                <section class="ui3-section">
                    <div class="ui3-row-between"><span class="ui3-eyebrow">Classificação do servidor</span><span class="ui3-caption">${K.formatNumber(leaderboard.length)} competidores</span></div>
                    ${tableHTML({ label: "Ranking global", head: ["#", "Gladiador", "Rating", "Poder", "V–D"], rows })}
                </section>
                <aside class="ui3-city-card">
                    <span class="ui3-eyebrow">Últimos duelos</span>
                    ${history || `<p class="ui3-empty">Sua história na arena começa no primeiro duelo.</p>`}
                    <div class="ui3-row-between"><span>Melhor posição</span><strong>#${K.formatNumber(snapshot.profile.bestGlobalRank)}</strong></div>
                    <div class="ui3-row-between"><span>Melhor rating</span><strong>${K.formatNumber(snapshot.profile.bestRating)}</strong></div>
                </aside>
            </div>`;
    }

    function relicsHTML() {
        const K = kit();
        const ranking = Aethra.ItemRankingSystem;
        const categories = ranking?.getCategories?.() || [];
        if (!categories.some((entry) => entry.id === state.category)) state.category = categories[0]?.id || null;
        const entries = state.category ? ranking?.getLeaderboard?.(state.category, 50) || [] : [];
        const heroId = Aethra.GameState?.hero?.id;
        const rows = entries.map((entry) => {
            const movement = Number(entry.movement || 0);
            return `<div class="ui3-rank-table__row${entry.ownerId === heroId || entry.ownerId === "local-player" ? " is-player" : ""}" role="row">
                <span role="cell" class="ui3-rank-table__rank">${rankLabel(entry.rank)}</span>
                <span role="cell" class="ui3-list-row__text"><strong class="ui3-rarity-text--${K.normalizeRarity(entry.rarityId)}">${K.esc(entry.name)}</strong><small>${K.esc(entry.rarity)} · melhor posição #${K.formatNumber(entry.bestRank)}</small></span>
                <span role="cell">${K.esc(entry.ownerName)}</span>
                <span role="cell">${K.formatNumber(entry.score)}</span>
                <span role="cell" class="${movement > 0 ? "ui3-text-ok" : movement < 0 ? "ui3-text-warn" : ""}">${movement > 0 ? `▲ ${movement}` : movement < 0 ? `▼ ${Math.abs(movement)}` : "—"}</span>
            </div>`;
        });
        const chips = categories.map((category) => K.chip({
            label: `${category.name} ${K.formatNumber(category.total)}`,
            pressed: category.id === state.category,
            attributes: { "data-ui3-coliseum-category": category.id }
        })).join("");
        return `<p class="ui3-caption">O ranking muda quando uma peça nasce, é aprimorada, encantada ou destruída. O poder soma atributos finais, nível exigido, raridade, qualidade, potencial, afixos, aprimoramentos e vínculo.</p>
            <div class="ui3-bag__chips" role="group" aria-label="Categorias de relíquia">${chips}</div>
            ${rows.length ? tableHTML({ label: "Ranking de relíquias", head: ["Posição", "Relíquia", "Dono", "Poder", "Movimento"], rows }) : `<p class="ui3-empty">Nenhuma relíquia nesta categoria.</p>`}`;
    }

    function render() {
        const K = kit();
        if (!coliseum()?.getSnapshot) return;
        const snapshot = coliseum().getSnapshot();
        const notice = state.notice
            ? `<p class="ui3-notice ui3-notice--${K.esc(state.notice.tone)}" role="status">${K.esc(state.notice.text)}</p>`
            : "";
        const content = state.tab === "ranking" ? rankingHTML(snapshot) : state.tab === "relics" ? relicsHTML() : arenaHTML(snapshot);
        patch(parts.body, `${profileHTML(snapshot)}
            ${K.tabs({ label: "Seções do Coliseu", items: TABS, selected: state.tab })}
            ${notice}
            ${content}`);
    }

    function startMatch(opponent, options) {
        const result = opponent ? coliseum().startMatch(opponent, options) : coliseum().startMatch();
        if (!result?.success) {
            notify(START_FAILURES[result?.reason] || "O combate não pôde ser iniciado.", "error");
            render();
        }
        return result?.success === true;
    }

    function onClick(event) {
        const target = event.target;
        const tab = target.closest("[data-ui3-tab]");
        if (tab) {
            state.tab = tab.dataset.ui3Tab;
            return render();
        }
        const category = target.closest("[data-ui3-coliseum-category]");
        if (category) {
            state.category = category.dataset.ui3ColiseumCategory;
            return render();
        }
        const search = target.closest("[data-ui3-coliseum-search]");
        if (search) {
            const queue = coliseum().findMatch({ mode: search.dataset.ui3ColiseumSearch === "open" ? "open" : "ranked" });
            if (!queue) notify("Nenhum oponente disponível nesta faixa.", "error");
            return render();
        }
        if (target.closest("[data-ui3-coliseum-fight]")) return startMatch(null);
        const gate = target.closest("[data-ui3-coliseum-gatekeeper]");
        if (gate) {
            const gatekeeper = coliseum().getSnapshot().gatekeepers.find((entry) => entry.id === gate.dataset.ui3ColiseumGatekeeper);
            return gatekeeper ? startMatch(gatekeeper, { mode: "ranked" }) : false;
        }
        const wagerItem = target.closest("[data-ui3-coliseum-wager-item]");
        if (wagerItem) {
            state.wagerItem = wagerItem.dataset.ui3ColiseumWagerItem;
            return render();
        }
        if (target.closest("[data-ui3-coliseum-lock-wager]")) {
            const result = coliseum().createWager(state.wagerItem);
            if (result?.success) notify("Itens verificados e travados em custódia até o resultado do duelo.");
            else notify(result?.reason === "SERVER_AUTHORITY_REQUIRED"
                ? "Apostas só serão liberadas com custódia autoritativa no servidor."
                : "A aposta foi recusada: verifique se a peça está livre e negociável.", "error");
            return render();
        }
        if (target.closest("[data-ui3-coliseum-cancel-wager]")) {
            if (coliseum().cancelWager()) notify("Aposta cancelada e sua peça voltou à mochila.");
            else notify("A custódia não pode ser cancelada durante um combate.", "error");
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

    function onOpen() {
        state.notice = null;
        if (parts.body) parts.body.scrollTop = 0;
    }

    if (Aethra.Ui3Window?.define) {
        Aethra.Ui3ColiseumWindow = Aethra.Ui3Window.define({
            id: WINDOW_ID,
            title: "Coliseu",
            className: "ui3-dialog--wide",
            setup,
            render,
            onOpen,
            getSubtitle: () => "Duelos, ranking global e relíquias",
            events: [
                "coliseum:rank-updated", "coliseum:match-found", "coliseum:match-not-found", "coliseum:match-started",
                "coliseum:match-resolved", "coliseum:wager-locked", "coliseum:wager-cancelled", "coliseum:wager-settled",
                "item-ranking:updated"
            ]
        });
    }
})(window.Aethra = window.Aethra || {});
