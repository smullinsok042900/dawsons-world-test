// ===================================================================
// scenery-detail.js (graphics overhaul, stage 2): extra real geometry for the two busiest
// areas, built the same cheap way the planets are — instanced meshes and merged geometry,
// so a few hundred new objects cost a handful of draw calls.
//
//   Playhouse: a woven play rug, a bunting garland across the ceiling, hanging paper lanterns.
//   Park:      wildflower drifts, sculpted boulders, and lamp posts along the path.
//
// Everything here is ADDITIVE and sits away from the walking lane (z between -4.5 and 3 for
// play; decorations go behind z=-4 or in front of z=3). No collision entries are added, so
// movement, platforms, rides and saved progress are untouched.
// ===================================================================
import * as THREE from 'three';

const C = new THREE.Color();

function tinted(geo, hex) {
  const g = geo.clone();
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
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
  const cords = [], poles = [];
  glyphs.forEach(([base, emit], i) => {
    const x = 3 + i * 8.5, y = 6.55, z = -3.9;
    const g = lanternGeo.clone(); g.scale(1, .82, 1);
    const lantern = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: base, emissive: emit, emissiveIntensity: .55, roughness: .62 }));
    lantern.position.set(x, y, z); group.add(lantern);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .9, 5), new THREE.MeshStandardMaterial({ color: '#8a6b55', roughness: .9 }));
    cord.position.set(x, y + .9, z); group.add(cord); cords.push(cord);
  });

  return { group, added: { flags: 72, lanterns: glyphs.length, cords: cords.length + poles.length } };
}

export function buildParkDetail({ scene, add, terrainH, rnd }) {
  const group = new THREE.Group(); group.name = 'park-detail'; add(group);
  const r = rnd || Math.random;
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
  const headGeo = headParts.length === 1 ? headParts[0] : (() => {
    // merge by hand (all parts share position-only geometry)
    const pos = [], idx = []; let base = 0;
    for (const g of headParts) {
      const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) pos.push(p[i]);
      const ix = g.index ? g.index.array : null;
      if (ix) for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base);
      else for (let i = 0; i < p.length / 3; i++) idx.push(i + base);
      base += p.length / 3;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  })();
  const stems = new THREE.InstancedMesh(stemGeo, new THREE.MeshStandardMaterial({ color: '#4f9f45', roughness: .85 }), COUNT);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ vertexColors: false, roughness: .65, metalness: 0, emissive: '#221100', emissiveIntensity: .08 }), COUNT);
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
  const merged = (() => {
    const pos = [], nor = [], colA = []; let base = 0; const indices = [];
    for (const g of rockParts) {
      const p = g.attributes.position.array, n = g.attributes.normal.array, c = g.attributes.color.array;
      for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); colA.push(c[i]); }
      const ix = g.index ? g.index.array : null;
      if (ix) for (let i = 0; i < ix.length; i++) indices.push(ix[i] + base);
      else for (let i = 0; i < p.length / 3; i++) indices.push(i + base);
      base += p.length / 3;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
    g.setIndex(indices); return g;
  })();
  const rocks = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0, flatShading: false }));
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
  let base = 0; const pp = [], pn = [], pc = [], pidx = [];
  for (const g of postParts) {
    const p = g.attributes.position.array, n = g.attributes.normal.array, c = g.attributes.color.array;
    for (let i = 0; i < p.length; i++) { pp.push(p[i]); pn.push(n[i]); pc.push(c[i]); }
    const ix = g.index ? g.index.array : null;
    if (ix) for (let i = 0; i < ix.length; i++) pidx.push(ix[i] + base);
    else for (let i = 0; i < p.length / 3; i++) pidx.push(i + base);
    base += p.length / 3;
    g.dispose();
  }
  const postGeo = new THREE.BufferGeometry();
  postGeo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
  postGeo.setAttribute('normal', new THREE.Float32BufferAttribute(pn, 3));
  postGeo.setAttribute('color', new THREE.Float32BufferAttribute(pc, 3));
  postGeo.setIndex(pidx);
  const posts = new THREE.Mesh(postGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .35 }));
  posts.castShadow = true; group.add(posts);

  const globeGeo = new THREE.SphereGeometry(.19, 12, 9);
  const globes = new THREE.InstancedMesh(globeGeo, new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffcf6a', emissiveIntensity: .9, roughness: .4 }), globeSpots.length);
  globeSpots.forEach(([x, y, z], i) => { mtx.makeTranslation(x, y, z); globes.setMatrixAt(i, mtx); });
  group.add(globes);

  return { group, added: { flowers: placed, boulderClusters: clusters.length, lamps: globeSpots.length } };
}
