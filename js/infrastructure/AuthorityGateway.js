// AuthorityGateway.js - Fronteira obrigatória entre o protótipo local e o servidor competitivo.
(function initAuthorityGateway(Aethra) {
    "use strict";

    if (!Aethra?.EventBus) {
        throw new Error("AuthorityGateway.js requer EventBus.");
    }

    const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
    const PROTECTED_CAPABILITIES = Object.freeze([
        "combatRng",
        "itemMint",
        "itemTransfer",
        "rankingWrite",
        "marketWrite",
        "wagerEscrow"
    ]);
    const runtime = {
        initialized: false,
        mode: "local-prototype",
        adapter: null,
        capabilities: Object.fromEntries(PROTECTED_CAPABILITIES.map((key) => [key, false]))
    };

    function adapterIsTrusted(adapter) {
        return Boolean(
            adapter
            && adapter.trusted === true
            && adapter.mode === "server"
            && typeof adapter.execute === "function"
        );
    }

    function getSnapshot() {
        return {
            initialized: runtime.initialized,
            mode: runtime.mode,
            serverAuthoritative: runtime.mode === "server" && adapterIsTrusted(runtime.adapter),
            competitive: runtime.mode === "server"
                && adapterIsTrusted(runtime.adapter)
                && runtime.capabilities.combatRng === true
                && runtime.capabilities.itemMint === true
                && runtime.capabilities.rankingWrite === true,
            capabilities: clone(runtime.capabilities)
        };
    }

    Aethra.AuthorityGateway = {
        protectedCapabilities: PROTECTED_CAPABILITIES,

        init() {
            if (runtime.initialized) return getSnapshot();
            runtime.initialized = true;
            Aethra.EventBus.emit("authority:ready", getSnapshot());
            return getSnapshot();
        },

        registerAdapter(adapter) {
            if (!adapterIsTrusted(adapter)) {
                throw new TypeError("O adaptador autoritativo precisa declarar mode=server, trusted=true e execute().");
            }
            runtime.adapter = adapter;
            runtime.mode = "server";
            runtime.capabilities = Object.fromEntries(
                PROTECTED_CAPABILITIES.map((key) => [key, adapter.capabilities?.[key] === true])
            );
            const snapshot = getSnapshot();
            Aethra.EventBus.emit("authority:changed", snapshot);
            return snapshot;
        },

        clearAdapter() {
            runtime.adapter = null;
            runtime.mode = "local-prototype";
            runtime.capabilities = Object.fromEntries(PROTECTED_CAPABILITIES.map((key) => [key, false]));
            const snapshot = getSnapshot();
            Aethra.EventBus.emit("authority:changed", snapshot);
            return snapshot;
        },

        can(capability) {
            return adapterIsTrusted(runtime.adapter) && runtime.capabilities[capability] === true;
        },

        guard(capability, context = {}) {
            const allowed = this.can(capability);
            const result = {
                allowed,
                capability,
                reason: allowed ? null : "SERVER_AUTHORITY_REQUIRED",
                authority: getSnapshot(),
                context: clone(context)
            };
            if (!allowed) Aethra.EventBus.emit("authority:command-blocked", clone(result));
            return result;
        },

        async execute(command, payload = {}, options = {}) {
            const capability = options.capability || command;
            const gate = this.guard(capability, { command });
            if (!gate.allowed) return { success: false, ...gate };
            return runtime.adapter.execute(command, clone(payload), {
                idempotencyKey: options.idempotencyKey || null
            });
        },

        getSnapshot
    };
})(window.Aethra = window.Aethra || {});
