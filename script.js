import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import firebaseConfig from '/config.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const moistureValEl = document.getElementById('moisture-val');
const moistureBarEl = document.getElementById('moisture-bar');
const valveStatusEl = document.getElementById('valve-status');

const systemRef = ref(db, 'system');

/**
 * Updates the moisture value display and progress bar.
 * Changes the bar color to red when moisture falls below 30%.
 * @param {number} moisture - The current moisture value in percent.
 */
function updateMoisture(moisture) {
    if (moistureValEl) moistureValEl.innerText = moisture;
    if (moistureBarEl) {
        moistureBarEl.style.width = `${moisture}%`;    
        if (moisture < 30) {
            moistureBarEl.classList.replace('bg-emerald-500', 'bg-red-500');
        } else {
            moistureBarEl.classList.replace('bg-red-500', 'bg-emerald-500');
        }
    }
}

/**
 * Updates the irrigation valve status in the UI.
 * Displays "OPEN (Irrigating)" in green or "Closed" in gray.
 * @param {boolean} isOpen - True if the valve is open, false otherwise.
 */
function updateValveStatus(isOpen) {
    if (!valveStatusEl) return;
    if (isOpen) {
        valveStatusEl.innerText = "OPEN (Irrigating)";
        valveStatusEl.classList.add('text-emerald-400');
        valveStatusEl.classList.remove('text-slate-200');
    } else {
        valveStatusEl.innerText = "Closed";
        valveStatusEl.classList.add('text-slate-200');
        valveStatusEl.classList.remove('text-emerald-400');
    }
}

/**
 * Monitors the 'system' reference in the Firebase Database in real-time.
 * Updates the UI (bar, percentage value, valve status) on every change.
 * @param {Object} snapshot - The current dataset from the Firebase Database.
 */
onValue(systemRef, (snapshot) => {
    const data = snapshot.val();    
    if (data) {
        updateMoisture(data.moisture);
        updateValveStatus(data.valve_open);
    }
});

/**
 * Opens the irrigation valve for 30 seconds via Firebase.
 * After the time expires, the valve is automatically closed again.
 * @function toggleValve
 * @global
 * @returns {void}
 */
window.toggleValve = function() {
    const valveRef = ref(db, 'system/valve_open');
    console.log("Opening valve via Firebase...");
    set(valveRef, true);
    setTimeout(() => {
        set(valveRef, false);
        console.log("Closing valve...");
    }, 30000); 
};