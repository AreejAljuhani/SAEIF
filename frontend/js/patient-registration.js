document.addEventListener('DOMContentLoaded', function() {
    console.log('Patient Registration page loaded');
    try {
        const scriptEl = document.querySelector('script[src*="patient-registration.js"]');
        console.log('Page URL:', window.location.href);
        if (scriptEl && scriptEl.src) console.log('Loaded script:', scriptEl.src);
    } catch (_) {
        // no-op
    }
    
    // Initialize form
    initializeForm();
    
    // Setup event listeners
    setupEventListeners();
});

function initializeForm() {
    // Set today's date as default for date inputs
    const today = new Date().toISOString().split('T')[0];
    const dobField = document.getElementById('dateOfBirth');
    if (dobField) {
        dobField.max = today;
    }
}

function setupEventListeners() {
    const form = document.getElementById('patientForm');
    if (!form) return;

    form.addEventListener('submit', handleFormSubmit);
    
    // Add real-time validation
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input && input.id === 'age') return;
        input.addEventListener('blur', validateField);
        input.addEventListener('input', clearFieldError);
    });
    
    // Clear button event listener
    const clearButton = document.getElementById('clearButton');
    if (clearButton) {
        clearButton.addEventListener('click', clearForm);
    }

    // Listen for changes in Date of Birth field (and auto-fill Age)
    const dobField = document.getElementById('dateOfBirth');
    if (dobField) {
        const scheduleDobValidation = () => {
            // Some browsers update <input type="date"> value after the event fires.
            window.setTimeout(validateDateOfBirth, 0);
        };

        dobField.addEventListener('change', scheduleDobValidation);
        dobField.addEventListener('input', scheduleDobValidation);
        dobField.addEventListener('blur', scheduleDobValidation);
        dobField.addEventListener('focusout', scheduleDobValidation);
        dobField.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') scheduleDobValidation();
        });
    }
}

function setupNavigation() {
    // Setup sidebar navigation
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
            
            const page = this.getAttribute('data-page');
            handleNavigation(page);
        });
    });
}

function handleNavigation(page) {
    console.log('Navigating to:', page);
    
    switch(page) {
        case 'home':
            window.location.href = 'home.html';
            break;
        case 'registration':
            // Already on registration page
            break;
        case 'patient-list':
            // Will be implemented later
            alert('Patient List page will be implemented soon');
            break;
        case 'iot-monitoring':
            // Will be implemented later
            alert('IOT Monitoring page will be implemented soon');
            break;
        case 'alerts':
            // Will be implemented later
            alert('Alerts page will be implemented soon');
            break;
        default:
            console.log('Unknown page:', page);
    }
}

function handleFormSubmit(event) {
    event.preventDefault();

    // Ensure age is computed even if the user submits immediately after typing DOB.
    validateDateOfBirth();
    
    if (validateForm()) {
        const formData = getFormData();
        registerPatient(formData);
    }
}

function getFormData() {
    return {
        personalInfo: {
            name: document.getElementById('name').value,
            sex: document.getElementById('sex').value,
            phoneNumber: document.getElementById('phoneNumber').value,
            age: document.getElementById('age').value,
            dateOfBirth: document.getElementById('dateOfBirth').value
        },
        arrivalInfo: {
            group: document.getElementById('group').value,
            arrival_mode: document.getElementById('arrival_mode').value
        },
        clinicalAssessment: {
            injury: document.getElementById('injury').value,
            mental: document.getElementById('mental').value,
            pain: document.getElementById('pain').value,
            nrs_pain: document.getElementById('nrs_pain').value
        },
        vitalSigns: {
            saturation: document.getElementById('saturation').value,
            bt: document.getElementById('bt').value,
            rr: document.getElementById('rr').value,
            hr: document.getElementById('hr').value,
            dbp: document.getElementById('dbp').value,
            sbp: document.getElementById('sbp').value
        },
        chiefComplaint: {
            chief_complain: document.getElementById('chief_complain').value
        }
    };
}

function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function parseISODateToLocalDate(isoDate) {
    // Expecting YYYY-MM-DD (from <input type="date">). Avoid timezone quirks of new Date('YYYY-MM-DD').
    if (!isoDate || typeof isoDate !== 'string') return null;
    const trimmed = isoDate.trim();
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day);
    // Guard against invalid dates like 2026-02-31 which roll over.
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    date.setHours(0, 0, 0, 0);
    return date;
}

function validateNumberRange(field, errorId, min, max, message) {
    const value = toFiniteNumber(field.value);
    if (value === null) {
        showError(field, errorId, 'Please enter a valid number');
        return false;
    }
    if (value < min || value > max) {
        showError(field, errorId, message);
        return false;
    }
    clearError(field, errorId);
    return true;
}

function validateDateOfBirth() {
    const dobField = document.getElementById('dateOfBirth');
    if (!dobField) return true;

    const raw = dobField.value;
    const errorId = 'dateOfBirthError';

    const ageField = document.getElementById('age');
    if (ageField && ageField.disabled) {
        ageField.disabled = false;
    }

    if (!raw || !raw.toString().trim()) {
        if (ageField) ageField.value = '';
        showError(dobField, errorId, 'This field is required');
        return false;
    }

    const dob = parseISODateToLocalDate(raw);
    if (!dob) {
        if (ageField) ageField.value = '';
        showError(dobField, errorId, 'Please enter a valid date');
        return false;
    }

    // Block any future DOB (local date comparison).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dob > today) {
        if (ageField) ageField.value = '';
        showError(dobField, errorId, 'Date of birth cannot be in the future');
        return false;
    }

    const age = calculateAgeFromDOB(raw);
    if (ageField) {
        ageField.value = String(age);
        ageField.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (!Number.isFinite(age) || age < 0 || age > 150) {
        const ageErrorId = 'ageError';
        if (ageField) {
            showError(ageField, ageErrorId, 'Please enter a valid age (0-150)');
        }
        showError(dobField, errorId, 'Please select a valid date of birth');
        return false;
    }

    clearError(dobField, errorId);
    if (ageField) clearError(ageField, 'ageError');
    return true;
}

function validateForm() {
    let isValid = true;
    
    // Required fields validation
    const requiredFields = [
        'name', 'phoneNumber', 'age', 'sex', 'dateOfBirth',
        'group', 'arrival_mode', 
        'injury', 'mental', 'pain', 'nrs_pain',
        'saturation', 'bt', 'rr', 'hr', 'dbp', 'sbp',
        'chief_complain'
    ];
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field || !field.value.toString().trim()) {
            if (field) {
                showError(field, fieldId + 'Error', 'This field is required');
            }
            isValid = false;
        } else {
            if (field) {
                clearError(field, fieldId + 'Error');
            }
        }
    });

    // Phone number validation
    const phoneField = document.getElementById('phoneNumber');
    if (phoneField && phoneField.value.toString().trim()) {
        if (!validatePhoneNumber(phoneField)) {
            isValid = false;
        }
    }

    // Date validation + auto-age
    if (!validateDateOfBirth()) {
        isValid = false;
    }
    
    // Additional validation for specific fields
    const hrField = document.getElementById('hr');
    if (hrField && hrField.value.toString().trim()) {
        if (!validateNumberRange(hrField, 'hrError', 25, 250, 'Please enter a valid heart rate (25-250 bpm)')) {
            isValid = false;
        }
    }

    const saturationField = document.getElementById('saturation');
    if (saturationField && saturationField.value.toString().trim()) {
        if (!validateNumberRange(saturationField, 'saturationError', 50, 100, 'Please enter valid saturation (50-100%)')) {
            isValid = false;
        }
    }

    const nrsPainField = document.getElementById('nrs_pain');
    if (nrsPainField && nrsPainField.value.toString().trim()) {
        if (!validateNumberRange(nrsPainField, 'nrs_painError', 0, 10, 'Please enter valid pain scale (0-10)')) {
            isValid = false;
        }
    }

    const btField = document.getElementById('bt');
    if (btField && btField.value.toString().trim()) {
        if (!validateNumberRange(btField, 'btError', 30, 45, 'Please enter a valid body temperature (30-45°C)')) {
            isValid = false;
        }
    }

    const rrField = document.getElementById('rr');
    if (rrField && rrField.value.toString().trim()) {
        if (!validateNumberRange(rrField, 'rrError', 6, 60, 'Please enter a valid respiration rate (6-60)')) {
            isValid = false;
        }
    }

    const sbpField = document.getElementById('sbp');
    if (sbpField && sbpField.value.toString().trim()) {
        if (!validateNumberRange(sbpField, 'sbpError', 50, 250, 'Please enter a valid systolic BP (50-250 mmHg)')) {
            isValid = false;
        }
    }

    const dbpField = document.getElementById('dbp');
    if (dbpField && dbpField.value.toString().trim()) {
        if (!validateNumberRange(dbpField, 'dbpError', 30, 140, 'Please enter a valid diastolic BP (30-140 mmHg)')) {
            isValid = false;
        }
    }

    if (sbpField && dbpField) {
        const sbp = toFiniteNumber(sbpField.value);
        const dbp = toFiniteNumber(dbpField.value);
        if (sbp !== null && dbp !== null && dbp >= sbp) {
            showError(dbpField, 'dbpError', 'Diastolic BP must be lower than systolic BP');
            isValid = false;
        }
    }
    
    return isValid;
}

function validateField(event) {
    const field = event.target;
    const fieldId = field.id;
    const errorId = fieldId + 'Error';
    
    if (!field.value.toString().trim()) {
        showError(field, errorId, 'This field is required');
    } else {
        clearError(field, errorId);
        
        // Additional field-specific validation
        if (fieldId === 'phoneNumber') {
            validatePhoneNumber(field);
        }

        if (fieldId === 'dateOfBirth') {
            validateDateOfBirth();
        }

        if (fieldId === 'hr') {
            validateNumberRange(field, errorId, 25, 250, 'Please enter a valid heart rate (25-250 bpm)');
        }

        if (fieldId === 'saturation') {
            validateNumberRange(field, errorId, 50, 100, 'Please enter valid saturation (50-100%)');
        }

        if (fieldId === 'nrs_pain') {
            validateNumberRange(field, errorId, 0, 10, 'Please enter valid pain scale (0-10)');
        }

        if (fieldId === 'bt') {
            validateNumberRange(field, errorId, 30, 45, 'Please enter a valid body temperature (30-45°C)');
        }

        if (fieldId === 'rr') {
            validateNumberRange(field, errorId, 6, 60, 'Please enter a valid respiration rate (6-60)');
        }

        if (fieldId === 'sbp') {
            validateNumberRange(field, errorId, 50, 250, 'Please enter a valid systolic BP (50-250 mmHg)');
            const dbpField = document.getElementById('dbp');
            const sbp = toFiniteNumber(field.value);
            const dbp = dbpField ? toFiniteNumber(dbpField.value) : null;
            if (dbpField && sbp !== null && dbp !== null && dbp >= sbp) {
                showError(dbpField, 'dbpError', 'Diastolic BP must be lower than systolic BP');
            }
        }

        if (fieldId === 'dbp') {
            validateNumberRange(field, errorId, 30, 140, 'Please enter a valid diastolic BP (30-140 mmHg)');
            const sbpField = document.getElementById('sbp');
            const dbp = toFiniteNumber(field.value);
            const sbp = sbpField ? toFiniteNumber(sbpField.value) : null;
            if (sbpField && sbp !== null && dbp !== null && dbp >= sbp) {
                showError(field, errorId, 'Diastolic BP must be lower than systolic BP');
            }
        }
    }
}

function clearFieldError(event) {
    const field = event.target;
    const errorId = field.id + 'Error';
    clearError(field, errorId);
}

// Phone number validation function
function validatePhoneNumber(field) {
    const phoneNumber = field.value.toString().trim();
    const errorId = 'phoneNumberError';
    
    // Remove spaces, dashes, and parentheses for validation
    const cleanedPhone = phoneNumber.replace(/[\s\-()]/g, '');
    
    // International phone number validation
    // Accepts: +1-234-567-8900, 1234567890, (123) 456-7890, +1 234 567 8900
    // Must be 7-15 digits (international standard)
    const phoneRegex = /^(\+\d{1,3})?[\d\s\-()]{6,}$/;
    
    if (!phoneRegex.test(phoneNumber)) {
        showError(field, errorId, 'Please enter a valid phone number (7+ digits)');
        return false;
    }
    
    // Check if cleaned phone has at least 7 digits (minimum phone length)
    const digitCount = cleanedPhone.replace(/\D/g, '').length;
    if (digitCount < 7) {
        showError(field, errorId, 'Phone number must contain at least 7 digits');
        return false;
    }
    
    // Check if it doesn't exceed 15 digits (international standard)
    if (digitCount > 15) {
        showError(field, errorId, 'Phone number is too long (max 15 digits)');
        return false;
    }
    
    clearError(field, errorId);
    return true;
}

function showError(field, errorId, message) {
    field.classList.add('error');
    const errorElement = document.getElementById(errorId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function clearError(field, errorId) {
    field.classList.remove('error');
    const errorElement = document.getElementById(errorId);
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

function clearForm() {
    if (confirm('Are you sure you want to clear all form data?')) {
        document.getElementById('patientForm').reset();
        
        // Clear all error messages
        const errorMessages = document.querySelectorAll('.error-message');
        errorMessages.forEach(error => {
            error.style.display = 'none';
        });
        
        // Remove error classes from fields
        const fields = document.querySelectorAll('.form-input, .form-select, .form-textarea');
        fields.forEach(field => {
            field.classList.remove('error');
        });
        
        // Hide success message
        document.getElementById('successMessage').style.display = 'none';
    }
}

async function registerPatient(patientData) {
    const submitBtn = document.getElementById('submitButton');
    const originalText = submitBtn.innerHTML;
    
    try {
        // Show loading state
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        submitBtn.disabled = true;
        
        // Send to backend for registration and ML prediction
        await sendToBackend(patientData);
        
        // Show success message
        document.getElementById('successMessage').style.display = 'flex';
        
    } catch (error) {
        alert('Error processing patient data: ' + error.message);
        console.error('Registration error:', error);
    } finally {
        // Reset button state 
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function sendToBackend(patientData) {
    try {
        const classifyResponse = await fetch('http://localhost:3000/api/classify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(patientData)
        });

        if (!classifyResponse.ok) {
            throw new Error(`Classification failed: ${classifyResponse.status}`);
        }

        const result = await classifyResponse.json();
        console.log("Triage result from model:", result);

        const rawCTAS =
            result.aiCTAS ??
            result.ctas ??
            (typeof result.prediction === 'number'
                ? result.prediction
                : result.prediction?.prediction);

        const aiCTAS = Number(rawCTAS);
        console.log("Parsed aiCTAS:", aiCTAS);

        if (!Number.isFinite(aiCTAS) || aiCTAS < 1 || aiCTAS > 5) {
            console.error("Raw backend result:", result);
            throw new Error("Invalid CTAS value from backend");
        }

        const now = new Date();

        const age = patientData.personalInfo.age
            ? parseInt(patientData.personalInfo.age, 10)
            : calculateAgeFromDOB(patientData.personalInfo.dateOfBirth);

        // Calculate waiting time ONCE (before saving) so it gets stored with the patient document.
        let waitingTimePayload = null;
        try {
            const wtResponse = await fetch('http://localhost:3000/api/calculate-waiting-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    triageLevel: aiCTAS,
                    doctorsAvailable: 2
                })
            });

            if (wtResponse.ok) {
                const wt = await wtResponse.json();
                if (wt && wt.success) {
                    let computed = wt;

                    // If backend can't read Firestore, it tends to return patientsAhead=0 for everyone.
                    // In that case, compute waiting time directly from Firestore via the client SDK.
                    if (aiCTAS > 1 && Number(wt.patientsAhead) === 0) {
                        try {
                            computed = await calculateWaitingTimeFromFirestore(aiCTAS, 2);
                        } catch (fallbackError) {
                            console.warn('Waiting time Firestore fallback failed:', fallbackError);
                            computed = wt;
                        }
                    }

                    waitingTimePayload = {
                        waitingTimeTriageLevel: aiCTAS,
                        waitingTimeMinutes: computed.waitingTimeMinutes,
                        waitingTimeFormatted: computed.waitingTimeFormatted,
                        waitingTimeCalculatedAt: now.toISOString(),
                        waitingTimeDoctorsAvailable: 2,
                        waitingTimePatientsAhead: computed.patientsAhead,
                        waitingTimeDetails: computed.details || wt.details || null
                    };
                }
            } else {
                // API is down or blocked; try computing from Firestore client.
                try {
                    const computed = await calculateWaitingTimeFromFirestore(aiCTAS, 2);
                    waitingTimePayload = {
                        waitingTimeTriageLevel: aiCTAS,
                        waitingTimeMinutes: computed.waitingTimeMinutes,
                        waitingTimeFormatted: computed.waitingTimeFormatted,
                        waitingTimeCalculatedAt: now.toISOString(),
                        waitingTimeDoctorsAvailable: 2,
                        waitingTimePatientsAhead: computed.patientsAhead,
                        waitingTimeDetails: computed.details || null
                    };
                } catch (fallbackError) {
                    console.warn('Waiting time Firestore fallback failed (API not ok):', fallbackError);
                }
            }
        } catch (error) {
            console.warn('Waiting time calculation failed (will save patient without it):', error);
        }

        const docData = {
            name: patientData.personalInfo.name,
            sex: patientData.personalInfo.sex,
            phoneNumber: patientData.personalInfo.phoneNumber,
            age: age,
            dateOfBirth: patientData.personalInfo.dateOfBirth,
            arrivalInfo: patientData.arrivalInfo,
            clinicalAssessment: patientData.clinicalAssessment,
            vitalSigns: patientData.vitalSigns,
            chiefComplaint: patientData.chiefComplaint,
            aiCTAS: aiCTAS,
            finalCTAS: aiCTAS,
            triageLevel: aiCTAS,
            arrivalTime: now,
            overrideReason: null,
            status: 'waiting',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            ...(waitingTimePayload || {})
        };

        const docRef = await db.collection('patients').add(docData);
        console.log("Patient saved in Firestore with ID:", docRef.id);

        sessionStorage.setItem('triageResult', JSON.stringify({
            ...result,
            aiCTAS,
            patientId: docRef.id,
            waitingTime: waitingTimePayload
        }));
        sessionStorage.setItem('patientData', JSON.stringify(patientData));
        sessionStorage.setItem('patientId', docRef.id);

        if (waitingTimePayload) {
            sessionStorage.setItem('waitingTime', JSON.stringify(waitingTimePayload));
        }

        // ================================
        // WhatsApp message (free / nurse sends)
        // ================================
        try {
            const patientName = patientData?.personalInfo?.name || 'Patient';
            const rawPhone = patientData?.personalInfo?.phoneNumber;

            let waitMinutes = waitingTimePayload?.waitingTimeMinutes;
            let waitFormatted = waitingTimePayload?.waitingTimeFormatted;

            if (!Number.isFinite(Number(waitMinutes)) || !waitFormatted) {
                try {
                    const computed = await calculateWaitingTimeFromFirestore(aiCTAS, 2);
                    if (!Number.isFinite(Number(waitMinutes))) {
                        waitMinutes = computed?.waitingTimeMinutes;
                    }
                    if (!waitFormatted) {
                        waitFormatted = computed?.waitingTimeFormatted;
                    }
                } catch (_) {
                    // ignore
                }
            }

            const message = buildWhatsAppMessage({
                patientName,
                waitingTimeMinutes: waitMinutes,
                waitingTimeFormatted: waitFormatted
            });

            const url = buildWhatsAppUrl(rawPhone, message);
            if (url) {
                sessionStorage.setItem('whatsappUrl', url);
            } else {
                sessionStorage.removeItem('whatsappUrl');
            }
        } catch (whatsError) {
            console.warn('WhatsApp draft open failed:', whatsError);
        }

        setTimeout(() => {
            window.location.href = 'show-result.html';
        }, 1500);

        return result;
    } catch (error) {
        console.error("Backend communication error:", error);
        throw error;
    }
}
function calculateAgeFromDOB(dob) {
    const birthDate = parseISODateToLocalDate(dob);
    if (!birthDate) return NaN;
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || 
        (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
}

// ---------------------------------
// Waiting time fallback (Firestore client)
// ---------------------------------
const TRIAGE_AVG_TIMES = {
    1: 0,
    2: 10,
    3: 20,
    4: 30,
    5: 40
};

function formatWaitingTime(minutes) {
    if (minutes === 0) return 'Immediate';
    if (minutes < 10) return '< 10 minutes';
    if (minutes < 30) return Math.round(minutes / 5) * 5 + ' minutes';
    if (minutes < 60) return Math.round(minutes / 5) * 5 + ' minutes';

    const hours = Math.ceil(minutes / 60);
    if (hours === 1) return '1 hour';
    if (hours <= 4) return hours + ' hours';
    return '4+ hours';
}

async function calculateWaitingTimeFromFirestore(triageLevel, doctorsAvailable = 2) {
    const level = Number(triageLevel);
    const doctors = Number(doctorsAvailable) || 2;

    if (!Number.isFinite(level) || level < 1 || level > 5) {
        throw new Error('Invalid triage level');
    }

    const snapshot = await db.collection('patients')
        .where('status', '==', 'waiting')
        .get();

    let patientsAhead = 0;
    snapshot.forEach(doc => {
        const data = doc.data() || {};
        const otherLevel = Number(data.triageLevel || data.finalCTAS || data.aiCTAS);
        if (Number.isFinite(otherLevel) && otherLevel <= level) {
            patientsAhead++;
        }
    });

    const effectiveQueue = doctors > 0 ? patientsAhead / doctors : patientsAhead;
    const avgTime = TRIAGE_AVG_TIMES[level] ?? 30;
    const waitingTimeMinutes = Math.ceil(effectiveQueue * avgTime);

    return {
        waitingTimeMinutes,
        waitingTimeFormatted: formatWaitingTime(waitingTimeMinutes),
        patientsAhead,
        details: {
            effectiveQueue: Number(effectiveQueue.toFixed(2)),
            averageTime: avgTime,
            availableDoctors: doctors,
            formula: `(${patientsAhead} ÷ ${doctors}) × ${avgTime}min = ${waitingTimeMinutes}min`
        }
    };
}

// ---------------------------------
// WhatsApp helpers (free: opens a prefilled draft)
// ---------------------------------
const DEFAULT_COUNTRY_CODE = '966';

function normalizePhoneForWhatsApp(rawPhone) {
    if (!rawPhone) return null;
    let digits = String(rawPhone).replace(/\D/g, '');
    if (!digits) return null;

    // 00XXXXXXXX -> XXXXXXXXX
    if (digits.startsWith('00')) digits = digits.slice(2);

    // Saudi-friendly normalization: 05XXXXXXXX -> 9665XXXXXXXX
    // If you use another country, set DEFAULT_COUNTRY_CODE accordingly or require intl format.
    if (digits.length === 10 && digits.startsWith('05')) {
        digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
    } else if (digits.length === 9 && digits.startsWith('5')) {
        digits = DEFAULT_COUNTRY_CODE + digits;
    }

    // WhatsApp requires country code without '+'
    if (digits.length < 9 || digits.length > 15) return null;
    return digits;
}

function buildWhatsAppMessage({ patientName, waitingTimeMinutes, waitingTimeFormatted }) {
    const safeName = patientName ? String(patientName).trim() : '';
    const minutesNum = Number(waitingTimeMinutes);
    const minutes = Number.isFinite(minutesNum) ? Math.max(0, Math.round(minutesNum)) : null;
    const fallback = waitingTimeFormatted ? String(waitingTimeFormatted) : null;

    const xAr = minutes !== null ? `${minutes} دقيقة` : (fallback ? fallback : 'غير متوفر');
    const xEn = minutes !== null ? `${minutes} minutes` : (fallback ? fallback : 'N/A');

    return (
`مرحبًا${safeName ? ' ' + safeName : ''}،
نود إبلاغك بأن وقت الانتظار المتوقع هو ${xAr}.
نُقدّر صبرك وتفهمك، ونعمل على خدمتك بأسرع وقت ممكن.

في حال شعرت بأي أعراض جديدة أو ازدياد في شدة الأعراض، يرجى التوجه مباشرة إلى الممرضة أو إبلاغ الطاقم الطبي فورًا.

Hello${safeName ? ' ' + safeName : ''},
We would like to inform you that your estimated waiting time is ${xEn}.
We truly appreciate your patience and understanding, and we are doing our best to assist you as quickly as possible.

If you experience any new symptoms or notice a worsening in your condition, please approach the nurse or inform the medical staff immediately.`
    );
}

function buildWhatsAppUrl(rawPhone, messageText) {
    const phone = normalizePhoneForWhatsApp(rawPhone);
    if (!phone) return null;
    const text = encodeURIComponent(String(messageText || ''));
    return `https://wa.me/${phone}?text=${text}`;
}

