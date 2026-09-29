"""Servidor local de desenvolvimento das Crônicas de Aethra.

Além dos arquivos estáticos, expõe um save canônico em disco para que perfis
de navegador diferentes possam testar o mesmo personagem. O servidor escuta
somente em 127.0.0.1 por padrão e nunca grava o save dentro do Git.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_DATA_ROOT = PROJECT_ROOT / ".aethra-dev" / "saves"
MAX_SAVE_BYTES = 8 * 1024 * 1024
PROFILE_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")
SAVE_LOCK = threading.Lock()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def normalize_profile(value: str | None) -> str:
    profile = (value or "principal").strip().lower()
    if not PROFILE_PATTERN.fullmatch(profile):
        raise ValueError("Perfil inválido. Use letras minúsculas, números, _ ou -.")
    return profile


class AethraDevServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, handler, data_root: Path):
        super().__init__(address, handler)
        self.data_root = data_root.resolve()
        self.data_root.mkdir(parents=True, exist_ok=True)


class AethraRequestHandler(SimpleHTTPRequestHandler):
    server_version = "AethraDevServer/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/dev-save/status":
            self._send_json(
                HTTPStatus.OK,
                {
                    "available": True,
                    "service": "aethra-shared-dev-save",
                    "version": 1,
                    "maxSaveBytes": MAX_SAVE_BYTES,
                },
            )
            return
        if parsed.path == "/api/dev-save":
            self._handle_get_save(parsed)
            return
        super().do_GET()

    def do_PUT(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/dev-save":
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Rota não encontrada."})
            return
        self._handle_put_save(parsed)

    def do_POST(self):
        self.do_PUT()

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/dev-save":
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Rota não encontrada."})
            return
        try:
            profile = self._profile_from(parsed)
            save_path = self._save_path(profile)
            with SAVE_LOCK:
                existed = save_path.exists()
                if existed:
                    save_path.unlink()
            self._send_json(HTTPStatus.OK, {"deleted": existed, "profile": profile})
        except ValueError as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    def _profile_from(self, parsed) -> str:
        values = parse_qs(parsed.query).get("profile", ["principal"])
        return normalize_profile(values[0])

    def _save_path(self, profile: str) -> Path:
        return self.server.data_root / f"{profile}.json"

    def _read_envelope(self, save_path: Path):
        if not save_path.exists():
            return None
        with save_path.open("r", encoding="utf-8") as source:
            envelope = json.load(source)
        if not isinstance(envelope, dict) or not isinstance(envelope.get("state"), dict):
            raise ValueError("O save compartilhado em disco está corrompido.")
        return envelope

    def _handle_get_save(self, parsed):
        try:
            profile = self._profile_from(parsed)
            with SAVE_LOCK:
                envelope = self._read_envelope(self._save_path(profile))
            if envelope is None:
                self._send_json(
                    HTTPStatus.NOT_FOUND,
                    {"exists": False, "profile": profile, "revision": 0},
                )
                return
            self._send_json(HTTPStatus.OK, envelope)
        except (ValueError, OSError, json.JSONDecodeError) as error:
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(error)})

    def _read_json_body(self):
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError as error:
            raise ValueError("Content-Length inválido.") from error
        if length <= 0:
            raise ValueError("Corpo JSON obrigatório.")
        if length > MAX_SAVE_BYTES:
            raise OverflowError("O save excede o limite de 8 MB.")
        payload = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(payload, dict) or not isinstance(payload.get("state"), dict):
            raise ValueError("O campo state deve conter um GameState válido.")
        return payload

    def _handle_put_save(self, parsed):
        try:
            profile = self._profile_from(parsed)
            payload = self._read_json_body()
            save_path = self._save_path(profile)
            requested_revision = int(payload.get("baseRevision", 0))

            with SAVE_LOCK:
                current = self._read_envelope(save_path)
                current_revision = int(current.get("revision", 0)) if current else 0
                if requested_revision != current_revision:
                    self._send_json(
                        HTTPStatus.CONFLICT,
                        {
                            "error": "O save compartilhado mudou em outro navegador.",
                            "current": current,
                            "profile": profile,
                            "revision": current_revision,
                        },
                    )
                    return

                envelope = {
                    "profile": profile,
                    "revision": current_revision + 1,
                    "updatedAt": utc_now(),
                    "writerId": str(payload.get("writerId") or "unknown")[:80],
                    "reason": str(payload.get("reason") or "manual")[:120],
                    "state": payload["state"],
                }

                save_path.parent.mkdir(parents=True, exist_ok=True)
                descriptor, temporary_name = tempfile.mkstemp(
                    prefix=f".{profile}-", suffix=".tmp", dir=str(save_path.parent)
                )
                try:
                    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as target:
                        json.dump(envelope, target, ensure_ascii=False, separators=(",", ":"))
                        target.flush()
                        os.fsync(target.fileno())
                    os.replace(temporary_name, save_path)
                finally:
                    if os.path.exists(temporary_name):
                        os.unlink(temporary_name)

            self._send_json(HTTPStatus.OK, envelope)
        except OverflowError as error:
            self._send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": str(error)})
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except OSError as error:
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(error)})

    def _send_json(self, status: HTTPStatus, payload):
        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format_string, *args):
        print(f"[{self.log_date_time_string()}] {format_string % args}", flush=True)


def parse_args():
    parser = argparse.ArgumentParser(description="Servidor local das Crônicas de Aethra")
    parser.add_argument("--port", type=int, default=int(os.getenv("AETHRA_PORT", "8000")))
    parser.add_argument("--host", default=os.getenv("AETHRA_HOST", "127.0.0.1"))
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(os.getenv("AETHRA_DEV_DATA_DIR", DEFAULT_DATA_ROOT)),
    )
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    with AethraDevServer(
        (arguments.host, arguments.port),
        AethraRequestHandler,
        arguments.data_dir,
    ) as httpd:
        print("=" * 60)
        print("Servidor local das Crônicas de Aethra iniciado")
        print(f"Jogo: http://{arguments.host}:{arguments.port}/")
        print(f"Save compartilhado: {httpd.data_root}")
        print("=" * 60, flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor finalizado.")
