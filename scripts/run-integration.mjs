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
 * Uso:  node scripts/run-integration.mjs [--timeout 60] [--viewport 1280x720] [--keep-open]
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
const VIEWPORT = String(valorDe("--viewport") || "1280x720").toLowerCase();
if (!/^\d{3,5}x\d{3,5}$/.test(VIEWPORT)) {
    throw new Error("--viewport deve usar o formato LARGURAxALTURA, por exemplo 1920x1080.");
}
const WINDOW_SIZE = VIEWPORT.replace("x", ",");
const CDP_TIMEOUT_MS = Math.min(10000, Math.max(3000, Math.floor(TIMEOUT_MS / 3)));
let navegadorAtivo = null;
let servidorAtivo = null;

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
            const r = await fetch(`http://127.0.0.1:${porta}/json/version`, {
                signal: AbortSignal.timeout(1000)
            });
            if (r.ok) return (await r.json()).webSocketDebuggerUrl;
        } catch {
            /* navegador ainda subindo */
        }
        await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error("Chrome não expôs a porta de depuração a tempo.");
}

async function esperarAlvoDePagina(porta, urlEsperada, prazoMs = 15000) {
    const limite = Date.now() + prazoMs;
    while (Date.now() < limite) {
        try {
            const response = await fetch(`http://127.0.0.1:${porta}/json/list`, {
                signal: AbortSignal.timeout(1000)
            });
            if (response.ok) {
                const targets = await response.json();
                const page = targets.find((target) =>
                    target.type === "page"
                    && String(target.url || "").startsWith(urlEsperada)
                    && target.webSocketDebuggerUrl
                );
                if (page) return page;
            }
        } catch {
            /* página ainda carregando */
        }
        await esperar(150);
    }
    throw new Error("A página da suíte não apareceu no DevTools a tempo.");
}

function conectar(url, prazoMs = CDP_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const timer = setTimeout(() => {
            try { ws.close(); } catch { /* connection is still pending */ }
            reject(new Error(`CDP não conectou em ${prazoMs} ms.`));
        }, prazoMs);
        ws.addEventListener("open", () => {
            clearTimeout(timer);
            resolve(ws);
        }, { once: true });
        ws.addEventListener("error", () => {
            clearTimeout(timer);
            reject(new Error("Falha ao conectar no CDP."));
        }, { once: true });
    });
}

function criarChamador(ws, prazoMs = CDP_TIMEOUT_MS, onEvent = null) {
    let proximoId = 0;
    const pendentes = new Map();

    ws.addEventListener("message", (evento) => {
        const msg = JSON.parse(evento.data);
        const pendente = pendentes.get(msg.id);
        if (!pendente) {
            onEvent?.(msg);
            return;
        }
        pendentes.delete(msg.id);
        clearTimeout(pendente.timer);
        msg.error ? pendente.reject(new Error(msg.error.message)) : pendente.resolve(msg.result);
    });

    const rejeitarPendentes = () => {
        pendentes.forEach((pendente) => {
            clearTimeout(pendente.timer);
            pendente.reject(new Error(
                `Conexão CDP encerrada durante ${pendente.method}.`
            ));
        });
        pendentes.clear();
    };
    ws.addEventListener("close", rejeitarPendentes, { once: true });
    ws.addEventListener("error", rejeitarPendentes, { once: true });

    return (method, params = {}, sessionId) => new Promise((resolve, reject) => {
        const id = ++proximoId;
        const timer = setTimeout(() => {
            pendentes.delete(id);
            reject(new Error(`CDP ${method} excedeu ${prazoMs} ms.`));
        }, prazoMs);
        pendentes.set(id, { resolve, reject, timer, method });
        ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
}

function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function esperarSaidaProcesso(processo, prazoMs = 2500) {
    if (!processo || processo.exitCode !== null || processo.signalCode !== null) return true;
    return Promise.race([
        new Promise((resolve) => processo.once("exit", () => resolve(true))),
        esperar(prazoMs).then(() => false)
    ]);
}

async function encerrarNavegador(processo) {
    if (await esperarSaidaProcesso(processo, 1500)) return;
    try { processo.kill(); } catch { /* process already exited */ }
    if (await esperarSaidaProcesso(processo, 2500)) return;

    // No Windows, kill() pode encerrar apenas o processo-pai e deixar filhos
    // headless segurando o perfil. O PID é sempre o processo criado acima.
    if (process.platform === "win32" && processo?.pid) {
        await new Promise((resolve) => {
            const taskkill = spawn("taskkill.exe", [
                "/pid", String(processo.pid), "/t", "/f"
            ], { stdio: "ignore" });
            taskkill.once("exit", resolve);
            taskkill.once("error", resolve);
        });
        await esperarSaidaProcesso(processo, 1500);
    }
}

async function removerPerfilTemporario(perfil) {
    for (let tentativa = 0; tentativa < 4; tentativa += 1) {
        try {
            await rm(perfil, { recursive: true, force: true });
            return;
        } catch {
            await esperar(250 * (tentativa + 1));
        }
    }
}

async function fecharServidor(server) {
    if (!server) return;
    server.closeAllConnections?.();
    await Promise.race([
        new Promise((resolve) => server.close(() => resolve())),
        esperar(2000)
    ]);
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
        errosRecurso: Number(document.documentElement.dataset.qaResourceErrors || 0),
        readyState: document.readyState,
        integrationSrc: [...document.scripts].find((script) =>
            script.src.includes("IntegrationTest.js")
        )?.src || "",
        testRunning: window.Aethra?.IntegrationTest?.running,
        testCompleted: window.Aethra?.IntegrationTest?.completed,
        ultimoCheck: window.Aethra?.IntegrationTest?.lastReport?.checks?.at?.(-1)?.details || ""
    });
})()`;

async function main() {
    const { server, porta } = await subirServidor();
    servidorAtivo = server;
    const perfil = await mkdtemp(join(tmpdir(), "aethra-headless-"));
    const portaCdp = 9222 + Math.floor(Math.random() * 500);
    // O sandbox de renderer do Chromium é bloqueado em alguns ambientes Windows
    // gerenciados. O runner expõe apenas o servidor efêmero em 127.0.0.1; em
    // macOS/Linux mantemos o sandbox nativo habilitado.
    const compatibilidadeWindows = process.platform === "win32"
        ? ["--no-sandbox", "--disable-gpu-sandbox"]
        : [];
    const chrome = spawn(acharChrome(), [
        "--headless=new",
        ...compatibilidadeWindows,
        "--disable-gpu",
        "--disable-gpu-compositing",
        "--disable-software-rasterizer",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-component-update",
        "--disable-renderer-backgrounding",
        `--window-size=${WINDOW_SIZE}`,
        `--user-data-dir=${perfil}`,
        `--remote-debugging-port=${portaCdp}`,
        "--remote-allow-origins=*",
        `http://127.0.0.1:${porta}/tests/integration.html`
    ], { stdio: ["ignore", "ignore", "pipe"] });
    navegadorAtivo = chrome;
    const diagnosticoChrome = [];
    chrome.stderr?.on("data", (chunk) => {
        diagnosticoChrome.push(String(chunk));
        if (diagnosticoChrome.length > 40) diagnosticoChrome.shift();
    });

    let codigoSaida = 1;
    let ws;
    let enviar;
    const eventosRuntime = [];

    try {
        console.log(`Integração headless: servidor 127.0.0.1:${porta}, viewport ${VIEWPORT}, iniciando navegador...`);
        await esperarDevTools(portaCdp);
        console.log("Integração headless: DevTools pronto.");
        const alvo = await esperarAlvoDePagina(
            portaCdp,
            `http://127.0.0.1:${porta}/tests/integration.html`
        );
        ws = await conectar(alvo.webSocketDebuggerUrl);
        enviar = criarChamador(ws, CDP_TIMEOUT_MS, (event) => {
            if (["Runtime.consoleAPICalled", "Runtime.exceptionThrown"].includes(event.method)) {
                eventosRuntime.push(event);
            }
        });
        console.log("Integração headless: página de testes criada.");
        await enviar("Runtime.enable");
        console.log("Integração headless: suíte conectada.");

        const prazo = Date.now() + TIMEOUT_MS;
        let resultado = null;
        let ultimoEstado = null;

        while (Date.now() < prazo) {
            await new Promise((r) => setTimeout(r, 500));
            const { result } = await enviar(
                "Runtime.evaluate",
                { expression: LEITOR_DE_RESULTADO, returnByValue: true }
            );
            const atual = JSON.parse(result.value);
            ultimoEstado = atual;
            if (atual.estado && atual.estado !== "running" && atual.estado !== "sem-painel") {
                resultado = atual;
                break;
            }
        }

        if (!resultado) {
            console.error(`✗ A suíte não concluiu em ${TIMEOUT_MS / 1000}s.`);
            if (ultimoEstado) {
                console.error("Estado final observado:", JSON.stringify(ultimoEstado));
            }
            const diagnosticos = eventosRuntime.map((event) => {
                if (event.method === "Runtime.exceptionThrown") {
                    return event.params?.exceptionDetails?.exception?.description
                        || event.params?.exceptionDetails?.text;
                }
                return (event.params?.args || []).map((arg) =>
                    arg.value ?? arg.description ?? ""
                ).join(" ");
            }).filter(Boolean);
            if (diagnosticos.length) {
                console.error("Diagnóstico do navegador:", diagnosticos.slice(-8).join("\n"));
            }
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
        const logChrome = diagnosticoChrome.join("").trim();
        if (logChrome) console.error("Diagnóstico do Chrome:", logChrome.slice(-4000));
    } finally {
        if (!MANTER_ABERTO) {
            try { await enviar?.("Browser.close"); } catch { /* fallback below */ }
        }
        try { ws?.close(); } catch { /* already closed */ }
        if (!MANTER_ABERTO) {
            await encerrarNavegador(chrome);
            await removerPerfilTemporario(perfil);
        }
        await fecharServidor(server);
        navegadorAtivo = null;
        servidorAtivo = null;
    }

    process.exit(codigoSaida);
}

const watchdog = setTimeout(() => {
    console.error(`✗ Runner headless excedeu ${(TIMEOUT_MS + 30000) / 1000}s e foi encerrado.`);
    try { servidorAtivo?.closeAllConnections?.(); } catch { /* already closed */ }
    try { navegadorAtivo?.kill?.(); } catch { /* already closed */ }
    process.exit(1);
}, TIMEOUT_MS + 30000);

main().finally(() => clearTimeout(watchdog));
