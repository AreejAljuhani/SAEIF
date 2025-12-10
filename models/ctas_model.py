import sys
import json
from preprocessor import preprocess_features, load_model_and_predict

# Read input from Node.js (comma-separated features)
if len(sys.argv) < 2:
    print(json.dumps({"error": "No input features provided"}))
    sys.exit(1)

features_str = sys.argv[1]
chief_complain = sys.argv[2] if len(sys.argv) > 2 else "unknown"

try:
    feature_list = [float(x) for x in features_str.split(',')]
    
    if len(feature_list) != 14:
        print(json.dumps({"error": f"Expected 14 features, got {len(feature_list)}"}))
        sys.exit(1)
    
    # Unpack features: group, sex, age, arrival_mode, injury, mental, pain, nrs_pain, sbp, dbp, hr, rr, bt, saturation
    group, sex, age, arrival_mode, injury, mental, pain, nrs_pain, sbp, dbp, hr, rr, bt, saturation = feature_list
    
    # Preprocess features (applies ALL feature engineering from notebook)
    X = preprocess_features(
        int(group), int(sex), int(age), int(arrival_mode), int(injury), 
        int(mental), int(pain), int(nrs_pain), int(sbp), int(dbp), 
        int(hr), int(rr), float(bt), int(saturation), str(chief_complain)
    )
    
    # Make prediction using your trained model
    prediction, confidence = load_model_and_predict(X)
    
    # Return result as JSON
    result = {
        "prediction": int(prediction),
        "confidence": float(confidence)
    }
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({"error": str(e)}))
    sys.exit(1)
