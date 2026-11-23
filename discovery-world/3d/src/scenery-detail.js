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

/** a cylinder between two points (used for the velvet ropes) */
function barBetween(ax, ay, az, bx, by, bz, r, hex, radial = 6) {
  const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
  const len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(.5);
  const g = new THREE.CylinderGeometry(r, r, len, radial);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate(mid.x, mid.y, mid.z);
  return tinted(g, hex);
}

export function buildCastleInteriorDetail({ add, ox = 2000 }) {
  const group = new THREE.Group(); group.name = 'castle-interior-detail'; group.position.set(ox, 0, 0); add(group);
  let seed = 11235813;
  const rr = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();

  // --- velvet ropes lining the carpet aisle: gold posts, sagging red rope (2 merged meshes)
  const postParts = [], ropeParts = [];
  const POST_X = [3.2, 6.4, 9.6, 12.8, 16];
  for (const z of [-1.55, 1.55]) {
    for (const x of POST_X) {
      const base = new THREE.CylinderGeometry(.14, .19, .12, 10); base.translate(x, .06, z);
      const post = new THREE.CylinderGeometry(.045, .055, .92, 8); post.translate(x, .56, z);
      const knob = new THREE.SphereGeometry(.1, 12, 9); knob.translate(x, 1.06, z);
      postParts.push(tinted(base, '#c9a24a'), tinted(post, '#e0bb62'), tinted(knob, '#f2d488'));
      base.dispose(); post.dispose(); knob.dispose();
    }
    for (let i = 0; i < POST_X.length - 1; i++) {
      const x0 = POST_X[i], x1 = POST_X[i + 1], y0 = .98, sag = .26;
      const N = 4;
      for (let s = 0; s < N; s++) {
        const u0 = s / N, u1 = (s + 1) / N;
        const y = u => y0 - Math.sin(u * Math.PI) * sag;
        ropeParts.push(barBetween(x0 + (x1 - x0) * u0, y(u0), z, x0 + (x1 - x0) * u1, y(u1), z, .035, '#c8325f', 6));
      }
    }
  }
  const posts = new THREE.Mesh(mergeParts(postParts), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .65, roughness: .3 }));
  posts.castShadow = true; group.add(posts);
  const ropes = new THREE.Mesh(mergeParts(ropeParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, sheen: .6 }));
  group.add(ropes);

  // --- potted palms beside the back wall (one merged mesh: terracotta pot + fronds + trunk)
  const palmParts = [];
  for (const [px, pz] of [[2.6, -4.25], [10.9, -4.25], [16.5, -4.25], [22.2, -4.25]]) {
    const pot = new THREE.CylinderGeometry(.26, .2, .52, 14); pot.translate(px, .26, pz);
    const lip = new THREE.TorusGeometry(.26, .045, 8, 18); lip.rotateX(Math.PI / 2); lip.translate(px, .52, pz);
    const trunk = new THREE.CylinderGeometry(.055, .075, .55, 8); trunk.translate(px, .8, pz);
    palmParts.push(tinted(pot, '#c97a52'), tinted(lip, '#b86743'), tinted(trunk, '#7a5a3a'));
    pot.dispose(); lip.dispose(); trunk.dispose();
    for (let f = 0; f < 7; f++) {
      const a = f / 7 * Math.PI * 2 + rr() * .2;
      const blade = new THREE.PlaneGeometry(.13, .78, 1, 2);
      blade.translate(0, .39, 0);
      blade.rotateX(-.75 - rr() * .25);
      blade.rotateY(a);
      blade.translate(px, 1.06, pz);
      palmParts.push(tinted(blade, f % 2 ? '#3f8f4a' : '#4f9f5a'));
      blade.dispose();
    }
  }
  const palms = new THREE.Mesh(mergeParts(palmParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide }));
  palms.castShadow = true; palms.receiveShadow = true; group.add(palms);

  // --- four velvet banners with gold rails, hung above the stained glass
  const bannerParts = [];
  for (const [bx, col] of [[3.4, '#b02a5a'], [9.1, '#7a3fb0'], [14.9, '#2a6fb0'], [20.2, '#b02a5a']]) {
    const rail = new THREE.CylinderGeometry(.045, .045, 1.1, 8); rail.rotateZ(Math.PI / 2); rail.translate(bx, 8.75, -5.5);
    const cloth = new THREE.PlaneGeometry(.9, 2.1, 4, 6);
    const cp = cloth.attributes.position;
    for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), y = cp.getY(i); cp.setZ(i, Math.sin((x / .9 + .5) * Math.PI) * .06 + Math.sin((y / 2.1 + .5) * Math.PI * 2) * .03); }
    cloth.computeVertexNormals(); cloth.translate(bx, 7.7, -5.5);
    const crest = new THREE.CircleGeometry(.16, 18); crest.translate(bx, 8.05, -5.44);
    bannerParts.push(tinted(rail, '#e0bb62'), tinted(cloth, col), tinted(crest, '#f2d488'));
    rail.dispose(); cloth.dispose(); crest.dispose();
  }
  const banners = new THREE.Mesh(mergeParts(bannerParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, side: THREE.DoubleSide }));
  group.add(banners);

  // --- a pile of wrapped party gifts behind the cake (one merged mesh, ribbons included)
  const giftParts = [];
  const giftCols = ['#ff5f9a', '#5fb8ff', '#ffd23f', '#7fd6a0', '#b28cff', '#ff9a5a'];
  for (let i = 0; i < 6; i++) {
    const w = .28 + rr() * .26, h = .24 + rr() * .22, d = .28 + rr() * .22;
    const gx = 7.4 + (i % 3) * .62 + rr() * .1, gz = -4.05 + Math.floor(i / 3) * .5 + rr() * .06;
    const box = new THREE.BoxGeometry(w, h, d); box.translate(gx, h / 2, gz);
    const rib1 = new THREE.BoxGeometry(.05, h + .01, d + .01); rib1.translate(gx, h / 2, gz);
    const rib2 = new THREE.BoxGeometry(w + .01, h + .01, .05); rib2.translate(gx, h / 2, gz);
    const bow = new THREE.SphereGeometry(.07, 10, 7); bow.scale(1.4, .5, 1.1); bow.translate(gx, h + .03, gz);
    giftParts.push(tinted(box, giftCols[i % giftCols.length]), tinted(rib1, '#fff6cf'), tinted(rib2, '#fff6cf'), tinted(bow, '#fff6cf'));
    box.dispose(); rib1.dispose(); rib2.dispose(); bow.dispose();
  }
  const gifts = new THREE.Mesh(mergeParts(giftParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6 }));
  gifts.castShadow = true; gifts.receiveShadow = true; group.add(gifts);

  // --- candle clusters on the throne steps (instanced flames, one draw call)
  const flameSpots = [];
  for (const [cx, cz] of [[17.9, -4.25], [21.1, -4.25], [17.9, -2.35], [21.1, -2.35]]) {
    for (let i = 0; i < 3; i++) flameSpots.push([cx + (i - 1) * .16 + rr() * .05, .42 + .18 * (i % 2), cz + (i % 2 ? .08 : -.05)]);
  }
  const flames = new THREE.InstancedMesh(new THREE.SphereGeometry(.055, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffcf6a' }), flameSpots.length);
  flameSpots.forEach(([x, y, z], i) => { pos.set(x, y, z); scl.set(1, 1.7, 1); mtx.compose(pos, q, scl); flames.setMatrixAt(i, mtx); });
  group.add(flames);

  return { group, added: { ropePosts: POST_X.length * 2, palms: 4, banners: 4, gifts: 6, candles: flameSpots.length } };
}

export function buildToyTownDetail({ add }) {
  const group = new THREE.Group(); group.name = 'toytown-detail'; add(group);
  let seed = 51505150;
  const rr = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const toyCols = ['#ff5f8f', '#ffd23f', '#4fa8ff', '#57c97a', '#b07cff', '#ff9a3f'];

  // --- an overturned toy box behind the path, spilling alphabet blocks (one merged mesh)
  const crateParts = [];
  const BX = 600, BZ = -5.4;
  const bottom = new THREE.BoxGeometry(1.9, .12, 1.3); bottom.translate(BX, .06, BZ);
  crateParts.push(tinted(bottom, '#c98a52'));
  bottom.dispose();
  for (const [ox, oz, w, d] of [[0, -.64, 1.9, .1], [0, .64, 1.9, .1], [-.94, 0, .1, 1.3], [.94, 0, .1, 1.3]]) {
    const side = new THREE.BoxGeometry(w, .78, d); side.translate(BX + ox, .45, BZ + oz);
    crateParts.push(tinted(side, '#b8723f')); side.dispose();
  }
  for (let i = 0; i < 8; i++) {
    const s = .34 + rr() * .2;
    const x = BX + 1.15 + (i % 4) * .55 + rr() * .12;
    const z = BZ + .55 - Math.floor(i / 4) * .7 + rr() * .15;
    const rot = (rr() - .5) * .5;
    const block = new THREE.BoxGeometry(s, s, s);
    block.rotateY(rot); block.rotateZ((rr() - .5) * .15); block.translate(x, s / 2, z);
    crateParts.push(tinted(block, toyCols[i % toyCols.length])); block.dispose();
    const band = new THREE.BoxGeometry(s + .005, s * .18, s + .005);
    band.rotateY(rot); band.translate(x, s / 2, z);
    crateParts.push(tinted(band, '#fff6df')); band.dispose();
  }
  const crate = new THREE.Mesh(mergeParts(crateParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75 }));
  crate.castShadow = true; crate.receiveShadow = true; group.add(crate);

  // --- giant toy balls along the near edge of the path (one instanced mesh, per-instance colour)
  const ballSpots = [];
  for (const x of [562, 574, 589, 604, 626, 641, 655]) ballSpots.push([x, .42 + rr() * .28, 4.2 + rr() * .8]);
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ roughness: .28, metalness: 0, clearcoat: 1 }), ballSpots.length);
  ballSpots.forEach(([x, r, z], i) => { pos.set(x, r, z); scl.set(r, r, r); mtx.compose(pos, q, scl); balls.setMatrixAt(i, mtx); balls.setColorAt(i, C.set(toyCols[i % toyCols.length])); });
  balls.castShadow = true; balls.receiveShadow = true; group.add(balls);

  // --- spinning tops (one merged mesh: base disc, body, stem and knob for each)
  const topParts = [];
  for (const [x, z] of [[570, 4.9], [596, 5.0], [618, 4.8], [648, 4.9]]) {
    const base = new THREE.CylinderGeometry(.34, .38, .1, 18); base.translate(x, .05, z);
    const body = new THREE.ConeGeometry(.4, .62, 18); body.rotateX(Math.PI); body.translate(x, .41, z);
    const stem = new THREE.CylinderGeometry(.035, .045, .3, 8); stem.translate(x, .82, z);
    const knob = new THREE.SphereGeometry(.07, 10, 8); knob.translate(x, .99, z);
    topParts.push(tinted(base, '#ffd23f'), tinted(body, '#4fa8ff'), tinted(stem, '#ffffff'), tinted(knob, '#ff5f8f'));
    base.dispose(); body.dispose(); stem.dispose(); knob.dispose();
  }
  const tops = new THREE.Mesh(mergeParts(topParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .4, metalness: .1 }));
  tops.castShadow = true; tops.receiveShadow = true; group.add(tops);

  return { group, added: { blocks: 8, balls: ballSpots.length, tops: 4 } };
}
