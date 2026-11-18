// Vice Tides — the people of Palmera Bay. They stroll the block sidewalks, cross
// to neighbouring blocks, dive away from fast cars and gunfire, and — if a car
// actually reaches them — go down for a while. Each one is the same box humanoid
// as Rico in different clothes.
const THREE = window.THREE;
import { PED_COUNT, BLOCK, PITCH } from './config.js';
import { groundY, isWater } from './world.js';
import { makeHumanoid, randomOutfit, animateHumanoid } from './player.js';

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const rand = rng(4451);

/** A point on a random block's sidewalk edge. */
function sidewalkPoint() {
  const bx = -4 + ((rand() * 8) | 0), bz = -3 + ((rand() * 5) | 0);
  const cx = bx * PITCH + PITCH / 2, cz = bz * PITCH + PITCH / 2;
  const side = (rand() * 4) | 0, t = (rand() - 0.5) * (BLOCK - 4);
  const e = BLOCK / 2 - 1.6;
  if (side === 0) return { x: cx + t, z: cz - e };
  if (side === 1) return { x: cx + t, z: cz + e };
  if (side === 2) return { x: cx - e, z: cz + t };
  return { x: cx + e, z: cz + t };
}

export function spawnPeds(G) {
  for (let i = 0; i < PED_COUNT; i++) {
    const outfit = randomOutfit(rand);
    const mesh = makeHumanoid(outfit.shirt, outfit.pants, outfit.skin, rand() > 0.6 ? 0xe8e4da : null);
    const start = sidewalkPoint();
    mesh.position.set(start.x, groundY(start.x, start.z), start.z);
    G.scene.add(mesh);
    G.peds.push({
      mesh, heading: rand() * Math.PI * 2,
      target: sidewalkPoint(), speed: 1.1 + rand() * 0.9,
      phase: rand() * 9, fleeUntil: 0, fleeFrom: null, down: false, downAt: 0,
    });
  }
}

export function updatePeds(G, dt) {
  const pp = G.playerPos();
  for (const ped of G.peds) {
    const p = ped.mesh.position;
    if (ped.down) {
      if (G.time - ped.downAt > 6) { // dusts himself off and hurries away
        ped.down = false;
        ped.mesh.rotation.x = 0;
        ped.target = sidewalkPoint();
      } else continue;
    }
    // recycle strollers who wandered too far from the story
    if (Math.hypot(p.x - pp.x, p.z - pp.z) > 300) {
      const s = sidewalkPoint();
      p.set(s.x, groundY(s.x, s.z), s.z);
      ped.target = sidewalkPoint();
    }
    let tx = ped.target.x, tz = ped.target.z, speed = ped.speed;
    // threats: a fast car close by, gunfire, a police chase spilling over
    const threat = G.threatAt;
    if (threat && G.time - threat.t < 1.6 && Math.hypot(p.x - threat.x, p.z - threat.z) < 17) {
      ped.fleeUntil = G.time + 1.8; ped.fleeFrom = threat;
    }
    const playerCar = G.player.inCar;
    if (playerCar && Math.abs(playerCar.speed) > 9 && Math.hypot(p.x - pp.x, p.z - pp.z) < 11) {
      ped.fleeUntil = G.time + 1.4; ped.fleeFrom = { x: pp.x, z: pp.z };
    }
    if (G.time < ped.fleeUntil && ped.fleeFrom) {
      const dx = p.x - ped.fleeFrom.x, dz = p.z - ped.fleeFrom.z;
      const d = Math.hypot(dx, dz) || 1;
      tx = p.x + (dx / d) * 14; tz = p.z + (dz / d) * 14;
      speed = 6.4;
    } else if (Math.hypot(tx - p.x, tz - p.z) < 1.2) {
      ped.target = sidewalkPoint();
      continue;
    }
    const dx = tx - p.x, dz = tz - p.z;
    const desired = Math.atan2(dx, dz);
    let dh = desired - ped.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    ped.heading += Math.max(-3.4 * dt, Math.min(3.4 * dt, dh));
    const nx = p.x + Math.sin(ped.heading) * speed * dt;
    const nz = p.z + Math.cos(ped.heading) * speed * dt;
    if (!isWater(nx, nz)) { p.x = nx; p.z = nz; }
    G.world.collideCircle(p, 0.45);
    p.y = groundY(p.x, p.z);
    ped.mesh.rotation.y = ped.heading;
    ped.phase += dt * speed * 2.1;
    animateHumanoid(ped.mesh, ped.phase, speed);
  }
}

/** A car reaching a pedestrian knocks them down. Called from the main loop. */
export function checkPedHits(G) {
  for (const ped of G.peds) {
    if (ped.down) continue;
    const p = ped.mesh.position;
    for (const car of G.cars) {
      if (Math.abs(car.speed) < 3.5) continue;
      const cp = car.mesh.position;
      if (Math.hypot(cp.x - p.x, cp.z - p.z) < 1.75) {
        ped.down = true; ped.downAt = G.time;
        ped.mesh.rotation.x = -Math.PI / 2;
        ped.mesh.position.y = groundY(p.x, p.z) + 0.25;
        if (car.driver === 'player') {
          G.addCrime(35, p);
          G.audio.thud();
          G.toast('PEDESTRIAN DOWN!');
          G.shake = Math.min(0.4, G.shake + 0.15);
        }
        break;
      }
    }
  }
}
