import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  onValue,
  update,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";
import firebaseConfig from "/config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const loginBtn = document.getElementById("loginBtn");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginFeedback = document.getElementById("errorMessage");
const logoutBtn = document.getElementById("logoutBtn");

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("loginArea").style.display = "none";
    document.getElementById("contentArea").style.display = "flex";
    loadData();
  } else {
    document.getElementById("loginArea").style.display = "flex";
    document.getElementById("contentArea").style.display = "none";
  }
});

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  if (!email || !password) {
    loginFeedback.textContent = "Please enter both email and password.";
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    loginFeedback.textContent = getLoginErrorMessage(error.code);
  }
});

/**
 * Maps Firebase auth error codes to user-friendly messages.
 * @param {string} errorCode - Firebase auth error code.
 * @returns {string} The message to display in the login UI.
 */
function getLoginErrorMessage(errorCode) {
  if (errorCode === "auth/user-not-found") return "User not found.";
  if (errorCode === "auth/wrong-password") return "Incorrect password.";
  if (errorCode === "auth/invalid-email") return "Invalid email address.";
  return "An error occurred.";
}
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    auth.signOut();
  });
}

/**
 * Starts all realtime data monitors after a successful login.
 */
function loadData() {
    startMoistureMonitoring();
    startConnectionLedMonitoring();
    startFeedbackMonitoring();
    updateTime();
}

/**
 * Updates the current time display every second.
 * Formats the time as HH:MM:SS in 24h format.
 */
function updateTime() {
  const elDashboard = document.getElementById("current-time-dashboard");
  const elLogin = document.getElementById("current-time-login");
  if (!elDashboard && !elLogin) return;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  if (elDashboard) elDashboard.textContent = time;
  if (elLogin) elLogin.textContent = time;
}

/**
 * Initializes all LED indicators on page load.
 * Sets default states for LTE and LoRa status LEDs.
 */
function initializeLEDs() {
  document.getElementById("led-lte")?.classList.add("led-green");
  document.getElementById("led-lora")?.classList.add("led-red");
}

/**
 * Updates the moisture level for a specific sector.
 * @param {number} sectorNumber - The sector number (1-6).
 * @param {number} moistureLevel - The moisture percentage (0-100).
 */
function updateSectorMoisture(sectorNumber, moistureLevel) {
  const bar = document.getElementById(`moisture-bar-${sectorNumber}`);
  const val = document.getElementById(`moisture-value-${sectorNumber}`);
  if (!bar || !val) return;
  bar.style.width = `${moistureLevel}%`;
  bar.setAttribute(
    "data-moisture-level",
    moistureLevel < 40 ? "low" : moistureLevel < 65 ? "medium" : "high",
  );
  val.textContent = `${moistureLevel}%`;
}

/**
 * Monitors moisture data from Firebase in real-time.
 * Maps sensor keys to UI sector indices.
 */
function startMoistureMonitoring() {
  const sectorsRef = ref(db, "system/status/sectors");
  onValue(sectorsRef, (snapshot) => {
    const data = snapshot.val();
    const map = { s1: 1, s2: 2, s3: 3, s4: 4, s5: 5, s6: 6 };
    if (!data) return;
    Object.entries(map).forEach(([key, idx]) => {
      const m = data[key]?.m;
      if (typeof m === "number") updateSectorMoisture(idx, Math.round(m));
    });
  });
}

/**
 * Updates the connection status LED based on the last seen timestamp.
 * @param {HTMLElement} led - The LED DOM element.
 * @param {string} lastSeen - ISO timestamp of the last heart-beat.
 */
function updateLedStatus(led, lastSeen) {
  if (!lastSeen) return;
  led.dataset.lastSeen = lastSeen;
  const diff = (Date.now() - new Date(lastSeen).getTime()) / 1000;
  const isOnline = diff <= 1020;
  led.classList.toggle("led-green", isOnline);
  led.classList.toggle("led-red", !isOnline);
}

/**
 * Updates the program status LED based on system activity.
 * @param {HTMLElement} led - The LED DOM element.
 * @param {boolean} status - Current running state of the program.
 */
function updateLedProgramStatus(led, status) {
  const isActive = status === true;
  led.dataset.programStatus = status;
  led.classList.toggle("led-green", isActive);
  led.classList.toggle("led-red", !isActive);
}

/**
 * Starts monitoring connection and program status.
 * Updates the connection LED every 2 seconds.
 */
function startConnectionLedMonitoring() {
  initializeLEDs();
  const lConn = document.getElementById("led-connection");
  const lProg = document.getElementById("led-program");
  if (!lConn || !lProg) return;
  onValue(ref(db, "system/connection/last_seen"), (s) =>
    updateLedStatus(lConn, s.val()),
  );
  onValue(ref(db, "system/control/current_state"), (s) =>
    updateLedProgramStatus(lProg, s.val()),
  );
  setInterval(() => updateLedStatus(lConn, lConn.dataset.lastSeen), 2000);
}

/**
 * Triggers the irrigation program based on selected mode.
 * Writes configuration and target state to Firebase.
 */
function startProgram() {
  const mode = document.getElementById("program-select")?.value;
  const getV = (id) => Number(document.getElementById(id)?.value);
  let up = { "system/control/target_state": true };
  if (mode === "manually") {
    Object.assign(up, {
      "system/settings/program_type": "manually",
      "system/settings/manual_runtime_minutes": getV("duration"),
    });
  } else if (mode === "automatically") {
    Object.assign(up, {
      "system/settings/program_type": "automatic",
      "system/settings/thresholds/off_moisture": getV("trigger-turn-off"),
      "system/settings/thresholds/on_moisture": getV("trigger-turn-on"),
    });
  }
  if (mode) update(ref(db), up).catch(console.error);
}

/**
 * Disables all running programs immediately.
 * Sets the target state to false in the database.
 */
function stopAllPrograms() {
  update(ref(db), { "system/control/target_state": false }).catch(
    console.error,
  );
}

/**
 * Handles program selection changes and UI template injection.
 */
function selectProgramMode() {
  const sel = document.getElementById("program-select");
  const cont = document.getElementById("program-content");
  sel?.addEventListener("change", () => {
    if (sel.value === "manually") cont.innerHTML = programManuallyTemplate();
    else if (sel.value === "automatically")
      cont.innerHTML = programAutomaticTemplate();
    else cont.innerHTML = "";
  });
}

/**
 * Monitors and displays system feedback messages from Firebase.
 * Updates the text content of the feedback container.
 * @param {Object} feedback - The feedback object containing msg and error details.
 */
function startFeedbackMonitoring() {
  const feedbackRef = ref(db, "system/status");
  const container = document.getElementById("feedbackMessage");
  if (!container) return;

  onValue(feedbackRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    container.textContent = data.feedback_msg || data.error_msg;
    container.className = data.error_code !== 0 ? "error-text" : "success-text";
  });
}

// Global execution and window assignment
updateTime();
setInterval(updateTime, 1000);
selectProgramMode();
window.startProgram = startProgram;
window.stopAllPrograms = stopAllPrograms;
