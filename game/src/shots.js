// Vice Tides — deterministic screenshot staging. ?shot=1..4 sets a scene (hero,
// chase, downtown, marina delivery), the main loop simulates a few fixed steps so
// traffic and crowds settle naturally, then stageShotPost pins the camera, the
// marker and the phone so the frame reads exactly like real play.
import { LANDMARKS } from './world.js';
import { makeCar } from './vehicles.js';

const M = LANDMARKS;

function addCar(G, kind, paint, x, z, heading, driver, speed = 0) {
  const car = makeCar(kind, paint, x, z, heading);
  car.driver = driver;
  car.speed = speed;
  G.scene.add(car.mesh);
  G.cars.push(car);
  return car;
}

export function stageShotPre(G, n) {
  const P = G.player;
  P.money = [0, 2450, 5180, 3310, 4875][n] || 0;
  if (n === 1) {
    // cover: Rico beside a red sports coupe on the marina boulevard, skyline behind
    P.mesh.position.set(122.5, 0, 108.5);
    P.heading = -0.6; // face the camera, the coupe and the bay behind him
    addCar(G, 'sport', 0xd94f3d, 128.5, 112.8, -0.42, 'parked');
    G.objectiveOverride = '<b>First Wheels:</b> Deliver the coupe to <b>Venn\'s Garage</b>';
  } else if (n === 2) {
    // chase: three stars on the downtown east-west road, cops on the bumper
    const car = addCar(G, 'sedan', 0x3d7bd9, -30, 4, Math.PI / 2, 'player', 17);
    P.inCar = car;
    P.mesh.visible = false;
    const copSpots = [[-40.5, 0.8], [-45.5, 7.6], [-51, 3.4]];
    for (const [cx, cz] of copSpots) {
      const cop = addCar(G, 'police', 0xf2f2f2, cx, cz, Math.PI / 2, 'police', 18.5);
      cop.ai = { ramAt: 0 };
    }
    G.wanted.heat = 262; G.wanted.stars = 3;
    G._copSpawnAt = 1e9; // the staged units are the whole response
    G.objectiveOverride = '<b>Heat Run:</b> <b>Lose the police</b> — break away and stay hidden';
  } else if (n === 3) {
    // downtown on foot: traffic, pedestrians, towers and shopfronts
    P.mesh.position.set(7.5, 0, 9.5);
    P.heading = -2.25;
    const traffic = G.cars.filter((c) => c.driver === 'traffic');
    const straight = (car, x, z, heading, speed) => {
      car.mesh.position.set(x, 0, z);
      car.heading = heading; car.speed = speed;
      car.ai.target = { x: x + Math.sin(heading) * 60, z: z + Math.cos(heading) * 60 };
    };
    if (traffic[0]) straight(traffic[0], -3.9, 24, 0, 7);
    if (traffic[1]) straight(traffic[1], 24, -3.9, -Math.PI / 2, 7);
    if (traffic[2]) straight(traffic[2], 3.9, -26, Math.PI, 6);
    const spots = [[11, 3.5], [3, 13.5], [13.5, 13], [-6, 12]];
    G.peds.slice(0, 4).forEach((ped, i) => {
      ped.mesh.position.set(spots[i][0], 0.18, spots[i][1]);
      ped.target = { x: spots[i][0] + 6, z: spots[i][1] + 2 };
    });
    G.objectiveOverride = '<b>Heat Run:</b> Pick up the <b>client</b> downtown';
  } else if (n === 4) {
    // marina delivery: the gold marker on the pier, Dario on the phone
    const car = addCar(G, 'sedan', 0x53c05a, 103, 127, 0.35, 'player', 0);
    P.inCar = car;
    P.mesh.visible = false;
    G.objectivePos = { x: M.marinaDrop.x, z: M.marinaDrop.z };
    G.objectiveOverride = '<b>Heat Run:</b> Drop the client at the <b>marina</b>';
  }
}

export function stageShotPost(G, n) {
  const P = G.player;
  const pp = G.playerPos();
  if (n === 1) {
    G.shotCam = { x: 117.8, y: 2.35, z: 117.2, lx: 124.8, ly: 1.5, lz: 109.5 };
  } else if (n === 2) {
    // freeze the strobes mid-flash: one unit red, the next blue
    G.cars.filter((c) => c.driver === 'police').forEach((cop, i) => {
      const lm = cop.mesh.userData.lightMats;
      if (!lm) return;
      lm.red.color.setHex(i % 2 ? 0x551118 : 0xff2233);
      lm.blue.color.setHex(i % 2 ? 0x3366ff : 0x112255);
    });
    G.shotCam = { x: pp.x - 17.5, y: 5.0, z: pp.z - 9.5, lx: pp.x + 9, ly: 1.2, lz: pp.z + 1 };
  } else if (n === 3) {
    G.shotCam = { x: 17.5, y: 3.1, z: 19.5, lx: 6.5, ly: 1.4, lz: 8.5 };
  } else if (n === 4) {
    if (G.marker) {
      G.marker.visible = true;
      G.marker.position.set(M.marinaDrop.x, 0.32, M.marinaDrop.z);
    }
    G.hud.phone('Dario Venn', 'Bring her home to the marina, Rico. Dockside, gold ring — you can\'t miss it.', 60);
    G.shotCam = { x: 90, y: 3.9, z: 110, lx: 111, ly: 1.4, lz: 152 };
  }
  if (n !== 4) G.hud.phone('Dario Venn', 'Palmera Bay is watching, Rico. Make it count.', 60);
  P.mesh.rotation.y = P.heading;
}
