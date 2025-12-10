import joblib
import sys
import numpy as np

# Read input from Node.js
age, hr, bp = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])

# Load model
model = joblib.load("CTAS_model.pkl")

# Predict
features = np.array([age, hr, bp]).reshape(1, -1)
prediction = model.predict(features)[0]

print(int(prediction))  # Node.js reads this output
