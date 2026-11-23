# Graphics, collision and performance overhaul — progress

Working repository: `smullinsok042900/dawsons-world-test` (this repo). The original
`Dawson-s-Wonderverse` repository is read-only for this work and has not been modified.

## Status summary

| Phase | State |
|---|---|
| 1. Audit of rendering / placement / performance systems | **Done for the shared engine** (renderer, world, nature, water, assets, perf). Per-environment visual audit still outstanding. |
| 2. Shared engine improvements | **First stage done and verified**: collision spatial index, scene auditor, texture filtering, water ripple/reflection upgrade. |
| 3. Per-environment visual overhaul | **Started**: Playhouse + Park detail added (2 of 26 areas). |
| 4. Geometry / collision corrections | **Tooling done and run**; confirmed issues not yet fixed (see audit results). |
| 5. Performance optimisation | **Collision indexing done**; renderer/LOD tuning outstanding. |
| 6. Verification | Unit tests (17) + build + headless load/audit run pass. Full browser suite is not re-run every stage (35 min of software WebGL). |

## Verified metrics (headless Chromium, software WebGL — relative only)

| Measure | Before | After first stage |
|---|---|---|
| Draw calls / triangles at spawn | 196 / 319,110 | 290 / 470,384 (same build content; camera settled later) |
| Shader programs | 115 | 116 |
| Textures with anisotropic filtering | 0 (device supports 16) | 140 textures / 623 materials at 8× |
| Collision candidates evaluated | every solid + platform, every physics step | 97 candidates for 97 queries (~1 per query) |
| Build output | 9,893 KB | 9,899 KB |
| Page errors | 0 | 0 |

Software SwiftShader frame times (~1.2 fps) are **not** representative of phones and are only
useful for before/after comparisons of the same scene. The first stage changed 3 water materials
and 140 texture samplers, so draw calls and triangles are unchanged by design (the spawn stats
differ only because the camera/slices had settled further when measured).

### Water upgrade (implemented, numerically verified, not visually confirmed on a device)

`earthkit.makeSea` now keeps UVs and adds a generated seamless ripple normal map that scrolls
across each sea (own texture clone per sea, own material clone), with roughness 0.07,
metalness 0.28 and envMapIntensity 1.35 so the sky reflection and sun highlight read on the
surface. This affects all four water bodies (two seas, the stream, the pier sea). No screenshot
was captured: headless software WebGL cannot screenshot this scene within a usable timeout, so
the visual result is unverified until it is looked at on a real device.

## What the auditor found, and the triage (build 122)

- **z-fighting: 0** confirmed opaque coplanar surfaces.
- **collision entries: clean** — 12 solids, 108 platforms, 0 malformed, 0 duplicates,
  0 heavy overlaps.
- **duplicates: 0 after triage.** The 6 reported meshes were **fur shells**: `fur.js` adds 5–8
  `SkinnedMesh` shells per furry creature, all sharing the creature's geometry and transform,
  each with its own fur material. A live probe confirmed the group's parent chain ended in a
  skinned creature, not scenery. The auditor now ignores skinned meshes, sprites, points/lines
  and the off-world shader-rehearsal group (y ≈ −60). No meshes needed moving or deleting.
- **floor-cutting candidates: triaged, none moved.** A live probe listed every candidate with
  position, size and parent: 11 wide sphere masses at x 430–897 (rolling hills, deliberately
  sunk), the headland at x −158, the sky domes (800 m / 1040 m spheres), the slide tube and its
  torus ring, the ball-pit shell and the underground shaft wall. All are intentional terrain or
  structures. The auditor now skips wide terrain masses and any mesh marked
  `userData.grounded`; the new boulders use that flag. Remaining candidates are the same known
  intentional hills.

## Stage 2: Playhouse and Park detail (implemented, measured)

New `src/scenery-detail.js`, called from `world.js`; additive only, no collision entries, no
changes to gameplay. `?nodetail` disables it for measurement.

- **Playhouse:** a 3.3 m woven play rug, 72 bunting flags across the ceiling, three hanging
  paper lanterns with cords.
- **Park:** 190 wildflowers in two drifts (instanced stems + instanced flower heads with
  per-instance colours), 3 sculpted boulder clusters (9 rocks merged into one mesh), and six
  lamp posts with glowing globes (merged posts + instanced globes).

Measured by toggling only the new groups' visibility in one loaded scene (the only reliable
method here — different page loads vary by ±300k triangles because grass/slice streaming
settles differently):

| Area | Added meshes | Added triangles (geometry) | In-scene Δ draw calls | In-scene Δ triangles |
|---|---|---|---|---|
| Playhouse | 8 | 1,376 | **+3** | **+488** |
| Park | 5 | 48,692 | **+6** | **+51,368** |

Park triangles rise ~7% for ~190 flowers, 9 boulders and 6 lamps; draw calls rise by 6 because
merged/instanced geometry keeps the additions to a handful of batches. Playhouse is +3 calls.

## Environment inventory (for the visual pass)

Earth: Playhouse, Imagination Studio, Wonder Lab, Adventure Park, creature area, Dino Valley,
Princess Castle, Adventure Trail, Toy Town, Lab Gardens, Art Plaza, Ocean Pier, Happy Farm,
Frosty Peaks, Whispering Woods, Sunny Seaside, Balloon Hills.
Other worlds: Sky Kingdom, Underground caves, Fluffkin House interior, Moon, Mercury, Venus,
Mars, Jupiter, Saturn, Uranus, Neptune, Pluto.

Upgraded so far: **Playhouse** and **Park** (Stage 2 detail above). All other areas still need
 their individual geometry/material pass.

## How to verify a change

```bash
cd discovery-world/3d
node tests/spatial.test.mjs        # 8 tests, <1 s
node tests/scene-audit.test.mjs    # 9 tests, <1 s
npm run build                      # writes index.html
```

In a browser: `window.__DDW3.audit()` returns the geometry/placement report; `?perf` shows the
in-game performance monitor.

## Immediate continuation plan (next session)

1. Audit is clean; keep running `window.__DDW3.audit()` after each area and fix real findings.
2. Continue Phase 3 in this order: Playhouse (detail done, materials/terrain next) → Park (detail
   done) → Castle → Dino Valley →
   Toy Town → seaside/ocean → each planet (Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus,
   Neptune, Pluto).
4. For each area: add geometry detail (terrain relief, rocks, vegetation), PBR material work, and
   record before/after draw calls and triangles in this file.
5. Profile on a real iPhone/Android before claiming frame-rate targets; software WebGL cannot
   establish 30/60 FPS.
