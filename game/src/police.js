// Vice Tides — the law. Heat rises with every witnessed crime and becomes stars;
// police cars spawn at the edge of sight, hunt Rico down, ram him, and try to hold
// him still long enough to bust him. Break line of sight (distance, in practice)
// and the heat bleeds away until the stars go out.
const THREE = window.THREE;
import { HEAT_PER_STAR, MAX_STARS, POLICE_PER_STAR, POLICE_MAX_SPEED, PITCH } from './config.js';
import { INTERSECTIONS } from './world.js';
import { makeCar } from './vehicles.js';
import { moveCar } from './driving.js';

export function createWanted() {
  return { heat: 0, stars: 0, hideTimer: 0, bustTimer: 0, lastCrimeAt: -99 };
}

export function addCrime(G, points, pos) {
  const w = G.wanted;
  // a crime only counts when someone could plausibly see it: near a road, a ped, or a cop
  w.heat = Math.min(HEAT_PER_STAR * MAX_STARS, w.heat + points);
  w.lastCrimeAt = G.time;
  w.hideTimer = 0;
  w.stars = Math.min(MAX_STARS, Math.ceil(w.heat / HEAT_PER_STAR));
}

function spawnCop(G) {
  const pp = G.playerPos();
  const near = INTERSECTIONS.filter((n) => {
    const d = Math.hypot(n.x - pp.x, n.z - pp.z); return d > 80 && d < 150;
  });
  const node = near.length ? near[(Math.random() * near.length) | 0] : INTERSECTIONS[0];
  const car = makeCar('police', 0xf2f2f2, node.x, node.z, Math.atan2(pp.x - node.x, pp.z - node.z));
  car.driver = 'police';
  car.ai = { ramAt: 0 };
  G.scene.add(car.mesh);
  G.cars.push(car);
  return car;
}

export function updatePolice(G, dt) {
  const w = G.wanted;
  const pp = G.playerPos();
  const cops = G.cars.filter((c) => c.driver === 'police');

  // sight: any cop within 55 m (or a fresh crime) keeps the hunt hot
  const seen = cops.some((c) => Math.hypot(c.mesh.position.x - pp.x, c.mesh.position.z - pp.z) < 55)
    || G.time - w.lastCrimeAt < 2.5;
  if (seen) w.hideTimer = 0; else w.hideTimer += dt;
  if (w.hideTimer > 5 && w.heat > 0) {
    w.heat = Math.max(0, w.heat - 13 * dt);
    w.stars = Math.min(MAX_STARS, Math.ceil(w.heat / HEAT_PER_STAR));
  }

  const wantedCount = w.stars > 0 ? Math.min(8, w.stars * POLICE_PER_STAR) : 0;
  if (cops.length < wantedCount && G.time > (G._copSpawnAt || 0)) {
    G._copSpawnAt = G.time + 1.6;
    spawnCop(G);
  }
  let anyNear = false;
  let busting = false;
  for (const cop of [...cops]) {
    const p = cop.mesh.position;
    const dx = pp.x - p.x, dz = pp.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (w.stars === 0 && dist > 200) { // called off: remove far-away units
      G.scene.remove(cop.mesh);
      G.cars.splice(G.cars.indexOf(cop), 1);
      continue;
    }
    if (dist < 70) anyNear = true;
    // hunt: aim a touch ahead of the player's motion
    const lead = G.player.inCar ? 0.55 : 0.25;
    const tx = pp.x + Math.sin(G.playerHeading()) * lead * 10;
    const tz = pp.z + Math.cos(G.playerHeading()) * lead * 10;
    const desired = Math.atan2(tx - p.x, tz - p.z);
    let dh = desired - cop.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    cop.steer = Math.max(-0.6, Math.min(0.6, dh * 1.5));
    const turnRate = 1.9 * Math.min(1, Math.abs(cop.speed) / 7 + 0.3);
    cop.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, dh));
    const playerSpeed = G.player.inCar ? Math.abs(G.player.inCar.speed) : G.player.speedNow;
    let target = POLICE_MAX_SPEED * (0.55 + w.stars * 0.1);
    if (dist < 7) target = Math.min(target, playerSpeed + 2);
    if (dist > 130) target = POLICE_MAX_SPEED;
    cop.speed += Math.max(-30 * dt, Math.min(16 * dt, target - cop.speed));
    if (G.time < cop.stuckAt) cop.speed = Math.max(0, cop.speed - 24 * dt);
    moveCar(G, cop, dt);
    // lightbar strobes
    const lm = cop.mesh.userData.lightMats;
    if (lm) {
      const phase = (G.time * 6 + cop.mesh.id) % 1 < 0.5;
      lm.red.color.setHex(phase ? 0xff2233 : 0x551118);
      lm.blue.color.setHex(phase ? 0x112255 : 0x3366ff);
    }
    // bust: a cop alongside a nearly-stopped player runs the meter up
    if (dist < 6.5 && playerSpeed < 2.2 && w.stars > 0) busting = true;
  }
  if (busting) {
    w.bustTimer += dt;
    if (w.bustTimer > 2.6) { w.bustTimer = 0; G.onBusted(); }
  } else w.bustTimer = Math.max(0, w.bustTimer - dt * 1.6);
  G.audio.siren(anyNear && w.stars > 0, dt);
}

/** After a bust or a hospital visit the slate is wiped clean. */
export function clearWanted(G) {
  G.wanted.heat = 0; G.wanted.stars = 0; G.wanted.hideTimer = 0; G.wanted.bustTimer = 0;
  for (const cop of G.cars.filter((c) => c.driver === 'police')) {
    cop.driver = 'parked'; cop.speed = 0;
    if (cop.mesh.userData.lightMats) {
      cop.mesh.userData.lightMats.red.color.setHex(0x551118);
      cop.mesh.userData.lightMats.blue.color.setHex(0x112255);
    }
  }
}
