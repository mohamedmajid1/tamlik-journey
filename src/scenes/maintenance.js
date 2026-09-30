// Tamlik Maintenance: a lived-in Muscat flat with real problems, and the Tamlik team fixing them.
// The back wall is broken open to the brickwork (a real hole in the plaster, bricks behind it, rubble and plaster dust
// on the floor), the pendant hangs crooked, sparks and flickers, water seeps through a stained ceiling and drips
// into a bucket beside a wet-floor sign, a picture hangs askew, grime everywhere, grey light. Green AR markers
// diagnose each fault, the repair kit is set down, and a green scan line (the roof stroke of the Tamlik logo)
// sweeps the room: the rubble flies back and fresh plaster seals the wall, the lamp swings straight and lights, the
// leak stops and the puddle dries, the frame straightens, the walls come up clean and the sun warms the room.
// animate() adds the motion at T (ms); render() draws the current state.
import { THREE, tex, surface, model, seat, ready, makeView, aim, shotTween, canvasTex, holoRing, GREEN,
  reveal, syncReveals, bakeEnv, dust, shaft, handheld, FILM, place } from '../three/kit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { stagger } from '../../vendor/anime.esm.min.js';
import { C } from '../brand.js';

const HW = 3.5, HD = 2.75, H = 2.9;                  // half width, half depth, ceiling
const HX = -1.3, HY = 1.2;                           // the hole in the back wall
const LX = 0.05, LZ = -0.9;                          // the broken pendant
const WX = 1.05, WZ = -1.25;                         // the leak
const ACX = 0.85, ACY = 2.42;                        // the air conditioner above the TV
let V, SHOT;
const rig = {};
const S = { dirt: 1, warm: 0, flick: 0.15, lamp: 0, scan: -4.2, scanOn: 0, sparkOn: 1, fly: 0, plug: 0, expo: 0.74, acFix: 0, air: 0 };
const U = { dirt: { value: 1 } };
const F = {};                                          // the faults and their parts
const holos = [], tools = [], drips = [], ripples = [], splashes = [];
let sd = 3; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;

// grime on walls, floor and ceiling (world-space value noise), cleaned off as uDirt goes to 0
function grime(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDirt = U.dirt;
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `uniform float uDirt; varying vec3 vWp;
      float hsh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hsh(i), hsh(i + vec3(1,0,0)), f.x), mix(hsh(i + vec3(0,1,0)), hsh(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hsh(i + vec3(0,0,1)), hsh(i + vec3(1,0,1)), f.x), mix(hsh(i + vec3(0,1,1)), hsh(i + vec3(1,1,1)), f.x), f.y), f.z); }
      ` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float gN = vn(vWp * 2.3) * 0.6 + vn(vWp * 7.0) * 0.4;
        float streak = smoothstep(0.55, 0.9, vn(vec3(vWp.x * 6.0, vWp.y * 0.6, vWp.z * 6.0)));
        float low = 1.0 - smoothstep(0.0, 0.5, vWp.y);                 // scuffs and dust near the floor
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.8, 0.76, 0.69) * (0.74 + 0.32 * gN) - streak * 0.1 - low * 0.08, uDirt);`);
  };
  return mat;
}

// fractal value noise on the CPU, for stains, puddles and dust drawn into canvases
function noise2() {
  const P = new Float32Array(256 * 256); for (let i = 0; i < P.length; i++) P[i] = rnd();
  const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const g = (a, b) => P[((a & 255) << 8) | (b & 255)];
    return (g(xi, yi) * (1 - sx) + g(xi + 1, yi) * sx) * (1 - sy) + (g(xi, yi + 1) * (1 - sx) + g(xi + 1, yi + 1) * sx) * sy; };
  return (x, y) => v(x, y) * 0.5 + v(x * 2.1, y * 2.1) * 0.25 + v(x * 4.3, y * 4.3) * 0.15 + v(x * 8.7, y * 8.7) * 0.1;
}
// a blob shape from noise: fn(x, y, r, v) -> [r, g, b, a] per pixel, r = distance from centre (0..1)
function blobTex(size, fn, seed = 0) {
  const fb = noise2();
  return canvasTex(size, size, (x, w, h) => {
    const img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const u = i / w - 0.5, q = j / h - 0.5, r = Math.hypot(u, q) * 2;
      const c = fn(u, q, r, fb(i / w * 5 + seed, j / h * 5 + seed));
      const k = (j * w + i) * 4; img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = c[3];
    }
    x.putImageData(img, 0, 0);
  });
}
// glass in the models (the clock face) uses transmission, which re-renders the whole room every frame: a plain
// transparent glass looks the same at this size
function noTransmission(o) {
  o.traverse((m) => { if (!m.isMesh) return; for (const mt of [].concat(m.material)) if (mt.transmission > 0) { mt.transmission = 0; mt.transparent = true; mt.opacity = 0.18; mt.roughness = 0.05; mt.depthWrite = false; } });
  return o;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// the outline of the hole: an irregular, natural break (slow waves plus small chips), in wall coordinates
function holeOutline(rx, ry, jag) {
  const p = [];
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2;
    const k = 1 + 0.17 * Math.sin(a * 3 + 1.1) + 0.1 * Math.sin(a * 5 + 2.3) + 0.05 * Math.sin(a * 11) + jag * (rnd() - 0.5);
    p.push(new THREE.Vector2(HX + Math.cos(a) * rx * k, HY + Math.sin(a) * ry * k));
  }
  return p;
}

// cracks spreading out from the hole, and a damp, dirty halo: a decal on the wall (transparent inside the hole)
function crackTexture(outline) {
  return canvasTex(1024, 1024, (x, w, h) => {
    const span = 2.6, px = (v) => [(v.x - HX) / span * w + w / 2, h / 2 - (v.y - HY) / span * h];
    const halo = x.createRadialGradient(w / 2, h / 2, 90, w / 2, h / 2, 470); halo.addColorStop(0, 'rgba(78,64,48,.42)'); halo.addColorStop(0.5, 'rgba(78,64,48,.16)'); halo.addColorStop(1, 'rgba(78,64,48,0)');
    x.fillStyle = halo; x.fillRect(0, 0, w, h);
    // fine hairline cracks, branching and tapering, a darker core with a faint lit lip below it
    const crack = (sx, sy, a, len, lw, depth) => {
      let cx = sx, cy = sy;
      for (let s = 0; s < len; s++) {
        a += (rnd() - 0.5) * 0.8; const nx = cx + Math.cos(a) * 9, ny = cy + Math.sin(a) * 9;
        x.lineCap = 'round';
        x.strokeStyle = 'rgba(245,238,226,.35)'; x.lineWidth = lw * 0.7; x.beginPath(); x.moveTo(cx, cy + 1.5); x.lineTo(nx, ny + 1.5); x.stroke();
        x.strokeStyle = 'rgba(28,22,17,.85)'; x.lineWidth = lw; x.beginPath(); x.moveTo(cx, cy); x.lineTo(nx, ny); x.stroke();
        cx = nx; cy = ny; lw = Math.max(0.6, lw * 0.95);
        if (depth < 2 && rnd() < 0.07) crack(cx, cy, a + (rnd() - 0.5) * 1.6, len - s, lw * 0.7, depth + 1);
      }
    };
    for (let k = 0; k < 9; k++) { const v = outline[Math.floor(k / 9 * outline.length)], [a, b] = px(v); const ang = Math.atan2(b - h / 2, a - w / 2); crack(a, b, ang, 16 + Math.floor(rnd() * 22), 3.2, 0); }
    // chipped plaster around the rim: a slightly rougher, paler rim of broken skim coat
    x.save(); x.beginPath(); outline.forEach((v, i) => { const [a, b] = px(v); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath();
    x.strokeStyle = 'rgba(40,32,25,.55)'; x.lineWidth = 5; x.stroke();
    x.globalCompositeOperation = 'destination-out'; x.fill(); x.restore();
  });
}

// a linen curtain that stirs in the air from the window (vertex sway driven by the film clock)
const sway = { value: 0 };
function linen() {
  const m = surface('rough_linen', 2, { color: 0xf3ece0, transparent: true, opacity: 0.8, side: THREE.DoubleSide, roughness: 1 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSway = sway;
    sh.vertexShader = 'uniform float uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float hang = (1.0 - uv.y);
      transformed.z += sin(position.x * 16.0) * 0.04 + sin(position.x * 5.0 + uSway * 0.8) * 0.025 * hang;`);
  };
  return m;
}

export const maintenance = {
  id: 'maintenance', name: 'MAINTENANCE', accent: C.greenText, glow: 'rgba(1,166,82,.16)',
  tagline: 'We keep it <b>perfect</b>',
  full: true,
  // the way in from the city (main.js): the window sits in the plane dot(n, p) = d, between span[0]..span[1] along
  // the wall and y[0]..y[1] above the floor; everything on the far side of that plane is cut away while seen from outside
  door: { n: [0, 0, 1], d: 5.5, span: [-3.2, 3.2], y: [0.15, 2.6] },
  shots: () => SHOT, view: () => V,
  html: () => '<canvas class="room"></canvas><div class="shade top"></div><div class="shade bottom"></div>',

  async init(el, { portrait, record }) {
    V = await makeView(el.querySelector('canvas.room'), { portrait, record, env: 'lebombo', envIntensity: 0.35, bloom: 0.16 });
    const { scene } = V;
    scene.background = new THREE.Color(0x07080a);
    SHOT = portrait
      ? [{ x: 1.25, y: 1.45, z: 4.7, tx: -0.55, ty: 1.12, tz: -2.2 }, { x: 0.75, y: 1.38, z: 3.55, tx: -0.45, ty: 1.12, tz: -2.2 }]
      : [{ x: 1.7, y: 1.6, z: 4.7, tx: 1.45, ty: 1.2, tz: -2.0 }, { x: 1.15, y: 1.5, z: 3.6, tx: 1.3, ty: 1.22, tz: -2.0 }];
    Object.assign(rig, SHOT[0]);
    const mesh = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; };

    // --- materials: grimy plaster, oak floor, white painted trim
    const wallMatBox = grime(surface('plastered_wall', 2, { color: 0xf0e9de, roughness: 0.93 }));
    const floorMat = grime(surface('wood_floor', 3, { color: 0xc49a74, envMapIntensity: 0.55 }));
    const trim = new THREE.MeshStandardMaterial({ color: 0xeee9e0, roughness: 0.45 });
    const box = (w, h, d, x, y, z, m = wallMatBox) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);

    // --- the shell. The back wall is a real skim of plaster with a hole broken through it; bricks behind.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW, 2 * HD + 3), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.z = 1.5; floor.receiveShadow = true; scene.add(floor);
    const outline = holeOutline(0.5, 0.38, 0.1);
    const PL = 0.035;                                    // plaster thickness
    // the plaster face: a finely divided plane with the hole cut out by a mask (a big extruded shape shades badly
    // under ambient occlusion), and the broken edge of the plaster as a strip around the hole
    const mask = (inside) => { const t = canvasTex(2048, 850, (x, w, h) => {
      x.fillStyle = inside ? '#000' : '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = inside ? '#fff' : '#000';
      x.beginPath(); outline.forEach((v, i) => { const a = (v.x + HW) / (2 * HW) * w, b = h - v.y / H * h; i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); x.fill(); });
      t.colorSpace = THREE.NoColorSpace; return t; };
    const faceMat = grime(surface('plastered_wall', 2, { color: 0xf0e9de, roughness: 0.93, alphaMap: mask(false), alphaTest: 0.5 }));
    mesh(new THREE.PlaneGeometry(2 * HW, H, 56, 24), faceMat, 0, H / 2, -HD);
    const edge = [];
    for (let i = 0; i < outline.length; i++) { const a = outline[i], b = outline[(i + 1) % outline.length];
      edge.push(a.x, a.y, -HD, b.x, b.y, -HD, b.x, b.y, -HD - PL, a.x, a.y, -HD, b.x, b.y, -HD - PL, a.x, a.y, -HD - PL); }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3)); eg.computeVertexNormals();
    mesh(eg, new THREE.MeshStandardMaterial({ color: 0xc9bfae, roughness: 1, side: THREE.DoubleSide }), 0, 0, 0);
    box(2 * HW, H, 0.2, 0, H / 2, -HD - PL - 0.16, new THREE.MeshStandardMaterial({ color: 0x3a3029, roughness: 1 }));   // the blockwork behind
    // mortar bed and running-bond bricks, only where the hole shows them (a few loose, broken, sunk deeper)
    mesh(new THREE.PlaneGeometry(1.8, 1.4), new THREE.MeshStandardMaterial({ color: 0x8b8274, roughness: 1, normalMap: tex('assets/tex3d/plastered_wall/nor_gl.jpg', 2) }), HX, HY, -HD - PL - 0.035, false);
    const bw = 0.215, bh = 0.065, gap = 0.011, bricks = [];
    for (let r = 0; r < 18; r++) for (let c = -5; c <= 5; c++) {
      const y = HY - 0.62 + r * (bh + gap), x = HX + c * (bw + gap) + (r % 2 ? (bw + gap) / 2 : 0);
      if (Math.abs(x - HX) > 0.8 || Math.abs(y - HY) > 0.62) continue;
      const broken = rnd() < 0.12, sunk = rnd() < 0.18;
      bricks.push({ x, y, z: -HD - PL - 0.014 - (sunk ? 0.012 + rnd() * 0.02 : rnd() * 0.004), s: broken ? 0.45 + rnd() * 0.35 : 1, ry: (rnd() - 0.5) * 0.03 });
    }
    const brickTex = tex('assets/tex3d/red_brick_03/diffuse.jpg', 0.09, true);                  // a small patch of real brick per face
    const brickMat = grime(new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.95, normalMap: tex('assets/tex3d/red_brick_03/nor_gl.jpg', 0.09), normalScale: new THREE.Vector2(1.5, 1.5) }));
    const bi = new THREE.InstancedMesh(new RoundedBoxGeometry(bw, bh, 0.1, 2, 0.006), brickMat, bricks.length);
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    bricks.forEach((b, i) => {
      q.setFromEuler(new THREE.Euler(0, b.ry, (rnd() - 0.5) * 0.02)); sc.set(b.s, 1, 1);
      mx.compose(new THREE.Vector3(b.x, b.y, b.z - 0.05), q, sc); bi.setMatrixAt(i, mx);
      const t = rnd(); bi.setColorAt(i, new THREE.Color().setRGB(0.9 + 0.35 * t, 0.82 + 0.28 * t, 0.76 + 0.24 * t).convertSRGBToLinear());
    });
    bi.castShadow = bi.receiveShadow = true; scene.add(bi);
    // the cracks and damp halo around the hole
    F.cracks = mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshStandardMaterial({ map: crackTexture(outline), transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), HX, HY, -HD + 0.001, false);
    // the repair: a fresh plaster plug, cut to the hole, same wall surface (it grows out from the middle)
    const pw = 1.4, ph = 1.1, plugGeo = new THREE.PlaneGeometry(pw, ph, 8, 8), puv = plugGeo.attributes.uv, ppos = plugGeo.attributes.position;
    for (let i = 0; i < puv.count; i++) puv.setXY(i, (HX + ppos.getX(i) + HW) / (2 * HW), (HY + ppos.getY(i)) / H);   // the wall's own mapping
    F.plug = mesh(plugGeo, grime(surface('plastered_wall', 2, { color: 0xf0e9de, roughness: 0.93, alphaMap: mask(true), alphaTest: 0.5 })), HX, HY, -HD + 0.0004);
    // rubble: plaster chips and brick fragments on the floor under the hole, which fly back into it
    const chipGeo = new THREE.DodecahedronGeometry(1, 0), frags = [];
    const chipMat = new THREE.MeshStandardMaterial({ color: 0xb9b0a1, roughness: 0.95 }), fragMat = new THREE.MeshStandardMaterial({ color: 0x7a4030, roughness: 0.9 });
    for (const [n, mat, big] of [[46, chipMat, 0.028], [18, fragMat, 0.04]]) {
      const im = new THREE.InstancedMesh(chipGeo, mat, n); im.castShadow = im.receiveShadow = true; scene.add(im);
      for (let i = 0; i < n; i++) {
        const s = big * (0.3 + rnd() * rnd() * 1.4), a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.55;
        frags.push({ im, i, s: new THREE.Vector3(s * (1 + rnd() * 0.8), s * (0.45 + rnd() * 0.4), s * (1 + rnd() * 0.6)),
          home: new THREE.Vector3(HX + Math.cos(a) * d * 1.3, s * 0.4, -HD + 0.1 + Math.abs(Math.sin(a)) * d * 0.9),
          wall: new THREE.Vector3(HX + (rnd() - 0.5) * 0.8, HY + (rnd() - 0.5) * 0.55, -HD - 0.01),
          rot: new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3), delay: rnd() * 0.35 });
      }
    }
    F.frags = frags;
    // fine plaster dust fanned out on the floor
    const dustTex = blobTex(256, (u, v, r, n) => [228, 222, 210, Math.max(0, (1 - r) * 1.6 * sstep(0.35, 0.75, n + (1 - r) * 0.35) - 0.05) * 90]);
    F.powder = mesh(new THREE.PlaneGeometry(1.9, 1.3), new THREE.MeshStandardMaterial({ map: dustTex, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), HX, 0.002, -HD + 0.55, false);
    F.powder.rotation.x = -Math.PI / 2;

    // right wall, ceiling, left wall around the window
    box(0.2, H, 2 * HD + 3, HW + 0.1, H / 2, 1.5);
    box(0.2, 0.95, 2.2, -HW - 0.1, 0.475, -0.8); box(0.2, 0.55, 2.2, -HW - 0.1, H - 0.275, -0.8);
    box(0.2, H, HD - 1.9 + 0.001, -HW - 0.1, H / 2, -HD + (HD - 1.9) / 2); box(0.2, H, 5.45, -HW - 0.1, H / 2, 3.025);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW, 2 * HD + 3), grime(new THREE.MeshStandardMaterial({ color: 0xefebe4, roughness: 0.95 })));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, 1.5); ceil.receiveShadow = ceil.castShadow = true; ceil.material.shadowSide = THREE.DoubleSide; scene.add(ceil);
    // skirting and a stepped crown moulding round the room
    for (const [w, d, x, z, ry] of [[2 * HW, 0, 0, -HD, 0], [2 * HD + 3, 0, HW, 1.5, -Math.PI / 2], [2 * HD + 3, 0, -HW, 1.5, Math.PI / 2]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
      const add = (bw2, bh2, bd, y, zz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw2, bh2, bd), trim); m.position.set(0, y, zz); m.castShadow = m.receiveShadow = true; g.add(m); };
      add(w, 0.1, 0.018, 0.05, 0.009); add(w, 0.012, 0.024, 0.104, 0.012);
      add(w, 0.06, 0.02, H - 0.03, 0.01); add(w, 0.035, 0.045, H - 0.075, 0.022); add(w, 0.018, 0.065, H - 0.1, 0.032);
    }
    // window: frame, mullions, sill, glass, and Muscat outside (a still from the Tamlik tower film)
    const frame = new THREE.MeshStandardMaterial({ color: 0xe4e0d8, roughness: 0.4 });
    for (const [y, h] of [[0.97, 0.05], [2.33, 0.05]]) box(0.12, h, 2.2, -HW - 0.02, y, -0.8, frame);
    for (const z of [-1.88, -0.8, 0.28]) box(0.12, 1.4, 0.05, -HW - 0.02, 1.65, z, frame);
    box(0.08, 0.03, 1.2, -HW - 0.02, 1.65, -1.34, frame);
    box(0.24, 0.035, 2.35, -HW + 0.05, 0.93, -0.8, new THREE.MeshStandardMaterial({ map: tex('assets/tex3d/marble_01/diffuse.jpg', 1, true), roughness: 0.25 }));
    mesh(new THREE.PlaneGeometry(2.15, 1.35), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.08, envMapIntensity: 1.2 }), -HW - 0.03, 1.65, -0.8, false).rotation.y = Math.PI / 2;
    const view = tex('assets/posts/film_0.1.jpg', 1, true); view.wrapS = view.wrapT = THREE.ClampToEdgeWrapping;
    F.sky = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: view, toneMapped: false }));
    F.sky.rotation.y = Math.PI / 2; F.sky.position.set(-HW - 3.2, 1.3, -0.8); scene.add(F.sky);
    // sheer curtains either side, on a rail
    const lin = linen();
    for (const [z, w] of [[-2.2, 0.9], [0.62, 0.95]]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(w, H - 0.2, 50, 6), lin); c.rotation.y = Math.PI / 2; c.position.set(-HW + 0.14, (H - 0.2) / 2 + 0.02, z); c.castShadow = true; scene.add(c); }
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.6, 10), new THREE.MeshStandardMaterial({ color: 0x2a2826, metalness: 0.8, roughness: 0.35 }), -HW + 0.14, H - 0.16, -0.8).rotation.x = Math.PI / 2;

    // door (right wall, near the camera), light switch and sockets
    const doorG = new THREE.Group(); doorG.position.set(HW, 0, 1.0); doorG.rotation.y = -Math.PI / 2; scene.add(doorG);
    const wood = surface('walnut_veneer', 1, { roughness: 0.55 });
    const dAdd = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; doorG.add(o); return o; };
    dAdd(new THREE.BoxGeometry(0.92, 2.1, 0.045), wood, 0, 1.05, 0.01);
    for (const [w, h, x, y] of [[0.07, 2.18, -0.5, 1.09], [0.07, 2.18, 0.5, 1.09], [1.07, 0.07, 0, 2.18]]) dAdd(new THREE.BoxGeometry(w, h, 0.03), trim, x, y, 0.025);
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a86a, metalness: 1, roughness: 0.28 });
    dAdd(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 24), brass, 0.36, 1.02, 0.04).rotation.x = Math.PI / 2;
    dAdd(new THREE.BoxGeometry(0.13, 0.018, 0.018), brass, 0.31, 1.02, 0.065);
    const plastic = new THREE.MeshStandardMaterial({ color: 0xf1efea, roughness: 0.35 });
    const plate = (x, y, z, ry, two = false) => { const p = mesh(new RoundedBoxGeometry(two ? 0.146 : 0.086, 0.086, 0.012, 2, 0.004), plastic, x, y, z); p.rotation.y = ry;
      const s = mesh(new THREE.BoxGeometry(0.03, 0.04, 0.006), plastic, 0, 0, 0); p.add(s); s.position.set(0, 0, 0.008); return p; };
    plate(HW - 0.007, 1.2, 0.3, -Math.PI / 2); plate(-0.75, 0.3, -HD + 0.007, 0, true); plate(1.35, 0.3, -HD + 0.007, 0, true);

    // fault 4: the split air conditioner above the TV has failed. Its display blinks a red error code, the vent flap
    // hangs off one hinge, the casing rattles, and a brown condensate streak runs down the wall beneath it. Once the
    // scan line passes: the flap seats and starts to sweep, the display reads 22°, cool air flows out, the streak goes.
    const ac = new THREE.Group(); ac.position.set(ACX, ACY, -HD + 0.13); scene.add(ac); F.ac = ac;
    const acM = new THREE.MeshPhysicalMaterial({ color: 0xf4f3ef, roughness: 0.3, clearcoat: 0.4 });
    const acb = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.3, 0.22, 4, 0.05), acM); acb.castShadow = acb.receiveShadow = true; ac.add(acb);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.04), new THREE.MeshStandardMaterial({ color: 0x2b2c2e, roughness: 0.6 })); vent.position.set(0, -0.125, 0.085); ac.add(vent);
    const louvreM = new THREE.MeshStandardMaterial({ color: 0x3a3b3d, roughness: 0.6 });
    for (let i = 0; i < 9; i++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.028, 0.03), louvreM); v.position.set(-0.36 + i * 0.09, -0.125, 0.09); ac.add(v); }
    // the flap hinges on its left end (so it can hang off the right one)
    F.acFlapPivot = new THREE.Group(); F.acFlapPivot.position.set(-0.41, -0.14, 0.1); ac.add(F.acFlapPivot);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.006, 0.07), acM); flap.position.x = 0.41; flap.castShadow = true; F.acFlapPivot.add(flap);
    F.acDispTex = canvasTex(128, 48, (x, w, h, st = 'err', on = true) => {
      x.fillStyle = '#0b0d0e'; x.fillRect(0, 0, w, h);
      if (!on) return;
      x.font = '700 34px Manrope, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = st === 'err' ? '#ff3b30' : '#6fe3ff'; x.shadowColor = x.fillStyle; x.shadowBlur = 8;
      x.fillText(st === 'err' ? 'E4' : '22°', w / 2, h / 2 + 2);
    }, { live: true });
    F.acDisp = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.028), new THREE.MeshBasicMaterial({ map: F.acDispTex, toneMapped: false })); F.acDisp.position.set(0.33, -0.05, 0.111); ac.add(F.acDisp);
    F.acDispKey = '';
    const lineM = new THREE.MeshStandardMaterial({ color: 0xdcdad4 });
    for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.003, 0.003), lineM); l.position.set(-0.1, 0.06 - i * 0.02, 0.111); ac.add(l); }
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.012), new THREE.MeshStandardMaterial({ color: 0xb9b7b1, roughness: 0.4, metalness: 0.6 })); badge.position.set(-0.3, -0.05, 0.111); ac.add(badge);
    // the condensate streak: brown runs down the wall from the unit's underside
    F.acStreak = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.95), new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2,
      map: canvasTex(256, 320, (x, w, h) => {
        let sd = 5; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
        const g = x.createLinearGradient(0, 0, 0, 40); g.addColorStop(0, 'rgba(88,66,40,.55)'); g.addColorStop(1, 'rgba(88,66,40,0)');
        x.fillStyle = g; x.fillRect(20, 0, w - 40, 40);
        for (let i = 0; i < 7; i++) {
          const cx = 40 + r() * (w - 80), len = h * (0.35 + r() * 0.6), wd = 3 + r() * 6;
          const gr = x.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, 'rgba(92,70,44,.6)'); gr.addColorStop(0.8, 'rgba(92,70,44,.35)'); gr.addColorStop(1, 'rgba(92,70,44,0)');
          x.fillStyle = gr; x.beginPath(); x.moveTo(cx - wd / 2, 0);
          for (let y = 0; y <= len; y += 8) x.lineTo(cx - wd / 2 + Math.sin(y * 0.05 + i) * 3, y);
          for (let y = len; y >= 0; y -= 8) x.lineTo(cx + wd / 2 + Math.sin(y * 0.05 + i) * 3, y);
          x.fill(); x.beginPath(); x.arc(cx + Math.sin(len * 0.05 + i) * 3, len - 2, wd * 0.7, 0, 7); x.fill();
        }
      }) }));
    F.acStreak.position.set(ACX + 0.05, ACY - 0.62, -HD + 0.004); scene.add(F.acStreak);
    // cool air: soft ribbons flowing out and down from the vent (shader: drifting noise bands, fading with distance)
    F.airU = { uT: { value: 0 }, uOp: { value: 0 } };
    const airM = new THREE.ShaderMaterial({ uniforms: F.airU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uT, uOp; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          float d = 1.0 - vUv.y;                                      // 0 at the vent, 1 far out
          float band = n(vec2(vUv.x * 7.0, d * 3.0 - uT * 1.6)) * 0.6 + n(vec2(vUv.x * 15.0 + 3.0, d * 6.0 - uT * 2.4)) * 0.4;
          float a = smoothstep(0.3, 0.95, band) * (1.0 - d) * smoothstep(0.0, 0.08, d) * smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
          gl_FragColor = vec4(vec3(0.75, 0.9, 1.0), a * uOp * 0.11);
        }` });
    F.air = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.PlaneGeometry(0.78, 1.1, 1, 12); g.translate(0, -0.55, 0);
      const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const y = -p.getY(k); p.setZ(k, y * y * 0.55 + y * 0.35); }   // curling out and down
      const m = new THREE.Mesh(g, airM); m.position.set(ACX, ACY - 0.15, -HD + 0.25 + i * 0.02); m.rotation.x = -0.15 + i * 0.12; m.renderOrder = 6; scene.add(m); F.air.push(m);
    }

    // --- furniture: armchair by the window, sofa, a low TV cabinet with a flat screen, a round coffee table set
    // for tea, a clock, a picture that hangs askew, plants and a woven rug
    const put = async (name, x, z, ry = 0, s = 1, y = 0) => { const h = seat(noTransmission(await model(name)), s); h.position.set(x, y, z); h.rotation.y = ry; scene.add(h); return h; };
    await put('modern_arm_chair_01', -2.55, -1.55, 0.55);
    await put('side_table_01', -2.75, -2.3, 0.2);
    await put('potted_plant_02', -2.75, -2.3, 0, 0.62, 0.55);
    await put('potted_plant_01', -3.05, 0.9, 1.4, 1.15);
    const cab = await put('modern_wooden_cabinet', 0.25, -2.42, 0, 0.62);
    const ct = new THREE.Box3().setFromObject(cab).max.y;
    const tv = new THREE.Group(); tv.position.set(0.25, ct, -2.45); scene.add(tv);
    const tvBlack = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.4, metalness: 0.5 });
    const panel = new THREE.Mesh(new RoundedBoxGeometry(1.24, 0.72, 0.035, 2, 0.008), tvBlack); panel.position.y = 0.46; panel.castShadow = true; tv.add(panel);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.68), new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 })); scr.position.set(0, 0.46, 0.0181); tv.add(scr);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.2), tvBlack); foot.position.y = 0.006; tv.add(foot);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.03), tvBlack); neck.position.set(0, 0.06, -0.02); tv.add(neck);
    await put('ceramic_vase_03', -0.3, -2.45, 0, 1, ct);
    await put('brass_vase_01', 0.85, -2.47, 0, 0.55, ct);
    await put('sofa_02', 3.05, -0.2, -Math.PI / 2, 1.05);
    await put('throw_pillows_01', 3.1, -0.55, -Math.PI / 2, 0.75, 0.42);
    const tbl = await put('coffee_table_round_01', 1.45, 1.05, 0, 0.72);
    await put('tea_set_01', 1.45, 1.0, 0.6, 1, new THREE.Box3().setFromObject(tbl).max.y);
    F.clock = await put('wall_clock', 1.75, -HD + 0.005, 0, 1.1, 1.95);
    F.clock.rotation.x = 0;
    // a framed print of the Tamlik tower, hanging askew from its nail
    F.picPivot = new THREE.Group(); F.picPivot.position.set(-2.3, 2.2, -HD + 0.02); scene.add(F.picPivot);
    const art = new THREE.Group(); art.position.y = -0.46; F.picPivot.add(art);
    const oak = surface('walnut_veneer', 0.5, { color: 0x6b5847, roughness: 0.5 });
    for (const [w, h, x, y] of [[0.62, 0.035, 0, 0.4], [0.62, 0.035, 0, -0.4], [0.035, 0.835, -0.2925, 0], [0.035, 0.835, 0.2925, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), oak); b.position.set(x, y, 0.015); b.castShadow = true; art.add(b); }
    const mount = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.765), new THREE.MeshStandardMaterial({ color: 0xf1ede5, roughness: 0.9 })); mount.position.z = 0.008; art.add(mount);
    const print = tex('assets/posts/film_0.7.jpg', 1, true); print.wrapS = print.wrapT = THREE.ClampToEdgeWrapping; print.repeat.set(0.62, 1); print.offset.set(0.19, 0);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.6), new THREE.MeshPhysicalMaterial({ map: print, roughness: 0.3, clearcoat: 0.6 })); pic.position.z = 0.01; art.add(pic);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 1, roughness: 0.4 }));
    wire.rotation.z = Math.PI / 2; wire.position.set(0, 0.28, -0.005); art.add(wire);
    // a woven rug (drawn border pattern over the jute weave)
    const rugTex = canvasTex(1024, 768, (x, w, h) => {
      x.fillStyle = '#b39a7c'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#6f4b35'; x.lineWidth = 26; x.strokeRect(40, 40, w - 80, h - 80);
      x.strokeStyle = '#e6d8bf'; x.lineWidth = 8; x.strokeRect(78, 78, w - 156, h - 156);
      x.fillStyle = '#8a5d3f'; for (let i = 0; i < 26; i++) { const t = i / 25; for (const [a, b] of [[110 + t * (w - 220), 110], [110 + t * (w - 220), h - 110]]) { x.save(); x.translate(a, b); x.rotate(Math.PI / 4); x.fillRect(-9, -9, 18, 18); x.restore(); } }
      x.strokeStyle = 'rgba(111,75,53,.55)'; x.lineWidth = 5; x.beginPath(); x.moveTo(w / 2, 170); x.lineTo(w - 260, h / 2); x.lineTo(w / 2, h - 170); x.lineTo(260, h / 2); x.closePath(); x.stroke();
    });
    const rugM = new THREE.MeshStandardMaterial({ map: rugTex, normalMap: tex('assets/tex3d/hessian_230/nor_gl.jpg', 6), roughness: 1 });
    const rug = mesh(new RoundedBoxGeometry(2.6, 0.012, 1.9, 1, 0.004), rugM, 1.55, 0.006, 0.2, false); rug.receiveShadow = true;

    // --- fault 2: the broken pendant, hanging crooked, sparking, flickering
    F.lampPivot = new THREE.Group(); F.lampPivot.position.set(LX, H, LZ); scene.add(F.lampPivot);
    const lamp = seat(await model('modern_ceiling_lamp_01'), 1.15);
    const lb = new THREE.Box3().setFromObject(lamp); lamp.position.y = -(lb.max.y - lb.min.y); F.lampPivot.add(lamp);
    F.bulb = new THREE.PointLight(0xffc98a, 0, 9, 1.6); F.bulb.position.set(0, -(lb.max.y - lb.min.y) + 0.12, 0);
    F.bulb.castShadow = record; F.bulb.shadow.mapSize.set(1024, 1024); F.bulb.shadow.bias = -0.002;
    F.lampPivot.add(F.bulb);
    F.glowBulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd7a0, toneMapped: false }));
    F.glowBulb.position.copy(F.bulb.position); F.lampPivot.add(F.glowBulb);
    // sparks: a burst of hot points (positions computed in the shader from seeded velocities)
    const N = 70, sp = new Float32Array(N * 3), vel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const a = rnd() * Math.PI * 2, u = rnd(); vel.set([Math.cos(a) * (0.4 + u), 0.2 + rnd() * 1.4, Math.sin(a) * (0.4 + u)], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('vel', new THREE.BufferAttribute(vel, 3));
    F.sparkU = { uT: { value: 0 }, uOn: { value: 1 } };
    F.sparks = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: F.sparkU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 vel; uniform float uT; varying float vA;
        void main(){ vec3 p = position + vel * uT * 0.9 + vec3(0.0, -2.6, 0.0) * uT * uT; vA = (1.0 - uT);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (2.0 + 4.0 * vA) * (4.0 / -mv.z); }`,
      fragmentShader: `uniform float uOn; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
          gl_FragColor = vec4(vec3(1.0, 0.72, 0.32) * 3.0, (1.0 - d * 2.0) * vA * uOn); }` }));
    F.sparks.position.copy(F.bulb.position); F.sparks.frustumCulled = false; F.lampPivot.add(F.sparks);

    // --- fault 3: the leak: a spreading, uneven water stain on the ceiling, drips into a bucket, a puddle, a sign
    const stainTex = blobTex(512, (u, v, r, n) => {
      const f = n * 1.15 - r * 0.85;                                   // uneven extent
      const inside = sstep(-0.02, 0.06, f), tide = Math.exp(-Math.pow((f - 0.02) / 0.025, 2));
      const inner = Math.exp(-Math.pow((f - 0.14) / 0.02, 2)) * 0.5;
      return [118, 90, 52, Math.min(255, (inside * 0.16 + tide * 0.55 + inner * 0.3) * 255)];
    }, 3);
    F.stain = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshStandardMaterial({ map: stainTex, roughness: 1, transparent: true, depthWrite: false }));
    F.stain.rotation.x = Math.PI / 2; F.stain.position.set(WX, H - 0.004, WZ); scene.add(F.stain);
    F.bucket = seat(await model('wooden_bucket_02'), 0.62); F.bucket.position.set(WX, 0, WZ); scene.add(F.bucket);
    F.sign = await put('WetFloorSign_01', WX + 0.75, WZ + 0.1, -0.5, 1.0);
    const puddleTex = blobTex(512, (u, v, r, n) => { const f = n * 1.2 - r * 0.9; const a = sstep(0.0, 0.05, f); return [255, 255, 255, a * 255]; }, 11);
    const water = new THREE.MeshPhysicalMaterial({ color: 0x252a2e, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.42, alphaMap: puddleTex, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    F.puddle = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2), water); F.puddle.rotation.x = -Math.PI / 2; F.puddle.position.set(WX + 0.3, 0.003, WZ + 0.35); scene.add(F.puddle);
    const dropMat = new THREE.MeshPhysicalMaterial({ color: 0xdfeaf2, roughness: 0.02, transmission: 0, transparent: true, opacity: 0.5, envMapIntensity: 2.5 });
    const dropGeo = new THREE.SphereGeometry(0.014, 14, 10); dropGeo.scale(1, 1.6, 1);
    for (let i = 0; i < 3; i++) { const d = new THREE.Mesh(dropGeo, dropMat.clone()); d.position.set(WX + (i - 1) * 0.02, H - 0.02, WZ); scene.add(d); drips.push(d); }
    // a bead of water gathering where it drips from
    F.bead = mesh(new THREE.SphereGeometry(0.018, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), dropMat.clone(), WX, H - 0.002, WZ, false);
    const bucketTop = new THREE.Box3().setFromObject(F.bucket).max.y - 0.06;
    F.bucketTop = bucketTop;
    const waterIn = mesh(new THREE.CircleGeometry(0.19, 40), new THREE.MeshPhysicalMaterial({ color: 0x3c4750, roughness: 0.03, clearcoat: 1, envMapIntensity: 1.6 }), 0, bucketTop - 0.02, 0, false); waterIn.rotation.x = -Math.PI / 2; F.bucket.add(waterIn);
    // the bucket and the sign are taken away once the leak is fixed
    F.away = [reveal(F.bucket, { color: 0x5dffb0, glow: 4 }), reveal(F.sign, { color: 0x5dffb0, glow: 4 })];
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.026, 32), new THREE.MeshBasicMaterial({ color: 0xdfefff, transparent: true, opacity: 0, depthWrite: false }));
      r.rotation.x = -Math.PI / 2; r.position.set(WX, bucketTop - 0.015, WZ); scene.add(r); ripples.push(r); }
    // splash: a crown of tiny droplets thrown up at each impact
    const NS = 14, spp = new Float32Array(NS * 3), sv = new Float32Array(NS * 3);
    for (let i = 0; i < NS; i++) { const a = i / NS * Math.PI * 2 + rnd() * 0.3; sv.set([Math.cos(a) * (0.25 + rnd() * 0.2), 0.5 + rnd() * 0.5, Math.sin(a) * (0.25 + rnd() * 0.2)], i * 3); }
    const spg = new THREE.BufferGeometry(); spg.setAttribute('position', new THREE.BufferAttribute(spp, 3)); spg.setAttribute('vel', new THREE.BufferAttribute(sv, 3));
    for (let i = 0; i < 3; i++) {
      const u = { uT: { value: 1 } };
      const p = new THREE.Points(spg, new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false,
        vertexShader: `attribute vec3 vel; uniform float uT; varying float vA;
          void main(){ vec3 p = position + vel * uT * 0.35 + vec3(0.0, -4.9, 0.0) * uT * uT * 0.35; vA = 1.0 - uT;
            vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 2.5 * (4.0 / -mv.z); }`,
        fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5 || vA <= 0.0) discard; gl_FragColor = vec4(0.85, 0.9, 0.95, vA * 0.8); }` }));
      p.position.set(WX, bucketTop - 0.015, WZ); p.frustumCulled = false; scene.add(p); splashes.push(u.uT); (F.splash ||= []).push(p);
    }

    // --- the repair kit, set down around the room (built up from the floor behind a green line)
    const kit = async (name, x, z, ry, s = 1, y = 0, rx = 0, rz = 0) => { const h = seat(noTransmission(await model(name)), s); h.position.set(x, y, z); h.rotation.set(rx, ry, rz); scene.add(h); tools.push({ h, u: reveal(h, { color: 0x5dffb0, glow: 4 }) }); return h; };
    await kit('ladder_sectioned_01', 0.72, -1.72, -0.35, 1.0, 0, -0.2);
    const cart = await kit('tool_cart', -0.55, 0.15, 0.45, 0.8);
    const cartTop = new THREE.Box3().setFromObject(cart).max.y;
    await kit('metal_toolbox', -0.5, 0.2, 0.5, 1.05, cartTop - 0.005);
    await kit('retro_multimeter', -0.82, -0.02, 0.9, 0.7, cartTop - 0.005);
    await kit('Drill_01', -0.2, 0.42, 1.2, 1.2, cartTop - 0.005);
    await kit('screwdriver', -0.1, 0.62, 0.3, 1.1, 0.012, 0, Math.PI / 2);
    await kit('pliers', 0.12, 0.55, 0.9, 1.1, 0.01, -Math.PI / 2);
    await kit('measuring_tape_01', -1.0, 0.55, 0.4, 1.1);
    await kit('cement_bag', -1.75, -1.55, 0.35, 0.9);
    await kit('trowel_01', -1.35, -1.35, 1.1, 1.0);

    // --- diagnosis markers at each fault, and the green scan line
    for (const [x, y, z, lbl] of [[HX, HY, -HD + 0.25, 'Wall damage'], [LX, 2.05, LZ, 'Electrical fault'], [WX, 1.15, WZ, 'Water leak']]) { const h = holoRing(0.3, lbl); h.position.set(x, y, z); scene.add(h); holos.push(h); }
    // the AC's marker is smaller, and its label sits under the unit (to its right is the frame edge, to its left the lamp)
    { const h = holoRing(0.22, 'AC fault'); h.position.set(ACX, ACY - 0.02, -HD + 0.35); h.userData.tag.position.set(0, -0.36, 0); scene.add(h); holos.push(h); }
    F.scan = new THREE.Mesh(new THREE.PlaneGeometry(0.05, H), new THREE.MeshBasicMaterial({ color: 0x5dffb0, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    const scanWall = new THREE.Mesh(new THREE.PlaneGeometry(2 * HD + 1, H), new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending }));
    scanWall.rotation.y = Math.PI / 2; scanWall.position.set(0, H / 2, 0);
    F.scanG = new THREE.Group(); F.scanG.add(scanWall); scene.add(F.scanG);
    for (const [y, z] of [[0.01, 0], [H - 0.01, 0]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 2 * HD + 1), new THREE.MeshBasicMaterial({ color: 0x7dffc2, toneMapped: false })); l.position.set(0, y, z); F.scanG.add(l); }
    const bk = new THREE.Mesh(new THREE.BoxGeometry(0.012, H, 0.012), new THREE.MeshBasicMaterial({ color: 0x7dffc2, toneMapped: false })); bk.position.set(0, H / 2, -HD + 0.02); F.scanG.add(bk);
    F.scanLight = new THREE.PointLight(0x39ff9a, 0, 5, 1.5); F.scanLight.position.set(0, 1.4, -1); F.scanG.add(F.scanLight);

    // --- light: overcast grey daylight while broken; clean, low sun through the window once it's fixed
    F.hemi = new THREE.HemisphereLight(0xcfd9ea, 0x2b2621, 0.4); scene.add(F.hemi);
    F.sun = new THREE.DirectionalLight(0xdce8ff, 1.1); F.sun.position.set(-8, 6.5, 2.2); F.sun.target.position.set(0, 0, -0.6);
    F.sun.castShadow = true; F.sun.shadow.mapSize.set(record ? 4096 : 2048, record ? 4096 : 2048); F.sun.shadow.bias = -0.0004; F.sun.shadow.normalBias = 0.03;
    Object.assign(F.sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 25 });
    scene.add(F.sun, F.sun.target);
    F.fill = new THREE.PointLight(0xffd6a8, 0, 12, 1.2); F.fill.position.set(0.5, 2.6, 1.5); scene.add(F.fill);
    // the sunbeam through the window, and the dust drifting in it
    F.shaft = shaft(new THREE.Vector3(-HW - 0.1, 1.65, -0.8), new THREE.Vector3(-0.6, 0.0, -0.6), 2.1, 1.35, { opacity: 0 });
    scene.add(F.shaft);
    F.dust = dust(scene, { min: new THREE.Vector3(-3.3, 0.1, -2.2), max: new THREE.Vector3(0.6, 2.6, 0.9), count: 500, size: 0.01, opacity: 0.3 });

    F.dustPts = scene.children[scene.children.length - 1];
    // the AO pass draws every object as solid: keep the light effects (beam, dust, markers, scan, sparks, water)
    // out of it, or the invisible beam box casts a hard diagonal "shadow" across the wall
    const airy = [F.shaft, F.dustPts, ...holos, F.scanG, F.sparks, ...drips, ...ripples, ...F.splash, F.sky, ...F.air];
    const aoRender = V.ao.render.bind(V.ao);
    V.ao.render = (...a) => { const was = airy.map((o) => o.visible); airy.forEach((o) => { o.visible = false; }); aoRender(...a); airy.forEach((o, i) => { o.visible = was[i]; }); };
    await ready();
    // reflections that match the room, captured in its finished state (clean, sunlit, lamp on)
    Object.assign(S, { dirt: 0, warm: 1, lamp: 1, flick: 1, plug: 1, fly: 1, scanOn: 0, sparkOn: 0, expo: 1.0, acFix: 1 });
    this.render(true);
    bakeEnv(V, new THREE.Vector3(0.6, 1.3, 0.4), { intensity: 0.4, hide: [...holos, F.scanG, F.sparks, F.shaft, F.cracks, F.powder, F.puddle, F.stain, ...tools.map((t) => t.h), F.bucket, F.sign, F.acStreak, ...F.air] });
    Object.assign(S, { dirt: 1, warm: 0, lamp: 0, flick: 0.15, plug: 0, fly: 0, sparkOn: 1, expo: 0.74, acFix: 0, air: 0 });
    V.renderer.compile(scene, V.camera);
  },

  // ~14 s: the problems, the diagnosis, the kit, the scan line fixing everything, a warm clean room
  animate(tl, el, T) {
    const at = (t) => T + t;
    const scanX = (x) => 6200 + ((x + HW + 0.7) / (2 * HW + 1.4)) * 3600;    // when the scan line passes x
    // start state: everything broken
    tl.set(S, { dirt: 1, warm: 0, flick: 0.15, lamp: 0, scan: -HW - 0.7, scanOn: 0, sparkOn: 1, fly: 0, plug: 0, expo: 0.74, acFix: 0, air: 0 }, 0)
      .set(F.acStreak.material, { opacity: 1 }, 0)
      .set(rig, { ...SHOT[0] }, 0)
      .set(F.cracks.material, { opacity: 1 }, 0).set(F.powder.material, { opacity: 1 }, 0).set(F.stain.material, { opacity: 1 }, 0)
      .set(F.puddle.material, { opacity: 0.42 }, 0).set(F.puddle.scale, { x: 1, y: 1 }, 0)
      .set(F.bead.scale, { x: 1, y: 1, z: 1 }, 0)
      .set(F.lampPivot.rotation, { z: 0.42, x: 0.12 }, 0).set(F.picPivot.rotation, { z: 0.11 }, 0)
      .set(tools.map((t) => t.u), { value: 0 }, 0).set(F.away, { value: 1 }, 0)
      .set(holos.map((h) => h.scale), { x: 1, y: 1, z: 1 }, 0)
      .set(splashes, { value: 1 }, 0);
    holos.forEach((h) => tl.set([h.userData.ring.material, h.userData.ring2.material, h.userData.tag.material], { opacity: 0 }, 0)
      .set(h.userData.check.material, { opacity: 0 }, 0).set(h.userData.ring.scale, { x: 1, y: 1 }, 0).set(h.userData.ring2.scale, { x: 1, y: 1 }, 0));
    tl.set(drips.map((d) => d.material), { opacity: 0.5 }, 0);

    tl.add(rig, { ...shotTween(SHOT[0], SHOT[1]), duration: this.len, ease: 'inOutSine' }, at(0));

    // 1. the problems: the lamp swings and flickers and sparks, water drips, ripples in the bucket
    tl.add(F.lampPivot.rotation, { z: [0.42, 0.3, 0.42], duration: 1800, loop: 3, ease: 'inOutSine' }, at(0))
      .add(S, { flick: [0.15, 0.9, 0.05, 0.6, 0.02, 0.85, 0.1, 0.4, 0.02, 0.7, 0.05], duration: 1500, loop: 4, ease: 'linear' }, at(0));
    [300, 1500, 2400, 3900, 5100, 6600].forEach((t) => tl.add(F.sparkU.uT, { value: [0, 1], duration: 520, ease: 'outQuad' }, at(t)));
    const fixLeak = scanX(WX);
    const nDrip = Math.floor((fixLeak - 800) / 1300), nRip = Math.floor((fixLeak - 1200) / 1300);
    drips.forEach((d, i) => tl.add(d.position, { y: [H - 0.02, F.bucketTop - 0.01], duration: 640, loop: nDrip, loopDelay: 660, ease: 'inQuad' }, at(200 + i * 430)));
    ripples.forEach((r, i) => tl.add(r.scale, { x: [1, 7], y: [1, 7], duration: 900, loop: nRip, loopDelay: 400, ease: 'outQuad' }, at(840 + i * 430))
      .add(r.material, { opacity: [0.7, 0], duration: 900, loop: nRip, loopDelay: 400 }, at(840 + i * 430))
      .add(splashes[i], { value: [0, 1], duration: 450, loop: nRip, loopDelay: 850, ease: 'linear' }, at(840 + i * 430)));

    // 2. diagnosis: a fine green marker locks onto each fault (fades in, the ring draws out to size)
    holos.forEach((h, i) => tl.add([h.userData.ring.material, h.userData.ring2.material], { opacity: [0, 0.9], duration: 500 }, at(4100 + i * 260))
      .add(h.userData.ring2.scale, { x: [1.35, 1], y: [1.35, 1], duration: 700, ease: 'outCubic' }, at(4100 + i * 260))
      .add(h.userData.tag.material, { opacity: [0, 1], duration: 400 }, at(4400 + i * 260))
      .add(h.userData.ring.scale, { x: [1, 1.06, 1], y: [1, 1.06, 1], duration: 900, loop: 3, ease: 'inOutSine' }, at(4800 + i * 260)));

    // 3. the Tamlik kit is set down: each piece builds up from the floor behind a green line
    tools.forEach((t, i) => tl.add(t.u, { value: [0, 1], duration: 700, ease: 'inOutSine' }, at(5000 + i * 90)));

    // 4. the scan line sweeps the room, fixing everything it passes
    tl.add(S, { scanOn: [0, 1], duration: 300 }, at(6000))
      .add(S, { scan: [-HW - 0.7, HW + 0.7], duration: 3600, ease: 'inOutSine' }, at(6200))
      .add(S, { scanOn: [1, 0], duration: 400 }, at(9800))
      .add(S, { dirt: [1, 0], duration: 3600, ease: 'inOutSine' }, at(6200));
    const confirm = (h, t) => tl.add(h.userData.ring.scale, { x: [1, 1.5], y: [1, 1.5], duration: 600, ease: 'outCubic' }, at(t))
      .add(h.userData.ring.material, { opacity: [0.9, 0.2], duration: 600 }, at(t))
      .add(h.userData.check.material, { opacity: [0, 1], duration: 350 }, at(t + 150));
    // the wall: rubble flies back into the hole, fresh plaster seals it, the cracks and dust go
    const tw = scanX(HX);
    tl.add(S, { fly: [0, 1], duration: 900, ease: 'inOutQuad' }, at(tw - 250))
      .add(S, { plug: [0, 1], duration: 800, ease: 'outCubic' }, at(tw + 300))
      .add([F.cracks.material, F.powder.material], { opacity: [1, 0], duration: 800, ease: 'inOutSine' }, at(tw + 300));
    confirm(holos[0], tw + 500);
    // the picture straightens as the line passes
    tl.add(F.picPivot.rotation, { z: [0.11, 0], duration: 900, ease: 'outCubic' }, at(scanX(-2.3) - 150));
    // the lamp: swings straight, sparks stop, light on
    const tlp = scanX(LX);
    tl.add(F.lampPivot.rotation, { z: [0.42, 0], x: [0.12, 0], duration: 1100, ease: 'outCubic' }, at(tlp))
      .add(S, { sparkOn: [1, 0], duration: 200 }, at(tlp))
      .add(S, { lamp: [0, 1], flick: [0.3, 1], duration: 500 }, at(tlp + 300));
    confirm(holos[1], tlp + 400);
    // the leak: drips stop, the stain fades, the puddle dries from its edges
    tl.add(drips.map((d) => d.material), { opacity: 0, duration: 200 }, at(fixLeak))
      .add(F.bead.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 300 }, at(fixLeak))
      .add(F.stain.material, { opacity: [1, 0], duration: 900 }, at(fixLeak))
      .add(F.puddle.scale, { x: [1, 0.35], y: [1, 0.35], duration: 1200, ease: 'inQuad' }, at(fixLeak + 100))
      .add(F.puddle.material, { opacity: [0.42, 0], duration: 1200, ease: 'inQuad' }, at(fixLeak + 100));
    confirm(holos[2], fixLeak + 300);
    // the AC: the flap seats and starts to sweep, the display reads 22°, cool air flows, the streak is wiped away
    const tac = scanX(ACX);
    tl.add(S, { acFix: [0, 1], duration: 700, ease: 'outCubic' }, at(tac))
      .add(S, { air: [0, 1], duration: 1600, ease: 'inOutSine' }, at(tac + 500))
      .add(F.acStreak.material, { opacity: [1, 0], duration: 900, ease: 'inOutSine' }, at(tac + 100));
    confirm(holos[3], tac + 900);                                            // after the leak's chime, not on top of it

    // 5. the sun comes out, the room warms, the kit and the markers clear away
    tl.add(S, { warm: [0, 1], expo: [0.74, 1.0], duration: 2600, ease: 'inOutSine' }, at(8800))
      .add(tools.map((t) => t.u), { value: [1, 0], duration: 600, delay: stagger(60), ease: 'inOutSine' }, at(11200))
      .add(F.away, { value: [1, 0], duration: 700, delay: stagger(120), ease: 'inOutSine' }, at(10300));
    holos.forEach((h, i) => tl.add([h.userData.ring.material, h.userData.ring2.material, h.userData.check.material, h.userData.tag.material], { opacity: 0, duration: 500 }, at(12000 + i * 120)));
    return { tagAt: at(10500) };
  },

  render(bake = false) {
    if (!V) return;
    place(V, rig, bake ? 0 : 0.6);
    U.dirt.value = S.dirt;
    sway.value = FILM.t;
    const on = S.lamp > 0 ? S.flick : S.flick * 0.7;
    F.bulb.intensity = 7 * on; F.glowBulb.material.color.setRGB(1, 0.84, 0.63).multiplyScalar(0.25 + 2.4 * on);
    F.sparkU.uOn.value = S.sparkOn;
    F.scanG.position.x = S.scan; F.scanG.visible = S.scanOn > 0.01; F.scanLight.intensity = 6 * S.scanOn;
    F.scanG.children[0].material.opacity = 0.09 * S.scanOn;
    const w = S.warm;
    F.hemi.intensity = 0.28 + 0.3 * w; F.hemi.color.setRGB(0.8 + 0.2 * w, 0.85 + 0.07 * w, 0.93 - 0.13 * w);
    F.sun.intensity = 0.3 + 3.4 * w; F.sun.color.setRGB(0.84 + 0.16 * w, 0.89 - 0.03 * w, 1 - 0.3 * w);
    F.fill.intensity = 2.2 * w;
    F.sky.material.color.setRGB(0.62 + 0.5 * w, 0.66 + 0.42 * w, 0.72 + 0.3 * w);
    F.shaft.userData.u.uOp.value = 0.02 + 0.1 * w;
    F.dust.uT.value = FILM.t; F.dust.uOp.value = 0.12 + 0.35 * w;
    // rubble: from the floor back into the wall, each piece on its own delay, shrinking into the new plaster
    const m = new THREE.Matrix4(), p = new THREE.Vector3(), qq = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
    const touched = new Set();
    for (const f of F.frags) {
      const k = Math.min(1, Math.max(0, (S.fly - f.delay) / (1 - f.delay * 0.9)));
      const kk = k * k * (3 - 2 * k);
      p.lerpVectors(f.home, f.wall, kk); p.y += Math.sin(kk * Math.PI) * 0.35;
      e.set(f.rot.x + kk * 4, f.rot.y + kk * 3, f.rot.z); qq.setFromEuler(e);
      s.copy(f.s).multiplyScalar(k > 0.85 ? Math.max(0.001, (1 - k) / 0.15) : 1);
      m.compose(p, qq, s); f.im.setMatrixAt(f.i, m); touched.add(f.im);
    }
    for (const im of touched) im.instanceMatrix.needsUpdate = true;
    // the AC: rattling and hanging open while broken; seated, sweeping and blowing cool air once fixed
    const br = 1 - S.acFix, ft = FILM.t;
    F.ac.position.set(ACX + Math.sin(ft * 61) * 0.0016 * br, ACY + Math.sin(ft * 47 + 1) * 0.0012 * br, -HD + 0.13);
    F.acFlapPivot.rotation.set(0.35 + 0.75 * br + S.acFix * S.air * 0.18 * Math.sin(ft * 1.3), 0, -0.16 * br);
    const acKey = S.acFix > 0.5 ? 'ok' : (Math.floor(ft * 2.5) % 2 ? 'err' : 'off');
    if (acKey !== F.acDispKey) { F.acDispKey = acKey; F.acDispTex.userData.redraw(acKey === 'ok' ? 'ok' : 'err', acKey !== 'off'); }
    F.airU.uT.value = ft; F.airU.uOp.value = S.air;
    for (const m of F.air) m.visible = S.air > 0.01;
    F.plug.visible = S.plug > 0.001; F.plug.scale.set(Math.max(0.001, S.plug), Math.max(0.001, S.plug), 1);
    V.renderer.toneMappingExposure = S.expo;
    for (const h of holos) h.quaternion.copy(V.camera.quaternion);          // markers face the camera
    syncReveals();
    if (!bake) V.render();
  },
};
