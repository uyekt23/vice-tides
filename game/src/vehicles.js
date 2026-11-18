// Vice Tides — the car factory. Every car is boxes and cylinders: a body, a cabin,
// four steerable/spinning wheels, lights, and kind-specific trim (taxi sign, police
// lightbar, sports spoiler, van box). Six kinds, a paint palette, one shared geometry
// cache so a whole traffic jam costs very little.
const THREE = window.THREE;

export const CAR_KINDS = ['sedan', 'sport', 'taxi', 'van', 'pickup', 'police'];
export const PAINTS = [0xd94f3d, 0x3d7bd9, 0x53c05a, 0xe8b83a, 0xe8e4da, 0x8a8f9a, 0x30323e, 0x9b4dca, 0x3ac2c9, 0xd97fb0];

const geoCache = new Map();
function box(w, h, d) {
  const k = `b${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
const wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.28, 12);
wheelGeo.rotateZ(Math.PI / 2);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17181c });
const glassMat = new THREE.MeshPhongMaterial({ color: 0x1c2a3a, shininess: 90, specular: 0xaaddff });
const chromeMat = new THREE.MeshLambertMaterial({ color: 0xc9ccd4 });

function part(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = true;
  parent.add(m); return m;
}

/** Build one car. Returns the group; group.userData carries wheels, lightbar mats, lights. */
export function makeCarMesh(kind, paint) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshPhongMaterial({ color: paint, shininess: 60, specular: 0x666666 });
  const isVan = kind === 'van', isSport = kind === 'sport', isPickup = kind === 'pickup';
  const len = isVan ? 4.9 : isSport ? 4.6 : 4.35;
  const bodyH = isVan ? 1.5 : 0.62;
  const bodyY = isVan ? 1.12 : 0.62;
  part(box(1.92, bodyH, len), bodyMat, 0, bodyY, 0, g);
  if (!isVan) {
    const cabinLen = isSport ? 1.9 : 2.1;
    part(box(1.7, 0.55, cabinLen), glassMat, 0, 1.18, isSport ? -0.25 : -0.1, g);
    part(box(1.78, 0.09, cabinLen + 0.25), bodyMat, 0, 1.47, isSport ? -0.25 : -0.1, g);
  } else {
    part(box(1.8, 0.6, 1.1), glassMat, 0, 1.62, len / 2 - 0.62, g);
  }
  if (isPickup) part(box(1.86, 0.42, 1.7), new THREE.MeshLambertMaterial({ color: 0x22242a }), 0, 1.06, -len / 2 + 0.95, g);
  if (isSport) {
    part(box(1.8, 0.07, 0.42), bodyMat, 0, 1.06, -len / 2 + 0.18, g); // spoiler blade
    part(box(0.12, 0.22, 0.3), bodyMat, -0.7, 0.9, -len / 2 + 0.18, g);
    part(box(0.12, 0.22, 0.3), bodyMat, 0.7, 0.9, -len / 2 + 0.18, g);
  }
  if (kind === 'taxi') {
    const sign = part(box(0.85, 0.26, 0.34), new THREE.MeshBasicMaterial({ color: 0xffd94d }), 0, 1.66, -0.1, g);
    sign.castShadow = false;
  }
  let lightMats = null;
  if (kind === 'police') {
    part(box(1.7, 0.16, 0.5), chromeMat, 0, 1.52, -0.1, g);
    const red = new THREE.MeshBasicMaterial({ color: 0xff2233 });
    const blue = new THREE.MeshBasicMaterial({ color: 0x2255ff });
    part(box(0.5, 0.18, 0.46), red, -0.42, 1.56, -0.1, g).castShadow = false;
    part(box(0.5, 0.18, 0.46), blue, 0.42, 1.56, -0.1, g).castShadow = false;
    lightMats = { red, blue };
    part(box(1.94, 0.3, len * 0.5), new THREE.MeshLambertMaterial({ color: 0x22242c }), 0, 0.62, 0, g);
  }
  // lights: headlights front (+z is the nose), tail lights rear
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
  part(box(0.34, 0.14, 0.06), headMat, -0.62, 0.72, len / 2 + 0.01, g).castShadow = false;
  part(box(0.34, 0.14, 0.06), headMat, 0.62, 0.72, len / 2 + 0.01, g).castShadow = false;
  part(box(0.36, 0.12, 0.06), tailMat, -0.6, 0.74, -len / 2 - 0.01, g).castShadow = false;
  part(box(0.36, 0.12, 0.06), tailMat, 0.6, 0.74, -len / 2 - 0.01, g).castShadow = false;

  const wheels = [];
  const wz = len / 2 - 0.85;
  for (const [sx, sz] of [[-0.88, wz], [0.88, wz], [-0.88, -wz], [0.88, -wz]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.37, sz);
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.castShadow = true;
    pivot.add(w); g.add(pivot);
    wheels.push({ pivot, spin: w, front: sz > 0 });
  }
  g.userData = { wheels, lightMats, len };
  return g;
}

/** A fresh car entity: mesh plus the physics/AI state every driver shares. */
export function makeCar(kind, paint, x, z, heading) {
  const mesh = makeCarMesh(kind, paint);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    mesh, kind, paint,
    heading, speed: 0, steer: 0,
    driver: 'parked',        // parked | traffic | police | player
    health: 100,
    honkAt: 0, stuckAt: 0, lastHitAt: -9,
    ai: null,                 // traffic/police scratch state
  };
}

/** Roll the wheels and swing the front pair to match speed and steering. */
export function animateCar(car, dt) {
  const { wheels } = car.mesh.userData;
  for (const w of wheels) {
    w.spin.rotation.x += (car.speed * dt) / 0.37;
    if (w.front) w.pivot.rotation.y = car.steer * 0.5;
  }
  // note: the car's y (ground height) is owned by whoever moves it — see driving.js
}
