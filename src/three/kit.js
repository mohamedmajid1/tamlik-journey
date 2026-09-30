// Shared 3D kit for the department scenes.
//   Look: AgX tone mapping (a photographic response, no neon highlights), soft shadows, multisampled edges,
//   ambient occlusion, a restrained bloom on lamps only, reflections baked from the room itself (bakeEnv), and a
//   film finish (fine grain, a touch of lens fringing at the edges) so the renders read as camera footage.
//   Speed: the live page renders at the size the screen actually shows (not more), drops AO / resolution on slow
//   GPUs (setQuality), and every shader is compiled before the film starts (main.js warms each scene up).
//   Motion: things never "pop" in; reveal() builds an object from the floor up behind a thin line of light.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export { THREE };
// texture filtering at grazing angles (?aniso=N to compare)
const ANISO = +(new URLSearchParams(location.search).get('aniso') || 16);
const pending = [];
const texLoader = new THREE.TextureLoader(), gltf = new GLTFLoader(), rgbe = new RGBELoader();
const texCache = new Map(), modelCache = new Map(), hdrCache = new Map();

// film clock (seconds), set by main.js before each frame: drives grain and anything that must stay frame-exact
export const FILM = { t: 0 };
// quality: record = the offline film (everything on); live = the browser, trimmed to what the GPU can hold
export const Q = { record: false, pr: 1, ao: true, views: [] };

// a tiled texture (cached per path + repeat)
export function tex(path, repeat = 1, srgb = false) {
  const key = path + '|' + repeat + '|' + srgb;
  if (texCache.has(key)) return texCache.get(key);
  const t = texLoader.load(path);
  pending.push(new Promise((res) => { const i = setInterval(() => { if (t.image && t.image.complete !== false) { clearInterval(i); res(); } }, 40); }));
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = ANISO;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t); return t;
}
// a PBR surface from assets/tex3d/<name> (diffuse, normal, roughness if present)
export function surface(name, repeat = 1, { rough = true, ...opts } = {}) {
  const p = `assets/tex3d/${name}/`;
  const m = new THREE.MeshStandardMaterial({ map: tex(p + 'diffuse.jpg', repeat, true), normalMap: tex(p + 'nor_gl.jpg', repeat), roughness: 1, ...opts });
  if (rough && ['wood_floor', 'marble_01', 'walnut_veneer', 'concrete_floor_02'].includes(name)) m.roughnessMap = tex(p + 'rough.jpg', repeat);
  return m;
}
// a Poly Haven model (assets/models/<name>): returns a fresh copy, shadows on, sitting on its own base (y = 0)
export async function model(name) {
  if (!modelCache.has(name)) modelCache.set(name, gltf.loadAsync(`assets/models/${name}/${name}.gltf`).then((g) => g.scene));
  const o = (await modelCache.get(name)).clone(true);
  o.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = true;
    // full anisotropic filtering: textures stay crisp on surfaces seen at an angle (seats, table tops, floors)
    for (const mt of Array.isArray(m.material) ? m.material : [m.material]) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) if (mt[k] && mt[k].anisotropy !== ANISO) { mt[k].anisotropy = ANISO; mt[k].needsUpdate = true; }
  });
  return o;
}
// wrap an object in a holder whose origin is the centre of its base: rotate / scale / drop it cleanly
export function seat(o, s = 1) {
  o.scale.multiplyScalar(s);
  const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3());
  o.position.x -= c.x; o.position.z -= c.z; o.position.y -= b.min.y;
  const h = new THREE.Group(); h.add(o); return h;
}
export const topOf = (o) => new THREE.Box3().setFromObject(o).max.y;
export const ready = () => Promise.all(pending);

async function hdr(name) {
  if (!hdrCache.has(name)) hdrCache.set(name, rgbe.loadAsync(`assets/hdr/${name}.hdr`));
  return hdrCache.get(name);
}

// the film finish: fine animated grain (seeded by the film clock, so the recording is repeatable), a slight
// chromatic fringe towards the frame edges, a gentle S-curve and warm/cool split. Runs after tone mapping.
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uGrain: { value: 0.018 }, uCA: { value: 0.0006 }, uSharp: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uT, uGrain, uCA, uSharp; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec2 o = d * uCA * r2 * 4.0;
      vec3 c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
      if (uSharp > 0.0) {                                                           // gentle unsharp mask (lower live resolutions)
        vec2 px = 1.0 / uRes;
        vec3 nb = texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb
                + texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb;
        c = max(c + (c - nb * 0.25) * uSharp, 0.0);
      }
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.18);                                    // soft S-curve
      c += (vec3(0.012, 0.004, -0.01) * smoothstep(0.35, 0.9, l)) + (vec3(-0.006, 0.0, 0.01) * (1.0 - smoothstep(0.0, 0.3, l)));
      vec2 px = floor(vUv * uRes / 1.5);
      float g = h(px + fract(uT * 23.17) * 91.0) + h(px * 1.7 + fract(uT * 7.31) * 57.0) - 1.0;
      c += g * uGrain * (0.6 + 0.8 * (1.0 - l)) * 0.5;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

// a renderer + composer for one scene canvas
export async function makeView(canvas, { portrait, record, fov = [62, 40], env = 'studio_small_09', envIntensity = 1, bloom = 0.35, exposure = 1 }) {
  Q.record = record;
  const W = portrait ? 1080 : 1920, H = portrait ? 1920 : 1080;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: record, stencil: false });
  const pr = record ? devicePixelRatio : Q.pr;
  renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromEquirectangular(await hdr(env)).texture;
  scene.environmentIntensity = envIntensity;
  const camera = new THREE.PerspectiveCamera(portrait ? fov[0] : fov[1], W / H, 0.05, 80);

  const rt = new THREE.WebGLRenderTarget(W * pr, H * pr, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, W * pr, H * pr);
  ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: record ? 16 : 8 });
  ao.blendIntensity = 0.85; composer.addPass(ao);
  const bl = new UnrealBloomPass(new THREE.Vector2(W, H), bloom, 0.3, 1.0);        // only the brightest points glow
  composer.addPass(bl);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FinishShader); composer.addPass(finish);
  const v = { renderer, scene, camera, composer, bloom: bl, ao, finish, pm, W, H };
  v.setPR = (p) => {                                    // live resolution; AO at half size while live
    renderer.setPixelRatio(p); composer.setPixelRatio(p); composer.setSize(W, H);
    if (!record) ao.setSize(Math.round(W * p / 2), Math.round(H * p / 2));
    finish.uniforms.uRes.value.set(W * p, H * p);
    finish.uniforms.uSharp.value = record ? 0 : Math.min(0.55, Math.max(0, (1.05 - p) * 1.1));   // more when rendering smaller
  };
  v.setPR(pr); v.pr = pr;
  v.render = () => {
    ao.enabled = record || (Q.ao && v.aoOn !== false);
    finish.uniforms.uT.value = FILM.t;
    composer.render();
  };
  Q.views.push(v);
  return v;
}

// live quality: resolution (pixel ratio) and AO for every view at once
export function setQuality({ pr = Q.pr, ao = Q.ao } = {}) {
  Q.ao = ao;
  if (pr !== Q.pr) { Q.pr = pr; for (const v of Q.views) { v.setPR(pr); v.pr = pr; } }
}
// one scene's own quality (each scene has its own renderer, so a heavy scene need not blur the others)
export function setViewQuality(v, { pr = v.pr, ao = v.aoOn !== false }) {
  v.aoOn = ao;
  if (pr !== v.pr) { v.setPR(pr); v.pr = pr; }
}

// reflections that match the room: capture the scene itself into a cube map from a point in the room.
// Call once the room is built (and in its finished state, so the reflections show the finished room).
export function bakeEnv(V, pos, { size = 256, intensity = 1, hide = [] } = {}) {
  const crt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
  const cc = new THREE.CubeCamera(0.05, 60, crt); cc.position.copy(pos);
  const was = hide.map((o) => o.visible); hide.forEach((o) => { o.visible = false; });
  V.scene.add(cc); cc.update(V.renderer, V.scene); V.scene.remove(cc);
  hide.forEach((o, i) => { o.visible = was[i]; });
  V.scene.environment = V.pm.fromCubemap(crt.texture).texture;
  V.scene.environmentIntensity = intensity;
  crt.dispose();
}

// build an object from the floor up: returns { value } (0 hidden .. 1 whole). The cut is a world-height plane
// with a slightly ragged edge and a thin glowing seam; the object is hidden entirely at 0 (no shadow either).
const revealed = [];
export function reveal(obj, { color = 0xffd9a0, glow = 3 } = {}) {
  const b = new THREE.Box3().setFromObject(obj);
  const u = { value: 1, lo: b.min.y - 0.02, hi: b.max.y + 0.02 };
  const U = { uCut: { value: b.max.y + 1 }, uEdge: { value: new THREE.Color(color).multiplyScalar(glow) } };
  obj.traverse((m) => {
    if (!m.isMesh) return;
    const mats = (Array.isArray(m.material) ? m.material : [m.material]).map((mt) => {
      const c = mt.clone();
      c.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = 'varying vec3 vRw;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'uniform float uCut; uniform vec3 uEdge; varying vec3 vRw;\n' + sh.fragmentShader
          .replace('void main() {', `void main() {
            float rj = sin(vRw.x * 31.0 + vRw.z * 17.0) * 0.006 + sin(vRw.x * 7.0 - vRw.z * 11.0) * 0.008;
            float rd = uCut + rj - vRw.y; if (rd < 0.0) discard;`)
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uEdge * (1.0 - smoothstep(0.0, 0.012, rd));');
      };
      c.customProgramCacheKey = () => 'reveal';
      return c;
    });
    m.material = Array.isArray(m.material) ? mats : mats[0];
  });
  revealed.push({ obj, u, U });
  return u;
}
// apply every reveal (called by render); an object is hidden at 0 and plain at 1
export function syncReveals() {
  for (const { obj, u, U } of revealed) {
    obj.visible = u.value > 0.001;
    U.uCut.value = u.value >= 0.999 ? u.hi + 10 : u.lo + (u.hi - u.lo) * u.value;
  }
}

// dust in the air: soft motes drifting slowly inside a box, lit where the light falls (brightness from uLight).
// Deterministic: positions are a function of FILM.t only.
export function dust(scene, { min, max, count = 400, size = 0.012, color = 0xfff1dc, opacity = 0.5 }) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(count * 3), s = new Float32Array(count);
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) { p.set([min.x + rnd() * (max.x - min.x), min.y + rnd() * (max.y - min.y), min.z + rnd() * (max.z - min.z)], i * 3); s[i] = rnd(); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
  const u = { uT: { value: 0 }, uOp: { value: opacity }, uSize: { value: size }, uCol: { value: new THREE.Color(color) },
    uMin: { value: min.clone() }, uMax: { value: max.clone() } };
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float seed; uniform float uT, uSize; uniform vec3 uMin, uMax; varying float vA;
      void main(){
        vec3 q = position + vec3(sin(uT * 0.13 + seed * 40.0) * 0.25, sin(uT * 0.07 + seed * 13.0) * 0.12 - uT * 0.01 * (0.5 + seed), cos(uT * 0.11 + seed * 27.0) * 0.25);
        q = uMin + mod(q - uMin, uMax - uMin);
        vec4 mv = modelViewMatrix * vec4(q, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (0.5 + seed) * 900.0 / -mv.z;
        vA = 0.35 + 0.65 * fract(seed * 7.13 + uT * 0.05 * (seed - 0.5));
      }`,
    fragmentShader: `uniform float uOp; uniform vec3 uCol; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uCol, uOp * vA * pow(1.0 - d * 2.0, 2.0)); }` }));
  pts.frustumCulled = false; scene.add(pts);
  return u;
}

// a soft beam of light (a sun shaft through a window): an additive box with fading faces; set .material.opacity
export function shaft(from, to, width, height, { color = 0xffe3b8, opacity = 0.12 } = {}) {
  const len = from.distanceTo(to);
  const geo = new THREE.BoxGeometry(width, height, len, 1, 1, 1); geo.translate(0, 0, len / 2);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(color) }, uOp: { value: opacity }, uLen: { value: len } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uCol; uniform float uOp, uLen; varying vec3 vP;
      void main(){ float f = (1.0 - vP.z / uLen); gl_FragColor = vec4(uCol, uOp * f * f * (0.6 + 0.4 * f)); }` });
  const b = new THREE.Mesh(geo, m); b.position.copy(from); b.lookAt(to); b.renderOrder = 5;
  b.userData.u = m.uniforms; return b;
}

// a camera rig: position + aim, both animatable plain objects
export const rig = (a) => ({ ...a });
export function aim(camera, r) { camera.position.set(r.x, r.y, r.z); camera.lookAt(r.tx, r.ty, r.tz); }
// animate a rig through a shot: [start, end] objects with the same keys
export const shotTween = (s0, s1) => Object.fromEntries(Object.keys(s0).map((k) => [k, [s0[k], s1[k]]]));
// a tiny handheld float on top of a rig (real camera operators never hold perfectly still); seconds in
export function handheld(camera, t, amt = 1) {
  camera.rotation.z += (Math.sin(t * 0.9) * 0.0025 + Math.sin(t * 2.3) * 0.0008) * amt;
  camera.rotateX((Math.sin(t * 0.7 + 1.3) * 0.0018 + Math.sin(t * 1.9) * 0.0006) * amt);
  camera.rotateY((Math.sin(t * 0.55 + 0.4) * 0.002 + Math.sin(t * 1.6 + 2.0) * 0.0007) * amt);
}

// a flat canvas texture drawn by a function (labels, UI on screens, check marks). The canvas is kept in main
// memory (willReadFrequently): re-uploading a GPU-drawn canvas to WebGL forces a slow read-back every time it
// changes. { live: true } skips mipmaps, for a texture that is redrawn while the film plays.
export function canvasTex(w, h, draw, { live = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const x = c.getContext('2d', { willReadFrequently: true });
  if (live) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  const redraw = (...a) => { x.clearRect(0, 0, w, h); draw(x, w, h, ...a); t.needsUpdate = true; };
  redraw(); t.userData.redraw = redraw; return t;
}

// the Tamlik green: a thin AR diagnosis marker (corner brackets, a fine ring, a label) and a check mark, used to
// mark and confirm each repair
export const GREEN = new THREE.Color(0x19d67a);
export function holoRing(r = 0.35, label = '') {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.985, r, 96), m); g.add(ring);
  const brackets = canvasTex(512, 512, (x, w, h) => {
    x.strokeStyle = '#6dffb8'; x.lineWidth = 5; x.lineCap = 'square';
    for (const [cx, cy, dx, dy] of [[8, 8, 1, 1], [w - 8, 8, -1, 1], [8, h - 8, 1, -1], [w - 8, h - 8, -1, -1]]) { x.beginPath(); x.moveTo(cx, cy + dy * 70); x.lineTo(cx, cy); x.lineTo(cx + dx * 70, cy); x.stroke(); }
    x.fillStyle = 'rgba(109,255,184,.9)'; for (let i = 0; i < 4; i++) { x.fillRect(w / 2 - 1, 30 + i * 6, 2, 3); }
  });
  const ring2 = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.6, r * 2.6), new THREE.MeshBasicMaterial({ map: brackets, transparent: true, depthWrite: false, depthTest: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  g.add(ring2);
  const tick = canvasTex(256, 256, (x, w, h) => {
    x.strokeStyle = '#3dff9c'; x.lineWidth = 14; x.lineCap = x.lineJoin = 'round'; x.shadowColor = '#19d67a'; x.shadowBlur = 16;
    x.beginPath(); x.moveTo(w * 0.3, h * 0.53); x.lineTo(w * 0.45, h * 0.68); x.lineTo(w * 0.72, h * 0.36); x.stroke();
  });
  const check = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.1, r * 1.1), new THREE.MeshBasicMaterial({ map: tick, transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  g.add(check);
  let tag = null;
  if (label) {
    const lt = canvasTex(512, 96, (x, w, h) => {
      x.fillStyle = 'rgba(4,20,12,.55)'; x.fillRect(0, 14, w, h - 28);
      x.fillStyle = '#19d67a'; x.fillRect(0, 14, 6, h - 28);
      x.fillStyle = '#c9ffe4'; x.font = '600 34px Manrope, sans-serif'; x.fillText(label.toUpperCase(), 24, 60);
    });
    tag = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.2, r * 2.2 * 96 / 512), new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
    tag.position.set(r * 2.25, r * 1.1, 0); g.add(tag);
  }
  g.renderOrder = 10; g.traverse((o) => { o.renderOrder = 10; });
  g.userData = { ring, ring2, check, tag };
  return g;
}

// the journey (main.js) flies the camera in and out of each room through a window. While the camera is outside or
// passing through, main.js sets V.portal = { pos, quat, fov, plane, dist, lens, hh } and the room is drawn from that
// camera, cut at the window's plane so nothing between the window and the camera shows; once inside, the scene's
// own rig takes over (portal.pos null) and its lens and handheld float fade back in (lens, hh: 0 -> 1).
export function place(V, r, amt = 1) {
  const cam = V.camera, P = V.portal;
  if (V.base === undefined) V.base = { fov: cam.fov, far: cam.far, view: cam.view ? { ...cam.view } : null, fog: V.scene.fog ? [V.scene.fog.near, V.scene.fog.far] : null };
  const B = V.base;
  aim(cam, r);
  handheld(cam, FILM.t, amt * (P ? P.hh ?? 1 : 1));
  if (P && P.pos) { cam.position.copy(P.pos); cam.quaternion.copy(P.quat); }
  const k = P ? P.lens ?? 0 : 1;
  cam.fov = P ? P.fov + (B.fov - P.fov) * k : B.fov;
  if (B.view) cam.setViewOffset(B.view.fullWidth, B.view.fullHeight, B.view.offsetX * k, B.view.offsetY * k, B.view.width, B.view.height);
  const d = P ? P.dist || 0 : 0;
  cam.far = B.far + d;
  if (B.fog) { V.scene.fog.near = B.fog[0] + d; V.scene.fog.far = B.fog[1] + d; }
  cam.updateProjectionMatrix();
  V.renderer.clippingPlanes = P && P.plane ? [P.plane] : [];
}
