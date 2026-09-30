// Tamlik Journey: the tower film and the departments film as one continuous 3D move, on one master timeline that
// plays forever on the hallway screens.
//   The curtains close on the 3D logo and the three departments. They part on Muscat at golden hour, the camera
//   drops onto the boulevard and turns in through a window of a building on the right: inside, Tamlik Maintenance fixes
//   the flat. Back out, across the boulevard and in through a window on the left: Tamlik Media is shooting a film.
//   Out again, up the Tamlik tower and in through a flat's window: Tamlik Fit-out finishes it. The camera pulls back
//   out of the tower into the night, the drone show draws the logo over the city, the contact caption, curtains, loop.
// Everything is authored on a fixed canvas (1080×1920 portrait or 1920×1080 landscape) and scaled to fit.
//   ?o=portrait|landscape  force an orientation      ?t=40      hold the film at 40 s
//   ?record                paused; tools/record.mjs drives window.__seek(ms) frame by frame      ?mute
import * as THREE from 'three';
import { createTimeline, stagger } from '../vendor/anime.esm.min.js';
import { logoSVG, captionHTML } from './brand.js';
import { maintenance } from './scenes/maintenance.js';
import { media } from './scenes/media.js';
import { fitout } from './scenes/fitout.js';
import { makeCity } from './scenes/city.js';
import { FILM, Q as QUALITY } from './three/kit.js';
import { roomWindow, link, flight, approach, leave, V3, smooth, clamp } from './journey.js';

const Q = new URLSearchParams(location.search);
const RECORD = Q.has('record');
const stage = document.getElementById('stage');
const ROOMS = [maintenance, media, fitout];

const portrait = Q.get('o') ? Q.get('o') === 'portrait' : innerHeight >= innerWidth;
stage.className = portrait ? 'portrait' : 'landscape';
const W = portrait ? 1080 : 1920, H = portrait ? 1920 : 1080;
function fit() {
  const k = Math.min(innerWidth / W, innerHeight / H);
  stage.style.transform = `translate(${-W * k / 2}px, ${-H * k / 2}px) scale(${k})`;
}
fit(); addEventListener('resize', fit);
// live: render at the size the screen really shows the film, up to 1.5× (?hq: up to 2×)
const shownScale = () => Math.min(innerWidth / W, innerHeight / H) * devicePixelRatio;
QUALITY.pr = Q.has('pr') ? +Q.get('pr') : Q.has('hq') ? Math.min(devicePixelRatio, 2) : Math.min(1.5, Math.max(0.6, shownScale()));

const chars = (s) => [...s].map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
const words = (html) => html.split(/(<b>.*?<\/b>|\s+)/).filter((w) => w && !/^\s+$/.test(w)).map((w) => `<span class="wd">${w}</span>`).join(' ');

// ---- layers ---------------------------------------------------------------------------------------------------
stage.innerHTML = `<canvas id="city"></canvas>`;
for (const s of ROOMS) {
  const el = document.createElement('section');
  el.className = 'scene full room'; el.id = s.id;
  el.style.setProperty('--accent', s.accent); el.style.setProperty('--glow', s.glow);
  el.innerHTML = `${s.html()}
    <div class="ui"><div class="lockup">${logoSVG()}<div class="rule"></div><div class="dept">${chars(s.name)}</div></div>
    <div class="tagline">${words(s.tagline)}</div>
    <div class="footer">tamlikoman.com</div></div>`;
  stage.append(el);
  s.el = el;
}
stage.insertAdjacentHTML('beforeend', `
  <section id="closing">
    <div class="trio">${ROOMS.map((s) => `<div class="dep" style="--accent:${s.accent}"><span class="dot"></span>${s.name}</div>`).join('')}</div>
    ${captionHTML()}
  </section>
  <div id="vignette"></div>
  <section id="curtains">
    <div class="half top"></div><div class="half bot"></div>
    <div class="mark"><canvas class="logo3d" width="1400" height="480"></canvas>
      <div class="depts">${ROOMS.map((s) => `<span style="color:${s.accent}">${s.name}</span>`).join('<i></i>')}</div></div>
  </section>
  <div id="black"></div>`);
const $ = (sel, root = stage) => [...root.querySelectorAll(sel)];
const cityCanvas = document.getElementById('city');
const logoCanvas = stage.querySelector('.logo3d');
const curtainTop = stage.querySelector('#curtains .top'), curtainBot = stage.querySelector('#curtains .bot');

await document.fonts.ready;
const city = await makeCity(cityCanvas, { portrait, record: RECORD });
for (const s of ROOMS) await s.init(s.el, { portrait, record: RECORD });

// ---- the windows, and the camera's route ------------------------------------------------------------------------
// the three flats: a building on the right of the boulevard (Maintenance), one on the left further up (Media), and a
// flat on the tower's 18th floor, on the face that looks down the boulevard (Fit-out). Buildings from the city's own
// list (the same seed every time); floors are 3.8 m in the building shader.
const pick = (x, z) => city.buildings.reduce((b, c) => (Math.hypot(c[0] - x, c[1] - z) < Math.hypot(b[0] - x, b[1] - z) ? c : b));
const FLATS = [
  { room: maintenance, label: 'TAMLIK  MAINTENANCE', side: +1, b: pick(61.5, 178.8), floor: 2, z: 176 },
  { room: media, label: 'TAMLIK  MEDIA', side: -1, b: pick(-61.6, -181.7), floor: 2, z: -183 },
  { room: fitout, label: 'TAMLIK  FIT-OUT', tower: 18 },
];
for (const f of FLATS) {
  const rw = roomWindow(f.room);
  let win;
  if (f.tower) win = city.towerWindow(f.tower, 0, { w: rw.w, h: rw.h, label: f.label });
  else {
    const [x, , w] = f.b, n = V3(-f.side, 0, 0);
    const c = V3(x - f.side * (w / 2) + n.x * 0.02, 3.8 * f.floor + 0.1 + rw.c.y, f.z);
    win = city.heroWindow({ c, n, w: rw.w, h: rw.h, label: f.label });
  }
  f.win = win; f.rw = rw; f.lk = link(win, rw);
  const V = f.room.view();
  f.fov = V.camera.fov;
  f.shift = V.camera.view ? V.camera.view.offsetX / V.camera.view.fullWidth : 0;
}

// timing (ms)
const SCENE = 14000;
const T = { open: 3650, f1: 4000, in1: 14500, in2: 35000, in3: 57500, end4: 80500, caption: 76500, close: 82500 };
const END = T.close + 1500;
const ROOM_AT = [T.in1, T.in2, T.in3];
FLATS.forEach((f, i) => { f.t0 = ROOM_AT[i]; f.t1 = ROOM_AT[i] + SCENE; });

// the lens in the city is framed for 16:9; on a portrait screen it opens up so the width still breathes
const lens = (fov) => portrait ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * Math.pow((16 / 9) / (9 / 16), 0.5))) : fov;
const K = (p, l, fov, roll = 0) => ({ p: V3(...p), l: V3(...l), fov: lens(fov), roll });
const [M, D, F] = FLATS;
const sh = (f, i) => f.room.shots()[i];
const FLIGHTS = [
  // golden hour: the aerial over the city, down onto the boulevard axis, low along it, then right into the building
  flight([
    K([150, 430, 780], [0, 70, -520], 42),
    K([40, 190, 470], [0, 60, -300], 44),
    K([6, 40, 300], [20, 16, 120], 50, 0.02),
    ...approach(M.lk, sh(M, 0), M.fov, M.shift, { far: 30, rise: 5 }),
  ], T.f1, T.in1),
  // back out, up the boulevard, and across into the building on the left
  flight([
    ...leave(M.lk, sh(M, 1), M.fov, M.shift),
    K([10, 16, 90], [-10, 12, -150], 50, -0.03),
    ...approach(D.lk, sh(D, 0), D.fov, D.shift, { far: 26, rise: 3 }),
  ], M.t1, T.in2),
  // out again, and up to the tower
  flight([
    ...leave(D.lk, sh(D, 1), D.fov, D.shift),
    K([-6, 26, -290], [0, 90, -600], 50, 0.02),
    ...approach(F.lk, sh(F, 0), F.fov, F.shift, { far: 40, rise: 6 }),
  ], D.t1, T.in3),
  // back out of the tower into the night: the drone show over the city, the closing aerial
  flight([
    ...leave(F.lk, sh(F, 1), F.fov, F.shift, { back: 10 }),
    K([-30, 150, -300], [-60, 110, -700], 48),
    K([-150, 330, 90], [-95, 80, -700], 46),
  ], F.t1, T.end4),
];
// which flight is on at ms, and the rooms it leaves and heads for
const legs = FLIGHTS.map((fl, i) => ({ fl, from: FLATS[i - 1], to: FLATS[i] }));

// ---- the master timeline ----------------------------------------------------------------------------------------
const tl = createTimeline({ autoplay: false, loop: !RECORD, defaults: { ease: 'outQuad' } });
const NIGHT = { v: 0 }, INTRO = { v: 1 }, CURTAIN = { v: 0 };   // CURTAIN: 0 closed .. 1 open
tl.set(NIGHT, { v: 0.02 }, 0).set(INTRO, { v: 1 }, 0)
  .add(NIGHT, { v: [0.02, 0.2], duration: T.in1 - 3000, ease: 'linear' }, 3000)
  .add(NIGHT, { v: [0.2, 0.34], duration: T.in2 - T.in1, ease: 'linear' }, T.in1)
  .add(NIGHT, { v: [0.34, 0.52], duration: T.in3 - T.in2, ease: 'linear' }, T.in2)
  .add(NIGHT, { v: [0.52, 0.8], duration: T.end4 - T.in3, ease: 'linear' }, T.in3)
  .add(INTRO, { v: [1, 0], duration: 4200, ease: 'outCubic' }, T.open + 100);

// the curtains: the 3D logo assembles on them with the three departments, they part on the city, and close again
const logo = city.logoRig.anim;
tl.set(logo, { l: 0, r: 0, w: 0, sweep: -1.5 }, 0)
  .set(CURTAIN, { v: 0 }, 0)
  .set($('#curtains .mark'), { opacity: 1, translateY: 0 }, 0)
  .set($('#curtains .depts span, #curtains .depts i'), { opacity: 0 }, 0)
  .add(logo, { l: [0, 1], duration: 2000, ease: 'outExpo' }, 0)
  .add(logo, { r: [0, 1], duration: 2000, ease: 'outExpo' }, 140)
  .add(logo, { w: [0, 1], duration: 1800, ease: 'outExpo' }, 500)
  .add(logo, { sweep: [-1.5, 1.5], duration: 1800, ease: 'inOutQuad' }, 1000)
  .add($('#curtains .depts span, #curtains .depts i'), { opacity: [0, 1], translateY: [20, 0], duration: 700, delay: stagger(110) }, 1500)
  .add($('#curtains .mark'), { opacity: [1, 0], translateY: [0, -24], duration: 800, ease: 'inQuad' }, T.open - 650)
  .add(CURTAIN, { v: [0, 1], duration: 1800, ease: 'inOutExpo' }, T.open)
  .add(CURTAIN, { v: [1, 0], duration: 1500, ease: 'inOutExpo' }, T.close)
  .set(logo, { l: 0, r: 0, w: 0, sweep: -1.5 }, T.close);

// each flat: the green line draws round its window as the camera arrives; inside, the department's own story and
// its lockup and tagline; they clear before the camera backs out
FLATS.forEach((f) => {
  const el = f.room.el, t0 = f.t0;
  f.room.len = SCENE;
  tl.set(f.win, { draw: 0 }, 0)
    .add(f.win, { draw: [0, 1], duration: 2200, ease: 'inOutSine' }, t0 - 4200)
    .add(f.win, { draw: [1, 0], duration: 1200, ease: 'inOutSine' }, f.t1 + 1800);
  tl.set(el, { '--ui': 0 }, 0)
    .set($('.lockup .logo, .lockup .rule, .dept .ch, .tagline .wd, .footer', el), { opacity: 0 }, 0)
    .add(el, { '--ui': [0, 1], duration: 900 }, t0 + 200)
    .add($('.lockup .logo', el), { opacity: [0, 1], translateY: [-30, 0], duration: 900, ease: 'outExpo' }, t0 + 500)
    .add($('.lockup .rule', el), { opacity: [0, 1], scaleX: [0, 1], duration: 700, ease: 'inOutQuad' }, t0 + 800)
    .add($('.dept .ch', el), { opacity: [0, 1], translateY: [18, 0], filter: ['blur(6px)', 'blur(0px)'], duration: 600, delay: stagger(45) }, t0 + 1000);
  const { tagAt } = f.room.animate(tl, el, t0);
  tl.add($('.tagline .wd', el), { opacity: [0, 1], translateY: [40, 0], filter: ['blur(8px)', 'blur(0px)'], duration: 900, delay: stagger(140), ease: 'outExpo' }, tagAt)
    .add($('.footer', el), { opacity: [0, 1], duration: 900 }, tagAt + 600)
    .add(el, { '--ui': [1, 0], duration: 800, ease: 'inOutSine' }, f.t1 - 1100);
});

// the close: the three departments and the contact details over the drone show, then the curtains
const closing = stage.querySelector('#closing');
tl.set($('.dep, .caption .site, .caption .row span', closing), { opacity: 0 }, 0).set(closing, { opacity: 1 }, 0)
  .add($('.dep', closing), { opacity: [0, 1], translateY: [24, 0], duration: 900, delay: stagger(180), ease: 'outExpo' }, T.caption)
  .add($('.caption .site', closing), { opacity: [0, 1], translateY: [20, 0], duration: 900, ease: 'outExpo' }, T.caption + 900)
  .add($('.caption .row span', closing), { opacity: [0, 1], translateY: [16, 0], duration: 800, delay: stagger(140) }, T.caption + 1200)
  .call(() => {}, END);

// ---- drawing a frame ----------------------------------------------------------------------------------------------
const cam = city.camera;
const tmp = { v: V3(0, 0, 0), q: new THREE.Quaternion() };
const RAMP = 1600;
// the outline of a city window on screen, cut at the camera's near plane (stage pixels)
function outline(win) {
  cam.updateMatrixWorld(); const vm = cam.matrixWorldInverse, near = cam.near + 0.01;
  const pts = win.corners.map((c) => c.clone().applyMatrix4(vm));
  const clip = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ina = a.z <= -near, inb = b.z <= -near;
    if (ina) clip.push(a);
    if (ina !== inb) clip.push(a.clone().lerp(b, (-near - a.z) / (b.z - a.z)));
  }
  return clip.map((p) => { const s = p.clone().applyMatrix4(cam.projectionMatrix); return [(s.x + 1) / 2 * W, (1 - s.y) / 2 * H]; });
}
const shown = new Map();
function show(el, how) {                       // how: false | true (full) | polygon string
  if (shown.get(el) === how) return; shown.set(el, how);
  el.style.visibility = how ? 'visible' : 'hidden';
  el.style.clipPath = typeof how === 'string' ? how : 'none';
}
function setCityCam(p) {
  cam.near = 0.3;
  cam.position.copy(p.pos); cam.quaternion.copy(p.quat); cam.fov = p.fov;
  if (p.shift) cam.setViewOffset(W, H, W * p.shift, 0, W, H); else cam.clearViewOffset();
  cam.updateProjectionMatrix();
}
function drawFrame(ms) {
  const t = ms / 1000;
  FILM.t = t;
  let roomOn = null, roomHow = false, cityOn = false;
  for (const f of FLATS) f.room.view().portal = null;
  const inRoom = FLATS.find((f) => ms >= f.t0 && ms <= f.t1);
  if (inRoom) {
    // inside: the room's own rig, its lens and float fading in after arriving and out before leaving
    const k = Math.min(smooth(inRoom.t0, inRoom.t0 + RAMP, ms), 1 - smooth(inRoom.t1 - RAMP, inRoom.t1, ms));
    inRoom.room.view().portal = k >= 1 ? null : { pos: null, fov: inRoom.fov, lens: 1, hh: k, shift: inRoom.shift };
    roomOn = inRoom; roomHow = true;
  } else {
    const leg = legs.find((l) => ms >= l.fl.t0 && ms <= l.fl.t1) || legs[legs.length - 1];
    const pose = leg.fl.at(ms);
    // the intro: the tower film's opening, high and pitched down, settling as the curtains part
    const iv = INTRO.v;
    if (iv > 0) {
      pose.pos.addScaledVector(V3(40, 180, 620), iv * iv);
      pose.quat.multiply(tmp.q.setFromEuler(new THREE.Euler(-0.12 * iv, 0, 0)));
      pose.fov += 8 * iv;
    }
    setCityCam(pose);
    // the room this flight is next to: the one it left (first half) or the one it's heading for (second half)
    const half = (ms - leg.fl.t0) / (leg.fl.t1 - leg.fl.t0);
    const f = half < 0.5 ? leg.from : leg.to;
    if (f) {
      const out = f.lk.outside(pose.pos);
      // right at a window the near plane comes in, or it would cut the facade away and show the city through it
      cam.near = clamp(out * 0.4, 0.02, 0.3); cam.updateProjectionMatrix();
      const P = { pos: f.lk.toRoom(pose.pos), quat: f.lk.qToRoom(pose.quat), fov: pose.fov, lens: 0, hh: 0, shift: pose.shift, dist: Math.max(0, out), plane: out > 0 ? f.lk.plane : null };
      f.room.view().portal = P;
      if (out <= 0) { roomOn = f; roomHow = true; }
      else {
        cityOn = true;
        const poly = outline(f.win);
        const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
        if (poly.length >= 3 && Math.max(...xs) > 0 && Math.min(...xs) < W && Math.max(...ys) > 0 && Math.min(...ys) < H) {
          roomOn = f; roomHow = `polygon(${poly.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(', ')})`;
        }
      }
    } else cityOn = true;
  }
  if (cityOn) {
    city.draw(t, { night: NIGHT.v, droneT: t - 16.5, gullT: t + 2 });
  }
  show(cityCanvas, cityOn);
  for (const f of FLATS) {
    const how = f === roomOn ? roomHow : false;
    if (how) f.room.render();
    show(f.room.el, how);
  }
  const cv = CURTAIN.v;
  if (cv !== drawFrame.cv) { drawFrame.cv = cv; curtainTop.style.transform = `translateY(${-100 * cv}%)`; curtainBot.style.transform = `translateY(${100 * cv}%)`; }
  // the logo on the curtains, while they are closed
  if (ms < T.open + 900 || ms > T.close) city.logoRig.renderTo(logoCanvas, t);
}

// ---- sound: assets/audio/loop.m4a (tools/mix-audio.mjs) is exactly one film long -----------------------------------
const sound = (() => {
  if (RECORD || Q.has('mute') || Q.has('t')) return null;
  const a = new Audio('assets/audio/loop.m4a');
  a.preload = 'auto'; a.loop = true;
  const filmTime = () => (tl.iterationCurrentTime ?? tl.currentTime % END) / 1000;
  const sync = () => { if (Math.abs(a.currentTime - filmTime()) > 0.12) a.currentTime = filmTime(); };
  const start = () => { sync(); return a.play(); };
  const unlock = () => { if (a.paused) start().catch(() => {}); };
  for (const ev of ['pointerdown', 'mousedown', 'click', 'keydown', 'touchend']) addEventListener(ev, unlock, { passive: true, capture: true });
  setInterval(() => { if (!a.paused) sync(); }, 2000);
  window.__sound = a;
  return { start };
})();

// warm-up behind the loading screen: step through the film once so every shader and texture is on the GPU
const yieldNow = () => new Promise((r) => { const m = new MessageChannel(); m.port1.onmessage = () => r(); m.port2.postMessage(0); });
for (let ms = 0; ms <= END; ms += RECORD ? 400 : 900) { tl.seek(ms); drawFrame(ms); await yieldNow(); }
tl.seek(0);

// ---- play -------------------------------------------------------------------------------------------------------
window.__duration = END;
window.__filmMs = () => tl.iterationCurrentTime ?? 0;
window.__seek = (ms) => { tl.seek(ms); drawFrame(ms); };
window.__probe = () => ({ t: FILM.t, pos: cam.position.toArray().map((v) => +v.toFixed(2)), q: cam.quaternion.toArray().map((v) => +v.toFixed(3)), near: cam.near, city: cityCanvas.style.visibility, rooms: FLATS.map((f) => f.room.el.style.visibility + ' ' + f.room.el.style.clipPath.slice(0, 60)), fov: +cam.fov.toFixed(1), night: NIGHT.v,
  windows: FLATS.map((f) => ({ c: f.win.c.toArray().map((v) => +v.toFixed(2)), w: +f.rw.w.toFixed(2), room: f.rw.c.toArray().map((v) => +v.toFixed(2)) })) });
if (Q.has('t')) { tl.seek(+Q.get('t') * 1000); drawFrame(+Q.get('t') * 1000); }
else if (!RECORD) {
  tl.play(); sound?.start().catch(() => {});
  (function loop() { drawFrame(tl.iterationCurrentTime ?? 0); requestAnimationFrame(loop); })();
}
stage.classList.add('ready');
if (RECORD) document.getElementById('loading')?.remove(); else document.getElementById('loading')?.classList.add('gone');
window.__ready = true;
