// Download the 3D furniture and textures for the three rooms (Poly Haven, CC0) and the music (Internet Archive, CC0)
// into assets/.   node tools/fetch-assets.mjs
// New downloads are re-encoded on arrival at a high JPEG quality (visually the same, noticeably smaller).
// The big pieces seen up close, and every wall / floor / fabric surface, come at 2k so they stay sharp on screen.
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
async function save(path, url) {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`);
  writeFileSync(path, Buffer.from(await r.arrayBuffer()));
  if (/\.jpg$/.test(path)) {
    const tmp = path.replace(/\.jpg$/, '.tmp.jpg');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path, '-q:v', '3', tmp]);
    if (statSync(tmp).size < statSync(path).size) renameSync(tmp, path); else rmSync(tmp);
  }
  console.log('saved', path.slice(root.length + 1));
}

// furniture (glTF; 1k, or 2k for the HERO pieces below)
const MODELS = ['mid_century_lounge_chair', 'modern_arm_chair_01', 'modern_coffee_table_01', 'side_table_01',
  'modern_ceiling_lamp_01', 'modern_wooden_cabinet', 'potted_plant_01',
  'potted_plant_02', 'potted_plant_04', 'brass_vase_01', 'ceramic_vase_02',
  'throw_pillows_01', 'standing_picture_frame_02',
  // maintenance: the repair kit; fit-out: more decor
  'ladder_sectioned_01', 'metal_toolbox', 'adjustable_wrench', 'Drill_01', 'wooden_bucket_02', 'cardboard_box_01',
  'wooden_display_shelves_01', 'ceramic_vase_03', 'ceramic_vase_04', 'wicker_basket_02',
  // the realism pass: a lived-in flat for Maintenance, a working studio for Media, a finished home for Fit-out
  'sofa_02', 'sofa_03', 'television_02', 'WetFloorSign_01', 'wall_clock', 'hanging_picture_frame_01', 'hanging_picture_frame_02',
  'screwdriver', 'pliers', 'measuring_tape_01', 'cross_pein_hammer', 'retro_multimeter', 'trowel_01', 'cement_bag', 'tool_cart',
  'coffee_table_round_01', 'tea_set_01', 'wooden_crate_01', 'industrial_storage_cart', 'metal_stool_01', 'power_box_01', 'Camera_01',
  'dining_table', 'dining_chair_02', 'book_encyclopedia_set_01', 'side_table_tall_01', 'brass_vase_03', 'ceramic_pot'];
// the large pieces the camera sees up close: 2k textures
const HERO = ['sofa_02', 'sofa_03', 'mid_century_lounge_chair', 'modern_arm_chair_01', 'modern_coffee_table_01', 'coffee_table_round_01',
  'modern_wooden_cabinet', 'dining_table', 'dining_chair_02', 'side_table_01', 'side_table_tall_01', 'tool_cart', 'industrial_storage_cart',
  'metal_toolbox', 'wooden_display_shelves_01', 'throw_pillows_01', 'tea_set_01', 'wall_clock', 'WetFloorSign_01', 'metal_stool_01'];
// surfaces (2k jpg): diffuse, OpenGL normal, roughness
const TEXTURES = ['wood_floor', 'plastered_wall', 'concrete_floor_02', 'poly_wool_herringbone', 'hessian_230', 'red_brick_03', 'rough_linen',
  'marble_01', 'walnut_veneer'];
// lighting environments (1k HDR) for reflections
const HDRIS = ['studio_small_09', 'lebombo'];

for (const name of MODELS) {
  const res = HERO.includes(name) ? '2k' : '1k', dir = join(root, 'models', name), gf = join(dir, `${name}.gltf`);
  if (existsSync(gf) && !readFileSync(gf, 'utf8').includes('_' + res)) rmSync(dir, { recursive: true });   // resolution changed
  const g = (await (await fetch(`https://api.polyhaven.com/files/${name}`)).json()).gltf[res].gltf;
  await save(join(root, 'models', name, `${name}.gltf`), g.url);
  for (const [rel, v] of Object.entries(g.include || {})) await save(join(root, 'models', name, rel), v.url);
}
for (const name of TEXTURES) {
  const dir = join(root, 'tex3d', name), mark = join(dir, '2k');
  if (existsSync(dir) && !existsSync(mark)) rmSync(dir, { recursive: true });                            // was 1k
  const f = await (await fetch(`https://api.polyhaven.com/files/${name}`)).json();
  for (const [m, file] of [[f.Diffuse ? 'Diffuse' : 'col_1', 'diffuse'], ['nor_gl', 'nor_gl'], ['Rough', 'rough']]) if (f[m]) await save(join(root, 'tex3d', name, `${file}.jpg`), f[m]['2k'].jpg.url);
  writeFileSync(mark, '');
}

for (const name of HDRIS) {
  const f = await (await fetch(`https://api.polyhaven.com/files/${name}`)).json();
  await save(join(root, 'hdr', `${name}.hdr`), f.hdri['1k'].hdr.url);
}

// music: "Once More With You" by Loyalty Freak Music (CC0), album Minimal Ambient Bounce
const src = join(root, 'audio', 'src', 'music.mp3'), out = join(root, 'audio', 'src', 'music.m4a');
await save(src, 'https://archive.org/download/LoyaltyFreakMusic-minimalAmbientBounce/Loyalty_Freak_Music_-_01_-_Once_more_with_you.mp3');
if (!existsSync(out)) execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vn', '-t', '90', '-c:a', 'aac', '-b:a', '192k', out]);
console.log('music ready:', out);
