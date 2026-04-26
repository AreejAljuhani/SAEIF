/**
 * Test Data Setup Script
 * 
 * Use this to populate Firestore with test patients for queue demonstrations
 * 
 * Run: node backend/scripts/populate-test-data.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'saeif-healthcare'
    });
}

const db = admin.firestore();

/**
 * Sample test patients with various triage levels
 */
const TEST_PATIENTS = [
    {
        id: 'test-p1-critical',
        name: 'Alice Cooper (Critical)',
        triageLevel: 1,
        gender: 'F',
        age: 65
    },
    {
        id: 'test-p2-very-urgent-1',
        name: 'Bob Smith (Very Urgent)',
        triageLevel: 2,
        gender: 'M',
        age: 45
    },
    {
        id: 'test-p3-very-urgent-2',
        name: 'Carol White (Very Urgent)',
        triageLevel: 2,
        gender: 'F',
        age: 52
    },
    {
        id: 'test-p4-urgent-1',
        name: 'David Brown (Urgent)',
        triageLevel: 3,
        gender: 'M',
        age: 38
    },
    {
        id: 'test-p5-urgent-2',
        name: 'Emma Davis (Urgent)',
        triageLevel: 3,
        gender: 'F',
        age: 41
    },
    {
        id: 'test-p6-semi-urgent-1',
        name: 'Frank Miller (Semi-Urgent)',
        triageLevel: 4,
        gender: 'M',
        age: 55
    },
    {
        id: 'test-p7-semi-urgent-2',
        name: 'Grace Lee (Semi-Urgent)',
        triageLevel: 4,
        gender: 'F',
        age: 48
    },
    {
        id: 'test-p8-semi-urgent-3',
        name: 'Henry Wilson (Semi-Urgent)',
        triageLevel: 4,
        gender: 'M',
        age: 60
    },
    {
        id: 'test-p9-non-urgent-1',
        name: 'Iris Taylor (Non-Urgent)',
        triageLevel: 5,
        gender: 'F',
        age: 35
    },
    {
        id: 'test-p10-non-urgent-2',
        name: 'Jack Anderson (Non-Urgent)',
        triageLevel: 5,
        gender: 'M',
        age: 42
    }
];

/**
 * Create test patient document
 */
async function createTestPatient(patientData) {
    try {
        const now = admin.firestore.Timestamp.now();
        
        const docData = {
            ...patientData,
            status: 'waiting',
            arrivalTime: now,
            personalInfo: {
                name: patientData.name,
                age: patientData.age,
                sex: patientData.gender === 'F' ? '1' : '2'
            },
            vitalSigns: {
                sbp: Math.floor(Math.random() * 40) + 110,  // 110-150
                dbp: Math.floor(Math.random() * 30) + 70,   // 70-100
                hr: Math.floor(Math.random() * 30) + 65,    // 65-95
                rr: Math.floor(Math.random() * 8) + 12,     // 12-20
                bt: 37 + (Math.random() * 0.5),             // 37-37.5
                saturation: Math.floor(Math.random() * 3) + 97  // 97-100
            },
            clinicalAssessment: {
                pain: Math.floor(Math.random() * 5) + 1,
                injury: Math.floor(Math.random() * 3) + 1,
                mental: Math.floor(Math.random() * 3) + 1
            }
        };

        await db.collection('patients').doc(patientData.id).set(docData);
        console.log(`✅ Created: ${patientData.name} (Level ${patientData.triageLevel})`);
        
        return true;
    } catch (error) {
        console.error(`❌ Failed to create ${patientData.name}:`, error.message);
        return false;
    }
}

/**
 * Delete all test data
 */
async function deleteTestData() {
    try {
        console.log('\n🗑️  Cleaning up test data...');
        
        for (const patient of TEST_PATIENTS) {
            try {
                await db.collection('patients').doc(patient.id).delete();
                console.log(`✅ Deleted: ${patient.id}`);
            } catch (error) {
                console.warn(`⚠️  Could not delete ${patient.id}:`, error.message);
            }
        }
        
        console.log('✅ Cleanup complete\n');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

/**
 * Display test scenario explanation
 */
function displayScenario() {
    console.log('\n' + '='.repeat(60));
    console.log('WAITING TIME CALCULATION TEST SCENARIO');
    console.log('='.repeat(60));
    
    console.log('\n📋 Test Queue Configuration:');
    console.log('   • Critical (Level 1): 1 patient');
    console.log('   • Very Urgent (Level 2): 2 patients');
    console.log('   • Urgent (Level 3): 2 patients');
    console.log('   • Semi-Urgent (Level 4): 3 patients');
    console.log('   • Non-Urgent (Level 5): 2 patients');
    console.log('   • Total: 10 patients');
    
    console.log('\n👨‍⚕️  Hospital Configuration:');
    console.log('   • Available Doctors: 2');
    console.log('   • Consultation Times: See TRIAGE_AVG_TIMES');
    
    console.log('\n📊 Example Calculations:');
    
    // Level 3 patient
    console.log('\n   Example 1: NEW Patient - Level 3 (Urgent)');
    console.log('   • Patients ahead with level 1-3: 5 (1 critical + 2 very urgent + 2 urgent)');
    console.log('   • Effective queue: 5 ÷ 2 = 2.5');
    console.log('   • Avg time for level 3: 20 minutes');
    console.log('   • Wait time: 2.5 × 20 = 50 minutes');
    
    // Level 4 patient
    console.log('\n   Example 2: NEW Patient - Level 4 (Semi-Urgent)');
    console.log('   • Patients ahead with level 1-4: 8 (1+2+2+3)');
    console.log('   • Effective queue: 8 ÷ 2 = 4');
    console.log('   • Avg time for level 4: 30 minutes');
    console.log('   • Wait time: 4 × 30 = 120 minutes (2 hours)');
    
    // Level 5 patient
    console.log('\n   Example 3: NEW Patient - Level 5 (Non-Urgent)');
    console.log('   • Patients ahead with level 1-5: 10 (all)');
    console.log('   • Effective queue: 10 ÷ 2 = 5');
    console.log('   • Avg time for level 5: 40 minutes');
    console.log('   • Wait time: 5 × 40 = 200 minutes (3.3 hours)');
    
    console.log('\n💡 Key Insight:');
    console.log('   Higher priority patients ahead significantly increase wait time');
    console.log('   More doctors = shorter effective queue');
    console.log('   Higher triage levels have longer consultation times');
    
    console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Main execution
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    console.log('🏥 SAEIF Test Data Manager\n');

    try {
        if (command === 'delete' || command === 'clean') {
            await deleteTestData();
        } else {
            console.log('📝 Populating test patients...\n');
            
            let successCount = 0;
            for (const patient of TEST_PATIENTS) {
                const created = await createTestPatient(patient);
                if (created) successCount++;
            }
            
            console.log(`\n✅ Successfully created ${successCount}/${TEST_PATIENTS.length} test patients`);
            
            displayScenario();
            
            console.log('🧪 TESTING:');
            console.log('   1. Start backend: npm start');
            console.log('   2. Go to http://localhost:5500/frontend/patient-registration.html');
            console.log('   3. Fill in form and register patient');
            console.log('   4. View calculated waiting time on result page');
            console.log('   5. Check browser console for API response details\n');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run the script
main();
