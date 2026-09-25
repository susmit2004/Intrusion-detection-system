"""
dashboard.py
============
Interactive SOC Triage Dashboard built with Plotly Dash.

Run AFTER train_and_evaluate.py has been executed:
    python dashboard.py

Then open http://127.0.0.1:8050 in your browser.

All values are read from the results/ directory produced by the
training pipeline — no hard-coded metrics or invented numbers.

Sections
--------
  Overview     : total events, normal vs suspicious, attack categories
  Protocols    : protocol breakdown
  Ports        : top destination ports by traffic volume
  ML Results   : per-record model predictions, probabilities, triage level
  Model Perf.  : confusion matrices, ROC AUC, evaluation metrics table
  Features     : feature importance bar chart, distribution comparison image
"""

import os
import json
import base64

import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import dash
from dash import dcc, html, Input, Output, dash_table
import dash.dash_table.FormatTemplate as FormatTemplate

# ---------------------------------------------------------------------------
# Paths (mirroring src/config.py without importing it to keep dashboard
# self-contained and runnable even if src/ isn't on PYTHONPATH)
# ---------------------------------------------------------------------------
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR  = os.path.join(BASE_DIR, "results")
METRICS_DIR  = os.path.join(RESULTS_DIR, "metrics")
PLOTS_DIR    = os.path.join(RESULTS_DIR, "plots")
PRED_DIR     = os.path.join(RESULTS_DIR, "predictions")
DATA_DIR     = os.path.join(BASE_DIR, "Raw Data")

# ---------------------------------------------------------------------------
# Load results
# ---------------------------------------------------------------------------

def _load_json(path):
    with open(path) as f:
        return json.load(f)

def _load_csv(path):
    return pd.read_csv(path)

def _img_b64(path):
    """Return a data-URI string for embedding a PNG image."""
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    return f"data:image/png;base64,{data}"


# Load artefacts
metadata    = _load_json(os.path.join(METRICS_DIR, "experiment_metadata.json"))
hybrid_cfg  = _load_json(os.path.join(METRICS_DIR, "hybrid_config.json"))
eval_test   = _load_csv(os.path.join(METRICS_DIR, "evaluation_summary_test.csv"))
feat_imp    = _load_csv(os.path.join(METRICS_DIR, "feature_importance.csv"))
preds_test  = _load_csv(os.path.join(PRED_DIR,    "predictions_test.csv"))

# Optionally load raw training data for additional analyses
try:
    df_train_raw = pd.read_excel(
        os.path.join(DATA_DIR, "Primary_training_data.xlsx")
    )
    df_test_raw  = pd.read_excel(
        os.path.join(DATA_DIR, "Primary_testing_data.xlsx")
    )
    df_all = pd.concat([df_train_raw, df_test_raw], ignore_index=True)
    HAS_RAW = True
except Exception:
    HAS_RAW = False

# ---------------------------------------------------------------------------
# Colour palette
# ---------------------------------------------------------------------------
COLOR_NORMAL  = "#2196F3"   # blue
COLOR_ATTACK  = "#F44336"   # red
COLOR_REVIEW  = "#FF9800"   # orange
COLOR_LOW     = "#4CAF50"   # green
TRIAGE_COLORS = {
    "Low Suspicion": COLOR_LOW,
    "Review":        COLOR_REVIEW,
    "High Suspicion": COLOR_ATTACK,
}

# ---------------------------------------------------------------------------
# Helper: KPI card
# ---------------------------------------------------------------------------
def kpi_card(title, value, color="#212121", bg="#F5F5F5"):
    return html.Div([
        html.P(title, style={"margin": 0, "fontSize": "13px",
                             "color": "#666", "fontWeight": "500"}),
        html.H3(value, style={"margin": "4px 0 0 0", "color": color,
                              "fontSize": "26px"}),
    ], style={
        "background": bg, "borderRadius": "8px",
        "padding": "16px 20px", "flex": "1",
        "minWidth": "140px", "boxShadow": "0 1px 4px rgba(0,0,0,0.1)",
    })


# ---------------------------------------------------------------------------
# Pre-compute dashboard values
# ---------------------------------------------------------------------------

# Overview stats from test predictions
total_events = len(preds_test)
n_normal     = int((preds_test["label_binary"] == 0).sum())
n_attack     = int((preds_test["label_binary"] == 1).sum())
n_detected   = int((preds_test["hybrid_pred"]  == 1).sum())
n_missed     = int(
    ((preds_test["label_binary"] == 1) & (preds_test["hybrid_pred"] == 0)).sum()
)

triage_counts = preds_test["triage_level"].value_counts().reset_index()
triage_counts.columns = ["Triage Level", "Count"]

# Attack categories (multiclass)
attack_cats = preds_test.loc[
    preds_test["label_binary"] == 1, "label_multiclass"
].value_counts().reset_index()
attack_cats.columns = ["Category", "Count"]

# Protocol distribution (from raw data if available)
if HAS_RAW:
    proto_counts = df_all["proto"].value_counts().reset_index()
    proto_counts.columns = ["Protocol", "Count"]

    # Top dest ports (non-ICMP)
    port_df = df_all[df_all["dest_port_clean"] > 0]["dest_port_clean"].value_counts().head(15).reset_index()
    port_df.columns = ["Destination Port", "Count"]

    # Temporal (hourly) attack pattern
    df_all["timestamp_dt"] = pd.to_datetime(df_all["timestamp"], utc=True)
    df_all["hour"]         = df_all["timestamp_dt"].dt.hour
    hourly = df_all.groupby(["hour", "label_binary"]).size().reset_index(name="Count")
    hourly["label"] = hourly["label_binary"].map({0: "Normal", 1: "Attack"})

# Hybrid config values
w1 = hybrid_cfg["w1_lr"]
w2 = hybrid_cfg["w2_rf"]
dec_thr  = hybrid_cfg["decision_threshold"]
low_thr  = hybrid_cfg["low_triage_threshold"]
high_thr = hybrid_cfg["high_triage_threshold"]

# Model performance metrics for display
eval_display = eval_test.copy()
for col in ["Accuracy", "Precision", "Recall", "F1", "ROC_AUC"]:
    if col in eval_display.columns:
        eval_display[col] = eval_display[col].map(lambda x: f"{x:.4f}")

# ---------------------------------------------------------------------------
# Figures
# ---------------------------------------------------------------------------

def fig_triage_pie():
    colors = [TRIAGE_COLORS.get(t, "#999") for t in triage_counts["Triage Level"]]
    fig = px.pie(
        triage_counts, values="Count", names="Triage Level",
        color_discrete_sequence=colors,
        title="SOC Triage Level Distribution (Test Set)",
        hole=0.4,
    )
    fig.update_layout(margin=dict(t=40, b=10), height=300)
    return fig


def fig_attack_categories():
    fig = px.bar(
        attack_cats, x="Count", y="Category", orientation="h",
        color="Count", color_continuous_scale="Reds",
        title="Attack / Alert Categories (Test Set)",
        labels={"Count": "Event Count"},
    )
    fig.update_layout(margin=dict(t=40, b=10), height=340, yaxis={"categoryorder": "total ascending"})
    return fig


def fig_protocol():
    if not HAS_RAW:
        return go.Figure()
    fig = px.bar(
        proto_counts, x="Protocol", y="Count",
        color="Count", color_continuous_scale="Blues",
        title="Protocol Distribution (All Events)",
    )
    fig.update_layout(margin=dict(t=40, b=10), height=280)
    return fig


def fig_top_ports():
    if not HAS_RAW:
        return go.Figure()
    fig = px.bar(
        port_df, x="Destination Port", y="Count",
        color="Count", color_continuous_scale="Oranges",
        title="Top 15 Destination Ports",
    )
    port_df["Destination Port"] = port_df["Destination Port"].astype(str)
    fig.update_layout(
        margin=dict(t=40, b=10), height=280,
        xaxis=dict(type="category"),
    )
    return fig


def fig_hourly_traffic():
    if not HAS_RAW:
        return go.Figure()
    fig = px.bar(
        hourly, x="hour", y="Count", color="label",
        color_discrete_map={"Normal": COLOR_NORMAL, "Attack": COLOR_ATTACK},
        barmode="stack",
        title="Hourly Traffic Distribution (Normal vs Attack)",
        labels={"hour": "Hour of Day", "Count": "Event Count"},
    )
    fig.update_layout(margin=dict(t=40, b=10), height=280)
    return fig


def fig_feature_importance():
    top_n = feat_imp.head(15).sort_values("importance")
    fig = px.bar(
        top_n, x="importance", y="feature", orientation="h",
        color="importance", color_continuous_scale="RdYlGn",
        title="Top 15 RF Feature Importances",
        labels={"importance": "Mean Gini Decrease", "feature": ""},
    )
    fig.update_layout(margin=dict(t=40, b=10), height=400)
    return fig


def fig_prob_scatter():
    """Scatter of LR prob vs RF prob, coloured by hybrid prediction."""
    sample = preds_test.sample(min(2000, len(preds_test)), random_state=42)
    sample["Prediction"] = sample["hybrid_pred"].map({0: "Normal", 1: "Attack"})
    fig = px.scatter(
        sample, x="lr_prob", y="rf_prob",
        color="Prediction",
        color_discrete_map={"Normal": COLOR_NORMAL, "Attack": COLOR_ATTACK},
        opacity=0.5,
        title="LR Probability vs RF Probability (Test Sample, coloured by Hybrid Prediction)",
        labels={"lr_prob": "LR Probability", "rf_prob": "RF Probability"},
    )
    fig.add_shape(type="line", x0=0.5, x1=0.5, y0=0, y1=1,
                  line=dict(dash="dash", color="grey", width=1))
    fig.add_shape(type="line", x0=0, x1=1, y0=0.5, y1=0.5,
                  line=dict(dash="dash", color="grey", width=1))
    fig.update_layout(margin=dict(t=40, b=10), height=380)
    return fig


def fig_hybrid_score_hist():
    fig = go.Figure()
    for label_val, label_name, color in [(0, "Normal", COLOR_NORMAL), (1, "Attack", COLOR_ATTACK)]:
        scores = preds_test.loc[preds_test["label_binary"] == label_val, "hybrid_score_calibrated"]
        fig.add_trace(go.Histogram(
            x=scores, name=label_name, opacity=0.6,
            marker_color=color, nbinsx=60,
        ))
    fig.add_vline(x=dec_thr,  line_dash="dash", line_color="black",
                  annotation_text=f"Decision thr ({dec_thr:.3f})")
    fig.add_vline(x=low_thr,  line_dash="dot",  line_color=COLOR_LOW,
                  annotation_text=f"Low thr ({low_thr:.3f})")
    fig.add_vline(x=high_thr, line_dash="dot",  line_color=COLOR_ATTACK,
                  annotation_text=f"High thr ({high_thr:.3f})")
    fig.update_layout(
        barmode="overlay",
        title="Hybrid Calibrated Score Distribution by True Label",
        xaxis_title="Hybrid Score (calibrated)",
        yaxis_title="Count",
        height=320,
        margin=dict(t=50, b=10),
        legend=dict(orientation="h"),
    )
    return fig


# ---------------------------------------------------------------------------
# Dash layout
# ---------------------------------------------------------------------------

app = dash.Dash(
    __name__,
    title="SOC Alert Triage Dashboard",
    meta_tags=[{"name": "viewport", "content": "width=device-width, initial-scale=1"}],
)

# Pre-build embedded images (may not exist if pipeline not run)
def _safe_img(filename):
    path = os.path.join(PLOTS_DIR, filename)
    if not os.path.exists(path):
        return None
    return _img_b64(path)


IMG_CM_LR      = _safe_img("cm_lr_test.png")
IMG_CM_RF      = _safe_img("cm_rf_test.png")
IMG_CM_HYBRID  = _safe_img("cm_hybrid_test.png")
IMG_ROC        = _safe_img("roc_comparison_test.png")
IMG_FEAT_DIST  = _safe_img("feature_distribution_comparison.png")

SECTION_STYLE = {
    "background": "#FFFFFF", "borderRadius": "10px",
    "padding": "24px", "marginBottom": "20px",
    "boxShadow": "0 2px 6px rgba(0,0,0,0.08)",
}
HEADER_STYLE = {
    "color": "#1565C0", "fontWeight": "bold",
    "fontSize": "17px", "marginBottom": "12px",
    "borderBottom": "2px solid #E3F2FD", "paddingBottom": "6px",
}

app.layout = html.Div(style={"background": "#F0F4F8", "minHeight": "100vh",
                              "fontFamily": "Segoe UI, Arial, sans-serif",
                              "padding": "20px 28px"}, children=[

    # ---- Top header ----
    html.Div([
        html.H1("🛡️ SOC Alert Triage Dashboard",
                style={"color": "#0D47A1", "margin": 0, "fontSize": "26px"}),
        html.P(
            f"Confidence-Based Hybrid ML Framework  |  "
            f"Dataset: {metadata['dataset_version']}  |  "
            f"Seed: {metadata['random_seed']}  |  "
            f"Train={metadata['n_train']}  Val={metadata['n_val']}  Test={metadata['n_test']}",
            style={"color": "#555", "margin": "4px 0 0 0", "fontSize": "12px"},
        ),
    ], style={"marginBottom": "20px"}),

    # ---- KPI row ----
    html.Div([
        kpi_card("Total Test Events",    f"{total_events:,}"),
        kpi_card("Normal Traffic",       f"{n_normal:,}   ({100*n_normal/total_events:.1f}%)",
                 color=COLOR_NORMAL, bg="#E3F2FD"),
        kpi_card("Suspicious/Attack",    f"{n_attack:,}   ({100*n_attack/total_events:.1f}%)",
                 color=COLOR_ATTACK, bg="#FFEBEE"),
        kpi_card("Hybrid Detected",      f"{n_detected:,}", color="#388E3C", bg="#E8F5E9"),
        kpi_card("Missed Attacks (FN)",  f"{n_missed}",     color="#E53935", bg="#FFEBEE"),
        kpi_card("Hybrid w₁(LR)",        f"{w1:.2f}"),
        kpi_card("Hybrid w₂(RF)",        f"{w2:.2f}"),
        kpi_card("Decision Threshold",   f"{dec_thr:.4f}"),
    ], style={"display": "flex", "gap": "12px", "flexWrap": "wrap",
              "marginBottom": "20px"}),

    # ---- Calibration note ----
    html.Div([
        html.P(
            "⚠️  Note on Confidence Scores: The hybrid scores shown are "
            "post-hoc calibrated probabilities (isotonic regression fitted on "
            "the validation set). They align predicted probabilities with "
            "observed frequencies but remain probabilistic estimates — not "
            "guaranteed confidence percentages.",
            style={"margin": 0, "fontSize": "12px", "color": "#5D4037"},
        )
    ], style={**SECTION_STYLE, "background": "#FFF8E1", "padding": "10px 16px",
              "marginBottom": "20px"}),

    # ---- Row: Triage Pie + Attack Categories ----
    html.Div([
        html.Div([
            html.H4("Triage Overview", style=HEADER_STYLE),
            dcc.Graph(figure=fig_triage_pie(), config={"displayModeBar": False}),
        ], style={**SECTION_STYLE, "flex": "1", "minWidth": "320px"}),

        html.Div([
            html.H4("Attack Categories", style=HEADER_STYLE),
            dcc.Graph(figure=fig_attack_categories(), config={"displayModeBar": False}),
        ], style={**SECTION_STYLE, "flex": "2", "minWidth": "380px"}),
    ], style={"display": "flex", "gap": "16px", "flexWrap": "wrap"}),

    # ---- Row: Protocol + Top Ports + Hourly ----
    html.Div([
        html.Div([
            html.H4("Protocol Distribution", style=HEADER_STYLE),
            dcc.Graph(figure=fig_protocol(), config={"displayModeBar": False}),
        ], style={**SECTION_STYLE, "flex": "1", "minWidth": "280px"}),

        html.Div([
            html.H4("Top Destination Ports", style=HEADER_STYLE),
            dcc.Graph(figure=fig_top_ports(), config={"displayModeBar": False}),
        ], style={**SECTION_STYLE, "flex": "1.5", "minWidth": "320px"}),

        html.Div([
            html.H4("Hourly Traffic Pattern", style=HEADER_STYLE),
            dcc.Graph(figure=fig_hourly_traffic(), config={"displayModeBar": False}),
        ], style={**SECTION_STYLE, "flex": "1.5", "minWidth": "320px"}),
    ], style={"display": "flex", "gap": "16px", "flexWrap": "wrap"}),

    # ---- Hybrid Score Distribution ----
    html.Div([
        html.H4("Hybrid Calibrated Score Distribution", style=HEADER_STYLE),
        html.P(
            "The histogram shows hybrid score separation between true Normal and Attack events. "
            "Vertical lines indicate the tuned decision threshold and SOC triage band boundaries "
            "(both derived from validation data).",
            style={"fontSize": "12px", "color": "#555", "marginBottom": "8px"},
        ),
        dcc.Graph(figure=fig_hybrid_score_hist(), config={"displayModeBar": False}),
    ], style=SECTION_STYLE),

    # ---- LR vs RF probability scatter ----
    html.Div([
        html.H4("LR Probability vs RF Probability", style=HEADER_STYLE),
        dcc.Graph(figure=fig_prob_scatter(), config={"displayModeBar": False}),
    ], style=SECTION_STYLE),

    # ---- Model Performance Table ----
    html.Div([
        html.H4("Model Performance — Test Set", style=HEADER_STYLE),
        html.P(
            "Metrics computed on the held-out test set.  "
            "Recall for the Attack class is highlighted because false negatives "
            "(missed attacks) are the primary risk in SOC triage.",
            style={"fontSize": "12px", "color": "#555", "marginBottom": "10px"},
        ),
        dash_table.DataTable(
            id="eval-table",
            columns=[{"name": c, "id": c} for c in eval_display.columns],
            data=eval_display.to_dict("records"),
            style_table={"overflowX": "auto"},
            style_header={
                "backgroundColor": "#1565C0", "color": "white",
                "fontWeight": "bold", "fontSize": "13px",
            },
            style_cell={
                "textAlign": "center", "padding": "8px",
                "fontFamily": "monospace", "fontSize": "13px",
            },
            style_data_conditional=[
                {"if": {"column_id": "Recall",  "filter_query": "{Model} = 'Hybrid'"},
                 "backgroundColor": "#E8F5E9", "color": "#1B5E20", "fontWeight": "bold"},
                {"if": {"column_id": "Model",   "filter_query": "{Model} = 'Hybrid'"},
                 "backgroundColor": "#E3F2FD"},
            ],
        ),
    ], style=SECTION_STYLE),

    # ---- Confusion Matrices ----
    html.Div([
        html.H4("Confusion Matrices — Test Set", style=HEADER_STYLE),
        html.Div([
            html.Div([
                html.P("Logistic Regression", style={"textAlign": "center",
                       "fontWeight": "bold", "color": "#555"}),
                html.Img(src=IMG_CM_LR, style={"width": "100%", "maxWidth": "380px"}),
            ], style={"flex": "1", "textAlign": "center"}) if IMG_CM_LR else html.Div(),

            html.Div([
                html.P("Random Forest", style={"textAlign": "center",
                       "fontWeight": "bold", "color": "#555"}),
                html.Img(src=IMG_CM_RF, style={"width": "100%", "maxWidth": "380px"}),
            ], style={"flex": "1", "textAlign": "center"}) if IMG_CM_RF else html.Div(),

            html.Div([
                html.P("Hybrid Model", style={"textAlign": "center",
                       "fontWeight": "bold", "color": "#555"}),
                html.Img(src=IMG_CM_HYBRID, style={"width": "100%", "maxWidth": "380px"}),
            ], style={"flex": "1", "textAlign": "center"}) if IMG_CM_HYBRID else html.Div(),
        ], style={"display": "flex", "gap": "16px", "flexWrap": "wrap",
                  "justifyContent": "center"}),
    ], style=SECTION_STYLE),

    # ---- ROC Curves ----
    html.Div([
        html.H4("ROC Curve Comparison — Test Set", style=HEADER_STYLE),
        html.Img(src=IMG_ROC, style={"width": "100%", "maxWidth": "620px",
                                     "display": "block", "margin": "0 auto"})
        if IMG_ROC else html.P("ROC curve image not found."),
    ], style=SECTION_STYLE),

    # ---- Feature Importance ----
    html.Div([
        html.H4("Random Forest Feature Importance", style=HEADER_STYLE),
        html.P(
            "Mean Gini impurity decrease across all trees. Higher values indicate "
            "features that contribute most to separating normal from suspicious traffic.",
            style={"fontSize": "12px", "color": "#555", "marginBottom": "8px"},
        ),
        dcc.Graph(figure=fig_feature_importance(), config={"displayModeBar": False}),
    ], style=SECTION_STYLE),

    # ---- Feature Distribution Comparison ----
    html.Div([
        html.H4("Feature Distribution: Normal vs Attack", style=HEADER_STYLE),
        html.Img(
            src=IMG_FEAT_DIST,
            style={"width": "100%", "maxWidth": "1100px",
                   "display": "block", "margin": "0 auto"},
        ) if IMG_FEAT_DIST else html.P("Feature distribution image not found."),
    ], style=SECTION_STYLE),

    # ---- Hybrid Configuration Summary ----
    html.Div([
        html.H4("Hybrid Model Configuration", style=HEADER_STYLE),
        html.Div([
            html.Div([
                html.B("Hybrid Score Formula: "),
                html.Span(f"  {w1:.2f} × LR_calibrated_prob  +  {w2:.2f} × RF_calibrated_prob"),
            ], style={"marginBottom": "6px", "fontFamily": "monospace"}),
            html.Div([
                html.B("Decision Threshold: "),
                html.Span(f"{dec_thr:.4f}  (tuned on validation set by maximising F1)"),
            ], style={"marginBottom": "6px"}),
            html.Div([
                html.B("SOC Triage Bands: "),
                html.Span(
                    f"Low Suspicion < {low_thr:.4f} ≤ Review < {high_thr:.4f} ≤ High Suspicion"
                ),
            ], style={"marginBottom": "6px"}),
            html.Div([
                html.B("Calibration Method: "),
                html.Span("Isotonic regression (cv='prefit') fitted on validation set"),
            ], style={"marginBottom": "6px"}),
            html.Div([
                html.B("Optimisation Criterion: "),
                html.Span(hybrid_cfg.get("optimisation_criterion", "f1")),
            ]),
        ], style={"fontSize": "13px", "lineHeight": "1.8"}),
    ], style=SECTION_STYLE),

    # ---- Per-record predictions explorer ----
    html.Div([
        html.H4("Prediction Explorer — Test Set (filterable)", style=HEADER_STYLE),
        html.Div([
            html.Label("Filter by Triage Level:", style={"fontWeight": "bold", "marginRight": "8px"}),
            dcc.Dropdown(
                id="triage-filter",
                options=[{"label": "All", "value": "All"}] + [
                    {"label": t, "value": t}
                    for t in ["Low Suspicion", "Review", "High Suspicion"]
                ],
                value="All",
                clearable=False,
                style={"width": "240px", "display": "inline-block"},
            ),
            html.Label("Filter by True Label:", style={"fontWeight": "bold",
                        "marginLeft": "24px", "marginRight": "8px"}),
            dcc.Dropdown(
                id="label-filter",
                options=[
                    {"label": "All",          "value": "All"},
                    {"label": "Normal (0)",   "value": 0},
                    {"label": "Attack (1)",   "value": 1},
                ],
                value="All",
                clearable=False,
                style={"width": "200px", "display": "inline-block"},
            ),
        ], style={"marginBottom": "12px", "display": "flex", "alignItems": "center"}),

        dash_table.DataTable(
            id="pred-table",
            columns=[
                {"name": "Timestamp",      "id": "timestamp"},
                {"name": "Alert Category", "id": "label_multiclass"},
                {"name": "True Label",     "id": "label_binary"},
                {"name": "LR Prob",        "id": "lr_prob",    "type": "numeric",
                 "format": {"specifier": ".4f"}},
                {"name": "LR Pred",        "id": "lr_pred"},
                {"name": "RF Prob",        "id": "rf_prob",    "type": "numeric",
                 "format": {"specifier": ".4f"}},
                {"name": "RF Pred",        "id": "rf_pred"},
                {"name": "Hybrid Score",   "id": "hybrid_score_calibrated",
                 "type": "numeric", "format": {"specifier": ".4f"}},
                {"name": "Hybrid Pred",    "id": "hybrid_pred"},
                {"name": "Triage Level",   "id": "triage_level"},
            ],
            page_size=15,
            filter_action="none",   # controlled via dropdowns above
            sort_action="native",
            style_table={"overflowX": "auto"},
            style_header={
                "backgroundColor": "#1565C0", "color": "white",
                "fontWeight": "bold", "fontSize": "12px",
            },
            style_cell={
                "textAlign": "left", "padding": "6px 10px",
                "fontSize": "12px", "maxWidth": "220px",
                "overflow": "hidden", "textOverflow": "ellipsis",
            },
            style_data_conditional=[
                {"if": {"filter_query": '{triage_level} = "High Suspicion"'},
                 "backgroundColor": "#FFEBEE"},
                {"if": {"filter_query": '{triage_level} = "Review"'},
                 "backgroundColor": "#FFF3E0"},
                {"if": {"filter_query": '{triage_level} = "Low Suspicion"'},
                 "backgroundColor": "#E8F5E9"},
            ],
        ),
    ], style=SECTION_STYLE),

    # ---- Footer ----
    html.Div([
        html.P(
            f"Generated by: Confidence-Based Hybrid ML Framework for SOC Alert Triage  |  "
            f"Random Seed: {metadata['random_seed']}  |  "
            f"Calibration: {metadata['calibration_method']}  |  "
            f"Split: {metadata['split_method']}",
            style={"color": "#999", "fontSize": "11px", "textAlign": "center", "margin": 0},
        )
    ], style={"marginTop": "10px", "marginBottom": "20px"}),
])


# ---------------------------------------------------------------------------
# Callbacks
# ---------------------------------------------------------------------------

@app.callback(
    Output("pred-table", "data"),
    Input("triage-filter", "value"),
    Input("label-filter",  "value"),
)
def update_pred_table(triage_val, label_val):
    df = preds_test.copy()
    if triage_val != "All":
        df = df[df["triage_level"] == triage_val]
    if label_val != "All":
        df = df[df["label_binary"] == int(label_val)]
    return df.to_dict("records")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("\n🛡️  SOC Alert Triage Dashboard")
    print("   Opening at http://127.0.0.1:8050")
    print("   Press Ctrl+C to stop\n")
    app.run(debug=False, host="127.0.0.1", port=8050)
