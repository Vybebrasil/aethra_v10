import http.server
import socketserver
import os

PORT = 8080

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
        print("====================================================")
        print(f"Servidor Python local rodando com sucesso!")
        print(f"Acesse no seu navegador: http://localhost:{PORT}")
        print(f"Ou no IP local:          http://127.0.0.1:{PORT}")
        print("====================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor finalizado.")
