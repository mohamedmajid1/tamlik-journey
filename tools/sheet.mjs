// Frames at chosen moments, for checking the film:  node tools/sheet.mjs portrait out-prefix 1.5 6 12 ...
// (seconds; the timeline is stepped forward to each moment, so animations play exactly as they would live;
//  DIRECT=1 jumps straight there, DSF=0.5 renders at half size: both quicker, for checking the camera)
import { launch, connect } from './cdp.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [o = 'portrait', prefix = 'frame', ...times] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.m4a': 'audio/mp4' };
const srv = createServer(async (q, s) => {
  const p = resolve(root, '.' + decodeURIComponent(new URL(q.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { s.writeHead(403); return s.end(); }
  try { const b = await readFile(p); s.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); s.end(b); } catch { s.writeHead(404); s.end(); }
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.once('listening', r));
const [W, H] = o === 'portrait' ? [1080, 1920] : [1920, 1080];
const { proc, page } = await launch({ w: W, h: H, gpu: process.env.GPU || 'd3d11', port: 9600 + Math.floor(Math.random() * 300) });
const c = await connect(page.webSocketDebuggerUrl);
const logs = [];
c.on((m) => {
  if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
});
await c.send('Runtime.enable'); await c.send('Page.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: +(process.env.DSF || 1), mobile: false });
await c.send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/?record&o=${o}${process.env.Q || ''}` });
const t0 = Date.now();
while (!(await c.evaluate('window.__ready === true').catch(() => false))) {
  if (Date.now() - t0 > 600000) { console.error(logs.join('\n')); throw new Error('never ready'); }
  await new Promise((r) => setTimeout(r, 150));
}
await new Promise((r) => setTimeout(r, 500));
let at = 0;
for (const s of times.map(Number).sort((a, b) => a - b)) {
  if (!process.env.DIRECT) for (; at < s * 1000; at = Math.min(s * 1000, at + 1000 / 30)) await c.evaluate(`__seek(${at})`);
  await c.evaluate(`__seek(${s * 1000})`);
  await new Promise((r) => setTimeout(r, 120));
  if (process.env.PROBE) console.log(s, JSON.stringify(await c.evaluate('window.__probe()')));
  const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${prefix}_${String(s).padStart(5, '0')}.png`, Buffer.from(data, 'base64'));
}
console.log('duration', await c.evaluate('window.__duration'));
if (logs.length) console.error(logs.join('\n'));
c.close(); proc.kill(); srv.close();
