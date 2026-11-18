// Vice Tides — Palmera Bay itself: the road grid, downtown towers, mid-rise blocks,
// suburbs, the beach and marina, palms, lamps, props and boats, all procedural.
// Also owns the static collision boxes and the ground-height rule every mover uses.
const THREE = window.THREE;
import {
  PITCH, ROAD_W, BLOCK, GRID_X, GRID_Z_TOP, GRID_Z_BOT,
  CITY_MIN_X, CITY_MAX_X, CITY_MIN_Z, CITY_MAX_Z, SAND_END_Z, WATER_END_Z,
  MARINA_X, MARINA_END_Z, PACKAGE_COUNT,
} from './config.js';

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export const V_ROADS = []; for (let i = -GRID_X; i <= GRID_X; i++) V_ROADS.push(i * PITCH);
export const H_ROADS = []; for (let j = GRID_Z_TOP; j <= GRID_Z_BOT; j++) H_ROADS.push(j * PITCH);
export const INTERSECTIONS = [];
for (const x of V_ROADS) for (const z of H_ROADS) INTERSECTIONS.push({ x, z });

export const LANDMARKS = {
  spawn: { x: MARINA_X + 16, z: 2 * PITCH - 2 },
  marinaDrop: { x: MARINA_X, z: SAND_END_Z + 10 },
  pierEnd: { x: MARINA_X, z: MARINA_END_Z - 4 },
  bankDoor: { x: -PITCH / 2, z: -4 },
  garage: { x: MARINA_X - PITCH + 6, z: 2 * PITCH - 6 },
  hospital: { x: -2 * PITCH, z: PITCH + 6 },
  beachBar: { x: -3 * PITCH, z: CITY_MAX_Z + 16 },
};

/** Ten hand-placed hiding spots for the collectible packages. */
export const PACKAGE_SPOTS = [
  { x: MARINA_X, z: MARINA_END_Z - 6 },
  { x: -3 * PITCH - 12, z: CITY_MAX_Z + 22 },
  { x: -PITCH - 20, z: -PITCH - 20 },
  { x: 3 * PITCH + 18, z: -2 * PITCH + 14 },
  { x: 12, z: -3 * PITCH + 18 },
  { x: -4 * PITCH + 16, z: PITCH - 16 },
  { x: 4 * PITCH - 14, z: 2 * PITCH - 18 },
  { x: -20, z: -2 * PITCH - 22 },
  { x: 2 * PITCH + 22, z: PITCH + 20 },
  { x: -2 * PITCH + 8, z: 2 * PITCH + 14 },
].slice(0, PACKAGE_COUNT);

export function isOnPier(x, z) {
  return Math.abs(x - MARINA_X) <= 5.5 && z >= CITY_MAX_Z - 2 && z <= MARINA_END_Z;
}
export function isWater(x, z) {
  return z > SAND_END_Z + 3 && !isOnPier(x, z);
}
/** Ground height: block slabs and the pier deck sit a step above the roads. */
export function groundY(x, z) {
  if (isOnPier(x, z)) return 0.32;
  if (z > CITY_MAX_Z) return 0.02; // sand
  const onRoadX = V_ROADS.some((rx) => Math.abs(x - rx) <= ROAD_W / 2);
  const onRoadZ = H_ROADS.some((rz) => Math.abs(z - rz) <= ROAD_W / 2);
  return (onRoadX || onRoadZ) ? 0 : 0.18;
}
export function roadKind(x, z) {
  const v = V_ROADS.some((rx) => Math.abs(x - rx) <= ROAD_W / 2);
  const h = H_ROADS.some((rz) => Math.abs(z - rz) <= ROAD_W / 2);
  return v && h ? 'x' : v ? 'v' : h ? 'h' : null;
}

function signTexture(text, bg, fg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 96);
  g.font = '900 54px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = fg;
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createWorld(scene, textures) {
  const rand = rng(20261118);
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const boats = [];
  const lampHeads = [];

  // ---------- lights & sky ----------
  scene.fog = new THREE.Fog(0xe8906d, 190, 760);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 24, 12),
    new THREE.MeshBasicMaterial({ map: textures.sky, side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x4a3555, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 2.7);
  sun.position.set(-320, 170, 260);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -190; sun.shadow.camera.right = 190;
  sun.shadow.camera.top = 190; sun.shadow.camera.bottom = -190;
  sun.shadow.camera.far = 1200; sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0x8fb7ff, 0.35);
  fill.position.set(200, 120, -200); scene.add(fill);

  // ---------- ground ----------
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshLambertMaterial({ map: textures.grass, color: 0x9db38a }),
  );
  grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.05, 60); grass.receiveShadow = true;
  scene.add(grass);

  const asphaltMat = new THREE.MeshLambertMaterial({ map: textures.asphalt });
  const asphaltPlain = new THREE.MeshLambertMaterial({ color: 0x4a4a58 });
  function roadStrip(w, l, x, z, alongZ) {
    const tex = textures.asphalt.clone();
    tex.needsUpdate = true; tex.repeat.set(1, Math.max(1, Math.round(l / 16)));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshLambertMaterial({ map: tex }));
    m.rotation.x = -Math.PI / 2; if (!alongZ) m.rotation.z = Math.PI / 2;
    m.position.set(x, 0.02, z); m.receiveShadow = true; scene.add(m);
  }
  const cityLenZ = CITY_MAX_Z - CITY_MIN_Z, cityCenZ = (CITY_MAX_Z + CITY_MIN_Z) / 2;
  const cityLenX = CITY_MAX_X - CITY_MIN_X, cityCenX = (CITY_MAX_X + CITY_MIN_X) / 2;
  for (const x of V_ROADS) roadStrip(ROAD_W, cityLenZ, x, cityCenZ, true);
  for (const z of H_ROADS) roadStrip(ROAD_W, cityLenX, cityCenX, z, false);
  for (const n of INTERSECTIONS) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, ROAD_W), asphaltPlain);
    m.rotation.x = -Math.PI / 2; m.position.set(n.x, 0.025, n.z); m.receiveShadow = true; scene.add(m);
  }
  // beach + sea
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(1500, SAND_END_Z - CITY_MAX_Z + 4),
    new THREE.MeshLambertMaterial({ map: textures.sand }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.01, (CITY_MAX_Z + SAND_END_Z) / 2); sand.receiveShadow = true; scene.add(sand);
  const waterMat = new THREE.MeshPhongMaterial({ map: textures.water, shininess: 120, specular: 0x99ddff });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1500, WATER_END_Z - SAND_END_Z + 260), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.02, (SAND_END_Z + WATER_END_Z) / 2 + 110); scene.add(water);

  // ---------- blocks & buildings ----------
  const slabMat = new THREE.MeshLambertMaterial({ map: textures.sidewalk });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a4a42 });
  const facadeMats = textures.facades.map((t) => new THREE.MeshLambertMaterial({ map: t }));
  const boxGeoCache = new Map();
  function boxGeo(w, h, d) {
    const k = `${w}|${h}|${d}`;
    if (!boxGeoCache.has(k)) boxGeoCache.set(k, new THREE.BoxGeometry(w, h, d));
    return boxGeoCache.get(k);
  }
  function addBuilding(x, z, w, d, h, matIdx) {
    const side = facadeMats[matIdx % facadeMats.length];
    const m = new THREE.Mesh(boxGeo(w, h, d), [side, side, roofMat, roofMat, side, side]);
    m.position.set(x, 0.18 + h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  }

  for (let i = -GRID_X; i < GRID_X; i++) {
    for (let j = GRID_Z_TOP; j < GRID_Z_BOT; j++) {
      const cx = i * PITCH + PITCH / 2, cz = j * PITCH + PITCH / 2;
      const slab = new THREE.Mesh(boxGeo(BLOCK, 0.18, BLOCK), slabMat);
      slab.position.set(cx, 0.09, cz); slab.receiveShadow = true; scene.add(slab);
      const distC = Math.hypot(cx, cz + PITCH / 2);
      const downtown = distC < 130;
      const suburb = distC > 260;
      // 2x2 lots per block; some lots stay open as parking / plaza
      for (let lx = 0; lx < 2; lx++) for (let lz = 0; lz < 2; lz++) {
        if (rand() < 0.14) continue;
        const x = cx - 10 + lx * 20 + (rand() - 0.5) * 2;
        const z = cz - 10 + lz * 20 + (rand() - 0.5) * 2;
        let h;
        if (downtown) h = 26 + rand() * 46;
        else if (suburb) h = 6 + rand() * 7;
        else h = 12 + rand() * 22;
        const w = 13 + rand() * 4, d = 13 + rand() * 4;
        addBuilding(x, z, w, d, h, (i * 7 + j * 3 + lx * 2 + lz) & 7);
        if (suburb && rand() < 0.6) { // suburban roof cap
          const cap = new THREE.Mesh(boxGeo(w * 0.7, 2.2, d * 0.7),
            new THREE.MeshLambertMaterial({ color: 0x8a4a3a }));
          cap.position.set(x, 0.18 + h + 1.1, z); cap.castShadow = true; scene.add(cap);
        }
      }
    }
  }
  // The Palmera Bay Bank: a gold tower on the downtown corner, with its name up high.
  const bank = addBuilding(-PITCH / 2, -PITCH / 2, 30, 30, 58, 2);
  bank.material = bank.material.map((m, idx) => idx === 2 || idx === 3 ? m :
    new THREE.MeshLambertMaterial({ color: 0xd9a94f }));
  const bankSign = new THREE.Mesh(new THREE.PlaneGeometry(26, 5),
    new THREE.MeshBasicMaterial({ map: signTexture('PALMERA BANK', '#241a08', '#ffd94d') }));
  bankSign.position.set(-PITCH / 2, 40, -PITCH / 2 + 15.2); scene.add(bankSign);
  const bankSign2 = bankSign.clone(); bankSign2.rotation.y = Math.PI;
  bankSign2.position.z = -PITCH / 2 - 15.2; scene.add(bankSign2);
  // Dario's garage by the marina: a low wide workshop the deliveries come home to.
  addBuilding(MARINA_X - PITCH, 2 * PITCH, 26, 18, 7, 5);
  const garageSign = new THREE.Mesh(new THREE.PlaneGeometry(20, 4),
    new THREE.MeshBasicMaterial({ map: signTexture("VENN'S GARAGE", '#0d2030', '#7dd8ff') }));
  garageSign.position.set(MARINA_X - PITCH, 6, 2 * PITCH + 9.2); scene.add(garageSign);

  // ---------- palms & lamps & props ----------
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 5.6, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
  const frondGeo = new THREE.BoxGeometry(0.34, 0.05, 3.1);
  frondGeo.translate(0, 0, 1.45); // pivot at the crown, blade reaching out
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x4c9440, emissive: 0x14300e, side: THREE.DoubleSide });
  function addPalm(x, z, lean) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2.8; trunk.rotation.z = lean; trunk.castShadow = true; g.add(trunk);
    const crown = new THREE.Group();
    crown.position.set(Math.sin(lean) * -2.6, 5.75, 0);
    for (let i = 0; i < 7; i++) {
      const holder = new THREE.Group();
      holder.rotation.y = (i / 7) * Math.PI * 2 + rand() * 0.4;
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.rotation.x = 0.42 + rand() * 0.25; // droop: +x rotation tips the +z blade downward
      frond.castShadow = true;
      holder.add(frond);
      crown.add(holder);
    }
    g.add(crown);
    g.position.set(x, groundY(x, z), z);
    g.rotation.y = rand() * Math.PI * 2;
    scene.add(g);
  }
  for (let x = CITY_MIN_X + 8; x < CITY_MAX_X - 4; x += 13 + rand() * 9) addPalm(x, CITY_MAX_Z + 8 + rand() * 16, (rand() - 0.5) * 0.22);
  // the marina boulevard: palms marching along both kerbs of the z=112 road
  for (let x = -GRID_X * PITCH + 6; x < GRID_X * PITCH; x += 27) {
    addPalm(x, 2 * PITCH - 6.5, (rand() - 0.5) * 0.18);
    addPalm(x + 13, 2 * PITCH + 9.5, (rand() - 0.5) * 0.18);
  }
  for (const z of [PITCH / 2, -PITCH / 2]) for (let x = -GRID_X * PITCH; x <= GRID_X * PITCH; x += PITCH) addPalm(x + 12, z + (rand() - 0.5) * 4, (rand() - 0.5) * 0.15);
  for (let i = 0; i < 26; i++) addPalm((rand() - 0.5) * 420, (rand() - 0.5) * 300 - 20, (rand() - 0.5) * 0.2);

  const poleGeo = new THREE.CylinderGeometry(0.09, 0.09, 6.4, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  for (const n of INTERSECTIONS) {
    for (const [ox, oz] of [[9, 9], [-9, -9]]) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(n.x + ox, 3.2, n.z + oz); scene.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), headMat);
      head.position.set(n.x + ox, 6.5, n.z + oz); scene.add(head); lampHeads.push(head);
    }
  }
  // beach umbrellas + marina crates
  const umbMats = [0xff5f6d, 0x39c2d7, 0xffd94d, 0xff8c42].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (let i = 0; i < 14; i++) {
    const x = -220 + i * 32 + rand() * 10, z = CITY_MAX_Z + 10 + rand() * 14;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), poleMat);
    pole.position.set(x, 1.3, z); scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.8, 8), umbMats[i % 4]);
    top.position.set(x, 2.7, z); top.castShadow = true; scene.add(top);
  }
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x9a7448 });
  for (let i = 0; i < 16; i++) {
    const x = MARINA_X - 16 + rand() * 30, z = CITY_MAX_Z + 4 + rand() * 20;
    const s = 1 + rand() * 0.8;
    const crate = new THREE.Mesh(boxGeo(s, s, s), crateMat);
    crate.position.set(x, s / 2, z); crate.rotation.y = rand(); crate.castShadow = true; scene.add(crate);
    colliders.push({ minX: x - s / 2, maxX: x + s / 2, minZ: z - s / 2, maxZ: z + s / 2 });
  }
  // ---------- pier & boats & billboard ----------
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
  const pier = new THREE.Mesh(boxGeo(11, 0.32, MARINA_END_Z - CITY_MAX_Z + 4), pierMat);
  pier.position.set(MARINA_X, 0.16, (CITY_MAX_Z + MARINA_END_Z) / 2);
  pier.receiveShadow = true; pier.castShadow = true; scene.add(pier);
  const hullMats = [0xe8e4da, 0x39c2d7, 0xff5f6d, 0xffd94d, 0x7dff8a].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  for (let i = 0; i < 5; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(boxGeo(3.2, 1.1, 8.5), hullMats[i]);
    hull.position.y = 0.4; boat.add(hull);
    const cabin = new THREE.Mesh(boxGeo(2.2, 1.2, 3), new THREE.MeshLambertMaterial({ color: 0xf2efe8 }));
    cabin.position.set(0, 1.4, -0.6); boat.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 5), poleMat);
    mast.position.set(0, 3.4, 1.4); boat.add(mast);
    const side = i % 2 === 0 ? -1 : 1;
    boat.position.set(MARINA_X + side * 9.5, -0.1, SAND_END_Z + 8 + i * 11);
    boat.rotation.y = (rand() - 0.5) * 0.14;
    scene.add(boat); boats.push({ g: boat, phase: rand() * 6 });
  }
  const bb = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.5),
    new THREE.MeshBasicMaterial({ map: textures.billboard }));
  bb.position.set(MARINA_X - 34, 10, CITY_MAX_Z + 26); bb.rotation.y = Math.PI + 0.5; scene.add(bb);
  const bbBack = bb.clone(); bbBack.rotation.y = 0.5; bbBack.position.z += 0.1; scene.add(bbBack);
  for (const dx of [-14, 14]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 10, 6), poleMat);
    post.position.set(MARINA_X - 34 + dx, 5, CITY_MAX_Z + 26); scene.add(post);
  }

  /** Push a circle (pos.x/z, radius) out of every building box; returns how hard it hit. */
  function collideCircle(pos, radius) {
    let hit = 0;
    for (const b of colliders) {
      const nx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - nx, dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (radius - d) / d;
        pos.x += dx * push; pos.z += dz * push; hit = Math.max(hit, radius - d);
      } else {
        // centre inside the box: leave by the shortest side
        const left = pos.x - b.minX, right = b.maxX - pos.x, top = pos.z - b.minZ, bot = b.maxZ - pos.z;
        const m = Math.min(left, right, top, bot);
        if (m === left) pos.x = b.minX - radius; else if (m === right) pos.x = b.maxX + radius;
        else if (m === top) pos.z = b.minZ - radius; else pos.z = b.maxZ + radius;
        hit = Math.max(hit, 0.5);
      }
    }
    pos.x = Math.max(CITY_MIN_X - 30, Math.min(CITY_MAX_X + 30, pos.x));
    pos.z = Math.max(CITY_MIN_Z - 24, Math.min(WATER_END_Z, pos.z));
    return hit;
  }

  let t = 0;
  function update(dt) {
    t += dt;
    waterMat.map.offset.set((t * 0.008) % 1, (t * 0.005) % 1);
    for (const b of boats) b.g.position.y = -0.1 + Math.sin(t * 0.9 + b.phase) * 0.12;
  }

  return { colliders, collideCircle, sun, update, boats };
}
