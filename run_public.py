import os
from dotenv import load_dotenv
from app import app

# Load environment variables
load_dotenv()

PORT = int(os.getenv("PORT", "8000"))

if __name__ == "__main__":
    print(f"=== Personal Finance Advisor Bot (Public Flask Server) ===")
    print(f"Starting Flask application on 0.0.0.0:{PORT}...")
    app.run(host="0.0.0.0", port=PORT, debug=False)
