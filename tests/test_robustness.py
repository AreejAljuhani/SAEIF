import os
import unittest

import numpy as np
import pandas as pd

from models.preprocessor import preprocess_features, load_model_and_predict


def _project_root() -> str:
	this_dir = os.path.dirname(os.path.abspath(__file__))
	return os.path.abspath(os.path.join(this_dir, ".."))


def _model_path() -> str:
	return os.path.join(_project_root(), "models", "CTAS_model.pkl")


def _features_path() -> str:
	return os.path.join(_project_root(), "models", "feature_columns.pkl")


class TestModelRobustness(unittest.TestCase):
	"""Robustness tests: model should not crash on edge/realistic noisy inputs."""

	@classmethod
	def setUpClass(cls):
		if not os.path.exists(_model_path()) or not os.path.exists(_features_path()):
			raise unittest.SkipTest(
				"Missing model artifacts for robustness tests. Expected: "
				f"{_model_path()} and {_features_path()}"
			)

	def _assert_prediction_contract(self, pred: int, conf: float):
		self.assertIsInstance(pred, int)
		self.assertGreaterEqual(pred, 1)
		self.assertLessEqual(pred, 5)
		self.assertIsInstance(conf, float)
		self.assertGreaterEqual(conf, 0.0)
		self.assertLessEqual(conf, 1.0)

	def _assert_no_nan_inf(self, X: pd.DataFrame):
		# Only numeric columns matter after encoding/alignment.
		numeric = X.select_dtypes(include=[np.number])
		arr = numeric.to_numpy(dtype=float)
		self.assertTrue(np.isfinite(arr).all(), "Found NaN/inf in preprocessed features")

	def test_robustness_edge_values(self):
		cases = [
			# extreme low values (including zeros)
			dict(
				group=1,
				sex=1,
				age=0,
				arrival_mode=99,
				injury=0,
				mental=1,
				pain=0,
				nrs_pain=-1,
				sbp=0,
				dbp=0,
				hr=0,
				rr=0,
				bt=0.0,
				saturation=0,
				chief_complain=None,
			),
			# extreme high values
			dict(
				group=2,
				sex=2,
				age=150,
				arrival_mode=7,
				injury=1,
				mental=4,
				pain=1,
				nrs_pain=15,
				sbp=300,
				dbp=200,
				hr=250,
				rr=60,
				bt=45.0,
				saturation=120,
				chief_complain="CHEST PAIN AND DYSPNEA",
			),
			# realistic-ish but messy chief complaint
			dict(
				group=1,
				sex=1,
				age=35,
				arrival_mode=2,
				injury=0,
				mental=2,
				pain=1,
				nrs_pain=7,
				sbp=120,
				dbp=80,
				hr=78,
				rr=16,
				bt=36.8,
				saturation=98,
				chief_complain="صداع شديد !!!??  ",
			),
		]

		for c in cases:
			X = preprocess_features(**c)
			self.assertIsInstance(X, pd.DataFrame)
			self._assert_no_nan_inf(X)
			pred, conf = load_model_and_predict(X)
			self._assert_prediction_contract(pred, conf)

	def test_robustness_random_fuzz(self):
		rng = np.random.default_rng(42)
		for _ in range(100):
			case = dict(
				group=int(rng.integers(1, 3)),
				sex=int(rng.integers(1, 3)),
				age=int(rng.integers(-10, 130)),
				arrival_mode=int(rng.integers(0, 10)),
				injury=int(rng.integers(0, 2)),
				mental=int(rng.integers(0, 5)),
				pain=int(rng.integers(0, 2)),
				nrs_pain=int(rng.integers(-3, 15)),
				sbp=int(rng.integers(0, 260)),
				dbp=int(rng.integers(0, 180)),
				hr=int(rng.integers(0, 220)),
				rr=int(rng.integers(0, 50)),
				bt=float(rng.uniform(30.0, 42.0)),
				saturation=int(rng.integers(0, 110)),
				chief_complain=str(rng.choice(["fever", "chest pain", "abdominal pain", "", "unknown", "دوخة"]))
			)
			X = preprocess_features(**case)
			self._assert_no_nan_inf(X)
			pred, conf = load_model_and_predict(X)
			self._assert_prediction_contract(pred, conf)

	def test_robustness_chief_complain_variants(self):
		variants = [None, "", " ", "fever", "CHEST pain", "abdo pain", "صداع", "x" * 2000]
		base = dict(
			group=1,
			sex=1,
			age=40,
			arrival_mode=1,
			injury=0,
			mental=1,
			pain=1,
			nrs_pain=3,
			sbp=120,
			dbp=80,
			hr=80,
			rr=16,
			bt=36.9,
			saturation=98,
		)
		for v in variants:
			case = dict(base)
			case["chief_complain"] = v
			X = preprocess_features(**case)
			self._assert_no_nan_inf(X)
			pred, conf = load_model_and_predict(X)
			self._assert_prediction_contract(pred, conf)


if __name__ == "__main__":
	unittest.main(verbosity=2)
