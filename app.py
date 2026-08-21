import os
import json
import re
import sqlite3
from pathlib import Path
from flask import Flask, render_template, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# Load environment variables automatically at startup using python-dotenv
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gemini-2.5-flash")
PORT = int(os.getenv("PORT", "8000"))

# Initialize Flask app
app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = os.getenv("FLASK_SECRET_KEY", "super-secret-wealthwise-key-1234")

# Initialize SQLite Database
def init_db():
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (username TEXT PRIMARY KEY, password_hash TEXT)''')
    conn.commit()
    conn.close()

init_db()

SYSTEM_PROMPT = """You are WealthWise AI, an expert, empathetic, and highly knowledgeable Personal Finance Advisor designed to help students, salaried professionals, and individuals master their finances.

You excel in the 7 Core Financial Modules & Special Features:
1. Personalized Budget Generator: For salaried professionals and individuals, produce structured allocations for Fixed Expenses (Rent, EMI, Utilities) and Variable Expenses (Food, Transport, Entertainment) with clear savings targets using the 50/30/20 benchmark rule.
2. Spending Analyser: Analyze category expense patterns (Food, Transport, Dining, Entertainment, Housing). Compare each against recommended budget thresholds (e.g. Housing <= 30%, Food <= 15%, Dining/Entertainment <= 10%, Transport <= 10%) and provide exact percentage-based breakdowns.
3. Saving Suggestions: Always return 3 to 5 specific, highly actionable saving recommendations calibrated to the user's actual spending behavior and financial goals (e.g., "Reduce dining expenses by ₹3,000 and redirect to your Emergency Fund").
4. Monthly Financial Reports: Deliver structured summaries with Income, Total Expenses, Net Savings, Highest Expense Category, and Suggested Target Savings for Next Month.
5. Investments Advisor: Guide users based on risk profile (Low/Medium/High), goal, and horizon. Cover research categories (FD, PPF, Mutual Funds, Equity), expected return ranges without guarantees, lock-in/liquidity, risks, diversification, scam warnings, and ALWAYS include: "Consult a SEBI-registered Investment Adviser for personalized securities advice."
6. Debt / Loan Planner: Calculate EMI, total interest, total repayment, remaining balance, EMI-to-Income affordability percentage (aiming <30-40%), and debt snowball/avalanche payoff advice.
7. Emergency Fund Planner: Calculate 3-to-6 months of essential expenses (Rent, Food, Transport, Bills), compare against current emergency savings, and outline the exact shortfall and monthly saving plan.

Key Guidelines:
- Support Indian Rupees (₹) by default when users provide rupee figures, or local currency as requested.
- Provide actionable, structured, formatted advice with bullet points, bold headers, and key callouts.
- Maintain an encouraging, clear, and professional tone.
"""

CATEGORY_TIPS = {
    "rent": "should not exceed 30% of income",
    "food": "under 15%",
    "transport": "within 10%",
    "entertainment": "5–8%",
    "savings": "minimum 20%"
}

GOAL_DESCRIPTIONS = {
    "emergency fund": "Building a safety net of 3-6 months of expenses.",
    "vacation": "Saving for travel and leisure without incurring debt.",
    "gadget purchase": "Funding short-term technology or appliance needs.",
    "investment": "Growing long-term wealth through diversified assets."
}

def build_prompt(income: float, expenses: dict, goals: str, currency: str = "INR") -> str:
    """Assembles a structured financial prompt combining income, expenses, and goals, incorporating CATEGORY_TIPS and GOAL_DESCRIPTIONS."""
    
    # 1. Map common expense categories to recommended budget percentage thresholds
    mapped_tips = []
    for exp_cat in expenses.keys():
        match_found = False
        for tip_cat, tip_desc in CATEGORY_TIPS.items():
            if tip_cat in exp_cat.lower():
                mapped_tips.append(f"- {exp_cat}: {tip_desc}")
                match_found = True
                break
        if not match_found:
            mapped_tips.append(f"- {exp_cat}: Keep spending optimized")

    tips_str = "\n".join(mapped_tips)

    # 2. Map financial goal to description
    goal_key = str(goals).lower().strip()
    goal_desc = "Custom user financial target."
    for gk, gd in GOAL_DESCRIPTIONS.items():
        if gk in goal_key:
            goal_desc = gd
            break

    formatted_expenses = "\n".join([f"- {cat}: {amount} {currency}" for cat, amount in expenses.items()])

    return f"""You are WealthWise AI, an expert personal finance advisor.
Analyze the following user financial data and return strictly a valid JSON response.

FINANCIAL PROFILE:
- Monthly Income: {income} {currency}
- Monthly Expenses:
{formatted_expenses}
- Financial Goal: {goals or 'Not specified'} (Goal Context: {goal_desc})

RECOMMENDED BUDGET THRESHOLDS:
{tips_str}

CRITICAL INSTRUCTION: Return ONLY a valid JSON object matching the schema below. Do not wrap in markdown or add text outside the JSON.

For the "suggestions" array: Based on the user's actual NET SAVINGS amount, suggest EXACTLY up to 7 REAL, SPECIFIC, LOW-BUDGET INVESTMENT PLANS they can start immediately.
RULES:
- Mention REAL investment products by name: e.g. SIP in Nifty 50 Index Fund, PPF, NPS Tier-1, Recurring Deposit, Digital Gold, ELSS mutual fund, Sovereign Gold Bond, etc.
- Include exact suggested monthly amounts based on their savings (e.g. "Start SIP of ₹500/month in a Nifty 50 Index Fund.")
- Keep each point to ONE concise sentence (max 15 words).
- Prioritize affordable options starting from ₹100-₹1000/month.
- Do NOT give generic advice. Give specific, named, actionable investment steps.
{{
  "budget": {{
    "total_income": {income},
    "total_expenses": total_expenses_number,
    "net_savings": net_savings_number,
    "savings_rate_percent": savings_percentage_number
  }},
  "analysis": {{
    "summary": "A comprehensive 2-3 sentence overview of budget health, net savings rate, and key observations.",
    "breakdown": [
      {{
        "category": "Category Name",
        "amount": numeric_amount,
        "percentage": percentage_of_income,
        "status": "Healthy / Warning / Overbudget",
        "tip": "Benchmark suggestion threshold tip"
      }}
    ]
  }},
  "suggestions": [
    "Start SIP of ₹500/month in a Nifty 50 Index Fund for long-term wealth.",
    "Open PPF account and deposit ₹500/month for tax-free returns.",
    "Add up to 7 real investment suggestions based on actual savings"
  ]
}}
"""



def extract_json(text_content: str) -> dict:
    """Parses JSON response, handling direct JSON, markdown code blocks, and raw JSON object extraction."""
    if not text_content:
        return {}

    # Strategy 1: Direct JSON parse
    try:
        return json.loads(text_content.strip())
    except Exception:
        pass

    # Strategy 2: Markdown code block extraction (```json ... ``` or ``` ... ```)
    markdown_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
    match = re.search(markdown_pattern, text_content, re.IGNORECASE)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except Exception:
            pass

    # Strategy 3: Raw JSON object regex extraction ({ ... })
    json_object_pattern = r'\{[\s\S]*\}'
    match = re.search(json_object_pattern, text_content)
    if match:
        try:
            return json.loads(match.group(0).strip())
        except Exception:
            pass

    # Strategy 4: Fallback wrapper if AI returned non-JSON text
    return {
        "budget": {
            "total_income": 0,
            "total_expenses": 0,
            "net_savings": 0,
            "savings_rate_percent": 0.0
        },
        "analysis": {
            "summary": text_content.strip(),
            "breakdown": []
        },
        "suggestions": ["Maintain continuous tracking of your monthly expenses.", "Build a 3-6 month emergency safety net."]
    }

try:
    from google import genai
    GENAI_AVAILABLE = True
except ImportError:
    genai = None
    GENAI_AVAILABLE = False

# Try initializing Google GenAI client if GEMINI_API_KEY is available
genai_client = None
if GENAI_AVAILABLE and GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
    try:
        genai_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"Warning: Failed to initialize Google GenAI client: {e}")

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    
    if not username or not password:
        return jsonify({"error": "User ID and password are required."}), 400
        
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    try:
        c.execute("SELECT * FROM users WHERE username = ?", (username,))
        if c.fetchone():
            return jsonify({"error": "User ID already exists."}), 400
            
        password_hash = generate_password_hash(password)
        c.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, password_hash))
        conn.commit()
        session['username'] = username
        return jsonify({"success": True, "message": "Registered successfully."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    
    if not username or not password:
        return jsonify({"error": "User ID and password are required."}), 400
        
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    try:
        c.execute("SELECT password_hash FROM users WHERE username = ?", (username,))
        row = c.fetchone()
        if row and check_password_hash(row[0], password):
            session['username'] = username
            return jsonify({"success": True, "message": "Logged in successfully."})
        else:
            return jsonify({"error": "Invalid User ID or password."}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    session.pop('username', None)
    return jsonify({"success": True})

@app.route("/api/auth/status", methods=["GET"])
def auth_status():
    if 'username' in session:
        return jsonify({"logged_in": True, "username": session['username']})
    return jsonify({"logged_in": False})

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/analyse", methods=["POST"])
@app.route("/api/analyse", methods=["POST"])
def analyse():
    global genai_client, GEMINI_API_KEY
    try:
        data = request.get_json() or {}

        # 1. Validate income
        income_raw = data.get("income")
        if income_raw is None or income_raw == "":
            return jsonify({"error": "Monthly income is required."}), 400
        
        try:
            income = float(income_raw)
        except (ValueError, TypeError):
            return jsonify({"error": "Monthly income must be a valid numeric value."}), 400

        if income < 0:
            return jsonify({"error": "Monthly income must be greater than or equal to 0."}), 400
        
        if income > 100000000:
            return jsonify({"error": "Monthly income exceeds acceptable limit of 100,000,000."}), 400

        # 2. Validate expenses
        expenses_raw = data.get("expenses")
        if not expenses_raw:
            return jsonify({"error": "At least one expense category entry is required."}), 400

        parsed_expenses = {}
        if isinstance(expenses_raw, dict):
            for cat, val in expenses_raw.items():
                try:
                    num_val = float(val)
                    if num_val >= 0:
                        parsed_expenses[str(cat)] = num_val
                except (ValueError, TypeError):
                    continue
        elif isinstance(expenses_raw, list):
            for item in expenses_raw:
                if isinstance(item, dict) and "category" in item and "amount" in item:
                    try:
                        num_val = float(item["amount"])
                        if num_val >= 0:
                            parsed_expenses[str(item["category"])] = num_val
                    except (ValueError, TypeError):
                        continue

        if not parsed_expenses:
            return jsonify({"error": "At least one valid expense entry with an amount greater than or equal to 0 is required."}), 400

        goals = str(data.get("goals", "")).strip()
        currency = str(data.get("currency", "INR")).strip()

        # 3. Construct prompt
        prompt = build_prompt(income, parsed_expenses, goals, currency)

        raw_response_text = ""

        # 4. Integrate API Call (Gemini API - single model, no double retry)
        if GENAI_AVAILABLE and (genai_client or (GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here")):
            try:
                if not genai_client and genai is not None:
                    genai_client = genai.Client(api_key=GEMINI_API_KEY)

                if genai_client:
                    response = genai_client.models.generate_content(
                        model="gemini-2.5-flash",
                        contents=prompt
                    )

                    if response and hasattr(response, "text") and response.text:
                        raw_response_text = response.text
            except Exception as e:
                print(f"Gemini API Exception during analysis: {e}. Trying fallback...")

        # 5. Fallback API Call (Groq API with 10s timeout)
        if not raw_response_text and GROQ_API_KEY and not GROQ_API_KEY.startswith("gsk_placeholder"):
            import urllib.request
            payload = {
                "model": "groq/compound",
                "messages": [
                    {"role": "system", "content": "You are a financial advisor returning strictly valid JSON responses."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3
            }
            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0"
                },
                data=json.dumps(payload).encode("utf-8")
            )
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    raw_response_text = resp_data["choices"][0]["message"]["content"]
            except Exception as err:
                print(f"Groq API Exception during analysis: {err}")

        # 6. Fallback Smart Advisor Engine calculation if API keys unconfigured
        if not raw_response_text:
            total_exp = sum(parsed_expenses.values())
            net_sav = income - total_exp
            sav_rate = round((net_sav / income) * 100, 1) if income > 0 else 0
            breakdown_items = []
            for cat, amt in parsed_expenses.items():
                pct = round((amt / income) * 100, 1) if income > 0 else 0
                status = "Healthy" if pct <= 20 else ("Warning" if pct <= 35 else "Overbudget")
                breakdown_items.append({
                    "category": cat,
                    "amount": amt,
                    "percentage": pct,
                    "status": status,
                    "tip": CATEGORY_TIPS.get(cat.lower(), "Keep spending optimized")
                })

            summary_text = f"Smart Engine Analysis: Monthly income is {currency} {income:,.2f} with total expenses of {currency} {total_exp:,.2f}, yielding net savings of {currency} {net_sav:,.2f} ({sav_rate}% savings rate)."

            return jsonify({
                "success": True,
                "budget": {
                    "total_income": income,
                    "total_expenses": total_exp,
                    "net_savings": net_sav,
                    "savings_rate_percent": sav_rate
                },
                "analysis": {
                    "summary": summary_text,
                    "breakdown": breakdown_items
                },
                "suggestions": [
                    "Maintain essential expenses below 50% of monthly income.",
                    "Build a 3 to 6 month emergency safety fund.",
                    "Target saving at least 20% of net monthly income."
                ],
                "savings_tips": [],
                "investment_tips": [],
                "summary": summary_text
            })

        # 7. Parse and validate JSON response keys
        parsed_data = extract_json(raw_response_text)
        
        # Validate that the parsed result contains required keys
        if "budget" not in parsed_data or not isinstance(parsed_data["budget"], dict):
            total_exp = sum(parsed_expenses.values())
            parsed_data["budget"] = {
                "total_income": income,
                "total_expenses": total_exp,
                "net_savings": income - total_exp,
                "savings_rate_percent": round(((income - total_exp) / income) * 100, 1) if income > 0 else 0
            }
            
        if "analysis" not in parsed_data or not isinstance(parsed_data["analysis"], dict):
            breakdown_items = []
            for cat, amt in parsed_expenses.items():
                pct = round((amt / income) * 100, 1) if income > 0 else 0
                status = "Healthy" if pct <= 20 else ("Warning" if pct <= 35 else "Overbudget")
                breakdown_items.append({
                    "category": cat,
                    "amount": amt,
                    "percentage": pct,
                    "status": status,
                    "tip": "Keep spending optimized"
                })
            parsed_data["analysis"] = {
                "summary": "AI budget analysis profile completed.",
                "breakdown": breakdown_items
            }
            
        if "summary" not in parsed_data["analysis"]:
            parsed_data["analysis"]["summary"] = "Financial profile analysis completed successfully."
            
        if "suggestions" not in parsed_data or not isinstance(parsed_data["suggestions"], list):
            parsed_data["suggestions"] = [
                "Review your fixed and discretionary expense categories regularly.",
                "Prioritize building a 3-6 month emergency fund.",
                "Save at least 20% of your net monthly income."
            ]
        # Ensure savings_tips and investment_tips exist
        if "savings_tips" not in parsed_data or not isinstance(parsed_data["savings_tips"], list):
            parsed_data["savings_tips"] = []
        if "investment_tips" not in parsed_data or not isinstance(parsed_data["investment_tips"], list):
            parsed_data["investment_tips"] = []

        return jsonify({
            "success": True,
            "budget": parsed_data["budget"],
            "analysis": parsed_data["analysis"],
            "suggestions": parsed_data["suggestions"],
            "savings_tips": parsed_data["savings_tips"],
            "investment_tips": parsed_data["investment_tips"],
            "summary": parsed_data["analysis"]["summary"]
        })

    except Exception as e:
        gemini_key_loaded = bool(GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here")
        groq_key_loaded = bool(GROQ_API_KEY)
        key_loaded = gemini_key_loaded or groq_key_loaded
        active_key = GEMINI_API_KEY if gemini_key_loaded else GROQ_API_KEY
        masked_key = active_key[:7] + "..." + active_key[-4:] if active_key else "Not configured"
        
        return jsonify({
            "status": "online",
            "api_key_loaded": key_loaded,
            "gemini_api_key_loaded": gemini_key_loaded,
            "groq_api_key_loaded": groq_key_loaded,
            "masked_key": masked_key,
            "model": "gemini-2.5-flash" if gemini_key_loaded else DEFAULT_MODEL
        })

@app.route("/api/config/key", methods=["POST"])
def update_api_key():
    global GEMINI_API_KEY, genai_client
    try:
        data = request.get_json() or {}
        new_key = data.get("key", "").strip()
        if new_key:
            GEMINI_API_KEY = new_key
            if GENAI_AVAILABLE and genai is not None:
                try:
                    genai_client = genai.Client(api_key=GEMINI_API_KEY)
                    return jsonify({"status": "success", "message": "Gemini API Key updated successfully!"})
                except Exception as e:
                    return jsonify({"status": "error", "message": f"Failed to initialize Gemini SDK: {str(e)}"}), 400
            else:
                return jsonify({"status": "error", "message": "google-genai package is not installed."}), 500
        return jsonify({"status": "error", "message": "Key cannot be empty."}), 400
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/chat", methods=["POST"])
def chat():
    global genai_client, GEMINI_API_KEY
    try:
        data = request.get_json() or {}
        user_messages = data.get("messages", [])
        
        if not user_messages:
            return jsonify({"error": "No messages provided."}), 400

        # Retrieve prompt content safely from last user message
        last_msg_item = user_messages[-1]
        if isinstance(last_msg_item, dict):
            last_user_msg = last_msg_item.get("content", "")
        else:
            last_user_msg = str(last_msg_item)

        # 1. Try Gemini API first if configured
        if GENAI_AVAILABLE and (genai_client or (GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here")):
            try:
                if not genai_client and genai is not None:
                    genai_client = genai.Client(api_key=GEMINI_API_KEY)
                
                if genai_client:
                    response = genai_client.models.generate_content(
                        model="gemini-2.5-flash",
                        contents=f"{SYSTEM_PROMPT}\n\nUser Question: {last_user_msg}"
                    )
                    if response and hasattr(response, "text") and response.text:
                        return jsonify({
                            "role": "assistant",
                            "content": response.text,
                            "model": "gemini-2.5-flash"
                        })
            except Exception as e:
                print(f"Gemini API Exception: {e}. Trying fallback models...")

        # 2. Try Groq API if key is valid
        if GROQ_API_KEY and not GROQ_API_KEY.startswith("gsk_placeholder"):
            import urllib.request
            import urllib.error
            full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + user_messages
            payload = {
                "model": "groq/compound",
                "messages": full_messages,
                "temperature": 0.7,
                "max_tokens": 1500
            }
            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) WealthWise/1.0"
                },
                data=json.dumps(payload).encode("utf-8")
            )
            try:
                with urllib.request.urlopen(req) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    ai_content = resp_data["choices"][0]["message"]["content"]
                    return jsonify({
                        "role": "assistant",
                        "content": ai_content,
                        "model": "groq/compound"
                    })
            except Exception as err:
                print(f"Groq API Exception: {err}. Using Smart Advisor Engine...")

        # 3. Smart Advisor Engine (Graceful Offline / Unconfigured Key Fallback)
        smart_reply = generate_smart_fallback_response(last_user_msg)
        return jsonify({
            "role": "assistant",
            "content": smart_reply,
            "model": "WealthWise Smart Advisor Engine"
        })

    except Exception as e:
        return jsonify({"error": f"Application Error: {str(e)}"}), 500

def generate_smart_fallback_response(user_query: str) -> str:
    """Generates structured financial guidance when external AI API keys are unconfigured or invalid."""
    q_lower = user_query.lower()

    if "invest" in q_lower or "mutual fund" in q_lower or "stock" in q_lower:
        return """📊 **WealthWise Investment Research Breakdown**:

1. **Low Risk (Capital Preservation)**:
   - **Public Provident Fund (PPF)**: 15-year lock-in, sovereign guarantee, ~7.1% tax-free returns.
   - **Fixed Deposits (FD)**: Fixed guaranteed returns (6.5% - 7.5%), high liquidity.

2. **Medium Risk (Balanced Growth)**:
   - **Large-Cap & Nifty 50 Index Funds**: Low expense ratio, historical 11-13% long-term CAGR.
   - **Balanced Advantage Funds**: Dynamic equity/debt rebalancing.

3. **High Risk (Aggressive Capital Appreciation)**:
   - **Flexi-Cap & Mid/Small-Cap Equity Funds**: Potential 14-18% returns with higher short-term volatility.

⚠️ *Mandatory Disclaimer: All investments are subject to market risks. Consult a SEBI-registered Investment Adviser for personalized securities advice.*

---
💡 *Note: To connect live Google Gemini AI generation, update `GEMINI_API_KEY` in your `.env` file with a valid API key from Google AI Studio.*"""

    elif "loan" in q_lower or "emi" in q_lower or "debt" in q_lower:
        return """💳 **WealthWise Debt & Loan Strategy**:

1. **Affordability Benchmark**: Keep your total monthly EMIs below **35-40%** of your net monthly salary.
2. **Repayment Acceleration**:
   - **Debt Snowball**: Pay off smallest balances first for psychological momentum.
   - **Debt Avalanche**: Pay off highest interest rate debts (e.g. credit cards at 36-42%) first to minimize total interest.
3. **Prepayment Tip**: Making just 1 extra EMI payment per year reduces a 20-year home loan duration by ~4 years!

---
💡 *Note: To connect live Google Gemini AI generation, update `GEMINI_API_KEY` in your `.env` file with a valid API key from Google AI Studio.*"""

    elif "emergency" in q_lower or "safety net" in q_lower:
        return """🛡️ **Emergency Fund Strategy**:

1. **Target Fund Size**: 3 to 6 months of essential living expenses (Rent + Groceries + Utilities + EMIs).
2. **Ideal Allocation**:
   - 50% in a High-Yield Savings Account (Immediate Liquidity).
   - 50% in Liquid Mutual Funds / Instant Redemption FDs.
3. **Rule of Thumb**: Never invest your emergency fund in volatile stocks or locked-in tax funds.

---
💡 *Note: To connect live Google Gemini AI generation, update `GEMINI_API_KEY` in your `.env` file with a valid API key from Google AI Studio.*"""

    else:
        return f"""💡 **WealthWise Financial Advisory Guidance**:

Thank you for your query regarding: *"{user_query}"*.

**Core Recommendations**:
• **Budgeting Rule (50/30/20)**: Allocate 50% to essential needs (Rent, Food), 30% to discretionary wants, and at least 20% to savings & debt reduction.
• **Expense Monitoring**: Review recurring dining out and subscription expenses monthly to unlock extra savings.
• **Automated Wealth Building**: Automate 20% of your income to transfer into high-priority savings or index funds on salary day.

---
💡 *Key Setup Notice: To enable real-time live AI generation from Google Gemini, replace `your_gemini_api_key_here` in your `.env` file with a valid API key from Google AI Studio (https://aistudio.google.com).*"""

def run_server():
    active_key = GEMINI_API_KEY or GROQ_API_KEY
    print(f"=== Personal Finance Advisor Bot (Flask) ===")
    print(f"Gemini Key loaded: {bool(GEMINI_API_KEY and GEMINI_API_KEY != 'your_gemini_api_key_here')}")
    print(f"Server running at http://localhost:{PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=True)

if __name__ == "__main__":
    run_server()
