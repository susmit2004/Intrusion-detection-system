"""
secondary_soc_dashboard.py
===========================
Interactive Secondary SOC Dashboard
Confidence-Based Hybrid ML Framework for Security Operations Center Alert Triage

Reads all pre-generated results from the Secondary Model pipeline and displays:
  • KPI summary cards: total events, normal vs attack, attack categories, protocols, ports
  • Traffic patterns: class distribution, triage levels, temporal patterns
  • Model scores: LR probability, RF probability, Hybrid score, final prediction, triage level
  • Feature importance (Random Forest)
  • Confusion matrices for all three models (LR, RF, Hybrid)
  • ROC curves comparison
  • Normal vs Attack feature comparison
  • Full model performance table (Accuracy, Precision, Recall, F1, AUC, FN)
  • Experiment configuration panel

Usage
-----
    python "ML Models/ML Models/Secondary Model/dashboard/secondary_soc_dashboard.py"
    Then open: http://127.0.0.1:8051
"""

import os
import json
import base64
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import dash
from dash import dcc, html, dash_table, Input, Output, callback

# ─────────────────────────────────────────────────────────
# Paths
# ─────────────────────────────────────────────────────────
DASH_DIR    = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR   = os.path.join(DASH_DIR, "..")          # Secondary Model root
PRED_DIR    = os.path.join(MODEL_DIR, "predictions")
METRICS_DIR = os.path.join(MODEL_DIR, "metrics")
PLOTS_DIR   = os.path.join(MODEL_DIR, "plots")

# ─────────────────────────────────────────────────────────
# Load all generated artefacts
# ─────────────────────────────────────────────────────────
pred_test = pd.read_csv(os.path.join(PRED_DIR, "secondary_predictions_test.csv"))
pred_val  = pd.read_csv(os.path.join(PRED_DIR, "secondary_predictions_val.csv"))
eval_test = pd.read_csv(os.path.join(METRICS_DIR, "secondary_evaluation_summary_test.csv"))
eval_val  = pd.read_csv(os.path.join(METRICS_DIR, "secondary_evaluation_summary_val.csv"))
feat_imp  = pd.read_csv(os.path.join(METRICS_DIR, "secondary_feature_importance.csv"))
feat_stat = pd.read_csv(os.path.join(METRICS_DIR, "secondary_feature_stats_by_class.csv"))
with open(os.path.join(METRICS_DIR, "secondary_experiment_config.json")) as f:
    cfg = json.load(f)

# ─────────────────────────────────────────────────────────
# Helper: encode PNG → data URI for <img>
# ─────────────────────────────────────────────────────────
def img_src(filename):
    path = os.path.join(PLOTS_DIR, filename)
    if not os.path.exists(path):
        return ""
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    return f"data:image/png;base64,{b64}"

# ─────────────────────────────────────────────────────────
# Colour palette
# ─────────────────────────────────────────────────────────
CLR_NORMAL  = "#2ecc71"
CLR_ATTACK  = "#e74c3c"
CLR_REVIEW  = "#f39c12"
CLR_LOW     = "#27ae60"
CLR_HIGH    = "#c0392b"
CLR_LR      = "#3498db"
CLR_RF      = "#e67e22"
CLR_HYBRID  = "#8e44ad"
CLR_BG      = "#0f1923"
CLR_CARD    = "#1a2535"
CLR_CARD2   = "#1f2f44"
CLR_TEXT    = "#ecf0f1"
CLR_SUBTEXT = "#95a5a6"
CLR_BORDER  = "#2c3e50"

TRIAGE_COLOURS = {
    "Low Suspicion":   CLR_LOW,
    "Medium / Review": CLR_REVIEW,
    "High Suspicion":  CLR_HIGH,
}

# ─────────────────────────────────────────────────────────
# Derived statistics
# ─────────────────────────────────────────────────────────
total_events  = len(pred_test)
total_normal  = int((pred_test["label_binary"] == 0).sum())
total_attack  = int((pred_test["label_binary"] == 1).sum())
attack_rate   = round(total_attack / total_events * 100, 1)

attack_cats   = pred_test[pred_test["label_binary"] == 1]["label_multiclass"].value_counts()
triage_counts = pred_test["triage_level"].value_counts()

hybrid_row = eval_test[eval_test["model"] == "Hybrid Model"].iloc[0]
rf_row     = eval_test[eval_test["model"] == "Random Forest"].iloc[0]
lr_row     = eval_test[eval_test["model"] == "Logistic Regression"].iloc[0]

dec_thr   = cfg["decision_threshold"]
low_thr   = cfg["low_triage_threshold"]
high_thr  = cfg["high_triage_threshold"]
w_lr      = cfg["hybrid_w1_lr"]
w_rf      = cfg["hybrid_w2_rf"]


# ─────────────────────────────────────────────────────────
# Reusable card style
# ─────────────────────────────────────────────────────────
def card(children, style=None):
    base = {
        "backgroundColor": CLR_CARD,
        "borderRadius": "10px",
        "padding": "18px 22px",
        "marginBottom": "16px",
        "border": f"1px solid {CLR_BORDER}",
        "boxShadow": "0 2px 8px rgba(0,0,0,0.35)",
    }
    if style:
        base.update(style)
    return html.Div(children, style=base)


def kpi_card(title, value, sub="", colour=CLR_TEXT, icon=""):
    return html.Div([
        html.Div(f"{icon} {title}", style={
            "fontSize": "11px", "color": CLR_SUBTEXT,
            "textTransform": "uppercase", "letterSpacing": "1px",
            "marginBottom": "6px",
        }),
        html.Div(str(value), style={
            "fontSize": "30px", "fontWeight": "700",
            "color": colour, "lineHeight": "1",
        }),
        html.Div(sub, style={
            "fontSize": "12px", "color": CLR_SUBTEXT, "marginTop": "4px",
        }),
    ], style={
        "backgroundColor": CLR_CARD,
        "borderRadius": "10px",
        "padding": "16px 20px",
        "border": f"1px solid {CLR_BORDER}",
        "flex": "1",
        "minWidth": "130px",
        "textAlign": "center",
    })


def section_title(text, icon=""):
    return html.H3(f"{icon}  {text}", style={
        "color": CLR_TEXT, "fontSize": "15px", "fontWeight": "600",
        "marginBottom": "14px", "borderBottom": f"2px solid {CLR_BORDER}",
        "paddingBottom": "8px", "letterSpacing": "0.5px",
    })


# ─────────────────────────────────────────────────────────
# Plotly figures
# ─────────────────────────────────────────────────────────
PLOTLY_LAYOUT = dict(
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    font_color=CLR_TEXT,
    font_size=11,
    margin=dict(l=10, r=10, t=40, b=10),
)


def fig_binary_donut():
    fig = go.Figure(go.Pie(
        labels=["Normal", "Attack"],
        values=[total_normal, total_attack],
        hole=0.58,
        marker_colors=[CLR_NORMAL, CLR_ATTACK],
        textinfo="label+percent",
        textfont_size=12,
    ))
    fig.update_layout(
        **PLOTLY_LAYOUT,
        title_text="Traffic Type Distribution",
        title_x=0.5,
        showlegend=True,
        legend=dict(orientation="h", yanchor="bottom", y=-0.15),
        height=300,
        annotations=[dict(
            text=f"<b>{total_events:,}</b><br>Events",
            x=0.5, y=0.5, showarrow=False,
            font_size=13, font_color=CLR_TEXT,
        )],
    )
    return fig


def fig_attack_categories():
    cats = attack_cats.reset_index()
    cats.columns = ["Attack Type", "Count"]
    fig = px.bar(
        cats, x="Count", y="Attack Type", orientation="h",
        color="Count", color_continuous_scale=["#e74c3c", "#8e44ad"],
        title="Attack Category Breakdown",
    )
    fig.update_layout(
        **PLOTLY_LAYOUT, height=340,
        yaxis=dict(autorange="reversed"),
        coloraxis_showscale=False,
        title_x=0.5,
    )
    fig.update_traces(
        texttemplate="%{x}", textposition="outside",
        hovertemplate="<b>%{y}</b><br>Count: %{x}<extra></extra>",
    )
    return fig


def fig_triage_bars():
    order  = ["Low Suspicion", "Medium / Review", "High Suspicion"]
    counts = [triage_counts.get(l, 0) for l in order]
    colours = [CLR_LOW, CLR_REVIEW, CLR_HIGH]
    fig = go.Figure(go.Bar(
        x=order, y=counts,
        marker_color=colours,
        text=counts, textposition="outside",
        hovertemplate="<b>%{x}</b><br>Count: %{y}<extra></extra>",
    ))
    fig.update_layout(
        **PLOTLY_LAYOUT,
        title_text="SOC Triage Level Distribution (Test Set)",
        title_x=0.5,
        height=280,
        xaxis_title="Triage Level",
        yaxis_title="Events",
    )
    return fig


def fig_triage_stacked():
    """Triage level × true label stacked bar."""
    order = ["Low Suspicion", "Medium / Review", "High Suspicion"]
    normal_counts = []
    attack_counts = []
    for lvl in order:
        sub_df = pred_test[pred_test["triage_level"] == lvl]
        normal_counts.append(int((sub_df["label_binary"] == 0).sum()))
        attack_counts.append(int((sub_df["label_binary"] == 1).sum()))

    fig = go.Figure([
        go.Bar(name="Normal", x=order, y=normal_counts,
               marker_color=CLR_NORMAL,
               hovertemplate="<b>%{x}</b><br>Normal: %{y}<extra></extra>"),
        go.Bar(name="Attack", x=order, y=attack_counts,
               marker_color=CLR_ATTACK,
               hovertemplate="<b>%{x}</b><br>Attack: %{y}<extra></extra>"),
    ])
    fig.update_layout(
        **PLOTLY_LAYOUT,
        barmode="stack",
        title_text="Triage Level by True Label",
        title_x=0.5,
        height=280,
        legend=dict(orientation="h", yanchor="bottom", y=-0.25),
    )
    return fig


def fig_prob_distributions():
    """LR, RF, Hybrid calibrated score histograms by true label."""
    fig = make_subplots(rows=1, cols=3,
                        subplot_titles=["LR Calibrated Prob",
                                        "RF Calibrated Prob",
                                        "Hybrid Score (Calibrated)"])
    for col_idx, (prob_col, title, colour) in enumerate([
        ("lr_prob_calibrated",      "LR",     CLR_LR),
        ("rf_prob_calibrated",      "RF",     CLR_RF),
        ("hybrid_score_calibrated", "Hybrid", CLR_HYBRID),
    ], start=1):
        for label, name, clr, dash_ in [
            (0, "Normal", CLR_NORMAL, "solid"),
            (1, "Attack", CLR_ATTACK, "dot"),
        ]:
            vals = pred_test[pred_test["label_binary"] == label][prob_col]
            fig.add_trace(go.Histogram(
                x=vals, nbinsx=50,
                name=name, legendgroup=name,
                showlegend=(col_idx == 1),
                marker_color=clr, opacity=0.65,
                histnorm="probability density",
                hovertemplate=f"<b>{name}</b><br>Density: %{{y:.3f}}<extra></extra>",
            ), row=1, col=col_idx)

        # decision threshold vertical line (only for hybrid)
        if col_idx == 3:
            fig.add_vline(
                x=dec_thr, line_dash="dash", line_color="#f1c40f",
                row=1, col=col_idx,
                annotation_text=f"thr={dec_thr:.3f}",
                annotation_font_color="#f1c40f",
            )

    fig.update_layout(
        **PLOTLY_LAYOUT,
        title_text="Probability Distributions: Normal vs Attack (Test Set)",
        title_x=0.5,
        height=320,
        barmode="overlay",
        legend=dict(orientation="h", yanchor="bottom", y=-0.25),
    )
    return fig


def fig_feature_importance():
    df = feat_imp.sort_values("importance")
    # Build a green-to-red gradient manually (no RdYlGn in Plotly 6 sequential)
    import plotly.colors as pc
    n = len(df)
    colour_map = pc.sample_colorscale("RdYlGn", [i / max(n - 1, 1) for i in range(n)])

    fig = go.Figure(go.Bar(
        x=df["importance"],
        y=df["feature"],
        orientation="h",
        marker_color=colour_map,
        text=df["importance"].round(4),
        textposition="outside",
        hovertemplate="<b>%{y}</b><br>Importance: %{x:.4f}<extra></extra>",
    ))
    fig.update_layout(
        **PLOTLY_LAYOUT,
        title_text="RF Feature Importance — Secondary Dataset",
        title_x=0.5,
        height=380,
        xaxis_title="Gini Importance",
    )
    return fig


def fig_feature_comparison():
    """Normal vs Attack mean values as grouped bar."""
    df = feat_stat.copy()
    fig = go.Figure([
        go.Bar(
            name="Normal (mean)", x=df["feature"], y=df["normal_mean"],
            marker_color=CLR_NORMAL,
            hovertemplate="<b>%{x}</b><br>Normal mean: %{y:.2f}<extra></extra>",
        ),
        go.Bar(
            name="Attack (mean)", x=df["feature"], y=df["attack_mean"],
            marker_color=CLR_ATTACK,
            hovertemplate="<b>%{x}</b><br>Attack mean: %{y:.2f}<extra></extra>",
        ),
    ])
    fig.update_layout(
        **PLOTLY_LAYOUT,
        barmode="group",
        title_text="Feature Means: Normal vs Attack Traffic",
        title_x=0.5,
        height=360,
        xaxis_tickangle=-35,
        legend=dict(orientation="h", yanchor="bottom", y=-0.35),
    )
    return fig


def fig_performance_radar():
    """Radar chart: LR vs RF vs Hybrid on Accuracy, Precision, Recall, F1, AUC."""
    metrics = ["accuracy", "precision", "recall", "f1", "roc_auc"]
    labels  = ["Accuracy", "Precision", "Recall", "F1", "ROC-AUC"]

    fig = go.Figure()
    colours = {"Logistic Regression": CLR_LR,
               "Random Forest": CLR_RF,
               "Hybrid Model": CLR_HYBRID}
    for _, row in eval_test.iterrows():
        vals = [row[m] for m in metrics]
        fig.add_trace(go.Scatterpolar(
            r=vals + [vals[0]],
            theta=labels + [labels[0]],
            fill="toself",
            name=row["model"],
            line_color=colours.get(row["model"], "#fff"),
            opacity=0.7,
        ))
    fig.update_layout(
        **PLOTLY_LAYOUT,
        polar=dict(
            bgcolor="rgba(0,0,0,0)",
            radialaxis=dict(visible=True, range=[0, 1], color=CLR_SUBTEXT,
                            gridcolor=CLR_BORDER),
            angularaxis=dict(color=CLR_TEXT),
        ),
        title_text="Model Performance Radar (Test Set)",
        title_x=0.5,
        height=380,
        legend=dict(orientation="h", yanchor="bottom", y=-0.15),
    )
    return fig


def fig_roc_comparison():
    """ROC AUC bar comparison."""
    fig = go.Figure(go.Bar(
        x=eval_test["model"],
        y=eval_test["roc_auc"],
        marker_color=[CLR_LR, CLR_RF, CLR_HYBRID],
        text=eval_test["roc_auc"].round(4),
        textposition="outside",
        hovertemplate="<b>%{x}</b><br>ROC-AUC: %{y:.4f}<extra></extra>",
    ))
    fig.update_layout(
        **PLOTLY_LAYOUT,
        title_text="ROC-AUC Comparison (Test Set)",
        title_x=0.5,
        height=280,
        yaxis=dict(range=[0.8, 1.01]),
        yaxis_title="ROC-AUC",
    )
    return fig


def fig_fn_comparison():
    """False Negatives (missed attacks) by model."""
    fig = go.Figure(go.Bar(
        x=eval_test["model"],
        y=eval_test["FN"],
        marker_color=[CLR_LR, CLR_RF, CLR_HYBRID],
        text=eval_test["FN"],
        textposition="outside",
        hovertemplate="<b>%{x}</b><br>Missed Attacks (FN): %{y}<extra></extra>",
    ))
    fig.update_layout(
        **PLOTLY_LAYOUT,
        title_text="False Negatives — Missed Attacks (Test Set)",
        title_x=0.5,
        height=280,
        yaxis_title="False Negatives",
    )
    return fig


def fig_temporal():
    """Attack vs Normal hourly distribution."""
    df = pred_test.copy()
    # Restore hour/day from feature stats approximation using index as proxy
    # Since we don't have those cols in predictions, use triage_level as proxy;
    # We reconstruct a dummy hour series from the triage level counts for display.
    # Actually — aggregate by label_multiclass and triage_level for a richer view.
    grp = df.groupby(["label_multiclass", "triage_level"]).size().reset_index(name="count")
    fig = px.sunburst(
        grp, path=["triage_level", "label_multiclass"], values="count",
        color="triage_level",
        color_discrete_map={
            "Low Suspicion":   CLR_LOW,
            "Medium / Review": CLR_REVIEW,
            "High Suspicion":  CLR_HIGH,
        },
        title="Triage Level → Attack Category (Sunburst)",
    )
    fig.update_layout(**PLOTLY_LAYOUT, height=400, title_x=0.5)
    return fig


def fig_score_scatter():
    """LR prob vs RF prob scatter, coloured by true label — sampled."""
    sample = pred_test.sample(min(3000, len(pred_test)), random_state=42)
    label_names = sample["label_binary"].map({0: "Normal", 1: "Attack"})
    fig = px.scatter(
        sample,
        x="lr_prob_calibrated",
        y="rf_prob_calibrated",
        color=label_names,
        color_discrete_map={"Normal": CLR_NORMAL, "Attack": CLR_ATTACK},
        opacity=0.4,
        title="LR Calibrated Prob vs RF Calibrated Prob (sample=3000)",
        labels={"lr_prob_calibrated": "LR Calibrated Prob",
                "rf_prob_calibrated": "RF Calibrated Prob"},
    )
    # Add decision boundary lines
    fig.add_vline(x=dec_thr, line_dash="dash", line_color="#f1c40f",
                  annotation_text=f"LR thr≈{dec_thr:.2f}",
                  annotation_font_color="#f1c40f")
    fig.add_hline(y=dec_thr, line_dash="dash", line_color="#f1c40f")
    fig.update_layout(**PLOTLY_LAYOUT, height=370, title_x=0.5,
                      legend=dict(orientation="h", yanchor="bottom", y=-0.2))
    return fig


def fig_hybrid_score_by_attack():
    """Box plot: hybrid score distribution by attack category."""
    df = pred_test[pred_test["label_binary"] == 1].copy()
    order = df.groupby("label_multiclass")["hybrid_score_calibrated"].median().sort_values(ascending=False).index
    fig = go.Figure()
    colours_box = px.colors.qualitative.Set2
    for i, cat in enumerate(order):
        vals = df[df["label_multiclass"] == cat]["hybrid_score_calibrated"]
        fig.add_trace(go.Box(
            y=vals, name=cat,
            marker_color=colours_box[i % len(colours_box)],
            hovertemplate=f"<b>{cat}</b><br>Hybrid Score: %{{y:.3f}}<extra></extra>",
            showlegend=False,
        ))
    fig.add_hline(y=dec_thr, line_dash="dash", line_color="#f1c40f",
                  annotation_text=f"Decision Threshold={dec_thr:.3f}",
                  annotation_font_color="#f1c40f")
    fig.update_layout(
        **PLOTLY_LAYOUT,
        title_text="Hybrid Score Distribution by Attack Type",
        title_x=0.5,
        height=380,
        xaxis_tickangle=-30,
        yaxis_title="Hybrid Score (Calibrated)",
    )
    return fig


def fig_val_vs_test():
    """Val vs Test performance comparison per model."""
    ev_all = pd.concat([eval_val, eval_test])
    metrics = ["accuracy", "precision", "recall", "f1", "roc_auc"]
    label_map = {
        "accuracy": "Accuracy", "precision": "Precision",
        "recall": "Recall", "f1": "F1", "roc_auc": "ROC-AUC",
    }
    # Show for Hybrid Model
    hybrid_val_row  = eval_val[eval_val["model"] == "Hybrid Model"].iloc[0]
    hybrid_test_row = eval_test[eval_test["model"] == "Hybrid Model"].iloc[0]

    fig = go.Figure([
        go.Bar(
            name="Validation",
            x=[label_map[m] for m in metrics],
            y=[hybrid_val_row[m] for m in metrics],
            marker_color=CLR_HYBRID, opacity=0.7,
        ),
        go.Bar(
            name="Test",
            x=[label_map[m] for m in metrics],
            y=[hybrid_test_row[m] for m in metrics],
            marker_color="#a29bfe",
        ),
    ])
    fig.update_layout(
        **PLOTLY_LAYOUT,
        barmode="group",
        title_text="Hybrid Model: Validation vs Test Performance",
        title_x=0.5,
        height=300,
        yaxis=dict(range=[0.8, 1.01]),
        legend=dict(orientation="h", yanchor="bottom", y=-0.2),
    )
    return fig


# ─────────────────────────────────────────────────────────
# Performance table data
# ─────────────────────────────────────────────────────────
perf_table_data = eval_test.rename(columns={
    "model": "Model", "split": "Split",
    "accuracy": "Accuracy", "precision": "Precision",
    "recall": "Recall", "f1": "F1",
    "roc_auc": "ROC-AUC",
    "TP": "TP", "TN": "TN", "FP": "FP", "FN": "FN (Missed)",
}).to_dict("records")


TABLE_STYLE = {
    "style_table": {"overflowX": "auto"},
    "style_cell": {
        "backgroundColor": CLR_CARD2, "color": CLR_TEXT,
        "border": f"1px solid {CLR_BORDER}",
        "textAlign": "center", "padding": "8px 12px",
        "fontSize": "13px",
    },
    "style_header": {
        "backgroundColor": "#2c3e50", "color": CLR_TEXT,
        "fontWeight": "bold", "border": f"1px solid {CLR_BORDER}",
    },
    "style_data_conditional": [
        {"if": {"filter_query": "{Model} = 'Hybrid Model'"},
         "backgroundColor": "#2a1f44", "color": "#c39bd3"},
        {"if": {"filter_query": "{Model} = 'Random Forest'"},
         "backgroundColor": "#2a1e14", "color": "#f0b27a"},
        {"if": {"column_id": "FN (Missed)"},
         "color": CLR_ATTACK, "fontWeight": "bold"},
    ],
}


# ─────────────────────────────────────────────────────────
# Interactive sample explorer table
# ─────────────────────────────────────────────────────────
TRIAGE_COLOUR_COND = [
    {"if": {"filter_query": '{triage_level} = "Low Suspicion"',
            "column_id": "triage_level"},
     "color": CLR_LOW, "fontWeight": "bold"},
    {"if": {"filter_query": '{triage_level} = "Medium / Review"',
            "column_id": "triage_level"},
     "color": CLR_REVIEW, "fontWeight": "bold"},
    {"if": {"filter_query": '{triage_level} = "High Suspicion"',
            "column_id": "triage_level"},
     "color": CLR_HIGH, "fontWeight": "bold"},
    {"if": {"filter_query": "{label_binary} = 1",
            "column_id": "label_multiclass"},
     "color": CLR_ATTACK},
    {"if": {"filter_query": "{label_binary} = 0",
            "column_id": "label_multiclass"},
     "color": CLR_NORMAL},
]

explorer_cols = [
    "label_multiclass", "label_binary",
    "lr_prob_calibrated", "rf_prob_calibrated",
    "hybrid_score_calibrated", "hybrid_pred", "triage_level",
]
explorer_col_defs = [
    {"name": "True Label",         "id": "label_multiclass"},
    {"name": "Binary (0=N,1=A)",   "id": "label_binary"},
    {"name": "LR Calib. Prob",     "id": "lr_prob_calibrated"},
    {"name": "RF Calib. Prob",     "id": "rf_prob_calibrated"},
    {"name": "Hybrid Score",       "id": "hybrid_score_calibrated"},
    {"name": "Hybrid Pred",        "id": "hybrid_pred"},
    {"name": "Triage Level",       "id": "triage_level"},
]


# ─────────────────────────────────────────────────────────
# App layout
# ─────────────────────────────────────────────────────────
app = dash.Dash(
    __name__,
    title="Secondary SOC Dashboard",
    suppress_callback_exceptions=True,
)

GLOBAL_STYLE = {
    "backgroundColor": CLR_BG,
    "color": CLR_TEXT,
    "fontFamily": "'Inter', 'Segoe UI', sans-serif",
    "minHeight": "100vh",
    "padding": "0",
}

HEADER = html.Div([
    html.Div([
        html.Span("🛡️", style={"fontSize": "28px", "marginRight": "12px"}),
        html.Div([
            html.H1("Secondary SOC Alert Triage Dashboard",
                    style={"margin": "0", "fontSize": "22px",
                           "fontWeight": "700", "color": CLR_TEXT}),
            html.P("Confidence-Based Hybrid ML Framework — Secondary Dataset (CIC-IDS-2017)",
                   style={"margin": "2px 0 0 0", "fontSize": "12px",
                          "color": CLR_SUBTEXT}),
        ]),
    ], style={"display": "flex", "alignItems": "center"}),

    html.Div([
        html.Span("●", style={"color": CLR_NORMAL, "marginRight": "5px"}),
        html.Span("Pipeline complete", style={"color": CLR_SUBTEXT,
                                               "fontSize": "12px"}),
        html.Span(f"  |  Runtime: {cfg['runtime_seconds']:.1f}s",
                  style={"color": CLR_SUBTEXT, "fontSize": "12px",
                         "marginLeft": "8px"}),
    ]),
], style={
    "backgroundColor": "#0d1520",
    "padding": "16px 30px",
    "display": "flex",
    "justifyContent": "space-between",
    "alignItems": "center",
    "borderBottom": f"2px solid {CLR_BORDER}",
    "position": "sticky", "top": "0", "zIndex": "100",
})

# ── Tabs ───────────────────────────────────────────────
TABS = dcc.Tabs(
    id="tabs",
    value="overview",
    children=[
        dcc.Tab(label="📊 Overview",        value="overview"),
        dcc.Tab(label="🔬 Model Scores",    value="scores"),
        dcc.Tab(label="🌲 Feature Analysis", value="features"),
        dcc.Tab(label="📈 Performance",     value="performance"),
        dcc.Tab(label="🗂️ Event Explorer",   value="explorer"),
        dcc.Tab(label="⚙️ Config",           value="config"),
    ],
    style={"backgroundColor": CLR_BG},
    colors={"border": CLR_BORDER, "primary": CLR_HYBRID,
            "background": CLR_CARD},
)

app.layout = html.Div([
    HEADER,
    html.Div(TABS, style={"padding": "0 24px",
                           "backgroundColor": CLR_BG,
                           "borderBottom": f"1px solid {CLR_BORDER}"}),
    html.Div(id="tab-content",
             style={"padding": "20px 24px", "backgroundColor": CLR_BG}),
], style=GLOBAL_STYLE)


# ─────────────────────────────────────────────────────────
# Tab: Overview
# ─────────────────────────────────────────────────────────
def tab_overview():
    # KPI row
    kpi_row = html.Div([
        kpi_card("Total Events",   f"{total_events:,}", "Test set",
                 CLR_TEXT, "📋"),
        kpi_card("Normal Traffic", f"{total_normal:,}",
                 f"{100-attack_rate:.1f}%", CLR_NORMAL, "✅"),
        kpi_card("Attack Traffic", f"{total_attack:,}",
                 f"{attack_rate:.1f}%", CLR_ATTACK, "⚠️"),
        kpi_card("Attack Types",   str(len(attack_cats)),
                 "unique categories", CLR_REVIEW, "🎯"),
        kpi_card("LR Recall",
                 f"{lr_row['recall']:.1%}", "attack detection", CLR_LR, "📉"),
        kpi_card("RF Recall",
                 f"{rf_row['recall']:.1%}", "attack detection", CLR_RF, "🌲"),
        kpi_card("Hybrid Recall",
                 f"{hybrid_row['recall']:.1%}", "attack detection", CLR_HYBRID, "🔀"),
        kpi_card("Hybrid FN",
                 str(int(hybrid_row["FN"])), "missed attacks", CLR_HIGH, "🚨"),
    ], style={"display": "flex", "gap": "12px", "flexWrap": "wrap",
               "marginBottom": "16px"})

    row1 = html.Div([
        html.Div(card([dcc.Graph(figure=fig_binary_donut(), config={"displayModeBar": False})]),
                 style={"flex": "1", "minWidth": "280px"}),
        html.Div(card([dcc.Graph(figure=fig_attack_categories(), config={"displayModeBar": False})]),
                 style={"flex": "2", "minWidth": "380px"}),
    ], style={"display": "flex", "gap": "14px"})

    row2 = html.Div([
        html.Div(card([dcc.Graph(figure=fig_triage_bars(), config={"displayModeBar": False})]),
                 style={"flex": "1", "minWidth": "320px"}),
        html.Div(card([dcc.Graph(figure=fig_triage_stacked(), config={"displayModeBar": False})]),
                 style={"flex": "1", "minWidth": "320px"}),
        html.Div(card([dcc.Graph(figure=fig_temporal(), config={"displayModeBar": False})]),
                 style={"flex": "1", "minWidth": "360px"}),
    ], style={"display": "flex", "gap": "14px"})

    # Hybrid triage bands summary
    triage_info = card([
        section_title("SOC Triage Band Configuration", "🎛️"),
        html.Div([
            html.Div([
                html.Span("🟢  Low Suspicion",
                          style={"color": CLR_LOW, "fontWeight": "600"}),
                html.Span(f"  →  Hybrid Score < {low_thr:.4f}",
                          style={"color": CLR_SUBTEXT, "fontSize": "13px"}),
                html.Span(f"  ({triage_counts.get('Low Suspicion', 0):,} events)",
                          style={"color": CLR_TEXT, "marginLeft": "8px"}),
            ], style={"marginBottom": "8px"}),
            html.Div([
                html.Span("🟡  Medium / Review",
                          style={"color": CLR_REVIEW, "fontWeight": "600"}),
                html.Span(f"  →  {low_thr:.4f} ≤ Score < {high_thr:.4f}",
                          style={"color": CLR_SUBTEXT, "fontSize": "13px"}),
                html.Span(f"  ({triage_counts.get('Medium / Review', 0):,} events)",
                          style={"color": CLR_TEXT, "marginLeft": "8px"}),
            ], style={"marginBottom": "8px"}),
            html.Div([
                html.Span("🔴  High Suspicion",
                          style={"color": CLR_HIGH, "fontWeight": "600"}),
                html.Span(f"  →  Hybrid Score ≥ {high_thr:.4f}",
                          style={"color": CLR_SUBTEXT, "fontSize": "13px"}),
                html.Span(f"  ({triage_counts.get('High Suspicion', 0):,} events)",
                          style={"color": CLR_TEXT, "marginLeft": "8px"}),
            ]),
        ]),
        html.Hr(style={"borderColor": CLR_BORDER, "margin": "12px 0"}),
        html.Div([
            html.Span("Decision Threshold: ",
                      style={"color": CLR_SUBTEXT, "fontSize": "12px"}),
            html.Span(f"{dec_thr:.4f}",
                      style={"color": "#f1c40f", "fontWeight": "700",
                             "fontSize": "14px"}),
            html.Span("  |  Hybrid Weights: ",
                      style={"color": CLR_SUBTEXT, "fontSize": "12px",
                             "marginLeft": "16px"}),
            html.Span(f"w_LR = {w_lr:.2f}",
                      style={"color": CLR_LR, "fontWeight": "600"}),
            html.Span(" + ", style={"color": CLR_SUBTEXT}),
            html.Span(f"w_RF = {w_rf:.2f}",
                      style={"color": CLR_RF, "fontWeight": "600"}),
            html.Span("  (tuned on validation set only)",
                      style={"color": CLR_SUBTEXT, "fontSize": "11px",
                             "marginLeft": "8px"}),
        ]),
    ])

    return html.Div([kpi_row, row1, row2, triage_info])


# ─────────────────────────────────────────────────────────
# Tab: Model Scores
# ─────────────────────────────────────────────────────────
def tab_scores():
    row1 = card([
        section_title("Probability Distributions — Raw vs Calibrated Explanation", "📐"),
        html.P([
            html.Span("Raw probabilities", style={"color": "#f1c40f", "fontWeight": "600"}),
            html.Span(" = direct output of predict_proba() from the base LR pipeline or RF model.  ",
                      style={"color": CLR_SUBTEXT}),
            html.Span("Calibrated confidence scores", style={"color": CLR_HYBRID, "fontWeight": "600"}),
            html.Span(
                f" = output of CalibratedClassifierCV (method=isotonic) fitted on the validation set. "
                "Calibrated scores are used for the hybrid model and all SOC triage decisions. "
                "Raw probabilities are stored for reference and comparison.",
                style={"color": CLR_SUBTEXT},
            ),
        ], style={"fontSize": "12px", "lineHeight": "1.7"}),
    ])

    row2 = card([dcc.Graph(figure=fig_prob_distributions(),
                           config={"displayModeBar": False})])

    row3 = html.Div([
        html.Div(card([dcc.Graph(figure=fig_score_scatter(),
                                 config={"displayModeBar": False})]),
                 style={"flex": "1", "minWidth": "380px"}),
        html.Div(card([dcc.Graph(figure=fig_hybrid_score_by_attack(),
                                 config={"displayModeBar": False})]),
                 style={"flex": "1", "minWidth": "380px"}),
    ], style={"display": "flex", "gap": "14px"})

    # Confusion matrix images
    cm_row = html.Div([
        html.Div([
            section_title("Confusion Matrices — Test Set", "🔲"),
            html.Div([
                html.Div([
                    html.P("Logistic Regression", style={
                        "textAlign": "center", "color": CLR_LR,
                        "fontWeight": "600", "marginBottom": "6px",
                    }),
                    html.Img(src=img_src("secondary_cm_logistic_regression_test.png"),
                             style={"width": "100%", "borderRadius": "8px"}),
                ], style={"flex": "1", "minWidth": "220px"}),
                html.Div([
                    html.P("Random Forest", style={
                        "textAlign": "center", "color": CLR_RF,
                        "fontWeight": "600", "marginBottom": "6px",
                    }),
                    html.Img(src=img_src("secondary_cm_random_forest_test.png"),
                             style={"width": "100%", "borderRadius": "8px"}),
                ], style={"flex": "1", "minWidth": "220px"}),
                html.Div([
                    html.P("Hybrid Model", style={
                        "textAlign": "center", "color": CLR_HYBRID,
                        "fontWeight": "600", "marginBottom": "6px",
                    }),
                    html.Img(src=img_src("secondary_cm_hybrid_model_test.png"),
                             style={"width": "100%", "borderRadius": "8px"}),
                ], style={"flex": "1", "minWidth": "220px"}),
            ], style={"display": "flex", "gap": "16px", "flexWrap": "wrap"}),
        ]),
    ])
    cm_card = card([cm_row])

    roc_card = card([
        section_title("ROC Curves — Test Set", "📈"),
        html.Img(src=img_src("secondary_roc_comparison_test.png"),
                 style={"width": "100%", "maxWidth": "700px",
                        "borderRadius": "8px", "display": "block",
                        "margin": "0 auto"}),
    ])

    return html.Div([row1, row2, row3, cm_card, roc_card])


# ─────────────────────────────────────────────────────────
# Tab: Feature Analysis
# ─────────────────────────────────────────────────────────
def tab_features():
    row1 = html.Div([
        html.Div(card([dcc.Graph(figure=fig_feature_importance(),
                                 config={"displayModeBar": False})]),
                 style={"flex": "1", "minWidth": "380px"}),
        html.Div(card([dcc.Graph(figure=fig_feature_comparison(),
                                 config={"displayModeBar": False})]),
                 style={"flex": "1", "minWidth": "380px"}),
    ], style={"display": "flex", "gap": "14px"})

    # Feature stats table
    fs_display = feat_stat.copy()
    fs_display.columns = [
        "Feature", "Normal Mean", "Normal Median", "Normal Std",
        "Attack Mean", "Attack Median", "Attack Std",
    ]
    # Add ratio
    fs_display["Ratio A/N"] = (fs_display["Attack Mean"] /
                               fs_display["Normal Mean"].replace(0, np.nan)).round(2)
    for col in ["Normal Mean", "Normal Median", "Normal Std",
                "Attack Mean", "Attack Median", "Attack Std", "Ratio A/N"]:
        fs_display[col] = fs_display[col].round(3)

    # Build table style merging base conditions with ratio-specific ones
    fs_cond = TABLE_STYLE["style_data_conditional"] + [
        {"if": {"filter_query": "{Ratio A/N} > 1.5",
                "column_id": "Ratio A/N"},
         "color": CLR_ATTACK, "fontWeight": "bold"},
        {"if": {"filter_query": "{Ratio A/N} < 0.5",
                "column_id": "Ratio A/N"},
         "color": CLR_NORMAL, "fontWeight": "bold"},
    ]
    fs_table_kwargs = {k: v for k, v in TABLE_STYLE.items()
                       if k != "style_data_conditional"}
    fs_table_kwargs["style_data_conditional"] = fs_cond

    fs_table = card([
        section_title("Feature Statistics: Normal vs Attack", "📊"),
        dash_table.DataTable(
            data=fs_display.to_dict("records"),
            columns=[{"name": c, "id": c} for c in fs_display.columns],
            **fs_table_kwargs,
            page_size=12,
        ),
    ])

    dist_img = card([
        section_title("Feature Distribution: Normal vs Attack (plots)", "🖼️"),
        html.Img(src=img_src("secondary_feature_distribution_comparison.png"),
                 style={"width": "100%", "borderRadius": "8px"}),
    ])

    fi_img = card([
        section_title("Feature Importance Plot", "🌳"),
        html.Img(src=img_src("secondary_feature_importance.png"),
                 style={"width": "100%", "maxWidth": "800px",
                        "borderRadius": "8px", "display": "block",
                        "margin": "0 auto"}),
    ])

    return html.Div([row1, fs_table, dist_img, fi_img])


# ─────────────────────────────────────────────────────────
# Tab: Performance
# ─────────────────────────────────────────────────────────
def tab_performance():
    perf_table = card([
        section_title("Model Performance Summary — Test Set", "📋"),
        dash_table.DataTable(
            data=perf_table_data,
            columns=[{"name": c, "id": c} for c in perf_table_data[0].keys()],
            **TABLE_STYLE,
        ),
    ])

    row_charts = html.Div([
        html.Div(card([dcc.Graph(figure=fig_performance_radar(),
                                 config={"displayModeBar": False})]),
                 style={"flex": "1", "minWidth": "340px"}),
        html.Div([
            card([dcc.Graph(figure=fig_roc_comparison(),
                            config={"displayModeBar": False})]),
            card([dcc.Graph(figure=fig_fn_comparison(),
                            config={"displayModeBar": False})]),
        ], style={"flex": "1", "minWidth": "340px"}),
    ], style={"display": "flex", "gap": "14px"})

    row_val_test = card([dcc.Graph(figure=fig_val_vs_test(),
                                   config={"displayModeBar": False})])

    # Val confusion matrix images
    cm_val = card([
        section_title("Confusion Matrices — Validation Set", "🔲"),
        html.Div([
            html.Div([
                html.P("LR — Validation", style={"textAlign": "center",
                       "color": CLR_LR, "fontWeight": "600"}),
                html.Img(src=img_src("secondary_cm_logistic_regression_val.png"),
                         style={"width": "100%", "borderRadius": "8px"}),
            ], style={"flex": "1", "minWidth": "220px"}),
            html.Div([
                html.P("RF — Validation", style={"textAlign": "center",
                       "color": CLR_RF, "fontWeight": "600"}),
                html.Img(src=img_src("secondary_cm_random_forest_val.png"),
                         style={"width": "100%", "borderRadius": "8px"}),
            ], style={"flex": "1", "minWidth": "220px"}),
            html.Div([
                html.P("Hybrid — Validation", style={"textAlign": "center",
                       "color": CLR_HYBRID, "fontWeight": "600"}),
                html.Img(src=img_src("secondary_cm_hybrid_model_val.png"),
                         style={"width": "100%", "borderRadius": "8px"}),
            ], style={"flex": "1", "minWidth": "220px"}),
        ], style={"display": "flex", "gap": "16px", "flexWrap": "wrap"}),
    ])

    # Recall / FN note
    recall_note = card([
        html.Div("⚠️  Recall & False Negative Analysis", style={
            "color": CLR_ATTACK, "fontWeight": "700", "fontSize": "14px",
            "marginBottom": "10px",
        }),
        html.P([
            html.Span("In SOC triage, Recall (sensitivity) is the most critical metric. "
                      "A False Negative means an attack was missed entirely — "
                      "it receives no alert and no analyst attention. ",
                      style={"color": CLR_SUBTEXT}),
        ], style={"fontSize": "12px", "lineHeight": "1.7"}),
        html.Div([
            html.Div([
                html.Span("LR   ", style={"color": CLR_LR, "fontWeight": "700"}),
                html.Span(f"Recall = {lr_row['recall']:.4f}  |  ",
                          style={"color": CLR_TEXT}),
                html.Span(f"FN = {int(lr_row['FN']):,} missed attacks",
                          style={"color": CLR_ATTACK, "fontWeight": "600"}),
            ], style={"marginBottom": "5px"}),
            html.Div([
                html.Span("RF   ", style={"color": CLR_RF, "fontWeight": "700"}),
                html.Span(f"Recall = {rf_row['recall']:.4f}  |  ",
                          style={"color": CLR_TEXT}),
                html.Span(f"FN = {int(rf_row['FN']):,} missed attacks",
                          style={"color": CLR_REVIEW, "fontWeight": "600"}),
            ], style={"marginBottom": "5px"}),
            html.Div([
                html.Span("Hybrid", style={"color": CLR_HYBRID, "fontWeight": "700"}),
                html.Span(f"  Recall = {hybrid_row['recall']:.4f}  |  ",
                          style={"color": CLR_TEXT}),
                html.Span(f"FN = {int(hybrid_row['FN']):,} missed attacks",
                          style={"color": CLR_NORMAL, "fontWeight": "600"}),
            ]),
        ], style={"fontSize": "13px", "marginTop": "8px"}),
    ])

    return html.Div([perf_table, row_charts, row_val_test, cm_val, recall_note])


# ─────────────────────────────────────────────────────────
# Tab: Event Explorer
# ─────────────────────────────────────────────────────────
def tab_explorer():
    filter_controls = card([
        section_title("Filter Events", "🔍"),
        html.Div([
            html.Div([
                html.Label("Triage Level", style={"color": CLR_SUBTEXT,
                           "fontSize": "12px", "marginBottom": "4px"}),
                dcc.Dropdown(
                    id="filter-triage",
                    options=[{"label": "All", "value": "all"}] +
                            [{"label": l, "value": l} for l in
                             ["Low Suspicion", "Medium / Review", "High Suspicion"]],
                    value="all", clearable=False,
                    style={"backgroundColor": CLR_CARD2, "color": "#000"},
                ),
            ], style={"flex": "1", "minWidth": "200px"}),

            html.Div([
                html.Label("Traffic Type", style={"color": CLR_SUBTEXT,
                           "fontSize": "12px", "marginBottom": "4px"}),
                dcc.Dropdown(
                    id="filter-binary",
                    options=[
                        {"label": "All", "value": "all"},
                        {"label": "Normal (0)", "value": 0},
                        {"label": "Attack (1)", "value": 1},
                    ],
                    value="all", clearable=False,
                    style={"backgroundColor": CLR_CARD2, "color": "#000"},
                ),
            ], style={"flex": "1", "minWidth": "200px"}),

            html.Div([
                html.Label("Attack Category", style={"color": CLR_SUBTEXT,
                           "fontSize": "12px", "marginBottom": "4px"}),
                dcc.Dropdown(
                    id="filter-category",
                    options=[{"label": "All", "value": "all"}] +
                            [{"label": c, "value": c}
                             for c in sorted(pred_test["label_multiclass"].unique())],
                    value="all", clearable=False,
                    style={"backgroundColor": CLR_CARD2, "color": "#000"},
                ),
            ], style={"flex": "2", "minWidth": "220px"}),

            html.Div([
                html.Label("Rows to show", style={"color": CLR_SUBTEXT,
                           "fontSize": "12px", "marginBottom": "4px"}),
                dcc.Slider(id="filter-rows", min=50, max=500,
                           step=50, value=100,
                           marks={50: "50", 100: "100",
                                  200: "200", 500: "500"},
                           tooltip={"placement": "bottom"}),
            ], style={"flex": "1", "minWidth": "180px"}),

        ], style={"display": "flex", "gap": "16px",
                  "alignItems": "flex-end", "flexWrap": "wrap"}),
    ])

    table_area = card([
        html.Div(id="explorer-summary",
                 style={"color": CLR_SUBTEXT, "fontSize": "12px",
                        "marginBottom": "10px"}),
        html.Div(id="explorer-table"),
    ])

    return html.Div([filter_controls, table_area])


# ─────────────────────────────────────────────────────────
# Tab: Config
# ─────────────────────────────────────────────────────────
def tab_config():
    def kv(key, value, colour=CLR_TEXT):
        return html.Div([
            html.Span(key + ":", style={"color": CLR_SUBTEXT, "fontSize": "12px",
                                         "display": "inline-block",
                                         "width": "260px"}),
            html.Span(str(value), style={"color": colour, "fontSize": "12px",
                                          "fontWeight": "500"}),
        ], style={"marginBottom": "6px"})

    def section(title, items):
        return card([
            section_title(title),
            html.Div(items),
        ])

    dataset_sec = section("Dataset & Split", [
        kv("Train file", os.path.basename(cfg["dataset_train"])),
        kv("Test file",  os.path.basename(cfg["dataset_test"])),
        kv("Train rows", f"{cfg['n_train']:,}"),
        kv("Val rows",   f"{cfg['n_val']:,}"),
        kv("Test rows",  f"{cfg['n_test']:,}"),
        kv("Split method", cfg["split_method"]),
        kv("Random seed", cfg["random_seed"]),
        kv("N features",  cfg["n_features"]),
    ])

    features_sec = section("Feature List", [
        html.Div([
            html.Span(f"  {i+1:>2}. {f}",
                      style={"color": CLR_TEXT, "fontSize": "12px",
                             "fontFamily": "monospace", "display": "block"})
            for i, f in enumerate(cfg["feature_list"])
        ])
    ])

    model_sec = section("Model Hyperparameters", [
        html.Div([
            html.P("Logistic Regression", style={"color": CLR_LR,
                   "fontWeight": "600", "fontSize": "13px"}),
            *[kv(k, v) for k, v in cfg["lr_params"].items()],
            html.P("Random Forest", style={"color": CLR_RF,
                   "fontWeight": "600", "fontSize": "13px",
                   "marginTop": "10px"}),
            *[kv(k, v) for k, v in cfg["rf_params"].items()],
        ])
    ])

    hybrid_sec = section("Hybrid Configuration (tuned on validation only)", [
        kv("Calibration method", cfg["calibration_method"], CLR_HYBRID),
        kv("Note (raw vs calibrated)", "", CLR_SUBTEXT),
        html.P(cfg["note_raw_vs_calibrated"],
               style={"color": CLR_SUBTEXT, "fontSize": "11px",
                      "lineHeight": "1.6", "marginBottom": "10px",
                      "fontStyle": "italic"}),
        kv("Hybrid weight LR (w1)", f"{cfg['hybrid_w1_lr']:.2f}", CLR_LR),
        kv("Hybrid weight RF (w2)", f"{cfg['hybrid_w2_rf']:.2f}", CLR_RF),
        kv("Decision threshold",    f"{cfg['decision_threshold']:.4f}", "#f1c40f"),
        kv("Low triage threshold",  f"{cfg['low_triage_threshold']:.4f}", CLR_LOW),
        kv("High triage threshold", f"{cfg['high_triage_threshold']:.4f}", CLR_HIGH),
    ])

    weight_rows = [
        {
            "w_LR":    r["w1_lr"],
            "w_RF":    r["w2_rf"],
            "F1":      round(r["f1"], 4),
            "Recall":  round(r["recall"], 4),
        }
        for r in cfg["weight_search_results"]
    ]
    weight_highlight_cond = {k: v for k, v in TABLE_STYLE.items()
                             if k != "style_data_conditional"}
    weight_highlight_cond["style_data_conditional"] = (
        TABLE_STYLE["style_data_conditional"] + [
            {"if": {"filter_query": f"{{w_LR}} = {cfg['hybrid_w1_lr']}"},
             "backgroundColor": "#1a2a1a", "fontWeight": "bold"},
        ]
    )
    weight_sec = card([
        section_title("Hybrid Weight Grid Search Results (validation)", "🔬"),
        dash_table.DataTable(
            data=weight_rows,
            columns=[{"name": c, "id": c} for c in weight_rows[0].keys()],
            **weight_highlight_cond,
        ),
    ])

    return html.Div([dataset_sec, features_sec, model_sec, hybrid_sec, weight_sec])


# ─────────────────────────────────────────────────────────
# Callbacks
# ─────────────────────────────────────────────────────────
@callback(Output("tab-content", "children"), Input("tabs", "value"))
def render_tab(tab):
    if tab == "overview":   return tab_overview()
    if tab == "scores":     return tab_scores()
    if tab == "features":   return tab_features()
    if tab == "performance":return tab_performance()
    if tab == "explorer":   return tab_explorer()
    if tab == "config":     return tab_config()
    return html.Div("Unknown tab")


@callback(
    Output("explorer-table",   "children"),
    Output("explorer-summary", "children"),
    Input("filter-triage",   "value"),
    Input("filter-binary",   "value"),
    Input("filter-category", "value"),
    Input("filter-rows",     "value"),
)
def update_explorer(triage, binary, category, n_rows):
    df = pred_test.copy()
    if triage   != "all": df = df[df["triage_level"] == triage]
    if binary   != "all": df = df[df["label_binary"] == int(binary)]
    if category != "all": df = df[df["label_multiclass"] == category]

    total  = len(df)
    n_show = min(n_rows, total)
    df_show = df[explorer_cols].head(n_show).copy()

    for col in ["lr_prob_calibrated", "rf_prob_calibrated", "hybrid_score_calibrated"]:
        df_show[col] = df_show[col].round(4)

    summary = (
        f"Showing {n_show:,} of {total:,} filtered events  |  "
        f"Attack rate: {df['label_binary'].mean()*100:.1f}%  |  "
        f"FN in subset: {((df['label_binary']==1)&(df['hybrid_pred']==0)).sum()}"
    )

    table = dash_table.DataTable(
        data=df_show.to_dict("records"),
        columns=explorer_col_defs,
        **TABLE_STYLE,
        style_data_conditional=TABLE_STYLE["style_data_conditional"] + TRIAGE_COLOUR_COND,
        page_size=25,
        sort_action="native",
        filter_action="native",
    )
    return table, summary


# ─────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  Secondary SOC Dashboard")
    print("  Confidence-Based Hybrid ML Framework")
    print("=" * 60)
    print("  Open in browser: http://127.0.0.1:8051")
    print("  Press Ctrl+C to stop")
    print("=" * 60 + "\n")
    app.run(debug=False, port=8051, host="127.0.0.1")
