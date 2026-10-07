import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd
from sklearn.datasets import make_classification
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from research.shared.experiment_support import feature_groups, grouped_development_split, select_f1_threshold

SPEC = importlib.util.spec_from_file_location(
    "secondary_pipeline", ROOT / "experiments/secondary/run_secondary_model.py"
)
secondary = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(secondary)


class SecondaryProtocolTests(unittest.TestCase):
    def test_duplicate_feature_vectors_stay_in_one_subset(self):
        x, y = make_classification(n_samples=200, n_features=5, random_state=7)
        features = pd.DataFrame(np.repeat(x, 3, axis=0))
        labels = np.repeat(y, 3)
        subsets = grouped_development_split(features, labels)
        assigned = np.concatenate(list(subsets.values()))
        self.assertEqual(sorted(assigned.tolist()), list(range(len(features))))
        groups = feature_groups(features)
        memberships = [set(groups[indices]) for indices in subsets.values()]
        for first in range(3):
            for second in range(first + 1, 3):
                self.assertFalse(memberships[first] & memberships[second])
        repeated = grouped_development_split(features, labels)
        for name in subsets:
            np.testing.assert_array_equal(subsets[name], repeated[name])

    def test_calibration_does_not_refit_base_models(self):
        x, y = make_classification(n_samples=160, n_features=5, random_state=1)
        lr_fit, rf_fit = LogisticRegression.fit, RandomForestClassifier.fit
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(secondary, "MODEL_DIR", directory), \
             patch.dict(secondary.RF_PARAMS, {"n_estimators": 5, "n_jobs": 1}), \
             patch.object(LogisticRegression, "fit", autospec=True, side_effect=lr_fit) as lr_mock, \
             patch.object(RandomForestClassifier, "fit", autospec=True, side_effect=rf_fit) as rf_mock:
            models = secondary.train_models(x[:100], y[:100], x[100:], y[100:])
        self.assertEqual(lr_mock.call_count, 1)
        self.assertEqual(rf_mock.call_count, 1)
        self.assertIs(models["lr_calibrated"].estimator.estimator, models["lr_pipeline"])
        self.assertIs(models["rf_calibrated"].estimator.estimator, models["rf_model"])

    def test_joint_search_can_choose_rf_endpoint_and_exact_threshold(self):
        labels = np.array([0, 0, 1, 1])
        rf = np.array([0.001, 0.002, 0.003, 0.004])
        lr = np.array([0.9, 0.8, 0.2, 0.1])
        config = secondary.tune_hybrid(lr, rf, labels)
        self.assertEqual(config["w1_lr"], 0.0)
        self.assertEqual(config["decision_threshold"], 0.003)
        self.assertEqual(select_f1_threshold(rf, labels)["f1"], 1.0)
        self.assertLess(config["low_triage_threshold"], config["high_triage_threshold"])


if __name__ == "__main__":
    unittest.main()
