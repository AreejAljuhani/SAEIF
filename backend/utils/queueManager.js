const admin = require('firebase-admin');

/**
 * Queue Manager Utility
 * Handles waiting patient queue and waiting time calculations
 */

// Lazy initialization - get db when needed, not when module loads
function getDb() {
    return admin.firestore();
}

// Triage level average consultation times (in minutes)
const TRIAGE_AVG_TIMES = {
    1: 0,   // Critical - immediate
    2: 10,  // Very urgent
    3: 20,  // Urgent
    4: 30,  // Semi urgent
    5: 40   // Non urgent
};

/**
 * Get all waiting patients from queue
 * @returns {Promise<Array>} Array of waiting patients
 */
async function getWaitingQueue() {
    try {
        const db = getDb();
        const snapshot = await db.collection('patients')
            .where('status', '==', 'waiting')
            .orderBy('triageLevel', 'asc')
            .orderBy('arrivalTime', 'asc')
            .get();

        const waitingPatients = [];
        snapshot.forEach(doc => {
            waitingPatients.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return waitingPatients;
    } catch (error) {
        console.error('Error getting waiting queue:', error);
        return [];
    }
}

/**
 * Count patients ahead with same or higher priority
 * @param {number} triageLevel - Patient's triage level (1-5)
 * @returns {Promise<number>} Number of patients ahead
 */
async function countPatientsAhead(triageLevel) {
    const queue = await getWaitingQueue();
    
    let patientsAhead = 0;
    queue.forEach(patient => {
        // Count if patient has same or higher priority (lower number = higher priority)
        if (patient.triageLevel && patient.triageLevel <= triageLevel) {
            patientsAhead++;
        }
    });

    return patientsAhead;
}

/**
 * Calculate waiting time
 * @param {number} triageLevel - Patient's triage level (1-5)
 * @param {number} availableDoctors - Number of available doctors (default: 2)
 * @returns {Promise<Object>} Waiting time calculation result
 */
async function calculateWaitingTime(triageLevel, availableDoctors = 2) {
    try {
        // Validate input
        if (!triageLevel || triageLevel < 1 || triageLevel > 5) {
            throw new Error('Invalid triage level. Must be 1-5.');
        }

        // Get count of patients ahead
        const patientsAhead = await countPatientsAhead(triageLevel);

        // Calculate effective queue considering parallel doctors
        const effectiveQueue = availableDoctors > 0 
            ? patientsAhead / availableDoctors 
            : patientsAhead;

        // Get average time for this triage level
        const avgTime = TRIAGE_AVG_TIMES[triageLevel] || 30;

        // Calculate total waiting time in minutes
        const waitingTimeMinutes = Math.ceil(effectiveQueue * avgTime);

        return {
            success: true,
            triageLevel,
            waitingTimeMinutes,
            patientsAhead,
            effectiveQueue: Number(effectiveQueue.toFixed(2)),
            avgTime,
            availableDoctors,
            formula: `(${patientsAhead} ÷ ${availableDoctors}) × ${avgTime}min = ${waitingTimeMinutes}min`
        };
    } catch (error) {
        console.error('Error calculating waiting time:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Format waiting time in minutes to readable string
 * @param {number} minutes - Waiting time in minutes
 * @returns {string} Formatted waiting time
 */
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

/**
 * Add patient to waiting queue (used when patient arrives)
 * @param {string} patientId - Patient ID
 * @param {number} triageLevel - Triage level (1-5)
 * @param {Object} patientData - Additional patient data
 * @returns {Promise<boolean>} Success status
 */
async function addPatientToQueue(patientId, triageLevel, patientData = {}) {
    try {
        const db = getDb();
        await db.collection('patients').doc(patientId).update({
            status: 'waiting',
            triageLevel,
            arrivalTime: admin.firestore.FieldValue.serverTimestamp(),
            ...patientData
        });

        console.log(`Patient ${patientId} added to waiting queue with level ${triageLevel}`);
        return true;
    } catch (error) {
        console.error('Error adding patient to queue:', error);
        return false;
    }
}

/**
 * Remove patient from waiting queue (when called/treated)
 * @param {string} patientId - Patient ID
 * @returns {Promise<boolean>} Success status
 */
async function removePatientFromQueue(patientId) {
    try {
        const db = getDb();
        await db.collection('patients').doc(patientId).update({
            status: 'in-treatment',
            departureFromQueue: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Patient ${patientId} removed from waiting queue`);
        return true;
    } catch (error) {
        console.error('Error removing patient from queue:', error);
        return false;
    }
}

/**
 * Get queue statistics
 * @returns {Promise<Object>} Queue statistics
 */
async function getQueueStats() {
    try {
        const queue = await getWaitingQueue();
        
        const stats = {
            totalPatients: queue.length,
            byLevel: {}
        };

        // Count patients by triage level
        queue.forEach(patient => {
            const level = patient.triageLevel || 5;
            stats.byLevel[level] = (stats.byLevel[level] || 0) + 1;
        });

        return stats;
    } catch (error) {
        console.error('Error getting queue stats:', error);
        return { totalPatients: 0, byLevel: {} };
    }
}

module.exports = {
    getWaitingQueue,
    countPatientsAhead,
    calculateWaitingTime,
    formatWaitingTime,
    addPatientToQueue,
    removePatientFromQueue,
    getQueueStats,
    TRIAGE_AVG_TIMES
};
