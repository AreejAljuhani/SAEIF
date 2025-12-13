import unittest
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np
import os
import sys

# Add project root directory to ensure modules are imported correctly
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from models.preprocessor import preprocess_features, load_model_and_predict

class TestPreprocessor(unittest.TestCase):

    @patch('models.preprocessor.joblib.load')
    @patch('models.preprocessor.os.path.exists')
    def test_preprocess_features_logic(self, mock_exists, mock_load):
        """
        Test the correctness of medical calculations (Feature Engineering) such as risk_score.
        """
        # Simulate existence of feature columns file
        mock_exists.return_value = True
        # Define columns to check for calculation verification
        mock_cols = ['risk_score', 'high_bp', 'tachy', 'fever']
        mock_load.return_value = mock_cols

        # Patient case: High BP (150), Tachycardia (110), Fever (39)
        # Expected: risk_score = 1 + 1 + 1 = 3
        inputs = dict(
            group=1, sex=1, age=50, arrival_mode=1, injury=0, mental=1, 
            pain=1, nrs_pain=5, sbp=150, dbp=90, hr=110, rr=18, bt=39.0, 
            saturation=98, chief_complain="fever"
        )

        X = preprocess_features(**inputs)

        self.assertIsInstance(X, pd.DataFrame)
        # Verify Flags
        self.assertEqual(X.iloc[0]['high_bp'], 1, "Should detect high BP")
        self.assertEqual(X.iloc[0]['tachy'], 1, "Should detect Tachycardia")
        self.assertEqual(X.iloc[0]['fever'], 1, "Should detect Fever")
        # Verify Sum
        self.assertEqual(X.iloc[0]['risk_score'], 3, "Risk score calculation mismatch")

    @patch('models.preprocessor.joblib.load')
    @patch('models.preprocessor.os.path.exists')
    def test_preprocess_features_alignment(self, mock_exists, mock_load):
        """
        Test column alignment to ensure consistency with training.
        """
        mock_exists.return_value = True
        # Simulate saved feature columns list (different from auto-generated)
        saved_features = ['age', 'sbp', 'missing_col_in_input']
        mock_load.return_value = saved_features

        inputs = dict(
            group=1, sex=1, age=30, arrival_mode=1, injury=0, mental=1, 
            pain=0, nrs_pain=0, sbp=120, dbp=80, hr=70, rr=16, bt=36.5, 
            saturation=99, chief_complain="checkup"
        )

        X = preprocess_features(**inputs)

        # Output columns must match saved columns exactly
        self.assertListEqual(list(X.columns), saved_features)
        # Missing column should be filled with 0
        self.assertEqual(X.iloc[0]['missing_col_in_input'], 0)

    @patch('models.preprocessor.joblib.load')
    def test_load_model_and_predict(self, mock_load):
        """
        Test prediction function and model simulation.
        """
        # Mock model object
        mock_model = MagicMock()
        mock_model.predict.return_value = [2]
        # Mock probabilities (max value 0.85)
        mock_model.predict_proba.return_value = [[0.05, 0.85, 0.1, 0.0, 0.0]]
        mock_load.return_value = mock_model

        # Dummy data
        X_dummy = pd.DataFrame({'age': [30]})

        pred, conf = load_model_and_predict(X_dummy)

        self.assertEqual(pred, 2)
        self.assertEqual(conf, 0.85)
        # Ensure joblib.load was called
        mock_load.assert_called()

if __name__ == '__main__':
    unittest.main(verbosity=2)
