// Vice Tides — traffic and parked cars. Traffic follows the road grid from
// intersection to intersection on the right-hand lane, slows for whatever is in
// front of it (cars, the player, crossing pedestrians), and recycles itself to
// the far side of the city when it drifts too far from the action.
const THREE = window.THREE;
import { PITCH, TRAFFIC_COUNT, PARKED_COUNT } from './config.js';
import { INTERSECTIONS, V_ROADS, H_ROADS, groundY } from './world.js';
import { makeCar, PAINTS } from './vehicles.js';
import { moveCar } from './driving.js';

const LANE = 3.9;
const CRUISE = 12.5;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const rand = rng(777001);

function nodeAt(x, z) { return INTERSECTIONS.find((n) => n.x === x && n.z === z) || INTERSECTIONS[0]; }
function neighbours(node) {
  return INTERSECTIONS.filter((n) => (n.x === node.x) !== (n.z === node.z) &&
    Math.abs(n.x - node.x) + Math.abs(n.z - node.z) === PITCH);
}
function lanePoint(node, dirX, dirZ) {
  // right of travel direction (dx,dz) in xz is (dz, -dx)
  return { x: node.x + dirZ * LANE, z: node.z - dirX * LANE };
}
function pickTarget(car) {
  const opts = neighbours(car.ai.node).filter((n) => n !== car.ai.prev);
  const next = opts[(rand() * opts.length) | 0] || car.ai.prev;
  car.ai.prev = car.ai.node;
  car.ai.node = next;
  const dx = Math.sign(next.x - car.ai.prev.x), dz = Math.sign(next.z - car.ai.prev.z);
  car.ai.target = lanePoint(next, dx, dz);
  car.ai.dirX = dx; car.ai.dirZ = dz;
}

export function spawnTraffic(G) {
  const kinds = ['sedan', 'sedan', 'taxi', 'sport', 'van', 'pickup'];
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const node = INTERSECTIONS[(rand() * INTERSECTIONS.length) | 0];
    const car = makeCar(kinds[i % kinds.length], PAINTS[(rand() * PAINTS.length) | 0],
      node.x, node.z, rand() * Math.PI * 2);
    car.driver = 'traffic';
    car.ai = { node, prev: node, target: null, dirX: 0, dirZ: 1 };
    pickTarget(car);
    // start partway along the first edge so the grid is not a traffic jam at t=0
    car.mesh.position.x += car.ai.dirX * rand() * PITCH * 0.7;
    car.mesh.position.z += car.ai.dirZ * rand() * PITCH * 0.7;
    car.heading = Math.atan2(car.ai.dirX, car.ai.dirZ);
    car.mesh.position.y = groundY(car.mesh.position.x, car.mesh.position.z);
    G.scene.add(car.mesh);
    G.cars.push(car);
  }
}

export function spawnParked(G) {
  const kinds = ['sedan', 'sport', 'van', 'pickup', 'taxi'];
  let placed = 0, guard = 0;
  while (placed < PARKED_COUNT && guard++ < 300) {
    const vertical = rand() > 0.5;
    const road = vertical ? V_ROADS[(rand() * V_ROADS.length) | 0] : H_ROADS[(rand() * H_ROADS.length) | 0];
    const along = (rand() - 0.5) * 2 * (vertical ? 168 : 224);
    const side = rand() > 0.5 ? 1 : -1;
    const x = vertical ? road + side * 6.4 : along;
    const z = vertical ? along : road + side * 6.4;
    if (G.cars.some((c) => Math.hypot(c.mesh.position.x - x, c.mesh.position.z - z) < 7)) continue;
    const heading = vertical ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    const car = makeCar(kinds[(rand() * kinds.length) | 0], PAINTS[(rand() * PAINTS.length) | 0], x, z, heading);
    car.driver = 'parked';
    car.mesh.position.y = groundY(x, z);
    G.scene.add(car.mesh);
    G.cars.push(car);
    placed++;
  }
}

/** Is something solid `dist` metres ahead of this car? Returns 0..1 urgency. */
function blockedAhead(G, car, dist) {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  const p = car.mesh.position;
  let urgency = 0;
  const test = (o, radius) => {
    const dx = o.x - p.x, dz = o.z - p.z;
    const ahead = dx * fx + dz * fz;
    if (ahead < 0.5 || ahead > dist) return;
    const side = Math.abs(dx * fz - dz * fx);
    if (side < 2.1 + radius) urgency = Math.max(urgency, 1 - ahead / dist);
  };
  for (const other of G.cars) if (other !== car) test(other.mesh.position, 1.2);
  test(G.playerPos(), 0.4);
  for (const ped of G.peds) if (!ped.down) test(ped.mesh.position, 0.2);
  return urgency;
}

export function updateTraffic(G, dt) {
  const pp = G.playerPos();
  for (const car of G.cars) {
    if (car.driver !== 'traffic') continue;
    const p = car.mesh.position;
    const distToPlayer = Math.hypot(p.x - pp.x, p.z - pp.z);
    if (distToPlayer > 330) { // recycle to the far side of the action
      const near = INTERSECTIONS.filter((n) => {
        const d = Math.hypot(n.x - pp.x, n.z - pp.z); return d > 120 && d < 210;
      });
      if (near.length) {
        const node = near[(rand() * near.length) | 0];
        p.set(node.x, 0, node.z);
        car.ai.node = node; car.ai.prev = node;
        pickTarget(car);
        car.heading = Math.atan2(car.ai.dirX, car.ai.dirZ);
      }
    }
    if (G.time < car.stuckAt) { car.speed = Math.max(0, car.speed - 20 * dt); moveCar(G, car, dt); continue; }
    const t = car.ai.target;
    const dx = t.x - p.x, dz = t.z - p.z;
    const distLeft = Math.hypot(dx, dz);
    if (distLeft < 4.5) pickTarget(car);
    const desired = Math.atan2(dx, dz);
    let dh = desired - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.steer = Math.max(-0.6, Math.min(0.6, dh * 1.4)); // wheel visuals only
    const turnRate = 1.5 * Math.min(1, Math.abs(car.speed) / 6 + 0.25);
    car.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, dh));
    const block = blockedAhead(G, car, 11);
    const cruise = CRUISE * (car.kind === 'van' ? 0.8 : 1) * (1 - block * 0.92);
    car.speed += Math.max(-22 * dt, Math.min(9 * dt, cruise - car.speed));
    if (block > 0.55 && car.speed < 0.4 && distToPlayer < 26 && G.time > car.honkAt) {
      car.honkAt = G.time + 2.5 + rand() * 2;
      G.audio.honk?.();
    }
    moveCar(G, car, dt);
  }
}
