/**
 * Waiting Time API Test
 * 
 * Quick test to verify the /api/calculate-waiting-time endpoint works
 * 
 * Usage:
 *   1. Ensure backend is running: npm start (from /backend)
 *   2. Run: node backend/scripts/test-waiting-time-api.js
 */

const http = require('http');

// Test cases
const TEST_CASES = [
    { triageLevel: 1, doctorsAvailable: 2, description: 'Critical patient' },
    { triageLevel: 2, doctorsAvailable: 2, description: 'Very urgent patient' },
    { triageLevel: 3, doctorsAvailable: 2, description: 'Urgent patient' },
    { triageLevel: 4, doctorsAvailable: 2, description: 'Semi-urgent patient' },
    { triageLevel: 5, doctorsAvailable: 2, description: 'Non-urgent patient' },
    { triageLevel: 3, doctorsAvailable: 1, description: 'Urgent patient (1 doctor)' },
    { triageLevel: 3, doctorsAvailable: 3, description: 'Urgent patient (3 doctors)' }
];

/**
 * Make HTTP POST request
 */
function makeRequest(path, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({
                        statusCode: res.statusCode,
                        data: parsed
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

/**
 * Format test output
 */
function formatResult(testCase, result) {
    const { statusCode, data } = result;
    const success = statusCode === 200 && data.success;
    
    console.log('\n' + '─'.repeat(70));
    console.log(`📋 Test: ${testCase.description}`);
    console.log('─'.repeat(70));
    console.log(`Status: ${success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`HTTP Code: ${statusCode}`);
    
    if (data.success) {
        console.log(`\nInput:`);
        console.log(`  • Triage Level: ${testCase.triageLevel}`);
        console.log(`  • Doctors Available: ${testCase.doctorsAvailable}`);
        
        console.log(`\nOutput:`);
        console.log(`  • Waiting Time: ${data.waitingTimeFormatted} (${data.waitingTimeMinutes} min)`);
        console.log(`  • Patients Ahead: ${data.patientsAhead}`);
        
        console.log(`\nCalculation Details:`);
        console.log(`  • Formula: ${data.details.formula}`);
        console.log(`  • Effective Queue: ${data.details.effectiveQueue}`);
        console.log(`  • Average Consultation Time: ${data.details.averageTime} min`);
    } else if (data.error) {
        console.log(`\nError: ${data.error}`);
        if (data.message) console.log(`Message: ${data.message}`);
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('='.repeat(70));
    console.log('🧪 WAITING TIME API TEST SUITE');
    console.log('='.repeat(70));
    console.log(`\nTesting API endpoint: POST http://localhost:3000/api/calculate-waiting-time`);
    console.log(`Total test cases: ${TEST_CASES.length}\n`);
    
    let passed = 0;
    let failed = 0;

    for (const testCase of TEST_CASES) {
        try {
            const result = await makeRequest('/api/calculate-waiting-time', {
                triageLevel: testCase.triageLevel,
                doctorsAvailable: testCase.doctorsAvailable
            });

            formatResult(testCase, result);

            if (result.statusCode === 200 && result.data.success) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.log('\n' + '─'.repeat(70));
            console.log(`❌ Test FAILED: ${testCase.description}`);
            console.log('─'.repeat(70));
            console.log(`Error: ${error.message}`);
            failed++;
        }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Total: ${passed + failed}\n`);

    if (failed === 0) {
        console.log('🎉 All tests passed!\n');
        process.exit(0);
    } else {
        console.log(`⚠️  ${failed} test(s) failed\n`);
        console.log('Troubleshooting:');
        console.log('  1. Is backend running? Run: npm start (from /backend)');
        console.log('  2. Is port 3000 available?');
        console.log('  3. Check backend console for error messages');
        console.log('  4. Verify Firebase credentials are configured\n');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
