# Waiting Time Calculation System

## Overview

The waiting time calculation system estimates realistic patient waiting times based on:
1. **Triage Level** (Priority: 1-5, where 1 is critical and 5 is non-urgent)
2. **Patients in Queue** (with same or higher priority)
3. **Available Doctors** (parallel consultation capability)
4. **Average Consultation Time** (varies by triage level)

## Formula

```
Waiting Time = (Patients Ahead with Same/Higher Priority ÷ Available Doctors) × Average Time
```

### Example
- Patient triage level: 4 (Semi-urgent)
- Patients ahead with level 1-4: 8
- Available doctors: 2
- Average time for level 4: 30 minutes

**Calculation:**
- (8 ÷ 2) × 30 = 4 × 30 = **120 minutes (2 hours)**

## Triage Levels & Average Times

| Level | Priority | Avg Consultation Time |
|-------|----------|----------------------|
| 1 | Critical | 0 min (immediate) |
| 2 | Very Urgent | 10 min |
| 3 | Urgent | 20 min |
| 4 | Semi-Urgent | 30 min |
| 5 | Non-Urgent | 40 min |

## System Architecture

### Backend Components

#### 1. Queue Manager (`backend/utils/queueManager.js`)
Core utility for queue management and calculations:

```javascript
// Calculate waiting time
calculateWaitingTime(triageLevel, availableDoctors)

// Get waiting queue
getWaitingQueue()

// Count patients ahead
countPatientsAhead(triageLevel)

// Format time for display
formatWaitingTime(minutes)

// Queue management
addPatientToQueue(patientId, triageLevel, data)
removePatientFromQueue(patientId)

// Queue statistics
getQueueStats()
```

#### 2. API Route (`backend/routes/classify.js`)
POST endpoint for calculating waiting time:

```
POST /api/calculate-waiting-time

Request body:
{
  "triageLevel": 3,
  "doctorsAvailable": 2
}

Response:
{
  "success": true,
  "triageLevel": 3,
  "waitingTimeMinutes": 30,
  "waitingTimeFormatted": "30 minutes",
  "patientsAhead": 3,
  "details": {
    "effectiveQueue": 1.5,
    "averageTime": 20,
    "availableDoctors": 2,
    "formula": "(3 ÷ 2) × 20min = 30min"
  }
}
```

### Frontend Components

#### Show Result Page (`frontend/js/show-result.js`)
Displays calculated waiting time after triage classification:

1. Shows "Calculating..." while fetching data
2. Calls backend API with patient's triage level
3. Displays formatted waiting time in the UI
4. Falls back to defaults if API fails

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

This installs `firebase-admin` needed for Firestore access.

### 2. Configure Firebase
Set environment variables in your `.env` file or deploy configuration:
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_DB_URL=your-database-url
```

### 3. Create Firestore Collection Structure
Your Firestore database should have a `patients` collection with documents like:

```javascript
{
  "id": "patient123",
  "name": "John Doe",
  "status": "waiting",  // "waiting" | "in-treatment" | "discharged"
  "triageLevel": 3,      // 1-5
  "arrivalTime": Timestamp,
  "personalInfo": {
    "age": 45,
    "sex": "2"  // 1=Female, 2=Male
  },
  "clinicalAssessment": {
    "pain": 3,
    "injury": 1,
    "mental": 1
  },
  "vitalSigns": {
    "sbp": 120,
    "dbp": 80,
    "hr": 75,
    "rr": 16,
    "bt": 37,
    "saturation": 98
  }
}
```

### 4. Add Test Data (Optional)
Use this script to populate test patients in the waiting queue:

```javascript
// In Firestore Console or Node script
const testPatients = [
  { triageLevel: 1, name: "Critical Patient" },
  { triageLevel: 2, name: "Very Urgent Patient" },
  { triageLevel: 2, name: "Another Very Urgent" },
  { triageLevel: 3, name: "Urgent Patient" },
  { triageLevel: 4, name: "Semi-Urgent 1" },
  { triageLevel: 4, name: "Semi-Urgent 2" },
  { triageLevel: 5, name: "Non-Urgent 1" },
  { triageLevel: 5, name: "Non-Urgent 2" }
];

// Add to Firestore
for (let i = 0; i < testPatients.length; i++) {
  db.collection('patients').doc(`test-patient-${i}`).set({
    ...testPatients[i],
    status: 'waiting',
    arrivalTime: admin.firestore.Timestamp.now()
  });
}
```

## Usage Flow

### When a Patient is Triaged:

1. **Patient Fills Form** → `patient-registration.html`
2. **ML Model Classifies** → Python model predicts triage level
3. **Show Result Page Loads** → `show-result.html`
4. **Frontend Calls API** → `/api/calculate-waiting-time`
5. **Backend Calculates**:
   - Queries all waiting patients
   - Filters patients with same/higher priority
   - Applies formula
   - Returns formatted result
6. **UI Updates** → Shows estimated wait time

### When Patient is Called:

```javascript
// Remove from queue (call this when patient is called)
await removePatientFromQueue(patientId);
// This updates status to "in-treatment"
```

## Key Features

✅ **Realistic estimates** - Considers actual queue and doctor availability
✅ **Priority-based** - Only counts patients with same or higher priority
✅ **Parallel processing** - Accounts for multiple doctors working simultaneously
✅ **Formatted output** - Converts minutes to readable strings ("30 minutes", "2 hours")
✅ **Fallback handling** - Uses defaults if database unavailable
✅ **Extensible** - Easy to add more constraints (beds, specialties, etc.)

## Customization

### Change Available Doctors
In `show-result.js`, modify the API call:
```javascript
body: JSON.stringify({
    triageLevel: prediction,
    doctorsAvailable: 3  // Change this number
})
```

Or fetch from database/settings.

### Adjust Average Times
Edit `backend/utils/queueManager.js`:
```javascript
const TRIAGE_AVG_TIMES = {
    1: 0,    // Adjust these values
    2: 15,   // based on your hospital
    3: 25,
    4: 35,
    5: 45
};
```

### Add Bed Capacity
Extend the calculation to consider available beds:
```javascript
const availableBeds = await getAvailableBeds();
const bedFactor = availableBeds > 0 ? 1 : 1.5;  // Slow if no beds
waitingTimeMinutes = Math.ceil(effectiveQueue * avgTime * bedFactor);
```

## Troubleshooting

### "Waiting time" shows "Calculating..." forever
- Check if backend is running: `npm start` in `/backend`
- Check browser console for errors
- Verify CORS is enabled in backend
- Check Firestore connection and permissions

### Wrong waiting times
- Verify `triageLevel` field exists in database documents
- Check `status` field is set to `"waiting"`
- Ensure timestamps are valid
- Check available doctors parameter

### API returns 400 error
- Verify triageLevel is between 1-5
- Check request JSON formatting
- See console logs for detailed error

## Performance Notes

- Initial load may take 1-2 seconds (Firestore query)
- For large queues (100+ patients), consider pagination
- Consider caching results for 30-60 seconds if accuracy permits
- Monitor Firestore read operations (they count toward quota)

## Future Enhancements

1. **Machine Learning** - Predict waiting time from historical data
2. **Dynamic Staffing** - Adjust calculations based on shift schedules
3. **Real-time Updates** - Websockets for live queue changes
4. **Specialty Queues** - Different queues for different departments
5. **Analytics** - Track actual vs. predicted wait times
6. **Notifications** - Alert patients when approaching their turn

## Support

For issues or questions about the waiting time system:
1. Check the backend logs: `npm start` output
2. Inspect browser console: `F12` → Console tab
3. Verify Firestore rules allow reading `patients` collection
4. Test API directly: `curl -X POST http://localhost:3000/api/calculate-waiting-time -H "Content-Type: application/json" -d '{"triageLevel":3,"doctorsAvailable":2}'`
