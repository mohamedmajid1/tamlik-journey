// Tamlik Fit-out: a contemporary Muscat apartment being finished, ending as a lived-in home at sunset.
// The shell is raw: grey skim-coat walls and ceiling, a concrete screed floor, bare glazing onto the city. The walls
// and the gypsum ceiling are painted from the top down, oak planks are laid in a wave from the window, the walnut
// slat feature wall rises, a rug unrolls, then every piece of furniture is built from the floor up behind a thin
// brass line (no pops, nothing flies): the TV console, the sectional, the chairs, the dining table. The hidden
// LED cove, the downlights and the pendants come on, the sun sinks into gold, the shafts of light fill with dust,
// and the finishing touches arrive: books, vases, cushions, prints of the Tamlik tower.
// Real CC0 furniture from Poly Haven; Three.js with the shared kit (AgX, AO, baked room reflections, film finish);
// Anime.js for every move. animate() adds the motion at T (ms); render() draws the current state.
import { THREE, tex, surface, model, seat, topOf, ready, makeView, aim, shotTween, reveal, syncReveals, bakeEnv, dust, shaft, handheld, FILM, place } from '../three/kit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C } from '../brand.js';

const XW = -4, XE = 4.6, D = 3, H = 3, SOF = 2.72;      // window wall x, far (behind camera) wall x, half depth, ceiling, soffit underside
const BRASS = 0xffc98a;
let V, SHOT, T0 = 0;
const rig = {};
const U = { paint: { value: 0 }, sway: { value: 0 }, floor: { value: 0 }, slats: { value: 0 } };
const S = { sun: 0, warm: 0, cove: 0, down: 0, pend: 0, lamp: 0, tv: 0, expo: 0.8, open: 0 };
const curtains = [];
const pieces = [], lamps = [], accessories = [], downs = [], spots = [], shafts = [];
let linen, rug, view, cove, ceilGlow, hemi, sun, dustU, tvScreen, consoleLed, floorLamp;
let rnd = (() => { let s = 5; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

// the paint line: raw grey skim coat above/below a moving edge, fresh warm white behind it, a wet sheen on the edge
function painted(mat, fresh = [0.80, 0.785, 0.76]) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uPaint = U.paint;
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uPaint; varying vec3 vWp;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float edge = ${(H + 0.25).toFixed(2)} - uPaint * ${(H + 0.6).toFixed(2)} + sin(vWp.x * 3.1 + vWp.z * 2.3) * 0.03;
      float p = smoothstep(edge - 0.025, edge + 0.025, vWp.y);
      vec3 raw = diffuseColor.rgb * vec3(0.50, 0.50, 0.51);
      vec3 fin = mix(vec3(${fresh.join(', ')}), diffuseColor.rgb, 0.18);
      diffuseColor.rgb = mix(raw, fin, p) * (1.0 - 0.10 * exp(-((vWp.y - edge) * (vWp.y - edge)) / 0.0009) * step(0.001, uPaint) * step(uPaint, 0.999));`);
  };
  mat.customProgramCacheKey = () => 'painted' + fresh.join();
  return mat;
}

// a soft sun shaft: like kit.shaft, but feathered on every side (no hard box edges) and fading with depth
function softShaft(from, to, w, h, color) {
  const len = from.distanceTo(to), geo = new THREE.PlaneGeometry(w, len, 1, 1); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, len / 2);
  const u = { uCol: { value: new THREE.Color(color) }, uOp: { value: 0 } };
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: u,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uCol; uniform float uOp; varying vec2 vUv;
      void main(){ float a = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x) * smoothstep(0.0, 0.25, vUv.y) * pow(clamp(vUv.y, 0.0, 1.0), 1.6);
        gl_FragColor = vec4(uCol, uOp * a); }` });
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(geo, m); p.position.y = (i / 3 - 0.5) * h; g.add(p); p.renderOrder = 5; }
  g.position.copy(from); g.lookAt(to); g.userData.u = u; return g;
}

// planks / slats: one instanced mesh, each instance its own cut of the walnut veneer grain and its own tint
function grainInstances(mesh, { along = 'x', size, tint }) {
  const n = mesh.count, off = new Float32Array(n * 2), tn = new Float32Array(n);
  for (let i = 0; i < n; i++) { off[i * 2] = rnd() * 7; off[i * 2 + 1] = rnd() * 7; tn[i] = rnd(); }
  mesh.geometry.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2));
  mesh.geometry.setAttribute('aTn', new THREE.InstancedBufferAttribute(tn, 1));
  return { off, tn };
}

export const fitout = {
  id: 'fitout', name: 'FIT-OUT', accent: C.brass, glow: 'rgba(217,183,121,.14)',
  tagline: 'We shape your <b>space</b>',
  full: true,
  // the way in from the city (main.js): the window sits in the plane dot(n, p) = d, between span[0]..span[1] along
  // the wall and y[0]..y[1] above the floor; everything on the far side of that plane is cut away while seen from outside
  door: { n: [1, 0, 0], d: 4.58, span: [-2.75, 2.75], y: [0.15, 2.6] },
  shots: () => SHOT, view: () => V,
  html: () => '<canvas class="room"></canvas><div class="shade top"></div><div class="shade bottom"></div>',

  async init(el, { portrait, record }) {
    V = await makeView(el.querySelector('canvas.room'), { portrait, record, env: 'lebombo', envIntensity: 0.25, bloom: 0.14, fov: [58, 40] });
    const { scene } = V;
    scene.background = new THREE.Color(0x0b0a09);
    // portrait: from beside the TV wall, across the sofa to the dining corner and the glazing;
    // landscape: from the dining side, the whole room with the slat wall on the left and the sunset glazing
    SHOT = portrait
      ? [{ x: 3.5, y: 1.5, z: -1.1, tx: -1.3, ty: 1.2, tz: 3.0 }, { x: 2.75, y: 1.42, z: 1.6, tx: -3.2, ty: 1.02, tz: -0.9 }]
      : [{ x: 4.2, y: 1.6, z: -0.9, tx: -2.4, ty: 1.05, tz: 2.1 }, { x: 3.1, y: 1.5, z: 1.95, tx: -3.6, ty: 1.02, tz: -2.9 }];
    Object.assign(rig, SHOT[0]);

    // ---- the shell ------------------------------------------------------------------------------------
    const wallMat = painted(surface('plastered_wall', 1.6, { color: 0xf2f0ec, roughness: 0.94, normalScale: new THREE.Vector2(0.6, 0.6) }));
    const box = (w, h, d, x, y, z, m = wallMat, shadow = true) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.receiveShadow = true; b.castShadow = shadow; scene.add(b); return b; };
    const L = XE - XW, CX = (XE + XW) / 2;
    box(L, H, 0.2, CX, H / 2, D + 0.1);                  // TV wall (z = +3)
    box(L, H, 0.2, CX, H / 2, -D - 0.1);                 // dining wall (z = -3)
    box(0.2, H, 2 * D, XE + 0.1, H / 2, 0);              // behind the camera
    // gypsum ceiling: a perimeter soffit (drop) with a hidden LED slot, a recessed centre
    const sw = 0.55, sh = H - SOF - 0.08;
    box(L, sh, sw, CX, SOF + sh / 2, D - sw / 2); box(L, sh, sw, CX, SOF + sh / 2, -D + sw / 2);
    box(sw + 0.2, sh, 2 * D, XW + (sw + 0.2) / 2 - 0.2, SOF + sh / 2, 0); box(sw, sh, 2 * D, XE - sw / 2, SOF + sh / 2, 0);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(L + 0.4, 2 * D), painted(new THREE.MeshStandardMaterial({ color: 0xefebe4, roughness: 0.95 })));
    top.rotation.x = Math.PI / 2; top.position.set(CX, H, 0); scene.add(top);
    // the LED cove: a warm line in the slot and its wash spreading across the recessed ceiling
    const washTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      const img = x.createImageData(256, 256);
      for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) { const u = i / 255, v = j / 255, fx = Math.min(u, 1 - u) * 8.6, fz = Math.min(v, 1 - v) * 6;
        const a = Math.exp(-Math.min(fx, fz) * 3.2) * 255; const k = (j * 256 + i) * 4; img.data[k] = a; img.data[k + 1] = a * 0.8; img.data[k + 2] = a * 0.55; img.data[k + 3] = 255; }
      x.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    ceilGlow = new THREE.Mesh(new THREE.PlaneGeometry(L - 2 * sw - 0.2, 2 * D - 2 * sw), new THREE.MeshBasicMaterial({ map: washTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    ceilGlow.rotation.x = Math.PI / 2; ceilGlow.position.set(CX + 0.1, H - 0.003, 0); scene.add(ceilGlow);
    const coveM = new THREE.MeshBasicMaterial({ color: 0x000000 });
    cove = coveM;
    const inX0 = XW + sw, inX1 = XE - sw, inZ = D - sw;
    for (const [w, d, x, z] of [[inX1 - inX0, 0.02, (inX0 + inX1) / 2, inZ - 0.03], [inX1 - inX0, 0.02, (inX0 + inX1) / 2, -inZ + 0.03], [0.02, 2 * inZ, inX0 + 0.03, 0], [0.02, 2 * inZ, inX1 - 0.03, 0]]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), coveM); s.position.set(x, SOF + sh + 0.01, z); scene.add(s);
    }
    // a linear AC diffuser in the window soffit, an access hatch, a thermostat and switches on the dining wall
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 3.4), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.6 }));
    slot.rotation.set(Math.PI / 2, 0, 0); slot.position.set(XW + 0.3, SOF - 0.001, -0.2); scene.add(slot);
    const plateM = new THREE.MeshStandardMaterial({ color: 0xece9e3, roughness: 0.35 });
    for (const [x, y, w, h] of [[3.55, 1.2, 0.086, 0.086], [3.66, 1.2, 0.086, 0.086], [3.6, 1.45, 0.09, 0.12]]) box(w, h, 0.012, x, y, -D + 0.006, plateM, false);
    const thermo = box(0.08, 0.05, 0.004, 3.6, 1.47, -D + 0.014, new THREE.MeshBasicMaterial({ color: 0x1b2a30 }), false); thermo.userData.screen = true;
    // skirting (painted with the walls, a shadow gap above)
    const skirtM = new THREE.MeshStandardMaterial({ color: 0xe7e2da, roughness: 0.45 });
    box(L, 0.1, 0.015, CX, 0.05, D - 0.008, skirtM, false); box(L, 0.1, 0.015, CX, 0.05, -D + 0.008, skirtM, false);

    // ---- the glazing: slim black aluminium, full height, the city at sunset beyond ------------------------
    const alu = new THREE.MeshStandardMaterial({ color: 0x1a1a1b, roughness: 0.35, metalness: 0.7 });
    for (const z of [-3, -1.5, 0, 1.5, 3]) box(0.1, SOF, 0.05, XW - 0.02, SOF / 2, z, alu);
    box(0.12, 0.05, 2 * D, XW - 0.02, 0.025, 0, alu); box(0.12, 0.04, 2 * D, XW - 0.02, SOF - 0.02, 0, alu);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2 * D, SOF), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.06, envMapIntensity: 0.6 }));
    glass.rotation.y = Math.PI / 2; glass.position.set(XW - 0.02, SOF / 2, 0); scene.add(glass);
    const vt = tex('assets/posts/film_0.1.jpg', 1, true); vt.wrapS = vt.wrapT = THREE.ClampToEdgeWrapping;
    view = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ map: vt, fog: false }));
    view.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec3 vc = diffuseColor.rgb; float vl = dot(vc, vec3(0.2126, 0.7152, 0.0722));
      vc = mix(vec3(vl), vc, 1.05); vc = max(vec3(0.0), (vc - 0.2) * 1.22 + 0.2); diffuseColor.rgb = vc;`); };
    view.rotation.y = Math.PI / 2; view.position.set(XW - 11, -0.9, -1.5); scene.add(view);
    // a balcony slab edge and a glass balustrade just outside
    box(0.9, 0.18, 2 * D + 0.4, XW - 0.55, -0.09, 0, new THREE.MeshStandardMaterial({ color: 0x8d877e, roughness: 0.8 }), false);
    const bal = new THREE.Mesh(new THREE.PlaneGeometry(2 * D + 0.4, 1.0), new THREE.MeshPhysicalMaterial({ color: 0xbfd6d8, roughness: 0.05, transparent: true, opacity: 0.12 }));
    bal.rotation.y = Math.PI / 2; bal.position.set(XW - 0.95, 0.5, 0); scene.add(bal);
    box(0.04, 0.04, 2 * D + 0.4, XW - 0.95, 1.02, 0, alu, false);

    // ---- the floor: a concrete screed, then wide oak planks laid in a wave from the window ------------------
    const screed = new THREE.Mesh(new THREE.PlaneGeometry(L, 2 * D), surface('concrete_floor_02', 2.5, { color: 0x8a8886, roughness: 0.95 }));
    screed.rotation.x = -Math.PI / 2; screed.position.set(CX, -0.018, 0); screed.receiveShadow = true; scene.add(screed);
    const PW = 0.22, PL = 1.8, rows = Math.ceil(2 * D / PW), perRow = Math.ceil(L / PL) + 1;
    const oak = surface('walnut_veneer', 1, { color: new THREE.Color(1.3, 1.16, 0.98), roughness: 0.55, envMapIntensity: 0.9 });
    oak.roughnessMap = null;
    const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(PL - 0.004, 0.018, PW - 0.003), oak, rows * perRow);
    planks.geometry.translate(0, -0.009, 0);
    const arr = new Float32Array(rows * perRow), m4 = new THREE.Matrix4();
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const stagger = (r * 0.37 * PL) % PL;
      for (let c = 0; c < perRow; c++, k++) {
        const x = XW + c * PL - stagger + PL / 2, z = -D + r * PW + PW / 2;
        // clip the last plank of each row to the room (scale along its length)
        const x0 = Math.max(XW, x - PL / 2), x1 = Math.min(XE, x + PL / 2), len = Math.max(0.001, x1 - x0);
        m4.makeScale(len / PL, 1, 1).setPosition((x0 + x1) / 2, 0, z); planks.setMatrixAt(k, m4);
        arr[k] = 2.3 + ((x0 - XW) / L) * 2.2 + (r % 2) * 0.06 + rnd() * 0.12;   // seconds into the scene
      }
    }
    grainInstances(planks, {});
    planks.geometry.setAttribute('aT', new THREE.InstancedBufferAttribute(arr, 1));
    planks.receiveShadow = true; planks.castShadow = false; planks.frustumCulled = false;
    oak.onBeforeCompile = (sh) => {
      sh.uniforms.uFloor = U.floor;
      sh.vertexShader = 'attribute vec2 aOff; attribute float aTn; attribute float aT; uniform float uFloor; varying float vTn;\n' + sh.vertexShader
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vec2 tuv = vec2(uv.y * ${(PW * 0.9).toFixed(3)}, uv.x * ${(PL * 0.9).toFixed(3)}) + aOff;
          #ifdef USE_MAP
          vMapUv = tuv;
          #endif
          #ifdef USE_NORMALMAP
          vNormalMapUv = tuv;
          #endif
          vTn = aTn;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float kk = clamp((uFloor - aT) / 0.42, 0.0, 1.0); float e = 1.0 - kk; e = e * e * e;
          transformed.y += e * 0.09; transformed.x += e * 0.28;
          if (kk <= 0.0) transformed *= 0.0;`);
      sh.fragmentShader = 'varying float vTn;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          diffuseColor.rgb *= 0.86 + 0.26 * vTn;`);
    };
    oak.customProgramCacheKey = () => 'planks';
    scene.add(planks);

    // ---- the walnut slat feature wall with the floating console and the TV (z = +3) ------------------------
    const wal = surface('walnut_veneer', 1, { color: new THREE.Color(0.85, 0.72, 0.6), roughness: 0.5 });
    wal.roughnessMap = null;
    const SW = 0.045, SG = 0.022, SX0 = -2.9, SX1 = 2.3, NS = Math.floor((SX1 - SX0) / (SW + SG));
    const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(SW, SOF, 0.03), wal, NS);
    for (let i = 0; i < NS; i++) { m4.makeTranslation(SX0 + i * (SW + SG), SOF / 2, D - 0.045); slats.setMatrixAt(i, m4); }
    grainInstances(slats, {});
    slats.castShadow = slats.receiveShadow = true;
    wal.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute vec2 aOff; attribute float aTn; varying float vTn;\n' + sh.vertexShader
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vec2 tuv = vec2(uv.x * ${SW}, uv.y * ${(SOF * 0.8).toFixed(3)}) + aOff;
          #ifdef USE_MAP
          vMapUv = tuv;
          #endif
          #ifdef USE_NORMALMAP
          vNormalMapUv = tuv;
          #endif
          vTn = aTn;`);
      sh.fragmentShader = 'varying float vTn;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          diffuseColor.rgb *= 0.88 + 0.22 * vTn;`);
    };
    wal.customProgramCacheKey = () => 'slats';
    // the slats rise one after another, left to right: their instance matrices grow (so shadows and AO follow)
    this.growSlats = (v) => {
      for (let i = 0; i < NS; i++) {
        const sk = Math.min(1, Math.max(0, v * 1.6 - (i / NS) * 0.6));
        m4.makeScale(1, Math.max(sk, 0.0001), 1).setPosition(SX0 + i * (SW + SG), (SOF * sk) / 2, D - 0.045); slats.setMatrixAt(i, m4);
      }
      slats.instanceMatrix.needsUpdate = true; slats.visible = v > 0.001;
    };
    scene.add(slats);
    const backing = box(SX1 - SX0 + 0.1, SOF, 0.012, (SX0 + SX1) / 2 - SW / 2, SOF / 2, D - 0.006, new THREE.MeshStandardMaterial({ color: 0x191512, roughness: 0.8 }), false);
    backing.userData.slat = true; this.backing = backing;

    const consoleG = new THREE.Group();
    const lacquer = new THREE.MeshStandardMaterial({ color: 0x2b2826, roughness: 0.38 });
    const cb = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.34, 0.44, 3, 0.01), lacquer); cb.position.set(0, 0.47, 0); cb.castShadow = cb.receiveShadow = true; consoleG.add(cb);
    const ctop = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.025, 0.46), surface('marble_01', 1, { color: 0xf2eee8, roughness: 0.35 })); ctop.position.set(0, 0.652, 0); ctop.castShadow = ctop.receiveShadow = true; consoleG.add(ctop);
    for (const x of [-0.65, 0.65]) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.3, 0.004), new THREE.MeshStandardMaterial({ color: 0x0d0d0d })); g.position.set(x, 0.47, -0.222); consoleG.add(g); }
    consoleLed = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    consoleLed.rotation.x = -Math.PI / 2; consoleLed.position.set(0, 0.003, 0.02); consoleG.add(consoleLed);
    // a 75" TV: black glass that reflects the room while off, the Tamlik lobby on screen once the lights are up
    const tvBody = new THREE.Mesh(new RoundedBoxGeometry(1.68, 0.96, 0.035, 2, 0.006), new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.4, metalness: 0.5 }));
    tvBody.position.set(0, 1.5, 0.02); tvBody.castShadow = true; consoleG.add(tvBody);
    tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 0.92), new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.06, metalness: 0.2,
      emissiveMap: tex('assets/posts/film_0.6.jpg', 1, true), emissive: 0x000000 }));
    tvScreen.material.emissiveMap.repeat.set(1, 0.5625); tvScreen.material.emissiveMap.offset.set(0, 0.2);
    tvScreen.position.set(0, 1.5, -0.0); tvScreen.rotation.y = Math.PI; consoleG.add(tvScreen);
    consoleG.rotation.y = Math.PI; consoleG.position.set(-0.3, 0, D - 0.28);
    scene.add(consoleG);

    // ---- sheer linen curtains: drawn across the whole glazing at first, then pulled open to both ends ----------
    // Each panel is modelled at its drawn (closed) width with its pleats; the vertex shader gathers it towards its
    // stacking end as uOpen goes 0 -> 1, the pleats deepening as the fabric bunches and the hem trailing the head
    // rail slightly, the way a real sheer moves. Normals follow the same squeeze, so the folds keep their shading.
    linen = new THREE.MeshStandardMaterial({ emissive: 0x000000, map: tex('assets/tex3d/rough_linen/diffuse.jpg', 2, true), normalMap: tex('assets/tex3d/rough_linen/nor_gl.jpg', 2),
      normalScale: new THREE.Vector2(0.6, 0.6), color: 0xf6eee2, roughness: 1, transparent: true, opacity: 0.86, side: THREE.DoubleSide });
    const HALF = D - 0.05;                                                  // each panel covers half the glazing when drawn
    for (const [side, gathered] of [[-1, 1.0], [1, 1.3]]) {
      const cz = side * HALF / 2, anchor = side < 0 ? HALF / 2 : -HALF / 2;  // local x of the stacking end (local x = cz - world z)
      const cg = new THREE.PlaneGeometry(HALF, SOF - 0.04, 260, 10), cp = cg.attributes.position;
      for (let i = 0; i < cp.count; i++) { const x = cp.getX(i); cp.setZ(i, Math.sin(x * 22) * 0.03 + Math.sin(x * 8.1 + 1) * 0.015); }
      cg.computeVertexNormals();
      const m = linen.clone(), u = { uSway: U.sway, uOpen: { value: 0 }, uAnchor: { value: anchor }, uK: { value: gathered / HALF } };
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, u);
        sh.vertexShader = 'uniform float uSway, uOpen, uAnchor, uK;\n' + sh.vertexShader
          .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
            float hangN = 1.0 - uv.y, oN = clamp(uOpen * 1.1 - hangN * 0.1, 0.0, 1.0);
            float kN = mix(1.0, uK, oN), dN = mix(1.0, 1.9, oN);
            objectNormal = normalize(vec3(objectNormal.x / kN, objectNormal.y, objectNormal.z / dN));`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            float hang = 1.0 - uv.y, o = clamp(uOpen * 1.1 - hang * 0.1, 0.0, 1.0);
            transformed.x = uAnchor + (transformed.x - uAnchor) * mix(1.0, uK, o);
            transformed.z *= mix(1.0, 1.9, o);
            transformed.z += sin(position.x * 6.0 + uSway) * 0.02 * hang + sin(uSway * 2.3 + position.x * 3.0) * 0.012 * hang * o * (1.0 - o) * 4.0;`);
      };
      m.customProgramCacheKey = () => 'curtain';
      const c = new THREE.Mesh(cg, m); c.rotation.y = Math.PI / 2; c.position.set(XW + 0.16, (SOF - 0.04) / 2 + 0.02, cz); c.castShadow = false; scene.add(c);
      curtains.push({ m, u });
    }

    // ---- rug -----------------------------------------------------------------------------------------
    rug = new THREE.Mesh(new RoundedBoxGeometry(3.3, 0.014, 2.5, 2, 0.006), new THREE.MeshStandardMaterial({ map: tex('assets/tex3d/hessian_230/diffuse.jpg', 5, true), normalMap: tex('assets/tex3d/hessian_230/nor_gl.jpg', 5), roughness: 1, color: 0xe9dcc6 }));
    rug.geometry.translate(0, 0.007, 1.25); rug.position.set(-0.45, 0.001, -0.75); rug.receiveShadow = true; scene.add(rug);

    // ---- furniture --------------------------------------------------------------------------------------
    const put = async (n, x, z, ry = 0, s = 1, y = 0, list = null) => {
      const h = seat(await model(n), s); h.rotation.y = ry; h.position.set(x, y, z); scene.add(h); if (list) list.push(h); return h;
    };
    // a modern low sectional in warm grey wool: cushions, a chaise, a folded throw
    const wool = new THREE.MeshStandardMaterial({ map: tex('assets/tex3d/poly_wool_herringbone/diffuse.jpg', 3, true), normalMap: tex('assets/tex3d/poly_wool_herringbone/nor_gl.jpg', 3), roughness: 1, color: 0xd9d4cc });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.35, metalness: 0.8 });
    const sofa = new THREE.Group();
    const rb = (w, h, d, x, y, z, m = wool, r = 0.06) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 5, r), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; sofa.add(b); };
    rb(2.9, 0.2, 0.98, 0, 0.2, 0, wool, 0.05);
    rb(0.95, 0.2, 1.7, 0.975, 0.2, 0.36, wool, 0.05);
    for (const x of [-1.0, -0.02]) rb(0.96, 0.17, 0.82, x, 0.385, 0.06, wool, 0.075);
    rb(0.93, 0.17, 1.58, 0.975, 0.385, 0.42, wool, 0.075);
    for (const x of [-1.0, -0.02, 0.96]) rb(0.95, 0.46, 0.24, x, 0.62, -0.37, wool, 0.1);
    rb(0.22, 0.52, 0.98, -1.55, 0.36, 0, wool, 0.09);
    for (const [x, z] of [[-1.5, -0.4], [-1.5, 0.4], [1.35, -0.4], [1.35, 1.12], [0.55, 1.12]]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.1, 12), legMat); l.position.set(x, 0.05, z); sofa.add(l);
    }
    const throwM = new THREE.MeshStandardMaterial({ map: tex('assets/tex3d/rough_linen/diffuse.jpg', 1.5, true), color: 0xa97a52, roughness: 1 });
    const th = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.05, 0.45, 3, 0.02), throwM); th.position.set(1.05, 0.49, 0.75); th.rotation.y = 0.15; th.castShadow = true; sofa.add(th);
    sofa.position.set(-0.55, 0, -0.95); scene.add(sofa);
    const table = await put('modern_coffee_table_01', -0.6, 0.55, Math.PI / 2, 1.05);
    const lounge = await put('mid_century_lounge_chair', -2.85, 1.55, Math.PI * 0.72);
    const arm = await put('modern_arm_chair_01', 1.9, 0.9, -Math.PI * 0.62);
    const sideT = await put('side_table_tall_01', -2.35, -1.0, 0);
    // an arc floor lamp over the lounge chair: marble base, brushed steel arc, a dark dome
    floorLamp = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9b3a8, metalness: 1, roughness: 0.28 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.06, 32), surface('marble_01', 0.5, { color: 0xf0ede8, roughness: 0.3 })); base.position.y = 0.03; base.castShadow = true; floorLamp.add(base);
    const arcC = new THREE.CatmullRomCurve3([[0, 0.06, 0], [0.05, 1.2, 0], [0.4, 1.95, 0], [1.05, 2.05, 0], [1.4, 1.75, 0]].map((p) => new THREE.Vector3(...p)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(arcC, 80, 0.012, 10), steel); tube.castShadow = true; floorLamp.add(tube);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1c1b19, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }));
    dome.position.set(1.4, 1.72, 0); dome.castShadow = true; floorLamp.add(dome);
    const bulbF = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000 })); bulbF.position.set(1.4, 1.66, 0); floorLamp.add(bulbF);
    const fl = new THREE.PointLight(0xffc27a, 0, 5, 1.8); fl.position.set(1.4, 1.55, 0); floorLamp.add(fl);
    floorLamp.position.set(-3.55, 0, 2.55); floorLamp.rotation.y = Math.PI * 0.3; scene.add(floorLamp);
    // lights live in the scene, not inside the pieces that get built: a light inside a hidden object drops out of
    // the light count, and every material would recompile the moment it appears (a visible stall)
    floorLamp.updateMatrixWorld(true); scene.attach(fl);
    floorLamp.userData = { light: fl, bulb: bulbF };
    // the dining corner by the glazing: a table for four under two pendants
    const dining = await put('dining_table', -2.3, -1.95, 0, 0.9);
    const chairs = [];
    for (const [x, z, ry] of [[-2.85, -2.62, 0], [-1.75, -2.62, 0], [-2.85, -1.28, Math.PI], [-1.75, -1.28, Math.PI]]) chairs.push(await put('dining_chair_02', x, z, ry));
    const sideboard = await put('modern_wooden_cabinet', 1.25, -D + 0.25, 0, 0.66);
    const shelves = await put('wooden_display_shelves_01', 3.15, -D + 0.22, Math.PI / 2, 1.15);
    const plants = [await put('potted_plant_01', -3.5, 2.55 - 1.1, 0.4, 1.2), await put('potted_plant_02', 2.35, -D + 0.35, 1.1, 1.25), await put('ceramic_pot', -3.45, 0.2, 0.6, 1.0)];
    const basket = await put('wicker_basket_02', -2.3, -0.3, 0.4, 1.2);
    // pendants over the dining table
    for (const x of [-2.75, -1.85]) {
      const p = await put('modern_ceiling_lamp_01', x, -1.95, 0, 0.95, H);
      const b = new THREE.Box3().setFromObject(p); p.children[0].position.y -= b.max.y - b.min.y + 0.35;
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.4, 6), legMat); cord.position.y = -0.2; p.add(cord);
      const Lp = new THREE.PointLight(0xffc27a, 0, 6, 1.8); Lp.position.set(0, -(b.max.y - b.min.y) - 0.3, 0); Lp.castShadow = record; if (record) Lp.shadow.mapSize.set(1024, 1024); Lp.shadow.bias = -0.002;
      // live: one light for the pair (half the lighting cost), placed between them; recording: one each
      if (!record) { Lp.position.x += 0.45; Lp.userData.k = 2; }
      if (record || x === -2.75) { p.add(Lp); p.updateMatrixWorld(true); scene.attach(Lp); } p.userData.light = record || x === -2.75 ? Lp : null; lamps.push(p);
    }
    // accessories on their surfaces
    const tableTop = topOf(table), sbTop = topOf(sideboard), shTop = topOf(shelves);
    accessories.push(await put('throw_pillows_01', -1.25, -1.2, 0, 0.9, 0.42));
    accessories.push(await put('brass_vase_01', -0.75, 0.45, 0, 0.55, tableTop));
    const books = new THREE.Group(); books.position.set(-0.4, tableTop, 0.72); books.rotation.y = 0.3;
    [[0x2d3b35, 0.04], [0xd8cdb8, 0.035], [0x7a4b33, 0.03]].reduce((y, [c, t], i) => {
      const bk = new THREE.Mesh(new RoundedBoxGeometry(0.3 - i * 0.03, t, 0.22 - i * 0.02, 2, 0.004), new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
      bk.position.y = y + t / 2; bk.rotation.y = i * 0.12; bk.castShadow = true; books.add(bk); return y + t;
    }, 0);
    scene.add(books); accessories.push(books);
    accessories.push(await put('brass_vase_03', -2.35, -1.0, 0, 1.4, topOf(sideT)));
    accessories.push(await put('ceramic_vase_02', 0.55, -D + 0.25, 0, 1, sbTop));
    accessories.push(await put('standing_picture_frame_02', 1.9, -D + 0.3, -0.25, 2.1, sbTop));
    accessories.push(await put('book_encyclopedia_set_01', 3.15, -D + 0.24, Math.PI / 2, 1.0, shTop));
    accessories.push(await put('ceramic_vase_03', 2.95, -D + 0.22, 0, 1.1, shTop));
    accessories.push(await put('potted_plant_04', -2.3, -1.95, 0, 0.9, topOf(dining)));
    accessories.push(await put('ceramic_vase_04', -0.9, D - 0.28, 0, 0.9, 0.665));
    // two framed prints of the Tamlik tower above the sideboard (stills from the tower film)
    for (const [x, img] of [[0.65, 'film_0.4'], [1.85, 'film_0.88']]) {
      const art = new THREE.Group(); art.position.set(x, 1.62, -D + 0.02);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.98, 0.035), new THREE.MeshStandardMaterial({ color: 0x151412, roughness: 0.5 }));
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), new THREE.MeshStandardMaterial({ color: 0xf3efe8, roughness: 0.9 }));
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), new THREE.MeshStandardMaterial({ map: tex('assets/posts/' + img + '.jpg', 1, true), roughness: 0.6 }));
      fr.position.z = 0.018; mat.position.z = 0.036; pic.position.z = 0.037; fr.castShadow = true;
      art.add(fr, mat, pic); scene.add(art); accessories.push(art);
    }

    // ---- light --------------------------------------------------------------------------------------------
    hemi = new THREE.HemisphereLight(0xa9bddc, 0x4a4540, 0.35); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffb070, 0); sun.position.set(XW - 11, 2.9, 3.4); sun.target.position.set(0, 0, -0.6);
    sun.castShadow = true; sun.shadow.mapSize.set(record ? 4096 : 2048, record ? 4096 : 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.025;
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 5, bottom: -5, near: 2, far: 30 });
    scene.add(sun, sun.target);
    // recessed downlights in the soffit: discs, and spots that graze the slat wall and light the dining wall
    const ringM = new THREE.MeshStandardMaterial({ color: 0xd9d4cc, metalness: 0.8, roughness: 0.3 });
    const dl = [[-2.2, D - sw / 2, 1], [-0.3, D - sw / 2, 1], [1.6, D - sw / 2, 1], [-1.6, -D + sw / 2, record], [1.25, -D + sw / 2, record], [XW + 0.3, -1.6, 0], [XW + 0.3, 1.2, 0], [XE - sw / 2, 0, 0]];
    for (const [x, z, spot] of dl) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 24), ringM); ring.rotation.x = Math.PI / 2; ring.position.set(x, SOF - 0.003, z); scene.add(ring);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.044, 24), new THREE.MeshBasicMaterial({ color: 0x000000 })); disc.rotation.x = Math.PI / 2; disc.position.set(x, SOF - 0.004, z); scene.add(disc);
      downs.push({ disc, v: { on: 0 } });
      if (spot) {
        const sl = new THREE.SpotLight(0xffd7a8, 0, 6, 0.62, 0.75, 1.6); sl.position.set(x, SOF - 0.02, z);
        sl.target.position.set(x, 0, z > 0 ? z - 0.05 : z + 0.05); sl.castShadow = record; if (record) { sl.shadow.mapSize.set(1024, 1024); sl.shadow.bias = -0.0005; }
        scene.add(sl, sl.target); spots.push(sl);
      }
    }
    // sun shafts through the glazing, and dust turning in them
    const sd = new THREE.Vector3().subVectors(sun.target.position, sun.position).normalize();
    for (const z of [-0.8, 0.75, 2.2]) {
      const from = new THREE.Vector3(XW - 0.1, 1.35, z), b = softShaft(from, from.clone().addScaledVector(sd, 7), 1.3, 2.2, 0xffc48a);
      scene.add(b); shafts.push(b);
    }
    dustU = dust(scene, { min: new THREE.Vector3(XW + 0.1, 0.1, -D + 0.2), max: new THREE.Vector3(1.8, SOF - 0.1, D - 0.3), count: 520, size: 0.009, color: 0xffe2b8, opacity: 0 });

    await ready();

    // everything that gets built: hidden now, built from the floor up later
    const build = [consoleG, sofa, table, lounge, floorLamp, arm, dining, ...chairs, sideboard, shelves, sideT, ...plants, basket];
    this.build = build.map((o) => reveal(o, { color: BRASS, glow: 3 }));
    this.lampsU = lamps.map((o) => reveal(o, { color: BRASS, glow: 3 }));
    this.accU = accessories.map((o) => reveal(o, { color: BRASS, glow: 2.5 }));
    tvScreen = consoleG.children.find((m) => m.geometry && m.geometry.parameters && m.geometry.parameters.width === 1.64);
    floorLamp.userData.bulb = floorLamp.children.find((m) => m.geometry && m.geometry.type === 'SphereGeometry' && m.geometry.parameters.radius === 0.05);

    // reflections of the finished room (shell, floor, walnut, lit cove and lamps, the sunset), without furniture
    Object.assign(S, { sun: 5.0, warm: 1, cove: 1, down: 1, pend: 1, lamp: 1, tv: 0 }); U.paint.value = 1; U.floor.value = 99; U.slats.value = 1;
    for (const u of [...this.build, ...this.lampsU, ...this.accU]) u.value = 0;
    this.light(); syncReveals();
    bakeEnv(V, new THREE.Vector3(-0.2, 1.4, 0), { size: 256, intensity: 0.32 });
    for (const u of [...this.build, ...this.lampsU, ...this.accU]) u.value = 1;
    syncReveals();
    V.renderer.compile(scene, V.camera);
  },

  // ~14 s: paint, slats, floor, rug, furniture built up, lights, sunset, finishing touches; a slow dolly throughout
  animate(tl, el, T) {
    T0 = T;
    const at = (t) => T + t;
    tl.set(U.paint, { value: 0 }, 0).set(U.slats, { value: 0 }, 0).set(U.floor, { value: 0 }, 0).set(U.sway, { value: 0 }, 0)
      .set(S, { sun: 1.8, warm: 0, cove: 0, down: 0, pend: 0, lamp: 0, tv: 0, expo: 0.85, open: 0 }, 0)
      .set(rig, { ...SHOT[0] }, 0).set(rug.scale, { z: 0.001 }, 0)
      .set(downs.map((d) => d.v), { on: 0 }, 0)
      .set([...this.build, ...this.lampsU, ...this.accU], { value: 0 }, 0);

    tl.add(rig, { ...shotTween(SHOT[0], SHOT[1]), duration: this.len, ease: 'inOutSine' }, at(0));
    tl.add(U.sway, { value: [0, 9], duration: 14000, ease: 'linear' }, at(0));
    // 1. paint runs down the walls and the ceiling, the walnut slats rise
    tl.add(U.paint, { value: [0, 1], duration: 2800, ease: 'inOutSine' }, at(600))
      .add(U.slats, { value: [0, 1], duration: 2600, ease: 'inOutSine' }, at(1300));
    // 2. the oak floor is laid, plank by plank, in a wave from the window (the scene's own clock, in seconds)
    tl.add(U.floor, { value: [0, 14], duration: 14000, ease: 'linear' }, at(0));
    // the curtains are drawn over the bare glazing, then pulled open onto the sunset as the room comes together
    tl.add(S, { open: [0, 1], duration: 2600, ease: 'inOutCubic' }, at(4600));
    // 3. the rug unrolls
    tl.add(rug.scale, { z: [0.001, 1], duration: 1100, ease: 'inOutCubic' }, at(4700));
    // 4. the furniture is built from the floor up, piece by piece (the thuds in the soundtrack land as each completes)
    this.build.forEach((u, i) => tl.add(u, { value: [0, 1], duration: 820, ease: 'inOutSine' }, at(5000 + Math.min(i, 11) * 270 + Math.max(0, i - 11) * 90)));
    // 5. downlights, the LED cove, the pendants and the arc lamp; the sun sinks into gold
    downs.forEach((d, i) => tl.add(d.v, { on: [0, 1], duration: 260, ease: 'outQuad' }, at(8400 + Math.min(i, 5) * 120)));
    tl.add(S, { down: [0, 1], duration: 900 }, at(8400))
      .add(S, { cove: [0, 1], duration: 1400, ease: 'inOutSine' }, at(8700));
    this.lampsU.forEach((u, i) => tl.add(u, { value: [0, 1], duration: 700, ease: 'inOutSine' }, at(8700 + i * 200)));
    tl.add(S, { pend: [0, 1], lamp: [0, 1], duration: 800, ease: 'inOutSine' }, at(9800))
      .add(S, { sun: [1.8, 6.5], warm: [0, 1], expo: [0.85, 1.0], duration: 4600, ease: 'inOutSine' }, at(5600))
      .add(S, { tv: [0, 1], duration: 900, ease: 'inOutSine' }, at(10600));
    // 6. the finishing touches arrive on the surfaces
    this.accU.forEach((u, i) => tl.add(u, { value: [0, 1], duration: 520, ease: 'inOutSine' }, at(10200 + Math.min(i, 9) * 140 + Math.max(0, i - 9) * 70)));
    return { tagAt: at(10500) };
  },

  light() {
    const w = S.warm;
    sun.intensity = S.sun * (0.55 + 0.45 * S.open); sun.color.setRGB(1, 0.66 + 0.14 * (1 - w), 0.42 + 0.4 * (1 - w));
    hemi.intensity = 0.5 - 0.22 * w;
    view.material.color.setRGB(1.0 + 0.7 * w, 1.02 + 0.45 * w, 1.1 + 0.1 * w);
    for (const b of shafts) b.userData.u.uOp.value = 0.035 * w * Math.min(1, S.sun / 5);
    if (dustU) dustU.uOp.value = 0.12 + 0.3 * w;
    cove.color.setRGB(1, 0.8, 0.55).multiplyScalar(3.2 * S.cove);
    ceilGlow.material.opacity = 0.55 * S.cove;
    for (const sl of spots) sl.intensity = 7 * S.down;
    for (const d of downs) d.disc.material.color.setRGB(1, 0.9, 0.75).multiplyScalar(0.05 + 3.0 * d.v.on);
    for (const p of lamps) if (p.userData.light) p.userData.light.intensity = 5.5 * S.pend * (p.userData.light.userData.k || 1);
    floorLamp.userData.light.intensity = 3.2 * S.lamp;
    if (floorLamp.userData.bulb) floorLamp.userData.bulb.material.color.setRGB(1, 0.84, 0.63).multiplyScalar(0.05 + 2.4 * S.lamp);
    consoleLed.material.color.setRGB(1, 0.78, 0.5).multiplyScalar(0.6 * S.cove);
    if (tvScreen) tvScreen.material.emissive.setRGB(0.55, 0.55, 0.55).multiplyScalar(S.tv);
    this.backing.visible = U.slats.value > 0.001;
    if (this.slatV !== U.slats.value) { this.slatV = U.slats.value; this.growSlats(this.slatV); }
    linen.emissive.setRGB(1, 0.62, 0.36).multiplyScalar(0.05 * S.sun * (0.3 + 0.7 * w));
    for (const c of curtains) { c.u.uOpen.value = S.open; c.m.emissive.copy(linen.emissive); }
    V.renderer.toneMappingExposure = S.expo;
  },

  render() {
    if (!V) return;
    place(V, rig, 0.4);
    if (dustU) dustU.uT.value = FILM.t;
    this.light();
    syncReveals();
    V.render();
  },
};
