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
        updateValveStatus(data.control.current_valve_state);
    }
});

/**
 * Opens the irrigation valve for 5 seconds via Firebase.
 * After the time expires, the valve is automatically closed again.
 * @function toggleValve
 * @global
 * @returns {void}
 */
window.toggleValve = function() {
    const valveRef = ref(db, 'system/control/target_valve_state');
    console.log("Opening valve via Firebase...");
    set(valveRef, true);
    setTimeout(() => {
        set(valveRef, false);
        console.log("Closing valve...");
    }, 5000); 
};

/**
 * Updates the current time display every second.
 */
function updateTime() {
    const timeEl = document.getElementById('current-time');
    if (timeEl) {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        timeEl.textContent = `${hours}:${minutes}:${seconds}`;
    }
}

updateTime();
setInterval(updateTime, 1000);

/**
 * Initializes all LED indicators on page load.
 * Sets default states for connection and status LEDs.
 */
function initializeLEDs() {
    document.getElementById('led-lte')?.classList.add('led-green');
    document.getElementById('led-lora')?.classList.add('led-red');
    document.getElementById('led-connection')?.classList.add('led-green');
    document.getElementById('led-program')?.classList.add('led-red');
}

initializeLEDs();

/**
 * Updates the moisture level for a specific sector.
 * Changes bar color to red if moisture is below 40%.
 * @param {number} sectorNumber - The sector number (1-6).
 * @param {number} moistureLevel - The moisture percentage (0-100).
 */
function updateSectorMoisture(sectorNumber, moistureLevel) {
    const bar = document.getElementById(`moisture-bar-${sectorNumber}`);
    const value = document.getElementById(`moisture-value-${sectorNumber}`);
    
    if (bar && value) {
        bar.style.width = `${moistureLevel}%`;
        bar.setAttribute('data-moisture', moistureLevel);
        
        if (moistureLevel < 40) {
            bar.setAttribute('data-moisture-level', 'low');
        } else {
            bar.setAttribute('data-moisture-level', 'normal');
        }
        
        value.textContent = `${moistureLevel}%`;
    }
}

function initializeSectorMoisture() {
    for (let i = 1; i <= 6; i++) {
        updateSectorMoisture(i, 87);
    }
}

initializeSectorMoisture();