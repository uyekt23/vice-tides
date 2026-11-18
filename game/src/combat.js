// Vice Tides — fists and the pistol. A click punches whatever is in front of Rico
// or, with the pistol out, fires a hitscan shot marched through the city's
// collision boxes so walls honestly block bullets. Hits dent cars, drop
// pedestrians, disable police units — and every bit of it makes heat and noise.
const THREE = window.THREE;
import { LANDMARKS } from './world.js';

export function createPickups(G) {
  // Dario leaves a pistol on the garage workbench: walk over it to take it.
  const grp = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20),
    new THREE.MeshBasicMaterial({ color: 0x39c2d7, transparent: true, opacity: 0.5 }));
  base.position.y = 0.1; grp.add(base);
  const gun = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.52), new THREE.MeshLambertMaterial({ color: 0x22242c }));
  gun.add(body);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.3, 0.14), new THREE.MeshLambertMaterial({ color: 0x4a3220 }));
  grip.position.set(0, -0.18, -0.16); grip.rotation.x = 0.4; gun.add(grip);
  gun.position.y = 0.55; gun.rotation.y = 0.7;
  grp.add(gun);
  grp.position.set(LANDMARKS.garage.x, 0.2, LANDMARKS.garage.z);
  G.scene.add(grp);
  G.pickups = { pistol: grp, taken: false };
}

export function checkPickups(G) {
  if (!G.pickups || G.pickups.taken || G.player.inCar) return;
  const p = G.player.mesh.position, g = G.pickups.pistol.position;
  G.pickups.pistol.rotation.y += 0.02;
  if (Math.hypot(p.x - g.x, p.z - g.z) < 1.6) {
    G.pickups.taken = true;
    G.pickups.pistol.visible = false;
    G.player.hasPistol = true;
    G.player.weapon = 'pistol';
    G.player.ammo += 48;
    G.audio.pickup();
    G.toast('PISTOL ACQUIRED — Q to swap, click to fire');
    G.phone('Dario Venn', 'Found my little gift at the garage? Good. Try not to wave it around in front of the law.');
  }
}

function frontOf(G, range) {
  const p = G.player.mesh.position;
  return { x: p.x + Math.sin(G.player.heading) * range, z: p.z + Math.cos(G.player.heading) * range };
}

export function updateCombat(G, dt) {
  // muzzle flash light decays
  if (G.flash) {
    G.flash.intensity = Math.max(0, G.flash.intensity - dt * 60);
    if (G.tracer) { G.tracer.material.opacity = Math.max(0, G.tracer.material.opacity - dt * 6); }
  }
  if (!G.input.takeClick() || !G.input.isLocked() || G.player.inCar) return;
  const now = G.time;
  const p = G.player;
  if (p.weapon === 'pistol' && p.hasPistol) {
    if (now - p.shotAt < 0.24) return;
    p.shotAt = now;
    if (p.ammo <= 0) { G.audio.empty(); G.toast('OUT OF AMMO'); return; }
    p.ammo--;
    firePistol(G);
  } else {
    if (now - p.punchAt < 0.34) return;
    p.punchAt = now;
    p.mesh.userData.armR.rotation.x = -2.1; // the swing; the walk cycle settles it back
    punch(G);
  }
}

function punch(G) {
  const reach = frontOf(G, 1.5);
  G.audio.thud();
  for (const ped of G.peds) {
    if (ped.down) continue;
    const pp = ped.mesh.position;
    if (Math.hypot(pp.x - reach.x, pp.z - reach.z) < 1.1) {
      ped.down = true; ped.downAt = G.time;
      ped.mesh.rotation.x = -Math.PI / 2;
      G.addCrime(20, pp);
      G.threatAt = { x: pp.x, z: pp.z, t: G.time };
      return;
    }
  }
  for (const car of G.cars) {
    const cp = car.mesh.position;
    if (Math.hypot(cp.x - reach.x, cp.z - reach.z) < 2.2) {
      car.health -= 4;
      if (car.driver === 'police') G.addCrime(25, cp);
      else G.addCrime(8, cp);
      return;
    }
  }
}

function firePistol(G) {
  G.audio.shot();
  const cam = G.camera;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  const origin = cam.position.clone();
  G.threatAt = { x: origin.x, z: origin.z, t: G.time };
  // flash + tracer
  if (!G.flash) {
    G.flash = new THREE.PointLight(0xffc873, 0, 18);
    G.scene.add(G.flash);
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
    G.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
    G.scene.add(G.tracer);
  }
  const muzzle = origin.clone().add(dir.clone().multiplyScalar(1.2));
  G.flash.position.copy(muzzle);
  G.flash.intensity = 26;
  // march the ray: walls (colliders), then bodies and cars get their chance
  let end = origin.clone().add(dir.clone().multiplyScalar(70));
  let hitWhat = null;
  for (let t = 1; t < 70; t += 0.4) {
    const pt = origin.clone().add(dir.clone().multiplyScalar(t));
    if (pt.y < 0) { end = pt; hitWhat = 'ground'; break; }
    let blocked = false;
    for (const b of G.world.colliders) {
      if (pt.x > b.minX && pt.x < b.maxX && pt.z > b.minZ && pt.z < b.maxZ && pt.y < 80) { blocked = true; break; }
    }
    if (blocked) { end = pt; hitWhat = 'wall'; break; }
    for (const ped of G.peds) {
      if (ped.down) continue;
      const pp = ped.mesh.position;
      if (Math.hypot(pt.x - pp.x, pt.z - pp.z) < 0.62 && pt.y > pp.y && pt.y < pp.y + 1.95) {
        end = pt; hitWhat = ped; break;
      }
    }
    if (hitWhat && hitWhat !== 'ground' && hitWhat !== 'wall') break;
    for (const car of G.cars) {
      const cp = car.mesh.position;
      if (Math.hypot(pt.x - cp.x, pt.z - cp.z) < 2.05 && pt.y > cp.y - 0.2 && pt.y < cp.y + 1.8) {
        end = pt; hitWhat = car; break;
      }
    }
    if (hitWhat) break;
  }
  const pos = G.tracer.geometry.attributes.position;
  pos.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
  pos.setXYZ(1, end.x, end.y, end.z);
  pos.needsUpdate = true;
  G.tracer.material.opacity = 0.9;
  if (hitWhat && typeof hitWhat === 'object' && hitWhat.mesh && 'driver' in hitWhat) {
    const car = hitWhat; // a car took the round
    car.health -= 22;
    if (car.driver === 'police') {
      G.addCrime(45, car.mesh.position);
      if (car.health <= 0 && car.driver === 'police') {
        car.driver = 'wrecked'; car.speed = 0;
        G.toast('POLICE UNIT DISABLED');
      }
    } else G.addCrime(18, car.mesh.position);
  } else if (hitWhat && typeof hitWhat === 'object' && hitWhat.mesh) {
    const ped = hitWhat; // a pedestrian took the round
    ped.down = true; ped.downAt = G.time - 3; // stays down longer
    ped.mesh.rotation.x = -Math.PI / 2;
    G.addCrime(50, ped.mesh.position);
    G.toast('SHOTS FIRED!');
  } else if (G.wanted.stars > 0 || nearCop(G)) {
    G.addCrime(15, origin); // firing near the law still counts
  }
}

function nearCop(G) {
  const p = G.playerPos();
  return G.cars.some((c) => c.driver === 'police' &&
    Math.hypot(c.mesh.position.x - p.x, c.mesh.position.z - p.z) < 60);
}
