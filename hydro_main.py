import firebase_admin
from firebase_admin import credentials, db
import spidev
import time
import RPi.GPIO as GPIO
from datetime import datetime


def update_status(ref, code, msg, feedback):
    ref.update({"error_code": code, "error_msg": msg, "feedback_msg": feedback})


def get_moisture_data(spi_dev, channel, dry, wet):
    try:
        adc = spi_dev.xfer2([1, (8 + channel) << 4, 0])
        raw = ((adc[1] & 3) << 8) + adc[2]
        if not (wet - 50 <= raw <= dry + 50):
            return None, "Error"
        percent = max(0, min(100, round((raw - dry) / (wet - dry) * 100, 1)))
        return percent, "OK"
    except Exception:
        return None, "Fatal"


def set_watering_hardware(pump, valve, turn_on, on_val, off_val):
    print(f"{datetime.now()}: Hardware {'START' if turn_on else 'STOP'}")
    if turn_on:
        GPIO.output(valve, on_val)
        time.sleep(2)
        GPIO.output(pump, on_val)
    else:
        GPIO.output(pump, off_val)
        time.sleep(1)
        GPIO.output(valve, off_val)


# Global flag for instant remote triggering
remote_triggered = False


def signal_handler(event):
    global remote_triggered
    remote_triggered = True


RELAY_PUMP, RELAY_VALVE = 17, 18
DRY_VALUE, WET_VALUE = 684, 273
ON, OFF = GPIO.HIGH, GPIO.LOW

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(
    cred,
    {
        "databaseURL": "https://hydro-control-system-default-rtdb.europe-west1.firebasedatabase.app"
    },
)

ref_control = db.reference("system/control")
ref_settings = db.reference("system/settings")
ref_sectors = db.reference("system/status/sectors")
ref_conn = db.reference("system/connection")
ref_status = db.reference("system/status")

# Real-time listener to reduce data polling
ref_control.child("target_state").listen(signal_handler)

spi = spidev.SpiDev()
spi.open(0, 0)
spi.max_speed_hz = 1350000
GPIO.setwarnings(False)
GPIO.setmode(GPIO.BCM)
GPIO.setup([RELAY_PUMP, RELAY_VALVE], GPIO.OUT, initial=OFF)

manual_start_time = None

try:
    print("Garden Control Online...")
    current_feedback = "System is running stably"

    while True:
        remote_triggered = False
        valid_values, defective_sensors = [], []
        sensor_updates = {}

        for i in range(6):
            if i == 3:
                continue
            val, status = get_moisture_data(spi, i, DRY_VALUE, WET_VALUE)
            if status == "OK":
                sensor_updates[f"s{i + 1}"] = {"m": val}
                valid_values.append(val)
            else:
                sensor_updates[f"s{i + 1}"] = {"m": "Defective"}
                defective_sensors.append(f"S{i + 1}")

        # Batch update to minimize data usage
        ref_sectors.update(sensor_updates)

        error_code = 1 if defective_sensors else 0
        error_msg = (
            f"Check sensors: {', '.join(defective_sensors)}"
            if defective_sensors
            else ""
        )

        control = ref_control.get() or {}
        settings = ref_settings.get() or {}
        target_state = control.get("target_state", False)
        current_state = control.get("current_state", False)
        prog_type = settings.get("program_type", "manually")
        runtime_limit = settings.get("manual_runtime_minutes", 0)
        on_th = settings.get("thresholds", {}).get("on_moisture", 35)
        off_th = settings.get("thresholds", {}).get("off_moisture", 90)

        if target_state:
            if prog_type == "manually":
                current_feedback = "Manual watering active"
                if runtime_limit > 0:
                    if manual_start_time is None:
                        manual_start_time = datetime.now()
                    elapsed = (datetime.now() - manual_start_time).total_seconds() / 60
                    if elapsed >= runtime_limit:
                        ref_control.update({"target_state": False})
                        target_state, current_feedback = False, "Manual limit reached"

                if target_state and not current_state:
                    set_watering_hardware(RELAY_PUMP, RELAY_VALVE, True, ON, OFF)
                    ref_control.update({"current_state": True})

            elif prog_type == "automatic":
                manual_start_time = None
                if valid_values:
                    min_m, avg_m = (
                        min(valid_values),
                        sum(valid_values) / len(valid_values),
                    )
                    if min_m <= on_th and not current_state:
                        current_feedback = f"Auto-start (Min: {min_m}%)"
                        set_watering_hardware(RELAY_PUMP, RELAY_VALVE, True, ON, OFF)
                        ref_control.update({"current_state": True})
                    elif avg_m >= off_th and current_state:
                        current_feedback = f"Auto-stop (Avg: {avg_m}%)"
                        set_watering_hardware(RELAY_PUMP, RELAY_VALVE, False, ON, OFF)
                        ref_control.update({"current_state": False})
                    elif current_state:
                        current_feedback = f"Watering... (Avg: {avg_m}%)"
                else:
                    current_feedback = "Auto paused - No valid sensors"
        else:
            if current_state:
                set_watering_hardware(RELAY_PUMP, RELAY_VALVE, False, ON, OFF)
                ref_control.update({"current_state": False})
            current_feedback, manual_start_time = "System is running stably", None

        update_status(ref_status, error_code, error_msg, current_feedback)
        ref_conn.update(
            {
                "is_online": True,
                "last_seen": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            }
        )

        # Efficient wait loop: breaks immediately on remote interaction
        for _ in range(300):
            if remote_triggered:
                break
            time.sleep(1)

except KeyboardInterrupt:
    update_status(ref_status, 2, "System stopped by user", "Offline")
finally:
    GPIO.output(RELAY_PUMP, OFF)
    GPIO.output(RELAY_VALVE, OFF)
    GPIO.cleanup()
    spi.close()
