/*
 * Ui3SaveStatus.js — estado do save compartilhado na UI 3.0 (fase 5.3).
 *
 * Indicador na carteira da barra superior (Ui3TopBar chama chipHTML) e um
 * aviso flutuante para sincronização, conflito, erro e a escolha do save
 * principal quando o servidor ainda não tem nenhum.
 *   leitura   SaveManager.getSharedStatus e eventos save:shared-*
 *   comandos  SaveManager.pullShared e publishShared
 * A falha de gravação local continua no SaveStatusBanner, que não depende
 * de interface.
 */
(function initUi3SaveStatus(Aethra) {
    "use strict";

    if (!Aethra?.EventBus || !Aethra?.SaveManager) return;

    const TRANSIENT_MS = 3600;
    const WARNING_MS = 5200;

    const state = { notice: null, dismissedEmptyPrompt: false, publishing: false };
    let element = null;
    let timer = null;

    function kit() {
        return Aethra.Ui3Kit;
    }

    function active() {
        return Boolean(Aethra.Ui3Shell?.isActive?.());
    }

    function status() {
        return Aethra.SaveManager.getSharedStatus?.() || {};
    }

    function describe(current = status()) {
        if (current.syncing) return { label: "Sincronizando", tone: "is-syncing", title: "Buscando a versão mais recente do save." };
        if (current.supported && current.exists) {
            return { label: "Compartilhado", tone: "is-synced", title: `Perfil ${current.profile || "principal"} · revisão ${current.revision || 0}. Clique para atualizar.` };
        }
        if (current.supported) return { label: "Escolher save", tone: "is-pending", title: "Escolha qual progresso local será o save compartilhado." };
        return { label: "Local", tone: "is-local", title: "O servidor compartilhado não está ativo; este navegador usa o save local." };
    }

    function chipHTML() {
        const K = kit();
        const view = describe();
        return `<button type="button" class="ui3-save-chip ${view.tone}" data-ui3-save-chip title="${K.esc(view.title)}"><span class="ui3-save-chip__dot" aria-hidden="true"></span><small>Save</small><strong>${K.esc(view.label)}</strong></button>`;
    }

    function ensureElement() {
        const root = Aethra.Ui3Shell?.root;
        if (!root) return null;
        if (element && root.contains(element)) return element;
        element = document.createElement("aside");
        element.className = "ui3-toast";
        element.hidden = true;
        element.setAttribute("role", "status");
        element.setAttribute("aria-live", "polite");
        element.addEventListener("click", onClick);
        root.appendChild(element);
        return element;
    }

    function render() {
        const K = kit();
        const target = ensureElement();
        if (!target || !K) return;
        const notice = state.notice;
        target.hidden = !notice || !active();
        if (!notice) return;
        target.classList.toggle("is-warning", notice.warning === true);
        target.innerHTML = `<span class="ui3-toast__icon" aria-hidden="true">⇄</span>
            <span class="ui3-list-row__text"><strong>${K.esc(notice.title)}</strong><small>${K.esc(notice.detail)}</small></span>
            ${notice.publish ? K.button({ label: state.publishing ? "Publicando…" : "Usar este progresso", variant: "primary", disabled: state.publishing, attributes: { "data-ui3-save-publish": "" } }) : ""}
            ${K.button({ label: "Fechar", variant: "ghost", attributes: { "data-ui3-save-dismiss": "" } })}`;
    }

    function show(notice, duration = 0) {
        window.clearTimeout(timer);
        state.notice = notice;
        render();
        if (duration > 0) {
            timer = window.setTimeout(() => {
                if (!state.notice?.publish) {
                    state.notice = null;
                    render();
                }
            }, duration);
        }
    }

    function showEmptyPrompt(current = status()) {
        if (state.dismissedEmptyPrompt) return;
        show({
            title: "Escolha o personagem principal",
            detail: `Este é o perfil ${current.profile || "principal"}. No navegador que tem o herói que você quer manter, use “Usar este progresso”.`,
            publish: true,
            warning: true
        });
    }

    function hide() {
        window.clearTimeout(timer);
        state.notice = null;
        render();
    }

    async function onChipClick() {
        const current = status();
        if (current.supported && !current.exists) {
            state.dismissedEmptyPrompt = false;
            return showEmptyPrompt(current);
        }
        if (current.supported && current.exists) {
            show({ title: "Sincronizando save", detail: "Buscando a versão mais recente…" }, TRANSIENT_MS);
            return Aethra.SaveManager.pullShared?.({ reason: "indicator" });
        }
        return show({ title: "Save local", detail: describe(current).title }, TRANSIENT_MS);
    }

    async function onClick(event) {
        if (event.target.closest("[data-ui3-save-dismiss]")) {
            state.dismissedEmptyPrompt = true;
            return hide();
        }
        if (event.target.closest("[data-ui3-save-publish]") && !state.publishing) {
            state.publishing = true;
            render();
            const published = await Aethra.SaveManager.publishShared?.("select-canonical-save");
            state.publishing = false;
            if (published) {
                state.dismissedEmptyPrompt = true;
                return hide();
            }
            return render();
        }
        return undefined;
    }

    function refreshBar() {
        Aethra.Ui3TopBar?.render?.();
    }

    Aethra.EventBus.on("save:shared-status", refreshBar);
    Aethra.EventBus.on("save:shared-empty", (current) => {
        refreshBar();
        showEmptyPrompt(current);
    });
    Aethra.EventBus.on("save:shared-loaded", () => {
        state.dismissedEmptyPrompt = true;
        hide();
        refreshBar();
    });
    Aethra.EventBus.on("save:shared-completed", (current = {}) => {
        state.dismissedEmptyPrompt = true;
        refreshBar();
        show({ title: "Save compartilhado atualizado", detail: `Perfil ${current.profile || "principal"} · revisão ${current.revision || 0}.` }, TRANSIENT_MS);
    });
    Aethra.EventBus.on("save:shared-conflict", () => {
        refreshBar();
        show({
            title: "Progresso atualizado por outro navegador",
            detail: "A versão mais recente foi carregada para não sobrescrever itens nem o herói.",
            warning: true
        }, WARNING_MS);
    });
    Aethra.EventBus.on("save:shared-error", (current = {}) => {
        refreshBar();
        show({
            title: "Falha no save compartilhado",
            detail: current.lastError || "O save local continua protegido neste navegador.",
            warning: true
        }, WARNING_MS);
    });
    Aethra.EventBus.on("ui3:version-applied", () => {
        render();
        const current = status();
        if (active() && current.supported && current.ready && !current.exists) showEmptyPrompt(current);
    });

    Aethra.Ui3SaveStatus = {
        chipHTML,
        onChipClick,
        showEmptyPrompt,
        hide,
        getNotice: () => (state.notice ? { ...state.notice } : null)
    };
})(window.Aethra = window.Aethra || {});
