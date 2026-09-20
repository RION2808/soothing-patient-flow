# CareFlow Suite
# CureOps 🏥🤖
### *Streamlining Emergency Triage & Resource Allocation with Predictive Operations*

## 🚀 Overview
**CureOps** is an intelligent, dynamic Hospital Management System (HMS) designed to optimize emergency room queues, allocate medical staff efficiently, and prevent resource shortages before they happen. By integrating the **Emergency Severity Index (ESI)** with automated inventory tracking and real-time resource shifting, CureOps minimizes patient wait times and ensures critical cases receive immediate care.

---

## ✨ Key Features

### 1. Dynamic Urgency Triage & Queuing
Classifies patients based on the 5-level ESI framework into localized priority queues:
*   🟢 **Green Queue (Levels 1-2):** Managed via a strictly optimized First-Come, First-Served (FCFS) workflow.
*   🟡 **Yellow Queue (Levels 3-4):** Introduces a dynamic threshold-skipping protocol to guarantee priority treatment.
*   🔴 **Red Queue (Level 5):** High-priority normal queue with instant override triggers for extreme critical emergencies.

### 2. Intelligent Resource & Staff Allocation
Dynamically maps medical expertise and resources to patient volumes:
*   **Tiered Staffing Matrix:** 
    *   **Red Tier:** Senior, highly experienced doctors & nurses.
    *   **Yellow Tier:** Mid-level experienced medical staff.
    *   **Green Tier:** Interns and newly onboarded nurses.
*   **Fluid Staff Deployment:** Doctors and interns float dynamically between tiers (e.g., Red docs cascading to Yellow/Green, or interns stepping up to Yellow) based on emergency thresholds.
*   **Freeform Asset Shifting:** Physical beds can be re-allocated across triage levels instantly based on localized demand.

### 3. Smart Inventory & IoT Resource Tracking
*   **RTLS Integration:** Uses Real-Time Location Systems to track mobile physical equipment.
*   **ADT Bed Management:** Integrates Admission, Discharge, and Transfer logs directly into the core HMS.
*   **AI Predictor Module:** Pre-emptively forecasts upcoming patient influxes ("chaos windows") and triggers automated stock replenishment alerts for medicine and consumables.

### 4. Resilient Edge-Case Routing
*   **Cross-Hospital Bed Exchange:** Automatically polls neighboring medical facilities if bed capacity hits 100%. 
*   **In-Transit Triage:** Resolves matching-category patient conflicts while an ambulance is en route by comparing clinical symptom severity.
*   **Staff Deficiency Backstop:** If free beds are available but doctors are bottlenecked, the system immediately dispatches trained nurses to initiate baseline stabilizer workflows.

---

## 🛠️ Architecture & Workflow

1. **Intake UI:** Symptoms are inputted at the reception or ambulance UI, which immediately provisions an automated room and doctor assignment via CureOps.
2. **Triage Processor:** Evaluates symptoms against the ESI scale, tagging the patient as Red, Yellow, or Green.
3. **Queue Manager:** Handles the real-time sorting and prioritization rules.
4. **Resource Broker:** Queries live inventory and RTLS data to assign equipment, beds, and fluid staff.

---

## 💻 Proposed Tech Stack
*   **Frontend:** React / Next.js (For the instant Symptom-Intake UI and Live Dashboard)
*   **Backend:** Node.js / FastAPI
*   **Database:** PostgreSQL (For transactional patient/queue logs) + Redis (For low-latency queue states)
*   **AI/Predictive Analytics:** Python (Scikit-learn / XGBoost) for hospital chaos forecasting

AI models used:
ChatGPT, Gemini for reasearch purposes.
Lovable for making the webpage
Claude for adding final touches to the web


Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
