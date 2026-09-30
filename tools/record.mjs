// Frame-exact video of the film, with its soundtrack:
//   node tools/record.mjs --o portrait --mp4 renders/journey_portrait.mp4 [--fps 60] [--blur 2] [--scale 1]
// The page's timeline is paused and stepped with window.__seek(ms); --blur N blends N moments inside each frame's
// shutter (half a frame, like a film camera) for smooth motion. Needs Chrome or Edge (set CHROME) and ffmpeg.
import { launch, connect } from './cdp.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const A = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; }));
const O = A.o || 'portrait', FPS = +(A.fps || 60), BLUR = Math.max(1, +(A.blur || 2)), SCALE = +(A.scale || 1);
const [W, H] = O === 'portrait' ? [1080, 1920] : [1920, 1080];
const OUT = A.mp4 || `renders/journey_${O}.mp4`;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(dirname(resolve(root, OUT)), { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.m4a': 'audio/mp4', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream' };
const srv = createServer(async (q, s) => {
  const p = resolve(root, '.' + decodeURIComponent(new URL(q.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root)) { s.writeHead(403); return s.end(); }
  try { const b = await readFile(p); s.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); s.end(b); } catch { s.writeHead(404); s.end(); }
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.once('listening', r));

const { proc, page } = await launch({ w: W, h: H, gpu: A.gpu || (process.platform === 'win32' ? 'd3d11' : 'gl'), port: 9400 + Math.floor(Math.random() * 500) });
const c = await connect(page.webSocketDebuggerUrl);
const logs = [];
c.on((m) => { if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); });
await c.send('Runtime.enable'); await c.send('Page.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
await c.send('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/?record&o=${O}` });
const t0 = Date.now();
while (!(await c.evaluate('window.__ready === true').catch(() => false))) {
  if (Date.now() - t0 > 600000) { console.error(logs.join('\n')); throw new Error('page never became ready'); }
  await new Promise((r) => setTimeout(r, 200));
}
await new Promise((r) => setTimeout(r, 800));          // images decoded
const DUR = await c.evaluate('window.__duration'), frames = Math.round(DUR / 1000 * FPS), dt = 1000 / FPS;

// the soundtrack only fits the whole film; single spots are silent (their timing differs)
const audio = existsSync(resolve(root, 'assets/audio/loop.m4a')) ? ['-i', resolve(root, 'assets/audio/loop.m4a')] : [];
const vf = [];
if (BLUR > 1) vf.push(`tmix=frames=${BLUR}`, `trim=start_frame=${BLUR - 1}`, `framestep=${BLUR}`, `setpts=N/(${FPS}*TB)`);
if (SCALE !== 1) vf.push(`scale=${W}:${H}:flags=lanczos`);
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * BLUR), '-i', '-', ...audio,
  ...(vf.length ? ['-vf', vf.join(',')] : []), '-r', String(FPS), '-map', '0:v:0', ...(audio.length ? ['-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
  '-c:v', 'libx264', '-preset', 'medium', '-crf', A.crf || '14', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-movflags', '+faststart', resolve(root, OUT)], { stdio: ['pipe', 'inherit', 'inherit'] });

const tStart = Date.now();
for (let k = 0; k < frames; k++) {
  for (let i = 0; i < BLUR; i++) {
    await c.evaluate(`__seek(${k * dt + (i / BLUR) * 0.5 * dt})`);
    const { data } = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, optimizeForSpeed: true });
    if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  }
  if (k % 120 === 0) console.error(`frame ${k}/${frames} (${(k / FPS).toFixed(1)} s) ${((Date.now() - tStart) / (k + 1)).toFixed(0)} ms/frame`);
}
ff.stdin.end(); await new Promise((r) => ff.on('close', r));
console.error(`done: ${OUT} (${frames} frames, ${(DUR / 1000).toFixed(2)} s)${logs.length ? '\nERRORS:\n' + logs.join('\n') : ''}`);
c.close(); proc.kill(); srv.close();
