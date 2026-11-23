# Graphics, collision and performance overhaul — progress

Working repository: `smullinsok042900/dawsons-world-test` (this repo). The original
`Dawson-s-Wonderverse` repository is read-only for this work and has not been modified.

## Status summary

| Phase | State |
|---|---|
| 1. Audit of rendering / placement / performance systems | **Done for the shared engine** (renderer, world, nature, water, assets, perf). Per-environment visual audit still outstanding. |
| 2. Shared engine improvements | **First stage done and verified**: collision spatial index, scene auditor, texture filtering, water ripple/reflection upgrade. |
| 3. Per-environment visual overhaul | **Not started** (see inventory below). |
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

## What the auditor found in the real scene (final run, build 122)

- **z-fighting: 0** confirmed opaque coplanar surfaces.
- **collision entries: clean** — 12 solids, 108 platforms, 0 malformed, 0 duplicates,
  0 heavy overlaps.
- **6 duplicate-transform candidates** at one spot near the slide tower (x≈22.4, y≈4.28):
  6 meshes share one geometry and one transform. Not yet identified or fixed; needs one
  focused inspection (start at `world.js` slide-tower block).
- **15 floor-cutting candidates**, all large spheres starting at y≈−13 (e.g. x 443, 494, 525).
  They look like intentional large environment volumes, not props sinking into the floor;
  not moved.
- Earlier false positives (layer-1 shadow proxies, transparent contact-shadow decals, tree
  roots 0.2 m into the soil, instanced sets sharing geometry) are now excluded by the auditor.

## Environment inventory (for the visual pass)

Earth: Playhouse, Imagination Studio, Wonder Lab, Adventure Park, creature area, Dino Valley,
Princess Castle, Adventure Trail, Toy Town, Lab Gardens, Art Plaza, Ocean Pier, Happy Farm,
Frosty Peaks, Whispering Woods, Sunny Seaside, Balloon Hills.
Other worlds: Sky Kingdom, Underground caves, Fluffkin House interior, Moon, Mercury, Venus,
Mars, Jupiter, Saturn, Uranus, Neptune, Pluto.

None of these have had their individual geometry/materials upgraded yet.

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

1. Run `window.__DDW3.audit()` and fix any confirmed floor-cutting props / coplanar opaque surfaces.
2. Add per-area measurement (draw calls, triangles) and reduce the worst areas with LOD/merge.
3. Begin Phase 3 in this order (highest traffic first): Playhouse → Park → Castle → Dino Valley →
   Toy Town → seaside/ocean → each planet (Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus,
   Neptune, Pluto).
4. For each area: add geometry detail (terrain relief, rocks, vegetation), PBR material work, and
   record before/after draw calls and triangles in this file.
5. Profile on a real iPhone/Android before claiming frame-rate targets; software WebGL cannot
   establish 30/60 FPS.
