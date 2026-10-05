import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

// Exercise the production server over HTTP. Run npm run build before this suite.
test('fan API validates atomically and keeps device telemetry separate from demo data', { timeout: 35000 }, async t => {
  const appUrl = 'https://example.test/path?label="quoted"&next=\\value';
  const child = spawn(process.execPath, ['dist/server.cjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, NODE_ENV: 'production', PORT: '0', APP_URL: appUrl },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stderr.on('data', chunk => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
    }
  });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 8000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/listening on port (\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  const base = `http://127.0.0.1:${port}`;
  async function request(path, method = 'GET', body) {
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text };
  }
  const getState = async () => (await request('/api/fan/state')).body;
  const initial = await getState();
  assert.equal(initial.telemetrySource, 'demo');
  assert.equal(initial.isOnline, false);
  assert.ok(initial.history.length > 0);

  for (const invalid of [[], {}, null, { speed: '50' }, { speed: -1 }, { speed: 101 },
    { mode: 'off' }, { targetTemp: 29 }, { targetTemp: 91 }, { surprise: true },
    { mode: 'manual', speed: 80, targetTemp: '55' }]) {
    assert.equal((await request('/api/fan/control', 'POST', invalid)).status, 400);
  }
  const unchanged = await getState();
  for (const key of ['speed', 'mode', 'targetTemp', 'daemonLogs']) {
    assert.deepEqual(unchanged[key], initial[key], `${key} changed after invalid control`);
  }
  const nonFinite = await fetch(base + '/api/fan/control', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"speed":1e400}',
  });
  assert.equal(nonFinite.status, 400);
  const control = { speed: 73, mode: 'manual', targetTemp: 62 };
  assert.equal((await request('/api/fan/control', 'POST', control)).status, 200);

  for (const invalid of [[], {}, { temp: '42', speed: 50 }, { temp: 42 },
    { temp: 42, speed: -1 }, { temp: 42, speed: 101 }, { temp: 201, speed: 50 },
    { temp: 42, speed: 50, hostname: {} }, { temp: 42, speed: 50, logs: [23] }]) {
    assert.equal((await request('/api/fan/report', 'POST', invalid)).status, 400);
  }
  assert.equal((await getState()).lastSeen, null);
  const report = await request('/api/fan/report', 'POST', { temp: 51.26, speed: 72.6, hostname: 'test-pi', logs: ['ready'] });
  assert.deepEqual(report.body, control);
  const connected = await getState();
  assert.equal(connected.telemetrySource, 'device');
  assert.equal(connected.isOnline, true);
  assert.equal(connected.currentTemp, 51.3);
  assert.equal(connected.currentSpeed, 73);
  assert.equal(connected.hostname, 'test-pi');
  assert.equal(connected.history.length, 1, 'First report must clear demo history');
  assert.match(connected.daemonLogs[0], /PI: ready/);

  assert.equal((await request('/api/fan/logs', 'DELETE')).status, 200);
  assert.deepEqual((await getState()).daemonLogs, []);
  const script = await (await fetch(base + '/api/daemon_script')).text();
  assert.ok(script.includes(`SERVER_URL = ${JSON.stringify(appUrl)}`));

  // Cross both the offline threshold and a later simulation tick. A stale
  // device must retain its actual last measurement, never resume demo data.
  await delay(21000);
  const stale = await getState();
  assert.equal(stale.telemetrySource, 'stale');
  assert.equal(stale.isOnline, false);
  for (const key of ['currentTemp', 'currentSpeed', 'history', 'lastSeen']) {
    assert.deepEqual(stale[key], connected[key], `${key} changed without a device report`);
  }
  await request('/api/fan/report', 'POST', { temp: 49, speed: 60 });
  const reconnected = await getState();
  assert.equal(reconnected.telemetrySource, 'device');
  assert.equal(reconnected.history.length, 2);
});
