import json, sys
from http.server import BaseHTTPRequestHandler, HTTPServer

MODE = sys.argv[1]
TOKEN = "t" * 120


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _s(self, code, body, ctype="application/json"):
        b = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        if self.path == "/api/login":
            return self._s(200, json.dumps({"token": TOKEN}, separators=(",", ":")))
        self._s(404, "{}")

    def do_GET(self):
        if self.path.startswith("/api/employees"):
            if MODE == "nonjson":
                return self._s(200, "<html>not json at all</html>", "text/html")
            if MODE == "roster500":
                return self._s(500, json.dumps({"error": "Internal Server Error"}, separators=(",", ":")))
            if MODE == "roster401":
                return self._s(401, json.dumps({"error": "Invalid username or password"}, separators=(",", ":")))
        self._s(404, "{}")


HTTPServer(("127.0.0.1", 4599), H).serve_forever()
