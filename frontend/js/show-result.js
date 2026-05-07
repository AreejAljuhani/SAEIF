document.addEventListener("DOMContentLoaded", function () {

var db = firebase.firestore();

var startMonitoringBtn = null; // Will be created dynamically

var currentPatientId = null;

// ---------------------------------
// WhatsApp helpers (free: opens a prefilled draft)
// ---------------------------------
var DEFAULT_COUNTRY_CODE = '966';

function normalizePhoneForWhatsApp(rawPhone) {
if (!rawPhone) return null;
var digits = String(rawPhone).replace(/\D/g, '');
if (!digits) return null;

if (digits.indexOf('00') === 0) digits = digits.slice(2);

// Saudi-friendly normalization: 05XXXXXXXX -> 9665XXXXXXXX
if (digits.length === 10 && digits.indexOf('05') === 0) {
digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
} else if (digits.length === 9 && digits.indexOf('5') === 0) {
digits = DEFAULT_COUNTRY_CODE + digits;
}

if (digits.length < 9 || digits.length > 15) return null;
return digits;
}

function buildWhatsAppMessage(payload) {
var safeName = payload && payload.patientName ? String(payload.patientName).trim() : '';
var minutesNum = payload ? Number(payload.waitingTimeMinutes) : NaN;
var minutes = Number.isFinite(minutesNum) ? Math.max(0, Math.round(minutesNum)) : null;
var fallback = payload && payload.waitingTimeFormatted ? String(payload.waitingTimeFormatted) : null;

var xAr = minutes !== null ? (minutes + ' دقيقة') : (fallback ? fallback : 'غير متوفر');
var xEn = minutes !== null ? (minutes + ' minutes') : (fallback ? fallback : 'N/A');

return ('مرحبًا' + (safeName ? ' ' + safeName : '') + '،\n') +
'نود إبلاغك بأن وقت الانتظار المتوقع هو ' + xAr + '.\n' +
'نُقدّر صبرك وتفهمك، ونعمل على خدمتك بأسرع وقت ممكن.\n\n' +
'في حال شعرت بأي أعراض جديدة أو ازدياد في شدة الأعراض، يرجى التوجه مباشرة إلى الممرضة أو إبلاغ الطاقم الطبي فورًا.\n\n' +
('Hello' + (safeName ? ' ' + safeName : '') + ',\n') +
'We would like to inform you that your estimated waiting time is ' + xEn + '.\n' +
'We truly appreciate your patience and understanding, and we are doing our best to assist you as quickly as possible.\n\n' +
'If you experience any new symptoms or notice a worsening in your condition, please approach the nurse or inform the medical staff immediately.';
}

function buildWhatsAppUrl(rawPhone, messageText) {
var phone = normalizePhoneForWhatsApp(rawPhone);
if (!phone) return null;
var text = encodeURIComponent(String(messageText || ''));
return 'https://wa.me/' + phone + '?text=' + text;
}

function parseWaitingMinutesFromText(text) {
if (!text) return null;
var t = String(text).trim();
if (!t) return null;

if (t.toLowerCase().indexOf('immediate') >= 0) return 0;

// "< 10 minutes" => 10
var ltMatch = t.match(/<\s*(\d+)\s*minutes/i);
if (ltMatch) return Number(ltMatch[1]);

// "20 minutes" => 20
var minMatch = t.match(/(\d+)\s*minutes?/i);
if (minMatch) return Number(minMatch[1]);

// "1 hour" / "2 hours" / "4+ hours"
var plusHoursMatch = t.match(/(\d+)\+\s*hours?/i);
if (plusHoursMatch) return Number(plusHoursMatch[1]) * 60;

var hoursMatch = t.match(/(\d+)\s*hours?/i);
if (hoursMatch) return Number(hoursMatch[1]) * 60;

return null;
}

function getWaitingTimeForMessage() {
// Prefer the numeric payload stored from registration/result.
try {
var wtStr = sessionStorage.getItem('waitingTime');
if (wtStr) {
var wt = JSON.parse(wtStr);
if (wt) {
return {
minutes: wt.waitingTimeMinutes,
formatted: wt.waitingTimeFormatted
};
}
}
} catch (_) {
// ignore
}

var el = document.getElementById('waitingTime');
var domText = el && el.textContent ? el.textContent.trim() : '';
var parsed = parseWaitingMinutesFromText(domText);
return {
minutes: parsed,
formatted: domText || null
};
}

// Frontend fallback waiting-time calculator (uses Firebase client SDK).
// This is used when the backend can't read Firestore (e.g., missing firebase-admin credentials).
var TRIAGE_AVG_TIMES = {
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

var hours = Math.ceil(minutes / 60);
if (hours === 1) return '1 hour';
if (hours <= 4) return hours + ' hours';
return '4+ hours';
}

async function calculateWaitingTimeFromFirestore(triageLevel, doctorsAvailable, excludePatientId) {
var level = Number(triageLevel);
var doctors = Number(doctorsAvailable) || 2;

if (!Number.isFinite(level) || level < 1 || level > 5) {
throw new Error('Invalid triage level');
}

var snapshot = await db.collection('patients')
.where('status', '==', 'waiting')
.get();

var patientsAhead = 0;
snapshot.forEach(function (doc) {
if (excludePatientId && doc.id === excludePatientId) return;

var data = doc.data() || {};
var otherLevel = Number(data.triageLevel || data.finalCTAS || data.aiCTAS);
if (Number.isFinite(otherLevel) && otherLevel <= level) {
patientsAhead++;
}
});

var effectiveQueue = doctors > 0 ? patientsAhead / doctors : patientsAhead;
var avgTime = (TRIAGE_AVG_TIMES[level] === undefined || TRIAGE_AVG_TIMES[level] === null)
? 30
: TRIAGE_AVG_TIMES[level];

var waitingTimeMinutes = Math.ceil(effectiveQueue * avgTime);
return {
waitingTimeMinutes: waitingTimeMinutes,
waitingTimeFormatted: formatWaitingTime(waitingTimeMinutes),
patientsAhead: patientsAhead,
details: {
effectiveQueue: Number(effectiveQueue.toFixed(2)),
averageTime: avgTime,
availableDoctors: doctors,
formula: '(' + patientsAhead + ' ÷ ' + doctors + ') × ' + avgTime + 'min = ' + waitingTimeMinutes + 'min'
}
};
}

function normalizeCtasValue(value) {
if (value === undefined || value === null) {
return NaN;
}

if (typeof value === "number") {
return Number.isFinite(value) ? value : NaN;
}

if (typeof value === "string") {
var trimmed = value.trim();

if (!trimmed) {
return NaN;
}

var directNumber = Number(trimmed);
if (Number.isFinite(directNumber)) {
return directNumber;
}

var match = trimmed.match(/[1-5]/);
return match ? Number(match[0]) : NaN;
}

return NaN;
}

// ================================
// GET DATA
// ================================
var triageResultStr = sessionStorage.getItem("triageResult");
var patientDataStr = sessionStorage.getItem("patientData");

if (!triageResultStr || !patientDataStr) {
document.querySelector(".patient-name").textContent = "No data found";
document.querySelector(".ctas-number").textContent = "--";
document.querySelector(".ctas-desc").textContent = "Please register a patient first";
return;
}

try {

var triageResult = JSON.parse(triageResultStr);
var patientData = JSON.parse(patientDataStr);

// ================================
// PATIENT ID
// ================================
currentPatientId = sessionStorage.getItem('patientId');
if (!currentPatientId) {
currentPatientId = patientData.id;
}
if (!currentPatientId) {
currentPatientId = patientData.patientId;
}

// ================================
// PATIENT INFO
// ================================
var patientName = "Unknown";
if (patientData.personalInfo && patientData.personalInfo.name) {
patientName = patientData.personalInfo.name;
}

document.getElementById("patientName").textContent = patientName;

var genderMap = { "1": "Female", "2": "Male" };

var arrivalModeMap = {
"1": "Walking",
"2": "119 use",
"3": "Private car",
"4": "Private ambulance",
"5": "Public transportation",
"6": "Wheelchair",
"7": "Others"
};

var age = "--";
var sex = "--";

if (patientData.personalInfo) {
age = patientData.personalInfo.age || "--";
sex = patientData.personalInfo.sex || "--";
}

document.getElementById("displayAge").textContent = age;
document.getElementById("displayGender").textContent = genderMap[sex] || "--";

var arrivalMode = "--";
if (patientData.arrivalInfo) {
arrivalMode = patientData.arrivalInfo.arrival_mode;
}

document.getElementById("displayArrivalMode").textContent =
arrivalModeMap[arrivalMode] || "--";

document.getElementById("patientInfo").style.display = "block";

// ================================
// 🔥 CTAS (ONLY aiCTAS)
// ================================
var predictionSources = [
triageResult.aiCTAS,
triageResult.ctas,
triageResult.finalCTAS,
triageResult.prediction,
triageResult.prediction && triageResult.prediction.ctas,
triageResult.prediction && triageResult.prediction.aiCTAS,
triageResult.prediction && triageResult.prediction.prediction
];

var prediction = NaN;

for (var index = 0; index < predictionSources.length; index++) {
var parsedPrediction = normalizeCtasValue(predictionSources[index]);
if (!isNaN(parsedPrediction)) {
prediction = parsedPrediction;
break;
}
}

console.log("AI CTAS:", prediction);

// ================================
// TEXTS
// ================================
var ctasDescriptions = {
1: "Critical - Immediate resuscitation",
2: "Emergent - High urgency",
3: "Urgent - Moderate urgency",
4: "Semi-urgent - Lower urgency",
5: "Non-urgent - Least urgency"
};

// ================================
// CALCULATE REALISTIC WAITING TIME
// ================================
async function calculateAndDisplayWaitingTime() {
    const waitingEl = document.getElementById("waitingTime");
    if (!waitingEl) return;

    // 1) Prefer the value that was calculated & saved during registration,
    //    but only if it's for the same CTAS level we are currently displaying.
    try {
        const saved = sessionStorage.getItem('waitingTime');
        if (saved) {
            const parsed = JSON.parse(saved);
            const sameLevel =
                !parsed || parsed.waitingTimeTriageLevel === undefined ||
                Number(parsed.waitingTimeTriageLevel) === Number(prediction);

            const isImmediate = String(parsed && parsed.waitingTimeFormatted ? parsed.waitingTimeFormatted : '')
                .trim()
                .toLowerCase() === 'immediate';

            // If a stored value is "Immediate" for CTAS>1, it's often stale from when backend
            // couldn't read Firestore. Recalculate in that case.
            if (parsed && parsed.waitingTimeFormatted && sameLevel && !(Number(prediction) > 1 && isImmediate)) {
                waitingEl.textContent = parsed.waitingTimeFormatted;
                return;
            }
        }
    } catch (_) {
        // ignore
    }

    // 2) If we have a patient id, try reading from Firestore.
    try {
        if (currentPatientId) {
            const snap = await db.collection('patients').doc(currentPatientId).get();
            if (snap && snap.exists) {
                const patient = snap.data() || {};
                const sameLevel =
                    patient.waitingTimeTriageLevel === undefined ||
                    Number(patient.waitingTimeTriageLevel) === Number(prediction);

                const isImmediate = String(patient.waitingTimeFormatted || '')
                    .trim()
                    .toLowerCase() === 'immediate';

                if (patient.waitingTimeFormatted && sameLevel && !(Number(prediction) > 1 && isImmediate)) {
                    waitingEl.textContent = patient.waitingTimeFormatted;
                    return;
                }
            }
        }
    } catch (error) {
        console.warn('Could not read stored waiting time from Firestore:', error);
    }

    // 3) Backward-compatibility for older patient records: calculate ONCE, then persist.
    try {
        if (!currentPatientId) throw new Error('Missing patientId');

        const response = await fetch('http://localhost:3000/api/calculate-waiting-time', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                triageLevel: prediction,
                doctorsAvailable: 2,
                excludePatientId: currentPatientId
            })
        });

        if (!response.ok) throw new Error('Waiting time API failed');
        const data = await response.json();

        var computed = data;

        // If backend can't read Firestore, it will return patientsAhead=0 for everyone.
        // In that case, fall back to computing from Firestore via the client SDK.
        if (Number(prediction) > 1 && Number(data.patientsAhead) === 0) {
            try {
                computed = await calculateWaitingTimeFromFirestore(prediction, 2, currentPatientId);
            } catch (fallbackError) {
                console.warn('Waiting time Firestore fallback failed:', fallbackError);
                computed = data;
            }
        }

        const formatted = computed.waitingTimeFormatted || data.waitingTimeFormatted || '–';
        waitingEl.textContent = formatted;

        const payload = {
            waitingTimeTriageLevel: Number(prediction),
            waitingTimeMinutes: computed.waitingTimeMinutes,
            waitingTimeFormatted: formatted,
            waitingTimeCalculatedAt: new Date().toISOString(),
            waitingTimeDoctorsAvailable: 2,
            waitingTimePatientsAhead: computed.patientsAhead,
            waitingTimeDetails: computed.details || data.details || null
        };

        await db.collection('patients').doc(currentPatientId).update(payload);
        sessionStorage.setItem('waitingTime', JSON.stringify(payload));
    } catch (error) {
        console.error('Error calculating/saving waiting time:', error);
        const defaultTimes = {
            1: "Immediate",
            2: "< 10 minutes",
            3: "20-30 minutes",
            4: "30-60 minutes",
            5: "60+ minutes"
        };
        waitingEl.textContent = defaultTimes[prediction] || "--";
    }
}

// ================================
// UPDATE UI
// ================================
document.getElementById("ctasLevel").textContent =
isNaN(prediction) ? "--" : prediction;

document.getElementById("ctasDescription").textContent =
ctasDescriptions[prediction] || "Unknown classification";

// Set waiting time to "Calculating..." initially
document.getElementById("waitingTime").textContent = "Calculating...";

// Calculate and display waiting time
calculateAndDisplayWaitingTime();

// ================================
// CARD STYLE
// ================================
var ctasCard = document.getElementById("ctasCard");
ctasCard.className = "ctas-card ctas-" + prediction;

// ================================
// CONFIDENCE
// ================================
var confidence = null;

if (triageResult.prediction && triageResult.prediction.confidence !== undefined) {
confidence = triageResult.prediction.confidence;
} else if (triageResult.confidence !== undefined) {
confidence = triageResult.confidence;
}

if (confidence !== null && confidence !== undefined) {
document.getElementById("confidenceValue").textContent =
(Number(confidence) * 100).toFixed(1) + "%";

document.getElementById("confidenceBox").style.display = "block";
}

// ================================
// 🔥 SHOW BUTTON (FIXED 100%)
// ================================
// Create Monitoring Button dynamically
var actionsDiv = document.querySelector(".actions");
console.log("Actions Div found:", actionsDiv);

if (actionsDiv && !startMonitoringBtn) {
startMonitoringBtn = document.createElement("button");
startMonitoringBtn.id = "startMonitoringBtn";
startMonitoringBtn.className = "btn primary";
startMonitoringBtn.textContent = "Start IoT Monitoring";
startMonitoringBtn.style.display = "none"; // Hidden by default
actionsDiv.appendChild(startMonitoringBtn);
console.log("✅ BUTTON CREATED AND APPENDED");
}

var btn = startMonitoringBtn;

console.log("BUTTON ELEMENT:", btn);
console.log("AI CTAS FINAL (prediction):", prediction);
console.log("CTAS TYPE:", typeof prediction);

// Convert prediction to number for comparison
var predictionNum = Number(prediction);
console.log("Prediction as Number:", predictionNum);

// SHOW FOR CTAS 2 AND 3 ONLY
if (btn && (predictionNum === 2 || predictionNum === 3)) {
btn.style.display = "block";
console.log("✅ MONITORING BUTTON VISIBLE for CTAS level:", predictionNum);
} else if (btn) {
btn.style.display = "none";
console.log("MONITORING BUTTON HIDDEN - CTAS level:", predictionNum);
}

// ================================
// START MONITORING
// ================================
if (btn) {
btn.addEventListener("click", async function () {

// Check if device is already connected to another patient
var deviceUserId = "cGcoHXzRoocdqjltwr3PQWwYA6C3";
var realtimeDb = firebase.database();

console.log("🔍 Checking device availability...");
console.log("Current Patient ID:", currentPatientId);

try {
// Get the current linked patient from Realtime DB
const snapshot = await realtimeDb.ref("UsersData/" + deviceUserId + "/linkedPatientId").once("value");
const linkedPatientId = snapshot.val();

console.log("📱 Device linkedPatientId:", linkedPatientId);
console.log("Current Patient ID:", currentPatientId);

// If device is linked to a DIFFERENT patient, block monitoring
if (linkedPatientId && linkedPatientId !== currentPatientId) {
console.log("⚠️ Device in use by another patient!");
alert("⚠️ No available device! Device is currently connected to another patient. Please wait or try again later.");
btn.disabled = false;
return; // Exit completely
}

// Device is available or already linked to this patient - proceed with monitoring
console.log("✅ Device is available!");

// Prepare data to save - merge patient data with monitoring info
var deviceInfo = {
deviceId: "D1",
deviceType: "Vital Signs Monitor",
status: "active",
connectedAt: new Date().toISOString()
};

if (currentPatientId) {
deviceInfo.connectedPatientId = currentPatientId;
}

var monitoringData = Object.assign({}, patientData, {
monitoring: true,
deviceInfo: deviceInfo,
monitoringStartedAt: new Date().toISOString(),
finalCTAS: prediction,
status: "waiting",
updatedAt: new Date().toISOString()
});

// Save to Firestore
if (!currentPatientId) {
alert("❌ Error: Patient ID not found. Please register the patient first.");
return;
}

await db.collection("patients")
.doc(currentPatientId)
.set(monitoringData, { merge: true });

// Link device to this patient in Realtime Database
await realtimeDb.ref("UsersData/" + deviceUserId + "/linkedPatientId").set(currentPatientId);

btn.innerText = "Monitoring Started";
btn.disabled = true;

alert("✅ IoT Monitoring Started");

} catch (error) {
console.error("❌ Error:", error);
alert("❌ Failed to start monitoring");
btn.disabled = false;
}

});
}

// ================================
// CONFIRM RESULT BUTTON
// ================================
var confirmBtn = document.getElementById("confirmBtn");
if (confirmBtn) {
    confirmBtn.addEventListener("click", function() {
        try {
            var rawPhone = (patientData && patientData.personalInfo && patientData.personalInfo.phoneNumber)
                ? patientData.personalInfo.phoneNumber
                : null;

            // Prefer stored URL if present (built during registration)
            var storedUrl = null;
            try { storedUrl = sessionStorage.getItem('whatsappUrl'); } catch (_) { storedUrl = null; }

            var url = storedUrl;
            if (!url) {
                var wt = getWaitingTimeForMessage();
                var msg = buildWhatsAppMessage({
                    patientName: (patientData && patientData.personalInfo && patientData.personalInfo.name) ? patientData.personalInfo.name : '',
                    waitingTimeMinutes: wt ? wt.minutes : null,
                    waitingTimeFormatted: wt ? wt.formatted : null
                });
                url = buildWhatsAppUrl(rawPhone, msg);
            }

            if (!url) {
                // If no valid WhatsApp target, fall back to dashboard.
                window.location.href = "patient-list.html";
                return;
            }

            // Open WhatsApp in a new tab/window, then redirect this tab to ED Patient Board.
            try {
                var waWin = window.open(url, '_blank', 'noopener,noreferrer');
                try {
                    if (waWin && typeof waWin.focus === 'function') waWin.focus();
                } catch (_) {
                    // ignore
                }
            } catch (_) {
                // ignore (popup blocker, etc.)
            }

            // Small delay helps some browsers avoid opening a blank about:blank tab.
            window.setTimeout(function () {
                window.location.href = 'patient-list.html';
            }, 150);
        } catch (e) {
            console.warn('Confirm -> WhatsApp failed:', e);
            window.location.href = "patient-list.html";
        }
    });
}

} catch (error) {
console.error("Error parsing data:", error);
document.querySelector(".ctas-desc").textContent = "Error displaying results";
}

});