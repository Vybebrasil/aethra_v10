// Compatibilidade: mantém `node server.js` apontando para o servidor canônico.
const { spawn } = require("child_process");
const path = require("path");

const python = process.platform === "win32" ? "python" : "python3";
const child = spawn(
    python,
    [path.join(__dirname, "server.py"), ...process.argv.slice(2)],
    { cwd: __dirname, stdio: "inherit", windowsHide: true }
);

child.on("error", (error) => {
    console.error(`Não foi possível iniciar server.py: ${error.message}`);
    process.exitCode = 1;
});

child.on("exit", (code, signal) => {
    process.exitCode = Number.isInteger(code) ? code : signal ? 1 : 0;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
        if (!child.killed) child.kill(signal);
    });
}
