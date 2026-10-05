import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  Check,
  Copy,
  Fan,
  Gauge,
  RefreshCw,
  Terminal,
  Wifi,
} from "lucide-react";
import { ControlUpdateRequest, FanState } from "./types";
import TelemetryChart from "./components/TelemetryChart";

type Snapshot = FanState & {
  isOnline: boolean;
  telemetrySource: "demo" | "device" | "stale";
};
type Page = "Overview" | "Activity" | "Setup";

export default function App() {
  const [state, setState] = useState<Snapshot | null>(null);
  const [page, setPage] = useState<Page>("Overview");
  const [draft, setDraft] = useState<ControlUpdateRequest>({});
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const saving = useRef(false);
  const requestVersion = useRef(0);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (saving.current) return;
    const version = ++requestVersion.current;
    try {
      const response = await fetch("/api/fan/state", { signal });
      if (!response.ok) throw new Error("Unable to reach the controller.");
      const data: Snapshot = await response.json();
      if (version === requestVersion.current) {
        setState(data);
        setConnectionError(false);
      }
    } catch (err) {
      if (!signal?.aborted && version === requestVersion.current)
        setConnectionError(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!document.hidden) await refresh(controller.signal);
      if (!controller.signal.aborted) timer = setTimeout(poll, 3000);
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      clearTimeout(copyTimer.current);
      ++requestVersion.current;
    };
  }, [refresh]);

  const settings = state
    ? {
        mode: state.mode,
        speed: state.speed,
        targetTemp: state.targetTemp,
        ...draft,
      }
    : null;
  const dirty =
    !!state &&
    !!settings &&
    (settings.mode !== state.mode ||
      settings.speed !== state.speed ||
      settings.targetTemp !== state.targetTemp);
  const source = state?.telemetrySource;
  const status = connectionError
    ? "Connection lost"
    : source === "device"
      ? "Client connected"
      : source === "demo"
        ? "Demo mode"
        : source === "stale"
          ? "Client offline"
          : "Connecting";

  const save = async () => {
    if (!settings || saving.current) return;
    saving.current = true;
    ++requestVersion.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/fan/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok)
        throw new Error("Settings could not be saved. Please try again.");
      const data = await response.json();
      setState((previous) =>
        previous ? { ...previous, ...data.state } : previous,
      );
      setDraft({});
      setNotice(
        source === "device"
          ? "Settings saved. The client will apply them on its next check-in."
          : "Settings saved. They will apply when a client connects.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Settings could not be saved.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const clearLogs = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/fan/logs", { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to clear activity.");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to clear activity.",
      );
    } finally {
      setBusy(false);
    }
  };

  const command = `curl -fsS '${window.location.origin}/api/daemon_script' -o fan-controller.py\npython3 fan-controller.py`;
  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(
        "Copy is unavailable here. Select the command and copy it manually.",
      );
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <Fan size={23} strokeWidth={1.6} />
          </span>
          <div>
            Raspi Fan<small>Less noise. More focus.</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {(
            [
              { name: "Overview", icon: Gauge },
              { name: "Activity", icon: Activity },
              { name: "Setup", icon: Terminal },
            ] as const
          ).map(({ name, icon: Icon }) => (
            <button
              key={name}
              aria-current={page === name ? "page" : undefined}
              onClick={() => {
                setPage(name);
                setError("");
              }}
            >
              <Icon size={18} strokeWidth={1.7} />
              {name}
            </button>
          ))}
        </nav>
        <div className="sidebar-device">
          <span className="device-icon">
            <Wifi size={18} />
          </span>
          <div>
            {state?.hostname || "Raspberry Pi"}
            <small>{status}</small>
          </div>
        </div>
      </aside>
      <main>
        <header className="page-header">
          <div>
            <p className="eyebrow">RASPBERRY PI · FAN CONTROL</p>
            <h1>{page}</h1>
            <p>
              {page === "Overview"
                ? "A quieter Pi starts here."
                : page === "Activity"
                  ? "A little insight into what’s happening."
                  : "Bring your Raspberry Pi into view."}
            </p>
          </div>
          <div className="header-actions">
            <span
              className={`status ${!connectionError && source === "device" ? "connected" : ""}`}
            >
              <i />
              {status}
            </span>
            <button
              className="icon-button"
              aria-label="Refresh controller"
              onClick={() => void refresh()}
              disabled={busy}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        {connectionError && (
          <div className="message error" role="alert">
            The controller is unavailable.{" "}
            {state
              ? "Showing the last received readings."
              : "Check that the server is running."}{" "}
            <button onClick={() => void refresh()}>Try again</button>
          </div>
        )}
        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}
        {!state && !connectionError && (
          <div className="empty">Connecting to your controller…</div>
        )}
        {state && page === "Overview" && (
          <>
            <section className="hero card" aria-label="Current readings">
              <div className="hero-reading">
                <p className="eyebrow">CPU TEMPERATURE</p>
                <div
                  className={`temperature ${state.currentTemp >= 70 ? "warm" : ""}`}
                >
                  {state.currentTemp.toFixed(1)}
                  <span>°C</span>
                </div>
                <p className="thermal-caption">
                  {source === "demo"
                    ? "Sample readings. No device connected."
                    : source !== "device"
                      ? "Last reported temperature"
                      : state.currentTemp >= 70
                        ? "Temperature is elevated"
                        : "Temperature is below 70°C"}
                </p>
              </div>
              <div className="fan-visual" aria-hidden="true">
                <div className="fan-inner">
                  <Fan size={104} strokeWidth={1.15} />
                </div>
              </div>
              <div className="fan-reading">
                <p className="eyebrow">REPORTED FAN OUTPUT</p>
                <strong>
                  {Math.round(state.currentSpeed)}
                  <span>%</span>
                </strong>
                <p>PWM duty cycle</p>
              </div>
              <div className="hero-footer">
                <span>
                  <span className="small-dot" />
                  {state.mode === "auto"
                    ? "Automatic cooling"
                    : "Manual control"}
                </span>
                <span>
                  {source === "demo"
                    ? "Simulated telemetry"
                    : source === "device"
                      ? "Updated with each client report"
                      : "Waiting for a new report"}
                </span>
              </div>
            </section>
            <div className="overview-grid">
              <section className="card control-card">
                <div className="section-heading">
                  <h2>Make yourself comfortable.</h2>
                  <p>Choose how your fan responds.</p>
                </div>
                {settings && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void save();
                    }}
                  >
                    <fieldset disabled={busy}>
                      <legend className="sr-only">Cooling settings</legend>
                      <div
                        className="segmented"
                        role="group"
                        aria-label="Cooling mode"
                      >
                        {(["auto", "manual"] as const).map((mode) => (
                          <button
                            type="button"
                            key={mode}
                            aria-pressed={settings.mode === mode}
                            onClick={() => {
                              setDraft((previous) => ({ ...previous, mode }));
                              setNotice("");
                            }}
                          >
                            {mode === "auto" ? "Automatic" : "Manual"}
                          </button>
                        ))}
                      </div>
                      <div className="slider-label">
                        <label htmlFor="fan-setting">
                          {settings.mode === "auto"
                            ? "Target temperature"
                            : "Fan output"}
                        </label>
                        <output htmlFor="fan-setting">
                          {settings.mode === "auto"
                            ? `${settings.targetTemp}°C`
                            : `${settings.speed}%`}
                        </output>
                      </div>
                      <input
                        id="fan-setting"
                        type="range"
                        min={settings.mode === "auto" ? 30 : 0}
                        max={settings.mode === "auto" ? 90 : 100}
                        step="1"
                        value={
                          settings.mode === "auto"
                            ? settings.targetTemp
                            : settings.speed
                        }
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setDraft((previous) => ({
                            ...previous,
                            [settings.mode === "auto" ? "targetTemp" : "speed"]:
                              value,
                          }));
                          setNotice("");
                        }}
                      />
                      <div className="range-labels">
                        <span>{settings.mode === "auto" ? "30°C" : "0%"}</span>
                        <span>
                          {settings.mode === "auto" ? "90°C" : "100%"}
                        </span>
                      </div>
                      <p className="control-help">
                        {settings.mode === "auto"
                          ? "The client adjusts fan output around this target."
                          : "Keep a fixed fan output. Watch the temperature as you adjust."}
                      </p>
                      <div className="control-actions">
                        <button
                          type="button"
                          className="text-button"
                          disabled={!dirty}
                          onClick={() => setDraft({})}
                        >
                          Reset
                        </button>
                        <button
                          className="primary"
                          disabled={!dirty || connectionError}
                        >
                          {busy ? "Saving…" : "Apply changes"}
                        </button>
                      </div>
                    </fieldset>
                  </form>
                )}
              </section>
              <section className="card chart-card">
                <div className="section-heading">
                  <h2>Recent activity</h2>
                  <p>
                    {source === "demo"
                      ? "A preview of your cooling history."
                      : "Temperature and output over time."}
                  </p>
                </div>
                <TelemetryChart history={state.history} />
              </section>
            </div>
            <p className="save-notice" role="status">
              {notice ||
                (dirty
                  ? "You have unapplied changes."
                  : "Settings are stored on this server until it restarts.")}
            </p>
            {source === "demo" && (
              <div className="connect-prompt">
                <span>
                  Ready for the real thing? Connect your Pi to see its readings.
                </span>
                <button
                  className="text-button"
                  onClick={() => setPage("Setup")}
                >
                  Set up your Pi <span aria-hidden="true">→</span>
                </button>
              </div>
            )}
          </>
        )}
        {state && page === "Activity" && (
          <section className="card activity-card">
            <div className="section-heading row">
              <div>
                <h2>Controller activity</h2>
                <p>Configuration changes and client messages.</p>
              </div>
              <button
                className="secondary"
                onClick={() => void clearLogs()}
                disabled={busy || !state.daemonLogs.length}
              >
                Clear activity
              </button>
            </div>
            <div
              className="log-list"
              role="log"
              aria-label="Controller activity"
              aria-live="off"
            >
              {state.daemonLogs.length ? (
                state.daemonLogs.map((log, index) => (
                  <p key={`${index}-${log}`}>{log}</p>
                ))
              ) : (
                <p className="empty">No activity yet.</p>
              )}
            </div>
          </section>
        )}
        {page === "Setup" && (
          <section className="card setup-card">
            <span className="setup-icon">
              <Terminal size={26} />
            </span>
            <h2>A simple connection.</h2>
            <p>
              Download the client on your Raspberry Pi, then run it to send
              readings to this dashboard.
            </p>
            <ol>
              <li>
                <h3>Set the server address</h3>
                <p>
                  Set <code>APP_URL</code> in the server’s <code>.env</code> to
                  an address your Pi can reach, then restart the server. Use its
                  LAN address when running on a different computer.
                </p>
              </li>
              <li>
                <h3>Run the client on your Pi</h3>
                <div className="code-block">
                  <pre>{command}</pre>
                  <button
                    className="icon-button"
                    onClick={() => void copyCommand()}
                    aria-label={
                      copied ? "Command copied" : "Copy client command"
                    }
                  >
                    {copied ? <Check size={17} /> : <Copy size={17} />}
                  </button>
                </div>
                <a
                  className="text-button download"
                  href="/api/daemon_script"
                  download="fan-controller.py"
                >
                  <ArrowDownToLine size={16} /> Download Python client
                </a>
              </li>
              <li>
                <h3>Check your connection</h3>
                <p>
                  The status changes to “Client connected” when reports arrive.
                  The supplied client uses GPIO 18 for an external PWM fan; it
                  does not control the Pi 5’s dedicated fan connector. Without
                  GPIO support, the client runs in emulation mode.
                </p>
              </li>
            </ol>
            <details>
              <summary>Run at startup with systemd</summary>
              <p>First install the downloaded client:</p>
              <pre>
                sudo install -Dm644 fan-controller.py
                /opt/raspi-fan/fan-controller.py
              </pre>
              <p>
                Save this as <code>/etc/systemd/system/pifan.service</code>:
              </p>
              <pre>{`[Unit]\nDescription=Raspi Fan client\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nExecStart=/usr/bin/python3 /opt/raspi-fan/fan-controller.py\nRestart=on-failure\nUser=root\n\n[Install]\nWantedBy=multi-user.target`}</pre>
              <pre>
                sudo systemctl daemon-reload{"\n"}sudo systemctl enable --now
                pifan
              </pre>
            </details>
          </section>
        )}
        <footer className="page-footer">
          <span>Raspi Fan</span>
          <span>Simple by design.</span>
        </footer>
      </main>
    </div>
  );
}
