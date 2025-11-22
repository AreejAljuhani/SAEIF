document.addEventListener('DOMContentLoaded', function() {
    console.log('Patient Registration page loaded');
    
    // Initialize form
    initializeForm();
    
    // Setup event listeners
    setupEventListeners();
    setupNavigation();
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
            userName: document.getElementById('userName').value,
            dateOfBirth: document.getElementById('dateOfBirth').value,
            gender: document.getElementById('gender').value
        },
        vitalSigns: {
            heartRate: document.getElementById('heartRate').value,
            bloodPressure: document.getElementById('bloodPressure').value,
            oxygenSaturation: document.getElementById('oxygenSaturation').value,
            temperature: document.getElementById('temperature').value
        },
        symptoms: document.getElementById('symptoms').value
    };
}

function validateForm() {
    let isValid = true;
    
    // Required fields validation
    const requiredFields = [
        'userName', 'dateOfBirth', 'gender', 'heartRate', 
        'bloodPressure', 'oxygenSaturation', 'temperature', 'symptoms'
    ];
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            showError(field, fieldId + 'Error', 'This field is required');
            isValid = false;
        } else {
            clearError(field, fieldId + 'Error');
        }
    });
    
    // Additional validation for specific fields
    const heartRate = document.getElementById('heartRate').value;
    if (heartRate && (heartRate < 30 || heartRate > 200)) {
        showError(document.getElementById('heartRate'), 'heartRateError', 'Please enter a valid heart rate (30-200 bpm)');
        isValid = false;
    }
    
    const oxygen = document.getElementById('oxygenSaturation').value;
    if (oxygen && (oxygen < 0 || oxygen > 100)) {
        showError(document.getElementById('oxygenSaturation'), 'oxygenSaturationError', 'Please enter valid oxygen saturation (0-100%)');
        isValid = false;
    }
    
    return isValid;
}

function validateField(event) {
    const field = event.target;
    const fieldId = field.id;
    const errorId = fieldId + 'Error';
    
    if (!field.value.trim()) {
        showError(field, errorId, 'This field is required');
    } else {
        clearError(field, errorId);
        
        // Additional field-specific validation
        if (fieldId === 'heartRate' && (field.value < 30 || field.value > 200)) {
            showError(field, errorId, 'Please enter a valid heart rate (30-200 bpm)');
        }
        
        if (fieldId === 'oxygenSaturation' && (field.value < 0 || field.value > 100)) {
            showError(field, errorId, 'Please enter valid oxygen saturation (0-100%)');
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
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function clearError(field, errorId) {
    field.classList.remove('error');
    const errorElement = document.getElementById(errorId);
    errorElement.style.display = 'none';
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
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
        submitBtn.disabled = true;
        
        // Simulate API call - replace with actual backend integration
        await simulateAPICall(patientData);
        
        // Show success message
        document.getElementById('successMessage').style.display = 'flex';
        
        // Reset form after successful registration
        setTimeout(() => {
            document.getElementById('patientForm').reset();
            document.getElementById('successMessage').style.display = 'none';
        }, 3000);
        
    } catch (error) {
        alert('Error registering patient. Please try again.');
        console.error('Registration error:', error);
    } finally {
        // Reset button state 
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function simulateAPICall(data) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Simulate random success/failure for demo
            Math.random() > 0.1 ? resolve(data) : reject(new Error('Network error'));
        }, 1500);
    });
}