"""
secondary_soc_dashboard.py
===========================
Interactive Secondary SOC Dashboard
Confidence-Based Hybrid ML Framework for Security Operations Center Alert Triage

Tabs
----
  1. Overview       - KPI cards, traffic distribution, attack categories, triage breakdown
  2. Model Scores   - Probability distributions, confusion matrices, ROC curves
  3. Feature Analysis - RF feature importance, normal vs attack comparison
  4. Performance    - Metric tables, radar chart, val vs test comparison, FN analysis
  5. Event Explorer - Filterable, sortable record-level table
  6. Custom Analysis - Upload any CSV, get live risk classification + full attack analysis
  7. Config         - Experiment configuration and hybrid tuning parameters

Usage
-----
    python "ML Models/ML Models/Secondary Model/dashboard/secondary_soc_dashboard.py"
    Open: http://127.0.0.1:8051
"""

import os, sys, json, base64, io
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import plotly.colors as pc
import joblib
import dash
from dash import dcc, html, dash_table, Input, Output, State, callback, ctx
import warnings
warnings.filterwarnings("ignore")

# ─── Paths ────────────────────────────────────────────────────────────────────
DASH_DIR    = os.path.dirname(os.path.abspath(__file__))
MODEL_ROOT  = os.path.join(DASH_DIR, "..")          # Secondary Model root
PRED_DIR    = os.path.join(MODEL_ROOT, "predictions")
METRICS_DIR = os.path.join(MODEL_ROOT, "metrics")
PLOTS_DIR   = os.path.join(MODEL_ROOT, "plots")
MODEL_DIR   = os.path.join(MODEL_ROOT, "models")

# ─── Load all artefacts ───────────────────────────────────────────────────────
pred_test  = pd.read_csv(os.path.join(PRED_DIR, "secondary_predictions_test.csv"))
pred_val   = pd.read_csv(os.path.join(PRED_DIR, "secondary_predictions_val.csv"))
eval_test  = pd.read_csv(os.path.join(METRICS_DIR, "secondary_evaluation_summary_test.csv"))
eval_val   = pd.read_csv(os.path.join(METRICS_DIR, "secondary_evaluation_summary_val.csv"))
feat_imp   = pd.read_csv(os.path.join(METRICS_DIR, "secondary_feature_importance.csv"))
feat_stat  = pd.read_csv(os.path.join(METRICS_DIR, "secondary_feature_stats_by_class.csv"))
with open(os.path.join(METRICS_DIR, "secondary_experiment_config.json"), encoding="utf-8") as f:
    cfg = json.load(f)

# ─── Load trained models for custom CSV inference ─────────────────────────────
try:
    _lr_pipeline   = joblib.load(os.path.join(MODEL_DIR, "secondary_lr_pipeline.joblib"))
    _lr_calibrated = joblib.load(os.path.join(MODEL_DIR, "secondary_lr_calibrated.joblib"))
    _rf_model      = joblib.load(os.path.join(MODEL_DIR, "secondary_rf_model.joblib"))
    _rf_calibrated = joblib.load(os.path.join(MODEL_DIR, "secondary_rf_calibrated.joblib"))
    MODELS_LOADED = True
except Exception as e:
    MODELS_LOADED = False
    _model_load_error = str(e)

# ─── Config values ────────────────────────────────────────────────────────────
FEATURE_COLS = cfg["feature_list"]          # exact 12 features
W1  = cfg["hybrid_w1_lr"]
W2  = cfg["hybrid_w2_rf"]
DEC_THR  = cfg["decision_threshold"]
LOW_THR  = cfg["low_triage_threshold"]
HIGH_THR = cfg["high_triage_threshold"]
CALIB    = cfg["calibration_method"]

# Triage labels (adapt to actual values in data)
TRIAGE_LOW    = "Low Suspicion"
TRIAGE_REVIEW = "Medium / Review"
TRIAGE_HIGH   = "High Suspicion"

# Risk levels for custom CSV (independent of model triage, based on hybrid score)
RISK_HIGH_THR   = 0.70   # hybrid_score >= 0.70 -> High Risk
RISK_MOD_THR    = 0.40   # 0.40 <= score < 0.70 -> Moderate Risk
# score < 0.40 -> Low Risk

# ─── Colours ──────────────────────────────────────────────────────────────────
CLR_NORMAL  = "#2ecc71"
CLR_ATTACK  = "#e74c3c"
CLR_REVIEW  = "#f39c12"
CLR_LOW     = "#27ae60"
CLR_HIGH    = "#c0392b"
CLR_MOD     = "#e67e22"
CLR_LR      = "#3498db"
CLR_RF      = "#e67e22"
CLR_HYBRID  = "#8e44ad"
CLR_BG      = "#0f1923"
CLR_CARD    = "#1a2535"
CLR_CARD2   = "#1f2f44"
CLR_TEXT    = "#ecf0f1"
CLR_SUB     = "#95a5a6"
CLR_BORDER  = "#2c3e50"
CLR_RISK_H  = "#e74c3c"
CLR_RISK_M  = "#f39c12"
CLR_RISK_L  = "#2ecc71"

RISK_COLOURS = {"High Risk": CLR_RISK_H, "Moderate Risk": CLR_RISK_M, "Low Risk": CLR_RISK_L}
TRIAGE_COLOURS = {TRIAGE_LOW: CLR_LOW, TRIAGE_REVIEW: CLR_REVIEW, TRIAGE_HIGH: CLR_HIGH}

# ─── Derived stats ────────────────────────────────────────────────────────────
total_events  = len(pred_test)
total_normal  = int((pred_test["label_binary"] == 0).sum())
total_attack  = int((pred_test["label_binary"] == 1).sum())
attack_rate   = round(total_attack / total_events * 100, 1)
attack_cats   = pred_test[pred_test["label_binary"] == 1]["label_multiclass"].value_counts()
triage_counts = pred_test["triage_level"].value_counts()

def _get_model_row(df, model_name):
    rows = df[df["model"] == model_name]
    return rows.iloc[0] if len(rows) else None

hybrid_row = _get_model_row(eval_test, "Hybrid Model")
rf_row     = _get_model_row(eval_test, "Random Forest")
lr_row     = _get_model_row(eval_test, "Logistic Regression")

# ─── Helpers ──────────────────────────────────────────────────────────────────
def img_src(filename):
    path = os.path.join(PLOTS_DIR, filename)
    if not os.path.exists(path):
        return ""
    with open(path, "rb") as fh:
        return "data:image/png;base64," + base64.b64encode(fh.read()).decode()

def card(children, extra=None):
    style = {"backgroundColor": CLR_CARD, "borderRadius": "10px",
             "padding": "18px 22px", "marginBottom": "16px",
             "border": f"1px solid {CLR_BORDER}",
             "boxShadow": "0 2px 8px rgba(0,0,0,.35)"}
    if extra:
        style.update(extra)
    return html.Div(children, style=style)

def kpi_card(title, value, sub="", colour=CLR_TEXT, icon=""):
    return html.Div([
        html.Div(f"{icon}  {title}", style={"fontSize": "11px", "color": CLR_SUB,
                 "textTransform": "uppercase", "letterSpacing": "1px", "marginBottom": "6px"}),
        html.Div(str(value), style={"fontSize": "28px", "fontWeight": "700",
                 "color": colour, "lineHeight": "1"}),
        html.Div(sub, style={"fontSize": "12px", "color": CLR_SUB, "marginTop": "4px"}),
    ], style={"backgroundColor": CLR_CARD, "borderRadius": "10px", "padding": "16px 20px",
              "border": f"1px solid {CLR_BORDER}", "flex": "1", "minWidth": "130px",
              "textAlign": "center"})

def sec_title(text, icon=""):
    return html.H3(f"{icon}  {text}", style={"color": CLR_TEXT, "fontSize": "15px",
        "fontWeight": "600", "marginBottom": "14px",
        "borderBottom": f"2px solid {CLR_BORDER}", "paddingBottom": "8px"})

PLOT_BASE = dict(paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                 font_color=CLR_TEXT, font_size=11, margin=dict(l=10, r=10, t=40, b=10))

# Shared DataTable style
TBL = dict(
    style_table={"overflowX": "auto"},
    style_cell={"backgroundColor": CLR_CARD2, "color": CLR_TEXT,
                "border": f"1px solid {CLR_BORDER}", "textAlign": "center",
                "padding": "8px 12px", "fontSize": "13px"},
    style_header={"backgroundColor": "#2c3e50", "color": CLR_TEXT,
                  "fontWeight": "bold", "border": f"1px solid {CLR_BORDER}"},
    style_data_conditional=[
        {"if": {"filter_query": '{model} = "Hybrid Model"'},
         "backgroundColor": "#2a1f44", "color": "#c39bd3"},
        {"if": {"filter_query": '{model} = "Random Forest"'},
         "backgroundColor": "#2a1e14", "color": "#f0b27a"},
        {"if": {"filter_query": '{Model} = "Hybrid Model"'},
         "backgroundColor": "#2a1f44", "color": "#c39bd3"},
        {"if": {"filter_query": '{Model} = "Random Forest"'},
         "backgroundColor": "#2a1e14", "color": "#f0b27a"},
    ]
)

# ─── Inference helpers ────────────────────────────────────────────────────────
def _assign_risk(score):
    if score >= RISK_HIGH_THR:
        return "High Risk"
    elif score >= RISK_MOD_THR:
        return "Moderate Risk"
    else:
        return "Low Risk"

def _run_inference(df_input):
    """Run the trained secondary model on any uploaded DataFrame.
    Returns the same DataFrame with added prediction columns.

    IMPORTANT — Training data compatibility
    ----------------------------------------
    This model was trained on CIC-IDS-2017 network flow statistics.
    Attack traffic in that dataset has very specific numeric signatures
    (e.g. bytes_per_packet median = 6 for attacks vs 63 for normal,
     total_bytes median = 30 for attacks vs 218 for normal).
    CSV rows whose values fall outside these ranges will be scored as Normal
    by the model — this is CORRECT behaviour, not a bug.
    Use test_data_model_compatible.csv as a reference template.
    """
    missing = [c for c in FEATURE_COLS if c not in df_input.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Strip any label/prediction columns that must NOT be fed as features
    EXCLUDE = {"Label", "Attack Type", "Risk Level", "label_binary",
               "model_prediction", "model_prediction_label", "model_risk_level",
               "triage_level", "hybrid_score", "lr_prob_raw", "rf_prob_raw",
               "lr_prob_calibrated", "rf_prob_calibrated", "true_binary",
               "features_seen_in_development"}

    X = df_input[FEATURE_COLS].fillna(0).astype(float).values

    lr_raw  = _lr_pipeline.predict_proba(X)[:, 1]
    lr_cal  = _lr_calibrated.predict_proba(X)[:, 1]
    rf_raw  = _rf_model.predict_proba(X)[:, 1]
    rf_cal  = _rf_calibrated.predict_proba(X)[:, 1]

    hybrid_cal  = W1 * lr_cal  + W2 * rf_cal
    hybrid_raw  = W1 * lr_raw  + W2 * rf_raw
    hybrid_pred = (hybrid_cal >= DEC_THR).astype(int)

    result = df_input.copy()
    result["lr_prob_raw"]           = np.round(lr_raw,  4)
    result["lr_prob_calibrated"]    = np.round(lr_cal,  4)
    result["rf_prob_raw"]           = np.round(rf_raw,  4)
    result["rf_prob_calibrated"]    = np.round(rf_cal,  4)
    result["hybrid_score_raw"]      = np.round(hybrid_raw,  4)
    result["hybrid_score_calibrated"] = np.round(hybrid_cal, 4)
    result["prediction"]            = pd.Series(hybrid_pred).map({0: "Normal", 1: "Attack"}).values
    result["risk_level"]            = [_assign_risk(s) for s in hybrid_cal]

    # Triage using model thresholds
    def _triage(s):
        if s < LOW_THR:
            return TRIAGE_LOW
        elif s >= HIGH_THR:
            return TRIAGE_HIGH
        else:
            return TRIAGE_REVIEW
    result["triage_level"] = [_triage(s) for s in hybrid_cal]
    return result

# ──────────────────────────────────────────────────────────────────────────────
# Figures for persistent tabs
# ──────────────────────────────────────────────────────────────────────────────
def fig_binary_donut():
    fig = go.Figure(go.Pie(
        labels=["Normal", "Attack"], values=[total_normal, total_attack],
        hole=0.58, marker_colors=[CLR_NORMAL, CLR_ATTACK],
        textinfo="label+percent", textfont_size=12))
    fig.update_layout(**PLOT_BASE, title_text="Traffic Type (Test Set)", title_x=0.5,
        height=300, showlegend=False,
        annotations=[dict(text=f"<b>{total_events:,}</b><br>Events",
                          x=0.5, y=0.5, showarrow=False,
                          font=dict(size=13, color=CLR_TEXT))])
    return fig

def fig_attack_cats():
    cats = attack_cats.reset_index()
    cats.columns = ["Attack Type", "Count"]
    fig = px.bar(cats, x="Count", y="Attack Type", orientation="h",
                 color="Count", color_continuous_scale=["#e74c3c","#8e44ad"],
                 title="Attack Category Breakdown")
    fig.update_layout(**PLOT_BASE, height=350, yaxis=dict(autorange="reversed"),
                      coloraxis_showscale=False, title_x=0.5)
    fig.update_traces(texttemplate="%{x}", textposition="outside",
                      hovertemplate="<b>%{y}</b><br>Count: %{x}<extra></extra>")
    return fig

def fig_triage():
    order  = [k for k in [TRIAGE_LOW, TRIAGE_REVIEW, TRIAGE_HIGH] if k in triage_counts.index]
    counts = [triage_counts.get(l, 0) for l in order]
    clrs   = [TRIAGE_COLOURS.get(l, CLR_REVIEW) for l in order]
    fig = go.Figure(go.Bar(x=order, y=counts, marker_color=clrs,
                           text=counts, textposition="outside",
                           hovertemplate="<b>%{x}</b><br>%{y}<extra></extra>"))
    fig.update_layout(**PLOT_BASE, title_text="SOC Triage Levels (Test Set)",
                      title_x=0.5, height=280)
    return fig

def fig_triage_stacked():
    order = [k for k in [TRIAGE_LOW, TRIAGE_REVIEW, TRIAGE_HIGH] if k in triage_counts.index]
    normal_c = [int((pred_test[pred_test["triage_level"]==l]["label_binary"]==0).sum()) for l in order]
    attack_c = [int((pred_test[pred_test["triage_level"]==l]["label_binary"]==1).sum()) for l in order]
    fig = go.Figure([
        go.Bar(name="Normal", x=order, y=normal_c, marker_color=CLR_NORMAL),
        go.Bar(name="Attack", x=order, y=attack_c, marker_color=CLR_ATTACK),
    ])
    fig.update_layout(**PLOT_BASE, barmode="stack", title_text="Triage by True Label",
                      title_x=0.5, height=280,
                      legend=dict(orientation="h", y=-0.25))
    return fig

def fig_prob_dist():
    fig = make_subplots(rows=1, cols=3,
        subplot_titles=["LR Calibrated Prob", "RF Calibrated Prob", "Hybrid Score (Calibrated)"])
    shown = set()
    for ci, (col, lbl, clr_) in enumerate([
        ("lr_prob_calibrated",       "LR",     CLR_LR),
        ("rf_prob_calibrated",       "RF",     CLR_RF),
        ("hybrid_score_calibrated",  "Hybrid", CLR_HYBRID),
    ], 1):
        for bl, nm, fill_clr in [(0,"Normal",CLR_NORMAL),(1,"Attack",CLR_ATTACK)]:
            vals = pred_test[pred_test["label_binary"]==bl][col]
            show_legend = nm not in shown
            shown.add(nm)
            fig.add_trace(go.Histogram(x=vals, nbinsx=50, name=nm, legendgroup=nm,
                showlegend=show_legend, marker_color=fill_clr, opacity=0.65,
                histnorm="probability density"), row=1, col=ci)
        if ci == 3:
            fig.add_vline(x=DEC_THR, line_dash="dash", line_color="#f1c40f",
                annotation_text=f"thr={DEC_THR:.3f}", row=1, col=3,
                annotation_font_color="#f1c40f")
    fig.update_layout(**PLOT_BASE, height=320, barmode="overlay",
        title_text="Probability Distributions: Normal vs Attack (Test Set)",
        title_x=0.5, legend=dict(orientation="h", y=-0.25))
    return fig

def fig_feat_imp():
    df = feat_imp.sort_values("importance")
    n = len(df)
    colours = pc.sample_colorscale("RdYlGn", [i/max(n-1,1) for i in range(n)])
    fig = go.Figure(go.Bar(x=df["importance"], y=df["feature"], orientation="h",
        marker_color=colours, text=df["importance"].round(4), textposition="outside",
        hovertemplate="<b>%{y}</b><br>Importance: %{x:.4f}<extra></extra>"))
    fig.update_layout(**PLOT_BASE, title_text="RF Feature Importance", title_x=0.5, height=380)
    return fig

def fig_feat_compare():
    fig = go.Figure([
        go.Bar(name="Normal (mean)", x=feat_stat["feature"], y=feat_stat["normal_mean"],
               marker_color=CLR_NORMAL),
        go.Bar(name="Attack (mean)",  x=feat_stat["feature"], y=feat_stat["attack_mean"],
               marker_color=CLR_ATTACK),
    ])
    fig.update_layout(**PLOT_BASE, barmode="group", title_text="Feature Means: Normal vs Attack",
        title_x=0.5, height=360, xaxis_tickangle=-35,
        legend=dict(orientation="h", y=-0.35))
    return fig

def fig_radar():
    metrics = ["accuracy","precision","recall","f1","roc_auc"]
    labels  = ["Accuracy","Precision","Recall","F1","ROC-AUC"]
    angles  = [i/len(labels)*360 for i in range(len(labels))]
    fig = go.Figure()
    clrs = {"Logistic Regression": CLR_LR, "Random Forest": CLR_RF, "Hybrid Model": CLR_HYBRID}
    for _, row in eval_test.iterrows():
        vals = [row[m] for m in metrics]
        fig.add_trace(go.Scatterpolar(r=vals+[vals[0]], theta=labels+[labels[0]],
            fill="toself", name=row["model"], line_color=clrs.get(row["model"],"#fff"), opacity=0.7))
    fig.update_layout(**PLOT_BASE,
        polar=dict(bgcolor="rgba(0,0,0,0)",
                   radialaxis=dict(visible=True, range=[0,1], color=CLR_SUB, gridcolor=CLR_BORDER),
                   angularaxis=dict(color=CLR_TEXT)),
        title_text="Performance Radar (Test Set)", title_x=0.5, height=380,
        legend=dict(orientation="h", y=-0.15))
    return fig

def fig_fn():
    fig = go.Figure(go.Bar(
        x=eval_test["model"], y=eval_test["FN"],
        marker_color=[CLR_LR, CLR_RF, CLR_HYBRID],
        text=eval_test["FN"], textposition="outside",
        hovertemplate="<b>%{x}</b><br>Missed Attacks: %{y}<extra></extra>"))
    fig.update_layout(**PLOT_BASE, title_text="False Negatives – Missed Attacks (Test Set)",
        title_x=0.5, height=280)
    return fig

def fig_val_vs_test():
    metrics  = ["accuracy","precision","recall","f1","roc_auc"]
    mlabels  = ["Accuracy","Precision","Recall","F1","ROC-AUC"]
    hv  = _get_model_row(eval_val,  "Hybrid Model")
    ht  = _get_model_row(eval_test, "Hybrid Model")
    if hv is None or ht is None:
        return go.Figure()
    fig = go.Figure([
        go.Bar(name="Validation", x=mlabels, y=[hv[m] for m in metrics],
               marker_color=CLR_HYBRID, opacity=0.7),
        go.Bar(name="Test",       x=mlabels, y=[ht[m] for m in metrics],
               marker_color="#a29bfe"),
    ])
    fig.update_layout(**PLOT_BASE, barmode="group",
        title_text="Hybrid Model: Validation vs Test", title_x=0.5, height=300,
        yaxis=dict(range=[0.8, 1.01]),
        legend=dict(orientation="h", y=-0.2))
    return fig

# ─── Performance table ────────────────────────────────────────────────────────
PERF_COLS = ["model","accuracy","precision","recall","f1","roc_auc","TP","TN","FP","FN"]
perf_display = eval_test[[c for c in PERF_COLS if c in eval_test.columns]].copy()
perf_display.columns = ["Model","Accuracy","Precision","Recall","F1","ROC-AUC","TP","TN","FP","FN(Missed)"]

# ─── Explorer columns ─────────────────────────────────────────────────────────
EXPLORER_COLS = [
    {"name": "True Label",      "id": "label_multiclass"},
    {"name": "Binary(0=N,1=A)", "id": "label_binary"},
    {"name": "LR Calib Prob",   "id": "lr_prob_calibrated"},
    {"name": "RF Calib Prob",   "id": "rf_prob_calibrated"},
    {"name": "Hybrid Score",    "id": "hybrid_score_calibrated"},
    {"name": "Hybrid Pred",     "id": "hybrid_pred"},
    {"name": "Triage Level",    "id": "triage_level"},
]
EXPLORER_DATA_COLS = [c["id"] for c in EXPLORER_COLS]

TRIAGE_COND = [
    {"if": {"filter_query": f'{{triage_level}} = "{TRIAGE_LOW}"',   "column_id": "triage_level"}, "color": CLR_LOW,    "fontWeight":"bold"},
    {"if": {"filter_query": f'{{triage_level}} = "{TRIAGE_REVIEW}"',"column_id": "triage_level"}, "color": CLR_REVIEW, "fontWeight":"bold"},
    {"if": {"filter_query": f'{{triage_level}} = "{TRIAGE_HIGH}"',  "column_id": "triage_level"}, "color": CLR_HIGH,   "fontWeight":"bold"},
    {"if": {"filter_query": '{label_binary} = 1', "column_id": "label_multiclass"}, "color": CLR_ATTACK},
    {"if": {"filter_query": '{label_binary} = 0', "column_id": "label_multiclass"}, "color": CLR_NORMAL},
]

# ─── App ──────────────────────────────────────────────────────────────────────
app = dash.Dash(__name__, title="Secondary SOC Dashboard",
                suppress_callback_exceptions=True)

GLOB = {"backgroundColor": CLR_BG, "color": CLR_TEXT,
        "fontFamily": "'Inter','Segoe UI',sans-serif", "minHeight": "100vh"}

HEADER = html.Div([
    html.Div([
        html.Span("🛡️", style={"fontSize":"28px","marginRight":"12px"}),
        html.Div([
            html.H1("Secondary SOC Alert Triage Dashboard",
                    style={"margin":"0","fontSize":"22px","fontWeight":"700","color":CLR_TEXT}),
            html.P("CIC-IDS-2017 · Confidence-Based Hybrid ML Framework",
                   style={"margin":"2px 0 0","fontSize":"12px","color":CLR_SUB}),
        ]),
    ], style={"display":"flex","alignItems":"center"}),
    html.Div([
        html.Span("● Pipeline complete", style={"color":CLR_NORMAL,"fontSize":"12px"}),
        html.Span(f"  |  Runtime: {cfg.get('runtime_seconds',0):.1f}s  |  "
                  f"Test rows: {cfg.get('n_test',0):,}",
                  style={"color":CLR_SUB,"fontSize":"12px","marginLeft":"8px"}),
    ]),
], style={"backgroundColor":"#0d1520","padding":"16px 30px","display":"flex",
          "justifyContent":"space-between","alignItems":"center",
          "borderBottom":f"2px solid {CLR_BORDER}","position":"sticky","top":"0","zIndex":"100"})

TABS = dcc.Tabs(id="tabs", value="overview", children=[
    dcc.Tab(label="📊 Overview",         value="overview"),
    dcc.Tab(label="🔬 Model Scores",     value="scores"),
    dcc.Tab(label="🌲 Feature Analysis", value="features"),
    dcc.Tab(label="📈 Performance",      value="performance"),
    dcc.Tab(label="🗂️ Event Explorer",   value="explorer"),
    dcc.Tab(label="📂 Custom Analysis",  value="custom"),
    dcc.Tab(label="⚙️ Config",           value="config"),
], style={"backgroundColor":CLR_BG},
   colors={"border":CLR_BORDER,"primary":CLR_HYBRID,"background":CLR_CARD})

app.layout = html.Div([
    HEADER,
    html.Div(TABS, style={"padding":"0 24px","backgroundColor":CLR_BG,
                           "borderBottom":f"1px solid {CLR_BORDER}"}),
    html.Div(id="tab-content", style={"padding":"20px 24px","backgroundColor":CLR_BG}),
], style=GLOB)

# ──────────────────────────────────────────────────────────────────────────────
# TAB: Overview
# ──────────────────────────────────────────────────────────────────────────────
def tab_overview():
    hybrid_rec = eval_test[eval_test["model"]=="Hybrid Model"].iloc[0] if len(eval_test)>0 else {}
    rf_rec     = eval_test[eval_test["model"]=="Random Forest"].iloc[0] if len(eval_test)>0 else {}
    lr_rec     = eval_test[eval_test["model"]=="Logistic Regression"].iloc[0] if len(eval_test)>0 else {}

    kpis = html.Div([
        kpi_card("Total Events",   f"{total_events:,}", "Test set",           CLR_TEXT,    "📋"),
        kpi_card("Normal Traffic", f"{total_normal:,}", f"{100-attack_rate:.1f}%", CLR_NORMAL, "✅"),
        kpi_card("Attack Traffic", f"{total_attack:,}", f"{attack_rate:.1f}%",     CLR_ATTACK, "⚠️"),
        kpi_card("Attack Types",   str(len(attack_cats)), "categories",       CLR_REVIEW,  "🎯"),
        kpi_card("LR Recall",    f"{lr_rec.get('recall', 0):.1%}",     "attack detection", CLR_LR,     "📉"),
        kpi_card("RF Recall",    f"{rf_rec.get('recall', 0):.1%}",     "attack detection", CLR_RF,     "🌲"),
        kpi_card("Hybrid Recall",f"{hybrid_rec.get('recall', 0):.1%}", "attack detection", CLR_HYBRID, "🔀"),
        kpi_card("Hybrid FN",    str(int(hybrid_rec.get("FN",0))),     "missed attacks",   CLR_HIGH,   "🚨"),
    ], style={"display":"flex","gap":"12px","flexWrap":"wrap","marginBottom":"16px"})

    row1 = html.Div([
        html.Div(card([dcc.Graph(figure=fig_binary_donut(), config={"displayModeBar":False})]),
                 style={"flex":"1","minWidth":"280px"}),
        html.Div(card([dcc.Graph(figure=fig_attack_cats(), config={"displayModeBar":False})]),
                 style={"flex":"2","minWidth":"380px"}),
    ], style={"display":"flex","gap":"14px"})

    row2 = html.Div([
        html.Div(card([dcc.Graph(figure=fig_triage(), config={"displayModeBar":False})]),
                 style={"flex":"1","minWidth":"300px"}),
        html.Div(card([dcc.Graph(figure=fig_triage_stacked(), config={"displayModeBar":False})]),
                 style={"flex":"1","minWidth":"300px"}),
    ], style={"display":"flex","gap":"14px"})

    triage_levels_present = sorted(triage_counts.index.tolist())
    triage_info = card([
        sec_title("SOC Triage Configuration", "🎛️"),
        html.Div([
            html.Span(f"Decision Threshold: ", style={"color":CLR_SUB,"fontSize":"12px"}),
            html.Span(f"{DEC_THR:.4f}", style={"color":"#f1c40f","fontWeight":"700","fontSize":"14px"}),
            html.Span("  |  Hybrid Weights: ", style={"color":CLR_SUB,"fontSize":"12px","marginLeft":"16px"}),
            html.Span(f"w_LR = {W1:.2f}", style={"color":CLR_LR,"fontWeight":"600"}),
            html.Span(" + ", style={"color":CLR_SUB}),
            html.Span(f"w_RF = {W2:.2f}", style={"color":CLR_RF,"fontWeight":"600"}),
        ], style={"marginBottom":"12px"}),
        html.Div([
            html.Div([
                html.Span("🟢  Low Suspicion",   style={"color":CLR_LOW,    "fontWeight":"600"}),
                html.Span(f"  score < {LOW_THR:.4f}",  style={"color":CLR_SUB,"fontSize":"13px"}),
                html.Span(f"  ({triage_counts.get(TRIAGE_LOW, 0):,} events)",
                          style={"color":CLR_TEXT,"marginLeft":"8px"}),
            ], style={"marginBottom":"8px"}),
            html.Div([
                html.Span("🟡  Medium / Review", style={"color":CLR_REVIEW,"fontWeight":"600"}),
                html.Span(f"  {LOW_THR:.4f} ≤ score < {HIGH_THR:.4f}", style={"color":CLR_SUB,"fontSize":"13px"}),
                html.Span(f"  ({triage_counts.get(TRIAGE_REVIEW, 0):,} events)",
                          style={"color":CLR_TEXT,"marginLeft":"8px"}),
            ], style={"marginBottom":"8px"}),
            html.Div([
                html.Span("🔴  High Suspicion",  style={"color":CLR_HIGH,  "fontWeight":"600"}),
                html.Span(f"  score ≥ {HIGH_THR:.4f}", style={"color":CLR_SUB,"fontSize":"13px"}),
                html.Span(f"  ({triage_counts.get(TRIAGE_HIGH, 0):,} events)",
                          style={"color":CLR_TEXT,"marginLeft":"8px"}),
            ]),
        ]),
    ])
    return html.Div([kpis, row1, row2, triage_info])

# ──────────────────────────────────────────────────────────────────────────────
# TAB: Model Scores
# ──────────────────────────────────────────────────────────────────────────────
def tab_scores():
    prob_note = card([
        sec_title("Raw vs Calibrated Probabilities", "📐"),
        html.P([
            html.Span("Raw probabilities", style={"color":"#f1c40f","fontWeight":"600"}),
            html.Span(" = direct predict_proba() from the base LR/RF models.  ",
                      style={"color":CLR_SUB}),
            html.Span("Calibrated scores", style={"color":CLR_HYBRID,"fontWeight":"600"}),
            html.Span(f" = CalibratedClassifierCV (method={CALIB}) fitted on the calibration "
                      "subset. Calibrated scores drive the hybrid model and all triage decisions.",
                      style={"color":CLR_SUB}),
        ], style={"fontSize":"12px","lineHeight":"1.7"}),
    ])

    cm_card = card([
        sec_title("Confusion Matrices — Test Set", "🔲"),
        html.Div([
            html.Div([html.P("Logistic Regression", style={"textAlign":"center","color":CLR_LR,"fontWeight":"600","marginBottom":"6px"}),
                      html.Img(src=img_src("secondary_cm_logistic_regression_test.png"),
                               style={"width":"100%","borderRadius":"8px"})],
                     style={"flex":"1","minWidth":"220px"}),
            html.Div([html.P("Random Forest", style={"textAlign":"center","color":CLR_RF,"fontWeight":"600","marginBottom":"6px"}),
                      html.Img(src=img_src("secondary_cm_random_forest_test.png"),
                               style={"width":"100%","borderRadius":"8px"})],
                     style={"flex":"1","minWidth":"220px"}),
            html.Div([html.P("Hybrid Model", style={"textAlign":"center","color":CLR_HYBRID,"fontWeight":"600","marginBottom":"6px"}),
                      html.Img(src=img_src("secondary_cm_hybrid_model_test.png"),
                               style={"width":"100%","borderRadius":"8px"})],
                     style={"flex":"1","minWidth":"220px"}),
        ], style={"display":"flex","gap":"16px","flexWrap":"wrap"}),
    ])

    roc_card = card([
        sec_title("ROC Curves — Test Set", "📈"),
        html.Img(src=img_src("secondary_roc_comparison_test.png"),
                 style={"width":"100%","maxWidth":"700px","borderRadius":"8px",
                        "display":"block","margin":"0 auto"}),
    ])
    return html.Div([prob_note,
                     card([dcc.Graph(figure=fig_prob_dist(), config={"displayModeBar":False})]),
                     cm_card, roc_card])

# ──────────────────────────────────────────────────────────────────────────────
# TAB: Feature Analysis
# ──────────────────────────────────────────────────────────────────────────────
def tab_features():
    row1 = html.Div([
        html.Div(card([dcc.Graph(figure=fig_feat_imp(), config={"displayModeBar":False})]),
                 style={"flex":"1","minWidth":"380px"}),
        html.Div(card([dcc.Graph(figure=fig_feat_compare(), config={"displayModeBar":False})]),
                 style={"flex":"1","minWidth":"380px"}),
    ], style={"display":"flex","gap":"14px"})

    fs = feat_stat.copy()
    fs["Ratio A/N"] = (fs["attack_mean"] / fs["normal_mean"].replace(0, float("nan"))).round(2)
    for col in ["normal_mean","normal_median","normal_std","attack_mean","attack_median","attack_std","Ratio A/N"]:
        if col in fs.columns:
            fs[col] = fs[col].round(3)

    ratio_cond = {k: v for k, v in TBL.items() if k != "style_data_conditional"}
    ratio_cond["style_data_conditional"] = TBL["style_data_conditional"] + [
        {"if": {"filter_query": "{Ratio A/N} > 1.5", "column_id": "Ratio A/N"}, "color": CLR_ATTACK, "fontWeight": "bold"},
        {"if": {"filter_query": "{Ratio A/N} < 0.5", "column_id": "Ratio A/N"}, "color": CLR_NORMAL, "fontWeight": "bold"},
    ]
    stats_tbl = card([
        sec_title("Feature Statistics: Normal vs Attack", "📊"),
        dash_table.DataTable(data=fs.to_dict("records"),
            columns=[{"name":c,"id":c} for c in fs.columns],
            **ratio_cond, page_size=12),
    ])
    dist_img = card([
        sec_title("Feature Distributions (plots)", "🖼️"),
        html.Img(src=img_src("secondary_feature_distribution_comparison.png"),
                 style={"width":"100%","borderRadius":"8px"}),
    ])
    fi_img = card([
        sec_title("Feature Importance Plot", "🌳"),
        html.Img(src=img_src("secondary_feature_importance.png"),
                 style={"width":"100%","maxWidth":"800px","borderRadius":"8px",
                        "display":"block","margin":"0 auto"}),
    ])
    return html.Div([row1, stats_tbl, dist_img, fi_img])

# ──────────────────────────────────────────────────────────────────────────────
# TAB: Performance
# ──────────────────────────────────────────────────────────────────────────────
def tab_performance():
    perf_tbl = card([
        sec_title("Model Performance Summary — Test Set", "📋"),
        dash_table.DataTable(data=perf_display.to_dict("records"),
            columns=[{"name":c,"id":c} for c in perf_display.columns],
            **TBL),
    ])
    row_charts = html.Div([
        html.Div(card([dcc.Graph(figure=fig_radar(), config={"displayModeBar":False})]),
                 style={"flex":"1","minWidth":"340px"}),
        html.Div([
            card([dcc.Graph(figure=fig_fn(), config={"displayModeBar":False})]),
        ], style={"flex":"1","minWidth":"340px"}),
    ], style={"display":"flex","gap":"14px"})

    val_test = card([dcc.Graph(figure=fig_val_vs_test(), config={"displayModeBar":False})])

    fn_note = card([
        html.Div("⚠️  False Negative Analysis (Missed Attacks)", style={
            "color":CLR_ATTACK,"fontWeight":"700","fontSize":"14px","marginBottom":"10px"}),
        html.Div([
            html.Div([html.Span("LR   ", style={"color":CLR_LR,"fontWeight":"700"}),
                      html.Span(f"Recall = {lr_row.get('recall',0):.4f}  |  ",style={"color":CLR_TEXT}),
                      html.Span(f"FN = {int(lr_row.get('FN',0)):,} missed attacks",
                                style={"color":CLR_ATTACK,"fontWeight":"600"})],
                     style={"marginBottom":"5px"}),
            html.Div([html.Span("RF   ", style={"color":CLR_RF,"fontWeight":"700"}),
                      html.Span(f"Recall = {rf_row.get('recall',0):.4f}  |  ",style={"color":CLR_TEXT}),
                      html.Span(f"FN = {int(rf_row.get('FN',0)):,} missed attacks",
                                style={"color":CLR_REVIEW,"fontWeight":"600"})],
                     style={"marginBottom":"5px"}),
            html.Div([html.Span("Hybrid",style={"color":CLR_HYBRID,"fontWeight":"700"}),
                      html.Span(f"  Recall = {hybrid_row.get('recall',0):.4f}  |  ",style={"color":CLR_TEXT}),
                      html.Span(f"FN = {int(hybrid_row.get('FN',0)):,} missed attacks",
                                style={"color":CLR_NORMAL,"fontWeight":"600"})]),
        ], style={"fontSize":"13px"}),
    ])
    return html.Div([perf_tbl, row_charts, val_test, fn_note])

# ──────────────────────────────────────────────────────────────────────────────
# TAB: Event Explorer
# ──────────────────────────────────────────────────────────────────────────────
def tab_explorer():
    controls = card([
        sec_title("Filter Events", "🔍"),
        html.Div([
            html.Div([
                html.Label("Triage Level",style={"color":CLR_SUB,"fontSize":"12px","marginBottom":"4px"}),
                dcc.Dropdown(id="ex-triage",
                    options=[{"label":"All","value":"all"}]+
                            [{"label":l,"value":l} for l in sorted(pred_test["triage_level"].unique())],
                    value="all", clearable=False,
                    style={"backgroundColor":CLR_CARD2,"color":"#000"}),
            ], style={"flex":"1","minWidth":"200px"}),
            html.Div([
                html.Label("Traffic Type",style={"color":CLR_SUB,"fontSize":"12px","marginBottom":"4px"}),
                dcc.Dropdown(id="ex-binary",
                    options=[{"label":"All","value":"all"},
                             {"label":"Normal (0)","value":0},
                             {"label":"Attack (1)","value":1}],
                    value="all", clearable=False,
                    style={"backgroundColor":CLR_CARD2,"color":"#000"}),
            ], style={"flex":"1","minWidth":"180px"}),
            html.Div([
                html.Label("Attack Category",style={"color":CLR_SUB,"fontSize":"12px","marginBottom":"4px"}),
                dcc.Dropdown(id="ex-cat",
                    options=[{"label":"All","value":"all"}]+
                            [{"label":c,"value":c} for c in sorted(pred_test["label_multiclass"].unique())],
                    value="all", clearable=False,
                    style={"backgroundColor":CLR_CARD2,"color":"#000"}),
            ], style={"flex":"2","minWidth":"220px"}),
            html.Div([
                html.Label("Rows to show",style={"color":CLR_SUB,"fontSize":"12px","marginBottom":"4px"}),
                dcc.Slider(id="ex-rows", min=50, max=500, step=50, value=100,
                    marks={50:"50",100:"100",200:"200",500:"500"},
                    tooltip={"placement":"bottom"}),
            ], style={"flex":"1","minWidth":"180px"}),
        ], style={"display":"flex","gap":"16px","alignItems":"flex-end","flexWrap":"wrap"}),
    ])
    table_area = card([
        html.Div(id="ex-summary",style={"color":CLR_SUB,"fontSize":"12px","marginBottom":"10px"}),
        html.Div(id="ex-table"),
    ])
    return html.Div([controls, table_area])

# ──────────────────────────────────────────────────────────────────────────────
# TAB: Custom Analysis  (the new upload → predict → risk classify → dashboard)
# ──────────────────────────────────────────────────────────────────────────────
def tab_custom():
    if not MODELS_LOADED:
        return card([
            html.H3("Model load error", style={"color": CLR_ATTACK}),
            html.P(f"Error: {_model_load_error}", style={"color": CLR_SUB}),
        ])

    # Training distribution reference table
    dist_ref = [
        {"Feature": "Source Port",                 "Normal median": "51,583", "Attack median": "48,262", "Key signal": "Slight difference"},
        {"Feature": "Destination Port",            "Normal median": "80",     "Attack median": "80",     "Key signal": "Similar"},
        {"Feature": "Total Fwd Packets",           "Normal median": "2",      "Attack median": "3",      "Key signal": "Attacks slightly higher"},
        {"Feature": "Total Backward Packets",      "Normal median": "2",      "Attack median": "1",      "Key signal": "Attacks mostly one-directional"},
        {"Feature": "Total Length of Fwd Packets", "Normal median": "66",     "Attack median": "26",     "Key signal": "Attacks smaller payloads"},
        {"Feature": "Total Length of Bwd Packets", "Normal median": "130",    "Attack median": "6",      "Key signal": "Attacks send almost no response"},
        {"Feature": "total_packets",               "Normal median": "4",      "Attack median": "5",      "Key signal": "Similar"},
        {"Feature": "total_bytes",                 "Normal median": "219",    "Attack median": "30",     "Key signal": "** Attacks transfer very little data"},
        {"Feature": "bytes_per_packet",            "Normal median": "63",     "Attack median": "6",      "Key signal": "** Strongest signal -- attacks = tiny packets"},
        {"Feature": "packet_asymmetry_ratio",      "Normal median": "1.0",    "Attack median": "1.0",    "Key signal": "Similar"},
        {"Feature": "hour_of_day",                 "Normal median": "4",      "Attack median": "4",      "Key signal": "Similar"},
        {"Feature": "day_of_week",                 "Normal median": "2",      "Attack median": "4",      "Key signal": "Attacks cluster on days 3-4"},
    ]

    compat_warning = card([
        sec_title("Training Data Compatibility Guide", "\U0001f4cf"),
        html.Div([
            html.Div("\u26a0\ufe0f  Critical -- read before uploading", style={
                "color": "#f1c40f", "fontWeight": "700", "fontSize": "14px", "marginBottom": "10px"}),
            html.P([
                html.Span("This model was trained on ", style={"color": CLR_SUB}),
                html.Span("CIC-IDS-2017 network flow statistics", style={"color": CLR_TEXT, "fontWeight": "600"}),
                html.Span(". Attack traffic has very specific numeric signatures. "
                          "If your CSV values fall outside the ranges below, the model "
                          "correctly classifies them as Normal -- this is NOT a bug.",
                          style={"color": CLR_SUB}),
            ], style={"fontSize": "12px", "lineHeight": "1.7", "marginBottom": "12px"}),
            html.P([
                html.Span("Most common mistake: ", style={"color": CLR_ATTACK, "fontWeight": "700"}),
                html.Span("bytes_per_packet = 500-1500 looks like normal web traffic to the model. "
                          "Attack flows have ", style={"color": CLR_SUB}),
                html.Span("bytes_per_packet median = 6", style={"color": "#f1c40f", "fontWeight": "700"}),
                html.Span(" and ", style={"color": CLR_SUB}),
                html.Span("total_bytes median = 30", style={"color": "#f1c40f", "fontWeight": "700"}),
                html.Span(" (DoS/DDoS flood packets are tiny).", style={"color": CLR_SUB}),
            ], style={"fontSize": "12px", "lineHeight": "1.7", "marginBottom": "14px"}),
            dash_table.DataTable(
                data=dist_ref,
                columns=[{"name": c, "id": c} for c in dist_ref[0].keys()],
                style_table={"overflowX": "auto"},
                style_cell={"backgroundColor": CLR_CARD2, "color": CLR_TEXT,
                            "border": f"1px solid {CLR_BORDER}",
                            "textAlign": "left", "padding": "6px 10px", "fontSize": "12px"},
                style_header={"backgroundColor": "#2c3e50", "color": CLR_TEXT,
                              "fontWeight": "bold", "border": f"1px solid {CLR_BORDER}"},
                style_data_conditional=[
                    {"if": {"filter_query": '{Key signal} contains "**"'},
                     "color": "#f1c40f", "fontWeight": "bold"},
                ],
            ),
            html.Div([
                html.Span("Use template: ", style={"color": CLR_SUB, "fontSize": "12px"}),
                html.Span("test_data_model_compatible.csv",
                          style={"color": CLR_HYBRID, "fontWeight": "600",
                                 "fontSize": "12px", "fontFamily": "monospace"}),
                html.Span(" (project root) -- sampled from real training data, 87% attack detection.",
                          style={"color": CLR_SUB, "fontSize": "12px"}),
            ], style={"marginTop": "12px"}),
        ]),
    ])

    upload_step = card([
        sec_title("Step 1 -- Upload CSV File", "\U0001f4c2"),
        html.P("Your CSV must contain these 12 features (exact column names):",
               style={"color": CLR_SUB, "fontSize": "12px"}),
        html.Div([
            html.Code(", ".join(FEATURE_COLS),
                      style={"backgroundColor": "#0d1520", "color": "#f1c40f",
                             "padding": "10px 14px", "borderRadius": "6px",
                             "fontSize": "11px", "display": "block",
                             "wordBreak": "break-all", "lineHeight": "1.8"}),
        ], style={"marginBottom": "14px"}),
        html.P([
            html.Span("Optional: include an ", style={"color": CLR_SUB, "fontSize": "12px"}),
            html.Code("Attack Type", style={"fontSize": "12px", "color": "#f1c40f"}),
            html.Span(" column as ground-truth reference (NOT fed into the model).",
                      style={"color": CLR_SUB, "fontSize": "12px"}),
        ], style={"marginBottom": "12px"}),
        dcc.Upload(
            id="upload-csv",
            children=html.Div([
                html.Span("\U0001f4c1  Drag & Drop or ", style={"fontSize": "15px"}),
                html.A("Browse for CSV", style={"color": CLR_HYBRID, "fontWeight": "600",
                                                "cursor": "pointer", "fontSize": "15px"}),
            ]),
            style={"width": "100%", "lineHeight": "60px", "borderWidth": "2px",
                   "borderStyle": "dashed", "borderRadius": "8px", "textAlign": "center",
                   "borderColor": CLR_BORDER, "backgroundColor": CLR_CARD2,
                   "color": CLR_TEXT, "cursor": "pointer"},
            multiple=False,
        ),
        html.Div(id="upload-status", style={"marginTop": "12px"}),
    ])

    return html.Div([compat_warning, upload_step, html.Div(id="custom-results")])


# ─── Custom CSV upload callback ───────────────────────────────────────────────
@callback(
    Output("upload-status",  "children"),
    Output("custom-results", "children"),
    Input("upload-csv",      "contents"),
    State("upload-csv",      "filename"),
    prevent_initial_call=True,
)
def process_upload(contents, filename):
    if contents is None:
        return "", html.Div()

    # ── Parse uploaded file ──────────────────────────────────────────────────
    try:
        content_type, content_string = contents.split(",")
        decoded = base64.b64decode(content_string)
        df_raw = pd.read_csv(io.StringIO(decoded.decode("utf-8", errors="replace")))
    except Exception as e:
        return (html.Span(f"❌  Failed to parse file: {e}",
                          style={"color":CLR_ATTACK,"fontSize":"13px"}), html.Div())

    # ── Check required columns ───────────────────────────────────────────────
    missing = [c for c in FEATURE_COLS if c not in df_raw.columns]
    if missing:
        return (
            html.Div([
                html.Span("❌  Missing required columns: ",
                          style={"color":CLR_ATTACK,"fontSize":"13px","fontWeight":"700"}),
                html.Br(),
                html.Code(", ".join(missing),
                          style={"color":"#f1c40f","fontSize":"12px","wordBreak":"break-all"}),
                html.Br(),
                html.Span(f"  Your CSV has: {', '.join(df_raw.columns.tolist())}",
                          style={"color":CLR_SUB,"fontSize":"12px"}),
            ]), html.Div()
        )

    # ── Run inference ────────────────────────────────────────────────────────
    try:
        df_result = _run_inference(df_raw)
    except Exception as e:
        return (html.Span(f"❌  Inference error: {e}",
                          style={"color":CLR_ATTACK,"fontSize":"13px"}), html.Div())

    has_label = "Label" in df_raw.columns

    # ── Summary statistics ───────────────────────────────────────────────────
    n_total   = len(df_result)
    n_attack  = int((df_result["prediction"] == "Attack").sum())
    n_normal  = n_total - n_attack
    n_high    = int((df_result["risk_level"] == "High Risk").sum())
    n_mod     = int((df_result["risk_level"] == "Moderate Risk").sum())
    n_low     = int((df_result["risk_level"] == "Low Risk").sum())

    # ── Upload status banner ─────────────────────────────────────────────────
    status = html.Div([
        html.Span(f"✅  Loaded: ", style={"color":CLR_NORMAL,"fontWeight":"700"}),
        html.Span(f"{filename}  —  {n_total:,} rows processed",
                  style={"color":CLR_TEXT}),
    ], style={"fontSize":"13px"})

    # ── KPI cards ────────────────────────────────────────────────────────────
    kpis = html.Div([
        kpi_card("Total Events",    f"{n_total:,}",    filename[:20], CLR_TEXT,   "📋"),
        kpi_card("Normal",          f"{n_normal:,}",   f"{100*n_normal/n_total:.1f}%", CLR_NORMAL, "✅"),
        kpi_card("Attack",          f"{n_attack:,}",   f"{100*n_attack/n_total:.1f}%", CLR_ATTACK, "⚠️"),
        kpi_card("🔴 High Risk",    f"{n_high:,}",     f"{100*n_high/n_total:.1f}%",   CLR_RISK_H, "🔴"),
        kpi_card("🟡 Moderate Risk",f"{n_mod:,}",      f"{100*n_mod/n_total:.1f}%",    CLR_RISK_M, "🟡"),
        kpi_card("🟢 Low Risk",     f"{n_low:,}",      f"{100*n_low/n_total:.1f}%",    CLR_RISK_L, "🟢"),
    ], style={"display":"flex","gap":"12px","flexWrap":"wrap","marginBottom":"16px"})

    # ── Risk donut ────────────────────────────────────────────────────────────
    risk_counts = df_result["risk_level"].value_counts()
    fig_risk_donut = go.Figure(go.Pie(
        labels=risk_counts.index.tolist(), values=risk_counts.values.tolist(),
        hole=0.55, marker_colors=[RISK_COLOURS.get(l,"#aaa") for l in risk_counts.index],
        textinfo="label+percent+value", textfont_size=11))
    fig_risk_donut.update_layout(**PLOT_BASE, title_text="Risk Level Distribution",
                                  title_x=0.5, height=300, showlegend=False)

    # ── Prediction bar ────────────────────────────────────────────────────────
    pred_counts = df_result["prediction"].value_counts()
    fig_pred = go.Figure(go.Bar(
        x=pred_counts.index.tolist(), y=pred_counts.values.tolist(),
        marker_color=[CLR_ATTACK if p=="Attack" else CLR_NORMAL for p in pred_counts.index],
        text=pred_counts.values.tolist(), textposition="outside"))
    fig_pred.update_layout(**PLOT_BASE, title_text="Prediction: Normal vs Attack",
                            title_x=0.5, height=280)

    # ── Hybrid score distribution ─────────────────────────────────────────────
    fig_score_hist = go.Figure()
    for pred_lbl, clr_ in [("Normal", CLR_NORMAL), ("Attack", CLR_ATTACK)]:
        vals = df_result[df_result["prediction"]==pred_lbl]["hybrid_score_calibrated"]
        if len(vals):
            fig_score_hist.add_trace(go.Histogram(x=vals, nbinsx=50, name=pred_lbl,
                marker_color=clr_, opacity=0.7, histnorm="probability density"))
    fig_score_hist.add_vline(x=DEC_THR, line_dash="dash", line_color="#f1c40f",
                              annotation_text=f"Decision thr={DEC_THR:.3f}",
                              annotation_font_color="#f1c40f")
    fig_score_hist.add_vline(x=RISK_HIGH_THR, line_dash="dot", line_color=CLR_RISK_H,
                              annotation_text="High Risk", annotation_font_color=CLR_RISK_H)
    fig_score_hist.add_vline(x=RISK_MOD_THR, line_dash="dot", line_color=CLR_RISK_M,
                              annotation_text="Moderate Risk", annotation_font_color=CLR_RISK_M)
    fig_score_hist.update_layout(**PLOT_BASE, barmode="overlay",
        title_text="Hybrid Score Distribution — Custom Input", title_x=0.5, height=310,
        legend=dict(orientation="h", y=-0.2))

    # ── Attack category breakdown (if Label column present) ───────────────────
    attack_analysis_section = html.Div()
    if has_label:
        df_result["label_multiclass"] = df_raw["Label"].values
        attack_df = df_result[df_result["prediction"]=="Attack"]
        if len(attack_df):
            cat_counts = attack_df["label_multiclass"].value_counts().reset_index()
            cat_counts.columns = ["Category","Count"]
            fig_cats = px.bar(cat_counts, x="Count", y="Category", orientation="h",
                              color="Count", color_continuous_scale=["#e74c3c","#8e44ad"],
                              title="Detected Attack Categories")
            fig_cats.update_layout(**PLOT_BASE, height=max(280, 30*len(cat_counts)+80),
                                   yaxis=dict(autorange="reversed"),
                                   coloraxis_showscale=False, title_x=0.5)
            # Risk per category
            risk_by_cat = df_result.groupby(["label_multiclass","risk_level"]).size().reset_index(name="count")
            fig_risk_cat = px.bar(risk_by_cat, x="count", y="label_multiclass",
                                  color="risk_level", orientation="h",
                                  color_discrete_map=RISK_COLOURS,
                                  title="Risk Levels per Attack Category")
            fig_risk_cat.update_layout(**PLOT_BASE, height=max(280, 30*len(cat_counts)+80),
                                       yaxis=dict(autorange="reversed"), title_x=0.5,
                                       legend=dict(orientation="h", y=-0.2))
            attack_analysis_section = html.Div([
                html.Div([
                    html.Div(card([dcc.Graph(figure=fig_cats, config={"displayModeBar":False})]),
                             style={"flex":"1","minWidth":"360px"}),
                    html.Div(card([dcc.Graph(figure=fig_risk_cat, config={"displayModeBar":False})]),
                             style={"flex":"1","minWidth":"360px"}),
                ], style={"display":"flex","gap":"14px"}),
            ])

    # ── High-risk events table ─────────────────────────────────────────────────
    high_risk_df = df_result[df_result["risk_level"]=="High Risk"].copy()
    high_risk_section = html.Div()
    if len(high_risk_df):
        show_cols_hr = (["label_multiclass"] if "label_multiclass" in high_risk_df.columns else []) + [
            "lr_prob_calibrated","rf_prob_calibrated",
            "hybrid_score_calibrated","prediction","risk_level","triage_level"
        ]
        show_cols_hr = [c for c in show_cols_hr if c in high_risk_df.columns]
        hr_tbl_cond = {k: v for k, v in TBL.items() if k != "style_data_conditional"}
        hr_tbl_cond["style_data_conditional"] = [
            {"if": {"filter_query": '{risk_level} = "High Risk"',    "column_id": "risk_level"}, "color": CLR_RISK_H, "fontWeight": "bold"},
            {"if": {"filter_query": '{risk_level} = "Moderate Risk"',"column_id": "risk_level"}, "color": CLR_RISK_M, "fontWeight": "bold"},
            {"if": {"filter_query": '{risk_level} = "Low Risk"',     "column_id": "risk_level"}, "color": CLR_RISK_L, "fontWeight": "bold"},
        ]
        high_risk_section = card([
            sec_title(f"High Risk Events ({len(high_risk_df):,} events)", "🔴"),
            dash_table.DataTable(
                data=high_risk_df[show_cols_hr].head(200).round(4).to_dict("records"),
                columns=[{"name":c.replace("_"," ").title(),"id":c} for c in show_cols_hr],
                **hr_tbl_cond, page_size=20, sort_action="native", filter_action="native"),
        ])

    # ── Full results table ────────────────────────────────────────────────────
    all_cols = (["label_multiclass"] if "label_multiclass" in df_result.columns else []) + [
        "lr_prob_calibrated","rf_prob_calibrated",
        "hybrid_score_calibrated","prediction","risk_level","triage_level"
    ]
    all_cols = [c for c in all_cols if c in df_result.columns]
    all_tbl_cond = {k: v for k, v in TBL.items() if k != "style_data_conditional"}
    all_tbl_cond["style_data_conditional"] = [
        {"if": {"filter_query": '{risk_level} = "High Risk"',    "column_id": "risk_level"}, "color": CLR_RISK_H, "fontWeight": "bold"},
        {"if": {"filter_query": '{risk_level} = "Moderate Risk"',"column_id": "risk_level"}, "color": CLR_RISK_M, "fontWeight": "bold"},
        {"if": {"filter_query": '{risk_level} = "Low Risk"',     "column_id": "risk_level"}, "color": CLR_RISK_L, "fontWeight": "bold"},
        {"if": {"filter_query": '{prediction} = "Attack"', "column_id": "prediction"}, "color": CLR_ATTACK},
        {"if": {"filter_query": '{prediction} = "Normal"', "column_id": "prediction"}, "color": CLR_NORMAL},
    ]
    all_tbl_section = card([
        sec_title(f"All Predictions ({n_total:,} rows)", "📋"),
        dash_table.DataTable(
            data=df_result[all_cols].head(500).round(4).to_dict("records"),
            columns=[{"name":c.replace("_"," ").title(),"id":c} for c in all_cols],
            **all_tbl_cond, page_size=25, sort_action="native", filter_action="native"),
        html.P(f"Showing first 500 of {n_total:,} rows",
               style={"color":CLR_SUB,"fontSize":"11px","marginTop":"6px"}),
    ])

    # ── Process flow diagram ──────────────────────────────────────────────────
    pipeline_flow = card([
        sec_title("Analysis Pipeline", "⚙️"),
        html.Div([
            html.Div([html.Div("📂 CSV Upload", style={"fontWeight":"700","color":CLR_TEXT,"fontSize":"13px"}),
                      html.Div(f"{n_total:,} rows", style={"color":CLR_SUB,"fontSize":"11px"})],
                     style={"textAlign":"center","flex":"1"}),
            html.Div("→", style={"color":CLR_BORDER,"fontSize":"20px","alignSelf":"center"}),
            html.Div([html.Div("🔧 Feature Validation", style={"fontWeight":"700","color":CLR_TEXT,"fontSize":"13px"}),
                      html.Div("12 features checked", style={"color":CLR_SUB,"fontSize":"11px"})],
                     style={"textAlign":"center","flex":"1"}),
            html.Div("→", style={"color":CLR_BORDER,"fontSize":"20px","alignSelf":"center"}),
            html.Div([html.Div("🤖 LR + RF Inference", style={"fontWeight":"700","color":CLR_TEXT,"fontSize":"13px"}),
                      html.Div("Raw + calibrated probs", style={"color":CLR_SUB,"fontSize":"11px"})],
                     style={"textAlign":"center","flex":"1"}),
            html.Div("→", style={"color":CLR_BORDER,"fontSize":"20px","alignSelf":"center"}),
            html.Div([html.Div("🔀 Hybrid Score", style={"fontWeight":"700","color":CLR_TEXT,"fontSize":"13px"}),
                      html.Div(f"w_LR={W1:.2f} + w_RF={W2:.2f}", style={"color":CLR_SUB,"fontSize":"11px"})],
                     style={"textAlign":"center","flex":"1"}),
            html.Div("→", style={"color":CLR_BORDER,"fontSize":"20px","alignSelf":"center"}),
            html.Div([html.Div("🎯 Risk Classification", style={"fontWeight":"700","color":CLR_TEXT,"fontSize":"13px"}),
                      html.Div("High / Moderate / Low", style={"color":CLR_SUB,"fontSize":"11px"})],
                     style={"textAlign":"center","flex":"1"}),
            html.Div("→", style={"color":CLR_BORDER,"fontSize":"20px","alignSelf":"center"}),
            html.Div([html.Div("📊 Dashboard", style={"fontWeight":"700","color":CLR_TEXT,"fontSize":"13px"}),
                      html.Div("Full attack analysis", style={"color":CLR_SUB,"fontSize":"11px"})],
                     style={"textAlign":"center","flex":"1"}),
        ], style={"display":"flex","gap":"8px","alignItems":"stretch","flexWrap":"wrap"}),
    ])

    # ── Risk classification key ───────────────────────────────────────────────
    risk_key = card([
        sec_title("Risk Classification Thresholds", "📏"),
        html.Div([
            html.Div([html.Span("🔴  High Risk",     style={"color":CLR_RISK_H,"fontWeight":"700"}),
                      html.Span(f"  Hybrid Score ≥ {RISK_HIGH_THR:.2f}  — Immediate SOC attention required",
                                style={"color":CLR_SUB,"fontSize":"12px"})], style={"marginBottom":"8px"}),
            html.Div([html.Span("🟡  Moderate Risk", style={"color":CLR_RISK_M,"fontWeight":"700"}),
                      html.Span(f"  {RISK_MOD_THR:.2f} ≤ Score < {RISK_HIGH_THR:.2f}  — Review and monitor",
                                style={"color":CLR_SUB,"fontSize":"12px"})], style={"marginBottom":"8px"}),
            html.Div([html.Span("🟢  Low Risk",      style={"color":CLR_RISK_L,"fontWeight":"700"}),
                      html.Span(f"  Score < {RISK_MOD_THR:.2f}  — Likely benign, log for audit",
                                style={"color":CLR_SUB,"fontSize":"12px"})]),
        ]),
        html.Hr(style={"borderColor":CLR_BORDER,"margin":"10px 0"}),
        html.P(f"Decision threshold for Attack/Normal binary split: {DEC_THR:.4f}",
               style={"color":CLR_SUB,"fontSize":"12px"}),
    ])

    results_section = html.Div([
        pipeline_flow,
        kpis,
        risk_key,
        html.Div([
            html.Div(card([dcc.Graph(figure=fig_risk_donut,  config={"displayModeBar":False})]),
                     style={"flex":"1","minWidth":"280px"}),
            html.Div(card([dcc.Graph(figure=fig_pred,        config={"displayModeBar":False})]),
                     style={"flex":"1","minWidth":"280px"}),
        ], style={"display":"flex","gap":"14px"}),
        card([dcc.Graph(figure=fig_score_hist, config={"displayModeBar":False})]),
        attack_analysis_section,
        high_risk_section,
        all_tbl_section,
    ])

    return status, results_section


# ──────────────────────────────────────────────────────────────────────────────

# ─── TAB: Config ──────────────────────────────────────────────────────────────
def tab_config():
    def kv(k, v, vc=CLR_TEXT):
        return html.Div([
            html.Span(k + ":", style={"color": CLR_SUB, "fontSize": "12px",
                                       "display": "inline-block", "width": "280px"}),
            html.Span(str(v), style={"color": vc, "fontSize": "12px", "fontWeight": "500"}),
        ], style={"marginBottom": "6px"})

    def section(title, items):
        return card([sec_title(title), html.Div(items)])

    ds_sec = section("Dataset & Split", [
        kv("Train file",         os.path.basename(cfg.get("dataset_train", ""))),
        kv("Test file",          os.path.basename(cfg.get("dataset_test", ""))),
        kv("Train rows",         f"{cfg.get('n_train', 0):,}"),
        kv("Calibration rows",   f"{cfg.get('n_calibration', 0):,}"),
        kv("Val (tuning) rows",  f"{cfg.get('n_val', 0):,}"),
        kv("Test rows",          f"{cfg.get('n_test', 0):,}"),
        kv("Split method",       cfg.get("split_method", "")),
        kv("Random seed",        cfg.get("random_seed", "")),
        kv("N features",         cfg.get("n_features", "")),
    ])

    feat_sec = section("Feature List", [
        html.Div([
            html.Span(f"  {i+1:>2}. {f}",
                      style={"color": CLR_TEXT, "fontSize": "12px",
                             "fontFamily": "monospace", "display": "block"})
            for i, f in enumerate(cfg.get("feature_list", []))
        ])
    ])

    model_sec = section("Model Hyperparameters", [
        html.P("Logistic Regression", style={"color": CLR_LR, "fontWeight": "600", "fontSize": "13px"}),
        *[kv(k, v) for k, v in cfg.get("lr_params", {}).items()],
        html.P("Random Forest", style={"color": CLR_RF, "fontWeight": "600", "fontSize": "13px",
                                        "marginTop": "10px"}),
        *[kv(k, v) for k, v in cfg.get("rf_params", {}).items()],
    ])

    hybrid_sec = section("Hybrid Configuration (tuned on validation only)", [
        kv("Calibration method",     cfg.get("calibration_method", ""), CLR_HYBRID),
        html.P(cfg.get("note_raw_vs_calibrated", ""),
               style={"color": CLR_SUB, "fontSize": "11px", "lineHeight": "1.6",
                      "marginBottom": "10px", "fontStyle": "italic"}),
        kv("Hybrid weight LR (w1)", f"{W1:.2f}", CLR_LR),
        kv("Hybrid weight RF (w2)", f"{W2:.2f}", CLR_RF),
        kv("Decision threshold",    f"{DEC_THR:.4f}", "#f1c40f"),
        kv("Low triage threshold",  f"{LOW_THR:.4f}", CLR_LOW),
        kv("High triage threshold", f"{HIGH_THR:.4f}", CLR_HIGH),
        kv("LR individual threshold", f"{cfg.get('lr_threshold', 'n/a')}", CLR_LR),
        kv("RF individual threshold", f"{cfg.get('rf_threshold', 'n/a')}", CLR_RF),
    ])

    ws = cfg.get("weight_search_results", [])
    weight_rows = [{"w_LR": r.get("w1_lr"), "w_RF": r.get("w2_rf"),
                    "F1": round(r.get("f1", 0), 4), "Recall": round(r.get("recall", 0), 4)}
                   for r in ws if "w1_lr" in r]
    w_cond = {k: v for k, v in TBL.items() if k != "style_data_conditional"}
    w_cond["style_data_conditional"] = TBL["style_data_conditional"] + [
        {"if": {"filter_query": f"{{w_LR}} = {W1}"}, "backgroundColor": "#1a2a1a", "fontWeight": "bold"},
    ]
    weight_sec = card([
        sec_title("Hybrid Weight Grid Search Results (tuning set)", "🔬"),
        dash_table.DataTable(
            data=weight_rows,
            columns=[{"name": c, "id": c} for c in (weight_rows[0].keys() if weight_rows else [])],
            **w_cond,
        ) if weight_rows else html.P("No weight search data.", style={"color": CLR_SUB}),
    ])

    caveats = cfg.get("evaluation_caveats", [])
    cav_sec = card([
        sec_title("Evaluation Caveats", ""),
        html.Ul([html.Li(c, style={"color": CLR_SUB, "fontSize": "12px", "marginBottom": "6px"})
                 for c in caveats]),
    ]) if caveats else html.Div()

    return html.Div([ds_sec, feat_sec, model_sec, hybrid_sec, weight_sec, cav_sec])


# ─── Callbacks ─────────────────────────────────────────────────────────────────
@callback(Output("tab-content", "children"), Input("tabs", "value"))
def render_tab(tab):
    if tab == "overview":    return tab_overview()
    if tab == "scores":      return tab_scores()
    if tab == "features":    return tab_features()
    if tab == "performance": return tab_performance()
    if tab == "explorer":    return tab_explorer()
    if tab == "custom":      return tab_custom()
    if tab == "config":      return tab_config()
    return html.Div()


@callback(
    Output("ex-table",   "children"),
    Output("ex-summary", "children"),
    Input("ex-triage",   "value"),
    Input("ex-binary",   "value"),
    Input("ex-cat",      "value"),
    Input("ex-rows",     "value"),
)
def update_explorer(triage, binary, cat, n_rows):
    df = pred_test.copy()
    if triage != "all": df = df[df["triage_level"] == triage]
    if binary != "all": df = df[df["label_binary"] == int(binary)]
    if cat    != "all": df = df[df["label_multiclass"] == cat]
    total  = len(df)
    n_show = min(n_rows, total)
    show   = df[[c for c in EXPLORER_DATA_COLS if c in df.columns]].head(n_show).copy()
    for col in ["lr_prob_calibrated", "rf_prob_calibrated", "hybrid_score_calibrated"]:
        if col in show.columns:
            show[col] = show[col].round(4)
    summary = (f"Showing {n_show:,} of {total:,} filtered  |  "
               f"Attack rate: {df['label_binary'].mean()*100:.1f}%  |  "
               f"FN in subset: {int(((df['label_binary']==1)&(df['hybrid_pred']==0)).sum())}")
    tbl_cond = {k: v for k, v in TBL.items() if k != "style_data_conditional"}
    tbl_cond["style_data_conditional"] = TBL["style_data_conditional"] + TRIAGE_COND
    tbl = dash_table.DataTable(
        data=show.to_dict("records"),
        columns=[{"name": c["name"], "id": c["id"]} for c in EXPLORER_COLS if c["id"] in show.columns],
        **tbl_cond, page_size=25, sort_action="native", filter_action="native")
    return tbl, summary


if __name__ == "__main__":
    print("\n" + "="*60)
    print("  Secondary SOC Dashboard")
    print("  Confidence-Based Hybrid ML Framework")
    print("  Models loaded:", MODELS_LOADED)
    print("="*60)
    print("  Open: http://127.0.0.1:8051")
    print("  Press Ctrl+C to stop\n")
    app.run(debug=False, port=8051, host="127.0.0.1")
