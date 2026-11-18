// Vice Tides — arcade driving for the player's car, plus the car-vs-car collision
// pass every vehicle shares. Heavy hits cost health (the car's and, a little,
// Rico's), make noise, and — when the law is watching — heat.
import { CAR_RADIUS } from './config.js';
import { groundY, isWater } from './world.js';
import { animateCar } from './vehicles.js';

const MAX_SPEED = { sport: 39, sedan: 32, taxi: 32, police: 34, van: 26, pickup: 29 };

/** Drive the car Rico is sitting in. */
export function updatePlayerCar(G, dt) {
  const car = G.player.inCar;
  if (!car) return;
  const input = G.input;
  const maxF = MAX_SPEED[car.kind] ?? 30;
  const fwd = input.held('KeyW') || input.held('ArrowUp');
  const back = input.held('KeyS') || input.held('ArrowDown');
  const hand = input.held('Space');
  let steerIn = 0;
  if (input.held('KeyA')) steerIn += 1;
  if (input.held('KeyD')) steerIn -= 1;
  const speedRatio = car.speed / maxF;

  if (fwd) car.speed += 15 * dt * (1 - Math.max(0, speedRatio) * 0.55);
  else if (back) {
    if (car.speed > 0.6) car.speed -= 26 * dt;               // brakes
    else car.speed = Math.max(-10, car.speed - 9 * dt);      // reverse
  } else car.speed -= car.speed * 0.55 * dt;                 // engine drag
  if (hand) car.speed -= car.speed * 2.6 * dt;
  car.speed = Math.max(-10, Math.min(maxF, car.speed));

  const steerTarget = steerIn * 0.55 / (1 + Math.abs(car.speed) * 0.055);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 7);
  if (Math.abs(car.speed) > 0.05) {
    // heading grows toward +x from +z, which is a left turn from the driver's seat;
    // steer is +1 for A (left). Signed speed makes the turn reverse in reverse.
    const grip = hand ? 0.52 : 0.34;
    car.heading += car.steer * car.speed * grip * dt;
  }
  moveCar(G, car, dt, true);
  G.audio.engine(true, speedRatio, dt);
  G.audio.radio(true);
  G.camYaw = car.heading; // chase cam looks along the nose (+z forward)
}

/** Integrate one car along its heading, collide with the world, count the damage. */
export function moveCar(G, car, dt, isPlayerCar = false) {
  const p = car.mesh.position;
  const vx = Math.sin(car.heading) * car.speed;
  const vz = Math.cos(car.heading) * car.speed;
  const nx = p.x + vx * dt, nz = p.z + vz * dt;
  if (isWater(nx, nz) && Math.abs(car.speed) > 0.1) {
    car.speed *= 0.4; // the bay is not a road
  } else { p.x = nx; p.z = nz; }
  const before = car.speed;
  const hit = G.world.collideCircle(p, CAR_RADIUS);
  if (hit > 0.12 && Math.abs(before) > 3) {
    const impact = Math.abs(before);
    car.speed = -before * 0.22;
    car.health -= impact * 1.6;
    if (isPlayerCar) {
      G.player.health -= Math.max(0, impact - 6) * 0.55;
      G.audio.crash(impact / 12);
      G.addCrime(10, p);
      G.shake = Math.min(0.5, impact * 0.02);
    } else if (G.time - car.lastHitAt > 1) {
      car.lastHitAt = G.time;
      if (Math.hypot(p.x - G.playerPos().x, p.z - G.playerPos().z) < 40) G.audio.crash(impact / 16);
    }
  }
  p.y = groundY(p.x, p.z);
  car.mesh.rotation.y = car.heading;
  // a little body roll in the corners, pitch under braking: cheap feel
  car.mesh.rotation.z = -car.steer * Math.min(0.09, Math.abs(car.speed) * 0.0035);
  animateCar(car, dt);
}

/** Circle-vs-circle between every pair of cars: push apart, trade speed, dent panels. */
export function collideCars(G, dt) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const pa = a.mesh.position, pb = b.mesh.position;
      const dx = pb.x - pa.x, dz = pb.z - pa.z;
      const d2 = dx * dx + dz * dz, min = 3.1;
      if (d2 >= min * min || d2 < 1e-4) continue;
      const d = Math.sqrt(d2), push = (min - d) / 2;
      const ux = dx / d, uz = dz / d;
      const playerInvolved = a.driver === 'player' || b.driver === 'player';
      if (a.driver !== 'player') { pa.x -= ux * push; pa.z -= uz * push; }
      if (b.driver !== 'player') { pb.x += ux * push; pb.z += uz * push; }
      if (playerInvolved) { pa.x -= ux * push * 0.4; pa.z -= uz * push * 0.4; pb.x += ux * push * 0.4; pb.z += uz * push * 0.4; }
      const relSpeed = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.3;
      if (relSpeed > 4) {
        a.health -= relSpeed; b.health -= relSpeed;
        const mid = { x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2 };
        if (playerInvolved) {
          G.audio.crash(relSpeed / 10);
          G.addCrime(14, mid);
          G.shake = Math.min(0.45, relSpeed * 0.018);
          G.player.health -= Math.max(0, relSpeed - 8) * 0.4;
        }
        a.speed *= 0.55; b.speed *= 0.55;
        if (a.driver === 'traffic') a.stuckAt = G.time + 1.6;
        if (b.driver === 'traffic') b.stuckAt = G.time + 1.6;
      } else { a.speed *= 0.92; b.speed *= 0.92; }
    }
  }
}
