// Muscat at dusk: the world of the Tamlik tower film (tamlik-experience/index.html), built once and drawn on its own
// canvas. The journey's timeline moves the camera (see src/journey.js) and sets the time of day; this file only builds
// the city and draws it. The building code is the tower film's, unchanged, so the city is identical (same seed, same
// random stream). Additions for the journey: the hero windows the camera flies through (heroWindow), a film-clock
// draw() in place of the tower film's real-time frame loop, and the 3D logo rig drawn on the opening curtains.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Water } from 'three/addons/objects/Water.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Q as QUALITY } from '../three/kit.js';

export async function makeCity(canvas, { portrait, record }) {
const W = portrait ? 1080 : 1920, H = portrait ? 1920 : 1080;
const RECORD = record, isMobile = false, params = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: record, stencil: false });
let DPR = record ? devicePixelRatio : QUALITY.pr;
renderer.setPixelRatio(DPR);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;   // the only shadow is the penthouse lamp's, which never moves: drawn once
renderer.shadowMap.needsUpdate = true;

const reduceMotion = false;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = THREE.MathUtils.lerp;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const UP = new THREE.Vector3(0, 1, 0);

// Seeded random so the city is identical on every visit
let seed = 20260923;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

/* ---------------------------------------------------------

   Tamlik logo in 3D — built from the real SVG: deep extrusion,
   rounded bevels, lacquered green + brushed-steel roof
   --------------------------------------------------------- */
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1390 394">${document.getElementById('tamlik-logo').innerHTML}</svg>`;
function brushedTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#7a7a7a'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4200; i++) {
    const y = rand() * 512, g = Math.floor(104 + rand() * 40);
    ctx.strokeStyle = `rgba(${g},${g},${g},${0.1 + rand() * 0.2})`; ctx.lineWidth = 1 + rand() * 1.5;
    ctx.beginPath(); const x = rand() * 512; ctx.moveTo(x - 60 - rand() * 200, y); ctx.lineTo(x + 60 + rand() * 200, y + (rand() - 0.5) * 1.5); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 240, 1 / 240);
  t.anisotropy = 8; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
function makeLogoMaterials(envIntensity = 1) {
  const brushed = brushedTexture();
  // faces: lacquered brand green / brushed steel with a soft grain; sides: deeper metallic tones for depth.
  // No bump map and no mirror-sharp coats: fine specular detail shimmers as the logo moves
  return {
    green: new THREE.MeshPhysicalMaterial({ color: 0x019a4c, metalness: 0.15, roughness: 0.34, roughnessMap: brushed, clearcoat: 1, clearcoatRoughness: 0.16, emissive: 0x01a652, emissiveIntensity: 0.04, envMapIntensity: envIntensity }),
    greenSide: new THREE.MeshPhysicalMaterial({ color: 0x00502a, metalness: 0.7, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: envIntensity }),
    steel: new THREE.MeshPhysicalMaterial({ color: 0xc9ccd1, metalness: 1, roughness: 0.36, roughnessMap: brushed, anisotropy: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.25, envMapIntensity: envIntensity }),
    steelSide: new THREE.MeshPhysicalMaterial({ color: 0x5f6266, metalness: 1, roughness: 0.4, envMapIntensity: envIntensity }),
  };
}
function buildLogo3D(mats, depth = 70, bevel = 9) {
  const data = new SVGLoader().parse(LOGO_SVG);
  const root = new THREE.Group(), parts = {};
  for (const path of data.paths) {
    const geo = new THREE.ExtrudeGeometry(SVGLoader.createShapes(path), {
      depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelOffset: -bevel * 0.6, bevelSegments: 5, curveSegments: 8,
    });
    geo.scale(1, -1, -1);                                 // SVG is y-down; flipping two axes keeps the winding
    geo.computeBoundingBox();
    const c = geo.boundingBox.getCenter(new THREE.Vector3());
    geo.translate(-c.x, -c.y, -c.z);
    geo.computeVertexNormals();
    const grey = path.color.getHex() === 0x595a5c;
    const mesh = new THREE.Mesh(geo, grey ? [mats.steel, mats.steelSide] : [mats.green, mats.greenSide]);
    const pivot = new THREE.Group();
    pivot.position.set(c.x - 695, c.y + 197, 0);
    pivot.userData.base = pivot.position.clone();
    pivot.add(mesh); root.add(pivot);
    parts[path.userData.node.id] = pivot;
  }
  return { root, parts };
}

const scene = new THREE.Scene();

/* ---------------------------------------------------------
   Ready-made assets: Poly Haven textures and models (CC0),
   fetched by tools/fetch-assets.mjs into ./assets. Loaded before
   anything is built, so every frame (and every recording) has them.
   --------------------------------------------------------- */
const TEXSETS = {
  marble_01: ['diffuse', 'nor_gl', 'rough'], walnut_veneer: ['diffuse', 'nor_gl', 'rough'], clay_plaster: ['diffuse', 'nor_gl', 'rough'],
  rocky_terrain_02: ['diffuse', 'nor_gl'], coast_sand_01: ['diffuse', 'nor_gl'], concrete_pavers: ['diffuse', 'nor_gl', 'rough'],
  asphalt_02: ['diffuse', 'nor_gl', 'rough'], rough_concrete: ['diffuse', 'nor_gl'], white_plaster_rough_01: ['diffuse', 'nor_gl'],
};
const MODEL_NAMES = ['Sofa_01', 'mid_century_lounge_chair', 'side_table_01', 'potted_plant_02', 'potted_plant_01', 'brass_vase_01', 'antique_ceramic_vase_01'];
const TEX = {}, MODELS = {};
{
  const tl = new THREE.TextureLoader(), gl = new GLTFLoader(), aniso = renderer.capabilities.getMaxAnisotropy();
  const jobs = [];
  for (const [n, maps] of Object.entries(TEXSETS)) {
    TEX[n] = {};
    for (const m of maps) jobs.push(tl.loadAsync(`assets/tex/${n}/${m}.jpg`).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
      if (m === 'diffuse') t.colorSpace = THREE.SRGBColorSpace;
      TEX[n][m] = t;
    }));
  }
  for (const n of MODEL_NAMES) jobs.push(gl.loadAsync(`assets/models/${n}/${n}.gltf`).then((g) => {
    // layer 1 = DETAIL (below): out of the water reflection; drawn only near the penthouse (see frame)
    g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.layers.set(1); for (const m of [].concat(o.material)) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) if (m[k]) m[k].anisotropy = aniso; } });
    MODELS[n] = g.scene;
  }));
  const res = await Promise.allSettled(jobs);
  for (const r of res) if (r.status === 'rejected') console.warn('asset failed to load:', r.reason?.message || r.reason);
}
// material parameters from a texture set, tiled rx × ry (textures are cloned so each use keeps its own tiling)
function pbr(name, rx, ry = rx, extra = {}) {
  const s = TEX[name] || {}, rep = (t) => { if (!t) return null; const c = t.clone(); c.repeat.set(rx, ry); c.needsUpdate = true; return c; };
  return { map: rep(s.diffuse), normalMap: rep(s.nor_gl), roughnessMap: rep(s.rough), ...extra };
}
// project a texture set onto a lit material in world space from three sides (no UVs needed, no stretching on
// cliffs): the texture's detail modulates the material colour around its own average, and its normal map adds
// real surface relief. scale = repeats per metre; a second, larger sample breaks up visible tiling.
// mask (optional GLSL float expression) limits where it applies. Several layers can stack on one material.
let tpCount = 0;
function texAverage(t) {                              // mean linear colour of a texture, so detail keeps the base tone
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(t.image, 0, 0, 16, 16);
  const d = x.getImageData(0, 0, 16, 16).data, v = new THREE.Vector3(), lin = (b) => Math.pow(b / 255, 2.2);
  for (let i = 0; i < d.length; i += 4) v.x += lin(d[i]), v.y += lin(d[i + 1]), v.z += lin(d[i + 2]);
  return v.divideScalar(d.length / 4);
}
function triplanar(mat, set, scale, { strength = 1, normal = 1, mask = '1.0' } = {}) {
  const s = TEX[set]; if (!s || !s.diffuse) return mat;
  const id = '_' + (++tpCount), X = (src) => src.replace(/\b(v?)(tp|Tp)([A-Z]\w*)/g, '$1$2$3' + id);
  const avg = s.avg || (s.avg = texAverage(s.diffuse));
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey.bind(mat);
  const vert = X(`
      vec4 tpP = vec4(transformed, 1.0); vec3 tpNo = objectNormal;
      #ifdef USE_INSTANCING
        tpP = instanceMatrix * tpP; tpNo = mat3(instanceMatrix) * tpNo;
      #endif
      vTpW = (modelMatrix * tpP).xyz; vTpN = normalize(mat3(modelMatrix) * tpNo);`);
  const head = X(`uniform sampler2D tpMap; uniform sampler2D tpNor; uniform float tpScale; uniform float tpStr; uniform float tpNrm; uniform vec3 tpAvg;
      varying vec3 vTpW; varying vec3 vTpN;
      // side weights; sides under 2% are dropped so most pixels read one side instead of three
      vec3 tpWt(){ vec3 w = pow(abs(normalize(vTpN)), vec3(4.0)); w = max(w / (w.x + w.y + w.z) - 0.02, 0.0); return w / (w.x + w.y + w.z); }
      // explicit gradients (taken before any branch) keep the mip choice exact, so skipping sides can't shimmer
      vec3 tpTri(sampler2D m, vec3 p, vec3 dx, vec3 dy, vec3 w){ vec3 c = vec3(0.0);
        if (w.x > 0.0) c += textureGrad(m, p.zy, dx.zy, dy.zy).rgb * w.x;
        if (w.y > 0.0) c += textureGrad(m, p.xz, dx.xz, dy.xz).rgb * w.y;
        if (w.z > 0.0) c += textureGrad(m, p.xy, dx.xy, dy.xy).rgb * w.z;
        return c; }
    `);
  const albedo = X(`
        float tpMk = clamp(${mask}, 0.0, 1.0);
        // brightness only: the material keeps its own colour, the texture brings grain, cracks and pores
        const vec3 tpL = vec3(0.2126, 0.7152, 0.0722);
        float tpLa = dot(tpAvg, tpL);
        vec3 tpP1 = vTpW * tpScale, tpDx = dFdx(tpP1), tpDy = dFdy(tpP1), tpW3 = tpWt();
        // far away one pixel covers a big part of a tile and the texture has blurred to its own average: fade
        // each sample out there and skip reading it (most of the terrain in the aerials then costs almost nothing)
        float tpFp = max(length(tpDx), length(tpDy)), tpFine = 1.0 - smoothstep(0.12, 0.35, tpFp), tpCoarse = 1.0 - smoothstep(0.12, 0.35, tpFp * 0.137);
        if (tpMk > 0.0 && tpCoarse > 0.0) {   // outside its mask a layer costs nothing
          float tpA = tpFine > 0.0 ? mix(1.0, dot(tpTri(tpMap, tpP1, tpDx, tpDy, tpW3), tpL) / tpLa, tpFine) : 1.0;
          float tpDet = tpA * mix(1.0, dot(tpTri(tpMap, tpP1 * 0.137, tpDx * 0.137, tpDy * 0.137, tpW3), tpL) / tpLa, 0.5 * tpCoarse);
          diffuseColor.rgb *= max(mix(1.0, tpDet, tpStr * tpMk), 0.0);
        }`);
  const relief = X(`
        if (tpNrm > 0.0 && tpMk > 0.0 && tpFine > 0.0) {
          vec3 tpQ = tpP1, tpWw = tpW3, tpN0 = normalize(vTpN);
          vec3 tpNx = tpWw.x > 0.0 ? textureGrad(tpNor, tpQ.zy, tpDx.zy, tpDy.zy).xyz * 2.0 - 1.0 : vec3(0.0, 0.0, 1.0);
          vec3 tpNy = tpWw.y > 0.0 ? textureGrad(tpNor, tpQ.xz, tpDx.xz, tpDy.xz).xyz * 2.0 - 1.0 : vec3(0.0, 0.0, 1.0);
          vec3 tpNz = tpWw.z > 0.0 ? textureGrad(tpNor, tpQ.xy, tpDx.xy, tpDy.xy).xyz * 2.0 - 1.0 : vec3(0.0, 0.0, 1.0);
          tpNx = vec3(tpNx.xy * tpNrm + tpN0.zy, abs(tpNx.z) * tpN0.x); tpNy = vec3(tpNy.xy * tpNrm + tpN0.xz, abs(tpNy.z) * tpN0.y); tpNz = vec3(tpNz.xy * tpNrm + tpN0.xy, abs(tpNz.z) * tpN0.z);
          vec3 tpWn = normalize(tpNx.zyx * tpWw.x + tpNy.xzy * tpWw.y + tpNz.xyz * tpWw.z);
          normal = normalize(mix(normal, (viewMatrix * vec4(tpWn, 0.0)).xyz, tpMk * tpFine));
        }`);
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    Object.assign(sh.uniforms, {
      ['tpMap' + id]: { value: s.diffuse }, ['tpNor' + id]: { value: s.nor_gl || s.diffuse }, ['tpScale' + id]: { value: scale },
      ['tpStr' + id]: { value: strength }, ['tpNrm' + id]: { value: s.nor_gl ? normal : 0 }, ['tpAvg' + id]: { value: avg },
    });
    sh.vertexShader = X('varying vec3 vTpW; varying vec3 vTpN;\n') + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + vert);
    sh.fragmentShader = head + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + albedo)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + relief);
  };
  mat.customProgramCacheKey = () => prevKey() + '|tp:' + set + id;
  return mat;
}
// a copy of a loaded model, scaled so its larger footprint side is `size` metres, standing on y = 0
function model(name, size) {
  const src = MODELS[name];
  if (!src) return new THREE.Group();
  const o = src.clone(true), box = new THREE.Box3().setFromObject(o), dim = box.getSize(new THREE.Vector3());
  const k = size ? size / Math.max(dim.x, dim.z) : 1;
  o.scale.setScalar(k);
  o.position.y = -box.min.y * k;
  const g = new THREE.Group(); g.add(o);
  return g;
}
const SUN = new THREE.Vector3(-0.36, 0.03, -1).normalize();

/* ---------------------------------------------------------
   Colour script: one palette per act, blended by uNight.
   Golden hour (warm sun, lavender shade) → blue hour (amber
   windows against cobalt) → night (sodium streets, indigo sky).
   The haze takes the sky's colour: gold toward the sun, cool
   lavender away from it, so depth reads as colour, not black.
   --------------------------------------------------------- */
const PAL = {
  fogCool:  [new THREE.Color(0.1, 0.102, 0.125),  new THREE.Color(0.018, 0.02, 0.036)],
  fogWarm:  [new THREE.Color(0.4, 0.25, 0.13),   new THREE.Color(0.15, 0.07, 0.045)],
};
const FOG = PAL.fogCool[0].clone();
scene.fog = new THREE.FogExp2(FOG, 0.00031);
const atmoU = { uFogWarm: { value: PAL.fogWarm[0].clone() } };
{
  const sv = `vec3(${SUN.x.toFixed(5)}, ${SUN.y.toFixed(5)}, ${SUN.z.toFixed(5)})`;
  THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth; varying vec3 vFogDir;\n#endif';
  THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n vFogDepth = - mvPosition.z; vFogDir = (vec4(mvPosition.xyz, 0.0) * viewMatrix).xyz;\n#endif';
  THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
    uniform vec3 fogColor; uniform vec3 uFogWarm; varying float vFogDepth; varying vec3 vFogDir;
    #ifdef FOG_EXP2
      uniform float fogDensity;
    #else
      uniform float fogNear; uniform float fogFar;
    #endif
  #endif`;
  THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    #endif
    float fSun = max(dot(normalize(vFogDir), ${sv}), 0.0);
    vec3 fogC = mix(fogColor, uFogWarm, pow(fSun, 5.0)) + uFogWarm * 0.4 * pow(fSun, 24.0);
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogC, fogFactor );
  #endif`;
}

const camera = new THREE.PerspectiveCamera(45, W / H, 0.3, 9000);
// layer 1: small street detail (lamp posts, car bodies, rooftop units). The camera sees it; the water's
// reflection (which only draws layer 0) leaves it out, where the ripples would hide it anyway.
const DETAIL = 1;
camera.layers.enable(DETAIL);

/* ---------------------------------------------------------
   Cloud shadows — one drifting fbm field shared by every
   surface shader: 1 in sunlight, down to ~0.3 under a cloud
   --------------------------------------------------------- */
const cloudU = { uCloudT: { value: 0 }, uCloudDay: { value: 1 } };
const streetU = { uStreet: { value: 0 } };
const CLOUD_GLSL = /* glsl */`
    uniform float uCloudT; uniform float uCloudDay;
    float cl_h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float cl_n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(cl_h(i), cl_h(i + vec2(1, 0)), f.x), mix(cl_h(i + vec2(0, 1)), cl_h(i + vec2(1, 1)), f.x), f.y); }
    float cloudShade(vec3 wp){
      vec2 p = (wp.xz + vec2(-7.0, 4.5) * uCloudT) / 360.0;
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { s += a * cl_n(p); p = p * 2.03 + 17.1; a *= 0.5; }
      float cover = smoothstep(0.42, 0.56, s);
      return mix(1.0, 1.0 - 0.75 * cover, uCloudDay);
    }
`;
// patch a built-in lit material so its light is dimmed under the clouds
function addCloudShadows(m) {
  if (m.userData.clouds) return;
  m.userData.clouds = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    Object.assign(sh.uniforms, cloudU);
    sh.fragmentShader = CLOUD_GLSL + sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      float cShade = cloudShade(cameraPosition + transpose(mat3(viewMatrix)) * (-vViewPosition));
      reflectedLight.directDiffuse *= cShade; reflectedLight.directSpecular *= cShade;
      reflectedLight.indirectDiffuse *= 0.4 + 0.6 * cShade;`);
  };
  m.customProgramCacheKey = () => prevKey + '|clouds';
}

/* ---------------------------------------------------------
   Sky — dusk gradient, sun glow, stars. Also baked into the
   environment map so every reflective surface carries the sunset.
   --------------------------------------------------------- */
const skyMat = new THREE.ShaderMaterial({
  uniforms: { uSun: { value: SUN }, uNight: { value: 0 }, uTime: { value: 0 }, uFog: { value: FOG }, uFogWarm: atmoU.uFogWarm, uSunI: { value: 1 } },
  side: THREE.BackSide, depthWrite: false,
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform vec3 uSun; uniform float uNight; uniform float uTime; uniform vec3 uFog; uniform vec3 uFogWarm; uniform float uSunI;
    varying vec3 vDir;
    float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float vh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(vh(i), vh(i + vec2(1, 0)), f.x), mix(vh(i + vec2(0, 1)), vh(i + vec2(1, 1)), f.x), f.y); }
    void main(){
      vec3 d = normalize(vDir);
      float h = d.y;
      float sd = max(dot(d, uSun), 0.0);
      vec3 zenith  = mix(vec3(0.02, 0.045, 0.105), vec3(0.005, 0.009, 0.026), uNight);   // dusk blue → night
      vec3 mid     = mix(vec3(0.09, 0.1, 0.145),   vec3(0.024, 0.026, 0.05),  uNight);   // hazy dusk blue
      vec3 horizon = mix(vec3(0.95, 0.5, 0.21),    vec3(0.42, 0.14, 0.08),    uNight);   // gold → ember
      vec3 belt    = mix(vec3(0.25, 0.17, 0.17),   vec3(0.05, 0.03, 0.042),   uNight);   // Belt of Venus
      vec3 shadowB = mix(vec3(0.08, 0.09, 0.13),   vec3(0.016, 0.02, 0.038),  uNight);   // earth's shadow
      float az = dot(normalize(d.xz + 1e-5), normalize(uSun.xz)) * 0.5 + 0.5;          // 1 toward the sun
      vec3 col = mix(mid, zenith, smoothstep(0.02, 0.55, h));
      vec3 antiH = mix(shadowB, belt, smoothstep(0.0, 0.09, h)) ;
      float band = exp(-max(h, 0.0) * 6.0);
      col = mix(col, mix(antiH, horizon, pow(az, 3.0) * 0.55 + pow(sd, 2.5) * 0.45), band);
      col = mix(col, belt * 0.9, (1.0 - az) * smoothstep(0.03, 0.12, h) * (1.0 - smoothstep(0.12, 0.3, h)) * 0.35);
      col += vec3(1.0, 0.5, 0.2) * pow(sd, 9.0) * 0.12 * (1.0 - uNight * 0.6) * uSunI;     // wide golden halo
      col += vec3(1.0, 0.48, 0.17) * pow(sd, 22.0) * (0.9 - uNight * 0.5) * uSunI;
      col += vec3(1.0, 0.66, 0.34) * smoothstep(0.99955, 0.99985, sd) * 6.0 * (1.0 - uNight * 0.8) * uSunI;
      vec3 q = d * 380.0; vec3 id = floor(q);
      float r = hash(id);
      float star = step(0.9965, r) * smoothstep(0.32, 0.0, length(fract(q) - 0.5));
      star *= smoothstep(0.12, 0.5, h) * (0.35 + 0.65 * uNight) * (0.88 + 0.12 * sin(uTime * 0.6 + r * 80.0));
      col += vec3(0.9, 0.92, 1.0) * star;
      // drifting cloud deck, lit orange from beneath on the sun side, cool slate away from it
      if (h > 0.0) {
        vec2 cp = d.xz / (h + 0.1) * 1.6 + vec2(uTime * 0.012, -uTime * 0.008);
        float cs = 0.0, ca = 0.5; vec2 q = cp;
        for (int i = 0; i < 5; i++) { cs += ca * vn(q); q = q * 2.1 + 3.7; ca *= 0.5; }
        float dens = smoothstep(0.47, 0.78, cs) * smoothstep(0.0, 0.05, h) * (1.0 - smoothstep(0.35, 0.8, h) * 0.6);
        float lit = pow(max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0), 3.0);
        vec3 base = mix(vec3(0.07, 0.066, 0.082), vec3(0.018, 0.018, 0.03), uNight);
        vec3 glow = mix(vec3(1.0, 0.52, 0.24), vec3(0.3, 0.1, 0.07), uNight);
        vec3 pink = mix(vec3(0.3, 0.2, 0.19), vec3(0.07, 0.04, 0.05), uNight);          // far-side clouds catch rose light
        vec3 cc = base + mix(pink * 0.55, glow, lit) * (0.2 + 0.8 * lit + 0.25) * (0.5 + 0.8 * smoothstep(0.5, 0.95, cs)) * (1.0 - smoothstep(0.02, 0.4, h) * 0.55);
        col = mix(col, cc, dens * 0.9);
      }
      vec3 fogC = mix(uFog, uFogWarm, pow(sd, 5.0)) + uFogWarm * 0.4 * pow(sd, 24.0);
      col = mix(col, fogC, smoothstep(0.0, -0.06, h));
      gl_FragColor = vec4(col, 1.0);
    }`
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), skyMat);
scene.add(sky);
sky.userData.noAO = true;
{
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(sky.geometry, skyMat));
  // bake without the sun disc and with a softened glow, so glass and metal carry the sunset
  // colour but never a hard mirrored sun
  const pmrem = new THREE.PMREMGenerator(renderer);
  skyMat.uniforms.uSunI.value = 0.12;
  scene.environment = pmrem.fromScene(envScene, 0.04, 1, 9000).texture;
  skyMat.uniforms.uSunI.value = 1;
  pmrem.dispose();
}

const hemi = new THREE.HemisphereLight(0x6b7384, 0x2e1f14, 0.55);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xff9a4a, 2.9);
sunLight.position.copy(SUN).multiplyScalar(1000);
scene.add(sunLight);
const fill = new THREE.DirectionalLight(0x8b96b8, 0.5);
fill.position.set(200, 300, 800);
scene.add(fill);

/* ---------------------------------------------------------
   Oman: Al Hajar mountains, the Sea of Oman, a beach and a
   rocky headland — one terrain mesh, heights from ridged noise
   --------------------------------------------------------- */
const smoothJS = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function ridged(x, z) {
  let s = 0, amp = 0.5, f = 1, w = 1;
  for (let o = 0; o < 6; o++) {
    let n = 1 - Math.abs(vnoise(x * f, z * f) * 2 - 1);
    n *= n * w; w = clamp(n * 1.8, 0, 1);
    s += n * amp; amp *= 0.5; f *= 2.03;
  }
  return s;
}
const coastX = (z) => 500 + 45 * Math.sin(z * 0.0023) + 25 * Math.sin(z * 0.0061 + 1.3);
const FORT = { x: 575, z: -1150 };
function mountainPart(x, z) {
  const m = Math.max(smoothJS(-950, -1700, x), smoothJS(-2500, -3300, z), smoothJS(1000, 1800, z) * 0.55);
  return m > 0 ? m * (40 + 470 * ridged(x * 0.0011 + 3.1, z * 0.0011 - 1.7)) * (0.6 + 0.4 * m) : 0;
}
function terrainHeight(x, z) {
  const c = coastX(z);
  let base = x < c - 45 ? 0 : x < c ? 0.7 : -Math.min(26, (x - c) * 0.12);
  base += 52 * Math.exp(-((x - FORT.x) ** 2 + (z - FORT.z) ** 2) / (2 * 62 * 62));   // fort promontory
  return base + mountainPart(x, z);
}
{
  const S = isMobile ? 220 : 420;
  const geo = new THREE.PlaneGeometry(10000, 10000, S, S);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -800);
  const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
  const rockA = new THREE.Color(0.055, 0.04, 0.034), rockB = new THREE.Color(0.19, 0.115, 0.07);
  const sand = new THREE.Color(0.26, 0.19, 0.12), land = new THREE.Color(0.05, 0.04, 0.034), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = terrainHeight(x, z);
    pos.setY(i, h);
    const m = mountainPart(x, z);
    if (m > 4 || Math.hypot(x - FORT.x, z - FORT.z) < 120) c.copy(rockA).lerp(rockB, clamp(vnoise(x * 0.01, z * 0.01) * 0.7 + h / 1400, 0, 1));
    else if (x > coastX(z) - 48) c.copy(sand);
    else c.copy(land);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  terrainMat.onBeforeCompile = (sh) => {
    sh.uniforms.uStreet = streetU.uStreet;
    sh.vertexShader = 'varying vec3 vTW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvTW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uStreet;\nvarying vec3 vTW;\n' + sh.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      // the boulevard is polished stone: at a low angle it carries the sunset sky down the street
      float blvdM = exp(-vTW.x * vTW.x / 330.0) * step(-1865.0, vTW.z) * step(vTW.z, 545.0) * step(vTW.y, 3.0);
      roughnessFactor = mix(roughnessFactor, 0.2, blvdM);`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float mx = mod(vTW.x + 30.0, 60.0), mz = mod(vTW.z + 30.0, 60.0);
        float dx = min(mx, 60.0 - mx), dz = min(mz, 60.0 - mz);
        float along = dx < dz ? vTW.z : vTW.x;
        float pools = 0.2 + 0.8 * pow(0.5 + 0.5 * cos(along * 0.2618), 3.0);                // a pool under every lamp
        float road = max(exp(-dx * dx / 6.0), exp(-dz * dz / 6.0)) * pools + max(exp(-dx * dx / 60.0), exp(-dz * dz / 60.0)) * 0.05;
        road = max(road, exp(-vTW.x * vTW.x / 260.0) * (0.55 + 0.45 * pools));                   // the boulevard
        float coast = 500.0 + 45.0 * sin(vTW.z * 0.0023) + 25.0 * sin(vTW.z * 0.0061 + 1.3);
        float inCity = step(-845.0, vTW.x) * step(vTW.x, coast - 38.0) * step(-1865.0, vTW.z) * step(vTW.z, 545.0) * step(vTW.y, 3.0);
        // the boulevard's furniture, painted on and anti-aliased: planted median, stone kerbs, pale paving under
        // the palms, lane lines (dashed between lanes), all fading out before they're thinner than a pixel
        {
          float ax = abs(vTW.x);
          float inB = step(-1865.0, vTW.z) * step(vTW.z, 545.0) * step(vTW.y, 3.0) * (1.0 - step(-715.0, vTW.z) * step(vTW.z, -470.0));
          float fx = fwidth(vTW.x) + 1e-4, fz = fwidth(vTW.z) + 1e-4;
          #define BAND(d, w, f) (1.0 - smoothstep((w) - (f), (w) + (f), (d)))
          float median = BAND(ax, 3.1, fx);
          float kerb = BAND(abs(ax - 3.25), 0.2, fx) + BAND(abs(ax - 20.35), 0.2, fx);
          float walk = smoothstep(20.5 - fx, 20.5 + fx, ax) * (1.0 - smoothstep(37.0, 39.0, ax));
          float dash = BAND(abs(fract(vTW.z / 9.0) - 0.5), 0.17, fz / 9.0);
          float lines = (BAND(abs(ax - 8.3), 0.08, fx) + BAND(abs(ax - 12.3), 0.08, fx) + BAND(abs(ax - 16.3), 0.08, fx)) * dash
                      + BAND(abs(ax - 3.9), 0.09, fx) + BAND(abs(ax - 19.9), 0.09, fx);
          lines = clamp(lines, 0.0, 1.0) * (1.0 - smoothstep(0.12, 0.35, fx));
          float tiles = BAND(abs(fract(vTW.x / 1.2) - 0.5), 0.46, fx / 1.2) * BAND(abs(fract(vTW.z / 1.2) - 0.5), 0.46, fz / 1.2);
          tiles = mix(tiles, 0.85, smoothstep(0.08, 0.3, fx));
          vec3 paving = vec3(0.36, 0.32, 0.27) * (0.78 + 0.22 * tiles);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.075, 0.04), median * inB);
          diffuseColor.rgb = mix(diffuseColor.rgb, paving, walk * inB);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.46, 0.4), clamp(kerb, 0.0, 1.0) * inB);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.75, 0.68), lines * inB * 0.85);
          road *= 1.0 - walk * inB * 0.7;                                                         // pavements aren't asphalt
        }
        diffuseColor.rgb *= 1.0 - 0.45 * road * inCity;                                          // asphalt
        totalEmissiveRadiance += vec3(1.0, 0.5, 0.18) * road * inCity * uStreet;                // sodium glow
      }`);
  };
  // real rock on the mountains and headland, real sand on the beach
  triplanar(terrainMat, 'rocky_terrain_02', 1 / 30, { mask: 'smoothstep(3.0, 14.0, vTW.y)', normal: 1.3 });
  triplanar(terrainMat, 'coast_sand_01', 1 / 3, { mask: 'smoothstep((500.0 + 45.0 * sin(vTW.z * 0.0023) + 25.0 * sin(vTW.z * 0.0061 + 1.3)) - 54.0, (500.0 + 45.0 * sin(vTW.z * 0.0023) + 25.0 * sin(vTW.z * 0.0061 + 1.3)) - 44.0, vTW.x) * (1.0 - smoothstep(4.0, 10.0, vTW.y))', strength: 0.8, normal: 0.8 });
  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.receiveShadow = false;
  scene.add(terrain);
}

// Sea of Oman — planar-reflection water (mirrors the sunset, fort, dhows and city lights)
// with a tileable ocean-wave normal map, plus animated surf along the shoreline
function makeWaterNormals() {
  const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N), H = new Float32Array(N * N);
  const waves = [];
  for (let i = 0; i < 64; i++) {                     // integer wave vectors keep the texture seamless
    let kx = 0, ky = 0;
    while (kx === 0 && ky === 0) { kx = Math.round((rand() - 0.5) * 30); ky = Math.round((rand() - 0.5) * 30); }
    const k = Math.hypot(kx, ky);
    waves.push([kx, ky, 1 / Math.pow(k, 1.15), rand() * Math.PI * 2]);
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let h = 0;
    for (const [kx, ky, a, ph] of waves) h += a * Math.sin(2 * Math.PI * (kx * x + ky * y) / N + ph);
    H[y * N + x] = h;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = H[y * N + (x + 1) % N] - H[y * N + (x + N - 1) % N];
    const dy = H[((y + 1) % N) * N + x] - H[((y + N - 1) % N) * N + x];
    const n = new THREE.Vector3(-dx * 9, -dy * 9, 1).normalize(), k = (y * N + x) * 4;
    img.data[k] = (n.x * 0.5 + 0.5) * 255; img.data[k + 1] = (n.y * 0.5 + 0.5) * 255; img.data[k + 2] = (n.z * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const water = new Water(new THREE.PlaneGeometry(5200, 10400), {
  textureWidth: isMobile ? 512 : RECORD ? 2048 : 1024, textureHeight: isMobile ? 512 : RECORD ? 2048 : 1024,   // the ripples blur it anyway; 2048 only for the recorded film
  waterNormals: makeWaterNormals(),
  sunDirection: SUN.clone(), sunColor: 0xffa24e, waterColor: 0x032d38,
  distortionScale: 1.4, fog: true,
});
water.material.uniforms.size.value = 5.5;
// deeper, clearer water: drop the grey lift Water.js adds to reflections
water.material.fragmentShader = water.material.fragmentShader.replace(
  /vec3\(\s*0\.1\s*\)\s*\+\s*reflectionSample\s*\*\s*0\.9/, 'reflectionSample * 0.78');
// cloud shadows darken the sea as they pass
Object.assign(water.material.uniforms, cloudU);
water.material.fragmentShader = CLOUD_GLSL + water.material.fragmentShader.replace(
  'gl_FragColor = vec4( outgoingLight, alpha );', 'gl_FragColor = vec4( outgoingLight * (0.45 + 0.55 * cloudShade(worldPosition.xyz)), alpha );');
water.rotation.x = -Math.PI / 2;
water.position.set(420 + 2600, -0.3, -800);
scene.add(water);

const surfMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uNight: { value: 0 } }]),
  vertexShader: /* glsl */`
    varying vec2 vUv;
    #include <fog_pars_vertex>
    void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */`
    uniform float uTime; uniform float uNight;
    varying vec2 vUv;
    #include <fog_pars_fragment>
    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
    void main(){
      float swash = 0.5 + 0.5 * sin(vUv.y * 0.09 - uTime * 0.9 + sin(vUv.y * 0.013) * 4.0);
      float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(0.35 + 0.5 * swash, 0.15, vUv.x);
      float n = n2(vec2(vUv.y * 0.35, vUv.x * 9.0 - uTime * 0.7)) * 0.6 + n2(vec2(vUv.y * 1.3, vUv.x * 22.0 + uTime)) * 0.4;
      float a = edge * smoothstep(0.38, 0.75, n);
      gl_FragColor = vec4(vec3(0.62, 0.6, 0.58) * (1.0 - uNight * 0.55), a * 0.7);
      #include <fog_fragment>
    }`
});
{
  const pos = [], uv = [], idx = [];
  let i = 0;
  for (let z = -1950; z <= 620; z += 5, i++) {
    const c = coastX(z) + 1.5;
    pos.push(c, -0.12, z, c + 16, -0.12, z);
    uv.push(0, z, 1, z);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const surf = new THREE.Mesh(g, surfMat);
  surf.renderOrder = 2;
  scene.add(surf);
}


/* ---------------------------------------------------------
   Muscat — a low, white city: plaster facades with arched
   windows, roof terraces, neighbourhood mosques with lit minarets
   --------------------------------------------------------- */
const TOWER_Z = -600;
const CELL = 60;
const GRAND = { x: -265, z: -245 };
const cityVert = /* glsl */`
    varying vec3 vWorld; varying vec3 vN; varying vec3 vSeed; varying float vLocalY; varying float vH;
    #include <fog_pars_vertex>
    void main(){
      vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vN = normalize(mat3(instanceMatrix) * normal);
      vSeed = instanceMatrix[3].xyz;
      vLocalY = position.y;
      vH = length(instanceMatrix[1].xyz);
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`;
const cityFrag = /* glsl */`
    uniform float uLit; uniform float uNight;
    ${CLOUD_GLSL}
    varying vec3 vWorld; varying vec3 vN; varying vec3 vSeed; varying float vLocalY; varying float vH;
    #include <fog_pars_fragment>
    float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n2(p); p *= 2.07; a *= 0.5; } return s; }
    void main(){
      vec3 n = normalize(vN);
      float tint = hash(vSeed * 0.37);
      float cs = cloudShade(vWorld);
      // real mix of finishes: white limestone, sand render, grey concrete; each building a little lighter or darker
      vec3 plaster = tint < 0.55 ? vec3(0.47, 0.44, 0.4) : tint < 0.85 ? vec3(0.46, 0.39, 0.3) : vec3(0.4, 0.39, 0.37);
      plaster *= (0.84 + 0.26 * hash(vSeed * 1.91 + 3.7)) * mix(vec3(0.55, 0.56, 0.62), vec3(1.06, 1.02, 0.97), cs);
      vec3 amb = mix(vec3(0.085, 0.088, 0.108), vec3(0.03, 0.033, 0.05), uNight);               // sky fill, only slightly cool
      amb += mix(vec3(0.05, 0.028, 0.016), vec3(0.018, 0.01, 0.006), uNight) * (1.0 - n.y);      // warm bounce off the sand
      vec3 sunc = vec3(1.0, 0.56, 0.26) * 1.3 * (1.0 - uNight * 0.88);
      float sunF = max(0.0, dot(n, normalize(vec3(-0.36, 0.25, -1.0))));
      float along = abs(n.x) > 0.5 ? vWorld.z : vWorld.x;
      float y = vWorld.y, yl = vLocalY * vH;
      float grime = fbm(vec2(along * 0.14, y * 0.14) + vSeed.xz * 0.013);
      float streak = fbm(vec2(along * 0.9, y * 0.03));
      vec3 wall = plaster * (amb * 3.0 + sunc * sunF * 0.6 * cs);
      wall *= 0.8 + 0.28 * grime;
      wall *= 1.0 - 0.16 * smoothstep(0.55, 0.8, streak);
      vec3 col;
      float aOut = 1.0;
    #ifdef PARAPET
      // stepped Omani crenellations cut out of the parapet band
      // coverage from distance fields + alpha-to-coverage: soft edges up close, and once a notch is
      // smaller than a pixel the band simply fills in (cut-outs that small only blink)
      float u = abs(fract(along / 1.8) - 0.5);
      float t = vLocalY;
      float pu = fwidth(along / 1.8), pt = fwidth(t);
      float dStep = max(t - 0.72, u - 0.3), dTip = u - 0.15;
      float solid = min(dStep, dTip);                                             // < 0 inside a merlon
      float cover = t < 0.45 ? 1.0 : 1.0 - smoothstep(-max(pu, pt), max(pu, pt), solid);
      cover = mix(cover, 1.0, smoothstep(0.12, 0.3, pu));
      if (cover < 0.02) discard;
      col = wall * (1.05 + 0.1 * smoothstep(0.45 - pt, 0.45 + pt, t));
      aOut = cover;
    #else
      if (n.y > 0.5) {
        col = plaster * 0.9 * (amb * 1.7 + sunc * 0.05) * (0.65 + 0.55 * fbm(vWorld.xz * 0.25));
      } else {
        float topDist = vH - yl;
        float slabW = fwidth(y / 3.8);
        wall *= 1.0 - 0.1 * (1.0 - smoothstep(0.045 - slabW, 0.045 + slabW, fract(y / 3.8))) * (1.0 - smoothstep(0.1, 0.3, slabW));   // floor slabs, fading before they get thinner than a pixel
        wall *= 1.0 - 0.28 * smoothstep(1.3, 0.45, topDist) * step(0.2, topDist);         // shadow under the cornice
        wall += plaster * amb * 0.9 * smoothstep(0.35, 0.0, topDist);                    // cornice lip
        wall *= 0.5 + 0.5 * smoothstep(0.0, 3.5, yl);                                    // ground contact
        wall += vec3(1.0, 0.55, 0.25) * 0.05 * (1.0 - smoothstep(0.0, 9.0, y)) * (0.3 + uNight);   // street glow

        vec2 cell = vec2(along / 3.3, y / 3.8);
        vec2 id = floor(cell), f = fract(cell);
        float s = dot(vSeed, vec3(0.013, 1.0, 0.029)) + n.x * 3.0 + n.z * 7.0;
        float r  = hash(vec3(floor(id.x / 2.0), id.y, s));
        float r2 = hash(vec3(id, s + 4.1));
        float r3 = hash(vec3(id.x, id.y * 1.7, s + 9.3));
        float qx = abs(f.x - 0.5);
        // shapes as distance fields, blended across exactly one pixel: no hard edges to crawl or blink
        float px = max(fwidth(cell.x), fwidth(cell.y));
        float archY = (f.y - 0.6) * 1.25;
        float dW = min(max(qx - 0.2, max(0.16 - f.y, f.y - 0.6)), max(length(vec2(qx, archY)) - 0.2, 0.6 - f.y));
        float dF = min(max(qx - 0.26, max(0.1 - f.y, f.y - 0.6)), max(length(vec2(qx, archY)) - 0.26, 0.6 - f.y));
        float dS = max(qx - 0.29, max(0.07 - f.y, f.y - 0.12));
        float shapeW = 1.0 - smoothstep(-px, px, dW);
        float shapeF = 1.0 - smoothstep(-px, px, dF);
        float sill = 1.0 - smoothstep(-px, px, dS);
        bool ground = yl < 4.4 && y < 5.0;
        float win = ground ? 0.0 : shapeW;
        float frame = ground ? 0.0 : shapeF - shapeW;
        float aa = smoothstep(0.2, 0.75, max(fwidth(cell.x), fwidth(cell.y)));          // fade to average early: no shimmer

        col = wall;
        col = mix(col, wall * 1.3, frame * (1.0 - aa));                                  // carved plaster surrounds
        col = mix(col, wall * 0.5, (ground ? 0.0 : sill) * (1.0 - aa));                  // sill shadow
        // window: recessed glass or carved wooden mashrabiya shutter
        float shutter = step(r3, 0.24);
        vec2 lg = abs(fract(vec2(f.x * 11.0, f.y * 13.0)) - 0.5);
        float lattice = mix(smoothstep(0.3 - px * 13.0, 0.3 + px * 13.0, max(lg.x, lg.y)), 0.64, smoothstep(0.015, 0.04, px));   // fine lattice melts to its average early
        float recess = smoothstep(0.2, 0.14, qx) * smoothstep(0.16, 0.22, f.y);
        vec3 glass = vec3(0.012, 0.013, 0.018) + vec3(0.02, 0.026, 0.045) * (1.0 - uNight) * recess;
        vec3 winCol = mix(glass, vec3(0.07, 0.04, 0.022), shutter * lattice);
        float lit = smoothstep(1.0 - uLit, 1.06 - uLit, r) * step(0.1, r2);             // windows fade on at dusk instead of popping
        vec3 warm = mix(vec3(1.0, 0.56, 0.26), vec3(1.0, 0.8, 0.58), r2);
        warm = mix(warm, vec3(0.72, 0.84, 1.0) * 0.85, step(0.86, r3) * (1.0 - shutter));
        vec3 nearLight = lit * warm * (0.25 + 0.85 * r2) * mix(1.0, 0.5 * (1.0 - lattice), shutter) * (0.6 + 0.4 * recess);
        vec3 farLight = uLit * 0.9 * warm * 0.55;
        float wA = mix(win, 0.26, aa);
        col = mix(col, winCol, wA);
        col += wA * mix(nearLight, farLight, aa);
        // ground floor: shopfronts with awnings
        if (ground) {
          float sc = fract(along / 6.5);
          float sid = floor(along / 6.5);
          float shop = step(abs(sc - 0.5), 0.36) * step(0.35, yl) * step(yl, 3.2);
          float awning = step(abs(sc - 0.5), 0.41) * step(3.25, yl) * step(yl, 3.75);
          float open = step(0.3, hash(vec3(sid, s, 2.0)));
          vec3 awnC = mix(vec3(0.11, 0.03, 0.02), vec3(0.02, 0.07, 0.045), step(0.5, hash(vec3(sid, s, 5.0))));
          col = mix(col, vec3(0.02, 0.018, 0.016), shop);
          col += shop * open * vec3(1.0, 0.72, 0.42) * (0.45 + 0.6 * uNight) * (0.75 + 0.25 * n2(vec2(along * 0.4, yl)));
          col = mix(col, awnC * (0.6 + 0.4 * uNight), awning * (1.0 - aa));
        }
      }
    #endif
      gl_FragColor = vec4(col, aOut);
      #include <fog_fragment>
    }`;
const cityUniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLit: { value: 0.28 }, uNight: { value: 0 } }]);
Object.assign(cityUniforms, cloudU);
const cityMat = new THREE.ShaderMaterial({ uniforms: cityUniforms, fog: true, vertexShader: cityVert, fragmentShader: cityFrag });
const parapetMat = new THREE.ShaderMaterial({ uniforms: cityUniforms, fog: true, vertexShader: cityVert, fragmentShader: cityFrag, defines: { PARAPET: 1 }, side: THREE.DoubleSide, alphaToCoverage: true });


const buildings = [], mosqueSpots = [];
// Tamlik building sites: blocks left open for branded hoardings, a rising frame and a crane
const SITES = [{ x: 60, z: -120, ry: -Math.PI / 2 }, { x: -60, z: -300, ry: Math.PI / 2 }, { x: 120, z: 60, ry: -Math.PI / 2 }];
const onSite = (x, z) => SITES.some(s => Math.abs(x - s.x) < 33 && Math.abs(z - s.z) < 33);
const hideOnSite = (m, x, z) => { if (onSite(x, z)) m.makeScale(0, 0, 0); };   // same random draws, so the rest of the city is unchanged
for (let gx = -13; gx <= 7; gx++) {
  for (let gz = -30; gz <= 8; gz++) {
    if (gx === 0) continue;                                                             // grand boulevard
    if (Math.abs(gx) <= 1 && Math.abs(gz * CELL - TOWER_Z) <= CELL * 1.6) continue;     // tower plaza
    if (isMobile && rand() < 0.35) continue;
    const cx = gx * CELL, cz = gz * CELL;
    if (Math.abs(cx - GRAND.x) < 100 && Math.abs(cz - GRAND.z) < 90) continue;          // grand mosque grounds
    if (cx + 30 > coastX(cz) - 60) continue;                                            // leave the corniche and beach
    if (Math.abs(gx) > 1 && rand() < 0.035) { mosqueSpots.push([cx, cz]); continue; }
    const split = rand() < 0.6 ? 2 : 1;
    const lot = (CELL - 16) / split;
    for (let i = 0; i < split; i++) for (let j = 0; j < split; j++) {
      if (split === 2 && rand() < 0.15) continue;
      const w = lot * (0.66 + rand() * 0.3);
      const d = lot * (0.66 + rand() * 0.3);
      // Muscat stays low: most buildings 2–6 storeys, the odd taller block
      let h = 7 + rand() * 14 + Math.pow(rand(), 4) * 40;
      if (Math.abs(gx) === 1) h = 16 + rand() * 22;                                     // frame the boulevard
      const x = cx - (CELL - 16) / 2 + lot * (i + 0.5) + (rand() - 0.5) * 4;
      const z = cz - (CELL - 16) / 2 + lot * (j + 0.5) + (rand() - 0.5) * 4;
      buildings.push([x, z, w, h, d]);
    }
  }
}
{
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const extra = buildings.filter(() => rand() < 0.45);                                  // rooftop stair towers / majlis rooms
  const mesh = new THREE.InstancedMesh(geo, cityMat, buildings.length + extra.length);
  const m = new THREE.Matrix4();
  buildings.forEach(([x, z, w, h, d], i) => { m.makeScale(w, h, d).setPosition(x, 0, z); hideOnSite(m, x, z); mesh.setMatrixAt(i, m); });
  extra.forEach(([x, z, w, h, d], i) => {
    const s = 0.28 + rand() * 0.2;
    m.makeScale(w * s, 3.4, d * s).setPosition(x + (rand() - 0.5) * w * 0.4, h, z + (rand() - 0.5) * d * 0.4);
    hideOnSite(m, x, z);
    mesh.setMatrixAt(buildings.length + i, m);
  });
  mesh.frustumCulled = false;
  scene.add(mesh);

  // parapet band (walls only — no lid) that the shader cuts into stepped crenellations
  const pGeo = new THREE.BoxGeometry(1, 1, 1);
  pGeo.translate(0, 0.5, 0);
  const keep = [];
  pGeo.groups.forEach((g) => { if (g.materialIndex !== 2 && g.materialIndex !== 3) for (let k = 0; k < g.count; k++) keep.push(pGeo.index.array[g.start + k]); });
  pGeo.setIndex(keep); pGeo.clearGroups();
  const parapets = new THREE.InstancedMesh(pGeo, parapetMat, buildings.length);
  buildings.forEach(([x, z, w, h, d], i) => { m.makeScale(w + 0.15, 1.5, d + 0.15).setPosition(x, h, z); hideOnSite(m, x, z); parapets.setMatrixAt(i, m); });
  parapets.frustumCulled = false;
  scene.add(parapets);

  // rooftop water tanks — a Muscat signature — white and pale blue
  const tanks = [];
  for (const [x, z, w, h, d] of buildings) {
    if (rand() < 0.45) continue;
    const n = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) tanks.push([x + (rand() - 0.5) * w * 0.7, h, z + (rand() - 0.5) * d * 0.7, 0.8 + rand() * 0.5]);
  }
  const tGeo = new THREE.CylinderGeometry(1, 1, 1, 14); tGeo.translate(0, 0.5, 0);
  const tankMesh = new THREE.InstancedMesh(tGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }), tanks.length);
  const c = new THREE.Color();
  tanks.forEach(([x, y, z, s], i) => {
    m.makeScale(s * 0.75, s * 1.5, s * 0.75).setPosition(x, y, z); hideOnSite(m, x, z); tankMesh.setMatrixAt(i, m);
    tankMesh.setColorAt(i, rand() < 0.3 ? c.setRGB(0.55, 0.68, 0.8) : c.setRGB(0.85, 0.84, 0.8));
  });
  scene.add(tankMesh);

  // rooftop clutter every Muscat roof has: split-unit AC condensers and satellite dishes (own random stream)
  {
    let sd = 4242; const r = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
    const acs = [], dishes = [];
    for (const [x, z, w, h, d] of buildings) {
      if (onSite(x, z)) continue;
      const nAc = Math.floor(r() * 4);
      for (let k = 0; k < nAc; k++) acs.push([x + (r() - 0.5) * w * 0.8, h, z + (r() - 0.5) * d * 0.8, r() * Math.PI]);
      if (r() < 0.55) dishes.push([x + (r() - 0.5) * w * 0.7, h, z + (r() - 0.5) * d * 0.7, r() * Math.PI * 2]);
    }
    const acGeo = new THREE.BoxGeometry(1.0, 0.7, 0.45); acGeo.translate(0, 0.35, 0);
    const acMesh = new THREE.InstancedMesh(acGeo, new THREE.MeshStandardMaterial({ color: 0xc9c6bf, roughness: 0.6 }), acs.length);
    const dishGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6).translate(0, 0.45, 0),
      new THREE.SphereGeometry(0.55, 14, 6, 0, Math.PI * 2, 0, 0.9).rotateX(-Math.PI / 2 - 0.5).translate(0, 1.0, 0.1),
    ]);
    const dishMesh = new THREE.InstancedMesh(dishGeo, new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: 0.5, side: THREE.DoubleSide }), dishes.length);
    const q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    acs.forEach(([x, y, z, a], i) => { m.compose(p.set(x, y, z), q.setFromAxisAngle(UP, a), s); acMesh.setMatrixAt(i, m); });
    dishes.forEach(([x, y, z, a], i) => { m.compose(p.set(x, y, z), q.setFromAxisAngle(UP, a), s); dishMesh.setMatrixAt(i, m); });
    acMesh.layers.set(DETAIL); dishMesh.layers.set(DETAIL);
    scene.add(acMesh, dishMesh);
  }
}


const plasterMat = new THREE.MeshStandardMaterial({ color: 0xe2cfb2, roughness: 0.85, emissive: 0x2a1d10, emissiveIntensity: 0.4, envMapIntensity: 0.4 });   // warm limestone, not sky-tinted
// neighbourhood mosques: base, drum, dome and a single minaret, instanced
{
  const parts = [];
  const base = new THREE.BoxGeometry(22, 8, 22); base.translate(0, 4, 0); parts.push(base);
  const drum = new THREE.CylinderGeometry(6, 6, 3, 24); drum.translate(0, 9.5, 0); parts.push(drum);
  const dome = new THREE.SphereGeometry(6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 1.15, 1); dome.translate(0, 11, 0); parts.push(dome);
  const shaft = new THREE.CylinderGeometry(0.9, 1.2, 28, 10); shaft.translate(9, 14, 9); parts.push(shaft);
  const gallery = new THREE.CylinderGeometry(1.7, 1.7, 0.8, 12); gallery.translate(9, 22, 9); parts.push(gallery);
  const cone = new THREE.ConeGeometry(1, 3.5, 10); cone.translate(9, 29.7, 9); parts.push(cone);
  const geo = mergeGeometries(parts);
  const mesh = new THREE.InstancedMesh(geo, plasterMat, mosqueSpots.length);
  const m = new THREE.Matrix4();
  mosqueSpots.forEach(([x, z], i) => { m.makeRotationY(Math.floor(rand() * 4) * Math.PI / 2).setPosition(x, 0, z); mesh.setMatrixAt(i, m); });
  scene.add(mesh);
}

// Grand mosque: platform, prayer hall, colonnade, great dome and five minarets
{
  const g = new THREE.Group(); g.position.set(GRAND.x, 0, GRAND.z);
  const domeMat = new THREE.MeshStandardMaterial({ color: 0xcdb07a, roughness: 0.3, metalness: 0.55, emissive: 0x3d2a10, emissiveIntensity: 0.6 });
  const add = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
  add(new THREE.BoxGeometry(170, 5, 130), plasterMat, 0, 2.5, 0);
  add(new THREE.BoxGeometry(70, 20, 60), plasterMat, 0, 15, -12);
  for (let k = -7; k <= 7; k++) {                                                        // arcade piers
    add(new THREE.BoxGeometry(1.6, 11, 1.6), plasterMat, k * 10, 10.5, 58);
    add(new THREE.BoxGeometry(1.6, 11, 1.6), plasterMat, k * 10, 10.5, -58);
  }
  add(new THREE.BoxGeometry(152, 2.2, 3), plasterMat, 0, 17, 58);
  add(new THREE.BoxGeometry(152, 2.2, 3), plasterMat, 0, 17, -58);
  add(new THREE.CylinderGeometry(19, 20, 9, 48), plasterMat, 0, 29.5, -12);
  const dome = add(new THREE.SphereGeometry(19, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), domeMat, 0, 34, -12);
  dome.scale.y = 1.35;
  add(new THREE.ConeGeometry(1.2, 9, 12), domeMat, 0, 64, -12);
  const minaret = (x, z, h, r) => {
    add(new THREE.CylinderGeometry(r * 0.75, r, h, 12), plasterMat, x, 5 + h / 2, z);
    for (const f of [0.45, 0.72, 0.9]) add(new THREE.CylinderGeometry(r * 1.45, r * 1.2, 1.2, 14), plasterMat, x, 5 + h * f, z);
    add(new THREE.ConeGeometry(r * 0.8, r * 3.2, 12), domeMat, x, 5 + h + r * 1.6, z);
  };
  minaret(0, 62, 88, 2.6);
  for (const [x, z] of [[-78, -58], [78, -58], [-78, 58], [78, 58]]) minaret(x, z, 44, 1.7);
  scene.add(g);
}

// Fort on the headland — in the spirit of Al Jalali / Mirani: rocky promontory, mud-plaster
// walls, tapered round towers, stepped crenellations, arrow slits, a gate, warm uplighting
const fortLights = [];
{
  // rocky promontory: a fine-detail patch over the coarse terrain
  const P = terrainHeight(FORT.x, FORT.z) + 1.5;
  {
    const S = isMobile ? 90 : 180, size = 480;
    const geo = new THREE.PlaneGeometry(size, size, S, S);
    geo.rotateX(-Math.PI / 2); geo.translate(FORT.x, 0, FORT.z);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
    const rockA = new THREE.Color(0.05, 0.036, 0.03), rockB = new THREE.Color(0.2, 0.13, 0.08), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x - FORT.x, z - FORT.z);
      const mask = Math.exp(-(d * d) / (2 * 115 * 115));
      const rock = ridged(x * 0.022, z * 0.022) * 16 + vnoise(x * 0.12, z * 0.12) * 2.2;
      let h = terrainHeight(x, z) + 1.5 + rock * mask;
      const plateau = smoothJS(62, 44, d);
      h = h * (1 - plateau) + (P + vnoise(x * 0.3, z * 0.3) * 0.4) * plateau;
      pos.setY(i, h);
      c.copy(rockA).lerp(rockB, clamp(vnoise(x * 0.05, z * 0.05) * 0.8 + (h - 20) / 90, 0, 1));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, triplanar(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 'rocky_terrain_02', 1 / 12, { normal: 1.4 })));
  }

  // weathered mud-plaster texture (colour + bump)
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#b8936a'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2400; i++) {
    const r = 4 + rand() * 30, x = rand() * 512, y = rand() * 512;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = rand() < 0.5 ? '120,88,58' : '214,182,140';
    g.addColorStop(0, `rgba(${tone},${0.08 + rand() * 0.12})`); g.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.strokeStyle = 'rgba(90,64,40,0.18)'; ctx.lineWidth = 2;
  for (let y = 16; y < 512; y += 32) { ctx.beginPath(); ctx.moveTo(0, y + (rand() - 0.5) * 3); for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, y + (rand() - 0.5) * 4); ctx.stroke(); }
  for (let i = 0; i < 40000; i++) { ctx.fillStyle = `rgba(${rand() < 0.5 ? '255,240,220' : '40,25,15'},${rand() * 0.12})`; ctx.fillRect(rand() * 512, rand() * 512, 1 + rand() * 2, 1 + rand() * 2); }
  const plasterTex = new THREE.CanvasTexture(cv);
  plasterTex.colorSpace = THREE.SRGBColorSpace;
  plasterTex.wrapS = plasterTex.wrapT = THREE.RepeatWrapping; plasterTex.repeat.set(3, 1.5);
  plasterTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const bumpTex = plasterTex.clone(); bumpTex.colorSpace = THREE.NoColorSpace;

  const fortMat = TEX.clay_plaster.diffuse
    ? triplanar(new THREE.MeshStandardMaterial({ color: 0xc9a176, roughness: 0.95 }), 'clay_plaster', 1 / 3.5, { normal: 1.6, strength: 1.7 })
    : new THREE.MeshStandardMaterial({ map: plasterTex, bumpMap: bumpTex, bumpScale: 1.2, roughness: 0.95 });
  // floodlit from below: warm light that fades up the walls, like the forts above Muttrah at night
  const baseY = P;
  fortMat.onBeforeCompile = (sh) => {
    sh.uniforms.uBase = { value: baseY };
    sh.vertexShader = 'varying float vWY;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = 'uniform float uBase;\nvarying float vWY;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\nfloat up = 1.0 - smoothstep(uBase - 2.0, uBase + 26.0, vWY);\ntotalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.62, 0.34) * (0.08 + 0.5 * up * up);');
  };
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0b0806, roughness: 1 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3b2413, roughness: 0.8, emissive: 0x2a1406, emissiveIntensity: 0.6 });

  const g = new THREE.Group(); g.position.set(FORT.x, P - 1, FORT.z);
  const add = (geo, mat, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };

  // stepped merlon (Omani crenellation) shared geometry
  const ms = new THREE.Shape();
  ms.moveTo(-0.75, 0); ms.lineTo(0.75, 0); ms.lineTo(0.75, 0.8); ms.lineTo(0.45, 0.8); ms.lineTo(0.45, 1.3);
  ms.lineTo(0.18, 1.3); ms.lineTo(0.18, 1.8); ms.lineTo(-0.18, 1.8); ms.lineTo(-0.18, 1.3); ms.lineTo(-0.45, 1.3); ms.lineTo(-0.45, 0.8); ms.lineTo(-0.75, 0.8);
  const merlonGeo = new THREE.ExtrudeGeometry(ms, { depth: 0.7, bevelEnabled: false }); merlonGeo.translate(0, 0, -0.35);
  const merlonPos = [];
  const slitGeo = new THREE.BoxGeometry(0.35, 1.6, 0.4);

  // towers: [x, z, radius, height]
  const towers = [[-30, 24, 8, 22], [30, -24, 8, 22], [-28, -26, 6.5, 18], [26, 28, 6.5, 18], [6, 2, 10, 30]];
  const wallH = 13;
  // curtain walls between the outer towers
  const ring = [towers[0], towers[3], towers[1], towers[2]];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % 4];
    const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
    const wall = add(new THREE.BoxGeometry(len, wallH, 3.2), fortMat, (ax + bx) / 2, wallH / 2, (az + bz) / 2, -ang);
    wall.geometry.attributes.uv.array.forEach((v, i, arr) => { arr[i] = v * (i % 2 === 0 ? len / 12 : 1); });
    for (let t = 0.12; t < 0.9; t += 1.9 / len) merlonPos.push([ax + (bx - ax) * t, wallH, az + (bz - az) * t, -ang]);
    for (let t = 0.2; t < 0.85; t += 0.16) {
      const nx = Math.sin(-ang) * 1.62, nz = Math.cos(-ang) * 1.62;
      for (const sgn of [1, -1]) add(slitGeo, darkMat, ax + (bx - ax) * t + nx * sgn, wallH * 0.62, az + (bz - az) * t + nz * sgn, -ang);
    }
  }
  for (const [x, z, r, h] of towers) {
    add(new THREE.CylinderGeometry(r * 0.88, r * 1.06, h, 40, 1), fortMat, x, h / 2, z);
    add(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.7, 40), fortMat, x, h - 0.2, z);        // parapet string course
    const n = Math.round(r * 2.2);
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; merlonPos.push([x + Math.cos(a) * r * 0.86, h + 0.15, z + Math.sin(a) * r * 0.86, -a + Math.PI / 2]); }
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3; add(slitGeo, darkMat, x + Math.cos(a) * r * 0.97, h * 0.55, z + Math.sin(a) * r * 0.97, -a + Math.PI / 2); }
    fortLights.push([FORT.x + x, P + h + 2.5, FORT.z + z]);
  }
  // keep: a small square house atop the central tower
  add(new THREE.BoxGeometry(7, 5, 7), fortMat, 6, 32.5, 2);
  for (const [dx, dz] of [[-2.2, 3.52], [2.2, 3.52]]) add(new THREE.BoxGeometry(0.9, 1.6, 0.1), darkMat, 6 + dx, 33, 2 + dz);
  // gate facing the city, with a carved wooden door and pointed arch
  {
    const [ax, az] = towers[0], [bx, bz] = towers[2];
    const gx = (ax + bx) / 2 - 1.7, gz = (az + bz) / 2;
    add(new THREE.BoxGeometry(1.5, 13.5, 9), fortMat, gx - 0.6, 6.75, gz);
    const arch = new THREE.Shape(); arch.moveTo(-2.2, 0); arch.lineTo(2.2, 0); arch.lineTo(2.2, 4.5); arch.quadraticCurveTo(2.2, 6.8, 0, 7.6); arch.quadraticCurveTo(-2.2, 6.8, -2.2, 4.5);
    const door = add(new THREE.ShapeGeometry(arch), doorMat, gx - 1.37, 0, gz, -Math.PI / 2);
    door.material.side = THREE.DoubleSide;
    for (let k = -1; k <= 1; k++) add(new THREE.BoxGeometry(0.05, 0.12, 4.2), new THREE.MeshStandardMaterial({ color: 0xc9a060, metalness: 1, roughness: 0.4 }), gx - 1.42, 1.5 + (k + 1) * 1.8, gz);
    fortLights.push([FORT.x + gx - 3, P + 8.5, FORT.z + gz - 3.2], [FORT.x + gx - 3, P + 8.5, FORT.z + gz + 3.2]);
  }
  const merlons = new THREE.InstancedMesh(merlonGeo, fortMat, merlonPos.length);
  const d = new THREE.Object3D();
  merlonPos.forEach(([x, y, z, ry], i) => { d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.updateMatrix(); merlons.setMatrixAt(i, d.matrix); });
  g.add(merlons);
  scene.add(g);
}


// Date palms — boulevard, plaza and corniche, instanced
const PALM = (() => {
  const trunk = new THREE.CylinderGeometry(0.22, 0.4, 10, 7, 8);
  trunk.translate(0, 5, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setX(i, tp.getX(i) + Math.pow(tp.getY(i) / 10, 2) * 0.8);
  trunk.computeVertexNormals();
  const fronds = [];
  for (let k = 0; k < 16; k++) {
    const f = new THREE.PlaneGeometry(1.0, 4.8, 1, 8);
    f.translate(0, 2.4, 0);
    const p = f.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / 4.8;
      p.setZ(i, t * 4.6); p.setY(i, 1.4 * t - (k % 2 ? 2.8 : 2.0) * t * t); p.setX(i, p.getX(i) * (1 - t * 0.75));
    }
    f.rotateY(k / 16 * Math.PI * 2 + (k % 3) * 0.12);
    f.translate(0.8, 10, 0);
    fronds.push(f);
  }
  const crown = mergeGeometries(fronds);
  crown.computeVertexNormals();
  return { trunk, crown };
})();
const palmSpots = [];
for (let z = 470; z > -1850; z -= 18) {
  if (z < TOWER_Z + 100 && z > TOWER_Z - 100) continue;
  palmSpots.push([-31, z], [31, z + 9]);
}
for (let a = 0; a < 14; a++) { const t = a / 14 * Math.PI * 2; palmSpots.push([Math.cos(t) * 62, TOWER_Z + Math.sin(t) * 62]); }
for (let z = 480; z > -1800; z -= 22) palmSpots.push([coastX(z) - 34, z]);
const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3625, roughness: 1 });
const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x33452a, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x0c1206 });
{
  const trunks = new THREE.InstancedMesh(PALM.trunk, palmTrunkMat, palmSpots.length);
  const crowns = new THREE.InstancedMesh(PALM.crown, palmLeafMat, palmSpots.length);
  const d = new THREE.Object3D();
  palmSpots.forEach(([x, z], i) => {
    d.position.set(x, 0, z); d.rotation.set(0, rand() * Math.PI * 2, 0); d.scale.setScalar(0.85 + rand() * 0.4); d.updateMatrix();
    trunks.setMatrixAt(i, d.matrix); crowns.setMatrixAt(i, d.matrix);
  });
  scene.add(trunks, crowns);
}

// Dhows — traditional wooden boats with lateen sails, bobbing offshore
const dhows = [];
{
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-9, 3.2); hullShape.quadraticCurveTo(-7.5, 0.2, -4, 0); hullShape.lineTo(5, 0);
  hullShape.quadraticCurveTo(8.5, 0.6, 10, 4.2); hullShape.lineTo(-9, 3.2);
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 4.2, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.8, bevelSegments: 2 });
  hullGeo.translate(0, -1, -2.1);
  const sailShape = new THREE.Shape();
  sailShape.moveTo(-7, 3.5); sailShape.lineTo(8.5, 17); sailShape.lineTo(4.5, 3.5); sailShape.lineTo(-7, 3.5);
  const sailGeo = new THREE.ShapeGeometry(sailShape);
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.75 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xe0d4bd, roughness: 1, side: THREE.DoubleSide, emissive: 0x1e150c });
  const mastGeo = new THREE.CylinderGeometry(0.15, 0.2, 15, 6); mastGeo.translate(1.5, 9, 0);
  for (let i = 0; i < 9; i++) {
    const z = 380 - i * 250 + (rand() - 0.5) * 120;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeo, hullMat), new THREE.Mesh(sailGeo, sailMat), new THREE.Mesh(mastGeo, hullMat));
    let x = coastX(z) + 110 + rand() * 520;
    if (Math.hypot(x - FORT.x, z - FORT.z) < 230) x += 320;
    g.position.set(x, 0.2, z);
    g.rotation.y = rand() * Math.PI * 2;
    g.scale.setScalar(1.3);
    g.userData.phase = rand() * 10;
    scene.add(g); dhows.push(g);
  }
}


/* ---------------------------------------------------------
   Gulls — a loose flock drifting across the golden sky over the
   boulevard as the camera comes down to street level. Flapping
   and gliding happen in the vertex shader; the flight is scripted
   on the film clock so every loop plays it the same way.
   --------------------------------------------------------- */
const flock = (() => {
  const N = 34;
  const v = [
    0, 0, 0.42,  0.07, 0, 0,  0, 0.02, -0.4,   -0.07, 0, 0,  0, 0.02, -0.4,  0, 0, 0.42,     // body
    -0.05, 0, 0.14,  -0.05, 0, -0.12,  -0.48, 0, 0.06,   -0.48, 0, 0.06,  -0.05, 0, -0.12,  -0.9, 0, -0.14,   // left wing
    0.05, 0, -0.12,  0.05, 0, 0.14,  0.48, 0, 0.06,   0.05, 0, -0.12,  0.48, 0, 0.06,  0.9, 0, -0.14,          // right wing
  ];
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const phase = new Float32Array(N), offs = [];
  for (let i = 0; i < N; i++) {
    phase[i] = rand();
    offs.push([(rand() - 0.5) * 38, (rand() - 0.5) * 11, (rand() - 0.5) * 30, rand() * 6.28, 0.85 + rand() * 0.35]);
  }
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: /* glsl */`
      attribute float aPhase; uniform float uTime;
      #include <fog_pars_vertex>
      void main(){
        vec3 p = position;
        float w = abs(p.x);
        float glide = smoothstep(-0.2, 0.7, sin(uTime * 0.8 + aPhase * 17.0));
        float a = mix(0.18, sin(uTime * 7.0 + aPhase * 6.2832), glide);
        p.y += a * (0.55 * w + 0.35 * w * w);
        p.x *= 1.0 - 0.12 * abs(a);
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <fog_pars_fragment>
      void main(){
        gl_FragColor = vec4(0.03, 0.024, 0.026, 1.0);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const d = new THREE.Object3D(), c = new THREE.Vector3(), h = new THREE.Vector3();
  function update(t) {                               // t = seconds since the film started
    mesh.visible = t > 6 && t < 21;
    if (!mesh.visible) return;
    mat.uniforms.uTime.value = t;
    const u = t - 12;
    c.set(62 - 12.5 * u, 104 + 6 * Math.sin(u * 0.25), -40 - 3.5 * u - 0.35 * u * u);   // a lazy leftward arc
    h.set(-12.5, 1.5 * Math.cos(u * 0.25), -3.5 - 0.7 * u).normalize();
    for (let i = 0; i < N; i++) {
      const [ox, oy, oz, ph, sc] = offs[i];
      d.position.set(c.x + ox + Math.sin(t * 0.5 + ph) * 1.6, c.y + oy + Math.sin(t * 0.7 + ph * 2.0) * 1.2, c.z + oz + Math.cos(t * 0.45 + ph) * 1.6);
      d.lookAt(d.position.x + h.x, d.position.y + h.y, d.position.z + h.z);
      d.rotateZ(Math.sin(t * 0.6 + ph) * 0.18);
      d.scale.setScalar(sc * 1.15);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { update };
})();

/* ---------------------------------------------------------
   Street lamps + traffic — points animated entirely on the GPU
   --------------------------------------------------------- */
const lightsMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uDpr: { value: 1 } },
  vertexShader: /* glsl */`
    attribute vec3 aColor; attribute vec4 aMove; attribute float aSize;   // aMove: dirX, dirZ, speed, loop length
    uniform float uTime; uniform float uScale; uniform float uDpr;
    varying vec3 vColor; varying float vFade;
    void main(){
      vec3 p = position;
      vFade = 1.0;
      if (aMove.z > 0.0) {
        float t = mod(uTime * aMove.z + floor(aSize) * 7.31, aMove.w);
        p.x += aMove.x * t; p.z += aMove.y * t;
        vFade = smoothstep(0.0, 80.0, t) * smoothstep(aMove.w, aMove.w - 80.0, t);
        vFade *= 1.0 - step(abs(p.x), 45.0) * step(-715.0, p.z) * step(p.z, -470.0);     // no traffic across the tower plaza
      }
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float ps = fract(aSize) * 2.0 * uScale / -mv.z;
      gl_PointSize = clamp(ps, 2.0 * uDpr, 26.0 * uDpr);
      vFade *= smoothstep(0.0, 2.0 * uDpr, ps) * 0.85;                   // sub-pixel lights dim instead of popping
      vColor = aColor;
      vFade *= exp(-0.00065 * -mv.z);
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vColor; varying float vFade;
    void main(){
      float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
      gl_FragColor = vec4(vColor * a * a * vFade, 1.0);
    }`
});
{
  const pos = [], col = [], mov = [], size = [];
  // aSize packs: fract = world size (m/2), integer part = random phase for traffic
  const push = (x, y, z, c, s, m = [0, 0, 0, 0]) => {
    pos.push(x, y, z); col.push(...c); mov.push(...m); size.push(Math.floor(rand() * 500) + s);
  };
  const onLand = (x, z) => x < coastX(z) - 40;
  const posts = [];
  const X0 = -13 * CELL - 30, X1 = 7 * CELL + 30, Z0 = -30 * CELL - 30, Z1 = 8 * CELL + 30;
  const lamp = [1.5, 0.9, 0.45], blvd = [2.2, 1.35, 0.7], green = [0.1, 1.9, 0.75], lantern = [2.4, 1.3, 0.55];
  const step = isMobile ? 36 : 24;
  for (let gx = -13; gx <= 8; gx++) {
    const x = gx * CELL - 30;
    for (let z = Z0; z < Z1; z += step) {
      if (onLand(x + 6, z)) { push(x + 6, 7, z, lamp, 0.45); posts.push([x + 7.5, z, 7, -1, 0]); }
      if (onLand(x - 6, z)) { push(x - 6, 7, z + step / 2, lamp, 0.45); posts.push([x - 7.5, z + step / 2, 7, 1, 0]); }
    }
  }
  for (let gz = -30; gz <= 9; gz++) {
    const z = gz * CELL - 30;
    for (let x = X0; x < X1; x += step) if (onLand(x, z)) { push(x, 7, z + 6, lamp, 0.45); posts.push([x, z + 7.5, 7, 0, -1]); }
  }
  for (let z = Z0; z < Z1; z += 16) {
    push(-26, 9, z, blvd, 0.55); push(26, 9, z + 8, blvd, 0.55);
    if (Math.abs(z - TOWER_Z) > 100) posts.push([-27.8, z, 9, 1, 0], [27.8, z + 8, 9, -1, 0]);
  }
  for (let z = TOWER_Z + 30; z < TOWER_Z + 96; z += 6) { push(-9, 0.6, z, green, 0.3); push(9, 0.6, z, green, 0.3); }   // Tamlik green leads to the tower
  for (let z = Z0, i = 0; z < Z1; z += 14, i++) { push(coastX(z) - 26, 6, z, i % 4 ? blvd : green, 0.5); posts.push([coastX(z) - 24.6, z, 6, -1, 0]); }   // corniche promenade, every fourth lamp in brand green
  for (const [x, z] of mosqueSpots) push(x + 9, 32, z + 9, green, 0.7);                     // lit minaret tips
  for (const [x, z] of [[0, 62], [-78, -58], [78, -58], [-78, 58], [78, 58]]) push(GRAND.x + x, x === 0 ? 100 : 55, GRAND.z + z, green, 0.9);
  for (const d of dhows) push(d.position.x, 5, d.position.z, lantern, 0.6);
  for (const f of fortLights) push(f[0], f[1], f[2], lantern, 0.7);

  const white = [2.4, 2.2, 1.9], red = [2.2, 0.16, 0.07];
  const nCars = isMobile ? 450 : 1300;
  for (let i = 0; i < nCars; i++) {
    const toward = rand() < 0.5;
    const speed = 14 + rand() * 14;
    if (i < nCars * 0.35) {            // boulevard: headlights toward camera, tail-lights away
      const x = toward ? -6 - rand() * 12 : 6 + rand() * 12;
      push(x, 0.8, toward ? Z0 : Z1, toward ? white : red, 0.38, [0, toward ? 1 : -1, speed, Z1 - Z0]);
    } else if (i < nCars * 0.5) {      // corniche road along the sea
      const x = 400 + (toward ? -3 : 3);
      push(x, 0.8, toward ? Z0 : Z1, toward ? white : red, 0.34, [0, toward ? 1 : -1, speed, Z1 - Z0]);
    } else if (rand() < 0.5) {
      const x = Math.round(rand() * 20 - 13) * CELL - 30 + (toward ? -3 : 3);
      push(x, 0.8, toward ? Z0 : Z1, toward ? white : red, 0.32, [0, toward ? 1 : -1, speed, Z1 - Z0]);
    } else {
      const z = Math.round(rand() * 39 - 30) * CELL - 30 + (toward ? 3 : -3);
      push(toward ? X0 : X1, 0.8, z, toward ? white : red, 0.32, [toward ? 1 : -1, 0, speed, X1 - X0]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aMove', new THREE.Float32BufferAttribute(mov, 4));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  const pts = new THREE.Points(g, lightsMat);
  pts.frustumCulled = false;
  scene.add(pts);

  // lamp posts under every street light: slim dark-bronze poles with a curved arm and a flat head
  {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.45, metalness: 0.7 });
    const pole = new THREE.CylinderGeometry(0.09, 0.14, 1, 8); pole.translate(0, 0.5, 0);
    const arm = mergeGeometries([
      new THREE.BoxGeometry(1.55, 0.08, 0.08).translate(0.75, 0, 0),                  // arm reaching over the road
      new THREE.BoxGeometry(0.62, 0.1, 0.26).translate(1.45, -0.06, 0),              // luminaire head
      new THREE.CylinderGeometry(0.16, 0.2, 0.3, 8).translate(0, -0.15, 0),          // collar
    ]);
    const poles = new THREE.InstancedMesh(pole, postMat, posts.length), arms = new THREE.InstancedMesh(arm, postMat, posts.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    posts.forEach(([x, z, h, ax, az], i) => {
      m.compose(p.set(x, 0, z), q.identity(), s.set(1, h + 0.1, 1)); poles.setMatrixAt(i, m);
      q.setFromAxisAngle(UP, Math.atan2(-az, ax));
      m.compose(p.set(x, h + 0.12, z), q, s.set(1, 1, 1)); arms.setMatrixAt(i, m);
    });
    poles.frustumCulled = arms.frustumCulled = false;
    poles.layers.set(DETAIL); arms.layers.set(DETAIL);
    scene.add(poles, arms);
  }

  // cars: a body for every pair of moving head/tail lights, driven by the same clock and formula as the lights
  {
    const carIdx = [];
    for (let i = 0; i < mov.length / 4; i++) if (mov[i * 4 + 2] > 0) carIdx.push(i);
    const body = mergeGeometries([
      new RoundedBoxGeometry(1.84, 0.72, 4.5, 1, 0.16).translate(0, 0.58, 0),        // lower body
      new RoundedBoxGeometry(1.6, 0.6, 2.4, 1, 0.2).translate(0, 1.2, -0.15),        // cabin
    ]);
    const geo = new THREE.InstancedBufferGeometry().copy(body);
    geo.instanceCount = carIdx.length;
    const at = (src, k) => new THREE.InstancedBufferAttribute(new Float32Array(carIdx.flatMap((i) => src.slice(i * k, i * k + k))), k);
    geo.setAttribute('iPos', at(pos, 3)); geo.setAttribute('iMove', at(mov, 4)); geo.setAttribute('iSize', at(size, 1)); geo.setAttribute('iCol', at(col, 3));
    const carMat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uNight: { value: 0 } }]),
      vertexShader: /* glsl */`
        attribute vec3 iPos; attribute vec4 iMove; attribute float iSize; attribute vec3 iCol;
        uniform float uTime;
        varying vec3 vN; varying vec3 vPaint; varying float vLocalZ; varying float vUp; varying float vHead;
        #include <fog_pars_vertex>
        void main(){
          float t = mod(uTime * iMove.z + floor(iSize) * 7.31, iMove.w);        // same motion as the light points
          vec2 dir = iMove.xy;
          float head = step(iCol.g, iCol.r * 0.5) < 0.5 ? 1.0 : 0.0;           // white lights lead the car, red ones trail it
          vec3 c = iPos + vec3(dir.x * t, -0.8, dir.y * t) - vec3(dir.x, 0.0, dir.y) * (head > 0.5 ? 2.2 : -2.2);
          float grow = smoothstep(0.0, 60.0, t) * smoothstep(iMove.w, iMove.w - 60.0, t);   // in and out at the city's edge
          grow *= 1.0 - step(abs(c.x), 45.0) * step(-715.0, c.z) * step(c.z, -470.0);          // and never across the tower plaza
          float ang = atan(dir.x, dir.y);
          mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
          vec3 p = position * grow;
          p.xz = R * p.xz;
          vN = normal; vN.xz = R * vN.xz;
          vLocalZ = position.z; vUp = position.y; vHead = head;
          float h = fract(sin(floor(iSize) * 91.7) * 4375.85);
          vPaint = h < 0.4 ? vec3(0.8, 0.8, 0.78) : h < 0.6 ? vec3(0.03) : h < 0.8 ? vec3(0.45, 0.46, 0.47) : vec3(0.52, 0.43, 0.32);
          vec4 mvPosition = viewMatrix * vec4(c + p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform float uNight;
        varying vec3 vN; varying vec3 vPaint; varying float vLocalZ; varying float vUp; varying float vHead;
        #include <fog_pars_fragment>
        void main(){
          vec3 n = normalize(vN);
          float sun = max(dot(n, normalize(vec3(-0.36, 0.3, -1.0))), 0.0) * (1.0 - uNight);
          float sky = 0.5 + 0.5 * n.y;
          vec3 col = vPaint * (vec3(0.07, 0.075, 0.09) * sky + vec3(1.0, 0.6, 0.3) * 0.9 * sun);
          col += vPaint * vec3(1.0, 0.55, 0.25) * 0.05 * uNight * (1.0 - n.y);                 // sodium street glow from below
          float glass = step(0.95, vUp) * step(abs(vLocalZ + 0.15), 1.1);
          col = mix(col, vec3(0.012, 0.014, 0.02) + 0.05 * sky * (1.0 - uNight), glass * 0.85);
          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }`,
    });
    const cars = new THREE.Mesh(geo, carMat);
    cars.frustumCulled = false; cars.userData.noAO = true;              // moved in the shader, so the AO pass can't see where they are
    cars.layers.set(DETAIL);
    scene.add(cars);
    lightsMat.userData.cars = carMat;
  }
}


/* ---------------------------------------------------------
   The signature tower — twisting floor plates, bronze fins,
   floors glowing through the screen. Penthouse on level 40.
   --------------------------------------------------------- */
const LEVELS = 58, LH = 4.2, HALF = 18.5, TWIST = 0.011, PK = 40, FINS = 15;
const tower = new THREE.Group();
tower.position.set(0, 0, TOWER_Z);
scene.add(tower);

const slabMat = new THREE.MeshStandardMaterial({ color: 0xcfc8bc, roughness: 0.55, metalness: 0.05 });
const finMat = new THREE.MeshStandardMaterial({ color: 0xc6a168, roughness: 0.42, metalness: 1, envMapIntensity: 1.1 });
const coreMat = new THREE.MeshStandardMaterial({ color: 0x10141b, roughness: 0.24, metalness: 0.9, envMapIntensity: 0.75 });
// the low sun sits behind the tower on the boulevard axis: damp its direct glint on the metal and glass
const dampSunGlint = (sh) => sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directSpecular *= 0.12;');
// from far away the fins are thinner than a pixel and strobe against the lit floors behind them; there they turn
// partly see-through (alpha-to-coverage, so no sorting), which averages fins and glass the way the eye would
// the spire keeps the same metal but stays solid at any distance
const spireMat = new THREE.MeshStandardMaterial({ color: 0xc6a168, roughness: 0.42, metalness: 1, envMapIntensity: 1.1 });
spireMat.onBeforeCompile = (sh) => { sh.fragmentShader = dampSunGlint(sh); };
finMat.alphaToCoverage = true;
finMat.onBeforeCompile = (sh) => {
  sh.fragmentShader = dampSunGlint(sh).replace('#include <dithering_fragment>',
    '#include <dithering_fragment>\ngl_FragColor.a = 1.0 - 0.3 * smoothstep(220.0, 650.0, length(vViewPosition));');
};
// instance colour drives the interior glow of each floor instead of tinting the glass
// and is broken into individual rooms so floors read as lived-in rather than flat panels
coreMat.onBeforeCompile = (sh) => {
  sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>',
    '#include <project_vertex>\nvWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = 'varying vec3 vWPos;\n' + dampSunGlint(sh)
    .replace('#include <color_fragment>', '')
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #ifdef USE_COLOR
        float room = floor((vWPos.x - vWPos.z) / 5.5);
        float lvl = floor(vWPos.y / 4.2);
        float rh = fract(sin(room * 12.9898 + lvl * 78.233) * 43758.5453);
        float fy = fract(vWPos.y / 4.2);
        // far away, many rooms share a pixel: blend to their average glow instead of letting them blink
        float far = smoothstep(0.08, 0.35, fwidth((vWPos.x - vWPos.z) / 5.5));
        float glow = mix(mix(0.12, 1.35, rh * rh) * (0.65 + 0.6 * smoothstep(0.2, 0.95, fy)), 0.6, far);
        totalEmissiveRadiance += vColor.rgb * glow;
      #endif`);
};

{
  const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(HALF * 2, 0.5, HALF * 2), slabMat, LEVELS + 1);
  const cores = new THREE.InstancedMesh(new THREE.BoxGeometry(33.4, LH - 0.5, 33.4), coreMat, LEVELS);
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, LH, 1.3), finMat, (LEVELS + 3) * FINS * 4);
  const d = new THREE.Object3D(), c = new THREE.Color(), v = new THREE.Vector3();
  const open = (i) => i === PK || i === PK + 1;
  let si = 0, ci = 0, fi = 0;
  for (let i = 0; i < LEVELS + 3; i++) {
    const y = i * LH, rot = i * TWIST;
    d.rotation.set(0, rot, 0);
    if (i <= LEVELS && i !== PK + 1) { d.position.set(0, y, 0); d.updateMatrix(); slabs.setMatrixAt(si++, d.matrix); }
    if (i < LEVELS && !open(i)) {
      d.position.set(0, y + LH / 2, 0); d.updateMatrix(); cores.setMatrixAt(ci, d.matrix);
      if (i < 2) c.setRGB(0.5, 0.33, 0.18);
      else if (rand() < 0.6) c.setRGB(1.0, 0.6, 0.3).multiplyScalar(0.1 + Math.pow(rand(), 1.6) * 0.62);
      else c.setRGB(0.004, 0.005, 0.007);
      cores.setColorAt(ci++, c);
    }
    for (let s = 0; s < 4; s++) {
      if (open(i) && (s === 0 || s === 3)) continue;        // penthouse: open corner facing the approach
      for (let j = 0; j < FINS; j++) {
        const a = -HALF + (j + 0.5) * (2 * HALF / FINS);
        const side = s % 2 === 1;
        v.set(side ? (s === 1 ? HALF - 0.3 : -HALF + 0.3) : a, 0, side ? a : (s === 0 ? HALF - 0.3 : -HALF + 0.3));
        v.applyAxisAngle(UP, rot);
        d.position.set(v.x, y + LH / 2, v.z);
        d.rotation.set(0, rot + (side ? Math.PI / 2 : 0), 0);
        d.updateMatrix();
        fins.setMatrixAt(fi++, d.matrix);
      }
    }
  }
  slabs.count = si; cores.count = ci; fins.count = fi;
  tower.add(slabs, cores, fins);

  // crown light, spire, aviation beacon
  const top = LEVELS * LH, rot = LEVELS * TWIST;
  const crownMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 1.5, 0.62) });   // Tamlik green
  const crown = new THREE.Group(); crown.rotation.y = rot; crown.position.y = top + 0.5;
  for (let s = 0; s < 4; s++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.18, 0.18), crownMat);
    bar.position.set(s < 2 ? 0 : (s === 2 ? HALF - 1 : -HALF + 1), 0, s < 2 ? (s === 0 ? HALF - 1 : -HALF + 1) : 0);
    if (s >= 2) bar.rotation.y = Math.PI / 2;
    crown.add(bar);
  }
  tower.add(crown);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.6, 26, 8), spireMat);
  spire.position.y = top + 3 * LH + 13;
  tower.add(spire);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.25, 0.1) }));
  beacon.position.y = top + 3 * LH + 26.5;
  tower.add(beacon);
  tower.userData.beacon = beacon;
}

// Plaza + reflecting pool
{
  const paving = new THREE.Mesh(new THREE.PlaneGeometry(150, 190), new THREE.MeshStandardMaterial({ ...pbr('concrete_pavers', 50, 63), color: 0x3a3836, roughness: 0.9 }));
  paving.rotation.x = -Math.PI / 2; paving.position.set(0, 0.04, TOWER_Z);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(96, 96), new THREE.MeshStandardMaterial({ color: 0x020304, roughness: 0.04, metalness: 1 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.08, TOWER_Z);
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(12, 32), new THREE.MeshStandardMaterial({ color: 0x1c1b1f, roughness: 0.6 }));
  walk.rotation.x = -Math.PI / 2; walk.position.set(0, 0.1, TOWER_Z + 34);
  scene.add(paving, pool, walk);
}

// Tamlik monument — the 3D logo standing at the head of the boulevard, on a stone plinth,
// uplit and glowing green onto the paving so it belongs to the city at dusk
{
  const mats = makeLogoMaterials(0.9);
  mats.green.emissiveIntensity = 0.2;
  const { root: logo } = buildLogo3D(mats, 90, 12);
  const S = 78 / 1390, Z = -492;
  logo.scale.setScalar(S);
  logo.position.set(0, 2.2 + 197 * S, Z);
  scene.add(logo);
  const stone = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.55, metalness: 0.1 });
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(84, 2.2, 10, 3, 0.4), stone);
  plinth.position.set(0, 1.1, Z); scene.add(plinth);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(80, 0.4, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.06, 1.1, 0.45) }));
  strip.position.set(0, 2.25, Z + 5.05); scene.add(strip);
  // soft green pool of light on the paving
  const gcv = document.createElement('canvas'); gcv.width = gcv.height = 256;
  const gctx = gcv.getContext('2d'), grd = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgba(40,255,140,0.55)'); grd.addColorStop(1, 'rgba(40,255,140,0)');
  gctx.fillStyle = grd; gctx.fillRect(0, 0, 256, 256);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(130, 60), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gcv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
  glow.rotation.x = -Math.PI / 2; glow.position.set(0, 0.35, Z + 8); scene.add(glow);
  const up = new THREE.PointLight(0x3dff9a, 900, 70, 1.6); up.position.set(0, 3, Z + 16); scene.add(up);
  const warmUp = new THREE.PointLight(0xffb070, 500, 60, 1.6); warmUp.position.set(0, 26, Z + 22); scene.add(warmUp);
}

/* ---------------------------------------------------------
   Tamlik across the city: building sites wrapped in branded
   hoardings with cranes, a lit sign on the tower crown, and a
   drone show that draws the logo in the night sky at the end
   --------------------------------------------------------- */
const LOGO_PATHS = [...document.querySelectorAll('#tamlik-logo path')].map(p => ({ id: p.id, fill: p.getAttribute('fill'), d: new Path2D(p.getAttribute('d')) }));
function drawLogo2D(ctx, x, y, w, colors = {}) {
  const k = w / 1390;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  for (const p of LOGO_PATHS) { ctx.fillStyle = colors[p.id] || p.fill; ctx.fill(p.d); }
  ctx.restore();
}
// the logo as flat shapes, centred, facing +z (mats keyed by SVG path id)
function flatLogo(width, mats) {
  const g = new THREE.Group(), k = width / 1390;
  for (const path of new SVGLoader().parse(LOGO_SVG).paths) {
    const geo = new THREE.ShapeGeometry(SVGLoader.createShapes(path), 6);
    geo.translate(-695, -197, 0); geo.scale(k, -k, 1);
    g.add(new THREE.Mesh(geo, mats[path.userData.node.id]));
  }
  return g;
}
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// building sites
{
  const hoardTex = canvasTex(2048, 128, (c, w, h) => {
    c.fillStyle = '#17191c'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#01A652'; c.fillRect(0, h - 18, w, 18); c.fillRect(0, 0, w, 3);
    c.fillStyle = '#e9e4da'; c.font = '300 42px "Segoe UI", Arial, sans-serif'; c.textBaseline = 'middle';
    if ('letterSpacing' in c) c.letterSpacing = '6px';
    for (const x0 of [70, 1094]) {
      drawLogo2D(c, x0, 18, 290, { 'roof-left': '#d4d1ca' });
      c.fillText('tamlikoman.com', x0 + 400, 58);
    }
  });
  const bannerTex = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#01A652'; c.fillRect(0, 0, w, h);
    drawLogo2D(c, 40, 76, 432, { 'roof-left': '#ffffff', 'roof-right': '#ffffff', wordmark: '#ffffff' });
  });
  const latticeTex = canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#6d6a63'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f1ede4'; c.lineWidth = 7;
    c.strokeRect(3, 3, w - 6, h - 6);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.lineWidth = 5; c.stroke();
  });
  latticeTex.wrapS = latticeTex.wrapT = THREE.RepeatWrapping;
  const lattice = (sx, sy, sz, rep) => {        // a lattice box, its texture tiled along the long axis
    const geo = new THREE.BoxGeometry(sx, sy, sz), uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i) * rep);
    return geo;
  };
  const hoardMat = new THREE.MeshStandardMaterial({ map: hoardTex, roughness: 0.8, emissive: 0xffffff, emissiveMap: hoardTex, emissiveIntensity: 0.3 });
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.7, emissive: 0xffffff, emissiveMap: bannerTex, emissiveIntensity: 0.35, side: THREE.DoubleSide });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.9 });
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x8e7c63, roughness: 1 });
  const concMat = triplanar(new THREE.MeshStandardMaterial({ color: 0xa29d94, roughness: 0.92 }), 'rough_concrete', 1 / 2.5);
  const netMat = new THREE.MeshStandardMaterial({ color: 0x0b6e3b, roughness: 0.85, emissive: 0x01a652, emissiveIntensity: 0.06, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
  const craneMat = new THREE.MeshStandardMaterial({ map: latticeTex, roughness: 0.6, metalness: 0.2 });
  const redMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.08) });
  const HW = 27, HH = 3.4;                        // hoarding half-width, height

  SITES.forEach((site, n) => {
    const g = new THREE.Group(); g.position.set(site.x, 0, site.z); g.rotation.y = site.ry; scene.add(g);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, HW * 2), dirtMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = 0.06; g.add(ground);
    // hoardings on all four sides, the branded face outward
    for (let s = 0; s < 4; s++) {
      const a = s * Math.PI / 2;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, HH), hoardMat);
      face.position.set(Math.sin(a) * (HW + 0.05), HH / 2, Math.cos(a) * (HW + 0.05)); face.rotation.y = a; g.add(face);
      const back = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, HH, 0.08), backMat);
      back.position.set(Math.sin(a) * HW, HH / 2, Math.cos(a) * HW); back.rotation.y = a; g.add(back);
    }
    // the rising concrete frame, top floors wrapped in green safety netting
    const floors = [5, 7, 4][n], FH = 3.6, FW = 34, FD = 26;
    for (let f = 0; f <= floors; f++) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(FW, 0.45, FD), concMat);
      slab.position.set(0, f * FH + 0.22, -3); slab.castShadow = slab.receiveShadow = true; g.add(slab);
      if (f === floors) break;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.8, FH, 0.8), concMat);
        col.position.set(-FW / 2 + 1 + i * (FW - 2) / 3, f * FH + FH / 2 + 0.45, -3 - FD / 2 + 1 + j * (FD - 2) / 2);
        col.castShadow = true; g.add(col);
      }
    }
    const net = new THREE.Mesh(new THREE.BoxGeometry(FW + 0.6, FH * 2, FD + 0.6, 1, 1, 1), netMat);
    net.geometry.deleteAttribute('uv');
    net.position.set(0, (floors - 2) * FH + FH + 0.45, -3); g.add(net);
    // tower crane beside the frame, a Tamlik banner on its counter-jib
    const MH = floors * FH + 24;
    const crane = new THREE.Group(); crane.position.set(HW - 7, 0, -HW + 8); g.add(crane);
    const mast = new THREE.Mesh(lattice(2, MH, 2, MH / 2), craneMat); mast.position.y = MH / 2; crane.add(mast);
    const slew = new THREE.Group(); slew.position.y = MH; slew.rotation.y = [-2.3, -2.0, -2.6][n]; crane.add(slew);
    const jib = new THREE.Mesh(lattice(1.6, 44, 1.6, 22).rotateX(Math.PI / 2), craneMat); jib.position.set(0, 1.2, 14); slew.add(jib);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.6), new THREE.MeshStandardMaterial({ color: 0xe9e5dc, roughness: 0.5 })); cab.position.set(0, -0.2, 1.4); slew.add(cab);
    const apex = new THREE.Mesh(lattice(1.4, 7, 1.4, 3.5), craneMat); apex.position.y = 4.2; slew.add(apex);
    const weight = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 4.5), concMat); weight.position.set(0, 0.2, -6.5); slew.add(weight);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.5), bannerMat); banner.position.set(1.35, 0.4, -5.5); banner.rotation.y = Math.PI / 2; slew.add(banner);
    const banner2 = banner.clone(); banner2.position.x = -1.35; banner2.rotation.y = -Math.PI / 2; slew.add(banner2);
    for (const [y, z] of [[7.8, 0], [1.2, 35.8]]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 6), redMat); l.position.set(0, y, z); slew.add(l); }
    site.slew = slew; site.ry0 = slew.rotation.y;
  });
}

// lit Tamlik sign on all four faces of the tower crown
{
  const top = LEVELS * LH, rot = LEVELS * TWIST;
  // a mipmapped texture rather than geometry: seen from across the city the letters are a few pixels tall,
  // and texture filtering shrinks them smoothly where thin shapes would shimmer
  const tex = canvasTex(2048, 600, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    drawLogo2D(c, 24, 24, w - 48, { 'roof-left': '#e8e2d6', 'roof-right': '#21d67a', wordmark: '#21d67a' });
  });
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const signMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.5, 1.5, 1.5), transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Group(); ring.position.y = top + 6.4; ring.rotation.y = rot; tower.add(ring);
  for (let s = 0; s < 4; s++) {
    const a = s * Math.PI / 2, sign = new THREE.Mesh(new THREE.PlaneGeometry(27, 27 * 600 / 2048), signMat);
    sign.position.set(Math.sin(a) * (HALF + 0.75), 0, Math.cos(a) * (HALF + 0.75)); sign.rotation.y = a;
    ring.add(sign);
  }
}

// drone show: ~800 lights lift off over the city at nightfall and draw the logo in the sky.
// Driven by the film clock, so every loop (and every recording) plays it the same way
const drones = (() => {
  const STEP = isMobile ? 17 : 12;
  const cv = document.createElement('canvas'); cv.width = 1390; cv.height = 394;
  const c2 = cv.getContext('2d', { willReadFrequently: true });
  drawLogo2D(c2, 0, 0, 1390, { 'roof-left': '#ff0000', 'roof-right': '#00ff00', wordmark: '#00ff00' });
  const px = c2.getImageData(0, 0, 1390, 394).data;
  let sd = 7331; const r = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);   // own seed: the city's random stream stays untouched
  const C = new THREE.Vector3(-70, 300, -1010), k = 520 / 1390;
  const toCam = new THREE.Vector3(-150, 330, 90).sub(C).setY(0).normalize();              // faces the closing aerial
  const right = new THREE.Vector3().crossVectors(UP, toCam).normalize();
  const tgt = [], start = [], col = [], du = [], p = new THREE.Vector3();
  for (let y = STEP / 2, row = 0; y < 394; y += STEP * 0.866, row++) {
    for (let x = (row % 2 ? STEP / 2 : 0) + STEP / 4; x < 1390; x += STEP) {
      const i = (Math.floor(y) * 1390 + Math.floor(x)) * 4;
      if (px[i + 3] < 128) continue;
      p.copy(C).addScaledVector(right, (x - 695) * k).addScaledVector(UP, (197 - y) * k).addScaledVector(toCam, (r() - 0.5) * 4);
      tgt.push(p.x, p.y, p.z);
      start.push(C.x + (x - 695) * k * 1.3 + (r() - 0.5) * 160, 45 + r() * 50, C.z + 120 + (r() - 0.5) * 240);
      col.push(...(px[i] > 128 ? [2.0, 1.95, 1.8] : [0.1, 2.2, 0.85]));
      du.push(x / 1390 * 1.8 + r() * 1.4, x / 1390);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tgt, 3));
  geo.setAttribute('aStart', new THREE.Float32BufferAttribute(start, 3));
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aDU', new THREE.Float32BufferAttribute(du, 2));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uShow: { value: 0 }, uSweep: { value: -1 }, uScale: lightsMat.uniforms.uScale, uDpr: lightsMat.uniforms.uDpr },
    vertexShader: /* glsl */`
      attribute vec3 aStart; attribute vec3 aColor; attribute vec2 aDU;
      uniform float uT; uniform float uShow; uniform float uSweep; uniform float uScale; uniform float uDpr;
      varying vec3 vColor; varying float vFade;
      void main(){
        float k = clamp((uT - aDU.x) / 5.0, 0.0, 1.0);
        k = k * k * (3.0 - 2.0 * k);
        vec3 ctrl = vec3(mix(aStart.x, position.x, 0.2), position.y * 0.9, mix(aStart.z, position.z, 0.4));
        vec3 p = mix(mix(aStart, ctrl, k), mix(ctrl, position, k), k);
        p += vec3(sin(uT * 1.3 + aDU.x * 9.0), sin(uT * 1.1 + aDU.y * 23.0), cos(uT * 0.9 + aDU.x * 5.0)) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float ps = 2.4 * uScale / -mv.z;
        gl_PointSize = clamp(ps, 2.0 * uDpr, 14.0 * uDpr);
        vFade = smoothstep(0.0, 2.0 * uDpr, ps) * uShow;
        float sweep = exp(-pow((aDU.y - uSweep) * 6.0, 2.0));
        // fly as soft white lights, take on the brand colours as they lock into place
        vColor = mix(vec3(1.3, 1.25, 1.15) * 0.6, aColor, k) * (1.0 + 1.3 * sweep * k);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vFade;
      void main(){
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vColor * a * a * vFade, 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  const T0 = 50.5;                                   // film second the drones lift off
  function update(ft) {
    const show = smooth(T0 - 1, T0 + 1, ft);
    pts.visible = show > 0;
    if (!pts.visible) return;
    mat.uniforms.uT.value = ft - T0;
    mat.uniforms.uShow.value = show;
    mat.uniforms.uSweep.value = lerp(-0.3, 1.3, clamp((ft - 57.6) / 2.4, 0, 1));
  }
  return { update };
})();

/* ---------------------------------------------------------
   Penthouse interior (local space of level PK, floor at y=0.25)
   Travertine floor, walnut logo wall, majlis-inspired lounge,
   dining, kitchen island, mashrabiya screen, sheer curtains.
   --------------------------------------------------------- */
const pent = new THREE.Group();
pent.position.y = PK * LH;
pent.rotation.y = PK * TWIST;
tower.add(pent);
{
  const F = 0.25, CEIL = 8.15;
  const canvasTex = (w, h, draw, repeat = [1, 1], srgb = true) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  const noiseFill = (ctx, w, h, base, amt, n = 9000) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '0,0,0'},${rand() * amt})`; ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 3); }
  };

  // --- textures ---------------------------------------------------------------
  const travTex = canvasTex(1024, 1024, (ctx, w, h) => {
    noiseFill(ctx, w, h, '#cdbfa8', 0.05, 30000);
    for (let i = 0; i < 70; i++) {                                    // travertine veining
      ctx.strokeStyle = `rgba(150,128,100,${0.08 + rand() * 0.12})`; ctx.lineWidth = 1 + rand() * 3;
      ctx.beginPath(); let x = 0, y = rand() * h; ctx.moveTo(x, y);
      while (x < w) { x += 20 + rand() * 40; y += (rand() - 0.5) * 14; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(90,75,60,0.55)'; ctx.lineWidth = 2;        // tile joints
    for (let k = 0; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(k * w / 4, 0); ctx.lineTo(k * w / 4, h); ctx.moveTo(0, k * h / 4); ctx.lineTo(w, k * h / 4); ctx.stroke(); }
  }, [4, 4]);
  const walnutTex = canvasTex(512, 512, (ctx, w, h) => {
    noiseFill(ctx, w, h, '#4a2e1c', 0.06, 8000);
    for (let x = 0; x < w; x += 32) {
      const g = ctx.createLinearGradient(x, 0, x + 26, 0);
      g.addColorStop(0, '#3a2213'); g.addColorStop(0.5, '#5a3822'); g.addColorStop(1, '#3a2213');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 26, h);
      for (let i = 0; i < 14; i++) { ctx.strokeStyle = `rgba(30,16,8,${rand() * 0.3})`; ctx.beginPath(); const gx = x + rand() * 26; ctx.moveTo(gx, 0); ctx.bezierCurveTo(gx + 4, h * 0.3, gx - 4, h * 0.6, gx + 2, h); ctx.stroke(); }
      ctx.fillStyle = '#140a05'; ctx.fillRect(x + 26, 0, 6, h);
    }
  }, [3, 1]);
  const rugTex = canvasTex(1024, 704, (ctx, w, h) => {                 // Omani / Persian-inspired rug
    ctx.fillStyle = '#5a1a18'; ctx.fillRect(0, 0, w, h);
    const band = (inset, color, width) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2); };
    band(18, '#d8c7a3', 14); band(46, '#1f2a44', 30); band(78, '#c9a36a', 6);
    for (let x = 60; x < w - 40; x += 32) { ctx.fillStyle = '#c9a36a'; ctx.beginPath(); ctx.moveTo(x, 46); ctx.lineTo(x + 10, 36); ctx.lineTo(x + 20, 46); ctx.lineTo(x + 10, 56); ctx.fill(); ctx.beginPath(); ctx.moveTo(x, h - 46); ctx.lineTo(x + 10, h - 36); ctx.lineTo(x + 20, h - 46); ctx.lineTo(x + 10, h - 56); ctx.fill(); }
    ctx.strokeStyle = 'rgba(216,199,163,0.35)'; ctx.lineWidth = 2;
    for (let x = 110; x < w - 90; x += 48) for (let y = 110; y < h - 90; y += 48) { ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x + 14, y); ctx.lineTo(x, y + 14); ctx.lineTo(x - 14, y); ctx.closePath(); ctx.stroke(); }
    const cx = w / 2, cy = h / 2;
    for (const [r, c] of [[210, '#1f2a44'], [170, '#d8c7a3'], [150, '#7a2622'], [96, '#c9a36a'], [58, '#1f2a44']]) {
      ctx.fillStyle = c; ctx.beginPath();
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, rr = k % 2 ? r * 0.72 : r; ctx.lineTo(cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr * 0.8); }
      ctx.fill();
    }
    for (let i = 0; i < 26000; i++) { ctx.fillStyle = `rgba(0,0,0,${rand() * 0.12})`; ctx.fillRect(rand() * w, rand() * h, 2, 2); }
  });
  const latticeTex = canvasTex(256, 256, (ctx, w, h) => {              // mashrabiya: eight-point star lattice
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 11; ctx.lineJoin = 'miter';
    const star = (cx, cy, r) => { ctx.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2 + Math.PI / 16, rr = k % 2 ? r * 0.62 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.closePath(); ctx.stroke(); };
    for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h], [w / 2, h / 2]]) star(x, y, w * 0.34);
    ctx.lineWidth = 9; ctx.strokeRect(0, 0, w, h);
  }, [5, 2], false);
  const artTex = canvasTex(1024, 640, (ctx, w, h) => {                 // painting: Hajar ridges over desert dunes
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2b2238'); sky.addColorStop(0.5, '#c86a3a'); sky.addColorStop(1, '#e8b27a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    const layer = (y0, amp, freq, color, seed) => { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y0 + Math.sin(x * freq + seed) * amp + Math.sin(x * freq * 2.7 + seed * 2) * amp * 0.35); ctx.lineTo(w, h); ctx.fill(); };
    layer(h * 0.45, 40, 0.012, '#5b3a4a', 1); layer(h * 0.56, 34, 0.009, '#7b4636', 2);
    layer(h * 0.7, 22, 0.006, '#b56b3e', 3); layer(h * 0.82, 16, 0.005, '#d99a5c', 4);
    ctx.fillStyle = 'rgba(255,230,190,0.9)'; ctx.beginPath(); ctx.arc(w * 0.68, h * 0.38, 36, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 20000; i++) { ctx.fillStyle = `rgba(0,0,0,${rand() * 0.08})`; ctx.fillRect(rand() * w, rand() * h, 2, 2); }
  });
  const blobTex = canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, [1, 1], false);
  const haloTex = canvasTex(256, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, [1, 1], false);

  // --- materials -------------------------------------------------------------
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
  const travertine = M({ ...pbr('marble_01', 7), color: 0xe9dfd0, roughness: 0.75, normalScale: new THREE.Vector2(0.6, 0.6), envMapIntensity: 0.45 });
  const marble = M({ color: 0xece6dc, roughness: 0.22 });
  const walnut = M({ ...pbr('walnut_veneer', 3, 2), roughness: 0.85 });
  const darkWood = M({ color: 0x2b1a10, roughness: 0.5 });
  const linen = M({ color: 0xd8cfbf, roughness: 0.95 });
  const linenDark = M({ color: 0xb9ab95, roughness: 0.95 });
  const velvetGreen = M({ color: 0x0d5a36, roughness: 0.75 });          // Tamlik green accents
  const terracotta = M({ color: 0x9a4a2a, roughness: 0.9 });
  const brass = M({ color: 0xc9a060, roughness: 0.28, metalness: 1 });
  const blackMetal = M({ color: 0x111111, roughness: 0.4, metalness: 0.8 });
  const leaf = M({ color: 0x2f4a26, roughness: 0.85, side: THREE.DoubleSide });
  const lampGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.35, 0.8) });

  const rbox = (w, h, d, r, mat, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), mat);
    m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; pent.add(m); return m;
  };
  const mesh = (geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; pent.add(m); return m; };
  const blob = (w, d, x, z, o = 0.6) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: o, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, F + 0.025, z); pent.add(m);
  };

  // --- shell -----------------------------------------------------------------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36.6, 36.6), travertine);
  floor.rotation.x = -Math.PI / 2; floor.position.y = F + 0.01; floor.receiveShadow = true; pent.add(floor);
  // ceiling: recessed downlights + perimeter cove
  const downGeo = new THREE.CircleGeometry(0.16, 20);
  for (let x = -14; x <= 14; x += 4) for (let z = -14; z <= 14; z += 4) {
    const d = new THREE.Mesh(downGeo, lampGlow); d.rotation.x = Math.PI / 2; d.position.set(x, CEIL - 0.01, z); pent.add(d);
  }
  const cove = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.6, 0.36) });
  mesh(new THREE.BoxGeometry(34, 0.04, 0.1), cove, 0, CEIL - 0.02, -16.8, false);
  mesh(new THREE.BoxGeometry(0.1, 0.04, 34), cove, 16.8, CEIL - 0.02, 0, false);

  // --- logo wall: walnut-clad core with the Tamlik logo in 3D -----------------
  const coreW = 9, coreD = 6, coreX = 9, coreZ = -7;
  const core = new THREE.Mesh(new THREE.BoxGeometry(coreW, CEIL - F, coreD), [travertine, travertine, travertine, travertine, walnut, travertine]);
  core.position.set(coreX, F + (CEIL - F) / 2, coreZ); core.receiveShadow = true; pent.add(core);
  const faceZ = coreZ + coreD / 2;
  {
    const wallMats = makeLogoMaterials(1.3);
    wallMats.green.emissiveIntensity = 0.2;
    const { root: logo } = buildLogo3D(wallMats, 60, 8);
    logo.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    logo.scale.setScalar(6.6 / 1390);
    logo.position.set(coreX, F + 4.42, faceZ + 0.3);
    pent.add(logo);
    const logoLight = new THREE.PointLight(0x3dff9a, 1.6, 6, 2); logoLight.position.set(coreX, F + 4.4, faceZ + 0.9); pent.add(logoLight);
  }
  // brass reveal lines framing the walnut
  mesh(new THREE.BoxGeometry(0.05, CEIL - F, 0.05), brass, coreX - coreW / 2 + 0.03, F + (CEIL - F) / 2, faceZ + 0.03, false);
  mesh(new THREE.BoxGeometry(0.05, CEIL - F, 0.05), brass, coreX + coreW / 2 - 0.03, F + (CEIL - F) / 2, faceZ + 0.03, false);

  // painting + sideboard on the core's lounge-facing side
  const artX = coreX - coreW / 2 - 0.04;
  const art = mesh(new THREE.PlaneGeometry(4.6, 2.9), M({ map: artTex, roughness: 0.9 }), artX - 0.02, F + 3.9, coreZ, false);
  art.rotation.y = -Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.08, 3.05, 4.75), brass, artX, F + 3.9, coreZ, false);
  rbox(0.55, 0.75, 5.2, 0.04, walnut, artX - 0.32, F + 0.375, coreZ);
  { const v = model('brass_vase_01', 0.36); v.position.set(artX - 0.35, F + 0.75, coreZ - 1.6); pent.add(v); }
  { const v = model('antique_ceramic_vase_01', 0.32); v.position.set(artX - 0.35, F + 0.75, coreZ + 1.7); pent.add(v); }

  // --- lounge (majlis-inspired, facing the view) ------------------------------
  const LX = -3, LZ = -7;
  const place = (name, size, x, z, ry = 0) => { const o = model(name, size); o.position.set(x, F, z); o.rotation.y = ry; pent.add(o); return o; };
  place('Sofa_01', 3.3, LX - 1.75, LZ + 0.9, Math.PI);                                // facing the view
  place('Sofa_01', 3.3, LX + 1.75, LZ + 0.9, Math.PI);
  blob(9.5, 4.2, LX - 0.6, LZ + 0.4, 0.45);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(9, 6.2), M({ map: rugTex, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.rotation.z = Math.PI / 2; rug.position.set(LX, F + 0.02, LZ - 2.6); rug.receiveShadow = true; pent.add(rug);
  // round travertine coffee table on a brass plinth, with a dallah coffee set
  mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 48), marble, LX, F + 0.44, LZ - 2.8);
  mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.4, 32), brass, LX, F + 0.2, LZ - 2.8);
  const dallah = mesh(new THREE.LatheGeometry([[0, 0], [0.13, 0], [0.15, 0.05], [0.1, 0.17], [0.05, 0.22], [0.07, 0.3], [0.05, 0.37], [0.02, 0.42], [0, 0.44]].map(([a, b]) => new THREE.Vector2(a * 1.4, b * 1.4)), 28), brass, LX + 0.2, F + 0.49, LZ - 2.7);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.34, 8), brass); spout.position.set(0.2, 0.3, 0); spout.rotation.z = -0.9; dallah.add(spout);
  for (let k = 0; k < 4; k++) mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.07, 16), marble, LX - 0.35 + (k % 2) * 0.16, F + 0.525, LZ - 2.95 + Math.floor(k / 2) * 0.18);
  mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.05, 32), darkWood, LX - 0.45, F + 0.515, LZ - 2.55);                // tray of dates
  for (let k = 0; k < 9; k++) mesh(new THREE.SphereGeometry(0.035, 8, 6), M({ color: 0x3a1a0c, roughness: 0.4 }), LX - 0.45 + Math.cos(k) * 0.14 * (k % 3) / 2, F + 0.555, LZ - 2.55 + Math.sin(k) * 0.14 * (k % 3) / 2, false);
  // lounge chairs
  for (const [x, ry] of [[LX - 4.2, 0.7 + Math.PI], [LX + 3.4, -0.7 + Math.PI]]) {
    place('mid_century_lounge_chair', 1.0, x, LZ - 4.6, ry);
    blob(1.6, 1.6, x, LZ - 4.6, 0.45);
  }
  // arched floor lamp
  {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(LX - 6.2, F, LZ + 1.8), new THREE.Vector3(LX - 6.2, F + 3.6, LZ + 0.8), new THREE.Vector3(LX - 4.2, F + 2.7, LZ - 1.2));
    mesh(new THREE.TubeGeometry(curve, 32, 0.035, 8), brass, 0, 0, 0);
    mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.06, 24), marble, LX - 6.2, F + 0.03, LZ + 1.8);
    const shade = mesh(new THREE.SphereGeometry(0.34, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass, LX - 4.2, F + 2.55, LZ - 1.2);
    shade.material = M({ color: 0xc9a060, roughness: 0.3, metalness: 1, side: THREE.DoubleSide });
    mesh(new THREE.SphereGeometry(0.1, 12, 8), lampGlow, LX - 4.2, F + 2.52, LZ - 1.2, false);
  }
  // side table with incense burner (mabkhara)
  {
    const t = place('side_table_01', 0.6, LX + 4.1, LZ + 0.6);
    const top = new THREE.Box3().setFromObject(t).max.y;
    mesh(new THREE.LatheGeometry([[0, 0], [0.09, 0], [0.06, 0.1], [0.12, 0.2], [0.13, 0.26], [0, 0.26]].map(([a, b]) => new THREE.Vector2(a, b)), 16), brass, LX + 4.1, top, LZ + 0.6);
  }

  // --- mashrabiya screen between lounge and dining -----------------------------
  {
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 3.6), M({ color: 0x8a6436, metalness: 0.7, roughness: 0.45, alphaMap: latticeTex, alphaTest: 0.5, side: THREE.DoubleSide }));
    scr.position.set(-12.9, F + 1.9, 2.2); scr.castShadow = true; pent.add(scr);
    mesh(new THREE.BoxGeometry(8.6, 0.08, 0.12), brass, -12.9, F + 3.72, 2.2, false);
  }

  // --- dining ------------------------------------------------------------------
  const DX = -10, DZ = 9.5;
  rbox(6.2, 0.1, 2.0, 0.04, walnut, DX, F + 0.78, DZ);
  rbox(0.25, 0.73, 1.4, 0.05, darkWood, DX - 2.4, F + 0.365, DZ);
  rbox(0.25, 0.73, 1.4, 0.05, darkWood, DX + 2.4, F + 0.365, DZ);
  for (let k = 0; k < 8; k++) {
    const side = k < 4 ? -1 : 1, x = DX - 2.1 + (k % 4) * 1.4;
    const g = new THREE.Group(); g.position.set(x, F, DZ + side * 1.35); g.rotation.y = side > 0 ? Math.PI : 0; pent.add(g);
    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.12, 0.6, 2, 0.05), linenDark); seat.position.y = 0.48; seat.castShadow = true; g.add(seat);
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.08, 2, 0.04), darkWood); back.position.set(0, 0.85, -0.28); back.castShadow = true; g.add(back);
    for (const [lx, lz] of [[-0.26, -0.24], [0.26, -0.24], [-0.26, 0.24], [0.26, 0.24]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.46, 6), darkWood); l.position.set(lx, 0.23, lz); g.add(l); }
  }
  blob(7.5, 4.2, DX, DZ, 0.55);
  for (let k = 0; k < 3; k++) mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.3 + k * 0.08, 16), brass, DX - 0.4 + k * 0.4, F + 0.98 + k * 0.04, DZ, false);   // candlesticks
  const globe = new THREE.MeshPhysicalMaterial({ color: 0xfff1dd, emissive: 0xffc98a, emissiveIntensity: 1.4, roughness: 0.2, transmission: 0 });
  for (let k = 0; k < 7; k++) {
    const x = DX - 2.4 + k * 0.8, y = 5.0 + Math.sin(k * 1.7) * 0.5, z = DZ + Math.cos(k * 2.3) * 0.3;
    mesh(new THREE.SphereGeometry(0.24, 24, 16), globe, x, y, z, false);
    mesh(new THREE.CylinderGeometry(0.008, 0.008, CEIL - y), blackMetal, x, (CEIL + y) / 2, z, false);
  }

  // --- kitchen island + bar stools -------------------------------------------
  const KX = 10.5, KZ = 7;
  rbox(1.5, 1.0, 5.6, 0.04, walnut, KX, F + 0.5, KZ);
  rbox(1.8, 0.08, 6.0, 0.03, marble, KX, F + 1.04, KZ);
  for (let k = 0; k < 3; k++) {
    const z = KZ - 1.8 + k * 1.8;
    mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.1, 24), velvetGreen, KX - 1.35, F + 0.8, z);
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), brass, KX - 1.35, F + 0.38, z);
    mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 24), brass, KX - 1.35, F + 0.3, z).rotation.x = Math.PI / 2;
  }
  mesh(new THREE.SphereGeometry(0.28, 20, 12), M({ color: 0xc6b18a, roughness: 0.6 }), KX, F + 1.2, KZ + 1.6);   // bowl
  for (let k = 0; k < 3; k++) {
    const z = KZ - 1.8 + k * 1.8;
    mesh(new THREE.ConeGeometry(0.28, 0.38, 24, 1, true), M({ color: 0x0d5a36, roughness: 0.5, side: THREE.DoubleSide }), KX, 4.3, z, false);
    mesh(new THREE.SphereGeometry(0.09, 12, 8), lampGlow, KX, 4.13, z, false);
    mesh(new THREE.CylinderGeometry(0.006, 0.006, CEIL - 4.4), blackMetal, KX, (CEIL + 4.4) / 2, z, false);
  }
  blob(3, 6.6, KX - 0.5, KZ, 0.5);

  // --- greenery: a potted date palm and olive trees -------------------------------
  place('potted_plant_02', 1.5, 15, 15, 0.4); place('potted_plant_02', 1.5, 15.5, -15.5, 2.1);
  place('potted_plant_01', 1.3, -15.5, -15.5, 1.2); place('potted_plant_01', 1.3, -15.8, 14.8, 2.9);
  place('potted_plant_01', 1.1, LX - 6.4, LZ - 2.0, 0.7);

  // --- sheer curtains, gathered in panels at the back and side ---------------------
  {
    const curtainMat = M({ color: 0xf1e8da, roughness: 1, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
    const panel = (len, x, z, ry) => {
      const g = new THREE.PlaneGeometry(len, CEIL - F - 0.1, Math.round(len * 10), 1);
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 6.3) * 0.09);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, curtainMat); m.position.set(x, F + (CEIL - F) / 2, z); m.rotation.y = ry; pent.add(m);
    };
    panel(6, -13.5, -17.3, 0); panel(5, 14, -17.3, 0);
    panel(6, 17.3, -13.5, -Math.PI / 2); panel(6, 17.3, 13.5, -Math.PI / 2);
  }

  // glass balustrade along the open corner
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb4c8, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.12, depthWrite: false });
  mesh(new THREE.BoxGeometry(36.6, 1.1, 0.04), glass, 0, F + 0.55, HALF + 0.05, false);
  mesh(new THREE.BoxGeometry(0.04, 1.1, 36.6), glass, -HALF - 0.05, F + 0.55, 0, false);
  mesh(new THREE.BoxGeometry(36.6, 0.05, 0.08), brass, 0, F + 1.12, HALF + 0.05, false);
  mesh(new THREE.BoxGeometry(0.08, 0.05, 36.6), brass, -HALF - 0.05, F + 1.12, 0, false);

  // --- lighting: warm key with soft shadows over the lounge, practical fills --------
  const key = new THREE.SpotLight(0xffc690, 55, 24, 0.95, 0.85, 1.6);
  key.position.set(LX + 1, CEIL - 0.3, LZ - 1); key.target.position.set(LX, 0, LZ - 2);
  key.castShadow = true; key.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 6;
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 14; key.shadow.camera.layers.enable(DETAIL);
  pent.add(key, key.target);
  const dine = new THREE.SpotLight(0xffc088, 40, 16, 0.8, 0.9, 1.6);
  dine.position.set(DX, CEIL - 0.3, DZ); dine.target.position.set(DX, 0, DZ);
  pent.add(dine, dine.target);
  const l1 = new THREE.PointLight(0xffb27a, 16, 26, 2); l1.position.set(-3, 3.6, -5); pent.add(l1);
  const l2 = new THREE.PointLight(0xffa868, 12, 20, 2); l2.position.set(4, 3.4, 8); pent.add(l2);
}



/* ---------------------------------------------------------
   Post-processing — bloom, then a filmic finish (vignette,
   subtle lens fringing, grain)
   --------------------------------------------------------- */
const rt = new THREE.WebGLRenderTarget(W * DPR, H * DPR, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(DPR);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
// ambient occlusion: soft contact shadows where surfaces meet (building bases, furniture, battlements).
// Glass, glows, lights and the sky are left out so they never cast false shadows. Off on phones (and with ?noao).
let aoPass = null;
if (!isMobile && !params.has('noao')) {
  class SceneAO extends GTAOPass {
    // soft shading needs no fine grid: live, it works at half size (a quarter of the pixels, and the extra
    // pass that redraws the city for depth costs a quarter too). Recording for the screens keeps full size.
    setSize(w, h) { const k = RECORD ? 1 : 0.5; super.setSize(Math.round(w * k), Math.round(h * k)); }
    overrideVisibility() {
      const cache = this._visibilityCache;
      this.scene.traverse((o) => {
        cache.set(o, o.visible);
        if (o.isPoints || o.isLine || o.isSprite || o.userData.noAO || (o.material && [].concat(o.material).some((m) => m.transparent || m.blending === THREE.AdditiveBlending))) o.visible = false;
      });
    }
  }
  const ao = new SceneAO(scene, camera, W * DPR, H * DPR);
  ao.updateGtaoMaterial({ radius: 2.2, distanceExponent: 1.5, thickness: 2.5, scale: 1.0, samples: 16 });
  ao.updatePdMaterial({ radius: 10, samples: 16 });
  ao.blendIntensity = 0.85;
  composer.addPass(ao);
  aoPass = ao;
}
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.42, 0.45, 0.9);
// wider bloom mips tinted warm: highlights halate amber like film instead of blooming grey-white
[[1, 1, 1], [1, 0.97, 0.93], [1, 0.93, 0.85], [1, 0.89, 0.79], [1, 0.86, 0.75]].forEach((c, i) => bloom.bloomTintColors[i].set(...c));
composer.addPass(bloom);
composer.addPass(new OutputPass());
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uCA: { value: 0.006 }, uVig: { value: 0.5 }, uGrain: { value: 0.016 }, uNight: { value: 0 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uCA; uniform float uVig; uniform float uGrain; uniform float uNight;
    varying vec2 vUv;
    void main(){
      vec2 c = vUv - 0.5;
      float d = dot(c, c);
      vec2 off = c * d * uCA;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      // grade: cool the shadows, warm the highlights, lift saturation where colour is timid
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col *= mix(mix(vec3(0.96, 0.98, 1.04), vec3(0.96, 0.98, 1.05), uNight), vec3(1.03, 1.0, 0.95), smoothstep(0.04, 0.55, l));
      float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
      col = max(mix(vec3(l), col, 0.93), 0.0);                                                // photographic, not poster: a touch under full saturation
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.2);                                   // gentle S-curve
      col *= mix(1.0, 1.0 - uVig, smoothstep(0.08, 0.55, d * 1.5));
      float g = fract(sin(dot(gl_FragCoord.xy + fract(uTime * 7.13) * 400.0, vec2(12.9898, 78.233))) * 43758.5453);
      col += (g - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`
});
composer.addPass(finish);
if (RECORD) finish.uniforms.uGrain.value = 0.009;          // finer grain: the encoder keeps detail instead of noise
// cloud shadows on every lit outdoor surface (the penthouse interior keeps its own light), and the sky-coloured haze
const insidePent = new Set();
pent.traverse((o) => insidePent.add(o));
function adopt(root) {
  root.traverse((o) => {
    if (o.isMesh && !insidePent.has(o)) for (const m of [].concat(o.material)) if (m.isMeshStandardMaterial) addCloudShadows(m);
    for (const m of [].concat(o.material || [])) {
      if (!m.fog || m.userData.atmo) continue;
      m.userData.atmo = true;
      if (m.isShaderMaterial) { Object.assign(m.uniforms, atmoU); continue; }
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); Object.assign(sh.uniforms, atmoU); };
    }
  });
}
adopt(scene);
// the penthouse furniture and plants are drawn only when the camera is close enough to see them
const pentFurniture = [], pentAt = new THREE.Vector3();
pent.traverse((o) => { if (o.isMesh && o.layers.mask === 1 << DETAIL) pentFurniture.push(o); });
pent.updateWorldMatrix(true, false); pent.getWorldPosition(pentAt);
let pentShown = true;

function setPointScale() {
  lightsMat.uniforms.uScale.value = (H * DPR * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  lightsMat.uniforms.uDpr.value = DPR;
}
setPointScale();

/* ---------------------------------------------------------
   Hero windows: the three flats the camera flies into. Each is a real opening in a facade (a bronze frame, a stone
   surround that covers the painted-on windows of the building shader, a sill and a thin green line that draws round
   it as the camera arrives). The opening itself is empty: main.js shows the department's own 3D room through it,
   rendered from the matching camera, so flying in is one continuous move.
   --------------------------------------------------------- */
const heroWindows = [];
function heroWindow({ c, n, w, h, surround = [1.1, 0.75, 0.9], stone = 0xb9b1a6, label = '' }) {
  const g = new THREE.Group();
  g.position.copy(c);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  // stone surround with the opening cut out
  const [sx, sb, st] = surround;
  const sh = new THREE.Shape();
  sh.moveTo(-w / 2 - sx, -h / 2 - sb); sh.lineTo(w / 2 + sx, -h / 2 - sb); sh.lineTo(w / 2 + sx, h / 2 + st); sh.lineTo(-w / 2 - sx, h / 2 + st);
  const hole = new THREE.Path();
  hole.moveTo(-w / 2, -h / 2); hole.lineTo(-w / 2, h / 2); hole.lineTo(w / 2, h / 2); hole.lineTo(w / 2, -h / 2);
  sh.holes.push(hole);
  const stoneMat = triplanar(new THREE.MeshStandardMaterial({ color: stone, roughness: 0.8 }), 'white_plaster_rough_01', 1 / 1.5, { strength: 0.6 });
  const face = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }), stoneMat);
  face.position.z = -0.04; g.add(face);
  // bronze frame, slim mullion-free glazing frame, and a projecting sill
  const bronze = new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.38, metalness: 0.9 });
  const fw = 0.1, fd = 0.16;
  for (const [bw, bh, x, y] of [[w + 2 * fw, fw, 0, h / 2 + fw / 2], [w + 2 * fw, fw, 0, -h / 2 - fw / 2], [fw, h, -w / 2 - fw / 2, 0], [fw, h, w / 2 + fw / 2, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, fd), bronze); b.position.set(x, y, 0.04); g.add(b);
  }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.09, 0.42), stoneMat); sill.position.set(0, -h / 2 - fw - 0.045, 0.14); g.add(sill);
  // warm light falling out of the flat onto the surround
  const spill = new THREE.PointLight(0xffc48a, 0, 7, 2); spill.position.set(0, 0.2, 0.6); g.add(spill);
  // the green line: four strokes that draw round the frame
  const lineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.06, 1.6, 0.62), toneMapped: false, transparent: true, opacity: 1, depthWrite: false });
  const L = 0.035, ow = w + 2 * fw + 0.16, oh = h + 2 * fw + 0.16, lines = [];
  for (const [len, x, y, rz, ax, dir] of [[ow, 0, -oh / 2, 0, 'x', 1], [oh, ow / 2, 0, Math.PI / 2, 'x', 1], [ow, 0, oh / 2, Math.PI, 'x', 1], [oh, -ow / 2, 0, -Math.PI / 2, 'x', 1]]) {
    const geo = new THREE.PlaneGeometry(len, L); geo.translate(len / 2, 0, 0);
    const m = new THREE.Mesh(geo, lineMat);
    m.position.set(x - Math.cos(rz) * len / 2, y - Math.sin(rz) * len / 2, 0.14); m.rotation.z = rz;
    m.userData.noAO = true; g.add(m); lines.push(m);
  }
  // the department's name beside the window, in the Tamlik green
  let tag = null;
  if (label) {
    const t = canvasTex(1024, 128, (x, cw, ch) => {
      x.clearRect(0, 0, cw, ch);
      x.fillStyle = 'rgba(4,20,12,.55)'; x.fillRect(0, 22, cw, ch - 44);
      x.fillStyle = '#19d67a'; x.fillRect(0, 22, 8, ch - 44);
      x.fillStyle = '#d9ffec'; x.font = '600 50px Manrope, sans-serif';
      if ('letterSpacing' in x) x.letterSpacing = '10px';
      x.textBaseline = 'middle'; x.fillText(label, 34, ch / 2 + 2);
    });
    tag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6 * 128 / 1024), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    tag.position.set(w / 2 + 0.25, h / 2 + 0.55, 0.16); tag.geometry.translate(1.3, 0, 0); tag.userData.noAO = true; g.add(tag);
  }
  scene.add(g); adopt(g); g.updateMatrixWorld(true);
  const win = { g, c: c.clone(), n: n.clone(), w, h, lines, tag, spill, draw: 0 };
  // the four corners of the opening (world), for the portal outline
  win.corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => g.localToWorld(new THREE.Vector3(x, y, 0)));
  heroWindows.push(win);
  return win;
}
function syncWindow(win) {
  const d = win.draw;                       // 0 .. 1: the green line draws round, the label fades in
  win.lines.forEach((m, i) => { const k = clamp(d * 4 - i, 0, 1); m.scale.x = Math.max(k, 1e-4); m.visible = k > 0; });
  if (win.tag) { win.tag.material.opacity = smooth(0.6, 1, d); win.tag.visible = d > 0.6; }
  win.spill.intensity = 6 * smooth(0, 1, d);
}
// a tower flat: the opening sits on the glass of level `lvl`, centred `a` metres across the face that looks down the
// boulevard (+z), and the bronze fins in front of it are taken out
const towerFins = tower.children.find((o) => o.isInstancedMesh && o.geometry.parameters?.depth === 1.3);
function towerWindow(lvl, a, opts) {
  const rot = lvl * TWIST, y = lvl * LH + 0.25;
  const n = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
  const c = new THREE.Vector3(a, 0, 16.7 + 0.03).applyAxisAngle(UP, rot).add(tower.position).setY(y + 0.15 + opts.h / 2);
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < towerFins.count; i++) {
    towerFins.getMatrixAt(i, m); p.setFromMatrixPosition(m).add(tower.position);
    const dy = p.y - (lvl * LH + LH / 2), along = p.clone().sub(c).dot(new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot)));
    if (Math.abs(dy) < 0.1 && p.clone().sub(c).dot(n) > -0.5 && p.clone().sub(c).dot(n) < 2.5 && Math.abs(along) < opts.w / 2 + 1.4) towerFins.setMatrixAt(i, zero);
  }
  towerFins.instanceMatrix.needsUpdate = true;
  return heroWindow({ c, n, surround: [0.5, 0.1, 0.15], stone: 0x2a2724, ...opts });
}

/* ---------------------------------------------------------
   3D logo stage: its own small renderer, studio-lit, drawn onto the opening curtains (the tower film's logo intro,
   driven by the journey's timeline instead of GSAP: anim.l / r / w / sweep go 0 -> 1)
   --------------------------------------------------------- */
const logoRig = (() => {
  const LW = 1400, LHt = 480;
  const cv = document.createElement('canvas'); cv.width = LW; cv.height = LHt;
  const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: false, preserveDrawingBuffer: record });
  r.setPixelRatio(2); r.setSize(LW, LHt, false);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  const sc = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r);
  sc.environment = pm.fromScene(new RoomEnvironment(), 0.03).texture;
  sc.environmentIntensity = 0.7;
  pm.dispose();
  const cam = new THREE.PerspectiveCamera(22, LW / LHt, 0.1, 100); cam.position.set(0, 1.6, 12); cam.lookAt(0, 0.1, 0);
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 5, 8);
  const warm = new THREE.DirectionalLight(0xffc48a, 1.4); warm.position.set(-7, 2, 4);
  const rim = new THREE.DirectionalLight(0x3dff9a, 2.2); rim.position.set(0, -2, -7);
  const sweep = new THREE.PointLight(0xffffff, 0, 14, 1.4); sweep.position.set(-9, 1.2, 2.6);
  sc.add(key, warm, rim, sweep);
  const { root, parts } = buildLogo3D(makeLogoMaterials(1.1));
  root.scale.setScalar(10 / 1390);
  const holder = new THREE.Group(); holder.add(root); sc.add(holder);
  const anim = { l: 1, r: 1, w: 1, sweep: 1.5 };
  const v = new THREE.Vector3();
  function pose(t) {
    const Lp = parts['roof-left'], R = parts['roof-right'], Wd = parts['wordmark'];
    const l = anim.l, rr = anim.r, w = anim.w;
    Lp.position.copy(Lp.userData.base).add(v.set(-520 * (1 - l), 300 * (1 - l), 420 * (1 - l)));
    Lp.rotation.set(0.4 * (1 - l), -1.3 * (1 - l), 0.6 * (1 - l));
    Lp.visible = l > 0.001;
    R.position.copy(R.userData.base).add(v.set(520 * (1 - rr), 300 * (1 - rr), 420 * (1 - rr)));
    R.rotation.set(0.4 * (1 - rr), 1.3 * (1 - rr), -0.6 * (1 - rr));
    R.visible = rr > 0.001;
    Wd.position.copy(Wd.userData.base).add(v.set(0, -160 * (1 - w), -200 * (1 - w)));
    Wd.rotation.set(0.9 * (1 - w), 0, 0);
    Wd.scale.set(1, 1, Math.max(0.02, w));
    Wd.visible = w > 0.001;
    holder.rotation.set(Math.sin(t * 0.7) * 0.05, 0.22 + Math.sin(t * 0.5) * 0.18, 0);
    sweep.position.x = anim.sweep * 8;
    sweep.intensity = 34 * Math.max(0, 1 - Math.abs(anim.sweep));
  }
  let ctx = null;
  function renderTo(target, t) {
    pose(t);
    r.render(sc, cam);
    if (!ctx) { ctx = target.getContext('2d'); ctx.imageSmoothingQuality = 'high'; }
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(cv, 0, 0, target.width, target.height);
  }
  return { anim, renderTo };
})();

/* ---------------------------------------------------------
   Draw one frame at film time t (seconds) with the camera already placed. night: 0 golden hour .. 0.8 night.
   --------------------------------------------------------- */
const ft = { gulls: 0, drones: 0 };
let lastFov = -1;
function draw(t, { night = 0, droneT = -100, gullT = -100 } = {}) {
  if (camera.fov !== lastFov) { lastFov = camera.fov; camera.updateProjectionMatrix(); setPointScale(); }
  const near = camera.position.distanceTo(pentAt) < 900;
  if (near !== pentShown) { pentShown = near; for (const o of pentFurniture) o.visible = near; }
  skyMat.uniforms.uNight.value = night;
  skyMat.uniforms.uTime.value = t;
  cityMat.uniforms.uLit.value = 0.16 + 0.5 * night;
  FOG.copy(PAL.fogCool[0]).lerp(PAL.fogCool[1], night / 0.8);
  atmoU.uFogWarm.value.copy(PAL.fogWarm[0]).lerp(PAL.fogWarm[1], night / 0.8);
  streetU.uStreet.value = 0.02 + 0.11 * smooth(0.2, 0.8, night / 0.8);
  hemi.intensity = 0.55 - 0.32 * night;
  finish.uniforms.uNight.value = night;
  cityMat.uniforms.uNight.value = night;
  water.material.uniforms.time.value = t * 0.45;
  surfMat.uniforms.uTime.value = t;
  surfMat.uniforms.uNight.value = night;
  for (const d of dhows) { d.position.y = 0.2 + Math.sin(t * 1.1 + d.userData.phase) * 0.25; d.rotation.z = Math.sin(t * 0.8 + d.userData.phase) * 0.035; }
  lightsMat.uniforms.uTime.value = t;
  lightsMat.userData.cars.uniforms.uTime.value = t;
  lightsMat.userData.cars.uniforms.uNight.value = night;
  flock.update(gullT);
  drones.update(droneT);
  for (const st of SITES) st.slew.rotation.y = st.ry0 + Math.sin(t * 0.09 + st.x) * 0.35;
  sky.position.copy(camera.position);
  tower.userData.beacon.material.color.setRGB(5, 0.25, 0.1).multiplyScalar(0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.6), 3));
  cloudU.uCloudT.value = t;
  cloudU.uCloudDay.value = 1 - night * 0.7;
  for (const w of heroWindows) syncWindow(w);
  bloom.strength = 0.42;
  sunLight.intensity = 2.4;
  finish.uniforms.uTime.value = t;
  if (aoPass) aoPass.enabled = record || QUALITY.ao;
  composer.render();
}
function setPR(p) {
  DPR = p; renderer.setPixelRatio(p); composer.setPixelRatio(p); composer.setSize(W, H); setPointScale();
}
renderer.compile(scene, camera);
return { renderer, scene, camera, W, H, draw, setPR, logoRig, heroWindow, towerWindow, buildings, tower, TOWER_Z, LEVELS, LH, HALF, TWIST, pr: DPR };
}
