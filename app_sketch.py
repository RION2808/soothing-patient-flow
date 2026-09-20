import math
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///hospital.db'
db = SQLAlchemy(app)

# --- Erlang-B Calculation ---
def calculate_erlang_b(servers, load):
    """
    Computes blocking probability B(c, a).
    Iterative approach to avoid large factorials.
    """
    inv_b = 1.0
    for i in range(1, servers + 1):
        inv_b = 1.0 + (i / load) * inv_b
    return 1.0 / inv_b

# --- Triage Logic ---
def evaluate_triage(vitals):
    """
    Simplified Emergency Severity Index (ESI) logic.
    """
    # Level 1: Immediate life-saving intervention needed
    if vitals.get('immediate_threat', False):
        return 1
    
    # Level 2: High risk situation
    if vitals.get('high_risk', False) or vitals.get('pain_level', 0) >= 8:
        return 2
    
    # Level 3-5 based on resources (simplified for demo)
    resources = vitals.get('expected_resources', 0)
    if resources >= 2:
        return 3
    elif resources == 1:
        return 4
    return 5

# --- API Routes ---
@app.route('/api/capacity/erlang-b', methods=['POST'])
def erlang_b_api():
    data = request.json
    try:
        c = int(data['servers'])
        a = float(data['load'])
        blocking_prob = calculate_erlang_b(c, a)
        return jsonify({
            "blocking_probability": round(blocking_prob, 4),
            "service_level": round(1 - blocking_prob, 4)
        })
    except (KeyError, ValueError, ZeroDivisionError):
        return jsonify({"error": "Invalid inputs"}), 400

@app.route('/api/triage/evaluate', methods=['POST'])
def triage_api():
    data = request.json
    level = evaluate_triage(data)
    return jsonify({"triage_level": level})

if __name__ == '__main__':
    app.run(debug=True)
