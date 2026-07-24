(function (Aethra) {
    "use strict";
    const escapeHTML = (str) => String(str || "").replace(/[&<>"']/g, (m) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[m]);

    let state = {
        filterCategory: "all",
        searchQuery: ""
    };

    function renderArsenal(container) {
        if (!container) return;

        const allItems = Object.values(Aethra.GameData.items || {});
        
        let filtered = allItems.filter(item => {
            if (state.filterCategory !== "all") {
                if (state.filterCategory === "HEAD" || state.filterCategory === "CHEST" || 
                    state.filterCategory === "LEGS" || state.filterCategory === "FEET" || 
                    state.filterCategory === "SHIELD") {
                    if (item.itemType !== state.filterCategory) return false;
                } else {
                    if (item.type !== state.filterCategory) return false;
                }
            }
            if (state.searchQuery) {
                const query = state.searchQuery.toLowerCase();
                const nameMatch = (item.name || "").toLowerCase().includes(query);
                const descMatch = (item.description || "").toLowerCase().includes(query);
                if (!nameMatch && !descMatch) return false;
            }
            return true;
        });

        filtered.sort((a, b) => {
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return (a.name || "").localeCompare(b.name || "");
        });

        const gridHTML = filtered.map(item => {
            const image = Aethra.GameData?.getItemImage?.(item) || "";
            const fallback = escapeHTML(item.icon || "⍰");
            const rarityInfo = Aethra.GameData?.getRarityPresentation?.(item);
            const color = rarityInfo?.color || "#fff";
            
            return `
                <button type="button" class="arsenal-item-card" data-arsenal-item-id="${escapeHTML(item.id)}" style="--rarity-color: ${color}">
                    <div class="arsenal-item-card__icon">
                        ${image ? `<img src="${escapeHTML(image)}" alt="" draggable="false" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';"><b style="display:none;" aria-hidden="true">${fallback}</b>` : `<b aria-hidden="true">${fallback}</b>`}
                    </div>
                    <div class="arsenal-item-card__details">
                        <strong>${escapeHTML(item.name)}</strong>
                        <small style="color:${color}">${(escapeHTML(item.rarity || "Comum")).toUpperCase()} ${(escapeHTML(item.itemType || item.type)).toUpperCase()}</small>
                    </div>
                </button>
            `;
        }).join("");

        // Update subtitle in outer window header if available
        const windowHeaderSmall = container.parentElement?.querySelector(".window-header small");
        if (windowHeaderSmall) {
            windowHeaderSmall.textContent = `Visualizador da Base de Dados • ${allItems.length} Itens`;
        }

        container.innerHTML = `
            <div class="arsenal-workspace">
                <div class="arsenal-workspace__filters">
                    <input type="search" id="arsenal-search" class="aethra-input" placeholder="Buscar por nome..." value="${escapeHTML(state.searchQuery)}">
                    <select id="arsenal-category-filter" class="aethra-select">
                        <option value="all" ${state.filterCategory === "all" ? "selected" : ""}>Todos os Itens (${allItems.length})</option>
                        <option value="weapon" ${state.filterCategory === "weapon" ? "selected" : ""}>Armas</option>
                        <option value="armor" ${state.filterCategory === "armor" ? "selected" : ""}>Armaduras (Geral)</option>
                        <option value="HEAD" ${state.filterCategory === "HEAD" ? "selected" : ""}>Capacetes</option>
                        <option value="CHEST" ${state.filterCategory === "CHEST" ? "selected" : ""}>Peitorais</option>
                        <option value="LEGS" ${state.filterCategory === "LEGS" ? "selected" : ""}>Calças</option>
                        <option value="FEET" ${state.filterCategory === "FEET" ? "selected" : ""}>Botas</option>
                        <option value="SHIELD" ${state.filterCategory === "SHIELD" ? "selected" : ""}>Escudos</option>
                        <option value="accessory" ${state.filterCategory === "accessory" ? "selected" : ""}>Acessórios</option>
                        <option value="consumable" ${state.filterCategory === "consumable" ? "selected" : ""}>Consumíveis</option>
                        <option value="loot" ${state.filterCategory === "loot" ? "selected" : ""}>Loot / Materiais</option>
                    </select>
                </div>
                <div class="arsenal-workspace__grid">
                    ${gridHTML || '<div class="arsenal-workspace__empty">Nenhum item encontrado.</div>'}
                </div>
            </div>
        `;

        const searchInput = container.querySelector("#arsenal-search");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                state.searchQuery = e.target.value;
                renderArsenal(container);
                const reSearch = container.querySelector("#arsenal-search");
                if (reSearch) {
                    reSearch.focus();
                    const len = reSearch.value.length;
                    reSearch.setSelectionRange(len, len);
                }
            });
        }

        const categorySelect = container.querySelector("#arsenal-category-filter");
        if (categorySelect) {
            categorySelect.addEventListener("change", (e) => {
                state.filterCategory = e.target.value;
                renderArsenal(container);
            });
        }

        container.querySelectorAll(".arsenal-item-card").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.arsenalItemId;
                const itemDef = Aethra.GameData.items[id];
                if (itemDef && Aethra.UIManager?.openItemDetails) {
                    const fakeInstance = { ...itemDef, instanceId: "arsenal_" + id };
                    Aethra.UIManager.openItemDetails(fakeInstance, { source: "arsenal" });
                }
            });
        });
    }

    Aethra.ArsenalWorkspace = {
        render: renderArsenal
    };

    document.addEventListener("DOMContentLoaded", () => {
        if (Aethra.WindowManager) {
            Aethra.WindowManager.registerWindowRenderer("arsenal-view", {
                containers: ["arsenal-workspace"],
                title: "Arsenal Geral",
                render: () => renderArsenal(document.getElementById("arsenal-workspace"))
            });
        }
    });

})(window.Aethra = window.Aethra || {});
