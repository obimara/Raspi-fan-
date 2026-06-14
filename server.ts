import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { FanState, FanTelemetry } from "./src/types";

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory state
let state: FanState = {
  speed: 45,
  mode: "auto",
  targetTemp: 55,
  currentTemp: 42.5,
  currentSpeed: 45,
  hostname: "raspberrypi-trixie",
  lastSeen: null,
  history: [],
  daemonLogs: ["System initialized. Waiting for Raspberry Pi daemon client..."]
};

// Generate some initial mock history to make the UI look alive out of the box
function generateMockHistory() {
  const now = new Date();
  const history: FanTelemetry[] = [];
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 5000);
    // Sine wave temperature pattern between 40 and 58 degrees
    const factor = Math.sin((now.getTime() - i * 5000) / 60000);
    const temp = 48.0 + factor * 8.0 + (Math.random() - 0.5) * 1.5;
    // Speed maps roughly to temp in auto mode
    const speed = temp > 55 ? Math.min(100, 45 + (temp - 55) * 6) : 35 + (temp - 40) * 1.5;
    history.push({
      timestamp: time.toISOString(),
      temp: parseFloat(temp.toFixed(1)),
      speed: Math.round(speed)
    });
  }
  return history;
}

state.history = generateMockHistory();

// Helper to regularly append simulated ticks in memory if Pi is not connected,
// so the dashboard lives and breathes during review!
setInterval(() => {
  // Only inject simulated telemetry if NO real Pi daemon is currently reporting (last seen > 15s ago, or never)
  const isRealPiOffline = !state.lastSeen || (Date.now() - new Date(state.lastSeen).getTime() > 15000);
  
  if (isRealPiOffline) {
    const now = new Date();
    const factor = Math.sin(now.getTime() / 60000);
    
    // Auto speed calculator simulation
    let simTemp = state.currentTemp;
    let targetSpeed = state.speed;

    if (state.mode === "auto") {
      // Simulate fluctuation
      simTemp = 48.0 + factor * 7.0 + (Math.random() - 0.5) * 0.8;
      // Fan speed adjustments
      if (simTemp <= state.targetTemp - 10) {
        targetSpeed = 15;
      } else if (simTemp >= state.targetTemp + 15) {
        targetSpeed = 100;
      } else {
        const span = 25; // range
        const pct = (simTemp - (state.targetTemp - 10)) / span;
        targetSpeed = Math.round(15 + pct * 85);
      }
    } else {
      // Manual heating based on fan speed
      // High fan speed lowers temp, low fan speed lets it heat up
      const equilibrium = 65.0 - (state.speed * 0.3);
      simTemp = simTemp + (equilibrium - simTemp) * 0.1 + (Math.random() - 0.5) * 0.4;
      targetSpeed = state.speed;
    }

    state.currentTemp = parseFloat(simTemp.toFixed(1));
    state.currentSpeed = targetSpeed;
    
    state.history.push({
      timestamp: now.toISOString(),
      temp: state.currentTemp,
      speed: state.currentSpeed
    });
    
    // Keep last 40 entries
    if (state.history.length > 40) {
      state.history.shift();
    }
  }
}, 5000);

// API Endpoints
app.get("/api/fan/state", (req, res) => {
  // Check online Status
  const isOnline = state.lastSeen ? (Date.now() - new Date(state.lastSeen).getTime() < 12000) : false;
  res.json({
    ...state,
    isOnline
  });
});

app.post("/api/fan/control", (req, res) => {
  const { speed, mode, targetTemp } = req.body;
  
  let changed = [];
  if (speed !== undefined && speed >= 0 && speed <= 100) {
    state.speed = speed;
    changed.push(`Speed set to ${speed}%`);
  }
  if (mode !== undefined && (mode === "manual" || mode === "auto")) {
    state.mode = mode;
    changed.push(`Mode changed to ${mode}`);
  }
  if (targetTemp !== undefined && targetTemp >= 30 && targetTemp <= 90) {
    state.targetTemp = targetTemp;
    changed.push(`Target Temp set to ${targetTemp}°C`);
  }

  if (changed.length > 0) {
    const timestamp = new Date().toLocaleTimeString();
    state.daemonLogs.unshift(`[${timestamp}] Control configuration updated: ${changed.join(", ")}`);
    if (state.daemonLogs.length > 150) {
      state.daemonLogs.pop();
    }
  }

  res.json({ success: true, state });
});

// Reporter endpoint for Raspberry Pi daemon
app.post("/api/fan/report", (req, res) => {
  const { temp, speed, hostname, logs } = req.body;
  const now = new Date();
  
  state.lastSeen = now.toISOString();
  
  if (temp !== undefined) {
    state.currentTemp = parseFloat(temp.toFixed(1));
  }
  if (speed !== undefined) {
    state.currentSpeed = Math.round(speed);
  }
  if (hostname) {
    state.hostname = hostname;
  }
  
  // Append telemetry tracking
  state.history.push({
    timestamp: now.toISOString(),
    temp: state.currentTemp,
    speed: state.currentSpeed
  });
  
  if (state.history.length > 40) {
    state.history.shift();
  }

  if (logs && Array.isArray(logs)) {
    logs.forEach(log => {
      state.daemonLogs.unshift(`[${now.toLocaleTimeString()}] PI: ${log}`);
    });
    if (state.daemonLogs.length > 150) {
      state.daemonLogs.slice(0, 150);
    }
  }

  // Server sends instructions back on how the daemon should behave
  res.json({
    mode: state.mode,
    speed: state.speed, // target custom manual speed set by web UI
    targetTemp: state.targetTemp // target temperature limit for autocurve
  });
});

// Dynamically generated Python Daemon script
app.get("/api/daemon_script", (req, res) => {
  const hostUrl = process.env.APP_URL || `http://localhost:${PORT}`;
  
  const pythonScript = `#!/usr/bin/env python3
import sys
import os
import time
import json
import urllib.request
import urllib.error
import random
import socket

# Configuration
SERVER_URL = "${hostUrl}"
REPORT_INTERVAL = 3.0  # seconds
PIN_PWM_FAN = 18       # Default BCM GPIO 18 (Pin 12) on Raspberry Pi

# Try to look up CPU thermal readings
THERMAL_ZONE_PATH = "/sys/class/thermal/thermal_zone0/temp"

# Initialize hardware fan if gpiozero is present
HAS_GPIO = False
fan_pwm = None

print("=============================================")
print("  Raspberry Pi Remote Fan Controller Daemon")
print("=============================================")
print(f"Connecting to Server: {SERVER_URL}")

try:
    from gpiozero import PWMOutputDevice
    # Initialise fan on physical pin (GPIO 18)
    # frequency=25000Hz (25kHz) is standard for many PC PWM fans
    fan_pwm = PWMOutputDevice(PIN_PWM_FAN, active_high=True, frequency=25000)
    HAS_GPIO = True
    print(f"-> Physical Pi PWM control initialized on BCM GPIO {PIN_PWM_FAN}")
except Exception as e:
    print(f"-> Running in emulation/software logs mode. Hardware PWM unavailable: {e}")
    print("-> (You can run this daemon on any Linux system or PC for simulation testing!)")

hostname = socket.gethostname()

def read_cpu_temp():
    """Reads Linux sysfs cpu temperature in Celsius, falls back to simulated value."""
    if os.path.exists(THERMAL_ZONE_PATH):
        try:
            with open(THERMAL_ZONE_PATH, "r") as f:
                temp_milli = float(f.read().strip())
                return temp_milli / 1000.0
        except Exception as e:
            pass
    # Simulation fallback if non-Pi/non-Linux or reading failed
    # Mimics dynamic heat curve based on speed fader
    global current_sim_temp, actual_speed_pct
    equilibrium = 65.0 - (actual_speed_pct * 0.28)
    current_sim_temp += (equilibrium - current_sim_temp) * 0.08 + random.uniform(-0.5, 0.5)
    return current_sim_temp

# Local simulation initial states
current_sim_temp = 44.2
actual_speed_pct = 45.0

def set_hardware_fan_speed(percentage):
    """Sets the physical PWM duty cycle (0.0 to 1.0) on GPIO."""
    global actual_speed_pct
    actual_speed_pct = percentage
    if HAS_GPIO and fan_pwm:
        try:
            # PWMOutputDevice value receives speed factor 0.0 to 1.0
            fan_pwm.value = percentage / 100.0
        except Exception as e:
            print(f"Error adjusting physical fan duty cycle: {e}")

try:
    while True:
        # 1. Fetch current CPU temperature
        temp = read_cpu_temp()
        
        # 2. Build status report
        payload = {
            "temp": temp,
            "speed": actual_speed_pct,
            "hostname": hostname,
            "logs": []
        }
        
        # 3. Post telemetry & receive fan controller curve settings
        req_headers = {"Content-Type": "application/json"}
        req_data = json.dumps(payload).encode("utf-8")
        
        try:
            req = urllib.request.Request(
                f"{SERVER_URL}/api/fan/report", 
                data=req_data, 
                headers=req_headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                
                server_mode = res_data.get("mode", "auto")
                server_speed = res_data.get("speed", 45)
                target_temp = res_data.get("targetTemp", 55)
                
                # 4. Process Fan Speed Curve calculations
                if server_mode == "manual":
                    # Directly honors the manual speed mixer slider (0-100)
                    target_pct = float(server_speed)
                else:
                    # 'auto' calculation: Automatic thermal control curve
                    # - Below target_temp - 10: fan runs at quiet idling speed (e.g. 15%)
                    # - Above target_temp + 15: fan runs at full 100% to protect silicon
                    # - Linear scaling inside the range (target_temp - 10 to target_temp + 15)
                    min_t = target_temp - 10
                    max_t = target_temp + 15
                    if temp <= min_t:
                        target_pct = 15.0
                    elif temp >= max_t:
                        target_pct = 100.0
                    else:
                        pct = (temp - min_t) / (max_t - min_t)
                        target_pct = 15.0 + (pct * 85.0)
                
                # Apply computed fader target to Pi fan
                target_pct = max(0.0, min(100.0, target_pct))
                set_hardware_fan_speed(round(target_pct))
                
                print(f"[STATUS] CPU Temp: {temp:.1f}°C | Fan Speed: {actual_speed_pct}% | Mode: {server_mode}", end="\\r")
                sys.stdout.flush()
                
        except urllib.error.URLError as e:
            print(f"\\n[CONNECTION WARN] Server endpoint unreachable: {e.reason}")
        except Exception as e:
            print(f"\\n[ERROR] Daemon iteration failed: {e}")
            
        time.sleep(REPORT_INTERVAL)

except KeyboardInterrupt:
    print("\\nExiting remote fan daemon controller. Setting fan to 100% for safety.")
    set_hardware_fan_speed(100.0)
    sys.exit(0)
`;
  
  res.setHeader("Content-Type", "text/plain");
  res.send(pythonScript);
});

async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Remote Fan Server listening on port ${PORT}`);
  });
}

startServer();
