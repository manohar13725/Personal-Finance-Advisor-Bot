import os
import json
import urllib.request
import urllib.error
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

# Step 6 — Verify Key is Loaded: Load .env file automatically at startup
def load_env():
    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

load_env()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "llama-3.3-70b-versatile")
PORT = int(os.getenv("PORT", "8000"))

SYSTEM_PROMPT = """You are WealthWise AI, an expert, friendly, and highly knowledgeable Personal Finance Advisor.
Your goal is to empower users to make smart financial decisions, master budgeting, build wealth, optimize savings, manage debt, and plan for retirement.

Key Guidelines:
1. Provide actionable, structured, and easy-to-understand financial advice.
2. Use formatting such as bullet points, bold key terms, and step-by-step guidance.
3. When users share income/expense numbers, perform accurate budgeting calculations (e.g. 50/30/20 rule, emergency fund calculation, debt snowball/avalanche).
4. Always clarify that while you offer comprehensive financial guidance and educational insights, users should consult registered professional advisors for binding legal/tax decisions.
5. Maintain an encouraging, empathetic, and professional tone.
"""

class PersonalFinanceHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/health":
            key_loaded = bool(os.getenv("GROQ_API_KEY"))
            masked_key = os.getenv("GROQ_API_KEY", "")[:7] + "..." + os.getenv("GROQ_API_KEY", "")[-4:] if key_loaded else "Not configured"
            response_data = {
                "status": "online",
                "api_key_loaded": key_loaded,
                "masked_key": masked_key,
                "model": DEFAULT_MODEL
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode("utf-8"))
            return

        if self.path == "/" or self.path == "":
            self.path = "/index.html"

        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/chat":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            
            try:
                data = json.loads(body.decode("utf-8"))
                user_messages = data.get("messages", [])
                model_name = data.get("model", DEFAULT_MODEL)
                
                # Check for active API key
                api_key = os.getenv("GROQ_API_KEY", "")
                if not api_key:
                    self._send_json({"error": "GROQ_API_KEY is not set in environment or .env file."}, status=400)
                    return

                # Construct full prompt with financial system prompt
                full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + user_messages

                payload = {
                    "model": model_name,
                    "messages": full_messages,
                    "temperature": 0.7,
                    "max_tokens": 1500
                }

                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) WealthWise/1.0"
                    },
                    data=json.dumps(payload).encode("utf-8")
                )

                with urllib.request.urlopen(req) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    ai_content = resp_data["choices"][0]["message"]["content"]
                    self._send_json({
                        "role": "assistant",
                        "content": ai_content,
                        "model": model_name
                    })

            except urllib.error.HTTPError as e:
                err_text = e.read().decode("utf-8") if hasattr(e, "read") else str(e)
                self._send_json({"error": f"Groq API Error ({e.code}): {err_text}"}, status=e.code)
            except Exception as e:
                self._send_json({"error": f"Internal Server Error: {str(e)}"}, status=500)
            return

        self._send_json({"error": "Endpoint not found"}, status=404)

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

def run_server():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, PersonalFinanceHandler)
    print(f"=== Personal Finance Advisor Bot ===")
    print(f"Key loaded: {bool(GROQ_API_KEY)} ({GROQ_API_KEY[:7]}...{GROQ_API_KEY[-4:] if GROQ_API_KEY else ''})")
    print(f"Server running at http://localhost:{PORT}")
    print("Press Ctrl+C to stop.")
    httpd.serve_forever()

if __name__ == "__main__":
    run_server()
