import firebase_admin
from firebase_admin import credentials
from firebase_admin import db
import spidev
import time
import RPi.GPIO as GPIO  # Neu: GPIO Import

# --- KONFIGURATION ---
VALVE_PIN = 17  # Dein GPIO Pin für das Relais

# 1. Firebase Initialisierung
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(
    cred,
    {
        "databaseURL": "https://hydro-control-system-default-rtdb.europe-west1.firebasedatabase.app"
    },
)
ref = db.reference("system")

# 2. Hardware Setup (SPI & GPIO)
# SPI für MCP3008
spi = spidev.SpiDev()
spi.open(0, 0)
spi.max_speed_hz = 1350000

# GPIO für Relais
GPIO.setmode(GPIO.BCM)
GPIO.setup(VALVE_PIN, GPIO.OUT)
GPIO.output(VALVE_PIN, GPIO.LOW)  # Startzustand: AUS


def read_moisture():
    DRY_VALUE = 684
    WET_VALUE = 273
    adc = spi.xfer2([1, (8 + 0) << 4, 0])
    data = ((adc[1] & 3) << 8) + adc[2]

    try:
        percent = (data - DRY_VALUE) / (WET_VALUE - DRY_VALUE) * 100
        percent = round(percent)
    except ZeroDivisionError:
        percent = 0
    return max(0, min(100, percent))


# 3. Listener für das Ventil (Hört auf target_valve_state)
def valve_listener(event):
    # event.data enthält den neuen Wert von target_valve_state
    target_state = event.data

    if target_state is True:
        print("🌊 DASHBOARD: Ventil wird GEÖFFNET!")
        GPIO.output(VALVE_PIN, GPIO.HIGH)
    else:
        print("🚫 DASHBOARD: Ventil wird GESCHLOSSEN!")
        GPIO.output(VALVE_PIN, GPIO.LOW)

    # Rückmeldung an die Cloud: Ist-Zustand aktualisieren
    ref.child("control").update({"current_valve_state": target_state})


# Wir hören jetzt auf den spezifischen Pfad in deiner DB
ref.child("control/target_valve_state").listen(valve_listener)

# 4. Hauptschleife
print("🚀 Hydro-System aktiv. Warte auf Befehle...")
try:
    while True:
        moisture = read_moisture()
        print(f"Feuchtigkeit: {moisture}%")

        # Nur Feuchtigkeit updaten (control Zweig bleibt unberührt)
        ref.update({"moisture": moisture})
        time.sleep(5)

except KeyboardInterrupt:
    print("System beendet.")
finally:
    spi.close()
    GPIO.cleanup()  # Wichtig: Setzt Pins zurück
