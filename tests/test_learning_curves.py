import os
import time
import unittest

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, balanced_accuracy_score, log_loss
from sklearn.model_selection import train_test_split


# Optional plotting (only when TRIAGE_WRITE_PLOTS=1)
try:
	import matplotlib  # type: ignore
	matplotlib.use("Agg", force=True)  # type: ignore
	import matplotlib.pyplot as plt  # type: ignore
except Exception:  # pragma: no cover
	plt = None


def _project_root() -> str:
	this_dir = os.path.dirname(os.path.abspath(__file__))
	return os.path.abspath(os.path.join(this_dir, ".."))


def _data_path() -> str:
	return os.path.join(_project_root(), "data", "cleaned.xlsx")


def _model_filename() -> str:
	return os.getenv("TRIAGE_MODEL_FILE", "CTAS_model.pkl")


def _features_filename() -> str:
	return os.getenv("TRIAGE_FEATURES_FILE", "feature_columns.pkl")


def _resolve_artifacts_dir() -> str:
	"""Locate folder containing model + feature columns.
	Priority:
	1) TRIAGE_ARTIFACTS_DIR
	2) common candidates under project root
	"""
	override = os.getenv("TRIAGE_ARTIFACTS_DIR")
	if override:
		return os.path.abspath(override)

	root = _project_root()
	candidates = [
		os.path.join(root, "notebooks"),
		os.path.join(root, "artifacts"),
		os.path.join(root, "models"),
		os.path.join(root, "outputs"),
		root,
	]

	model_file = _model_filename()
	feat_file = _features_filename()
	for d in candidates:
		if os.path.exists(os.path.join(d, model_file)) and os.path.exists(os.path.join(d, feat_file)):
			return d

	# fallback (keeps error messages predictable)
	return os.path.join(root, "notebooks")


def _build_notebook_style_split(*, artifacts_dir: str):
	"""Replicates the notebook preprocessing + split used to train/export artifacts."""
	df = pd.read_excel(_data_path())

	target = "ktas_expert"
	drop_cols = [
		target,
		"ktas_rn",
		"error_group",
		"mistriage",
		"length_of_stay_min",
		"ktas_duration_min",
		"patients_number_per_hour",
		"diagnosis_in_ed",
		"disposition",
	]

	X = df.drop(columns=drop_cols, errors="ignore")
	y = df[target]

	cat_cols = X.select_dtypes(include=["object", "category"]).columns.tolist()
	X = pd.get_dummies(X, columns=cat_cols, drop_first=True)

	X_train, X_val, y_train, y_val = train_test_split(
		X, y, test_size=0.2, random_state=42, stratify=y
	)

	feature_cols = joblib.load(os.path.join(artifacts_dir, _features_filename()))
	X_train = X_train.reindex(columns=feature_cols, fill_value=0)
	X_val = X_val.reindex(columns=feature_cols, fill_value=0)

	return X_train, X_val, y_train, y_val


def _build_notebook_style_test_split(*, artifacts_dir: str):
	_, X_test, _, y_test = _build_notebook_style_split(artifacts_dir=artifacts_dir)
	return X_test, y_test


def _staged_accuracy_and_logloss(model, X, y, *, labels):
	accs: list[float] = []
	losses: list[float] = []
	for y_proba, y_hat in zip(model.staged_predict_proba(X), model.staged_predict(X)):
		accs.append(float(accuracy_score(y, y_hat)))
		losses.append(float(log_loss(y, y_proba, labels=labels)))
	return accs, losses


def _plot_loss_accuracy(
	*,
	epochs: np.ndarray,
	train_loss: list[float],
	val_loss: list[float],
	train_acc: list[float],
	val_acc: list[float],
	out_dir: str,
	overlay_text: str,
):
	os.makedirs(out_dir, exist_ok=True)

	# Accuracy
	acc_path = os.path.join(out_dir, "gb_train_val_accuracy.png")
	fig_acc = plt.figure(figsize=(10, 6))
	plt.plot(epochs, train_acc, label="Training Accuracy", linewidth=2)
	plt.plot(epochs, val_acc, label="Validation Accuracy", linewidth=2)
	plt.title("Model Accuracy over Epochs (n_estimators)", fontsize=14, pad=12)
	plt.xlabel("Epochs", fontsize=12)
	plt.ylabel("Accuracy", fontsize=12)
	plt.grid(True, alpha=0.3, linestyle="--")
	plt.legend(loc="lower right", frameon=True, fontsize=10)
	plt.gcf().text(
		0.02,
		0.02,
		overlay_text,
		fontsize=9,
		family="monospace",
		bbox=dict(facecolor="white", alpha=0.85, edgecolor="gray"),
	)
	plt.tight_layout()
	plt.savefig(acc_path, dpi=300)
	plt.close(fig_acc)

	# Loss
	loss_path = os.path.join(out_dir, "gb_train_val_loss.png")
	fig_loss = plt.figure(figsize=(10, 6))
	plt.plot(epochs, train_loss, label="Training Loss", linewidth=2)
	plt.plot(epochs, val_loss, label="Validation Loss", linewidth=2)
	plt.title("Model Loss over Epochs (n_estimators)", fontsize=14, pad=12)
	plt.xlabel("Epochs", fontsize=12)
	plt.ylabel("Log Loss", fontsize=12)
	plt.grid(True, alpha=0.3, linestyle="--")
	plt.legend(loc="upper right", frameon=True, fontsize=10)
	plt.gcf().text(
		0.02,
		0.02,
		overlay_text,
		fontsize=9,
		family="monospace",
		bbox=dict(facecolor="white", alpha=0.85, edgecolor="gray"),
	)
	plt.tight_layout()
	plt.savefig(loss_path, dpi=300)
	plt.close(fig_loss)

	return acc_path, loss_path


class TestLearningCurvesPlots(unittest.TestCase):
	"""Generates Loss/Accuracy plots for the report (train vs val over epochs)."""

	def test_loss_accuracy_plots_optional(self):
		if os.getenv("TRIAGE_WRITE_PLOTS", "0") != "1":
			self.skipTest("Set TRIAGE_WRITE_PLOTS=1 to generate plots.")
		if plt is None:
			self.skipTest("matplotlib not available.")
		if not os.path.exists(_data_path()):
			self.skipTest(f"Acceptance dataset not found: {_data_path()}")

		artifacts_dir = _resolve_artifacts_dir()

		model_file = os.getenv("TRIAGE_MODEL_FILE", "CTAS_model.pkl")
		model_path = os.path.join(artifacts_dir, model_file)
		if not os.path.exists(model_path):
			self.skipTest(f"Model artifact not found: {model_path}")

		model = joblib.load(model_path)
		if not (hasattr(model, "staged_predict") and hasattr(model, "staged_predict_proba")):
			self.skipTest("Model does not support staged predictions; cannot plot per-epoch curves.")

		X_train, X_val, y_train, y_val = _build_notebook_style_split(artifacts_dir=artifacts_dir)
		labels = sorted(
			pd.unique(pd.concat([pd.Series(y_train), pd.Series(y_val)], ignore_index=True))
		)

		train_acc, train_loss = _staged_accuracy_and_logloss(model, X_train, y_train, labels=labels)
		val_acc, val_loss = _staged_accuracy_and_logloss(model, X_val, y_val, labels=labels)

		# Compute TEST metrics (printed + embedded in images)
		X_test, y_test = _build_notebook_style_test_split(artifacts_dir=artifacts_dir)
		y_test_pred = model.predict(X_test)
		test_acc = accuracy_score(y_test, y_test_pred)
		test_bacc = balanced_accuracy_score(y_test, y_test_pred)

		if not hasattr(model, "predict_proba"):
			self.skipTest("Model does not support predict_proba; cannot compute test log_loss for plots.")

		y_test_proba = model.predict_proba(X_test)
		test_labels = sorted(pd.unique(y_test))
		test_loss = log_loss(y_test, y_test_proba, labels=test_labels)

		print("\n[Loss/Accuracy Plots - TEST Metrics]")
		print(f"test_accuracy={test_acc:.6f}")
		print(f"test_balanced_accuracy={test_bacc:.6f}")
		print(f"test_loss_log_loss={test_loss:.6f}")

		overlay = (
			f"TEST acc={test_acc:.3f}, bacc={test_bacc:.3f}, loss={test_loss:.3f}\n"
			f"final TRAIN acc={train_acc[-1]:.3f}, loss={train_loss[-1]:.3f}\n"
			f"final VAL   acc={val_acc[-1]:.3f}, loss={val_loss[-1]:.3f}"
		)

		epochs = np.arange(1, len(train_acc) + 1)
		out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "acceptance_plots")

		acc_path, loss_path = _plot_loss_accuracy(
			epochs=epochs,
			train_loss=train_loss,
			val_loss=val_loss,
			train_acc=train_acc,
			val_acc=val_acc,
			out_dir=out_dir,
			overlay_text=overlay,
		)

		print(f"[Loss/Accuracy Plots] Accuracy plot saved: {acc_path} (ts={int(time.time())})")
		print(f"[Loss/Accuracy Plots] Loss plot saved: {loss_path} (ts={int(time.time())})")

		self.assertTrue(os.path.exists(acc_path), f"Plot was not created: {acc_path}")
		self.assertTrue(os.path.exists(loss_path), f"Plot was not created: {loss_path}")
