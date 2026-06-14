export interface FanTelemetry {
  timestamp: string; // ISO String
  temp: number;      // °C
  speed: number;     // 0-100%
}

export type ControlMode = 'manual' | 'auto';

export interface FanState {
  speed: number;        // Target speed in manual mode (0-100)
  mode: ControlMode;   // 'manual' or 'auto'
  targetTemp: number;   // °C limit for auto mode (e.g., 50°C)
  currentTemp: number;  // Last reported temperature
  currentSpeed: number; // Last reported actual speed
  hostname: string;     // Pi's hostname
  lastSeen: string | null; // ISO String
  history: FanTelemetry[];
  daemonLogs: string[];
}

export interface ControlUpdateRequest {
  speed?: number;
  mode?: ControlMode;
  targetTemp?: number;
}
