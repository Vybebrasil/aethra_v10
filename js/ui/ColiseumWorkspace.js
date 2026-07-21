// ColiseumWorkspace.js - interface do ranking global, duelos e relíquias.
(function (Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const esc = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    const fmt = (value) => new Intl.NumberFormat("pt-BR").format(Number(value || 0));
    const signed = (value) => `${Number(value || 0) > 0 ? "+" : ""}${fmt(value)}`;

    function uiState() {
        Aethra.GameState.ui = Aethra.GameState.ui || {};
        Aethra.GameState.ui.coliseum = Aethra.GameState.ui.coliseum || {
            tab: "arena",
            itemCategory: "sword",
            selectedWagerItem: null,
            notice: null
        };
        return Aethra.GameState.ui.coliseum;
    }

    function rarityColor(rarity) {
        return Aethra.GameData?.getRarityPresentation?.(rarity)?.color || "#7f95a0";
    }

    function rankMedal(rank) {
        if (rank === 1) return "Ⅰ";
        if (rank === 2) return "Ⅱ";
        if (rank === 3) return "Ⅲ";
        return `#${rank}`;
    }

    function profileHeader(snapshot) {
        const profile = snapshot.profile;
        const player = snapshot.player;
        const total = profile.wins + profile.losses;
        const winRate = total ? Math.round((profile.wins / total) * 100) : 0;
        return `
            <section class="coliseum-profile" style="--division-color:${esc(profile.division?.color || "#e6c55d")}">
                <div class="coliseum-profile__crest"><span>${player.globalRank <= 3 ? rankMedal(player.globalRank) : "⚜"}</span><i></i></div>
                <div class="coliseum-profile__identity">
                    <small>${esc(snapshot.season.name)} · ${profile.provisional ? `${profile.placementPlayed}/5 colocações` : "CLASSIFICADO"}</small>
                    <h3>${esc(player.name)} <em>${esc(player.rankTag)}</em></h3>
                    <p>${esc(profile.division?.name || "Ferro")} · Nível ${fmt(player.level)} · poder completo, sem normalização</p>
                </div>
                <div class="coliseum-profile__metrics">
                    <span><small>RATING</small><strong>${fmt(profile.rating)}</strong></span>
                    <span><small>PODER</small><strong>${fmt(profile.combatPower)}</strong></span>
                    <span><small>V / D</small><strong>${fmt(profile.wins)} / ${fmt(profile.losses)}</strong><em>${winRate}% WR</em></span>
                    <span><small>SEQUÊNCIA</small><strong>${fmt(profile.streak)}</strong><em>recorde ${fmt(profile.bestStreak)}</em></span>
                </div>
            </section>`;
    }

    function arenaView(snapshot) {
        const queue = snapshot.queue;
        const opponent = queue?.opponent || null;
        const escrow = snapshot.escrow?.status === "locked" ? snapshot.escrow : null;
        const wagersEnabled = snapshot.authority?.capabilities?.wagerEscrow === true;
        const bagItems = (Aethra.GameState.hero?.bag || []).filter((item) => item?.slot && !item.stackable && item.ownership?.bound !== true);
        return `
            <div class="coliseum-arena-grid">
                <section class="coliseum-matchmaker">
                    <header><div><small>MATCHMAKING GLOBAL</small><h3>${opponent ? "Adversário encontrado" : "Procure um duelo"}</h3></div><span class="coliseum-live"><i></i> AO VIVO</span></header>
                    ${opponent ? `
                        <article class="coliseum-versus">
                            <div class="coliseum-fighter is-player"><span>${esc((snapshot.player.name || "A").charAt(0))}</span><small>VOCÊ · ${fmt(snapshot.profile.rating)} RP</small><strong>${esc(snapshot.player.name)}</strong><em>${fmt(snapshot.player.combatPower)} poder</em></div>
                            <b>VS<small>${queue.mode === "ranked" ? "RANQUEADA" : "LIVRE"}</small></b>
                            <div class="coliseum-fighter"><span>${esc((opponent.badge || opponent.name || "G").charAt(0))}</span><small>${opponent.isBot ? "GLADIADOR BOT" : esc(opponent.rankTag || "OPONENTE")}</small><strong>${esc(opponent.name)}</strong><em>${fmt(opponent.combatPower)} poder · Nv. ${fmt(opponent.level)}</em></div>
                        </article>
                        <div class="coliseum-matchmaker__actions">
                            <button type="button" class="is-ghost" data-coliseum-action="search">Buscar outro</button>
                            <button type="button" class="is-primary" data-coliseum-action="fight">Entrar na arena</button>
                        </div>` : `
                        <div class="coliseum-search-empty"><span>⚔</span><strong>Seu personagem entra com 100% do poder conquistado</strong><p>O sistema cruza rating e Poder de Combate. A busca amplia aos poucos, mas nunca altera seus atributos.</p></div>
                        <div class="coliseum-matchmaker__actions">
                            <button type="button" class="is-ghost" data-coliseum-action="search-open">Coliseu livre</button>
                            <button type="button" class="is-primary" data-coliseum-action="search">Buscar ranqueada</button>
                        </div>`}
                    <footer><span>Faixa inicial</span><strong>±140 RP · 82–122% de poder</strong><small>A faixa aumenta somente se a fila demorar.</small></footer>
                </section>

                <aside class="coliseum-wager ${escrow ? "is-locked" : ""} ${wagersEnabled ? "" : "is-authority-locked"}">
                    <header><div><small>APOSTA 1×1</small><h3>${escrow ? "Itens em custódia" : "Arrisque uma relíquia"}</h3></div><span>${escrow ? "TRAVADA" : "OPCIONAL"}</span></header>
                    ${!wagersEnabled ? `
                        <div class="coliseum-search-empty"><span>◇</span><strong>Apostas aguardam o servidor autoritativo</strong><p>Itens, resultado e custódia não podem depender do save local. O Coliseu contra bots continua disponível como simulação.</p></div>
                        <button type="button" disabled>Custódia indisponível no protótipo local</button>` : escrow ? `
                        <div class="coliseum-escrow">
                            <article><small>SUA APOSTA</small><strong>${esc(escrow.playerItem.name)}</strong><em>${esc(Aethra.ItemRankingSystem?.getItemRanking?.(escrow.playerItem)?.rankLabel || "Não ranqueado")}</em></article>
                            <b>↔</b>
                            <article><small>APOSTA RIVAL</small><strong>${esc(escrow.opponentItem.name)}</strong><em>${esc(Aethra.ItemRankingSystem?.getItemRanking?.(escrow.opponentItem)?.rankLabel || "Não ranqueado")}</em></article>
                        </div>
                        <p>Os dois itens saíram dos inventários e só serão entregues ao vencedor.</p>
                        <button type="button" data-coliseum-action="cancel-wager" ${snapshot.activeMatch ? "disabled" : ""}>Cancelar antes do combate</button>` : `
                        <p>Escolha uma peça negociável da mochila. O rival colocará um item de valor compatível.</p>
                        <div class="coliseum-wager-items">
                            ${bagItems.length ? bagItems.slice(0, 8).map((item) => {
                                const ranking = Aethra.ItemRankingSystem?.getItemRanking?.(item);
                                const selected = uiState().selectedWagerItem === item.instanceId;
                                return `<button type="button" class="${selected ? "is-selected" : ""}" data-coliseum-wager-item="${esc(item.instanceId)}" style="--rarity:${esc(rarityColor(item))}"><span>${esc(item.icon || "◆")}</span><strong>${esc(item.name)}</strong><small>${esc(ranking?.rankLabel || "Não ranqueado")} · ${fmt(ranking?.score || 0)}</small></button>`;
                            }).join("") : `<div class="coliseum-wager-empty">Nenhum equipamento negociável na mochila.</div>`}
                        </div>
                        <button type="button" data-coliseum-action="lock-wager" ${!opponent || !uiState().selectedWagerItem ? "disabled" : ""}>Travar aposta em custódia</button>`}
                </aside>
            </div>

            <section class="coliseum-gatekeepers">
                <header><div><small>CHEFES DA ARENA</small><h3>Gladiadores que guardam as divisões</h3></div><p>A primeira vitória concede rating. Repetições não podem ser usadas para farmar pontos.</p></header>
                <div>${snapshot.gatekeepers.map((gate) => `
                    <article class="${gate.defeated ? "is-defeated" : ""}" style="--gate-color:${esc(gate.division?.color || "#e6c55d")}">
                        <span>${esc(gate.badge)}</span><small>${esc(gate.title)}</small><strong>${esc(gate.name)}</strong>
                        <p>Nv. ${fmt(gate.level)} · ${fmt(gate.power)} poder · ${fmt(gate.rating)} RP</p>
                        <button type="button" data-coliseum-gatekeeper="${esc(gate.id)}">${gate.defeated ? "Enfrentar novamente" : "Desafiar guardião"}</button>
                    </article>`).join("")}</div>
            </section>`;
    }

    function leaderboardView(snapshot) {
        const leaderboard = Aethra.ColiseumSystem.getLeaderboard(100);
        const recent = snapshot.history.slice(0, 8);
        return `
            <div class="coliseum-rank-layout">
                <section class="coliseum-leaderboard">
                    <header><div><small>CLASSIFICAÇÃO DO SERVIDOR</small><h3>Ranking global</h3></div><span>${fmt(leaderboard.length)} competidores</span></header>
                    <div class="coliseum-table">
                        <div class="coliseum-table__head"><span>#</span><span>Gladiador</span><span>Rating</span><span>Poder</span><span>V–D</span></div>
                        ${leaderboard.slice(0, 32).map((entry) => `
                            <article class="${entry.isPlayer ? "is-player" : ""} ${entry.isBot ? "is-bot" : ""}">
                                <b>${rankMedal(entry.globalRank)}</b>
                                <span><strong>${esc(entry.name)}</strong><small>${entry.isBot ? "BOSS · " : ""}${esc(entry.division?.name || "Ferro")} · Nv. ${fmt(entry.level)}</small></span>
                                <em>${fmt(entry.rating)}</em><em>${fmt(entry.combatPower)}</em><em>${fmt(entry.wins)}–${fmt(entry.losses)}</em>
                            </article>`).join("")}
                    </div>
                </section>
                <aside class="coliseum-history">
                    <header><small>SEU HISTÓRICO</small><h3>Últimos duelos</h3></header>
                    ${recent.length ? recent.map((entry) => `
                        <article class="is-${entry.result}"><span>${entry.result === "win" ? "V" : "D"}</span><div><strong>${esc(entry.opponentName)}</strong><small>${fmt(entry.playerPower)} vs ${fmt(entry.opponentPower)} poder</small></div><em>${signed(entry.ratingDelta)} RP</em></article>`).join("") : `<div class="coliseum-history__empty">Sua história na arena começa no primeiro duelo.</div>`}
                    <footer><span><small>Melhor posição</small><strong>#${fmt(snapshot.profile.bestGlobalRank)}</strong></span><span><small>Melhor rating</small><strong>${fmt(snapshot.profile.bestRating)}</strong></span></footer>
                </aside>
            </div>`;
    }

    function relicsView() {
        const state = uiState();
        const categories = Aethra.ItemRankingSystem?.getCategories?.() || [];
        if (!categories.some((entry) => entry.id === state.itemCategory)) state.itemCategory = categories[0]?.id || "sword";
        const entries = Aethra.ItemRankingSystem?.getLeaderboard?.(state.itemCategory, 50) || [];
        return `
            <section class="relic-ranking">
                <header><div><small>ÍNDICE VIVO DE RELÍQUIAS</small><h3>Os itens mais poderosos do servidor</h3><p>O ranking muda quando uma peça nasce, é aprimorada, encantada ou destruída.</p></div><span><i></i> ATUALIZAÇÃO AO VIVO</span></header>
                <nav>${categories.map((category) => `<button type="button" class="${category.id === state.itemCategory ? "is-active" : ""}" data-relic-category="${esc(category.id)}">${esc(category.name)} <b>${fmt(category.total)}</b></button>`).join("")}</nav>
                <div class="relic-ranking__table">
                    <div class="relic-ranking__head"><span>Posição</span><span>Relíquia</span><span>Dono atual</span><span>Poder</span><span>Movimento</span></div>
                    ${entries.map((entry) => `
                        <article class="${entry.ownerId === Aethra.GameState.hero?.id || entry.ownerId === "local-player" ? "is-owned" : ""}" style="--rarity:${esc(rarityColor(entry.rarityId))}">
                            <b>${rankMedal(entry.rank)}</b>
                            <span><strong>${esc(entry.name)}</strong><small>${esc(entry.rarity)} · melhor posição #${fmt(entry.bestRank)}</small></span>
                            <em>${esc(entry.ownerName)}</em>
                            <em>${fmt(entry.score)}</em>
                            <i class="${entry.movement > 0 ? "is-up" : entry.movement < 0 ? "is-down" : ""}">${entry.movement > 0 ? `▲ ${entry.movement}` : entry.movement < 0 ? `▼ ${Math.abs(entry.movement)}` : "—"}</i>
                        </article>`).join("")}
                </div>
                <footer><strong>Como o poder é calculado?</strong><p>Atributos finais, nível exigido, raridade, qualidade, potencial, afixos, upgrades e vínculo da peça. Empates preservam a relíquia criada primeiro.</p></footer>
            </section>`;
    }

    function render() {
        const root = document.getElementById("coliseum-workspace");
        if (!root || !Aethra.ColiseumSystem || !Aethra.ItemRankingSystem) return false;
        const state = uiState();
        const snapshot = Aethra.ColiseumSystem.getSnapshot();
        root.innerHTML = `
            ${profileHeader(snapshot)}
            ${state.notice ? `<div class="coliseum-notice is-${esc(state.notice.tone || "info")}"><span>${state.notice.tone === "error" ? "!" : "✓"}</span><p>${esc(state.notice.text)}</p><button type="button" data-coliseum-action="dismiss">×</button></div>` : ""}
            <nav class="coliseum-tabs" aria-label="Seções do Coliseu">
                <button type="button" class="${state.tab === "arena" ? "is-active" : ""}" data-coliseum-tab="arena"><span>⚔</span><strong>Arena</strong><small>Buscar combate</small></button>
                <button type="button" class="${state.tab === "ranking" ? "is-active" : ""}" data-coliseum-tab="ranking"><span>Ⅰ</span><strong>Ranking global</strong><small>Top do servidor</small></button>
                <button type="button" class="${state.tab === "relics" ? "is-active" : ""}" data-coliseum-tab="relics"><span>◆</span><strong>Relíquias</strong><small>Ranking de itens</small></button>
            </nav>
            <div class="coliseum-view-body">${state.tab === "ranking" ? leaderboardView(snapshot) : state.tab === "relics" ? relicsView() : arenaView(snapshot)}</div>`;
        bind(root);
        Aethra.TooltipManager?.refresh?.();
        return true;
    }

    function notice(text, tone = "info") {
        uiState().notice = { text, tone };
        render();
    }

    function bind(root) {
        root.querySelectorAll("[data-coliseum-tab]").forEach((button) => {
            button.addEventListener("click", () => {
                uiState().tab = button.dataset.coliseumTab;
                uiState().notice = null;
                render();
            });
        });
        root.querySelectorAll("[data-relic-category]").forEach((button) => {
            button.addEventListener("click", () => {
                uiState().itemCategory = button.dataset.relicCategory;
                render();
            });
        });
        root.querySelectorAll("[data-coliseum-wager-item]").forEach((button) => {
            button.addEventListener("click", () => {
                uiState().selectedWagerItem = button.dataset.coliseumWagerItem;
                render();
            });
        });
        root.querySelectorAll("[data-coliseum-gatekeeper]").forEach((button) => {
            button.addEventListener("click", () => {
                const gate = Aethra.ColiseumSystem.getSnapshot().gatekeepers.find((entry) => entry.id === button.dataset.coliseumGatekeeper);
                const result = Aethra.ColiseumSystem.startMatch(gate, { mode: "ranked" });
                if (!result.success) notice("Não foi possível iniciar esse desafio agora.", "error");
            });
        });
        root.querySelectorAll("[data-coliseum-action]").forEach((button) => {
            button.addEventListener("click", () => {
                const action = button.dataset.coliseumAction;
                if (action === "dismiss") { uiState().notice = null; render(); return; }
                if (action === "search" || action === "search-open") {
                    const queue = Aethra.ColiseumSystem.findMatch({ mode: action === "search-open" ? "open" : "ranked" });
                    if (!queue) notice("Nenhum oponente disponível nesta faixa.", "error");
                    else { uiState().notice = null; render(); }
                    return;
                }
                if (action === "fight") {
                    const result = Aethra.ColiseumSystem.startMatch();
                    if (!result.success) {
                        const reasons = {
                            "match-active": "Já existe um combate em andamento.",
                            "opponent-not-found": "O adversário da fila não está mais disponível.",
                            "battle-start-failed": "A arena não conseguiu preparar este adversário. Busque outro duelo."
                        };
                        notice(reasons[result.reason] || "O combate não pôde ser iniciado.", "error");
                    } else {
                        uiState().notice = null;
                    }
                    return;
                }
                if (action === "lock-wager") {
                    const result = Aethra.ColiseumSystem.createWager(uiState().selectedWagerItem, null, Aethra.ColiseumSystem.getSnapshot().queue?.opponent);
                    if (!result.success) {
                        const message = result.reason === "SERVER_AUTHORITY_REQUIRED"
                            ? "Apostas só serão liberadas com custódia autoritativa no servidor."
                            : "A aposta foi recusada: verifique se a peça está livre e negociável.";
                        notice(message, "error");
                    }
                    else notice("Itens verificados e travados em custódia até o resultado do duelo.", "success");
                    return;
                }
                if (action === "cancel-wager") {
                    if (Aethra.ColiseumSystem.cancelWager()) notice("Aposta cancelada e sua peça voltou à mochila.", "success");
                    else notice("A custódia não pode ser cancelada durante um combate.", "error");
                }
            });
        });
    }

    Aethra.ColiseumWorkspace = { render };

    Aethra.EventBus.on("window:opened", ({ id } = {}) => {
        if (id === "coliseum-view") {
            uiState().notice = null;
            render();
            const root = document.getElementById("coliseum-workspace");
            if (root) root.scrollTop = 0;
        }
    });
    [
        "coliseum:rank-updated", "coliseum:match-found", "coliseum:match-resolved",
        "coliseum:wager-locked", "coliseum:wager-cancelled", "coliseum:wager-settled",
        "item-ranking:updated"
    ].forEach((eventName) => {
        Aethra.EventBus.on(eventName, () => {
            const windowRoot = document.getElementById("coliseum-view");
            if (windowRoot && windowRoot.getAttribute("aria-hidden") === "false") render();
        });
    });
    Aethra.EventBus.on("EngineReady", render);
})(window.Aethra = window.Aethra || {});
