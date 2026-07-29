#!/usr/bin/env node
/*
 * run-integration.mjs — executa tests/integration.html sem abrir navegador.
 *
 * A suíte só rodava manualmente no browser, então quebras passavam batido
 * entre sessões. Este runner sobe um servidor estático efêmero, carrega a
 * página em Chrome headless via CDP e devolve exit code 0/1, permitindo usá-la
 * em hook de pre-commit ou CI.
 *
 * Sem dependências: usa apenas módulos nativos do Node (>= 20, por causa do
 * WebSocket embutido) e o Chrome já instalado.
 *
 * Uso:  node scripts/run-integration.mjs [--timeout 60] [--keep-open]
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const args = process.argv.slice(2);
const TIMEOUT_MS = Number(valorDe("--timeout") || 60) * 1000;
const MANTER_ABERTO = args.includes("--keep-open");

function valorDe(flag) {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
}

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

const CAMINHOS_CHROME = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].filter(Boolean);

function acharChrome() {
    const encontrado = CAMINHOS_CHROME.find((p) => existsSync(p));
    if (!encontrado) {
        throw new Error(
            "Chrome/Edge não encontrado. Defina CHROME_PATH apontando para o executável."
        );
    }
    return encontrado;
}

function subirServidor() {
    const server = createServer(async (req, res) => {
        try {
            const url = new URL(req.url, "http://localhost");
            const relativo = decodeURIComponent(url.pathname).replace(/^\/+/, "");
            const alvo = normalize(join(ROOT, relativo || "index.html"));

            // Impede escapar da raiz do projeto (path traversal).
            if (!alvo.startsWith(ROOT + sep) && alvo !== ROOT) {
                res.writeHead(403).end("forbidden");
                return;
            }

            const conteudo = await readFile(alvo);
            res.writeHead(200, {
                "Content-Type": MIME[extname(alvo).toLowerCase()] || "application/octet-stream"
            }).end(conteudo);
        } catch {
            res.writeHead(404).end("not found");
        }
    });

    return new Promise((resolve) => {
        // Porta 0 = efêmera, para não conflitar com um servidor já rodando.
        server.listen(0, "127.0.0.1", () => resolve({ server, porta: server.address().port }));
    });
}

async function esperarDevTools(porta, prazoMs = 15000) {
    const limite = Date.now() + prazoMs;
    while (Date.now() < limite) {
        try {
            const r = await fetch(`http://127.0.0.1:${porta}/json/version`);
            if (r.ok) return (await r.json()).webSocketDebuggerUrl;
        } catch {
            /* navegador ainda subindo */
        }
        await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error("Chrome não expôs a porta de depuração a tempo.");
}

function conectar(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        ws.addEventListener("open", () => resolve(ws), { once: true });
        ws.addEventListener("error", () => reject(new Error("Falha ao conectar no CDP.")), { once: true });
    });
}

function criarChamador(ws) {
    let proximoId = 0;
    const pendentes = new Map();

    ws.addEventListener("message", (evento) => {
        const msg = JSON.parse(evento.data);
        const pendente = pendentes.get(msg.id);
        if (!pendente) return;
        pendentes.delete(msg.id);
        msg.error ? pendente.reject(new Error(msg.error.message)) : pendente.resolve(msg.result);
    });

    return (method, params = {}, sessionId) => new Promise((resolve, reject) => {
        const id = ++proximoId;
        pendentes.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
}

/* Executado dentro da página: devolve o estado atual da suíte. */
const LEITOR_DE_RESULTADO = `(() => {
    const painel = document.getElementById("integration-test-report");
    if (!painel) return JSON.stringify({ estado: "sem-painel" });
    const itens = [...document.querySelectorAll("#integration-test-checks li")];
    return JSON.stringify({
        estado: painel.dataset.testStatus || "running",
        resumo: (document.getElementById("integration-test-summary") || {}).textContent || "",
        total: itens.length,
        falhas: itens
            .filter((li) => li.dataset.passed === "false")
            .map((li) => li.innerText.replace(/\\s+/g, " ").trim()),
        errosJs: Number(document.documentElement.dataset.qaErrors || 0),
        errosRecurso: Number(document.documentElement.dataset.qaResourceErrors || 0)
    });
})()`;

async function main() {
    const { server, porta } = await subirServidor();
    const perfil = await mkdtemp(join(tmpdir(), "aethra-headless-"));
    const portaCdp = 9222 + Math.floor(Math.random() * 500);
    const chrome = spawn(acharChrome(), [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--window-size=1280,720",
        `--user-data-dir=${perfil}`,
        `--remote-debugging-port=${portaCdp}`,
        "about:blank"
    ], { stdio: "ignore" });

    let codigoSaida = 1;
    let ws;

    try {
        const wsUrl = await esperarDevTools(portaCdp);
        ws = await conectar(wsUrl);
        const enviar = criarChamador(ws);

        const alvo = await enviar("Target.createTarget", {
            url: `http://127.0.0.1:${porta}/tests/integration.html`
        });
        const { sessionId } = await enviar("Target.attachToTarget", {
            targetId: alvo.targetId,
            flatten: true
        });
        await enviar("Runtime.enable", {}, sessionId);

        const prazo = Date.now() + TIMEOUT_MS;
        let resultado = null;

        while (Date.now() < prazo) {
            await new Promise((r) => setTimeout(r, 500));
            const { result } = await enviar(
                "Runtime.evaluate",
                { expression: LEITOR_DE_RESULTADO, returnByValue: true },
                sessionId
            );
            const atual = JSON.parse(result.value);
            if (atual.estado && atual.estado !== "running" && atual.estado !== "sem-painel") {
                resultado = atual;
                break;
            }
        }

        if (!resultado) {
            console.error(`✗ A suíte não concluiu em ${TIMEOUT_MS / 1000}s.`);
        } else {
            const ok = resultado.estado === "passed"
                && resultado.falhas.length === 0
                && resultado.errosJs === 0;

            console.log(resultado.resumo.trim() || `${resultado.total} verificações`);
            if (resultado.errosJs > 0) console.error(`✗ ${resultado.errosJs} erro(s) de JavaScript`);
            if (resultado.errosRecurso > 0) console.error(`⚠ ${resultado.errosRecurso} recurso(s) não carregado(s)`);
            resultado.falhas.forEach((f) => console.error(`  ✗ ${f}`));

            console.log(ok ? "Suíte de integração aprovada." : "Suíte de integração reprovada.");
            codigoSaida = ok ? 0 : 1;
        }
    } catch (erro) {
        console.error("✗ Falha ao executar a suíte:", erro.message);
    } finally {
        try { ws?.close(); } catch { /* já fechado */ }
        if (!MANTER_ABERTO) {
            chrome.kill();
            await rm(perfil, { recursive: true, force: true }).catch(() => {});
        }
        server.close();
    }

    process.exit(codigoSaida);
}

main();
