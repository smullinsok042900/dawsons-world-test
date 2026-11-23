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
| 6 | World-wide lighting/atmosphere, dino skin & vegetation, playhouse furniture, rail-clearing fixes | this commit | 21 tests, build, screenshots, 0 page errors |

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

## Overlapping objects, duplicates and collision problems

- **The 6 "duplicate meshes" near the slide tower were fur shells**, not duplicated scenery: `fur.js` adds 5–8 `SkinnedMesh` shells per furry creature sharing one geometry and transform. Nothing was moved. The auditor now skips skinned meshes, sprites, points/lines and the off-world rehearsal group.
- **15 "floor-cutting spheres" were intentional terrain/structures**: 11 wide hill masses (x 430–897), the headland at x −158, the sky domes, the slide tube and torus, the ball-pit shell and the shaft wall. Nothing was moved; the auditor now skips wide terrain masses and `userData.grounded` props.
- **Z-fighting at the castle dance floor** was a bounding-box false positive: slice merging combines neighbouring dance tiles into one wide mesh whose box overlaps its neighbours although the surfaces never touch. The auditor now compares only true planes (height < 0.02 m); a regression test covers it.
- **Carpet vs gold trim in the throne room** were 2 mm apart and could flicker; the trim was raised to y 0.022.
- **Collision:** 12 solids and 108 platforms audit with 0 malformed, 0 duplicate and 0 heavy-overlap entries. Movement now queries an interval index instead of scanning every solid/platform each frame.

## Speed and performance

- **Collision queries:** `src/spatial.js` interval index replaces linear scans in `updatePlayer`/`groundUnder`; 8 unit tests cover filtering, ordering and overlap fraction.
- **Draw calls:** every new decoration batch is merged or instanced — one draw call per batch. All six detailed areas together add **29 draw calls and 76,440 triangles**.
- **Texture cost:** anisotropy set once per texture on load, no per-frame work.
- **Scene audit:** runs only on demand (`window.__DDW3.audit()` or `?audit`), never in the frame loop.
- **Not measured on real hardware.** The headless environment renders at ~1.2 fps in software; frame-time comparisons there are not representative of a phone or desktop GPU, so no speed-up claim is made from them.

## Test results (latest run)

- `node tests/spatial.test.mjs` — 8/8 pass.
- `node tests/scene-audit.test.mjs` — 13/13 pass.
- `npm run build` — succeeds, `index.html` ~9.9 MB.
- Headless load — 0 page errors.
- Audit — duplicates 0, z-fighting 0, collision entries clean; remaining floor-cut candidates are the known intentional hills.

## Remaining issues and unverified work

- **Visual appearance of all new detail is unverified**: headless software WebGL cannot screenshot this scene within a workable timeout. Colours, placement and overlap with existing props still need a real-device look.
- **Real-device performance** (phones, low-end tablets) is unknown; only geometry/draw-call cost is measured.
- The audit only sees built scene slices, so numbers depend on where the player is standing.
- 20 of 26 areas have not had their detail pass yet.

## In progress / next

Continue area-by-area detail and material work in this order: **Lab Gardens → Art Plaza → Sunny Seaside → Whispering Woods → Frosty Peaks → Happy Farm → Ocean Pier → Balloon Hills**, then the planets (Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Pluto), then character/pet material polish. Each stage: implement, build, run tests, measure with the single-frame A/B, update this file, commit and push.
