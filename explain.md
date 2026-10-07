# Confidence-Based Hybrid ML Framework for Network Intrusion Detection
## Complete Project Explanation — Viva / Presentation Guide

> **Language:** Simple English for MCA viva/presentation.
> **All facts are confirmed** from the actual project code, trained models, and experiment config.
> Where a concept is general ML knowledge, it is clearly marked *[General ML]*.

---

## 1. Project Overview

This project is a **Network Intrusion and Attack Detection System**. Its job is to look at network traffic data and automatically decide whether that traffic is **normal** (safe) or an **attack** (dangerous). If it is an attack, the system also tells you how dangerous it is — High Risk, Moderate Risk, or Low Risk.

Think of it like a security guard at the gate of a building. Every person (network packet) that comes in gets checked. The guard knows from past experience what a suspicious visitor looks like, and raises an alarm if something seems wrong.

The system is built using **machine learning** — meaning the computer learns attack patterns from real historical data, so it can recognize them automatically in the future.

---

## 2. Problem Statement

Every day, thousands or millions of network packets flow through computer networks. Most of them are normal — someone browsing a website, downloading a file, or sending an email. But some packets are sent by attackers who want to crash servers (DoS/DDoS), scan for open ports, steal passwords (Brute Force), or plant malware (Botnet).

**The problem is:** It is impossible for a human to manually check every single packet. We need an automated, intelligent system that can:
- Analyze prepared network-flow data from CSV files rather than claiming live packet monitoring
- Work on flow statistics, not full packet contents
- Give an estimated score and triage category to help security teams prioritize review

---

## 3. Objective

The objective of this project is to:

1. Evaluate Logistic Regression and Random Forest in two independent network-intrusion experiments: the primary Suricata testbed and the secondary CIC-IDS-2017 dataset
2. Build experiment-specific inference workflows for prepared CSV input and saved results
3. Combine calibrated model scores within each experiment and assign triage/risk categories using that experiment’s configuration
4. Compare the independent results and provide a separate cross-experiment inference component
5. Present the research outputs in dashboards for Security Operations Center (SOC) alert-triage review

---

## 4. Dataset — CIC-IDS-2017

The dataset used is the **Canadian Institute for Cybersecurity Intrusion Detection System 2017 dataset**, commonly called **CIC-IDS-2017**.

**What is it?**
Researchers at the University of New Brunswick set up a real network lab. They generated normal internet traffic (web browsing, file downloads, email) and also launched real attacks (DoS, DDoS, Port Scanning, Brute Force, Web Attacks, Botnet). They recorded every network "flow" — a summary of what happened between two computers during a connection — and labeled each flow as either BENIGN (normal) or by the attack name.

**Key numbers in this project:**

| Split | Rows | Purpose |
|---|---|---|
| Training | 49,053 | Teach the models |
| Calibration | 10,443 | Tune probability scores |
| Validation (Tuning) | 10,504 | Select best threshold and weights |
| **Test (Unseen)** | **30,000** | **Final evaluation — never seen during training** |

**Attack types in the training data:**

| Attack | Training Rows | What it does |
|---|---|---|
| BENIGN | 56,567 | Normal traffic |
| DoS Hulk | 5,511 | Floods a web server with requests |
| PortScan | 3,920 | Scans a machine to find open ports |
| DDoS | 3,032 | Distributed flooding from many machines |
| DoS GoldenEye | 236 | Another DoS variant |
| FTP-Patator | 195 | Brute-force login attempts on FTP |
| SSH-Patator | 166 | Brute-force login attempts on SSH |
| DoS Slowhttptest | 135 | Slow HTTP DoS attack |
| DoS slowloris | 134 | Keeps connections open to exhaust server |
| Web Attack – Brute Force | 43 | Guesses web login passwords |
| Bot | 36 | Botnet/malware communication |
| Web Attack – XSS | 24 | Cross-site scripting injection |
| Infiltration | 1 | Advanced persistent threat simulation |

**Important note:** The dataset captures network flow statistics — not the actual content of packets. This means the system works on numbers like "how many packets were sent" rather than reading emails or files. This is privacy-safe and computationally efficient.

---

## 5. Network Flow Features

### What is a "network flow"?

A **network flow** is a summary of a complete conversation between two computers. Just like how a phone call record tells you who called, when, for how long, and how many words were spoken — a network flow record summarizes a network connection.

This project uses **12 features** extracted from each flow:

---

### Feature 1: Source Port
**What it is:** The port number on the sender's machine.
**Simple explanation:** Think of a port as a "door number" on a computer. Port 80 is the web door, port 22 is the SSH (remote access) door. Attackers often use random high-numbered ports (above 49,152) as their source.

**Training data fact:**
- Normal traffic: median source port = 51,583
- Attack traffic: median source port = 48,262

---

### Feature 2: Destination Port
**What it is:** The port number on the receiver's machine (the target).
**Simple explanation:** The door the attacker is trying to enter. Common targets: port 80 (web), port 21 (FTP), port 22 (SSH), port 53 (DNS).

**Training data fact:**
- Both normal and attack: median = 80 (most traffic targets port 80)

---

### Feature 3: Total Fwd Packets
**What it is:** How many packets the sender (client) sent to the receiver (server).
**Simple explanation:** In a normal web page load, you send a small request and get a big response back. In a DoS attack, you send millions of tiny requests.

**Training data fact:**
- Normal: median = 2 packets (small request)
- Attack: median = 3 packets (slightly higher for attack flows)

---

### Feature 4: Total Backward Packets
**What it is:** How many packets the server sent back to the client.
**Simple explanation:** In normal traffic, the server responds with data. In a DoS flood, the server may not respond at all, so backward packets are very low.

**Training data fact:**
- Normal: median = 2 backward packets
- **Attack: median = 1 backward packet** — attacks are mostly one-directional (attacker sends, server barely responds)

---

### Feature 5: Total Length of Fwd Packets
**What it is:** Total number of bytes the client sent.
**Simple explanation:** How much data did the attacker actually send? DoS floods send tiny packets (low bytes), while normal file uploads send large packets (high bytes).

**Training data fact:**
- Normal: median = 66 bytes
- Attack: median = 26 bytes (attacks send less data per flow)

---

### Feature 6: Total Length of Bwd Packets
**What it is:** Total number of bytes the server sent back.
**Simple explanation:** Did the server actually respond with real data? In a DoS attack, the server is overwhelmed and sends almost nothing back.

**Training data fact:**
- Normal: median = 130 bytes
- **Attack: median = 6 bytes** — almost no server response in attack traffic

---

### Feature 7: total_packets
**What it is:** Total packets in both directions (fwd + backward).
**Simple explanation:** The total size of the conversation in terms of packet count.

**Training data fact:**
- Normal: median = 4 total packets
- Attack: median = 5 total packets

---

### Feature 8: total_bytes
**What it is:** Total bytes transferred in both directions.
**Simple explanation:** The total data volume of the entire flow. Attack flows are very small because each attack packet is tiny.

**Training data fact:**
- Normal: median = 219 bytes
- **Attack: median = 30 bytes** — this is one of the strongest indicators of an attack

---

### Feature 9: bytes_per_packet
**What it is:** Average size of each packet in bytes (total_bytes ÷ total_packets).
**Simple explanation:** In normal web browsing, each packet carries a decent amount of data (a web page, an image). In DoS attacks, each packet is extremely tiny — just a header with almost no content. This is the **single most important feature** for attack detection in this model.

**Training data fact:**
- Normal: median = **63 bytes per packet**
- **Attack: median = 6 bytes per packet** — 10x smaller than normal

> **This is why:** If your test CSV has bytes_per_packet = 500 to 1500, the model will classify it as Normal. That is correct behavior — 500–1500 bytes per packet looks exactly like normal web traffic to this model.

---

### Feature 10: packet_asymmetry_ratio
**What it is:** The ratio of forward packets to backward packets, showing how unbalanced the conversation is.
**Simple explanation:** A normal conversation is balanced — you send a request, server sends a response. An attack is unbalanced — attacker sends many packets, server sends almost none.

**Training data fact:**
- Normal: median = 1.0 (balanced)
- Attack: median = 1.0 (similar — this feature is less discriminative alone)

---

### Feature 11: hour_of_day
**What it is:** The hour when the network flow happened (0 = midnight, 12 = noon).
**Simple explanation:** Attacks in CIC-IDS-2017 were launched during specific hours. This helps the model learn temporal patterns.

**Training data fact:**
- Normal: median hour = 4
- Attack: median hour = 4 (similar — weak signal alone)

---

### Feature 12: day_of_week
**What it is:** The day of the week the flow occurred (0=Monday, 4=Friday).
**Simple explanation:** In CIC-IDS-2017, attacks were concentrated on specific days of the week (Thursday and Friday = day 3 and 4 in zero-indexed format).

**Training data fact:**
- Normal: median = 2 (Wednesday)
- **Attack: median = 4 (Friday)** — attacks cluster on later weekdays

---

## 6. Data Preprocessing

### What is preprocessing?

Before feeding data to a machine learning model, we need to clean and standardize it. Think of it as preparing ingredients before cooking.

### Step 1: Label Creation
The original dataset has a "Label" column with values like "BENIGN", "DoS Hulk", "PortScan", etc.

We convert this into a **binary label**:
- BENIGN → **0** (Normal)
- Any attack type → **1** (Attack)

The original attack names are kept separately for reference (we call this the multiclass label), but the model only learns 0 or 1.

### Step 2: Feature Selection
From the 13 columns in the CSV (12 features + 1 label), we take only the 12 input features listed above. The Label column is **never given to the model as input** — that would be cheating (called data leakage).

### Step 3: Data Splitting
The 70,000 training rows are split into three non-overlapping groups using a feature-group-stratified method (rows with identical feature patterns never appear in more than one group):
- **Training set (49,053 rows):** Used to teach the models
- **Calibration set (10,443 rows):** Used to make probability scores more reliable
- **Validation/Tuning set (10,504 rows):** Used to choose the best threshold and weights
- **Test set (30,000 rows):** Kept completely unseen until the final evaluation

### Step 4: StandardScaler (only for Logistic Regression)
Logistic Regression is sensitive to the scale of numbers. For example, Source Port values are in the range 0–65,535, but hour_of_day is only 0–12. This difference confuses LR.

We use **StandardScaler** to normalize: subtract the mean and divide by the standard deviation, so all features are on the same scale.

**Random Forest does NOT need scaling** — it works with raw numbers because it uses comparison rules ("is bytes_per_packet less than 10?"), not distance calculations.

---

## 7. Model Training

Two completely separate machine learning models are trained:

1. **Logistic Regression (LR)** — a simple, fast, linear model
2. **Random Forest (RF)** — a powerful, complex, tree-based model

Both models are trained only on the training set. They never see the test set during training.

After training, both models are **calibrated** using the calibration set. Calibration means we adjust the raw probability scores to make them more accurate and reliable.

This project uses **isotonic regression calibration** — a method that maps raw model scores to more trustworthy probability values. The key point: calibrated scores are closer to the true probability of an attack than raw model outputs.

---

## 8. Logistic Regression

### What is it? *[General ML concept with project-specific details]*

Logistic Regression is one of the simplest machine learning algorithms. Despite having "regression" in its name, it is used for **classification** (deciding between two classes).

**Simple analogy:** Imagine you want to predict whether a student will pass or fail based on their marks. You draw a single straight line through a graph of marks vs pass/fail. LR does the same thing — it finds the best straight line (or plane in multiple dimensions) that separates normal traffic from attack traffic.

### How it learns:
LR looks at all 12 features and assigns a **weight** (importance score) to each one. For example:
- bytes_per_packet might get a high weight (very important)
- hour_of_day might get a low weight (less important)

During training, it adjusts these weights to minimize mistakes on the training data.

### Output:
LR outputs a **probability between 0 and 1**:
- Close to 0 = probably Normal
- Close to 1 = probably Attack

### Project configuration:
- Solver: lbfgs (efficient optimizer)
- C = 1.0 (regularization strength — prevents overfitting)
- class_weight = balanced (automatically handles the imbalance between 80% normal and 20% attack rows)
- max_iter = 1000 (maximum training steps)

### Project performance on test set:
- Accuracy: 83.1%
- Recall: 76.9% (detects 77 out of 100 actual attacks)
- Precision: 55.1% (some false alarms)
- AUC: 0.894

### Why LR is not great here:
The relationship between network features and attack types is **not linear**. For example, bytes_per_packet = 6 could mean an attack, but so could bytes_per_packet = 900 in certain contexts. LR struggles with these complex, non-linear boundaries.

---

## 9. Random Forest

### What is it? *[General ML concept with project-specific details]*

A Random Forest is a collection of many **Decision Trees** working together. Each tree votes, and the majority vote wins.

**Simple analogy:** Imagine asking 300 different doctors for a diagnosis. Each doctor looks at the patient slightly differently (different subset of symptoms). You go with whatever most doctors agree on. That is a Random Forest.

### What is a Decision Tree?

A decision tree is a series of Yes/No questions:
```
Is bytes_per_packet < 10?
├── YES → Is total_bytes < 50?
│         ├── YES → ATTACK (very likely a flood)
│         └── NO  → Maybe Attack
└── NO  → Is Destination Port = 80?
          ├── YES → Probably Normal (web traffic)
          └── NO  → Check more features...
```

### How Random Forest works:
- Trains 300 independent decision trees (n_estimators = 300 in this project)
- Each tree sees a random subset of the training data and a random subset of features
- This randomness prevents any single tree from memorizing the training data (overfitting)
- At prediction time, all 300 trees vote, and the proportion of votes becomes the probability

### Output:
Just like LR, RF outputs a **probability between 0 and 1** for each row.

### Project configuration:
- n_estimators = 300 (300 trees)
- max_depth = None (trees grow until pure — no depth limit)
- min_samples_leaf = 2 (each leaf must have at least 2 training samples)
- class_weight = balanced (handles class imbalance)

### Project performance on test set:
- Accuracy: **99.86%**
- Recall: **99.66%** (detects nearly all actual attacks)
- Precision: **99.63%** (almost no false alarms)
- AUC: **0.9995**

### Why RF is much better than LR here:
RF can learn complex, non-linear patterns. It can say: "if bytes_per_packet is very small AND total_bytes is very small AND day_of_week is 4, this is almost certainly an attack." LR cannot combine conditions this way.

---

## 10. Hybrid Prediction

### Why combine two models?

The idea is: two models are better than one. Each model may catch different patterns. By combining them, we create a more robust final prediction.

### How the Hybrid Score is calculated:

```
Hybrid Score = (w_LR × LR_calibrated_probability) + (w_RF × RF_calibrated_probability)
```

Where:
- `w_LR` = weight given to Logistic Regression
- `w_RF` = weight given to Random Forest
- `w_LR + w_RF = 1.0` (they must add up to 1)

### Project's actual weights (confirmed from config):
```
w_LR = 0.00
w_RF = 1.00
```

So: `Hybrid Score = 0.00 × LR_prob + 1.00 × RF_prob = RF_prob`

This means the Hybrid Score in this project is **exactly equal to the RF calibrated probability**.

### Why w_LR = 0?

This is **not a bug**. The project uses a **grid search** on the validation set to automatically find the best weights. It tried all combinations: (0.1, 0.9), (0.2, 0.8), (0.3, 0.7), all the way to (0.9, 0.1). It picked the combination that gives the **best F1 score** on the validation data.

The result was w_LR = 0.0, w_RF = 1.0 — meaning Random Forest alone is so good on these 12 features that adding LR's weaker probability actually reduces overall performance. The system automatically discovered this and set LR's weight to zero.

This is honest, data-driven decision-making, not a mistake.

### Why keep LR at all?

LR is still useful for:
1. Comparison and research — shows how much better RF is
2. Future dataset where LR might contribute more
3. Interpretability — LR's weights explain which features matter most

---

## 11. Attack/Normal Decision Threshold

### What is a threshold?

After computing the Hybrid Score (a number between 0 and 1), we need to make a binary decision: is this Normal (0) or Attack (1)?

We do this by comparing the score to a **threshold**:
```
If Hybrid Score >= threshold → ATTACK
If Hybrid Score <  threshold → NORMAL
```

### Project's actual threshold: 0.4536

This value was found automatically by the project. The validation set was used to try all possible threshold values (from 0.01 to 0.99 in small steps). The threshold that gave the **best F1 score** on the validation set was selected: **0.4536**.

**Why not simply use 0.5?**

0.5 is just an assumption. The actual RF model assigns very high probabilities (close to 1.0) to most attacks and very low probabilities (close to 0.0) to most normal traffic. The threshold can therefore be placed at 0.4536 and still perfectly separate the two groups on this dataset.

**Important:** This threshold is optimal for the CIC-IDS-2017 distribution. For a completely different dataset with different traffic patterns, a different threshold would need to be learned.

---

## 12. Risk Classification

After the Attack/Normal decision, each row is also given a **risk level** based on how high the Hybrid Score is:

| Hybrid Score | Risk Level | Meaning |
|---|---|---|
| Score ≥ 0.70 | 🔴 **High Risk** | Very likely attack, confident detection — immediate action required |
| 0.40 ≤ Score < 0.70 | 🟡 **Moderate Risk** | Probable attack but less certain — review and monitor |
| Score < 0.40 | 🟢 **Low Risk** | Likely normal traffic — log for audit, no immediate action |

### What these mean for a SOC analyst:

**High Risk (≥ 0.70):**
The model is very confident this is an attack. The RF gave it a probability of 70% or higher. Treat it as a confirmed threat. Block the IP, trigger an incident response.

**Moderate Risk (0.40–0.70):**
The model suspects an attack but is not certain. Could be a borderline case — perhaps an unusual legitimate user, or an attack the model has seen less of (like Botnet, which had only 36 training examples). Investigate further before blocking.

**Low Risk (< 0.40):**
The model is confident this is normal traffic. Keep a log, but no immediate action needed.

---

## 13. Complete Prediction Workflow

When a new CSV file is uploaded to the dashboard, here is exactly what happens step by step:

### Step 1: File Upload
User uploads a CSV file through the dashboard interface.

### Step 2: Parse and Read
The system reads the CSV file using pandas (a Python data library).

### Step 3: Feature Validation
The system checks: does the CSV have all 12 required columns?
```
Required: Source Port, Destination Port, Total Fwd Packets,
          Total Backward Packets, Total Length of Fwd Packets,
          Total Length of Bwd Packets, total_packets, total_bytes,
          bytes_per_packet, packet_asymmetry_ratio, hour_of_day, day_of_week
```
If any column is missing, the system shows an error message listing the missing columns.

### Step 4: Extra Columns are Ignored
If the CSV has extra columns like "Attack Type", "Risk Level", or "Label", they are **completely ignored** as model inputs. Only the 12 feature columns are passed to the models.

This is critically important — using "Attack Type" as an input would be **data leakage** (see Section 17).

### Step 5: Extract Feature Matrix
The 12 feature columns are extracted as a numeric matrix. Missing (NaN) values are filled with 0.

### Step 6: LR Inference (with StandardScaler)
The feature matrix is passed to the Logistic Regression pipeline. Inside the pipeline:
1. StandardScaler transforms the values (subtracts mean, divides by std — using the scaler fitted on training data)
2. The scaled values go into the LR model
3. Output: LR raw probability for each row (probability of being Attack = class 1)

### Step 7: RF Inference (no scaling)
The same raw feature matrix (not scaled) is passed directly to the Random Forest.
Output: RF raw probability for each row

### Step 8: Probability Calibration
Both raw probabilities go through their respective **CalibratedClassifierCV** models (isotonic calibration). This converts raw model scores into more reliable probability estimates.

### Step 9: Hybrid Score Computation
```
Hybrid Score = 0.00 × LR_calibrated_prob + 1.00 × RF_calibrated_prob
             = RF_calibrated_prob
```

### Step 10: Attack/Normal Decision
```
If Hybrid Score >= 0.4536 → Prediction = ATTACK (1)
If Hybrid Score <  0.4536 → Prediction = NORMAL (0)
```

### Step 11: Risk Level Assignment
```
If Hybrid Score >= 0.70  → High Risk
If Hybrid Score >= 0.40  → Moderate Risk
If Hybrid Score <  0.40  → Low Risk
```

### Step 12: Results Stored
All columns — LR probability, RF probability, calibrated scores, Hybrid Score, prediction, and risk level — are added to the DataFrame.

### Step 13: Dashboard Display
The dashboard reads these results and displays KPI cards, charts, and tables.

---

## 14. Dashboard Workflow

The repository has three dashboard interfaces. Two Python Dash apps inspect saved experiment artifacts: the primary app at `apps/primary-dashboard/dashboard.py` reads `artifacts/primary/`, and the secondary app at `apps/secondary-dashboard/secondary_soc_dashboard.py` reads `artifacts/secondary/`. They run independently (ports 8050 and 8051) and should be opened after their matching experiment outputs have been generated.

The consolidated research frontend is the Next.js app in `apps/web-dashboard/`. It gives access to the Home, Overview, Suricata Testbed, CIC-IDS-2017, Cross-Experiment Ensemble, Comparison, Feature Analysis, Performance, Prediction Results, and Configuration pages. The two dataset experiments remain distinct; the ensemble page represents the separate cross-experiment inference workflow and its own combined input schema.

The web dashboard's API adapter uses demonstration responses by default when `NEXT_PUBLIC_API_URL` is not set. No HTTP backend/API service is included in this repository. If a compatible external API is configured, the frontend expects health, overview, primary/secondary prediction and configuration, comparison, and ensemble prediction routes. An environment variable only points to that external API; it does not create or launch one.

### What users see

- Experiment-specific pages show saved results for the corresponding dataset, with dataset context.
- Comparison and evaluation pages summarize previously saved metrics and plots.
- CSV inference controls validate the expected input schema before processing.
- In mock mode, uploaded-file responses are demonstration output and should be labeled as such; they are not evidence of a live API call or newly trained model.
- The UI describes model scores as estimates and presents triage categories with text labels as well as color.

### Theme behavior

The Next.js dashboard supports dark and light themes through shared CSS custom properties in `apps/web-dashboard/src/app/globals.css`. On first visit, a small initialization script reads the operating-system color preference and sets the theme before rendering. The navigation toggle switches themes and saves the selected value in browser local storage as `soc-dashboard-theme`, so it remains selected after reload. When no saved choice exists, later operating-system preference changes are followed. Theme tokens cover shared surfaces, text, borders, risk/model colors, chart labels and grids, and tooltips; keyboard focus remains visible in either theme. The toggle has a descriptive accessible name and supports keyboard activation.

### Start the web dashboard

```bash
cd apps/web-dashboard
npm install
npm run dev
```

Open `http://localhost:3000/home`. Use `npm run lint`, `npx tsc --noEmit`, and `npm run build` for frontend checks.

## 15. Example of Normal Traffic

**Scenario:** A user browses a website (connects from their computer to a web server on port 80).

**CSV Row (feature values):**
```
Source Port:                  54321  (random high port, user's browser)
Destination Port:             80     (web server port)
Total Fwd Packets:            3      (user sent: GET request, ACK, FIN)
Total Backward Packets:       4      (server responded: SYN-ACK, HTML page, ACK, FIN)
Total Length of Fwd Packets:  120    (small request — 120 bytes total)
Total Length of Bwd Packets:  4800   (server sent back a web page — 4800 bytes)
total_packets:                7      (3 + 4)
total_bytes:                  4920   (120 + 4800)
bytes_per_packet:             702.9  (4920 / 7 — each packet carries real data)
packet_asymmetry_ratio:       0.75   (slightly server-heavy — normal for web)
hour_of_day:                  14     (2 PM — normal working hours)
day_of_week:                  1      (Tuesday)
```

**Journey through the pipeline:**

1. Feature validation: all 12 columns present ✓
2. LR raw probability: ~0.18 (LR thinks 18% chance of attack)
3. RF raw probability: ~0.02 (RF thinks only 2% chance of attack)
4. LR calibrated: ~0.05
5. **RF calibrated: ~0.02**
6. **Hybrid Score = 0.02** (pure RF weight)
7. Threshold comparison: 0.02 < 0.4536 → **Prediction = NORMAL**
8. Risk level: 0.02 < 0.40 → **Low Risk**
9. Dashboard shows: Normal, Low Risk (green)

---

## 16. Example of Attack Traffic

**Scenario:** A DoS Hulk attack — attacker sends thousands of tiny HTTP requests to flood a web server.

**CSV Row (feature values based on actual CIC-IDS-2017 training data):**
```
Source Port:                  52180  (attacker's ephemeral port)
Destination Port:             80     (target: web server)
Total Fwd Packets:            2      (attacker sent only 2 small packets)
Total Backward Packets:       1      (server barely responded — just 1 packet)
Total Length of Fwd Packets:  12     (very tiny — attack packets carry almost no data)
Total Length of Bwd Packets:  0      (server sent nothing back — overwhelmed)
total_packets:                3      (2 + 1)
total_bytes:                  12     (barely anything transferred)
bytes_per_packet:             4.0    (12 bytes ÷ 3 packets — EXTREMELY small)
packet_asymmetry_ratio:       2.0    (attacker sent 2x more packets than server)
hour_of_day:                  10     (mid-morning)
day_of_week:                  4      (Friday — attacks in CIC-IDS-2017 cluster here)
```

**Journey through the pipeline:**

1. Feature validation: all 12 columns present ✓
2. LR raw probability: ~0.89 (LR suspects attack)
3. RF raw probability: ~0.98 (RF is highly confident it is an attack)
4. LR calibrated: ~0.91
5. **RF calibrated: ~0.99**
6. **Hybrid Score = 0.99** (pure RF weight)
7. Threshold comparison: 0.99 ≥ 0.4536 → **Prediction = ATTACK**
8. Risk level: 0.99 ≥ 0.70 → **High Risk**
9. Dashboard shows: Attack, High Risk (red)

---

## 17. Why the Model May Predict Normal for an Attack-Labeled CSV Row

### The core reason: The model was trained on CIC-IDS-2017 statistics

The Random Forest learned attack patterns from the **actual numerical distributions** in CIC-IDS-2017. It does not learn from labels like "DoS" or "DDoS" — it learns from the actual numbers.

### What the model actually learned:

The RF learned rules like:
- "If bytes_per_packet < 10 AND total_bytes < 50 → very likely Attack"
- "If bytes_per_packet > 200 AND total_bytes > 5000 → very likely Normal"

### Why a manually labeled attack row may still be predicted as Normal:

**Example of the problem:**
Suppose someone creates a test CSV and writes:
```
bytes_per_packet = 1200
total_bytes = 50000
Attack Type = "DoS Attack"
```

The person labeled it as a DoS Attack manually, but the numbers say otherwise.

In CIC-IDS-2017, **real DoS attacks have**:
- bytes_per_packet median = **6** (not 1200)
- total_bytes median = **30** (not 50,000)

When the RF sees bytes_per_packet = 1200 and total_bytes = 50,000, it recognizes this as normal web traffic (like loading a big image), not a DoS attack. **The model is correct** — those numbers do not match any attack pattern it learned.

**The label "DoS Attack" in your CSV is just a text string.** The model never reads it. Only the 12 numbers are given to the model.

### The solution:
Use test data whose numerical values are sampled from the **actual CIC-IDS-2017 training distribution**. The project provides `data/samples/test_data_model_compatible.csv` for this purpose.

### Why is this NOT data leakage prevention?

This is a different concept. Data leakage means **accidentally using future or target information as an input feature**. Not giving the "Attack Type" label to the model is correct and intentional — it is the label we are trying to predict, not a feature.

### What IS data leakage?

If we gave the "Attack Type" column to the model as an input, the model would simply learn: "whenever Attack Type = DoS, output 1". This is not learning — it is memorizing the answer. The model would fail completely on real-world data where the attack type is unknown.

---

## 18. Advantages of the Proposed System

1. **High accuracy:** Random Forest achieves 99.86% accuracy on 30,000 unseen test rows
2. **Very low false negatives:** Only 20 out of 5,922 real attacks were missed (FN = 20)
3. **Privacy-preserving:** Works on network flow statistics, not packet content — no emails or files are inspected
4. **Automated and fast:** Can process thousands of rows in seconds
5. **Interpretable:** Feature importance from RF shows which features matter most
6. **Scalable:** Works on CSV files of any size
7. **Interactive dashboard:** SOC analysts can filter, search, and visualize results without writing code
8. **Customizable thresholds:** Risk levels can be adjusted for different security policies
9. **Honest methodology:** No data leakage; test set was never seen during training or threshold tuning
10. **Dual-model architecture:** Comparing LR and RF provides research insight even when one dominates

---

## 19. Limitations

1. **Trained on 2017 data:** New attack types invented after 2017 may not be detected well
2. **Concept drift:** Real network traffic changes over time; the model may degrade without periodic retraining
3. **Botnet detection is weaker:** Only 36 Botnet training rows — the model has limited exposure to this attack type
4. **No temporal/streaming processing:** The system works on uploaded CSV batches, not live real-time traffic streams
5. **Feature engineering is fixed:** The 12 features must be pre-extracted from raw PCAP files using tools like CICFlowMeter before uploading
6. **w_LR = 0 means LR does nothing:** In the current configuration, LR does not contribute to the final prediction
7. **Class imbalance:** 80% normal vs 20% attack — although class_weight=balanced compensates for this during training
8. **Threshold is dataset-specific:** The 0.4536 threshold is optimal for CIC-IDS-2017 but may not generalize to other network environments
9. **No IP/protocol analysis:** IP addresses and protocol (TCP/UDP) are not used as direct features in the secondary model
10. **Dashboard requires pre-generated results:** The dashboard reads saved CSV/JSON files; it does not retrain models live

---

## 20. Complete Workflow in One Simple Text Flow

```
=============================================================
    NETWORK INTRUSION DETECTION — COMPLETE WORKFLOW
=============================================================

TRAINING PHASE (done once, offline)
─────────────────────────────────────
[CIC-IDS-2017 Dataset: 70,000 rows, 12 features, 13 attack types]
        │
        ▼
[Create Binary Labels: BENIGN=0, All attacks=1]
        │
        ▼
[Split: 49,053 Train / 10,443 Calibration / 10,504 Validation]
        │
        ├──► [Train Logistic Regression with StandardScaler]
        │              (Linear model, learns feature weights)
        │
        └──► [Train Random Forest: 300 trees, no scaling]
                       (Complex non-linear pattern learner)
        │
        ▼
[Calibrate both models on Calibration Set (isotonic)]
        │
        ▼
[Find best weights on Validation Set: w_LR=0.0, w_RF=1.0]
[Find best threshold on Validation Set: 0.4536]
        │
        ▼
[Save: lr_pipeline.joblib, rf_model.joblib,
       lr_calibrated.joblib, rf_calibrated.joblib,
       experiment_config.json]

═════════════════════════════════════════════════════════════

INFERENCE PHASE (runs every time a CSV is uploaded)
─────────────────────────────────────────────────────
[User uploads CSV file via dashboard]
        │
        ▼
[Read CSV → Extract 12 feature columns]
[Validate: are all 12 columns present?]
        │ NO → Show error message
        │ YES ↓
[Strip all non-feature columns (Attack Type, Label, etc.)]
        │
        ├──► [LR Pipeline: Scale → Predict → Raw LR prob]
        │              → Calibrate → LR calibrated prob
        │
        └──► [RF Model: Raw values → Predict → Raw RF prob]
                       → Calibrate → RF calibrated prob
        │
        ▼
[Hybrid Score = 0.0 × LR_cal + 1.0 × RF_cal = RF_cal]
        │
        ▼
[Compare with threshold 0.4536]
    Score ≥ 0.4536 → ATTACK (1)
    Score <  0.4536 → NORMAL (0)
        │
        ▼
[Assign Risk Level]
    Score ≥ 0.70 → 🔴 High Risk
    Score ≥ 0.40 → 🟡 Moderate Risk
    Score <  0.40 → 🟢 Low Risk
        │
        ▼
[Dashboard displays: KPI cards, charts, tables, event explorer]

=============================================================
```

---

## 21. Short Viva Explanation

> **“My project is a confidence-based hybrid machine-learning framework for SOC alert triage. It includes two independent network-intrusion experiments: a primary Suricata testbed experiment and a secondary CIC-IDS-2017 experiment. Each has its own input data, feature schema, LR and Random Forest models, hybrid settings, evaluation, and saved artifacts.**
>
> **For each experiment, calibrated LR and RF scores are combined according to that experiment’s configuration. The score is compared with its configured decision threshold and mapped to triage or risk categories to help analysts prioritize review. The cross-experiment ensemble is a separate inference component that uses the artifacts from both experiments with a distinct combined input schema; it does not train on pooled data.**
>
> **The project provides Python Dash views for saved results and a Next.js SOC research dashboard. The web dashboard has Home, experiment, comparison, analysis, performance, result, configuration, and ensemble pages. It supports dark and light themes, follows the system preference on first visit, and remembers a user-selected mode.**
>
> **The web dashboard uses demonstration responses by default for API-backed upload flows. This repository does not include a separate HTTP backend, and the dashboard should not be described as monitoring live traffic. Saved evaluation metrics and model scores are research outputs and estimates, not guaranteed confidence percentages or operational decisions.”**

---

## 22. Current Project Structure and Components

The repository is organized by project role. The two base experiments are independent: each has its own inputs, features, model artifacts, metrics, and predictions. The cross-experiment ensemble is a separate inference workflow that consumes both sets of trained model artifacts; it does not mean the training datasets were merged.

```text
project/
├── apps/
│   ├── web-dashboard/          # Next.js SOC research dashboard
│   ├── primary-dashboard/      # Python Dash view for primary saved results
│   └── secondary-dashboard/    # Python Dash view for secondary saved results
├── experiments/
│   ├── primary/                # Suricata testbed pipeline and src modules
│   └── secondary/              # CIC-IDS-2017 pipeline
├── research/
│   ├── ensemble/               # Separate cross-experiment inference utility
│   ├── comparison/             # Saved-result comparison report
│   └── shared/                 # Shared research support
├── data/
│   ├── raw/primary/             # Primary source datasets
│   ├── raw/secondary/           # Secondary source datasets
│   └── samples/                 # CSV examples and templates
├── artifacts/
│   ├── primary/                 # Primary models, metrics, plots, predictions
│   ├── secondary/               # Secondary experiment outputs
│   ├── comparison/              # Comparison outputs
│   └── verified/                # Preserved verified results and audit records
├── tests/                       # Pipeline and ensemble tests
└── tools/                       # Audit and data utility scripts
```

The repository does not contain a separate FastAPI or Flask HTTP backend. The web dashboard's API adapter can use mock/demo responses by default or call a compatible external service when configured. The Python Dash applications are separate interfaces that read the experiment artifacts.

## 23. Current Web Dashboard and Theme

The consolidated frontend lives in `apps/web-dashboard/` and uses Next.js App Router, React, TypeScript, Tailwind CSS, Recharts, and Lucide. Its shared navigation groups the project introduction and overview, the two independent experiment pages, the separate ensemble workflow, and evaluation/configuration views. The interface is responsive and built around the SOC research dashboard visual system.

The frontend supports dark mode and light mode. On a first visit it follows the operating system preference; the small theme initialization script applies that choice before the page is painted to avoid showing the wrong theme briefly. The theme toggle in the shared header can be used by mouse or keyboard and has a clear accessible label. A selection is stored as `soc-dashboard-theme` in browser local storage and persists across page reloads. When no saved choice exists, the dashboard follows system preference changes.

Shared CSS variables define the page background, cards, borders, text, accents, model/chart colors, semantic risk colors, chart grids, and tooltip surfaces. Each theme applies those tokens throughout pages, tables, charts, forms, loading/error states, and focus indicators. Theme changes affect presentation only; they do not change routes, API payloads, data fetching, model calculations, saved results, or experiment behavior. No theme dependency was added.

### Web dashboard routes

- `/home` and `/overview`: project introduction and research overview
- `/primary-model`: Suricata testbed experiment
- `/secondary-model`: CIC-IDS-2017 experiment
- `/ensemble`: separate cross-experiment inference
- `/comparison`, `/analysis`, and `/performance`: saved experiment comparisons and evaluation
- `/results`: prediction-result table
- `/configuration`: dataset and model configuration

## 24. Important Interpretation Notes

- The primary and secondary experiments use different dataset sources and feature schemas. Interpret each experiment's saved metrics within its own dataset context.
- The ensemble utility requires artifacts from both experiments and expects a distinct 34-feature CSV schema. It is not a model retrained on pooled datasets.
- The web dashboard defaults to demonstration API responses unless an external API URL is configured. Demonstration responses must not be described as live alerts or fresh model inference.
- Calibrated probabilities and hybrid scores remain estimates. They are research outputs for analyst review, not guarantees or a substitute for operational security decisions.
