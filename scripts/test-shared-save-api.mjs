import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataRoot = await mkdtemp(join(tmpdir(), "aethra-shared-save-test-"));

async function reservePort() {
    return new Promise((resolvePort, reject) => {
        const probe = createServer();
        probe.once("error", reject);
        probe.listen(0, "127.0.0.1", () => {
            const address = probe.address();
            const port = typeof address === "object" ? address.port : 0;
            probe.close((error) => error ? reject(error) : resolvePort(port));
        });
    });
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const port = await reservePort();
const origin = `http://127.0.0.1:${port}`;
const child = spawn(
    process.platform === "win32" ? "python" : "python3",
    ["server.py", "--port", String(port), "--host", "127.0.0.1", "--data-dir", dataRoot],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
);

let stderr = "";
child.stderr.on("data", (chunk) => { stderr += String(chunk); });

async function waitUntilReady() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        try {
            const response = await fetch(`${origin}/api/dev-save/status`, { cache: "no-store" });
            if (response.ok) return;
        } catch {
            // O processo ainda está abrindo a porta.
        }
        await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }
    throw new Error(`Servidor de teste não iniciou. ${stderr}`);
}

try {
    await waitUntilReady();
    const endpoint = `${origin}/api/dev-save?profile=principal`;

    const empty = await fetch(endpoint);
    assert(empty.status === 404, `GET vazio deveria retornar 404, recebeu ${empty.status}.`);

    const first = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            baseRevision: 0,
            writerId: "api-test-a",
            reason: "create",
            state: { meta: { schemaVersion: 78 }, marker: 1 }
        })
    });
    const firstBody = await first.json();
    assert(first.ok && firstBody.revision === 1, "Primeira gravação não criou a revisão 1.");

    const loaded = await fetch(endpoint);
    const loadedBody = await loaded.json();
    assert(loaded.ok && loadedBody.state.marker === 1, "GET não devolveu o estado canônico.");

    const conflict = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            baseRevision: 0,
            writerId: "api-test-b",
            reason: "stale",
            state: { meta: { schemaVersion: 78 }, marker: 999 }
        })
    });
    const conflictBody = await conflict.json();
    assert(
        conflict.status === 409 && conflictBody.current?.state?.marker === 1,
        "Conflito não preservou o save canônico."
    );

    const second = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            baseRevision: 1,
            writerId: "api-test-a",
            reason: "update",
            state: { meta: { schemaVersion: 78 }, marker: 2 }
        })
    });
    const secondBody = await second.json();
    assert(second.ok && secondBody.revision === 2, "Atualização não avançou para a revisão 2.");

    const removed = await fetch(endpoint, { method: "DELETE" });
    const removedBody = await removed.json();
    assert(removed.ok && removedBody.deleted === true, "DELETE não removeu o perfil de teste.");

    console.log("API de save compartilhado: 7/7 verificações aprovadas.");
} finally {
    if (!child.killed) child.kill("SIGTERM");
    await new Promise((resolveWait) => setTimeout(resolveWait, 120));
    const resolvedDataRoot = resolve(dataRoot);
    const resolvedTempRoot = resolve(tmpdir());
    if (resolvedDataRoot.startsWith(resolvedTempRoot)) {
        await rm(resolvedDataRoot, { recursive: true, force: true });
    }
}
