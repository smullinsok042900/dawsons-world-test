# PROGRESS — Dawson's World 3D graphics & performance overhaul

Repository: `smullinsok042900/dawsons-world-test` · branch `main` · game root `discovery-world/3d`.
Every completed stage is committed and pushed to `main` automatically.

## Completed stages

| # | Stage | Commit | Verified |
|---|---|---|---|
| 1 | Collision interval index, scene auditor, texture anisotropy, sea ripples/reflections | `a54ac79` | 8 spatial + 10 audit tests, build, headless load |
| 2 | Playhouse & Park detail; audit false positives resolved (fur shells, terrain masses) | `77cb5d2` | 12 audit + 8 spatial tests, build, audit clean, in-scene A/B |
| 3 | Castle front & Dino Valley detail; `mergeGeometries` helper; auditor ignores merged slabs | `dfc92f6` | 21 tests, build, single-frame A/B, audit clean |
| 4 | Castle throne room detail; carpet trim raised above z-fight range | `0246790` | 21 tests, build, single-frame A/B, room audit clean |
| 5 | Toy Town detail (toy-box spill, giant balls, spinning tops) | `039752b` | 21 tests, build, single-frame A/B |
| 6 | World-wide lighting/atmosphere, dino skin & vegetation, playhouse furniture, rail-clearing fixes | `35f321c` | 21 tests, build, screenshots, 0 page errors |
| 7 | Sculpted hill/mountain geometry, fractured layered rocks, top-bar overflow fix, rail-corridor sweep | `9fc41c7` | 21 tests, build, 2 paired screenshots, toolbar measured |
| 8 | Real geometry on the foreground models: Dottie, broad-leaf plants, Ferris wheel, carousel ponies, castle facade | this commit | 21 tests, build, 8 paired screenshots (castle, Toy Town, Dino Valley, Park), audit clean, per-model geometry measured |

## Graphics improvements

- **Water:** sea material gained a ripple normal map and reflections; texture quality pass sets anisotropy on ground/detail textures.
- **Playhouse:** woven play rug, 72 bunting flags across the ceiling, three hanging paper lanterns.
- **Park:** 190 wildflowers in two drifts (instanced stems and colour-varied heads), 3 boulder clusters (9 rocks, one mesh), six lamp posts with glowing globes.
- **Castle front:** two formal parterre beds (gravel tray, trimmed hedge border), 24 rose bushes and 72 blooms, four stone urns with flowers, 11 warm lanterns along the front.
- **Dino Valley:** 95 ferns, three mossy boulder clusters (one mesh), a mossy fallen log with mushrooms, eight three-toed footprints.
- **Castle throne room:** velvet ropes (10 posts, 32 sagging segments), four potted palms, four velvet banners with gold rails, six wrapped party gifts, twelve candle flames on the throne steps.
- **Toy Town:** overturned toy box spilling 8 alphabet blocks, 7 giant toy balls along the near path, 4 spinning tops.

All additions are additive decoration: no collision entries, no changes to rides, taps, saves or child-friendly controls. `?nodetail` disables them for measurement.

### Stage 6 — world-wide look (no prop-by-prop additions)

- **Filmic tone mapping (ACES)** with exposure 1.02, warmer key light, stronger hemisphere fill and a
  softer shadow radius — every environment gains contrast and shape.
- **Atmosphere**: fog moved back to 72–250 m in lavender, giving distance depth without hazing play.
- **Dottie** now has a procedural pebbled normal map, so her skin reads as scaly rather than smooth.
- **Dino Valley vegetation** replaced with broad-leaf jungle plants (instanced, 95).
- **Playhouse** gained soft play mats and a toy shelf with 14 books.
- **Rail clearance**: the playhouse rug, park lamps, castle beds/urns and Toy Town balls/tops no longer
  intersect the train corridor at z 3.2. See the table in `discovery-world/3d/docs/GRAPHICS_OVERHAUL_PROGRESS.md`.
- **Before/after screenshots**: `discovery-world/3d/docs/screenshots/stage6/` (six paired scenes).

### Stage 7 — real geometry in the landscape (not another decoration pass)

- **Hills rebuilt as landforms.** The Adventure Park backdrop used to be 29 smooth spheres squashed flat
  (`scale.y = .6`) with one flat colour each. Each is now a displaced sphere: three octaves of ridge noise on
  the radius, a flattened base, baked vertex colours (grass gradient, dry stony crowns, rock scars, shaded
  feet) and a generated 128 px normal map. All 29 are merged into **one mesh**: 2 draw calls for the whole
  backdrop where there were 29 meshes.
- **A distant mountain range behind them** — 8 ridged, snow-capped peaks at z ≈ −136…−160, cool blue with
  pale caps and aerial haze; one merged mesh, one draw call. The horizon now has layers (hills → peaks → sky)
  instead of a row of blobs.
- **Rocks are fractured stone now.** `makeRock` gained a broken-ledge displacement (plane-like fractures plus
  scree grain), strata colour bands, moss on upward faces and darker wet feet, all as baked vertex colours on
  the existing icosahedron — no extra material, texture or draw call. This upgrades every rock on every planet.
- **Top bar no longer runs off the screen.** The old `@media (min-width:900px){#upperRight{max-width:none;flex-wrap:nowrap}}`
  let the right-hand cluster overflow past the viewport edge (the settings gear was clipped in the Dino Valley
  shot). The cluster is now width-capped at every size, and pills/creature tiles shrink in two steps (≤1500 px,
  ≤1150 px). Measured bounding boxes: right edge sits 10 px inside the viewport at 1440×900, 1280×720,
  1152×648, 1024×576, 820×480 and 700×400 (overflow −10 px everywhere).
- **Train-corridor sweep.** A browser-side audit walked every mesh in the built world, took world-space
  bounding boxes and flagged anything crossing z 2.6–3.8 below y 2.6: 70 boxes. Every one resolves to a known
  legitimate fixture or a bounding-box artefact — buffer stops at both ends (x −798 / 904), station canopy at
  the park stop (x 334), platform/bench clusters at the home stop, the low grass band at z 3.75–4.55
  (22 cm tall, outside the rails), and the merged `dino-detail` batch whose single box spans both sides while
  its individual plants do not. **No prop stands on the rails.** The audit is bounding-box based, so thin
  diagonal geometry can still produce false positives; it does not replace a run of the train.
- **Before/after**: `discovery-world/3d/docs/screenshots/stage7/` — `before-park.jpg` / `after-park.png` and
  `before-dino.jpg` / `after-dino.png`, identical teleports (x 150, x 368), 1280×720, same lighting. The
  "before" files are the committed stage-6 build; "after" is this build.

### Stage 8 — the foreground models are real models now

The backdrop got its landforms in stage 7; this stage rebuilds the things the camera actually looks at.

- **Dottie the long-neck is a lofted creature, not a stack of spheres.** Her body is a single mesh through ten
  real cross-sections (heavy hips, narrow waist, deep chest, shoulders), resampled three times per section for a
  smooth silhouette. The top is kept flat at y 3.45 so the existing walking platform and the neck slide still line
  up exactly; the cream belly blends into the teal flanks and the darker back as vertex colour, so the separate
  belly sphere and the five stuck-on flavour spots are gone. Her legs are lathe-turned columns with a knee bulge,
  a padded foot and **three clawed toes each** (one merged mesh, one draw call, replacing four cylinders and four
  balls). Twelve dorsal scutes run along the spine and three flank bumps sit where the old spots were. The head
  gained brow ridges over the eyes, nostrils, a rounded jaw under the muzzle and a crest scute — all merged.
- **Broad leaves have thickness, a midrib and an arch.** New `broadLeafGeometry()` in `scenery-detail.js` lofts
  each blade through a grid of vertices: tapered base, fullest a third along, pointed tip, cupped edges, a raised
  centre rib and a tip that droops below the stalk, with a base-to-tip colour gradient and UVs so the existing
  leaf-vein normal map works. The 85 jungle plants in Dino Valley use it (still one instanced mesh, one draw
  call), and the five palm ferns were rebuilt as a ringed tapered trunk plus nine arching fronds each — one mesh
  per palm instead of six flat capsules.
- **The Ferris wheel is a structure, not a disc.** It now has an A-frame with two cross beams, diagonal bracing
  and cast foot plates; **two parallel rims tied together every 36°** so the wheel is a cage with depth; 20 tapered
  spokes per face; a bolted hub with two flanges and six axle bolts; and ten gondolas with a bevelled cab, deep
  tinted windows, a padded bench, a gold foot bar, a scalloped roof with a brass rim and a real hanger arm.
  The whole ride is 3 merged structure meshes + 10 gondola meshes (13 draws) where the flat version needed 37
  separate meshes. It is split so the wheel group still rotates and every gondola still hangs upright and carries
  its seat — the ride logic is untouched.
- **Carousel ponies are saddled.** Each pony gained a draped blanket, a padded saddle with a raised cantle and
  pommel, stirrups hanging on leathers and brass collars on its pole — one merged mesh per pony, so +6 draws in
  total, and the seat height (1.36) the ride uses is unchanged.
- **The castle facade has depth.** A moulded plinth and base course, four engaged pilasters with bases, caps and
  a carved band, a ring of nine stone voussoirs with a keystone over the door, projecting architraves on all four
  windows (jambs, sills, hoods, cross mullions), a slim string course under the battlements, and the balcony's
  plain sticks replaced by eleven turned balusters. Everything is static, so the existing material-batch merge
  folds it in; the new stonework adds exactly **one material / one draw call** (about 53 small bevelled pieces).
  The battlements, banners, rose window, flower boxes and climbing roses are untouched and still visible.

### Measured cost (single-frame A/B, same camera, group visibility only)

| Area | Batches | Geometry triangles | Δ draw calls | Δ triangles |
|---|---|---|---|---|
| Playhouse | 8 | 1,376 | +3 | +488 |
| Park | 5 | 48,692 | +5 | +48,692 |
| Castle front | 7 | 13,660 | +7 | +13,660 |
| Dino Valley | 5 | 3,960 | +5 | +3,960 |
| Castle throne room | 6 | 7,312 | +6 | +7,312 |
| Toy Town | 3 | 5,012 | +3 | +5,012 |

Method: two explicit `renderer.render()` calls with `renderer.info.reset()` between them, group visible then hidden. Reading `renderer.info` while the frame loop runs is unreliable at ~1.2 fps under software WebGL — slice merging and grass streaming change totals between reads, and produced inverted results in earlier runs.

### Stage 8 measured cost (whole object groups, same probe on both builds)

| Model | Before | After | Change |
|---|---|---|---|
| Ferris wheel (`G.wheel.group`, incl. 10 gondolas) | 37 meshes / 14,080 tris | 14 meshes / 24,708 tris | **−23 meshes**, +10,628 tris |
| Carousel (`G.carousel.group`, incl. 6 pony kits) | 97 meshes / 113,972 tris | 103 meshes / 122,612 tris | +6 meshes, +8,640 tris |
| Dino Valley ferns (85 instanced plants) | 124 tris each / 10,540 total | 512 tris each / 43,520 total | +32,980 tris, **same 1 draw call** |
| Castle facade stonework | — | ~53 pieces in 1 new material batch | **+1 draw call** |

Probe: traverse the named group on the running game and sum `index.count/3` (× instance count for
`InstancedMesh`), run against both the committed stage-7 build and this build in the same headless session.
Scene-level totals (e.g. 198 calls / 393 k tris at the castle) are **not** used as an A/B: slice streaming and
LOD depend on the live player state, so they move between runs by more than the models changed.

## Overlapping objects, duplicates and collision problems

- **The 6 "duplicate meshes" near the slide tower were fur shells**, not duplicated scenery: `fur.js` adds 5–8 `SkinnedMesh` shells per furry creature sharing one geometry and transform. Nothing was moved. The auditor now skips skinned meshes, sprites, points/lines and the off-world rehearsal group.
- **15 "floor-cutting spheres" were intentional terrain/structures**: 11 wide hill masses (x 430–897), the headland at x −158, the sky domes, the slide tube and torus, the ball-pit shell and the shaft wall. Nothing was moved; the auditor now skips wide terrain masses and `userData.grounded` props.
- **Z-fighting at the castle dance floor** was a bounding-box false positive: slice merging combines neighbouring dance tiles into one wide mesh whose box overlaps its neighbours although the surfaces never touch. The auditor now compares only true planes (height < 0.02 m); a regression test covers it.
- **Carpet vs gold trim in the throne room** were 2 mm apart and could flicker; the trim was raised to y 0.022.
- **Collision:** 12 solids and 108 platforms audit with 0 malformed, 0 duplicate and 0 heavy-overlap entries. Movement now queries an interval index instead of scanning every solid/platform each frame.

## Speed and performance

- **Collision queries:** `src/spatial.js` interval index replaces linear scans in `updatePlayer`/`groundUnder`; 8 unit tests cover filtering, ordering and overlap fraction.
- **Draw calls:** every new decoration batch is merged or instanced — one draw call per batch. All six detailed areas together add **29 draw calls and 76,440 triangles**.
- **Stage 7 landscape:** 29 hills + 8 mountains = **2 meshes / 2 draw calls / 51,140 triangles**, replacing 29 separate hill meshes (27 fewer draw calls for the backdrop). Single-frame read at the park: 199 draw calls, 382,430 triangles total. Rocks gained their new detail inside existing geometry (0 extra calls, 0 extra textures).
- **Texture cost:** anisotropy set once per texture on load, no per-frame work.
- **Scene audit:** runs only on demand (`window.__DDW3.audit()` or `?audit`), never in the frame loop.
- **Not measured on real hardware.** The headless environment renders at ~1.2 fps in software; frame-time comparisons there are not representative of a phone or desktop GPU, so no speed-up claim is made from them.

## Test results (latest run)

- `node tests/spatial.test.mjs` — 8/8 pass.
- `node tests/scene-audit.test.mjs` — 13/13 pass.
- `npm run build` — succeeds, `index.html` 9,930 KB.
- Headless load (Chromium headless shell + SwiftShader), stage 8 build — **0 page errors, no "Oops" fallback** at x 404 (Castle), 600 (Toy Town), 368 (Dino Valley) and 150 (Park).
- Stage 8 screenshots: 1280×720, dpr 1, 8 paired images (before/after × Castle, Toy Town, Dino Valley, Park), identical teleports and identical camera settle (waits until the camera stops moving, so the castle zoom cannot bias the pair).
- Audit (`window.__DDW3.audit()`), stage 8 build: **duplicates 0, z-fighting 0**; solids 12 total with 0 malformed / 0 duplicate / 0 heavy overlaps; platforms 108–112 total, 0 malformed. `buried` reports 4–7 bounding-box candidates per area (spheres and merged buffer geometry — the same class of intentional hills, boulders and urns reported in stage 7); the report exposes only geometry type names, so individual attribution is not possible from the JSON.

## Remaining issues and unverified work

- **Real-device performance** (phones, low-end tablets) is still unknown; only geometry/draw-call cost is measured. No FPS claim is made.
- The audit only sees built scene slices, so counts depend on where the player is standing; sample labels are generic geometry names.
- Stage 8 screenshots were captured with a headless Chromium that has **no emoji font**, so HUD icons are blank tiles in the evidence PNGs. Layout, camera framing and 3D content are unaffected; install `fonts-noto-color-emoji` before the next capture if a pretty HUD is needed.
- The headless renderer runs in software (SwiftShader) at roughly 1 fps; it is used for framing and geometry evidence, never for frame-rate claims.
- Narrow Dino Valley camera at x 368 cuts Dottie's head/neck off at the right edge (same framing as the stage-7 baseline, kept deliberately for comparison). A second camera at x 384 would show the whole animal.
- The `?nodetail` A/B switch covers the stage 2–7 detail groups, not the stage 8 model rebuilds (those are in-place replacements, measured by group probe instead).
- Remaining rail-corridor checks are bounding-box based, not a visual pass with the train running.
- 19 of 26 areas still have no geometry pass; no planet has had one yet.

## Resuming after an interruption (exact steps)

Build and verify (takes ~1 min + ~1 min):

```bash
cd discovery-world/3d
npm ci                       # lockfile is committed; never upgrade deps to restore them
npm run build                # writes index.html (~9.9 MB, committed)
node tests/scene-audit.test.mjs && node tests/spatial.test.mjs
```

Headless capture (no installed browser on a fresh VM):

```bash
# one-off, outside the repo
mkdir -p $HOME/capture && cd $HOME/capture && npm init -y && npm i playwright@1.49.1
npx playwright install chromium-headless-shell   # if the unzip stalls, unzip /tmp/playwright-download-*.zip manually
# then, from the repo root
export LD_LIBRARY_PATH="$HOME/.browser-libs/usr/lib/x86_64-linux-gnu:$HOME/.browser-libs/usr/lib"
export NODE_PATH="$HOME/capture/node_modules"
node .import-tmp/stage8.cjs '[["after-castle",404],["after-toytown",600]]'
```

The harness (`.import-tmp/stage8.cjs`, untracked) waits for the Blender landmark GLBs, waits until the camera
stops moving, then screenshots 1280×720 and prints a model-group probe. For a "before" image, export the previous
commit and build it elsewhere, then point `HTML=` at it:

```bash
mkdir -p /tmp/before && git archive HEAD discovery-world/3d | tar -x -C /tmp/before
cd /tmp/before/discovery-world/3d && ln -s <repo>/discovery-world/3d/node_modules node_modules && npm run build
HTML=/tmp/before/discovery-world/3d/index.html node .import-tmp/stage8.cjs '[["before-castle",404]]'
```

## In progress / next (stage 9 onward)

1. **Lab Gardens** (next): real planter beds with kerbs and soil depth, a proper greenhouse/lab equipment set
   (beakers as lathed glass with rims, racks, pipes with elbows), and edge/fence geometry — geometry first, not
   extra flora. Verify with the same headless pair and the audit.
2. **Art Plaza**, then **Sunny Seaside** (shoreline terrain, rocks, pier planks), **Whispering Woods**,
   **Frosty Peaks**, **Happy Farm**, **Ocean Pier**, **Balloon Hills**.
3. **Planets** in order Moon → Mercury → Venus → Mars → Jupiter → Saturn → Uranus → Pluto: crater rims and ejecta
   rays, layered regolith colours, ring geometry, cloud bands; reuse the loft/vertex-colour helpers from stage 7/8.
4. **Characters and pets:** material/shape pass only (no rig changes) — fur shell tuning, eye catches, bevels.
5. Re-capture with an emoji font installed so the HUD in the evidence PNGs is complete.
6. Then run a real-device pass (iPhone Safari / Android Chrome) before any frame-rate claim.

Each stage: implement, build, run both test files, capture a paired screenshot set with the harness above,
run the audit, update this file, commit and `cloud_git push` to `main` of `dawsons-world-test` only.
