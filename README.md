# Tamlik Journey

The two Tamlik films as one continuous 3D shot: the tower film's flight over Muscat (`tamlik-experience`) with the
three department rooms (`tamlik-departments`) inside it. An 84-second loop for the hallway screens, with no cuts.

| Time | What plays |
|---|---|
| 0–3.6 s | The curtains, closed on the 3D Tamlik logo; the three department names appear under it |
| 3.6–14.5 s | The curtains part on Muscat at golden hour. The camera drops onto the boulevard, turns to a building **on the right**, a green line draws round one of its windows (*TAMLIK MAINTENANCE*) and the camera flies in through the glass |
| 14.5–28.5 s | **Maintenance**, inside that flat: the broken apartment, the diagnosis, the scan line that fixes it all |
| 28.5–35 s | The camera backs out of the window, flies up the boulevard (now at dusk) and in through a window **on the left** (*TAMLIK MEDIA*) |
| 35–49 s | **Media**: the real-estate film shoot |
| 49–57.5 s | Back out, up to the Tamlik tower, in through a flat's window on the 18th floor (*TAMLIK FIT-OUT*) |
| 57.5–71.5 s | **Fit-out**: the flat being finished |
| 71.5–84 s | The camera pulls back out of the tower into the night. The drone show draws the logo over the city, the three departments and the contact caption appear, and the curtains close. Loop |

## How the fly-through works

Each room is still its own Three.js scene with its own renderer (`src/scenes/maintenance.js`, `media.js`, `fitout.js`,
as in the departments film). The city (`src/scenes/city.js`) is the tower film's world, unchanged and built from the
same seed, drawn on its own canvas.

Every room has a window (`door` in its scene file), and the city has a matching opening on a facade
(`heroWindow` / `towerWindow` in `city.js`). `src/journey.js` links the two with a rigid map, so any camera in the city
has an exact twin in the room. While the camera approaches, the room is rendered from that twin camera and shown only
inside the window's outline on screen (a CSS clip-path, `main.js` → `drawFrame`). Its perspective matches, so the room
really looks like it's behind the glass. When the camera crosses the glass, the room fills the screen. The flight is
aimed so that it arrives exactly on the room's first shot, where the room's own camera takes over. Leaving works the
same way in reverse.

## Tools

```sh
node tools/sheet.mjs portrait out 5 14 30          # frames at chosen seconds (DIRECT=1 DSF=0.5: quick, half size)
node tools/mix-audio.mjs                           # rebuild assets/audio/loop.m4a (84 s, cues on the film's timeline)
node tools/record.mjs --o portrait  --fps 60 --blur 2 --scale 2 --crf 12    # renders/journey_portrait.mp4
node tools/record.mjs --o landscape --fps 60 --blur 2 --scale 2 --crf 12    # renders/journey_landscape.mp4
```

On Windows set `CHROME` to the Chrome or Edge path first. Needs Node 22+, ffmpeg and a GPU.

URL options on the live page: `?o=portrait|landscape`, `?t=40` (freeze at 40 s), `?mute`, `?record`, `?hq`.

## Things that break easily

- **Timing and sound are coupled.** `T` in `src/main.js` and `OPEN / ROOMS / CAPTION / CLOSE` in `tools/mix-audio.mjs`
  must agree; rebuild the soundtrack after changing either.
- **A room's first and last shots decide the flight.** Change `SHOT` in a scene file and its window is recomputed
  (`roomWindow` in `journey.js`), which moves the city approach too. Check the crossing frames with `sheet.mjs`
  (about 0.5 s either side of each room's start and end).
- **Everything animated must be reset at time 0** (`tl.set(..., 0)`), or the second loop starts in the finished state.
- The tower film and the departments film are separate projects and stay unchanged. This one copies what it needs.

## Credits

Anime.js 4.5.0 (MIT), Three.js 0.160 (MIT), Tabler Icons (MIT). Poly Haven models, textures and HDRs (CC0).
Music: "Once More With You" by Loyalty Freak Music (CC0). City and gull recordings from Radio Aporee (Public Domain
Mark). All sound effects are synthesised in `tools/mix-audio.mjs`.
