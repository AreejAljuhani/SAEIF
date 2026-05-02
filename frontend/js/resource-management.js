document.addEventListener("DOMContentLoaded", () => {

    const db = firebase.firestore();

    function loadResources() {
        db.collection("settings").doc("resources").get().then(doc => {

            if (doc.exists) {
                const data = doc.data();

                document.getElementById("doctorsInput").value = data.doctorsAvailable || 0;
                document.getElementById("nursesInput").value  = data.nursesAvailable  || 0;
                document.getElementById("bedsInput").value    = data.bedsAvailable    || 0;
                document.getElementById("holidayInput").value = data.isHoliday        || 0;

                document.getElementById("doctorsCount").innerText = data.doctorsAvailable || 0;
                document.getElementById("nursesCount").innerText  = data.nursesAvailable  || 0;
                document.getElementById("bedsCount").innerText    = data.bedsAvailable    || 0;
            }

        }).catch(err => console.log(err));
    }

    db.collection("settings").doc("resources")
    .onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();

            document.getElementById("doctorsCount").innerText = data.doctorsAvailable || 0;
            document.getElementById("nursesCount").innerText  = data.nursesAvailable  || 0;
            document.getElementById("bedsCount").innerText = data.bedsAvailable || 0;
        }
    });

    window.updateDoctors = function () {
        let val = parseInt(document.getElementById("doctorsInput").value || 0);

        db.collection("settings").doc("resources").set({
            doctorsAvailable: val
        }, { merge: true });
    }

    window.updateNurses = function () {
    let val = parseInt(document.getElementById("nursesInput").value || 0);
    db.collection("settings").doc("resources").set({ nursesAvailable: val }, { merge: true });
    }

    window.updateBeds = function () {
        let val = parseInt(document.getElementById("bedsInput").value || 0);

        db.collection("settings").doc("resources").set({
            bedsAvailable: val
        }, { merge: true });
    }

    window.updateHoliday = function () {
    let val = parseInt(document.getElementById("holidayInput").value || 0);
    db.collection("settings").doc("resources").set({ isHoliday: val }, { merge: true });
  }

    loadResources();

});