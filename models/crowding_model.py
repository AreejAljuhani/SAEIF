import sys
import json
import joblib
import numpy as np
from pathlib import Path

# Load model files 
BASE = Path(__file__).parent.parent / "notebooks"

model    = joblib.load(BASE / "saeif_crowding_model.pkl")
features = joblib.load(BASE / "saeif_feature_names.pkl")
medians  = joblib.load(BASE / "saeif_medians.pkl")
class_map = {0: "Low", 1: "Medium", 2: "High"}

# Read input from Node.js 
input_data = json.loads(sys.argv[1])

# Fill missing values with medians 
row = []
for f in features:
    val = input_data.get(f)
    if val is None or val == "":
        val = medians.get(f, 0)
    row.append(float(val))

# Predict 
X = np.array([row])
pred      = int(model.predict(X)[0])
proba     = model.predict_proba(X)[0].tolist()

result = {
    "crowding_level"     : pred,
    "crowding_label"     : class_map[pred],
    "probabilities"      : {
        "Low"    : round(proba[0] * 100, 1),
        "Medium" : round(proba[1] * 100, 1),
        "High"   : round(proba[2] * 100, 1)
    }
}

print(json.dumps(result))