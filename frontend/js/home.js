document.addEventListener('DOMContentLoaded', function() {
    console.log('Saeif Medical Dashboard with Complete CTAS Levels initialized');
    
    initializeDashboard();
    
    // Add interactions
    setupProfessionalInteractions();
    setupNavigation();
});

// Initialize dashboard data
function initializeDashboard() {
    const dashboardData = {
        patientCount: 15, 
        observationCount: 6,
        alertCount: 3,
        criticalCases: 2,    // CTAS 1
        emergencyCases: 3,   // CTAS 2
        urgentCases: 6,      // CTAS 3
        lessUrgentCases: 8,  // CTAS 4 
        nonUrgentCases: 4,   // CTAS 5 
        avgWaitTime: 28
    };
    
    updateDashboardUI(dashboardData);
}

function updateDashboardUI(data) {
    // Update all stats
    const elements = {
        patientCount: document.querySelector('.patient-count .stat-number'),
        observationCount: document.querySelector('.observation .stat-number'),
        alertCount: document.querySelector('.alerts .stat-number'),
        criticalCases: document.querySelector('.critical .emergency-stat-number'),
        emergencyCases: document.querySelector('.emergency .emergency-stat-number'),
        urgentCases: document.querySelector('.urgent .emergency-stat-number'),
        lessUrgentCases: document.querySelector('.less-urgent .emergency-stat-number'),
        nonUrgentCases: document.querySelector('.non-urgent .emergency-stat-number'),
        waitingTime: document.querySelector('.waiting-time .emergency-stat-number')
    };
    
    // Update values
    if (elements.patientCount) elements.patientCount.textContent = data.patientCount;
    if (elements.observationCount) elements.observationCount.textContent = data.observationCount;
    if (elements.alertCount) elements.alertCount.textContent = data.alertCount;
    if (elements.criticalCases) elements.criticalCases.textContent = data.criticalCases;
    if (elements.emergencyCases) elements.emergencyCases.textContent = data.emergencyCases;
    if (elements.urgentCases) elements.urgentCases.textContent = data.urgentCases;
    if (elements.lessUrgentCases) elements.lessUrgentCases.textContent = data.lessUrgentCases;
    if (elements.nonUrgentCases) elements.nonUrgentCases.textContent = data.nonUrgentCases;
    if (elements.waitingTime) {
        elements.waitingTime.innerHTML = `${data.avgWaitTime}<span>minutes</span>`;
    }
}

function setupProfessionalInteractions() {
    // Add smooth interactions for all stat cards
    document.querySelectorAll('.stat-action').forEach(action => {
        action.addEventListener('click', function() {
            const actionType = this.getAttribute('data-action');
            handleStatAction(actionType);
            
            // Click feedback
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
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
            // Already on home page
            break;
        case 'registration':
            window.location.href = 'patient-registration.html';
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

function handleStatAction(action) {
    console.log('Stat action triggered:', action);
    
    switch(action) {
        case 'patient-list':
            // Navigate to patient list
            document.querySelector('[data-page="patient-list"]').click();
            break;
        case 'iot-monitoring':
            // Navigate to IOT monitoring
            document.querySelector('[data-page="iot-monitoring"]').click();
            break;
        case 'alerts':
            // Navigate to alerts
            document.querySelector('[data-page="alerts"]').click();
            break;
        default:
            console.log('Unknown action:', action);
    }
}

// API integration for CTAS data
async function fetchEmergencyStats() {
    try {
        // Will connect to backend API later
        const response = await fetch('/api/emergency/stats');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching emergency stats:', error);
        return null;
    }
}

// Real-time data refresh
setInterval(async () => {
    const newData = await fetchEmergencyStats();
    if (newData) {
        updateDashboardUI(newData);
    }
}, 30000); // Refresh every 30 seconds