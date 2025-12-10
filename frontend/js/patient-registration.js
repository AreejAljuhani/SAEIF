document.addEventListener('DOMContentLoaded', function() {
    console.log('Patient Registration page loaded');
    
    // Initialize form
    initializeForm();
    
    // Setup event listeners
    setupEventListeners();
});

function initializeForm() {
    // Set today's date as default for date inputs
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateOfBirth').max = today;
}

function setupEventListeners() {
    const form = document.getElementById('patientForm');
    form.addEventListener('submit', handleFormSubmit);
    
    // Add real-time validation
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', validateField);
        input.addEventListener('input', clearFieldError);
    });
    
    // Clear button event listener
    document.getElementById('clearButton').addEventListener('click', clearForm);
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

function validateForm() {
    let isValid = true;
    
    // Required fields validation
    const requiredFields = [
        'name', 'sex', 'age', 'dateOfBirth',
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
    
    // Additional validation for specific fields
    const hr = parseFloat(document.getElementById('hr').value);
    if (hr && (hr < 30 || hr > 200)) {
        showError(document.getElementById('hr'), 'hrError', 'Please enter a valid heart rate (30-200 bpm)');
        isValid = false;
    }
    
    const saturation = parseFloat(document.getElementById('saturation').value);
    if (saturation && (saturation < 0 || saturation > 100)) {
        showError(document.getElementById('saturation'), 'saturationError', 'Please enter valid saturation (0-100%)');
        isValid = false;
    }
    
    const nrs_pain = parseFloat(document.getElementById('nrs_pain').value);
    if (nrs_pain && (nrs_pain < 0 || nrs_pain > 10)) {
        showError(document.getElementById('nrs_pain'), 'nrs_painError', 'Please enter valid pain scale (0-10)');
        isValid = false;
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
        if (fieldId === 'hr') {
            const value = parseFloat(field.value);
            if (value && (value < 30 || value > 200)) {
                showError(field, errorId, 'Please enter a valid heart rate (30-200 bpm)');
            }
        }
        
        if (fieldId === 'saturation') {
            const value = parseFloat(field.value);
            if (value && (value < 0 || value > 100)) {
                showError(field, errorId, 'Please enter valid saturation (0-100%)');
            }
        }
        
        if (fieldId === 'nrs_pain') {
            const value = parseFloat(field.value);
            if (value && (value < 0 || value > 10)) {
                showError(field, errorId, 'Please enter valid pain scale (0-10)');
            }
        }
    }
}

function clearFieldError(event) {
    const field = event.target;
    const errorId = field.id + 'Error';
    clearError(field, errorId);
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
        // First register the patient
        const registerResponse = await fetch('http://localhost:3000/api/patients/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(patientData)
        });
        
        if (!registerResponse.ok) {
            throw new Error(`Registration failed: ${registerResponse.status}`);
        }
        
        // Then send to ML model for classification
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
        console.log('Triage result:', result);
        
        // Store result for display
        sessionStorage.setItem('triageResult', JSON.stringify(result));
        sessionStorage.setItem('patientData', JSON.stringify(patientData));
        
        // Redirect to results page
        setTimeout(() => {
            window.location.href = 'show-result.html';
        }, 1500);
        
        return result;
    } catch (error) {
        console.error('Backend communication error:', error);
        throw error;
    }
}
