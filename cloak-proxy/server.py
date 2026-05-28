from http.server import HTTPServer, BaseHTTPRequestHandler
import json, threading, queue
import cloakbrowser

EH_COOKIES = [
    {"name": "nw", "value": "1",    "domain": "e-hentai.org", "path": "/"},
    {"name": "sl", "value": "dm_2", "domain": "e-hentai.org", "path": "/"},
    {"name": "nw", "value": "1",    "domain": "exhentai.org", "path": "/"},
]

# All Playwright calls happen in this dedicated thread.
_request_queue = queue.Queue()


def browser_worker():
    print("[cloak-proxy] launching browser...", flush=True)
    browser = cloakbrowser.launch(
        headless=True,
        args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    )
    print("[cloak-proxy] browser ready", flush=True)

    while True:
        url, resp_q = _request_queue.get()
        try:
            ctx = browser.new_context()
            ctx.add_cookies(EH_COOKIES)
            page = ctx.new_page()
            page.goto(url, timeout=30000, wait_until="domcontentloaded")
            html = page.content()
            ctx.close()
            resp_q.put({"html": html})
        except Exception as e:
            print(f"[cloak-proxy] error: {e}", flush=True)
            resp_q.put({"error": str(e)})


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path != "/fetch":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))
        url = body.get("url", "")
        if not url:
            self.send_error(400, "missing url")
            return

        resp_q = queue.Queue()
        _request_queue.put((url, resp_q))
        try:
            result = resp_q.get(timeout=35)
        except queue.Empty:
            result = {"error": "browser fetch timed out"}

        code = 502 if "error" in result else 200
        self._json(code, result)

    def _json(self, code, data):
        resp = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(resp)))
        self.end_headers()
        self.wfile.write(resp)

    def log_message(self, fmt, *args):
        print(f"[cloak-proxy] {fmt % args}", flush=True)


if __name__ == "__main__":
    t = threading.Thread(target=browser_worker, daemon=True)
    t.start()

    port = 8765
    print(f"[cloak-proxy] starting on :{port}", flush=True)
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
