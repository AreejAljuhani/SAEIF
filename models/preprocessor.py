import pandas as pd
import numpy as np
import joblib
import os

# Get script directory
script_dir = os.path.dirname(os.path.abspath(__file__))

def preprocess_features(group, sex, age, arrival_mode, injury, mental, pain, nrs_pain, 
                       sbp, dbp, hr, rr, bt, saturation, chief_complain):
    """
    Preprocess raw features to match the EXACT format from the notebook.
    This includes ALL feature engineering steps.
    """
    
    # Create a DataFrame with the input features
    data = {
        'group': [group],
        'sex': [sex],
        'age': [age],
        'arrival_mode': [arrival_mode],
        'injury': [injury],
        'mental': [mental],
        'pain': [pain],
        'nrs_pain': [nrs_pain],
        'sbp': [sbp],
        'dbp': [dbp],
        'hr': [hr],
        'rr': [rr],
        'bt': [bt],
        'saturation': [saturation],
        'chief_complain': [chief_complain]
    }
    
    df = pd.DataFrame(data)
    
    # === EXACT Feature Engineering from Notebook ===
    
    # 1. MAP (Mean Arterial Pressure)
    df['map'] = (df['sbp'] + 2 * df['dbp']) / 3
    
    # 2. Blood pressure flags
    df['high_bp'] = (df['sbp'] > 140).astype(int)
    df['low_bp'] = (df['sbp'] < 90).astype(int)
    
    # 3. Heart rate flags
    df['tachy'] = (df['hr'] > 100).astype(int)
    df['brady'] = (df['hr'] < 60).astype(int)
    
    # 4. Respiratory rate flags
    df['tachypnea'] = (df['rr'] > 20).astype(int)
    df['bradypnea'] = (df['rr'] < 12).astype(int)
    
    # 5. Temperature flags
    df['fever'] = (df['bt'] >= 38).astype(int)
    df['hypothermia'] = (df['bt'] < 36).astype(int)
    
    # 6. Oxygen saturation flag
    df['low_spo2'] = (df['saturation'] < 92).astype(int)
    
    # 7. Age groups
    df['age_group'] = pd.cut(
        df['age'],
        bins=[0, 14, 64, 120],
        labels=['child', 'adult', 'elderly']
    )
    # Convert age_group to category codes
    df['age_group'] = df['age_group'].astype('category').cat.codes
    
    # 8. Risk score (sum of abnormal vitals)
    df['risk_score'] = (
        df['high_bp'] + df['low_bp'] +
        df['tachy'] + df['brady'] +
        df['tachypnea'] + df['bradypnea'] +
        df['fever'] + df['hypothermia'] +
        df['low_spo2']
    )
    
    # 9. Interaction features
    df['sbp_hr_ratio'] = df['sbp'] / (df['hr'] + 1e-5)
    df['rr_hr_ratio'] = df['rr'] / (df['hr'] + 1e-5)
    
    # 10. Pain interactions
    df['pain_nrs'] = df['pain'] * df['nrs_pain']
    
    df['temp_hr_ratio'] = df['bt'] / (df['hr'] + 1e-5)
    df['rr_sbp_ratio'] = df['rr'] / (df['sbp'] + 1e-5)
    df['hr_age_ratio'] = df['hr'] / (df['age'] + 1e-5)
    df['sbp_age_ratio'] = df['sbp'] / (df['age'] + 1e-5)
    
    # Pulse Pressure Ratio
    df['pulse_pressure_ratio'] = (df['sbp'] - df['dbp']) / (df['sbp'] + 1e-5)
    
    df['shock_flag'] = ((df['sbp'] < 90) & (df['hr'] > 100)).astype(int)
    df['wide_pp'] = ((df['sbp'] - df['dbp']) > 60).astype(int)
    
    # O2 + RR combined indicator
    df['resp_distress'] = ((df['saturation'] < 92) & (df['rr'] > 22)).astype(int)
    
    # Breathing inefficiency
    df['spo2_rr_ratio'] = df['saturation'] / (df['rr'] + 1e-5)
    
    # Fever + tachycardia = infection indicator
    df['fever_tachy_combo'] = ((df['bt'] >= 38) & (df['hr'] > 100)).astype(int)
    
    # Fever + RR high
    df['fever_fastbreath'] = ((df['bt'] >= 38) & (df['rr'] > 20)).astype(int)
    
    # Elderly risk
    df['elderly'] = (df['age'] >= 65).astype(int)
    
    # Pediatric indicator
    df['child'] = (df['age'] <= 14).astype(int)
    
    df['age_sq'] = df['age'] ** 2
    
    # Severe pain threshold
    df['severe_pain_flag'] = (df['nrs_pain'] >= 7).astype(int)
    
    # Pain relative to HR
    df['pain_hr_ratio'] = df['nrs_pain'] / (df['hr'] + 1e-5)
    
    df['cc_length'] = df['chief_complain'].astype(str).apply(len)
    df['cc_words'] = df['chief_complain'].astype(str).apply(lambda x: len(x.split()))
    
    df['cc_chest'] = df['chief_complain'].str.contains('chest', case=False, na=False).astype(int)
    df['cc_fever'] = df['chief_complain'].str.contains('fever', case=False, na=False).astype(int)
    df['cc_abdominal'] = df['chief_complain'].str.contains('abdo|abdomen', case=False, na=False).astype(int)
    df['cc_pain'] = df['chief_complain'].str.contains('pain', case=False, na=False).astype(int)
    df['cc_trauma'] = df['chief_complain'].str.contains('trauma|injury', case=False, na=False).astype(int)
    
    df['shock_index'] = df['hr'] / df['sbp']
    df['pulse_pressure'] = df['sbp'] - df['dbp']
    df['c_shock_index'] = (df['hr'] / df['sbp']) * df['bt']
    df['resp_ratio'] = df['rr'] / df['saturation']
    
    arrival_weight = {
        1: 1, 2: 3, 3: 1, 4: 3, 5: 2, 6: 2, 7: 1
    }
    df['arrival_weight'] = df['arrival_mode'].map(arrival_weight)
    
    df['abnormal_vitals'] = (
        (df['sbp'] < 90) |
        (df['sbp'] > 180) |
        (df['hr'] < 50) |
        (df['hr'] > 120) |
        (df['rr'] < 12) |
        (df['rr'] > 24) |
        (df['bt'] > 38) |
        (df['bt'] < 36)
    ).astype(int)
    
    df['pain_level'] = pd.cut(
        df['nrs_pain'],
        bins=[0, 3, 6, 10],
        labels=['low', 'medium', 'high']
    )
    
    df['mental_critical'] = (df['mental'] > 2).astype(int)
    df['shock_age_interaction'] = df['shock_index'] * df['age']
    df['pp_hr_interaction'] = df['pulse_pressure'] * df['hr']
    
    df['critical_flag'] = (
        (df['shock_flag'] == 1) |
        (df['resp_distress'] == 1) |
        (df['low_spo2'] == 1) |
        (df['fever_tachy_combo'] == 1)
    ).astype(int)
    
    df['hr_age_norm'] = df['hr'] / (df['age'] + 1e-5)
    df['sbp_age_norm'] = df['sbp'] / (df['age'] + 1e-5)
    df['rr_age_norm'] = df['rr'] / (df['age'] + 1e-5)
    
    # One-hot encode categorical columns (chief_complain and pain_level)
    cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
    X = pd.get_dummies(df, columns=cat_cols, drop_first=True)
    
    # Load saved feature columns if available
    feature_cols_path = os.path.join(script_dir, 'feature_columns.pkl')
    if os.path.exists(feature_cols_path):
        feature_cols = joblib.load(feature_cols_path)
        # Reindex to expected columns to avoid fragmentation warnings
        X = X.reindex(columns=feature_cols, fill_value=0)
    
    return X

def load_model_and_predict(features_array):
    """Load the model and make a prediction."""
    model_path = os.path.join(script_dir, 'CTAS_model.pkl')
    model = joblib.load(model_path)
    
    prediction = model.predict(features_array)[0]
    
    # Try to get prediction probability
    try:
        proba = model.predict_proba(features_array)[0]
        confidence = float(max(proba))
    except:
        confidence = 0.8  # Default confidence
    
    return int(prediction), confidence
