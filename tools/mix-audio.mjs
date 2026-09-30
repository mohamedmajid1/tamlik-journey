// Build the soundtrack: one seamless loop exactly as long as the journey (84 s), every sound placed on the film's own
// timeline (seconds from the start, see T in src/main.js).   node tools/mix-audio.mjs -> assets/audio/loop.m4a
// Music: "Once More With You" by Loyalty Freak Music (CC0). City and gulls: field recordings from Radio Aporee (Public
// Domain Mark), as in the tower film. The departments' effects are the departments film's, synthesised here and tuned
// to the music (A minor), each block shifted to where its room now plays. Needs ffmpeg.
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync, mkdirSync, writeFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => join(root, 'assets', 'audio', 'src', f);
const OUT = join(root, 'assets', 'audio', 'loop.m4a');
const L = 84;            // the film: END in src/main.js
const XF = 4;            // music crossfade across the loop seam
// where things happen (src/main.js T): the curtains part, the three rooms (14 s each), the caption, the curtains close
const OPEN = 3.65, ROOMS = [14.5, 35, 57.5], CAPTION = 76.5, CLOSE = 82.5;
mkdirSync(dirname(OUT), { recursive: true });

const env = (keys) => {
  let e = String(keys[keys.length - 1][1]);
  for (let i = keys.length - 2; i >= 0; i--) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    e = `if(lt(t,${t1}),${v0}+${v1 - v0}*(t-${t0})/${t1 - t0},${e})`;
  }
  return `if(lt(t,${keys[0][0]}),${keys[0][1]},${e})`;
};
const vol = (keys) => `volume='${env(keys)}':eval=frame`;
let SHIFT = 0;           // the departments' cues are written in their own film's seconds; SHIFT moves a block to its room
const place = (at) => { const ms = Math.round((at + SHIFT) * 1000); return `adelay=${ms}|${ms},apad,atrim=0:${L}`; };
const g = [], layers = [];
let n = 0;
const layer = (chain) => { const id = `l${n++}`; g.push(`${chain}[${id}]`); layers.push(`[${id}]`); };
const shot = (at, expr, d, gain = 1, pan = 0) => layer(
  `aevalsrc=exprs='${gain}*(${expr})':d=${d}:s=48000,pan=stereo|c0=${(1 - pan) / 2 + 0.25}*c0|c1=${(1 + pan) / 2 + 0.25}*c0,${place(at)}`);

// the sound palette (from the departments film)
const pop = (at, gain = 0.25, pan = 0) => shot(at, 'sin(2*PI*(520*t+2600*t*t))*exp(-26*t)', 0.25, gain, pan);
const plink = (at, f = 1760, gain = 0.12, pan = 0) => shot(at, `sin(2*PI*${f}*t)*exp(-16*t)*min(t/0.003,1)`, 0.45, gain, pan);
const thud = (at, gain = 0.34, pan = 0) => shot(at, 'sin(2*PI*(95*t-70*t*t))*exp(-13*t)*min(t/0.004,1)', 0.4, gain, pan);
const click = (at, gain = 0.2) => shot(at, '(random(0)*2-1)*exp(-160*t)', 0.06, gain);
const blip = (at, f = 1318.5, gain = 0.08, pan = 0) => shot(at, `sin(2*PI*${f}*t)*lt(t,0.07)*min(t/0.005,1)*min((0.07-t)/0.01,1)`, 0.08, gain, pan);
const bell = (at, f, gain) => layer(
  `sine=f=${f}:d=4:r=48000,aformat=channel_layouts=stereo,volume='${gain}*exp(-1.9*t)*min(t/0.004,1)':eval=frame,aecho=0.8:0.6:70|130|210:0.35|0.25|0.15,${place(at)}`);
const chime = (at, gain, notes = [659.26, 880, 1318.5]) => notes.forEach((f, i) => bell(at + i * 0.16, f, gain * [1, 0.8, 0.35][i]));
const whoosh = (at, d, gain, i) => layer(
  `anoisesrc=c=pink:a=0.8:seed=${21 + i}:d=${d}:r=48000,highpass=f=300,lowpass=f=3600,aformat=channel_layouts=stereo,` +
  `volume='${gain}*pow(sin(PI*min(t/${d},1)),3)':eval=frame,apulsator=mode=sine:hz=${(0.5 / d).toFixed(3)}:width=0.7,${place(at)}`);
const hiss = (at, d, gain, i) => layer(          // a pen drawing on paper
  `anoisesrc=c=white:a=0.5:seed=${41 + i}:d=${d}:r=48000,highpass=f=2500,lowpass=f=7000,aformat=channel_layouts=stereo,` +
  `volume='${gain}*sin(PI*t/${d})*(0.6+0.4*sin(2*PI*9*t))':eval=frame,${place(at)}`);
const boom = (at, gain) => layer(`sine=f=55:d=4:r=48000,aformat=channel_layouts=stereo,volume='${gain}*exp(-1.6*t)*min(t/0.03,1)':eval=frame,${place(at)}`);
const pad = (freqs, at, d, keys) => freqs.forEach((f, i) => layer(
  `sine=f=${f}:d=${d}:r=48000,aformat=channel_layouts=stereo,tremolo=f=${4.5 + i * 0.7}:d=0.18,volume='${env(keys)}':eval=frame,aecho=0.8:0.7:90|160:0.3|0.2,${place(at)}`));


const inputs = ['-i', src('dept_music.m4a'), '-i', src('city.ogg'), '-i', src('beach.ogg')];
// music: a loop cut with an equal-power crossfade over the seam; a little lower inside the rooms, up for the close
g.push(`[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[m0][m1]`);
g.push(`[m0]atrim=0:${L},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${XF}:curve=qsin[mA]`);
g.push(`[m1]atrim=${L}:${L + XF},asetpts=PTS-STARTPTS,afade=t=out:st=0:d=${XF}:curve=qsin[mB]`);
layer(`[mA][mB]amix=inputs=2:duration=first:normalize=0,${vol([[0, 0.9], [70, 0.9], [74, 1.05], [84, 0.95]])}`);

// the city: out on the boulevard it is all around, inside the flats only a murmur through the glass
g.push(`[1:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=62:${62 + L},asetpts=PTS-STARTPTS,asplit=2[c0][c1]`);
const inside = (a, b) => [[a - 0.6, 1], [a + 0.4, 0], [b - 0.4, 0], [b + 0.6, 1]];
const outK = [[0, 0], [6, 0], [10, 0.4], ...ROOMS.flatMap((r) => inside(r, r + 14)).map(([t, v]) => [t, v * 0.4]), [74, 0.3], [80, 0.1], [83, 0]];
layer(`[c0]highpass=f=90,${vol(outK)}`);
layer(`[c1]lowpass=f=420,${vol([[0, 0], ...ROOMS.flatMap((r) => [[r - 0.6, 0], [r + 0.4, 0.22], [r + 13.6, 0.22], [r + 14.6, 0]])])}`);
// gulls over the boulevard as the flock crosses the golden sky
g.push(`[2:a]aformat=sample_rates=48000:channel_layouts=stereo[b0]`);
layer(`[b0]atrim=40:${40 + L},asetpts=PTS-STARTPTS,highpass=f=1400,${vol([[0, 0], [5, 0], [8, 0.5], [12.5, 0.45], [14.3, 0]])}`);
// high wind on the aerials, the climb up the tower and the pull-back into the night
layer(`anoisesrc=c=brown:a=0.5:seed=7:d=${L}:r=48000,lowpass=f=650,highpass=f=70,aformat=channel_layouts=stereo,` +
  `volume='0.62+0.24*sin(2*PI*0.11*t)+0.14*sin(2*PI*0.047*t+1.3)':eval=frame,` +
  vol([[0, 0], [3.4, 0], [6, 0.5], [10, 0.3], [13, 0.05], [14.5, 0], [52.5, 0], [54, 0.3], [57, 0.05], [57.5, 0], [71.5, 0], [73, 0.45], [79, 0.3], [83, 0]]));

// the curtains part and close with a whoosh; every flight through a window is a soft rush of air
whoosh(OPEN, 2.2, 0.3, 0); whoosh(CLOSE - 0.3, 1.7, 0.26, 1);
ROOMS.forEach((r, i) => { whoosh(r - 1.4, 1.8, 0.3, 2 + i); whoosh(r + 14 - 0.2, 1.6, 0.26, 5 + i); });
// the logo on the curtains: the boom as the pieces land, the chime as the light sweeps
boom(0.35, 0.5); chime(1.9, 0.07);
[1.6, 1.71, 1.82].forEach((t, i) => blip(t, [880, 1046.5, 1318.5][i], 0.04));

// Maintenance (its own film: T = 4)
SHIFT = ROOMS[0] - 4;
for (const t of [4.3, 5.5, 6.4, 7.9, 9.1, 10.6]) { shot(t, '(random(0)*2-1)*exp(-40*t)*(0.6+0.4*sin(2*PI*90*t))', 0.35, 0.22, -0.1); click(t + 0.03, 0.12); }   // sparks crackle
layer(`sine=f=100:d=7:r=48000,aformat=channel_layouts=stereo,volume='0.025*(0.5+0.5*sin(2*PI*7*t))*lt(t,7.6)':eval=frame,${place(4.0)}`);   // a failing ballast hum
for (let k = 0; k < 6; k++) for (let d = 0; d < 3; d++) { const t = 4.2 + d * 0.43 + k * 1.3 + 0.64; if (t < 12.4) plink(t, [1568, 1760, 2093][d], 0.07, 0.35); }   // drips into the bucket
[8.1, 8.36, 8.62, 8.88].forEach((t, i) => blip(t, [880, 1046.5, 1318.5, 1568][i], 0.07, [-0.5, 0, 0.5, 0.2][i]));   // diagnosis markers
// the failed AC above the TV: a strained compressor drone with a loose-panel rattle until the scan line fixes it
// at 12.36 s, then the unit's own "beep-beep" as it restarts, and its check chime after the leak's
layer(`sine=f=58:d=8.4:r=48000,aformat=channel_layouts=stereo,volume='0.03*(0.6+0.4*sin(2*PI*0.7*t))*lt(t,8.3)':eval=frame,${place(4.0)}`);
for (let t = 4.35; t < 12.3; t += 0.47 + 0.13 * Math.sin(t * 5)) click(t, 0.05);
[12.45, 12.6].forEach((t) => blip(t, 2093, 0.05, 0.25));
chime(13.26, 0.045, [698.46, 1046.5, 1396.9]);
for (let i = 0; i < 5; i++) thud(9.2 + i * 0.15 + 0.4, 0.22, (i - 2) * 0.3);                        // the kit lands
whoosh(10.2, 3.6, 0.16, 12);                                                                         // the scan line sweeps
layer(`sine=f=520:d=3.6:r=48000,aformat=channel_layouts=stereo,volume='0.02*sin(PI*t/3.6)':eval=frame,${place(10.2)}`);
[11.44, 12.02, 12.45].forEach((t, i) => { chime(t + 0.5, 0.05, [[659.26, 880, 1318.5], [783.99, 1046.5, 1568], [880, 1318.5, 1760]][i]); });
shot(11.2, '(random(0)*2-1)*exp(-6*t)*min(t/0.3,1)*0.5', 0.8, 0.12, -0.4);                            // rubble rushes back into the wall
click(12.3, 0.3);                                                                                    // the lamp clicks on
pad([220, 329.63, 440], 12.8, 4, [[0, 0], [1.2, 0.025], [2.6, 0.02], [4, 0]]);


// Media (T = 18)
SHIFT = ROOMS[1] - 18;
[18.5, 19.02, 19.54].forEach((t, i) => { thud(t, 0.28, [-0.6, 0.6, 0.2][i]); layer(`anoisesrc=c=white:a=0.3:seed=${80 + i}:d=0.5:r=48000,highpass=f=3000,aformat=channel_layouts=stereo,volume='0.05*exp(-9*t)':eval=frame,${place(t)}`); });
shot(21.15, '(random(0)*2-1)*exp(-120*t) + sin(2*PI*1800*t)*exp(-60*t)*0.5', 0.12, 0.45);              // CLAP
blip(21.2, 1760, 0.08); blip(21.35, 1760, 0.08);                                                     // rolling
layer(`anoisesrc=c=brown:a=0.3:seed=91:d=8:r=48000,lowpass=f=300,aformat=channel_layouts=stereo,volume='0.05*sin(PI*t/8)':eval=frame,${place(21.4)}`);   // the slider glides
layer(`sine=f=190:d=8:r=48000,aformat=channel_layouts=stereo,volume='0.035*min(t/2,1)*min((8-t)/1.5,1)*(0.8+0.2*sin(2*PI*31*t))':eval=frame,${place(22.8)}`);   // drone motors
layer(`sine=f=380:d=8:r=48000,aformat=channel_layouts=stereo,volume='0.016*min(t/2,1)*min((8-t)/1.5,1)':eval=frame,${place(22.8)}`);
whoosh(23.6, 2.4, 0.12, 13);                                                                          // the drone lifts off
for (let i = 0; i < 12; i++) plink(27.3 + i * 0.3, [1760, 1975.5, 2093, 2349.3][i % 4], 0.045, 0.5);    // likes


// Fit-out (T = 32)
SHIFT = ROOMS[2] - 32;
layer(`anoisesrc=c=pink:a=0.5:seed=61:d=2.8:r=48000,highpass=f=700,lowpass=f=4200,aformat=channel_layouts=stereo,volume='0.07*sin(PI*t/2.8)*(0.7+0.3*sin(2*PI*3*t))':eval=frame,${place(32.6)}`);
for (let i = 0; i < 18; i++) shot(34.6 + i * 0.14, 'sin(2*PI*(380-260*t)*t)*exp(-34*t)+(random(0)*2-1)*exp(-90*t)*0.25', 0.2, 0.1, (i % 5 - 2) * 0.3);   // tiles turn over
whoosh(36.7, 1.1, 0.1, 8);
for (let i = 0; i < 12; i++) thud(37.0 + i * 0.27 + 0.8, 0.2, (i % 5 - 2) * 0.25);                    // pieces settle
for (let i = 0; i < 6; i++) click(40.4 + i * 0.12, 0.12);                                             // downlights
whoosh(40.7, 1.1, 0.08, 10);
pad([220, 329.63, 440], 41.8, 5, [[0, 0], [1.2, 0.03], [3.3, 0.025], [5, 0]]);
for (let i = 0; i < 10; i++) pop(42.2 + i * 0.14, 0.12, (i % 3 - 1) * 0.5);                           // finishing touches

SHIFT = 0;

// the drone show: a pad swells as the lights rise over the city, a chime as the logo locks, the caption
pad([220, 329.63, 440, 523.25], 71.5, 10, [[0, 0], [3, 0.035], [8, 0.03], [10, 0]]);
chime(74.3, 0.08);
chime(CAPTION + 0.2, 0.05, [880, 1046.5, 1318.5]);

// mix, measure, then set the level (about -20 LUFS: calm under a hallway) and limit the peaks
g.push(`${layers.join('')}amix=inputs=${layers.length}:duration=longest:normalize=0,atrim=0:${L}[mix]`);
const tmp = join(root, 'assets', 'audio', '_mix.wav');
// the graph goes in a file: as an argument it is longer than Windows allows for a command line
const graph = join(root, 'assets', 'audio', '_graph.txt');
writeFileSync(graph, g.join(';\n'));
execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-/filter_complex', graph, '-map', '[mix]', '-ar', '48000', '-c:a', 'pcm_f32le', tmp], { stdio: 'inherit' });
const report = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', tmp, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const I = +((/I:\s+(-?[\d.]+) LUFS\s*\n\s*Threshold/.exec(report) || [])[1] ?? -20);
const gain = (-20 - I).toFixed(2);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, '-af', `volume=${gain}dB,alimiter=limit=0.84:level=false`, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', OUT], { stdio: 'inherit' });
rmSync(tmp); rmSync(graph);
console.log(`soundtrack: ${OUT} (${L}s, ${layers.length} layers, measured ${I} LUFS, gain ${gain} dB)`);
