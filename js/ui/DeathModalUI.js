// DeathModalUI.js — Ecrã de Derrota / A Morte Deixa Marcas
(function initDeathModalUI(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) return;

    const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const fmt = (v) => new Intl.NumberFormat("pt-BR").format(Math.floor(Number(v) || 0));

    function showDeathScreen(payload = {}) {
        // Remove existing if any
        document.querySelector(".death-overlay")?.remove();

        const xpLost = payload.xpLost || 0;
        const goldLost = payload.goldLost ?? payload.penalty ?? 0;
        const killerName = payload.killerName || payload.enemyName || "Criatura das Sombras";
        const message = payload.message || "Sua energia vital esgotou durante o combate.";
        const xpPercent = Math.max(0, Number(payload.xpPercent ?? 10));
        const goldPercent = Math.max(0, Number(payload.goldPercent ?? 10));
        const bag = Array.isArray(Aethra.GameState?.hero?.bag) ? Aethra.GameState.hero.bag : [];
        const supplyCount = bag.reduce((total, item) => {
            const type = String(item?.itemType || item?.type || "").toLowerCase();
            return total + (type === "consumable" ? Number(item.quantity || 1) : 0);
        }, 0);
        const equipment = Aethra.GameState?.playerEquipment || Aethra.GameState?.hero?.equipment || {};
        const equippedCount = Object.values(equipment).filter(Boolean).length;

        const overlay = document.createElement("div");
        overlay.className = "death-overlay";
        overlay.innerHTML = `
            <div class="death-box" role="dialog" aria-modal="true" aria-label="Ecrã de derrota">
                <div class="death-icon">☠</div>
                <h2 class="death-title">A MORTE DEIXA MARCAS</h2>
                <div class="death-subtitle">Derrotado por ${esc(killerName)}</div>

                <div class="death-penalties">
                    <div class="death-penalty-card">
                        <small>Perda de XP (−${fmt(xpPercent)}%)</small>
                        <strong>−${fmt(xpLost)} XP</strong>
                    </div>
                    <div class="death-penalty-card">
                        <small>Perda de Ouro (−${fmt(goldPercent)}%)</small>
                        <strong>−${fmt(goldLost)} G</strong>
                    </div>
                </div>

                <p class="death-recap-msg">${esc(message)}</p>

                <div class="death-counterplay">
                    <small>ANTES DA PRÓXIMA TENTATIVA</small>
                    <div>
                        <span><b>${fmt(equippedCount)}/11</b> slots equipados</span>
                        <span><b>${fmt(supplyCount)}</b> supplies na mochila</span>
                        <span><b>Skills</b> revise Auto e limites de HP</span>
                    </div>
                </div>

                <button type="button" class="death-resurrect-btn" id="death-resurrect-action">
                    Ressuscitar na Cidade
                </button>
            </div>
        `;

        overlay.querySelector("#death-resurrect-action")?.addEventListener("click", () => {
            overlay.remove();
            // Restore hero vitals if needed
            const hero = Aethra.GameState?.hero;
            if (hero) {
                const stats = hero.stats || {};
                hero.hp = hero.maxHp || stats.maxHp || hero.hp || 50;
                hero.mana = hero.maxMana || stats.maxMana || hero.mana || 30;
                hero.energy = hero.maxEnergy || stats.maxEnergy || hero.energy || 80;
            }
            Aethra.UIManager?.setPrimaryView?.("city", { source: "death-resurrect" });
            Aethra.RenderEngine?.renderAll?.();
        });

        document.body.appendChild(overlay);
        window.setTimeout(() => overlay.querySelector("#death-resurrect-action")?.focus(), 0);
    }

    // Listen to death events
    Aethra.EventBus.on("battle:player-defeated", showDeathScreen);
    Aethra.EventBus.on("HeroDefeated", showDeathScreen);

    Aethra.DeathModalUI = { show: showDeathScreen };
})(window.Aethra = window.Aethra || {});
