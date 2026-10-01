// SharedSaveStatus.js — estado e escolha segura do save canônico de desenvolvimento.
(function initSharedSaveStatus(Aethra) {
    "use strict";

    if (!Aethra?.EventBus || !Aethra?.SaveManager) return;
    if (Aethra.SharedSaveStatus) return;

    let indicator = null;
    let banner = null;
    let dismissedEmptyPrompt = false;
    let transientTimer = null;

    // Com a UI 3.0 ligada quem mostra o save compartilhado é o Ui3SaveStatus.
    function ui3Active() {
        return Boolean(Aethra.Ui3Shell?.isActive?.());
    }

    function ensureIndicator() {
        if (ui3Active()) return null;
        if (indicator && document.body.contains(indicator)) return indicator;
        const host = document.querySelector(".wallet") || document.querySelector(".topbar");
        if (!host) return null;

        indicator = document.createElement("button");
        indicator.type = "button";
        indicator.className = "shared-save-indicator is-local";
        indicator.setAttribute("data-shared-save-indicator", "");
        indicator.innerHTML = `
            <span aria-hidden="true">●</span>
            <span>
                <small>SAVE</small>
                <b data-shared-save-label>LOCAL</b>
            </span>
        `;
        indicator.addEventListener("click", async () => {
            const status = Aethra.SaveManager.getSharedStatus?.() || {};
            if (status.supported && !status.exists) {
                dismissedEmptyPrompt = false;
                showEmptyPrompt(status);
                return;
            }
            if (status.supported && status.exists) {
                showMessage("Sincronizando save", "Buscando a versão canônica mais recente…");
                await Aethra.SaveManager.pullShared?.({ reason: "indicator" });
            }
        });
        host.prepend(indicator);
        return indicator;
    }

    function ensureBanner() {
        if (banner && document.body.contains(banner)) return banner;
        banner = document.createElement("aside");
        banner.id = "aethra-shared-save-banner";
        banner.hidden = true;
        banner.setAttribute("role", "status");
        banner.setAttribute("aria-live", "polite");
        banner.innerHTML = `
            <span class="shared-save-banner__icon" aria-hidden="true">⇄</span>
            <div>
                <strong data-shared-save-title>Save compartilhado</strong>
                <small data-shared-save-detail></small>
            </div>
            <button type="button" class="is-primary" data-shared-save-publish hidden>
                Usar este progresso
            </button>
            <button type="button" class="is-dismiss" data-shared-save-dismiss aria-label="Fechar aviso">×</button>
        `;

        banner.querySelector("[data-shared-save-publish]")?.addEventListener("click", async (event) => {
            const button = event.currentTarget;
            button.disabled = true;
            button.textContent = "Publicando…";
            const published = await Aethra.SaveManager.publishShared?.("select-canonical-save");
            button.disabled = false;
            button.textContent = "Usar este progresso";
            if (published) {
                banner.hidden = true;
                dismissedEmptyPrompt = true;
            }
        });

        banner.querySelector("[data-shared-save-dismiss]")?.addEventListener("click", () => {
            dismissedEmptyPrompt = true;
            banner.hidden = true;
        });

        document.body.appendChild(banner);
        return banner;
    }

    function updateIndicator(status = {}) {
        const element = ensureIndicator();
        if (!element) return;
        const label = element.querySelector("[data-shared-save-label]");
        element.classList.toggle("is-synced", status.supported && status.exists);
        element.classList.toggle("is-pending", status.supported && !status.exists);
        element.classList.toggle("is-local", !status.supported);
        element.classList.toggle("is-syncing", status.syncing === true);

        if (label) {
            label.textContent = status.syncing
                ? "SINCRONIZANDO"
                : status.supported && status.exists
                    ? "COMPARTILHADO"
                    : status.supported
                        ? "ESCOLHER"
                        : "LOCAL";
        }

        element.title = status.supported
            ? status.exists
                ? `Perfil ${status.profile || "principal"} · revisão ${status.revision || 0}. Clique para atualizar.`
                : "Escolha qual progresso local será o save compartilhado."
            : "O servidor compartilhado não está ativo; este navegador usa seu save local.";
    }

    function setBannerContent(title, detail, options = {}) {
        if (ui3Active()) return null;
        const element = ensureBanner();
        const titleNode = element.querySelector("[data-shared-save-title]");
        const detailNode = element.querySelector("[data-shared-save-detail]");
        const publishButton = element.querySelector("[data-shared-save-publish]");
        if (titleNode) titleNode.textContent = title;
        if (detailNode) detailNode.textContent = detail;
        if (publishButton) publishButton.hidden = options.publish !== true;
        element.classList.toggle("is-warning", options.warning === true);
        element.hidden = false;
        return element;
    }

    function showEmptyPrompt(status = {}) {
        if (dismissedEmptyPrompt || ui3Active()) return;
        window.clearTimeout(transientTimer);
        setBannerContent(
            "Escolha o personagem principal",
            `Este é o perfil ${status.profile || "principal"}. No navegador que contém o personagem que deseja manter, clique em “Usar este progresso”.`,
            { publish: true, warning: true }
        );
    }

    function showMessage(title, detail, options = {}) {
        window.clearTimeout(transientTimer);
        const element = setBannerContent(title, detail, options);
        if (!element) return;
        transientTimer = window.setTimeout(() => {
            if (element && !element.querySelector("[data-shared-save-publish]:not([hidden])")) {
                element.hidden = true;
            }
        }, options.duration || 3600);
    }

    function renderCurrentStatus() {
        const status = Aethra.SaveManager.getSharedStatus?.() || {};
        updateIndicator(status);
        if (status.supported && status.ready && !status.exists) {
            showEmptyPrompt(status);
        }
    }

    Aethra.EventBus.on("save:shared-status", updateIndicator);
    Aethra.EventBus.on("save:shared-empty", showEmptyPrompt);
    Aethra.EventBus.on("save:shared-loaded", (status) => {
        dismissedEmptyPrompt = true;
        if (banner) banner.hidden = true;
        updateIndicator(status);
    });
    Aethra.EventBus.on("save:shared-completed", (status) => {
        dismissedEmptyPrompt = true;
        if (banner) banner.hidden = true;
        updateIndicator(status);
        showMessage(
            "Save compartilhado atualizado",
            `Perfil ${status.profile || "principal"} · revisão ${status.revision || 0}.`
        );
    });
    Aethra.EventBus.on("save:shared-conflict", (status) => {
        showMessage(
            "Progresso atualizado por outro navegador",
            "A versão canônica mais recente foi carregada para evitar sobrescrever itens ou personagem.",
            { warning: true, duration: 5200 }
        );
        updateIndicator(status);
    });
    Aethra.EventBus.on("save:shared-error", (status) => {
        updateIndicator(status);
        showMessage(
            "Falha no save compartilhado",
            status.lastError || "O save local continua protegido neste navegador.",
            { warning: true, duration: 5200 }
        );
    });

    Aethra.EventBus.on("ui3:version-applied", ({ active } = {}) => {
        if (active) {
            if (banner) banner.hidden = true;
            indicator?.remove();
            indicator = null;
        } else {
            renderCurrentStatus();
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderCurrentStatus, { once: true });
    } else {
        renderCurrentStatus();
    }

    Aethra.SharedSaveStatus = {
        refresh: renderCurrentStatus,
        showEmptyPrompt,
        showMessage
    };
})(window.Aethra = window.Aethra || {});
