import os
import unittest
import joblib
import numpy as np
import pandas as pd

def _artifacts_dir():
    override = os.getenv("TRIAGE_ARTIFACTS_DIR")
    if override:
        return os.path.abspath(override)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(root, "models")

def _model_filename():
    return os.getenv("TRIAGE_MODEL_FILE", "CTAS_model.pkl")

def _features_filename():
    return os.getenv("TRIAGE_FEATURES_FILE", "feature_columns.pkl")

def _deploy_min_conf() -> float:
    return float(os.getenv("TRIAGE_DEPLOY_MIN_CONF", "0.70"))

def _enforce_deployment() -> bool:
    return os.getenv("TRIAGE_ENFORCE_DEPLOYMENT", "1") == "1"

def _ktas_label(pred: int) -> str:
    labels = {
        1: "Resuscitation",
        2: "Emergent",
        3: "Urgent",
        4: "Less Urgent",
        5: "Non Urgent"
    }
    return labels.get(pred, "Unknown")

def _preprocess_one(case: dict, artifacts_dir: str) -> pd.DataFrame:
    """
    تجهيز البيانات مع حساب المعادلات الطبية (Feature Engineering)
    لضمان دقة التوقع مثل وقت التدريب.
    """
    df = pd.DataFrame([case])

    # === Feature Engineering (نفس منطق التدريب) ===
    # 1. Basic Calculations
    df["map"] = (df["sbp"] + 2 * df["dbp"]) / 3
    df["high_bp"] = (df["sbp"] > 140).astype(int)
    df["low_bp"] = (df["sbp"] < 90).astype(int)
    df["tachy"] = (df["hr"] > 100).astype(int)
    df["brady"] = (df["hr"] < 60).astype(int)
    df["tachypnea"] = (df["rr"] > 20).astype(int)
    df["bradypnea"] = (df["rr"] < 12).astype(int)
    df["fever"] = (df["bt"] >= 38).astype(int)
    df["hypothermia"] = (df["bt"] < 36).astype(int)
    df["low_spo2"] = (df["saturation"] < 92).astype(int)

    # 2. Age Group
    df["age_group"] = pd.cut(df["age"], bins=[0, 14, 64, 120], labels=["child", "adult", "elderly"])
    df["age_group"] = df["age_group"].astype("category").cat.codes

    # 3. Risk Score
    df["risk_score"] = (
        df["high_bp"] + df["low_bp"] + df["tachy"] + df["brady"] +
        df["tachypnea"] + df["bradypnea"] + df["fever"] + df["hypothermia"] + df["low_spo2"]
    )

    # 4. Ratios & Interactions
    df["sbp_hr_ratio"] = df["sbp"] / (df["hr"] + 1e-5)
    df["rr_hr_ratio"] = df["rr"] / (df["hr"] + 1e-5)
    df["pain_nrs"] = df["pain"] * df["nrs_pain"]
    df["temp_hr_ratio"] = df["bt"] / (df["hr"] + 1e-5)
    df["rr_sbp_ratio"] = df["rr"] / (df["sbp"] + 1e-5)
    df["hr_age_ratio"] = df["hr"] / (df["age"] + 1e-5)
    df["sbp_age_ratio"] = df["sbp"] / (df["age"] + 1e-5)
    df["pulse_pressure_ratio"] = (df["sbp"] - df["dbp"]) / (df["sbp"] + 1e-5)

    # 5. Critical Flags
    df["shock_flag"] = ((df["sbp"] < 90) & (df["hr"] > 100)).astype(int)
    df["wide_pp"] = ((df["sbp"] - df["dbp"]) > 60).astype(int)
    df["resp_distress"] = ((df["saturation"] < 92) & (df["rr"] > 22)).astype(int)
    df["spo2_rr_ratio"] = df["saturation"] / (df["rr"] + 1e-5)
    df["fever_tachy_combo"] = ((df["bt"] >= 38) & (df["hr"] > 100)).astype(int)
    df["fever_fastbreath"] = ((df["bt"] >= 38) & (df["rr"] > 20)).astype(int)
    df["elderly"] = (df["age"] >= 65).astype(int)
    df["child"] = (df["age"] <= 14).astype(int)
    df["age_sq"] = df["age"] ** 2
    df["severe_pain_flag"] = (df["nrs_pain"] >= 7).astype(int)
    df["pain_hr_ratio"] = df["nrs_pain"] / (df["hr"] + 1e-5)

    # 6. Text Features (Chief Complain)
    if "chief_complain" not in df.columns:
        df["chief_complain"] = ""
    df["cc_length"] = df["chief_complain"].astype(str).apply(len)
    df["cc_words"] = df["chief_complain"].astype(str).apply(lambda x: len(x.split()))
    
    df["cc_chest"] = df["chief_complain"].astype(str).str.contains("chest", case=False, na=False).astype(int)
    df["cc_fever"] = df["chief_complain"].astype(str).str.contains("fever", case=False, na=False).astype(int)
    df["cc_abdominal"] = df["chief_complain"].astype(str).str.contains("abdo|abdomen", case=False, na=False).astype(int)
    df["cc_pain"] = df["chief_complain"].astype(str).str.contains("pain", case=False, na=False).astype(int)
    df["cc_trauma"] = df["chief_complain"].astype(str).str.contains("trauma|injury", case=False, na=False).astype(int)

    # 7. More Medical Scores
    df["shock_index"] = df["hr"] / df["sbp"]
    df["pulse_pressure"] = df["sbp"] - df["dbp"]
    df["c_shock_index"] = (df["hr"] / df["sbp"]) * df["bt"]
    df["resp_ratio"] = df["rr"] / df["saturation"]

    arrival_weight = {1: 1, 2: 3, 3: 1, 4: 3, 5: 2, 6: 2, 7: 1}
    df["arrival_weight"] = df["arrival_mode"].map(arrival_weight)

    df["abnormal_vitals"] = (
        (df["sbp"] < 90) | (df["sbp"] > 180) |
        (df["hr"] < 50) | (df["hr"] > 120) |
        (df["rr"] < 12) | (df["rr"] > 24) |
        (df["bt"] > 38) | (df["bt"] < 36)
    ).astype(int)

    df["pain_level"] = pd.cut(df["nrs_pain"], bins=[0, 3, 6, 10], labels=["low", "medium", "high"])
    df["mental_critical"] = (df["mental"] > 2).astype(int)
    df["shock_age_interaction"] = df["shock_index"] * df["age"]
    df["pp_hr_interaction"] = df["pulse_pressure"] * df["hr"]

    df["critical_flag"] = (
        (df["shock_flag"] == 1) |
        (df["resp_distress"] == 1) |
        (df["low_spo2"] == 1) |
        (df["fever_tachy_combo"] == 1)
    ).astype(int)

    df["hr_age_norm"] = df["hr"] / (df["age"] + 1e-5)
    df["sbp_age_norm"] = df["sbp"] / (df["age"] + 1e-5)
    df["rr_age_norm"] = df["rr"] / (df["age"] + 1e-5)

    # Encoding & Alignment
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    X = pd.get_dummies(df, columns=cat_cols, drop_first=True)
    feature_cols = joblib.load(os.path.join(artifacts_dir, _features_filename()))
    return X.reindex(columns=feature_cols, fill_value=0)

class TestTriageModelDeployment(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.artifacts_dir = _artifacts_dir()
        cls.model_path = os.path.join(cls.artifacts_dir, _model_filename())
        cls.cols_path = os.path.join(cls.artifacts_dir, _features_filename())

    def test_deployment_artifacts_exist(self):
        self.assertTrue(os.path.exists(self.model_path), f"Missing model: {self.model_path}")
        self.assertTrue(os.path.exists(self.cols_path), f"Missing features: {self.cols_path}")

    def test_deployment_simulated_patient_cases(self):
        if not os.path.exists(self.model_path) or not os.path.exists(self.cols_path):
            self.skipTest("Artifacts missing (see test_deployment_artifacts_exist).")

        model = joblib.load(self.model_path)
        min_conf = _deploy_min_conf()
        enforce = _enforce_deployment()

        # تمت إضافة pain=1, group=1, sex=1 للحالات لتجنب KeyError
        cases = [
            dict(name="stable_case", group=1, sex=1, age=25, arrival_mode=1, injury=0, mental=1, pain=1, nrs_pain=1, sbp=120, dbp=80, hr=75, rr=16, bt=36.8, saturation=99, chief_complain="mild headache"),
            dict(name="moderate_case", group=1, sex=1, age=45, arrival_mode=2, injury=0, mental=2, pain=1, nrs_pain=6, sbp=105, dbp=70, hr=98, rr=20, bt=37.6, saturation=96, chief_complain="abdominal pain"),
            dict(name="critical_case", group=1, sex=1, age=70, arrival_mode=4, injury=1, mental=3, pain=1, nrs_pain=8, sbp=85, dbp=55, hr=125, rr=28, bt=38.8, saturation=88, chief_complain="chest pain and dyspnea"),
        ]

        print("\n[Deployment Testing] results:")
        print(f"artifacts_dir={self.artifacts_dir}")
        print(f"min_confidence={min_conf:.2f} enforce={enforce}")

        results = {}  # لتخزين النتائج والمقارنة بينها

        for c in cases:
            name = c.pop("name")
            X = _preprocess_one(c, artifacts_dir=self.artifacts_dir)

            pred = int(model.predict(X)[0])
            conf = float("nan")
            if hasattr(model, "predict_proba"):
                proba = model.predict_proba(X)[0]
                conf = float(np.max(proba))

            label = _ktas_label(pred)
            print(f"- {name}: pred={pred} ({label}) conf={conf:.3f}")
            results[name] = pred

            self.assertGreaterEqual(pred, 1)
            self.assertLessEqual(pred, 5)

            if enforce:
                self.assertTrue(np.isfinite(conf), "predict_proba not available; cannot enforce confidence.")
                self.assertGreaterEqual(conf, min_conf, f"{name}: conf={conf:.3f} < {min_conf:.2f}")

        # التحقق من المنطق الطبي: الحالة الحرجة يجب أن تكون أكثر استعجالًا (رقم أقل) من المستقرة
        # Critical (1) < Stable (3) -> True
        self.assertLess(
            results["critical_case"], 
            results["stable_case"], 
            f"Critical case ({results['critical_case']}) should be more urgent than stable case ({results['stable_case']})"
        )

if __name__ == "__main__":
    unittest.main(verbosity=2)
