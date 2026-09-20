# Hospital Dashboard: PyCharm Deliverable Architecture

## 1. Project Structure
```text
hospital-dashboard-python/
├── app/
│   ├── __init__.py          # Flask app factory
│   ├── routes.py           # API endpoints
│   ├── models.py           # SQLAlchemy / SQLite models
│   ├── services/           # Business logic
│   │   ├── __init__.py
│   │   ├── triage.py       # Triage scoring logic
│   │   └── queuing.py      # Erlang-B & capacity formulas
│   └── utils/
│       └── validation.py   # Input validation helpers
├── tests/                  # Unit and integration tests
├── .env                    # Environment variables
├── config.py               # Application configuration
├── requirements.txt        # Dependencies
└── run.py                  # Entry point
```

## 2. Essential API Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/triage/stats` | Returns current patient counts by triage level (1-5) |
| POST | `/api/triage/evaluate` | Evaluates vitals and returns recommended triage level |
| GET | `/api/capacity/metrics` | Current bed occupancy and staff-to-patient ratios |
| POST | `/api/capacity/erlang-b` | Calculates blocking probability based on arrival rates |

## 3. Core Formulas

### Triage Scoring (Simplified ESI)
- **Input:** `vitals` (HR, RR, SpO2, Temp), `acuity_indicators`
- **Logic:**
  1. Priority 1: If `requires_intervention == True`
  2. Priority 2: If `high_risk == True` OR `vitals_danger_zone == True`
  3. Priority 3: Based on expected resource consumption (2+)
  4. Priority 4/5: Minimal resources.

### Erlang-B (Blocking Probability)
Used for resource planning (e.g., "Will we run out of beds?"):
2109B(c, a) = \frac{\frac{a^c}{c!}}{\sum_{k=0}^{c} \frac{a^k}{k!}}2109
- **c**: Number of servers (Beds/Doctors)
- **a**: Offered load (Arrival Rate $\times$ Mean Service Time)

## 4. PyCharm Setup Commands
```bash
# 1. Create virtual environment
python -m venv venv

# 2. Activate environment
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate

# 3. Install core dependencies
pip install flask flask-sqlalchemy flask-cors numpy marshmallow

# 4. Generate requirements file
pip freeze > requirements.txt
```
