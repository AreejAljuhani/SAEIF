const monitorGrid = document.getElementById("monitorGrid");

console.log("✅ monitorGrid element found:", monitorGrid);

let alertsCount = 0;

db.collection("patients")
.where("monitoring","==",true)
.onSnapshot(snapshot=>{

console.log("📊 Query result - Found monitored patients:", snapshot.size);

monitorGrid.innerHTML="";
alertsCount = 0;

snapshot.forEach(doc=>{

const patient = doc.data();
const patientId = doc.id;

console.log("👤 Patient:", patient.name, "ID:", patientId);

createPatientCard(patientId,patient);

});

}, error => {
console.error("❌ Firebase error:", error);
});



function createPatientCard(id,patient){

const card = document.createElement("div");
card.className="monitor-card";

const deviceId = patient.deviceInfo?.deviceId || "D1";
const deviceType = patient.deviceInfo?.deviceType || "Monitor";
const ctasLevel = patient.finalCTAS || patient.aiCTAS || "--";
const patientName = patient.name || "Unknown Patient";
const patientAge = patient.age || "--";
const patientGender = patient.sex === "1" ? "Female" : patient.sex === "2" ? "Male" : "--";

card.innerHTML=`

<div class="monitor-header">
<div>
<strong>${patientName}</strong><br>
Age: ${patientAge} | Gender: ${patientGender}<br>
CTAS ${ctasLevel}
</div>

<div class="device-badge">
<i class="fas fa-watch"></i> ${deviceId}
</div>
</div>

<div class="vitals">

<div class="vital-box">
<div>HR</div>
<div class="vital-value" id="hr-${id}">${patient.vitalSigns?.hr || "--"}</div>
</div>

<div class="vital-box">
<div>SpO2</div>
<div class="vital-value" id="spo2-${id}">${patient.vitalSigns?.saturation || "--"}</div>
</div>

<div class="vital-box">
<div>Temp</div>
<div class="vital-value" id="temp-${id}">${patient.vitalSigns?.bt || "--"}</div>
</div>

</div>

<div id="status-${id}" class="status-live">
LIVE
</div>

<div id="alert-${id}" class="alert-box"></div>

<button class="disconnect-btn" onclick="disconnectMonitoring('${id}', '${patientName}')">
<i class="fas fa-power-off"></i> Disconnect
</button>

`;

monitorGrid.appendChild(card);

listenToDevice(id);

}

function disconnectMonitoring(patientId, patientName) {

if (confirm("Are you sure you want to disconnect " + patientName + "?")) {

var deviceUserId = "cGcoHXzRoocdqjltwr3PQWwYA6C3";
var realtimeDb = firebase.database();

// Remove linkedPatientId from device
realtimeDb.ref("UsersData/" + deviceUserId + "/linkedPatientId").remove();

// Update patient status to "waiting" and turn off monitoring
db.collection("patients")
.doc(patientId)
.set({
monitoring: false,
status: "waiting",
monitoringEndedAt: new Date().toISOString(),
updatedAt: new Date().toISOString()
}, { merge: true })
.then(() => {
alert("✅ " + patientName + " disconnected from device");
console.log("Patient disconnected and device is now available");
})
.catch(error => {
console.error("Error disconnecting:", error);
alert("❌ Failed to disconnect");
});
}
}



function listenToDevice(patientId){

const deviceUserId = "cGcoHXzRoocdqjltwr3PQWwYA6C3";
const realtimeDb = firebase.database();

let lastUpdate = Date.now();

// Listen to the device vitals in Realtime Database
realtimeDb.ref("UsersData/" + deviceUserId + "/vitals").on("value", snapshot => {

const data = snapshot.val();

console.log("📊 Device data received:", data);

// Update vitals display
if (document.getElementById(`hr-${patientId}`)) {
document.getElementById(`hr-${patientId}`).innerText = data?.heartRate || "--";
document.getElementById(`spo2-${patientId}`).innerText = data?.spo2 || "--";
document.getElementById(`temp-${patientId}`).innerText = data?.temperature || "--";
}

lastUpdate = Date.now();

checkAlerts(patientId, data);

}, error => {
console.error("❌ Error listening to device:", error);
});

setInterval(()=>{

if(Date.now() - lastUpdate > 30000){

const status = document.getElementById(`status-${patientId}`);

status.innerText="DISCONNECTED";
status.className="status-off";

}

},5000);

}



function checkAlerts(id,data){

let alertHTML="";

if(data.heartRate > 120)
alertHTML += "⚠ High Heart Rate<br>";

if(data.spo2 < 92)
alertHTML += "⚠ Low Oxygen<br>";

if(data.temperature > 38)
alertHTML += "⚠ High Temperature<br>";

if(alertHTML !== "")
alertHTML += "⚠ Patient deterioration detected";

document.getElementById(`alert-${id}`).innerHTML = alertHTML;

}