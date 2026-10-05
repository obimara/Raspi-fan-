# Raspi Fan

A small, Apple-inspired dashboard for Raspberry Pi fan telemetry and control.
Light surfaces, clear readings, and one place to adjust automatic or manual output.

## Run

Requires Node.js 20.19+ (or Node.js 22.12+).

```sh
npm ci
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`. Set `APP_URL` to the server address your Pi can reach
before downloading the Python client from **Setup**. No AI service or API key is needed.

```sh
npm run lint
npm run build
npm test
npm start
```

`npm start` serves the production build. `PORT` defaults to 3000.
The API integration test launches its own server on a free port.

## Controls and readings

- Automatic mode adjusts the client's PWM output around a temperature target.
- Manual mode requests a fixed output. Changes are sent only when **Apply changes** is pressed.
- Demo readings are labeled and stop permanently after the first client report.
- A disconnected client leaves its last readings visible with an offline status.
- Activity can be cleared on the server. Settings, logs and history are in memory
  and reset when the server restarts.

The supplied Python client uses GPIO 18 for an **external PWM fan**, not the Pi 5's
dedicated fan connector. GPIO initialization failure enters emulation mode, so
“Client connected” confirms telemetry reports, not physical fan control. Reported
output is the requested duty cycle, not a measured RPM. Physical hardware operation
has not been verified by the dashboard's software tests.

The original daemon's control algorithm is retained. It does not provide a verified
thermal fail-safe on network loss. Keep independent platform thermal protection in
place. This app has no authentication; use it only on a trusted network, not an
unprotected public endpoint.

## Structure

- `src/App.tsx`: navigation, settings and client setup
- `src/components/TelemetryChart.tsx`: accessible SVG telemetry chart
- `src/index.css`: responsive styles, system fonts, reduced-motion support
- `server.ts`: API, bounded in-memory telemetry and downloadable Python client
- `tests/api.test.mjs`: real HTTP validation and demo/device separation checks

The UI uses React and Lucide icons. It has no animation framework, CSS framework,
external images or AI SDK.
