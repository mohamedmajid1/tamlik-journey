// Tamlik Media: a real-estate film shoot in a working studio. A staged living-room corner (a set build: painted
// flats braced from behind with stage weights, a timber deck, the sofa, the lounge chair, a big print of the Tamlik
// tower) stands in front of a grey cyclorama under a truss grid. The key and fill softboxes strike, the top light on
// the grid cuts a beam through the haze, the clapper snaps, the cinema camera rolls and glides along its slider, a
// drone lifts off over the set, and the director's monitor at video village shows the live shot (really rendered
// from the cinema camera) with the likes rising over it. animate() adds the motion at T (ms); render() draws.
import { THREE, tex, surface, model, seat, topOf, ready, makeView, aim, shotTween, canvasTex, bakeEnv, dust, handheld, FILM, place } from '../three/kit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { steps } from '../../vendor/anime.esm.min.js';
import { C } from '../brand.js';

let V, SHOT, RECORD = false, frameNo = 0, uiKey = '';
const rig = {};
const S = { studio: 0.1, s0: 0, s1: 0, s2: 0, set: 0, rec: 0, blink: 0, slide: 0, clap: 0.5, clapY: -1, fly: 0, prop: 0, tc: 0, hearts: 0, screen: 0 };
const F = {};
const lights = [];                      // { diff, L, peak, shaft? } per light that strikes: s0, s1, s2
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const DECK = 0.12;                      // height of the set's timber deck

// ---- materials ------------------------------------------------------------------------------------------------
const powder = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.5, metalness: 0.55 });   // black stands
const steel = new THREE.MeshStandardMaterial({ color: 0x9a9ea5, roughness: 0.28, metalness: 1 });      // C-stands, rods
const alu = new THREE.MeshStandardMaterial({ color: 0xb4b8be, roughness: 0.38, metalness: 1 });        // truss
const black = new THREE.MeshStandardMaterial({ color: 0x131315, roughness: 0.55, metalness: 0.35 });   // camera body parts
const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.85 });
const cloth = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 1, side: THREE.DoubleSide }); // flags, shells
const vinyl = new THREE.MeshStandardMaterial({ color: 0x1d1c1b, roughness: 0.72 });                      // sandbags
const pine = new THREE.MeshStandardMaterial({ color: 0xc4a171, roughness: 0.8 });                        // flat framing
const ply = new THREE.MeshStandardMaterial({ color: 0xb89b72, roughness: 0.85 });
const iron = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.6, metalness: 0.7 });       // stage weights
const gaffer = new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.75 });

const cyl = (r1, r2, h, m, seg = 16) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); c.castShadow = c.receiveShadow = true; return c; };
const bx = (w, h, d, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.castShadow = b.receiveShadow = true; return b; };
const rbx = (w, h, d, r, m) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m); b.castShadow = b.receiveShadow = true; return b; };
// a tube from a to b
function rod(a, b, r, m, seg = 10) {
  const d = new THREE.Vector3().subVectors(b, a), c = cyl(r, r, d.length(), m, seg);
  c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(UP, d.normalize()); return c;
}
// a T-knob (the lock screws on every stand)
function knob(m = powder) { const g = new THREE.Group(); const s = cyl(0.006, 0.006, 0.05, steel, 8); s.rotation.z = Math.PI / 2; s.position.x = 0.025; g.add(s); const h = bx(0.012, 0.04, 0.012, m); h.position.x = 0.05; g.add(h); return g; }

// a sandbag: two filled lobes and a strap, draped over a leg
function sandbag() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.18, 6, 12), vinyl); l.rotation.z = Math.PI / 2; l.scale.set(1, 1, 0.75); l.position.set(0, 0.04, s * 0.06); l.castShadow = l.receiveShadow = true; g.add(l); }
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 16, Math.PI), vinyl); strap.position.y = 0.07; strap.rotation.y = Math.PI / 2; g.add(strap);
  return g;
}

// a light stand: telescoping column, collar, three splayed legs with struts and rubber feet
function stand(h, s = 1) {
  const g = new THREE.Group(), hub = 0.5 * s, R = 0.4 * s;
  g.add(rod(V3(0, 0.1 * s, 0), V3(0, h * 0.62, 0), 0.02 * s, powder));
  g.add(rod(V3(0, h * 0.6, 0), V3(0, h, 0), 0.014 * s, steel));
  const col = cyl(0.03 * s, 0.03 * s, 0.07 * s, powder); col.position.y = hub; g.add(col);
  const col2 = cyl(0.026 * s, 0.026 * s, 0.05 * s, powder); col2.position.y = h * 0.62; g.add(col2);
  const k = knob(); k.position.y = h * 0.62; k.scale.setScalar(s); g.add(k);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + 0.3, foot = V3(Math.cos(a) * R, 0.012, Math.sin(a) * R);
    g.add(rod(V3(0, hub, 0), foot, 0.011 * s, powder, 8));
    g.add(rod(V3(0, 0.12 * s, 0), foot.clone().lerp(V3(0, hub, 0), 0.45), 0.007 * s, powder, 6));
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.016 * s, 10, 8), rubber); f.position.copy(foot); f.scale.y = 0.6; g.add(f);
  }
  g.userData.legAngle = 0.3;
  return g;
}

// a C-stand: turtle base with legs at three heights, riser, gobo head, grip arm with a black flag
function cstand(h, arm, flagW = 0.45, flagH = 0.6) {
  const g = new THREE.Group();
  g.add(rod(V3(0, 0, 0), V3(0, h * 0.55, 0), 0.016, steel));
  g.add(rod(V3(0, h * 0.53, 0), V3(0, h, 0), 0.012, steel));
  [0.07, 0.15, 0.23].forEach((y, i) => {
    const a = i / 3 * Math.PI * 2, R = 0.42 - i * 0.03;
    g.add(rod(V3(0, y, 0), V3(Math.cos(a) * R, 0.015, Math.sin(a) * R), 0.012, steel, 8));
    const hb = cyl(0.024, 0.024, 0.04, steel); hb.position.y = y; g.add(hb);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), rubber); f.position.set(Math.cos(a) * R, 0.012, Math.sin(a) * R); g.add(f);
  });
  const bag = sandbag(); bag.position.set(Math.cos(0) * 0.3, 0.05, 0); g.add(bag);
  const head = new THREE.Group(); head.position.y = h; g.add(head);
  const disc = cyl(0.035, 0.035, 0.03, steel, 16); disc.rotation.x = Math.PI / 2; head.add(disc);
  const k = knob(steel); k.rotation.y = Math.PI / 2; head.add(k);
  head.add(rod(V3(-0.12, 0, 0.03), V3(arm, 0, 0.03), 0.011, steel));
  const d2 = cyl(0.028, 0.028, 0.025, steel, 16); d2.rotation.x = Math.PI / 2; d2.position.set(arm, 0, 0.03); head.add(d2);
  const flag = new THREE.Group(); flag.position.set(arm + 0.02, -flagH / 2 + 0.03, 0.05); head.add(flag);
  const fr = new THREE.Mesh(new THREE.PlaneGeometry(flagW, flagH), cloth); fr.position.set(flagW / 2, 0, 0); fr.castShadow = true; flag.add(fr);
  for (const [a, b] of [[[0, -flagH / 2], [flagW, -flagH / 2]], [[0, flagH / 2], [flagW, flagH / 2]], [[0, -flagH / 2], [0, flagH / 2]], [[flagW, -flagH / 2], [flagW, flagH / 2]]])
    flag.add(rod(V3(a[0], a[1], 0), V3(b[0], b[1], 0), 0.005, steel, 6));
  g.userData.flag = flag;
  return g;
}

// an octagonal softbox on a yoke: shell, speed ring, head with fins, a lit diffuser with a lip; a SpotLight inside
function softbox(size, depth, color = 0xfff3e6) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(size, 0.13, depth, 8, 1, true), cloth); shell.rotation.x = -Math.PI / 2; shell.position.z = depth / 2; shell.castShadow = true; g.add(shell);
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; g.add(rod(V3(Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0), V3(Math.cos(a) * size * 0.93, Math.sin(a) * size * 0.93, depth), 0.004, steel, 5)); }
  const ring = cyl(0.14, 0.14, 0.04, powder, 24); ring.rotation.x = Math.PI / 2; g.add(ring);
  const headG = cyl(0.1, 0.1, 0.2, powder, 20); headG.rotation.x = Math.PI / 2; headG.position.z = -0.12; g.add(headG);
  for (let i = 0; i < 6; i++) { const fin = bx(0.004, 0.19, 0.16, powder); fin.position.set(-0.05 + i * 0.02, 0, -0.14); g.add(fin); }
  const back = cyl(0.07, 0.07, 0.03, black, 16); back.rotation.x = Math.PI / 2; back.position.z = -0.23; g.add(back);
  const diff = new THREE.Mesh(new THREE.CircleGeometry(size * 0.97, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); diff.rotation.z = Math.PI / 8; diff.position.z = depth - 0.015; g.add(diff);
  const lip = new THREE.Mesh(new THREE.RingGeometry(size * 0.93, size * 1.01, 8), cloth); lip.rotation.z = Math.PI / 8; lip.position.z = depth; g.add(lip);
  const L = new THREE.SpotLight(color, 0, 16, 0.85, 1, 2); L.position.set(0, 0, depth); L.castShadow = true;
  L.shadow.mapSize.set(1024, 1024); L.shadow.bias = -0.0006; L.shadow.normalBias = 0.02; L.shadow.radius = 6;
  const tgt = new THREE.Object3D(); tgt.position.set(0, 0, depth + 5); g.add(L, tgt); L.target = tgt;
  // yoke to the stand spigot
  const yk = new THREE.Group(); yk.add(rod(V3(-0.16, 0, -0.12), V3(-0.16, -0.18, -0.12), 0.01, powder), rod(V3(0.16, 0, -0.12), V3(0.16, -0.18, -0.12), 0.01, powder), rod(V3(-0.16, -0.18, -0.12), V3(0.16, -0.18, -0.12), 0.012, powder));
  g.add(yk);
  return { g, diff, L };
}

// a fresnel on the grid: body with cooling slots, lens, four barn doors, a yoke and a clamp
function fresnel(r = 0.13) {
  const g = new THREE.Group();
  const body = cyl(r, r * 0.92, r * 2.4, powder, 24); body.rotation.x = Math.PI / 2; g.add(body);
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, 0.004, 6, 24), black); s.position.z = -r * 0.8 + i * r * 0.28; g.add(s); }
  const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.85, 32), new THREE.MeshBasicMaterial({ color: 0xffe6c0, toneMapped: false })); lens.position.z = r * 1.21; g.add(lens);
  for (const [x, y, rz] of [[0, 1, 0], [0, -1, 0], [1, 0, Math.PI / 2], [-1, 0, Math.PI / 2]]) {
    const d = bx(r * 2, 0.004, r * 1.2, black); d.position.set(x * r * 1.05, y * r * 1.05, r * 1.7); d.rotation.set(y * 0.35, 0, rz); if (x) d.rotation.y = -x * 0.35; g.add(d);
  }
  g.add(rod(V3(-r * 1.15, 0, 0), V3(-r * 1.15, r * 1.9, 0), 0.01, powder), rod(V3(r * 1.15, 0, 0), V3(r * 1.15, r * 1.9, 0), 0.01, powder));
  return { g, lens };
}

// the overhead grid: 30 cm box truss, drawn as three instanced batches (chords, diagonals, clamps)
function truss(scene, runs) {
  const chords = [], diags = [];
  const s = 0.15;
  for (const [a, b] of runs) {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length(), dir = d.clone().normalize();
    const side = new THREE.Vector3().crossVectors(dir, UP).normalize();
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => side.clone().multiplyScalar(u * s).addScaledVector(UP, v * s));
    for (const c of corners) chords.push([a.clone().add(c), b.clone().add(c)]);
    const n = Math.round(len / 0.5);
    for (let i = 0; i < n; i++) for (let f = 0; f < 4; f++) {
      const c0 = corners[f], c1 = corners[(f + 1) % 4];
      const p0 = a.clone().addScaledVector(dir, i * len / n), p1 = a.clone().addScaledVector(dir, (i + 1) * len / n);
      diags.push(i % 2 ? [p0.clone().add(c0), p1.clone().add(c1)] : [p0.clone().add(c1), p1.clone().add(c0)]);
    }
  }
  const batch = (list, r, m) => {
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8), m, list.length);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion();
    list.forEach(([p, e], i) => { const d = new THREE.Vector3().subVectors(e, p); q.setFromUnitVectors(UP, d.clone().normalize()); M.compose(p.clone().addScaledVector(d, 0.5), q, V3(r, d.length(), r)); im.setMatrixAt(i, M); });
    im.receiveShadow = true; scene.add(im); return im;
  };
  batch(chords, 0.024, alu); batch(diags, 0.009, alu);
}

// a set flat: painted plaster face, plywood edge, 1×3 timber frame and toggles on the back, braced by two jacks
// weighted with iron stage weights. Built along +x from the origin, facing +z; back towards -z.
function flat(w, h, face, jacks = true) {
  const g = new THREE.Group();
  const f = bx(w, h, 0.03, [ply, ply, ply, ply, face, ply]); f.position.set(w / 2, h / 2, 0); g.add(f);
  const fr = (x0, y0, x1, y1) => { const b = bx(Math.max(0.07, Math.abs(x1 - x0)), Math.max(0.07, Math.abs(y1 - y0)), 0.02, pine); b.position.set((x0 + x1) / 2, (y0 + y1) / 2, -0.026); g.add(b); };
  fr(0, 0.035, w, 0.035); fr(0, h - 0.035, w, h - 0.035); fr(0.035, 0, 0.035, h); fr(w - 0.035, 0, w - 0.035, h);
  for (let x = 0.6; x < w - 0.3; x += 0.6) fr(x, 0, x, h);
  for (const y of [h / 3, 2 * h / 3]) fr(0, y, w, y);
  if (jacks) for (const x of [w * 0.25, w * 0.75]) {
    const j = new THREE.Group(); j.position.set(x, 0, -0.04); g.add(j);
    const up = bx(0.04, h * 0.7, 0.07, pine); up.position.set(0, h * 0.35, -0.035); j.add(up);
    const base = bx(0.04, 0.07, h * 0.42, pine); base.position.set(0, 0.035, -h * 0.21); j.add(base);
    const dl = Math.hypot(h * 0.66, h * 0.4), diag = bx(0.035, dl, 0.06, pine); diag.position.set(0, h * 0.33, -h * 0.2); diag.rotation.x = -Math.atan2(h * 0.4, h * 0.66); j.add(diag);
    for (let k = 0; k < 2; k++) { const wgt = rbx(0.14, 0.05, 0.3, 0.01, iron); wgt.position.set(0.1, 0.025 + k * 0.052, -h * 0.3); j.add(wgt); }
  }
  return g;
}

// a soft cone of light through the haze: brighter along its axis, fading at the rim and towards the floor
function coneBeam(from, to, r0, r1, color) {
  const len = from.distanceTo(to), g = new THREE.CylinderGeometry(r0, r1, len, 48, 12, true);
  g.translate(0, -len / 2, 0);
  const u = { uCol: { value: new THREE.Color(color) }, uOp: { value: 0 }, uLen: { value: len } };
  const m = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vN, vV; varying float vY; void main(){ vY = -position.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; uniform float uOp, uLen; varying vec3 vN, vV; varying float vY; void main(){ float e = abs(dot(normalize(vN), normalize(vV))); float f = 1.0 - vY / uLen; gl_FragColor = vec4(uCol, uOp * pow(e, 2.5) * (0.2 + 0.8 * f) * smoothstep(0.0, 0.08, vY / uLen) * (1.0 - smoothstep(0.55, 1.0, vY / uLen))); }' });
  const b = new THREE.Mesh(g, m); b.position.copy(from);
  b.quaternion.setFromUnitVectors(V3(0, -1, 0), new THREE.Vector3().subVectors(to, from).normalize());
  b.userData.u = u; b.renderOrder = 5; return b;
}

// a floor cable with gaffer-tape strips across it at intervals
function cable(scene, pts, r = 0.009) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V3(x, r, z)));
  const c = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, r, 8), rubber); c.castShadow = c.receiveShadow = true; scene.add(c);
  const L = curve.getLength();
  for (let d = 0.6; d < L - 0.3; d += 1.4) {
    const p = curve.getPointAt(d / L), t = curve.getTangentAt(d / L);
    const tp = bx(0.05, 0.004, 0.22, gaffer); tp.position.set(p.x, r * 1.7, p.z); tp.rotation.y = Math.atan2(-t.z, t.x); tp.castShadow = false; scene.add(tp);
  }
}

// everything that never moves is merged into one mesh per material: the studio has hundreds of small parts
// (stand legs, truss, flats, cables, tape), and drawn one by one for the camera, three shadow maps and the monitor
// they cost far more than their pixels
function mergeStatic(scene, keep) {
  const groups = new Map(), drop = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.isShaderMaterial || o.material.transparent) return;
    for (let p = o; p; p = p.parent) if (keep.has(p)) return;
    const k = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', g.attributes.position); out.setAttribute('normal', g.attributes.normal);
    out.setAttribute('uv', g.attributes.uv || new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    out.applyMatrix4(o.matrixWorld);
    if (!groups.has(k)) groups.set(k, { m: o.material, cast: o.castShadow, recv: o.receiveShadow, list: [] });
    groups.get(k).list.push(out); drop.push(o);
  });
  for (const o of drop) o.parent.remove(o);
  for (const { m, cast, recv, list } of groups.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(list), m); mesh.castShadow = cast; mesh.receiveShadow = recv; mesh.matrixAutoUpdate = false; scene.add(mesh);
  }
}

export const media = {
  id: 'media', name: 'MEDIA', accent: C.cyan, glow: 'rgba(58,215,255,.13)',
  tagline: 'We make you <b>seen</b>',
  full: true,
  // the way in from the city (main.js): the window sits in the plane dot(n, p) = d, between span[0]..span[1] along
  // the wall and y[0]..y[1] above the floor; everything on the far side of that plane is cut away while seen from outside
  door: { n: [0, 0, 1], d: 5.4, span: [-6.2, 6.2], y: [0.15, 2.65] },
  shots: () => SHOT, view: () => V,
  html: () => '<canvas class="room"></canvas><div class="shade top"></div><div class="shade bottom"></div>',

  async init(el, { portrait, record }) {
    RECORD = record;
    V = await makeView(el.querySelector('canvas.room'), { portrait, record, env: 'studio_small_09', envIntensity: 0.3, bloom: 0.2, exposure: 1.05 });
    const { scene } = V;
    scene.background = new THREE.Color(0x050506);
    scene.fog = new THREE.Fog(0x050506, 9, 22);
    // landscape: the text owns the right of the frame, so the frame centre sits over the left half (off-axis lens)
    if (!portrait) V.camera.setViewOffset(1920, 1080, 1920 * 0.2, 0, 1920, 1080);
    SHOT = portrait
      ? [{ x: -2.9, y: 1.6, z: 4.4, tx: -0.5, ty: 1.0, tz: -1.3 }, { x: 0.55, y: 1.5, z: 3.9, tx: 1.38, ty: 1.12, tz: 0.6 }]
      : [{ x: -4.2, y: 1.75, z: 4.3, tx: -0.2, ty: 1.05, tz: -1.3 }, { x: -0.6, y: 1.6, z: 3.9, tx: 2.0, ty: 1.1, tz: 0.1 }];
    Object.assign(rig, SHOT[0]);

    // --- the studio floor: sealed dark concrete with a soft sheen
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), surface('concrete_floor_02', 10, { color: 0x4a4b4e, roughness: 1 }));
    floor.material.roughnessMap = null; floor.material.roughness = 0.42; floor.material.metalness = 0.05;
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    // the cyclorama: floor, a curved cove and the wall in one painted surface, behind the set
    const prof = [], R = 1.4, ZF = -3.4, ZW = ZF - R;
    for (let i = 0; i <= 2; i++) prof.push([ZF + 1.6 - i * 0.8, 0]);
    for (let i = 1; i <= 16; i++) { const a = i / 16 * Math.PI / 2; prof.push([ZF - Math.sin(a) * R, R - Math.cos(a) * R]); }
    for (let i = 1; i <= 4; i++) prof.push([ZW, R + i * 1.4]);
    const pos = [], idx = [], XW = 9;
    prof.forEach(([z, y]) => { pos.push(-XW, y + 0.003, z, XW, y + 0.003, z); });
    for (let i = 0; i < prof.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cg.setIndex(idx); cg.computeVertexNormals();
    const uv = []; prof.forEach((_, i) => uv.push(0, i / prof.length, 1, i / prof.length)); cg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const cycM = new THREE.MeshStandardMaterial({ color: 0x77787a, roughness: 0.95 });
    const cyc = new THREE.Mesh(cg, cycM); cyc.receiveShadow = true; scene.add(cyc);
    // black drapes hang either side of the cyc, in soft folds
    const drape = (x, z0, z1) => {
      const g = new THREE.PlaneGeometry(Math.abs(z1 - z0), 7, 120, 1), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * 0.07 + Math.sin(p.getX(i) * 3.1) * 0.05);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 1, side: THREE.DoubleSide }));
      m.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; m.position.set(x, 3.5, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
    };
    drape(-7.5, -5, 6); drape(7.5, -5, 6);

    // --- the grid: box truss overhead, with a top light, a spare fresnel and a soft LED panel hung from it
    const GY = 4.0;
    truss(scene, [[V3(-6.5, GY, -1.9), V3(6.5, GY, -1.9)], [V3(-6.5, GY, 1.4), V3(6.5, GY, 1.4)], [V3(-3.2, GY, -4.2), V3(-3.2, GY, 4.5)], [V3(3.0, GY, -4.2), V3(3.0, GY, 4.5)]]);
    const hang = (x, z, drop) => { const cl = bx(0.08, 0.06, 0.08, powder); cl.position.set(x, GY - 0.19, z); scene.add(cl); scene.add(rod(V3(x, GY - 0.2, z), V3(x, GY - drop, z), 0.012, steel)); };
    // the top light (s2): a fresnel over the set, angled down across the sofa, cutting a beam through the haze
    const top = fresnel(0.15); top.g.position.set(0.9, GY - 0.62, -1.9); scene.add(top.g); hang(0.9, -1.9, 0.45);
    top.g.lookAt(V3(0.1, DECK + 0.5, -1.95));
    const topL = new THREE.SpotLight(0xffd6a6, 0, 14, 0.36, 0.55, 2); topL.position.copy(top.g.position); topL.castShadow = true;
    topL.shadow.mapSize.set(1024, 1024); topL.shadow.bias = -0.0006; topL.shadow.normalBias = 0.02;
    topL.target.position.set(0.1, DECK + 0.5, -1.95); scene.add(topL, topL.target);
    const beam = coneBeam(top.g.position.clone(), V3(0.15, DECK + 0.25, -1.75), 0.12, 0.55, 0xffdcb0); scene.add(beam);
    for (const [x, z, t] of [[-2.2, 1.4, V3(-2.2, 0, 0)], [2.2, -1.9, V3(3, 0, -3)], [-1.2, -1.9, V3(-1.5, 0, -3.5)]]) {
      const f = fresnel(0.12); f.g.position.set(x, GY - 0.55, z); f.g.lookAt(t); f.lens.material.color.setScalar(0.05); scene.add(f.g); hang(x, z, 0.4);
    }
    const panel = new THREE.Group(); panel.position.set(-0.4, GY - 0.55, 1.4); panel.rotation.x = 0.9; scene.add(panel); hang(-0.4, 1.4, 0.35);
    panel.add(bx(1.2, 0.06, 0.4, powder)); const pf = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.34), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); pf.rotation.x = Math.PI / 2; pf.position.y = -0.031; panel.add(pf);
    F.panel = pf;

    // --- the set: a timber deck, three painted flats, the living room
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.6, DECK, 2.7), [black, black, surface('wood_floor', 2.2), black, black, black]);
    deck.position.set(0.15, DECK / 2, -1.2); deck.receiveShadow = true; deck.castShadow = true; scene.add(deck);
    deck.material[2].envMapIntensity = 0.8;
    const plaster = surface('plastered_wall', 1.4, { color: 0xeee6da, roughness: 0.92 });
    const HF = 2.75;
    const backF = flat(4.6, HF, plaster); backF.position.set(-2.15, DECK, -2.52); scene.add(backF);
    const sideF = flat(2.6, HF, plaster); sideF.rotation.y = Math.PI / 2; sideF.position.set(-2.12, DECK, 0.1); scene.add(sideF);
    // a moulding along the base of the flats (the set's skirting) and a picture light over the print
    const skirtM = new THREE.MeshStandardMaterial({ color: 0xe8e1d6, roughness: 0.6 });
    const sk1 = bx(4.55, 0.1, 0.02, skirtM); sk1.position.set(0.15, DECK + 0.05, -2.495); scene.add(sk1);
    const sk2 = bx(0.02, 0.1, 2.58, skirtM); sk2.position.set(-2.095, DECK + 0.05, -1.19); scene.add(sk2);
    // distribution box on the back of the side flat, feeding the practicals
    const pb = seat(await model('power_box_01'), 0.9); pb.rotation.y = -Math.PI / 2; pb.position.set(-2.2, 0.35, -0.9); scene.add(pb);

    // the tower print, framed, above the sofa
    const frameM = new THREE.MeshStandardMaterial({ color: 0x121110, roughness: 0.45, metalness: 0.2 });
    const fr = bx(2.2, 1.3, 0.05, frameM); fr.position.set(0.3, DECK + 1.72, -2.47); scene.add(fr);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.2), new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.9 })); mat.position.set(0.3, DECK + 1.72, -2.443); scene.add(mat);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.02), new THREE.MeshStandardMaterial({ map: tex('assets/posts/film_0.88.jpg', 1, true), roughness: 0.85 }));
    pic.position.set(0.3, DECK + 1.72, -2.44); scene.add(pic);
    pic.material.map = pic.material.map.clone(); pic.material.map.repeat.set(1, 0.54); pic.material.map.offset.set(0, 0.24); pic.material.map.needsUpdate = true;
    const glassP = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.2), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.08 })); glassP.position.set(0.3, DECK + 1.72, -2.438); 
    const bar = cyl(0.018, 0.018, 0.7, new THREE.MeshStandardMaterial({ color: 0xb49366, metalness: 1, roughness: 0.3 })); bar.rotation.z = Math.PI / 2; bar.position.set(0.3, DECK + 2.47, -2.38); scene.add(bar);
    scene.add(rod(V3(0.3, DECK + 2.48, -2.49), V3(0.3, DECK + 2.48, -2.38), 0.008, bar.material));

    const rug = new THREE.Mesh(new RoundedBoxGeometry(3.0, 0.014, 1.9, 2, 0.006), surface('poly_wool_herringbone', 3, { color: 0xd8cab2, roughness: 1 }));
    rug.position.set(0.25, DECK + 0.007, -1.3); rug.receiveShadow = true; scene.add(rug);
    const put = async (name, x, z, ry = 0, s = 1, y = DECK) => { const h = seat(await model(name), s); h.position.set(x, y, z); h.rotation.y = ry; scene.add(h); return h; };
    await put('sofa_03', 0.3, -1.98, 0, 0.92);
    await put('throw_pillows_01', -0.35, -1.95, 0.1, 0.62, DECK + 0.43);
    const ctab = await put('coffee_table_round_01', 0.4, -1.05, 0, 0.78);
    await put('tea_set_01', 0.4, -1.05, 0.5, 0.55, topOf(ctab));
    await put('mid_century_lounge_chair', -1.3, -0.75, 0.75, 0.95);
    const st = await put('side_table_01', 1.95, -2.0, 0.2, 0.95);
    await put('brass_vase_01', 1.95, -2.0, 0, 0.55, topOf(st));
    await put('potted_plant_01', 1.9, -0.55, 0.4, 1.05);
    await put('potted_plant_02', -1.75, -2.12, 0.5, 0.95);
    await put('ceramic_vase_04', -1.1, -2.2, 0, 1.1);
    // a practical: a floor lamp with a linen drum shade behind the lounge chair
    const lamp = new THREE.Group(); lamp.position.set(-1.72, DECK, -1.35); scene.add(lamp);
    const brass = new THREE.MeshStandardMaterial({ color: 0xb08d57, metalness: 1, roughness: 0.32 });
    const lb = cyl(0.16, 0.17, 0.03, brass, 32); lb.position.y = 0.015; lamp.add(lb);
    lamp.add(rod(V3(0, 0.02, 0), V3(0, 1.45, 0), 0.011, brass));
    F.shadeM = new THREE.MeshStandardMaterial({ map: tex('assets/tex3d/rough_linen/diffuse.jpg', 1, true), color: 0xf3e6cf, roughness: 1, side: THREE.DoubleSide, emissive: 0xffb866, emissiveIntensity: 0 });
    const shadeL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.3, 40, 1, true), F.shadeM); shadeL.position.y = 1.5; shadeL.castShadow = true; lamp.add(shadeL);
    F.practical = new THREE.PointLight(0xffb870, 0, 5, 2); F.practical.position.set(-1.72, DECK + 1.45, -1.35); scene.add(F.practical);

    // --- tape marks on the deck: the talent's T marks, the camera's floor marks
    const tapeM = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
    for (const [x, z, c, r] of [[0.1, -0.7, 0xd9b21c, 0.2], [0.9, -0.95, 0xb8352d, -0.4]]) {
      const t1 = bx(0.2, 0.003, 0.045, tapeM(c)), t2 = bx(0.045, 0.003, 0.16, tapeM(c));
      t1.position.set(x, DECK + 0.016, z); t2.position.set(x, DECK + 0.016, z + 0.1); t1.rotation.y = t2.rotation.y = r; t2.position.x += Math.sin(r) * 0.1; t2.position.z = z + Math.cos(r) * 0.1;
      t1.castShadow = t2.castShadow = false; scene.add(t1, t2);
    }

    // --- key (s0) and fill (s1) softboxes on stands, each with a sandbag; the key is flagged off the cyc
    const addSoft = (x, z, h, aimAt, size, depth, peak) => {
      const s = stand(h); s.position.set(x, 0, z); scene.add(s);
      const b = sandbag(); b.position.set(x + Math.cos(0.3) * 0.25, 0.04, z + Math.sin(0.3) * 0.25); b.rotation.y = -0.3; scene.add(b);
      const sb = softbox(size, depth); sb.g.position.set(x, h + 0.2, z); sb.g.lookAt(aimAt); scene.add(sb.g);
      lights.push({ diff: sb.diff, L: sb.L, peak });
      if (!record && lights.length === 2) sb.L.castShadow = false;           // the fill is soft; its shadow is only worth it offline
      return sb;
    };
    addSoft(-2.95, 0.5, 1.95, V3(-0.3, DECK + 0.8, -1.7), 0.6, 0.55, 30);
    addSoft(3.25, -0.2, 1.75, V3(0.6, DECK + 0.7, -1.6), 0.5, 0.45, 16);
    lights.push({ diff: top.lens, L: topL, peak: 26, beam });
    const cs = cstand(1.7, 0.55); cs.position.set(-2.55, 0, -0.35); cs.rotation.y = 0.5; scene.add(cs);
    const cs2 = cstand(1.9, 0.6, 0.6, 0.45); cs2.position.set(3.3, 0, -0.4); cs2.rotation.y = 0.3; scene.add(cs2);
    // haze: dust motes over the set that show where the light falls
    F.dust = dust(scene, { min: V3(-1.6, DECK + 0.2, -2.3), max: V3(1.8, 3.3, 0.2), count: 450, size: 0.009, opacity: 0 });

    // --- the cinema camera on a slider: two baby stands and a centre leg, rails, carriage, fluid head
    const slider = new THREE.Group(); slider.position.set(-1.85, 0, 1.35); slider.rotation.y = -0.2; scene.add(slider);
    for (const x of [-0.82, 0.82]) { const t = stand(0.66, 0.85); t.position.set(x, 0, 0); slider.add(t); }
    const mid = rod(V3(0, 0, 0), V3(0, 0.8, 0), 0.012, powder); slider.add(mid);
    for (const z of [-0.035, 0.035]) { const r = cyl(0.012, 0.012, 1.8, steel, 12); r.rotation.z = Math.PI / 2; r.position.set(0, 0.82, z); slider.add(r); }
    for (const x of [-0.9, 0.9, 0]) { const e = rbx(x ? 0.05 : 0.04, 0.05, 0.16, 0.008, black); e.position.set(x, 0.82, 0); slider.add(e); }
    F.carriage = new THREE.Group(); F.carriage.position.set(-0.6, 0.85, 0); slider.add(F.carriage);
    F.carriage.add(rbx(0.17, 0.035, 0.15, 0.006, black));
    const fh = cyl(0.045, 0.055, 0.07, black, 20); fh.position.y = 0.05; F.carriage.add(fh);
    const pan = rod(V3(0, 0.06, -0.02), V3(0, 0.1, -0.45), 0.009, black); F.carriage.add(pan);
    const cam = new THREE.Group(); cam.position.y = 0.16; F.carriage.add(cam); F.cam = cam; F.slider = slider;
    const bodyM = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.42, metalness: 0.55 });
    cam.add(rbx(0.14, 0.15, 0.22, 0.012, bodyM));
    const plate = rbx(0.16, 0.02, 0.36, 0.004, black); plate.position.set(0, -0.085, 0.03); cam.add(plate);
    for (const x of [-0.035, 0.035]) { const r = cyl(0.0075, 0.0075, 0.46, steel, 10); r.rotation.x = Math.PI / 2; r.position.set(x, -0.105, 0.14); cam.add(r); }
    const lensG = new THREE.Group(); lensG.position.z = 0.19; cam.add(lensG);
    const lb2 = cyl(0.046, 0.05, 0.19, black, 32); lb2.rotation.x = Math.PI / 2; lensG.add(lb2);
    for (const [z, r] of [[-0.06, 0.056], [0.0, 0.054], [0.06, 0.056]]) { const g = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 8, 40), rubber); g.position.z = z; lensG.add(g); }
    const markRing = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.002, 6, 40), new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: 0.4 })); markRing.position.z = 0.03; lensG.add(markRing);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.04, 32), new THREE.MeshPhysicalMaterial({ color: 0x0a1320, roughness: 0.02, metalness: 0.5, clearcoat: 1, iridescence: 0.6 })); glass.position.z = 0.096; lensG.add(glass);
    // follow focus on the rods, with its whip
    const ff = rbx(0.05, 0.07, 0.04, 0.006, black); ff.position.set(0.075, -0.07, 0.19); cam.add(ff);
    const ffw = cyl(0.028, 0.028, 0.012, rubber, 20); ffw.rotation.z = Math.PI / 2; ffw.position.set(0.105, -0.06, 0.19); cam.add(ffw);
    // matte box: a square hood on the rods, top flag and side wings
    const mb = new THREE.Group(); mb.position.z = 0.36; cam.add(mb);
    const mbb = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.075, 0.1, 4, 1, true), black); mbb.rotation.set(Math.PI / 2, Math.PI / 4, 0); mbb.scale.set(1.35, 1, 0.85); mb.add(mbb);
    const tf = bx(0.23, 0.004, 0.12, black); tf.position.set(0, 0.085, 0.1); tf.rotation.x = -0.12; mb.add(tf);
    for (const s of [-1, 1]) { const w = bx(0.004, 0.15, 0.1, black); w.position.set(s * 0.125, 0, 0.09); w.rotation.y = s * 0.15; mb.add(w); }
    // top handle, EVF on an arm, V-mount battery, the side monitor, cables
    const hd = rbx(0.03, 0.03, 0.22, 0.01, black); hd.position.set(0, 0.12, 0.02); cam.add(hd);
    for (const z of [-0.07, 0.1]) { const p = bx(0.02, 0.05, 0.02, black); p.position.set(0, 0.095, z); cam.add(p); }
    const evfArm = rod(V3(-0.07, 0.04, 0.0), V3(-0.14, 0.06, -0.12), 0.008, black); cam.add(evfArm);
    const evf = cyl(0.025, 0.028, 0.11, black, 18); evf.rotation.x = Math.PI / 2; evf.position.set(-0.14, 0.06, -0.15); cam.add(evf);
    const cup = cyl(0.03, 0.026, 0.03, rubber, 18); cup.rotation.x = Math.PI / 2; cup.position.set(-0.14, 0.06, -0.215); cam.add(cup);
    const bat = rbx(0.1, 0.13, 0.045, 0.008, new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.6, metalness: 0.3 })); bat.position.z = -0.14; cam.add(bat);
    const vm = bx(0.11, 0.14, 0.012, black); vm.position.z = -0.115; cam.add(vm);
    const sm = rbx(0.13, 0.085, 0.018, 0.004, black); sm.position.set(0.14, 0.09, 0.05); sm.rotation.y = -0.7; cam.add(sm);
    cam.add(rod(V3(0.07, 0.07, 0.05), V3(0.12, 0.08, 0.05), 0.006, black));
    F.camView = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.07), new THREE.MeshBasicMaterial({ toneMapped: false })); F.camView.position.set(0.14, 0.09, 0.05); F.camView.rotation.y = -0.7; F.camView.translateZ(0.01); cam.add(F.camView);
    F.tally = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })); F.tally.position.set(0.04, 0.078, 0.1); cam.add(F.tally);
    const cc = new THREE.CatmullRomCurve3([V3(0.07, -0.02, -0.08), V3(0.1, -0.12, -0.14), V3(0.06, -0.2, -0.05), V3(0.02, -0.12, 0.05)]);
    cam.add(new THREE.Mesh(new THREE.TubeGeometry(cc, 20, 0.005, 6), rubber));
    // the cinema camera's own view: this is what the monitors show (smaller while live)
    F.cine = new THREE.PerspectiveCamera(36, 16 / 9, 0.05, 40); F.cine.position.set(0, 0, 0.3); F.cine.rotation.y = Math.PI; cam.add(F.cine);
    F.rt = record ? new THREE.WebGLRenderTarget(1280, 720, { type: THREE.HalfFloatType, samples: 4 }) : new THREE.WebGLRenderTarget(640, 360, { type: THREE.HalfFloatType, samples: 2 });
    F.rt.texture.colorSpace = THREE.SRGBColorSpace;
    F.camView.material.map = F.rt.texture;
    const crates = [[-1.1, 2.05, 0.3, 0], [-1.1, 2.05, 0.3, 1], [-0.45, 2.2, -0.2, 0]];
    for (const [x, z, ry, k] of crates) { const c = await put('wooden_crate_01', x, z, ry, 0.6, k * 0.21); }

    // --- video village: a cart with the director's monitor on a yoke, a stills camera, the director's stool
    const cart = await put('industrial_storage_cart', 1.6, 1.0, -0.5, 0.62, 0);
    const ct = topOf(cart);
    const screen = new THREE.Group(); screen.position.set(1.6, ct, 1.0); screen.rotation.y = -0.5; scene.add(screen);
    screen.add(rod(V3(-0.18, 0, 0), V3(-0.18, 0.26, 0), 0.012, powder), rod(V3(0.18, 0, 0), V3(0.18, 0.26, 0), 0.012, powder));
    const base = rbx(0.42, 0.02, 0.18, 0.005, powder); base.position.y = 0.01; screen.add(base);
    const mon = new THREE.Group(); mon.position.y = 0.34; mon.rotation.x = -0.08; screen.add(mon);
    mon.add(rbx(0.74, 0.45, 0.05, 0.01, black));
    F.monitor = new THREE.Mesh(new THREE.PlaneGeometry(0.69, 0.388), new THREE.MeshBasicMaterial({ map: F.rt.texture, toneMapped: false })); F.monitor.position.z = 0.026; mon.add(F.monitor);
    F.ui = canvasTex(record ? 1024 : 768, record ? 576 : 432, drawUI, { live: true });
    F.overlay = new THREE.Mesh(new THREE.PlaneGeometry(0.69, 0.388), new THREE.MeshBasicMaterial({ map: F.ui, transparent: true, toneMapped: false, depthWrite: false })); F.overlay.position.z = 0.027; mon.add(F.overlay);
    const hood = new THREE.Group(); hood.position.z = 0.03; mon.add(hood);
    for (const [w, h, x, y, rx, ry] of [[0.76, 0.005, 0, 0.23, -0.1, 0], [0.005, 0.46, -0.38, 0, 0, 0.12], [0.005, 0.46, 0.38, 0, 0, -0.12]]) { const p = bx(w, h, 0.16, cloth); p.position.set(x, y, 0.08); p.rotation.set(rx, ry, 0); hood.add(p); }
    const stills = seat(await model('Camera_01'), 1.1); stills.position.set(1.27, ct, 1.12); stills.rotation.y = 0.6; scene.add(stills);
    await put('metal_stool_01', 0.95, 1.95, 0.3, 0.95, 0);
    F.monLight = new THREE.PointLight(0x8fb6ff, 0, 1.6, 2); F.monLight.position.set(1.45, ct + 0.35, 1.3); scene.add(F.monLight);

    // --- the drone: a folding-arm quad with a gimbal camera, props, landing legs and nav lights
    F.drone = new THREE.Group(); F.drone.position.set(0.6, 0, 1.3); F.drone.scale.setScalar(1.25); scene.add(F.drone);
    const grey = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.45, metalness: 0.2 });
    const lite = new THREE.MeshStandardMaterial({ color: 0x8c8f94, roughness: 0.4, metalness: 0.3 });
    const db = rbx(0.13, 0.055, 0.24, 0.02, grey); db.position.y = 0.1; F.drone.add(db);
    const dtop = rbx(0.1, 0.02, 0.16, 0.009, lite); dtop.position.set(0, 0.13, -0.01); F.drone.add(dtop);
    const bat2 = rbx(0.07, 0.03, 0.12, 0.008, lite); bat2.position.set(0, 0.14, -0.03); F.drone.add(bat2);
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.05, clearcoat: 1 })); eye.position.set(s * 0.025, 0.1, 0.121); F.drone.add(eye); }
    const gim = new THREE.Group(); gim.position.set(0, 0.06, 0.1); F.drone.add(gim);
    gim.add(rbx(0.04, 0.03, 0.03, 0.006, grey)); const gl = cyl(0.011, 0.011, 0.012, black, 16); gl.rotation.x = Math.PI / 2; gl.position.z = 0.02; gim.add(gl);
    F.props = [];
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2, ax = Math.cos(a) * 0.17, az = Math.sin(a) * 0.17;
      F.drone.add(rod(V3(Math.cos(a) * 0.05, 0.1, Math.sin(a) * 0.05), V3(ax, 0.105, az), 0.009, grey, 8));
      const mot = cyl(0.018, 0.018, 0.028, black, 14); mot.position.set(ax, 0.12, az); F.drone.add(mot);
      const legD = rod(V3(ax * 0.9, 0.105, az * 0.9), V3(ax * 0.95, 0.0, az * 0.95), 0.004, grey, 6); F.drone.add(legD);
      const p = new THREE.Group(); p.position.set(ax, 0.138, az);
      const bladeM = new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: 0.35, transparent: true, opacity: 0.95 });
      for (const r of [0, Math.PI]) { const bl = bx(0.085, 0.002, 0.014, bladeM); bl.position.x = Math.cos(r) * 0.045; bl.rotation.x = 0.12 * (r ? -1 : 1); p.add(bl); }
      const hub = cyl(0.008, 0.008, 0.008, lite, 10); p.add(hub);
      const blur = new THREE.Mesh(new THREE.CircleGeometry(0.092, 40), new THREE.MeshBasicMaterial({ color: 0x9aa0a8, transparent: true, opacity: 0, depthWrite: false })); blur.rotation.x = -Math.PI / 2; p.add(blur);
      F.drone.add(p); F.props.push({ p, blur, bladeM });
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: i === 0 || i === 3 ? 0x30ff7a : 0xff3030, toneMapped: false })); led.position.set(ax, 0.1, az); F.drone.add(led);
    }
    // the drone's landing pad on the floor
    const padTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#e07b1a'; x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 2, 0, 7); x.fill(); x.fillStyle = '#1a1a1a'; x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 26, 0, 7); x.fill(); x.fillStyle = '#e8e8e8'; x.font = '700 120px Manrope, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', w / 2, h / 2 + 6); });
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.34, 40), new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.8 })); pad.rotation.x = -Math.PI / 2; pad.position.set(0.6, 0.004, 1.3); pad.receiveShadow = true; scene.add(pad);

    // --- the clapperboard: slate with the Tamlik Media label, striped arm on a hinge
    const slateTex = canvasTex(512, 360, (x, w, h) => {
      x.fillStyle = '#141414'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#e6e6e6'; x.lineWidth = 4; x.strokeRect(16, 16, w - 32, h - 32);
      x.beginPath(); x.moveTo(16, h * 0.55); x.lineTo(w - 16, h * 0.55); x.moveTo(w / 2, h * 0.55); x.lineTo(w / 2, h - 16); x.stroke();
      x.strokeStyle = '#01A652'; x.lineWidth = 10; x.lineJoin = 'round'; x.beginPath(); x.moveTo(60, 150); x.lineTo(105, 110); x.lineTo(150, 150); x.stroke();
      x.fillStyle = '#e6e6e6'; x.font = '600 58px Manrope, sans-serif'; x.fillText('TAMLIK MEDIA', 170, 150);
      x.font = '500 40px Manrope, sans-serif'; x.fillText('SCENE  01', 44, 270); x.fillText('TAKE  01', w / 2 + 28, 270);
      x.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 40; i++) x.fillRect((i * 97) % w, (i * 53) % h, 60, 2);
    });
    const stripe = canvasTex(512, 64, (x, w, h) => { x.fillStyle = '#111'; x.fillRect(0, 0, w, h); x.fillStyle = '#eee'; for (let i = -1; i < 9; i++) { x.beginPath(); x.moveTo(i * 64, h); x.lineTo(i * 64 + 32, h); x.lineTo(i * 64 + 64, 0); x.lineTo(i * 64 + 32, 0); x.fill(); } });
    F.clapper = new THREE.Group(); scene.add(F.clapper);
    const slate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.21, 0.012), [black, black, black, black, new THREE.MeshStandardMaterial({ map: slateTex, roughness: 0.55 }), black]); F.clapper.add(slate);
    F.clapArm = new THREE.Group(); F.clapArm.position.set(-0.15, 0.115, 0); F.clapper.add(F.clapArm);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.014), [black, black, black, black, new THREE.MeshStandardMaterial({ map: stripe }), black]); arm.position.x = 0.15; F.clapArm.add(arm);
    const cbase = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.014), [black, black, black, black, new THREE.MeshStandardMaterial({ map: stripe }), black]); cbase.position.y = 0.09; F.clapper.add(cbase);

    // --- cables from every stand to the distro, taped down where they cross a walkway
    cable(scene, [[-2.95, 0.5], [-2.7, 0.0], [-2.45, -0.6], [-2.3, -0.9]]);
    cable(scene, [[3.25, -0.2], [2.9, 0.6], [2.4, 1.3], [1.2, 2.3], [-0.6, 2.6], [-2.4, 1.6], [-2.6, 0.2], [-2.35, -0.8]]);
    cable(scene, [[1.6, 1.0], [1.1, 1.6], [-0.3, 2.35], [-1.9, 1.35]]);
    cable(scene, [[-1.85, 1.35], [-2.7, 2.2], [-3.6, 1.2], [-3.3, -0.8], [-2.3, -1.0]], 0.012);

    // --- light for the dark studio before the lights strike: a dim cool house light from the grid
    F.hemi = new THREE.HemisphereLight(0x9fb3d6, 0x141210, 0.1); scene.add(F.hemi);
    F.work = new THREE.SpotLight(0xbfd4ff, 5, 20, 0.95, 1, 1.4); F.work.position.set(0, 6, 3); F.work.target.position.set(0, 0, -1); scene.add(F.work, F.work.target);
    F.cycL = new THREE.SpotLight(0xa9bddb, 0, 14, 0.9, 1, 1.2); F.cycL.position.set(0, 3.8, -2.2); F.cycL.target.position.set(0, 1.2, -5); scene.add(F.cycL, F.cycL.target);

    await ready();
    mergeStatic(scene, new Set([F.drone, F.clapper, F.carriage, F.monitor, F.overlay]));
    // reflections: bake the lit studio into the environment (the polished floor and the metal gear pick it up)
    Object.assign(S, { s0: 1, s1: 1, s2: 1, set: 1, studio: 0.35, screen: 0 }); this.render(true);
    bakeEnv(V, V3(0, 1.2, 0.6), { intensity: 0.55, hide: [F.drone, F.clapper] });
    F.envMax = 0.55;
    Object.assign(S, { s0: 0, s1: 0, s2: 0, set: 0, studio: 0.1 });
    V.renderer.compile(scene, V.camera);
  },

  // ~14 s: lights strike, clap, record, slider move, drone, then the monitor with the campaign rising over it
  animate(tl, el, T) {
    const at = (t) => T + t;
    tl.set(S, { studio: 0.1, set: 0, rec: 0, blink: 0, slide: 0, clap: 0.5, clapY: -1, fly: 0, prop: 0, tc: 0, hearts: 0, screen: 0 }, 0)
      .set(S, { s0: 0, s1: 0, s2: 0 }, 0).set(rig, { ...SHOT[0] }, 0);
    tl.add(rig, { ...shotTween(SHOT[0], SHOT[1]), duration: this.len, ease: 'inOutSine' }, at(0));
    // 1. the lights strike one by one: a quick uneven stutter as each ballast catches, then steady
    [0, 1, 2].forEach((i) => tl.add(S, { ['s' + i]: [0, 0.85, 0.12, 0.6, 0.3, 1], duration: 380, ease: 'linear' }, at(500 + i * 520)));
    tl.add(S, { studio: [0.1, 0.3], set: [0, 1], duration: 1200 }, at(1800));
    // 2. the clapper rises into the lens, snaps, drops away
    tl.add(S, { clapY: [-1, 0], duration: 600, ease: 'outCubic' }, at(2400))
      .add(S, { clap: [0.5, 0], duration: 140, ease: 'inQuad' }, at(3150))
      .add(S, { clapY: [0, -1], duration: 380, ease: 'inCubic' }, at(3450));
    // 3. rolling: the tally light, the timecode, the slider glides
    tl.add(S, { rec: [0, 1], duration: 1 }, at(3200))
      .add(S, { blink: [0, 1], duration: 1000, loop: 10, ease: steps(2) }, at(3200))
      .add(S, { tc: [0, 10.8], duration: 10800, ease: 'linear' }, at(3200))
      .add(S, { slide: [0, 1], duration: 8000, ease: 'inOutSine' }, at(3400))
      .add(S, { screen: [0, 1], duration: 600 }, at(3300));
    // 4. the drone spins up, lifts off, climbs over the set, hovers
    tl.add(S, { prop: [0, 60], duration: 11000, ease: 'inQuad' }, at(4800))
      .add(S, { fly: [0, 1], duration: 3200, ease: 'inOutSine' }, at(5600));
    // 5. the campaign: likes rise over the live shot on the monitor
    tl.add(S, { hearts: [0, 1], duration: 4200, ease: 'linear' }, at(9200));
    return { tagAt: at(10300) };
  },

  render(bake = false) {
    if (!V) return;
    place(V, rig, 0.5);
    for (let i = 0; i < 3; i++) {
      const { diff, L, peak, beam } = lights[i], v = S['s' + i];
      L.intensity = peak * v; diff.material.color.setRGB(1, 0.96, 0.9).multiplyScalar(0.03 + (i === 2 ? 2.2 : 1.25) * v);
      if (beam) beam.userData.u.uOp.value = 0.16 * v;
    }
    F.hemi.intensity = S.studio; F.work.intensity = 5 * (1 - S.set * 0.7); F.practical.intensity = 2.2 * S.set;
    F.cycL.intensity = 9 * S.set; F.panel.material.color.setScalar(0.04 + 0.6 * S.set);
    F.shadeM.emissiveIntensity = 0.9 * S.set;
    F.dust.uT.value = FILM.t; F.dust.uOp.value = 0.02 + 0.22 * Math.max(S.s0, S.s2);
    if (F.envMax) V.scene.environmentIntensity = F.envMax * (0.3 + 0.7 * S.set);
    F.carriage.position.x = -0.6 + 1.2 * S.slide;
    // the cinema camera keeps the set framed as it glides (its lens points along +z)
    const cw = F.cam.getWorldPosition(F._cw || (F._cw = new THREE.Vector3()));
    F.cam.rotation.y = Math.atan2(0.3 - cw.x, -1.9 - cw.z) - F.slider.rotation.y;
    F.tally.material.color.setRGB(S.rec * (S.blink < 0.5 ? 1 : 0.15), 0.02, 0.02);
    // the clapper hangs in front of the cinema lens
    const lensW = F.cine.getWorldPosition(F._lw || (F._lw = new THREE.Vector3()));
    const dir = F.cine.getWorldDirection(F._dir || (F._dir = new THREE.Vector3()));
    F.clapper.position.copy(lensW).addScaledVector(dir, 0.75); F.clapper.position.y += S.clapY * 1.2;
    F.clapper.lookAt(lensW); F.clapArm.rotation.z = S.clap; F.clapper.visible = S.clapY > -0.98 && F.clapper.position.y > 0.45;
    // the drone: off its pad, up and over the set, a gentle hover
    const f = S.fly, t = S.tc;
    F.drone.position.set(0.6 - 0.9 * f, 0.004 + 2.0 * Math.sin(f * Math.PI / 2) + 0.04 * Math.sin(t * 2.3) * f, 1.3 - 1.4 * f);
    F.drone.rotation.set(0.07 * f * Math.sin(t * 1.7) + 0.12 * Math.sin(f * Math.PI), -0.6 * f, 0.05 * f * Math.sin(t * 1.3));
    F.props.forEach(({ p, blur, bladeM }, i) => { p.rotation.y = S.prop * (i % 2 ? -1 : 1); blur.material.opacity = Math.min(0.28, S.prop / 24); bladeM.opacity = S.prop > 12 ? 0.18 : 0.95; });
    if (bake) return;
    // the monitors: the cinema camera's view (small and every other frame while live; shadows reused), then the UI
    // (live, redrawn at most 12.5 times a second: the timecode still reads right, and the upload stays cheap)
    const key = S.screen ? `${S.screen.toFixed(2)}|${S.rec}|${S.blink < 0.5}|${Math.floor(S.tc * (RECORD ? 25 : 12.5))}|${Math.round(S.hearts * (RECORD ? 200 : 60))}` : '0';
    if (key !== uiKey) { uiKey = key; F.ui.userData.redraw(S); }
    // live, the work is spread over three frames: shadow maps on one, the monitor feed on the next, nothing extra on
    // the third (a lag nobody can see); the recording does both every frame
    const r = V.renderer, ph = frameNo++ % 3, odd = ph === 1;
    r.shadowMap.autoUpdate = false;
    if (RECORD || odd) {
      const prev = r.getRenderTarget();
      F.monitor.visible = F.overlay.visible = false;
      r.setRenderTarget(F.rt); r.render(V.scene, F.cine); r.setRenderTarget(prev);
      F.monitor.visible = F.overlay.visible = true;
    }
    r.shadowMap.needsUpdate = RECORD || ph === 0;
    F.monitor.material.color.setScalar(0.06 + 1.0 * S.screen);
    F.monLight.intensity = 0.8 * S.screen;
    V.render();
  },
};

// the director's monitor UI: frame guides, REC and timecode, the Tamlik mark, then likes rising
function drawUI(x, w, h, s = S) {
  if (!s || !s.screen) return;
  const k = w / 1024;
  x.save(); x.scale(k, k); w /= k; h /= k;
  x.globalAlpha = s.screen;
  x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 2;
  for (const a of [w / 3, 2 * w / 3]) { x.beginPath(); x.moveTo(a, 40); x.lineTo(a, h - 40); x.stroke(); }
  for (const b of [h / 3, 2 * h / 3]) { x.beginPath(); x.moveTo(40, b); x.lineTo(w - 40, b); x.stroke(); }
  x.lineWidth = 4; x.strokeStyle = 'rgba(255,255,255,.8)';
  for (const [cx, cy, dx, dy] of [[30, 30, 1, 1], [w - 30, 30, -1, 1], [30, h - 30, 1, -1], [w - 30, h - 30, -1, -1]]) { x.beginPath(); x.moveTo(cx, cy + dy * 40); x.lineTo(cx, cy); x.lineTo(cx + dx * 40, cy); x.stroke(); }
  x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, 0, w, 26); x.fillRect(0, h - 26, w, 26);
  x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '500 17px Manrope, monospace';
  x.fillText('A-CAM   ISO 800   5600K   T2.8   180°   25 FPS', 20, 19); x.fillText('3840×2160  ProRes 422 HQ', w - 250, h - 8);
  if (s.rec) {
    x.fillStyle = s.blink < 0.5 ? '#ff2d2d' : 'rgba(255,45,45,.25)'; x.beginPath(); x.arc(70, 72, 13, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.font = '600 30px Manrope, sans-serif'; x.fillText('REC', 94, 83);
    const sec = s.tc, fr = Math.floor((sec % 1) * 25);
    x.font = '500 30px Manrope, monospace'; x.fillText(`00:00:${String(Math.floor(sec)).padStart(2, '0')}:${String(fr).padStart(2, '0')}`, w - 250, 83);
  }
  // audio meters
  for (let i = 0; i < 2; i++) { x.fillStyle = 'rgba(255,255,255,.15)'; x.fillRect(w - 40 + i * 12, 120, 7, 200); if (s.rec) { const lv = 0.35 + 0.25 * Math.abs(Math.sin(s.tc * (7 + i * 3))); x.fillStyle = '#35d07f'; x.fillRect(w - 40 + i * 12, 120 + 200 * (1 - lv), 7, 200 * lv); } }
  x.strokeStyle = '#01A652'; x.lineWidth = 7; x.lineJoin = x.lineCap = 'round'; x.beginPath(); x.moveTo(60, h - 62); x.lineTo(86, h - 84); x.lineTo(112, h - 62); x.stroke();
  // likes rising
  if (s.hearts > 0) for (let i = 0; i < 14; i++) {
    const p = (s.hearts * 1.6 - i * 0.08); if (p <= 0 || p > 1) continue;
    const hx = w - 150 + Math.sin(i * 2.1 + p * 4) * 40, hy = h - 80 - p * (h - 160), sz = 22 + (i % 3) * 8;
    x.globalAlpha = s.screen * Math.min(1, (1 - p) * 2.5);
    x.fillStyle = i % 4 ? '#19d67a' : '#3ad7ff';
    x.beginPath(); x.moveTo(hx, hy + sz * 0.35);
    x.bezierCurveTo(hx - sz, hy - sz * 0.4, hx - sz * 0.35, hy - sz, hx, hy - sz * 0.45);
    x.bezierCurveTo(hx + sz * 0.35, hy - sz, hx + sz, hy - sz * 0.4, hx, hy + sz * 0.35); x.fill();
  }
  if (s.hearts > 0) { x.globalAlpha = s.screen; x.fillStyle = '#fff'; x.font = '600 28px Manrope, sans-serif'; x.fillText(`♥ ${Math.floor(s.hearts * 12480).toLocaleString('en')}`, w - 210, h - 50); }
  x.restore();
}
