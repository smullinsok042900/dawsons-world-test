// ===================================================================
// scenery-detail.js (graphics overhaul, stage 2+3): extra real geometry for the busiest areas,
// built the same cheap way the planets are — instanced meshes and merged geometry, so a few
// hundred new objects cost a handful of draw calls.
//
//   Playhouse:    a woven play rug, bunting across the ceiling, hanging paper lanterns.
//   Park:         wildflower drifts, sculpted boulders, lamp posts along the path.
//   Castle:       formal parterre beds with roses, stone urns flanking the walk.
//   Dino Valley:  ferns, a mossy fallen log with mushrooms, boulders and footprints.
//
// Everything here is ADDITIVE and sits away from the walking lane (decorations go behind the
// path or in the near foreground). No collision entries are added, so movement, platforms,
// rides and saved progress are untouched. `?nodetail` turns all of it off for A/B measuring.
// ===================================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const C = new THREE.Color();

function tinted(geo, hex) {
  const g = geo.clone();
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** merge a list of geometries into one, disposing the pieces (null if they cannot merge) */
function mergeParts(parts) {
  if (!parts.length) return null;
  let one = null;
  try { one = mergeGeometries(parts, false); } catch (e) { one = null; }
  parts.forEach(g => g.dispose());
  return one;
}

/** play mat texture: soft concentric woven rings */
function rugTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#ffd9ec'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9; i++) {
    g.beginPath(); g.arc(S / 2, S / 2, 118 - i * 12, 0, Math.PI * 2);
    g.strokeStyle = ['#ff9fd2', '#ffd84a', '#9fe6ff', '#c9a6ff'][i % 4]; g.lineWidth = 6; g.stroke();
  }
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(120,60,110,${.02 + (i % 4) * .012})`; g.fillRect((i * 71) % S, (i * 43) % S, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function buildPlayhouseDetail({ scene, add, rnd }) {
  const group = new THREE.Group(); group.name = 'playhouse-detail'; add(group);
  const r = rnd || Math.random;

  // --- the rug, flat on the floor in front of the ball pit (no collision, no shadow cast)
  const rug = new THREE.Mesh(new THREE.CircleGeometry(3.3, 56), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: .96, metalness: 0 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(12, .016, 3.3); rug.receiveShadow = true; group.add(rug);

  // --- bunting: 72 little flags on a sagging line across the ceiling
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-.13, 0, 0, .13, 0, 0, 0, -.26, 0], 3));
  flagGeo.setIndex([0, 1, 2]); flagGeo.computeVertexNormals();
  const flags = new THREE.InstancedMesh(flagGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .8, metalness: 0 }), 72);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < 72; i++) {
    const x = -17 + i * .92, sag = Math.sin((i / 71) * Math.PI * 3) * .18;
    m4.makeRotationZ(Math.sin(i * 1.7) * .06).setPosition(x, 7.35 + sag, -3.35);
    flags.setMatrixAt(i, m4);
    flags.setColorAt(i, col.set(['#ff9fd2', '#ffd84a', '#9fe6ff', '#c9a6ff', '#8ef2b0'][i % 5]));
  }
  flags.castShadow = false; group.add(flags);

  // --- three paper lanterns hanging from the ceiling
  const lanternGeo = new THREE.SphereGeometry(.42, 18, 12);
  const glyphs = [['#ffd9ec', '#ff5fa8'], ['#e8f6ff', '#57b7ff'], ['#fff4d6', '#ffb02e']];
  const cords = [];
  glyphs.forEach(([base, emit], i) => {
    const x = 3 + i * 8.5, y = 6.55, z = -3.9;
    const g = lanternGeo.clone(); g.scale(1, .82, 1);
    const lantern = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: base, emissive: emit, emissiveIntensity: .55, roughness: .62 }));
    lantern.position.set(x, y, z); group.add(lantern);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .9, 5), new THREE.MeshStandardMaterial({ color: '#8a6b55', roughness: .9 }));
    cord.position.set(x, y + .9, z); group.add(cord); cords.push(cord);
  });

  return { group, added: { flags: 72, lanterns: glyphs.length, cords: cords.length } };
}

export function buildParkDetail({ scene, add, terrainH, rnd }) {
  const group = new THREE.Group(); group.name = 'park-detail'; add(group);
  let seed = 1234567;
  const rr = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  // --- wildflower drifts: stems are one instanced mesh, flower heads another (per-instance colour).
  const COUNT = 190;
  const stemGeo = new THREE.CylinderGeometry(.012, .018, .42, 5, 1); stemGeo.translate(0, .21, 0);
  const headParts = [];
  for (let p = 0; p < 5; p++) {
    const petal = new THREE.SphereGeometry(.055, 6, 4);
    const a = (p / 5) * Math.PI * 2;
    petal.scale(1.5, .5, 1); petal.translate(Math.cos(a) * .07, .43, Math.sin(a) * .07);
    headParts.push(petal);
  }
  const mid = new THREE.SphereGeometry(.032, 6, 4); mid.translate(0, .445, 0); headParts.push(mid);
  const headGeo = headParts.length === 1 ? headParts[0] : mergeParts(headParts);
  const stems = new THREE.InstancedMesh(stemGeo, new THREE.MeshStandardMaterial({ color: '#4f9f45', roughness: .85 }), COUNT);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ roughness: .65, metalness: 0, emissive: '#221100', emissiveIntensity: .08 }), COUNT);
  const palette = ['#ff5fa8', '#ffd23f', '#ffffff', '#b98bff', '#ff9a5a'];
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  let placed = 0;
  for (let guard = 0; guard < 3000 && placed < COUNT; guard++) {
    const x = 138 + rr() * 168;
    const z = rr() < .62 ? -(5.2 + rr() * 3.4) : (4.4 + rr() * 3.2); // behind the path, or in the near foreground
    const s = .8 + rr() * .8;
    pos.set(x, terrainH(x, z), z); q.setFromAxisAngle(up, rr() * 6.28); scl.set(s, s * (1 + rr() * .4), s);
    mtx.compose(pos, q, scl);
    stems.setMatrixAt(placed, mtx); heads.setMatrixAt(placed, mtx);
    heads.setColorAt(placed, C.set(palette[placed % palette.length]));
    placed++;
  }
  stems.castShadow = false; stems.receiveShadow = true; heads.castShadow = false;
  group.add(stems, heads);

  // --- three sculpted boulder clusters behind the path (merged into ONE mesh)
  const rockParts = [];
  const clusters = [[166, -7.6, 1.5], [228, -8.2, 1.9], [288, -7.4, 1.3]];
  for (let ci = 0; ci < clusters.length; ci++) {
    const [cx, cz, cs] = clusters[ci];
    for (let k = 0; k < 3; k++) {
      const g = new THREE.SphereGeometry(.55 + rr() * .35, 14, 10);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const n = Math.sin(p.getX(i) * 6 + ci) * .06 + Math.sin(p.getY(i) * 5 + k) * .05 + Math.sin(p.getZ(i) * 7) * .04;
        const k2 = 1 + n; p.setXYZ(i, p.getX(i) * k2 * 1.25, Math.max(-.12, p.getY(i)) * k2, p.getZ(i) * k2);
      }
      g.computeVertexNormals();
      g.scale(cs, cs * .8, cs);
      g.translate(cx + (k - 1) * 1.1 * cs, terrainH(cx, cz) + .16 * cs, cz + (k % 2) * .7);
      rockParts.push(tinted(g, ['#9a958c', '#8a8478', '#a8a397'][k % 3]));
      g.dispose();
    }
  }
  const rocks = new THREE.Mesh(mergeParts(rockParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0 }));
  rocks.castShadow = true; rocks.receiveShadow = true; rocks.userData.grounded = true; // seated boulders: half buried on purpose
  group.add(rocks);

  // --- lamp posts along the path (merged posts + instanced glowing globes)
  const postParts = [], globeSpots = [];
  for (let i = 0; i < 6; i++) {
    const x = 150 + i * 28, z = (i % 2 ? 1 : -1) * 2.9;
    const base = new THREE.CylinderGeometry(.16, .22, .24, 10); base.translate(x, terrainH(x, z) + .12, z);
    const pole = new THREE.CylinderGeometry(.055, .07, 2.25, 8); pole.translate(x, terrainH(x, z) + 1.25, z);
    postParts.push(tinted(base, '#4a4f60'), tinted(pole, '#565c70'));
    globeSpots.push([x, terrainH(x, z) + 2.5, z]);
    base.dispose(); pole.dispose();
  }
  const posts = new THREE.Mesh(mergeParts(postParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .35 }));
  posts.castShadow = true; group.add(posts);

  const globeGeo = new THREE.SphereGeometry(.19, 12, 9);
  const globes = new THREE.InstancedMesh(globeGeo, new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffcf6a', emissiveIntensity: .9, roughness: .4 }), globeSpots.length);
  globeSpots.forEach(([x, y, z], i) => { mtx.makeTranslation(x, y, z); globes.setMatrixAt(i, mtx); });
  group.add(globes);

  return { group, added: { flowers: placed, boulderClusters: clusters.length, lamps: globeSpots.length } };
}

export function buildCastleDetail({ scene, add, cx = 407, rnd }) {
  const group = new THREE.Group(); group.name = 'castle-detail'; add(group);
  let seed = 987654;
  const rr = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();

  // --- two formal parterre beds in the near foreground: gravel plate, trimmed hedge border,
  //     a rose bush and five blooms in each.
  const beds = [[cx - 4.4, 4.2, 3.0, 2.2], [cx + 4.4, 4.2, 3.0, 2.2]];
  const gravelParts = [], hedgeParts = [];
  for (const [bx, bz, w, d] of beds) {
    const soil = new THREE.BoxGeometry(w, .1, d); soil.translate(bx, .05, bz); gravelParts.push(tinted(soil, '#e8dcc4')); soil.dispose();
    for (const [ox, oz, hw, hd] of [[0, -d / 2, w, .26], [0, d / 2, w, .26], [-w / 2, 0, .26, d], [w / 2, 0, .26, d]]) {
      const hedge = new THREE.BoxGeometry(hw, .38, hd); hedge.translate(bx + ox, .19, bz + oz); hedgeParts.push(tinted(hedge, '#4f8f4a')); hedge.dispose();
    }
  }
  group.add(new THREE.Mesh(mergeParts(gravelParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 })));
  const hedges = new THREE.Mesh(mergeParts(hedgeParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, sheen: .3 }));
  hedges.castShadow = true; hedges.receiveShadow = true; group.add(hedges);

  // --- rose bushes (green mound) and blooms (per-instance colour) filling both beds
  const bushGeo = new THREE.SphereGeometry(.22, 10, 7); bushGeo.scale(1.25, .85, 1.25);
  const bloomGeo = new THREE.SphereGeometry(.075, 8, 6); bloomGeo.scale(1.15, .8, 1.15);
  const bushSpots = [], bloomSpots = [];
  for (const [bx, bz, w, d] of beds) {
    for (let i = 0; i < 12; i++) {
      const px = bx + (rr() - .5) * (w - .7), pz = bz + (rr() - .5) * (d - .7);
      bushSpots.push([px, .3, pz, .8 + rr() * .5]);
      for (let k = 0; k < 3; k++) bloomSpots.push([px + (rr() - .5) * .3, .46 + rr() * .12, pz + (rr() - .5) * .3]);
    }
  }
  const bushes = new THREE.InstancedMesh(bushGeo, new THREE.MeshStandardMaterial({ color: '#3f7f3f', roughness: .85 }), bushSpots.length);
  bushSpots.forEach(([x, y, z, s], i) => { pos.set(x, y, z); scl.set(s, s, s); mtx.compose(pos, q, scl); bushes.setMatrixAt(i, mtx); });
  bushes.castShadow = true; bushes.receiveShadow = true; group.add(bushes);
  const blooms = new THREE.InstancedMesh(bloomGeo, new THREE.MeshStandardMaterial({ roughness: .6 }), bloomSpots.length);
  const roseCols = ['#ff4f8a', '#ff9fd2', '#ffe6f2', '#ffd23f'];
  bloomSpots.forEach(([x, y, z], i) => { mtx.makeTranslation(x, y, z); blooms.setMatrixAt(i, mtx); blooms.setColorAt(i, C.set(roseCols[i % roseCols.length])); });
  blooms.castShadow = false; group.add(blooms);

  // --- four stone urns flanking the walk, each with a little flowering top
  const urnParts = [], urnTops = [];
  for (const ux of [cx - 8.2, cx - 2.4, cx + 2.4, cx + 8.2]) {
    const uz = 2.15;
    const foot = new THREE.CylinderGeometry(.18, .24, .16, 12); foot.translate(ux, .08, uz);
    const bowl = new THREE.CylinderGeometry(.34, .2, .34, 14); bowl.translate(ux, .33, uz);
    const rim = new THREE.TorusGeometry(.34, .045, 8, 16); rim.rotateX(Math.PI / 2); rim.translate(ux, .5, uz);
    urnParts.push(tinted(foot, '#cfc6b8'), tinted(bowl, '#ded5c6'), tinted(rim, '#e8e0d2'));
    foot.dispose(); bowl.dispose(); rim.dispose();
    urnTops.push([ux, .58, uz]);
  }
  const urns = new THREE.Mesh(mergeParts(urnParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 }));
  urns.castShadow = true; urns.receiveShadow = true; group.add(urns);
  const urnFlowers = new THREE.InstancedMesh(new THREE.SphereGeometry(.16, 10, 7), new THREE.MeshStandardMaterial({ roughness: .7 }), urnTops.length * 4);
  let fi = 0;
  for (const [ux, uy, uz] of urnTops) for (let k = 0; k < 4; k++) {
    mtx.makeTranslation(ux + (k - 1.5) * .11, uy + .12 + (k % 2) * .06, uz + (k % 2 ? .06 : -.06));
    urnFlowers.setMatrixAt(fi, mtx); urnFlowers.setColorAt(fi, C.set(['#ff6fae', '#ffd23f', '#a98bff', '#ffffff'][k]));
    fi++;
  }
  group.add(urnFlowers);

  // --- a string of warm lanterns along the castle front (instanced, one draw call)
  const lanternSpots = [];
  for (let i = 0; i < 11; i++) lanternSpots.push([cx - 10 + i * 2, 3.4 + Math.sin(i / 10 * Math.PI) * .55, -3.55]);
  const lanterns = new THREE.InstancedMesh(new THREE.SphereGeometry(.11, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff4cf', emissive: '#ffc94a', emissiveIntensity: 1.0, roughness: .5 }), lanternSpots.length);
  lanternSpots.forEach(([x, y, z], i) => { mtx.makeTranslation(x, y, z); lanterns.setMatrixAt(i, mtx); });
  lanterns.castShadow = false; group.add(lanterns);

  return { group, added: { parterres: beds.length, roseBushes: bushSpots.length, blooms: bloomSpots.length, urns: urnTops.length, lanterns: lanternSpots.length } };
}

export function buildDinoDetail({ scene, add, dx = 378, rnd }) {
  const group = new THREE.Group(); group.name = 'dino-detail'; add(group);
  let seed = 24681357;
  const rr = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();

  // --- ferns: one merged frond, instanced along the back of the valley and the near foreground
  const leafParts = [];
  for (let f = 0; f < 5; f++) {
    const blade = new THREE.PlaneGeometry(.16, .62, 1, 2);
    blade.translate(0, .31, 0); blade.rotateX(-.35);
    blade.rotateY(f / 5 * Math.PI * 2);
    leafParts.push(blade);
  }
  const frondGeo = mergeParts(leafParts);
  const frondMat = new THREE.MeshStandardMaterial({ color: '#3f8f4f', roughness: .8, side: THREE.DoubleSide });
  const fernSpots = [];
  for (let i = 0; i < 95; i++) {
    const x = dx - 20 + rr() * 36;
    const z = rr() < .62 ? -(5.0 + rr() * 3.2) : (3.6 + rr() * 2.6);
    if (Math.abs(x - 363.4) < 2.2 && z < 0) continue; // keep the egg nest clear
    fernSpots.push([x, z, .8 + rr() * .9, rr() * 6.28]);
  }
  const ferns = new THREE.InstancedMesh(frondGeo, frondMat, fernSpots.length);
  fernSpots.forEach(([x, z, s, a], i) => {
    pos.set(x, 0, z); q.setFromAxisAngle(up, a); scl.set(s, s, s);
    mtx.compose(pos, q, scl); ferns.setMatrixAt(i, mtx);
    if (i % 3 === 0) ferns.setColorAt(i, C.set('#4f9f5a'));
  });
  ferns.castShadow = false; ferns.receiveShadow = true; group.add(ferns);

  // --- mossy boulders, merged into one mesh
  const rockParts = [];
  for (const [cx, cz, cs] of [[368, -6.8, 1.5], [386, -7.2, 1.2], [359, 4.6, 1.1]]) {
    for (let k = 0; k < 3; k++) {
      const g = new THREE.SphereGeometry(.5 + rr() * .3, 12, 8);
      g.scale(cs, cs * .78, cs);
      g.translate(cx + (k - 1) * .9 * cs, .2 * cs, cz + (k % 2) * .6);
      rockParts.push(tinted(g, ['#8f9a86', '#7f8a76', '#9aa593'][k % 3]));
      g.dispose();
    }
  }
  const rocks = new THREE.Mesh(mergeParts(rockParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 }));
  rocks.castShadow = true; rocks.receiveShadow = true; rocks.userData.grounded = true;
  group.add(rocks);

  // --- a fallen log with moss and mushrooms, behind the path
  const logParts = [];
  const log = new THREE.CylinderGeometry(.32, .38, 3.4, 12); log.rotateZ(Math.PI / 2); log.translate(dx - 6.5, .38, -7.0);
  logParts.push(tinted(log, '#8a6242')); log.dispose();
  for (let k = 0; k < 5; k++) {
    const moss = new THREE.SphereGeometry(.24, 10, 6); moss.scale(1.4, .35, 1.1);
    moss.translate(dx - 8 + k * .8, .56 + (k % 2) * .05, -7.0 + (k % 2 ? .12 : -.1));
    logParts.push(tinted(moss, '#5f9a52')); moss.dispose();
  }
  const fallen = new THREE.Mesh(mergeParts(logParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 }));
  fallen.castShadow = true; fallen.receiveShadow = true; fallen.userData.grounded = true;
  group.add(fallen);
  const mushroomGeo = new THREE.ConeGeometry(.1, .16, 10);
  const mushrooms = new THREE.InstancedMesh(mushroomGeo, new THREE.MeshStandardMaterial({ color: '#ff8f6a', roughness: .7 }), 6);
  for (let i = 0; i < 6; i++) { mtx.makeTranslation(dx - 7.7 + i * .6, .58, -7.0 + (i % 2 ? .35 : -.32)); mushrooms.setMatrixAt(i, mtx); }
  mushrooms.castShadow = false; group.add(mushrooms);

  // --- a trail of three-toed footprints along the near edge of the path
  const printGeo = new THREE.CircleGeometry(.2, 10); printGeo.rotateX(-Math.PI / 2); printGeo.scale(1, 1, .7);
  const prints = new THREE.InstancedMesh(printGeo, new THREE.MeshStandardMaterial({ color: '#6f9c6a', roughness: 1 }), 8);
  for (let i = 0; i < 8; i++) {
    mtx.makeTranslation(dx - 9 + i * 1.3, .012, 1.35 + (i % 2 ? .18 : -.12));
    mtx.multiply(new THREE.Matrix4().makeRotationY(i % 2 ? .3 : -.3));
    prints.setMatrixAt(i, mtx);
  }
  prints.receiveShadow = true; group.add(prints);

  return { group, added: { ferns: fernSpots.length, boulders: rockParts.length, mushrooms: 6, footprints: 8 } };
}
