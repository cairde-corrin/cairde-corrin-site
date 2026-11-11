// Minimal zero-dependency Chrome DevTools Protocol driver.
// Lives in /tmp on purpose: the site itself keeps no dependencies and no build step.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function launch({ port = 9222, headless = true } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'cdp-'));
  const args = [
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--hide-scrollbars', 'about:blank',
  ];
  if (headless) args.unshift('--headless=new', '--disable-gpu');
  const proc = spawn(CHROME, args, { stdio: 'ignore', detached: false });
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return { proc, port, profile };
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Chrome did not start');
}

export async function newPage(port) {
  const r = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  const target = await r.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    } else if (m.method) listeners.forEach(f => f(m));
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  const page = {
    send, on: f => listeners.push(f), targetId: target.id,
    close: () => fetch(`http://127.0.0.1:${port}/json/close/${target.id}`),
    async goto(url, waitMs = 2500) {
      await send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, waitMs));
    },
    async evaluate(expr) {
      const r = await send('Runtime.evaluate', {
        expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true,
      });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
      return r.result.value;
    },
    async screenshot(path, opts = {}) {
      const r = await send('Page.captureScreenshot', { format: 'png', ...opts });
      writeFileSync(path, Buffer.from(r.data, 'base64'));
    },
    async viewport(width, height, { mobile = false, dsf = mobile ? 3 : 1 } = {}) {
      await send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: dsf, mobile,
        screenWidth: width, screenHeight: height,
      });
      if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    },
    async throttle({ downKbps = 0, latencyMs = 0, cpuRate = 1 } = {}) {
      if (downKbps) await send('Network.emulateNetworkConditions', {
        offline: false, latency: latencyMs,
        downloadThroughput: downKbps * 1024 / 8, uploadThroughput: downKbps * 1024 / 8,
      });
      if (cpuRate > 1) await send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    },
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Network.enable'); await send('Log.enable');
  return page;
}

// Collects every request and its transfer size for one page load.
export function trackNetwork(page) {
  const reqs = new Map(); const errors = []; const console_ = [];
  page.on(m => {
    if (m.method === 'Network.requestWillBeSent')
      reqs.set(m.params.requestId, { url: m.params.request.url, type: m.params.type, size: 0, status: 0 });
    if (m.method === 'Network.responseReceived') {
      const r = reqs.get(m.params.requestId);
      if (r) { r.status = m.params.response.status; r.type = m.params.type; r.mime = m.params.response.mimeType; }
    }
    if (m.method === 'Network.loadingFinished') {
      const r = reqs.get(m.params.requestId);
      if (r) r.size = m.params.encodedDataLength;
    }
    if (m.method === 'Network.loadingFailed') {
      const r = reqs.get(m.params.requestId);
      if (r) { r.failed = true; r.error = m.params.errorText; }
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text);
    if (m.method === 'Runtime.exceptionThrown')
      errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      console_.push(m.params.args.map(a => a.description || a.value).join(' '));
  });
  return { reqs, errors, console: console_ };
}
