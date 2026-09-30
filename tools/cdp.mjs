// Minimal zero-dependency Chrome DevTools Protocol client (Node 22 global WebSocket).
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const GPU_FLAGS = {
  vulkan: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'],
  gl: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'],
  egl: ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist'],   // Windows
  swiftshader: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
};

export async function launch({ port = 9333, w = 1080, h = 1920, gpu = 'vulkan', extra = [] } = {}) {
  const prof = mkdtempSync(join(process.env.SCRATCH || tmpdir(), 'chrome-rec-'));
  const args = ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`,
    `--window-size=${w},${h}`, '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--force-color-profile=srgb', ...GPU_FLAGS[gpu], ...extra, 'about:blank'];
  const proc = spawn(process.env.CHROME || '/usr/bin/google-chrome', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; proc.stderr.on('data', d => { err += d; if (err.length > 20000) err = err.slice(-10000); });
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await r.json();
      const page = list.find(t => t.type === 'page');
      if (page) return { proc, page, stderr: () => err };
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  proc.kill(); throw new Error('chrome did not start\n' + err);
}

export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message + ' ' + (msg.error.data || ''))) : res(msg.result);
    } else if (msg.method) for (const l of listeners) l(msg);
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const on = (fn) => listeners.push(fn);
  const evaluate = async (expression, awaitPromise = true) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  return { send, on, evaluate, close: () => ws.close() };
}
