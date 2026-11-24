# Interim release — Dawson's World 3D overhaul, stages 1–30

**Status: release candidate, awaiting owner review. Not merged.**
Prepared 2026-11-24 from `smullinsok042900/dawsons-world-test` @ `main`, published through draft PR
[#104](https://github.com/smullinsok042900/Dawson-s-Wonderverse/pull/104).

This is an **interim** release: the overhaul is not finished. It ships everything that is built and verified through
Stage 30 so the improvements can be played on a phone now. `RELEASE_CHECKLIST.md` stays the checklist for finishing the
overhaul; this file is the checklist for this interim drop only, and nothing below is marked done unless it was run.

## What is in this release

| # | Area | What changed |
|---|------|--------------|
| 1 | Collision and audit | Indexed collision lookups, scene auditor (`src/scene-audit.js`). |
| 2 | Foreground detail | Merged/batched detail system (`src/scenery-detail.js`). |
| 3–20 | Earth world | Landscape geometry, castle, train and park, lighting, Dottie and the Ferris wheel, carousel, Lab Gardens, Art Plaza, Sunny Seaside, Whispering Woods, Frosty Peaks, Happy Farm, Ocean Pier, Balloon Hills, Adventure Trail, Playhouse, Studio, Wonder Lab. |
| 21–24 | Moons and inner planets | The Moon (craters, ejecta rays, regolith strata), Mercury (224x88 grid, basins, one-time crater overlook), Venus (pancake domes, tessera, lava channels, layered cloud deck), Mars (canyons, stepped buttes, rock fields, dust haze). |
| 25–29 | Outer planets | Jupiter (band-following deck, layered Great Red Spot, four painted moons), Saturn (four separate ring annuli, hexagonal storm), Uranus (eight ring annuli, ice-blue deck), Neptune (banded deck, stepped Great Dark Spot vortex, calm clearing), Pluto (208x82 layered terrain, bezier heart-shaped ice-plain basin, three ice peaks). |
| 30 | Characters and pets | Their own soft toy-paint material (`lifeMat`, roughness 0.58, metalness 0). |

Fixes made **during** this release validation (both were found by the release checks, not shipped earlier):

- **Stage 28 regression repaired**: the Neptune storm clearing read `spot[0]`/`spot[1]` inside the gas-giant height
  function shared by all four giants, where `spot` is null for Jupiter, Saturn and Uranus, so those three planets threw
  while building. Now gated on Neptune; all three build and capture again.
- **Stage 30 vertex-colour shading reverted**: the baked top-lit gradient changed the family drawings' exact paint
  colours, which `tests/chalk-friends.test.mjs` asserts. The material change stays; paint-preserving shading moves to
  Stage 31.

## Interim release gate

Run from `discovery-world/3d` unless noted. Results are from this workspace (Linux, software WebGL).

- [x] **Clean install**: `npm ci` from `package-lock.json`, no lockfile change.
- [x] **Production build**: `npm run build` → single `index.html`, **10,228,306 bytes** (9,989 KB).
- [x] **Build matches source**: rebuilt from the committed sources; the branch copy is byte-identical (blob recorded in
      the PR body).
- [x] **Native suite**: all 20 `tests/*.test.mjs` suites pass, including `scene-audit.test.mjs` (13/13),
      `spatial.test.mjs` (8/8), `space-lifecycle.test.mjs` (7/7), `spacekit.test.mjs`, `chalk-friends.test.mjs` (9/9),
      `toy-models.test.mjs` (338 toys, one draw each), `world-regressions.cjs`.
- [x] **Asset validation**: all 8 shipped GLB files carry a valid `glTF` header and load through the production build;
      textures are embedded in the build. No asset was re-encoded (KTX2 still not wired in).
- [x] **Scene audits**: Pluto x12/x60/x205, Jupiter/Saturn/Uranus x24 — z-fighting 0, no malformed, duplicate or
      heavy-overlap solids, 0 page errors.
- [x] **Planet construction after the fix**: Jupiter 57 calls / 96,250 tris, Saturn 64 / 82,398, Uranus 71 / 81,730,
      all with 0 page errors and clean audits.
- [x] **Characters and movement**: 11 character/pet taps on Pluto resolve and a `pal_heartling` tap runs clean with the
      new material; hop/float/roll/breathe untouched (no rig change); a real touch on ▶ walks and JUMP lifts her in the
      phone-viewport harness.
- [x] **Saves**: `tests/save-reopen.cjs` 3/3 — a valid save survives reload with pets, crown and wand; close/corrupt/
      reopen ignores stale progress; isolated corruption starts fresh and saving recovers.
- [ ] **Rides, attractions and menus as dedicated harnesses**: **not re-run** in this validation. The ride code is
      untouched since the Stage 29 re-verification recorded in `PROGRESS.md` (bounce castle vy 4.07, squish 4→3, ice lane
      0.35 m vs 0.22 m, `G.plutoMatch`), and the phone-viewport harness covers the on-screen controls, but the ride and
      menu harnesses did not complete in this VM.
- [x] **Phone viewports (Chromium emulation)**: iPhone 13 (844×390) and iPhone SE (667×375) — picture aspect correct, six
      touch controls on screen at ≥44 px and none covering another, real touch on ▶ walks and releases, JUMP lifts her
      (y 1.60/1.64), portrait shows the "turn sideways" picture, no page or console errors.
- [ ] **WebKit / iPhone Safari**: **not run**. The Playwright WebKit build could not be downloaded in this environment, so
      no iOS-engine rendering was exercised. See limitations.
- [ ] **Physical iPhone / Android device test**: **not run**. No hardware here. No frame-rate claim is made anywhere.
- [ ] **Full scripted tour (`tests/smoke3d.cjs`) and `tests/devices.cjs`**: both aborted in this VM when the headless
      Chromium process died (SwiftShader/GPU mailbox errors) part-way through their long tours. The same checks they cover
      were run individually (native suites, audits, phone-viewport harness), but the tours themselves did not complete
      here, so they are recorded as **not passed in this run**, not as passing.

## Known limitations

- **No performance claim.** Everything was measured in software WebGL. Frame counts (draw calls / triangles) are geometry
  cost, not frame rate.
- **iPhone Safari rendering is unverified** (WebKit unavailable). Touch handling was verified with Chromium touch
  emulation, not iOS.
- **Stage 30 shading is not in this release** (reverted, see above). Characters keep their authored paint plus the new
  softer material.
- The heart basin sits at x +205 on Pluto's shelf, deliberately away from the walkway; its heart shape is verified only
  from the pinned top-down camera, not from the walking camera.
- `main` of the game repository (`Dawson-s-Wonderverse`) is untouched; this arrives only through PR #104.
- Two pre-existing flakes remain documented, not fixed: a streamed scenery-plane z-fight pair that appears once in a
  while under streaming (never reproduced on rerun), and Mercury's pre-existing 2.9 cm ground-plane pair.

## Remaining development goals (unchanged, still open)

1. **Phase 3 finish (Stage 31)**: bevels on the hard-edged family characters, eye highlights sized for phone distance,
   LOD for far followers, and paint-preserving baked shading (aoMap) to recover the rounded look without touching colour.
2. **Phase 4**: collision and placement regressions, ride/vehicle sweeps after model changes, a regression check per
   confirmed defect class (the gas-giant null and the paint-colour contract are the first two entries).
3. **Phase 5**: phone performance — draw-call budget per district, texture sizes/compression, distant-scenery LOD, shader
   warm-up, and a real-device pass on iPhone Safari and Android Chrome.
4. **Tooling**: adopt KTX2 only with an https transcoder and a local-play fallback.

## How to merge on an iPhone

1. Open <https://github.com/smullinsok042900/Dawson-s-Wonderverse/pull/104> in Safari.
2. Check the green sync run and the "Files changed" tab if you want to see the diff.
3. Scroll to the bottom of the conversation tab and tap **Merge pull request**, then **Confirm merge**.
   (The PR is marked ready for review; no auto-merge is enabled and nothing is merged by the agent.)
4. After merging, open the game from the repository's Pages URL; the built `discovery-world/3d/index.html` is the file to
   play.

## After this release

PR #104 is frozen while it waits for review — no further pushes to it. Once it is merged, development continues on a new
branch (`feature/overhaul-31-plus`) with a new pull request for the next release, starting from Stage 31 above.
