// Vice Tides — Rico Marlin on foot: a box-built character with a swing-limb walk,
// third-person movement relative to the camera, sprinting, and getting in and out
// of cars. The same humanoid builder dresses every pedestrian in the city.
const THREE = window.THREE;
import { PLAYER_RADIUS, WALK_SPEED, SPRINT_SPEED, PLAYER_MAX_HEALTH } from './config.js';
import { groundY, isWater } from './world.js';
import { moveAxes } from './input.js';

const skinTones = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];
const shirtColors = [0xff5f6d, 0x39c2d7, 0xffd94d, 0x7dff8a, 0xe8e4da, 0xff8c42, 0x9b4dca, 0x3d7bd9];

/** A low-poly person. userData holds the limb pivots the walk cycle swings. */
export function makeHumanoid(shirt, pants, skin, hatColor = null) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  function limb(mat, w, len, x, y, z) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat);
    m.position.y = -len / 2; m.castShadow = true;
    pivot.add(m); g.add(pivot);
    return pivot;
  }
  const legL = limb(pantsMat, 0.17, 0.92, -0.11, 0.95, 0);
  const legR = limb(pantsMat, 0.17, 0.92, 0.11, 0.95, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.26), shirtMat);
  torso.position.y = 1.26; torso.castShadow = true; g.add(torso);
  const armL = limb(shirtMat, 0.13, 0.78, -0.34, 1.52, 0);
  const armR = limb(shirtMat, 0.13, 0.78, 0.34, 1.52, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.3), skinMat);
  head.position.y = 1.76; head.castShadow = true; g.add(head);
  if (hatColor !== null) {
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.36), new THREE.MeshLambertMaterial({ color: hatColor }));
    hat.position.y = 1.97; g.add(hat);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.2), hat.material);
    brim.position.set(0, 1.93, 0.26); g.add(brim);
  }
  g.userData = { legL, legR, armL, armR, head, torso };
  return g;
}

export function randomOutfit(rand) {
  return {
    shirt: shirtColors[(rand() * shirtColors.length) | 0],
    pants: shirtColors[(rand() * shirtColors.length) | 0],
    skin: skinTones[(rand() * skinTones.length) | 0],
  };
}

/** Swing the limbs for a walker covering ground at `speed`; settle when still. */
export function animateHumanoid(mesh, phase, speed) {
  const u = mesh.userData;
  const swing = Math.sin(phase) * Math.min(0.65, 0.2 + speed * 0.09);
  u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8; u.armR.rotation.x = swing * 0.8;
  mesh.position.y += 0; // caller owns y (ground height)
}

export function createPlayer(scene) {
  const mesh = makeHumanoid(0xff8c42, 0x2c3e50, 0xc98a5a, 0x22242c); // Rico: orange tee, cap
  scene.add(mesh);
  const player = {
    mesh,
    heading: Math.PI, // face south, toward the marina
    health: PLAYER_MAX_HEALTH,
    money: 120,
    weapon: 'fists',
    hasPistol: false,
    ammo: 0,
    inCar: null,
    walkPhase: 0,
    speedNow: 0,
    punchAt: -9, shotAt: -9,
    dead: false,
  };
  mesh.position.set(126, 0, 108);
  return player;
}

/** On-foot movement for one frame. `world` is the createWorld result. */
export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const axes = moveAxes(input);
  const sprint = input.held('ShiftLeft') || input.held('ShiftRight');
  const speed = sprint ? SPRINT_SPEED : WALK_SPEED;
  const moving = Math.abs(axes.x) > 0.01 || Math.abs(axes.z) > 0.01;
  p.speedNow = moving ? speed : 0;
  if (moving) {
    const sin = Math.sin(G.camYaw), cos = Math.cos(G.camYaw);
    // camera forward is (sin, cos) in xz; right is (cos, -sin)
    const wx = axes.x * cos + axes.z * sin;
    const wz = -axes.x * sin + axes.z * cos;
    const targetHeading = Math.atan2(wx, wz);
    let dh = targetHeading - p.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    p.heading += dh * Math.min(1, dt * 14);
    const nx = p.mesh.position.x + wx * speed * dt;
    const nz = p.mesh.position.z + wz * speed * dt;
    if (!isWater(nx, nz)) { p.mesh.position.x = nx; p.mesh.position.z = nz; }
    else if (!isWater(nx, p.mesh.position.z)) p.mesh.position.x = nx;
    else if (!isWater(p.mesh.position.x, nz)) p.mesh.position.z = nz;
    G.world.collideCircle(p.mesh.position, PLAYER_RADIUS);
    p.walkPhase += dt * speed * 1.9;
  }
  p.mesh.position.y = groundY(p.mesh.position.x, p.mesh.position.z);
  p.mesh.rotation.y = p.heading;
  animateHumanoid(p.mesh, p.walkPhase, p.speedNow);
  // arms settle into a ready stance when the pistol is out
  if (p.weapon === 'pistol') {
    p.mesh.userData.armR.rotation.x = -1.25;
    p.mesh.userData.armL.rotation.x = -1.05;
  }
}

/** The nearest car the player could get into, or null. */
export function nearestCar(G, maxDist = 3.4) {
  const p = G.player.mesh.position;
  let best = null, bestD = maxDist;
  for (const car of G.cars) {
    if (car.driver === 'player') continue;
    const d = Math.hypot(car.mesh.position.x - p.x, car.mesh.position.z - p.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** Enter or exit a car. Returns 'in', 'out', or null when nothing was in reach. */
export function tryEnterExit(G) {
  const p = G.player;
  if (p.inCar) {
    const car = p.inCar;
    p.inCar = null;
    car.driver = car.wasPolice ? 'police' : 'parked';
    if (car.driver === 'parked') car.speed = 0;
    const side = car.heading + Math.PI / 2;
    p.mesh.position.set(
      car.mesh.position.x + Math.sin(side) * 2.2,
      0,
      car.mesh.position.z + Math.cos(side) * 2.2,
    );
    G.world.collideCircle(p.mesh.position, PLAYER_RADIUS);
    p.mesh.position.y = groundY(p.mesh.position.x, p.mesh.position.z);
    p.mesh.visible = true;
    G.audio.engine(false, 0, 0.1); G.audio.radio(false);
    return 'out';
  }
  const car = nearestCar(G);
  if (!car) return null;
  const wasParked = car.driver === 'parked';
  const wasTraffic = car.driver === 'traffic';
  car.wasPolice = car.driver === 'police';
  car.driver = 'player';
  car.ai = null;
  p.inCar = car;
  p.mesh.visible = false;
  if (wasParked || wasTraffic) {
    G.addCrime(30, car.mesh.position); // grand theft auto
    if (wasTraffic) G.toast('CAR JACKED!');
  }
  G.camYaw = car.heading;
  return 'in';
}
