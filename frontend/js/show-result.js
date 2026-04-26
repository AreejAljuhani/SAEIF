document.addEventListener("DOMContentLoaded", function () {

var db = firebase.firestore();

var startMonitoringBtn = null; // Will be created dynamically

var currentPatientId = null;

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

var waitingTimes = {
1: "Immediate",
2: "<10 minutes",
3: "30 minutes",
4: "1-2 hours",
5: "2 hours"
};

// ================================
// UPDATE UI
// ================================
document.getElementById("ctasLevel").textContent =
isNaN(prediction) ? "--" : prediction;

document.getElementById("ctasDescription").textContent =
ctasDescriptions[prediction] || "Unknown classification";

document.getElementById("waitingTime").textContent =
waitingTimes[prediction] || "--";

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
status: "monitoring",
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
        // Navigate to patient list page
        window.location.href = "patient-list.html";
    });
}

} catch (error) {
console.error("Error parsing data:", error);
document.querySelector(".ctas-desc").textContent = "Error displaying results";
}

});